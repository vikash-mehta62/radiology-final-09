/**
 * Verify Digital Signature Keys
 * 
 * This script verifies that the signature keys are properly configured
 * and can be used for signing and verification.
 * 
 * Usage: node scripts/verify-signature-keys.js
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

function verifyKeys() {
  console.log('='.repeat(70));
  console.log('Digital Signature Key Verification');
  console.log('='.repeat(70));
  console.log();

  const errors = [];
  const warnings = [];

  // Check if keys directory exists
  const keysDir = path.join(__dirname, '..', 'keys');
  if (!fs.existsSync(keysDir)) {
    errors.push('Keys directory does not exist: ' + keysDir);
    console.error('❌ Keys directory not found');
    return { success: false, errors, warnings };
  }
  console.log('✅ Keys directory exists');

  // Check if key files exist
  const privateKeyPath = path.join(keysDir, 'signature-private.pem');
  const publicKeyPath = path.join(keysDir, 'signature-public.pem');
  const metadataPath = path.join(keysDir, 'key-metadata.json');

  if (!fs.existsSync(privateKeyPath)) {
    errors.push('Private key file not found: ' + privateKeyPath);
    console.error('❌ Private key file not found');
  } else {
    console.log('✅ Private key file exists');
    
    // Check private key permissions
    const stats = fs.statSync(privateKeyPath);
    const mode = (stats.mode & parseInt('777', 8)).toString(8);
    if (mode !== '600') {
      warnings.push(`Private key permissions are ${mode}, should be 600`);
      console.warn(`⚠️  Private key permissions: ${mode} (should be 600)`);
    } else {
      console.log('✅ Private key permissions correct (600)');
    }
  }

  if (!fs.existsSync(publicKeyPath)) {
    errors.push('Public key file not found: ' + publicKeyPath);
    console.error('❌ Public key file not found');
  } else {
    console.log('✅ Public key file exists');
  }

  if (!fs.existsSync(metadataPath)) {
    warnings.push('Key metadata file not found: ' + metadataPath);
    console.warn('⚠️  Key metadata file not found');
  } else {
    console.log('✅ Key metadata file exists');
  }

  if (errors.length > 0) {
    console.log();
    console.log('Cannot proceed with verification due to missing files.');
    return { success: false, errors, warnings };
  }

  // Load keys
  let privateKey, publicKey, metadata;
  
  try {
    privateKey = fs.readFileSync(privateKeyPath, 'utf8');
    console.log('✅ Private key loaded');
  } catch (error) {
    errors.push('Failed to load private key: ' + error.message);
    console.error('❌ Failed to load private key:', error.message);
  }

  try {
    publicKey = fs.readFileSync(publicKeyPath, 'utf8');
    console.log('✅ Public key loaded');
  } catch (error) {
    errors.push('Failed to load public key: ' + error.message);
    console.error('❌ Failed to load public key:', error.message);
  }

  try {
    metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
    console.log('✅ Metadata loaded');
  } catch (error) {
    warnings.push('Failed to load metadata: ' + error.message);
    console.warn('⚠️  Failed to load metadata:', error.message);
  }

  if (errors.length > 0) {
    return { success: false, errors, warnings };
  }

  // Verify key format
  if (!privateKey.includes('BEGIN ENCRYPTED PRIVATE KEY')) {
    errors.push('Private key is not in encrypted PKCS8 format');
    console.error('❌ Private key format invalid');
  } else {
    console.log('✅ Private key format valid (encrypted PKCS8)');
  }

  if (!publicKey.includes('BEGIN PUBLIC KEY')) {
    errors.push('Public key is not in SPKI format');
    console.error('❌ Public key format invalid');
  } else {
    console.log('✅ Public key format valid (SPKI)');
  }

  // Check environment configuration
  console.log();
  console.log('Environment Configuration:');
  
  const passphrase = process.env.SIGNATURE_KEY_PASSPHRASE;
  if (!passphrase) {
    warnings.push('SIGNATURE_KEY_PASSPHRASE not set in .env');
    console.warn('⚠️  SIGNATURE_KEY_PASSPHRASE not set');
  } else if (passphrase.includes('change_this')) {
    warnings.push('SIGNATURE_KEY_PASSPHRASE still has default value');
    console.warn('⚠️  SIGNATURE_KEY_PASSPHRASE has default value');
  } else {
    console.log('✅ SIGNATURE_KEY_PASSPHRASE configured');
  }

  const privateKeyPathEnv = process.env.SIGNATURE_PRIVATE_KEY_PATH;
  if (!privateKeyPathEnv) {
    warnings.push('SIGNATURE_PRIVATE_KEY_PATH not set in .env');
    console.warn('⚠️  SIGNATURE_PRIVATE_KEY_PATH not set');
  } else {
    console.log('✅ SIGNATURE_PRIVATE_KEY_PATH configured');
  }

  const publicKeyPathEnv = process.env.SIGNATURE_PUBLIC_KEY_PATH;
  if (!publicKeyPathEnv) {
    warnings.push('SIGNATURE_PUBLIC_KEY_PATH not set in .env');
    console.warn('⚠️  SIGNATURE_PUBLIC_KEY_PATH not set');
  } else {
    console.log('✅ SIGNATURE_PUBLIC_KEY_PATH configured');
  }

  // Test signature generation and verification
  console.log();
  console.log('Testing Signature Operations:');

  if (!passphrase || passphrase.includes('change_this')) {
    console.warn('⚠️  Skipping signature test (passphrase not configured)');
    warnings.push('Cannot test signature operations without valid passphrase');
  } else {
    try {
      // Test data
      const testData = 'This is a test medical report for signature verification';
      
      // Generate signature
      const sign = crypto.createSign('RSA-SHA256');
      sign.update(testData);
      sign.end();
      
      const signature = sign.sign({
        key: privateKey,
        passphrase: passphrase
      }, 'base64');
      
      console.log('✅ Signature generation successful');
      
      // Verify signature
      const verify = crypto.createVerify('RSA-SHA256');
      verify.update(testData);
      verify.end();
      
      const isValid = verify.verify(publicKey, signature, 'base64');
      
      if (isValid) {
        console.log('✅ Signature verification successful');
      } else {
        errors.push('Signature verification failed');
        console.error('❌ Signature verification failed');
      }
      
      // Test with modified data
      const verify2 = crypto.createVerify('RSA-SHA256');
      verify2.update(testData + ' modified');
      verify2.end();
      
      const isValid2 = verify2.verify(publicKey, signature, 'base64');
      
      if (!isValid2) {
        console.log('✅ Tamper detection working (modified data rejected)');
      } else {
        errors.push('Tamper detection failed - modified data verified');
        console.error('❌ Tamper detection failed');
      }
      
    } catch (error) {
      errors.push('Signature test failed: ' + error.message);
      console.error('❌ Signature test failed:', error.message);
    }
  }

  // Display metadata
  if (metadata) {
    console.log();
    console.log('Key Metadata:');
    console.log(`  Algorithm: ${metadata.algorithm}`);
    console.log(`  Key Size: ${metadata.keySize} bits`);
    console.log(`  Generated: ${metadata.generatedAt}`);
    console.log(`  Version: ${metadata.version}`);
    console.log(`  Status: ${metadata.status}`);
    console.log(`  Fingerprint: ${metadata.publicKeyFingerprint}`);
  }

  // Summary
  console.log();
  console.log('='.repeat(70));
  console.log('Verification Summary');
  console.log('='.repeat(70));
  
  if (errors.length === 0 && warnings.length === 0) {
    console.log('✅ All checks passed! Keys are properly configured.');
    return { success: true, errors: [], warnings: [] };
  } else {
    if (errors.length > 0) {
      console.log(`❌ ${errors.length} error(s) found:`);
      errors.forEach((error, i) => {
        console.log(`   ${i + 1}. ${error}`);
      });
    }
    
    if (warnings.length > 0) {
      console.log(`⚠️  ${warnings.length} warning(s):`);
      warnings.forEach((warning, i) => {
        console.log(`   ${i + 1}. ${warning}`);
      });
    }
    
    return { success: errors.length === 0, errors, warnings };
  }
}

// Run verification
const result = verifyKeys();
process.exit(result.success ? 0 : 1);
