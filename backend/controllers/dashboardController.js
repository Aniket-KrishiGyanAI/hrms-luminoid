const mongoose = require('mongoose');
const LeaveRequest = require('../models/LeaveRequest');
const LeaveBalance = require('../models/LeaveBalance');
const User = require('../models/User');
const Announcement = require('../models/Announcement');
const Holiday = require('../models/Holiday');
const Favorite = require('../models/Favorite');
const File = require('../models/File');
const Department = require('../models/Department');
const Attendance = require('../models/Attendance');
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

    const [totalEmployees, activeEmployees, inactiveEmployees, employeesOnLeaveToday, genderStats, pendingDocVerifications, employees] = await Promise.all([
      User.countDocuments({ isActive: true }),
      User.countDocuments({ isActive: true, role: 'EMPLOYEE' }),
      User.countDocuments({ isActive: false }),
      LeaveRequest.countDocuments({
        status: { $in: ['MANAGER_APPROVED', 'HR_APPROVED'] },
        startDate: { $lte: currentDate },
        endDate: { $gte: currentDate }
      }),
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

    // Calculate department stats from actual user data
    const departmentStatsRaw = await User.aggregate([
      { 
        $match: { 
          isActive: true,
          department: { $exists: true, $ne: null }
        } 
      },
      {
        $addFields: {
          departmentObjectId: {
            $cond: {
              if: { $eq: [{ $type: '$department' }, 'objectId'] },
              then: '$department',
              else: { $toObjectId: { $cond: [{ $regexMatch: { input: { $toString: '$department' }, regex: /^[0-9a-fA-F]{24}$/ } }, '$department', null] } }
            }
          }
        }
      },
      {
        $match: {
          departmentObjectId: { $ne: null }
        }
      },
      {
        $group: {
          _id: '$departmentObjectId',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } }
    ]);

    // Get department names
    const deptIds = departmentStatsRaw.map(d => d._id);
    const departments = await Department.find({ _id: { $in: deptIds } }).select('_id name').lean();
    const deptMap = Object.fromEntries(departments.map(d => [d._id.toString(), d.name]));

    const departmentStats = departmentStatsRaw.map(dept => ({
      _id: deptMap[dept._id.toString()] || 'Unknown',
      departmentId: dept._id.toString(),
      count: dept.count
    })).filter(d => d._id !== 'Unknown');
    
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

    // Bulk fetch departments for birthdays and new hires
    const allDeptIds = [...new Set([...birthdaysInRange.map(u => u.department), ...employees.map(e => e.department)].filter(d => d && mongoose.Types.ObjectId.isValid(d)))];
    const allDepts = await Department.find({ _id: { $in: allDeptIds } }).select('_id name').lean();
    const allDeptMap = Object.fromEntries(allDepts.map(d => [d._id.toString(), d.name]));

    const formattedBirthdays = birthdaysInRange.map(user => ({
      ...user,
      department: user.department && allDeptMap[user.department.toString()] ? allDeptMap[user.department.toString()] : 'N/A'
    }));

    const newHires = await User.find({
      isActive: true,
      joinDate: { $gte: new Date(currentDate.getTime() - 30 * 24 * 60 * 60 * 1000) }
    }).select('firstName lastName joinDate department').sort({ joinDate: -1 }).lean();

    const formattedNewHires = newHires.map(user => ({
      ...user,
      department: user.department && allDeptMap[user.department.toString()] ? allDeptMap[user.department.toString()] : 'N/A'
    }));

    const recentActivities = await LeaveRequest.find()
      .populate('userId', 'firstName lastName')
      .populate('leaveTypeId', 'name')
      .sort({ createdAt: -1 })
      .limit(10);

    const monthlyAttendance = await Attendance.aggregate([
      {
        $match: {
          date: {
            $gte: new Date(currentYear, 0, 1),
            $lt: new Date(currentYear + 1, 0, 1)
          },
          isDeleted: false
        }
      },
      {
        $group: {
          _id: { 
            month: { $month: '$date' },
            userId: '$userId'
          },
          presentDays: {
            $sum: {
              $cond: [{ $in: ['$status', ['Present', 'Late', 'Half Day']] }, 1, 0]
            }
          },
          totalDays: { $sum: 1 }
        }
      },
      {
        $group: {
          _id: '$_id.month',
          totalPresentDays: { $sum: '$presentDays' },
          totalWorkingDays: { $sum: '$totalDays' }
        }
      },
      { $sort: { '_id': 1 } }
    ]);

    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const formattedAttendance = months.map((month, index) => {
      const data = monthlyAttendance.find(d => d._id === index + 1);
      const percentage = data && data.totalWorkingDays > 0 
        ? Math.round((data.totalPresentDays / data.totalWorkingDays) * 100) 
        : 0;
      return {
        month,
        percentage
      };
    });

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
      recentActivities,
      monthlyAttendance: formattedAttendance
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

const getMonthlyAttendance = async (req, res) => {
  try {
    const currentYear = new Date().getFullYear();
    
    const monthlyData = await Attendance.aggregate([
      {
        $match: {
          date: {
            $gte: new Date(currentYear, 0, 1),
            $lt: new Date(currentYear + 1, 0, 1)
          },
          isDeleted: false
        }
      },
      {
        $group: {
          _id: { $month: '$date' },
          present: {
            $sum: {
              $cond: [{ $eq: ['$status', 'Present'] }, 1, 0]
            }
          },
          absent: {
            $sum: {
              $cond: [{ $eq: ['$status', 'Absent'] }, 1, 0]
            }
          },
          late: {
            $sum: {
              $cond: [{ $eq: ['$status', 'Late'] }, 1, 0]
            }
          },
          halfDay: {
            $sum: {
              $cond: [{ $eq: ['$status', 'Half Day'] }, 1, 0]
            }
          },
          onLeave: {
            $sum: {
              $cond: [{ $eq: ['$status', 'On Leave'] }, 1, 0]
            }
          }
        }
      },
      { $sort: { '_id': 1 } }
    ]);

    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const formattedData = months.map((month, index) => {
      const data = monthlyData.find(d => d._id === index + 1);
      return {
        month,
        present: data?.present || 0,
        absent: data?.absent || 0,
        late: data?.late || 0,
        halfDay: data?.halfDay || 0,
        onLeave: data?.onLeave || 0
      };
    });

    res.json(formattedData);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

const getTopPerformers = async (req, res) => {
  try {
    const startOfWeek = new Date();
    startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
    startOfWeek.setHours(0, 0, 0, 0);

    const topPerformers = await Attendance.aggregate([
      {
        $match: {
          date: { $gte: startOfWeek },
          isDeleted: false,
          status: { $in: ['Present', 'Late', 'Half Day'] },
          totalHours: { $gt: 0 }
        }
      },
      {
        $group: {
          _id: '$userId',
          totalHours: { $sum: '$totalHours' }
        }
      },
      { $sort: { totalHours: -1 } },
      { $limit: 5 },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'user',
          pipeline: [
            { $project: { firstName: 1, lastName: 1, profileImage: 1, department: 1 } }
          ]
        }
      },
      { $unwind: '$user' },
      {
        $project: {
          _id: '$user._id',
          firstName: '$user.firstName',
          lastName: '$user.lastName',
          profileImage: '$user.profileImage',
          department: '$user.department',
          totalHours: 1
        }
      }
    ]).allowDiskUse(true);

    const deptIds = topPerformers.map(p => p.department).filter(d => d && mongoose.Types.ObjectId.isValid(d));
    const departments = deptIds.length > 0 ? await Department.find({ _id: { $in: deptIds } }).select('_id name').lean() : [];
    const deptMap = Object.fromEntries(departments.map(d => [d._id.toString(), d.name]));

    const result = topPerformers.map(p => ({
      ...p,
      department: p.department && deptMap[p.department.toString()] ? deptMap[p.department.toString()] : null
    }));

    res.json(result);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

module.exports = {
  getEmployeeDashboard,
  getManagerDashboard,
  getHRDashboard,
  exportLeaveReport,
  getTeamMembers,
  getMonthlyAttendance,
  getTopPerformers
};
