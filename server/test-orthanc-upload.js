const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const fs = require('fs');
const { getUnifiedOrthancService } = require('./src/services/unified-orthanc-service');

async function testOrthancUpload() {
  const dicomFile = process.argv[2];
  
  if (!dicomFile) {
    console.log('Usage: node test-orthanc-upload.js <path-to-dicom-file>');
    process.exit(1);
  }
  
  if (!fs.existsSync(dicomFile)) {
    console.error(`File not found: ${dicomFile}`);
    process.exit(1);
  }
  
  console.log(`\n🧪 Testing Orthanc upload\n`);
  console.log(`File: ${dicomFile}`);
  
  const buffer = fs.readFileSync(dicomFile);
  console.log(`Size: ${buffer.length} bytes\n`);
  
  const orthancService = getUnifiedOrthancService();
  
  // Test connection first
  console.log('1️⃣  Testing Orthanc connection...');
  const connTest = await orthancService.testConnection();
  console.log(`   ${connTest.connected ? '✅' : '❌'} ${connTest.connected ? 'Connected' : 'Failed'}`);
  if (connTest.connected) {
    console.log(`   Version: ${connTest.version}`);
  } else {
    console.log(`   Error: ${connTest.error}`);
    process.exit(1);
  }
  
  // Try upload
  console.log('\n2️⃣  Uploading DICOM file...');
  try {
    const result = await orthancService.uploadDicomFile(buffer);
    console.log('   ✅ Upload successful!');
    console.log(`   Instance ID: ${result.ID}`);
    console.log(`   Study ID: ${result.ParentStudy}`);
    console.log(`   Series ID: ${result.ParentSeries}`);
    console.log(`   Patient ID: ${result.ParentPatient}`);
    
    // Get frame count
    console.log('\n3️⃣  Getting frame count...');
    const frameCount = await orthancService.getFrameCount(result.ID);
    console.log(`   ✅ Frame count: ${frameCount}`);
    
    console.log('\n✅ All tests passed!\n');
    
  } catch (error) {
    console.error('   ❌ Upload failed!');
    console.error(`   Error: ${error.message}`);
    if (error.response) {
      console.error(`   Status: ${error.response.status}`);
      console.error(`   Data:`, error.response.data);
    }
    console.error(`   Stack:`, error.stack);
    process.exit(1);
  }
}

testOrthancUpload();
