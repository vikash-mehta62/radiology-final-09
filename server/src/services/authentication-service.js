const passport = require('passport');
const OAuth2Strategy = require('passport-oauth2');
const LocalStrategy = require('passport-local').Strategy;
const speakeasy = require('speakeasy');
const QRCode = require('qrcode');
const geoip = require('geoip-lite');
const rateLimit = require('express-rate-limit');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

class AuthenticationService {
  constructor(config = {}) {
    this.config = {
      oauth2: {
        authorizationURL: config.oauth2?.authorizationURL || process.env.OAUTH2_AUTHORIZATION_URL,
        tokenURL: config.oauth2?.tokenURL || process.env.OAUTH2_TOKEN_URL,
        clientID: config.oauth2?.clientID || process.env.OAUTH2_CLIENT_ID,
        clientSecret: config.oauth2?.clientSecret || process.env.OAUTH2_CLIENT_SECRET,
        callbackURL: config.oauth2?.callbackURL || process.env.OAUTH2_CALLBACK_URL,
        scope: config.oauth2?.scope || ['openid', 'profile', 'email']
      },
      mfa: {
        enabled: config.mfa?.enabled !== false,
        issuer: config.mfa?.issuer || 'Orthanc Bridge',
        window: config.mfa?.window || 2
      },
      ipRestrictions: {
        enabled: config.ipRestrictions?.enabled !== false,
        allowedCountries: config.ipRestrictions?.allowedCountries || ['US', 'CA'],
        allowedIPs: config.ipRestrictions?.allowedIPs || [],
        blockedIPs: config.ipRestrictions?.blockedIPs || []
      },
      jwt: {
        secret: config.jwt?.secret || process.env.JWT_SECRET || 'default-secret',
        expiresIn: config.jwt?.expiresIn || '1h',
        refreshExpiresIn: config.jwt?.refreshExpiresIn || '7d'
      },
      rateLimit: {
        windowMs: config.rateLimit?.windowMs || 15 * 60 * 1000, // 15 minutes
        max: config.rateLimit?.max || 5, // 5 attempts per window
        skipSuccessfulRequests: true
      }
    };

    this.sessions = new Map(); // In-memory session store (use Redis in production)
    this.mfaSecrets = new Map(); // In-memory MFA secrets store (use database in production)
    
    this.initializePassport();
    this.setupRateLimit();
  }

  initializePassport() {
    // OAuth2/OIDC Strategy
    if (this.config.oauth2.clientID && this.config.oauth2.clientSecret) {
      passport.use('oauth2', new OAuth2Strategy({
        authorizationURL: this.config.oauth2.authorizationURL,
        tokenURL: this.config.oauth2.tokenURL,
        clientID: this.config.oauth2.clientID,
        clientSecret: this.config.oauth2.clientSecret,
        callbackURL: this.config.oauth2.callbackURL,
        scope: this.config.oauth2.scope
      }, async (accessToken, refreshToken, profile, done) => {
        try {
          // In a real implementation, you would fetch/create user from database
          const user = await this.processOAuthUser(profile, accessToken);
          return done(null, user);
        } catch (error) {
          return done(error, null);
        }
      }));
    }

    // Local Strategy for fallback authentication
    passport.use('local', new LocalStrategy({
      usernameField: 'username',
      passwordField: 'password'
    }, async (username, password, done) => {
      try {
        const user = await this.authenticateLocalUser(username, password);
        return done(null, user);
      } catch (error) {
        return done(error, null);
      }
    }));

    passport.serializeUser((user, done) => {
      done(null, user.id);
    });

    passport.deserializeUser(async (id, done) => {
      try {
        const user = await this.getUserById(id);
        done(null, user);
      } catch (error) {
        done(error, null);
      }
    });
  }

  setupRateLimit() {
    this.loginRateLimit = rateLimit({
      windowMs: this.config.rateLimit.windowMs,
      max: this.config.rateLimit.max,
      message: {
        error: 'Too many login attempts, please try again later',
        retryAfter: Math.ceil(this.config.rateLimit.windowMs / 1000)
      },
      standardHeaders: true,
      legacyHeaders: false,
      skipSuccessfulRequests: this.config.rateLimit.skipSuccessfulRequests
    });
  }

  async processOAuthUser(profile, accessToken) {
    // Extract user information from OAuth profile
    const user = {
      id: profile.id || profile.sub,
      username: profile.username || profile.preferred_username,
      email: profile.email || profile.emails?.[0]?.value,
      name: profile.displayName || profile.name,
      provider: 'oauth2',
      accessToken,
      roles: ['user'], // Default role, should be determined by your business logic
      mfaEnabled: false,
      lastLogin: new Date()
    };

    // Store user session
    this.sessions.set(user.id, {
      ...user,
      sessionId: uuidv4(),
      createdAt: new Date(),
      lastActivity: new Date()
    });

    return user;
  }

  async authenticateLocalUser(username, password) {
    // In a real implementation, fetch user from database
    // This is a placeholder implementation
    const users = [
      {
        id: 'admin',
        username: 'admin',
        password: await bcrypt.hash('admin123', 10), // Should be stored hashed in DB
        email: 'admin@example.com',
        roles: ['admin'],
        mfaEnabled: true
      }
    ];

    const user = users.find(u => u.username === username);
    if (!user) {
      throw new Error('Invalid credentials');
    }

    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      throw new Error('Invalid credentials');
    }

    return {
      id: user.id,
      username: user.username,
      email: user.email,
      roles: user.roles,
      mfaEnabled: user.mfaEnabled,
      provider: 'local',
      lastLogin: new Date()
    };
  }

  async getUserById(id) {
    const session = this.sessions.get(id);
    if (!session) {
      throw new Error('User not found');
    }
    return session;
  }

  checkIPRestrictions(req) {
    if (!this.config.ipRestrictions.enabled) {
      return { allowed: true };
    }

    const clientIP = req.ip || req.connection.remoteAddress || req.socket.remoteAddress;
    const forwardedIPs = req.headers['x-forwarded-for'];
    const realIP = forwardedIPs ? forwardedIPs.split(',')[0].trim() : clientIP;

    // Check blocked IPs
    if (this.config.ipRestrictions.blockedIPs.includes(realIP)) {
      return {
        allowed: false,
        reason: 'IP address is blocked',
        ip: realIP
      };
    }

    // Check allowed IPs (if specified, only these IPs are allowed)
    if (this.config.ipRestrictions.allowedIPs.length > 0) {
      if (!this.config.ipRestrictions.allowedIPs.includes(realIP)) {
        return {
          allowed: false,
          reason: 'IP address not in allowed list',
          ip: realIP
        };
      }
    }

    // Check geolocation restrictions
    const geo = geoip.lookup(realIP);
    if (geo && this.config.ipRestrictions.allowedCountries.length > 0) {
      if (!this.config.ipRestrictions.allowedCountries.includes(geo.country)) {
        return {
          allowed: false,
          reason: `Access not allowed from country: ${geo.country}`,
          ip: realIP,
          country: geo.country
        };
      }
    }

    return {
      allowed: true,
      ip: realIP,
      country: geo?.country
    };
  }

  async setupMFA(userId) {
    const secret = speakeasy.generateSecret({
      name: `${this.config.mfa.issuer} (${userId})`,
      issuer: this.config.mfa.issuer,
      length: 32
    });

    // Store the secret (in production, store in database)
    this.mfaSecrets.set(userId, {
      secret: secret.base32,
      tempSecret: secret.base32,
      verified: false,
      createdAt: new Date()
    });

    // Generate QR code
    const qrCodeUrl = await QRCode.toDataURL(secret.otpauth_url);

    return {
      secret: secret.base32,
      qrCode: qrCodeUrl,
      manualEntryKey: secret.base32
    };
  }

  async verifyMFA(userId, token) {
    const mfaData = this.mfaSecrets.get(userId);
    if (!mfaData) {
      throw new Error('MFA not set up for user');
    }

    const verified = speakeasy.totp.verify({
      secret: mfaData.secret,
      encoding: 'base32',
      token: token,
      window: this.config.mfa.window
    });

    if (verified && !mfaData.verified) {
      // First time verification - mark as verified
      mfaData.verified = true;
      this.mfaSecrets.set(userId, mfaData);
    }

    return verified;
  }

  async generateTokens(user) {
    const payload = {
      id: user.id,
      username: user.username,
      email: user.email,
      roles: user.roles,
      sessionId: uuidv4()
    };

    const accessToken = jwt.sign(payload, this.config.jwt.secret, {
      expiresIn: this.config.jwt.expiresIn
    });

    const refreshToken = jwt.sign(
      { id: user.id, sessionId: payload.sessionId },
      this.config.jwt.secret,
      { expiresIn: this.config.jwt.refreshExpiresIn }
    );

    return {
      accessToken,
      refreshToken,
      expiresIn: this.config.jwt.expiresIn
    };
  }

  async verifyToken(token) {
    try {
      // Use JWT_SECRET from environment (same as authController)
      const secret = process.env.JWT_SECRET || this.config.jwt.secret || 'dev_secret';
      const decoded = jwt.verify(token, secret);
      
      // Handle both "id" and "sub" fields (different token formats)
      const userId = decoded.id || decoded.sub;
      
      if (!userId) {
        throw new Error('Invalid token payload: missing user identifier');
      }
      
      // Normalize the decoded token to always have "id" field
      if (decoded.sub && !decoded.id) {
        decoded.id = decoded.sub;
      }
      
      // Check if session exists (optional - some tokens may not have sessions)
      // This is for backward compatibility with OAuth2/session-based tokens
      const session = this.sessions.get(userId);
      if (session) {
        // Update last activity if session exists
        session.lastActivity = new Date();
        this.sessions.set(userId, session);
      }
      // Note: Session check is optional - JWT tokens from authController don't use sessions

      return decoded;
    } catch (error) {
      console.error('Token verification error:', error.message);
      throw new Error('Invalid token');
    }
  }

  async refreshToken(refreshToken) {
    try {
      const decoded = jwt.verify(refreshToken, this.config.jwt.secret);
      const user = await this.getUserById(decoded.id);
      
      return await this.generateTokens(user);
    } catch (error) {
      throw new Error('Invalid refresh token');
    }
  }

  async logout(userId, sessionId) {
    const session = this.sessions.get(userId);
    if (session && session.sessionId === sessionId) {
      this.sessions.delete(userId);
      return true;
    }
    return false;
  }

  // Middleware functions
  getLoginRateLimit() {
    return this.loginRateLimit;
  }

  ipRestrictionMiddleware() {
    return (req, res, next) => {
      const ipCheck = this.checkIPRestrictions(req);
      if (!ipCheck.allowed) {
        return res.status(403).json({
          error: 'Access denied',
          reason: ipCheck.reason,
          ip: ipCheck.ip
        });
      }
      
      req.ipInfo = ipCheck;
      next();
    };
  }

authenticationMiddleware() {
  return async (req, res, next) => {
    try {
      const authHeader = req.headers.authorization;

      // Step 1: Validate header
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ error: "No token provided" });
      }

      console.log("🔐 AUTH HEADER:", authHeader);

      // Step 2: Extract token safely
      const token = authHeader.replace("Bearer ", "").trim();
      console.log("✅ Extracted Token:", token);

      // Step 3: Verify token
      const decoded = await this.verifyToken(token);
      console.log("👤 Decoded Payload:", decoded);

      // Step 4: Attach user info to request
      // Normalize user ID field (handle both "id" and "sub")
      req.user = {
        ...decoded,
        id: decoded.id || decoded.sub,
        sub: decoded.sub || decoded.id
      };

      console.log("✅ User authenticated:", req.user.username || req.user.id);

      // Step 5: Proceed to next middleware
      next();
    } catch (error) {
      console.error("❌ Token verification failed:", error.message);
      return res.status(401).json({ error: "Invalid or expired token" });
    }
  };
}


  requireMFA() {
    return (req, res, next) => {
      if (!req.user) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const mfaData = this.mfaSecrets.get(req.user.id);
      if (this.config.mfa.enabled && (!mfaData || !mfaData.verified)) {
        return res.status(403).json({ 
          error: 'MFA required',
          mfaSetupRequired: !mfaData
        });
      }

      next();
    };
  }
}

module.exports = AuthenticationService;