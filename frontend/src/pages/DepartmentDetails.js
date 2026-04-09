import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, Button, Modal, Form, Table, Badge, Container, Row, Col, Tabs, Tab } from 'react-bootstrap';
import api from '../utils/api';
import Swal from 'sweetalert2';
import { SkeletonDashboard } from '../components/Skeleton';
import { useAuth } from '../context/AuthContext';

const DepartmentDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [department, setDepartment] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDepartmentDetails();
  }, [id]);

  useEffect(() => {
    if (department) {
      document.title = `${department.name} - Department Details`;
    }
    return () => {
      document.title = 'HRMS Pro';
    };
  }, [department]);

  const fetchDepartmentDetails = async () => {
    try {
      console.log('Fetching department with ID:', id);
      const res = await api.get(`/api/departments/${id}`);
      console.log('Department response:', res.data);
      setDepartment(res.data.data);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching department:', error);
      Swal.fire('Error', error.response?.data?.message || 'Failed to load department details', 'error');
      setLoading(false);
    }
  };

  const handleRemoveEmployee = async (empId, empName) => {
    const result = await Swal.fire({
      title: 'Remove Employee?',
      text: `Remove ${empName} from ${department.name}?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'Yes, remove'
    });

    if (result.isConfirmed) {
      try {
        await api.delete(`/api/departments/${id}/employees/${empId}`);
        Swal.fire('Removed!', 'Employee removed from department', 'success');
        fetchDepartmentDetails();
      } catch (error) {
        Swal.fire('Error', error.response?.data?.message || 'Error removing employee', 'error');
      }
    }
  };

  if (loading) return (
    <Container fluid className="p-4" style={{background: '#f0fdf4', minHeight: '100vh'}}>
      <SkeletonDashboard />
    </Container>
  );
  if (!department) return (
    <Container fluid className="p-4">
      <div className="text-center p-5">
        <i className="fas fa-exclamation-triangle fa-3x mb-3 text-warning"></i>
        <h5>Department not found</h5>
      </div>
    </Container>
  );

  return (
    <Container fluid className="p-4" style={{background: '#f0fdf4', minHeight: '100vh'}}>
      <style>{`
        .dept-detail-header {
          background: linear-gradient(135deg, #064e3b 0%, #065f46 40%, #10b981 100%);
          border-radius: 16px;
          padding: 32px;
          margin-bottom: 24px;
          box-shadow: 0 10px 30px rgba(16,185,129,0.3);
          color: white;
        }
        .stat-card {
          border: none;
          border-radius: 16px;
          box-shadow: 0 4px 20px rgba(0,0,0,0.08);
          transition: all 0.3s ease;
          overflow: hidden;
        }
        .stat-card:hover {
          transform: translateY(-5px);
          box-shadow: 0 8px 30px rgba(0,0,0,0.12);
        }
        .stat-card-1 { border-top: 4px solid #10b981; }
        .stat-card-2 { border-top: 4px solid #3b82f6; }
        .stat-card-3 { border-top: 4px solid #f59e0b; }
        .stat-card-4 { border-top: 4px solid #ef4444; }
        .stat-icon-1 { color: #10b981; }
        .stat-icon-2 { color: #3b82f6; }
        .stat-icon-3 { color: #f59e0b; }
        .stat-icon-4 { color: #ef4444; }
        .content-card {
          border: none;
          border-radius: 16px;
          box-shadow: 0 4px 20px rgba(0,0,0,0.08);
          overflow: hidden;
        }
        .nav-tabs .nav-link {
          border: none;
          color: #6c757d;
          font-weight: 600;
          padding: 12px 24px;
          transition: all 0.3s ease;
        }
        .nav-tabs .nav-link:hover {
          color: #10b981;
          background: #f0fdf4;
        }
        .nav-tabs .nav-link.active {
          color: #059669;
          background: white;
          border-bottom: 3px solid #10b981;
        }
        .table thead {
          background: linear-gradient(135deg, #064e3b 0%, #10b981 100%);
          color: white;
        }
        .table thead th {
          border: none;
          padding: 16px;
          font-weight: 600;
        }
        .table tbody tr {
          transition: all 0.3s ease;
        }
        .table tbody tr:hover {
          background: #f0fdf4;
          transform: translateX(4px);
        }
        .btn-add-custom {
          background: linear-gradient(135deg, #059669 0%, #10b981 100%);
          border: none;
          color: white;
          font-weight: 600;
          padding: 8px 20px;
          border-radius: 8px;
          transition: all 0.3s ease;
        }
        .btn-add-custom:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 15px rgba(16,185,129,0.4);
        }
        .goal-card {
          border-left: 4px solid #10b981;
          transition: all 0.3s ease;
        }
        .goal-card:hover {
          box-shadow: 0 4px 15px rgba(0,0,0,0.1);
          transform: translateX(4px);
        }
      `}</style>

      <div className="dept-detail-header">
        <Button variant="link" onClick={() => navigate('/departments')} className="text-white p-0 mb-3" style={{textDecoration: 'none'}}>
          <i className="fas fa-arrow-left me-2"></i>Back to Departments
        </Button>
        <div className="d-flex justify-content-between align-items-center">
          <div>
            <h2 className="mb-2 fw-bold">
              <i className="fas fa-building me-3"></i>{department.name}
            </h2>
            <p className="mb-0 opacity-90">
              <i className="fas fa-tag me-2"></i>Code: {department.code}
            </p>
          </div>
          <Badge bg={department.status === 'ACTIVE' ? 'success' : 'danger'} style={{fontSize: '1rem', padding: '10px 20px'}}>
            {department.status}
          </Badge>
        </div>
      </div>

      <Row className="mb-4">
        <Col md={4}>
          <Card className="stat-card stat-card-1 text-center">
            <Card.Body>
              <i className="fas fa-users fa-3x stat-icon-1 mb-3"></i>
              <h3 className="fw-bold">{department.stats.totalEmployees}</h3>
              <p className="text-muted mb-0">Total Employees</p>
            </Card.Body>
          </Card>
        </Col>
        <Col md={4}>
          <Card className="stat-card stat-card-3 text-center">
            <Card.Body>
              <i className="fas fa-file-alt fa-3x stat-icon-3 mb-3"></i>
              <h3 className="fw-bold">{department.stats.totalDocuments}</h3>
              <p className="text-muted mb-0">Documents</p>
            </Card.Body>
          </Card>
        </Col>
        <Col md={4}>
          <Card className="stat-card stat-card-4 text-center">
            <Card.Body>
              <i className="fas fa-sitemap fa-3x stat-icon-4 mb-3"></i>
              <h3 className="fw-bold">{department.stats.subDepartments}</h3>
              <p className="text-muted mb-0">Sub-Departments</p>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      <Tabs defaultActiveKey="employees" className="mb-3">
        <Tab eventKey="employees" title={<span><i className="fas fa-users me-2"></i>Employees ({department.employees.length})</span>}>
          <Card className="content-card">
            <Card.Body>
              <Table responsive hover>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Designation</th>
                    <th>Role</th>
                    <th>Join Date</th>
                    {['ADMIN', 'HR', 'MANAGER'].includes(user?.role) && <th>Action</th>}
                  </tr>
                </thead>
                <tbody>
                  {department.employees.map(emp => (
                    <tr key={emp._id}>
                      <td>
                        <div className="d-flex align-items-center">
                          {emp.profileImage ? (
                            <img src={emp.profileImage} alt="" className="rounded-circle me-2" style={{width: '32px', height: '32px'}} />
                          ) : (
                            <div className="bg-primary rounded-circle d-flex align-items-center justify-content-center me-2" style={{width: '32px', height: '32px'}}>
                              <span className="text-white">{emp.firstName[0]}</span>
                            </div>
                          )}
                          {emp.firstName} {emp.lastName}
                        </div>
                      </td>
                      <td>{emp.email}</td>
                      <td>{emp.designation || '-'}</td>
                      <td><Badge bg="secondary">{emp.role}</Badge></td>
                      <td>{emp.joinDate ? new Date(emp.joinDate).toLocaleDateString() : '-'}</td>
                      {['ADMIN', 'HR', 'MANAGER'].includes(user?.role) && (
                        <td>
                          <Button size="sm" variant="danger" onClick={() => handleRemoveEmployee(emp._id, `${emp.firstName} ${emp.lastName}`)}>
                            <i className="fas fa-trash"></i>
                          </Button>
                        </td>
                      )}
                    </tr>
                  ))}
                  {department.employees.length === 0 && (
                    <tr><td colSpan="5" className="text-center text-muted">No employees assigned</td></tr>
                  )}
                </tbody>
              </Table>
            </Card.Body>
          </Card>
        </Tab>

        <Tab eventKey="info" title={<span><i className="fas fa-info-circle me-2"></i>Information</span>}>
          <Card className="content-card">
            <Card.Body className="p-4">
              <Row>
                <Col md={6}>
                  <p><strong>Code:</strong> {department.code}</p>
                  <p><strong>Location:</strong> {department.location || 'Not specified'}</p>
                  <p><strong>Department Head:</strong> {department.departmentHead ? 
                    `${department.departmentHead.firstName} ${department.departmentHead.lastName}` : 'Not assigned'}</p>
                </Col>
                <Col md={6}>
                  <p><strong>Parent Department:</strong> {department.parentDepartment?.name || 'None'}</p>
                  <p><strong>Created:</strong> {new Date(department.createdAt).toLocaleDateString()}</p>
                  <p><strong>Description:</strong> {department.description || 'No description'}</p>
                </Col>
              </Row>
            </Card.Body>
          </Card>
        </Tab>
      </Tabs>


    </Container>
  );
};

export default DepartmentDetails;
