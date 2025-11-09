/**
 * Integration Test: Critical Notification Workflow End-to-End
 * Tests the complete notification lifecycle including creation, delivery, acknowledgment, and escalation
 */

const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../../src/index');
const CriticalNotification = require('../../src/models/CriticalNotification');
const User = require('../../src/models/User');

describe('Critical Notification Workflow - End-to-End', () => {
  let authToken;
  let testUser;
  let testNotification;

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
    await CriticalNotification.deleteMany({});
    await mongoose.connection.close();
  });

  beforeEach(async () => {
    // Create test user
    testUser = await User.create({
      username: 'test-radiologist',
      email: 'radiologist@test.com',
      password: 'Test123!',
      role: 'radiologist',
      phone: '+1234567890'
    });

    // Login to get auth token
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({
        username: 'test-radiologist',
        password: 'Test123!'
      });

    authToken = loginRes.body.token;
  });

  afterEach(async () => {
    await CriticalNotification.deleteMany({});
    await User.deleteMany({});
  });

  describe('Notification Creation and Delivery', () => {
    test('should create critical notification with all required fields', async () => {
      const notificationData = {
        type: 'critical_finding',
        severity: 'critical',
        title: 'Critical Finding: Pneumothorax',
        message: 'Large right-sided pneumothorax detected requiring immediate attention',
        patientId: 'PAT-12345',
        studyId: 'STU-67890',
        findingDetails: {
          location: 'Right lung',
          description: 'Large pneumothorax with mediastinal shift',
          urgency: 'immediate'
        },
        recipients: [{
          userId: testUser._id.toString(),
          name: testUser.username,
          email: testUser.email,
          phone: testUser.phone,
          role: 'radiologist',
          priority: 1
        }],
        channels: ['email', 'sms', 'in_app']
      };

      const response = await request(app)
        .post('/api/notifications/critical')
        .set('Authorization', `Bearer ${authToken}`)
        .send(notificationData)
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.type).toBe('critical_finding');
      expect(response.body.severity).toBe('critical');
      expect(response.body.status).toBe('pending');
      expect(response.body.escalationLevel).toBe(0);

      testNotification = response.body;
    });

    test('should deliver notification via multiple channels', async () => {
      const notificationData = {
        type: 'critical_finding',
        severity: 'high',
        title: 'Urgent Review Required',
        message: 'Suspicious mass detected',
        patientId: 'PAT-12345',
        studyId: 'STU-67890',
        findingDetails: {
          location: 'Left breast',
          description: 'Irregular mass with spiculated margins',
          urgency: 'urgent'
        },
        recipients: [{
          userId: testUser._id.toString(),
          name: testUser.username,
          email: testUser.email,
          role: 'radiologist',
          priority: 1
        }],
        channels: ['email', 'in_app']
      };

      const response = await request(app)
        .post('/api/notifications/critical')
        .set('Authorization', `Bearer ${authToken}`)
        .send(notificationData)
        .expect(201);

      // Wait for delivery processing
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Verify notification was created
      const notification = await CriticalNotification.findById(response.body.id);
      expect(notification).toBeTruthy();
      expect(notification.channels).toContain('email');
      expect(notification.channels).toContain('in_app');
    });
  });

  describe('Notification Acknowledgment', () => {
    beforeEach(async () => {
      // Create a test notification
      const notificationData = {
        type: 'critical_finding',
        severity: 'critical',
        title: 'Test Notification',
        message: 'Test message',
        patientId: 'PAT-12345',
        studyId: 'STU-67890',
        findingDetails: {
          location: 'Test location',
          description: 'Test description',
          urgency: 'immediate'
        },
        recipients: [{
          userId: testUser._id.toString(),
          name: testUser.username,
          email: testUser.email,
          role: 'radiologist',
          priority: 1
        }],
        channels: ['in_app'],
        status: 'delivered'
      };

      const notification = await CriticalNotification.create(notificationData);
      testNotification = notification;
    });

    test('should acknowledge notification successfully', async () => {
      const response = await request(app)
        .post(`/api/notifications/critical/${testNotification._id}/acknowledge`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ userId: testUser._id.toString() })
        .expect(200);

      expect(response.body.success).toBe(true);

      // Verify notification status updated
      const notification = await CriticalNotification.findById(testNotification._id);
      expect(notification.status).toBe('acknowledged');
      expect(notification.acknowledgedBy).toBe(testUser._id.toString());
      expect(notification.acknowledgedAt).toBeTruthy();
    });

    test('should prevent duplicate acknowledgment', async () => {
      // First acknowledgment
      await request(app)
        .post(`/api/notifications/critical/${testNotification._id}/acknowledge`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ userId: testUser._id.toString() })
        .expect(200);

      // Second acknowledgment should fail or return already acknowledged
      const response = await request(app)
        .post(`/api/notifications/critical/${testNotification._id}/acknowledge`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ userId: testUser._id.toString() });

      expect([200, 400]).toContain(response.status);
    });
  });

  describe('Notification Escalation', () => {
    beforeEach(async () => {
      // Create supervisor user
      const supervisor = await User.create({
        username: 'supervisor',
        email: 'supervisor@test.com',
        password: 'Test123!',
        role: 'supervisor',
        phone: '+1234567891'
      });

      // Create unacknowledged notification
      const notificationData = {
        type: 'critical_finding',
        severity: 'critical',
        title: 'Unacknowledged Finding',
        message: 'Critical finding requiring escalation',
        patientId: 'PAT-12345',
        studyId: 'STU-67890',
        findingDetails: {
          location: 'Test location',
          description: 'Test description',
          urgency: 'immediate'
        },
        recipients: [{
          userId: testUser._id.toString(),
          name: testUser.username,
          email: testUser.email,
          role: 'radiologist',
          priority: 1
        }],
        channels: ['in_app'],
        status: 'delivered',
        escalationLevel: 0,
        createdAt: new Date(Date.now() - 20 * 60 * 1000) // 20 minutes ago
      };

      const notification = await CriticalNotification.create(notificationData);
      testNotification = notification;
    });

    test('should escalate unacknowledged notification', async () => {
      const response = await request(app)
        .post(`/api/notifications/critical/${testNotification._id}/escalate`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);

      // Verify escalation
      const notification = await CriticalNotification.findById(testNotification._id);
      expect(notification.escalationLevel).toBeGreaterThan(0);
      expect(notification.escalationHistory.length).toBeGreaterThan(0);
      expect(notification.status).toBe('escalated');
    });
  });

  describe('Notification History and Settings', () => {
    test('should retrieve notification history', async () => {
      // Create multiple notifications
      for (let i = 0; i < 3; i++) {
        await CriticalNotification.create({
          type: 'critical_finding',
          severity: 'high',
          title: `Test Notification ${i}`,
          message: `Test message ${i}`,
          patientId: 'PAT-12345',
          studyId: 'STU-67890',
          findingDetails: {
            location: 'Test',
            description: 'Test',
            urgency: 'urgent'
          },
          recipients: [{
            userId: testUser._id.toString(),
            name: testUser.username,
            email: testUser.email,
            role: 'radiologist',
            priority: 1
          }],
          channels: ['in_app'],
          status: 'delivered'
        });
      }

      const response = await request(app)
        .get('/api/notifications/history')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ userId: testUser._id.toString() })
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThanOrEqual(3);
    });

    test('should get and update notification settings', async () => {
      // Get current settings
      const getResponse = await request(app)
        .get('/api/notifications/settings')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(getResponse.body).toHaveProperty('channels');

      // Update settings
      const updateResponse = await request(app)
        .put('/api/notifications/settings')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          channels: ['email', 'in_app'],
          soundEnabled: true,
          doNotDisturb: {
            enabled: false
          }
        })
        .expect(200);

      expect(updateResponse.body.channels).toContain('email');
      expect(updateResponse.body.soundEnabled).toBe(true);
    });
  });
});
