const mongoose = require('mongoose');

const attendancePolicySchema = new mongoose.Schema({
  workingHours: {
    standardStart: { type: String, default: '9:00 AM' },
    standardEnd: { type: String, default: '6:00 PM' },
    totalHours: { type: String, default: '9 hours including 1 hour lunch break' },
    coreHoursStart: { type: String, default: '10:00 AM' },
    coreHoursEnd: { type: String, default: '4:00 PM' },
    flexibility: { type: String, default: '±1 hour flexibility for start/end time' },
    minimumHours: { type: String, default: '8 hours per day required' }
  },
  lateArrival: {
    gracePeriod: { type: String, default: '15 minutes (9:00 AM - 9:15 AM)' },
    lateMark: { type: String, default: 'After 9:15 AM marked as "Late"' },
    halfDay: { type: String, default: 'Arrival after 11:00 AM' },
    monthlyLimit: { type: String, default: 'Maximum 3 late arrivals per month' }
  },
  checkInRequirements: {
    gpsMandatory: { type: String, default: 'Location services must be enabled' },
    officeMode: { type: String, default: 'Must be within office GPS radius' },
    remoteMode: { type: String, default: 'Check-in from home location' },
    hybridMode: { type: String, default: 'Flexible location for field work' }
  },
  importantNotes: {
    forgotCheckout: { type: String, default: 'Auto check-out at 11:59 PM' },
    missedAttendance: { type: String, default: 'Contact HR within 24 hours' },
    leaveDays: { type: String, default: 'No attendance marking required' },
    holidays: { type: String, default: 'Attendance not counted' }
  },
  helpContact: {
    email: { type: String, default: 'hr@company.com' },
    phone: { type: String, default: '+91-XXXX-XXXXXX' }
  },
  lastUpdatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  lastUpdatedAt: { type: Date, default: Date.now }
}, { timestamps: true });

module.exports = mongoose.model('AttendancePolicy', attendancePolicySchema);
