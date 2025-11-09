const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const axios = require('axios');

const ORTHANC_URL = process.env.ORTHANC_URL || 'http://69.62.70.102:8042';
const ORTHANC_AUTH = {
  username: process.env.ORTHANC_USERNAME || 'orthanc',
  password: process.env.ORTHANC_PASSWORD || 'orthanc'
};

async function checkOrthancStudy() {
  const studyUID = '1.3.6.1.4.1.16568.1760629278470.775947117';
  
  console.log(`🔍 Searching for study in Orthanc: ${studyUID}\n`);
  
  try {
    // Get all studies
    const studiesResp = await axios.get(`${ORTHANC_URL}/studies`, { auth: ORTHANC_AUTH });
    console.log(`Found ${studiesResp.data.length} studies in Orthanc\n`);
    
    // Search for our study
    for (const studyId of studiesResp.data) {
      const studyInfo = await axios.get(`${ORTHANC_URL}/studies/${studyId}`, { auth: ORTHANC_AUTH });
      
      if (studyInfo.data.MainDicomTags.StudyInstanceUID === studyUID) {
        console.log(`✅ Found study in Orthanc!`);
        console.log(`   Orthanc Study ID: ${studyId}`);
        console.log(`   Patient: ${studyInfo.data.PatientMainDicomTags.PatientName}`);
        console.log(`   Patient ID: ${studyInfo.data.PatientMainDicomTags.PatientID}`);
        console.log(`   Study Date: ${studyInfo.data.MainDicomTags.StudyDate}`);
        console.log(`   Modality: ${studyInfo.data.MainDicomTags.Modality || 'N/A'}`);
        console.log(`   Number of Series: ${studyInfo.data.Series.length}`);
        console.log(`   Number of Instances: ${studyInfo.data.Instances.length}`);
        
        if (studyInfo.data.Instances.length > 0) {
          const firstInstance = studyInfo.data.Instances[0];
          console.log(`\n   First Instance ID: ${firstInstance}`);
          
          // Get instance details
          const instInfo = await axios.get(`${ORTHANC_URL}/instances/${firstInstance}`, { auth: ORTHANC_AUTH });
          console.log(`   SOP Instance UID: ${instInfo.data.MainDicomTags.SOPInstanceUID}`);
          
          // Check if it's multi-frame
          const tags = instInfo.data.MainDicomTags;
          const numberOfFrames = tags.NumberOfFrames || '1';
          console.log(`   Number of Frames: ${numberOfFrames}`);
          
          // Try to get a preview
          console.log(`\n   Testing frame preview...`);
          try {
            const previewResp = await axios.get(`${ORTHANC_URL}/instances/${firstInstance}/frames/0/preview`, {
              auth: ORTHANC_AUTH,
              responseType: 'arraybuffer'
            });
            console.log(`   ✅ Frame preview available (${previewResp.data.length} bytes)`);
          } catch (error) {
            console.log(`   ❌ Frame preview failed: ${error.message}`);
          }
        }
        
        return;
      }
    }
    
    console.log(`❌ Study not found in Orthanc`);
    
  } catch (error) {
    console.error(`❌ Error: ${error.message}`);
    if (error.response) {
      console.error(`   Status: ${error.response.status}`);
      console.error(`   Data: ${JSON.stringify(error.response.data)}`);
    }
  }
}

checkOrthancStudy();
