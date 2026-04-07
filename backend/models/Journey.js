const mongoose = require('mongoose');

const journeySchema = new mongoose.Schema({
  employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  date: { type: Date, required: true },
  startTime: { type: Date, required: true },
  endTime: { type: Date },
  status: { type: String, enum: ['ACTIVE', 'PAUSED', 'COMPLETED', 'AUTO_ENDED'], default: 'ACTIVE' },
  totalDistanceKm: { type: Number, default: 0 },
  
  // Pause/Resume tracking
  pausedAt: { type: Date },
  resumedAt: { type: Date },
  totalPausedMinutes: { type: Number, default: 0 },
  pauseHistory: [{
    pausedAt: { type: Date },
    resumedAt: { type: Date },
    reason: { type: String }
  }],
  
  // Speed & Movement Analytics
  maxSpeedKmh: { type: Number, default: 0 },
  avgSpeedKmh: { type: Number, default: 0 },
  totalIdleMinutes: { type: Number, default: 0 },
  movingTimeMinutes: { type: Number, default: 0 },
  
  // Battery & Network
  batteryLevels: [{
    level: { type: Number },
    timestamp: { type: Date }
  }],
  lowBatteryAlertSent: { type: Boolean, default: false },
  
  // Reminders
  endJourneyReminderSent: { type: Boolean, default: false },
  
  locationPoints: [{
    lat: { type: Number, required: true },
    lng: { type: Number, required: true },
    timestamp: { type: Date, default: Date.now },
    accuracy: { type: Number },
    distanceFromLast: { type: Number, default: 0 },
    speedKmh: { type: Number, default: 0 },
    batteryLevel: { type: Number }
  }]
}, { timestamps: true });

journeySchema.index({ employeeId: 1, date: -1 });
journeySchema.index({ status: 1 });

module.exports = mongoose.model('Journey', journeySchema);
