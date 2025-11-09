/**
 * Job Log Model
 * Tracks execution of scheduled jobs
 */

const mongoose = require('mongoose');

const jobLogSchema = new mongoose.Schema({
  jobName: {
    type: String,
    required: true,
    index: true
  },
  status: {
    type: String,
    required: true,
    enum: ['completed', 'failed', 'running'],
    index: true
  },
  startTime: {
    type: Date,
    required: true,
    index: true
  },
  endTime: {
    type: Date
  },
  duration: {
    type: Number // Duration in milliseconds
  },
  results: {
    type: mongoose.Schema.Types.Mixed
  },
  error: {
    type: String
  }
}, {
  timestamps: true,
  collection: 'joblogs'
});

// Calculate duration before saving
jobLogSchema.pre('save', function(next) {
  if (this.startTime && this.endTime) {
    this.duration = this.endTime.getTime() - this.startTime.getTime();
  }
  next();
});

// Index for efficient querying
jobLogSchema.index({ jobName: 1, startTime: -1 });
jobLogSchema.index({ status: 1, startTime: -1 });

// TTL index to automatically delete old job logs after 1 year
jobLogSchema.index(
  { startTime: 1 },
  { expireAfterSeconds: 365 * 24 * 60 * 60 }
);

const JobLog = mongoose.model('JobLog', jobLogSchema);

module.exports = JobLog;
