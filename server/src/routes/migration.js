const express = require('express');
const { getDICOMMigrationService } = require('../services/dicom-migration-service');
const { getMigrationValidationService } = require('../services/migration-validation-service');
const { authenticate: requireAuth } = require('../middleware/authMiddleware');
const Instance = require('../models/Instance');

const router = express.Router();

/**
 * Get migration statistics
 * GET /api/migration/stats
 */
router.get('/stats', requireAuth, async (req, res) => {
  try {
    const migrationService = getDICOMMigrationService();
    const stats = migrationService.getMigrationStats();
    
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * Update migration configuration
 * POST /api/migration/config
 */
router.post('/config', requireAuth, async (req, res) => {
  try {
    const migrationService = getDICOMMigrationService();
    const { enableOrthancPreview, migrationPercentage, enablePerformanceComparison } = req.body;
    
    const newConfig = {};
    if (enableOrthancPreview !== undefined) newConfig.enableOrthancPreview = enableOrthancPreview;
    if (migrationPercentage !== undefined) newConfig.migrationPercentage = migrationPercentage;
    if (enablePerformanceComparison !== undefined) newConfig.enablePerformanceComparison = enablePerformanceComparison;
    
    migrationService.updateConfig(newConfig);
    
    res.json({
      success: true,
      data: migrationService.getMigrationStats()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * Compare performance between Orthanc and Node decoding
 * POST /api/migration/performance-test
 */
router.post('/performance-test', requireAuth, async (req, res) => {
  try {
    const migrationService = getDICOMMigrationService();
    const { studyUid, frameIndex } = req.body;
    
    if (!studyUid || frameIndex === undefined) {
      return res.status(400).json({
        success: false,
        message: 'studyUid and frameIndex are required'
      });
    }
    
    const results = await migrationService.comparePerformance(studyUid, parseInt(frameIndex));
    
    res.json({
      success: true,
      data: results
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * Test Orthanc connectivity
 * GET /api/migration/orthanc-test
 */
router.get('/orthanc-test', requireAuth, async (req, res) => {
  try {
    const migrationService = getDICOMMigrationService();
    const isConnected = await migrationService.orthancClient.testConnection();
    
    res.json({
      success: true,
      data: {
        orthancConnected: isConnected,
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
 * Run comprehensive migration validation
 * POST /api/migration/validate
 */
router.post('/validate', requireAuth, async (req, res) => {
  try {
    const validationService = getMigrationValidationService();
    const { enablePerformanceTest, studyInstanceUID } = req.body;
    
    // Get test instances
    let testInstances = [];
    if (studyInstanceUID) {
      testInstances = await Instance.find({ studyInstanceUID }).lean();
    } else {
      // Get a sample of instances for testing
      testInstances = await Instance.find({}).limit(10).lean();
    }
    
    const validationResults = await validationService.runValidation({
      enablePerformanceTest: enablePerformanceTest || false,
      testInstances
    });
    
    res.json({
      success: true,
      data: validationResults
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * Get validation report
 * GET /api/migration/validate/:validationId
 */
router.get('/validate/:validationId', requireAuth, async (req, res) => {
  try {
    const validationService = getMigrationValidationService();
    const { validationId } = req.params;
    
    const report = validationService.getValidationReport(validationId);
    
    res.json({
      success: true,
      data: report
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * Test specific compression syntax
 * POST /api/migration/test-compression
 */
router.post('/test-compression', requireAuth, async (req, res) => {
  try {
    const validationService = getMigrationValidationService();
    const { transferSyntax, instanceId } = req.body;
    
    if (!transferSyntax) {
      return res.status(400).json({
        success: false,
        message: 'transferSyntax is required'
      });
    }
    
    // Find test instance
    let testInstance = null;
    if (instanceId) {
      testInstance = await Instance.findById(instanceId).lean();
    } else {
      testInstance = await Instance.findOne({}).lean();
    }
    
    if (!testInstance) {
      return res.status(404).json({
        success: false,
        message: 'No test instance available'
      });
    }
    
    const result = await validationService.testCompressionSyntax(transferSyntax, [testInstance]);
    
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

module.exports = router;