const express = require('express');
const router = express.Router();
const { getUnifiedOrthancService } = require('../services/unified-orthanc-service');

/**
 * Health check for upload services
 * GET /api/dicom/upload/health
 */
router.get('/health', async (req, res) => {
  const health = {
    timestamp: new Date().toISOString(),
    services: {}
  };

  // Check MongoDB
  try {
    const mongoose = require('mongoose');
    health.services.mongodb = {
      status: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
      readyState: mongoose.connection.readyState,
      host: mongoose.connection.host,
      name: mongoose.connection.name
    };
  } catch (error) {
    health.services.mongodb = {
      status: 'error',
      error: error.message
    };
  }

  // Check Orthanc
  try {
    const orthancService = getUnifiedOrthancService();
    const orthancHealth = await orthancService.checkHealth();
    health.services.orthanc = {
      status: 'connected',
      url: process.env.ORTHANC_URL || 'http://69.62.70.102:8042',
      ...orthancHealth
    };
  } catch (error) {
    health.services.orthanc = {
      status: 'error',
      url: process.env.ORTHANC_URL || 'http://69.62.70.102:8042',
      error: error.message
    };
  }

  // Overall status
  const allHealthy = Object.values(health.services).every(
    service => service.status === 'connected'
  );

  health.overall = allHealthy ? 'healthy' : 'degraded';

  res.status(allHealthy ? 200 : 503).json(health);
});

module.exports = router;
