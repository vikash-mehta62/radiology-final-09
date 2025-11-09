const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

async function list() {
  await mongoose.connect(process.env.MONGODB_URI);
  
  const Study = require('./src/models/Study');
  const Instance = require('./src/models/Instance');

  const studies = await Study.find({}).lean();
  
  console.log(`\nFound ${studies.length} studies:\n`);
  
  for (const study of studies) {
    const instanceCount = await Instance.countDocuments({ studyInstanceUID: study.studyInstanceUID });
    
    console.log(`Study: ${study.studyInstanceUID}`);
    console.log(`  Patient: ${study.patientName}`);
    console.log(`  Date: ${study.studyDate}`);
    console.log(`  Instances: ${instanceCount}`);
    console.log(`  Orthanc Study ID: ${study.orthancStudyId || 'N/A'}`);
    console.log('');
  }
  
  await mongoose.disconnect();
}

list();
