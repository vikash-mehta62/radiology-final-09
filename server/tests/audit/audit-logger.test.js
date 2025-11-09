const AuditLogger = require('../../src/utils/audit-logger');
const winston = require('winston');
const fs = require('fs').promises;
const path = require('path');

// Mock winston to capture log outputs
jest.mock('winston', () => {
  const mockLogger = {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn()
  };

  return {
    createLogger: jest.fn(() => mockLogger),
    format: {
      combine: jest.fn(() => ({})),
      timestamp: jest.fn(() => ({})),
      errors: jest.fn(() => ({})),
      json: jest.fn(() => ({})),
      printf: jest.fn(() => ({})),
      colorize: jest.fn(() => ({})),
      simple: jest.fn(() => ({}))
    },
    transports: {
      File: jest.fn(),
      Console: jest.fn()
    }
  };
});

describe('AuditLogger', () => {
  let auditLogger;
  let mockWinstonLogger;

  beforeEach(() => {
    jest.clearAllMocks();
    auditLogger = new AuditLogger({ serviceName: 'test-service', version: '1.0.0' });
    mockWinstonLogger = winston.createLogger();
  });

  describe('Initialization', () => {
    test('should initialize with default options', () => {
      const logger = new AuditLogger();
      expect(logger.serviceName).toBe('node-server');
      expect(logger.version).toBe('1.0.0');
      expect(logger.environment).toBe('test');
    });

    test('should initialize with custom options', () => {
      const logger = new AuditLogger({
        serviceName: 'custom-service',
        version: '2.0.0'
      });
      expect(logger.serviceName).toBe('custom-service');
      expect(logger.version).toBe('2.0.0');
    });

    test('should create winston logger with correct configuration', () => {
      expect(winston.createLogger).toHaveBeenCalledWith(
        expect.objectContaining({
          level: 'info',
          defaultMeta: expect.objectContaining({
            service: 'test-service',
            version: '1.0.0',
            auditEvent: true
          })
        })
      );
    });
  });

  describe('PHI Redaction', () => {
    test('should redact PHI fields from simple objects', () => {
      const data = {
        patientName: 'John Doe',
        patientID: '12345',
        studyDate: '2024-01-01',
        normalField: 'normal value'
      };

      const redacted = auditLogger.redactPHI(data);

      expect(redacted.patientName).toBe('[REDACTED]');
      expect(redacted.patientID).toBe('[REDACTED]');
      expect(redacted.studyDate).toBe('2024-01-01');
      expect(redacted.normalField).toBe('normal value');
    });

    test('should redact PHI fields from nested objects', () => {
      const data = {
        patient: {
          patientName: 'John Doe',
          patientBirthDate: '1990-01-01'
        },
        study: {
          studyInstanceUID: '1.2.3.4.5',
          referringPhysicianName: 'Dr. Smith'
        }
      };

      const redacted = auditLogger.redactPHI(data);

      expect(redacted.patient.patientName).toBe('[REDACTED]');
      expect(redacted.patient.patientBirthDate).toBe('[REDACTED]');
      expect(redacted.study.studyInstanceUID).toBe('1.2.3.4.5');
      expect(redacted.study.referringPhysicianName).toBe('[REDACTED]');
    });

    test('should redact security-related fields', () => {
      const data = {
        password: 'secret123',
        token: 'abc123',
        authorization: 'Bearer token',
        cookie: 'session=xyz',
        normalField: 'normal value'
      };

      const redacted = auditLogger.redactPHI(data);

      expect(redacted.password).toBe('[REDACTED]');
      expect(redacted.token).toBe('[REDACTED]');
      expect(redacted.authorization).toBe('[REDACTED]');
      expect(redacted.cookie).toBe('[REDACTED]');
      expect(redacted.normalField).toBe('normal value');
    });

    test('should handle arrays with PHI data', () => {
      const data = [
        { patientName: 'John Doe', studyDate: '2024-01-01' },
        { patientName: 'Jane Smith', studyDate: '2024-01-02' }
      ];

      const redacted = auditLogger.redactPHI(data);

      expect(Array.isArray(redacted)).toBe(true);
      expect(redacted[0].patientName).toBe('[REDACTED]');
      expect(redacted[0].studyDate).toBe('2024-01-01');
      expect(redacted[1].patientName).toBe('[REDACTED]');
      expect(redacted[1].studyDate).toBe('2024-01-02');
    });

    test('should handle null and undefined values', () => {
      expect(auditLogger.redactPHI(null)).toBe(null);
      expect(auditLogger.redactPHI(undefined)).toBe(undefined);
      expect(auditLogger.redactPHI('string')).toBe('string');
      expect(auditLogger.redactPHI(123)).toBe(123);
    });

    test('should handle case-insensitive PHI field matching', () => {
      const data = {
        PatientName: 'John Doe',
        patientID: '12345',
        PatientBirthDate: '1990-01-01'
      };

      const redacted = auditLogger.redactPHI(data);

      expect(redacted.PatientName).toBe('[REDACTED]');
      expect(redacted.patientID).toBe('[REDACTED]');
      expect(redacted.PatientBirthDate).toBe('[REDACTED]');
    });
  });

  describe('Correlation ID Generation', () => {
    test('should generate unique correlation IDs', () => {
      const id1 = auditLogger.generateCorrelationId();
      const id2 = auditLogger.generateCorrelationId();

      expect(id1).toBeDefined();
      expect(id2).toBeDefined();
      expect(id1).not.toBe(id2);
      expect(typeof id1).toBe('string');
      expect(id1.length).toBeGreaterThan(0);
    });
  });

  describe('Base Audit Event Creation', () => {
    test('should create base audit event with required fields', () => {
      const eventType = 'test.event';
      const details = { testField: 'testValue' };

      const event = auditLogger.createBaseAuditEvent(eventType, details);

      expect(event).toMatchObject({
        service: 'test-service',
        version: '1.0.0',
        environment: 'test',
        eventType: 'test.event',
        severity: 'info'
      });
      expect(event.timestamp).toBeDefined();
      expect(event.correlationId).toBeDefined();
      expect(event.details).toBeDefined();
    });

    test('should use provided correlation ID', () => {
      const correlationId = 'test-correlation-id';
      const event = auditLogger.createBaseAuditEvent('test.event', { correlationId });

      expect(event.correlationId).toBe(correlationId);
    });

    test('should redact PHI from details', () => {
      const details = {
        patientName: 'John Doe',
        studyDate: '2024-01-01'
      };

      const event = auditLogger.createBaseAuditEvent('test.event', details);

      expect(event.details.patientName).toBe('[REDACTED]');
      expect(event.details.studyDate).toBe('2024-01-01');
    });
  });

  describe('Access Event Logging', () => {
    test('should log access request events', () => {
      const userContext = {
        userId: 'user123',
        username: 'testuser',
        role: 'admin',
        sourceIP: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
        sessionId: 'session123'
      };

      const details = {
        resource: '/api/studies',
        action: 'GET',
        method: 'GET',
        path: '/api/studies',
        success: true,
        statusCode: 200
      };

      const correlationId = auditLogger.logAccessEvent('request', userContext, details);

      expect(correlationId).toBeDefined();
      expect(mockWinstonLogger.info).toHaveBeenCalledWith(
        'Access audit event',
        expect.objectContaining({
          eventType: 'access.request',
          details: expect.objectContaining({
            userId: 'user123',
            username: 'testuser',
            resource: '/api/studies',
            success: true,
            statusCode: 200
          })
        })
      );
    });

    test('should log failed access events with warning level', () => {
      const userContext = {
        userId: 'user123',
        username: 'testuser',
        sourceIP: '192.168.1.1'
      };

      const details = {
        resource: '/api/admin',
        action: 'GET',
        success: false,
        statusCode: 403,
        errorMessage: 'Access denied'
      };

      auditLogger.logAccessEvent('unauthorized', userContext, details);

      expect(mockWinstonLogger.warn).toHaveBeenCalledWith(
        'Access audit event',
        expect.objectContaining({
          eventType: 'access.unauthorized',
          details: expect.objectContaining({
            success: false,
            statusCode: 403,
            errorMessage: 'Access denied'
          })
        })
      );
    });

    test('should redact PHI from user context', () => {
      const userContext = {
        userId: 'user123',
        sourceIP: '192.168.1.1'
      };

      const details = {
        patientName: 'John Doe', // This should be redacted
        resource: '/api/studies'
      };

      auditLogger.logAccessEvent('request', userContext, details);

      expect(mockWinstonLogger.info).toHaveBeenCalledWith(
        'Access audit event',
        expect.objectContaining({
          details: expect.objectContaining({
            userId: 'user123',
            patientName: '[REDACTED]',
            sourceIP: '192.168.1.1',
            resource: '/api/studies'
          })
        })
      );
    });
  });

  describe('DICOM Processing Event Logging', () => {
    test('should log DICOM processing events', () => {
      const instanceData = {
        instanceId: 'instance123',
        studyInstanceUID: '1.2.3.4.5',
        seriesInstanceUID: '1.2.3.4.6',
        sopInstanceUID: '1.2.3.4.7',
        modality: 'CT',
        aeTitle: 'ORTHANC',
        sourceIP: '192.168.1.100'
      };

      const details = {
        processingTime: 1500,
        success: true,
        operation: 'anonymization'
      };

      const correlationId = auditLogger.logDicomProcessingEvent('started', instanceData, details);

      expect(correlationId).toBeDefined();
      expect(mockWinstonLogger.info).toHaveBeenCalledWith(
        'DICOM processing audit event',
        expect.objectContaining({
          eventType: 'dicom.processing.started',
          details: expect.objectContaining({
            instanceId: 'instance123',
            studyInstanceUID: '1.2.3.4.5',
            modality: 'CT',
            processingTime: 1500,
            success: true
          })
        })
      );
    });

    test('should handle DICOM processing failures', () => {
      const instanceData = {
        instanceId: 'instance123',
        studyInstanceUID: '1.2.3.4.5'
      };

      const details = {
        success: false,
        errorMessage: 'Processing failed',
        processingTime: 500
      };

      auditLogger.logDicomProcessingEvent('failed', instanceData, details);

      expect(mockWinstonLogger.info).toHaveBeenCalledWith(
        'DICOM processing audit event',
        expect.objectContaining({
          eventType: 'dicom.processing.failed',
          details: expect.objectContaining({
            success: false,
            errorMessage: 'Processing failed'
          })
        })
      );
    });
  });

  describe('Webhook Event Logging', () => {
    test('should log webhook events', () => {
      const webhookData = {
        sourceIP: '192.168.1.200',
        userAgent: 'Orthanc/1.9.0',
        requestMethod: 'POST',
        requestPath: '/webhook/orthanc',
        timestamp: '2024-01-01T12:00:00Z',
        nonce: 'nonce123'
      };

      const details = {
        signatureValid: true,
        rateLimitStatus: 'allowed',
        processingTime: 250
      };

      const correlationId = auditLogger.logWebhookEvent('received', webhookData, details);

      expect(correlationId).toBeDefined();
      expect(mockWinstonLogger.info).toHaveBeenCalledWith(
        'Webhook audit event',
        expect.objectContaining({
          eventType: 'webhook.received',
          details: expect.objectContaining({
            sourceIP: '192.168.1.200',
            signatureValid: '[REDACTED]', // This gets redacted because it contains 'signature'
            rateLimitStatus: 'allowed'
          })
        })
      );
    });

    test('should log webhook security violations with error level', () => {
      const webhookData = {
        sourceIP: '192.168.1.200',
        userAgent: 'Malicious/1.0'
      };

      const details = {
        signatureValid: false,
        errorMessage: 'Invalid HMAC signature'
      };

      auditLogger.logWebhookEvent('invalid_signature', webhookData, details);

      expect(mockWinstonLogger.error).toHaveBeenCalledWith(
        'Webhook audit event',
        expect.objectContaining({
          eventType: 'webhook.invalid_signature',
          details: expect.objectContaining({
            signatureValid: '[REDACTED]', // This gets redacted because it contains 'signature'
            errorMessage: 'Invalid HMAC signature'
          })
        })
      );
    });
  });

  describe('System Event Logging', () => {
    test('should log system events', () => {
      const systemData = {
        component: 'bridge-worker',
        operation: 'startup',
        result: 'success'
      };

      const details = {
        duration: 2000,
        resourceUsage: { memory: '256MB', cpu: '10%' }
      };

      const correlationId = auditLogger.logSystemEvent('startup', systemData, details);

      expect(correlationId).toBeDefined();
      expect(mockWinstonLogger.info).toHaveBeenCalledWith(
        'System audit event',
        expect.objectContaining({
          eventType: 'system.startup',
          details: expect.objectContaining({
            component: 'bridge-worker',
            operation: 'startup',
            result: 'success',
            duration: 2000
          })
        })
      );
    });
  });

  describe('Severity Level Mapping', () => {
    test('should return correct severity levels for different event types', () => {
      expect(auditLogger.getSeverityLevel('access.login_success')).toBe('info');
      expect(auditLogger.getSeverityLevel('access.login_failure')).toBe('warn');
      expect(auditLogger.getSeverityLevel('access.unauthorized')).toBe('warn');
      expect(auditLogger.getSeverityLevel('dicom.processing.failed')).toBe('error');
      expect(auditLogger.getSeverityLevel('webhook.invalid_signature')).toBe('error');
      expect(auditLogger.getSeverityLevel('webhook.replay_attack')).toBe('critical');
      expect(auditLogger.getSeverityLevel('system.error')).toBe('error');
      expect(auditLogger.getSeverityLevel('unknown.event')).toBe('info');
    });
  });

  describe('Integration Tests', () => {
    test('should handle complete audit workflow for DICOM processing', () => {
      // Simulate a complete DICOM processing workflow
      const userContext = {
        userId: 'system',
        username: 'bridge-worker',
        sourceIP: '127.0.0.1'
      };

      const instanceData = {
        instanceId: 'instance123',
        studyInstanceUID: '1.2.3.4.5',
        patientName: 'John Doe', // Should be redacted
        modality: 'CT'
      };

      // Log access event
      auditLogger.logAccessEvent('dicom_read', userContext, {
        resource: '/api/instances/instance123',
        success: true
      });

      // Log processing start
      auditLogger.logDicomProcessingEvent('started', instanceData, {
        operation: 'anonymization'
      });

      // Log processing completion
      auditLogger.logDicomProcessingEvent('completed', instanceData, {
        processingTime: 1500,
        success: true
      });

      // Verify all events were logged
      expect(mockWinstonLogger.info).toHaveBeenCalledTimes(3);
      
      // Verify PHI redaction in all events
      const calls = mockWinstonLogger.info.mock.calls;
      calls.forEach(call => {
        const auditEvent = call[1];
        if (auditEvent.details.patientName) {
          expect(auditEvent.details.patientName).toBe('[REDACTED]');
        }
      });
    });

    test('should maintain correlation ID across related events', () => {
      const correlationId = auditLogger.generateCorrelationId();
      
      const userContext = { userId: 'user123', sourceIP: '192.168.1.1' };
      const instanceData = { instanceId: 'instance123', studyInstanceUID: '1.2.3.4.5' };

      // Use same correlation ID for related events
      auditLogger.logAccessEvent('request', userContext, { correlationId });
      auditLogger.logDicomProcessingEvent('started', instanceData, { correlationId });
      auditLogger.logDicomProcessingEvent('completed', instanceData, { correlationId });

      // Verify all events have the same correlation ID
      const calls = mockWinstonLogger.info.mock.calls;
      calls.forEach(call => {
        const auditEvent = call[1];
        expect(auditEvent.correlationId).toBe(correlationId);
      });
    });
  });
});