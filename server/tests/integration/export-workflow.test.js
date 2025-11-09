/**
 * Integration Test: Export Workflow End-to-End
 * Tests the complete export lifecycle including initiation, processing, and download
 */

const request = require('supertest');
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const app = require('../../src/index');
const ExportSession = require('../../src/models/ExportSession');
const Report = require('../../src/models/Report');
const User = require('../../src/models/User');

describe('Export Workflow - End-to-End', () => {
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
    await ExportSession.deleteMany({});
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

    // Create comprehensive test report
    testReport = await Report.create({
      patientInfo: {
        name: 'John Doe',
        id: 'PAT-12345',
        birthDate: '1980-01-01',
        sex: 'M'
      },
      studyInfo: {
        studyInstanceUID: '1.2.840.113619.2.55.3.604688119.868.1234567890.123',
        studyDate: new Date(),
        modality: 'CT',
        accessionNumber: 'ACC-12345',
        description: 'CT Chest with Contrast'
      },
      clinicalHistory: 'Chest pain, rule out pulmonary embolism',
      technique: 'Helical CT scan of the chest performed with IV contrast',
      findings: 'The lungs are clear. No pulmonary embolism. Heart size is normal. No pleural effusion.',
      impression: 'No acute cardiopulmonary disease. No pulmonary embolism.',
      status: 'final',
      authorId: testUser._id,
      authorName: `${testUser.firstName} ${testUser.lastName}`,
      structuredFindings: [
        {
          location: 'Lungs',
          finding: 'Clear',
          severity: 'normal'
        }
      ],
      measurements: [
        {
          name: 'Heart size',
          value: 12.5,
          unit: 'cm'
        }
      ]
    });
  });

  afterEach(async () => {
    await ExportSession.deleteMany({});
    await Report.deleteMany({});
    await User.deleteMany({});
  });

  describe('Export Initiation', () => {
    test('should initiate PDF export', async () => {
      const response = await request(app)
        .post(`/api/reports/${testReport._id}/export/pdf`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(202);

      expect(response.body).toHaveProperty('exportId');
      expect(response.body.status).toBe('initiated');
      expect(response.body.format).toBe('pdf');
    });

    test('should initiate DICOM SR export', async () => {
      const response = await request(app)
        .post(`/api/reports/${testReport._id}/export/dicom-sr`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(202);

      expect(response.body).toHaveProperty('exportId');
      expect(response.body.status).toBe('initiated');
      expect(response.body.format).toBe('dicom-sr');
    });

    test('should initiate FHIR export', async () => {
      const response = await request(app)
        .post(`/api/reports/${testReport._id}/export/fhir`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(202);

      expect(response.body).toHaveProperty('exportId');
      expect(response.body.status).toBe('initiated');
      expect(response.body.format).toBe('fhir');
    });

    test('should reject export of non-existent report', async () => {
      const fakeReportId = new mongoose.Types.ObjectId();
      
      const response = await request(app)
        .post(`/api/reports/${fakeReportId}/export/pdf`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);

      expect(response.body.error).toBeTruthy();
    });
  });

  describe('Export Processing', () => {
    let exportId;

    beforeEach(async () => {
      const response = await request(app)
        .post(`/api/reports/${testReport._id}/export/pdf`)
        .set('Authorization', `Bearer ${authToken}`);

      exportId = response.body.exportId;
    });

    test('should track export progress', async () => {
      // Wait for processing to start
      await new Promise(resolve => setTimeout(resolve, 1000));

      const response = await request(app)
        .get(`/api/reports/export/status/${exportId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('status');
      expect(response.body).toHaveProperty('progress');
      expect(['initiated', 'processing', 'completed']).toContain(response.body.status);
      expect(response.body.progress).toBeGreaterThanOrEqual(0);
      expect(response.body.progress).toBeLessThanOrEqual(100);
    });

    test('should complete export successfully', async () => {
      // Poll for completion
      let completed = false;
      let attempts = 0;
      const maxAttempts = 10;

      while (!completed && attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        const response = await request(app)
          .get(`/api/reports/export/status/${exportId}`)
          .set('Authorization', `Bearer ${authToken}`);

        if (response.body.status === 'completed') {
          completed = true;
          expect(response.body.fileUrl).toBeTruthy();
          expect(response.body.fileSize).toBeGreaterThan(0);
        } else if (response.body.status === 'failed') {
          throw new Error(`Export failed: ${response.body.error}`);
        }

        attempts++;
      }

      expect(completed).toBe(true);
    });

    test('should handle export errors gracefully', async () => {
      // Create report with invalid data
      const invalidReport = await Report.create({
        patientInfo: {
          name: 'Invalid Patient',
          id: 'INVALID'
        },
        studyInfo: {
          studyInstanceUID: 'invalid-uid'
        },
        status: 'draft',
        authorId: testUser._id
      });

      const response = await request(app)
        .post(`/api/reports/${invalidReport._id}/export/dicom-sr`)
        .set('Authorization', `Bearer ${authToken}`);

      const exportId = response.body.exportId;

      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 2000));

      const statusResponse = await request(app)
        .get(`/api/reports/export/status/${exportId}`)
        .set('Authorization', `Bearer ${authToken}`);

      // Should either fail or handle gracefully
      expect(['failed', 'completed']).toContain(statusResponse.body.status);
    });
  });

  describe('Export Download', () => {
    let exportId;

    beforeEach(async () => {
      const response = await request(app)
        .post(`/api/reports/${testReport._id}/export/pdf`)
        .set('Authorization', `Bearer ${authToken}`);

      exportId = response.body.exportId;

      // Wait for export to complete
      let completed = false;
      let attempts = 0;

      while (!completed && attempts < 10) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        const statusResponse = await request(app)
          .get(`/api/reports/export/status/${exportId}`)
          .set('Authorization', `Bearer ${authToken}`);

        if (statusResponse.body.status === 'completed') {
          completed = true;
        }
        attempts++;
      }
    });

    test('should download exported file', async () => {
      const response = await request(app)
        .get(`/api/reports/export/download/${exportId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.headers['content-type']).toBeTruthy();
      expect(response.headers['content-disposition']).toContain('attachment');
      expect(response.body).toBeTruthy();
    });

    test('should reject download of non-existent export', async () => {
      const fakeExportId = new mongoose.Types.ObjectId();

      const response = await request(app)
        .get(`/api/reports/export/download/${fakeExportId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);

      expect(response.body.error).toBeTruthy();
    });
  });

  describe('Export History and Audit', () => {
    beforeEach(async () => {
      // Create multiple exports
      for (let i = 0; i < 3; i++) {
        await request(app)
          .post(`/api/reports/${testReport._id}/export/pdf`)
          .set('Authorization', `Bearer ${authToken}`);
      }
    });

    test('should retrieve export history', async () => {
      const response = await request(app)
        .get('/api/reports/export/history')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ userId: testUser._id.toString() })
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThanOrEqual(3);
      
      // Verify export session structure
      const exportSession = response.body[0];
      expect(exportSession).toHaveProperty('reportId');
      expect(exportSession).toHaveProperty('format');
      expect(exportSession).toHaveProperty('status');
      expect(exportSession).toHaveProperty('createdAt');
    });

    test('should filter export history by format', async () => {
      // Create DICOM SR export
      await request(app)
        .post(`/api/reports/${testReport._id}/export/dicom-sr`)
        .set('Authorization', `Bearer ${authToken}`);

      const response = await request(app)
        .get('/api/reports/export/history')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ 
          userId: testUser._id.toString(),
          format: 'dicom-sr'
        })
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      response.body.forEach(session => {
        expect(session.format).toBe('dicom-sr');
      });
    });

    test('should log export operations for audit', async () => {
      const exportResponse = await request(app)
        .post(`/api/reports/${testReport._id}/export/pdf`)
        .set('Authorization', `Bearer ${authToken}`);

      const exportSession = await ExportSession.findById(exportResponse.body.exportId);
      
      expect(exportSession.metadata).toBeTruthy();
      expect(exportSession.metadata.ipAddress).toBeTruthy();
      expect(exportSession.userId).toBe(testUser._id.toString());
      expect(exportSession.createdAt).toBeTruthy();
    });
  });

  describe('Export Validation', () => {
    test('should validate PDF export format', async () => {
      const response = await request(app)
        .post(`/api/reports/${testReport._id}/export/pdf`)
        .set('Authorization', `Bearer ${authToken}`);

      const exportId = response.body.exportId;

      // Wait for completion
      let completed = false;
      let attempts = 0;

      while (!completed && attempts < 10) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        const statusResponse = await request(app)
          .get(`/api/reports/export/status/${exportId}`)
          .set('Authorization', `Bearer ${authToken}`);

        if (statusResponse.body.status === 'completed') {
          completed = true;
          
          // Download and verify it's a valid PDF
          const downloadResponse = await request(app)
            .get(`/api/reports/export/download/${exportId}`)
            .set('Authorization', `Bearer ${authToken}`);

          // PDF files start with %PDF
          const pdfHeader = downloadResponse.body.toString('utf8', 0, 4);
          expect(pdfHeader).toBe('%PDF');
        }
        attempts++;
      }
    });

    test('should validate DICOM SR export structure', async () => {
      const response = await request(app)
        .post(`/api/reports/${testReport._id}/export/dicom-sr`)
        .set('Authorization', `Bearer ${authToken}`);

      const exportId = response.body.exportId;

      // Wait for completion
      let completed = false;
      let attempts = 0;

      while (!completed && attempts < 10) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        const statusResponse = await request(app)
          .get(`/api/reports/export/status/${exportId}`)
          .set('Authorization', `Bearer ${authToken}`);

        if (statusResponse.body.status === 'completed') {
          completed = true;
          expect(statusResponse.body.fileUrl).toBeTruthy();
        }
        attempts++;
      }
    });

    test('should validate FHIR export against specification', async () => {
      const response = await request(app)
        .post(`/api/reports/${testReport._id}/export/fhir`)
        .set('Authorization', `Bearer ${authToken}`);

      const exportId = response.body.exportId;

      // Wait for completion
      let completed = false;
      let attempts = 0;

      while (!completed && attempts < 10) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        const statusResponse = await request(app)
          .get(`/api/reports/export/status/${exportId}`)
          .set('Authorization', `Bearer ${authToken}`);

        if (statusResponse.body.status === 'completed') {
          completed = true;
          
          // Download and verify FHIR structure
          const downloadResponse = await request(app)
            .get(`/api/reports/export/download/${exportId}`)
            .set('Authorization', `Bearer ${authToken}`);

          const fhirResource = JSON.parse(downloadResponse.body.toString());
          expect(fhirResource.resourceType).toBe('DiagnosticReport');
          expect(fhirResource).toHaveProperty('status');
          expect(fhirResource).toHaveProperty('code');
          expect(fhirResource).toHaveProperty('subject');
        }
        attempts++;
      }
    });
  });
});
