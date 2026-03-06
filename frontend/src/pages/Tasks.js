import React, { useState, useEffect } from 'react';
import { Row, Col, Card, Button, Modal, Form, Table, Badge, Tabs, Tab } from 'react-bootstrap';
import { useAuth } from '../context/AuthContext';
import { useLocation } from 'react-router-dom';
import api from '../utils/api';
import { toast } from 'react-toastify';
import Swal from 'sweetalert2';
import { scheduleTaskReminder, checkDailyReminder, requestNotificationPermission, isWorkingDay } from '../utils/taskReminder';
import '../styles/TaskResponsive.css';
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

  useEffect(() => {
    fetchTasks();
    fetchEmployees();
    checkTodayLog();
    
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
    
    // Check every 5 minutes for 5:30 PM reminder
    const reminderInterval = setInterval(() => {
      if (isWorkingDay() && tasks.length > 0) {
        scheduleTaskReminder(tasks);
      }
    }, 300000); // 5 minutes
    
    return () => clearInterval(reminderInterval);
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
    let interval;
    if (showDetailsModal && selectedTask) {
      interval = setInterval(async () => {
        try {
          const response = await api.get(`/api/tasks/${selectedTask._id}`);
          setSelectedTask(response.data);
        } catch (error) {
          console.error('Error refreshing task');
        }
      }, 3000);
    }
    return () => clearInterval(interval);
  }, [showDetailsModal, selectedTask]);

  const fetchTasks = async () => {
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
      toast.error('Error fetching tasks');
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
    setLoadingStates(prev => ({ ...prev, [`checkin-${task._id}`]: true }));
    try {
      if (task.requireCheckIn) {
        const location = await getLocation();
        await api.post(`/api/tasks/${task._id}/check-in`, location);
      } else {
        await api.put(`/api/tasks/${task._id}/status`, { status: 'IN_PROGRESS' });
      }
      toast.success('Task started');
      fetchTasks();
      setShowCheckInModal(false);
    } catch (error) {
      toast.error('Error starting task');
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
    setLoadingStates(prev => ({ ...prev, update: true }));
    try {
      // Remove empty string values to avoid enum validation errors
      const cleanedData = Object.fromEntries(
        Object.entries(updateForm).filter(([_, v]) => v !== '')
      );
      await api.post(`/api/tasks/${selectedTask._id}/daily-update`, cleanedData);
      toast.success('Daily update submitted');
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

  const handleWorkLogSubmit = async (e) => {
    e.preventDefault();
    setLoadingStates(prev => ({ ...prev, worklog: true }));
    try {
      await api.post('/api/work-logs/bulk', { logs: bulkLogs });
      toast.success('Work log submitted');
      setShowWorkLogModal(false);
      setBulkLogs([{ workDone: '', hoursSpent: '', category: 'GENERAL', status: 'COMPLETED', project: '', deliverables: '', location: 'OFFICE', issues: '', date: new Date().toISOString().split('T')[0], templateData: {}, customCategory: '' }]);
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
      <div className="page-header">
        <div className="d-flex justify-content-between align-items-center">
          <div>
            <h1 className="page-title">
              <i className="fas fa-tasks me-3 text-primary"></i>
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
            <Button variant="outline-primary" size="sm" onClick={() => { fetchWorkLogs(); setShowWorkLogHistory(true); }}>
              <i className="fas fa-history me-2"></i>History
            </Button>
            <Button variant="success" onClick={() => setShowWorkLogModal(true)}>
              <i className="fas fa-plus me-2"></i>Log Work
            </Button>
          </div>
        </div>
      </div>

      <Row>
        <Col>
          <Card>
            <Card.Header>
              <h5 className="mb-0">Task List</h5>
            </Card.Header>
            <Card.Body>
              {tasks.length > 0 ? (
                <>
                {/* Desktop Table View */}
                <div className="d-none d-md-block">
                <Table responsive hover>
                  <thead>
                    <tr>
                      <th>Task</th>
                      <th>Department</th>
                      <th>Type</th>
                      <th>Location</th>
                      <th>Scheduled</th>
                      <th>Priority</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tasks.map(task => (
                      <tr key={task._id} style={{background: isUpdateOverdue(task) ? '#fff3cd' : 'white'}}>
                        <td>
                          <strong>{task.title}</strong>
                          {task.description && <><br/><small className="text-muted">{task.description}</small></>}
                          {isUpdateOverdue(task) && (
                            <><br/><Badge bg="warning" text="dark" style={{fontSize: '0.7rem'}}>
                              <i className="fas fa-exclamation-triangle me-1"></i>Update Overdue
                            </Badge></>
                          )}
                          <br/><small className="text-muted"><i className="fas fa-clock me-1"></i>{getLastUpdateTime(task)}</small>
                        </td>
                        <td>{task.department}</td>
                        <td>{task.taskType}</td>
                        <td><Badge bg="secondary">{task.workLocation}</Badge></td>
                        <td>{new Date(task.scheduledDate).toLocaleDateString()}</td>
                        <td>{getPriorityBadge(task.priority)}</td>
                        <td>{getStatusBadge(task.status)}</td>
                        <td>
                          <div className="d-flex gap-2">
                            {task.status === 'ASSIGNED' && (
                              <Button size="sm" variant="primary" onClick={() => {
                                setSelectedTask(task);
                                setShowCheckInModal(true);
                              }} disabled={loadingStates[`start-${task._id}`]}>
                                {loadingStates[`start-${task._id}`] ? <><span className="spinner-border spinner-border-sm me-1"></span>Starting...</> : 'Start'}
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
                                }} disabled={loadingStates[`update-${task._id}`]}>
                                  {loadingStates[`update-${task._id}`] ? <><span className="spinner-border spinner-border-sm me-1"></span>Loading...</> : 'Update'}
                                </Button>
                                <Button size="sm" variant="success" onClick={() => {
                                  setSelectedTask(task);
                                  setShowCheckOutModal(true);
                                }} disabled={loadingStates[`complete-${task._id}`]}>
                                  {loadingStates[`complete-${task._id}`] ? <><span className="spinner-border spinner-border-sm me-1"></span>Loading...</> : 'Complete'}
                                </Button>
                              </>
                            )}
                            <Button size="sm" variant="outline-info" onClick={() => handleViewTask(task)} disabled={loadingStates[`view-${task._id}`]}>
                              {loadingStates[`view-${task._id}`] ? <><span className="spinner-border spinner-border-sm me-1"></span>Loading...</> : 'View'}
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
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
                <div className="text-center py-4">
                  <i className="fas fa-tasks text-muted fs-1 mb-3"></i>
                  <p className="text-muted mb-0">No tasks assigned</p>
                </div>
              )}
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* Start Task Modal */}
      <Modal show={showCheckInModal} onHide={() => setShowCheckInModal(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title>Start Task</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p>Are you sure you want to start this task?</p>
          {selectedTask && (
            <div className="alert alert-info">
              <strong>{selectedTask.title}</strong><br/>
              Department: {selectedTask.department}<br/>
              Type: {selectedTask.taskType}
            </div>
          )}
          {selectedTask?.requireCheckIn && <small className="text-muted">Your location will be recorded</small>}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowCheckInModal(false)}>Cancel</Button>
          <Button variant="primary" onClick={() => handleCheckIn(selectedTask)} disabled={loadingStates[`checkin-${selectedTask?._id}`]}>
            {loadingStates[`checkin-${selectedTask?._id}`] ? (
              <><span className="spinner-border spinner-border-sm me-2"></span>Starting...</>
            ) : (
              <><i className="fas fa-play me-2"></i>Start Task</>
            )}
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Complete Task Modal */}
      <Modal show={showCheckOutModal} onHide={() => setShowCheckOutModal(false)} size="lg" centered>
        <Modal.Header closeButton>
          <Modal.Title>Complete Task</Modal.Title>
        </Modal.Header>
        <Form onSubmit={handleCheckOut}>
          <Modal.Body>
            <Form.Group className="mb-3">
              <Form.Label>Outcome</Form.Label>
              <Form.Control type="text" value={checkOutForm.outcome} onChange={(e) => setCheckOutForm({...checkOutForm, outcome: e.target.value})} placeholder="e.g., Success, Completed, Delivered" />
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>Notes</Form.Label>
              <Form.Control as="textarea" rows={3} value={checkOutForm.notes} onChange={(e) => setCheckOutForm({...checkOutForm, notes: e.target.value})} placeholder="Add task notes..." />
            </Form.Group>

            <Row>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Actual Hours</Form.Label>
                  <Form.Control type="number" step="0.5" value={checkOutForm.actualHours} onChange={(e) => setCheckOutForm({...checkOutForm, actualHours: e.target.value})} placeholder="0" />
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Next Follow-up Date</Form.Label>
                  <Form.Control type="date" value={checkOutForm.nextFollowUpDate} onChange={(e) => setCheckOutForm({...checkOutForm, nextFollowUpDate: e.target.value})} />
                </Form.Group>
              </Col>
            </Row>

            {selectedTask?.department === 'Sales' && (
              <>
                <Form.Group className="mb-3">
                  <Form.Label>Order Value</Form.Label>
                  <Form.Control type="number" value={checkOutForm.orderValue} onChange={(e) => setCheckOutForm({...checkOutForm, orderValue: e.target.value})} placeholder="0" />
                </Form.Group>

                <Form.Group className="mb-3">
                  <Form.Label>Order Details</Form.Label>
                  <Form.Control as="textarea" rows={2} value={checkOutForm.orderDetails} onChange={(e) => setCheckOutForm({...checkOutForm, orderDetails: e.target.value})} placeholder="Order details..." />
                </Form.Group>
              </>
            )}
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={() => setShowCheckOutModal(false)}>Cancel</Button>
            <Button variant="success" type="submit" disabled={loadingStates.checkout}>
              {loadingStates.checkout ? (
                <><span className="spinner-border spinner-border-sm me-2"></span>Completing...</>
              ) : (
                <><i className="fas fa-check me-2"></i>Complete Task</>
              )}
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>

      {/* Task Details Modal */}
      <Modal show={showDetailsModal} onHide={() => setShowDetailsModal(false)} size="xl" centered className="d-none d-md-block">
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

      {/* Mobile Task Details */}
      <MobileTaskDetails 
        task={selectedTask}
        show={showDetailsModal}
        onHide={() => setShowDetailsModal(false)}
        user={user}
        onAddComment={handleAddComment}
      />

      {/* Daily Update Modal - Simplified */}
      <Modal show={showUpdateModal} onHide={() => setShowUpdateModal(false)} size="lg" centered className="d-none d-md-block">
        <Modal.Header closeButton style={{background: '#ffffff', color: '#1a1a1a', borderBottom: '2px solid #e0e0e0'}}>
          <Modal.Title style={{fontSize: '1.2rem', fontWeight: '600'}}>
            Daily Progress Update
          </Modal.Title>
        </Modal.Header>
        <Form onSubmit={handleDailyUpdate}>
          <Modal.Body style={{padding: '2rem', background: '#f8f9fa'}}>
            {selectedTask && (
              <div className="alert" style={{background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: 'white', border: 'none', borderRadius: '12px', padding: '1rem', marginBottom: '1.5rem'}}>
                <div style={{fontSize: '1.1rem', fontWeight: '600', marginBottom: '0.25rem'}}>{selectedTask.title}</div>
                <div style={{fontSize: '0.9rem', opacity: 0.9}}>{selectedTask.department} • {selectedTask.taskType}</div>
              </div>
            )}

            <div style={{background: 'white', padding: '1.5rem', borderRadius: '12px', marginBottom: '1.5rem', boxShadow: '0 2px 8px rgba(0,0,0,0.08)'}}>
              <Form.Group className="mb-3">
                <Form.Label style={{fontSize: '1rem', fontWeight: '600', color: '#1a1a1a', marginBottom: '1rem'}}>Progress Percentage</Form.Label>
                <div className="text-center mb-3">
                  <div style={{display: 'inline-block', position: 'relative'}}>
                    <svg width="120" height="120" style={{transform: 'rotate(-90deg)'}}>
                      <circle cx="60" cy="60" r="50" fill="none" stroke="#e9ecef" strokeWidth="10"/>
                      <circle cx="60" cy="60" r="50" fill="none" 
                        stroke={updateForm.progressPercent >= 75 ? '#28a745' : updateForm.progressPercent >= 50 ? '#0dcaf0' : updateForm.progressPercent >= 25 ? '#ffc107' : '#dc3545'}
                        strokeWidth="10" strokeDasharray={`${updateForm.progressPercent * 3.14} 314`} strokeLinecap="round"/>
                    </svg>
                    <div style={{position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)'}}>
                      <h2 className="mb-0" style={{fontSize: '2rem', fontWeight: '700'}}>{updateForm.progressPercent}%</h2>
                    </div>
                  </div>
                </div>
                <Form.Range 
                  min="0" 
                  max="100" 
                  step="5"
                  value={updateForm.progressPercent} 
                  onChange={(e) => setUpdateForm({...updateForm, progressPercent: e.target.value})} 
                  style={{height: '8px'}}
                />
                <div className="d-flex justify-content-between mt-2">
                  <small style={{color: '#6c757d'}}>0%</small>
                  <small style={{color: '#6c757d'}}>50%</small>
                  <small style={{color: '#6c757d'}}>100%</small>
                </div>
              </Form.Group>
            </div>

            <Row className="mb-3">
              <Col md={6}>
                <div style={{background: 'white', padding: '1.5rem', borderRadius: '12px', height: '100%', boxShadow: '0 2px 8px rgba(0,0,0,0.08)'}}>
                  <Form.Group>
                    <Form.Label style={{fontSize: '0.95rem', fontWeight: '600', color: '#1a1a1a', marginBottom: '0.75rem'}}>Task Status</Form.Label>
                    <Form.Select 
                      value={updateForm.status} 
                      onChange={(e) => setUpdateForm({...updateForm, status: e.target.value})} 
                      required
                      style={{padding: '0.75rem', fontSize: '0.95rem', borderRadius: '8px', border: '2px solid #e0e0e0'}}
                    >
                      <option value="ON_TRACK">✓ On Track</option>
                      <option value="NEED_HELP">⚠ Need Help</option>
                      <option value="BLOCKED">✗ Blocked</option>
                      <option value="COMPLETED">✓ Completed</option>
                    </Form.Select>
                  </Form.Group>
                </div>
              </Col>
              <Col md={6}>
                <div style={{background: 'white', padding: '1.5rem', borderRadius: '12px', height: '100%', boxShadow: '0 2px 8px rgba(0,0,0,0.08)'}}>
                  <Form.Group>
                    <Form.Label style={{fontSize: '0.95rem', fontWeight: '600', color: '#1a1a1a', marginBottom: '0.75rem'}}>Hours Worked</Form.Label>
                    <Form.Control 
                      type="number" 
                      step="0.5" 
                      min="0" 
                      max="12" 
                      value={updateForm.hoursSpent} 
                      onChange={(e) => setUpdateForm({...updateForm, hoursSpent: e.target.value})} 
                      placeholder="e.g., 8"
                      style={{padding: '0.75rem', fontSize: '0.95rem', borderRadius: '8px', border: '2px solid #e0e0e0'}}
                    />
                  </Form.Group>
                </div>
              </Col>
            </Row>

            <div style={{background: 'white', padding: '1.5rem', borderRadius: '12px', marginBottom: '1.5rem', boxShadow: '0 2px 8px rgba(0,0,0,0.08)'}}>
              <Form.Group>
                <Form.Label style={{fontSize: '0.95rem', fontWeight: '600', color: '#1a1a1a', marginBottom: '0.75rem'}}>What work did you complete today? <span className="text-danger">*</span></Form.Label>
                <Form.Control 
                  as="textarea" 
                  rows={4} 
                  value={updateForm.workDone} 
                  onChange={(e) => setUpdateForm({...updateForm, workDone: e.target.value})} 
                  placeholder={selectedTask?.department === 'Sales' ? "Example: Met 2 clients, gave product demo, received order of Rs. 50,000" : "Example: Completed assigned work, attended meetings, coordinated with team"}
                  required 
                  style={{padding: '0.75rem', fontSize: '0.95rem', borderRadius: '8px', border: '2px solid #e0e0e0', resize: 'none'}}
                />
              </Form.Group>
            </div>

            {(updateForm.status === 'BLOCKED' || updateForm.status === 'NEED_HELP') && (
              <div style={{background: '#fff3cd', padding: '1.5rem', borderRadius: '12px', marginBottom: '1.5rem', border: '2px solid #ffc107'}}>
                <Form.Group>
                  <Form.Label style={{fontSize: '0.95rem', fontWeight: '600', color: '#856404', marginBottom: '0.75rem'}}>What issues are you facing? <span className="text-danger">*</span></Form.Label>
                  <Form.Control 
                    as="textarea" 
                    rows={3} 
                    value={updateForm.issues} 
                    onChange={(e) => setUpdateForm({...updateForm, issues: e.target.value})} 
                    placeholder="Describe the problem or what help you need"
                    required
                    style={{padding: '0.75rem', fontSize: '0.95rem', borderRadius: '8px', border: '2px solid #ffc107', resize: 'none', background: 'white'}}
                  />
                </Form.Group>
              </div>
            )}

            {selectedTask?.department === 'Sales' && (
              <div style={{background: 'white', padding: '1.5rem', borderRadius: '12px', marginBottom: '1.5rem', boxShadow: '0 2px 8px rgba(0,0,0,0.08)'}}>
                <h6 className="mb-3" style={{fontSize: '1rem', fontWeight: '600', color: '#1a1a1a'}}>Sales Details (Optional)</h6>
                <Row>
                  <Col md={6}>
                    <Form.Group className="mb-3">
                      <Form.Label style={{fontSize: '0.9rem', fontWeight: '500'}}>Meeting Result</Form.Label>
                      <Form.Select value={updateForm.visitOutcome} onChange={(e) => setUpdateForm({...updateForm, visitOutcome: e.target.value})} style={{padding: '0.75rem', fontSize: '0.95rem', borderRadius: '8px', border: '2px solid #e0e0e0'}}>
                        <option value="">Select...</option>
                        <option value="POSITIVE">Positive</option>
                        <option value="NEUTRAL">Need Follow-up</option>
                        <option value="NEGATIVE">Not Interested</option>
                        <option value="ORDER_RECEIVED">Got Order</option>
                      </Form.Select>
                    </Form.Group>
                  </Col>
                  <Col md={6}>
                    <Form.Group className="mb-3">
                      <Form.Label style={{fontSize: '0.9rem', fontWeight: '500'}}>Order Amount</Form.Label>
                      <Form.Control 
                        type="number" 
                        value={updateForm.orderValue} 
                        onChange={(e) => setUpdateForm({...updateForm, orderValue: e.target.value})} 
                        placeholder="Rs. 0"
                        style={{padding: '0.75rem', fontSize: '0.95rem', borderRadius: '8px', border: '2px solid #e0e0e0'}}
                      />
                    </Form.Group>
                  </Col>
                </Row>
              </div>
            )}

            <div style={{background: 'white', padding: '1.5rem', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)'}}>
              <Form.Group>
                <Form.Label style={{fontSize: '0.95rem', fontWeight: '600', color: '#1a1a1a', marginBottom: '0.75rem'}}>Plan for Tomorrow</Form.Label>
                <Form.Control 
                  as="textarea" 
                  rows={2} 
                  value={updateForm.nextDayPlan} 
                  onChange={(e) => setUpdateForm({...updateForm, nextDayPlan: e.target.value})} 
                  placeholder="What will you work on tomorrow?"
                  style={{padding: '0.75rem', fontSize: '0.95rem', borderRadius: '8px', border: '2px solid #e0e0e0', resize: 'none'}}
                />
              </Form.Group>
            </div>
          </Modal.Body>
          <Modal.Footer style={{background: '#ffffff', borderTop: '2px solid #e0e0e0', padding: '1.25rem 2rem'}}>
            <Button variant="light" onClick={() => setShowUpdateModal(false)} style={{padding: '0.75rem 1.5rem', fontSize: '0.95rem', fontWeight: '600', borderRadius: '8px', border: '2px solid #e0e0e0'}}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" disabled={loadingStates.update} style={{padding: '0.75rem 2rem', fontSize: '0.95rem', fontWeight: '600', borderRadius: '8px', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', border: 'none', boxShadow: '0 4px 12px rgba(102, 126, 234, 0.4)'}}>
              {loadingStates.update ? (
                <><span className="spinner-border spinner-border-sm me-2"></span>Submitting...</>
              ) : (
                <><i className="fas fa-paper-plane me-2"></i>Submit Update</>
              )}
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>

      {/* Mobile Daily Update */}
      <MobileDailyUpdate
        show={showUpdateModal}
        onHide={() => setShowUpdateModal(false)}
        task={selectedTask}
        updateForm={updateForm}
        setUpdateForm={setUpdateForm}
        onSubmit={handleDailyUpdate}
      />

      {/* Work Log Modal */}
      <Modal show={showWorkLogModal} onHide={() => {
        setShowWorkLogModal(false);
        setSelectedWorkLogDetail(null);
        setBulkLogs([{ workDone: '', hoursSpent: '', category: 'GENERAL', status: 'COMPLETED', project: '', deliverables: '', location: 'OFFICE', issues: '', date: new Date().toISOString().split('T')[0], templateData: {}, customCategory: '' }]);
      }} size="xl" centered>
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
      <Modal show={showWorkLogHistory} onHide={() => setShowWorkLogHistory(false)} size="xl" centered>
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
