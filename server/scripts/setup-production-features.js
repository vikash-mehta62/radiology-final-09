/**
 * Production Features Setup Script
 * 
 * This script helps set up the environment for production features including:
 * - Critical notifications
 * - FDA digital signatures
 * - Export system
 * - Session management
 * 
 * Usage: node scripts/setup-production-features.js
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(query) {
  return new Promise(resolve => rl.question(query, resolve));
}

async function setup() {
  console.log('='.repeat(70));
  console.log('Production Features Setup');
  console.log('='.repeat(70));
  console.log();
  console.log('This script will help you configure production features.');
  console.log();

  const checks = [];
  const warnings = [];
  const actions = [];

  // Check 1: Environment file
  console.log('Checking environment configuration...');
  const envPath = path.join(__dirname, '..', '.env');
  if (!fs.existsSync(envPath)) {
    warnings.push('.env file not found');
    console.warn('⚠️  .env file not found');
  } else {
    checks.push('.env file exists');
    console.log('✅ .env file exists');
  }

  // Check 2: Keys directory
  console.log('Checking keys directory...');
  const keysDir = path.join(__dirname, '..', 'keys');
  if (!fs.existsSync(keysDir)) {
    fs.mkdirSync(keysDir, { recursive: true });
    actions.push('Created keys directory');
    console.log('✅ Created keys directory');
  } else {
    checks.push('Keys directory exists');
    console.log('✅ Keys directory exists');
  }

  // Check 3: Signature keys
  console.log('Checking signature keys...');
  const privateKeyPath = path.join(keysDir, 'signature-private.pem');
  const publicKeyPath = path.join(keysDir, 'signature-public.pem');
  
  if (!fs.existsSync(privateKeyPath) || !fs.existsSync(publicKeyPath)) {
    warnings.push('Signature keys not found');
    console.warn('⚠️  Signature keys not found');
    
    const generateKeys = await question('\nWould you like to generate signature keys now? (y/n): ');
    if (generateKeys.toLowerCase() === 'y') {
      console.log('\nRunning key generation script...');
      const { spawn } = require('child_process');
      const keyGen = spawn('node', ['scripts/generate-signature-keys.js'], {
        stdio: 'inherit',
        cwd: path.join(__dirname, '..')
      });
      
      await new Promise((resolve) => {
        keyGen.on('close', resolve);
      });
      
      actions.push('Generated signature keys');
    } else {
      actions.push('Skipped key generation - run manually: node scripts/generate-signature-keys.js');
    }
  } else {
    checks.push('Signature keys exist');
    console.log('✅ Signature keys exist');
  }

  // Check 4: Required directories
  console.log('\nChecking required directories...');
  const dirs = [
    'temp/exports',
    'logs',
    'keys/archive',
    'backups'
  ];

  for (const dir of dirs) {
    const dirPath = path.join(__dirname, '..', dir);
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
      actions.push(`Created ${dir} directory`);
      console.log(`✅ Created ${dir} directory`);
    } else {
      checks.push(`${dir} directory exists`);
      console.log(`✅ ${dir} directory exists`);
    }
  }

  // Check 5: Environment variables
  console.log('\nChecking environment variables...');
  require('dotenv').config({ path: envPath });

  const requiredVars = [
    'JWT_SECRET',
    'JWT_REFRESH_SECRET',
    'MONGODB_URI',
    'SIGNATURE_KEY_PASSPHRASE'
  ];

  const missingVars = [];
  const defaultVars = [];

  for (const varName of requiredVars) {
    if (!process.env[varName]) {
      missingVars.push(varName);
      console.warn(`⚠️  ${varName} not set`);
    } else if (process.env[varName].includes('change_this') || 
               process.env[varName].includes('dev_')) {
      defaultVars.push(varName);
      console.warn(`⚠️  ${varName} has default value`);
    } else {
      checks.push(`${varName} configured`);
      console.log(`✅ ${varName} configured`);
    }
  }

  // Check 6: Optional services
  console.log('\nChecking optional services...');
  
  const optionalServices = [
    { name: 'SendGrid (Email)', var: 'SENDGRID_API_KEY' },
    { name: 'Twilio (SMS)', var: 'TWILIO_ACCOUNT_SID' },
    { name: 'Redis (Caching)', var: 'REDIS_URL' },
    { name: 'FHIR Server', var: 'FHIR_SERVER_URL' }
  ];

  for (const service of optionalServices) {
    if (process.env[service.var]) {
      checks.push(`${service.name} configured`);
      console.log(`✅ ${service.name} configured`);
    } else {
      console.log(`ℹ️  ${service.name} not configured (optional)`);
    }
  }

  // Summary
  console.log();
  console.log('='.repeat(70));
  console.log('Setup Summary');
  console.log('='.repeat(70));
  console.log();

  if (checks.length > 0) {
    console.log(`✅ ${checks.length} checks passed`);
  }

  if (warnings.length > 0) {
    console.log(`⚠️  ${warnings.length} warnings:`);
    warnings.forEach((warning, i) => {
      console.log(`   ${i + 1}. ${warning}`);
    });
  }

  if (actions.length > 0) {
    console.log(`\n📝 Actions taken:`);
    actions.forEach((action, i) => {
      console.log(`   ${i + 1}. ${action}`);
    });
  }

  // Next steps
  console.log();
  console.log('='.repeat(70));
  console.log('Next Steps');
  console.log('='.repeat(70));
  console.log();

  const nextSteps = [];

  if (missingVars.length > 0) {
    nextSteps.push('Set missing environment variables in .env:');
    missingVars.forEach(v => nextSteps.push(`  - ${v}`));
  }

  if (defaultVars.length > 0) {
    nextSteps.push('Update default values in .env:');
    defaultVars.forEach(v => nextSteps.push(`  - ${v}`));
  }

  if (!fs.existsSync(privateKeyPath)) {
    nextSteps.push('Generate signature keys:');
    nextSteps.push('  node scripts/generate-signature-keys.js');
  }

  nextSteps.push('Verify signature keys:');
  nextSteps.push('  node scripts/verify-signature-keys.js');

  nextSteps.push('Review documentation:');
  nextSteps.push('  - docs/KEY_MANAGEMENT.md');
  nextSteps.push('  - docs/KEY_ROTATION.md');
  nextSteps.push('  - .kiro/specs/production-features/design.md');

  nextSteps.push('Configure optional services (if needed):');
  nextSteps.push('  - SendGrid for email notifications');
  nextSteps.push('  - Twilio for SMS notifications');
  nextSteps.push('  - Redis for session caching');

  nextSteps.forEach(step => console.log(step));

  console.log();
  console.log('='.repeat(70));
  console.log('Setup complete! Review the next steps above.');
  console.log('='.repeat(70));
  console.log();

  rl.close();
}

// Run setup
setup().catch(error => {
  console.error('Setup failed:', error);
  process.exit(1);
});
