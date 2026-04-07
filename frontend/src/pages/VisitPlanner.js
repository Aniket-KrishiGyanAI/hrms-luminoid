import React, { useState, useEffect } from 'react';
import { Row, Col, Card, Button, Modal, Form, Badge, Table } from 'react-bootstrap';
import api from '../utils/api';
import { toast } from 'react-toastify';
import Swal from 'sweetalert2';

const VisitPlanner = () => {
  const [plans, setPlans] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [filterDate, setFilterDate] = useState(new Date().toISOString().split('T')[0]);
  const [form, setForm] = useState({ employeeId: '', date: new Date().toISOString().split('T')[0], clients: [], instructions: '' });
  const [clientSearch, setClientSearch] = useState('');

  useEffect(() => { fetchData(); }, []);
  useEffect(() => { fetchPlans(); }, [filterDate]);

  const fetchData = async () => {
    try {
      const [eRes, cRes] = await Promise.all([api.get('/api/employees'), api.get('/api/field-clients')]);
      setEmployees(eRes.data.filter(e => e.role === 'EMPLOYEE'));
      setClients(cRes.data.filter(c => c.status !== 'INACTIVE'));
    } catch { toast.error('Failed to load data'); }
    finally { setLoading(false); }
  };

  const fetchPlans = async () => {
    try {
      const res = await api.get(`/api/visit-plans?date=${filterDate}`);
      setPlans(res.data);
    } catch { toast.error('Failed to load plans'); }
  };

  const openCreate = () => {
    setForm({ employeeId: '', date: filterDate, clients: [], instructions: '' });
    setClientSearch('');
    setShowModal(true);
  };

  const toggleClient = (clientId) => {
    setForm(p => ({
      ...p,
      clients: p.clients.find(c => c.clientId === clientId)
        ? p.clients.filter(c => c.clientId !== clientId)
        : [...p.clients, { clientId, visitOrder: p.clients.length + 1 }]
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.clients.length === 0) { toast.error('Add at least one client'); return; }
    setSaving(true);
    try {
      await api.post('/api/visit-plans', form);
      toast.success('Visit plan created & visits assigned');
      setShowModal(false);
      fetchPlans();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed to create plan'); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id) => {
    const result = await Swal.fire({ title: 'Delete plan?', text: 'All planned visits will be removed', icon: 'warning', showCancelButton: true, confirmButtonColor: '#ef4444' });
    if (!result.isConfirmed) return;
    try { await api.delete(`/api/visit-plans/${id}`); toast.success('Plan deleted'); fetchPlans(); }
    catch { toast.error('Delete failed'); }
  };

  const filteredClients = clients.filter(c =>
    !clientSearch || c.name.toLowerCase().includes(clientSearch.toLowerCase()) || c.contactPerson.toLowerCase().includes(clientSearch.toLowerCase())
  );

  const statusColors = { PENDING: 'secondary', IN_PROGRESS: 'warning', COMPLETED: 'success', PARTIAL: 'info' };

  if (loading) return <div className="d-flex justify-content-center align-items-center" style={{ height: '60vh' }}><div className="spinner-border text-primary" /></div>;

  return (
    <div className="fade-in-up">
      <div className="page-header">
        <div className="d-flex justify-content-between align-items-center">
          <div>
            <h1 className="page-title"><i className="fas fa-route me-2 text-primary" />Visit Planner</h1>
            <p className="text-muted">Assign daily visit plans to sales team</p>
          </div>
          <Button variant="primary" onClick={openCreate} style={{ borderRadius: 8 }}>
            <i className="fas fa-plus me-2" />Create Plan
          </Button>
        </div>
      </div>

      {/* Date Filter */}
      <Card className="mb-3" style={{ borderRadius: 12, border: 'none', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
        <Card.Body>
          <Row className="align-items-center g-2">
            <Col md={3}>
              <Form.Label style={{ fontWeight: 600, marginBottom: 4 }}>Filter by Date</Form.Label>
              <Form.Control type="date" value={filterDate} onChange={e => setFilterDate(e.target.value)} style={{ borderRadius: 8 }} />
            </Col>
            <Col md={2} className="d-flex align-items-end">
              <Button variant="outline-secondary" onClick={() => setFilterDate(new Date().toISOString().split('T')[0])} style={{ borderRadius: 8 }}>Today</Button>
            </Col>
            <Col className="d-flex align-items-end justify-content-end">
              <div className="d-flex gap-2">
                {Object.entries(statusColors).map(([s, c]) => (
                  <Badge key={s} bg={c}>{plans.filter(p => p.status === s).length} {s}</Badge>
                ))}
              </div>
            </Col>
          </Row>
        </Card.Body>
      </Card>

      {/* Plans Table */}
      <Card style={{ borderRadius: 12, border: 'none', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
        <Card.Body className="p-0">
          <div className="table-responsive">
            <Table hover className="mb-0">
              <thead style={{ background: '#f8fafc' }}>
                <tr>
                  <th>Employee</th>
                  <th>Date</th>
                  <th>Clients</th>
                  <th>Instructions</th>
                  <th>Status</th>
                  <th>Assigned By</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {plans.map(plan => (
                  <tr key={plan._id}>
                    <td>
                      <div style={{ fontWeight: 600 }}>{plan.employeeId?.firstName} {plan.employeeId?.lastName}</div>
                      <small className="text-muted">{plan.employeeId?.email}</small>
                    </td>
                    <td>{new Date(plan.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                    <td>
                      <div className="d-flex flex-wrap gap-1">
                        {plan.clients?.map((c, i) => (
                          <Badge key={i} bg="light" text="dark" style={{ fontSize: '0.75rem', border: '1px solid #e5e7eb' }}>
                            {i + 1}. {c.clientId?.name}
                          </Badge>
                        ))}
                      </div>
                    </td>
                    <td><small className="text-muted">{plan.instructions || '—'}</small></td>
                    <td><Badge bg={statusColors[plan.status]}>{plan.status}</Badge></td>
                    <td><small>{plan.assignedBy?.firstName} {plan.assignedBy?.lastName}</small></td>
                    <td>
                      <Button size="sm" variant="outline-danger" onClick={() => handleDelete(plan._id)} style={{ borderRadius: 6 }}>
                        <i className="fas fa-trash" />
                      </Button>
                    </td>
                  </tr>
                ))}
                {plans.length === 0 && (
                  <tr><td colSpan={7} className="text-center py-4 text-muted">No plans for this date</td></tr>
                )}
              </tbody>
            </Table>
          </div>
        </Card.Body>
      </Card>

      {/* Create Plan Modal */}
      <Modal show={showModal} onHide={() => setShowModal(false)} size="lg" centered>
        <Modal.Header closeButton>
          <Modal.Title><i className="fas fa-route me-2" />Create Visit Plan</Modal.Title>
        </Modal.Header>
        <Form onSubmit={handleSubmit}>
          <Modal.Body>
            <Row className="g-3">
              <Col md={6}>
                <Form.Group>
                  <Form.Label style={{ fontWeight: 600 }}>Sales Employee *</Form.Label>
                  <Form.Select value={form.employeeId} onChange={e => setForm(p => ({ ...p, employeeId: e.target.value }))} required style={{ borderRadius: 8 }}>
                    <option value="">Select employee...</option>
                    {employees.map(e => <option key={e._id} value={e._id}>{e.firstName} {e.lastName}</option>)}
                  </Form.Select>
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group>
                  <Form.Label style={{ fontWeight: 600 }}>Visit Date *</Form.Label>
                  <Form.Control type="date" value={form.date} onChange={e => setForm(p => ({ ...p, date: e.target.value }))} required style={{ borderRadius: 8 }} />
                </Form.Group>
              </Col>
              <Col md={12}>
                <Form.Group>
                  <Form.Label style={{ fontWeight: 600 }}>Instructions</Form.Label>
                  <Form.Control as="textarea" rows={2} value={form.instructions} onChange={e => setForm(p => ({ ...p, instructions: e.target.value }))} placeholder="Special instructions for this visit day..." style={{ borderRadius: 8 }} />
                </Form.Group>
              </Col>
              <Col md={12}>
                <Form.Label style={{ fontWeight: 600 }}>Select Clients to Visit *</Form.Label>
                <Form.Control placeholder="Search clients..." value={clientSearch} onChange={e => setClientSearch(e.target.value)} className="mb-2" style={{ borderRadius: 8 }} />
                <div style={{ maxHeight: 250, overflowY: 'auto', border: '1px solid #dee2e6', borderRadius: 8 }}>
                  {filteredClients.map(c => {
                    const selected = form.clients.find(fc => fc.clientId === c._id);
                    return (
                      <div key={c._id} onClick={() => toggleClient(c._id)} style={{ padding: '0.75rem 1rem', cursor: 'pointer', background: selected ? '#eff6ff' : 'white', borderBottom: '1px solid #f3f4f6', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <div style={{ fontWeight: selected ? 600 : 400 }}>{c.name}</div>
                          <small className="text-muted">{c.contactPerson} · {c.address?.split(',')[0]}</small>
                        </div>
                        <div className="d-flex gap-1 align-items-center">
                          <Badge bg={c.priority === 'HIGH' ? 'danger' : c.priority === 'MEDIUM' ? 'warning' : 'info'} style={{ fontSize: '0.7rem' }}>{c.priority}</Badge>
                          {selected && <Badge bg="primary">{selected.visitOrder}</Badge>}
                        </div>
                      </div>
                    );
                  })}
                </div>
                {form.clients.length > 0 && (
                  <div className="mt-2 p-2 rounded" style={{ background: '#f0fdf4', fontSize: '0.85rem' }}>
                    <i className="fas fa-check-circle me-1 text-success" />{form.clients.length} client(s) selected
                  </div>
                )}
              </Col>
            </Row>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={() => setShowModal(false)}>Cancel</Button>
            <Button variant="primary" type="submit" disabled={saving}>
              {saving ? <><span className="spinner-border spinner-border-sm me-1" />Creating...</> : <><i className="fas fa-paper-plane me-1" />Create Plan</>}
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>
    </div>
  );
};

export default VisitPlanner;
