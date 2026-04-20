const { withTransaction, executeAtomic } = require('../utils/transaction');
const LeaveRequest = require('../models/LeaveRequest');
const LeaveBalance = require('../models/LeaveBalance');
const User = require('../models/User');
const Notification = require('../models/Notification');
const logger = require('../utils/logger');

/**
 * Example: Apply for leave with transaction
 */
exports.applyLeaveWithTransaction = async (req, res) => {
  try {
    logger.info('applyLeaveWithTransaction', { userId: req.user?.id });
    const { leaveTypeId, startDate, endDate, days, reason } = req.body;
    const userId = req.user.id;

    const result = await withTransaction(async (session) => {
      const balance = await LeaveBalance.findOne({ userId, leaveTypeId }).session(session);
      if (!balance || balance.available < days) {
        throw new Error('Insufficient leave balance');
      }

      const leaveRequest = await LeaveRequest.create([{
        userId, leaveTypeId, startDate, endDate, days, reason, status: 'PENDING'
      }], { session });

      await LeaveBalance.findByIdAndUpdate(balance._id, {
        $inc: { available: -days, pending: days }
      }, { session });

      return leaveRequest[0];
    });

    res.status(201).json({ success: true, data: result });
  } catch (error) {
    logger.error('applyLeaveWithTransaction error', { error: error.message, stack: error.stack, userId: req.user?.id });

    res.status(400).json({ success: false, message: error.message });
  }
};
