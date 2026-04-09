const Attendance = require('../models/Attendance');
const Journey = require('../models/Journey');
const User = require('../models/User');
const moment = require('moment-timezone');

// Check for employees who checked in but haven't started journey
exports.sendJourneyStartReminders = async () => {
  try {
    const todayStart = moment.tz('Asia/Kolkata').startOf('day').toDate();
    const todayEnd = moment.tz('Asia/Kolkata').endOf('day').toDate();
    const thirtyMinutesAgo = moment.tz('Asia/Kolkata').subtract(30, 'minutes').toDate();

    // Find field employees who checked in >30 mins ago but haven't started journey
    const attendances = await Attendance.find({
      date: { $gte: todayStart, $lte: todayEnd },
      checkIn: { $exists: true, $lte: thirtyMinutesAgo }
    }).populate('userId', 'isFieldEmployee firstName lastName email');

    for (const attendance of attendances) {
      if (!attendance.userId?.isFieldEmployee) continue;

      // Check if journey exists
      const journey = await Journey.findOne({
        employeeId: attendance.userId._id,
        date: { $gte: todayStart, $lte: todayEnd }
      });

      if (!journey) {
        // TODO: Send notification/email to employee
        console.log(`Reminder: ${attendance.userId.firstName} ${attendance.userId.lastName} should start journey`);
        // You can integrate with email service, push notifications, or in-app notifications here
      }
    }
  } catch (error) {
    console.error('Journey start reminder error:', error);
  }
};

// Check for active journeys after work hours
exports.sendEndJourneyReminders = async () => {
  try {
    const todayStart = moment.tz('Asia/Kolkata').startOf('day').toDate();
    const todayEnd = moment.tz('Asia/Kolkata').endOf('day').toDate();
    const currentHour = moment.tz('Asia/Kolkata').hour();

    // Only run after 6 PM
    if (currentHour < 18) return;

    const activeJourneys = await Journey.find({
      date: { $gte: todayStart, $lte: todayEnd },
      status: { $in: ['ACTIVE', 'PAUSED'] },
      endJourneyReminderSent: { $ne: true }
    }).populate('employeeId', 'firstName lastName email phone');

    for (const journey of activeJourneys) {
      // TODO: Send notification to employee
      console.log(`Reminder: ${journey.employeeId.firstName} ${journey.employeeId.lastName} should end journey`);
      
      // Mark reminder as sent
      journey.endJourneyReminderSent = true;
      await journey.save();
      
      // You can integrate with SMS, email, or push notifications here
    }

    console.log(`Sent end journey reminders to ${activeJourneys.length} employees`);
  } catch (error) {
    console.error('End journey reminder error:', error);
  }
};

// Low battery alert
exports.sendLowBatteryAlerts = async () => {
  try {
    const todayStart = moment.tz('Asia/Kolkata').startOf('day').toDate();
    const todayEnd = moment.tz('Asia/Kolkata').endOf('day').toDate();

    const activeJourneys = await Journey.find({
      date: { $gte: todayStart, $lte: todayEnd },
      status: 'ACTIVE',
      lowBatteryAlertSent: { $ne: true }
    }).populate('employeeId', 'firstName lastName email phone');

    for (const journey of activeJourneys) {
      if (journey.batteryLevels.length > 0) {
        const latestBattery = journey.batteryLevels[journey.batteryLevels.length - 1];
        
        if (latestBattery.level < 20) {
          // TODO: Send alert to manager
          console.log(`Alert: ${journey.employeeId.firstName}'s battery is at ${latestBattery.level}%`);
          
          journey.lowBatteryAlertSent = true;
          await journey.save();
        }
      }
    }
  } catch (error) {
    console.error('Low battery alert error:', error);
  }
};

module.exports = {
  sendJourneyStartReminders,
  sendEndJourneyReminders,
  sendLowBatteryAlerts
};
