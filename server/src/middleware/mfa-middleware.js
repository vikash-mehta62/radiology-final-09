const mfaService = require('../services/mfa-service');
const User = require('../models/User');

/**
 * MFA Middleware
 * Enforces multi-factor authentication for sensitive operations
 * Requirements: 4.3
 */

/**
 * Require MFA verification for sensitive operations
 * Checks if user has MFA enabled and verifies the MFA token
 */
function requireMFA() {
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

      const userId = req.user.id || req.user.userId;

      // Fetch user to check MFA status
      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found',
          error: 'USER_NOT_FOUND'
        });
      }

      // If MFA is not enabled, allow operation but log warning
      if (!user.mfaEnabled) {
        console.warn(`⚠️ MFA not enabled for user ${userId} performing sensitive operation`);
        
        // In strict mode, require MFA
        if (process.env.MFA_REQUIRED === 'true') {
          return res.status(403).json({
            success: false,
            message: 'Multi-factor authentication is required for this operation',
            error: 'MFA_REQUIRED',
            mfaRequired: true
          });
        }
        
        // Otherwise, allow but log
        return next();
      }

      // Get MFA token from request
      const mfaToken = req.headers['x-mfa-token'] || req.body.mfaToken;

      if (!mfaToken) {
        return res.status(403).json({
          success: false,
          message: 'MFA verification required',
          error: 'MFA_TOKEN_REQUIRED',
          mfaRequired: true,
          mfaMethod: user.mfaMethod
        });
      }

      // Verify MFA token based on method
      let verified = false;

      if (user.mfaMethod === 'totp') {
        verified = await mfaService.verifyTOTP(userId, mfaToken);
      } else if (user.mfaMethod === 'sms') {
        // For SMS, mfaToken should be in format "codeId:code"
        const [codeId, code] = mfaToken.split(':');
        if (!codeId || !code) {
          return res.status(400).json({
            success: false,
            message: 'Invalid SMS verification format',
            error: 'INVALID_MFA_FORMAT'
          });
        }
        verified = await mfaService.verifySMSCode(codeId, code);
      } else {
        return res.status(400).json({
          success: false,
          message: 'Unknown MFA method',
          error: 'UNKNOWN_MFA_METHOD'
        });
      }

      if (!verified) {
        return res.status(403).json({
          success: false,
          message: 'MFA verification failed',
          error: 'MFA_VERIFICATION_FAILED'
        });
      }

      // MFA verified, proceed
      req.mfaVerified = true;
      next();
    } catch (error) {
      console.error('❌ MFA verification error:', error);
      
      return res.status(403).json({
        success: false,
        message: error.message || 'MFA verification failed',
        error: 'MFA_VERIFICATION_ERROR'
      });
    }
  };
}

/**
 * Optional MFA verification
 * Verifies MFA if token is provided, but doesn't require it
 */
function optionalMFA() {
  return async (req, res, next) => {
    try {
      // Ensure user is authenticated
      if (!req.user) {
        return next();
      }

      const userId = req.user.id || req.user.userId;
      const mfaToken = req.headers['x-mfa-token'] || req.body.mfaToken;

      // If no MFA token provided, skip verification
      if (!mfaToken) {
        return next();
      }

      // Fetch user
      const user = await User.findById(userId);
      if (!user || !user.mfaEnabled) {
        return next();
      }

      // Verify MFA token
      let verified = false;

      if (user.mfaMethod === 'totp') {
        verified = await mfaService.verifyTOTP(userId, mfaToken);
      } else if (user.mfaMethod === 'sms') {
        const [codeId, code] = mfaToken.split(':');
        if (codeId && code) {
          verified = await mfaService.verifySMSCode(codeId, code);
        }
      }

      if (verified) {
        req.mfaVerified = true;
      }

      next();
    } catch (error) {
      console.error('❌ Optional MFA verification error:', error);
      // Don't block request on optional MFA errors
      next();
    }
  };
}

/**
 * Check if MFA is required for operation
 * Returns MFA status without blocking
 */
function checkMFARequired() {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return next();
      }

      const userId = req.user.id || req.user.userId;
      const user = await User.findById(userId);

      if (user && user.mfaEnabled) {
        req.mfaRequired = true;
        req.mfaMethod = user.mfaMethod;
      } else {
        req.mfaRequired = false;
      }

      next();
    } catch (error) {
      console.error('❌ Error checking MFA requirement:', error);
      next(); // Don't block on check errors
    }
  };
}

module.exports = {
  requireMFA,
  optionalMFA,
  checkMFARequired
};
