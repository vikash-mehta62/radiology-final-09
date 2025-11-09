const mongoose = require('mongoose');

const DiagnosisCodeSchema = new mongoose.Schema({
  // ICD-10 Code Information
  icd10Code: { 
    type: String, 
    required: true, 
    index: true,
    trim: true,
    uppercase: true
  },
  icd10Description: { 
    type: String, 
    required: true 
  },
  
  // Category
  category: { 
    type: String,
    enum: ['Respiratory', 'Cardiovascular', 'Musculoskeletal', 'Neurological', 'Gastrointestinal', 'Other'],
    default: 'Other'
  },
  
  // Severity
  severity: {
    type: String,
    enum: ['normal', 'mild', 'moderate', 'severe', 'critical'],
    default: 'mild'
  },
  
  // AI Keywords for matching from report text
  keywords: [String],
  synonyms: [String],
  
  // Common associations
  relatedCPTCodes: [String], // CPT codes commonly billed with this diagnosis
  
  // Status
  isActive: { 
    type: Boolean, 
    default: true 
  },
  effectiveDate: Date,
  
  hospitalId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User'
  }
}, { timestamps: true });

// Indexes
DiagnosisCodeSchema.index({ icd10Code: 1, hospitalId: 1 });
DiagnosisCodeSchema.index({ keywords: 'text' });
DiagnosisCodeSchema.index({ category: 1 });

module.exports = mongoose.model('DiagnosisCode', DiagnosisCodeSchema);
