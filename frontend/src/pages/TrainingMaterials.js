import React, { useState, useEffect } from 'react';
import { Row, Col, Card, Button, Modal, Form, Badge, ProgressBar, Table } from 'react-bootstrap';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import { toast } from 'react-toastify';

const STATUS_COLORS = { NOT_STARTED: 'secondary', IN_PROGRESS: 'warning', COMPLETED: 'success' };
const STATUS_LABELS = { NOT_STARTED: 'Not Started', IN_PROGRESS: 'In Progress', COMPLETED: 'Completed' };

const TrainingMaterials = () => {
  const { user } = useAuth();
  const isAdmin = ['HR', 'ADMIN'].includes(user?.role);

  const [materials, setMaterials] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showProgressModal, setShowProgressModal] = useState(false);
  const [selectedMaterial, setSelectedMaterial] = useState(null);
  const [progressData, setProgressData] = useState([]);
  const [form, setForm] = useState({ title: '', description: '', category: '', externalUrl: '', file: null, targetRoles: [], targetDepartments: [] });
  const [departments, setDepartments] = useState([]);

  useEffect(() => { fetchMaterials(); }, []);

  useEffect(() => {
    if (isAdmin) {
      api.get('/api/training/departments').then(res => setDepartments(res.data)).catch(() => {});
    }
  }, [isAdmin]);

  const fetchMaterials = async () => {
    try {
      const res = await api.get('/api/training');
      setMaterials(res.data);
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Failed to load training materials';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!form.title) return toast.error('Title is required');
    if (!form.file && !form.externalUrl) return toast.error('Provide a file or external URL');
    try {
      const fd = new FormData();
      fd.append('title', form.title);
      fd.append('description', form.description);
      fd.append('category', form.category);
      fd.append('externalUrl', form.externalUrl);
      fd.append('targetRoles', JSON.stringify(form.targetRoles));
      fd.append('targetDepartments', JSON.stringify(form.targetDepartments));
      if (form.file) fd.append('file', form.file);
      await api.post('/api/training', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      toast.success('Training material uploaded');
      setShowUploadModal(false);
      setForm({ title: '', description: '', category: '', externalUrl: '', file: null, targetRoles: [], targetDepartments: [] });
      fetchMaterials();
    } catch {
      toast.error('Upload failed');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this training material?')) return;
    try {
      await api.delete(`/api/training/${id}`);
      toast.success('Deleted');
      fetchMaterials();
    } catch {
      toast.error('Delete failed');
    }
  };

  const handleDownload = async (material) => {
    try {
      const res = await api.get(`/api/training/${material._id}/download`);
      window.open(res.data.downloadUrl, '_blank');
    } catch {
      toast.error('Download failed');
    }
  };

  const handleProgressUpdate = async (materialId, status) => {
    try {
      await api.put(`/api/training/${materialId}/progress`, { status });
      toast.success('Progress updated');
      fetchMaterials();
    } catch {
      toast.error('Failed to update progress');
    }
  };

  const openProgressModal = async (material) => {
    setSelectedMaterial(material);
    try {
      const res = await api.get(`/api/training/${material._id}/progress`);
      setProgressData(res.data);
    } catch {
      toast.error('Failed to load progress data');
    }
    setShowProgressModal(true);
  };

  const completionRate = (material) => {
    // Only meaningful in progress modal; here just show badge
    return material.progress?.status || 'NOT_STARTED';
  };

  if (loading) return (
    <div className="d-flex justify-content-center align-items-center" style={{ height: '400px' }}>
      <div className="spinner-border text-primary" role="status"></div>
    </div>
  );

  return (
    <div className="fade-in-up">
      <div className="page-header d-flex justify-content-between align-items-center">
        <div>
          <h1 className="page-title">
            <i className="fas fa-graduation-cap me-3 text-primary"></i>
            Training Materials
          </h1>
          <p className="text-muted">Upload and track employee training progress</p>
        </div>
        {isAdmin && (
          <Button variant="primary" onClick={() => setShowUploadModal(true)}>
            <i className="fas fa-upload me-2"></i>Upload Material
          </Button>
        )}
      </div>

      {materials.length === 0 ? (
        <Card className="text-center py-5">
          <Card.Body>
            <i className="fas fa-book-open text-muted fs-1 mb-3"></i>
            <p className="text-muted">No training materials available yet.</p>
          </Card.Body>
        </Card>
      ) : (
        <Row>
          {materials.map(material => {
            const status = completionRate(material);
            return (
              <Col md={6} lg={4} key={material._id} className="mb-4">
                <Card className="h-100" style={{ borderRadius: 16, border: '1px solid #e2e8f0', boxShadow: '0 2px 8px rgba(0,0,0,0.07)', overflow: 'hidden' }}>
                  {/* Colored top accent bar */}
                  <div style={{ height: 4, background: status === 'COMPLETED' ? 'linear-gradient(90deg,#10b981,#059669)' : status === 'IN_PROGRESS' ? 'linear-gradient(90deg,#f59e0b,#d97706)' : 'linear-gradient(90deg,#6366f1,#8b5cf6)' }} />

                  <Card.Body className="d-flex flex-column" style={{ padding: '1.25rem' }}>
                    {/* Header row */}
                    <div className="d-flex justify-content-between align-items-start mb-2">
                      <h6 className="fw-bold mb-0" style={{ fontSize: '0.95rem', color: '#1e293b', flex: 1, paddingRight: 8 }}>{material.title}</h6>
                      <Badge bg={STATUS_COLORS[status]} style={{ fontSize: '0.7rem', whiteSpace: 'nowrap' }}>{STATUS_LABELS[status]}</Badge>
                    </div>

                    {/* Category chip */}
                    {material.category && (
                      <span style={{ display: 'inline-block', background: '#f1f5f9', color: '#475569', fontSize: '0.72rem', fontWeight: 600, borderRadius: 20, padding: '2px 10px', marginBottom: 8, width: 'fit-content' }}>
                        <i className="fas fa-tag me-1" style={{ fontSize: '0.65rem' }}></i>{material.category}
                      </span>
                    )}

                    {/* Audience tags */}
                    {(material.targetDepartments?.length > 0 || material.targetRoles?.length > 0) && (
                      <div className="d-flex flex-wrap gap-1 mb-2">
                        {material.targetRoles?.map(r => (
                          <span key={r} style={{ background: '#ede9fe', color: '#6d28d9', fontSize: '0.68rem', fontWeight: 600, borderRadius: 20, padding: '2px 8px' }}>
                            <i className="fas fa-user-tag me-1" style={{ fontSize: '0.6rem' }}></i>{r}
                          </span>
                        ))}
                        {material.targetDepartments?.map(d => (
                          <span key={d} style={{ background: '#dbeafe', color: '#1d4ed8', fontSize: '0.68rem', fontWeight: 600, borderRadius: 20, padding: '2px 8px' }}>
                            <i className="fas fa-building me-1" style={{ fontSize: '0.6rem' }}></i>{d}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Description */}
                    {material.description && (
                      <p className="text-muted mb-3" style={{ fontSize: '0.82rem', lineHeight: 1.5, flexGrow: 1 }}>{material.description}</p>
                    )}

                    {/* Uploader */}
                    <div className="d-flex align-items-center gap-2 mt-auto mb-3">
                      <div style={{ width: 26, height: 26, borderRadius: '50%', background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: '0.65rem', fontWeight: 700, flexShrink: 0 }}>
                        {material.uploadedBy?.firstName?.charAt(0)}{material.uploadedBy?.lastName?.charAt(0)}
                      </div>
                      <small className="text-muted" style={{ fontSize: '0.75rem' }}>
                        {material.uploadedBy?.firstName} {material.uploadedBy?.lastName}
                      </small>
                    </div>

                    {/* Action buttons */}
                    <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '0.85rem' }}>

                      {/* Employee: resource access + progress CTA */}
                      {!isAdmin && (
                        <div className="d-flex flex-column gap-2">
                          <div className="d-flex gap-2">
                            {material.s3Url && (
                              <Button size="sm" variant="outline-primary" className="flex-fill" onClick={() => handleDownload(material)}>
                                <i className="fas fa-download me-1"></i>Download
                              </Button>
                            )}
                            {material.externalUrl && (
                              <Button size="sm" variant="outline-info" className="flex-fill" href={material.externalUrl} target="_blank">
                                <i className="fas fa-external-link-alt me-1"></i>Open
                              </Button>
                            )}
                          </div>
                          {status === 'COMPLETED' ? (
                            <div className="d-flex align-items-center justify-content-center gap-2 py-1" style={{ background: '#f0fdf4', borderRadius: 8, color: '#059669', fontSize: '0.82rem', fontWeight: 600 }}>
                              <i className="fas fa-check-circle"></i> Completed
                            </div>
                          ) : (
                            <Button
                              size="sm"
                              variant={status === 'NOT_STARTED' ? 'primary' : 'success'}
                              onClick={() => handleProgressUpdate(material._id, status === 'NOT_STARTED' ? 'IN_PROGRESS' : 'COMPLETED')}
                              style={{ width: '100%', fontWeight: 600 }}
                            >
                              {status === 'NOT_STARTED' ? <><i className="fas fa-play me-2"></i>Start Training</> : <><i className="fas fa-check me-2"></i>Mark as Complete</>}
                            </Button>
                          )}
                        </div>
                      )}

                      {/* Admin: resource access + icon action buttons */}
                      {isAdmin && (
                        <div className="d-flex align-items-center gap-2">
                          {material.s3Url && (
                            <Button size="sm" variant="outline-primary" className="flex-fill" onClick={() => handleDownload(material)}>
                              <i className="fas fa-download me-1"></i>Download
                            </Button>
                          )}
                          {material.externalUrl && (
                            <Button size="sm" variant="outline-info" className="flex-fill" href={material.externalUrl} target="_blank">
                              <i className="fas fa-external-link-alt me-1"></i>Open
                            </Button>
                          )}
                          <Button
                            size="sm" title="View Progress"
                            onClick={() => openProgressModal(material)}
                            style={{ width: 34, height: 34, padding: 0, borderRadius: 8, background: '#f1f5f9', border: 'none', color: '#475569', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                          >
                            <i className="fas fa-chart-bar" style={{ fontSize: '0.8rem' }}></i>
                          </Button>
                          <Button
                            size="sm" title="Delete"
                            onClick={() => handleDelete(material._id)}
                            style={{ width: 34, height: 34, padding: 0, borderRadius: 8, background: '#fee2e2', border: 'none', color: '#dc2626', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                          >
                            <i className="fas fa-trash" style={{ fontSize: '0.8rem' }}></i>
                          </Button>
                        </div>
                      )}
                    </div>
                  </Card.Body>
                </Card>
              </Col>
            );
          })}
        </Row>
      )}

      {/* Upload Modal */}
      <Modal show={showUploadModal} onHide={() => setShowUploadModal(false)}>
        <Modal.Header closeButton>
          <Modal.Title>Upload Training Material</Modal.Title>
        </Modal.Header>
        <Form onSubmit={handleUpload}>
          <Modal.Body>
            <Form.Group className="mb-3">
              <Form.Label>Title <span className="text-danger">*</span></Form.Label>
              <Form.Control value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} required />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Category</Form.Label>
              <Form.Control placeholder="e.g. Onboarding, Compliance, Technical" value={form.category}
                onChange={e => setForm({ ...form, category: e.target.value })} />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Description</Form.Label>
              <Form.Control as="textarea" rows={2} value={form.description}
                onChange={e => setForm({ ...form, description: e.target.value })} />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Upload File (PDF, Video, etc.)</Form.Label>
              <Form.Control type="file" onChange={e => setForm({ ...form, file: e.target.files[0] })} />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Or External URL (YouTube, Drive, etc.)</Form.Label>
              <Form.Control type="url" placeholder="https://..." value={form.externalUrl}
                onChange={e => setForm({ ...form, externalUrl: e.target.value })} />
            </Form.Group>

            {/* Audience targeting */}
            <div style={{ background: '#f8fafc', borderRadius: 10, padding: '1rem', border: '1px solid #e2e8f0' }}>
              <p className="fw-semibold mb-2" style={{ fontSize: '0.85rem', color: '#475569' }}>
                <i className="fas fa-users me-2 text-primary"></i>Audience (leave blank = visible to everyone)
              </p>

              <Form.Label style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600 }}>Roles</Form.Label>
              <div className="d-flex flex-wrap gap-2 mb-3">
                {['EMPLOYEE', 'MANAGER', 'HR', 'ADMIN'].map(role => (
                  <Form.Check
                    key={role}
                    type="checkbox"
                    id={`role-${role}`}
                    label={role}
                    checked={form.targetRoles.includes(role)}
                    onChange={e => setForm(f => ({
                      ...f,
                      targetRoles: e.target.checked
                        ? [...f.targetRoles, role]
                        : f.targetRoles.filter(r => r !== role)
                    }))}
                    style={{ fontSize: '0.82rem' }}
                  />
                ))}
              </div>

              <Form.Label style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600 }}>Departments</Form.Label>
              {departments.length === 0 ? (
                <p className="text-muted" style={{ fontSize: '0.78rem' }}>No departments found</p>
              ) : (
                <div className="d-flex flex-wrap gap-2">
                  {departments.map(dept => (
                    <Form.Check
                      key={dept}
                      type="checkbox"
                      id={`dept-${dept}`}
                      label={dept}
                      checked={form.targetDepartments.includes(dept)}
                      onChange={e => setForm(f => ({
                        ...f,
                        targetDepartments: e.target.checked
                          ? [...f.targetDepartments, dept]
                          : f.targetDepartments.filter(d => d !== dept)
                      }))}
                      style={{ fontSize: '0.82rem' }}
                    />
                  ))}
                </div>
              )}
            </div>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={() => setShowUploadModal(false)}>Cancel</Button>
            <Button variant="primary" type="submit">Upload</Button>
          </Modal.Footer>
        </Form>
      </Modal>

      {/* Progress Modal (HR/Admin) */}
      <Modal show={showProgressModal} onHide={() => setShowProgressModal(false)} size="lg">
        <Modal.Header closeButton>
          <Modal.Title>Progress — {selectedMaterial?.title}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {progressData.length === 0 ? (
            <p className="text-muted text-center py-3">No progress recorded yet.</p>
          ) : (
            <>
              <div className="mb-3">
                <small className="text-muted">
                  Completed: {progressData.filter(p => p.status === 'COMPLETED').length} / {progressData.length}
                </small>
                <ProgressBar
                  now={Math.round((progressData.filter(p => p.status === 'COMPLETED').length / progressData.length) * 100)}
                  label={`${Math.round((progressData.filter(p => p.status === 'COMPLETED').length / progressData.length) * 100)}%`}
                  className="mt-1"
                />
              </div>
              <Table responsive hover size="sm">
                <thead>
                  <tr><th>Employee</th><th>Status</th><th>Completed At</th></tr>
                </thead>
                <tbody>
                  {progressData.map(p => (
                    <tr key={p._id}>
                      <td>{p.userId?.firstName} {p.userId?.lastName}</td>
                      <td><Badge bg={STATUS_COLORS[p.status]}>{STATUS_LABELS[p.status]}</Badge></td>
                      <td>{p.completedAt ? new Date(p.completedAt).toLocaleDateString() : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowProgressModal(false)}>Close</Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default TrainingMaterials;
