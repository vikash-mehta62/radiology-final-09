#!/usr/bin/env node

const mongoose = require('mongoose');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '.env') });

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

async function trace() {
  console.log('🔍 TRACING STUDY:', STUDY_UID, '\n');

  try {
    // MongoDB
    console.log('STEP 1: MongoDB Check');
    console.log('─'.repeat(60));
    await mongoose.connect(process.env.MONGODB_URI);
    
    const Study = require('./src/models/Study');
    const Instance = require('./src/models/Instance');

    const study = await Study.findOne({ studyInstanceUID: STUDY_UID }).lean();
    
    if (!study) {
      console.log('❌ Study not found in MongoDB\n');
      
      // List all studies
      const allStudies = await Study.find({}).select('studyInstanceUID patientName studyDate').lean();
      console.log('Available studies:');
      allStudies.forEach(s => {
        console.log(`  - ${s.studyInstanceUID}`);
        console.log(`    Patient: ${s.patientName}, Date: ${s.studyDate}`);
      });
      
      process.exit(1);
    }

    console.log('✅ Found in MongoDB:');
    console.log(`   Patient: ${study.patientName}`);
    console.log(`   Date: ${study.studyDate}`);
    console.log(`   Orthanc Study ID: ${study.orthancStudyId || 'N/A'}`);

    const instances = await Instance.find({ studyInstanceUID: STUDY_UID })
      .sort({ instanceNumber: 1 })
      .lean();

    console.log(`   Instances: ${instances.length}\n`);

    if (instances.length === 0) {
      console.log('❌ No instances found');
      process.exit(1);
    }

    // Orthanc
    console.log('STEP 2: Orthanc Verification');
    console.log('─'.repeat(60));

    const firstInstance = instances[0];
    const orthancInstanceId = firstInstance.orthancInstanceId;

    if (!orthancInstanceId) {
      console.log('❌ No Orthanc Instance ID\n');
      process.exit(1);
    }

    console.log(`Instance ID: ${orthancInstanceId}`);

    const instanceTags = (await orthancClient.get(`/instances/${orthancInstanceId}/simplified-tags`)).data;
    console.log('✅ Instance metadata:');
    console.log(`   Dimensions: ${instanceTags.Rows}x${instanceTags.Columns}`);
    console.log(`   Frames: ${instanceTags.NumberOfFrames || 1}`);
    console.log(`   Bits: ${instanceTags.BitsAllocated || 8}`);
    console.log(`   Photometric: ${instanceTags.PhotometricInterpretation || 'N/A'}\n`);

    // Render frames
    console.log('STEP 3: Rendering Frames');
    console.log('─'.repeat(60));

    const outputDir = path.join(__dirname, '../output');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const tests = [
      { name: 'Preview', url: `/instances/${orthancInstanceId}/frames/0/preview`, file: 'preview.png' },
      { name: 'Rendered', url: `/instances/${orthancInstanceId}/frames/0/rendered?quality=100`, file: 'rendered.png' }
    ];

    for (const test of tests) {
      try {
        console.log(`${test.name}:`);
        const response = await orthancClient.get(test.url, { responseType: 'arraybuffer' });
        const buffer = Buffer.from(response.data);
        const outputPath = path.join(outputDir, test.file);
        fs.writeFileSync(outputPath, buffer);
        console.log(`   ✅ ${(buffer.length / 1024).toFixed(2)} KB → ${outputPath}`);
      } catch (e) {
        console.log(`   ❌ ${e.message}`);
      }
    }

    console.log('\n✅ Complete! Check output/ directory for images\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await mongoose.disconnect();
  }
}

trace();
