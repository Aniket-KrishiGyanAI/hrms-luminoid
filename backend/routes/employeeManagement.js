const express = require('express');
const { body } = require('express-validator');
const { 
  createEmployee, 
  deactivateEmployee, 
  reactivateEmployee,
  getAllEmployees,
  deleteEmployee
} = require('../controllers/employeeManagementController');
const { auth, authorize } = require('../middleware/auth');

const router = express.Router();

// Create employee (HR/ADMIN only)
router.post('/create', auth, authorize('ADMIN', 'HR'), [
  body('email').isEmail().normalizeEmail(),
  body('firstName').trim().notEmpty(),
  body('lastName').trim().notEmpty(),
  body('role').optional().isIn(['ADMIN', 'HR', 'MANAGER', 'EMPLOYEE'])
], createEmployee);

// Get all employees with filters
router.get('/all', auth, getAllEmployees);

// Deactivate employee (ADMIN/HR only)
router.put('/:userId/deactivate', auth, authorize('ADMIN', 'HR'), deactivateEmployee);

// Reactivate employee (ADMIN/HR only)
router.put('/:userId/reactivate', auth, authorize('ADMIN', 'HR'), reactivateEmployee);

// Delete employee permanently (ADMIN only)
router.delete('/:userId', auth, authorize('ADMIN'), deleteEmployee);

module.exports = router;
