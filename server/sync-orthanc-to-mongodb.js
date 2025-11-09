/**
 * Sync Orthanc Studies to MongoDB
 * 
 * This script fetches all studies from Orthanc PACS and creates
 * proper MongoDB entries with Orthanc Instance IDs for frame retrieval.
 */

require('dotenv').config();
const mongoose = require('mongoose');
const axios = require('axios');
const Study = require('./src/models/Study');
const Series = require('./src/models/Series');
const Instance = require('./src/models/Instance');

// Orthanc configuration
const ORTHANC_URL = process.env.ORTHANC_URL || 'http://69.62.70.102:8042';
const ORTHANC_AUTH = {
  username: process.env.ORTHANC_USERNAME || 'orthanc',
  password: process.env.ORTHANC_PASSWORD || 'orthanc_secure_2024'
};

// MongoDB Connection
async function connectDB() {
  const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/dicomdb';
  await mongoose.connect(uri);
  console.log('✅ Connected to MongoDB');
}

// Fetch from Orthanc with auth
async function orthancRequest(path) {
  const response = await axios.get(`${ORTHANC_URL}${path}`, {
    auth: ORTHANC_AUTH
  });
  return response.data;
}

// Sync a single study from Orthanc to MongoDB
async function syncStudy(orthancStudyId) {
  console.log(`\n📋 Processing study: ${orthancStudyId}`);
  
  // Get study details from Orthanc
  const studyData = await orthancRequest(`/studies/${orthancStudyId}`);
  const studyTags = studyData.MainDicomTags;
  const patientTags = studyData.PatientMainDicomTags;
  
  const studyInstanceUID = studyTags.StudyInstanceUID;
  
  console.log(`  Patient: ${patientTags.PatientName}`);
  console.log(`  Study UID: ${studyInstanceUID}`);
  
  // Check if study already exists
  let study = await Study.findOne({ studyInstanceUID });
  
  if (study) {
    console.log(`  ⏭️  Study already in database, skipping`);
    return { skipped: true };
  }
  
  // Create study document
  study = new Study({
    studyInstanceUID,
    patientName: patientTags.PatientName || 'Unknown',
    patientID: patientTags.PatientID || 'Unknown',
    patientBirthDate: patientTags.PatientBirthDate,
    patientSex: patientTags.PatientSex,
    studyDate: studyTags.StudyDate,
    studyTime: studyTags.StudyTime,
    studyDescription: studyTags.StudyDescription || 'Study from Orthanc',
    accessionNumber: studyTags.AccessionNumber,
    modality: 'OT', // Will be updated from series
    numberOfSeries: studyData.Series?.length || 0,
    numberOfInstances: 0 // Will be calculated
  });
  
  await study.save();
  console.log(`  ✅ Created study document`);
  
  // Process all series in study
  let totalInstances = 0;
  
  for (const orthancSeriesId of studyData.Series || []) {
    const seriesData = await orthancRequest(`/series/${orthancSeriesId}`);
    const seriesTags = seriesData.MainDicomTags;
    const seriesInstanceUID = seriesTags.SeriesInstanceUID;
    
    console.log(`    Series: ${seriesInstanceUID}`);
    
    // Create series document
    const series = new Series({
      seriesInstanceUID,
      studyInstanceUID,
      seriesNumber: parseInt(seriesTags.SeriesNumber) || 1,
      modality: seriesTags.Modality || 'OT',
      seriesDescription: seriesTags.SeriesDescription || '',
      numberOfInstances: seriesData.Instances?.length || 0
    });
    
    await series.save();
    console.log(`    ✅ Created series document`);
    
    // Process all instances in series
    for (const orthancInstanceId of seriesData.Instances || []) {
      const instanceData = await orthancRequest(`/instances/${orthancInstanceId}`);
      const instanceTags = instanceData.MainDicomTags;
      const sopInstanceUID = instanceTags.SOPInstanceUID;
      
      // Get number of frames from instance
      const instanceDetails = await orthancRequest(`/instances/${orthancInstanceId}/simplified-tags`);
      const numberOfFrames = parseInt(instanceDetails.NumberOfFrames || '1');
      
      // Create instance document with Orthanc ID (KEY!)
      const instance = new Instance({
        sopInstanceUID,
        studyInstanceUID,
        seriesInstanceUID,
        instanceNumber: parseInt(instanceTags.InstanceNumber) || 1,
        orthancInstanceId: orthancInstanceId,  // ✅ LINK TO ORTHANC
        orthancUrl: `${ORTHANC_URL}/instances/${orthancInstanceId}/file`,
        numberOfFrames: numberOfFrames
      });
      
      await instance.save();
      totalInstances += numberOfFrames;
      
      console.log(`      ✅ Instance: ${sopInstanceUID.substring(0, 30)}... (${numberOfFrames} frames)`);
    }
    
    // Update study modality from first series
    if (!study.modality || study.modality === 'OT') {
      study.modality = seriesTags.Modality || 'OT';
    }
  }
  
  // Update study with total instance count
  study.numberOfInstances = totalInstances;
  await study.save();
  
  console.log(`  📊 Total frames: ${totalInstances}`);
  console.log(`  ✅ Study sync complete!`);
  
  return { synced: true, frames: totalInstances };
}

// Main sync function
async function syncAllStudies() {
  try {
    console.log('🔄 Starting Orthanc → MongoDB sync...\n');
    
    // Get all studies from Orthanc
    const orthancStudyIds = await orthancRequest('/studies');
    console.log(`Found ${orthancStudyIds.length} studies in Orthanc\n`);
    
    if (orthancStudyIds.length === 0) {
      console.log('❌ No studies in Orthanc. Please upload DICOM files first.');
      return;
    }
    
    let synced = 0;
    let skipped = 0;
    let failed = 0;
    
    for (const orthancStudyId of orthancStudyIds) {
      try {
        const result = await syncStudy(orthancStudyId);
        if (result.skipped) {
          skipped++;
        } else if (result.synced) {
          synced++;
        }
      } catch (error) {
        console.error(`  ❌ Failed to sync study ${orthancStudyId}:`, error.message);
        failed++;
      }
    }
    
    console.log('\n🏁 Sync complete!');
    console.log(`  ✅ Synced: ${synced}`);
    console.log(`  ⏭️  Skipped: ${skipped}`);
    console.log(`  ❌ Failed: ${failed}`);
    
  } catch (error) {
    console.error('❌ Sync failed:', error);
    throw error;
  }
}

// Run sync
async function main() {
  try {
    await connectDB();
    await syncAllStudies();
    await mongoose.connection.close();
    console.log('\n✅ Sync completed successfully');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Sync failed:', error);
    process.exit(1);
  }
}

main();
