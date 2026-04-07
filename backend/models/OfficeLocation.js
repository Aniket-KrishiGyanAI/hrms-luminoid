const mongoose = require('mongoose');

const officeLocationSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  latitude: { type: Number, required: true },
  longitude: { type: Number, required: true },
  radiusMeters: { type: Number, required: true, default: 100 },
  startTime: { type: Number, required: true }, // hour in 24h, e.g. 9 = 9 AM
  startMinute: { type: Number, default: 0 }, // minute, e.g. 30 = 9:30 AM
  endTime: { type: Number, required: true },   // hour in 24h, e.g. 18 = 6 PM
  endMinute: { type: Number, default: 0 }, // minute, e.g. 30 = 6:30 PM
  compensationMinutes: { type: Number, default: 0 }, // grace period in minutes, e.g. 30 = 30 min late allowed
  autoCheckoutTime: { hour: { type: Number }, minute: { type: Number } },
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

module.exports = mongoose.model('OfficeLocation', officeLocationSchema);
