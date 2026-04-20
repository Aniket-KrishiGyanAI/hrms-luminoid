const Expense = require("../models/Expense");
const logger = require('../utils/logger');

const getExpenseAnalytics = async (req, res) => {
  try {
    const { billingMonth, startMonth, endMonth } = req.query;
    let query = {};
    
    // Role-based filtering
    if (req.user.role === "EMPLOYEE") {
      query.employeeId = req.user.id;
    } else if (req.user.role === "MANAGER") {
      // Managers can only see their team's expenses
      const teamMembers = await User.find({ managerId: req.user.id }).select('_id');
      const teamMemberIds = teamMembers.map(m => m._id);
      query.employeeId = { $in: [...teamMemberIds, req.user.id] };
    }
    // HR and ADMIN can see all expenses

    // Date range filter
    if (startMonth && endMonth) {
      query.billingMonth = { $gte: startMonth, $lte: endMonth };
    } else if (billingMonth) {
      query.billingMonth = billingMonth;
    }

    const expenses = await Expense.find(query)
      .populate('employeeId', 'firstName lastName department')
      .sort({ billingMonth: -1, expenseDate: -1 });

    // Initialize stats objects
    const categoryStats = {};
    const statusStats = { SUBMITTED: 0, APPROVED: 0, REJECTED: 0, REIMBURSED: 0 };
    const departmentStats = {};
    const employeeStats = {};
    const monthlyTrends = {};

    let totalAmount = 0;
    let approvedAmount = 0;
    let pendingAmount = 0;
    let reimbursedAmount = 0;
    let rejectedAmount = 0;

    expenses.forEach(exp => {
      const cat = exp.category || 'OTHER';
      const status = exp.status;
      const month = exp.billingMonth;
      const dept = exp.employeeId?.department || 'Unknown';
      const empId = exp.employeeId?._id?.toString();
      const empName = exp.employeeId ? `${exp.employeeId.firstName} ${exp.employeeId.lastName}` : 'Unknown';

      // Category stats
      if (!categoryStats[cat]) categoryStats[cat] = { count: 0, amount: 0 };
      categoryStats[cat].count++;
      categoryStats[cat].amount += exp.amount || 0;

      // Status stats
      statusStats[status] = (statusStats[status] || 0) + 1;

      // Amount breakdown
      totalAmount += exp.amount || 0;
      if (status === 'APPROVED') approvedAmount += exp.amount || 0;
      if (status === 'SUBMITTED') pendingAmount += exp.amount || 0;
      if (status === 'REIMBURSED') reimbursedAmount += exp.amount || 0;
      if (status === 'REJECTED') rejectedAmount += exp.amount || 0;

      // Department stats (only for non-employees)
      if (req.user.role !== 'EMPLOYEE' && req.user.role !== 'MANAGER') {
        if (!departmentStats[dept]) departmentStats[dept] = { count: 0, amount: 0 };
        departmentStats[dept].count++;
        departmentStats[dept].amount += exp.amount || 0;

        // Employee stats
        if (empId) {
          if (!employeeStats[empId]) {
            employeeStats[empId] = { 
              name: empName, 
              count: 0, 
              amount: 0, 
              department: dept 
            };
          }
          employeeStats[empId].count++;
          employeeStats[empId].amount += exp.amount || 0;
        }
      }

      // Monthly trends
      if (month) {
        if (!monthlyTrends[month]) monthlyTrends[month] = { count: 0, amount: 0 };
        monthlyTrends[month].count++;
        monthlyTrends[month].amount += exp.amount || 0;
      }
    });

    // Format response
    const response = {
      summary: {
        totalExpenses: expenses.length,
        totalAmount: parseFloat(totalAmount.toFixed(2)),
        approvedAmount: parseFloat(approvedAmount.toFixed(2)),
        pendingAmount: parseFloat(pendingAmount.toFixed(2)),
        reimbursedAmount: parseFloat(reimbursedAmount.toFixed(2)),
        rejectedAmount: parseFloat(rejectedAmount.toFixed(2)),
        statusBreakdown: statusStats,
      },
      categoryStats: Object.entries(categoryStats)
        .map(([category, data]) => ({ 
          category, 
          count: data.count,
          amount: parseFloat(data.amount.toFixed(2))
        }))
        .sort((a, b) => b.amount - a.amount),
      departmentStats: Object.entries(departmentStats)
        .map(([department, data]) => ({ 
          department, 
          count: data.count,
          amount: parseFloat(data.amount.toFixed(2))
        }))
        .sort((a, b) => b.amount - a.amount),
      employeeStats: Object.values(employeeStats)
        .map(emp => ({
          ...emp,
          amount: parseFloat(emp.amount.toFixed(2))
        }))
        .sort((a, b) => b.amount - a.amount)
        .slice(0, 10),
      monthlyTrends: Object.entries(monthlyTrends)
        .map(([month, data]) => ({ 
          month, 
          count: data.count,
          amount: parseFloat(data.amount.toFixed(2))
        }))
        .sort((a, b) => a.month.localeCompare(b.month)),
    };

    res.json(response);
  } catch (error) {
    console.error('Analytics error:', error);
    res.status(500).json({ 
      message: 'Failed to fetch analytics', 
      error: error.message 
    });
  }
};

module.exports = { getExpenseAnalytics };
