const mongoose = require('mongoose');
const { addSoftDelete, validationHelpers } = require('../utils/schemaHelpers');

const leaveRequestSchema = new mongoose.Schema({
  userId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: [true, 'User ID is required'],
    index: true 
  },
  leaveTypeId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'LeaveType', 
    required: [true, 'Leave type is required'],
    index: true 
  },
  startDate: { 
    type: Date, 
    required: [true, 'Start date is required'],
    index: true,
    validate: {
      validator: function(v) {
        return v instanceof Date && !isNaN(v);
      },
      message: 'Invalid start date'
    }
  },
  endDate: { 
    type: Date, 
    required: [true, 'End date is required'],
    index: true,
    validate: {
      validator: function(v) {
        return v instanceof Date && !isNaN(v) && v >= this.startDate;
      },
      message: 'End date must be after or equal to start date'
    }
  },
  days: { 
    type: Number, 
    required: [true, 'Number of days is required'],
    min: [0.5, 'Days must be at least 0.5']
  },
  isHalfDay: { type: Boolean, default: false },
  halfDayType: { type: String, enum: ['FIRST_HALF', 'SECOND_HALF'] },
  reason: { 
    type: String, 
    required: [true, 'Reason is required'],
    trim: true,
    minlength: [10, 'Reason must be at least 10 characters'],
    maxlength: [500, 'Reason cannot exceed 500 characters']
  },
  contactNumber: String,
  emergencyContact: String,
  addressDuringLeave: String,
  handoverTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  attachments: [{
    filename: String,
    path: String,
    uploadedAt: { type: Date, default: Date.now }
  }],
  status: { 
    type: String, 
    enum: ['PENDING', 'MANAGER_APPROVED', 'HR_APPROVED', 'REJECTED', 'CANCELLED'],
    default: 'PENDING',
    index: true
  },
  managerApproval: {
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    approvedAt: Date,
    comments: String
  },
  hrApproval: {
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    approvedAt: Date,
    comments: String
  },
  rejectionReason: String,
  rejectedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  rejectedAt: Date,
  isLOP: { type: Boolean, default: false }
}, { 
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Add soft delete functionality
addSoftDelete(leaveRequestSchema);

leaveRequestSchema.index({ userId: 1, status: 1 });
leaveRequestSchema.index({ startDate: 1, endDate: 1 });

leaveRequestSchema.pre('save', function(next) {
  if (this.startDate && this.endDate && !this.days) {
    const timeDiff = this.endDate.getTime() - this.startDate.getTime();
    this.days = Math.ceil(timeDiff / (1000 * 3600 * 24)) + 1;
    if (this.isHalfDay) this.days = 0.5;
  }
  next();
});

module.exports = mongoose.model('LeaveRequest', leaveRequestSchema);