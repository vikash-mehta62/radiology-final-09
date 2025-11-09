const mongoose = require('mongoose');

/**
 * Export Session Schema
 * Tracks report export operations (DICOM SR, FHIR, PDF)
 * Supports async processing and audit logging
 */

const ExportSessionSchema = new mongoose.Schema({
  // Report Reference
  reportId: { 
    type: String, 
    required: true
  },
  
  // User Reference
  userId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true
  },
  
  // Export Format
  format: {
    type: String,
    enum: ['dicom-sr', 'fhir', 'pdf'],
    required: true
  },
  
  // Export Status
  status: {
    type: String,
    enum: ['initiated', 'processing', 'completed', 'failed'],
    default: 'initiated'
  },
  
  // Progress Tracking
  progress: {
    type: Number,
    default: 0,
    min: 0,
    max: 100
  },
  
  // Export Result
  fileUrl: String,
  fileName: String,
  fileSize: Number,
  filePath: String,
  
  // Error Information
  error: String,
  errorDetails: mongoose.Schema.Types.Mixed,
  
  // Metadata
  metadata: {
    recipient: String,
    purpose: String,
    ipAddress: String,
    userAgent: String,
    exportOptions: mongoose.Schema.Types.Mixed
  },
  
  // Timestamps
  createdAt: { type: Date, default: Date.now },
  startedAt: Date,
  completedAt: Date,
  
  // Processing Information
  processingTime: Number, // milliseconds
  retryCount: { type: Number, default: 0 },
  
  // Validation Results
  validationResults: {
    valid: Boolean,
    errors: [String],
    warnings: [String]
  }
}, {
  timestamps: true
});

// Indexes for performance
ExportSessionSchema.index({ reportId: 1, createdAt: -1 });
ExportSessionSchema.index({ userId: 1, format: 1 });
ExportSessionSchema.index({ status: 1 });
ExportSessionSchema.index({ createdAt: -1 });

// Virtual for duration
ExportSessionSchema.virtual('duration').get(function() {
  if (this.completedAt && this.startedAt) {
    return this.completedAt - this.startedAt;
  }
  return null;
});

// Pre-save hook for audit logging
ExportSessionSchema.pre('save', function(next) {
  if (this.isNew) {
    console.log(`📤 Export initiated: ${this.format} for report ${this.reportId}`);
  }
  
  // Calculate processing time when completed
  if (this.status === 'completed' && this.startedAt && this.completedAt) {
    this.processingTime = this.completedAt - this.startedAt;
  }
  
  next();
});

// Post-save hook for audit logging
ExportSessionSchema.post('save', function(doc) {
  if (doc.status === 'completed') {
    console.log(`✅ Export completed: ${doc.format} for report ${doc.reportId} (${doc.processingTime}ms)`);
  } else if (doc.status === 'failed') {
    console.error(`❌ Export failed: ${doc.format} for report ${doc.reportId} - ${doc.error}`);
  }
});

// Instance methods
ExportSessionSchema.methods.start = function() {
  this.status = 'processing';
  this.startedAt = new Date();
  return this.save();
};

ExportSessionSchema.methods.complete = function(fileUrl, fileName, fileSize) {
  this.status = 'completed';
  this.progress = 100;
  this.completedAt = new Date();
  this.fileUrl = fileUrl;
  this.fileName = fileName;
  this.fileSize = fileSize;
  return this.save();
};

ExportSessionSchema.methods.fail = function(error, errorDetails) {
  this.status = 'failed';
  this.completedAt = new Date();
  this.error = error;
  this.errorDetails = errorDetails;
  return this.save();
};

ExportSessionSchema.methods.updateProgress = function(progress) {
  this.progress = Math.min(100, Math.max(0, progress));
  return this.save();
};

ExportSessionSchema.methods.retry = function() {
  this.retryCount += 1;
  this.status = 'initiated';
  this.error = null;
  this.errorDetails = null;
  return this.save();
};

// Static methods
ExportSessionSchema.statics.findByReport = function(reportId) {
  return this.find({ reportId }).sort({ createdAt: -1 });
};

ExportSessionSchema.statics.findByUser = function(userId, format) {
  const query = { userId };
  if (format) {
    query.format = format;
  }
  return this.find(query).sort({ createdAt: -1 });
};

ExportSessionSchema.statics.findPending = function() {
  return this.find({
    status: { $in: ['initiated', 'processing'] }
  }).sort({ createdAt: 1 });
};

ExportSessionSchema.statics.findCompleted = function(limit = 100) {
  return this.find({ status: 'completed' })
    .sort({ completedAt: -1 })
    .limit(limit);
};

ExportSessionSchema.statics.getExportStats = function(userId) {
  return this.aggregate([
    { $match: { userId: mongoose.Types.ObjectId(userId) } },
    {
      $group: {
        _id: '$format',
        count: { $sum: 1 },
        completed: {
          $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] }
        },
        failed: {
          $sum: { $cond: [{ $eq: ['$status', 'failed'] }, 1, 0] }
        },
        avgProcessingTime: { $avg: '$processingTime' }
      }
    }
  ]);
};

module.exports = mongoose.model('ExportSession', ExportSessionSchema);
