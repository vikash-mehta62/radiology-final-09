/**
 * Remote Orthanc Sync Script
 * 
 * Automatically syncs studies from remote Orthanc server to local database
 * Remote Server: http://69.62.70.102:8042
 * Username: orthanc
 * Password: orthanc_secure_2024
 */

require('dotenv').config();
const axios = require('axios');
const mongoose = require('mongoose');
const Study = require('./src/models/Study');
const Instance = require('./src/models/Instance');

// Remote Orthanc Configuration
const REMOTE_ORTHANC = {
  url: 'http://69.62.70.102:8042',
  username: 'orthanc',
  password: 'orthanc_secure_2024'
};

// Create axios instance with auth
const orthancClient = axios.create({
  baseURL: REMOTE_ORTHANC.url,
  auth: {
    username: REMOTE_ORTHANC.username,
    password: REMOTE_ORTHANC.password
  },
  timeout: 30000
});

/**
 * Connect to MongoDB
 */
async function connectDB() {
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/dicomdb';
    await mongoose.connect(mongoUri);
    console.log('✅ MongoDB connected');
  } catch (error) {
    console.error('❌ MongoDB connection failed:', error.message);
    process.exit(1);
  }
}

/**
 * Get all studies from remote Orthanc
 */
async function getRemoteStudies() {
  try {
    const response = await orthancClient.get('/studies');
    return response.data; // Array of study IDs
  } catch (error) {
    console.error('Failed to get studies from remote Orthanc:', error.message);
    throw error;
  }
}

/**
 * Get study details from remote Orthanc
 */
async function getStudyDetails(studyId) {
  try {
    const response = await orthancClient.get(`/studies/${studyId}`);
    return response.data;
  } catch (error) {
    console.error(`Failed to get study ${studyId}:`, error.message);
    throw error;
  }
}

/**
 * Get study tags (DICOM metadata)
 */
async function getStudyTags(studyId) {
  try {
    // Try simplified-tags first
    const response = await orthancClient.get(`/studies/${studyId}/simplified-tags`);
    return response.data;
  } catch (error) {
    // Fallback to regular tags if simplified-tags not available
    try {
      console.log(`  ⚠️  Simplified tags not available, trying regular tags...`);
      const response = await orthancClient.get(`/studies/${studyId}/tags`);
      
      // Convert tags format to simplified format
      const tags = response.data;
      const simplified = {};
      
      for (const [key, value] of Object.entries(tags)) {
        if (value && value.Value) {
          simplified[value.Name || key] = Array.isArray(value.Value) ? value.Value[0] : value.Value;
        }
      }
      
      return simplified;
    } catch (fallbackError) {
      console.error(`Failed to get tags for study ${studyId}:`, fallbackError.message);
      throw fallbackError;
    }
  }
}

/**
 * Get instance metadata
 */
async function getInstanceMetadata(instanceId) {
  try {
    // Try simplified-tags first
    const response = await orthancClient.get(`/instances/${instanceId}/simplified-tags`);
    return response.data;
  } catch (error) {
    // Fallback to regular tags
    try {
      const response = await orthancClient.get(`/instances/${instanceId}/tags`);
      const tags = response.data;
      const simplified = {};
      
      for (const [key, value] of Object.entries(tags)) {
        if (value && value.Value) {
          simplified[value.Name || key] = Array.isArray(value.Value) ? value.Value[0] : value.Value;
        }
      }
      
      return simplified;
    } catch (fallbackError) {
      console.error(`Failed to get instance ${instanceId}:`, fallbackError.message);
      throw fallbackError;
    }
  }
}

/**
 * Process and save study to database
 */
async function processStudy(orthancStudyId, studyDetails, studyTags) {
  try {
    // Extract StudyInstanceUID from tags (handle different formats)
    const studyInstanceUID = studyTags.StudyInstanceUID || 
                            studyTags['0020,000d'] || 
                            studyTags['StudyInstanceUID'] ||
                            orthancStudyId;
    
    if (!studyInstanceUID) {
      console.log(`  ⚠️  No StudyInstanceUID found, skipping study ${orthancStudyId}`);
      return { status: 'skipped', reason: 'No StudyInstanceUID' };
    }
    
    // Check if study already exists
    let study = await Study.findOne({ studyInstanceUID });
    
    if (study) {
      console.log(`  ⏭️  Study already exists: ${studyInstanceUID}`);
      return { status: 'exists', studyInstanceUID };
    }
    
    // Create new study
    study = await Study.create({
      studyInstanceUID: studyInstanceUID,
      studyDate: studyTags.StudyDate,
      studyTime: studyTags.StudyTime,
      patientName: studyTags.PatientName || 'Unknown',
      patientID: studyTags.PatientID,
      patientBirthDate: studyTags.PatientBirthDate,
      patientSex: studyTags.PatientSex,
      modality: studyTags.Modality || 'OT',
      studyDescription: studyTags.StudyDescription,
      numberOfSeries: studyDetails.Series?.length || 0,
      numberOfInstances: studyDetails.Instances?.length || 0,
      orthancStudyId: orthancStudyId,
      remoteOrthancUrl: REMOTE_ORTHANC.url
    });
    
    console.log(`  ✅ Study created: ${studyInstanceUID}`);
    
    // Process instances
    const instances = studyDetails.Instances || [];
    let instanceCount = 0;
    
    for (const instanceId of instances) {
      try {
        const instanceTags = await getInstanceMetadata(instanceId);
        const frameCount = parseInt(instanceTags.NumberOfFrames) || 1;
        
        // Create instance records (one per frame for multi-frame DICOM)
        const instanceRecords = [];
        for (let frameIndex = 0; frameIndex < frameCount; frameIndex++) {
          instanceRecords.push({
            studyInstanceUID: studyInstanceUID,
            seriesInstanceUID: instanceTags.SeriesInstanceUID || `${studyInstanceUID}.1`,
            sopInstanceUID: frameCount > 1 
              ? `${instanceTags.SOPInstanceUID}.frame${frameIndex}` 
              : instanceTags.SOPInstanceUID,
            instanceNumber: frameIndex + 1,
            modality: instanceTags.Modality || 'OT',
            // Remote Orthanc storage
            orthancInstanceId: instanceId,
            orthancUrl: `${REMOTE_ORTHANC.url}/instances/${instanceId}`,
            orthancFrameIndex: frameIndex,
            useOrthancPreview: true,
            remoteOrthancUrl: REMOTE_ORTHANC.url
          });
        }
        
        await Instance.insertMany(instanceRecords, { ordered: false })
          .catch(error => {
            if (error.code !== 11000) throw error;
          });
        
        instanceCount += frameCount;
        
      } catch (error) {
        console.error(`    Failed to process instance ${instanceId}:`, error.message);
      }
    }
    
    console.log(`  ✅ Created ${instanceCount} instance records`);
    
    return { 
      status: 'created', 
      studyInstanceUID, 
      instances: instanceCount 
    };
    
  } catch (error) {
    console.error(`Failed to process study ${orthancStudyId}:`, error.message);
    throw error;
  }
}

/**
 * Main sync function
 */
async function syncRemoteOrthanc() {
  console.log('🔄 Starting Remote Orthanc Sync...');
  console.log(`📡 Remote Server: ${REMOTE_ORTHANC.url}`);
  console.log('');
  
  try {
    // Get all studies from remote Orthanc
    const studyIds = await getRemoteStudies();
    console.log(`📊 Found ${studyIds.length} studies on remote Orthanc`);
    console.log('');
    
    let createdCount = 0;
    let existsCount = 0;
    let errorCount = 0;
    
    for (let i = 0; i < studyIds.length; i++) {
      const studyId = studyIds[i];
      console.log(`[${i + 1}/${studyIds.length}] Processing study: ${studyId}`);
      
      try {
        // First check if study has any instances
        const studyDetails = await getStudyDetails(studyId);
        
        if (!studyDetails.Instances || studyDetails.Instances.length === 0) {
          console.log(`  ⚠️  Study has no instances, skipping...`);
          errorCount++;
          console.log('');
          continue;
        }
        
        const studyTags = await getStudyTags(studyId);
        
        const result = await processStudy(studyId, studyDetails, studyTags);
        
        if (result.status === 'created') {
          createdCount++;
        } else if (result.status === 'exists') {
          existsCount++;
        } else if (result.status === 'skipped') {
          errorCount++;
        }
        
      } catch (error) {
        console.error(`  ❌ Error: ${error.message}`);
        errorCount++;
      }
      
      console.log('');
    }
    
    console.log('✅ Sync Complete!');
    console.log('');
    console.log('📊 Summary:');
    console.log(`   Total Studies: ${studyIds.length}`);
    console.log(`   ✅ Created: ${createdCount}`);
    console.log(`   ⏭️  Already Exists: ${existsCount}`);
    console.log(`   ❌ Errors: ${errorCount}`);
    
  } catch (error) {
    console.error('❌ Sync failed:', error.message);
    throw error;
  }
}

/**
 * Watch for new studies (polling mode)
 */
async function watchRemoteOrthanc(intervalSeconds = 60) {
  console.log(`👀 Watching remote Orthanc for new studies (checking every ${intervalSeconds}s)...`);
  console.log('Press Ctrl+C to stop');
  console.log('');
  
  let lastStudyCount = 0;
  
  setInterval(async () => {
    try {
      const studyIds = await getRemoteStudies();
      
      if (studyIds.length > lastStudyCount) {
        console.log(`🆕 New studies detected! (${studyIds.length - lastStudyCount} new)`);
        await syncRemoteOrthanc();
      } else {
        console.log(`✓ No new studies (${studyIds.length} total) - ${new Date().toLocaleTimeString()}`);
      }
      
      lastStudyCount = studyIds.length;
      
    } catch (error) {
      console.error('Watch error:', error.message);
    }
  }, intervalSeconds * 1000);
}

/**
 * Main execution
 */
async function main() {
  await connectDB();
  
  const args = process.argv.slice(2);
  const command = args[0];
  
  if (command === 'watch') {
    const interval = parseInt(args[1]) || 60;
    await watchRemoteOrthanc(interval);
  } else {
    await syncRemoteOrthanc();
    await mongoose.disconnect();
    console.log('👋 Disconnected from MongoDB');
  }
}

// Run
main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
