const request = require('supertest');
const express = require('express');
const crypto = require('crypto');
const WebhookSecurity = require('../../src/middleware/webhookSecurity');

describe('Webhook Security Integration', () => {
  let app;
  let webhookSecurity;
  const testSecret = 'integration-test-secret';

  beforeEach(() => {
    app = express();
    app.use(express.json());
    
    webhookSecurity = new WebhookSecurity({
      secret: testSecret,
      timestampTolerance: 300,
      rateLimit: 10,
      rateLimitWindow: 60
    });

    // Simulate a real webhook endpoint that processes DICOM instances
    app.post('/api/webhook/orthanc', webhookSecurity.middleware(), (req, res) => {
      const { ChangeType, ResourceType, ID } = req.body;
      
      // Simulate processing logic
      if (ChangeType === 'StableStudy' && ResourceType === 'Study') {
        res.json({
          success: true,
          message: 'Study processed successfully',
          studyId: ID,
          timestamp: new Date().toISOString()
        });
      } else {
        res.json({
          success: true,
          message: 'Event acknowledged but not processed',
          changeType: ChangeType,
          resourceType: ResourceType
        });
      }
    });
  });

  describe('Real-world webhook scenarios', () => {
    test('should process valid Orthanc webhook for stable study', async () => {
      const payload = {
        ChangeType: 'StableStudy',
        Date: '20241003T180000',
        ID: '1.2.3.4.5.6.7.8.9',
        Path: '/studies/1.2.3.4.5.6.7.8.9',
        ResourceType: 'Study'
      };

      const timestamp = Math.floor(Date.now() / 1000).toString();
      const nonce = crypto.randomUUID();
      const signature = webhookSecurity.generateSignature(payload, timestamp, nonce);

      const response = await request(app)
        .post('/api/webhook/orthanc')
        .set('x-webhook-signature', signature)
        .set('x-webhook-timestamp', timestamp)
        .set('x-webhook-nonce', nonce)
        .send(payload);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Study processed successfully');
      expect(response.body.studyId).toBe('1.2.3.4.5.6.7.8.9');
    });

    test('should handle instance change events', async () => {
      const payload = {
        ChangeType: 'NewInstance',
        Date: '20241003T180000',
        ID: '1.2.3.4.5.6.7.8.9.10',
        Path: '/instances/1.2.3.4.5.6.7.8.9.10',
        ResourceType: 'Instance'
      };

      const timestamp = Math.floor(Date.now() / 1000).toString();
      const nonce = crypto.randomUUID();
      const signature = webhookSecurity.generateSignature(payload, timestamp, nonce);

      const response = await request(app)
        .post('/api/webhook/orthanc')
        .set('x-webhook-signature', signature)
        .set('x-webhook-timestamp', timestamp)
        .set('x-webhook-nonce', nonce)
        .send(payload);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Event acknowledged but not processed');
      expect(response.body.changeType).toBe('NewInstance');
    });

    test('should reject webhook with tampered payload', async () => {
      const originalPayload = {
        ChangeType: 'StableStudy',
        Date: '20241003T180000',
        ID: '1.2.3.4.5.6.7.8.9',
        Path: '/studies/1.2.3.4.5.6.7.8.9',
        ResourceType: 'Study'
      };

      const tamperedPayload = {
        ...originalPayload,
        ID: 'malicious.study.id' // Tampered study ID
      };

      const timestamp = Math.floor(Date.now() / 1000).toString();
      const nonce = crypto.randomUUID();
      // Generate signature for original payload
      const signature = webhookSecurity.generateSignature(originalPayload, timestamp, nonce);

      // Send tampered payload with original signature
      const response = await request(app)
        .post('/api/webhook/orthanc')
        .set('x-webhook-signature', signature)
        .set('x-webhook-timestamp', timestamp)
        .set('x-webhook-nonce', nonce)
        .send(tamperedPayload);

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Invalid signature');
    });

    test('should handle high-frequency webhook bursts with rate limiting', async () => {
      const payload = {
        ChangeType: 'NewInstance',
        Date: '20241003T180000',
        ResourceType: 'Instance'
      };

      const promises = [];
      const results = [];

      // Send 15 concurrent requests (exceeding limit of 10)
      for (let i = 0; i < 15; i++) {
        const instancePayload = {
          ...payload,
          ID: `1.2.3.4.5.6.7.8.9.${i}`,
          Path: `/instances/1.2.3.4.5.6.7.8.9.${i}`
        };

        const timestamp = Math.floor(Date.now() / 1000).toString();
        const nonce = crypto.randomUUID();
        const signature = webhookSecurity.generateSignature(instancePayload, timestamp, nonce);

        const promise = request(app)
          .post('/api/webhook/orthanc')
          .set('x-webhook-signature', signature)
          .set('x-webhook-timestamp', timestamp)
          .set('x-webhook-nonce', nonce)
          .send(instancePayload);

        promises.push(promise);
      }

      const responses = await Promise.all(promises);
      
      const successfulResponses = responses.filter(r => r.status === 200);
      const rateLimitedResponses = responses.filter(r => r.status === 429);

      expect(successfulResponses.length).toBe(10);
      expect(rateLimitedResponses.length).toBe(5);
      
      // Verify successful responses processed correctly
      successfulResponses.forEach(response => {
        expect(response.body.success).toBe(true);
        expect(response.body.changeType).toBe('NewInstance');
      });
    });

    test('should demonstrate proper signature generation for Orthanc Lua script', () => {
      // This test shows how the signature should be generated in Orthanc Lua script
      const payload = {
        ChangeType: 'StableStudy',
        Date: '20241003T180000',
        ID: '1.2.3.4.5.6.7.8.9',
        Path: '/studies/1.2.3.4.5.6.7.8.9',
        ResourceType: 'Study'
      };

      const timestamp = Math.floor(Date.now() / 1000).toString();
      const nonce = crypto.randomUUID();
      
      // This is how the signature should be generated in Lua:
      // local data = timestamp .. "." .. nonce .. "." .. json.encode(payload)
      // local signature = crypto.hmac.digest("sha256", secret, data, true)
      const data = `${timestamp}.${nonce}.${JSON.stringify(payload)}`;
      const expectedSignature = crypto.createHmac('sha256', testSecret).update(data).digest('hex');
      
      const generatedSignature = webhookSecurity.generateSignature(payload, timestamp, nonce);
      
      expect(generatedSignature).toBe(expectedSignature);
      expect(generatedSignature).toMatch(/^[a-f0-9]{64}$/); // 64-character hex string
    });
  });

  describe('Security event monitoring', () => {
    let logSpy;

    beforeEach(() => {
      logSpy = jest.spyOn(webhookSecurity.logger, 'warn');
    });

    afterEach(() => {
      logSpy.mockRestore();
    });

    test('should log comprehensive security events for monitoring', async () => {
      // Test various security scenarios and verify logging
      const payload = { ChangeType: 'StableStudy', ResourceType: 'Study', ID: 'test' };

      // 1. Valid request - should log successful validation
      const timestamp = Math.floor(Date.now() / 1000).toString();
      const nonce = crypto.randomUUID();
      const signature = webhookSecurity.generateSignature(payload, timestamp, nonce);

      await request(app)
        .post('/api/webhook/orthanc')
        .set('x-webhook-signature', signature)
        .set('x-webhook-timestamp', timestamp)
        .set('x-webhook-nonce', nonce)
        .send(payload);

      // 2. Invalid signature - should log security violation
      await request(app)
        .post('/api/webhook/orthanc')
        .set('x-webhook-signature', 'invalid-signature')
        .set('x-webhook-timestamp', timestamp)
        .set('x-webhook-nonce', nonce)
        .send(payload);

      // 3. Old timestamp - should log replay attack attempt
      const oldTimestamp = (Math.floor(Date.now() / 1000) - 600).toString();
      const oldSignature = webhookSecurity.generateSignature(payload, oldTimestamp, nonce);

      await request(app)
        .post('/api/webhook/orthanc')
        .set('x-webhook-signature', oldSignature)
        .set('x-webhook-timestamp', oldTimestamp)
        .set('x-webhook-nonce', nonce)
        .send(payload);

      // Verify all security events were logged
      expect(logSpy).toHaveBeenCalledWith('Security Event', expect.objectContaining({
        event: 'WEBHOOK_VALIDATED'
      }));

      expect(logSpy).toHaveBeenCalledWith('Security Event', expect.objectContaining({
        event: 'INVALID_SIGNATURE'
      }));

      expect(logSpy).toHaveBeenCalledWith('Security Event', expect.objectContaining({
        event: 'REPLAY_ATTACK_ATTEMPT'
      }));

      // Verify correlation IDs are present for tracking
      const logCalls = logSpy.mock.calls;
      logCalls.forEach(call => {
        expect(call[1]).toHaveProperty('correlationId');
        expect(call[1].correlationId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
      });
    });
  });
});