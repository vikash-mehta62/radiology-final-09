const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const mongoose = require('mongoose');
const axios = require('axios');
const Study = require('./src/models/Study');
const Instance = require('./src/models/Instance');

const ORTHANC_URL = process.env.ORTHANC_URL || 'http://69.62.70.102:8042';
const ORTHANC_AUTH = {
  username: process.env.ORTHANC_USERNAME || 'orthanc',
  password: process.env.ORTHANC_PASSWORD || 'orthanc'
};

async function checkLatestUpload() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    
    // Get most recent study from MongoDB
    const latestStudy = await Study.findOne().sort({ createdAt: -1 }).lean();
    
    if (!latestStudy) {
      console.log('No studies found in MongoDB');
      process.exit(1);
    }
    
    console.log('\n📋 Latest Study in MongoDB:');
    console.log(`   Study UID: ${latestStudy.studyInstanceUID}`);
    console.log(`   Patient: ${latestStudy.patientName} (${latestStudy.patientID})`);
    console.log(`   Created: ${latestStudy.createdAt}`);
    console.log(`   Orthanc Study ID: ${latestStudy.orthancStudyId || 'NOT SET'}`);
    
    // Check instances
    const instanceCount = await Instance.countDocuments({ studyInstanceUID: latestStudy.studyInstanceUID });
    console.log(`   Instances in MongoDB: ${instanceCount}`);
    
    if (instanceCount > 0) {
      const sampleInstance = await Instance.findOne({ studyInstanceUID: latestStudy.studyInstanceUID }).lean();
      console.log(`\n   Sample Instance:`);
      console.log(`     Instance Number: ${sampleInstance.instanceNumber}`);
      console.log(`     Orthanc Instance ID: ${sampleInstance.orthancInstanceId || 'NOT SET'}`);
      console.log(`     Orthanc URL: ${sampleInstance.orthancUrl || 'NOT SET'}`);
      console.log(`     Number of Frames: ${sampleInstance.numberOfFrames}`);
    }
    
    // Check Orthanc
    console.log('\n🏥 Checking Orthanc PACS:');
    
    try {
      const studiesResp = await axios.get(`${ORTHANC_URL}/studies`, { auth: ORTHANC_AUTH });
      console.log(`   Total studies in Orthanc: ${studiesResp.data.length}`);
      
      // Check if our study is there
      let found = false;
      for (const studyId of studiesResp.data) {
        const info = await axios.get(`${ORTHANC_URL}/studies/${studyId}`, { auth: ORTHANC_AUTH });
        if (info.data.MainDicomTags.StudyInstanceUID === latestStudy.studyInstanceUID) {
          found = true;
          console.log(`   ✅ Latest study found in Orthanc!`);
          console.log(`   Orthanc Study ID: ${studyId}`);
          console.log(`   Instances: ${info.data.Instances.length}`);
          
          if (info.data.Instances.length > 0) {
            const firstInst = info.data.Instances[0];
            console.log(`   First Instance ID: ${firstInst}`);
            
            // Try to get a frame
            try {
              const frameResp = await axios.get(`${ORTHANC_URL}/instances/${firstInst}/frames/0/preview`, {
                auth: ORTHANC_AUTH,
                responseType: 'arraybuffer'
              });
              console.log(`   ✅ Frame preview works! (${frameResp.data.length} bytes)`);
            } catch (e) {
              console.log(`   ❌ Frame preview failed: ${e.message}`);
            }
          }
          break;
        }
      }
      
      if (!found) {
        console.log(`   ❌ Latest study NOT found in Orthanc`);
      }
    } catch (error) {
      console.error(`   ❌ Orthanc error: ${error.message}`);
    }
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkLatestUpload();
