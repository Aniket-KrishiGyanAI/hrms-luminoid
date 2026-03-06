import React, { useState, useEffect } from 'react';
import { Row, Col, Card, Button, Modal, Form, Table, Badge, Tabs, Tab, Dropdown } from 'react-bootstrap';
import { useAuth } from '../context/AuthContext';
import { useLocation } from 'react-router-dom';
import api from '../utils/api';
import { toast } from 'react-toastify';
import * as XLSX from 'xlsx';
import Swal from 'sweetalert2';
import '../styles/TaskResponsive.css';
import '../styles/TaskManagement.css';
import MobileTaskDetails from '../components/MobileTaskDetails';

const TASK_TYPES = {
  'Human Resources': ['INTERVIEW', 'ONBOARDING', 'TRAINING', 'EMPLOYEE_MEETING', 'PERFORMANCE_REVIEW', 'OTHER'],
  'Engineering': ['DEVELOPMENT', 'CODE_REVIEW', 'TESTING', 'DEPLOYMENT', 'BUG_FIX', 'DOCUMENTATION', 'OTHER'],
  'Sales': ['LEAD_VISIT', 'DEMO', 'DELIVERY', 'COLLECTION', 'FOLLOW_UP', 'CLIENT_MEETING', 'PROPOSAL', 'OTHER'],
  'Marketing': ['CAMPAIGN', 'CONTENT_CREATION', 'SOCIAL_MEDIA', 'EVENT', 'RESEARCH', 'CLIENT_MEETING', 'OTHER'],
  'Finance': ['ACCOUNTING', 'AUDIT', 'BUDGETING', 'REPORTING', 'PAYMENT_PROCESSING', 'TAX_FILING', 'OTHER'],
  'Operations': ['SITE_INSTALLATION', 'TROUBLESHOOTING', 'MAINTENANCE', 'SUPPORT', 'LOGISTICS', 'VENDOR_MANAGEMENT', 'OTHER'],
  'General': ['PROJECT_WORK', 'DOCUMENTATION', 'RESEARCH', 'MEETING', 'OTHER']
};

const TaskManagement = () => {
  const { user } = useAuth();
  const location = useLocation();
  const [tasks, setTasks] = useState([]);
  const [filteredTasks, setFilteredTasks] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);
  const [comment, setComment] = useState('');
  const [mentionSuggestions, setMentionSuggestions] = useState([]);
  const [showMentions, setShowMentions] = useState(false);
  const [mentionSearch, setMentionSearch] = useState('');
  const [filters, setFilters] = useState({ status: '', priority: '', department: '', search: '' });
  const [gpsAddresses, setGpsAddresses] = useState({ checkIn: '', checkOut: '' });
  const [customTaskType, setCustomTaskType] = useState('');
  const [showDownloadModal, setShowDownloadModal] = useState(false);
  const [customDepartment, setCustomDepartment] = useState('');
  const [loadingStates, setLoadingStates] = useState({});
  const [workLogs, setWorkLogs] = useState([]);
  const [workLogFilters, setWorkLogFilters] = useState({ startDate: '', endDate: '', userId: '', status: '', search: '', dateRange: '' });
  const [workLogStats, setWorkLogStats] = useState({ totalLogs: 0, totalHours: 0, completed: 0, inProgress: 0 });
  const [workLogPage, setWorkLogPage] = useState(1);
  const [workLogTotal, setWorkLogTotal] = useState(0);
  const [dateRangeDisplay, setDateRangeDisplay] = useState('');
  const [showWorkLogModal, setShowWorkLogModal] = useState(false);
  const [showWorkLogHistory, setShowWorkLogHistory] = useState(false);
  const [showWorkLogDetails, setShowWorkLogDetails] = useState(false);
  const [showCommentModal, setShowCommentModal] = useState(false);
  const [selectedWorkLog, setSelectedWorkLog] = useState(null);
  const [workLogComment, setWorkLogComment] = useState('');
  const [workLogForm, setWorkLogForm] = useState({
    date: '', workDone: '', hoursSpent: '', status: 'COMPLETED', 
    project: '', deliverables: '', location: 'OFFICE', issues: '', category: 'GENERAL'
  });
  const [taskForm, setTaskForm] = useState({
    title: '', description: '', department: '', taskType: '', category: '',
    assignedTo: [], workLocation: 'OFFICE', requireCheckIn: false,
    clientName: '', clientPhone: '', clientCompany: '', clientAddress: '',
    scheduledDate: '', dueDate: '', estimatedHours: '', priority: 'MEDIUM', tags: ''
  });

  useEffect(() => {
    fetchTasks();
    fetchEmployees();
    fetchDepartments();
  }, []);

  useEffect(() => {
    // Refresh departments every 30 seconds to get latest
    const deptInterval = setInterval(fetchDepartments, 30000);
    return () => clearInterval(deptInterval);
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
    applyFilters();
  }, [tasks, filters]);

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
      setFilteredTasks(response.data);
    } catch (error) {
      toast.error('Error fetching tasks');
    } finally {
      setLoading(false);
    }
  };

  const fetchEmployees = async () => {
    try {
      const response = await api.get('/api/employees');
      const allUsers = response.data;
      const managersAndAbove = allUsers.filter(emp => 
        ['ADMIN', 'HR', 'MANAGER'].includes(emp.role)
      );
      setEmployees([...managersAndAbove, ...allUsers.filter(emp => !['ADMIN', 'HR', 'MANAGER'].includes(emp.role))]);
    } catch (error) {
      console.error('Error fetching employees');
    }
  };

  const fetchWorkLogs = async () => {
    try {
      const params = new URLSearchParams();
      params.append('page', workLogPage);
      params.append('limit', 50);
      
      let startDate = workLogFilters.startDate;
      let endDate = workLogFilters.endDate;
      let displayText = '';
      
      if (workLogFilters.dateRange === 'THIS_WEEK') {
        const today = new Date();
        const firstDay = new Date(today.setDate(today.getDate() - today.getDay()));
        const lastDay = new Date(today.setDate(today.getDate() - today.getDay() + 6));
        startDate = firstDay.toISOString().split('T')[0];
        endDate = lastDay.toISOString().split('T')[0];
        displayText = `${firstDay.toLocaleDateString('en-GB', {day: '2-digit', month: 'short'})} - ${lastDay.toLocaleDateString('en-GB', {day: '2-digit', month: 'short', year: 'numeric'})}`;
      } else if (workLogFilters.dateRange === 'THIS_MONTH') {
        const today = new Date();
        const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
        const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);
        startDate = firstDay.toISOString().split('T')[0];
        endDate = lastDay.toISOString().split('T')[0];
        displayText = `${firstDay.toLocaleDateString('en-GB', {month: 'long', year: 'numeric'})}`;
      } else if (startDate && endDate) {
        displayText = `${new Date(startDate).toLocaleDateString('en-GB', {day: '2-digit', month: 'short'})} - ${new Date(endDate).toLocaleDateString('en-GB', {day: '2-digit', month: 'short', year: 'numeric'})}`;
      }
      
      setDateRangeDisplay(displayText);
      
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);
      if (workLogFilters.userId) params.append('userId', workLogFilters.userId);
      
      const response = await api.get(`/api/work-logs/all?${params}`);
      setWorkLogs(response.data.logs);
      setWorkLogStats(response.data.stats);
      setWorkLogTotal(response.data.total);
    } catch (error) {
      toast.error('Error fetching work logs');
    }
  };

  const exportWorkLogs = async () => {
    try {
      const params = new URLSearchParams();
      if (workLogFilters.startDate) params.append('startDate', workLogFilters.startDate);
      if (workLogFilters.endDate) params.append('endDate', workLogFilters.endDate);
      if (workLogFilters.userId) params.append('userId', workLogFilters.userId);
      const response = await api.get(`/api/work-logs/export?${params}`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `work-logs-${Date.now()}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success('Work logs exported successfully');
    } catch (error) {
      toast.error('Error exporting work logs');
    }
  };

  const handleDeleteWorkLog = async (logId) => {
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
        toast.success('Work log deleted successfully');
        fetchWorkLogs();
      } catch (error) {
        toast.error('Error deleting work log');
      }
    }
  };

  const handleEditWorkLog = (log) => {
    setSelectedWorkLog(log);
    setWorkLogForm({
      date: new Date(log.date).toISOString().split('T')[0],
      workDone: log.workDone,
      hoursSpent: log.hoursSpent,
      status: log.status,
      project: log.project || '',
      deliverables: log.deliverables || '',
      location: log.location,
      issues: log.issues || '',
      category: log.category
    });
    setShowWorkLogModal(true);
  };

  const handleViewWorkLog = async (log) => {
    try {
      const response = await api.get(`/api/work-logs/${log._id}`);
      setSelectedWorkLog(response.data);
      setShowWorkLogDetails(true);
    } catch (error) {
      toast.error('Error fetching work log details');
    }
  };

  const handleWorkLogSubmit = async (e) => {
    e.preventDefault();
    try {
      await api.put(`/api/work-logs/${selectedWorkLog._id}`, workLogForm);
      toast.success('Work log updated successfully');
      setShowWorkLogModal(false);
      setSelectedWorkLog(null);
      setWorkLogForm({
        date: '', workDone: '', hoursSpent: '', status: 'COMPLETED',
        project: '', deliverables: '', location: 'OFFICE', issues: '', category: 'GENERAL'
      });
      fetchWorkLogs();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Error saving work log');
    }
  };

  const handleAddWorkLogComment = async () => {
    if (!workLogComment.trim()) return;
    try {
      const response = await api.post(`/api/work-logs/${selectedWorkLog._id}/comments`, { text: workLogComment });
      setSelectedWorkLog(response.data);
      setWorkLogComment('');
      toast.success('Comment added');
    } catch (error) {
      toast.error('Error adding comment');
    }
  };

  const fetchDepartments = async () => {
    try {
      const response = await api.get('/api/departments');
      if (response.data && response.data.data && Array.isArray(response.data.data)) {
        const activeDepts = response.data.data.filter(dept => dept.status === 'ACTIVE');
        console.log('Loaded departments:', activeDepts.map(d => d.name));
        setDepartments(activeDepts);
      }
    } catch (error) {
      console.error('Department API Error:', error.response?.status, error.message);
    }
  };

  const applyFilters = () => {
    let filtered = [...tasks];
    if (filters.status) filtered = filtered.filter(t => t.status === filters.status);
    if (filters.priority) filtered = filtered.filter(t => t.priority === filters.priority);
    if (filters.department) filtered = filtered.filter(t => t.department === filters.department);
    if (filters.search) {
      const search = filters.search.toLowerCase();
      filtered = filtered.filter(t => 
        t.title.toLowerCase().includes(search) || 
        t.description?.toLowerCase().includes(search) ||
        t.assignedTo?.some(emp => `${emp.firstName} ${emp.lastName}`.toLowerCase().includes(search))
      );
    }
    setFilteredTasks(filtered);
  };

  const exportToExcel = (taskList) => {
    const filterInfo = [];
    if (filters.status) filterInfo.push(`Status: ${filters.status}`);
    if (filters.priority) filterInfo.push(`Priority: ${filters.priority}`);
    if (filters.department) filterInfo.push(`Department: ${filters.department}`);
    if (filters.search) filterInfo.push(`Search: ${filters.search}`);
    
    const filterText = filterInfo.length > 0 ? filterInfo.join(' | ') : 'No filters applied';
    
    const data = taskList.map(t => ({
      'Task': t.title,
      'Assigned To': t.assignedTo?.map(e => `${e.firstName} ${e.lastName}`).join(', '),
      'Department': t.department,
      'Type': t.taskType,
      'Location': t.workLocation,
      'Scheduled Date': new Date(t.scheduledDate).toLocaleDateString(),
      'Due Date': t.dueDate ? new Date(t.dueDate).toLocaleDateString() : 'N/A',
      'Progress %': t.progressPercent || 0,
      'Priority': t.priority,
      'Status': t.status,
      'Assigned By': `${t.assignedBy?.firstName} ${t.assignedBy?.lastName}`,
      'Last Updated': getTimeAgo(t.updatedAt)
    }));
    
    const ws = XLSX.utils.aoa_to_sheet([]);
    XLSX.utils.sheet_add_aoa(ws, [[`Filters Applied: ${filterText}`]], { origin: 'A1' });
    XLSX.utils.sheet_add_aoa(ws, [['']], { origin: 'A2' });
    XLSX.utils.sheet_add_json(ws, data, { origin: 'A3' });
    
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Tasks');
    XLSX.writeFile(wb, `tasks_${new Date().toISOString().split('T')[0]}.xlsx`);
    toast.success('Excel exported successfully');
  };

  const getTimeAgo = (date) => {
    const seconds = Math.floor((new Date() - new Date(date)) / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  const handleQuickStatusUpdate = async (taskId, newStatus) => {
    setLoadingStates(prev => ({ ...prev, [`status-${taskId}`]: true }));
    try {
      await api.put(`/api/tasks/${taskId}`, { status: newStatus });
      toast.success('Status updated');
      fetchTasks();
    } catch (error) {
      toast.error('Error updating status');
    } finally {
      setLoadingStates(prev => ({ ...prev, [`status-${taskId}`]: false }));
    }
  };

  const getPriorityColor = (priority) => {
    switch(priority) {
      case 'HIGH': return '#fef2f2';
      case 'MEDIUM': return '#fef9e7';
      case 'LOW': return '#f0f9ff';
      default: return 'white';
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoadingStates(prev => ({ ...prev, submit: true }));
    try {
      const finalTaskType = taskForm.taskType === 'OTHER' && customTaskType ? customTaskType : taskForm.taskType;
      const finalDepartment = taskForm.department === 'Other' && customDepartment ? customDepartment : taskForm.department;
      
      const payload = {
        title: taskForm.title, description: taskForm.description, department: finalDepartment,
        taskType: finalTaskType, category: taskForm.category, assignedTo: taskForm.assignedTo,
        workLocation: taskForm.workLocation, requireCheckIn: taskForm.requireCheckIn,
        scheduledDate: taskForm.scheduledDate, dueDate: taskForm.dueDate,
        estimatedHours: taskForm.estimatedHours, priority: taskForm.priority,
        tags: taskForm.tags ? taskForm.tags.split(',').map(t => t.trim()) : []
      };

      if (taskForm.clientName) {
        payload.client = {
          name: taskForm.clientName, phone: taskForm.clientPhone,
          company: taskForm.clientCompany, address: taskForm.clientAddress
        };
      }

      if (selectedTask) {
        await api.put(`/api/tasks/${selectedTask._id}`, payload);
        Swal.fire('Updated!', 'Task has been updated successfully', 'success');
      } else {
        await api.post('/api/tasks', payload);
        Swal.fire('Created!', 'Task has been created successfully', 'success');
      }
      
      setShowModal(false);
      setSelectedTask(null);
      setCustomTaskType('');
      setCustomDepartment('');
      setTaskForm({
        title: '', description: '', department: '', taskType: '', category: '',
        assignedTo: [], workLocation: 'OFFICE', requireCheckIn: false,
        clientName: '', clientPhone: '', clientCompany: '', clientAddress: '',
        scheduledDate: '', dueDate: '', estimatedHours: '', priority: 'MEDIUM', tags: ''
      });
      fetchTasks();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Error saving task');
    } finally {
      setLoadingStates(prev => ({ ...prev, submit: false }));
    }
  };

  const handleDelete = async (id) => {
    const result = await Swal.fire({
      title: 'Delete Task?',
      text: 'This action cannot be undone',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#6c757d',
      confirmButtonText: 'Yes, delete it',
      cancelButtonText: 'Cancel'
    });

    if (result.isConfirmed) {
      setLoadingStates(prev => ({ ...prev, [`delete-${id}`]: true }));
      try {
        await api.delete(`/api/tasks/${id}`);
        fetchTasks();
        Swal.fire('Deleted!', 'Task has been deleted successfully', 'success');
      } catch (error) {
        Swal.fire('Error!', 'Failed to delete task', 'error');
      } finally {
        setLoadingStates(prev => ({ ...prev, [`delete-${id}`]: false }));
      }
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

  const handleDuplicate = async (taskId) => {
    const result = await Swal.fire({
      title: 'Duplicate Task?',
      text: 'Create a copy of this task',
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#10b981',
      cancelButtonColor: '#6c757d',
      confirmButtonText: 'Yes, duplicate it',
      cancelButtonText: 'Cancel'
    });

    if (result.isConfirmed) {
      setLoadingStates(prev => ({ ...prev, [`duplicate-${taskId}`]: true }));
      try {
        await api.post(`/api/tasks/${taskId}/duplicate`);
        Swal.fire('Duplicated!', 'Task has been duplicated successfully', 'success');
        fetchTasks();
      } catch (error) {
        Swal.fire('Error!', 'Failed to duplicate task', 'error');
      } finally {
        setLoadingStates(prev => ({ ...prev, [`duplicate-${taskId}`]: true }));
      }
    }
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

  const renderTaskTable = (taskList, showAssignedBy = false) => (
    <>
    {/* Desktop Table View */}
    <div className="d-none d-md-block task-list-modern">
      {taskList.map(task => (
        <div key={task._id} className="task-item">
          <div className="task-item-main">
            <div className="task-info">
              <div className={`task-priority-indicator priority-${task.priority.toLowerCase()}`}></div>
              <div className="task-details">
                <h3 className="task-name">{task.title}</h3>
                <div className="task-metadata">
                  <span className="meta-item">
                    <i className="fas fa-building"></i>
                    {task.department}
                  </span>
                  <span className="meta-item">
                    <i className="fas fa-briefcase"></i>
                    {task.taskType.replace(/_/g, ' ')}
                  </span>
                  <span className="meta-item">
                    <i className="fas fa-calendar"></i>
                    {new Date(task.scheduledDate).toLocaleDateString('en-GB', {day: '2-digit', month: 'short', year: 'numeric'})}
                  </span>
                  <span className="meta-item">
                    <i className="fas fa-map-marker-alt"></i>
                    {task.workLocation}
                  </span>
                </div>
              </div>
            </div>
            
            <div className="task-assignees">
              <div className="assignee-label">{showAssignedBy ? 'Assigned By' : 'Assigned To'}</div>
              <div className="assignee-list">
                {showAssignedBy ? (
                  <div className="assignee-item">
                    <div className="assignee-avatar" style={{background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)'}}>
                      {task.assignedBy?.firstName[0]}{task.assignedBy?.lastName[0]}
                    </div>
                    <span className="assignee-name">{task.assignedBy?.firstName} {task.assignedBy?.lastName}</span>
                  </div>
                ) : (
                  <>
                    {task.assignedTo?.slice(0, 3).map(emp => (
                      <div key={emp._id} className="assignee-item">
                        <div className="assignee-avatar" style={{background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)'}}>
                          {emp.firstName[0]}{emp.lastName[0]}
                        </div>
                        <span className="assignee-name">{emp.firstName} {emp.lastName}</span>
                      </div>
                    ))}
                    {task.assignedTo?.length > 3 && (
                      <div className="assignee-more">+{task.assignedTo.length - 3}</div>
                    )}
                  </>
                )}
              </div>
            </div>

            <div className="task-progress-section">
              <div className="progress-label">Progress</div>
              <div className="progress-wrapper">
                <div className="progress-bar-container">
                  <div className="progress-bar-fill" style={{
                    width: `${task.progressPercent || 0}%`,
                    background: task.progressPercent >= 75 ? 'linear-gradient(90deg, #10b981 0%, #059669 100%)' : 
                               task.progressPercent >= 50 ? 'linear-gradient(90deg, #3b82f6 0%, #2563eb 100%)' : 
                               task.progressPercent >= 25 ? 'linear-gradient(90deg, #f59e0b 0%, #d97706 100%)' : 
                               'linear-gradient(90deg, #ef4444 0%, #dc2626 100%)'
                  }}></div>
                </div>
                <span className="progress-percentage">{task.progressPercent || 0}%</span>
              </div>
            </div>

            <div className="task-status-section">
              <Badge className={`priority-tag priority-${task.priority.toLowerCase()}`}>
                <i className="fas fa-flag"></i>
                {task.priority}
              </Badge>
              <div className={`status-badge status-${task.status.toLowerCase().replace('_', '-')}`}>
                <span className="status-indicator"></span>
                {task.status.replace('_', ' ')}
              </div>
            </div>

            <div className="task-actions-section">
              <div className="action-column">
                <Button className="action-button action-view" onClick={() => handleViewTask(task)} disabled={loadingStates[`view-${task._id}`]}>
                  {loadingStates[`view-${task._id}`] ? <><span className="spinner-border spinner-border-sm me-1"></span>Loading...</> : 'View'}
                </Button>
                <Button className="action-button action-duplicate" onClick={() => handleDuplicate(task._id)} disabled={loadingStates[`duplicate-${task._id}`]}>
                  {loadingStates[`duplicate-${task._id}`] ? <><span className="spinner-border spinner-border-sm me-1"></span>Copying...</> : 'Copy'}
                </Button>
              </div>
              {((task.assignedBy?._id === user?.id && task.status === 'ASSIGNED') || user?.role === 'ADMIN') && (
                <div className="action-column">
                  <Button className="action-button action-edit" onClick={() => {
                    fetchDepartments();
                    setTaskForm({
                      title: task.title, description: task.description, department: task.department,
                      taskType: task.taskType, category: task.category || '',
                      assignedTo: task.assignedTo.map(emp => emp._id), workLocation: task.workLocation,
                      requireCheckIn: task.requireCheckIn, clientName: task.client?.name || '',
                      clientPhone: task.client?.phone || '', clientCompany: task.client?.company || '',
                      clientAddress: task.client?.address || '', scheduledDate: task.scheduledDate?.split('T')[0] || '',
                      dueDate: task.dueDate?.split('T')[0] || '', estimatedHours: task.estimatedHours || '',
                      priority: task.priority, tags: task.tags?.join(', ') || ''
                    });
                    setSelectedTask(task);
                    setShowModal(true);
                  }} disabled={loadingStates[`edit-${task._id}`]}>
                    {loadingStates[`edit-${task._id}`] ? <><span className="spinner-border spinner-border-sm me-1"></span>Loading...</> : 'Edit'}
                  </Button>
                  <Button className="action-button action-delete" onClick={() => handleDelete(task._id)} disabled={loadingStates[`delete-${task._id}`]}>
                    {loadingStates[`delete-${task._id}`] ? <><span className="spinner-border spinner-border-sm me-1"></span>Deleting...</> : 'Delete'}
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
    
    {/* Mobile Card View */}
    <div className="d-md-none mobile-card-view">
      {taskList.map(task => (
        <div key={task._id} className="task-card" style={{backgroundColor: getPriorityColor(task.priority)}}>
          <div className="task-card-header">
            <div style={{flex: 1}}>
              <div className="task-card-title">{task.title}</div>
              <small className="text-muted">{task.department} • {task.taskType.replace(/_/g, ' ')}</small>
            </div>
            <Badge style={{background: task.priority === 'HIGH' ? '#ef4444' : task.priority === 'MEDIUM' ? '#f59e0b' : '#3b82f6', border: 'none', borderRadius: '0.5rem', padding: '0.4rem 0.8rem', fontSize: '0.85rem'}}>
              {task.priority}
            </Badge>
          </div>
          
          <div className="task-card-meta">
            <div style={{fontSize: '0.85rem'}}>
              <i className="fas fa-user me-1 text-info"></i>
              {showAssignedBy ? (
                <span>{task.assignedBy?.firstName} {task.assignedBy?.lastName}</span>
              ) : (
                <span>{task.assignedTo?.map(e => `${e.firstName} ${e.lastName}`).join(', ')}</span>
              )}
            </div>
            <div style={{fontSize: '0.85rem'}}>
              <i className="fas fa-calendar me-1"></i>
              {new Date(task.scheduledDate).toLocaleDateString('en-GB')}
            </div>
            <div style={{fontSize: '0.85rem'}}>
              <i className="fas fa-map-marker-alt me-1"></i>
              {task.workLocation}
            </div>
          </div>
          
          <div className="mb-2">
            <div className="d-flex align-items-center justify-content-between mb-1">
              <small className="text-muted">Progress</small>
              <small><strong>{task.progressPercent || 0}%</strong></small>
            </div>
            <div className="progress" style={{height: '8px'}}>
              <div className={`progress-bar ${task.progressPercent >= 75 ? 'bg-success' : task.progressPercent >= 50 ? 'bg-info' : task.progressPercent >= 25 ? 'bg-warning' : 'bg-danger'}`} style={{width: `${task.progressPercent || 0}%`}}></div>
            </div>
          </div>
          
          <div className="d-flex justify-content-between align-items-center mb-2">
            <Dropdown size="sm">
              <Dropdown.Toggle variant={task.status === 'COMPLETED' ? 'success' : task.status === 'IN_PROGRESS' ? 'info' : 'secondary'} style={{fontSize: '0.75rem'}}>
                {task.status.replace('_', ' ')}
              </Dropdown.Toggle>
              <Dropdown.Menu>
                <Dropdown.Item onClick={() => handleQuickStatusUpdate(task._id, 'ASSIGNED')}>Assigned</Dropdown.Item>
                <Dropdown.Item onClick={() => handleQuickStatusUpdate(task._id, 'IN_PROGRESS')}>In Progress</Dropdown.Item>
                <Dropdown.Item onClick={() => handleQuickStatusUpdate(task._id, 'REVIEW')}>Review</Dropdown.Item>
                <Dropdown.Item onClick={() => handleQuickStatusUpdate(task._id, 'COMPLETED')}>Completed</Dropdown.Item>
                <Dropdown.Item onClick={() => handleQuickStatusUpdate(task._id, 'CANCELLED')}>Cancelled</Dropdown.Item>
              </Dropdown.Menu>
            </Dropdown>
            <small className="text-muted">{getTimeAgo(task.updatedAt)}</small>
          </div>
          
          <div className="task-card-actions">
            <Button size="sm" variant="outline-info" onClick={() => handleViewTask(task)} style={{flex: 1}}>
              <i className="fas fa-eye me-1"></i>View
            </Button>
            {((task.assignedBy?._id === user?.id && task.status === 'ASSIGNED') || user?.role === 'ADMIN') && (
              <>
                <Button size="sm" variant="outline-success" onClick={() => handleDuplicate(task._id)} style={{flex: 1}}>
                  <i className="fas fa-copy me-1"></i>Copy
                </Button>
                <Button size="sm" variant="outline-warning" onClick={() => {
                  fetchDepartments();
                  setTaskForm({
                    title: task.title, description: task.description, department: task.department,
                    taskType: task.taskType, category: task.category || '',
                    assignedTo: task.assignedTo.map(emp => emp._id), workLocation: task.workLocation,
                    requireCheckIn: task.requireCheckIn, clientName: task.client?.name || '',
                    clientPhone: task.client?.phone || '', clientCompany: task.client?.company || '',
                    clientAddress: task.client?.address || '', scheduledDate: task.scheduledDate?.split('T')[0] || '',
                    dueDate: task.dueDate?.split('T')[0] || '', estimatedHours: task.estimatedHours || '',
                    priority: task.priority, tags: task.tags?.join(', ') || ''
                  });
                  setSelectedTask(task);
                  setShowModal(true);
                }} style={{flex: 1}}>
                  <i className="fas fa-edit me-1"></i>Edit
                </Button>
                <Button size="sm" variant="outline-danger" onClick={() => handleDelete(task._id)} style={{flex: 1}}>
                  <i className="fas fa-trash me-1"></i>Delete
                </Button>
              </>
            )}
          </div>
        </div>
      ))}
    </div>
    </>
  );

  if (loading) return <div className="d-flex justify-content-center align-items-center" style={{height: '400px'}}><div className="spinner-border text-primary"></div></div>;

  const myTasks = filteredTasks.filter(t => t.assignedBy?._id === user?.id);
  const assignedToMe = filteredTasks.filter(t => t.assignedTo?.some(emp => emp._id === user?.id));
  const allTasksCount = filteredTasks.length;
  const myTasksCount = myTasks.length;
  const assignedToMeCount = assignedToMe.length;

  const taskStats = {
    total: tasks.length,
    completed: tasks.filter(t => t.status === 'COMPLETED').length,
    inProgress: tasks.filter(t => t.status === 'IN_PROGRESS').length,
    overdue: tasks.filter(t => new Date(t.dueDate) < new Date() && t.status !== 'COMPLETED').length
  };

  return (
    <div className="task-management-page">
      <div className="page-header-modern">
        <div className="header-content">
          <div className="header-left">
            <div className="header-icon">
              <i className="fas fa-tasks"></i>
            </div>
            <div>
              <h1 className="header-title">Task Management</h1>
              <p className="header-subtitle">Organize, assign, and track your team's work</p>
            </div>
          </div>
          <div className="header-actions">
            <Button className="btn-export" onClick={() => setShowDownloadModal(true)}>
              <i className="fas fa-download me-2"></i>Export
            </Button>
            {['ADMIN', 'HR', 'MANAGER'].includes(user?.role) && (
              <Button className="btn-export" onClick={() => {
                fetchWorkLogs();
                setShowWorkLogHistory(true);
              }} style={{background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', border: 'none'}}>
                <i className="fas fa-clipboard-list me-2"></i>Work Logs
              </Button>
            )}
            <Button className="btn-create" onClick={() => {
              fetchDepartments();
              setShowModal(true);
            }}>
              <i className="fas fa-plus me-2"></i>New Task
            </Button>
          </div>
        </div>
      </div>

      <div className="stats-grid">
        <div className="stat-card stat-total">
          <div className="stat-icon">
            <i className="fas fa-clipboard-list"></i>
          </div>
          <div className="stat-content">
            <div className="stat-value">{taskStats.total}</div>
            <div className="stat-label">Total Tasks</div>
          </div>
        </div>
        <div className="stat-card stat-completed">
          <div className="stat-icon">
            <i className="fas fa-check-circle"></i>
          </div>
          <div className="stat-content">
            <div className="stat-value">{taskStats.completed}</div>
            <div className="stat-label">Completed</div>
          </div>
        </div>
        <div className="stat-card stat-progress">
          <div className="stat-icon">
            <i className="fas fa-spinner"></i>
          </div>
          <div className="stat-content">
            <div className="stat-value">{taskStats.inProgress}</div>
            <div className="stat-label">In Progress</div>
          </div>
        </div>
        <div className="stat-card stat-overdue">
          <div className="stat-icon">
            <i className="fas fa-exclamation-circle"></i>
          </div>
          <div className="stat-content">
            <div className="stat-value">{taskStats.overdue}</div>
            <div className="stat-label">Overdue</div>
          </div>
        </div>
      </div>

      <div className="filters-card">
        <Row className="g-3">
          <Col md={3}>
            <div className="search-box">
              <i className="fas fa-search search-icon"></i>
              <Form.Control className="search-input" placeholder="Search tasks..." value={filters.search} onChange={(e) => setFilters({...filters, search: e.target.value})} />
            </div>
          </Col>
          <Col md={2}>
            <Form.Select className="filter-select" value={filters.status} onChange={(e) => setFilters({...filters, status: e.target.value})}>
              <option value="">All Status</option>
              <option value="ASSIGNED">Assigned</option>
              <option value="IN_PROGRESS">In Progress</option>
              <option value="REVIEW">Review</option>
              <option value="COMPLETED">Completed</option>
              <option value="CANCELLED">Cancelled</option>
            </Form.Select>
          </Col>
          <Col md={2}>
            <Form.Select className="filter-select" value={filters.priority} onChange={(e) => setFilters({...filters, priority: e.target.value})}>
              <option value="">All Priority</option>
              <option value="HIGH">High</option>
              <option value="MEDIUM">Medium</option>
              <option value="LOW">Low</option>
            </Form.Select>
          </Col>
          <Col md={2}>
            <Form.Select className="filter-select" value={filters.department} onChange={(e) => setFilters({...filters, department: e.target.value})}>
              <option value="">All Departments</option>
              <option value="Sales">Sales</option>
              <option value="IT">IT</option>
              <option value="Software">Software</option>
              <option value="HR">HR</option>
              <option value="General">General</option>
            </Form.Select>
          </Col>
          <Col md={3} className="text-end">
            <Button className="btn-reset" onClick={() => setFilters({ status: '', priority: '', department: '', search: '' })}>
              <i className="fas fa-redo me-2"></i>Reset Filters
            </Button>
          </Col>
        </Row>
      </div>

      <div className="tasks-container">
        <Card className="tasks-card">
          <Card.Body className="p-0">
            <Tabs defaultActiveKey="assigned" className="premium-tabs">
              <Tab eventKey="assigned" title={<span><i className="fas fa-inbox me-2"></i>Assigned to Me <span className="tab-count">{assignedToMeCount}</span></span>}>
                  {assignedToMe.length > 0 ? renderTaskTable(assignedToMe, true) : <div className="text-center py-4"><i className="fas fa-inbox text-muted fs-1 mb-3"></i><p className="text-muted mb-0">No tasks assigned to you</p></div>}
                </Tab>
                <Tab eventKey="created" title={<span><i className="fas fa-user-plus me-2"></i>Created by Me <span className="tab-count">{myTasksCount}</span></span>}>
                  {myTasks.length > 0 ? renderTaskTable(myTasks, false) : <div className="text-center py-4"><i className="fas fa-tasks text-muted fs-1 mb-3"></i><p className="text-muted mb-0">No tasks created by you</p></div>}
                </Tab>
                <Tab eventKey="all" title={<span><i className="fas fa-list me-2"></i>All Tasks <span className="tab-count">{allTasksCount}</span></span>}>
                  {filteredTasks.length > 0 ? renderTaskTable(filteredTasks, false) : <div className="text-center py-4"><i className="fas fa-tasks text-muted fs-1 mb-3"></i><p className="text-muted mb-0">No tasks found</p></div>}
                </Tab>

              </Tabs>
          </Card.Body>
        </Card>
      </div>

      {/* Create/Edit Task Modal */}
      <Modal show={showModal} onHide={() => {
        setShowModal(false);
        setSelectedTask(null);
        setCustomTaskType('');
        setTaskForm({
          title: '', description: '', department: '', taskType: '', category: '',
          assignedTo: [], workLocation: 'OFFICE', requireCheckIn: false,
          clientName: '', clientPhone: '', clientCompany: '', clientAddress: '',
          scheduledDate: '', dueDate: '', estimatedHours: '', priority: 'MEDIUM', tags: ''
        });
      }} size="lg" centered>
        <Modal.Header closeButton style={{background: '#f8f9fa', borderBottom: '2px solid #dee2e6'}}>
          <Modal.Title style={{fontSize: '1.25rem', fontWeight: '600', color: '#212529'}}>
            {selectedTask ? 'Edit Task' : 'Create New Task'}
          </Modal.Title>
        </Modal.Header>
        <Form onSubmit={handleSubmit}>
          <Modal.Body style={{ maxHeight: '70vh', overflowY: 'auto', padding: '1.5rem' }}>
            <Row>
              <Col md={12}>
                <Form.Group className="mb-3">
                  <Form.Label style={{fontWeight: '500', color: '#495057'}}>Task Title *</Form.Label>
                  <Form.Control 
                    type="text" 
                    value={taskForm.title} 
                    onChange={(e) => setTaskForm({...taskForm, title: e.target.value})} 
                    required 
                    placeholder="Enter task title"
                  />
                </Form.Group>
              </Col>
            </Row>
            <Row>
              <Col md={12}>
                <Form.Group className="mb-3">
                  <Form.Label style={{fontWeight: '500', color: '#495057'}}>Description</Form.Label>
                  <Form.Control 
                    as="textarea" 
                    rows={3} 
                    value={taskForm.description} 
                    onChange={(e) => setTaskForm({...taskForm, description: e.target.value})} 
                    placeholder="Enter task description"
                  />
                </Form.Group>
              </Col>
            </Row>
            <Row>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label style={{fontWeight: '500', color: '#495057'}}>Department *</Form.Label>
                  <Form.Select value={taskForm.department} onChange={(e) => {
                    const dept = e.target.value;
                    const taskTypes = TASK_TYPES[dept] || TASK_TYPES['General'];
                    setTaskForm({...taskForm, department: dept, taskType: taskTypes[0]});
                    setCustomTaskType('');
                    if (dept !== 'Other') setCustomDepartment('');
                  }} required>
                    <option value="">Select department...</option>
                    {departments.map(dept => (
                      <option key={dept._id || dept.code} value={dept.name}>{dept.name}</option>
                    ))}
                    <option value="Other">Other (Custom)</option>
                  </Form.Select>
                  {taskForm.department === 'Other' && (
                    <Form.Control 
                      type="text" 
                      className="mt-2" 
                      placeholder="Enter custom department" 
                      value={customDepartment}
                      onChange={(e) => setCustomDepartment(e.target.value)}
                      required
                    />
                  )}
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label style={{fontWeight: '500', color: '#495057'}}>Task Type *</Form.Label>
                  <Form.Select 
                    value={taskForm.taskType} 
                    onChange={(e) => {
                      setTaskForm({...taskForm, taskType: e.target.value});
                      if (e.target.value !== 'OTHER') setCustomTaskType('');
                    }}
                    required
                  >
                    <option value="">Select task type...</option>
                    {taskForm.department && (TASK_TYPES[taskForm.department] || TASK_TYPES['General']).map(type => (
                      <option key={type} value={type}>{type.replace(/_/g, ' ')}</option>
                    ))}
                  </Form.Select>
                  {taskForm.taskType === 'OTHER' && (
                    <Form.Control 
                      type="text" 
                      className="mt-2" 
                      placeholder="Enter custom task type" 
                      value={customTaskType}
                      onChange={(e) => setCustomTaskType(e.target.value)}
                      required
                    />
                  )}
                </Form.Group>
              </Col>
            </Row>
            <Row>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label style={{fontWeight: '500', color: '#495057'}}>Work Location *</Form.Label>
                  <Form.Select value={taskForm.workLocation} onChange={(e) => setTaskForm({...taskForm, workLocation: e.target.value})}>
                    <option value="OFFICE">Office</option>
                    <option value="REMOTE">Remote</option>
                    <option value="CLIENT_SITE">Client Site</option>
                    <option value="FIELD">Field</option>
                    <option value="HYBRID">Hybrid</option>
                  </Form.Select>
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label style={{fontWeight: '500', color: '#495057'}}>Priority *</Form.Label>
                  <Form.Select value={taskForm.priority} onChange={(e) => setTaskForm({...taskForm, priority: e.target.value})}>
                    <option value="LOW">Low</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HIGH">High</option>
                  </Form.Select>
                </Form.Group>
              </Col>
            </Row>
            <Row>
              <Col md={12}>
                <Form.Group className="mb-3">
                  <Form.Label style={{fontWeight: '500', color: '#495057'}}>Assign To *</Form.Label>
                  {taskForm.assignedTo.length > 0 && (
                    <div className="mb-2 p-2" style={{background: '#f8f9fa', borderRadius: '0.375rem', border: '1px solid #dee2e6'}}>
                      <div className="d-flex flex-wrap gap-1">
                        {taskForm.assignedTo.map(empId => {
                          const emp = employees.find(e => e._id === empId);
                          return emp ? (
                            <Badge key={empId} bg="primary" className="d-flex align-items-center gap-1" style={{fontSize: '0.85rem', padding: '0.4rem 0.6rem'}}>
                              {emp.firstName} {emp.lastName}
                              <span 
                                style={{cursor: 'pointer', fontSize: '1.1rem', fontWeight: 'bold'}} 
                                onClick={() => setTaskForm({...taskForm, assignedTo: taskForm.assignedTo.filter(id => id !== empId)})}
                              >
                                ×
                              </span>
                            </Badge>
                          ) : null;
                        })}
                      </div>
                    </div>
                  )}
                  <div style={{
                    border: '1px solid #ced4da',
                    borderRadius: '0.375rem',
                    padding: '0.75rem',
                    maxHeight: '200px',
                    overflowY: 'auto',
                    background: 'white'
                  }}>
                    {employees.filter(emp => ['ADMIN', 'HR', 'MANAGER'].includes(emp.role)).length > 0 && (
                      <>
                        <div style={{fontSize: '0.85rem', fontWeight: '600', color: '#6c757d', marginBottom: '0.5rem'}}>Managers & Admin</div>
                        {employees.filter(emp => ['ADMIN', 'HR', 'MANAGER'].includes(emp.role)).map(emp => (
                          <Form.Check
                            key={emp._id}
                            type="checkbox"
                            id={`emp-${emp._id}`}
                            label={`${emp.firstName} ${emp.lastName} (${emp.role})`}
                            checked={taskForm.assignedTo.includes(emp._id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setTaskForm({...taskForm, assignedTo: [...taskForm.assignedTo, emp._id]});
                              } else {
                                setTaskForm({...taskForm, assignedTo: taskForm.assignedTo.filter(id => id !== emp._id)});
                              }
                            }}
                            className="mb-2"
                          />
                        ))}
                        <hr style={{margin: '0.5rem 0'}} />
                      </>
                    )}
                    <div style={{fontSize: '0.85rem', fontWeight: '600', color: '#6c757d', marginBottom: '0.5rem'}}>Employees</div>
                    {employees.filter(emp => emp.role === 'EMPLOYEE').map(emp => (
                      <Form.Check
                        key={emp._id}
                        type="checkbox"
                        id={`emp-${emp._id}`}
                        label={`${emp.firstName} ${emp.lastName}`}
                        checked={taskForm.assignedTo.includes(emp._id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setTaskForm({...taskForm, assignedTo: [...taskForm.assignedTo, emp._id]});
                          } else {
                            setTaskForm({...taskForm, assignedTo: taskForm.assignedTo.filter(id => id !== emp._id)});
                          }
                        }}
                        className="mb-2"
                      />
                    ))}
                  </div>
                  {taskForm.assignedTo.length === 0 && (
                    <Form.Text className="text-danger">Please select at least one employee</Form.Text>
                  )}
                </Form.Group>
              </Col>
            </Row>
            <Row>
              <Col md={12}>
                <Form.Check 
                  type="checkbox" 
                  label="Require GPS Check-in/Check-out" 
                  checked={taskForm.requireCheckIn} 
                  onChange={(e) => setTaskForm({...taskForm, requireCheckIn: e.target.checked})} 
                  className="mb-3"
                  style={{fontWeight: '500'}}
                />
              </Col>
            </Row>
            {(taskForm.department === 'Sales' || taskForm.department === 'Operations' || taskForm.department === 'Marketing') && (
              <>
                <div style={{borderTop: '1px solid #dee2e6', margin: '1rem 0'}}></div>
                <h6 style={{fontWeight: '600', color: '#495057', marginBottom: '1rem'}}>Client Details (Optional)</h6>
                <Row>
                  <Col md={6}>
                    <Form.Group className="mb-3">
                      <Form.Label style={{fontWeight: '500', color: '#495057'}}>Client Name</Form.Label>
                      <Form.Control 
                        type="text" 
                        value={taskForm.clientName} 
                        onChange={(e) => setTaskForm({...taskForm, clientName: e.target.value})} 
                        placeholder="Enter client name"
                      />
                    </Form.Group>
                  </Col>
                  <Col md={6}>
                    <Form.Group className="mb-3">
                      <Form.Label style={{fontWeight: '500', color: '#495057'}}>Phone</Form.Label>
                      <Form.Control 
                        type="text" 
                        value={taskForm.clientPhone} 
                        onChange={(e) => setTaskForm({...taskForm, clientPhone: e.target.value})} 
                        placeholder="Enter phone number"
                      />
                    </Form.Group>
                  </Col>
                </Row>
                <Row>
                  <Col md={6}>
                    <Form.Group className="mb-3">
                      <Form.Label style={{fontWeight: '500', color: '#495057'}}>Company</Form.Label>
                      <Form.Control 
                        type="text" 
                        value={taskForm.clientCompany} 
                        onChange={(e) => setTaskForm({...taskForm, clientCompany: e.target.value})} 
                        placeholder="Enter company name"
                      />
                    </Form.Group>
                  </Col>
                  <Col md={6}>
                    <Form.Group className="mb-3">
                      <Form.Label style={{fontWeight: '500', color: '#495057'}}>Address</Form.Label>
                      <Form.Control 
                        type="text" 
                        value={taskForm.clientAddress} 
                        onChange={(e) => setTaskForm({...taskForm, clientAddress: e.target.value})} 
                        placeholder="Enter address"
                      />
                    </Form.Group>
                  </Col>
                </Row>
                <div style={{borderTop: '1px solid #dee2e6', margin: '1rem 0'}}></div>
              </>
            )}
            <Row>
              <Col md={4}>
                <Form.Group className="mb-3">
                  <Form.Label style={{fontWeight: '500', color: '#495057'}}>Scheduled Date *</Form.Label>
                  <Form.Control 
                    type="date" 
                    value={taskForm.scheduledDate} 
                    onChange={(e) => setTaskForm({...taskForm, scheduledDate: e.target.value})} 
                    required 
                  />
                </Form.Group>
              </Col>
              <Col md={4}>
                <Form.Group className="mb-3">
                  <Form.Label style={{fontWeight: '500', color: '#495057'}}>Due Date</Form.Label>
                  <Form.Control 
                    type="date" 
                    value={taskForm.dueDate} 
                    onChange={(e) => setTaskForm({...taskForm, dueDate: e.target.value})} 
                  />
                </Form.Group>
              </Col>
              <Col md={4}>
                <Form.Group className="mb-3">
                  <Form.Label style={{fontWeight: '500', color: '#495057'}}>Estimated Hours</Form.Label>
                  <Form.Control 
                    type="number" 
                    step="0.5" 
                    value={taskForm.estimatedHours} 
                    onChange={(e) => setTaskForm({...taskForm, estimatedHours: e.target.value})} 
                    placeholder="0"
                  />
                </Form.Group>
              </Col>
            </Row>
            <Row>
              <Col md={12}>
                <Form.Group className="mb-3">
                  <Form.Label style={{fontWeight: '500', color: '#495057'}}>Tags</Form.Label>
                  <Form.Control 
                    type="text" 
                    value={taskForm.tags} 
                    onChange={(e) => setTaskForm({...taskForm, tags: e.target.value})} 
                    placeholder="urgent, client-meeting"
                  />
                  <Form.Text className="text-muted">Separate tags with commas</Form.Text>
                </Form.Group>
              </Col>
            </Row>
          </Modal.Body>
          <Modal.Footer style={{background: '#f8f9fa', borderTop: '2px solid #dee2e6'}}>
            <Button variant="secondary" onClick={() => {
              setShowModal(false);
              setSelectedTask(null);
              setCustomTaskType('');
              setCustomDepartment('');
              setTaskForm({
                title: '', description: '', department: '', taskType: '', category: '',
                assignedTo: [], workLocation: 'OFFICE', requireCheckIn: false,
                clientName: '', clientPhone: '', clientCompany: '', clientAddress: '',
                scheduledDate: '', dueDate: '', estimatedHours: '', priority: 'MEDIUM', tags: ''
              });
            }}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" disabled={loadingStates.submit}>
              {loadingStates.submit ? (
                <><span className="spinner-border spinner-border-sm me-2"></span>{selectedTask ? 'Updating...' : 'Creating...'}</>
              ) : (
                selectedTask ? 'Update Task' : 'Create Task'
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
                  <div className="d-flex justify-content-between align-items-center mb-3">
                    <h6 className="mb-0" style={{fontWeight: '600', color: '#495057'}}>Progress Timeline</h6>
                  </div>
                  
                  <div style={{maxHeight: '500px', overflowY: 'auto'}}>
                    {selectedTask.dailyUpdates?.length > 0 ? (
                      <div>
                        {selectedTask.dailyUpdates.slice().reverse().map((update, idx) => (
                          <Card key={idx} className="mb-3" style={{border: '1px solid #e1e4e8', borderRadius: '6px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.06)'}}>
                            <Card.Body style={{padding: '1.5rem'}}>
                              <div className="d-flex justify-content-between align-items-start mb-3">
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
                              {update.workDone && (
                                <div style={{background: '#f6f8fa', padding: '1rem', borderRadius: '4px', marginBottom: '1rem', border: '1px solid #e1e4e8'}}>
                                  <div style={{fontSize: '0.75rem', fontWeight: '600', color: '#666', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.3px'}}>
                                    Work Completed
                                  </div>
                                  <p className="mb-0" style={{fontSize: '0.95rem', color: '#1a1a1a', whiteSpace: 'pre-wrap', lineHeight: '1.6'}}>{update.workDone}</p>
                                </div>
                              )}
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

      {/* Work Log History Modal */}
      <Modal show={showWorkLogHistory} onHide={() => setShowWorkLogHistory(false)} size="xl" centered>
        <Modal.Header closeButton style={{background: 'linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%)', color: 'white', borderBottom: 'none', padding: '1.5rem 2rem'}}>
          <Modal.Title style={{fontSize: '1.5rem', fontWeight: '700'}}>
            <i className="fas fa-chart-bar me-3"></i>Work Log Reports
          </Modal.Title>
        </Modal.Header>
        <Modal.Body style={{padding: '2rem', background: '#f8fafc', maxHeight: '80vh', overflowY: 'auto'}}>
            <Row className="g-3 mb-4">
              <Col md={3}>
                <div style={{background: 'white', borderLeft: '4px solid #1e40af', borderRadius: '8px', padding: '1.25rem', boxShadow: '0 1px 3px rgba(0,0,0,0.1)'}}>
                  <div style={{fontSize: '0.75rem', fontWeight: '600', color: '#64748b', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.5px'}}>Total Logs</div>
                  <div style={{fontSize: '2rem', fontWeight: '700', color: '#1e293b'}}>{workLogStats.totalLogs}</div>
                </div>
              </Col>
              <Col md={3}>
                <div style={{background: 'white', borderLeft: '4px solid #7c3aed', borderRadius: '8px', padding: '1.25rem', boxShadow: '0 1px 3px rgba(0,0,0,0.1)'}}>
                  <div style={{fontSize: '0.75rem', fontWeight: '600', color: '#64748b', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.5px'}}>Total Hours</div>
                  <div style={{fontSize: '2rem', fontWeight: '700', color: '#1e293b'}}>{workLogStats.totalHours}</div>
                </div>
              </Col>
              <Col md={3}>
                <div style={{background: 'white', borderLeft: '4px solid #059669', borderRadius: '8px', padding: '1.25rem', boxShadow: '0 1px 3px rgba(0,0,0,0.1)'}}>
                  <div style={{fontSize: '0.75rem', fontWeight: '600', color: '#64748b', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.5px'}}>Completed</div>
                  <div style={{fontSize: '2rem', fontWeight: '700', color: '#1e293b'}}>{workLogStats.completed}</div>
                </div>
              </Col>
              <Col md={3}>
                <div style={{background: 'white', borderLeft: '4px solid #ea580c', borderRadius: '8px', padding: '1.25rem', boxShadow: '0 1px 3px rgba(0,0,0,0.1)'}}>
                  <div style={{fontSize: '0.75rem', fontWeight: '600', color: '#64748b', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.5px'}}>In Progress</div>
                  <div style={{fontSize: '2rem', fontWeight: '700', color: '#1e293b'}}>{workLogStats.inProgress}</div>
                </div>
              </Col>
            </Row>

            {dateRangeDisplay && (
              <div className="alert alert-info mb-3" style={{borderRadius: '8px', background: '#eff6ff', border: '1px solid #bfdbfe', color: '#1e40af'}}>
                <i className="fas fa-calendar-alt me-2"></i>Showing: {dateRangeDisplay}
              </div>
            )}

            <Card style={{border: '1px solid #e2e8f0', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', marginBottom: '1.5rem', background: 'white'}}>
              <Card.Body style={{padding: '1.25rem'}}>
                <h6 style={{fontWeight: '600', marginBottom: '1rem', color: '#334155', fontSize: '0.875rem', textTransform: 'uppercase', letterSpacing: '0.5px'}}>Filter Options</h6>
                <Row className="g-3">
                  <Col md={2}>
                    <Form.Label style={{fontSize: '0.75rem', fontWeight: '600', color: '#64748b', marginBottom: '0.5rem'}}>Quick Filter</Form.Label>
                    <Form.Select value={workLogFilters.dateRange} onChange={(e) => setWorkLogFilters({...workLogFilters, dateRange: e.target.value, startDate: '', endDate: ''})} style={{borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.875rem'}}>
                      <option value="">Custom Range</option>
                      <option value="THIS_WEEK">This Week</option>
                      <option value="THIS_MONTH">This Month</option>
                    </Form.Select>
                  </Col>
                  <Col md={2}>
                    <Form.Label style={{fontSize: '0.75rem', fontWeight: '600', color: '#64748b', marginBottom: '0.5rem'}}>Start Date</Form.Label>
                    <Form.Control type="date" value={workLogFilters.startDate} onChange={(e) => setWorkLogFilters({...workLogFilters, startDate: e.target.value, dateRange: ''})} disabled={workLogFilters.dateRange !== ''} style={{borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.875rem'}} />
                  </Col>
                  <Col md={2}>
                    <Form.Label style={{fontSize: '0.75rem', fontWeight: '600', color: '#64748b', marginBottom: '0.5rem'}}>End Date</Form.Label>
                    <Form.Control type="date" value={workLogFilters.endDate} onChange={(e) => setWorkLogFilters({...workLogFilters, endDate: e.target.value, dateRange: ''})} disabled={workLogFilters.dateRange !== ''} style={{borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.875rem'}} />
                  </Col>
                  <Col md={2}>
                    <Form.Label style={{fontSize: '0.75rem', fontWeight: '600', color: '#64748b', marginBottom: '0.5rem'}}>Employee</Form.Label>
                    <Form.Select value={workLogFilters.userId} onChange={(e) => setWorkLogFilters({...workLogFilters, userId: e.target.value})} style={{borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.875rem'}}>
                      <option value="">All Employees</option>
                      {employees.map(emp => <option key={emp._id} value={emp._id}>{emp.firstName} {emp.lastName}</option>)}
                    </Form.Select>
                  </Col>
                  <Col md={2}>
                    <Form.Label style={{fontSize: '0.75rem', fontWeight: '600', color: '#64748b', marginBottom: '0.5rem'}}>Status</Form.Label>
                    <Form.Select value={workLogFilters.status} onChange={(e) => setWorkLogFilters({...workLogFilters, status: e.target.value})} style={{borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.875rem'}}>
                      <option value="">All Status</option>
                      <option value="COMPLETED">Completed</option>
                      <option value="IN_PROGRESS">In Progress</option>
                      <option value="PENDING">Pending</option>
                      <option value="ON_HOLD">On Hold</option>
                      <option value="BLOCKED">Blocked</option>
                    </Form.Select>
                  </Col>
                  <Col md={2}>
                    <Form.Label style={{fontSize: '0.75rem', fontWeight: '600', color: '#64748b', marginBottom: '0.5rem'}}>Search</Form.Label>
                    <Form.Control type="text" placeholder="Search..." value={workLogFilters.search} onChange={(e) => setWorkLogFilters({...workLogFilters, search: e.target.value})} style={{borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.875rem'}} />
                  </Col>
                  <Col md={2} className="d-flex align-items-end gap-2">
                    <Button variant="primary" onClick={() => { setWorkLogPage(1); fetchWorkLogs(); }} style={{flex: 1, borderRadius: '6px', fontWeight: '500', background: '#3b82f6', border: 'none', fontSize: '0.875rem'}}>
                      <i className="fas fa-search me-1"></i>Apply
                    </Button>
                    <Button variant="success" onClick={exportWorkLogs} style={{borderRadius: '6px', background: '#059669', border: 'none'}}>
                      <i className="fas fa-file-excel"></i>
                    </Button>
                  </Col>
                </Row>
              </Card.Body>
            </Card>

            <div style={{background: 'white', border: '1px solid #e2e8f0', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)'}}>
              <div style={{padding: '1rem 1.5rem', borderBottom: '1px solid #e2e8f0', background: '#f8fafc'}}>
                <h6 style={{margin: 0, fontWeight: '600', color: '#334155', fontSize: '0.875rem', textTransform: 'uppercase', letterSpacing: '0.5px'}}>Work Log Details</h6>
              </div>
              <div style={{maxHeight: '50vh', overflowY: 'auto'}}>
              {workLogs.filter(log => {
                if (workLogFilters.status && log.status !== workLogFilters.status) return false;
                if (workLogFilters.search) {
                  const search = workLogFilters.search.toLowerCase();
                  return log.workDone?.toLowerCase().includes(search) || log.project?.toLowerCase().includes(search) || `${log.userId?.firstName} ${log.userId?.lastName}`.toLowerCase().includes(search);
                }
                return true;
              }).length > 0 ? (
                <Table hover className="mb-0" style={{fontSize: '0.875rem'}}>
                  <thead style={{background: '#f8fafc', borderBottom: '2px solid #e2e8f0'}}>
                    <tr>
                      <th style={{padding: '0.875rem 1rem', fontWeight: '600', color: '#475569', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.5px'}}>Date</th>
                      <th style={{padding: '0.875rem 1rem', fontWeight: '600', color: '#475569', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.5px'}}>Employee</th>
                      <th style={{padding: '0.875rem 1rem', fontWeight: '600', color: '#475569', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.5px'}}>Project</th>
                      <th style={{padding: '0.875rem 1rem', fontWeight: '600', color: '#475569', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.5px', textAlign: 'center'}}>Hours</th>
                      <th style={{padding: '0.875rem 1rem', fontWeight: '600', color: '#475569', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.5px', textAlign: 'center'}}>Status</th>
                      {user?.role === 'ADMIN' && <th style={{padding: '0.875rem 1rem', fontWeight: '600', color: '#475569', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.5px', textAlign: 'center'}}>Actions</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {workLogs.filter(log => {
                      if (workLogFilters.status && log.status !== workLogFilters.status) return false;
                      if (workLogFilters.search) {
                        const search = workLogFilters.search.toLowerCase();
                        return log.workDone?.toLowerCase().includes(search) || log.project?.toLowerCase().includes(search) || `${log.userId?.firstName} ${log.userId?.lastName}`.toLowerCase().includes(search);
                      }
                      return true;
                    }).map((log) => {
                      const canEdit = user?.role === 'ADMIN' || (log.userId?._id === user?.id && (Date.now() - new Date(log.createdAt)) / (1000 * 60 * 60) <= 24);
                      return (
                      <tr key={log._id} style={{borderBottom: '1px solid #f1f5f9', cursor: 'pointer'}} onClick={() => handleViewWorkLog(log)}>
                        <td style={{padding: '1rem', verticalAlign: 'middle', color: '#334155'}}>
                          <div style={{fontWeight: '500'}}>{new Date(log.date).toLocaleDateString('en-GB')}</div>
                          <small style={{color: '#64748b', fontSize: '0.75rem'}}>{new Date(log.date).toLocaleDateString('en-GB', {weekday: 'short'})}</small>
                        </td>
                        <td style={{padding: '1rem', verticalAlign: 'middle'}}>
                          <div style={{fontWeight: '500', color: '#1e293b'}}>{log.userId?.firstName} {log.userId?.lastName}</div>
                          <small style={{color: '#64748b', fontSize: '0.75rem'}}>{log.userId?.department || 'N/A'}</small>
                        </td>
                        <td style={{padding: '1rem', verticalAlign: 'middle', color: '#334155', fontWeight: '500'}}>{log.project || '-'}</td>
                        <td style={{padding: '1rem', verticalAlign: 'middle', textAlign: 'center'}}>
                          <span style={{background: '#dcfce7', color: '#166534', padding: '0.25rem 0.75rem', borderRadius: '6px', fontSize: '0.8rem', fontWeight: '600'}}>{log.hoursSpent}h</span>
                        </td>
                        <td style={{padding: '1rem', verticalAlign: 'middle', textAlign: 'center'}}>
                          <span style={{
                            background: log.status === 'COMPLETED' ? '#dcfce7' : log.status === 'IN_PROGRESS' ? '#dbeafe' : log.status === 'BLOCKED' ? '#fee2e2' : '#fef3c7',
                            color: log.status === 'COMPLETED' ? '#166534' : log.status === 'IN_PROGRESS' ? '#1e40af' : log.status === 'BLOCKED' ? '#991b1b' : '#92400e',
                            padding: '0.25rem 0.75rem',
                            borderRadius: '6px',
                            fontSize: '0.75rem',
                            fontWeight: '600'
                          }}>
                            {log.status.replace('_', ' ')}
                          </span>
                        </td>
                        {user?.role === 'ADMIN' && (
                          <td style={{padding: '1rem', verticalAlign: 'middle', textAlign: 'center'}} onClick={(e) => e.stopPropagation()}>
                            <div className="d-flex gap-2 justify-content-center">
                              {canEdit && (
                                <>
                                  <Button size="sm" variant="outline-primary" onClick={() => handleEditWorkLog(log)} style={{borderRadius: '6px', border: '1px solid #3b82f6', color: '#3b82f6', padding: '0.25rem 0.5rem'}}>
                                    <i className="fas fa-edit"></i>
                                  </Button>
                                  <Button size="sm" variant="outline-danger" onClick={() => handleDeleteWorkLog(log._id)} style={{borderRadius: '6px', border: '1px solid #ef4444', color: '#ef4444', padding: '0.25rem 0.5rem'}}>
                                    <i className="fas fa-trash"></i>
                                  </Button>
                                </>
                              )}
                            </div>
                          </td>
                        )}
                      </tr>
                    )})}
                  </tbody>
                </Table>
              ) : (
                <div className="text-center py-5">
                  <i className="fas fa-inbox" style={{fontSize: '3rem', color: '#cbd5e1', marginBottom: '1rem'}}></i>
                  <h6 style={{color: '#64748b', fontWeight: '600'}}>No work logs found</h6>
                  <p style={{color: '#94a3b8', fontSize: '0.875rem', margin: 0}}>Try adjusting your filters</p>
                </div>
              )}
              </div>
              {workLogTotal > 50 && (
                <div className="d-flex justify-content-center align-items-center gap-2 p-3" style={{borderTop: '1px solid #e2e8f0'}}>
                  <Button size="sm" variant="outline-primary" disabled={workLogPage === 1} onClick={() => { setWorkLogPage(p => p - 1); fetchWorkLogs(); }}>
                    <i className="fas fa-chevron-left"></i>
                  </Button>
                  <span style={{fontSize: '0.875rem', color: '#64748b'}}>Page {workLogPage} of {Math.ceil(workLogTotal / 50)}</span>
                  <Button size="sm" variant="outline-primary" disabled={workLogPage >= Math.ceil(workLogTotal / 50)} onClick={() => { setWorkLogPage(p => p + 1); fetchWorkLogs(); }}>
                    <i className="fas fa-chevron-right"></i>
                  </Button>
                </div>
              )}
            </div>
        </Modal.Body>
      </Modal>

      {/* Work Log Details Modal */}
      <Modal show={showWorkLogDetails} onHide={() => setShowWorkLogDetails(false)} size="lg" centered>
        <Modal.Header closeButton style={{background: '#f8fafc', borderBottom: '2px solid #e2e8f0'}}>
          <Modal.Title style={{fontSize: '1.25rem', fontWeight: '600', color: '#1e293b'}}>
            <i className="fas fa-file-alt me-2" style={{color: '#3b82f6'}}></i>Work Log Details
          </Modal.Title>
        </Modal.Header>
        <Modal.Body style={{padding: '2rem', background: 'white'}}>
          {selectedWorkLog && (
            <>
              <Row className="mb-4">
                <Col md={6}>
                  <div style={{marginBottom: '1.5rem'}}>
                    <div style={{fontSize: '0.75rem', fontWeight: '600', color: '#64748b', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.5px'}}>Employee</div>
                    <div style={{fontSize: '1rem', fontWeight: '500', color: '#1e293b'}}>{selectedWorkLog.userId?.firstName} {selectedWorkLog.userId?.lastName}</div>
                    <div style={{fontSize: '0.875rem', color: '#64748b'}}>{selectedWorkLog.userId?.department || 'N/A'}</div>
                  </div>
                </Col>
                <Col md={6}>
                  <div style={{marginBottom: '1.5rem'}}>
                    <div style={{fontSize: '0.75rem', fontWeight: '600', color: '#64748b', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.5px'}}>Date</div>
                    <div style={{fontSize: '1rem', fontWeight: '500', color: '#1e293b'}}>{new Date(selectedWorkLog.date).toLocaleDateString('en-GB', {day: '2-digit', month: 'long', year: 'numeric'})}</div>
                    <div style={{fontSize: '0.875rem', color: '#64748b'}}>{new Date(selectedWorkLog.date).toLocaleDateString('en-GB', {weekday: 'long'})}</div>
                  </div>
                </Col>
              </Row>

              <Row className="mb-4">
                <Col md={4}>
                  <div style={{background: '#f8fafc', padding: '1rem', borderRadius: '8px', border: '1px solid #e2e8f0'}}>
                    <div style={{fontSize: '0.75rem', fontWeight: '600', color: '#64748b', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.5px'}}>Hours Spent</div>
                    <div style={{fontSize: '1.5rem', fontWeight: '700', color: '#059669'}}>{selectedWorkLog.hoursSpent}h</div>
                  </div>
                </Col>
                <Col md={4}>
                  <div style={{background: '#f8fafc', padding: '1rem', borderRadius: '8px', border: '1px solid #e2e8f0'}}>
                    <div style={{fontSize: '0.75rem', fontWeight: '600', color: '#64748b', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.5px'}}>Status</div>
                    <span style={{
                      background: selectedWorkLog.status === 'COMPLETED' ? '#dcfce7' : selectedWorkLog.status === 'IN_PROGRESS' ? '#dbeafe' : selectedWorkLog.status === 'BLOCKED' ? '#fee2e2' : '#fef3c7',
                      color: selectedWorkLog.status === 'COMPLETED' ? '#166534' : selectedWorkLog.status === 'IN_PROGRESS' ? '#1e40af' : selectedWorkLog.status === 'BLOCKED' ? '#991b1b' : '#92400e',
                      padding: '0.5rem 1rem',
                      borderRadius: '6px',
                      fontSize: '0.875rem',
                      fontWeight: '600',
                      display: 'inline-block',
                      marginTop: '0.5rem'
                    }}>
                      {selectedWorkLog.status.replace('_', ' ')}
                    </span>
                  </div>
                </Col>
                <Col md={4}>
                  <div style={{background: '#f8fafc', padding: '1rem', borderRadius: '8px', border: '1px solid #e2e8f0'}}>
                    <div style={{fontSize: '0.75rem', fontWeight: '600', color: '#64748b', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.5px'}}>Location</div>
                    <span style={{background: '#f1f5f9', color: '#475569', padding: '0.5rem 1rem', borderRadius: '6px', fontSize: '0.875rem', fontWeight: '500', display: 'inline-block', marginTop: '0.5rem'}}>
                      {selectedWorkLog.location.replace('_', ' ')}
                    </span>
                  </div>
                </Col>
              </Row>

              {selectedWorkLog.project && (
                <div style={{marginBottom: '1.5rem'}}>
                  <div style={{fontSize: '0.75rem', fontWeight: '600', color: '#64748b', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.5px'}}>Project / Client</div>
                  <div style={{fontSize: '1rem', fontWeight: '500', color: '#1e293b'}}>{selectedWorkLog.project}</div>
                </div>
              )}

              <div style={{marginBottom: '1.5rem'}}>
                <div style={{fontSize: '0.75rem', fontWeight: '600', color: '#64748b', marginBottom: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.5px'}}>Work Description</div>
                <div style={{background: '#f8fafc', padding: '1.25rem', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '0.95rem', color: '#334155', lineHeight: '1.6'}}>
                  {selectedWorkLog.workDone}
                </div>
              </div>

              {selectedWorkLog.deliverables && (
                <div style={{marginBottom: '1.5rem'}}>
                  <div style={{fontSize: '0.75rem', fontWeight: '600', color: '#64748b', marginBottom: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.5px'}}>Deliverables / Outcomes</div>
                  <div style={{background: '#eff6ff', padding: '1.25rem', borderRadius: '8px', border: '1px solid #bfdbfe', fontSize: '0.95rem', color: '#1e40af', lineHeight: '1.6'}}>
                    {selectedWorkLog.deliverables}
                  </div>
                </div>
              )}

              {selectedWorkLog.issues && (
                <div style={{marginBottom: '1.5rem'}}>
                  <div style={{fontSize: '0.75rem', fontWeight: '600', color: '#64748b', marginBottom: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.5px'}}>Issues / Blockers</div>
                  <div style={{background: '#fef3c7', padding: '1.25rem', borderRadius: '8px', border: '1px solid #fde68a', fontSize: '0.95rem', color: '#92400e', lineHeight: '1.6'}}>
                    {selectedWorkLog.issues}
                  </div>
                </div>
              )}

              <div style={{background: '#f8fafc', padding: '1rem', borderRadius: '8px', border: '1px solid #e2e8f0', marginTop: '2rem'}}>
                <Row>
                  <Col md={6}>
                    <div style={{fontSize: '0.75rem', color: '#64748b'}}>Category</div>
                    <div style={{fontSize: '0.875rem', fontWeight: '500', color: '#475569'}}>{selectedWorkLog.category}</div>
                  </Col>
                  <Col md={6}>
                    <div style={{fontSize: '0.75rem', color: '#64748b'}}>Reported At</div>
                    <div style={{fontSize: '0.875rem', fontWeight: '500', color: '#475569'}}>{new Date(selectedWorkLog.createdAt || selectedWorkLog.date).toLocaleString('en-GB')}</div>
                  </Col>
                </Row>
              </div>

              {selectedWorkLog.comments && selectedWorkLog.comments.length > 0 && (
                <div style={{marginTop: '2rem'}}>
                  <div style={{fontSize: '0.95rem', fontWeight: '600', color: '#1e293b', marginBottom: '1rem'}}>
                    <i className="fas fa-comments me-2" style={{color: '#3b82f6'}}></i>Manager Comments ({selectedWorkLog.comments.length})
                  </div>
                  {selectedWorkLog.comments.map((comment, idx) => (
                    <div key={idx} style={{background: '#f8fafc', padding: '1rem', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '0.75rem'}}>
                      <div style={{fontSize: '0.85rem', fontWeight: '600', color: '#1e293b', marginBottom: '0.25rem'}}>
                        {comment.userId?.firstName} {comment.userId?.lastName}
                      </div>
                      <div style={{fontSize: '0.875rem', color: '#475569', marginBottom: '0.25rem'}}>{comment.text}</div>
                      <small style={{fontSize: '0.75rem', color: '#94a3b8'}}>{new Date(comment.createdAt).toLocaleString('en-GB')}</small>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </Modal.Body>
        <Modal.Footer style={{background: '#f8fafc', borderTop: '2px solid #e2e8f0'}}>
          <Button variant="secondary" onClick={() => setShowWorkLogDetails(false)} style={{borderRadius: '6px'}}>
            Close
          </Button>
          {['ADMIN', 'HR', 'MANAGER'].includes(user?.role) && (
            <Button variant="info" onClick={() => setShowCommentModal(true)} style={{borderRadius: '6px', background: '#0ea5e9', border: 'none'}}>
              <i className="fas fa-comment me-2"></i>Add Comment
            </Button>
          )}
          {(user?.role === 'ADMIN' || (selectedWorkLog?.userId?._id === user?.id && (Date.now() - new Date(selectedWorkLog?.createdAt)) / (1000 * 60 * 60) <= 24)) && (
            <Button variant="primary" onClick={() => {
              setShowWorkLogDetails(false);
              handleEditWorkLog(selectedWorkLog);
            }} style={{borderRadius: '6px', background: '#1e40af', border: 'none'}}>
              <i className="fas fa-edit me-2"></i>Edit
            </Button>
          )}
        </Modal.Footer>
      </Modal>

      {/* Edit Work Log Modal */}
      <Modal show={showWorkLogModal} onHide={() => {
        setShowWorkLogModal(false);
        setSelectedWorkLog(null);
        setWorkLogForm({
          date: '', workDone: '', hoursSpent: '', status: 'COMPLETED',
          project: '', deliverables: '', location: 'OFFICE', issues: '', category: 'GENERAL'
        });
      }} size="lg" centered>
        <Modal.Header closeButton style={{background: '#f8f9fa', borderBottom: '2px solid #dee2e6'}}>
          <Modal.Title style={{fontSize: '1.25rem', fontWeight: '600'}}>Edit Work Log</Modal.Title>
        </Modal.Header>
        <Form onSubmit={handleWorkLogSubmit}>
          <Modal.Body style={{padding: '1.5rem'}}>
            <Row>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label style={{fontWeight: '500'}}>Date</Form.Label>
                  <Form.Control 
                    type="date" 
                    value={workLogForm.date} 
                    onChange={(e) => setWorkLogForm({...workLogForm, date: e.target.value})} 
                    required 
                  />
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label style={{fontWeight: '500'}}>Hours Spent</Form.Label>
                  <Form.Control 
                    type="number" 
                    step="0.5" 
                    value={workLogForm.hoursSpent} 
                    onChange={(e) => setWorkLogForm({...workLogForm, hoursSpent: e.target.value})} 
                    required 
                  />
                </Form.Group>
              </Col>
            </Row>
            <Row>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label style={{fontWeight: '500'}}>Status</Form.Label>
                  <Form.Select 
                    value={workLogForm.status} 
                    onChange={(e) => setWorkLogForm({...workLogForm, status: e.target.value})}
                  >
                    <option value="COMPLETED">Completed</option>
                    <option value="IN_PROGRESS">In Progress</option>
                    <option value="PENDING">Pending</option>
                    <option value="ON_HOLD">On Hold</option>
                    <option value="BLOCKED">Blocked</option>
                  </Form.Select>
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label style={{fontWeight: '500'}}>Location</Form.Label>
                  <Form.Select 
                    value={workLogForm.location} 
                    onChange={(e) => setWorkLogForm({...workLogForm, location: e.target.value})}
                  >
                    <option value="OFFICE">Office</option>
                    <option value="REMOTE">Remote</option>
                    <option value="CLIENT_SITE">Client Site</option>
                    <option value="FIELD">Field</option>
                  </Form.Select>
                </Form.Group>
              </Col>
            </Row>
            <Form.Group className="mb-3">
              <Form.Label style={{fontWeight: '500'}}>Project/Client Name</Form.Label>
              <Form.Control 
                type="text" 
                value={workLogForm.project} 
                onChange={(e) => setWorkLogForm({...workLogForm, project: e.target.value})} 
                placeholder="Enter project or client name"
              />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label style={{fontWeight: '500'}}>Work Done</Form.Label>
              <Form.Control 
                as="textarea" 
                rows={3} 
                value={workLogForm.workDone} 
                onChange={(e) => setWorkLogForm({...workLogForm, workDone: e.target.value})} 
                required 
                placeholder="Describe the work completed"
              />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label style={{fontWeight: '500'}}>Deliverables/Outcomes</Form.Label>
              <Form.Control 
                as="textarea" 
                rows={2} 
                value={workLogForm.deliverables} 
                onChange={(e) => setWorkLogForm({...workLogForm, deliverables: e.target.value})} 
                placeholder="What was delivered or achieved?"
              />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label style={{fontWeight: '500'}}>Blockers/Issues</Form.Label>
              <Form.Control 
                as="textarea" 
                rows={2} 
                value={workLogForm.issues} 
                onChange={(e) => setWorkLogForm({...workLogForm, issues: e.target.value})} 
                placeholder="Any challenges or blockers faced?"
              />
            </Form.Group>
          </Modal.Body>
          <Modal.Footer style={{background: '#f8f9fa', borderTop: '2px solid #dee2e6'}}>
            <Button variant="secondary" onClick={() => {
              setShowWorkLogModal(false);
              setSelectedWorkLog(null);
              setWorkLogForm({
                date: '', workDone: '', hoursSpent: '', status: 'COMPLETED',
                project: '', deliverables: '', location: 'OFFICE', issues: '', category: 'GENERAL'
              });
            }}>
              Cancel
            </Button>
            <Button variant="primary" type="submit">
              Update Work Log
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>

      {/* Add Comment Modal */}
      <Modal show={showCommentModal} onHide={() => setShowCommentModal(false)} centered>
        <Modal.Header closeButton style={{background: '#f8fafc', borderBottom: '2px solid #e2e8f0'}}>
          <Modal.Title style={{fontSize: '1.1rem', fontWeight: '600'}}>
            <i className="fas fa-comment me-2" style={{color: '#3b82f6'}}></i>Add Manager Comment
          </Modal.Title>
        </Modal.Header>
        <Modal.Body style={{padding: '1.5rem'}}>
          <Form.Group>
            <Form.Label style={{fontWeight: '500', color: '#374151'}}>Comment</Form.Label>
            <Form.Control 
              as="textarea" 
              rows={4} 
              value={workLogComment} 
              onChange={(e) => setWorkLogComment(e.target.value)} 
              placeholder="Add feedback or comments for the employee..."
              style={{borderRadius: '8px', border: '2px solid #e5e7eb'}}
            />
          </Form.Group>
        </Modal.Body>
        <Modal.Footer style={{background: '#f8fafc', borderTop: '2px solid #e2e8f0'}}>
          <Button variant="secondary" onClick={() => setShowCommentModal(false)} style={{borderRadius: '6px'}}>
            Cancel
          </Button>
          <Button variant="primary" onClick={() => { handleAddWorkLogComment(); setShowCommentModal(false); }} disabled={!workLogComment.trim()} style={{borderRadius: '6px', background: '#3b82f6', border: 'none'}}>
            <i className="fas fa-paper-plane me-2"></i>Add Comment
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Download Modal */}
      <Modal show={showDownloadModal} onHide={() => setShowDownloadModal(false)} centered>
        <Modal.Header closeButton className="border-0 pb-0">
          <Modal.Title className="d-flex align-items-center">
            <div className="rounded-circle d-flex align-items-center justify-content-center me-3" style={{ width: '48px', height: '48px', background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)' }}>
              <i className="fas fa-file-excel text-white"></i>
            </div>
            <div>
              <h5 className="mb-0">Export Tasks to Excel</h5>
              <small className="text-muted">Download filtered tasks report</small>
            </div>
          </Modal.Title>
        </Modal.Header>
        <Modal.Body className="px-4 py-4">
          <div className="p-3 rounded-3" style={{ background: 'linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%)', border: '1px solid #6ee7b7' }}>
            <div className="d-flex align-items-start">
              <div className="rounded-circle d-flex align-items-center justify-content-center me-3 flex-shrink-0" style={{ width: '40px', height: '40px', background: '#10b981' }}>
                <i className="fas fa-filter text-white"></i>
              </div>
              <div className="flex-grow-1">
                <h6 className="mb-2" style={{ color: '#065f46' }}>Active Filters</h6>
                <div className="small" style={{ color: '#047857' }}>
                  {filters.status && (
                    <div className="mb-1">
                      <i className="fas fa-check-circle me-2" style={{ color: '#10b981' }}></i>
                      <strong>Status:</strong> {filters.status}
                    </div>
                  )}
                  {filters.priority && (
                    <div className="mb-1">
                      <i className="fas fa-flag me-2" style={{ color: '#10b981' }}></i>
                      <strong>Priority:</strong> {filters.priority}
                    </div>
                  )}
                  {filters.department && (
                    <div className="mb-1">
                      <i className="fas fa-building me-2" style={{ color: '#10b981' }}></i>
                      <strong>Department:</strong> {filters.department}
                    </div>
                  )}
                  {filters.search && (
                    <div className="mb-1">
                      <i className="fas fa-search me-2" style={{ color: '#10b981' }}></i>
                      <strong>Search:</strong> {filters.search}
                    </div>
                  )}
                  {!filters.status && !filters.priority && !filters.department && !filters.search && (
                    <div>
                      <i className="fas fa-info-circle me-2" style={{ color: '#10b981' }}></i>
                      No filters applied - All tasks will be exported
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
          <div className="mt-3 p-3 rounded-3" style={{ background: '#f0fdf4', border: '1px solid #bbf7d0' }}>
            <div className="d-flex align-items-center">
              <i className="fas fa-file-excel me-2" style={{ color: '#10b981', fontSize: '1.5rem' }}></i>
              <div>
                <strong style={{ color: '#065f46' }}>Total Tasks: {filteredTasks.length}</strong>
                <div className="small text-muted">Ready to export</div>
              </div>
            </div>
          </div>
        </Modal.Body>
        <Modal.Footer className="border-0 pt-0 px-4 pb-4">
          <Button variant="light" onClick={() => setShowDownloadModal(false)} className="px-4 py-2" style={{ borderRadius: '10px', fontWeight: '500', border: '2px solid #e5e7eb' }}>
            Cancel
          </Button>
          <Button variant="success" onClick={() => { exportToExcel(filteredTasks); setShowDownloadModal(false); }} className="px-4 py-2" style={{ borderRadius: '10px', fontWeight: '500', background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', border: 'none', boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)' }}>
            <i className="fas fa-download me-2"></i>
            Download Excel
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default TaskManagement;
