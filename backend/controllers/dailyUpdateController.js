const DailyUpdate = require('../models/DailyUpdate');
const User = require('../models/User');
const logger = require('../utils/logger');

// Get all daily updates (company news)
exports.getDailyUpdates = async (req, res) => {
  try {
    logger.info('getDailyUpdates', { userId: req.user?.id });

    const updates = await DailyUpdate.find({})
      .populate('userId', 'firstName lastName role department')
      .sort({ isPinned: -1, createdAt: -1 })
      .limit(50);

    res.json(updates);
  } catch (error) {
    logger.error('getDailyUpdates error', { error: error.message, stack: error.stack, userId: req.user?.id });
    console.error('Error fetching daily updates:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Create a new daily update (company news)
exports.createDailyUpdate = async (req, res) => {
  try {
    logger.info('createDailyUpdate', { userId: req.user?.id });
    const { title, message, content, category, priority, tags } = req.body;

    const newsContent = message || content;

    if (!newsContent || newsContent.trim().length === 0) {
      return res.status(400).json({ message: 'Content is required' });
    }

    const update = new DailyUpdate({
      userId: req.user.id,
      title: title || '',
      content: newsContent.trim(),
      category: category || 'general',
      priority: priority || 'low',
      tags: tags || [],
      visibility: 'PUBLIC'
    });

    await update.save();
    await update.populate('userId', 'firstName lastName role department');

    res.status(201).json(update);
  } catch (error) {
    logger.error('createDailyUpdate error', { error: error.message, stack: error.stack, userId: req.user?.id });
    console.error('Error creating daily update:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Like/Unlike an update
exports.toggleLike = async (req, res) => {
  try {
    logger.info('toggleLike', { userId: req.user?.id });
    const { id } = req.params;
    const update = await DailyUpdate.findById(id);

    if (!update) {
      return res.status(404).json({ message: 'Update not found' });
    }

    const likeIndex = update.likes.indexOf(req.user.id);

    if (likeIndex > -1) {
      update.likes.splice(likeIndex, 1);
    } else {
      update.likes.push(req.user.id);
    }

    await update.save();
    await update.populate('userId', 'firstName lastName role department');

    res.json(update);
  } catch (error) {
    logger.error('toggleLike error', { error: error.message, stack: error.stack, userId: req.user?.id });
    console.error('Error toggling like:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Add a comment to an update
exports.addComment = async (req, res) => {
  try {
    logger.info('addComment', { userId: req.user?.id });
    const { id } = req.params;
    const { comment } = req.body;

    if (!comment || comment.trim().length === 0) {
      return res.status(400).json({ message: 'Comment is required' });
    }

    const update = await DailyUpdate.findById(id);

    if (!update) {
      return res.status(404).json({ message: 'Update not found' });
    }

    update.comments.push({
      userId: req.user.id,
      text: comment.trim()
    });

    await update.save();
    await update.populate('userId', 'firstName lastName role department');
    await update.populate('comments.userId', 'firstName lastName');

    res.json(update);
  } catch (error) {
    logger.error('addComment error', { error: error.message, stack: error.stack, userId: req.user?.id });
    console.error('Error adding comment:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Update an update
exports.updateDailyUpdate = async (req, res) => {
  try {
    logger.info('updateDailyUpdate', { userId: req.user?.id });
    const { id } = req.params;
    const { title, content, category, priority, tags } = req.body;

    if (!content || content.trim().length === 0) {
      return res.status(400).json({ message: 'Content is required' });
    }

    const update = await DailyUpdate.findById(id);

    if (!update) {
      return res.status(404).json({ message: 'Update not found' });
    }

    if (update.userId.toString() !== req.user.id && !['ADMIN', 'HR'].includes(req.user.role)) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    update.title = title || update.title;
    update.content = content.trim();
    update.category = category || update.category;
    update.priority = priority || update.priority;
    update.tags = tags || update.tags;

    await update.save();
    await update.populate('userId', 'firstName lastName role department');
    await update.populate('comments.userId', 'firstName lastName');

    res.json(update);
  } catch (error) {
    logger.error('updateDailyUpdate error', { error: error.message, stack: error.stack, userId: req.user?.id });
    console.error('Error updating daily update:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Delete an update
exports.deleteUpdate = async (req, res) => {
  try {
    logger.info('deleteUpdate', { userId: req.user?.id });
    const { id } = req.params;
    const update = await DailyUpdate.findById(id);

    if (!update) {
      return res.status(404).json({ message: 'Update not found' });
    }

    // Check if user is the owner or admin
    if (update.userId.toString() !== req.user.id && !['ADMIN', 'HR'].includes(req.user.role)) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    await update.deleteOne();
    res.json({ message: 'Update deleted successfully' });
  } catch (error) {
    logger.error('deleteUpdate error', { error: error.message, stack: error.stack, userId: req.user?.id });
    console.error('Error deleting update:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Pin/Unpin an update (Admin only)
exports.togglePin = async (req, res) => {
  try {
    logger.info('togglePin', { userId: req.user?.id });
    if (!['ADMIN', 'HR'].includes(req.user.role)) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    const { id } = req.params;
    const update = await DailyUpdate.findById(id);

    if (!update) {
      return res.status(404).json({ message: 'Update not found' });
    }

    update.isPinned = !update.isPinned;
    await update.save();

    res.json(update);
  } catch (error) {
    logger.error('togglePin error', { error: error.message, stack: error.stack, userId: req.user?.id });
    console.error('Error toggling pin:', error);
    res.status(500).json({ message: 'Server error' });
  }
};
