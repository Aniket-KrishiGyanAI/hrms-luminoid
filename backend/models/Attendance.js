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
  },
  { timestamps: true },
);

// 🔒 One attendance per user per day
attendanceSchema.index({ userId: 1, date: 1 }, { unique: true });

attendanceSchema.pre("save", function (next) {
  if (this.isManualEntry) return next();

  const {
    FULL_DAY_HOURS,
    HALF_DAY_HOURS,
    LOP_THRESHOLD,
    LATE_GRACE_MINUTES,
    OFFICE_START_TIME
  } = attendanceConfig;

  const OFFICE_START_HOUR = OFFICE_START_TIME * 60; // in minutes

  if (this.checkIn && this.checkOut) {
    // Calculate total hours worked
    const diffMs = this.checkOut - this.checkIn;
    let totalMinutes = diffMs / (1000 * 60);
    
    // Subtract break time if exists
    if (this.breakTime > 0) {
      totalMinutes -= this.breakTime;
    }
    
    this.totalHours = Math.round((totalMinutes / 60) * 100) / 100;

    // Check if employee arrived late
    const checkInTime = new Date(this.checkIn);
    const checkInMinutes = checkInTime.getHours() * 60 + checkInTime.getMinutes();
    const lateByMinutes = checkInMinutes - OFFICE_START_HOUR;
    const isLate = lateByMinutes > LATE_GRACE_MINUTES;

    // Determine status based on hours worked and arrival time
    if (this.totalHours < LOP_THRESHOLD) {
      this.status = "LOP";
    } else if (this.totalHours < HALF_DAY_HOURS) {
      this.status = "Half Day";
    } else if (this.totalHours >= FULL_DAY_HOURS) {
      // Full hours worked, but check if late
      this.status = isLate ? "Late" : "Present";
    } else {
      // Between 4-8 hours
      this.status = isLate ? "Late" : "Half Day";
    }
  } else if (this.checkIn && !this.checkOut) {
    // Only checked in, determine if late
    const checkInTime = new Date(this.checkIn);
    const checkInMinutes = checkInTime.getHours() * 60 + checkInTime.getMinutes();
    const lateByMinutes = checkInMinutes - OFFICE_START_HOUR;
    
    this.status = lateByMinutes > LATE_GRACE_MINUTES ? "Late" : "Present";
  }

  next();
});

module.exports = mongoose.model("Attendance", attendanceSchema);
