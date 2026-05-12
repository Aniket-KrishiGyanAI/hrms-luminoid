const express = require('express');
const { body } = require('express-validator');
const {
  applyLeave,
  getLeaveRequests,
  getPendingApprovals,
  approveReject,
  cancelLeave,
  getTeamCalendar,
  testLeaveReminder,
  checkConflicts,
  getEmployeeDetails,
  deleteLeave,
  getEmployeeLeaveSummary
} = require('../controllers/leaveRequestController');
const { auth, authorize } = require('../middleware/auth');

const router = express.Router();

const leaveRequestValidation = [
  body('leaveTypeId').isMongoId(),
  body('startDate').isISO8601(),
  body('endDate').isISO8601(),
  body('reason').trim().notEmpty()
];

const approveRejectValidation = [
  body('action').isIn(['approve', 'reject']).withMessage('Action must be approve or reject'),
  body('comments').optional().trim()
];

router.post('/', auth, leaveRequestValidation, applyLeave);
router.get('/', auth, getLeaveRequests);
router.get('/employee-summary', auth, authorize('MANAGER', 'HR', 'ADMIN'), getEmployeeLeaveSummary);
router.get('/pending', auth, authorize('MANAGER', 'HR', 'ADMIN'), getPendingApprovals);
router.get('/team-calendar', auth, authorize('MANAGER', 'HR', 'ADMIN'), getTeamCalendar);
router.get('/employee/:employeeId', auth, authorize('MANAGER', 'HR', 'ADMIN'), getEmployeeDetails);
router.post('/check-conflicts', auth, checkConflicts);
router.put('/:id/approve-reject', auth, authorize('MANAGER', 'HR', 'ADMIN'), approveRejectValidation, approveReject);
router.put('/:id/cancel', auth, cancelLeave);
router.delete('/:id', auth, authorize('ADMIN'), deleteLeave);
router.post('/test-reminder/:requestId', auth, authorize('HR', 'ADMIN'), testLeaveReminder);

module.exports = router;