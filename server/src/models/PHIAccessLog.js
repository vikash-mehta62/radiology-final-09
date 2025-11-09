/**
 * PHI Access Log Model for HIPAA Compliance
 * Stores all access to Protected Health Information
 */

const mongoose = require('mongoose');

const phiAccessLogSchema = new mongoose.Schema({
  timestamp: {
    type: Date,
    required: true,
    default: Date.now,
    index: true
  },
  eventType: {
    type: String,
    required: true,
    default: 'PHI_ACCESS',
    enum: ['PHI_ACCESS', 'PHI_EXPORT', 'PHI_NOTIFICATION', 'PHI_MODIFICATION', 'PHI_DELETION']
  },
  userId: {
    type: String,
    required: true,
    index: true
  },
  userName: {
    type: String,
    required: true
  },
  userRole: {
    type: String,
    required: true
  },
  action: {
    type: String,
    required: true,
    enum: [
      'view', 'edit', 'create', 'delete', 'export', 
      'notification_delivery', 'bulk_export', 'print',
      'download', 'share', 'sign'
    ],
    index: true
  },
  resourceType: {
    type: String,
    required: true,
    enum: ['patient', 'study', 'report', 'notification', 'multiple'],
    index: true
  },
  resourceId: {
    type: String,
    required: true
  },
  patientId: {
    type: mongoose.Schema.Types.Mixed, // Can be string or encrypted object
    required: true,
    index: true
  },
  patientName: {
    type: mongoose.Schema.Types.Mixed, // Can be string or encrypted object
    required: true
  },
  ipAddress: {
    type: mongoose.Schema.Types.Mixed, // Can be string or encrypted object
    required: true
  },
  userAgent: {
    type: mongoose.Schema.Types.Mixed, // Can be string or encrypted object
    required: true
  },
  sessionId: {
    type: String,
    required: true
  },
  purpose: {
    type: String,
    required: true,
    enum: ['treatment', 'payment', 'operations', 'research', 'unknown'],
    default: 'treatment'
  },
  success: {
    type: Boolean,
    required: true,
    default: true,
    index: true
  },
  errorMessage: {
    type: String
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed // Can be object or encrypted object
  },
  // Encryption flags
  patientId_encrypted: {
    type: Boolean,
    default: false
  },
  patientName_encrypted: {
    type: Boolean,
    default: false
  },
  ipAddress_encrypted: {
    type: Boolean,
    default: false
  },
  userAgent_encrypted: {
    type: Boolean,
    default: false
  },
  metadata_encrypted: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true,
  collection: 'phiaccesslogs'
});

// Indexes for efficient querying
phiAccessLogSchema.index({ userId: 1, timestamp: -1 });
phiAccessLogSchema.index({ patientId: 1, timestamp: -1 });
phiAccessLogSchema.index({ resourceType: 1, action: 1, timestamp: -1 });
phiAccessLogSchema.index({ success: 1, timestamp: -1 });
phiAccessLogSchema.index({ timestamp: -1 }); // For time-based queries

// TTL index for automatic deletion after retention period (7 years = 2555 days)
const retentionDays = parseInt(process.env.PHI_LOG_RETENTION_DAYS || '2555');
phiAccessLogSchema.index(
  { timestamp: 1 },
  { expireAfterSeconds: retentionDays * 24 * 60 * 60 }
);

// Virtual for formatted timestamp
phiAccessLogSchema.virtual('formattedTimestamp').get(function() {
  return this.timestamp.toISOString();
});

// Method to get summary
phiAccessLogSchema.methods.getSummary = function() {
  return {
    id: this._id,
    timestamp: this.timestamp,
    user: `${this.userName} (${this.userRole})`,
    action: this.action,
    resource: `${this.resourceType}:${this.resourceId}`,
    success: this.success
  };
};

// Static method to get recent accesses for a user
phiAccessLogSchema.statics.getRecentAccessesByUser = async function(userId, limit = 100) {
  return this.find({ userId })
    .sort({ timestamp: -1 })
    .limit(limit)
    .lean();
};

// Static method to get accesses for a patient
phiAccessLogSchema.statics.getAccessesByPatient = async function(patientId, limit = 100) {
  return this.find({ patientId })
    .sort({ timestamp: -1 })
    .limit(limit)
    .lean();
};

// Static method to get failed access attempts
phiAccessLogSchema.statics.getFailedAccesses = async function(startDate, endDate, limit = 100) {
  const query = { success: false };
  if (startDate || endDate) {
    query.timestamp = {};
    if (startDate) query.timestamp.$gte = new Date(startDate);
    if (endDate) query.timestamp.$lte = new Date(endDate);
  }
  
  return this.find(query)
    .sort({ timestamp: -1 })
    .limit(limit)
    .lean();
};

// Static method to get export operations
phiAccessLogSchema.statics.getExportOperations = async function(startDate, endDate, limit = 100) {
  const query = { action: { $in: ['export', 'bulk_export'] } };
  if (startDate || endDate) {
    query.timestamp = {};
    if (startDate) query.timestamp.$gte = new Date(startDate);
    if (endDate) query.timestamp.$lte = new Date(endDate);
  }
  
  return this.find(query)
    .sort({ timestamp: -1 })
    .limit(limit)
    .lean();
};

const PHIAccessLog = mongoose.model('PHIAccessLog', phiAccessLogSchema);

module.exports = PHIAccessLog;
