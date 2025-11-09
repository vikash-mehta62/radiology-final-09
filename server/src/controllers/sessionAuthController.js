const bcrypt = require('bcryptjs');
const User = require('../models/User');
const SessionService = require('../services/session-service');

const sessionService = new SessionService();

/**
 * Session-based Authentication Controller
 * Integrates with SessionService for enhanced session management
 */

/**
 * Login with session management
 * Creates a new session and returns tokens
 */
exports.loginWithSession = async (req, res) => {
  try {
    const { username, password, email } = req.body;
    
    // Validate input
    if ((!username && !email) || !password) {
      return res.status(400).json({ 
        success: false, 
        message: 'Username/email and password required' 
      });
    }

    // Find user by username or email
    const query = username ? { username } : { email };
    const user = await User.findOne(query);
    
    if (!user || !user.isActive) {
      return res.status(401).json({ 
        success: false, 
        message: 'Invalid credentials' 
      });
    }

    // Verify password
    const passwordValid = await bcrypt.compare(password, user.passwordHash);
    if (!passwordValid) {
      return res.status(401).json({ 
        success: false, 
        message: 'Invalid credentials' 
      });
    }

    // Get device information
    const deviceInfo = {
      userAgent: req.headers['user-agent'],
      ipAddress: getClientIp(req),
      deviceId: req.headers['x-device-fingerprint'],
      location: req.headers['x-user-location']
    };

    // Create session
    const session = await sessionService.createSession(user._id.toString(), deviceInfo);

    // Determine primary role for frontend routing
    const primaryRole = user.getPrimaryRole();

    console.log(`✅ User logged in with session: ${user.username} (${primaryRole})`);

    return res.json({
      success: true,
      accessToken: session.accessToken,
      refreshToken: session.refreshToken,
      sessionId: session.sessionId,
      expiresAt: session.expiresAt,
      user: session.user,
      role: primaryRole
    });
  } catch (error) {
    console.error('Login with session error:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Server error during login' 
    });
  }
};

/**
 * Logout with session revocation
 */
exports.logoutWithSession = async (req, res) => {
  try {
    const sessionId = req.sessionId;

    if (!sessionId) {
      return res.status(400).json({
        success: false,
        message: 'No active session found'
      });
    }

    await sessionService.revokeSession(sessionId, 'User logout');

    return res.json({ 
      success: true,
      message: 'Logged out successfully'
    });
  } catch (error) {
    console.error('Logout with session error:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Server error during logout' 
    });
  }
};

/**
 * Get current user with session validation
 */
exports.getCurrentUser = async (req, res) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'User not authenticated'
      });
    }

    const user = await User.findById(userId);
    if (!user || !user.isActive) {
      return res.status(404).json({ 
        success: false, 
        message: 'User not found or inactive' 
      });
    }

    return res.json({ 
      success: true, 
      user: user.toPublicJSON() 
    });
  } catch (error) {
    console.error('Get current user error:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Server error' 
    });
  }
};

/**
 * Helper function to get client IP address
 */
function getClientIp(req) {
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
