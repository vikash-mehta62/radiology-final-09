const mongoose = require('mongoose');

const priorAuthorizationSchema = new mongoose.Schema({
  // Reference Information
  authorizationNumber: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  
  // Patient Information
  patientID: {
    type: String,
    required: true,
    index: true
  },
  patientName: String,
  dateOfBirth: Date,
  insuranceProvider: String,
  insurancePolicyNumber: String,
  
  // Study/Procedure Information
  studyInstanceUID: {
    type: String,
    index: true
  },
  procedureCode: String, // CPT code
  procedureDescription: String,
  modality: String,
  bodyPart: String,
  
  // Authorization Details
  status: {
    type: String,
    enum: ['pending', 'approved', 'denied', 'expired', 'in_review'],
    default: 'pending',
    index: true
  },
  
  requestDate: {
    type: Date,
    default: Date.now
  },
  
  approvalDate: Date,
  expirationDate: Date,
  
  approvedUnits: Number, // Number of approved procedures/sessions
  usedUnits: {
    type: Number,
    default: 0
  },
  
  // Clinical Information
  diagnosis: [String], // ICD-10 codes
  clinicalIndication: String,
  urgency: {
    type: String,
    enum: ['routine', 'urgent', 'stat', 'emergency'],
    default: 'routine'
  },
  
  // Supporting Documentation
  supportingDocuments: [{
    type: String,
    url: String,
    uploadDate: Date
  }],
  
  // Automated Checks
  automatedChecks: {
    medicalNecessity: {
      passed: Boolean,
      score: Number,
      reasons: [String]
    },
    appropriateness: {
      passed: Boolean,
      criteria: String,
      reasons: [String]
    },
    duplicateCheck: {
      passed: Boolean,
      duplicates: [String]
    },
    coverageCheck: {
      passed: Boolean,
      covered: Boolean,
      reasons: [String]
    }
  },
  
  // Review Information
  reviewedBy: String,
  reviewNotes: String,
  denialReason: String,
  
  // Notes
  notes: [{
    text: String,
    createdBy: String,
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],
  
  // Documents
  documents: [{
    filename: String,
    uploadedAt: {
      type: Date,
      default: Date.now
    },
    uploadedBy: String
  }],
  
  // Tracking
  createdBy: String,
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  },
  
  // Notifications
  notificationsSent: [{
    type: {
      type: String,
      enum: ['email', 'sms', 'portal']
    },
    sentAt: Date,
    recipient: String,
    status: String
  }]
}, {
  timestamps: true
});

// Indexes for performance
priorAuthorizationSchema.index({ patientID: 1, status: 1 });
priorAuthorizationSchema.index({ expirationDate: 1 });
priorAuthorizationSchema.index({ createdAt: -1 });

// Virtual for remaining units
priorAuthorizationSchema.virtual('remainingUnits').get(function() {
  return this.approvedUnits - this.usedUnits;
});

// Method to check if authorization is valid
priorAuthorizationSchema.methods.isValid = function() {
  if (this.status !== 'approved') return false;
  if (this.expirationDate && new Date() > this.expirationDate) return false;
  if (this.remainingUnits <= 0) return false;
  return true;
};

// Method to use a unit
priorAuthorizationSchema.methods.useUnit = async function() {
  if (!this.isValid()) {
    throw new Error('Authorization is not valid or has no remaining units');
  }
  this.usedUnits += 1;
  await this.save();
};

module.exports = mongoose.model('PriorAuthorization', priorAuthorizationSchema);
