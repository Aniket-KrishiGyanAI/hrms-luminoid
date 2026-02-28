const mongoose = require('mongoose');

const leaveRequestSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  leaveTypeId: { type: mongoose.Schema.Types.ObjectId, ref: 'LeaveType', required: true, index: true },
  startDate: { type: Date, required: true, index: true },
  endDate: { type: Date, required: true, index: true },
  days: { type: Number, required: true },
  isHalfDay: { type: Boolean, default: false },
  halfDayType: { type: String, enum: ['FIRST_HALF', 'SECOND_HALF'] },
  reason: { type: String, required: true },
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
  isLOP: { type: Boolean, default: false }
}, { timestamps: true });

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