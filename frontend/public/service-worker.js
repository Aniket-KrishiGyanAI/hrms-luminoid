/* eslint-disable no-restricted-globals */
// Service Worker for Background Location Tracking

const CACHE_NAME = 'luminoid-hrms-v1';
const API_BASE_URL = self.location.origin.includes('localhost') 
  ? 'http://localhost:5000' 
  : self.location.origin;

// Install event
self.addEventListener('install', (event) => {
  console.log('Service Worker: Installing...');
  self.skipWaiting();
});

// Activate event
self.addEventListener('activate', (event) => {
  console.log('Service Worker: Activated');
  event.waitUntil(self.clients.claim());
});

// Background Sync for GPS pings
self.addEventListener('sync', (event) => {
  console.log('Service Worker: Sync event', event.tag);
  
  if (event.tag === 'journey-ping') {
    event.waitUntil(sendLocationPing());
  }
});

// Periodic Background Sync (requires permission)
self.addEventListener('periodicsync', (event) => {
  console.log('Service Worker: Periodic sync event', event.tag);
  
  if (event.tag === 'journey-location-sync') {
    event.waitUntil(sendLocationPing());
  }
});

// Send location ping to backend
async function sendLocationPing() {
  try {
    // Get stored auth token
    const cache = await caches.open(CACHE_NAME);
    const tokenResponse = await cache.match('/auth-token');
    
    if (!tokenResponse) {
      console.log('No auth token found');
      return;
    }
    
    const { token } = await tokenResponse.json();
    
    // Get current position
    const position = await getCurrentPosition();
    const { latitude: lat, longitude: lng, accuracy } = position.coords;
    
    // Get battery level if available
    let batteryLevel = 100;
    if ('getBattery' in navigator) {
      const battery = await navigator.getBattery();
      batteryLevel = Math.round(battery.level * 100);
    }
    
    // Send ping to backend
    const response = await fetch(`${API_BASE_URL}/api/journey/ping`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ lat, lng, accuracy, batteryLevel })
    });
    
    if (response.ok) {
      console.log('Location ping sent successfully');
      
      // Show notification to user
      if (Notification.permission === 'granted') {
        self.registration.showNotification('Journey Tracking', {
          body: 'Location updated in background',
          icon: '/logo192.png',
          badge: '/logo192.png',
          tag: 'journey-ping',
          silent: true
        });
      }
    } else {
      console.error('Failed to send location ping:', response.status);
    }
  } catch (error) {
    console.error('Error sending location ping:', error);
  }
}

// Get current position using Geolocation API
function getCurrentPosition() {
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) {
      reject(new Error('Geolocation not supported'));
      return;
    }
    
    navigator.geolocation.getCurrentPosition(
      resolve,
      reject,
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  });
}

// Handle messages from main app
self.addEventListener('message', (event) => {
  console.log('Service Worker: Message received', event.data);
  
  if (event.data.type === 'STORE_TOKEN') {
    // Store auth token for background requests
    caches.open(CACHE_NAME).then((cache) => {
      cache.put('/auth-token', new Response(JSON.stringify({ token: event.data.token })));
    });
  }
  
  if (event.data.type === 'START_TRACKING') {
    // Register periodic background sync (if supported)
    if ('periodicSync' in self.registration) {
      self.registration.periodicSync.register('journey-location-sync', {
        minInterval: 60 * 1000 // 1 minute
      }).then(() => {
        console.log('Periodic background sync registered');
      }).catch((err) => {
        console.error('Failed to register periodic sync:', err);
      });
    }
  }
  
  if (event.data.type === 'STOP_TRACKING') {
    // Unregister periodic background sync
    if ('periodicSync' in self.registration) {
      self.registration.periodicSync.unregister('journey-location-sync').then(() => {
        console.log('Periodic background sync unregistered');
      });
    }
  }
});

// Push notification handler (for future use)
self.addEventListener('push', (event) => {
  console.log('Service Worker: Push notification received');
  
  const data = event.data ? event.data.json() : {};
  const title = data.title || 'Journey Tracking';
  const options = {
    body: data.body || 'Location tracking update',
    icon: '/logo192.png',
    badge: '/logo192.png',
    data: data
  };
  
  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

// Notification click handler
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  event.waitUntil(
    self.clients.openWindow('/')
  );
});
