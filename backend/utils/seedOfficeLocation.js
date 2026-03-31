const OfficeLocation = require('../models/OfficeLocation');

const seedDefaultOffice = async () => {
  try {
    const count = await OfficeLocation.countDocuments();
    if (count > 0) return; // already seeded

    const lat = Number(process.env.OFFICE_LAT);
    const lng = Number(process.env.OFFICE_LNG);
    const radius = Number(process.env.ALLOWED_RADIUS_METERS || 100);

    if (!lat || !lng) return; // no env vars set

    await OfficeLocation.create({
      name: 'Pune Office',
      latitude: lat,
      longitude: lng,
      radiusMeters: radius,
      startTime: 10,  // 10 AM (matches existing OFFICE_START_TIME in attendanceConfig)
      endTime: 18,    // 6 PM
      autoCheckoutTime: { hour: 18, minute: 0 },
      isActive: true,
    });

    console.log('✅ Default office location seeded from .env');
  } catch (err) {
    console.error('Failed to seed default office location:', err.message);
  }
};

module.exports = seedDefaultOffice;
