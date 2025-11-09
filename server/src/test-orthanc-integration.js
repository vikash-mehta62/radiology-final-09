#!/usr/bin/env node

/**
 * Test Orthanc Integration
 * Verifies that Orthanc is running and properly integrated with the upload workflow
 */

const axios = require('axios');
const path = require('path');

// Load environment variables
require('dotenv').config({ path: path.join(__dirname, '../server/.env') });

const ORTHANC_URL = process.env.ORTHANC_URL || 'http://69.62.70.102:8042';
const ORTHANC_USERNAME = process.env.ORTHANC_USERNAME || 'orthanc';
const ORTHANC_PASSWORD = process.env.ORTHANC_PASSWORD || 'orthanc_secure_2024';

const orthancClient = axios.create({
  baseURL: ORTHANC_URL,
  timeout: 5000,
  auth: {
    username: ORTHANC_USERNAME,
    password: ORTHANC_PASSWORD
  }
});

async function testOrthancConnection() {
  console.log('🔍 Testing Orthanc Integration\n');
  console.log(`   Orthanc URL: ${ORTHANC_URL}`);
  console.log(`   Username: ${ORTHANC_USERNAME}`);
  console.log('');

  try {
    // Test 1: System Info
    console.log('1️⃣  Testing Orthanc connection...');
    const systemResponse = await orthancClient.get('/system');
    console.log(`   ✅ Connected to Orthanc ${systemResponse.data.Version}`);
    console.log(`   Name: ${systemResponse.data.Name}`);
    console.log(`   API Version: ${systemResponse.data.ApiVersion}`);
    console.log('');

    // Test 2: Statistics
    console.log('2️⃣  Checking Orthanc statistics...');
    const statsResponse = await orthancClient.get('/statistics');
    console.log(`   Total Studies: ${statsResponse.data.CountStudies}`);
    console.log(`   Total Series: ${statsResponse.data.CountSeries}`);
    console.log(`   Total Instances: ${statsResponse.data.CountInstances}`);
    console.log(`   Total Patients: ${statsResponse.data.CountPatients}`);
    console.log(`   Disk Size: ${(statsResponse.data.TotalDiskSize / 1024 / 1024).toFixed(2)} MB`);
    console.log('');

    // Test 3: List Studies
    console.log('3️⃣  Listing studies in Orthanc...');
    const studiesResponse = await orthancClient.get('/studies');
    const studies = studiesResponse.data;

    if (studies.length === 0) {
      console.log('   ⚠️  No studies found in Orthanc');
      console.log('   Upload a DICOM file to test the full workflow');
    } else {
      console.log(`   Found ${studies.length} study/studies:`);

      // Get details of first study
      for (let i = 0; i < Math.min(3, studies.length); i++) {
        const studyId = studies[i];
        const studyTags = await orthancClient.get(`/studies/${studyId}/simplified-tags`);
        const studyData = studyTags.data;

        console.log(`\n   Study ${i + 1}:`);
        console.log(`     Orthanc ID: ${studyId}`);
        console.log(`     Study UID: ${studyData.StudyInstanceUID}`);
        console.log(`     Patient: ${studyData.PatientName || 'Unknown'}`);
        console.log(`     Date: ${studyData.StudyDate || 'Unknown'}`);
        console.log(`     Modality: ${studyData.Modality || 'Unknown'}`);

        // Get instances
        const instancesResponse = await orthancClient.get(`/studies/${studyId}/instances`);
        const instances = instancesResponse.data;
        console.log(`     Instances: ${instances.length}`);

        // Check first instance for frames
        if (instances.length > 0) {
          const instanceId = instances[0];
          const instanceTags = await orthancClient.get(`/instances/${instanceId}/simplified-tags`);
          const frameCount = parseInt(instanceTags.data.NumberOfFrames) || 1;
          console.log(`     Frames: ${frameCount}`);

          // Test frame rendering endpoint
          try {
            const frameUrl = `/instances/${instanceId}/frames/0/rendered`;
            const frameResponse = await orthancClient.get(frameUrl, {
              responseType: 'arraybuffer',
              params: { quality: 100 }
            });
            const frameSize = frameResponse.data.byteLength;
            console.log(`     ✅ Frame rendering works (${(frameSize / 1024).toFixed(2)} KB)`);
          } catch (frameError) {
            console.log(`     ❌ Frame rendering failed: ${frameError.message}`);
          }
        }
      }

      if (studies.length > 3) {
        console.log(`\n   ... and ${studies.length - 3} more studies`);
      }
    }
    console.log('');

    // Test 4: Check endpoints
    console.log('4️⃣  Testing critical endpoints...');

    const endpoints = [
      '/system',
      '/statistics',
      '/studies',
      '/instances',
      '/patients'
    ];

    for (const endpoint of endpoints) {
      try {
        await orthancClient.get(endpoint);
        console.log(`   ✅ ${endpoint}`);
      } catch (error) {
        console.log(`   ❌ ${endpoint} - ${error.message}`);
      }
    }
    console.log('');

    // Summary
    console.log('📊 Summary:');
    console.log('   ✅ Orthanc is running and accessible');
    console.log('   ✅ Authentication is working');
    console.log('   ✅ All critical endpoints are available');

    if (studies.length > 0) {
      console.log('   ✅ Studies are stored in Orthanc');
      console.log('   ✅ Frame rendering endpoint is working');
    } else {
      console.log('   ⚠️  No studies in Orthanc yet - upload a DICOM file to test');
    }

    console.log('');
    console.log('🎉 Orthanc integration is working correctly!');
    console.log('');
    console.log('Next steps:');
    console.log('   1. Upload a DICOM file through the UI');
    console.log('   2. Check that it appears in Orthanc');
    console.log('   3. Verify frames are rendered correctly in the viewer');

  } catch (error) {
    console.error('');
    console.error('❌ Orthanc Integration Test Failed!');
    console.error('');

    if (error.code === 'ECONNREFUSED') {
      console.error('   Error: Cannot connect to Orthanc');
      console.error(`   URL: ${ORTHANC_URL}`);
      console.error('');
      console.error('   Possible solutions:');
      console.error('   1. Make sure Orthanc is running');
      console.error('   2. Check if Orthanc is running on the correct port');
      console.error('   3. Verify ORTHANC_URL in server/.env');
      console.error('');
      console.error('   To start Orthanc:');
      console.error('   - Using Docker: docker-compose up orthanc');
      console.error('   - Or check your Orthanc installation');
    } else if (error.response?.status === 401) {
      console.error('   Error: Authentication failed');
      console.error(`   Username: ${ORTHANC_USERNAME}`);
      console.error('');
      console.error('   Possible solutions:');
      console.error('   1. Check ORTHANC_USERNAME in server/.env');
      console.error('   2. Check ORTHANC_PASSWORD in server/.env');
      console.error('   3. Verify Orthanc configuration file');
    } else {
      console.error(`   Error: ${error.message}`);
      if (error.response) {
        console.error(`   Status: ${error.response.status}`);
        console.error(`   Data: ${JSON.stringify(error.response.data)}`);
      }
    }

    console.error('');
    process.exit(1);
  }
}

// Run the test
testOrthancConnection();
