// service-worker.js
// Place this file in /public/service-worker.js

const CACHE_NAME = "grova-cache-v1";
const RUNTIME_CACHE = "grova-runtime-v1";

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

// Fetch event - network first, fallback to cache
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

  // Skip API calls and external resources
  if (
    url.pathname.startsWith("/api/") ||
    url.href.includes("supabase") ||
    url.href.includes("cloudflare") ||
    url.href.includes("googleapis") ||
    url.href.includes("gstatic") ||
    url.href.includes("unpkg") ||
    url.href.includes("fontawesome")
  ) {
    // Network only for these
    event.respondWith(fetch(request));
    return;
  }

  // For navigation requests
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Cache successful responses
          if (response && response.status === 200) {
            const responseClone = response.clone();
            caches.open(RUNTIME_CACHE).then((cache) => {
              cache.put(request, responseClone);
            });
          }
          return response;
        })
        .catch(() => {
          // Fallback to cached index.html for navigation
          return caches.match("/index.html");
        }),
    );
    return;
  }

  // For all other requests - Network First strategy
  event.respondWith(
    fetch(request)
      .then((response) => {
        // Check if valid response
        if (!response || response.status !== 200) {
          return response;
        }

        // Clone and cache successful responses
        const responseClone = response.clone();
        caches.open(RUNTIME_CACHE).then((cache) => {
          cache.put(request, responseClone);
        });

        return response;
      })
      .catch(() => {
        // Network failed, try cache
        return caches.match(request).then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }

          // If it's a page request and not cached, return index.html
          if (request.destination === "document") {
            return caches.match("/index.html");
          }

          // Return offline response
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
});
