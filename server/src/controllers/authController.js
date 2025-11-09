const jwt = require('jsonwebtoken')
const bcrypt = require('bcryptjs')
const User = require('../models/User')

const ACCESS_TOKEN_EXPIRES_IN = '30m'
const REFRESH_TOKEN_EXPIRES_IN = '7d'
const COOKIE_NAME = 'refresh_token'

function signAccessToken(user) {
  const payload = {
    sub: user.id,
    username: user.username,
    roles: user.roles,
    permissions: user.permissions,
    // Convert ObjectId to string for JWT
    hospitalId: user.id ? user.id.toString() : null,
  }
  return jwt.sign(payload, process.env.JWT_SECRET || 'dev_secret', { expiresIn: ACCESS_TOKEN_EXPIRES_IN })
}

function signRefreshToken(user) {
  const payload = { sub: user.id }
  return jwt.sign(payload, process.env.JWT_REFRESH_SECRET || 'dev_refresh_secret', { expiresIn: REFRESH_TOKEN_EXPIRES_IN })
}

function setRefreshCookie(res, token) {
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    secure: false, // set true in production with HTTPS
    sameSite: 'lax',
    path: '/auth',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  })
}

exports.login = async (req, res) => {
  try {
    const { username, password, email } = req.body
    
    // Allow login with either username or email
    if ((!username && !email) || !password) {
      return res.status(400).json({ 
        success: false, 
        message: 'Username/email and password required' 
      })
    }

    // Find user by username or email
    const query = username ? { username } : { email }
    const user = await User.findOne(query)
    
    if (!user || !user.isActive) {
      return res.status(401).json({ 
        success: false, 
        message: 'Invalid credentials' 
      })
    }

    const ok = await bcrypt.compare(password, user.passwordHash)
    if (!ok) {
      return res.status(401).json({ 
        success: false, 
        message: 'Invalid credentials' 
      })
    }

    const userPublic = user.toPublicJSON()
    const accessToken = signAccessToken(userPublic)
    const refreshToken = signRefreshToken(userPublic)

    setRefreshCookie(res, refreshToken)

    user.lastLogin = new Date()
    await user.save()

    // Determine primary role for frontend routing
    const primaryRole = user.getPrimaryRole()

    console.log(`✅ User logged in: ${user.username} (${primaryRole})`)

    return res.json({
      success: true,
      accessToken,
      refreshToken,
      user: userPublic,
      role: primaryRole, // Primary role for routing
      // Convert ObjectId to string for response
      hospitalId: user._id ? user._id.toString() : null
    })
  } catch (err) {
    console.error('Login error:', err)
    return res.status(500).json({ 
      success: false, 
      message: 'Server error' 
    })
  }
}

exports.logout = async (req, res) => {
  try {
    res.clearCookie(COOKIE_NAME, { path: '/auth' })
    return res.json({ success: true })
  } catch (err) {
    console.error('Logout error:', err)
    return res.status(500).json({ success: false, message: 'Server error' })
  }
}

exports.refresh = async (req, res) => {
  try {
    const token = req.cookies[COOKIE_NAME] || req.body.refreshToken
    if (!token) {
      return res.status(401).json({ success: false, message: 'No refresh token' })
    }

    let payload
    try {
      payload = jwt.verify(token, process.env.JWT_REFRESH_SECRET || 'dev_refresh_secret')
    } catch (e) {
      return res.status(401).json({ success: false, message: 'Invalid refresh token' })
    }

    const user = await User.findById(payload.sub)
    if (!user || !user.isActive) {
      return res.status(401).json({ success: false, message: 'User not found' })
    }

    const accessToken = signAccessToken(user.toPublicJSON())
    const newRefreshToken = signRefreshToken(user.toPublicJSON())
    setRefreshCookie(res, newRefreshToken)

    return res.json({
      success: true,
      accessToken,
      refreshToken: newRefreshToken,
      user: user.toPublicJSON(),
    })
  } catch (err) {
    console.error('Refresh error:', err)
    return res.status(500).json({ success: false, message: 'Server error' })
  }
}

exports.me = async (req, res) => {
  try {
    const user = await User.findById(req.user.sub)
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' })
    }
    return res.json({ success: true, data: user.toPublicJSON() })
  } catch (err) {
    console.error('Me error:', err)
    return res.status(500).json({ success: false, message: 'Server error' })
  }
}