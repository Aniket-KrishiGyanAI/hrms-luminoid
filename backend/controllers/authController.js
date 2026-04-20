const jwt = require('jsonwebtoken');
const User = require('../models/User');
const EmployeeProfile = require('../models/EmployeeProfile');
const { validationResult } = require('express-validator');
const tokenBlacklist = require('../utils/tokenBlacklist');
const logger = require('../utils/logger');

const generateTokens = (userId) => {
  const accessToken = jwt.sign({ id: userId }, process.env.JWT_SECRET, { expiresIn: '15m' });
  const refreshToken = jwt.sign({ id: userId }, process.env.JWT_REFRESH_SECRET, { expiresIn: '7d' });
  return { accessToken, refreshToken };
};

const register = async (req, res) => {
  try {
    logger.info('User registration attempt', { email: req.body.email });
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      logger.warn('Registration validation failed', { errors: errors.array() });
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, password, firstName, lastName, managerId, department, designation, joinDate, dateOfBirth } = req.body;
    
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      logger.warn('Registration failed - user exists', { email });
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

    logger.info('User registered successfully', { userId: user._id, email: user.email });
    res.status(201).json({
      message: 'User created successfully',
      user: { id: user._id, email: user.email, role: user.role, firstName: user.firstName, lastName: user.lastName },
      accessToken,
      refreshToken
    });
  } catch (error) {
    logger.error('Registration error', { error: error.message, stack: error.stack });
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

const login = async (req, res) => {
  try {
    logger.info('Login attempt', { email: req.body.email });
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      logger.warn('Login validation failed', { errors: errors.array() });
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, password } = req.body;
    
    const user = await User.findOne({ email, isActive: true });
    
    if (!user) {
      logger.warn('Login failed - user not found', { email });
      return res.status(401).json({ message: 'Invalid credentials' });
    }
    
    const isPasswordValid = await user.comparePassword(password);
    
    if (!isPasswordValid) {
      logger.warn('Login failed - invalid password', { email });
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const { accessToken, refreshToken } = generateTokens(user._id);
    user.refreshToken = refreshToken;
    await user.save();

    logger.info('Login successful', { userId: user._id, email: user.email });
    res.json({
      message: 'Login successful',
      user: { id: user._id, email: user.email, role: user.role, firstName: user.firstName, lastName: user.lastName, isFieldEmployee: user.isFieldEmployee },
      accessToken,
      refreshToken
    });
  } catch (error) {
    logger.error('Login error', { error: error.message, stack: error.stack });
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

const refreshToken = async (req, res) => {
  try {
    logger.info('Token refresh attempt');
    const { refreshToken } = req.body;
    if (!refreshToken) {
      logger.warn('Token refresh failed - no token provided');
      return res.status(401).json({ message: 'Refresh token required' });
    }

    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    const user = await User.findById(decoded.id);
    
    if (!user || user.refreshToken !== refreshToken) {
      logger.warn('Token refresh failed - invalid token', { userId: decoded?.id });
      return res.status(401).json({ message: 'Invalid refresh token' });
    }

    const tokens = generateTokens(user._id);
    user.refreshToken = tokens.refreshToken;
    await user.save();

    logger.info('Token refreshed successfully', { userId: user._id });
    res.json(tokens);
  } catch (error) {
    logger.error('Token refresh error', { error: error.message });
    res.status(401).json({ message: 'Invalid refresh token' });
  }
};

const logout = async (req, res) => {
  try {
    logger.info('Logout attempt', { userId: req.user.id });
    if (req.token) {
      const decoded = jwt.decode(req.token);
      if (decoded && decoded.exp) {
        tokenBlacklist.addToken(req.token, decoded.exp * 1000);
      }
    }
    
    await User.findByIdAndUpdate(req.user.id, { refreshToken: null });
    logger.info('Logout successful', { userId: req.user.id });
    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    logger.error('Logout error', { error: error.message, userId: req.user.id });
    res.status(500).json({ message: 'Server error' });
  }
};

const getCurrentUser = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password -refreshToken');
    if (!user) {
      logger.warn('Get current user failed - user not found', { userId: req.user.id });
      return res.status(404).json({ message: 'User not found' });
    }
    res.json({ user: { id: user._id, email: user.email, role: user.role, firstName: user.firstName, lastName: user.lastName, isFieldEmployee: user.isFieldEmployee } });
  } catch (error) {
    logger.error('Get current user error', { error: error.message, userId: req.user.id });
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = { register, login, refreshToken, logout, getCurrentUser };