const passport = require('passport');
const AuthenticationService = require('../services/authentication-service');
const { auditLogger } = require('../middleware/auditMiddleware');

// Helper functions for audit logging
const logAuthentication = (req, details) => {
  auditLogger.logAccessEvent('authentication', {
    userId: details.userId,
    username: req.body?.username
  }, {
    method: details.method,
    status: details.status,
    ip: req.ip,
    userAgent: req.get('user-agent')
  });
};

const logUnauthorizedAccess = (req, details) => {
  auditLogger.logAccessEvent('unauthorized_access', {
    userId: details.userId,
    username: details.username || req.body?.username
  }, {
    reason: details.reason,
    error: details.error,
    ip: details.ip || req.ip,
    country: details.country,
    method: details.method,
    userAgent: req.get('user-agent')
  });
};

class AuthenticationController {
  constructor() {
    this.authService = new AuthenticationService();
  }

  // OAuth2/OIDC login initiation
  initiateOAuth2Login = (req, res, next) => {
    // Check IP restrictions before allowing OAuth2 flow
    const ipCheck = this.authService.checkIPRestrictions(req);
    if (!ipCheck.allowed) {
      logUnauthorizedAccess(req, {
        reason: ipCheck.reason,
        ip: ipCheck.ip,
        country: ipCheck.country
      });
      return res.status(403).json({
        error: 'Access denied',
        reason: ipCheck.reason
      });
    }

    passport.authenticate('oauth2', {
      scope: this.authService.config.oauth2.scope
    })(req, res, next);
  };

  // OAuth2/OIDC callback handler
  handleOAuth2Callback = async (req, res, next) => {
    passport.authenticate('oauth2', { session: false }, async (err, user, info) => {
      if (err) {
        logUnauthorizedAccess(req, { error: err.message, method: 'oauth2' });
        return res.status(500).json({ error: 'Authentication failed', details: err.message });
      }

      if (!user) {
        logUnauthorizedAccess(req, { reason: 'OAuth2 authentication failed', info });
        return res.status(401).json({ error: 'Authentication failed' });
      }

      try {
        // Check if MFA is required
        const mfaData = this.authService.mfaSecrets.get(user.id);
        const requiresMFA = this.authService.config.mfa.enabled && mfaData && mfaData.verified;

        if (requiresMFA) {
          // Return temporary token for MFA verification
          const tempToken = await this.authService.generateTokens({
            ...user,
            mfaRequired: true
          });

          logAuthentication(req, {
            userId: user.id,
            method: 'oauth2',
            status: 'mfa_required'
          });

          return res.json({
            mfaRequired: true,
            tempToken: tempToken.accessToken,
            message: 'MFA verification required'
          });
        }

        // Generate tokens
        const tokens = await this.authService.generateTokens(user);

        logAuthentication(req, {
          userId: user.id,
          method: 'oauth2',
          status: 'success'
        });

        res.json({
          success: true,
          user: {
            id: user.id,
            username: user.username,
            email: user.email,
            roles: user.roles
          },
          tokens
        });
      } catch (error) {
        logUnauthorizedAccess(req, { error: error.message, userId: user.id });
        res.status(500).json({ error: 'Token generation failed' });
      }
    })(req, res, next);
  };

  // Local login
  localLogin = async (req, res) => {
    try {
      // Apply rate limiting
      this.authService.getLoginRateLimit()(req, res, async () => {
        // Check IP restrictions
        const ipCheck = this.authService.checkIPRestrictions(req);
        if (!ipCheck.allowed) {
          logUnauthorizedAccess(req, {
            reason: ipCheck.reason,
            ip: ipCheck.ip,
            country: ipCheck.country,
            username: req.body.username
          });
          return res.status(403).json({
            error: 'Access denied',
            reason: ipCheck.reason
          });
        }

        const { username, password } = req.body;

        if (!username || !password) {
          return res.status(400).json({ error: 'Username and password required' });
        }

        try {
          const user = await this.authService.authenticateLocalUser(username, password);

          // Check if MFA is required
          const mfaData = this.authService.mfaSecrets.get(user.id);
          const requiresMFA = this.authService.config.mfa.enabled && user.mfaEnabled && mfaData && mfaData.verified;

          if (requiresMFA) {
            // Return temporary token for MFA verification
            const tempToken = await this.authService.generateTokens({
              ...user,
              mfaRequired: true
            });

            logAuthentication(req, {
              userId: user.id,
              method: 'local',
              status: 'mfa_required'
            });

            return res.json({
              mfaRequired: true,
              tempToken: tempToken.accessToken,
              message: 'MFA verification required'
            });
          }

          // Generate tokens
          const tokens = await this.authService.generateTokens(user);

          logAuthentication(req, {
            userId: user.id,
            method: 'local',
            status: 'success'
          });

          res.json({
            success: true,
            user: {
              id: user.id,
              username: user.username,
              email: user.email,
              roles: user.roles
            },
            tokens
          });
        } catch (error) {
          logUnauthorizedAccess(req, {
            error: error.message,
            username,
            method: 'local'
          });
          res.status(401).json({ error: 'Invalid credentials' });
        }
      });
    } catch (error) {
      res.status(500).json({ error: 'Login failed' });
    }
  };

  // MFA setup
  setupMFA = async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const mfaSetup = await this.authService.setupMFA(req.user.id);

      res.json({
        success: true,
        qrCode: mfaSetup.qrCode,
        manualEntryKey: mfaSetup.manualEntryKey,
        message: 'Scan the QR code with your authenticator app'
      });
    } catch (error) {
      res.status(500).json({ error: 'MFA setup failed' });
    }
  };

  // MFA verification
  verifyMFA = async (req, res) => {
    try {
      const { token } = req.body;

      if (!token) {
        return res.status(400).json({ error: 'MFA token required' });
      }

      if (!req.user) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const isValid = await this.authService.verifyMFA(req.user.id, token);

      if (!isValid) {
        logUnauthorizedAccess(req, {
          userId: req.user.id,
          reason: 'Invalid MFA token'
        });
        return res.status(401).json({ error: 'Invalid MFA token' });
      }

      // Generate new tokens without MFA requirement
      const user = await this.authService.getUserById(req.user.id);
      const tokens = await this.authService.generateTokens({
        ...user,
        mfaRequired: false
      });

      logAuthentication(req, {
        userId: req.user.id,
        method: 'mfa',
        status: 'success'
      });

      res.json({
        success: true,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          roles: user.roles
        },
        tokens
      });
    } catch (error) {
      res.status(500).json({ error: 'MFA verification failed' });
    }
  };

  // Token refresh
  refreshToken = async (req, res) => {
    try {
      const { refreshToken } = req.body;

      if (!refreshToken) {
        return res.status(400).json({ error: 'Refresh token required' });
      }

      const tokens = await this.authService.refreshToken(refreshToken);

      res.json({
        success: true,
        tokens
      });
    } catch (error) {
      res.status(401).json({ error: 'Invalid refresh token' });
    }
  };

  // Logout
  logout = async (req, res) => {
    try {
      if (req.user) {
        await this.authService.logout(req.user.id, req.user.sessionId);
        
        logAuthentication(req, {
          userId: req.user.id,
          method: 'logout',
          status: 'success'
        });
      }

      res.json({ success: true, message: 'Logged out successfully' });
    } catch (error) {
      res.status(500).json({ error: 'Logout failed' });
    }
  };

  // Get current user info
  getCurrentUser = async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const user = await this.authService.getUserById(req.user.id);
      const mfaData = this.authService.mfaSecrets.get(req.user.id);

      res.json({
        success: true,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          roles: user.roles,
          mfaEnabled: mfaData && mfaData.verified,
          lastLogin: user.lastLogin
        }
      });
    } catch (error) {
      res.status(500).json({ error: 'Failed to get user info' });
    }
  };
}

module.exports = new AuthenticationController();