const attendanceConfig = require("../config/attendanceConfig");

/**
 * Calculate attendance status based on check-in/out times and hours worked
 * FIXED: Status now based on hours worked, not arrival time
 * "Late" status only applies if employee didn't complete full 8 hours
 * @param {Date} checkIn - Check-in timestamp
 * @param {Date} checkOut - Check-out timestamp (optional)
 * @param {Number} breakTime - Break time in minutes
 * @param {Number} officeStartHour - Office start hour (24h format)
 * @param {Number} officeStartMinute - Office start minute
 * @param {Number} graceMinutes - Grace period in minutes
 * @returns {Object} { status, totalHours, arrivedLate, lateByMinutes, overtimeHours }
 */
function calculateAttendanceStatus(checkIn, checkOut = null, breakTime = 0, officeStartHour = 10, officeStartMinute = 0, graceMinutes = 0) {
  const {
    FULL_DAY_HOURS,
    HALF_DAY_HOURS,
    LOP_THRESHOLD,
    OVERTIME_THRESHOLD,
    OVERTIME_ENABLED
  } = attendanceConfig;

  const officeStartTotalMinutes = officeStartHour * 60 + officeStartMinute;
  
  let totalHours = 0;
  let status = "Absent";
  let arrivedLate = false;
  let lateByMinutes = 0;
  let overtimeHours = 0;

  // Check if employee arrived late
  if (checkIn) {
    const checkInTime = new Date(checkIn);
    const checkInMinutes = checkInTime.getHours() * 60 + checkInTime.getMinutes();
    lateByMinutes = Math.max(0, checkInMinutes - officeStartTotalMinutes);
    arrivedLate = lateByMinutes > graceMinutes;
  }

  // Calculate hours if both check-in and check-out exist
  if (checkIn && checkOut) {
    const diffMs = checkOut - checkIn;
    let totalMinutes = diffMs / (1000 * 60);
    
    // Subtract break time
    if (breakTime > 0) {
      totalMinutes -= breakTime;
    }
    
    totalHours = Math.max(0, Math.round((totalMinutes / 60) * 100) / 100);

    // Calculate overtime
    if (OVERTIME_ENABLED && totalHours > OVERTIME_THRESHOLD) {
      overtimeHours = Math.round((totalHours - OVERTIME_THRESHOLD) * 100) / 100;
    }

    // FIXED LOGIC: Determine status based on hours worked
    if (totalHours < LOP_THRESHOLD) {
      status = "LOP";
    } else if (totalHours < HALF_DAY_HOURS) {
      status = "Half Day";
    } else if (totalHours >= FULL_DAY_HOURS) {
      // 8+ hours = Present (regardless of arrival time)
      status = "Present";
    } else {
      // Between 4-8 hours: Late only if arrived late
      status = arrivedLate ? "Late" : "Half Day";
    }
  } else if (checkIn && !checkOut) {
    // Only checked in
    status = arrivedLate ? "Late" : "Present";
  }

  return {
    status,
    totalHours,
    arrivedLate,
    lateByMinutes,
    overtimeHours
  };
}

/**
 * Calculate payroll hours based on attendance status
 * @param {Number} totalHours - Total hours worked
 * @param {String} status - Attendance status
 * @returns {Object} { payrollHours, dayType }
 */
function calculatePayrollHours(totalHours, status) {
  let payrollHours = 0;
  let dayType = "LOP (No Pay)";

  if (status === "LOP" || totalHours < attendanceConfig.LOP_THRESHOLD) {
    payrollHours = 0;
    dayType = "LOP (No Pay)";
  } else if (totalHours < attendanceConfig.HALF_DAY_HOURS) {
    payrollHours = 0;
    dayType = "LOP (No Pay)";
  } else if (totalHours < attendanceConfig.FULL_DAY_HOURS) {
    payrollHours = 4;
    dayType = "Half Day";
  } else {
    payrollHours = 8; // Cap at 8 hours for standard pay
    dayType = "Full Day";
  }

  return { payrollHours, dayType };
}

/**
 * Calculate overtime hours
 * @param {Number} totalHours - Total hours worked
 * @returns {Number} Overtime hours
 */
function calculateOvertime(totalHours) {
  const { OVERTIME_THRESHOLD } = attendanceConfig;
  return totalHours > OVERTIME_THRESHOLD 
    ? Math.round((totalHours - OVERTIME_THRESHOLD) * 100) / 100 
    : 0;
}

module.exports = {
  calculateAttendanceStatus,
  calculatePayrollHours,
  calculateOvertime
};
