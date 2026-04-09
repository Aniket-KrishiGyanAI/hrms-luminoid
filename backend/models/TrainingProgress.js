const mongoose = require('mongoose');

const trainingProgressSchema = new mongoose.Schema({
  materialId: { type: mongoose.Schema.Types.ObjectId, ref: 'TrainingMaterial', required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  status: { type: String, enum: ['NOT_STARTED', 'IN_PROGRESS', 'COMPLETED'], default: 'NOT_STARTED' },
  completedAt: Date,
  notes: String
}, { timestamps: true });

trainingProgressSchema.index({ materialId: 1, userId: 1 }, { unique: true });

module.exports = mongoose.model('TrainingProgress', trainingProgressSchema);
