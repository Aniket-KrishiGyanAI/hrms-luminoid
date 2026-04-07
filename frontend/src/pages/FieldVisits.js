import React, { useState, useEffect, useRef } from 'react';
import { Card, Button, Badge, Modal, Form, Row, Col } from 'react-bootstrap';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import { toast } from 'react-toastify';
import useJourneyTracker from '../hooks/useJourneyTracker';
import './FieldVisits.css';

const OUTCOME_OPTIONS = [
  { value: 'POSITIVE', label: '👍 Positive' },
  { value: 'NEUTRAL', label: '🤝 Neutral / Follow-up' },
  { value: 'NEGATIVE', label: '👎 Not Interested' },
  { value: 'ORDER_RECEIVED', label: '🎉 Order Received' },
  { value: 'DEMO_SCHEDULED', label: '📅 Demo Scheduled' },
  { value: 'PROPOSAL_SENT', label: '📄 Proposal Sent' },
  { value: 'NO_RESPONSE', label: '📵 No Response' },
];

const getLocation = () =>
  new Promise((resolve, reject) =>
    navigator.geolocation.getCurrentPosition(
      p => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
      reject,
      { enableHighAccuracy: true, timeout: 10000 }
    )
  );

const getAddress = async (lat, lng) => {
  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`);
    const data = await res.json();
    return data.display_name || `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
  } catch {
    return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
  }
};

const statusColor = { PLANNED: 'secondary', CHECKED_IN: 'warning', COMPLETED: 'success', CANCELLED: 'danger' };

const FieldVisits = () => {
  const { user } = useAuth();
  const [plan, setPlan] = useState(null);
  const [visits, setVisits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeVisit, setActiveVisit] = useState(null);
  const [showOutcomeModal, setShowOutcomeModal] = useState(false);
  const [outcomeForm, setOutcomeForm] = useState({ status: 'NEUTRAL', notes: '', nextAction: '', nextFollowUpDate: '', dealValue: '' });
  const [gpsLoading, setGpsLoading] = useState({});
  const routeIntervalRef = useRef(null);
  const photoInputRef = useRef(null);
  const [photoVisitId, setPhotoVisitId] = useState(null);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  // Journey state
  const [journeyData, setJourneyData] = useState(undefined); // undefined = loading, null = not field employee
  const [journeyLoading, setJourneyLoading] = useState(false);
  const isJourneyActive = journeyData?.journey?.status === 'ACTIVE';
  useJourneyTracker(isJourneyActive);

  useEffect(() => {
    fetchTodayData();
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => {
      clearInterval(routeIntervalRef.current);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  // Refresh journey when page becomes visible (e.g. user comes back from Attendance tab)
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        api.get('/api/journey/today').then(res => setJourneyData(res.data)).catch(() => {});
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, []);

  // Poll journey status every 10s to pick up attendance check-in
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const res = await api.get('/api/journey/today');
        setJourneyData(res.data);
      } catch {}
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  const fetchTodayData = async () => {
    try {
      const requests = [
        api.get('/api/visit-plans/my-today'),
        api.get('/api/field-visits/today'),
        api.get('/api/journey/today')  // always fetch — backend validates isFieldEmployee
      ];

      const results = await Promise.allSettled(requests);
      if (results[0].status === 'fulfilled') setPlan(results[0].value.data);
      if (results[1].status === 'fulfilled') {
        const visitsData = results[1].value.data;
        setVisits(visitsData);
        const checkedIn = visitsData.find(v => v.status === 'CHECKED_IN');
        if (checkedIn) { setActiveVisit(checkedIn._id); startRouteTracking(checkedIn._id); }
      }
      if (results[2].status === 'fulfilled') {
        setJourneyData(results[2].value.data);
      } else {
        setJourneyData(null);
      }
    } catch {
      toast.error('Failed to load today\'s data');
    } finally {
      setLoading(false);
    }
  };

  const refreshJourney = async () => {
    try {
      const res = await api.get('/api/journey/today');
      setJourneyData(res.data);
    } catch {}
  };

  const startRouteTracking = (visitId) => {
    clearInterval(routeIntervalRef.current);
    routeIntervalRef.current = setInterval(async () => {
      try {
        const pos = await getLocation();
        await api.post(`/api/field-visits/${visitId}/route`, { lat: pos.lat, lng: pos.lng });
      } catch {}
    }, 30000);
  };

  const handleCheckIn = async (visit) => {
    setGpsLoading(p => ({ ...p, [`checkin-${visit._id}`]: true }));
    try {
      const pos = await getLocation();
      const address = await getAddress(pos.lat, pos.lng);
      await api.post(`/api/field-visits/${visit._id}/checkin`, { ...pos, address });
      setActiveVisit(visit._id);
      startRouteTracking(visit._id);
      toast.success(`Checked in at ${visit.clientId?.name}`);
      fetchTodayData();
    } catch (e) {
      toast.error(e.code === 1 ? 'Location permission denied' : 'Check-in failed');
    } finally {
      setGpsLoading(p => ({ ...p, [`checkin-${visit._id}`]: false }));
    }
  };

  const handleCheckOut = async (visit) => {
    setGpsLoading(p => ({ ...p, [`checkout-${visit._id}`]: true }));
    try {
      const pos = await getLocation();
      const address = await getAddress(pos.lat, pos.lng);
      await api.post(`/api/field-visits/${visit._id}/checkout`, { ...pos, address });
      clearInterval(routeIntervalRef.current);
      setActiveVisit(null);
      toast.success('Checked out successfully');
      fetchTodayData();
    } catch {
      toast.error('Check-out failed');
    } finally {
      setGpsLoading(p => ({ ...p, [`checkout-${visit._id}`]: false }));
    }
  };

  const handleStartJourney = async () => {
    setJourneyLoading(true);
    try {
      await api.post('/api/journey/start');
      toast.success('Journey started! GPS tracking is now active.');
      await refreshJourney();
    } catch (e) {
      toast.error(e.response?.data?.message || 'Failed to start journey');
    } finally {
      setJourneyLoading(false);
    }
  };

  const handleEndJourney = async () => {
    setJourneyLoading(true);
    try {
      await api.post('/api/journey/end');
      toast.success('Journey ended!');
      await refreshJourney();
    } catch (e) {
      toast.error(e.response?.data?.message || 'Failed to end journey');
    } finally {
      setJourneyLoading(false);
    }
  };

  const handlePhotoCapture = async (e) => {
    const file = e.target.files[0];
    if (!file || !photoVisitId) return;
    try {
      const pos = await getLocation();
      const address = await getAddress(pos.lat, pos.lng);
      const formData = new FormData();
      formData.append('photo', file);
      formData.append('lat', pos.lat);
      formData.append('lng', pos.lng);
      formData.append('address', address);
      await api.post(`/api/field-visits/${photoVisitId}/photo`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      toast.success('Photo uploaded with GPS location');
      fetchTodayData();
    } catch {
      toast.error('Photo upload failed');
    }
    e.target.value = '';
  };

  const handleOutcomeSubmit = async (e) => {
    e.preventDefault();
    try {
      await api.post(`/api/field-visits/${activeVisit || visits.find(v => v.status === 'CHECKED_IN')?._id}/outcome`, outcomeForm);
      toast.success('Outcome saved');
      setShowOutcomeModal(false);
      setOutcomeForm({ status: 'NEUTRAL', notes: '', nextAction: '', nextFollowUpDate: '', dealValue: '' });
      fetchTodayData();
    } catch {
      toast.error('Failed to save outcome');
    }
  };

  if (loading) return (
    <div className="d-flex justify-content-center align-items-center" style={{ height: '60vh' }}>
      <div className="spinner-border text-primary" />
    </div>
  );

  const completedCount = visits.filter(v => v.status === 'COMPLETED').length;
  const totalCount = visits.length;

  return (
    <div className="field-visits-container">
      <input ref={photoInputRef} type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={handlePhotoCapture} />

      {/* Professional Header */}
      <div style={{ 
        background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
        padding: isMobile ? '1.5rem 1rem' : '2rem 1.5rem',
        marginBottom: '1.5rem',
        borderRadius: isMobile ? '0 0 20px 20px' : '0 0 24px 24px',
        boxShadow: '0 4px 20px rgba(16,185,129,0.2)'
      }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <div className="d-flex justify-content-between align-items-center" style={{ marginBottom: '1rem' }}>
            <div>
              <h1 style={{ 
                color: '#fff', 
                fontSize: isMobile ? '1.5rem' : '2rem', 
                fontWeight: 700, 
                marginBottom: '0.25rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem'
              }}>
                <div style={{
                  width: isMobile ? 40 : 48,
                  height: isMobile ? 40 : 48,
                  background: 'rgba(255,255,255,0.2)',
                  borderRadius: 12,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backdropFilter: 'blur(10px)'
                }}>
                  <i className="fas fa-map-marked-alt" style={{ fontSize: isMobile ? '1.2rem' : '1.5rem' }} />
                </div>
                Today's Visits
              </h1>
              <p style={{ color: 'rgba(255,255,255,0.9)', fontSize: isMobile ? '0.85rem' : '0.95rem', marginBottom: 0 }}>
                {new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
              </p>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ 
                background: 'rgba(255,255,255,0.2)', 
                backdropFilter: 'blur(10px)',
                padding: isMobile ? '0.5rem 0.75rem' : '0.75rem 1rem',
                borderRadius: 12,
                border: '1px solid rgba(255,255,255,0.3)'
              }}>
                <div style={{ color: '#fff', fontSize: isMobile ? '1.5rem' : '2rem', fontWeight: 700, lineHeight: 1 }}>
                  {completedCount}/{totalCount}
                </div>
                <div style={{ color: 'rgba(255,255,255,0.9)', fontSize: isMobile ? '0.7rem' : '0.75rem', marginTop: '0.25rem' }}>
                  Completed
                </div>
              </div>
            </div>
          </div>
          
          {plan?.instructions && (
            <div style={{
              marginTop: '1rem',
              background: 'rgba(255,255,255,0.15)',
              backdropFilter: 'blur(10px)',
              padding: isMobile ? '0.75rem' : '1rem',
              borderRadius: 12,
              border: '1px solid rgba(255,255,255,0.3)',
              color: '#fff',
              fontSize: isMobile ? '0.85rem' : '0.9rem'
            }}>
              <i className="fas fa-info-circle me-2" />
              {plan.instructions}
            </div>
          )}
        </div>
      </div>

      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: isMobile ? '0 0.5rem' : '0 1rem' }}>

      {/* Journey Tracker — shown when employee is a field employee */}
      {journeyData !== undefined && journeyData !== null && (
        <Card className="mb-4" style={{
          borderRadius: isMobile ? 12 : 16,
          border: 'none',
          background: isJourneyActive 
            ? 'linear-gradient(135deg, #dcfce7 0%, #d1fae5 100%)' 
            : journeyData?.journey?.status === 'COMPLETED' 
            ? 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)'
            : '#fff',
          boxShadow: isJourneyActive 
            ? '0 8px 24px rgba(16,185,129,0.2), 0 0 0 1px rgba(16,185,129,0.1)' 
            : '0 4px 12px rgba(0,0,0,0.08)',
          overflow: 'hidden',
          position: 'relative'
        }}>
          {isJourneyActive && (
            <div style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              height: 4,
              background: 'linear-gradient(90deg, #10b981, #059669, #10b981)',
              backgroundSize: '200% 100%',
              animation: 'shimmer 2s infinite'
            }} />
          )}
          <Card.Body style={{ padding: isMobile ? '1.25rem' : '1.5rem' }}>
            <div className="d-flex" style={{ 
              flexDirection: isMobile ? 'column' : 'row', 
              gap: isMobile ? '1rem' : '1.5rem',
              alignItems: isMobile ? 'stretch' : 'center'
            }}>
              <div style={{
                width: isMobile ? 56 : 64,
                height: isMobile ? 56 : 64,
                borderRadius: 16,
                background: isJourneyActive 
                  ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)' 
                  : journeyData?.journey?.status === 'COMPLETED'
                  ? 'linear-gradient(135deg, #059669 0%, #047857 100%)'
                  : 'linear-gradient(135deg, #e5e7eb 0%, #d1d5db 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                boxShadow: isJourneyActive ? '0 4px 12px rgba(16,185,129,0.3)' : '0 2px 8px rgba(0,0,0,0.1)',
                position: 'relative'
              }}>
                <i className="fas fa-route" style={{ 
                  color: isJourneyActive || journeyData?.journey?.status === 'COMPLETED' ? '#fff' : '#6b7280', 
                  fontSize: isMobile ? '1.5rem' : '1.75rem'
                }} />
                {isJourneyActive && (
                  <div style={{
                    position: 'absolute',
                    top: -2,
                    right: -2,
                    width: 16,
                    height: 16,
                    background: '#ef4444',
                    borderRadius: '50%',
                    border: '2px solid #fff',
                    animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite'
                  }} />
                )}
              </div>
              
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="d-flex justify-content-between align-items-start mb-2" style={{ gap: '1rem' }}>
                  <div>
                    <h5 style={{ 
                      fontWeight: 700, 
                      fontSize: isMobile ? '1.1rem' : '1.25rem', 
                      marginBottom: '0.25rem',
                      color: '#1e293b'
                    }}>
                      Journey Tracker
                    </h5>
                    <div style={{ fontSize: isMobile ? '0.8rem' : '0.85rem', color: '#64748b' }}>
                      {isJourneyActive && (
                        <span style={{ 
                          display: 'inline-flex', 
                          alignItems: 'center', 
                          gap: '0.5rem',
                          background: 'rgba(16,185,129,0.15)',
                          padding: '0.25rem 0.75rem',
                          borderRadius: 20,
                          fontWeight: 600,
                          color: '#059669'
                        }}>
                          <span style={{ 
                            width: 8, 
                            height: 8, 
                            background: '#10b981', 
                            borderRadius: '50%',
                            animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite'
                          }} />
                          Active Journey
                        </span>
                      )}
                      {journeyData?.journey?.status === 'COMPLETED' && (
                        <span style={{ 
                          display: 'inline-flex', 
                          alignItems: 'center', 
                          gap: '0.5rem',
                          background: 'rgba(5,150,105,0.15)',
                          padding: '0.25rem 0.75rem',
                          borderRadius: 20,
                          fontWeight: 600,
                          color: '#047857'
                        }}>
                          <i className="fas fa-check-circle" />
                          Completed
                        </span>
                      )}
                      {!journeyData?.journey && journeyData?.hasCheckedIn && (
                        <span style={{ 
                          display: 'inline-flex', 
                          alignItems: 'center', 
                          gap: '0.5rem',
                          background: 'rgba(245,158,11,0.15)',
                          padding: '0.25rem 0.75rem',
                          borderRadius: 20,
                          fontWeight: 600,
                          color: '#d97706'
                        }}>
                          <i className="fas fa-clock" />
                          Ready to Start
                        </span>
                      )}
                      {!journeyData?.journey && !journeyData?.hasCheckedIn && (
                        <span style={{ 
                          display: 'inline-flex', 
                          alignItems: 'center', 
                          gap: '0.5rem',
                          background: 'rgba(148,163,184,0.15)',
                          padding: '0.25rem 0.75rem',
                          borderRadius: 20,
                          fontWeight: 600,
                          color: '#64748b'
                        }}>
                          <i className="fas fa-info-circle" />
                          Not Started
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                
                {/* Journey Stats */}
                {(isJourneyActive || journeyData?.journey?.status === 'COMPLETED') && (
                  <div className="d-flex gap-3 flex-wrap" style={{ marginTop: '1rem' }}>
                    <div style={{ 
                      background: 'rgba(255,255,255,0.7)',
                      padding: isMobile ? '0.5rem 0.75rem' : '0.75rem 1rem',
                      borderRadius: 10,
                      flex: isMobile ? '1 1 calc(50% - 0.75rem)' : '0 0 auto',
                      minWidth: isMobile ? 0 : 120
                    }}>
                      <div style={{ fontSize: isMobile ? '0.7rem' : '0.75rem', color: '#64748b', marginBottom: '0.25rem' }}>Distance</div>
                      <div style={{ fontSize: isMobile ? '1.1rem' : '1.25rem', fontWeight: 700, color: '#1e293b' }}>
                        {journeyData.journey.totalDistanceKm} <span style={{ fontSize: '0.75rem', fontWeight: 500 }}>km</span>
                      </div>
                    </div>
                    <div style={{ 
                      background: 'rgba(255,255,255,0.7)',
                      padding: isMobile ? '0.5rem 0.75rem' : '0.75rem 1rem',
                      borderRadius: 10,
                      flex: isMobile ? '1 1 calc(50% - 0.75rem)' : '0 0 auto',
                      minWidth: isMobile ? 0 : 120
                    }}>
                      <div style={{ fontSize: isMobile ? '0.7rem' : '0.75rem', color: '#64748b', marginBottom: '0.25rem' }}>Started</div>
                      <div style={{ fontSize: isMobile ? '1.1rem' : '1.25rem', fontWeight: 700, color: '#1e293b' }}>
                        {new Date(journeyData.journey.startTime).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                    {journeyData.journey.endTime && (
                      <div style={{ 
                        background: 'rgba(255,255,255,0.7)',
                        padding: isMobile ? '0.5rem 0.75rem' : '0.75rem 1rem',
                        borderRadius: 10,
                        flex: isMobile ? '1 1 calc(50% - 0.75rem)' : '0 0 auto',
                        minWidth: isMobile ? 0 : 120
                      }}>
                        <div style={{ fontSize: isMobile ? '0.7rem' : '0.75rem', color: '#64748b', marginBottom: '0.25rem' }}>Ended</div>
                        <div style={{ fontSize: isMobile ? '1.1rem' : '1.25rem', fontWeight: 700, color: '#1e293b' }}>
                          {new Date(journeyData.journey.endTime).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                    )}
                  </div>
                )}
                
                {!journeyData?.journey && (
                  <p style={{ 
                    fontSize: isMobile ? '0.85rem' : '0.9rem', 
                    color: '#64748b', 
                    marginTop: '0.75rem',
                    marginBottom: 0
                  }}>
                    {journeyData?.hasCheckedIn 
                      ? 'Start your journey to begin GPS tracking for today\'s field visits.' 
                      : 'Please check in your attendance before starting the journey.'}
                  </p>
                )}
              </div>
              
              {/* Action Buttons */}
              <div className="d-flex gap-2" style={{ 
                flexDirection: isMobile ? 'row' : 'column',
                width: isMobile ? '100%' : 'auto',
                marginTop: isMobile ? '0.5rem' : 0
              }}>
                {journeyData?.canStartJourney && (
                  <Button 
                    variant="success" 
                    onClick={handleStartJourney} 
                    disabled={journeyLoading}
                    style={{ 
                      borderRadius: 10,
                      fontWeight: 600,
                      fontSize: isMobile ? '0.9rem' : '0.95rem',
                      padding: isMobile ? '0.75rem 1.5rem' : '0.75rem 2rem',
                      flex: isMobile ? 1 : 'none',
                      minWidth: isMobile ? 0 : 160,
                      background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                      border: 'none',
                      boxShadow: '0 4px 12px rgba(16,185,129,0.3)',
                      transition: 'all 0.3s ease'
                    }}
                  >
                    {journeyLoading ? (
                      <><span className="spinner-border spinner-border-sm me-2" />Starting...</>
                    ) : (
                      <><i className="fas fa-play me-2" />Start Journey</>
                    )}
                  </Button>
                )}
                {isJourneyActive && (
                  <Button 
                    variant="danger" 
                    onClick={handleEndJourney} 
                    disabled={journeyLoading}
                    style={{ 
                      borderRadius: 10,
                      fontWeight: 600,
                      fontSize: isMobile ? '0.9rem' : '0.95rem',
                      padding: isMobile ? '0.75rem 1.5rem' : '0.75rem 2rem',
                      flex: isMobile ? 1 : 'none',
                      minWidth: isMobile ? 0 : 160,
                      background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                      border: 'none',
                      boxShadow: '0 4px 12px rgba(239,68,68,0.3)',
                      transition: 'all 0.3s ease'
                    }}
                  >
                    {journeyLoading ? (
                      <><span className="spinner-border spinner-border-sm me-2" />Ending...</>
                    ) : (
                      <><i className="fas fa-stop-circle me-2" />End Journey</>
                    )}
                  </Button>
                )}
              </div>
            </div>
          </Card.Body>
        </Card>
      )}

      {/* Visit Cards */}
      {visits.length === 0 ? (
        <Card className="text-center" style={{ 
          borderRadius: isMobile ? 12 : 16, 
          border: 'none',
          background: 'linear-gradient(135deg, #f9fafb 0%, #f3f4f6 100%)',
          padding: isMobile ? '2rem 1rem' : '3rem 2rem',
          boxShadow: '0 4px 12px rgba(0,0,0,0.05)'
        }}>
          <div style={{
            width: isMobile ? 80 : 100,
            height: isMobile ? 80 : 100,
            background: 'linear-gradient(135deg, #e5e7eb 0%, #d1d5db 100%)',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 1.5rem'
          }}>
            <i className="fas fa-map-marked-alt" style={{ fontSize: isMobile ? '2rem' : '2.5rem', color: '#9ca3af' }} />
          </div>
          <h5 style={{ fontWeight: 700, color: '#1e293b', marginBottom: '0.5rem', fontSize: isMobile ? '1.1rem' : '1.25rem' }}>No Visits Planned</h5>
          <p style={{ color: '#64748b', marginBottom: 0, fontSize: isMobile ? '0.9rem' : '1rem' }}>Your manager will assign visits here</p>
        </Card>
      ) : (
        <div style={{ display: 'grid', gap: isMobile ? '1rem' : '1.25rem' }}>
          {visits.map((visit, idx) => {
          const client = visit.clientId;
          const isActive = visit.status === 'CHECKED_IN';
          const isCheckinLoading = gpsLoading[`checkin-${visit._id}`];
          const isCheckoutLoading = gpsLoading[`checkout-${visit._id}`];

          return (
            <Card key={visit._id} style={{ 
              borderRadius: isMobile ? 14 : 16,
              border: 'none',
              background: '#fff',
              boxShadow: isActive 
                ? '0 8px 24px rgba(245,158,11,0.25), 0 0 0 2px #f59e0b'
                : '0 2px 12px rgba(0,0,0,0.08)',
              overflow: 'hidden',
              position: 'relative',
              transition: 'all 0.3s ease',
              marginBottom: 0
            }}>
              {/* Status Indicator Bar */}
              <div style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                height: 4,
                background: visit.status === 'COMPLETED'
                  ? 'linear-gradient(90deg, #10b981, #059669)'
                  : isActive
                  ? 'linear-gradient(90deg, #f59e0b, #d97706)'
                  : 'linear-gradient(90deg, #94a3b8, #64748b)',
                backgroundSize: '200% 100%',
                animation: isActive ? 'shimmer 2s infinite' : 'none'
              }} />
              
              <Card.Body style={{ padding: isMobile ? '1.25rem' : '1.5rem', paddingTop: isMobile ? '1.5rem' : '1.75rem' }}>
                {/* Header Section */}
                <div className="d-flex justify-content-between align-items-start mb-3">
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="d-flex align-items-center gap-2 mb-2">
                      {/* Visit Number Badge */}
                      <div style={{
                        background: client?.priority === 'HIGH' 
                          ? 'linear-gradient(135deg, #fee2e2 0%, #fecaca 100%)'
                          : client?.priority === 'MEDIUM'
                          ? 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)'
                          : 'linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%)',
                        color: client?.priority === 'HIGH' ? '#dc2626' : client?.priority === 'MEDIUM' ? '#d97706' : '#2563eb',
                        padding: '0.35rem 0.65rem',
                        borderRadius: 8,
                        fontSize: isMobile ? '0.7rem' : '0.75rem',
                        fontWeight: 700,
                        letterSpacing: '0.5px'
                      }}>
                        VISIT #{idx + 1}
                      </div>
                      
                      {/* Priority Badge */}
                      <Badge style={{
                        background: client?.priority === 'HIGH' 
                          ? 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)'
                          : client?.priority === 'MEDIUM'
                          ? 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)'
                          : 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                        border: 'none',
                        padding: '0.35rem 0.65rem',
                        fontSize: isMobile ? '0.65rem' : '0.7rem',
                        fontWeight: 600,
                        borderRadius: 6,
                        boxShadow: '0 2px 6px rgba(0,0,0,0.12)'
                      }}>
                        {client?.priority}
                      </Badge>
                    </div>
                    
                    {/* Client Name */}
                    <h5 style={{ 
                      fontWeight: 700, 
                      fontSize: isMobile ? '1.15rem' : '1.3rem', 
                      marginBottom: '0.5rem',
                      color: '#1e293b',
                      lineHeight: 1.3
                    }}>
                      {client?.name}
                    </h5>
                    
                    {/* Contact Info */}
                    <div style={{ 
                      display: 'flex', 
                      alignItems: 'center',
                      gap: '0.75rem',
                      flexWrap: 'wrap',
                      fontSize: isMobile ? '0.8rem' : '0.85rem', 
                      color: '#64748b',
                      marginBottom: '0.75rem'
                    }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                        <i className="fas fa-user" style={{ fontSize: '0.75rem', color: '#94a3b8' }} />
                        {client?.contactPerson}
                      </span>
                      <span style={{ color: '#cbd5e1' }}>•</span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                        <i className="fas fa-phone" style={{ fontSize: '0.75rem', color: '#94a3b8' }} />
                        {client?.phone}
                      </span>
                    </div>
                  </div>
                  
                  {/* Status Badge */}
                  <Badge style={{
                    background: visit.status === 'COMPLETED'
                      ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
                      : visit.status === 'CHECKED_IN'
                      ? 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)'
                      : visit.status === 'CANCELLED'
                      ? 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)'
                      : 'linear-gradient(135deg, #94a3b8 0%, #64748b 100%)',
                    border: 'none',
                    padding: isMobile ? '0.4rem 0.75rem' : '0.5rem 0.85rem',
                    fontSize: isMobile ? '0.7rem' : '0.75rem',
                    fontWeight: 600,
                    borderRadius: 8,
                    boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px'
                  }}>
                    {visit.status.replace('_', ' ')}
                  </Badge>
                </div>

                {/* Location Section */}
                <div style={{
                  background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
                  padding: isMobile ? '0.85rem' : '1rem',
                  borderRadius: 10,
                  marginBottom: '1rem',
                  border: '1px solid #e2e8f0'
                }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
                    <div style={{
                      width: 32,
                      height: 32,
                      borderRadius: 8,
                      background: 'linear-gradient(135deg, #fee2e2 0%, #fecaca 100%)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0
                    }}>
                      <i className="fas fa-map-marker-alt" style={{ color: '#dc2626', fontSize: '0.9rem' }} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ 
                        fontSize: isMobile ? '0.8rem' : '0.85rem', 
                        color: '#475569',
                        lineHeight: 1.5,
                        marginBottom: client?.location?.lat ? '0.5rem' : 0
                      }}>
                        {client?.address}
                      </div>
                      {client?.location?.lat && (
                        <a 
                          href={`https://www.google.com/maps?q=${client.location.lat},${client.location.lng}`} 
                          target="_blank" 
                          rel="noopener noreferrer" 
                          style={{ 
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            color: '#10b981',
                            textDecoration: 'none',
                            fontSize: isMobile ? '0.8rem' : '0.85rem',
                            fontWeight: 600,
                            padding: '0.35rem 0.75rem',
                            background: 'rgba(16,185,129,0.1)',
                            borderRadius: 6,
                            transition: 'all 0.2s ease'
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(16,185,129,0.15)'}
                          onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(16,185,129,0.1)'}
                        >
                          <i className="fas fa-directions" />
                          Get Directions
                        </a>
                      )}
                    </div>
                  </div>
                </div>

                {/* Check-in Info & Photos */}
                {(visit.checkIn?.time || visit.photos?.length > 0) && (
                  <div style={{
                    background: 'linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%)',
                    padding: isMobile ? '0.85rem' : '1rem',
                    borderRadius: 10,
                    marginBottom: '1rem',
                    border: '1px solid #a7f3d0'
                  }}>
                    {visit.checkIn?.time && (
                      <div style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: '0.75rem',
                        marginBottom: visit.photos?.length > 0 ? '0.75rem' : 0
                      }}>
                        <div style={{
                          width: 32,
                          height: 32,
                          borderRadius: 8,
                          background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0
                        }}>
                          <i className="fas fa-sign-in-alt" style={{ color: '#fff', fontSize: '0.85rem' }} />
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: isMobile ? '0.7rem' : '0.75rem', color: '#065f46', fontWeight: 600, marginBottom: '0.15rem' }}>
                            Checked In
                          </div>
                          <div style={{ fontSize: isMobile ? '0.8rem' : '0.85rem', color: '#047857', fontWeight: 600 }}>
                            {new Date(visit.checkIn.time).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                            {visit.checkIn.location?.address && !isMobile && (
                              <span style={{ fontWeight: 400, marginLeft: '0.5rem' }}>
                                • {visit.checkIn.location.address.split(',')[0]}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                    
                    {visit.photos?.length > 0 && (
                      <div>
                        <div style={{ fontSize: isMobile ? '0.7rem' : '0.75rem', color: '#065f46', fontWeight: 600, marginBottom: '0.5rem' }}>
                          Visit Photos ({visit.photos.length})
                        </div>
                        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                          {visit.photos.map((p, i) => (
                            <div key={i} style={{
                              width: isMobile ? 60 : 70,
                              height: isMobile ? 60 : 70,
                              borderRadius: 8,
                              overflow: 'hidden',
                              border: '2px solid #fff',
                              boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                              cursor: 'pointer'
                            }}>
                              <img 
                                src={`${process.env.REACT_APP_API_URL || 'http://localhost:5000'}${p.url}`} 
                                alt="visit" 
                                style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Outcome Section */}
                {visit.outcome?.status && visit.outcome.status !== 'NEUTRAL' && (
                  <div style={{
                    background: 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)',
                    padding: isMobile ? '0.85rem' : '1rem',
                    borderRadius: 10,
                    marginBottom: '1rem',
                    border: '1px solid #bfdbfe'
                  }}>
                    <div style={{ fontSize: isMobile ? '0.7rem' : '0.75rem', color: '#1e40af', fontWeight: 600, marginBottom: '0.5rem' }}>
                      Visit Outcome
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <Badge style={{
                        background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                        border: 'none',
                        padding: '0.4rem 0.75rem',
                        fontSize: isMobile ? '0.75rem' : '0.8rem',
                        fontWeight: 600,
                        borderRadius: 6,
                        boxShadow: '0 2px 6px rgba(59,130,246,0.3)'
                      }}>
                        {OUTCOME_OPTIONS.find(o => o.value === visit.outcome.status)?.label}
                      </Badge>
                      {visit.outcome.dealValue > 0 && (
                        <Badge style={{
                          background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                          border: 'none',
                          padding: '0.4rem 0.75rem',
                          fontSize: isMobile ? '0.75rem' : '0.8rem',
                          fontWeight: 600,
                          borderRadius: 6,
                          boxShadow: '0 2px 6px rgba(16,185,129,0.3)'
                        }}>
                          ₹{visit.outcome.dealValue.toLocaleString()}
                        </Badge>
                      )}
                    </div>
                  </div>
                )}

                {/* Completion Stats */}
                {visit.status === 'COMPLETED' && (
                  <div style={{
                    display: 'flex',
                    gap: isMobile ? '0.5rem' : '0.75rem',
                    padding: isMobile ? '0.75rem' : '1rem',
                    background: 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)',
                    borderRadius: 10,
                    marginBottom: '1rem',
                    border: '1px solid #bbf7d0'
                  }}>
                    <div style={{ flex: 1, textAlign: 'center' }}>
                      <div style={{ fontSize: isMobile ? '0.7rem' : '0.75rem', color: '#166534', marginBottom: '0.25rem' }}>Distance</div>
                      <div style={{ fontSize: isMobile ? '1rem' : '1.1rem', fontWeight: 700, color: '#15803d' }}>
                        {visit.totalDistanceKm} <span style={{ fontSize: '0.7rem', fontWeight: 500 }}>km</span>
                      </div>
                    </div>
                    <div style={{ width: 1, background: '#bbf7d0' }} />
                    <div style={{ flex: 1, textAlign: 'center' }}>
                      <div style={{ fontSize: isMobile ? '0.7rem' : '0.75rem', color: '#166534', marginBottom: '0.25rem' }}>Duration</div>
                      <div style={{ fontSize: isMobile ? '1rem' : '1.1rem', fontWeight: 700, color: '#15803d' }}>
                        {visit.durationMinutes} <span style={{ fontSize: '0.7rem', fontWeight: 500 }}>min</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Action Buttons */}
                <div style={{ display: 'flex', gap: isMobile ? '0.5rem' : '0.75rem', flexWrap: 'wrap' }}>
                  {visit.status === 'PLANNED' && (
                    <Button 
                      onClick={() => handleCheckIn(visit)} 
                      disabled={isCheckinLoading || !!activeVisit} 
                      style={{ 
                        flex: 1,
                        borderRadius: 10,
                        background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                        border: 'none',
                        color: '#fff',
                        fontSize: isMobile ? '0.85rem' : '0.9rem',
                        fontWeight: 600,
                        padding: isMobile ? '0.75rem' : '0.85rem',
                        boxShadow: '0 4px 12px rgba(16,185,129,0.3)',
                        transition: 'all 0.3s ease',
                        minWidth: isMobile ? 0 : 140
                      }}
                    >
                      {isCheckinLoading ? (
                        <><span className="spinner-border spinner-border-sm me-2" />Locating...</>
                      ) : (
                        <><i className="fas fa-sign-in-alt me-2" />Check In</>
                      )}
                    </Button>
                  )}
                  
                  {isActive && (
                    <>
                      <Button 
                        variant="outline-secondary" 
                        onClick={() => { setPhotoVisitId(visit._id); photoInputRef.current.click(); }} 
                        style={{ 
                          borderRadius: 10,
                          fontSize: isMobile ? '0.85rem' : '0.9rem',
                          fontWeight: 600,
                          padding: isMobile ? '0.75rem' : '0.85rem',
                          minWidth: isMobile ? 48 : 120,
                          border: '2px solid #e2e8f0',
                          color: '#64748b',
                          background: '#fff',
                          transition: 'all 0.3s ease'
                        }}
                      >
                        <i className="fas fa-camera" style={{ fontSize: '1rem' }} />
                        {!isMobile && <span className="ms-2">Photo</span>}
                      </Button>
                      
                      <Button 
                        onClick={() => { setActiveVisit(visit._id); setShowOutcomeModal(true); }} 
                        style={{ 
                          borderRadius: 10,
                          background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                          border: 'none',
                          color: '#fff',
                          fontSize: isMobile ? '0.85rem' : '0.9rem',
                          fontWeight: 600,
                          padding: isMobile ? '0.75rem' : '0.85rem',
                          minWidth: isMobile ? 48 : 120,
                          boxShadow: '0 4px 12px rgba(59,130,246,0.3)',
                          transition: 'all 0.3s ease'
                        }}
                      >
                        <i className="fas fa-clipboard-check" style={{ fontSize: '1rem' }} />
                        {!isMobile && <span className="ms-2">Outcome</span>}
                      </Button>
                      
                      <Button 
                        variant="success" 
                        onClick={() => handleCheckOut(visit)} 
                        disabled={isCheckoutLoading} 
                        style={{ 
                          flex: 1,
                          borderRadius: 10,
                          background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                          border: 'none',
                          fontSize: isMobile ? '0.85rem' : '0.9rem',
                          fontWeight: 600,
                          padding: isMobile ? '0.75rem' : '0.85rem',
                          boxShadow: '0 4px 12px rgba(239,68,68,0.3)',
                          transition: 'all 0.3s ease',
                          minWidth: isMobile ? 0 : 140
                        }}
                      >
                        {isCheckoutLoading ? (
                          <><span className="spinner-border spinner-border-sm me-2" />Locating...</>
                        ) : (
                          <><i className="fas fa-sign-out-alt me-2" />Check Out</>
                        )}
                      </Button>
                    </>
                  )}
                </div>
              </Card.Body>
            </Card>
          );
        })}
        </div>
      )}
      </div>

      {/* Outcome Modal */}
      <Modal show={showOutcomeModal} onHide={() => setShowOutcomeModal(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title><i className="fas fa-clipboard-check me-2" />Visit Outcome</Modal.Title>
        </Modal.Header>
        <Form onSubmit={handleOutcomeSubmit}>
          <Modal.Body>
            <Form.Group className="mb-3">
              <Form.Label style={{ fontWeight: 600 }}>Outcome *</Form.Label>
              <Form.Select value={outcomeForm.status} onChange={e => setOutcomeForm(p => ({ ...p, status: e.target.value }))} required style={{ borderRadius: 8 }}>
                {OUTCOME_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </Form.Select>
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label style={{ fontWeight: 600 }}>Notes</Form.Label>
              <Form.Control as="textarea" rows={3} value={outcomeForm.notes} onChange={e => setOutcomeForm(p => ({ ...p, notes: e.target.value }))} placeholder="What happened during the visit?" style={{ borderRadius: 8 }} />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label style={{ fontWeight: 600 }}>Next Action</Form.Label>
              <Form.Control type="text" value={outcomeForm.nextAction} onChange={e => setOutcomeForm(p => ({ ...p, nextAction: e.target.value }))} placeholder="e.g., Send quotation, Schedule demo" style={{ borderRadius: 8 }} />
            </Form.Group>
            <Row>
              <Col>
                <Form.Group className="mb-3">
                  <Form.Label style={{ fontWeight: 600 }}>Follow-up Date</Form.Label>
                  <Form.Control type="date" value={outcomeForm.nextFollowUpDate} onChange={e => setOutcomeForm(p => ({ ...p, nextFollowUpDate: e.target.value }))} style={{ borderRadius: 8 }} />
                </Form.Group>
              </Col>
              <Col>
                <Form.Group className="mb-3">
                  <Form.Label style={{ fontWeight: 600 }}>Deal Value (₹)</Form.Label>
                  <Form.Control type="number" value={outcomeForm.dealValue} onChange={e => setOutcomeForm(p => ({ ...p, dealValue: e.target.value }))} placeholder="0" style={{ borderRadius: 8 }} />
                </Form.Group>
              </Col>
            </Row>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={() => setShowOutcomeModal(false)}>Cancel</Button>
            <Button type="submit" style={{ background: '#10b981', border: 'none', color: '#fff' }}><i className="fas fa-save me-1" />Save Outcome</Button>
          </Modal.Footer>
        </Form>
      </Modal>
    </div>
  );
};

export default FieldVisits;

