# HIPAA Security Measures - Quick Reference

## Overview

This document provides a quick reference for the security measures implemented in the Medical Imaging System to ensure HIPAA compliance.

---

## Encryption

### PHI Encryption Service

**Location**: `server/src/services/encryption-service.js`

**Algorithm**: AES-256-GCM (Advanced Encryption Standard with Galois/Counter Mode)

**Usage**:
```javascript
const encryptionService = require('./services/encryption-service');

// Encrypt data
const encrypted = encryptionService.encrypt(sensitiveData);
// Returns: { encrypted, iv, authTag, algorithm }

// Decrypt data
const decrypted = encryptionService.decrypt(encrypted);

// Encrypt notification
const encryptedNotif = encryptionService.encryptNotification(notification);

// Encrypt audit log
const encryptedAudit = encryptionService.encryptAuditLog(auditLog);

// Encrypt session data
const encryptedSession = encryptionService.encryptSessionData(sessionData);
```

**Configuration**:
```bash
PHI_ENCRYPTION_KEY=<64-character-hex-string>
PHI_ENCRYPTION_ALGORITHM=aes-256-gcm
PHI_ENCRYPTION_ENABLED=true
```

**Generate Encryption Key**:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

## Access Logging

### PHI Access Logger

**Location**: `server/src/services/phi-access-logger.js`

**Usage**:
```javascript
const phiAccessLogger = require('./services/phi-access-logger');

// Log patient access
await phiAccessLogger.logPatientAccess(
  userId, userName, userRole,
  patientId, patientName,
  'view', // action
  ipAddress, userAgent, sessionId
);

// Log study access
await phiAccessLogger.logStudyAccess(
  userId, userName, userRole,
  studyId, patientId, patientName,
  'view',
  ipAddress, userAgent, sessionId
);

// Log report access
await phiAccessLogger.logReportAccess(
  userId, userName, userRole,
  reportId, patientId, patientName,
  'edit',
  ipAddress, userAgent, sessionId
);

// Log export operation
await phiAccessLogger.logExport(
  userId, userName, userRole,
  reportId, patientId, patientName,
  'pdf', // format
  ipAddress, userAgent, sessionId,
  recipient, purpose
);

// Log notification delivery
await phiAccessLogger.logNotificationDelivery(
  notificationId, recipientId, recipientName,
  patientId, patientName,
  'email', // channel
  true, // success
  null // errorMessage
);
```

**API Endpoints**:
```
GET  /api/phi-audit/report
GET  /api/phi-audit/statistics
GET  /api/phi-audit/user/:userId
GET  /api/phi-audit/patient/:patientId
GET  /api/phi-audit/failed-accesses
GET  /api/phi-audit/exports
GET  /api/phi-audit/unusual-access/:userId
GET  /api/phi-audit/export-csv
```

---

## Data Retention

### Data Retention Service

**Location**: `server/src/services/data-retention-service.js`

**Retention Periods**:
- Audit Logs: 7 years (2555 days)
- PHI Access Logs: 7 years (2555 days)
- Notifications: 7 years (2555 days)
- Export History: 7 years (2555 days)
- Digital Signatures: 7 years (2555 days)
- Reports: 10 years (3650 days)
- Studies: 10 years (3650 days)
- Sessions: 90 days

**Usage**:
```javascript
const dataRetentionService = require('./services/data-retention-service');

// Get retention policy
const retentionDays = dataRetentionService.getRetentionPolicy('auditLogs');

// Calculate expiration date
const expirationDate = dataRetentionService.calculateExpirationDate('auditLogs');

// Archive audit logs
await dataRetentionService.archiveAuditLogs('2023-01-01', '2023-12-31');

// Delete expired data
await dataRetentionService.deleteExpiredData('sessions');

// Run automated archival
await dataRetentionService.runAutomatedArchival();
```

**Automated Archival**:
- Schedule: Daily at 2:00 AM
- Job: `server/src/jobs/data-retention-job.js`
- Archives: Stored in `./archives/` directory

**API Endpoints**:
```
GET    /api/data-retention/policies
GET    /api/data-retention/archives/statistics
POST   /api/data-retention/archive/audit-logs
POST   /api/data-retention/archive/phi-access-logs
POST   /api/data-retention/archive/notifications
POST   /api/data-retention/archive/export-history
DELETE /api/data-retention/expired/:dataType
POST   /api/data-retention/run-archival
GET    /api/data-retention/expiration/:dataType
```

---

## Authentication & Authorization

### Session Management

**Access Token Expiry**: 30 minutes
**Refresh Token Expiry**: 7 days
**Session Timeout**: 30 minutes of inactivity
**Max Concurrent Sessions**: 3 per user

### Role-Based Access Control (RBAC)

**Roles**:
- `admin`: Full system access
- `physician`: View/edit reports, sign reports, export data
- `radiologist`: View/edit reports, sign reports, AI analysis
- `technician`: Upload studies, view studies, basic reporting
- `compliance_officer`: Audit logs, compliance reports

**Middleware Usage**:
```javascript
const { authenticateToken, requireRole } = require('./middleware/auth');

// Protect endpoint with authentication
router.get('/api/patients/:id', 
  authenticateToken,
  async (req, res) => {
    // Handler
  }
);

// Protect endpoint with role requirement
router.get('/api/phi-audit/report',
  authenticateToken,
  requireRole(['admin', 'compliance_officer']),
  async (req, res) => {
    // Handler
  }
);
```

---

## Audit Reports

### Available Reports

1. **PHI Access Report**
   - Endpoint: `GET /api/phi-audit/report`
   - Filters: userId, patientId, resourceType, action, startDate, endDate
   - Export: CSV format available

2. **Access Statistics**
   - Endpoint: `GET /api/phi-audit/statistics`
   - Metrics: Total accesses, unique users, unique patients, failed accesses

3. **User Activity Report**
   - Endpoint: `GET /api/phi-audit/user/:userId`
   - Shows: Recent accesses by specific user

4. **Patient Access Report**
   - Endpoint: `GET /api/phi-audit/patient/:patientId`
   - Shows: All accesses to specific patient's data

5. **Failed Access Report**
   - Endpoint: `GET /api/phi-audit/failed-accesses`
   - Shows: Failed authentication and authorization attempts

6. **Export Operations Report**
   - Endpoint: `GET /api/phi-audit/exports`
   - Shows: All data export operations

7. **Unusual Access Detection**
   - Endpoint: `GET /api/phi-audit/unusual-access/:userId`
   - Detects: Access patterns 3x above user's average

---

## Testing

### Encryption Testing

**Test Script**: `server/test-phi-encryption.js`

```bash
cd server
node test-phi-encryption.js
```

**Tests**:
- Basic string encryption/decryption
- Object encryption/decryption
- Notification encryption
- Audit log encryption
- Session data encryption
- Hash verification

---

## Configuration

### Environment Variables

```bash
# PHI Encryption
PHI_ENCRYPTION_KEY=<64-char-hex>
PHI_ENCRYPTION_ALGORITHM=aes-256-gcm
PHI_ENCRYPTION_ENABLED=true

# PHI Access Logging
PHI_ACCESS_LOG_PATH=./logs/phi-access.log
PHI_LOG_RETENTION_DAYS=2555
PHI_ACCESS_LOGGING_ENABLED=true

# Data Retention
AUDIT_RETENTION_DAYS=2555
NOTIFICATION_RETENTION_DAYS=2555
EXPORT_RETENTION_DAYS=2555
SIGNATURE_RETENTION_DAYS=2555
SESSION_RETENTION_DAYS=90
REPORT_RETENTION_DAYS=3650
STUDY_RETENTION_DAYS=3650
ARCHIVE_PATH=./archives
ENABLE_AUTO_ARCHIVAL=true
RETENTION_JOB_SCHEDULE=0 2 * * *

# Session Management
SESSION_TIMEOUT_MS=1800000
MAX_CONCURRENT_SESSIONS=3
ACCESS_TOKEN_EXPIRY=1800
REFRESH_TOKEN_EXPIRY=604800

# Compliance
HIPAA_COMPLIANCE_MODE=true
AUDIT_ALL_OPERATIONS=true
```

---

## Database Models

### PHI Access Log Model

**Location**: `server/src/models/PHIAccessLog.js`

**Schema**:
```javascript
{
  timestamp: Date,
  eventType: String,
  userId: String,
  userName: String,
  userRole: String,
  action: String,
  resourceType: String,
  resourceId: String,
  patientId: Mixed,
  patientName: Mixed,
  ipAddress: Mixed,
  userAgent: Mixed,
  sessionId: String,
  purpose: String,
  success: Boolean,
  errorMessage: String,
  metadata: Mixed
}
```

**Indexes**:
- `{ userId: 1, timestamp: -1 }`
- `{ patientId: 1, timestamp: -1 }`
- `{ resourceType: 1, action: 1, timestamp: -1 }`
- `{ success: 1, timestamp: -1 }`
- TTL index for automatic deletion after retention period

---

## Incident Response

### Unusual Access Detection

```javascript
const phiAccessLogger = require('./services/phi-access-logger');

// Detect unusual access for a user
const analysis = await phiAccessLogger.detectUnusualAccess(userId, 60);

if (analysis.unusual) {
  console.log(`Unusual access detected for user ${userId}`);
  console.log(`Recent accesses: ${analysis.recentAccesses}`);
  console.log(`Average per hour: ${analysis.averagePerHour}`);
  console.log(`Threshold: ${analysis.threshold}`);
  
  // Alert security officer
  // ...
}
```

### Failed Access Monitoring

```javascript
// Get failed access attempts
const failedAccesses = await PHIAccessLog.getFailedAccesses(
  startDate,
  endDate,
  limit
);

// Check for suspicious patterns
// - Multiple failed attempts from same IP
// - Failed attempts for multiple users from same IP
// - Failed attempts outside business hours
```

---

## Best Practices

### 1. Always Log PHI Access

```javascript
// GOOD: Log access before returning data
await phiAccessLogger.logPatientAccess(
  req.user.id, req.user.name, req.user.role,
  patientId, patientName,
  'view',
  req.ip, req.get('user-agent'), req.sessionId
);
return res.json({ patient });

// BAD: Return data without logging
return res.json({ patient });
```

### 2. Encrypt Sensitive Data

```javascript
// GOOD: Encrypt before storing
const encrypted = encryptionService.encrypt(sensitiveData);
await database.save({ data: encrypted });

// BAD: Store unencrypted
await database.save({ data: sensitiveData });
```

### 3. Use Role-Based Access Control

```javascript
// GOOD: Check authorization
router.get('/api/patients/:id',
  authenticateToken,
  requireRole(['physician', 'radiologist']),
  handler
);

// BAD: No authorization check
router.get('/api/patients/:id', handler);
```

### 4. Handle Errors Securely

```javascript
// GOOD: Log error, return generic message
try {
  // ...
} catch (error) {
  console.error('Error:', error);
  await phiAccessLogger.logFailedAccess(
    userId, userName, userRole,
    'patient', patientId,
    'view', error.message,
    ipAddress, userAgent, sessionId
  );
  return res.status(500).json({ error: 'Access denied' });
}

// BAD: Expose error details
catch (error) {
  return res.status(500).json({ error: error.message });
}
```

---

## Monitoring

### Key Metrics to Monitor

1. **Failed Login Attempts**
   - Alert threshold: >5 attempts in 5 minutes

2. **Unusual Access Patterns**
   - Alert threshold: >3x average access rate

3. **Export Operations**
   - Monitor bulk exports
   - Verify export purposes

4. **Session Anomalies**
   - Multiple concurrent sessions from different locations
   - Session hijacking attempts

5. **Encryption Failures**
   - Monitor encryption/decryption errors
   - Alert on key access failures

---

## Support

### Security Issues

Report security issues to: security@yourdomain.com

### Privacy Concerns

Report privacy concerns to: privacy@yourdomain.com

### Compliance Questions

Contact compliance officer: compliance@yourdomain.com

---

## References

- [HIPAA Compliance Documentation](./HIPAA_COMPLIANCE.md)
- [HIPAA Compliance Checklist](./HIPAA_COMPLIANCE_CHECKLIST.md)
- [Encryption Service](../server/src/services/encryption-service.js)
- [PHI Access Logger](../server/src/services/phi-access-logger.js)
- [Data Retention Service](../server/src/services/data-retention-service.js)
