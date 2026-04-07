import React, { useState, useEffect } from 'react';
import { Row, Col, Card, Button, Badge, Form, Table, Modal } from 'react-bootstrap';
import { MapContainer, TileLayer, Polyline, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import api from '../utils/api';
import { toast } from 'react-toastify';

// Fix leaflet default icon
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({ iconRetinaUrl: require('leaflet/dist/images/marker-icon-2x.png'), iconUrl: require('leaflet/dist/images/marker-icon.png'), shadowUrl: require('leaflet/dist/images/marker-shadow.png') });

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:5000';
const photoUrl = (url) => url?.startsWith('http') ? url : `${API_BASE}${url}`;

const OUTCOME_LABELS = { ORDER_RECEIVED: '🎉 Order', POSITIVE: '👍 Positive', NEUTRAL: '🤝 Neutral', NEGATIVE: '👎 Negative', DEMO_SCHEDULED: '📅 Demo', PROPOSAL_SENT: '📄 Proposal', NO_RESPONSE: '📵 No Response' };

const OUTCOME_COLORS = {
  ORDER_RECEIVED: { bg: '#dcfce7', color: '#16a34a', border: '#86efac' },
  POSITIVE:       { bg: '#dbeafe', color: '#2563eb', border: '#93c5fd' },
  NEUTRAL:        { bg: '#fef9c3', color: '#ca8a04', border: '#fde047' },
  NEGATIVE:       { bg: '#fee2e2', color: '#dc2626', border: '#fca5a5' },
  DEMO_SCHEDULED: { bg: '#ede9fe', color: '#7c3aed', border: '#c4b5fd' },
  PROPOSAL_SENT:  { bg: '#e0f2fe', color: '#0284c7', border: '#7dd3fc' },
  NO_RESPONSE:    { bg: '#f3f4f6', color: '#6b7280', border: '#d1d5db' },
};

const fmt = (d, opts) => d ? new Date(d).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', ...opts }) : '—';
const fmtDate = d => d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

const FieldReports = () => {
  const [reports, setReports] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterDate, setFilterDate] = useState(new Date().toISOString().split('T')[0]);
  const [filterEmployee, setFilterEmployee] = useState('');
  const [selectedReport, setSelectedReport] = useState(null);
  const [showMapModal, setShowMapModal] = useState(false);
  const [mapVisit, setMapVisit] = useState(null);
  const [lightbox, setLightbox] = useState(null);
  const [activeView, setActiveView] = useState('visits'); // 'visits' | 'journey'
  const [journeys, setJourneys] = useState([]);
  const [journeyLoading, setJourneyLoading] = useState(false);

  useEffect(() => { fetchEmployees(); }, []);
  useEffect(() => { fetchReports(); }, [filterDate, filterEmployee]);
  useEffect(() => { if (activeView === 'journey') fetchJourneys(); }, [activeView, filterDate, filterEmployee]);

  const fetchEmployees = async () => {
    try {
      const res = await api.get('/api/employees');
      setEmployees(res.data.filter(e => e.role === 'EMPLOYEE'));
    } catch {}
  };

  const fetchReports = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ startDate: filterDate, endDate: filterDate });
      if (filterEmployee) params.append('employeeId', filterEmployee);
      const res = await api.get(`/api/field-reports/all?${params}`);
      setReports(res.data);
    } catch { toast.error('Failed to load reports'); }
    finally { setLoading(false); }
  };

  const viewDailyReport = async (empId) => {
    try {
      const res = await api.get(`/api/field-reports/${filterDate}/${empId}`);
      setSelectedReport(res.data);
    } catch { toast.error('Failed to load report'); }
  };

  const openRouteMap = (visit) => { setMapVisit(visit); setShowMapModal(true); };

  const fetchJourneys = async () => {
    setJourneyLoading(true);
    try {
      const params = new URLSearchParams({ date: filterDate });
      if (filterEmployee) params.append('employeeId', filterEmployee);
      const res = await api.get(`/api/journey/summary?${params}`);
      setJourneys(res.data);
    } catch { toast.error('Failed to load journey data'); }
    finally { setJourneyLoading(false); }
  };

  const exportCSV = () => {
    const rows = [
      ['Employee', 'Date', 'Planned', 'Visited', 'Completed', 'Distance (km)', 'Duration (min)', 'Deal Value (₹)', 'Orders'],
      ...reports.map(r => [
        `${r.employeeId?.firstName} ${r.employeeId?.lastName}`,
        new Date(r.date).toLocaleDateString('en-GB'),
        r.totalPlanned, r.totalVisited, r.totalCompleted,
        r.totalDistanceKm, r.totalDurationMinutes,
        r.totalDealValue, r.outcomeSummary?.ORDER_RECEIVED || 0
      ])
    ].map(r => r.join(',')).join('\n');
    const blob = new Blob([rows], { type: 'text/csv' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    a.download = `field-report-${filterDate}.csv`; a.click();
    toast.success('Report exported');
  };

  // Summary stats
  const totalVisited = reports.reduce((s, r) => s + r.totalVisited, 0);
  const totalOrders = reports.reduce((s, r) => s + (r.outcomeSummary?.ORDER_RECEIVED || 0), 0);
  const totalDeal = reports.reduce((s, r) => s + r.totalDealValue, 0);
  const totalKm = reports.reduce((s, r) => s + r.totalDistanceKm, 0);
  const totalJourneyKm = journeys.reduce((s, j) => s + (j.totalDistanceKm || 0), 0);

  return (
    <div className="fade-in-up">
      <div className="page-header">
        <div className="d-flex justify-content-between align-items-center">
          <div>
            <h1 className="page-title"><i className="fas fa-chart-bar me-2 text-primary" />Field Reports</h1>
            <p className="text-muted">Daily visit performance & analytics</p>
          </div>
          <Button variant="success" onClick={exportCSV} style={{ borderRadius: 8 }}>
            <i className="fas fa-file-export me-2" />Export CSV
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card className="mb-3" style={{ borderRadius: 12, border: 'none', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
        <Card.Body>
          <Row className="g-2 align-items-end">
            <Col md={3}>
              <Form.Label style={{ fontWeight: 600 }}>Date</Form.Label>
              <Form.Control type="date" value={filterDate} onChange={e => setFilterDate(e.target.value)} style={{ borderRadius: 8 }} />
            </Col>
            <Col md={3}>
              <Form.Label style={{ fontWeight: 600 }}>Employee</Form.Label>
              <Form.Select value={filterEmployee} onChange={e => setFilterEmployee(e.target.value)} style={{ borderRadius: 8 }}>
                <option value="">All Employees</option>
                {employees.map(e => <option key={e._id} value={e._id}>{e.firstName} {e.lastName}</option>)}
              </Form.Select>
            </Col>
            <Col md={2}>
              <Button variant="outline-secondary" onClick={() => setFilterDate(new Date().toISOString().split('T')[0])} style={{ borderRadius: 8 }}>Today</Button>
            </Col>
          </Row>
        </Card.Body>
      </Card>

      {/* Summary Cards */}
      <Row className="g-3 mb-3">
        {[
          { label: 'Total Visits', value: totalVisited, icon: 'map-marker-alt', color: '#3b82f6' },
          { label: 'Orders Received', value: totalOrders, icon: 'shopping-cart', color: '#10b981' },
          { label: 'Total Deal Value', value: `₹${totalDeal.toLocaleString()}`, icon: 'rupee-sign', color: '#f59e0b' },
          { label: 'Visit Distance', value: `${totalKm.toFixed(1)} km`, icon: 'road', color: '#8b5cf6' },
          { label: 'Journey Distance', value: `${totalJourneyKm.toFixed(1)} km`, icon: 'route', color: '#10b981' },
        ].map((s, i) => (
          <Col md={2} key={i}>
            <Card style={{ borderRadius: 12, border: 'none', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
              <Card.Body className="d-flex align-items-center gap-3">
                <div style={{ width: 44, height: 44, borderRadius: 12, background: `${s.color}20`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <i className={`fas fa-${s.icon}`} style={{ color: s.color, fontSize: '1.1rem' }} />
                </div>
                <div>
                  <div style={{ fontSize: '1.3rem', fontWeight: 700 }}>{s.value}</div>
                  <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>{s.label}</div>
                </div>
              </Card.Body>
            </Card>
          </Col>
        ))}
      </Row>

      {/* View Toggle */}
      <div className="d-flex gap-2 mb-3">
        {[{ key: 'visits', label: 'Visit Reports', icon: 'map-marker-alt' }, { key: 'journey', label: 'Journey Distance', icon: 'route' }].map(v => (
          <button key={v.key} onClick={() => setActiveView(v.key)} style={{ padding: '0.42rem 1rem', borderRadius: 20, border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: '0.82rem', background: activeView === v.key ? '#3b82f6' : '#f1f5f9', color: activeView === v.key ? '#fff' : '#64748b', boxShadow: activeView === v.key ? '0 2px 8px rgba(59,130,246,0.3)' : 'none', transition: 'all 0.18s' }}>
            <i className={`fas fa-${v.icon} me-1`} />{v.label}
          </button>
        ))}
      </div>

      {/* Visit Reports Table */}
      {activeView === 'visits' && (
        <Card style={{ borderRadius: 12, border: 'none', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
          <Card.Header style={{ background: 'white', borderBottom: '1px solid #f3f4f6', borderRadius: '12px 12px 0 0' }}>
            <h6 className="mb-0" style={{ fontWeight: 600 }}>Employee Reports — {new Date(filterDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })}</h6>
          </Card.Header>
          <Card.Body className="p-0">
            {loading ? (
              <div className="text-center py-4"><div className="spinner-border text-primary" /></div>
            ) : (
              <div className="table-responsive">
                <Table hover className="mb-0">
                  <thead style={{ background: '#f8fafc' }}>
                    <tr>
                      <th>Employee</th>
                      <th>Planned</th>
                      <th>Visited</th>
                      <th>Completed</th>
                      <th>Distance</th>
                      <th>Duration</th>
                      <th>Orders</th>
                      <th>Deal Value</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reports.map(r => (
                      <tr key={r._id}>
                        <td>
                          <div style={{ fontWeight: 600 }}>{r.employeeId?.firstName} {r.employeeId?.lastName}</div>
                          <small className="text-muted">{r.employeeId?.department}</small>
                        </td>
                        <td>{r.totalPlanned}</td>
                        <td><Badge bg="info">{r.totalVisited}</Badge></td>
                        <td><Badge bg="success">{r.totalCompleted}</Badge></td>
                        <td>{r.totalDistanceKm} km</td>
                        <td>{r.totalDurationMinutes} min</td>
                        <td><Badge bg="warning" text="dark">{r.outcomeSummary?.ORDER_RECEIVED || 0}</Badge></td>
                        <td style={{ fontWeight: 600, color: '#10b981' }}>₹{r.totalDealValue?.toLocaleString()}</td>
                        <td>
                          <Button size="sm" variant="outline-primary" onClick={() => viewDailyReport(r.employeeId?._id)} style={{ borderRadius: 6 }}>
                            <i className="fas fa-eye me-1" />Details
                          </Button>
                        </td>
                      </tr>
                    ))}
                    {reports.length === 0 && (
                      <tr><td colSpan={9} className="text-center py-4 text-muted">No reports for this date</td></tr>
                    )}
                  </tbody>
                </Table>
              </div>
            )}
          </Card.Body>
        </Card>
      )}

      {/* Journey Distance Table */}
      {activeView === 'journey' && (
        <Card style={{ borderRadius: 12, border: 'none', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
          <Card.Header style={{ background: 'white', borderBottom: '1px solid #f3f4f6', borderRadius: '12px 12px 0 0' }}>
            <div className="d-flex justify-content-between align-items-center">
              <h6 className="mb-0" style={{ fontWeight: 600 }}>
                <i className="fas fa-route me-2 text-success" />
                Journey Distance — {new Date(filterDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })}
              </h6>
              <div style={{ fontSize: '0.82rem', color: '#6b7280' }}>
                Total: <strong style={{ color: '#10b981' }}>{totalJourneyKm.toFixed(1)} km</strong> across {journeys.length} employees
              </div>
            </div>
          </Card.Header>
          <Card.Body className="p-0">
            {journeyLoading ? (
              <div className="text-center py-4"><div className="spinner-border text-primary" /></div>
            ) : (
              <div className="table-responsive">
                <Table hover className="mb-0">
                  <thead style={{ background: '#f8fafc' }}>
                    <tr>
                      <th>#</th>
                      <th>Employee</th>
                      <th>Start Time</th>
                      <th>End Time</th>
                      <th>Total Distance</th>
                      <th>GPS Points</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {journeys.map((j, i) => (
                      <tr key={j._id}>
                        <td style={{ color: '#9ca3af', fontSize: '0.85rem' }}>{i + 1}</td>
                        <td>
                          <div style={{ fontWeight: 600 }}>{j.employeeId?.firstName} {j.employeeId?.lastName}</div>
                          <small className="text-muted">{j.employeeId?.department}</small>
                        </td>
                        <td style={{ fontSize: '0.85rem' }}>
                          {j.startTime ? new Date(j.startTime).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : '—'}
                        </td>
                        <td style={{ fontSize: '0.85rem' }}>
                          {j.endTime ? new Date(j.endTime).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : <span className="text-warning">Still Active</span>}
                        </td>
                        <td>
                          <span style={{ fontWeight: 700, fontSize: '1rem', color: '#10b981' }}>{j.totalDistanceKm} km</span>
                        </td>
                        <td style={{ fontSize: '0.85rem', color: '#6b7280' }}>{j.locationPoints?.length || 0} points</td>
                        <td>
                          <Badge bg={j.status === 'ACTIVE' ? 'warning' : j.status === 'COMPLETED' ? 'success' : 'secondary'} style={{ fontSize: '0.75rem' }}>
                            {j.status === 'AUTO_ENDED' ? 'Auto Ended' : j.status}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                    {journeys.length === 0 && (
                      <tr><td colSpan={7} className="text-center py-4 text-muted">No journey data for this date</td></tr>
                    )}
                  </tbody>
                </Table>
              </div>
            )}
          </Card.Body>
        </Card>
      )}

      {/* Daily Report Detail Modal */}
      <Modal show={!!selectedReport} onHide={() => setSelectedReport(null)} size="xl" centered scrollable>
        <Modal.Header closeButton style={{ border: 'none', padding: 0, position: 'relative' }}>
          {/* Hero Header */}
          <div style={{ width: '100%', background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)', padding: '1.5rem 1.75rem 1.25rem', borderRadius: '12px 12px 0 0' }}>
            <div className="d-flex align-items-center justify-content-between">
              <div className="d-flex align-items-center gap-3">
                <div style={{ width: 52, height: 52, borderRadius: 14, background: 'linear-gradient(135deg,#3b82f6,#6366f1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <i className="fas fa-user" style={{ color: 'white', fontSize: '1.3rem' }} />
                </div>
                <div>
                  <div style={{ color: 'white', fontWeight: 700, fontSize: '1.15rem', lineHeight: 1.2 }}>
                    {selectedReport?.employeeId?.firstName} {selectedReport?.employeeId?.lastName}
                  </div>
                  <div style={{ color: 'rgba(255,255,255,0.55)', fontSize: '0.8rem', marginTop: 3 }}>
                    <i className="fas fa-calendar-alt me-1" />
                    {selectedReport && fmtDate(selectedReport.date)}
                    {selectedReport?.employeeId?.department && (
                      <span className="ms-2"><i className="fas fa-building me-1" />{selectedReport.employeeId.department}</span>
                    )}
                  </div>
                </div>
              </div>
              <button onClick={() => setSelectedReport(null)} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: 8, width: 32, height: 32, color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <i className="fas fa-times" style={{ fontSize: '0.85rem' }} />
              </button>
            </div>

            {/* KPI Strip */}
            {selectedReport && (
              <div className="d-flex gap-2 mt-3 flex-wrap">
                {[
                  { icon: 'map-marker-alt', label: 'Visits', value: selectedReport.totalVisited, color: '#60a5fa' },
                  { icon: 'check-circle',   label: 'Completed', value: selectedReport.totalCompleted, color: '#34d399' },
                  { icon: 'road',           label: 'Distance', value: `${selectedReport.totalDistanceKm} km`, color: '#a78bfa' },
                  { icon: 'clock',          label: 'Duration', value: `${selectedReport.totalDurationMinutes} min`, color: '#fbbf24' },
                  { icon: 'rupee-sign',     label: 'Deal Value', value: `₹${(selectedReport.totalDealValue || 0).toLocaleString()}`, color: '#f472b6' },
                  { icon: 'shopping-cart',  label: 'Orders', value: selectedReport.outcomeSummary?.ORDER_RECEIVED || 0, color: '#4ade80' },
                ].map((k, i) => (
                  <div key={i} style={{ background: 'rgba(255,255,255,0.08)', borderRadius: 10, padding: '0.5rem 0.85rem', display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: 100 }}>
                    <i className={`fas fa-${k.icon}`} style={{ color: k.color, fontSize: '0.85rem' }} />
                    <div>
                      <div style={{ color: 'white', fontWeight: 700, fontSize: '0.9rem', lineHeight: 1 }}>{k.value}</div>
                      <div style={{ color: 'rgba(255,255,255,0.45)', fontSize: '0.65rem', marginTop: 2 }}>{k.label}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Modal.Header>

        <Modal.Body style={{ background: '#f8fafc', padding: '1.25rem 1.5rem' }}>
          {selectedReport && (
            <>
              {/* Outcome Breakdown */}
              {Object.values(selectedReport.outcomeSummary || {}).some(v => v > 0) && (
                <div className="mb-4">
                  <div style={{ fontWeight: 700, fontSize: '0.78rem', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.6rem' }}>
                    <i className="fas fa-chart-pie me-1" />Outcome Breakdown
                  </div>
                  <div className="d-flex flex-wrap gap-2">
                    {Object.entries(selectedReport.outcomeSummary).filter(([, v]) => v > 0).map(([k, v]) => {
                      const c = OUTCOME_COLORS[k] || OUTCOME_COLORS.NEUTRAL;
                      return (
                        <div key={k} style={{ background: c.bg, border: `1px solid ${c.border}`, borderRadius: 10, padding: '0.4rem 0.85rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          <span style={{ fontWeight: 700, fontSize: '1rem', color: c.color }}>{v}</span>
                          <span style={{ fontSize: '0.78rem', color: c.color }}>{OUTCOME_LABELS[k]}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Visit Cards */}
              <div style={{ fontWeight: 700, fontSize: '0.78rem', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.75rem' }}>
                <i className="fas fa-list-ul me-1" />Visit Details ({selectedReport.visits?.length || 0})
              </div>

              {(!selectedReport.visits || selectedReport.visits.length === 0) && (
                <div className="text-center py-5 text-muted">
                  <i className="fas fa-map-marker-alt" style={{ fontSize: '2rem', opacity: 0.3 }} />
                  <p className="mt-2 mb-0">No visits recorded for this day</p>
                </div>
              )}

              {selectedReport.visits?.map((visit, i) => {
                const oc = OUTCOME_COLORS[visit.outcome?.status] || OUTCOME_COLORS.NEUTRAL;
                const duration = visit.durationMinutes || (
                  visit.checkIn?.time && visit.checkOut?.time
                    ? Math.round((new Date(visit.checkOut.time) - new Date(visit.checkIn.time)) / 60000)
                    : null
                );
                return (
                  <div key={i} style={{ background: 'white', borderRadius: 14, border: '1px solid #e5e7eb', marginBottom: '0.85rem', overflow: 'hidden', boxShadow: '0 1px 6px rgba(0,0,0,0.05)' }}>
                    {/* Card Header */}
                    <div style={{ padding: '0.85rem 1.1rem', borderBottom: '1px solid #f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem' }}>
                      <div className="d-flex align-items-center gap-2">
                        <div style={{ width: 34, height: 34, borderRadius: 9, background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <span style={{ fontWeight: 700, fontSize: '0.8rem', color: '#64748b' }}>#{i + 1}</span>
                        </div>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#111827' }}>
                            {visit.clientId?.name || 'Unknown Client'}
                          </div>
                          {visit.clientId?.contactPerson && (
                            <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                              <i className="fas fa-user-tie me-1" />{visit.clientId.contactPerson}
                              {visit.clientId?.phone && visit.clientId.phone !== '-' && (
                                <span className="ms-2"><i className="fas fa-phone me-1" />{visit.clientId.phone}</span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="d-flex align-items-center gap-2">
                        {visit.selfReported && (
                          <span style={{ background: '#fef3c7', color: '#92400e', border: '1px solid #fde68a', borderRadius: 6, padding: '2px 8px', fontSize: '0.7rem', fontWeight: 600 }}>
                            <i className="fas fa-pen me-1" />Self-Reported
                          </span>
                        )}
                        {visit.outcome?.status && (
                          <span style={{ background: oc.bg, color: oc.color, border: `1px solid ${oc.border}`, borderRadius: 6, padding: '3px 10px', fontSize: '0.75rem', fontWeight: 600 }}>
                            {OUTCOME_LABELS[visit.outcome.status]}
                          </span>
                        )}
                        {visit.outcome?.dealValue > 0 && (
                          <span style={{ background: '#dcfce7', color: '#16a34a', border: '1px solid #86efac', borderRadius: 6, padding: '3px 10px', fontSize: '0.75rem', fontWeight: 700 }}>
                            ₹{visit.outcome.dealValue.toLocaleString()}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Card Body */}
                    <div style={{ padding: '0.85rem 1.1rem' }}>
                      {/* Time / Distance / Duration row */}
                      <div className="d-flex flex-wrap gap-3 mb-3">
                        {[
                          { icon: 'sign-in-alt',  label: 'Check-in',  value: fmt(visit.checkIn?.time),  color: '#10b981' },
                          { icon: 'sign-out-alt', label: 'Check-out', value: fmt(visit.checkOut?.time), color: '#ef4444' },
                          { icon: 'clock',        label: 'Duration',  value: duration ? `${duration} min` : '—', color: '#f59e0b' },
                          { icon: 'road',         label: 'Distance',  value: visit.totalDistanceKm > 0 ? `${visit.totalDistanceKm} km` : '—', color: '#8b5cf6' },
                        ].map((m, j) => (
                          <div key={j} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', background: '#f8fafc', borderRadius: 8, padding: '0.35rem 0.7rem', border: '1px solid #f1f5f9' }}>
                            <i className={`fas fa-${m.icon}`} style={{ color: m.color, fontSize: '0.75rem', width: 14 }} />
                            <div>
                              <div style={{ fontSize: '0.65rem', color: '#9ca3af', lineHeight: 1 }}>{m.label}</div>
                              <div style={{ fontSize: '0.82rem', fontWeight: 600, color: '#374151', lineHeight: 1.3 }}>{m.value}</div>
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Location row */}
                      {(visit.checkIn?.location?.address || visit.checkOut?.location?.address) && (
                        <div className="d-flex flex-wrap gap-2 mb-3">
                          {visit.checkIn?.location?.address && (
                            <div style={{ flex: 1, minWidth: 200, background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: '0.4rem 0.7rem', fontSize: '0.75rem' }}>
                              <span style={{ color: '#16a34a', fontWeight: 600 }}><i className="fas fa-map-pin me-1" />Check-in: </span>
                              <span style={{ color: '#374151' }}>{visit.checkIn.location.address.split(',').slice(0, 3).join(',')}</span>
                            </div>
                          )}
                          {visit.checkOut?.location?.address && (
                            <div style={{ flex: 1, minWidth: 200, background: '#fff1f2', border: '1px solid #fecdd3', borderRadius: 8, padding: '0.4rem 0.7rem', fontSize: '0.75rem' }}>
                              <span style={{ color: '#dc2626', fontWeight: 600 }}><i className="fas fa-map-pin me-1" />Check-out: </span>
                              <span style={{ color: '#374151' }}>{visit.checkOut.location.address.split(',').slice(0, 3).join(',')}</span>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Person met / Purpose */}
                      {(visit.personMet || visit.purposeOfVisit) && (
                        <div className="d-flex flex-wrap gap-2 mb-3">
                          {visit.personMet && (
                            <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, padding: '0.4rem 0.75rem', fontSize: '0.78rem' }}>
                              <i className="fas fa-handshake me-1" style={{ color: '#3b82f6' }} />
                              <span style={{ color: '#6b7280' }}>Met: </span>
                              <span style={{ fontWeight: 600, color: '#1e40af' }}>{visit.personMet}</span>
                            </div>
                          )}
                          {visit.purposeOfVisit && (
                            <div style={{ background: '#faf5ff', border: '1px solid #e9d5ff', borderRadius: 8, padding: '0.4rem 0.75rem', fontSize: '0.78rem' }}>
                              <i className="fas fa-bullseye me-1" style={{ color: '#7c3aed' }} />
                              <span style={{ color: '#6b7280' }}>Purpose: </span>
                              <span style={{ fontWeight: 600, color: '#5b21b6' }}>{visit.purposeOfVisit}</span>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Notes */}
                      {(visit.outcome?.notes || visit.selfReportNote) && (
                        <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, padding: '0.6rem 0.85rem', marginBottom: '0.75rem' }}>
                          <div style={{ fontSize: '0.7rem', fontWeight: 600, color: '#92400e', marginBottom: 3 }}>
                            <i className="fas fa-sticky-note me-1" />Notes
                          </div>
                          <div style={{ fontSize: '0.82rem', color: '#374151', lineHeight: 1.5 }}>
                            {visit.outcome?.notes || visit.selfReportNote}
                          </div>
                        </div>
                      )}

                      {/* Next action */}
                      {(visit.outcome?.nextAction || visit.outcome?.nextFollowUpDate) && (
                        <div style={{ background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: 8, padding: '0.6rem 0.85rem', marginBottom: '0.75rem' }}>
                          <div style={{ fontSize: '0.7rem', fontWeight: 600, color: '#0369a1', marginBottom: 3 }}>
                            <i className="fas fa-calendar-check me-1" />Next Action
                          </div>
                          {visit.outcome.nextAction && <div style={{ fontSize: '0.82rem', color: '#374151' }}>{visit.outcome.nextAction}</div>}
                          {visit.outcome.nextFollowUpDate && (
                            <div style={{ fontSize: '0.75rem', color: '#0284c7', marginTop: 2 }}>
                              <i className="fas fa-clock me-1" />Follow-up: {fmtDate(visit.outcome.nextFollowUpDate)}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Photos + Route button */}
                      <div className="d-flex align-items-center justify-content-between flex-wrap gap-2">
                        {visit.photos?.length > 0 && (
                          <div>
                            <div style={{ fontSize: '0.7rem', fontWeight: 600, color: '#6b7280', marginBottom: '0.4rem' }}>
                              <i className="fas fa-camera me-1" />Photos ({visit.photos.length})
                            </div>
                            <div className="d-flex gap-2 flex-wrap">
                              {visit.photos.map((ph, pi) => (
                                <div key={pi} onClick={() => setLightbox({ url: photoUrl(ph.url), caption: ph.address || visit.clientId?.name })}
                                  style={{ cursor: 'pointer', position: 'relative', borderRadius: 10, overflow: 'hidden', border: '2px solid #e5e7eb', boxShadow: '0 1px 4px rgba(0,0,0,0.1)' }}>
                                  <img src={photoUrl(ph.url)} alt="visit"
                                    style={{ width: 72, height: 72, objectFit: 'cover', display: 'block' }} />
                                  <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0)', transition: 'background 0.15s', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(0,0,0,0.3)'}
                                    onMouseLeave={e => e.currentTarget.style.background = 'rgba(0,0,0,0)'}>
                                    <i className="fas fa-expand" style={{ color: 'white', fontSize: '0.9rem', opacity: 0 }} />
                                  </div>
                                  {ph.address && (
                                    <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'rgba(0,0,0,0.55)', color: 'white', fontSize: '0.6rem', padding: '2px 4px', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                                      <i className="fas fa-map-marker-alt me-1" />{ph.address.split(',')[0]}
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        {visit.routePoints?.length > 1 && (
                          <Button size="sm" variant="outline-primary" onClick={() => openRouteMap(visit)}
                            style={{ borderRadius: 8, fontSize: '0.78rem', marginLeft: 'auto' }}>
                            <i className="fas fa-route me-1" />View Route Map
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </>
          )}
        </Modal.Body>

        <Modal.Footer style={{ background: '#f8fafc', borderTop: '1px solid #e5e7eb', padding: '0.75rem 1.5rem' }}>
          <div style={{ fontSize: '0.75rem', color: '#9ca3af' }}>
            <i className="fas fa-sync-alt me-1" />
            Report generated: {selectedReport && fmtDate(selectedReport.generatedAt || selectedReport.updatedAt)}
          </div>
          <Button variant="outline-secondary" size="sm" onClick={() => setSelectedReport(null)} style={{ borderRadius: 8 }}>Close</Button>
        </Modal.Footer>
      </Modal>

      {/* Route Map Modal */}
      <Modal show={showMapModal} onHide={() => setShowMapModal(false)} size="lg" centered>
        <Modal.Header closeButton>
          <Modal.Title><i className="fas fa-route me-2" />Route Map — {mapVisit?.clientId?.name}</Modal.Title>
        </Modal.Header>
        <Modal.Body style={{ padding: 0 }}>
          {mapVisit?.routePoints?.length > 0 && (
            <MapContainer
              center={[mapVisit.routePoints[0].lat, mapVisit.routePoints[0].lng]}
              zoom={14}
              style={{ height: 450, width: '100%' }}
            >
              <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="© OpenStreetMap" />
              <Polyline positions={mapVisit.routePoints.map(p => [p.lat, p.lng])} color="#3b82f6" weight={4} />
              <Marker position={[mapVisit.routePoints[0].lat, mapVisit.routePoints[0].lng]}>
                <Popup>Check-in point</Popup>
              </Marker>
              <Marker position={[mapVisit.routePoints[mapVisit.routePoints.length - 1].lat, mapVisit.routePoints[mapVisit.routePoints.length - 1].lng]}>
                <Popup>Check-out point</Popup>
              </Marker>
            </MapContainer>
          )}
        </Modal.Body>
      </Modal>

      {/* Lightbox */}
      {lightbox && (
        <div
          onClick={() => setLightbox(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.9)', zIndex: 9999, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', cursor: 'zoom-out' }}
        >
          <button
            onClick={() => setLightbox(null)}
            style={{ position: 'absolute', top: 20, right: 24, background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: 8, width: 38, height: 38, color: 'white', fontSize: '1rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            <i className="fas fa-times" />
          </button>
          <img
            src={lightbox.url}
            alt="visit"
            onClick={e => e.stopPropagation()}
            style={{ maxWidth: '90vw', maxHeight: '80vh', borderRadius: 12, boxShadow: '0 8px 40px rgba(0,0,0,0.6)', objectFit: 'contain', cursor: 'default' }}
          />
          {lightbox.caption && (
            <div style={{ marginTop: 14, color: 'rgba(255,255,255,0.7)', fontSize: '0.85rem', maxWidth: '80vw', textAlign: 'center' }}>
              <i className="fas fa-map-marker-alt me-1" />{lightbox.caption}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default FieldReports;
