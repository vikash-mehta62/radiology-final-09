/**
 * Test script for MedSigLIP and MedGemma services
 * Run with: node test-ai-services.js
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');

// Test configuration
const TEST_IMAGE_PATH = process.argv[2] || './test-image.jpg';

async function testMedSigLIP() {
  console.log('\n=== Testing MedSigLIP Service ===\n');
  
  try {
    const medSigLIPService = require('./src/services/medSigLIPService');
    
    // Test connection
    console.log('1. Testing API connection...');
    const connectionTest = await medSigLIPService.testConnection();
    console.log('Connection test result:', connectionTest);
    
    if (!connectionTest.success) {
      console.error('❌ Connection failed. Check your HUGGINGFACE_API_KEY in .env');
      return false;
    }
    
    console.log('✅ Connection successful\n');
    
    // Test detection (if test image exists)
    if (fs.existsSync(TEST_IMAGE_PATH)) {
      console.log('2. Testing detection with image:', TEST_IMAGE_PATH);
      const imageBuffer = fs.readFileSync(TEST_IMAGE_PATH);
      
      console.log('Running detection... (this may take 10-20 seconds)');
      const result = await medSigLIPService.detectAbnormalities(imageBuffer);
      
      console.log('\n✅ Detection complete!');
      console.log('Detections found:', result.detections.length);
      console.log('Metadata:', result.metadata);
      
      if (result.detections.length > 0) {
        console.log('\nDetected abnormalities:');
        result.detections.forEach((det, idx) => {
          console.log(`  ${idx + 1}. ${det.label} - ${(det.confidence * 100).toFixed(1)}% confidence`);
          console.log(`     Location: (${det.x}, ${det.y}) Size: ${det.width}x${det.height}`);
        });
      } else {
        console.log('No abnormalities detected (image appears normal)');
      }
    } else {
      console.log('2. Skipping detection test (no test image found)');
      console.log(`   To test detection, provide an image: node test-ai-services.js path/to/image.jpg`);
    }
    
    return true;
    
  } catch (error) {
    console.error('❌ MedSigLIP test failed:', error.message);
    return false;
  }
}

async function testMedGemma() {
  console.log('\n=== Testing MedGemma Service ===\n');
  
  try {
    const medGemmaService = require('./src/services/medGemmaService');
    
    // Test connection
    console.log('1. Testing API connection...');
    const connectionTest = await medGemmaService.testConnection();
    console.log('Connection test result:', connectionTest);
    
    if (!connectionTest.success) {
      console.error('❌ Connection failed. Check your GOOGLE_AI_API_KEY in .env');
      return false;
    }
    
    console.log('✅ Connection successful\n');
    
    // Test report generation (if test image exists)
    if (fs.existsSync(TEST_IMAGE_PATH)) {
      console.log('2. Testing report generation with image:', TEST_IMAGE_PATH);
      const imageBuffer = fs.readFileSync(TEST_IMAGE_PATH);
      
      const mockDetections = [
        {
          x: 100,
          y: 200,
          width: 150,
          height: 150,
          label: 'pneumonia',
          confidence: 0.85
        }
      ];
      
      console.log('Generating report... (this may take 5-15 seconds)');
      const result = await medGemmaService.generateReport(imageBuffer, mockDetections);
      
      console.log('\n✅ Report generated!');
      console.log('Report length:', result.report.length, 'characters');
      console.log('\n--- GENERATED REPORT ---');
      console.log(result.report);
      console.log('--- END OF REPORT ---\n');
    } else {
      console.log('2. Skipping report generation test (no test image found)');
      console.log(`   To test report generation, provide an image: node test-ai-services.js path/to/image.jpg`);
    }
    
    return true;
    
  } catch (error) {
    console.error('❌ MedGemma test failed:', error.message);
    return false;
  }
}

async function runTests() {
  console.log('╔════════════════════════════════════════════════════════╗');
  console.log('║   AI Services Test Suite                              ║');
  console.log('║   MedSigLIP Detection + MedGemma Reporting            ║');
  console.log('╚════════════════════════════════════════════════════════╝');
  
  // Check environment variables
  console.log('\nEnvironment Configuration:');
  console.log('  HUGGINGFACE_API_KEY:', process.env.HUGGINGFACE_API_KEY ? '✓ Set' : '✗ Missing');
  console.log('  GOOGLE_AI_API_KEY:', process.env.GOOGLE_AI_API_KEY ? '✓ Set' : '✗ Missing');
  console.log('  MEDSIGLIP_MODEL:', process.env.MEDSIGLIP_MODEL || 'flaviagiammarino/pubmed-clip-vit-base-patch32');
  console.log('  MEDGEMMA_MODEL:', process.env.MEDGEMMA_MODEL || 'gemini-1.5-flash');
  console.log('  Grid Size:', process.env.MEDSIGLIP_GRID_SIZE || '3');
  
  if (!process.env.HUGGINGFACE_API_KEY || !process.env.GOOGLE_AI_API_KEY) {
    console.error('\n❌ Missing API keys! Please set them in server/.env file');
    process.exit(1);
  }
  
  // Run tests
  const medSigLIPSuccess = await testMedSigLIP();
  const medGemmaSuccess = await testMedGemma();
  
  // Summary
  console.log('\n╔════════════════════════════════════════════════════════╗');
  console.log('║   Test Summary                                         ║');
  console.log('╚════════════════════════════════════════════════════════╝');
  console.log('  MedSigLIP:', medSigLIPSuccess ? '✅ PASSED' : '❌ FAILED');
  console.log('  MedGemma:', medGemmaSuccess ? '✅ PASSED' : '❌ FAILED');
  
  if (medSigLIPSuccess && medGemmaSuccess) {
    console.log('\n🎉 All tests passed! Your AI services are ready to use.');
    console.log('\nNext steps:');
    console.log('  1. Start the server: npm start');
    console.log('  2. Open the viewer and navigate to AI Analysis page');
    console.log('  3. Upload a medical image and test the complete workflow');
  } else {
    console.log('\n⚠️  Some tests failed. Please check the errors above.');
    process.exit(1);
  }
}

// Run tests
runTests().catch(error => {
  console.error('\n❌ Test suite failed:', error);
  process.exit(1);
});
