const mongoose = require('mongoose');

const trainingProgressSchema = new mongoose.Schema({
  materialId: { type: mongoose.Schema.Types.ObjectId, ref: 'TrainingMaterial', required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  status: { type: String, enum: ['NOT_STARTED', 'IN_PROGRESS', 'COMPLETED'], default: 'NOT_STARTED' },
  completedAt: Date,
  notes: String,
  timeSpentMinutes: { type: Number, default: 0 },
  lastAccessedAt: Date,
  startedAt: Date,
  certificate: {
    s3Key: String,
    s3Url: String,
    originalName: String,
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    uploadedAt: Date
  }
}, { timestamps: true });

trainingProgressSchema.index({ materialId: 1, userId: 1 }, { unique: true });

module.exports = mongoose.model('TrainingProgress', trainingProgressSchema);
