import React, { useState, useEffect } from 'react';
import { Row, Col, Card, Button, Modal, Form, Badge } from 'react-bootstrap';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import { toast } from 'react-toastify';
import Swal from 'sweetalert2';

const Announcements = () => {
  const { user } = useAuth();
  const [announcements, setAnnouncements] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    priority: 'MEDIUM',
    targetRoles: [],
    targetDepartments: [],
    expiryDate: ''
  });

  const fetchAnnouncements = async () => {
    try {
      const response = await api.get('/api/announcements');
      setAnnouncements(response.data);
      console.log('Loaded announcements:', response.data.length);
    } catch (error) {
      console.error('Error:', error);
      toast.error('Failed to load announcements');
    } finally {
      setLoading(false);
    }
  };

  const fetchDepartments = async () => {
    try {
      const response = await api.get('/api/departments');
      setDepartments(response.data.data || []);
    } catch (error) {
      console.error('Error fetching departments:', error);
    }
  };

  useEffect(() => {
    fetchAnnouncements();
    fetchDepartments();
    const interval = setInterval(fetchAnnouncements, 3000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleDepartmentChange = (deptId, checked) => {
    if (checked) {
      setFormData({
        ...formData,
        targetDepartments: [...formData.targetDepartments, deptId]
      });
    } else {
      setFormData({
        ...formData,
        targetDepartments: formData.targetDepartments.filter(d => d !== deptId)
      });
    }
  };

  const handleRoleChange = (role, checked) => {
    if (checked) {
      setFormData({
        ...formData,
        targetRoles: [...formData.targetRoles, role]
      });
    } else {
      setFormData({
        ...formData,
        targetRoles: formData.targetRoles.filter(r => r !== role)
      });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validation
    if (!formData.title.trim()) {
      toast.error('Please enter a title');
      return;
    }
    
    if (!formData.content.trim()) {
      toast.error('Please enter content');
      return;
    }
    
    setSubmitting(true);
    
    try {
      // Prepare data
      const submitData = {
        title: formData.title.trim(),
        content: formData.content.trim(),
        priority: formData.priority,
        targetRoles: formData.targetRoles.length > 0 ? formData.targetRoles : ['EMPLOYEE', 'MANAGER', 'HR', 'ADMIN'],
        targetDepartments: formData.targetDepartments,
        expiryDate: formData.expiryDate || null
      };
      
      console.log('Submitting announcement:', submitData);
      
      // Send to server
      const response = await api.post('/api/announcements', submitData);
      
      console.log('Response:', response.data);
      
      // Close modal and reset form
      setShowModal(false);
      setFormData({ 
        title: '', 
        content: '', 
        priority: 'MEDIUM', 
        targetRoles: [], 
        targetDepartments: [], 
        expiryDate: '' 
      });
      
      // Show success message
      toast.success('Announcement created successfully');
      
      // Refresh announcements
      fetchAnnouncements();
      
    } catch (error) {
      console.error('Error creating announcement:', error);
      console.error('Error response:', error.response?.data);
      toast.error(error.response?.data?.message || 'Failed to create announcement');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    const result = await Swal.fire({
      title: 'Delete Announcement?',
      text: 'This action cannot be undone!',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#dc3545',
      cancelButtonColor: '#6c757d',
      confirmButtonText: 'Yes, delete it!',
      cancelButtonText: 'Cancel'
    });

    if (result.isConfirmed) {
      try {
        await api.delete(`/api/announcements/${id}`);
        toast.success('Announcement deleted');
        fetchAnnouncements();
      } catch (error) {
        toast.error('Failed to delete announcement');
      }
    }
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'HIGH': return 'danger';
      case 'MEDIUM': return 'warning';
      case 'LOW': return 'info';
      default: return 'secondary';
    }
  };

  if (loading) {
    return (
      <div className="text-center p-5">
        <div className="spinner-border text-primary" role="status"></div>
        <p className="mt-3">Loading announcements...</p>
      </div>
    );
  }

  return (
    <div className="fade-in-up">
      <div className="page-header d-flex align-items-center justify-content-between mb-4">
        <div>
          <h1 className="page-title mb-1">
            <i className="fas fa-bullhorn me-3"></i>
            Announcements
          </h1>
          <p className="text-muted mb-0">Company announcements and notifications</p>
        </div>
        <div className="d-flex gap-2">
          <Button variant="outline-primary" onClick={fetchAnnouncements} size="sm" className="btn-modern">
            <i className="fas fa-sync-alt me-1"></i>Refresh
          </Button>
          {['HR', 'ADMIN'].includes(user?.role) && (
            <Button variant="primary" onClick={() => setShowModal(true)} className="btn-modern">
              <i className="fas fa-plus me-2"></i>New Announcement
            </Button>
          )}
        </div>
      </div>

      <Row>
        <Col>
          <Card className="modern-card">
            <Card.Header className="bg-light">
              <div className="d-flex align-items-center justify-content-between">
                <h5 className="mb-0">
                  <i className="fas fa-list-ul me-2 text-primary"></i>
                  Recent Announcements
                </h5>
                <Badge bg="primary" pill className="badge-modern">{Math.min(announcements.length, 5)}</Badge>
              </div>
            </Card.Header>
            <Card.Body className="p-0">
              {announcements.length > 0 ? (
                <div className="list-group list-group-flush">
                  {announcements.slice(0, 5).map((announcement) => (
                    <div key={announcement._id} className="modern-list-item">
                      <div className="d-flex justify-content-between align-items-start">
                        <div className="flex-grow-1">
                          <div className="d-flex align-items-center mb-2">
                            <div className="me-3">
                              <div 
                                className="avatar"
                                style={{
                                  backgroundColor: getPriorityColor(announcement.priority) === 'danger' ? '#f87171' : 
                                                   getPriorityColor(announcement.priority) === 'warning' ? '#fbbf24' : '#38bdf8'
                                }}
                              >
                                <i className="fas fa-bullhorn"></i>
                              </div>
                            </div>
                            <div className="flex-grow-1">
                              <div className="d-flex align-items-center mb-1">
                                <h6 className="mb-0 me-2">{announcement.title}</h6>
                                <Badge bg={getPriorityColor(announcement.priority)} className="badge-modern ms-auto">
                                  {announcement.priority}
                                </Badge>
                              </div>
                              <p className="text-muted mb-2 small">{announcement.content}</p>
                              <div className="d-flex align-items-center text-muted small">
                                <i className="fas fa-user me-1"></i>
                                <span className="me-3">{announcement.createdBy?.firstName} {announcement.createdBy?.lastName}</span>
                                <i className="fas fa-calendar me-1"></i>
                                <span>{new Date(announcement.createdAt).toLocaleDateString()}</span>
                                {announcement.expiryDate && (
                                  <>
                                    <i className="fas fa-clock ms-3 me-1"></i>
                                    <span>Expires: {new Date(announcement.expiryDate).toLocaleDateString()}</span>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                        {['HR', 'ADMIN'].includes(user?.role) && (
                          <div className="ms-3">
                            <Button
                              size="sm"
                              variant="outline-danger"
                              onClick={() => handleDelete(announcement._id)}
                              className="btn-modern"
                            >
                              <i className="fas fa-trash"></i>
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-5">
                  <div className="mb-3">
                    <i className="fas fa-bullhorn text-muted" style={{fontSize: '4rem'}}></i>
                  </div>
                  <h5 className="text-muted mb-2">No announcements yet</h5>
                  <p className="text-muted small mb-0">New announcements will appear here</p>
                </div>
              )}
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* Create Modal */}
      <Modal show={showModal} onHide={() => !submitting && setShowModal(false)} size="lg" centered>
        <Form onSubmit={handleSubmit}>
          <Modal.Header closeButton style={{ background: 'linear-gradient(135deg,#10b981 0%,#059669 100%)', color: '#fff', borderBottom: 'none', borderRadius: '0.5rem 0.5rem 0 0' }}>
            <Modal.Title style={{ fontWeight: 700, fontSize: '1.1rem' }}>
              <i className="fas fa-bullhorn me-2"></i>Create New Announcement
            </Modal.Title>
          </Modal.Header>

          <Modal.Body style={{ background: '#f8fafc', padding: '1.5rem', overflowY: 'auto', maxHeight: 'calc(100vh - 260px)' }} className="announcement-modal-body">

            {/* Section: Basic Info */}
            <div style={{ background: '#fff', borderRadius: '0.75rem', border: '1px solid #e2e8f0', padding: '1.25rem', marginBottom: '1rem' }}>
              <div style={{ fontWeight: 700, color: '#374151', fontSize: '0.85rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ width: 24, height: 24, borderRadius: '50%', background: '#d1fae5', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                  <i className="fas fa-info-circle" style={{ color: '#10b981', fontSize: '0.75rem' }}></i>
                </span>
                Announcement Details
              </div>
              <Row className="g-3">
                <Col md={8}>
                  <Form.Label style={{ fontWeight: 600, fontSize: '0.82rem', color: '#374151' }}>Title <span className="text-danger">*</span></Form.Label>
                  <Form.Control
                    type="text"
                    value={formData.title}
                    onChange={(e) => setFormData({...formData, title: e.target.value})}
                    placeholder="Enter announcement title..."
                    required
                    style={{ borderRadius: '0.5rem', fontSize: '0.85rem' }}
                  />
                </Col>
                <Col md={4}>
                  <Form.Label style={{ fontWeight: 600, fontSize: '0.82rem', color: '#374151' }}>Priority</Form.Label>
                  <div style={{ display: 'flex', gap: '0.4rem' }}>
                    {[
                      { value: 'LOW', color: '#06b6d4', bg: '#ecfeff', label: 'Low' },
                      { value: 'MEDIUM', color: '#f59e0b', bg: '#fffbeb', label: 'Med' },
                      { value: 'HIGH', color: '#ef4444', bg: '#fef2f2', label: 'High' },
                    ].map(p => (
                      <div key={p.value} onClick={() => setFormData({...formData, priority: p.value})}
                        style={{
                          flex: 1, padding: '0.5rem 0.25rem', borderRadius: '0.5rem', cursor: 'pointer',
                          textAlign: 'center', fontSize: '0.78rem', fontWeight: 700, transition: 'all 0.15s',
                          border: formData.priority === p.value ? `2px solid ${p.color}` : '2px solid #e2e8f0',
                          background: formData.priority === p.value ? p.bg : '#f8fafc',
                          color: formData.priority === p.value ? p.color : '#94a3b8'
                        }}
                      >
                        {p.label}
                      </div>
                    ))}
                  </div>
                </Col>
                <Col md={12}>
                  <Form.Label style={{ fontWeight: 600, fontSize: '0.82rem', color: '#374151' }}>Content <span className="text-danger">*</span></Form.Label>
                  <Form.Control
                    as="textarea" rows={4}
                    value={formData.content}
                    onChange={(e) => setFormData({...formData, content: e.target.value})}
                    placeholder="Write your announcement here..."
                    required
                    style={{ borderRadius: '0.5rem', fontSize: '0.85rem', resize: 'none' }}
                  />
                </Col>
              </Row>
            </div>

            {/* Section: Audience */}
            <div style={{ background: '#fff', borderRadius: '0.75rem', border: '1px solid #e2e8f0', padding: '1.25rem', marginBottom: '1rem' }}>
              <div style={{ fontWeight: 700, color: '#374151', fontSize: '0.85rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ width: 24, height: 24, borderRadius: '50%', background: '#d1fae5', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                  <i className="fas fa-users" style={{ color: '#10b981', fontSize: '0.7rem' }}></i>
                </span>
                Audience
              </div>
              <Row className="g-3">
                <Col md={6}>
                  <Form.Label style={{ fontWeight: 600, fontSize: '0.82rem', color: '#374151' }}>
                    <i className="fas fa-user-tag me-1" style={{ color: '#10b981' }}></i>Target Roles
                  </Form.Label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                    {[{ value: 'EMPLOYEE', icon: 'user', color: '#10b981', bg: '#d1fae5' }, { value: 'MANAGER', icon: 'user-tie', color: '#059669', bg: '#a7f3d0' }, { value: 'HR', icon: 'user-nurse', color: '#047857', bg: '#6ee7b7' }, { value: 'ADMIN', icon: 'shield-alt', color: '#065f46', bg: '#34d399' }].map(r => {
                      const checked = formData.targetRoles.includes(r.value);
                      return (
                        <div key={r.value} onClick={() => handleRoleChange(r.value, !checked)}
                          style={{
                            padding: '0.45rem 0.85rem', borderRadius: '0.5rem', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600,
                            border: checked ? `2px solid ${r.color}` : '2px solid #e2e8f0',
                            background: checked ? r.bg : '#f8fafc',
                            color: checked ? r.color : '#64748b',
                            display: 'flex', alignItems: 'center', gap: '0.4rem', transition: 'all 0.15s'
                          }}
                        >
                          <i className={`fas fa-${r.icon}`} style={{ fontSize: '0.75rem' }}></i>
                          {r.value.charAt(0) + r.value.slice(1).toLowerCase()}
                          {checked && <i className="fas fa-check" style={{ fontSize: '0.65rem' }}></i>}
                        </div>
                      );
                    })}
                  </div>
                  <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginTop: '0.4rem' }}>Leave empty to target all roles</div>
                </Col>
                <Col md={6}>
                  <Form.Label style={{ fontWeight: 600, fontSize: '0.82rem', color: '#374151' }}>
                    <i className="fas fa-building me-1" style={{ color: '#10b981' }}></i>Target Departments
                  </Form.Label>
                  <div style={{ maxHeight: 140, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.3rem' }} className="department-scroll">
                    {departments.map(dept => {
                      const checked = formData.targetDepartments.includes(dept._id);
                      return (
                        <div key={dept._id} onClick={() => handleDepartmentChange(dept._id, !checked)}
                          style={{
                            padding: '0.4rem 0.7rem', borderRadius: '0.4rem', cursor: 'pointer', fontSize: '0.82rem',
                            border: checked ? '1.5px solid #10b981' : '1.5px solid #e2e8f0',
                            background: checked ? '#d1fae5' : '#f8fafc',
                            color: checked ? '#10b981' : '#374151',
                            display: 'flex', alignItems: 'center', gap: '0.5rem', transition: 'all 0.15s'
                          }}
                        >
                          <i className={`fas fa-${checked ? 'check-circle' : 'circle'}`} style={{ fontSize: '0.72rem', color: checked ? '#10b981' : '#cbd5e1' }}></i>
                          <span style={{ fontWeight: checked ? 600 : 400 }}>{dept.name}</span>
                        </div>
                      );
                    })}
                    {departments.length === 0 && <small className="text-muted">No departments found</small>}
                  </div>
                  <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginTop: '0.4rem' }}>Leave empty to target all departments</div>
                </Col>
              </Row>
            </div>

            {/* Section: Expiry */}
            <div style={{ background: '#fff', borderRadius: '0.75rem', border: '1px solid #e2e8f0', padding: '1.25rem' }}>
              <div style={{ fontWeight: 700, color: '#374151', fontSize: '0.85rem', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ width: 24, height: 24, borderRadius: '50%', background: '#d1fae5', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                  <i className="fas fa-clock" style={{ color: '#10b981', fontSize: '0.7rem' }}></i>
                </span>
                Expiry Date <span style={{ color: '#94a3b8', fontWeight: 400, fontSize: '0.78rem' }}>(optional)</span>
              </div>
              <Form.Control
                type="date"
                value={formData.expiryDate}
                onChange={(e) => setFormData({...formData, expiryDate: e.target.value})}
                style={{ borderRadius: '0.5rem', fontSize: '0.85rem', maxWidth: 220 }}
              />
              <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginTop: '0.4rem' }}>Leave empty for no expiry</div>
            </div>

          </Modal.Body>

          <Modal.Footer style={{ background: '#f8fafc', borderTop: '1px solid #e2e8f0', padding: '1rem 1.5rem' }}>
            <Button
              variant="light"
              onClick={() => setShowModal(false)}
              disabled={submitting}
              style={{ fontWeight: 600, fontSize: '0.85rem', borderRadius: '0.5rem', border: '1.5px solid #e2e8f0' }}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={submitting}
              style={{ background: 'linear-gradient(135deg,#10b981 0%,#059669 100%)', border: 'none', fontWeight: 700, fontSize: '0.85rem', borderRadius: '0.5rem', padding: '0.5rem 1.5rem', minWidth: 170 }}
            >
              {submitting ? (
                <><span className="spinner-border spinner-border-sm me-2" role="status"></span>Creating...</>
              ) : (
                <><i className="fas fa-bullhorn me-2"></i>Create Announcement</>
              )}
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>
    </div>
  );
};

export default Announcements;