const express = require('express');
const router = express.Router();
const { auth, authorize } = require('../middleware/auth');
const { getPolicy, updatePolicy, resetPolicy } = require('../controllers/attendancePolicyController');

// Get attendance policy (all authenticated users)
router.get('/', auth, getPolicy);

// Update attendance policy (HR/Admin only)
router.put('/', auth, authorize('HR', 'ADMIN'), updatePolicy);

// Reset to default policy (Admin only)
router.post('/reset', auth, authorize('ADMIN'), resetPolicy);

module.exports = router;
