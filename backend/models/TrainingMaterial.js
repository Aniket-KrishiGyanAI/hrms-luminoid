const mongoose = require('mongoose');

const trainingMaterialSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: String,
  category: String,
  s3Key: String,
  s3Url: String,
  originalName: String,
  mimeType: String,
  size: Number,
  externalUrl: String, // for video links / external resources
  uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  targetRoles: [{ type: String, enum: ['ADMIN', 'HR', 'MANAGER', 'EMPLOYEE'] }],
  targetDepartments: [{ type: String }], // stored as department name strings (e.g. 'Sales', 'Engineering')
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

module.exports = mongoose.model('TrainingMaterial', trainingMaterialSchema);
