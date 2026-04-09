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
  const [showLocationPermissionModal, setShowLocationPermissionModal] = useState(false);
  const [pendingPhotoFile, setPendingPhotoFile] = useState(null);
  const [outcomeForm, setOutcomeForm] = useState({ status: 'NEUTRAL', notes: '', nextAction: '', nextFollowUpDate: '', dealValue: '', personMet: '', phone: '', purposeOfVisit: '' });
  const [formErrors, setFormErrors] = useState({});
  const [gpsLoading, setGpsLoading] = useState({});
  const routeIntervalRef = useRef(null);
  const photoInputRef = useRef(null);
  const [photoVisitId, setPhotoVisitId] = useState(null);
  const [capturedLocation, setCapturedLocation] = useState(null);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [routeTrackingErrors, setRouteTrackingErrors] = useState(0);
  const journeyPollIntervalRef = useRef(null);

  // Journey state
  const [journeyData, setJourneyData] = useState(undefined);
  const [journeyLoading, setJourneyLoading] = useState(false);
  const isJourneyActive = journeyData?.journey?.status === 'ACTIVE';
  useJourneyTracker(isJourneyActive);

  // Derive activeVisit from visits array to prevent desync
  const activeVisit = visits.find(v => v.status === 'CHECKED_IN')?._id || null;

  useEffect(() => {
    fetchTodayData();
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    
    // Network status listeners
    const handleOnline = () => {
      setIsOnline(true);
      toast.success('Back online! Syncing data...');
      fetchTodayData();
    };
    const handleOffline = () => {
      setIsOnline(false);
      toast.warning('You are offline. Changes will be saved when connection is restored.');
    };
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      clearInterval(routeIntervalRef.current);
      clearInterval(journeyPollIntervalRef.current);
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
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

  // Poll journey status every 30s (optimized from 10s) and only when page is visible
  useEffect(() => {
    const pollJourney = async () => {
      if (document.visibilityState === 'visible' && isOnline) {
        try {
          const res = await api.get('/api/journey/today');
          setJourneyData(res.data);
        } catch (err) {
          console.error('Journey poll failed:', err);
        }
      }
    };
    
    journeyPollIntervalRef.current = setInterval(pollJourney, 30000);
    return () => clearInterval(journeyPollIntervalRef.current);
  }, [isOnline]);

  const fetchTodayData = async () => {
    if (!isOnline) {
      toast.error('No internet connection. Please check your network.');
      setLoading(false);
      return;
    }
    
    try {
      const requests = [
        api.get('/api/visit-plans/my-today'),
        api.get('/api/field-visits/today'),
        api.get('/api/journey/today')
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
        const checkedIn = visitsData.find(v => v.status === 'CHECKED_IN');
        if (checkedIn) {
          startRouteTracking(checkedIn._id);
        }
      } else {
        toast.error('Failed to load visits. Please refresh the page.');
      }
      
      if (results[2].status === 'fulfilled') {
        setJourneyData(results[2].value.data);
      } else {
        setJourneyData(null);
      }
    } catch (err) {
      console.error('Fetch error:', err);
      toast.error('Unable to load data. Please check your connection and try again.');
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
    setRouteTrackingErrors(0);
    
    routeIntervalRef.current = setInterval(async () => {
      try {
        const pos = await getLocation();
        await api.post(`/api/field-visits/${visitId}/route`, { lat: pos.lat, lng: pos.lng });
        setRouteTrackingErrors(0); // Reset on success
      } catch (err) {
        const newErrorCount = routeTrackingErrors + 1;
        setRouteTrackingErrors(newErrorCount);
        
        if (newErrorCount >= 3) {
          clearInterval(routeIntervalRef.current);
          toast.error('GPS tracking failed multiple times. Please check your location settings.', {
            autoClose: 7000
          });
        }
      }
    }, 30000);
  };

  const handleCheckIn = async (visit) => {
    if (!isOnline) {
      toast.error('Cannot check in while offline. Please connect to internet.');
      return;
    }
    
    setGpsLoading(p => ({ ...p, [`checkin-${visit._id}`]: true }));
    try {
      const pos = await getLocation();
      const address = await getAddress(pos.lat, pos.lng);
      await api.post(`/api/field-visits/${visit._id}/checkin`, { ...pos, address });
      startRouteTracking(visit._id);
      toast.success(`Checked in at ${visit.clientId?.name}`);
      fetchTodayData();
    } catch (e) {
      let errorMsg = 'Check-in failed';
      if (e.code === 1) {
        errorMsg = 'Location permission denied. Please enable location in your browser settings.';
      } else if (e.code === 2) {
        errorMsg = 'Location unavailable. Please check your GPS/network.';
      } else if (e.code === 3) {
        errorMsg = 'Location request timeout. Please try again.';
      } else if (e.response) {
        errorMsg = e.response.data?.message || 'Server error. Please try again.';
      }
      toast.error(errorMsg, { autoClose: 5000 });
    } finally {
      setGpsLoading(p => ({ ...p, [`checkin-${visit._id}`]: false }));
    }
  };

  const handleCheckOut = async (visit) => {
    if (!isOnline) {
      toast.error('Cannot check out while offline. Please connect to internet.');
      return;
    }
    
    setGpsLoading(p => ({ ...p, [`checkout-${visit._id}`]: true }));
    try {
      const pos = await getLocation();
      const address = await getAddress(pos.lat, pos.lng);
      await api.post(`/api/field-visits/${visit._id}/checkout`, { ...pos, address });
      clearInterval(routeIntervalRef.current);
      setRouteTrackingErrors(0);
      toast.success('Checked out successfully');
      fetchTodayData();
    } catch (e) {
      let errorMsg = 'Check-out failed';
      if (e.code === 1) {
        errorMsg = 'Location permission denied. Please enable location in your browser settings.';
      } else if (e.code === 2) {
        errorMsg = 'Location unavailable. Please check your GPS/network.';
      } else if (e.code === 3) {
        errorMsg = 'Location request timeout. Please try again.';
      } else if (e.response) {
        errorMsg = e.response.data?.message || 'Server error. Please try again.';
      }
      toast.error(errorMsg, { autoClose: 5000 });
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
      toast.error('❌ Geolocation is not supported on this device');
      return;
    }
    
    console.log('Photo click - checking permissions...');
    console.log('Current URL:', window.location.href);
    console.log('Protocol:', window.location.protocol);
    console.log('Hostname:', window.location.hostname);
    
    // Check if we're on HTTPS or localhost (required for geolocation on mobile)
    const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    const isHttps = window.location.protocol === 'https:';
    const isLocalNetwork = window.location.hostname.match(/^192\.168\./) || window.location.hostname.match(/^10\./) || window.location.hostname.match(/^172\.(1[6-9]|2[0-9]|3[0-1])\./); // Local IP ranges
    
    if (!isHttps && !isLocalhost && !isLocalNetwork) {
      toast.error('⚠️ Location requires HTTPS connection or local network access.', { autoClose: 7000 });
      setTimeout(() => {
        alert(
          '⚠️ Secure Connection Required\n\n' +
          'Geolocation requires a secure connection.\n\n' +
          'You can access via:\n' +
          '✓ https:// (production)\n' +
          '✓ http://localhost (local development)\n' +
          '✓ http://192.168.x.x (local network)\n\n' +
          'Current: ' + window.location.href
        );
      }, 500);
      return;
    }
    
    // Try to check permission state first (if supported)
    if (navigator.permissions && navigator.permissions.query) {
      try {
        const permissionStatus = await navigator.permissions.query({ name: 'geolocation' });
        console.log('Permission state:', permissionStatus.state);
        
        if (permissionStatus.state === 'denied') {
          // Permission is permanently denied
          toast.error('🔒 Location access is blocked', { autoClose: 5000 });
          
          setTimeout(() => {
            alert(
              '🔒 Location Access Blocked\n\n' +
              'You have previously denied location access.\n\n' +
              '📱 To enable it:\n\n' +
              '🤖 Android Chrome:\n' +
              '1. Tap the lock icon (🔒) in the address bar\n' +
              '2. Tap "Permissions" or "Site settings"\n' +
              '3. Find "Location" and change to "Allow"\n' +
              '4. Refresh the page\n\n' +
              '🍎 iPhone Safari:\n' +
              '1. Go to iPhone Settings\n' +
              '2. Scroll to Safari → Location\n' +
              '3. Select "Allow"\n' +
              '4. Come back and try again'
            );
          }, 500);
          return;
        }
      } catch (e) {
        console.log('Permission API not fully supported:', e);
      }
    }
    
    // Show permission modal
    setShowLocationPermissionModal(true);
  };

  const handleLocationPermissionConfirm = async () => {
    setShowLocationPermissionModal(false);
    
    // Small delay to let modal close
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Try to get location permission first before opening camera
    const loadingToast = toast.info('📍 Requesting location access...', { autoClose: false });
    
    try {
      console.log('=== LOCATION REQUEST START ===');
      console.log('Navigator.geolocation available:', !!navigator.geolocation);
      console.log('Protocol:', window.location.protocol);
      console.log('Hostname:', window.location.hostname);
      console.log('User Agent:', navigator.userAgent);
      
      // Get location FIRST with more aggressive settings for mobile
      const position = await new Promise((resolve, reject) => {
        if (!navigator.geolocation) {
          reject({ code: 0, message: 'Geolocation not supported' });
          return;
        }

        const options = {
          enableHighAccuracy: true,
          timeout: 20000,
          maximumAge: 5000
        };
        
        console.log('Calling getCurrentPosition with options:', options);
        console.log('⏳ Waiting for user to grant permission...');

        navigator.geolocation.getCurrentPosition(
          (pos) => {
            console.log('✅ SUCCESS! Location obtained!');
            console.log('Latitude:', pos.coords.latitude);
            console.log('Longitude:', pos.coords.longitude);
            console.log('Accuracy:', pos.coords.accuracy, 'meters');
            console.log('Timestamp:', new Date(pos.timestamp).toLocaleString());
            resolve(pos);
          },
          (error) => {
            console.error('❌ GEOLOCATION ERROR!');
            console.error('Error Code:', error.code);
            console.error('Error Message:', error.message);
            console.error('Error Details:', JSON.stringify(error));
            
            // Log specific error codes
            switch(error.code) {
              case 1:
                console.error('PERMISSION_DENIED - User denied the request');
                break;
              case 2:
                console.error('POSITION_UNAVAILABLE - Location info unavailable');
                break;
              case 3:
                console.error('TIMEOUT - Request timed out');
                break;
              default:
                console.error('UNKNOWN_ERROR');
            }
            
            reject(error);
          },
          options
        );
      });
      
      // Store the location
      const locationData = {
        lat: position.coords.latitude,
        lng: position.coords.longitude,
        accuracy: position.coords.accuracy,
        timestamp: Date.now()
      };
      setCapturedLocation(locationData);
      
      console.log('📍 Location captured and stored:', locationData);
      console.log('=== LOCATION REQUEST SUCCESS ===');
      
      toast.dismiss(loadingToast);
      toast.success('✅ Location captured! Opening camera...', { autoClose: 2000 });
      
      // Small delay to show success message
      setTimeout(() => {
        photoInputRef.current.click();
      }, 500);
    } catch (error) {
      toast.dismiss(loadingToast);
      
      console.error('=== LOCATION REQUEST FAILED ===');
      console.error('Full error:', error);
      
      let errorTitle = '';
      let errorMsg = '';
      let instructions = '';
      let troubleshooting = '';
      
      if (error.code === 1) {
        errorTitle = '🔒 Location Permission Denied';
        errorMsg = 'You tapped "Block" or "Don\'t Allow" when the browser asked for location permission.';
        
        // Detect browser type
        const isChrome = /Chrome/.test(navigator.userAgent) && /Google Inc/.test(navigator.vendor);
        const isSafari = /Safari/.test(navigator.userAgent) && /Apple/.test(navigator.vendor);
        const isFirefox = /Firefox/.test(navigator.userAgent);
        
        instructions = '\n\n📱 HOW TO FIX:\n\n';
        
        if (isChrome) {
          instructions += '🤖 Chrome (Android):\n' +
            '1. Tap the 🔒 or ⓘ icon in the address bar\n' +
            '2. Tap "Permissions" or "Site settings"\n' +
            '3. Find "Location" → Change to "Allow"\n' +
            '4. Refresh this page (pull down)\n' +
            '5. Try capturing photo again\n';
        } else if (isSafari) {
          instructions += '🍎 Safari (iPhone):\n' +
            '1. Open iPhone Settings app\n' +
            '2. Scroll down → Tap "Safari"\n' +
            '3. Tap "Location" → Select "Ask" or "Allow"\n' +
            '4. Close Safari completely (swipe up)\n' +
            '5. Reopen Safari and try again\n';
        } else {
          instructions += '📱 Your Browser:\n' +
            '1. Look for lock/info icon in address bar\n' +
            '2. Find location/permissions settings\n' +
            '3. Change location to "Allow"\n' +
            '4. Refresh the page\n' +
            '5. Try again\n';
        }
        
        troubleshooting = '\n\n🔧 STILL NOT WORKING?\n' +
          '• Clear browser cache and cookies\n' +
          '• Try in Chrome (best support)\n' +
          '• Restart your browser\n' +
          '• Check device Location is ON in Settings\n' +
          '• Try in Incognito/Private mode';
          
      } else if (error.code === 2) {
        errorTitle = '📡 Location Unavailable';
        errorMsg = 'Your device cannot determine your location right now.';
        instructions = '\n\n📱 PLEASE CHECK:\n' +
          '✓ Location/GPS is turned ON in device settings\n' +
          '✓ You have internet or mobile data connection\n' +
          '✓ You\'re not in airplane mode\n' +
          '✓ Try moving to an open area (away from buildings)\n' +
          '✓ Wait a moment for GPS to lock on';
        troubleshooting = '\n\n🔧 TRY THIS:\n' +
          '• Turn Location OFF then ON in device settings\n' +
          '• Restart your device\n' +
          '• Try again in a few minutes';
          
      } else if (error.code === 3) {
        errorTitle = '⏱️ Location Timeout';
        errorMsg = 'Location request took too long (20 seconds).';
        instructions = '\n\n📱 PLEASE TRY:\n' +
          '✓ Make sure GPS/Location is enabled\n' +
          '✓ Check your internet connection\n' +
          '✓ Move to an area with better signal\n' +
          '✓ Close other apps using location\n' +
          '✓ Wait a moment and try again';
        troubleshooting = '\n\n🔧 IF STILL TIMING OUT:\n' +
          '• Restart your device\n' +
          '• Try in a different location\n' +
          '• Check if other apps can access location';
          
      } else {
        errorTitle = '❌ Location Error';
        errorMsg = 'Unable to access location: ' + (error.message || 'Unknown error');
        instructions = '\n\n📱 TROUBLESHOOTING:\n' +
          '✓ Check device location settings\n' +
          '✓ Make sure browser has location permission\n' +
          '✓ Try refreshing the page\n' +
          '✓ Restart your browser\n' +
          '✓ Try a different browser (Chrome recommended)';
      }
      
      // Show toast error
      toast.error(errorTitle, { autoClose: 5000 });
      
      // Show detailed alert with retry option
      setTimeout(() => {
        const fullMessage = errorTitle + '\n\n' + errorMsg + instructions + troubleshooting + '\n\n👉 Would you like to try again?';
        
        console.log('Showing error dialog to user');
        const retry = window.confirm(fullMessage);
        
        if (retry) {
          console.log('User chose to retry');
          handlePhotoClick(photoVisitId);
        } else {
          console.log('User cancelled retry');
        }
      }, 600);
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
    
    // Phone validation
    if (outcomeForm.phone && !/^\d{10}$/.test(outcomeForm.phone.replace(/\s/g, ''))) {
      errors.phone = 'Phone number must be 10 digits';
    }
    
    // Deal value validation
    if (outcomeForm.dealValue && parseFloat(outcomeForm.dealValue) < 0) {
      errors.dealValue = 'Deal value cannot be negative';
    }
    
    // If phone is provided, person met should be provided
    if (outcomeForm.phone && !outcomeForm.personMet) {
      errors.personMet = 'Please provide person name when phone is entered';
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
      toast.error('Cannot save outcome while offline. Please connect to internet.');
      return;
    }
    
    try {
      await api.post(`/api/field-visits/${activeVisit || visits.find(v => v.status === 'CHECKED_IN')?._id}/outcome`, outcomeForm);
      toast.success('Outcome saved successfully');
      setShowOutcomeModal(false);
      setOutcomeForm({ status: 'NEUTRAL', notes: '', nextAction: '', nextFollowUpDate: '', dealValue: '', personMet: '', phone: '', purposeOfVisit: '' });
      setFormErrors({});
      fetchTodayData();
    } catch (err) {
      const errorMsg = err.response?.data?.message || 'Failed to save outcome. Please try again.';
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
                        onClick={() => handlePhotoClick(visit._id)} 
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
                        onClick={() => { setShowOutcomeModal(true); }} 
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
                        aria-label="Add visit outcome"
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
            <Row>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label style={{ fontWeight: 600 }}>Person Met</Form.Label>
                  <Form.Control 
                    type="text" 
                    value={outcomeForm.personMet} 
                    onChange={e => setOutcomeForm(p => ({ ...p, personMet: e.target.value }))} 
                    placeholder="Name of person met" 
                    style={{ borderRadius: 8 }} 
                    isInvalid={!!formErrors.personMet}
                  />
                  <Form.Control.Feedback type="invalid">
                    {formErrors.personMet}
                  </Form.Control.Feedback>
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label style={{ fontWeight: 600 }}>Phone Number</Form.Label>
                  <Form.Control 
                    type="tel" 
                    value={outcomeForm.phone} 
                    onChange={e => setOutcomeForm(p => ({ ...p, phone: e.target.value }))} 
                    placeholder="10 digit number" 
                    style={{ borderRadius: 8 }} 
                    isInvalid={!!formErrors.phone}
                  />
                  <Form.Control.Feedback type="invalid">
                    {formErrors.phone}
                  </Form.Control.Feedback>
                </Form.Group>
              </Col>
            </Row>
            <Form.Group className="mb-3">
              <Form.Label style={{ fontWeight: 600 }}>Purpose of Visit</Form.Label>
              <Form.Control 
                type="text" 
                value={outcomeForm.purposeOfVisit} 
                onChange={e => setOutcomeForm(p => ({ ...p, purposeOfVisit: e.target.value }))} 
                placeholder="e.g., Product demo, Follow-up meeting" 
                style={{ borderRadius: 8 }} 
              />
            </Form.Group>
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
                  <Form.Control 
                    type="number" 
                    value={outcomeForm.dealValue} 
                    onChange={e => setOutcomeForm(p => ({ ...p, dealValue: e.target.value }))} 
                    placeholder="0" 
                    style={{ borderRadius: 8 }} 
                    isInvalid={!!formErrors.dealValue}
                  />
                  <Form.Control.Feedback type="invalid">
                    {formErrors.dealValue}
                  </Form.Control.Feedback>
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

      {/* Location Permission Modal */}
      <Modal 
        show={showLocationPermissionModal} 
        onHide={() => setShowLocationPermissionModal(false)} 
        centered
        style={{ zIndex: 9999 }}
      >
        <Modal.Header closeButton style={{ borderBottom: 'none', paddingBottom: 0 }}>
          <Modal.Title style={{ width: '100%', textAlign: 'center' }}>
            <div style={{
              width: isMobile ? 70 : 80,
              height: isMobile ? 70 : 80,
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 1rem',
              boxShadow: '0 8px 24px rgba(16,185,129,0.3)'
            }}>
              <i className="fas fa-map-marker-alt" style={{ fontSize: isMobile ? '1.75rem' : '2rem', color: '#fff' }} />
            </div>
          </Modal.Title>
        </Modal.Header>
        <Modal.Body style={{ textAlign: 'center', padding: isMobile ? '0 1.5rem 1.5rem' : '0 2rem 2rem' }}>
          <h5 style={{ fontWeight: 700, marginBottom: '1rem', color: '#1e293b', fontSize: isMobile ? '1.1rem' : '1.25rem' }}>
            📍 Location Access Required
          </h5>
          <p style={{ color: '#64748b', fontSize: isMobile ? '0.9rem' : '0.95rem', lineHeight: 1.6, marginBottom: '1rem' }}>
            To capture photos with GPS verification, we need access to your device location.
          </p>
          
          {/* Development Mode Warning - Show for local network access */}
          {(() => {
            const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
            const isHttps = window.location.protocol === 'https:';
            const isLocalNetwork = window.location.hostname.match(/^192\.168\./) || window.location.hostname.match(/^10\./) || window.location.hostname.match(/^172\.(1[6-9]|2[0-9]|3[0-1])\./); 
            
            if (!isHttps && !isLocalhost && isLocalNetwork) {
              return (
                <div style={{
                  background: 'linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%)',
                  padding: isMobile ? '0.85rem' : '1rem',
                  borderRadius: 12,
                  marginBottom: '1rem',
                  border: '1px solid #93c5fd'
                }}>
                  <p style={{ fontSize: isMobile ? '0.75rem' : '0.8rem', color: '#1e40af', marginBottom: '0.5rem', fontWeight: 600 }}>
                    <i className="fas fa-info-circle me-2" />Development Mode
                  </p>
                  <p style={{ fontSize: isMobile ? '0.75rem' : '0.8rem', color: '#1e3a8a', marginBottom: 0, lineHeight: 1.5 }}>
                    You're accessing via local network ({window.location.hostname}). Use <strong>Chrome</strong> for best location support.
                  </p>
                </div>
              );
            }
            return null;
          })()}
          
          <div style={{
            background: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)',
            padding: isMobile ? '0.85rem' : '1rem',
            borderRadius: 12,
            marginBottom: '1rem',
            border: '1px solid #fbbf24'
          }}>
            <p style={{ fontSize: isMobile ? '0.8rem' : '0.85rem', color: '#92400e', marginBottom: '0.5rem', fontWeight: 600 }}>
              <i className="fas fa-exclamation-triangle me-2" />Important!
            </p>
            <p style={{ fontSize: isMobile ? '0.8rem' : '0.85rem', color: '#b45309', marginBottom: 0, lineHeight: 1.5 }}>
              When you tap "Continue", your browser will ask for location permission. Please tap <strong>"Allow"</strong> or <strong>"Allow While Using"</strong>.
            </p>
          </div>
          <div style={{
            background: 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)',
            padding: isMobile ? '0.85rem' : '1rem',
            borderRadius: 12,
            marginBottom: '1rem',
            border: '1px solid #bbf7d0'
          }}>
            <p style={{ fontSize: isMobile ? '0.75rem' : '0.8rem', color: '#166534', marginBottom: '0.5rem', fontWeight: 600 }}>
              ✓ Your location is only used to tag photos
            </p>
            <p style={{ fontSize: isMobile ? '0.75rem' : '0.8rem', color: '#166534', marginBottom: 0 }}>
              ✓ We don't track or store your location history
            </p>
          </div>
        </Modal.Body>
        <Modal.Footer style={{ 
          borderTop: 'none', 
          padding: isMobile ? '0 1.5rem 1.5rem' : '0 2rem 2rem', 
          justifyContent: 'center', 
          gap: '0.75rem',
          flexDirection: isMobile ? 'column' : 'row'
        }}>
          <Button 
            variant="outline-secondary" 
            onClick={() => setShowLocationPermissionModal(false)}
            style={{ 
              borderRadius: 10, 
              padding: isMobile ? '0.75rem' : '0.75rem 1.5rem',
              fontWeight: 600,
              width: isMobile ? '100%' : 'auto',
              minWidth: isMobile ? 0 : 120
            }}
          >
            Cancel
          </Button>
          <Button 
            onClick={handleLocationPermissionConfirm}
            style={{ 
              background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
              border: 'none',
              borderRadius: 10,
              padding: isMobile ? '0.75rem' : '0.75rem 1.5rem',
              fontWeight: 600,
              width: isMobile ? '100%' : 'auto',
              minWidth: isMobile ? 0 : 120,
              boxShadow: '0 4px 12px rgba(16,185,129,0.3)',
              fontSize: isMobile ? '0.95rem' : '1rem'
            }}
          >
            <i className="fas fa-arrow-right me-2" />Continue
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default FieldVisits;

