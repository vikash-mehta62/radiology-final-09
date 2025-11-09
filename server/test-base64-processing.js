#!/usr/bin/env node
/**
 * Test Base64 Image Processing
 * Tests the complete flow from base64 to local server
 */

require('dotenv').config();
const fs = require('fs');
const sharp = require('sharp');

console.log('🧪 Testing Base64 Image Processing\n');
console.log('='.repeat(60));

async function testBase64Processing() {
  try {
    // Step 1: Create a test image
    console.log('\n📸 Step 1: Creating test image...');
    const testImageBuffer = await sharp({
      create: {
        width: 512,
        height: 512,
        channels: 3,
        background: { r: 100, g: 150, b: 200 }
      }
    }).jpeg().toBuffer();
    
    console.log(`✅ Created test image: ${testImageBuffer.length} bytes`);
    
    // Step 2: Convert to base64 (simulating frontend)
    console.log('\n🔄 Step 2: Converting to base64...');
    const base64String = `data:image/jpeg;base64,${testImageBuffer.toString('base64')}`;
    console.log(`✅ Base64 string length: ${base64String.length} characters`);
    
    // Step 3: Convert back to buffer (simulating backend)
    console.log('\n🔄 Step 3: Converting back to buffer...');
    const base64Data = base64String.replace(/^data:image\/\w+;base64,/, '');
    const reconstructedBuffer = Buffer.from(base64Data, 'base64');
    console.log(`✅ Reconstructed buffer: ${reconstructedBuffer.length} bytes`);
    
    // Step 4: Verify buffers match
    console.log('\n✔️  Step 4: Verifying buffers match...');
    const buffersMatch = testImageBuffer.equals(reconstructedBuffer);
    
    if (buffersMatch) {
      console.log('✅ SUCCESS: Buffers match perfectly!');
    } else {
      console.log('❌ FAILED: Buffers do not match');
      console.log(`   Original: ${testImageBuffer.length} bytes`);
      console.log(`   Reconstructed: ${reconstructedBuffer.length} bytes`);
    }
    
    // Step 5: Test with MedSigLIP service
    console.log('\n🔬 Step 5: Testing with MedSigLIP service...');
    const medSigLIPService = require('./src/services/medSigLIPService');
    
    console.log('Service configuration:');
    console.log(`   Use Local: ${medSigLIPService.useLocal}`);
    console.log(`   Local URL: ${medSigLIPService.localUrl}`);
    
    // Test connection first
    console.log('\n🔌 Testing connection...');
    const connectionTest = await medSigLIPService.testConnection();
    
    if (connectionTest.success) {
      console.log('✅ Connection successful');
      console.log(`   Model: ${connectionTest.model}`);
      console.log(`   Model Loaded: ${connectionTest.modelLoaded}`);
      
      // Try detection
      console.log('\n🔍 Testing detection with buffer...');
      try {
        const result = await medSigLIPService.detectAbnormalities(reconstructedBuffer);
        console.log('✅ Detection successful!');
        console.log(`   Detections: ${result.detections.length}`);
        console.log(`   Regions processed: ${result.metadata.regionsProcessed}`);
      } catch (error) {
        console.log('❌ Detection failed:', error.message);
      }
      
    } else {
      console.log('❌ Connection failed:', connectionTest.error);
      console.log('   Message:', connectionTest.message);
    }
    
    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('📋 SUMMARY');
    console.log('='.repeat(60));
    
    if (buffersMatch) {
      console.log('✅ Base64 processing: WORKING');
    } else {
      console.log('❌ Base64 processing: FAILED');
    }
    
    if (connectionTest.success) {
      console.log('✅ MedSigLIP connection: WORKING');
    } else {
      console.log('❌ MedSigLIP connection: FAILED');
      console.log('\n💡 Start the server with:');
      console.log('   cd ai-detection-node');
      console.log('   python medsigclip_server.py');
    }
    
    console.log('\n' + '='.repeat(60) + '\n');
    
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run test
testBase64Processing();
