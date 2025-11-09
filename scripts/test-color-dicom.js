#!/usr/bin/env node

/**
 * Test script to verify color DICOM rendering
 * Tests the orthanc-preview-client with color image detection
 */

const { getOrthancPreviewClient } = require('../server/src/services/orthanc-preview-client');
const fs = require('fs');
const path = require('path');

async function testColorDicomRendering() {
  console.log('🧪 Testing Color DICOM Rendering\n');
  console.log('=' .repeat(60));

  const client = getOrthancPreviewClient();

  // Test configuration
  const testCases = [
    {
      name: 'Test 1: Auto-detect color image',
      instanceId: 'YOUR_ULTRASOUND_INSTANCE_ID', // Replace with actual instance ID
      frameIndex: 0,
      options: {}
    },
    {
      name: 'Test 2: Force rendered endpoint',
      instanceId: 'YOUR_ULTRASOUND_INSTANCE_ID',
      frameIndex: 0,
      options: { useRendered: true }
    },
    {
      name: 'Test 3: Grayscale image (should use preview)',
      instanceId: 'YOUR_GRAYSCALE_INSTANCE_ID',
      frameIndex: 0,
      options: {}
    }
  ];

  for (const test of testCases) {
    console.log(`\n📋 ${test.name}`);
    console.log('-'.repeat(60));

    try {
      // Get metadata first
      console.log('📊 Fetching metadata...');
      const metadata = await client.getInstanceMetadata(test.instanceId);
      
      console.log(`   Samples Per Pixel: ${metadata.SamplesPerPixel || 1}`);
      console.log(`   Photometric: ${metadata.PhotometricInterpretation || 'Unknown'}`);
      console.log(`   Number of Frames: ${metadata.NumberOfFrames || 1}`);
      console.log(`   Transfer Syntax: ${metadata.TransferSyntaxUID || 'Unknown'}`);

      // Generate preview
      console.log('\n🖼️  Generating preview...');
      const startTime = Date.now();
      
      const pngBuffer = await client.generatePreview(
        test.instanceId,
        test.frameIndex,
        test.options
      );
      
      const duration = Date.now() - startTime;

      console.log(`   ✅ Success!`);
      console.log(`   Size: ${(pngBuffer.length / 1024).toFixed(2)} KB`);
      console.log(`   Duration: ${duration} ms`);

      // Save to file for inspection
      const outputDir = path.join(__dirname, 'test-output');
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }

      const outputFile = path.join(
        outputDir,
        `test-${test.instanceId.substring(0, 8)}-frame${test.frameIndex}.png`
      );
      
      fs.writeFileSync(outputFile, pngBuffer);
      console.log(`   💾 Saved to: ${outputFile}`);

    } catch (error) {
      console.error(`   ❌ Error: ${error.message}`);
      if (error.response) {
        console.error(`   HTTP Status: ${error.response.status}`);
      }
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('✅ Testing complete!\n');
}

// Run tests
if (require.main === module) {
  testColorDicomRendering()
    .then(() => process.exit(0))
    .catch(error => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}

module.exports = { testColorDicomRendering };
