const mongoose = require('mongoose');

/**
 * Digital Signature Schema
 * FDA 21 CFR Part 11 compliant electronic signatures
 * Supports RSA-SHA256 cryptographic validation
 */

const SignatureAuditEventSchema = new mongoose.Schema({
  action: {
    type: String,
    enum: ['created', 'verified', 'revoked', 'validation_failed'],
    required: true
  },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  timestamp: { type: Date, default: Date.now },
  ipAddress: String,
  result: {
    type: String,
    enum: ['success', 'failure'],
    required: true
  },
  details: String
}, { _id: false });

const DigitalSignatureSchema = new mongoose.Schema({
  // Report Reference
  reportId: { 
    type: String, 
    required: true
  },
  
  // Signer Information
  signerId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true,
    index: true
  },
  signerName: { type: String, required: true },
  signerRole: { type: String, required: true },
  
  // Signature Data
  signatureHash: { type: String, required: true },
  algorithm: { 
    type: String, 
    default: 'RSA-SHA256',
    enum: ['RSA-SHA256']
  },
  keySize: { 
    type: Number, 
    default: 2048,
    enum: [2048, 4096]
  },
  
  // Signature Metadata
  timestamp: { type: Date, default: Date.now, index: true },
  meaning: {
    type: String,
    enum: ['author', 'reviewer', 'approver'],
    required: true
  },
  
  // Signature Status
  status: {
    type: String,
    enum: ['valid', 'invalid', 'revoked'],
    default: 'valid'
  },
  
  // Revocation Information
  revocationReason: String,
  revokedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  revokedAt: Date,
  
  // Metadata for Compliance
  metadata: {
    ipAddress: { type: String, required: true },
    userAgent: String,
    location: String,
    deviceId: String
  },
  
  // Audit Trail
  auditTrail: [SignatureAuditEventSchema],
  
  // Report Hash at Time of Signing
  reportHash: { type: String, required: true }
}, {
  timestamps: true
});

// Indexes for performance
DigitalSignatureSchema.index({ reportId: 1 });
DigitalSignatureSchema.index({ signerId: 1, timestamp: -1 });
DigitalSignatureSchema.index({ status: 1 });

// Pre-save hook for audit logging
DigitalSignatureSchema.pre('save', function(next) {
  if (this.isNew) {
    console.log(`🔏 New digital signature created for report: ${this.reportId}`);
    
    // Add creation audit event
    this.auditTrail.push({
      action: 'created',
      userId: this.signerId,
      timestamp: new Date(),
      ipAddress: this.metadata.ipAddress,
      result: 'success',
      details: `Report signed by ${this.signerName} as ${this.meaning}`
    });
  }
  next();
});

// Post-save hook for audit logging
DigitalSignatureSchema.post('save', function(doc) {
  if (doc.status === 'revoked') {
    console.log(`❌ Signature revoked for report: ${doc.reportId}`);
  }
});

// Instance methods
DigitalSignatureSchema.methods.revoke = function(reason, userId, ipAddress) {
  this.status = 'revoked';
  this.revocationReason = reason;
  this.revokedBy = userId;
  this.revokedAt = new Date();
  
  this.auditTrail.push({
    action: 'revoked',
    userId: userId,
    timestamp: new Date(),
    ipAddress: ipAddress,
    result: 'success',
    details: `Signature revoked: ${reason}`
  });
  
  return this.save();
};

DigitalSignatureSchema.methods.addVerificationEvent = function(userId, ipAddress, valid) {
  this.auditTrail.push({
    action: 'verified',
    userId: userId,
    timestamp: new Date(),
    ipAddress: ipAddress,
    result: valid ? 'success' : 'failure',
    details: valid ? 'Signature verified successfully' : 'Signature verification failed'
  });
  
  return this.save();
};

DigitalSignatureSchema.methods.invalidate = function(userId, ipAddress, reason) {
  this.status = 'invalid';
  
  this.auditTrail.push({
    action: 'validation_failed',
    userId: userId,
    timestamp: new Date(),
    ipAddress: ipAddress,
    result: 'failure',
    details: reason
  });
  
  return this.save();
};

// Static methods
DigitalSignatureSchema.statics.findByReport = function(reportId) {
  return this.find({ reportId }).sort({ timestamp: -1 });
};

DigitalSignatureSchema.statics.findBySigner = function(signerId) {
  return this.find({ signerId }).sort({ timestamp: -1 });
};

DigitalSignatureSchema.statics.findValidSignatures = function() {
  return this.find({ status: 'valid' }).sort({ timestamp: -1 });
};

DigitalSignatureSchema.statics.getAuditTrail = function(reportId) {
  return this.find({ reportId })
    .select('auditTrail signerName timestamp meaning')
    .sort({ timestamp: -1 });
};

module.exports = mongoose.model('DigitalSignature', DigitalSignatureSchema);
