const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const fs = require('fs');

// Test the frame cache service fix
const { getFrameCacheService } = require('./src/services/frame-cache-service');

async function testFrameFix() {
  console.log('🧪 Testing frame cache service fix\n');
  
  const studyUID = '1.3.6.1.4.1.16568.1760629278470.775947117';
  const frameIndex = 43;
  
  const frameCacheService = getFrameCacheService();
  
  console.log(`Testing study: ${studyUID}`);
  console.log(`Frame index: ${frameIndex}\n`);
  
  // Test 1: Check if frame exists in filesystem
  const BACKEND_DIR = path.resolve(__dirname, 'backend');
  const framePath = path.join(BACKEND_DIR, `uploaded_frames_${studyUID}`, `frame_${String(frameIndex).padStart(3, '0')}.png`);
  
  console.log(`1️⃣  Checking filesystem cache:`);
  console.log(`   Path: ${framePath}`);
  console.log(`   Exists: ${fs.existsSync(framePath)}`);
  
  if (fs.existsSync(framePath)) {
    const stats = fs.statSync(framePath);
    console.log(`   Size: ${stats.size} bytes`);
    console.log(`   Modified: ${stats.mtime}`);
  }
  
  // Test 2: Try to get frame through cache service
  console.log(`\n2️⃣  Testing frame cache service:`);
  
  try {
    const frameBuffer = await frameCacheService.getFrame(studyUID, frameIndex);
    
    if (frameBuffer) {
      console.log(`   ✅ Frame retrieved successfully`);
      console.log(`   Buffer size: ${frameBuffer.length} bytes`);
      
      // Check if it's a placeholder (small size)
      if (frameBuffer.length < 5000) {
        console.log(`   ⚠️  WARNING: Frame is very small, might be a placeholder`);
      } else {
        console.log(`   ✅ Frame appears to be valid (not a placeholder)`);
      }
    } else {
      console.log(`   ⚠️  Frame cache service returned null`);
      console.log(`   This should trigger legacy filesystem fallback in controller`);
    }
  } catch (error) {
    console.error(`   ❌ Error: ${error.message}`);
  }
  
  console.log('\n✅ Test complete');
  process.exit(0);
}

testFrameFix().catch(error => {
  console.error('❌ Test failed:', error);
  process.exit(1);
});
