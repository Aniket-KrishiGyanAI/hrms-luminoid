// Service Worker Registration and Management

export const registerServiceWorker = async () => {
  if ('serviceWorker' in navigator) {
    try {
      const registration = await navigator.serviceWorker.register('/service-worker.js', {
        scope: '/'
      });
      
      console.log('Service Worker registered:', registration);
      
      // Request notification permission
      if ('Notification' in window && Notification.permission === 'default') {
        await Notification.requestPermission();
      }
      
      return registration;
    } catch (error) {
      console.error('Service Worker registration failed:', error);
      return null;
    }
  }
  return null;
};

export const unregisterServiceWorker = async () => {
  if ('serviceWorker' in navigator) {
    const registration = await navigator.serviceWorker.getRegistration();
    if (registration) {
      await registration.unregister();
      console.log('Service Worker unregistered');
    }
  }
};

export const storeAuthToken = async (token) => {
  if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
    navigator.serviceWorker.controller.postMessage({
      type: 'STORE_TOKEN',
      token
    });
  }
};

export const startBackgroundTracking = async () => {
  if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
    navigator.serviceWorker.controller.postMessage({
      type: 'START_TRACKING'
    });
    
    // Request persistent notification permission for background tracking
    if ('Notification' in window && Notification.permission !== 'granted') {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        console.warn('Notification permission denied - background tracking may be limited');
      }
    }
    
    // Register background sync
    if ('serviceWorker' in navigator && 'sync' in navigator.serviceWorker) {
      const registration = await navigator.serviceWorker.ready;
      try {
        await registration.sync.register('journey-ping');
        console.log('Background sync registered');
      } catch (error) {
        console.error('Background sync registration failed:', error);
      }
    }
    
    console.log('Background tracking started');
  } else {
    console.warn('Service Worker not available for background tracking');
  }
};

export const stopBackgroundTracking = async () => {
  if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
    navigator.serviceWorker.controller.postMessage({
      type: 'STOP_TRACKING'
    });
    console.log('Background tracking stopped');
  }
};

// Check if background tracking is supported
export const isBackgroundTrackingSupported = () => {
  return (
    'serviceWorker' in navigator &&
    'Notification' in window &&
    ('sync' in ServiceWorkerRegistration.prototype || 'periodicSync' in ServiceWorkerRegistration.prototype)
  );
};

// Request all necessary permissions
export const requestBackgroundPermissions = async () => {
  const permissions = {
    serviceWorker: false,
    notification: false,
    geolocation: false,
    backgroundSync: false
  };
  
  // Check Service Worker
  if ('serviceWorker' in navigator) {
    permissions.serviceWorker = true;
  }
  
  // Check Notification
  if ('Notification' in window) {
    if (Notification.permission === 'granted') {
      permissions.notification = true;
    } else if (Notification.permission === 'default') {
      const result = await Notification.requestPermission();
      permissions.notification = result === 'granted';
    }
  }
  
  // Check Geolocation
  if ('geolocation' in navigator) {
    try {
      await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000 });
      });
      permissions.geolocation = true;
    } catch (error) {
      permissions.geolocation = false;
    }
  }
  
  // Check Background Sync
  if ('serviceWorker' in navigator) {
    const registration = await navigator.serviceWorker.getRegistration();
    if (registration && ('sync' in registration || 'periodicSync' in registration)) {
      permissions.backgroundSync = true;
    }
  }
  
  return permissions;
};
