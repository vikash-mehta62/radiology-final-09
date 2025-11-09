const express = require('express');
const router = express.Router();
const mfaService = require('../services/mfa-service');
const { authenticate } = require('../middleware/authMiddleware');
const bcrypt = require('bcryptjs');
const User = require('../models/User');

/**
 * MFA API Routes
 * All routes require authentication
 * Requirements: 4.3
 */

/**
 * GET /api/mfa/status
 * Get MFA status for current user
 */
router.get('/status', authenticate, async (req, res) => {
  try {
    const userId = req.user.id || req.user.userId;
    const status = await mfaService.getMFAStatus(userId);

    res.json({
      success: true,
      data: status
    });
  } catch (error) {
    console.error('❌ Error getting MFA status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get MFA status',
      error: error.message
    });
  }
});

/**
 * POST /api/mfa/totp/setup
 * Setup TOTP MFA for current user
 */
router.post('/totp/setup', authenticate, async (req, res) => {
  try {
    const userId = req.user.id || req.user.userId;
    const result = await mfaService.setupTOTP(userId);

    res.json({
      success: true,
      message: 'TOTP setup initiated. Scan QR code with authenticator app.',
      data: {
        qrCode: result.qrCode,
        manualEntryKey: result.manualEntryKey
      }
    });
  } catch (error) {
    console.error('❌ Error setting up TOTP:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to setup TOTP',
      error: error.message
    });
  }
});

/**
 * POST /api/mfa/totp/verify-setup
 * Verify TOTP setup with code from authenticator app
 */
router.post('/totp/verify-setup', authenticate, async (req, res) => {
  try {
    const userId = req.user.id || req.user.userId;
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({
        success: false,
        message: 'Verification token is required',
        error: 'TOKEN_REQUIRED'
      });
    }

    await mfaService.verifyTOTPSetup(userId, token);

    res.json({
      success: true,
      message: 'TOTP MFA enabled successfully'
    });
  } catch (error) {
    console.error('❌ Error verifying TOTP setup:', error);
    res.status(400).json({
      success: false,
      message: error.message || 'Failed to verify TOTP setup',
      error: 'TOTP_VERIFICATION_FAILED'
    });
  }
});

/**
 * POST /api/mfa/totp/verify
 * Verify TOTP token
 */
router.post('/totp/verify', authenticate, async (req, res) => {
  try {
    const userId = req.user.id || req.user.userId;
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({
        success: false,
        message: 'Verification token is required',
        error: 'TOKEN_REQUIRED'
      });
    }

    const verified = await mfaService.verifyTOTP(userId, token);

    res.json({
      success: true,
      verified,
      message: 'TOTP verification successful'
    });
  } catch (error) {
    console.error('❌ Error verifying TOTP:', error);
    res.status(400).json({
      success: false,
      message: error.message || 'TOTP verification failed',
      error: 'TOTP_VERIFICATION_FAILED'
    });
  }
});

/**
 * POST /api/mfa/sms/send
 * Send SMS verification code
 */
router.post('/sms/send', authenticate, async (req, res) => {
  try {
    const userId = req.user.id || req.user.userId;
    const { phoneNumber } = req.body;

    if (!phoneNumber) {
      return res.status(400).json({
        success: false,
        message: 'Phone number is required',
        error: 'PHONE_NUMBER_REQUIRED'
      });
    }

    const codeId = await mfaService.sendSMSCode(userId, phoneNumber);

    res.json({
      success: true,
      message: 'Verification code sent',
      data: {
        codeId,
        expiresIn: 300 // 5 minutes in seconds
      }
    });
  } catch (error) {
    console.error('❌ Error sending SMS code:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to send SMS code',
      error: 'SMS_SEND_FAILED'
    });
  }
});

/**
 * POST /api/mfa/sms/verify
 * Verify SMS code
 */
router.post('/sms/verify', authenticate, async (req, res) => {
  try {
    const { codeId, code } = req.body;

    if (!codeId || !code) {
      return res.status(400).json({
        success: false,
        message: 'Code ID and verification code are required',
        error: 'INVALID_REQUEST'
      });
    }

    const verified = await mfaService.verifySMSCode(codeId, code);

    res.json({
      success: true,
      verified,
      message: 'SMS verification successful'
    });
  } catch (error) {
    console.error('❌ Error verifying SMS code:', error);
    res.status(400).json({
      success: false,
      message: error.message || 'SMS verification failed',
      error: 'SMS_VERIFICATION_FAILED'
    });
  }
});

/**
 * POST /api/mfa/disable
 * Disable MFA for current user
 * Requires password confirmation
 */
router.post('/disable', authenticate, async (req, res) => {
  try {
    const userId = req.user.id || req.user.userId;
    const { password } = req.body;

    if (!password) {
      return res.status(400).json({
        success: false,
        message: 'Password is required to disable MFA',
        error: 'PASSWORD_REQUIRED'
      });
    }

    await mfaService.disableMFA(userId, password);

    res.json({
      success: true,
      message: 'MFA disabled successfully'
    });
  } catch (error) {
    console.error('❌ Error disabling MFA:', error);
    res.status(400).json({
      success: false,
      message: error.message || 'Failed to disable MFA',
      error: 'MFA_DISABLE_FAILED'
    });
  }
});

/**
 * GET /api/mfa/backup-codes
 * Generate backup codes for MFA
 * (For future implementation)
 */
router.get('/backup-codes', authenticate, async (req, res) => {
  try {
    // TODO: Implement backup codes generation
    res.status(501).json({
      success: false,
      message: 'Backup codes not yet implemented',
      error: 'NOT_IMPLEMENTED'
    });
  } catch (error) {
    console.error('❌ Error generating backup codes:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate backup codes',
      error: error.message
    });
  }
});

module.exports = router;
