const AuditLogger = require('../utils/audit-logger');

// Initialize audit logger
const auditLogger = new AuditLogger({
  serviceName: 'medical-imaging-api',
  version: '1.0.0'
});

/**
 * Audit middleware for tracking all API requests
 */
function auditMiddleware(options = {}) {
  const {
    excludePaths = ['/health', '/metrics', '/api/monitoring'],
    logBody = false
  } = options;

  return (req, res, next) => {
    // Skip excluded paths
    if (excludePaths.some(path => req.path.startsWith(path))) {
      return next();
    }

    // Capture request start time
    const startTime = Date.now();

    // Store original end function
    const originalEnd = res.end;

    // Override res.end to capture response
    res.end = function(chunk, encoding) {
      res.end = originalEnd;
      res.end(chunk, encoding);

      // Calculate response time
      const responseTime = Date.now() - startTime;

      // Build audit event
      const auditData = {
        method: req.method,
        path: req.path,
        statusCode: res.statusCode,
        responseTime,
        ip: req.ip || req.connection.remoteAddress,
        userAgent: req.get('user-agent'),
        userId: req.user?.id || req.user?._id,
        username: req.user?.username,
        success: res.statusCode < 400
      };

      // Add request body for write operations (excluding sensitive data)
      if (logBody && ['POST', 'PUT', 'PATCH'].includes(req.method)) {
        auditData.requestBody = sanitizeBody(req.body);
      }

      // Log based on status code
      if (res.statusCode >= 500) {
        auditLogger.logSystemEvent('api.error', {
          component: 'api',
          operation: `${req.method} ${req.path}`
        }, auditData);
      } else if (res.statusCode >= 400) {
        auditLogger.logAccessEvent('api.unauthorized', {
          userId: req.user?.id,
          username: req.user?.username
        }, auditData);
      } else {
        auditLogger.logAccessEvent('api.request', {
          userId: req.user?.id,
          username: req.user?.username
        }, auditData);
      }
    };

    next();
  };
}

/**
 * Audit specific actions
 */
function auditAction(action, getDetails) {
  return (req, res, next) => {
    // Store original json function
    const originalJson = res.json;

    res.json = function(data) {
      // Call original json
      originalJson.call(this, data);

      // Log audit event
      try {
        const details = typeof getDetails === 'function' ? getDetails(req, res, data) : {};
        
        auditLogger.logSystemEvent(action, {
          component: 'api',
          operation: action
        }, {
          userId: req.user?.id,
          username: req.user?.username,
          success: data.success !== false,
          ...details
        });
      } catch (error) {
        console.error('Audit logging error:', error);
      }
    };

    next();
  };
}

/**
 * Sanitize request body to remove sensitive data
 */
function sanitizeBody(body) {
  if (!body || typeof body !== 'object') {
    return body;
  }

  const sanitized = { ...body };
  const sensitiveFields = ['password', 'token', 'secret', 'apiKey', 'creditCard'];

  for (const field of sensitiveFields) {
    if (sanitized[field]) {
      sanitized[field] = '[REDACTED]';
    }
  }

  return sanitized;
}

module.exports = {
  auditMiddleware,
  auditAction,
  auditLogger
};
