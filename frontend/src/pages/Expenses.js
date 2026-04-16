import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import Swal from 'sweetalert2';
import * as XLSX from 'xlsx';
import ExpenseAnalytics from './ExpenseAnalytics';
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
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [showDeleted, setShowDeleted] = useState(false);
  const [deletedExpenses, setDeletedExpenses] = useState([]);
  const [loadingDeleted, setLoadingDeleted] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({
    dateFrom: '',
    dateTo: '',
    amountMin: '',
    amountMax: '',
    category: 'ALL',
    searchEmployee: ''
  });
  const [sortBy, setSortBy] = useState('date-desc');
  const [selectedExpenses, setSelectedExpenses] = useState([]);
  const [expandedExpense, setExpandedExpense] = useState(null);

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

  const fetchDeletedExpenses = useCallback(async () => {
    try {
      setLoadingDeleted(true);
      const response = await api.get(`/api/expenses/deleted?billingMonth=${selectedMonth}`);
      setDeletedExpenses(response.data?.expenses || []);
    } catch (error) {
      console.error('Error fetching deleted expenses:', error);
      setDeletedExpenses([]);
      if (error.response?.status !== 403) {
        showError('Failed to load deleted expenses');
      }
    } finally {
      setLoadingDeleted(false);
    }
  }, [selectedMonth]);

  useEffect(() => { 
    setLoading(true);
    fetchExpenses(); 
  }, [fetchExpenses]);

  useEffect(() => {
    if (showDeleted) {
      fetchDeletedExpenses();
    }
  }, [showDeleted, fetchDeletedExpenses]);

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
      // Handle duplicate detection
      if (error.response?.status === 409 && error.response?.data?.isDuplicate) {
        const duplicates = error.response.data.duplicates;
        const duplicateList = duplicates.map(dup => 
          `• ${dup.title} - ₹${dup.amount} on ${dup.date} (${dup.status})`
        ).join('\n');
        
        const result = await Swal.fire({
          title: '⚠️ Possible Duplicate Detected',
          html: `
            <div style="text-align: left;">
              <p style="margin-bottom: 1rem;">A similar expense already exists:</p>
              <div style="background: #fef3c7; padding: 1rem; border-radius: 8px; margin-bottom: 1rem; font-family: monospace; font-size: 0.9rem; white-space: pre-line;">${duplicateList}</div>
              <p style="color: #64748b; font-size: 0.9rem;">Do you want to submit this expense anyway?</p>
            </div>
          `,
          icon: 'warning',
          showCancelButton: true,
          confirmButtonColor: '#059669',
          cancelButtonColor: '#64748b',
          confirmButtonText: 'Yes, Submit Anyway',
          cancelButtonText: 'Cancel',
          customClass: {
            popup: 'duplicate-warning-modal'
          }
        });
        
        if (result.isConfirmed) {
          // User confirmed - submit with override flag
          try {
            const formData = new FormData();
            Object.entries(expenseForm).forEach(([k, v]) => formData.append(k, v));
            formData.append('billingMonth', selectedMonth);
            formData.append('ignoreDuplicate', 'true'); // Add override flag
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
          } catch (retryError) {
            swal.error(retryError.response?.data?.message || 'Error saving expense');
          }
        }
      } else {
        swal.error(error.response?.data?.message || 'Error saving expense');
      }
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

  // Apply advanced filters
  const advancedFilteredExpenses = filteredExpenses.filter(exp => {
    // Date range filter
    if (filters.dateFrom && new Date(exp.expenseDate) < new Date(filters.dateFrom)) return false;
    if (filters.dateTo && new Date(exp.expenseDate) > new Date(filters.dateTo)) return false;
    
    // Amount range filter
    if (filters.amountMin && exp.amount < parseFloat(filters.amountMin)) return false;
    if (filters.amountMax && exp.amount > parseFloat(filters.amountMax)) return false;
    
    // Category filter
    if (filters.category !== 'ALL' && exp.category !== filters.category) return false;
    
    // Employee search filter
    if (filters.searchEmployee && exp.employeeId) {
      const employeeName = `${exp.employeeId.firstName} ${exp.employeeId.lastName}`.toLowerCase();
      if (!employeeName.includes(filters.searchEmployee.toLowerCase())) return false;
    }
    
    return true;
  });

  // Apply sorting
  const sortedExpenses = [...advancedFilteredExpenses].sort((a, b) => {
    switch (sortBy) {
      case 'date-desc':
        return new Date(b.expenseDate) - new Date(a.expenseDate);
      case 'date-asc':
        return new Date(a.expenseDate) - new Date(b.expenseDate);
      case 'amount-desc':
        return b.amount - a.amount;
      case 'amount-asc':
        return a.amount - b.amount;
      case 'status':
        return a.status.localeCompare(b.status);
      default:
        return 0;
    }
  });

  const totalAmount = sortedExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);
  const stats = {
    total: sortedExpenses.length,
    submitted: sortedExpenses.filter(e => e.status === 'SUBMITTED').length,
    approved: sortedExpenses.filter(e => e.status === 'APPROVED').length,
    rejected: sortedExpenses.filter(e => e.status === 'REJECTED').length,
    reimbursed: sortedExpenses.filter(e => e.status === 'REIMBURSED').length,
  };

  const amountBreakdown = {
    total: totalAmount,
    approved: sortedExpenses.filter(e => e.status === 'APPROVED').reduce((sum, e) => sum + (e.amount || 0), 0),
    submitted: sortedExpenses.filter(e => e.status === 'SUBMITTED').reduce((sum, e) => sum + (e.amount || 0), 0),
    reimbursed: sortedExpenses.filter(e => e.status === 'REIMBURSED').reduce((sum, e) => sum + (e.amount || 0), 0),
  };

  const handleBulkApprove = async () => {
    if (selectedExpenses.length === 0) return;
    const result = await Swal.fire({
      title: 'Approve Selected Expenses?',
      text: `${selectedExpenses.length} expense(s) will be approved.`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#059669',
      cancelButtonColor: '#6b7280',
      confirmButtonText: 'Yes, Approve',
    });
    if (!result.isConfirmed) return;
    try {
      await Promise.all(selectedExpenses.map(id => 
        api.put(`/api/expenses/${id}/approve-reject`, { status: 'APPROVED' })
      ));
      swal.success(`${selectedExpenses.length} expense(s) approved`);
      setSelectedExpenses([]);
      fetchExpenses();
    } catch (error) {
      swal.error('Error approving expenses');
    }
  };

  const handleBulkReject = async () => {
    if (selectedExpenses.length === 0) return;
    const { value: reason } = await Swal.fire({
      title: 'Reject Selected Expenses',
      input: 'textarea',
      inputLabel: 'Rejection Reason',
      inputPlaceholder: 'Enter reason for rejection...',
      showCancelButton: true,
      confirmButtonColor: '#dc2626',
      confirmButtonText: 'Reject',
      inputValidator: (value) => !value && 'Please provide a reason'
    });
    if (!reason) return;
    try {
      await Promise.all(selectedExpenses.map(id => 
        api.put(`/api/expenses/${id}/approve-reject`, { status: 'REJECTED', rejectionReason: reason })
      ));
      swal.success(`${selectedExpenses.length} expense(s) rejected`);
      setSelectedExpenses([]);
      fetchExpenses();
    } catch (error) {
      swal.error('Error rejecting expenses');
    }
  };

  const toggleSelectExpense = (id) => {
    setSelectedExpenses(prev => 
      prev.includes(id) ? prev.filter(expId => expId !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    const selectableExpenses = sortedExpenses.filter(e => e.status === 'SUBMITTED');
    if (selectedExpenses.length === selectableExpenses.length && selectableExpenses.length > 0) {
      setSelectedExpenses([]);
    } else {
      setSelectedExpenses(selectableExpenses.map(e => e._id));
    }
  };

  const handleBulkReimburse = async () => {
    if (selectedExpenses.length === 0) return;
    const approvedExpenses = selectedExpenses.filter(id => {
      const exp = sortedExpenses.find(e => e._id === id);
      return exp && exp.status === 'APPROVED';
    });
    if (approvedExpenses.length === 0) {
      swal.warning('No approved expenses selected');
      return;
    }
    const { value: note } = await Swal.fire({
      title: 'Mark Selected as Paid',
      input: 'textarea',
      inputLabel: 'Payment Note (Optional)',
      inputPlaceholder: 'e.g., Paid via March 2025 salary, Bank transfer ref #1234',
      showCancelButton: true,
      confirmButtonColor: '#6d28d9',
      confirmButtonText: 'Mark as Paid',
    });
    if (note === undefined) return;
    try {
      await Promise.all(approvedExpenses.map(id => 
        api.put(`/api/expenses/${id}/approve-reject`, { 
          status: 'REIMBURSED',
          reimbursementNote: note?.trim() || undefined
        })
      ));
      swal.success(`${approvedExpenses.length} expense(s) marked as paid`);
      setSelectedExpenses([]);
      fetchExpenses();
    } catch (error) {
      swal.error('Error marking expenses as paid');
    }
  };

  const clearFilters = () => {
    setFilters({
      dateFrom: '',
      dateTo: '',
      amountMin: '',
      amountMax: '',
      category: 'ALL',
      searchEmployee: ''
    });
  };

  const toggleExpandRow = (expenseId) => {
    setExpandedExpense(expandedExpense === expenseId ? null : expenseId);
  };

  const exportToExcel = () => {
    try {
      // Prepare data for export based on table structure
      const exportData = sortedExpenses.map((expense, index) => {
        const row = {
          'Sr. No.': index + 1,
          'Date': new Date(expense.expenseDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
          'Title': expense.title,
          'Category': expense.category.replace('_', ' '),
        };

        // Add employee info for managers/HR
        if (isManagerOrHR && expense.employeeId) {
          row['Employee'] = `${expense.employeeId.firstName} ${expense.employeeId.lastName}`;
          row['Department'] = expense.employeeId.department || '-';
        }

        row['Amount (₹)'] = expense.amount;
        row['Status'] = getStatusStyle(expense.status).label;
        row['Description'] = expense.description || '-';
        row['Bills'] = expense.bills?.length || 0;

        // Add status-specific info
        if (expense.status === 'REJECTED' && expense.rejectionReason) {
          row['Rejection Reason'] = expense.rejectionReason;
        }
        if (expense.status === 'REIMBURSED') {
          row['Reimbursement Date'] = expense.reimbursementDate ? new Date(expense.reimbursementDate).toLocaleDateString('en-IN') : '-';
          if (expense.reimbursementNote) {
            row['Payment Note'] = expense.reimbursementNote;
          }
        }
        if (expense.approvedBy) {
          row['Approved By'] = expense.approvedBy.firstName ? `${expense.approvedBy.firstName} ${expense.approvedBy.lastName}` : '-';
          row['Approved Date'] = expense.approvedDate ? new Date(expense.approvedDate).toLocaleDateString('en-IN') : '-';
        }

        row['Billing Month'] = expense.billingMonth;
        row['Submitted Date'] = new Date(expense.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

        return row;
      });

      // Add summary rows at the end
      exportData.push({});
      exportData.push({ 'Sr. No.': '', 'Date': 'SUMMARY', 'Title': '', 'Category': '', 'Employee': '', 'Amount (₹)': '', 'Status': '', 'Description': '' });
      exportData.push({ 'Sr. No.': '', 'Date': 'Total Expenses:', 'Title': stats.total, 'Category': '', 'Employee': '', 'Amount (₹)': '', 'Status': '', 'Description': '' });
      exportData.push({ 'Sr. No.': '', 'Date': 'Total Amount:', 'Title': '', 'Category': '', 'Employee': '', 'Amount (₹)': totalAmount, 'Status': '', 'Description': '' });
      exportData.push({});
      exportData.push({ 'Sr. No.': '', 'Date': 'Submitted:', 'Title': stats.submitted, 'Category': '', 'Employee': 'Amount:', 'Amount (₹)': amountBreakdown.submitted, 'Status': '', 'Description': '' });
      exportData.push({ 'Sr. No.': '', 'Date': 'Approved:', 'Title': stats.approved, 'Category': '', 'Employee': 'Amount:', 'Amount (₹)': amountBreakdown.approved, 'Status': '', 'Description': '' });
      exportData.push({ 'Sr. No.': '', 'Date': 'Rejected:', 'Title': stats.rejected, 'Category': '', 'Employee': 'Amount:', 'Amount (₹)': 0, 'Status': '', 'Description': '' });
      exportData.push({ 'Sr. No.': '', 'Date': 'Paid:', 'Title': stats.reimbursed, 'Category': '', 'Employee': 'Amount:', 'Amount (₹)': amountBreakdown.reimbursed, 'Status': '', 'Description': '' });
      exportData.push({});
      exportData.push({ 'Sr. No.': '', 'Date': 'Export Date:', 'Title': new Date().toLocaleString('en-IN'), 'Category': '', 'Employee': '', 'Amount (₹)': '', 'Status': '', 'Description': '' });
      exportData.push({ 'Sr. No.': '', 'Date': 'Billing Month:', 'Title': formatMonthLabel(selectedMonth), 'Category': '', 'Employee': '', 'Amount (₹)': '', 'Status': '', 'Description': '' });
      exportData.push({ 'Sr. No.': '', 'Date': 'Status Filter:', 'Title': filterStatus === 'ALL' ? 'All Statuses' : getStatusStyle(filterStatus).label, 'Category': '', 'Employee': '', 'Amount (₹)': '', 'Status': '', 'Description': '' });

      // Add active filters info
      if (filters.dateFrom || filters.dateTo) {
        exportData.push({ 'Sr. No.': '', 'Date': 'Date Range:', 'Title': `${filters.dateFrom || 'Start'} to ${filters.dateTo || 'End'}`, 'Category': '', 'Employee': '', 'Amount (₹)': '', 'Status': '', 'Description': '' });
      }
      if (filters.amountMin || filters.amountMax) {
        exportData.push({ 'Sr. No.': '', 'Date': 'Amount Range:', 'Title': `₹${filters.amountMin || '0'} to ₹${filters.amountMax || '∞'}`, 'Category': '', 'Employee': '', 'Amount (₹)': '', 'Status': '', 'Description': '' });
      }
      if (filters.category !== 'ALL') {
        exportData.push({ 'Sr. No.': '', 'Date': 'Category Filter:', 'Title': filters.category.replace('_', ' '), 'Category': '', 'Employee': '', 'Amount (₹)': '', 'Status': '', 'Description': '' });
      }
      if (filters.searchEmployee) {
        exportData.push({ 'Sr. No.': '', 'Date': 'Employee Filter:', 'Title': filters.searchEmployee, 'Category': '', 'Employee': '', 'Amount (₹)': '', 'Status': '', 'Description': '' });
      }

      // Create workbook
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(exportData);

      // Set column widths
      const colWidths = [
        { wch: 8 },  // Sr. No.
        { wch: 14 }, // Date
        { wch: 30 }, // Title
        { wch: 18 }, // Category
      ];

      if (isManagerOrHR) {
        colWidths.push({ wch: 22 }); // Employee
        colWidths.push({ wch: 18 }); // Department
      }

      colWidths.push({ wch: 15 }); // Amount
      colWidths.push({ wch: 12 }); // Status
      colWidths.push({ wch: 35 }); // Description
      colWidths.push({ wch: 10 }); // Bills
      colWidths.push({ wch: 30 }); // Rejection Reason / Payment Note
      colWidths.push({ wch: 20 }); // Approved By
      colWidths.push({ wch: 15 }); // Approved Date
      colWidths.push({ wch: 15 }); // Billing Month
      colWidths.push({ wch: 20 }); // Submitted Date

      ws['!cols'] = colWidths;

      // Add autofilter to header row (only for data rows, not summary)
      const dataRowCount = sortedExpenses.length;
      if (dataRowCount > 0) {
        const range = { s: { r: 0, c: 0 }, e: { r: dataRowCount, c: Object.keys(exportData[0]).length - 1 } };
        ws['!autofilter'] = { ref: XLSX.utils.encode_range(range) };
      }

      // Add sheet to workbook
      XLSX.utils.book_append_sheet(wb, ws, 'Expenses');

      // Generate filename
      const filename = `Expenses_${formatMonthLabel(selectedMonth).replace(' ', '_')}_${new Date().toISOString().split('T')[0]}.xlsx`;

      // Save file
      XLSX.writeFile(wb, filename);

      swal.success('Excel file exported successfully!');
    } catch (error) {
      console.error('Export error:', error);
      swal.error('Failed to export Excel file');
    }
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

      {/* ═══ TABS: EXPENSES vs ANALYTICS vs DELETED ═══ */}
      <div className="filter-tabs">
        <button
          className={`filter-tab ${!showAnalytics && !showDeleted ? 'active' : ''}`}
          onClick={() => {
            setShowAnalytics(false);
            setShowDeleted(false);
          }}
        >
          <i className="fas fa-list"></i> Expenses
        </button>
        <button
          className={`filter-tab ${showAnalytics ? 'active' : ''}`}
          onClick={() => {
            setShowAnalytics(true);
            setShowDeleted(false);
          }}
        >
          <i className="fas fa-chart-bar"></i> Analytics
        </button>
        <button
          className={`filter-tab ${showDeleted ? 'active' : ''}`}
          onClick={() => {
            setShowAnalytics(false);
            setShowDeleted(true);
          }}
        >
          <i className="fas fa-trash-restore"></i> Deleted
        </button>
      </div>

      {showAnalytics ? (
        <ExpenseAnalytics 
          selectedMonth={selectedMonth} 
          expenses={expenses} 
          onMonthChange={setSelectedMonth}
        />
      ) : showDeleted ? (
        <>
          {/* ═══ DELETED EXPENSES VIEW ═══ */}
          <div className="deleted-expenses-section">
            <div className="deleted-header">
              <div className="deleted-header-content">
                <h3><i className="fas fa-trash-restore"></i> Deleted Expenses</h3>
                <p>View expenses that have been deleted. {isHROrAdmin ? 'You can restore them if needed.' : 'Read-only view for transparency.'}</p>
              </div>
            </div>

            {loadingDeleted ? (
              <div className="expense-loading">
                <div className="spinner-border text-primary"></div>
                <p>Loading deleted expenses...</p>
              </div>
            ) : deletedExpenses.length > 0 ? (
              <div className="deleted-expenses-list">
                {deletedExpenses.map(expense => {
                  const statusStyle = getStatusStyle(expense.status);
                  return (
                    <div key={expense._id} className="deleted-expense-card">
                      <div className="deleted-card-header">
                        <div className="deleted-card-title">
                          <i className="fas fa-receipt"></i>
                          <span>{expense.title}</span>
                          <span className="deleted-badge">
                            <i className="fas fa-trash"></i> DELETED
                          </span>
                        </div>
                        <div className="deleted-card-amount">₹{expense.amount?.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
                      </div>

                      <div className="deleted-card-body">
                        <div className="deleted-info-grid">
                          <div className="deleted-info-item">
                            <span className="deleted-info-label"><i className="fas fa-calendar"></i> Expense Date</span>
                            <span className="deleted-info-value">{new Date(expense.expenseDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })}</span>
                          </div>
                          <div className="deleted-info-item">
                            <span className="deleted-info-label"><i className="fas fa-tag"></i> Category</span>
                            <span className="deleted-info-value">{expense.category.replace('_', ' ')}</span>
                          </div>
                          <div className="deleted-info-item">
                            <span className="deleted-info-label"><i className="fas fa-info-circle"></i> Original Status</span>
                            <span className="deleted-info-value">
                              <span className="deleted-status-badge" style={{ background: statusStyle.bg, color: statusStyle.text }}>
                                {statusStyle.label}
                              </span>
                            </span>
                          </div>
                          {isManagerOrHR && expense.employeeId && (
                            <div className="deleted-info-item">
                              <span className="deleted-info-label"><i className="fas fa-user"></i> Employee</span>
                              <span className="deleted-info-value">{expense.employeeId.firstName} {expense.employeeId.lastName}</span>
                            </div>
                          )}
                        </div>

                        {expense.description && (
                          <div className="deleted-description">
                            <span className="deleted-info-label"><i className="fas fa-align-left"></i> Description</span>
                            <p>{expense.description}</p>
                          </div>
                        )}

                        <div className="deleted-audit-info">
                          <div className="deleted-audit-header">
                            <i className="fas fa-exclamation-circle"></i>
                            <span>Deletion Information</span>
                          </div>
                          <div className="deleted-audit-details">
                            <div className="deleted-audit-item">
                              <span className="deleted-audit-label">Deleted By:</span>
                              <span className="deleted-audit-value">{expense.deletedByName || 'Unknown'}</span>
                            </div>
                            <div className="deleted-audit-item">
                              <span className="deleted-audit-label">Deleted On:</span>
                              <span className="deleted-audit-value">{new Date(expense.deletedAt).toLocaleString('en-IN', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                            </div>
                            {expense.deletionReason && (
                              <div className="deleted-audit-item full-width">
                                <span className="deleted-audit-label">Reason:</span>
                                <span className="deleted-audit-value deleted-reason">{expense.deletionReason}</span>
                              </div>
                            )}
                          </div>
                        </div>

                        {isHROrAdmin && (
                          <div className="deleted-card-actions">
                            <button 
                              className="btn-restore-expense"
                              onClick={async () => {
                                const result = await Swal.fire({
                                  title: 'Restore Expense?',
                                  text: 'This will restore the expense back to its original status.',
                                  icon: 'question',
                                  showCancelButton: true,
                                  confirmButtonColor: '#059669',
                                  cancelButtonColor: '#6b7280',
                                  confirmButtonText: 'Yes, Restore',
                                  cancelButtonText: 'Cancel',
                                });
                                if (result.isConfirmed) {
                                  try {
                                    await api.post(`/api/expenses/${expense._id}/restore`);
                                    swal.success('Expense restored successfully');
                                    fetchDeletedExpenses();
                                    fetchExpenses();
                                  } catch (error) {
                                    swal.error(error.response?.data?.message || 'Error restoring expense');
                                  }
                                }
                              }}
                            >
                              <i className="fas fa-undo"></i> Restore Expense
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="empty-state">
                <div className="empty-icon">
                  <i className="fas fa-trash-restore"></i>
                </div>
                <h3>No Deleted Expenses</h3>
                <p>No expenses have been deleted for {formatMonthLabel(selectedMonth)}</p>
              </div>
            )}
          </div>
        </>
      ) : (
        <>
          {/* ═══ STATUS FILTER ═══ */}
          <div className="filter-tabs" style={{ marginTop: '1rem' }}>
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

          {/* ═══ ADVANCED FILTERS & SORTING ═══ */}
          <div className="filter-controls">
            <div className="filter-controls-header">
              <button className="btn-toggle-filters" onClick={() => setShowFilters(!showFilters)}>
                <i className={`fas fa-filter`}></i>
                {showFilters ? 'Hide Filters' : 'Show Filters'}
                {(filters.dateFrom || filters.dateTo || filters.amountMin || filters.amountMax || filters.category !== 'ALL' || filters.searchEmployee) && (
                  <span className="filter-badge">Active</span>
                )}
              </button>
              <div className="filter-actions-group">
                <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="sort-select">
                  <option value="date-desc">Date (Newest)</option>
                  <option value="date-asc">Date (Oldest)</option>
                  <option value="amount-desc">Amount (High to Low)</option>
                  <option value="amount-asc">Amount (Low to High)</option>
                  <option value="status">Status</option>
                </select>
                {sortedExpenses.length > 0 && (
                  <button className="btn-export-excel" onClick={exportToExcel}>
                    <i className="fas fa-file-excel"></i> Export to Excel
                  </button>
                )}
              </div>
            </div>

            {showFilters && (
              <div className="advanced-filters">
                <div className="filter-row">
                  <div className="filter-field">
                    <label>Date From</label>
                    <input
                      type="date"
                      value={filters.dateFrom}
                      onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })}
                    />
                  </div>
                  <div className="filter-field">
                    <label>Date To</label>
                    <input
                      type="date"
                      value={filters.dateTo}
                      onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })}
                    />
                  </div>
                  <div className="filter-field">
                    <label>Min Amount</label>
                    <input
                      type="number"
                      placeholder="0"
                      value={filters.amountMin}
                      onChange={(e) => setFilters({ ...filters, amountMin: e.target.value })}
                    />
                  </div>
                  <div className="filter-field">
                    <label>Max Amount</label>
                    <input
                      type="number"
                      placeholder="999999"
                      value={filters.amountMax}
                      onChange={(e) => setFilters({ ...filters, amountMax: e.target.value })}
                    />
                  </div>
                </div>
                <div className="filter-row">
                  <div className="filter-field">
                    <label>Category</label>
                    <select value={filters.category} onChange={(e) => setFilters({ ...filters, category: e.target.value })}>
                      <option value="ALL">All Categories</option>
                      <option value="TRAVEL">Travel</option>
                      <option value="MEALS">Meals</option>
                      <option value="ACCOMMODATION">Accommodation</option>
                      <option value="TRANSPORT">Transport</option>
                      <option value="OFFICE_SUPPLIES">Office Supplies</option>
                      <option value="TRAINING">Training</option>
                      <option value="OTHER">Other</option>
                    </select>
                  </div>
                  {isManagerOrHR && (
                    <div className="filter-field">
                      <label>Search Employee</label>
                      <input
                        type="text"
                        placeholder="Employee name..."
                        value={filters.searchEmployee}
                        onChange={(e) => setFilters({ ...filters, searchEmployee: e.target.value })}
                      />
                    </div>
                  )}
                  <div className="filter-field">
                    <button className="btn-clear-filters" onClick={clearFilters}>
                      <i className="fas fa-times"></i> Clear Filters
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* ═══ BULK OPERATIONS ═══ */}
          {isManagerOrHR && selectedExpenses.length > 0 && (
            <div className="bulk-actions">
              <div className="bulk-actions-info">
                <input
                  type="checkbox"
                  checked={selectedExpenses.length === sortedExpenses.filter(e => e.status === 'SUBMITTED').length && sortedExpenses.filter(e => e.status === 'SUBMITTED').length > 0}
                  onChange={toggleSelectAll}
                  className="bulk-checkbox"
                />
                <span>{selectedExpenses.length} selected</span>
              </div>
              <div className="bulk-actions-buttons">
                {selectedExpenses.some(id => {
                  const exp = sortedExpenses.find(e => e._id === id);
                  return exp && exp.status === 'SUBMITTED';
                }) && (
                  <>
                    <button className="btn-bulk-approve" onClick={handleBulkApprove}>
                      <i className="fas fa-check"></i> Approve Selected
                    </button>
                    <button className="btn-bulk-reject" onClick={handleBulkReject}>
                      <i className="fas fa-times"></i> Reject Selected
                    </button>
                  </>
                )}
                {isHROrAdmin && selectedExpenses.some(id => {
                  const exp = sortedExpenses.find(e => e._id === id);
                  return exp && exp.status === 'APPROVED';
                }) && (
                  <button className="btn-bulk-reimburse" onClick={handleBulkReimburse}>
                    <i className="fas fa-wallet"></i> Mark Selected as Paid
                  </button>
                )}
              </div>
            </div>
          )}

          {/* ═══ AMOUNT SUMMARY ═══ */}
          {sortedExpenses.length > 0 && (
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
        {sortedExpenses.length > 0 ? (
          <>
            {/* Desktop Table View */}
            <div className="expenses-table-desktop">
              <table className="expenses-table">
                <thead>
                  <tr>
                    {isManagerOrHR && <th className="th-checkbox">
                      <input
                        type="checkbox"
                        checked={selectedExpenses.length === sortedExpenses.filter(e => e.status === 'SUBMITTED').length && sortedExpenses.filter(e => e.status === 'SUBMITTED').length > 0}
                        onChange={toggleSelectAll}
                      />
                    </th>}
                    <th>Date</th>
                    <th>Title</th>
                    <th>Category</th>
                    {isManagerOrHR && <th>Employee</th>}
                    <th className="th-amount">Amount</th>
                    <th>Status</th>
                    <th className="th-actions">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedExpenses.map(expense => {
                    const statusStyle = getStatusStyle(expense.status);
                    const isExpanded = expandedExpense === expense._id;
                    return (
                      <React.Fragment key={expense._id}>
                        <tr className="expense-row">
                          {isManagerOrHR && <td className="td-checkbox">
                            {(expense.status === 'SUBMITTED' || (isHROrAdmin && expense.status === 'APPROVED')) && (
                              <input
                                type="checkbox"
                                checked={selectedExpenses.includes(expense._id)}
                                onChange={() => toggleSelectExpense(expense._id)}
                              />
                            )}
                          </td>}
                          <td className="td-date">
                            {new Date(expense.expenseDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                          </td>
                          <td className="td-title">
                            <div className="table-title-cell">
                              <div className="table-title">
                                {expense.title}
                                {isManagerOrHR && expense.hasPotentialDuplicates && (
                                  <span className="duplicate-badge" title={`${expense.duplicateCount} potential duplicate(s) found`}>
                                    <i className="fas fa-exclamation-triangle"></i> Duplicate?
                                  </span>
                                )}
                              </div>
                              {expense.description && <div className="table-desc">{expense.description}</div>}
                            </div>
                          </td>
                          <td className="td-category">
                            <span className="category-tag">{expense.category.replace('_', ' ')}</span>
                          </td>
                          {isManagerOrHR && <td className="td-employee">
                            {expense.employeeId && (
                              <div className="employee-cell">
                                <span className="employee-name">{expense.employeeId.firstName} {expense.employeeId.lastName}</span>
                                {expense.employeeId.department && <span className="employee-dept">{expense.employeeId.department}</span>}
                              </div>
                            )}
                          </td>}
                          <td className="td-amount">
                            ₹{expense.amount?.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </td>
                          <td className="td-status">
                            <span className="table-status-badge" style={{ background: statusStyle.bg, color: statusStyle.text }}>
                              {statusStyle.label}
                            </span>
                          </td>
                          <td className="td-actions">
                            <div className="table-actions">
                              <button className="table-action-btn view-details" onClick={() => toggleExpandRow(expense._id)} title="View Details">
                                <i className={`fas fa-chevron-${isExpanded ? 'up' : 'down'}`}></i> {isExpanded ? 'Hide' : 'Details'}
                              </button>
                              {isEmployee && canOperate && expense.status === 'REJECTED' && (
                                <>
                                  <button className="table-action-btn edit" onClick={() => openEdit(expense)} title="Edit">
                                    Edit
                                  </button>
                                  <button className="table-action-btn delete" onClick={() => handleDelete(expense._id)} title="Delete">
                                    Delete
                                  </button>
                                </>
                              )}
                              {isEmployee && canOperate && expense.status === 'SUBMITTED' && (
                                <button className="table-action-btn delete" onClick={() => handleDelete(expense._id)} title="Delete">
                                  Delete
                                </button>
                              )}
                              {isManagerOrHR && expense.status === 'SUBMITTED' && (
                                <>
                                  <button className="table-action-btn approve" onClick={() => handleApproveReject(expense._id, 'APPROVED')} title="Approve">
                                    Approve
                                  </button>
                                  <button className="table-action-btn reject" onClick={() => {
                                    setRejectingExpenseId(expense._id);
                                    setShowRejectModal(true);
                                  }} title="Reject">
                                    Reject
                                  </button>
                                </>
                              )}
                              {isHROrAdmin && expense.status === 'APPROVED' && (
                                <button className="table-action-btn reimburse" onClick={() => {
                                  setReimbursingExpenseId(expense._id);
                                  setShowReimburseModal(true);
                                }} title="Mark as Paid">
                                  Mark Paid
                                </button>
                              )}
                              {isHROrAdmin && (
                                <button 
                                  className="table-action-btn admin-delete" 
                                  onClick={async () => {
                                    const { value: reason } = await Swal.fire({
                                      title: 'Delete Expense?',
                                      input: 'textarea',
                                      inputLabel: 'Deletion Reason (Required)',
                                      inputPlaceholder: 'e.g., Duplicate entry, Fraudulent claim, Data error',
                                      showCancelButton: true,
                                      confirmButtonColor: '#dc2626',
                                      confirmButtonText: 'Delete',
                                      inputValidator: (value) => !value && 'Please provide a reason'
                                    });
                                    if (reason) {
                                      try {
                                        await api.delete(`/api/expenses/${expense._id}`, {
                                          data: { deletionReason: reason }
                                        });
                                        swal.success('Expense deleted successfully');
                                        fetchExpenses();
                                      } catch (error) {
                                        swal.error(error.response?.data?.message || 'Error deleting expense');
                                      }
                                    }
                                  }} 
                                  title="Delete (Admin)"
                                >
                                  <i className="fas fa-trash-alt"></i> Delete
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                        {isExpanded && (
                          <tr className="expense-details-row">
                            <td colSpan={isManagerOrHR ? 8 : 7} className="expense-details-cell">
                              <div className="expense-details-content">
                                {/* Duplicate Warning for Managers/HR */}
                                {isManagerOrHR && expense.hasPotentialDuplicates && (
                                  <div className="details-section-inline duplicate-warning-inline">
                                    <h4><i className="fas fa-exclamation-triangle"></i> Potential Duplicate Detected</h4>
                                    <p className="duplicate-warning-text">
                                      This expense appears similar to {expense.duplicateCount} other expense(s) from the same employee:
                                    </p>
                                    <div className="duplicate-list">
                                      {expense.potentialDuplicates?.map((dup, idx) => (
                                        <div key={idx} className="duplicate-item">
                                          <div className="duplicate-item-header">
                                            <span className="duplicate-item-title">{dup.title}</span>
                                            <span className="duplicate-item-status" style={{ 
                                              background: getStatusStyle(dup.status).bg, 
                                              color: getStatusStyle(dup.status).text 
                                            }}>
                                              {getStatusStyle(dup.status).label}
                                            </span>
                                          </div>
                                          <div className="duplicate-item-details">
                                            <span><i className="fas fa-rupee-sign"></i> ₹{dup.amount?.toLocaleString('en-IN')}</span>
                                            <span><i className="fas fa-calendar"></i> {new Date(dup.date).toLocaleDateString('en-IN')}</span>
                                            <span><i className="fas fa-folder"></i> {dup.billingMonth}</span>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                    <p className="duplicate-warning-note">
                                      <i className="fas fa-info-circle"></i> Review carefully before approving. This may be a legitimate expense or an accidental duplicate.
                                    </p>
                                  </div>
                                )}

                                {/* Bills Section */}
                                {expense.bills && expense.bills.length > 0 && (
                                  <div className="details-section-inline">
                                    <h4><i className="fas fa-paperclip"></i> Bills & Receipts ({expense.bills.length})</h4>
                                    <div className="inline-bills-grid">
                                      {expense.bills.map((bill, idx) => (
                                        <div key={idx} className="inline-bill-card">
                                          <div className="inline-bill-icon">
                                            <i className={`fas ${bill.filePath?.match(/\.pdf$/i) ? 'fa-file-pdf' : 'fa-image'}`}></i>
                                          </div>
                                          <span className="inline-bill-name">{bill.fileName}</span>
                                          <button
                                            className="inline-bill-view"
                                            onClick={async () => {
                                              try {
                                                const res = await api.get(`/api/expenses/${expense._id}/bills/${idx}/view`, { responseType: 'blob' });
                                                const url = URL.createObjectURL(res.data);
                                                window.open(url, '_blank');
                                              } catch (e) {
                                                Swal.fire('Error', 'Could not open bill', 'error');
                                              }
                                            }}
                                          >
                                            <i className="fas fa-external-link-alt"></i>
                                          </button>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}

                                {/* Timeline Section */}
                                {expense.timeline && expense.timeline.length > 0 && (
                                  <div className="details-section-inline">
                                    <h4><i className="fas fa-history"></i> Timeline & History</h4>
                                    <div className="inline-timeline">
                                      {expense.timeline.map((entry, idx) => {
                                        const cfg = timelineConfig[entry.status] || timelineConfig.SUBMITTED;
                                        return (
                                          <div key={idx} className="inline-timeline-item">
                                            <div className="inline-timeline-dot" style={{ background: cfg.color }}></div>
                                            <div className="inline-timeline-content">
                                              <div className="inline-timeline-header">
                                                <span className="inline-timeline-status" style={{ color: cfg.color }}>
                                                  <i className={`fas ${cfg.icon}`}></i> {entry.status}
                                                </span>
                                                <span className="inline-timeline-time">{new Date(entry.timestamp).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                                              </div>
                                              <div className="inline-timeline-actor">By: {entry.actorName}</div>
                                              {entry.note && <div className="inline-timeline-note">{entry.note}</div>}
                                            </div>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>
                                )}

                                {/* Rejection Reason */}
                                {expense.status === 'REJECTED' && expense.rejectionReason && (
                                  <div className="details-section-inline rejection-inline">
                                    <h4><i className="fas fa-exclamation-circle"></i> Rejection Reason</h4>
                                    <p className="inline-rejection-text">{expense.rejectionReason}</p>
                                  </div>
                                )}

                                {/* Payment Note */}
                                {expense.status === 'REIMBURSED' && expense.reimbursementNote && (
                                  <div className="details-section-inline payment-inline">
                                    <h4><i className="fas fa-check-circle"></i> Payment Note</h4>
                                    <p className="inline-payment-text">{expense.reimbursementNote}</p>
                                  </div>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Accordion View */}
            <div className="expenses-accordion-mobile">
              {sortedExpenses.map(expense => {
                const statusStyle = getStatusStyle(expense.status);
                const categoryIcon = getCategoryIcon(expense.category);
                const isExpanded = expandedExpense === expense._id;
                
                return (
                  <div key={expense._id} className={`accordion-item ${isExpanded ? 'expanded' : ''}`}>
                    {/* Accordion Header */}
                    <div className="accordion-header" onClick={() => setExpandedExpense(isExpanded ? null : expense._id)}>
                      <div className="accordion-header-left">
                        <div className="accordion-icon" style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}>
                          <i className={`fas ${categoryIcon}`}></i>
                        </div>
                        <div className="accordion-info">
                          <div className="accordion-title">{expense.title}</div>
                          <div className="accordion-meta">
                            <span className="accordion-date">
                              <i className="fas fa-calendar"></i>
                              {new Date(expense.expenseDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                            </span>
                            <span className="accordion-category">{expense.category}</span>
                          </div>
                        </div>
                      </div>
                      <div className="accordion-header-right">
                        <div className="accordion-amount">₹{expense.amount?.toLocaleString('en-IN')}</div>
                        <span className="accordion-status" style={{ background: statusStyle.bg, color: statusStyle.text }}>
                          <i className={`fas ${statusStyle.icon}`}></i>
                        </span>
                        <i className={`fas fa-chevron-${isExpanded ? 'up' : 'down'} accordion-toggle`}></i>
                      </div>
                    </div>

                    {/* Accordion Content */}
                    {isExpanded && (
                      <div className="accordion-content">
                        {/* Duplicate Warning for Managers/HR */}
                        {isManagerOrHR && expense.hasPotentialDuplicates && (
                          <div className="accordion-detail full-width duplicate-warning-mobile">
                            <span className="detail-label"><i className="fas fa-exclamation-triangle"></i> Potential Duplicate</span>
                            <div className="duplicate-warning-box">
                              <p>This expense appears similar to {expense.duplicateCount} other expense(s):</p>
                              {expense.potentialDuplicates?.map((dup, idx) => (
                                <div key={idx} className="duplicate-item-mobile">
                                  <div className="duplicate-mobile-title">{dup.title}</div>
                                  <div className="duplicate-mobile-info">
                                    <span>₹{dup.amount?.toLocaleString('en-IN')}</span>
                                    <span>{new Date(dup.date).toLocaleDateString('en-IN')}</span>
                                    <span className="duplicate-mobile-status" style={{ 
                                      background: getStatusStyle(dup.status).bg, 
                                      color: getStatusStyle(dup.status).text 
                                    }}>
                                      {getStatusStyle(dup.status).label}
                                    </span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {isManagerOrHR && expense.employeeId && (
                          <div className="accordion-detail">
                            <span className="detail-label"><i className="fas fa-user"></i> Employee</span>
                            <span className="detail-value">{expense.employeeId.firstName} {expense.employeeId.lastName}</span>
                          </div>
                        )}
                        {expense.employeeId?.department && (
                          <div className="accordion-detail">
                            <span className="detail-label"><i className="fas fa-building"></i> Department</span>
                            <span className="detail-value">{expense.employeeId.department}</span>
                          </div>
                        )}
                        {expense.description && (
                          <div className="accordion-detail full-width">
                            <span className="detail-label"><i className="fas fa-align-left"></i> Description</span>
                            <span className="detail-value">{expense.description}</span>
                          </div>
                        )}
                        <div className="accordion-detail">
                          <span className="detail-label"><i className="fas fa-info-circle"></i> Status</span>
                          <span className="detail-value">
                            <span className="mobile-status-badge" style={{ background: statusStyle.bg, color: statusStyle.text, border: `1.5px solid ${statusStyle.border}` }}>
                              <i className={`fas ${statusStyle.icon}`}></i>
                              {statusStyle.label}
                            </span>
                          </span>
                        </div>

                        {/* Bills */}
                        {expense.bills && expense.bills.length > 0 && (
                          <div className="accordion-detail full-width">
                            <span className="detail-label"><i className="fas fa-paperclip"></i> Bills ({expense.bills.length})</span>
                            <div className="accordion-bills">
                              {expense.bills.map((bill, idx) => (
                                <button
                                  key={idx}
                                  className="accordion-bill-btn"
                                  onClick={async () => {
                                    try {
                                      const res = await api.get(`/api/expenses/${expense._id}/bills/${idx}/view`, { responseType: 'blob' });
                                      const url = URL.createObjectURL(res.data);
                                      window.open(url, '_blank');
                                    } catch (e) {
                                      Swal.fire('Error', 'Could not open bill', 'error');
                                    }
                                  }}
                                >
                                  <i className={`fas ${bill.filePath?.match(/\.pdf$/i) ? 'fa-file-pdf' : 'fa-image'}`}></i>
                                  {bill.fileName.substring(0, 15)}...
                                </button>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Timeline */}
                        {expense.timeline && expense.timeline.length > 0 && (
                          <div className="accordion-detail full-width">
                            <span className="detail-label"><i className="fas fa-history"></i> History</span>
                            <div className="accordion-timeline">
                              {expense.timeline.map((entry, idx) => {
                                const cfg = timelineConfig[entry.status] || timelineConfig.SUBMITTED;
                                return (
                                  <div key={idx} className="timeline-entry">
                                    <div className="timeline-dot" style={{ background: cfg.color }}></div>
                                    <div className="timeline-info">
                                      <span className="timeline-status" style={{ color: cfg.color }}>{entry.status}</span>
                                      <span className="timeline-actor">{entry.actorName}</span>
                                      <span className="timeline-time">{new Date(entry.timestamp).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                                      {entry.note && <div className="timeline-note">{entry.note}</div>}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {/* Actions */}
                        <div className="accordion-actions">
                          {isEmployee && canOperate && expense.status === 'REJECTED' && (
                            <>
                              <button className="accordion-action-btn edit" onClick={() => openEdit(expense)}>
                                <i className="fas fa-edit"></i> Edit
                              </button>
                              <button className="accordion-action-btn delete" onClick={() => handleDelete(expense._id)}>
                                <i className="fas fa-trash"></i> Delete
                              </button>
                            </>
                          )}
                          {isEmployee && canOperate && expense.status === 'SUBMITTED' && (
                            <button className="accordion-action-btn delete" onClick={() => handleDelete(expense._id)}>
                              <i className="fas fa-trash"></i> Delete
                            </button>
                          )}
                          {isManagerOrHR && expense.status === 'SUBMITTED' && (
                            <>
                              <button className="accordion-action-btn approve" onClick={() => handleApproveReject(expense._id, 'APPROVED')}>
                                <i className="fas fa-check"></i> Approve
                              </button>
                              <button className="accordion-action-btn reject" onClick={() => {
                                setRejectingExpenseId(expense._id);
                                setShowRejectModal(true);
                              }}>
                                <i className="fas fa-times"></i> Reject
                              </button>
                            </>
                          )}
                          {isHROrAdmin && expense.status === 'APPROVED' && (
                            <button className="accordion-action-btn reimburse" onClick={() => {
                              setReimbursingExpenseId(expense._id);
                              setShowReimburseModal(true);
                            }}>
                              <i className="fas fa-wallet"></i> Mark as Paid
                            </button>
                          )}
                          {isHROrAdmin && (
                            <button 
                              className="accordion-action-btn admin-delete" 
                              onClick={async () => {
                                const { value: reason } = await Swal.fire({
                                  title: 'Delete Expense?',
                                  input: 'textarea',
                                  inputLabel: 'Deletion Reason (Required)',
                                  inputPlaceholder: 'e.g., Duplicate entry, Fraudulent claim',
                                  showCancelButton: true,
                                  confirmButtonColor: '#dc2626',
                                  confirmButtonText: 'Delete',
                                  inputValidator: (value) => !value && 'Please provide a reason'
                                });
                                if (reason) {
                                  try {
                                    await api.delete(`/api/expenses/${expense._id}`, {
                                      data: { deletionReason: reason }
                                    });
                                    swal.success('Expense deleted');
                                    fetchExpenses();
                                  } catch (error) {
                                    swal.error(error.response?.data?.message || 'Error');
                                  }
                                }
                              }}
                            >
                              <i className="fas fa-trash-alt"></i> Admin Delete
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
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
        </>
      )}

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
                      <option value="TRAVEL">Travel</option>
                      <option value="MEALS">Meals</option>
                      <option value="ACCOMMODATION">Accommodation</option>
                      <option value="TRANSPORT">Transport</option>
                      <option value="OFFICE_SUPPLIES">Office Supplies</option>
                      <option value="TRAINING">Training</option>
                      <option value="OTHER">Other</option>
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
