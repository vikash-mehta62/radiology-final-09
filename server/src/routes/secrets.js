const express = require('express');
const { getSecretManager, getApplicationSecrets } = require('../services/secret-manager');

const router = express.Router();

/**
 * Manual secret refresh endpoint (admin only)
 */
router.post('/refresh', async (req, res) => {
  try {
    console.log('Manual secret refresh requested', {
      userAgent: req.headers['user-agent'],
      ip: req.ip
    });

    // Clear secret cache
    const secretManager = getSecretManager();
    secretManager.clearCache();

    // Reload application secrets
    const secrets = await getApplicationSecrets();
    
    // Update environment variables
    process.env.MONGODB_URI = secrets.database.uri || process.env.MONGODB_URI;
    
    // Cloudinary removed - no longer needed

    console.log('Secrets refreshed successfully');

    res.json({
      success: true,
      message: 'Secrets refreshed successfully',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Manual secret refresh failed', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to refresh secrets'
    });
  }
});

/**
 * Get secret manager status and cache statistics
 */
router.get('/status', (req, res) => {
  try {
    const secretManager = getSecretManager();
    const stats = secretManager.getCacheStats();

    res.json({
      success: true,
      data: {
        provider: stats.provider,
        cacheSize: stats.size,
        cacheTimeout: stats.timeout,
        uptime: process.uptime(),
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Failed to get secret manager status', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to get status'
    });
  }
});

module.exports = router;