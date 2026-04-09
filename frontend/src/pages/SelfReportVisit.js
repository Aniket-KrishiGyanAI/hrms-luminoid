import React, { useState, useRef } from 'react';
import { Card, Form, Button, Row, Col, Badge } from 'react-bootstrap';
import api from '../utils/api';
import { toast } from 'react-toastify';

const OUTCOME_OPTIONS = [
  { value: 'POSITIVE',       label: 'Positive',          icon: 'thumbs-up',        color: '#10b981' },
  { value: 'NEUTRAL',        label: 'Neutral / Follow-up',icon: 'handshake',        color: '#f59e0b' },
  { value: 'NEGATIVE',       label: 'Not Interested',    icon: 'thumbs-down',      color: '#ef4444' },
  { value: 'ORDER_RECEIVED', label: 'Order Received',    icon: 'check-circle',     color: '#3b82f6' },
  { value: 'DEMO_SCHEDULED', label: 'Demo Scheduled',    icon: 'calendar-check',   color: '#8b5cf6' },
  { value: 'PROPOSAL_SENT',  label: 'Proposal Sent',     icon: 'file-alt',         color: '#0ea5e9' },
  { value: 'NO_RESPONSE',    label: 'No Response',       icon: 'phone-slash',      color: '#6b7280' },
];

const EMPTY = {
  clientName: '', personMet: '', phone: '', purposeOfVisit: '',
  notes: '', outcome: 'NEUTRAL', dealValue: '',
};

const getLocation = () =>
  new Promise((resolve, reject) => {
    console.log('🔵 getLocation called');
    console.log('Protocol:', window.location.protocol);
    console.log('Hostname:', window.location.hostname);
    console.log('navigator.geolocation available:', !!navigator.geolocation);
    
    if (!navigator.geolocation) {
      console.error('❌ Geolocation API not available');
      reject({ code: 0, message: 'Geolocation not supported on this device' });
      return;
    }
    
    console.log('🟢 Starting getCurrentPosition...');
    navigator.geolocation.getCurrentPosition(
      p => {
        console.log('✅ SUCCESS! Position received');
        console.log('Latitude:', p.coords.latitude);
        console.log('Longitude:', p.coords.longitude);
        console.log('Accuracy:', p.coords.accuracy, 'meters');
        resolve({ lat: p.coords.latitude, lng: p.coords.longitude });
      },
      error => {
        console.error('❌ getCurrentPosition ERROR');
        console.error('Error code:', error.code);
        console.error('Error message:', error.message);
        
        // Handle specific geolocation errors
        const errorDetails = {
          code: error.code,
          message: error.message,
        };
        
        if (error.code === 1) {
          console.error('🔒 PERMISSION_DENIED');
          errorDetails.userMessage = 'Location permission denied. Please enable location in your phone settings or browser permissions.';
          errorDetails.action = 'CHECK_PERMISSIONS';
        } else if (error.code === 2) {
          console.error('📡 POSITION_UNAVAILABLE');
          errorDetails.userMessage = 'GPS signal not available. Please ensure GPS is enabled and you are in an open area.';
          errorDetails.action = 'CHECK_GPS';
        } else if (error.code === 3) {
          console.error('⏱️ TIMEOUT');
          errorDetails.userMessage = 'Location request timed out. Please try again or move to an area with better GPS signal.';
          errorDetails.action = 'RETRY';
        } else {
          console.error('❓ UNKNOWN ERROR');
          errorDetails.userMessage = 'Unable to get your location. Please try again.';
          errorDetails.action = 'RETRY';
        }
        
        reject(errorDetails);
      },
      { 
        enableHighAccuracy: true, 
        timeout: 15000,  // 15 second timeout for mobile GPS lock
        maximumAge: 0    // Don't use cached location
      }
    );
  });

const getAddress = async (lat, lng) => {
  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`);
    const data = await res.json();
    return data.display_name || `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
  } catch {
    return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
  }
};

const SelfReportVisit = () => {
  const [form, setForm] = useState(EMPTY);
  const [photo, setPhoto] = useState(null);
  const [gps, setGps] = useState(null);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [outcomeOpen, setOutcomeOpen] = useState(false);
  const photoRef = useRef(null);
  const outcomeRef = useRef(null);

  // Close dropdown on outside click
  React.useEffect(() => {
    const handler = (e) => { if (outcomeRef.current && !outcomeRef.current.contains(e.target)) setOutcomeOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const captureGPS = async () => {
    setGpsLoading(true);
    try {
      console.log('🔵 Starting GPS capture...');
      const pos = await getLocation();
      console.log('✅ GPS captured:', pos);
      const address = await getAddress(pos.lat, pos.lng);
      setGps({ ...pos, address });
      toast.success('✅ Location captured!', { autoClose: 3000 });
      console.log('📍 Location saved with address:', address);
    } catch (error) {
      console.error('❌ GPS Error Code:', error.code, 'Message:', error.message);
      
      if (error.code === 1) {
        console.error('🔒 PERMISSION DENIED - User rejected location access');
        toast.error('🔒 Permission Denied - Allow location access in Settings', { autoClose: 7000 });
        // Show alert with steps
        setTimeout(() => {
          alert('📍 HOW TO ENABLE LOCATION:\n\n' +
            '📱 iOS (Safari):\n' +
            '1. Open Settings → Safari → Location\n' +
            '2. Select "Allow"\n' +
            '3. Refresh the page\n\n' +
            '🤖 Android (Chrome):\n' +
            '1. Tap 🔒 in address bar\n' +
            '2. Tap Permissions → Location\n' +
            '3. Select "Allow"');
        }, 500);
      } else if (error.code === 2) {
        console.error('📡 GPS UNAVAILABLE - Location info unavailable');
        toast.error('📡 GPS unavailable - Move to open area', { autoClose: 6000 });
      } else if (error.code === 3) {
        console.error('⏱️ TIMEOUT - GPS request took too long');
        toast.error('⏱️ GPS timeout - Try again in open area', { autoClose: 5000 });
      } else if (error.code === 0) {
        console.error('⚠️ NOT SUPPORTED - Geolocation API not available');
        toast.error('⚠️ GPS not supported on this device', { autoClose: 5000 });
      } else {
        console.error('❓ UNKNOWN ERROR');
        toast.error(`❌ Location error: ${error.message}`, { autoClose: 5000 });
      }
    } finally {
      setGpsLoading(false);
    }
  };

  const handlePhoto = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    // Show preview immediately
    setPhoto({ file, preview: URL.createObjectURL(file) });
    
    // Capture GPS automatically if not already captured
    if (!gps) {
      toast.info('📍 Capturing location...', { autoClose: 2000 });
      captureGPS();
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.clientName.trim()) { toast.error('Client / place name is required'); return; }
    setSubmitting(true);
    try {
      const fd = new FormData();
      Object.entries(form).forEach(([k, v]) => fd.append(k, v));
      if (gps) { fd.append('lat', gps.lat); fd.append('lng', gps.lng); fd.append('address', gps.address); }
      if (photo?.file) fd.append('photo', photo.file);

      await api.post('/api/field-visits/self-report', fd, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      toast.success('Visit logged successfully!');
      setForm(EMPTY);
      setPhoto(null);
      setGps(null);
      setSubmitted(true);
      setTimeout(() => setSubmitted(false), 4000);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to submit visit');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fade-in-up pb-5">
      <div className="page-header">
        <h1 className="page-title"><i className="fas fa-plus-circle me-2" style={{ color: '#10b981' }} />Log a Visit</h1>
        <p className="text-muted">Record a self-initiated client visit with photo proof</p>
      </div>

      {/* GPS Permissions & Setup Info */}
      {(() => {
        const isHttps = window.location.protocol === 'https:';
        const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
        const needsHttps = !isHttps && !isLocalhost;
        
        return (
          <div className={`alert d-flex align-items-start gap-2 mb-3`} 
               style={{ borderRadius: 10, border: needsHttps ? '1px solid #f59e0b' : '1px solid #bfdbfe' }}>
            <i className={needsHttps ? 'fas fa-exclamation-triangle' : 'fas fa-info-circle'} 
               style={{ marginTop: '0.25rem', flexShrink: 0, color: needsHttps ? '#d97706' : '#2563eb' }} />
            <div style={{ fontSize: '0.88rem', lineHeight: 1.6 }}>
              {needsHttps ? (
                <>
                  <strong>⚠️ Location May Not Work on HTTP</strong>
                  <p style={{ marginBottom: '0.5rem' }}>You're accessing via HTTP on a non-local IP. GPS requires HTTPS on mobile devices.</p>
                  <p style={{ marginBottom: '0.5rem', fontSize: '0.8rem' }}>
                    <strong>Fix:</strong> Use HTTPS URL or access from localhost/127.0.0.1
                  </p>
                  <p style={{ marginBottom: 0, fontSize: '0.8rem' }}>
                    <strong>For now:</strong> Tap "Capture GPS Location" button to try. If it fails, check the URL.
                  </p>
                </>
              ) : (
                <>
                  <strong>📍 Location Permission Required</strong>
                  <p style={{ marginBottom: 0 }}>This app needs GPS access to tag your visits. When prompted, <strong>allow location access</strong>.</p>
                </>
              )}
            </div>
          </div>
        );
      })()}

      {submitted && (
        <div className="alert alert-success d-flex align-items-center gap-2 mb-3" style={{ borderRadius: 10 }}>
          <i className="fas fa-check-circle" />
          <span>Visit logged! It will appear in your Visit History.</span>
        </div>
      )}

      <Form onSubmit={handleSubmit}>
        {/* Photo capture card */}
        <Card className="mb-3" style={{ borderRadius: 12, border: 'none', boxShadow: '0 2px 12px rgba(0,0,0,0.08)' }}>
          <Card.Body>
            <div className="d-flex align-items-center gap-2 mb-3">
              <i className="fas fa-camera" style={{ fontSize: '1.1rem', color: '#10b981' }} />
              <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>Visit Photo</span>
              <Badge bg="secondary" style={{ fontSize: '0.7rem' }}>with GPS</Badge>
            </div>

            <input ref={photoRef} type="file" accept="image/*" capture="environment"
              style={{ display: 'none' }} onChange={handlePhoto} />

            {photo ? (
              <div className="position-relative d-inline-block">
                <img src={photo.preview} alt="visit"
                  style={{ width: '100%', maxHeight: 220, objectFit: 'cover', borderRadius: 10, border: '2px solid #10b981' }} />
                <Button size="sm" variant="danger"
                  style={{ position: 'absolute', top: 6, right: 6, borderRadius: 20, padding: '2px 8px' }}
                  onClick={() => setPhoto(null)}>
                  <i className="fas fa-times" />
                </Button>
                {gps && (
                  <div style={{ position: 'absolute', bottom: 8, left: 8, background: 'rgba(0,0,0,0.6)', color: 'white', borderRadius: 6, padding: '3px 8px', fontSize: '0.72rem' }}>
                    <i className="fas fa-map-marker-alt me-1" />{gps.address.split(',')[0]}
                  </div>
                )}
              </div>
            ) : (
              <div
                onClick={() => photoRef.current.click()}
                style={{ border: '2px dashed #d1d5db', borderRadius: 10, padding: '2rem', textAlign: 'center', cursor: 'pointer', background: '#f9fafb' }}>
                <i className="fas fa-camera text-muted" style={{ fontSize: '2rem' }} />
                <p className="text-muted mb-0 mt-2" style={{ fontSize: '0.88rem' }}>Tap to capture photo</p>
                <small className="text-muted">GPS location will be attached automatically</small>
              </div>
            )}

            {/* GPS capture widget */}
            <div className="mt-3">
              {!gps ? (
                <button
                  type="button"
                  onClick={captureGPS}
                  disabled={gpsLoading}
                  style={{
                    width: '100%',
                    border: 'none',
                    borderRadius: 14,
                    padding: '0',
                    cursor: gpsLoading ? 'not-allowed' : 'pointer',
                    background: 'none',
                    outline: 'none',
                  }}
                >
                  <div style={{
                    background: gpsLoading
                      ? 'linear-gradient(135deg, #10b981, #059669)'
                      : 'linear-gradient(135deg, #10b981, #059669)',
                    borderRadius: 14,
                    padding: '1rem 1.25rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '1rem',
                    boxShadow: gpsLoading
                      ? '0 4px 20px rgba(16,185,129,0.4)'
                      : '0 4px 20px rgba(16,185,129,0.35)',
                    transition: 'all 0.3s',
                  }}>
                    {/* Animated icon */}
                    <div style={{
                      width: 48, height: 48, borderRadius: 12,
                      background: 'rgba(255,255,255,0.2)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      flexShrink: 0,
                      animation: gpsLoading ? 'gps-pulse 1.2s ease-in-out infinite' : 'none',
                    }}>
                      <i className={gpsLoading ? 'fas fa-circle-notch fa-spin' : 'fas fa-satellite-dish'}
                        style={{ color: 'white', fontSize: '1.4rem' }} />
                    </div>
                    <div style={{ textAlign: 'left', flex: 1 }}>
                      <div style={{ color: 'white', fontWeight: 700, fontSize: '0.95rem', lineHeight: 1.2 }}>
                        {gpsLoading ? 'Locating you...' : 'Capture GPS Location'}
                      </div>
                      <div style={{ color: 'rgba(255,255,255,0.8)', fontSize: '0.75rem', marginTop: 3 }}>
                        {gpsLoading ? 'Getting your coordinates' : 'Tap to tag this visit with your location'}
                      </div>
                    </div>
                    {!gpsLoading && (
                      <i className="fas fa-chevron-right" style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.85rem' }} />
                    )}
                  </div>
                </button>
              ) : (
                <div style={{
                  background: 'linear-gradient(135deg, #ecfdf5, #d1fae5)',
                  border: '1.5px solid #6ee7b7',
                  borderRadius: 14,
                  padding: '0.85rem 1.1rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                }}>
                  <div style={{
                    width: 40, height: 40, borderRadius: 10,
                    background: 'linear-gradient(135deg, #10b981, #059669)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0,
                    boxShadow: '0 2px 8px rgba(16,185,129,0.4)',
                  }}>
                    <i className="fas fa-map-marker-alt" style={{ color: 'white', fontSize: '1rem' }} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: '0.8rem', color: '#065f46' }}>Location Captured ✓</div>
                    <div style={{ fontSize: '0.75rem', color: '#047857', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {gps.address.split(',').slice(0, 2).join(',')}
                    </div>
                  </div>
                  <button type="button" onClick={() => setGps(null)}
                    style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', padding: 4, flexShrink: 0 }}>
                    <i className="fas fa-redo" style={{ fontSize: '0.8rem' }} />
                  </button>
                </div>
              )}
            </div>
            <style>{`
              @keyframes gps-pulse {
                0%, 100% { transform: scale(1); opacity: 1; }
                50% { transform: scale(1.12); opacity: 0.85; }
              }
            `}</style>
          </Card.Body>
        </Card>

        {/* Visit details card */}
        <Card className="mb-3" style={{ borderRadius: 12, border: 'none', boxShadow: '0 2px 12px rgba(0,0,0,0.08)' }}>
          <Card.Body>
            <div className="d-flex align-items-center gap-2 mb-3">
              <i className="fas fa-clipboard-list" style={{ fontSize: '1.1rem', color: '#10b981' }} />
              <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>Visit Details</span>
            </div>

            <Row className="g-3">
              <Col md={6}>
                <Form.Group>
                  <Form.Label style={{ fontWeight: 600, fontSize: '0.88rem' }}>Client / Company Name *</Form.Label>
                  <Form.Control
                    value={form.clientName}
                    onChange={e => set('clientName', e.target.value)}
                    placeholder="e.g., ABC Traders"
                    required style={{ borderRadius: 8 }} />
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group>
                  <Form.Label style={{ fontWeight: 600, fontSize: '0.88rem' }}>Person Met</Form.Label>
                  <Form.Control
                    value={form.personMet}
                    onChange={e => set('personMet', e.target.value)}
                    placeholder="e.g., Mr. Sharma (Purchase Manager)"
                    style={{ borderRadius: 8 }} />
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group>
                  <Form.Label style={{ fontWeight: 600, fontSize: '0.88rem' }}>Phone Number</Form.Label>
                  <Form.Control
                    type="tel"
                    value={form.phone}
                    onChange={e => set('phone', e.target.value)}
                    placeholder="Contact number"
                    style={{ borderRadius: 8 }} />
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group>
                  <Form.Label style={{ fontWeight: 600, fontSize: '0.88rem' }}>Purpose of Visit</Form.Label>
                  <Form.Control
                    value={form.purposeOfVisit}
                    onChange={e => set('purposeOfVisit', e.target.value)}
                    placeholder="e.g., Product demo, Follow-up on quotation"
                    style={{ borderRadius: 8 }} />
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group>
                  <Form.Label style={{ fontWeight: 600, fontSize: '0.88rem' }}>Outcome</Form.Label>
                  <div ref={outcomeRef} style={{ position: 'relative' }}>
                    {/* Trigger */}
                    <div
                      onClick={() => setOutcomeOpen(o => !o)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '0.6rem',
                        padding: '0.5rem 0.75rem', borderRadius: 8, cursor: 'pointer',
                        border: '1px solid #dee2e6', background: 'white',
                        userSelect: 'none',
                      }}
                    >
                      {(() => { const o = OUTCOME_OPTIONS.find(o => o.value === form.outcome);
                        return (
                          <>
                            <div style={{ width: 24, height: 24, borderRadius: 6, background: o.color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                              <i className={`fas fa-${o.icon}`} style={{ color: 'white', fontSize: '0.7rem' }} />
                            </div>
                            <span style={{ flex: 1, fontSize: '0.875rem', color: '#212529' }}>{o.label}</span>
                            <i className={`fas fa-chevron-${outcomeOpen ? 'up' : 'down'}`} style={{ color: '#6b7280', fontSize: '0.75rem' }} />
                          </>
                        );
                      })()}
                    </div>
                    {/* Dropdown list */}
                    {outcomeOpen && (
                      <div style={{
                        position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0,
                        background: 'white', borderRadius: 10, zIndex: 200,
                        boxShadow: '0 8px 24px rgba(0,0,0,0.12)', border: '1px solid #e5e7eb',
                        overflow: 'hidden',
                      }}>
                        {OUTCOME_OPTIONS.map(o => (
                          <div
                            key={o.value}
                            onClick={() => { set('outcome', o.value); setOutcomeOpen(false); }}
                            style={{
                              display: 'flex', alignItems: 'center', gap: '0.65rem',
                              padding: '0.55rem 0.85rem', cursor: 'pointer',
                              background: form.outcome === o.value ? `${o.color}12` : 'white',
                              borderLeft: form.outcome === o.value ? `3px solid ${o.color}` : '3px solid transparent',
                              transition: 'background 0.12s',
                            }}
                          >
                            <div style={{ width: 28, height: 28, borderRadius: 7, background: o.color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                              <i className={`fas fa-${o.icon}`} style={{ color: 'white', fontSize: '0.72rem' }} />
                            </div>
                            <span style={{ fontSize: '0.85rem', fontWeight: form.outcome === o.value ? 600 : 400, color: form.outcome === o.value ? o.color : '#374151' }}>
                              {o.label}
                            </span>
                            {form.outcome === o.value && <i className="fas fa-check ms-auto" style={{ color: o.color, fontSize: '0.75rem' }} />}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group>
                  <Form.Label style={{ fontWeight: 600, fontSize: '0.88rem' }}>Deal Value (₹)</Form.Label>
                  <Form.Control
                    type="number" min="0"
                    value={form.dealValue}
                    onChange={e => set('dealValue', e.target.value)}
                    placeholder="0" style={{ borderRadius: 8 }} />
                </Form.Group>
              </Col>
              <Col md={12}>
                <Form.Group>
                  <Form.Label style={{ fontWeight: 600, fontSize: '0.88rem' }}>Notes</Form.Label>
                  <Form.Control
                    as="textarea" rows={3}
                    value={form.notes}
                    onChange={e => set('notes', e.target.value)}
                    placeholder="What was discussed? Any follow-up needed?"
                    style={{ borderRadius: 8 }} />
                </Form.Group>
              </Col>
            </Row>
          </Card.Body>
        </Card>

        <Button type="submit" disabled={submitting}
          style={{ borderRadius: 10, width: '100%', padding: '0.75rem', fontWeight: 700, fontSize: '1rem', background: '#10b981', border: 'none', color: '#fff' }}>
          {submitting
            ? <><span className="spinner-border spinner-border-sm me-2" />Submitting...</>
            : <><i className="fas fa-paper-plane me-2" />Submit Visit</>}
        </Button>
      </Form>
    </div>
  );
};

export default SelfReportVisit;
