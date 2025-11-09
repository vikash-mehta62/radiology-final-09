const bcrypt = require('bcryptjs')
const User = require('../models/User')
const Hospital = require('../models/Hospital')

async function seedAdmin() {
  try {
    // 1. Create Super Admin
    const superAdminUsername = 'superadmin'
    const superAdminEmail = 'superadmin@gmail.com'
    const superAdminPassword = '12345678'

    let superAdmin = await User.findOne({ username: superAdminUsername })
    if (!superAdmin) {
      const passwordHash = await bcrypt.hash(superAdminPassword, 10)
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
      })
      console.log(`✅ Super Admin created: ${superAdminUsername} / ${superAdminPassword}`)
    } else {
      console.log(`[seed] Super Admin already exists: ${superAdminUsername}`)
    }

    // 2. Create Hospital (if not exists)
    let hospital = await Hospital.findOne({ hospitalId: 'HOSP001' })
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
      })
      console.log(`✅ Hospital created: ${hospital.name} (${hospital.hospitalId})`)
    } else {
      console.log(`[seed] Hospital already exists: ${hospital.hospitalId}`)
    }

    // 3. Create Hospital Admin User
    const hospitalUsername = 'hospital'
    const hospitalEmail = 'hospital@gmail.com'
    const hospitalPassword = '123456'

    let hospitalAdmin = await User.findOne({ username: hospitalUsername })
    if (!hospitalAdmin) {
      const passwordHash = await bcrypt.hash(hospitalPassword, 10)
      hospitalAdmin = await User.create({
        username: hospitalUsername,
        email: hospitalEmail,
        passwordHash,
        firstName: 'Hospital',
        lastName: 'Admin',
        roles: ['admin', 'radiologist'],
        permissions: ['studies:read', 'studies:write', 'patients:read', 'patients:write', 'users:read'],
        hospitalId: hospital.hospitalId, // Use hospital ID string
        isActive: true,
        isVerified: true,
      })
      console.log(`✅ Hospital Admin created: ${hospitalUsername} / ${hospitalPassword}`)
    } else {
      console.log(`[seed] Hospital Admin already exists: ${hospitalUsername}`)
    }

    // 4. Create default admin (backward compatibility)
    const defaultUsername = process.env.ADMIN_USERNAME || 'admin'
    const defaultPassword = process.env.ADMIN_PASSWORD || 'admin123'
    const defaultEmail = process.env.ADMIN_EMAIL || 'admin@example.com'

    let defaultAdmin = await User.findOne({ username: defaultUsername })
    if (!defaultAdmin) {
      const passwordHash = await bcrypt.hash(defaultPassword, 10)
      defaultAdmin = await User.create({
        username: defaultUsername,
        email: defaultEmail,
        passwordHash,
        firstName: 'System',
        lastName: 'Admin',
        roles: ['admin'],
        permissions: ['*'],
        hospitalId: hospital.hospitalId, // Use hospital ID string
        isActive: true,
        isVerified: true,
      })
      console.log(`✅ Default Admin created: ${defaultUsername} / ${defaultPassword}`)
    } else {
      console.log(`[seed] Default Admin already exists: ${defaultUsername}`)
    }

    console.log('\n📋 Seeded Users Summary:')
    console.log('  1. Super Admin: superadmin@gmail.com / 12345678')
    console.log('  2. Hospital Admin: hospital@gmail.com / 123456')
    console.log(`  3. Default Admin: ${defaultEmail} / ${defaultPassword}`)
    console.log(`\n🏥 Hospital: ${hospital.name} (${hospital.hospitalId})`)

    return { superAdmin, hospital, hospitalAdmin, defaultAdmin }
  } catch (error) {
    console.error('❌ Seed error:', error)
    throw error
  }
}

module.exports = { seedAdmin }