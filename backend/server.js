require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const compression = require('compression');
const { initCache } = require('./config/cache');
const logger = require('./utils/logger');

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
const taskRoutes = require('./routes/tasks');
const notificationRoutes = require('./routes/notifications');
const dailyUpdateRoutes = require('./routes/dailyUpdates');
const workLogRoutes = require('./routes/workLogs');
const officeLocationRoutes = require('./routes/officeLocations');
const folderRoutes = require('./routes/folders');
const trainingRoutes = require('./routes/training');
const fieldClientRoutes = require('./routes/fieldClients');
const fieldVisitRoutes = require('./routes/fieldVisits');
const visitPlanRoutes = require('./routes/visitPlans');
const fieldReportRoutes = require('./routes/fieldReports');
const fpoFormRoutes = require('./routes/fpoForms');
const consentRoutes = require('./routes/consent');
const attendancePolicyRoutes = require('./routes/attendancePolicy');

const seedDefaultOffice = require('./utils/seedOfficeLocation');
const sanitizeInput = require('./middleware/sanitize');
const { performanceMonitor, getPerformanceStats } = require('./middleware/performanceMonitor');

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

// Enable gzip compression
app.use(compression());

// Rate limiting configuration with separate limits for different endpoints
const rateLimit = new Map();

// Clean up old entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, record] of rateLimit.entries()) {
    if (now > record.resetTime + 60000) { // 1 minute after reset
      rateLimit.delete(key);
    }
  }
}, 5 * 60 * 1000);

const rateLimitMiddleware = (maxRequests, windowMs, identifier = 'ip') => (req, res, next) => {
  // Use email for login attempts, IP for other requests
  const key = identifier === 'email' && req.body.email 
    ? `${req.body.email}:${req.path}` 
    : `${req.ip}:${req.path}`;
  
  const now = Date.now();
  const record = rateLimit.get(key) || { count: 0, resetTime: now + windowMs };
  
  if (now > record.resetTime) {
    record.count = 0;
    record.resetTime = now + windowMs;
  }
  
  record.count++;
  rateLimit.set(key, record);
  
  if (record.count > maxRequests) {
    const retryAfter = Math.ceil((record.resetTime - now) / 1000);
    res.set('Retry-After', retryAfter);
    return res.status(429).json({ 
      message: 'Too many requests, please try again later',
      retryAfter: retryAfter
    });
  }
  
  // Add rate limit headers
  res.set('X-RateLimit-Limit', maxRequests);
  res.set('X-RateLimit-Remaining', Math.max(0, maxRequests - record.count));
  res.set('X-RateLimit-Reset', new Date(record.resetTime).toISOString());
  
  next();
};

// CORS configuration
const allowedOrigins = process.env.NODE_ENV === 'production'
  ? (process.env.CORS_ORIGINS || '').split(',').filter(Boolean)
  : ['http://localhost:3000', 'http://localhost:5000'];

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, Postman, etc.)
    if (!origin) return callback(null, true);
    
    if (process.env.NODE_ENV === 'development') {
      return callback(null, true);
    }
    
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Cache-Control', 'Pragma', 'Expires']
}));
app.use(express.json());
app.use(sanitizeInput); // Prevent NoSQL injection
app.use(performanceMonitor); // Track request performance
app.set('trust proxy', true);

// Serve static files from uploads directory with caching
app.use('/uploads', express.static(path.join(__dirname, 'uploads'), {
  maxAge: '7d',
  etag: true,
  lastModified: true
}));

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    message: 'Server is running',
    performance: getPerformanceStats(),
    cache: process.env.REDIS_URL ? 'enabled' : 'disabled'
  });
});

// ── Email Preview Endpoints (development only) ──
// Open in browser: http://localhost:5000/api/preview/expense-reminder?days=1
// days=1 → "LAST DAY TOMORROW" (red)
// days=2 → "Only 2 Days Left" (orange)
app.get('/api/preview/expense-reminder', (req, res) => {
  const daysLeft   = parseInt(req.query.days) || 1;
  const now        = new Date();
  const lastDay    = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const billingMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const [year, month] = billingMonth.split('-');
  const monthName  = new Date(year, month - 1).toLocaleString('default', { month: 'long', year: 'numeric' });

  const urgencyColor  = daysLeft === 1 ? '#dc2626' : '#ea580c';
  const urgencyBg     = daysLeft === 1 ? '#fee2e2' : '#ffedd5';
  const urgencyBorder = daysLeft === 1 ? '#fca5a5' : '#fdba74';
  const urgencyLabel  = daysLeft === 1 ? '\uD83D\uDEA8 LAST DAY TOMORROW!' : '\u26A0\uFE0F Only 2 Days Left!';

  res.send(`
    <!DOCTYPE html><html><head><meta charset="UTF-8">
    <title>Email Preview — Expense Reminder (${daysLeft} day${daysLeft > 1 ? 's' : ''} left)</title>
    <style>body{margin:0;background:#e2e8f0;padding:32px;font-family:Arial,sans-serif;}
    .preview-bar{background:#1e293b;color:#fff;padding:12px 24px;border-radius:8px;margin-bottom:24px;display:flex;align-items:center;gap:16px;font-size:14px;}
    .preview-bar a{color:#10b981;text-decoration:none;font-weight:600;}
    </style></head><body>
    <div class="preview-bar">
      📧 Email Preview &nbsp;|&nbsp;
      <a href="/api/preview/expense-reminder?days=2">View 2-day version (orange)</a> &nbsp;|
      <a href="/api/preview/expense-reminder?days=1">View 1-day version (red)</a>
    </div>

    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#f8fafc;">

      <div style="background:linear-gradient(135deg,#1e293b 0%,#0f172a 100%);padding:32px 40px;border-radius:12px 12px 0 0;">
        <h1 style="color:#fff;margin:0;font-size:22px;font-weight:700;">&#128188; Expense Submission Reminder</h1>
        <p style="color:rgba(255,255,255,0.6);margin:6px 0 0;font-size:14px;">${monthName} &mdash; Deadline Alert</p>
      </div>

      <div style="background:${urgencyBg};border:1.5px solid ${urgencyBorder};border-radius:8px;margin:24px 40px 0;padding:16px 20px;">
        <p style="margin:0;color:${urgencyColor};font-size:16px;font-weight:700;">${urgencyLabel}</p>
        <p style="margin:4px 0 0;color:${urgencyColor};font-size:13px;">
          The expense submission window for <strong>${monthName}</strong> closes on the <strong>${lastDay}th</strong>.
          After that, no expenses can be submitted or claimed.
        </p>
      </div>

      <div style="background:#fff;margin:16px 40px 0;border-radius:8px;padding:24px;border:1px solid #e2e8f0;">
        <p style="margin:0 0 16px;color:#334155;font-size:15px;">Dear <strong>John</strong>,</p>
        <p style="margin:0 0 16px;color:#475569;font-size:14px;line-height:1.6;">
          This is a reminder to submit all your pending expense claims for <strong>${monthName}</strong>.
          You have <strong style="color:${urgencyColor};">${daysLeft} day${daysLeft > 1 ? 's' : ''}</strong> remaining.
        </p>
        <div style="background:#f8fafc;border-radius:8px;padding:16px 20px;margin:16px 0;">
          <p style="margin:0 0 10px;font-weight:700;color:#1e293b;font-size:13px;text-transform:uppercase;letter-spacing:0.05em;">Before the deadline, make sure you have:</p>
          <ul style="margin:0;padding-left:20px;color:#475569;font-size:14px;line-height:2;">
            <li>Submitted all expense claims for ${monthName}</li>
            <li>Uploaded bills/receipts for each expense</li>
            <li>Verified the amounts and categories are correct</li>
          </ul>
        </div>
        <div style="background:#fee2e2;border-radius:8px;padding:14px 18px;margin:16px 0;border-left:4px solid #dc2626;">
          <p style="margin:0;color:#991b1b;font-size:13px;font-weight:600;">
            &#10060; After ${lastDay}th ${monthName}, the system will be locked and no new expenses can be submitted or claimed for this month.
          </p>
        </div>
      </div>

      <div style="text-align:center;margin:24px 40px;">
        <a href="#" style="display:inline-block;background:linear-gradient(135deg,#10b981,#059669);color:#fff;text-decoration:none;
                   padding:14px 32px;border-radius:8px;font-size:15px;font-weight:700;
                   box-shadow:0 4px 12px rgba(16,185,129,0.35);">Submit My Expenses Now &rarr;</a>
      </div>

      <div style="text-align:center;padding:20px 40px 32px;color:#94a3b8;font-size:12px;">
        <p style="margin:0;">This is an automated reminder from your HRMS. Please do not reply to this email.</p>
        <p style="margin:6px 0 0;">&copy; ${new Date().getFullYear()} Luminoid HRMS</p>
      </div>
    </div>
    </body></html>
  `);
});

// Routes - rate limiting applied selectively
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
app.use('/api/tasks', taskRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/daily-updates', dailyUpdateRoutes);
app.use('/api/work-logs', workLogRoutes);
app.use('/api/office-locations', officeLocationRoutes);
app.use('/api/folders', folderRoutes);
app.use('/api/training', trainingRoutes);
app.use('/api/field-clients', fieldClientRoutes);
app.use('/api/field-visits', fieldVisitRoutes);
app.use('/api/visit-plans', visitPlanRoutes);
app.use('/api/field-reports', fieldReportRoutes);
app.use('/api/fpo-forms', fpoFormRoutes);
app.use('/api/consent', consentRoutes);
app.use('/api/attendance-policy', attendancePolicyRoutes);
app.use('/api/auth', authRoutes); // Auth routes without rate limiting
app.use('/uploads/visit-photos', express.static(require('path').join(__dirname, 'uploads/visit-photos')));

// Error handling middleware
app.use((err, req, res, next) => {
  logger.error('Server error:', { error: err.message, stack: err.stack });
  res.status(500).json({ message: 'Something went wrong!' });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ message: 'Route not found' });
});

// Database connection
mongoose.connect(process.env.MONGODB_URI)
  .then(async () => {
    logger.info('Connected to MongoDB');
    await seedDefaultOffice();
    await initCache();
  })
  .catch(err => logger.error('MongoDB connection error:', { error: err.message }));

const PORT = process.env.PORT || 5000;
app.listen(PORT, '0.0.0.0', () => {
  logger.info(`Server running on port ${PORT}`);
  logger.info(`Local: http://localhost:${PORT}`);
  logger.info(`Network: http://192.168.1.60:${PORT}`);
});