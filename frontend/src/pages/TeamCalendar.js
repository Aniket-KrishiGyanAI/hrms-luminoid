import React, { useEffect, useState } from 'react';
import { Row, Col, Card, Badge, Spinner, Alert, Form, InputGroup, Button, Table, Modal } from 'react-bootstrap';
import api from '../utils/api';
import { toast } from 'react-toastify';

const TeamCalendar = () => {
  const [teamMembers, setTeamMembers] = useState([]);
  const [leaves, setLeaves] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedDay, setSelectedDay] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [showEmployeeModal, setShowEmployeeModal] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [employeeDetails, setEmployeeDetails] = useState(null);
  const [loadingEmployee, setLoadingEmployee] = useState(false);

  useEffect(() => {
    fetchTeamCalendar();
  }, []);

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
    const year = new Date().getFullYear();
    const firstDay = new Date(year, selectedMonth, 1);
    const lastDay = new Date(year, selectedMonth + 1, 0);
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
    const year = new Date().getFullYear();
    const date = new Date(year, selectedMonth, day);
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

  const getStatusBadge = (status) => {
    const statusConfig = {
      PENDING: { bg: '#fbbf24', text: 'Pending' },
      MANAGER_APPROVED: { bg: '#3b82f6', text: 'Manager Approved' },
      HR_APPROVED: { bg: '#10b981', text: 'Approved' },
      REJECTED: { bg: '#ef4444', text: 'Rejected' },
      CANCELLED: { bg: '#6b7280', text: 'Cancelled' }
    };
    const config = statusConfig[status] || statusConfig.PENDING;
    return (
      <Badge style={{ background: config.bg, padding: '0.4rem 0.8rem', borderRadius: '6px' }}>
        {config.text}
      </Badge>
    );
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
        <Row className="align-items-center">
          <Col md={6}>
            <div className="d-flex align-items-center gap-3">
              <Button 
                variant="link" 
                onClick={() => setSelectedMonth(selectedMonth === 0 ? 11 : selectedMonth - 1)}
                style={{ color: '#6366f1', textDecoration: 'none', fontSize: '1.25rem' }}
              >
                <i className="fas fa-chevron-left"></i>
              </Button>
              <h4 style={{ color: '#1e293b', fontWeight: '700', margin: 0, fontSize: '1.5rem' }}>
                {months[selectedMonth]} {new Date().getFullYear()}
              </h4>
              <Button 
                variant="link" 
                onClick={() => setSelectedMonth(selectedMonth === 11 ? 0 : selectedMonth + 1)}
                style={{ color: '#6366f1', textDecoration: 'none', fontSize: '1.25rem' }}
              >
                <i className="fas fa-chevron-right"></i>
              </Button>
            </div>
          </Col>
          <Col md={6}>
            <InputGroup>
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
            const isToday = day === new Date().getDate() && selectedMonth === new Date().getMonth();
            
            return (
              <div 
                key={index}
                style={{
                  minHeight: '100px',
                  padding: '0.75rem',
                  borderRadius: '12px',
                  background: day ? (isToday ? '#f0f9ff' : '#f8fafc') : 'transparent',
                  border: isToday ? '2px solid #6366f1' : '1px solid #e2e8f0',
                  position: 'relative',
                  cursor: day ? 'pointer' : 'default',
                  transition: 'all 0.2s'
                }}
                onClick={() => handleDayClick(day)}
                onMouseEnter={(e) => day && dayLeaves.length > 0 && (e.currentTarget.style.background = '#f1f5f9')}
                onMouseLeave={(e) => day && (e.currentTarget.style.background = isToday ? '#f0f9ff' : '#f8fafc')}
              >
                {day && (
                  <>
                    <div style={{ 
                      fontWeight: isToday ? '700' : '600', 
                      color: isToday ? '#6366f1' : '#1e293b',
                      fontSize: '0.875rem',
                      marginBottom: '0.5rem'
                    }}>
                      {day}
                    </div>
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
        <Col lg={8}>
          <div style={{ background: 'white', borderRadius: '16px', padding: '1.5rem', border: '1px solid #e2e8f0' }}>
            <h5 style={{ color: '#1e293b', fontWeight: '700', marginBottom: '1.5rem' }}>
              <i className="fas fa-list me-2" style={{ color: '#6366f1' }}></i>
              Upcoming Leaves
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
                background: '#f8fafc',
                marginBottom: '0.75rem',
                border: '1px solid #e2e8f0',
                transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = '#f1f5f9'}
              onMouseLeave={(e) => e.currentTarget.style.background = '#f8fafc'}
            >
              <div className="d-flex align-items-center justify-content-between">
                <div className="d-flex align-items-center gap-3 flex-grow-1">
                  <div style={{
                    width: '48px',
                    height: '48px',
                    borderRadius: '12px',
                    background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                    color: 'white',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: '700',
                    fontSize: '1rem'
                  }}>
                    {leave.userId.firstName.charAt(0)}{leave.userId.lastName.charAt(0)}
                  </div>
                  <div>
                    <div style={{ fontWeight: '600', color: '#1e293b', fontSize: '1rem', marginBottom: '0.25rem' }}>
                      {leave.userId.firstName} {leave.userId.lastName}
                    </div>
                    {leave.userId.department && (
                      <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginBottom: '0.25rem' }}>
                        {leave.userId.department}
                      </div>
                    )}
                    <div style={{ fontSize: '0.875rem', color: '#64748b' }}>
                      <i className="fas fa-calendar me-1"></i>
                      {formatDate(leave.startDate)} - {formatDate(leave.endDate)} • {leave.days} day{leave.days > 1 ? 's' : ''}
                    </div>
                  </div>
                </div>
                <div className="d-flex align-items-center gap-2">
                  <Badge 
                    style={{ 
                      background: leave.leaveTypeId?.color || '#6366f1',
                      padding: '0.5rem 1rem',
                      borderRadius: '8px',
                      fontWeight: '500'
                    }}
                  >
                    {leave.leaveTypeId?.name}
                  </Badge>
                  {getStatusBadge(leave.status)}
                </div>
              </div>
            </div>
          ))
        )}
            </div>
          </div>
        </Col>
        
        {/* Team Members List */}
        <Col lg={4}>
          <div style={{ background: 'white', borderRadius: '16px', padding: '1.5rem', border: '1px solid #e2e8f0' }}>
            <h5 style={{ color: '#1e293b', fontWeight: '700', marginBottom: '1.5rem' }}>
              <i className="fas fa-users me-2" style={{ color: '#6366f1' }}></i>
              Team Members ({teamMembers.length})
            </h5>
            <div style={{ maxHeight: '500px', overflowY: 'auto' }}>
              {teamMembers.map(member => {
                const memberLeaves = filteredLeaves.filter(l => l.userId._id === member._id);
                const isOnLeave = memberLeaves.some(leave => {
                  const today = new Date();
                  const start = new Date(leave.startDate);
                  const end = new Date(leave.endDate);
                  return start <= today && end >= today;
                });
                
                return (
                  <div 
                    key={member._id}
                    onClick={() => handleEmployeeClick(member)}
                    style={{
                      padding: '1rem',
                      borderRadius: '12px',
                      background: isOnLeave ? '#fef2f2' : '#f8fafc',
                      marginBottom: '0.75rem',
                      border: isOnLeave ? '1px solid #fecaca' : '1px solid #e2e8f0',
                      transition: 'all 0.2s',
                      cursor: 'pointer'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.transform = 'translateX(4px)'}
                    onMouseLeave={(e) => e.currentTarget.style.transform = 'translateX(0)'}
                  >
                    <div className="d-flex align-items-center gap-3">
                      <div style={{
                        width: '44px',
                        height: '44px',
                        borderRadius: '10px',
                        background: isOnLeave ? 'linear-gradient(135deg, #f59e0b 0%, #f97316 100%)' : 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                        color: 'white',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: '700',
                        fontSize: '0.95rem'
                      }}>
                        {member.firstName.charAt(0)}{member.lastName.charAt(0)}
                      </div>
                      <div className="flex-grow-1">
                        <div style={{ fontWeight: '600', color: '#1e293b', fontSize: '0.9rem' }}>
                          {member.firstName} {member.lastName}
                        </div>
                        {member.department && (
                          <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                            {member.department}
                          </div>
                        )}
                        {isOnLeave && (
                          <Badge style={{ background: '#f97316', fontSize: '0.7rem', marginTop: '0.25rem' }}>
                            On Leave
                          </Badge>
                        )}
                        {memberLeaves.length > 0 && !isOnLeave && (
                          <div style={{ fontSize: '0.7rem', color: '#6366f1', marginTop: '0.25rem' }}>
                            {memberLeaves.length} upcoming
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </Col>
      </Row>

      {/* Day Details Modal */}
      <Modal show={showModal} onHide={() => setShowModal(false)} size="lg" centered>
        <Modal.Header closeButton style={{ border: 'none', paddingBottom: 0 }}>
          <Modal.Title style={{ color: '#1e293b', fontWeight: '700' }}>
            Leaves on {months[selectedMonth]} {selectedDay?.day}, {new Date().getFullYear()}
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
                {getStatusBadge(leave.status)}
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
        <Modal.Header closeButton style={{ border: 'none', paddingBottom: 0 }}>
          <Modal.Title style={{ color: '#1e293b', fontWeight: '700', fontSize: '1.25rem' }}>
            {selectedEmployee && `${selectedEmployee.firstName} ${selectedEmployee.lastName}`}
            {employeeDetails?.employee?.department && (
              <div style={{ fontSize: '0.875rem', color: '#64748b', fontWeight: '400', marginTop: '0.25rem' }}>
                {employeeDetails.employee.department}
              </div>
            )}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body style={{ padding: '1.5rem' }}>
          {loadingEmployee ? (
            <div className="text-center py-5">
              <Spinner animation="border" style={{ color: '#6366f1' }} />
              <p className="text-muted mt-2">Loading employee details...</p>
            </div>
          ) : employeeDetails ? (
            <>
              {/* Monthly Attendance */}
              {employeeDetails.monthlyPresent && employeeDetails.monthlyPresent.length > 0 && (
                <div style={{ marginBottom: '1.5rem' }}>
                  <h6 style={{ color: '#1e293b', fontWeight: '700', marginBottom: '1rem' }}>
                    Monthly Attendance (Real-time Data)
                  </h6>
                  <div style={{ background: '#f8fafc', borderRadius: '12px', padding: '1rem', border: '1px solid #e2e8f0' }}>
                    <Row className="g-2">
                      {employeeDetails.monthlyPresent.map((month, index) => (
                        <Col xs={6} md={4} lg={3} key={index}>
                          <div style={{ 
                            background: 'white', 
                            borderRadius: '8px', 
                            padding: '0.75rem', 
                            border: '1px solid #e2e8f0',
                            textAlign: 'center'
                          }}>
                            <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: '600', marginBottom: '0.5rem' }}>
                              {month.month}
                            </div>
                            <div style={{ fontSize: '1.25rem', fontWeight: '700', color: '#10b981', marginBottom: '0.25rem' }}>
                              {month.presentDays}
                            </div>
                            <div style={{ fontSize: '0.65rem', color: '#64748b', lineHeight: '1.4' }}>
                              <div><span style={{ color: '#6366f1' }}>Days: {month.workingDays}</span></div>
                              <div><span style={{ color: '#f59e0b' }}>Leave: {month.leaveDays}</span></div>
                              <div><span style={{ color: '#ef4444' }}>Absent: {month.absentDays}</span></div>
                            </div>
                          </div>
                        </Col>
                      ))}
                    </Row>
                  </div>
                </div>
              )}

              {/* Leave Balances */}
              <div style={{ marginBottom: '1.5rem' }}>
                <h6 style={{ color: '#1e293b', fontWeight: '700', marginBottom: '1rem' }}>Leave Balances</h6>
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
                        <Col md={6} key={balance._id}>
                          <div style={{ background: '#f8fafc', borderRadius: '10px', padding: '1rem', border: '1px solid #e2e8f0' }}>
                            <div className="d-flex justify-content-between align-items-start mb-2">
                              <Badge style={{ background: balance.leaveTypeId?.color || '#6366f1', fontSize: '0.875rem', padding: '0.4rem 0.8rem' }}>
                                {balance.leaveTypeId?.name || 'N/A'}
                              </Badge>
                              <div style={{ fontSize: '1.75rem', fontWeight: '700', color: '#1e293b' }}>
                                {available}
                              </div>
                            </div>
                            <div style={{ fontSize: '0.75rem', color: '#64748b', lineHeight: '1.6' }}>
                              <div className="d-flex justify-content-between mb-1">
                                <span>Total Allocated:</span>
                                <span style={{ fontWeight: '600', color: '#1e293b' }}>{total}</span>
                              </div>
                              <div className="d-flex justify-content-between mb-1">
                                <span>Used:</span>
                                <span style={{ fontWeight: '600', color: '#ef4444' }}>{used}</span>
                              </div>
                              <div className="d-flex justify-content-between mb-1">
                                <span>Pending:</span>
                                <span style={{ fontWeight: '600', color: '#f59e0b' }}>{pending}</span>
                              </div>
                              <div className="d-flex justify-content-between pt-1" style={{ borderTop: '1px solid #e2e8f0' }}>
                                <span style={{ fontWeight: '600' }}>Available:</span>
                                <span style={{ fontWeight: '700', color: '#10b981' }}>{available}</span>
                              </div>
                            </div>
                          </div>
                        </Col>
                      );
                    })}
                  </Row>
                ) : (
                  <div className="text-center py-3" style={{ color: '#64748b', background: '#f8fafc', borderRadius: '10px' }}>
                    No leave balances found
                  </div>
                )}
              </div>

              {/* Leave History */}
              <div>
                <h6 style={{ color: '#1e293b', fontWeight: '700', marginBottom: '1rem' }}>Leave History</h6>
                <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                  {employeeDetails.leaves && employeeDetails.leaves.length > 0 ? (
                    employeeDetails.leaves.map(leave => (
                      <div 
                        key={leave._id}
                        style={{
                          padding: '1rem',
                          borderRadius: '10px',
                          background: '#f8fafc',
                          marginBottom: '0.75rem',
                          border: '1px solid #e2e8f0'
                        }}
                      >
                        <div className="d-flex justify-content-between align-items-start mb-2">
                          <Badge style={{ background: leave.leaveTypeId?.color || '#6366f1', fontSize: '0.875rem', padding: '0.4rem 0.8rem' }}>
                            {leave.leaveTypeId?.name || 'N/A'}
                          </Badge>
                          {getStatusBadge(leave.status)}
                        </div>
                        <div style={{ fontSize: '0.875rem', color: '#1e293b', marginBottom: '0.5rem', fontWeight: '600' }}>
                          <i className="fas fa-calendar me-2" style={{ color: '#6366f1' }}></i>
                          {formatDate(leave.startDate)} - {formatDate(leave.endDate)}
                          <span style={{ marginLeft: '0.5rem', color: '#64748b', fontWeight: '400' }}>({leave.days} day{leave.days > 1 ? 's' : ''})</span>
                        </div>
                        {leave.reason && (
                          <div style={{ fontSize: '0.8rem', color: '#64748b', padding: '0.5rem', background: 'white', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                            <i className="fas fa-comment-dots me-2"></i>
                            {leave.reason}
                          </div>
                        )}
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-4" style={{ color: '#64748b', background: '#f8fafc', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                      <i className="fas fa-calendar-times" style={{ fontSize: '2rem', marginBottom: '0.5rem', opacity: 0.5 }}></i>
                      <div>No leave history found</div>
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
    </div>
  );
};

export default TeamCalendar;
