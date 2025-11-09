/**
 * Simple Hugging Face API test with proper image
 */

require('dotenv').config();
const axios = require('axios');
const sharp = require('sharp');

async function testHFSimple() {
  console.log('\n=== Simple Hugging Face Test ===\n');
  
  const apiKey = process.env.HUGGINGFACE_API_KEY;
  console.log('API Key:', apiKey ? apiKey.substring(0, 20) + '...' : 'NOT FOUND');
  
  if (!apiKey) {
    console.error('❌ No API key');
    return;
  }
  
  // Create a proper test image
  console.log('\nCreating test image...');
  const testImage = await sharp({
    create: {
      width: 224,
      height: 224,
      channels: 3,
      background: { r: 128, g: 128, b: 128 }
    }
  }).jpeg().toBuffer();
  
  console.log('Test image created:', testImage.length, 'bytes\n');
  
  // Test models with proper image format
  const models = [
    'Salesforce/blip-image-captioning-base',
    'nlpconnect/vit-gpt2-image-captioning',
    'microsoft/resnet-50'
  ];
  
  for (const model of models) {
    console.log(`Testing: ${model}`);
    
    try {
      const response = await axios.post(
        `https://api-inference.huggingface.co/models/${model}`,
        testImage,
        {
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'image/jpeg'
          },
          timeout: 20000
        }
      );
      
      console.log('✅ SUCCESS!');
      console.log('Response:', JSON.stringify(response.data).substring(0, 100));
      console.log('─'.repeat(50));
      return { success: true, model };
      
    } catch (error) {
      console.log('❌ Failed');
      console.log('Status:', error.response?.status);
      console.log('Error:', error.response?.data?.error || error.message);
      
      if (error.response?.status === 503) {
        console.log('💡 Model loading, waiting 5 seconds...');
        await new Promise(resolve => setTimeout(resolve, 5000));
        
        // Retry once
        try {
          const retryResponse = await axios.post(
            `https://api-inference.huggingface.co/models/${model}`,
            testImage,
            {
              headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'image/jpeg'
              },
              timeout: 20000
            }
          );
          
          console.log('✅ SUCCESS on retry!');
          console.log('Response:', JSON.stringify(retryResponse.data).substring(0, 100));
          console.log('─'.repeat(50));
          return { success: true, model };
          
        } catch (retryError) {
          console.log('❌ Retry also failed');
        }
      }
      
      console.log('─'.repeat(50));
    }
    
    console.log('');
  }
  
  console.log('\n❌ All models failed');
  console.log('\nYour Hugging Face key might be:');
  console.log('1. Invalid or expired');
  console.log('2. Missing "Read" permission');
  console.log('3. Rate limited\n');
}

testHFSimple();
