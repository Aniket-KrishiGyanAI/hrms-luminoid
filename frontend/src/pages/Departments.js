import React, { useState, useEffect } from 'react';
import { Card, Button, Modal, Form, Table, Badge, Container, Row, Col, Pagination } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import api from '../utils/api';
import Swal from 'sweetalert2';
import { SkeletonTable } from '../components/Skeleton';

const Departments = () => {
  const navigate = useNavigate();
  const [departments, setDepartments] = useState([]);
  const [filteredDepartments, setFilteredDepartments] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [selectedDept, setSelectedDept] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterLocation, setFilterLocation] = useState('');
  const [filterHead, setFilterHead] = useState('');
  const [selectedRows, setSelectedRows] = useState([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [sortField, setSortField] = useState('name');
  const [sortOrder, setSortOrder] = useState('asc');
  const [formData, setFormData] = useState({
    name: '', code: '', description: '', departmentHead: '', 
    parentDepartment: '', location: ''
  });
  const [assignData, setAssignData] = useState({ employeeId: '', departmentId: '' });
  const [bulkData, setBulkData] = useState({ employeeIds: [], departmentId: '' });
  const [transferData, setTransferData] = useState({ employeeIds: [], fromDepartmentId: '', toDepartmentId: '' });
  const [importFile, setImportFile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchDepartments();
    fetchEmployees();
  }, [page, sortField, sortOrder, searchTerm, filterStatus, filterLocation, filterHead]);

  useEffect(() => {
    let filtered = departments;
    if (searchTerm) {
      filtered = filtered.filter(d => 
        d.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        d.code.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    if (filterStatus) filtered = filtered.filter(d => d.status === filterStatus);
    if (filterLocation) filtered = filtered.filter(d => d.location === filterLocation);
    if (filterHead) filtered = filtered.filter(d => d.departmentHead?._id === filterHead);
    setFilteredDepartments(filtered);
  }, [departments, searchTerm, filterStatus, filterLocation, filterHead]);

  const fetchDepartments = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page,
        limit: 10,
        sort: sortField,
        order: sortOrder
      });
      if (searchTerm) params.append('search', searchTerm);
      if (filterStatus) params.append('status', filterStatus);
      if (filterLocation) params.append('location', filterLocation);
      if (filterHead) params.append('departmentHead', filterHead);
      
      const res = await api.get(`/api/departments?${params}`);
      setDepartments(res.data.data);
      setFilteredDepartments(res.data.data);
      setTotalPages(res.data.pagination.pages);
    } catch (error) {
      console.error('Error fetching departments:', error);
      Swal.fire('Error', 'Failed to load departments', 'error');
    } finally {
      setLoading(false);
    }
  };

  const fetchEmployees = async () => {
    try {
      const res = await api.get('/api/departments/employees-for-transfer');
      setEmployees(res.data.data || res.data);
    } catch (error) {
      console.error('Error fetching employees:', error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (selectedDept) {
        await api.put(`/api/departments/${selectedDept._id}`, formData);
        Swal.fire('Updated!', 'Department updated successfully', 'success');
      } else {
        await api.post('/api/departments', formData);
        Swal.fire('Created!', 'Department created successfully', 'success');
      }
      fetchDepartments();
      resetForm();
    } catch (error) {
      Swal.fire('Error', error.response?.data?.message || 'Error saving department', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    const result = await Swal.fire({
      title: 'Delete Department?',
      text: 'This action cannot be undone',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'Yes, delete it'
    });
    
    if (result.isConfirmed) {
      try {
        await api.delete(`/api/departments/${id}`);
        Swal.fire('Deleted!', 'Department deleted successfully', 'success');
        fetchDepartments();
      } catch (error) {
        Swal.fire('Error', error.response?.data?.message || 'Error deleting department', 'error');
      }
    }
  };

  const handleAssign = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.post('/api/departments/assign', assignData);
      Swal.fire('Success!', 'Employee assigned successfully', 'success');
      setShowAssignModal(false);
      setAssignData({ employeeId: '', departmentId: '' });
      fetchDepartments();
    } catch (error) {
      Swal.fire('Error', error.response?.data?.message || 'Error assigning employee', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleBulkAssign = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.post('/api/departments/bulk-assign', bulkData);
      Swal.fire('Success!', `${bulkData.employeeIds.length} employees assigned successfully`, 'success');
      setShowBulkModal(false);
      setBulkData({ employeeIds: [], departmentId: '' });
      fetchDepartments();
    } catch (error) {
      Swal.fire('Error', error.response?.data?.message || 'Error in bulk assignment', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleBulkStatusChange = async (status) => {
    if (selectedRows.length === 0) {
      Swal.fire('Warning', 'Please select departments first', 'warning');
      return;
    }
    try {
      await api.post('/api/departments/bulk-status', { departmentIds: selectedRows, status });
      Swal.fire('Updated!', `${selectedRows.length} departments updated`, 'success');
      setSelectedRows([]);
      fetchDepartments();
    } catch (error) {
      Swal.fire('Error', 'Error updating departments', 'error');
    }
  };

  const handleBulkDelete = async () => {
    if (selectedRows.length === 0) {
      Swal.fire('Warning', 'Please select departments first', 'warning');
      return;
    }
    const result = await Swal.fire({
      title: 'Delete Departments?',
      text: `Delete ${selectedRows.length} departments?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'Yes, delete them'
    });
    
    if (result.isConfirmed) {
      try {
        await api.post('/api/departments/bulk-delete', { departmentIds: selectedRows });
        Swal.fire('Deleted!', `${selectedRows.length} departments deleted`, 'success');
        setSelectedRows([]);
        fetchDepartments();
      } catch (error) {
        Swal.fire('Error', error.response?.data?.message || 'Error deleting departments', 'error');
      }
    }
  };

  const handleTransfer = async (e) => {
    e.preventDefault();
    if (transferData.fromDepartmentId === transferData.toDepartmentId) {
      Swal.fire('Error', 'Source and target departments cannot be the same', 'error');
      return;
    }
    if (transferData.employeeIds.length === 0) {
      Swal.fire('Error', 'Please select at least one employee', 'error');
      return;
    }
    setSubmitting(true);
    try {
      await api.post('/api/departments/transfer', transferData);
      Swal.fire('Success!', `${transferData.employeeIds.length} employee(s) transferred successfully`, 'success');
      setShowTransferModal(false);
      setTransferData({ employeeIds: [], fromDepartmentId: '', toDepartmentId: '' });
      fetchDepartments();
      fetchEmployees();
    } catch (error) {
      Swal.fire('Error', error.response?.data?.message || 'Error transferring employees', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleImport = async (e) => {
    e.preventDefault();
    if (!importFile) {
      Swal.fire('Warning', 'Please select a file', 'warning');
      return;
    }
    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('file', importFile);
      const res = await api.post('/api/departments/import', formData);
      Swal.fire('Success!', `Imported ${res.data.results.success.length} departments`, 'success');
      if (res.data.results.errors.length > 0) {
        Swal.fire('Warning', `${res.data.results.errors.length} errors occurred`, 'warning');
      }
      setShowImportModal(false);
      setImportFile(null);
      fetchDepartments();
    } catch (error) {
      Swal.fire('Error', 'Error importing departments', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSort = (field) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  const toggleRowSelection = (id) => {
    setSelectedRows(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedRows.length === filteredDepartments.length) {
      setSelectedRows([]);
    } else {
      setSelectedRows(filteredDepartments.map(d => d._id));
    }
  };

  const resetForm = () => {
    setFormData({ name: '', code: '', description: '', departmentHead: '', 
      parentDepartment: '', location: '' });
    setSelectedDept(null);
    setShowModal(false);
  };

  const editDepartment = (dept) => {
    setSelectedDept(dept);
    setFormData({
      name: dept.name,
      code: dept.code,
      description: dept.description || '',
      departmentHead: dept.departmentHead?._id || '',
      parentDepartment: dept.parentDepartment?._id || '',
      location: dept.location || ''
    });
    setShowModal(true);
  };

  const exportToExcel = (selectedDepts = null) => {
    const dataToExport = selectedDepts || filteredDepartments;
    const data = dataToExport.map(d => ({
      Code: d.code,
      Name: d.name,
      Head: d.departmentHead ? `${d.departmentHead.firstName} ${d.departmentHead.lastName}` : 'N/A',
      Location: d.location || 'N/A',
      Employees: d.employeeCount,
      Status: d.status
    }));
    const csv = [
      Object.keys(data[0]).join(','),
      ...data.map(row => Object.values(row).join(','))
    ].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `departments_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    Swal.fire('Success!', 'Report exported successfully', 'success');
    setShowExportModal(false);
  };

  const uniqueLocations = [...new Set(departments.map(d => d.location).filter(Boolean))].sort();

  return (
    <Container fluid className="p-4" style={{ background: '#f0fdf4', minHeight: '100vh' }}>
      <style>{`
        .dept-header {
          background: linear-gradient(135deg, #064e3b 0%, #065f46 40%, #10b981 100%);
          border-radius: 16px;
          padding: 32px;
          margin-bottom: 24px;
          box-shadow: 0 10px 30px rgba(16,185,129,0.3);
        }
        .dept-card {
          border: none;
          border-radius: 16px;
          box-shadow: 0 4px 20px rgba(0,0,0,0.08);
          overflow: hidden;
          background: white;
        }
        .dept-table thead {
          background: linear-gradient(135deg, #064e3b 0%, #10b981 100%);
          color: white;
        }
        .dept-table thead th {
          border: none;
          padding: 16px;
          font-weight: 600;
          text-transform: uppercase;
          font-size: 0.8rem;
          letter-spacing: 0.8px;
        }
        .dept-table tbody tr {
          transition: all 0.3s ease;
          border-bottom: 1px solid #f0fdf4;
        }
        .dept-table tbody tr:hover {
          background: linear-gradient(to right, #f0fdf4 0%, #fff 100%);
          transform: translateX(4px);
          box-shadow: -4px 0 0 #10b981;
        }
        .dept-table tbody td {
          padding: 18px 16px;
          vertical-align: middle;
        }
        .btn-primary-custom {
          background: linear-gradient(135deg, #064e3b 0%, #10b981 100%);
          border: none;
          padding: 10px 24px;
          border-radius: 10px;
          font-weight: 600;
          color: white;
          transition: all 0.3s ease;
          box-shadow: 0 4px 15px rgba(16,185,129,0.3);
        }
        .btn-primary-custom:hover {
          transform: translateY(-2px);
          box-shadow: 0 6px 25px rgba(16,185,129,0.5);
        }
        .btn-success-custom {
          background: linear-gradient(135deg, #059669 0%, #10b981 100%);
          border: none;
          padding: 10px 24px;
          border-radius: 10px;
          font-weight: 600;
          color: white;
          transition: all 0.3s ease;
          box-shadow: 0 4px 15px rgba(5, 150, 105, 0.3);
        }
        .btn-success-custom:hover {
          transform: translateY(-2px);
          box-shadow: 0 6px 25px rgba(5, 150, 105, 0.5);
        }
        .btn-info-custom {
          background: linear-gradient(135deg, #0891b2 0%, #06b6d4 100%);
          border: none;
          padding: 10px 24px;
          border-radius: 10px;
          font-weight: 600;
          color: white;
          transition: all 0.3s ease;
          box-shadow: 0 4px 15px rgba(8, 145, 178, 0.3);
        }
        .btn-info-custom:hover {
          transform: translateY(-2px);
          box-shadow: 0 6px 25px rgba(8, 145, 178, 0.5);
        }
        .btn-warning-custom {
          background: linear-gradient(135deg, #d97706 0%, #f59e0b 100%);
          border: none;
          padding: 10px 24px;
          border-radius: 10px;
          font-weight: 600;
          color: white;
          transition: all 0.3s ease;
          box-shadow: 0 4px 15px rgba(217, 119, 6, 0.3);
        }
        .btn-warning-custom:hover {
          transform: translateY(-2px);
          box-shadow: 0 6px 25px rgba(217, 119, 6, 0.5);
        }
        .btn-secondary-custom {
          background: linear-gradient(135deg, #475569 0%, #64748b 100%);
          border: none;
          padding: 10px 24px;
          border-radius: 10px;
          font-weight: 600;
          color: white;
          transition: all 0.3s ease;
          box-shadow: 0 4px 15px rgba(71, 85, 105, 0.3);
        }
        .btn-secondary-custom:hover {
          transform: translateY(-2px);
          box-shadow: 0 6px 25px rgba(71, 85, 105, 0.5);
        }
        .btn-export-custom {
          background: linear-gradient(135deg, #065f46 0%, #34d399 100%);
          border: none;
          padding: 10px 24px;
          border-radius: 10px;
          font-weight: 600;
          color: white;
          transition: all 0.3s ease;
          box-shadow: 0 4px 15px rgba(16,185,129,0.3);
        }
        .btn-export-custom:hover {
          transform: translateY(-2px);
          box-shadow: 0 6px 25px rgba(16,185,129,0.5);
        }
        .badge-code {
          background: linear-gradient(135deg, #064e3b 0%, #10b981 100%);
          padding: 8px 14px;
          border-radius: 8px;
          font-weight: 600;
          font-size: 0.85rem;
        }
        .badge-count {
          background: linear-gradient(135deg, #059669 0%, #34d399 100%);
          padding: 8px 14px;
          border-radius: 8px;
          font-weight: 600;
          font-size: 0.85rem;
        }
        .action-btn-view {
          background: linear-gradient(135deg, #0891b2 0%, #06b6d4 100%);
          border: none;
          padding: 8px 16px;
          border-radius: 8px;
          color: white;
          transition: all 0.3s ease;
        }
        .action-btn-view:hover {
          transform: scale(1.1);
          box-shadow: 0 4px 15px rgba(8, 145, 178, 0.4);
        }
        .action-btn-edit {
          background: linear-gradient(135deg, #059669 0%, #10b981 100%);
          border: none;
          padding: 8px 16px;
          border-radius: 8px;
          color: white;
          transition: all 0.3s ease;
        }
        .action-btn-edit:hover {
          transform: scale(1.1);
          box-shadow: 0 4px 15px rgba(5, 150, 105, 0.4);
        }
        .action-btn-delete {
          background: linear-gradient(135deg, #dc2626 0%, #ef4444 100%);
          border: none;
          padding: 8px 16px;
          border-radius: 8px;
          color: white;
          transition: all 0.3s ease;
        }
        .action-btn-delete:hover {
          transform: scale(1.1);
          box-shadow: 0 4px 15px rgba(220, 38, 38, 0.4);
        }
        .filter-card {
          background: linear-gradient(to right, #f0fdf4 0%, #ffffff 100%);
          border: 1px solid #d1fae5;
          border-radius: 12px;
        }
      `}</style>

      <div className="dept-header text-white">
        <Row className="align-items-center">
          <Col md={8}>
            <h2 className="mb-2 fw-bold">
              <i className="fas fa-sitemap me-3"></i>Department Management
            </h2>
            <p className="mb-0 opacity-90">
              <i className="fas fa-building me-2"></i>
              {filteredDepartments.length} of {departments.length} Departments
            </p>
          </Col>
          <Col md={4} className="text-md-end">
            <div className="d-flex flex-wrap gap-2 justify-content-md-end">
              <Button className="btn-primary-custom" size="sm" onClick={() => setShowModal(true)}>
                <i className="fas fa-plus me-2"></i>Add
              </Button>
              <Button className="btn-success-custom" size="sm" onClick={() => setShowAssignModal(true)}>
                <i className="fas fa-user-plus me-2"></i>Assign
              </Button>
              <Button className="btn-info-custom" size="sm" onClick={() => setShowBulkModal(true)}>
                <i className="fas fa-users me-2"></i>Bulk
              </Button>
              <Button className="btn-warning-custom" size="sm" onClick={() => setShowTransferModal(true)}>
                <i className="fas fa-exchange-alt me-2"></i>Transfer
              </Button>
              <Button className="btn-secondary-custom" size="sm" onClick={() => setShowImportModal(true)}>
                <i className="fas fa-file-import me-2"></i>Import
              </Button>
              <Button className="btn-export-custom" size="sm" onClick={() => setShowExportModal(true)}>
                <i className="fas fa-download me-2"></i>Export
              </Button>
            </div>
          </Col>
        </Row>
      </div>

      <Card className="dept-card mb-3 filter-card">
        <Card.Body>
          <Row className="g-3">
            <Col md={3}>
              <Form.Control
                type="text"
                placeholder="🔍 Search by name or code..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{ borderRadius: '10px', border: '2px solid #e8e8e8' }}
              />
            </Col>
            <Col md={2}>
              <Form.Select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} style={{ borderRadius: '10px', border: '2px solid #e8e8e8' }}>
                <option value="">All Status</option>
                <option value="ACTIVE">Active</option>
                <option value="INACTIVE">Inactive</option>
              </Form.Select>
            </Col>
            <Col md={2}>
              <Form.Select value={filterLocation} onChange={(e) => setFilterLocation(e.target.value)} style={{ borderRadius: '10px', border: '2px solid #e8e8e8' }}>
                <option value="">All Locations</option>
                {uniqueLocations.map(loc => <option key={loc} value={loc}>{loc}</option>)}
              </Form.Select>
            </Col>
            <Col md={2}>
              <Form.Select value={filterHead} onChange={(e) => setFilterHead(e.target.value)} style={{ borderRadius: '10px', border: '2px solid #e8e8e8' }}>
                <option value="">All Heads</option>
                {employees
                  .filter(emp => departments.some(d => d.departmentHead?._id === emp._id))
                  .map(emp => <option key={emp._id} value={emp._id}>{emp.firstName} {emp.lastName}</option>)}
              </Form.Select>
            </Col>
            <Col md={3}>
              <div className="d-flex gap-2">
                <Button className="btn-secondary-custom" onClick={() => { setSearchTerm(''); setFilterStatus(''); setFilterLocation(''); setFilterHead(''); }}>
                  <i className="fas fa-redo"></i>
                </Button>
                {selectedRows.length > 0 && (
                  <>
                    <Button className="btn-success-custom" size="sm" onClick={() => handleBulkStatusChange('ACTIVE')} style={{padding: '6px 12px', fontSize: '0.75rem'}}>
                      Activate
                    </Button>
                    <Button className="btn-warning-custom" size="sm" onClick={() => handleBulkStatusChange('INACTIVE')} style={{padding: '6px 12px', fontSize: '0.75rem'}}>
                      Disable
                    </Button>
                    <Button className="action-btn-delete" size="sm" onClick={handleBulkDelete} style={{padding: '6px 12px', fontSize: '0.75rem'}}>
                      Delete
                    </Button>
                  </>
                )}
              </div>
            </Col>
          </Row>
        </Card.Body>
      </Card>

      <Card className="dept-card">
        <Card.Body className="p-0">
          {loading ? (
            <SkeletonTable rows={10} columns={8} />
          ) : (
          <Table responsive className="dept-table mb-0">
            <thead>
              <tr>
                <th>
                  <Form.Check 
                    type="checkbox" 
                    checked={selectedRows.length === filteredDepartments.length && filteredDepartments.length > 0}
                    onChange={toggleSelectAll}
                  />
                </th>
                <th onClick={() => handleSort('code')} style={{cursor: 'pointer'}}>
                  Code {sortField === 'code' && <i className={`fas fa-sort-${sortOrder === 'asc' ? 'up' : 'down'}`}></i>}
                </th>
                <th onClick={() => handleSort('name')} style={{cursor: 'pointer'}}>
                  Department Name {sortField === 'name' && <i className={`fas fa-sort-${sortOrder === 'asc' ? 'up' : 'down'}`}></i>}
                </th>
                <th>Department Head</th>
                <th>Location</th>
                <th onClick={() => handleSort('employeeCount')} style={{cursor: 'pointer'}}>
                  Employees {sortField === 'employeeCount' && <i className={`fas fa-sort-${sortOrder === 'asc' ? 'up' : 'down'}`}></i>}
                </th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredDepartments.map(dept => (
                <tr key={dept._id} onClick={() => navigate(`/departments/${dept._id}`)} style={{cursor: 'pointer'}}>
                  <td onClick={(e) => e.stopPropagation()}>
                    <Form.Check 
                      type="checkbox" 
                      checked={selectedRows.includes(dept._id)}
                      onChange={() => toggleRowSelection(dept._id)}
                    />
                  </td>
                  <td><Badge className="badge-code">{dept.code}</Badge></td>
                  <td><strong style={{ color: '#065f46' }}>{dept.name}</strong></td>
                  <td>
                    {dept.departmentHead ? (
                      <div style={{ color: '#555' }}>
                        <i className="fas fa-user-tie me-2" style={{ color: '#059669' }}></i>
                        {dept.departmentHead.firstName} {dept.departmentHead.lastName}
                      </div>
                    ) : <span className="text-muted">Not Assigned</span>}
                  </td>
                  <td>
                    {dept.location ? (
                      <span>
                        <i className="fas fa-map-marker-alt me-2" style={{ color: '#059669' }}></i>
                        {dept.location}
                      </span>
                    ) : <span className="text-muted">-</span>}
                  </td>
                  <td>
                    <Badge className="badge-count">{dept.employeeCount}</Badge>
                  </td>
                  <td>
                    <Badge bg={dept.status === 'ACTIVE' ? 'success' : 'danger'} style={{ padding: '6px 12px', borderRadius: '6px' }}>
                      {dept.status}
                    </Badge>
                  </td>
                  <td onClick={(e) => e.stopPropagation()}>
                    <Button className="action-btn-view me-2" size="sm" onClick={() => navigate(`/departments/${dept._id}`)} title="View Details">
                      <i className="fas fa-eye"></i>
                    </Button>
                    <Button className="action-btn-edit me-2" size="sm" onClick={() => editDepartment(dept)} title="Edit">
                      <i className="fas fa-edit"></i>
                    </Button>
                    <Button className="action-btn-delete" size="sm" onClick={() => handleDelete(dept._id)} title="Delete">
                      <i className="fas fa-trash"></i>
                    </Button>
                  </td>
                </tr>
              ))}
              {filteredDepartments.length === 0 && (
                <tr>
                  <td colSpan="8" className="text-center py-5">
                    <i className="fas fa-inbox fa-3x mb-3" style={{ color: '#10b981', opacity: 0.3 }}></i>
                    <h5 className="text-muted">No departments found</h5>
                    <p className="text-muted">Try adjusting your filters</p>
                  </td>
                </tr>
              )}
            </tbody>
          </Table>
          )}
        </Card.Body>
      </Card>

      {totalPages > 1 && (
        <div className="d-flex justify-content-center mt-3">
          <Pagination>
            <Pagination.First onClick={() => setPage(1)} disabled={page === 1} />
            <Pagination.Prev onClick={() => setPage(page - 1)} disabled={page === 1} />
            {[...Array(totalPages)].map((_, i) => (
              <Pagination.Item key={i + 1} active={page === i + 1} onClick={() => setPage(i + 1)}>
                {i + 1}
              </Pagination.Item>
            ))}
            <Pagination.Next onClick={() => setPage(page + 1)} disabled={page === totalPages} />
            <Pagination.Last onClick={() => setPage(totalPages)} disabled={page === totalPages} />
          </Pagination>
        </div>
      )}

      {/* Add/Edit Modal */}
      <Modal show={showModal} onHide={resetForm} centered size="lg">
        <Modal.Header closeButton style={{ background: 'linear-gradient(135deg, #064e3b 0%, #10b981 100%)', color: 'white', border: 'none' }}>
          <Modal.Title className="fw-bold">
            <i className="fas fa-building me-2"></i>
            {selectedDept ? 'Edit Department' : 'Add New Department'}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body style={{ padding: '40px', background: '#f0fdf4' }}>
          <Form onSubmit={handleSubmit}>
            <Row>
              <Col md={6}>
                <Form.Group className="mb-4">
                  <Form.Label className="fw-bold" style={{color: '#059669'}}>
                    <i className="fas fa-tag me-2"></i>Department Name *
                  </Form.Label>
                  <Form.Control
                    type="text"
                    placeholder="e.g., Human Resources"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                    style={{ borderRadius: '10px', padding: '12px', border: '2px solid #e0e0e0', fontSize: '15px' }}
                  />
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group className="mb-4">
                  <Form.Label className="fw-bold" style={{color: '#059669'}}>
                    <i className="fas fa-code me-2"></i>Department Code *
                  </Form.Label>
                  <Form.Control
                    type="text"
                    placeholder="e.g., HR"
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                    required
                    style={{ borderRadius: '10px', padding: '12px', border: '2px solid #e0e0e0', fontSize: '15px' }}
                  />
                </Form.Group>
              </Col>
            </Row>
            <Form.Group className="mb-4">
              <Form.Label className="fw-bold" style={{color: '#059669'}}>
                <i className="fas fa-align-left me-2"></i>Description
              </Form.Label>
              <Form.Control
                as="textarea"
                rows={3}
                placeholder="Brief description of the department"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                style={{ borderRadius: '10px', padding: '12px', border: '2px solid #e0e0e0', fontSize: '15px' }}
              />
            </Form.Group>
            <Row>
              <Col md={6}>
                <Form.Group className="mb-4">
                  <Form.Label className="fw-bold" style={{color: '#059669'}}>
                    <i className="fas fa-user-tie me-2"></i>Department Head
                  </Form.Label>
                  <Form.Select
                    value={formData.departmentHead}
                    onChange={(e) => setFormData({ ...formData, departmentHead: e.target.value })}
                    style={{ borderRadius: '10px', padding: '12px', border: '2px solid #e0e0e0', fontSize: '15px' }}
                  >
                    <option value="">Select Department Head</option>
                    {employees.map(emp => (
                      <option key={emp._id} value={emp._id}>
                        {emp.firstName} {emp.lastName}
                      </option>
                    ))}
                  </Form.Select>
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group className="mb-4">
                  <Form.Label className="fw-bold" style={{color: '#059669'}}>
                    <i className="fas fa-sitemap me-2"></i>Parent Department
                  </Form.Label>
                  <Form.Select
                    value={formData.parentDepartment}
                    onChange={(e) => setFormData({ ...formData, parentDepartment: e.target.value })}
                    style={{ borderRadius: '10px', padding: '12px', border: '2px solid #e0e0e0', fontSize: '15px' }}
                  >
                    <option value="">Select Parent Department</option>
                    {departments.filter(d => d._id !== selectedDept?._id).map(dept => (
                      <option key={dept._id} value={dept._id}>{dept.name}</option>
                    ))}
                  </Form.Select>
                </Form.Group>
              </Col>
            </Row>
            <Form.Group className="mb-4">
              <Form.Label className="fw-bold" style={{color: '#059669'}}>
                <i className="fas fa-map-marker-alt me-2"></i>Location
              </Form.Label>
              <Form.Select
                value={formData.location}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                style={{ borderRadius: '10px', padding: '12px', border: '2px solid #e0e0e0', fontSize: '15px' }}
              >
                <option value="">Select Location</option>
                <option value="Office">Office</option>
                <option value="Remote">Remote</option>
              </Form.Select>
            </Form.Group>
            <div className="d-flex gap-3 justify-content-end mt-4">
              <Button onClick={resetForm} style={{ background: 'linear-gradient(135deg, #868f96 0%, #596164 100%)', border: 'none', borderRadius: '10px', padding: '12px 30px', fontWeight: '600', color: 'white' }}>
                <i className="fas fa-times me-2"></i>Cancel
              </Button>
              <Button type="submit" disabled={submitting} style={{ background: 'linear-gradient(135deg, #064e3b 0%, #10b981 100%)', border: 'none', borderRadius: '10px', padding: '12px 30px', fontWeight: '600', color: 'white', boxShadow: '0 4px 15px rgba(16,185,129,0.4)' }}>
                {submitting ? <><span className="spinner-border spinner-border-sm me-2"></span>Saving...</> : <><i className="fas fa-save me-2"></i>Save Department</>}
              </Button>
            </div>
          </Form>
        </Modal.Body>
      </Modal>

      {/* Assign Employee Modal */}
      <Modal show={showAssignModal} onHide={() => setShowAssignModal(false)} centered>
        <Modal.Header closeButton style={{ background: 'linear-gradient(135deg, #064e3b 0%, #10b981 100%)', color: 'white', border: 'none' }}>
          <Modal.Title>
            <i className="fas fa-user-plus me-2"></i>
            Assign Employee to Department
          </Modal.Title>
        </Modal.Header>
        <Modal.Body style={{ padding: '30px' }}>
          <Form onSubmit={handleAssign}>
            <Form.Group className="mb-3">
              <Form.Label className="fw-semibold">Select Employee *</Form.Label>
              <Form.Select
                value={assignData.employeeId}
                onChange={(e) => setAssignData({ ...assignData, employeeId: e.target.value })}
                required
                style={{ borderRadius: '8px', padding: '10px' }}
              >
                <option value="">Choose an employee</option>
                {employees.map(emp => (
                  <option key={emp._id} value={emp._id}>
                    {emp.firstName} {emp.lastName} - {emp.email}
                  </option>
                ))}
              </Form.Select>
            </Form.Group>
            <Form.Group className="mb-4">
              <Form.Label className="fw-semibold">Select Department *</Form.Label>
              <Form.Select
                value={assignData.departmentId}
                onChange={(e) => setAssignData({ ...assignData, departmentId: e.target.value })}
                required
                style={{ borderRadius: '8px', padding: '10px' }}
              >
                <option value="">Choose a department</option>
                {departments.map(dept => (
                  <option key={dept._id} value={dept._id}>
                    {dept.name} ({dept.code})
                  </option>
                ))}
              </Form.Select>
            </Form.Group>
            <div className="d-flex gap-2 justify-content-end">
              <Button variant="secondary" onClick={() => setShowAssignModal(false)} style={{ borderRadius: '8px', padding: '10px 24px' }}>
                <i className="fas fa-times me-2"></i>Cancel
              </Button>
              <Button type="submit" disabled={submitting} style={{ background: 'linear-gradient(135deg, #064e3b 0%, #10b981 100%)', border: 'none', borderRadius: '8px', padding: '10px 24px' }}>
                {submitting ? <><span className="spinner-border spinner-border-sm me-2"></span>Assigning...</> : <><i className="fas fa-check me-2"></i>Assign</>}
              </Button>
            </div>
          </Form>
        </Modal.Body>
      </Modal>

      {/* Bulk Assign Modal */}
      <Modal show={showBulkModal} onHide={() => setShowBulkModal(false)} centered size="lg">
        <Modal.Header closeButton style={{ background: 'linear-gradient(135deg, #064e3b 0%, #10b981 100%)', color: 'white', border: 'none' }}>
          <Modal.Title className="fw-bold">
            <i className="fas fa-users me-2"></i>Bulk Assign Employees
          </Modal.Title>
        </Modal.Header>
        <Modal.Body style={{ padding: '40px', background: '#f0fdf4' }}>
          <Form onSubmit={handleBulkAssign}>
            <Form.Group className="mb-4">
              <Form.Label className="fw-bold" style={{color: '#059669'}}>
                <i className="fas fa-user-check me-2"></i>Select Employees *
              </Form.Label>
              <div style={{ 
                background: 'white',
                border: '2px solid #10b981',
                borderRadius: '12px',
                padding: '8px',
                maxHeight: '280px',
                overflowY: 'auto'
              }}>
                <Form.Select 
                  multiple 
                  size={8} 
                  value={bulkData.employeeIds}
                  onChange={(e) => setBulkData({...bulkData, employeeIds: Array.from(e.target.selectedOptions, opt => opt.value)})} 
                  required
                  style={{ 
                    border: 'none',
                    fontSize: '15px',
                    background: 'transparent'
                  }}
                  className="custom-multi-select"
                >
                  {employees.map(emp => (
                    <option key={emp._id} value={emp._id} style={{
                      padding: '12px 16px',
                      borderRadius: '8px',
                      margin: '4px 0',
                      cursor: 'pointer'
                    }}>
                      👤 {emp.firstName} {emp.lastName}
                    </option>
                  ))}
                </Form.Select>
              </div>
              <Form.Text className="text-muted mt-2 d-block">
                <i className="fas fa-info-circle me-1"></i>Hold Ctrl/Cmd to select multiple employees
              </Form.Text>
            </Form.Group>
            <Form.Group className="mb-4">
              <Form.Label className="fw-bold" style={{color: '#059669'}}>
                <i className="fas fa-building me-2"></i>Select Department *
              </Form.Label>
              <Form.Select 
                value={bulkData.departmentId}
                onChange={(e) => setBulkData({...bulkData, departmentId: e.target.value})} 
                required
                style={{ borderRadius: '10px', padding: '12px', border: '2px solid #e0e0e0', fontSize: '15px' }}
              >
                <option value="">Choose department</option>
                {departments.map(dept => <option key={dept._id} value={dept._id}>{dept.name}</option>)}
              </Form.Select>
            </Form.Group>
            <div className="d-flex gap-3 justify-content-end mt-4">
              <Button onClick={() => setShowBulkModal(false)} style={{ background: 'linear-gradient(135deg, #868f96 0%, #596164 100%)', border: 'none', borderRadius: '10px', padding: '12px 30px', fontWeight: '600', color: 'white' }}>
                <i className="fas fa-times me-2"></i>Cancel
              </Button>
              <Button type="submit" disabled={submitting} style={{ background: 'linear-gradient(135deg, #064e3b 0%, #10b981 100%)', border: 'none', borderRadius: '10px', padding: '12px 30px', fontWeight: '600', color: 'white', boxShadow: '0 4px 15px rgba(16,185,129,0.4)' }}>
                {submitting ? <><span className="spinner-border spinner-border-sm me-2"></span>Assigning...</> : <><i className="fas fa-check me-2"></i>Assign Employees</>}
              </Button>
            </div>
          </Form>
        </Modal.Body>
      </Modal>
      <style>{`
        .custom-multi-select option {
          padding: 12px 16px !important;
          margin: 4px 0 !important;
          border-radius: 8px !important;
          transition: all 0.2s ease !important;
        }
        .custom-multi-select option:hover {
          background: linear-gradient(135deg, #e3f2fd 0%, #bbdefb 100%) !important;
        }
        .custom-multi-select option:checked {
          background: linear-gradient(135deg, #064e3b 0%, #10b981 100%) !important;
          color: white !important;
          font-weight: 600 !important;
        }
      `}</style>

      {/* Transfer Modal */}
      <Modal show={showTransferModal} onHide={() => {
        setShowTransferModal(false);
        setTransferData({ employeeIds: [], fromDepartmentId: '', toDepartmentId: '' });
      }} centered size="lg">
        <Modal.Header closeButton style={{ background: 'linear-gradient(135deg, #064e3b 0%, #10b981 100%)', color: 'white', border: 'none' }}>
          <Modal.Title className="fw-bold">
            <i className="fas fa-exchange-alt me-2"></i>Transfer Employees Between Departments
          </Modal.Title>
        </Modal.Header>
        <Modal.Body style={{ padding: '40px', background: '#f0fdf4' }}>
          <Form onSubmit={handleTransfer}>
            <Form.Group className="mb-4">
              <Form.Label className="fw-bold" style={{color: '#059669'}}>
                <i className="fas fa-building me-2"></i>From Department *
              </Form.Label>
              <Form.Select 
                value={transferData.fromDepartmentId}
                onChange={(e) => setTransferData({...transferData, fromDepartmentId: e.target.value, employeeIds: []})} 
                required
                style={{ borderRadius: '10px', padding: '12px', border: '2px solid #e0e0e0', fontSize: '15px' }}
              >
                <option value="">Select source department</option>
                {departments.map(dept => (
                  <option key={dept._id} value={dept._id}>
                    {dept.name} ({dept.code}) - {dept.employeeCount} employees
                  </option>
                ))}
              </Form.Select>
            </Form.Group>
            
            {transferData.fromDepartmentId && (() => {
              const filteredEmployees = employees.filter(emp => {
                const empDeptId = emp.department?._id || emp.department;
                return empDeptId && empDeptId.toString() === transferData.fromDepartmentId.toString();
              });
              
              return (
                <Form.Group className="mb-4">
                  <Form.Label className="fw-bold" style={{color: '#059669'}}>
                    <i className="fas fa-user-check me-2"></i>Select Employees to Transfer * ({filteredEmployees.length} available)
                  </Form.Label>
                  {filteredEmployees.length === 0 ? (
                    <div className="alert alert-warning" style={{ borderRadius: '10px' }}>
                      <i className="fas fa-exclamation-triangle me-2"></i>
                      No employees found in the selected department
                    </div>
                  ) : (
                    <>
                      <div style={{ 
                        background: 'white',
                        border: '2px solid #10b981',
                        borderRadius: '12px',
                        padding: '8px',
                        maxHeight: '280px',
                        overflowY: 'auto'
                      }}>
                        <Form.Select 
                          multiple 
                          size={8} 
                          value={transferData.employeeIds}
                          onChange={(e) => setTransferData({...transferData, employeeIds: Array.from(e.target.selectedOptions, opt => opt.value)})} 
                          required
                          style={{ 
                            border: 'none',
                            fontSize: '15px',
                            background: 'transparent'
                          }}
                          className="custom-multi-select"
                        >
                          {filteredEmployees.map(emp => (
                            <option key={emp._id} value={emp._id} style={{
                              padding: '12px 16px',
                              borderRadius: '8px',
                              margin: '4px 0',
                              cursor: 'pointer'
                            }}>
                              👤 {emp.firstName} {emp.lastName} {emp.designation ? `- ${emp.designation}` : ''}
                            </option>
                          ))}
                        </Form.Select>
                      </div>
                      <Form.Text className="text-muted mt-2 d-block">
                        <i className="fas fa-info-circle me-1"></i>Hold Ctrl/Cmd to select multiple employees. {transferData.employeeIds.length} selected.
                      </Form.Text>
                    </>
                  )}
                </Form.Group>
              );
            })()}
            
            <Form.Group className="mb-4">
              <Form.Label className="fw-bold" style={{color: '#059669'}}>
                <i className="fas fa-building me-2"></i>To Department *
              </Form.Label>
              <Form.Select 
                value={transferData.toDepartmentId}
                onChange={(e) => setTransferData({...transferData, toDepartmentId: e.target.value})} 
                required
                style={{ borderRadius: '10px', padding: '12px', border: '2px solid #e0e0e0', fontSize: '15px' }}
              >
                <option value="">Select target department</option>
                {departments
                  .filter(d => d._id !== transferData.fromDepartmentId)
                  .map(dept => (
                    <option key={dept._id} value={dept._id}>
                      {dept.name} ({dept.code}) - {dept.employeeCount} employees
                    </option>
                  ))}
              </Form.Select>
            </Form.Group>
            
            {transferData.fromDepartmentId && transferData.toDepartmentId && transferData.employeeIds.length > 0 && (
              <div className="alert alert-info" style={{ borderRadius: '10px', border: '2px solid #4facfe' }}>
                <i className="fas fa-info-circle me-2"></i>
                <strong>Transfer Summary:</strong> Moving {transferData.employeeIds.length} employee(s) from{' '}
                <strong>{departments.find(d => d._id === transferData.fromDepartmentId)?.name}</strong> to{' '}
                <strong>{departments.find(d => d._id === transferData.toDepartmentId)?.name}</strong>
              </div>
            )}
            
            <div className="d-flex gap-3 justify-content-end mt-4">
              <Button 
                onClick={() => {
                  setShowTransferModal(false);
                  setTransferData({ employeeIds: [], fromDepartmentId: '', toDepartmentId: '' });
                }} 
                style={{ background: 'linear-gradient(135deg, #868f96 0%, #596164 100%)', border: 'none', borderRadius: '10px', padding: '12px 30px', fontWeight: '600', color: 'white' }}
              >
                <i className="fas fa-times me-2"></i>Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={submitting || !transferData.fromDepartmentId || !transferData.toDepartmentId || transferData.employeeIds.length === 0}
                style={{ 
                  background: 'linear-gradient(135deg, #064e3b 0%, #10b981 100%)', 
                  border: 'none', 
                  borderRadius: '10px', 
                  padding: '12px 30px', 
                  fontWeight: '600', 
                  color: 'white', 
                  boxShadow: '0 4px 15px rgba(16,185,129,0.4)',
                  opacity: (submitting || !transferData.fromDepartmentId || !transferData.toDepartmentId || transferData.employeeIds.length === 0) ? 0.6 : 1
                }}
              >
                {submitting ? <><span className="spinner-border spinner-border-sm me-2"></span>Transferring...</> : <><i className="fas fa-exchange-alt me-2"></i>Transfer Employees</>}
              </Button>
            </div>
          </Form>
        </Modal.Body>
      </Modal>

      {/* Import Modal */}
      <Modal show={showImportModal} onHide={() => setShowImportModal(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title><i className="fas fa-file-import me-2"></i>Import Departments</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form onSubmit={handleImport}>
            <Form.Group className="mb-3">
              <Form.Label>Upload Excel/CSV File *</Form.Label>
              <Form.Control type="file" accept=".xlsx,.xls,.csv"
                onChange={(e) => setImportFile(e.target.files[0])} required />
              <Form.Text>Required columns: name, code, description, location, status</Form.Text>
            </Form.Group>
            <div className="d-flex gap-2 justify-content-end">
              <Button variant="secondary" onClick={() => setShowImportModal(false)}>Cancel</Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? <><span className="spinner-border spinner-border-sm me-2"></span>Importing...</> : 'Import'}
              </Button>
            </div>
          </Form>
        </Modal.Body>
      </Modal>

      {/* Export Modal */}
      <Modal show={showExportModal} onHide={() => setShowExportModal(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title><i className="fas fa-download me-2"></i>Export Departments</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <div className="d-grid gap-3">
            <Button variant="primary" onClick={() => exportToExcel()}>
              <i className="fas fa-file-export me-2"></i>Export All Departments ({filteredDepartments.length})
            </Button>
            <Button variant="success" onClick={() => {
              if (selectedRows.length === 0) {
                Swal.fire('Warning', 'Please select departments first', 'warning');
                return;
              }
              const selected = filteredDepartments.filter(d => selectedRows.includes(d._id));
              exportToExcel(selected);
            }}>
              <i className="fas fa-check-square me-2"></i>Export Selected ({selectedRows.length})
            </Button>
            <Button variant="secondary" onClick={() => setShowExportModal(false)}>
              <i className="fas fa-times me-2"></i>Cancel
            </Button>
          </div>
        </Modal.Body>
      </Modal>
    </Container>
  );
};

export default Departments;
