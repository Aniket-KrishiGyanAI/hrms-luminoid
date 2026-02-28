const User = require('../models/User');
const EmployeeProfile = require('../models/EmployeeProfile');
const LeaveBalance = require('../models/LeaveBalance');
const { sendWelcomeEmail } = require('../utils/emailService');
const mongoose = require('mongoose');

// Create single employee
const createEmployee = async (req, res) => {
  try {
    const { email, firstName, lastName, role, department, designation, joinDate, managerId } = req.body;

    console.log('Creating employee with data:', { email, firstName, lastName, role, department, designation, joinDate });

    // Check if user exists
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(400).json({ message: 'Employee with this email already exists' });
    }

    // Generate temporary password
    const tempPassword = `${firstName}@123`;

    // Create user
    const user = new User({
      email: email.toLowerCase(),
      password: tempPassword,
      firstName,
      lastName,
      role: role || 'EMPLOYEE',
      department,
      designation,
      joinDate: joinDate || new Date(),
      managerId,
      isActive: true
    });

    await user.save();
    console.log('User created:', user._id);

    // Create basic employee profile
    await EmployeeProfile.create({
      userId: user._id,
      professionalInfo: {
        designation,
        employmentType: 'FULL_TIME'
      }
    });
    console.log('Employee profile created');

    // Initialize leave balances for all leave types
    const LeaveType = require('../models/LeaveType');
    const leaveTypes = await LeaveType.find({ isActive: true });
    
    const currentYear = new Date().getFullYear();
    const leaveBalances = leaveTypes.map(leaveType => ({
      userId: user._id,
      leaveTypeId: leaveType._id,
      year: currentYear,
      allocated: leaveType.maxDaysPerYear || 0,
      used: 0,
      pending: 0,
      carryForward: 0
    }));
    
    if (leaveBalances.length > 0) {
      await LeaveBalance.insertMany(leaveBalances);
      console.log('Leave balances created for all leave types');
    }
    console.log('Leave balance created');

    // Send welcome email
    try {
      await sendWelcomeEmail({
        to: email,
        name: `${firstName} ${lastName}`,
        password: tempPassword,
        loginUrl: process.env.FRONTEND_URL || 'http://localhost:3000'
      });
      console.log('Welcome email sent successfully');
    } catch (emailError) {
      console.error('Email send failed:', emailError);
      // Don't fail the request if email fails
    }

    res.status(201).json({
      success: true,
      message: 'Employee created successfully. Welcome email sent.',
      employee: {
        id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        tempPassword: tempPassword
      }
    });
  } catch (error) {
    console.error('Error creating employee:', error);
    res.status(500).json({ message: 'Error creating employee', error: error.message });
  }
};

// Deactivate employee (soft delete)
const deactivateEmployee = async (req, res) => {
  try {
    const { userId } = req.params;
    const { exitReason, exitDate, exitInterview, handoverStatus, exitNotes } = req.body;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'Employee not found' });
    }

    // Soft delete with comprehensive exit details
    user.isActive = false;
    user.refreshToken = null; // Logout user immediately
    user.exitDetails = {
      reason: exitReason || 'Not specified',
      exitDate: exitDate || new Date(),
      exitInterview: exitInterview || 'NO',
      handoverStatus: handoverStatus || 'PENDING',
      notes: exitNotes || '',
      deactivatedBy: req.user.id,
      deactivatedAt: new Date()
    };
    await user.save();

    res.json({ 
      message: 'Employee deactivated successfully',
      exitDetails: user.exitDetails
    });
  } catch (error) {
    res.status(500).json({ message: 'Error deactivating employee', error: error.message });
  }
};

// Reactivate employee
const reactivateEmployee = async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'Employee not found' });
    }

    user.isActive = true;
    await user.save();

    res.json({ message: 'Employee reactivated successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error reactivating employee', error: error.message });
  }
};

// Get all employees with status filter
const getAllEmployees = async (req, res) => {
  try {
    const { status, department, role } = req.query;
    
    const filter = {};
    if (status === 'active') filter.isActive = true;
    if (status === 'inactive') filter.isActive = false;
    if (department) filter.department = department;
    if (role) filter.role = role;

    const employees = await User.find(filter)
      .select('firstName lastName email role department designation joinDate isActive profileImage')
      .populate('managerId', 'firstName lastName')
      .sort({ firstName: 1 })
      .lean();

    const Department = require('../models/Department');
    const deptIds = [...new Set(employees.map(e => e.department).filter(d => d && mongoose.Types.ObjectId.isValid(d)))];
    const depts = await Department.find({ _id: { $in: deptIds } }).select('_id name').lean();
    const deptMap = Object.fromEntries(depts.map(d => [d._id.toString(), d.name]));

    const formattedEmployees = employees.map(emp => {
      if (emp.department && deptMap[emp.department.toString()]) {
        emp.department = deptMap[emp.department.toString()];
      }
      return emp;
    });

    res.json(formattedEmployees);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching employees', error: error.message });
  }
};

module.exports = {
  createEmployee,
  deactivateEmployee,
  reactivateEmployee,
  getAllEmployees
};

const deleteEmployee = async (req, res) => {
  try {
    const { userId } = req.params;
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'Employee not found' });
    }

    await EmployeeProfile.deleteOne({ userId });
    await LeaveBalance.deleteMany({ userId });
    await User.findByIdAndDelete(userId);

    res.json({ message: 'Employee deleted permanently' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting employee', error: error.message });
  }
};

module.exports = {
  createEmployee,
  deactivateEmployee,
  reactivateEmployee,
  getAllEmployees,
  deleteEmployee
};
