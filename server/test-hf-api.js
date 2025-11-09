#!/usr/bin/env node
/**
 * Test Hugging Face API directly
 */

require('dotenv').config();
const axios = require('axios');
const sharp = require('sharp');

const API_KEY = process.env.HUGGINGFACE_API_KEY;

console.log('🧪 Testing Hugging Face API\n');
console.log('API Key:', API_KEY ? '✅ Set' : '❌ Not set');

if (!API_KEY) {
  console.log('❌ No API key');
  process.exit(1);
}

async function testModel(modelName, description) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Testing: ${description}`);
  console.log(`Model: ${modelName}`);
  console.log('='.repeat(60));
  
  try {
    // Create test image
    const testImage = await sharp({
      create: {
        width: 224,
        height: 224,
        channels: 3,
        background: { r: 128, g: 128, b: 128 }
      }
    }).jpeg().toBuffer();
    
    const url = `https://api-inference.huggingface.co/models/${modelName}`;
    
    console.log(`Sending request to: ${url}`);
    
    const response = await axios.post(
      url,
      testImage,
      {
        headers: {
          'Authorization': `Bearer ${API_KEY}`
        },
        params: {
          candidate_labels: 'normal,abnormal,disease'
        },
        timeout: 30000
      }
    );
    
    console.log('✅ SUCCESS');
    console.log('Response:', JSON.stringify(response.data, null, 2));
    return true;
    
  } catch (error) {
    console.log('❌ FAILED');
    console.log('Status:', error.response?.status || 'No response');
    console.log('Error:', error.response?.data || error.message);
    return false;
  }
}

async function runTests() {
  const models = [
    ['openai/clip-vit-large-patch14', 'CLIP Large'],
    ['openai/clip-vit-base-patch32', 'CLIP Base'],
    ['microsoft/resnet-50', 'ResNet-50'],
    ['google/vit-base-patch16-224', 'ViT Base']
  ];
  
  for (const [model, desc] of models) {
    await testModel(model, desc);
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('Tests complete');
  console.log('='.repeat(60));
}

runTests();
