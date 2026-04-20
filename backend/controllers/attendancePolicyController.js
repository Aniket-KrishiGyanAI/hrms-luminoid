const AttendancePolicy = require('../models/AttendancePolicy');
const logger = require('../utils/logger');

// Get current attendance policy
exports.getPolicy = async (req, res) => {
  try {
    logger.info('getPolicy', { userId: req.user?.id });
    let policy = await AttendancePolicy.findOne().populate('lastUpdatedBy', 'firstName lastName');
    
    // If no policy exists, create default one
    if (!policy) {
      policy = await AttendancePolicy.create({});
    }
    
    res.json(policy);
  } catch (error) {
    logger.error('getPolicy error', { error: error.message, stack: error.stack, userId: req.user?.id });

    console.error('Error fetching attendance policy:', error);
    res.status(500).json({ message: 'Error fetching attendance policy' });
  }
};

// Update attendance policy (Admin/HR only)
exports.updatePolicy = async (req, res) => {
  try {
    logger.info('updatePolicy', { userId: req.user?.id });
    const { workingHours, lateArrival, checkInRequirements, importantNotes, helpContact } = req.body;
    
    let policy = await AttendancePolicy.findOne();
    
    if (!policy) {
      policy = new AttendancePolicy();
    }
    
    // Update fields
    if (workingHours) policy.workingHours = { ...policy.workingHours, ...workingHours };
    if (lateArrival) policy.lateArrival = { ...policy.lateArrival, ...lateArrival };
    if (checkInRequirements) policy.checkInRequirements = { ...policy.checkInRequirements, ...checkInRequirements };
    if (importantNotes) policy.importantNotes = { ...policy.importantNotes, ...importantNotes };
    if (helpContact) policy.helpContact = { ...policy.helpContact, ...helpContact };
    
    policy.lastUpdatedBy = req.user.id;
    policy.lastUpdatedAt = new Date();
    
    await policy.save();
    
    res.json({ message: 'Attendance policy updated successfully', policy });
  } catch (error) {
    logger.error('updatePolicy error', { error: error.message, stack: error.stack, userId: req.user?.id });

    console.error('Error updating attendance policy:', error);
    res.status(500).json({ message: 'Error updating attendance policy' });
  }
};

// Reset to default policy (Admin only)
exports.resetPolicy = async (req, res) => {
  try {
    logger.info('resetPolicy', { userId: req.user?.id });
    await AttendancePolicy.deleteMany({});
    const policy = await AttendancePolicy.create({ lastUpdatedBy: req.user.id });
    
    res.json({ message: 'Attendance policy reset to defaults', policy });
  } catch (error) {
    logger.error('resetPolicy error', { error: error.message, stack: error.stack, userId: req.user?.id });

    console.error('Error resetting attendance policy:', error);
    res.status(500).json({ message: 'Error resetting attendance policy' });
  }
};
