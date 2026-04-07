import { useEffect, useRef, useCallback, useState } from 'react';
import api from '../utils/api';
import { toast } from 'react-toastify';

const PING_INTERVAL_MS = 60000; // 60 seconds
const LOW_BATTERY_THRESHOLD = 20;
const CRITICAL_BATTERY_THRESHOLD = 10;

const useJourneyTracker = (isJourneyActive) => {
  const intervalRef = useRef(null);
  const [batteryLevel, setBatteryLevel] = useState(100);
  const [lowBatteryAlertShown, setLowBatteryAlertShown] = useState(false);
  const lastPingRef = useRef(null);

  // Get battery level
  const getBatteryLevel = useCallback(async () => {
    if ('getBattery' in navigator) {
      try {
        const battery = await navigator.getBattery();
        const level = Math.round(battery.level * 100);
        setBatteryLevel(level);
        return level;
      } catch {
        return 100;
      }
    }
    return 100;
  }, []);

  // Battery optimization: Adjust ping frequency based on battery
  const getPingInterval = useCallback((battery) => {
    if (battery < CRITICAL_BATTERY_THRESHOLD) return 180000; // 3 minutes
    if (battery < LOW_BATTERY_THRESHOLD) return 120000; // 2 minutes
    return PING_INTERVAL_MS; // 1 minute
  }, []);

  const pingLocation = useCallback(async () => {
    if (!navigator.geolocation) {
      console.warn('Geolocation not available');
      return;
    }

    const battery = await getBatteryLevel();

    // Show low battery warning once
    if (battery < LOW_BATTERY_THRESHOLD && !lowBatteryAlertShown) {
      toast.warning(`⚠️ Battery low (${battery}%). GPS tracking frequency reduced to save power.`, {
        autoClose: 5000
      });
      setLowBatteryAlertShown(true);
    }

    console.log('Attempting GPS ping... Battery:', battery + '%');

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude: lat, longitude: lng, accuracy } = position.coords;
        console.log('GPS position obtained:', { lat, lng, accuracy });
        
        try {
          const response = await api.post('/api/journey/ping', { lat, lng, accuracy, batteryLevel: battery });
          console.log('GPS ping sent successfully:', response.data);
          lastPingRef.current = new Date();
        } catch (error) {
          console.error('Failed to send GPS ping:', error);
          // silent fail — will retry next interval
        }
      },
      (error) => {
        console.error('GPS error:', error.code, error.message);
        // silent fail on GPS error
      },
      { 
        enableHighAccuracy: battery > LOW_BATTERY_THRESHOLD, // Reduce accuracy when battery low
        timeout: 10000,
        maximumAge: battery < CRITICAL_BATTERY_THRESHOLD ? 30000 : 0 // Use cached location when critical
      }
    );
  }, [getBatteryLevel, lowBatteryAlertShown]);

  useEffect(() => {
    if (isJourneyActive) {
      console.log('Journey is ACTIVE - Starting GPS tracking');
      pingLocation(); // immediate first ping
      
      const setupInterval = async () => {
        const battery = await getBatteryLevel();
        const interval = getPingInterval(battery);
        
        console.log('Setting up GPS ping interval:', interval / 1000, 'seconds');
        
        clearInterval(intervalRef.current);
        intervalRef.current = setInterval(() => {
          console.log('GPS ping interval triggered');
          pingLocation();
        }, interval);
      };

      setupInterval();

      // Re-adjust interval every 5 minutes based on battery
      const batteryCheckInterval = setInterval(setupInterval, 300000);

      return () => {
        console.log('Cleaning up GPS tracking intervals');
        clearInterval(intervalRef.current);
        clearInterval(batteryCheckInterval);
      };
    } else {
      console.log('Journey is NOT active - GPS tracking stopped');
      clearInterval(intervalRef.current);
      setLowBatteryAlertShown(false);
    }
  }, [isJourneyActive, pingLocation, getBatteryLevel, getPingInterval]);

  // Background tracking: Keep tracking even when tab is not visible
  useEffect(() => {
    if (!isJourneyActive) return;

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        // Ping immediately when user returns to tab
        pingLocation();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [isJourneyActive, pingLocation]);

  return { batteryLevel, lastPing: lastPingRef.current };
};

export default useJourneyTracker;
