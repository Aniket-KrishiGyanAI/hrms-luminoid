require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('./models/User');

const resetTestUsers = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');
    
    const users = [
      { email: 'admin@company.com', password: 'admin123' },
      { email: 'hr@company.com', password: 'hr123' },
      { email: 'manager@company.com', password: 'manager123' },
      { email: 'employee@company.com', password: 'employee123' }
    ];

    for (const userData of users) {
      const hashedPassword = await bcrypt.hash(userData.password, 10);
      const result = await User.updateOne(
        { email: userData.email },
        { $set: { password: hashedPassword } }
      );
      
      if (result.modifiedCount > 0) {
        console.log(`✓ Reset password for: ${userData.email}`);
      } else {
        console.log(`✗ User not found: ${userData.email}`);
      }
    }
    
    console.log('\n✅ Password reset completed!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Password reset failed:', error);
    process.exit(1);
  }
};

resetTestUsers();
