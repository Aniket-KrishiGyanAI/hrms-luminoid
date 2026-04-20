const express = require("express");
const {
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
} = require("../controllers/attendanceController");
const { auth, authorize } = require("../middleware/auth");

const router = express.Router();

router.post("/checkin", auth, checkIn);
router.post("/checkout", auth, checkOut);

// Specific routes MUST come before parameterized routes
router.get("/today", auth, getTodayStatus);
router.get("/today-all", auth, authorize("HR", "ADMIN", "MANAGER"), async (req, res) => {
  try {
    const moment = require('moment-timezone');
    const Attendance = require('../models/Attendance');
    const todayStart = moment.tz('Asia/Kolkata').startOf('day').toDate();
    const todayEnd = moment.tz('Asia/Kolkata').endOf('day').toDate();
    
    const attendances = await Attendance.find({
      date: { $gte: todayStart, $lte: todayEnd },
      checkIn: { $exists: true }
    }).populate('userId', 'firstName lastName department isFieldEmployee phone email');
    
    // Format the response to include properly structured location
    const formattedAttendances = attendances.map(att => {
      const obj = att.toObject();
      // Convert location.checkInLocation to checkInLocation with lat/lng format
      if (obj.location?.checkInLocation?.latitude && obj.location?.checkInLocation?.longitude) {
        obj.checkInLocation = {
          lat: obj.location.checkInLocation.latitude,
          lng: obj.location.checkInLocation.longitude,
          accuracy: obj.location.checkInLocation.accuracy,
          address: obj.location.checkInLocation.address
        };
      }
      return obj;
    });
    
    res.json(formattedAttendances);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});
router.get(
  "/report",
  auth,
  authorize("HR", "ADMIN", "MANAGER"),
  getAttendanceReport,
);
router.get("/payroll", auth, authorize("HR", "ADMIN"), getPayrollReport);
router.post(
  "/mark-holiday",
  auth,
  authorize("HR", "ADMIN"),
  markHolidayAttendance,
);
router.post(
  "/auto-checkout",
  auth,
  authorize("HR", "ADMIN"),
  runAutoCheckout,
);

// Edit & delete routes (parameterized - must come after specific routes)
router.put('/:id', (req, res, next) => {
  
  next();
}, auth, authorize('HR', 'ADMIN', 'MANAGER'), editAttendance);

router.delete('/:id', auth, authorize('HR', 'ADMIN'), deleteAttendance);

// General get route (must be last)
router.get("/", auth, getAttendance);

module.exports = router;
