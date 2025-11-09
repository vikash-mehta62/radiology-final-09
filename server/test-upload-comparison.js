/**
 * Test Upload Comparison
 * Compare direct Orthanc upload vs app upload
 */

const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');

const ORTHANC_URL = 'http://69.62.70.102:8042';
const APP_URL = 'http://3.144.196.75:8001';
const ORTHANC_USER = 'orthanc';
const ORTHANC_PASS = 'orthanc';

async function testDirectOrthancUpload(filePath) {
  console.log('\n' + '='.repeat(60));
  console.log('TEST 1: Direct Orthanc Upload');
  console.log('='.repeat(60));
  
  try {
    const fileBuffer = fs.readFileSync(filePath);
    console.log(`File size: ${fileBuffer.length} bytes`);
    console.log(`First 4 bytes: ${fileBuffer.slice(0, 4).toString('hex')}`);
    console.log(`Bytes 128-132: "${fileBuffer.slice(128, 132).toString('ascii')}"`);
    
    const response = await axios.post(
      `${ORTHANC_URL}/instances`,
      fileBuffer,
      {
        auth: {
          username: ORTHANC_USER,
          password: ORTHANC_PASS
        },
        headers: {
          'Content-Type': 'application/dicom',
          'Content-Length': fileBuffer.length
        },
        maxContentLength: Infinity,
        maxBodyLength: Infinity
      }
    );
    
    console.log('✅ SUCCESS');
    console.log(`Instance ID: ${response.data.ID}`);
    return response.data.ID;
  } catch (error) {
    console.error('❌ FAILED');
    console.error(`Status: ${error.response?.status}`);
    console.error(`Data: ${JSON.stringify(error.response?.data)}`);
    throw error;
  }
}

async function testAppUpload(filePath, token) {
  console.log('\n' + '='.repeat(60));
  console.log('TEST 2: App Upload (via Node.js backend)');
  console.log('='.repeat(60));
  
  try {
    const formData = new FormData();
    formData.append('file', fs.createReadStream(filePath));
    formData.append('patientID', 'TEST_PATIENT');
    formData.append('patientName', 'Test Patient');
    
    console.log('FormData fields:', formData.getHeaders());
    
    const response = await axios.post(
      `${APP_URL}/api/dicom/upload`,
      formData,
      {
        headers: {
          ...formData.getHeaders(),
          ...(token && { 'Authorization': `Bearer ${token}` })
        },
        maxContentLength: Infinity,
        maxBodyLength: Infinity
      }
    );
    
    console.log('✅ SUCCESS');
    console.log(`Study UID: ${response.data.data?.studyInstanceUID}`);
    console.log(`Instance ID: ${response.data.data?.orthancInstanceId}`);
    return response.data;
  } catch (error) {
    console.error('❌ FAILED');
    console.error(`Status: ${error.response?.status}`);
    console.error(`Message: ${error.response?.data?.message}`);
    console.error(`Error: ${error.response?.data?.error}`);
    console.error(`Hint: ${error.response?.data?.hint}`);
    console.error(`Full response:`, JSON.stringify(error.response?.data, null, 2));
    throw error;
  }
}

async function compareUploads(filePath, token) {
  console.log('\n🔬 DICOM Upload Comparison Test');
  console.log(`File: ${filePath}`);
  console.log(`Orthanc: ${ORTHANC_URL}`);
  console.log(`App: ${APP_URL}`);
  
  try {
    // Test 1: Direct Orthanc
    const orthancInstanceId = await testDirectOrthancUpload(filePath);
    
    // Clean up
    console.log('\nCleaning up test instance...');
    await axios.delete(
      `${ORTHANC_URL}/instances/${orthancInstanceId}`,
      {
        auth: {
          username: ORTHANC_USER,
          password: ORTHANC_PASS
        }
      }
    );
    console.log('✅ Cleaned up');
    
    // Test 2: App Upload
    await testAppUpload(filePath, token);
    
    console.log('\n' + '='.repeat(60));
    console.log('✅ ALL TESTS PASSED');
    console.log('='.repeat(60));
    
  } catch (error) {
    console.log('\n' + '='.repeat(60));
    console.log('❌ TEST FAILED');
    console.log('='.repeat(60));
    process.exit(1);
  }
}

// Get arguments
const filePath = process.argv[2];
const token = process.argv[3];

if (!filePath) {
  console.log('Usage: node test-upload-comparison.js <dicom-file> [auth-token]');
  console.log('\nExample:');
  console.log('  node test-upload-comparison.js ./sample.dcm');
  console.log('  node test-upload-comparison.js ./sample.dcm eyJhbGc...');
  process.exit(1);
}

if (!fs.existsSync(filePath)) {
  console.error(`File not found: ${filePath}`);
  process.exit(1);
}

compareUploads(filePath, token);
