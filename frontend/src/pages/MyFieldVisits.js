import React, { useState, useEffect } from 'react';
import { Row, Col, Card, Badge, Button, Form, Modal } from 'react-bootstrap';
import { MapContainer, TileLayer, Polyline, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import api from '../utils/api';
import { toast } from 'react-toastify';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({ iconRetinaUrl: require('leaflet/dist/images/marker-icon-2x.png'), iconUrl: require('leaflet/dist/images/marker-icon.png'), shadowUrl: require('leaflet/dist/images/marker-shadow.png') });

const OUTCOME_LABELS = { ORDER_RECEIVED: '🎉 Order Received', POSITIVE: '👍 Positive', NEUTRAL: '🤝 Neutral', NEGATIVE: '👎 Not Interested', DEMO_SCHEDULED: '📅 Demo Scheduled', PROPOSAL_SENT: '📄 Proposal Sent', NO_RESPONSE: '📵 No Response' };
const STATUS_COLORS = { PLANNED: 'secondary', CHECKED_IN: 'warning', COMPLETED: 'success', CANCELLED: 'danger' };

const MyFieldVisits = () => {
  const [visits, setVisits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState(() => { const d = new Date(); d.setDate(d.getDate() - 7); return d.toISOString().split('T')[0]; });
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [statusFilter, setStatusFilter] = useState('');
  const [selectedVisit, setSelectedVisit] = useState(null);
  const [showMapModal, setShowMapModal] = useState(false);
  const [mapVisit, setMapVisit] = useState(null);

  useEffect(() => { fetchVisits(); }, [startDate, endDate, statusFilter]);

  const fetchVisits = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (startDate) params.append('date', startDate);
      if (statusFilter) params.append('status', statusFilter);
      const res = await api.get(`/api/field-visits?${params}`);
      // Filter by date range client-side
      const filtered = res.data.filter(v => {
        const d = new Date(v.visitDate);
        return d >= new Date(startDate) && d <= new Date(endDate + 'T23:59:59');
      });
      setVisits(filtered);
    } catch { toast.error('Failed to load visits'); }
    finally { setLoading(false); }
  };

  // Stats
  const completed = visits.filter(v => v.status === 'COMPLETED').length;
  const totalKm = visits.reduce((s, v) => s + (v.totalDistanceKm || 0), 0);
  const totalDeal = visits.reduce((s, v) => s + (v.outcome?.dealValue || 0), 0);
  const orders = visits.filter(v => v.outcome?.status === 'ORDER_RECEIVED').length;

  if (loading) return <div className="d-flex justify-content-center align-items-center" style={{ height: '60vh' }}><div className="spinner-border text-primary" /></div>;

  return (
    <div className="fade-in-up">
      <div className="page-header">
        <h1 className="page-title"><i className="fas fa-history me-2" style={{ color: '#10b981' }} />My Visit History</h1>
        <p className="text-muted">Track your field visit performance</p>
      </div>

      {/* Stats */}
      <Row className="g-3 mb-3">
        {[
          { label: 'Completed', value: completed, icon: 'check-circle', color: '#10b981' },
          { label: 'Orders', value: orders, icon: 'shopping-cart', color: '#10b981' },
          { label: 'Deal Value', value: `₹${totalDeal.toLocaleString()}`, icon: 'rupee-sign', color: '#10b981' },
          { label: 'Distance', value: `${totalKm.toFixed(1)} km`, icon: 'road', color: '#10b981' },
        ].map((s, i) => (
          <Col xs={6} md={3} key={i}>
            <Card style={{ borderRadius: 12, border: 'none', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
              <Card.Body className="text-center py-3">
                <i className={`fas fa-${s.icon} mb-2`} style={{ color: s.color, fontSize: '1.5rem' }} />
                <div style={{ fontSize: '1.4rem', fontWeight: 700 }}>{s.value}</div>
                <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>{s.label}</div>
              </Card.Body>
            </Card>
          </Col>
        ))}
      </Row>

      {/* Filters */}
      <Card className="mb-3" style={{ borderRadius: 12, border: 'none', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
        <Card.Body>
          <Row className="g-2">
            <Col md={3}>
              <Form.Label style={{ fontWeight: 600 }}>From</Form.Label>
              <Form.Control type="date" value={startDate} onChange={e => setStartDate(e.target.value)} style={{ borderRadius: 8 }} />
            </Col>
            <Col md={3}>
              <Form.Label style={{ fontWeight: 600 }}>To</Form.Label>
              <Form.Control type="date" value={endDate} onChange={e => setEndDate(e.target.value)} style={{ borderRadius: 8 }} />
            </Col>
            <Col md={3}>
              <Form.Label style={{ fontWeight: 600 }}>Status</Form.Label>
              <Form.Select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={{ borderRadius: 8 }}>
                <option value="">All</option>
                <option value="COMPLETED">Completed</option>
                <option value="CHECKED_IN">In Progress</option>
                <option value="PLANNED">Planned</option>
                <option value="CANCELLED">Cancelled</option>
              </Form.Select>
            </Col>
          </Row>
        </Card.Body>
      </Card>

      {/* Visit Cards */}
      {visits.length === 0 ? (
        <Card className="text-center py-5" style={{ borderRadius: 12, border: '2px dashed #e5e7eb' }}>
          <Card.Body>
            <i className="fas fa-map-marked-alt text-muted" style={{ fontSize: '3rem' }} />
            <p className="text-muted mt-3 mb-0">No visits found for this period</p>
          </Card.Body>
        </Card>
      ) : (
        visits.map(visit => {
          const client = visit.clientId;
          return (
            <Card key={visit._id} className="mb-3" style={{ borderRadius: 12, border: '1px solid #e5e7eb', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
              <Card.Body>
                <div className="d-flex justify-content-between align-items-start mb-2">
                  <div>
                    <h6 style={{ fontWeight: 700, marginBottom: 2 }}>{client?.name}</h6>
                    <small className="text-muted"><i className="fas fa-user me-1" />{client?.contactPerson} · {client?.phone}</small>
                  </div>
                  <div className="d-flex flex-column align-items-end gap-1">
                    <Badge bg={STATUS_COLORS[visit.status]}>{visit.status.replace('_', ' ')}</Badge>
                    <small className="text-muted">{new Date(visit.visitDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</small>
                  </div>
                </div>

                {/* Timing & Distance */}
                {visit.status === 'COMPLETED' && (
                  <div className="d-flex gap-3 mb-2" style={{ fontSize: '0.82rem', color: '#6b7280' }}>
                    {visit.checkIn?.time && <span><i className="fas fa-sign-in-alt me-1 text-success" />{new Date(visit.checkIn.time).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</span>}
                    {visit.checkOut?.time && <span><i className="fas fa-sign-out-alt me-1 text-danger" />{new Date(visit.checkOut.time).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</span>}
                    {visit.totalDistanceKm > 0 && <span><i className="fas fa-road me-1 text-primary" />{visit.totalDistanceKm} km</span>}
                    {visit.durationMinutes > 0 && <span><i className="fas fa-clock me-1 text-warning" />{visit.durationMinutes} min</span>}
                  </div>
                )}

                {/* Outcome */}
                {visit.outcome?.status && (
                  <div className="mb-2">
                    <Badge bg="info" className="me-1">{OUTCOME_LABELS[visit.outcome.status]}</Badge>
                    {visit.outcome.dealValue > 0 && <Badge bg="success">₹{visit.outcome.dealValue.toLocaleString()}</Badge>}
                    {visit.outcome.notes && <p className="mb-0 mt-1" style={{ fontSize: '0.82rem', color: '#6b7280' }}>{visit.outcome.notes}</p>}
                    {visit.outcome.nextAction && <p className="mb-0" style={{ fontSize: '0.82rem', color: '#10b981' }}><i className="fas fa-arrow-right me-1" />{visit.outcome.nextAction}</p>}
                  </div>
                )}

                {/* Photos */}
                {visit.photos?.length > 0 && (
                  <div className="d-flex gap-2 mb-2 flex-wrap">
                    {visit.photos.map((p, i) => (
                      <img key={i} src={`${process.env.REACT_APP_API_URL || 'http://localhost:5001'}${p.url}`} alt="visit" style={{ width: 64, height: 64, objectFit: 'cover', borderRadius: 8, border: '1px solid #e5e7eb', cursor: 'pointer' }} onClick={() => window.open(`${process.env.REACT_APP_API_URL || 'http://localhost:5001'}${p.url}`, '_blank')} />
                    ))}
                  </div>
                )}

                {/* Route Map Button */}
                {visit.routePoints?.length > 1 && (
                  <Button size="sm" onClick={() => { setMapVisit(visit); setShowMapModal(true); }} style={{ borderRadius: 8, fontSize: '0.8rem', background: '#10b981', border: 'none', color: '#fff' }}>
                    <i className="fas fa-route me-1" />View Route ({visit.routePoints.length} points)
                  </Button>
                )}
              </Card.Body>
            </Card>
          );
        })
      )}

      {/* Route Map Modal */}
      <Modal show={showMapModal} onHide={() => setShowMapModal(false)} size="lg" centered>
        <Modal.Header closeButton>
          <Modal.Title><i className="fas fa-route me-2" />Route — {mapVisit?.clientId?.name}</Modal.Title>
        </Modal.Header>
        <Modal.Body style={{ padding: 0 }}>
          {mapVisit?.routePoints?.length > 0 && (
            <MapContainer center={[mapVisit.routePoints[0].lat, mapVisit.routePoints[0].lng]} zoom={14} style={{ height: 450, width: '100%' }}>
              <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="© OpenStreetMap" />
              <Polyline positions={mapVisit.routePoints.map(p => [p.lat, p.lng])} color="#10b981" weight={4} />
              <Marker position={[mapVisit.routePoints[0].lat, mapVisit.routePoints[0].lng]}>
                <Popup>Check-in · {mapVisit.checkIn?.location?.address?.split(',')[0]}</Popup>
              </Marker>
              {mapVisit.routePoints.length > 1 && (
                <Marker position={[mapVisit.routePoints[mapVisit.routePoints.length - 1].lat, mapVisit.routePoints[mapVisit.routePoints.length - 1].lng]}>
                  <Popup>Check-out · {mapVisit.checkOut?.location?.address?.split(',')[0]}</Popup>
                </Marker>
              )}
              {mapVisit.photos?.map((p, i) => p.lat && (
                <Marker key={i} position={[p.lat, p.lng]}>
                  <Popup><img src={`${process.env.REACT_APP_API_URL || 'http://localhost:5001'}${p.url}`} alt="photo" style={{ width: 120, borderRadius: 6 }} /></Popup>
                </Marker>
              ))}
            </MapContainer>
          )}
        </Modal.Body>
      </Modal>
    </div>
  );
};

export default MyFieldVisits;
