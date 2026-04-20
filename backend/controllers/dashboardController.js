const mongoose = require('mongoose');
const LeaveRequest = require('../models/LeaveRequest');
const LeaveBalance = require('../models/LeaveBalance');
const User = require('../models/User');
const Announcement = require('../models/Announcement');
const Holiday = require('../models/Holiday');
const Favorite = require('../models/Favorite');
const File = require('../models/File');
const Department = require('../models/Department');
const { ensureBalancesForUser } = require('./leaveBalanceController');
const { getSmartQuote } = require('../utils/quotes');
const { getCache, setCache } = require('../config/cache');
const logger = require('../utils/logger');

const getDailyQuote = (userRole) => {
  return getSmartQuote(userRole);
};

const getEmployeeDashboard = async (req, res) => {
  try {
    const userId = req.user.id;
    const currentYear = new Date().getFullYear();

    await ensureBalancesForUser(userId, currentYear);

    const balances = await LeaveBalance.find({ userId, year: currentYear })
      .populate('leaveTypeId', 'name color')
      .lean();

    const balancesWithAvailable = balances.map(b => ({
      ...b,
      available: b.allocated + b.carryForward - b.used - b.pending
    }));

    const upcomingLeaves = await LeaveRequest.find({
      userId,
      status: { $in: ['MANAGER_APPROVED', 'HR_APPROVED'] },
      startDate: { $gte: new Date() }
    })
    .populate('leaveTypeId', 'name color')
    .sort({ startDate: 1 })
    .limit(5);

    const recentLeaves = await LeaveRequest.find({ userId })
      .populate('leaveTypeId', 'name color')
      .sort({ createdAt: -1 })
      .limit(10);

    const pendingCount = await LeaveRequest.countDocuments({
      userId,
      status: 'PENDING'
    });

    const announcements = await Announcement.find({
      isActive: true,
      $and: [
        { $or: [{ targetRoles: { $in: [req.user.role] } }, { targetRoles: { $size: 0 } }] },
        { $or: [{ expiryDate: { $exists: false } }, { expiryDate: { $gte: new Date() } }] }
      ]
    }).populate('createdBy', 'firstName lastName').sort({ priority: -1, createdAt: -1 }).limit(5);

    const upcomingHolidays = await Holiday.find({
      date: { $gte: new Date() }
    }).sort({ date: 1 }).limit(5);

    const favorites = await Favorite.find({ userId }).sort({ order: 1 });

    const files = await File.find({
      $or: [
        { type: 'ORGANIZATION', isPublic: true },
        { type: 'EMPLOYEE', targetUserId: userId }
      ]
    }).populate('uploadedBy', 'firstName lastName').sort({ createdAt: -1 }).limit(10);

    // Get today's birthdays
    const today = new Date();
    const todayBirthdays = await User.find({
      isActive: true,
      dateOfBirth: { $exists: true }
    }).select('firstName lastName dateOfBirth profileImage');

    const birthdaysToday = todayBirthdays.filter(user => {
      const birthday = new Date(user.dateOfBirth);
      return birthday.getMonth() === today.getMonth() && birthday.getDate() === today.getDate();
    });

    res.json({
      motivationalQuote: getDailyQuote(req.user.role),
      balances: balancesWithAvailable,
      upcomingLeaves,
      recentLeaves,
      pendingCount,
      announcements,
      upcomingHolidays,
      favorites,
      files,
      birthdaysToday
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

const getManagerDashboard = async (req, res) => {
  try {
    const managerId = req.user.id;
    
    const teamMembers = await User.find({ managerId }).select('_id firstName lastName');
    const teamMemberIds = teamMembers.map(m => m._id);

    const pendingApprovals = await LeaveRequest.find({
      userId: { $in: teamMemberIds },
      status: 'PENDING'
    })
    .populate('userId', 'firstName lastName')
    .populate('leaveTypeId', 'name color')
    .sort({ createdAt: -1 });

    const next30Days = new Date();
    next30Days.setDate(next30Days.getDate() + 30);

    const teamCalendar = await LeaveRequest.find({
      userId: { $in: teamMemberIds },
      status: { $in: ['MANAGER_APPROVED', 'HR_APPROVED'] },
      startDate: { $lte: next30Days },
      endDate: { $gte: new Date() }
    })
    .populate('userId', 'firstName lastName')
    .populate('leaveTypeId', 'name color')
    .sort({ startDate: 1 });

    const currentYear = new Date().getFullYear();
    const teamSummary = await LeaveBalance.aggregate([
      { $match: { userId: { $in: teamMemberIds }, year: currentYear } },
      {
        $lookup: {
          from: 'users',
          localField: 'userId',
          foreignField: '_id',
          as: 'user'
        }
      },
      {
        $lookup: {
          from: 'leavetypes',
          localField: 'leaveTypeId',
          foreignField: '_id',
          as: 'leaveType'
        }
      },
      {
        $group: {
          _id: '$userId',
          user: { $first: { $arrayElemAt: ['$user', 0] } },
          totalAllocated: { $sum: { $add: ['$allocated', '$carryForward'] } },
          totalUsed: { $sum: '$used' },
          totalPending: { $sum: '$pending' }
        }
      }
    ]);

    res.json({
      motivationalQuote: getDailyQuote(req.user.role),
      teamMembers,
      pendingApprovals,
      teamCalendar,
      teamSummary
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

const getHRDashboard = async (req, res) => {
  try {
    const cacheKey = `dashboard:hr:${new Date().toDateString()}`;
    const cached = await getCache(cacheKey);
    if (cached) return res.json(cached);

    const currentYear = new Date().getFullYear();
    const currentDate = new Date();
    const next30Days = new Date(currentDate.getTime() + 30 * 24 * 60 * 60 * 1000);

    const [totalEmployees, activeEmployees, inactiveEmployees, employeesOnLeaveToday, departments, genderStats, pendingDocVerifications, employees] = await Promise.all([
      User.countDocuments({ isActive: true }),
      User.countDocuments({ isActive: true, role: 'EMPLOYEE' }),
      User.countDocuments({ isActive: false }),
      LeaveRequest.countDocuments({
        status: { $in: ['MANAGER_APPROVED', 'HR_APPROVED'] },
        startDate: { $lte: currentDate },
        endDate: { $gte: currentDate }
      }),
      Department.find({ status: 'ACTIVE' }).select('_id name employeeCount').lean(),
      User.aggregate([
        { $match: { isActive: true } },
        { $group: { _id: '$gender', count: { $sum: 1 } } }
      ]),
      File.countDocuments({
        type: 'EMPLOYEE',
        verificationStatus: { $in: ['UNVERIFIED', null] }
      }),
      User.find({ isActive: true, joinDate: { $exists: true } }).select('joinDate dateOfBirth department firstName lastName').lean()
    ]);

    const departmentStats = departments.map(dept => ({
      _id: dept.name,
      departmentId: dept._id,
      count: dept.employeeCount || 0
    })).sort((a, b) => b.count - a.count);
    
    const avgTenure = employees.length > 0 
      ? employees.reduce((sum, emp) => {
          const tenure = (currentDate - new Date(emp.joinDate)) / (1000 * 60 * 60 * 24 * 365);
          return sum + tenure;
        }, 0) / employees.length
      : 0;

    const leaveStats = await LeaveRequest.aggregate([
      {
        $match: {
          createdAt: {
            $gte: new Date(currentYear, 0, 1),
            $lt: new Date(currentYear + 1, 0, 1)
          }
        }
      },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalDays: { $sum: '$days' }
        }
      }
    ]);

    const monthlyTrends = await LeaveRequest.aggregate([
      {
        $match: {
          status: 'HR_APPROVED',
          startDate: {
            $gte: new Date(currentYear, 0, 1),
            $lt: new Date(currentYear + 1, 0, 1)
          }
        }
      },
      {
        $group: {
          _id: { $month: '$startDate' },
          count: { $sum: 1 },
          totalDays: { $sum: '$days' }
        }
      },
      { $sort: { '_id': 1 } }
    ]);

    const leaveTypeUsage = await LeaveRequest.aggregate([
      {
        $match: {
          status: 'HR_APPROVED',
          createdAt: {
            $gte: new Date(currentYear, 0, 1),
            $lt: new Date(currentYear + 1, 0, 1)
          }
        }
      },
      {
        $lookup: {
          from: 'leavetypes',
          localField: 'leaveTypeId',
          foreignField: '_id',
          as: 'leaveType'
        }
      },
      {
        $group: {
          _id: '$leaveTypeId',
          leaveType: { $first: { $arrayElemAt: ['$leaveType', 0] } },
          count: { $sum: 1 },
          totalDays: { $sum: '$days' }
        }
      }
    ]);

    const pendingApprovals = await LeaveRequest.countDocuments({
      status: { $in: ['PENDING', 'MANAGER_APPROVED'] }
    });

    const upcomingBirthdaysData = await User.find({
      isActive: true,
      dateOfBirth: { $exists: true }
    }).select('firstName lastName dateOfBirth department').lean();

    const birthdaysInRange = upcomingBirthdaysData.filter(user => {
      const birthday = new Date(user.dateOfBirth);
      const thisYearBirthday = new Date(currentYear, birthday.getMonth(), birthday.getDate());
      const nextYearBirthday = new Date(currentYear + 1, birthday.getMonth(), birthday.getDate());
      
      return (thisYearBirthday >= currentDate && thisYearBirthday <= next30Days) ||
             (nextYearBirthday >= currentDate && nextYearBirthday <= next30Days);
    }).sort((a, b) => {
      const aBirthday = new Date(currentYear, new Date(a.dateOfBirth).getMonth(), new Date(a.dateOfBirth).getDate());
      const bBirthday = new Date(currentYear, new Date(b.dateOfBirth).getMonth(), new Date(b.dateOfBirth).getDate());
      return aBirthday - bBirthday;
    });

    // Bulk fetch departments (fix N+1)
    const deptIds = [...new Set(birthdaysInRange.map(u => u.department).filter(d => d && mongoose.Types.ObjectId.isValid(d)))];
    const depts = await Department.find({ _id: { $in: deptIds } }).select('_id name').lean();
    const deptMap = Object.fromEntries(depts.map(d => [d._id.toString(), d.name]));

    const formattedBirthdays = birthdaysInRange.map(user => {
      if (user.department && deptMap[user.department.toString()]) {
        user.department = deptMap[user.department.toString()];
      }
      return user;
    });

    const newHires = await User.find({
      isActive: true,
      joinDate: { $gte: new Date(currentDate.getTime() - 30 * 24 * 60 * 60 * 1000) }
    }).select('firstName lastName joinDate department').sort({ joinDate: -1 }).lean();

    const formattedNewHires = newHires.map(user => {
      if (user.department && deptMap[user.department.toString()]) {
        user.department = deptMap[user.department.toString()];
      }
      return user;
    });

    const recentActivities = await LeaveRequest.find()
      .populate('userId', 'firstName lastName')
      .populate('leaveTypeId', 'name')
      .sort({ createdAt: -1 })
      .limit(10);

    const result = {
      motivationalQuote: getDailyQuote(req.user.role),
      totalEmployees,
      activeEmployees,
      inactiveEmployees,
      employeesOnLeaveToday,
      departmentStats,
      genderStats,
      pendingDocVerifications,
      avgTenure: Math.round(avgTenure * 10) / 10,
      leaveStats,
      monthlyTrends,
      leaveTypeUsage,
      pendingApprovals,
      upcomingBirthdays: formattedBirthdays,
      newHires: formattedNewHires,
      recentActivities
    };

    await setCache(cacheKey, result, 300);
    res.json(result);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

const exportLeaveReport = async (req, res) => {
  try {
    const { startDate, endDate, userId, leaveTypeId } = req.query;
    const filter = {};

    if (startDate && endDate) {
      filter.startDate = { $gte: new Date(startDate), $lte: new Date(endDate) };
    }
    
    // Role-based filtering
    if (req.user.role === "MANAGER") {
      // Managers can only export their team's data
      const teamMembers = await User.find({ managerId: req.user.id }).select('_id');
      const teamMemberIds = teamMembers.map(m => m._id);
      
      if (userId) {
        // Check if requested user is in their team
        const isInTeam = teamMemberIds.some(id => id.toString() === userId);
        if (isInTeam || userId === req.user.id) {
          filter.userId = userId;
        } else {
          return res.status(403).json({ message: 'Access denied. You can only export your team members data.' });
        }
      } else {
        // Export all team members + self
        filter.userId = { $in: [...teamMemberIds, req.user.id] };
      }
    } else if (userId) {
      filter.userId = userId;
    }
    
    if (leaveTypeId) filter.leaveTypeId = leaveTypeId;

    const leaves = await LeaveRequest.find(filter)
      .populate('userId', 'firstName lastName email department')
      .populate('leaveTypeId', 'name')
      .sort({ startDate: -1 });

    const csvData = await Promise.all(leaves.map(async (leave) => {
      let deptName = leave.userId.department || '';
      if (deptName && mongoose.Types.ObjectId.isValid(deptName)) {
        const dept = await Department.findById(deptName);
        deptName = dept?.name || deptName;
      }
      return {
        Employee: `${leave.userId.firstName} ${leave.userId.lastName}`,
        Email: leave.userId.email,
        Department: deptName,
        LeaveType: leave.leaveTypeId.name,
        StartDate: leave.startDate.toISOString().split('T')[0],
        EndDate: leave.endDate.toISOString().split('T')[0],
        Days: leave.days,
        Status: leave.status,
        Reason: leave.reason,
        IsLOP: leave.isLOP ? 'Yes' : 'No'
      };
    }));

    res.json(csvData);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

const getTeamMembers = async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await User.findById(userId);
    
    if (!user) {
      return res.json([]);
    }
    
    const teamMembers = await User.find({
      $or: [
        { department: user.department },
        { managerId: userId }
      ],
      _id: { $ne: userId },
      isActive: true
    }).select('_id firstName lastName department role').sort({ firstName: 1 });
    
    const formattedMembers = await Promise.all(teamMembers.map(async (member) => {
      const memberObj = member.toObject();
      if (memberObj.department && mongoose.Types.ObjectId.isValid(memberObj.department)) {
        const dept = await Department.findById(memberObj.department);
        memberObj.department = dept?.name || memberObj.department;
      }
      return memberObj;
    }));
    
    res.json(formattedMembers);
  } catch (error) {
    console.error('Error fetching team members:', error);
    res.json([]);
  }
};

module.exports = {
  getEmployeeDashboard,
  getManagerDashboard,
  getHRDashboard,
  exportLeaveReport,
  getTeamMembers
};
