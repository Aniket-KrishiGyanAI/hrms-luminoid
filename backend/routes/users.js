const express = require('express');
const { body } = require('express-validator');
const { updateRole, updateUser, changePassword, resetPassword, getUserById, clearRoleNotification } = require('../controllers/userController');
const { auth, authorize } = require('../middleware/auth');

const router = express.Router();

// Get user by ID
router.get('/:userId', auth, getUserById);

// Clear role change notification
router.post('/:userId/clear-notification', auth, clearRoleNotification);

// Only ADMIN can change roles
router.put('/:userId/role', auth, authorize('ADMIN'), [
  body('role').isIn(['ADMIN','HR','MANAGER','EMPLOYEE'])
], updateRole);

// Update basic user fields (admin only)
router.put('/:userId', auth, authorize('ADMIN'), [
  body('email').optional().isEmail(),
  body('firstName').optional().trim().notEmpty(),
  body('lastName').optional().trim().notEmpty(),
  body('department').optional().isString(),
  body('designation').optional().isString(),
  body('joinDate').optional(),
  body('dateOfBirth').optional()
], updateUser);

// Change password (user can change their own password)
router.put('/:userId/change-password', auth, [
  body('currentPassword').notEmpty(),
  body('newPassword').isLength({ min: 6 })
], changePassword);

// Reset password (admin only - no current password required)
router.put('/:userId/reset-password', auth, authorize('ADMIN'), [
  body('newPassword').isLength({ min: 6 })
], resetPassword);

// Delete user (admin only)
router.delete('/:userId', auth, authorize('ADMIN'), async (req, res, next) => {
  // delegate to controller
  try {
    const { deleteUser } = require('../controllers/userController');
    return deleteUser(req, res, next);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
