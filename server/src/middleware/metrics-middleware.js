// Prometheus Metrics Middleware
// Collects application metrics for monitoring

const promClient = require('prom-client');

// Create a Registry
const register = new promClient.Registry();

// Add default metrics (CPU, memory, etc.)
promClient.collectDefaultMetrics({ register });

// Custom metrics

// HTTP Request metrics
const httpRequestDuration = new promClient.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'path', 'status'],
  buckets: [0.1, 0.5, 1, 2, 5, 10]
});

const httpRequestTotal = new promClient.Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'path', 'status']
});

// Session metrics
const activeSessions = new promClient.Gauge({
  name: 'active_sessions_total',
  help: 'Number of active user sessions'
});

const sessionTimeouts = new promClient.Counter({
  name: 'session_timeouts_total',
  help: 'Total number of session timeouts'
});

// Notification metrics
const notificationDelivery = new promClient.Counter({
  name: 'notification_delivery_total',
  help: 'Total number of notifications delivered',
  labelNames: ['severity', 'channel', 'status']
});

const notificationDeliveryFailures = new promClient.Counter({
  name: 'notification_delivery_failures_total',
  help: 'Total number of notification delivery failures',
  labelNames: ['severity', 'channel']
});

// Signature metrics
const signatureOperations = new promClient.Counter({
  name: 'signature_operations_total',
  help: 'Total number of signature operations',
  labelNames: ['operation']
});

const signatureVerificationFailures = new promClient.Counter({
  name: 'signature_verification_failures_total',
  help: 'Total number of signature verification failures'
});

// Export metrics
const exportQueueLength = new promClient.Gauge({
  name: 'export_queue_length',
  help: 'Number of exports in queue',
  labelNames: ['format']
});

const exportProcessingDuration = new promClient.Histogram({
  name: 'export_processing_duration_seconds',
  help: 'Duration of export processing in seconds',
  labelNames: ['format'],
  buckets: [1, 5, 10, 30, 60, 120]
});

// Authentication metrics
const authenticationFailures = new promClient.Counter({
  name: 'authentication_failures_total',
  help: 'Total number of authentication failures',
  labelNames: ['reason']
});

const suspiciousIPBlocks = new promClient.Counter({
  name: 'suspicious_ip_blocks_total',
  help: 'Total number of IPs blocked for suspicious activity'
});

// Audit log metrics
const auditLogWrites = new promClient.Counter({
  name: 'audit_log_writes_total',
  help: 'Total number of audit log writes',
  labelNames: ['action']
});

const auditLogWriteFailures = new promClient.Counter({
  name: 'audit_log_write_failures_total',
  help: 'Total number of audit log write failures'
});

// Register all metrics
register.registerMetric(httpRequestDuration);
register.registerMetric(httpRequestTotal);
register.registerMetric(activeSessions);
register.registerMetric(sessionTimeouts);
register.registerMetric(notificationDelivery);
register.registerMetric(notificationDeliveryFailures);
register.registerMetric(signatureOperations);
register.registerMetric(signatureVerificationFailures);
register.registerMetric(exportQueueLength);
register.registerMetric(exportProcessingDuration);
register.registerMetric(authenticationFailures);
register.registerMetric(suspiciousIPBlocks);
register.registerMetric(auditLogWrites);
register.registerMetric(auditLogWriteFailures);

// Middleware to track HTTP requests
const metricsMiddleware = (req, res, next) => {
  const start = Date.now();
  
  // Track response
  res.on('finish', () => {
    const duration = (Date.now() - start) / 1000;
    const path = req.route ? req.route.path : req.path;
    
    httpRequestDuration.observe(
      { method: req.method, path, status: res.statusCode },
      duration
    );
    
    httpRequestTotal.inc({
      method: req.method,
      path,
      status: res.statusCode
    });
  });
  
  next();
};

// Metrics endpoint
const metricsEndpoint = async (req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
};

// Export metrics and middleware
module.exports = {
  metricsMiddleware,
  metricsEndpoint,
  metrics: {
    httpRequestDuration,
    httpRequestTotal,
    activeSessions,
    sessionTimeouts,
    notificationDelivery,
    notificationDeliveryFailures,
    signatureOperations,
    signatureVerificationFailures,
    exportQueueLength,
    exportProcessingDuration,
    authenticationFailures,
    suspiciousIPBlocks,
    auditLogWrites,
    auditLogWriteFailures
  }
};
