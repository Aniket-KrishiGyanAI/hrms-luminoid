const mongoose = require('mongoose');
const { addSoftDelete } = require('../utils/schemaHelpers');

const announcementSchema = new mongoose.Schema({
  title: { 
    type: String, 
    required: [true, 'Title is required'],
    trim: true,
    minlength: [5, 'Title must be at least 5 characters'],
    maxlength: [200, 'Title cannot exceed 200 characters']
  },
  content: { 
    type: String, 
    required: [true, 'Content is required'],
    trim: true,
    minlength: [10, 'Content must be at least 10 characters'],
    maxlength: [2000, 'Content cannot exceed 2000 characters']
  },
  priority: { type: String, enum: ['LOW', 'MEDIUM', 'HIGH'], default: 'MEDIUM' },
  targetRoles: [{ type: String, enum: ['ADMIN', 'HR', 'MANAGER', 'EMPLOYEE'] }],
  targetDepartments: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Department' }],
  createdBy: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: [true, 'Creator is required']
  },
  isActive: { type: Boolean, default: true },
  expiryDate: Date
}, { 
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Add soft delete functionality
addSoftDelete(announcementSchema);

module.exports = mongoose.model('Announcement', announcementSchema);