const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth');
const consentController = require('../controllers/consentController');

// @route   POST /api/consent/location/grant
// @desc    Grant location tracking consent
// @access  Private
router.post('/location/grant', auth, consentController.grantConsent);

// @route   POST /api/consent/location/revoke
// @desc    Revoke location tracking consent
// @access  Private
router.post('/location/revoke', auth, consentController.revokeConsent);

// @route   GET /api/consent/location/status
// @desc    Get location consent status
// @access  Private
router.get('/location/status', auth, consentController.getConsentStatus);

module.exports = router;