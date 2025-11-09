/**
 * Integration Test: FDA Digital Signature Workflow End-to-End
 * Tests the complete signature lifecycle including signing, verification, and revocation
 */

const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../../src/index');
const DigitalSignature = require('../../src/models/DigitalSignature');
const Report = require('../../src/models/Report');
const User = require('../../src/models/User');

describe('FDA Digital Signature Workflow - End-to-End', () => {
  let authToken;
  let testUser;
  let testReport;

  beforeAll(async () => {
    // Connect to test database
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/pacs-test', {
        useNewUrlParser: true,
        useUnifiedTopology: true
      });
    }
  });

  afterAll(async () => {
    // Cleanup
    await DigitalSignature.deleteMany({});
    await Report.deleteMany({});
    await User.deleteMany({});
    await mongoose.connection.close();
  });

  beforeEach(async () => {
    // Create test user
    testUser = await User.create({
      username: 'test-radiologist',
      email: 'radiologist@test.com',
      password: 'Test123!',
      role: 'radiologist',
      firstName: 'Test',
      lastName: 'Radiologist'
    });

    // Login to get auth token
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({
        username: 'test-radiologist',
        password: 'Test123!'
      });

    authToken = loginRes.body.token;

    // Create test report
    testReport = await Report.create({
      patientInfo: {
        name: 'John Doe',
        id: 'PAT-12345',
        birthDate: '1980-01-01',
        sex: 'M'
      },
      studyInfo: {
        studyInstanceUID: '1.2.3.4.5',
        studyDate: new Date(),
        modality: 'CT',
        accessionNumber: 'ACC-12345'
      },
      clinicalHistory: 'Chest pain',
      findings: 'Normal chest CT. No acute findings.',
      impression: 'No acute cardiopulmonary disease.',
      status: 'final',
      authorId: testUser._id,
      authorName: `${testUser.firstName} ${testUser.lastName}`
    });
  });

  afterEach(async () => {
    await DigitalSignature.deleteMany({});
    await Report.deleteMany({});
    await User.deleteMany({});
  });

  describe('Report Signing', () => {
    test('should sign report with valid credentials', async () => {
      const signatureData = {
        reportId: testReport._id.toString(),
        meaning: 'author',
        password: 'Test123!'
      };

      const response = await request(app)
        .post('/api/signatures/sign')
        .set('Authorization', `Bearer ${authToken}`)
        .send(signatureData)
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.reportId).toBe(testReport._id.toString());
      expect(response.body.signerId).toBe(testUser._id.toString());
      expect(response.body.meaning).toBe('author');
      expect(response.body.status).toBe('valid');
      expect(response.body.algorithm).toBe('RSA-SHA256');
      expect(response.body.signatureHash).toBeTruthy();
      expect(response.body.auditTrail).toHaveLength(1);
      expect(response.body.auditTrail[0].action).toBe('created');
    });

    test('should reject signing with incorrect password', async () => {
      const signatureData = {
        reportId: testReport._id.toString(),
        meaning: 'author',
        password: 'WrongPassword123!'
      };

      const response = await request(app)
        .post('/api/signatures/sign')
        .set('Authorization', `Bearer ${authToken}`)
        .send(signatureData)
        .expect(401);

      expect(response.body.error).toBeTruthy();
    });

    test('should reject signing already signed report', async () => {
      // First signature
      await request(app)
        .post('/api/signatures/sign')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          reportId: testReport._id.toString(),
          meaning: 'author',
          password: 'Test123!'
        })
        .expect(201);

      // Second signature attempt
      const response = await request(app)
        .post('/api/signatures/sign')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          reportId: testReport._id.toString(),
          meaning: 'author',
          password: 'Test123!'
        });

      expect([400, 409]).toContain(response.status);
    });

    test('should create audit trail entry on signing', async () => {
      const response = await request(app)
        .post('/api/signatures/sign')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          reportId: testReport._id.toString(),
          meaning: 'author',
          password: 'Test123!'
        })
        .expect(201);

      const signature = await DigitalSignature.findById(response.body.id);
      expect(signature.auditTrail).toHaveLength(1);
      expect(signature.auditTrail[0]).toMatchObject({
        action: 'created',
        userId: testUser._id.toString(),
        result: 'success'
      });
      expect(signature.auditTrail[0].ipAddress).toBeTruthy();
    });
  });

  describe('Signature Verification', () => {
    let signatureId;

    beforeEach(async () => {
      // Create a signed report
      const response = await request(app)
        .post('/api/signatures/sign')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          reportId: testReport._id.toString(),
          meaning: 'author',
          password: 'Test123!'
        });

      signatureId = response.body.id;
    });

    test('should verify valid signature', async () => {
      const response = await request(app)
        .get(`/api/signatures/verify/${signatureId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.valid).toBe(true);
      expect(response.body.signature).toBeTruthy();
      expect(response.body.signature.status).toBe('valid');
      expect(response.body.reportHash).toBeTruthy();
      expect(response.body.verifiedAt).toBeTruthy();
    });

    test('should detect tampered report', async () => {
      // Modify the report after signing
      await Report.findByIdAndUpdate(testReport._id, {
        findings: 'MODIFIED FINDINGS - This should invalidate the signature'
      });

      const response = await request(app)
        .get(`/api/signatures/verify/${signatureId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.valid).toBe(false);
      expect(response.body.errors).toBeTruthy();
      expect(response.body.errors.length).toBeGreaterThan(0);
    });

    test('should add verification to audit trail', async () => {
      await request(app)
        .get(`/api/signatures/verify/${signatureId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const signature = await DigitalSignature.findById(signatureId);
      const verificationEntries = signature.auditTrail.filter(
        entry => entry.action === 'verified'
      );
      expect(verificationEntries.length).toBeGreaterThan(0);
    });
  });

  describe('Signature Revocation', () => {
    let signatureId;

    beforeEach(async () => {
      // Create a signed report
      const response = await request(app)
        .post('/api/signatures/sign')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          reportId: testReport._id.toString(),
          meaning: 'author',
          password: 'Test123!'
        });

      signatureId = response.body.id;
    });

    test('should revoke signature with valid reason', async () => {
      const response = await request(app)
        .post(`/api/signatures/revoke/${signatureId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          reason: 'Report contains errors and needs to be corrected',
          password: 'Test123!'
        })
        .expect(200);

      expect(response.body.success).toBe(true);

      // Verify signature status
      const signature = await DigitalSignature.findById(signatureId);
      expect(signature.status).toBe('revoked');
      expect(signature.revocationReason).toBe('Report contains errors and needs to be corrected');
      expect(signature.revokedBy).toBe(testUser._id.toString());
      expect(signature.revokedAt).toBeTruthy();
    });

    test('should add revocation to audit trail', async () => {
      await request(app)
        .post(`/api/signatures/revoke/${signatureId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          reason: 'Test revocation',
          password: 'Test123!'
        })
        .expect(200);

      const signature = await DigitalSignature.findById(signatureId);
      const revocationEntry = signature.auditTrail.find(
        entry => entry.action === 'revoked'
      );
      expect(revocationEntry).toBeTruthy();
      expect(revocationEntry.result).toBe('success');
    });

    test('should reject verification of revoked signature', async () => {
      // Revoke signature
      await request(app)
        .post(`/api/signatures/revoke/${signatureId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          reason: 'Test revocation',
          password: 'Test123!'
        });

      // Try to verify
      const response = await request(app)
        .get(`/api/signatures/verify/${signatureId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.signature.status).toBe('revoked');
    });
  });

  describe('Audit Trail', () => {
    let signatureId;

    beforeEach(async () => {
      // Create and manipulate a signature
      const signResponse = await request(app)
        .post('/api/signatures/sign')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          reportId: testReport._id.toString(),
          meaning: 'author',
          password: 'Test123!'
        });

      signatureId = signResponse.body.id;

      // Verify it
      await request(app)
        .get(`/api/signatures/verify/${signatureId}`)
        .set('Authorization', `Bearer ${authToken}`);
    });

    test('should retrieve complete audit trail', async () => {
      const response = await request(app)
        .get(`/api/signatures/audit-trail/${testReport._id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);
      
      // Should have creation and verification events
      const actions = response.body.map(event => event.action);
      expect(actions).toContain('created');
      expect(actions).toContain('verified');
    });

    test('should include all required audit information', async () => {
      const response = await request(app)
        .get(`/api/signatures/audit-trail/${testReport._id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const auditEvent = response.body[0];
      expect(auditEvent).toHaveProperty('action');
      expect(auditEvent).toHaveProperty('userId');
      expect(auditEvent).toHaveProperty('timestamp');
      expect(auditEvent).toHaveProperty('ipAddress');
      expect(auditEvent).toHaveProperty('result');
      expect(auditEvent).toHaveProperty('details');
    });
  });

  describe('Signed Report Access', () => {
    let signatureId;

    beforeEach(async () => {
      const response = await request(app)
        .post('/api/signatures/sign')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          reportId: testReport._id.toString(),
          meaning: 'author',
          password: 'Test123!'
        });

      signatureId = response.body.id;
    });

    test('should prevent editing of signed report', async () => {
      const response = await request(app)
        .put(`/api/reports/${testReport._id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          findings: 'Attempting to modify signed report'
        });

      expect([403, 400]).toContain(response.status);
    });

    test('should validate signature on report access', async () => {
      const response = await request(app)
        .post('/api/signatures/validate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          reportId: testReport._id.toString()
        })
        .expect(200);

      expect(response.body.valid).toBe(true);
      expect(response.body.signature).toBeTruthy();
    });
  });
});
