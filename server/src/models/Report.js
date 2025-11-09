const mongoose = require('mongoose');

const ReportSchema = new mongoose.Schema({
  // Study Reference
  studyInstanceUID: { type: String, required: true, index: true },
  patientID: { type: String, required: true, index: true },
  patientName: String,
  patientBirthDate: String,
  patientSex: String,
  patientAge: String,
  
  // Study Information
  studyDate: String,
  studyTime: String,
  studyDescription: String,
  
  // Report Metadata
  reportId: { type: String, unique: true, required: true },
  reportDate: { type: Date, default: Date.now },
  status: { 
    type: String, 
    enum: ['draft', 'preliminary', 'final', 'finalized', 'amended', 'cancelled'],
    default: 'draft',
    index: true
  },
  
  // Template & Content
  templateId: String,
  templateName: String,
  modality: String,
  
  // Report Creation Mode (NEW - UNIFIED)
  creationMode: {
    type: String,
    enum: ['manual', 'ai-assisted', 'ai-only'],
    default: 'manual',
    index: true
  },
  
  // Report Sections (UNIFIED from both models)
  clinicalHistory: String,
  technique: String,
  comparison: String,
  findings: String,
  findingsText: String, // Alias for findings
  impression: String,
  recommendations: String,
  reportSections: mongoose.Schema.Types.Mixed, // Dynamic template sections
  
  // Structured Findings (from AI or manual)
  structuredFindings: [{
    id: String,
    type: { type: String, enum: ['finding', 'impression', 'recommendation', 'critical'] },
    category: String,
    description: String,
    finding: String, // Alias
    location: String,
    severity: { type: String, enum: ['normal', 'mild', 'moderate', 'severe', 'critical'] },
    clinicalCode: String,
    confidence: Number,
    aiGenerated: Boolean,
    frameIndex: Number,
    timestamp: { type: Date, default: Date.now }
  }],
  
  // Measurements (from viewer tools)
  measurements: [{
    id: String,
    type: { type: String, enum: ['length', 'angle', 'area', 'volume'] },
    value: Number,
    unit: String,
    label: String,
    points: [{ x: Number, y: Number }],
    frameIndex: Number,
    timestamp: { type: Date, default: Date.now }
  }],
  
  // Annotations (from viewer tools)
  annotations: [{
    id: String,
    type: { type: String, enum: ['text', 'arrow', 'freehand', 'rectangle', 'circle', 'polygon', 'clinical', 'leader'] },
    text: String,
    color: String,
    points: [{ x: Number, y: Number }],
    anchor: { x: Number, y: Number },
    textPos: { x: Number, y: Number },
    category: String,
    clinicalCode: String,
    isKeyImage: Boolean,
    frameIndex: Number,
    timestamp: { type: Date, default: Date.now }
  }],
  
  // Captured Images (UNIFIED)
  keyImages: [{
    id: String,
    dataUrl: String,
    frameIndex: Number,
    seriesUID: String,
    caption: String,
    hasAIOverlay: Boolean,
    hasAnnotations: Boolean,
    aiFindings: [String],
    timestamp: Date,
    metadata: {
      studyUID: String,
      seriesUID: String,
      instanceUID: String,
      frameIndex: Number,
      windowLevel: { width: Number, center: Number },
      zoom: Number
    }
  }],
  imageCount: { type: Number, default: 0 },
  
  // AI Analysis Reference (UNIFIED with provenance)
  aiAnalysisId: String,
  aiModelsUsed: [String],
  aiProvenance: {
    modelName: String,
    modelVersion: String,
    requestId: String,
    timestamp: Date,
    rawOutputHash: String,
    rawOutput: mongoose.Schema.Types.Mixed,
    confidence: Number,
    processingTime: Number
  },
  
  // Signature & Approval (UNIFIED)
  signature: {
    type: String, // Text signature
    signedBy: String,
    signedAt: Date,
    credentials: String
  },
  radiologistSignature: String, // Text signature (legacy)
  radiologistSignatureUrl: String, // Filesystem URL
  radiologistSignaturePublicId: String, // File identifier
  radiologistId: String,
  radiologistName: String,
  signedAt: Date,
  
  // Workflow
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  finalizedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  finalizedAt: Date,
  
  // Addendum Support
  addenda: [{
    content: String,
    addedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    addedAt: Date,
    reason: String
  }],
  
  // Critical Results
  isCritical: { type: Boolean, default: false },
  criticalNotifiedAt: Date,
  criticalNotifiedTo: [String],
  priority: { type: String, enum: ['routine', 'urgent', 'stat'], default: 'routine' },
  
  // Audit Trail (ENHANCED)
  revisionHistory: [{
    revisedBy: String,
    revisedAt: Date,
    changes: String,
    previousStatus: String,
    actorId: String,
    actionType: String,
    diffSnapshot: mongoose.Schema.Types.Mixed
  }],
  
  // Version Control
  version: { type: Number, default: 1 },
  previousVersionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Report' },
  tags: [String],
  
  // Hospital Reference
  hospitalId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    index: true 
  }
}, { timestamps: true });

// Indexes for efficient queries
ReportSchema.index({ hospitalId: 1, status: 1, createdAt: -1 });
ReportSchema.index({ studyInstanceUID: 1, status: 1 });
ReportSchema.index({ studyInstanceUID: 1, reportStatus: 1 }); // Legacy compatibility
ReportSchema.index({ patientID: 1, createdAt: -1 });
ReportSchema.index({ patientID: 1, reportDate: -1 }); // Legacy compatibility
ReportSchema.index({ createdBy: 1, status: 1 });
ReportSchema.index({ radiologistId: 1, reportDate: -1 }); // Legacy compatibility
ReportSchema.index({ status: 1, reportDate: -1 }); // Legacy compatibility
ReportSchema.index({ creationMode: 1, createdAt: -1 }); // NEW - for AI reporting analytics

// Generate unique report ID before saving
ReportSchema.pre('save', function(next) {
  if (!this.reportId) {
    this.reportId = `RPT-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    console.log('📝 Generated reportId:', this.reportId);
  }
  
  // Sync aliases
  if (this.findings && !this.findingsText) {
    this.findingsText = this.findings;
  }
  if (this.findingsText && !this.findings) {
    this.findings = this.findingsText;
  }
  
  // Map status aliases for backward compatibility
  if (this.status === 'finalized' || this.status === 'final') {
    this.reportStatus = 'final';
  } else if (this.status === 'draft') {
    this.reportStatus = 'draft';
  }
  
  next();
});

// Virtual for backward compatibility
ReportSchema.virtual('reportStatus').get(function() {
  if (this.status === 'finalized' || this.status === 'final') return 'final';
  if (this.status === 'preliminary') return 'preliminary';
  return 'draft';
});

module.exports = mongoose.model('Report', ReportSchema);
