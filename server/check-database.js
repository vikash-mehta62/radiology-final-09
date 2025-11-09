// Quick MongoDB check script
// Run with: node check-database.js

const mongoose = require('mongoose');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://mahitechnocrats:qNfbRMgnCthyu59@cluster1.xqa5iyj.mongodb.net/radiology-final-21-10';
const STUDY_UID = '1.2.840.113619.2.482.3.2831195393.851.1709524269.885';

async function checkDatabase() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    const Instance = mongoose.model('Instance', new mongoose.Schema({}, { strict: false, collection: 'instances' }));

    // Count instances per series
    console.log('📊 Instances per Series:');
    console.log('========================\n');
    
    const seriesCounts = await Instance.aggregate([
      { $match: { studyInstanceUID: STUDY_UID } },
      { 
        $group: { 
          _id: '$seriesInstanceUID', 
          count: { $sum: 1 },
          orthancSeriesId: { $first: '$orthancSeriesId' }
        } 
      },
      { $sort: { _id: 1 } }
    ]);

    if (seriesCounts.length === 0) {
      console.log('❌ NO INSTANCES FOUND!');
      console.log('Study needs to be synced from Orthanc.\n');
      process.exit(1);
    }

    seriesCounts.forEach((series, index) => {
      console.log(`Series ${index + 1}:`);
      console.log(`  UID: ${series._id}`);
      console.log(`  Orthanc Series ID: ${series.orthancSeriesId || 'N/A'}`);
      console.log(`  Instance Count: ${series.count}`);
      console.log('');
    });

    // Check if all instances have same seriesInstanceUID (problem!)
    if (seriesCounts.length === 1) {
      console.log('❌ PROBLEM FOUND!');
      console.log('All instances have the SAME seriesInstanceUID!');
      console.log('This is why all series show same images.\n');
      console.log('SOLUTION: Re-sync study from Orthanc');
      console.log('Run: node auto-sync-simple.js\n');
    } else {
      console.log('✅ Multiple series found - database looks correct!');
      console.log('Problem might be in frontend/backend routing.\n');
      
      // Show sample instances from each series
      console.log('📋 Sample Instances:');
      console.log('===================\n');
      
      for (const series of seriesCounts) {
        const samples = await Instance.find({ 
          studyInstanceUID: STUDY_UID,
          seriesInstanceUID: series._id 
        }).limit(3).lean();
        
        console.log(`Series: ${series._id.substring(series._id.length - 10)}`);
        samples.forEach(inst => {
          console.log(`  Instance ${inst.instanceNumber}: Orthanc ID = ${inst.orthancInstanceId}`);
        });
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

checkDatabase();
