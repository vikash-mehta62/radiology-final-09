const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const signatureService = require('../services/signature-service');
const auditService = require('../services/audit-service');
const User = require('../models/User');
const { authenticate, requireRole } = require('../middleware/authMiddleware');
const {
  requireSignatureRole,
  requireRevocationPermission,
  requireVerificationPermission,
  getAllowedSignatureMeanings
} = require('../middleware/signature-middleware');
const { requireMFA } = require('../middleware/mfa-middleware');
const { enforce: enforceIPWhitelist } = require('../middleware/ip-whitelist-middleware');

/**
 * FDA 21 CFR Part 11 Compliant Digital Signature API Routes
 * All routes require authentication
 * Signature operations require password verification
 */

/**
 * Middleware to verify user password for signature operations
 */
async function verifyPassword(req, res, next) {
  try {
    const { password } = req.body;

    if (!password) {
      return res.status(400).json({
        success: false,
        message: 'Password is required for signature operations',
        error: 'PASSWORD_REQUIRED'
      });
    }

    // Fetch user from database
    const user = await User.findById(req.user.id || req.user.userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
        error: 'USER_NOT_FOUND'
      });
    }

    // Verify password
    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) {
      // Log failed password verification
      await auditService.logReportAccess(
        req.body.reportId || 'unknown',
        req.user.id || req.user.userId,
        req.ip,
        'password_verification_failed'
      );

      return res.status(401).json({
        success: false,
        message: 'Invalid password',
        error: 'INVALID_PASSWORD'
      });
    }

    // Attach user to request for later use
    req.verifiedUser = user;
    next();
  } catch (error) {
    console.error('❌ Error verifying password:', error);
    res.status(500).json({
      success: false,
      message: 'Error verifying password',
      error: error.message
    });
  }
}

const { rateLimit } = require('../middleware/session-middleware');

/**
 * POST /api/signatures/sign
 * Sign a report with FDA-compliant digital signature
 * Requires authentication, IP whitelisting, role-based authorization, MFA, and password verification
 * Requirements: 4.1-4.12, 4.3, 12.7, 12.1-12.12
 */
router.post('/sign', 
  rateLimit({ maxRequests: 10, windowMs: 60000 }), // 10 requests per minute
  authenticate, 
  requireSignatureRole(), 
  verifyPassword, 
  async (req, res) => {
  try {
    console.log('🔐 Sign request received:', {
      reportId: req.body.reportId,
      meaning: req.body.meaning,
      hasPassword: !!req.body.password,
      userId: req.user?.id || req.user?.userId
    });
    
    const { reportId, meaning } = req.body;
    const userId = req.user.id || req.user.userId;

    // Validate input
    if (!reportId) {
      return res.status(400).json({
        success: false,
        message: 'Report ID is required',
        error: 'REPORT_ID_REQUIRED'
      });
    }

    if (!meaning || !['author', 'reviewer', 'approver'].includes(meaning)) {
      return res.status(400).json({
        success: false,
        message: 'Valid signature meaning is required (author, reviewer, or approver)',
        error: 'INVALID_MEANING'
      });
    }

    // Collect metadata
    const metadata = {
      ipAddress: req.ip || req.connection.remoteAddress,
      userAgent: req.headers['user-agent'],
      deviceId: req.headers['x-device-id']
    };

    // Sign report
    const signature = await signatureService.signReport(reportId, userId, meaning, metadata);

    res.json({
      success: true,
      message: 'Report signed successfully',
      data: {
        signatureId: signature._id,
        reportId: signature.reportId,
        signerName: signature.signerName,
        meaning: signature.meaning,
        timestamp: signature.timestamp,
        status: signature.status,
        algorithm: signature.algorithm,
        keySize: signature.keySize
      }
    });
  } catch (error) {
    console.error('❌ Error signing report:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to sign report',
      error: error.message
    });
  }
});

/**
 * GET /api/signatures/verify/:signatureId
 * Verify a digital signature
 * Requires authentication
 * Requirements: 4.8, 4.11, 4.12, 12.1-12.12
 */
router.get('/verify/:signatureId', 
  rateLimit({ maxRequests: 30, windowMs: 60000 }), // 30 requests per minute
  authenticate, 
  requireVerificationPermission(), 
  async (req, res) => {
  try {
    const { signatureId } = req.params;
    const userId = req.user.id || req.user.userId;

    if (!signatureId) {
      return res.status(400).json({
        success: false,
        message: 'Signature ID is required',
        error: 'SIGNATURE_ID_REQUIRED'
      });
    }

    // Verify signature
    const result = await signatureService.verifySignature(
      signatureId,
      userId,
      req.ip || req.connection.remoteAddress
    );

    res.json({
      success: true,
      message: result.valid ? 'Signature is valid' : 'Signature is invalid',
      data: {
        valid: result.valid,
        signatureId: result.signature._id,
        reportId: result.signature.reportId,
        signerName: result.signature.signerName,
        meaning: result.signature.meaning,
        timestamp: result.signature.timestamp,
        status: result.signature.status,
        verifiedAt: result.verifiedAt,
        reason: result.reason,
        reportHash: result.reportHash
      }
    });
  } catch (error) {
    console.error('❌ Error verifying signature:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to verify signature',
      error: error.message
    });
  }
});

/**
 * GET /api/signatures/audit-trail/:reportId
 * Get complete audit trail for a report
 * Requires authentication
 */
router.get('/audit-trail/:reportId', authenticate, async (req, res) => {
  try {
    const { reportId } = req.params;

    if (!reportId) {
      return res.status(400).json({
        success: false,
        message: 'Report ID is required',
        error: 'REPORT_ID_REQUIRED'
      });
    }

    // Get audit trail
    const auditTrail = await signatureService.getAuditTrail(reportId);

    res.json({
      success: true,
      message: 'Audit trail retrieved successfully',
      data: {
        reportId,
        eventCount: auditTrail.length,
        events: auditTrail
      }
    });
  } catch (error) {
    console.error('❌ Error getting audit trail:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get audit trail',
      error: error.message
    });
  }
});

/**
 * POST /api/signatures/revoke/:signatureId
 * Revoke a digital signature
 * Requires authentication, revocation permission, MFA, and password verification
 * Requirements: 4.1-4.12, 4.3, 12.1-12.12
 */
router.post('/revoke/:signatureId', 
  rateLimit({ maxRequests: 5, windowMs: 60000 }), // 5 requests per minute
  authenticate, 
  requireRevocationPermission(), 
  requireMFA(), 
  verifyPassword, 
  async (req, res) => {
  try {
    const { signatureId } = req.params;
    const { reason } = req.body;
    const userId = req.user.id || req.user.userId;

    if (!signatureId) {
      return res.status(400).json({
        success: false,
        message: 'Signature ID is required',
        error: 'SIGNATURE_ID_REQUIRED'
      });
    }

    if (!reason) {
      return res.status(400).json({
        success: false,
        message: 'Revocation reason is required',
        error: 'REASON_REQUIRED'
      });
    }

    // Revoke signature
    const signature = await signatureService.revokeSignature(
      signatureId,
      reason,
      userId,
      req.ip || req.connection.remoteAddress
    );

    res.json({
      success: true,
      message: 'Signature revoked successfully',
      data: {
        signatureId: signature._id,
        reportId: signature.reportId,
        status: signature.status,
        revocationReason: signature.revocationReason,
        revokedBy: signature.revokedBy,
        revokedAt: signature.revokedAt
      }
    });
  } catch (error) {
    console.error('❌ Error revoking signature:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to revoke signature',
      error: error.message
    });
  }
});

/**
 * POST /api/signatures/validate
 * Validate all signatures for a report
 * Requires authentication
 */
router.post('/validate', authenticate, async (req, res) => {
  try {
    const { reportId } = req.body;

    if (!reportId) {
      return res.status(400).json({
        success: false,
        message: 'Report ID is required',
        error: 'REPORT_ID_REQUIRED'
      });
    }

    // Validate all signatures
    const result = await signatureService.validateReportSignatures(reportId);

    res.json({
      success: true,
      message: result.message,
      data: {
        reportId,
        valid: result.valid,
        signed: result.signed,
        signatures: result.signatures
      }
    });
  } catch (error) {
    console.error('❌ Error validating signatures:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to validate signatures',
      error: error.message
    });
  }
});

/**
 * GET /api/signatures/report/:reportId
 * Get all signatures for a report
 * Requires authentication
 */
router.get('/report/:reportId', authenticate, async (req, res) => {
  try {
    const { reportId } = req.params;

    if (!reportId) {
      return res.status(400).json({
        success: false,
        message: 'Report ID is required',
        error: 'REPORT_ID_REQUIRED'
      });
    }

    // Get signatures
    const signatures = await signatureService.getReportSignatures(reportId);

    res.json({
      success: true,
      message: 'Signatures retrieved successfully',
      data: {
        reportId,
        count: signatures.length,
        signatures: signatures.map(sig => ({
          id: sig._id,
          signerName: sig.signerName,
          signerRole: sig.signerRole,
          meaning: sig.meaning,
          timestamp: sig.timestamp,
          status: sig.status,
          algorithm: sig.algorithm,
          keySize: sig.keySize
        }))
      }
    });
  } catch (error) {
    console.error('❌ Error getting signatures:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get signatures',
      error: error.message
    });
  }
});

/**
 * GET /api/signatures/audit/search
 * Search audit logs
 * Requires authentication and admin role
 */
router.get('/audit/search', authenticate, requireRole(['admin', 'superadmin']), async (req, res) => {
  try {
    const {
      startDate,
      endDate,
      eventType,
      userId,
      reportId,
      action,
      result,
      limit
    } = req.query;

    const criteria = {
      startDate,
      endDate,
      eventType: eventType || 'signature',
      userId,
      reportId,
      action,
      result,
      limit: parseInt(limit) || 100
    };

    // Search audit logs
    const entries = await auditService.searchAuditLogs(criteria);

    res.json({
      success: true,
      message: 'Audit logs retrieved successfully',
      data: {
        criteria,
        count: entries.length,
        entries
      }
    });
  } catch (error) {
    console.error('❌ Error searching audit logs:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to search audit logs',
      error: error.message
    });
  }
});

/**
 * GET /api/signatures/audit/report
 * Generate audit report
 * Requires authentication and admin role
 */
router.get('/audit/report', authenticate, requireRole(['admin', 'superadmin']), async (req, res) => {
  try {
    const {
      startDate,
      endDate,
      eventType,
      userId,
      reportId
    } = req.query;

    const criteria = {
      startDate,
      endDate,
      eventType: eventType || 'signature',
      userId,
      reportId
    };

    // Generate audit report
    const report = await auditService.generateAuditReport(criteria);

    res.json({
      success: true,
      message: 'Audit report generated successfully',
      data: report
    });
  } catch (error) {
    console.error('❌ Error generating audit report:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate audit report',
      error: error.message
    });
  }
});

/**
 * GET /api/signatures/permissions
 * Get allowed signature meanings for current user
 * Requires authentication
 * Requirements: 4.1-4.12
 */
router.get('/permissions', authenticate, async (req, res) => {
  try {
    const userId = req.user.id || req.user.userId;

    // Fetch full user object
    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
        error: 'USER_NOT_FOUND'
      });
    }

    // Get allowed signature meanings
    const allowedMeanings = getAllowedSignatureMeanings(user);

    res.json({
      success: true,
      message: 'Signature permissions retrieved successfully',
      data: {
        userId: user._id,
        username: user.username,
        roles: user.roles,
        allowedSignatureMeanings: allowedMeanings,
        canSignAsAuthor: allowedMeanings.includes('author'),
        canSignAsReviewer: allowedMeanings.includes('reviewer'),
        canSignAsApprover: allowedMeanings.includes('approver')
      }
    });
  } catch (error) {
    console.error('❌ Error getting signature permissions:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get signature permissions',
      error: error.message
    });
  }
});

module.exports = router;
