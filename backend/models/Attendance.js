const mongoose = require("mongoose");
const attendanceConfig = require("../config/attendanceConfig");

const attendanceSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    date: {
      type: Date,
      required: true,
    },

    checkIn: Date,
    checkOut: Date,

    breakTime: {
      type: Number,
      default: 0, // minutes
    },

    totalHours: {
      type: Number,
      default: 0,
    },

    overtimeHours: {
      type: Number,
      default: 0,
    },

    status: {
      type: String,
      enum: ["Present", "Absent", "Half Day", "Late", "On Leave", "LOP"],
      default: "Absent",
    },

    workMode: {
      type: String,
      enum: ["OFFICE", "REMOTE", "HYBRID"],
      default: "OFFICE",
    },

    location: {
      checkInLocation: {
        latitude: Number,
        longitude: Number,
        accuracy: Number, // 🔐 GPS accuracy in meters
        address: String,
      },
      checkOutLocation: {
        latitude: Number,
        longitude: Number,
        accuracy: Number,
        address: String,
      },
    },

    // Optional: keep for audit/logging (NOT for restriction)
    ipAddress: {
      type: String,
    },

    notes: String,

    isManualEntry: {
      type: Boolean,
      default: false,
    },

    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    //for Update the attendance
    lastEditedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    lastEditedAt: Date,
    editReason: String,

    isDeleted: {
      type: Boolean,
      default: false,
    },
    deletedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    deletedAt: Date,
    deletionReason: String,

    isAutoCheckout: {
      type: Boolean,
      default: false,
    },

    officeLocation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'OfficeLocation',
      default: null,
    },
    officeLocationName: { type: String, default: null },
    
    // Track if employee arrived late (for reporting purposes)
    arrivedLate: {
      type: Boolean,
      default: false,
    },
    lateByMinutes: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true },
);

// 🔒 One attendance per user per day (excluding deleted records)
attendanceSchema.index({ userId: 1, date: 1 }, { unique: true, partialFilterExpression: { isDeleted: false } });
attendanceSchema.index({ date: 1, isDeleted: 1, status: 1, totalHours: 1 });
attendanceSchema.index({ userId: 1, date: -1 });

attendanceSchema.pre("save", async function (next) {
  const {
    FULL_DAY_HOURS,
    HALF_DAY_HOURS,
    LOP_THRESHOLD,
    LATE_GRACE_MINUTES,
    OFFICE_START_TIME,
    DEFAULT_BREAK_MINUTES,
    OVERTIME_THRESHOLD,
    OVERTIME_ENABLED
  } = attendanceConfig;

  // Use per-office start time and grace period if available
  let officeStartHour = OFFICE_START_TIME;
  let officeStartMinute = 0;
  let graceMinutes = LATE_GRACE_MINUTES;
  
  if (this.officeLocation) {
    try {
      const OfficeLocation = require('./OfficeLocation');
      const office = await OfficeLocation.findById(this.officeLocation);
      if (office) {
        officeStartHour = office.startTime;
        officeStartMinute = office.startMinute || 0;
        graceMinutes = office.compensationMinutes || 0;
      }
    } catch (e) { /* fallback to default */ }
  }

  // Calculate office start time in total minutes from midnight
  const officeStartTotalMinutes = officeStartHour * 60 + officeStartMinute;

  // Check if employee arrived late (track for reporting)
  let arrivedLate = false;
  if (this.checkIn) {
    const checkInTime = new Date(this.checkIn);
    const checkInTotalMinutes = checkInTime.getHours() * 60 + checkInTime.getMinutes();
    const lateByMinutes = checkInTotalMinutes - officeStartTotalMinutes;
    
    // Employee is late only if they arrived AFTER the grace period
    arrivedLate = lateByMinutes > graceMinutes;
    this.arrivedLate = arrivedLate;
    this.lateByMinutes = Math.max(0, lateByMinutes);
  }

  if (this.checkIn && this.checkOut) {
    // Calculate total hours
    const diffMs = this.checkOut - this.checkIn;
    let totalMinutes = diffMs / (1000 * 60);
    
    // NOTE: Break time is NOT auto-applied
    // Employees get full credit for hours worked (check-out - check-in)
    // If you want to deduct break time, HR can manually set it when editing
    
    // Only apply break time if manually set by HR/Admin
    if (this.breakTime > 0) {
      totalMinutes -= this.breakTime;
    }
    
    this.totalHours = Math.max(0, Math.round((totalMinutes / 60) * 100) / 100);

    // Calculate overtime if enabled
    if (OVERTIME_ENABLED && this.totalHours > OVERTIME_THRESHOLD) {
      this.overtimeHours = Math.round((this.totalHours - OVERTIME_THRESHOLD) * 100) / 100;
    } else {
      this.overtimeHours = 0;
    }

    // Only auto-calculate status if not manual entry
    if (!this.isManualEntry) {
      // FIXED LOGIC: Status based on hours worked, not arrival time
      // "Late" status only applies if they didn't complete full hours
      
      if (this.totalHours < LOP_THRESHOLD) {
        // Less than 4 hours = LOP (Loss of Pay)
        this.status = "LOP";
      } else if (this.totalHours < HALF_DAY_HOURS) {
        // Less than 4 hours but more than LOP threshold = Half Day
        this.status = "Half Day";
      } else if (this.totalHours >= FULL_DAY_HOURS) {
        // 8+ hours worked = Present (regardless of arrival time)
        // Employee compensated for late arrival by working full hours
        this.status = "Present";
      } else {
        // Between 4-8 hours
        // Mark as "Late" only if they arrived late AND didn't complete 8 hours
        this.status = arrivedLate ? "Late" : "Half Day";
      }
    }
  } else if (this.checkIn && !this.checkOut && !this.isManualEntry) {
    // Only checked in - mark as Late or Present based on arrival time with grace period
    this.status = arrivedLate ? "Late" : "Present";
  }

  next();
});

module.exports = mongoose.model("Attendance", attendanceSchema);
