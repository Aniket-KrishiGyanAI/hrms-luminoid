const mongoose = require('mongoose');

const folderSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: String,
  color: { type: String, default: '#f59e0b' },
  icon: { type: String, default: 'folder' },
  accessType: {
    type: String,
    enum: ['VIEW_PRINT', 'FULL'],
    default: 'FULL'
  },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  visibility: {
    type: { type: String, enum: ['ALL', 'DEPARTMENTS', 'ROLES', 'SPECIFIC_EMPLOYEES'], default: 'ALL' },
    departments: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Department' }],
    roles: [{ type: String, enum: ['ADMIN', 'HR', 'MANAGER', 'EMPLOYEE'] }],
    employees: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }]
  },
  expiryDate: { type: Date, default: null },
  maxFileSizeMB: { type: Number, default: null },
  allowedFileTypes: { type: [String], default: [] }, // e.g. ['pdf','image','word']
  isPasswordProtected: { type: Boolean, default: false },
  folderPassword: { type: String, default: null },
  tags: { type: [String], default: [] },
  isArchived: { type: Boolean, default: false }
}, { timestamps: true });

module.exports = mongoose.model('Folder', folderSchema);
