#!/usr/bin/env node

/**
 * Test Upload Flow - Complete Verification
 * Tests the entire upload workflow from DICOM file to MongoDB storage
 */

const mongoose = require('mongoose');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const Study = require('./src/models/Study');
const Series = require('./src/models/Series');
const Instance = require('./src/models/Instance');

const orthancClient = axios.create({
  baseURL: process.env.ORTHANC_URL || 'http://69.62.70.102:8042',
  auth: {
    username: process.env.ORTHANC_USERNAME || 'orthanc',
    password: process.env.ORTHANC_PASSWORD || 'orthanc'
  }
});

async function testUploadFlow() {
  console.log('🧪 TESTING UPLOAD FLOW\n');
  console.log('═'.repeat(70));

  try {
    // Step 1: Connect to MongoDB
    console.log('\n📊 STEP 1: Connect to MongoDB');
    console.log('─'.repeat(70));
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    // Step 2: Check Orthanc
    console.log('🏥 STEP 2: Check Orthanc PACS');
    console.log('─'.repeat(70));
    const stats = (await orthancClient.get('/statistics')).data;
    console.log(`✅ Orthanc is running`);
    console.log(`   Studies: ${stats.CountStudies}`);
    console.log(`   Instances: ${stats.CountInstances}\n`);

    // Step 3: Get latest instance from Orthanc
    console.log('📋 STEP 3: Get Latest Instance from Orthanc');
    console.log('─'.repeat(70));
    
    const instanceIds = (await orthancClient.get('/instances')).data;
    
    if (instanceIds.length === 0) {
      console.log('❌ No instances in Orthanc');
      console.log('   Please upload a DICOM file first\n');
      return;
    }

    const latestInstanceId = instanceIds[instanceIds.length - 1];
    console.log(`Latest Orthanc Instance ID: ${latestInstanceId}\n`);

    // Get instance details
    const tags = (await orthancClient.get(`/instances/${latestInstanceId}/simplified-tags`)).data;
    const info = (await orthancClient.get(`/instances/${latestInstanceId}`)).data;

    console.log('DICOM Tags:');
    console.log(`  Study UID: ${tags.StudyInstanceUID}`);
    console.log(`  Series UID: ${tags.SeriesInstanceUID}`);
    console.log(`  SOP Instance UID: ${tags.SOPInstanceUID}`);
    console.log(`  Patient: ${tags.PatientName}`);
    console.log(`  Modality: ${tags.Modality}`);
    console.log(`  Frames: ${tags.NumberOfFrames || 1}\n`);

    console.log('Orthanc IDs:');
    console.log(`  Instance ID: ${latestInstanceId}`);
    console.log(`  Study ID: ${info.ParentStudy || 'UNDEFINED'}`);
    console.log(`  Series ID: ${info.ParentSeries || 'UNDEFINED'}\n`);

    const studyUID = tags.StudyInstanceUID;
    const seriesUID = tags.SeriesInstanceUID;
    const sopUID = tags.SOPInstanceUID;

    // Step 4: Check MongoDB Study
    console.log('📊 STEP 4: Check MongoDB Study');
    console.log('─'.repeat(70));
    
    const study = await Study.findOne({ studyInstanceUID: studyUID });
    
    if (study) {
      console.log('✅ Study exists in MongoDB:');
      console.log(`   Study UID: ${study.studyInstanceUID}`);
      console.log(`   Patient: ${study.patientName}`);
      console.log(`   Date: ${study.studyDate}`);
      console.log(`   Orthanc Study ID: ${study.orthancStudyId || 'NOT SET'}`);
      console.log(`   Number of Instances: ${study.numberOfInstances || 0}\n`);
    } else {
      console.log('❌ Study NOT found in MongoDB');
      console.log('   This indicates upload did not save study\n');
    }

    // Step 5: Check MongoDB Series
    console.log('📊 STEP 5: Check MongoDB Series');
    console.log('─'.repeat(70));
    
    const series = await Series.findOne({ studyInstanceUID: studyUID, seriesInstanceUID: seriesUID });
    
    if (series) {
      console.log('✅ Series exists in MongoDB:');
      console.log(`   Series UID: ${series.seriesInstanceUID}`);
      console.log(`   Modality: ${series.modality}`);
      console.log(`   Orthanc Series ID: ${series.orthancSeriesId || 'NOT SET'}\n`);
    } else {
      console.log('❌ Series NOT found in MongoDB');
      console.log('   This indicates upload did not save series\n');
    }

    // Step 6: Check MongoDB Instances
    console.log('📊 STEP 6: Check MongoDB Instances');
    console.log('─'.repeat(70));
    
    const instances = await Instance.find({ studyInstanceUID: studyUID }).sort({ instanceNumber: 1 });
    
    if (instances.length > 0) {
      console.log(`✅ Found ${instances.length} instance(s) in MongoDB:\n`);
      
      instances.forEach((inst, idx) => {
        console.log(`   Instance ${idx + 1}:`);
        console.log(`     SOP UID: ${inst.sopInstanceUID}`);
        console.log(`     Instance Number: ${inst.instanceNumber}`);
        console.log(`     Orthanc Instance ID: ${inst.orthancInstanceId || 'NOT SET'}`);
        console.log(`     Orthanc URL: ${inst.orthancUrl || 'NOT SET'}`);
        console.log(`     Orthanc Frame Index: ${inst.orthancFrameIndex}`);
        console.log(`     Dimensions: ${inst.rows}x${inst.columns}`);
        console.log(`     Frames: ${inst.numberOfFrames}\n`);
      });
    } else {
      console.log('❌ NO instances found in MongoDB');
      console.log('   This is the PROBLEM - instances are not being saved!\n');
    }

    // Step 7: Diagnosis
    console.log('🔍 STEP 7: Diagnosis');
    console.log('─'.repeat(70));

    const issues = [];
    const fixes = [];

    if (!study) {
      issues.push('Study not in MongoDB');
      fixes.push('Upload controller may not be saving study');
    } else if (!study.orthancStudyId) {
      issues.push('Study missing orthancStudyId');
      fixes.push('Need to update study with Orthanc Study ID');
    }

    if (!series) {
      issues.push('Series not in MongoDB');
      fixes.push('Upload controller may not be saving series');
    } else if (!series.orthancSeriesId) {
      issues.push('Series missing orthancSeriesId');
      fixes.push('Need to update series with Orthanc Series ID');
    }

    if (instances.length === 0) {
      issues.push('⚠️  CRITICAL: Instances not in MongoDB');
      fixes.push('Upload controller Instance.insertMany() may be failing');
      fixes.push('Check server logs for errors during upload');
      fixes.push('Verify Instance model schema');
    } else {
      const missingOrthanc = instances.filter(i => !i.orthancInstanceId);
      if (missingOrthanc.length > 0) {
        issues.push(`${missingOrthanc.length} instances missing orthancInstanceId`);
        fixes.push('Need to update instances with Orthanc Instance ID');
      }
    }

    if (issues.length === 0) {
      console.log('✅ NO ISSUES FOUND - Everything is working correctly!\n');
    } else {
      console.log('❌ ISSUES FOUND:\n');
      issues.forEach((issue, idx) => {
        console.log(`   ${idx + 1}. ${issue}`);
      });
      
      console.log('\n💡 RECOMMENDED FIXES:\n');
      fixes.forEach((fix, idx) => {
        console.log(`   ${idx + 1}. ${fix}`);
      });
      console.log('');
    }

    // Step 8: Test Frame Rendering
    if (instances.length > 0 && instances[0].orthancInstanceId) {
      console.log('🖼️  STEP 8: Test Frame Rendering');
      console.log('─'.repeat(70));

      const testInstance = instances[0];
      const frameUrl = `/instances/${testInstance.orthancInstanceId}/frames/${testInstance.orthancFrameIndex}/rendered?quality=100`;

      try {
        console.log(`Testing: ${frameUrl}`);
        const response = await orthancClient.get(frameUrl, { responseType: 'arraybuffer' });
        const size = response.data.byteLength;
        
        console.log(`✅ Frame rendering works!`);
        console.log(`   Size: ${(size / 1024).toFixed(2)} KB`);
        console.log(`   Content-Type: ${response.headers['content-type']}\n`);
      } catch (e) {
        console.log(`❌ Frame rendering failed: ${e.message}\n`);
      }
    }

    // Summary
    console.log('═'.repeat(70));
    console.log('📋 SUMMARY\n');

    const totalStudies = await Study.countDocuments({});
    const totalSeries = await Series.countDocuments({});
    const totalInstances = await Instance.countDocuments({});

    console.log('MongoDB Status:');
    console.log(`  Total Studies: ${totalStudies}`);
    console.log(`  Total Series: ${totalSeries}`);
    console.log(`  Total Instances: ${totalInstances}\n`);

    console.log('Orthanc Status:');
    console.log(`  Total Studies: ${stats.CountStudies}`);
    console.log(`  Total Instances: ${stats.CountInstances}\n`);

    if (totalInstances === 0 && stats.CountInstances > 0) {
      console.log('⚠️  CRITICAL ISSUE: Orthanc has instances but MongoDB has NONE');
      console.log('   This means the upload flow is NOT saving instances to MongoDB\n');
      console.log('   ACTION REQUIRED:');
      console.log('   1. Check server logs during upload for errors');
      console.log('   2. Verify uploadController.js is being used');
      console.log('   3. Run sync script: node server/sync-simple.js');
    } else if (totalInstances < stats.CountInstances) {
      console.log('⚠️  WARNING: MongoDB has fewer instances than Orthanc');
      console.log(`   Missing: ${stats.CountInstances - totalInstances} instances\n`);
      console.log('   ACTION: Run sync script: node server/sync-simple.js');
    } else {
      console.log('✅ MongoDB and Orthanc are in sync!');
    }

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error(error.stack);
  } finally {
    await mongoose.disconnect();
    console.log('\n👋 Disconnected from MongoDB');
  }
}

testUploadFlow();
