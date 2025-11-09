const request = require('supertest');
const express = require('express');
const crypto = require('crypto');
const WebhookSecurity = require('../../src/middleware/webhookSecurity');

describe('WebhookSecurity', () => {
  let app;
  let webhookSecurity;
  const testSecret = 'test-webhook-secret-key';
  
  beforeEach(() => {
    // Create fresh app and webhook security instance for each test
    app = express();
    app.use(express.json());
    
    webhookSecurity = new WebhookSecurity({
      secret: testSecret,
      timestampTolerance: 300, // 5 minutes
      rateLimit: 5, // Lower limit for testing
      rateLimitWindow: 60 // 1 minute
    });
    
    // Test endpoint with webhook security middleware
    app.post('/webhook', webhookSecurity.middleware(), (req, res) => {
      res.json({ success: true, body: req.body });
    });
  });

  describe('HMAC Signature Validation', () => {
    test('should accept valid HMAC-SHA256 signature', async () => {
      const payload = { test: 'data', instanceId: '123' };
      const timestamp = Math.floor(Date.now() / 1000).toString();
      const nonce = crypto.randomUUID();
      const signature = webhookSecurity.generateSignature(payload, timestamp, nonce);

      const response = await request(app)
        .post('/webhook')
        .set('x-webhook-signature', signature)
        .set('x-webhook-timestamp', timestamp)
        .set('x-webhook-nonce', nonce)
        .send(payload);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.body).toEqual(payload);
    });

    test('should reject invalid HMAC-SHA256 signature', async () => {
      const payload = { test: 'data', instanceId: '123' };
      const timestamp = Math.floor(Date.now() / 1000).toString();
      const nonce = crypto.randomUUID();
      const invalidSignature = 'invalid-signature-hash';

      const response = await request(app)
        .post('/webhook')
        .set('x-webhook-signature', invalidSignature)
        .set('x-webhook-timestamp', timestamp)
        .set('x-webhook-nonce', nonce)
        .send(payload);

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Invalid signature');
    });

    test('should reject request with missing signature header', async () => {
      const payload = { test: 'data' };
      const timestamp = Math.floor(Date.now() / 1000).toString();
      const nonce = crypto.randomUUID();

      const response = await request(app)
        .post('/webhook')
        .set('x-webhook-timestamp', timestamp)
        .set('x-webhook-nonce', nonce)
        .send(payload);

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Missing security headers');
    });

    test('should reject signature generated with wrong secret', async () => {
      const payload = { test: 'data', instanceId: '123' };
      const timestamp = Math.floor(Date.now() / 1000).toString();
      const nonce = crypto.randomUUID();
      
      // Generate signature with wrong secret
      const wrongSecret = 'wrong-secret';
      const data = `${timestamp}.${nonce}.${JSON.stringify(payload)}`;
      const wrongSignature = crypto.createHmac('sha256', wrongSecret).update(data).digest('hex');

      const response = await request(app)
        .post('/webhook')
        .set('x-webhook-signature', wrongSignature)
        .set('x-webhook-timestamp', timestamp)
        .set('x-webhook-nonce', nonce)
        .send(payload);

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Invalid signature');
    });

    test('should reject signature for modified payload', async () => {
      const originalPayload = { test: 'data', instanceId: '123' };
      const modifiedPayload = { test: 'modified', instanceId: '123' };
      const timestamp = Math.floor(Date.now() / 1000).toString();
      const nonce = crypto.randomUUID();
      
      // Generate signature for original payload
      const signature = webhookSecurity.generateSignature(originalPayload, timestamp, nonce);

      // Send modified payload with original signature
      const response = await request(app)
        .post('/webhook')
        .set('x-webhook-signature', signature)
        .set('x-webhook-timestamp', timestamp)
        .set('x-webhook-nonce', nonce)
        .send(modifiedPayload);

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Invalid signature');
    });
  });

  describe('Replay Attack Prevention', () => {
    test('should accept request with current timestamp', async () => {
      const payload = { test: 'data' };
      const timestamp = Math.floor(Date.now() / 1000).toString();
      const nonce = crypto.randomUUID();
      const signature = webhookSecurity.generateSignature(payload, timestamp, nonce);

      const response = await request(app)
        .post('/webhook')
        .set('x-webhook-signature', signature)
        .set('x-webhook-timestamp', timestamp)
        .set('x-webhook-nonce', nonce)
        .send(payload);

      expect(response.status).toBe(200);
    });

    test('should reject request with old timestamp (replay attack)', async () => {
      const payload = { test: 'data' };
      // Timestamp from 10 minutes ago (beyond 5-minute tolerance)
      const oldTimestamp = (Math.floor(Date.now() / 1000) - 600).toString();
      const nonce = crypto.randomUUID();
      const signature = webhookSecurity.generateSignature(payload, oldTimestamp, nonce);

      const response = await request(app)
        .post('/webhook')
        .set('x-webhook-signature', signature)
        .set('x-webhook-timestamp', oldTimestamp)
        .set('x-webhook-nonce', nonce)
        .send(payload);

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Invalid timestamp');
    });

    test('should reject request with future timestamp', async () => {
      const payload = { test: 'data' };
      // Timestamp from 10 minutes in the future
      const futureTimestamp = (Math.floor(Date.now() / 1000) + 600).toString();
      const nonce = crypto.randomUUID();
      const signature = webhookSecurity.generateSignature(payload, futureTimestamp, nonce);

      const response = await request(app)
        .post('/webhook')
        .set('x-webhook-signature', signature)
        .set('x-webhook-timestamp', futureTimestamp)
        .set('x-webhook-nonce', nonce)
        .send(payload);

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Invalid timestamp');
    });

    test('should accept request within timestamp tolerance', async () => {
      const payload = { test: 'data' };
      // Timestamp from 4 minutes ago (within 5-minute tolerance)
      const validTimestamp = (Math.floor(Date.now() / 1000) - 240).toString();
      const nonce = crypto.randomUUID();
      const signature = webhookSecurity.generateSignature(payload, validTimestamp, nonce);

      const response = await request(app)
        .post('/webhook')
        .set('x-webhook-signature', signature)
        .set('x-webhook-timestamp', validTimestamp)
        .set('x-webhook-nonce', nonce)
        .send(payload);

      expect(response.status).toBe(200);
    });

    test('should reject request with missing timestamp header', async () => {
      const payload = { test: 'data' };
      const nonce = crypto.randomUUID();
      const signature = 'some-signature';

      const response = await request(app)
        .post('/webhook')
        .set('x-webhook-signature', signature)
        .set('x-webhook-nonce', nonce)
        .send(payload);

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Missing security headers');
    });

    test('should reject request with missing nonce header', async () => {
      const payload = { test: 'data' };
      const timestamp = Math.floor(Date.now() / 1000).toString();
      const signature = 'some-signature';

      const response = await request(app)
        .post('/webhook')
        .set('x-webhook-signature', signature)
        .set('x-webhook-timestamp', timestamp)
        .send(payload);

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Missing security headers');
    });
  });

  describe('Rate Limiting', () => {
    test('should allow requests within rate limit', async () => {
      const payload = { test: 'data' };
      
      // Send 3 requests (within limit of 5)
      for (let i = 0; i < 3; i++) {
        const timestamp = Math.floor(Date.now() / 1000).toString();
        const nonce = crypto.randomUUID();
        const signature = webhookSecurity.generateSignature(payload, timestamp, nonce);

        const response = await request(app)
          .post('/webhook')
          .set('x-webhook-signature', signature)
          .set('x-webhook-timestamp', timestamp)
          .set('x-webhook-nonce', nonce)
          .send(payload);

        expect(response.status).toBe(200);
      }
    });

    test('should reject requests exceeding rate limit', async () => {
      const payload = { test: 'data' };
      
      // Send requests up to the limit (5)
      for (let i = 0; i < 5; i++) {
        const timestamp = Math.floor(Date.now() / 1000).toString();
        const nonce = crypto.randomUUID();
        const signature = webhookSecurity.generateSignature(payload, timestamp, nonce);

        await request(app)
          .post('/webhook')
          .set('x-webhook-signature', signature)
          .set('x-webhook-timestamp', timestamp)
          .set('x-webhook-nonce', nonce)
          .send(payload);
      }

      // 6th request should be rate limited
      const timestamp = Math.floor(Date.now() / 1000).toString();
      const nonce = crypto.randomUUID();
      const signature = webhookSecurity.generateSignature(payload, timestamp, nonce);

      const response = await request(app)
        .post('/webhook')
        .set('x-webhook-signature', signature)
        .set('x-webhook-timestamp', timestamp)
        .set('x-webhook-nonce', nonce)
        .send(payload);

      expect(response.status).toBe(429);
      expect(response.body.error).toBe('Rate limit exceeded');
    });

    test('should handle rate limiting per IP address', async () => {
      // Create a fresh webhook security instance for this test
      const ipTestWebhookSecurity = new WebhookSecurity({
        secret: testSecret,
        timestampTolerance: 300,
        rateLimit: 3, // Lower limit for easier testing
        rateLimitWindow: 60
      });
      
      // Create two apps with different IP addresses
      const app1 = express();
      const app2 = express();
      
      app1.use(express.json());
      app2.use(express.json());
      
      // Mock different IP addresses - set them before the webhook middleware
      app1.use((req, res, next) => {
        req.ip = '192.168.1.100';
        req.connection = { remoteAddress: '192.168.1.100' };
        next();
      });
      
      app2.use((req, res, next) => {
        req.ip = '192.168.1.200';
        req.connection = { remoteAddress: '192.168.1.200' };
        next();
      });
      
      app1.post('/webhook', ipTestWebhookSecurity.middleware(), (req, res) => {
        res.json({ success: true, ip: req.ip });
      });
      
      app2.post('/webhook', ipTestWebhookSecurity.middleware(), (req, res) => {
        res.json({ success: true, ip: req.ip });
      });

      const payload = { test: 'data' };

      // Exhaust rate limit for first IP (3 requests)
      for (let i = 0; i < 3; i++) {
        const timestamp = Math.floor(Date.now() / 1000).toString();
        const nonce = crypto.randomUUID();
        const signature = ipTestWebhookSecurity.generateSignature(payload, timestamp, nonce);

        const response = await request(app1)
          .post('/webhook')
          .set('x-webhook-signature', signature)
          .set('x-webhook-timestamp', timestamp)
          .set('x-webhook-nonce', nonce)
          .send(payload);
          
        expect(response.status).toBe(200);
        expect(response.body.ip).toBe('192.168.1.100');
      }

      // 4th request from first IP should be rate limited
      const timestamp1 = Math.floor(Date.now() / 1000).toString();
      const nonce1 = crypto.randomUUID();
      const signature1 = ipTestWebhookSecurity.generateSignature(payload, timestamp1, nonce1);

      const response1 = await request(app1)
        .post('/webhook')
        .set('x-webhook-signature', signature1)
        .set('x-webhook-timestamp', timestamp1)
        .set('x-webhook-nonce', nonce1)
        .send(payload);

      expect(response1.status).toBe(429);

      // Second IP should still work (first request)
      const timestamp2 = Math.floor(Date.now() / 1000).toString();
      const nonce2 = crypto.randomUUID();
      const signature2 = ipTestWebhookSecurity.generateSignature(payload, timestamp2, nonce2);

      const response2 = await request(app2)
        .post('/webhook')
        .set('x-webhook-signature', signature2)
        .set('x-webhook-timestamp', timestamp2)
        .set('x-webhook-nonce', nonce2)
        .send(payload);

      expect(response2.status).toBe(200);
      expect(response2.body.ip).toBe('192.168.1.200');
    });
  });

  describe('Security Event Logging', () => {
    let logSpy;
    let loggingWebhookSecurity;
    let loggingApp;

    beforeEach(() => {
      // Create separate webhook security instance for logging tests
      loggingWebhookSecurity = new WebhookSecurity({
        secret: testSecret,
        timestampTolerance: 300,
        rateLimit: 5,
        rateLimitWindow: 60
      });
      
      // Create separate app for logging tests
      loggingApp = express();
      loggingApp.use(express.json());
      loggingApp.post('/webhook', loggingWebhookSecurity.middleware(), (req, res) => {
        res.json({ success: true, body: req.body });
      });
      
      // Spy on the logger to verify security events are logged
      logSpy = jest.spyOn(loggingWebhookSecurity.logger, 'warn');
    });

    afterEach(() => {
      logSpy.mockRestore();
    });

    test('should log invalid signature attempts', async () => {
      const payload = { test: 'data' };
      const timestamp = Math.floor(Date.now() / 1000).toString();
      const nonce = crypto.randomUUID();
      const invalidSignature = 'invalid-signature';

      await request(loggingApp)
        .post('/webhook')
        .set('x-webhook-signature', invalidSignature)
        .set('x-webhook-timestamp', timestamp)
        .set('x-webhook-nonce', nonce)
        .send(payload);

      expect(logSpy).toHaveBeenCalledWith('Security Event', expect.objectContaining({
        event: 'INVALID_SIGNATURE',
        endpoint: '/webhook',
        providedSignature: invalidSignature
      }));
    });

    test('should log replay attack attempts', async () => {
      const payload = { test: 'data' };
      const oldTimestamp = (Math.floor(Date.now() / 1000) - 600).toString();
      const nonce = crypto.randomUUID();
      const signature = loggingWebhookSecurity.generateSignature(payload, oldTimestamp, nonce);

      await request(loggingApp)
        .post('/webhook')
        .set('x-webhook-signature', signature)
        .set('x-webhook-timestamp', oldTimestamp)
        .set('x-webhook-nonce', nonce)
        .send(payload);

      expect(logSpy).toHaveBeenCalledWith('Security Event', expect.objectContaining({
        event: 'REPLAY_ATTACK_ATTEMPT',
        endpoint: '/webhook',
        timestamp: oldTimestamp
      }));
    });

    test('should log rate limit violations', async () => {
      const payload = { test: 'data' };
      
      // Exhaust rate limit
      for (let i = 0; i < 5; i++) {
        const timestamp = Math.floor(Date.now() / 1000).toString();
        const nonce = crypto.randomUUID();
        const signature = loggingWebhookSecurity.generateSignature(payload, timestamp, nonce);

        await request(loggingApp)
          .post('/webhook')
          .set('x-webhook-signature', signature)
          .set('x-webhook-timestamp', timestamp)
          .set('x-webhook-nonce', nonce)
          .send(payload);
      }

      // Clear previous log calls
      logSpy.mockClear();

      // Trigger rate limit
      const timestamp = Math.floor(Date.now() / 1000).toString();
      const nonce = crypto.randomUUID();
      const signature = loggingWebhookSecurity.generateSignature(payload, timestamp, nonce);

      await request(loggingApp)
        .post('/webhook')
        .set('x-webhook-signature', signature)
        .set('x-webhook-timestamp', timestamp)
        .set('x-webhook-nonce', nonce)
        .send(payload);

      expect(logSpy).toHaveBeenCalledWith('Security Event', expect.objectContaining({
        event: 'RATE_LIMIT_EXCEEDED',
        endpoint: '/webhook'
      }));
    });

    test('should log missing security headers', async () => {
      const payload = { test: 'data' };

      await request(loggingApp)
        .post('/webhook')
        .send(payload);

      expect(logSpy).toHaveBeenCalledWith('Security Event', expect.objectContaining({
        event: 'MISSING_SECURITY_HEADERS',
        endpoint: '/webhook',
        headers: { signature: false, timestamp: false, nonce: false }
      }));
    });

    test('should log successful webhook validation', async () => {
      const payload = { test: 'data' };
      const timestamp = Math.floor(Date.now() / 1000).toString();
      const nonce = crypto.randomUUID();
      const signature = loggingWebhookSecurity.generateSignature(payload, timestamp, nonce);

      await request(loggingApp)
        .post('/webhook')
        .set('x-webhook-signature', signature)
        .set('x-webhook-timestamp', timestamp)
        .set('x-webhook-nonce', nonce)
        .send(payload);

      expect(logSpy).toHaveBeenCalledWith('Security Event', expect.objectContaining({
        event: 'WEBHOOK_VALIDATED',
        endpoint: '/webhook',
        timestamp,
        nonce
      }));
    });

    test('should include correlation IDs in security logs', async () => {
      const payload = { test: 'data' };
      const invalidSignature = 'invalid-signature';
      const timestamp = Math.floor(Date.now() / 1000).toString();
      const nonce = crypto.randomUUID();

      await request(loggingApp)
        .post('/webhook')
        .set('x-webhook-signature', invalidSignature)
        .set('x-webhook-timestamp', timestamp)
        .set('x-webhook-nonce', nonce)
        .send(payload);

      expect(logSpy).toHaveBeenCalledWith('Security Event', expect.objectContaining({
        correlationId: expect.stringMatching(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)
      }));
    });
  });

  describe('High Load Scenarios', () => {
    test('should handle concurrent requests within rate limit', async () => {
      const payload = { test: 'data' };
      const promises = [];

      // Send 3 concurrent requests (within limit)
      for (let i = 0; i < 3; i++) {
        const timestamp = Math.floor(Date.now() / 1000).toString();
        const nonce = crypto.randomUUID();
        const signature = webhookSecurity.generateSignature(payload, timestamp, nonce);

        const promise = request(app)
          .post('/webhook')
          .set('x-webhook-signature', signature)
          .set('x-webhook-timestamp', timestamp)
          .set('x-webhook-nonce', nonce)
          .send(payload);

        promises.push(promise);
      }

      const responses = await Promise.all(promises);
      
      responses.forEach(response => {
        expect(response.status).toBe(200);
      });
    });

    test('should handle burst of requests and properly rate limit', async () => {
      const payload = { test: 'data' };
      const promises = [];

      // Send 10 concurrent requests (exceeding limit of 5)
      for (let i = 0; i < 10; i++) {
        const timestamp = Math.floor(Date.now() / 1000).toString();
        const nonce = crypto.randomUUID();
        const signature = webhookSecurity.generateSignature(payload, timestamp, nonce);

        const promise = request(app)
          .post('/webhook')
          .set('x-webhook-signature', signature)
          .set('x-webhook-timestamp', timestamp)
          .set('x-webhook-nonce', nonce)
          .send(payload);

        promises.push(promise);
      }

      const responses = await Promise.all(promises);
      
      const successfulResponses = responses.filter(r => r.status === 200);
      const rateLimitedResponses = responses.filter(r => r.status === 429);

      expect(successfulResponses.length).toBe(5);
      expect(rateLimitedResponses.length).toBe(5);
    });
  });

  describe('Edge Cases', () => {
    test('should handle empty payload', async () => {
      const payload = {};
      const timestamp = Math.floor(Date.now() / 1000).toString();
      const nonce = crypto.randomUUID();
      const signature = webhookSecurity.generateSignature(payload, timestamp, nonce);

      const response = await request(app)
        .post('/webhook')
        .set('x-webhook-signature', signature)
        .set('x-webhook-timestamp', timestamp)
        .set('x-webhook-nonce', nonce)
        .send(payload);

      expect(response.status).toBe(200);
    });

    test('should handle large payload', async () => {
      const payload = {
        largeData: 'x'.repeat(10000),
        instanceId: '123',
        metadata: Array(100).fill({ key: 'value' })
      };
      const timestamp = Math.floor(Date.now() / 1000).toString();
      const nonce = crypto.randomUUID();
      const signature = webhookSecurity.generateSignature(payload, timestamp, nonce);

      const response = await request(app)
        .post('/webhook')
        .set('x-webhook-signature', signature)
        .set('x-webhook-timestamp', timestamp)
        .set('x-webhook-nonce', nonce)
        .send(payload);

      expect(response.status).toBe(200);
    });

    test('should handle malformed timestamp', async () => {
      const payload = { test: 'data' };
      const malformedTimestamp = 'not-a-number';
      const nonce = crypto.randomUUID();
      const signature = webhookSecurity.generateSignature(payload, malformedTimestamp, nonce);

      const response = await request(app)
        .post('/webhook')
        .set('x-webhook-signature', signature)
        .set('x-webhook-timestamp', malformedTimestamp)
        .set('x-webhook-nonce', nonce)
        .send(payload);

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Invalid timestamp');
    });
  });
});