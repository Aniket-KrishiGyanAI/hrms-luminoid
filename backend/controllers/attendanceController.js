const Attendance = require("../models/Attendance");
const User = require("../models/User");
const moment = require("moment-timezone");
const { sendHalfDayLOPNotification } = require("../utils/emailService");
const { delCache, clearPattern } = require("../config/cache");
const logger = require('../utils/logger');

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
    const { location, workMode = "OFFICE", officeLocationId } = req.body;
    const userId = req.user.id;

    const today = moment.tz("Asia/Kolkata").startOf("day").toDate();

    if (!location || !location.latitude || !location.longitude) {
      return res
        .status(400)
        .json({ message: "Location permission is required to check in" });
    }

    // 🔐 GPS accuracy validation
    const { MAX_GPS_ACCURACY } = require("../config/attendanceConfig");
    const maxAccuracy = Number(process.env.MAX_GPS_ACCURACY || MAX_GPS_ACCURACY || 50);

    if (location.accuracy && location.accuracy > maxAccuracy) {
      return res.status(403).json({
        message: `GPS accuracy too low (${Math.round(location.accuracy)}m). Please move to an open area for better signal.`,
        currentAccuracy: Math.round(location.accuracy),
        requiredAccuracy: maxAccuracy,
      });
    }

    let officeLocationDoc = null;

    if (workMode === "OFFICE") {
      if (!officeLocationId) {
        return res
          .status(400)
          .json({ message: "Please select an office location to check in" });
      }

      const OfficeLocation = require("../models/OfficeLocation");
      officeLocationDoc = await OfficeLocation.findById(officeLocationId);
      if (!officeLocationDoc || !officeLocationDoc.isActive) {
        return res
          .status(404)
          .json({ message: "Selected office location not found or inactive" });
      }

      const distance = getDistanceInMeters(
        officeLocationDoc.latitude,
        officeLocationDoc.longitude,
        location.latitude,
        location.longitude,
      );

      if (distance > officeLocationDoc.radiusMeters) {
        return res.status(403).json({
          message: `You are not within ${officeLocationDoc.name} premises`,
          distance: Math.round(distance),
          allowed: officeLocationDoc.radiusMeters,
        });
      }
    }

    let attendance = await Attendance.findOne({
      userId,
      date: today,
      isDeleted: { $ne: true },
    });

    if (attendance?.checkIn) {
      return res.status(400).json({ message: "Already checked in today" });
    }

    if (!attendance) {
      attendance = new Attendance({ userId, date: today });
    }

    attendance.checkIn = new Date();
    attendance.workMode = workMode;
    attendance.location = { checkInLocation: location };

    if (officeLocationDoc) {
      attendance.officeLocation = officeLocationDoc._id;
      attendance.officeLocationName = officeLocationDoc.name;
    }

    await attendance.save();

    // Clear attendance cache
    await clearPattern(`cache:*/attendance*:${userId}`);

    res.json({ message: "Checked in successfully", attendance });
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
    const users = await User.find({ isActive: true }).select('_id').lean();
    const userIds = users.map(u => u._id);

    // Bulk check existing attendance (fix N+1)
    const existingAttendance = await Attendance.find({
      userId: { $in: userIds },
      date: targetDate,
    }).select('userId').lean();

    const existingUserIds = new Set(existingAttendance.map(a => a.userId.toString()));
    const newAttendance = userIds
      .filter(id => !existingUserIds.has(id.toString()))
      .map(userId => ({
        userId,
        date: targetDate,
        status: "Present",
        totalHours: 8,
        isManualEntry: true,
        notes: `Holiday: ${holiday.name}`,
        approvedBy: req.user.id,
      }));

    // Bulk insert
    if (newAttendance.length > 0) {
      await Attendance.insertMany(newAttendance);
    }

    // Clear cache
    await clearPattern('cache:*/attendance*');

    res.json({
      message: `Holiday attendance marked for ${newAttendance.length} employees`,
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
    const { MAX_GPS_ACCURACY } = require("../config/attendanceConfig");
    const maxAccuracy = Number(process.env.MAX_GPS_ACCURACY || MAX_GPS_ACCURACY || 50);

    if (location.accuracy && location.accuracy > maxAccuracy) {
      return res.status(403).json({
        message: `GPS accuracy too low (${Math.round(location.accuracy)}m). Please move to an open area for better signal.`,
        currentAccuracy: Math.round(location.accuracy),
        requiredAccuracy: maxAccuracy,
      });
    }

    // 🗂️ Fetch today's attendance
    const attendance = await Attendance.findOne({
      userId,
      date: today,
      isDeleted: { $ne: true },
    });

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
    if (attendance.workMode === "OFFICE") {
      let officeLat, officeLng, allowedRadius;

      if (attendance.officeLocation) {
        const OfficeLocation = require("../models/OfficeLocation");
        const officeDoc = await OfficeLocation.findById(
          attendance.officeLocation,
        );
        if (officeDoc) {
          officeLat = officeDoc.latitude;
          officeLng = officeDoc.longitude;
          allowedRadius = officeDoc.radiusMeters;
        }
      }

      // Fallback to env vars if no office doc found
      if (!officeLat) {
        officeLat = Number(process.env.OFFICE_LAT);
        officeLng = Number(process.env.OFFICE_LNG);
        allowedRadius = Number(process.env.OFFICE_RADIUS_METERS || 100);
      }

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

    // Clear attendance cache
    await clearPattern(`cache:*/attendance*:${userId}`);

    return res.json({
      message: "Checked out successfully",
      attendance,
    });
  } catch (error) {
    logger.error("Check-out error", { error: error.message });
    res.status(500).json({
      message: "Server error during check-out",
    });
  }
};

const getAttendance = async (req, res) => {
  try {
    const {
      startDate,
      endDate,
      userId,
      page = 1,
      limit = 30,
      includeDeleted,
    } = req.query;
    const filter = {};

    // Role-based filtering
    if (req.user.role === "EMPLOYEE") {
      filter.userId = req.user.id;
    } else if (req.user.role === "MANAGER") {
      // Managers can only see their team's attendance
      const teamMembers = await User.find({ managerId: req.user.id }).select('_id');
      const teamMemberIds = teamMembers.map(m => m._id);
      
      if (userId && userId !== "all" && userId.trim() !== "") {
        // Check if requested user is in their team
        const isInTeam = teamMemberIds.some(id => id.toString() === userId);
        if (isInTeam || userId === req.user.id) {
          filter.userId = userId;
        } else {
          return res.status(403).json({ message: 'Access denied. You can only view your team members attendance.' });
        }
      } else {
        // Show all team members + self
        filter.userId = { $in: [...teamMemberIds, req.user.id] };
      }
    } else if (userId && userId !== "all" && userId.trim() !== "") {
      filter.userId = userId;
    }
    // If userId is empty, "all", or not provided for admin/hr, show all employees

    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999); // Include full end day
      filter.date = {
        $gte: start,
        $lte: end,
      };
    }

    // Exclude deleted records by default (only show if includeDeleted=true and user is ADMIN/HR)
    if (includeDeleted === "true" && ["ADMIN", "HR"].includes(req.user.role)) {
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
      // For managers, verify the user is in their team
      if (req.user.role === "MANAGER") {
        const teamMembers = await User.find({ managerId: req.user.id }).select('_id');
        const isInTeam = teamMembers.some(m => m._id.toString() === req.query.userId);
        if (!isInTeam && req.query.userId !== req.user.id) {
          return res.status(403).json({ message: 'Access denied. You can only view your team members.' });
        }
      }
      userId = req.query.userId;
    } else if (
      (!req.query.userId ||
        req.query.userId === "all" ||
        req.query.userId.trim() === "") &&
      ["MANAGER", "HR", "ADMIN"].includes(req.user.role)
    ) {
      // For "All" option, return aggregated data
      let attendanceFilter = {
        date: today,
        isDeleted: { $ne: true },
      };
      
      // For managers, filter to team only
      if (req.user.role === "MANAGER") {
        const teamMembers = await User.find({ managerId: req.user.id }).select('_id');
        const teamMemberIds = teamMembers.map(m => m._id);
        attendanceFilter.userId = { $in: [...teamMemberIds, req.user.id] };
      }
      
      const allAttendance = await Attendance.find(attendanceFilter).populate("userId", "firstName lastName email");

      // Get total active employees count
      const totalActiveEmployees = await User.countDocuments({
        isActive: true,
      });

      // Calculate work mode statistics
      const workModeStats = allAttendance.reduce((acc, a) => {
        const mode = a.workMode || "OFFICE";
        acc[mode] = (acc[mode] || 0) + 1;
        return acc;
      }, {});

      const summary = {
        totalEmployees: totalActiveEmployees,
        checkedIn: allAttendance.filter((a) => a.checkIn).length,
        checkedOut: allAttendance.filter((a) => a.checkOut).length,
        totalHours: allAttendance.reduce(
          (sum, a) => sum + (a.totalHours || 0),
          0,
        ),
        workModeStats,
        statusCounts: allAttendance.reduce((acc, a) => {
          acc[a.status] = (acc[a.status] || 0) + 1;
          return acc;
        }, {}),
      };

      return res.json({
        isAggregated: true,
        summary,
        hasCheckedIn: false,
        hasCheckedOut: false,
        checkInTime: null,
        checkOutTime: null,
        totalHours: summary.totalHours,
        status: "Multiple",
      });
    }

    const attendance = await Attendance.findOne({
      userId,
      date: today,
      isDeleted: { $ne: true },
    }).populate("userId", "firstName lastName email");

    res.json({
      user: attendance?.userId || null,
      hasCheckedIn: !!attendance?.checkIn,
      hasCheckedOut: !!attendance?.checkOut,
      checkInTime: attendance?.checkIn,
      checkOutTime: attendance?.checkOut,
      totalHours: attendance?.totalHours || 0,
      status: attendance?.status || "Absent",
      workMode: attendance?.workMode || null,
      officeLocationName: attendance?.officeLocationName || null,
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
      start = moment(`${currentYear}-${currentMonth}-01`)
        .startOf("month")
        .toDate();
      end = moment(`${currentYear}-${currentMonth}-01`).endOf("month").toDate();
    }

    const filter = {
      date: { $gte: start, $lte: end },
      isDeleted: { $ne: true },
    };

    // Role-based filtering
    if (req.user.role === "EMPLOYEE") {
      filter.userId = req.user.id;
    } else if (req.user.role === "MANAGER") {
      // Managers can only see their team's attendance
      const teamMembers = await User.find({ managerId: req.user.id }).select('_id');
      const teamMemberIds = teamMembers.map(m => m._id);
      
      if (userId && userId !== "all") {
        // Check if requested user is in their team
        const isInTeam = teamMemberIds.some(id => id.toString() === userId);
        if (isInTeam || userId === req.user.id) {
          filter.userId = userId;
        } else {
          return res.status(403).json({ message: 'Access denied. You can only view your team members attendance.' });
        }
      } else {
        // Show all team members + self
        filter.userId = { $in: [...teamMemberIds, req.user.id] };
      }
    } else if (userId && userId !== "all") {
      filter.userId = userId;
    }
    // If userId is "all" or empty for admin/hr, show all employees

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
      return res
        .status(400)
        .json({ message: "Edit reason is required (minimum 10 characters)" });
    }

    const attendance = await Attendance.findById(id);
    if (!attendance) {
      return res.status(404).json({ message: "Attendance record not found" });
    }

    // For managers, verify the attendance belongs to their team member
    if (req.user.role === "MANAGER") {
      const employee = await User.findById(attendance.userId);
      if (!employee || (employee.managerId?.toString() !== req.user.id && attendance.userId.toString() !== req.user.id)) {
        return res.status(403).json({ message: "Access denied. You can only edit your team members' attendance." });
      }
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

    res.json({
      message: "Attendance updated successfully",
      attendance: updatedRecord,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const deleteAttendance = async (req, res) => {
  try {
    const { id } = req.params;
    const { deletionReason } = req.body;

    if (!deletionReason || deletionReason.trim().length < 10) {
      return res
        .status(400)
        .json({
          message: "Deletion reason is required (minimum 10 characters)",
        });
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
    const today = moment.tz("Asia/Kolkata").startOf("day").toDate();
    const now = moment.tz("Asia/Kolkata");

    const OfficeLocation = require("../models/OfficeLocation");
    const { AUTO_CHECKOUT_BUFFER_MINUTES } = require("../config/attendanceConfig");

    // Find all attendance records that need auto-checkout
    const attendanceRecords = await Attendance.find({
      date: today,
      checkIn: { $exists: true },
      checkOut: { $exists: false },
      status: { $in: ["Present", "Late"] },
      isDeleted: { $ne: true },
    }).populate("officeLocation");

    if (attendanceRecords.length === 0) {
      return res.json({ message: "No employees to auto checkout", count: 0 });
    }

    let checkedOutCount = 0;
    const details = [];

    for (const record of attendanceRecords) {
      let checkoutTime;
      let timeStr;
      let locationName = "Default";

      // Use office-specific end time if available
      if (record.officeLocation) {
        const office = record.officeLocation;
        const officeEndHour = office.endTime;
        const officeEndMinute = office.endMinute || 0;

        // Add buffer minutes to office end time
        checkoutTime = moment
          .tz("Asia/Kolkata")
          .set({
            hour: officeEndHour,
            minute: officeEndMinute,
            second: 0,
            millisecond: 0,
          })
          .add(AUTO_CHECKOUT_BUFFER_MINUTES, 'minutes')
          .toDate();

        timeStr = `${officeEndHour}:${String(officeEndMinute).padStart(2, "0")} + ${AUTO_CHECKOUT_BUFFER_MINUTES}min buffer`;
        locationName = office.name;
      } else {
        // Default to 6:00 PM for remote/hybrid employees
        const { AUTO_CHECKOUT_TIME } = require("../config/attendanceConfig");
        checkoutTime = moment
          .tz("Asia/Kolkata")
          .set({
            hour: AUTO_CHECKOUT_TIME.hour,
            minute: AUTO_CHECKOUT_TIME.minute,
            second: 0,
            millisecond: 0,
          })
          .toDate();

        timeStr = `${AUTO_CHECKOUT_TIME.hour}:${String(AUTO_CHECKOUT_TIME.minute).padStart(2, "0")}`;
      }

      record.checkOut = checkoutTime;
      record.isAutoCheckout = true;
      record.notes = record.notes
        ? `${record.notes} | Auto checkout at ${timeStr} (${locationName})`
        : `Auto checkout at ${timeStr} (${locationName})`;

      await record.save();
      checkedOutCount++;

      details.push({
        employee: record.userId,
        checkoutTime: timeStr,
        location: locationName,
      });
    }

    res.json({
      message: `Auto checked out ${checkedOutCount} employees based on their office end times + ${AUTO_CHECKOUT_BUFFER_MINUTES}min buffer`,
      count: checkedOutCount,
      details,
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
  runAutoCheckout,
};
