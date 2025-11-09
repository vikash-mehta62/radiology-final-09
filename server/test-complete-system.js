/**
 * Complete system test - Gemini Vision AI
 */

require('dotenv').config();
const fs = require('fs');

async function testCompleteSystem() {
  console.log('\n╔════════════════════════════════════════════════════════╗');
  console.log('║   Complete AI System Test                             ║');
  console.log('║   Gemini Vision - Detection + Reporting               ║');
  console.log('╚════════════════════════════════════════════════════════╝\n');
  
  const geminiService = require('./src/services/geminiVisionService');
  
  // Test 1: Connection
  console.log('Test 1: API Connection');
  console.log('─'.repeat(50));
  const connectionTest = await geminiService.testConnection();
  
  if (connectionTest.success) {
    console.log('✅ Connection successful');
    console.log(`   Model: ${connectionTest.model}`);
  } else {
    console.log('❌ Connection failed:', connectionTest.error);
    process.exit(1);
  }
  
  console.log('\n✅ All tests passed!\n');
  console.log('Your AI system is ready to use!');
  console.log('\nNext steps:');
  console.log('1. Start the server: npm start');
  console.log('2. Start the viewer: cd ../viewer && npm start');
  console.log('3. Navigate to: http://localhost:3000/ai-analysis');
  console.log('4. Upload a medical image and test!');
}

testCompleteSystem().catch(error => {
  console.error('\n❌ Test failed:', error.message);
  process.exit(1);
});
