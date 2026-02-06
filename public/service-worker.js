// service-worker.js
// Optimized for mobile PWA - API calls always bypass cache

const CACHE_NAME = "grova-cache-v4";
const RUNTIME_CACHE = "grova-runtime-v4";

const PRECACHE_URLS = [
  "/",
  "/index.html",
  "/manifest.json",
  "/favicon.ico",
  "/logo192.png",
  "/logo512.png",
];

self.addEventListener("install", (event) => {
  console.log("[SW] Installing v4...");
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => {
        console.log("[SW] Precaching app shell");
        return cache.addAll(PRECACHE_URLS);
      })
      .then(() => self.skipWaiting())
      .catch((error) => {
        console.error("[SW] Precache failed:", error);
      }),
  );
});

self.addEventListener("activate", (event) => {
  console.log("[SW] Activating v4...");
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((name) => name !== CACHE_NAME && name !== RUNTIME_CACHE)
            .map((name) => {
              console.log("[SW] Deleting old cache:", name);
              return caches.delete(name);
            }),
        );
      })
      .then(() => self.clients.claim()),
  );
});

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

  // CRITICAL: NEVER cache API/Supabase calls
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
    event.respondWith(
      fetch(request, {
        cache: "no-store",
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

  // For HTML navigation
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request, { cache: "no-store" })
        .then((response) => response)
        .catch(() => caches.match("/index.html")),
    );
    return;
  }

  // For static assets - cache first
  if (
    request.destination === "script" ||
    request.destination === "style" ||
    request.destination === "image" ||
    request.destination === "font"
  ) {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
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

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});
