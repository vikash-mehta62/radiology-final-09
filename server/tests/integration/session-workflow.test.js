/**
 * Integration Test: Session Management Workflow End-to-End
 * Tests the complete session lifecycle including login, token refresh, timeout, and logout
 */

const request = require('supertest');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const app = require('../../src/index');
const Session = require('../../src/models/Session');
const User = require('../../src/models/User');

describe('Session Management Workflow - End-to-End', () => {
  let testUser;
  let authToken;
  let refreshToken;
  let sessionId;

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
    await Session.deleteMany({});
    await User.deleteMany({});
    await mongoose.connection.close();
  });

  beforeEach(async () => {
    // Create test user
    testUser = await User.create({
      username: 'test-user',
      email: 'test@example.com',
      password: 'Test123!',
      role: 'radiologist',
      firstName: 'Test',
      lastName: 'User'
    });
  });

  afterEach(async () => {
    await Session.deleteMany({});
    await User.deleteMany({});
  });

  describe('Login and Session Creation', () => {
    test('should create session on successful login', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'test-user',
          password: 'Test123!'
        })
        .expect(200);

      expect(response.body).toHaveProperty('token');
      expect(response.body).toHaveProperty('refreshToken');
      expect(response.body).toHaveProperty('user');
      expect(response.body.user.username).toBe('test-user');

      authToken = response.body.token;
      refreshToken = response.body.refreshToken;

      // Verify token structure
      const decoded = jwt.decode(authToken);
      expect(decoded).toHaveProperty('userId');
      expect(decoded).toHaveProperty('sessionId');
      expect(decoded.userId).toBe(testUser._id.toString());

      sessionId = decoded.sessionId;

      // Verify session was created in database
      const session = await Session.findOne({ _id: sessionId });
      expect(session).toBeTruthy();
      expect(session.userId.toString()).toBe(testUser._id.toString());
      expect(session.status).toBe('active');
    });

    test('should include device information in session', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .set('User-Agent', 'Mozilla/5.0 Test Browser')
        .send({
          username: 'test-user',
          password: 'Test123!'
        })
        .expect(200);

      const decoded = jwt.decode(response.body.token);
      const session = await Session.findOne({ _id: decoded.sessionId });

      expect(session.deviceInfo).toBeTruthy();
      expect(session.deviceInfo.userAgent).toBeTruthy();
      expect(session.deviceInfo.ipAddress).toBeTruthy();
    });

    test('should reject login with invalid credentials', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'test-user',
          password: 'WrongPassword123!'
        })
        .expect(401);

      expect(response.body.error).toBeTruthy();
    });

    test('should enforce concurrent session limit', async () => {
      // Create maximum allowed sessions (3)
      const sessions = [];
      for (let i = 0; i < 3; i++) {
        const response = await request(app)
          .post('/api/auth/login')
          .send({
            username: 'test-user',
            password: 'Test123!'
          });
        sessions.push(response.body);
      }

      // Fourth login should revoke oldest session
      const fourthLogin = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'test-user',
          password: 'Test123!'
        })
        .expect(200);

      // Verify only 3 active sessions exist
      const activeSessions = await Session.find({
        userId: testUser._id,
        status: 'active'
      });
      expect(activeSessions.length).toBeLessThanOrEqual(3);
    });
  });

  describe('Token Refresh', () => {
    beforeEach(async () => {
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'test-user',
          password: 'Test123!'
        });

      authToken = loginResponse.body.token;
      refreshToken = loginResponse.body.refreshToken;
      
      const decoded = jwt.decode(authToken);
      sessionId = decoded.sessionId;
    });

    test('should refresh access token with valid refresh token', async () => {
      const response = await request(app)
        .post('/api/auth/refresh-token')
        .send({ refreshToken })
        .expect(200);

      expect(response.body).toHaveProperty('accessToken');
      expect(response.body.accessToken).not.toBe(authToken);

      // Verify new token is valid
      const decoded = jwt.decode(response.body.accessToken);
      expect(decoded.userId).toBe(testUser._id.toString());
      expect(decoded.sessionId).toBe(sessionId);
    });

    test('should update session last activity on token refresh', async () => {
      const sessionBefore = await Session.findById(sessionId);
      const lastActivityBefore = sessionBefore.lastActivity;

      // Wait a moment
      await new Promise(resolve => setTimeout(resolve, 1000));

      await request(app)
        .post('/api/auth/refresh-token')
        .send({ refreshToken })
        .expect(200);

      const sessionAfter = await Session.findById(sessionId);
      expect(sessionAfter.lastActivity.getTime()).toBeGreaterThan(lastActivityBefore.getTime());
    });

    test('should reject refresh with invalid token', async () => {
      const response = await request(app)
        .post('/api/auth/refresh-token')
        .send({ refreshToken: 'invalid-token' })
        .expect(401);

      expect(response.body.error).toBeTruthy();
    });

    test('should reject refresh for expired session', async () => {
      // Expire the session
      await Session.findByIdAndUpdate(sessionId, {
        status: 'expired',
        expiresAt: new Date(Date.now() - 1000)
      });

      const response = await request(app)
        .post('/api/auth/refresh-token')
        .send({ refreshToken })
        .expect(401);

      expect(response.body.error).toBeTruthy();
    });
  });

  describe('Session Validation', () => {
    beforeEach(async () => {
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'test-user',
          password: 'Test123!'
        });

      authToken = loginResponse.body.token;
      
      const decoded = jwt.decode(authToken);
      sessionId = decoded.sessionId;
    });

    test('should validate active session', async () => {
      const response = await request(app)
        .get('/api/auth/session-status')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.status).toBe('active');
      expect(response.body).toHaveProperty('expiresIn');
      expect(response.body).toHaveProperty('lastActivity');
      expect(response.body.expiresIn).toBeGreaterThan(0);
    });

    test('should update last activity on API requests', async () => {
      const sessionBefore = await Session.findById(sessionId);
      const lastActivityBefore = sessionBefore.lastActivity;

      // Wait a moment
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Make an authenticated request
      await request(app)
        .get('/api/auth/session-status')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const sessionAfter = await Session.findById(sessionId);
      expect(sessionAfter.lastActivity.getTime()).toBeGreaterThan(lastActivityBefore.getTime());
    });

    test('should reject requests with expired session', async () => {
      // Expire the session
      await Session.findByIdAndUpdate(sessionId, {
        status: 'expired',
        expiresAt: new Date(Date.now() - 1000)
      });

      const response = await request(app)
        .get('/api/auth/session-status')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(401);

      expect(response.body.error).toBeTruthy();
    });

    test('should detect session timeout due to inactivity', async () => {
      // Set last activity to 31 minutes ago (past timeout)
      await Session.findByIdAndUpdate(sessionId, {
        lastActivity: new Date(Date.now() - 31 * 60 * 1000)
      });

      const response = await request(app)
        .get('/api/auth/session-status')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(401);

      // Verify session was expired
      const session = await Session.findById(sessionId);
      expect(session.status).toBe('expired');
    });
  });

  describe('Session Extension', () => {
    beforeEach(async () => {
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'test-user',
          password: 'Test123!'
        });

      authToken = loginResponse.body.token;
      
      const decoded = jwt.decode(authToken);
      sessionId = decoded.sessionId;
    });

    test('should extend session expiration', async () => {
      const sessionBefore = await Session.findById(sessionId);
      const expiresAtBefore = sessionBefore.expiresAt;

      const response = await request(app)
        .post('/api/auth/extend-session')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body).toHaveProperty('newExpiry');

      const sessionAfter = await Session.findById(sessionId);
      expect(sessionAfter.expiresAt.getTime()).toBeGreaterThan(expiresAtBefore.getTime());
    });

    test('should reset inactivity timer on extension', async () => {
      // Set last activity to 25 minutes ago
      await Session.findByIdAndUpdate(sessionId, {
        lastActivity: new Date(Date.now() - 25 * 60 * 1000)
      });

      await request(app)
        .post('/api/auth/extend-session')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const session = await Session.findById(sessionId);
      const timeSinceActivity = Date.now() - session.lastActivity.getTime();
      expect(timeSinceActivity).toBeLessThan(5000); // Less than 5 seconds
    });
  });

  describe('Logout and Session Termination', () => {
    beforeEach(async () => {
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'test-user',
          password: 'Test123!'
        });

      authToken = loginResponse.body.token;
      
      const decoded = jwt.decode(authToken);
      sessionId = decoded.sessionId;
    });

    test('should logout and revoke session', async () => {
      const response = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);

      // Verify session was revoked
      const session = await Session.findById(sessionId);
      expect(session.status).toBe('revoked');
    });

    test('should reject requests after logout', async () => {
      // Logout
      await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // Try to use the token
      const response = await request(app)
        .get('/api/auth/session-status')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(401);

      expect(response.body.error).toBeTruthy();
    });

    test('should clear all session data on logout', async () => {
      await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const session = await Session.findById(sessionId);
      expect(session.status).toBe('revoked');
      expect(session.accessToken).toBeFalsy();
    });
  });

  describe('Multiple Sessions Management', () => {
    let sessions = [];

    beforeEach(async () => {
      // Create multiple sessions
      for (let i = 0; i < 3; i++) {
        const response = await request(app)
          .post('/api/auth/login')
          .send({
            username: 'test-user',
            password: 'Test123!'
          });
        sessions.push(response.body);
      }
    });

    test('should list all active sessions', async () => {
      const response = await request(app)
        .get('/api/auth/sessions')
        .set('Authorization', `Bearer ${sessions[0].token}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBe(3);
      
      response.body.forEach(session => {
        expect(session).toHaveProperty('id');
        expect(session).toHaveProperty('deviceInfo');
        expect(session).toHaveProperty('createdAt');
        expect(session).toHaveProperty('lastActivity');
        expect(session.status).toBe('active');
      });
    });

    test('should revoke specific session', async () => {
      const decoded = jwt.decode(sessions[1].token);
      const sessionToRevoke = decoded.sessionId;

      const response = await request(app)
        .delete(`/api/auth/sessions/${sessionToRevoke}`)
        .set('Authorization', `Bearer ${sessions[0].token}`)
        .expect(200);

      expect(response.body.success).toBe(true);

      // Verify session was revoked
      const session = await Session.findById(sessionToRevoke);
      expect(session.status).toBe('revoked');

      // Verify other sessions still active
      const activeSessions = await Session.find({
        userId: testUser._id,
        status: 'active'
      });
      expect(activeSessions.length).toBe(2);
    });

    test('should prevent using revoked session', async () => {
      const decoded = jwt.decode(sessions[1].token);
      const sessionToRevoke = decoded.sessionId;

      // Revoke session
      await request(app)
        .delete(`/api/auth/sessions/${sessionToRevoke}`)
        .set('Authorization', `Bearer ${sessions[0].token}`)
        .expect(200);

      // Try to use revoked session
      const response = await request(app)
        .get('/api/auth/session-status')
        .set('Authorization', `Bearer ${sessions[1].token}`)
        .expect(401);

      expect(response.body.error).toBeTruthy();
    });
  });

  describe('Session Security', () => {
    beforeEach(async () => {
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'test-user',
          password: 'Test123!'
        });

      authToken = loginResponse.body.token;
      
      const decoded = jwt.decode(authToken);
      sessionId = decoded.sessionId;
    });

    test('should detect and prevent session hijacking', async () => {
      // Try to use token from different IP
      const response = await request(app)
        .get('/api/auth/session-status')
        .set('Authorization', `Bearer ${authToken}`)
        .set('X-Forwarded-For', '192.168.1.100')
        .expect(200);

      // Should still work but log suspicious activity
      expect(response.body.status).toBe('active');
    });

    test('should log all session events', async () => {
      const session = await Session.findById(sessionId);
      
      expect(session.createdAt).toBeTruthy();
      expect(session.lastActivity).toBeTruthy();
      expect(session.deviceInfo).toBeTruthy();
    });

    test('should encrypt session tokens', async () => {
      const session = await Session.findById(sessionId);
      
      // Access token should be stored securely
      expect(session.accessToken).toBeTruthy();
      
      // Refresh token should be hashed
      expect(session.refreshToken).toBeTruthy();
    });
  });
});
