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

async function getImages() {
  console.log('🔍 Searching Orthanc for Study...\n');

  try {
    // Get all studies
    const studies = (await client.get('/studies')).data;
    console.log(`Found ${studies.length} studies in Orthanc\n`);

    // Search for our study
    const targetUID = '1.3.6.1.4.1.16568.1760640137402.333951138';
    let foundStudy = null;

    for (const studyId of studies) {
      const tags = (await client.get(`/studies/${studyId}/simplified-tags`)).data;
      
      console.log(`Study: ${tags.StudyInstanceUID}`);
      console.log(`  Patient: ${tags.PatientName}`);
      console.log(`  Date: ${tags.StudyDate}`);
      
      if (tags.StudyInstanceUID === targetUID) {
        foundStudy = { id: studyId, tags };
        console.log('  ✅ THIS IS OUR TARGET STUDY!\n');
        break;
      } else {
        console.log('');
      }
    }

    if (!foundStudy) {
      console.log('❌ Target study not found in Orthanc');
      console.log('\nLet me get images from the first available study instead...\n');
      
      // Use first study
      const firstStudyId = studies[0];
      const firstTags = (await client.get(`/studies/${firstStudyId}/simplified-tags`)).data;
      foundStudy = { id: firstStudyId, tags: firstTags };
      
      console.log('Using first study:');
      console.log(`  UID: ${firstTags.StudyInstanceUID}`);
      console.log(`  Patient: ${firstTags.PatientName}`);
      console.log(`  Date: ${firstTags.StudyDate}\n`);
    }

    // Get instances
    console.log('Getting instances...');
    const instances = (await client.get(`/studies/${foundStudy.id}/instances`)).data;
    console.log(`Found ${instances.length} instances\n`);

    if (instances.length === 0) {
      console.log('❌ No instances in study');
      return;
    }

    // Get first instance
    const firstInstance = instances[0];
    const instanceId = firstInstance.ID;
    
    console.log(`Using instance: ${instanceId}`);
    
    const instanceTags = (await client.get(`/instances/${instanceId}/simplified-tags`)).data;
    console.log(`  Dimensions: ${instanceTags.Rows}x${instanceTags.Columns}`);
    console.log(`  Frames: ${instanceTags.NumberOfFrames || 1}`);
    console.log(`  Photometric: ${instanceTags.PhotometricInterpretation || 'N/A'}\n`);

    // Create output directory
    const outputDir = path.join(__dirname, '../output');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // Render frames
    console.log('Rendering frames...\n');

    const frameCount = parseInt(instanceTags.NumberOfFrames) || 1;
    const framesToRender = Math.min(3, frameCount); // Render first 3 frames

    for (let i = 0; i < framesToRender; i++) {
      console.log(`Frame ${i}:`);
      
      // Preview (low-res)
      try {
        const previewUrl = `/instances/${instanceId}/frames/${i}/preview`;
        const previewResp = await client.get(previewUrl, { responseType: 'arraybuffer' });
        const previewBuffer = Buffer.from(previewResp.data);
        const previewPath = path.join(outputDir, `frame_${i}_preview.png`);
        fs.writeFileSync(previewPath, previewBuffer);
        console.log(`  Preview: ${(previewBuffer.length / 1024).toFixed(2)} KB → ${previewPath}`);
      } catch (e) {
        console.log(`  Preview: ❌ ${e.message}`);
      }

      // Rendered (full-res)
      try {
        const renderedUrl = `/instances/${instanceId}/frames/${i}/rendered?quality=100`;
        const renderedResp = await client.get(renderedUrl, { responseType: 'arraybuffer' });
        const renderedBuffer = Buffer.from(renderedResp.data);
        const renderedPath = path.join(outputDir, `frame_${i}_rendered.png`);
        fs.writeFileSync(renderedPath, renderedBuffer);
        console.log(`  Rendered: ${(renderedBuffer.length / 1024).toFixed(2)} KB → ${renderedPath}`);
      } catch (e) {
        console.log(`  Rendered: ❌ ${e.message}`);
      }
      
      console.log('');
    }

    console.log('✅ Complete! Check the output/ directory for images');
    console.log(`\nStudy UID: ${foundStudy.tags.StudyInstanceUID}`);
    console.log(`Patient: ${foundStudy.tags.PatientName}`);
    console.log(`Total frames rendered: ${framesToRender}`);

  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.response) {
      console.error('Response:', error.response.data);
    }
  }
}

getImages();
