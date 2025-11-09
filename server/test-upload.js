const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const fs = require('fs');
const axios = require('axios');
const FormData = require('form-data');

async function testUpload() {
  // You need to provide a DICOM file path
  const dicomFilePath = process.argv[2];
  
  if (!dicomFilePath) {
    console.log('Usage: node test-upload.js <path-to-dicom-file>');
    console.log('\nExample: node test-upload.js C:\\path\\to\\file.dcm');
    process.exit(1);
  }
  
  if (!fs.existsSync(dicomFilePath)) {
    console.error(`❌ File not found: ${dicomFilePath}`);
    process.exit(1);
  }
  
  console.log(`\n📤 Testing upload of: ${dicomFilePath}\n`);
  
  try {
    const form = new FormData();
    form.append('file', fs.createReadStream(dicomFilePath));
    form.append('patientID', 'test');
    form.append('patientName', 'Test Patient');
    
    console.log('Uploading to http://3.144.196.75:8001/api/upload...\n');
    
    const response = await axios.post('http://3.144.196.75:8001/api/upload', form, {
      headers: form.getHeaders(),
      maxContentLength: Infinity,
      maxBodyLength: Infinity
    });
    
    console.log('✅ Upload successful!\n');
    console.log('Response:');
    console.log(JSON.stringify(response.data, null, 2));
    
  } catch (error) {
    console.error('❌ Upload failed!');
    
    if (error.response) {
      console.error(`Status: ${error.response.status}`);
      console.error(`Message: ${error.response.data.message || error.response.statusText}`);
      console.error('\nFull response:');
      console.error(JSON.stringify(error.response.data, null, 2));
    } else {
      console.error(`Error: ${error.message}`);
    }
    
    process.exit(1);
  }
}

testUpload();
