const OfficeLocation = require('../models/OfficeLocation');

const getOfficeLocations = async (req, res) => {
  try {
    const filter = req.user.role === 'ADMIN' || req.user.role === 'HR'
      ? {}
      : { isActive: true };
    const locations = await OfficeLocation.find(filter).sort({ name: 1 });
    res.json(locations);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const createOfficeLocation = async (req, res) => {
  try {
    const { name, address, latitude, longitude, radiusMeters, startTime, startMinute, endTime, endMinute, compensationMinutes, autoCheckoutTime, isActive } = req.body;
    if (!name || latitude == null || longitude == null || startTime == null || endTime == null) {
      return res.status(400).json({ message: 'name, latitude, longitude, startTime and endTime are required' });
    }
    const location = await OfficeLocation.create({
      name,
      address: address || '',
      latitude,
      longitude,
      radiusMeters: radiusMeters || 100,
      startTime,
      startMinute: startMinute || 0,
      endTime,
      endMinute: endMinute || 0,
      autoCheckoutTime: autoCheckoutTime || undefined,
      compensationMinutes: compensationMinutes || 0,
      isActive: isActive !== undefined ? isActive : true
    });
    res.status(201).json(location);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const updateOfficeLocation = async (req, res) => {
  try {
    const location = await OfficeLocation.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!location) return res.status(404).json({ message: 'Office location not found' });
    res.json(location);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const deleteOfficeLocation = async (req, res) => {
  try {
    const location = await OfficeLocation.findByIdAndDelete(req.params.id);
    if (!location) return res.status(404).json({ message: 'Office location not found' });
    res.json({ message: 'Office location deleted' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = { getOfficeLocations, createOfficeLocation, updateOfficeLocation, deleteOfficeLocation };
