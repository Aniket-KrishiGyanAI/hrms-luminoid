const mongoose = require('mongoose');
const EmployeeProfile = require('../models/EmployeeProfile');
const User = require('../models/User');

const createProfile = async (req, res) => {
  try {
    const profile = new EmployeeProfile({
      ...req.body,
      userId: req.user.id
    });
    await profile.save();
    await profile.populate('userId', 'firstName lastName email');
    res.status(201).json({ message: 'Profile created successfully', profile });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

const getProfile = async (req, res) => {
  try {
    const paramId = req.params.userId;
    const userId = paramId || req.user.id;

    // validate ObjectId when present
    if (userId && !mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: 'Invalid user id' });
    }

    // First get the user
    const user = await User.findById(userId).select('firstName lastName email role department designation joinDate dateOfBirth');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Convert department ObjectId to name if needed
    const Department = require('../models/Department');
    if (user.department && mongoose.Types.ObjectId.isValid(user.department)) {
      const dept = await Department.findById(user.department);
      if (dept) user.department = dept.name;
    }

    // Set default dates to null if they are invalid
    if (user.joinDate && (user.joinDate.getFullYear() < 1900 || user.joinDate.getFullYear() > 2100)) {
      user.joinDate = null;
    }
    if (user.dateOfBirth && (user.dateOfBirth.getFullYear() < 1900 || user.dateOfBirth.getFullYear() > 2100)) {
      user.dateOfBirth = null;
    }

    // Try to get the employee profile
    let profile;
    try {
      profile = await EmployeeProfile.findOne({ userId })
        .populate('userId', 'firstName lastName email role department designation joinDate dateOfBirth')
        .populate('professionalInfo.reportingManager', 'firstName lastName email');
    } catch (popErr) {
      console.error('Error during profile lookup/populate:', popErr);
      profile = null;
    }

    if (!profile) {
      // Create a default profile structure with user data
      profile = {
        _id: null,
        userId: user,
        employeeId: '',
        location: '',
        workInfo: {
          designation: user.designation || '',
          department: user.department || '',
          workLocation: '',
          employmentType: 'FULL_TIME'
        },
        professionalInfo: {
          employeeId: '',
          designation: user.designation || '',
          department: user.department || '',
          workLocation: '',
          employmentType: 'FULL_TIME'
        },
        personalInfo: {
          phone: '',
          address: {
            street: '',
            city: '',
            state: '',
            zipCode: '',
            country: 'India'
          },
          emergencyContact: {
            name: '',
            phone: '',
            relationship: ''
          }
        },
        bankDetails: {},
        skills: []
      };
    } else {
      // Add employeeId and location at root level from professionalInfo for frontend compatibility
      profile = profile.toObject ? profile.toObject() : profile;
      profile.employeeId = profile.professionalInfo?.employeeId || '';
      profile.location = profile.professionalInfo?.workLocation || profile.workInfo?.workLocation || '';
    }

    console.log('Returning profile with employeeId:', profile.employeeId, 'and location:', profile.location);

    res.json(profile);
  } catch (error) {
    console.error('getProfile error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

const updateProfile = async (req, res) => {
  try {
    const userId = req.params.userId || req.user.id;
    
    // Authorization check: only allow users to edit their own profile unless they're ADMIN/HR
    if (req.params.userId && req.params.userId !== req.user.id && !['ADMIN', 'HR'].includes(req.user.role)) {
      return res.status(403).json({ message: 'Not authorized to edit this profile' });
    }
    
    // First ensure the user exists
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Clean the request body to handle address validation and employeeId
    const cleanBody = { ...req.body };
    
    // Handle employeeId at root level - move it to professionalInfo
    if (cleanBody.employeeId !== undefined) {
      if (!cleanBody.professionalInfo) {
        cleanBody.professionalInfo = {};
      }
      cleanBody.professionalInfo.employeeId = cleanBody.employeeId;
      delete cleanBody.employeeId;
    }
    
    if (cleanBody.personalInfo && cleanBody.personalInfo.address && typeof cleanBody.personalInfo.address === 'string') {
      const addressParts = cleanBody.personalInfo.address.split(',').map(part => part.trim());
      cleanBody.personalInfo.address = {
        street: addressParts[0] || '',
        city: addressParts[1] || '',
        state: addressParts[2] || '',
        zipCode: '',
        country: 'India'
      };
    }
    
    // Handle User model updates for ADMIN/HR
    if (['ADMIN', 'HR'].includes(req.user.role)) {
      const userUpdates = {};
      if (cleanBody.userId?.firstName) userUpdates.firstName = cleanBody.userId.firstName;
      if (cleanBody.userId?.lastName) userUpdates.lastName = cleanBody.userId.lastName;
      if (cleanBody.userId?.email) userUpdates.email = cleanBody.userId.email;
      if (cleanBody.userId?.department) userUpdates.department = cleanBody.userId.department;
      if (cleanBody.userId?.designation) userUpdates.designation = cleanBody.userId.designation;
      if (cleanBody.userId?.joinDate !== undefined) userUpdates.joinDate = cleanBody.userId.joinDate || null;
      if (cleanBody.userId?.dateOfBirth !== undefined) userUpdates.dateOfBirth = cleanBody.userId.dateOfBirth || null;
      
      if (Object.keys(userUpdates).length > 0) {
        await User.findByIdAndUpdate(userId, userUpdates);
      }
    }
    
    // Try to find existing profile
    let profile = await EmployeeProfile.findOne({ userId });
    
    if (profile) {
      // Update existing profile
      Object.assign(profile, cleanBody);
      await profile.save();
    } else {
      // Create new profile
      profile = new EmployeeProfile({
        userId,
        ...cleanBody
      });
      await profile.save();
    }
    
    // Populate and return
    await profile.populate('userId', 'firstName lastName email role department designation joinDate dateOfBirth');
    
    // Convert department ObjectId to name
    const profileObj = profile.toObject();
    if (profileObj.userId.department && mongoose.Types.ObjectId.isValid(profileObj.userId.department)) {
      const Department = require('../models/Department');
      const dept = await Department.findById(profileObj.userId.department);
      profileObj.userId.department = dept?.name || profileObj.userId.department;
    }
    
    res.json({ 
      message: 'Profile saved successfully', 
      profile: profileObj
    });
  } catch (error) {
    console.error('updateProfile error:', error);
    res.status(500).json({ 
      message: 'Server error', 
      error: error.message 
    });
  }
};

const getEmployeeDirectory = async (req, res) => {
  try {
    const { department, location, search, page = 1, limit = 20 } = req.query;
    const baseFilter = { isActive: true };

    // Build flexible filter: department may live on EmployeeProfile.workInfo,
    // EmployeeProfile.professionalInfo, or on the User document.
    let filter = { ...baseFilter };

    if (department) {
      // Find any users with matching department to include
      const usersWithDept = await User.find({ department }).select('_id');
      const userIds = usersWithDept.map(u => u._id);

      filter = {
        ...filter,
        $or: [
          { 'workInfo.department': department },
          { 'professionalInfo.department': department },
          { userId: { $in: userIds } }
        ]
      };
    }

    if (location) {
      // Attach location filter to either existing $or or top-level
      if (filter.$or) {
        // ensure each $or branch also checks location when appropriate
        filter = {
          ...filter,
          $and: [
            { $or: filter.$or },
            { $or: [ { 'workInfo.workLocation': location }, { 'professionalInfo.workLocation': location } ] }
          ]
        };
        delete filter.$or;
      } else {
        filter['workInfo.workLocation'] = location;
      }
    }

    let profiles = await EmployeeProfile.find(filter)
      .populate('userId', 'firstName lastName email role department designation joinDate dateOfBirth')
      .populate('workInfo.reportingManager', 'firstName lastName')
      .populate('professionalInfo.reportingManager', 'firstName lastName')
      .sort({ 'userId.firstName': 1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);
    
    // Add employeeId at root level for frontend compatibility
    profiles = profiles.map(profile => {
      const profileObj = profile.toObject ? profile.toObject() : profile;
      profileObj.employeeId = profileObj.professionalInfo?.employeeId || profileObj.workInfo?.employeeId || '';
      return profileObj;
    });
    
    if (search) {
      profiles = profiles.filter(profile => 
        profile.userId.firstName.toLowerCase().includes(search.toLowerCase()) ||
        profile.userId.lastName.toLowerCase().includes(search.toLowerCase()) ||
        profile.userId.email.toLowerCase().includes(search.toLowerCase())
      );
    }
    
    const total = await EmployeeProfile.countDocuments(filter);
    // If no profiles found (or to supplement), include Users without profiles
    const profileUserIds = profiles.map(p => p.userId?._id?.toString()).filter(Boolean);

    if (profiles.length < limit) {
      // Build user-level filter to find users matching department/location/search
      const userFilter = { isActive: true };
      if (department) userFilter.department = department;
      if (search) {
        userFilter.$or = [
          { firstName: { $regex: search, $options: 'i' } },
          { lastName: { $regex: search, $options: 'i' } },
          { email: { $regex: search, $options: 'i' } }
        ];
      }
      if (profileUserIds.length) userFilter._id = { $nin: profileUserIds };

      const remaining = Math.max(0, limit - profiles.length);
      const users = await User.find(userFilter).select('firstName lastName email role department designation joinDate dateOfBirth').limit(remaining);

      // Map users into lightweight profile-like objects for the frontend
      const userProfiles = users.map(u => ({
        _id: u._id,
        userId: u,
        employeeId: '',
        workInfo: {},
        professionalInfo: {}
      }));

      profiles = profiles.concat(userProfiles);
      // adjust total to reflect both sources
      const usersTotal = await User.countDocuments(userFilter);
      const combinedTotal = total + usersTotal;

      return res.json({
        profiles,
        totalPages: Math.ceil(combinedTotal / limit),
        currentPage: page,
        total: combinedTotal
      });
    }

    res.json({
      profiles,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

const getOrgChart = async (req, res) => {
  try {
    const profiles = await EmployeeProfile.find({ isActive: true })
      .populate('userId', 'firstName lastName email role')
      .populate('workInfo.reportingManager', 'firstName lastName email');
    
    // Build hierarchical structure
    const orgChart = buildOrgChart(profiles);
    res.json(orgChart);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

const buildOrgChart = (profiles) => {
  const profileMap = new Map();
  const rootNodes = [];
  
  // Create map of all profiles
  profiles.forEach(profile => {
    profileMap.set(profile.userId._id.toString(), {
      ...profile.toObject(),
      children: []
    });
  });
  
  // Build hierarchy
  profiles.forEach(profile => {
    const managerId = profile.workInfo.reportingManager?._id?.toString();
    if (managerId && profileMap.has(managerId)) {
      profileMap.get(managerId).children.push(profileMap.get(profile.userId._id.toString()));
    } else {
      rootNodes.push(profileMap.get(profile.userId._id.toString()));
    }
  });
  
  return rootNodes;
};

const getAllEmployees = async (req, res) => {
  try {
    const users = await User.find({ isActive: true })
      .select('firstName lastName email role department designation')
      .sort({ firstName: 1 })
      .lean();
    
    const Department = require('../models/Department');
    const deptIds = [...new Set(users.map(u => u.department).filter(d => d && mongoose.Types.ObjectId.isValid(d)))];
    const depts = await Department.find({ _id: { $in: deptIds } }).select('_id name').lean();
    const deptMap = Object.fromEntries(depts.map(d => [d._id.toString(), d.name]));
    
    const formattedUsers = users.map(user => {
      if (user.department && deptMap[user.department.toString()]) {
        user.department = deptMap[user.department.toString()];
      }
      return user;
    });
    
    res.json(formattedUsers);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

module.exports = {
  createProfile,
  getProfile,
  updateProfile,
  getEmployeeDirectory,
  getOrgChart,
  getAllEmployees
};