import { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { Row, Col, Card, Form, Button, Tab, Tabs, Image } from 'react-bootstrap';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import { toast } from 'react-toastify';

const EmployeeProfile = () => {
  const { user } = useAuth();
  const { id } = useParams();
  const fileInputRef = useRef(null);
  const [profile, setProfile] = useState({
    personalInfo: {
      phone: '',
      address: { street: '', city: '', state: '', zipCode: '', country: '' },
      emergencyContact: { name: '', relationship: '', phone: '', email: '' },
      bloodGroup: '',
      maritalStatus: 'SINGLE'
    },
    professionalInfo: {
      employeeId: '',
      designation: '',
      workLocation: '',
      employmentType: 'FULL_TIME',
      skills: [],
      certifications: []
    },
    bankDetails: {
      accountNumber: '',
      bankName: '',
      ifscCode: '',
      accountType: 'SAVINGS'
    }
  });
  const [loading, setLoading] = useState(true);
  const [uploadingImage, setUploadingImage] = useState(false);

  useEffect(() => {
    fetchProfile();
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchProfile = async () => {
    try {
      const response = await api.get('/api/employee-profiles/me');
      setProfile(response.data);
    } catch (error) {
      console.error('Error fetching profile:', error);
      const msg = error.response?.data?.message || error.message || 'Failed to load profile';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await api.put('/api/employee-profiles/me', profile);
      toast.success('Profile updated successfully');
    } catch (error) {
      console.error('Error updating profile:', error);
      toast.error(error.response?.data?.message || 'Error updating profile');
    }
  };

  const handleDelete = async () => {
    if (!id || user?.role !== 'ADMIN') {
      toast.error('Only admins can delete profiles');
      return;
    }
    
    const result = await window.confirm(`Are you sure you want to delete this employee? This action cannot be undone!`);
    if (result) {
      try {
        await api.delete(`/api/users/${id}`);
        toast.success('Employee deleted successfully');
        window.history.back();
      } catch (error) {
        console.error('Error deleting employee:', error);
        toast.error(error.response?.data?.message || 'Error deleting employee');
      }
    }
  };

  const handleImageUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image size should be less than 5MB');
      return;
    }

    setUploadingImage(true);
    const formData = new FormData();
    formData.append('profileImage', file);

    try {
      const response = await api.post('/api/employee-profiles/me/profile-image', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
      
      setProfile(prev => ({
        ...prev,
        userId: {
          ...prev.userId,
          profileImage: response.data.profileImage
        }
      }));
      
      toast.success('Profile image updated successfully');
    } catch (error) {
      console.error('Error uploading image:', error);
      toast.error(error.response?.data?.message || 'Error uploading image');
    } finally {
      setUploadingImage(false);
    }
  };

  const handleImageDelete = async () => {
    try {
      await api.delete('/api/employee-profiles/me/profile-image');
      setProfile(prev => ({
        ...prev,
        userId: {
          ...prev.userId,
          profileImage: null
        }
      }));
      toast.success('Profile image deleted successfully');
    } catch (error) {
      console.error('Error deleting image:', error);
      toast.error(error.response?.data?.message || 'Error deleting image');
    }
  };

  const updateNestedField = (section, field, value) => {
    setProfile(prev => ({
      ...prev,
      [section]: {
        ...prev[section],
        [field]: value
      }
    }));
  };

  if (loading) {
    return (
      <div className="d-flex justify-content-center align-items-center" style={{height: '400px'}}>
        <div className="spinner-border text-primary" role="status"></div>
      </div>
    );
  }

  return (
    <div className="fade-in-up employee-profile-page">
      <style>{`
        .employee-profile-page .profile-header-card {
          background: linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%);
          border: none;
          border-radius: 16px;
          overflow: hidden;
          margin-bottom: 24px;
        }
        .employee-profile-page .profile-avatar-wrapper {
          position: relative;
          display: inline-block;
        }
        .employee-profile-page .profile-avatar {
          width: 140px;
          height: 140px;
          border: 5px solid rgba(255,255,255,0.3);
          box-shadow: 0 8px 24px rgba(0,0,0,0.15);
        }
        .employee-profile-page .profile-avatar-placeholder {
          width: 140px;
          height: 140px;
          background: rgba(255,255,255,0.2);
          border: 5px solid rgba(255,255,255,0.3);
          box-shadow: 0 8px 24px rgba(0,0,0,0.15);
        }
        .employee-profile-page .profile-upload-btn {
          position: absolute;
          bottom: 5px;
          right: 5px;
          width: 40px;
          height: 40px;
          border-radius: 50%;
          background: #fff;
          border: 3px solid #667eea;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.3s;
        }
        .employee-profile-page .profile-upload-btn:hover {
          transform: scale(1.1);
          box-shadow: 0 4px 12px rgba(0,0,0,0.2);
        }
        .employee-profile-page .profile-info-card {
          border: none;
          border-radius: 12px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.08);
          transition: all 0.3s;
        }
        .employee-profile-page .profile-info-card:hover {
          box-shadow: 0 4px 16px rgba(0,0,0,0.12);
        }
        .employee-profile-page .profile-tabs .nav-link {
          border: none;
          border-radius: 8px;
          padding: 12px 24px;
          margin-right: 8px;
          color: #6c757d;
          font-weight: 500;
          transition: all 0.3s;
        }
        .employee-profile-page .profile-tabs .nav-link:hover {
          background: #f8fafc;
          color: #1e3a8a;
        }
        .employee-profile-page .profile-tabs .nav-link.active {
          background: linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%);
          color: white;
        }
        .employee-profile-page .form-label {
          font-weight: 600;
          color: #495057;
          margin-bottom: 8px;
          font-size: 0.9rem;
        }
        .employee-profile-page .form-control, .employee-profile-page .form-select {
          border-radius: 8px;
          border: 1.5px solid #e0e0e0;
          padding: 10px 14px;
          transition: all 0.3s;
        }
        .employee-profile-page .form-control:focus, .employee-profile-page .form-select:focus {
          border-color: #3b82f6;
          box-shadow: 0 0 0 0.2rem rgba(59, 130, 246, 0.15);
        }
        .employee-profile-page .section-title {
          font-size: 1.1rem;
          font-weight: 600;
          color: #1e3a8a;
          margin-bottom: 20px;
          padding-bottom: 10px;
          border-bottom: 2px solid #e0e0e0;
        }
        .employee-profile-page .btn-save {
          background: linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%);
          border: none;
          border-radius: 8px;
          padding: 12px 32px;
          font-weight: 600;
          transition: all 0.3s;
        }
        .employee-profile-page .btn-save:hover {
          transform: translateY(-2px);
          box-shadow: 0 6px 20px rgba(59, 130, 246, 0.4);
        }
      `}</style>

      <Form onSubmit={handleSubmit}>
        <Card className="profile-header-card">
          <Card.Body className="p-4">
            <Row className="align-items-center">
              <Col md={3} className="text-center">
                <div className="profile-avatar-wrapper">
                  {profile.userId?.profileImage ? (
                    <Image
                      src={profile.userId.profileImage}
                      alt="Profile"
                      roundedCircle
                      className="profile-avatar"
                      style={{ objectFit: 'cover' }}
                    />
                  ) : (
                    <div className="d-flex align-items-center justify-content-center rounded-circle profile-avatar-placeholder">
                      <i className="fas fa-user fa-3x text-white"></i>
                    </div>
                  )}
                  <div className="profile-upload-btn" style={{ border: '3px solid #1e3a8a' }} onClick={() => fileInputRef.current?.click()}>
                    {uploadingImage ? (
                      <div className="spinner-border spinner-border-sm" style={{ color: '#1e3a8a' }} role="status"></div>
                    ) : (
                      <i className="fas fa-camera" style={{ color: '#1e3a8a' }}></i>
                    )}
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    style={{ display: 'none' }}
                  />
                </div>
                {profile.userId?.profileImage && (
                  <Button
                    variant="link"
                    size="sm"
                    className="text-white mt-2"
                    onClick={handleImageDelete}
                    style={{ textDecoration: 'none', opacity: 0.9 }}
                  >
                    <i className="fas fa-trash me-1"></i>Remove Photo
                  </Button>
                )}
              </Col>
              <Col md={9}>
                <h2 className="text-white mb-2">{profile.userId?.firstName} {profile.userId?.lastName}</h2>
                <p className="text-white mb-3" style={{ opacity: 0.9, fontSize: '1.1rem' }}>
                  <i className="fas fa-briefcase me-2"></i>
                  {profile.professionalInfo?.designation || profile.userId?.designation || 'Employee'}
                </p>
                <Row className="g-3">
                  <Col md={4}>
                    <div className="d-flex align-items-center text-white" style={{ opacity: 0.9 }}>
                      <i className="fas fa-envelope me-2"></i>
                      <small>{profile.userId?.email}</small>
                    </div>
                  </Col>
                  <Col md={4}>
                    <div className="d-flex align-items-center text-white" style={{ opacity: 0.9 }}>
                      <i className="fas fa-building me-2"></i>
                      <small>
                        {typeof profile.userId?.department === 'object' 
                          ? profile.userId?.department?.name 
                          : profile.professionalInfo?.department || profile.userId?.department || 'N/A'}
                      </small>
                    </div>
                  </Col>
                  <Col md={4}>
                    <div className="d-flex align-items-center text-white" style={{ opacity: 0.9 }}>
                      <i className="fas fa-id-badge me-2"></i>
                      <small>{profile.professionalInfo?.employeeId || profile.userId?.employeeId || 'Not Set'}</small>
                    </div>
                  </Col>
                </Row>
              </Col>
            </Row>
          </Card.Body>
        </Card>

        <Card className="profile-info-card mb-4">
          <Card.Body className="p-4">
            <h5 className="section-title"><i className="fas fa-user-edit me-2 text-primary"></i>Basic Information</h5>
            <Row className="g-3">
              <Col md={4}>
                <Form.Group>
                  <Form.Label><i className="fas fa-user me-2"></i>First Name</Form.Label>
                  <Form.Control value={profile.userId?.firstName || ''} onChange={(e) => setProfile(prev => ({ ...prev, userId: { ...prev.userId, firstName: e.target.value } }))} disabled={!!id && user?.role !== 'ADMIN'} />
                </Form.Group>
              </Col>
              <Col md={4}>
                <Form.Group>
                  <Form.Label><i className="fas fa-user me-2"></i>Last Name</Form.Label>
                  <Form.Control value={profile.userId?.lastName || ''} onChange={(e) => setProfile(prev => ({ ...prev, userId: { ...prev.userId, lastName: e.target.value } }))} disabled={!!id && user?.role !== 'ADMIN'} />
                </Form.Group>
              </Col>
              <Col md={4}>
                <Form.Group>
                  <Form.Label><i className="fas fa-envelope me-2"></i>Email</Form.Label>
                  <Form.Control type="email" value={profile.userId?.email || ''} onChange={(e) => setProfile(prev => ({ ...prev, userId: { ...prev.userId, email: e.target.value } }))} disabled={!!id && user?.role !== 'ADMIN'} />
                </Form.Group>
              </Col>
              <Col md={4}>
                <Form.Group>
                  <Form.Label><i className="fas fa-building me-2"></i>Department</Form.Label>
                  <Form.Control value={profile.professionalInfo?.department || profile.userId?.department || ''} onChange={(e) => setProfile(prev => ({ ...prev, professionalInfo: { ...prev.professionalInfo, department: e.target.value }, userId: { ...prev.userId, department: e.target.value } }))} disabled={!!id && user?.role !== 'ADMIN'} />
                </Form.Group>
              </Col>
            </Row>
          </Card.Body>
        </Card>
        <Tabs defaultActiveKey="personal" className="mb-4 profile-tabs">
          <Tab eventKey="personal" title={<><i className="fas fa-user me-2"></i>Personal Info</>}>
            <Card className="profile-info-card">
              <Card.Body className="p-4">
                <h5 className="section-title"><i className="fas fa-address-card me-2 text-primary"></i>Personal Details</h5>
                <Row>
                  <Col md={6}>
                    <Form.Group className="mb-3">
                      <Form.Label>Phone</Form.Label>
                      <Form.Control
                        type="tel"
                        value={profile.personalInfo?.phone || ''}
                        onChange={(e) => updateNestedField('personalInfo', 'phone', e.target.value)}
                        disabled={!!id && user?.role !== 'ADMIN'}
                      />
                    </Form.Group>
                  </Col>
                  <Col md={6}>
                    <Form.Group className="mb-3">
                      <Form.Label>Blood Group</Form.Label>
                      <Form.Control
                        type="text"
                        value={profile.personalInfo?.bloodGroup || ''}
                        onChange={(e) => updateNestedField('personalInfo', 'bloodGroup', e.target.value)}
                        disabled={!!id && user?.role !== 'ADMIN'}
                      />
                    </Form.Group>
                  </Col>
                </Row>
                <Row>
                  <Col md={6}>
                    <Form.Group className="mb-3">
                      <Form.Label>Marital Status</Form.Label>
                      <Form.Select
                        value={profile.personalInfo?.maritalStatus || 'SINGLE'}
                        onChange={(e) => updateNestedField('personalInfo', 'maritalStatus', e.target.value)}
                        disabled={!!id && user?.role !== 'ADMIN'}
                      >
                        <option value="SINGLE">Single</option>
                        <option value="MARRIED">Married</option>
                        <option value="DIVORCED">Divorced</option>
                        <option value="WIDOWED">Widowed</option>
                      </Form.Select>
                    </Form.Group>
                  </Col>
                  <Col md={6}>
                    <Form.Group className="mb-3">
                      <Form.Label>Date of Birth</Form.Label>
                      {user?.role === 'ADMIN' || user?.role === 'HR' ? (
                        <Form.Control
                          type="date"
                          value={profile.userId?.dateOfBirth && profile.userId.dateOfBirth !== '1970-01-01T00:00:00.000Z' ? 
                            new Date(profile.userId.dateOfBirth).toISOString().split('T')[0] : ''}
                          onChange={(e) => setProfile(prev => ({ 
                            ...prev, 
                            userId: { ...prev.userId, dateOfBirth: e.target.value || null } 
                          }))}
                          disabled={!!id && user?.role !== 'ADMIN' && user?.role !== 'HR'}
                        />
                      ) : (
                        <Form.Control
                          type="text"
                          value={profile.userId?.dateOfBirth && profile.userId.dateOfBirth !== '1970-01-01T00:00:00.000Z' ? new Date(profile.userId.dateOfBirth).toLocaleDateString('en-GB', {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric'
                          }) : ''}
                          readOnly
                          disabled
                          style={{ backgroundColor: '#f8f9fa', cursor: 'not-allowed' }}
                          placeholder="Not set"
                        />
                      )}
                    </Form.Group>
                  </Col>
                </Row>
                <h5 className="section-title mt-4"><i className="fas fa-map-marker-alt me-2 text-primary"></i>Address Information</h5>
                <Row>
                  <Col md={12}>
                    <Form.Group className="mb-3">
                      <Form.Label>Street</Form.Label>
                      <Form.Control
                        type="text"
                        value={profile.personalInfo?.address?.street || ''}
                        onChange={(e) => updateNestedField('personalInfo', 'address', {
                          ...profile.personalInfo?.address,
                          street: e.target.value
                        })}
                        disabled={!!id && user?.role !== 'ADMIN'}
                      />
                    </Form.Group>
                  </Col>
                </Row>
                <Row>
                  <Col md={6}>
                    <Form.Group className="mb-3">
                      <Form.Label>City</Form.Label>
                      <Form.Control
                        type="text"
                        value={profile.personalInfo?.address?.city || ''}
                        onChange={(e) => updateNestedField('personalInfo', 'address', {
                          ...profile.personalInfo?.address,
                          city: e.target.value
                        })}
                        disabled={!!id && user?.role !== 'ADMIN'}
                      />
                    </Form.Group>
                  </Col>
                  <Col md={6}>
                    <Form.Group className="mb-3">
                      <Form.Label>State</Form.Label>
                      <Form.Control
                        type="text"
                        value={profile.personalInfo?.address?.state || ''}
                        onChange={(e) => updateNestedField('personalInfo', 'address', {
                          ...profile.personalInfo?.address,
                          state: e.target.value
                        })}
                        disabled={!!id && user?.role !== 'ADMIN'}
                      />
                    </Form.Group>
                  </Col>
                </Row>
              </Card.Body>
            </Card>
          </Tab>
          <Tab eventKey="professional" title={<><i className="fas fa-briefcase me-2"></i>Professional Info</>}>
            <Card className="profile-info-card">
              <Card.Body className="p-4">
                <h5 className="section-title"><i className="fas fa-id-card me-2 text-primary"></i>Professional Details</h5>
                <Row>
                  <Col md={6}>
                    <Form.Group className="mb-3">
                      <Form.Label>Employee ID</Form.Label>
                      <Form.Control
                        type="text"
                        value={profile.professionalInfo?.employeeId || ''}
                        onChange={(e) => updateNestedField('professionalInfo', 'employeeId', e.target.value)}
                        disabled={!!id && user?.role !== 'ADMIN'}
                      />
                    </Form.Group>
                  </Col>
                  <Col md={6}>
                    <Form.Group className="mb-3">
                      <Form.Label>Designation</Form.Label>
                      <Form.Control
                        type="text"
                        value={profile.professionalInfo?.designation || ''}
                        onChange={(e) => updateNestedField('professionalInfo', 'designation', e.target.value)}
                        disabled={!!id && user?.role !== 'ADMIN'}
                      />
                    </Form.Group>
                  </Col>
                </Row>
                <Row>
                  <Col md={6}>
                    <Form.Group className="mb-3">
                      <Form.Label>Work Location</Form.Label>
                      <Form.Control
                        type="text"
                        value={profile.professionalInfo?.workLocation || ''}
                        onChange={(e) => updateNestedField('professionalInfo', 'workLocation', e.target.value)}
                        disabled={!!id && user?.role !== 'ADMIN'}
                      />
                    </Form.Group>
                  </Col>
                  <Col md={6}>
                    <Form.Group className="mb-3">
                      <Form.Label>Employment Type</Form.Label>
                      <Form.Select
                        value={profile.professionalInfo?.employmentType || 'FULL_TIME'}
                        onChange={(e) => updateNestedField('professionalInfo', 'employmentType', e.target.value)}
                        disabled={!!id && user?.role !== 'ADMIN'}
                      >
                        <option value="FULL_TIME">Full Time</option>
                        <option value="PART_TIME">Part Time</option>
                        <option value="CONTRACT">Contract</option>
                        <option value="INTERN">Intern</option>
                      </Form.Select>
                    </Form.Group>
                  </Col>
                </Row>
                <Row>
                  <Col md={6}>
                    <Form.Group className="mb-3">
                      <Form.Label>
                        <i className="fas fa-calendar-alt me-2"></i>
                        Date of Joining
                      </Form.Label>
                      {user?.role === 'ADMIN' || user?.role === 'HR' ? (
                        <Form.Control
                          type="date"
                          value={profile.userId?.joinDate && profile.userId.joinDate !== '1970-01-01T00:00:00.000Z' ? 
                            new Date(profile.userId.joinDate).toISOString().split('T')[0] : ''}
                          onChange={(e) => setProfile(prev => ({ 
                            ...prev, 
                            userId: { ...prev.userId, joinDate: e.target.value || null } 
                          }))}
                        />
                      ) : (
                        <Form.Control
                          type="text"
                          value={profile.userId?.joinDate && profile.userId.joinDate !== '1970-01-01T00:00:00.000Z' ? new Date(profile.userId.joinDate).toLocaleDateString('en-GB', {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric'
                          }) : ''}
                          readOnly
                          disabled
                          style={{ backgroundColor: '#f8f9fa', cursor: 'not-allowed' }}
                          placeholder="Not set"
                        />
                      )}
                      <Form.Text className="text-muted">
                        This is your official joining date with the company
                      </Form.Text>
                    </Form.Group>
                  </Col>
                </Row>
              </Card.Body>
            </Card>
          </Tab>
          <Tab eventKey="bank" title={<><i className="fas fa-university me-2"></i>Bank Details</>}>
            <Card className="profile-info-card">
              <Card.Body className="p-4">
                <h5 className="section-title"><i className="fas fa-piggy-bank me-2 text-primary"></i>Banking Information</h5>
                <Row>
                  <Col md={6}>
                    <Form.Group className="mb-3">
                      <Form.Label>Account Number</Form.Label>
                      <Form.Control
                        type="text"
                        value={profile.bankDetails?.accountNumber || ''}
                        onChange={(e) => updateNestedField('bankDetails', 'accountNumber', e.target.value)}
                        disabled={!!id && user?.role !== 'ADMIN'}
                      />
                    </Form.Group>
                  </Col>
                  <Col md={6}>
                    <Form.Group className="mb-3">
                      <Form.Label>Bank Name</Form.Label>
                      <Form.Control
                        type="text"
                        value={profile.bankDetails?.bankName || ''}
                        onChange={(e) => updateNestedField('bankDetails', 'bankName', e.target.value)}
                        disabled={!!id && user?.role !== 'ADMIN'}
                      />
                    </Form.Group>
                  </Col>
                </Row>
                <Row>
                  <Col md={6}>
                    <Form.Group className="mb-3">
                      <Form.Label>IFSC Code</Form.Label>
                      <Form.Control
                        type="text"
                        value={profile.bankDetails?.ifscCode || ''}
                        onChange={(e) => updateNestedField('bankDetails', 'ifscCode', e.target.value)}
                        disabled={!!id && user?.role !== 'ADMIN'}
                      />
                    </Form.Group>
                  </Col>
                  <Col md={6}>
                    <Form.Group className="mb-3">
                      <Form.Label>Account Type</Form.Label>
                      <Form.Select
                        value={profile.bankDetails?.accountType || 'SAVINGS'}
                        onChange={(e) => updateNestedField('bankDetails', 'accountType', e.target.value)}
                        disabled={!!id && user?.role !== 'ADMIN'}
                      >
                        <option value="SAVINGS">Savings</option>
                        <option value="CURRENT">Current</option>
                        <option value="SALARY">Salary</option>
                      </Form.Select>
                    </Form.Group>
                  </Col>
                </Row>
              </Card.Body>
            </Card>
          </Tab>
        </Tabs>

        <div className="d-flex justify-content-between align-items-center mt-4">
          <div>
            {id && user?.role === 'ADMIN' && (
              <Button variant="outline-danger" size="lg" onClick={handleDelete} style={{ borderRadius: '8px' }}>
                <i className="fas fa-trash me-2"></i>Delete Employee
              </Button>
            )}
          </div>
          <Button className="btn-save" type="submit" size="lg" disabled={!!id && user?.role !== 'ADMIN'}>
            <i className="fas fa-save me-2"></i>Save Changes
          </Button>
        </div>
      </Form>
    </div>
  );
};

export default EmployeeProfile;