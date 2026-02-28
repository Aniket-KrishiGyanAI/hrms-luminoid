import React, { useState, useEffect } from 'react';
import { Card, Form, Button, Alert, Row, Col } from 'react-bootstrap';
import { toast } from 'react-toastify';
import api from '../utils/api';

const ApplyLeave = () => {
  const [formData, setFormData] = useState({
    leaveTypeId: '',
    startDate: '',
    endDate: '',
    isHalfDay: false,
    halfDayType: 'FIRST_HALF',
    reason: '',
    contactNumber: '',
    emergencyContact: '',
    addressDuringLeave: '',
    handoverTo: '',
    attachments: []
  });
  const [leaveTypes, setLeaveTypes] = useState([]);
  const [balances, setBalances] = useState([]);
  const [teamMembers, setTeamMembers] = useState([]);
  const [conflicts, setConflicts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [workingDays, setWorkingDays] = useState(0);

  const reasonTemplates = [
    { value: '', label: 'Select a template (optional)' },
    { value: 'Medical reasons requiring rest and recovery', label: 'Sick Leave' },
    { value: 'Personal work and family commitments', label: 'Personal Work' },
    { value: 'Planned vacation with family', label: 'Vacation' },
    { value: 'Attending to family emergency', label: 'Family Emergency' },
    { value: 'Medical appointment', label: 'Medical Appointment' },
    { value: 'Attending wedding ceremony', label: 'Wedding' },
    { value: 'Religious observance', label: 'Religious' }
  ];

  useEffect(() => {
    fetchLeaveTypes();
    fetchBalances();
    fetchTeamMembers();
  }, []);

  useEffect(() => {
    if (formData.startDate && formData.endDate) {
      calculateWorkingDays();
      checkTeamConflicts();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData.startDate, formData.endDate, formData.isHalfDay]);

  const fetchLeaveTypes = async () => {
    try {
      const response = await api.get('/api/leave-types?active=true');
      setLeaveTypes(response.data);
    } catch (error) {
      console.error('Error fetching leave types:', error);
    }
  };

  const fetchBalances = async () => {
    try {
      const response = await api.get('/api/leave-balances');
      setBalances(response.data);
    } catch (error) {
      console.error('Error fetching balances:', error);
    }
  };

  const fetchTeamMembers = async () => {
    try {
      const response = await api.get('/api/dashboard/team-members');
      setTeamMembers(response.data || []);
    } catch (error) {
      console.error('Error fetching team members:', error);
      setTeamMembers([]);
    }
  };

  const calculateWorkingDays = () => {
    const start = new Date(formData.startDate);
    const end = new Date(formData.endDate);
    let count = 0;
    let current = new Date(start);
    
    while (current <= end) {
      const day = current.getDay();
      if (day !== 0 && day !== 6) count++;
      current.setDate(current.getDate() + 1);
    }
    setWorkingDays(formData.isHalfDay ? 0.5 : count);
  };

  const checkTeamConflicts = async () => {
    try {
      const response = await api.post('/api/leave-requests/check-conflicts', {
        startDate: formData.startDate,
        endDate: formData.endDate
      });
      setConflicts(response.data.conflicts || []);
    } catch (error) {
      console.error('Error checking conflicts:', error);
      setConflicts([]);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      await api.post('/api/leave-requests', formData);
      toast.success(
        <div className="d-flex align-items-center">
          <i className="fas fa-check-circle me-2"></i>
          Leave request submitted successfully!
        </div>
      );
      setFormData({
        leaveTypeId: '',
        startDate: '',
        endDate: '',
        isHalfDay: false,
        halfDayType: 'FIRST_HALF',
        reason: '',
        contactNumber: '',
        emergencyContact: '',
        addressDuringLeave: '',
        handoverTo: '',
        attachments: []
      });
      setShowAdvanced(false);
      fetchBalances();
    } catch (error) {
      setError(error.response?.data?.message || 'Error submitting leave request');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    let updates = { [name]: type === 'checkbox' ? checked : value };
    
    // If half-day is checked, set end date to start date
    if (name === 'isHalfDay' && checked && formData.startDate) {
      updates.endDate = formData.startDate;
    }
    
    // If start date changes and half-day is checked, update end date
    if (name === 'startDate' && formData.isHalfDay) {
      updates.endDate = value;
    }
    
    setFormData(prev => ({ ...prev, ...updates }));
  };

  const getAvailableBalance = (leaveTypeId) => {
    const balance = balances.find(b => b.leaveTypeId?._id === leaveTypeId);
    return balance ? balance.available : 0;
  };

  const calculateDays = () => {
    if (!formData.startDate || !formData.endDate) return 0;
    const start = new Date(formData.startDate);
    const end = new Date(formData.endDate);
    const days = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;
    return formData.isHalfDay ? 0.5 : days;
  };

  const selectedLeaveType = leaveTypes.find(type => type._id === formData.leaveTypeId);
  const selectedBalance = balances.find(b => b.leaveTypeId?._id === formData.leaveTypeId);
  const requestedDays = calculateDays();
  const availableDays = selectedBalance ? selectedBalance.available : 0;
  const willBeOverdrawn = requestedDays > availableDays;

  return (
    <div className="fade-in-up">
      <div className="page-header">
        <h1 className="page-title">
          <i className="fas fa-plus-circle me-3 text-success"></i>
          Apply for Leave
        </h1>
        <p className="text-muted mb-0">Submit a new leave request for approval</p>
      </div>
      
      <Row>
        <Col lg={8}>
          <Card className="mb-4">
            <Card.Header className="d-flex align-items-center">
              <i className="fas fa-edit me-2 text-primary"></i>
              Leave Request Form
            </Card.Header>
            <Card.Body>
              {error && (
                <Alert variant="danger" className="d-flex align-items-center">
                  <i className="fas fa-exclamation-triangle me-2"></i>
                  {error}
                </Alert>
              )}
              
              <Form onSubmit={handleSubmit}>
                <Form.Group className="mb-4">
                  <Form.Label className="d-flex align-items-center fw-semibold">
                    <i className="fas fa-tags me-2 text-primary"></i>
                    Leave Type
                  </Form.Label>
                  <Form.Select
                    name="leaveTypeId"
                    value={formData.leaveTypeId}
                    onChange={handleChange}
                    required
                    className="form-control-lg"
                  >
                    <option value="">Select leave type</option>
                    {leaveTypes.map(type => (
                      <option key={type._id} value={type._id}>
                        {type.name} (Available: {getAvailableBalance(type._id)} days)
                      </option>
                    ))}
                  </Form.Select>
                </Form.Group>

                <Row>
                  <Col md={6}>
                    <Form.Group className="mb-4">
                      <Form.Label className="d-flex align-items-center fw-semibold">
                        <i className="fas fa-calendar-alt me-2 text-success"></i>
                        Start Date
                      </Form.Label>
                      <Form.Control
                        type="date"
                        name="startDate"
                        value={formData.startDate}
                        onChange={handleChange}
                        required
                        className="form-control-lg"
                        min={new Date().toISOString().split('T')[0]}
                      />
                    </Form.Group>
                  </Col>
                  <Col md={6}>
                    <Form.Group className="mb-4">
                      <Form.Label className="d-flex align-items-center fw-semibold">
                        <i className="fas fa-calendar-check me-2 text-danger"></i>
                        End Date
                      </Form.Label>
                      <Form.Control
                        type="date"
                        name="endDate"
                        value={formData.endDate}
                        onChange={handleChange}
                        required
                        className="form-control-lg"
                        min={formData.startDate || new Date().toISOString().split('T')[0]}
                        disabled={formData.isHalfDay}
                      />
                    </Form.Group>
                  </Col>
                </Row>

                <Form.Group className="mb-4">
                  <Form.Check
                    type="checkbox"
                    name="isHalfDay"
                    label="Half Day Leave (Start and end date will be same)"
                    checked={formData.isHalfDay}
                    onChange={handleChange}
                    className="fw-semibold"
                  />
                </Form.Group>

                {formData.isHalfDay && (
                  <Form.Group className="mb-4">
                    <Form.Label className="fw-semibold">Half Day Type</Form.Label>
                    <Form.Select
                      name="halfDayType"
                      value={formData.halfDayType}
                      onChange={handleChange}
                      className="form-control-lg"
                    >
                      <option value="FIRST_HALF">First Half (Morning)</option>
                      <option value="SECOND_HALF">Second Half (Afternoon)</option>
                    </Form.Select>
                  </Form.Group>
                )}

                <Form.Group className="mb-3">
                  <Form.Label className="d-flex align-items-center fw-semibold">
                    <i className="fas fa-lightbulb me-2 text-warning"></i>
                    Quick Reason Template
                  </Form.Label>
                  <Form.Select
                    onChange={(e) => setFormData(prev => ({ ...prev, reason: e.target.value }))}
                    className="form-control-lg"
                  >
                    {reasonTemplates.map((template, idx) => (
                      <option key={idx} value={template.value}>{template.label}</option>
                    ))}
                  </Form.Select>
                </Form.Group>

                <Form.Group className="mb-4">
                  <Form.Label className="d-flex align-items-center fw-semibold">
                    <i className="fas fa-comment-alt me-2 text-info"></i>
                    Reason for Leave
                  </Form.Label>
                  <Form.Control
                    as="textarea"
                    rows={4}
                    name="reason"
                    value={formData.reason}
                    onChange={handleChange}
                    placeholder="Please provide a detailed reason for your leave request..."
                    maxLength={500}
                    required
                  />
                  <Form.Text className="text-muted">
                    {formData.reason.length}/500 characters
                  </Form.Text>
                </Form.Group>

                {/* Advanced Options Toggle */}
                <div className="mb-4">
                  <Button
                    variant="outline-primary"
                    size="sm"
                    onClick={() => setShowAdvanced(!showAdvanced)}
                    className="d-flex align-items-center"
                  >
                    <i className={`fas fa-chevron-${showAdvanced ? 'up' : 'down'} me-2`}></i>
                    {showAdvanced ? 'Hide' : 'Show'} Advanced Options
                  </Button>
                </div>

                {/* Advanced Options */}
                {showAdvanced && (
                  <div className="border rounded p-3 mb-4" style={{backgroundColor: '#f8f9fa'}}>
                    <h6 className="mb-3">
                      <i className="fas fa-cog me-2 text-primary"></i>
                      Additional Information
                    </h6>
                    
                    <Row>
                      <Col md={6}>
                        <Form.Group className="mb-3">
                          <Form.Label className="d-flex align-items-center">
                            <i className="fas fa-phone me-2 text-success"></i>
                            Contact Number During Leave
                          </Form.Label>
                          <Form.Control
                            type="tel"
                            name="contactNumber"
                            value={formData.contactNumber}
                            onChange={handleChange}
                            placeholder="+1 234 567 8900"
                            pattern="[+]?[0-9\s-()]+"
                            title="Please enter a valid phone number"
                          />
                        </Form.Group>
                      </Col>
                      <Col md={6}>
                        <Form.Group className="mb-3">
                          <Form.Label className="d-flex align-items-center">
                            <i className="fas fa-phone-alt me-2 text-danger"></i>
                            Emergency Contact
                          </Form.Label>
                          <Form.Control
                            type="tel"
                            name="emergencyContact"
                            value={formData.emergencyContact}
                            onChange={handleChange}
                            placeholder="+1 234 567 8900"
                            pattern="[+]?[0-9\s-()]+"
                            title="Please enter a valid phone number"
                          />
                        </Form.Group>
                      </Col>
                    </Row>

                    <Form.Group className="mb-3">
                      <Form.Label className="d-flex align-items-center">
                        <i className="fas fa-map-marker-alt me-2 text-info"></i>
                        Address During Leave
                      </Form.Label>
                      <Form.Control
                        as="textarea"
                        rows={2}
                        name="addressDuringLeave"
                        value={formData.addressDuringLeave}
                        onChange={handleChange}
                        placeholder="Where can you be reached during leave?"
                      />
                    </Form.Group>

                    <Form.Group className="mb-3">
                      <Form.Label className="d-flex align-items-center">
                        <i className="fas fa-user-friends me-2 text-primary"></i>
                        Handover To (Optional)
                      </Form.Label>
                      <Form.Select
                        name="handoverTo"
                        value={formData.handoverTo}
                        onChange={handleChange}
                      >
                        <option value="">Select team member for handover</option>
                        {teamMembers.map(member => (
                          <option key={member._id} value={member._id}>
                            {member.firstName} {member.lastName} - {member.department}
                          </option>
                        ))}
                      </Form.Select>
                      <Form.Text className="text-muted">
                        Assign someone to handle your responsibilities
                      </Form.Text>
                    </Form.Group>

                    <Form.Group className="mb-0">
                      <Form.Label className="d-flex align-items-center">
                        <i className="fas fa-paperclip me-2 text-warning"></i>
                        Attachments (Optional)
                      </Form.Label>
                      <Form.Control
                        type="file"
                        multiple
                        onChange={(e) => {
                          const files = Array.from(e.target.files);
                          const validFiles = files.filter(f => f.size <= 5 * 1024 * 1024);
                          if (validFiles.length !== files.length) {
                            toast.warning('Some files exceed 5MB and were removed');
                          }
                          setFormData(prev => ({ ...prev, attachments: validFiles }));
                        }}
                        accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                      />
                      {formData.attachments.length > 0 && (
                        <div className="mt-2">
                          <small className="text-success">
                            {formData.attachments.length} file(s) selected
                          </small>
                        </div>
                      )}
                      <Form.Text className="text-muted">
                        Medical certificates, supporting documents (Max 5MB each)
                      </Form.Text>
                    </Form.Group>
                  </div>
                )}

                {/* Leave Summary & Conflicts */}
                {formData.startDate && formData.endDate && (
                  <>
                    <Alert variant="info" className="mb-3">
                      <div className="d-flex justify-content-between align-items-center mb-2">
                        <strong><i className="fas fa-info-circle me-2"></i>Leave Summary</strong>
                      </div>
                      <Row className="g-2">
                        <Col xs={6} md={3}>
                          <small className="text-muted d-block">Total Days</small>
                          <strong>{requestedDays} days</strong>
                        </Col>
                        <Col xs={6} md={3}>
                          <small className="text-muted d-block">Working Days</small>
                          <strong>{workingDays} days</strong>
                        </Col>
                        <Col xs={6} md={3}>
                          <small className="text-muted d-block">Balance After</small>
                          <strong>{Math.max(0, availableDays - requestedDays)} days</strong>
                        </Col>
                        <Col xs={6} md={3}>
                          <small className="text-muted d-block">Return Date</small>
                          <strong>
                            {(() => {
                              const returnDate = new Date(formData.endDate);
                              returnDate.setDate(returnDate.getDate() + 1);
                              // Skip weekends
                              while (returnDate.getDay() === 0 || returnDate.getDay() === 6) {
                                returnDate.setDate(returnDate.getDate() + 1);
                              }
                              return returnDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                            })()}
                          </strong>
                        </Col>
                      </Row>
                      {willBeOverdrawn && selectedLeaveType?.lopEnabled && (
                        <div className="mt-2 p-2 bg-warning bg-opacity-10 rounded">
                          <small>⚠️ This will result in {requestedDays - availableDays} days of Loss of Pay (LOP)</small>
                        </div>
                      )}
                    </Alert>

                    {conflicts.length > 0 && (
                      <Alert variant="warning" className="mb-3">
                        <div className="d-flex align-items-center mb-2">
                          <i className="fas fa-users me-2"></i>
                          <strong>Team Conflicts Detected</strong>
                        </div>
                        <small>{conflicts.length} team member(s) on leave during this period:</small>
                        <ul className="mb-0 mt-2">
                          {conflicts.slice(0, 3).map((conflict, idx) => (
                            <li key={idx}>
                              <small>
                                {conflict.employeeName} ({new Date(conflict.startDate).toLocaleDateString()} - {new Date(conflict.endDate).toLocaleDateString()})
                              </small>
                            </li>
                          ))}
                        </ul>
                        {conflicts.length > 3 && (
                          <small className="text-muted">...and {conflicts.length - 3} more</small>
                        )}
                      </Alert>
                    )}
                  </>
                )}

                <div className="d-flex gap-3">
                  <Button 
                    type="submit" 
                    variant="primary" 
                    size="lg"
                    disabled={loading || (willBeOverdrawn && !selectedLeaveType?.lopEnabled)}
                    className="d-flex align-items-center"
                  >
                    {loading ? (
                      <>
                        <div className="loading-spinner me-2"></div>
                        Submitting...
                      </>
                    ) : (
                      <>
                        <i className="fas fa-paper-plane me-2"></i>
                        Submit Leave Request
                      </>
                    )}
                  </Button>
                  
                  <Button 
                    type="button" 
                    variant="outline-secondary" 
                    size="lg"
                    onClick={() => {
                      setFormData({
                        leaveTypeId: '',
                        startDate: '',
                        endDate: '',
                        isHalfDay: false,
                        halfDayType: 'FIRST_HALF',
                        reason: '',
                        contactNumber: '',
                        emergencyContact: '',
                        addressDuringLeave: '',
                        handoverTo: '',
                        attachments: []
                      });
                      setError('');
                      setShowAdvanced(false);
                    }}
                  >
                    <i className="fas fa-undo me-2"></i>
                    Reset Form
                  </Button>
                </div>
              </Form>
            </Card.Body>
          </Card>
        </Col>
        
        <Col lg={4}>
          <Card className="sticky-top" style={{top: '20px'}}>
            <Card.Header className="d-flex align-items-center">
              <i className="fas fa-chart-pie me-2 text-success"></i>
              Your Leave Balances
            </Card.Header>
            <Card.Body>
              {balances.length > 0 ? (
                <div className="space-y-3">
                  {balances.map(balance => (
                    <div key={balance._id} className="p-3 rounded" style={{backgroundColor: '#f8fafc'}}>
                      <div className="d-flex align-items-center justify-content-between mb-2">
                        <div className="d-flex align-items-center">
                          <div 
                            className="rounded-circle me-2"
                            style={{
                              width: '12px',
                              height: '12px',
                              backgroundColor: balance.leaveTypeId?.color
                            }}
                          ></div>
                          <strong className="text-dark">{balance.leaveTypeId?.name}</strong>
                        </div>
                      </div>
                      <div className="row text-center">
                        <div className="col-4">
                          <div className="fw-bold text-success fs-5">{balance.available}</div>
                          <small className="text-muted">Available</small>
                        </div>
                        <div className="col-4">
                          <div className="fw-bold text-primary">{balance.used}</div>
                          <small className="text-muted">Used</small>
                        </div>
                        <div className="col-4">
                          <div className="fw-bold text-warning">{balance.pending}</div>
                          <small className="text-muted">Pending</small>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-4">
                  <i className="fas fa-calendar-times text-muted fs-1 mb-3"></i>
                  <p className="text-muted mb-0">No leave balances found</p>
                </div>
              )}
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default ApplyLeave;