const axios = require('axios');
const { NotificationService, getNotificationService } = require('../../src/services/notification-service');

// Mock axios
jest.mock('axios');

describe('NotificationService', () => {
  let notificationService;

  beforeEach(() => {
    jest.clearAllMocks();
    
    notificationService = new NotificationService({
      slackWebhookUrl: 'https://hooks.slack.com/test-webhook',
      pagerDutyIntegrationKey: 'test-integration-key',
      enabled: true
    });
  });

  describe('Initialization', () => {
    test('should initialize with default configuration', () => {
      const defaultService = new NotificationService();
      
      expect(defaultService.config.enabled).toBe(true);
      expect(defaultService.config.slackWebhookUrl).toBeUndefined();
      expect(defaultService.config.pagerDutyIntegrationKey).toBeUndefined();
    });

    test('should initialize with custom configuration', () => {
      expect(notificationService.config.enabled).toBe(true);
      expect(notificationService.config.slackWebhookUrl).toBe('https://hooks.slack.com/test-webhook');
      expect(notificationService.config.pagerDutyIntegrationKey).toBe('test-integration-key');
    });
  });

  describe('Slack Notifications', () => {
    test('should send alert to Slack successfully', async () => {
      axios.post.mockResolvedValue({ status: 200, data: 'ok' });
      
      const alert = {
        id: 'alert-123',
        name: 'TestAlert',
        summary: 'Test alert summary',
        description: 'Test alert description',
        severity: 'critical',
        timestamp: '2023-01-01T00:00:00.000Z',
        runbookUrl: 'https://runbook.example.com'
      };
      
      const result = await notificationService.sendSlackNotification(alert);
      
      expect(result.success).toBe(true);
      expect(axios.post).toHaveBeenCalledWith(
        'https://hooks.slack.com/test-webhook',
        expect.objectContaining({
          channel: '#orthanc-alerts', // critical alerts go to alerts channel
          username: 'Orthanc Bridge Monitor',
          attachments: expect.arrayContaining([
            expect.objectContaining({
              color: 'danger', // critical severity
              title: expect.stringContaining('TestAlert'),
              text: 'Test alert description',
              fields: expect.any(Array)
            })
          ])
        }),
        expect.any(Object)
      );
    });

    test('should handle Slack API errors', async () => {
      axios.post.mockRejectedValue(new Error('Slack API error'));
      
      const alert = { id: 'alert-123', name: 'TestAlert', severity: 'warning', timestamp: '2023-01-01T00:00:00.000Z' };
      
      await expect(notificationService.sendSlackNotification(alert)).rejects.toThrow('Slack notification failed');
    });

    test('should format different severity levels correctly', async () => {
      axios.post.mockResolvedValue({ status: 200, data: 'ok' });
      
      const severities = [
        { severity: 'critical', expectedColor: 'danger' },
        { severity: 'warning', expectedColor: 'warning' },
        { severity: 'info', expectedColor: 'good' }
      ];
      
      for (const { severity, expectedColor } of severities) {
        const alert = { id: 'test', name: 'Test', severity, timestamp: '2023-01-01T00:00:00.000Z' };
        await notificationService.sendSlackNotification(alert);
        
        expect(axios.post).toHaveBeenCalledWith(
          expect.any(String),
          expect.objectContaining({
            attachments: expect.arrayContaining([
              expect.objectContaining({
                color: expectedColor
              })
            ])
          }),
          expect.any(Object)
        );
      }
    });

    test('should send resolved alert to Slack', async () => {
      axios.post.mockResolvedValue({ status: 200, data: 'ok' });
      
      const alert = {
        id: 'alert-123',
        name: 'TestAlert',
        summary: 'Test alert resolved',
        timestamp: '2023-01-01T00:00:00.000Z'
      };
      
      const results = await notificationService.sendResolvedAlert(alert);
      
      expect(Array.isArray(results)).toBe(true);
      expect(axios.post).toHaveBeenCalledWith(
        'https://hooks.slack.com/test-webhook',
        expect.objectContaining({
          attachments: expect.arrayContaining([
            expect.objectContaining({
              title: expect.stringContaining('RESOLVED')
            })
          ])
        }),
        expect.any(Object)
      );
    });
  });

  describe('PagerDuty Notifications', () => {
    test('should send alert to PagerDuty successfully', async () => {
      axios.post.mockResolvedValue({ status: 202, data: { status: 'success' } });
      
      const alert = {
        id: 'alert-123',
        name: 'TestAlert',
        summary: 'Test alert summary',
        description: 'Test alert description',
        severity: 'critical',
        timestamp: '2023-01-01T00:00:00.000Z',
        service: 'orthanc-bridge',
        instance: 'prod-1'
      };
      
      const result = await notificationService.sendPagerDutyAlert(alert);
      
      expect(result.success).toBe(true);
      expect(axios.post).toHaveBeenCalledWith(
        'https://events.pagerduty.com/v2/enqueue',
        expect.objectContaining({
          routing_key: 'test-integration-key',
          event_action: 'trigger',
          dedup_key: expect.stringContaining('orthanc-bridge'),
          payload: expect.objectContaining({
            summary: 'Test alert summary',
            severity: 'critical',
            source: 'prod-1',
            component: 'orthanc-bridge'
          })
        }),
        expect.any(Object)
      );
    });

    test('should send resolved alert to PagerDuty', async () => {
      axios.post.mockResolvedValue({ status: 202, data: { status: 'success' } });
      
      const alert = { 
        id: 'alert-123', 
        name: 'TestAlert',
        summary: 'Test alert',
        severity: 'critical',
        timestamp: '2023-01-01T00:00:00.000Z'
      };
      
      const results = await notificationService.sendResolvedAlert(alert);
      
      expect(Array.isArray(results)).toBe(true);
      // The resolved alert should be sent to all channels, including PagerDuty for critical alerts
      expect(axios.post).toHaveBeenCalled();
    });

    test('should handle PagerDuty API errors', async () => {
      axios.post.mockRejectedValue(new Error('PagerDuty API error'));
      
      const alert = { 
        id: 'alert-123', 
        name: 'TestAlert',
        timestamp: '2023-01-01T00:00:00.000Z'
      };
      
      await expect(notificationService.sendPagerDutyAlert(alert)).rejects.toThrow('PagerDuty alert failed');
    });

    test('should map severity levels correctly for PagerDuty', async () => {
      axios.post.mockResolvedValue({ status: 202, data: { status: 'success' } });
      
      const severityMappings = [
        { input: 'critical', expected: 'critical' },
        { input: 'warning', expected: 'warning' },
        { input: 'info', expected: 'info' },
        { input: 'unknown', expected: 'info' } // default
      ];
      
      for (const { input, expected } of severityMappings) {
        const alert = { 
          id: 'test', 
          name: 'Test', 
          severity: input,
          timestamp: '2023-01-01T00:00:00.000Z'
        };
        await notificationService.sendPagerDutyAlert(alert);
        
        expect(axios.post).toHaveBeenCalledWith(
          expect.any(String),
          expect.objectContaining({
            payload: expect.objectContaining({
              severity: expected
            })
          }),
          expect.any(Object)
        );
      }
    });
  });

  describe('Email Notifications', () => {
    test('should send email alert when configured', async () => {
      const emailService = new NotificationService({
        emailSmtpHost: 'smtp.example.com',
        emailSmtpPort: 587,
        emailFrom: 'alerts@example.com'
      });
      
      const alert = {
        id: 'alert-123',
        name: 'TestAlert',
        summary: 'Test alert summary',
        description: 'Test alert description',
        severity: 'critical',
        timestamp: '2023-01-01T00:00:00.000Z'
      };
      
      const result = await emailService.sendEmailNotification(alert);
      
      expect(result.success).toBe(true);
      expect(result.channel).toBe('email');
    });

    test('should handle email sending errors', async () => {
      const emailService = new NotificationService({
        emailSmtpHost: 'smtp.example.com'
      });
      
      // Mock console.log to throw error
      const originalConsoleLog = console.log;
      console.log = jest.fn(() => {
        throw new Error('SMTP error');
      });
      
      const alert = { 
        id: 'alert-123', 
        name: 'TestAlert',
        timestamp: '2023-01-01T00:00:00.000Z'
      };
      
      await expect(emailService.sendEmailNotification(alert)).rejects.toThrow('Email notification failed');
      
      console.log = originalConsoleLog;
    });
  });

  describe('Main Alert Sending', () => {
    test('should send alert to all enabled channels', async () => {
      axios.post.mockResolvedValue({ status: 200, data: 'ok' });
      
      const alert = {
        id: 'alert-123',
        name: 'TestAlert',
        summary: 'Test alert',
        severity: 'critical',
        timestamp: '2023-01-01T00:00:00.000Z'
      };
      
      const results = await notificationService.sendAlert(alert);
      
      expect(Array.isArray(results)).toBe(true);
      expect(axios.post).toHaveBeenCalledTimes(2); // Slack + PagerDuty
    });

    test('should send resolved alert to all enabled channels', async () => {
      axios.post.mockResolvedValue({ status: 200, data: 'ok' });
      
      const alert = { 
        id: 'alert-123', 
        name: 'TestAlert',
        summary: 'Test alert',
        severity: 'critical',
        timestamp: '2023-01-01T00:00:00.000Z'
      };
      
      const results = await notificationService.sendResolvedAlert(alert);
      
      expect(Array.isArray(results)).toBe(true);
      expect(axios.post).toHaveBeenCalledTimes(2); // Slack + PagerDuty
    });

    test('should handle partial failures gracefully', async () => {
      // Slack succeeds, PagerDuty fails
      axios.post
        .mockResolvedValueOnce({ status: 200, data: 'ok' }) // Slack
        .mockRejectedValueOnce(new Error('PagerDuty error')); // PagerDuty
      
      const alert = { 
        id: 'alert-123', 
        name: 'TestAlert',
        summary: 'Test alert',
        severity: 'critical',
        timestamp: '2023-01-01T00:00:00.000Z'
      };
      
      const results = await notificationService.sendAlert(alert);
      
      expect(Array.isArray(results)).toBe(true);
      expect(results.some(r => r.status === 'fulfilled')).toBe(true);
    });

    test('should return results when all channels fail', async () => {
      axios.post.mockRejectedValue(new Error('All channels failed'));
      
      const alert = { 
        id: 'alert-123', 
        name: 'TestAlert',
        summary: 'Test alert',
        severity: 'critical',
        timestamp: '2023-01-01T00:00:00.000Z'
      };
      
      const results = await notificationService.sendAlert(alert);
      
      expect(Array.isArray(results)).toBe(true);
      expect(results.every(r => r.status === 'rejected')).toBe(true);
    });
  });

  describe('Configuration Validation', () => {
    test('should skip disabled notifications', async () => {
      const disabledService = new NotificationService({
        enabled: false
      });
      
      const alert = { 
        id: 'alert-123', 
        name: 'TestAlert',
        summary: 'Test alert',
        timestamp: '2023-01-01T00:00:00.000Z'
      };
      
      const result = await disabledService.sendAlert(alert);
      
      expect(result).toBeUndefined(); // Returns undefined when disabled
      expect(axios.post).not.toHaveBeenCalled();
    });

    test('should handle missing configuration gracefully', async () => {
      const incompleteService = new NotificationService({
        // No webhook URLs configured
      });
      
      const alert = { 
        id: 'alert-123', 
        name: 'TestAlert',
        summary: 'Test alert',
        timestamp: '2023-01-01T00:00:00.000Z'
      };
      
      const results = await incompleteService.sendAlert(alert);
      
      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBe(0); // No channels configured
    });
  });

  describe('Message Formatting', () => {
    test('should format alert messages correctly', () => {
      const alert = {
        id: 'alert-123',
        name: 'HighQueueDepth',
        summary: 'Queue depth is high',
        description: 'Queue depth is 150 which exceeds threshold',
        severity: 'warning',
        value: 150,
        threshold: 100,
        timestamp: '2023-01-01T12:00:00.000Z',
        runbookUrl: 'https://runbook.example.com/high-queue'
      };
      
      const formatted = notificationService.formatAlertMessage(alert);
      
      expect(formatted).toContain('HighQueueDepth');
      expect(formatted).toContain('Queue depth is high');
      expect(formatted).toContain('150');
      expect(formatted).toContain('100');
      expect(formatted).toContain('https://runbook.example.com/high-queue');
    });

    test('should handle missing optional fields', () => {
      const minimalAlert = {
        id: 'alert-123',
        name: 'TestAlert',
        summary: 'Test summary'
      };
      
      const formatted = notificationService.formatAlertMessage(minimalAlert);
      
      expect(formatted).toContain('TestAlert');
      expect(formatted).toContain('Test summary');
      expect(formatted).not.toContain('undefined');
      expect(formatted).not.toContain('null');
    });
  });

  describe('Singleton Pattern', () => {
    test('should return same instance from getNotificationService', () => {
      const instance1 = getNotificationService();
      const instance2 = getNotificationService();
      
      expect(instance1).toBe(instance2);
    });

    test('should initialize singleton with config', () => {
      const config = { slack: { enabled: true, webhookUrl: 'test-url' } };
      const instance = getNotificationService(config);
      
      expect(instance).toBeInstanceOf(NotificationService);
      expect(instance.config.slack.webhookUrl).toBe('test-url');
    });
  });

  describe('Error Handling and Logging', () => {
    test('should log notification attempts', async () => {
      const originalConsoleLog = console.log;
      console.log = jest.fn();
      
      axios.post.mockResolvedValue({ status: 200, data: 'ok' });
      
      const alert = { id: 'alert-123', name: 'TestAlert' };
      await notificationService.sendAlert(alert);
      
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('Sending alert notification')
      );
      
      console.log = originalConsoleLog;
    });

    test('should log notification errors', async () => {
      const originalConsoleError = console.error;
      console.error = jest.fn();
      
      axios.post.mockRejectedValue(new Error('Network error'));
      
      const alert = { id: 'alert-123', name: 'TestAlert' };
      await notificationService.sendAlert(alert);
      
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to send'),
        expect.any(Error)
      );
      
      console.error = originalConsoleError;
    });
  });
});