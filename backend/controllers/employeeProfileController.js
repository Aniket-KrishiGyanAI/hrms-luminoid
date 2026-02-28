const EmployeeProfile = require('../models/EmployeeProfile');
const User = require('../models/User');
const { uploadProfileImage, deleteProfileImage } = require('../utils/s3Utils');

const getProfile = async (req, res) => {
  try {
    const mongoose = require('mongoose');
    const Department = require('../models/Department');
    
    let profile = await EmployeeProfile.findOne({ userId: req.user.id })
      .populate('userId', 'firstName lastName email role department joinDate dateOfBirth profileImage')
      .populate('professionalInfo.reportingManager', 'firstName lastName');
    
    if (!profile) {
      const user = await User.findById(req.user.id);
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }
      
      profile = new EmployeeProfile({
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
          designation: user.designation || '',
          reportingManager: user.managerId || null,
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
      
      await profile.save();
      
      profile = await EmployeeProfile.findById(profile._id)
        .populate('userId', 'firstName lastName email role department joinDate dateOfBirth profileImage')
        .populate('professionalInfo.reportingManager', 'firstName lastName');
    }
    
    // Convert department ObjectId to name
    const profileObj = profile.toObject();
    if (profileObj.userId.department && mongoose.Types.ObjectId.isValid(profileObj.userId.department)) {
      const dept = await Department.findById(profileObj.userId.department);
      profileObj.userId.department = dept?.name || profileObj.userId.department;
    }
    
    res.json(profileObj);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const updateProfile = async (req, res) => {
  try {
    const mongoose = require('mongoose');
    const Department = require('../models/Department');
    const { employeeId, ...profileData } = req.body;
    
    if (employeeId !== undefined) {
      if (!profileData.professionalInfo) {
        profileData.professionalInfo = {};
      }
      profileData.professionalInfo.employeeId = employeeId;
    }
    
    const profile = await EmployeeProfile.findOneAndUpdate(
      { userId: req.user.id },
      profileData,
      { new: true, upsert: true }
    ).populate('userId', 'firstName lastName email role department joinDate dateOfBirth profileImage')
     .populate('professionalInfo.reportingManager', 'firstName lastName');
    
    // Convert department ObjectId to name
    const profileObj = profile.toObject();
    if (profileObj.userId.department && mongoose.Types.ObjectId.isValid(profileObj.userId.department)) {
      const dept = await Department.findById(profileObj.userId.department);
      profileObj.userId.department = dept?.name || profileObj.userId.department;
    }
    
    res.json(profileObj);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

const uploadProfilePicture = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No image file provided' });
    }

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Delete old profile image if exists
    if (user.profileImage) {
      await deleteProfileImage(user.profileImage);
    }

    // Upload new image to S3
    const imageUrl = await uploadProfileImage(req.file, req.user.id);
    
    // Update user with new profile image URL
    user.profileImage = imageUrl;
    await user.save();

    res.json({ 
      message: 'Profile image uploaded successfully',
      profileImage: imageUrl 
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const deleteProfilePicture = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (user.profileImage) {
      await deleteProfileImage(user.profileImage);
      user.profileImage = null;
      await user.save();
    }

    res.json({ message: 'Profile image deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getAllProfiles = async (req, res) => {
  try {
    const mongoose = require('mongoose');
    const Department = require('../models/Department');
    
    const profiles = await EmployeeProfile.find()
      .populate('userId', 'firstName lastName email role department joinDate profileImage')
      .populate('professionalInfo.reportingManager', 'firstName lastName');
    
    // Convert department ObjectIds to names
    const formattedProfiles = await Promise.all(profiles.map(async (profile) => {
      const profileObj = profile.toObject();
      if (profileObj.userId.department && mongoose.Types.ObjectId.isValid(profileObj.userId.department)) {
        const dept = await Department.findById(profileObj.userId.department);
        profileObj.userId.department = dept?.name || profileObj.userId.department;
      }
      return profileObj;
    }));
    
    res.json(formattedProfiles);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  getProfile,
  updateProfile,
  uploadProfilePicture,
  deleteProfilePicture,
  getAllProfiles
};