import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Row, Col, Card, Form, InputGroup, Badge, Button, Modal, Table, Offcanvas, Nav } from 'react-bootstrap';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-toastify';
import Swal from 'sweetalert2';
import './EmployeeDirectory.css';

const EmployeeDirectory = () => {
  const [employees, setEmployees] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [filters, setFilters] = useState({ search: '', department: '', role: '' });
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [statusFilter, setStatusFilter] = useState('active');
  const { user } = useAuth();
  const navigate = useNavigate();
  const [editableProfile, setEditableProfile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [profileLoading, setProfileLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const [collapsedSections, setCollapsedSections] = useState({});
  const [formData, setFormData] = useState({
    email: '',
    firstName: '',
    lastName: '',
    role: 'EMPLOYEE',
    department: '',
    designation: '',
    joinDate: new Date().toISOString().split('T')[0]
  });

  useEffect(() => {
    fetchEmployees();
    fetchDepartments();
    setCurrentPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, filters]);

  const fetchDepartments = async () => {
    try {
      const response = await api.get('/api/departments');
      setDepartments(response.data);
    } catch (error) {
      console.error('Error fetching departments:', error);
    }
  };

  const fetchEmployees = async () => {
    setLoading(true);
    try {
      const response = await api.get(`/api/employee-management/all?status=${statusFilter}`);
      setEmployees(response.data);
    } catch (error) {
      console.error('Error fetching employees:', error);
      toast.error('Unable to load employees');
      setEmployees([]);
    } finally {
      setLoading(false);
    }
  };

  const handleViewProfile = async (employeeOrId) => {
    try {
      setSelectedEmployee(null);
      setShowProfileModal(true);
      setProfileLoading(true);
      
      let id = employeeOrId._id || employeeOrId;
      const response = await api.get(`/api/employees/profile/${id}`);
      const profile = response.data;
      
      // Fetch user details including exitDetails
      const userResponse = await api.get(`/api/users/${profile.userId._id || profile.userId}`);
      profile.userId = userResponse.data;
      
      console.log('Profile with user data:', profile);
      console.log('Exit details:', profile.userId?.exitDetails);
      console.log('User isActive:', profile.userId?.isActive);
      console.log('Full userId object:', JSON.stringify(profile.userId, null, 2));
      
      setSelectedEmployee(profile);
    } catch (error) {
      console.error('Error fetching profile:', error);
      toast.error(error.response?.data?.message || 'Failed to load profile');
      setShowProfileModal(false);
    } finally {
      setProfileLoading(false);
    }
  };

  const handleEditProfile = () => {
    setShowProfileModal(false);
    setEditableProfile(selectedEmployee);
    setCollapsedSections({});
    setShowEditModal(true);
  };

  const handleRoleChange = (role) => {
    setFormData({ ...formData, role });
  };

  const handlePermissionChange = (permission) => {
    setFormData({
      ...formData,
      permissions: { ...formData.permissions, [permission]: !formData.permissions[permission] }
    });
  };

  const toggleSection = (sectionName) => {
    setCollapsedSections(prev => ({
      ...prev,
      [sectionName]: !prev[sectionName]
    }));
  };

  const handleSaveProfile = async () => {
    const result = await Swal.fire({
      title: 'Save Changes?',
      text: 'Are you sure you want to save these changes?',
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#0d6efd',
      cancelButtonColor: '#6c757d',
      confirmButtonText: 'Yes, save!'
    });

    if (!result.isConfirmed) return;
    if (!selectedEmployee || !editableProfile) return;
    const userId = selectedEmployee.userId._id || selectedEmployee.userId;
    try {
      const userPayload = {
        firstName: editableProfile.userId?.firstName,
        lastName: editableProfile.userId?.lastName,
        email: editableProfile.userId?.email,
        department: editableProfile.workInfo?.department || editableProfile.professionalInfo?.department || editableProfile.userId?.department,
        designation: editableProfile.workInfo?.designation || editableProfile.professionalInfo?.designation || editableProfile.userId?.designation,
        joinDate: editableProfile.userId?.joinDate || null,
        dateOfBirth: editableProfile.userId?.dateOfBirth || null
      };
      await api.put(`/api/users/${userId}`, userPayload);

      const payload = {
        employeeId: editableProfile.employeeId,
        personalInfo: editableProfile.personalInfo || {},
        professionalInfo: {
          ...editableProfile.professionalInfo,
          employeeId: editableProfile.employeeId,
          workLocation: editableProfile.location || editableProfile.professionalInfo?.workLocation
        },
        bankDetails: editableProfile.bankDetails || {},
        workInfo: {
          ...editableProfile.workInfo,
          workLocation: editableProfile.location || editableProfile.workInfo?.workLocation
        }
      };
      await api.put(`/api/employees/profile/${userId}`, payload);

      const refreshResponse = await api.get(`/api/employees/profile/${userId}`);
      const refreshedProfile = refreshResponse.data;
      
      setSelectedEmployee(refreshedProfile);
      setEditableProfile(refreshedProfile);
      setEmployees(prev => prev.map(emp => (emp.userId?._id === userId ? { ...emp, userId: { ...emp.userId, ...userPayload } } : emp)));
      setShowEditModal(false);
      toast.success('Profile updated successfully');
    } catch (err) {
      console.error('Error saving profile:', err);
      toast.error(err.response?.data?.message || 'Failed to save profile');
    }
  };

  const handleConfirmDelete = async () => {
    setShowEditModal(false);
    setShowProfileModal(false);
    await new Promise(resolve => setTimeout(resolve, 300));
    
    const { value: formValues } = await Swal.fire({
      title: '<strong>Employee Exit Process</strong>',
      html: `
        <div style="text-align: left; padding: 1rem;">
          <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 0.875rem; border-radius: 6px; margin-bottom: 1rem; font-size: 0.875rem; color: #92400e;">
            <strong>Important:</strong> Employee will be immediately logged out and unable to access the system.
          </div>
          
          <div style="margin-bottom: 1.25rem;">
            <label style="display: block; margin-bottom: 0.5rem; font-weight: 600; color: #1e293b; font-size: 0.9rem;">Exit Reason<span style="color: #dc2626; margin-left: 2px;">*</span></label>
            <select id="exitReason" style="width: 100%; padding: 0.625rem 0.875rem; border: 2px solid #e2e8f0; border-radius: 8px; font-size: 0.95rem;">
              <option value="">-- Select Reason --</option>
              <option value="RESIGNATION">Resignation (Employee Choice)</option>
              <option value="TERMINATION">Termination (Company Decision)</option>
              <option value="RETIREMENT">Retirement</option>
              <option value="CONTRACT_END">Contract Ended</option>
              <option value="MUTUAL_AGREEMENT">Mutual Agreement</option>
              <option value="RELOCATION">Relocation</option>
              <option value="HEALTH_REASONS">Health Reasons</option>
              <option value="OTHER">Other</option>
            </select>
          </div>
          
          <div style="margin-bottom: 1.25rem;">
            <label style="display: block; margin-bottom: 0.5rem; font-weight: 600; color: #1e293b; font-size: 0.9rem;">Last Working Day<span style="color: #dc2626; margin-left: 2px;">*</span></label>
            <input id="exitDate" type="date" style="width: 100%; padding: 0.625rem 0.875rem; border: 2px solid #e2e8f0; border-radius: 8px; font-size: 0.95rem;" value="${new Date().toISOString().split('T')[0]}" min="${new Date().toISOString().split('T')[0]}">
          </div>
          
          <div style="margin-bottom: 1.25rem;">
            <label style="display: block; margin-bottom: 0.5rem; font-weight: 600; color: #1e293b; font-size: 0.9rem;">Exit Interview Completed?</label>
            <select id="exitInterview" style="width: 100%; padding: 0.625rem 0.875rem; border: 2px solid #e2e8f0; border-radius: 8px; font-size: 0.95rem;">
              <option value="NO">No</option>
              <option value="YES">Yes</option>
              <option value="SCHEDULED">Scheduled</option>
              <option value="NOT_REQUIRED">Not Required</option>
            </select>
          </div>
          
          <div style="margin-bottom: 1.25rem;">
            <label style="display: block; margin-bottom: 0.5rem; font-weight: 600; color: #1e293b; font-size: 0.9rem;">Handover Status</label>
            <select id="handoverStatus" style="width: 100%; padding: 0.625rem 0.875rem; border: 2px solid #e2e8f0; border-radius: 8px; font-size: 0.95rem;">
              <option value="PENDING">Pending</option>
              <option value="IN_PROGRESS">In Progress</option>
              <option value="COMPLETED">Completed</option>
              <option value="NOT_APPLICABLE">Not Applicable</option>
            </select>
          </div>
          
          <div style="margin-bottom: 1.25rem;">
            <label style="display: block; margin-bottom: 0.5rem; font-weight: 600; color: #1e293b; font-size: 0.9rem;">Additional Notes</label>
            <textarea id="exitNotes" style="width: 100%; padding: 0.625rem 0.875rem; border: 2px solid #e2e8f0; border-radius: 8px; font-size: 0.95rem; resize: vertical;" rows="3" placeholder="Enter any additional information about the exit (optional)..."></textarea>
          </div>
        </div>
      `,
      width: '600px',
      showCancelButton: true,
      confirmButtonText: '<i class="fas fa-user-slash"></i> Deactivate Employee',
      cancelButtonText: '<i class="fas fa-times"></i> Cancel',
      confirmButtonColor: '#dc2626',
      cancelButtonColor: '#64748b',
      customClass: {
        popup: 'exit-modal',
        confirmButton: 'btn-confirm-exit',
        cancelButton: 'btn-cancel-exit'
      },
      preConfirm: () => {
        const exitReason = document.getElementById('exitReason').value;
        const exitDate = document.getElementById('exitDate').value;
        const exitInterview = document.getElementById('exitInterview').value;
        const handoverStatus = document.getElementById('handoverStatus').value;
        const exitNotes = document.getElementById('exitNotes').value;
        
        if (!exitReason) {
          Swal.showValidationMessage('⚠️ Please select an exit reason');
        }
        
        if (!exitDate) {
          Swal.showValidationMessage('⚠️ Please select last working day');
        }
        
        if (exitReason && exitDate) {
          return { exitReason, exitDate, exitInterview, handoverStatus, exitNotes };
        }
      },
      didOpen: () => {
        // Add custom styling
        const style = document.createElement('style');
        style.textContent = `
          .exit-modal { border-radius: 16px !important; }
          .btn-confirm-exit, .btn-cancel-exit { padding: 0.75rem 1.5rem !important; font-weight: 600 !important; border-radius: 8px !important; }
        `;
        document.head.appendChild(style);
      }
    });

    if (!formValues) return;
    if (!selectedEmployee) return;
    const userId = selectedEmployee.userId?._id || selectedEmployee._id;
    
    try {
      await api.put(`/api/employee-management/${userId}/deactivate`, formValues);
      
      await Swal.fire({
        icon: 'success',
        title: 'Employee Deactivated',
        html: `
          <div style="text-align: left; padding: 1rem;">
            <p><strong>${selectedEmployee.userId?.firstName} ${selectedEmployee.userId?.lastName}</strong> has been successfully deactivated.</p>
            <ul style="margin-top: 1rem; color: #64748b;">
              <li>✓ Access revoked immediately</li>
              <li>✓ Exit details recorded</li>
              <li>✓ Data preserved for records</li>
            </ul>
          </div>
        `,
        confirmButtonText: 'Done',
        confirmButtonColor: '#059669'
      });
      
      await fetchEmployees();
      
      // Refresh profile to show exit details
      const refreshResponse = await api.get(`/api/employees/profile/${userId}`);
      const userResponse = await api.get(`/api/users/${userId}`);
      refreshResponse.data.userId = userResponse.data;
      setSelectedEmployee(refreshResponse.data);
      setShowProfileModal(true);
    } catch (err) {
      console.error('Deactivate failed', err);
      Swal.fire({
        icon: 'error',
        title: 'Deactivation Failed',
        text: err.response?.data?.message || 'Failed to deactivate employee',
        confirmButtonColor: '#dc2626'
      });
    }
  };

  const handleReactivate = async (userId) => {
    setShowProfileModal(false);
    await new Promise(resolve => setTimeout(resolve, 300));
    
    const result = await Swal.fire({
      title: 'Reactivate Employee?',
      text: 'This will restore full system access for this employee.',
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#10b981',
      cancelButtonColor: '#6c757d',
      confirmButtonText: 'Yes, reactivate',
      cancelButtonText: 'Cancel'
    });

    if (!result.isConfirmed) return;

    try {
      const id = userId || selectedEmployee.userId?._id || selectedEmployee._id;
      await api.put(`/api/employee-management/${id}/reactivate`);
      
      await Swal.fire({
        icon: 'success',
        title: 'Employee Reactivated',
        text: 'Employee has been successfully reactivated.',
        confirmButtonColor: '#10b981'
      });
      
      await fetchEmployees();
    } catch (error) {
      Swal.fire({
        icon: 'error',
        title: 'Reactivation Failed',
        text: error.response?.data?.message || 'Failed to reactivate employee',
        confirmButtonColor: '#dc2626'
      });
    }
  };

  const handleDeletePermanently = async () => {
    setShowProfileModal(false);
    await new Promise(resolve => setTimeout(resolve, 300));
    
    const result = await Swal.fire({
      title: 'Delete Employee Permanently?',
      html: '<strong style="color: #dc2626;">WARNING: This action cannot be undone!</strong><br/>All employee data will be permanently deleted.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#dc2626',
      cancelButtonColor: '#6c757d',
      confirmButtonText: 'Yes, delete permanently',
      cancelButtonText: 'Cancel'
    });

    if (!result.isConfirmed) return;

    try {
      const userId = selectedEmployee.userId?._id || selectedEmployee._id;
      await api.delete(`/api/employee-management/${userId}`);
      
      await Swal.fire({
        icon: 'success',
        title: 'Employee Deleted',
        text: 'Employee has been permanently deleted from the system.',
        confirmButtonColor: '#10b981'
      });
      
      await fetchEmployees();
    } catch (error) {
      Swal.fire({
        icon: 'error',
        title: 'Deletion Failed',
        text: error.response?.data?.message || 'Failed to delete employee',
        confirmButtonColor: '#dc2626'
      });
    }
  };

  const handleResetPassword = async () => {
    setShowProfileModal(false);
    await new Promise(resolve => setTimeout(resolve, 300));
    
    const { value: newPassword } = await Swal.fire({
      title: 'Reset Password',
      html: `
        <div style="text-align: left; padding: 0.5rem;">
          <p>Enter new password for <strong>${selectedEmployee.userId?.firstName} ${selectedEmployee.userId?.lastName}</strong></p>
          <input id="newPassword" type="text" class="swal2-input" placeholder="Enter new password" style="width: 90%; margin: 0.5rem auto;">
          <p style="color: #6c757d; font-size: 0.85rem; margin-top: 0.5rem;">ℹ️ Password must be at least 6 characters</p>
        </div>
      `,
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#0d6efd',
      cancelButtonColor: '#6c757d',
      confirmButtonText: 'Reset Password',
      cancelButtonText: 'Cancel',
      preConfirm: () => {
        const password = document.getElementById('newPassword').value;
        if (!password) {
          Swal.showValidationMessage('Please enter a password');
        } else if (password.length < 6) {
          Swal.showValidationMessage('Password must be at least 6 characters');
        }
        return password;
      }
    });

    if (!newPassword) return;

    try {
      const userId = selectedEmployee.userId?._id || selectedEmployee._id;
      await api.put(`/api/users/${userId}/reset-password`, { newPassword });
      
      await Swal.fire({
        icon: 'success',
        title: 'Password Reset Successfully',
        html: `
          <div style="text-align: left; padding: 1rem;">
            <p><strong>New Login Credentials:</strong></p>
            <div style="background: #f8f9fa; padding: 1rem; border-radius: 8px; margin: 1rem 0;">
              <p style="margin: 0.5rem 0;"><strong>Email:</strong> ${selectedEmployee.userId?.email}</p>
              <p style="margin: 0.5rem 0;"><strong>Password:</strong> <code style="background: #e9ecef; padding: 0.25rem 0.5rem; border-radius: 4px; font-size: 1.1em;">${newPassword}</code></p>
            </div>
            <p style="color: #0d6efd; font-size: 0.9rem;">ℹ️ Share these credentials with the employee.</p>
          </div>
        `,
        confirmButtonText: 'Done',
        confirmButtonColor: '#10b981'
      });
      
      setShowProfileModal(true);
    } catch (error) {
      Swal.fire({
        icon: 'error',
        title: 'Password Reset Failed',
        text: error.response?.data?.message || 'Failed to reset password',
        confirmButtonColor: '#dc2626'
      });
    }
  };

  const handleChangeRole = async () => {
    setShowProfileModal(false);
    await new Promise(resolve => setTimeout(resolve, 300));
    
    const currentRole = selectedEmployee.userId?.role;
    
    const { value: newRole } = await Swal.fire({
      title: 'Change Employee Role',
      html: `
        <div style="text-align: left; padding: 1rem;">
          <p style="margin-bottom: 1rem;">Change role for <strong>${selectedEmployee.userId?.firstName} ${selectedEmployee.userId?.lastName}</strong></p>
          <p style="margin-bottom: 0.5rem; color: #6c757d; font-size: 0.9rem;">Current Role: <strong>${currentRole}</strong></p>
          <select id="roleSelect" class="swal2-input" style="width: 90%; padding: 0.75rem;">
            <option value="EMPLOYEE" ${currentRole === 'EMPLOYEE' ? 'selected' : ''}>Employee - Basic access</option>
            <option value="MANAGER" ${currentRole === 'MANAGER' ? 'selected' : ''}>Manager - Team management</option>
            <option value="HR" ${currentRole === 'HR' ? 'selected' : ''}>HR - Full HR access</option>
            <option value="ADMIN" ${currentRole === 'ADMIN' ? 'selected' : ''}>Admin - Full system access</option>
          </select>
        </div>
      `,
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#0d6efd',
      cancelButtonColor: '#6c757d',
      confirmButtonText: 'Change Role',
      cancelButtonText: 'Cancel',
      preConfirm: () => {
        return document.getElementById('roleSelect').value;
      }
    });

    if (!newRole || newRole === currentRole) return;

    try {
      const userId = selectedEmployee.userId?._id || selectedEmployee._id;
      await api.put(`/api/users/${userId}/role`, { role: newRole });
      
      await Swal.fire({
        icon: 'success',
        title: 'Role Changed Successfully',
        html: `
          <div style="text-align: left; padding: 1rem;">
            <p><strong>${selectedEmployee.userId?.firstName} ${selectedEmployee.userId?.lastName}</strong> role has been updated.</p>
            <div style="background: #f8f9fa; padding: 1rem; border-radius: 8px; margin: 1rem 0;">
              <p style="margin: 0.5rem 0;"><strong>Previous Role:</strong> ${currentRole}</p>
              <p style="margin: 0.5rem 0;"><strong>New Role:</strong> ${newRole}</p>
            </div>
            <p style="color: #0d6efd; font-size: 0.9rem;">ℹ️ Employee needs to logout and login to see new permissions.</p>
          </div>
        `,
        confirmButtonText: 'Done',
        confirmButtonColor: '#10b981'
      });
      
      await fetchEmployees();
      const response = await api.get(`/api/employees/profile/${userId}`);
      const userResponse = await api.get(`/api/users/${userId}`);
      response.data.userId = userResponse.data;
      setSelectedEmployee(response.data);
      setShowProfileModal(true);
    } catch (error) {
      Swal.fire({
        icon: 'error',
        title: 'Role Change Failed',
        text: error.response?.data?.message || 'Failed to change role',
        confirmButtonColor: '#dc2626'
      });
    }
  };

  const handleAddEmployee = async (e) => {
    e.preventDefault();
    
    if (!formData.email || !formData.firstName || !formData.lastName) {
      toast.error('Please fill all required fields');
      return;
    }
    
    setLoading(true);
    try {
      const payload = {
        email: formData.email,
        firstName: formData.firstName,
        lastName: formData.lastName,
        role: formData.role,
        department: formData.department,
        designation: formData.designation,
        joinDate: formData.joinDate
      };
      
      const response = await api.post('/api/employee-management/create', payload);
      
      // Show password in alert
      if (response.data.employee?.tempPassword) {
        await Swal.fire({
          icon: 'success',
          title: 'Employee Created Successfully!',
          html: `
            <div style="text-align: left; padding: 1rem;">
              <p><strong>Login Credentials:</strong></p>
              <div style="background: #f8f9fa; padding: 1rem; border-radius: 8px; margin: 1rem 0;">
                <p style="margin: 0.5rem 0;"><strong>Email:</strong> ${response.data.employee.email}</p>
                <p style="margin: 0.5rem 0;"><strong>Password:</strong> <code style="background: #e9ecef; padding: 0.25rem 0.5rem; border-radius: 4px; font-size: 1.1em;">${response.data.employee.tempPassword}</code></p>
              </div>
              <p style="color: #dc3545; font-size: 0.9rem;">⚠️ Save this password - it won't be shown again!</p>
            </div>
          `,
          confirmButtonText: 'Got it!',
          confirmButtonColor: '#0d6efd'
        });
      } else {
        toast.success(response.data.message || 'Employee created successfully!');
      }
      
      setShowAddModal(false);
      resetForm();
      await fetchEmployees();
    } catch (error) {
      console.error('Create employee error:', error);
      const errorMsg = error.response?.data?.message || error.message || 'Error creating employee';
      toast.error(errorMsg);
    } finally {
      setLoading(false);
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
      joinDate: new Date().toISOString().split('T')[0]
    });
  };

  const getRoleBadgeClass = (role) => {
    const classes = {
      ADMIN: 'badge-admin',
      HR: 'badge-hr',
      MANAGER: 'badge-manager',
      EMPLOYEE: 'badge-employee'
    };
    return classes[role] || classes.EMPLOYEE;
  };

  const filteredEmployees = employees.filter(emp => {
    const searchLower = filters.search.toLowerCase();
    const matchesSearch = !filters.search || 
      emp?.firstName?.toLowerCase().includes(searchLower) ||
      emp?.lastName?.toLowerCase().includes(searchLower) ||
      emp?.email?.toLowerCase().includes(searchLower);
    const matchesDept = !filters.department || emp?.department === filters.department;
    const matchesRole = !filters.role || emp?.role === filters.role;
    return matchesSearch && matchesDept && matchesRole;
  });

  const stats = {
    total: employees.length,
    active: employees.filter(e => e?.isActive).length,
    inactive: employees.filter(e => e?.isActive === false).length,
    departments: [...new Set(employees.map(e => e?.department).filter(Boolean))].length
  };

  const exportToExcel = async () => {
    try {
      const detailedEmployees = await Promise.all(
        filteredEmployees.map(async (emp) => {
          try {
            const response = await api.get(`/api/employees/profile/${emp._id}`);
            const profile = response.data;
            return {
              'Employee ID': profile.employeeId || 'N/A',
              'First Name': emp.firstName,
              'Last Name': emp.lastName,
              'Email': emp.email,
              'Role': emp.role,
              'Department': emp.department || 'N/A',
              'Designation': emp.designation || 'N/A',
              'Join Date': emp.joinDate ? new Date(emp.joinDate).toLocaleDateString() : 'N/A',
              'Date of Birth': emp.dateOfBirth ? new Date(emp.dateOfBirth).toLocaleDateString() : 'N/A',
              'Phone': profile.personalInfo?.phone || 'N/A',
              'Blood Group': profile.personalInfo?.bloodGroup || 'N/A',
              'Marital Status': profile.personalInfo?.maritalStatus || 'N/A',
              'Address': profile.personalInfo?.address ? `${profile.personalInfo.address.street || ''}, ${profile.personalInfo.address.city || ''}, ${profile.personalInfo.address.state || ''}, ${profile.personalInfo.address.zipCode || ''}`.trim() : 'N/A',
              'Emergency Contact Name': profile.personalInfo?.emergencyContact?.name || 'N/A',
              'Emergency Contact Phone': profile.personalInfo?.emergencyContact?.phone || 'N/A',
              'Emergency Contact Relationship': profile.personalInfo?.emergencyContact?.relationship || 'N/A',
              'Work Location': profile.workInfo?.workLocation || profile.professionalInfo?.workLocation || 'N/A',
              'Employment Type': profile.professionalInfo?.employmentType || 'N/A',
              'Bank Name': profile.bankDetails?.bankName || 'N/A',
              'Account Number': profile.bankDetails?.accountNumber || 'N/A',
              'IFSC Code': profile.bankDetails?.ifscCode || 'N/A',
              'Status': emp.isActive ? 'Active' : 'Inactive'
            };
          } catch (error) {
            return {
              'Employee ID': 'N/A',
              'First Name': emp.firstName,
              'Last Name': emp.lastName,
              'Email': emp.email,
              'Role': emp.role,
              'Department': emp.department || 'N/A',
              'Designation': emp.designation || 'N/A',
              'Join Date': emp.joinDate ? new Date(emp.joinDate).toLocaleDateString() : 'N/A',
              'Status': emp.isActive ? 'Active' : 'Inactive'
            };
          }
        })
      );
      
      const ws = window.XLSX?.utils.json_to_sheet(detailedEmployees);
      const wb = window.XLSX?.utils.book_new();
      window.XLSX?.utils.book_append_sheet(wb, ws, 'Employees');
      window.XLSX?.writeFile(wb, `employees_detailed_${new Date().toISOString().split('T')[0]}.xlsx`);
      toast.success('Employee data exported successfully!');
    } catch (error) {
      toast.error('Failed to export employee data');
    }
  };

  const paginatedEmployees = filteredEmployees.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
  const totalPages = Math.ceil(filteredEmployees.length / itemsPerPage);

  return (
    <div className="employee-directory-v2">
      {/* Header */}
      <div className="directory-header">
        <div className="header-left">
          <h1 className="directory-title">
            <i className="fas fa-address-book"></i>
            Employee Directory
          </h1>
          <p className="directory-subtitle">{filteredEmployees.length} Employees</p>
        </div>
        <div className="header-actions">
          <Button variant="outline-secondary" onClick={exportToExcel} className="me-2">
            <i className="fas fa-file-excel me-2"></i>Export
          </Button>
          {['HR', 'ADMIN'].includes(user?.role) && (
            <Button className="btn-import" onClick={() => setShowAddModal(true)}>
              <i className="fas fa-user-plus me-2"></i>Add Employee
            </Button>
          )}
        </div>
      </div>

      {/* Status Tabs */}
      <div className="status-tabs-container mb-3">
        <div className="status-tabs" style={{ display: 'flex', gap: '0.75rem' }}>
          <button 
            className={`status-tab ${statusFilter === 'all' ? 'active' : ''}`}
            onClick={() => setStatusFilter('all')}
            style={{ flex: 1, padding: '0.75rem', borderRadius: '8px', border: statusFilter === 'all' ? '2px solid #667eea' : '2px solid #e2e8f0', background: statusFilter === 'all' ? '#f0f4ff' : 'white', cursor: 'pointer' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <i className="fas fa-users" style={{ fontSize: '1.25rem', color: '#667eea' }}></i>
              <div style={{ textAlign: 'left' }}>
                <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 500 }}>All Employees</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#1e293b' }}>{stats.total}</div>
              </div>
            </div>
          </button>
          
          <button 
            className={`status-tab ${statusFilter === 'active' ? 'active' : ''}`}
            onClick={() => setStatusFilter('active')}
            style={{ flex: 1, padding: '0.75rem', borderRadius: '8px', border: statusFilter === 'active' ? '2px solid #10b981' : '2px solid #e2e8f0', background: statusFilter === 'active' ? '#f0fdf4' : 'white', cursor: 'pointer' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <i className="fas fa-check-circle" style={{ fontSize: '1.25rem', color: '#10b981' }}></i>
              <div style={{ textAlign: 'left' }}>
                <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 500 }}>Active</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#1e293b' }}>{stats.active}</div>
              </div>
            </div>
          </button>
          
          <button 
            className={`status-tab ${statusFilter === 'inactive' ? 'active' : ''}`}
            onClick={() => setStatusFilter('inactive')}
            style={{ flex: 1, padding: '0.75rem', borderRadius: '8px', border: statusFilter === 'inactive' ? '2px solid #ef4444' : '2px solid #e2e8f0', background: statusFilter === 'inactive' ? '#fef2f2' : 'white', cursor: 'pointer' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <i className="fas fa-times-circle" style={{ fontSize: '1.25rem', color: '#ef4444' }}></i>
              <div style={{ textAlign: 'left' }}>
                <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 500 }}>Inactive</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#1e293b' }}>{stats.inactive}</div>
              </div>
            </div>
          </button>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="filters-bar">
        <div className="filter-group">
          <div className="search-box">
            <i className="fas fa-search"></i>
            <input
              type="text"
              placeholder="Search employees..."
              value={filters.search}
              onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
            />
          </div>
        </div>
        <div className="filter-group">
          <select
            className="filter-select"
            value={filters.department}
            onChange={(e) => setFilters(prev => ({ ...prev, department: e.target.value }))}
          >
            <option value="">All Departments</option>
            {Array.isArray(departments) && departments.map(dept => (
              <option key={dept._id} value={dept.name}>{dept.name}</option>
            ))}
          </select>
          <select
            className="filter-select"
            value={filters.role}
            onChange={(e) => setFilters(prev => ({ ...prev, role: e.target.value }))}
          >
            <option value="">All Roles</option>
            <option value="ADMIN">Admin</option>
            <option value="HR">HR</option>
            <option value="MANAGER">Manager</option>
            <option value="EMPLOYEE">Employee</option>
          </select>
          {(filters.search || filters.department || filters.role) && (
            <button 
              className="btn-reset"
              onClick={() => setFilters({ search: '', department: '', role: '' })}
            >
              <i className="fas fa-times"></i> Clear
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="loading-container">
          <div className="spinner-border text-primary"></div>
          <p>Loading employees...</p>
        </div>
      ) : filteredEmployees.length === 0 ? (
        <div className="empty-container">
          <i className="fas fa-users-slash"></i>
          <h3>No Employees Found</h3>
          <p>Try adjusting your filters or search criteria</p>
        </div>
      ) : (
        <div className="grid-view">
          <Row>
            {paginatedEmployees.map((employee) => (
              <Col key={employee?._id} xs={12} sm={6} md={4} lg={3} className="mb-4">
                <div className="employee-card-modern" onClick={() => handleViewProfile(employee)}>
                  <div className="card-header-modern">
                    <div className="employee-avatar-modern">
                      {employee?.profileImage ? (
                        <img src={employee.profileImage} alt="Profile" />
                      ) : (
                        <div className="avatar-initials-modern">
                          {employee?.firstName?.charAt(0)}{employee?.lastName?.charAt(0)}
                        </div>
                      )}
                    </div>
                    {!employee?.isActive && (
                      <Badge bg="danger" className="status-badge-modern">Inactive</Badge>
                    )}
                  </div>
                  
                  <div className="card-body-modern">
                    <h4 className="employee-name-modern">
                      {employee?.firstName} {employee?.lastName}
                    </h4>
                    <p className="employee-designation-modern">{employee?.designation || 'No Position'}</p>
                    
                    <div className="employee-details-modern">
                      <div className="detail-item-modern">
                        <i className="fas fa-briefcase"></i>
                        <span>{employee?.role}</span>
                      </div>
                      <div className="detail-item-modern">
                        <i className="fas fa-building"></i>
                        <span>{employee?.department || 'Not Set'}</span>
                      </div>
                      <div className="detail-item-modern">
                        <i className="fas fa-envelope"></i>
                        <span className="text-truncate">{employee?.email}</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="card-footer-modern">
                    <Button size="sm" variant="outline-primary" className="w-100" onClick={(e) => { e.stopPropagation(); handleViewProfile(employee); }}>
                      <i className="fas fa-eye me-2"></i>View Profile
                    </Button>
                  </div>
                </div>
              </Col>
            ))}
          </Row>
        </div>
      )}

      {/* Pagination */}
      {filteredEmployees.length > itemsPerPage && (
        <div className="pagination-container">
          <div className="pagination-info">
            Showing {((currentPage - 1) * itemsPerPage) + 1}-{Math.min(currentPage * itemsPerPage, filteredEmployees.length)} of {filteredEmployees.length}
          </div>
          <div className="pagination-controls">
            <button 
              className="page-btn"
              onClick={() => setCurrentPage(1)}
              disabled={currentPage === 1}
            >
              <i className="fas fa-angle-double-left"></i>
            </button>
            <button 
              className="page-btn"
              onClick={() => setCurrentPage(prev => prev - 1)}
              disabled={currentPage === 1}
            >
              <i className="fas fa-angle-left"></i>
            </button>
            <span className="page-numbers">
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pageNum;
                if (totalPages <= 5) {
                  pageNum = i + 1;
                } else if (currentPage <= 3) {
                  pageNum = i + 1;
                } else if (currentPage >= totalPages - 2) {
                  pageNum = totalPages - 4 + i;
                } else {
                  pageNum = currentPage - 2 + i;
                }
                return (
                  <button
                    key={pageNum}
                    className={`page-num ${currentPage === pageNum ? 'active' : ''}`}
                    onClick={() => setCurrentPage(pageNum)}
                  >
                    {pageNum}
                  </button>
                );
              })}
            </span>
            <button 
              className="page-btn"
              onClick={() => setCurrentPage(prev => prev + 1)}
              disabled={currentPage === totalPages}
            >
              <i className="fas fa-angle-right"></i>
            </button>
            <button 
              className="page-btn"
              onClick={() => setCurrentPage(totalPages)}
              disabled={currentPage === totalPages}
            >
              <i className="fas fa-angle-double-right"></i>
            </button>
          </div>
        </div>
      )}

      {/* Edit Employee Modal */}
      <Modal show={showEditModal} onHide={() => setShowEditModal(false)} size="xl" centered className="edit-employee-modal">
        <Modal.Header closeButton className="edit-modal-header">
          <Modal.Title>
            <i className="fas fa-user-edit me-2"></i>
            Edit Employee Profile
          </Modal.Title>
        </Modal.Header>
        <Modal.Body className="edit-modal-body">
          {selectedEmployee && editableProfile && (
            <div className="edit-form-container">
              <div className="employee-header-card">
                <div className="employee-avatar-large">
                  {selectedEmployee.userId.profileImage ? (
                    <img src={selectedEmployee.userId.profileImage} alt="Profile" />
                  ) : (
                    <span className="avatar-initials-large">
                      {selectedEmployee.userId.firstName?.charAt(0)}{selectedEmployee.userId.lastName?.charAt(0)}
                    </span>
                  )}
                  <div className="avatar-upload-overlay" onClick={() => document.getElementById('profileImageInput').click()}>
                    <i className="fas fa-camera"></i>
                  </div>
                </div>
                <input
                  id="profileImageInput"
                  type="file"
                  accept="image/*"
                  style={{ display: 'none' }}
                  onChange={async (e) => {
                    const file = e.target.files[0];
                    if (file) {
                      const formData = new FormData();
                      formData.append('profileImage', file);
                      try {
                        const userId = selectedEmployee.userId._id || selectedEmployee.userId;
                        await api.post(`/api/employees/profile/${userId}/profile-image`, formData, {
                          headers: { 'Content-Type': 'multipart/form-data' }
                        });
                        const response = await api.get(`/api/employees/profile/${userId}`);
                        setSelectedEmployee(response.data);
                        setEditableProfile(response.data);
                        fetchEmployees();
                        toast.success('Profile photo updated successfully');
                      } catch (error) {
                        toast.error('Failed to upload photo');
                      }
                    }
                  }}
                />
                <div className="employee-header-info">
                  <h3>{selectedEmployee.userId.firstName} {selectedEmployee.userId.lastName}</h3>
                  <p>{selectedEmployee.employeeId || 'No ID'} • {selectedEmployee.workInfo?.designation || 'No Position'}</p>
                </div>
              </div>

              <Row>
                <Col md={6}>
                  <div className="edit-section">
                    <h5><i className="fas fa-user"></i> Personal Information</h5>
                    <Form.Group className="mb-3">
                      <Form.Label>First Name</Form.Label>
                      <Form.Control type="text" value={editableProfile?.userId?.firstName || ''} 
                        onChange={(e) => setEditableProfile(prev => ({ ...prev, userId: { ...prev.userId, firstName: e.target.value } }))} />
                    </Form.Group>
                    <Form.Group className="mb-3">
                      <Form.Label>Last Name</Form.Label>
                      <Form.Control type="text" value={editableProfile?.userId?.lastName || ''} 
                        onChange={(e) => setEditableProfile(prev => ({ ...prev, userId: { ...prev.userId, lastName: e.target.value } }))} />
                    </Form.Group>
                    <Form.Group className="mb-3">
                      <Form.Label>Email</Form.Label>
                      <Form.Control type="email" value={editableProfile?.userId?.email || ''} 
                        onChange={(e) => setEditableProfile(prev => ({ ...prev, userId: { ...prev.userId, email: e.target.value } }))} />
                    </Form.Group>
                    <Form.Group className="mb-3">
                      <Form.Label>Phone</Form.Label>
                      <Form.Control type="tel" value={editableProfile?.personalInfo?.phone || ''} 
                        onChange={(e) => setEditableProfile(prev => ({ ...prev, personalInfo: { ...prev.personalInfo, phone: e.target.value } }))} />
                    </Form.Group>
                    <Form.Group className="mb-3">
                      <Form.Label>Date of Birth</Form.Label>
                      <Form.Control type="date" value={(editableProfile?.userId?.dateOfBirth && editableProfile.userId.dateOfBirth !== '1970-01-01T00:00:00.000Z' && new Date(editableProfile.userId.dateOfBirth).toISOString().slice(0,10)) || ''}
                        onChange={(e) => setEditableProfile(prev => ({ ...prev, userId: { ...prev.userId, dateOfBirth: e.target.value || null } }))} />
                    </Form.Group>
                    <Row>
                      <Col md={6}>
                        <Form.Group className="mb-3">
                          <Form.Label>Blood Group</Form.Label>
                          <Form.Control type="text" value={editableProfile?.personalInfo?.bloodGroup || ''} 
                            onChange={(e) => setEditableProfile(prev => ({ ...prev, personalInfo: { ...prev.personalInfo, bloodGroup: e.target.value } }))} />
                        </Form.Group>
                      </Col>
                      <Col md={6}>
                        <Form.Group className="mb-3">
                          <Form.Label>Marital Status</Form.Label>
                          <Form.Select value={editableProfile?.personalInfo?.maritalStatus || 'SINGLE'} 
                            onChange={(e) => setEditableProfile(prev => ({ ...prev, personalInfo: { ...prev.personalInfo, maritalStatus: e.target.value } }))}>
                            <option value="SINGLE">Single</option>
                            <option value="MARRIED">Married</option>
                            <option value="DIVORCED">Divorced</option>
                            <option value="WIDOWED">Widowed</option>
                          </Form.Select>
                        </Form.Group>
                      </Col>
                    </Row>
                  </div>

                  <div className="edit-section">
                    <h5><i className="fas fa-home"></i> Address</h5>
                    <Form.Group className="mb-3">
                      <Form.Label>Street</Form.Label>
                      <Form.Control type="text" value={editableProfile?.personalInfo?.address?.street || ''} 
                        onChange={(e) => setEditableProfile(prev => ({ ...prev, personalInfo: { ...prev.personalInfo, address: { ...prev.personalInfo?.address, street: e.target.value } } }))} />
                    </Form.Group>
                    <Row>
                      <Col md={6}>
                        <Form.Group className="mb-3">
                          <Form.Label>City</Form.Label>
                          <Form.Control type="text" value={editableProfile?.personalInfo?.address?.city || ''} 
                            onChange={(e) => setEditableProfile(prev => ({ ...prev, personalInfo: { ...prev.personalInfo, address: { ...prev.personalInfo?.address, city: e.target.value } } }))} />
                        </Form.Group>
                      </Col>
                      <Col md={6}>
                        <Form.Group className="mb-3">
                          <Form.Label>State</Form.Label>
                          <Form.Control type="text" value={editableProfile?.personalInfo?.address?.state || ''} 
                            onChange={(e) => setEditableProfile(prev => ({ ...prev, personalInfo: { ...prev.personalInfo, address: { ...prev.personalInfo?.address, state: e.target.value } } }))} />
                        </Form.Group>
                      </Col>
                    </Row>
                    <Row>
                      <Col md={6}>
                        <Form.Group className="mb-3">
                          <Form.Label>Zip Code</Form.Label>
                          <Form.Control type="text" value={editableProfile?.personalInfo?.address?.zipCode || ''} 
                            onChange={(e) => setEditableProfile(prev => ({ ...prev, personalInfo: { ...prev.personalInfo, address: { ...prev.personalInfo?.address, zipCode: e.target.value } } }))} />
                        </Form.Group>
                      </Col>
                      <Col md={6}>
                        <Form.Group className="mb-3">
                          <Form.Label>Country</Form.Label>
                          <Form.Control type="text" value={editableProfile?.personalInfo?.address?.country || ''} 
                            onChange={(e) => setEditableProfile(prev => ({ ...prev, personalInfo: { ...prev.personalInfo, address: { ...prev.personalInfo?.address, country: e.target.value } } }))} />
                        </Form.Group>
                      </Col>
                    </Row>
                  </div>
                </Col>

                <Col md={6}>
                  <div className="edit-section">
                    <h5><i className="fas fa-briefcase"></i> Work Information</h5>
                    <Form.Group className="mb-3">
                      <Form.Label>Employee ID</Form.Label>
                      <Form.Control type="text" value={editableProfile?.employeeId || editableProfile?.professionalInfo?.employeeId || ''} 
                        onChange={(e) => setEditableProfile(prev => ({ ...prev, employeeId: e.target.value, professionalInfo: { ...prev.professionalInfo, employeeId: e.target.value } }))} />
                    </Form.Group>
                    <Form.Group className="mb-3">
                      <Form.Label>Department</Form.Label>
                      <Form.Control type="text" value={editableProfile?.workInfo?.department || editableProfile?.userId?.department || ''} 
                        onChange={(e) => setEditableProfile(prev => ({ ...prev, workInfo: { ...prev.workInfo, department: e.target.value }, userId: { ...prev.userId, department: e.target.value } }))} />
                    </Form.Group>
                    <Form.Group className="mb-3">
                      <Form.Label>Designation</Form.Label>
                      <Form.Control type="text" value={editableProfile?.workInfo?.designation || editableProfile?.professionalInfo?.designation || ''} 
                        onChange={(e) => setEditableProfile(prev => ({ ...prev, workInfo: { ...prev.workInfo, designation: e.target.value }, professionalInfo: { ...prev.professionalInfo, designation: e.target.value } }))} />
                    </Form.Group>
                    <Form.Group className="mb-3">
                      <Form.Label>Work Location</Form.Label>
                      <Form.Control type="text" value={editableProfile?.workInfo?.workLocation || editableProfile?.professionalInfo?.workLocation || ''} 
                        onChange={(e) => setEditableProfile(prev => ({ ...prev, workInfo: { ...prev.workInfo, workLocation: e.target.value }, professionalInfo: { ...prev.professionalInfo, workLocation: e.target.value } }))} />
                    </Form.Group>
                    <Row>
                      <Col md={6}>
                        <Form.Group className="mb-3">
                          <Form.Label>Join Date</Form.Label>
                          <Form.Control type="date" value={(editableProfile?.userId?.joinDate && editableProfile.userId.joinDate !== '1970-01-01T00:00:00.000Z' && new Date(editableProfile.userId.joinDate).toISOString().slice(0,10)) || ''}
                            onChange={(e) => setEditableProfile(prev => ({ ...prev, userId: { ...prev.userId, joinDate: e.target.value || null } }))} />
                        </Form.Group>
                      </Col>
                      <Col md={6}>
                        <Form.Group className="mb-3">
                          <Form.Label>Employment Type</Form.Label>
                          <Form.Select value={editableProfile?.professionalInfo?.employmentType || 'FULL_TIME'} 
                            onChange={(e) => setEditableProfile(prev => ({ ...prev, professionalInfo: { ...prev.professionalInfo, employmentType: e.target.value } }))}>
                            <option value="FULL_TIME">Full Time</option>
                            <option value="PART_TIME">Part Time</option>
                            <option value="CONTRACT">Contract</option>
                            <option value="INTERN">Intern</option>
                          </Form.Select>
                        </Form.Group>
                      </Col>
                    </Row>
                  </div>

                  <div className="edit-section">
                    <h5><i className="fas fa-phone-alt"></i> Emergency Contact</h5>
                    <Form.Group className="mb-3">
                      <Form.Label>Contact Name</Form.Label>
                      <Form.Control type="text" value={editableProfile?.personalInfo?.emergencyContact?.name || ''} 
                        onChange={(e) => setEditableProfile(prev => ({ ...prev, personalInfo: { ...prev.personalInfo, emergencyContact: { ...prev.personalInfo?.emergencyContact, name: e.target.value } } }))} />
                    </Form.Group>
                    <Row>
                      <Col md={6}>
                        <Form.Group className="mb-3">
                          <Form.Label>Relationship</Form.Label>
                          <Form.Control type="text" value={editableProfile?.personalInfo?.emergencyContact?.relationship || ''} 
                            onChange={(e) => setEditableProfile(prev => ({ ...prev, personalInfo: { ...prev.personalInfo, emergencyContact: { ...prev.personalInfo?.emergencyContact, relationship: e.target.value } } }))} />
                        </Form.Group>
                      </Col>
                      <Col md={6}>
                        <Form.Group className="mb-3">
                          <Form.Label>Phone</Form.Label>
                          <Form.Control type="tel" value={editableProfile?.personalInfo?.emergencyContact?.phone || ''} 
                            onChange={(e) => setEditableProfile(prev => ({ ...prev, personalInfo: { ...prev.personalInfo, emergencyContact: { ...prev.personalInfo?.emergencyContact, phone: e.target.value } } }))} />
                        </Form.Group>
                      </Col>
                    </Row>
                  </div>

                  <div className="edit-section">
                    <h5><i className="fas fa-university"></i> Bank Details</h5>
                    <Form.Group className="mb-3">
                      <Form.Label>Account Number</Form.Label>
                      <Form.Control type="text" value={editableProfile?.bankDetails?.accountNumber || ''} 
                        onChange={(e) => setEditableProfile(prev => ({ ...prev, bankDetails: { ...prev.bankDetails, accountNumber: e.target.value } }))} />
                    </Form.Group>
                    <Form.Group className="mb-3">
                      <Form.Label>Bank Name</Form.Label>
                      <Form.Control type="text" value={editableProfile?.bankDetails?.bankName || ''} 
                        onChange={(e) => setEditableProfile(prev => ({ ...prev, bankDetails: { ...prev.bankDetails, bankName: e.target.value } }))} />
                    </Form.Group>
                    <Row>
                      <Col md={6}>
                        <Form.Group className="mb-3">
                          <Form.Label>IFSC Code</Form.Label>
                          <Form.Control type="text" value={editableProfile?.bankDetails?.ifscCode || ''} 
                            onChange={(e) => setEditableProfile(prev => ({ ...prev, bankDetails: { ...prev.bankDetails, ifscCode: e.target.value } }))} />
                        </Form.Group>
                      </Col>
                      <Col md={6}>
                        <Form.Group className="mb-3">
                          <Form.Label>Account Type</Form.Label>
                          <Form.Select value={editableProfile?.bankDetails?.accountType || 'SAVINGS'} 
                            onChange={(e) => setEditableProfile(prev => ({ ...prev, bankDetails: { ...prev.bankDetails, accountType: e.target.value } }))}>
                            <option value="SAVINGS">Savings</option>
                            <option value="CURRENT">Current</option>
                          </Form.Select>
                        </Form.Group>
                      </Col>
                    </Row>
                  </div>
                </Col>
              </Row>
            </div>
          )}
        </Modal.Body>
        <Modal.Footer className="edit-modal-footer">
          {(selectedEmployee?.userId?.isActive !== false && selectedEmployee?.isActive !== false) ? (
            <Button variant="danger" onClick={handleConfirmDelete}>
              <i className="fas fa-user-slash me-2"></i>Deactivate
            </Button>
          ) : (
            <Button variant="success" onClick={() => handleReactivate(selectedEmployee?.userId?._id || selectedEmployee?._id)}>
              <i className="fas fa-user-check me-2"></i>Reactivate
            </Button>
          )}
          <div className="ms-auto d-flex gap-2">
            <Button variant="secondary" onClick={() => setShowEditModal(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleSaveProfile}>
              <i className="fas fa-save me-2"></i>Save Changes
            </Button>
          </div>
        </Modal.Footer>
      </Modal>

      {/* Side Panel - Remove this entire section */}
      <Offcanvas show={false} onHide={() => {}} placement="end" className="profile-panel">
        <Offcanvas.Header closeButton>
          <Offcanvas.Title>
            <i className="fas fa-user-edit"></i>
            Edit Employee Profile
          </Offcanvas.Title>
        </Offcanvas.Header>
        <Offcanvas.Body>
          {profileLoading ? (
            <div className="loading-container">
              <div className="spinner-border text-primary"></div>
              <p>Loading...</p>
            </div>
          ) : selectedEmployee && (
            <div className="profile-content-v2">
              <div className="profile-header-v2">
                <div className="profile-avatar-large-v2">
                  {selectedEmployee.userId.profileImage ? (
                    <img src={selectedEmployee.userId.profileImage} alt="Profile" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
                  ) : (
                    <span className="profile-initials-large">
                      {selectedEmployee.userId.firstName?.charAt(0)}{selectedEmployee.userId.lastName?.charAt(0)}
                    </span>
                  )}
                </div>
                {['ADMIN', 'HR'].includes(user?.role) && (
                  <div className="profile-upload-btn">
                    <Button size="sm" variant="outline-primary" onClick={() => document.getElementById('profileImageInput').click()}>
                      <i className="fas fa-camera me-1"></i>Upload Photo
                    </Button>
                    <input
                      id="profileImageInput"
                      type="file"
                      accept="image/*"
                      style={{ display: 'none' }}
                      onChange={(e) => {
                        const file = e.target.files[0];
                        if (file) {
                          toast.info('Photo upload functionality will be implemented');
                        }
                      }}
                    />
                  </div>
                )}
                <h3 className="profile-name-large">{selectedEmployee.userId.firstName} {selectedEmployee.userId.lastName}</h3>
                <div className="profile-meta-badges">
                  <Badge className={`profile-role-badge ${getRoleBadgeClass(selectedEmployee.userId.role)}`}>
                    {selectedEmployee.userId.role}
                  </Badge>
                </div>
                <div className="profile-quick-stats">
                  <div className="quick-stat-item">
                    <i className="fas fa-id-badge"></i>
                    <span>{selectedEmployee.employeeId || selectedEmployee.professionalInfo?.employeeId || 'No ID'}</span>
                  </div>
                  <div className="quick-stat-divider"></div>
                  <div className="quick-stat-item">
                    <i className="fas fa-briefcase"></i>
                    <span>{selectedEmployee.workInfo?.designation || selectedEmployee.professionalInfo?.designation || 'No Position'}</span>
                  </div>
                </div>
              </div>

              <div className="profile-sections-container" style={{ padding: '1.5rem' }}>
              <div className={`profile-section ${collapsedSections.personal ? 'collapsed' : ''}`}>
                <h5 onClick={() => toggleSection('personal')}>
                  <i className="fas fa-user"></i> Personal Information
                </h5>
                {!collapsedSections.personal && (
                <div className="section-content">
                <div className="info-grid">
                  <div className="info-field">
                    <label>First Name</label>
                    {['ADMIN', 'HR'].includes(user?.role) ? (
                      <input 
                        type="text" 
                        value={editableProfile?.userId?.firstName || ''} 
                        onChange={(e) => setEditableProfile(prev => ({ ...prev, userId: { ...prev.userId, firstName: e.target.value } }))}
                      />
                    ) : (
                      <p>{selectedEmployee.userId.firstName}</p>
                    )}
                  </div>
                  <div className="info-field">
                    <label>Last Name</label>
                    {['ADMIN', 'HR'].includes(user?.role) ? (
                      <input 
                        type="text" 
                        value={editableProfile?.userId?.lastName || ''} 
                        onChange={(e) => setEditableProfile(prev => ({ ...prev, userId: { ...prev.userId, lastName: e.target.value } }))}
                      />
                    ) : (
                      <p>{selectedEmployee.userId.lastName}</p>
                    )}
                  </div>
                  <div className="info-field">
                    <label>Email</label>
                    {['ADMIN', 'HR'].includes(user?.role) ? (
                      <input 
                        type="email" 
                        value={editableProfile?.userId?.email || ''} 
                        onChange={(e) => setEditableProfile(prev => ({ ...prev, userId: { ...prev.userId, email: e.target.value } }))}
                      />
                    ) : (
                      <p>{selectedEmployee.userId.email}</p>
                    )}
                  </div>
                  <div className="info-field">
                    <label>Phone</label>
                    {['ADMIN', 'HR'].includes(user?.role) ? (
                      <input 
                        type="tel" 
                        value={editableProfile?.personalInfo?.phone || ''} 
                        onChange={(e) => setEditableProfile(prev => ({ ...prev, personalInfo: { ...prev.personalInfo, phone: e.target.value } }))}
                      />
                    ) : (
                      <p>{selectedEmployee.personalInfo?.phone || 'N/A'}</p>
                    )}
                  </div>
                  <div className="info-field">
                    <label>Date of Birth</label>
                    {['ADMIN', 'HR'].includes(user?.role) ? (
                      <input 
                        type="date" 
                        value={(editableProfile?.userId?.dateOfBirth && editableProfile.userId.dateOfBirth !== '1970-01-01T00:00:00.000Z' && new Date(editableProfile.userId.dateOfBirth).toISOString().slice(0,10)) || ''}
                        onChange={(e) => setEditableProfile(prev => ({ ...prev, userId: { ...prev.userId, dateOfBirth: e.target.value || null } }))}
                      />
                    ) : (
                      <p>{(selectedEmployee.userId?.dateOfBirth && selectedEmployee.userId.dateOfBirth !== '1970-01-01T00:00:00.000Z') ? new Date(selectedEmployee.userId.dateOfBirth).toLocaleDateString() : 'N/A'}</p>
                    )}
                  </div>
                  <div className="info-field">
                    <label>Alternate Phone</label>
                    {['ADMIN', 'HR'].includes(user?.role) ? (
                      <input 
                        type="tel" 
                        value={editableProfile?.personalInfo?.alternatePhone || ''} 
                        onChange={(e) => setEditableProfile(prev => ({ ...prev, personalInfo: { ...prev.personalInfo, alternatePhone: e.target.value } }))}
                      />
                    ) : (
                      <p>{selectedEmployee.personalInfo?.alternatePhone || 'N/A'}</p>
                    )}
                  </div>
                  <div className="info-field">
                    <label>Blood Group</label>
                    {['ADMIN', 'HR'].includes(user?.role) ? (
                      <input 
                        type="text" 
                        value={editableProfile?.personalInfo?.bloodGroup || ''} 
                        onChange={(e) => setEditableProfile(prev => ({ ...prev, personalInfo: { ...prev.personalInfo, bloodGroup: e.target.value } }))}
                      />
                    ) : (
                      <p>{selectedEmployee.personalInfo?.bloodGroup || 'N/A'}</p>
                    )}
                  </div>
                  <div className="info-field">
                    <label>Marital Status</label>
                    {['ADMIN', 'HR'].includes(user?.role) ? (
                      <select 
                        value={editableProfile?.personalInfo?.maritalStatus || 'SINGLE'} 
                        onChange={(e) => setEditableProfile(prev => ({ ...prev, personalInfo: { ...prev.personalInfo, maritalStatus: e.target.value } }))}
                      >
                        <option value="SINGLE">Single</option>
                        <option value="MARRIED">Married</option>
                        <option value="DIVORCED">Divorced</option>
                        <option value="WIDOWED">Widowed</option>
                      </select>
                    ) : (
                      <p>{selectedEmployee.personalInfo?.maritalStatus || 'N/A'}</p>
                    )}
                  </div>
                </div>
                </div>
                )}
              </div>

              <div className={`profile-section ${collapsedSections.address ? 'collapsed' : ''}`}>
                <h5 onClick={() => toggleSection('address')}>
                  <i className="fas fa-home"></i> Address
                </h5>
                {!collapsedSections.address && (
                <div className="section-content">
                <div className="info-grid">
                  <div className="info-field">
                    <label>Street</label>
                    {['ADMIN', 'HR'].includes(user?.role) ? (
                      <input 
                        type="text" 
                        value={editableProfile?.personalInfo?.address?.street || ''} 
                        onChange={(e) => setEditableProfile(prev => ({ ...prev, personalInfo: { ...prev.personalInfo, address: { ...prev.personalInfo?.address, street: e.target.value } } }))}
                      />
                    ) : (
                      <p>{selectedEmployee.personalInfo?.address?.street || 'N/A'}</p>
                    )}
                  </div>
                  <div className="info-field">
                    <label>City</label>
                    {['ADMIN', 'HR'].includes(user?.role) ? (
                      <input 
                        type="text" 
                        value={editableProfile?.personalInfo?.address?.city || ''} 
                        onChange={(e) => setEditableProfile(prev => ({ ...prev, personalInfo: { ...prev.personalInfo, address: { ...prev.personalInfo?.address, city: e.target.value } } }))}
                      />
                    ) : (
                      <p>{selectedEmployee.personalInfo?.address?.city || 'N/A'}</p>
                    )}
                  </div>
                  <div className="info-field">
                    <label>State</label>
                    {['ADMIN', 'HR'].includes(user?.role) ? (
                      <input 
                        type="text" 
                        value={editableProfile?.personalInfo?.address?.state || ''} 
                        onChange={(e) => setEditableProfile(prev => ({ ...prev, personalInfo: { ...prev.personalInfo, address: { ...prev.personalInfo?.address, state: e.target.value } } }))}
                      />
                    ) : (
                      <p>{selectedEmployee.personalInfo?.address?.state || 'N/A'}</p>
                    )}
                  </div>
                  <div className="info-field">
                    <label>Zip Code</label>
                    {['ADMIN', 'HR'].includes(user?.role) ? (
                      <input 
                        type="text" 
                        value={editableProfile?.personalInfo?.address?.zipCode || ''} 
                        onChange={(e) => setEditableProfile(prev => ({ ...prev, personalInfo: { ...prev.personalInfo, address: { ...prev.personalInfo?.address, zipCode: e.target.value } } }))}
                      />
                    ) : (
                      <p>{selectedEmployee.personalInfo?.address?.zipCode || 'N/A'}</p>
                    )}
                  </div>
                  <div className="info-field">
                    <label>Country</label>
                    {['ADMIN', 'HR'].includes(user?.role) ? (
                      <input 
                        type="text" 
                        value={editableProfile?.personalInfo?.address?.country || ''} 
                        onChange={(e) => setEditableProfile(prev => ({ ...prev, personalInfo: { ...prev.personalInfo, address: { ...prev.personalInfo?.address, country: e.target.value } } }))}
                      />
                    ) : (
                      <p>{selectedEmployee.personalInfo?.address?.country || 'N/A'}</p>
                    )}
                  </div>
                </div>
                </div>
                )}
              </div>

              <div className={`profile-section ${collapsedSections.work ? 'collapsed' : ''}`}>
                <h5 onClick={() => toggleSection('work')}>
                  <i className="fas fa-briefcase"></i> Work Information
                </h5>
                {!collapsedSections.work && (
                <div className="section-content">
                <div className="info-grid">
                  <div className="info-field">
                    <label>Employee ID</label>
                    {['ADMIN', 'HR'].includes(user?.role) ? (
                      <input 
                        type="text" 
                        value={editableProfile?.employeeId || editableProfile?.professionalInfo?.employeeId || ''} 
                        onChange={(e) => setEditableProfile(prev => ({ ...prev, employeeId: e.target.value, professionalInfo: { ...prev.professionalInfo, employeeId: e.target.value } }))}
                      />
                    ) : (
                      <p>{selectedEmployee.employeeId || selectedEmployee.professionalInfo?.employeeId || 'N/A'}</p>
                    )}
                  </div>
                  <div className="info-field">
                    <label>Department</label>
                    {['ADMIN', 'HR'].includes(user?.role) ? (
                      <input 
                        type="text" 
                        value={editableProfile?.workInfo?.department || editableProfile?.userId?.department || ''} 
                        onChange={(e) => setEditableProfile(prev => ({ ...prev, workInfo: { ...prev.workInfo, department: e.target.value }, userId: { ...prev.userId, department: e.target.value } }))}
                      />
                    ) : (
                      <p>{selectedEmployee.workInfo?.department || selectedEmployee.userId?.department || 'N/A'}</p>
                    )}
                  </div>
                  <div className="info-field">
                    <label>Designation</label>
                    {['ADMIN', 'HR'].includes(user?.role) ? (
                      <input 
                        type="text" 
                        value={editableProfile?.workInfo?.designation || editableProfile?.professionalInfo?.designation || ''} 
                        onChange={(e) => setEditableProfile(prev => ({ ...prev, workInfo: { ...prev.workInfo, designation: e.target.value }, professionalInfo: { ...prev.professionalInfo, designation: e.target.value } }))}
                      />
                    ) : (
                      <p>{selectedEmployee.workInfo?.designation || selectedEmployee.professionalInfo?.designation || 'N/A'}</p>
                    )}
                  </div>
                  <div className="info-field">
                    <label>Work Location</label>
                    {['ADMIN', 'HR'].includes(user?.role) ? (
                      <input 
                        type="text" 
                        value={editableProfile?.workInfo?.workLocation || editableProfile?.professionalInfo?.workLocation || ''} 
                        onChange={(e) => setEditableProfile(prev => ({ ...prev, workInfo: { ...prev.workInfo, workLocation: e.target.value }, professionalInfo: { ...prev.professionalInfo, workLocation: e.target.value } }))}
                      />
                    ) : (
                      <p>{selectedEmployee.workInfo?.workLocation || selectedEmployee.professionalInfo?.workLocation || 'N/A'}</p>
                    )}
                  </div>
                  <div className="info-field">
                    <label>Join Date</label>
                    {['ADMIN', 'HR'].includes(user?.role) ? (
                      <input 
                        type="date" 
                        value={(editableProfile?.userId?.joinDate && editableProfile.userId.joinDate !== '1970-01-01T00:00:00.000Z' && new Date(editableProfile.userId.joinDate).toISOString().slice(0,10)) || ''}
                        onChange={(e) => setEditableProfile(prev => ({ ...prev, userId: { ...prev.userId, joinDate: e.target.value || null } }))}
                      />
                    ) : (
                      <p>{(selectedEmployee.userId?.joinDate && selectedEmployee.userId.joinDate !== '1970-01-01T00:00:00.000Z') ? new Date(selectedEmployee.userId.joinDate).toLocaleDateString() : 'N/A'}</p>
                    )}
                  </div>
                  <div className="info-field">
                    <label>Employment Type</label>
                    {['ADMIN', 'HR'].includes(user?.role) ? (
                      <select 
                        value={editableProfile?.professionalInfo?.employmentType || 'FULL_TIME'} 
                        onChange={(e) => setEditableProfile(prev => ({ ...prev, professionalInfo: { ...prev.professionalInfo, employmentType: e.target.value } }))}
                      >
                        <option value="FULL_TIME">Full Time</option>
                        <option value="PART_TIME">Part Time</option>
                        <option value="CONTRACT">Contract</option>
                        <option value="INTERN">Intern</option>
                      </select>
                    ) : (
                      <p>{selectedEmployee.professionalInfo?.employmentType || 'N/A'}</p>
                    )}
                  </div>
                </div>
                </div>
                )}
              </div>

              <div className={`profile-section ${collapsedSections.emergency ? 'collapsed' : ''}`}>
                <h5 onClick={() => toggleSection('emergency')}>
                  <i className="fas fa-phone-alt"></i> Emergency Contact
                </h5>
                {!collapsedSections.emergency && (
                <div className="section-content">
                <div className="info-grid">
                  <div className="info-field">
                    <label>Contact Name</label>
                    {['ADMIN', 'HR'].includes(user?.role) ? (
                      <input 
                        type="text" 
                        value={editableProfile?.personalInfo?.emergencyContact?.name || ''} 
                        onChange={(e) => setEditableProfile(prev => ({ ...prev, personalInfo: { ...prev.personalInfo, emergencyContact: { ...prev.personalInfo?.emergencyContact, name: e.target.value } } }))}
                      />
                    ) : (
                      <p>{selectedEmployee.personalInfo?.emergencyContact?.name || 'N/A'}</p>
                    )}
                  </div>
                  <div className="info-field">
                    <label>Relationship</label>
                    {['ADMIN', 'HR'].includes(user?.role) ? (
                      <input 
                        type="text" 
                        value={editableProfile?.personalInfo?.emergencyContact?.relationship || ''} 
                        onChange={(e) => setEditableProfile(prev => ({ ...prev, personalInfo: { ...prev.personalInfo, emergencyContact: { ...prev.personalInfo?.emergencyContact, relationship: e.target.value } } }))}
                      />
                    ) : (
                      <p>{selectedEmployee.personalInfo?.emergencyContact?.relationship || 'N/A'}</p>
                    )}
                  </div>
                  <div className="info-field">
                    <label>Phone</label>
                    {['ADMIN', 'HR'].includes(user?.role) ? (
                      <input 
                        type="tel" 
                        value={editableProfile?.personalInfo?.emergencyContact?.phone || ''} 
                        onChange={(e) => setEditableProfile(prev => ({ ...prev, personalInfo: { ...prev.personalInfo, emergencyContact: { ...prev.personalInfo?.emergencyContact, phone: e.target.value } } }))}
                      />
                    ) : (
                      <p>{selectedEmployee.personalInfo?.emergencyContact?.phone || 'N/A'}</p>
                    )}
                  </div>
                  <div className="info-field">
                    <label>Email</label>
                    {['ADMIN', 'HR'].includes(user?.role) ? (
                      <input 
                        type="email" 
                        value={editableProfile?.personalInfo?.emergencyContact?.email || ''} 
                        onChange={(e) => setEditableProfile(prev => ({ ...prev, personalInfo: { ...prev.personalInfo, emergencyContact: { ...prev.personalInfo?.emergencyContact, email: e.target.value } } }))}
                      />
                    ) : (
                      <p>{selectedEmployee.personalInfo?.emergencyContact?.email || 'N/A'}</p>
                    )}
                  </div>
                </div>
                </div>
                )}
              </div>

              <div className={`profile-section ${collapsedSections.bank ? 'collapsed' : ''}`}>
                <h5 onClick={() => toggleSection('bank')}>
                  <i className="fas fa-university"></i> Bank Details
                </h5>
                {!collapsedSections.bank && (
                <div className="section-content">
                <div className="info-grid">
                  <div className="info-field">
                    <label>Account Number</label>
                    {['ADMIN', 'HR'].includes(user?.role) ? (
                      <input 
                        type="text" 
                        value={editableProfile?.bankDetails?.accountNumber || ''} 
                        onChange={(e) => setEditableProfile(prev => ({ ...prev, bankDetails: { ...prev.bankDetails, accountNumber: e.target.value } }))}
                      />
                    ) : (
                      <p>{selectedEmployee.bankDetails?.accountNumber ? '****' + selectedEmployee.bankDetails.accountNumber.slice(-4) : 'N/A'}</p>
                    )}
                  </div>
                  <div className="info-field">
                    <label>Bank Name</label>
                    {['ADMIN', 'HR'].includes(user?.role) ? (
                      <input 
                        type="text" 
                        value={editableProfile?.bankDetails?.bankName || ''} 
                        onChange={(e) => setEditableProfile(prev => ({ ...prev, bankDetails: { ...prev.bankDetails, bankName: e.target.value } }))}
                      />
                    ) : (
                      <p>{selectedEmployee.bankDetails?.bankName || 'N/A'}</p>
                    )}
                  </div>
                  <div className="info-field">
                    <label>IFSC Code</label>
                    {['ADMIN', 'HR'].includes(user?.role) ? (
                      <input 
                        type="text" 
                        value={editableProfile?.bankDetails?.ifscCode || ''} 
                        onChange={(e) => setEditableProfile(prev => ({ ...prev, bankDetails: { ...prev.bankDetails, ifscCode: e.target.value } }))}
                      />
                    ) : (
                      <p>{selectedEmployee.bankDetails?.ifscCode || 'N/A'}</p>
                    )}
                  </div>
                  <div className="info-field">
                    <label>Account Type</label>
                    {['ADMIN', 'HR'].includes(user?.role) ? (
                      <select 
                        value={editableProfile?.bankDetails?.accountType || 'SAVINGS'} 
                        onChange={(e) => setEditableProfile(prev => ({ ...prev, bankDetails: { ...prev.bankDetails, accountType: e.target.value } }))}
                      >
                        <option value="SAVINGS">Savings</option>
                        <option value="CURRENT">Current</option>
                      </select>
                    ) : (
                      <p>{selectedEmployee.bankDetails?.accountType || 'N/A'}</p>
                    )}
                  </div>
                </div>
                </div>
                )}
              </div>
              </div>

              {['ADMIN', 'HR'].includes(user?.role) && (
                <div className="profile-actions">
                  {selectedEmployee?.userId?.isActive ? (
                    <Button variant="danger" onClick={handleConfirmDelete}>
                      <i className="fas fa-user-slash me-2"></i>Deactivate
                    </Button>
                  ) : (
                    <Button variant="success" onClick={() => handleReactivate(selectedEmployee?.userId?._id)}>
                      <i className="fas fa-user-check me-2"></i>Reactivate
                    </Button>
                  )}
                  <Button variant="primary" onClick={handleSaveProfile}>
                    <i className="fas fa-save me-2"></i>Save Changes
                  </Button>
                </div>
              )}
            </div>
          )}
        </Offcanvas.Body>
      </Offcanvas>

      {/* Add Employee Modal */}
      <Modal show={showAddModal} onHide={() => setShowAddModal(false)} size="xl" centered>
        <Modal.Header closeButton>
          <Modal.Title>
            <i className="fas fa-user-plus me-2"></i>Add New Employee
          </Modal.Title>
        </Modal.Header>
        <Form onSubmit={handleAddEmployee}>
          <Modal.Body>
            <Row>
              <Col md={6}>
                <h6 className="mb-3 text-primary"><i className="fas fa-user me-2"></i>Basic Information</h6>
                <Form.Group className="mb-3">
                  <Form.Label>First Name *</Form.Label>
                  <Form.Control
                    type="text"
                    value={formData.firstName}
                    onChange={(e) => setFormData({...formData, firstName: e.target.value})}
                    required
                  />
                </Form.Group>
                <Form.Group className="mb-3">
                  <Form.Label>Last Name *</Form.Label>
                  <Form.Control
                    type="text"
                    value={formData.lastName}
                    onChange={(e) => setFormData({...formData, lastName: e.target.value})}
                    required
                  />
                </Form.Group>
                <Form.Group className="mb-3">
                  <Form.Label>Email *</Form.Label>
                  <Form.Control
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({...formData, email: e.target.value})}
                    required
                  />
                  <Form.Text className="text-muted">
                    Welcome email with login credentials will be sent
                  </Form.Text>
                </Form.Group>
              </Col>

              <Col md={6}>
                <h6 className="mb-3 text-success"><i className="fas fa-briefcase me-2"></i>Work Information</h6>
                <Form.Group className="mb-3">
                  <Form.Label>Department</Form.Label>
                  <Form.Select
                    value={formData.department}
                    onChange={(e) => setFormData({...formData, department: e.target.value})}
                  >
                    <option value="">Select Department</option>
                    {Array.isArray(departments) && departments.map(dept => (
                      <option key={dept._id} value={dept.name}>{dept.name}</option>
                    ))}
                  </Form.Select>
                </Form.Group>
                <Form.Group className="mb-3">
                  <Form.Label>Designation</Form.Label>
                  <Form.Control
                    type="text"
                    value={formData.designation}
                    onChange={(e) => setFormData({...formData, designation: e.target.value})}
                    placeholder="e.g., Software Developer"
                  />
                </Form.Group>
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

            <hr className="my-4" />

            <Row>
              <Col md={12}>
                <h6 className="mb-3 text-warning"><i className="fas fa-shield-alt me-2"></i>Role</h6>
              </Col>
              <Col md={12}>
                <Form.Group className="mb-3">
                  <Form.Label>Role *</Form.Label>
                  <Form.Select
                    value={formData.role}
                    onChange={(e) => handleRoleChange(e.target.value)}
                  >
                    <option value="EMPLOYEE">Employee</option>
                    <option value="MANAGER">Manager</option>
                    <option value="HR">HR</option>
                    {user.role === 'ADMIN' && <option value="ADMIN">Admin</option>}
                  </Form.Select>
                  <Form.Text className="text-muted">
                    {formData.role === 'ADMIN' && 'Full system access'}
                    {formData.role === 'HR' && 'Access to employee management, leaves, attendance'}
                    {formData.role === 'MANAGER' && 'Access to team management and approvals'}
                    {formData.role === 'EMPLOYEE' && 'Basic access to personal dashboard'}
                  </Form.Text>
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

      {/* Employee Profile Modal (View Only) */}
      <Modal show={showProfileModal} onHide={() => setShowProfileModal(false)} size="lg" centered className="view-profile-modal">
        <Modal.Body className="p-0">
          {selectedEmployee && (
            <>
              <div className="profile-view-header">
                <div className="profile-view-cover"></div>
                <button className="profile-close-btn" onClick={() => setShowProfileModal(false)}>
                  <i className="fas fa-times"></i>
                </button>
                <div className="profile-view-avatar-section">
                  <div className="profile-view-avatar">
                    {selectedEmployee.userId?.profileImage ? (
                      <img src={selectedEmployee.userId.profileImage} alt="Profile" />
                    ) : (
                      <div className="avatar-initials-view">
                        {selectedEmployee.userId?.firstName?.charAt(0)}{selectedEmployee.userId?.lastName?.charAt(0)}
                      </div>
                    )}
                  </div>
                  <div className="profile-view-info">
                    <h3>{selectedEmployee.userId?.firstName} {selectedEmployee.userId?.lastName}</h3>
                    <p>{selectedEmployee.workInfo?.designation || selectedEmployee.professionalInfo?.designation || 'No Position'}</p>
                    <div className="profile-badges">
                      <Badge bg={selectedEmployee.userId?.role === 'ADMIN' ? 'danger' : selectedEmployee.userId?.role === 'HR' ? 'warning' : selectedEmployee.userId?.role === 'MANAGER' ? 'info' : 'secondary'}>
                        {selectedEmployee.userId?.role}
                      </Badge>
                      <Badge bg={(selectedEmployee.userId?.isActive !== false) ? 'success' : 'danger'}>
                        {(selectedEmployee.userId?.isActive !== false) ? 'Active' : 'Inactive'}
                      </Badge>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="profile-view-content">
                {selectedEmployee.userId?.exitDetails && (
                  <div style={{ padding: '1rem', background: '#fef2f2', borderLeft: '4px solid #ef4444', margin: '1rem', borderRadius: '8px' }}>
                    <h6 style={{ color: '#dc2626', marginBottom: '1rem' }}>
                      <i className="fas fa-exclamation-triangle me-2"></i>Exit Information
                    </h6>
                    <Row className="g-2">
                      <Col md={6}>
                        <small style={{ color: '#64748b' }}>Exit Reason:</small>
                        <div style={{ fontWeight: 600 }}>{selectedEmployee.userId.exitDetails.reason?.replace(/_/g, ' ')}</div>
                      </Col>
                      <Col md={6}>
                        <small style={{ color: '#64748b' }}>Last Working Day:</small>
                        <div style={{ fontWeight: 600 }}>{new Date(selectedEmployee.userId.exitDetails.exitDate).toLocaleDateString()}</div>
                      </Col>
                      <Col md={6}>
                        <small style={{ color: '#64748b' }}>Exit Interview:</small>
                        <div style={{ fontWeight: 600 }}>{selectedEmployee.userId.exitDetails.exitInterview}</div>
                      </Col>
                      <Col md={6}>
                        <small style={{ color: '#64748b' }}>Handover Status:</small>
                        <div style={{ fontWeight: 600 }}>{selectedEmployee.userId.exitDetails.handoverStatus?.replace(/_/g, ' ')}</div>
                      </Col>
                      {selectedEmployee.userId.exitDetails.notes && (
                        <Col md={12}>
                          <small style={{ color: '#64748b' }}>Notes:</small>
                          <div style={{ fontWeight: 600 }}>{selectedEmployee.userId.exitDetails.notes}</div>
                        </Col>
                      )}
                      <Col md={12}>
                        <small style={{ color: '#64748b' }}>Deactivated On:</small>
                        <div style={{ fontWeight: 600 }}>{new Date(selectedEmployee.userId.exitDetails.deactivatedAt).toLocaleString()}</div>
                      </Col>
                    </Row>
                  </div>
                )}
                
                <Row className="g-3">
                  <Col md={6}>
                    <div className="profile-info-card">
                      <div className="info-card-header">
                        <i className="fas fa-envelope"></i>
                        <span>Contact Information</span>
                      </div>
                      <div className="info-card-body">
                        <div className="info-row">
                          <span className="info-label">Email</span>
                          <span className="info-value">{selectedEmployee.userId?.email}</span>
                        </div>
                        <div className="info-row">
                          <span className="info-label">Phone</span>
                          <span className="info-value">{selectedEmployee.personalInfo?.phone || 'Not provided'}</span>
                        </div>
                      </div>
                    </div>
                  </Col>
                  
                  <Col md={6}>
                    <div className="profile-info-card">
                      <div className="info-card-header">
                        <i className="fas fa-briefcase"></i>
                        <span>Work Information</span>
                      </div>
                      <div className="info-card-body">
                        <div className="info-row">
                          <span className="info-label">Department</span>
                          <span className="info-value">{selectedEmployee.userId?.department || 'Not assigned'}</span>
                        </div>
                        <div className="info-row">
                          <span className="info-label">Employee ID</span>
                          <span className="info-value">{selectedEmployee.employeeId || selectedEmployee.professionalInfo?.employeeId || 'Not assigned'}</span>
                        </div>
                      </div>
                    </div>
                  </Col>
                  
                  <Col md={6}>
                    <div className="profile-info-card">
                      <div className="info-card-header">
                        <i className="fas fa-calendar"></i>
                        <span>Important Dates</span>
                      </div>
                      <div className="info-card-body">
                        <div className="info-row">
                          <span className="info-label">Join Date</span>
                          <span className="info-value">{selectedEmployee.userId?.joinDate ? new Date(selectedEmployee.userId.joinDate).toLocaleDateString() : 'Not set'}</span>
                        </div>
                        <div className="info-row">
                          <span className="info-label">Date of Birth</span>
                          <span className="info-value">{selectedEmployee.userId?.dateOfBirth ? new Date(selectedEmployee.userId.dateOfBirth).toLocaleDateString() : 'Not set'}</span>
                        </div>
                      </div>
                    </div>
                  </Col>
                  
                  <Col md={6}>
                    <div className="profile-info-card">
                      <div className="info-card-header">
                        <i className="fas fa-map-marker-alt"></i>
                        <span>Location</span>
                      </div>
                      <div className="info-card-body">
                        <div className="info-row">
                          <span className="info-label">Work Location</span>
                          <span className="info-value">{selectedEmployee.workInfo?.workLocation || selectedEmployee.professionalInfo?.workLocation || 'Not set'}</span>
                        </div>
                        <div className="info-row">
                          <span className="info-label">Employment Type</span>
                          <span className="info-value">{selectedEmployee.professionalInfo?.employmentType || 'Full Time'}</span>
                        </div>
                      </div>
                    </div>
                  </Col>
                </Row>
                
                {['ADMIN', 'HR'].includes(user?.role) && (
                  <div className="profile-view-actions" style={{ display: 'flex', gap: '0.75rem', padding: '1.5rem', borderTop: '1px solid #e9ecef', background: '#f8f9fa' }}>
                    {(selectedEmployee.userId?.isActive !== false) ? (
                      <Button variant="danger" onClick={handleConfirmDelete} style={{ flex: 1 }}>
                        <i className="fas fa-user-slash me-2"></i>Deactivate
                      </Button>
                    ) : (
                      <Button variant="success" onClick={() => handleReactivate(selectedEmployee.userId?._id)} style={{ flex: 1 }}>
                        <i className="fas fa-user-check me-2"></i>Reactivate
                      </Button>
                    )}
                    {user?.role === 'ADMIN' && (
                      <>
                        <Button variant="info" onClick={handleChangeRole} style={{ flex: 1 }}>
                          <i className="fas fa-user-tag me-2"></i>Change Role
                        </Button>
                        <Button variant="warning" onClick={handleResetPassword} style={{ flex: 1 }}>
                          <i className="fas fa-key me-2"></i>Reset Password
                        </Button>
                        <Button variant="outline-danger" onClick={handleDeletePermanently} style={{ flex: 1 }}>
                          <i className="fas fa-trash me-2"></i>Delete
                        </Button>
                      </>
                    )}
                    <Button variant="primary" onClick={handleEditProfile} style={{ flex: 1 }}>
                      <i className="fas fa-edit me-2"></i>Edit Profile
                    </Button>
                  </div>
                )}
              </div>
            </>
          )}
        </Modal.Body>
      </Modal>
    </div>
  );
};

export default EmployeeDirectory;
