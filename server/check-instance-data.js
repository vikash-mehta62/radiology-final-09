// Check if instances in different series actually have different orthancInstanceIds
const mongoose = require('mongoose');
require('dotenv').config();

const Instance = require('./src/models/Instance');

async function checkInstances() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/dicomdb');
    console.log('✅ Connected to MongoDB\n');

    // First, let's find what studies exist in the database
    const allStudies = await Instance.distinct('studyInstanceUID');
    console.log('📋 Studies in Database:');
    allStudies.forEach((uid, i) => {
      console.log(`   ${i + 1}. ${uid}`);
    });
    console.log('');

    // Use the study from test script
    const STUDY_UID = '1.2.840.113619.2.482.3.2831195393.851.1709524269.885';
    
    // Check if this study exists
    const studyExists = allStudies.includes(STUDY_UID);
    if (!studyExists) {
      console.log(`❌ Study ${STUDY_UID} NOT FOUND in database!`);
      console.log('\n   This study needs to be synced from Orthanc first.');
      console.log('\n   Run: node auto-sync-simple.js\n');
      await mongoose.disconnect();
      return;
    }

    const SERIES = [
      { uid: '1.2.840.113619.2.482.3.2831195393.851.1709524269.888', name: 'SCOUT' },
      { uid: '1.2.840.113619.2.482.3.2831195393.851.1709524269.893', name: 'Pre Contrast Chest' },
      { uid: '1.2.840.113619.2.482.3.2831195393.851.1709524269.893.3', name: 'lung' }
    ];

    console.log('🔍 Checking Instance Data for Each Series\n');
    console.log('═══════════════════════════════════════════════════════\n');

    for (const series of SERIES) {
      console.log(`📊 Series: ${series.name}`);
      console.log(`   UID: ${series.uid}\n`);

      const instances = await Instance.find({
        studyInstanceUID: STUDY_UID,
        seriesInstanceUID: series.uid
      }).limit(3).lean();

      console.log(`   Found ${instances.length} instances (showing first 3):\n`);

      instances.forEach((inst, i) => {
        console.log(`   Instance ${i + 1}:`);
        console.log(`     SOP UID: ${inst.sopInstanceUID}`);
        console.log(`     Orthanc ID: ${inst.orthancInstanceId || 'NOT SET'}`);
        console.log(`     Instance Number: ${inst.instanceNumber}`);
        console.log(`     File Path: ${inst.filePath || 'NOT SET'}`);
        console.log('');
      });

      console.log('───────────────────────────────────────────────────────\n');
    }

    // Check if all instances have the same orthancInstanceId
    console.log('🔍 Checking for Duplicate Orthanc IDs\n');
    
    const allInstances = await Instance.find({
      studyInstanceUID: STUDY_UID
    }).lean();

    const orthancIds = allInstances
      .filter(i => i.orthancInstanceId)
      .map(i => i.orthancInstanceId);

    const uniqueOrthancIds = new Set(orthancIds);

    console.log(`Total instances: ${allInstances.length}`);
    console.log(`Instances with Orthanc ID: ${orthancIds.length}`);
    console.log(`Unique Orthanc IDs: ${uniqueOrthancIds.size}\n`);

    if (uniqueOrthancIds.size === 1) {
      console.log('❌ PROBLEM FOUND: All instances have the SAME Orthanc ID!');
      console.log(`   Orthanc ID: ${[...uniqueOrthancIds][0]}`);
      console.log('\n   This means all series will return the same image!');
      console.log('   Solution: Re-sync study from Orthanc\n');
    } else if (uniqueOrthancIds.size < allInstances.length) {
      console.log('⚠️ WARNING: Some instances share Orthanc IDs');
      console.log(`   Expected: ${allInstances.length} unique IDs`);
      console.log(`   Found: ${uniqueOrthancIds.size} unique IDs\n`);
    } else {
      console.log('✅ All instances have unique Orthanc IDs');
      console.log('   Problem is likely in backend filtering logic\n');
    }

    // Check first instance of each series
    console.log('═══════════════════════════════════════════════════════\n');
    console.log('🔍 First Instance of Each Series (Frame 0):\n');

    for (const series of SERIES) {
      const firstInstance = await Instance.findOne({
        studyInstanceUID: STUDY_UID,
        seriesInstanceUID: series.uid
      }).sort({ instanceNumber: 1 }).lean();

      if (firstInstance) {
        console.log(`${series.name}:`);
        console.log(`  Orthanc ID: ${firstInstance.orthancInstanceId || 'NOT SET'}`);
        console.log(`  SOP UID: ${firstInstance.sopInstanceUID}`);
        console.log('');
      } else {
        console.log(`${series.name}: NO INSTANCES FOUND`);
        console.log('');
      }
    }

    await mongoose.disconnect();
    console.log('✅ Disconnected from MongoDB');

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

checkInstances();
