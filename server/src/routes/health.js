const express = require('express');
const { getHealthChecker } = require('../services/health-checker');

const router = express.Router();

/**
 * GET /health - Overall health status
 * Returns the current health status of all system components
 */
router.get('/', async (req, res) => {
  try {
    const healthChecker = getHealthChecker();
    const healthStatus = healthChecker.getHealthStatus();
    
    // Set appropriate HTTP status based on health
    let httpStatus = 200;
    if (healthStatus.overall === 'warning') {
      httpStatus = 200; // Still OK, but with warnings
    } else if (healthStatus.overall === 'critical') {
      httpStatus = 503; // Service Unavailable
    } else if (healthStatus.overall === 'unknown') {
      httpStatus = 503; // Service Unavailable
    }
    
    res.status(httpStatus).json(healthStatus);
  } catch (error) {
    console.error('Error getting health status:', error);
    res.status(500).json({
      overall: 'critical',
      message: 'Health check system error',
      error: error.message
    });
  }
});

/**
 * GET /health/live - Liveness probe
 * Simple endpoint to check if the service is alive
 */
router.get('/live', (req, res) => {
  res.status(200).json({
    status: 'alive',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

/**
 * GET /health/ready - Readiness probe
 * Checks if the service is ready to handle requests
 */
router.get('/ready', async (req, res) => {
  try {
    const healthChecker = getHealthChecker();
    const healthStatus = healthChecker.getHealthStatus();
    
    // Service is ready if overall status is healthy or warning
    const isReady = healthStatus.overall === 'healthy' || healthStatus.overall === 'warning';
    
    if (isReady) {
      res.status(200).json({
        status: 'ready',
        overall: healthStatus.overall,
        timestamp: new Date().toISOString()
      });
    } else {
      res.status(503).json({
        status: 'not_ready',
        overall: healthStatus.overall,
        timestamp: new Date().toISOString(),
        checks: healthStatus.checks
      });
    }
  } catch (error) {
    console.error('Error checking readiness:', error);
    res.status(503).json({
      status: 'not_ready',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /health/check/:checkName - Individual health check
 * Run or get status of a specific health check
 */
router.get('/check/:checkName', async (req, res) => {
  try {
    const { checkName } = req.params;
    const { run } = req.query;
    
    const healthChecker = getHealthChecker();
    
    let checkResult;
    if (run === 'true') {
      // Run the check on demand
      checkResult = await healthChecker.runSingleCheck(checkName);
    } else {
      // Get cached result
      checkResult = healthChecker.getCheckStatus(checkName);
      if (!checkResult) {
        return res.status(404).json({
          error: `Health check '${checkName}' not found or not yet run`
        });
      }
    }
    
    const httpStatus = checkResult.status === 'healthy' ? 200 : 
                      checkResult.status === 'warning' ? 200 : 503;
    
    res.status(httpStatus).json({
      check: checkName,
      ...checkResult,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error(`Error running health check ${req.params.checkName}:`, error);
    res.status(500).json({
      check: req.params.checkName,
      status: 'unhealthy',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * POST /health/run - Run all health checks on demand
 * Triggers a fresh run of all health checks
 */
router.post('/run', async (req, res) => {
  try {
    const healthChecker = getHealthChecker();
    await healthChecker.runAllChecks();
    
    const healthStatus = healthChecker.getHealthStatus();
    
    const httpStatus = healthStatus.overall === 'healthy' ? 200 :
                      healthStatus.overall === 'warning' ? 200 : 503;
    
    res.status(httpStatus).json({
      message: 'Health checks completed',
      ...healthStatus
    });
    
  } catch (error) {
    console.error('Error running health checks:', error);
    res.status(500).json({
      message: 'Failed to run health checks',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

module.exports = router;