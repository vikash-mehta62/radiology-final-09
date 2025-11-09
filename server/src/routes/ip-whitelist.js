const express = require('express');
const router = express.Router();
const { authenticate, requireRole } = require('../middleware/authMiddleware');
const {
  getWhitelist,
  addToWhitelist,
  removeFromWhitelist,
  reloadWhitelist
} = require('../middleware/ip-whitelist-middleware');
const auditService = require('../services/audit-service');

/**
 * IP Whitelist Management API Routes
 * All routes require authentication and admin role
 * Requirements: 12.7
 */

/**
 * GET /api/ip-whitelist
 * Get current IP whitelist
 */
router.get('/', authenticate, requireRole(['admin', 'superadmin']), async (req, res) => {
  try {
    const whitelist = getWhitelist();

    res.json({
      success: true,
      data: {
        whitelist,
        count: whitelist.length,
        enabled: process.env.IP_WHITELIST_ENABLED === 'true',
        strictMode: process.env.IP_WHITELIST_STRICT === 'true'
      }
    });
  } catch (error) {
    console.error('❌ Error getting IP whitelist:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get IP whitelist',
      error: error.message
    });
  }
});

/**
 * POST /api/ip-whitelist
 * Add IP address or range to whitelist
 */
router.post('/', authenticate, requireRole(['admin', 'superadmin']), async (req, res) => {
  try {
    const { ip, description } = req.body;
    const userId = req.user.id || req.user.userId;

    if (!ip) {
      return res.status(400).json({
        success: false,
        message: 'IP address or range is required',
        error: 'IP_REQUIRED'
      });
    }

    // Validate IP format (basic validation)
    const ipRegex = /^(\d{1,3}\.){3}\d{1,3}(\/\d{1,2})?$/;
    if (!ipRegex.test(ip)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid IP address or CIDR range format',
        error: 'INVALID_IP_FORMAT'
      });
    }

    // Add to whitelist
    addToWhitelist(ip);

    // Log audit event
    await auditService.logSecurityEvent(
      'ip_whitelist_added',
      userId,
      req.ip || req.connection.remoteAddress,
      'success',
      `Added IP to whitelist: ${ip}${description ? ` (${description})` : ''}`
    );

    res.json({
      success: true,
      message: 'IP address added to whitelist',
      data: {
        ip,
        description
      }
    });
  } catch (error) {
    console.error('❌ Error adding IP to whitelist:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add IP to whitelist',
      error: error.message
    });
  }
});

/**
 * DELETE /api/ip-whitelist/:ip
 * Remove IP address or range from whitelist
 */
router.delete('/:ip', authenticate, requireRole(['admin', 'superadmin']), async (req, res) => {
  try {
    const { ip } = req.params;
    const userId = req.user.id || req.user.userId;

    if (!ip) {
      return res.status(400).json({
        success: false,
        message: 'IP address or range is required',
        error: 'IP_REQUIRED'
      });
    }

    // Decode IP (in case it's URL encoded)
    const decodedIP = decodeURIComponent(ip);

    // Remove from whitelist
    removeFromWhitelist(decodedIP);

    // Log audit event
    await auditService.logSecurityEvent(
      'ip_whitelist_removed',
      userId,
      req.ip || req.connection.remoteAddress,
      'success',
      `Removed IP from whitelist: ${decodedIP}`
    );

    res.json({
      success: true,
      message: 'IP address removed from whitelist',
      data: {
        ip: decodedIP
      }
    });
  } catch (error) {
    console.error('❌ Error removing IP from whitelist:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to remove IP from whitelist',
      error: error.message
    });
  }
});

/**
 * POST /api/ip-whitelist/reload
 * Reload IP whitelist from environment
 */
router.post('/reload', authenticate, requireRole(['admin', 'superadmin']), async (req, res) => {
  try {
    const userId = req.user.id || req.user.userId;

    // Reload whitelist
    reloadWhitelist();

    // Log audit event
    await auditService.logSecurityEvent(
      'ip_whitelist_reloaded',
      userId,
      req.ip || req.connection.remoteAddress,
      'success',
      'IP whitelist reloaded from environment'
    );

    res.json({
      success: true,
      message: 'IP whitelist reloaded successfully',
      data: {
        whitelist: getWhitelist(),
        count: getWhitelist().length
      }
    });
  } catch (error) {
    console.error('❌ Error reloading IP whitelist:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to reload IP whitelist',
      error: error.message
    });
  }
});

/**
 * GET /api/ip-whitelist/check/:ip
 * Check if an IP is whitelisted
 */
router.get('/check/:ip', authenticate, requireRole(['admin', 'superadmin']), async (req, res) => {
  try {
    const { ip } = req.params;

    if (!ip) {
      return res.status(400).json({
        success: false,
        message: 'IP address is required',
        error: 'IP_REQUIRED'
      });
    }

    // Decode IP
    const decodedIP = decodeURIComponent(ip);

    // Check if whitelisted
    const whitelist = getWhitelist();
    const isWhitelisted = whitelist.includes(decodedIP);

    res.json({
      success: true,
      data: {
        ip: decodedIP,
        whitelisted: isWhitelisted
      }
    });
  } catch (error) {
    console.error('❌ Error checking IP whitelist:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to check IP whitelist',
      error: error.message
    });
  }
});

module.exports = router;
