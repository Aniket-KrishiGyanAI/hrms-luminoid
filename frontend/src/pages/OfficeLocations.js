import React, { useState, useEffect } from 'react';
import { Card, Table, Button, Modal, Form, Row, Col, Badge } from 'react-bootstrap';
import { toast } from 'react-toastify';
import api from '../utils/api';

const OfficeLocations = () => {
  const [locations, setLocations] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: '', latitude: '', longitude: '', radiusMeters: 100,
    startTime: 9, endTime: 18, isActive: true,
  });

  useEffect(() => { fetchLocations(); }, []);

  const fetchLocations = async () => {
    try {
      const res = await api.get('/api/office-locations');
      setLocations(res.data);
    } catch (e) {
      toast.error('Failed to load office locations');
    }
  };

  const openAdd = () => {
    setEditing(null);
    setForm({ name: '', latitude: '', longitude: '', radiusMeters: 100, startTime: 9, endTime: 18, isActive: true });
    setShowModal(true);
  };

  const openEdit = (loc) => {
    setEditing(loc);
    setForm({
      name: loc.name, latitude: loc.latitude, longitude: loc.longitude,
      radiusMeters: loc.radiusMeters, startTime: loc.startTime,
      endTime: loc.endTime, isActive: loc.isActive,
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.name || !form.latitude || !form.longitude) {
      return toast.error('Name, latitude and longitude are required');
    }
    setSaving(true);
    try {
      if (editing) {
        await api.put(`/api/office-locations/${editing._id}`, form);
        toast.success('Office location updated');
      } else {
        await api.post('/api/office-locations', form);
        toast.success('Office location added');
      }
      setShowModal(false);
      fetchLocations();
    } catch (e) {
      toast.error(e.response?.data?.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this office location?')) return;
    try {
      await api.delete(`/api/office-locations/${id}`);
      toast.success('Deleted');
      fetchLocations();
    } catch (e) {
      toast.error('Failed to delete');
    }
  };

  const formatHour = (h) => {
    const suffix = h >= 12 ? 'PM' : 'AM';
    const hour = h % 12 || 12;
    return `${hour}:00 ${suffix}`;
  };

  return (
    <div className="fade-in-up">
      <div className="page-header d-flex justify-content-between align-items-center">
        <div>
          <h1 className="page-title">
            <i className="fas fa-building me-3 text-primary"></i>
            Office Locations
          </h1>
          <p className="text-muted mb-0">Manage office locations and their working hours</p>
        </div>
        <Button variant="primary" onClick={openAdd}>
          <i className="fas fa-plus me-2"></i>Add Location
        </Button>
      </div>

      <Card className="shadow-sm">
        <Card.Body style={{ padding: 0 }}>
          {locations.length === 0 ? (
            <div className="text-center py-5">
              <i className="fas fa-map-marker-alt fa-3x text-muted mb-3"></i>
              <p className="text-muted">No office locations added yet</p>
              <Button variant="primary" onClick={openAdd}>Add First Location</Button>
            </div>
          ) : (
            <Table hover responsive className="mb-0">
              <thead style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                <tr>
                  {['Name', 'Coordinates', 'Radius', 'Working Hours', 'Status', 'Actions'].map(h => (
                    <th key={h} style={{ color: '#475569', fontWeight: '600', fontSize: '0.875rem', textTransform: 'uppercase', padding: '1rem' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {locations.map(loc => (
                  <tr key={loc._id}>
                    <td className="fw-semibold">{loc.name}</td>
                    <td>
                      <small className="text-muted">
                        {Number(loc.latitude).toFixed(5)}, {Number(loc.longitude).toFixed(5)}
                      </small>
                      <a
                        href={`https://www.google.com/maps?q=${loc.latitude},${loc.longitude}`}
                        target="_blank" rel="noopener noreferrer"
                        className="ms-2 text-primary" title="View on map"
                      >
                        <i className="fas fa-external-link-alt" style={{ fontSize: '0.75rem' }}></i>
                      </a>
                    </td>
                    <td>{loc.radiusMeters}m</td>
                    <td>
                      <Badge bg="info" className="me-1">{formatHour(loc.startTime)}</Badge>
                      <span className="text-muted mx-1">–</span>
                      <Badge bg="secondary">{formatHour(loc.endTime)}</Badge>
                    </td>
                    <td>
                      <Badge bg={loc.isActive ? 'success' : 'danger'}>
                        {loc.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </td>
                    <td>
                      <div className="d-flex gap-2">
                        <Button variant="outline-primary" size="sm" onClick={() => openEdit(loc)}>
                          <i className="fas fa-edit"></i>
                        </Button>
                        <Button variant="outline-danger" size="sm" onClick={() => handleDelete(loc._id)}>
                          <i className="fas fa-trash"></i>
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card.Body>
      </Card>

      {/* Add / Edit Modal */}
      <Modal show={showModal} onHide={() => setShowModal(false)} size="lg">
        <Modal.Header closeButton>
          <Modal.Title>
            <i className={`fas fa-${editing ? 'edit' : 'plus'} me-2 text-primary`}></i>
            {editing ? 'Edit Office Location' : 'Add Office Location'}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form>
            <Form.Group className="mb-3">
              <Form.Label>Office Name <span className="text-danger">*</span></Form.Label>
              <Form.Control
                placeholder="e.g. Pune HQ, Mumbai Branch"
                value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })}
              />
            </Form.Group>

            <Row>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Latitude <span className="text-danger">*</span></Form.Label>
                  <Form.Control
                    type="number" step="any"
                    placeholder="e.g. 18.5204"
                    value={form.latitude}
                    onChange={e => setForm({ ...form, latitude: e.target.value })}
                  />
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Longitude <span className="text-danger">*</span></Form.Label>
                  <Form.Control
                    type="number" step="any"
                    placeholder="e.g. 73.8567"
                    value={form.longitude}
                    onChange={e => setForm({ ...form, longitude: e.target.value })}
                  />
                </Form.Group>
              </Col>
            </Row>

            <div className="mb-3 p-2 bg-light rounded">
              <small className="text-muted">
                <i className="fas fa-info-circle me-1"></i>
                To get coordinates: open{' '}
                <a href="https://maps.google.com" target="_blank" rel="noopener noreferrer">Google Maps</a>,
                right-click your office and copy the lat/lng shown.
              </small>
            </div>

            <Row>
              <Col md={4}>
                <Form.Group className="mb-3">
                  <Form.Label>Allowed Radius (meters)</Form.Label>
                  <Form.Control
                    type="number" min="10" max="1000"
                    value={form.radiusMeters}
                    onChange={e => setForm({ ...form, radiusMeters: Number(e.target.value) })}
                  />
                  <Form.Text className="text-muted">GPS check-in range</Form.Text>
                </Form.Group>
              </Col>
              <Col md={4}>
                <Form.Group className="mb-3">
                  <Form.Label>Start Time</Form.Label>
                  <Form.Select
                    value={form.startTime}
                    onChange={e => setForm({ ...form, startTime: Number(e.target.value) })}
                  >
                    {Array.from({ length: 24 }, (_, i) => (
                      <option key={i} value={i}>{formatHour(i)}</option>
                    ))}
                  </Form.Select>
                </Form.Group>
              </Col>
              <Col md={4}>
                <Form.Group className="mb-3">
                  <Form.Label>End Time</Form.Label>
                  <Form.Select
                    value={form.endTime}
                    onChange={e => setForm({ ...form, endTime: Number(e.target.value) })}
                  >
                    {Array.from({ length: 24 }, (_, i) => (
                      <option key={i} value={i}>{formatHour(i)}</option>
                    ))}
                  </Form.Select>
                </Form.Group>
              </Col>
            </Row>

            <Form.Group>
              <Form.Check
                type="switch"
                label="Active (visible to employees)"
                checked={form.isActive}
                onChange={e => setForm({ ...form, isActive: e.target.checked })}
              />
            </Form.Group>
          </Form>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowModal(false)} disabled={saving}>Cancel</Button>
          <Button variant="primary" onClick={handleSave} disabled={saving}>
            {saving
              ? <><span className="spinner-border spinner-border-sm me-2"></span>Saving...</>
              : <><i className="fas fa-save me-2"></i>Save</>}
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default OfficeLocations;
