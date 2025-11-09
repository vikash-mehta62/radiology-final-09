/**
 * Simple test for Gemini Vision API
 */

require('dotenv').config();

async function testGemini() {
  console.log('\n=== Testing Gemini Vision API ===\n');
  
  const apiKey = process.env.GOOGLE_AI_API_KEY;
  
  if (!apiKey) {
    console.error('❌ GOOGLE_AI_API_KEY not found in .env');
    process.exit(1);
  }
  
  console.log('API Key:', apiKey.substring(0, 20) + '...');
  console.log('Testing connection...\n');
  
  try {
    const geminiService = require('./src/services/geminiVisionService');
    const result = await geminiService.testConnection();
    
    if (result.success) {
      console.log('✅ SUCCESS! Gemini API is working!');
      console.log('Model:', result.model);
      console.log('Status:', result.status);
      console.log('\n🎉 Your API key is valid and ready to use!');
      console.log('\nNext steps:');
      console.log('1. Start the server: npm start');
      console.log('2. Test with a medical image');
    } else {
      console.log('❌ FAILED');
      console.log('Error:', result.error);
      console.log('Status:', result.status);
      
      if (result.status === 400) {
        console.log('\n💡 Tip: API key might be invalid. Create a new one at:');
        console.log('   https://aistudio.google.com/app/apikey');
      } else if (result.status === 404) {
        console.log('\n💡 Tip: Model not found. The API endpoint might have changed.');
      }
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  }
}

testGemini();
