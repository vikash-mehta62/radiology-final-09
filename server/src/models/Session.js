const mongoose = require('mongoose');

/**
 * Session Model
 * Manages user authentication sessions with JWT tokens
 * Supports session timeout, concurrent session limits, and security tracking
 */
const SessionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  accessToken: {
    type: String,
    required: true
  },
  refreshToken: {
    type: String,
    required: true,
    unique: true
  },
  deviceInfo: {
    userAgent: { type: String },
    ipAddress: { type: String },
    deviceId: { type: String },
    location: { type: String }
  },
  lastActivity: {
    type: Date,
    default: Date.now
  },
  expiresAt: {
    type: Date,
    required: true
  },
  status: {
    type: String,
    enum: ['active', 'expired', 'revoked'],
    default: 'active'
  },
  revokedAt: {
    type: Date
  },
  revokedReason: {
    type: String
  }
}, {
  timestamps: true
});

// Compound index for efficient session queries
SessionSchema.index({ userId: 1, status: 1 });
SessionSchema.index({ userId: 1, expiresAt: 1 });

// TTL index to automatically delete expired sessions after 7 days
SessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 7 * 24 * 60 * 60 });

/**
 * Check if session is valid
 */
SessionSchema.methods.isValid = function() {
  return this.status === 'active' && this.expiresAt > new Date();
};

/**
 * Check if session is inactive (timeout check)
 */
SessionSchema.methods.isInactive = function(timeoutMs = 30 * 60 * 1000) {
  const inactiveTime = Date.now() - this.lastActivity.getTime();
  return inactiveTime > timeoutMs;
};

/**
 * Update last activity timestamp
 */
SessionSchema.methods.updateActivity = function() {
  this.lastActivity = new Date();
  return this.save();
};

/**
 * Revoke session
 */
SessionSchema.methods.revoke = function(reason = 'User logout') {
  this.status = 'revoked';
  this.revokedAt = new Date();
  this.revokedReason = reason;
  return this.save();
};

/**
 * Expire session
 */
SessionSchema.methods.expire = function() {
  this.status = 'expired';
  return this.save();
};

/**
 * Convert to safe JSON (exclude sensitive tokens)
 */
SessionSchema.methods.toSafeJSON = function() {
  return {
    id: this._id.toString(),
    userId: this.userId.toString(),
    deviceInfo: this.deviceInfo,
    lastActivity: this.lastActivity,
    expiresAt: this.expiresAt,
    status: this.status,
    createdAt: this.createdAt
  };
};

module.exports = mongoose.model('Session', SessionSchema);
