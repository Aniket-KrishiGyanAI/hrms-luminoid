const Attendance = require("../models/Attendance");
const User = require("../models/User");
const moment = require("moment-timezone");
const { sendHalfDayLOPNotification } = require("../utils/emailService");

function getDistanceInMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000; // Earth radius in meters
  const toRad = (value) => (value * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

const checkIn = async (req, res) => {
  try {
    const { location, workMode = 'OFFICE' } = req.body;
    const userId = req.user.id;

    const today = moment.tz("Asia/Kolkata").startOf("day").toDate();

    if (!location || !location.latitude || !location.longitude) {
      return res.status(400).json({
        message: "Location permission is required to check in",
      });
    }

    const OFFICE_LAT = Number(process.env.OFFICE_LAT);
    const OFFICE_LNG = Number(process.env.OFFICE_LNG);
    const ALLOWED_RADIUS = Number(process.env.ALLOWED_RADIUS_METERS);

    const distance = getDistanceInMeters(
      OFFICE_LAT,
      OFFICE_LNG,
      location.latitude,
      location.longitude,
    );

    // Validate based on work mode
    if (workMode === 'OFFICE') {
      // Strict validation for office mode
      if (distance > ALLOWED_RADIUS) {
        return res.status(403).json({
          message: "You are not within office premises",
          distance: Math.round(distance),
        });
      }
    } else if (workMode === 'HYBRID') {
      // Auto-detect: if near office, switch to office mode
      // This is handled by just storing the mode as-is
    }
    // For REMOTE mode, no distance validation needed

    let attendance = await Attendance.findOne({ userId, date: today });

    if (attendance?.checkIn) {
      return res.status(400).json({ message: "Already checked in today" });
    }

    if (!attendance) {
      attendance = new Attendance({ userId, date: today });
    }

    attendance.checkIn = new Date();
    attendance.workMode = workMode;
    attendance.location = {
      checkInLocation: location,
    };

    await attendance.save();

    res.json({
      message: "Checked in successfully",
      attendance,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const markHolidayAttendance = async (req, res) => {
  try {
    const Holiday = require("../models/Holiday");
    const User = require("../models/User");

    const { date } = req.body;
    const targetDate = moment(date).startOf("day").toDate();

    // Check if it's a holiday
    const holiday = await Holiday.findOne({
      date: targetDate,
      type: { $in: ["FESTIVAL", "NATIONAL", "COMPANY"] },
    });

    if (!holiday) {
      return res
        .status(400)
        .json({ message: "No holiday found for this date" });
    }

    // Get all active users
    const users = await User.find({ isActive: true });
    let markedCount = 0;

    for (const user of users) {
      const existingAttendance = await Attendance.findOne({
        userId: user._id,
        date: targetDate,
      });

      if (!existingAttendance) {
        await Attendance.create({
          userId: user._id,
          date: targetDate,
          status: "Present",
          totalHours: 8,
          isManualEntry: true,
          notes: `Holiday: ${holiday.name}`,
          approvedBy: req.user.id,
        });
        markedCount++;
      }
    }

    res.json({
      message: `Holiday attendance marked for ${markedCount} employees`,
      holiday: holiday.name,
      date: targetDate,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const checkOut = async (req, res) => {
  try {
    const { location } = req.body;
    const userId = req.user.id;
    const today = moment.tz("Asia/Kolkata").startOf("day").toDate();

    // 🔒 Location is mandatory
    if (!location?.latitude || !location?.longitude) {
      return res.status(400).json({
        message: "Location is required for check-out",
      });
    }

    // 🔐 GPS accuracy validation
    const maxAccuracy = Number(process.env.MAX_GPS_ACCURACY || 50);

    if (location.accuracy && location.accuracy > maxAccuracy) {
      return res.status(403).json({
        message: "GPS accuracy too low. Move to open area.",
      });
    }

    // 🗂️ Fetch today's attendance
    const attendance = await Attendance.findOne({ userId, date: today });

    if (!attendance || !attendance.checkIn) {
      return res.status(400).json({
        message: "You have not checked in today",
      });
    }

    if (attendance.checkOut) {
      return res.status(400).json({
        message: "Already checked out today",
      });
    }

    // Validate based on work mode (only for OFFICE mode)
    if (attendance.workMode === 'OFFICE') {
      const officeLat = Number(process.env.OFFICE_LAT);
      const officeLng = Number(process.env.OFFICE_LNG);
      const allowedRadius = Number(process.env.OFFICE_RADIUS_METERS || 100);

      const distance = getDistanceInMeters(
        officeLat,
        officeLng,
        location.latitude,
        location.longitude,
      );

      if (distance > allowedRadius) {
        return res.status(403).json({
          message: "Check-out allowed only within office premises",
          distance: Math.round(distance),
        });
      }
    }
    // For REMOTE/HYBRID: just capture location, no validation

    // ⏱️ Save check-out
    attendance.checkOut = new Date();
    attendance.location.checkOutLocation = {
      latitude: location.latitude,
      longitude: location.longitude,
      accuracy: location.accuracy,
    };

    await attendance.save(); // pre-save hook calculates hours & status

    return res.json({
      message: "Checked out successfully",
      attendance,
    });
  } catch (error) {
    console.error("Check-out error:", error);
    res.status(500).json({
      message: "Server error during check-out",
    });
  }
};

const getAttendance = async (req, res) => {
  try {
    const { startDate, endDate, userId, page = 1, limit = 30, includeDeleted } = req.query;
    const filter = {};

    // Role-based filtering
    if (req.user.role === "EMPLOYEE") {
      filter.userId = req.user.id;
    } else if (userId && userId !== "all" && userId.trim() !== "") {
      filter.userId = userId;
    }
    // If userId is empty, "all", or not provided for admin/hr/manager, show all employees

    if (startDate && endDate) {
      filter.date = {
        $gte: new Date(startDate),
        $lte: new Date(endDate),
      };
    }

    // Exclude deleted records by default (only show if includeDeleted=true and user is ADMIN/HR)
    if (includeDeleted === 'true' && ['ADMIN', 'HR'].includes(req.user.role)) {
      // Show all records including deleted
    } else {
      filter.isDeleted = { $ne: true };
    }

    const attendance = await Attendance.find(filter)
      .populate("userId", "firstName lastName email")
      .populate("lastEditedBy", "firstName lastName")
      .populate("deletedBy", "firstName lastName")
      .sort({ date: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Attendance.countDocuments(filter);

    res.json({
      attendance,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total,
    });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

const getTodayStatus = async (req, res) => {
  try {
    const today = moment().startOf("day").toDate();
    let userId = req.user.id;

    // Allow managers/HR/Admin to query another user's today status via ?userId=
    if (
      req.query.userId &&
      req.query.userId !== "all" &&
      req.query.userId.trim() !== "" &&
      ["MANAGER", "HR", "ADMIN"].includes(req.user.role)
    ) {
      userId = req.query.userId;
    } else if (
      (!req.query.userId || req.query.userId === "all" || req.query.userId.trim() === "") &&
      ["MANAGER", "HR", "ADMIN"].includes(req.user.role)
    ) {
      // For "All" option, return aggregated data
      const allAttendance = await Attendance.find({
        date: today,
        isDeleted: { $ne: true }
      }).populate("userId", "firstName lastName email");

      // Get total active employees count
      const totalActiveEmployees = await User.countDocuments({ isActive: true });

      // Calculate work mode statistics
      const workModeStats = allAttendance.reduce((acc, a) => {
        const mode = a.workMode || 'OFFICE';
        acc[mode] = (acc[mode] || 0) + 1;
        return acc;
      }, {});

      const summary = {
        totalEmployees: totalActiveEmployees,
        checkedIn: allAttendance.filter(a => a.checkIn).length,
        checkedOut: allAttendance.filter(a => a.checkOut).length,
        totalHours: allAttendance.reduce((sum, a) => sum + (a.totalHours || 0), 0),
        workModeStats,
        statusCounts: allAttendance.reduce((acc, a) => {
          acc[a.status] = (acc[a.status] || 0) + 1;
          return acc;
        }, {})
      };

      return res.json({
        isAggregated: true,
        summary,
        hasCheckedIn: false,
        hasCheckedOut: false,
        checkInTime: null,
        checkOutTime: null,
        totalHours: summary.totalHours,
        status: "Multiple"
      });
    }

    const attendance = await Attendance.findOne({
      userId,
      date: today,
    }).populate("userId", "firstName lastName email");

    res.json({
      user: attendance?.userId || null,
      hasCheckedIn: !!attendance?.checkIn,
      hasCheckedOut: !!attendance?.checkOut,
      checkInTime: attendance?.checkIn,
      checkOutTime: attendance?.checkOut,
      totalHours: attendance?.totalHours || 0,
      status: attendance?.status || "Absent",
    });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

const getAttendanceReport = async (req, res) => {
  try {
    const { month, year, userId, startDate, endDate } = req.query;
    
    let start, end;
    
    // If startDate and endDate are provided, use them
    if (startDate && endDate) {
      start = moment(startDate).startOf("day").toDate();
      end = moment(endDate).endOf("day").toDate();
    } else {
      // Otherwise, use month and year (backward compatibility)
      const currentMonth = month || moment().month() + 1;
      const currentYear = year || moment().year();
      start = moment(`${currentYear}-${currentMonth}-01`).startOf("month").toDate();
      end = moment(`${currentYear}-${currentMonth}-01`).endOf("month").toDate();
    }

    const filter = { date: { $gte: start, $lte: end }, isDeleted: { $ne: true } };
    
    // Role-based filtering
    if (req.user.role === "EMPLOYEE") {
      filter.userId = req.user.id;
    } else if (userId && userId !== "all") {
      filter.userId = userId;
    }
    // If userId is "all" or empty for admin/hr/manager, show all employees

    const attendance = await Attendance.find(filter)
      .populate("userId", "firstName lastName email")
      .sort({ date: 1 });

    // Calculate summary
    const summary = attendance.reduce((acc, record) => {
      const status = record.status;
      acc[status] = (acc[status] || 0) + 1;
      acc.totalHours = (acc.totalHours || 0) + record.totalHours;
      return acc;
    }, {});

    res.json({ attendance, summary });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

const getPayrollReport = async (req, res) => {
  try {
    const { month, year, userId } = req.query;
    const currentMonth = month || moment().month() + 1;
    const currentYear = year || moment().year();

    const startDate = moment(`${currentYear}-${currentMonth}-01`)
      .startOf("month")
      .toDate();
    const endDate = moment(`${currentYear}-${currentMonth}-01`)
      .endOf("month")
      .toDate();

    const filter = { date: { $gte: startDate, $lte: endDate } };
    if (userId) filter.userId = userId;

    const attendance = await Attendance.find(filter)
      .populate("userId", "firstName lastName email")
      .sort({ date: 1 });

    const payrollData = attendance.map((record) => {
      let payrollHours = record.totalHours;
      let dayType = "Full Day";

      if (record.totalHours < 4) {
        payrollHours = 0; // LOP - no pay
        dayType = "LOP (No Pay)";
      } else if (record.totalHours < 8) {
        payrollHours = 4; // Half day
        dayType = "Half Day";
      } else {
        payrollHours = 8; // Full day (cap at 8 hours)
        dayType = "Full Day";
      }

      return {
        userId: record.userId._id,
        userName: `${record.userId.firstName} ${record.userId.lastName}`,
        date: record.date,
        checkIn: record.checkIn,
        checkOut: record.checkOut,
        actualHours: record.totalHours,
        payrollHours,
        dayType,
        status: record.status,
      };
    });

    res.json({ payrollData });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

const editAttendance = async (req, res) => {
  try {
    const { id } = req.params;
    const { checkIn, checkOut, status, totalHours, editReason } = req.body;

    if (!editReason || editReason.trim().length < 10) {
      return res.status(400).json({ message: "Edit reason is required (minimum 10 characters)" });
    }

    const attendance = await Attendance.findById(id);
    if (!attendance) {
      return res.status(404).json({ message: "Attendance record not found" });
    }

    if (checkIn) attendance.checkIn = new Date(checkIn);
    if (checkOut) attendance.checkOut = new Date(checkOut);
    if (status) attendance.status = status;
    if (totalHours !== undefined) attendance.totalHours = totalHours;
    
    attendance.lastEditedBy = req.user.id;
    attendance.lastEditedAt = new Date();
    attendance.editReason = editReason;
    attendance.isManualEntry = true;

    await attendance.save();

    const updatedRecord = await Attendance.findById(id)
      .populate("userId", "firstName lastName email")
      .populate("lastEditedBy", "firstName lastName");

    res.json({ message: "Attendance updated successfully", attendance: updatedRecord });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const deleteAttendance = async (req, res) => {
  try {
    const { id } = req.params;
    const { deletionReason } = req.body;

    if (!deletionReason || deletionReason.trim().length < 10) {
      return res.status(400).json({ message: "Deletion reason is required (minimum 10 characters)" });
    }

    const attendance = await Attendance.findById(id);
    if (!attendance) {
      return res.status(404).json({ message: "Attendance record not found" });
    }

    attendance.isDeleted = true;
    attendance.deletedBy = req.user.id;
    attendance.deletedAt = new Date();
    attendance.deletionReason = deletionReason;

    await attendance.save();

    res.json({ message: "Attendance deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const runAutoCheckout = async (req, res) => {
  try {
    const today = moment.tz('Asia/Kolkata').startOf('day').toDate();
    
    const attendanceRecords = await Attendance.find({
      date: today,
      checkIn: { $exists: true },
      checkOut: { $exists: false },
      status: { $in: ['Present', 'Late'] },
      isDeleted: { $ne: true }
    });
    
    if (attendanceRecords.length === 0) {
      return res.json({ message: 'No employees to auto checkout', count: 0 });
    }
    
    const autoCheckoutTime = moment.tz('Asia/Kolkata')
      .set({ hour: 18, minute: 0, second: 0, millisecond: 0 })
      .toDate();
    
    for (const record of attendanceRecords) {
      record.checkOut = autoCheckoutTime;
      record.isAutoCheckout = true;
      record.notes = record.notes 
        ? `${record.notes} | Auto checkout at 6:00 PM` 
        : 'Auto checkout at 6:00 PM';
      await record.save();
    }
    
    res.json({ 
      message: `Auto checked out ${attendanceRecords.length} employees at 6:00 PM`,
      count: attendanceRecords.length
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};





module.exports = {
  checkIn,
  checkOut,
  getAttendance,
  getTodayStatus,
  getAttendanceReport,
  getPayrollReport,
  markHolidayAttendance,
  editAttendance,
  deleteAttendance,
  runAutoCheckout
};
