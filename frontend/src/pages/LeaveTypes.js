import React, { useState, useEffect } from 'react';
import { Table, Button, Modal, Form, Badge, Card } from 'react-bootstrap';
import { toast } from 'react-toastify';
import Swal from 'sweetalert2';
import api from '../utils/api';

const LeaveTypes = () => {
  const [leaveTypes, setLeaveTypes] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editingType, setEditingType] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    accrualType: 'YEARLY',
    accrualRate: '',
    maxPerYear: '',
    carryForward: false,
    maxCarryForward: '',
    lopEnabled: false,
    isPaid: true,
    color: '#007bff'
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchLeaveTypes();
  }, []);

  const fetchLeaveTypes = async () => {
    try {
      const response = await api.get('/api/leave-types');
      setLeaveTypes(response.data);
    } catch (error) {
      console.error('Error fetching leave types:', error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (editingType) {
        await api.put(`/api/leave-types/${editingType._id}`, formData);
        toast.success('Leave type updated successfully');
      } else {
        await api.post('/api/leave-types', formData);
        toast.success('Leave type created successfully');
      }
      
      setShowModal(false);
      resetForm();
      fetchLeaveTypes();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Error saving leave type');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (leaveType) => {
    setEditingType(leaveType);
    setFormData({
      name: leaveType.name,
      description: leaveType.description || '',
      accrualType: leaveType.accrualType,
      accrualRate: leaveType.accrualRate,
      maxPerYear: leaveType.maxPerYear,
      carryForward: leaveType.carryForward,
      maxCarryForward: leaveType.maxCarryForward,
      lopEnabled: leaveType.lopEnabled,
      isPaid: leaveType.isPaid !== undefined ? leaveType.isPaid : true,
      color: leaveType.color
    });
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    const result = await Swal.fire({
      title: 'Delete Leave Type?',
      text: 'This action cannot be undone!',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#dc3545',
      cancelButtonColor: '#6c757d',
      confirmButtonText: 'Yes, delete it!'
    });

    if (result.isConfirmed) {
      try {
        await api.delete(`/api/leave-types/${id}`);
        toast.success('Leave type deleted successfully');
        fetchLeaveTypes();
      } catch (error) {
        toast.error(error.response?.data?.message || 'Error deleting leave type');
      }
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      accrualType: 'YEARLY',
      accrualRate: '',
      maxPerYear: '',
      carryForward: false,
      maxCarryForward: '',
      lopEnabled: false,
      isPaid: true,
      color: '#007bff'
    });
    setEditingType(null);
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  return (
    <div className="fade-in-up">
      <div className="page-header d-flex justify-content-between align-items-center">
        <div>
          <h1 className="page-title">
            <i className="fas fa-tags me-3"></i>
            Leave Types
          </h1>
          <p className="text-muted mb-0">Manage leave type configurations and policies</p>
        </div>
        <Button 
          variant="primary" 
          onClick={() => {
            resetForm();
            setShowModal(true);
          }}
          className="btn-modern"
        >
          <i className="fas fa-plus me-2"></i>
          Add Leave Type
        </Button>
      </div>

      <Card className="modern-table-wrapper">
        <Card.Body className="p-0">
          <div className="table-responsive">
            <Table className="table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Type</th>
                  <th>Accrual Type</th>
                  <th>Accrual Rate</th>
                  <th>Max Per Year</th>
                  <th>Carry Forward</th>
                  <th>LOP Enabled</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {leaveTypes.map(type => (
                  <tr key={type._id}>
                    <td>
                      <div className="d-flex align-items-center">
                        <div 
                          className="table-color-indicator"
                          style={{ backgroundColor: type.color }}
                        ></div>
                        <span className="fw-semibold">{type.name}</span>
                      </div>
                    </td>
                    <td>
                      <Badge 
                        bg={type.isPaid !== false ? 'success' : 'warning'} 
                        className="px-3 py-2"
                        style={{ fontSize: '0.85rem' }}
                      >
                        <i className={`fas fa-${type.isPaid !== false ? 'money-bill-wave' : 'hand-holding-usd'} me-1`}></i>
                        {type.isPaid !== false ? 'Paid' : 'Unpaid'}
                      </Badge>
                    </td>
                    <td>
                      <Badge bg="light" text="dark" className="px-3 py-2">
                        {type.accrualType}
                      </Badge>
                    </td>
                    <td>
                      <span className="fw-semibold">{type.accrualRate}</span> days
                    </td>
                    <td>
                      <span className="fw-semibold">{type.maxPerYear}</span> days
                    </td>
                    <td>
                      {type.carryForward ? (
                        <Badge bg="success" className="px-3 py-2">
                          <i className="fas fa-check me-1"></i>
                          Yes ({type.maxCarryForward} max)
                        </Badge>
                      ) : (
                        <Badge bg="secondary" className="px-3 py-2">
                          <i className="fas fa-times me-1"></i>
                          No
                        </Badge>
                      )}
                    </td>
                    <td>
                      <Badge bg={type.lopEnabled ? 'success' : 'secondary'} className="px-3 py-2">
                        <i className={`fas fa-${type.lopEnabled ? 'check' : 'times'} me-1`}></i>
                        {type.lopEnabled ? 'Yes' : 'No'}
                      </Badge>
                    </td>
                    <td>
                      <Badge bg={type.isActive ? 'success' : 'danger'} className="px-3 py-2">
                        <i className={`fas fa-${type.isActive ? 'check-circle' : 'times-circle'} me-1`}></i>
                        {type.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </td>
                    <td>
                      <div className="d-flex gap-1">
                        <Button
                          size="sm"
                          variant="outline-primary"
                          onClick={() => handleEdit(type)}
                        >
                          <i className="fas fa-edit me-1"></i>
                          Edit
                        </Button>
                        <Button
                          size="sm"
                          variant="outline-danger"
                          onClick={() => handleDelete(type._id)}
                        >
                          <i className="fas fa-trash me-1"></i>
                          Delete
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>
        </Card.Body>
      </Card>

      <Modal show={showModal} onHide={() => setShowModal(false)} size="lg">
        <Modal.Header closeButton>
          <Modal.Title>
            {editingType ? 'Edit Leave Type' : 'Add Leave Type'}
          </Modal.Title>
        </Modal.Header>
        <Form onSubmit={handleSubmit}>
          <Modal.Body>
            <div className="row">
              <div className="col-md-6">
                <Form.Group className="mb-3">
                  <Form.Label>Name</Form.Label>
                  <Form.Control
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    required
                  />
                </Form.Group>
              </div>
              <div className="col-md-6">
                <Form.Group className="mb-3">
                  <Form.Label>Color</Form.Label>
                  <Form.Control
                    type="color"
                    name="color"
                    value={formData.color}
                    onChange={handleChange}
                  />
                </Form.Group>
              </div>
            </div>

            <Form.Group className="mb-3">
              <Form.Label>Description</Form.Label>
              <Form.Control
                as="textarea"
                rows={2}
                name="description"
                value={formData.description}
                onChange={handleChange}
              />
            </Form.Group>

            <div className="row">
              <div className="col-md-6">
                <Form.Group className="mb-3">
                  <Form.Label>Accrual Type</Form.Label>
                  <Form.Select
                    name="accrualType"
                    value={formData.accrualType}
                    onChange={handleChange}
                    required
                  >
                    <option value="YEARLY">Yearly</option>
                    <option value="MONTHLY">Monthly</option>
                  </Form.Select>
                </Form.Group>
              </div>
              <div className="col-md-6">
                <Form.Group className="mb-3">
                  <Form.Label>
                    Accrual Rate (days per {formData.accrualType.toLowerCase()})
                  </Form.Label>
                  <Form.Control
                    type="number"
                    step="0.5"
                    name="accrualRate"
                    value={formData.accrualRate}
                    onChange={handleChange}
                    required
                  />
                </Form.Group>
              </div>
            </div>

            <div className="row">
              <div className="col-md-6">
                <Form.Group className="mb-3">
                  <Form.Label>Max Per Year</Form.Label>
                  <Form.Control
                    type="number"
                    step="0.5"
                    name="maxPerYear"
                    value={formData.maxPerYear}
                    onChange={handleChange}
                    required
                  />
                </Form.Group>
              </div>
              <div className="col-md-6">
                <Form.Group className="mb-3">
                  <Form.Label>Max Carry Forward</Form.Label>
                  <Form.Control
                    type="number"
                    step="0.5"
                    name="maxCarryForward"
                    value={formData.maxCarryForward}
                    onChange={handleChange}
                    disabled={!formData.carryForward}
                  />
                </Form.Group>
              </div>
            </div>

            <div className="row">
              <div className="col-md-6">
                <Form.Group className="mb-3">
                  <Form.Check
                    type="checkbox"
                    name="carryForward"
                    label="Allow Carry Forward"
                    checked={formData.carryForward}
                    onChange={handleChange}
                  />
                </Form.Group>
              </div>
              <div className="col-md-6">
                <Form.Group className="mb-3">
                  <Form.Check
                    type="checkbox"
                    name="lopEnabled"
                    label="Enable LOP (Loss of Pay)"
                    checked={formData.lopEnabled}
                    onChange={handleChange}
                  />
                </Form.Group>
              </div>
            </div>

            <div className="row">
              <div className="col-md-12">
                <Form.Group className="mb-3">
                  <Form.Label className="fw-semibold d-flex align-items-center">
                    <i className="fas fa-money-bill-wave me-2 text-success"></i>
                    Leave Payment Type
                  </Form.Label>
                  <div className="d-flex gap-3 p-3" style={{ background: '#f8f9fa', borderRadius: '8px', border: '1px solid #dee2e6' }}>
                    <Form.Check
                      type="radio"
                      id="paid-leave"
                      name="isPaid"
                      label={
                        <div className="d-flex align-items-center">
                          <i className="fas fa-money-bill-wave me-2 text-success"></i>
                          <div>
                            <div className="fw-semibold">Paid Leave</div>
                            <small className="text-muted">Employee receives full salary</small>
                          </div>
                        </div>
                      }
                      checked={formData.isPaid === true}
                      onChange={() => setFormData({ ...formData, isPaid: true })}
                      className="mb-0"
                    />
                    <Form.Check
                      type="radio"
                      id="unpaid-leave"
                      name="isPaid"
                      label={
                        <div className="d-flex align-items-center">
                          <i className="fas fa-hand-holding-usd me-2 text-warning"></i>
                          <div>
                            <div className="fw-semibold">Unpaid Leave</div>
                            <small className="text-muted">No salary for leave days</small>
                          </div>
                        </div>
                      }
                      checked={formData.isPaid === false}
                      onChange={() => setFormData({ ...formData, isPaid: false })}
                      className="mb-0"
                    />
                  </div>
                  <Form.Text className="text-muted">
                    <i className="fas fa-info-circle me-1"></i>
                    Paid leaves are deducted from employee's leave balance. Unpaid leaves don't affect balance but salary is deducted.
                  </Form.Text>
                </Form.Group>
              </div>
            </div>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={() => setShowModal(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={loading}>
              {loading ? 'Saving...' : 'Save'}
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>
    </div>
  );
};

export default LeaveTypes;