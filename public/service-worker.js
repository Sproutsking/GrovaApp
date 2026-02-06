// service-worker.js
// Updated with better caching strategy for mobile PWA

const CACHE_NAME = "grova-cache-v2";
const RUNTIME_CACHE = "grova-runtime-v2";

// Files to cache immediately on install
const PRECACHE_URLS = [
  "/",
  "/index.html",
  "/manifest.json",
  "/favicon.ico",
  "/logo192.png",
  "/logo512.png",
];

// Install event - cache core assets
self.addEventListener("install", (event) => {
  console.log("[Service Worker] Installing...");
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => {
        console.log("[Service Worker] Precaching app shell");
        return cache.addAll(PRECACHE_URLS);
      })
      .then(() => self.skipWaiting())
      .catch((error) => {
        console.error("[Service Worker] Precaching failed:", error);
      }),
  );
});

// Activate event - clean up old caches
self.addEventListener("activate", (event) => {
  console.log("[Service Worker] Activating...");
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((name) => name !== CACHE_NAME && name !== RUNTIME_CACHE)
            .map((name) => {
              console.log("[Service Worker] Deleting old cache:", name);
              return caches.delete(name);
            }),
        );
      })
      .then(() => self.clients.claim()),
  );
});

// Fetch event - Network First for API, Cache First for static assets
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip cross-origin requests
  if (url.origin !== location.origin) {
    return;
  }

  // Skip non-GET requests
  if (request.method !== "GET") {
    return;
  }

  // CRITICAL: Always use network for API calls and Supabase
  if (
    url.pathname.startsWith("/api/") ||
    url.href.includes("supabase") ||
    url.href.includes("cloudflare") ||
    url.href.includes("googleapis") ||
    url.href.includes("gstatic") ||
    url.href.includes("unpkg") ||
    url.href.includes("fontawesome")
  ) {
    // Network only - never cache API responses
    event.respondWith(
      fetch(request).catch(() => {
        return new Response(JSON.stringify({ error: "Network unavailable" }), {
          status: 503,
          headers: { "Content-Type": "application/json" },
        });
      }),
    );
    return;
  }

  // For navigation requests (HTML pages)
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Don't cache HTML responses to prevent stale app
          return response;
        })
        .catch(() => {
          // Fallback to cached index.html only when offline
          return caches.match("/index.html");
        }),
    );
    return;
  }

  // For static assets (JS, CSS, images) - Cache First
  if (
    request.destination === "script" ||
    request.destination === "style" ||
    request.destination === "image" ||
    request.destination === "font"
  ) {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        if (cachedResponse) {
          // Return cached version, update in background
          fetch(request).then((response) => {
            if (response && response.status === 200) {
              caches.open(RUNTIME_CACHE).then((cache) => {
                cache.put(request, response.clone());
              });
            }
          });
          return cachedResponse;
        }

        // Not in cache, fetch from network
        return fetch(request).then((response) => {
          if (response && response.status === 200) {
            const responseClone = response.clone();
            caches.open(RUNTIME_CACHE).then((cache) => {
              cache.put(request, responseClone);
            });
          }
          return response;
        });
      }),
    );
    return;
  }

  // For everything else - Network First
  event.respondWith(
    fetch(request)
      .then((response) => {
        return response;
      })
      .catch(() => {
        return caches.match(request).then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }

          return new Response("Offline - Resource not available", {
            status: 503,
            statusText: "Service Unavailable",
            headers: new Headers({
              "Content-Type": "text/plain",
            }),
          });
        });
      }),
  );
});

// Handle messages from clients
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }

  // Clear cache on demand
  if (event.data && event.data.type === "CLEAR_CACHE") {
    event.waitUntil(
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => caches.delete(cacheName)),
        );
      }),
    );
  }
});
