const mongoose = require('mongoose');

const WorklistItemSchema = new mongoose.Schema({
  // Study Reference
  studyInstanceUID: { type: String, required: true, index: true },
  patientID: { type: String, required: true, index: true },
  
  // Workflow Status
  status: {
    type: String,
    enum: ['pending', 'in_progress', 'completed', 'cancelled'],
    default: 'pending',
    index: true
  },
  
  // Priority
  priority: {
    type: String,
    enum: ['routine', 'urgent', 'stat'],
    default: 'routine',
    index: true
  },
  
  // Assignment
  assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
  assignedAt: Date,
  
  // Timing
  scheduledFor: Date,
  startedAt: Date,
  completedAt: Date,
  
  // Report Reference
  reportId: String,
  reportStatus: {
    type: String,
    enum: ['none', 'draft', 'finalized'],
    default: 'none'
  },
  
  // Critical Results
  hasCriticalFindings: { type: Boolean, default: false },
  criticalFindingsNotified: { type: Boolean, default: false },
  
  // Notes
  notes: String,
  
  // Hospital Reference
  // ✅ WORKLIST EMPTY FIX: Make hospitalId optional to allow migration of existing items
  hospitalId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    index: true,
    required: false // Changed from true to allow fixing existing items
  }
}, { timestamps: true });

// ✅ WORKLIST EMPTY FIX: Indexes for efficient worklist queries
// { hospitalId:1, status:1, updatedAt:-1 }, { studyInstanceUID:1 } unique
WorklistItemSchema.index({ hospitalId: 1, status: 1, updatedAt: -1 });
WorklistItemSchema.index({ studyInstanceUID: 1 }, { unique: true });
WorklistItemSchema.index({ assignedTo: 1, status: 1, priority: -1 });
WorklistItemSchema.index({ hospitalId: 1, hasCriticalFindings: 1, criticalFindingsNotified: 1 });

module.exports = mongoose.model('WorklistItem', WorklistItemSchema);
