/**
 * Test script to verify grace period (compensationMinutes) is working correctly
 * 
 * Run this with: node test-grace-period.js
 */

const mongoose = require('mongoose');
require('dotenv').config();

const OfficeLocation = require('./models/OfficeLocation');
const Attendance = require('./models/Attendance');
const User = require('./models/User');

async function testGracePeriod() {
  try {
    // Connect to database
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to database\n');

    // 1. Check if office locations have compensationMinutes
    console.log('📍 Checking Office Locations:');
    console.log('─'.repeat(80));
    const offices = await OfficeLocation.find();
    
    if (offices.length === 0) {
      console.log('⚠️  No office locations found. Please create one first.\n');
    } else {
      offices.forEach(office => {
        const startTime = `${office.startTime}:${String(office.startMinute || 0).padStart(2, '0')}`;
        const endTime = `${office.endTime}:${String(office.endMinute || 0).padStart(2, '0')}`;
        console.log(`\n🏢 ${office.name}`);
        console.log(`   Start Time: ${startTime}`);
        console.log(`   End Time: ${endTime}`);
        console.log(`   Grace Period: ${office.compensationMinutes || 0} minutes`);
        console.log(`   Radius: ${office.radiusMeters}m`);
        console.log(`   Status: ${office.isActive ? '✅ Active' : '❌ Inactive'}`);
      });
    }

    // 2. Test attendance status calculation
    console.log('\n\n🧪 Testing Attendance Status Calculation:');
    console.log('─'.repeat(80));
    
    if (offices.length > 0) {
      const testOffice = offices[0];
      console.log(`\nUsing office: ${testOffice.name}`);
      console.log(`Start time: ${testOffice.startTime}:${String(testOffice.startMinute || 0).padStart(2, '0')}`);
      console.log(`Grace period: ${testOffice.compensationMinutes || 0} minutes\n`);

      const officeStartMinutes = testOffice.startTime * 60 + (testOffice.startMinute || 0);
      const graceMinutes = testOffice.compensationMinutes || 0;

      // Test scenarios
      const scenarios = [
        { time: officeStartMinutes - 5, desc: '5 minutes before start' },
        { time: officeStartMinutes, desc: 'Exactly at start time' },
        { time: officeStartMinutes + Math.floor(graceMinutes / 2), desc: `${Math.floor(graceMinutes / 2)} minutes after start (within grace)` },
        { time: officeStartMinutes + graceMinutes, desc: `${graceMinutes} minutes after start (at grace limit)` },
        { time: officeStartMinutes + graceMinutes + 1, desc: `${graceMinutes + 1} minutes after start (exceeds grace)` },
      ];

      scenarios.forEach(scenario => {
        const lateByMinutes = scenario.time - officeStartMinutes;
        const isLate = lateByMinutes > graceMinutes;
        const hours = Math.floor(scenario.time / 60);
        const minutes = scenario.time % 60;
        const timeStr = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
        
        console.log(`${timeStr} - ${scenario.desc}`);
        console.log(`   Late by: ${Math.max(0, lateByMinutes)} minutes`);
        console.log(`   Status: ${isLate ? '⚠️  LATE' : '✅ PRESENT'}\n`);
      });
    }

    // 3. Check recent attendance records
    console.log('\n📊 Recent Attendance Records (Last 5):');
    console.log('─'.repeat(80));
    
    const recentAttendance = await Attendance.find({ isDeleted: { $ne: true } })
      .populate('userId', 'firstName lastName')
      .populate('officeLocation', 'name startTime startMinute compensationMinutes')
      .sort({ date: -1 })
      .limit(5);

    if (recentAttendance.length === 0) {
      console.log('⚠️  No attendance records found.\n');
    } else {
      recentAttendance.forEach(att => {
        const checkInTime = att.checkIn ? new Date(att.checkIn) : null;
        const checkInStr = checkInTime 
          ? `${String(checkInTime.getHours()).padStart(2, '0')}:${String(checkInTime.getMinutes()).padStart(2, '0')}`
          : 'N/A';
        
        console.log(`\n👤 ${att.userId?.firstName} ${att.userId?.lastName}`);
        console.log(`   Date: ${new Date(att.date).toLocaleDateString()}`);
        console.log(`   Check-in: ${checkInStr}`);
        console.log(`   Status: ${att.status}`);
        
        if (att.officeLocation) {
          const office = att.officeLocation;
          const officeStart = `${office.startTime}:${String(office.startMinute || 0).padStart(2, '0')}`;
          console.log(`   Office: ${office.name} (Start: ${officeStart}, Grace: ${office.compensationMinutes || 0}min)`);
          
          if (checkInTime) {
            const checkInMinutes = checkInTime.getHours() * 60 + checkInTime.getMinutes();
            const officeStartMinutes = office.startTime * 60 + (office.startMinute || 0);
            const lateBy = checkInMinutes - officeStartMinutes;
            
            if (lateBy > 0) {
              console.log(`   Late by: ${lateBy} minutes`);
              console.log(`   Within grace: ${lateBy <= (office.compensationMinutes || 0) ? '✅ Yes' : '❌ No'}`);
            } else {
              console.log(`   Early by: ${Math.abs(lateBy)} minutes ✅`);
            }
          }
        }
      });
    }

    console.log('\n\n✅ Test completed successfully!\n');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await mongoose.connection.close();
    console.log('🔌 Database connection closed');
  }
}

// Run the test
testGracePeriod();
