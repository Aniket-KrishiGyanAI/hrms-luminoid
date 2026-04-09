import React, { useState, useEffect } from 'react';
import { Card, Button, Badge, Form, InputGroup, Row, Col, Modal } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import { toast } from 'react-toastify';

const statusColors = {
  PENDING: { bg: '#fef3c7', color: '#f59e0b', border: '#fbbf24' },
  REVIEWED: { bg: '#dbeafe', color: '#3b82f6', border: '#93c5fd' },
  APPROVED: { bg: '#d1fae5', color: '#10b981', border: '#86efac' },
  REJECTED: { bg: '#fee2e2', color: '#ef4444', border: '#fca5a5' }
};

const FpoSubmissions = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [selectedSubmission, setSelectedSubmission] = useState(null);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [reviewData, setReviewData] = useState({ status: '', reviewNotes: '' });
  const [reviewing, setReviewing] = useState(false);

  const isManager = ['MANAGER', 'HR', 'ADMIN'].includes(user?.role);

  useEffect(() => {
    fetchSubmissions();
  }, [statusFilter]);

  const fetchSubmissions = async () => {
    try {
      const params = {};
      if (statusFilter) params.status = statusFilter;
      if (search) params.search = search;

      const response = await api.get('/api/fpo-forms', { params });
      setSubmissions(response.data);
    } catch (error) {
      toast.error('Failed to load submissions');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    fetchSubmissions();
  };

  const openReviewModal = (submission) => {
    setSelectedSubmission(submission);
    setReviewData({ status: submission.status, reviewNotes: submission.reviewNotes || '' });
    setShowReviewModal(true);
  };

  const handleReview = async () => {
    setReviewing(true);
    try {
      await api.put(`/api/fpo-forms/${selectedSubmission._id}/review`, reviewData);
      toast.success('Review submitted successfully');
      setShowReviewModal(false);
      fetchSubmissions();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to submit review');
    } finally {
      setReviewing(false);
    }
  };

  const filteredSubmissions = submissions.filter(sub => {
    if (!search) return true;
    const searchLower = search.toLowerCase();
    return (
      sub.fpoName?.toLowerCase().includes(searchLower) ||
      sub.fpoOwnerName?.toLowerCase().includes(searchLower) ||
      sub.mobileNumber?.includes(search) ||
      sub.emailAddress?.toLowerCase().includes(searchLower)
    );
  });

  if (loading) {
    return (
      <div className="d-flex justify-content-center align-items-center" style={{ height: '60vh' }}>
        <div className="spinner-border text-success" />
      </div>
    );
  }

  return (
    <div className="fade-in-up">
      {/* Header */}
      <div className="page-header mb-4">
        <div className="d-flex justify-content-between align-items-center flex-wrap gap-3">
          <div>
            <h1 className="page-title">
              <i className="fas fa-list-alt me-2 text-success" />
              FPO Form Submissions
            </h1>
            <p className="text-muted mb-0">{submissions.length} total submissions</p>
          </div>
          <Button
            onClick={() => navigate('/fpo-form')}
            style={{
              borderRadius: 8,
              background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
              border: 'none',
              fontWeight: 600,
              padding: '0.65rem 1.25rem'
            }}
          >
            <i className="fas fa-plus me-2" />
            New Submission
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card className="mb-4" style={{ borderRadius: 12, border: 'none', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
        <Card.Body style={{ padding: '1rem 1.25rem' }}>
          <Row className="g-3 align-items-center">
            <Col md={5}>
              <InputGroup>
                <InputGroup.Text style={{ background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: '8px 0 0 8px' }}>
                  <i className="fas fa-search text-muted" />
                </InputGroup.Text>
                <Form.Control
                  placeholder="Search by FPO name, owner, phone, email..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                  style={{ borderRadius: '0 8px 8px 0', border: '1px solid #e2e8f0' }}
                />
              </InputGroup>
            </Col>
            <Col md={3}>
              <Form.Select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                style={{ borderRadius: 8, border: '1px solid #e2e8f0' }}
              >
                <option value="">All Status</option>
                <option value="PENDING">Pending</option>
                <option value="REVIEWED">Reviewed</option>
                <option value="APPROVED">Approved</option>
                <option value="REJECTED">Rejected</option>
              </Form.Select>
            </Col>
            <Col md={4}>
              <div className="d-flex gap-2 flex-wrap">
                {Object.keys(statusColors).map(status => {
                  const count = submissions.filter(s => s.status === status).length;
                  return (
                    <span
                      key={status}
                      onClick={() => setStatusFilter(statusFilter === status ? '' : status)}
                      style={{
                        cursor: 'pointer',
                        padding: '0.35rem 0.75rem',
                        borderRadius: 20,
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        background: statusFilter === status ? statusColors[status].color : statusColors[status].bg,
                        color: statusFilter === status ? '#fff' : statusColors[status].color,
                        border: `1px solid ${statusColors[status].border}`,
                        transition: 'all 0.2s'
                      }}
                    >
                      {count} {status}
                    </span>
                  );
                })}
              </div>
            </Col>
          </Row>
        </Card.Body>
      </Card>

      {/* Submissions List */}
      {filteredSubmissions.length === 0 ? (
        <div className="text-center py-5">
          <i className="fas fa-inbox" style={{ fontSize: '3rem', color: '#e5e7eb', marginBottom: '1rem' }} />
          <p className="text-muted">No submissions found</p>
        </div>
      ) : (
        <Row className="g-3">
          {filteredSubmissions.map(submission => (
            <Col key={submission._id} xs={12}>
              <Card style={{ borderRadius: 12, border: 'none', boxShadow: '0 2px 8px rgba(0,0,0,0.07)', overflow: 'hidden' }}>
                <div style={{ height: 4, background: `linear-gradient(90deg, ${statusColors[submission.status].color}, ${statusColors[submission.status].color}88)` }} />
                <Card.Body style={{ padding: '1.25rem' }}>
                  <Row className="g-3">
                    {/* Column 1: FPO Info */}
                    <Col md={3}>
                      <div className="d-flex align-items-start gap-2 mb-2">
                        <div style={{
                          width: 40,
                          height: 40,
                          borderRadius: 10,
                          background: 'linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0
                        }}>
                          <i className="fas fa-seedling" style={{ color: '#059669', fontSize: '1rem' }} />
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#0f172a' }}>{submission.fpoName}</div>
                          <div style={{ fontSize: '0.8rem', color: '#64748b' }}>Owner: {submission.fpoOwnerName}</div>
                        </div>
                      </div>
                      <span
                        style={{
                          padding: '0.25rem 0.65rem',
                          borderRadius: 20,
                          fontSize: '0.7rem',
                          fontWeight: 700,
                          background: statusColors[submission.status].bg,
                          color: statusColors[submission.status].color,
                          display: 'inline-block'
                        }}
                      >
                        {submission.status}
                      </span>
                    </Col>

                    {/* Column 2: Contact */}
                    <Col md={3}>
                      <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600, marginBottom: '0.5rem', textTransform: 'uppercase' }}>Contact</div>
                      <div style={{ fontSize: '0.85rem', color: '#475569', marginBottom: '0.3rem' }}>
                        <i className="fas fa-phone me-2 text-success" />{submission.mobileNumber}
                      </div>
                      <div style={{ fontSize: '0.85rem', color: '#475569' }}>
                        <i className="fas fa-envelope me-2 text-success" />{submission.emailAddress}
                      </div>
                    </Col>

                    {/* Column 3: Details */}
                    <Col md={3}>
                      <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600, marginBottom: '0.5rem', textTransform: 'uppercase' }}>Details</div>
                      <div style={{ fontSize: '0.85rem', color: '#475569', marginBottom: '0.3rem' }}>
                        <i className="fas fa-users me-2 text-success" />{submission.totalFarmers} Farmers
                      </div>
                      <div style={{ fontSize: '0.85rem', color: '#475569', marginBottom: '0.3rem' }}>
                        <i className="fas fa-leaf me-2 text-success" />{submission.cropsGrown}
                      </div>
                      <div style={{ fontSize: '0.85rem', color: '#475569' }}>
                        <i className="fas fa-globe me-2 text-success" />{submission.hasWebsite}
                      </div>
                    </Col>

                    {/* Column 4: Submitted By & Actions */}
                    <Col md={3}>
                      <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600, marginBottom: '0.5rem', textTransform: 'uppercase' }}>Submitted By</div>
                      <div style={{ fontSize: '0.85rem', color: '#475569', marginBottom: '0.5rem' }}>
                        {submission.submittedBy?.firstName} {submission.submittedBy?.lastName}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginBottom: '1rem' }}>
                        {new Date(submission.createdAt).toLocaleDateString()}
                      </div>
                      {isManager && (
                        <Button
                          size="sm"
                          onClick={() => openReviewModal(submission)}
                          style={{
                            borderRadius: 7,
                            fontWeight: 600,
                            fontSize: '0.8rem',
                            background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                            border: 'none'
                          }}
                        >
                          <i className="fas fa-edit me-1" />Review
                        </Button>
                      )}
                    </Col>
                  </Row>

                  {/* Review Notes */}
                  {submission.reviewNotes && (
                    <div style={{
                      marginTop: '1rem',
                      paddingTop: '1rem',
                      borderTop: '1px solid #f1f5f9',
                      fontSize: '0.85rem',
                      color: '#64748b'
                    }}>
                      <strong>Review Notes:</strong> {submission.reviewNotes}
                      {submission.reviewedBy && (
                        <span className="ms-2">
                          - by {submission.reviewedBy.firstName} {submission.reviewedBy.lastName}
                        </span>
                      )}
                    </div>
                  )}
                </Card.Body>
              </Card>
            </Col>
          ))}
        </Row>
      )}

      {/* Review Modal */}
      <Modal show={showReviewModal} onHide={() => setShowReviewModal(false)} centered>
        <Modal.Header closeButton style={{ borderBottom: '2px solid #f1f5f9' }}>
          <Modal.Title style={{ fontSize: '1.1rem', fontWeight: 700 }}>
            <i className="fas fa-clipboard-check me-2 text-success" />
            Review Submission
          </Modal.Title>
        </Modal.Header>
        <Modal.Body style={{ padding: '1.5rem' }}>
          {selectedSubmission && (
            <>
              <div className="mb-3">
                <strong>FPO Name:</strong> {selectedSubmission.fpoName}
              </div>
              <Form.Group className="mb-3">
                <Form.Label style={{ fontWeight: 600 }}>Status</Form.Label>
                <Form.Select
                  value={reviewData.status}
                  onChange={(e) => setReviewData({ ...reviewData, status: e.target.value })}
                  style={{ borderRadius: 8 }}
                >
                  <option value="PENDING">Pending</option>
                  <option value="REVIEWED">Reviewed</option>
                  <option value="APPROVED">Approved</option>
                  <option value="REJECTED">Rejected</option>
                </Form.Select>
              </Form.Group>
              <Form.Group className="mb-3">
                <Form.Label style={{ fontWeight: 600 }}>Review Notes</Form.Label>
                <Form.Control
                  as="textarea"
                  rows={3}
                  value={reviewData.reviewNotes}
                  onChange={(e) => setReviewData({ ...reviewData, reviewNotes: e.target.value })}
                  placeholder="Add your review notes..."
                  style={{ borderRadius: 8 }}
                />
              </Form.Group>
            </>
          )}
        </Modal.Body>
        <Modal.Footer style={{ borderTop: '2px solid #f1f5f9' }}>
          <Button variant="light" onClick={() => setShowReviewModal(false)} style={{ borderRadius: 8 }}>
            Cancel
          </Button>
          <Button
            onClick={handleReview}
            disabled={reviewing}
            style={{
              borderRadius: 8,
              background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
              border: 'none',
              fontWeight: 600,
              minWidth: 120
            }}
          >
            {reviewing ? (
              <>
                <span className="spinner-border spinner-border-sm me-2" />
                Saving...
              </>
            ) : (
              <>
                <i className="fas fa-check me-2" />
                Submit Review
              </>
            )}
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default FpoSubmissions;
