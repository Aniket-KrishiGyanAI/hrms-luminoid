import React, { useState, useEffect, useRef } from 'react';
import { Row, Col, Card, Button, Modal, Form, Table, Badge, Tabs, Tab } from 'react-bootstrap';
import { useAuth } from '../context/AuthContext';
import { useLocation } from 'react-router-dom';
import api from '../utils/api';
import { toast } from 'react-toastify';
import Swal from 'sweetalert2';
import { scheduleTaskReminder, checkDailyReminder, requestNotificationPermission, isWorkingDay } from '../utils/taskReminder';
import '../styles/TaskResponsive.css';
import '../styles/ModalFix.css';
import MobileTaskDetails from '../components/MobileTaskDetails';
import MobileDailyUpdate from '../components/MobileDailyUpdate';
import WorkLogModal from '../components/WorkLogModal';

const Tasks = () => {
  const { user } = useAuth();
  const location = useLocation();
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pendingUpdatesCount, setPendingUpdatesCount] = useState(0);
  const [showCheckInModal, setShowCheckInModal] = useState(false);
  const [showCheckOutModal, setShowCheckOutModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [showWorkLogModal, setShowWorkLogModal] = useState(false);
  const [showWorkLogHistory, setShowWorkLogHistory] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [workLogs, setWorkLogs] = useState([]);
  const [filteredWorkLogs, setFilteredWorkLogs] = useState([]);
  const [workLogFilters, setWorkLogFilters] = useState({ search: '', status: '', dateRange: 'all', startDate: '', endDate: '' });
  const [workLogPage, setWorkLogPage] = useState(1);
  const [workLogTotal, setWorkLogTotal] = useState(0);
  const [selectedWorkLogDetail, setSelectedWorkLogDetail] = useState(null);
  const [showWorkLogDetailModal, setShowWorkLogDetailModal] = useState(false);
  const [hasLoggedToday, setHasLoggedToday] = useState(true);
  const [selectedTemplate, setSelectedTemplate] = useState('GENERAL');
  const [bulkLogs, setBulkLogs] = useState([{ workDone: '', hoursSpent: '', category: 'GENERAL', status: 'COMPLETED', project: '', deliverables: '', location: 'OFFICE', issues: '', date: new Date().toISOString().split('T')[0], templateData: {}, customCategory: '' }]);

  const TEMPLATES = {
    GENERAL: { name: 'General Work', fields: ['date', 'workDone', 'hoursSpent', 'status', 'location'] },
    SALES: { name: 'Sales & Business Development', fields: ['workDone', 'clientName', 'meetingType', 'leadStatus', 'orderValue', 'nextFollowUp', 'hoursSpent', 'status', 'location', 'date', 'issues'] },
    ENGINEERING: { name: 'Engineering & Development', fields: ['workDone', 'moduleName', 'ticketId', 'repository', 'testingStatus', 'deliverables', 'hoursSpent', 'status', 'location', 'date', 'issues'] },
    HR: { name: 'Human Resources', fields: ['workDone', 'employeeName', 'activityType', 'candidatesCount', 'deliverables', 'hoursSpent', 'status', 'location', 'date', 'issues'] },
    OPERATIONS: { name: 'Operations & Field Work', fields: ['workDone', 'siteName', 'assetId', 'maintenanceType', 'travelDistance', 'deliverables', 'hoursSpent', 'status', 'location', 'date', 'issues'] },
    MARKETING: { name: 'Marketing & Communications', fields: ['workDone', 'campaignName', 'platform', 'reach', 'contentType', 'deliverables', 'hoursSpent', 'status', 'location', 'date', 'issues'] },
    FINANCE: { name: 'Finance & Accounting', fields: ['workDone', 'transactionType', 'amountProcessed', 'vendorClient', 'invoiceNumbers', 'deliverables', 'hoursSpent', 'status', 'location', 'date', 'issues'] }
  };
  const [selectedTask, setSelectedTask] = useState(null);
  const [comment, setComment] = useState('');
  const [loadingStates, setLoadingStates] = useState({});
  const [mentionSuggestions, setMentionSuggestions] = useState([]);
  const [showMentions, setShowMentions] = useState(false);
  const [mentionSearch, setMentionSearch] = useState('');
  const [employees, setEmployees] = useState([]);
  const [gpsAddresses, setGpsAddresses] = useState({ checkIn: '', checkOut: '' });
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [formErrors, setFormErrors] = useState({});
  const [updateForm, setUpdateForm] = useState({
    progressPercent: 0,
    status: 'ON_TRACK',
    workDone: '',
    issues: '',
    nextDayPlan: '',
    hoursSpent: '',
    visitOutcome: '',
    orderValue: ''
  });
  const [checkOutForm, setCheckOutForm] = useState({
    outcome: '',
    notes: '',
    orderValue: '',
    orderDetails: '',
    nextFollowUpDate: '',
    actualHours: ''
  });
  const [workLogForm, setWorkLogForm] = useState({
    workDone: '',
    hoursSpent: '',
    category: 'GENERAL'
  });
  
  const reminderIntervalRef = useRef(null);
  const taskRefreshIntervalRef = useRef(null);

  useEffect(() => {
    fetchTasks();
    fetchEmployees();
    checkTodayLog();
    
    // Handle window resize
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    window.addEventListener('resize', handleResize);
    
    // Request notification permission on load
    requestNotificationPermission();
    
    // Check for daily reminder
    const checkReminder = () => {
      if (isWorkingDay() && tasks.length > 0) {
        if (checkDailyReminder()) {
          scheduleTaskReminder(tasks);
        }
      }
    };
    
    checkReminder();
    
    // Check every 30 minutes for 5:30 PM reminder (optimized from 5 min)
    reminderIntervalRef.current = setInterval(() => {
      if (isWorkingDay() && tasks.length > 0) {
        scheduleTaskReminder(tasks);
      }
    }, 1800000); // 30 minutes
    
    // Network status listeners
    const handleOnline = () => {
      setIsOnline(true);
      toast.success('Back online!');
      fetchTasks();
    };
    const handleOffline = () => {
      setIsOnline(false);
      toast.warning('You are offline. Some features may not work.');
    };
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      clearInterval(reminderIntervalRef.current);
      clearInterval(taskRefreshIntervalRef.current);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  useEffect(() => {
    // Open task from notification
    if (location.state?.openTaskId && tasks.length > 0) {
      const taskToOpen = tasks.find(t => t._id === location.state.openTaskId);
      if (taskToOpen) {
        handleViewTask(taskToOpen);
        // Clear the state
        window.history.replaceState({}, document.title);
      }
    }
  }, [location.state, tasks]);

  useEffect(() => {
    // Trigger reminder check when tasks are loaded
    if (tasks.length > 0 && isWorkingDay()) {
      if (checkDailyReminder()) {
        scheduleTaskReminder(tasks);
      }
    }
  }, [tasks]);

  useEffect(() => {
    // Optimized auto-refresh: 30s instead of 3s, only when visible and online
    if (showDetailsModal && selectedTask && isOnline) {
      const refreshTask = async () => {
        if (document.visibilityState === 'visible') {
          try {
            const response = await api.get(`/api/tasks/${selectedTask._id}`);
            setSelectedTask(response.data);
          } catch (error) {
            console.error('Error refreshing task:', error);
          }
        }
      };
      
      taskRefreshIntervalRef.current = setInterval(refreshTask, 30000);
    }
    
    return () => {
      if (taskRefreshIntervalRef.current) {
        clearInterval(taskRefreshIntervalRef.current);
      }
    };
  }, [showDetailsModal, selectedTask, isOnline]);

  const fetchTasks = async () => {
    if (!isOnline) {
      toast.error('No internet connection');
      setLoading(false);
      return;
    }
    
    try {
      const response = await api.get('/api/tasks');
      setTasks(response.data);
      
      // Calculate pending updates (tasks in progress not updated in 24 hours)
      const now = new Date();
      const pending = response.data.filter(task => {
        if (task.status !== 'IN_PROGRESS') return false;
        if (!task.dailyUpdates || task.dailyUpdates.length === 0) return true;
        const lastUpdate = new Date(task.dailyUpdates[task.dailyUpdates.length - 1].date);
        const hoursSinceUpdate = (now - lastUpdate) / (1000 * 60 * 60);
        return hoursSinceUpdate > 24;
      });
      setPendingUpdatesCount(pending.length);
    } catch (error) {
      const errorMsg = error.response?.data?.message || 'Error fetching tasks. Please try again.';
      toast.error(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const fetchEmployees = async () => {
    try {
      const response = await api.get('/api/employees');
      setEmployees(response.data);
    } catch (error) {
      console.error('Error fetching employees');
    }
  };

  const getLocation = () => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocation not supported'));
      }
      navigator.geolocation.getCurrentPosition(
        (position) => resolve({ lat: position.coords.latitude, lng: position.coords.longitude }),
        (error) => reject(error)
      );
    });
  };

  const handleCheckIn = async (task) => {
    if (!isOnline) {
      toast.error('Cannot start task while offline');
      return;
    }
    
    setLoadingStates(prev => ({ ...prev, [`checkin-${task._id}`]: true }));
    try {
      if (task.requireCheckIn) {
        const location = await getLocation();
        await api.post(`/api/tasks/${task._id}/check-in`, location);
      } else {
        await api.put(`/api/tasks/${task._id}/status`, { status: 'IN_PROGRESS' });
      }
      toast.success('Task started successfully');
      fetchTasks();
      setShowCheckInModal(false);
    } catch (error) {
      const errorMsg = error.response?.data?.message || error.message || 'Error starting task';
      toast.error(errorMsg);
    } finally {
      setLoadingStates(prev => ({ ...prev, [`checkin-${task._id}`]: false }));
    }
  };

  const handleCheckOut = async (e) => {
    e.preventDefault();
    setLoadingStates(prev => ({ ...prev, checkout: true }));
    try {
      if (selectedTask.requireCheckIn) {
        const location = await getLocation();
        await api.post(`/api/tasks/${selectedTask._id}/check-out`, {
          ...location,
          ...checkOutForm
        });
      } else {
        await api.post(`/api/tasks/${selectedTask._id}/check-out`, {
          lat: 0, lng: 0,
          ...checkOutForm
        });
      }
      toast.success('Task completed');
      fetchTasks();
      setShowCheckOutModal(false);
      setCheckOutForm({ outcome: '', notes: '', orderValue: '', orderDetails: '', nextFollowUpDate: '', actualHours: '' });
    } catch (error) {
      toast.error('Error completing task');
    } finally {
      setLoadingStates(prev => ({ ...prev, checkout: false }));
    }
  };

  const handleAddComment = async (commentText) => {
    if (!commentText.trim()) return;
    try {
      const response = await api.post(`/api/tasks/${selectedTask._id}/comments`, { text: commentText });
      setSelectedTask(response.data);
      setComment('');
      setShowMentions(false);
    } catch (error) {
      console.error('Error adding comment:', error);
    }
  };

  const handleCommentChange = (e) => {
    const value = e.target.value;
    setComment(value);
    
    const lastAtIndex = value.lastIndexOf('@');
    if (lastAtIndex !== -1) {
      const searchTerm = value.substring(lastAtIndex + 1);
      if (searchTerm && !searchTerm.includes(' ')) {
        setMentionSearch(searchTerm);
        const filtered = employees.filter(emp => 
          `${emp.firstName} ${emp.lastName}`.toLowerCase().includes(searchTerm.toLowerCase())
        );
        setMentionSuggestions(filtered);
        setShowMentions(filtered.length > 0);
      } else {
        setShowMentions(false);
      }
    } else {
      setShowMentions(false);
    }
  };

  const handleMentionSelect = (emp) => {
    const lastAtIndex = comment.lastIndexOf('@');
    const newComment = comment.substring(0, lastAtIndex) + `@${emp.firstName} `;
    setComment(newComment);
    setShowMentions(false);
  };

  const getAddressFromCoords = async (lat, lng) => {
    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`);
      const data = await response.json();
      return data.display_name || `${lat}, ${lng}`;
    } catch (error) {
      return `${lat}, ${lng}`;
    }
  };

  const handleViewTask = async (task) => {
    const response = await api.get(`/api/tasks/${task._id}`);
    setSelectedTask(response.data);
    setShowDetailsModal(true);
    
    if (response.data.requireCheckIn) {
      if (response.data.checkIn?.location) {
        const checkInAddr = await getAddressFromCoords(response.data.checkIn.location.lat, response.data.checkIn.location.lng);
        setGpsAddresses(prev => ({ ...prev, checkIn: checkInAddr }));
      }
      if (response.data.checkOut?.location) {
        const checkOutAddr = await getAddressFromCoords(response.data.checkOut.location.lat, response.data.checkOut.location.lng);
        setGpsAddresses(prev => ({ ...prev, checkOut: checkOutAddr }));
      }
    }
  };

  const handleDailyUpdate = async (e) => {
    e.preventDefault();
    
    // Validation
    const errors = {};
    if (!updateForm.workDone || updateForm.workDone.trim().length < 10) {
      errors.workDone = 'Work description must be at least 10 characters';
    }
    if (updateForm.hoursSpent && (parseFloat(updateForm.hoursSpent) <= 0 || parseFloat(updateForm.hoursSpent) > 24)) {
      errors.hoursSpent = 'Hours must be between 0 and 24';
    }
    if ((updateForm.status === 'BLOCKED' || updateForm.status === 'NEED_HELP') && !updateForm.issues) {
      errors.issues = 'Please describe the issue';
    }
    
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      toast.error('Please fix the form errors');
      return;
    }
    
    if (!isOnline) {
      toast.error('Cannot submit update while offline');
      return;
    }
    
    setLoadingStates(prev => ({ ...prev, update: true }));
    try {
      // Remove empty string values to avoid enum validation errors
      const cleanedData = Object.fromEntries(
        Object.entries(updateForm).filter(([_, v]) => v !== '')
      );
      await api.post(`/api/tasks/${selectedTask._id}/daily-update`, cleanedData);
      toast.success('Daily update submitted successfully');
      setShowUpdateModal(false);
      setUpdateForm({ 
        progressPercent: 0, 
        status: 'ON_TRACK', 
        workDone: '', 
        issues: '', 
        nextDayPlan: '', 
        hoursSpent: '', 
        visitOutcome: '', 
        orderValue: '' 
      });
      setFormErrors({});
      fetchTasks();
    } catch (error) {
      console.error('Update error:', error.response?.data || error.message);
      toast.error(error.response?.data?.message || 'Error submitting update');
    } finally {
      setLoadingStates(prev => ({ ...prev, update: false }));
    }
  };

  const checkTodayLog = async () => {
    try {
      const response = await api.get('/api/work-logs/check-today');
      setHasLoggedToday(response.data.hasLoggedToday);
    } catch (error) {
      console.error('Error checking today log');
    }
  };

  const fetchWorkLogs = async () => {
    try {
      const response = await api.get(`/api/work-logs?page=${workLogPage}&limit=20`);
      setWorkLogs(response.data.logs);
      setFilteredWorkLogs(response.data.logs);
      setWorkLogTotal(response.data.total);
    } catch (error) {
      toast.error('Error fetching work logs');
    }
  };

  const applyWorkLogFilters = () => {
    let filtered = [...workLogs];
    
    if (workLogFilters.search) {
      const search = workLogFilters.search.toLowerCase();
      filtered = filtered.filter(log => 
        log.workDone.toLowerCase().includes(search) || 
        log.project?.toLowerCase().includes(search) ||
        log.deliverables?.toLowerCase().includes(search)
      );
    }
    
    if (workLogFilters.status) {
      filtered = filtered.filter(log => log.status === workLogFilters.status);
    }
    
    if (workLogFilters.dateRange !== 'all') {
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      
      if (workLogFilters.dateRange === 'today') {
        filtered = filtered.filter(log => new Date(log.date) >= today);
      } else if (workLogFilters.dateRange === 'week') {
        const weekAgo = new Date(today);
        weekAgo.setDate(weekAgo.getDate() - 7);
        filtered = filtered.filter(log => new Date(log.date) >= weekAgo);
      } else if (workLogFilters.dateRange === 'month') {
        const monthAgo = new Date(today);
        monthAgo.setMonth(monthAgo.getMonth() - 1);
        filtered = filtered.filter(log => new Date(log.date) >= monthAgo);
      } else if (workLogFilters.dateRange === 'custom' && workLogFilters.startDate && workLogFilters.endDate) {
        filtered = filtered.filter(log => {
          const logDate = new Date(log.date);
          return logDate >= new Date(workLogFilters.startDate) && logDate <= new Date(workLogFilters.endDate);
        });
      }
    }
    
    setFilteredWorkLogs(filtered);
  };

  const exportWorkLogReport = () => {
    const csv = [
      ['Date', 'Status', 'Location', 'Project', 'Work Done', 'Deliverables', 'Hours', 'Issues'],
      ...filteredWorkLogs.map(log => [
        new Date(log.date).toLocaleDateString('en-GB'),
        log.status,
        log.location,
        log.project || '',
        log.workDone,
        log.deliverables || '',
        log.hoursSpent,
        log.issues || ''
      ])
    ].map(row => row.join(',')).join('\n');
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `work-log-report-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    toast.success('Report exported successfully');
  };

  const validateWorkLog = () => {
    const errors = {};
    
    bulkLogs.forEach((log, index) => {
      if (!log.workDone || log.workDone.trim().length < 10) {
        errors[`workDone-${index}`] = 'Work description must be at least 10 characters';
      }
      
      if (!log.hoursSpent || parseFloat(log.hoursSpent) <= 0 || parseFloat(log.hoursSpent) > 24) {
        errors[`hoursSpent-${index}`] = 'Hours must be between 0 and 24';
      }
      
      if (log.status === 'BLOCKED' && (!log.issues || log.issues.trim().length < 5)) {
        errors[`issues-${index}`] = 'Please describe the blocker';
      }
    });
    
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleWorkLogSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateWorkLog()) {
      toast.error('Please fix the form errors');
      return;
    }
    
    if (!isOnline) {
      toast.error('Cannot submit work log while offline');
      return;
    }
    
    setLoadingStates(prev => ({ ...prev, worklog: true }));
    try {
      await api.post('/api/work-logs/bulk', { logs: bulkLogs });
      toast.success('Work log submitted successfully');
      setShowWorkLogModal(false);
      setBulkLogs([{ workDone: '', hoursSpent: '', category: 'GENERAL', status: 'COMPLETED', project: '', deliverables: '', location: 'OFFICE', issues: '', date: new Date().toISOString().split('T')[0], templateData: {}, customCategory: '' }]);
      setFormErrors({});
      checkTodayLog();
      fetchWorkLogs();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Error submitting work log');
    } finally {
      setLoadingStates(prev => ({ ...prev, worklog: false }));
    }
  };

  const handleViewWorkLogDetail = async (log) => {
    try {
      const response = await api.get(`/api/work-logs/${log._id}`);
      setSelectedWorkLogDetail(response.data);
      setShowWorkLogDetailModal(true);
    } catch (error) {
      toast.error('Error fetching work log details');
    }
  };

  const handleEditMyWorkLog = async (log) => {
    const hoursSinceCreation = (Date.now() - new Date(log.createdAt)) / (1000 * 60 * 60);
    if (hoursSinceCreation > 24) {
      toast.error('Can only edit work logs within 24 hours');
      return;
    }
    setSelectedWorkLogDetail(log);
    setBulkLogs([{
      workDone: log.workDone,
      hoursSpent: log.hoursSpent,
      category: log.category,
      status: log.status,
      project: log.project || '',
      deliverables: log.deliverables || '',
      location: log.location,
      issues: log.issues || '',
      date: new Date(log.date).toISOString().split('T')[0],
      templateData: log.templateData || {},
      customCategory: ''
    }]);
    setShowWorkLogModal(true);
  };

  const handleUpdateMyWorkLog = async (e) => {
    e.preventDefault();
    setLoadingStates(prev => ({ ...prev, worklog: true }));
    try {
      await api.put(`/api/work-logs/${selectedWorkLogDetail._id}`, bulkLogs[0]);
      toast.success('Work log updated');
      setShowWorkLogModal(false);
      setSelectedWorkLogDetail(null);
      setBulkLogs([{ workDone: '', hoursSpent: '', category: 'GENERAL', status: 'COMPLETED', project: '', deliverables: '', location: 'OFFICE', issues: '', date: new Date().toISOString().split('T')[0], templateData: {}, customCategory: '' }]);
      fetchWorkLogs();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Error updating work log');
    } finally {
      setLoadingStates(prev => ({ ...prev, worklog: false }));
    }
  };

  const handleDeleteMyWorkLog = async (logId) => {
    const result = await Swal.fire({
      title: 'Delete Work Log?',
      text: 'This action cannot be undone',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#6c757d',
      confirmButtonText: 'Yes, delete it'
    });
    if (result.isConfirmed) {
      try {
        await api.delete(`/api/work-logs/${logId}`);
        toast.success('Work log deleted');
        fetchWorkLogs();
      } catch (error) {
        toast.error(error.response?.data?.message || 'Error deleting work log');
      }
    }
  };

  const addBulkLogEntry = () => {
    setBulkLogs([...bulkLogs, { workDone: '', hoursSpent: '', category: 'GENERAL', status: 'COMPLETED', project: '', deliverables: '', location: 'OFFICE', issues: '', date: new Date().toISOString().split('T')[0], templateData: {}, customCategory: '' }]);
  };

  const renderTemplateField = (log, index, fieldName) => {
    const value = log.templateData?.[fieldName] || '';
    const updateField = (val) => {
      const updated = [...bulkLogs];
      if (!updated[index].templateData) updated[index].templateData = {};
      updated[index].templateData[fieldName] = val;
      setBulkLogs(updated);
    };

    const fieldConfigs = {
      clientName: { label: 'Client Name', type: 'text', placeholder: 'Enter client name', required: true },
      meetingType: { label: 'Meeting Type', type: 'select', options: ['Cold Call', 'Follow-up', 'Demo', 'Closing', 'Negotiation'], required: true },
      leadStatus: { label: 'Lead Status', type: 'select', options: ['Hot', 'Warm', 'Cold', 'Converted', 'Lost'], required: false },
      orderValue: { label: 'Order Value', type: 'number', placeholder: '0', required: false },
      nextFollowUp: { label: 'Next Follow-up Date', type: 'date', required: false },
      moduleName: { label: 'Module/Feature Name', type: 'text', placeholder: 'Enter module name', required: true },
      ticketId: { label: 'Bug/Ticket ID', type: 'text', placeholder: 'e.g., JIRA-123', required: false },
      repository: { label: 'Repository/Branch', type: 'text', placeholder: 'e.g., main, feature/xyz', required: false },
      testingStatus: { label: 'Testing Status', type: 'select', options: ['Not Started', 'In Progress', 'Completed', 'Failed'], required: false },
      employeeName: { label: 'Employee/Candidate Name', type: 'text', placeholder: 'Enter name', required: true },
      activityType: { label: 'Activity Type', type: 'select', options: ['Interview', 'Onboarding', 'Training', 'Performance Review', 'Policy Update'], required: true },
      candidatesCount: { label: 'Candidates Interviewed', type: 'number', placeholder: '0', required: false },
      siteName: { label: 'Site/Location Name', type: 'text', placeholder: 'Enter site name', required: true },
      assetId: { label: 'Equipment/Asset ID', type: 'text', placeholder: 'Enter asset ID', required: false },
      maintenanceType: { label: 'Maintenance Type', type: 'select', options: ['Preventive', 'Corrective', 'Emergency', 'Inspection'], required: false },
      travelDistance: { label: 'Travel Distance (KM)', type: 'number', placeholder: '0', required: false },
      campaignName: { label: 'Campaign Name', type: 'text', placeholder: 'Enter campaign name', required: true },
      platform: { label: 'Platform', type: 'select', options: ['Facebook', 'Instagram', 'LinkedIn', 'Twitter', 'Email', 'Website', 'Other'], required: false },
      reach: { label: 'Reach/Impressions', type: 'number', placeholder: '0', required: false },
      contentType: { label: 'Content Type', type: 'select', options: ['Post', 'Video', 'Article', 'Infographic', 'Email', 'Ad'], required: false },
      transactionType: { label: 'Transaction Type', type: 'select', options: ['Payment', 'Receipt', 'Invoice', 'Expense', 'Reimbursement'], required: true },
      amountProcessed: { label: 'Amount Processed', type: 'number', placeholder: '0', required: true },
      vendorClient: { label: 'Vendor/Client Name', type: 'text', placeholder: 'Enter name', required: false },
      invoiceNumbers: { label: 'Invoice Numbers', type: 'text', placeholder: 'e.g., INV-001, INV-002', required: false }
    };

    const config = fieldConfigs[fieldName];
    if (!config) return null;

    return (
      <Col md={6} key={fieldName}>
        <Form.Group className="mb-3">
          <Form.Label style={{fontWeight: '600', color: '#374151', fontSize: '0.9rem'}}>
            {config.label} {config.required && <span className="text-danger">*</span>}
          </Form.Label>
          {config.type === 'select' ? (
            <Form.Select value={value} onChange={(e) => updateField(e.target.value)} required={config.required} style={{borderRadius: '8px', border: '2px solid #e5e7eb', padding: '0.6rem', fontSize: '0.9rem'}}>
              <option value="">Select...</option>
              {config.options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
            </Form.Select>
          ) : (
            <Form.Control type={config.type} value={value} onChange={(e) => updateField(e.target.value)} placeholder={config.placeholder} required={config.required} style={{borderRadius: '8px', border: '2px solid #e5e7eb', padding: '0.6rem', fontSize: '0.9rem'}} />
          )}
        </Form.Group>
      </Col>
    );
  };

  const removeBulkLogEntry = (index) => {
    setBulkLogs(bulkLogs.filter((_, i) => i !== index));
  };

  const updateBulkLogEntry = (index, field, value) => {
    const updated = [...bulkLogs];
    updated[index][field] = value;
    setBulkLogs(updated);
  };

  const getLastUpdateTime = (task) => {
    if (!task.dailyUpdates || task.dailyUpdates.length === 0) return 'Never updated';
    const lastUpdate = new Date(task.dailyUpdates[task.dailyUpdates.length - 1].date);
    const now = new Date();
    const hours = Math.floor((now - lastUpdate) / (1000 * 60 * 60));
    if (hours < 1) return 'Updated recently';
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  const isUpdateOverdue = (task) => {
    if (task.status !== 'IN_PROGRESS') return false;
    if (!task.dailyUpdates || task.dailyUpdates.length === 0) return false;
    
    const lastUpdate = new Date(task.dailyUpdates[task.dailyUpdates.length - 1].date);
    const today = new Date();
    
    // Check if last update was today
    const isToday = lastUpdate.toDateString() === today.toDateString();
    if (isToday) return false;
    
    // Only show overdue on working days (Mon-Sat)
    const dayOfWeek = today.getDay();
    if (dayOfWeek === 0) return false; // Sunday
    
    // Only show for tasks assigned to current user
    const isAssignedToMe = task.assignedTo?.some(emp => emp._id === user?.id);
    return isAssignedToMe;
  };

  const getStatusBadge = (status) => {
    const variants = {
      ASSIGNED: 'secondary',
      IN_PROGRESS: 'info',
      REVIEW: 'warning',
      COMPLETED: 'success',
      CANCELLED: 'danger'
    };
    return <Badge bg={variants[status]}>{status.replace('_', ' ')}</Badge>;
  };

  const getPriorityBadge = (priority) => {
    const variants = { HIGH: 'danger', MEDIUM: 'warning', LOW: 'info' };
    return <Badge bg={variants[priority]}>{priority}</Badge>;
  };

  if (loading) {
    return (
      <div className="d-flex justify-content-center align-items-center" style={{height: '400px'}}>
        <div className="spinner-border text-primary" role="status"></div>
      </div>
    );
  }

  return (
    <div className="fade-in-up">
      {/* Offline Banner */}
      {!isOnline && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
          color: '#fff',
          padding: '0.75rem',
          textAlign: 'center',
          zIndex: 10000,
          fontSize: '0.9rem',
          fontWeight: 600,
          boxShadow: '0 2px 8px rgba(0,0,0,0.2)'
        }}>
          <i className="fas fa-wifi-slash me-2" />
          You are offline. Some features may not work.
        </div>
      )}
      
      <div className="page-header">
        <div className="d-flex justify-content-between align-items-center">
          <div>
            <h1 className="page-title">
              <i className="fas fa-tasks me-3" style={{color: '#10b981'}}></i>
              My Tasks
              {pendingUpdatesCount > 0 && (
                <Badge bg="danger" className="ms-3" style={{fontSize: '0.7rem', verticalAlign: 'middle'}}>
                  {pendingUpdatesCount} Pending Update{pendingUpdatesCount > 1 ? 's' : ''}
                </Badge>
              )}
            </h1>
            <p className="text-muted">View and manage your assigned tasks</p>
          </div>
          <div className="d-flex gap-2">
            {!hasLoggedToday && (
              <Badge bg="warning" text="dark" style={{fontSize: '0.9rem', padding: '0.5rem 1rem', display: 'flex', alignItems: 'center'}}>
                <i className="fas fa-exclamation-circle me-2"></i>No work logged today
              </Badge>
            )}
            <Button 
              variant="outline-success" 
              size="sm" 
              onClick={() => { fetchWorkLogs(); setShowWorkLogHistory(true); }}
              style={{borderWidth: '2px', fontWeight: '600'}}
            >
              <i className="fas fa-history me-2"></i>History
            </Button>
            <Button 
              style={{background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', border: 'none', fontWeight: '600', boxShadow: '0 2px 8px rgba(16, 185, 129, 0.3)'}}
              onClick={() => setShowWorkLogModal(true)}
            >
              <i className="fas fa-plus me-2"></i>Log Work
            </Button>
          </div>
        </div>
      </div>

      <Row>
        <Col>
          <Card style={{border: 'none', borderRadius: '16px', boxShadow: '0 4px 20px rgba(0,0,0,0.08)'}}>
            <Card.Header style={{background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', color: 'white', borderRadius: '16px 16px 0 0', padding: '1.5rem'}}>
              <div className="d-flex justify-content-between align-items-center">
                <div>
                  <h5 className="mb-1" style={{fontWeight: '700', fontSize: '1.3rem'}}>
                    <i className="fas fa-list-check me-2"></i>My Task List
                  </h5>
                  <small style={{opacity: 0.9}}>{tasks.length} task{tasks.length !== 1 ? 's' : ''} assigned to you</small>
                </div>
                <Badge bg="light" text="dark" style={{fontSize: '1rem', padding: '0.5rem 1rem'}}>
                  {tasks.filter(t => t.status === 'IN_PROGRESS').length} Active
                </Badge>
              </div>
            </Card.Header>
            <Card.Body style={{padding: '0'}}>
              {tasks.length > 0 ? (
                <>
                {/* Desktop Table View */}
                <div className="d-none d-md-block" style={{overflowX: 'auto'}}>
                <table className="table mb-0" style={{fontSize: '0.95rem'}}>
                  <thead style={{background: '#f8f9fa', borderBottom: '2px solid #e9ecef'}}>
                    <tr>
                      <th style={{padding: '1rem 1.5rem', fontWeight: '600', color: '#495057', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.5px', border: 'none'}}>Task Details</th>
                      <th style={{padding: '1rem 1.5rem', fontWeight: '600', color: '#495057', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.5px', border: 'none'}}>Department</th>
                      <th style={{padding: '1rem 1.5rem', fontWeight: '600', color: '#495057', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.5px', border: 'none'}}>Progress</th>
                      <th style={{padding: '1rem 1.5rem', fontWeight: '600', color: '#495057', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.5px', border: 'none'}}>Priority</th>
                      <th style={{padding: '1rem 1.5rem', fontWeight: '600', color: '#495057', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.5px', border: 'none'}}>Status</th>
                      <th style={{padding: '1rem 1.5rem', fontWeight: '600', color: '#495057', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.5px', border: 'none', textAlign: 'center'}}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tasks.map(task => (
                      <tr key={task._id} style={{background: isUpdateOverdue(task) ? '#fff8e1' : 'white', borderBottom: '1px solid #f1f3f5', transition: 'all 0.2s'}} onMouseEnter={(e) => e.currentTarget.style.background = '#f8f9fa'} onMouseLeave={(e) => e.currentTarget.style.background = isUpdateOverdue(task) ? '#fff8e1' : 'white'}>
                        <td style={{padding: '1.25rem 1.5rem', border: 'none', verticalAlign: 'middle'}}>
                          <div style={{display: 'flex', alignItems: 'start', gap: '1rem'}}>
                            <div style={{
                              width: '48px',
                              height: '48px',
                              borderRadius: '12px',
                              background: task.status === 'COMPLETED' ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)' : task.status === 'IN_PROGRESS' ? 'linear-gradient(135deg, #34d399 0%, #10b981 100%)' : 'linear-gradient(135deg, #6ee7b7 0%, #34d399 100%)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              color: 'white',
                              fontSize: '1.2rem',
                              flexShrink: 0
                            }}>
                              <i className={task.status === 'COMPLETED' ? 'fas fa-check-circle' : task.status === 'IN_PROGRESS' ? 'fas fa-spinner' : 'fas fa-clock'}></i>
                            </div>
                            <div style={{flex: 1, minWidth: 0}}>
                              <div style={{fontWeight: '600', color: '#1e293b', fontSize: '1rem', marginBottom: '0.25rem', lineHeight: '1.4'}}>{task.title}</div>
                              {task.description && <div style={{fontSize: '0.85rem', color: '#64748b', marginBottom: '0.5rem', lineHeight: '1.4', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden'}}>{task.description}</div>}
                              <div style={{display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center'}}>
                                <span style={{fontSize: '0.8rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: '0.25rem'}}>
                                  <i className="fas fa-briefcase" style={{fontSize: '0.75rem'}}></i>
                                  {task.taskType.replace(/_/g, ' ')}
                                </span>
                                <span style={{fontSize: '0.8rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: '0.25rem'}}>
                                  <i className="fas fa-calendar" style={{fontSize: '0.75rem'}}></i>
                                  {new Date(task.scheduledDate).toLocaleDateString('en-GB', {day: '2-digit', month: 'short'})}
                                </span>
                                <span style={{fontSize: '0.8rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: '0.25rem'}}>
                                  <i className="fas fa-clock" style={{fontSize: '0.75rem'}}></i>
                                  {getLastUpdateTime(task)}
                                </span>
                                {isUpdateOverdue(task) && (
                                  <Badge bg="warning" text="dark" style={{fontSize: '0.7rem', padding: '0.25rem 0.5rem'}}>
                                    <i className="fas fa-exclamation-triangle me-1"></i>Update Due
                                  </Badge>
                                )}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td style={{padding: '1.25rem 1.5rem', border: 'none', verticalAlign: 'middle'}}>
                          <div style={{display: 'flex', alignItems: 'center', gap: '0.5rem'}}>
                            <div style={{width: '8px', height: '8px', borderRadius: '50%', background: '#10b981'}}></div>
                            <span style={{fontWeight: '500', color: '#334155'}}>{task.department}</span>
                          </div>
                          <Badge bg="light" text="dark" style={{fontSize: '0.7rem', marginTop: '0.25rem', padding: '0.25rem 0.5rem'}}>
                            <i className="fas fa-map-marker-alt me-1"></i>{task.workLocation}
                          </Badge>
                        </td>
                        <td style={{padding: '1.25rem 1.5rem', border: 'none', verticalAlign: 'middle'}}>
                          <div style={{width: '100px'}}>
                            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem'}}>
                              <span style={{fontSize: '0.75rem', fontWeight: '600', color: '#64748b'}}>Progress</span>
                              <span style={{fontSize: '0.85rem', fontWeight: '700', color: task.progressPercent >= 75 ? '#059669' : task.progressPercent >= 50 ? '#10b981' : task.progressPercent >= 25 ? '#34d399' : '#6ee7b7'}}>{task.progressPercent || 0}%</span>
                            </div>
                            <div style={{height: '6px', background: '#e5e7eb', borderRadius: '3px', overflow: 'hidden'}}>
                              <div style={{
                                height: '100%',
                                width: `${task.progressPercent || 0}%`,
                                background: task.progressPercent >= 75 ? 'linear-gradient(90deg, #059669 0%, #047857 100%)' : task.progressPercent >= 50 ? 'linear-gradient(90deg, #10b981 0%, #059669 100%)' : task.progressPercent >= 25 ? 'linear-gradient(90deg, #34d399 0%, #10b981 100%)' : 'linear-gradient(90deg, #6ee7b7 0%, #34d399 100%)',
                                borderRadius: '3px',
                                transition: 'width 0.3s ease'
                              }}></div>
                            </div>
                          </div>
                        </td>
                        <td style={{padding: '1.25rem 1.5rem', border: 'none', verticalAlign: 'middle'}}>
                          <Badge style={{
                            background: task.priority === 'HIGH' ? 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)' : task.priority === 'MEDIUM' ? 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)' : 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                            border: 'none',
                            padding: '0.4rem 0.8rem',
                            fontSize: '0.8rem',
                            fontWeight: '600',
                            boxShadow: task.priority === 'HIGH' ? '0 2px 8px rgba(239, 68, 68, 0.3)' : task.priority === 'MEDIUM' ? '0 2px 8px rgba(245, 158, 11, 0.3)' : '0 2px 8px rgba(59, 130, 246, 0.3)'
                          }}>
                            <i className="fas fa-flag me-1"></i>{task.priority}
                          </Badge>
                        </td>
                        <td style={{padding: '1.25rem 1.5rem', border: 'none', verticalAlign: 'middle'}}>
                          <Badge style={{
                            background: task.status === 'COMPLETED' ? '#d1fae5' : task.status === 'IN_PROGRESS' ? '#a7f3d0' : task.status === 'REVIEW' ? '#fef3c7' : task.status === 'CANCELLED' ? '#fee2e2' : '#f3f4f6',
                            color: task.status === 'COMPLETED' ? '#065f46' : task.status === 'IN_PROGRESS' ? '#047857' : task.status === 'REVIEW' ? '#92400e' : task.status === 'CANCELLED' ? '#991b1b' : '#374151',
                            border: 'none',
                            padding: '0.4rem 0.8rem',
                            fontSize: '0.8rem',
                            fontWeight: '600'
                          }}>
                            <span style={{display: 'inline-block', width: '6px', height: '6px', borderRadius: '50%', background: task.status === 'COMPLETED' ? '#10b981' : task.status === 'IN_PROGRESS' ? '#34d399' : task.status === 'REVIEW' ? '#f59e0b' : task.status === 'CANCELLED' ? '#ef4444' : '#6b7280', marginRight: '0.5rem'}}></span>
                            {task.status.replace('_', ' ')}
                          </Badge>
                        </td>
                        <td style={{padding: '1.25rem 1.5rem', border: 'none', verticalAlign: 'middle'}}>
                          <div style={{display: 'flex', gap: '0.5rem', justifyContent: 'center', flexWrap: 'wrap'}}>
                            {task.status === 'ASSIGNED' && (
                              <Button 
                                size="sm" 
                                onClick={() => {
                                  setSelectedTask(task);
                                  setShowCheckInModal(true);
                                }} 
                                disabled={loadingStates[`start-${task._id}`]}
                                style={{
                                  background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                                  border: 'none',
                                  padding: '0.5rem 1rem',
                                  fontSize: '0.85rem',
                                  fontWeight: '600',
                                  borderRadius: '8px',
                                  boxShadow: '0 2px 8px rgba(16, 185, 129, 0.3)',
                                  transition: 'all 0.2s'
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
                                onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
                              >
                                {loadingStates[`start-${task._id}`] ? (
                                  <><span className="spinner-border spinner-border-sm me-1"></span>Starting...</>
                                ) : (
                                  <><i className="fas fa-play me-1"></i>Start</>
                                )}
                              </Button>
                            )}
                            {task.status === 'IN_PROGRESS' && (
                              <>
                                <Button 
                                  size="sm" 
                                  onClick={() => {
                                    setSelectedTask(task);
                                    setUpdateForm({ 
                                      progressPercent: task.progressPercent || 0,
                                      status: 'ON_TRACK', 
                                      workDone: '', 
                                      issues: '',
                                      nextDayPlan: '',
                                      hoursSpent: '',
                                      visitOutcome: '',
                                      orderValue: ''
                                    });
                                    setShowUpdateModal(true);
                                  }} 
                                  disabled={loadingStates[`update-${task._id}`]}
                                  style={{
                                    background: 'linear-gradient(135deg, #34d399 0%, #10b981 100%)',
                                    border: 'none',
                                    padding: '0.5rem 1rem',
                                    fontSize: '0.85rem',
                                    fontWeight: '600',
                                    borderRadius: '8px',
                                    boxShadow: '0 2px 8px rgba(52, 211, 153, 0.3)',
                                    transition: 'all 0.2s'
                                  }}
                                  onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
                                  onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
                                >
                                  {loadingStates[`update-${task._id}`] ? (
                                    <><span className="spinner-border spinner-border-sm me-1"></span>Loading...</>
                                  ) : (
                                    <><i className="fas fa-edit me-1"></i>Update</>
                                  )}
                                </Button>
                                <Button 
                                  size="sm" 
                                  onClick={() => {
                                    setSelectedTask(task);
                                    setShowCheckOutModal(true);
                                  }} 
                                  disabled={loadingStates[`complete-${task._id}`]}
                                  style={{
                                    background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                                    border: 'none',
                                    padding: '0.5rem 1rem',
                                    fontSize: '0.85rem',
                                    fontWeight: '600',
                                    borderRadius: '8px',
                                    boxShadow: '0 2px 8px rgba(16, 185, 129, 0.3)',
                                    transition: 'all 0.2s'
                                  }}
                                  onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
                                  onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
                                >
                                  {loadingStates[`complete-${task._id}`] ? (
                                    <><span className="spinner-border spinner-border-sm me-1"></span>Loading...</>
                                  ) : (
                                    <><i className="fas fa-check-circle me-1"></i>Complete</>
                                  )}
                                </Button>
                              </>
                            )}
                            <Button 
                              size="sm" 
                              onClick={() => handleViewTask(task)} 
                              disabled={loadingStates[`view-${task._id}`]}
                              style={{
                                background: 'white',
                                border: '2px solid #10b981',
                                color: '#10b981',
                                padding: '0.5rem 1rem',
                                fontSize: '0.85rem',
                                fontWeight: '600',
                                borderRadius: '8px',
                                transition: 'all 0.2s'
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.background = '#10b981';
                                e.currentTarget.style.color = 'white';
                                e.currentTarget.style.transform = 'translateY(-2px)';
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.background = 'white';
                                e.currentTarget.style.color = '#10b981';
                                e.currentTarget.style.transform = 'translateY(0)';
                              }}
                            >
                              {loadingStates[`view-${task._id}`] ? (
                                <><span className="spinner-border spinner-border-sm me-1"></span>Loading...</>
                              ) : (
                                <><i className="fas fa-eye me-1"></i>View</>
                              )}
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                </div>
                
                {/* Mobile Card View */}
                <div className="d-md-none mobile-card-view">
                  {tasks.map(task => (
                    <div key={task._id} className="task-card" style={{background: isUpdateOverdue(task) ? '#fff3cd' : 'white', marginBottom: '1rem', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)', border: '1px solid #e0e0e0', overflow: 'hidden'}}>
                      <div className="task-card-header" style={{padding: '1rem', borderBottom: '1px solid #f0f0f0'}}>
                        <div style={{flex: 1}}>
                          <div className="task-card-title" style={{fontSize: '1.1rem', fontWeight: '600', color: '#1a1a1a', marginBottom: '0.5rem'}}>{task.title}</div>
                          {task.description && <small className="text-muted d-block" style={{fontSize: '0.85rem', lineHeight: '1.4', marginBottom: '0.5rem'}}>{task.description}</small>}
                          {isUpdateOverdue(task) && (
                            <Badge bg="warning" text="dark" className="mt-1" style={{fontSize: '0.7rem', padding: '0.3rem 0.6rem'}}>
                              Update Overdue
                            </Badge>
                          )}
                        </div>
                        <div style={{marginLeft: '0.75rem'}}>
                          {getPriorityBadge(task.priority)}
                        </div>
                      </div>
                      
                      <div className="task-card-meta" style={{padding: '1rem', background: '#f8f9fa', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem'}}>
                        <div style={{fontSize: '0.85rem', color: '#495057'}}>
                          <i className="fas fa-building me-2" style={{color: '#007bff', fontSize: '0.9rem'}}></i>{task.department}
                        </div>
                        <div style={{fontSize: '0.85rem', color: '#495057'}}>
                          <i className="fas fa-briefcase me-2" style={{color: '#28a745', fontSize: '0.9rem'}}></i>{task.taskType}
                        </div>
                        <div style={{fontSize: '0.85rem', color: '#495057'}}>
                          <i className="fas fa-map-marker-alt me-2" style={{color: '#dc3545', fontSize: '0.9rem'}}></i>
                          <Badge bg="secondary" style={{fontSize: '0.7rem', padding: '0.25rem 0.5rem'}}>{task.workLocation}</Badge>
                        </div>
                        <div style={{fontSize: '0.85rem', color: '#495057'}}>
                          <i className="fas fa-calendar me-2" style={{color: '#ffc107', fontSize: '0.9rem'}}></i>
                          {new Date(task.scheduledDate).toLocaleDateString('en-GB', {day: '2-digit', month: 'short'})}
                        </div>
                      </div>
                      
                      <div style={{padding: '1rem', borderTop: '1px solid #e0e0e0'}}>
                        <div className="d-flex justify-content-between align-items-center mb-2">
                          <small className="text-muted" style={{fontSize: '0.75rem', fontWeight: '600'}}>Progress</small>
                          <small style={{fontSize: '0.85rem', fontWeight: '600', color: '#1a1a1a'}}>{task.progressPercent || 0}%</small>
                        </div>
                        <div className="progress" style={{height: '8px', borderRadius: '4px', background: '#e9ecef'}}>
                          <div className={`progress-bar ${task.progressPercent >= 75 ? 'bg-success' : task.progressPercent >= 50 ? 'bg-info' : task.progressPercent >= 25 ? 'bg-warning' : 'bg-danger'}`} style={{width: `${task.progressPercent || 0}%`, borderRadius: '4px'}}></div>
                        </div>
                      </div>
                      
                      <div style={{padding: '0.75rem 1rem', background: '#f8f9fa', display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                        {getStatusBadge(task.status)}
                        <small className="text-muted" style={{fontSize: '0.75rem'}}>
                          <i className="fas fa-clock me-1"></i>{getLastUpdateTime(task)}
                        </small>
                      </div>
                      
                      <div className="task-card-actions" style={{padding: '1rem', display: 'flex', gap: '0.5rem'}}>
                        {task.status === 'ASSIGNED' && (
                          <Button size="sm" variant="primary" onClick={() => {
                            setSelectedTask(task);
                            setShowCheckInModal(true);
                          }} style={{flex: 1, padding: '0.6rem', fontSize: '0.85rem', fontWeight: '600', borderRadius: '8px'}}>
                            <i className="fas fa-play me-1"></i>Start
                          </Button>
                        )}
                        {task.status === 'IN_PROGRESS' && (
                          <>
                            <Button size="sm" variant="warning" onClick={() => {
                              setSelectedTask(task);
                              setUpdateForm({ 
                                progressPercent: task.progressPercent || 0,
                                status: 'ON_TRACK', 
                                workDone: '', 
                                issues: '',
                                nextDayPlan: '',
                                hoursSpent: '',
                                visitOutcome: '',
                                orderValue: ''
                              });
                              setShowUpdateModal(true);
                            }} style={{flex: 1, padding: '0.6rem', fontSize: '0.85rem', fontWeight: '600', borderRadius: '8px'}}>
                              <i className="fas fa-edit me-1"></i>Update
                            </Button>
                            <Button size="sm" variant="success" onClick={() => {
                              setSelectedTask(task);
                              setShowCheckOutModal(true);
                            }} style={{flex: 1, padding: '0.6rem', fontSize: '0.85rem', fontWeight: '600', borderRadius: '8px'}}>
                              <i className="fas fa-check me-1"></i>Complete
                            </Button>
                          </>
                        )}
                        <Button size="sm" variant="outline-primary" onClick={() => handleViewTask(task)} style={{flex: 1, padding: '0.6rem', fontSize: '0.85rem', fontWeight: '600', borderRadius: '8px'}}>
                          <i className="fas fa-eye me-1"></i>View
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
                </>
              ) : (
                <div style={{textAlign: 'center', padding: '4rem 2rem'}}>
                  <div style={{width: '120px', height: '120px', borderRadius: '50%', background: 'linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 2rem', boxShadow: '0 8px 24px rgba(16, 185, 129, 0.2)'}}>
                    <i className="fas fa-tasks" style={{fontSize: '3rem', color: '#10b981'}}></i>
                  </div>
                  <h4 style={{fontWeight: '700', color: '#1e293b', marginBottom: '0.75rem'}}>No Tasks Assigned</h4>
                  <p style={{color: '#64748b', fontSize: '1rem', marginBottom: '2rem', maxWidth: '400px', margin: '0 auto 2rem'}}>You don't have any tasks assigned at the moment. Check back later or contact your manager.</p>
                  <div style={{display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap'}}>
                    <Button 
                      variant="outline-primary" 
                      onClick={() => fetchTasks()}
                      style={{padding: '0.75rem 1.5rem', fontSize: '0.95rem', fontWeight: '600', borderRadius: '10px', border: '2px solid #10b981', color: '#10b981'}}
                    >
                      <i className="fas fa-sync-alt me-2"></i>Refresh
                    </Button>
                    <Button 
                      onClick={() => setShowWorkLogModal(true)}
                      style={{background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', border: 'none', padding: '0.75rem 1.5rem', fontSize: '0.95rem', fontWeight: '600', borderRadius: '10px', boxShadow: '0 4px 12px rgba(16, 185, 129, 0.4)'}}
                    >
                      <i className="fas fa-plus me-2"></i>Log Work Instead
                    </Button>
                  </div>
                </div>
              )}
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* Start Task Modal */}
      <Modal show={showCheckInModal} onHide={() => setShowCheckInModal(false)} centered size="md">
        <Modal.Header closeButton style={{background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', color: 'white', border: 'none', padding: '1.5rem'}}>
          <Modal.Title style={{fontSize: '1.3rem', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '0.75rem'}}>
            <div style={{width: '48px', height: '48px', borderRadius: '12px', background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
              <i className="fas fa-play" style={{fontSize: '1.2rem'}}></i>
            </div>
            Start Task
          </Modal.Title>
        </Modal.Header>
        <Modal.Body style={{padding: '2rem'}}>
          <div style={{textAlign: 'center', marginBottom: '2rem'}}>
            <div style={{width: '80px', height: '80px', borderRadius: '50%', background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem', boxShadow: '0 8px 24px rgba(16, 185, 129, 0.3)'}}>
              <i className="fas fa-rocket" style={{fontSize: '2rem', color: 'white'}}></i>
            </div>
            <h5 style={{fontWeight: '600', color: '#1e293b', marginBottom: '0.5rem'}}>Ready to begin?</h5>
            <p style={{color: '#64748b', fontSize: '0.95rem', margin: 0}}>You're about to start working on this task</p>
          </div>
          
          {selectedTask && (
            <div style={{background: 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)', border: '2px solid #86efac', borderRadius: '12px', padding: '1.5rem', marginBottom: '1.5rem'}}>
              <div style={{display: 'flex', alignItems: 'start', gap: '1rem'}}>
                <div style={{width: '40px', height: '40px', borderRadius: '10px', background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0}}>
                  <i className="fas fa-tasks" style={{color: 'white', fontSize: '1rem'}}></i>
                </div>
                <div style={{flex: 1}}>
                  <div style={{fontWeight: '700', color: '#166534', fontSize: '1.1rem', marginBottom: '0.75rem'}}>{selectedTask.title}</div>
                  <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', fontSize: '0.9rem'}}>
                    <div>
                      <div style={{color: '#15803d', fontSize: '0.75rem', fontWeight: '600', marginBottom: '0.25rem', textTransform: 'uppercase', letterSpacing: '0.5px'}}>Department</div>
                      <div style={{color: '#166534', fontWeight: '500'}}>{selectedTask.department}</div>
                    </div>
                    <div>
                      <div style={{color: '#15803d', fontSize: '0.75rem', fontWeight: '600', marginBottom: '0.25rem', textTransform: 'uppercase', letterSpacing: '0.5px'}}>Type</div>
                      <div style={{color: '#166534', fontWeight: '500'}}>{selectedTask.taskType.replace(/_/g, ' ')}</div>
                    </div>
                    <div>
                      <div style={{color: '#15803d', fontSize: '0.75rem', fontWeight: '600', marginBottom: '0.25rem', textTransform: 'uppercase', letterSpacing: '0.5px'}}>Priority</div>
                      <Badge style={{
                        background: selectedTask.priority === 'HIGH' ? '#ef4444' : selectedTask.priority === 'MEDIUM' ? '#f59e0b' : '#3b82f6',
                        border: 'none',
                        padding: '0.25rem 0.6rem',
                        fontSize: '0.75rem'
                      }}>
                        {selectedTask.priority}
                      </Badge>
                    </div>
                    <div>
                      <div style={{color: '#15803d', fontSize: '0.75rem', fontWeight: '600', marginBottom: '0.25rem', textTransform: 'uppercase', letterSpacing: '0.5px'}}>Scheduled</div>
                      <div style={{color: '#166534', fontWeight: '500'}}>{new Date(selectedTask.scheduledDate).toLocaleDateString('en-GB', {day: '2-digit', month: 'short'})}</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
          
          {selectedTask?.requireCheckIn && (
            <div style={{background: '#fef3c7', border: '1px solid #fde68a', borderRadius: '10px', padding: '1rem', display: 'flex', alignItems: 'center', gap: '0.75rem'}}>
              <i className="fas fa-map-marker-alt" style={{color: '#d97706', fontSize: '1.2rem'}}></i>
              <div>
                <div style={{fontWeight: '600', color: '#92400e', fontSize: '0.9rem'}}>Location Tracking Enabled</div>
                <small style={{color: '#b45309'}}>Your GPS location will be recorded when you start</small>
              </div>
            </div>
          )}
        </Modal.Body>
        <Modal.Footer style={{background: '#f8fafc', border: 'none', padding: '1.25rem 2rem'}}>
          <Button 
            variant="light" 
            onClick={() => setShowCheckInModal(false)}
            style={{padding: '0.75rem 1.5rem', fontSize: '0.95rem', fontWeight: '600', borderRadius: '10px', border: '2px solid #e5e7eb'}}
          >
            Cancel
          </Button>
          <Button 
            onClick={() => handleCheckIn(selectedTask)} 
            disabled={loadingStates[`checkin-${selectedTask?._id}`]}
            style={{
              background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
              border: 'none',
              padding: '0.75rem 2rem',
              fontSize: '0.95rem',
              fontWeight: '600',
              borderRadius: '10px',
              boxShadow: '0 4px 12px rgba(16, 185, 129, 0.4)'
            }}
          >
            {loadingStates[`checkin-${selectedTask?._id}`] ? (
              <><span className="spinner-border spinner-border-sm me-2"></span>Starting Task...</>
            ) : (
              <><i className="fas fa-play me-2"></i>Start Working</>
            )}
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Complete Task Modal */}
      <Modal show={showCheckOutModal} onHide={() => setShowCheckOutModal(false)} size="lg" centered>
        <Modal.Header closeButton style={{background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', color: 'white', border: 'none', padding: '1.5rem'}}>
          <Modal.Title style={{fontSize: '1.3rem', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '0.75rem'}}>
            <div style={{width: '48px', height: '48px', borderRadius: '12px', background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
              <i className="fas fa-check-circle" style={{fontSize: '1.2rem'}}></i>
            </div>
            Complete Task
          </Modal.Title>
        </Modal.Header>
        <Form onSubmit={handleCheckOut}>
          <Modal.Body style={{padding: '2rem', background: '#f8fafc'}}>
            <div style={{textAlign: 'center', marginBottom: '2rem'}}>
              <div style={{width: '80px', height: '80px', borderRadius: '50%', background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem', boxShadow: '0 8px 24px rgba(16, 185, 129, 0.3)'}}>
                <i className="fas fa-trophy" style={{fontSize: '2rem', color: 'white'}}></i>
              </div>
              <h5 style={{fontWeight: '600', color: '#1e293b', marginBottom: '0.5rem'}}>Great Work!</h5>
              <p style={{color: '#64748b', fontSize: '0.95rem', margin: 0}}>Add final details to complete this task</p>
            </div>

            {selectedTask && (
              <div style={{background: 'white', border: '2px solid #e5e7eb', borderRadius: '12px', padding: '1.25rem', marginBottom: '1.5rem'}}>
                <div style={{fontWeight: '600', color: '#1e293b', fontSize: '1rem', marginBottom: '0.5rem'}}>
                  <i className="fas fa-tasks me-2" style={{color: '#10b981'}}></i>{selectedTask.title}
                </div>
                <div style={{fontSize: '0.85rem', color: '#64748b'}}>
                  {selectedTask.department} • {selectedTask.taskType.replace(/_/g, ' ')}
                </div>
              </div>
            )}

            <div style={{background: 'white', borderRadius: '12px', padding: '1.5rem', marginBottom: '1rem', boxShadow: '0 2px 8px rgba(0,0,0,0.06)'}}>
              <Form.Group className="mb-3">
                <Form.Label style={{fontWeight: '600', color: '#374151', fontSize: '0.95rem', marginBottom: '0.75rem'}}>
                  <i className="fas fa-clipboard-check me-2" style={{color: '#10b981'}}></i>Task Outcome
                </Form.Label>
                <Form.Control 
                  type="text" 
                  value={checkOutForm.outcome} 
                  onChange={(e) => setCheckOutForm({...checkOutForm, outcome: e.target.value})} 
                  placeholder="e.g., Successfully completed, Delivered on time"
                  style={{borderRadius: '8px', border: '2px solid #e5e7eb', padding: '0.75rem', fontSize: '0.95rem'}}
                />
              </Form.Group>

              <Form.Group className="mb-3">
                <Form.Label style={{fontWeight: '600', color: '#374151', fontSize: '0.95rem', marginBottom: '0.75rem'}}>
                  <i className="fas fa-sticky-note me-2" style={{color: '#667eea'}}></i>Completion Notes
                </Form.Label>
                <Form.Control 
                  as="textarea" 
                  rows={3} 
                  value={checkOutForm.notes} 
                  onChange={(e) => setCheckOutForm({...checkOutForm, notes: e.target.value})} 
                  placeholder="Add any important notes about task completion..."
                  style={{borderRadius: '8px', border: '2px solid #e5e7eb', padding: '0.75rem', fontSize: '0.95rem', resize: 'none'}}
                />
              </Form.Group>

              <Row>
                <Col md={6}>
                  <Form.Group className="mb-3">
                    <Form.Label style={{fontWeight: '600', color: '#374151', fontSize: '0.95rem', marginBottom: '0.75rem'}}>
                      <i className="fas fa-clock me-2" style={{color: '#f59e0b'}}></i>Actual Hours Spent
                    </Form.Label>
                    <Form.Control 
                      type="number" 
                      step="0.5" 
                      value={checkOutForm.actualHours} 
                      onChange={(e) => setCheckOutForm({...checkOutForm, actualHours: e.target.value})} 
                      placeholder="0"
                      style={{borderRadius: '8px', border: '2px solid #e5e7eb', padding: '0.75rem', fontSize: '0.95rem'}}
                    />
                  </Form.Group>
                </Col>
                <Col md={6}>
                  <Form.Group className="mb-3">
                    <Form.Label style={{fontWeight: '600', color: '#374151', fontSize: '0.95rem', marginBottom: '0.75rem'}}>
                      <i className="fas fa-calendar-plus me-2" style={{color: '#3b82f6'}}></i>Next Follow-up Date
                    </Form.Label>
                    <Form.Control 
                      type="date" 
                      value={checkOutForm.nextFollowUpDate} 
                      onChange={(e) => setCheckOutForm({...checkOutForm, nextFollowUpDate: e.target.value})}
                      style={{borderRadius: '8px', border: '2px solid #e5e7eb', padding: '0.75rem', fontSize: '0.95rem'}}
                    />
                  </Form.Group>
                </Col>
              </Row>
            </div>

            {selectedTask?.department === 'Sales' && (
              <div style={{background: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)', border: '2px solid #fbbf24', borderRadius: '12px', padding: '1.5rem'}}>
                <h6 style={{fontWeight: '700', color: '#92400e', marginBottom: '1rem', fontSize: '1rem'}}>
                  <i className="fas fa-dollar-sign me-2"></i>Sales Information
                </h6>
                <Form.Group className="mb-3">
                  <Form.Label style={{fontWeight: '600', color: '#78350f', fontSize: '0.9rem'}}>Order Value (₹)</Form.Label>
                  <Form.Control 
                    type="number" 
                    value={checkOutForm.orderValue} 
                    onChange={(e) => setCheckOutForm({...checkOutForm, orderValue: e.target.value})} 
                    placeholder="0"
                    style={{borderRadius: '8px', border: '2px solid #fbbf24', padding: '0.75rem', fontSize: '0.95rem', background: 'white'}}
                  />
                </Form.Group>

                <Form.Group>
                  <Form.Label style={{fontWeight: '600', color: '#78350f', fontSize: '0.9rem'}}>Order Details</Form.Label>
                  <Form.Control 
                    as="textarea" 
                    rows={2} 
                    value={checkOutForm.orderDetails} 
                    onChange={(e) => setCheckOutForm({...checkOutForm, orderDetails: e.target.value})} 
                    placeholder="Product details, quantity, special notes..."
                    style={{borderRadius: '8px', border: '2px solid #fbbf24', padding: '0.75rem', fontSize: '0.95rem', resize: 'none', background: 'white'}}
                  />
                </Form.Group>
              </div>
            )}
          </Modal.Body>
          <Modal.Footer style={{background: 'white', border: 'none', padding: '1.25rem 2rem'}}>
            <Button 
              variant="light" 
              onClick={() => setShowCheckOutModal(false)}
              style={{padding: '0.75rem 1.5rem', fontSize: '0.95rem', fontWeight: '600', borderRadius: '10px', border: '2px solid #e5e7eb'}}
            >
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={loadingStates.checkout}
              style={{
                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                border: 'none',
                padding: '0.75rem 2rem',
                fontSize: '0.95rem',
                fontWeight: '600',
                borderRadius: '10px',
                boxShadow: '0 4px 12px rgba(16, 185, 129, 0.4)'
              }}
            >
              {loadingStates.checkout ? (
                <><span className="spinner-border spinner-border-sm me-2"></span>Completing...</>
              ) : (
                <><i className="fas fa-check-circle me-2"></i>Mark as Complete</>
              )}
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>

      {/* Task Details Modal */}
      {showDetailsModal && !isMobile && (
        <Modal show={true} onHide={() => setShowDetailsModal(false)} size="xl" centered scrollable>
        <Modal.Header closeButton style={{background: '#2c3e50', color: 'white', borderBottom: '1px solid #1a252f'}}>
          <Modal.Title style={{fontSize: '1.1rem', fontWeight: '600'}}>Task Details</Modal.Title>
        </Modal.Header>
        <Modal.Body style={{padding: 0}}>
          {selectedTask && (
            <>
              <div style={{background: '#f8f9fa', padding: '1.5rem', borderBottom: '1px solid #dee2e6'}}>
                <Row>
                  <Col md={8}>
                    <h4 className="mb-3" style={{fontWeight: '600', color: '#1a1a1a'}}>{selectedTask.title}</h4>
                    <p className="text-muted mb-3" style={{lineHeight: '1.6'}}>{selectedTask.description || 'No description provided'}</p>
                    <div className="d-flex gap-2 flex-wrap">
                      <Badge bg={selectedTask.priority === 'HIGH' ? 'danger' : selectedTask.priority === 'MEDIUM' ? 'warning' : 'info'} style={{fontSize: '0.8rem', padding: '0.4rem 0.7rem'}}>
                        {selectedTask.priority}
                      </Badge>
                      <Badge bg={selectedTask.status === 'COMPLETED' ? 'success' : selectedTask.status === 'IN_PROGRESS' ? 'info' : 'secondary'} style={{fontSize: '0.8rem', padding: '0.4rem 0.7rem'}}>
                        {selectedTask.status}
                      </Badge>
                      <Badge bg="dark" style={{fontSize: '0.8rem', padding: '0.4rem 0.7rem'}}>{selectedTask.department}</Badge>
                      <Badge bg="secondary" style={{fontSize: '0.8rem', padding: '0.4rem 0.7rem'}}>{selectedTask.workLocation}</Badge>
                      {selectedTask.tags?.map((tag, i) => (
                        <Badge key={i} bg="light" text="dark" style={{fontSize: '0.8rem', padding: '0.4rem 0.7rem'}}>{tag}</Badge>
                      ))}
                    </div>
                  </Col>
                  <Col md={4}>
                    <Card className="text-center" style={{background: 'white', border: '1px solid #dee2e6'}}>
                      <Card.Body>
                        <h6 className="text-muted mb-3" style={{fontSize: '0.75rem', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px'}}>Progress</h6>
                        <div className="position-relative" style={{width: '120px', height: '120px', margin: '0 auto'}}>
                          <svg width="120" height="120" style={{transform: 'rotate(-90deg)'}}>
                            <circle cx="60" cy="60" r="50" fill="none" stroke="#e9ecef" strokeWidth="10"/>
                            <circle cx="60" cy="60" r="50" fill="none" 
                              stroke={selectedTask.progressPercent >= 75 ? '#198754' : selectedTask.progressPercent >= 50 ? '#0dcaf0' : selectedTask.progressPercent >= 25 ? '#ffc107' : '#dc3545'}
                              strokeWidth="10" strokeDasharray={`${(selectedTask.progressPercent || 0) * 3.14} 314`}
                              strokeLinecap="round"/>
                          </svg>
                          <div style={{position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)'}}>
                            <h2 className="mb-0" style={{fontWeight: '700'}}>{selectedTask.progressPercent || 0}%</h2>
                          </div>
                        </div>
                      </Card.Body>
                    </Card>
                  </Col>
                </Row>
              </div>

            <Tabs defaultActiveKey="updates" className="px-0" style={{background: 'white', borderBottom: '1px solid #dee2e6'}}>
              <Tab eventKey="updates" title={<span style={{fontSize: '0.95rem', fontWeight: '500'}}>Daily Updates ({selectedTask.dailyUpdates?.length || 0})</span>}>
                <div style={{padding: '1.5rem', background: '#fafbfc', minHeight: '600px'}}>
                  {selectedTask.dailyUpdates?.length > 0 ? (
                    <div style={{maxHeight: '600px', overflowY: 'auto', paddingRight: '10px'}}>
                      {selectedTask.dailyUpdates.slice().reverse().map((update, idx) => (
                        <Card key={idx} className="mb-4" style={{border: '1px solid #e1e4e8', borderRadius: '8px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.06)'}}>
                          <Card.Body style={{padding: '24px'}}>
                            <div className="d-flex justify-content-between align-items-start mb-4">
                              <div className="d-flex align-items-center">
                                <div className="text-white rounded-circle d-flex align-items-center justify-content-center me-3" style={{width: '48px', height: '48px', fontSize: '1rem', fontWeight: '600', background: '#2c3e50'}}>
                                  {update.updatedBy?.firstName?.[0]}{update.updatedBy?.lastName?.[0]}
                                </div>
                                <div>
                                  <div style={{fontWeight: '600', fontSize: '1rem', color: '#1a1a1a', marginBottom: '4px'}}>{update.updatedBy?.firstName} {update.updatedBy?.lastName}</div>
                                  <div style={{fontSize: '0.85rem', color: '#666'}}>
                                    {new Date(update.date).toLocaleDateString('en-GB', {day: '2-digit', month: 'long', year: 'numeric'})} • {new Date(update.date).toLocaleTimeString('en-GB', {hour: '2-digit', minute: '2-digit'})}
                                  </div>
                                </div>
                              </div>
                              <div className="d-flex gap-2 align-items-center flex-wrap">
                                {update.status && (
                                  <Badge style={{fontSize: '0.8rem', padding: '0.4rem 0.7rem', fontWeight: '500', background: update.status === 'COMPLETED' ? '#28a745' : update.status === 'BLOCKED' ? '#dc3545' : update.status === 'NEED_HELP' ? '#ffc107' : '#0366d6', border: 'none'}}>
                                    {update.status === 'ON_TRACK' ? 'On Track' : update.status === 'NEED_HELP' ? 'Need Help' : update.status}
                                  </Badge>
                                )}
                                <Badge style={{fontSize: '0.9rem', padding: '0.4rem 0.7rem', fontWeight: '600', background: update.progressPercent >= 75 ? '#28a745' : update.progressPercent >= 50 ? '#0366d6' : update.progressPercent >= 25 ? '#ffc107' : '#dc3545', border: 'none'}}>
                                  {update.progressPercent}%
                                </Badge>
                              </div>
                            </div>
                            <div style={{background: '#f6f8fa', padding: '1rem', borderRadius: '4px', marginBottom: '1rem', border: '1px solid #e1e4e8'}}>
                              <div style={{fontSize: '0.75rem', fontWeight: '600', color: '#666', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.3px'}}>
                                Work Completed
                              </div>
                              <p className="mb-0" style={{fontSize: '0.95rem', color: '#1a1a1a', whiteSpace: 'pre-wrap', lineHeight: '1.6'}}>{update.workDone}</p>
                            </div>
                            {update.issues && (
                              <div style={{background: '#fff3cd', padding: '1rem', borderRadius: '4px', marginBottom: '1rem', border: '1px solid #ffc107'}}>
                                <div style={{fontSize: '0.75rem', fontWeight: '600', color: '#856404', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.3px'}}>
                                  Issues / Blockers
                                </div>
                                <p className="mb-0" style={{fontSize: '0.95rem', color: '#856404', whiteSpace: 'pre-wrap', lineHeight: '1.6'}}>{update.issues}</p>
                              </div>
                            )}
                            {update.hoursSpent && (
                              <div style={{fontSize: '0.85rem', marginTop: '12px', color: '#666'}}>
                                Time spent: <strong>{update.hoursSpent} hours</strong>
                              </div>
                            )}
                          </Card.Body>
                        </Card>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-5" style={{marginTop: '80px'}}>
                      <div style={{fontSize: '4rem', marginBottom: '1.5rem'}}>📋</div>
                      <h4 style={{color: '#666', fontWeight: '600', marginBottom: '0.5rem'}}>No Updates Yet</h4>
                      <p style={{color: '#999', margin: 0, fontSize: '1rem'}}>Daily progress updates will appear here</p>
                    </div>
                  )}
                </div>
              </Tab>
              <Tab eventKey="comments" title={<span style={{fontSize: '0.95rem', fontWeight: '500'}}>Comments ({selectedTask.comments?.length || 0})</span>}>
                <div style={{display: 'flex', justifyContent: 'center', padding: '1.5rem', background: '#fafbfc', minHeight: '600px'}}>
                  <div style={{display: 'flex', flexDirection: 'column', height: '600px', background: '#e5ddd5', width: '100%', maxWidth: '800px', borderRadius: '8px', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.1)'}}>
                    <div style={{flex: 1, overflowY: 'auto', padding: '30px'}}>
                    {selectedTask.comments?.length > 0 ? (
                      selectedTask.comments.map((c, idx) => {
                        const isCurrentUser = c.user?._id === user?.id;
                        return (
                          <div key={idx} className={`d-flex mb-3 ${isCurrentUser ? 'justify-content-end' : 'justify-content-start'}`}>
                            <div style={{maxWidth: '80%'}}>
                              {!isCurrentUser && (
                                <div style={{fontSize: '0.75rem', fontWeight: '600', color: '#667781', marginBottom: '4px', marginLeft: '8px'}}>
                                  {c.user?.firstName} {c.user?.lastName}
                                </div>
                              )}
                              <div style={{
                                background: isCurrentUser ? '#d9fdd3' : 'white',
                                color: '#111b21',
                                padding: '8px 12px',
                                borderRadius: '8px',
                                boxShadow: '0 1px 0.5px rgba(11,20,26,.13)'
                              }}>
                                <div style={{fontSize: '14.2px', wordBreak: 'break-word', lineHeight: '19px'}}>{c.text}</div>
                                <div style={{fontSize: '11px', color: '#667781', textAlign: 'right', marginTop: '4px', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '3px'}}>
                                  {new Date(c.createdAt).toLocaleString('en-GB', {day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'})}
                                  {isCurrentUser && <i className="fas fa-check-double" style={{fontSize: '14px', color: '#53bdeb'}}></i>}
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <div className="text-center py-5" style={{marginTop: '80px'}}>
                        <i className="fas fa-comments" style={{fontSize: '5rem', color: '#d1c7b8', marginBottom: '2rem'}}></i>
                        <h4 style={{color: '#667781', fontWeight: '600', marginBottom: '0.5rem'}}>No Messages Yet</h4>
                        <p style={{color: '#8696a0', margin: 0, fontSize: '1.05rem'}}>Start the conversation</p>
                      </div>
                    )}
                  </div>
                    
                    <div style={{background: '#f0f2f5', padding: '10px 16px', borderTop: '1px solid #d1d7db'}}>
                    {showMentions && (
                      <div style={{position: 'absolute', bottom: '100%', left: '16px', right: '16px', background: 'white', border: '1px solid #d1d7db', borderRadius: '8px', marginBottom: '8px', maxHeight: '200px', overflowY: 'auto', boxShadow: '0 2px 5px 0 rgba(11,20,26,.26), 0 2px 10px 0 rgba(11,20,26,.16)'}}>
                        {mentionSuggestions.map(emp => (
                          <div key={emp._id} onClick={() => handleMentionSelect(emp)} style={{padding: '12px 16px', cursor: 'pointer', borderBottom: '1px solid #f0f2f5', transition: 'background 0.2s'}} onMouseEnter={(e) => e.target.style.background = '#f5f6f6'} onMouseLeave={(e) => e.target.style.background = 'white'}>
                            <div style={{fontWeight: '600', fontSize: '0.9rem', color: '#111b21'}}>{emp.firstName} {emp.lastName}</div>
                            <small style={{color: '#667781'}}>{emp.email}</small>
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="d-flex align-items-end gap-2">
                      <Form.Control 
                        as="textarea" 
                        rows={1} 
                        value={comment} 
                        onChange={handleCommentChange}
                        onKeyPress={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey && !showMentions) {
                            e.preventDefault();
                            handleAddComment(comment);
                          }
                        }}
                        placeholder="Type a message" 
                        style={{border: 'none', resize: 'none', borderRadius: '8px', padding: '9px 12px', fontSize: '15px', background: 'white', boxShadow: 'none'}}
                      />
                      <Button 
                        variant="link"
                        onClick={() => handleAddComment(comment)} 
                        disabled={!comment.trim()}
                        style={{padding: '8px', minWidth: 'auto', color: comment.trim() ? '#00a884' : '#8696a0'}}
                      >
                        <i className="fas fa-paper-plane" style={{fontSize: '20px'}}></i>
                      </Button>
                    </div>
                    </div>
                  </div>
                </div>
              </Tab>
            </Tabs>
            
            <Row style={{padding: '20px'}}>
              <Col md={6}>
                <Card className="mb-3" style={{border: '1px solid #dee2e6'}}>
                  <Card.Header style={{background: '#f8f9fa', fontWeight: 'bold'}}>
                    <i className="fas fa-info-circle me-2 text-primary"></i>Task Information
                  </Card.Header>
                  <Card.Body>
                    <table className="table table-sm table-borderless mb-0">
                      <tbody>
                        <tr>
                          <td style={{width: '40%'}}><strong><i className="fas fa-briefcase me-2 text-muted"></i>Type:</strong></td>
                          <td>{selectedTask.taskType.replace(/_/g, ' ')}</td>
                        </tr>
                        <tr>
                          <td><strong><i className="fas fa-calendar-alt me-2 text-muted"></i>Scheduled:</strong></td>
                          <td>{new Date(selectedTask.scheduledDate).toLocaleDateString('en-GB')}</td>
                        </tr>
                        {selectedTask.dueDate && (
                          <tr>
                            <td><strong><i className="fas fa-calendar-check me-2 text-muted"></i>Due Date:</strong></td>
                            <td>{new Date(selectedTask.dueDate).toLocaleDateString('en-GB')}</td>
                          </tr>
                        )}
                        {selectedTask.estimatedHours && (
                          <tr>
                            <td><strong><i className="fas fa-clock me-2 text-muted"></i>Est. Hours:</strong></td>
                            <td>{selectedTask.estimatedHours}h</td>
                          </tr>
                        )}
                        {selectedTask.actualHours && (
                          <tr>
                            <td><strong><i className="fas fa-hourglass-end me-2 text-muted"></i>Actual Hours:</strong></td>
                            <td>{selectedTask.actualHours}h</td>
                          </tr>
                        )}
                        <tr>
                          <td><strong><i className="fas fa-check-circle me-2 text-muted"></i>GPS Required:</strong></td>
                          <td>{selectedTask.requireCheckIn ? <Badge bg="success">Yes</Badge> : <Badge bg="secondary">No</Badge>}</td>
                        </tr>
                      </tbody>
                    </table>
                  </Card.Body>
                </Card>
              </Col>
              
              <Col md={6}>
                <Card className="mb-3" style={{border: '1px solid #dee2e6'}}>
                  <Card.Header style={{background: '#f8f9fa', fontWeight: 'bold'}}>
                    <i className="fas fa-users me-2 text-success"></i>Team Members
                  </Card.Header>
                  <Card.Body>
                    <div className="mb-3">
                      <strong className="d-block mb-2"><i className="fas fa-user-tie me-2 text-primary"></i>Task Creator:</strong>
                      <div className="d-flex align-items-center p-2" style={{background: '#e7f3ff', borderRadius: '8px'}}>
                        <div className="bg-primary text-white rounded-circle d-flex align-items-center justify-content-center" style={{width: '45px', height: '45px', fontSize: '18px'}}>
                          {selectedTask.assignedBy?.firstName[0]}{selectedTask.assignedBy?.lastName[0]}
                        </div>
                        <div className="ms-3">
                          <div className="fw-bold">{selectedTask.assignedBy?.firstName} {selectedTask.assignedBy?.lastName}</div>
                          <small className="text-muted"><i className="fas fa-envelope me-1"></i>{selectedTask.assignedBy?.email}</small>
                        </div>
                      </div>
                    </div>
                    <hr/>
                    <div>
                      <strong className="d-block mb-2"><i className="fas fa-users me-2 text-info"></i>Assigned Team ({selectedTask.assignedTo?.length}):</strong>
                      <div style={{maxHeight: '200px', overflowY: 'auto'}}>
                        {selectedTask.assignedTo?.map(emp => (
                          <div key={emp._id} className="d-flex align-items-center mb-2 p-2" style={{background: '#f8f9fa', borderRadius: '8px', border: '1px solid #dee2e6'}}>
                            <div className="bg-info text-white rounded-circle d-flex align-items-center justify-content-center" style={{width: '40px', height: '40px', fontSize: '16px'}}>
                              {emp.firstName[0]}{emp.lastName[0]}
                            </div>
                            <div className="ms-2 flex-grow-1">
                              <div className="fw-bold" style={{fontSize: '14px'}}>{emp.firstName} {emp.lastName}</div>
                              <small className="text-muted" style={{fontSize: '12px'}}><i className="fas fa-envelope me-1"></i>{emp.email}</small>
                            </div>
                            <Badge bg="success" style={{fontSize: '10px'}}>
                              <i className="fas fa-check-circle me-1"></i>Active
                            </Badge>
                          </div>
                        ))}
                      </div>
                    </div>
                  </Card.Body>
                </Card>
              </Col>
            </Row>

            {selectedTask.client?.name && (
              <div style={{padding: '0 20px 20px'}}>
                <Card style={{border: '1px solid #dee2e6'}}>
                  <Card.Header style={{background: '#f8f9fa', fontWeight: 'bold'}}>
                    <i className="fas fa-building me-2 text-warning"></i>Client Information
                  </Card.Header>
                  <Card.Body>
                    <Row>
                      <Col md={3}><strong>Name:</strong> {selectedTask.client.name}</Col>
                      <Col md={3}><strong>Phone:</strong> {selectedTask.client.phone || 'N/A'}</Col>
                      <Col md={3}><strong>Company:</strong> {selectedTask.client.company || 'N/A'}</Col>
                      <Col md={3}><strong>Address:</strong> {selectedTask.client.address || 'N/A'}</Col>
                    </Row>
                  </Card.Body>
                </Card>
              </div>
            )}

            {selectedTask.requireCheckIn && (selectedTask.checkIn || selectedTask.checkOut) && (
              <div style={{padding: '0 20px 20px'}}>
                <Card style={{border: '1px solid #dee2e6'}}>
                  <Card.Header style={{background: '#f8f9fa', fontWeight: 'bold'}}>
                    <i className="fas fa-map-marker-alt me-2 text-danger"></i>GPS Tracking Information
                  </Card.Header>
                  <Card.Body>
                    {selectedTask.checkIn && (
                      <div className="mb-3">
                        <h6 className="text-success"><i className="fas fa-sign-in-alt me-2"></i>Check-In Location</h6>
                        <div className="d-flex align-items-start gap-3">
                          <div className="flex-grow-1">
                            <p className="mb-1"><strong>Time:</strong> {new Date(selectedTask.checkIn.time).toLocaleString('en-GB')}</p>
                            <p className="mb-1"><strong>Coordinates:</strong> {selectedTask.checkIn.location.lat}, {selectedTask.checkIn.location.lng}</p>
                            <p className="mb-0"><strong>Address:</strong> {gpsAddresses.checkIn || 'Loading...'}</p>
                          </div>
                          <a href={`https://www.google.com/maps?q=${selectedTask.checkIn.location.lat},${selectedTask.checkIn.location.lng}`} target="_blank" rel="noopener noreferrer" className="btn btn-sm btn-outline-primary">
                            <i className="fas fa-map me-1"></i>View on Map
                          </a>
                        </div>
                      </div>
                    )}
                    {selectedTask.checkOut && (
                      <div>
                        <h6 className="text-danger"><i className="fas fa-sign-out-alt me-2"></i>Check-Out Location</h6>
                        <div className="d-flex align-items-start gap-3">
                          <div className="flex-grow-1">
                            <p className="mb-1"><strong>Time:</strong> {new Date(selectedTask.checkOut.time).toLocaleString('en-GB')}</p>
                            <p className="mb-1"><strong>Coordinates:</strong> {selectedTask.checkOut.location.lat}, {selectedTask.checkOut.location.lng}</p>
                            <p className="mb-0"><strong>Address:</strong> {gpsAddresses.checkOut || 'Loading...'}</p>
                          </div>
                          <a href={`https://www.google.com/maps?q=${selectedTask.checkOut.location.lat},${selectedTask.checkOut.location.lng}`} target="_blank" rel="noopener noreferrer" className="btn btn-sm btn-outline-primary">
                            <i className="fas fa-map me-1"></i>View on Map
                          </a>
                        </div>
                      </div>
                    )}
                  </Card.Body>
                </Card>
              </div>
            )}
            </>
          )}
        </Modal.Body>
      </Modal>
      )}

      {/* Mobile Task Details */}
      {showDetailsModal && isMobile && (
        <MobileTaskDetails 
          task={selectedTask}
          show={true}
          onHide={() => setShowDetailsModal(false)}
          user={user}
          onAddComment={handleAddComment}
        />
      )}

      {/* Daily Update Modal - Desktop Only */}
      {showUpdateModal && (
        <>
          {/* Desktop Version */}
          <div className="d-none d-md-block">
            <Modal 
              show={showUpdateModal} 
              onHide={() => setShowUpdateModal(false)} 
              size="lg" 
              centered
            >
              <Modal.Header closeButton style={{background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', color: 'white', border: 'none'}}>
                <Modal.Title style={{fontSize: '1.3rem', fontWeight: '700'}}>
                  <i className="fas fa-chart-line me-2"></i>Daily Update
                </Modal.Title>
              </Modal.Header>
              <Form onSubmit={handleDailyUpdate}>
                <Modal.Body style={{padding: '2rem', background: '#f8f9fa', maxHeight: '70vh', overflowY: 'auto'}}>
                  {selectedTask && (
                    <div style={{background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', color: 'white', border: 'none', borderRadius: '12px', padding: '1.25rem', marginBottom: '1.5rem'}}>
                      <div style={{fontSize: '1.1rem', fontWeight: '600', marginBottom: '0.5rem'}}>{selectedTask.title}</div>
                      <div style={{fontSize: '0.9rem', opacity: 0.9}}>
                        <i className="fas fa-building me-2"></i>{selectedTask.department} •
                        <i className="fas fa-briefcase ms-2 me-2"></i>{selectedTask.taskType.replace(/_/g, ' ')}
                      </div>
                    </div>
                  )}

                  {/* Progress & Status */}
                  <Row className="mb-3">
                    <Col md={6}>
                      <div style={{background: 'white', padding: '1.5rem', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)'}}>
                        <Form.Group>
                          <Form.Label style={{fontSize: '0.95rem', fontWeight: '600', color: '#374151', marginBottom: '1rem'}}>Progress (%)</Form.Label>
                          <Form.Range
                            min="0"
                            max="100"
                            step="5"
                            value={updateForm.progressPercent}
                            onChange={(e) => setUpdateForm({...updateForm, progressPercent: e.target.value})}
                            style={{height: '8px'}}
                          />
                          <div className="text-center mt-2">
                            <strong style={{fontSize: '1.5rem', color: '#10b981'}}>{updateForm.progressPercent}%</strong>
                          </div>
                        </Form.Group>
                      </div>
                    </Col>
                    <Col md={6}>
                      <div style={{background: 'white', padding: '1.5rem', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)'}}>
                        <Form.Group>
                          <Form.Label style={{fontSize: '0.95rem', fontWeight: '600', color: '#374151'}}>Status</Form.Label>
                          <Form.Select
                            value={updateForm.status}
                            onChange={(e) => setUpdateForm({...updateForm, status: e.target.value})}
                            required
                            style={{padding: '0.75rem', fontSize: '0.95rem', borderRadius: '8px', border: '2px solid #e5e7eb'}}
                          >
                            <option value="ON_TRACK">On Track</option>
                            <option value="BLOCKED">Blocked</option>
                            <option value="NEED_HELP">Need Help</option>
                            <option value="COMPLETED">Completed</option>
                          </Form.Select>
                        </Form.Group>
                      </div>
                    </Col>
                  </Row>

                  {/* Work Done */}
                  <div style={{background: 'white', padding: '1.5rem', borderRadius: '12px', marginBottom: '1rem', boxShadow: '0 2px 8px rgba(0,0,0,0.08)'}}>
                    <Form.Group>
                      <Form.Label style={{fontSize: '0.95rem', fontWeight: '600', color: '#374151'}}>Work Done Today <span className="text-danger">*</span></Form.Label>
                      <Form.Control
                        as="textarea"
                        rows={3}
                        value={updateForm.workDone}
                        onChange={(e) => setUpdateForm({...updateForm, workDone: e.target.value})}
                        placeholder="Describe what you accomplished today..."
                        required
                        style={{padding: '0.75rem', fontSize: '0.95rem', borderRadius: '8px', border: '2px solid #e5e7eb', resize: 'none'}}
                      />
                    </Form.Group>
                  </div>

                  {/* Time & Issues */}
                  <Row className="mb-3">
                    <Col md={6}>
                      <div style={{background: 'white', padding: '1.5rem', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)'}}>
                        <Form.Group>
                          <Form.Label style={{fontSize: '0.95rem', fontWeight: '600', color: '#374151'}}>Hours Spent</Form.Label>
                          <Form.Control
                            type="number"
                            step="0.5"
                            min="0"
                            max="24"
                            value={updateForm.hoursSpent}
                            onChange={(e) => setUpdateForm({...updateForm, hoursSpent: e.target.value})}
                            placeholder="e.g., 8"
                            style={{padding: '0.75rem', fontSize: '0.95rem', borderRadius: '8px', border: '2px solid #e5e7eb'}}
                          />
                        </Form.Group>
                      </div>
                    </Col>
                    <Col md={6}>
                      <div style={{background: 'white', padding: '1.5rem', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)'}}>
                        <Form.Group>
                          <Form.Label style={{fontSize: '0.95rem', fontWeight: '600', color: '#374151'}}>Issues/Blockers</Form.Label>
                          <Form.Control
                            as="textarea"
                            rows={1}
                            value={updateForm.issues}
                            onChange={(e) => setUpdateForm({...updateForm, issues: e.target.value})}
                            placeholder="Any challenges..."
                            style={{padding: '0.75rem', fontSize: '0.95rem', borderRadius: '8px', border: '2px solid #e5e7eb', resize: 'none'}}
                          />
                        </Form.Group>
                      </div>
                    </Col>
                  </Row>

                  {/* Sales Specific */}
                  {(selectedTask?.department === 'Sales' || selectedTask?.taskType === 'SALES') && (
                    <div style={{background: 'white', padding: '1.5rem', borderRadius: '12px', marginBottom: '1rem', boxShadow: '0 2px 8px rgba(0,0,0,0.08)'}}>
                      <h6 style={{fontSize: '1rem', fontWeight: '600', color: '#10b981', marginBottom: '1rem', borderBottom: '2px solid #e9ecef', paddingBottom: '0.5rem'}}>
                        <i className="fas fa-dollar-sign me-2"></i>Sales Details
                      </h6>
                      <Row>
                        <Col md={6}>
                          <Form.Group className="mb-3">
                            <Form.Label style={{fontSize: '0.9rem', fontWeight: '500', color: '#374151'}}>Visit Outcome</Form.Label>
                            <Form.Select
                              value={updateForm.visitOutcome}
                              onChange={(e) => setUpdateForm({...updateForm, visitOutcome: e.target.value})}
                              style={{padding: '0.6rem', fontSize: '0.9rem', borderRadius: '8px', border: '2px solid #e5e7eb'}}
                            >
                              <option value="">Select...</option>
                              <option value="POSITIVE">Positive</option>
                              <option value="NEUTRAL">Neutral</option>
                              <option value="NEGATIVE">Negative</option>
                              <option value="ORDER_RECEIVED">Order Received</option>
                              <option value="DEMO_SCHEDULED">Demo Scheduled</option>
                              <option value="PROPOSAL_SENT">Proposal Sent</option>
                            </Form.Select>
                          </Form.Group>
                        </Col>
                        <Col md={6}>
                          <Form.Group className="mb-3">
                            <Form.Label style={{fontSize: '0.9rem', fontWeight: '500', color: '#374151'}}>Order Value</Form.Label>
                            <Form.Control
                              type="number"
                              value={updateForm.orderValue}
                              onChange={(e) => setUpdateForm({...updateForm, orderValue: e.target.value})}
                              placeholder="Enter amount"
                              style={{padding: '0.6rem', fontSize: '0.9rem', borderRadius: '8px', border: '2px solid #e5e7eb'}}
                            />
                          </Form.Group>
                        </Col>
                      </Row>
                    </div>
                  )}

                  {/* Next Day Plan */}
                  <div style={{background: 'white', padding: '1.5rem', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)'}}>
                    <Form.Group>
                      <Form.Label style={{fontSize: '0.95rem', fontWeight: '600', color: '#374151'}}>Plan for Tomorrow</Form.Label>
                      <Form.Control
                        as="textarea"
                        rows={2}
                        value={updateForm.nextDayPlan}
                        onChange={(e) => setUpdateForm({...updateForm, nextDayPlan: e.target.value})}
                        placeholder="What do you plan to work on tomorrow..."
                        style={{padding: '0.75rem', fontSize: '0.95rem', borderRadius: '8px', border: '2px solid #e5e7eb', resize: 'none'}}
                      />
                    </Form.Group>
                  </div>
                </Modal.Body>
                <Modal.Footer style={{background: 'white', borderTop: '2px solid #e5e7eb', padding: '1.25rem 2rem'}}>
                  <Button
                    variant="secondary"
                    onClick={() => setShowUpdateModal(false)}
                    style={{padding: '0.75rem 1.5rem', fontSize: '0.95rem', fontWeight: '600', borderRadius: '8px'}}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="primary"
                    type="submit"
                    disabled={loadingStates.update}
                    style={{padding: '0.75rem 2rem', fontSize: '0.95rem', fontWeight: '600', borderRadius: '8px', background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', border: 'none', boxShadow: '0 4px 12px rgba(16, 185, 129, 0.4)'}}
                  >
                    {loadingStates.update ? (
                      <><span className="spinner-border spinner-border-sm me-2"></span>Submitting...</>
                    ) : (
                      <><i className="fas fa-save me-2"></i>Submit Update</>
                    )}
                  </Button>
                </Modal.Footer>
              </Form>
            </Modal>
          </div>

          {/* Mobile Version */}
          <div className="d-md-none">
            <MobileDailyUpdate
              show={showUpdateModal}
              onHide={() => setShowUpdateModal(false)}
              task={selectedTask}
              updateForm={updateForm}
              setUpdateForm={setUpdateForm}
              onSubmit={handleDailyUpdate}
            />
          </div>
        </>
      )}

      {/* Work Log Modal */}
      <Modal show={showWorkLogModal} onHide={() => {
        setShowWorkLogModal(false);
        setSelectedWorkLogDetail(null);
        setBulkLogs([{ workDone: '', hoursSpent: '', category: 'GENERAL', status: 'COMPLETED', project: '', deliverables: '', location: 'OFFICE', issues: '', date: new Date().toISOString().split('T')[0], templateData: {}, customCategory: '' }]);
      }} size="xl" centered scrollable>
        <Modal.Header closeButton style={{background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: 'white', borderBottom: 'none'}}>
          <Modal.Title style={{fontSize: '1.3rem', fontWeight: '600'}}>
            <i className="fas fa-clipboard-list me-2"></i>{selectedWorkLogDetail ? 'Edit Work Log' : 'Daily Work Report'}
          </Modal.Title>
        </Modal.Header>
        <Form onSubmit={selectedWorkLogDetail ? handleUpdateMyWorkLog : handleWorkLogSubmit}>
          <Modal.Body style={{maxHeight: '75vh', overflowY: 'auto', padding: '2rem', background: '#f8f9fa'}}>
            <div className="alert" style={{background: 'linear-gradient(135deg, #e0e7ff 0%, #e9d5ff 100%)', border: '1px solid #c7d2fe', borderRadius: '12px', padding: '1rem', marginBottom: '1.5rem'}}>
              <div style={{display: 'flex', alignItems: 'center', gap: '0.75rem'}}>
                <div style={{width: '40px', height: '40px', borderRadius: '50%', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
                  <i className="fas fa-info-circle" style={{color: 'white', fontSize: '1.2rem'}}></i>
                </div>
                <div>
                  <div style={{fontWeight: '600', color: '#4c1d95', marginBottom: '0.25rem'}}>Daily Work Report</div>
                  <small style={{color: '#6b21a8'}}>This report will be sent to your manager</small>
                </div>
              </div>
            </div>

            {!selectedWorkLogDetail && (
            <Card className="mb-4" style={{border: '2px solid #667eea', borderRadius: '12px'}}>
              <Card.Body style={{padding: '1.5rem'}}>
                <Form.Group>
                  <Form.Label style={{fontWeight: '600', color: '#374151', fontSize: '1rem', marginBottom: '1rem'}}>
                    <i className="fas fa-layer-group me-2" style={{color: '#667eea'}}></i>Select Report Template
                  </Form.Label>
                  <Form.Select 
                    value={selectedTemplate} 
                    onChange={(e) => setSelectedTemplate(e.target.value)}
                    style={{borderRadius: '8px', border: '2px solid #e5e7eb', padding: '0.75rem', fontSize: '1rem', fontWeight: '500'}}
                  >
                    {Object.keys(TEMPLATES).map(key => (
                      <option key={key} value={key}>{TEMPLATES[key].name}</option>
                    ))}
                  </Form.Select>
                </Form.Group>
              </Card.Body>
            </Card>
            )}

            {bulkLogs.map((log, index) => (
              <Card key={index} className="mb-3" style={{border: '1px solid #e5e7eb', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.08)'}}>
                <Card.Body style={{padding: '1.5rem', background: 'white'}}>
                  <div className="d-flex justify-content-between align-items-center mb-3">
                    <h6 className="mb-0" style={{color: '#1f2937', fontWeight: '600', fontSize: '1rem'}}>
                      <i className="fas fa-tasks me-2" style={{color: '#667eea'}}></i>Task {index + 1}
                    </h6>
                    {!selectedWorkLogDetail && bulkLogs.length > 1 && (
                      <Button variant="outline-danger" size="sm" onClick={() => removeBulkLogEntry(index)} style={{borderRadius: '8px'}}>
                        <i className="fas fa-trash me-1"></i>Remove
                      </Button>
                    )}
                  </div>

                  <Row className="mb-3">
                    <Col md={4}>
                      <Form.Group>
                        <Form.Label style={{fontWeight: '600', color: '#374151', fontSize: '0.9rem'}}>
                          <i className="fas fa-calendar me-2" style={{color: '#667eea'}}></i>Date <span className="text-danger">*</span>
                        </Form.Label>
                        <Form.Control 
                          type="date" 
                          value={log.date} 
                          onChange={(e) => updateBulkLogEntry(index, 'date', e.target.value)} 
                          required
                          style={{borderRadius: '8px', border: '2px solid #e5e7eb', padding: '0.6rem', fontSize: '0.9rem'}}
                        />
                      </Form.Group>
                    </Col>
                    <Col md={4}>
                      <Form.Group>
                        <Form.Label style={{fontWeight: '600', color: '#374151', fontSize: '0.9rem'}}>
                          <i className="fas fa-check-circle me-2" style={{color: '#667eea'}}></i>Status <span className="text-danger">*</span>
                        </Form.Label>
                        <Form.Select 
                          value={log.status} 
                          onChange={(e) => updateBulkLogEntry(index, 'status', e.target.value)}
                          required
                          style={{borderRadius: '8px', border: '2px solid #e5e7eb', padding: '0.6rem', fontSize: '0.9rem'}}
                        >
                          <option value="COMPLETED">Completed</option>
                          <option value="IN_PROGRESS">In Progress</option>
                          <option value="PENDING">Pending</option>
                          <option value="ON_HOLD">On Hold</option>
                          <option value="BLOCKED">Blocked</option>
                          <option value="CANCELLED">Cancelled</option>
                        </Form.Select>
                      </Form.Group>
                    </Col>
                    <Col md={4}>
                      <Form.Group>
                        <Form.Label style={{fontWeight: '600', color: '#374151', fontSize: '0.9rem'}}>
                          <i className="fas fa-map-marker-alt me-2" style={{color: '#667eea'}}></i>Location <span className="text-danger">*</span>
                        </Form.Label>
                        <Form.Select 
                          value={log.location} 
                          onChange={(e) => updateBulkLogEntry(index, 'location', e.target.value)}
                          required
                          style={{borderRadius: '8px', border: '2px solid #e5e7eb', padding: '0.6rem', fontSize: '0.9rem'}}
                        >
                          <option value="OFFICE">Office</option>
                          <option value="REMOTE">Remote</option>
                          <option value="CLIENT_SITE">Client Site</option>
                          <option value="FIELD">Field</option>
                        </Form.Select>
                      </Form.Group>
                    </Col>
                  </Row>

                  <Row className="mb-3">
                    <Col md={6}>
                      <Form.Group>
                        <Form.Label style={{fontWeight: '600', color: '#374151', fontSize: '0.9rem'}}>
                          <i className="fas fa-project-diagram me-2" style={{color: '#667eea'}}></i>Project/Client Name
                        </Form.Label>
                        <Form.Control 
                          type="text" 
                          value={log.project} 
                          onChange={(e) => updateBulkLogEntry(index, 'project', e.target.value)} 
                          placeholder="e.g., ABC Corp Website"
                          style={{borderRadius: '8px', border: '2px solid #e5e7eb', padding: '0.6rem', fontSize: '0.9rem'}}
                        />
                      </Form.Group>
                    </Col>
                    {TEMPLATES[selectedTemplate].fields.filter(f => !['workDone', 'deliverables', 'hoursSpent', 'status', 'location', 'date', 'issues'].includes(f)).map(field => 
                      renderTemplateField(log, index, field)
                    )}
                    <Col md={3}>
                      <Form.Group>
                        <Form.Label style={{fontWeight: '600', color: '#374151', fontSize: '0.9rem'}}>
                          <i className="fas fa-clock me-2" style={{color: '#667eea'}}></i>Hours <span className="text-danger">*</span>
                        </Form.Label>
                        <Form.Control 
                          type="number" 
                          step="0.5" 
                          min="0" 
                          max="12" 
                          value={log.hoursSpent} 
                          onChange={(e) => updateBulkLogEntry(index, 'hoursSpent', e.target.value)} 
                          placeholder="2.5"
                          required
                          style={{borderRadius: '8px', border: '2px solid #e5e7eb', padding: '0.6rem', fontSize: '0.9rem'}}
                        />
                      </Form.Group>
                    </Col>
                    <Col md={3}>
                      <Form.Group>
                        <Form.Label style={{fontWeight: '600', color: '#374151', fontSize: '0.9rem'}}>
                          <i className="fas fa-tag me-2" style={{color: '#667eea'}}></i>Category
                        </Form.Label>
                        <Form.Select 
                          value={log.category} 
                          onChange={(e) => updateBulkLogEntry(index, 'category', e.target.value)}
                          style={{borderRadius: '8px', border: '2px solid #e5e7eb', padding: '0.6rem', fontSize: '0.9rem'}}
                        >
                          <option value="GENERAL">General</option>
                          <option value="MEETING">Meeting</option>
                          <option value="TRAINING">Training</option>
                          <option value="SUPPORT">Support</option>
                          <option value="OTHER">Other</option>
                          <option value="CUSTOM">Custom</option>
                        </Form.Select>
                        {log.category === 'CUSTOM' && (
                          <Form.Control 
                            type="text" 
                            value={log.customCategory} 
                            onChange={(e) => updateBulkLogEntry(index, 'customCategory', e.target.value)} 
                            placeholder="Enter custom category"
                            className="mt-2"
                            required
                            style={{borderRadius: '8px', border: '2px solid #e5e7eb', padding: '0.6rem', fontSize: '0.9rem'}}
                          />
                        )}
                      </Form.Group>
                    </Col>
                  </Row>

                  <Form.Group className="mb-3">
                    <Form.Label style={{fontWeight: '600', color: '#374151', fontSize: '0.9rem'}}>
                      <i className="fas fa-file-alt me-2" style={{color: '#667eea'}}></i>Work Description <span className="text-danger">*</span>
                    </Form.Label>
                    <Form.Control 
                      as="textarea" 
                      rows={2} 
                      value={log.workDone} 
                      onChange={(e) => updateBulkLogEntry(index, 'workDone', e.target.value)} 
                      placeholder="Describe the work completed..."
                      required
                      style={{borderRadius: '8px', border: '2px solid #e5e7eb', padding: '0.75rem', fontSize: '0.9rem'}}
                    />
                  </Form.Group>

                  <Form.Group className="mb-3">
                    <Form.Label style={{fontWeight: '600', color: '#374151', fontSize: '0.9rem'}}>
                      <i className="fas fa-trophy me-2" style={{color: '#10b981'}}></i>Deliverables/Outcomes
                    </Form.Label>
                    <Form.Control 
                      as="textarea" 
                      rows={2} 
                      value={log.deliverables} 
                      onChange={(e) => updateBulkLogEntry(index, 'deliverables', e.target.value)} 
                      placeholder="What was delivered or achieved? (e.g., Completed 3 modules, Fixed 5 bugs)"
                      style={{borderRadius: '8px', border: '2px solid #e5e7eb', padding: '0.75rem', fontSize: '0.9rem'}}
                    />
                  </Form.Group>

                  {(log.status === 'BLOCKED' || log.status === 'IN_PROGRESS') && (
                    <Form.Group className="mb-2">
                      <Form.Label style={{fontWeight: '600', color: '#374151', fontSize: '0.9rem'}}>
                        <i className="fas fa-exclamation-triangle me-2" style={{color: '#ef4444'}}></i>Blockers/Issues {log.status === 'BLOCKED' && <span className="text-danger">*</span>}
                      </Form.Label>
                      <Form.Control 
                        as="textarea" 
                        rows={2} 
                        value={log.issues} 
                        onChange={(e) => updateBulkLogEntry(index, 'issues', e.target.value)} 
                        placeholder="Describe any problems or blockers faced..."
                        required={log.status === 'BLOCKED'}
                        style={{borderRadius: '8px', border: '2px solid #fee2e2', padding: '0.75rem', fontSize: '0.9rem', background: '#fef2f2'}}
                      />
                    </Form.Group>
                  )}
                </Card.Body>
              </Card>
            ))}
            {!selectedWorkLogDetail && (
            <Button 
              variant="outline-primary" 
              onClick={addBulkLogEntry} 
              className="w-100" 
              style={{borderRadius: '10px', padding: '0.75rem', fontWeight: '600', border: '2px dashed #667eea', color: '#667eea', background: 'white'}}
            >
              <i className="fas fa-plus-circle me-2"></i>Add Another Task
            </Button>
            )}
          </Modal.Body>
          <Modal.Footer style={{background: 'white', borderTop: '2px solid #e5e7eb', padding: '1.25rem 2rem'}}>
            <Button 
              variant="light" 
              onClick={() => setShowWorkLogModal(false)} 
              style={{padding: '0.75rem 1.5rem', fontSize: '0.95rem', fontWeight: '600', borderRadius: '10px', border: '2px solid #e5e7eb'}}
            >
              Cancel
            </Button>
            <Button 
              variant="primary" 
              type="submit" 
              disabled={loadingStates.worklog}
              style={{padding: '0.75rem 2rem', fontSize: '0.95rem', fontWeight: '600', borderRadius: '10px', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', border: 'none', boxShadow: '0 4px 12px rgba(102, 126, 234, 0.4)'}}
            >
              {loadingStates.worklog ? (
                <><span className="spinner-border spinner-border-sm me-2"></span>{selectedWorkLogDetail ? 'Updating...' : 'Submitting Report...'}</>
              ) : (
                <><i className="fas fa-paper-plane me-2"></i>{selectedWorkLogDetail ? 'Update Log' : 'Submit Report'}</>
              )}
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>

      {/* Work Log History Modal */}
      <Modal show={showWorkLogHistory} onHide={() => setShowWorkLogHistory(false)} size="xl" centered scrollable>
        <Modal.Header closeButton style={{background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: 'white', borderBottom: 'none'}}>
          <Modal.Title style={{fontSize: '1.3rem', fontWeight: '600'}}>
            <i className="fas fa-history me-2"></i>Work Log History & Reports
          </Modal.Title>
        </Modal.Header>
        <Modal.Body style={{maxHeight: '75vh', overflowY: 'auto', padding: '2rem', background: '#f8f9fa'}}>
          {workLogs.length > 0 ? (
            <div>
              <Card className="mb-3" style={{border: '1px solid #e5e7eb', borderRadius: '12px'}}>
                <Card.Body style={{padding: '1.5rem'}}>
                  <div className="d-flex justify-content-between align-items-center mb-3">
                    <h6 className="mb-0" style={{fontWeight: '600', color: '#374151'}}>
                      <i className="fas fa-filter me-2"></i>Filters & Export
                    </h6>
                    <Button variant="success" size="sm" onClick={exportWorkLogReport} style={{borderRadius: '8px'}}>
                      <i className="fas fa-file-export me-2"></i>Export Report
                    </Button>
                  </div>
                  <Row>
                    <Col md={3}>
                      <Form.Group>
                        <Form.Label style={{fontSize: '0.85rem', fontWeight: '600', color: '#6b7280'}}>Search</Form.Label>
                        <Form.Control 
                          type="text" 
                          placeholder="Search work logs..."
                          value={workLogFilters.search}
                          onChange={(e) => setWorkLogFilters({...workLogFilters, search: e.target.value})}
                          style={{borderRadius: '8px', fontSize: '0.9rem'}}
                        />
                      </Form.Group>
                    </Col>
                    <Col md={2}>
                      <Form.Group>
                        <Form.Label style={{fontSize: '0.85rem', fontWeight: '600', color: '#6b7280'}}>Status</Form.Label>
                        <Form.Select 
                          value={workLogFilters.status}
                          onChange={(e) => setWorkLogFilters({...workLogFilters, status: e.target.value})}
                          style={{borderRadius: '8px', fontSize: '0.9rem'}}
                        >
                          <option value="">All Status</option>
                          <option value="COMPLETED">Completed</option>
                          <option value="IN_PROGRESS">In Progress</option>
                          <option value="PENDING">Pending</option>
                          <option value="ON_HOLD">On Hold</option>
                          <option value="BLOCKED">Blocked</option>
                        </Form.Select>
                      </Form.Group>
                    </Col>
                    <Col md={2}>
                      <Form.Group>
                        <Form.Label style={{fontSize: '0.85rem', fontWeight: '600', color: '#6b7280'}}>Date Range</Form.Label>
                        <Form.Select 
                          value={workLogFilters.dateRange}
                          onChange={(e) => setWorkLogFilters({...workLogFilters, dateRange: e.target.value})}
                          style={{borderRadius: '8px', fontSize: '0.9rem'}}
                        >
                          <option value="all">All Time</option>
                          <option value="today">Today</option>
                          <option value="week">Last 7 Days</option>
                          <option value="month">Last 30 Days</option>
                          <option value="custom">Custom Range</option>
                        </Form.Select>
                      </Form.Group>
                    </Col>
                    {workLogFilters.dateRange === 'custom' && (
                      <>
                        <Col md={2}>
                          <Form.Group>
                            <Form.Label style={{fontSize: '0.85rem', fontWeight: '600', color: '#6b7280'}}>Start Date</Form.Label>
                            <Form.Control 
                              type="date" 
                              value={workLogFilters.startDate}
                              onChange={(e) => setWorkLogFilters({...workLogFilters, startDate: e.target.value})}
                              style={{borderRadius: '8px', fontSize: '0.9rem'}}
                            />
                          </Form.Group>
                        </Col>
                        <Col md={2}>
                          <Form.Group>
                            <Form.Label style={{fontSize: '0.85rem', fontWeight: '600', color: '#6b7280'}}>End Date</Form.Label>
                            <Form.Control 
                              type="date" 
                              value={workLogFilters.endDate}
                              onChange={(e) => setWorkLogFilters({...workLogFilters, endDate: e.target.value})}
                              style={{borderRadius: '8px', fontSize: '0.9rem'}}
                            />
                          </Form.Group>
                        </Col>
                      </>
                    )}
                    <Col md={workLogFilters.dateRange === 'custom' ? 1 : 5} className="d-flex align-items-end">
                      <Button variant="primary" onClick={applyWorkLogFilters} className="w-100" style={{borderRadius: '8px'}}>
                        <i className="fas fa-search me-2"></i>Apply
                      </Button>
                    </Col>
                  </Row>
                </Card.Body>
              </Card>

              {filteredWorkLogs.map((log, index) => {
                const hoursSinceCreation = (Date.now() - new Date(log.createdAt)) / (1000 * 60 * 60);
                const canEdit = hoursSinceCreation <= 24;
                return (
                <Card key={index} className="mb-3" style={{border: '1px solid #e5e7eb', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', cursor: 'pointer'}} onClick={() => handleViewWorkLogDetail(log)}>
                  <Card.Body style={{padding: '1.5rem'}}>
                    <div className="d-flex justify-content-between align-items-start mb-3">
                      <div style={{flex: 1}}>
                        <div style={{fontSize: '0.95rem', color: '#6b7280', marginBottom: '0.75rem', lineHeight: '1.8'}}>
                          <span style={{fontWeight: '600', color: '#374151'}}>Date:</span> {new Date(log.date).toLocaleDateString('en-GB', {day: '2-digit', month: '2-digit', year: '2-digit'})} 
                          <span style={{margin: '0 0.5rem', color: '#d1d5db'}}>|</span>
                          <span style={{fontWeight: '600', color: '#374151'}}>Status:</span> <span style={{color: log.status === 'COMPLETED' ? '#10b981' : log.status === 'IN_PROGRESS' ? '#3b82f6' : log.status === 'BLOCKED' ? '#ef4444' : '#6b7280', fontWeight: '500'}}>{log.status.replace('_', ' ')}</span>
                          <span style={{margin: '0 0.5rem', color: '#d1d5db'}}>|</span>
                          <span style={{fontWeight: '600', color: '#374151'}}>Location:</span> {log.location.replace('_', ' ')}
                          {log.project && (
                            <>
                              <span style={{margin: '0 0.5rem', color: '#d1d5db'}}>|</span>
                              <span style={{fontWeight: '600', color: '#374151'}}>Project:</span> {log.project}
                            </>
                          )}
                        </div>
                      </div>
                      <div className="d-flex gap-2 align-items-center">
                        <Badge bg="success" style={{fontSize: '1rem', padding: '0.5rem 1rem', fontWeight: '600'}}>
                          <i className="fas fa-clock me-1"></i>{log.hoursSpent}h
                        </Badge>
                        {canEdit && (
                          <>
                            <Button size="sm" variant="outline-primary" onClick={(e) => { e.stopPropagation(); handleEditMyWorkLog(log); }} style={{borderRadius: '6px'}}>
                              <i className="fas fa-edit"></i>
                            </Button>
                            <Button size="sm" variant="outline-danger" onClick={(e) => { e.stopPropagation(); handleDeleteMyWorkLog(log._id); }} style={{borderRadius: '6px'}}>
                              <i className="fas fa-trash"></i>
                            </Button>
                          </>
                        )}
                      </div>
                    </div>

                    <div style={{background: '#f9fafb', padding: '1rem', borderRadius: '8px', marginBottom: '1rem', border: '1px solid #e5e7eb'}}>
                      <div style={{fontSize: '0.75rem', fontWeight: '600', color: '#6b7280', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.5px'}}>
                        <i className="fas fa-file-alt me-2"></i>Work Description
                      </div>
                      <p className="mb-0" style={{fontSize: '0.95rem', color: '#1f2937', lineHeight: '1.6'}}>{log.workDone}</p>
                    </div>

                    {log.deliverables && (
                      <div style={{background: '#f0fdf4', padding: '1rem', borderRadius: '8px', marginBottom: '1rem', border: '1px solid #bbf7d0'}}>
                        <div style={{fontSize: '0.75rem', fontWeight: '600', color: '#166534', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.5px'}}>
                          <i className="fas fa-trophy me-2"></i>Deliverables / Outcomes
                        </div>
                        <p className="mb-0" style={{fontSize: '0.95rem', color: '#166534', lineHeight: '1.6'}}>{log.deliverables}</p>
                      </div>
                    )}

                    {log.issues && (
                      <div style={{background: '#fef2f2', padding: '1rem', borderRadius: '8px', border: '1px solid #fecaca'}}>
                        <div style={{fontSize: '0.75rem', fontWeight: '600', color: '#991b1b', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.5px'}}>
                          <i className="fas fa-exclamation-triangle me-2"></i>Issues / Blockers
                        </div>
                        <p className="mb-0" style={{fontSize: '0.95rem', color: '#991b1b', lineHeight: '1.6'}}>{log.issues}</p>
                      </div>
                    )}
                  </Card.Body>
                </Card>
              )})}
            </div>
          ) : (
            <div className="text-center py-5">
              <div style={{width: '80px', height: '80px', borderRadius: '50%', background: '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem'}}>
                <i className="fas fa-clipboard-list" style={{fontSize: '2.5rem', color: '#9ca3af'}}></i>
              </div>
              <h5 style={{color: '#6b7280', fontWeight: '600', marginBottom: '0.5rem'}}>No Work Logs Found</h5>
              <p style={{color: '#9ca3af', margin: 0}}>Start logging your daily work to see history here</p>
            </div>
          )}
        </Modal.Body>
      </Modal>

      {/* Employee Work Log Detail Modal */}
      <Modal show={showWorkLogDetailModal} onHide={() => setShowWorkLogDetailModal(false)} size="lg" centered>
        <Modal.Header closeButton style={{background: '#f8fafc', borderBottom: '2px solid #e2e8f0'}}>
          <Modal.Title style={{fontSize: '1.25rem', fontWeight: '600', color: '#1e293b'}}>
            <i className="fas fa-file-alt me-2" style={{color: '#3b82f6'}}></i>Work Log Details
          </Modal.Title>
        </Modal.Header>
        <Modal.Body style={{padding: '2rem', background: 'white'}}>
          {selectedWorkLogDetail && (
            <>
              <Row className="mb-3">
                <Col md={6}>
                  <div style={{marginBottom: '1.5rem'}}>
                    <div style={{fontSize: '0.75rem', fontWeight: '600', color: '#64748b', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.5px'}}>Date</div>
                    <div style={{fontSize: '1rem', fontWeight: '500', color: '#1e293b'}}>{new Date(selectedWorkLogDetail.date).toLocaleDateString('en-GB', {day: '2-digit', month: 'long', year: 'numeric'})}</div>
                  </div>
                </Col>
                <Col md={6}>
                  <div style={{marginBottom: '1.5rem'}}>
                    <div style={{fontSize: '0.75rem', fontWeight: '600', color: '#64748b', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.5px'}}>Hours Spent</div>
                    <div style={{fontSize: '1.5rem', fontWeight: '700', color: '#059669'}}>{selectedWorkLogDetail.hoursSpent}h</div>
                  </div>
                </Col>
              </Row>

              <Row className="mb-3">
                <Col md={6}>
                  <div style={{marginBottom: '1.5rem'}}>
                    <div style={{fontSize: '0.75rem', fontWeight: '600', color: '#64748b', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.5px'}}>Status</div>
                    <span style={{
                      background: selectedWorkLogDetail.status === 'COMPLETED' ? '#dcfce7' : selectedWorkLogDetail.status === 'IN_PROGRESS' ? '#dbeafe' : '#fef3c7',
                      color: selectedWorkLogDetail.status === 'COMPLETED' ? '#166534' : selectedWorkLogDetail.status === 'IN_PROGRESS' ? '#1e40af' : '#92400e',
                      padding: '0.5rem 1rem',
                      borderRadius: '6px',
                      fontSize: '0.875rem',
                      fontWeight: '600',
                      display: 'inline-block'
                    }}>
                      {selectedWorkLogDetail.status.replace('_', ' ')}
                    </span>
                  </div>
                </Col>
                <Col md={6}>
                  <div style={{marginBottom: '1.5rem'}}>
                    <div style={{fontSize: '0.75rem', fontWeight: '600', color: '#64748b', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.5px'}}>Location</div>
                    <span style={{background: '#f1f5f9', color: '#475569', padding: '0.5rem 1rem', borderRadius: '6px', fontSize: '0.875rem', fontWeight: '500', display: 'inline-block'}}>
                      {selectedWorkLogDetail.location.replace('_', ' ')}
                    </span>
                  </div>
                </Col>
              </Row>

              {selectedWorkLogDetail.project && (
                <div style={{marginBottom: '1.5rem'}}>
                  <div style={{fontSize: '0.75rem', fontWeight: '600', color: '#64748b', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.5px'}}>Project / Client</div>
                  <div style={{fontSize: '1rem', fontWeight: '500', color: '#1e293b'}}>{selectedWorkLogDetail.project}</div>
                </div>
              )}

              <div style={{marginBottom: '1.5rem'}}>
                <div style={{fontSize: '0.75rem', fontWeight: '600', color: '#64748b', marginBottom: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.5px'}}>Work Description</div>
                <div style={{background: '#f8fafc', padding: '1.25rem', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '0.95rem', color: '#334155', lineHeight: '1.6'}}>
                  {selectedWorkLogDetail.workDone}
                </div>
              </div>

              {selectedWorkLogDetail.deliverables && (
                <div style={{marginBottom: '1.5rem'}}>
                  <div style={{fontSize: '0.75rem', fontWeight: '600', color: '#64748b', marginBottom: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.5px'}}>Deliverables / Outcomes</div>
                  <div style={{background: '#eff6ff', padding: '1.25rem', borderRadius: '8px', border: '1px solid #bfdbfe', fontSize: '0.95rem', color: '#1e40af', lineHeight: '1.6'}}>
                    {selectedWorkLogDetail.deliverables}
                  </div>
                </div>
              )}

              {selectedWorkLogDetail.issues && (
                <div style={{marginBottom: '1.5rem'}}>
                  <div style={{fontSize: '0.75rem', fontWeight: '600', color: '#64748b', marginBottom: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.5px'}}>Issues / Blockers</div>
                  <div style={{background: '#fef3c7', padding: '1.25rem', borderRadius: '8px', border: '1px solid #fde68a', fontSize: '0.95rem', color: '#92400e', lineHeight: '1.6'}}>
                    {selectedWorkLogDetail.issues}
                  </div>
                </div>
              )}

              {selectedWorkLogDetail.comments && selectedWorkLogDetail.comments.length > 0 && (
                <div style={{marginTop: '2rem'}}>
                  <div style={{fontSize: '0.95rem', fontWeight: '600', color: '#1e293b', marginBottom: '1rem', paddingBottom: '0.5rem', borderBottom: '2px solid #e2e8f0'}}>
                    <i className="fas fa-comments me-2" style={{color: '#3b82f6'}}></i>Manager Feedback ({selectedWorkLogDetail.comments.length})
                  </div>
                  {selectedWorkLogDetail.comments.map((comment, idx) => (
                    <div key={idx} style={{background: '#f0f9ff', padding: '1rem', borderRadius: '8px', border: '1px solid #bae6fd', marginBottom: '0.75rem'}}>
                      <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '0.5rem'}}>
                        <div style={{fontSize: '0.85rem', fontWeight: '600', color: '#0c4a6e'}}>
                          <i className="fas fa-user-tie me-2"></i>{comment.userId?.firstName} {comment.userId?.lastName}
                        </div>
                        <small style={{fontSize: '0.75rem', color: '#0369a1'}}>{new Date(comment.createdAt).toLocaleString('en-GB')}</small>
                      </div>
                      <div style={{fontSize: '0.9rem', color: '#075985', lineHeight: '1.6'}}>{comment.text}</div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </Modal.Body>
        <Modal.Footer style={{background: '#f8fafc', borderTop: '2px solid #e2e8f0'}}>
          <Button variant="secondary" onClick={() => setShowWorkLogDetailModal(false)} style={{borderRadius: '6px'}}>
            Close
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default Tasks;
