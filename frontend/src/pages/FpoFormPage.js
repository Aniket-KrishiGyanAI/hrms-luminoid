import React, { useState } from 'react';
import { Card, Form, Button, Row, Col, Alert } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import api from '../utils/api';
import { toast } from 'react-toastify';

const FpoFormPage = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    fpoName: '',
    fpoOwnerName: '',
    mobileNumber: '',
    emailAddress: '',
    totalFarmers: '',
    cropsGrown: '',
    hasWebsite: '',
    websiteUrl: ''
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      await api.post('/api/fpo-forms', formData);
      toast.success('FPO form submitted successfully!');
      navigate('/fpo-submissions');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to submit form');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fade-in-up">
      {/* Header */}
      <div className="page-header mb-4">
        <div className="d-flex justify-content-between align-items-center">
          <div>
            <h1 className="page-title">
              <i className="fas fa-clipboard-list me-2 text-success" />
              FPO Client Information Form
            </h1>
            <p className="text-muted mb-0">Fill in the FPO details below - submissions are instantly visible to managers</p>
          </div>
          <Button 
            variant="outline-secondary" 
            onClick={() => navigate(-1)}
            style={{ borderRadius: 8 }}
          >
            <i className="fas fa-arrow-left me-2" />
            Back
          </Button>
        </div>
      </div>

      {/* Info Alert */}
      <Alert variant="success" className="mb-4" style={{ borderRadius: 12, border: 'none', background: 'linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%)' }}>
        <div className="d-flex align-items-center">
          <i className="fas fa-check-circle me-3" style={{ fontSize: '1.5rem', color: '#059669' }} />
          <div>
            <strong>Direct HRMS Submission</strong>
            <p className="mb-0 mt-1" style={{ fontSize: '0.9rem' }}>
              Your submission will be saved directly to the HRMS database and will be <strong>instantly visible</strong> to managers and HR for review.
            </p>
          </div>
        </div>
      </Alert>

      {/* Form Card */}
      <Card style={{ borderRadius: 12, border: 'none', boxShadow: '0 2px 12px rgba(0,0,0,0.08)' }}>
        <Card.Body style={{ padding: '2rem' }}>
          <Form onSubmit={handleSubmit}>
            {/* FPO Name */}
            <Form.Group className="mb-4">
              <Form.Label style={{ fontWeight: 600, color: '#374151', fontSize: '0.95rem' }}>
                FPO Name <span className="text-danger">*</span>
              </Form.Label>
              <Form.Control
                type="text"
                name="fpoName"
                value={formData.fpoName}
                onChange={handleChange}
                required
                placeholder="Enter FPO name"
                style={{ borderRadius: 8, padding: '0.75rem', fontSize: '0.95rem' }}
              />
            </Form.Group>

            {/* FPO Owner Name */}
            <Form.Group className="mb-4">
              <Form.Label style={{ fontWeight: 600, color: '#374151', fontSize: '0.95rem' }}>
                FPO Owner Name <span className="text-danger">*</span>
              </Form.Label>
              <Form.Control
                type="text"
                name="fpoOwnerName"
                value={formData.fpoOwnerName}
                onChange={handleChange}
                required
                placeholder="Enter owner name"
                style={{ borderRadius: 8, padding: '0.75rem', fontSize: '0.95rem' }}
              />
            </Form.Group>

            <Row>
              {/* Mobile Number */}
              <Col md={6}>
                <Form.Group className="mb-4">
                  <Form.Label style={{ fontWeight: 600, color: '#374151', fontSize: '0.95rem' }}>
                    Mobile Number <span className="text-danger">*</span>
                  </Form.Label>
                  <Form.Control
                    type="tel"
                    name="mobileNumber"
                    value={formData.mobileNumber}
                    onChange={handleChange}
                    required
                    placeholder="Enter mobile number"
                    pattern="[0-9]{10}"
                    style={{ borderRadius: 8, padding: '0.75rem', fontSize: '0.95rem' }}
                  />
                  <Form.Text className="text-muted">10-digit mobile number</Form.Text>
                </Form.Group>
              </Col>

              {/* Email Address */}
              <Col md={6}>
                <Form.Group className="mb-4">
                  <Form.Label style={{ fontWeight: 600, color: '#374151', fontSize: '0.95rem' }}>
                    Email Address <span className="text-danger">*</span>
                  </Form.Label>
                  <Form.Control
                    type="email"
                    name="emailAddress"
                    value={formData.emailAddress}
                    onChange={handleChange}
                    required
                    placeholder="Enter email address"
                    style={{ borderRadius: 8, padding: '0.75rem', fontSize: '0.95rem' }}
                  />
                </Form.Group>
              </Col>
            </Row>

            {/* Total Farmers */}
            <Form.Group className="mb-4">
              <Form.Label style={{ fontWeight: 600, color: '#374151', fontSize: '0.95rem' }}>
                Total Number of Farmers Associated <span className="text-danger">*</span>
              </Form.Label>
              <Form.Control
                type="number"
                name="totalFarmers"
                value={formData.totalFarmers}
                onChange={handleChange}
                required
                min="1"
                placeholder="Enter number of farmers"
                style={{ borderRadius: 8, padding: '0.75rem', fontSize: '0.95rem' }}
              />
            </Form.Group>

            {/* Crops Grown */}
            <Form.Group className="mb-4">
              <Form.Label style={{ fontWeight: 600, color: '#374151', fontSize: '0.95rem' }}>
                Crops Grown in the Area <span className="text-danger">*</span>
              </Form.Label>
              <Form.Control
                as="textarea"
                rows={3}
                name="cropsGrown"
                value={formData.cropsGrown}
                onChange={handleChange}
                required
                placeholder="Enter crops grown (e.g., Rice, Wheat, Cotton)"
                style={{ borderRadius: 8, padding: '0.75rem', fontSize: '0.95rem' }}
              />
            </Form.Group>

            {/* Has Website */}
            <Form.Group className="mb-4">
              <Form.Label style={{ fontWeight: 600, color: '#374151', fontSize: '0.95rem' }}>
                Do You Have Website (if any) <span className="text-danger">*</span>
              </Form.Label>
              <div>
                <Form.Check
                  type="radio"
                  id="hasWebsiteYes"
                  name="hasWebsite"
                  label="Yes, we have"
                  value="Yes, we have"
                  checked={formData.hasWebsite === 'Yes, we have'}
                  onChange={handleChange}
                  required
                  style={{ fontSize: '0.95rem', marginBottom: '0.5rem' }}
                />
                <Form.Check
                  type="radio"
                  id="hasWebsiteNo"
                  name="hasWebsite"
                  label="No, we don't have a website"
                  value="No, we don't have a website"
                  checked={formData.hasWebsite === "No, we don't have a website"}
                  onChange={handleChange}
                  required
                  style={{ fontSize: '0.95rem' }}
                />
              </div>
            </Form.Group>

            {/* Website URL (conditional) */}
            {formData.hasWebsite === 'Yes, we have' && (
              <Form.Group className="mb-4">
                <Form.Label style={{ fontWeight: 600, color: '#374151', fontSize: '0.95rem' }}>
                  Website URL
                </Form.Label>
                <Form.Control
                  type="url"
                  name="websiteUrl"
                  value={formData.websiteUrl}
                  onChange={handleChange}
                  placeholder="https://example.com"
                  style={{ borderRadius: 8, padding: '0.75rem', fontSize: '0.95rem' }}
                />
              </Form.Group>
            )}

            {/* Submit Button */}
            <div className="d-flex gap-3 justify-content-end mt-4">
              <Button
                variant="light"
                onClick={() => navigate(-1)}
                style={{ borderRadius: 8, padding: '0.75rem 1.5rem', fontWeight: 600 }}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={loading}
                style={{
                  borderRadius: 8,
                  padding: '0.75rem 2rem',
                  fontWeight: 600,
                  background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                  border: 'none',
                  minWidth: 150
                }}
              >
                {loading ? (
                  <>
                    <span className="spinner-border spinner-border-sm me-2" />
                    Submitting...
                  </>
                ) : (
                  <>
                    <i className="fas fa-paper-plane me-2" />
                    Submit Form
                  </>
                )}
              </Button>
            </div>
          </Form>
        </Card.Body>
      </Card>
    </div>
  );
};

export default FpoFormPage;
