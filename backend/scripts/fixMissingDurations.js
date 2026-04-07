const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const Attendance = require('../models/Attendance');

async function fixMissingDurations() {
  try {
    console.log('Connecting to MongoDB...');
    const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;
    if (!mongoUri) {
      throw new Error('MONGODB_URI or MONGO_URI not found in environment variables');
    }
    await mongoose.connect(mongoUri);
    console.log('Connected successfully\n');

    // Find records with both checkIn and checkOut but totalHours is 0 or null
    const records = await Attendance.find({
      checkIn: { $exists: true, $ne: null },
      checkOut: { $exists: true, $ne: null },
      $or: [
        { totalHours: 0 },
        { totalHours: null },
        { totalHours: { $exists: false } }
      ]
    });

    console.log(`Found ${records.length} records with missing duration\n`);

    if (records.length === 0) {
      console.log('✅ No records need fixing!');
      process.exit(0);
    }

    let fixed = 0;
    let errors = 0;

    for (const record of records) {
      try {
        // Calculate duration
        const diffMs = record.checkOut - record.checkIn;
        let totalMinutes = diffMs / (1000 * 60);
        
        // Subtract break time if exists
        if (record.breakTime > 0) {
          totalMinutes -= record.breakTime;
        }
        
        const totalHours = Math.round((totalMinutes / 60) * 100) / 100;

        // Update the record
        record.totalHours = totalHours;
        
        // Recalculate status based on hours
        if (totalHours < 4) {
          record.status = "LOP";
        } else if (totalHours < 8) {
          record.status = "Half Day";
        } else {
          // Keep existing status if it's Late or Present
          if (record.status !== "Late") {
            record.status = "Present";
          }
        }

        await record.save();
        
        console.log(`✅ Fixed: ${record.userId} on ${record.date.toISOString().split('T')[0]} - Duration: ${totalHours.toFixed(2)}h`);
        fixed++;
      } catch (error) {
        console.error(`❌ Error fixing record ${record._id}:`, error.message);
        errors++;
      }
    }

    console.log(`\n📊 Summary:`);
    console.log(`   Fixed: ${fixed}`);
    console.log(`   Errors: ${errors}`);
    console.log(`   Total: ${records.length}`);
    console.log('\n✅ Duration fix completed!');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

fixMissingDurations();
