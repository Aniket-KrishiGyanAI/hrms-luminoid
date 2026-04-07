import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Card, Row, Col, Badge, Button, Table, Form, InputGroup, Modal } from 'react-bootstrap';
import { MapContainer, TileLayer, Marker, Popup, Polyline, Circle, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import './JourneyManagerDashboard.css';
import api from '../utils/api';
import { toast } from 'react-toastify';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({ 
  iconRetinaUrl: require('leaflet/dist/images/marker-icon-2x.png'), 
  iconUrl: require('leaflet/dist/images/marker-icon.png'), 
  shadowUrl: require('leaflet/dist/images/marker-shadow.png') 
});

// Custom marker icons for different statuses
const createCustomIcon = (color, label) => {
  return L.divIcon({
    className: 'custom-marker',
    html: `
      <div style="
        background: ${color};
        width: 36px;
        height: 36px;
        border-radius: 50% 50% 50% 0;
        transform: rotate(-45deg);
        border: 3px solid white;
        box-shadow: 0 3px 10px rgba(0,0,0,0.3);
        display: flex;
        align-items: center;
        justify-content: center;
      ">
        <span style="
          transform: rotate(45deg);
          color: white;
          font-weight: bold;
          font-size: 12px;
        ">${label}</span>
      </div>
    `,
    iconSize: [36, 36],
    iconAnchor: [18, 36],
    popupAnchor: [0, -36]
  });
};

// Fly-to controller: pans+zooms the main map to a given position
const MapController = ({ flyTo }) => {
  const map = useMap();
  useEffect(() => {
    if (flyTo) map.flyTo(flyTo, 16, { animate: true, duration: 1.2 });
  }, [flyTo, map]);
  return null;
};

// Locate user button component
const LocateUserButton = () => {
  const map = useMap();
  const [locating, setLocating] = useState(false);
  const [tracking, setTracking] = useState(false);
  const [watchId, setWatchId] = useState(null);
  const [userMarker, setUserMarker] = useState(null);
  const [accuracyCircle, setAccuracyCircle] = useState(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (watchId) navigator.geolocation.clearWatch(watchId);
      if (userMarker) map.removeLayer(userMarker);
      if (accuracyCircle) map.removeLayer(accuracyCircle);
    };
  }, [watchId, userMarker, accuracyCircle, map]);

  const updateUserLocation = (latitude, longitude, accuracy) => {
    // Remove old marker and circle
    if (userMarker) map.removeLayer(userMarker);
    if (accuracyCircle) map.removeLayer(accuracyCircle);

    // Create new marker
    const marker = L.marker([latitude, longitude], {
      icon: L.divIcon({
        className: 'user-location-marker',
        html: `<div style="
          background: #3b82f6;
          width: 20px;
          height: 20px;
          border-radius: 50%;
          border: 4px solid white;
          box-shadow: 0 0 0 2px #3b82f6, 0 4px 12px rgba(59,130,246,0.5);
          animation: pulse-blue 2s infinite;
        "></div>`,
        iconSize: [20, 20],
        iconAnchor: [10, 10]
      })
    }).addTo(map);

    // Create accuracy circle
    const circle = L.circle([latitude, longitude], {
      radius: accuracy,
      color: '#3b82f6',
      fillColor: '#3b82f6',
      fillOpacity: 0.1,
      weight: 2
    }).addTo(map);

    setUserMarker(marker);
    setAccuracyCircle(circle);
  };

  const handleLocate = () => {
    if (tracking) {
      // Stop tracking
      if (watchId) navigator.geolocation.clearWatch(watchId);
      if (userMarker) map.removeLayer(userMarker);
      if (accuracyCircle) map.removeLayer(accuracyCircle);
      setWatchId(null);
      setUserMarker(null);
      setAccuracyCircle(null);
      setTracking(false);
      toast.info('Location tracking stopped');
      return;
    }

    // Start tracking
    if (!navigator.geolocation) {
      toast.error('Geolocation is not supported by your browser');
      return;
    }

    setLocating(true);

    // Get initial position and fly to it
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude, accuracy } = position.coords;
        map.flyTo([latitude, longitude], 16, { animate: true, duration: 1.2 });
        updateUserLocation(latitude, longitude, accuracy);
        setLocating(false);
        setTracking(true);
        toast.success('📍 Tracking your location');

        // Start continuous tracking
        const id = navigator.geolocation.watchPosition(
          (pos) => {
            const { latitude: lat, longitude: lng, accuracy: acc } = pos.coords;
            updateUserLocation(lat, lng, acc);
          },
          (error) => {
            console.error('Location tracking error:', error);
            let errorMsg = 'Location tracking error';
            switch(error.code) {
              case error.PERMISSION_DENIED:
                errorMsg = 'Location permission denied. Please enable location access in browser settings.';
                break;
              case error.POSITION_UNAVAILABLE:
                errorMsg = 'Location unavailable. Please check your GPS/internet connection.';
                break;
              case error.TIMEOUT:
                errorMsg = 'Location request timed out. Please try again.';
                break;
              default:
                errorMsg = 'Unable to get location. Error: ' + error.message;
            }
            toast.error(errorMsg);
            
            // Stop tracking on error
            if (watchId) navigator.geolocation.clearWatch(watchId);
            if (userMarker) map.removeLayer(userMarker);
            if (accuracyCircle) map.removeLayer(accuracyCircle);
            setWatchId(null);
            setUserMarker(null);
            setAccuracyCircle(null);
            setTracking(false);
          },
          { 
            enableHighAccuracy: true, 
            timeout: 30000, // Increased timeout to 30 seconds
            maximumAge: 5000 // Allow cached position up to 5 seconds old
          }
        );
        setWatchId(id);
      },
      (error) => {
        setLocating(false);
        let errorMsg = 'Unable to get your location';
        switch(error.code) {
          case error.PERMISSION_DENIED:
            errorMsg = 'Location permission denied. Please allow location access in your browser.';
            break;
          case error.POSITION_UNAVAILABLE:
            errorMsg = 'Location unavailable. Please enable GPS and check your internet connection.';
            break;
          case error.TIMEOUT:
            errorMsg = 'Location request timed out. Please try again.';
            break;
          default:
            errorMsg = 'Location error: ' + error.message;
        }
        toast.error(errorMsg, { autoClose: 5000 });
      },
      { 
        enableHighAccuracy: true, 
        timeout: 15000, // 15 seconds for initial position
        maximumAge: 0 
      }
    );
  };

  return (
    <div style={{
      position: 'absolute',
      top: 80,
      right: 10,
      zIndex: 1000,
      background: 'white',
      borderRadius: 10,
      boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
      overflow: 'hidden'
    }}>
      <button
        onClick={handleLocate}
        disabled={locating}
        title={tracking ? "Stop tracking my location" : "Track my location"}
        style={{
          width: 36,
          height: 36,
          border: 'none',
          background: tracking ? '#dbeafe' : (locating ? '#f0fdf4' : 'white'),
          color: tracking ? '#1e40af' : (locating ? '#10b981' : '#3b82f6'),
          cursor: locating ? 'wait' : 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '1.1rem',
          transition: 'all 0.2s',
          position: 'relative'
        }}
        onMouseEnter={(e) => !locating && !tracking && (e.currentTarget.style.background = '#f0f9ff')}
        onMouseLeave={(e) => !locating && !tracking && (e.currentTarget.style.background = 'white')}
      >
        {locating ? (
          <i className="fas fa-spinner fa-spin" />
        ) : tracking ? (
          <>
            <i className="fas fa-location-dot" />
            <div style={{
              position: 'absolute',
              top: 2,
              right: 2,
              width: 8,
              height: 8,
              background: '#10b981',
              borderRadius: '50%',
              border: '1px solid white',
              animation: 'pulse 2s infinite'
            }} />
          </>
        ) : (
          <i className="fas fa-location-crosshairs" />
        )}
      </button>
    </div>
  );
};

// Auto-fit bounds for route modal map
const FitBounds = ({ positions }) => {
  const map = useMap();
  useEffect(() => {
    if (positions?.length > 1) {
      map.fitBounds(L.latLngBounds(positions), { padding: [40, 40] });
    }
  }, [positions, map]);
  return null;
};

const JourneyManagerDashboard = () => {
  const [activeJourneys, setActiveJourneys] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedJourney, setSelectedJourney] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [showRouteModal, setShowRouteModal] = useState(false);
  const [selectedRoute, setSelectedRoute] = useState(null);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [mapView, setMapView] = useState('all');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [flyTo, setFlyTo] = useState(null);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000); // Refresh every 30 seconds
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => {
      clearInterval(interval);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  const fetchData = async () => {
    try {
      const [activeRes, analyticsRes, attendanceRes] = await Promise.all([
        api.get('/api/journey/active'),
        api.get('/api/journey/analytics'),
        api.get('/api/attendance/today-all').catch(() => ({ data: [] }))
      ]);
      
      console.log('Active journeys:', activeRes.data);
      console.log('Attendance data:', attendanceRes.data);
      
      setActiveJourneys(activeRes.data);
      setAnalytics(analyticsRes.data);
      
      // Merge attendance data for employees who checked in but haven't started journey
      const journeyEmployeeIds = new Set(activeRes.data.map(j => j.employeeId?._id));
      const attendanceWithoutJourney = (attendanceRes.data || [])
        .filter(att => {
          const isFieldEmp = att.userId?.isFieldEmployee;
          const hasCheckedIn = att.checkIn;
          const notInJourney = !journeyEmployeeIds.has(att.userId?._id);
          const hasLocation = att.checkInLocation?.lat && att.checkInLocation?.lng;
          
          console.log('Checking attendance:', {
            name: `${att.userId?.firstName} ${att.userId?.lastName}`,
            isFieldEmp,
            hasCheckedIn,
            notInJourney,
            hasLocation,
            location: att.checkInLocation
          });
          
          return isFieldEmp && hasCheckedIn && notInJourney && hasLocation;
        })
        .map(att => ({
          _id: `att-${att._id}`,
          employeeId: att.userId,
          status: 'CHECKED_IN',
          totalDistanceKm: 0,
          avgSpeedKmh: 0,
          maxSpeedKmh: 0,
          locationPoints: [],
          lastLocation: att.checkInLocation,
          lastUpdateMinutesAgo: att.checkIn ? Math.round((new Date() - new Date(att.checkIn)) / 60000) : null,
          batteryLevels: [],
          isAttendanceOnly: true
        }));
      
      console.log('Attendance without journey:', attendanceWithoutJourney);
      
      setActiveJourneys([...activeRes.data, ...attendanceWithoutJourney]);
    } catch (err) {
      console.error('Fetch data error:', err);
      toast.error('Failed to load journey data');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'ACTIVE': return '#10b981';
      case 'PAUSED': return '#f59e0b';
      case 'CHECKED_IN': return '#3b82f6';
      default: return '#6b7280';
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'ACTIVE': return 'success';
      case 'PAUSED': return 'warning';
      case 'CHECKED_IN': return 'info';
      default: return 'secondary';
    }
  };

  // Filter journeys based on search and status
  const filteredJourneys = activeJourneys.filter(journey => {
    const matchesSearch = searchTerm === '' || 
      `${journey.employeeId?.firstName} ${journey.employeeId?.lastName}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
      journey.employeeId?.department?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === 'ALL' || journey.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  const flyToEmployee = (journey) => {
    if (!journey.lastLocation) {
      toast.warn('No GPS location available yet. Employee needs to wait for first GPS ping.');
      return;
    }
    setSelectedJourney(journey);
    setMapView('selected');
    setFlyTo([journey.lastLocation.lat, journey.lastLocation.lng]);
    setTimeout(() => setFlyTo(null), 2000);
  };

  const viewEmployeeRoute = async (journey) => {
    if (!journey.locationPoints || journey.locationPoints.length === 0) {
      toast.warn('No GPS points recorded yet. Employee needs to wait for location tracking.');
      return;
    }
    try {
      const res = await api.get(`/api/journey/${journey._id}`);
      if (!res.data.locationPoints || res.data.locationPoints.length === 0) {
        toast.warn('No route data available yet. GPS tracking in progress...');
        return;
      }
      setSelectedRoute(res.data);
      setShowRouteModal(true);
    } catch (err) {
      toast.error('Failed to load route details');
    }
  };

  const getMarkerColor = (journey) => {
    if (journey.status === 'ACTIVE') return '#10b981';
    if (journey.status === 'PAUSED') return '#f59e0b';
    return '#6b7280';
  };

  const getEmployeeInitials = (employee) => {
    if (!employee) return '?';
    return `${employee.firstName?.[0] || ''}${employee.lastName?.[0] || ''}`;
  };

  if (loading) return (
    <div className="d-flex justify-content-center align-items-center" style={{ height: '60vh' }}>
      <div className="spinner-border" style={{ color: '#10b981' }} />
    </div>
  );

  const defaultCenter = activeJourneys.length > 0 && activeJourneys[0].lastLocation
    ? [activeJourneys[0].lastLocation.lat, activeJourneys[0].lastLocation.lng]
    : [28.6139, 77.2090]; // Delhi default

  return (
    <div className="fade-in-up pb-5" style={{ background: 'linear-gradient(to bottom, #f9fafb 0%, #ffffff 100%)', minHeight: '100vh' }}>
      {/* Professional Header */}
      <div style={{ 
        background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
        padding: isMobile ? '1.5rem 1rem' : '2rem 1.5rem',
        marginBottom: '1.5rem',
        borderRadius: isMobile ? '0 0 20px 20px' : '0 0 24px 24px',
        boxShadow: '0 4px 20px rgba(16,185,129,0.2)'
      }}>
        <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
          <div className="d-flex justify-content-between align-items-center" style={{ marginBottom: '1rem', flexWrap: 'wrap', gap: '1rem' }}>
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
                Live Journey Tracker
              </h1>
              <p style={{ color: 'rgba(255,255,255,0.9)', fontSize: isMobile ? '0.85rem' : '0.95rem', marginBottom: 0 }}>
                Real-time tracking of {filteredJourneys.length} field employee{filteredJourneys.length !== 1 ? 's' : ''}
              </p>
            </div>
            <Button 
              onClick={fetchData}
              style={{
                background: 'rgba(255,255,255,0.2)',
                backdropFilter: 'blur(10px)',
                border: '1px solid rgba(255,255,255,0.3)',
                color: '#fff',
                borderRadius: 10,
                padding: '0.75rem 1.5rem',
                fontWeight: 600
              }}
            >
              <i className="fas fa-sync-alt me-2" />
              Refresh
            </Button>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: '1400px', margin: '0 auto', padding: isMobile ? '0 0.5rem' : '0 1rem' }}>

      {/* Summary Stats */}
      <Row className="g-3 mb-4">
        {[
          { label: 'Active Now', value: activeJourneys.filter(j => j.status === 'ACTIVE').length, icon: 'route', color: '#10b981', bg: 'linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%)' },
          { label: 'Paused', value: activeJourneys.filter(j => j.status === 'PAUSED').length, icon: 'pause-circle', color: '#f59e0b', bg: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)' },
          { label: 'Checked In', value: activeJourneys.filter(j => j.status === 'CHECKED_IN').length, icon: 'user-check', color: '#3b82f6', bg: 'linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%)' },
          { label: 'Total Distance', value: `${activeJourneys.reduce((s, j) => s + (j.totalDistanceKm || 0), 0).toFixed(1)} km`, icon: 'road', color: '#8b5cf6', bg: 'linear-gradient(135deg, #ede9fe 0%, #ddd6fe 100%)' },
        ].map((s, i) => (
          <Col xs={6} md={3} key={i}>
            <Card style={{ 
              borderRadius: 14, 
              border: 'none', 
              background: s.bg,
              boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
              overflow: 'hidden',
              position: 'relative'
            }}>
              <Card.Body className="text-center" style={{ padding: isMobile ? '1rem' : '1.25rem' }}>
                <div style={{
                  width: isMobile ? 48 : 56,
                  height: isMobile ? 48 : 56,
                  borderRadius: 12,
                  background: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 0.75rem',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                }}>
                  <i className={`fas fa-${s.icon}`} style={{ color: s.color, fontSize: isMobile ? '1.5rem' : '1.75rem' }} />
                </div>
                <div style={{ fontSize: isMobile ? '1.5rem' : '1.75rem', fontWeight: 700, color: '#1e293b', marginBottom: '0.25rem' }}>{s.value}</div>
                <div style={{ fontSize: isMobile ? '0.75rem' : '0.8rem', color: '#64748b', fontWeight: 600 }}>{s.label}</div>
              </Card.Body>
            </Card>
          </Col>
        ))}
      </Row>

      {/* Search and Filter Bar */}
      <Card className="mb-4" style={{ borderRadius: 14, border: 'none', boxShadow: '0 2px 12px rgba(0,0,0,0.08)' }}>
        <Card.Body style={{ padding: isMobile ? '1rem' : '1.25rem' }}>
          <Row className="g-3 align-items-center">
            <Col md={6}>
              <InputGroup>
                <InputGroup.Text style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px 0 0 10px' }}>
                  <i className="fas fa-search" style={{ color: '#64748b' }} />
                </InputGroup.Text>
                <Form.Control
                  type="text"
                  placeholder="Search by employee name or department..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  style={{ border: '1px solid #e2e8f0', borderLeft: 'none', borderRadius: '0 10px 10px 0' }}
                />
              </InputGroup>
            </Col>
            <Col md={3}>
              <Form.Select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                style={{ borderRadius: 10, border: '1px solid #e2e8f0' }}
              >
                <option value="ALL">All Status</option>
                <option value="ACTIVE">Active</option>
                <option value="PAUSED">Paused</option>
              </Form.Select>
            </Col>
            <Col md={3}>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <Button
                  variant={mapView === 'all' ? 'success' : 'outline-secondary'}
                  onClick={() => setMapView('all')}
                  style={{ flex: 1, borderRadius: 10, fontSize: '0.85rem', fontWeight: 600 }}
                >
                  <i className="fas fa-users me-1" />
                  All
                </Button>
                <Button
                  variant={mapView === 'selected' ? 'success' : 'outline-secondary'}
                  onClick={() => setMapView('selected')}
                  disabled={!selectedJourney}
                  style={{ flex: 1, borderRadius: 10, fontSize: '0.85rem', fontWeight: 600 }}
                >
                  <i className="fas fa-user me-1" />
                  Selected
                </Button>
              </div>
            </Col>
          </Row>
        </Card.Body>
      </Card>

      {/* Live Map */}
      <Card className="mb-4" style={{ borderRadius: 16, border: 'none', boxShadow: '0 8px 32px rgba(0,0,0,0.12)', overflow: 'hidden', position: isFullscreen ? 'fixed' : 'relative', top: isFullscreen ? 0 : 'auto', left: isFullscreen ? 0 : 'auto', right: isFullscreen ? 0 : 'auto', bottom: isFullscreen ? 0 : 'auto', zIndex: isFullscreen ? 9999 : 'auto', margin: isFullscreen ? 0 : 'auto' }}>
        <Card.Body style={{ padding: 0, height: isFullscreen ? '100vh' : 'auto', display: 'flex', flexDirection: 'column' }}>
          <div style={{ 
            padding: isMobile ? '1rem' : '1.5rem', 
            borderBottom: '2px solid #e5e7eb', 
            background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: isMobile ? '1.1rem' : '1.3rem', color: '#fff', marginBottom: '0.25rem' }}>
                  <i className="fas fa-map-location-dot me-2" />
                  Live Journey Map
                </div>
                <div style={{ fontSize: isMobile ? '0.8rem' : '0.85rem', color: 'rgba(255,255,255,0.9)' }}>
                  <i className="fas fa-circle" style={{ fontSize: '0.5rem', marginRight: '0.5rem', animation: 'pulse 2s infinite' }} />
                  Tracking {filteredJourneys.length} employee{filteredJourneys.length !== 1 ? 's' : ''} in real-time
                </div>
              </div>
              <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                <div style={{
                  background: 'rgba(255,255,255,0.2)',
                  backdropFilter: 'blur(10px)',
                  padding: '0.5rem 1rem',
                  borderRadius: 10,
                  border: '1px solid rgba(255,255,255,0.3)',
                  fontSize: '0.8rem',
                  color: '#fff',
                  fontWeight: 600
                }}>
                  <i className="fas fa-sync-alt me-2" />
                  Auto-refresh: 30s
                </div>
                <button
                  onClick={() => setIsFullscreen(f => !f)}
                  style={{
                    background: 'rgba(255,255,255,0.2)',
                    backdropFilter: 'blur(10px)',
                    padding: '0.5rem 1rem',
                    borderRadius: 10,
                    border: '1px solid rgba(255,255,255,0.3)',
                    fontSize: '0.8rem',
                    color: '#fff',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  <i className={`fas fa-${isFullscreen ? 'compress-alt' : 'expand-alt'} me-2`} />
                  {isFullscreen ? 'Collapse' : 'Expand'}
                </button>
              </div>
            </div>
          </div>
          
          {/* Map Legend */}
          <div style={{ 
            padding: isMobile ? '0.75rem 1rem' : '1rem 1.5rem', 
            background: '#f8fafc',
            borderBottom: '1px solid #e5e7eb',
            display: 'flex',
            gap: isMobile ? '1rem' : '2rem',
            flexWrap: 'wrap',
            alignItems: 'center'
          }}>
            <div style={{ fontSize: isMobile ? '0.75rem' : '0.8rem', fontWeight: 600, color: '#64748b' }}>
              Legend:
            </div>
            {[
              { color: '#10b981', label: 'Active Journey', icon: 'circle' },
              { color: '#f59e0b', label: 'Paused', icon: 'circle' },
              { color: '#3b82f6', label: 'Checked In (No Journey)', icon: 'circle' },
              { color: '#6b7280', label: 'Inactive', icon: 'circle' }
            ].map((item, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <div style={{
                  width: 16,
                  height: 16,
                  borderRadius: '50%',
                  background: item.color,
                  border: '2px solid white',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                }} />
                <span style={{ fontSize: isMobile ? '0.75rem' : '0.8rem', color: '#64748b', fontWeight: 500 }}>
                  {item.label}
                </span>
              </div>
            ))}
          </div>

          <div style={{ 
            height: isFullscreen ? 'calc(100vh - 180px)' : (isMobile ? 450 : 600), 
            position: 'relative', 
            background: '#f1f5f9',
            transition: 'height 0.3s ease',
            flex: isFullscreen ? 1 : 'none'
          }}>
            {filteredJourneys.length > 0 ? (
              <MapContainer 
                center={defaultCenter} 
                zoom={12} 
                style={{ height: '100%', width: '100%', zIndex: 1 }}
                zoomControl={true}
              >
                <TileLayer 
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" 
                  attribution="© OpenStreetMap contributors" 
                />
                <MapController flyTo={flyTo} />
                <LocateUserButton />
                {(mapView === 'all' ? filteredJourneys : selectedJourney ? [selectedJourney] : []).map((journey, idx) => {
                  // Skip if no location data at all
                  if (!journey.lastLocation || !journey.lastLocation.lat || !journey.lastLocation.lng) {
                    console.log('Skipping employee (no location):', journey.employeeId?.firstName, journey.employeeId?.lastName, 'Status:', journey.status);
                    return null;
                  }
                  
                  const { lat, lng } = journey.lastLocation;
                  const initials = getEmployeeInitials(journey.employeeId);
                  const color = getMarkerColor(journey);
                  const isSelected = selectedJourney?._id === journey._id;
                  
                  return (
                    <React.Fragment key={journey._id}>
                      {/* Pulsing Circle for Active Journeys */}
                      {journey.status === 'ACTIVE' && (
                        <Circle
                          center={[lat, lng]}
                          radius={100}
                          pathOptions={{
                            color: color,
                            fillColor: color,
                            fillOpacity: 0.15,
                            weight: 2,
                            opacity: 0.6
                          }}
                        />
                      )}
                      
                      {/* Accuracy Circle */}
                      <Circle
                        center={[lat, lng]}
                        radius={30}
                        pathOptions={{
                          color: color,
                          fillColor: color,
                          fillOpacity: isSelected ? 0.3 : 0.15,
                          weight: isSelected ? 3 : 1,
                          opacity: isSelected ? 1 : 0.5
                        }}
                      />
                      
                      {/* Custom Marker */}
                      <Marker 
                        position={[lat, lng]}
                        icon={createCustomIcon(color, initials)}
                        eventHandlers={{
                          click: () => {
                            setSelectedJourney(journey);
                            setMapView('selected');
                          }
                        }}
                      >
                        <Popup maxWidth={280} className="custom-popup">
                          <div style={{ padding: '0.5rem' }}>
                            {/* Employee Header */}
                            <div style={{ 
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.75rem',
                              marginBottom: '1rem',
                              paddingBottom: '0.75rem',
                              borderBottom: '2px solid #e5e7eb'
                            }}>
                              <div style={{
                                width: 48,
                                height: 48,
                                borderRadius: 12,
                                background: `linear-gradient(135deg, ${color} 0%, ${color}dd 100%)`,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: '#fff',
                                fontSize: '1.2rem',
                                fontWeight: 700,
                                boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
                              }}>
                                {initials}
                              </div>
                              <div style={{ flex: 1 }}>
                                <div style={{ fontWeight: 700, fontSize: '1rem', color: '#1e293b', marginBottom: '0.15rem' }}>
                                  {journey.employeeId?.firstName} {journey.employeeId?.lastName}
                                </div>
                                <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                                  {journey.employeeId?.department || 'N/A'}
                                </div>
                              </div>
                              <Badge 
                                bg={getStatusBadge(journey.status)} 
                                style={{ 
                                  fontSize: '0.7rem',
                                  padding: '0.35rem 0.6rem',
                                  borderRadius: 6
                                }}
                              >
                                {journey.status === 'CHECKED_IN' ? 'Checked In' : journey.status}
                              </Badge>
                            </div>
                            
                            {journey.isAttendanceOnly ? (
                              <div style={{ 
                                background: 'linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%)',
                                padding: '1rem',
                                borderRadius: 8,
                                border: '1px solid #93c5fd',
                                textAlign: 'center',
                                marginBottom: '1rem'
                              }}>
                                <i className="fas fa-info-circle" style={{ color: '#1e40af', fontSize: '1.5rem', marginBottom: '0.5rem', display: 'block' }} />
                                <div style={{ fontSize: '0.85rem', color: '#1e40af', fontWeight: 600 }}>
                                  Employee has checked in but hasn't started journey yet
                                </div>
                                <div style={{ fontSize: '0.75rem', color: '#1e40af', marginTop: '0.25rem' }}>
                                  Showing check-in location
                                </div>
                              </div>
                            ) : (
                              <>
                                {/* Journey Stats Grid */}
                                <div style={{ 
                                  display: 'grid', 
                                  gridTemplateColumns: '1fr 1fr', 
                                  gap: '0.75rem',
                                  marginBottom: '1rem'
                                }}>
                                  <div style={{
                                    background: 'linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%)',
                                    padding: '0.75rem',
                                    borderRadius: 8,
                                    border: '1px solid #a7f3d0'
                                  }}>
                                    <div style={{ fontSize: '0.7rem', color: '#065f46', marginBottom: '0.25rem', fontWeight: 600 }}>
                                      <i className="fas fa-road me-1" />Distance
                                    </div>
                                    <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#059669' }}>
                                      {journey.totalDistanceKm} km
                                    </div>
                                  </div>
                                  
                                  <div style={{
                                    background: 'linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%)',
                                    padding: '0.75rem',
                                    borderRadius: 8,
                                    border: '1px solid #93c5fd'
                                  }}>
                                    <div style={{ fontSize: '0.7rem', color: '#1e40af', marginBottom: '0.25rem', fontWeight: 600 }}>
                                      <i className="fas fa-tachometer-alt me-1" />Avg Speed
                                    </div>
                                    <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#2563eb' }}>
                                      {journey.avgSpeedKmh} km/h
                                    </div>
                                  </div>
                                  
                                  <div style={{
                                    background: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)',
                                    padding: '0.75rem',
                                    borderRadius: 8,
                                    border: '1px solid #fcd34d'
                                  }}>
                                    <div style={{ fontSize: '0.7rem', color: '#92400e', marginBottom: '0.25rem', fontWeight: 600 }}>
                                      <i className="fas fa-clock me-1" />Last Update
                                    </div>
                                    <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#d97706' }}>
                                      {journey.lastUpdateMinutesAgo ? `${journey.lastUpdateMinutesAgo}m ago` : 'Now'}
                                    </div>
                                  </div>
                                  
                                  <div style={{
                                    background: 'linear-gradient(135deg, #f3e8ff 0%, #e9d5ff 100%)',
                                    padding: '0.75rem',
                                    borderRadius: 8,
                                    border: '1px solid #d8b4fe'
                                  }}>
                                    <div style={{ fontSize: '0.7rem', color: '#6b21a8', marginBottom: '0.25rem', fontWeight: 600 }}>
                                      <i className="fas fa-map-pin me-1" />GPS Points
                                    </div>
                                    <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#7c3aed' }}>
                                      {journey.locationPoints?.length || 0}
                                    </div>
                                  </div>
                                </div>
                                
                                {/* Action Button */}
                                {!journey.isAttendanceOnly && (
                                  <Button
                                    onClick={() => viewEmployeeRoute(journey)}
                                    disabled={!journey.locationPoints || journey.locationPoints.length === 0}
                                    style={{
                                      width: '100%',
                                      background: journey.locationPoints?.length > 0 
                                        ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
                                        : '#e5e7eb',
                                      border: 'none',
                                      borderRadius: 8,
                                      padding: '0.75rem',
                                      fontSize: '0.85rem',
                                      fontWeight: 600,
                                      boxShadow: journey.locationPoints?.length > 0 ? '0 4px 12px rgba(16,185,129,0.3)' : 'none',
                                      transition: 'all 0.3s ease',
                                      cursor: journey.locationPoints?.length > 0 ? 'pointer' : 'not-allowed',
                                      color: journey.locationPoints?.length > 0 ? '#fff' : '#9ca3af'
                                    }}
                                  >
                                    <i className="fas fa-route me-2" />
                                    {journey.locationPoints?.length > 0 ? 'View Full Route' : 'No GPS Data Yet'}
                                  </Button>
                                )}
                              </>
                            )}
                          </div>
                        </Popup>
                      </Marker>
                    </React.Fragment>
                  );
                })}
              </MapContainer>
            ) : (
              <div className="d-flex align-items-center justify-content-center" style={{ height: '100%', background: 'linear-gradient(135deg, #f9fafb 0%, #f3f4f6 100%)' }}>
                <div className="text-center" style={{ padding: '3rem' }}>
                  <div style={{
                    width: 100,
                    height: 100,
                    background: 'linear-gradient(135deg, #e5e7eb 0%, #d1d5db 100%)',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto 1.5rem'
                  }}>
                    <i className="fas fa-map-marked-alt" style={{ fontSize: '2.5rem', color: '#9ca3af' }} />
                  </div>
                  <h5 style={{ fontWeight: 700, color: '#1e293b', marginBottom: '0.5rem' }}>No Location Data Available</h5>
                  <p style={{ color: '#64748b', marginBottom: 0 }}>Employees will appear here once GPS location is captured</p>
                  {filteredJourneys.length > 0 && (
                    <div style={{ marginTop: '1rem', padding: '1rem', background: '#fef3c7', borderRadius: 10, border: '1px solid #fcd34d' }}>
                      <div style={{ fontSize: '0.85rem', color: '#92400e', fontWeight: 600 }}>
                        <i className="fas fa-info-circle me-2" />
                        {filteredJourneys.length} employee{filteredJourneys.length > 1 ? 's' : ''} active but waiting for GPS data
                      </div>
                      <div style={{ fontSize: '0.75rem', color: '#92400e', marginTop: '0.5rem' }}>
                        GPS pings every 60 seconds. Please wait...
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </Card.Body>
      </Card>

      {/* Active Journeys Table */}
      <Card style={{ borderRadius: 16, border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }}>
        <Card.Body style={{ padding: isMobile ? '1rem' : '1.25rem' }}>
          <div style={{ fontWeight: 700, fontSize: isMobile ? '1rem' : '1.1rem', color: '#1e293b', marginBottom: '1rem' }}>
            <i className="fas fa-users me-2" style={{ color: '#10b981' }} />
            Field Employees
            <Badge bg="primary" className="ms-2" style={{ fontSize: '0.75rem' }}>
              {filteredJourneys.length} of {activeJourneys.length}
            </Badge>
          </div>

          {filteredJourneys.length === 0 ? (
            <div className="text-center py-4" style={{ color: '#94a3b8' }}>
              <i className="fas fa-route" style={{ fontSize: '2rem', marginBottom: 8, display: 'block' }} />
              No active journeys today
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <Table hover responsive style={{ marginBottom: 0 }}>
                <thead style={{ background: '#f8fafc', borderBottom: '2px solid #e5e7eb' }}>
                  <tr>
                    <th style={{ fontWeight: 600, fontSize: '0.8rem', color: '#64748b', padding: '0.75rem' }}>Employee</th>
                    <th style={{ fontWeight: 600, fontSize: '0.8rem', color: '#64748b', padding: '0.75rem' }}>Status</th>
                    <th style={{ fontWeight: 600, fontSize: '0.8rem', color: '#64748b', padding: '0.75rem' }}>Distance</th>
                    <th style={{ fontWeight: 600, fontSize: '0.8rem', color: '#64748b', padding: '0.75rem' }}>Avg Speed</th>
                    <th style={{ fontWeight: 600, fontSize: '0.8rem', color: '#64748b', padding: '0.75rem' }}>Max Speed</th>
                    <th style={{ fontWeight: 600, fontSize: '0.8rem', color: '#64748b', padding: '0.75rem' }}>GPS Points</th>
                    <th style={{ fontWeight: 600, fontSize: '0.8rem', color: '#64748b', padding: '0.75rem' }}>Last Update</th>
                    <th style={{ fontWeight: 600, fontSize: '0.8rem', color: '#64748b', padding: '0.75rem' }}>Battery</th>
                    <th style={{ fontWeight: 600, fontSize: '0.8rem', color: '#64748b', padding: '0.75rem' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredJourneys.map((journey) => (
                    <tr 
                      key={journey._id} 
                      style={{ 
                        cursor: 'pointer',
                        background: selectedJourney?._id === journey._id ? '#f0fdf4' : 'transparent',
                        transition: 'all 0.2s ease'
                      }} 
                      onClick={() => {
                        setSelectedJourney(journey);
                        setMapView('selected');
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.background = '#f8fafc'}
                      onMouseLeave={(e) => e.currentTarget.style.background = selectedJourney?._id === journey._id ? '#f0fdf4' : 'transparent'}
                    >
                      <td style={{ padding: '0.875rem', verticalAlign: 'middle' }}>
                        <div style={{ fontWeight: 600, fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          {journey.employeeId?.firstName} {journey.employeeId?.lastName}
                          {(!journey.lastLocation || !journey.lastLocation.lat) && journey.status !== 'CHECKED_IN' && (
                            <span 
                              title="Waiting for GPS data - First ping in progress"
                              style={{ 
                                fontSize: '0.7rem', 
                                background: journey.status === 'ACTIVE' ? '#dbeafe' : '#fef3c7',
                                color: journey.status === 'ACTIVE' ? '#1e40af' : '#92400e',
                                padding: '0.15rem 0.4rem', 
                                borderRadius: 4,
                                fontWeight: 600,
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.25rem'
                              }}
                            >
                              {journey.status === 'ACTIVE' ? (
                                <>
                                  <i className="fas fa-spinner fa-spin" />
                                  Locating...
                                </>
                              ) : (
                                <>
                                  <i className="fas fa-satellite-dish" />
                                  No GPS
                                </>
                              )}
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                          {journey.employeeId?.department}
                        </div>
                      </td>
                      <td style={{ padding: '0.875rem', verticalAlign: 'middle' }}>
                        <Badge bg={getStatusBadge(journey.status)} style={{ fontSize: '0.7rem' }}>
                          {journey.status}
                        </Badge>
                      </td>
                      <td style={{ padding: '0.875rem', verticalAlign: 'middle' }}>
                        <span style={{ fontWeight: 700, color: '#10b981' }}>{journey.totalDistanceKm} km</span>
                      </td>
                      <td style={{ padding: '0.875rem', verticalAlign: 'middle' }}>
                        {journey.avgSpeedKmh || 0} km/h
                      </td>
                      <td style={{ padding: '0.875rem', verticalAlign: 'middle' }}>
                        {journey.maxSpeedKmh || 0} km/h
                      </td>
                      <td style={{ padding: '0.875rem', verticalAlign: 'middle' }}>
                        {journey.locationPoints?.length || 0}
                      </td>
                      <td style={{ padding: '0.875rem', verticalAlign: 'middle' }}>
                        <span style={{ fontSize: '0.8rem', color: journey.lastUpdateMinutesAgo > 5 ? '#ef4444' : '#6b7280' }}>
                          {journey.lastUpdateMinutesAgo ? `${journey.lastUpdateMinutesAgo} min ago` : 'Just now'}
                        </span>
                      </td>
                      <td style={{ padding: '0.875rem', verticalAlign: 'middle' }}>
                        {journey.batteryLevels?.length > 0 ? (
                          <span style={{ 
                            fontSize: '0.8rem', 
                            color: journey.batteryLevels[journey.batteryLevels.length - 1].level < 20 ? '#ef4444' : '#10b981' 
                          }}>
                            <i className="fas fa-battery-three-quarters me-1" />
                            {journey.batteryLevels[journey.batteryLevels.length - 1].level}%
                          </span>
                        ) : '—'}
                      </td>
                      <td style={{ padding: '0.875rem', verticalAlign: 'middle' }} onClick={e => e.stopPropagation()}>
                        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                          <button
                            onClick={() => flyToEmployee(journey)}
                            title={journey.lastLocation ? "Fly to on map" : "No GPS location yet"}
                            disabled={!journey.lastLocation}
                            style={{
                              background: journey.lastLocation ? '#dbeafe' : '#f1f5f9',
                              border: 'none',
                              borderRadius: 7,
                              padding: '0.35rem 0.6rem',
                              cursor: journey.lastLocation ? 'pointer' : 'not-allowed',
                              color: journey.lastLocation ? '#2563eb' : '#94a3b8',
                              fontSize: '0.8rem',
                              opacity: journey.lastLocation ? 1 : 0.5
                            }}
                          >
                            <i className="fas fa-crosshairs" />
                          </button>
                          <button
                            onClick={() => viewEmployeeRoute(journey)}
                            title={journey.locationPoints?.length > 0 ? "View full route" : "No GPS points yet"}
                            disabled={!journey.locationPoints || journey.locationPoints.length === 0}
                            style={{
                              background: journey.locationPoints?.length > 0 ? '#d1fae5' : '#f1f5f9',
                              border: 'none',
                              borderRadius: 7,
                              padding: '0.35rem 0.6rem',
                              cursor: journey.locationPoints?.length > 0 ? 'pointer' : 'not-allowed',
                              color: journey.locationPoints?.length > 0 ? '#059669' : '#94a3b8',
                              fontSize: '0.8rem',
                              opacity: journey.locationPoints?.length > 0 ? 1 : 0.5
                            }}
                          >
                            <i className="fas fa-route" />
                          </button>
                          {!journey.isAttendanceOnly && journey.status === 'ACTIVE' && (!journey.locationPoints || journey.locationPoints.length === 0) && (
                            <button
                              onClick={() => {
                                const msg = `📍 REMINDER: ${journey.employeeId?.firstName}, please open the Journey page to enable GPS tracking.\n\nSteps:\n1. Open Journey page in browser\n2. Keep the page open\n3. Allow location permission\n4. GPS will ping every 60 seconds`;
                                if (navigator.clipboard) {
                                  navigator.clipboard.writeText(msg);
                                  toast.success('Reminder message copied! Send it to the employee.');
                                } else {
                                  alert(msg);
                                }
                              }}
                              title="Copy reminder message for employee"
                              style={{
                                background: '#fef3c7',
                                border: 'none',
                                borderRadius: 7,
                                padding: '0.35rem 0.6rem',
                                cursor: 'pointer',
                                color: '#92400e',
                                fontSize: '0.8rem'
                              }}
                            >
                              <i className="fas fa-bell" />
                            </button>
                          )}
                          {!journey.isAttendanceOnly && (
                            <button
                              onClick={async () => {
                                if (window.confirm(`Reset journey for ${journey.employeeId?.firstName} ${journey.employeeId?.lastName}? This will delete all GPS data.`)) {
                                  try {
                                    await api.delete(`/api/journey/${journey._id}`);
                                    toast.success('Journey reset successfully');
                                    fetchData();
                                  } catch (err) {
                                    toast.error('Failed to reset journey');
                                  }
                                }
                              }}
                              title="Reset journey"
                              style={{
                                background: '#fee2e2',
                                border: 'none',
                                borderRadius: 7,
                                padding: '0.35rem 0.6rem',
                                cursor: 'pointer',
                                color: '#dc2626',
                                fontSize: '0.8rem'
                              }}
                            >
                              <i className="fas fa-redo" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>
          )}
        </Card.Body>
      </Card>

      {/* Analytics Section */}
      {analytics && (
        <Card className="mt-3" style={{ borderRadius: 14, border: 'none', boxShadow: '0 2px 12px rgba(0,0,0,0.08)' }}>
          <Card.Body style={{ padding: '1.25rem' }}>
            <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#1e293b', marginBottom: '1rem' }}>
              <i className="fas fa-chart-line me-2" style={{ color: '#10b981' }} />
              30-Day Analytics
            </div>

            <Row className="g-3 mb-3">
              {[
                { label: 'Total Journeys', value: analytics.summary.totalJourneys, icon: 'route' },
                { label: 'Total Distance', value: `${analytics.summary.totalDistance} km`, icon: 'road' },
                { label: 'Avg Distance', value: `${analytics.summary.avgDistance} km`, icon: 'chart-bar' },
                { label: 'Active Employees', value: analytics.summary.totalEmployees, icon: 'users' },
              ].map((s, i) => (
                <Col xs={6} md={3} key={i}>
                  <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 10, padding: '0.75rem', textAlign: 'center' }}>
                    <i className={`fas fa-${s.icon}`} style={{ color: '#10b981', fontSize: '1rem', marginBottom: 4, display: 'block' }} />
                    <div style={{ fontWeight: 800, fontSize: '1.1rem', color: '#1e293b' }}>{s.value}</div>
                    <div style={{ fontSize: '0.7rem', color: '#6b7280' }}>{s.label}</div>
                  </div>
                </Col>
              ))}
            </Row>

            {/* Top Performers */}
            <div style={{ fontWeight: 600, fontSize: '0.85rem', color: '#1e293b', marginBottom: '0.75rem' }}>
              🏆 Top Performers (Last 30 Days)
            </div>
            <div style={{ overflowX: 'auto' }}>
              <Table size="sm" style={{ marginBottom: 0 }}>
                <thead style={{ background: '#f8fafc' }}>
                  <tr>
                    <th style={{ fontWeight: 600, fontSize: '0.75rem', padding: '0.5rem' }}>Rank</th>
                    <th style={{ fontWeight: 600, fontSize: '0.75rem', padding: '0.5rem' }}>Employee</th>
                    <th style={{ fontWeight: 600, fontSize: '0.75rem', padding: '0.5rem' }}>Total Distance</th>
                    <th style={{ fontWeight: 600, fontSize: '0.75rem', padding: '0.5rem' }}>Journeys</th>
                    <th style={{ fontWeight: 600, fontSize: '0.75rem', padding: '0.5rem' }}>Avg Speed</th>
                  </tr>
                </thead>
                <tbody>
                  {analytics.topPerformers.slice(0, 5).map((perf, idx) => (
                    <tr key={idx}>
                      <td style={{ padding: '0.5rem', fontSize: '0.8rem' }}>
                        {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `#${idx + 1}`}
                      </td>
                      <td style={{ padding: '0.5rem', fontSize: '0.8rem', fontWeight: 600 }}>
                        {perf.employee?.firstName} {perf.employee?.lastName}
                      </td>
                      <td style={{ padding: '0.5rem', fontSize: '0.8rem', color: '#10b981', fontWeight: 700 }}>
                        {perf.totalDistance.toFixed(1)} km
                      </td>
                      <td style={{ padding: '0.5rem', fontSize: '0.8rem' }}>
                        {perf.journeyCount}
                      </td>
                      <td style={{ padding: '0.5rem', fontSize: '0.8rem' }}>
                        {Math.round(perf.avgSpeed)} km/h
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>
          </Card.Body>
        </Card>
      )}

      {/* Route Details Modal */}
      <Modal show={showRouteModal} onHide={() => setShowRouteModal(false)} size="xl" centered>
        <Modal.Header closeButton style={{ background: 'linear-gradient(135deg, #10b981, #059669)', color: '#fff', border: 'none' }}>
          <Modal.Title style={{ color: '#fff', fontWeight: 700 }}>
            <i className="fas fa-route me-2" />
            {selectedRoute?.employeeId?.firstName} {selectedRoute?.employeeId?.lastName} — Journey Route
          </Modal.Title>
        </Modal.Header>
        <Modal.Body style={{ padding: 0 }}>
          {selectedRoute && (() => {
            const pts = selectedRoute.locationPoints || [];
            const positions = pts.map(p => [p.lat, p.lng]);
            const start = positions[0];
            const end = positions[positions.length - 1];
            const fmt = (d) => d ? new Date(d).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : '—';

            const startIcon = L.divIcon({
              className: '',
              html: `<div style="background:#10b981;width:14px;height:14px;border-radius:50%;border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.3)"></div>`,
              iconSize: [14, 14], iconAnchor: [7, 7]
            });
            const endIcon = L.divIcon({
              className: '',
              html: `<div style="background:#ef4444;width:14px;height:14px;border-radius:50%;border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.3)"></div>`,
              iconSize: [14, 14], iconAnchor: [7, 7]
            });

            return (
              <>
                {positions.length > 0 ? (
                  <MapContainer
                    center={start || [28.6139, 77.2090]}
                    zoom={13}
                    style={{ height: isMobile ? 380 : 520, width: '100%' }}
                    zoomControl={true}
                  >
                    <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="© OpenStreetMap" />
                    <FitBounds positions={positions} />
                    {positions.length > 1 && (
                      <Polyline
                        positions={positions}
                        pathOptions={{ color: '#10b981', weight: 5, opacity: 0.85, lineJoin: 'round', lineCap: 'round' }}
                      />
                    )}
                    {start && (
                      <Marker position={start} icon={startIcon}>
                        <Popup><strong>🟢 Start</strong><br />{fmt(selectedRoute.startTime)}</Popup>
                      </Marker>
                    )}
                    {end && positions.length > 1 && (
                      <Marker position={end} icon={endIcon}>
                        <Popup><strong>{selectedRoute.status === 'COMPLETED' ? '🔴 End' : '🟡 Current'}</strong><br />{selectedRoute.endTime ? fmt(selectedRoute.endTime) : 'Ongoing'}</Popup>
                      </Marker>
                    )}
                  </MapContainer>
                ) : (
                  <div className="d-flex align-items-center justify-content-center" style={{ height: 300, background: '#f8fafc' }}>
                    <div className="text-center" style={{ color: '#94a3b8' }}>
                      <i className="fas fa-map-marked-alt" style={{ fontSize: '2rem', marginBottom: 8, display: 'block' }} />
                      No GPS points recorded yet
                    </div>
                  </div>
                )}
                <div style={{ padding: '1rem 1.25rem', background: '#f8fafc', borderTop: '1px solid #e5e7eb' }}>
                  <Row className="g-2">
                    {[
                      { label: 'Distance', value: `${selectedRoute.totalDistanceKm} km`, color: '#10b981' },
                      { label: 'Avg Speed', value: `${selectedRoute.avgSpeedKmh || 0} km/h`, color: '#3b82f6' },
                      { label: 'Max Speed', value: `${selectedRoute.maxSpeedKmh || 0} km/h`, color: '#ef4444' },
                      { label: 'GPS Points', value: pts.length, color: '#8b5cf6' },
                    ].map((s, i) => (
                      <Col xs={3} key={i}>
                        <div style={{ textAlign: 'center', background: '#fff', borderRadius: 10, padding: '0.75rem', border: '1px solid #e5e7eb' }}>
                          <div style={{ fontSize: '1.2rem', fontWeight: 800, color: s.color }}>{s.value}</div>
                          <div style={{ fontSize: '0.7rem', color: '#6b7280', marginTop: 2 }}>{s.label}</div>
                        </div>
                      </Col>
                    ))}
                  </Row>
                </div>
              </>
            );
          })()}
        </Modal.Body>
      </Modal>
      </div>
    </div>
  );
};

export default JourneyManagerDashboard;
