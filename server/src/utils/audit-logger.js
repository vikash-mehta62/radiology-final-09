const crypto = require('crypto');
const winston = require('winston');
const path = require('path');
const { randomUUID } = require('./crypto-polyfill');

/**
 * Comprehensive Audit Logger for Node Server Operations
 * Provides structured audit logging with correlation IDs, PHI redaction, and SIEM integration
 */
class AuditLogger {
  constructor(options = {}) {
    this.serviceName = options.serviceName || 'node-server';
    this.version = options.version || '1.0.0';
    this.environment = process.env.NODE_ENV || 'development';
    
    // Initialize Winston logger for audit events
    this.logger = this.createAuditLogger();
    
    // PHI fields that need redaction
    this.phiFields = [
      'patientName', 'patientID', 'patientBirthDate', 'patientSex',
      'patientAddress', 'patientTelephoneNumbers', 'institutionName',
      'institutionAddress', 'referringPhysicianName', 'performingPhysicianName',
      'operatorName', 'reviewerName', 'password', 'token', 'authorization',
      'cookie', 'secret', 'key', 'signature'
    ];
  }

  /**
   * Create dedicated Winston logger for audit events
   */
  createAuditLogger() {
    const auditFormat = winston.format.combine(
      winston.format.timestamp({
        format: 'YYYY-MM-DD HH:mm:ss.SSS'
      }),
      winston.format.errors({ stack: true }),
      winston.format.json(),
      winston.format.printf(({ timestamp, level, message, ...meta }) => {
        return JSON.stringify({
          timestamp,
          level,
          message,
          service: this.serviceName,
          environment: this.environment,
          auditEvent: true,
          ...meta
        });
      })
    );

    return winston.createLogger({
      level: 'info',
      format: auditFormat,
      defaultMeta: {
        service: this.serviceName,
        version: this.version,
        auditEvent: true
      },
      transports: [
        // Dedicated audit log file
        new winston.transports.File({
          filename: path.join(process.cwd(), 'logs', 'audit.log'),
          maxsize: 50 * 1024 * 1024, // 50MB
          maxFiles: 10,
          tailable: true
        }),
        
        // Console output for development
        ...(this.environment === 'development' ? [
          new winston.transports.Console({
            format: winston.format.combine(
              winston.format.colorize(),
              winston.format.simple()
            )
          })
        ] : [])
      ]
    });
  }

  /**
   * Generate unique correlation ID for tracking related events
   */
  generateCorrelationId() {
    return randomUUID();
  }

  /**
   * Redact PHI and sensitive data from audit logs
   */
  redactPHI(data) {
    if (!data || typeof data !== 'object') {
      return data;
    }

    const redacted = Array.isArray(data) ? [] : {};
    
    for (const [key, value] of Object.entries(data)) {
      const lowerKey = key.toLowerCase();
      
      // Check if field contains PHI
      const isPHI = this.phiFields.some(field => 
        lowerKey.includes(field.toLowerCase()) || 
        lowerKey === field.toLowerCase()
      );
      
      if (isPHI) {
        redacted[key] = '[REDACTED]';
      } else if (typeof value === 'object' && value !== null) {
        redacted[key] = this.redactPHI(value);
      } else {
        redacted[key] = value;
      }
    }
    
    return redacted;
  }

  /**
   * Create base audit event structure
   */
  createBaseAuditEvent(eventType, details = {}) {
    const correlationId = details.correlationId || this.generateCorrelationId();
    const timestamp = new Date().toISOString();
    
    return {
      timestamp,
      correlationId,
      service: this.serviceName,
      version: this.version,
      environment: this.environment,
      eventType,
      severity: this.getSeverityLevel(eventType),
      details: this.redactPHI(details)
    };
  }

  /**
   * Log user access audit events
   */
  logAccessEvent(eventType, userContext, details = {}) {
    const auditEvent = this.createBaseAuditEvent(`access.${eventType}`, {
      userId: userContext.userId,
      username: userContext.username,
      role: userContext.role,
      sourceIP: userContext.sourceIP,
      userAgent: userContext.userAgent,
      sessionId: userContext.sessionId,
      resource: details.resource,
      action: details.action,
      method: details.method,
      path: details.path,
      success: details.success,
      statusCode: details.statusCode,
      errorMessage: details.errorMessage,
      duration: details.duration,
      dataAccessed: details.dataAccessed,
      permissions: details.permissions,
      ...details
    });

    const logLevel = details.success === false ? 'warn' : 'info';
    this.logger[logLevel]('Access audit event', auditEvent);
    return auditEvent.correlationId;
  }

  /**
   * Log DICOM processing audit events
   */
  logDicomProcessingEvent(eventType, instanceData, details = {}) {
    const auditEvent = this.createBaseAuditEvent(`dicom.processing.${eventType}`, {
      instanceId: instanceData.instanceId,
      studyInstanceUID: instanceData.studyInstanceUID,
      seriesInstanceUID: instanceData.seriesInstanceUID,
      sopInstanceUID: instanceData.sopInstanceUID,
      modality: instanceData.modality,
      aeTitle: instanceData.aeTitle,
      sourceIP: instanceData.sourceIP,
      processingTime: details.processingTime,
      success: details.success,
      errorMessage: details.errorMessage,
      ...details
    });

    this.logger.info('DICOM processing audit event', auditEvent);
    return auditEvent.correlationId;
  }

  /**
   * Log webhook audit events
   */
  logWebhookEvent(eventType, webhookData, details = {}) {
    const auditEvent = this.createBaseAuditEvent(`webhook.${eventType}`, {
      sourceIP: webhookData.sourceIP,
      userAgent: webhookData.userAgent,
      requestMethod: webhookData.requestMethod,
      requestPath: webhookData.requestPath,
      timestamp: webhookData.timestamp,
      nonce: webhookData.nonce,
      signatureValid: details.signatureValid,
      rateLimitStatus: details.rateLimitStatus,
      processingTime: details.processingTime,
      ...details
    });

    const logLevel = eventType.includes('error') || eventType.includes('invalid') ? 'error' : 'info';
    this.logger[logLevel]('Webhook audit event', auditEvent);
    return auditEvent.correlationId;
  }

  /**
   * Log system audit events
   */
  logSystemEvent(eventType, systemData, details = {}) {
    const auditEvent = this.createBaseAuditEvent(`system.${eventType}`, {
      component: systemData.component,
      operation: systemData.operation,
      result: systemData.result,
      duration: details.duration,
      resourceUsage: details.resourceUsage,
      ...details
    });

    this.logger.info('System audit event', auditEvent);
    return auditEvent.correlationId;
  }

  /**
   * Get severity level based on event type
   */
  getSeverityLevel(eventType) {
    const severityMap = {
      // Access events
      'access.request': 'info',
      'access.response': 'info',
      'access.login_attempt': 'info',
      'access.login_success': 'info',
      'access.login_failure': 'warn',
      'access.logout': 'info',
      'access.unauthorized': 'warn',
      'access.forbidden': 'warn',
      'access.dicom_read': 'info',
      'access.dicom_create': 'info',
      'access.dicom_update': 'warn',
      'access.dicom_delete': 'warn',
      
      // DICOM processing events
      'dicom.processing.started': 'info',
      'dicom.processing.completed': 'info',
      'dicom.processing.failed': 'error',
      'dicom.processing.timeout': 'warn',
      
      // Webhook events
      'webhook.received': 'info',
      'webhook.processed': 'info',
      'webhook.invalid_signature': 'error',
      'webhook.rate_limited': 'warn',
      'webhook.replay_attack': 'critical',
      
      // System events
      'system.startup': 'info',
      'system.shutdown': 'info',
      'system.error': 'error',
      'system.config_change': 'warn'
    };

    return severityMap[eventType] || 'info';
  }
}

module.exports = AuditLogger;