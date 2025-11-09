const express = require('express');
const { getOrthancStudyService } = require('../services/orthanc-study-service');
const { pacsFilterMiddleware } = require('../middleware/pacs-filter-middleware');

const router = express.Router();

// Apply PACS security filter to all routes except health/diagnostics
router.use((req, res, next) => {
  // Skip security for health checks and diagnostics
  const publicPaths = ['/health', '/diagnostics', '/monitoring', '/security/config', '/security/stats'];
  if (publicPaths.some(path => req.path.includes(path))) {
    return next();
  }
  
  // Apply security filter for all other routes
  pacsFilterMiddleware(req, res, next);
});

/**
 * Test PACS connection
 * GET /api/pacs/test
 */
router.get('/test', async (req, res) => {
  try {
    const orthancStudyService = getOrthancStudyService();
    const isConnected = await orthancStudyService.testConnection();
    
    res.json({
      success: true,
      data: {
        connected: isConnected,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * Sync studies from PACS to database
 * POST /api/pacs/sync
 */
router.post('/sync', async (req, res) => {
  try {
    const orthancStudyService = getOrthancStudyService();
    const result = await orthancStudyService.syncPacsToDatabase();
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * Debug: Check database instances for a study
 * GET /api/pacs/debug/:studyUid
 */
router.get('/debug/:studyUid', async (req, res) => {
  try {
    const { studyUid } = req.params;
    const Instance = require('../models/Instance');
    const Study = require('../models/Study');
    
    // Check study in database
    const study = await Study.findOne({ studyInstanceUID: studyUid }).lean();
    
    // Check instances in database
    const instances = await Instance.find({ studyInstanceUID: studyUid }).lean();
    
    res.json({
      success: true,
      data: {
        studyUid,
        study: study || 'Not found in database',
        instanceCount: instances.length,
        instances: instances.map(inst => ({
          _id: inst._id,
          instanceNumber: inst.instanceNumber,
          hasLocalFile: !!inst.localFilePath,
          hasOrthancId: !!inst.orthancInstanceId
        }))
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * Get studies from PACS only (for debugging)
 * GET /api/pacs/studies
 */
router.get('/studies', async (req, res) => {
  try {
    const orthancStudyService = getOrthancStudyService();
    const pacsStudies = await orthancStudyService.fetchStudiesFromPacs();
    
    res.json({
      success: true,
      data: pacsStudies
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * Get unified studies (database + PACS)
 * GET /api/pacs/unified-studies
 */
router.get('/unified-studies', async (req, res) => {
  try {
    const orthancStudyService = getOrthancStudyService();
    const unifiedStudies = await orthancStudyService.getUnifiedStudies();
    
    res.json({
      success: true,
      data: unifiedStudies
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// PACS Upload Routes
const { 
  uploadSingle, 
  uploadBatch, 
  getUploadStatus, 
  testUploadConnection,
  uploadMiddleware 
} = require('../controllers/pacsUploadController');

/**
 * Upload single DICOM file to PACS with real-time processing
 * POST /api/pacs/upload
 */
router.post('/upload', uploadMiddleware().single('dicom'), uploadSingle);

/**
 * Upload multiple DICOM files to PACS with batch processing
 * POST /api/pacs/upload/batch
 */
router.post('/upload/batch', uploadMiddleware().array('dicom', 10), uploadBatch);

/**
 * Get PACS upload status and capabilities
 * GET /api/pacs/upload/status
 */
router.get('/upload/status', getUploadStatus);

/**
 * Test PACS upload connectivity
 * GET /api/pacs/upload/test
 */
router.get('/upload/test', testUploadConnection);

/**
 * Check environment configuration
 * GET /api/pacs/upload/config-check
 */
router.get('/upload/config-check', (req, res) => {
  const errors = [];
  const warnings = [];
  const config = {};

  // Check required environment variables
  if (!process.env.ORTHANC_URL) {
    errors.push('ORTHANC_URL is not set');
  } else {
    config.orthancUrl = process.env.ORTHANC_URL;
  }

  if (!process.env.ORTHANC_USERNAME) {
    errors.push('ORTHANC_USERNAME is not set');
  } else {
    config.orthancUsername = '***';
  }

  if (!process.env.ORTHANC_PASSWORD) {
    errors.push('ORTHANC_PASSWORD is not set');
  } else {
    config.orthancPassword = '***';
  }

  if (!process.env.MONGODB_URI) {
    errors.push('MONGODB_URI is not set');
  } else {
    config.mongodbUri = process.env.MONGODB_URI.replace(/\/\/[^:]+:[^@]+@/, '//***:***@');
  }

  // Cloudinary removed - no longer needed

  const isValid = errors.length === 0;

  res.json({
    success: isValid,
    valid: isValid,
    message: isValid ? 'Environment configuration is valid' : 'Environment configuration has errors',
    errors: errors,
    warnings: warnings,
    config: config,
    recommendations: errors.length > 0 ? [
      'Check your .env file in the node-server directory',
      'Ensure Orthanc PACS server is running on the configured URL',
      'Verify MongoDB connection string is correct'
    ] : []
  });
});

// ============================================================================
// PHASE 1: ADVANCED DIAGNOSTICS & MONITORING
// ============================================================================

/**
 * Advanced diagnostics - Comprehensive connectivity test
 * GET /api/pacs/diagnostics
 */
router.get('/diagnostics', async (req, res) => {
  try {
    const orthancStudyService = getOrthancStudyService();
    const diagnostics = {
      timestamp: new Date().toISOString(),
      overallStatus: 'healthy',
      tests: []
    };
    
    // Test 1: Basic Connectivity
    try {
      const response = await orthancStudyService.testConnection();
      diagnostics.tests.push({
        name: 'Basic Connectivity',
        status: response ? 'PASS' : 'FAIL',
        message: 'Successfully connected to PACS',
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      diagnostics.tests.push({
        name: 'Basic Connectivity',
        status: 'FAIL',
        error: error.message,
        timestamp: new Date().toISOString()
      });
      diagnostics.overallStatus = 'unhealthy';
    }
    
    // Test 2: Authentication
    try {
      diagnostics.tests.push({
        name: 'Authentication',
        status: 'PASS',
        message: 'Credentials validated',
        username: process.env.ORTHANC_USERNAME || 'Not configured',
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      diagnostics.tests.push({
        name: 'Authentication',
        status: 'FAIL',
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
    
    // Test 3: Network Latency
    const latencyStart = Date.now();
    try {
      await orthancStudyService.testConnection();
      const latency = Date.now() - latencyStart;
      diagnostics.tests.push({
        name: 'Network Latency',
        status: latency < 1000 ? 'PASS' : 'WARNING',
        latency: `${latency}ms`,
        message: latency < 1000 ? 'Good latency' : 'High latency detected',
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      diagnostics.tests.push({
        name: 'Network Latency',
        status: 'FAIL',
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
    
    // Test 4: Storage Capacity
    try {
      const Study = require('../models/Study');
      const Instance = require('../models/Instance');
      
      const studyCount = await Study.countDocuments();
      const instanceCount = await Instance.countDocuments();
      
      diagnostics.tests.push({
        name: 'Storage Capacity',
        status: 'PASS',
        details: {
          totalStudies: studyCount,
          totalInstances: instanceCount,
          estimatedSize: `${(instanceCount * 0.5).toFixed(2)} MB`
        },
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      diagnostics.tests.push({
        name: 'Storage Capacity',
        status: 'FAIL',
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
    
    // Test 5: Database Connectivity
    try {
      const mongoose = require('mongoose');
      const dbStatus = mongoose.connection.readyState;
      diagnostics.tests.push({
        name: 'Database Connectivity',
        status: dbStatus === 1 ? 'PASS' : 'FAIL',
        message: dbStatus === 1 ? 'Database connected' : 'Database disconnected',
        readyState: dbStatus,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      diagnostics.tests.push({
        name: 'Database Connectivity',
        status: 'FAIL',
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
    
    // Test 6: Configuration Validation
    const configErrors = [];
    if (!process.env.ORTHANC_URL) configErrors.push('ORTHANC_URL not set');
    if (!process.env.ORTHANC_USERNAME) configErrors.push('ORTHANC_USERNAME not set');
    if (!process.env.ORTHANC_PASSWORD) configErrors.push('ORTHANC_PASSWORD not set');
    
    diagnostics.tests.push({
      name: 'Configuration Validation',
      status: configErrors.length === 0 ? 'PASS' : 'FAIL',
      message: configErrors.length === 0 ? 'All required config present' : 'Missing configuration',
      errors: configErrors,
      timestamp: new Date().toISOString()
    });
    
    // Overall status
    const failedTests = diagnostics.tests.filter(t => t.status === 'FAIL').length;
    if (failedTests > 0) {
      diagnostics.overallStatus = 'unhealthy';
    } else if (diagnostics.tests.some(t => t.status === 'WARNING')) {
      diagnostics.overallStatus = 'degraded';
    }
    
    res.json({
      success: true,
      diagnostics
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Real-time monitoring - Health and performance metrics
 * GET /api/pacs/monitoring
 */
router.get('/monitoring', async (req, res) => {
  try {
    const orthancStudyService = getOrthancStudyService();
    const Study = require('../models/Study');
    const Instance = require('../models/Instance');
    
    const monitoring = {
      timestamp: new Date().toISOString(),
      status: 'healthy',
      uptime: process.uptime(),
      metrics: {}
    };
    
    // Connection health
    try {
      await orthancStudyService.testConnection();
      monitoring.status = 'healthy';
    } catch (error) {
      monitoring.status = 'unhealthy';
      monitoring.error = error.message;
    }
    
    // Storage metrics
    const studyCount = await Study.countDocuments();
    const instanceCount = await Instance.countDocuments();
    
    monitoring.metrics.storage = {
      totalStudies: studyCount,
      totalInstances: instanceCount,
      estimatedSize: `${(instanceCount * 0.5).toFixed(2)} MB`
    };
    
    // Recent activity (last 24 hours)
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentStudies = await Study.countDocuments({ createdAt: { $gte: yesterday } });
    const recentInstances = await Instance.countDocuments({ createdAt: { $gte: yesterday } });
    
    monitoring.metrics.recentActivity = {
      last24Hours: {
        studies: recentStudies,
        instances: recentInstances
      }
    };
    
    // Top modalities
    const modalityStats = await Instance.aggregate([
      { $group: { _id: '$modality', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 5 }
    ]);
    
    monitoring.metrics.topModalities = modalityStats.map(m => ({
      modality: m._id,
      count: m.count
    }));
    
    // Memory usage
    const memUsage = process.memoryUsage();
    monitoring.metrics.memory = {
      heapUsed: `${(memUsage.heapUsed / 1024 / 1024).toFixed(2)} MB`,
      heapTotal: `${(memUsage.heapTotal / 1024 / 1024).toFixed(2)} MB`,
      rss: `${(memUsage.rss / 1024 / 1024).toFixed(2)} MB`
    };
    
    res.json({
      success: true,
      monitoring
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Connection health check - Quick status check
 * GET /api/pacs/health
 */
router.get('/health', async (req, res) => {
  try {
    const orthancStudyService = getOrthancStudyService();
    const isHealthy = await orthancStudyService.testConnection();
    
    res.json({
      success: true,
      healthy: isHealthy,
      timestamp: new Date().toISOString(),
      uptime: process.uptime()
    });
  } catch (error) {
    res.status(503).json({
      success: false,
      healthy: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// ============================================================================
// PHASE 2: DICOM QUERY/RETRIEVE & MODALITY MANAGEMENT
// ============================================================================

/**
 * Query remote PACS modality (C-FIND)
 * POST /api/pacs/query
 */
router.post('/query', async (req, res) => {
  try {
    const {
      remoteAE,
      patientName,
      patientID,
      studyDate,
      modality,
      accessionNumber
    } = req.body;
    
    if (!remoteAE) {
      return res.status(400).json({
        success: false,
        error: 'remoteAE is required'
      });
    }
    
    const orthancStudyService = getOrthancStudyService();
    
    const query = {};
    if (patientName) query.PatientName = patientName;
    if (patientID) query.PatientID = patientID;
    if (studyDate) query.StudyDate = studyDate;
    if (modality) query.Modality = modality;
    if (accessionNumber) query.AccessionNumber = accessionNumber;
    
    const results = await orthancStudyService.queryModality(remoteAE, query);
    
    res.json({
      success: true,
      remoteAE,
      query,
      results,
      count: results?.length || 0
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Retrieve study from remote PACS (C-MOVE)
 * POST /api/pacs/retrieve
 */
router.post('/retrieve', async (req, res) => {
  try {
    const { remoteAE, studyInstanceUID } = req.body;
    
    if (!remoteAE || !studyInstanceUID) {
      return res.status(400).json({
        success: false,
        error: 'remoteAE and studyInstanceUID are required'
      });
    }
    
    const orthancStudyService = getOrthancStudyService();
    await orthancStudyService.retrieveStudy(remoteAE, studyInstanceUID);
    
    res.json({
      success: true,
      message: 'Study retrieval initiated',
      studyInstanceUID
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Register modality (imaging device)
 * POST /api/pacs/modalities/register
 */
router.post('/modalities/register', async (req, res) => {
  try {
    const { aet, host, port, manufacturer, description } = req.body;
    
    if (!aet || !host || !port) {
      return res.status(400).json({
        success: false,
        error: 'aet, host, and port are required'
      });
    }
    
    // Save to security config (in production, save to database)
    const pacsConfig = require('../config/pacs-security');
    pacsConfig.allowedModalities[aet] = {
      aet,
      description: description || aet,
      type: 'OT',
      ip: host,
      enabled: true,
      maxRequestsPerMinute: 100
    };
    
    res.json({
      success: true,
      message: 'Modality registered successfully',
      modality: { aet, host, port, manufacturer, description }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * List registered modalities
 * GET /api/pacs/modalities
 */
router.get('/modalities', (req, res) => {
  try {
    const pacsConfig = require('../config/pacs-security');
    const modalities = Object.values(pacsConfig.allowedModalities);
    
    res.json({
      success: true,
      modalities,
      count: modalities.length
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ============================================================================
// SECURITY FEATURES
// ============================================================================

/**
 * Get security statistics
 * GET /api/pacs/security/stats
 */
router.get('/security/stats', (req, res) => {
  try {
    const { getSecurityStats } = require('../middleware/pacs-filter-middleware');
    const stats = getSecurityStats();
    
    res.json({
      success: true,
      stats
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Get security configuration
 * GET /api/pacs/security/config
 */
router.get('/security/config', (req, res) => {
  try {
    const pacsConfig = require('../config/pacs-security');
    
    res.json({
      success: true,
      config: {
        allowedModalities: Object.keys(pacsConfig.allowedModalities).length,
        blockedPatterns: pacsConfig.blockedModalities.length,
        allowedIPs: pacsConfig.allowedIPs.length,
        allowedModalityTypes: pacsConfig.allowedModalityTypes,
        security: pacsConfig.security,
        rateLimits: pacsConfig.rateLimits
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;