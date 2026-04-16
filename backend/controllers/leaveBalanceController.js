const LeaveBalance = require('../models/LeaveBalance');
const LeaveType = require('../models/LeaveType');
const User = require('../models/User');
const logger = require('../utils/logger');

// Helper function to ensure balances exist and monthly accruals are applied
const ensureBalancesForUser = async (userId, year) => {
  const user = await User.findById(userId);
  if (!user || !user.isActive) return;

  const currentMonth = new Date().getMonth();
  const currentYear = new Date().getFullYear();
  const joinDate = new Date(user.joinDate);
  const joinYear = joinDate.getFullYear();
  const joinMonth = joinDate.getMonth();

  // Find vacation leave (Annual Leave or Vacation Leave)
  const vacationLeave = await LeaveType.findOne({ 
    isActive: true, 
    $or: [
      { name: { $regex: /vacation|annual/i } }
    ]
  });
  
  // Find sick leave
  const sickLeave = await LeaveType.findOne({ 
    isActive: true, 
    name: { $regex: /sick/i } 
  });

  // Process vacation leave - add 1 day per month
  if (vacationLeave) {
    let vacationBalance = await LeaveBalance.findOne({
      userId: user._id,
      leaveTypeId: vacationLeave._id,
      year: year
    });

    // Calculate correct allocation based on join date and year
    let correctAllocated = 0;
    
    if (year < joinYear) {
      // Year before join date - no allocation
      correctAllocated = 0;
    } else if (year === joinYear) {
      // User joined this year
      if (year === currentYear) {
        // Viewing current year - calculate from join month to current month
        const monthsFromJoin = currentMonth - joinMonth + 1;
        correctAllocated = Math.max(0, monthsFromJoin); // 1 per month
      } else {
        // Viewing past join year - calculate from join month to end of year
        const monthsRemaining = 12 - joinMonth;
        correctAllocated = monthsRemaining; // 1 per month
      }
    } else if (year === currentYear) {
      // User joined in previous year, viewing current year
      // Calculate from January to current month
      const monthsElapsed = currentMonth + 1;
      correctAllocated = monthsElapsed; // 1 per month
    } else if (year < currentYear) {
      // Past year after join year - full year allocation (12 months)
      correctAllocated = 12; // 1 per month for full year
    }
    // Future years will be 0 and accrued by cron job
    
    correctAllocated = Math.min(correctAllocated, vacationLeave.maxPerYear);

    if (!vacationBalance) {
      // Create new balance with correct allocation
      vacationBalance = await LeaveBalance.create({
        userId: user._id,
        leaveTypeId: vacationLeave._id,
        year: year,
        allocated: correctAllocated,
        lastAccrualDate: new Date()
      });
    } else {
      // Always recalculate for current year to ensure accuracy based on join date
      if (year === currentYear) {
        vacationBalance.allocated = correctAllocated;
        vacationBalance.lastAccrualDate = new Date(); // Update to prevent double accrual
        await vacationBalance.save();
      }
    }
  }

  // Process sick leave - add 0.5 days per month
  if (sickLeave) {
    let sickBalance = await LeaveBalance.findOne({
      userId: user._id,
      leaveTypeId: sickLeave._id,
      year: year
    });

    // Calculate correct allocation based on join date and year
    let correctSickAllocated = 0;
    
    if (year < joinYear) {
      // Year before join date - no allocation
      correctSickAllocated = 0;
    } else if (year === joinYear) {
      // User joined this year
      if (year === currentYear) {
        // Viewing current year - calculate from join month to current month
        const monthsFromJoin = currentMonth - joinMonth + 1;
        correctSickAllocated = Math.max(0, monthsFromJoin) * 0.5; // 0.5 per month
      } else {
        // Viewing past join year - calculate from join month to end of year
        const monthsRemaining = 12 - joinMonth;
        correctSickAllocated = monthsRemaining * 0.5; // 0.5 per month
      }
    } else if (year === currentYear) {
      // User joined in previous year, viewing current year
      // Calculate from January to current month
      const monthsElapsed = currentMonth + 1;
      correctSickAllocated = monthsElapsed * 0.5; // 0.5 per month
    } else if (year < currentYear) {
      // Past year after join year - full year allocation (12 months)
      correctSickAllocated = 12 * 0.5; // 0.5 per month for full year = 6 days
    }
    // Future years will be 0 and accrued by cron job
    
    correctSickAllocated = Math.min(correctSickAllocated, sickLeave.maxPerYear);

    if (!sickBalance) {
      // Create new balance with correct allocation
      sickBalance = await LeaveBalance.create({
        userId: user._id,
        leaveTypeId: sickLeave._id,
        year: year,
        allocated: correctSickAllocated,
        lastAccrualDate: new Date()
      });
    } else {
      // Always recalculate for current year to ensure accuracy based on join date
      if (year === currentYear) {
        sickBalance.allocated = correctSickAllocated;
        sickBalance.lastAccrualDate = new Date(); // Update to prevent double accrual
        await sickBalance.save();
      }
    }
  }
};

const getBalances = async (req, res) => {
  try {
    const year = req.query.year || new Date().getFullYear();
    const userId = req.params.userId || req.user.id;

    // Ensure balances exist and monthly accruals are applied
    await ensureBalancesForUser(userId, year);

    const balances = await LeaveBalance.find({ userId, year })
      .populate('leaveTypeId', 'name color')
      .lean();

    const balancesWithAvailable = balances.map(b => ({
      ...b,
      available: b.allocated + b.carryForward - b.used - b.pending
    }));

    res.json(balancesWithAvailable);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

const initializeBalances = async (req, res) => {
  try {
    const { userId, year } = req.body;
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const leaveTypes = await LeaveType.find({ isActive: true });
    const currentYear = year || new Date().getFullYear();
    const joinDate = new Date(user.joinDate);
    const joinYear = joinDate.getFullYear();
    const joinMonth = joinDate.getMonth();

    for (const leaveType of leaveTypes) {
      const existing = await LeaveBalance.findOne({ userId, leaveTypeId: leaveType._id, year: currentYear });
      if (existing) continue;

      let allocated = 0;
      if (leaveType.accrualType === 'YEARLY') {
        if (currentYear === joinYear) {
          const monthsRemaining = 12 - joinMonth;
          allocated = (leaveType.accrualRate / 12) * monthsRemaining;
        } else {
          allocated = leaveType.accrualRate;
        }
      } else if (leaveType.accrualType === 'MONTHLY') {
        if (currentYear === joinYear) {
          const monthsRemaining = 12 - joinMonth;
          allocated = leaveType.accrualRate * monthsRemaining;
        } else {
          allocated = leaveType.accrualRate * 12;
        }
      }

      allocated = Math.min(allocated, leaveType.maxPerYear);

      await LeaveBalance.create({
        userId,
        leaveTypeId: leaveType._id,
        year: currentYear,
        allocated: Math.round(allocated * 100) / 100,
        lastAccrualDate: new Date()
      });
    }

    res.json({ message: 'Balances initialized successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

const accrueBalances = async () => {
  try {
    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth();
    const users = await User.find({ isActive: true });
    
    // Find vacation leave (Annual Leave or Vacation Leave)
    const vacationLeave = await LeaveType.findOne({ 
      isActive: true, 
      $or: [
        { name: { $regex: /vacation|annual/i } }
      ]
    });
    
    // Find sick leave
    const sickLeave = await LeaveType.findOne({ 
      isActive: true, 
      name: { $regex: /sick/i } 
    });

    for (const user of users) {
      const joinDate = new Date(user.joinDate);
      const joinYear = joinDate.getFullYear();
      const joinMonth = joinDate.getMonth();
      
      // Check if user has been with company for at least one month from join date
      // Only accrue if current month is after join month (or same year but later month, or later year)
      const shouldAccrue = (currentYear > joinYear) || 
                          (currentYear === joinYear && currentMonth > joinMonth);
      
      if (!shouldAccrue) {
        continue; // Skip if user joined this month or hasn't completed one month yet
      }

      // Process vacation leave - add 1 day per month
      if (vacationLeave) {
        let vacationBalance = await LeaveBalance.findOne({
          userId: user._id,
          leaveTypeId: vacationLeave._id,
          year: currentYear
        });

        if (!vacationBalance) {
          // Calculate initial allocation from join date to current month
          let initialAllocated = 0;
          if (currentYear === joinYear) {
            // Joined this year - calculate from join month to current month
            const monthsFromJoin = currentMonth - joinMonth + 1;
            initialAllocated = Math.max(0, monthsFromJoin);
          } else {
            // Joined previous year - calculate from January to current month
            initialAllocated = currentMonth + 1;
          }
          
          vacationBalance = await LeaveBalance.create({
            userId: user._id,
            leaveTypeId: vacationLeave._id,
            year: currentYear,
            allocated: Math.min(initialAllocated, vacationLeave.maxPerYear),
            lastAccrualDate: new Date()
          });
        } else {
          // Check if accrual already happened this month
          const lastAccrual = vacationBalance.lastAccrualDate;
          if (!lastAccrual || lastAccrual.getMonth() !== currentMonth || lastAccrual.getFullYear() !== currentYear) {
            const newAllocated = Math.min(
              vacationBalance.allocated + 1,
              vacationLeave.maxPerYear
            );
            vacationBalance.allocated = Math.round(newAllocated * 100) / 100;
            vacationBalance.lastAccrualDate = new Date();
            await vacationBalance.save();
          }
        }
      }

      // Process sick leave - add 0.5 days per month
      if (sickLeave) {
        let sickBalance = await LeaveBalance.findOne({
          userId: user._id,
          leaveTypeId: sickLeave._id,
          year: currentYear
        });

        if (!sickBalance) {
          // Calculate initial allocation from join date to current month
          let initialAllocated = 0;
          if (currentYear === joinYear) {
            // Joined this year - calculate from join month to current month
            const monthsFromJoin = currentMonth - joinMonth + 1;
            initialAllocated = Math.max(0, monthsFromJoin) * 0.5;
          } else {
            // Joined previous year - calculate from January to current month
            initialAllocated = (currentMonth + 1) * 0.5;
          }
          
          sickBalance = await LeaveBalance.create({
            userId: user._id,
            leaveTypeId: sickLeave._id,
            year: currentYear,
            allocated: Math.min(initialAllocated, sickLeave.maxPerYear),
            lastAccrualDate: new Date()
          });
        } else {
          // Check if accrual already happened this month
          const lastAccrual = sickBalance.lastAccrualDate;
          if (!lastAccrual || lastAccrual.getMonth() !== currentMonth || lastAccrual.getFullYear() !== currentYear) {
            const newAllocated = Math.min(
              sickBalance.allocated + 0.5,
              sickLeave.maxPerYear
            );
            sickBalance.allocated = Math.round(newAllocated * 100) / 100;
            sickBalance.lastAccrualDate = new Date();
            await sickBalance.save();
          }
        }
      }
    }

    // 
  } catch (error) {
    console.error('Accrual error:', error);
  }
};

const carryForward = async () => {
  try {
    const currentYear = new Date().getFullYear();
    const previousYear = currentYear - 1;
    const leaveTypes = await LeaveType.find({ isActive: true, carryForward: true });

    for (const leaveType of leaveTypes) {
      const previousBalances = await LeaveBalance.find({
        leaveTypeId: leaveType._id,
        year: previousYear
      });

      for (const prevBalance of previousBalances) {
        const remaining = prevBalance.allocated + prevBalance.carryForward - prevBalance.used;
        const carryForwardAmount = Math.min(
          Math.max(remaining, 0),
          leaveType.maxCarryForward
        );

        let currentBalance = await LeaveBalance.findOne({
          userId: prevBalance.userId,
          leaveTypeId: leaveType._id,
          year: currentYear
        });

        if (!currentBalance) {
          currentBalance = await LeaveBalance.create({
            userId: prevBalance.userId,
            leaveTypeId: leaveType._id,
            year: currentYear,
            allocated: leaveType.accrualType === 'YEARLY' ? leaveType.accrualRate : 0,
            carryForward: carryForwardAmount
          });
        } else {
          currentBalance.carryForward = carryForwardAmount;
          await currentBalance.save();
        }
      }
    }

    // 
  } catch (error) {
    console.error('Carry forward error:', error);
  }
};

module.exports = {
  getBalances,
  initializeBalances,
  accrueBalances,
  carryForward,
  ensureBalancesForUser
};