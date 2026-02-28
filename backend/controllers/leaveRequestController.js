const LeaveRequest = require('../models/LeaveRequest');
const LeaveBalance = require('../models/LeaveBalance');
const LeaveType = require('../models/LeaveType');
const User = require('../models/User');
const { validationResult } = require('express-validator');
const { sendLeaveApplicationNotification, sendLeaveReminderNotification, sendLeaveApprovalNotification } = require('../utils/emailService');

const applyLeave = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { 
      leaveTypeId, startDate, endDate, isHalfDay, halfDayType, reason,
      contactNumber, emergencyContact, addressDuringLeave, handoverTo
    } = req.body;
    const userId = req.user.id;

    // Check for overlapping leaves
    const overlapping = await LeaveRequest.findOne({
      userId,
      status: { $in: ['PENDING', 'MANAGER_APPROVED', 'HR_APPROVED'] },
      $or: [
        { startDate: { $lte: new Date(endDate) }, endDate: { $gte: new Date(startDate) } }
      ]
    });

    if (overlapping) {
      return res.status(400).json({ message: 'Overlapping leave request exists' });
    }

    // Calculate days
    const start = new Date(startDate);
    const end = new Date(endDate);
    let days = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;
    if (isHalfDay) days = 0.5;

    // Check balance
    const currentYear = start.getFullYear();
    const balance = await LeaveBalance.findOne({ userId, leaveTypeId, year: currentYear });
    const leaveType = await LeaveType.findById(leaveTypeId);

    let isLOP = false;
    if (balance) {
      const available = balance.allocated + balance.carryForward - balance.used - balance.pending;
      if (days > available) {
        if (!leaveType.lopEnabled) {
          return res.status(400).json({ message: 'Insufficient leave balance' });
        }
        isLOP = true;
      }
    } else if (!leaveType.lopEnabled) {
      return res.status(400).json({ message: 'No leave balance found' });
    } else {
      isLOP = true;
    }

    const leaveRequest = new LeaveRequest({
      userId,
      leaveTypeId,
      startDate: start,
      endDate: end,
      days,
      isHalfDay,
      halfDayType,
      reason,
      contactNumber: contactNumber || undefined,
      emergencyContact: emergencyContact || undefined,
      addressDuringLeave: addressDuringLeave || undefined,
      handoverTo: handoverTo || undefined,
      isLOP
    });

    await leaveRequest.save();

    // Update pending balance
    if (balance && !isLOP) {
      balance.pending += days;
      await balance.save();
    }

    await leaveRequest.populate(['leaveTypeId', 'userId']);
    
    // Send email notification
    await sendLeaveApplicationNotification(leaveRequest);
    
    res.status(201).json({ message: 'Leave request submitted successfully', leaveRequest });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

const getLeaveRequests = async (req, res) => {
  try {
    const { status, userId, startDate, endDate, page = 1, limit = 10 } = req.query;
    const filter = {};

    if (req.user.role === 'EMPLOYEE') {
      filter.userId = req.user.id;
    } else if (userId) {
      filter.userId = userId;
    }

    if (status) filter.status = status;
    if (startDate && endDate) {
      filter.startDate = { $gte: new Date(startDate), $lte: new Date(endDate) };
    }

    const requests = await LeaveRequest.find(filter)
      .populate('userId', 'firstName lastName email')
      .populate('leaveTypeId', 'name color')
      .populate('managerApproval.approvedBy', 'firstName lastName')
      .populate('hrApproval.approvedBy', 'firstName lastName')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await LeaveRequest.countDocuments(filter);

    res.json({
      requests,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

const getPendingApprovals = async (req, res) => {
  try {
    let filter = {};

    if (req.user.role === 'MANAGER') {
      const teamMembers = await User.find({ managerId: req.user.id }).select('_id');
      filter = {
        userId: { $in: teamMembers.map(m => m._id) },
        status: 'PENDING'
      };
    } else if (req.user.role === 'HR' || req.user.role === 'ADMIN') {
      filter.status = { $in: ['PENDING', 'MANAGER_APPROVED'] };
    }

    const requests = await LeaveRequest.find(filter)
      .populate('userId', 'firstName lastName email department')
      .populate('leaveTypeId', 'name color')
      .sort({ createdAt: -1 });

    // Get employee profiles to include employee IDs
    const userIds = requests.map(req => req.userId._id);
    const profiles = await require('../models/EmployeeProfile').find({
      userId: { $in: userIds }
    }).select('userId professionalInfo.employeeId');

    // Create a map of userId to employeeId
    const employeeIdMap = {};
    profiles.forEach(profile => {
      employeeIdMap[profile.userId.toString()] = profile.professionalInfo?.employeeId;
    });

    // Add employeeId to each request
    const requestsWithEmployeeId = requests.map(request => ({
      ...request.toObject(),
      employeeId: employeeIdMap[request.userId._id.toString()]
    }));

    res.json(requestsWithEmployeeId);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

const approveReject = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { action, comments } = req.body;
    const requestId = req.params.id;

    // Validate comments for rejection
    if (action === 'reject' && (!comments || !comments.trim())) {
      return res.status(400).json({ message: 'Comments are required for rejection' });
    }

    const leaveRequest = await LeaveRequest.findById(requestId)
      .populate('leaveTypeId')
      .populate('userId', 'firstName lastName email');

    if (!leaveRequest || !leaveRequest.userId) {
      return res.status(404).json({ message: 'Leave request or user not found' });
    }

    // Check if request is already processed
    if (['HR_APPROVED', 'REJECTED', 'CANCELLED'].includes(leaveRequest.status)) {
      return res.status(400).json({ message: 'Leave request has already been processed' });
    }

    if (action === 'approve') {
      if (req.user.role === 'MANAGER' && leaveRequest.status === 'PENDING') {
        // Manager approval
        leaveRequest.status = 'MANAGER_APPROVED';
        leaveRequest.managerApproval = {
          approvedBy: req.user.id,
          approvedAt: new Date(),
          comments: comments || ''
        };
        
        await leaveRequest.save();
        
        // Send email notification (don't let email failure break the approval)
        try {
          await sendLeaveApprovalNotification(leaveRequest, `${req.user.firstName || 'Manager'} ${req.user.lastName || ''}`, 'Manager');
        } catch (emailError) {
          console.error('Email notification failed:', emailError);
        }
      } else if ((req.user.role === 'HR' || req.user.role === 'ADMIN') && 
                 (leaveRequest.status === 'PENDING' || leaveRequest.status === 'MANAGER_APPROVED')) {
        // HR/Admin approval
        leaveRequest.status = 'HR_APPROVED';
        leaveRequest.hrApproval = {
          approvedBy: req.user.id,
          approvedAt: new Date(),
          comments: comments || ''
        };
        
        await leaveRequest.save();
        
        // Send email notification (don't let email failure break the approval)
        try {
          await sendLeaveApprovalNotification(leaveRequest, `${req.user.firstName || 'HR'} ${req.user.lastName || ''}`, 'HR');
        } catch (emailError) {
          console.error('Email notification failed:', emailError);
        }

        // Update balance only for HR approved leaves
        if (!leaveRequest.isLOP && leaveRequest.userId && leaveRequest.leaveTypeId) {
          const balance = await LeaveBalance.findOne({
            userId: leaveRequest.userId._id,
            leaveTypeId: leaveRequest.leaveTypeId._id,
            year: leaveRequest.startDate.getFullYear()
          });

          if (balance) {
            balance.used += leaveRequest.days;
            balance.pending = Math.max(0, balance.pending - leaveRequest.days);
            await balance.save();
          }
        }
      } else {
        return res.status(403).json({ 
          message: 'You are not authorized to approve this request at its current status' 
        });
      }
    } else if (action === 'reject') {
      // Anyone with approval rights can reject at any stage
      if (!['MANAGER', 'HR', 'ADMIN'].includes(req.user.role)) {
        return res.status(403).json({ message: 'You are not authorized to reject leave requests' });
      }

      leaveRequest.status = 'REJECTED';
      leaveRequest.rejectionReason = comments;
      
      await leaveRequest.save();

      // Release pending balance
      if (!leaveRequest.isLOP && leaveRequest.userId && leaveRequest.leaveTypeId) {
        const balance = await LeaveBalance.findOne({
          userId: leaveRequest.userId._id,
          leaveTypeId: leaveRequest.leaveTypeId._id,
          year: leaveRequest.startDate.getFullYear()
        });

        if (balance) {
          balance.pending = Math.max(0, balance.pending - leaveRequest.days);
          await balance.save();
        }
      }
    }

    // Remove the duplicate save operation
    // await leaveRequest.save();
    
    // Populate the response with updated data
    await leaveRequest.populate([
      { path: 'managerApproval.approvedBy', select: 'firstName lastName' },
      { path: 'hrApproval.approvedBy', select: 'firstName lastName' }
    ]);
    
    res.json({ 
      message: `Leave request ${action}d successfully`, 
      leaveRequest 
    });
  } catch (error) {
    console.error('Error in approveReject:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

const cancelLeave = async (req, res) => {
  try {
    const leaveRequest = await LeaveRequest.findById(req.params.id);
    
    if (!leaveRequest) {
      return res.status(404).json({ message: 'Leave request not found' });
    }

    if (leaveRequest.userId.toString() !== req.user.id && !['HR', 'ADMIN'].includes(req.user.role)) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    if (leaveRequest.status !== 'PENDING') {
      return res.status(400).json({ message: 'Can only cancel pending requests' });
    }

    leaveRequest.status = 'CANCELLED';
    await leaveRequest.save();

    // Release pending balance
    if (!leaveRequest.isLOP) {
      const balance = await LeaveBalance.findOne({
        userId: leaveRequest.userId,
        leaveTypeId: leaveRequest.leaveTypeId,
        year: leaveRequest.startDate.getFullYear()
      });

      if (balance) {
        balance.pending -= leaveRequest.days;
        await balance.save();
      }
    }

    res.json({ message: 'Leave request cancelled successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

const getTeamCalendar = async (req, res) => {
  try {
    let teamMemberIds = [];
    
    // Get team members based on role
    if (req.user.role === 'MANAGER') {
      const teamMembers = await User.find({ managerId: req.user.id }).select('_id firstName lastName');
      teamMemberIds = teamMembers.map(m => m._id);
    } else if (['HR', 'ADMIN'].includes(req.user.role)) {
      // For HR/ADMIN, get all active employees
      const allEmployees = await User.find({ isActive: true, role: { $ne: 'ADMIN' } }).select('_id firstName lastName');
      teamMemberIds = allEmployees.map(e => e._id);
    } else {
      return res.status(403).json({ message: 'Not authorized' });
    }

    // Get upcoming leaves (next 90 days)
    const next90Days = new Date();
    next90Days.setDate(next90Days.getDate() + 90);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const teamLeaves = await LeaveRequest.find({
      userId: { $in: teamMemberIds },
      status: { $in: ['MANAGER_APPROVED', 'HR_APPROVED'] },
      $or: [
        { startDate: { $gte: today, $lte: next90Days } },
        { endDate: { $gte: today, $lte: next90Days } },
        { startDate: { $lte: today }, endDate: { $gte: today } }
      ]
    })
    .populate('userId', 'firstName lastName email department')
    .populate('leaveTypeId', 'name color')
    .sort({ startDate: 1 });

    // Get team members info
    const teamMembers = await User.find({ _id: { $in: teamMemberIds } })
      .select('firstName lastName email department role')
      .sort({ firstName: 1 });

    res.json({
      teamMembers,
      leaves: teamLeaves
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

const testLeaveReminder = async (req, res) => {
  try {
    const { requestId } = req.params;
    const leaveRequest = await LeaveRequest.findById(requestId)
      .populate(['userId', 'leaveTypeId']);
    
    if (!leaveRequest) {
      return res.status(404).json({ message: 'Leave request not found' });
    }
    
    await sendLeaveReminderNotification(leaveRequest);
    res.json({ message: 'Test reminder sent successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const checkConflicts = async (req, res) => {
  try {
    const { startDate, endDate } = req.body;
    const userId = req.user.id;
    
    // Get user's team members (same manager or department)
    const user = await User.findById(userId);
    if (!user) {
      return res.json({ conflicts: [] });
    }
    
    const teamMembers = await User.find({
      $or: [
        { managerId: user.managerId },
        { department: user.department }
      ],
      _id: { $ne: userId },
      isActive: true
    });
    
    const teamMemberIds = teamMembers.map(member => member._id);
    
    // Find overlapping leave requests
    const conflicts = await LeaveRequest.find({
      userId: { $in: teamMemberIds },
      status: { $in: ['PENDING', 'MANAGER_APPROVED', 'HR_APPROVED'] },
      $or: [
        {
          startDate: { $lte: new Date(endDate) },
          endDate: { $gte: new Date(startDate) }
        }
      ]
    }).populate('userId', 'firstName lastName');
    
    const conflictData = conflicts.map(conflict => ({
      employeeName: `${conflict.userId.firstName} ${conflict.userId.lastName}`,
      startDate: conflict.startDate,
      endDate: conflict.endDate,
      status: conflict.status
    }));
    
    res.json({ conflicts: conflictData });
  } catch (error) {
    console.error('Error checking conflicts:', error);
    res.json({ conflicts: [] });
  }
};

const getEmployeeDetails = async (req, res) => {
  try {
    const { employeeId } = req.params;
    const user = await User.findById(employeeId).select('firstName lastName email department role joinDate');
    
    if (!user) {
      return res.status(404).json({ message: 'Employee not found' });
    }

    // Get leave balances (filter out invalid ones)
    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth();
    const balances = await LeaveBalance.find({ 
      userId: employeeId, 
      year: currentYear,
      leaveTypeId: { $ne: null }
    }).populate('leaveTypeId', 'name color');

    // Get all leave requests
    const leaves = await LeaveRequest.find({ userId: employeeId })
      .populate('leaveTypeId', 'name color')
      .sort({ startDate: -1 });

    // Get attendance records from Attendance model
    const Attendance = require('../models/Attendance');
    const yearStart = new Date(currentYear, 0, 1);
    const today = new Date();
    
    const attendanceRecords = await Attendance.find({
      userId: employeeId,
      date: { $gte: yearStart, $lte: today },
      isDeleted: { $ne: true }
    }).sort({ date: 1 });

    // Calculate monthly attendance from real data
    const monthlyPresent = [];
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    
    for (let month = 0; month <= currentMonth; month++) {
      const monthStart = new Date(currentYear, month, 1);
      const monthEnd = month === currentMonth ? new Date() : new Date(currentYear, month + 1, 0);
      
      // Get attendance records for this month
      const monthAttendance = attendanceRecords.filter(record => {
        const recordDate = new Date(record.date);
        return recordDate >= monthStart && recordDate <= monthEnd;
      });
      
      // Count present days (Present, Late, Half Day)
      const presentDays = monthAttendance.filter(record => 
        ['Present', 'Late', 'Half Day'].includes(record.status)
      ).length;
      
      // Count leave days
      const leaveDays = monthAttendance.filter(record => 
        ['On Leave', 'LOP'].includes(record.status)
      ).length;
      
      // Count absent days
      const absentDays = monthAttendance.filter(record => 
        record.status === 'Absent'
      ).length;
      
      // Calculate total working days in month (excluding weekends)
      let workingDays = 0;
      let currentDate = new Date(monthStart);
      
      while (currentDate <= monthEnd) {
        const dayOfWeek = currentDate.getDay();
        if (dayOfWeek !== 0 && dayOfWeek !== 6) {
          workingDays++;
        }
        currentDate.setDate(currentDate.getDate() + 1);
      }
      
      monthlyPresent.push({
        month: monthNames[month],
        workingDays,
        presentDays,
        leaveDays,
        absentDays,
        totalRecords: monthAttendance.length
      });
    }
    
    // Calculate year-to-date totals from real attendance
    const totalPresentDays = attendanceRecords.filter(record => 
      ['Present', 'Late', 'Half Day'].includes(record.status)
    ).length;
    
    const totalLeaveDays = attendanceRecords.filter(record => 
      ['On Leave', 'LOP'].includes(record.status)
    ).length;
    
    const totalAbsentDays = attendanceRecords.filter(record => 
      record.status === 'Absent'
    ).length;
    
    // Calculate total working days
    let totalWorkingDays = 0;
    let currentDate = new Date(yearStart);
    
    while (currentDate <= today) {
      const dayOfWeek = currentDate.getDay();
      if (dayOfWeek !== 0 && dayOfWeek !== 6) {
        totalWorkingDays++;
      }
      currentDate.setDate(currentDate.getDate() + 1);
    }

    res.json({
      employee: user,
      balances,
      leaves,
      monthlyPresent,
      stats: {
        presentDays: totalPresentDays,
        totalLeaves: leaves.length,
        approvedLeaves: leaves.filter(l => l.status === 'HR_APPROVED').length,
        pendingLeaves: leaves.filter(l => l.status === 'PENDING' || l.status === 'MANAGER_APPROVED').length,
        totalWorkingDays,
        totalLeaveDays,
        totalAbsentDays,
        attendancePercentage: totalWorkingDays > 0 ? Math.round((totalPresentDays / totalWorkingDays) * 100) : 0
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

module.exports = {
  applyLeave,
  getLeaveRequests,
  getPendingApprovals,
  approveReject,
  cancelLeave,
  getTeamCalendar,
  testLeaveReminder,
  checkConflicts,
  getEmployeeDetails
};