// Attendance Configuration
module.exports = {
  // Working hours thresholds
  FULL_DAY_HOURS: 8,
  HALF_DAY_HOURS: 4,
  LOP_THRESHOLD: 4,
  
  // Time settings
  OFFICE_START_TIME: 10, // 10 AM (default - can be overridden per office)
  OFFICE_END_TIME: 18, // 6 PM (default - can be overridden per office)
  LATE_GRACE_MINUTES: 0, // Default grace period (can be overridden per office via compensationMinutes)
  
  // Break time
  DEFAULT_BREAK_MINUTES: 0, // Break time NOT deducted (employees get full credit for hours worked)
  
  // GPS Accuracy
  MAX_GPS_ACCURACY: 50, // Maximum allowed GPS accuracy in meters (lower is more accurate)
  
  // Auto checkout
  AUTO_CHECKOUT_TIME: { hour: 18, minute: 0 }, // 6:00 PM - default checkout time for remote/hybrid
  AUTO_CHECKOUT_BUFFER_MINUTES: 30, // Buffer time added to office end time before auto-checkout
  // Note: Office employees are auto-checked out at their office's end time + buffer minutes
  // Cron runs every 30 minutes from 6 PM to 11 PM to handle different office end times
  
  // Overtime
  OVERTIME_THRESHOLD: 8, // Hours after which overtime is calculated
  OVERTIME_ENABLED: true, // Enable overtime tracking
  
  // Status priorities (for conflict resolution)
  STATUS_PRIORITY: {
    'LOP': 1,
    'Absent': 2,
    'Half Day': 3,
    'Late': 4,
    'Present': 5,
    'On Leave': 6
  }
};
