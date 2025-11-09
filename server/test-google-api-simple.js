/**
 * Ultra-simple Google AI API test
 */

require('dotenv').config();
const axios = require('axios');

async function testGoogleAPI() {
  const apiKey = process.env.GOOGLE_AI_API_KEY;
  
  console.log('\n=== Simple Google AI API Test ===\n');
  console.log('API Key:', apiKey ? apiKey.substring(0, 20) + '...' : 'NOT FOUND');
  
  if (!apiKey) {
    console.error('❌ No API key found');
    return;
  }
  
  // Try different endpoints
  const endpoints = [
    {
      name: 'Gemini Pro (v1)',
      url: `https://generativelanguage.googleapis.com/v1/models/gemini-pro:generateContent?key=${apiKey}`,
      data: {
        contents: [{ parts: [{ text: 'Say hello' }] }]
      }
    },
    {
      name: 'Gemini Pro (v1beta)',
      url: `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${apiKey}`,
      data: {
        contents: [{ parts: [{ text: 'Say hello' }] }]
      }
    },
    {
      name: 'List Models (v1)',
      url: `https://generativelanguage.googleapis.com/v1/models?key=${apiKey}`,
      method: 'GET'
    }
  ];
  
  for (const endpoint of endpoints) {
    console.log(`\nTesting: ${endpoint.name}`);
    console.log(`URL: ${endpoint.url.split('?')[0]}`);
    
    try {
      let response;
      if (endpoint.method === 'GET') {
        response = await axios.get(endpoint.url, { timeout: 10000 });
      } else {
        response = await axios.post(endpoint.url, endpoint.data, {
          headers: { 'Content-Type': 'application/json' },
          timeout: 10000
        });
      }
      
      console.log('✅ SUCCESS!');
      console.log('Status:', response.status);
      
      if (endpoint.method === 'GET') {
        console.log('Available models:', response.data.models?.length || 0);
        if (response.data.models) {
          response.data.models.slice(0, 5).forEach(model => {
            console.log(`  - ${model.name}`);
          });
        }
      } else {
        console.log('Response:', response.data.candidates?.[0]?.content?.parts?.[0]?.text || 'OK');
      }
      
      console.log('\n🎉 This endpoint works! Use this configuration.');
      break;
      
    } catch (error) {
      console.log('❌ Failed');
      console.log('Status:', error.response?.status || 'No response');
      console.log('Error:', error.response?.data?.error?.message || error.message);
    }
  }
  
  console.log('\n=== Test Complete ===\n');
}

testGoogleAPI();
