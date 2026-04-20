import React, { useState, useEffect, useRef } from 'react';
import { Card, Button, Badge, Modal, Form, Row, Col } from 'react-bootstrap';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import { toast } from 'react-toastify';
import LocationConsentModal from '../components/LocationConsentModal';
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
  new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject({ code: 0, message: 'Geolocation not supported' });
      return;
    }
    
    navigator.geolocation.getCurrentPosition(
      p => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
      error => {
        console.error('Geolocation error:', error);
        reject(error);
      },
      { 
        enableHighAccuracy: true, 
        timeout: 30000,
        maximumAge: 0
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

const statusColor = { PLANNED: 'secondary', CHECKED_IN: 'warning', COMPLETED: 'success', CANCELLED: 'danger' };

const FieldVisits = () => {
  const { user } = useAuth();
  const [plan, setPlan] = useState(null);
  const [visits, setVisits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showOutcomeModal, setShowOutcomeModal] = useState(false);
  const [showConsentModal, setShowConsentModal] = useState(false);
  const [consentChecked, setConsentChecked] = useState(false);
  const [pendingPhotoFile, setPendingPhotoFile] = useState(null);
  const [outcomeForm, setOutcomeForm] = useState({ status: 'NEUTRAL', notes: '', dealValue: '' });
  const [formErrors, setFormErrors] = useState({});
  const [gpsLoading, setGpsLoading] = useState({});
  const photoInputRef = useRef(null);
  const [photoVisitId, setPhotoVisitId] = useState(null);
  const [capturedLocation, setCapturedLocation] = useState(null);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  // Derive activeVisit from visits array to prevent desync
  const activeVisit = visits.find(v => v.status === 'CHECKED_IN')?._id || null;

  useEffect(() => {
    checkLocationConsent();
    fetchTodayData();
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    
    // Network status listeners
    const handleOnline = () => {
      setIsOnline(true);
      toast.success('Back online!');
      fetchTodayData();
    };
    const handleOffline = () => {
      setIsOnline(false);
      toast.warning('You are offline.');
    };
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Check location consent
  const checkLocationConsent = async () => {
    try {
      const res = await api.get('/api/consent/location/status');
      if (res.data.isFieldEmployee && !res.data.consent?.granted) {
        setShowConsentModal(true);
      }
      setConsentChecked(true);
    } catch (err) {
      console.error('Failed to check consent:', err);
      setConsentChecked(true);
    }
  };

  // Handle consent acceptance
  const handleConsentAccept = async () => {
    try {
      await api.post('/api/consent/location/grant');
      setShowConsentModal(false);
      toast.success('Location consent granted');
    } catch (err) {
      toast.error('Failed to grant consent');
    }
  };

  // Handle consent decline
  const handleConsentDecline = () => {
    setShowConsentModal(false);
    toast.warning('Location consent is required for field visits');
  };

  const fetchTodayData = async () => {
    if (!isOnline) {
      toast.error('No internet connection. Please check your network.');
      setLoading(false);
      return;
    }
    
    try {
      const requests = [
        api.get('/api/visit-plans/my-today'),
        api.get('/api/field-visits/today')
      ];

      const results = await Promise.allSettled(requests);
      
      if (results[0].status === 'fulfilled') {
        setPlan(results[0].value.data);
      } else {
        console.error('Failed to load visit plan:', results[0].reason);
      }
      
      if (results[1].status === 'fulfilled') {
        const visitsData = results[1].value.data;
        setVisits(visitsData);
      } else {
        toast.error('Failed to load visits. Please refresh the page.');
      }
    } catch (err) {
      console.error('Fetch error:', err);
      toast.error('Unable to load data. Please check your connection and try again.');
    } finally {
      setLoading(false);
    }
  };



  const handleCheckIn = async (visit) => {
    if (!isOnline) {
      toast.error('Cannot check in while offline.');
      return;
    }
    
    setGpsLoading(p => ({ ...p, [`checkin-${visit._id}`]: true }));
    try {
      const pos = await getLocation();
      const address = await getAddress(pos.lat, pos.lng);
      await api.post(`/api/field-visits/${visit._id}/checkin`, { ...pos, address });
      
      toast.success(`Checked in at ${visit.clientId?.name}`);
      fetchTodayData();
    } catch (e) {
      let errorMsg = 'Check-in failed';
      if (e.code === 1) errorMsg = 'Location permission denied. Enable location in settings.';
      else if (e.code === 2) errorMsg = 'Location unavailable. Check your GPS.';
      else if (e.code === 3) errorMsg = 'Location timeout. Try again.';
      else if (e.response) errorMsg = e.response.data?.message || 'Server error.';
      toast.error(errorMsg);
    } finally {
      setGpsLoading(p => ({ ...p, [`checkin-${visit._id}`]: false }));
    }
  };

  const handleCheckOut = async (visit) => {
    if (!isOnline) {
      toast.error('Cannot check out while offline.');
      return;
    }
    
    setGpsLoading(p => ({ ...p, [`checkout-${visit._id}`]: true }));
    try {
      const pos = await getLocation();
      const address = await getAddress(pos.lat, pos.lng);
      await api.post(`/api/field-visits/${visit._id}/checkout`, { ...pos, address });
      toast.success('Checked out successfully');
      fetchTodayData();
    } catch (e) {
      let errorMsg = 'Check-out failed';
      if (e.code === 1) errorMsg = 'Location permission denied. Enable location in settings.';
      else if (e.code === 2) errorMsg = 'Location unavailable. Check your GPS.';
      else if (e.code === 3) errorMsg = 'Location timeout. Try again.';
      else if (e.response) errorMsg = e.response.data?.message || 'Server error.';
      toast.error(errorMsg);
    } finally {
      setGpsLoading(p => ({ ...p, [`checkout-${visit._id}`]: false }));
    }
  };

  const requestLocationPermission = async () => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject({ code: 0, message: 'Geolocation not supported' });
        return;
      }

      // Request permission by attempting to get location
      navigator.geolocation.getCurrentPosition(
        () => resolve(true),
        (error) => reject(error),
        { enableHighAccuracy: true, timeout: 30000, maximumAge: 0 }
      );
    });
  };

  const handlePhotoClick = async (visitId) => {
    setPhotoVisitId(visitId);
    
    // Check if geolocation is supported
    if (!navigator.geolocation) {
      toast.error('Geolocation not supported on this device');
      return;
    }
    
    // Try to get location first
    const loadingToast = toast.info('📍 Getting location...', { autoClose: 2000 });
    
    try {
      const position = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(
          resolve,
          reject,
          { enableHighAccuracy: true, timeout: 15000, maximumAge: 5000 }
        );
      });
      
      const locationData = {
        lat: position.coords.latitude,
        lng: position.coords.longitude,
        accuracy: position.coords.accuracy,
        timestamp: Date.now()
      };
      setCapturedLocation(locationData);
      
      toast.dismiss(loadingToast);
      toast.success('Location captured!', { autoClose: 1000 });
      
      // Open camera
      setTimeout(() => photoInputRef.current.click(), 300);
    } catch (error) {
      toast.dismiss(loadingToast);
      
      let errorMsg = 'Location access failed';
      if (error.code === 1) errorMsg = 'Location denied. Enable in browser settings.';
      else if (error.code === 2) errorMsg = 'Location unavailable. Check GPS.';
      else if (error.code === 3) errorMsg = 'Location timeout. Try again.';
      
      toast.error(errorMsg);
    }
  };



  const handlePhotoCapture = async (e) => {
    const file = e.target.files[0];
    if (!file || !photoVisitId) {
      e.target.value = '';
      return;
    }
    
    console.log('Photo selected, captured location:', capturedLocation);
    
    // Auto-recapture location if expired (within last 2 minutes)
    if (!capturedLocation || (Date.now() - capturedLocation.timestamp) > 120000) {
      toast.info('Location expired. Recapturing location...');
      try {
        const position = await new Promise((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true,
            timeout: 15000,
            maximumAge: 0
          });
        });
        
        const locationData = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: position.coords.accuracy,
          timestamp: Date.now()
        };
        setCapturedLocation(locationData);
      } catch (error) {
        toast.error('❌ Failed to get location. Please try capturing the photo again.');
        e.target.value = '';
        setPhotoVisitId(null);
        setCapturedLocation(null);
        return;
      }
    }
    
    const loadingToast = toast.info('📤 Uploading photo with location...', { autoClose: false });
    
    try {
      const address = await getAddress(capturedLocation.lat, capturedLocation.lng);
      
      console.log('Uploading photo with location:', capturedLocation.lat, capturedLocation.lng);
      
      const formData = new FormData();
      formData.append('photo', file);
      formData.append('lat', capturedLocation.lat);
      formData.append('lng', capturedLocation.lng);
      formData.append('address', address);
      
      await api.post(`/api/field-visits/${photoVisitId}/photo`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      
      toast.dismiss(loadingToast);
      toast.success('✅ Photo uploaded with GPS location!', { autoClose: 3000 });
      fetchTodayData();
    } catch (e) {
      toast.dismiss(loadingToast);
      
      console.error('Photo upload error:', e);
      
      let errorMsg = '❌ Photo upload failed';
      
      if (e.response) {
        errorMsg = '❌ Upload failed: ' + (e.response?.data?.message || 'Server error');
      } else if (!isOnline) {
        errorMsg = '❌ No internet connection. Please try again when online.';
      }
      
      toast.error(errorMsg, { autoClose: 7000 });
    }
    
    e.target.value = '';
    setPhotoVisitId(null);
    setCapturedLocation(null);
  };

  const validateOutcomeForm = () => {
    const errors = {};
    
    // Deal value validation
    if (outcomeForm.dealValue && parseFloat(outcomeForm.dealValue) < 0) {
      errors.dealValue = 'Deal value cannot be negative';
    }
    
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleOutcomeSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateOutcomeForm()) {
      toast.error('Please fix the form errors');
      return;
    }
    
    if (!isOnline) {
      toast.error('Cannot save outcome while offline.');
      return;
    }
    
    try {
      await api.post(`/api/field-visits/${activeVisit || visits.find(v => v.status === 'CHECKED_IN')?._id}/outcome`, outcomeForm);
      toast.success('Outcome saved!');
      setShowOutcomeModal(false);
      setOutcomeForm({ status: 'NEUTRAL', notes: '', dealValue: '' });
      setFormErrors({});
      fetchTodayData();
    } catch (err) {
      const errorMsg = err.response?.data?.message || 'Failed to save outcome.';
      toast.error(errorMsg);
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
      <input 
        ref={photoInputRef} 
        type="file" 
        accept="image/*" 
        capture="environment" 
        style={{ display: 'none' }} 
        onChange={handlePhotoCapture}
      />

      {/* Offline Banner */}
      {!isOnline && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
          color: '#fff',
          padding: '0.75rem',
          textAlign: 'center',
          zIndex: 10000,
          fontSize: '0.9rem',
          fontWeight: 600,
          boxShadow: '0 2px 8px rgba(0,0,0,0.2)'
        }}>
          <i className="fas fa-wifi-slash me-2" />
          You are offline. Some features may not work.
        </div>
      )}

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
                {/* Header Section - Simplified */}
                <div className="d-flex justify-content-between align-items-start mb-3">
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="d-flex align-items-center gap-2 mb-2">
                      {/* Visit Number Badge */}
                      <div style={{
                        background: 'linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%)',
                        color: '#2563eb',
                        padding: '0.25rem 0.5rem',
                        borderRadius: 6,
                        fontSize: isMobile ? '0.65rem' : '0.7rem',
                        fontWeight: 700
                      }}>
                        #{idx + 1}
                      </div>
                      
                      {/* Priority Badge */}
                      {client?.priority === 'HIGH' && (
                        <Badge style={{
                          background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                          border: 'none',
                          padding: '0.25rem 0.5rem',
                          fontSize: isMobile ? '0.65rem' : '0.7rem',
                          fontWeight: 600,
                          borderRadius: 6
                        }}>
                          HIGH
                        </Badge>
                      )}
                    </div>
                    
                    {/* Client Name */}
                    <h5 style={{ 
                      fontWeight: 700, 
                      fontSize: isMobile ? '1.1rem' : '1.2rem', 
                      marginBottom: '0.5rem',
                      color: '#1e293b',
                      lineHeight: 1.3
                    }}>
                      {client?.name}
                    </h5>
                    
                    {/* Contact Info - Collapsible on mobile */}
                    {!isMobile && (
                      <div style={{ 
                        fontSize: '0.85rem', 
                        color: '#64748b',
                        marginBottom: '0.5rem'
                      }}>
                        <i className="fas fa-user" style={{ fontSize: '0.75rem', marginRight: '0.35rem' }} />
                        {client?.contactPerson} • {client?.phone}
                      </div>
                    )}
                  </div>
                  
                  {/* Status Badge */}
                  <Badge style={{
                    background: visit.status === 'COMPLETED'
                      ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
                      : visit.status === 'CHECKED_IN'
                      ? 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)'
                      : 'linear-gradient(135deg, #94a3b8 0%, #64748b 100%)',
                    border: 'none',
                    padding: isMobile ? '0.4rem 0.65rem' : '0.45rem 0.75rem',
                    fontSize: isMobile ? '0.7rem' : '0.75rem',
                    fontWeight: 600,
                    borderRadius: 8,
                    textTransform: 'uppercase'
                  }}>
                    {visit.status.replace('_', ' ')}
                  </Badge>
                </div>

                {/* Location Section - Simplified */}
                <div style={{
                  background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
                  padding: isMobile ? '0.75rem' : '0.85rem',
                  borderRadius: 10,
                  marginBottom: '1rem',
                  border: '1px solid #e2e8f0'
                }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
                    <i className="fas fa-map-marker-alt" style={{ color: '#dc2626', fontSize: '0.9rem', marginTop: '0.15rem' }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ 
                        fontSize: isMobile ? '0.8rem' : '0.85rem', 
                        color: '#475569',
                        lineHeight: 1.4
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
                            gap: '0.35rem',
                            color: '#10b981',
                            textDecoration: 'none',
                            fontSize: isMobile ? '0.75rem' : '0.8rem',
                            fontWeight: 600,
                            marginTop: '0.35rem'
                          }}
                        >
                          <i className="fas fa-directions" />
                          Directions
                        </a>
                      )}
                    </div>
                  </div>
                </div>

                {/* Check-in Info & Photos - Only show if checked in */}
                {visit.status !== 'PLANNED' && (visit.checkIn?.time || visit.photos?.length > 0) && (
                  <div style={{
                    background: 'linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%)',
                    padding: isMobile ? '0.75rem' : '0.85rem',
                    borderRadius: 10,
                    marginBottom: '1rem',
                    border: '1px solid #a7f3d0'
                  }}>
                    {visit.checkIn?.time && (
                      <div style={{ 
                        fontSize: isMobile ? '0.75rem' : '0.8rem', 
                        color: '#047857',
                        marginBottom: visit.photos?.length > 0 ? '0.5rem' : 0
                      }}>
                        <i className="fas fa-clock" style={{ marginRight: '0.35rem' }} />
                        Checked in at {new Date(visit.checkIn.time).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    )}
                    
                    {visit.photos?.length > 0 && (
                      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                        {visit.photos.map((p, i) => (
                          <div key={i} style={{
                            width: isMobile ? 50 : 60,
                            height: isMobile ? 50 : 60,
                            borderRadius: 6,
                            overflow: 'hidden',
                            border: '2px solid #fff',
                            boxShadow: '0 2px 6px rgba(0,0,0,0.1)',
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
                    )}
                  </div>
                )}

                {/* Outcome Section - Simplified */}
                {visit.outcome?.status && visit.outcome.status !== 'NEUTRAL' && (
                  <div style={{
                    background: 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)',
                    padding: isMobile ? '0.75rem' : '0.85rem',
                    borderRadius: 10,
                    marginBottom: '1rem',
                    border: '1px solid #bfdbfe'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <Badge style={{
                        background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                        border: 'none',
                        padding: '0.35rem 0.65rem',
                        fontSize: isMobile ? '0.7rem' : '0.75rem',
                        fontWeight: 600,
                        borderRadius: 6
                      }}>
                        {OUTCOME_OPTIONS.find(o => o.value === visit.outcome.status)?.label}
                      </Badge>
                      {visit.outcome.dealValue > 0 && (
                        <Badge style={{
                          background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                          border: 'none',
                          padding: '0.35rem 0.65rem',
                          fontSize: isMobile ? '0.7rem' : '0.75rem',
                          fontWeight: 600,
                          borderRadius: 6
                        }}>
                          ₹{visit.outcome.dealValue.toLocaleString()}
                        </Badge>
                      )}
                    </div>
                  </div>
                )}

                {/* Completion Stats - Simplified */}
                {visit.status === 'COMPLETED' && (visit.totalDistanceKm > 0 || visit.durationMinutes > 0) && (
                  <div style={{
                    display: 'flex',
                    gap: isMobile ? '0.5rem' : '0.75rem',
                    padding: isMobile ? '0.65rem' : '0.75rem',
                    background: 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)',
                    borderRadius: 10,
                    marginBottom: '1rem',
                    border: '1px solid #bbf7d0'
                  }}>
                    {visit.totalDistanceKm > 0 && (
                      <div style={{ flex: 1, textAlign: 'center' }}>
                        <div style={{ fontSize: isMobile ? '0.7rem' : '0.75rem', color: '#166534', marginBottom: '0.15rem' }}>Distance</div>
                        <div style={{ fontSize: isMobile ? '0.95rem' : '1rem', fontWeight: 700, color: '#15803d' }}>
                          {visit.totalDistanceKm} <span style={{ fontSize: '0.7rem', fontWeight: 500 }}>km</span>
                        </div>
                      </div>
                    )}
                    {visit.totalDistanceKm > 0 && visit.durationMinutes > 0 && (
                      <div style={{ width: 1, background: '#bbf7d0' }} />
                    )}
                    {visit.durationMinutes > 0 && (
                      <div style={{ flex: 1, textAlign: 'center' }}>
                        <div style={{ fontSize: isMobile ? '0.7rem' : '0.75rem', color: '#166534', marginBottom: '0.15rem' }}>Duration</div>
                        <div style={{ fontSize: isMobile ? '0.95rem' : '1rem', fontWeight: 700, color: '#15803d' }}>
                          {visit.durationMinutes} <span style={{ fontSize: '0.7rem', fontWeight: 500 }}>min</span>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Action Buttons - Simplified */}
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
                        fontSize: isMobile ? '0.9rem' : '0.95rem',
                        fontWeight: 600,
                        padding: isMobile ? '0.75rem' : '0.85rem',
                        minHeight: 48,
                        boxShadow: '0 2px 8px rgba(16,185,129,0.3)'
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
                        onClick={() => handlePhotoClick(visit._id)} 
                        style={{ 
                          borderRadius: 10,
                          fontSize: isMobile ? '0.9rem' : '0.95rem',
                          fontWeight: 600,
                          padding: isMobile ? '0.75rem' : '0.85rem',
                          minWidth: isMobile ? 48 : 100,
                          minHeight: 48,
                          border: '2px solid #e2e8f0',
                          color: '#64748b',
                          background: '#fff'
                        }}
                      >
                        <i className="fas fa-camera" />
                        {!isMobile && <span className="ms-2">Photo</span>}
                      </Button>
                      
                      <Button 
                        onClick={() => { setShowOutcomeModal(true); }} 
                        style={{ 
                          borderRadius: 10,
                          background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                          border: 'none',
                          color: '#fff',
                          fontSize: isMobile ? '0.9rem' : '0.95rem',
                          fontWeight: 600,
                          padding: isMobile ? '0.75rem' : '0.85rem',
                          minWidth: isMobile ? 48 : 100,
                          minHeight: 48,
                          boxShadow: '0 2px 8px rgba(59,130,246,0.3)'
                        }}
                      >
                        <i className="fas fa-clipboard-check" />
                        {!isMobile && <span className="ms-2">Outcome</span>}
                      </Button>
                      
                      <Button 
                        onClick={() => handleCheckOut(visit)} 
                        disabled={isCheckoutLoading} 
                        style={{ 
                          flex: 1,
                          borderRadius: 10,
                          background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                          border: 'none',
                          fontSize: isMobile ? '0.9rem' : '0.95rem',
                          fontWeight: 600,
                          padding: isMobile ? '0.75rem' : '0.85rem',
                          minHeight: 48,
                          boxShadow: '0 2px 8px rgba(239,68,68,0.3)'
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

      {/* Location Consent Modal */}
      <LocationConsentModal 
        show={showConsentModal} 
        onAccept={handleConsentAccept}
        onDecline={handleConsentDecline}
      />

      {/* Outcome Modal - Simplified */}
      <Modal show={showOutcomeModal} onHide={() => setShowOutcomeModal(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title><i className="fas fa-clipboard-check me-2" />Visit Outcome</Modal.Title>
        </Modal.Header>
        <Form onSubmit={handleOutcomeSubmit}>
          <Modal.Body>
            <Form.Group className="mb-3">
              <Form.Label style={{ fontWeight: 600 }}>Outcome *</Form.Label>
              <Form.Select 
                value={outcomeForm.status} 
                onChange={e => setOutcomeForm(p => ({ ...p, status: e.target.value }))} 
                required 
                style={{ borderRadius: 8 }}
              >
                {OUTCOME_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </Form.Select>
            </Form.Group>
            
            <Form.Group className="mb-3">
              <Form.Label style={{ fontWeight: 600 }}>Deal Value (₹)</Form.Label>
              <Form.Control 
                type="number" 
                value={outcomeForm.dealValue} 
                onChange={e => setOutcomeForm(p => ({ ...p, dealValue: e.target.value }))} 
                placeholder="Enter amount if applicable" 
                style={{ borderRadius: 8 }} 
                isInvalid={!!formErrors.dealValue}
              />
              <Form.Control.Feedback type="invalid">
                {formErrors.dealValue}
              </Form.Control.Feedback>
            </Form.Group>
            
            <Form.Group className="mb-3">
              <Form.Label style={{ fontWeight: 600 }}>Notes</Form.Label>
              <Form.Control 
                as="textarea" 
                rows={3} 
                value={outcomeForm.notes} 
                onChange={e => setOutcomeForm(p => ({ ...p, notes: e.target.value }))} 
                placeholder="What happened during the visit?" 
                style={{ borderRadius: 8 }} 
              />
            </Form.Group>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={() => setShowOutcomeModal(false)}>Cancel</Button>
            <Button type="submit" style={{ background: '#10b981', border: 'none', color: '#fff' }}>
              <i className="fas fa-save me-1" />Save
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>
    </div>
  );
};

export default FieldVisits;

