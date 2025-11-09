const User = require('../models/User');

/**
 * Signature Authorization Middleware
 * Implements role-based access control for signature operations
 * Requirements: 4.1-4.12
 */

/**
 * Signature role definitions
 * Defines which user roles can perform which signature meanings
 */
const SIGNATURE_ROLES = {
  author: ['radiologist', 'physician', 'doctor', 'attending', 'resident'],
  reviewer: ['radiologist', 'physician', 'doctor', 'attending', 'senior_radiologist'],
  approver: ['attending', 'senior_radiologist', 'department_head', 'admin', 'superadmin']
};

/**
 * Check if user has permission to sign with specific meaning
 * @param {object} user - User object
 * @param {string} meaning - Signature meaning (author, reviewer, approver)
 * @returns {boolean} True if user has permission
 */
function hasSignaturePermission(user, meaning) {
  if (!user || !user.roles) {
    return false;
  }

  // Super admin can sign with any meaning
  if (user.roles.includes('system:admin') || user.roles.includes('super_admin') || user.roles.includes('superadmin')) {
    return true;
  }

  // Check if user has any of the allowed roles for this meaning
  const allowedRoles = SIGNATURE_ROLES[meaning] || [];
  
  // Also check user.role (singular) for backward compatibility
  const userRoles = Array.isArray(user.roles) ? user.roles : [user.role];
  
  return userRoles.some(role => allowedRoles.includes(role));
}

/**
 * Middleware to check signature authorization
 * Validates that user has permission to sign with specified meaning
 */
function requireSignatureRole(meaning = null) {
  return async (req, res, next) => {
    try {
      // Ensure user is authenticated
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required',
          error: 'UNAUTHORIZED'
        });
      }

      // Get signature meaning from request body or params
      const signatureMeaning = meaning || req.body.meaning || req.params.meaning;

      if (!signatureMeaning) {
        return res.status(400).json({
          success: false,
          message: 'Signature meaning is required',
          error: 'MEANING_REQUIRED'
        });
      }

      // Validate meaning is valid
      if (!['author', 'reviewer', 'approver'].includes(signatureMeaning)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid signature meaning. Must be: author, reviewer, or approver',
          error: 'INVALID_MEANING'
        });
      }

      // Fetch full user object to get roles
      const user = await User.findById(req.user.id || req.user.userId);
      
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found',
          error: 'USER_NOT_FOUND'
        });
      }

      // Check if user has permission
      if (!hasSignaturePermission(user, signatureMeaning)) {
        return res.status(403).json({
          success: false,
          message: `Insufficient permissions to sign as ${signatureMeaning}`,
          error: 'INSUFFICIENT_SIGNATURE_PERMISSIONS',
          requiredRoles: SIGNATURE_ROLES[signatureMeaning],
          userRoles: user.roles
        });
      }

      // Attach full user to request for downstream use
      req.user = user;
      req.signatureMeaning = signatureMeaning;

      next();
    } catch (error) {
      console.error('Signature authorization error:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to check signature authorization',
        error: 'AUTHORIZATION_ERROR'
      });
    }
  };
}

/**
 * Middleware to check signature revocation authorization
 * Only the signer or admin can revoke a signature
 */
function requireRevocationPermission() {
  return async (req, res, next) => {
    try {
      // Ensure user is authenticated
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required',
          error: 'UNAUTHORIZED'
        });
      }

      const { signatureId } = req.params;

      if (!signatureId) {
        return res.status(400).json({
          success: false,
          message: 'Signature ID is required',
          error: 'SIGNATURE_ID_REQUIRED'
        });
      }

      // Fetch signature to check ownership
      const DigitalSignature = require('../models/DigitalSignature');
      const signature = await DigitalSignature.findById(signatureId);

      if (!signature) {
        return res.status(404).json({
          success: false,
          message: 'Signature not found',
          error: 'SIGNATURE_NOT_FOUND'
        });
      }

      // Fetch full user object
      const user = await User.findById(req.user.id || req.user.userId);
      
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found',
          error: 'USER_NOT_FOUND'
        });
      }

      // Check if user is the signer or an admin
      const isOwner = signature.signerId.toString() === user._id.toString();
      const isAdmin = user.roles.includes('admin') || 
                      user.roles.includes('superadmin') || 
                      user.roles.includes('system:admin') ||
                      user.roles.includes('super_admin');

      if (!isOwner && !isAdmin) {
        return res.status(403).json({
          success: false,
          message: 'Only the signer or an administrator can revoke this signature',
          error: 'INSUFFICIENT_REVOCATION_PERMISSIONS'
        });
      }

      // Attach signature to request
      req.signature = signature;
      req.user = user;

      next();
    } catch (error) {
      console.error('Revocation authorization error:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to check revocation authorization',
        error: 'AUTHORIZATION_ERROR'
      });
    }
  };
}

/**
 * Middleware to check signature verification permission
 * Anyone can verify, but we track who verifies
 */
function requireVerificationPermission() {
  return async (req, res, next) => {
    try {
      // Verification is allowed for authenticated users
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required',
          error: 'UNAUTHORIZED'
        });
      }

      // Fetch full user object
      const user = await User.findById(req.user.id || req.user.userId);
      
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found',
          error: 'USER_NOT_FOUND'
        });
      }

      req.user = user;
      next();
    } catch (error) {
      console.error('Verification authorization error:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to check verification authorization',
        error: 'AUTHORIZATION_ERROR'
      });
    }
  };
}

/**
 * Get allowed signature meanings for a user
 * @param {object} user - User object
 * @returns {Array<string>} Array of allowed signature meanings
 */
function getAllowedSignatureMeanings(user) {
  if (!user || !user.roles) {
    return [];
  }

  const allowed = [];

  // Check each meaning
  for (const [meaning, roles] of Object.entries(SIGNATURE_ROLES)) {
    if (hasSignaturePermission(user, meaning)) {
      allowed.push(meaning);
    }
  }

  return allowed;
}

module.exports = {
  requireSignatureRole,
  requireRevocationPermission,
  requireVerificationPermission,
  hasSignaturePermission,
  getAllowedSignatureMeanings,
  SIGNATURE_ROLES
};
