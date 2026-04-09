/**
 * Migration Script: Update Existing Attendance Records
 * 
 * This script updates all existing attendance records to:
 * 1. Add overtimeHours field
 * 2. Add arrivedLate and lateByMinutes fields
 * 3. Recalculate status based on new logic (8+ hours = Present)
 * 4. Apply break time to records that don't have it
 * 
 * Run this ONCE after deploying the attendance fixes
 */

const mongoose = require('mongoose');
const Attendance = require('./models/Attendance');
const OfficeLocation = require('./models/OfficeLocation');
const attendanceConfig = require('./config/attendanceConfig');
require('dotenv').config();

const {
  FULL_DAY_HOURS,
  HALF_DAY_HOURS,
  LOP_THRESHOLD,
  LATE_GRACE_MINUTES,
  OFFICE_START_TIME,
  DEFAULT_BREAK_MINUTES,
  OVERTIME_THRESHOLD,
  OVERTIME_ENABLED
} = attendanceConfig;

async function migrateAttendanceRecords() {
  try {
    console.log('🔄 Starting attendance records migration...\n');

    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/hrms', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('✅ Connected to MongoDB\n');

    // Get all attendance records that have both check-in and check-out
    const records = await Attendance.find({
      checkIn: { $exists: true },
      checkOut: { $exists: true },
      isDeleted: { $ne: true }
    }).populate('officeLocation');

    console.log(`📊 Found ${records.length} attendance records to migrate\n`);

    let updatedCount = 0;
    let statusChangedCount = 0;
    let overtimeAddedCount = 0;

    for (const record of records) {
      let needsUpdate = false;
      const oldStatus = record.status;

      // Get office-specific settings
      let officeStartHour = OFFICE_START_TIME;
      let officeStartMinute = 0;
      let graceMinutes = LATE_GRACE_MINUTES;

      if (record.officeLocation) {
        officeStartHour = record.officeLocation.startTime;
        officeStartMinute = record.officeLocation.startMinute || 0;
        graceMinutes = record.officeLocation.compensationMinutes || 0;
      }

      const officeStartTotalMinutes = officeStartHour * 60 + officeStartMinute;

      // Calculate if employee arrived late
      const checkInTime = new Date(record.checkIn);
      const checkInTotalMinutes = checkInTime.getHours() * 60 + checkInTime.getMinutes();
      const lateByMinutes = Math.max(0, checkInTotalMinutes - officeStartTotalMinutes);
      const arrivedLate = lateByMinutes > graceMinutes;

      // Update arrivedLate fields if not set
      if (record.arrivedLate === undefined || record.lateByMinutes === undefined) {
        record.arrivedLate = arrivedLate;
        record.lateByMinutes = lateByMinutes;
        needsUpdate = true;
      }

      // Recalculate total hours with break time if not applied
      if (record.breakTime === 0 && !record.isManualEntry) {
        const diffMs = record.checkOut - record.checkIn;
        let totalMinutes = diffMs / (1000 * 60);
        totalMinutes -= DEFAULT_BREAK_MINUTES;
        record.totalHours = Math.max(0, Math.round((totalMinutes / 60) * 100) / 100);
        record.breakTime = DEFAULT_BREAK_MINUTES;
        needsUpdate = true;
      }

      // Calculate overtime if not set
      if (OVERTIME_ENABLED && record.totalHours > OVERTIME_THRESHOLD) {
        const overtime = Math.round((record.totalHours - OVERTIME_THRESHOLD) * 100) / 100;
        if (record.overtimeHours !== overtime) {
          record.overtimeHours = overtime;
          overtimeAddedCount++;
          needsUpdate = true;
        }
      }

      // Recalculate status based on new logic (if not manual entry)
      if (!record.isManualEntry) {
        let newStatus;

        if (record.totalHours < LOP_THRESHOLD) {
          newStatus = "LOP";
        } else if (record.totalHours < HALF_DAY_HOURS) {
          newStatus = "Half Day";
        } else if (record.totalHours >= FULL_DAY_HOURS) {
          // NEW LOGIC: 8+ hours = Present (regardless of arrival time)
          newStatus = "Present";
        } else {
          // Between 4-8 hours: Late only if arrived late
          newStatus = arrivedLate ? "Late" : "Half Day";
        }

        if (record.status !== newStatus) {
          console.log(`  📝 Updating record for ${record.userId}:`);
          console.log(`     Date: ${record.date.toISOString().split('T')[0]}`);
          console.log(`     Status: ${oldStatus} → ${newStatus}`);
          console.log(`     Hours: ${record.totalHours}h, Arrived Late: ${arrivedLate}, Late By: ${lateByMinutes}min`);
          if (record.overtimeHours > 0) {
            console.log(`     Overtime: ${record.overtimeHours}h`);
          }
          console.log('');
          
          record.status = newStatus;
          statusChangedCount++;
          needsUpdate = true;
        }
      }

      // Save if any changes were made
      if (needsUpdate) {
        await record.save();
        updatedCount++;
      }
    }

    console.log('\n✅ Migration completed successfully!\n');
    console.log('📊 Summary:');
    console.log(`   - Total records processed: ${records.length}`);
    console.log(`   - Records updated: ${updatedCount}`);
    console.log(`   - Status changes: ${statusChangedCount}`);
    console.log(`   - Overtime hours added: ${overtimeAddedCount}`);
    console.log('');

    if (statusChangedCount > 0) {
      console.log('⚠️  Note: Some attendance statuses were changed based on new logic:');
      console.log('   - Employees who worked 8+ hours are now marked as "Present"');
      console.log('   - Late arrival is tracked separately in "arrivedLate" field');
      console.log('   - This ensures fair treatment for employees who compensate late arrival\n');
    }

    await mongoose.connection.close();
    console.log('✅ Database connection closed\n');

  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

// Run migration
if (require.main === module) {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║     Attendance Records Migration Script                   ║');
  console.log('║     Version: 2.0                                           ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');
  
  console.log('⚠️  WARNING: This will update existing attendance records!');
  console.log('   Make sure you have a database backup before proceeding.\n');
  
  // Auto-run after 3 seconds (remove this in production, add manual confirmation)
  setTimeout(() => {
    migrateAttendanceRecords();
  }, 3000);
}

module.exports = migrateAttendanceRecords;
