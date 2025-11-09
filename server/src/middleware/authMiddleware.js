const jwt = require('jsonwebtoken');

/**
 * Authentication Middleware
 * Validates JWT tokens and attaches user information to request
 * 
 * SECURITY: JWT_SECRET environment variable is REQUIRED in production
 */
function authenticate(req, res, next) {
  // Check for JWT_SECRET in production
  if (process.env.NODE_ENV === 'production' && !process.env.JWT_SECRET) {
    console.error('CRITICAL: JWT_SECRET not set in production environment');
    return res.status(500).json({ 
      success: false, 
      message: 'Server configuration error' 
    });
  }

  // Extract authorization header
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) {
    return res.status(401).json({ 
      success: false, 
      message: 'Missing or invalid Authorization header',
      error: 'UNAUTHORIZED'
    });
  }

  // Extract token
  const token = auth.substring('Bearer '.length);
  
  try {
    // Verify token (use dev_secret only in development)
    const secret = process.env.JWT_SECRET || (process.env.NODE_ENV === 'development' ? 'dev_secret' : null);
    
    if (!secret) {
      throw new Error('JWT_SECRET not configured');
    }

    const payload = jwt.verify(token, secret);
    
    // Attach user to request
    req.user = payload;
    console.log(payload,"PAYLOAD")
    
    // Log authentication for audit trail
    // if (process.env.ENABLE_AUTH_LOGGING === 'true') {
    //   console.log('Authenticated user:', {
    //     userId: payload.id || payload.userId,
    //     username: payload.username,
    //     timestamp: new Date().toISOString()
    //   });
    // }
    
    next();
  } catch (e) {
    console.log(e,"ERROR AUTH")
    // Handle speci
    // fic JWT errors
    let message = 'Invalid or expired token';
    let error = 'INVALID_TOKEN';

    if (e.name === 'TokenExpiredError') {
      message = 'Token has expired';
      error = 'TOKEN_EXPIRED';
    } else if (e.name === 'JsonWebTokenError') {
      message = 'Invalid token format';
      error = 'INVALID_TOKEN_FORMAT';
    } else if (e.name === 'NotBeforeError') {
      message = 'Token not yet valid';
      error = 'TOKEN_NOT_ACTIVE';
    }

    return res.status(401).json({ 
      success: false, 
      message,
      error
    });
  }
}

/**
 * Role-based Authorization Middleware
 * Checks if authenticated user has one of the required roles
 * 
 * @param {Array<string>} allowedRoles - Array of role strings that are allowed
 * @returns {Function} Express middleware function
 */
function requireRole(allowedRoles) {
  return (req, res, next) => {
    // Ensure user is authenticated first
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
        error: 'UNAUTHORIZED'
      });
    }

    // Check if user has any of the allowed roles
    const userRole = req.user.role;
    
    if (!userRole || !allowedRoles.includes(userRole)) {
      return res.status(403).json({
        success: false,
        message: 'Insufficient permissions',
        error: 'FORBIDDEN',
        requiredRoles: allowedRoles
      });
    }

    next();
  };
}

module.exports = {
  authenticate,
  requireRole
};