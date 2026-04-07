import React, { useState, useEffect, useCallback } from 'react';
import { Card, Button, Badge, Row, Col, Modal } from 'react-bootstrap';
import { MapContainer, TileLayer, Polyline, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { toast } from 'react-toastify';
import api from '../utils/api';
import useJourneyTracker from '../hooks/useJourneyTracker';
import { 
  registerServiceWorker, 
  startBackgroundTracking, 
  stopBackgroundTracking,
  isBackgroundTrackingSupported,
  requestBackgroundPermissions,
  storeAuthToken
} from '../utils/serviceWorkerManager';

const FitBounds = ({ positions }) => {
  const map = useMap();
  useEffect(() => {
    if (positions?.length > 1) map.fitBounds(L.latLngBounds(positions), { padding: [40, 40] });
  }, [positions, map]);
  return null;
};

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({ 
  iconRetinaUrl: require('leaflet/dist/images/marker-icon-2x.png'), 
  iconUrl: require('leaflet/dist/images/marker-icon.png'), 
  shadowUrl: require('leaflet/dist/images/marker-shadow.png') 
});

const JourneyPage = () => {
  const [journeyData, setJourneyData] = useState(undefined);
  const [journeyHistory, setJourneyHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [showMapModal, setShowMapModal] = useState(false);
  const [backgroundTrackingEnabled, setBackgroundTrackingEnabled] = useState(false);
  const [showPermissionModal, setShowPermissionModal] = useState(false);

  const isJourneyActive = journeyData?.journey?.status === 'ACTIVE';
  const isJourneyPaused = journeyData?.journey?.status === 'PAUSED';
  const { batteryLevel } = useJourneyTracker(isJourneyActive);

  // Register service worker on mount
  useEffect(() => {
    registerServiceWorker();
    
    // Store auth token for service worker
    const token = localStorage.getItem('token');
    if (token) {
      storeAuthToken(token);
    }
  }, []);

  // Update page title when journey is active
  useEffect(() => {
    if (isJourneyActive) {
      document.title = '🟢 Journey Active - Keep Open | HRMS';
      
      // Blink title every 3 seconds as reminder
      const interval = setInterval(() => {
        document.title = document.title.startsWith('🟢') 
          ? '⚠️ KEEP PAGE OPEN | HRMS'
          : '🟢 Journey Active - Keep Open | HRMS';
      }, 3000);
      
      return () => {
        clearInterval(interval);
        document.title = 'Journey Tracker | HRMS';
      };
    } else {
      document.title = 'Journey Tracker | HRMS';
    }
  }, [isJourneyActive]);

  const fetchJourney = useCallback(async () => {
    try {
      const res = await api.get('/api/journey/today');
      setJourneyData(res.data);
    } catch { setJourneyData(null); }
    finally { setLoading(false); }
  }, []);

  const fetchHistory = useCallback(async () => {
    try {
      const res = await api.get('/api/journey/history');
      setJourneyHistory(res.data || []);
    } catch {}
  }, []);

  useEffect(() => {
    fetchJourney();
    fetchHistory();
  }, [fetchJourney, fetchHistory]);

  // Poll every 15s when journey active
  useEffect(() => {
    if (!isJourneyActive) return;
    const interval = setInterval(fetchJourney, 15000);
    return () => clearInterval(interval);
  }, [isJourneyActive, fetchJourney]);

  const enableBackgroundTracking = async () => {
    if (!isBackgroundTrackingSupported()) {
      toast.error('Background tracking is not supported on this device/browser');
      return;
    }

    const permissions = await requestBackgroundPermissions();
    
    if (!permissions.notification) {
      toast.error('Notification permission required for background tracking');
      return;
    }
    
    if (!permissions.geolocation) {
      toast.error('Location permission required for background tracking');
      return;
    }

    await startBackgroundTracking();
    setBackgroundTrackingEnabled(true);
    toast.success('🎯 Background tracking enabled! Location will be tracked even when app is closed.');
  };

  const handleStart = async () => {
    setActionLoading(true);
    
    if (!navigator.geolocation) {
      toast.error('GPS is not supported on this device');
      setActionLoading(false);
      return;
    }

    try {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const { latitude: lat, longitude: lng, accuracy } = position.coords;
          
          console.log('Start location captured:', { lat, lng, accuracy });
          
          try {
            // Start journey with location
            await api.post('/api/journey/start', { lat, lng, accuracy });
            
            // Send first GPS ping
            await api.post('/api/journey/ping', { lat, lng, accuracy, batteryLevel: 100 });
            
            toast.success(`🚀 Journey started! GPS tracking active.`);
            
            await fetchJourney();
            setActionLoading(false);
          } catch (e) {
            console.error('Error starting journey:', e);
            toast.error(e.response?.data?.message || 'Failed to start journey');
            setActionLoading(false);
          }
        },
        async (error) => {
          console.error('GPS error:', error);
          
          let errorMsg = 'Unable to get GPS location. ';
          switch(error.code) {
            case error.PERMISSION_DENIED:
              errorMsg += 'Please allow location access.';
              break;
            case error.POSITION_UNAVAILABLE:
              errorMsg += 'GPS unavailable. Try going outside.';
              break;
            case error.TIMEOUT:
              errorMsg += 'GPS timeout. Try again.';
              break;
            default:
              errorMsg += error.message;
          }
          
          toast.error(errorMsg, { autoClose: 7000 });
          setActionLoading(false);
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
      );
    } catch (e) {
      console.error('Unexpected error:', e);
      toast.error('Failed to start journey');
      setActionLoading(false);
    }
  };

  const handleEnd = async () => {
    setActionLoading(true);
    
    if (!navigator.geolocation) {
      toast.error('GPS is not supported on this device');
      setActionLoading(false);
      return;
    }

    try {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const { latitude: lat, longitude: lng, accuracy } = position.coords;
          
          console.log('End location captured:', { lat, lng, accuracy });
          
          try {
            // Send final GPS ping before ending
            await api.post('/api/journey/ping', { lat, lng, accuracy, batteryLevel: 100 });
            
            // End journey
            const response = await api.post('/api/journey/end', { lat, lng, accuracy });
            console.log('Journey ended:', response.data);
            
            toast.success(`🏁 Journey ended! Total distance: ${response.data.totalDistanceKm || 0} km`);
            
            await fetchJourney();
            await fetchHistory();
            setActionLoading(false);
          } catch (e) {
            console.error('Error ending journey:', e);
            toast.error(e.response?.data?.message || 'Failed to end journey');
            setActionLoading(false);
          }
        },
        async (error) => {
          console.error('GPS error on end:', error);
          
          if (window.confirm('Unable to get GPS. End journey anyway?')) {
            try {
              const response = await api.post('/api/journey/end', {});
              toast.warning('⚠️ Journey ended');
              await fetchJourney();
              await fetchHistory();
            } catch (e) {
              toast.error(e.response?.data?.message || 'Failed to end journey');
            }
          }
          
          setActionLoading(false);
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
      );
    } catch (e) {
      console.error('Unexpected error:', e);
      toast.error('Failed to end journey');
      setActionLoading(false);
    }
  };

  const handlePause = async () => {
    setActionLoading(true);
    try {
      await api.post('/api/journey/pause', { reason: 'Manual pause' });
      toast.success('⏸️ Journey paused');
      await fetchJourney();
    } catch (e) {
      toast.error(e.response?.data?.message || 'Failed to pause journey');
    } finally { setActionLoading(false); }
  };

  const handleResume = async () => {
    setActionLoading(true);
    try {
      await api.post('/api/journey/resume');
      toast.success('▶️ Journey resumed!');
      await fetchJourney();
    } catch (e) {
      toast.error(e.response?.data?.message || 'Failed to resume journey');
    } finally { setActionLoading(false); }
  };

  const fmt = (d) => d ? new Date(d).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : '—';
  const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
  const duration = (start, end) => {
    if (!start) return '—';
    const ms = (end ? new Date(end) : new Date()) - new Date(start);
    const h = Math.floor(ms / 3600000);
    const m = Math.floor((ms % 3600000) / 60000);
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  };

  if (loading) return (
    <div className="d-flex justify-content-center align-items-center" style={{ height: '60vh' }}>
      <div className="spinner-border text-success" />
    </div>
  );

  if (journeyData === null) return (
    <div className="text-center py-5">
      <div style={{ width: 72, height: 72, borderRadius: '50%', background: '#f1f5f9', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
        <i className="fas fa-route" style={{ fontSize: '1.8rem', color: '#94a3b8' }} />
      </div>
      <h5 style={{ color: '#475569', fontWeight: 700 }}>Journey Tracking Not Enabled</h5>
      <p style={{ color: '#94a3b8', fontSize: '0.9rem' }}>Contact HR to enable field employee tracking for your account.</p>
    </div>
  );

  const journey = journeyData?.journey;
  const hasCheckedIn = journeyData?.hasCheckedIn;
  const canStart = journeyData?.canStartJourney;

  return (
    <div className="fade-in-up pb-5">

      {/* Header */}
      <div className="page-header">
        <h1 className="page-title">
          <i className="fas fa-route me-2" style={{ color: '#10b981' }} />Journey Tracker
        </h1>
        <p className="text-muted">Track your daily travel distance in real-time</p>
      </div>

      {/* Today's Journey Card */}
      <Card className="mb-3" style={{
        borderRadius: 16,
        border: 'none',
        background: isJourneyActive
          ? 'linear-gradient(135deg, #064e3b 0%, #065f46 50%, #10b981 100%)'
          : journey?.status === 'COMPLETED' || journey?.status === 'AUTO_ENDED'
            ? 'linear-gradient(135deg, #1e293b 0%, #334155 100%)'
            : 'linear-gradient(135deg, #1e3a8a 0%, #1d4ed8 100%)',
        boxShadow: isJourneyActive ? '0 8px 32px rgba(16,185,129,0.35)' : '0 4px 20px rgba(0,0,0,0.15)',
        color: 'white'
      }}>
        <Card.Body style={{ padding: '1.75rem' }}>

          {/* Status Row */}
          <div className="d-flex justify-content-between align-items-start mb-3">
            <div>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, opacity: 0.7, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>
                TODAY'S JOURNEY
              </div>
              <div style={{ fontSize: '1.5rem', fontWeight: 800, lineHeight: 1.2 }}>
                {isJourneyActive ? '🟢 Active' :
                 journey?.status === 'COMPLETED' ? '✅ Completed' :
                 journey?.status === 'AUTO_ENDED' ? '⏹ Auto Ended' :
                 hasCheckedIn ? '⏳ Ready to Start' : '🔒 Check In First'}
              </div>
            </div>
            {isJourneyActive && (
              <div style={{ background: 'rgba(255,255,255,0.15)', borderRadius: 12, padding: '0.5rem 1rem', textAlign: 'center' }}>
                <div style={{ fontSize: '0.65rem', opacity: 0.8, marginBottom: 2 }}>GPS TRACKING</div>
                <div style={{ fontSize: '0.8rem', fontWeight: 700 }}>
                  <i className="fas fa-satellite-dish me-1" />LIVE
                </div>
              </div>
            )}
          </div>

          {/* Journey Active Status */}
          {isJourneyActive && (
            <div style={{ 
              background: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)', 
              border: '2px solid #f59e0b',
              borderRadius: 12, 
              padding: '1.25rem', 
              marginBottom: '1rem',
              textAlign: 'center'
            }}>
              <div style={{ fontSize: '1.1rem', fontWeight: 800, marginBottom: '0.75rem', color: '#92400e' }}>
                <i className="fas fa-exclamation-triangle me-2" />
                IMPORTANT: Keep This Page Open!
              </div>
              <div style={{ fontSize: '0.9rem', color: '#92400e', marginBottom: '0.75rem', fontWeight: 600 }}>
                GPS tracking is ONLY active when this page is open.
              </div>
              <div style={{ fontSize: '0.85rem', color: '#78350f', background: 'rgba(255,255,255,0.6)', padding: '0.75rem', borderRadius: 8, marginBottom: '0.75rem' }}>
                <div style={{ marginBottom: '0.5rem' }}><strong>What you can do:</strong></div>
                <div style={{ textAlign: 'left', paddingLeft: '1rem' }}>
                  ✅ Minimize the browser window<br/>
                  ✅ Switch to other apps<br/>
                  ✅ Lock your phone screen<br/>
                  ❌ <strong>DO NOT close this browser tab</strong>
                </div>
              </div>
              <div style={{ fontSize: '0.75rem', color: '#92400e', fontWeight: 600 }}>
                <i className="fas fa-satellite-dish me-1" />
                GPS updates every 60 seconds | {journey?.locationPoints?.length || 0} points recorded
              </div>
            </div>
          )}

          {/* Big KM Display */}
          <div style={{ textAlign: 'center', margin: '1.5rem 0' }}>
            <div style={{ fontSize: '4rem', fontWeight: 900, lineHeight: 1, letterSpacing: '-2px' }}>
              {journey ? journey.totalDistanceKm.toFixed(1) : '0.0'}
            </div>
            <div style={{ fontSize: '1rem', opacity: 0.7, fontWeight: 600, marginTop: 4 }}>kilometers traveled</div>
          </div>

          {/* Stats Row */}
          {journey && (
            <>
              <div className="d-flex gap-2 mb-3 flex-wrap">
                {[
                  { icon: 'play-circle', label: 'Started', value: fmt(journey.startTime) },
                  { icon: 'stop-circle', label: 'Ended', value: journey.endTime ? fmt(journey.endTime) : 'Ongoing' },
                  { icon: 'clock', label: 'Duration', value: duration(journey.startTime, journey.endTime) },
                  { icon: 'map-pin', label: 'GPS Points', value: journey.locationPoints?.length || 0 },
                ].map((s, i) => (
                  <div key={i} style={{ flex: 1, minWidth: 80, background: 'rgba(255,255,255,0.12)', borderRadius: 10, padding: '0.6rem 0.75rem', textAlign: 'center' }}>
                    <i className={`fas fa-${s.icon}`} style={{ fontSize: '0.85rem', opacity: 0.8, marginBottom: 4, display: 'block' }} />
                    <div style={{ fontSize: '0.9rem', fontWeight: 700 }}>{s.value}</div>
                    <div style={{ fontSize: '0.65rem', opacity: 0.7, marginTop: 2 }}>{s.label}</div>
                  </div>
                ))}
              </div>

              {/* Additional Stats */}
              <div className="d-flex gap-2 mb-4 flex-wrap">
                {[
                  { icon: 'tachometer-alt', label: 'Avg Speed', value: `${journey.avgSpeedKmh || 0} km/h`, color: 'rgba(59,130,246,0.15)' },
                  { icon: 'rocket', label: 'Max Speed', value: `${journey.maxSpeedKmh || 0} km/h`, color: 'rgba(239,68,68,0.15)' },
                  { icon: 'pause-circle', label: 'Paused', value: `${journey.totalPausedMinutes || 0} min`, color: 'rgba(245,158,11,0.15)' },
                  { icon: 'battery-three-quarters', label: 'Battery', value: batteryLevel ? `${batteryLevel}%` : '—', color: batteryLevel < 20 ? 'rgba(239,68,68,0.15)' : 'rgba(16,185,129,0.15)' },
                ].map((s, i) => (
                  <div key={i} style={{ flex: 1, minWidth: 80, background: s.color, borderRadius: 10, padding: '0.6rem 0.75rem', textAlign: 'center' }}>
                    <i className={`fas fa-${s.icon}`} style={{ fontSize: '0.85rem', opacity: 0.8, marginBottom: 4, display: 'block' }} />
                    <div style={{ fontSize: '0.9rem', fontWeight: 700 }}>{s.value}</div>
                    <div style={{ fontSize: '0.65rem', opacity: 0.7, marginTop: 2 }}>{s.label}</div>
                  </div>
                ))}
              </div>

              {/* View Route Button */}
              {journey.locationPoints?.length > 1 && (
                <div className="mb-3 text-center">
                  <button onClick={() => setShowMapModal(true)} style={{
                    background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.3)',
                    borderRadius: 10, padding: '0.5rem 1rem', color: 'white', cursor: 'pointer',
                    fontSize: '0.85rem', fontWeight: 600
                  }}>
                    <i className="fas fa-map me-2" />View Route on Map
                  </button>
                </div>
              )}
            </>
          )}

          {/* Action Button */}
          <div className="d-flex justify-content-center gap-2">
            {!hasCheckedIn && !journey && (
              <div style={{ background: 'rgba(255,255,255,0.1)', borderRadius: 12, padding: '0.75rem 1.5rem', textAlign: 'center', width: '100%' }}>
                <i className="fas fa-lock me-2" style={{ opacity: 0.7 }} />
                <span style={{ fontSize: '0.9rem', opacity: 0.85 }}>Please check in attendance first to start your journey</span>
              </div>
            )}
            {canStart && (
              <button onClick={handleStart} disabled={actionLoading} style={{
                width: '100%', padding: '1rem', borderRadius: 14, border: 'none',
                background: 'rgba(255,255,255,0.95)', color: '#065f46',
                fontWeight: 800, fontSize: '1.05rem', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.6rem',
                boxShadow: '0 4px 16px rgba(0,0,0,0.2)', transition: 'all 0.2s'
              }}>
                {actionLoading
                  ? <><span className="spinner-border spinner-border-sm" /> Starting...</>
                  : <><i className="fas fa-play-circle" style={{ fontSize: '1.2rem' }} /> Start Journey</>}
              </button>
            )}
            {isJourneyActive && (
              <>
                <button onClick={handlePause} disabled={actionLoading} style={{
                  flex: 1, padding: '1rem', borderRadius: 14, border: '2px solid rgba(255,255,255,0.4)',
                  background: 'rgba(245,158,11,0.85)', color: 'white',
                  fontWeight: 800, fontSize: '1.05rem', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.6rem',
                  boxShadow: '0 4px 16px rgba(245,158,11,0.4)', transition: 'all 0.2s'
                }}>
                  {actionLoading
                    ? <><span className="spinner-border spinner-border-sm" /> Pausing...</>
                    : <><i className="fas fa-pause-circle" style={{ fontSize: '1.2rem' }} /> Pause</>}
                </button>
                <button onClick={handleEnd} disabled={actionLoading} style={{
                  flex: 1, padding: '1rem', borderRadius: 14, border: '2px solid rgba(255,255,255,0.4)',
                  background: 'rgba(239,68,68,0.85)', color: 'white',
                  fontWeight: 800, fontSize: '1.05rem', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.6rem',
                  boxShadow: '0 4px 16px rgba(239,68,68,0.4)', transition: 'all 0.2s'
                }}>
                  {actionLoading
                    ? <><span className="spinner-border spinner-border-sm" /> Ending...</>
                    : <><i className="fas fa-stop-circle" style={{ fontSize: '1.2rem' }} /> End</>}
                </button>
              </>
            )}
            {isJourneyPaused && (
              <>
                <button onClick={handleResume} disabled={actionLoading} style={{
                  flex: 1, padding: '1rem', borderRadius: 14, border: 'none',
                  background: 'rgba(255,255,255,0.95)', color: '#065f46',
                  fontWeight: 800, fontSize: '1.05rem', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.6rem',
                  boxShadow: '0 4px 16px rgba(0,0,0,0.2)', transition: 'all 0.2s'
                }}>
                  {actionLoading
                    ? <><span className="spinner-border spinner-border-sm" /> Resuming...</>
                    : <><i className="fas fa-play-circle" style={{ fontSize: '1.2rem' }} /> Resume</>}
                </button>
                <button onClick={handleEnd} disabled={actionLoading} style={{
                  flex: 1, padding: '1rem', borderRadius: 14, border: '2px solid rgba(255,255,255,0.4)',
                  background: 'rgba(239,68,68,0.85)', color: 'white',
                  fontWeight: 800, fontSize: '1.05rem', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.6rem',
                  boxShadow: '0 4px 16px rgba(239,68,68,0.4)', transition: 'all 0.2s'
                }}>
                  {actionLoading
                    ? <><span className="spinner-border spinner-border-sm" /> Ending...</>
                    : <><i className="fas fa-stop-circle" style={{ fontSize: '1.2rem' }} /> End</>}
                </button>
              </>
            )}
            {(journey?.status === 'COMPLETED' || journey?.status === 'AUTO_ENDED') && (
              <div style={{ background: 'rgba(255,255,255,0.1)', borderRadius: 12, padding: '0.75rem 1.5rem', textAlign: 'center', width: '100%' }}>
                <i className="fas fa-check-circle me-2" />
                <span style={{ fontSize: '0.9rem' }}>Journey completed for today · {journey.totalDistanceKm} km</span>
              </div>
            )}
          </div>
        </Card.Body>
      </Card>

      {/* How It Works — shown when not started */}
      {!journey && (
        <Card className="mb-3" style={{ borderRadius: 14, border: 'none', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
          <Card.Body style={{ padding: '1.25rem' }}>
            <div style={{ fontWeight: 700, fontSize: '0.85rem', color: '#1e293b', marginBottom: '1rem' }}>
              <i className="fas fa-info-circle me-2" style={{ color: '#10b981' }} />How Journey Tracking Works
            </div>
            <div className="d-flex flex-column gap-3">
              {[
                { step: '1', icon: 'sign-in-alt', color: '#3b82f6', title: 'Check In Attendance', desc: 'Mark your attendance first from the Attendance page' },
                { step: '2', icon: 'play-circle', color: '#10b981', title: 'Start Journey', desc: 'Tap Start Journey — GPS tracking begins automatically' },
                { step: '3', icon: 'satellite-dish', color: '#8b5cf6', title: 'Travel & Track', desc: 'GPS pings every 60 seconds, distance calculated automatically' },
                { step: '4', icon: 'stop-circle', color: '#ef4444', title: 'End Journey', desc: 'Tap End Journey when done — total KM saved to your record' },
              ].map(s => (
                <div key={s.step} className="d-flex align-items-center gap-3">
                  <div style={{ width: 40, height: 40, borderRadius: 12, background: `${s.color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <i className={`fas fa-${s.icon}`} style={{ color: s.color, fontSize: '1rem' }} />
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '0.85rem', color: '#1e293b' }}>{s.title}</div>
                    <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{s.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </Card.Body>
        </Card>
      )}

      {/* GPS Points Live Feed — shown when active */}
      {isJourneyActive && journey?.locationPoints?.length > 0 && (
        <Card className="mb-3" style={{ borderRadius: 14, border: '1px solid #d1fae5', boxShadow: '0 2px 12px rgba(16,185,129,0.08)' }}>
          <Card.Body style={{ padding: '1.25rem' }}>
            <div style={{ fontWeight: 700, fontSize: '0.85rem', color: '#065f46', marginBottom: '0.75rem' }}>
              <i className="fas fa-map-pin me-2" style={{ color: '#10b981' }} />Live GPS Points ({journey.locationPoints.length} recorded)
            </div>
            <div style={{ maxHeight: 180, overflowY: 'auto' }}>
              {[...journey.locationPoints].reverse().slice(0, 10).map((pt, i) => (
                <div key={i} className="d-flex justify-content-between align-items-center py-2" style={{ borderBottom: '1px solid #f0fdf4', fontSize: '0.8rem' }}>
                  <div style={{ color: '#374151' }}>
                    <i className="fas fa-circle me-2" style={{ color: '#10b981', fontSize: '0.5rem' }} />
                    {pt.lat?.toFixed(5)}, {pt.lng?.toFixed(5)}
                  </div>
                  <div className="d-flex gap-3" style={{ color: '#6b7280' }}>
                    {pt.distanceFromLast > 0 && <span>+{(pt.distanceFromLast * 1000).toFixed(0)}m</span>}
                    <span>{fmt(pt.timestamp)}</span>
                  </div>
                </div>
              ))}
            </div>
          </Card.Body>
        </Card>
      )}

      {/* Journey History */}
      <Card style={{ borderRadius: 14, border: 'none', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
        <Card.Body style={{ padding: '1.25rem' }}>
          <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#1e293b', marginBottom: '1rem' }}>
            <i className="fas fa-history me-2" style={{ color: '#10b981' }} />Journey History
          </div>

          {journeyHistory.length === 0 ? (
            <div className="text-center py-4" style={{ color: '#94a3b8' }}>
              <i className="fas fa-route" style={{ fontSize: '2rem', marginBottom: 8, display: 'block' }} />
              No journey history yet
            </div>
          ) : (
            <>
              {/* Summary Stats */}
              <Row className="g-2 mb-3">
                {[
                  { label: 'Total Journeys', value: journeyHistory.length, icon: 'route', color: '#10b981' },
                  { label: 'Total Distance', value: `${journeyHistory.reduce((s, j) => s + (j.totalDistanceKm || 0), 0).toFixed(1)} km`, icon: 'road', color: '#10b981' },
                  { label: 'Avg per Day', value: `${(journeyHistory.reduce((s, j) => s + (j.totalDistanceKm || 0), 0) / journeyHistory.length).toFixed(1)} km`, icon: 'chart-line', color: '#10b981' },
                  { label: 'This Month', value: `${journeyHistory.filter(j => new Date(j.date).getMonth() === new Date().getMonth()).reduce((s, j) => s + (j.totalDistanceKm || 0), 0).toFixed(1)} km`, icon: 'calendar', color: '#10b981' },
                ].map((s, i) => (
                  <Col xs={6} key={i}>
                    <div style={{ background: `${s.color}10`, border: `1px solid ${s.color}30`, borderRadius: 10, padding: '0.75rem', textAlign: 'center' }}>
                      <i className={`fas fa-${s.icon}`} style={{ color: s.color, fontSize: '1rem', marginBottom: 4, display: 'block' }} />
                      <div style={{ fontWeight: 800, fontSize: '1.1rem', color: '#1e293b' }}>{s.value}</div>
                      <div style={{ fontSize: '0.7rem', color: '#6b7280' }}>{s.label}</div>
                    </div>
                  </Col>
                ))}
              </Row>

              {/* History List */}
              {journeyHistory.map((j, i) => (
                <div key={j._id || i} style={{
                  background: '#f8fafc', borderRadius: 10, padding: '0.875rem 1rem',
                  marginBottom: '0.5rem', border: '1px solid #e5e7eb'
                }}>
                  <div className="d-flex justify-content-between align-items-center">
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '0.875rem', color: '#1e293b' }}>
                        {fmtDate(j.date)}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: 2 }}>
                        {fmt(j.startTime)} → {j.endTime ? fmt(j.endTime) : 'Auto-ended'} · {duration(j.startTime, j.endTime)}
                      </div>
                    </div>
                    <div className="d-flex align-items-center gap-2">
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontWeight: 800, fontSize: '1.1rem', color: '#10b981' }}>{j.totalDistanceKm} km</div>
                        <div style={{ fontSize: '0.65rem', color: '#9ca3af' }}>{j.locationPoints?.length || 0} points</div>
                      </div>
                      <Badge bg={j.status === 'COMPLETED' ? 'success' : j.status === 'ACTIVE' ? 'warning' : 'secondary'} style={{ fontSize: '0.65rem' }}>
                        {j.status === 'AUTO_ENDED' ? 'Auto' : j.status}
                      </Badge>
                    </div>
                  </div>
                </div>
              ))}
            </>
          )}
        </Card.Body>
      </Card>

      {/* Route Map Modal */}
      <Modal show={showMapModal} onHide={() => setShowMapModal(false)} size="lg" centered>
        <Modal.Header closeButton>
          <Modal.Title><i className="fas fa-map me-2" />Today's Journey Route</Modal.Title>
        </Modal.Header>
        <Modal.Body style={{ padding: 0 }}>
          {journey?.locationPoints?.length > 0 && (() => {
            const positions = journey.locationPoints.map(p => [p.lat, p.lng]);
            return (
              <MapContainer
                center={positions[0]}
                zoom={13}
                style={{ height: 500, width: '100%' }}
              >
                <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="© OpenStreetMap" />
                <FitBounds positions={positions} />
                <Polyline
                  positions={positions}
                  pathOptions={{ color: '#10b981', weight: 5, opacity: 0.85, lineJoin: 'round', lineCap: 'round' }}
                />
                <Marker position={positions[0]}>
                  <Popup><strong>🟢 Start</strong><br />{fmt(journey.startTime)}</Popup>
                </Marker>
                {positions.length > 1 && (
                  <Marker position={positions[positions.length - 1]}>
                    <Popup>
                      <strong>{journey.status === 'COMPLETED' ? '🔴 End' : '🟡 Current'}</strong><br />
                      {journey.endTime ? fmt(journey.endTime) : 'Ongoing'}
                    </Popup>
                  </Marker>
                )}
              </MapContainer>
            );
          })()}
          <div style={{ padding: '1rem', background: '#f8fafc', borderTop: '1px solid #e5e7eb' }}>
            <Row className="g-2">
              <Col xs={3}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '1.2rem', fontWeight: 700, color: '#10b981' }}>{journey?.totalDistanceKm}</div>
                  <div style={{ fontSize: '0.7rem', color: '#6b7280' }}>Total KM</div>
                </div>
              </Col>
              <Col xs={3}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '1.2rem', fontWeight: 700, color: '#3b82f6' }}>{journey?.avgSpeedKmh || 0}</div>
                  <div style={{ fontSize: '0.7rem', color: '#6b7280' }}>Avg Speed</div>
                </div>
              </Col>
              <Col xs={3}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '1.2rem', fontWeight: 700, color: '#ef4444' }}>{journey?.maxSpeedKmh || 0}</div>
                  <div style={{ fontSize: '0.7rem', color: '#6b7280' }}>Max Speed</div>
                </div>
              </Col>
              <Col xs={3}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '1.2rem', fontWeight: 700, color: '#8b5cf6' }}>{journey?.locationPoints?.length || 0}</div>
                  <div style={{ fontSize: '0.7rem', color: '#6b7280' }}>GPS Points</div>
                </div>
              </Col>
            </Row>
          </div>
        </Modal.Body>
      </Modal>
      {/* Background Tracking Permission Modal */}
      <Modal show={showPermissionModal} onHide={() => setShowPermissionModal(false)} centered>
        <Modal.Header closeButton style={{ background: 'linear-gradient(135deg, #10b981, #059669)', color: '#fff', border: 'none' }}>
          <Modal.Title style={{ color: '#fff', fontWeight: 700 }}>
            <i className="fas fa-shield-alt me-2" />
            Enable Background Tracking?
          </Modal.Title>
        </Modal.Header>
        <Modal.Body style={{ padding: '2rem' }}>
          <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
            <div style={{
              width: 80,
              height: 80,
              background: 'linear-gradient(135deg, #d1fae5, #a7f3d0)',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 1rem',
              boxShadow: '0 4px 20px rgba(16,185,129,0.3)'
            }}>
              <i className="fas fa-location-arrow" style={{ fontSize: '2rem', color: '#059669' }} />
            </div>
            <h5 style={{ fontWeight: 700, color: '#1e293b', marginBottom: '0.5rem' }}>
              Track Location in Background
            </h5>
            <p style={{ color: '#64748b', fontSize: '0.9rem', marginBottom: 0 }}>
              Continue tracking your journey even when the app is closed or minimized
            </p>
          </div>

          <div style={{ background: '#f8fafc', borderRadius: 12, padding: '1.25rem', marginBottom: '1.5rem' }}>
            <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#1e293b', marginBottom: '0.75rem' }}>
              <i className="fas fa-check-circle me-2" style={{ color: '#10b981' }} />
              Benefits:
            </div>
            <ul style={{ margin: 0, paddingLeft: '1.5rem', color: '#64748b', fontSize: '0.85rem', lineHeight: 1.8 }}>
              <li>Accurate distance tracking</li>
              <li>No need to keep app open</li>
              <li>Automatic GPS pings every minute</li>
              <li>Battery optimized</li>
            </ul>
          </div>

          <div style={{ background: '#fef3c7', borderRadius: 12, padding: '1rem', marginBottom: '1.5rem', border: '1px solid #fcd34d' }}>
            <div style={{ fontSize: '0.8rem', color: '#92400e' }}>
              <i className="fas fa-info-circle me-2" />
              <strong>Note:</strong> You'll need to allow notifications and location permissions for background tracking to work.
            </div>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <Button
              variant="outline-secondary"
              onClick={() => setShowPermissionModal(false)}
              style={{ flex: 1, borderRadius: 10, fontWeight: 600 }}
            >
              Maybe Later
            </Button>
            <Button
              onClick={async () => {
                await enableBackgroundTracking();
                setShowPermissionModal(false);
              }}
              style={{
                flex: 1,
                background: 'linear-gradient(135deg, #10b981, #059669)',
                border: 'none',
                borderRadius: 10,
                fontWeight: 600,
                boxShadow: '0 4px 12px rgba(16,185,129,0.3)'
              }}
            >
              <i className="fas fa-check me-2" />
              Enable Now
            </Button>
          </div>
        </Modal.Body>
      </Modal>
    </div>
  );
};

export default JourneyPage;
