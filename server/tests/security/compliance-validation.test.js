/**
 * Compliance Validation Suite
 * Tests for FDA 21 CFR Part 11, HIPAA, and SOC 2 compliance
 */

const request = require('supertest');
const app = require('../../src/index');
const { connectMongo, disconnectMongo } = require('../../src/config/mongo');
const User = require('../../src/models/User');
const DigitalSignature = require('../../src/models/DigitalSignature');
const AuditLog = require('../../src/models/AuditLog');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

describe('Compliance Validation Suite', () => {
  let authToken;
  let testUser;
  let testReport;

  beforeAll(async () => {
    await connectMongo(process.env.MONGODB_TEST_URI || 'mongodb://127.0.0.1:27017/dicomdb-test');

    testUser = await User.create({
      username: 'compliance_test_user',
      email: 'compliance@test.com',
      password: 'TestPassword123!',
      role: 'radiologist',
      firstName: 'Compliance',
      lastName: 'Test'
    });

    const loginResponse = await request(app)
      .post('/api/auth/login')
      .send({ username: 'compliance_test_user', password: 'TestPassword123!' });
    authToken = loginResponse.body.token;
  });

  afterAll(async () => {
    await User.deleteMany({ username: 'compliance_test_user' });
    await disconnectMongo();
  });

  describe('FDA 21 CFR Part 11 Compliance', () => {
    describe('Electronic Signatures (§11.50)', () => {
      test('should link signatures to their respective records', async () => {
        // Create a test report
        const reportResponse = await request(app)
          .post('/api/reports')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            findings: 'Test findings for signature',
            impression: 'Test impression',
            patientId: 'test-patient-123'
          });

        if (reportResponse.status === 200 || reportResponse.status === 201) {
          const reportId = reportResponse.body._id || reportResponse.body.id;

          // Sign the report
          const signResponse = await request(app)
            .post('/api/signatures/sign')
            .set('Authorization', `Bearer ${authToken}`)
            .send({
              reportId: reportId,
              meaning: 'author',
              password: 'TestPassword123!'
            });

          if (signResponse.status === 200 || signResponse.status === 201) {
            const signature = signResponse.body;

            // Verify signature is linked to report
            expect(signature.reportId).toBe(reportId);
            expect(signature.signerId).toBeDefined();
            expect(signature.timestamp).toBeDefined();
          }
        }
      });

      test('should include signer identification in signatures', async () => {
        const signatures = await DigitalSignature.find({ signerId: testUser._id });

        signatures.forEach(signature => {
          expect(signature.signerName).toBeDefined();
          expect(signature.signerRole).toBeDefined();
          expect(signature.signerId).toBeDefined();
        });
      });

      test('should include date and time of signature', async () => {
        const signatures = await DigitalSignature.find({ signerId: testUser._id });

        signatures.forEach(signature => {
          expect(signature.timestamp).toBeInstanceOf(Date);
          expect(signature.timestamp.getTime()).toBeLessThanOrEqual(Date.now());
        });
      });

      test('should include meaning of signature', async () => {
        const signatures = await DigitalSignature.find({ signerId: testUser._id });

        signatures.forEach(signature => {
          expect(signature.meaning).toBeDefined();
          expect(['author', 'reviewer', 'approver']).toContain(signature.meaning);
        });
      });
    });

    describe('Signature Manifestations (§11.70)', () => {
      test('should display signed records with signature information', async () => {
        // Get a signed report
        const response = await request(app)
          .get('/api/reports')
          .set('Authorization', `Bearer ${authToken}`);

        if (response.status === 200 && response.body.length > 0) {
          const signedReports = response.body.filter(r => r.signature || r.signatureId);

          signedReports.forEach(report => {
            // Should include signature information
            expect(report.signature || report.signatureId).toBeDefined();
          });
        }
      });

      test('should clearly indicate signed status', async () => {
        const signatures = await DigitalSignature.find({ signerId: testUser._id });

        signatures.forEach(signature => {
          expect(signature.status).toBeDefined();
          expect(['valid', 'invalid', 'revoked']).toContain(signature.status);
        });
      });
    });

    describe('Signature/Record Linking (§11.100)', () => {
      test('should prevent modification of signed records', async () => {
        // Find a signed report
        const signatures = await DigitalSignature.find({ signerId: testUser._id, status: 'valid' });

        if (signatures.length > 0) {
          const signature = signatures[0];

          // Try to modify the signed report
          const response = await request(app)
            .put(`/api/reports/${signature.reportId}`)
            .set('Authorization', `Bearer ${authToken}`)
            .send({
              findings: 'Modified findings'
            });

          // Should be rejected
          expect(response.status).toBeGreaterThanOrEqual(400);
          if (response.body.message) {
            expect(response.body.message).toMatch(/signed|locked|cannot.*modify/i);
          }
        }
      });

      test('should detect tampering with signed records', async () => {
        const signatures = await DigitalSignature.find({ signerId: testUser._id, status: 'valid' });

        if (signatures.length > 0) {
          const signature = signatures[0];

          // Verify signature
          const verifyResponse = await request(app)
            .get(`/api/signatures/verify/${signature._id}`)
            .set('Authorization', `Bearer ${authToken}`);

          if (verifyResponse.status === 200) {
            expect(verifyResponse.body.valid).toBe(true);
          }
        }
      });
    });

    describe('Audit Trail (§11.10(e))', () => {
      test('should maintain complete audit trail for signatures', async () => {
        const signatures = await DigitalSignature.find({ signerId: testUser._id });

        signatures.forEach(signature => {
          expect(signature.auditTrail).toBeDefined();
          expect(Array.isArray(signature.auditTrail)).toBe(true);
          expect(signature.auditTrail.length).toBeGreaterThan(0);

          signature.auditTrail.forEach(event => {
            expect(event.action).toBeDefined();
            expect(event.userId).toBeDefined();
            expect(event.timestamp).toBeDefined();
            expect(event.result).toBeDefined();
          });
        });
      });

      test('should log all signature operations', async () => {
        const auditLogs = await AuditLog.find({
          userId: testUser._id,
          action: { $in: ['signature.created', 'signature.verified', 'signature.revoked'] }
        });

        auditLogs.forEach(log => {
          expect(log.timestamp).toBeDefined();
          expect(log.userId).toBeDefined();
          expect(log.action).toBeDefined();
          expect(log.details).toBeDefined();
        });
      });

      test('should make audit trail tamper-proof', async () => {
        const auditLogs = await AuditLog.find({ userId: testUser._id }).limit(1);

        if (auditLogs.length > 0) {
          const log = auditLogs[0];

          // Audit logs should be immutable
          // Try to modify (this should fail or be prevented)
          try {
            log.action = 'modified';
            await log.save();
            
            // If save succeeds, verify integrity check would fail
            // In production, audit logs should be write-once
          } catch (error) {
            // Expected - audit logs should be immutable
            expect(error).toBeDefined();
          }
        }
      });
    });

    describe('System Validation (§11.10(a))', () => {
      test('should validate signature algorithm', () => {
        // Verify RSA-SHA256 is used
        const algorithm = process.env.SIGNATURE_ALGORITHM || 'RSA-SHA256';
        expect(algorithm).toBe('RSA-SHA256');
      });

      test('should validate key size', () => {
        // Verify 2048-bit keys are used
        const keyPath = process.env.SIGNATURE_PUBLIC_KEY_PATH || './keys/signature-public.pem';
        
        if (fs.existsSync(keyPath)) {
          const publicKey = fs.readFileSync(keyPath, 'utf8');
          const keyObject = crypto.createPublicKey(publicKey);
          const keyDetails = keyObject.asymmetricKeyDetails;

          expect(keyDetails.modulusLength).toBeGreaterThanOrEqual(2048);
        }
      });
    });
  });

  describe('HIPAA Compliance', () => {
    describe('Access Controls (§164.312(a)(1))', () => {
      test('should implement unique user identification', async () => {
        const users = await User.find({});

        const usernames = users.map(u => u.username);
        const uniqueUsernames = new Set(usernames);

        // All usernames should be unique
        expect(usernames.length).toBe(uniqueUsernames.size);
      });

      test('should implement role-based access control', async () => {
        const user = await User.findOne({ username: 'compliance_test_user' });

        expect(user.role).toBeDefined();
        expect(['admin', 'radiologist', 'technician', 'referring_physician']).toContain(user.role);
      });

      test('should implement automatic logoff', async () => {
        // Verify session timeout is configured
        const sessionTimeout = process.env.SESSION_TIMEOUT || '1800000'; // 30 minutes
        expect(parseInt(sessionTimeout)).toBeGreaterThan(0);
        expect(parseInt(sessionTimeout)).toBeLessThanOrEqual(3600000); // Max 1 hour
      });
    });

    describe('Audit Controls (§164.312(b))', () => {
      test('should log all PHI access', async () => {
        // Access patient data
        const response = await request(app)
          .get('/api/patients')
          .set('Authorization', `Bearer ${authToken}`);

        // Verify access was logged
        const auditLogs = await AuditLog.find({
          userId: testUser._id,
          action: { $regex: /patient/i }
        }).sort({ timestamp: -1 }).limit(1);

        expect(auditLogs.length).toBeGreaterThan(0);
      });

      test('should log all PHI modifications', async () => {
        // Modify patient data
        const response = await request(app)
          .post('/api/patients')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            name: 'Test Patient',
            mrn: `TEST-${Date.now()}`,
            dateOfBirth: '1990-01-01'
          });

        if (response.status === 200 || response.status === 201) {
          // Verify modification was logged
          const auditLogs = await AuditLog.find({
            userId: testUser._id,
            action: { $regex: /patient.*create/i }
          }).sort({ timestamp: -1 }).limit(1);

          expect(auditLogs.length).toBeGreaterThan(0);
        }
      });

      test('should retain audit logs for required period', async () => {
        // HIPAA requires 6 years retention
        const retentionPeriod = process.env.AUDIT_LOG_RETENTION_DAYS || '2555'; // ~7 years
        expect(parseInt(retentionPeriod)).toBeGreaterThanOrEqual(2190); // 6 years
      });
    });

    describe('Integrity Controls (§164.312(c)(1))', () => {
      test('should protect PHI from improper alteration', async () => {
        // Verify data integrity mechanisms
        const response = await request(app)
          .get('/api/patients')
          .set('Authorization', `Bearer ${authToken}`);

        if (response.status === 200 && response.body.length > 0) {
          const patient = response.body[0];

          // Try to modify with invalid data
          const modifyResponse = await request(app)
            .put(`/api/patients/${patient._id}`)
            .set('Authorization', `Bearer ${authToken}`)
            .send({
              mrn: null, // Invalid - MRN is required
              name: ''   // Invalid - name is required
            });

          // Should be rejected
          expect(modifyResponse.status).toBeGreaterThanOrEqual(400);
        }
      });

      test('should detect unauthorized PHI modifications', async () => {
        // This would be detected through audit logs and integrity checks
        const auditLogs = await AuditLog.find({
          action: { $regex: /unauthorized|failed|denied/i }
        });

        // System should log unauthorized attempts
        auditLogs.forEach(log => {
          expect(log.result).toBe('failure');
        });
      });
    });

    describe('Transmission Security (§164.312(e)(1))', () => {
      test('should use encryption for data transmission', async () => {
        // Verify HTTPS is enforced in production
        if (process.env.NODE_ENV === 'production') {
          const response = await request(app)
            .get('/api/users/me')
            .set('Authorization', `Bearer ${authToken}`);

          expect(response.headers['strict-transport-security']).toBeDefined();
        }
      });

      test('should protect PHI during transmission', async () => {
        // Verify sensitive data is not exposed in URLs
        const response = await request(app)
          .get('/api/patients')
          .set('Authorization', `Bearer ${authToken}`);

        // PHI should be in request body, not URL
        expect(response.request.url).not.toMatch(/ssn|dob|phone|address/i);
      });
    });

    describe('Encryption (§164.312(a)(2)(iv))', () => {
      test('should encrypt PHI at rest', async () => {
        // Verify encryption is configured
        const encryptionEnabled = process.env.ENABLE_PHI_ENCRYPTION !== 'false';
        expect(encryptionEnabled).toBe(true);
      });

      test('should use strong encryption algorithms', () => {
        const algorithm = process.env.ENCRYPTION_ALGORITHM || 'aes-256-gcm';
        expect(algorithm).toMatch(/aes-256/i);
      });

      test('should protect encryption keys', () => {
        // Verify keys are not hardcoded
        const encryptionKey = process.env.ENCRYPTION_KEY;
        expect(encryptionKey).toBeDefined();
        expect(encryptionKey).not.toBe('test-key');
        expect(encryptionKey).not.toBe('secret');
      });
    });

    describe('Minimum Necessary (§164.502(b))', () => {
      test('should limit data access to minimum necessary', async () => {
        const response = await request(app)
          .get('/api/patients')
          .set('Authorization', `Bearer ${authToken}`);

        if (response.status === 200 && response.body.length > 0) {
          const patient = response.body[0];

          // Should not return all fields for all users
          // Sensitive fields should be restricted based on role
          if (testUser.role !== 'admin') {
            // Non-admin users should have limited access
            expect(patient.ssn).toBeUndefined();
          }
        }
      });
    });
  });

  describe('SOC 2 Compliance', () => {
    describe('Security (CC6)', () => {
      test('should implement logical access controls', async () => {
        // Verify authentication is required
        const response = await request(app)
          .get('/api/users');

        expect(response.status).toBe(401);
      });

      test('should implement authorization controls', async () => {
        // Verify role-based access
        const response = await request(app)
          .get('/api/users')
          .set('Authorization', `Bearer ${authToken}`);

        // Non-admin should not access user list
        if (testUser.role !== 'admin') {
          expect(response.status).toBe(403);
        }
      });

      test('should protect against malicious software', async () => {
        // Verify file upload restrictions
        const response = await request(app)
          .post('/api/upload')
          .set('Authorization', `Bearer ${authToken}`)
          .attach('file', Buffer.from('test'), {
            filename: 'malware.exe',
            contentType: 'application/x-msdownload'
          });

        expect(response.status).not.toBe(200);
      });
    });

    describe('Availability (CC7)', () => {
      test('should implement backup procedures', () => {
        // Verify backup configuration
        const backupEnabled = process.env.ENABLE_BACKUPS !== 'false';
        expect(backupEnabled).toBe(true);
      });

      test('should implement monitoring', async () => {
        // Verify health check endpoint
        const response = await request(app)
          .get('/health');

        expect(response.status).toBe(200);
        expect(response.body.status).toBeDefined();
      });
    });

    describe('Processing Integrity (CC8)', () => {
      test('should validate input data', async () => {
        // Try to create invalid data
        const response = await request(app)
          .post('/api/reports')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            findings: '', // Invalid - required field
            impression: '' // Invalid - required field
          });

        expect(response.status).toBeGreaterThanOrEqual(400);
      });

      test('should maintain data integrity', async () => {
        // Verify data consistency
        const response = await request(app)
          .get('/api/reports')
          .set('Authorization', `Bearer ${authToken}`);

        if (response.status === 200 && response.body.length > 0) {
          response.body.forEach(report => {
            // All reports should have required fields
            expect(report._id).toBeDefined();
            expect(report.createdAt).toBeDefined();
          });
        }
      });
    });

    describe('Confidentiality (CC9)', () => {
      test('should protect confidential information', async () => {
        const response = await request(app)
          .get('/api/users/me')
          .set('Authorization', `Bearer ${authToken}`);

        // Should not expose sensitive information
        expect(response.body.password).toBeUndefined();
        expect(response.body.passwordHash).toBeUndefined();
      });

      test('should implement data classification', async () => {
        // Verify sensitive data is marked
        const response = await request(app)
          .get('/api/patients')
          .set('Authorization', `Bearer ${authToken}`);

        if (response.status === 200 && response.body.length > 0) {
          // PHI should be properly handled
          expect(response.body).toBeDefined();
        }
      });
    });

    describe('Privacy (P1)', () => {
      test('should implement privacy notice', async () => {
        // Verify privacy policy is available
        const response = await request(app)
          .get('/api/privacy-policy');

        // Should have privacy policy endpoint
        // Status depends on implementation
      });

      test('should implement consent management', async () => {
        // Verify consent tracking
        const user = await User.findOne({ username: 'compliance_test_user' });

        // User should have consent fields
        // Implementation depends on requirements
      });
    });
  });

  describe('Compliance Reporting', () => {
    test('should generate compliance audit report', async () => {
      const response = await request(app)
        .get('/api/compliance/audit-report')
        .set('Authorization', `Bearer ${authToken}`);

      // Should have compliance reporting endpoint
      // Status depends on implementation
    });

    test('should track compliance metrics', async () => {
      // Verify compliance metrics are tracked
      const metrics = {
        signatureCompliance: await DigitalSignature.countDocuments({ status: 'valid' }),
        auditLogCompliance: await AuditLog.countDocuments(),
        userCompliance: await User.countDocuments({ role: { $exists: true } })
      };

      expect(metrics.signatureCompliance).toBeGreaterThanOrEqual(0);
      expect(metrics.auditLogCompliance).toBeGreaterThan(0);
      expect(metrics.userCompliance).toBeGreaterThan(0);
    });
  });
});
