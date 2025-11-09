// Script to fix multi-frame DICOM studies that were uploaded incorrectly
require('dotenv').config();
const mongoose = require('mongoose');
const axios = require('axios');

const InstanceSchema = new mongoose.Schema({
  studyInstanceUID: String,
  seriesInstanceUID: String,
  sopInstanceUID: String,
  instanceNumber: Number,
  modality: String,
  cloudinaryUrl: String,
  cloudinaryPublicId: String,
  orthancInstanceId: String,
  orthancUrl: String,
  orthancFrameIndex: Number,
  useOrthancPreview: Boolean
}, { timestamps: true });

const StudySchema = new mongoose.Schema({
  studyInstanceUID: String,
  studyDate: String,
  studyTime: String,
  patientName: String,
  patientID: String,
  patientBirthDate: String,
  patientSex: String,
  modality: String,
  studyDescription: String,
  numberOfSeries: Number,
  numberOfInstances: Number,
  orthancStudyId: String
}, { timestamps: true });

const Instance = mongoose.model('Instance', InstanceSchema);
const Study = mongoose.model('Study', StudySchema);

async function fixMultiFrameStudy(studyUID) {
  try {
    console.log(`\nFixing multi-frame study: ${studyUID}`);
    
    await mongoose.connect(process.env.MONGODB_URI);
    
    // Get existing instances
    const existingInstances = await Instance.find({ studyInstanceUID: studyUID });
    console.log(`Found ${existingInstances.length} existing instance(s)`);
    
    if (existingInstances.length === 0) {
      console.log('No instances found!');
      return;
    }
    
    // Get the first instance (which has the Orthanc ID)
    const firstInstance = existingInstances[0];
    console.log(`Orthanc Instance ID: ${firstInstance.orthancInstanceId}`);
    
    if (!firstInstance.orthancInstanceId) {
      console.log('ERROR: No Orthanc Instance ID found!');
      return;
    }
    
    // Get metadata from Orthanc to find frame count
    const orthancUrl = process.env.ORTHANC_URL || 'http://69.62.70.102:8042';
    const orthancAuth = {
      username: process.env.ORTHANC_USERNAME || 'orthanc',
      password: process.env.ORTHANC_PASSWORD || 'orthanc'
    };
    
    console.log(`\nFetching metadata from Orthanc...`);
    const metadataResponse = await axios.get(
      `${orthancUrl}/instances/${firstInstance.orthancInstanceId}/simplified-tags`,
      { auth: orthancAuth }
    );
    
    const frameCount = parseInt(metadataResponse.data.NumberOfFrames) || 1;
    console.log(`Frame count: ${frameCount}`);
    
    if (frameCount === 1) {
      console.log('This is a single-frame DICOM, no fix needed.');
      return;
    }
    
    // Delete existing instances
    console.log(`\nDeleting ${existingInstances.length} old instance record(s)...`);
    await Instance.deleteMany({ studyInstanceUID: studyUID });
    
    // Create new instance records for each frame
    console.log(`Creating ${frameCount} new instance records...`);
    const newInstances = [];
    
    for (let frameIndex = 0; frameIndex < frameCount; frameIndex++) {
      const instanceData = {
        studyInstanceUID: studyUID,
        seriesInstanceUID: firstInstance.seriesInstanceUID || `${studyUID}.1`,
        sopInstanceUID: `${firstInstance.sopInstanceUID || studyUID}.frame${frameIndex}`,
        instanceNumber: frameIndex + 1,
        modality: firstInstance.modality,
        orthancInstanceId: firstInstance.orthancInstanceId,
        orthancUrl: firstInstance.orthancUrl || `${orthancUrl}/instances/${firstInstance.orthancInstanceId}`,
        orthancFrameIndex: frameIndex,
        useOrthancPreview: true
      };
      
      newInstances.push(instanceData);
    }
    
    await Instance.insertMany(newInstances);
    console.log(`✅ Created ${newInstances.length} instance records`);
    
    // Update study with correct instance count
    await Study.updateOne(
      { studyInstanceUID: studyUID },
      { $set: { numberOfInstances: frameCount } }
    );
    console.log(`✅ Updated study with ${frameCount} instances`);
    
    console.log(`\n✅ Study fixed successfully!`);
    console.log(`   Study UID: ${studyUID}`);
    console.log(`   Total frames: ${frameCount}`);
    console.log(`   Ready for viewing!`);
    
    await mongoose.disconnect();
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

// Get study UID from command line or use default
const studyUID = process.argv[2] || '1.3.6.1.4.1.16568.1759569566212.470976844';

fixMultiFrameStudy(studyUID);
