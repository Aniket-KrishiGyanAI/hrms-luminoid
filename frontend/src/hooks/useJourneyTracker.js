import { useEffect, useRef, useCallback, useState } from "react";
import api from "../utils/api";
import { toast } from "react-toastify";

const PING_INTERVAL_MS = 60000; // 60 seconds - normal speed
const IDLE_PING_INTERVAL_MS = 120000; // 120 seconds - idle/stopped
const LOW_BATTERY_THRESHOLD = 20;
const CRITICAL_BATTERY_THRESHOLD = 10;
const IDLE_SPEED_THRESHOLD = 5; // km/h - below this is considered idle

const useJourneyTracker = (isJourneyActive) => {
  const intervalRef = useRef(null);
  const [batteryLevel, setBatteryLevel] = useState(100);
  const [lowBatteryAlertShown, setLowBatteryAlertShown] = useState(false);
  const [isIdle, setIsIdle] = useState(false);
  const lastPingRef = useRef(null);
  const lastSpeedRef = useRef(0);

  // Get battery level
  const getBatteryLevel = useCallback(async () => {
    if ("getBattery" in navigator) {
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

  // Enhanced: Adjust ping frequency based on battery AND movement
  const getPingInterval = useCallback((battery, isMoving = true) => {
    // If idle/stopped, use longer interval (double the normal)
    if (!isMoving) {
      if (battery < CRITICAL_BATTERY_THRESHOLD) return 300000; // 5 minutes when idle + critical battery
      if (battery < LOW_BATTERY_THRESHOLD) return 240000; // 4 minutes when idle + low battery
      return IDLE_PING_INTERVAL_MS; // 2 minutes when idle
    }

    // When actively moving
    if (battery < CRITICAL_BATTERY_THRESHOLD) return 180000; // 3 minutes
    if (battery < LOW_BATTERY_THRESHOLD) return 120000; // 2 minutes
    return PING_INTERVAL_MS; // 1 minute normal speed
  }, []);

  const pingLocation = useCallback(async () => {
    if (!navigator.geolocation) {
      console.warn("Geolocation not available");
      return;
    }

    const battery = await getBatteryLevel();

    // Show low battery warning once
    if (battery < LOW_BATTERY_THRESHOLD && !lowBatteryAlertShown) {
      toast.warning(
        `⚠️ Battery low (${battery}%). GPS tracking optimized to save power.`,
        {
          autoClose: 5000,
        },
      );
      setLowBatteryAlertShown(true);
    }

    // Determine accuracy mode based on battery
    let enableHighAccuracy = true;
    let timeout = 15000;
    let maximumAge = 0;

    if (battery < CRITICAL_BATTERY_THRESHOLD) {
      // Critical battery: Use cached location, low accuracy, longer timeout
      enableHighAccuracy = false;
      timeout = 20000;
      maximumAge = 60000; // Use location up to 1 min old
    } else if (battery < LOW_BATTERY_THRESHOLD) {
      // Low battery: Reduce accuracy slightly
      enableHighAccuracy = false;
      timeout = 15000;
      maximumAge = 30000; // Use location up to 30s old
    }

    console.log(
      `📍 GPS ping... Battery: ${battery}% | Idle: ${isIdle} | Accuracy: ${enableHighAccuracy ? "HIGH" : "LOW"}`,
    );

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const {
          latitude: lat,
          longitude: lng,
          accuracy,
          speed,
        } = position.coords;
        const speedKmh = speed ? Math.round(speed * 3.6) : 0; // Convert m/s to km/h

        console.log("📍 Position:", {
          lat,
          lng,
          accuracy,
          speed: speedKmh + " km/h",
        });

        // Detect if employee is idle (speed < 5 km/h)
        const nowIdle = speedKmh < IDLE_SPEED_THRESHOLD;
        if (nowIdle !== isIdle) {
          setIsIdle(nowIdle);
          if (nowIdle) {
            toast.info("⏸️ Idle detected - tracking frequency reduced", {
              autoClose: 3000,
            });
          } else {
            toast.info("▶️ Movement detected - normal tracking resumed", {
              autoClose: 3000,
            });
          }
        }

        lastSpeedRef.current = speedKmh;

        try {
          const response = await api.post("/api/journey/ping", {
            lat,
            lng,
            accuracy,
            batteryLevel: battery,
          });
          console.log("✅ Ping sent:", response.data);
          lastPingRef.current = new Date();
        } catch (error) {
          console.error("❌ Failed to send GPS ping:", error);
        }
      },
      (error) => {
        console.error("❌ GPS error:", error.code, error.message);
      },
      {
        enableHighAccuracy,
        timeout,
        maximumAge,
      },
    );
  }, [getBatteryLevel, lowBatteryAlertShown, isIdle]);

  useEffect(() => {
    if (isJourneyActive) {
      console.log("🟢 Journey ACTIVE - Starting GPS tracking");
      pingLocation(); // immediate first ping

      const setupInterval = async () => {
        const battery = await getBatteryLevel();
        const interval = getPingInterval(battery, !isIdle);

        console.log(
          `⏱️ Ping interval: ${interval / 1000}s (Battery: ${battery}% | Idle: ${isIdle})`,
        );

        clearInterval(intervalRef.current);
        intervalRef.current = setInterval(() => {
          console.log("📍 GPS ping interval triggered");
          pingLocation();
        }, interval);
      };

      setupInterval();

      // Re-adjust interval every 5 minutes based on battery & movement
      const batteryCheckInterval = setInterval(setupInterval, 300000);

      return () => {
        console.log("🛑 Cleaning up GPS tracking");
        clearInterval(intervalRef.current);
        clearInterval(batteryCheckInterval);
      };
    } else {
      console.log("🔴 Journey NOT active - GPS tracking stopped");
      clearInterval(intervalRef.current);
      setLowBatteryAlertShown(false);
    }
  }, [isJourneyActive, pingLocation, getBatteryLevel, getPingInterval, isIdle]);

  // Background tracking: Keep tracking even when tab is not visible
  useEffect(() => {
    if (!isJourneyActive) return;

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        console.log("👁️ Tab is visible - Ping immediately");
        pingLocation();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () =>
      document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [isJourneyActive, pingLocation]);

  return { batteryLevel, lastPing: lastPingRef.current, isIdle };
};

export default useJourneyTracker;
