/**
 * Generate RSA-2048 Key Pair for FDA Digital Signatures
 * 
 * This script generates a cryptographic key pair for signing medical reports
 * in compliance with FDA 21 CFR Part 11 requirements.
 * 
 * Usage: node scripts/generate-signature-keys.js
 */

const crypto = require('crypto');
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

async function generateKeys() {
  console.log('='.repeat(70));
  console.log('FDA Digital Signature Key Generation');
  console.log('='.repeat(70));
  console.log();
  console.log('This script will generate an RSA-2048 key pair for signing medical reports.');
  console.log('The keys will be stored securely in the ./keys directory.');
  console.log();

  // Get passphrase from user
  const passphrase = await question('Enter a secure passphrase to protect the private key: ');
  
  if (!passphrase || passphrase.length < 12) {
    console.error('\n❌ Error: Passphrase must be at least 12 characters long.');
    rl.close();
    process.exit(1);
  }

  const confirmPassphrase = await question('Confirm passphrase: ');
  
  if (passphrase !== confirmPassphrase) {
    console.error('\n❌ Error: Passphrases do not match.');
    rl.close();
    process.exit(1);
  }

  console.log('\n⏳ Generating RSA-2048 key pair...');

  try {
    // Generate key pair
    const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: {
        type: 'spki',
        format: 'pem'
      },
      privateKeyEncoding: {
        type: 'pkcs8',
        format: 'pem',
        cipher: 'aes-256-cbc',
        passphrase: passphrase
      }
    });

    // Create keys directory if it doesn't exist
    const keysDir = path.join(__dirname, '..', 'keys');
    if (!fs.existsSync(keysDir)) {
      fs.mkdirSync(keysDir, { recursive: true });
    }

    // Write keys to files
    const privateKeyPath = path.join(keysDir, 'signature-private.pem');
    const publicKeyPath = path.join(keysDir, 'signature-public.pem');

    fs.writeFileSync(privateKeyPath, privateKey, { mode: 0o600 });
    fs.writeFileSync(publicKeyPath, publicKey, { mode: 0o644 });

    // Generate key metadata
    const metadata = {
      algorithm: 'RSA-SHA256',
      keySize: 2048,
      generatedAt: new Date().toISOString(),
      publicKeyFingerprint: crypto.createHash('sha256').update(publicKey).digest('hex'),
      version: 1,
      status: 'active'
    };

    const metadataPath = path.join(keysDir, 'key-metadata.json');
    fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));

    console.log('\n✅ Key pair generated successfully!');
    console.log();
    console.log('Files created:');
    console.log(`  - Private key: ${privateKeyPath}`);
    console.log(`  - Public key:  ${publicKeyPath}`);
    console.log(`  - Metadata:    ${metadataPath}`);
    console.log();
    console.log('⚠️  IMPORTANT SECURITY NOTES:');
    console.log('  1. Keep the private key secure and never commit it to version control');
    console.log('  2. Store the passphrase in a secure location (password manager, vault)');
    console.log('  3. Update SIGNATURE_KEY_PASSPHRASE in .env file');
    console.log('  4. Backup the keys to a secure location');
    console.log('  5. Implement key rotation procedures (see KEY_ROTATION.md)');
    console.log();
    console.log('Public Key Fingerprint:');
    console.log(`  ${metadata.publicKeyFingerprint}`);
    console.log();

  } catch (error) {
    console.error('\n❌ Error generating keys:', error.message);
    rl.close();
    process.exit(1);
  }

  rl.close();
}

// Run the script
generateKeys().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
