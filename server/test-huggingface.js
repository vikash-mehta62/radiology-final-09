/**
 * Test Hugging Face API key and find working models
 */

require('dotenv').config();
const axios = require('axios');

async function testHuggingFace() {
  console.log('\n=== Testing Hugging Face API ===\n');
  
  const apiKey = process.env.HUGGINGFACE_API_KEY;
  
  if (!apiKey) {
    console.error('❌ HUGGINGFACE_API_KEY not found in .env');
    process.exit(1);
  }
  
  console.log('API Key:', apiKey.substring(0, 20) + '...');
  console.log('\nTesting different models...\n');
  
  // Test different models that should work
  const modelsToTest = [
    {
      name: 'BLIP Image Captioning',
      model: 'Salesforce/blip-image-captioning-base',
      type: 'image-to-text'
    },
    {
      name: 'CLIP (OpenAI)',
      model: 'openai/clip-vit-base-patch32',
      type: 'zero-shot-image-classification'
    },
    {
      name: 'ViT Image Classification',
      model: 'google/vit-base-patch16-224',
      type: 'image-classification'
    },
    {
      name: 'DETR Object Detection',
      model: 'facebook/detr-resnet-50',
      type: 'object-detection'
    }
  ];
  
  const workingModels = [];
  
  for (const modelInfo of modelsToTest) {
    console.log(`Testing: ${modelInfo.name}`);
    console.log(`Model: ${modelInfo.model}`);
    console.log(`Type: ${modelInfo.type}`);
    
    try {
      // Create a simple test image (1x1 pixel)
      const testImageBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
      const testImageBuffer = Buffer.from(testImageBase64, 'base64');
      
      const response = await axios.post(
        `https://api-inference.huggingface.co/models/${modelInfo.model}`,
        testImageBuffer,
        {
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/octet-stream'
          },
          timeout: 15000
        }
      );
      
      console.log('✅ SUCCESS! This model works!');
      console.log('Status:', response.status);
      console.log('Response type:', typeof response.data);
      console.log('─'.repeat(50));
      
      workingModels.push(modelInfo);
      
    } catch (error) {
      console.log('❌ Failed');
      console.log('Status:', error.response?.status || 'No response');
      console.log('Error:', error.response?.data?.error || error.message);
      
      if (error.response?.status === 503) {
        console.log('💡 Model is loading, might work after retry');
      } else if (error.response?.status === 403) {
        console.log('💡 Access denied - API key might be invalid');
      } else if (error.response?.status === 404) {
        console.log('💡 Model not found');
      }
      console.log('─'.repeat(50));
    }
    
    console.log('');
  }
  
  // Summary
  console.log('\n╔════════════════════════════════════════════════════════╗');
  console.log('║   Test Summary                                         ║');
  console.log('╚════════════════════════════════════════════════════════╝\n');
  
  if (workingModels.length > 0) {
    console.log(`✅ Found ${workingModels.length} working model(s):\n`);
    workingModels.forEach((model, idx) => {
      console.log(`${idx + 1}. ${model.name}`);
      console.log(`   Model: ${model.model}`);
      console.log(`   Type: ${model.type}\n`);
    });
    
    console.log('🎉 Your Hugging Face API key is valid!\n');
    console.log('Recommended model for medical imaging:');
    console.log(`   ${workingModels[0].model}\n`);
    
  } else {
    console.log('❌ No working models found.\n');
    console.log('Possible issues:');
    console.log('1. API key is invalid or expired');
    console.log('2. API key doesn\'t have correct permissions');
    console.log('3. Network/firewall blocking requests\n');
    console.log('Solution: Create a new token at:');
    console.log('   https://huggingface.co/settings/tokens\n');
  }
}

testHuggingFace().catch(error => {
  console.error('\n❌ Test failed:', error.message);
  process.exit(1);
});
