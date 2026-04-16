const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const Attendance = require('../models/Attendance');

async function fixMissingDurations() {
  try {
    
    const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;
    if (!mongoUri) {
      throw new Error('MONGODB_URI or MONGO_URI not found in environment variables');
    }
    await mongoose.connect(mongoUri);
    

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

    

    if (records.length === 0) {
      
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
        
        .split('T')[0]} - Duration: ${totalHours.toFixed(2)}h`);
        fixed++;
      } catch (error) {
        console.error(`❌ Error fixing record ${record._id}:`, error.message);
        errors++;
      }
    }

    
    
    
    
    
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

fixMissingDurations();
