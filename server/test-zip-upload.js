#!/usr/bin/env node

/**
 * Test ZIP Upload Script
 * 
 * This script tests uploading a ZIP file to the DICOM server.
 * Usage: node test-zip-upload.js <path-to-zip-file>
 */

const fs = require('fs');
const path = require('path');
const FormData = require('form-data');
const axios = require('axios');

// ANSI colors
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSection(title) {
  console.log('');
  log('═'.repeat(60), 'cyan');
  log(` ${title}`, 'bright');
  log('═'.repeat(60), 'cyan');
}

async function testZipUpload(zipFilePath) {
  logSection('ZIP Upload Test');
  
  // Step 1: Check if file exists
  log('\n1. Checking ZIP file...', 'blue');
  
  if (!zipFilePath) {
    log('   ❌ No file path provided', 'red');
    log('   Usage: node test-zip-upload.js <path-to-zip-file>', 'yellow');
    log('   Example: node test-zip-upload.js dicomnew.zip', 'yellow');
    process.exit(1);
  }
  
  const fullPath = path.resolve(zipFilePath);
  
  if (!fs.existsSync(fullPath)) {
    log(`   ❌ File not found: ${fullPath}`, 'red');
    log('   Please check the file path and try again', 'yellow');
    process.exit(1);
  }
  
  const stats = fs.statSync(fullPath);
  const fileSizeMB = (stats.size / 1024 / 1024).toFixed(2);
  
  log(`   ✓ File found: ${path.basename(fullPath)}`, 'green');
  log(`   ✓ File size: ${fileSizeMB} MB`, 'green');
  log(`   ✓ Full path: ${fullPath}`, 'green');
  
  // Step 2: Verify it's a ZIP file
  log('\n2. Verifying file format...', 'blue');
  
  const buffer = fs.readFileSync(fullPath);
  const signature = buffer.toString('hex', 0, 4);
  
  if (signature === '504b0304' || signature === '504b0506') {
    log(`   ✓ Valid ZIP signature: ${signature}`, 'green');
  } else if (signature === '52617221') {
    log(`   ❌ This is a RAR file, not a ZIP file!`, 'red');
    log('   Please convert to ZIP format first', 'yellow');
    process.exit(1);
  } else {
    log(`   ⚠ Unknown signature: ${signature}`, 'yellow');
    log('   Proceeding anyway...', 'yellow');
  }
  
  // Step 3: Check server availability
  log('\n3. Checking server availability...', 'blue');
  
  const serverUrl = process.env.SERVER_URL || 'http://localhost:8001';
  
  try {
    const healthCheck = await axios.get(`${serverUrl}/health`, { timeout: 5000 });
    log(`   ✓ Server is running at ${serverUrl}`, 'green');
  } catch (error) {
    log(`   ❌ Server not reachable at ${serverUrl}`, 'red');
    log('   Please ensure the server is running:', 'yellow');
    log('   cd node-server && npm start', 'cyan');
    process.exit(1);
  }
  
  // Step 4: Upload the file
  logSection('4. Uploading ZIP file');
  
  const uploadUrl = `${serverUrl}/api/dicom/upload/zip`;
  log(`   Upload URL: ${uploadUrl}`, 'cyan');
  log(`   Uploading...`, 'blue');
  
  const formData = new FormData();
  formData.append('file', fs.createReadStream(fullPath), {
    filename: path.basename(fullPath),
    contentType: 'application/zip'
  });
  
  const startTime = Date.now();
  
  try {
    const response = await axios.post(uploadUrl, formData, {
      headers: {
        ...formData.getHeaders()
      },
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
      timeout: 300000 // 5 minutes
    });
    
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    
    logSection('✅ Upload Successful!');
    
    log(`\n   Upload time: ${duration} seconds`, 'green');
    log(`   Status: ${response.status} ${response.statusText}`, 'green');
    
    if (response.data) {
      const data = response.data;
      
      log('\n   Study Information:', 'cyan');
      log(`   - Study UID: ${data.data?.studyInstanceUID || 'N/A'}`, 'cyan');
      log(`   - Description: ${data.data?.studyDescription || 'N/A'}`, 'cyan');
      log(`   - Total Series: ${data.data?.totalSeries || 0}`, 'cyan');
      log(`   - Total Instances: ${data.data?.totalInstances || 0}`, 'cyan');
      log(`   - Total Frames: ${data.data?.totalFrames || 0}`, 'cyan');
      
      if (data.data?.series && data.data.series.length > 0) {
        log('\n   Series Details:', 'cyan');
        data.data.series.forEach((series, index) => {
          log(`   ${index + 1}. ${series.seriesDescription || 'Unnamed Series'}`, 'cyan');
          log(`      - Series UID: ${series.seriesInstanceUID}`, 'cyan');
          log(`      - Modality: ${series.modality}`, 'cyan');
          log(`      - Instances: ${series.instanceCount}`, 'cyan');
        });
      }
      
      if (data.data?.viewingInfo) {
        log('\n   Viewing Information:', 'cyan');
        log(`   - Study URL: ${serverUrl}${data.data.viewingInfo.studyUrl}`, 'cyan');
        log(`   - Total Frames: ${data.data.viewingInfo.totalFrames}`, 'cyan');
        log(`   - Can View Immediately: ${data.data.viewingInfo.canViewImmediately ? 'Yes' : 'No'}`, 'cyan');
        log(`   - Supports 3D: ${data.data.viewingInfo.supports3D ? 'Yes' : 'No'}`, 'cyan');
      }
      
      log('\n   Next Steps:', 'yellow');
      log(`   1. Open viewer: http://localhost:3000`, 'cyan');
      log(`   2. Navigate to the uploaded study`, 'cyan');
      log(`   3. View in 2D or 3D mode`, 'cyan');
    }
    
    log('\n   Full Response:', 'blue');
    console.log(JSON.stringify(response.data, null, 2));
    
    process.exit(0);
    
  } catch (error) {
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    
    logSection('❌ Upload Failed');
    
    log(`\n   Upload time: ${duration} seconds`, 'red');
    
    if (error.response) {
      log(`   Status: ${error.response.status} ${error.response.statusText}`, 'red');
      log('\n   Error Response:', 'red');
      console.log(JSON.stringify(error.response.data, null, 2));
      
      if (error.response.data?.error) {
        log('\n   Error Details:', 'yellow');
        log(`   ${error.response.data.error}`, 'yellow');
        
        if (error.response.data.hint) {
          log(`\n   Hint: ${error.response.data.hint}`, 'cyan');
        }
        
        // Provide specific troubleshooting
        const errorMsg = error.response.data.error.toLowerCase();
        
        if (errorMsg.includes('rar')) {
          log('\n   Troubleshooting:', 'yellow');
          log('   - This is a RAR file, not a ZIP file', 'cyan');
          log('   - Extract the RAR file and create a new ZIP', 'cyan');
          log('   - See CONVERT-RAR-TO-ZIP.md for instructions', 'cyan');
        } else if (errorMsg.includes('no dicom files')) {
          log('\n   Troubleshooting:', 'yellow');
          log('   - ZIP does not contain DICOM files', 'cyan');
          log('   - Ensure files have .dcm extension', 'cyan');
          log('   - Check ZIP contents', 'cyan');
        } else if (errorMsg.includes('mongodb')) {
          log('\n   Troubleshooting:', 'yellow');
          log('   - MongoDB connection issue', 'cyan');
          log('   - Files are saved to filesystem', 'cyan');
          log('   - Run: node test-mongodb-connection.js', 'cyan');
        }
      }
    } else if (error.request) {
      log('   ❌ No response from server', 'red');
      log('   - Server may be down', 'yellow');
      log('   - Check if server is running: cd node-server && npm start', 'yellow');
    } else {
      log(`   ❌ Error: ${error.message}`, 'red');
    }
    
    process.exit(1);
  }
}

// Get file path from command line
const zipFilePath = process.argv[2];

// Run the test
testZipUpload(zipFilePath).catch(error => {
  log('\n❌ Unexpected error:', 'red');
  console.error(error);
  process.exit(1);
});
