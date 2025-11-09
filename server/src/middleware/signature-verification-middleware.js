const signatureService = require('../services/signature-service');
const auditService = require('../services/audit-service');

/**
 * Middleware to verify signatures when accessing reports
 * Implements FDA 21 CFR Part 11 requirement for signature verification
 */

/**
 * Verify signatures on report access
 * Logs verification attempts and alerts on failures
 */
async function verifySignaturesOnAccess(req, res, next) {
  try {
    const { reportId } = req.params;
    
    if (!reportId) {
      return next();
    }

    // Get user info for audit logging
    const userId = req.user?.sub || req.user?._id;
    const ipAddress = req.ip || req.connection.remoteAddress || 'unknown';

    // Validate report signatures
    const validation = await signatureService.validateReportSignatures(reportId);

    // Log report access with signature status
    await auditService.logReportAccess(
      reportId,
      userId,
      ipAddress,
      'view'
    );

    // Attach validation result to request for use in route handler
    req.signatureValidation = validation;

    // If signatures are invalid, log warning but allow access
    // (Users need to see the report to understand the issue)
    if (validation.signed && !validation.valid) {
      console.warn('⚠️ Report accessed with invalid signature:', reportId);
      console.warn('⚠️ Validation details:', validation);
      
      // Log security event
      await auditService.logSignature(
        { reportId, status: 'invalid' },
        'validation_failed',
        userId,
        ipAddress,
        'warning',
        'Report accessed with invalid signature'
      );
    }

    next();
  } catch (error) {
    console.error('❌ Error verifying signatures on access:', error);
    // Don't block access on verification errors
    req.signatureValidation = {
      valid: false,
      error: error.message
    };
    next();
  }
}

/**
 * Verify signatures and block access if invalid
 * Use for critical operations that require valid signatures
 */
async function requireValidSignature(req, res, next) {
  try {
    const { reportId } = req.params;
    
    if (!reportId) {
      return res.status(400).json({
        success: false,
        error: 'Report ID is required'
      });
    }

    const userId = req.user?.sub || req.user?._id;
    const ipAddress = req.ip || req.connection.remoteAddress || 'unknown';

    // Validate report signatures
    const validation = await signatureService.validateReportSignatures(reportId);

    // Log access attempt
    await auditService.logReportAccess(
      reportId,
      userId,
      ipAddress,
      'access_attempt'
    );

    // Block access if signatures are invalid
    if (validation.signed && !validation.valid) {
      console.error('🚫 Access denied: Invalid signature on report:', reportId);
      
      // Log security event
      await auditService.logSignature(
        { reportId, status: 'invalid' },
        'access_denied',
        userId,
        ipAddress,
        'failure',
        'Access denied due to invalid signature'
      );

      return res.status(403).json({
        success: false,
        error: 'Access denied: Report signature is invalid',
        validation
      });
    }

    // Attach validation to request
    req.signatureValidation = validation;
    next();
  } catch (error) {
    console.error('❌ Error in signature verification:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to verify signature',
      message: error.message
    });
  }
}

/**
 * Add signature verification status to response
 * Middleware to include signature info in API responses
 */
function includeSignatureStatus(req, res, next) {
  // Store original json method
  const originalJson = res.json.bind(res);

  // Override json method to include signature status
  res.json = function(data) {
    if (req.signatureValidation && data.report) {
      data.signatureValidation = req.signatureValidation;
    }
    return originalJson(data);
  };

  next();
}

/**
 * Alert on signature verification failure
 * Sends notifications when signatures fail verification
 */
async function alertOnVerificationFailure(req, res, next) {
  try {
    if (req.signatureValidation && req.signatureValidation.signed && !req.signatureValidation.valid) {
      const { reportId } = req.params;
      const userId = req.user?.sub || req.user?._id;

      // Log critical security event
      console.error('🚨 CRITICAL: Signature verification failed for report:', reportId);
      console.error('🚨 User:', userId);
      console.error('🚨 Validation:', req.signatureValidation);

      // TODO: Send notification to security team
      // This would integrate with the notification service when implemented
      
      // For now, just log to audit trail
      await auditService.logSignature(
        { 
          reportId, 
          status: 'invalid',
          signatures: req.signatureValidation.signatures 
        },
        'verification_alert',
        userId,
        req.ip || 'unknown',
        'critical',
        'Signature verification failed - possible tampering detected'
      );
    }

    next();
  } catch (error) {
    console.error('❌ Error in alert middleware:', error);
    next();
  }
}

module.exports = {
  verifySignaturesOnAccess,
  requireValidSignature,
  includeSignatureStatus,
  alertOnVerificationFailure
};
