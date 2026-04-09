const mongoose = require('mongoose');

const fpoFormSchema = new mongoose.Schema({
  fpoName: {
    type: String,
    required: true,
    trim: true
  },
  fpoOwnerName: {
    type: String,
    required: true,
    trim: true
  },
  mobileNumber: {
    type: String,
    required: true,
    trim: true
  },
  emailAddress: {
    type: String,
    required: true,
    trim: true,
    lowercase: true
  },
  totalFarmers: {
    type: Number,
    required: true
  },
  cropsGrown: {
    type: String,
    required: true,
    trim: true
  },
  hasWebsite: {
    type: String,
    enum: ['Yes, we have', 'No, we don\'t have a website'],
    required: true
  },
  websiteUrl: {
    type: String,
    trim: true
  },
  submittedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  status: {
    type: String,
    enum: ['PENDING', 'REVIEWED', 'APPROVED', 'REJECTED'],
    default: 'PENDING'
  },
  reviewedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  reviewNotes: {
    type: String,
    trim: true
  },
  reviewedAt: {
    type: Date
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('FpoForm', fpoFormSchema);
