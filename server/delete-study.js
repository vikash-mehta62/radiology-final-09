const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const mongoose = require('mongoose');
const Study = require('./src/models/Study');
const Instance = require('./src/models/Instance');
const Series = require('./src/models/Series');

async function deleteStudy(studyUID) {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    
    console.log(`\n🗑️  Deleting study: ${studyUID}\n`);
    
    // Delete instances
    const instanceResult = await Instance.deleteMany({ studyInstanceUID: studyUID });
    console.log(`   Deleted ${instanceResult.deletedCount} instances`);
    
    // Delete series
    const seriesResult = await Series.deleteMany({ studyInstanceUID: studyUID });
    console.log(`   Deleted ${seriesResult.deletedCount} series`);
    
    // Delete study
    const studyResult = await Study.deleteOne({ studyInstanceUID: studyUID });
    console.log(`   Deleted ${studyResult.deletedCount} study`);
    
    console.log('\n✅ Study deleted from MongoDB');
    console.log('\nNote: This does NOT delete from Orthanc PACS');
    console.log('If the study exists in Orthanc, delete it manually or it will be re-imported\n');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

const studyUID = process.argv[2] || '1.3.6.1.4.1.16568.1760630179137.704401494';
deleteStudy(studyUID);
