require('dotenv').config();
const mongoose = require('mongoose');

const createIndexes = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    

    const db = mongoose.connection.db;

    // Attendance indexes
    await db.collection('attendances').createIndex({ userId: 1, date: -1 });
    await db.collection('attendances').createIndex({ date: -1 });
    await db.collection('attendances').createIndex({ status: 1, date: -1 });
    await db.collection('attendances').createIndex({ userId: 1, checkIn: -1 });

    // User indexes
    await db.collection('users').createIndex({ email: 1 }, { unique: true });
    await db.collection('users').createIndex({ department: 1, isActive: 1 });
    await db.collection('users').createIndex({ managerId: 1 });
    await db.collection('users').createIndex({ isActive: 1, role: 1 });

    // LeaveRequest indexes
    await db.collection('leaverequests').createIndex({ userId: 1, status: 1 });
    await db.collection('leaverequests').createIndex({ status: 1, startDate: -1 });
    await db.collection('leaverequests').createIndex({ startDate: 1, endDate: 1 });

    // LeaveBalance indexes
    await db.collection('leavebalances').createIndex({ userId: 1, year: 1 });
    await db.collection('leavebalances').createIndex({ leaveTypeId: 1 });

    // EmployeeProfile indexes
    await db.collection('employeeprofiles').createIndex({ userId: 1 }, { unique: true });
    await db.collection('employeeprofiles').createIndex({ 'workInfo.department': 1 });
    await db.collection('employeeprofiles').createIndex({ 'professionalInfo.department': 1 });

    // Expense indexes
    await db.collection('expenses').createIndex({ userId: 1, billingMonth: -1 });
    await db.collection('expenses').createIndex({ status: 1, billingMonth: -1 });

    // Notification indexes
    await db.collection('notifications').createIndex({ userId: 1, isRead: 1, createdAt: -1 });

    // Task indexes
    await db.collection('tasks').createIndex({ assignedTo: 1, status: 1 });
    await db.collection('tasks').createIndex({ dueDate: 1, status: 1 });

    
    process.exit(0);
  } catch (error) {
    console.error('❌ Index creation failed:', error);
    process.exit(1);
  }
};

createIndexes();
