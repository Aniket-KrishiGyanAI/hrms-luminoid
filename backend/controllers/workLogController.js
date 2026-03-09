const WorkLog = require('../models/WorkLog');
const User = require('../models/User');
const ExcelJS = require('exceljs');

exports.createWorkLog = async (req, res) => {
  try {
    const { workDone, hoursSpent, category, date, project } = req.body;
    
    // Check for duplicate
    const logDate = date ? new Date(date) : new Date();
    logDate.setHours(0, 0, 0, 0);
    const nextDay = new Date(logDate);
    nextDay.setDate(nextDay.getDate() + 1);
    
    const existing = await WorkLog.findOne({
      userId: req.user.id,
      date: { $gte: logDate, $lt: nextDay },
      project: project || { $exists: false }
    });
    
    if (existing) {
      return res.status(400).json({ message: 'Work log already exists for this date and project', duplicate: true });
    }
    
    // Prevent future dates
    if (logDate > new Date()) {
      return res.status(400).json({ message: 'Cannot log work for future dates' });
    }
    
    const workLog = new WorkLog({
      userId: req.user.id,
      workDone,
      hoursSpent,
      category: category || 'GENERAL',
      date: logDate
    });
    await workLog.save();
    res.status(201).json(workLog);
  } catch (error) {
    res.status(500).json({ message: 'Error creating work log' });
  }
};

exports.createBulkWorkLog = async (req, res) => {
  try {
    const { logs } = req.body;
    const workLogs = [];
    
    for (const log of logs) {
      const logDate = log.date ? new Date(log.date) : new Date();
      logDate.setHours(0, 0, 0, 0);
      
      // Prevent future dates
      if (logDate > new Date()) {
        return res.status(400).json({ message: 'Cannot log work for future dates' });
      }
      
      workLogs.push({
        userId: req.user.id,
        workDone: log.workDone,
        hoursSpent: log.hoursSpent,
        category: log.category === 'CUSTOM' ? log.customCategory : log.category || 'GENERAL',
        status: log.status || 'COMPLETED',
        project: log.project || '',
        deliverables: log.deliverables || '',
        location: log.location || 'OFFICE',
        issues: log.issues || '',
        templateData: log.templateData || {},
        date: logDate
      });
    }
    
    const created = await WorkLog.insertMany(workLogs);
    res.status(201).json(created);
  } catch (error) {
    res.status(500).json({ message: 'Error creating bulk work logs' });
  }
};

exports.getMyWorkLogs = async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const skip = (page - 1) * limit;
    
    const logs = await WorkLog.find({ userId: req.user.id })
      .sort({ date: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate('comments.userId', 'firstName lastName');
      
    const total = await WorkLog.countDocuments({ userId: req.user.id });
    
    res.json({ logs, total, page: parseInt(page), pages: Math.ceil(total / limit) });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching work logs' });
  }
};

exports.getAllWorkLogs = async (req, res) => {
  try {
    if (!['ADMIN', 'HR', 'MANAGER'].includes(req.user.role)) {
      return res.status(403).json({ message: 'Not authorized' });
    }
    const { startDate, endDate, userId, page = 1, limit = 50 } = req.query;
    const skip = (page - 1) * limit;
    
    let query = {};
    if (startDate && endDate) {
      query.date = { $gte: new Date(startDate), $lte: new Date(endDate) };
    }
    if (userId) query.userId = userId;
    
    const logs = await WorkLog.find(query)
      .populate('userId', 'firstName lastName email department')
      .populate('comments.userId', 'firstName lastName')
      .sort({ date: -1 })
      .skip(skip)
      .limit(parseInt(limit));
      
    const total = await WorkLog.countDocuments(query);
    const stats = {
      totalLogs: total,
      totalHours: logs.reduce((sum, log) => sum + log.hoursSpent, 0),
      completed: logs.filter(l => l.status === 'COMPLETED').length,
      inProgress: logs.filter(l => l.status === 'IN_PROGRESS').length
    };
    
    res.json({ logs, total, stats, page: parseInt(page), pages: Math.ceil(total / limit) });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching work logs' });
  }
};

exports.exportWorkLogs = async (req, res) => {
  try {
    if (!['ADMIN', 'HR', 'MANAGER'].includes(req.user.role)) {
      return res.status(403).json({ message: 'Not authorized' });
    }
    const { startDate, endDate, userId } = req.query;
    let query = {};
    if (startDate && endDate) {
      query.date = { $gte: new Date(startDate), $lte: new Date(endDate) };
    }
    if (userId) query.userId = userId;
    
    const logs = await WorkLog.find(query)
      .populate('userId', 'firstName lastName email department')
      .sort({ date: -1 });

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Work Logs');
    
    worksheet.columns = [
      { header: 'Date', key: 'date', width: 15 },
      { header: 'Employee Name', key: 'name', width: 25 },
      { header: 'Email', key: 'email', width: 30 },
      { header: 'Department', key: 'department', width: 20 },
      { header: 'Project/Client', key: 'project', width: 25 },
      { header: 'Work Done', key: 'workDone', width: 50 },
      { header: 'Deliverables', key: 'deliverables', width: 40 },
      { header: 'Hours', key: 'hours', width: 10 },
      { header: 'Status', key: 'status', width: 15 },
      { header: 'Location', key: 'location', width: 15 },
      { header: 'Category', key: 'category', width: 15 },
      { header: 'Issues/Blockers', key: 'issues', width: 40 }
    ];

    logs.forEach(log => {
      worksheet.addRow({
        date: new Date(log.date).toLocaleDateString('en-GB'),
        name: `${log.userId.firstName} ${log.userId.lastName}`,
        email: log.userId.email,
        department: log.userId.department || 'N/A',
        project: log.project || 'N/A',
        workDone: log.workDone,
        deliverables: log.deliverables || 'N/A',
        hours: log.hoursSpent,
        status: log.status,
        location: log.location,
        category: log.category,
        issues: log.issues || 'N/A'
      });
    });

    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF4472C4' }
    };
    worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=work-logs-${Date.now()}.xlsx`);
    
    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    res.status(500).json({ message: 'Error exporting work logs' });
  }
};

exports.checkTodayLog = async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const log = await WorkLog.findOne({
      userId: req.user.id,
      date: { $gte: today, $lt: tomorrow }
    });
    
    res.json({ hasLoggedToday: !!log });
  } catch (error) {
    res.status(500).json({ message: 'Error checking log' });
  }
};

exports.updateWorkLog = async (req, res) => {
  try {
    const workLog = await WorkLog.findById(req.params.id).populate('userId');
    if (!workLog) {
      return res.status(404).json({ message: 'Work log not found' });
    }
    
    // Check authorization
    const isOwner = workLog.userId._id.toString() === req.user.id;
    const isAdmin = req.user.role === 'ADMIN';
    
    if (!isOwner && !isAdmin) {
      return res.status(403).json({ message: 'Not authorized' });
    }
    
    // If owner, check 24-hour edit window
    if (isOwner && !isAdmin) {
      const hoursSinceCreation = (Date.now() - workLog.createdAt) / (1000 * 60 * 60);
      if (hoursSinceCreation > 24) {
        return res.status(403).json({ message: 'Can only edit work logs within 24 hours' });
      }
    }
    
    // Prevent future dates
    if (req.body.date && new Date(req.body.date) > new Date()) {
      return res.status(400).json({ message: 'Cannot log work for future dates' });
    }
    
    const { date, workDone, hoursSpent, status, project, deliverables, location, issues, category, templateData } = req.body;
    const updated = await WorkLog.findByIdAndUpdate(
      req.params.id,
      { date, workDone, hoursSpent, status, project, deliverables, location, issues, category, templateData },
      { new: true }
    ).populate('comments.userId', 'firstName lastName');
    
    res.json(updated);
  } catch (error) {
    res.status(500).json({ message: 'Error updating work log' });
  }
};

exports.deleteWorkLog = async (req, res) => {
  try {
    const workLog = await WorkLog.findById(req.params.id);
    if (!workLog) {
      return res.status(404).json({ message: 'Work log not found' });
    }
    
    // Check authorization
    const isOwner = workLog.userId.toString() === req.user.id;
    const isAdmin = req.user.role === 'ADMIN';
    
    if (!isOwner && !isAdmin) {
      return res.status(403).json({ message: 'Not authorized' });
    }
    
    // If owner, check 24-hour delete window
    if (isOwner && !isAdmin) {
      const hoursSinceCreation = (Date.now() - workLog.createdAt) / (1000 * 60 * 60);
      if (hoursSinceCreation > 24) {
        return res.status(403).json({ message: 'Can only delete work logs within 24 hours' });
      }
    }
    
    await WorkLog.findByIdAndDelete(req.params.id);
    res.json({ message: 'Work log deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting work log' });
  }
};

exports.addComment = async (req, res) => {
  try {
    if (!['ADMIN', 'HR', 'MANAGER'].includes(req.user.role)) {
      return res.status(403).json({ message: 'Not authorized' });
    }
    
    const { text } = req.body;
    const workLog = await WorkLog.findByIdAndUpdate(
      req.params.id,
      { $push: { comments: { userId: req.user.id, text } } },
      { new: true }
    ).populate('comments.userId', 'firstName lastName');
    
    if (!workLog) {
      return res.status(404).json({ message: 'Work log not found' });
    }
    
    res.json(workLog);
  } catch (error) {
    res.status(500).json({ message: 'Error adding comment' });
  }
};

exports.getWorkLogById = async (req, res) => {
  try {
    const workLog = await WorkLog.findById(req.params.id)
      .populate('userId', 'firstName lastName email department')
      .populate('comments.userId', 'firstName lastName');
      
    if (!workLog) {
      return res.status(404).json({ message: 'Work log not found' });
    }
    
    // Check authorization
    const isOwner = workLog.userId._id.toString() === req.user.id;
    const isManager = ['ADMIN', 'HR', 'MANAGER'].includes(req.user.role);
    
    if (!isOwner && !isManager) {
      return res.status(403).json({ message: 'Not authorized' });
    }
    
    res.json(workLog);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching work log' });
  }
};
