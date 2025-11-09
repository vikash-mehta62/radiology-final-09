const mongoose = require('mongoose');

/**
 * Critical Notification Schema
 * For real-time alerts of urgent medical findings
 * Supports multi-channel delivery and escalation workflows
 */

const NotificationRecipientSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  name: { type: String, required: true },
  email: String,
  phone: String,
  role: String,
  priority: { type: Number, default: 1 }
}, { _id: false });

const EscalationEventSchema = new mongoose.Schema({
  level: { type: Number, required: true },
  recipientId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  timestamp: { type: Date, default: Date.now },
  acknowledged: { type: Boolean, default: false },
  acknowledgedAt: Date
}, { _id: false });

const DeliveryStatusSchema = new mongoose.Schema({
  channel: { 
    type: String, 
    enum: ['email', 'sms', 'in_app', 'push'],
    required: true 
  },
  status: { 
    type: String, 
    enum: ['pending', 'sent', 'delivered', 'failed'],
    default: 'pending'
  },
  attempts: { type: Number, default: 0 },
  lastAttempt: Date,
  error: String
}, { _id: false });

const CriticalNotificationSchema = new mongoose.Schema({
  // Notification Type and Severity
  type: {
    type: String,
    enum: ['critical_finding', 'urgent_review', 'system_alert'],
    required: true,
    index: true
  },
  severity: {
    type: String,
    enum: ['critical', 'high', 'medium'],
    required: true,
    index: true
  },
  
  // Notification Content
  title: { type: String, required: true },
  message: { type: String, required: true },
  
  // Patient and Study References
  patientId: { type: String, required: true, index: true },
  studyId: { type: String, required: true },
  
  // Finding Details
  findingDetails: {
    location: String,
    description: String,
    urgency: String,
    measurements: mongoose.Schema.Types.Mixed
  },
  
  // Recipients
  recipients: [NotificationRecipientSchema],
  
  // Delivery Channels
  channels: [{
    type: String,
    enum: ['email', 'sms', 'in_app', 'push']
  }],
  
  // Delivery Status
  deliveryStatus: [DeliveryStatusSchema],
  
  // Notification Status
  status: {
    type: String,
    enum: ['pending', 'delivered', 'acknowledged', 'escalated', 'failed'],
    default: 'pending',
    index: true
  },
  
  // Timestamps
  createdAt: { type: Date, default: Date.now, index: true },
  deliveredAt: Date,
  acknowledgedAt: Date,
  
  // Acknowledgment
  acknowledgedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  
  // Escalation
  escalationLevel: { type: Number, default: 0 },
  escalationHistory: [EscalationEventSchema],
  
  // Metadata
  metadata: mongoose.Schema.Types.Mixed
}, {
  timestamps: true
});

// Indexes for performance
CriticalNotificationSchema.index({ patientId: 1, createdAt: -1 });
CriticalNotificationSchema.index({ status: 1, createdAt: -1 });
CriticalNotificationSchema.index({ 'recipients.userId': 1 });

// Pre-save hook for audit logging
CriticalNotificationSchema.pre('save', function(next) {
  if (this.isNew) {
    console.log(`📢 New critical notification created: ${this.title}`);
  }
  next();
});

// Post-save hook for audit logging
CriticalNotificationSchema.post('save', function(doc) {
  if (doc.status === 'acknowledged') {
    console.log(`✅ Notification acknowledged: ${doc.title}`);
  }
});

// Instance methods
CriticalNotificationSchema.methods.acknowledge = function(userId) {
  this.status = 'acknowledged';
  this.acknowledgedAt = new Date();
  this.acknowledgedBy = userId;
  return this.save();
};

CriticalNotificationSchema.methods.escalate = function(nextLevel, nextRecipients) {
  this.escalationLevel = nextLevel;
  this.status = 'escalated';
  this.escalationHistory.push({
    level: nextLevel,
    recipientId: nextRecipients[0].userId,
    timestamp: new Date(),
    acknowledged: false
  });
  return this.save();
};

// Static methods
CriticalNotificationSchema.statics.findUnacknowledged = function() {
  return this.find({
    status: { $in: ['pending', 'delivered', 'escalated'] },
    createdAt: { $lt: new Date(Date.now() - 15 * 60 * 1000) } // Older than 15 minutes
  });
};

CriticalNotificationSchema.statics.findByPatient = function(patientId) {
  return this.find({ patientId }).sort({ createdAt: -1 });
};

module.exports = mongoose.model('CriticalNotification', CriticalNotificationSchema);
