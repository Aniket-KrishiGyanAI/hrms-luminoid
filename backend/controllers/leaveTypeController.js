const LeaveType = require('../models/LeaveType');
const { validationResult } = require('express-validator');
const logger = require('../utils/logger');

const createLeaveType = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const leaveType = new LeaveType(req.body);
    await leaveType.save();
    res.status(201).json({ message: 'Leave type created successfully', leaveType });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ message: 'Leave type name already exists' });
    }
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

const getLeaveTypes = async (req, res) => {
  try {
    const { active } = req.query;
    const filter = active !== undefined ? { isActive: active === 'true' } : {};
    const leaveTypes = await LeaveType.find(filter).sort({ name: 1 });
    res.json(leaveTypes);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

const getLeaveType = async (req, res) => {
  try {
    const leaveType = await LeaveType.findById(req.params.id);
    if (!leaveType) {
      return res.status(404).json({ message: 'Leave type not found' });
    }
    res.json(leaveType);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

const updateLeaveType = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const leaveType = await LeaveType.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );
    
    if (!leaveType) {
      return res.status(404).json({ message: 'Leave type not found' });
    }
    
    res.json({ message: 'Leave type updated successfully', leaveType });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

const deleteLeaveType = async (req, res) => {
  try {
    const leaveType = await LeaveType.findByIdAndDelete(req.params.id);
    if (!leaveType) {
      return res.status(404).json({ message: 'Leave type not found' });
    }
    res.json({ message: 'Leave type deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

module.exports = {
  createLeaveType,
  getLeaveTypes,
  getLeaveType,
  updateLeaveType,
  deleteLeaveType
};