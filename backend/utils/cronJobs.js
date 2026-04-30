const cron = require('node-cron');
const { accrueBalances, carryForward } = require('../controllers/leaveBalanceController');
const Holiday = require('../models/Holiday');
const LeaveRequest = require('../models/LeaveRequest');
const User = require('../models/User');
const Attendance = require('../models/Attendance');
const DailyUpdate = require('../models/DailyUpdate');
const { sendHolidayNotification, sendLeaveReminderNotification, sendExpenseDeadlineReminder } = require('./emailService');
const moment = require('moment-timezone');

// Monthly accrual on 1st of every month at 00:00
cron.schedule('0 0 1 * *', async () => {
  
  await accrueBalances();
});

// Year-end carry forward on January 1st at 00:00
cron.schedule('0 0 1 1 *', async () => {
  
  await carryForward();
});

// Holiday notification - runs daily at 09:00 AM
cron.schedule('0 9 * * *', async () => {
  
  
  const twoDaysFromNow = new Date();
  twoDaysFromNow.setDate(twoDaysFromNow.getDate() + 2);
  twoDaysFromNow.setHours(0, 0, 0, 0);
  
  const nextDay = new Date(twoDaysFromNow);
  nextDay.setDate(nextDay.getDate() + 1);
  
  try {
    const upcomingHolidays = await Holiday.find({
      type: 'FESTIVAL',
      date: {
        $gte: twoDaysFromNow,
        $lt: nextDay
      }
    });
    
    if (upcomingHolidays.length > 0) {
      const employees = await User.find({ role: { $in: ['EMPLOYEE', 'MANAGER', 'HR'] } });
      
      for (const holiday of upcomingHolidays) {
        await sendHolidayNotification(employees, holiday);
      }
    }
  } catch (error) {
    console.error('Error in holiday notification job:', error);
  }
});

// Leave reminder - runs daily at 10:00 AM
cron.schedule('0 10 * * *', async () => {
  
  
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);
  
  const dayAfterTomorrow = new Date(tomorrow);
  dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 1);
  
  try {
    const pendingLeaves = await LeaveRequest.find({
      status: 'PENDING',
      startDate: {
        $gte: tomorrow,
        $lt: dayAfterTomorrow
      }
    }).populate(['userId', 'leaveTypeId']);
    
    for (const leaveRequest of pendingLeaves) {
      await sendLeaveReminderNotification(leaveRequest);
    }
    
    if (pendingLeaves.length > 0) {
      
    }
  } catch (error) {
    console.error('Error in leave reminder job:', error);
  }
});

// Auto checkout - runs every 30 minutes from 6 PM to 11 PM to handle different office end times
cron.schedule('*/30 18-23 * * *', async () => {
  
  
  const today = moment.tz('Asia/Kolkata').startOf('day').toDate();
  const now = moment.tz('Asia/Kolkata');
  const currentHour = now.hour();
  const currentMinute = now.minute();
  
  try {
    const OfficeLocation = require('../models/OfficeLocation');
    
    // Find all attendance records that need auto-checkout
    const attendanceRecords = await Attendance.find({
      date: today,
      checkIn: { $exists: true },
      checkOut: { $exists: false },
      status: { $in: ['Present', 'Late'] },
      isDeleted: { $ne: true },
      officeLocation: { $exists: true, $ne: null }
    }).populate('officeLocation');
    
    let checkedOutCount = 0;
    
    for (const record of attendanceRecords) {
      if (!record.officeLocation) continue;
      
      const office = record.officeLocation;
      const officeEndHour = office.endTime;
      const officeEndMinute = office.endMinute || 0;
      
      // Calculate total minutes since midnight
      const currentTotalMinutes = currentHour * 60 + currentMinute;
      const officeEndTotalMinutes = officeEndHour * 60 + officeEndMinute;
      
      // Auto-checkout if current time is at least 30 minutes after office end time
      if (currentTotalMinutes >= officeEndTotalMinutes + 30) {
        const checkoutTime = moment.tz('Asia/Kolkata')
          .set({ hour: officeEndHour, minute: officeEndMinute, second: 0, millisecond: 0 })
          .toDate();
        
        record.checkOut = checkoutTime;
        record.isAutoCheckout = true;
        
        const timeStr = `${officeEndHour}:${String(officeEndMinute).padStart(2, '0')}`;
        record.notes = record.notes 
          ? `${record.notes} | Auto checkout at ${timeStr} (${office.name})` 
          : `Auto checkout at ${timeStr} (${office.name})`;
        
        await record.save();
        checkedOutCount++;
      }
    }
    
    // Handle employees without office location (Remote/Hybrid) - use default 6 PM
    const recordsWithoutOffice = await Attendance.find({
      date: today,
      checkIn: { $exists: true },
      checkOut: { $exists: false },
      status: { $in: ['Present', 'Late'] },
      isDeleted: { $ne: true },
      $or: [
        { officeLocation: { $exists: false } },
        { officeLocation: null }
      ]
    });
    
    // Auto-checkout remote/hybrid employees at 6:30 PM (default)
    if (currentHour === 18 && currentMinute >= 30) {
      const defaultCheckoutTime = moment.tz('Asia/Kolkata')
        .set({ hour: 18, minute: 0, second: 0, millisecond: 0 })
        .toDate();
      
      for (const record of recordsWithoutOffice) {
        record.checkOut = defaultCheckoutTime;
        record.isAutoCheckout = true;
        record.notes = record.notes 
          ? `${record.notes} | Auto checkout at 6:00 PM (default)` 
          : 'Auto checkout at 6:00 PM (default)';
        await record.save();
        checkedOutCount++;
      }
    }
    
    if (checkedOutCount > 0) {
      
    }
  } catch (error) {
    console.error('Error in auto checkout job:', error);
  }
});

// Clear daily updates - runs daily at 00:00 (midnight)
cron.schedule('0 0 * * *', async () => {
  
  
  try {
    const result = await DailyUpdate.deleteMany({});
    
  } catch (error) {
    console.error('Error clearing daily updates:', error);
  }
});

// Expense deadline reminder — runs daily at 9:00 AM
// Sends reminder ONLY on the last day of the month to all active employees
cron.schedule('0 9 * * *', async () => {
  const now = new Date();
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const today = now.getDate();

  // Only send on the last day of the month
  if (today !== lastDay) return;

  const billingMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  try {
    const employees = await User.find({ role: 'EMPLOYEE', isActive: { $ne: false } }, 'firstName lastName email');
    if (employees.length === 0) return;
    // Send email indicating today is the last day (daysLeft = 0)
    await sendExpenseDeadlineReminder(employees, 0, lastDay, billingMonth);
  } catch (error) {
    console.error('Error in expense deadline reminder job:', error);
  }
});

// Auto generate field visit daily reports — runs at 11:55 PM every day
cron.schedule('55 23 * * *', async () => {
  
  try {
    const { generateDailyReport } = require('../controllers/fieldReportController');
    const FieldVisit = require('../models/FieldVisit');
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Find all employees who had visits today
    const employeesWithVisits = await FieldVisit.distinct('employeeId', {
      visitDate: { $gte: today }
    });

    for (const empId of employeesWithVisits) {
      await generateDailyReport(empId, new Date());
    }
    
  } catch (error) {
    console.error('Error generating field reports:', error);
  }
});

// Auto-end active journeys at midnight
cron.schedule('59 23 * * *', async () => {
  
  try {
    const { autoEndJourneys } = require('../controllers/journeyController');
    await autoEndJourneys();
  } catch (error) {
    console.error('Error in auto-end journeys job:', error);
  }
});

// Journey start reminder - runs every 30 minutes during work hours (9 AM - 6 PM)
cron.schedule('*/30 9-18 * * *', async () => {
  
  try {
    const { sendJourneyStartReminders } = require('../services/journeyNotificationService');
    await sendJourneyStartReminders();
  } catch (error) {
    console.error('Error in journey start reminder job:', error);
  }
});

// End journey reminder - runs at 6 PM and 7 PM
cron.schedule('0 18,19 * * *', async () => {
  
  try {
    const { sendEndJourneyReminders } = require('../services/journeyNotificationService');
    await sendEndJourneyReminders();
  } catch (error) {
    console.error('Error in end journey reminder job:', error);
  }
});

// Low battery alerts - runs every hour during work hours
cron.schedule('0 9-18 * * *', async () => {
  
  try {
    const { sendLowBatteryAlerts } = require('../services/journeyNotificationService');
    await sendLowBatteryAlerts();
  } catch (error) {
    console.error('Error in low battery alert job:', error);
  }
});



