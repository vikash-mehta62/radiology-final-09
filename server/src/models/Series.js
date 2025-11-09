const mongoose = require('mongoose');

const SeriesSchema = new mongoose.Schema({
  // DICOM Identifiers
  studyInstanceUID: { type: String, index: true, required: true },
  seriesInstanceUID: { type: String, unique: true, index: true, required: true },

  // Series Metadata
  modality: String,
  seriesNumber: Number,
  description: String,
  seriesDate: String,
  seriesTime: String,

  // Instance Counts
  numberOfInstances: { type: Number, default: 0 },
  numberOfFrames: { type: Number, default: 0 },

  // Orthanc Integration
  orthancSeriesId: String, // Orthanc series UUID
  orthancUrl: String, // Full Orthanc series URL

  // Body Part and Anatomy
  bodyPartExamined: String,
  laterality: String, // 'L', 'R', 'B' (bilateral)

  // Acquisition Info
  protocolName: String,
  performingPhysician: String,
  operatorName: String,

  // Processing Status
  processed: { type: Boolean, default: false },
  processingError: String,

  // Quality Metrics
  imageQuality: String, // 'good', 'acceptable', 'poor'
  qualityNotes: String

}, {
  timestamps: true,
  collection: 'series'
});

// Indexes for performance
SeriesSchema.index({ studyInstanceUID: 1, seriesNumber: 1 });
SeriesSchema.index({ orthancSeriesId: 1 });
SeriesSchema.index({ modality: 1 });

// Static method to find series by study
SeriesSchema.statics.findByStudy = function (studyInstanceUID) {
  return this.find({ studyInstanceUID }).sort({ seriesNumber: 1 });
};

// Static method to get series count for study
SeriesSchema.statics.getStudySeriesCount = async function (studyInstanceUID) {
  return this.countDocuments({ studyInstanceUID });
};

module.exports = mongoose.model('Series', SeriesSchema);