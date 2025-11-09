require('dotenv').config();
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const cron = require('node-cron');
const { connectMongo } = require('./config/mongo');
const routes = require('./routes');
const cookieParser = require('cookie-parser');
const { getSecretManager, getApplicationSecrets } = require('./services/secret-manager');
const { auditMiddleware } = require('./middleware/auditMiddleware');
const { ensureLogsDirectory } = require('./utils/ensure-logs-dir');
const AnonymizationService = require('./services/anonymization-service');
const anonymizationConfig = require('./config/anonymization');
const { getMetricsCollector } = require('./services/metrics-collector');
const { getHealthChecker } = require('./services/health-checker');
const { getAlertManager } = require('./services/alert-manager');
const AdminActionLogger = require('./services/admin-action-logger');
const followUpAutomation = require('./services/followup-automation');

const app = express();

// CORS configuration - Allow credentials and specific origins
app.use(cors({
  origin: function(origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    // List of allowed origins
    const allowedOrigins = [
      'http://localhost:3010',
      'http://localhost:5173',
      'http://localhost:3000',
      'http://127.0.0.1:3010',
      'http://127.0.0.1:5173',
      'http://127.0.0.1:3000'
    ];
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      console.warn(`⚠️  CORS: Origin ${origin} not allowed`);
      callback(null, true); // Allow anyway for development
    }
  },
  credentials: true, // Allow cookies and authorization headers
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: [
    'Content-Type', 
    'Authorization', 
    'X-Requested-With',
    'x-correlation-id',  // Add correlation ID header
    'X-Correlation-Id',   // Case variation
    'X-XSRF-TOKEN',      // CSRF token header
    'x-xsrf-token'       // Case variation
  ],
  exposedHeaders: ['Content-Range', 'X-Content-Range']
}));

app.use(express.json({ limit: '20mb' }));
app.use(morgan('dev'));
app.use(cookieParser());

// Security middleware - must be early in the middleware chain
const { inputValidationMiddleware } = require('./middleware/input-validation-middleware');
const { xssProtectionMiddleware, setSecurityHeaders } = require('./middleware/xss-protection-middleware');
const { doubleSubmitCookieCSRF, configureSameSiteCookies } = require('./middleware/csrf-protection-middleware');

// Set security headers
app.use(setSecurityHeaders);

// Configure SameSite cookies
configureSameSiteCookies(app);

// Input validation (NoSQL injection prevention)
app.use(inputValidationMiddleware);

// XSS protection
app.use(xssProtectionMiddleware({
  htmlFields: ['findings', 'impression', 'clinicalHistory', 'technique', 'comparison', 'content', 'description', 'notes', 'comments'],
  excludePaths: ['/health', '/metrics']
}));

// CSRF protection (using double submit cookie pattern)
app.use(doubleSubmitCookieCSRF({
  excludePaths: [
    '/health', 
    '/metrics', 
    '/auth/login', 
    '/auth/register', 
    '/auth/refresh-token', 
    '/api/orthanc-webhook',
    '/api/reports', // Exclude reporting API from CSRF (uses JWT auth)
    '/api/users',   // Exclude user management API from CSRF (uses JWT auth + RBAC)
    '/api/follow-ups', // Exclude follow-up API from CSRF (uses JWT auth)
    '/api/prior-auth', // Exclude prior auth API from CSRF (uses JWT auth)
    '/api/dicom',   // Exclude DICOM API from CSRF (uses JWT auth)
    '/api/patients', // Exclude patients API from CSRF (uses JWT auth)
    '/api/export',  // Exclude export API from CSRF (uses JWT auth)
    '/api/medical-ai', // Exclude AI API from CSRF (uses JWT auth)
    '/api/ai'       // Exclude AI API from CSRF (uses JWT auth)
  ],
  excludeMethods: ['GET', 'HEAD', 'OPTIONS']
}));

// Serve uploaded files (signatures, etc.)
const uploadsPath = require('path').join(__dirname, '../uploads');
app.use('/uploads', express.static(uploadsPath));
console.log('📁 Serving uploads from:', uploadsPath);

// Audit middleware - must be after security middleware
app.use(auditMiddleware({
  excludePaths: ['/health', '/metrics', '/api/reports/health'],
  logBody: true
}));                              

// 404 handler with detailed logging
// app.use((req, res, next) => {
//   if (!res.headersSent) {
//     console.warn(`[404] ${req.method} ${req.url}`);
//     res.status(404).json({ 
//       error: 'Not Found', 
//       path: req.url,
//       method: req.method,
//       message: `Route ${req.method} ${req.url} does not exist`
//     });
//   } else {
//     next();
//   }
// });

// Admin action logging middleware (will be initialized after services are set up)
app.use((req, res, next) => {
  if (req.app.locals.adminActionLogger) {
    req.app.locals.adminActionLogger.adminActionMiddleware()(req, res, next);
  } else {
    next();
  }
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  // Stop health checker if it exists
  if (global.healthChecker) {
    global.healthChecker.stop();
  }
  // Stop alert manager if it exists
  if (global.alertManager) {
    global.alertManager.stop();
  }
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  // Stop health checker if it exists
  if (global.healthChecker) {
    global.healthChecker.stop();
  }
  // Stop alert manager if it exists
  if (global.alertManager) {
    global.alertManager.stop();
  }
  process.exit(0);
});

// Initialize services and start server
async function startServer() {
  try {
    // Ensure logs directory exists
    ensureLogsDirectory();

    // Initialize secret manager and load secrets (with timeout)
    console.log('Initializing secret management...');
    let secretsAvailable = false;

    try {
      const secretManager = getSecretManager();

      // Test secret manager connectivity with timeout
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Secret manager connection timeout')), 5000)
      );

      secretsAvailable = await Promise.race([
        secretManager.testConnection(),
        timeoutPromise
      ]);

      if (secretsAvailable) {
        // Load application secrets and update environment
        try {
          const secrets = await getApplicationSecrets();

          // Update environment variables with secrets (use fallback values if secrets not available)
          process.env.MONGODB_URI = secrets.database.uri || process.env.MONGODB_URI;

          console.log('Application secrets loaded successfully');
        } catch (secretError) {
          console.warn('Failed to load secrets, using environment variables', {
            error: secretError.message
          });
          secretsAvailable = false;
        }
      }
    } catch (error) {
      console.warn('Secret manager not available, falling back to environment variables', {
        error: error.message
      });
      secretsAvailable = false;
    }

    // Config
    const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/dicomdb';
    try {
      await connectMongo(mongoUri);
    } catch (err) {
      console.error('MongoDB connect error:', err);
      console.warn('⚠️  Server will continue without MongoDB');
      console.warn('   Some features may not work properly');
    }

    // Cloudinary removed - using filesystem + Orthanc storage
    console.log('Database configured');

    // Create default admin user if it doesn't exist
    try {
      const { seedAdmin } = require('./seed/seedAdmin');
      await seedAdmin();
      console.log('✅ Admin user initialization complete');
    } catch (error) {
      console.warn('⚠️  Admin user seeding failed:', error.message);
      console.warn('   You may need to create an admin user manually');
    }

    // Check Orthanc PACS connection if PACS integration is enabled
    if (process.env.ENABLE_PACS_INTEGRATION !== 'false') {
      console.log('Checking Orthanc PACS connection...');
      try {
        const { getPacsUploadService } = require('./services/pacs-upload-service');
        const pacsService = getPacsUploadService();
        const isConnected = await pacsService.testConnection();

        if (isConnected) {
          console.log('✅ Orthanc PACS connection successful');
        } else {
          console.warn('⚠️  Orthanc PACS connection failed - uploads will not work');
          console.warn('   Please ensure Orthanc is running on:', process.env.ORTHANC_URL || 'http://69.62.70.102:8042');
        }
      } catch (error) {
        console.warn('⚠️  Could not initialize PACS upload service:', error.message);
        console.warn('   PACS uploads will be disabled');
      }
    }

    // Initialize anonymization service
    console.log('Initializing anonymization service...');
    const anonymizationService = new AnonymizationService(anonymizationConfig);
    await anonymizationService.initialize();

    // Make anonymization service available globally
    app.locals.anonymizationService = anonymizationService;
    console.log('Anonymization service initialized');

    // Initialize metrics collector
    console.log('Initializing metrics collector...');
    const metricsCollector = getMetricsCollector();

    // Make metrics collector available globally
    app.locals.metricsCollector = metricsCollector;
    console.log('Metrics collector initialized');

    // Initialize health checker (skip if in development mode without external services)
    if (process.env.NODE_ENV === 'production' || process.env.ENABLE_HEALTH_CHECKS === 'true') {
      console.log('Initializing health checker...');
      const healthChecker = getHealthChecker({
        orthancUrl: process.env.ORTHANC_URL,
        orthancUsername: process.env.ORTHANC_USERNAME,
        orthancPassword: process.env.ORTHANC_PASSWORD,
        webhookUrl: `http://localhost:${process.env.PORT || 8001}`
      });

      // Start health checks
      healthChecker.start();

      // Make health checker available globally
      app.locals.healthChecker = healthChecker;
      global.healthChecker = healthChecker; // For graceful shutdown
      console.log('Health checker initialized and started');
    } else {
      console.log('Health checker skipped (development mode)');
    }

    // Initialize alert manager (skip if in development mode)
    if (process.env.NODE_ENV === 'production' || process.env.ENABLE_ALERTS === 'true') {
      console.log('Initializing alert manager...');
      const alertManager = getAlertManager({
        notifications: {
          slackWebhookUrl: process.env.SLACK_WEBHOOK_URL,
          pagerDutyIntegrationKey: process.env.PAGERDUTY_INTEGRATION_KEY,
          enabled: process.env.ALERTS_ENABLED !== 'false'
        }
      });

      // Start alert manager
      alertManager.start();

      // Make alert manager available globally
      app.locals.alertManager = alertManager;
      global.alertManager = alertManager; // For graceful shutdown
      console.log('Alert manager initialized and started');
    } else {
      console.log('Alert manager skipped (development mode)');
    }

    // Initialize admin action logger
    console.log('Initializing admin action logger...');
    const adminActionLogger = new AdminActionLogger({
      logDir: process.env.ADMIN_LOG_DIR || './logs',
      enableSIEM: process.env.SIEM_ENABLED === 'true',
      siemEndpoint: process.env.SIEM_ENDPOINT
    });

    // Make admin action logger available globally
    app.locals.adminActionLogger = adminActionLogger;
    console.log('Admin action logger initialized');

    // Initialize follow-up automation cron jobs
    if (process.env.ENABLE_FOLLOWUP_AUTOMATION !== 'false') {
      console.log('Initializing follow-up automation...');
      
      // Check overdue follow-ups daily at 8 AM
      cron.schedule('0 8 * * *', async () => {
        console.log('Running overdue follow-ups check...');
        try {
          const overdueFollowUps = await followUpAutomation.checkOverdueFollowUps();
          console.log(`Found ${overdueFollowUps.length} overdue follow-ups`);
        } catch (error) {
          console.error('Error checking overdue follow-ups:', error);
        }
      });

      // Send upcoming reminders daily at 9 AM
      cron.schedule('0 9 * * *', async () => {
        console.log('Sending upcoming follow-up reminders...');
        try {
          const upcomingFollowUps = await followUpAutomation.sendUpcomingReminders(7);
          console.log(`Sent reminders for ${upcomingFollowUps.length} upcoming follow-ups`);
        } catch (error) {
          console.error('Error sending reminders:', error);
        }
      });

      console.log('Follow-up automation cron jobs scheduled');
      console.log('- Overdue check: Daily at 8:00 AM');
      console.log('- Upcoming reminders: Daily at 9:00 AM');
    } else {
      console.log('Follow-up automation disabled');
    }

    // Routes
    app.use('/', routes);

    const port = process.env.PORT || 8001;
    const httpServer = app.listen(port, () => {
      console.log(`Node DICOM API running on http://0.0.0.0:${port}`, {
        environment: process.env.NODE_ENV,
        mongoUri: mongoUri.replace(/\/\/[^:]+:[^@]+@/, '//***:***@'), // Hide credentials in logs
        secretsEnabled: secretsAvailable
      });
      
      // Log mounted routes for diagnostics
      console.log('\n📍 MOUNTED ROUTES:');
      console.log('  ✅ /api/reports          → Unified Reporting System');
      console.log('  ✅ /api/reports/health   → Health check endpoint');
      console.log('  ✅ /api/reports/templates → Template management');
      console.log('  ✅ /api/reports/:id/export → Export functionality');
      console.log(`\n🌐 Base URL: http://localhost:${port}`);
      console.log(`   Test health: curl http://localhost:${port}/api/reports/health\n`);
    });

    // Initialize WebSocket service
    console.log('Initializing WebSocket service...');
    const { getWebSocketService } = require('./services/websocket-service');
    const websocketService = getWebSocketService();
    websocketService.initialize(httpServer, {
      corsOrigins: [
        'http://localhost:3010',
        'http://localhost:5173',
        'http://localhost:3000',
        'http://127.0.0.1:3010',
        'http://127.0.0.1:5173',
        'http://127.0.0.1:3000'
      ]
    });

    // Make WebSocket service available globally
    app.locals.websocketService = websocketService;
    console.log('WebSocket service initialized and ready');
    

  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Export app for testing
module.exports = app;

// Only start server if not in test mode
if (process.env.NODE_ENV !== 'test') {
  startServer();
}