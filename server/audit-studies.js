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

async function auditStudies() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');
    
    // Get all studies from MongoDB
    const studies = await Study.find({}).lean();
    console.log(`Found ${studies.length} studies in MongoDB\n`);
    
    // Get all studies from Orthanc
    let orthancStudies = [];
    try {
      const resp = await axios.get(`${ORTHANC_URL}/studies`, { auth: ORTHANC_AUTH });
      orthancStudies = resp.data;
      console.log(`Found ${orthancStudies.length} studies in Orthanc\n`);
    } catch (error) {
      console.error(`❌ Could not connect to Orthanc: ${error.message}\n`);
    }
    
    // Build Orthanc study map
    const orthancMap = new Map();
    for (const studyId of orthancStudies) {
      try {
        const info = await axios.get(`${ORTHANC_URL}/studies/${studyId}`, { auth: ORTHANC_AUTH });
        const studyUID = info.data.MainDicomTags.StudyInstanceUID;
        orthancMap.set(studyUID, {
          orthancId: studyId,
          instances: info.data.Instances.length
        });
      } catch (error) {
        console.warn(`⚠️  Could not get info for Orthanc study ${studyId}`);
      }
    }
    
    console.log('='.repeat(80));
    console.log('\n📊 Study Audit Report\n');
    console.log('='.repeat(80));
    
    const report = {
      total: studies.length,
      healthy: 0,
      missingInstances: 0,
      missingInOrthanc: 0,
      needsReupload: 0
    };
    
    const needsReupload = [];
    
    for (const study of studies) {
      const instanceCount = await Instance.countDocuments({ studyInstanceUID: study.studyInstanceUID });
      const inOrthanc = orthancMap.has(study.studyInstanceUID);
      
      let status = '✅ HEALTHY';
      let issues = [];
      
      if (instanceCount === 0) {
        issues.push('No Instance records in MongoDB');
        report.missingInstances++;
      }
      
      if (!inOrthanc) {
        issues.push('Not found in Orthanc PACS');
        report.missingInOrthanc++;
      }
      
      if (instanceCount === 0 && !inOrthanc) {
        status = '❌ NEEDS RE-UPLOAD';
        report.needsReupload++;
        needsReupload.push({
          studyUID: study.studyInstanceUID,
          patient: study.patientName,
          patientID: study.patientID,
          date: study.studyDate,
          modality: study.modality
        });
      } else if (issues.length > 0) {
        status = '⚠️  NEEDS ATTENTION';
      } else {
        report.healthy++;
      }
      
      if (issues.length > 0) {
        console.log(`\n${status}`);
        console.log(`Study: ${study.studyInstanceUID}`);
        console.log(`Patient: ${study.patientName} (${study.patientID})`);
        console.log(`Date: ${study.studyDate} | Modality: ${study.modality}`);
        console.log(`Instances in MongoDB: ${instanceCount}`);
        console.log(`In Orthanc: ${inOrthanc ? 'Yes' : 'No'}`);
        if (issues.length > 0) {
          console.log(`Issues:`);
          issues.forEach(issue => console.log(`  - ${issue}`));
        }
      }
    }
    
    console.log('\n' + '='.repeat(80));
    console.log('\n📈 Summary Statistics\n');
    console.log(`Total Studies: ${report.total}`);
    console.log(`Healthy: ${report.healthy} (${((report.healthy/report.total)*100).toFixed(1)}%)`);
    console.log(`Missing Instances: ${report.missingInstances}`);
    console.log(`Missing in Orthanc: ${report.missingInOrthanc}`);
    console.log(`Needs Re-upload: ${report.needsReupload}`);
    
    if (needsReupload.length > 0) {
      console.log('\n' + '='.repeat(80));
      console.log('\n🔄 Studies That Need Re-uploading:\n');
      needsReupload.forEach((study, i) => {
        console.log(`${i + 1}. ${study.patient} (${study.patientID})`);
        console.log(`   Study UID: ${study.studyUID}`);
        console.log(`   Date: ${study.date} | Modality: ${study.modality}`);
        console.log('');
      });
    }
    
    console.log('='.repeat(80));
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Audit failed:', error);
    process.exit(1);
  }
}

auditStudies();
