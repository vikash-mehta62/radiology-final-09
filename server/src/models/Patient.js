const mongoose = require('mongoose');

const PatientSchema = new mongoose.Schema({
  patientID: { type: String, unique: true, index: true },
  patientName: { type: String },
  birthDate: { type: String },
  sex: { type: String },
  studyIds: { type: [String], default: [] },
  hospitalId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    index: true, 
    required: false 
  } // Hospital reference using ObjectId
}, { timestamps: true });

// Index for hospital-based queries
PatientSchema.index({ hospitalId: 1, patientID: 1 });

module.exports = mongoose.model('Patient', PatientSchema);