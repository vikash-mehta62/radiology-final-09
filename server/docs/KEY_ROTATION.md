# Digital Signature Key Rotation Procedure

## Overview

This document describes the procedure for rotating cryptographic keys used for FDA-compliant digital signatures. Key rotation is a critical security practice that limits the impact of potential key compromise and ensures long-term security.

## Key Rotation Schedule

- **Regular Rotation**: Every 12 months
- **Emergency Rotation**: Immediately upon suspected compromise
- **Compliance Rotation**: As required by regulatory changes

## Prerequisites

Before starting key rotation:

1. ✅ Backup current keys and metadata
2. ✅ Verify all pending signatures are completed
3. ✅ Notify system administrators
4. ✅ Schedule maintenance window (recommended: 2 hours)
5. ✅ Prepare rollback plan

## Key Rotation Procedure

### Step 1: Generate New Key Pair

```bash
# Navigate to server directory
cd server

# Run key generation script
node scripts/generate-signature-keys.js
```

This will create:
- `keys/signature-private.pem` (new private key)
- `keys/signature-public.pem` (new public key)
- `keys/key-metadata.json` (key metadata)

### Step 2: Archive Old Keys

```bash
# Create archive directory with timestamp
ARCHIVE_DIR="keys/archive/$(date +%Y%m%d_%H%M%S)"
mkdir -p "$ARCHIVE_DIR"

# Move old keys to archive
mv keys/signature-private.pem "$ARCHIVE_DIR/"
mv keys/signature-public.pem "$ARCHIVE_DIR/"
mv keys/key-metadata.json "$ARCHIVE_DIR/"

# Update archive metadata
echo "Archived on: $(date)" > "$ARCHIVE_DIR/ARCHIVED.txt"
echo "Reason: Scheduled rotation" >> "$ARCHIVE_DIR/ARCHIVED.txt"
```

### Step 3: Install New Keys

The new keys generated in Step 1 are already in place. Verify:

```bash
# Check new keys exist
ls -la keys/signature-*.pem

# Verify permissions (private key should be 600)
stat -c "%a %n" keys/signature-private.pem
```

### Step 4: Update Key Metadata in Database

```javascript
// Run this script to update key version in database
const updateKeyVersion = async () => {
  const metadata = require('./keys/key-metadata.json');
  
  await db.collection('system_config').updateOne(
    { key: 'signature_key_version' },
    { 
      $set: { 
        version: metadata.version,
        publicKeyFingerprint: metadata.publicKeyFingerprint,
        rotatedAt: new Date(),
        previousVersion: metadata.version - 1
      }
    },
    { upsert: true }
  );
  
  console.log('Key version updated in database');
};
```

### Step 5: Update Environment Configuration

Update `.env` file if passphrase changed:

```bash
SIGNATURE_KEY_PASSPHRASE=new_secure_passphrase_here
```

### Step 6: Restart Services

```bash
# Restart Node.js server
pm2 restart node-server

# Or if using Docker
docker-compose restart node-server
```

### Step 7: Verify New Keys

```bash
# Run verification script
node scripts/verify-signature-keys.js
```

Expected output:
```
✅ Private key loaded successfully
✅ Public key loaded successfully
✅ Key pair verification successful
✅ Signature generation test passed
✅ Signature verification test passed
```

### Step 8: Update Signature Verification Logic

The system should automatically handle multiple key versions. Verify:

1. Old signatures can still be verified with archived keys
2. New signatures use the new key
3. Key version is tracked in signature metadata

### Step 9: Document Rotation

Update the key rotation log:

```bash
echo "$(date): Key rotation completed. New version: $(cat keys/key-metadata.json | jq -r .version)" >> keys/ROTATION_LOG.txt
```

## Verification Signatures with Old Keys

When verifying signatures created with old keys:

```javascript
const verifyWithArchivedKey = async (signature, reportData) => {
  const keyVersion = signature.keyVersion;
  const publicKeyPath = `./keys/archive/${keyVersion}/signature-public.pem`;
  
  if (!fs.existsSync(publicKeyPath)) {
    throw new Error(`Public key for version ${keyVersion} not found`);
  }
  
  const publicKey = fs.readFileSync(publicKeyPath, 'utf8');
  const verify = crypto.createVerify('RSA-SHA256');
  verify.update(reportData);
  verify.end();
  
  return verify.verify(publicKey, signature.hash, 'base64');
};
```

## Emergency Key Rotation

In case of suspected key compromise:

### Immediate Actions (Within 1 hour)

1. **Revoke Compromised Key**
   ```bash
   node scripts/revoke-key.js --reason "Security incident" --incident-id "INC-2024-001"
   ```

2. **Generate New Keys Immediately**
   ```bash
   node scripts/generate-signature-keys.js --emergency
   ```

3. **Notify Security Team**
   - Send alert to security@yourdomain.com
   - Create incident ticket
   - Document timeline

4. **Audit Recent Signatures**
   ```bash
   node scripts/audit-signatures.js --since "24 hours ago" --key-version "compromised-version"
   ```

### Follow-up Actions (Within 24 hours)

1. Review all signatures created with compromised key
2. Re-sign critical reports if necessary
3. Investigate root cause
4. Update security procedures
5. File incident report

## Key Storage Best Practices

### Development Environment
- Store keys in `./keys` directory (gitignored)
- Use environment variables for passphrases
- Never commit keys to version control

### Production Environment
- Use Hardware Security Module (HSM) if available
- Use AWS KMS, Azure Key Vault, or HashiCorp Vault
- Implement key access logging
- Use separate keys per environment

### Key Backup
- Encrypt backups with strong passphrase
- Store in secure, off-site location
- Test backup restoration quarterly
- Document backup locations

## Key Access Control

### Who Can Access Keys

| Role | Private Key | Public Key | Passphrase |
|------|-------------|------------|------------|
| System Admin | ✅ | ✅ | ✅ |
| Security Officer | ✅ | ✅ | ✅ |
| Developer | ❌ | ✅ | ❌ |
| Radiologist | ❌ | ✅ | ❌ |

### Access Logging

All key access must be logged:

```javascript
const logKeyAccess = async (userId, action, keyType) => {
  await db.collection('key_access_log').insertOne({
    userId,
    action, // 'read', 'write', 'rotate', 'revoke'
    keyType, // 'private', 'public'
    timestamp: new Date(),
    ipAddress: req.ip,
    userAgent: req.headers['user-agent']
  });
};
```

## Compliance Requirements

### FDA 21 CFR Part 11

- ✅ Keys must be unique to each individual
- ✅ Key generation must be documented
- ✅ Key rotation must be logged
- ✅ Old keys must be archived for signature verification
- ✅ Key compromise must be reported

### HIPAA

- ✅ Keys must be encrypted at rest
- ✅ Key access must be logged
- ✅ Keys must be backed up securely
- ✅ Key rotation must occur regularly

### SOC 2

- ✅ Key management procedures must be documented
- ✅ Key rotation must be tested
- ✅ Key access must be restricted
- ✅ Key audits must be performed

## Troubleshooting

### Issue: Signature Verification Fails After Rotation

**Cause**: Old signatures trying to verify with new key

**Solution**: Ensure signature metadata includes key version:
```javascript
signature.keyVersion = currentKeyVersion;
```

### Issue: Private Key Cannot Be Loaded

**Cause**: Incorrect passphrase or corrupted key file

**Solution**: 
1. Verify passphrase in .env
2. Check key file permissions
3. Restore from backup if corrupted

### Issue: Performance Degradation After Rotation

**Cause**: Multiple key versions causing lookup overhead

**Solution**: Implement key version caching:
```javascript
const keyCache = new Map();
const getPublicKey = (version) => {
  if (!keyCache.has(version)) {
    keyCache.set(version, loadPublicKey(version));
  }
  return keyCache.get(version);
};
```

## Audit Checklist

Perform these checks after each key rotation:

- [ ] New keys generated successfully
- [ ] Old keys archived with proper metadata
- [ ] Key version updated in database
- [ ] Environment variables updated
- [ ] Services restarted successfully
- [ ] New signatures use new key
- [ ] Old signatures still verify correctly
- [ ] Key rotation logged in audit trail
- [ ] Security team notified
- [ ] Documentation updated
- [ ] Backup created and verified

## Contact Information

For key rotation issues:

- **Security Team**: security@yourdomain.com
- **System Admin**: admin@yourdomain.com
- **On-Call**: +1-XXX-XXX-XXXX

## References

- FDA 21 CFR Part 11: https://www.fda.gov/regulatory-information/search-fda-guidance-documents/part-11-electronic-records-electronic-signatures-scope-and-application
- NIST Key Management Guidelines: https://csrc.nist.gov/publications/detail/sp/800-57-part-1/rev-5/final
- HIPAA Security Rule: https://www.hhs.gov/hipaa/for-professionals/security/index.html

---

**Document Version**: 1.0  
**Last Updated**: 2024-01-01  
**Next Review**: 2024-07-01
