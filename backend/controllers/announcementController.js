const Announcement = require('../models/Announcement');
const User = require('../models/User');
const { sendAnnouncementNotification } = require('../utils/emailService');

const getAnnouncements = async (req, res) => {
  try {
    const now = new Date();
    const query = {
      isActive: true,
      $or: [
        { expiryDate: { $exists: false } },
        { expiryDate: null },
        { expiryDate: { $gte: now } }
      ]
    };

    // Filter by user role if targetRoles is specified
    if (req.user?.role) {
      query.$or = [
        { targetRoles: { $size: 0 } },
        { targetRoles: req.user.role },
        ...query.$or
      ];
    }

    const announcements = await Announcement.find(query)
      .populate('createdBy', 'firstName lastName')
      .sort({ createdAt: -1 });

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
    
    // Send response immediately
    res.status(201).json(announcement);
    
    // Send email notification asynchronously (don't wait)
    const creator = await User.findById(req.user.id);
    sendAnnouncementNotification(announcement, `${creator.firstName} ${creator.lastName}`)
      .catch(err => console.error('Email notification failed:', err));
    
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