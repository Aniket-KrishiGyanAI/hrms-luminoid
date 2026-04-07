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
    startTime: 9, startMinute: 0, endTime: 18, endMinute: 0, compensationMinutes: 0, isActive: true,
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchingLocation, setSearchingLocation] = useState(false);

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
    setForm({ name: '', latitude: '', longitude: '', radiusMeters: 100, startTime: 9, startMinute: 0, endTime: 18, endMinute: 0, compensationMinutes: 0, isActive: true });
    setSearchQuery('');
    setSearchResults([]);
    setShowModal(true);
  };

  const openEdit = (loc) => {
    setEditing(loc);
    setForm({
      name: loc.name || '',
      latitude: loc.latitude || '',
      longitude: loc.longitude || '',
      radiusMeters: loc.radiusMeters || 100,
      startTime: loc.startTime ?? 9,
      startMinute: loc.startMinute ?? 0,
      endTime: loc.endTime ?? 18,
      endMinute: loc.endMinute ?? 0,
      compensationMinutes: loc.compensationMinutes || 0,
      isActive: loc.isActive ?? true,
    });
    setSearchQuery('');
    setSearchResults([]);
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.name?.trim()) {
      return toast.error('Office name is required');
    }
    if (!form.latitude || !form.longitude) {
      return toast.error('Latitude and longitude are required');
    }
    if (isNaN(form.latitude) || isNaN(form.longitude)) {
      return toast.error('Invalid coordinates');
    }
    if (Number(form.startTime) >= Number(form.endTime)) {
      return toast.error('End time must be after start time');
    }
    
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        latitude: Number(form.latitude),
        longitude: Number(form.longitude),
        radiusMeters: Number(form.radiusMeters) || 100,
        startTime: Number(form.startTime),
        startMinute: Number(form.startMinute) || 0,
        endTime: Number(form.endTime),
        endMinute: Number(form.endMinute) || 0,
        compensationMinutes: Number(form.compensationMinutes) || 0,
        isActive: Boolean(form.isActive)
      };
      
      if (editing) {
        await api.put(`/api/office-locations/${editing._id}`, payload);
        toast.success('Office location updated successfully');
      } else {
        await api.post('/api/office-locations', payload);
        toast.success('Office location added successfully');
      }
      setShowModal(false);
      fetchLocations();
    } catch (e) {
      toast.error(e.response?.data?.message || 'Failed to save office location');
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

  const formatHour = (h, m = 0) => {
    const suffix = h >= 12 ? 'PM' : 'AM';
    const hour = h % 12 || 12;
    const minute = String(m).padStart(2, '0');
    return `${hour}:${minute} ${suffix}`;
  };

  const searchLocation = async () => {
    if (!searchQuery.trim()) return;
    setSearchingLocation(true);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}&limit=5`,
        { headers: { 'User-Agent': 'HRMS-App' } }
      );
      const data = await res.json();
      setSearchResults(data);
      if (data.length === 0) {
        toast.info('No locations found. Try a different search term.');
      }
    } catch (error) {
      toast.error('Failed to search location');
      setSearchResults([]);
    } finally {
      setSearchingLocation(false);
    }
  };

  const selectSearchResult = (result) => {
    const lat = parseFloat(result.lat);
    const lng = parseFloat(result.lon);
    setForm(f => ({ ...f, latitude: lat, longitude: lng }));
    setSearchResults([]);
    setSearchQuery('');
    toast.success('Location selected!');
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
                      <Badge bg="info" className="me-1">{formatHour(loc.startTime, loc.startMinute || 0)}</Badge>
                      <span className="text-muted mx-1">–</span>
                      <Badge bg="secondary">{formatHour(loc.endTime, loc.endMinute || 0)}</Badge>
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
      <Modal 
        show={showModal} 
        onHide={() => !saving && setShowModal(false)}
        backdrop={saving ? 'static' : true}
        keyboard={!saving}
        size="lg"
      >
        <Modal.Header closeButton={!saving} className="bg-light">
          <Modal.Title className="d-flex align-items-center">
            <div className="bg-primary text-white rounded-circle d-flex align-items-center justify-content-center" 
                 style={{ width: '40px', height: '40px', marginRight: '12px' }}>
              <i className={`fas fa-${editing ? 'edit' : 'plus'}`}></i>
            </div>
            <div>
              <h5 className="mb-0">{editing ? 'Edit Office Location' : 'Add Office Location'}</h5>
              <small className="text-muted">Update location details and working hours</small>
            </div>
          </Modal.Title>
        </Modal.Header>
        
        <Modal.Body style={{ maxHeight: 'calc(100vh - 250px)', overflowY: 'auto' }}>
          <Form>
            {/* Office Name */}
            <div className="mb-4">
              <Form.Label className="fw-semibold">
                <i className="fas fa-building text-primary me-2"></i>
                Office Name <span className="text-danger">*</span>
              </Form.Label>
              <Form.Control
                size="lg"
                placeholder="e.g. Pune Headquarters, Mumbai Branch Office"
                value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })}
                className="shadow-sm"
              />
            </div>

            {/* Coordinates Section */}
            <div className="mb-4">
              <div className="d-flex align-items-center mb-3">
                <i className="fas fa-map-marker-alt text-danger me-2"></i>
                <h6 className="mb-0 fw-semibold">Location Coordinates</h6>
              </div>
              
              {/* Search Location */}
              <div className="mb-3">
                <Form.Label className="fw-semibold">Search Location</Form.Label>
                <div className="d-flex gap-2">
                  <Form.Control
                    type="text"
                    placeholder="Search for office address, city, or landmark..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    onKeyPress={e => e.key === 'Enter' && searchLocation()}
                    className="shadow-sm"
                  />
                  <Button
                    onClick={searchLocation}
                    disabled={searchingLocation || !searchQuery.trim()}
                    variant="primary"
                  >
                    {searchingLocation ? (
                      <><span className="spinner-border spinner-border-sm me-2"></span>Searching...</>
                    ) : (
                      <><i className="fas fa-search me-2"></i>Search</>
                    )}
                  </Button>
                </div>
                
                {/* Search Results */}
                {searchResults.length > 0 && (
                  <div className="mt-2" style={{ maxHeight: '200px', overflowY: 'auto', border: '2px solid #e2e8f0', borderRadius: '8px', background: 'white' }}>
                    {searchResults.map((result, idx) => (
                      <div
                        key={idx}
                        onClick={() => selectSearchResult(result)}
                        style={{ padding: '10px 14px', cursor: 'pointer', borderBottom: idx < searchResults.length - 1 ? '1px solid #f1f5f9' : 'none', transition: 'background 0.2s' }}
                        onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                        onMouseLeave={e => e.currentTarget.style.background = 'white'}
                      >
                        <div className="d-flex align-items-start">
                          <i className="fas fa-map-pin me-2 mt-1" style={{ color: '#3b82f6', fontSize: '0.9rem' }}></i>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#1e293b' }}>{result.display_name.split(',')[0]}</div>
                            <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{result.display_name}</div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              
              <Row>
                <Col md={6}>
                  <Form.Group className="mb-3">
                    <Form.Label>Latitude <span className="text-danger">*</span></Form.Label>
                    <Form.Control
                      type="number" 
                      step="any"
                      placeholder="e.g. 18.5204"
                      value={form.latitude}
                      onChange={e => setForm({ ...form, latitude: e.target.value })}
                      className="shadow-sm"
                    />
                  </Form.Group>
                </Col>
                <Col md={6}>
                  <Form.Group className="mb-3">
                    <Form.Label>Longitude <span className="text-danger">*</span></Form.Label>
                    <Form.Control
                      type="number" 
                      step="any"
                      placeholder="e.g. 73.8567"
                      value={form.longitude}
                      onChange={e => setForm({ ...form, longitude: e.target.value })}
                      className="shadow-sm"
                    />
                  </Form.Group>
                </Col>
              </Row>
              
              <div className="alert alert-info d-flex align-items-start mb-0">
                <i className="fas fa-info-circle mt-1 me-2"></i>
                <div>
                  <strong>How to get coordinates:</strong>
                  <ol className="mb-0 mt-1 ps-3">
                    <li>Use the search box above to find your office location</li>
                    <li>Or open <a href="https://maps.google.com" target="_blank" rel="noopener noreferrer" className="fw-semibold">Google Maps</a>, right-click on your office, and copy coordinates</li>
                  </ol>
                </div>
              </div>
            </div>

            {/* Radius Section */}
            <div className="mb-4">
              <div className="d-flex align-items-center mb-3">
                <i className="fas fa-circle-notch text-success me-2"></i>
                <h6 className="mb-0 fw-semibold">Check-in Radius</h6>
              </div>
              <Form.Group>
                <Form.Label>Allowed Radius (meters)</Form.Label>
                <Form.Control
                  type="number" 
                  min="10" 
                  max="1000"
                  value={form.radiusMeters}
                  onChange={e => setForm({ ...form, radiusMeters: Number(e.target.value) })}
                  className="shadow-sm"
                />
                <Form.Text className="text-muted">
                  <i className="fas fa-info-circle me-1"></i>
                  Employees must be within this radius to check in (Recommended: 50-200m)
                </Form.Text>
              </Form.Group>
            </div>

            {/* Working Hours Section */}
            <div className="mb-4">
              <div className="d-flex align-items-center mb-3">
                <i className="fas fa-clock text-warning me-2"></i>
                <h6 className="mb-0 fw-semibold">Working Hours</h6>
              </div>
              <Row>
                <Col md={3}>
                  <Form.Group className="mb-3">
                    <Form.Label>
                      <i className="fas fa-sun text-warning me-1"></i>
                      Start Hour
                    </Form.Label>
                    <Form.Select
                      value={form.startTime}
                      onChange={e => setForm({ ...form, startTime: Number(e.target.value) })}
                      className="shadow-sm"
                      size="lg"
                    >
                      {Array.from({ length: 24 }, (_, i) => (
                        <option key={i} value={i}>{i.toString().padStart(2, '0')}</option>
                      ))}
                    </Form.Select>
                  </Form.Group>
                </Col>
                <Col md={3}>
                  <Form.Group className="mb-3">
                    <Form.Label>Start Minute</Form.Label>
                    <Form.Select
                      value={form.startMinute}
                      onChange={e => setForm({ ...form, startMinute: Number(e.target.value) })}
                      className="shadow-sm"
                      size="lg"
                    >
                      {Array.from({ length: 12 }, (_, i) => i * 5).map(m => (
                        <option key={m} value={m}>{m.toString().padStart(2, '0')}</option>
                      ))}
                    </Form.Select>
                  </Form.Group>
                </Col>
                <Col md={3}>
                  <Form.Group className="mb-3">
                    <Form.Label>
                      <i className="fas fa-moon text-primary me-1"></i>
                      End Hour
                    </Form.Label>
                    <Form.Select
                      value={form.endTime}
                      onChange={e => setForm({ ...form, endTime: Number(e.target.value) })}
                      className="shadow-sm"
                      size="lg"
                    >
                      {Array.from({ length: 24 }, (_, i) => (
                        <option key={i} value={i}>{i.toString().padStart(2, '0')}</option>
                      ))}
                    </Form.Select>
                  </Form.Group>
                </Col>
                <Col md={3}>
                  <Form.Group className="mb-3">
                    <Form.Label>End Minute</Form.Label>
                    <Form.Select
                      value={form.endMinute}
                      onChange={e => setForm({ ...form, endMinute: Number(e.target.value) })}
                      className="shadow-sm"
                      size="lg"
                    >
                      {Array.from({ length: 12 }, (_, i) => i * 5).map(m => (
                        <option key={m} value={m}>{m.toString().padStart(2, '0')}</option>
                      ))}
                    </Form.Select>
                  </Form.Group>
                </Col>
              </Row>
              <div className="alert alert-info mb-0">
                <i className="fas fa-info-circle me-2"></i>
                <strong>Preview:</strong> {formatHour(form.startTime, form.startMinute)} to {formatHour(form.endTime, form.endMinute)}
              </div>
            </div>

            {/* Grace Period Section */}
            <div className="mb-4">
              <div className="d-flex align-items-center mb-3">
                <i className="fas fa-user-clock text-info me-2"></i>
                <h6 className="mb-0 fw-semibold">Grace Period (Compensation Time)</h6>
              </div>
              <Form.Group>
                <Form.Label>Late Arrival Tolerance (minutes)</Form.Label>
                <Form.Control
                  type="number" 
                  min="0" 
                  max="120" 
                  step="5"
                  value={form.compensationMinutes}
                  onChange={e => setForm({ ...form, compensationMinutes: Number(e.target.value) })}
                  className="shadow-sm"
                />
                <Form.Text className="text-muted">
                  <i className="fas fa-info-circle me-1"></i>
                  Employees can check in this many minutes late without being marked as "Late" (e.g., 30 = 30 minutes grace period)
                </Form.Text>
              </Form.Group>
            </div>

            {/* Status Section */}
            <div className="mb-3">
              <div className="d-flex align-items-center mb-3">
                <i className="fas fa-toggle-on text-info me-2"></i>
                <h6 className="mb-0 fw-semibold">Status</h6>
              </div>
              <div className="border rounded p-3 bg-light">
                <Form.Check
                  type="switch"
                  id="active-switch"
                  label={
                    <span>
                      <strong>{form.isActive ? 'Active' : 'Inactive'}</strong>
                      <br />
                      <small className="text-muted">
                        {form.isActive 
                          ? 'This location is visible to employees for check-in' 
                          : 'This location is hidden from employees'}
                      </small>
                    </span>
                  }
                  checked={form.isActive}
                  onChange={e => setForm({ ...form, isActive: e.target.checked })}
                  className="fs-5"
                />
              </div>
            </div>
          </Form>
        </Modal.Body>
        
        <Modal.Footer className="bg-light">
          <Button 
            variant="outline-secondary" 
            onClick={() => setShowModal(false)} 
            disabled={saving}
            size="lg"
          >
            <i className="fas fa-times me-2"></i>
            Cancel
          </Button>
          <Button 
            variant="primary" 
            onClick={handleSave} 
            disabled={saving}
            size="lg"
            className="px-4"
          >
            {saving ? (
              <>
                <span className="spinner-border spinner-border-sm me-2"></span>
                Saving...
              </>
            ) : (
              <>
                <i className="fas fa-check me-2"></i>
                {editing ? 'Update Location' : 'Add Location'}
              </>
            )}
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default OfficeLocations;
