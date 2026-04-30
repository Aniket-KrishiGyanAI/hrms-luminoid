import React, { useEffect, useState } from 'react';
import { Row, Col, Card, Badge, Spinner, Alert, Form, InputGroup, Button, Table, Modal } from 'react-bootstrap';
import api from '../utils/api';
import { toast } from 'react-toastify';
import Swal from 'sweetalert2';

const TeamCalendar = () => {
  const [teamMembers, setTeamMembers] = useState([]);
  const [leaves, setLeaves] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedDay, setSelectedDay] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [showEmployeeModal, setShowEmployeeModal] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [employeeDetails, setEmployeeDetails] = useState(null);
  const [loadingEmployee, setLoadingEmployee] = useState(false);
  const [viewMode, setViewMode] = useState('month'); // 'month', 'week', 'day'
  const [leaveTypes, setLeaveTypes] = useState([]);
  const [publicHolidays, setPublicHolidays] = useState([]);
  const [showHolidayModal, setShowHolidayModal] = useState(false);
  const [showHolidayListModal, setShowHolidayListModal] = useState(false);
  const [editingHoliday, setEditingHoliday] = useState(null);
  const [holidayForm, setHolidayForm] = useState({
    name: '',
    date: '',
    type: 'FESTIVAL',
    description: ''
  });

  useEffect(() => {
    fetchTeamCalendar();
    fetchLeaveTypes();
    fetchPublicHolidays();
  }, []);

  const fetchLeaveTypes = async () => {
    try {
      const response = await api.get('/api/leave-types?active=true');
      setLeaveTypes(response.data);
    } catch (err) {
      console.error('Error fetching leave types:', err);
    }
  };

  const fetchPublicHolidays = async () => {
    try {
      const response = await api.get('/api/holidays');
      setPublicHolidays(response.data);
    } catch (err) {
      console.error('Error fetching public holidays:', err);
      // Set some default holidays if API fails
      setPublicHolidays([]);
    }
  };

  const fetchTeamCalendar = async () => {
    try {
      setLoading(true);
      const response = await api.get('/api/leave-requests/team-calendar');
      setTeamMembers(response.data.teamMembers || []);
      setLeaves(response.data.leaves || []);
      setError('');
    } catch (err) {
      console.error('Error fetching team calendar:', err);
      setError('Failed to load team calendar');
      toast.error('Failed to load team calendar');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric'
    });
  };

  const filteredLeaves = leaves.filter(leave => 
    searchTerm === '' || 
    `${leave.userId.firstName} ${leave.userId.lastName}`.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getCalendarDays = () => {
    const firstDay = new Date(selectedYear, selectedMonth, 1);
    const lastDay = new Date(selectedYear, selectedMonth + 1, 0);
    const days = [];
    
    for (let i = 0; i < firstDay.getDay(); i++) {
      days.push(null);
    }
    
    for (let i = 1; i <= lastDay.getDate(); i++) {
      days.push(i);
    }
    
    return days;
  };

  const getLeavesForDay = (day) => {
    if (!day) return [];
    const date = new Date(selectedYear, selectedMonth, day);
    date.setHours(0, 0, 0, 0);
    
    return filteredLeaves.filter(leave => {
      const start = new Date(leave.startDate);
      const end = new Date(leave.endDate);
      start.setHours(0, 0, 0, 0);
      end.setHours(0, 0, 0, 0);
      return date >= start && date <= end;
    });
  };

  const handleDayClick = (day) => {
    if (!day) return;
    const dayLeaves = getLeavesForDay(day);
    if (dayLeaves.length > 0) {
      setSelectedDay({ day, leaves: dayLeaves });
      setShowModal(true);
    }
  };

  const handleEmployeeClick = async (employee) => {
    try {
      setLoadingEmployee(true);
      setSelectedEmployee(employee);
      setShowEmployeeModal(true);
      const response = await api.get(`/api/leave-requests/employee/${employee._id}`);
      setEmployeeDetails(response.data);
    } catch (err) {
      console.error('Error fetching employee details:', err);
      toast.error(err.response?.data?.message || 'Failed to load employee details');
      setEmployeeDetails(null);
    } finally {
      setLoadingEmployee(false);
    }
  };

  const getStatusBadge = (leave) => {
    const { status, managerApproval, hrApproval, rejectedBy } = leave;
    const statusConfig = {
      PENDING: { bg: '#fbbf24', text: 'Pending' },
      MANAGER_APPROVED: { bg: '#3b82f6', text: 'Manager Approved' },
      HR_APPROVED: { bg: '#10b981', text: 'Approved' },
      REJECTED: { bg: '#ef4444', text: 'Rejected' },
      CANCELLED: { bg: '#6b7280', text: 'Cancelled' }
    };

    let displayText = statusConfig[status]?.text || 'Pending';
    let bgColor = statusConfig[status]?.bg || '#fbbf24';

    // Show approver name if available
    if (status === 'MANAGER_APPROVED' && managerApproval?.approvedBy) {
      const approverName = `${managerApproval.approvedBy.firstName} ${managerApproval.approvedBy.lastName}`;
      displayText = `Approved by ${approverName}`;
    } else if (status === 'HR_APPROVED' && hrApproval?.approvedBy) {
      const approverName = `${hrApproval.approvedBy.firstName} ${hrApproval.approvedBy.lastName}`;
      displayText = `Approved by ${approverName}`;
    } else if (status === 'REJECTED' && rejectedBy) {
      const rejectorName = `${rejectedBy.firstName} ${rejectedBy.lastName}`;
      displayText = `Rejected by ${rejectorName}`;
    }

    return (
      <Badge style={{ background: bgColor, padding: '0.4rem 0.8rem', borderRadius: '6px' }} title={displayText}>
        {displayText}
      </Badge>
    );
  };

  const isWeekend = (day) => {
    if (!day) return false;
    const date = new Date(selectedYear, selectedMonth, day);
    const dayOfWeek = date.getDay();
    return dayOfWeek === 0 || dayOfWeek === 6;
  };

  const isPublicHoliday = (day) => {
    if (!day) return false;
    const date = new Date(selectedYear, selectedMonth, day);
    return publicHolidays.some(holiday => {
      const holidayDate = new Date(holiday.date);
      return holidayDate.getDate() === day && 
             holidayDate.getMonth() === selectedMonth && 
             holidayDate.getFullYear() === selectedYear;
    });
  };

  const getPublicHolidayName = (day) => {
    if (!day) return null;
    const date = new Date(selectedYear, selectedMonth, day);
    const holiday = publicHolidays.find(h => {
      const holidayDate = new Date(h.date);
      return holidayDate.getDate() === day && 
             holidayDate.getMonth() === selectedMonth && 
             holidayDate.getFullYear() === selectedYear;
    });
    return holiday?.name;
  };

  const goToToday = () => {
    const today = new Date();
    setSelectedMonth(today.getMonth());
    setSelectedYear(today.getFullYear());
  };

  const navigateMonth = (direction) => {
    if (direction === 'prev') {
      if (selectedMonth === 0) {
        setSelectedMonth(11);
        setSelectedYear(selectedYear - 1);
      } else {
        setSelectedMonth(selectedMonth - 1);
      }
    } else {
      if (selectedMonth === 11) {
        setSelectedMonth(0);
        setSelectedYear(selectedYear + 1);
      } else {
        setSelectedMonth(selectedMonth + 1);
      }
    }
  };

  const getYearOptions = () => {
    const currentYear = new Date().getFullYear();
    const years = [];
    for (let i = currentYear - 5; i <= currentYear + 5; i++) {
      years.push(i);
    }
    return years;
  };

  const handleAddHoliday = async (e) => {
    e.preventDefault();
    try {
      if (editingHoliday) {
        await api.put(`/api/holidays/${editingHoliday._id}`, holidayForm);
        toast.success('Holiday updated successfully');
      } else {
        await api.post('/api/holidays', holidayForm);
        toast.success('Holiday added successfully');
      }
      setShowHolidayModal(false);
      setHolidayForm({ name: '', date: '', type: 'FESTIVAL', description: '' });
      setEditingHoliday(null);
      fetchPublicHolidays();
    } catch (error) {
      toast.error(editingHoliday ? 'Error updating holiday' : 'Error adding holiday');
    }
  };

  const handleEditHoliday = (holiday) => {
    setEditingHoliday(holiday);
    setHolidayForm({
      name: holiday.name,
      date: new Date(holiday.date).toISOString().split('T')[0],
      type: holiday.type,
      description: holiday.description || ''
    });
    setShowHolidayModal(true);
  };

  const handleDeleteHoliday = async (holidayId) => {
    const result = await Swal.fire({
      title: 'Delete Holiday?',
      text: 'This action cannot be undone!',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#dc3545',
      cancelButtonColor: '#6c757d',
      confirmButtonText: 'Yes, delete it!'
    });

    if (result.isConfirmed) {
      try {
        await api.delete(`/api/holidays/${holidayId}`);
        toast.success('Holiday deleted successfully');
        fetchPublicHolidays();
      } catch (error) {
        toast.error('Error deleting holiday');
      }
    }
  };

  const handleCloseHolidayModal = () => {
    setShowHolidayModal(false);
    setEditingHoliday(null);
    setHolidayForm({ name: '', date: '', type: 'FESTIVAL', description: '' });
  };

  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  if (loading) {
    return (
      <div className="d-flex justify-content-center align-items-center" style={{ height: '400px' }}>
        <div className="text-center">
          <Spinner animation="border" style={{ color: '#6366f1' }} className="mb-3" />
          <p className="text-muted">Loading team calendar...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="fade-in-up">
        <Alert variant="danger">{error}</Alert>
      </div>
    );
  }

  return (
    <div className="fade-in-up" style={{ background: '#f8fafc', minHeight: '100vh', padding: '2rem' }}>
      {/* Header */}
      <div className="mb-4">
        <h1 className="mb-2" style={{ color: '#1e293b', fontSize: '2rem', fontWeight: '700' }}>
          <i className="fas fa-calendar-alt me-3" style={{ color: '#6366f1' }}></i>
          Team Calendar
        </h1>
        <p style={{ color: '#64748b', fontSize: '1rem' }}>Track your team's leave schedule at a glance</p>
      </div>

      {/* Stats Cards */}
      <Row className="g-4 mb-4">
        <Col md={3}>
          <div style={{ 
            background: 'white', 
            borderRadius: '16px', 
            padding: '1.5rem',
            border: '1px solid #e2e8f0',
            transition: 'all 0.3s',
            cursor: 'pointer'
          }}
          onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-4px)'}
          onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
          >
            <div className="d-flex align-items-center justify-content-between">
              <div>
                <p style={{ color: '#64748b', fontSize: '0.875rem', marginBottom: '0.5rem', fontWeight: '500' }}>Team Members</p>
                <h3 style={{ color: '#1e293b', fontSize: '2rem', fontWeight: '700', margin: 0 }}>{teamMembers.length}</h3>
              </div>
              <div style={{ 
                width: '56px', 
                height: '56px', 
                borderRadius: '12px', 
                background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
                fontSize: '1.5rem'
              }}>
                <i className="fas fa-users"></i>
              </div>
            </div>
          </div>
        </Col>
        <Col md={3}>
          <div style={{ 
            background: 'white', 
            borderRadius: '16px', 
            padding: '1.5rem',
            border: '1px solid #e2e8f0',
            transition: 'all 0.3s',
            cursor: 'pointer'
          }}
          onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-4px)'}
          onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
          >
            <div className="d-flex align-items-center justify-content-between">
              <div>
                <p style={{ color: '#64748b', fontSize: '0.875rem', marginBottom: '0.5rem', fontWeight: '500' }}>Total Leaves</p>
                <h3 style={{ color: '#1e293b', fontSize: '2rem', fontWeight: '700', margin: 0 }}>{leaves.length}</h3>
              </div>
              <div style={{ 
                width: '56px', 
                height: '56px', 
                borderRadius: '12px', 
                background: 'linear-gradient(135deg, #ec4899 0%, #f43f5e 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
                fontSize: '1.5rem'
              }}>
                <i className="fas fa-calendar-check"></i>
              </div>
            </div>
          </div>
        </Col>
        <Col md={3}>
          <div style={{ 
            background: 'white', 
            borderRadius: '16px', 
            padding: '1.5rem',
            border: '1px solid #e2e8f0',
            transition: 'all 0.3s',
            cursor: 'pointer'
          }}
          onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-4px)'}
          onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
          >
            <div className="d-flex align-items-center justify-content-between">
              <div>
                <p style={{ color: '#64748b', fontSize: '0.875rem', marginBottom: '0.5rem', fontWeight: '500' }}>This Week</p>
                <h3 style={{ color: '#1e293b', fontSize: '2rem', fontWeight: '700', margin: 0 }}>
                  {leaves.filter(l => new Date(l.startDate) <= new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)).length}
                </h3>
              </div>
              <div style={{ 
                width: '56px', 
                height: '56px', 
                borderRadius: '12px', 
                background: 'linear-gradient(135deg, #14b8a6 0%, #06b6d4 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
                fontSize: '1.5rem'
              }}>
                <i className="fas fa-clock"></i>
              </div>
            </div>
          </div>
        </Col>
        <Col md={3}>
          <div style={{ 
            background: 'white', 
            borderRadius: '16px', 
            padding: '1.5rem',
            border: '1px solid #e2e8f0',
            transition: 'all 0.3s',
            cursor: 'pointer'
          }}
          onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-4px)'}
          onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
          >
            <div className="d-flex align-items-center justify-content-between">
              <div>
                <p style={{ color: '#64748b', fontSize: '0.875rem', marginBottom: '0.5rem', fontWeight: '500' }}>On Leave Today</p>
                <h3 style={{ color: '#1e293b', fontSize: '2rem', fontWeight: '700', margin: 0 }}>
                  {leaves.filter(l => {
                    const today = new Date();
                    const start = new Date(l.startDate);
                    const end = new Date(l.endDate);
                    return start <= today && end >= today;
                  }).length}
                </h3>
              </div>
              <div style={{ 
                width: '56px', 
                height: '56px', 
                borderRadius: '12px', 
                background: 'linear-gradient(135deg, #f59e0b 0%, #f97316 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
                fontSize: '1.5rem'
              }}>
                <i className="fas fa-calendar-day"></i>
              </div>
            </div>
          </div>
        </Col>
      </Row>

      {/* Calendar Controls */}
      <div style={{ background: 'white', borderRadius: '16px', padding: '1.5rem', border: '1px solid #e2e8f0', marginBottom: '1.5rem' }}>
        <Row className="align-items-center mb-3">
          <Col md={6}>
            <div className="d-flex align-items-center gap-3">
              <Button 
                variant="link" 
                onClick={() => navigateMonth('prev')}
                style={{ color: '#6366f1', textDecoration: 'none', fontSize: '1.25rem' }}
              >
                <i className="fas fa-chevron-left"></i>
              </Button>
              <h4 style={{ color: '#1e293b', fontWeight: '700', margin: 0, fontSize: '1.5rem' }}>
                {months[selectedMonth]} {selectedYear}
              </h4>
              <Button 
                variant="link" 
                onClick={() => navigateMonth('next')}
                style={{ color: '#6366f1', textDecoration: 'none', fontSize: '1.25rem' }}
              >
                <i className="fas fa-chevron-right"></i>
              </Button>
              <Form.Select
                value={selectedYear}
                onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                style={{ width: 'auto', border: '1px solid #e2e8f0', borderRadius: '8px' }}
              >
                {getYearOptions().map(year => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </Form.Select>
              <Button
                variant="outline-primary"
                size="sm"
                onClick={goToToday}
                style={{ borderRadius: '8px', fontWeight: '600' }}
              >
                <i className="fas fa-calendar-day me-2"></i>
                Today
              </Button>
            </div>
          </Col>
          <Col md={6}>
            <div className="d-flex justify-content-end gap-2">
              <InputGroup style={{ maxWidth: '400px' }}>
                <InputGroup.Text style={{ background: 'white', border: '1px solid #e2e8f0' }}>
                  <i className="fas fa-search" style={{ color: '#94a3b8' }}></i>
                </InputGroup.Text>
                <Form.Control
                  placeholder="Search team members..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  style={{ border: '1px solid #e2e8f0', borderLeft: 'none' }}
                />
              </InputGroup>
              <Button
                variant="primary"
                onClick={() => setShowHolidayModal(true)}
                style={{ borderRadius: '8px', fontWeight: '600', whiteSpace: 'nowrap' }}
              >
                <i className="fas fa-calendar-plus me-2"></i>
                Add Holiday
              </Button>
              <Button
                variant="outline-primary"
                onClick={() => setShowHolidayListModal(true)}
                style={{ borderRadius: '8px', fontWeight: '600', whiteSpace: 'nowrap' }}
              >
                <i className="fas fa-list me-2"></i>
                Manage Holidays
              </Button>
            </div>
          </Col>
        </Row>

        {/* View Mode Toggle */}
        <Row className="align-items-center">
          <Col md={6}>
            <div className="d-flex gap-2">
              <Button
                variant={viewMode === 'month' ? 'primary' : 'outline-secondary'}
                size="sm"
                onClick={() => setViewMode('month')}
                style={{ borderRadius: '8px', fontWeight: '600' }}
              >
                <i className="fas fa-calendar me-2"></i>
                Month
              </Button>
              <Button
                variant={viewMode === 'week' ? 'primary' : 'outline-secondary'}
                size="sm"
                onClick={() => setViewMode('week')}
                style={{ borderRadius: '8px', fontWeight: '600' }}
              >
                <i className="fas fa-calendar-week me-2"></i>
                Week
              </Button>
              <Button
                variant={viewMode === 'day' ? 'primary' : 'outline-secondary'}
                size="sm"
                onClick={() => setViewMode('day')}
                style={{ borderRadius: '8px', fontWeight: '600' }}
              >
                <i className="fas fa-calendar-day me-2"></i>
                Day
              </Button>
            </div>
          </Col>
          <Col md={6}>
            {/* Calendar Legend */}
            <div className="d-flex align-items-center justify-content-end gap-3 flex-wrap">
              <small style={{ color: '#64748b', fontWeight: '600' }}>Legend:</small>
              {leaveTypes.slice(0, 4).map(type => (
                <div key={type._id} className="d-flex align-items-center gap-1">
                  <div style={{
                    width: '12px',
                    height: '12px',
                    borderRadius: '3px',
                    background: type.color
                  }}></div>
                  <small style={{ color: '#64748b', fontSize: '0.75rem' }}>{type.name}</small>
                </div>
              ))}
              <div className="d-flex align-items-center gap-1">
                <div style={{
                  width: '12px',
                  height: '12px',
                  borderRadius: '3px',
                  background: '#fee2e2',
                  border: '1px solid #ef4444'
                }}></div>
                <small style={{ color: '#64748b', fontSize: '0.75rem' }}>Holiday</small>
              </div>
              <div className="d-flex align-items-center gap-1">
                <div style={{
                  width: '12px',
                  height: '12px',
                  borderRadius: '3px',
                  background: '#fef3c7',
                  border: '1px solid #fbbf24'
                }}></div>
                <small style={{ color: '#64748b', fontSize: '0.75rem' }}>Weekend</small>
              </div>
            </div>
          </Col>
        </Row>
      </div>

      {/* Calendar Grid */}
      <div style={{ background: 'white', borderRadius: '16px', padding: '1.5rem', border: '1px solid #e2e8f0' }}>
        {/* Week Days Header */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '8px', marginBottom: '1rem' }}>
          {weekDays.map(day => (
            <div key={day} style={{ 
              textAlign: 'center', 
              fontWeight: '600', 
              color: '#64748b',
              fontSize: '0.875rem',
              padding: '0.5rem'
            }}>
              {day}
            </div>
          ))}
        </div>

        {/* Calendar Days */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '8px' }}>
          {getCalendarDays().map((day, index) => {
            const dayLeaves = getLeavesForDay(day);
            const isToday = day === new Date().getDate() && selectedMonth === new Date().getMonth() && selectedYear === new Date().getFullYear();
            const isWeekendDay = isWeekend(day);
            const isHoliday = isPublicHoliday(day);
            const holidayName = getPublicHolidayName(day);
            
            return (
              <div 
                key={index}
                style={{
                  minHeight: '100px',
                  padding: '0.75rem',
                  borderRadius: '12px',
                  background: day ? (
                    isToday ? '#dbeafe' : 
                    isHoliday ? '#fee2e2' : 
                    isWeekendDay ? '#fef3c7' : 
                    '#ffffff'
                  ) : 'transparent',
                  border: isToday ? '2px solid #3b82f6' : 
                         isHoliday ? '2px solid #ef4444' : 
                         isWeekendDay ? '1px solid #fbbf24' :
                         '1px solid #e2e8f0',
                  position: 'relative',
                  cursor: day ? 'pointer' : 'default',
                  transition: 'all 0.2s'
                }}
                onClick={() => handleDayClick(day)}
                onMouseEnter={(e) => day && dayLeaves.length > 0 && (e.currentTarget.style.background = '#f1f5f9')}
                onMouseLeave={(e) => day && (e.currentTarget.style.background = isToday ? '#dbeafe' : isHoliday ? '#fee2e2' : isWeekendDay ? '#fef3c7' : '#ffffff')}
                title={holidayName || ''}
              >
                {day && (
                  <>
                    <div style={{ 
                      fontWeight: isToday ? '700' : '600', 
                      color: isToday ? '#3b82f6' : isHoliday ? '#dc2626' : isWeekendDay ? '#d97706' : '#1e293b',
                      fontSize: '0.875rem',
                      marginBottom: '0.5rem',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}>
                      <span>{day}</span>
                      {isHoliday && (
                        <i className="fas fa-star" style={{ fontSize: '0.6rem', color: '#dc2626' }} title={holidayName}></i>
                      )}
                    </div>
                    {isHoliday && holidayName && (
                      <div style={{
                        fontSize: '0.65rem',
                        color: '#dc2626',
                        fontWeight: '600',
                        marginBottom: '0.5rem',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                      }}>
                        {holidayName}
                      </div>
                    )}
                    {dayLeaves.slice(0, 2).map((leave, idx) => (
                      <div 
                        key={idx}
                        style={{
                          fontSize: '0.7rem',
                          padding: '0.25rem 0.5rem',
                          borderRadius: '6px',
                          background: leave.leaveTypeId?.color || '#6366f1',
                          color: 'white',
                          marginBottom: '0.25rem',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          fontWeight: '500'
                        }}
                        title={`${leave.userId.firstName} ${leave.userId.lastName} - ${leave.leaveTypeId?.name}`}
                      >
                        {leave.userId.firstName.charAt(0)}{leave.userId.lastName.charAt(0)}
                      </div>
                    ))}
                    {dayLeaves.length > 2 && (
                      <div style={{ 
                        fontSize: '0.65rem', 
                        color: '#6366f1', 
                        fontWeight: '600',
                        marginTop: '0.25rem'
                      }}>
                        +{dayLeaves.length - 2} more
                      </div>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Upcoming Leaves List */}
      <Row className="g-4 mt-1">
        <Col lg={12}>
          <div style={{ background: 'white', borderRadius: '16px', padding: '1.5rem', border: '1px solid #e2e8f0', boxShadow: '0 4px 12px rgba(0, 0, 0, 0.05)' }}>
            <h5 style={{ color: '#065f46', fontWeight: '700', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <i className="fas fa-list me-2" style={{ color: '#10b981' }}></i>
              Upcoming Leaves
              <Badge style={{ background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', marginLeft: '0.5rem' }}>
                {filteredLeaves.length}
              </Badge>
            </h5>
            <div style={{ maxHeight: '500px', overflowY: 'auto' }}>
              {filteredLeaves.length === 0 ? (
                <div className="text-center py-5">
                  <i className="fas fa-calendar-times" style={{ fontSize: '3rem', color: '#cbd5e1', marginBottom: '1rem' }}></i>
                  <p style={{ color: '#64748b' }}>No upcoming leaves found</p>
                </div>
              ) : (
                filteredLeaves.map(leave => (
                  <div 
                    key={leave._id}
                    style={{
                padding: '1rem',
                borderRadius: '12px',
                background: 'linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%)',
                marginBottom: '0.75rem',
                border: '2px solid #6ee7b7',
                transition: 'all 0.2s',
                boxShadow: '0 2px 8px rgba(16, 185, 129, 0.15)'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'linear-gradient(135deg, #a7f3d0 0%, #6ee7b7 100%)';
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(16, 185, 129, 0.25)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%)';
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 2px 8px rgba(16, 185, 129, 0.15)';
              }}
            >
              <div className="d-flex align-items-center justify-content-between">
                <div className="d-flex align-items-center gap-3 flex-grow-1">
                  <div style={{
                    width: '48px',
                    height: '48px',
                    borderRadius: '12px',
                    background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                    color: 'white',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: '700',
                    fontSize: '1rem',
                    boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)'
                  }}>
                    {leave.userId.firstName.charAt(0)}{leave.userId.lastName.charAt(0)}
                  </div>
                  <div>
                    <div style={{ fontWeight: '700', color: '#065f46', fontSize: '1rem', marginBottom: '0.25rem' }}>
                      {leave.userId.firstName} {leave.userId.lastName}
                    </div>
                    {leave.userId.department && (
                      <div style={{ fontSize: '0.75rem', color: '#047857', marginBottom: '0.25rem', fontWeight: '600' }}>
                        {leave.userId.department}
                      </div>
                    )}
                    <div style={{ fontSize: '0.875rem', color: '#059669', fontWeight: '600' }}>
                      <i className="fas fa-calendar me-1"></i>
                      {formatDate(leave.startDate)} - {formatDate(leave.endDate)} • {leave.days} day{leave.days > 1 ? 's' : ''}
                    </div>
                  </div>
                </div>
                <div className="d-flex align-items-center gap-2">
                  <Badge 
                    style={{ 
                      background: leave.leaveTypeId?.color || '#10b981',
                      padding: '0.5rem 1rem',
                      borderRadius: '8px',
                      fontWeight: '600',
                      boxShadow: '0 2px 6px rgba(0, 0, 0, 0.15)'
                    }}
                  >
                    {leave.leaveTypeId?.name}
                  </Badge>
                  {getStatusBadge(leave)}
                </div>
              </div>
            </div>
          ))
        )}
            </div>
          </div>
        </Col>
      </Row>

      {/* Team Members Cards */}
      <Row className="g-4 mt-1">
        <Col lg={12}>
          <div style={{ background: 'white', borderRadius: '16px', padding: '1.5rem', border: '1px solid #e2e8f0', boxShadow: '0 4px 12px rgba(0, 0, 0, 0.05)' }}>
            <h5 style={{ color: '#065f46', fontWeight: '700', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <i className="fas fa-users me-2" style={{ color: '#10b981' }}></i>
              Team Members
              <Badge style={{ background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', marginLeft: '0.5rem' }}>
                {teamMembers.length}
              </Badge>
            </h5>
            <Row className="g-3">
              {teamMembers.map(member => {
                const memberLeaves = filteredLeaves.filter(l => l.userId._id === member._id);
                const isOnLeave = memberLeaves.some(leave => {
                  const today = new Date();
                  const start = new Date(leave.startDate);
                  const end = new Date(leave.endDate);
                  return start <= today && end >= today;
                });
                
                return (
                  <Col xs={12} sm={6} md={4} lg={3} xl={2} key={member._id}>
                    <div 
                      onClick={() => handleEmployeeClick(member)}
                      style={{
                        background: 'white',
                        borderRadius: '12px',
                        padding: '1.25rem',
                        border: '2px solid #e2e8f0',
                        transition: 'all 0.3s',
                        cursor: 'pointer',
                        textAlign: 'center',
                        height: '100%',
                        position: 'relative'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.transform = 'translateY(-8px)';
                        e.currentTarget.style.boxShadow = '0 12px 24px rgba(0, 0, 0, 0.15)';
                        e.currentTarget.style.borderColor = isOnLeave ? '#f59e0b' : '#10b981';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.transform = 'translateY(0)';
                        e.currentTarget.style.boxShadow = 'none';
                        e.currentTarget.style.borderColor = '#e2e8f0';
                      }}
                    >
                      {isOnLeave && (
                        <div style={{
                          position: 'absolute',
                          top: '8px',
                          right: '8px',
                          background: '#ef4444',
                          color: 'white',
                          padding: '0.2rem 0.5rem',
                          borderRadius: '6px',
                          fontSize: '0.65rem',
                          fontWeight: '700',
                          zIndex: 1
                        }}>
                          <i className="fas fa-plane me-1"></i>
                          Away
                        </div>
                      )}
                      <div style={{ marginBottom: '1rem', position: 'relative', display: 'inline-block' }}>
                        {member.profileImage ? (
                          <img
                            src={member.profileImage}
                            alt={`${member.firstName} ${member.lastName}`}
                            style={{
                              width: '80px',
                              height: '80px',
                              borderRadius: '50%',
                              objectFit: 'cover',
                              border: '3px solid ' + (isOnLeave ? '#f59e0b' : '#10b981')
                            }}
                          />
                        ) : (
                          <div style={{
                            width: '80px',
                            height: '80px',
                            borderRadius: '50%',
                            background: isOnLeave ? 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)' : 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                            color: 'white',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontWeight: '700',
                            fontSize: '1.8rem',
                            margin: '0 auto',
                            border: '3px solid ' + (isOnLeave ? '#f59e0b' : '#10b981')
                          }}>
                            {member.firstName.charAt(0)}{member.lastName.charAt(0)}
                          </div>
                        )}
                        {isOnLeave && (
                          <div style={{
                            position: 'absolute',
                            bottom: '0',
                            right: '0',
                            width: '20px',
                            height: '20px',
                            borderRadius: '50%',
                            background: '#ef4444',
                            border: '3px solid white'
                          }}></div>
                        )}
                      </div>
                      <div style={{ fontWeight: '700', color: '#1e293b', fontSize: '0.95rem', marginBottom: '0.25rem' }}>
                        {member.firstName} {member.lastName}
                      </div>
                      {member.department && (
                        <div style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '0.75rem' }}>
                          <i className="fas fa-building me-1" style={{ fontSize: '0.7rem' }}></i>
                          {member.department}
                        </div>
                      )}
                      {isOnLeave ? (
                        <Badge bg="danger" style={{ fontSize: '0.7rem', fontWeight: '600', padding: '0.35rem 0.75rem' }}>
                          On Leave
                        </Badge>
                      ) : memberLeaves.length > 0 ? (
                        <Badge bg="warning" style={{ fontSize: '0.7rem', fontWeight: '600', padding: '0.35rem 0.75rem' }}>
                          {memberLeaves.length} Upcoming
                        </Badge>
                      ) : (
                        <Badge bg="success" style={{ fontSize: '0.7rem', fontWeight: '600', padding: '0.35rem 0.75rem' }}>
                          Available
                        </Badge>
                      )}
                    </div>
                  </Col>
                );
              })}
            </Row>
          </div>
        </Col>
      </Row>

      {/* Day Details Modal */}
      <Modal show={showModal} onHide={() => setShowModal(false)} size="lg" centered>
        <Modal.Header closeButton style={{ border: 'none', paddingBottom: 0 }}>
          <Modal.Title style={{ color: '#1e293b', fontWeight: '700' }}>
            Leaves on {months[selectedMonth]} {selectedDay?.day}, {selectedYear}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body style={{ padding: '1.5rem' }}>
          {selectedDay?.leaves.map(leave => (
            <div 
              key={leave._id}
              style={{
                padding: '1.25rem',
                borderRadius: '12px',
                background: '#f8fafc',
                marginBottom: '1rem',
                border: '1px solid #e2e8f0'
              }}
            >
              <div className="d-flex align-items-start justify-content-between mb-3">
                <div className="d-flex align-items-center gap-3">
                  <div style={{
                    width: '50px',
                    height: '50px',
                    borderRadius: '12px',
                    background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                    color: 'white',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: '700',
                    fontSize: '1.1rem'
                  }}>
                    {leave.userId.firstName.charAt(0)}{leave.userId.lastName.charAt(0)}
                  </div>
                  <div>
                    <div style={{ fontWeight: '700', color: '#1e293b', fontSize: '1.1rem' }}>
                      {leave.userId.firstName} {leave.userId.lastName}
                    </div>
                    {leave.userId.department && (
                      <div style={{ fontSize: '0.875rem', color: '#64748b' }}>
                        {leave.userId.department}
                      </div>
                    )}
                  </div>
                </div>
                {getStatusBadge(leave)}
              </div>
              <div className="d-flex gap-4 mb-2">
                <div>
                  <div style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '0.25rem' }}>Leave Type</div>
                  <Badge style={{ background: leave.leaveTypeId?.color || '#6366f1', padding: '0.5rem 1rem', borderRadius: '8px' }}>
                    {leave.leaveTypeId?.name}
                  </Badge>
                </div>
                <div>
                  <div style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '0.25rem' }}>Duration</div>
                  <div style={{ fontWeight: '600', color: '#1e293b' }}>
                    {formatDate(leave.startDate)} - {formatDate(leave.endDate)}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '0.25rem' }}>Days</div>
                  <div style={{ fontWeight: '600', color: '#1e293b' }}>
                    {leave.days} day{leave.days > 1 ? 's' : ''}
                  </div>
                </div>
              </div>
              {leave.reason && (
                <div style={{ marginTop: '1rem', padding: '0.75rem', background: 'white', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                  <div style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '0.25rem' }}>Reason</div>
                  <div style={{ fontSize: '0.875rem', color: '#1e293b' }}>{leave.reason}</div>
                </div>
              )}
            </div>
          ))}
        </Modal.Body>
      </Modal>

      {/* Employee Details Modal */}
      <Modal show={showEmployeeModal} onHide={() => setShowEmployeeModal(false)} size="lg" centered>
        <Modal.Header closeButton style={{ background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', border: 'none', padding: '1.5rem' }}>
          <Modal.Title style={{ color: 'white', fontWeight: '700', fontSize: '1.25rem', width: '100%' }}>
            {selectedEmployee && (
              <div className="d-flex align-items-center gap-3">
                <div style={{
                  width: '50px',
                  height: '50px',
                  borderRadius: '12px',
                  background: 'rgba(255, 255, 255, 0.2)',
                  backdropFilter: 'blur(10px)',
                  color: 'white',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: '700',
                  fontSize: '1.2rem',
                  border: '2px solid rgba(255, 255, 255, 0.3)'
                }}>
                  {selectedEmployee.firstName.charAt(0)}{selectedEmployee.lastName.charAt(0)}
                </div>
                <div>
                  <div style={{ fontSize: '1.25rem', fontWeight: '700' }}>
                    {selectedEmployee.firstName} {selectedEmployee.lastName}
                  </div>
                  {employeeDetails?.employee?.department && (
                    <div style={{ fontSize: '0.85rem', opacity: 0.9, fontWeight: '400', marginTop: '0.25rem' }}>
                      <i className="fas fa-building me-2"></i>
                      {employeeDetails.employee.department}
                    </div>
                  )}
                </div>
              </div>
            )}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body style={{ padding: '1.5rem', background: '#f8fafc' }}>
          {loadingEmployee ? (
            <div className="text-center py-4">
              <Spinner animation="border" style={{ color: '#10b981', width: '2.5rem', height: '2.5rem' }} />
              <p className="text-muted mt-2" style={{ fontSize: '0.9rem', fontWeight: '500' }}>Loading...</p>
            </div>
          ) : employeeDetails ? (
            <>
              {/* Leave Balances */}
              <div style={{ marginBottom: '1rem' }}>
                <h6 style={{ color: '#065f46', fontWeight: '700', marginBottom: '0.75rem', fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <i className="fas fa-wallet" style={{ color: '#10b981' }}></i>
                  Leave Balances
                </h6>
                {employeeDetails.balances && employeeDetails.balances.length > 0 ? (
                  <Row className="g-2">
                    {employeeDetails.balances.map(balance => {
                      const allocated = balance.allocated || 0;
                      const carryForward = balance.carryForward || 0;
                      const used = balance.used || 0;
                      const pending = balance.pending || 0;
                      const total = allocated + carryForward;
                      const available = total - used - pending;
                      
                      return (
                        <Col xs={6} key={balance._id}>
                          <div style={{ 
                            background: 'white', 
                            borderRadius: '10px', 
                            padding: '0.75rem', 
                            border: '1px solid #e2e8f0',
                            textAlign: 'center'
                          }}>
                            <Badge style={{ 
                              background: balance.leaveTypeId?.color || '#10b981', 
                              fontSize: '0.7rem', 
                              padding: '0.35rem 0.75rem',
                              fontWeight: '600',
                              marginBottom: '0.5rem'
                            }}>
                              {balance.leaveTypeId?.name || 'N/A'}
                            </Badge>
                            <div style={{ fontSize: '1.75rem', fontWeight: '700', color: available > 0 ? '#10b981' : '#ef4444', marginBottom: '0.25rem' }}>
                              {available}
                            </div>
                            <div style={{ fontSize: '0.65rem', color: '#64748b', fontWeight: '600' }}>Available</div>
                            <div style={{ fontSize: '0.65rem', color: '#94a3b8', marginTop: '0.25rem' }}>Used: {used} | Pending: {pending}</div>
                          </div>
                        </Col>
                      );
                    })}
                  </Row>
                ) : (
                  <div className="text-center py-3" style={{ color: '#64748b', background: 'white', borderRadius: '10px', border: '1px solid #e2e8f0', fontSize: '0.85rem' }}>
                    No leave balances
                  </div>
                )}
              </div>

              {/* Leave History */}
              <div>
                <h6 style={{ color: '#065f46', fontWeight: '700', marginBottom: '0.75rem', fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <i className="fas fa-history" style={{ color: '#10b981' }}></i>
                  Recent Leaves (Last 5)
                </h6>
                <div style={{ maxHeight: '300px', overflowY: 'auto', background: 'white', borderRadius: '10px', padding: '0.75rem', border: '1px solid #e2e8f0' }}>
                  {employeeDetails.leaves && employeeDetails.leaves.length > 0 ? (
                    employeeDetails.leaves.slice(0, 5).map(leave => (
                      <div 
                        key={leave._id}
                        style={{
                          padding: '0.75rem',
                          borderRadius: '8px',
                          background: '#f8fafc',
                          marginBottom: '0.5rem',
                          border: '1px solid #e2e8f0'
                        }}
                      >
                        <div className="d-flex justify-content-between align-items-center mb-2">
                          <Badge style={{ 
                            background: leave.leaveTypeId?.color || '#10b981', 
                            fontSize: '0.7rem', 
                            padding: '0.35rem 0.75rem',
                            fontWeight: '600'
                          }}>
                            {leave.leaveTypeId?.name || 'N/A'}
                          </Badge>
                          {getStatusBadge(leave)}
                        </div>
                        <div style={{ fontSize: '0.8rem', color: '#1e293b', fontWeight: '600', marginBottom: '0.25rem' }}>
                          <i className="fas fa-calendar" style={{ color: '#10b981', fontSize: '0.75rem', marginRight: '0.5rem' }}></i>
                          {formatDate(leave.startDate)} - {formatDate(leave.endDate)} ({leave.days} day{leave.days > 1 ? 's' : ''})
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-3" style={{ color: '#64748b', fontSize: '0.85rem' }}>
                      <i className="fas fa-calendar-times" style={{ fontSize: '2rem', marginBottom: '0.5rem', opacity: 0.3 }}></i>
                      <div>No leave history</div>
                    </div>
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className="text-center py-5">
              <i className="fas fa-exclamation-circle" style={{ fontSize: '3rem', color: '#ef4444', marginBottom: '1rem' }}></i>
              <p style={{ color: '#64748b' }}>Failed to load employee details</p>
            </div>
          )}
        </Modal.Body>
      </Modal>

      {/* Add Holiday Modal */}
      <Modal show={showHolidayModal} onHide={handleCloseHolidayModal} centered>
        <Modal.Header closeButton>
          <Modal.Title>{editingHoliday ? 'Edit Holiday' : 'Add Holiday'}</Modal.Title>
        </Modal.Header>
        <Form onSubmit={handleAddHoliday}>
          <Modal.Body>
            <Form.Group className="mb-3">
              <Form.Label>Holiday Name</Form.Label>
              <Form.Control
                type="text"
                value={holidayForm.name}
                onChange={(e) => setHolidayForm({ ...holidayForm, name: e.target.value })}
                required
              />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Date</Form.Label>
              <Form.Control
                type="date"
                value={holidayForm.date}
                onChange={(e) => setHolidayForm({ ...holidayForm, date: e.target.value })}
                required
              />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Type</Form.Label>
              <Form.Select
                value={holidayForm.type}
                onChange={(e) => setHolidayForm({ ...holidayForm, type: e.target.value })}
              >
                <option value="FESTIVAL">Festival</option>
                <option value="NATIONAL">National</option>
                <option value="REGIONAL">Regional</option>
              </Form.Select>
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Description (Optional)</Form.Label>
              <Form.Control
                as="textarea"
                rows={2}
                value={holidayForm.description}
                onChange={(e) => setHolidayForm({ ...holidayForm, description: e.target.value })}
              />
            </Form.Group>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={handleCloseHolidayModal}>
              Cancel
            </Button>
            <Button variant="primary" type="submit">
              {editingHoliday ? 'Update Holiday' : 'Add Holiday'}
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>

      {/* Manage Holidays Modal */}
      <Modal show={showHolidayListModal} onHide={() => setShowHolidayListModal(false)} size="lg" centered>
        <Modal.Header closeButton>
          <Modal.Title>Manage Holidays</Modal.Title>
        </Modal.Header>
        <Modal.Body style={{ maxHeight: '500px', overflowY: 'auto' }}>
          {publicHolidays.length === 0 ? (
            <div className="text-center py-4">
              <i className="fas fa-calendar-times" style={{ fontSize: '3rem', color: '#cbd5e1', marginBottom: '1rem' }}></i>
              <p style={{ color: '#64748b' }}>No holidays found</p>
            </div>
          ) : (
            <Table hover responsive>
              <thead>
                <tr>
                  <th>Holiday Name</th>
                  <th>Date</th>
                  <th>Type</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {publicHolidays.map(holiday => (
                  <tr key={holiday._id}>
                    <td>
                      <div style={{ fontWeight: '600', color: '#1e293b' }}>{holiday.name}</div>
                      {holiday.description && (
                        <small style={{ color: '#64748b' }}>{holiday.description}</small>
                      )}
                    </td>
                    <td>
                      <span style={{ fontWeight: '500' }}>
                        {new Date(holiday.date).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric'
                        })}
                      </span>
                    </td>
                    <td>
                      <Badge bg={
                        holiday.type === 'FESTIVAL' ? 'warning' :
                        holiday.type === 'NATIONAL' ? 'info' : 'secondary'
                      }>
                        {holiday.type}
                      </Badge>
                    </td>
                    <td>
                      <div className="d-flex gap-2">
                        <Button
                          size="sm"
                          variant="outline-primary"
                          onClick={() => {
                            setShowHolidayListModal(false);
                            handleEditHoliday(holiday);
                          }}
                        >
                          <i className="fas fa-edit"></i>
                        </Button>
                        <Button
                          size="sm"
                          variant="outline-danger"
                          onClick={() => handleDeleteHoliday(holiday._id)}
                        >
                          <i className="fas fa-trash"></i>
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowHolidayListModal(false)}>
            Close
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default TeamCalendar;
