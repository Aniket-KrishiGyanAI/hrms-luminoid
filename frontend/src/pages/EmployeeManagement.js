import React, { useState, useEffect } from 'react';
import { Row, Col, Card, Button, Modal, Form, Table, Badge } from 'react-bootstrap';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import { toast } from 'react-toastify';

const EmployeeManagement = () => {
  const { user } = useAuth();
  const [employees, setEmployees] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState('active');
  const [formData, setFormData] = useState({
    email: '',
    firstName: '',
    lastName: '',
    role: 'EMPLOYEE',
    department: '',
    designation: '',
    joinDate: new Date().toISOString().split('T')[0],
    managerId: ''
  });

  useEffect(() => {
    fetchEmployees();
  }, [filter]);

  useEffect(() => {
    fetchDepartments();
  }, []);

  const fetchDepartments = async () => {
    try {
      const response = await api.get('/api/departments');
      console.log('Departments fetched:', response.data);
      setDepartments(response.data.data || []);
    } catch (error) {
      console.error('Error fetching departments:', error);
      toast.error('Failed to load departments');
    }
  };

  const fetchEmployees = async () => {
    try {
      const response = await api.get(`/api/employee-management/all?status=${filter}`);
      setEmployees(response.data);
    } catch (error) {
      toast.error('Error fetching employees');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const response = await api.post('/api/employee-management/create', formData);
      
      // Show success with password
      if (response.data.employee?.tempPassword) {
        await toast.promise(
          Promise.resolve(),
          {
            pending: 'Creating employee...',
            success: {
              render() {
                return (
                  <div>
                    <strong>Employee Created Successfully!</strong>
                    <div style={{ marginTop: '8px', padding: '8px', background: '#f0fdf4', borderRadius: '6px' }}>
                      <div><strong>Email:</strong> {response.data.employee.email}</div>
                      <div><strong>Password:</strong> <code style={{ background: '#dcfce7', padding: '2px 6px', borderRadius: '4px' }}>{response.data.employee.tempPassword}</code></div>
                    </div>
                    <small style={{ color: '#059669', marginTop: '4px', display: 'block' }}>✓ Welcome email sent to employee</small>
                  </div>
                );
              },
              autoClose: 8000
            }
          }
        );
      } else {
        toast.success('Employee created successfully! Welcome email sent.');
      }
      
      setShowAddModal(false);
      resetForm();
      fetchEmployees();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Error creating employee');
    } finally {
      setLoading(false);
    }
  };

  const handleDeactivate = async (userId) => {
    if (!window.confirm('Are you sure you want to deactivate this employee?')) return;
    
    try {
      await api.put(`/api/employee-management/${userId}/deactivate`, {
        reason: 'Deactivated by admin'
      });
      toast.success('Employee deactivated successfully');
      fetchEmployees();
    } catch (error) {
      toast.error('Error deactivating employee');
    }
  };

  const handleReactivate = async (userId) => {
    try {
      await api.put(`/api/employee-management/${userId}/reactivate`);
      toast.success('Employee reactivated successfully');
      fetchEmployees();
    } catch (error) {
      toast.error('Error reactivating employee');
    }
  };

  const handleToggleFieldEmployee = async (userId, currentValue) => {
    try {
      await api.put(`/api/employee-management/${userId}/toggle-field-employee`);
      toast.success(`Field tracking ${!currentValue ? 'enabled' : 'disabled'}`);
      fetchEmployees();
    } catch (error) {
      toast.error('Error updating field employee status');
    }
  };

  const resetForm = () => {
    setFormData({
      email: '',
      firstName: '',
      lastName: '',
      role: 'EMPLOYEE',
      department: '',
      designation: '',
      joinDate: new Date().toISOString().split('T')[0],
      managerId: ''
    });
  };

  if (!['ADMIN', 'HR'].includes(user?.role)) {
    return (
      <div className="text-center py-5">
        <i className="fas fa-lock fa-3x text-muted mb-3"></i>
        <h4>Access Denied</h4>
        <p className="text-muted">You don't have permission to access this feature.</p>
      </div>
    );
  }

  return (
    <div className="fade-in-up">
      <div className="page-header d-flex align-items-center justify-content-between mb-4">
        <div>
          <h1 className="page-title mb-1">
            <i className="fas fa-users-cog me-3 text-primary"></i>
            Employee Management
          </h1>
          <p className="text-muted mb-0">Add, remove, and manage employees</p>
        </div>
        <Button variant="primary" onClick={() => {
          setShowAddModal(true);
          if (departments.length === 0) {
            fetchDepartments();
          }
        }}>
          <i className="fas fa-user-plus me-2"></i>Add Employee
        </Button>
      </div>

      <Card>
        <Card.Header className="d-flex justify-content-between align-items-center">
          <h5 className="mb-0">Employee List</h5>
          <div className="btn-group">
            <Button 
              size="sm" 
              variant={filter === 'active' ? 'primary' : 'outline-primary'}
              onClick={() => setFilter('active')}
            >
              Active
            </Button>
            <Button 
              size="sm" 
              variant={filter === 'inactive' ? 'primary' : 'outline-primary'}
              onClick={() => setFilter('inactive')}
            >
              Inactive
            </Button>
          </div>
        </Card.Header>
        <Card.Body>
          <Table responsive hover>
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Department</th>
                <th>Designation</th>
                <th>Join Date</th>
                <th>Field Employee</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {employees.map((emp) => (
                <tr key={emp._id}>
                  <td>{emp.firstName} {emp.lastName}</td>
                  <td>{emp.email}</td>
                  <td>
                    <Badge bg={
                      emp.role === 'ADMIN' ? 'danger' :
                      emp.role === 'HR' ? 'warning' :
                      emp.role === 'MANAGER' ? 'info' : 'secondary'
                    }>
                      {emp.role}
                    </Badge>
                  </td>
                  <td>{emp.department || '-'}</td>
                  <td>{emp.designation || '-'}</td>
                  <td>{emp.joinDate ? new Date(emp.joinDate).toLocaleDateString() : '-'}</td>
                  <td>
                    <div className="form-check form-switch d-flex align-items-center gap-2">
                      <input
                        className="form-check-input"
                        type="checkbox"
                        role="switch"
                        checked={!!emp.isFieldEmployee}
                        onChange={() => handleToggleFieldEmployee(emp._id, emp.isFieldEmployee)}
                        style={{ cursor: 'pointer', width: 36, height: 20 }}
                      />
                      <small style={{ color: emp.isFieldEmployee ? '#10b981' : '#9ca3af', fontWeight: 600 }}>
                        {emp.isFieldEmployee ? 'Yes' : 'No'}
                      </small>
                    </div>
                  </td>
                  <td>
                    <Badge bg={emp.isActive ? 'success' : 'danger'}>
                      {emp.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                  </td>
                  <td>
                    {emp.isActive ? (
                      user.role === 'ADMIN' && (
                        <Button 
                          size="sm" 
                          variant="outline-danger"
                          onClick={() => handleDeactivate(emp._id)}
                        >
                          <i className="fas fa-user-slash me-1"></i>Deactivate
                        </Button>
                      )
                    ) : (
                      user.role === 'ADMIN' && (
                        <Button 
                          size="sm" 
                          variant="outline-success"
                          onClick={() => handleReactivate(emp._id)}
                        >
                          <i className="fas fa-user-check me-1"></i>Reactivate
                        </Button>
                      )
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
          {employees.length === 0 && (
            <div className="text-center py-4 text-muted">
              No employees found
            </div>
          )}
        </Card.Body>
      </Card>

      {/* Add Employee Modal */}
      <Modal show={showAddModal} onHide={() => setShowAddModal(false)} size="lg" centered>
        <Modal.Header closeButton style={{ background: 'linear-gradient(135deg, #064e3b 0%, #10b981 100%)', color: 'white', border: 'none' }}>
          <Modal.Title className="fw-bold">
            <i className="fas fa-user-plus me-2"></i>
            Add New Employee
          </Modal.Title>
        </Modal.Header>
        <Form onSubmit={handleSubmit}>
          <Modal.Body style={{ padding: '30px', background: '#f0fdf4' }}>
            <div style={{ background: '#dbeafe', padding: '12px 16px', borderRadius: '10px', marginBottom: '24px', border: '1px solid #93c5fd' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#1e40af' }}>
                <i className="fas fa-info-circle"></i>
                <span style={{ fontSize: '0.9rem', fontWeight: '500' }}>A welcome email with login credentials will be automatically sent to the employee</span>
              </div>
            </div>

            <h6 style={{ color: '#059669', fontWeight: '700', marginBottom: '16px', fontSize: '0.95rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              <i className="fas fa-user me-2"></i>Personal Information
            </h6>
            <Row>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label style={{ fontWeight: '600', color: '#064e3b', fontSize: '0.9rem' }}>First Name *</Form.Label>
                  <Form.Control
                    type="text"
                    value={formData.firstName}
                    onChange={(e) => setFormData({...formData, firstName: e.target.value})}
                    required
                    placeholder="Enter first name"
                    style={{ borderRadius: '8px', padding: '10px 14px', border: '2px solid #e0e0e0' }}
                  />
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label style={{ fontWeight: '600', color: '#064e3b', fontSize: '0.9rem' }}>Last Name *</Form.Label>
                  <Form.Control
                    type="text"
                    value={formData.lastName}
                    onChange={(e) => setFormData({...formData, lastName: e.target.value})}
                    required
                    placeholder="Enter last name"
                    style={{ borderRadius: '8px', padding: '10px 14px', border: '2px solid #e0e0e0' }}
                  />
                </Form.Group>
              </Col>
            </Row>

            <Form.Group className="mb-4">
              <Form.Label style={{ fontWeight: '600', color: '#064e3b', fontSize: '0.9rem' }}>Email Address *</Form.Label>
              <Form.Control
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({...formData, email: e.target.value})}
                required
                placeholder="employee@company.com"
                style={{ borderRadius: '8px', padding: '10px 14px', border: '2px solid #e0e0e0' }}
              />
              <Form.Text style={{ color: '#6b7280', fontSize: '0.85rem', marginTop: '6px', display: 'block' }}>
                <i className="fas fa-envelope me-1"></i>
                Login credentials will be sent to this email
              </Form.Text>
            </Form.Group>

            <hr style={{ margin: '24px 0', border: 'none', borderTop: '2px solid #d1fae5' }} />

            <h6 style={{ color: '#059669', fontWeight: '700', marginBottom: '16px', fontSize: '0.95rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              <i className="fas fa-briefcase me-2"></i>Work Information
            </h6>
            <Row>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label style={{ fontWeight: '600', color: '#064e3b', fontSize: '0.9rem' }}>Role *</Form.Label>
                  <Form.Select
                    value={formData.role}
                    onChange={(e) => setFormData({...formData, role: e.target.value})}
                    style={{ borderRadius: '8px', padding: '10px 14px', border: '2px solid #e0e0e0' }}
                  >
                    <option value="EMPLOYEE">Employee</option>
                    <option value="MANAGER">Manager</option>
                    <option value="HR">HR</option>
                    {user.role === 'ADMIN' && <option value="ADMIN">Admin</option>}
                  </Form.Select>
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label style={{ fontWeight: '600', color: '#064e3b', fontSize: '0.9rem' }}>Join Date</Form.Label>
                  <Form.Control
                    type="date"
                    value={formData.joinDate}
                    onChange={(e) => setFormData({...formData, joinDate: e.target.value})}
                    style={{ borderRadius: '8px', padding: '10px 14px', border: '2px solid #e0e0e0' }}
                  />
                </Form.Group>
              </Col>
            </Row>

            <Row>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label style={{ fontWeight: '600', color: '#064e3b', fontSize: '0.9rem' }}>
                    Department {departments.length > 0 && <small className="text-muted">({departments.length} available)</small>}
                  </Form.Label>
                  <Form.Select
                    value={formData.department}
                    onChange={(e) => {
                      console.log('Department selected:', e.target.value);
                      setFormData({...formData, department: e.target.value});
                    }}
                    style={{ borderRadius: '8px', padding: '10px 14px', border: '2px solid #e0e0e0' }}
                  >
                    <option value="">Select Department</option>
                    {departments.length === 0 ? (
                      <option disabled>Loading departments...</option>
                    ) : (
                      departments.map(dept => (
                        <option key={dept._id} value={dept.name}>{dept.name}</option>
                      ))
                    )}
                  </Form.Select>
                  {departments.length === 0 && (
                    <Form.Text style={{ color: '#dc2626', fontSize: '0.85rem', marginTop: '6px', display: 'block' }}>
                      <i className="fas fa-exclamation-triangle me-1"></i>
                      No departments found. Please create departments first.
                    </Form.Text>
                  )}
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label style={{ fontWeight: '600', color: '#064e3b', fontSize: '0.9rem' }}>Designation</Form.Label>
                  <Form.Control
                    type="text"
                    value={formData.designation}
                    onChange={(e) => setFormData({...formData, designation: e.target.value})}
                    placeholder="e.g., Software Developer"
                    style={{ borderRadius: '8px', padding: '10px 14px', border: '2px solid #e0e0e0' }}
                  />
                </Form.Group>
              </Col>
            </Row>
          </Modal.Body>
          <Modal.Footer style={{ background: 'white', borderTop: '2px solid #d1fae5', padding: '16px 30px' }}>
            <Button 
              variant="secondary" 
              onClick={() => setShowAddModal(false)}
              style={{ borderRadius: '8px', padding: '10px 24px', fontWeight: '600' }}
            >
              <i className="fas fa-times me-2"></i>
              Cancel
            </Button>
            <Button 
              variant="primary" 
              type="submit" 
              disabled={loading}
              style={{ 
                background: 'linear-gradient(135deg, #064e3b 0%, #10b981 100%)', 
                border: 'none', 
                borderRadius: '8px', 
                padding: '10px 24px', 
                fontWeight: '600',
                boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)'
              }}
            >
              {loading ? (
                <>
                  <span className="spinner-border spinner-border-sm me-2"></span>
                  Creating...
                </>
              ) : (
                <>
                  <i className="fas fa-user-plus me-2"></i>
                  Create Employee
                </>
              )}
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>
    </div>
  );
};

export default EmployeeManagement;
