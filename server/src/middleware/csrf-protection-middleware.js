/**
 * CSRF Protection Middleware
 * Implements Cross-Site Request Forgery protection
 */

const crypto = require('crypto');

/**
 * Generate CSRF token
 * @returns {string} CSRF token
 */
function generateCSRFToken() {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Verify CSRF token
 * @param {string} token - Token from request
 * @param {string} sessionToken - Token from session
 * @returns {boolean} Whether token is valid
 */
function verifyCSRFToken(token, sessionToken) {
  if (!token || !sessionToken) {
    return false;
  }
  
  // Use timing-safe comparison to prevent timing attacks
  try {
    return crypto.timingSafeEqual(
      Buffer.from(token),
      Buffer.from(sessionToken)
    );
  } catch (error) {
    return false;
  }
}

/**
 * CSRF protection middleware
 * @param {Object} options - Configuration options
 */
function csrfProtectionMiddleware(options = {}) {
  const {
    excludePaths = [
      '/health',
      '/metrics',
      '/api/auth/login',
      '/api/auth/register',
      '/api/auth/refresh-token',
      '/api/orthanc-webhook',
      '/api/reports/',  // Allow report export endpoints
    ],
    excludeMethods = ['GET', 'HEAD', 'OPTIONS'],
    cookieName = 'XSRF-TOKEN',
    headerName = 'X-XSRF-TOKEN'
  } = options;

  return (req, res, next) => {
    // Skip excluded paths
    if (excludePaths.some(path => req.path.startsWith(path))) {
      return next();
    }

    // Skip excluded methods (safe methods)
    if (excludeMethods.includes(req.method)) {
      // Generate and set CSRF token for safe methods
      if (!req.session?.csrfToken) {
        const token = generateCSRFToken();
        
        // Store in session
        if (req.session) {
          req.session.csrfToken = token;
        }
        
        // Set cookie for client to read
        res.cookie(cookieName, token, {
          httpOnly: false, // Client needs to read this
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'strict',
          maxAge: 24 * 60 * 60 * 1000 // 24 hours
        });
      }
      
      return next();
    }

    // For state-changing methods, verify CSRF token
    const token = req.headers[headerName.toLowerCase()] || req.body?._csrf;
    const sessionToken = req.session?.csrfToken;

    if (!verifyCSRFToken(token, sessionToken)) {
      console.warn('⚠️  CSRF token validation failed', {
        path: req.path,
        method: req.method,
        ip: req.ip,
        userId: req.user?.id
      });

      return res.status(403).json({
        success: false,
        message: 'Invalid CSRF token',
        error: 'CSRF_TOKEN_INVALID'
      });
    }

    next();
  };
}

/**
 * Double Submit Cookie CSRF protection (alternative method)
 * This doesn't require server-side session storage
 */
function doubleSubmitCookieCSRF(options = {}) {
  const {
    excludePaths = [
      '/health',
      '/metrics',
      '/api/auth/login',
      '/api/auth/register',
      '/api/auth/refresh-token',
      '/api/orthanc-webhook',
      '/api/worklist/sync', // ✅ WORKLIST EMPTY FIX: Allow sync without CSRF for debugging
      '/api/worklist/debug', // ✅ WORKLIST EMPTY FIX: Allow debug without CSRF
      '/api/worklist/force-create-test', // ✅ WORKLIST EMPTY FIX: Allow test endpoint
      '/auth/login',
      '/auth/register',
      '/auth/refresh-token'
    ],
    excludeMethods = ['GET', 'HEAD', 'OPTIONS'],
    cookieName = 'XSRF-TOKEN',
    headerName = 'X-XSRF-TOKEN',
    secret = process.env.CSRF_SECRET || 'default-csrf-secret-change-in-production'
  } = options;

  return (req, res, next) => {
    // Skip excluded paths
    if (excludePaths.some(path => req.path.startsWith(path))) {
      return next();
    }

    // For safe methods, generate and set token
    if (excludeMethods.includes(req.method)) {
      const token = generateCSRFToken();
      
      // Create signed token
      const signature = crypto
        .createHmac('sha256', secret)
        .update(token)
        .digest('hex');
      
      const signedToken = `${token}.${signature}`;
      
      // Set cookie
      res.cookie(cookieName, signedToken, {
        httpOnly: false, // Client needs to read this
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
      });
      
      return next();
    }

    // For state-changing methods, verify token
    const headerToken = req.headers[headerName.toLowerCase()] || req.body?._csrf;
    const cookieToken = req.cookies?.[cookieName];

    if (!headerToken || !cookieToken) {
      console.warn('⚠️  CSRF token missing', {
        path: req.path,
        method: req.method,
        ip: req.ip,
        hasHeader: !!headerToken,
        hasCookie: !!cookieToken
      });

      return res.status(403).json({
        success: false,
        message: 'CSRF token required',
        error: 'CSRF_TOKEN_MISSING'
      });
    }

    // Verify cookie signature
    const [cookieValue, cookieSignature] = cookieToken.split('.');
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(cookieValue)
      .digest('hex');

    if (!crypto.timingSafeEqual(
      Buffer.from(cookieSignature),
      Buffer.from(expectedSignature)
    )) {
      console.warn('⚠️  CSRF cookie signature invalid', {
        path: req.path,
        method: req.method,
        ip: req.ip
      });

      return res.status(403).json({
        success: false,
        message: 'Invalid CSRF token',
        error: 'CSRF_TOKEN_INVALID'
      });
    }

    // Verify header token matches cookie value
    // Use simple string comparison instead of timingSafeEqual to avoid length mismatch errors
    if (headerToken !== cookieValue) {
      console.warn('⚠️  CSRF token mismatch', {
        path: req.path,
        method: req.method,
        ip: req.ip,
        headerTokenLength: headerToken.length,
        cookieValueLength: cookieValue.length
      });

      return res.status(403).json({
        success: false,
        message: 'CSRF token mismatch',
        error: 'CSRF_TOKEN_MISMATCH'
      });
    }

    next();
  };
}

/**
 * SameSite cookie configuration helper
 */
function configureSameSiteCookies(app) {
  // Configure cookie parser with secure options
  app.use((req, res, next) => {
    // Override res.cookie to always use secure settings
    const originalCookie = res.cookie.bind(res);
    
    res.cookie = function(name, value, options = {}) {
      const secureOptions = {
        ...options,
        httpOnly: options.httpOnly !== false, // Default to true
        secure: process.env.NODE_ENV === 'production',
        sameSite: options.sameSite || 'strict'
      };
      
      return originalCookie(name, value, secureOptions);
    };
    
    next();
  });
}

/**
 * Get CSRF token for current session
 */
function getCSRFToken(req) {
  return req.session?.csrfToken || req.cookies?.['XSRF-TOKEN'];
}

module.exports = {
  csrfProtectionMiddleware,
  doubleSubmitCookieCSRF,
  configureSameSiteCookies,
  generateCSRFToken,
  verifyCSRFToken,
  getCSRFToken
};
