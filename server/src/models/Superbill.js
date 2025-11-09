const mongoose = require('mongoose');

const SuperbillSchema = new mongoose.Schema({
  // Reference Information
  superbillNumber: { 
    type: String, 
    required: true, 
    unique: true,
    index: true 
  },
  studyInstanceUID: { 
    type: String, 
    required: true,
    index: true 
  },
  reportId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'StructuredReport'
  },
  
  // Patient Information
  patientID: { 
    type: String, 
    required: true 
  },
  patientName: String,
  patientDOB: String,
  patientSex: String,
  
  // Insurance Information
  insuranceProvider: String,
  insurancePolicyNumber: String,
  insuranceGroupNumber: String,
  subscriberName: String,
  subscriberRelationship: String,
  
  // Provider Information
  renderingProviderNPI: String,
  renderingProviderName: String,
  facilityNPI: String,
  facilityName: String,
  facilityAddress: String,
  
  // Service Information
  dateOfService: { 
    type: Date, 
    required: true 
  },
  placeOfService: { 
    type: String, 
    default: '11' // Office
  },
  
  // CPT Codes (Procedures)
  cptCodes: [{
    code: { type: String, required: true },
    description: String,
    modifiers: [String],
    units: { type: Number, default: 1 },
    charge: Number,
    diagnosisPointers: [Number], // Links to diagnosis codes
    aiSuggested: { type: Boolean, default: false },
    manuallyAdded: { type: Boolean, default: false },
    confidence: Number // AI confidence score 0-100
  }],
  
  // ICD-10 Codes (Diagnoses)
  icd10Codes: [{
    code: { type: String, required: true },
    description: String,
    pointer: Number, // 1, 2, 3, 4 for linking to procedures
    aiSuggested: { type: Boolean, default: false },
    manuallyAdded: { type: Boolean, default: false },
    confidence: Number // AI confidence score 0-100
  }],
  
  // Financial Information
  totalCharges: { 
    type: Number, 
    required: true 
  },
  expectedReimbursement: Number,
  patientResponsibility: Number,
  
  // AI Analysis
  aiAnalysis: {
    reportText: String,
    suggestedCodes: mongoose.Schema.Types.Mixed,
    processingTime: Number,
    model: String,
    timestamp: Date
  },
  
  // Status and Workflow
  status: {
    type: String,
    enum: ['draft', 'pending_review', 'approved', 'submitted', 'paid', 'rejected'],
    default: 'draft'
  },
  
  // Validation
  validationErrors: [String],
  validationWarnings: [String],
  isValid: { 
    type: Boolean, 
    default: false 
  },
  
  // Audit Trail
  createdBy: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User' 
  },
  approvedBy: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User' 
  },
  approvedAt: Date,
  submittedAt: Date,
  
  // Export Information
  exportedFormats: [{
    format: String, // 'pdf', 'edi-837', 'csv'
    exportedAt: Date,
    exportedBy: mongoose.Schema.Types.ObjectId
  }],
  
  // Notes
  notes: String,
  internalNotes: String,
  
  hospitalId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User',
    required: true,
    index: true
  }
}, { timestamps: true });

// Indexes for efficient querying
SuperbillSchema.index({ superbillNumber: 1 });
SuperbillSchema.index({ studyInstanceUID: 1 });
SuperbillSchema.index({ patientID: 1, hospitalId: 1 });
SuperbillSchema.index({ dateOfService: 1 });
SuperbillSchema.index({ status: 1, hospitalId: 1 });
SuperbillSchema.index({ createdAt: -1 });

// Generate superbill number
SuperbillSchema.pre('save', async function(next) {
  if (!this.superbillNumber) {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    this.superbillNumber = `SB-${year}${month}${day}-${random}`;
  }
  next();
});

module.exports = mongoose.model('Superbill', SuperbillSchema);
