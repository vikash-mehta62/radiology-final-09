#!/usr/bin/env node

const mongoose = require('mongoose');
const axios = require('axios');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const Study = require('./src/models/Study');
const Series = require('./src/models/Series');
const Instance = require('./src/models/Instance');

const client = axios.create({
  baseURL: process.env.ORTHANC_URL || 'http://69.62.70.102:8042',
  auth: {
    username: process.env.ORTHANC_USERNAME || 'orthanc',
    password: process.env.ORTHANC_PASSWORD || 'orthanc'
  }
});

async function sync() {
  console.log('🔄 SYNCING ORTHANC TO MONGODB\n');

  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    // Get all instances from Orthanc
    const instanceIds = (await client.get('/instances')).data;
    console.log(`Found ${instanceIds.length} instances in Orthanc\n`);

    if (instanceIds.length === 0) {
      console.log('⚠️  No instances in Orthanc');
      return;
    }

    let created = 0;
    let skipped = 0;

    for (const instId of instanceIds) {
      console.log(`Processing: ${instId}`);

      try {
        // Get instance metadata
        const tags = (await client.get(`/instances/${instId}/simplified-tags`)).data;
        const info = (await client.get(`/instances/${instId}`)).data;

        const studyUID = tags.StudyInstanceUID;
        const seriesUID = tags.SeriesInstanceUID;
        const sopUID = tags.SOPInstanceUID;
        const frameCount = parseInt(tags.NumberOfFrames) || 1;

        console.log(`  Study: ${studyUID}`);
        console.log(`  Patient: ${tags.PatientName}`);
        console.log(`  Frames: ${frameCount}`);

        // Check if already exists
        const existing = await Instance.countDocuments({ 
          studyInstanceUID: studyUID,
          orthancInstanceId: instId 
        });

        if (existing > 0) {
          console.log(`  ✅ Already synced (${existing} records)\n`);
          skipped += existing;
          continue;
        }

        // Create/update study
        await Study.updateOne(
          { studyInstanceUID: studyUID },
          {
            $set: {
              studyInstanceUID: studyUID,
              studyDate: tags.StudyDate || '',
              studyTime: tags.StudyTime || '',
              patientName: tags.PatientName || 'Unknown',
              patientID: tags.PatientID || 'Unknown',
              patientBirthDate: tags.PatientBirthDate || '',
              patientSex: tags.PatientSex || '',
              modality: tags.Modality || 'OT',
              studyDescription: tags.StudyDescription || '',
              numberOfSeries: 1,
              numberOfInstances: frameCount
            }
          },
          { upsert: true }
        );

        // Create/update series
        await Series.updateOne(
          { studyInstanceUID: studyUID, seriesInstanceUID: seriesUID },
          {
            $set: {
              studyInstanceUID: studyUID,
              seriesInstanceUID: seriesUID,
              modality: tags.Modality || 'OT',
              seriesNumber: parseInt(tags.SeriesNumber) || 1,
              description: tags.SeriesDescription || '',
              orthancSeriesId: info.ParentSeries
            }
          },
          { upsert: true }
        );

        // Create instance records (one per frame)
        const instances = [];
        for (let frameIdx = 0; frameIdx < frameCount; frameIdx++) {
          instances.push({
            studyInstanceUID: studyUID,
            seriesInstanceUID: seriesUID,
            sopInstanceUID: frameCount > 1 ? `${sopUID}.frame${frameIdx}` : sopUID,
            instanceNumber: frameIdx + 1,
            modality: tags.Modality || 'OT',
            rows: parseInt(tags.Rows) || 0,
            columns: parseInt(tags.Columns) || 0,
            numberOfFrames: frameCount,
            bitsAllocated: parseInt(tags.BitsAllocated) || 8,
            samplesPerPixel: parseInt(tags.SamplesPerPixel) || 1,
            photometricInterpretation: tags.PhotometricInterpretation || 'MONOCHROME2',
            
            // Orthanc references
            orthancInstanceId: instId,
            orthancUrl: `${process.env.ORTHANC_URL}/instances/${instId}`,
            orthancFrameIndex: frameIdx,
            orthancSeriesId: info.ParentSeries,
            useOrthancPreview: true,
            
            processed: true,
            filesystemCached: false
          });
        }

        await Instance.insertMany(instances, { ordered: false });
        console.log(`  ✅ Created ${instances.length} instance record(s)\n`);
        created += instances.length;

      } catch (err) {
        if (err.code === 11000) {
          console.log(`  ⚠️  Duplicate key, skipping\n`);
          skipped++;
        } else {
          console.error(`  ❌ Error: ${err.message}\n`);
        }
      }
    }

    console.log('═'.repeat(60));
    console.log('✅ SYNC COMPLETE!\n');
    console.log(`Created: ${created} instances`);
    console.log(`Skipped: ${skipped} instances`);
    
    const totalStudies = await Study.countDocuments({});
    const totalInstances = await Instance.countDocuments({});
    console.log(`\nMongoDB now has:`);
    console.log(`  Studies: ${totalStudies}`);
    console.log(`  Instances: ${totalInstances}`);

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await mongoose.disconnect();
  }
}

sync();
