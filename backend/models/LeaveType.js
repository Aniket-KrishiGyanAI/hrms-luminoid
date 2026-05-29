const mongoose = require('mongoose');

const leaveTypeSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  description: String,
  accrualType: { type: String, enum: ['MONTHLY', 'YEARLY'], required: true },
  accrualRate: { type: Number, required: true }, // days per month/year
  maxPerYear: { type: Number, required: true },
  carryForward: { type: Boolean, default: false },
  maxCarryForward: { type: Number, default: 0 },
  lopEnabled: { type: Boolean, default: false },
  isPaid: { type: Boolean, default: true },
  isActive: { type: Boolean, default: true },
  color: { type: String, default: '#007bff' }
}, { timestamps: true });

module.exports = mongoose.model('LeaveType', leaveTypeSchema);