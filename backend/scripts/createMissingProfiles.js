const mongoose = require('mongoose');
const User = require('../models/User');
const EmployeeProfile = require('../models/EmployeeProfile');
require('dotenv').config();

const createMissingProfiles = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    

    // Find all users who don't have an employee profile
    const users = await User.find({ isActive: true });
    // 

    let created = 0;
    for (const user of users) {
      const existingProfile = await EmployeeProfile.findOne({ userId: user._id });
      
      if (!existingProfile) {
        // `);
        
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
        
        await employeeProfile.save();
        created++;
      }
    }

    // 
    // 
    
  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    await mongoose.disconnect();
    
  }
};

// Run the migration
createMissingProfiles();