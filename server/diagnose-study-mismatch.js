#!/usr/bin/env node

const mongoose = require('mongoose');
const axios = require('axios');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const Study = require('./src/models/Study');
const Instance = require('./src/models/Instance');

const client = axios.create({
  baseURL: process.env.ORTHANC_URL || 'http://69.62.70.102:8042',
  auth: {
    username: process.env.ORTHANC_USERNAME || 'orthanc',
    password: process.env.ORTHANC_PASSWORD || 'orthanc'
  }
});

async function diagnose() {
  console.log('🔍 DIAGNOSING STUDY ID MISMATCH\n');
  console.log('═'.repeat(70));

  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    // Get all instances from Orthanc
    const orthancInstanceIds = (await client.get('/instances')).data;
    console.log(`📊 Orthanc has ${orthancInstanceIds.length} instances\n`);

    for (const orthancInstanceId of orthancInstanceIds) {
      console.log('─'.repeat(70));
      console.log(`\nOrthanc Instance ID: ${orthancInstanceId}\n`);

      // Get instance info from Orthanc
      const tags = (await client.get(`/instances/${orthancInstanceId}/simplified-tags`)).data;
      const info = (await client.get(`/instances/${orthancInstanceId}`)).data;

      const dicomStudyUID = tags.StudyInstanceUID;
      const orthancStudyId = info.ParentStudy;

      console.log('DICOM Study UID (from tags):');
      console.log(`  ${dicomStudyUID}`);
      console.log('\nOrthanc Study ID (internal):');
      console.log(`  ${orthancStudyId || 'UNDEFINED'}`);

      // Check MongoDB
      console.log('\n📊 MongoDB Check:');
      
      // Check by DICOM Study UID
      const studyByUID = await Study.findOne({ studyInstanceUID: dicomStudyUID });
      if (studyByUID) {
        console.log(`  ✅ Study found by DICOM UID`);
        console.log(`     orthancStudyId in MongoDB: ${studyByUID.orthancStudyId || 'NOT SET'}`);
      } else {
        console.log(`  ❌ Study NOT found by DICOM UID`);
      }

      // Check instances
      const instances = await Instance.find({ studyInstanceUID: dicomStudyUID });
      console.log(`  Instances in MongoDB: ${instances.length}`);
      
      if (instances.length > 0) {
        console.log(`     orthancInstanceId: ${instances[0].orthancInstanceId || 'NOT SET'}`);
        console.log(`     orthancStudyId: ${instances[0].orthancStudyId || 'NOT SET'}`);
      }

      console.log('\n🔍 ISSUE ANALYSIS:');
      
      if (!orthancStudyId) {
        console.log('  ⚠️  Orthanc Study ID is UNDEFINED');
        console.log('     This means Orthanc doesn\'t have a study-level object');
        console.log('     Only the instance exists');
      }

      if (studyByUID && !studyByUID.orthancStudyId) {
        console.log('  ⚠️  MongoDB Study exists but has NO orthancStudyId');
        console.log('     Need to update MongoDB with Orthanc Study ID');
      }

      if (instances.length === 0) {
        console.log('  ⚠️  No instances in MongoDB for this study');
        console.log('     Need to create instance records');
      }

      console.log('\n💡 SOLUTION:');
      console.log('  1. Use DICOM Study UID as primary identifier');
      console.log('  2. Store Orthanc Study ID in MongoDB (if available)');
      console.log('  3. Use orthancInstanceId for frame rendering');
      console.log('  4. Don\'t rely on Orthanc Study ID for queries');
    }

    console.log('\n\n' + '═'.repeat(70));
    console.log('📋 SUMMARY\n');

    const totalStudies = await Study.countDocuments({});
    const studiesWithOrthancId = await Study.countDocuments({ orthancStudyId: { $exists: true, $ne: null } });
    const totalInstances = await Instance.countDocuments({});
    const instancesWithOrthancId = await Instance.countDocuments({ orthancInstanceId: { $exists: true, $ne: null } });

    console.log(`MongoDB Studies: ${totalStudies}`);
    console.log(`  With orthancStudyId: ${studiesWithOrthancId}`);
    console.log(`  Without orthancStudyId: ${totalStudies - studiesWithOrthancId}`);
    console.log('');
    console.log(`MongoDB Instances: ${totalInstances}`);
    console.log(`  With orthancInstanceId: ${instancesWithOrthancId}`);
    console.log(`  Without orthancInstanceId: ${totalInstances - instancesWithOrthancId}`);

    console.log('\n✅ Diagnosis complete!');

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await mongoose.disconnect();
  }
}

diagnose();
