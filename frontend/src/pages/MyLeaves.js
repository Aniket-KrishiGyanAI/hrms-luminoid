import React, { useState, useEffect } from 'react';
import { Table, Badge, Button, Form, Row, Col, Card } from 'react-bootstrap';
import { toast } from 'react-toastify';
import Swal from 'sweetalert2';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';

const MyLeaves = () => {
  const { user } = useAuth();
  const [leaves, setLeaves] = useState([]);
  const [filters, setFilters] = useState({
    status: '',
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
    fetchLeaves();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters, pagination.currentPage]);

  const fetchLeaves = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: pagination.currentPage,
        limit: 10,
        userId: user.id, // Always fetch only current user's leaves
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
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    const result = await Swal.fire({
      title: 'Delete Leave Request?',
      text: 'This action cannot be undone and will restore leave balance if applicable!',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#dc3545',
      cancelButtonColor: '#6c757d',
      confirmButtonText: 'Yes, delete it!'
    });

    if (result.isConfirmed) {
      try {
        await api.delete(`/api/leave-requests/${id}`);
        toast.success('Leave request deleted successfully');
        fetchLeaves();
      } catch (error) {
        toast.error(error.response?.data?.message || 'Error deleting leave request');
      }
    }
  };

  const handleCancel = async (id) => {
    const result = await Swal.fire({
      title: 'Cancel Leave Request?',
      text: 'This action cannot be undone!',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#dc3545',
      cancelButtonColor: '#6c757d',
      confirmButtonText: 'Yes, cancel it!'
    });

    if (result.isConfirmed) {
      try {
        await api.put(`/api/leave-requests/${id}/cancel`);
        toast.success('Leave request cancelled successfully');
        fetchLeaves();
      } catch (error) {
        toast.error(error.response?.data?.message || 'Error cancelling leave request');
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
    let approverName = '';

    if (status === 'MANAGER_APPROVED' && managerApproval?.approvedBy) {
      approverName = `${managerApproval.approvedBy.firstName} ${managerApproval.approvedBy.lastName}`;
      displayText = `Approved by ${approverName}`;
    } else if (status === 'HR_APPROVED' && hrApproval?.approvedBy) {
      approverName = `${hrApproval.approvedBy.firstName} ${hrApproval.approvedBy.lastName}`;
      displayText = `Approved by ${approverName}`;
    } else if (status === 'REJECTED' && rejectedBy) {
      const rejectorName = `${rejectedBy.firstName} ${rejectedBy.lastName}`;
      displayText = `Rejected by ${rejectorName}`;
    } else if (status === 'REJECTED') {
      displayText = 'Rejected';
    } else if (status === 'CANCELLED') {
      displayText = 'Cancelled';
    } else if (status === 'PENDING') {
      displayText = 'Pending';
    }

    return (
      <Badge bg={variants[status] || 'secondary'} title={displayText}>
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

  return (
    <div className="fade-in-up">
      <div className="page-header">
        <h1 className="page-title">
          <i className="fas fa-calendar-alt me-3"></i>
          My Leave Requests
        </h1>
        <p className="text-muted mb-0">View and manage your leave applications</p>
      </div>
      
      <Card className="table-filters mb-0">
        <Row>
          <Col md={3}>
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
          <Col md={3}>
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
          <Col md={3}>
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
              onClick={() => {
                setFilters({ status: '', startDate: '', endDate: '' });
                setPagination(prev => ({ ...prev, currentPage: 1 }));
              }}
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
              <p>Loading leave requests...</p>
            </div>
          ) : (
            <>
              <div className="table-responsive">
                <Table className="table">
                  <thead>
                    <tr>
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
                          <span className="text-muted" title={leave.reason}>
                            {leave.reason?.length > 30 ? leave.reason.substring(0, 30) + '...' : leave.reason}
                          </span>
                        </td>
                        <td>
                          <div className="d-flex gap-1">
                            {leave.status === 'PENDING' && (
                              <Button
                                size="sm"
                                variant="outline-danger"
                                onClick={() => handleCancel(leave._id)}
                              >
                                <i className="fas fa-times me-1"></i>
                                Cancel
                              </Button>
                            )}
                            {user?.role === 'ADMIN' && (
                              <Button
                                size="sm"
                                variant="outline-danger"
                                onClick={() => handleDelete(leave._id)}
                                title="Admin: Delete leave request"
                              >
                                <i className="fas fa-trash me-1"></i>
                                Delete
                              </Button>
                            )}
                          </div>
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
    </div>
  );
};

export default MyLeaves;