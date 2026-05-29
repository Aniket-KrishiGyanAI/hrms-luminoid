const mongoose = require('mongoose');
const EmployeeProfile = require('../models/EmployeeProfile');
const User = require('../models/User');
require('dotenv').config();

/**
 * Migration script to assign employee IDs to existing employees
 * Run this script once to update all existing employee profiles
 */
const assignEmployeeIds = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // Find all employee profiles without an employeeId or with empty employeeId
    const profilesWithoutId = await EmployeeProfile.find({
      $or: [
        { 'professionalInfo.employeeId': { $exists: false } },
        { 'professionalInfo.employeeId': '' },
        { 'professionalInfo.employeeId': null }
      ]
    }).sort({ createdAt: 1 }); // Sort by creation date to maintain order

    console.log(`Found ${profilesWithoutId.length} employees without employee IDs`);

    if (profilesWithoutId.length === 0) {
      console.log('All employees already have employee IDs!');
      await mongoose.connection.close();
      return;
    }

    // Find the highest existing employee ID number
    const lastEmployee = await EmployeeProfile.findOne({
      'professionalInfo.employeeId': { $regex: /^LUM\d+$/ }
    })
      .sort({ 'professionalInfo.employeeId': -1 })
      .select('professionalInfo.employeeId')
      .lean();

    let nextNumber = 1;
    if (lastEmployee?.professionalInfo?.employeeId) {
      const lastNumber = parseInt(lastEmployee.professionalInfo.employeeId.replace('LUM', ''), 10);
      nextNumber = lastNumber + 1;
      console.log(`Starting from employee ID: LUM${String(nextNumber).padStart(4, '0')}`);
    } else {
      console.log('Starting from employee ID: LUM0001');
    }

    // Assign employee IDs to all profiles without one
    let updatedCount = 0;
    for (const profile of profilesWithoutId) {
      const employeeId = `LUM${String(nextNumber).padStart(4, '0')}`;
      
      // Initialize professionalInfo if it doesn't exist
      if (!profile.professionalInfo) {
        profile.professionalInfo = {};
      }
      
      profile.professionalInfo.employeeId = employeeId;
      
      // Fix invalid bank account types
      if (profile.bankDetails?.accountType && !['SAVINGS', 'CURRENT'].includes(profile.bankDetails.accountType)) {
        profile.bankDetails.accountType = undefined;
      }
      
      await profile.save();
      
      console.log(`Assigned ${employeeId} to employee: ${profile.userId}`);
      nextNumber++;
      updatedCount++;
    }

    console.log(`\n✅ Successfully assigned employee IDs to ${updatedCount} employees`);
    console.log(`Last assigned ID: LUM${String(nextNumber - 1).padStart(4, '0')}`);

    // Also create profiles for users who don't have employee profiles yet
    const usersWithoutProfiles = await User.find({
      _id: { $nin: await EmployeeProfile.distinct('userId') }
    });

    if (usersWithoutProfiles.length > 0) {
      console.log(`\nFound ${usersWithoutProfiles.length} users without employee profiles`);
      
      for (const user of usersWithoutProfiles) {
        const employeeId = `LUM${String(nextNumber).padStart(4, '0')}`;
        
        await EmployeeProfile.create({
          userId: user._id,
          professionalInfo: {
            employeeId,
            designation: user.designation || '',
            employmentType: 'FULL_TIME'
          },
          personalInfo: {
            phone: '',
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
            }
          },
          bankDetails: {}
        });
        
        console.log(`Created profile with ${employeeId} for user: ${user.email}`);
        nextNumber++;
      }
      
      console.log(`\n✅ Created ${usersWithoutProfiles.length} new employee profiles`);
    }

    await mongoose.connection.close();
    console.log('\n✅ Migration completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    await mongoose.connection.close();
    process.exit(1);
  }
};

// Run the migration
assignEmployeeIds();
