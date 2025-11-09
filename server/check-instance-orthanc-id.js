const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const mongoose = require('mongoose');
const Instance = require('./src/models/Instance');

async function checkInstances() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/radiology');
    console.log('✅ Connected to MongoDB');
    
    const studyUID = '1.3.6.1.4.1.16568.1760629278470.775947117';
    
    const instances = await Instance.find({ studyInstanceUID: studyUID })
      .sort({ instanceNumber: 1 })
      .limit(3)
      .lean();
    
    console.log(`\nFound ${instances.length} instances for study ${studyUID}`);
    
    if (instances.length > 0) {
      console.log('\nFirst instance:');
      console.log('  instanceNumber:', instances[0].instanceNumber);
      console.log('  orthancInstanceId:', instances[0].orthancInstanceId);
      console.log('  orthancUrl:', instances[0].orthancUrl);
      console.log('  numberOfFrames:', instances[0].numberOfFrames);
      console.log('  sopInstanceUID:', instances[0].sopInstanceUID);
      
      const withOrthanc = instances.filter(i => i.orthancInstanceId).length;
      console.log(`\n${withOrthanc} out of ${instances.length} instances have orthancInstanceId`);
    }
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

checkInstances();
