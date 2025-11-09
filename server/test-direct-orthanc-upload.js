/**
 * Test Direct Orthanc Upload
 * This script tests uploading a DICOM file directly to Orthanc
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');

// Orthanc configuration
const ORTHANC_URL = process.env.ORTHANC_URL || 'http://69.62.70.102:8042';
const ORTHANC_USERNAME = process.env.ORTHANC_USERNAME || 'orthanc';
const ORTHANC_PASSWORD = process.env.ORTHANC_PASSWORD || 'orthanc';

async function testOrthancUpload(filePath) {
  try {
    console.log('='.repeat(60));
    console.log('Testing Direct Orthanc Upload');
    console.log('='.repeat(60));
    
    // Check if file exists
    if (!fs.existsSync(filePath)) {
      console.error(`❌ File not found: ${filePath}`);
      console.log('\nPlease provide a valid DICOM file path as argument:');
      console.log('  node test-direct-orthanc-upload.js /path/to/file.dcm');
      process.exit(1);
    }

    // Read file
    console.log(`\n📁 Reading file: ${filePath}`);
    const fileBuffer = fs.readFileSync(filePath);
    const fileSizeMB = (fileBuffer.length / (1024 * 1024)).toFixed(2);
    console.log(`   Size: ${fileBuffer.length} bytes (${fileSizeMB} MB)`);

    // Validate DICOM format
    if (fileBuffer.length < 132) {
      console.error('❌ File too small to be a valid DICOM file');
      process.exit(1);
    }

    const dicmMarker = fileBuffer.toString('ascii', 128, 132);
    if (dicmMarker !== 'DICM') {
      console.warn(`⚠️  Warning: No DICM marker found at byte 128`);
      console.warn(`   Found: "${dicmMarker}" (hex: ${fileBuffer.slice(128, 132).toString('hex')})`);
      console.warn('   File may not be a valid DICOM file');
    } else {
      console.log('✅ DICM marker validated');
    }

    // Test Orthanc connection
    console.log(`\n🔌 Testing connection to Orthanc...`);
    console.log(`   URL: ${ORTHANC_URL}`);
    
    try {
      const systemResponse = await axios.get(`${ORTHANC_URL}/system`, {
        auth: {
          username: ORTHANC_USERNAME,
          password: ORTHANC_PASSWORD
        }
      });
      console.log('✅ Connected to Orthanc');
      console.log(`   Version: ${systemResponse.data.Version}`);
      console.log(`   Name: ${systemResponse.data.Name}`);
    } catch (error) {
      console.error('❌ Cannot connect to Orthanc');
      console.error(`   Error: ${error.message}`);
      if (error.code === 'ECONNREFUSED') {
        console.error(`   Make sure Orthanc is running at ${ORTHANC_URL}`);
      }
      process.exit(1);
    }

    // Upload to Orthanc
    console.log(`\n📤 Uploading to Orthanc...`);
    console.log(`   Endpoint: ${ORTHANC_URL}/instances`);
    console.log(`   Content-Type: application/dicom`);
    console.log(`   Content-Length: ${fileBuffer.length}`);
    
    const uploadResponse = await axios.post(
      `${ORTHANC_URL}/instances`,
      fileBuffer,
      {
        auth: {
          username: ORTHANC_USERNAME,
          password: ORTHANC_PASSWORD
        },
        headers: {
          'Content-Type': 'application/dicom',
          'Content-Length': fileBuffer.length
        },
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
        timeout: 60000
      }
    );

    console.log('✅ Upload successful!');
    console.log('\n📊 Upload Response:');
    console.log(`   Instance ID: ${uploadResponse.data.ID}`);
    console.log(`   Parent Study: ${uploadResponse.data.ParentStudy}`);
    console.log(`   Parent Series: ${uploadResponse.data.ParentSeries}`);
    console.log(`   Parent Patient: ${uploadResponse.data.ParentPatient}`);
    console.log(`   Status: ${uploadResponse.data.Status}`);

    // Get instance metadata
    console.log(`\n📋 Fetching instance metadata...`);
    const metadataResponse = await axios.get(
      `${ORTHANC_URL}/instances/${uploadResponse.data.ID}/simplified-tags`,
      {
        auth: {
          username: ORTHANC_USERNAME,
          password: ORTHANC_PASSWORD
        }
      }
    );

    console.log('✅ Metadata retrieved:');
    console.log(`   Patient ID: ${metadataResponse.data.PatientID}`);
    console.log(`   Patient Name: ${metadataResponse.data.PatientName}`);
    console.log(`   Study UID: ${metadataResponse.data.StudyInstanceUID}`);
    console.log(`   Series UID: ${metadataResponse.data.SeriesInstanceUID}`);
    console.log(`   SOP UID: ${metadataResponse.data.SOPInstanceUID}`);
    console.log(`   Modality: ${metadataResponse.data.Modality}`);
    console.log(`   Study Date: ${metadataResponse.data.StudyDate}`);

    // Try to get preview
    console.log(`\n🖼️  Testing image preview...`);
    try {
      const previewResponse = await axios.get(
        `${ORTHANC_URL}/instances/${uploadResponse.data.ID}/preview`,
        {
          auth: {
            username: ORTHANC_USERNAME,
            password: ORTHANC_PASSWORD
          },
          responseType: 'arraybuffer'
        }
      );
      console.log(`✅ Preview available (${previewResponse.data.length} bytes)`);
    } catch (previewError) {
      if (previewError.response?.status === 415) {
        console.warn('⚠️  Preview not available (codec not supported)');
        console.warn('   This is expected for some DICOM transfer syntaxes');
        console.warn('   Install GDCM plugin or use orthanc-plugins image');
      } else {
        console.warn(`⚠️  Preview error: ${previewError.message}`);
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log('✅ TEST PASSED - Upload successful!');
    console.log('='.repeat(60));

  } catch (error) {
    console.error('\n' + '='.repeat(60));
    console.error('❌ TEST FAILED');
    console.error('='.repeat(60));
    console.error('\nError Details:');
    console.error(`   Message: ${error.message}`);
    console.error(`   Code: ${error.code}`);
    
    if (error.response) {
      console.error(`   HTTP Status: ${error.response.status}`);
      console.error(`   Status Text: ${error.response.statusText}`);
      console.error(`   Response Data:`, error.response.data);
    }
    
    console.error('\nStack Trace:');
    console.error(error.stack);
    
    process.exit(1);
  }
}

// Get file path from command line argument
const filePath = process.argv[2];

if (!filePath) {
  console.log('Usage: node test-direct-orthanc-upload.js <path-to-dicom-file>');
  console.log('\nExample:');
  console.log('  node test-direct-orthanc-upload.js ./sample.dcm');
  process.exit(1);
}

testOrthancUpload(filePath);
