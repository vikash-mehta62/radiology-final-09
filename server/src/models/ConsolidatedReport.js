const mongoose = require('mongoose');

const consolidatedReportSchema = new mongoose.Schema({
  reportId: {
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
  
  totalSlices: {
    type: Number,
    required: true
  },
  
  slices: [Number],
  
  analyses: [{
    sliceIndex: Number,
    classification: String,
    confidence: Number,
    findings: String
  }],
  
  summary: {
    totalAnalyzed: Number,
    classifications: mongoose.Schema.Types.Mixed,
    mostCommonFinding: String,
    averageConfidence: Number,
    summary: String
  },
  
  generatedAt: {
    type: Date,
    default: Date.now,
    index: true
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('ConsolidatedReport', consolidatedReportSchema);
