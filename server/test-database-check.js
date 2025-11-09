#!/usr/bin/env node

/**
 * Quick Database Check
 * Shows what's actually in MongoDB
 */

const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const Study = require('./src/models/Study');
const Instance = require('./src/models/Instance');

async function checkDatabase() {
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/dicomdb';
    console.log(`🔗 Connecting to MongoDB...`);
    console.log(`   URI: ${mongoUri.replace(/\/\/[^:]+:[^@]+@/, '//***:***@')}\n`);
    
    // Connect to MongoDB
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB\n');

    // Check all studies
    const studies = await Study.find({}).lean();
    console.log(`📊 Total Studies in Database: ${studies.length}\n`);

    if (studies.length === 0) {
      console.log('❌ No studies found in database!');
      console.log('   This means no uploads have been completed successfully.\n');
      process.exit(0);
    }

    // Show each study
    for (const study of studies) {
      console.log(`Study: ${study.studyInstanceUID}`);
      console.log(`  Patient: ${study.patientName} (${study.patientID})`);
      console.log(`  Modality: ${study.modality}`);
      console.log(`  Date: ${study.studyDate}`);
      console.log(`  Instances: ${study.numberOfInstances}`);
      console.log(`  Orthanc Study ID: ${study.orthancStudyId || 'NOT SET'}`);

      // Check instances for this study
      const instances = await Instance.find({ studyInstanceUID: study.studyInstanceUID }).lean();
      console.log(`  Instances in DB: ${instances.length}`);

      if (instances.length > 0) {
        console.log(`  First Instance:`);
        console.log(`    - SOP UID: ${instances[0].sopInstanceUID}`);
        console.log(`    - Instance Number: ${instances[0].instanceNumber}`);
        console.log(`    - Orthanc Instance ID: ${instances[0].orthancInstanceId || 'NOT SET'}`);
        console.log(`    - Orthanc Frame Index: ${instances[0].orthancFrameIndex}`);
        console.log(`    - Use Orthanc Preview: ${instances[0].useOrthancPreview}`);
      } else {
        console.log(`  ❌ NO INSTANCES FOUND FOR THIS STUDY!`);
      }

      console.log('');
    }

    // Check for orphaned instances (instances without a study)
    const allInstances = await Instance.find({}).lean();
    console.log(`📊 Total Instances in Database: ${allInstances.length}\n`);

    const studyUIDs = new Set(studies.map(s => s.studyInstanceUID));
    const orphanedInstances = allInstances.filter(inst => !studyUIDs.has(inst.studyInstanceUID));

    if (orphanedInstances.length > 0) {
      console.log(`⚠️  Found ${orphanedInstances.length} orphaned instances (no matching study):`);
      orphanedInstances.forEach(inst => {
        console.log(`  - Study UID: ${inst.studyInstanceUID}`);
        console.log(`    Instance: ${inst.sopInstanceUID}`);
        console.log(`    Orthanc ID: ${inst.orthancInstanceId || 'NOT SET'}`);
      });
      console.log('');
    }

  } catch (error) {
    console.error('\n❌ Error:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
  }
}

checkDatabase();
