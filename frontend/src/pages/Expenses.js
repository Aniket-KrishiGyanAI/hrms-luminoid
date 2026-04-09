import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import Swal from 'sweetalert2';
import './ExpensesMobile.css';

const getCurrentBillingMonth = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
};

const formatMonthLabel = (ym) => {
  const [year, month] = ym.split('-');
  return new Date(year, month - 1).toLocaleString('default', { month: 'long', year: 'numeric' });
};

const getMonthOptions = () => {
  const options = [];
  const now = new Date();
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const val = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    options.push({ value: val, label: formatMonthLabel(val) });
  }
  return options;
};

const getStatusStyle = (status) => {
  const styles = {
    SUBMITTED:  { bg: '#dbeafe', text: '#1d4ed8', border: '#93c5fd', icon: 'fa-paper-plane',  label: 'Submitted'  },
    APPROVED:   { bg: '#dcfce7', text: '#15803d', border: '#86efac', icon: 'fa-check-circle', label: 'Approved'   },
    REJECTED:   { bg: '#fee2e2', text: '#b91c1c', border: '#fca5a5', icon: 'fa-times-circle', label: 'Rejected'   },
    REIMBURSED: { bg: '#ede9fe', text: '#6d28d9', border: '#c4b5fd', icon: 'fa-wallet', label: 'Paid' },
  };
  return styles[status] || styles.SUBMITTED;
};

// Stable swal helpers outside component to avoid stale closure issues
const showSuccess = (msg) => Swal.fire({ icon: 'success', title: msg, timer: 2000, showConfirmButton: false, toast: true, position: 'top-end' });
const showError   = (msg) => Swal.fire({ icon: 'error',   title: msg, timer: 3000, showConfirmButton: false, toast: true, position: 'top-end' });
const showWarning = (msg) => Swal.fire({ icon: 'warning', title: msg, timer: 3000, showConfirmButton: false, toast: true, position: 'top-end' });

const timelineConfig = {
  SUBMITTED:  { color: '#1d4ed8', bg: '#dbeafe', icon: 'fa-paper-plane'  },
  APPROVED:   { color: '#15803d', bg: '#dcfce7', icon: 'fa-check-circle' },
  REJECTED:   { color: '#b91c1c', bg: '#fee2e2', icon: 'fa-times-circle' },
  REIMBURSED: { color: '#6d28d9', bg: '#ede9fe', icon: 'fa-wallet'       },
};

const getCategoryIcon = (category) => {
  const icons = {
    TRAVEL: 'fa-plane',
    MEALS: 'fa-utensils',
    ACCOMMODATION: 'fa-building',
    TRANSPORT: 'fa-car',
    OFFICE_SUPPLIES: 'fa-box',
    TRAINING: 'fa-graduation-cap',
    OTHER: 'fa-receipt'
  };
  return icons[category] || 'fa-receipt';
};

const Expenses = () => {
  const { user } = useAuth();
  const [expenses, setExpenses] = useState([]);
  const [lockInfo, setLockInfo] = useState({ isLocked: false, isWarning: false, daysLeft: 0, lastDay: 31 });
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(getCurrentBillingMonth());
  const [showModal, setShowModal] = useState(false);
  const [editingExpense, setEditingExpense] = useState(null);
  const [expenseForm, setExpenseForm] = useState({
    title: '', category: 'TRAVEL', amount: '', expenseDate: '', description: ''
  });
  const [receiptFile, setReceiptFile] = useState([]);
  const objectUrlsRef = React.useRef([]);
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectingExpenseId, setRejectingExpenseId] = useState(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [showDeleteBillModal, setShowDeleteBillModal] = useState(false);
  const [billToDelete, setBillToDelete] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [showReimburseModal, setShowReimburseModal] = useState(false);
  const [reimbursingExpenseId, setReimbursingExpenseId] = useState(null);
  const [reimbursementNote, setReimbursementNote] = useState('');

  const swal = {
    success: showSuccess,
    error:   showError,
    warning: showWarning,
  };

  const isEmployee = user?.role === 'EMPLOYEE';
  const isManagerOrHR = ['MANAGER', 'HR', 'ADMIN'].includes(user?.role);
  const isHROrAdmin = ['HR', 'ADMIN'].includes(user?.role);
  const canOperate = !(lockInfo?.isLocked) || !isEmployee;

  const fetchExpenses = useCallback(async () => {
    try {
      const response = await api.get(`/api/expenses?billingMonth=${selectedMonth}`);
      setExpenses(response.data?.expenses || []);
      setLockInfo(response.data?.lockInfo || { isLocked: false, isWarning: false, daysLeft: 0, lastDay: 31 });
    } catch (error) {
      console.error('Error fetching expenses:', error);
      setExpenses([]);
      setLockInfo({ isLocked: false, isWarning: false, daysLeft: 0, lastDay: 31 });
      showError('Failed to load expenses');
    } finally {
      setLoading(false);
    }
  }, [selectedMonth]);

  useEffect(() => { 
    setLoading(true);
    fetchExpenses(); 
  }, [fetchExpenses]);

  const resetModal = () => {
    objectUrlsRef.current.forEach(url => window.URL.revokeObjectURL(url));
    objectUrlsRef.current = [];
    setShowModal(false);
    setEditingExpense(null);
    setExpenseForm({ title: '', category: 'TRAVEL', amount: '', expenseDate: '', description: '' });
    setReceiptFile([]);
  };

  const openEdit = (expense) => {
    setEditingExpense(expense);
    setExpenseForm({
      title: expense.title,
      category: expense.category,
      amount: expense.amount,
      expenseDate: expense.expenseDate?.split('T')[0] || '',
      description: expense.description || ''
    });
    setShowModal(true);
  };

  const handleFileChange = (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    const newFiles = files.map(file => {
      const previewUrl = file.type.startsWith('image/') ? window.URL.createObjectURL(file) : null;
      if (previewUrl) objectUrlsRef.current.push(previewUrl);
      return { file, previewUrl, id: Date.now() + Math.random() };
    });

    setReceiptFile(prev => [...(Array.isArray(prev) ? prev : []), ...newFiles]);
  };

  const removeBillFile = (fileId) => {
    setReceiptFile(prev => {
      const removed = prev.find(f => f.id === fileId);
      if (removed?.previewUrl) {
        window.URL.revokeObjectURL(removed.previewUrl);
        objectUrlsRef.current = objectUrlsRef.current.filter(u => u !== removed.previewUrl);
      }
      return prev.filter(f => f.id !== fileId);
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    try {
      const formData = new FormData();
      Object.entries(expenseForm).forEach(([k, v]) => formData.append(k, v));
      formData.append('billingMonth', selectedMonth);
      if (Array.isArray(receiptFile) && receiptFile.length > 0) {
        receiptFile.forEach(fileObj => formData.append('bills', fileObj.file));
      }
      if (editingExpense) {
        await api.put(`/api/expenses/${editingExpense._id}`, formData, { headers: { 'Content-Type': 'multipart/form-data' } });
        swal.success('Expense updated & resubmitted!');
      } else {
        await api.post('/api/expenses', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
        swal.success('Expense submitted successfully!');
      }
      resetModal();
      fetchExpenses();
    } catch (error) {
      swal.error(error.response?.data?.message || 'Error saving expense');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    const result = await Swal.fire({
      title: 'Delete Expense?',
      text: 'This action cannot be undone.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#dc2626',
      cancelButtonColor: '#6b7280',
      confirmButtonText: 'Yes, Delete',
      cancelButtonText: 'Cancel',
    });
    if (!result.isConfirmed) return;
    try {
      await api.delete(`/api/expenses/${id}`);
      swal.success('Expense deleted');
      fetchExpenses();
    } catch (error) {
      swal.error(error.response?.data?.message || 'Error deleting expense');
    }
  };

  const handleApproveReject = async (id, status, reason = '') => {
    try {
      await api.put(`/api/expenses/${id}/approve-reject`, { status, rejectionReason: reason });
      fetchExpenses();
      swal.success(`Expense ${status.toLowerCase()} successfully`);
      setShowRejectModal(false);
      setRejectingExpenseId(null);
      setRejectionReason('');
    } catch (error) {
      swal.error(error.response?.data?.message || 'Error updating expense');
    }
  };

const handleMarkReimbursed = async () => {
    try {
      await api.put(`/api/expenses/${reimbursingExpenseId}/approve-reject`, {
        status: 'REIMBURSED',
        reimbursementNote: reimbursementNote.trim() || undefined,
      });
      fetchExpenses();
      swal.success('Payment marked successfully!');
      setShowReimburseModal(false);
      setReimbursingExpenseId(null);
      setReimbursementNote('');
    } catch (error) {
      swal.error(error.response?.data?.message || 'Error updating expense');
    }
  };

  const handleDeleteBill = async () => {
    try {
      if (!billToDelete) return;
      const res = await api.delete(`/api/expenses/${billToDelete.expenseId}/bills/${billToDelete.billIndex}`);
      setEditingExpense(prev => ({ ...prev, bills: res.data.bills }));
      fetchExpenses();
      swal.success('Bill deleted successfully');
      setShowDeleteBillModal(false);
      setBillToDelete(null);
    } catch (error) {
      swal.error('Error deleting bill');
    }
  };

  const filteredExpenses = (filterStatus === 'ALL' 
    ? expenses 
    : expenses.filter(e => e.status === filterStatus)) || [];

  const totalAmount = filteredExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);
  const stats = {
    total: filteredExpenses.length,
    submitted: filteredExpenses.filter(e => e.status === 'SUBMITTED').length,
    approved: filteredExpenses.filter(e => e.status === 'APPROVED').length,
    rejected: filteredExpenses.filter(e => e.status === 'REJECTED').length,
    reimbursed: filteredExpenses.filter(e => e.status === 'REIMBURSED').length,
  };

  const amountBreakdown = {
    total: totalAmount,
    approved: filteredExpenses.filter(e => e.status === 'APPROVED').reduce((sum, e) => sum + (e.amount || 0), 0),
    submitted: filteredExpenses.filter(e => e.status === 'SUBMITTED').reduce((sum, e) => sum + (e.amount || 0), 0),
    reimbursed: filteredExpenses.filter(e => e.status === 'REIMBURSED').reduce((sum, e) => sum + (e.amount || 0), 0),
  };

  if (loading) {
    return (
      <div className="expense-loading">
        <div className="spinner-border text-primary"></div>
        <p>Loading expenses...</p>
      </div>
    );
  }

  return (
    <div className="expense-container">
      {/* ═══ HEADER ═══ */}
      <div className="expense-header-section">
        <div className="expense-header-top">
          <div className="expense-header-content">
            <h1 className="expense-page-title">
              <i className="fas fa-receipt"></i> Monthly Expenses
            </h1>
            <p className="expense-page-subtitle">Track and manage your expense claims</p>
          </div>
          {isEmployee && (
            <button 
              className="btn-add-expense"
              onClick={() => {
                if (!canOperate) {
                  swal.warning('Month is locked for submissions');
                  return;
                }
                setShowModal(true);
              }}
              disabled={!canOperate}
            >
              <i className="fas fa-plus"></i>
              <span>New Expense</span>
            </button>
          )}
        </div>

        {/* ─── ALERTS ─── */}
        {isEmployee && lockInfo.isLocked && (
          <div className="alert-banner alert-locked">
            <i className="fas fa-lock"></i>
            <div>
              <strong>Month Closed!</strong>
              <p>All expense operations are locked until the next month (1st).</p>
            </div>
          </div>
        )}
        {isEmployee && lockInfo.isWarning && !lockInfo.isLocked && (
          <div className="alert-banner alert-warning">
            <i className="fas fa-exclamation-triangle"></i>
            <div>
              <strong>⏰ Hurry!</strong>
              <p>Only <strong>{lockInfo.daysLeft}</strong> days left to submit expenses (closes on {lockInfo.lastDay}th)</p>
            </div>
          </div>
        )}
      </div>

      {/* ═══ MONTH SELECTOR & STATS ═══ */}
      <div className="expense-controls">
        <div className="month-selector-wrapper">
          <label>Select Month</label>
          <select 
            value={selectedMonth} 
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="month-select"
          >
            {getMonthOptions().map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>

        <div className="stats-row">
          <div className="stat-card">
            <div className="stat-icon" style={{ background: '#eff6ff' }}>
              <i className="fas fa-receipt" style={{ color: '#0284c7' }}></i>
            </div>
            <div className="stat-content">
              <span className="stat-label">Total</span>
              <span className="stat-value">{stats.total}</span>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon" style={{ background: '#fef3c7' }}>
              <i className="fas fa-hourglass-end" style={{ color: '#ca8a04' }}></i>
            </div>
            <div className="stat-content">
              <span className="stat-label">Pending</span>
              <span className="stat-value">{stats.submitted}</span>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon" style={{ background: '#dcfce7' }}>
              <i className="fas fa-check-circle" style={{ color: '#16a34a' }}></i>
            </div>
            <div className="stat-content">
              <span className="stat-label">Approved</span>
              <span className="stat-value">{stats.approved}</span>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon" style={{ background: '#fee2e2' }}>
              <i className="fas fa-times-circle" style={{ color: '#dc2626' }}></i>
            </div>
            <div className="stat-content">
              <span className="stat-label">Rejected</span>
              <span className="stat-value">{stats.rejected}</span>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon" style={{ background: '#e0e7ff' }}>
              <i className="fas fa-wallet" style={{ color: '#4338ca' }}></i>
            </div>
            <div className="stat-content">
              <span className="stat-label">Paid</span>
              <span className="stat-value">{stats.reimbursed}</span>
            </div>
          </div>
        </div>
      </div>

      {/* ═══ STATUS FILTER ═══ */}
      <div className="filter-tabs">
        {[{v:'ALL',l:'All'},{v:'SUBMITTED',l:'Submitted'},{v:'APPROVED',l:'Approved'},{v:'REJECTED',l:'Rejected'},{v:'REIMBURSED',l:'Paid'}].map(({v,l}) => (
          <button
            key={v}
            className={`filter-tab ${filterStatus === v ? 'active' : ''}`}
            onClick={() => setFilterStatus(v)}
          >
            {l}
          </button>
        ))}
      </div>

      {/* ═══ AMOUNT SUMMARY ═══ */}
      {filteredExpenses.length > 0 && (
        <div className="summary-section">
          <div className="summary-card">
            <span className="summary-label">Total Amount</span>
            <span className="summary-amount">₹{totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
          </div>
          {isManagerOrHR && (
            <div className="summary-breakdown">
              <div className="breakdown-item">
                <span>Approved:</span>
                <span>₹{amountBreakdown.approved.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="breakdown-item">
                <span>Pending:</span>
                <span>₹{amountBreakdown.submitted.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="breakdown-item">
                <span>Paid:</span>
                <span>₹{amountBreakdown.reimbursed.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ═══ EXPENSES LIST ═══ */}
      <div className="expenses-list-wrapper">
        {filteredExpenses.length > 0 ? (
          <div className="expenses-list">
            {filteredExpenses.map(expense => {
              const statusStyle = getStatusStyle(expense.status);
              const categoryIcon = getCategoryIcon(expense.category);
              return (
                <div key={expense._id} className="expense-card">
                  {/* Card Header */}
                  <div className="expense-card-header">
                    <div className="expense-title-section">
                      <div className="category-icon" style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}>
                        <i className={`fas ${categoryIcon}`}></i>
                      </div>
                      <div className="title-content">
                        <h3 className="expense-title">{expense.title}</h3>
                        <p className="expense-date">
                          <i className="fas fa-calendar"></i>
                          {new Date(expense.expenseDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </p>
                      </div>
                    </div>
                    <div className="expense-amount">₹{expense.amount?.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
                  </div>

                  {/* Card Body */}
                  {isManagerOrHR && expense.employeeId && (
                    <div className="expense-employee-info">
                      <i className="fas fa-user-tie"></i>
                      <span>{expense.employeeId?.firstName} {expense.employeeId?.lastName}</span>
                      {expense.employeeId?.department && <span className="department-badge">{expense.employeeId.department}</span>}
                    </div>
                  )}
                  {expense.description && (
                    <div className="expense-description">{expense.description}</div>
                  )}

                  {/* ── TIMELINE ── */}
                  {expense.timeline && expense.timeline.length > 0 && (
                    <div className="expense-timeline">
                      <div className="timeline-title"><i className="fas fa-history"></i> History</div>
                      <div className="timeline-list">
                        {expense.timeline.map((entry, idx) => {
                          const cfg = timelineConfig[entry.status] || timelineConfig.SUBMITTED;
                          return (
                            <div key={idx} className="timeline-item">
                              <div className="timeline-dot" style={{ background: cfg.bg, border: `2px solid ${cfg.color}` }}>
                                <i className={`fas ${cfg.icon}`} style={{ color: cfg.color, fontSize: '0.65rem' }}></i>
                              </div>
                              <div className="timeline-content">
                                <div className="timeline-header">
                                  <span className="timeline-status" style={{ color: cfg.color, fontWeight: 600 }}>{entry.status}</span>
                                  <span className="timeline-actor">
                                    {entry.actorName || `${entry.actor?.firstName || ''} ${entry.actor?.lastName || ''}`.trim()}
                                  </span>
                                  <span className="timeline-time">
                                    {new Date(entry.timestamp).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                  </span>
                                </div>
                                {entry.note && (
                                  <div className="timeline-note"
                                    style={{ color: entry.status === 'REJECTED' ? '#b91c1c' : '#6b7280' }}>
                                    {entry.status === 'REJECTED' && <i className="fas fa-exclamation-circle" style={{ marginRight: 4 }}></i>}
                                    {entry.note}
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Bills Preview */}
                  {expense.bills && expense.bills.length > 0 && (
                    <div className="bills-preview">
                      <div className="bills-preview-header">
                        <i className="fas fa-paperclip"></i>
                        <span>{expense.bills.length} bill{expense.bills.length > 1 ? 's' : ''}</span>
                      </div>
                      <div className="bills-thumbs">
                        {expense.bills.slice(0, 3).map((bill, idx) => (
                          <button
                            key={idx}
                            className="bill-thumb"
                            onClick={() => window.open(`/api/expenses/${expense._id}/bills/${idx}/view`, '_blank')}
                            title={bill.fileName}
                          >
                            <i className={`fas ${bill.filePath?.match(/\.pdf$/i) ? 'fa-file-pdf' : 'fa-image'}`}></i>
                          </button>
                        ))}
                        {expense.bills.length > 3 && (
                          <div className="bill-more">+{expense.bills.length - 3}</div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Card Footer */}
                  <div className="expense-card-footer">
                    <div className="status-badge" style={{ background: statusStyle.bg, color: statusStyle.text, border: `1.5px solid ${statusStyle.border}` }}>
                      <i className={`fas ${statusStyle.icon}`}></i>
                      {statusStyle.label}
                    </div>

                    <div className="card-actions">
                      {isEmployee && canOperate && expense.status === 'REJECTED' && (
                        <>
                          <button className="action-btn edit" onClick={() => openEdit(expense)} title="Edit & Resubmit">
                            <i className="fas fa-edit"></i>
                          </button>
                          <button className="action-btn delete" onClick={() => handleDelete(expense._id)} title="Delete">
                            <i className="fas fa-trash"></i>
                          </button>
                        </>
                      )}
                      {isEmployee && canOperate && expense.status === 'SUBMITTED' && (
                        <button className="action-btn delete" onClick={() => handleDelete(expense._id)} title="Delete">
                          <i className="fas fa-trash"></i>
                        </button>
                      )}
                      {isManagerOrHR && expense.status === 'SUBMITTED' && (
                        <>
                          <button className="action-btn approve" onClick={() => handleApproveReject(expense._id, 'APPROVED')} title="Approve">
                            <i className="fas fa-check"></i>
                          </button>
                          <button className="action-btn reject" onClick={() => {
                            setRejectingExpenseId(expense._id);
                            setShowRejectModal(true);
                          }} title="Reject">
                            <i className="fas fa-times"></i>
                          </button>
                        </>
                      )}
                      {isHROrAdmin && expense.status === 'APPROVED' && (
                        <button className="action-btn-reimburse" onClick={() => {
                          setReimbursingExpenseId(expense._id);
                          setShowReimburseModal(true);
                        }} title="Mark as Paid">
                          <i className="fas fa-wallet"></i> Mark as Paid
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="empty-state">
            <div className="empty-icon">
              <i className="fas fa-inbox"></i>
            </div>
            <h3>No Expenses Yet</h3>
            <p>
              {filterStatus === 'ALL' 
                ? `No expenses for ${formatMonthLabel(selectedMonth)}`
                : `No ${filterStatus.toLowerCase()} expenses for ${formatMonthLabel(selectedMonth)}`
              }
            </p>
            {isEmployee && canOperate && filterStatus === 'ALL' && (
              <button className="btn-empty-action" onClick={() => setShowModal(true)}>
                <i className="fas fa-plus"></i> Create Your First Expense
              </button>
            )}
          </div>
        )}
      </div>

      {/* ═══ MODAL ═══ */}
      {showModal && (
        <div className="modal-overlay" onClick={() => !editingExpense && resetModal()}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            {/* Modal Header */}
            <div className="modal-header">
              <div className="modal-header-content">
                <h2>{editingExpense ? 'Edit Expense' : 'Add New Expense'}</h2>
                <p className="modal-month">{formatMonthLabel(selectedMonth)}</p>
              </div>
              <button className="modal-close" onClick={resetModal}>
                <i className="fas fa-times"></i>
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleSubmit} className="expense-form">
              <div className="form-section">
                <label className="form-label">
                  <span>Expense Title</span>
                  <span className="required">*</span>
                </label>
                <div className="form-input-group">
                  <i className="fas fa-tag"></i>
                  <input
                    type="text"
                    placeholder="e.g., Client lunch, Flight tickets"
                    value={expenseForm.title}
                    onChange={(e) => setExpenseForm({ ...expenseForm, title: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-section">
                  <label className="form-label">
                    <span>Category</span>
                    <span className="required">*</span>
                  </label>
                  <div className="form-input-group">
                    <i className="fas fa-layer-group"></i>
                    <select
                      value={expenseForm.category}
                      onChange={(e) => setExpenseForm({ ...expenseForm, category: e.target.value })}
                    >
                      <option value="TRAVEL">✈️ Travel</option>
                      <option value="MEALS">🍽️ Meals</option>
                      <option value="ACCOMMODATION">🏨 Accommodation</option>
                      <option value="TRANSPORT">🚗 Transport</option>
                      <option value="OFFICE_SUPPLIES">📦 Office Supplies</option>
                      <option value="TRAINING">🎓 Training</option>
                      <option value="OTHER">📋 Other</option>
                    </select>
                  </div>
                </div>

                <div className="form-section">
                  <label className="form-label">
                    <span>Date</span>
                    <span className="required">*</span>
                  </label>
                  <div className="form-input-group">
                    <i className="fas fa-calendar"></i>
                    <input
                      type="date"
                      value={expenseForm.expenseDate}
                      onChange={(e) => setExpenseForm({ ...expenseForm, expenseDate: e.target.value })}
                      required
                    />
                  </div>
                </div>
              </div>

              <div className="form-section">
                <label className="form-label">
                  <span>Amount (₹)</span>
                  <span className="required">*</span>
                </label>
                <div className="form-input-group amount-input">
                  <i className="fas fa-rupee-sign"></i>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    value={expenseForm.amount}
                    onChange={(e) => setExpenseForm({ ...expenseForm, amount: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="form-section">
                <label className="form-label">Notes</label>
                <textarea
                  placeholder="Add any additional details..."
                  rows="3"
                  value={expenseForm.description}
                  onChange={(e) => setExpenseForm({ ...expenseForm, description: e.target.value })}
                  className="form-textarea"
                />
              </div>

              {/* Bill Upload Section */}
              <div className="form-section">
                <label className="form-label">
                  <span>Upload Bills</span>
                  <span style={{ fontSize: '0.75rem', fontWeight: 400 }}>Up to 10 files, max 5MB each</span>
                </label>

                <label className="upload-area">
                  <input
                    type="file"
                    multiple
                    accept="image/jpeg,image/png,application/pdf"
                    onChange={handleFileChange}
                    style={{ display: 'none' }}
                  />
                  <div className="upload-content">
                    <i className="fas fa-cloud-upload-alt"></i>
                    <p><strong>Click to upload</strong> or drag & drop</p>
                    <small>JPEG, PNG, PDF • Max 5MB per file</small>
                  </div>
                </label>

                {/* Bills Preview */}
                {Array.isArray(receiptFile) && receiptFile.length > 0 && (
                  <div className="bills-gallery">
                    <p className="gallery-title">
                      <i className="fas fa-check-circle"></i>
                      {receiptFile.length} bill{receiptFile.length !== 1 ? 's' : ''} selected
                    </p>
                    <div className="gallery-grid">
                      {receiptFile.map((fileObj) => (
                        <div key={fileObj.id} className="gallery-item">
                          {fileObj.file.type.startsWith('image/') ? (
                            <img src={fileObj.previewUrl} alt={fileObj.file.name} />
                          ) : (
                            <div className="pdf-placeholder">
                              <i className="fas fa-file-pdf"></i>
                            </div>
                          )}
                          <button
                            type="button"
                            className="remove-btn"
                            onClick={() => removeBillFile(fileObj.id)}
                          >
                            <i className="fas fa-times"></i>
                          </button>
                          <span className="file-name">{fileObj.file.name.substring(0, 12)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Existing Bills */}
                {editingExpense?.bills && editingExpense.bills.length > 0 && (
                  <div className="existing-bills">
                    <p className="gallery-title">
                      <i className="fas fa-file-check"></i>
                      Current bills ({editingExpense.bills.length})
                    </p>
                    <div className="gallery-grid">
                      {editingExpense.bills.map((bill, idx) => (
                        <div key={idx} className="gallery-item existing" style={{ position: 'relative' }}>
                          {bill.filePath?.match(/\.(jpg|jpeg|png)$/i) ? (
                            <div style={{ background: '#f3f4f6', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <i className="fas fa-image"></i>
                            </div>
                          ) : (
                            <div className="pdf-placeholder">
                              <i className="fas fa-file-pdf"></i>
                            </div>
                          )}
                          <button
                            type="button"
                            className="delete-bill-btn"
                            onClick={() => {
                              setBillToDelete({ expenseId: editingExpense._id, billIndex: idx });
                              setShowDeleteBillModal(true);
                            }}
                            title="Delete bill"
                          >
                            <i className="fas fa-trash-alt"></i>
                          </button>
                          <span className="file-name">{bill.fileName.substring(0, 12)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Form Actions */}
              <div className="form-actions">
                <button type="button" className="btn-cancel" onClick={resetModal}>
                  Cancel
                </button>
                <button type="submit" className="btn-submit" disabled={submitting}>
                  {submitting
                    ? <><span className="btn-spinner"></span> Submitting...</>
                    : <><i className={`fas ${editingExpense ? 'fa-redo' : 'fa-paper-plane'}`}></i> {editingExpense ? 'Save & Resubmit' : 'Submit Expense'}</>
                  }
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ═══ REJECTION REASON MODAL ═══ */}
      {showRejectModal && (
        <div className="modal-overlay-small" onClick={() => setShowRejectModal(false)}>
          <div className="modal-content-small" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header-small">
              <h3>Reject Expense</h3>
              <button className="modal-close-small" onClick={() => setShowRejectModal(false)}>
                <i className="fas fa-times"></i>
              </button>
            </div>
            <div className="modal-body-small">
              <p>Please provide a reason for rejection:</p>
              <textarea
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="e.g., Missing receipt, Category incorrect, Amount exceeds limit"
                rows="4"
                className="rejection-textarea"
              />
              <div className="modal-actions-small">
                <button className="btn-cancel-small" onClick={() => setShowRejectModal(false)}>
                  Cancel
                </button>
                <button 
                  className="btn-reject-small" 
                  onClick={() => {
                    if (rejectionReason.trim()) {
                      handleApproveReject(rejectingExpenseId, 'REJECTED', rejectionReason);
                    } else {
                      swal.error('Please provide a rejection reason');
                    }
                  }}
                  disabled={!rejectionReason.trim()}
                >
                  Reject
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══ DELETE BILL CONFIRMATION ═══ */}
      {showDeleteBillModal && (
        <div className="modal-overlay-small" onClick={() => setShowDeleteBillModal(false)}>
          <div className="modal-content-small" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header-small">
              <h3>
                <i className="fas fa-trash-alt" style={{ color: '#dc2626' }}></i> Delete Bill
              </h3>
              <button className="modal-close-small" onClick={() => setShowDeleteBillModal(false)}>
                <i className="fas fa-times"></i>
              </button>
            </div>
            <div className="modal-body-small">
              <p>Are you sure you want to delete this bill? This action cannot be undone.</p>
              <div className="modal-actions-small">
                <button className="btn-cancel-small" onClick={() => setShowDeleteBillModal(false)}>
                  Keep Bill
                </button>
                <button className="btn-delete-small" onClick={handleDeleteBill}>
                  Delete Bill
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* ═══ REIMBURSE MODAL ═══ */}
      {showReimburseModal && (
        <div className="modal-overlay-small" onClick={() => setShowReimburseModal(false)}>
          <div className="modal-content-small" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header-small">
              <h3><i className="fas fa-wallet" style={{ color: '#6d28d9' }}></i> Mark as Paid</h3>
              <button className="modal-close-small" onClick={() => setShowReimburseModal(false)}>
                <i className="fas fa-times"></i>
              </button>
            </div>
            <div className="modal-body-small">
              <p>Add a payment note (optional):</p>
              <textarea
                value={reimbursementNote}
                onChange={(e) => setReimbursementNote(e.target.value)}
                placeholder="e.g., Paid via March 2025 salary, Bank transfer ref #1234"
                rows="3"
                className="rejection-textarea"
              />
              <div className="modal-actions-small">
                <button className="btn-cancel-small" onClick={() => setShowReimburseModal(false)}>
                  Cancel
                </button>
                <button className="btn-submit" onClick={handleMarkReimbursed}>
                  <i className="fas fa-wallet"></i> Confirm Payment
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Expenses;
