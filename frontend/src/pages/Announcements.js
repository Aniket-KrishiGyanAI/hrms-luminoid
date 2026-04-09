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
      <Modal show={showModal} onHide={() => setShowModal(false)} size="lg">
        <Modal.Header closeButton>
          <Modal.Title>Create New Announcement</Modal.Title>
        </Modal.Header>
        <Form onSubmit={handleSubmit}>
          <Modal.Body>
            <Row>
              <Col md={8}>
                <Form.Group className="mb-3">
                  <Form.Label>Title</Form.Label>
                  <Form.Control
                    type="text"
                    value={formData.title}
                    onChange={(e) => setFormData({...formData, title: e.target.value})}
                    required
                  />
                </Form.Group>
              </Col>
              <Col md={4}>
                <Form.Group className="mb-3">
                  <Form.Label>Priority</Form.Label>
                  <Form.Select
                    value={formData.priority}
                    onChange={(e) => setFormData({...formData, priority: e.target.value})}
                  >
                    <option value="LOW">Low</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HIGH">High</option>
                  </Form.Select>
                </Form.Group>
              </Col>
            </Row>
            <Form.Group className="mb-3">
              <Form.Label>Content</Form.Label>
              <Form.Control
                as="textarea"
                rows={4}
                value={formData.content}
                onChange={(e) => setFormData({...formData, content: e.target.value})}
                required
              />
            </Form.Group>
            <Row>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label><i className="fas fa-user-tag me-2"></i>Target Roles</Form.Label>
                  <div>
                    {['EMPLOYEE', 'MANAGER', 'HR', 'ADMIN'].map(role => (
                      <Form.Check
                        key={role}
                        type="checkbox"
                        label={role}
                        checked={formData.targetRoles.includes(role)}
                        onChange={(e) => handleRoleChange(role, e.target.checked)}
                      />
                    ))}
                  </div>
                  <Form.Text className="text-muted">
                    Leave empty to target all roles
                  </Form.Text>
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label><i className="fas fa-building me-2"></i>Target Departments</Form.Label>
                  <div style={{ maxHeight: '150px', overflowY: 'auto', border: '1px solid #dee2e6', borderRadius: '4px', padding: '8px' }}>
                    {departments.map(dept => (
                      <Form.Check
                        key={dept._id}
                        type="checkbox"
                        label={dept.name}
                        checked={formData.targetDepartments.includes(dept._id)}
                        onChange={(e) => handleDepartmentChange(dept._id, e.target.checked)}
                      />
                    ))}
                  </div>
                  <Form.Text className="text-muted">
                    Leave empty to target all departments
                  </Form.Text>
                </Form.Group>
              </Col>
            </Row>
            <Row>
              <Col md={12}>
                <Form.Group className="mb-3">
                  <Form.Label><i className="fas fa-clock me-2"></i>Expiry Date (Optional)</Form.Label>
                  <Form.Control
                    type="date"
                    value={formData.expiryDate}
                    onChange={(e) => setFormData({...formData, expiryDate: e.target.value})}
                  />
                  <Form.Text className="text-muted">
                    Leave empty for no expiry
                  </Form.Text>
                </Form.Group>
              </Col>
            </Row>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={() => setShowModal(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" disabled={submitting}>
              {submitting ? (
                <>
                  <span className="spinner-border spinner-border-sm me-2"></span>
                  Creating...
                </>
              ) : (
                'Create Announcement'
              )}
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>
    </div>
  );
};

export default Announcements;