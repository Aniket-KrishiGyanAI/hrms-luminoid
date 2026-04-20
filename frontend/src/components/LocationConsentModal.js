import React, { useState } from 'react';
import { Modal, Button } from 'react-bootstrap';

const LocationConsentModal = ({ show, onAccept, onDecline }) => {
  const [showDetails, setShowDetails] = useState(false);

  return (
    <Modal show={show} centered backdrop="static" keyboard={false} size="lg">
      <Modal.Header style={{ borderBottom: 'none', paddingBottom: 0 }}>
        <Modal.Title style={{ width: '100%', textAlign: 'center' }}>
          <div style={{
            width: 80,
            height: 80,
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 1rem',
            boxShadow: '0 8px 24px rgba(16,185,129,0.3)'
          }}>
            <i className="fas fa-map-marker-alt" style={{ fontSize: '2rem', color: '#fff' }} />
          </div>
        </Modal.Title>
      </Modal.Header>
      <Modal.Body style={{ padding: '0 2rem 2rem' }}>
        <h4 style={{ fontWeight: 700, marginBottom: '1rem', color: '#1e293b', textAlign: 'center' }}>
          📍 Location Access Required
        </h4>
        
        <p style={{ color: '#64748b', fontSize: '0.95rem', lineHeight: 1.6, marginBottom: '1.5rem', textAlign: 'center' }}>
          We need your location permission to verify field visits and ensure accurate tracking.
        </p>

        {/* What we track */}
        <div style={{
          background: 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)',
          padding: '1rem',
          borderRadius: 12,
          marginBottom: '1rem',
          border: '1px solid #bbf7d0'
        }}>
          <h6 style={{ fontWeight: 700, color: '#166534', marginBottom: '0.75rem', fontSize: '0.9rem' }}>
            ✅ What We Track:
          </h6>
          <ul style={{ fontSize: '0.85rem', color: '#047857', marginBottom: 0, paddingLeft: '1.25rem' }}>
            <li>Location when you check-in to a visit</li>
            <li>Location when you check-out from a visit</li>
            <li>GPS coordinates of visit photos</li>
            <li>Estimated travel distance</li>
          </ul>
        </div>

        {/* What we DON'T track */}
        <div style={{
          background: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)',
          padding: '1rem',
          borderRadius: 12,
          marginBottom: '1rem',
          border: '1px solid #fbbf24'
        }}>
          <h6 style={{ fontWeight: 700, color: '#92400e', marginBottom: '0.75rem', fontSize: '0.9rem' }}>
            ❌ What We DON'T Track:
          </h6>
          <ul style={{ fontSize: '0.85rem', color: '#b45309', marginBottom: 0, paddingLeft: '1.25rem' }}>
            <li>Your location outside work hours</li>
            <li>Continuous GPS tracking during the day</li>
            <li>Your personal activities or movements</li>
            <li>Your home address or private locations</li>
          </ul>
        </div>

        {/* Your rights */}
        <div style={{
          background: 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)',
          padding: '1rem',
          borderRadius: 12,
          marginBottom: '1rem',
          border: '1px solid #bfdbfe'
        }}>
          <h6 style={{ fontWeight: 700, color: '#1e40af', marginBottom: '0.75rem', fontSize: '0.9rem' }}>
            🔒 Your Privacy Rights:
          </h6>
          <ul style={{ fontSize: '0.85rem', color: '#1e3a8a', marginBottom: 0, paddingLeft: '1.25rem' }}>
            <li>View your location data anytime</li>
            <li>Request data deletion after 90 days</li>
            <li>Revoke consent at any time</li>
            <li>Data is encrypted and secure</li>
          </ul>
        </div>

        {/* Details toggle */}
        {showDetails && (
          <div style={{
            background: '#f8fafc',
            padding: '1rem',
            borderRadius: 12,
            marginBottom: '1rem',
            border: '1px solid #e2e8f0',
            fontSize: '0.85rem',
            color: '#475569',
            lineHeight: 1.6
          }}>
            <h6 style={{ fontWeight: 700, color: '#1e293b', marginBottom: '0.75rem', fontSize: '0.9rem' }}>
              📋 Technical Details:
            </h6>
            <p style={{ marginBottom: '0.5rem' }}>
              <strong>Data Collection:</strong> Location is captured only at check-in and check-out using your device's GPS.
            </p>
            <p style={{ marginBottom: '0.5rem' }}>
              <strong>Data Storage:</strong> Location data is encrypted and stored securely on our servers.
            </p>
            <p style={{ marginBottom: '0.5rem' }}>
              <strong>Data Retention:</strong> Location data is automatically deleted after 90 days.
            </p>
            <p style={{ marginBottom: '0.5rem' }}>
              <strong>Data Access:</strong> Only you and your direct manager can view your location data.
            </p>
            <p style={{ marginBottom: 0 }}>
              <strong>Battery Impact:</strong> Minimal - location is captured only 2-4 times per visit.
            </p>
          </div>
        )}

        <div style={{ textAlign: 'center', marginBottom: '1rem' }}>
          <button
            onClick={() => setShowDetails(!showDetails)}
            style={{
              background: 'none',
              border: 'none',
              color: '#3b82f6',
              fontSize: '0.85rem',
              fontWeight: 600,
              cursor: 'pointer',
              textDecoration: 'underline'
            }}
          >
            {showDetails ? '▲ Hide Details' : '▼ Show Technical Details'}
          </button>
        </div>

        <p style={{ fontSize: '0.75rem', color: '#94a3af', textAlign: 'center', marginBottom: 0 }}>
          By clicking "I Agree", you consent to location tracking as described above.
        </p>
      </Modal.Body>
      <Modal.Footer style={{ 
        borderTop: 'none', 
        padding: '0 2rem 2rem', 
        justifyContent: 'center', 
        gap: '1rem'
      }}>
        <Button 
          variant="outline-secondary" 
          onClick={onDecline}
          style={{ 
            borderRadius: 10, 
            padding: '0.75rem 1.5rem',
            fontWeight: 600,
            minWidth: 120
          }}
        >
          Decline
        </Button>
        <Button 
          onClick={onAccept}
          style={{ 
            background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
            border: 'none',
            borderRadius: 10,
            padding: '0.75rem 1.5rem',
            fontWeight: 600,
            minWidth: 120,
            boxShadow: '0 4px 12px rgba(16,185,129,0.3)'
          }}
        >
          <i className="fas fa-check me-2" />I Agree
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default LocationConsentModal;
