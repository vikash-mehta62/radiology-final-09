const mongoose = require('mongoose');

const HospitalSchema = new mongoose.Schema({
  hospitalId: {
    type: String,
    unique: true,
    required: true,
    index: true
  },
  name: {
    type: String,
    required: true
  },
  logoUrl: {
    type: String
  },
  address: {
    street: String,
    city: String,
    state: String,
    zipCode: String,
    country: String
  },
  contactEmail: {
    type: String,
    required: true
  },
  contactPhone: String,
  status: {
    type: String,
    enum: ['active', 'inactive', 'suspended', 'trial'],
    default: 'active'
  },
  subscription: {
    plan: {
      type: String,
      enum: ['basic', 'professional', 'enterprise', 'trial'],
      default: 'basic'
    },
    startDate: {
      type: Date,
      default: Date.now
    },
    endDate: Date,
    maxUsers: {
      type: Number,
      default: 10
    },
    maxStorage: {
      type: Number,
      default: 100 // GB
    },
    currentStorage: {
      type: Number,
      default: 0 // GB
    }
  },
  settings: {
    allowedIPs: [String],
    requireMFA: {
      type: Boolean,
      default: false
    },
    dataRetentionDays: {
      type: Number,
      default: 2555 // 7 years
    },
    autoBackup: {
      type: Boolean,
      default: true
    },
    allowDataSharing: {
      type: Boolean,
      default: false
    }
  },
  apiKey: {
    type: String,
    required: true,
    select: false // Don't return by default
  },
  bridgeAgent: {
    version: String,
    lastSeen: Date,
    status: {
      type: String,
      enum: ['online', 'offline', 'error'],
      default: 'offline'
    }
  },
  statistics: {
    totalStudies: {
      type: Number,
      default: 0
    },
    totalSeries: {
      type: Number,
      default: 0
    },
    totalInstances: {
      type: Number,
      default: 0
    },
    lastUpload: Date
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Update timestamp on save
HospitalSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// Methods
HospitalSchema.methods.isSubscriptionActive = function() {
  if (!this.subscription.endDate) return true;
  return new Date() < this.subscription.endDate;
};

HospitalSchema.methods.hasStorageAvailable = function() {
  return this.subscription.currentStorage < this.subscription.maxStorage;
};

HospitalSchema.methods.canAddUser = function(currentUserCount) {
  return currentUserCount < this.subscription.maxUsers;
};

module.exports = mongoose.model('Hospital', HospitalSchema);
