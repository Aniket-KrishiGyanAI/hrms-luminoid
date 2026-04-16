const User = require('../models/User');
const logger = require('../utils/logger');

// Grant location consent
exports.grantConsent = async (req, res) => {
  try {
    logger.info('grantConsent', { userId: req.user?.id });
    const userId = req.user.id;
    const ipAddress = req.ip || req.connection.remoteAddress;
    const userAgent = req.headers['user-agent'];

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    user.locationConsent = {
      granted: true,
      grantedAt: new Date(),
      revokedAt: null,
      ipAddress,
      userAgent
    };

    await user.save();

    res.json({ 
      message: 'Location consent granted successfully',
      consent: user.locationConsent 
    });
  } catch (error) {
    logger.error('grantConsent error', { error: error.message, stack: error.stack, userId: req.user?.id });

    res.status(500).json({ message: error.message });
  }
};

// Revoke location consent
exports.revokeConsent = async (req, res) => {
  try {
    logger.info('revokeConsent', { userId: req.user?.id });
    const userId = req.user.id;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    user.locationConsent = {
      ...user.locationConsent,
      granted: false,
      revokedAt: new Date()
    };

    await user.save();

    res.json({ 
      message: 'Location consent revoked successfully',
      consent: user.locationConsent 
    });
  } catch (error) {
    logger.error('revokeConsent error', { error: error.message, stack: error.stack, userId: req.user?.id });

    res.status(500).json({ message: error.message });
  }
};

// Get consent status
exports.getConsentStatus = async (req, res) => {
  try {
    logger.info('getConsentStatus', { userId: req.user?.id });
    const userId = req.user.id;

    const user = await User.findById(userId).select('locationConsent isFieldEmployee');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({ 
      isFieldEmployee: user.isFieldEmployee,
      consent: user.locationConsent || { granted: false }
    });
  } catch (error) {
    logger.error('getConsentStatus error', { error: error.message, stack: error.stack, userId: req.user?.id });

    res.status(500).json({ message: error.message });
  }
};

// Middleware to check consent before location operations
exports.requireLocationConsent = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const user = await User.findById(userId).select('locationConsent isFieldEmployee');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Only field employees need consent
    if (!user.isFieldEmployee) {
      return next();
    }

    // Check if consent is granted
    if (!user.locationConsent?.granted) {
      return res.status(403).json({ 
        message: 'Location consent required',
        requiresConsent: true 
      });
    }

    next();
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
