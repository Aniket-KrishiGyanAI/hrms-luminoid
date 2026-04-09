const mongoose = require('mongoose');

const fileSchema = new mongoose.Schema({
  name: { type: String, required: true },
  originalName: { type: String, required: true },
  s3Key: { type: String, required: true },
  s3Url: { type: String, required: true },
  size: Number,
  mimeType: String,
  type: { type: String, enum: ['ORGANIZATION', 'EMPLOYEE'], required: true },
  category: String,
  uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  targetUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // For employee files
  isPublic: { type: Boolean, default: false }, // kept for backward compat
  visibility: {
    type: { type: String, enum: ['ALL', 'DEPARTMENTS', 'ROLES', 'SPECIFIC_EMPLOYEES'], default: 'ALL' },
    departments: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Department' }],
    roles: [{ type: String, enum: ['ADMIN', 'HR', 'MANAGER', 'EMPLOYEE'] }],
    employees: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }]
  },
  description: String,
  requiresAcknowledgment: { type: Boolean, default: false },
  isLocked: { type: Boolean, default: false }, // For employee document submission lock
  
  // Document Verification Status
  verificationStatus: { 
    type: String, 
    enum: ['UNVERIFIED', 'VERIFIED', 'EXPIRED', 'INVALID'], 
    default: 'UNVERIFIED' 
  },
  verifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  verifiedAt: Date,
  expiryDate: Date,
  verificationNotes: String,
  folderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Folder', default: null }
}, { timestamps: true });

module.exports = mongoose.model('File', fileSchema);