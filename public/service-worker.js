// service-worker.js
// Critical fix for mobile PWA - API calls always bypass cache

const CACHE_NAME = "grova-cache-v3";
const RUNTIME_CACHE = "grova-runtime-v3";

// Only cache static assets, NEVER data
const PRECACHE_URLS = [
  "/",
  "/index.html",
  "/manifest.json",
  "/favicon.ico",
  "/logo192.png",
  "/logo512.png",
];

// Install event
self.addEventListener("install", (event) => {
  console.log("[Service Worker] Installing v3...");
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
  console.log("[Service Worker] Activating v3...");
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

// Fetch event - CRITICAL: Never cache API/Supabase
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip cross-origin requests (let browser handle)
  if (url.origin !== location.origin) {
    return;
  }

  // Skip non-GET requests
  if (request.method !== "GET") {
    return;
  }

  // CRITICAL: NEVER cache these - always use network
  const noCachePatterns = [
    "/api/",
    "supabase",
    "cloudflare",
    "googleapis",
    "gstatic",
  ];

  const shouldNeverCache = noCachePatterns.some((pattern) =>
    url.href.includes(pattern),
  );

  if (shouldNeverCache) {
    console.log("[SW] Network-only (no cache):", url.pathname);
    event.respondWith(
      fetch(request, {
        cache: "no-store",
        headers: {
          ...request.headers,
          "Cache-Control": "no-cache, no-store, must-revalidate",
          Pragma: "no-cache",
        },
      }).catch(() => {
        return new Response(
          JSON.stringify({ error: "Network unavailable", offline: true }),
          {
            status: 503,
            headers: { "Content-Type": "application/json" },
          },
        );
      }),
    );
    return;
  }

  // For HTML navigation - always try network first
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request, { cache: "no-store" })
        .then((response) => response)
        .catch(() => caches.match("/index.html")),
    );
    return;
  }

  // For static assets (JS, CSS, images) - cache first with network update
  if (
    request.destination === "script" ||
    request.destination === "style" ||
    request.destination === "image" ||
    request.destination === "font"
  ) {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        // Return cached version
        const fetchPromise = fetch(request).then((response) => {
          if (response && response.status === 200) {
            const responseClone = response.clone();
            caches.open(RUNTIME_CACHE).then((cache) => {
              cache.put(request, responseClone);
            });
          }
          return response;
        });

        return cachedResponse || fetchPromise;
      }),
    );
    return;
  }

  // Default: network first
  event.respondWith(
    fetch(request, { cache: "no-store" })
      .then((response) => response)
      .catch(() => {
        return caches.match(request).then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }
          return new Response("Offline", {
            status: 503,
            statusText: "Service Unavailable",
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

  // Force clear all caches
  if (event.data && event.data.type === "CLEAR_CACHE") {
    console.log("[SW] Clearing all caches");
    event.waitUntil(
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => caches.delete(cacheName)),
        );
      }),
    );
  }
});
