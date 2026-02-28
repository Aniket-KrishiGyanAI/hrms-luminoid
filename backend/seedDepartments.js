require('dotenv').config();
const mongoose = require('mongoose');
const Department = require('./models/Department');
const User = require('./models/User');

const seedDepartments = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // Get admin user
    const admin = await User.findOne({ role: 'ADMIN' });
    if (!admin) {
      console.log('No admin user found. Please run seed.js first.');
      process.exit(1);
    }

    const departments = [
      {
        name: 'Human Resources',
        code: 'HR',
        description: 'Manages employee relations, recruitment, and benefits',
        location: 'Office',
        status: 'ACTIVE',
        departmentHead: admin._id
      },
      {
        name: 'Engineering',
        code: 'ENG',
        description: 'Software development and technical operations',
        location: 'Office',
        status: 'ACTIVE'
      },
      {
        name: 'Sales',
        code: 'SALES',
        description: 'Business development and customer acquisition',
        location: 'Office',
        status: 'ACTIVE'
      },
      {
        name: 'Marketing',
        code: 'MKT',
        description: 'Brand management and marketing campaigns',
        location: 'Remote',
        status: 'ACTIVE'
      },
      {
        name: 'Finance',
        code: 'FIN',
        description: 'Financial planning and accounting',
        location: 'Office',
        status: 'ACTIVE'
      },
      {
        name: 'Operations',
        code: 'OPS',
        description: 'Day-to-day business operations',
        location: 'Office',
        status: 'ACTIVE'
      }
    ];

    for (const dept of departments) {
      const existing = await Department.findOne({ code: dept.code });
      if (!existing) {
        await Department.create(dept);
        console.log(`✓ Created department: ${dept.name}`);
      } else {
        console.log(`- Department already exists: ${dept.name}`);
      }
    }

    // Update employee counts
    const allDepts = await Department.find();
    for (const dept of allDepts) {
      const count = await User.countDocuments({ department: dept._id });
      await Department.findByIdAndUpdate(dept._id, { employeeCount: count });
    }

    console.log('\n✅ Department seeding completed!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding departments:', error);
    process.exit(1);
  }
};

seedDepartments();
