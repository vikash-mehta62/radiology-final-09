const mongoose = require('mongoose');

const UsageMetricsSchema = new mongoose.Schema({
  hospitalId: {
    type: String,
    required: true,
    index: true
  },
  date: {
    type: Date,
    required: true,
    index: true
  },
  
  // Study Metrics
  studies: {
    uploaded: { type: Number, default: 0 },
    viewed: { type: Number, default: 0 },
    reported: { type: Number, default: 0 },
    shared: { type: Number, default: 0 }
  },
  
  // User Activity
  users: {
    activeUsers: { type: Number, default: 0 },
    totalLogins: { type: Number, default: 0 },
    uniqueUsers: [String] // User IDs
  },
  
  // Storage
  storage: {
    totalBytes: { type: Number, default: 0 },
    addedBytes: { type: Number, default: 0 },
    deletedBytes: { type: Number, default: 0 }
  },
  
  // Performance
  performance: {
    avgLoadTime: { type: Number, default: 0 },
    avgRenderTime: { type: Number, default: 0 },
    errorCount: { type: Number, default: 0 }
  },
  
  // Modality Breakdown
  modalityBreakdown: {
    CT: { type: Number, default: 0 },
    MR: { type: Number, default: 0 },
    XR: { type: Number, default: 0 },
    US: { type: Number, default: 0 },
    CR: { type: Number, default: 0 },
    DX: { type: Number, default: 0 },
    MG: { type: Number, default: 0 },
    PT: { type: Number, default: 0 },
    NM: { type: Number, default: 0 },
    OTHER: { type: Number, default: 0 }
  },
  
  // AI Usage
  aiUsage: {
    totalRequests: { type: Number, default: 0 },
    successfulRequests: { type: Number, default: 0 },
    failedRequests: { type: Number, default: 0 }
  },
  
  createdAt: {
    type: Date,
    default: Date.now
  }
});

UsageMetricsSchema.index({ hospitalId: 1, date: -1 });

module.exports = mongoose.model('UsageMetrics', UsageMetricsSchema);
