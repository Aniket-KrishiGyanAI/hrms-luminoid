import React, { useState, useEffect } from 'react';
import { Row, Col, Card, Button, Modal, Form, Table, Badge } from 'react-bootstrap';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import { toast } from 'react-toastify';

const EmployeeManagement = () => {
  const { user } = useAuth();
  const [employees, setEmployees] = useState([]);
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
      await api.post('/api/employee-management/create', formData);
      toast.success('Employee created successfully! Welcome email sent.');
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
        <Button variant="primary" onClick={() => setShowAddModal(true)}>
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
      <Modal show={showAddModal} onHide={() => setShowAddModal(false)} size="lg">
        <Modal.Header closeButton>
          <Modal.Title>Add New Employee</Modal.Title>
        </Modal.Header>
        <Form onSubmit={handleSubmit}>
          <Modal.Body>
            <Row>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>First Name *</Form.Label>
                  <Form.Control
                    type="text"
                    value={formData.firstName}
                    onChange={(e) => setFormData({...formData, firstName: e.target.value})}
                    required
                  />
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Last Name *</Form.Label>
                  <Form.Control
                    type="text"
                    value={formData.lastName}
                    onChange={(e) => setFormData({...formData, lastName: e.target.value})}
                    required
                  />
                </Form.Group>
              </Col>
            </Row>

            <Form.Group className="mb-3">
              <Form.Label>Email *</Form.Label>
              <Form.Control
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({...formData, email: e.target.value})}
                required
              />
              <Form.Text className="text-muted">
                A welcome email with login credentials will be sent to this address
              </Form.Text>
            </Form.Group>

            <Row>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Role *</Form.Label>
                  <Form.Select
                    value={formData.role}
                    onChange={(e) => setFormData({...formData, role: e.target.value})}
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
                  <Form.Label>Join Date</Form.Label>
                  <Form.Control
                    type="date"
                    value={formData.joinDate}
                    onChange={(e) => setFormData({...formData, joinDate: e.target.value})}
                  />
                </Form.Group>
              </Col>
            </Row>

            <Row>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Department</Form.Label>
                  <Form.Control
                    type="text"
                    value={formData.department}
                    onChange={(e) => setFormData({...formData, department: e.target.value})}
                    placeholder="e.g., IT, Sales, HR"
                  />
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Designation</Form.Label>
                  <Form.Control
                    type="text"
                    value={formData.designation}
                    onChange={(e) => setFormData({...formData, designation: e.target.value})}
                    placeholder="e.g., Software Developer"
                  />
                </Form.Group>
              </Col>
            </Row>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={() => setShowAddModal(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" disabled={loading}>
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
