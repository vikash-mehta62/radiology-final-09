const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const mongoose = require('mongoose');
const Session = require('../models/Session');
const User = require('../models/User');

/**
 * Session Service
 * Manages user authentication sessions with JWT tokens
 * Implements session timeout, token refresh, and concurrent session limits
 */
class SessionService {
  constructor() {
    // Session configuration
    this.ACCESS_TOKEN_EXPIRY = 30 * 60; // 30 minutes in seconds
    this.REFRESH_TOKEN_EXPIRY = 7 * 24 * 60 * 60; // 7 days in seconds
    this.SESSION_TIMEOUT = 30 * 60 * 1000; // 30 minutes in milliseconds
    this.MAX_CONCURRENT_SESSIONS = 3;
    
    // JWT secrets
    this.jwtSecret = process.env.JWT_SECRET || 'dev_secret';
    this.jwtRefreshSecret = process.env.JWT_REFRESH_SECRET || 'dev_refresh_secret';
    
    // Warn if using default secrets in production
    if (process.env.NODE_ENV === 'production') {
      if (!process.env.JWT_SECRET || !process.env.JWT_REFRESH_SECRET) {
        console.error('WARNING: Using default JWT secrets in production! Set JWT_SECRET and JWT_REFRESH_SECRET environment variables.');
      }
    }
  }

  /**
   * Create a new session for a user
   * @param {string} userId - User ID
   * @param {Object} deviceInfo - Device information (userAgent, ipAddress, deviceId, location)
   * @returns {Promise<Object>} Session with tokens
   */
  async createSession(userId, deviceInfo = {}) {
    try {
      // Enforce concurrent session limit
      await this.enforceSessionLimit(userId);
      
      // Generate session ID
      const sessionId = this.generateSessionId();
      
      // Get user details for token payload
      const user = await User.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }
      
      // Generate tokens
      const accessToken = this.generateAccessToken(userId, sessionId.toString(), user.roles);
      const refreshToken = this.generateRefreshToken(userId, sessionId.toString());
      
      // Calculate expiration
      const expiresAt = new Date(Date.now() + this.REFRESH_TOKEN_EXPIRY * 1000);
      
      // Create session record
      const session = new Session({
        _id: sessionId,
        userId,
        accessToken,
        refreshToken,
        deviceInfo: {
          userAgent: deviceInfo.userAgent || 'Unknown',
          ipAddress: deviceInfo.ipAddress || 'Unknown',
          deviceId: deviceInfo.deviceId || this.generateDeviceId(deviceInfo),
          location: deviceInfo.location
        },
        lastActivity: new Date(),
        expiresAt,
        status: 'active'
      });
      
      await session.save();
      
      // Update user's last login
      user.lastLogin = new Date();
      await user.save();
      
      console.log(`Session created for user ${userId} (${user.username})`);
      
      return {
        sessionId: session._id.toString(),
        accessToken,
        refreshToken,
        expiresAt,
        user: user.toPublicJSON()
      };
    } catch (error) {
      console.error('Error creating session:', error);
      throw error;
    }
  }

  /**
   * Refresh access token using refresh token
   * @param {string} refreshToken - Refresh token
   * @returns {Promise<Object>} New access token and session info
   */
  async refreshAccessToken(refreshToken) {
    try {
      // Verify refresh token
      const payload = this.verifyRefreshToken(refreshToken);
      
      // Get session
      const session = await Session.findById(payload.sessionId);
      if (!session) {
        throw new Error('Session not found');
      }
      
      // Validate session
      if (session.status !== 'active') {
        throw new Error('Session is not active');
      }
      
      if (session.expiresAt < new Date()) {
        await session.expire();
        throw new Error('Session has expired');
      }
      
      // Check for inactivity timeout
      if (session.isInactive(this.SESSION_TIMEOUT)) {
        await session.expire();
        throw new Error('Session timed out due to inactivity');
      }
      
      // Verify refresh token matches
      if (session.refreshToken !== refreshToken) {
        throw new Error('Invalid refresh token');
      }
      
      // Get user details
      const user = await User.findById(session.userId);
      if (!user || !user.isActive) {
        throw new Error('User not found or inactive');
      }
      
      // Generate new access token
      const newAccessToken = this.generateAccessToken(
        session.userId.toString(),
        session._id.toString(),
        user.roles
      );
      
      // Update session
      session.accessToken = newAccessToken;
      session.lastActivity = new Date();
      await session.save();
      
      console.log(`Access token refreshed for user ${session.userId}`);
      
      return {
        accessToken: newAccessToken,
        expiresIn: this.ACCESS_TOKEN_EXPIRY,
        sessionId: session._id.toString()
      };
    } catch (error) {
      console.error('Error refreshing token:', error);
      throw error;
    }
  }

  /**
   * Validate session and access token
   * @param {string} accessToken - Access token
   * @returns {Promise<Object>} Session and user info
   */
  async validateSession(accessToken) {
    try {
      // Verify access token
      const payload = this.verifyAccessToken(accessToken);
      
      // Get session
      const session = await Session.findById(payload.sessionId).populate('userId');
      if (!session) {
        return { valid: false, reason: 'Session not found' };
      }
      
      // Check session status
      if (session.status !== 'active') {
        return { valid: false, reason: 'Session is not active' };
      }
      
      // Check expiration
      if (session.expiresAt < new Date()) {
        await session.expire();
        return { valid: false, reason: 'Session has expired' };
      }
      
      // Check inactivity timeout
      if (session.isInactive(this.SESSION_TIMEOUT)) {
        await session.expire();
        return { valid: false, reason: 'Session timed out' };
      }
      
      // Check user status
      if (!session.userId || !session.userId.isActive) {
        return { valid: false, reason: 'User not found or inactive' };
      }
      
      // Update last activity
      session.lastActivity = new Date();
      await session.save();
      
      return {
        valid: true,
        session: session.toSafeJSON(),
        user: session.userId.toPublicJSON()
      };
    } catch (error) {
      console.error('Error validating session:', error);
      return { valid: false, reason: error.message };
    }
  }

  /**
   * Revoke a session (logout)
   * @param {string} sessionId - Session ID
   * @param {string} reason - Revocation reason
   * @returns {Promise<boolean>} Success status
   */
  async revokeSession(sessionId, reason = 'User logout') {
    try {
      const session = await Session.findById(sessionId);
      if (!session) {
        throw new Error('Session not found');
      }
      
      await session.revoke(reason);
      console.log(`Session ${sessionId} revoked: ${reason}`);
      
      return true;
    } catch (error) {
      console.error('Error revoking session:', error);
      throw error;
    }
  }

  /**
   * Revoke all sessions for a user
   * @param {string} userId - User ID
   * @param {string} reason - Revocation reason
   * @returns {Promise<number>} Number of sessions revoked
   */
  async revokeAllUserSessions(userId, reason = 'All sessions revoked') {
    try {
      const result = await Session.updateMany(
        { userId, status: 'active' },
        {
          $set: {
            status: 'revoked',
            revokedAt: new Date(),
            revokedReason: reason
          }
        }
      );
      
      console.log(`Revoked ${result.modifiedCount} sessions for user ${userId}`);
      return result.modifiedCount;
    } catch (error) {
      console.error('Error revoking all user sessions:', error);
      throw error;
    }
  }

  /**
   * Get all active sessions for a user
   * @param {string} userId - User ID
   * @returns {Promise<Array>} Array of sessions
   */
  async getUserSessions(userId) {
    try {
      const sessions = await Session.find({
        userId,
        status: 'active',
        expiresAt: { $gt: new Date() }
      }).sort({ lastActivity: -1 });
      
      return sessions.map(session => session.toSafeJSON());
    } catch (error) {
      console.error('Error getting user sessions:', error);
      throw error;
    }
  }

  /**
   * Extend session expiration
   * @param {string} sessionId - Session ID
   * @param {number} extensionSeconds - Extension time in seconds (default: 30 minutes)
   * @returns {Promise<Object>} Updated session info
   */
  async extendSession(sessionId, extensionSeconds = 30 * 60) {
    try {
      const session = await Session.findById(sessionId);
      if (!session) {
        throw new Error('Session not found');
      }
      
      if (session.status !== 'active') {
        throw new Error('Cannot extend inactive session');
      }
      
      // Extend expiration
      const newExpiry = new Date(Date.now() + extensionSeconds * 1000);
      session.expiresAt = newExpiry;
      session.lastActivity = new Date();
      await session.save();
      
      console.log(`Session ${sessionId} extended until ${newExpiry}`);
      
      return {
        sessionId: session._id.toString(),
        expiresAt: newExpiry,
        expiresIn: extensionSeconds
      };
    } catch (error) {
      console.error('Error extending session:', error);
      throw error;
    }
  }

  /**
   * Get session status
   * @param {string} sessionId - Session ID
   * @returns {Promise<Object>} Session status info
   */
  async getSessionStatus(sessionId) {
    try {
      const session = await Session.findById(sessionId);
      if (!session) {
        return {
          exists: false,
          status: 'not_found'
        };
      }
      
      const now = Date.now();
      const expiresIn = session.expiresAt.getTime() - now;
      const inactiveTime = now - session.lastActivity.getTime();
      
      return {
        exists: true,
        status: session.status,
        expiresIn: Math.max(0, expiresIn),
        expiresAt: session.expiresAt,
        lastActivity: session.lastActivity,
        inactiveTime,
        isExpiringSoon: expiresIn < 5 * 60 * 1000, // Less than 5 minutes
        isInactive: inactiveTime > this.SESSION_TIMEOUT
      };
    } catch (error) {
      console.error('Error getting session status:', error);
      throw error;
    }
  }

  /**
   * Clean up expired sessions
   * @returns {Promise<number>} Number of sessions cleaned up
   */
  async cleanupExpiredSessions() {
    try {
      const result = await Session.updateMany(
        {
          status: 'active',
          expiresAt: { $lt: new Date() }
        },
        {
          $set: { status: 'expired' }
        }
      );
      
      if (result.modifiedCount > 0) {
        console.log(`Cleaned up ${result.modifiedCount} expired sessions`);
      }
      
      return result.modifiedCount;
    } catch (error) {
      console.error('Error cleaning up expired sessions:', error);
      throw error;
    }
  }

  /**
   * Enforce concurrent session limit for a user
   * @param {string} userId - User ID
   * @private
   */
  async enforceSessionLimit(userId) {
    try {
      const activeSessions = await Session.find({
        userId,
        status: 'active',
        expiresAt: { $gt: new Date() }
      }).sort({ lastActivity: -1 });
      
      // If at or over limit, revoke oldest sessions
      if (activeSessions.length >= this.MAX_CONCURRENT_SESSIONS) {
        const sessionsToRevoke = activeSessions.slice(this.MAX_CONCURRENT_SESSIONS - 1);
        
        for (const session of sessionsToRevoke) {
          await session.revoke('Concurrent session limit exceeded');
        }
        
        console.log(`Revoked ${sessionsToRevoke.length} sessions for user ${userId} due to concurrent session limit`);
      }
    } catch (error) {
      console.error('Error enforcing session limit:', error);
      // Don't throw - allow session creation to continue
    }
  }

  /**
   * Generate access token (JWT)
   * @param {string} userId - User ID
   * @param {string} sessionId - Session ID
   * @param {Array} roles - User roles
   * @returns {string} JWT access token
   * @private
   */
  generateAccessToken(userId, sessionId, roles = []) {
    return jwt.sign(
      {
        userId,
        sessionId,
        roles,
        type: 'access'
      },
      this.jwtSecret,
      { expiresIn: this.ACCESS_TOKEN_EXPIRY }
    );
  }

  /**
   * Generate refresh token (JWT)
   * @param {string} userId - User ID
   * @param {string} sessionId - Session ID
   * @returns {string} JWT refresh token
   * @private
   */
  generateRefreshToken(userId, sessionId) {
    return jwt.sign(
      {
        userId,
        sessionId,
        type: 'refresh'
      },
      this.jwtRefreshSecret,
      { expiresIn: this.REFRESH_TOKEN_EXPIRY }
    );
  }

  /**
   * Verify access token
   * @param {string} token - Access token
   * @returns {Object} Token payload
   * @private
   */
  verifyAccessToken(token) {
    try {
      return jwt.verify(token, this.jwtSecret);
    } catch (error) {
      throw new Error(`Invalid access token: ${error.message}`);
    }
  }

  /**
   * Verify refresh token
   * @param {string} token - Refresh token
   * @returns {Object} Token payload
   * @private
   */
  verifyRefreshToken(token) {
    try {
      return jwt.verify(token, this.jwtRefreshSecret);
    } catch (error) {
      throw new Error(`Invalid refresh token: ${error.message}`);
    }
  }

  /**
   * Generate unique session ID
   * @returns {string} Session ID
   * @private
   */
  generateSessionId() {
    return new mongoose.Types.ObjectId();
  }

  /**
   * Generate device ID from device info
   * @param {Object} deviceInfo - Device information
   * @returns {string} Device ID
   * @private
   */
  generateDeviceId(deviceInfo) {
    const data = `${deviceInfo.userAgent || ''}${deviceInfo.ipAddress || ''}`;
    return crypto.createHash('sha256').update(data).digest('hex').substring(0, 16);
  }
}

module.exports = SessionService;
