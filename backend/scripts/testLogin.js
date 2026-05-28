const mongoose = require('mongoose');
const User = require('../models/User');
require('dotenv').config();

const testLogin = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    // Check if any users exist
    const userCount = await User.countDocuments();
    console.log(`📊 Total users in database: ${userCount}\n`);

    if (userCount === 0) {
      console.log('⚠️  No users found in database!');
      console.log('You need to create a user first.\n');
      await mongoose.connection.close();
      return;
    }

    // List all users (without passwords)
    const users = await User.find().select('email firstName lastName role isActive').limit(10);
    console.log('👥 Users in database:');
    console.log('─'.repeat(80));
    users.forEach((user, index) => {
      console.log(`${index + 1}. Email: ${user.email}`);
      console.log(`   Name: ${user.firstName} ${user.lastName}`);
      console.log(`   Role: ${user.role}`);
      console.log(`   Active: ${user.isActive ? '✅' : '❌'}`);
      console.log('─'.repeat(80));
    });

    // Test password comparison for first user
    if (users.length > 0) {
      const testUser = await User.findById(users[0]._id);
      console.log('\n🔐 Testing password for first user...');
      console.log(`Email: ${testUser.email}`);
      console.log('Try logging in with this email and the password you set during registration.');
    }

    await mongoose.connection.close();
    console.log('\n✅ Test completed');
  } catch (error) {
    console.error('❌ Error:', error.message);
    await mongoose.connection.close();
  }
};

testLogin();
