/**
 * Test if buffer upload works with raw axios
 */

const axios = require('axios');
const fs = require('fs');

async function testBufferUpload(filePath) {
  console.log('Testing buffer upload to Orthanc...\n');
  
  // Read file
  const buffer = fs.readFileSync(filePath);
  console.log(`File: ${filePath}`);
  console.log(`Size: ${buffer.length} bytes`);
  console.log(`First 4 bytes: ${buffer.slice(0, 4).toString('hex')}`);
  console.log(`Bytes 128-132: ${buffer.slice(128, 132).toString('hex')} ("${buffer.slice(128, 132).toString('ascii')}")`);
  
  try {
    console.log('\nUploading to Orthanc...');
    const response = await axios.post(
      'http://69.62.70.102:8042/instances',
      buffer,
      {
        auth: {
          username: 'orthanc',
          password: 'orthanc'
        },
        headers: {
          'Content-Type': 'application/dicom',
          'Content-Length': buffer.length
        },
        timeout: 60000,
        maxContentLength: Infinity,
        maxBodyLength: Infinity
      }
    );
    
    console.log('✅ SUCCESS!');
    console.log('Instance ID:', response.data.ID);
    console.log('Response:', JSON.stringify(response.data, null, 2));
    
  } catch (error) {
    console.error('❌ FAILED');
    console.error('Status:', error.response?.status);
    console.error('Status Text:', error.response?.statusText);
    console.error('Data:', error.response?.data);
    console.error('Message:', error.message);
  }
}

const filePath = process.argv[2] || './sample.dcm';
testBufferUpload(filePath);
