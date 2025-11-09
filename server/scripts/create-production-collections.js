#!/usr/bin/env node

/**
 * Production Features - Database Setup Script
 * 
 * Creates MongoDB collections and indexes for:
 * - Critical Notifications
 * - Digital Signatures
 * - Export Sessions
 * - Sessions
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const mongoose = require('mongoose');

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error('❌ MONGODB_URI not found in environment variables');
  process.exit(1);
}

async function createCollections() {
  try {
    console.log('🔄 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    const db = mongoose.connection.db;

    // 1. Critical Notifications Collection
    console.log('\n📋 Creating criticalnotifications collection...');
    try {
      await db.createCollection('criticalnotifications');
      console.log('✅ criticalnotifications collection created');
    } catch (error) {
      if (error.code === 48) {
        console.log('ℹ️  criticalnotifications collection already exists');
      } else {
        throw error;
      }
    }

    // Create indexes for criticalnotifications
    console.log('🔄 Creating indexes for criticalnotifications...');
    const notificationsCollection = db.collection('criticalnotifications');
    
    await notificationsCollection.createIndex({ patientId: 1, createdAt: -1 });
    await notificationsCollection.createIndex({ status: 1, createdAt: -1 });
    await notificationsCollection.createIndex({ 'recipients.userId': 1 });
    await notificationsCollection.createIndex({ severity: 1 });
    await notificationsCollection.createIndex({ type: 1 });
    await notificationsCollection.createIndex({ createdAt: -1 });
    
    console.log('✅ Indexes created for criticalnotifications');

    // 2. Digital Signatures Collection
    console.log('\n📋 Creating digitalsignatures collection...');
    try {
      await db.createCollection('digitalsignatures');
      console.log('✅ digitalsignatures collection created');
    } catch (error) {
      if (error.code === 48) {
        console.log('ℹ️  digitalsignatures collection already exists');
      } else {
        throw error;
      }
    }

    // Create indexes for digitalsignatures
    console.log('🔄 Creating indexes for digitalsignatures...');
    const signaturesCollection = db.collection('digitalsignatures');
    
    await signaturesCollection.createIndex({ reportId: 1 });
    await signaturesCollection.createIndex({ signerId: 1, timestamp: -1 });
    await signaturesCollection.createIndex({ status: 1 });
    await signaturesCollection.createIndex({ timestamp: -1 });
    
    console.log('✅ Indexes created for digitalsignatures');

    // 3. Export Sessions Collection
    console.log('\n📋 Creating exportsessions collection...');
    try {
      await db.createCollection('exportsessions');
      console.log('✅ exportsessions collection created');
    } catch (error) {
      if (error.code === 48) {
        console.log('ℹ️  exportsessions collection already exists');
      } else {
        throw error;
      }
    }

    // Create indexes for exportsessions
    console.log('🔄 Creating indexes for exportsessions...');
    const exportsCollection = db.collection('exportsessions');
    
    await exportsCollection.createIndex({ reportId: 1, createdAt: -1 });
    await exportsCollection.createIndex({ userId: 1, format: 1 });
    await exportsCollection.createIndex({ status: 1 });
    await exportsCollection.createIndex({ createdAt: -1 });
    
    console.log('✅ Indexes created for exportsessions');

    // 4. Sessions Collection (with TTL)
    console.log('\n📋 Creating sessions collection...');
    try {
      await db.createCollection('sessions');
      console.log('✅ sessions collection created');
    } catch (error) {
      if (error.code === 48) {
        console.log('ℹ️  sessions collection already exists');
      } else {
        throw error;
      }
    }

    // Create indexes for sessions
    console.log('🔄 Creating indexes for sessions...');
    const sessionsCollection = db.collection('sessions');
    
    await sessionsCollection.createIndex({ userId: 1, status: 1 });
    await sessionsCollection.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // TTL index
    await sessionsCollection.createIndex({ 'deviceInfo.deviceId': 1 });
    await sessionsCollection.createIndex({ createdAt: -1 });
    
    console.log('✅ Indexes created for sessions');

    // Summary
    console.log('\n✅ Database setup complete!');
    console.log('\n📊 Collections created:');
    console.log('   - criticalnotifications (6 indexes)');
    console.log('   - digitalsignatures (4 indexes)');
    console.log('   - exportsessions (4 indexes)');
    console.log('   - sessions (4 indexes, including TTL)');

    console.log('\n💡 Next steps:');
    console.log('   1. Create Mongoose models');
    console.log('   2. Implement backend services');
    console.log('   3. Create API routes');

  } catch (error) {
    console.error('\n❌ Error setting up database:', error);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log('\n🔌 Disconnected from MongoDB');
  }
}

// Run the setup
createCollections();
