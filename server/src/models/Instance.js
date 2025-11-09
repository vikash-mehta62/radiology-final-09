const mongoose = require('mongoose');

const InstanceSchema = new mongoose.Schema({
  // DICOM Identifiers
  studyInstanceUID: { type: String, index: true, required: true },
  seriesInstanceUID: { type: String, index: true, required: true },
  sopInstanceUID: { type: String, unique: true, index: true, required: true },
  instanceNumber: { type: Number, default: 0 },
  
  // DICOM Metadata
  modality: String,
  transferSyntaxUID: String,
  sopClassUID: String,
  
  // Image Properties
  rows: Number,
  columns: Number,
  numberOfFrames: { type: Number, default: 1 },
  bitsAllocated: Number,
  bitsStored: Number,
  pixelRepresentation: Number,
  samplesPerPixel: Number,
  photometricInterpretation: String,
  
  // Pixel Spacing and Calibration
  pixelSpacing: [Number], // [row spacing, column spacing]
  sliceThickness: Number,
  sliceLocation: Number,
  imagePosition: [Number], // [x, y, z]
  imageOrientation: [Number], // [row x, row y, row z, col x, col y, col z]
  
  // Window/Level
  windowCenter: [Number],
  windowWidth: [Number],
  rescaleIntercept: Number,
  rescaleSlope: Number,
  
  // Acquisition Info
  acquisitionDate: String,
  acquisitionTime: String,
  acquisitionNumber: Number,
  
  // Content Info
  instanceCreationDate: String,
  instanceCreationTime: String,
  contentDate: String,
  contentTime: String,
  
  // File Info
  fileSize: Number, // Size in bytes
  
  // Orthanc Integration (PRIMARY STORAGE)
  orthancInstanceId: { type: String }, // Orthanc instance UUID
  orthancUrl: String, // Full Orthanc instance URL
  orthancFrameIndex: { type: Number, default: 0 }, // Frame index within multi-frame DICOM
  orthancStudyId: String, // Orthanc study ID
  orthancSeriesId: String, // Orthanc series ID
  useOrthancPreview: { type: Boolean, default: true }, // Use Orthanc for preview
  
  // Filesystem Cache (FAST ACCESS)
  filesystemPath: String, // Path to cached PNG frame
  filesystemCached: { type: Boolean, default: false }, // Whether frame is cached
  cachedAt: Date, // When frame was cached
  cacheSize: Number, // Size of cached file in bytes
  
  // Local File Storage (for uploaded DICOM files)
  localFilePath: String, // Path to original DICOM file on local filesystem
  
  // Processing Status
  processed: { type: Boolean, default: false },
  processingError: String,
  
  // Quality Control
  imageQuality: String, // 'good', 'acceptable', 'poor'
  qualityNotes: String,
  
  // Annotations and Measurements
  hasAnnotations: { type: Boolean, default: false },
  hasMeasurements: { type: Boolean, default: false },
  
  // AI Analysis
  aiProcessed: { type: Boolean, default: false },
  aiFindings: mongoose.Schema.Types.Mixed,
  
}, { 
  timestamps: true, // Adds createdAt and updatedAt
  collection: 'instances'
});

// Indexes for performance
InstanceSchema.index({ studyInstanceUID: 1, instanceNumber: 1 });
InstanceSchema.index({ seriesInstanceUID: 1, instanceNumber: 1 });
InstanceSchema.index({ orthancInstanceId: 1 });
InstanceSchema.index({ filesystemCached: 1 });
InstanceSchema.index({ processed: 1 });

// Virtual for frame URL
InstanceSchema.virtual('frameUrl').get(function() {
  return `/api/dicom/studies/${this.studyInstanceUID}/frames/${this.instanceNumber}`;
});

// Virtual for Orthanc preview URL
InstanceSchema.virtual('orthancPreviewUrl').get(function() {
  if (this.orthancInstanceId) {
    return `${process.env.ORTHANC_URL || 'http://69.62.70.102:8042'}/instances/${this.orthancInstanceId}/preview`;
  }
  return null;
});

// Method to check if frame is available
InstanceSchema.methods.isFrameAvailable = function() {
  return this.filesystemCached || this.orthancInstanceId || this.localFilePath;
};

// Method to get frame source priority
InstanceSchema.methods.getFrameSource = function() {
  if (this.filesystemCached && this.filesystemPath) {
    return { type: 'filesystem', path: this.filesystemPath };
  }
  if (this.orthancInstanceId) {
    return { type: 'orthanc', id: this.orthancInstanceId };
  }
  if (this.localFilePath) {
    return { type: 'local', path: this.localFilePath };
  }
  return { type: 'none', path: null };
};

// Static method to find instances by study
InstanceSchema.statics.findByStudy = function(studyInstanceUID) {
  return this.find({ studyInstanceUID }).sort({ instanceNumber: 1 });
};

// Static method to find instances by series
InstanceSchema.statics.findBySeries = function(seriesInstanceUID) {
  return this.find({ seriesInstanceUID }).sort({ instanceNumber: 1 });
};

// Static method to get frame count for study
InstanceSchema.statics.getStudyFrameCount = async function(studyInstanceUID) {
  const instances = await this.find({ studyInstanceUID });
  return instances.reduce((total, inst) => total + (inst.numberOfFrames || 1), 0);
};

// Pre-save hook to update processing status
InstanceSchema.pre('save', function(next) {
  if (this.isNew) {
    this.processed = false;
  }
  next();
});

module.exports = mongoose.model('Instance', InstanceSchema);