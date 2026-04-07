const jwt = require('jsonwebtoken');
const User = require('../models/User');
const EmployeeProfile = require('../models/EmployeeProfile');
const { validationResult } = require('express-validator');

const generateTokens = (userId) => {
  const accessToken = jwt.sign({ id: userId }, process.env.JWT_SECRET, { expiresIn: '15m' });
  const refreshToken = jwt.sign({ id: userId }, process.env.JWT_REFRESH_SECRET, { expiresIn: '7d' });
  return { accessToken, refreshToken };
};

const register = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, password, firstName, lastName, managerId, department, designation, joinDate, dateOfBirth } = req.body;
    
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'User already exists' });
    }

    // For public registration, always create regular EMPLOYEE accounts.
    const user = new User({
      email, 
      password, 
      firstName, 
      lastName, 
      role: 'EMPLOYEE', 
      managerId, 
      department,
      designation,
      joinDate: joinDate || new Date(),
      dateOfBirth: dateOfBirth || null
    });

    await user.save();
    
    // Create employee profile with basic information
    const employeeProfile = new EmployeeProfile({
      userId: user._id,
      personalInfo: {
        phone: '',
        alternatePhone: '',
        address: {
          street: '',
          city: '',
          state: '',
          zipCode: '',
          country: ''
        },
        emergencyContact: {
          name: '',
          relationship: '',
          phone: '',
          email: ''
        },
        bloodGroup: '',
        maritalStatus: 'SINGLE'
      },
      professionalInfo: {
        employeeId: '',
        designation: designation || '',
        reportingManager: managerId || null,
        workLocation: '',
        employmentType: 'FULL_TIME',
        salary: {
          basic: 0,
          allowances: 0,
          deductions: 0,
          currency: 'USD'
        },
        skills: [],
        certifications: []
      },
      bankDetails: {
        accountNumber: '',
        bankName: '',
        ifscCode: '',
        accountType: 'SAVINGS'
      },
      documents: []
    });
    
    await employeeProfile.save();
    
    const { accessToken, refreshToken } = generateTokens(user._id);
    
    user.refreshToken = refreshToken;
    await user.save();

    res.status(201).json({
      message: 'User created successfully',
      user: { id: user._id, email: user.email, role: user.role, firstName: user.firstName, lastName: user.lastName },
      accessToken,
      refreshToken
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

const login = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, password } = req.body;
    // console.log('Login attempt:', { email, password: '***' });
    
    const user = await User.findOne({ email, isActive: true });
    // console.log('User found:', user ? 'Yes' : 'No');
    
    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }
    
    const isPasswordValid = await user.comparePassword(password);
    
    if (!isPasswordValid) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const { accessToken, refreshToken } = generateTokens(user._id);
    user.refreshToken = refreshToken;
    await user.save();

    res.json({
      message: 'Login successful',
      user: { id: user._id, email: user.email, role: user.role, firstName: user.firstName, lastName: user.lastName, isFieldEmployee: user.isFieldEmployee },
      accessToken,
      refreshToken
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

const refreshToken = async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      return res.status(401).json({ message: 'Refresh token required' });
    }

    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    const user = await User.findById(decoded.id);
    
    if (!user || user.refreshToken !== refreshToken) {
      return res.status(401).json({ message: 'Invalid refresh token' });
    }

    const tokens = generateTokens(user._id);
    user.refreshToken = tokens.refreshToken;
    await user.save();

    res.json(tokens);
  } catch (error) {
    res.status(401).json({ message: 'Invalid refresh token' });
  }
};

const logout = async (req, res) => {
  try {
    await User.findByIdAndUpdate(req.user.id, { refreshToken: null });
    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

const getCurrentUser = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password -refreshToken');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json({ user: { id: user._id, email: user.email, role: user.role, firstName: user.firstName, lastName: user.lastName, isFieldEmployee: user.isFieldEmployee } });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = { register, login, refreshToken, logout, getCurrentUser };