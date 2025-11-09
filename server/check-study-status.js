#!/usr/bin/env node
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const mongoose = require('mongoose');
const axios = require('axios');
const Study = require('./src/models/Study');
const Instance = require('./src/models/Instance');

const ORTHANC_URL = process.env.ORTHANC_URL || 'http://69.62.70.102:8042';
const ORTHANC_AUTH = {
  username: process.env.ORTHANC_USERNAME || 'orthanc',
  password: process.env.ORTHANC_PASSWORD || 'orthanc'
};

async function checkStudyStatus(studyUID) {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    
    console.log(`\n🔍 Checking study: ${studyUID}\n`);
    console.log('='.repeat(70));
    
    // Check MongoDB Study
    const study = await Study.findOne({ studyInstanceUID: studyUID }).lean();
    if (!study) {
      console.log('\n❌ Study not found in MongoDB');
      console.log('\n💡 Action: Upload the DICOM file');
      process.exit(1);
    }
    
    console.log('\n✅ Study found in MongoDB');
    console.log(`   Patient: ${study.patientName} (${study.patientID})`);
    console.log(`   Date: ${study.studyDate}`);
    console.log(`   Modality: ${study.modality}`);
    console.log(`   Description: ${study.studyDescription || 'N/A'}`);
    
    // Check MongoDB Instances
    const instanceCount = await Instance.countDocuments({ studyInstanceUID: studyUID });
    console.log(`\n📊 Instance Records: ${instanceCount}`);
    
    if (instanceCount === 0) {
      console.log('   ❌ No instances found in MongoDB');
    } else {
      console.log('   ✅ Instances exist in MongoDB');
      
      // Check if instances have Orthanc IDs
      const withOrthanc = await Instance.countDocuments({ 
        studyInstanceUID: studyUID,
        orthancInstanceId: { $exists: true, $ne: null }
      });
      console.log(`   ${withOrthanc} of ${instanceCount} have Orthanc IDs`);
    }
    
    // Check Orthanc
    console.log('\n🏥 Checking Orthanc PACS...');
    let inOrthanc = false;
    let orthancInfo = null;
    
    try {
      const studiesResp = await axios.get(`${ORTHANC_URL}/studies`, { auth: ORTHANC_AUTH });
      
      for (const studyId of studiesResp.data) {
        const info = await axios.get(`${ORTHANC_URL}/studies/${studyId}`, { auth: ORTHANC_AUTH });
        if (info.data.MainDicomTags.StudyInstanceUID === studyUID) {
          inOrthanc = true;
          orthancInfo = info.data;
          break;
        }
      }
    } catch (error) {
      console.log(`   ⚠️  Could not connect to Orthanc: ${error.message}`);
    }
    
    if (inOrthanc && orthancInfo) {
      console.log('   ✅ Study found in Orthanc');
      console.log(`   Instances: ${orthancInfo.Instances.length}`);
      console.log(`   Series: ${orthancInfo.Series.length}`);
    } else {
      console.log('   ❌ Study NOT found in Orthanc');
    }
    
    // Overall Status
    console.log('\n' + '='.repeat(70));
    console.log('\n📋 Overall Status:\n');
    
    if (instanceCount > 0 && inOrthanc) {
      console.log('✅ HEALTHY - Study is properly configured');
      console.log('\n   The study should work correctly in the viewer.');
    } else if (instanceCount === 0 && !inOrthanc) {
      console.log('❌ NEEDS RE-UPLOAD - Study has no data');
      console.log('\n   Action Required:');
      console.log('   1. Locate the original DICOM file');
      console.log('   2. Upload it through the web interface');
      console.log('   3. The system will automatically:');
      console.log('      - Store it in Orthanc PACS');
      console.log('      - Create Instance records in MongoDB');
      console.log('      - Generate and cache frames');
    } else if (instanceCount === 0 && inOrthanc) {
      console.log('⚠️  NEEDS MIGRATION - Study in Orthanc but no MongoDB records');
      console.log('\n   Action Required:');
      console.log('   Run: node server/migrate-legacy-studies.js');
    } else if (instanceCount > 0 && !inOrthanc) {
      console.log('⚠️  INCONSISTENT - MongoDB records exist but not in Orthanc');
      console.log('\n   This may work if frames are cached, but re-upload is recommended.');
    }
    
    console.log('\n' + '='.repeat(70) + '\n');
    
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  }
}

// Get study UID from command line or use default
const studyUID = process.argv[2] || '1.3.6.1.4.1.16568.1760629278470.775947117';
checkStudyStatus(studyUID);
