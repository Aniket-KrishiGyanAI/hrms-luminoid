const FieldReport = require('../models/FieldReport');
const FieldVisit = require('../models/FieldVisit');
const VisitPlan = require('../models/VisitPlan');
const logger = require('../utils/logger');

// Core report generation logic — reused by cron and on-demand
const generateDailyReport = async (employeeId, date) => {
  const start = new Date(date); start.setHours(0, 0, 0, 0);
  const end = new Date(date); end.setHours(23, 59, 59, 999);

  const visits = await FieldVisit.find({
    employeeId,
    visitDate: { $gte: start, $lte: end }
  });

  const plan = await VisitPlan.findOne({ employeeId, date: { $gte: start, $lte: end } });

  const outcomeSummary = {
    ORDER_RECEIVED: 0, POSITIVE: 0, NEUTRAL: 0, NEGATIVE: 0,
    DEMO_SCHEDULED: 0, PROPOSAL_SENT: 0, NO_RESPONSE: 0
  };
  let totalDistanceKm = 0;
  let totalDurationMinutes = 0;
  let totalDealValue = 0;
  let totalCompleted = 0;

  for (const v of visits) {
    if (v.status === 'COMPLETED') {
      totalCompleted++;
      totalDistanceKm += v.totalDistanceKm || 0;
      totalDurationMinutes += v.durationMinutes || 0;
      if (v.outcome?.status) outcomeSummary[v.outcome.status] = (outcomeSummary[v.outcome.status] || 0) + 1;
      if (v.outcome?.dealValue) totalDealValue += v.outcome.dealValue;
    }
  }

  const reportData = {
    employeeId,
    date: start,
    totalPlanned: plan ? plan.clients.length : visits.length,
    totalVisited: visits.filter(v => v.status !== 'PLANNED').length,
    totalCompleted,
    totalDistanceKm: Math.round(totalDistanceKm * 100) / 100,
    totalDurationMinutes,
    outcomeSummary,
    totalDealValue,
    visits: visits.map(v => v._id),
    generatedAt: new Date()
  };

  // Upsert — replace if already exists for that day
  return FieldReport.findOneAndUpdate(
    { employeeId, date: start },
    reportData,
    { upsert: true, new: true }
  );
};

exports.generateDailyReport = generateDailyReport;

exports.getMyReports = async (req, res) => {
  try {
    logger.info('getMyReports', { userId: req.user?.id });
    const { startDate, endDate } = req.query;
    const filter = { employeeId: req.user.id };
    if (startDate || endDate) {
      filter.date = {};
      if (startDate) filter.date.$gte = new Date(startDate);
      if (endDate) filter.date.$lte = new Date(endDate);
    }
    const reports = await FieldReport.find(filter)
      .populate('visits', 'clientId status outcome totalDistanceKm durationMinutes checkIn checkOut')
      .sort('-date');
    res.json(reports);
  } catch (error) {
    logger.error('getMyReports error', { error: error.message, stack: error.stack, userId: req.user?.id });

    res.status(500).json({ message: error.message });
  }
};

exports.getReports = async (req, res) => {
  try {
    logger.info('getReports', { userId: req.user?.id });
    const { employeeId, startDate, endDate } = req.query;
    const filter = {};
    if (employeeId) filter.employeeId = employeeId;

    const start = startDate ? new Date(startDate) : new Date();
    const end = endDate ? new Date(endDate) : new Date();
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);
    filter.date = { $gte: start, $lte: end };

    // Find employees who have visits in this range but no report yet
    const visitFilter = { visitDate: { $gte: start, $lte: end } };
    if (employeeId) visitFilter.employeeId = employeeId;

    const visitsInRange = await FieldVisit.distinct('employeeId', visitFilter);
    const existingReports = await FieldReport.distinct('employeeId', filter);
    const existingIds = existingReports.map(id => id.toString());

    // Generate missing reports on-demand for each day in range
    const missing = visitsInRange.filter(id => !existingIds.includes(id.toString()));
    if (missing.length > 0) {
      const dateStr = startDate || new Date().toISOString().split('T')[0];
      await Promise.all(missing.map(empId => generateDailyReport(empId, dateStr)));
    }

    const reports = await FieldReport.find(filter)
      .populate('employeeId', 'firstName lastName department')
      .populate('visits', 'clientId status outcome totalDistanceKm durationMinutes')
      .sort('-date');
    res.json(reports);
  } catch (error) {
    logger.error('getReports error', { error: error.message, stack: error.stack, userId: req.user?.id });

    res.status(500).json({ message: error.message });
  }
};

exports.getDailyReport = async (req, res) => {
  try {
    logger.info('getDailyReport', { userId: req.user?.id });
    const { date, employeeId } = req.params;
    const targetEmployee = employeeId || req.user.id;
    const start = new Date(date); start.setHours(0, 0, 0, 0);

    let report = await FieldReport.findOne({ employeeId: targetEmployee, date: start })
      .populate('employeeId', 'firstName lastName department')
      .populate({ path: 'visits', populate: { path: 'clientId', select: 'name contactPerson phone' } });

    // Generate on-demand if not yet created
    if (!report) {
      report = await generateDailyReport(targetEmployee, date);
      report = await FieldReport.findById(report._id)
        .populate('employeeId', 'firstName lastName department')
        .populate({ path: 'visits', populate: { path: 'clientId', select: 'name contactPerson phone' } });
    }

    res.json(report);
  } catch (error) {
    logger.error('getDailyReport error', { error: error.message, stack: error.stack, userId: req.user?.id });

    res.status(500).json({ message: error.message });
  }
};

exports.getTeamSummary = async (req, res) => {
  try {
    logger.info('getTeamSummary', { userId: req.user?.id });
    const { date } = req.query;
    const start = new Date(date || new Date()); start.setHours(0, 0, 0, 0);
    const end = new Date(date || new Date()); end.setHours(23, 59, 59, 999);

    let employeeFilter = {};
    if (req.user.role === 'MANAGER') {
      const User = require('../models/User');
      const team = await User.find({ managerId: req.user.id }).select('_id');
      employeeFilter = { employeeId: { $in: team.map(u => u._id) } };
    }

    const reports = await FieldReport.find({ ...employeeFilter, date: { $gte: start, $lte: end } })
      .populate('employeeId', 'firstName lastName department');
    res.json(reports);
  } catch (error) {
    logger.error('getTeamSummary error', { error: error.message, stack: error.stack, userId: req.user?.id });

    res.status(500).json({ message: error.message });
  }
};

exports.getMonthlyStats = async (req, res) => {
  try {
    logger.info('getMonthlyStats', { userId: req.user?.id });
    const { month, year, employeeId } = req.query;
    const targetYear = parseInt(year) || new Date().getFullYear();
    const targetMonth = parseInt(month) || new Date().getMonth() + 1;
    
    const start = new Date(targetYear, targetMonth - 1, 1);
    const end = new Date(targetYear, targetMonth, 0, 23, 59, 59, 999);
    
    const filter = { date: { $gte: start, $lte: end } };
    if (employeeId) filter.employeeId = employeeId;
    
    const reports = await FieldReport.find(filter)
      .populate('employeeId', 'firstName lastName department');
    
    const summary = {
      totalVisits: 0,
      totalCompleted: 0,
      totalOrders: 0,
      totalDealValue: 0,
      totalDistance: 0,
      totalDuration: 0,
      employeeStats: {}
    };
    
    reports.forEach(r => {
      summary.totalVisits += r.totalVisited;
      summary.totalCompleted += r.totalCompleted;
      summary.totalOrders += r.outcomeSummary?.ORDER_RECEIVED || 0;
      summary.totalDealValue += r.totalDealValue;
      summary.totalDistance += r.totalDistanceKm;
      summary.totalDuration += r.totalDurationMinutes;
      
      const empId = r.employeeId._id.toString();
      if (!summary.employeeStats[empId]) {
        summary.employeeStats[empId] = {
          name: `${r.employeeId.firstName} ${r.employeeId.lastName}`,
          department: r.employeeId.department,
          visits: 0,
          completed: 0,
          orders: 0,
          dealValue: 0
        };
      }
      summary.employeeStats[empId].visits += r.totalVisited;
      summary.employeeStats[empId].completed += r.totalCompleted;
      summary.employeeStats[empId].orders += r.outcomeSummary?.ORDER_RECEIVED || 0;
      summary.employeeStats[empId].dealValue += r.totalDealValue;
    });
    
    res.json(summary);
  } catch (error) {
    logger.error('getMonthlyStats error', { error: error.message, stack: error.stack, userId: req.user?.id });

    res.status(500).json({ message: error.message });
  }
};
