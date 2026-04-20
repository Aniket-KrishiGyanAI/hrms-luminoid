import React, { useState, useEffect } from 'react';
import api from '../utils/api';
import * as XLSX from 'xlsx';
import './ExpenseAnalytics.css';

const ExpenseAnalytics = ({ selectedMonth, expenses, onMonthChange }) => {
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState('current');
  const [budgetLimit, setBudgetLimit] = useState(localStorage.getItem('expenseBudgetLimit') || '');
  const [showBudgetModal, setShowBudgetModal] = useState(false);

  useEffect(() => {
    fetchAnalytics();
  }, [selectedMonth, dateRange]);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      let params = {};
      
      if (dateRange === 'current') {
        params.billingMonth = selectedMonth;
      } else if (dateRange === 'last3') {
        const [year, month] = selectedMonth.split('-');
        const endDate = new Date(year, month - 1);
        const startDate = new Date(year, month - 4);
        params.startMonth = `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, '0')}`;
        params.endMonth = selectedMonth;
      } else if (dateRange === 'last6') {
        const [year, month] = selectedMonth.split('-');
        const endDate = new Date(year, month - 1);
        const startDate = new Date(year, month - 7);
        params.startMonth = `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, '0')}`;
        params.endMonth = selectedMonth;
      }

      const response = await api.get('/api/expenses/analytics', { params });
      setAnalytics(response.data);
    } catch (error) {
      console.error('Error fetching analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  const exportToExcel = () => {
    if (!analytics) return;

    const wb = XLSX.utils.book_new();

    // Summary sheet
    const summaryData = [
      ['EXPENSE REPORT SUMMARY'],
      [''],
      ['Report Details'],
      ['Period', dateRange === 'current' ? selectedMonth : `Last ${dateRange === 'last3' ? '3' : '6'} months ending ${selectedMonth}`],
      ['Generated On', new Date().toLocaleString('en-IN')],
      [''],
      ['Financial Summary'],
      ['Total Expenses', analytics.summary.totalExpenses],
      ['Total Amount', analytics.summary.totalAmount],
      ['Approved Amount', analytics.summary.approvedAmount],
      ['Pending Amount', analytics.summary.pendingAmount],
      ['Reimbursed Amount', analytics.summary.reimbursedAmount],
      [''],
      ['Status Breakdown'],
      ['Submitted', analytics.summary.statusBreakdown.SUBMITTED],
      ['Approved', analytics.summary.statusBreakdown.APPROVED],
      ['Rejected', analytics.summary.statusBreakdown.REJECTED],
      ['Reimbursed', analytics.summary.statusBreakdown.REIMBURSED],
    ];
    const summaryWs = XLSX.utils.aoa_to_sheet(summaryData);
    summaryWs['!cols'] = [{ width: 25 }, { width: 20 }];
    XLSX.utils.book_append_sheet(wb, summaryWs, 'Summary');

    // Category breakdown
    const categoryData = [
      ['CATEGORY-WISE SPENDING ANALYSIS'],
      [''],
      ['Category', 'Number of Expenses', 'Total Amount (₹)', 'Percentage'],
    ];
    const totalCategoryAmount = analytics.categoryStats.reduce((sum, c) => sum + c.amount, 0);
    analytics.categoryStats.forEach(c => {
      const percentage = ((c.amount / totalCategoryAmount) * 100).toFixed(2);
      categoryData.push([c.category, c.count, c.amount, `${percentage}%`]);
    });
    categoryData.push(['']);
    categoryData.push(['TOTAL', analytics.categoryStats.reduce((sum, c) => sum + c.count, 0), totalCategoryAmount, '100%']);
    
    const categoryWs = XLSX.utils.aoa_to_sheet(categoryData);
    categoryWs['!cols'] = [{ width: 20 }, { width: 20 }, { width: 18 }, { width: 15 }];
    XLSX.utils.book_append_sheet(wb, categoryWs, 'Category Analysis');

    // Department breakdown (if available)
    if (analytics.departmentStats?.length > 0) {
      const deptData = [
        ['DEPARTMENT-WISE SPENDING ANALYSIS'],
        [''],
        ['Department', 'Number of Expenses', 'Total Amount (₹)', 'Percentage'],
      ];
      const totalDeptAmount = analytics.departmentStats.reduce((sum, d) => sum + d.amount, 0);
      analytics.departmentStats.forEach(d => {
        const percentage = ((d.amount / totalDeptAmount) * 100).toFixed(2);
        deptData.push([d.department, d.count, d.amount, `${percentage}%`]);
      });
      deptData.push(['']);
      deptData.push(['TOTAL', analytics.departmentStats.reduce((sum, d) => sum + d.count, 0), totalDeptAmount, '100%']);
      
      const deptWs = XLSX.utils.aoa_to_sheet(deptData);
      deptWs['!cols'] = [{ width: 25 }, { width: 20 }, { width: 18 }, { width: 15 }];
      XLSX.utils.book_append_sheet(wb, deptWs, 'Department Analysis');
    }

    // Employee breakdown (if available)
    if (analytics.employeeStats?.length > 0) {
      const empData = [
        ['TOP EMPLOYEES BY SPENDING'],
        [''],
        ['Rank', 'Employee Name', 'Department', 'Number of Expenses', 'Total Amount (₹)', 'Average per Expense (₹)'],
      ];
      analytics.employeeStats.forEach((e, idx) => {
        const avgAmount = (e.amount / e.count).toFixed(2);
        empData.push([idx + 1, e.name, e.department, e.count, e.amount, avgAmount]);
      });
      empData.push(['']);
      empData.push(['TOTAL', '', '', 
        analytics.employeeStats.reduce((sum, e) => sum + e.count, 0),
        analytics.employeeStats.reduce((sum, e) => sum + e.amount, 0),
        ''
      ]);
      
      const empWs = XLSX.utils.aoa_to_sheet(empData);
      empWs['!cols'] = [{ width: 8 }, { width: 25 }, { width: 20 }, { width: 20 }, { width: 18 }, { width: 22 }];
      XLSX.utils.book_append_sheet(wb, empWs, 'Employee Analysis');
    }

    // Monthly trends
    if (analytics.monthlyTrends?.length > 0) {
      const trendData = [
        ['MONTHLY SPENDING TRENDS'],
        [''],
        ['Month', 'Number of Expenses', 'Total Amount (₹)', 'Average per Expense (₹)'],
      ];
      analytics.monthlyTrends.forEach(t => {
        const avgAmount = (t.amount / t.count).toFixed(2);
        const [year, month] = t.month.split('-');
        const monthName = new Date(year, month - 1).toLocaleString('default', { month: 'long', year: 'numeric' });
        trendData.push([monthName, t.count, t.amount, avgAmount]);
      });
      trendData.push(['']);
      trendData.push(['TOTAL', 
        analytics.monthlyTrends.reduce((sum, t) => sum + t.count, 0),
        analytics.monthlyTrends.reduce((sum, t) => sum + t.amount, 0),
        ''
      ]);
      
      const trendWs = XLSX.utils.aoa_to_sheet(trendData);
      trendWs['!cols'] = [{ width: 25 }, { width: 20 }, { width: 18 }, { width: 22 }];
      XLSX.utils.book_append_sheet(wb, trendWs, 'Monthly Trends');
    }

    // Detailed expense list
    if (expenses && expenses.length > 0) {
      const expenseData = [
        ['DETAILED EXPENSE LIST'],
        [''],
        ['Date', 'Title', 'Category', 'Amount (₹)', 'Status', 'Employee', 'Department', 'Description'],
      ];
      expenses.forEach(exp => {
        const date = new Date(exp.expenseDate).toLocaleDateString('en-IN');
        const employee = exp.employeeId ? `${exp.employeeId.firstName} ${exp.employeeId.lastName}` : 'N/A';
        const department = exp.employeeId?.department || 'N/A';
        expenseData.push([
          date,
          exp.title,
          exp.category,
          exp.amount,
          exp.status,
          employee,
          department,
          exp.description || ''
        ]);
      });
      expenseData.push(['']);
      expenseData.push(['TOTAL', '', '', expenses.reduce((sum, e) => sum + e.amount, 0), '', '', '', '']);
      
      const expenseWs = XLSX.utils.aoa_to_sheet(expenseData);
      expenseWs['!cols'] = [{ width: 12 }, { width: 25 }, { width: 18 }, { width: 15 }, { width: 12 }, { width: 20 }, { width: 18 }, { width: 35 }];
      XLSX.utils.book_append_sheet(wb, expenseWs, 'Detailed Expenses');
    }

    // Budget tracking (if set)
    if (budgetLimitNum > 0) {
      const budgetData = [
        ['BUDGET TRACKING'],
        [''],
        ['Budget Limit', budgetLimitNum],
        ['Total Spent', analytics.summary.totalAmount],
        ['Remaining', budgetLimitNum - analytics.summary.totalAmount],
        ['Utilization %', budgetUsed.toFixed(2) + '%'],
        [''],
        ['Status', budgetUsed > 100 ? 'OVER BUDGET' : budgetUsed > 80 ? 'WARNING' : 'ON TRACK'],
      ];
      
      const budgetWs = XLSX.utils.aoa_to_sheet(budgetData);
      budgetWs['!cols'] = [{ width: 20 }, { width: 20 }];
      XLSX.utils.book_append_sheet(wb, budgetWs, 'Budget Tracking');
    }

    const fileName = `Expense_Report_${selectedMonth}_${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(wb, fileName);
  };

  const exportToPDF = () => {
    window.print();
  };

  const saveBudgetLimit = () => {
    localStorage.setItem('expenseBudgetLimit', budgetLimit);
    setShowBudgetModal(false);
  };

  if (loading) {
    return <div className="analytics-loading"><div className="spinner-border"></div></div>;
  }

  if (!analytics) return null;

  const maxCategoryAmount = Math.max(...analytics.categoryStats.map(c => c.amount), 1);
  const maxDeptAmount = analytics.departmentStats?.length > 0 ? Math.max(...analytics.departmentStats.map(d => d.amount), 1) : 1;
  const budgetLimitNum = parseFloat(budgetLimit) || 0;
  const budgetUsed = budgetLimitNum > 0 ? (analytics.summary.totalAmount / budgetLimitNum) * 100 : 0;

  return (
    <div className="expense-analytics">
      <div className="analytics-header">
        <div className="analytics-title">
          <i className="fas fa-chart-line"></i>
          <h2>Analytics & Reports</h2>
        </div>
        <div className="analytics-actions">
          <input 
            type="month" 
            value={selectedMonth}
            onChange={(e) => {
              if (onMonthChange) {
                onMonthChange(e.target.value);
              }
              setDateRange('current');
            }}
            className="month-picker-input"
          />
          <select value={dateRange} onChange={(e) => setDateRange(e.target.value)} className="date-range-select">
            <option value="current">Current Selection</option>
            <option value="last3">Last 3 Months</option>
            <option value="last6">Last 6 Months</option>
          </select>
          <button onClick={() => setShowBudgetModal(true)} className="btn-budget">
            <i className="fas fa-wallet"></i> Budget
          </button>
          <button onClick={exportToExcel} className="btn-export">
            <i className="fas fa-file-excel"></i> Excel
          </button>
        </div>
      </div>

      {/* Budget Tracker */}
      {budgetLimitNum > 0 && (
        <div className="budget-tracker">
          <div className="budget-header">
            <span className="budget-label">Budget Tracking</span>
            <span className="budget-amount">₹{analytics.summary.totalAmount.toLocaleString('en-IN')} / ₹{budgetLimitNum.toLocaleString('en-IN')}</span>
          </div>
          <div className="budget-bar">
            <div 
              className={`budget-fill ${budgetUsed > 100 ? 'over-budget' : budgetUsed > 80 ? 'warning' : ''}`}
              style={{ width: `${Math.min(budgetUsed, 100)}%` }}
            ></div>
          </div>
          <div className="budget-status">
            {budgetUsed > 100 ? (
              <span className="over-budget-text">
                <i className="fas fa-exclamation-triangle"></i> Over budget by ₹{(analytics.summary.totalAmount - budgetLimitNum).toLocaleString('en-IN')}
              </span>
            ) : (
              <span className="under-budget-text">
                {budgetUsed > 80 ? <i className="fas fa-exclamation-circle"></i> : <i className="fas fa-check-circle"></i>}
                {' '}{budgetUsed.toFixed(1)}% used • ₹{(budgetLimitNum - analytics.summary.totalAmount).toLocaleString('en-IN')} remaining
              </span>
            )}
          </div>
        </div>
      )}

      {/* Summary Cards */}
      <div className="analytics-summary">
        <div className="summary-card-analytics">
          <div className="summary-icon" style={{ background: '#dbeafe' }}>
            <i className="fas fa-coins" style={{ color: '#1d4ed8' }}></i>
          </div>
          <div className="summary-details">
            <span className="summary-label" style={{ color: '#64748b' }}>Total Spent</span>
            <span className="summary-value" style={{ color: '#1d4ed8' }}>₹{analytics.summary.totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
          </div>
        </div>
        <div className="summary-card-analytics">
          <div className="summary-icon" style={{ background: '#d1fae5' }}>
            <i className="fas fa-check-double" style={{ color: '#059669' }}></i>
          </div>
          <div className="summary-details">
            <span className="summary-label" style={{ color: '#64748b' }}>Approved</span>
            <span className="summary-value" style={{ color: '#059669' }}>₹{analytics.summary.approvedAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
          </div>
        </div>
        <div className="summary-card-analytics">
          <div className="summary-icon" style={{ background: '#fef3c7' }}>
            <i className="fas fa-clock" style={{ color: '#d97706' }}></i>
          </div>
          <div className="summary-details">
            <span className="summary-label" style={{ color: '#64748b' }}>Pending</span>
            <span className="summary-value" style={{ color: '#d97706' }}>₹{analytics.summary.pendingAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
          </div>
        </div>
        <div className="summary-card-analytics">
          <div className="summary-icon" style={{ background: '#ddd6fe' }}>
            <i className="fas fa-money-bill-wave" style={{ color: '#7c3aed' }}></i>
          </div>
          <div className="summary-details">
            <span className="summary-label" style={{ color: '#64748b' }}>Reimbursed</span>
            <span className="summary-value" style={{ color: '#7c3aed' }}>₹{analytics.summary.reimbursedAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
          </div>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="charts-grid">
        {/* Category Chart */}
        <div className="chart-card">
          <div className="chart-header">
            <h3><i className="fas fa-layer-group"></i> Category-wise Spending</h3>
          </div>
          <div className="chart-body">
            <div className="pie-chart-container">
              <svg viewBox="0 0 200 200" className="pie-chart">
                {(() => {
                  const total = analytics.categoryStats.reduce((sum, cat) => sum + cat.amount, 0);
                  let currentAngle = 0;
                  const colors = ['#667eea', '#f093fb', '#4facfe', '#43e97b', '#fa709a', '#feca57', '#ff6348'];
                  
                  return analytics.categoryStats.map((cat, idx) => {
                    const percentage = (cat.amount / total) * 100;
                    const angle = (percentage / 100) * 360;
                    const startAngle = currentAngle;
                    const endAngle = currentAngle + angle;
                    
                    const startRad = (startAngle - 90) * (Math.PI / 180);
                    const endRad = (endAngle - 90) * (Math.PI / 180);
                    
                    const x1 = 100 + 80 * Math.cos(startRad);
                    const y1 = 100 + 80 * Math.sin(startRad);
                    const x2 = 100 + 80 * Math.cos(endRad);
                    const y2 = 100 + 80 * Math.sin(endRad);
                    
                    const largeArc = angle > 180 ? 1 : 0;
                    const path = `M 100 100 L ${x1} ${y1} A 80 80 0 ${largeArc} 1 ${x2} ${y2} Z`;
                    
                    currentAngle = endAngle;
                    
                    return (
                      <g key={idx}>
                        <path
                          d={path}
                          fill={colors[idx % colors.length]}
                          className="pie-slice"
                        />
                      </g>
                    );
                  });
                })()}
              </svg>
              <div className="pie-legend">
                {analytics.categoryStats.map((cat, idx) => {
                  const colors = ['#667eea', '#f093fb', '#4facfe', '#43e97b', '#fa709a', '#feca57', '#ff6348'];
                  const total = analytics.categoryStats.reduce((sum, c) => sum + c.amount, 0);
                  const percentage = ((cat.amount / total) * 100).toFixed(1);
                  
                  return (
                    <div key={idx} className="legend-item">
                      <span className="legend-color" style={{ background: colors[idx % colors.length] }}></span>
                      <span className="legend-label">{cat.category}</span>
                      <span className="legend-value">₹{cat.amount.toLocaleString('en-IN')}</span>
                      <span className="legend-percent">({percentage}%)</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Department Chart */}
        {analytics.departmentStats?.length > 0 && (
          <div className="chart-card">
            <div className="chart-header">
              <h3><i className="fas fa-building"></i> Department Comparison</h3>
            </div>
            <div className="chart-body">
              {/* Line Graph */}
              <div className="line-chart-container">
                <svg viewBox="0 0 400 200" className="line-chart">
                  {/* Grid lines */}
                  <line x1="40" y1="20" x2="40" y2="160" stroke="#e5e7eb" strokeWidth="2" />
                  <line x1="40" y1="160" x2="380" y2="160" stroke="#e5e7eb" strokeWidth="2" />
                  
                  {/* Horizontal grid lines */}
                  {[0, 1, 2, 3, 4].map((i) => (
                    <line 
                      key={i}
                      x1="40" 
                      y1={20 + (i * 35)} 
                      x2="380" 
                      y2={20 + (i * 35)} 
                      stroke="#f3f4f6" 
                      strokeWidth="1" 
                      strokeDasharray="4,4"
                    />
                  ))}
                  
                  {(() => {
                    const maxAmount = Math.max(...analytics.departmentStats.map(d => d.amount), 1);
                    const points = analytics.departmentStats.map((dept, idx) => {
                      const x = 60 + (idx * (300 / (analytics.departmentStats.length - 1 || 1)));
                      const y = 160 - ((dept.amount / maxAmount) * 130);
                      return { x, y, dept };
                    });
                    
                    const pathData = points.map((p, i) => 
                      `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`
                    ).join(' ');
                    
                    return (
                      <>
                        {/* Line path */}
                        <path
                          d={pathData}
                          fill="none"
                          stroke="url(#lineGradient)"
                          strokeWidth="3"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                        
                        {/* Area under line */}
                        <path
                          d={`${pathData} L ${points[points.length - 1].x} 160 L ${points[0].x} 160 Z`}
                          fill="url(#areaGradient)"
                          opacity="0.3"
                        />
                        
                        {/* Data points */}
                        {points.map((p, idx) => (
                          <g key={idx}>
                            <circle
                              cx={p.x}
                              cy={p.y}
                              r="6"
                              fill="white"
                              stroke="#10b981"
                              strokeWidth="3"
                              className="line-point"
                            />
                            {/* Department label */}
                            <text
                              x={p.x}
                              y="180"
                              textAnchor="middle"
                              fontSize="11"
                              fontWeight="600"
                              fill="#6b7280"
                            >
                              {p.dept.department.length > 8 ? p.dept.department.substring(0, 8) + '...' : p.dept.department}
                            </text>
                            {/* Amount tooltip */}
                            <g className="line-tooltip" opacity="0">
                              <rect
                                x={p.x - 35}
                                y={p.y - 35}
                                width="70"
                                height="25"
                                rx="4"
                                fill="#1f2937"
                              />
                              <text
                                x={p.x}
                                y={p.y - 17}
                                textAnchor="middle"
                                fontSize="11"
                                fontWeight="600"
                                fill="white"
                              >
                                ₹{p.dept.amount.toLocaleString('en-IN')}
                              </text>
                            </g>
                          </g>
                        ))}
                        
                        {/* Gradients */}
                        <defs>
                          <linearGradient id="lineGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                            <stop offset="0%" stopColor="#10b981" />
                            <stop offset="100%" stopColor="#059669" />
                          </linearGradient>
                          <linearGradient id="areaGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                            <stop offset="0%" stopColor="#10b981" />
                            <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
                          </linearGradient>
                        </defs>
                      </>
                    );
                  })()}
                </svg>
              </div>
              
              {/* Bar Chart */}
              <div style={{ marginTop: '2rem' }}>
                {analytics.departmentStats.map((dept, idx) => {
                  const colors = [
                    { bg: 'linear-gradient(135deg, #2563eb 0%, #1e40af 100%)', shadow: 'rgba(37, 99, 235, 0.25)' },
                    { bg: 'linear-gradient(135deg, #059669 0%, #047857 100%)', shadow: 'rgba(5, 150, 105, 0.25)' },
                    { bg: 'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)', shadow: 'rgba(220, 38, 38, 0.25)' },
                    { bg: 'linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)', shadow: 'rgba(124, 58, 237, 0.25)' },
                    { bg: 'linear-gradient(135deg, #ea580c 0%, #c2410c 100%)', shadow: 'rgba(234, 88, 12, 0.25)' },
                    { bg: 'linear-gradient(135deg, #0891b2 0%, #0e7490 100%)', shadow: 'rgba(8, 145, 178, 0.25)' },
                  ];
                  const color = colors[idx % colors.length];
                  
                  return (
                  <div key={idx} className="chart-bar-item">
                    <div className="chart-bar-label">
                      <span>{dept.department}</span>
                      <span className="chart-bar-value">₹{dept.amount.toLocaleString('en-IN')}</span>
                    </div>
                    <div className="chart-bar-track">
                      <div 
                        className="chart-bar-fill"
                        style={{ 
                          width: `${(dept.amount / maxDeptAmount) * 100}%`,
                          background: color.bg,
                          boxShadow: `0 4px 12px ${color.shadow}`
                        }}
                      ></div>
                    </div>
                    <span className="chart-bar-count">{dept.count} expenses</span>
                  </div>
                );})}
              </div>
            </div>
          </div>
        )}

        {/* Monthly Trends */}
        {analytics.monthlyTrends?.length > 1 && (
          <div className="chart-card full-width">
            <div className="chart-header">
              <h3><i className="fas fa-chart-area"></i> Monthly Trends</h3>
            </div>
            <div className="chart-body">
              <div className="trend-chart">
                {analytics.monthlyTrends.map((trend, idx) => {
                  const maxTrend = Math.max(...analytics.monthlyTrends.map(t => t.amount), 1);
                  const height = (trend.amount / maxTrend) * 100;
                  return (
                    <div key={idx} className="trend-bar">
                      <div className="trend-bar-fill" style={{ 
                        height: `${height}%`,
                        background: 'linear-gradient(180deg, #2563eb 0%, #1e40af 100%)'
                      }}>
                        <span className="trend-tooltip">₹{trend.amount.toLocaleString('en-IN')}</span>
                      </div>
                      <span className="trend-label">{trend.month.split('-')[1]}/{trend.month.split('-')[0].slice(2)}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Top Employees */}
        {analytics.employeeStats?.length > 0 && (
          <div className="chart-card full-width">
            <div className="chart-header">
              <h3><i className="fas fa-users"></i> Top Employees by Spending</h3>
            </div>
            <div className="chart-body">
              <table className="analytics-table">
                <thead>
                  <tr>
                    <th>Rank</th>
                    <th>Employee</th>
                    <th>Department</th>
                    <th>Expenses</th>
                    <th>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {analytics.employeeStats.map((emp, idx) => (
                    <tr key={idx}>
                      <td>
                        <span className="rank-badge">{idx + 1}</span>
                      </td>
                      <td>{emp.name}</td>
                      <td><span className="dept-tag">{emp.department}</span></td>
                      <td>{emp.count}</td>
                      <td className="amount-cell">₹{emp.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Budget Modal */}
      {showBudgetModal && (
        <div className="modal-overlay-small" onClick={() => setShowBudgetModal(false)}>
          <div className="modal-content-small" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header-small">
              <h3><i className="fas fa-wallet"></i> Set Budget Limit</h3>
              <button className="modal-close-small" onClick={() => setShowBudgetModal(false)}>
                <i className="fas fa-times"></i>
              </button>
            </div>
            <div className="modal-body-small">
              <p>Set a monthly budget limit to track your spending:</p>
              <div className="form-input-group">
                <i className="fas fa-rupee-sign"></i>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="Enter budget limit"
                  value={budgetLimit}
                  onChange={(e) => setBudgetLimit(e.target.value)}
                />
              </div>
              <div className="modal-actions-small">
                <button className="btn-cancel-small" onClick={() => setShowBudgetModal(false)}>
                  Cancel
                </button>
                <button className="btn-submit" onClick={saveBudgetLimit}>
                  <i className="fas fa-save"></i> Save Budget
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ExpenseAnalytics;
