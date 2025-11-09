const auditService = require('../services/audit-service');
const ipRangeCheck = require('ip-range-check');

/**
 * IP Whitelisting Middleware
 * Restricts access based on IP address whitelist
 * Requirements: 12.7
 */

class IPWhitelistMiddleware {
  constructor() {
    // Load IP whitelist from environment or configuration
    this.whitelist = this.loadWhitelist();
    this.enabled = process.env.IP_WHITELIST_ENABLED === 'true';
    this.strictMode = process.env.IP_WHITELIST_STRICT === 'true';
    
    // Paths that require IP whitelisting
    this.protectedPaths = [
      '/api/signatures',
      '/api/export/all',
      '/api/admin',
      '/api/users/create',
      '/api/users/delete'
    ];
  }

  /**
   * Load IP whitelist from environment or configuration
   * @returns {Array<string>} Array of allowed IP addresses/ranges
   * @private
   */
  loadWhitelist() {
    const whitelistEnv = process.env.IP_WHITELIST || '';
    
    if (!whitelistEnv) {
      console.warn('⚠️ IP_WHITELIST not configured. All IPs will be allowed.');
      return [];
    }

    // Parse comma-separated list of IPs and ranges
    const whitelist = whitelistEnv.split(',').map(ip => ip.trim()).filter(ip => ip);
    
    console.log('🔒 IP Whitelist loaded:', whitelist.length, 'entries');
    
    return whitelist;
  }

  /**
   * Get client IP address from request
   * @param {Object} req - Express request object
   * @returns {string} Client IP address
   * @private
   */
  getClientIP(req) {
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
   * Check if IP is in whitelist
   * @param {string} ip - IP address to check
   * @returns {boolean} True if IP is whitelisted
   * @private
   */
  isIPWhitelisted(ip) {
    // If whitelist is empty, allow all (unless strict mode)
    if (this.whitelist.length === 0) {
      return !this.strictMode;
    }

    // Normalize IPv6 localhost to IPv4
    if (ip === '::1' || ip === '::ffff:127.0.0.1') {
      ip = '127.0.0.1';
    }

    // Check exact match first
    if (this.whitelist.includes(ip)) {
      return true;
    }

    // Check IP ranges (CIDR notation)
    try {
      return ipRangeCheck(ip, this.whitelist);
    } catch (error) {
      console.error('❌ Error checking IP range:', error);
      return false;
    }
  }

  /**
   * Check if path requires IP whitelisting
   * @param {string} path - Request path
   * @returns {boolean} True if path is protected
   * @private
   */
  isProtectedPath(path) {
    return this.protectedPaths.some(protectedPath => 
      path.startsWith(protectedPath)
    );
  }

  /**
   * Middleware to enforce IP whitelisting
   * @param {Object} options - Middleware options
   * @returns {Function} Express middleware function
   */
  enforce(options = {}) {
    const {
      protectedPaths = null,
      allowLocalhost = true,
      logDenials = true
    } = options;

    return async (req, res, next) => {
      try {
        // Skip if IP whitelisting is disabled
        if (!this.enabled) {
          return next();
        }

        // Get client IP
        const clientIP = this.getClientIP(req);

        // Allow localhost in development
        if (allowLocalhost && process.env.NODE_ENV === 'development') {
          if (clientIP === '127.0.0.1' || clientIP === 'localhost' || clientIP === '::1') {
            return next();
          }
        }

        // Check if path is protected
        const pathsToCheck = protectedPaths || this.protectedPaths;
        const isProtected = pathsToCheck.some(path => req.path.startsWith(path));

        if (!isProtected) {
          return next();
        }

        // Check if IP is whitelisted
        if (!this.isIPWhitelisted(clientIP)) {
          // Log denial
          if (logDenials) {
            console.warn(`🚫 IP whitelist denial: ${clientIP} attempted to access ${req.path}`);
            
            // Log to audit service
            if (req.user) {
              await auditService.logSecurityEvent(
                'ip_whitelist_denial',
                req.user.id || req.user.userId,
                clientIP,
                'failure',
                `Access denied from non-whitelisted IP: ${clientIP}`
              );
            }
          }

          return res.status(403).json({
            success: false,
            message: 'Access denied. Your IP address is not whitelisted.',
            error: 'IP_NOT_WHITELISTED',
            clientIP: this.strictMode ? undefined : clientIP // Hide IP in strict mode
          });
        }

        // IP is whitelisted, proceed
        next();
      } catch (error) {
        console.error('❌ IP whitelist middleware error:', error);
        
        // In strict mode, deny on errors
        if (this.strictMode) {
          return res.status(403).json({
            success: false,
            message: 'Access denied',
            error: 'IP_WHITELIST_ERROR'
          });
        }
        
        // Otherwise, allow but log error
        next();
      }
    };
  }

  /**
   * Middleware to log IP access (without blocking)
   * @returns {Function} Express middleware function
   */
  logAccess() {
    return (req, res, next) => {
      try {
        const clientIP = this.getClientIP(req);
        const isWhitelisted = this.isIPWhitelisted(clientIP);
        
        // Add IP info to request
        req.clientIP = clientIP;
        req.ipWhitelisted = isWhitelisted;
        
        // Log access for protected paths
        if (this.isProtectedPath(req.path)) {
          console.log(`🔍 IP Access: ${clientIP} -> ${req.path} (whitelisted: ${isWhitelisted})`);
        }
        
        next();
      } catch (error) {
        console.error('❌ IP logging error:', error);
        next(); // Don't block on logging errors
      }
    };
  }

  /**
   * Add IP to whitelist dynamically
   * @param {string} ip - IP address or range to add
   */
  addToWhitelist(ip) {
    if (!this.whitelist.includes(ip)) {
      this.whitelist.push(ip);
      console.log('✅ Added IP to whitelist:', ip);
    }
  }

  /**
   * Remove IP from whitelist dynamically
   * @param {string} ip - IP address or range to remove
   */
  removeFromWhitelist(ip) {
    const index = this.whitelist.indexOf(ip);
    if (index > -1) {
      this.whitelist.splice(index, 1);
      console.log('✅ Removed IP from whitelist:', ip);
    }
  }

  /**
   * Get current whitelist
   * @returns {Array<string>} Current whitelist
   */
  getWhitelist() {
    return [...this.whitelist];
  }

  /**
   * Reload whitelist from environment
   */
  reloadWhitelist() {
    this.whitelist = this.loadWhitelist();
    console.log('🔄 IP whitelist reloaded');
  }
}

// Create singleton instance
const ipWhitelistMiddleware = new IPWhitelistMiddleware();

// Export middleware functions
module.exports = {
  enforce: ipWhitelistMiddleware.enforce.bind(ipWhitelistMiddleware),
  logAccess: ipWhitelistMiddleware.logAccess.bind(ipWhitelistMiddleware),
  addToWhitelist: ipWhitelistMiddleware.addToWhitelist.bind(ipWhitelistMiddleware),
  removeFromWhitelist: ipWhitelistMiddleware.removeFromWhitelist.bind(ipWhitelistMiddleware),
  getWhitelist: ipWhitelistMiddleware.getWhitelist.bind(ipWhitelistMiddleware),
  reloadWhitelist: ipWhitelistMiddleware.reloadWhitelist.bind(ipWhitelistMiddleware),
  IPWhitelistMiddleware
};
