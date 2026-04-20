const mongoose = require('mongoose');
require('dotenv').config();

const User = require('../models/User');

const roleMapping = {
  'ADMIN': 'SUPER_ADMIN',
  'HR': 'HR_MANAGER',
  'MANAGER': 'TEAM_MANAGER',
  'EMPLOYEE': 'EMPLOYEE'
};

async function migrateRoles() {
  try {
    
    await mongoose.connect(process.env.MONGODB_URI);
    

    // First, check current role distribution
    
    const currentRoles = await User.aggregate([
      { $group: { _id: '$role', count: { $sum: 1 } } },
      { $sort: { _id: 1 } }
    ]);
    currentRoles.forEach(r => );
    

    let totalMigrated = 0;
    
    for (const [oldRole, newRole] of Object.entries(roleMapping)) {
      if (oldRole === newRole) continue; // Skip EMPLOYEE
      
      const count = await User.countDocuments({ role: oldRole });
      if (count === 0) {
        
        continue;
      }

      
      
      const result = await User.updateMany(
        { role: oldRole },
        { $set: { role: newRole } }
      );
      
      
      totalMigrated += result.modifiedCount;
    }

    
    
    const newRoles = await User.aggregate([
      { $group: { _id: '$role', count: { $sum: 1 } } },
      { $sort: { _id: 1 } }
    ]);
    newRoles.forEach(r => );

    
    
    
    
    
    
    
    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    await mongoose.connection.close();
    process.exit(1);
  }
}

migrateRoles();
