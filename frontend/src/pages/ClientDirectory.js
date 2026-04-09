import React, { useState, useEffect } from 'react';
import { Row, Col, Card, Button, Form, Badge, InputGroup } from 'react-bootstrap';
import api from '../utils/api';
import { toast } from 'react-toastify';
import Swal from 'sweetalert2';

const EMPTY_FORM = { name: '', contactPerson: '', phone: '', email: '', address: '', industry: '', notes: '', priority: 'MEDIUM', status: 'PROSPECT', assignedTo: [], location: { lat: '', lng: '' } };

const statusColors = { ACTIVE: '#10b981', INACTIVE: '#94a3b8', PROSPECT: '#f59e0b', CONVERTED: '#3b82f6' };
const statusBg    = { ACTIVE: '#d1fae5', INACTIVE: '#f1f5f9', PROSPECT: '#fef3c7', CONVERTED: '#dbeafe' };
const priorityColors = { HIGH: '#ef4444', MEDIUM: '#f59e0b', LOW: '#3b82f6' };
const priorityBg     = { HIGH: '#fee2e2', MEDIUM: '#fef3c7', LOW: '#dbeafe' };

const ClientDirectory = () => {
  const [clients, setClients] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [saving, setSaving] = useState(false);

  // inline panel state
  const [panel, setPanel] = useState(null); // null | 'add' | clientId
  const [form, setForm] = useState(EMPTY_FORM);

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    try {
      const [cRes, eRes] = await Promise.all([api.get('/api/field-clients'), api.get('/api/employees')]);
      setClients(cRes.data);
      setEmployees(eRes.data.filter(e => e.role === 'EMPLOYEE'));
    } catch { toast.error('Failed to load data'); }
    finally { setLoading(false); }
  };

  const openAdd = () => {
    setForm(EMPTY_FORM);
    setPanel('add');
  };

  const openEdit = (c) => {
    setForm({
      name: c.name || '', contactPerson: c.contactPerson || '', phone: c.phone || '',
      email: c.email || '', address: c.address || '', industry: c.industry || '',
      notes: c.notes || '', priority: c.priority || 'MEDIUM', status: c.status || 'PROSPECT',
      assignedTo: c.assignedTo?.map(u => (typeof u === 'object' ? u._id : u)) || [],
      location: { lat: c.location?.lat ?? '', lng: c.location?.lng ?? '' },
    });
    setPanel(c._id);
  };

  const closePanel = () => setPanel(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = { ...form, location: { lat: parseFloat(form.location.lat) || null, lng: parseFloat(form.location.lng) || null } };
      if (panel !== 'add') await api.put(`/api/field-clients/${panel}`, payload);
      else await api.post('/api/field-clients', payload);
      toast.success(panel !== 'add' ? 'Client updated' : 'Client added');
      setPanel(null);
      fetchData();
    } catch (err) { toast.error(err.response?.data?.message || 'Save failed'); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id) => {
    const result = await Swal.fire({ title: 'Delete client?', text: 'This cannot be undone', icon: 'warning', showCancelButton: true, confirmButtonColor: '#ef4444' });
    if (!result.isConfirmed) return;
    try { await api.delete(`/api/field-clients/${id}`); toast.success('Client deleted'); if (panel === id) setPanel(null); fetchData(); }
    catch { toast.error('Delete failed'); }
  };

  const getGPS = async () => {
    try {
      const pos = await new Promise((res, rej) => navigator.geolocation.getCurrentPosition(res, rej, { enableHighAccuracy: true }));
      setForm(p => ({ ...p, location: { lat: pos.coords.latitude.toFixed(6), lng: pos.coords.longitude.toFixed(6) } }));
      toast.success('GPS location captured');
    } catch { toast.error('Location access denied'); }
  };

  const filtered = clients.filter(c => {
    const matchSearch = !search || c.name.toLowerCase().includes(search.toLowerCase()) || c.contactPerson?.toLowerCase().includes(search.toLowerCase()) || c.phone?.includes(search);
    const matchStatus = !statusFilter || c.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const InlineForm = ({ isAdd }) => (
    <Card style={{ borderRadius: 12, border: '2px solid #10b981', boxShadow: '0 4px 20px rgba(16,185,129,0.15)', marginBottom: '1rem' }}>
      <Card.Header style={{ background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', borderRadius: '10px 10px 0 0', padding: '0.875rem 1.25rem' }}>
        <div className="d-flex justify-content-between align-items-center">
          <span style={{ color: '#fff', fontWeight: 700, fontSize: '0.95rem' }}>
            <i className={`fas fa-${isAdd ? 'plus-circle' : 'edit'} me-2`} />
            {isAdd ? 'Add New Client' : 'Edit Client'}
          </span>
          <Button variant="link" onClick={closePanel} style={{ color: '#fff', padding: 0, fontSize: '1.1rem' }}>
            <i className="fas fa-times" />
          </Button>
        </div>
      </Card.Header>
      <Form onSubmit={handleSubmit}>
        <Card.Body style={{ background: '#f8fafc', padding: '1.25rem' }}>
          {/* Basic Info */}
          <div style={{ background: '#fff', borderRadius: 10, padding: '1rem', marginBottom: '1rem', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
            <div style={{ fontWeight: 700, fontSize: '0.75rem', color: '#059669', textTransform: 'uppercase', letterSpacing: 1, marginBottom: '0.75rem' }}>
              <i className="fas fa-info-circle me-1" />Basic Information
            </div>
            <Row className="g-3">
              <Col md={6}>
                <Form.Label style={{ fontWeight: 600, fontSize: '0.82rem', color: '#374151' }}>Company Name <span className="text-danger">*</span></Form.Label>
                <Form.Control value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} required placeholder="Enter company name" style={{ borderRadius: 8, fontSize: '0.875rem' }} />
              </Col>
              <Col md={6}>
                <Form.Label style={{ fontWeight: 600, fontSize: '0.82rem', color: '#374151' }}>Contact Person <span className="text-danger">*</span></Form.Label>
                <Form.Control value={form.contactPerson} onChange={e => setForm(p => ({ ...p, contactPerson: e.target.value }))} required placeholder="Contact name" style={{ borderRadius: 8, fontSize: '0.875rem' }} />
              </Col>
              <Col md={6}>
                <Form.Label style={{ fontWeight: 600, fontSize: '0.82rem', color: '#374151' }}>Phone</Form.Label>
                <InputGroup>
                  <InputGroup.Text style={{ background: '#f1f5f9', borderRadius: '8px 0 0 8px' }}><i className="fas fa-phone text-muted" style={{ fontSize: '0.75rem' }} /></InputGroup.Text>
                  <Form.Control value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} placeholder="Phone number" style={{ borderRadius: '0 8px 8px 0', fontSize: '0.875rem' }} />
                </InputGroup>
              </Col>
              <Col md={6}>
                <Form.Label style={{ fontWeight: 600, fontSize: '0.82rem', color: '#374151' }}>Email</Form.Label>
                <InputGroup>
                  <InputGroup.Text style={{ background: '#f1f5f9', borderRadius: '8px 0 0 8px' }}><i className="fas fa-envelope text-muted" style={{ fontSize: '0.75rem' }} /></InputGroup.Text>
                  <Form.Control type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} placeholder="Email address" style={{ borderRadius: '0 8px 8px 0', fontSize: '0.875rem' }} />
                </InputGroup>
              </Col>
              <Col md={6}>
                <Form.Label style={{ fontWeight: 600, fontSize: '0.82rem', color: '#374151' }}>Industry</Form.Label>
                <Form.Control value={form.industry} onChange={e => setForm(p => ({ ...p, industry: e.target.value }))} placeholder="e.g., Manufacturing, Retail" style={{ borderRadius: 8, fontSize: '0.875rem' }} />
              </Col>
              <Col md={3}>
                <Form.Label style={{ fontWeight: 600, fontSize: '0.82rem', color: '#374151' }}>Priority</Form.Label>
                <Form.Select value={form.priority} onChange={e => setForm(p => ({ ...p, priority: e.target.value }))} style={{ borderRadius: 8, fontSize: '0.875rem' }}>
                  <option value="HIGH">🔴 High</option>
                  <option value="MEDIUM">🟡 Medium</option>
                  <option value="LOW">🔵 Low</option>
                </Form.Select>
              </Col>
              <Col md={3}>
                <Form.Label style={{ fontWeight: 600, fontSize: '0.82rem', color: '#374151' }}>Status</Form.Label>
                <Form.Select value={form.status} onChange={e => setForm(p => ({ ...p, status: e.target.value }))} style={{ borderRadius: 8, fontSize: '0.875rem' }}>
                  <option value="PROSPECT">Prospect</option>
                  <option value="ACTIVE">Active</option>
                  <option value="CONVERTED">Converted</option>
                  <option value="INACTIVE">Inactive</option>
                </Form.Select>
              </Col>
            </Row>
          </div>

          {/* Location */}
          <div style={{ background: '#fff', borderRadius: 10, padding: '1rem', marginBottom: '1rem', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
            <div style={{ fontWeight: 700, fontSize: '0.75rem', color: '#059669', textTransform: 'uppercase', letterSpacing: 1, marginBottom: '0.75rem' }}>
              <i className="fas fa-map-marker-alt me-1" />Location
            </div>
            <Row className="g-3">
              <Col md={12}>
                <Form.Label style={{ fontWeight: 600, fontSize: '0.82rem', color: '#374151' }}>Address <span className="text-danger">*</span></Form.Label>
                <Form.Control as="textarea" rows={2} value={form.address} onChange={e => setForm(p => ({ ...p, address: e.target.value }))} required placeholder="Full address" style={{ borderRadius: 8, fontSize: '0.875rem' }} />
              </Col>
              <Col md={12}>
                <Form.Label style={{ fontWeight: 600, fontSize: '0.82rem', color: '#374151' }}>GPS Coordinates</Form.Label>
                <Row className="g-2">
                  <Col><Form.Control placeholder="Latitude" value={form.location.lat} onChange={e => setForm(p => ({ ...p, location: { ...p.location, lat: e.target.value } }))} style={{ borderRadius: 8, fontSize: '0.875rem' }} /></Col>
                  <Col><Form.Control placeholder="Longitude" value={form.location.lng} onChange={e => setForm(p => ({ ...p, location: { ...p.location, lng: e.target.value } }))} style={{ borderRadius: 8, fontSize: '0.875rem' }} /></Col>
                  <Col xs="auto">
                    <Button variant="outline-success" onClick={getGPS} style={{ borderRadius: 8, fontSize: '0.82rem' }}>
                      <i className="fas fa-crosshairs me-1" />Use GPS
                    </Button>
                  </Col>
                </Row>
              </Col>
            </Row>
          </div>

          {/* Assignment & Notes */}
          <div style={{ background: '#fff', borderRadius: 10, padding: '1rem', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
            <div style={{ fontWeight: 700, fontSize: '0.75rem', color: '#059669', textTransform: 'uppercase', letterSpacing: 1, marginBottom: '0.75rem' }}>
              <i className="fas fa-users me-1" />Assignment & Notes
            </div>
            <Row className="g-3">
              <Col md={12}>
                <Form.Label style={{ fontWeight: 600, fontSize: '0.82rem', color: '#374151' }}>Assign to Sales Employees</Form.Label>
                <div style={{ maxHeight: 120, overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: 8, padding: '0.5rem 0.75rem', background: '#f8fafc' }}>
                  {employees.length === 0
                    ? <span className="text-muted" style={{ fontSize: '0.82rem' }}>No employees available</span>
                    : employees.map(e => (
                      <Form.Check key={e._id} type="checkbox" id={`emp-${e._id}`}
                        label={`${e.firstName} ${e.lastName}`}
                        checked={form.assignedTo.includes(e._id)}
                        onChange={ev => setForm(p => ({ ...p, assignedTo: ev.target.checked ? [...p.assignedTo, e._id] : p.assignedTo.filter(id => id !== e._id) }))}
                        style={{ fontSize: '0.85rem', marginBottom: '0.15rem' }}
                      />
                    ))}
                </div>
              </Col>
              <Col md={12}>
                <Form.Label style={{ fontWeight: 600, fontSize: '0.82rem', color: '#374151' }}>Notes</Form.Label>
                <Form.Control as="textarea" rows={2} value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} placeholder="Any additional notes..." style={{ borderRadius: 8, fontSize: '0.875rem' }} />
              </Col>
            </Row>
          </div>
        </Card.Body>
        <Card.Footer style={{ background: '#f8fafc', borderTop: '1px solid #e2e8f0', borderRadius: '0 0 10px 10px', display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', padding: '0.875rem 1.25rem' }}>
          <Button variant="light" onClick={closePanel} style={{ borderRadius: 8, fontWeight: 600, border: '1px solid #e2e8f0' }}>Cancel</Button>
          <Button type="submit" disabled={saving} style={{ borderRadius: 8, fontWeight: 600, minWidth: 130, background: 'linear-gradient(135deg, #10b981, #059669)', border: 'none', color: '#fff' }}>
            {saving ? <><span className="spinner-border spinner-border-sm me-1" />Saving...</> : <><i className="fas fa-save me-1" />{isAdd ? 'Add Client' : 'Update Client'}</>}
          </Button>
        </Card.Footer>
      </Form>
    </Card>
  );

  if (loading) return <div className="d-flex justify-content-center align-items-center" style={{ height: '60vh' }}><div className="spinner-border text-success" /></div>;

  return (
    <div className="fade-in-up">
      {/* Header */}
      <div className="page-header">
        <div className="d-flex justify-content-between align-items-center">
          <div>
            <h1 className="page-title"><i className="fas fa-building me-2 text-success" />Client Directory</h1>
            <p className="text-muted mb-0">{clients.length} clients total</p>
          </div>
          <div className="d-flex gap-2">
            <Button 
              onClick={() => window.open('https://docs.google.com/forms/d/e/1FAIpQLSfWH86nivabf5ReP3M1Sm7ysMBElA-ZuDrhEVvfuajKrE3rsw/viewform', '_blank')}
              style={{ borderRadius: 8, background: 'linear-gradient(135deg,#3b82f6,#2563eb)', border: 'none', fontWeight: 600 }}
            >
              <i className="fas fa-clipboard-list me-2" />FPO Client Form
            </Button>
            {panel !== 'add' && (
              <Button onClick={openAdd} style={{ borderRadius: 8, background: 'linear-gradient(135deg,#10b981,#059669)', border: 'none', fontWeight: 600 }}>
                <i className="fas fa-plus me-2" />Add Client
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Add form inline */}
      {panel === 'add' && <InlineForm isAdd />}

      {/* Filters */}
      <Card className="mb-3" style={{ borderRadius: 12, border: 'none', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
        <Card.Body style={{ padding: '0.875rem 1.25rem' }}>
          <Row className="g-2 align-items-center">
            <Col md={5}>
              <InputGroup>
                <InputGroup.Text style={{ background: '#f1f5f9', border: '1px solid #e2e8f0' }}><i className="fas fa-search text-muted" /></InputGroup.Text>
                <Form.Control placeholder="Search by name, contact, phone..." value={search} onChange={e => setSearch(e.target.value)} style={{ borderRadius: '0 8px 8px 0', border: '1px solid #e2e8f0' }} />
              </InputGroup>
            </Col>
            <Col md={3}>
              <Form.Select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={{ borderRadius: 8, border: '1px solid #e2e8f0' }}>
                <option value="">All Status</option>
                <option value="PROSPECT">Prospect</option>
                <option value="ACTIVE">Active</option>
                <option value="CONVERTED">Converted</option>
                <option value="INACTIVE">Inactive</option>
              </Form.Select>
            </Col>
            <Col md={4}>
              <div className="d-flex gap-2 flex-wrap">
                {['PROSPECT', 'ACTIVE', 'CONVERTED', 'INACTIVE'].map(s => (
                  <span key={s} onClick={() => setStatusFilter(statusFilter === s ? '' : s)}
                    style={{ cursor: 'pointer', padding: '0.3rem 0.7rem', borderRadius: 20, fontSize: '0.75rem', fontWeight: 600,
                      background: statusFilter === s ? statusColors[s] : statusBg[s],
                      color: statusFilter === s ? '#fff' : statusColors[s], border: `1px solid ${statusColors[s]}` }}>
                    {clients.filter(c => c.status === s).length} {s}
                  </span>
                ))}
              </div>
            </Col>
          </Row>
        </Card.Body>
      </Card>

      {/* Client Cards */}
      {filtered.length === 0 ? (
        <div className="text-center py-5 text-muted">
          <i className="fas fa-building" style={{ fontSize: '2.5rem', color: '#d1fae5', marginBottom: '1rem', display: 'block' }} />
          No clients found
        </div>
      ) : (
        <Row className="g-3">
          {filtered.map(c => (
            <Col key={c._id} xs={12}>
              {/* Edit form inline below this card */}
              {panel === c._id ? (
                <InlineForm isAdd={false} />
              ) : (
                <Card style={{ borderRadius: 12, border: 'none', boxShadow: '0 2px 8px rgba(0,0,0,0.07)', overflow: 'hidden' }}>
                  {/* Green left accent bar */}
                  <div style={{ height: 4, background: `linear-gradient(90deg, ${statusColors[c.status]}, ${statusColors[c.status]}88)` }} />
                  <Card.Body style={{ padding: '1rem 1.25rem' }}>
                    <Row className="g-3 align-items-start">

                      {/* Col 1: Company + contact */}
                      <Col md={3}>
                        <div className="d-flex align-items-center gap-2 mb-1">
                          <div style={{ width: 38, height: 38, borderRadius: 10, background: '#d1fae5', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <i className="fas fa-building" style={{ color: '#059669', fontSize: '0.9rem' }} />
                          </div>
                          <div>
                            <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#0f172a' }}>{c.name}</div>
                            {c.industry && <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{c.industry}</div>}
                          </div>
                        </div>
                        <div className="d-flex gap-2 mt-2">
                          <span style={{ padding: '0.2rem 0.6rem', borderRadius: 20, fontSize: '0.7rem', fontWeight: 700, background: statusBg[c.status], color: statusColors[c.status] }}>{c.status}</span>
                          <span style={{ padding: '0.2rem 0.6rem', borderRadius: 20, fontSize: '0.7rem', fontWeight: 700, background: priorityBg[c.priority], color: priorityColors[c.priority] }}>{c.priority}</span>
                        </div>
                      </Col>

                      {/* Col 2: Contact details */}
                      <Col md={3}>
                        <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600, marginBottom: '0.4rem', textTransform: 'uppercase', letterSpacing: 0.5 }}>Contact</div>
                        <div style={{ fontWeight: 600, fontSize: '0.875rem', color: '#1e293b' }}>{c.contactPerson}</div>
                        <div style={{ fontSize: '0.82rem', color: '#64748b', marginTop: '0.2rem' }}><i className="fas fa-phone me-1 text-success" />{c.phone}</div>
                        {c.email && <div style={{ fontSize: '0.82rem', color: '#64748b', marginTop: '0.15rem' }}><i className="fas fa-envelope me-1 text-success" />{c.email}</div>}
                      </Col>

                      {/* Col 3: Address */}
                      <Col md={3}>
                        <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600, marginBottom: '0.4rem', textTransform: 'uppercase', letterSpacing: 0.5 }}>Address</div>
                        <div style={{ fontSize: '0.82rem', color: '#475569', lineHeight: 1.5 }}>{c.address}</div>
                        {c.location?.lat && (
                          <a href={`https://www.google.com/maps?q=${c.location.lat},${c.location.lng}`} target="_blank" rel="noopener noreferrer"
                            style={{ fontSize: '0.75rem', color: '#10b981', display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: '0.3rem', textDecoration: 'none' }}>
                            <i className="fas fa-map-marker-alt" />View on Map
                          </a>
                        )}
                      </Col>

                      {/* Col 4: Assigned + actions */}
                      <Col md={3}>
                        <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600, marginBottom: '0.4rem', textTransform: 'uppercase', letterSpacing: 0.5 }}>Assigned To</div>
                        <div className="d-flex flex-wrap gap-1 mb-3">
                          {c.assignedTo?.length > 0
                            ? c.assignedTo.map(u => (
                              <span key={u._id} style={{ padding: '0.2rem 0.6rem', borderRadius: 20, fontSize: '0.72rem', fontWeight: 600, background: '#f0fdf4', color: '#059669', border: '1px solid #a7f3d0' }}>
                                {u.firstName} {u.lastName}
                              </span>
                            ))
                            : <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Unassigned</span>}
                        </div>
                        <div className="d-flex gap-2">
                          <Button size="sm" onClick={() => openEdit(c)}
                            style={{ borderRadius: 7, fontWeight: 600, fontSize: '0.78rem', background: '#f0fdf4', border: '1px solid #a7f3d0', color: '#059669' }}>
                            <i className="fas fa-edit me-1" />Edit
                          </Button>
                          <Button size="sm" onClick={() => handleDelete(c._id)}
                            style={{ borderRadius: 7, fontWeight: 600, fontSize: '0.78rem', background: '#fee2e2', border: '1px solid #fca5a5', color: '#dc2626' }}>
                            <i className="fas fa-trash me-1" />Delete
                          </Button>
                        </div>
                      </Col>

                    </Row>
                    {/* Notes row */}
                    {c.notes && (
                      <div style={{ marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid #f1f5f9', fontSize: '0.8rem', color: '#64748b' }}>
                        <i className="fas fa-sticky-note me-1 text-success" />{c.notes}
                      </div>
                    )}
                  </Card.Body>
                </Card>
              )}
            </Col>
          ))}
        </Row>
      )}
    </div>
  );
};

export default ClientDirectory;
