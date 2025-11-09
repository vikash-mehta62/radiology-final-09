/**
 * Report Template Model
 * Database-driven templates for automatic selection based on study characteristics
 */

const mongoose = require('mongoose');

const ReportTemplateSchema = new mongoose.Schema({
  // Template identification
  templateId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  name: {
    type: String,
    required: true
  },
  description: {
    type: String,
    default: ''
  },
  category: {
    type: String,
    enum: ['cardiology', 'radiology', 'neurology', 'orthopedics', 'general'],
    default: 'general'
  },

  // Matching criteria
  matchingCriteria: {
    modalities: [{
      type: String,
      uppercase: true
    }],
    bodyParts: [{
      type: String,
      uppercase: true
    }],
    keywords: [{
      type: String,
      lowercase: true
    }],
    procedureTypes: [{
      type: String,
      enum: ['diagnostic', 'interventional', 'screening', 'follow-up']
    }]
  },

  // Matching weights for scoring
  matchingWeights: {
    modalityWeight: {
      type: Number,
      default: 50
    },
    bodyPartWeight: {
      type: Number,
      default: 30
    },
    keywordWeight: {
      type: Number,
      default: 5
    },
    procedureTypeWeight: {
      type: Number,
      default: 15
    }
  },

  // Template structure
  sections: [{
    id: String,
    title: String,
    order: Number,
    required: Boolean,
    defaultContent: String,
    placeholder: String
  }],

  // Template fields
  fields: {
    type: Map,
    of: mongoose.Schema.Types.Mixed,
    default: {}
  },

  // Pre-defined options for dropdowns
  fieldOptions: {
    type: Map,
    of: [String],
    default: {}
  },

  // AI integration
  aiIntegration: {
    enabled: {
      type: Boolean,
      default: true
    },
    autoFillFields: [{
      type: String
    }],
    suggestedFindings: [{
      type: String
    }]
  },

  // Template metadata
  priority: {
    type: Number,
    default: 0,
    index: true
  },
  active: {
    type: Boolean,
    default: true,
    index: true
  },
  isDefault: {
    type: Boolean,
    default: false
  },

  // Usage statistics
  usageStats: {
    timesUsed: {
      type: Number,
      default: 0
    },
    lastUsed: Date,
    averageCompletionTime: Number,
    userRatings: [{
      userId: mongoose.Schema.Types.ObjectId,
      rating: Number,
      comment: String,
      date: Date
    }]
  },

  // Customization
  customizable: {
    type: Boolean,
    default: true
  },
  hospitalSpecific: {
    hospitalId: mongoose.Schema.Types.ObjectId,
    customizations: mongoose.Schema.Types.Mixed
  },

  // Version control
  version: {
    type: String,
    default: '1.0'
  },
  changelog: [{
    version: String,
    changes: String,
    date: Date,
    author: String
  }],

  // Audit trail
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

// Indexes for efficient querying
ReportTemplateSchema.index({ 'matchingCriteria.modalities': 1 });
ReportTemplateSchema.index({ 'matchingCriteria.bodyParts': 1 });
ReportTemplateSchema.index({ 'matchingCriteria.keywords': 1 });
ReportTemplateSchema.index({ active: 1, priority: -1 });
ReportTemplateSchema.index({ category: 1, active: 1 });

// Virtual for average rating
ReportTemplateSchema.virtual('averageRating').get(function() {
  if (!this.usageStats.userRatings || this.usageStats.userRatings.length === 0) {
    return 0;
  }
  const sum = this.usageStats.userRatings.reduce((acc, r) => acc + r.rating, 0);
  return (sum / this.usageStats.userRatings.length).toFixed(1);
});

// Method to increment usage
ReportTemplateSchema.methods.incrementUsage = function() {
  this.usageStats.timesUsed += 1;
  this.usageStats.lastUsed = new Date();
  return this.save();
};

// Method to add rating
ReportTemplateSchema.methods.addRating = function(userId, rating, comment) {
  this.usageStats.userRatings.push({
    userId,
    rating,
    comment,
    date: new Date()
  });
  return this.save();
};

// Static method to find active templates
ReportTemplateSchema.statics.findActive = function() {
  return this.find({ active: true }).sort({ priority: -1, 'usageStats.timesUsed': -1 });
};

// Static method to find by category
ReportTemplateSchema.statics.findByCategory = function(category) {
  return this.find({ category, active: true }).sort({ priority: -1 });
};

// Pre-save middleware to generate templateId if not provided
ReportTemplateSchema.pre('save', function(next) {
  if (!this.templateId) {
    this.templateId = `TPL-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
  next();
});

// Ensure virtuals are included in JSON
ReportTemplateSchema.set('toJSON', { virtuals: true });
ReportTemplateSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('ReportTemplate', ReportTemplateSchema);
