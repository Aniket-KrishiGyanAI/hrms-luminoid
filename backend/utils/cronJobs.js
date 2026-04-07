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
  console.log('Running monthly accrual...');
  await accrueBalances();
});

// Year-end carry forward on January 1st at 00:00
cron.schedule('0 0 1 1 *', async () => {
  console.log('Running year-end carry forward...');
  await carryForward();
});

// Holiday notification - runs daily at 09:00 AM
cron.schedule('0 9 * * *', async () => {
  console.log('Checking for upcoming holidays...');
  
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
  console.log('Checking for pending leave approvals...');
  
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
      console.log(`Sent ${pendingLeaves.length} leave reminder notifications`);
    }
  } catch (error) {
    console.error('Error in leave reminder job:', error);
  }
});

// Auto checkout - runs daily at 6:30 PM
cron.schedule('30 18 * * *', async () => {
  console.log('Running auto checkout for employees who forgot to check out...');
  
  const today = moment.tz('Asia/Kolkata').startOf('day').toDate();
  const checkoutTime = moment.tz('Asia/Kolkata').set({ hour: 18, minute: 0, second: 0, millisecond: 0 }).toDate();
  
  try {
    const attendanceRecords = await Attendance.find({
      date: today,
      checkIn: { $exists: true },
      checkOut: { $exists: false },
      status: { $in: ['Present', 'Late'] },
      isDeleted: { $ne: true }
    });
    
    if (attendanceRecords.length > 0) {
      for (const record of attendanceRecords) {
        record.checkOut = checkoutTime;
        record.isAutoCheckout = true;
        record.notes = record.notes 
          ? `${record.notes} | Auto checkout at 6:00 PM` 
          : 'Auto checkout at 6:00 PM';
        await record.save();
      }
      
      console.log(`Auto checked out ${attendanceRecords.length} employees at 6:00 PM`);
    }
  } catch (error) {
    console.error('Error in auto checkout job:', error);
  }
});

// Clear daily updates - runs daily at 00:00 (midnight)
cron.schedule('0 0 * * *', async () => {
  console.log('Clearing daily updates...');
  
  try {
    const result = await DailyUpdate.deleteMany({});
    console.log(`Deleted ${result.deletedCount} daily updates`);
  } catch (error) {
    console.error('Error clearing daily updates:', error);
  }
});

// Expense deadline reminder — runs daily at 9:00 AM
// Sends reminder on the last 3 days of every month to all active employees
cron.schedule('0 9 * * *', async () => {
  const now = new Date();
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const today = now.getDate();
  const daysLeft = lastDay - today;

  // Only send on last 2 days (daysLeft = 0, 1 means today is lastDay or lastDay-1)
  if (daysLeft > 1) return;

  const billingMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  try {
    const employees = await User.find({ role: 'EMPLOYEE', isActive: { $ne: false } }, 'firstName lastName email');
    if (employees.length === 0) return;
    await sendExpenseDeadlineReminder(employees, daysLeft === 0 ? 1 : daysLeft, lastDay, billingMonth);
  } catch (error) {
    console.error('Error in expense deadline reminder job:', error);
  }
});

// Auto generate field visit daily reports — runs at 11:55 PM every day
cron.schedule('55 23 * * *', async () => {
  console.log('Generating field visit daily reports...');
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
    console.log(`Field reports generated for ${employeesWithVisits.length} employees`);
  } catch (error) {
    console.error('Error generating field reports:', error);
  }
});

// Auto-end active journeys at midnight
cron.schedule('59 23 * * *', async () => {
  console.log('Auto-ending active journeys at midnight...');
  try {
    const { autoEndJourneys } = require('../controllers/journeyController');
    await autoEndJourneys();
  } catch (error) {
    console.error('Error in auto-end journeys job:', error);
  }
});

// Journey start reminder - runs every 30 minutes during work hours (9 AM - 6 PM)
cron.schedule('*/30 9-18 * * *', async () => {
  console.log('Checking for journey start reminders...');
  try {
    const { sendJourneyStartReminders } = require('../services/journeyNotificationService');
    await sendJourneyStartReminders();
  } catch (error) {
    console.error('Error in journey start reminder job:', error);
  }
});

// End journey reminder - runs at 6 PM and 7 PM
cron.schedule('0 18,19 * * *', async () => {
  console.log('Sending end journey reminders...');
  try {
    const { sendEndJourneyReminders } = require('../services/journeyNotificationService');
    await sendEndJourneyReminders();
  } catch (error) {
    console.error('Error in end journey reminder job:', error);
  }
});

// Low battery alerts - runs every hour during work hours
cron.schedule('0 9-18 * * *', async () => {
  console.log('Checking for low battery alerts...');
  try {
    const { sendLowBatteryAlerts } = require('../services/journeyNotificationService');
    await sendLowBatteryAlerts();
  } catch (error) {
    console.error('Error in low battery alert job:', error);
  }
});

console.log('Cron jobs scheduled successfully');

