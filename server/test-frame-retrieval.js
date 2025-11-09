#!/usr/bin/env node

/**
 * Test Frame Retrieval
 * Verifies that frames can be retrieved from Orthanc after upload
 */

const mongoose = require('mongoose');
const axios = require('axios');
require('dotenv').config();

const Instance = require('./src/models/Instance');
const { getUnifiedOrthancService } = require('./src/services/unified-orthanc-service');

async function testFrameRetrieval() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/dicomdb');
    console.log('✅ Connected to MongoDB');

    // Get the study UID from command line or use the one from your upload
    const studyUID = process.argv[2] || '1.3.6.1.4.1.16568.1760626972284.217339593';
    
    console.log(`\n🔍 Testing frame retrieval for study: ${studyUID}\n`);

    // 1. Check instances in MongoDB
    const instances = await Instance.find({ studyInstanceUID: studyUID }).lean();
    console.log(`📊 Found ${instances.length} instances in MongoDB`);

    if (instances.length === 0) {
      console.error('❌ No instances found in MongoDB!');
      process.exit(1);
    }

    // Display instance details
    instances.forEach((inst, index) => {
      console.log(`\nInstance ${index + 1}:`);
      console.log(`  - Instance Number: ${inst.instanceNumber}`);
      console.log(`  - SOP Instance UID: ${inst.sopInstanceUID}`);
      console.log(`  - Orthanc Instance ID: ${inst.orthancInstanceId || 'MISSING!'}`);
      console.log(`  - Orthanc Frame Index: ${inst.orthancFrameIndex}`);
      console.log(`  - Number of Frames: ${inst.numberOfFrames || 1}`);
      console.log(`  - Use Orthanc Preview: ${inst.useOrthancPreview}`);
    });

    // 2. Check if instances have Orthanc IDs
    const missingOrthanc = instances.filter(inst => !inst.orthancInstanceId);
    if (missingOrthanc.length > 0) {
      console.error(`\n❌ ${missingOrthanc.length} instances missing Orthanc IDs!`);
      console.error('This means the upload did not complete successfully.');
      process.exit(1);
    }

    console.log('\n✅ All instances have Orthanc IDs');

    // 3. Test Orthanc connection
    const orthancService = getUnifiedOrthancService();
    const connectionTest = await orthancService.testConnection();
    
    if (!connectionTest.connected) {
      console.error('\n❌ Cannot connect to Orthanc!');
      console.error('Error:', connectionTest.error);
      process.exit(1);
    }

    console.log('\n✅ Connected to Orthanc');
    console.log(`   Version: ${connectionTest.version}`);
    console.log(`   Name: ${connectionTest.name}`);

    // 4. Test frame retrieval from Orthanc
    console.log('\n🖼️  Testing frame retrieval from Orthanc...\n');

    for (let i = 0; i < Math.min(instances.length, 3); i++) {
      const inst = instances[i];
      const frameIndex = inst.orthancFrameIndex || 0;

      try {
        console.log(`Testing frame ${i}: orthancInstanceId=${inst.orthancInstanceId}, frameIndex=${frameIndex}`);
        
        const frameBuffer = await orthancService.getFrameAsPng(inst.orthancInstanceId, frameIndex);
        
        console.log(`  ✅ Frame ${i} retrieved successfully (${frameBuffer.length} bytes)`);
      } catch (error) {
        console.error(`  ❌ Frame ${i} retrieval failed:`, error.message);
      }
    }

    // 5. Test via Node.js API endpoint
    console.log('\n🌐 Testing via Node.js API endpoint...\n');

    const nodeServerUrl = process.env.NODE_SERVER_URL || 'http://localhost:8001';

    for (let i = 0; i < Math.min(instances.length, 3); i++) {
      try {
        const frameUrl = `${nodeServerUrl}/api/dicom/studies/${studyUID}/frames/${i}`;
        console.log(`Testing: GET ${frameUrl}`);
        
        const response = await axios.get(frameUrl, {
          responseType: 'arraybuffer',
          timeout: 10000
        });

        console.log(`  ✅ Frame ${i} retrieved via API (${response.data.length} bytes)`);
        console.log(`     Content-Type: ${response.headers['content-type']}`);
        console.log(`     X-Preview-Method: ${response.headers['x-preview-method'] || 'not set'}`);
      } catch (error) {
        console.error(`  ❌ Frame ${i} API retrieval failed:`, error.message);
        if (error.response) {
          console.error(`     Status: ${error.response.status}`);
          console.error(`     Data: ${error.response.data}`);
        }
      }
    }

    console.log('\n✅ Frame retrieval test complete!\n');

  } catch (error) {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
  }
}

// Run test
testFrameRetrieval();
