const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const fs = require('fs');
const mongoose = require('mongoose');
const Study = require('./src/models/Study');
const Instance = require('./src/models/Instance');
const axios = require('axios');

const BACKEND_DIR = path.resolve(__dirname, 'backend');
const ORTHANC_URL = process.env.ORTHANC_URL || 'http://69.62.70.102:8042';
const ORTHANC_AUTH = {
  username: process.env.ORTHANC_USERNAME || 'orthanc',
  password: process.env.ORTHANC_PASSWORD || 'orthanc'
};

async function migrateLegacyStudy(studyUID) {
  console.log(`\n📋 Migrating study: ${studyUID}`);
  
  // Check if study has frames in filesystem
  const framesDir = path.join(BACKEND_DIR, `uploaded_frames_${studyUID}`);
  if (!fs.existsSync(framesDir)) {
    console.log(`  ⚠️  No frames directory found, skipping`);
    return { success: false, reason: 'no_frames_dir' };
  }
  
  // Count frames
  const frameFiles = fs.readdirSync(framesDir).filter(f => f.endsWith('.png'));
  const frameCount = frameFiles.length;
  console.log(`  Found ${frameCount} frames in filesystem`);
  
  if (frameCount === 0) {
    console.log(`  ⚠️  No frames found, skipping`);
    return { success: false, reason: 'no_frames' };
  }
  
  // Check if study exists in MongoDB
  const study = await Study.findOne({ studyInstanceUID: studyUID }).lean();
  if (!study) {
    console.log(`  ⚠️  Study not found in MongoDB, skipping`);
    return { success: false, reason: 'no_study_record' };
  }
  
  // Check if instances already exist
  const existingCount = await Instance.countDocuments({ studyInstanceUID: studyUID });
  if (existingCount > 0) {
    console.log(`  ✅ Study already has ${existingCount} instances, skipping`);
    return { success: true, reason: 'already_migrated' };
  }
  
  // Try to find study in Orthanc
  let orthancStudyId = null;
  let orthancInstanceId = null;
  
  try {
    console.log(`  🔍 Searching for study in Orthanc...`);
    const studiesResp = await axios.get(`${ORTHANC_URL}/studies`, { auth: ORTHANC_AUTH });
    
    for (const studyId of studiesResp.data) {
      const studyInfo = await axios.get(`${ORTHANC_URL}/studies/${studyId}`, { auth: ORTHANC_AUTH });
      if (studyInfo.data.MainDicomTags.StudyInstanceUID === studyUID) {
        orthancStudyId = studyId;
        console.log(`  ✅ Found study in Orthanc: ${orthancStudyId}`);
        
        // Get first instance
        if (studyInfo.data.Instances && studyInfo.data.Instances.length > 0) {
          orthancInstanceId = studyInfo.data.Instances[0];
          console.log(`  ✅ Found Orthanc instance: ${orthancInstanceId}`);
        }
        break;
      }
    }
  } catch (error) {
    console.log(`  ⚠️  Could not search Orthanc: ${error.message}`);
  }
  
  // Create instance records
  const instanceRecords = [];
  for (let i = 0; i < frameCount; i++) {
    const record = {
      studyInstanceUID: studyUID,
      seriesInstanceUID: study.seriesInstanceUID || `${studyUID}.series.1`,
      sopInstanceUID: `${studyUID}.frame${i}`,
      instanceNumber: i,
      modality: study.modality || 'OT',
      numberOfFrames: frameCount,
      filesystemPath: path.join(framesDir, `frame_${String(i).padStart(3, '0')}.png`),
      filesystemCached: true,
      cachedAt: new Date()
    };
    
    // Add Orthanc info if available
    if (orthancInstanceId) {
      record.orthancInstanceId = orthancInstanceId;
      record.orthancUrl = `${ORTHANC_URL}/instances/${orthancInstanceId}`;
      record.orthancFrameIndex = i;
      record.orthancStudyId = orthancStudyId;
      record.useOrthancPreview = true;
    }
    
    instanceRecords.push(record);
  }
  
  // Insert instances
  try {
    await Instance.insertMany(instanceRecords, { ordered: false });
    console.log(`  ✅ Created ${instanceRecords.length} instance records`);
    
    // Update study
    await Study.updateOne(
      { studyInstanceUID: studyUID },
      { 
        $set: { 
          numberOfInstances: frameCount,
          orthancStudyId: orthancStudyId
        }
      }
    );
    
    return { success: true, frameCount, hasOrthanc: !!orthancInstanceId };
  } catch (error) {
    console.error(`  ❌ Failed to create instances: ${error.message}`);
    return { success: false, reason: 'insert_failed', error: error.message };
  }
}

async function main() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');
    
    // Find all studies with 0 instances
    const studies = await Study.find({}).lean();
    console.log(`Found ${studies.length} total studies\n`);
    
    const legacyStudies = [];
    for (const study of studies) {
      const instanceCount = await Instance.countDocuments({ studyInstanceUID: study.studyInstanceUID });
      if (instanceCount === 0) {
        legacyStudies.push(study);
      }
    }
    
    console.log(`Found ${legacyStudies.length} studies with 0 instances\n`);
    console.log('=' .repeat(60));
    
    const results = {
      total: legacyStudies.length,
      migrated: 0,
      skipped: 0,
      failed: 0
    };
    
    for (const study of legacyStudies) {
      const result = await migrateLegacyStudy(study.studyInstanceUID);
      
      if (result.success) {
        if (result.reason === 'already_migrated') {
          results.skipped++;
        } else {
          results.migrated++;
        }
      } else {
        results.failed++;
      }
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('\n📊 Migration Summary:');
    console.log(`   Total legacy studies: ${results.total}`);
    console.log(`   Successfully migrated: ${results.migrated}`);
    console.log(`   Skipped: ${results.skipped}`);
    console.log(`   Failed: ${results.failed}`);
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

main();
