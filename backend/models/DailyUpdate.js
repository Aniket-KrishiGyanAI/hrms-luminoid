const mongoose = require('mongoose');

const commentSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  text: {
    type: String,
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

const dailyUpdateSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  title: {
    type: String,
    trim: true
  },
  content: {
    type: String,
    required: true,
    trim: true
  },
  category: {
    type: String,
    enum: ['announcement', 'policy', 'achievement', 'event', 'training', 'spotlight', 'general'],
    default: 'general'
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high'],
    default: 'low'
  },
  tags: [{
    type: String,
    trim: true
  }],
  likes: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  comments: [commentSchema],
  attachments: [{
    filename: String,
    url: String,
    type: String
  }],
  visibility: {
    type: String,
    enum: ['PUBLIC', 'TEAM', 'PRIVATE'],
    default: 'PUBLIC'
  },
  isPinned: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

// Index for better query performance
dailyUpdateSchema.index({ userId: 1, createdAt: -1 });
dailyUpdateSchema.index({ category: 1 });
dailyUpdateSchema.index({ tags: 1 });
dailyUpdateSchema.index({ isPinned: -1, createdAt: -1 });

module.exports = mongoose.model('DailyUpdate', dailyUpdateSchema);
