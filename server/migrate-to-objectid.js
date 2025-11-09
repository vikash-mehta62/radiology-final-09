/**
 * Migration Script: String hospitalId to ObjectId
 * 
 * This script converts all string hospitalIds (like "HOSP001") 
 * to proper MongoDB ObjectId references
 */

require('dotenv').config();
const mongoose = require('mongoose');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/dicomdb';

// Define schemas inline
const HospitalSchema = new mongoose.Schema({
  hospitalId: { type: String, required: true, unique: true },
  name: { type: String, required: true }
});

const PatientSchema = new mongoose.Schema({
  patientID: { type: String, unique: true },
  patientName: String,
  hospitalId: mongoose.Schema.Types.Mixed  // Allow both string and ObjectId during migration
});

const StudySchema = new mongoose.Schema({
  studyInstanceUID: { type: String, unique: true },
  patientID: String,
  hospitalId: mongoose.Schema.Types.Mixed  // Allow both string and ObjectId during migration
});

const UserSchema = new mongoose.Schema({
  username: { type: String, unique: true },
  email: { type: String, unique: true },
  hospitalId: mongoose.Schema.Types.Mixed  // Allow both string and ObjectId during migration
});

const Hospital = mongoose.model('Hospital', HospitalSchema);
const Patient = mongoose.model('Patient', PatientSchema);
const Study = mongoose.model('Study', StudySchema);
const User = mongoose.model('User', UserSchema);

async function migrateToObjectId() {
  try {
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    // Get all hospitals
    const hospitals = await Hospital.find({});
    console.log(`📋 Found ${hospitals.length} hospitals\n`);

    if (hospitals.length === 0) {
      console.log('⚠️  No hospitals found. Please run seed script first.');
      return;
    }

    let totalUpdated = 0;

    for (const hospital of hospitals) {
      const hospitalIdString = hospital.hospitalId; // e.g., "HOSP001"
      const hospitalObjectId = hospital._id;

      console.log(`\n🏥 Processing Hospital: ${hospital.name} (${hospitalIdString})`);
      console.log(`   ObjectId: ${hospitalObjectId}`);

      // 1. Update Patients
      console.log('\n   👥 Migrating Patients...');
      const patientsResult = await Patient.updateMany(
        { hospitalId: hospitalIdString },
        { $set: { hospitalId: hospitalObjectId } }
      );
      console.log(`      ✅ Updated ${patientsResult.modifiedCount} patients`);
      totalUpdated += patientsResult.modifiedCount;

      // 2. Update Studies
      console.log('   📚 Migrating Studies...');
      const studiesResult = await Study.updateMany(
        { hospitalId: hospitalIdString },
        { $set: { hospitalId: hospitalObjectId } }
      );
      console.log(`      ✅ Updated ${studiesResult.modifiedCount} studies`);
      totalUpdated += studiesResult.modifiedCount;

      // 3. Update Users
      console.log('   👤 Migrating Users...');
      const usersResult = await User.updateMany(
        { hospitalId: hospitalIdString },
        { $set: { hospitalId: hospitalObjectId } }
      );
      console.log(`      ✅ Updated ${usersResult.modifiedCount} users`);
      totalUpdated += usersResult.modifiedCount;
    }

    // 4. Clean up null/undefined hospitalIds
    console.log('\n\n🧹 Cleaning up null/undefined hospitalIds...');
    
    const patientsNullResult = await Patient.updateMany(
      { hospitalId: { $in: [null, undefined, ''] } },
      { $unset: { hospitalId: '' } }
    );
    console.log(`   ✅ Cleaned ${patientsNullResult.modifiedCount} patients`);

    const studiesNullResult = await Study.updateMany(
      { hospitalId: { $in: [null, undefined, ''] } },
      { $unset: { hospitalId: '' } }
    );
    console.log(`   ✅ Cleaned ${studiesNullResult.modifiedCount} studies`);

    // 5. Verification
    console.log('\n\n✅ Migration Complete!');
    console.log('='.repeat(60));
    console.log(`Total documents updated: ${totalUpdated}`);
    console.log('='.repeat(60));

    // Show sample data
    console.log('\n📊 Sample Data After Migration:\n');
    
    const samplePatient = await Patient.findOne({ hospitalId: { $exists: true } });
    if (samplePatient) {
      console.log('Sample Patient:');
      console.log(`  patientID: ${samplePatient.patientID}`);
      console.log(`  hospitalId: ${samplePatient.hospitalId} (${typeof samplePatient.hospitalId})`);
      console.log(`  hospitalId type: ${samplePatient.hospitalId.constructor.name}`);
    }

    const sampleStudy = await Study.findOne({ hospitalId: { $exists: true } });
    if (sampleStudy) {
      console.log('\nSample Study:');
      console.log(`  studyInstanceUID: ${sampleStudy.studyInstanceUID}`);
      console.log(`  hospitalId: ${sampleStudy.hospitalId} (${typeof sampleStudy.hospitalId})`);
      console.log(`  hospitalId type: ${sampleStudy.hospitalId.constructor.name}`);
    }

    const sampleUser = await User.findOne({ hospitalId: { $exists: true } });
    if (sampleUser) {
      console.log('\nSample User:');
      console.log(`  username: ${sampleUser.username}`);
      console.log(`  hospitalId: ${sampleUser.hospitalId} (${typeof sampleUser.hospitalId})`);
      console.log(`  hospitalId type: ${sampleUser.hospitalId.constructor.name}`);
    }

    console.log('\n' + '='.repeat(60));
    console.log('✅ Migration successful! You can now restart your server.');
    console.log('='.repeat(60) + '\n');

  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    console.error('\nError details:', error.message);
    
    if (error.name === 'CastError') {
      console.error('\n⚠️  CastError detected. This might mean:');
      console.error('   1. Some documents already have ObjectId (partially migrated)');
      console.error('   2. Invalid hospitalId values in database');
      console.error('\n💡 Try running the cleanup script first or check your data.');
    }
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  }
}

// Run migration
console.log('🚀 Starting Migration: String hospitalId → ObjectId');
console.log('='.repeat(60) + '\n');

migrateToObjectId().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
