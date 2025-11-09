const winston = require('winston');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

class AdminActionLogger {
  constructor(config = {}) {
    this.config = {
      logLevel: config.logLevel || 'info',
      logDir: config.logDir || path.join(__dirname, '../../logs'),
      maxFiles: config.maxFiles || 30,
      maxSize: config.maxSize || '100m',
      enableConsole: config.enableConsole !== false,
      enableFile: config.enableFile !== false,
      enableSIEM: config.enableSIEM !== false,
      siemEndpoint: config.siemEndpoint || process.env.SIEM_ENDPOINT
    };

    this.sessions = new Map(); // Track user sessions
    this.initializeLogger();
  }

  initializeLogger() {
    const transports = [];

    // Console transport
    if (this.config.enableConsole) {
      transports.push(new winston.transports.Console({
        format: winston.format.combine(
          winston.format.colorize(),
          winston.format.timestamp(),
          winston.format.printf(({ timestamp, level, message, ...meta }) => {
            return `${timestamp} [${level}] ${message} ${Object.keys(meta).length ? JSON.stringify(meta) : ''}`;
          })
        )
      }));
    }

    // File transport for admin actions
    if (this.config.enableFile) {
      transports.push(new winston.transports.File({
        filename: path.join(this.config.logDir, 'admin-actions.log'),
        maxsize: this.config.maxSize,
        maxFiles: this.config.maxFiles,
        format: winston.format.combine(
          winston.format.timestamp(),
          winston.format.json()
        )
      }));
    }

    this.logger = winston.createLogger({
      level: this.config.logLevel,
      transports,
      defaultMeta: {
        service: 'admin-action-logger',
        version: '1.0.0'
      }
    });
  }

  // Session management
  createSession(userId, userInfo, req) {
    const sessionId = uuidv4();
    const session = {
      sessionId,
      userId,
      username: userInfo.username,
      email: userInfo.email,
      roles: userInfo.roles || [],
      ipAddress: this.getClientIP(req),
      userAgent: req.headers['user-agent'],
      createdAt: new Date(),
      lastActivity: new Date(),
      actions: []
    };

    this.sessions.set(sessionId, session);
    
    this.logAction('session_created', {
      sessionId,
      userId,
      username: userInfo.username,
      ipAddress: session.ipAddress,
      userAgent: session.userAgent
    }, req);

    return sessionId;
  }

  updateSessionActivity(sessionId) {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.lastActivity = new Date();
      this.sessions.set(sessionId, session);
    }
  }

  endSession(sessionId, req) {
    const session = this.sessions.get(sessionId);
    if (session) {
      this.logAction('session_ended', {
        sessionId,
        userId: session.userId,
        username: session.username,
        duration: new Date() - session.createdAt,
        actionsCount: session.actions.length
      }, req);

      this.sessions.delete(sessionId);
    }
  }

  getClientIP(req) {
    return req.ip || 
           req.connection?.remoteAddress || 
           req.socket?.remoteAddress ||
           (req.headers['x-forwarded-for'] && req.headers['x-forwarded-for'].split(',')[0].trim()) ||
           'unknown';
  }

  // Core logging function
  logAction(action, details = {}, req = null, user = null) {
    const timestamp = new Date();
    const correlationId = uuidv4();
    
    // Extract user info from request or provided user object
    const userInfo = user || req?.user || {};
    const sessionId = req?.sessionId || userInfo.sessionId;

    const logEntry = {
      timestamp: timestamp.toISOString(),
      correlationId,
      action,
      category: this.categorizeAction(action),
      severity: this.getSeverity(action),
      user: {
        id: userInfo.id,
        username: userInfo.username,
        email: userInfo.email,
        roles: userInfo.roles || []
      },
      session: {
        id: sessionId,
        ipAddress: req ? this.getClientIP(req) : 'unknown',
        userAgent: req?.headers['user-agent'] || 'unknown'
      },
      request: req ? {
        method: req.method,
        url: req.originalUrl || req.url,
        headers: this.sanitizeHeaders(req.headers),
        body: this.sanitizeRequestBody(req.body)
      } : null,
      details: this.sanitizeDetails(details),
      environment: process.env.NODE_ENV || 'development'
    };

    // Add to session actions if session exists
    if (sessionId) {
      const session = this.sessions.get(sessionId);
      if (session) {
        session.actions.push({
          action,
          timestamp,
          correlationId,
          details
        });
        this.updateSessionActivity(sessionId);
      }
    }

    // Log the entry
    this.logger.info('Admin action logged', logEntry);

    // Send to SIEM if configured
    if (this.config.enableSIEM && this.config.siemEndpoint) {
      this.sendToSIEM(logEntry).catch(error => {
        this.logger.error('Failed to send log to SIEM', { error: error.message, correlationId });
      });
    }

    return correlationId;
  }

  categorizeAction(action) {
    const categories = {
      // Authentication actions
      'login': 'authentication',
      'logout': 'authentication',
      'mfa_setup': 'authentication',
      'mfa_verify': 'authentication',
      'session_created': 'authentication',
      'session_ended': 'authentication',
      'password_change': 'authentication',

      // User management actions
      'user_create': 'user_management',
      'user_update': 'user_management',
      'user_delete': 'user_management',
      'user_role_assign': 'user_management',
      'user_role_remove': 'user_management',
      'user_disable': 'user_management',
      'user_enable': 'user_management',

      // Role and permission management
      'role_create': 'rbac_management',
      'role_update': 'rbac_management',
      'role_delete': 'rbac_management',
      'permission_create': 'rbac_management',
      'permission_update': 'rbac_management',
      'permission_delete': 'rbac_management',

      // System configuration
      'config_update': 'system_config',
      'secret_create': 'system_config',
      'secret_update': 'system_config',
      'secret_delete': 'system_config',
      'backup_create': 'system_config',
      'backup_restore': 'system_config',

      // DICOM operations
      'dicom_upload': 'dicom_operations',
      'dicom_delete': 'dicom_operations',
      'dicom_anonymize': 'dicom_operations',
      'study_delete': 'dicom_operations',

      // Monitoring and alerts
      'alert_create': 'monitoring',
      'alert_update': 'monitoring',
      'alert_delete': 'monitoring',
      'metric_config': 'monitoring',

      // Audit and compliance
      'audit_export': 'audit_compliance',
      'audit_view': 'audit_compliance',
      'compliance_report': 'audit_compliance'
    };

    return categories[action] || 'general';
  }

  getSeverity(action) {
    const highSeverityActions = [
      'user_delete', 'role_delete', 'permission_delete', 'secret_delete',
      'backup_restore', 'study_delete', 'dicom_delete', 'config_update'
    ];

    const mediumSeverityActions = [
      'user_create', 'user_update', 'role_create', 'role_update',
      'permission_create', 'secret_create', 'secret_update', 'backup_create'
    ];

    if (highSeverityActions.includes(action)) return 'high';
    if (mediumSeverityActions.includes(action)) return 'medium';
    return 'low';
  }

  sanitizeHeaders(headers) {
    const sanitized = { ...headers };
    
    // Remove sensitive headers
    delete sanitized.authorization;
    delete sanitized.cookie;
    delete sanitized['x-api-key'];
    
    return sanitized;
  }

  sanitizeRequestBody(body) {
    if (!body || typeof body !== 'object') return body;
    
    const sanitized = { ...body };
    
    // Remove sensitive fields
    const sensitiveFields = ['password', 'secret', 'token', 'key', 'credential'];
    
    Object.keys(sanitized).forEach(key => {
      if (sensitiveFields.some(field => key.toLowerCase().includes(field))) {
        sanitized[key] = '[REDACTED]';
      }
    });
    
    return sanitized;
  }

  sanitizeDetails(details) {
    if (!details || typeof details !== 'object') return details;
    
    const sanitized = { ...details };
    
    // Remove or mask PHI and sensitive data
    const sensitiveFields = ['ssn', 'dob', 'phone', 'address', 'password', 'secret', 'token'];
    
    Object.keys(sanitized).forEach(key => {
      if (sensitiveFields.some(field => key.toLowerCase().includes(field))) {
        sanitized[key] = '[REDACTED]';
      }
    });
    
    return sanitized;
  }

  async sendToSIEM(logEntry) {
    if (!this.config.siemEndpoint) return;
    
    try {
      const axios = require('axios');
      await axios.post(this.config.siemEndpoint, logEntry, {
        timeout: 5000,
        headers: {
          'Content-Type': 'application/json',
          'X-Source': 'orthanc-bridge-admin'
        }
      });
    } catch (error) {
      throw new Error(`SIEM logging failed: ${error.message}`);
    }
  }

  // Specific action logging methods
  logUserManagement(action, userId, targetUserId, details, req) {
    return this.logAction(action, {
      targetUserId,
      targetUsername: details.targetUsername,
      changes: details.changes,
      ...details
    }, req);
  }

  logRoleManagement(action, userId, roleId, details, req) {
    return this.logAction(action, {
      roleId,
      roleName: details.roleName,
      permissions: details.permissions,
      ...details
    }, req);
  }

  logSystemConfig(action, userId, configType, details, req) {
    return this.logAction(action, {
      configType,
      changes: details.changes,
      previousValue: details.previousValue ? '[REDACTED]' : undefined,
      newValue: details.newValue ? '[REDACTED]' : undefined,
      ...details
    }, req);
  }

  logDicomOperation(action, userId, studyUid, details, req) {
    return this.logAction(action, {
      studyUid,
      patientId: details.patientId,
      modality: details.modality,
      instanceCount: details.instanceCount,
      ...details
    }, req);
  }

  // Reporting methods
  async getActionReport(filters = {}) {
    // In a production environment, this would query a database
    // For now, return recent actions from memory
    const allActions = [];
    
    this.sessions.forEach(session => {
      session.actions.forEach(action => {
        allActions.push({
          ...action,
          userId: session.userId,
          username: session.username,
          sessionId: session.sessionId
        });
      });
    });

    // Apply filters
    let filteredActions = allActions;
    
    if (filters.userId) {
      filteredActions = filteredActions.filter(a => a.userId === filters.userId);
    }
    
    if (filters.action) {
      filteredActions = filteredActions.filter(a => a.action === filters.action);
    }
    
    if (filters.startDate) {
      filteredActions = filteredActions.filter(a => a.timestamp >= new Date(filters.startDate));
    }
    
    if (filters.endDate) {
      filteredActions = filteredActions.filter(a => a.timestamp <= new Date(filters.endDate));
    }

    return filteredActions.sort((a, b) => b.timestamp - a.timestamp);
  }

  async getUserActionSummary(userId, timeRange = '24h') {
    const actions = await this.getActionReport({ userId });
    const cutoffTime = new Date();
    
    switch (timeRange) {
      case '1h':
        cutoffTime.setHours(cutoffTime.getHours() - 1);
        break;
      case '24h':
        cutoffTime.setDate(cutoffTime.getDate() - 1);
        break;
      case '7d':
        cutoffTime.setDate(cutoffTime.getDate() - 7);
        break;
      case '30d':
        cutoffTime.setDate(cutoffTime.getDate() - 30);
        break;
    }

    const recentActions = actions.filter(a => a.timestamp >= cutoffTime);
    
    const summary = {
      userId,
      timeRange,
      totalActions: recentActions.length,
      actionsByCategory: {},
      actionsBySeverity: { high: 0, medium: 0, low: 0 },
      recentActions: recentActions.slice(0, 10)
    };

    recentActions.forEach(action => {
      const category = this.categorizeAction(action.action);
      const severity = this.getSeverity(action.action);
      
      summary.actionsByCategory[category] = (summary.actionsByCategory[category] || 0) + 1;
      summary.actionsBySeverity[severity]++;
    });

    return summary;
  }

  // Middleware function
  adminActionMiddleware() {
    return (req, res, next) => {
      // Store original res.json to intercept responses
      const originalJson = res.json;
      
      res.json = function(data) {
        // Log successful admin actions
        if (req.user && req.method !== 'GET' && res.statusCode < 400) {
          const action = `${req.method.toLowerCase()}_${req.route?.path?.replace(/[\/:\*]/g, '_') || 'unknown'}`;
          
          // Don't log if it's not an admin action
          if (req.originalUrl.includes('/api/rbac') || 
              req.originalUrl.includes('/api/secrets') ||
              req.originalUrl.includes('/api/anonymization') ||
              req.originalUrl.includes('/alerts')) {
            
            const logger = req.app.locals.adminActionLogger;
            if (logger) {
              logger.logAction(action, {
                endpoint: req.originalUrl,
                method: req.method,
                statusCode: res.statusCode,
                responseData: typeof data === 'object' ? Object.keys(data) : 'non-object'
              }, req);
            }
          }
        }
        
        return originalJson.call(this, data);
      };
      
      next();
    };
  }
}

module.exports = AdminActionLogger;