#!/usr/bin/env node

/**
 * Super Admin Setup Script
 * 
 * This script helps you set up the super admin dashboard:
 * 1. Creates super admin user
 * 2. Initializes sample data (optional)
 * 3. Verifies configuration
 */

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const readline = require('readline');
const { v4: uuidv4 } = require('uuid');

// Load environment variables
require('dotenv').config();

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(query) {
  return new Promise(resolve => rl.question(query, resolve));
}

async function setupSuperAdmin() {
  console.log('\n🔐 Super Admin Dashboard Setup\n');
  console.log('This script will help you set up the super admin dashboard.\n');

  try {
    // Connect to MongoDB
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/medical-imaging';
    console.log('📡 Connecting to MongoDB...');
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB\n');

    // Import models
    const User = require('../server/src/models/User');
    const Hospital = require('../server/src/models/Hospital');
    const ContactRequest = require('../server/src/models/ContactRequest');
    const UsageMetrics = require('../server/src/models/UsageMetrics');

    // Check if super admin already exists
    const existingSuperAdmin = await User.findOne({ 
      roles: { $in: ['system:admin', 'super_admin'] } 
    });

    if (existingSuperAdmin) {
      console.log('⚠️  Super admin user already exists:');
      console.log(`   Username: ${existingSuperAdmin.username}`);
      console.log(`   Email: ${existingSuperAdmin.email}\n`);
      
      const overwrite = await question('Do you want to create another super admin? (yes/no): ');
      if (overwrite.toLowerCase() !== 'yes') {
        console.log('\n✅ Setup cancelled. Existing super admin unchanged.\n');
        process.exit(0);
      }
    }

    // Get super admin details
    console.log('\n📝 Enter super admin details:\n');
    
    const username = await question('Username (default: superadmin): ') || 'superadmin';
    const email = await question('Email: ');
    const firstName = await question('First Name: ');
    const lastName = await question('Last Name: ');
    const password = await question('Password (min 8 characters): ');

    if (!email || !firstName || !lastName || !password) {
      console.log('\n❌ All fields are required!\n');
      process.exit(1);
    }

    if (password.length < 8) {
      console.log('\n❌ Password must be at least 8 characters!\n');
      process.exit(1);
    }

    // Create super admin
    console.log('\n🔨 Creating super admin user...');
    const passwordHash = await bcrypt.hash(password, 10);
    
    const superAdmin = new User({
      username,
      email,
      passwordHash,
      firstName,
      lastName,
      roles: ['system:admin', 'super_admin', 'admin'],
      permissions: ['*'],
      isActive: true,
      isVerified: true,
      mfaEnabled: false
    });

    await superAdmin.save();
    console.log('✅ Super admin user created successfully!\n');

    // Ask about sample data
    const createSample = await question('Do you want to create sample data for testing? (yes/no): ');
    
    if (createSample.toLowerCase() === 'yes') {
      console.log('\n🔨 Creating sample data...\n');

      // Create sample hospitals
      console.log('Creating sample hospitals...');
      const hospitals = [];
      for (let i = 1; i <= 3; i++) {
        const hospital = new Hospital({
          hospitalId: `hosp_sample_${i}`,
          name: `Sample Hospital ${i}`,
          address: {
            street: `${i}00 Medical Center Dr`,
            city: 'Sample City',
            state: 'CA',
            zipCode: '90001',
            country: 'USA'
          },
          contactEmail: `admin@hospital${i}.example.com`,
          contactPhone: `+1-555-010${i}`,
          status: 'active',
          subscription: {
            plan: i === 1 ? 'enterprise' : i === 2 ? 'professional' : 'basic',
            maxUsers: i === 1 ? 100 : i === 2 ? 50 : 10,
            maxStorage: i === 1 ? 1000 : i === 2 ? 500 : 100,
            currentStorage: Math.random() * 50
          },
          apiKey: uuidv4(),
          statistics: {
            totalStudies: Math.floor(Math.random() * 1000),
            totalSeries: Math.floor(Math.random() * 5000),
            totalInstances: Math.floor(Math.random() * 50000)
          }
        });
        await hospital.save();
        hospitals.push(hospital);
      }
      console.log(`✅ Created ${hospitals.length} sample hospitals\n`);

      // Create sample contact requests
      console.log('Creating sample contact requests...');
      const requestTypes = ['demo', 'trial', 'contact', 'support'];
      const statuses = ['new', 'contacted', 'in_progress'];
      const priorities = ['low', 'medium', 'high', 'urgent'];
      
      for (let i = 1; i <= 5; i++) {
        const request = new ContactRequest({
          requestId: `REQ-${uuidv4().substring(0, 8).toUpperCase()}`,
          type: requestTypes[Math.floor(Math.random() * requestTypes.length)],
          status: statuses[Math.floor(Math.random() * statuses.length)],
          priority: priorities[Math.floor(Math.random() * priorities.length)],
          contactInfo: {
            name: `Sample Contact ${i}`,
            email: `contact${i}@example.com`,
            phone: `+1-555-020${i}`,
            organization: `Sample Organization ${i}`,
            position: 'IT Director'
          },
          details: {
            message: `This is a sample contact request for testing purposes. Request #${i}`,
            estimatedUsers: Math.floor(Math.random() * 50) + 10,
            estimatedStudiesPerMonth: Math.floor(Math.random() * 1000) + 100,
            timeline: '1-3 months'
          },
          source: 'website',
          ipAddress: `192.168.1.${i}`
        });
        await request.save();
      }
      console.log('✅ Created 5 sample contact requests\n');

      // Create sample metrics
      console.log('Creating sample usage metrics...');
      const today = new Date();
      for (const hospital of hospitals) {
        for (let day = 0; day < 30; day++) {
          const date = new Date(today);
          date.setDate(date.getDate() - day);
          date.setHours(0, 0, 0, 0);

          const metrics = new UsageMetrics({
            hospitalId: hospital.hospitalId,
            date,
            studies: {
              uploaded: Math.floor(Math.random() * 50),
              viewed: Math.floor(Math.random() * 200),
              reported: Math.floor(Math.random() * 40)
            },
            users: {
              activeUsers: Math.floor(Math.random() * 20) + 5,
              totalLogins: Math.floor(Math.random() * 50),
              uniqueUsers: []
            },
            storage: {
              totalBytes: Math.floor(Math.random() * 1000000000),
              addedBytes: Math.floor(Math.random() * 10000000)
            },
            modalityBreakdown: {
              CT: Math.floor(Math.random() * 20),
              MR: Math.floor(Math.random() * 15),
              XR: Math.floor(Math.random() * 30),
              US: Math.floor(Math.random() * 10),
              CR: Math.floor(Math.random() * 5),
              DX: Math.floor(Math.random() * 8),
              OTHER: Math.floor(Math.random() * 5)
            },
            aiUsage: {
              totalRequests: Math.floor(Math.random() * 30),
              successfulRequests: Math.floor(Math.random() * 25),
              failedRequests: Math.floor(Math.random() * 5)
            }
          });
          await metrics.save();
        }
      }
      console.log('✅ Created 30 days of sample metrics for each hospital\n');
    }

    // Summary
    console.log('\n🎉 Setup Complete!\n');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log('Super Admin Credentials:');
    console.log(`  Username: ${username}`);
    console.log(`  Email: ${email}`);
    console.log(`  Password: ${password}`);
    console.log('\n⚠️  IMPORTANT: Change this password after first login!\n');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log('Access the dashboard at:');
    console.log('  https://yourdomain.com/superadmin\n');
    console.log('View the landing page at:');
    console.log('  https://yourdomain.com/landing\n');
    console.log('For more information, see SUPER_ADMIN_SETUP_GUIDE.md\n');

  } catch (error) {
    console.error('\n❌ Error during setup:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    rl.close();
    await mongoose.disconnect();
    process.exit(0);
  }
}

// Run setup
setupSuperAdmin();
