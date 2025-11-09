const mongoose = require('mongoose');

const BillingCodeSchema = new mongoose.Schema({
  // CPT Code Information
  cptCode: { 
    type: String, 
    required: true, 
    index: true,
    trim: true 
  },
  cptDescription: { 
    type: String, 
    required: true 
  },
  cptCategory: { 
    type: String, 
    enum: ['Radiology', 'Pathology', 'Surgery', 'Medicine', 'E&M', 'Other'],
    default: 'Radiology'
  },
  
  // Modality and Body Part (for auto-suggestion)
  modality: [String], // ['XA', 'CT', 'MRI', 'US', 'XR']
  bodyPart: [String], // ['Chest', 'Head', 'Abdomen', 'Cardiac', 'Extremity']
  
  // Pricing Information
  basePrice: { 
    type: Number, 
    required: true 
  },
  rvuValue: Number, // Relative Value Unit
  
  // Modifiers
  allowedModifiers: [String], // ['26', 'TC', '59', 'RT', 'LT']
  
  // Status
  isActive: { 
    type: Boolean, 
    default: true 
  },
  effectiveDate: Date,
  expirationDate: Date,
  
  // AI Keywords for matching
  keywords: [String], // For AI to match report text to codes
  
  hospitalId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User'
  }
}, { timestamps: true });

// Indexes for fast searching
BillingCodeSchema.index({ cptCode: 1, hospitalId: 1 });
BillingCodeSchema.index({ modality: 1, bodyPart: 1 });
BillingCodeSchema.index({ keywords: 'text' });

module.exports = mongoose.model('BillingCode', BillingCodeSchema);
