/* eslint-disable no-restricted-globals */
// Enhanced Service Worker for Background Location Tracking with Offline Support
// Features: Cache strategies, offline queue, background sync, push notifications

const CACHE_VERSION = "v2";
const CACHE_NAMES = {
  app: `luminoid-app-${CACHE_VERSION}`,
  api: `luminoid-api-${CACHE_VERSION}`,
  maps: `luminoid-maps-${CACHE_VERSION}`,
};

const DB_NAME = "luminoid-db";
const DB_VERSION = 1;
const PING_QUEUE_STORE = "pending-pings";

const API_BASE_URL = self.location.origin.includes("localhost")
  ? "http://localhost:5000"
  : self.location.origin;

// Map tile providers to cache
const MAP_PROVIDERS = [
  "https://tile.openstreetmap.org/",
  "https://tiles.stadiamaps.com/",
];

// ===== Initialize IndexedDB for Offline Queue =====
function initDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(PING_QUEUE_STORE)) {
        const store = db.createObjectStore(PING_QUEUE_STORE, {
          keyPath: "id",
          autoIncrement: true,
        });
        store.createIndex("timestamp", "timestamp", { unique: false });
        store.createIndex("status", "status", { unique: false });
      }
    };
  });
}

// ===== Queue Management =====
async function addPingToQueue(pingData) {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([PING_QUEUE_STORE], "readwrite");
    const store = tx.objectStore(PING_QUEUE_STORE);
    const data = {
      ...pingData,
      timestamp: Date.now(),
      status: "pending",
      retries: 0,
    };

    store.add(data);
    tx.oncomplete = () => {
      console.log(
        `[Queue] Ping added. Total pending: ${db.objectStoreNames.length}`,
      );
      resolve(data);
    };
    tx.onerror = () => reject(tx.error);
  });
}

async function getPendingPings() {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([PING_QUEUE_STORE], "readonly");
    const store = tx.objectStore(PING_QUEUE_STORE);
    const index = store.index("status");
    const range = IDBKeyRange.only("pending");

    const request = index.getAll(range);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function removePingFromQueue(id) {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([PING_QUEUE_STORE], "readwrite");
    const store = tx.objectStore(PING_QUEUE_STORE);

    store.delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function updatePingStatus(id, status) {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([PING_QUEUE_STORE], "readwrite");
    const store = tx.objectStore(PING_QUEUE_STORE);

    const getRequest = store.get(id);
    getRequest.onsuccess = () => {
      const data = getRequest.result;
      if (data) {
        data.status = status;
        data.lastAttempt = Date.now();
        store.put(data);
      }
    };
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// ===== Service Worker Lifecycle =====
self.addEventListener("install", (event) => {
  console.log("[SW] Installing...");

  // Cache app shell during install
  event.waitUntil(
    caches.open(CACHE_NAMES.app).then((cache) => {
      return cache.addAll(["/", "/index.html", "/manifest.json"]).catch(() => {
        console.log(
          "[Cache] Partial app shell cached (some assets may not be available)",
        );
      });
    }),
  );

  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  console.log("[SW] Activating...");

  // Clean up old cache versions
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((name) => {
            if (!Object.values(CACHE_NAMES).includes(name)) {
              console.log(`[Cache] Deleting old cache: ${name}`);
              return caches.delete(name);
            }
          }),
        );
      })
      .then(() => self.clients.claim()),
  );
});

// ===== Fetch Event With Cache Strategies =====
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== "GET") {
    return;
  }

  // 1. Map tiles: Cache-first (with network fallback)
  if (MAP_PROVIDERS.some((provider) => url.href.includes(provider))) {
    event.respondWith(cacheFirstStrategy(request, CACHE_NAMES.maps));
    return;
  }

  // 2. API calls: Network-first (with cache fallback)
  if (url.pathname.includes("/api/")) {
    event.respondWith(networkFirstStrategy(request, CACHE_NAMES.api));
    return;
  }

  // 3. App shell & static assets: Stale-while-revalidate
  event.respondWith(staleWhileRevalidateStrategy(request, CACHE_NAMES.app));
});

// Cache-first strategy: Return from cache, fall back to network
async function cacheFirstStrategy(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);

  if (cached) {
    return cached;
  }

  try {
    const response = await fetch(request);
    if (response && response.status === 200) {
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    console.log(`[Fetch] Cache-first failed for ${request.url}`, error);
    return new Response("Offline - Resource not cached", { status: 503 });
  }
}

// Network-first strategy: Try network, fall back to cache
async function networkFirstStrategy(request, cacheName) {
  try {
    const response = await fetch(request);
    if (response && response.status === 200) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    console.log(`[Fetch] Network failed, using cache for ${request.url}`);
    const cache = await caches.open(cacheName);
    const cached = await cache.match(request);
    return (
      cached ||
      new Response("Offline - Resource not available", { status: 503 })
    );
  }
}

// Stale-while-revalidate: Return cache immediately, update in background
async function staleWhileRevalidateStrategy(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);

  const fetchPromise = fetch(request)
    .then((response) => {
      if (response && response.status === 200) {
        cache.put(request, response.clone());
      }
      return response;
    })
    .catch(() => {
      console.log(`[Fetch] Update failed for ${request.url}, keeping cache`);
    });

  return cached || fetchPromise;
}

// ===== Background Sync for Offline Pings =====
self.addEventListener("sync", (event) => {
  console.log(`[Sync] Event: ${event.tag}`);

  if (event.tag === "journey-ping-sync") {
    event.waitUntil(processPendingPings());
  }
});

// ===== Periodic Background Sync (1 min interval) =====
self.addEventListener("periodicsync", (event) => {
  console.log(`[PeriodicSync] Event: ${event.tag}`);

  if (event.tag === "journey-location-sync") {
    event.waitUntil(sendLocationPing());
  }
});

// ===== Send Location Ping =====
async function sendLocationPing() {
  try {
    const cache = await caches.open(CACHE_NAMES.app);
    const tokenResponse = await cache.match("/auth-token");

    if (!tokenResponse) {
      console.log("[Ping] No auth token stored");
      return;
    }

    const { token } = await tokenResponse.json();

    // Try to get current position (may fail if app not active)
    let position;
    try {
      position = await getCurrentPosition();
    } catch (error) {
      console.log("[Ping] Geolocation failed, queuing for retry", error);
      // Queue for later retry
      await addPingToQueue({ token, queued: true });
      return;
    }

    const { latitude: lat, longitude: lng, accuracy } = position.coords;

    // Get battery level
    let batteryLevel = 100;
    if ("getBattery" in navigator) {
      try {
        const battery = await navigator.getBattery();
        batteryLevel = Math.round(battery.level * 100);
      } catch (error) {
        console.log("[Battery] API unavailable");
      }
    }

    // Send ping
    const response = await fetch(`${API_BASE_URL}/api/journey/ping`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        lat,
        lng,
        accuracy,
        batteryLevel,
        timestamp: Date.now(),
      }),
    });

    if (response.ok) {
      console.log("[Ping] Sent successfully");
      notifyClients({ type: "PING_SUCCESS", data: { lat, lng } });
    } else {
      console.error(`[Ping] Failed: ${response.status}`);
      // Queue for retry
      await addPingToQueue({ lat, lng, accuracy, batteryLevel, token });
      throw new Error(`HTTP ${response.status}`);
    }
  } catch (error) {
    console.error("[Ping] Error:", error);
  }
}

// ===== Process Pending Pings =====
async function processPendingPings() {
  try {
    const pings = await getPendingPings();
    console.log(`[Queue] Processing ${pings.length} pending pings`);

    if (pings.length === 0) {
      return;
    }

    const cache = await caches.open(CACHE_NAMES.app);
    const tokenResponse = await cache.match("/auth-token");

    if (!tokenResponse) {
      console.log("[Queue] No token, retrying later");
      return;
    }

    const { token } = await tokenResponse.json();

    for (const ping of pings) {
      const { id, lat, lng, accuracy, batteryLevel, retries } = ping;

      try {
        const response = await fetch(`${API_BASE_URL}/api/journey/ping`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            lat,
            lng,
            accuracy,
            batteryLevel,
            timestamp: ping.timestamp,
          }),
        });

        if (response.ok) {
          await removePingFromQueue(id);
          console.log(`[Queue] Ping #${id} synced`);
          notifyClients({ type: "OFFLINE_SYNC_SUCCESS", data: { id } });
        } else {
          // Retry later (max 5 retries)
          if (retries < 5) {
            await updatePingStatus(id, "pending");
            console.log(`[Queue] Ping #${id} retry (attempt ${retries + 1})`);
          } else {
            await updatePingStatus(id, "failed");
            console.log(`[Queue] Ping #${id} failed after max retries`);
            notifyClients({ type: "OFFLINE_SYNC_FAILED", data: { id } });
          }
        }
      } catch (error) {
        console.error(`[Queue] Error syncing ping #${id}:`, error);
      }
    }
  } catch (error) {
    console.error("[Queue] Error processing pings:", error);
  }
}

// ===== Geolocation Helper =====
function getCurrentPosition() {
  return new Promise((resolve, reject) => {
    if (!("geolocation" in navigator)) {
      reject(new Error("Geolocation not supported"));
      return;
    }

    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 0,
    });
  });
}

// ===== Message Handling from Main App =====
self.addEventListener("message", (event) => {
  const { type, token } = event.data;
  console.log(`[Message] Received: ${type}`);

  if (type === "STORE_TOKEN") {
    // Store auth token for background requests
    caches.open(CACHE_NAMES.app).then((cache) => {
      cache.put("/auth-token", new Response(JSON.stringify({ token })));
      notifyClients({ type: "TOKEN_STORED" });
    });
  }

  if (type === "START_TRACKING") {
    // Register periodic background sync
    if ("periodicSync" in self.registration) {
      self.registration.periodicSync
        .register("journey-location-sync", {
          minInterval: 60 * 1000, // 1 minute
        })
        .then(() => {
          console.log("[PeriodicSync] Registered");
          notifyClients({ type: "TRACKING_STARTED" });
        })
        .catch((err) => {
          console.error("[PeriodicSync] Failed:", err);
          notifyClients({ type: "TRACKING_FAILED", error: err.message });
        });
    }
  }

  if (type === "STOP_TRACKING") {
    if ("periodicSync" in self.registration) {
      self.registration.periodicSync
        .unregister("journey-location-sync")
        .then(() => {
          console.log("[PeriodicSync] Unregistered");
          notifyClients({ type: "TRACKING_STOPPED" });
        });
    }
  }

  if (type === "SYNC_PENDING_PINGS") {
    // Manual sync trigger
    event.waitUntil(processPendingPings());
  }

  if (type === "CLEAR_OFFLINE_QUEUE") {
    // Clear all pending pings
    initDB().then((db) => {
      const tx = db.transaction([PING_QUEUE_STORE], "readwrite");
      tx.objectStore(PING_QUEUE_STORE).clear();
      console.log("[Queue] Cleared");
      notifyClients({ type: "QUEUE_CLEARED" });
    });
  }
});

// ===== Notify All Clients =====
function notifyClients(message) {
  self.clients.matchAll().then((clients) => {
    clients.forEach((client) => {
      client.postMessage(message);
    });
  });
}

// ===== Push Notifications (for battery/sync alerts) =====
self.addEventListener("push", (event) => {
  console.log("[Push] Received");

  const data = event.data ? event.data.json() : {};
  const {
    title = "HRMS Luminoid",
    body = "Update available",
    tag = "default",
  } = data;

  const options = {
    body,
    icon: "/logo192.png",
    badge: "/logo192.png",
    tag,
    requireInteraction: false,
    data: data.data || {},
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  console.log("[Notification] Clicked");
  event.notification.close();

  event.waitUntil(
    self.clients.matchAll({ type: "window" }).then((windowClients) => {
      // Focus existing window
      for (let i = 0; i < windowClients.length; i++) {
        if (windowClients[i].url === "/") {
          return windowClients[i].focus();
        }
      }
      // Open new window
      if (self.clients.openWindow) {
        return self.clients.openWindow("/");
      }
    }),
  );
});

// Notification click handler
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  event.waitUntil(
    self.clients.matchAll({ type: "window" }).then((windowClients) => {
      for (let i = 0; i < windowClients.length; i++) {
        if (windowClients[i].url === "/") {
          return windowClients[i].focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow("/");
      }
    }),
  );
});
