const express = require('express')
const router = express.Router()
const authController = require('../controllers/authController')
const authenticationController = require('../controllers/authenticationController')
const sessionAuthController = require('../controllers/sessionAuthController')
const { authenticate } = require('../middleware/authMiddleware')
const AuthenticationService = require('../services/authentication-service')
const SessionService = require('../services/session-service')
const { validateSession, rateLimit } = require('../middleware/session-middleware')
const bcrypt = require('bcryptjs')
const Counter = require('../models/Counter')
const Hospital = require('../models/Hospital')
const User = require('../models/User')

// Initialize services
const authService = new AuthenticationService()
const sessionService = new SessionService()

// Legacy auth endpoints (keep for backward compatibility)
router.post('/login', authController.login)
router.post('/logout', authController.logout)
router.post('/refresh', authController.refresh)
router.get('/users/me', authenticate, authController.me)

// Session-based auth endpoints (enhanced session management)
router.post('/login-session', rateLimit({ maxRequests: 5, windowMs: 60000 }), sessionAuthController.loginWithSession)
router.post('/logout-session', validateSession(), sessionAuthController.logoutWithSession)
router.get('/me-session', validateSession(), sessionAuthController.getCurrentUser)

// New OAuth2/OIDC and MFA endpoints
router.get('/oauth2/login', authenticationController.initiateOAuth2Login)
router.get('/oauth2/callback', authenticationController.handleOAuth2Callback)
router.post('/local/login', authenticationController.localLogin)
router.post('/mfa/setup', authService.authenticationMiddleware(), authenticationController.setupMFA)
router.post('/mfa/verify', authService.authenticationMiddleware(), authenticationController.verifyMFA)
router.post('/token/refresh', authenticationController.refreshToken)
router.post('/logout/secure', authService.authenticationMiddleware(), authenticationController.logout)
router.get('/user/current', authService.authenticationMiddleware(), authenticationController.getCurrentUser)

// ============================================================================
// Signup: Create Hospital + User (Self-service onboarding)
// ============================================================================

/**
 * POST /auth/register
 * Body: { username, email, password, firstName, lastName, hospitalName }
 * - Generates `hospitalId` like HOS-0001, HOS-0002 ... (sequence)
 * - Creates Hospital (with minimal required fields)
 * - Creates User with default permissions ['studies:read']
 * - Auto-sets fullName = `${firstName} ${lastName}`
 */
router.post('/register', async (req, res) => {
  try {
    const { username, email, password, firstName, lastName, hospitalName } = req.body || {}

    if (!username || !email || !password || !firstName || !lastName || !hospitalName) {
      return res.status(400).json({
        success: false,
        error: 'VALIDATION_ERROR',
        message: 'username, email, password, firstName, lastName, hospitalName are required'
      })
    }

    // Check duplicates
    const existingUser = await User.findOne({ $or: [{ username }, { email }] })
    if (existingUser) {
      return res.status(409).json({
        success: false,
        error: 'USER_EXISTS',
        message: 'Username or email already exists'
      })
    }

    // Generate next hospital sequence atomically
    const counter = await Counter.findOneAndUpdate(
      { name: 'hospital' },
      { $inc: { seq: 1 } },
      { new: true, upsert: true }
    )
    const seqNum = counter.seq || 1
    const padded = String(seqNum).padStart(4, '0')
    const hospitalId = `HOS-${padded}`

    // Create hospital (minimal required fields)
    const apiKey = Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2)
    const hospital = await Hospital.create({
      hospitalId,
      name: hospitalName,
      contactEmail: email,
      status: 'active',
      apiKey
    })

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10)

    // Create user with default permissions and auto fullName
    const user = await User.create({
      username,
      email,
      passwordHash,
      firstName,
      lastName,
      fullName: `${firstName} ${lastName}`.trim(),
      permissions: ['studies:read'],
      hospitalId,
      hospitalName
    })
    // Auto-login: create session and return tokens
    const deviceInfo = {
      userAgent: req.get('user-agent') || 'Unknown',
      ipAddress: req.ip || 'Unknown',
      location: req.headers['x-user-location']
    }
    const session = await sessionService.createSession(user._id.toString(), deviceInfo)

    // Determine primary role for routing
    const primaryRole = user.getPrimaryRole()

    return res.status(201).json({
      success: true,
      message: 'Signup successful',
      accessToken: session.accessToken,
      refreshToken: session.refreshToken,
      sessionId: session.sessionId,
      role: primaryRole,
      user: session.user,
      data: {
        hospital: {
          hospitalId: hospital.hospitalId,
          name: hospital.name,
          status: hospital.status
        }
      }
    })
  } catch (error) {
    console.error('❌ Signup error:', error)
    return res.status(500).json({
      success: false,
      error: 'SIGNUP_FAILED',
      message: error.message || 'Failed to signup'
    })
  }
})

// ============================================================================
// Session Management Endpoints (Production Features)
// ============================================================================

/**
 * POST /api/auth/refresh-token
 * Refresh access token using refresh token
 * Requirements: 10.1-10.12, 11.1-11.10
 */
router.post('/refresh-token', rateLimit({ maxRequests: 10, windowMs: 60000 }), async (req, res) => {
  try {
    const { refreshToken } = req.body

    if (!refreshToken) {
      return res.status(400).json({
        success: false,
        message: 'Refresh token is required',
        error: 'REFRESH_TOKEN_REQUIRED'
      })
    }

    const result = await sessionService.refreshAccessToken(refreshToken)

    return res.json({
      success: true,
      accessToken: result.accessToken,
      expiresIn: result.expiresIn,
      sessionId: result.sessionId
    })
  } catch (error) {
    console.error('Token refresh error:', error)
    
    return res.status(401).json({
      success: false,
      message: error.message || 'Failed to refresh token',
      error: 'TOKEN_REFRESH_FAILED'
    })
  }
})

/**
 * POST /api/auth/logout
 * Logout and revoke current session
 * Requirements: 10.1-10.12
 */
router.post('/logout', validateSession(), async (req, res) => {
  try {
    const sessionId = req.sessionId

    if (!sessionId) {
      return res.status(400).json({
        success: false,
        message: 'No active session found',
        error: 'NO_SESSION'
      })
    }

    await sessionService.revokeSession(sessionId, 'User logout')

    return res.json({
      success: true,
      message: 'Logged out successfully'
    })
  } catch (error) {
    console.error('Logout error:', error)
    
    return res.status(500).json({
      success: false,
      message: 'Failed to logout',
      error: 'LOGOUT_FAILED'
    })
  }
})

/**
 * GET /api/auth/session-status
 * Get current session status and expiration info
 * Requirements: 10.1-10.12, 13.1-13.10
 */
router.get('/session-status', validateSession(), async (req, res) => {
  try {
    const sessionId = req.sessionId

    if (!sessionId) {
      return res.status(400).json({
        success: false,
        message: 'No active session found',
        error: 'NO_SESSION'
      })
    }

    const status = await sessionService.getSessionStatus(sessionId)

    return res.json({
      success: true,
      status: status.status,
      expiresIn: status.expiresIn,
      expiresAt: status.expiresAt,
      lastActivity: status.lastActivity,
      isExpiringSoon: status.isExpiringSoon,
      isInactive: status.isInactive
    })
  } catch (error) {
    console.error('Session status error:', error)
    
    return res.status(500).json({
      success: false,
      message: 'Failed to get session status',
      error: 'SESSION_STATUS_FAILED'
    })
  }
})

/**
 * POST /api/auth/extend-session
 * Extend current session expiration
 * Requirements: 10.1-10.12
 */
router.post('/extend-session', validateSession(), async (req, res) => {
  try {
    const sessionId = req.sessionId
    const { extensionSeconds } = req.body

    if (!sessionId) {
      return res.status(400).json({
        success: false,
        message: 'No active session found',
        error: 'NO_SESSION'
      })
    }

    const result = await sessionService.extendSession(
      sessionId,
      extensionSeconds || 30 * 60 // Default 30 minutes
    )

    return res.json({
      success: true,
      message: 'Session extended successfully',
      sessionId: result.sessionId,
      expiresAt: result.expiresAt,
      expiresIn: result.expiresIn
    })
  } catch (error) {
    console.error('Session extension error:', error)
    
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to extend session',
      error: 'SESSION_EXTENSION_FAILED'
    })
  }
})

/**
 * GET /api/auth/sessions
 * Get all active sessions for current user
 * Requirements: 13.1-13.10
 */
router.get('/sessions', validateSession(), async (req, res) => {
  try {
    const userId = req.user.id

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'User ID not found',
        error: 'USER_ID_REQUIRED'
      })
    }

    const sessions = await sessionService.getUserSessions(userId)

    return res.json({
      success: true,
      sessions,
      count: sessions.length
    })
  } catch (error) {
    console.error('Get sessions error:', error)
    
    return res.status(500).json({
      success: false,
      message: 'Failed to get sessions',
      error: 'GET_SESSIONS_FAILED'
    })
  }
})

/**
 * DELETE /api/auth/sessions/:sessionId
 * Revoke a specific session
 * Requirements: 13.1-13.10
 */
router.delete('/sessions/:sessionId', validateSession(), async (req, res) => {
  try {
    const { sessionId } = req.params
    const userId = req.user.id

    if (!sessionId) {
      return res.status(400).json({
        success: false,
        message: 'Session ID is required',
        error: 'SESSION_ID_REQUIRED'
      })
    }

    // Verify the session belongs to the user
    const sessions = await sessionService.getUserSessions(userId)
    const sessionExists = sessions.some(s => s.id === sessionId)

    if (!sessionExists) {
      return res.status(404).json({
        success: false,
        message: 'Session not found or does not belong to user',
        error: 'SESSION_NOT_FOUND'
      })
    }

    await sessionService.revokeSession(sessionId, 'Revoked by user')

    return res.json({
      success: true,
      message: 'Session revoked successfully'
    })
  } catch (error) {
    console.error('Revoke session error:', error)
    
    return res.status(500).json({
      success: false,
      message: 'Failed to revoke session',
      error: 'REVOKE_SESSION_FAILED'
    })
  }
})

module.exports = router