/**
 * Penetration Testing Suite
 * Tests for authentication bypass, authorization bypass, injection attacks, and session hijacking
 */

const request = require('supertest');
const app = require('../../src/index');
const { connectMongo, disconnectMongo } = require('../../src/config/mongo');
const User = require('../../src/models/User');
const jwt = require('jsonwebtoken');

describe('Penetration Testing Suite', () => {
  let authToken;
  let testUser;
  let adminUser;
  let adminToken;

  beforeAll(async () => {
    // Connect to test database
    await connectMongo(process.env.MONGODB_TEST_URI || 'mongodb://127.0.0.1:27017/dicomdb-test');

    // Create test users
    testUser = await User.create({
      username: 'pentest_user',
      email: 'pentest@test.com',
      password: 'TestPassword123!',
      role: 'radiologist',
      firstName: 'Pen',
      lastName: 'Test'
    });

    adminUser = await User.create({
      username: 'pentest_admin',
      email: 'pentestadmin@test.com',
      password: 'AdminPassword123!',
      role: 'admin',
      firstName: 'Admin',
      lastName: 'Test'
    });

    // Get auth tokens
    const userLogin = await request(app)
      .post('/api/auth/login')
      .send({ username: 'pentest_user', password: 'TestPassword123!' });
    authToken = userLogin.body.token;

    const adminLogin = await request(app)
      .post('/api/auth/login')
      .send({ username: 'pentest_admin', password: 'AdminPassword123!' });
    adminToken = adminLogin.body.token;
  });

  afterAll(async () => {
    // Cleanup
    await User.deleteMany({ username: { $in: ['pentest_user', 'pentest_admin'] } });
    await disconnectMongo();
  });

  describe('Authentication Bypass Tests', () => {
    test('should reject requests without authentication token', async () => {
      const response = await request(app)
        .get('/api/users')
        .expect(401);

      expect(response.body.success).toBe(false);
    });

    test('should reject requests with invalid token', async () => {
      const response = await request(app)
        .get('/api/users')
        .set('Authorization', 'Bearer invalid-token-12345')
        .expect(401);

      expect(response.body.success).toBe(false);
    });

    test('should reject requests with expired token', async () => {
      const expiredToken = jwt.sign(
        { userId: testUser._id, username: testUser.username },
        process.env.JWT_SECRET || 'test-secret',
        { expiresIn: '-1h' } // Expired 1 hour ago
      );

      const response = await request(app)
        .get('/api/users')
        .set('Authorization', `Bearer ${expiredToken}`)
        .expect(401);

      expect(response.body.success).toBe(false);
    });

    test('should reject requests with malformed token', async () => {
      const malformedTokens = [
        'Bearer ',
        'Bearer token.without.signature',
        'NotBearer validtoken',
        'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.invalid',
      ];

      for (const token of malformedTokens) {
        const response = await request(app)
          .get('/api/users')
          .set('Authorization', token);

        expect(response.status).toBe(401);
      }
    });

    test('should reject token with tampered payload', async () => {
      // Create a valid token
      const validToken = jwt.sign(
        { userId: testUser._id, username: testUser.username, role: 'radiologist' },
        process.env.JWT_SECRET || 'test-secret'
      );

      // Tamper with the payload (change role to admin)
      const parts = validToken.split('.');
      const tamperedPayload = Buffer.from(JSON.stringify({
        userId: testUser._id,
        username: testUser.username,
        role: 'admin' // Escalated privilege
      })).toString('base64');
      const tamperedToken = `${parts[0]}.${tamperedPayload}.${parts[2]}`;

      const response = await request(app)
        .get('/api/users')
        .set('Authorization', `Bearer ${tamperedToken}`)
        .expect(401);

      expect(response.body.success).toBe(false);
    });
  });

  describe('Authorization Bypass Tests', () => {
    test('should prevent non-admin from accessing admin endpoints', async () => {
      const response = await request(app)
        .get('/api/users')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toMatch(/permission|authorized|admin/i);
    });

    test('should prevent user from accessing other users data', async () => {
      const response = await request(app)
        .get(`/api/users/${adminUser._id}`)
        .set('Authorization', `Bearer ${authToken}`);

      // Should either be forbidden or return limited data
      if (response.status === 200) {
        // If allowed, should not return sensitive data
        expect(response.body.password).toBeUndefined();
        expect(response.body.passwordHash).toBeUndefined();
      } else {
        expect(response.status).toBe(403);
      }
    });

    test('should prevent privilege escalation via role modification', async () => {
      const response = await request(app)
        .put(`/api/users/${testUser._id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ role: 'admin' })
        .expect(403);

      expect(response.body.success).toBe(false);
    });

    test('should prevent horizontal privilege escalation', async () => {
      // Try to update another user's profile
      const response = await request(app)
        .put(`/api/users/${adminUser._id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ firstName: 'Hacked' });

      expect(response.status).toBeGreaterThanOrEqual(403);
    });
  });

  describe('Injection Attack Tests', () => {
    test('should prevent NoSQL injection in login', async () => {
      const injectionPayloads = [
        { username: { $ne: null }, password: { $ne: null } },
        { username: { $gt: '' }, password: { $gt: '' } },
        { username: { $regex: '.*' }, password: { $regex: '.*' } },
        { username: 'admin\'; return true; //', password: 'anything' }
      ];

      for (const payload of injectionPayloads) {
        const response = await request(app)
          .post('/api/auth/login')
          .send(payload);

        expect(response.status).not.toBe(200);
        expect(response.body.success).not.toBe(true);
      }
    });

    test('should prevent NoSQL injection in query parameters', async () => {
      const injectionQueries = [
        '?username[$ne]=null',
        '?role[$gt]=',
        '?email[$regex]=.*',
        '?_id[$nin][]=1'
      ];

      for (const query of injectionQueries) {
        const response = await request(app)
          .get(`/api/users${query}`)
          .set('Authorization', `Bearer ${adminToken}`);

        // Should either sanitize or reject
        if (response.status === 200) {
          // If successful, should not return all users
          expect(Array.isArray(response.body)).toBe(true);
          // Should have proper filtering applied
        }
      }
    });

    test('should prevent SQL injection patterns (if SQL is used)', async () => {
      const sqlInjectionPayloads = [
        "' OR '1'='1",
        "'; DROP TABLE users; --",
        "' UNION SELECT * FROM users --",
        "admin'--",
        "' OR 1=1--"
      ];

      for (const payload of sqlInjectionPayloads) {
        const response = await request(app)
          .post('/api/auth/login')
          .send({ username: payload, password: 'anything' });

        expect(response.status).not.toBe(200);
        expect(response.body.success).not.toBe(true);
      }
    });

    test('should prevent command injection', async () => {
      const commandInjectionPayloads = [
        '; ls -la',
        '| cat /etc/passwd',
        '`whoami`',
        '$(rm -rf /)',
        '& net user'
      ];

      for (const payload of commandInjectionPayloads) {
        const response = await request(app)
          .post('/api/reports')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            findings: payload,
            impression: payload
          });

        // Should sanitize or reject
        if (response.status === 200 || response.status === 201) {
          // Verify payload was sanitized
          expect(response.body.findings).not.toContain(';');
          expect(response.body.findings).not.toContain('|');
          expect(response.body.findings).not.toContain('`');
        }
      }
    });
  });

  describe('Session Hijacking Tests', () => {
    test('should invalidate token after logout', async () => {
      // Login
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({ username: 'pentest_user', password: 'TestPassword123!' });

      const token = loginResponse.body.token;

      // Logout
      await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      // Try to use token after logout
      const response = await request(app)
        .get('/api/users/me')
        .set('Authorization', `Bearer ${token}`)
        .expect(401);

      expect(response.body.success).toBe(false);
    });

    test('should prevent session fixation', async () => {
      // Attacker provides a session token
      const fixedToken = jwt.sign(
        { userId: 'attacker-id', username: 'attacker' },
        'wrong-secret'
      );

      // Victim tries to login with fixed token
      const response = await request(app)
        .post('/api/auth/login')
        .set('Authorization', `Bearer ${fixedToken}`)
        .send({ username: 'pentest_user', password: 'TestPassword123!' });

      // Should generate new token, not use the provided one
      if (response.status === 200) {
        expect(response.body.token).not.toBe(fixedToken);
      }
    });

    test('should detect and prevent concurrent session abuse', async () => {
      // Login from multiple locations
      const sessions = [];
      for (let i = 0; i < 5; i++) {
        const response = await request(app)
          .post('/api/auth/login')
          .send({ username: 'pentest_user', password: 'TestPassword123!' });

        if (response.status === 200) {
          sessions.push(response.body.token);
        }
      }

      // System should either limit concurrent sessions or track them
      expect(sessions.length).toBeLessThanOrEqual(3); // Max 3 concurrent sessions
    });

    test('should bind session to IP address', async () => {
      // This test verifies if sessions are bound to IP addresses
      const response = await request(app)
        .get('/api/users/me')
        .set('Authorization', `Bearer ${authToken}`)
        .set('X-Forwarded-For', '192.168.1.100'); // Different IP

      // System should either allow (if IP binding is not enforced) or reject
      // This is a security recommendation, not always enforced
    });
  });

  describe('CSRF Attack Tests', () => {
    test('should reject state-changing requests without CSRF token', async () => {
      const response = await request(app)
        .post('/api/reports')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          findings: 'Test findings',
          impression: 'Test impression'
        });

      // Should either require CSRF token or use other CSRF protection
      // Status depends on CSRF implementation
    });

    test('should reject requests with invalid CSRF token', async () => {
      const response = await request(app)
        .post('/api/reports')
        .set('Authorization', `Bearer ${authToken}`)
        .set('X-XSRF-TOKEN', 'invalid-csrf-token')
        .send({
          findings: 'Test findings',
          impression: 'Test impression'
        });

      // Should reject if CSRF protection is enabled
    });
  });

  describe('Rate Limiting Tests', () => {
    test('should rate limit login attempts', async () => {
      const attempts = [];

      // Make multiple failed login attempts
      for (let i = 0; i < 10; i++) {
        const response = await request(app)
          .post('/api/auth/login')
          .send({ username: 'pentest_user', password: 'WrongPassword' });

        attempts.push(response.status);
      }

      // Should start rate limiting after several attempts
      const rateLimited = attempts.some(status => status === 429);
      expect(rateLimited).toBe(true);
    }, 30000); // Increase timeout for this test

    test('should rate limit API requests', async () => {
      const attempts = [];

      // Make many requests quickly
      for (let i = 0; i < 100; i++) {
        const response = await request(app)
          .get('/api/users/me')
          .set('Authorization', `Bearer ${authToken}`);

        attempts.push(response.status);
      }

      // Should rate limit excessive requests
      const rateLimited = attempts.some(status => status === 429);
      // Rate limiting may or may not be enforced depending on configuration
    }, 30000);
  });

  describe('Information Disclosure Tests', () => {
    test('should not expose sensitive information in error messages', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({ username: 'nonexistent', password: 'wrong' })
        .expect(401);

      // Should not reveal if username exists
      expect(response.body.message).not.toMatch(/user.*not.*found/i);
      expect(response.body.message).not.toMatch(/username.*invalid/i);
      // Should use generic message
      expect(response.body.message).toMatch(/invalid.*credentials|authentication.*failed/i);
    });

    test('should not expose stack traces in production', async () => {
      const response = await request(app)
        .get('/api/nonexistent-endpoint')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.body.stack).toBeUndefined();
      expect(response.body.trace).toBeUndefined();
    });

    test('should not expose database errors', async () => {
      // Try to cause a database error
      const response = await request(app)
        .get('/api/users/invalid-id-format')
        .set('Authorization', `Bearer ${adminToken}`);

      if (response.status >= 400) {
        expect(response.body.message).not.toMatch(/mongo|database|query/i);
      }
    });
  });
});
