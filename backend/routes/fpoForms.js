const express = require('express');
const router = express.Router();
const FpoForm = require('../models/FpoForm');
const { auth, authorize } = require('../middleware/auth');

// Submit FPO Form (Employee)
router.post('/', auth, async (req, res) => {
  try {
    const fpoForm = new FpoForm({
      ...req.body,
      submittedBy: req.user._id
    });
    await fpoForm.save();
    res.status(201).json({ message: 'FPO form submitted successfully', data: fpoForm });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Get all FPO Forms (Manager/HR/Admin)
router.get('/', auth, async (req, res) => {
  try {
    const { status, search } = req.query;
    let query = {};

    // If employee, show only their submissions
    if (req.user.role === 'EMPLOYEE') {
      query.submittedBy = req.user._id;
    }

    // Filter by status
    if (status) {
      query.status = status;
    }

    // Search functionality
    if (search) {
      query.$or = [
        { fpoName: { $regex: search, $options: 'i' } },
        { fpoOwnerName: { $regex: search, $options: 'i' } },
        { mobileNumber: { $regex: search, $options: 'i' } },
        { emailAddress: { $regex: search, $options: 'i' } }
      ];
    }

    const forms = await FpoForm.find(query)
      .populate('submittedBy', 'firstName lastName email')
      .populate('reviewedBy', 'firstName lastName')
      .sort({ createdAt: -1 });

    res.json(forms);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get single FPO Form
router.get('/:id', auth, async (req, res) => {
  try {
    const form = await FpoForm.findById(req.params.id)
      .populate('submittedBy', 'firstName lastName email')
      .populate('reviewedBy', 'firstName lastName');

    if (!form) {
      return res.status(404).json({ message: 'Form not found' });
    }

    // Check access
    if (req.user.role === 'EMPLOYEE' && form.submittedBy._id.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Access denied' });
    }

    res.json(form);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Update FPO Form status (Manager/HR/Admin)
router.put('/:id/review', auth, async (req, res) => {
  try {
    if (!['MANAGER', 'HR', 'ADMIN'].includes(req.user.role)) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const { status, reviewNotes } = req.body;

    const form = await FpoForm.findByIdAndUpdate(
      req.params.id,
      {
        status,
        reviewNotes,
        reviewedBy: req.user._id,
        reviewedAt: new Date()
      },
      { new: true }
    ).populate('submittedBy', 'firstName lastName email')
     .populate('reviewedBy', 'firstName lastName');

    if (!form) {
      return res.status(404).json({ message: 'Form not found' });
    }

    res.json({ message: 'Form reviewed successfully', data: form });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Delete FPO Form (Admin only)
router.delete('/:id', auth, async (req, res) => {
  try {
    if (req.user.role !== 'ADMIN') {
      return res.status(403).json({ message: 'Access denied' });
    }

    const form = await FpoForm.findByIdAndDelete(req.params.id);

    if (!form) {
      return res.status(404).json({ message: 'Form not found' });
    }

    res.json({ message: 'Form deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get statistics (Manager/HR/Admin)
router.get('/stats/summary', auth, async (req, res) => {
  try {
    if (!['MANAGER', 'HR', 'ADMIN'].includes(req.user.role)) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const stats = await FpoForm.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    const total = await FpoForm.countDocuments();

    res.json({ total, stats });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
