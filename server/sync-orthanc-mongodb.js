#!/usr/bin/env node

/**
 * Sync Orthanc and MongoDB
 * Links existing Orthanc DICOM data with MongoDB records
 * Creates missing Instance records with proper Orthanc references
 */

const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const { getUnifiedOrthancService } = require('./src/services/unified-orthanc-service');
const Study = require('./src/models/Study');
const Series = require('./src/models/Series');
const Instance = require('./src/models/Instance');

async function syncOrthancToMongoDB() {
  console.log('🔄 SYNCING ORTHANC WITH MONGODB\n');
  console.log('═'.repeat(70));

  try {
    // Connect to MongoDB
    console.log('\n📊 Step 1: Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    // Connect to Orthanc
    console.log('🏥 Step 2: Connecting to Orthanc...');
    const orthancService = getUnifiedOrthancService();
    const connection = await orthancService.testConnection();
    
    if (!connection.connected) {
      console.error('❌ Cannot connect to Orthanc:', connection.error);
      process.exit(1);
    }
    
    console.log(`✅ Connected to Orthanc ${connection.version}\n`);

    // Get all studies from Orthanc
    console.log('📋 Step 3: Getting studies from Orthanc...');
    const orthancStudyIds = await orthancService.getAllStudies();
    console.log(`Found ${orthancStudyIds.length} studies in Orthanc\n`);

    if (orthancStudyIds.length === 0) {
      console.log('⚠️  No studies in Orthanc. Nothing to sync.');
      return;
    }

    let totalSynced = 0;
    let totalInstances = 0;

    // Process each study
    for (let idx = 0; idx < orthancStudyIds.length; idx++) {
      const orthancStudyId = orthancStudyIds[idx];
      
      console.log(`\n${'─'.repeat(70)}`);
      console.log(`Processing Study ${idx + 1}/${orthancStudyIds.length}`);
      console.log('─'.repeat(70));
      console.log(`Orthanc Study ID: ${orthancStudyId}\n`);

      try {
        // Get study details first
        const studyDetails = await orthancService.getStudyById(orthancStudyId);
        
        // Get study tags from Orthanc
        const studyTags = await orthancService.getStudyTags(orthancStudyId);
        const studyInstanceUID = studyTags.StudyInstanceUID;

        console.log('Study Information:');
        console.log(`  Study UID: ${studyInstanceUID}`);
        console.log(`  Patient: ${studyTags.PatientName || 'Unknown'}`);
        console.log(`  Patient ID: ${studyTags.PatientID || 'Unknown'}`);
        console.log(`  Date: ${studyTags.StudyDate || 'N/A'}`);
        console.log(`  Modality: ${studyTags.Modality || 'N/A'}`);
        console.log(`  Description: ${studyTags.StudyDescription || 'N/A'}\n`);

        // Check if study exists in MongoDB
        let mongoStudy = await Study.findOne({ studyInstanceUID });
        
        if (mongoStudy) {
          console.log('✅ Study exists in MongoDB');
          // Update Orthanc Study ID if missing
          if (!mongoStudy.orthancStudyId) {
            await Study.updateOne(
              { studyInstanceUID },
              { $set: { orthancStudyId: orthancStudyId } }
            );
            console.log('   Updated with Orthanc Study ID');
          }
        } else {
          console.log('⚠️  Study NOT in MongoDB - Creating...');
          await Study.create({
            studyInstanceUID,
            studyDate: studyTags.StudyDate || '',
            studyTime: studyTags.StudyTime || '',
            patientName: studyTags.PatientName || 'Unknown',
            patientID: studyTags.PatientID || 'Unknown',
            patientBirthDate: studyTags.PatientBirthDate || '',
            patientSex: studyTags.PatientSex || '',
            modality: studyTags.Modality || 'OT',
            studyDescription: studyTags.StudyDescription || '',
            numberOfSeries: 0,
            numberOfInstances: 0,
            orthancStudyId: orthancStudyId
          });
          console.log('   ✅ Created study in MongoDB');
        }

        // Get all instances for this study from Orthanc
        console.log('\nGetting instances from Orthanc...');
        const instanceIds = studyDetails.Instances || [];
        console.log(`Found ${instanceIds.length} instance IDs in study details`);
        
        // Get full instance data
        const orthancInstances = [];
        for (const instId of instanceIds) {
          try {
            const instData = await orthancService.client.get(`/instances/${instId}`).then(r => r.data);
            orthancInstances.push(instData);
          } catch (e) {
            console.warn(`  Warning: Could not get instance ${instId}:`, e.message);
          }
        }
        console.log(`Retrieved ${orthancInstances.length} instances`);

        // Check existing instances in MongoDB
        const existingInstances = await Instance.countDocuments({ studyInstanceUID });
        console.log(`Existing instances in MongoDB: ${existingInstances}\n`);

        if (existingInstances > 0) {
          console.log('✅ Instances already synced. Skipping...');
          totalInstances += existingInstances;
          continue;
        }

        // Process each instance
        console.log('Creating instance records...');
        const instanceRecords = [];
        
        for (const orthancInstanceData of orthancInstances) {
          const orthancInstanceId = orthancInstanceData.ID;
          
          try {
            // Get instance metadata
            const instanceTags = await orthancService.getInstanceMetadata(orthancInstanceId);
            const frameCount = parseInt(instanceTags.NumberOfFrames) || 1;

            // Get series info
            const seriesInstanceUID = instanceTags.SeriesInstanceUID;
            const orthancSeriesId = orthancInstanceData.ParentSeries;

            // Ensure series exists in MongoDB
            await Series.updateOne(
              { studyInstanceUID, seriesInstanceUID },
              {
                $set: {
                  studyInstanceUID,
                  seriesInstanceUID,
                  modality: instanceTags.Modality || studyTags.Modality || 'OT',
                  seriesNumber: parseInt(instanceTags.SeriesNumber) || 1,
                  description: instanceTags.SeriesDescription || studyTags.StudyDescription || '',
                  orthancSeriesId: orthancSeriesId
                }
              },
              { upsert: true }
            );

            // Create instance record for each frame
            for (let frameIdx = 0; frameIdx < frameCount; frameIdx++) {
              const sopInstanceUID = frameCount > 1 
                ? `${instanceTags.SOPInstanceUID}.frame${frameIdx}`
                : instanceTags.SOPInstanceUID;

              instanceRecords.push({
                studyInstanceUID,
                seriesInstanceUID,
                sopInstanceUID,
                instanceNumber: parseInt(instanceTags.InstanceNumber) || (frameIdx + 1),
                modality: instanceTags.Modality || studyTags.Modality || 'OT',
                rows: parseInt(instanceTags.Rows) || 0,
                columns: parseInt(instanceTags.Columns) || 0,
                numberOfFrames: frameCount,
                bitsAllocated: parseInt(instanceTags.BitsAllocated) || 8,
                samplesPerPixel: parseInt(instanceTags.SamplesPerPixel) || 1,
                photometricInterpretation: instanceTags.PhotometricInterpretation || 'MONOCHROME2',
                
                // Orthanc references (PRIMARY)
                orthancInstanceId: orthancInstanceId,
                orthancUrl: `${process.env.ORTHANC_URL || 'http://69.62.70.102:8042'}/instances/${orthancInstanceId}`,
                orthancFrameIndex: frameIdx,
                orthancStudyId: orthancStudyId,
                orthancSeriesId: orthancSeriesId,
                useOrthancPreview: true,
                
                // Processing status
                processed: true,
                filesystemCached: false
              });
            }

            console.log(`  ✅ Instance ${orthancInstanceId}: ${frameCount} frame(s)`);
            
          } catch (instError) {
            console.error(`  ❌ Error processing instance ${orthancInstanceId}:`, instError.message);
          }
        }

        // Bulk insert instances
        if (instanceRecords.length > 0) {
          console.log(`\nInserting ${instanceRecords.length} instance records...`);
          
          try {
            await Instance.insertMany(instanceRecords, { ordered: false });
            console.log(`✅ Inserted ${instanceRecords.length} instances`);
            totalInstances += instanceRecords.length;
          } catch (insertError) {
            if (insertError.code === 11000) {
              console.log('⚠️  Some instances already exist (duplicate key)');
              // Count how many were actually inserted
              const inserted = insertError.insertedDocs ? insertError.insertedDocs.length : 0;
              console.log(`✅ Inserted ${inserted} new instances`);
              totalInstances += inserted;
            } else {
              console.error('❌ Insert error:', insertError.message);
            }
          }

          // Update study with instance count
          await Study.updateOne(
            { studyInstanceUID },
            {
              $set: {
                numberOfInstances: instanceRecords.length,
                numberOfSeries: await Series.countDocuments({ studyInstanceUID })
              }
            }
          );
        }

        totalSynced++;

      } catch (studyError) {
        console.error(`❌ Error processing study ${orthancStudyId}:`, studyError.message);
      }
    }

    // Summary
    console.log('\n\n' + '═'.repeat(70));
    console.log('✅ SYNC COMPLETE!');
    console.log('═'.repeat(70));
    console.log(`\nStudies synced: ${totalSynced}/${orthancStudyIds.length}`);
    console.log(`Total instances created: ${totalInstances}`);
    
    // Verify
    console.log('\n📊 Verification:');
    const mongoStudyCount = await Study.countDocuments({});
    const mongoInstanceCount = await Instance.countDocuments({});
    console.log(`  MongoDB Studies: ${mongoStudyCount}`);
    console.log(`  MongoDB Instances: ${mongoInstanceCount}`);
    console.log(`  Orthanc Studies: ${orthancStudyIds.length}`);
    
    console.log('\n✅ MongoDB and Orthanc are now synchronized!');
    console.log('\nNext steps:');
    console.log('  1. Restart your server');
    console.log('  2. Load a study in the viewer');
    console.log('  3. Frames will be fetched from Orthanc and cached');

  } catch (error) {
    console.error('\n❌ Sync failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('\n👋 Disconnected from MongoDB');
  }
}

// Run sync
syncOrthancToMongoDB();
