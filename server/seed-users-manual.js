/**
 * Manual User Seeding Script
 * Run this to create superadmin, hospital admin, and default admin users
 */

require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

// MongoDB connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/dicomdb';

// User Schema (inline to avoid import issues)
const UserSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true, index: true },
    email: { type: String, required: true, unique: true },
    passwordHash: { type: String, required: true },
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    roles: { type: [String], default: ['user'] },
    permissions: { type: [String], default: ['studies:read'] },
    hospitalId: { type: String, index: true },
    isActive: { type: Boolean, default: true },
    isVerified: { type: Boolean, default: true },
    mfaEnabled: { type: Boolean, default: false },
    lastLogin: { type: Date },
}, { timestamps: true });

const User = mongoose.model('User', UserSchema);

// Hospital Schema (inline)
const HospitalSchema = new mongoose.Schema({
    hospitalId: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true },
    address: {
        street: String,
        city: String,
        state: String,
        zipCode: String,
        country: String
    },
    contactInfo: {
        phone: String,
        email: String,
        website: String
    },
    status: { type: String, enum: ['active', 'inactive', 'suspended'], default: 'active' },
    subscription: {
        plan: { type: String, enum: ['basic', 'professional', 'enterprise'], default: 'basic' },
        startDate: Date,
        endDate: Date,
        maxUsers: { type: Number, default: 10 },
        maxStorage: { type: Number, default: 10737418240 }, // 10GB default
        currentStorage: { type: Number, default: 0 }
    },
    features: {
        aiAnalysis: { type: Boolean, default: false },
        advancedReporting: { type: Boolean, default: false },
        multiSiteAccess: { type: Boolean, default: false },
        customBranding: { type: Boolean, default: false }
    }
}, { timestamps: true });

const Hospital = mongoose.model('Hospital', HospitalSchema);

async function seedUsers() {
    try {
        console.log('🔌 Connecting to MongoDB...');
        console.log(`   URI: ${MONGODB_URI.replace(/\/\/[^:]+:[^@]+@/, '//***:***@')}`);

        await mongoose.connect(MONGODB_URI);
        console.log('✅ Connected to MongoDB\n');

        // 1. Create Hospital
        console.log('🏥 Creating Hospital...');
        let hospital = await Hospital.findOne({ hospitalId: 'HOSP001' });

        if (!hospital) {
            hospital = await Hospital.create({
                hospitalId: 'HOSP001',
                name: 'General Hospital',
                address: {
                    street: '123 Medical Center Drive',
                    city: 'Healthcare City',
                    state: 'HC',
                    zipCode: '12345',
                    country: 'USA'
                },
                contactInfo: {
                    phone: '+1-555-0100',
                    email: 'contact@generalhospital.com',
                    website: 'https://generalhospital.com'
                },
                status: 'active',
                subscription: {
                    plan: 'enterprise',
                    startDate: new Date(),
                    maxUsers: 100,
                    maxStorage: 1000000000000, // 1TB
                    currentStorage: 0
                },
                features: {
                    aiAnalysis: true,
                    advancedReporting: true,
                    multiSiteAccess: false,
                    customBranding: true
                }
            });
            console.log(`   ✅ Hospital created: ${hospital.name} (${hospital.hospitalId})`);
        } else {
            console.log(`   ℹ️  Hospital already exists: ${hospital.hospitalId}`);
        }

        // 2. Create Super Admin
        console.log('\n👤 Creating Super Admin...');
        const superAdminUsername = 'superadmin';
        const superAdminEmail = 'superadmin@gmail.com';
        const superAdminPassword = '12345678';

        let superAdmin = await User.findOne({ username: superAdminUsername });

        if (!superAdmin) {
            const passwordHash = await bcrypt.hash(superAdminPassword, 10);
            superAdmin = await User.create({
                username: superAdminUsername,
                email: superAdminEmail,
                passwordHash,
                firstName: 'Super',
                lastName: 'Admin',
                roles: ['system:admin', 'super_admin'],
                permissions: ['*'],
                isActive: true,
                isVerified: true,
            });
            console.log(`   ✅ Super Admin created`);
            console.log(`      Username: ${superAdminUsername}`);
            console.log(`      Email: ${superAdminEmail}`);
            console.log(`      Password: ${superAdminPassword}`);
            console.log(`      Roles: ${superAdmin.roles.join(', ')}`);
        } else {
            console.log(`   ℹ️  Super Admin already exists: ${superAdminUsername}`);
            console.log(`      Email: ${superAdmin.email}`);
            console.log(`      Roles: ${superAdmin.roles.join(', ')}`);
        }

        // 3. Create Hospital Admin
        console.log('\n👤 Creating Hospital Admin...');
        const hospitalUsername = 'hospital';
        const hospitalEmail = 'hospital@gmail.com';
        const hospitalPassword = '123456';

        let hospitalAdmin = await User.findOne({ username: hospitalUsername });

        if (!hospitalAdmin) {
            const passwordHash = await bcrypt.hash(hospitalPassword, 10);
            hospitalAdmin = await User.create({
                username: hospitalUsername,
                email: hospitalEmail,
                passwordHash,
                firstName: 'Hospital',
                lastName: 'Admin',
                roles: ['admin', 'radiologist'],
                permissions: ['studies:read', 'studies:write', 'patients:read', 'patients:write', 'users:read'],
                hospitalId: hospital._id, // Use MongoDB ObjectId
                isActive: true,
                isVerified: true,
            });
            console.log(`   ✅ Hospital Admin created`);
            console.log(`      Username: ${hospitalUsername}`);
            console.log(`      Email: ${hospitalEmail}`);
            console.log(`      Password: ${hospitalPassword}`);
            console.log(`      Hospital: ${hospital.hospitalId}`);
            console.log(`      Roles: ${hospitalAdmin.roles.join(', ')}`);
        } else {
            console.log(`   ℹ️  Hospital Admin already exists: ${hospitalUsername}`);
            console.log(`      Email: ${hospitalAdmin.email}`);
            console.log(`      Hospital: ${hospitalAdmin.hospitalId}`);
            console.log(`      Roles: ${hospitalAdmin.roles.join(', ')}`);
        }

        // 4. Create Default Admin
        console.log('\n👤 Creating Default Admin...');
        const defaultUsername = 'admin';
        const defaultEmail = 'admin@example.com';
        const defaultPassword = 'admin123';

        let defaultAdmin = await User.findOne({ username: defaultUsername });

        if (!defaultAdmin) {
            const passwordHash = await bcrypt.hash(defaultPassword, 10);
            defaultAdmin = await User.create({
                username: defaultUsername,
                email: defaultEmail,
                passwordHash,
                firstName: 'System',
                lastName: 'Admin',
                roles: ['admin'],
                permissions: ['*'],
                hospitalId: hospital._id, // Use MongoDB ObjectId
                isActive: true,
                isVerified: true,
            });
            console.log(`   ✅ Default Admin created`);
            console.log(`      Username: ${defaultUsername}`);
            console.log(`      Email: ${defaultEmail}`);
            console.log(`      Password: ${defaultPassword}`);
            console.log(`      Hospital: ${hospital.hospitalId}`);
            console.log(`      Roles: ${defaultAdmin.roles.join(', ')}`);
        } else {
            console.log(`   ℹ️  Default Admin already exists: ${defaultUsername}`);
            console.log(`      Email: ${defaultAdmin.email}`);
            console.log(`      Hospital: ${defaultAdmin.hospitalId}`);
            console.log(`      Roles: ${defaultAdmin.roles.join(', ')}`);
        }

        // Summary
        console.log('\n' + '='.repeat(60));
        console.log('📋 SEEDING COMPLETE - User Summary:');
        console.log('='.repeat(60));
        console.log('\n1️⃣  SUPER ADMIN');
        console.log('   Username: superadmin');
        console.log('   Email: superadmin@gmail.com');
        console.log('   Password: 12345678');
        console.log('   Dashboard: /superadmin');
        console.log('   Access: All hospitals, all data');

        console.log('\n2️⃣  HOSPITAL ADMIN');
        console.log('   Username: hospital');
        console.log('   Email: hospital@gmail.com');
        console.log('   Password: 123456');
        console.log('   Hospital: HOSP001 (General Hospital)');
        console.log('   Dashboard: /dashboard');
        console.log('   Access: Only HOSP001 data');

        console.log('\n3️⃣  DEFAULT ADMIN');
        console.log('   Username: admin');
        console.log('   Email: admin@example.com');
        console.log('   Password: admin123');
        console.log('   Hospital: HOSP001 (General Hospital)');
        console.log('   Dashboard: /dashboard');
        console.log('   Access: Only HOSP001 data');

        console.log('\n' + '='.repeat(60));
        console.log('✅ All users created successfully!');
        console.log('\nNext steps:');
        console.log('1. Test login: .\\test-login-powershell.ps1');
        console.log('2. Or test in browser: http://localhost:5173/login');
        console.log('='.repeat(60) + '\n');

    } catch (error) {
        console.error('\n❌ Error during seeding:', error);
        console.error('\nDetails:', error.message);
        if (error.code === 11000) {
            console.error('\n⚠️  Duplicate key error - users may already exist');
            console.error('   Try checking existing users in MongoDB');
        }
    } finally {
        await mongoose.disconnect();
        console.log('🔌 Disconnected from MongoDB');
    }
}

// Run the seeding
seedUsers().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
});
