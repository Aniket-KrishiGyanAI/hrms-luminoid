const mongoose = require('mongoose');

const workLogSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  date: {
    type: Date,
    default: Date.now
  },
  workDone: {
    type: String,
    required: true
  },
  hoursSpent: {
    type: Number,
    required: true
  },
  category: {
    type: String,
    default: 'GENERAL'
  },
  templateData: {
    type: mongoose.Schema.Types.Mixed
  },
  comments: [{
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    text: String,
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],
  status: {
    type: String,
    enum: ['COMPLETED', 'IN_PROGRESS', 'PENDING', 'ON_HOLD', 'BLOCKED', 'CANCELLED'],
    default: 'COMPLETED'
  },
  project: {
    type: String
  },
  deliverables: {
    type: String
  },
  location: {
    type: String,
    enum: ['OFFICE', 'REMOTE', 'CLIENT_SITE', 'FIELD'],
    default: 'OFFICE'
  },
  issues: {
    type: String
  }
}, { timestamps: true });

workLogSchema.index({ userId: 1, date: -1 });
workLogSchema.index({ userId: 1, date: 1, project: 1 });

module.exports = mongoose.model('WorkLog', workLogSchema);
