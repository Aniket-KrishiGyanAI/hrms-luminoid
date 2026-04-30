import React, { useState, useEffect } from 'react';
import { Table, Badge, Button, Form, Row, Col, Card, Modal } from 'react-bootstrap';
import { toast } from 'react-toastify';
import Swal from 'sweetalert2';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';

const LeaveHistory = () => {
  const { user } = useAuth();
  const [leaves, setLeaves] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [employeeLeaveData, setEmployeeLeaveData] = useState([]);
  const [viewMode, setViewMode] = useState('requests'); // 'requests' or 'summary'
  const [showBalanceModal, setShowBalanceModal] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [balanceUpdate, setBalanceUpdate] = useState({ leaveTypeId: '', allocated: 0 });
  const [leaveTypes, setLeaveTypes] = useState([]);
  const [filters, setFilters] = useState({
    status: '',
    userId: '',
    startDate: '',
    endDate: ''
  });
  const [pagination, setPagination] = useState({
    currentPage: 1,
    totalPages: 1,
    total: 0
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchEmployees();
    fetchEmployeeLeaveData();
    fetchLeaveTypes();
  }, []);

  useEffect(() => {
    fetchAllLeaves();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters, pagination.currentPage]);

  const fetchEmployees = async () => {
    try {
      const response = await api.get('/api/employees');
      setEmployees(response.data || []);
    } catch (error) {
      console.error('Error fetching employees:', error);
    }
  };

  const fetchEmployeeLeaveData = async () => {
    try {
      const response = await api.get('/api/leave-requests/employee-summary');
      setEmployeeLeaveData(response.data || []);
    } catch (error) {
      console.error('Error fetching employee leave data:', error);
    }
  };

  const fetchLeaveTypes = async () => {
    try {
      const response = await api.get('/api/leave-types');
      setLeaveTypes(response.data || []);
    } catch (error) {
      console.error('Error fetching leave types:', error);
    }
  };

  const fetchAllLeaves = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: pagination.currentPage,
        limit: 10,
        ...filters
      });

      const response = await api.get(`/api/leave-requests?${params}`);
      setLeaves(response.data.requests);
      setPagination(prev => ({
        ...prev,
        totalPages: response.data.totalPages,
        total: response.data.total
      }));
    } catch (error) {
      console.error('Error fetching leaves:', error);
      toast.error('Error fetching leave history');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (leave) => {
    const result = await Swal.fire({
      title: 'Delete Leave Request?',
      html: `<p>Employee: <strong>${leave.userId?.firstName} ${leave.userId?.lastName}</strong></p>
             <p>Leave Type: <strong>${leave.leaveTypeId?.name}</strong></p>
             <p>Duration: <strong>${new Date(leave.startDate).toLocaleDateString()} - ${new Date(leave.endDate).toLocaleDateString()}</strong></p>
             <p>Status: <strong>${leave.status}</strong></p>
             <p class="text-danger mt-2">This action cannot be undone and will restore leave balance if applicable!</p>`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#dc3545',
      cancelButtonColor: '#6c757d',
      confirmButtonText: 'Yes, delete it!'
    });

    if (result.isConfirmed) {
      try {
        await api.delete(`/api/leave-requests/${leave._id}`);
        toast.success('Leave request deleted successfully');
        fetchAllLeaves();
      } catch (error) {
        toast.error(error.response?.data?.message || 'Error deleting leave request');
      }
    }
  };

  const getStatusBadge = (leave) => {
    const { status, managerApproval, hrApproval, rejectedBy } = leave;
    const variants = {
      PENDING: 'warning',
      MANAGER_APPROVED: 'info',
      HR_APPROVED: 'success',
      REJECTED: 'danger',
      CANCELLED: 'secondary'
    };

    let displayText = status;

    if (status === 'MANAGER_APPROVED' && managerApproval?.approvedBy) {
      displayText = `Manager Approved`;
    } else if (status === 'HR_APPROVED' && hrApproval?.approvedBy) {
      const approver = hrApproval.approvedBy;
      displayText = `Approved by ${approver.firstName} ${approver.lastName}`;
    } else if (status === 'REJECTED' && rejectedBy) {
      displayText = 'Rejected';
    } else if (status === 'CANCELLED') {
      displayText = 'Cancelled';
    } else if (status === 'PENDING') {
      displayText = 'Pending';
    }

    return (
      <Badge bg={variants[status] || 'secondary'}>
        {displayText}
      </Badge>
    );
  };

  const handleFilterChange = (e) => {
    setFilters(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
    setPagination(prev => ({ ...prev, currentPage: 1 }));
  };

  const clearFilters = () => {
    setFilters({ status: '', userId: '', startDate: '', endDate: '' });
    setPagination(prev => ({ ...prev, currentPage: 1 }));
  };

  const handleUpdateBalance = (employee) => {
    setSelectedEmployee(employee);
    setBalanceUpdate({ leaveTypeId: '', allocated: 0 });
    setShowBalanceModal(true);
  };

  const handleBalanceSubmit = async () => {
    if (!balanceUpdate.leaveTypeId || balanceUpdate.allocated <= 0) {
      toast.error('Please select leave type and enter valid allocation');
      return;
    }

    try {
      await api.post('/api/leave-balances/update', {
        userId: selectedEmployee._id,
        leaveTypeId: balanceUpdate.leaveTypeId,
        allocated: Number(balanceUpdate.allocated),
        year: new Date().getFullYear()
      });
      toast.success('Leave balance updated successfully');
      setShowBalanceModal(false);
      fetchEmployeeLeaveData();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Error updating leave balance');
    }
  };

  return (
    <div className="fade-in-up">
      <div className="page-header">
        <h1 className="page-title">
          <i className="fas fa-history me-3"></i>
          Leave History
        </h1>
        <p className="text-muted mb-0">View and manage all leave requests across the organization</p>
      </div>

      <div className="mb-3">
        <Button 
          variant={viewMode === 'requests' ? 'primary' : 'outline-primary'}
          onClick={() => setViewMode('requests')}
          className="me-2"
        >
          <i className="fas fa-list me-2"></i>
          Leave Requests
        </Button>
        <Button 
          variant={viewMode === 'summary' ? 'primary' : 'outline-primary'}
          onClick={() => setViewMode('summary')}
        >
          <i className="fas fa-chart-bar me-2"></i>
          Employee Summary
        </Button>
      </div>
      
      {viewMode === 'requests' ? (
        <>
          <Card className="table-filters mb-0">
            <Row>
              <Col md={3}>
                <Form.Group>
                  <Form.Label><i className="fas fa-user me-2"></i>Employee</Form.Label>
                  <Form.Select
                    name="userId"
                    value={filters.userId}
                    onChange={handleFilterChange}
                  >
                    <option value="">All Employees</option>
                    {employees.map(emp => (
                      <option key={emp._id} value={emp._id}>
                        {emp.firstName} {emp.lastName}
                      </option>
                    ))}
                  </Form.Select>
                </Form.Group>
              </Col>
              <Col md={2}>
                <Form.Group>
                  <Form.Label><i className="fas fa-filter me-2"></i>Status</Form.Label>
                  <Form.Select
                    name="status"
                    value={filters.status}
                    onChange={handleFilterChange}
                  >
                    <option value="">All Status</option>
                    <option value="PENDING">Pending</option>
                    <option value="MANAGER_APPROVED">Manager Approved</option>
                    <option value="HR_APPROVED">HR Approved</option>
                    <option value="REJECTED">Rejected</option>
                    <option value="CANCELLED">Cancelled</option>
                  </Form.Select>
                </Form.Group>
              </Col>
              <Col md={2}>
                <Form.Group>
                  <Form.Label><i className="fas fa-calendar-alt me-2"></i>From Date</Form.Label>
                  <Form.Control
                    type="date"
                    name="startDate"
                    value={filters.startDate}
                    onChange={handleFilterChange}
                  />
                </Form.Group>
              </Col>
              <Col md={2}>
                <Form.Group>
                  <Form.Label><i className="fas fa-calendar-check me-2"></i>To Date</Form.Label>
                  <Form.Control
                    type="date"
                    name="endDate"
                    value={filters.endDate}
                    onChange={handleFilterChange}
                  />
                </Form.Group>
              </Col>
              <Col md={3} className="d-flex align-items-end">
                <Button 
                  variant="outline-secondary" 
                  onClick={clearFilters}
                  className="w-100"
                >
                  <i className="fas fa-times me-2"></i>
                  Clear Filters
                </Button>
              </Col>
            </Row>
          </Card>

          <Card className="modern-table-wrapper">
        <Card.Body className="p-0">
          {loading ? (
            <div className="table-loading">
              <div className="spinner-border text-primary" role="status"></div>
              <p>Loading leave history...</p>
            </div>
          ) : (
            <>
              <div className="table-responsive">
                <Table className="table">
                  <thead>
                    <tr>
                      <th>Employee</th>
                      <th>Department</th>
                      <th>Leave Type</th>
                      <th>Start Date</th>
                      <th>End Date</th>
                      <th>Days</th>
                      <th>Status</th>
                      <th>Reason</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {leaves.map(leave => (
                      <tr key={leave._id}>
                        <td>
                          <div>
                            <div className="fw-semibold">
                              {leave.userId?.firstName} {leave.userId?.lastName}
                            </div>
                            <small className="text-muted">{leave.userId?.email}</small>
                          </div>
                        </td>
                        <td>
                          <span className="text-muted">{leave.userId?.department || 'N/A'}</span>
                        </td>
                        <td>
                          <div className="d-flex align-items-center">
                            <div 
                              className="table-color-indicator"
                              style={{ backgroundColor: leave.leaveTypeId?.color }}
                            ></div>
                            <span className="fw-semibold">{leave.leaveTypeId?.name}</span>
                          </div>
                        </td>
                        <td>{new Date(leave.startDate).toLocaleDateString()}</td>
                        <td>{new Date(leave.endDate).toLocaleDateString()}</td>
                        <td>
                          <span className="fw-semibold">{leave.days}</span>
                          {leave.isLOP && <Badge bg="warning" className="ms-2">LOP</Badge>}
                        </td>
                        <td>{getStatusBadge(leave)}</td>
                        <td>
                          <span className="text-muted">
                            {leave.reason}
                          </span>
                        </td>
                        <td>
                          {user?.role === 'ADMIN' && (
                            <Button
                              size="sm"
                              variant="outline-danger"
                              onClick={() => handleDelete(leave)}
                              title="Delete leave request"
                            >
                              <i className="fas fa-trash me-1"></i>
                              Delete
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </div>

              {leaves.length === 0 && (
                <div className="table-empty">
                  <i className="fas fa-calendar-times"></i>
                  <p className="mb-0">No leave requests found</p>
                </div>
              )}

              {pagination.totalPages > 1 && (
                <div className="table-pagination">
                  <div>
                    Showing {leaves.length} of {pagination.total} results
                  </div>
                  <div>
                    <Button
                      variant="outline-primary"
                      size="sm"
                      disabled={pagination.currentPage === 1}
                      onClick={() => setPagination(prev => ({ 
                        ...prev, 
                        currentPage: prev.currentPage - 1 
                      }))}
                    >
                      <i className="fas fa-chevron-left"></i>
                    </Button>
                    <span className="mx-3">
                      Page {pagination.currentPage} of {pagination.totalPages}
                    </span>
                    <Button
                      variant="outline-primary"
                      size="sm"
                      disabled={pagination.currentPage === pagination.totalPages}
                      onClick={() => setPagination(prev => ({ 
                        ...prev, 
                        currentPage: prev.currentPage + 1 
                      }))}
                    >
                      <i className="fas fa-chevron-right"></i>
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </Card.Body>
      </Card>
        </>
      ) : (
        <Card className="modern-table-wrapper">
          <Card.Body className="p-0">
            <div className="table-responsive">
              <Table className="table">
                <thead>
                  <tr>
                    <th>Employee</th>
                    <th>Department</th>
                    <th>Email</th>
                    <th>Total Leaves Taken</th>
                    <th>Approved Leaves</th>
                    <th>Pending Leaves</th>
                    <th>Rejected Leaves</th>
                    <th>Leave Balance</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {employeeLeaveData.map(emp => (
                    <tr key={emp._id}>
                      <td>
                        <div className="fw-semibold">
                          {emp.firstName} {emp.lastName}
                        </div>
                      </td>
                      <td>
                        <span className="text-muted">{emp.department || 'N/A'}</span>
                      </td>
                      <td>
                        <small className="text-muted">{emp.email}</small>
                      </td>
                      <td>
                        <span className="fw-semibold">{emp.totalLeavesTaken || 0}</span>
                      </td>
                      <td>
                        <Badge bg="success">{emp.approvedLeaves || 0}</Badge>
                      </td>
                      <td>
                        <Badge bg="warning">{emp.pendingLeaves || 0}</Badge>
                      </td>
                      <td>
                        <Badge bg="danger">{emp.rejectedLeaves || 0}</Badge>
                      </td>
                      <td>
                        <span className="fw-semibold text-primary">{emp.remainingLeaves || 0}</span>
                      </td>
                      <td>
                        {user?.role === 'ADMIN' && (
                          <Button
                            size="sm"
                            variant="outline-primary"
                            onClick={() => handleUpdateBalance(emp)}
                          >
                            <i className="fas fa-edit me-1"></i>
                            Update Balance
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>
            {employeeLeaveData.length === 0 && (
              <div className="table-empty">
                <i className="fas fa-users"></i>
                <p className="mb-0">No employee data found</p>
              </div>
            )}
          </Card.Body>
        </Card>
      )}

      <Modal show={showBalanceModal} onHide={() => setShowBalanceModal(false)}>
        <Modal.Header closeButton>
          <Modal.Title>Update Leave Balance</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {selectedEmployee && (
            <>
              <div className="mb-3">
                <strong>Employee:</strong> {selectedEmployee.firstName} {selectedEmployee.lastName}
              </div>
              <Form.Group className="mb-3">
                <Form.Label>Leave Type</Form.Label>
                <Form.Select
                  value={balanceUpdate.leaveTypeId}
                  onChange={(e) => setBalanceUpdate({ ...balanceUpdate, leaveTypeId: e.target.value })}
                >
                  <option value="">Select Leave Type</option>
                  {leaveTypes.map(type => (
                    <option key={type._id} value={type._id}>{type.name}</option>
                  ))}
                </Form.Select>
              </Form.Group>
              <Form.Group className="mb-3">
                <Form.Label>Allocated Days</Form.Label>
                <Form.Control
                  type="number"
                  min="0"
                  value={balanceUpdate.allocated}
                  onChange={(e) => setBalanceUpdate({ ...balanceUpdate, allocated: e.target.value })}
                  placeholder="Enter allocated days"
                />
              </Form.Group>
            </>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowBalanceModal(false)}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleBalanceSubmit}>
            Update Balance
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default LeaveHistory;
