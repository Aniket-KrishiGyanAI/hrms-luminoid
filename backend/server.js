require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const authRoutes = require('./routes/auth');
const leaveTypeRoutes = require('./routes/leaveTypes');
const leaveBalanceRoutes = require('./routes/leaveBalances');
const leaveRequestRoutes = require('./routes/leaveRequests');
const dashboardRoutes = require('./routes/dashboard');
const employeeRoutes = require('./routes/employees');
const attendanceRoutes = require('./routes/attendance');
const announcementRoutes = require('./routes/announcements');
const holidayRoutes = require('./routes/holidays');
const favoriteRoutes = require('./routes/favorites');
const fileRoutes = require('./routes/files');
const employeeProfileRoutes = require('./routes/employeeProfiles');
const expenseRoutes = require('./routes/expenses');
const assetRoutes = require('./routes/assets');
const userRoutes = require('./routes/users');
const employeeImportRoutes = require('./routes/employeeImport');
const departmentRoutes = require('./routes/departments');
const employeeManagementRoutes = require('./routes/employeeManagement');

// Initialize cron jobs
require('./utils/cronJobs');

// Ensure upload directories exist
const uploadsDir = path.join(__dirname, 'uploads');
const receiptsDir = path.join(__dirname, 'uploads', 'receipts');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}
if (!fs.existsSync(receiptsDir)) {
  fs.mkdirSync(receiptsDir, { recursive: true });
}

const app = express();

// Middleware
app.use(cors({
  origin: true,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Cache-Control', 'Pragma', 'Expires']
}));
app.use(express.json());
app.set('trust proxy', true);

// Serve static files from uploads directory
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Server is running' });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/leave-types', leaveTypeRoutes);
app.use('/api/leave-balances', leaveBalanceRoutes);
app.use('/api/leave-requests', leaveRequestRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/employees', employeeRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/announcements', announcementRoutes);
app.use('/api/holidays', holidayRoutes);
app.use('/api/favorites', favoriteRoutes);
app.use('/api/files', fileRoutes);
app.use('/api/employee-profiles', employeeProfileRoutes);
app.use('/api/expenses', expenseRoutes);
app.use('/api/assets', assetRoutes);
app.use('/api/users', userRoutes);
app.use('/api/employee-import', employeeImportRoutes);
app.use('/api/departments', departmentRoutes);
app.use('/api/employee-management', employeeManagementRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Something went wrong!' });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ message: 'Route not found' });
});

// Database connection
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('MongoDB connection error:', err));

const PORT = process.env.PORT || 5000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Local: http://localhost:${PORT}`);
  console.log(`Network: http://192.168.1.60:${PORT}`);
});