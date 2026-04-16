const Notification = require('../models/Notification');
const logger = require('../utils/logger');

exports.getNotifications = async (req, res) => {
  try {
    logger.info('getNotifications', { userId: req.user?.id });
    const notifications = await Notification.find({ user: req.user.id })
      .populate('task', 'title')
      .populate('actionBy', 'firstName lastName')
      .sort('-createdAt')
      .limit(50);
    res.json(notifications);
  } catch (error) {
    logger.error('getNotifications error', { error: error.message, stack: error.stack, userId: req.user?.id });

    res.status(500).json({ message: error.message });
  }
};

exports.getUnreadCount = async (req, res) => {
  try {
    logger.info('getUnreadCount', { userId: req.user?.id });
    const count = await Notification.countDocuments({ user: req.user.id, read: false });
    res.json({ count });
  } catch (error) {
    logger.error('getUnreadCount error', { error: error.message, stack: error.stack, userId: req.user?.id });

    res.status(500).json({ message: error.message });
  }
};

exports.markAsRead = async (req, res) => {
  try {
    logger.info('markAsRead', { userId: req.user?.id });
    await Notification.findByIdAndUpdate(req.params.id, { read: true });
    res.json({ message: 'Marked as read' });
  } catch (error) {
    logger.error('markAsRead error', { error: error.message, stack: error.stack, userId: req.user?.id });

    res.status(500).json({ message: error.message });
  }
};

exports.markAllAsRead = async (req, res) => {
  try {
    logger.info('markAllAsRead', { userId: req.user?.id });
    await Notification.updateMany({ user: req.user.id, read: false }, { read: true });
    res.json({ message: 'All marked as read' });
  } catch (error) {
    logger.error('markAllAsRead error', { error: error.message, stack: error.stack, userId: req.user?.id });

    res.status(500).json({ message: error.message });
  }
};

exports.deleteNotification = async (req, res) => {
  try {
    logger.info('deleteNotification', { userId: req.user?.id });
    const notification = await Notification.findById(req.params.id);
    
    if (!notification) {
      return res.status(404).json({ message: 'Notification not found' });
    }
    
    if (notification.user.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized to delete this notification' });
    }
    
    await Notification.findByIdAndDelete(req.params.id);
    res.json({ message: 'Notification deleted successfully' });
  } catch (error) {
    logger.error('deleteNotification error', { error: error.message, stack: error.stack, userId: req.user?.id });

    res.status(500).json({ message: error.message });
  }
};

exports.createNotification = async (userId, type, taskId, message, actionBy, metadata = {}) => {
  try {
    await Notification.create({
      user: userId,
      type,
      task: taskId,
      message,
      actionBy,
      metadata
    });
  } catch (error) {
    console.error('Error creating notification:', error);
  }
};
