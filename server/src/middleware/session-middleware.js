const SessionService = require('../services/session-service');
const crypto = require('crypto');

/**
 * Session Middleware
 * Validates sessions, tracks activity, and implements security measures
 */
class SessionMiddleware {
  constructor() {
    this.sessionService = new SessionService();
    
    // CSRF token storage (in production, use Redis or database)
    this.csrfTokens = new Map();
    
    // Rate limiting storage (in production, use Redis)
    this.rateLimitStore = new Map();
  }

  /**
   * Validate session token middleware
   * Validates JWT token and ensures session is active
   */
  validateSession() {
    return async (req, res, next) => {
      try {
        // Extract token from Authorization header
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
          return res.status(401).json({
            success: false,
            message: 'Missing or invalid Authorization header',
            error: 'UNAUTHORIZED'
          });
        }

        const token = authHeader.substring('Bearer '.length);

        // Validate session
        const validation = await this.sessionService.validateSession(token);
        
        if (!validation.valid) {
          return res.status(401).json({
            success: false,
            message: validation.reason || 'Invalid session',
            error: 'SESSION_INVALID'
          });
        }

        // Attach session and user to request
        req.session = validation.session;
        req.user = validation.user;
        req.sessionId = validation.session.id;

        next();
      } catch (error) {
        console.error('Session validation error:', error);
        return res.status(401).json({
          success: false,
          message: 'Session validation failed',
          error: 'SESSION_VALIDATION_ERROR'
        });
      }
    };
  }

  /**
   * Track session activity middleware
   * Updates last activity timestamp for the session
   */
  trackActivity() {
    return async (req, res, next) => {
      try {
        // Session should be validated first
        if (req.sessionId) {
          // Update activity asynchronously (don't wait)
          this.sessionService.getSessionStatus(req.sessionId)
            .then(status => {
              if (status.exists && status.status === 'active') {
                // Activity is already updated in validateSession
                // This is just for additional tracking if needed
              }
            })
            .catch(err => {
              console.error('Error tracking activity:', err);
            });
        }
        
        next();
      } catch (error) {
        console.error('Activity tracking error:', error);
        next(); // Don't block request on tracking errors
      }
    };
  }

  /**
   * CSRF protection middleware
   * Validates CSRF tokens for state-changing operations
   */
  csrfProtection() {
    return (req, res, next) => {
      // Skip CSRF check for GET, HEAD, OPTIONS
      if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
        return next();
      }

      try {
        // Get CSRF token from header or body
        const csrfToken = req.headers['x-csrf-token'] || req.body._csrf;
        
        if (!csrfToken) {
          return res.status(403).json({
            success: false,
            message: 'CSRF token missing',
            error: 'CSRF_TOKEN_MISSING'
          });
        }

        // Validate CSRF token
        const sessionId = req.sessionId;
        if (!sessionId) {
          return res.status(403).json({
            success: false,
            message: 'Session required for CSRF validation',
            error: 'SESSION_REQUIRED'
          });
        }

        const storedToken = this.csrfTokens.get(sessionId);
        if (!storedToken || storedToken !== csrfToken) {
          return res.status(403).json({
            success: false,
            message: 'Invalid CSRF token',
            error: 'CSRF_TOKEN_INVALID'
          });
        }

        next();
      } catch (error) {
        console.error('CSRF validation error:', error);
        return res.status(403).json({
          success: false,
          message: 'CSRF validation failed',
          error: 'CSRF_VALIDATION_ERROR'
        });
      }
    };
  }

  /**
   * Generate CSRF token for a session
   * @param {string} sessionId - Session ID
   * @returns {string} CSRF token
   */
  generateCsrfToken(sessionId) {
    const token = crypto.randomBytes(32).toString('hex');
    this.csrfTokens.set(sessionId, token);
    
    // Clean up old tokens after 1 hour
    setTimeout(() => {
      this.csrfTokens.delete(sessionId);
    }, 60 * 60 * 1000);
    
    return token;
  }

  /**
   * IP address validation middleware
   * Validates that request comes from expected IP address
   */
  validateIpAddress() {
    return (req, res, next) => {
      try {
        // Get client IP address
        const clientIp = this.getClientIp(req);
        
        // Get session IP address
        const sessionIp = req.session?.deviceInfo?.ipAddress;
        
        if (!sessionIp) {
          // No IP stored in session, allow but log
          console.warn('No IP address stored in session');
          return next();
        }

        // Compare IPs (allow if same or if behind proxy)
        if (clientIp !== sessionIp) {
          console.warn(`IP address mismatch: session=${sessionIp}, request=${clientIp}`);
          
          // In strict mode, reject the request
          if (process.env.STRICT_IP_VALIDATION === 'true') {
            return res.status(403).json({
              success: false,
              message: 'IP address validation failed',
              error: 'IP_MISMATCH'
            });
          }
          
          // Otherwise, just log and continue
        }

        next();
      } catch (error) {
        console.error('IP validation error:', error);
        next(); // Don't block on validation errors
      }
    };
  }

  /**
   * Device fingerprinting middleware
   * Validates device fingerprint matches session
   */
  validateDeviceFingerprint() {
    return (req, res, next) => {
      try {
        // Get device fingerprint from header
        const deviceFingerprint = req.headers['x-device-fingerprint'];
        
        if (!deviceFingerprint) {
          // No fingerprint provided, allow but log
          console.warn('No device fingerprint provided');
          return next();
        }

        // Get session device ID
        const sessionDeviceId = req.session?.deviceInfo?.deviceId;
        
        if (!sessionDeviceId) {
          // No device ID in session, allow
          return next();
        }

        // Compare fingerprints
        if (deviceFingerprint !== sessionDeviceId) {
          console.warn(`Device fingerprint mismatch: session=${sessionDeviceId}, request=${deviceFingerprint}`);
          
          // In strict mode, reject the request
          if (process.env.STRICT_DEVICE_VALIDATION === 'true') {
            return res.status(403).json({
              success: false,
              message: 'Device validation failed',
              error: 'DEVICE_MISMATCH'
            });
          }
        }

        next();
      } catch (error) {
        console.error('Device fingerprint validation error:', error);
        next(); // Don't block on validation errors
      }
    };
  }

  /**
   * Rate limiting middleware
   * Limits number of requests per time window
   */
  rateLimit(options = {}) {
    const {
      windowMs = 15 * 60 * 1000, // 15 minutes
      maxRequests = 100,
      keyGenerator = (req) => req.user?.id || this.getClientIp(req)
    } = options;

    return (req, res, next) => {
      try {
        const key = keyGenerator(req);
        const now = Date.now();
        
        // Get or create rate limit entry
        let entry = this.rateLimitStore.get(key);
        if (!entry || now - entry.resetTime > windowMs) {
          entry = {
            count: 0,
            resetTime: now + windowMs
          };
          this.rateLimitStore.set(key, entry);
        }

        // Increment request count
        entry.count++;

        // Check if limit exceeded
        if (entry.count > maxRequests) {
          const retryAfter = Math.ceil((entry.resetTime - now) / 1000);
          
          res.set('Retry-After', retryAfter);
          return res.status(429).json({
            success: false,
            message: 'Too many requests',
            error: 'RATE_LIMIT_EXCEEDED',
            retryAfter
          });
        }

        // Set rate limit headers
        res.set({
          'X-RateLimit-Limit': maxRequests,
          'X-RateLimit-Remaining': Math.max(0, maxRequests - entry.count),
          'X-RateLimit-Reset': new Date(entry.resetTime).toISOString()
        });

        next();
      } catch (error) {
        console.error('Rate limiting error:', error);
        next(); // Don't block on rate limiting errors
      }
    };
  }

  /**
   * Session timeout warning middleware
   * Adds session timeout info to response headers
   */
  addSessionTimeoutHeaders() {
    return async (req, res, next) => {
      try {
        if (req.sessionId) {
          const status = await this.sessionService.getSessionStatus(req.sessionId);
          
          if (status.exists) {
            res.set({
              'X-Session-Expires-In': Math.floor(status.expiresIn / 1000), // seconds
              'X-Session-Expires-At': status.expiresAt.toISOString(),
              'X-Session-Warning': status.isExpiringSoon ? 'true' : 'false'
            });
          }
        }
        
        next();
      } catch (error) {
        console.error('Error adding session timeout headers:', error);
        next(); // Don't block on header errors
      }
    };
  }

  /**
   * Get client IP address from request
   * @param {Object} req - Express request object
   * @returns {string} Client IP address
   * @private
   */
  getClientIp(req) {
    // Check for proxy headers
    const forwarded = req.headers['x-forwarded-for'];
    if (forwarded) {
      return forwarded.split(',')[0].trim();
    }
    
    const realIp = req.headers['x-real-ip'];
    if (realIp) {
      return realIp;
    }
    
    return req.ip || req.connection.remoteAddress || 'unknown';
  }

  /**
   * Clean up expired CSRF tokens and rate limit entries
   * Should be called periodically
   */
  cleanup() {
    const now = Date.now();
    
    // Clean up rate limit entries
    for (const [key, entry] of this.rateLimitStore.entries()) {
      if (now > entry.resetTime) {
        this.rateLimitStore.delete(key);
      }
    }
    
    console.log('Session middleware cleanup completed');
  }
}

// Create singleton instance
const sessionMiddleware = new SessionMiddleware();

// Export middleware functions
module.exports = {
  validateSession: sessionMiddleware.validateSession.bind(sessionMiddleware),
  trackActivity: sessionMiddleware.trackActivity.bind(sessionMiddleware),
  csrfProtection: sessionMiddleware.csrfProtection.bind(sessionMiddleware),
  validateIpAddress: sessionMiddleware.validateIpAddress.bind(sessionMiddleware),
  validateDeviceFingerprint: sessionMiddleware.validateDeviceFingerprint.bind(sessionMiddleware),
  rateLimit: sessionMiddleware.rateLimit.bind(sessionMiddleware),
  addSessionTimeoutHeaders: sessionMiddleware.addSessionTimeoutHeaders.bind(sessionMiddleware),
  generateCsrfToken: sessionMiddleware.generateCsrfToken.bind(sessionMiddleware),
  cleanup: sessionMiddleware.cleanup.bind(sessionMiddleware),
  SessionMiddleware
};
