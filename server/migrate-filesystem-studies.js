/**
 * Migration Script: Import Filesystem Studies to MongoDB
 * 
 * This script scans the uploaded_studies directory and creates
 * database entries for existing studies that were uploaded before
 * MongoDB integration.
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const Study = require('./src/models/Study');
const Instance = require('./src/models/Instance');

// Paths
const BACKEND_DIR = path.resolve(__dirname, 'backend');
const UPLOADED_STUDIES_DIR = path.join(BACKEND_DIR, 'uploaded_studies');

// MongoDB Connection
async function connectDB() {
  const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/dicomdb';
  await mongoose.connect(uri);
  console.log('✅ Connected to MongoDB');
}

// Count frames for a study
function countFrames(studyInstanceUID) {
  try {
    const framesDir = path.join(BACKEND_DIR, `uploaded_frames_${studyInstanceUID}`);
    if (!fs.existsSync(framesDir)) return 0;
    
    const files = fs.readdirSync(framesDir);
    return files.filter(f => f.toLowerCase().endsWith('.png')).length;
  } catch (e) {
    console.warn(`⚠️  Could not count frames for ${studyInstanceUID}:`, e.message);
    return 0;
  }
}

// Get study directory path
function getStudyDir(studyInstanceUID) {
  return path.join(UPLOADED_STUDIES_DIR, studyInstanceUID);
}

// Check if study exists in database
async function studyExistsInDB(studyInstanceUID) {
  const count = await Study.countDocuments({ studyInstanceUID });
  return count > 0;
}

// Create study entry in database
async function createStudyEntry(studyInstanceUID, numberOfFrames) {
  const study = new Study({
    studyInstanceUID,
    patientName: 'Imported Study',
    patientID: 'IMP-' + studyInstanceUID.split('.').pop().substring(0, 8),
    modality: 'XA', // Default modality
    studyDate: new Date().toISOString().split('T')[0].replace(/-/g, ''),
    studyTime: '120000',
    studyDescription: 'Migrated from filesystem',
    numberOfSeries: 1,
    numberOfInstances: numberOfFrames,
  });
  
  await study.save();
  console.log(`  ✅ Created study entry: ${studyInstanceUID}`);
  
  return study;
}

// Create instance entry for study
async function createInstanceEntry(studyInstanceUID, numberOfFrames) {
  const instance = new Instance({
    studyInstanceUID,
    seriesInstanceUID: `${studyInstanceUID}.1`,
    sopInstanceUID: `${studyInstanceUID}.1.1`,
    instanceNumber: 1,
    numberOfFrames: numberOfFrames,
    // Note: No orthancInstanceId since these are filesystem-only
  });
  
  await instance.save();
  console.log(`  ✅ Created instance entry with ${numberOfFrames} frames`);
  
  return instance;
}

// Main migration function
async function migrateStudies() {
  try {
    console.log('🔄 Starting filesystem studies migration...\n');
    
    // Check if directories exist
    if (!fs.existsSync(UPLOADED_STUDIES_DIR)) {
      console.log('❌ uploaded_studies directory not found');
      return;
    }
    
    // Get all study directories
    const studyDirs = fs.readdirSync(UPLOADED_STUDIES_DIR)
      .filter(name => !name.startsWith('.'))
      .filter(name => fs.statSync(path.join(UPLOADED_STUDIES_DIR, name)).isDirectory());
    
    console.log(`Found ${studyDirs.length} study directories\n`);
    
    let imported = 0;
    let skipped = 0;
    let failed = 0;
    
    for (const studyUID of studyDirs) {
      try {
        console.log(`Processing: ${studyUID}`);
        
        // Check if already in database
        if (await studyExistsInDB(studyUID)) {
          console.log(`  ⏭️  Already in database, skipping\n`);
          skipped++;
          continue;
        }
        
        // Count frames
        const numberOfFrames = countFrames(studyUID);
        if (numberOfFrames === 0) {
          console.log(`  ⚠️  No frames found, skipping\n`);
          skipped++;
          continue;
        }
        
        console.log(`  📊 Found ${numberOfFrames} frames`);
        
        // Create database entries
        await createStudyEntry(studyUID, numberOfFrames);
        await createInstanceEntry(studyUID, numberOfFrames);
        
        imported++;
        console.log(`  ✅ Successfully migrated\n`);
        
      } catch (error) {
        console.error(`  ❌ Failed to migrate ${studyUID}:`, error.message, '\n');
        failed++;
      }
    }
    
    console.log('🏁 Migration complete!');
    console.log(`  ✅ Imported: ${imported}`);
    console.log(`  ⏭️  Skipped: ${skipped}`);
    console.log(`  ❌ Failed: ${failed}`);
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  }
}

// Run migration
async function main() {
  try {
    await connectDB();
    await migrateStudies();
    await mongoose.connection.close();
    console.log('\n✅ Migration completed successfully');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  }
}

main();
