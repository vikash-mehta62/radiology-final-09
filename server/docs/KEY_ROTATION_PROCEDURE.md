# Signature Key Rotation Procedure

## Overview

This document describes the procedure for rotating cryptographic keys used for FDA 21 CFR Part 11 compliant digital signatures. Key rotation is a critical security practice that limits the exposure window if a key is compromised.

## When to Rotate Keys

Keys should be rotated in the following scenarios:

1. **Scheduled Rotation**: Every 12-24 months as part of regular security maintenance
2. **Security Incident**: Immediately if key compromise is suspected
3. **Personnel Changes**: When key custodians leave the organization
4. **Compliance Requirements**: As required by organizational security policies
5. **Algorithm Updates**: When upgrading to stronger cryptographic algorithms

## Key Rotation Process

### Prerequisites

- Administrative access to the server
- Backup of current keys
- Notification to all system users about planned maintenance
- Verification that all pending signatures are completed

### Step 1: Backup Current System

```bash
# Backup current keys directory
cd server
cp -r keys keys-backup-$(date +%Y%m%d)

# Backup database
mongodump --db medical_imaging --out backup-$(date +%Y%m%d)
```

### Step 2: Verify Current Key Status

```javascript
// Check current key version and status
const cryptoService = require('./src/services/crypto-service');
const keyInfo = cryptoService.getKeyInfo();
console.log('Current Key Version:', keyInfo.currentVersion);
console.log('Archived Versions:', keyInfo.archivedVersions);
console.log('Rotation History:', keyInfo.rotationHistory);
```

### Step 3: Perform Key Rotation

```javascript
// Rotate keys with reason
const cryptoService = require('./src/services/crypto-service');
const result = cryptoService.rotateKeys('Scheduled annual rotation');
console.log('Rotation Result:', result);
```

### Step 4: Verify New Keys

```javascript
// Test new keys
const testData = 'Test data for signature verification';
const signature = cryptoService.generateSignature(testData);
const isValid = cryptoService.verifySignature(testData, signature);
console.log('New keys working:', isValid);
```

### Step 5: Verify Old Signatures

```javascript
// Verify that old signatures can still be verified
const signatureService = require('./src/services/signature-service');

// Get a recent signature
const recentSignature = await DigitalSignature.findOne()
  .sort({ timestamp: -1 });

if (recentSignature) {
  const verification = await signatureService.verifySignature(
    recentSignature._id.toString()
  );
  console.log('Old signature verification:', verification.valid);
}
```

### Step 6: Update Documentation

1. Record rotation in key rotation log (automatic)
2. Update security documentation
3. Notify compliance officer
4. Update disaster recovery procedures

### Step 7: Monitor System

- Monitor signature creation and verification for 24-48 hours
- Check audit logs for any verification failures
- Verify that new signatures are created with new key version

## Key Storage and Security

### Current Keys

- **Location**: `server/keys/`
- **Files**:
  - `signature-private.pem` - Private key (encrypted with passphrase)
  - `signature-public.pem` - Public key
  - `key-version.txt` - Current key version
  - `rotation-log.json` - Rotation history

### Archived Keys

- **Location**: `server/keys/archive/`
- **Retention**: Permanent (required for signature verification)
- **Files**: Timestamped key pairs from previous rotations

### Security Measures

1. **File Permissions**:
   - Private keys: `0600` (owner read/write only)
   - Public keys: `0644` (owner read/write, others read)
   - Keys directory: `0700` (owner access only)

2. **Encryption**:
   - Private keys encrypted with passphrase
   - Passphrase stored in environment variable
   - Never commit keys to version control

3. **Access Control**:
   - Only system administrators can access keys directory
   - All key access logged in audit trail
   - Multi-factor authentication required for key operations

## Key Versioning

Keys are versioned sequentially:
- `v1` - Initial key pair
- `v2` - First rotation
- `v3` - Second rotation
- etc.

Each signature stores the key version used to create it, ensuring proper verification even after multiple rotations.

## Troubleshooting

### Problem: Old signatures fail verification after rotation

**Solution**: Ensure archived keys are properly loaded:

```javascript
const cryptoService = require('./src/services/crypto-service');
cryptoService.loadArchivedKeys(keysDir);
```

### Problem: New signatures fail to create

**Solution**: Verify new keys are properly generated:

```bash
ls -la server/keys/
cat server/keys/key-version.txt
```

### Problem: Key rotation fails

**Solution**: Restore from backup:

```bash
cd server
rm -rf keys
cp -r keys-backup-YYYYMMDD keys
```

## Compliance Notes

### FDA 21 CFR Part 11 Requirements

- **11.50(a)**: Signed records must contain information associated with the signing
  - ✅ Key version stored with each signature
  
- **11.70**: Signature/record linking must be maintained
  - ✅ Archived keys allow verification of old signatures
  
- **11.100**: General requirements for electronic records
  - ✅ Complete audit trail of all key rotations

### Audit Trail

All key rotations are logged with:
- Timestamp
- Old and new key versions
- Reason for rotation
- Person who performed rotation
- Archived key location

## Emergency Procedures

### Suspected Key Compromise

1. **Immediate Actions**:
   ```javascript
   // Rotate keys immediately
   cryptoService.rotateKeys('EMERGENCY: Suspected key compromise');
   
   // Revoke all signatures created with compromised key
   // (Manual review required)
   ```

2. **Investigation**:
   - Review audit logs for unauthorized access
   - Identify potentially affected signatures
   - Notify security team and compliance officer

3. **Recovery**:
   - Generate incident report
   - Update security procedures
   - Conduct security training

## Scheduled Maintenance

Recommended schedule:
- **Annual Rotation**: Every 12 months
- **Key Review**: Every 6 months
- **Audit Log Review**: Monthly
- **Backup Verification**: Weekly

## Contact Information

- **Security Team**: security@hospital.org
- **Compliance Officer**: compliance@hospital.org
- **System Administrator**: sysadmin@hospital.org

## References

- FDA 21 CFR Part 11
- NIST SP 800-57: Key Management Recommendations
- Hospital Information Security Policy
- Disaster Recovery Plan

---

**Last Updated**: 2025-01-03
**Document Version**: 1.0
**Next Review Date**: 2025-07-03
