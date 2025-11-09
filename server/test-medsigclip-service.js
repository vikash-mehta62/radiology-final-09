#!/usr/bin/env node
/**
 * Test MedSigLIP Service
 * Run from server directory: node test-medsigclip-service.js
 */

require('dotenv').config();

console.log('🧪 Testing MedSigLIP Service\n');
console.log('='.repeat(60));

// Check environment
console.log('\n📋 Environment:');
console.log(`   HUGGINGFACE_API_KEY: ${process.env.HUGGINGFACE_API_KEY ? '✅ Set (hf_...)' : '❌ Not set'}`);
console.log(`   MEDSIGLIP_MODEL: ${process.env.MEDSIGLIP_MODEL || 'openai/clip-vit-base-patch32'}`);
console.log(`   MEDSIGLIP_GRID_SIZE: ${process.env.MEDSIGLIP_GRID_SIZE || '3'}`);
console.log(`   MEDSIGLIP_CONFIDENCE_THRESHOLD: ${process.env.MEDSIGLIP_CONFIDENCE_THRESHOLD || '0.15'}`);

if (!process.env.HUGGINGFACE_API_KEY) {
  console.log('\n❌ HUGGINGFACE_API_KEY not set!');
  console.log('   Add to .env file');
  process.exit(1);
}

// Load service
console.log('\n🔄 Loading MedSigLIP service...');
const medSigLIPService = require('./src/services/medSigLIPService');
console.log('✅ Service loaded');

// Test connection
console.log('\n🔌 Testing Hugging Face API...');
console.log('   (First request may take 20-30 seconds - model loading)');

const startTime = Date.now();

medSigLIPService.testConnection()
  .then(result => {
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    
    console.log(`\n📊 Test completed in ${duration}s`);
    console.log(JSON.stringify(result, null, 2));
    
    if (result.success) {
      console.log('\n✅ SUCCESS: MedSigLIP is working!');
      console.log(`   Model: ${result.model}`);
      console.log(`   Status: ${result.status}`);
      console.log('\n🎉 Ready to classify medical images!');
      console.log('\n💡 Next steps:');
      console.log('   1. Start backend: npm start');
      console.log('   2. Test API: curl http://3.144.196.75:8001/api/ai/test');
      console.log('   3. Use frontend to analyze images');
    } else {
      console.log('\n❌ FAILED: MedSigLIP connection failed');
      console.log(`   Error: ${result.error}`);
      console.log(`   Status: ${result.status || 'unknown'}`);
      
      if (result.status === 401) {
        console.log('\n🔧 Fix: Check HUGGINGFACE_API_KEY');
        console.log('   Get from: https://huggingface.co/settings/tokens');
      } else if (result.status === 503) {
        console.log('\n💡 Model is loading, wait 30s and retry');
      }
    }
    
    console.log('\n' + '='.repeat(60) + '\n');
  })
  .catch(error => {
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`\n❌ Error after ${duration}s:`);
    console.log(`   ${error.message}`);
    console.log('\n' + '='.repeat(60) + '\n');
    process.exit(1);
  });
