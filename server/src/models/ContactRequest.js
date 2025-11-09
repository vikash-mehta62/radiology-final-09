const mongoose = require('mongoose');

const ContactRequestSchema = new mongoose.Schema({
  requestId: {
    type: String,
    unique: true,
    required: true,
    index: true
  },
  type: {
    type: String,
    enum: ['demo', 'trial', 'contact', 'support', 'partnership'],
    required: true
  },
  status: {
    type: String,
    enum: ['new', 'contacted', 'in_progress', 'converted', 'closed', 'spam'],
    default: 'new'
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium'
  },
  
  // Contact Information
  contactInfo: {
    name: { type: String, required: true },
    email: { type: String, required: true },
    phone: String,
    organization: String,
    position: String,
    country: String
  },
  
  // Request Details
  details: {
    subject: String,
    message: { type: String, required: true },
    interestedIn: [String], // ['pacs', 'ai', 'reporting', 'cloud']
    estimatedUsers: Number,
    estimatedStudiesPerMonth: Number,
    currentSystem: String,
    timeline: String, // 'immediate', '1-3 months', '3-6 months', '6+ months'
    budget: String
  },
  
  // Tracking
  source: {
    type: String,
    default: 'website'
  },
  ipAddress: String,
  userAgent: String,
  referrer: String,
  
  // Follow-up
  assignedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  notes: [{
    addedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    note: String,
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],
  followUpDate: Date,
  lastContactedAt: Date,
  
  // Conversion
  convertedToHospitalId: String,
  convertedAt: Date,
  
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

ContactRequestSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

ContactRequestSchema.index({ status: 1, priority: -1, createdAt: -1 });
ContactRequestSchema.index({ 'contactInfo.email': 1 });

module.exports = mongoose.model('ContactRequest', ContactRequestSchema);
