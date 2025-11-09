const mongoose = require('mongoose');

const StudySchema = new mongoose.Schema({
  studyInstanceUID: { type: String, unique: true, index: true },
  studyDate: String,
  studyTime: String,
  patientName: String,
  patientID: String,
  patientBirthDate: String,
  patientSex: String,
  modality: String,
  studyDescription: String,
  numberOfSeries: Number,
  numberOfInstances: Number,
  hospitalId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    index: true, 
    required: false 
  }, // Hospital reference using ObjectId
  
  // AI Analysis Results
  aiAnalysis: {
    type: mongoose.Schema.Types.Mixed,
    default: null
  },
  aiAnalyzedAt: Date,
  aiModels: [String] // List of AI models used (e.g., ['MedSigLIP-0.4B', 'MedGemma-4B'])
}, { timestamps: true });

// Index for hospital-based queries
StudySchema.index({ hospitalId: 1, studyInstanceUID: 1 });
StudySchema.index({ hospitalId: 1, patientID: 1 });

module.exports = mongoose.model('Study', StudySchema);