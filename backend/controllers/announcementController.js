const Announcement = require('../models/Announcement');
const User = require('../models/User');
const { sendAnnouncementNotification } = require('../utils/emailService');
const logger = require('../utils/logger');

const getAnnouncements = async (req, res) => {
  try {
    const now = new Date();
    const isPrivileged = ['ADMIN', 'HR', 'MANAGER'].includes(req.user?.role);
    const limit = parseInt(req.query.limit) || 10;

    const query = isPrivileged
      ? { isActive: true }
      : {
          isActive: true,
          $and: [
            {
              $or: [
                { expiryDate: { $exists: false } },
                { expiryDate: null },
                { expiryDate: { $gte: now } }
              ]
            },
            {
              $or: [
                { targetRoles: { $size: 0 } },
                { targetRoles: req.user.role }
              ]
            }
          ]
        };

    const announcements = await Announcement.find(query)
      .populate('createdBy', 'firstName lastName')
      .sort({ priority: -1, createdAt: -1 })
      .limit(limit)
      .lean();

    res.json(announcements);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const createAnnouncement = async (req, res) => {
  try {
    const announcement = new Announcement({
      ...req.body,
      createdBy: req.user.id
    });

    await announcement.save();
    await announcement.populate('createdBy', 'firstName lastName');

    res.status(201).json(announcement);

    // Send email after response — fully wrapped so errors don't crash
    (async () => {
      try {
        const creator = await User.findById(req.user.id);
        const creatorName = `${creator.firstName} ${creator.lastName}`;
        logger.info('Sending announcement emails', { title: announcement.title, creator: creatorName });
        await sendAnnouncementNotification(announcement, creatorName);
        logger.info('Announcement emails sent successfully');
      } catch (err) {
        logger.error('Announcement email failed', { error: err.message });
      }
    })();

  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

const updateAnnouncement = async (req, res) => {
  try {
    const announcement = await Announcement.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    ).populate('createdBy', 'firstName lastName');

    res.json(announcement);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

const deleteAnnouncement = async (req, res) => {
  try {
    await Announcement.findByIdAndUpdate(req.params.id, { isActive: false });
    res.json({ message: 'Announcement deleted' });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

module.exports = {
  getAnnouncements,
  createAnnouncement,
  updateAnnouncement,
  deleteAnnouncement
};
