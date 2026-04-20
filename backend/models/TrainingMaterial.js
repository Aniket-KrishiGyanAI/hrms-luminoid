const mongoose = require('mongoose');

const ratingSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  rating: { type: Number, required: true, min: 1, max: 5 },
  comment: String,
  createdAt: { type: Date, default: Date.now }
});

const trainingMaterialSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: String,
  category: String,
  s3Key: String,
  s3Url: String,
  originalName: String,
  mimeType: String,
  size: Number,
  thumbnailS3Key: String,
  thumbnailUrl: String,
  externalUrl: String, // for video links / external resources
  additionalFiles: [{
    s3Key: String,
    s3Url: String,
    originalName: String,
    mimeType: String,
    size: Number
  }],
  uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  targetRoles: [{ type: String, enum: ['ADMIN', 'HR', 'MANAGER', 'EMPLOYEE'] }],
  targetDepartments: [{ type: String }], // stored as department name strings (e.g. 'Sales', 'Engineering')
  isMandatory: { type: Boolean, default: false },
  dueDate: Date,
  isActive: { type: Boolean, default: true },
  ratings: [ratingSchema],
  averageRating: { type: Number, default: 0 },
  totalRatings: { type: Number, default: 0 },
  estimatedMinutes: { type: Number, default: 0 },
  viewCount: { type: Number, default: 0 },
  completionCount: { type: Number, default: 0 }
}, { timestamps: true });

module.exports = mongoose.model('TrainingMaterial', trainingMaterialSchema);
