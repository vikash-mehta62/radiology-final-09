const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const Study = require('./src/models/Study');
const Instance = require('./src/models/Instance');

async function verify() {
  await mongoose.connect(process.env.MONGODB_URI);
  
  console.log('\n🔍 VERIFICATION REPORT\n');
  console.log('═'.repeat(60));
  
  // Get all studies with instances
  const studies = await Study.find({}).lean();
  
  console.log(`\nTotal Studies in MongoDB: ${studies.length}\n`);
  
  for (const study of studies) {
    const instances = await Instance.find({ studyInstanceUID: study.studyInstanceUID }).lean();
    
    if (instances.length > 0) {
      console.log(`✅ ${study.studyInstanceUID}`);
      console.log(`   Patient: ${study.patientName}`);
      console.log(`   Date: ${study.studyDate}`);
      console.log(`   Instances: ${instances.length}`);
      console.log(`   Orthanc Instance ID: ${instances[0].orthancInstanceId}`);
      console.log(`   Orthanc URL: ${instances[0].orthancUrl}`);
      console.log('');
    } else {
      console.log(`⚠️  ${study.studyInstanceUID}`);
      console.log(`   Patient: ${study.patientName}`);
      console.log(`   Date: ${study.studyDate}`);
      console.log(`   Instances: 0 (NOT SYNCED)`);
      console.log('');
    }
  }
  
  const totalInstances = await Instance.countDocuments({});
  const studiesWithInstances = await Study.countDocuments({});
  
  console.log('═'.repeat(60));
  console.log('\nSummary:');
  console.log(`  Total Studies: ${studies.length}`);
  console.log(`  Studies with Instances: ${studies.filter(async s => {
    const count = await Instance.countDocuments({ studyInstanceUID: s.studyInstanceUID });
    return count > 0;
  }).length}`);
  console.log(`  Total Instances: ${totalInstances}`);
  
  await mongoose.disconnect();
}

verify();
