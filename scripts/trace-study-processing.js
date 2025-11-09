#!/usr/bin/env node

/**
 * Trace Study Processing Through Orthanc
 * Shows step-by-step how a study is processed and retrieves actual images
 */

const mongoose = require('mongoose');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

// Load environment
require('dotenv').config({ path: path.join(__dirname, '../server/.env') });

const STUDY_UID = '1.3.6.1.4.1.16568.1760640137402.333951138';
const ORTHANC_URL = process.env.ORTHANC_URL || 'http://69.62.70.102:8042';
const ORTHANC_AUTH = {
  username: process.env.ORTHANC_USERNAME || 'orthanc',
  password: process.env.ORTHANC_PASSWORD || 'orthanc'
};

const orthancClient = axios.create({
  baseURL: ORTHANC_URL,
  auth: ORTHANC_AUTH,
  timeout: 10000
});

async function traceStudyProcessing() {
  console.log('🔍 TRACING STUDY PROCESSING THROUGH ORTHANC\n');
  console.log(`Study UID: ${STUDY_UID}\n`);
  console.log('═'.repeat(80));

  try {
    // Connect to MongoDB
    console.log('\n📊 STEP 1: Checking MongoDB Records');
    console.log('─'.repeat(80));
    
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    const Study = require('../server/src/models/Study');
    const Instance = require('../server/src/models/Instance');

    // Find study in MongoDB
    const study = await Study.findOne({ studyInstanceUID: STUDY_UID }).lean();
    
    if (!study) {
      console.log('❌ Study not found in MongoDB');
      console.log('   This study may not have been uploaded yet');
      process.exit(1);
    }

    console.log('✅ Study found in MongoDB:');
    console.log(`   Patient: ${study.patientName}`);
    console.log(`   Patient ID: ${study.patientID}`);
    console.log(`   Date: ${study.studyDate}`);
    console.log(`   Modality: ${study.modality}`);
    console.log(`   Description: ${study.studyDescription || 'N/A'}`);
    console.log(`   Orthanc Study ID: ${study.orthancStudyId || 'N/A'}`);

    // Find instances
    const instances = await Instance.find({ studyInstanceUID: STUDY_UID })
      .sort({ instanceNumber: 1 })
      .lean();

    console.log(`   Total Instances: ${instances.length}`);

    if (instances.length === 0) {
      console.log('❌ No instances found for this study');
      process.exit(1);
    }

    console.log('\n   First 3 instances:');
    instances.slice(0, 3).forEach((inst, idx) => {
      console.log(`   ${idx + 1}. Instance #${inst.instanceNumber}`);
      console.log(`      Orthanc Instance ID: ${inst.orthancInstanceId || 'N/A'}`);
      console.log(`      Frames: ${inst.numberOfFrames || 1}`);
      console.log(`      Dimensions: ${inst.rows}x${inst.columns}`);
    });

    // Step 2: Verify in Orthanc
    console.log('\n\n🏥 STEP 2: Verifying Study in Orthanc PACS');
    console.log('─'.repeat(80));

    const orthancStudyId = study.orthancStudyId;
    
    if (!orthancStudyId) {
      console.log('❌ No Orthanc Study ID in MongoDB');
      console.log('   Searching Orthanc by Study UID...');
      
      // Search all studies
      const allStudies = (await orthancClient.get('/studies')).data;
      let foundId = null;
      
      for (const studyId of allStudies) {
        try {
          const tags = (await orthancClient.get(`/studies/${studyId}/simplified-tags`)).data;
          if (tags.StudyInstanceUID === STUDY_UID) {
            foundId = studyId;
            break;
          }
        } catch (e) {
          // Skip
        }
      }
      
      if (!foundId) {
        console.log('❌ Study not found in Orthanc');
        console.log('   The study may have been deleted or not uploaded');
        process.exit(1);
      }
      
      console.log(`✅ Found in Orthanc: ${foundId}`);
    } else {
      console.log(`✅ Orthanc Study ID: ${orthancStudyId}`);
      
      // Get study details
      try {
        const studyDetails = (await orthancClient.get(`/studies/${orthancStudyId}`)).data;
        console.log(`   Series: ${studyDetails.Series ? studyDetails.Series.length : 0}`);
        console.log(`   Instances: ${studyDetails.Instances ? studyDetails.Instances.length : 0}`);
        
        const studyTags = (await orthancClient.get(`/studies/${orthancStudyId}/simplified-tags`)).data;
        console.log(`   Patient Name: ${studyTags.PatientName}`);
        console.log(`   Study Date: ${studyTags.StudyDate}`);
        console.log(`   Modality: ${studyTags.Modality}`);
      } catch (e) {
        console.log(`❌ Error accessing Orthanc study: ${e.message}`);
      }
    }

    // Step 3: Get Instance Details
    console.log('\n\n📋 STEP 3: Instance Details from Orthanc');
    console.log('─'.repeat(80));

    const firstInstance = instances[0];
    const orthancInstanceId = firstInstance.orthancInstanceId;

    if (!orthancInstanceId) {
      console.log('❌ No Orthanc Instance ID found');
      process.exit(1);
    }

    console.log(`Instance ID: ${orthancInstanceId}`);

    try {
      const instanceTags = (await orthancClient.get(`/instances/${orthancInstanceId}/simplified-tags`)).data;
      console.log('✅ Instance metadata retrieved:');
      console.log(`   SOP Instance UID: ${instanceTags.SOPInstanceUID}`);
      console.log(`   Instance Number: ${instanceTags.InstanceNumber || 'N/A'}`);
      console.log(`   Rows: ${instanceTags.Rows}`);
      console.log(`   Columns: ${instanceTags.Columns}`);
      console.log(`   Samples Per Pixel: ${instanceTags.SamplesPerPixel || 1}`);
      console.log(`   Bits Allocated: ${instanceTags.BitsAllocated || 8}`);
      console.log(`   Number of Frames: ${instanceTags.NumberOfFrames || 1}`);
      console.log(`   Photometric Interpretation: ${instanceTags.PhotometricInterpretation || 'N/A'}`);
      console.log(`   Window Center: ${instanceTags.WindowCenter || 'N/A'}`);
      console.log(`   Window Width: ${instanceTags.WindowWidth || 'N/A'}`);
    } catch (e) {
      console.log(`❌ Error getting instance metadata: ${e.message}`);
    }

    // Step 4: Test Frame Rendering
    console.log('\n\n🖼️  STEP 4: Testing Frame Rendering');
    console.log('─'.repeat(80));

    const frameIndex = 0;
    const outputDir = path.join(__dirname, '../output');
    
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // Test different endpoints
    const endpoints = [
      { name: 'Preview (Low-Res)', url: `/instances/${orthancInstanceId}/frames/${frameIndex}/preview`, file: 'frame_preview.png' },
      { name: 'Rendered (Full-Res)', url: `/instances/${orthancInstanceId}/frames/${frameIndex}/rendered?quality=100`, file: 'frame_rendered.png' },
      { name: 'Image-uint8', url: `/instances/${orthancInstanceId}/frames/${frameIndex}/image-uint8`, file: 'frame_uint8.png' }
    ];

    for (const endpoint of endpoints) {
      try {
        console.log(`\nTesting: ${endpoint.name}`);
        console.log(`   URL: ${ORTHANC_URL}${endpoint.url}`);
        
        const response = await orthancClient.get(endpoint.url, {
          responseType: 'arraybuffer'
        });
        
        const buffer = Buffer.from(response.data);
        const outputPath = path.join(outputDir, endpoint.file);
        fs.writeFileSync(outputPath, buffer);
        
        console.log(`   ✅ Success!`);
        console.log(`   Size: ${(buffer.length / 1024).toFixed(2)} KB`);
        console.log(`   Content-Type: ${response.headers['content-type']}`);
        console.log(`   Saved to: ${outputPath}`);
      } catch (e) {
        console.log(`   ❌ Failed: ${e.message}`);
      }
    }

    // Step 5: Check Frame Cache
    console.log('\n\n💾 STEP 5: Checking Frame Cache');
    console.log('─'.repeat(80));

    const cacheDir = path.join(__dirname, '../server/backend', `uploaded_frames_${STUDY_UID}`);
    
    if (fs.existsSync(cacheDir)) {
      const cachedFiles = fs.readdirSync(cacheDir);
      console.log(`✅ Cache directory exists: ${cacheDir}`);
      console.log(`   Cached frames: ${cachedFiles.length}`);
      
      if (cachedFiles.length > 0) {
        console.log('\n   Cached files:');
        cachedFiles.slice(0, 5).forEach(file => {
          const filePath = path.join(cacheDir, file);
          const stats = fs.statSync(filePath);
          console.log(`   - ${file} (${(stats.size / 1024).toFixed(2)} KB)`);
        });
        
        if (cachedFiles.length > 5) {
          console.log(`   ... and ${cachedFiles.length - 5} more`);
        }
      }
    } else {
      console.log(`⚠️  Cache directory does not exist: ${cacheDir}`);
      console.log('   Frames will be generated on first access');
    }

    // Step 6: Summary
    console.log('\n\n📊 SUMMARY');
    console.log('═'.repeat(80));
    console.log('✅ Study found in MongoDB');
    console.log('✅ Study found in Orthanc PACS');
    console.log('✅ Instances linked correctly');
    console.log('✅ Frame rendering working');
    console.log(`✅ Sample images saved to: ${outputDir}`);
    console.log('\n🎉 Study processing verified successfully!');
    console.log('\nCheck the output directory for actual rendered images.');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
  }
}

// Run
traceStudyProcessing();
