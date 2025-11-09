const axios = require('axios');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const ORTHANC_URL = process.env.ORTHANC_URL || 'http://69.62.70.102:8042';
const ORTHANC_AUTH = {
  username: process.env.ORTHANC_USERNAME || 'orthanc',
  password: process.env.ORTHANC_PASSWORD || 'orthanc'
};

const client = axios.create({
  baseURL: ORTHANC_URL,
  auth: ORTHANC_AUTH,
  timeout: 10000
});

async function getAllData() {
  console.log('🔍 Getting ALL data from Orthanc...\n');

  try {
    // Get statistics
    const stats = (await client.get('/statistics')).data;
    console.log('Statistics:');
    console.log(`  Studies: ${stats.CountStudies}`);
    console.log(`  Instances: ${stats.CountInstances}`);
    console.log(`  Patients: ${stats.CountPatients}\n`);

    // Get all instances directly
    console.log('Getting all instances...');
    const allInstances = (await client.get('/instances')).data;
    console.log(`Found ${allInstances.length} instances\n`);

    if (allInstances.length === 0) {
      console.log('❌ No instances in Orthanc');
      return;
    }

    // Process each instance
    for (let idx = 0; idx < allInstances.length; idx++) {
      const instanceId = allInstances[idx];
      console.log(`\n${'='.repeat(70)}`);
      console.log(`INSTANCE ${idx + 1}/${allInstances.length}`);
      console.log('='.repeat(70));
      console.log(`Orthanc Instance ID: ${instanceId}\n`);

      // Get tags
      const tags = (await client.get(`/instances/${instanceId}/simplified-tags`)).data;
      
      console.log('DICOM Tags:');
      console.log(`  Study UID: ${tags.StudyInstanceUID}`);
      console.log(`  Series UID: ${tags.SeriesInstanceUID}`);
      console.log(`  SOP Instance UID: ${tags.SOPInstanceUID}`);
      console.log(`  Patient: ${tags.PatientName || 'N/A'}`);
      console.log(`  Patient ID: ${tags.PatientID || 'N/A'}`);
      console.log(`  Study Date: ${tags.StudyDate || 'N/A'}`);
      console.log(`  Modality: ${tags.Modality || 'N/A'}`);
      console.log(`  Dimensions: ${tags.Rows}x${tags.Columns}`);
      console.log(`  Frames: ${tags.NumberOfFrames || 1}`);
      console.log(`  Bits Allocated: ${tags.BitsAllocated || 8}`);
      console.log(`  Photometric: ${tags.PhotometricInterpretation || 'N/A'}`);
      console.log(`  Window Center: ${tags.WindowCenter || 'N/A'}`);
      console.log(`  Window Width: ${tags.WindowWidth || 'N/A'}\n`);

      // Create output directory
      const outputDir = path.join(__dirname, '../output');
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }

      // Render frames
      const frameCount = parseInt(tags.NumberOfFrames) || 1;
      const framesToRender = Math.min(5, frameCount);

      console.log(`Rendering ${framesToRender} frame(s):\n`);

      for (let frameIdx = 0; frameIdx < framesToRender; frameIdx++) {
        console.log(`  Frame ${frameIdx}:`);

        // Preview
        try {
          const previewResp = await client.get(
            `/instances/${instanceId}/frames/${frameIdx}/preview`,
            { responseType: 'arraybuffer' }
          );
          const previewBuffer = Buffer.from(previewResp.data);
          const previewPath = path.join(outputDir, `instance${idx}_frame${frameIdx}_PREVIEW.png`);
          fs.writeFileSync(previewPath, previewBuffer);
          console.log(`    Preview (Low-Res): ${(previewBuffer.length / 1024).toFixed(2)} KB`);
          console.log(`      → ${previewPath}`);
        } catch (e) {
          console.log(`    Preview: ❌ ${e.message}`);
        }

        // Rendered
        try {
          const renderedResp = await client.get(
            `/instances/${instanceId}/frames/${frameIdx}/rendered?quality=100`,
            { responseType: 'arraybuffer' }
          );
          const renderedBuffer = Buffer.from(renderedResp.data);
          const renderedPath = path.join(outputDir, `instance${idx}_frame${frameIdx}_RENDERED.png`);
          fs.writeFileSync(renderedPath, renderedBuffer);
          console.log(`    Rendered (Full-Res): ${(renderedBuffer.length / 1024).toFixed(2)} KB`);
          console.log(`      → ${renderedPath}`);
        } catch (e) {
          console.log(`    Rendered: ❌ ${e.message}`);
        }
      }

      if (frameCount > framesToRender) {
        console.log(`\n  ... and ${frameCount - framesToRender} more frames`);
      }
    }

    console.log('\n\n' + '='.repeat(70));
    console.log('✅ COMPLETE!');
    console.log('='.repeat(70));
    console.log(`\nTotal instances processed: ${allInstances.length}`);
    console.log(`Images saved to: ${path.join(__dirname, '../output')}`);
    console.log('\nYou can now see:');
    console.log('  - PREVIEW images (low-resolution, what was causing blocky appearance)');
    console.log('  - RENDERED images (full-resolution, the fix we applied)');
    console.log('\nCompare them to see the quality difference!');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    if (error.response) {
      console.error('Response:', JSON.stringify(error.response.data, null, 2));
    }
    console.error('\nStack:', error.stack);
  }
}

getAllData();
