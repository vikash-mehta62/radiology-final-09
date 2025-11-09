const AuditLogger = require('../../src/utils/audit-logger');
const { 
  logRequest, 
  logAuthentication, 
  logDicomOperation 
} = require('../../src/middleware/auditMiddleware');

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

describe('Audit Integration Tests', () => {
  let auditLogger;
  let mockWinstonLogger;

  beforeEach(() => {
    jest.clearAllMocks();
    auditLogger = new AuditLogger({ serviceName: 'test-service' });
    mockWinstonLogger = require('winston').createLogger();
  });

  describe('Complete DICOM Processing Audit Trail', () => {
    test('should create complete audit trail for DICOM processing workflow', () => {
      const correlationId = auditLogger.generateCorrelationId();
      
      // Simulate user accessing DICOM endpoint
      const userContext = {
        userId: 'user123',
        username: 'radiologist',
        role: 'doctor',
        sourceIP: '192.168.1.100',
        userAgent: 'DICOM-Viewer/1.0',
        sessionId: 'session123'
      };

      // 1. Log initial access request
      auditLogger.logAccessEvent('request', userContext, {
        correlationId,
        resource: '/api/studies/1.2.3.4.5',
        action: 'GET',
        method: 'GET',
        path: '/api/studies/1.2.3.4.5'
      });

      // 2. Log DICOM processing start
      const instanceData = {
        instanceId: 'instance123',
        studyInstanceUID: '1.2.3.4.5',
        seriesInstanceUID: '1.2.3.4.6',
        sopInstanceUID: '1.2.3.4.7',
        modality: 'CT',
        aeTitle: 'ORTHANC',
        sourceIP: '192.168.1.200',
        patientName: 'John Doe' // This should be redacted
      };

      auditLogger.logDicomProcessingEvent('started', instanceData, {
        correlationId,
        operation: 'anonymization',
        processingTime: 0
      });

      // 3. Log anonymization process
      auditLogger.logDicomProcessingEvent('anonymization', instanceData, {
        correlationId,
        tagsRemoved: ['PatientName', 'PatientID', 'PatientBirthDate'],
        tagsModified: ['StudyDate', 'StudyTime'],
        success: true
      });

      // 4. Log processing completion
      auditLogger.logDicomProcessingEvent('completed', instanceData, {
        correlationId,
        processingTime: 1500,
        success: true,
        outputSize: 2048000
      });

      // 5. Log access response
      auditLogger.logAccessEvent('response', userContext, {
        correlationId,
        resource: '/api/studies/1.2.3.4.5',
        action: 'GET',
        success: true,
        statusCode: 200,
        duration: 1600,
        responseSize: 2048000
      });

      // Verify all events were logged
      expect(mockWinstonLogger.info).toHaveBeenCalledTimes(5);

      // Verify correlation ID is consistent across all events
      const calls = mockWinstonLogger.info.mock.calls;
      calls.forEach(call => {
        const auditEvent = call[1];
        expect(auditEvent.correlationId).toBe(correlationId);
      });

      // Verify PHI redaction
      calls.forEach(call => {
        const auditEvent = call[1];
        if (auditEvent.details.patientName) {
          expect(auditEvent.details.patientName).toBe('[REDACTED]');
        }
      });

      // Verify event types
      const eventTypes = calls.map(call => call[1].eventType);
      expect(eventTypes).toEqual([
        'access.request',
        'dicom.processing.started',
        'dicom.processing.anonymization',
        'dicom.processing.completed',
        'access.response'
      ]);
    });
  });

  describe('Security Event Audit Trail', () => {
    test('should create audit trail for security violations', () => {
      const correlationId = auditLogger.generateCorrelationId();

      // 1. Log webhook with invalid signature
      const webhookData = {
        sourceIP: '192.168.1.200',
        userAgent: 'Malicious/1.0',
        requestMethod: 'POST',
        requestPath: '/webhook/orthanc',
        timestamp: '2024-01-01T12:00:00Z',
        nonce: 'invalid-nonce'
      };

      auditLogger.logWebhookEvent('invalid_signature', webhookData, {
        correlationId,
        signatureValid: false,
        expectedSignature: 'valid-signature',
        receivedSignature: 'invalid-signature',
        errorMessage: 'HMAC signature validation failed'
      });

      // 2. Log rate limiting
      auditLogger.logWebhookEvent('rate_limited', webhookData, {
        correlationId,
        rateLimitStatus: 'exceeded',
        requestCount: 150,
        limitPerMinute: 100,
        blockDuration: 300
      });

      // 3. Log unauthorized access attempt
      const userContext = {
        userId: 'anonymous',
        username: 'anonymous',
        sourceIP: '192.168.1.200',
        userAgent: 'Malicious/1.0'
      };

      auditLogger.logAccessEvent('unauthorized', userContext, {
        correlationId,
        resource: '/api/admin/config',
        action: 'GET',
        success: false,
        statusCode: 401,
        errorMessage: 'Authentication required'
      });

      // Verify security events were logged with appropriate levels
      expect(mockWinstonLogger.error).toHaveBeenCalledTimes(1); // invalid_signature
      expect(mockWinstonLogger.info).toHaveBeenCalledTimes(1);  // rate_limited
      expect(mockWinstonLogger.warn).toHaveBeenCalledTimes(1);  // unauthorized

      // Verify all events have the same correlation ID
      const allCalls = [
        ...mockWinstonLogger.error.mock.calls,
        ...mockWinstonLogger.info.mock.calls,
        ...mockWinstonLogger.warn.mock.calls
      ];

      allCalls.forEach(call => {
        const auditEvent = call[1];
        expect(auditEvent.correlationId).toBe(correlationId);
      });
    });
  });

  describe('System Event Audit Trail', () => {
    test('should create audit trail for system operations', () => {
      const correlationId = auditLogger.generateCorrelationId();

      // 1. Log system startup
      auditLogger.logSystemEvent('startup', {
        component: 'bridge-worker',
        operation: 'initialization',
        result: 'success'
      }, {
        correlationId,
        duration: 2000,
        configLoaded: true,
        databaseConnected: true
      });

      // 2. Log configuration change
      auditLogger.logSystemEvent('config_change', {
        component: 'webhook-security',
        operation: 'update_hmac_key',
        result: 'success'
      }, {
        correlationId,
        changedBy: 'admin',
        previousKeyHash: 'hash123',
        newKeyHash: 'hash456'
      });

      // 3. Log system error
      auditLogger.logSystemEvent('error', {
        component: 'dicom-processor',
        operation: 'image_conversion',
        result: 'failure'
      }, {
        correlationId,
        errorCode: 'CONV_001',
        errorMessage: 'Unsupported DICOM transfer syntax',
        stackTrace: 'Error at line 123...'
      });

      // Verify system events were logged
      expect(mockWinstonLogger.info).toHaveBeenCalledTimes(3);

      // Verify correlation ID consistency
      const calls = mockWinstonLogger.info.mock.calls;
      calls.forEach(call => {
        const auditEvent = call[1];
        expect(auditEvent.correlationId).toBe(correlationId);
        expect(auditEvent.eventType).toMatch(/^system\./);
      });
    });
  });

  describe('PHI Protection Validation', () => {
    test('should consistently redact PHI across all audit event types', () => {
      const phiData = {
        patientName: 'John Doe',
        patientID: '12345',
        patientBirthDate: '1990-01-01',
        institutionName: 'General Hospital',
        referringPhysicianName: 'Dr. Smith',
        password: 'secret123',
        token: 'abc123',
        studyInstanceUID: '1.2.3.4.5', // This should NOT be redacted
        modality: 'CT' // This should NOT be redacted
      };

      // Test access event PHI redaction
      auditLogger.logAccessEvent('request', {
        userId: 'user123',
        sourceIP: '192.168.1.1'
      }, phiData);

      // Test DICOM processing event PHI redaction
      auditLogger.logDicomProcessingEvent('started', {
        instanceId: 'instance123',
        ...phiData
      }, {});

      // Test webhook event PHI redaction
      auditLogger.logWebhookEvent('received', {
        sourceIP: '192.168.1.200',
        userAgent: 'Test/1.0'
      }, phiData);

      // Test system event PHI redaction
      auditLogger.logSystemEvent('backup', {
        component: 'database',
        operation: 'export'
      }, phiData);

      // Verify all events were logged
      expect(mockWinstonLogger.info).toHaveBeenCalledTimes(4);

      // Verify PHI redaction in all events
      const calls = mockWinstonLogger.info.mock.calls;
      calls.forEach(call => {
        const auditEvent = call[1];
        const details = auditEvent.details;

        // These should be redacted
        if (details.patientName) expect(details.patientName).toBe('[REDACTED]');
        if (details.patientID) expect(details.patientID).toBe('[REDACTED]');
        if (details.patientBirthDate) expect(details.patientBirthDate).toBe('[REDACTED]');
        if (details.institutionName) expect(details.institutionName).toBe('[REDACTED]');
        if (details.referringPhysicianName) expect(details.referringPhysicianName).toBe('[REDACTED]');
        if (details.password) expect(details.password).toBe('[REDACTED]');
        if (details.token) expect(details.token).toBe('[REDACTED]');

        // These should NOT be redacted
        if (details.studyInstanceUID) expect(details.studyInstanceUID).toBe('1.2.3.4.5');
        if (details.modality) expect(details.modality).toBe('CT');
      });
    });
  });

  describe('Audit Event Structure Validation', () => {
    test('should ensure all audit events have required fields', () => {
      const requiredFields = [
        'timestamp',
        'correlationId',
        'service',
        'version',
        'environment',
        'eventType',
        'severity',
        'details'
      ];

      // Generate different types of audit events
      auditLogger.logAccessEvent('request', { userId: 'user123', sourceIP: '192.168.1.1' }, {});
      auditLogger.logDicomProcessingEvent('started', { instanceId: 'inst123' }, {});
      auditLogger.logWebhookEvent('received', { sourceIP: '192.168.1.200' }, {});
      auditLogger.logSystemEvent('startup', { component: 'test' }, {});

      // Verify all events have required fields
      const calls = mockWinstonLogger.info.mock.calls;
      calls.forEach(call => {
        const auditEvent = call[1];
        
        requiredFields.forEach(field => {
          expect(auditEvent).toHaveProperty(field);
          expect(auditEvent[field]).toBeDefined();
        });

        // Verify timestamp format
        expect(auditEvent.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
        
        // Verify correlation ID format (UUID)
        expect(auditEvent.correlationId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
        
        // Verify service and version
        expect(auditEvent.service).toBe('test-service');
        expect(auditEvent.version).toBe('1.0.0');
        expect(auditEvent.environment).toBe('test');
        
        // Verify event type format
        expect(auditEvent.eventType).toMatch(/^(access|dicom|webhook|system)\./);
        
        // Verify severity levels
        expect(['info', 'warn', 'error', 'critical']).toContain(auditEvent.severity);
      });
    });
  });

  describe('Performance and Volume Testing', () => {
    test('should handle high volume of audit events efficiently', () => {
      const startTime = Date.now();
      const eventCount = 1000;

      // Generate high volume of audit events
      for (let i = 0; i < eventCount; i++) {
        auditLogger.logAccessEvent('request', {
          userId: `user${i}`,
          sourceIP: '192.168.1.1'
        }, {
          resource: `/api/studies/${i}`,
          action: 'GET'
        });
      }

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Verify all events were logged
      expect(mockWinstonLogger.info).toHaveBeenCalledTimes(eventCount);

      // Verify performance (should complete within reasonable time)
      expect(duration).toBeLessThan(5000); // 5 seconds for 1000 events

      // Verify each event has unique correlation ID
      const calls = mockWinstonLogger.info.mock.calls;
      const correlationIds = calls.map(call => call[1].correlationId);
      const uniqueIds = new Set(correlationIds);
      expect(uniqueIds.size).toBe(eventCount);
    });
  });
});