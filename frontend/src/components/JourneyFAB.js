import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-toastify';
import api from '../utils/api';

const JourneyFAB = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [journeyData, setJourneyData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const isActive = journeyData?.journey?.status === 'ACTIVE';
  const canStart = journeyData?.canStartJourney;
  const isDone = journeyData?.journey?.status === 'COMPLETED' || journeyData?.journey?.status === 'AUTO_ENDED';

  // Only show on specific routes
  const allowedRoutes = [
    '/dashboard',
    '/field-visits',
    '/attendance'
  ];
  
  const shouldShow = allowedRoutes.includes(location.pathname);

  const fetchJourney = useCallback(async () => {
    try {
      const res = await api.get('/api/journey/today');
      setJourneyData(res.data);
    } catch {}
  }, []);

  useEffect(() => {
    if (shouldShow) {
      fetchJourney();
      const interval = setInterval(fetchJourney, 30000);
      return () => clearInterval(interval);
    }
  }, [fetchJourney, shouldShow]);

  // Don't render for non-field employees or on non-allowed routes
  if (!journeyData || !shouldShow) return null;

  const handleAction = async () => {
    if (!canStart && !isActive) {
      navigate('/field-visits');
      return;
    }
    setLoading(true);
    try {
      if (canStart) {
        await api.post('/api/journey/start');
        toast.success('🚀 Journey started!');
      } else if (isActive) {
        await api.post('/api/journey/end');
        toast.success('🏁 Journey ended!');
      }
      await fetchJourney();
      setExpanded(false);
    } catch (e) {
      toast.error(e.response?.data?.message || 'Action failed');
    } finally { setLoading(false); }
  };

  return (
    <div style={{
      position: 'fixed',
      top: '5rem',
      right: '1.25rem',
      zIndex: 1050,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'flex-end',
      gap: '0.5rem'
    }}>

      {/* Expanded Info Panel */}
      {expanded && (
        <div style={{
          background: 'white',
          borderRadius: 14,
          boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
          padding: '1rem 1.25rem',
          minWidth: 220,
          border: '1px solid #e5e7eb',
          animation: 'slideDown 0.2s ease',
          marginTop: '0.5rem'
        }}>
          <div style={{ fontWeight: 700, fontSize: '0.85rem', color: '#1e293b', marginBottom: '0.5rem' }}>
            <i className="fas fa-route me-2 text-success" />Journey Tracker
          </div>

          {isActive && (
            <div style={{ marginBottom: '0.75rem' }}>
              <div style={{ fontSize: '2rem', fontWeight: 900, color: '#10b981', lineHeight: 1 }}>
                {journeyData.journey.totalDistanceKm.toFixed(1)} km
              </div>
              <div style={{ fontSize: '0.72rem', color: '#6b7280', marginTop: 2 }}>
                <i className="fas fa-circle me-1" style={{ color: '#10b981', fontSize: '0.5rem' }} />
                Active since {new Date(journeyData.journey.startTime).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
          )}

          {isDone && (
            <div style={{ marginBottom: '0.75rem' }}>
              <div style={{ fontSize: '2rem', fontWeight: 900, color: '#059669', lineHeight: 1 }}>
                {journeyData.journey.totalDistanceKm.toFixed(1)} km
              </div>
              <div style={{ fontSize: '0.72rem', color: '#6b7280', marginTop: 2 }}>✅ Journey completed today</div>
            </div>
          )}

          {canStart && (
            <div style={{ fontSize: '0.78rem', color: '#6b7280', marginBottom: '0.75rem' }}>
              ✅ Checked in · Ready to start
            </div>
          )}

          {!journeyData?.hasCheckedIn && !journeyData?.journey && (
            <div style={{ fontSize: '0.78rem', color: '#94a3b8', marginBottom: '0.75rem' }}>
              🔒 Check in attendance first
            </div>
          )}

          <div className="d-flex gap-2">
            {(canStart || isActive) && (
              <button onClick={handleAction} disabled={loading} style={{
                flex: 1, padding: '0.5rem', borderRadius: 8, border: 'none',
                background: isActive ? '#ef4444' : '#10b981',
                color: 'white', fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer'
              }}>
                {loading
                  ? <span className="spinner-border spinner-border-sm" />
                  : isActive ? '⏹ End' : '▶ Start'}
              </button>
            )}
            <button onClick={() => { navigate('/field-visits'); setExpanded(false); }} style={{
              flex: 1, padding: '0.5rem', borderRadius: 8,
              border: '1px solid #e5e7eb', background: '#f8fafc',
              color: '#374151', fontWeight: 600, fontSize: '0.8rem', cursor: 'pointer'
            }}>
              <i className="fas fa-external-link-alt me-1" />Details
            </button>
          </div>
        </div>
      )}

      {/* Main FAB Button */}
      <button
        onClick={() => setExpanded(p => !p)}
        style={{
          width: expanded ? 52 : isActive ? 'auto' : 52,
          height: 52,
          borderRadius: isActive ? 26 : 26,
          border: 'none',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '0.5rem',
          padding: isActive ? '0 1.25rem' : '0',
          fontWeight: 700,
          fontSize: '0.82rem',
          color: 'white',
          background: isActive
            ? 'linear-gradient(135deg, #064e3b, #10b981)'
            : isDone
              ? 'linear-gradient(135deg, #374151, #6b7280)'
              : canStart
                ? 'linear-gradient(135deg, #065f46, #10b981)'
                : 'linear-gradient(135deg, #1e3a8a, #3b82f6)',
          boxShadow: isActive
            ? '0 4px 20px rgba(16,185,129,0.5)'
            : '0 4px 16px rgba(0,0,0,0.2)',
          transition: 'all 0.25s',
          position: 'relative',
          whiteSpace: 'nowrap'
        }}
      >
        {/* Pulse ring when active */}
        {isActive && (
          <span style={{
            position: 'absolute', inset: -4, borderRadius: '50%',
            border: '2px solid #10b981', opacity: 0.5,
            animation: 'ping 1.5s cubic-bezier(0,0,0.2,1) infinite'
          }} />
        )}
        <i className={`fas fa-${isActive ? 'route' : isDone ? 'check-circle' : canStart ? 'play-circle' : 'route'}`}
           style={{ fontSize: '1.1rem' }} />
        {isActive && <span>{journeyData.journey.totalDistanceKm.toFixed(1)} km</span>}
      </button>

      <style>{`
        @keyframes slideDown {
          from { opacity: 0; transform: translateY(-10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes ping {
          75%, 100% { transform: scale(1.6); opacity: 0; }
        }
      `}</style>
    </div>
  );
};

export default JourneyFAB;
