# FDA 21 CFR Part 11 Compliance Checklist

## Purpose

This checklist ensures ongoing compliance with FDA 21 CFR Part 11 requirements for electronic records and electronic signatures. Use this checklist for:

- Daily operations verification
- Monthly compliance reviews
- Annual audits
- Regulatory inspections
- System validation

## Instructions

- Review each item regularly according to the specified frequency
- Check [✓] when requirement is met
- Document any issues in the "Notes" column
- Escalate non-compliance items immediately

---

## Part 1: Electronic Records (§11.10)

### System Validation

| Requirement | Status | Last Verified | Notes |
|------------|--------|---------------|-------|
| System validation documentation is complete and current | [ ] | __________ | |
| Validation includes accuracy testing | [ ] | __________ | |
| Validation includes reliability testing | [ ] | __________ | |
| Validation includes consistent performance testing | [ ] | __________ | |
| Revalidation performed after system changes | [ ] | __________ | |

### Record Generation and Copies

| Requirement | Status | Last Verified | Notes |
|------------|--------|---------------|-------|
| System can generate accurate copies of records | [ ] | __________ | |
| Copies include all metadata | [ ] | __________ | |
| Copies are human-readable | [ ] | __________ | |
| Copies can be provided to FDA upon request | [ ] | __________ | |

### Record Protection

| Requirement | Status | Last Verified | Notes |
|------------|--------|---------------|-------|
| Records protected throughout retention period | [ ] | __________ | |
| Backup procedures in place and tested | [ ] | __________ | |
| Disaster recovery plan documented | [ ] | __________ | |
| Records encrypted at rest | [ ] | __________ | |
| Records encrypted in transit | [ ] | __________ | |

### Access Control

| Requirement | Status | Last Verified | Notes |
|------------|--------|---------------|-------|
| System access limited to authorized individuals | [ ] | __________ | |
| Role-based access control implemented | [ ] | __________ | |
| User authentication required | [ ] | __________ | |
| Password complexity requirements enforced | [ ] | __________ | |
| Session timeout configured | [ ] | __________ | |
| Failed login attempts monitored | [ ] | __________ | |

### Audit Trails

| Requirement | Status | Last Verified | Notes |
|------------|--------|---------------|-------|
| Audit trails enabled for all signature operations | [ ] | __________ | |
| Audit trails capture date and time stamps | [ ] | __________ | |
| Audit trails capture user identification | [ ] | __________ | |
| Audit trails capture action performed | [ ] | __________ | |
| Audit trails are tamper-proof | [ ] | __________ | |
| Audit trails are encrypted | [ ] | __________ | |
| Audit trail integrity verified regularly | [ ] | __________ | |
| Audit trails retained for required period (7 years) | [ ] | __________ | |

### Authority Checks

| Requirement | Status | Last Verified | Notes |
|------------|--------|---------------|-------|
| System verifies user authority before allowing actions | [ ] | __________ | |
| Signature permissions based on user role | [ ] | __________ | |
| Administrative functions restricted | [ ] | __________ | |

### Device Checks

| Requirement | Status | Last Verified | Notes |
|------------|--------|---------------|-------|
| System validates data source | [ ] | __________ | |
| Device fingerprinting implemented | [ ] | __________ | |
| IP address validation configured | [ ] | __________ | |

### Training

| Requirement | Status | Last Verified | Notes |
|------------|--------|---------------|-------|
| Training program documented | [ ] | __________ | |
| All users completed initial training | [ ] | __________ | |
| Training records maintained | [ ] | __________ | |
| Annual retraining conducted | [ ] | __________ | |
| Training includes security procedures | [ ] | __________ | |
| Training includes compliance requirements | [ ] | __________ | |

### Accountability

| Requirement | Status | Last Verified | Notes |
|------------|--------|---------------|-------|
| Written policies hold individuals accountable | [ ] | __________ | |
| Policies signed by all users | [ ] | __________ | |
| Violations documented and addressed | [ ] | __________ | |

### Documentation Controls

| Requirement | Status | Last Verified | Notes |
|------------|--------|---------------|-------|
| System documentation is current | [ ] | __________ | |
| Documentation includes user manuals | [ ] | __________ | |
| Documentation includes technical specifications | [ ] | __________ | |
| Documentation includes validation records | [ ] | __________ | |
| Documentation version controlled | [ ] | __________ | |

---

## Part 2: Electronic Signatures (§11.50, §11.70, §11.100)

### Signature Manifestations (§11.50)

| Requirement | Status | Last Verified | Notes |
|------------|--------|---------------|-------|
| Signatures display printed name of signer | [ ] | __________ | |
| Signatures display date and time of signing | [ ] | __________ | |
| Signatures display meaning (author/reviewer/approver) | [ ] | __________ | |
| Signature information is clear and unambiguous | [ ] | __________ | |

### Signature/Record Linking (§11.70)

| Requirement | Status | Last Verified | Notes |
|------------|--------|---------------|-------|
| Signatures linked to their respective records | [ ] | __________ | |
| Signatures cannot be excised from records | [ ] | __________ | |
| Signatures cannot be copied to other records | [ ] | __________ | |
| Signatures cannot be transferred | [ ] | __________ | |
| Signed records cannot be modified | [ ] | __________ | |
| Modification attempts detected and logged | [ ] | __________ | |

### General Requirements (§11.100)

| Requirement | Status | Last Verified | Notes |
|------------|--------|---------------|-------|
| Each signer has unique identification | [ ] | __________ | |
| System verifies identity before signing | [ ] | __________ | |
| Users certified signatures are legally binding | [ ] | __________ | |

### Signature Components (§11.200)

| Requirement | Status | Last Verified | Notes |
|------------|--------|---------------|-------|
| Two distinct identification components required | [ ] | __________ | |
| Username and password both required | [ ] | __________ | |
| Password meets complexity requirements | [ ] | __________ | |
| Passwords periodically changed | [ ] | __________ | |

### Password Controls (§11.300)

| Requirement | Status | Last Verified | Notes |
|------------|--------|---------------|-------|
| Passwords unique to each individual | [ ] | __________ | |
| Passwords periodically checked and revised | [ ] | __________ | |
| Lost password procedures documented | [ ] | __________ | |
| Transaction safeguards in place | [ ] | __________ | |
| Device checks performed | [ ] | __________ | |

---

## Part 3: Cryptographic Implementation

### Key Management

| Requirement | Status | Last Verified | Notes |
|------------|--------|---------------|-------|
| RSA-2048 or stronger keys used | [ ] | __________ | |
| Keys generated securely | [ ] | __________ | |
| Private keys encrypted with passphrase | [ ] | __________ | |
| Keys stored with restricted permissions | [ ] | __________ | |
| Key access logged | [ ] | __________ | |
| Key rotation procedure documented | [ ] | __________ | |
| Key rotation performed annually | [ ] | __________ | |
| Old keys archived for verification | [ ] | __________ | |
| Key version tracked with each signature | [ ] | __________ | |

### Signature Generation

| Requirement | Status | Last Verified | Notes |
|------------|--------|---------------|-------|
| SHA-256 hash algorithm used | [ ] | __________ | |
| RSA-SHA256 signature algorithm used | [ ] | __________ | |
| Report serialization deterministic | [ ] | __________ | |
| Signature includes all required metadata | [ ] | __________ | |

### Signature Verification

| Requirement | Status | Last Verified | Notes |
|------------|--------|---------------|-------|
| Signatures verified on report access | [ ] | __________ | |
| Verification uses correct key version | [ ] | __________ | |
| Verification failures logged | [ ] | __________ | |
| Verification failures alerted | [ ] | __________ | |
| Invalid signatures prevent report modification | [ ] | __________ | |

---

## Part 4: Audit Trail Compliance

### Audit Log Content

| Requirement | Status | Last Verified | Notes |
|------------|--------|---------------|-------|
| All signature operations logged | [ ] | __________ | |
| Signature creation logged | [ ] | __________ | |
| Signature verification logged | [ ] | __________ | |
| Signature revocation logged | [ ] | __________ | |
| Report access logged | [ ] | __________ | |
| Export operations logged | [ ] | __________ | |

### Audit Log Integrity

| Requirement | Status | Last Verified | Notes |
|------------|--------|---------------|-------|
| Audit logs use hash chaining | [ ] | __________ | |
| Each entry digitally signed | [ ] | __________ | |
| Sequence numbers prevent gaps | [ ] | __________ | |
| Audit logs encrypted | [ ] | __________ | |
| Audit logs are append-only | [ ] | __________ | |
| Integrity verification performed regularly | [ ] | __________ | |

### Audit Log Management

| Requirement | Status | Last Verified | Notes |
|------------|--------|---------------|-------|
| Audit logs backed up daily | [ ] | __________ | |
| Audit logs retained for 7 years | [ ] | __________ | |
| Audit log search functionality available | [ ] | __________ | |
| Audit reports can be generated | [ ] | __________ | |
| Audit logs can be exported | [ ] | __________ | |

---

## Part 5: Operational Procedures

### Daily Operations

| Task | Completed | Date | Notes |
|------|-----------|------|-------|
| Review failed signature verifications | [ ] | __________ | |
| Check audit log integrity | [ ] | __________ | |
| Monitor system logs for errors | [ ] | __________ | |
| Verify backup completion | [ ] | __________ | |

### Weekly Operations

| Task | Completed | Date | Notes |
|------|-----------|------|-------|
| Generate compliance report | [ ] | __________ | |
| Review access logs | [ ] | __________ | |
| Check for security alerts | [ ] | __________ | |
| Test backup restoration | [ ] | __________ | |

### Monthly Operations

| Task | Completed | Date | Notes |
|------|-----------|------|-------|
| Comprehensive audit trail review | [ ] | __________ | |
| Key rotation review | [ ] | __________ | |
| Update compliance documentation | [ ] | __________ | |
| Review user access rights | [ ] | __________ | |
| Security patch review | [ ] | __________ | |

### Annual Operations

| Task | Completed | Date | Notes |
|------|-----------|------|-------|
| Full system validation | [ ] | __________ | |
| Regulatory compliance review | [ ] | __________ | |
| Cryptographic key rotation | [ ] | __________ | |
| User training refresh | [ ] | __________ | |
| Documentation update | [ ] | __________ | |
| External audit preparation | [ ] | __________ | |

---

## Part 6: Incident Response

### Signature Verification Failure

| Action | Completed | Date | Notes |
|--------|-----------|------|-------|
| Incident logged in audit trail | [ ] | __________ | |
| Security team notified | [ ] | __________ | |
| Affected report isolated | [ ] | __________ | |
| Root cause identified | [ ] | __________ | |
| Corrective action taken | [ ] | __________ | |
| Incident report filed | [ ] | __________ | |

### Key Compromise

| Action | Completed | Date | Notes |
|--------|-----------|------|-------|
| Keys rotated immediately | [ ] | __________ | |
| Affected signatures identified | [ ] | __________ | |
| Compliance officer notified | [ ] | __________ | |
| Security incident logged | [ ] | __________ | |
| Investigation conducted | [ ] | __________ | |
| Recovery plan executed | [ ] | __________ | |
| Procedures updated | [ ] | __________ | |

### Audit Trail Tampering

| Action | Completed | Date | Notes |
|--------|-----------|------|-------|
| Tampering detected and logged | [ ] | __________ | |
| System access restricted | [ ] | __________ | |
| Forensic investigation initiated | [ ] | __________ | |
| Backup logs reviewed | [ ] | __________ | |
| Regulatory authorities notified | [ ] | __________ | |
| Security measures enhanced | [ ] | __________ | |

---

## Part 7: Validation and Testing

### Signature Testing

| Test | Passed | Date | Notes |
|------|--------|------|-------|
| Signature creation test | [ ] | __________ | |
| Signature verification test | [ ] | __________ | |
| Duplicate signature prevention test | [ ] | __________ | |
| Modified report detection test | [ ] | __________ | |
| Signature revocation test | [ ] | __________ | |
| Key rotation test | [ ] | __________ | |

### Audit Trail Testing

| Test | Passed | Date | Notes |
|------|--------|------|-------|
| Chain integrity test | [ ] | __________ | |
| Tampering detection test | [ ] | __________ | |
| Encryption test | [ ] | __________ | |
| Sequence gap detection test | [ ] | __________ | |
| Export functionality test | [ ] | __________ | |

### Security Testing

| Test | Passed | Date | Notes |
|------|--------|------|-------|
| Authentication test | [ ] | __________ | |
| Authorization test | [ ] | __________ | |
| Session management test | [ ] | __________ | |
| Password complexity test | [ ] | __________ | |
| Penetration test | [ ] | __________ | |
| Vulnerability scan | [ ] | __________ | |

---

## Certification

### Monthly Review

I certify that I have reviewed this checklist and all items marked as complete have been verified.

**Reviewer Name**: _______________________________

**Title**: _______________________________

**Date**: _______________________________

**Signature**: _______________________________

### Annual Audit

I certify that a comprehensive audit has been conducted and the system is in compliance with FDA 21 CFR Part 11.

**Auditor Name**: _______________________________

**Title**: _______________________________

**Date**: _______________________________

**Signature**: _______________________________

---

## Non-Compliance Items

Document any items that are not in compliance:

| Item | Issue | Severity | Action Plan | Target Date | Status |
|------|-------|----------|-------------|-------------|--------|
| | | | | | |
| | | | | | |
| | | | | | |

**Severity Levels**:
- **Critical**: Immediate regulatory risk, must be resolved within 24 hours
- **High**: Significant compliance gap, must be resolved within 1 week
- **Medium**: Minor compliance issue, must be resolved within 1 month
- **Low**: Documentation or procedural improvement, resolve within 3 months

---

**Document Version**: 1.0
**Last Updated**: 2025-01-03
**Next Review Date**: 2025-02-03
