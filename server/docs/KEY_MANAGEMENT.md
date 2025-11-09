# Digital Signature Key Management Guide

## Overview

This guide provides comprehensive instructions for managing cryptographic keys used in the FDA-compliant digital signature system. Proper key management is critical for maintaining security, compliance, and system integrity.

## Table of Contents

1. [Key Generation](#key-generation)
2. [Key Storage](#key-storage)
3. [Key Usage](#key-usage)
4. [Key Rotation](#key-rotation)
5. [Key Backup and Recovery](#key-backup-and-recovery)
6. [Key Revocation](#key-revocation)
7. [Security Best Practices](#security-best-practices)
8. [Compliance Requirements](#compliance-requirements)
9. [Troubleshooting](#troubleshooting)

## Key Generation

### Initial Setup

Generate your first key pair:

```bash
cd server
node scripts/generate-signature-keys.js
```

The script will:
1. Prompt for a secure passphrase (minimum 12 characters)
2. Generate RSA-2048 key pair
3. Encrypt private key with AES-256-CBC
4. Save keys to `./keys` directory
5. Create metadata file with key information

### Key Specifications

- **Algorithm**: RSA with SHA-256
- **Key Size**: 2048 bits
- **Private Key Format**: PKCS#8 (encrypted)
- **Public Key Format**: SPKI
- **Encryption**: AES-256-CBC for private key

### Passphrase Requirements

Your passphrase must:
- Be at least 12 characters long
- Include uppercase and lowercase letters
- Include numbers
- Include special characters
- Not be a dictionary word
- Not be reused from other systems

**Example strong passphrase**: `M3d!c@l$ign2024#Secure`

## Key Storage

### Development Environment

Keys are stored in `server/keys/`:

```
server/keys/
├── signature-private.pem    (mode: 600, owner only)
├── signature-public.pem     (mode: 644, readable)
├── key-metadata.json        (mode: 644, readable)
└── archive/                 (old keys)
    └── 20240101_120000/
        ├── signature-private.pem
        ├── signature-public.pem
        └── key-metadata.json
```

### Production Environment

**Recommended Options** (in order of preference):

1. **Hardware Security Module (HSM)**
   - Highest security
   - Keys never leave the device
   - FIPS 140-2 Level 3 certified
   - Examples: AWS CloudHSM, Azure Dedicated HSM

2. **Cloud Key Management Service**
   - AWS KMS
   - Azure Key Vault
   - Google Cloud KMS
   - HashiCorp Vault

3. **Encrypted File System**
   - Encrypted volume (LUKS, BitLocker)
   - Restricted file permissions
   - Regular security audits

### File Permissions

Set correct permissions:

```bash
# Private key - owner read/write only
chmod 600 keys/signature-private.pem

# Public key - readable by all
chmod 644 keys/signature-public.pem

# Keys directory - owner only
chmod 700 keys/
```

### Environment Variables

Configure in `.env`:

```bash
# Key paths
SIGNATURE_PRIVATE_KEY_PATH=./keys/signature-private.pem
SIGNATURE_PUBLIC_KEY_PATH=./keys/signature-public.pem

# Passphrase (use secret manager in production)
SIGNATURE_KEY_PASSPHRASE=your_secure_passphrase_here

# Key configuration
SIGNATURE_ALGORITHM=RSA-SHA256
SIGNATURE_KEY_SIZE=2048
```

## Key Usage

### Signing a Report

```javascript
const crypto = require('crypto');
const fs = require('fs');

async function signReport(reportData) {
  // Load private key
  const privateKey = fs.readFileSync(
    process.env.SIGNATURE_PRIVATE_KEY_PATH,
    'utf8'
  );
  
  // Create signature
  const sign = crypto.createSign('RSA-SHA256');
  sign.update(JSON.stringify(reportData));
  sign.end();
  
  const signature = sign.sign({
    key: privateKey,
    passphrase: process.env.SIGNATURE_KEY_PASSPHRASE
  }, 'base64');
  
  return {
    signature,
    algorithm: 'RSA-SHA256',
    keyVersion: getCurrentKeyVersion(),
    timestamp: new Date().toISOString()
  };
}
```

### Verifying a Signature

```javascript
async function verifySignature(reportData, signatureData) {
  // Load public key (may be archived version)
  const publicKey = await getPublicKey(signatureData.keyVersion);
  
  // Verify signature
  const verify = crypto.createVerify('RSA-SHA256');
  verify.update(JSON.stringify(reportData));
  verify.end();
  
  const isValid = verify.verify(publicKey, signatureData.signature, 'base64');
  
  return {
    valid: isValid,
    verifiedAt: new Date().toISOString(),
    keyVersion: signatureData.keyVersion
  };
}
```

### Key Version Management

```javascript
// Get current key version
function getCurrentKeyVersion() {
  const metadata = require('./keys/key-metadata.json');
  return metadata.version;
}

// Get public key for specific version
async function getPublicKey(version) {
  if (version === getCurrentKeyVersion()) {
    return fs.readFileSync(
      process.env.SIGNATURE_PUBLIC_KEY_PATH,
      'utf8'
    );
  }
  
  // Load from archive
  const archivePath = `./keys/archive/version-${version}/signature-public.pem`;
  if (!fs.existsSync(archivePath)) {
    throw new Error(`Public key for version ${version} not found`);
  }
  
  return fs.readFileSync(archivePath, 'utf8');
}
```

## Key Rotation

See [KEY_ROTATION.md](./KEY_ROTATION.md) for detailed rotation procedures.

### Quick Rotation Steps

1. Generate new key pair
2. Archive old keys
3. Update database metadata
4. Restart services
5. Verify new keys
6. Document rotation

### Rotation Schedule

- **Regular**: Every 12 months
- **Emergency**: Immediately upon compromise
- **Compliance**: As required by regulations

## Key Backup and Recovery

### Backup Procedure

```bash
#!/bin/bash
# backup-keys.sh

BACKUP_DIR="backups/keys/$(date +%Y%m%d_%H%M%S)"
mkdir -p "$BACKUP_DIR"

# Copy keys
cp keys/signature-private.pem "$BACKUP_DIR/"
cp keys/signature-public.pem "$BACKUP_DIR/"
cp keys/key-metadata.json "$BACKUP_DIR/"

# Encrypt backup
tar czf - "$BACKUP_DIR" | \
  openssl enc -aes-256-cbc -salt -pbkdf2 \
  -out "keys-backup-$(date +%Y%m%d).tar.gz.enc"

# Remove unencrypted backup
rm -rf "$BACKUP_DIR"

echo "Backup created: keys-backup-$(date +%Y%m%d).tar.gz.enc"
```

### Recovery Procedure

```bash
#!/bin/bash
# restore-keys.sh

BACKUP_FILE="$1"

if [ -z "$BACKUP_FILE" ]; then
  echo "Usage: ./restore-keys.sh <backup-file>"
  exit 1
fi

# Decrypt and extract
openssl enc -aes-256-cbc -d -pbkdf2 \
  -in "$BACKUP_FILE" | tar xzf -

echo "Keys restored. Please verify with:"
echo "node scripts/verify-signature-keys.js"
```

### Backup Storage

- **Primary**: Encrypted cloud storage (S3, Azure Blob)
- **Secondary**: Encrypted external drive (off-site)
- **Tertiary**: Hardware security module backup

### Backup Schedule

- **Frequency**: After each key rotation
- **Retention**: 7 years (compliance requirement)
- **Testing**: Quarterly restoration tests

## Key Revocation

### When to Revoke

Revoke keys immediately if:
- Private key is compromised
- Passphrase is exposed
- Unauthorized access detected
- Employee with key access leaves
- Security audit recommends it

### Revocation Procedure

```bash
# Run revocation script
node scripts/revoke-key.js \
  --reason "Security incident" \
  --incident-id "INC-2024-001"
```

The script will:
1. Mark key as revoked in metadata
2. Generate new key pair
3. Update database
4. Notify administrators
5. Log revocation event

### Post-Revocation

1. Audit all signatures created with revoked key
2. Re-sign critical reports if necessary
3. Investigate root cause
4. Update security procedures
5. File incident report

## Security Best Practices

### Access Control

**Principle of Least Privilege**:
- Only authorized personnel access private keys
- Use role-based access control
- Log all key access attempts
- Review access logs regularly

**Multi-Person Control**:
- Require two people for key operations
- Split passphrase knowledge
- Implement approval workflows

### Monitoring

Monitor for:
- Unauthorized key access attempts
- Unusual signature patterns
- Failed verification attempts
- Key file modifications
- Passphrase brute force attempts

### Audit Logging

Log all key operations:

```javascript
async function logKeyOperation(operation, userId, details) {
  await db.collection('key_audit_log').insertOne({
    operation, // 'generate', 'rotate', 'revoke', 'access'
    userId,
    timestamp: new Date(),
    ipAddress: req.ip,
    userAgent: req.headers['user-agent'],
    details,
    success: true
  });
}
```

### Network Security

- Use TLS 1.3 for all communications
- Implement certificate pinning
- Use VPN for remote key access
- Restrict key server access by IP

## Compliance Requirements

### FDA 21 CFR Part 11

✅ **Required**:
- Unique keys per individual
- Key generation documentation
- Key usage audit trail
- Key archival for verification
- Compromise reporting

### HIPAA Security Rule

✅ **Required**:
- Encryption at rest and in transit
- Access controls and logging
- Regular security assessments
- Incident response procedures
- Business associate agreements

### SOC 2 Type II

✅ **Required**:
- Documented key management procedures
- Regular key rotation
- Access reviews
- Security testing
- Vendor management

## Troubleshooting

### Problem: Cannot Load Private Key

**Symptoms**: Error loading private key file

**Solutions**:
1. Check file exists: `ls -la keys/signature-private.pem`
2. Check permissions: `stat keys/signature-private.pem`
3. Verify passphrase in .env
4. Check file is not corrupted: `openssl rsa -check -in keys/signature-private.pem`

### Problem: Signature Verification Fails

**Symptoms**: Valid signatures fail verification

**Solutions**:
1. Check key version matches
2. Verify report data hasn't changed
3. Check public key is correct version
4. Verify signature format (base64)

### Problem: Passphrase Incorrect

**Symptoms**: "bad decrypt" error

**Solutions**:
1. Verify passphrase in .env
2. Check for extra spaces/newlines
3. Ensure passphrase matches key
4. Restore from backup if lost

### Problem: Performance Issues

**Symptoms**: Slow signature operations

**Solutions**:
1. Implement key caching
2. Use connection pooling
3. Consider HSM for high volume
4. Optimize signature verification

## Scripts Reference

### Available Scripts

```bash
# Generate new key pair
node scripts/generate-signature-keys.js

# Verify keys are working
node scripts/verify-signature-keys.js

# Rotate keys
node scripts/rotate-keys.js

# Revoke compromised key
node scripts/revoke-key.js --reason "reason" --incident-id "id"

# Backup keys
./scripts/backup-keys.sh

# Restore keys
./scripts/restore-keys.sh <backup-file>

# Audit key usage
node scripts/audit-key-usage.js --since "30 days ago"
```

## Support

For key management issues:

- **Security Team**: security@yourdomain.com
- **System Admin**: admin@yourdomain.com
- **Emergency**: +1-XXX-XXX-XXXX (24/7)

## References

- [FDA 21 CFR Part 11](https://www.fda.gov/regulatory-information/search-fda-guidance-documents/part-11-electronic-records-electronic-signatures-scope-and-application)
- [NIST SP 800-57](https://csrc.nist.gov/publications/detail/sp/800-57-part-1/rev-5/final) - Key Management
- [HIPAA Security Rule](https://www.hhs.gov/hipaa/for-professionals/security/index.html)
- [OpenSSL Documentation](https://www.openssl.org/docs/)

---

**Document Version**: 1.0  
**Last Updated**: 2024-01-01  
**Next Review**: 2024-07-01  
**Owner**: Security Team
