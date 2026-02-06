const CACHE_NAME = "grova-v1";

// Only cache files that definitely exist
const urlsToCache = ["/", "/index.html"];

self.addEventListener("install", (event) => {
  console.log("[SW] Installing...");
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log("[SW] Caching app shell");
      // Use addAll with error handling
      return cache.addAll(urlsToCache).catch((err) => {
        console.error("[SW] Failed to cache:", err);
        // Don't fail the install if caching fails
        return Promise.resolve();
      });
    }),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  console.log("[SW] Activating...");
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== CACHE_NAME) {
              console.log("[SW] Deleting old cache:", cacheName);
              return caches.delete(cacheName);
            }
          }),
        );
      })
      .then(() => {
        console.log("[SW] Claiming clients");
        return self.clients.claim();
      }),
  );
});

self.addEventListener("fetch", (event) => {
  // Only handle GET requests
  if (event.request.method !== "GET") return;

  // Skip API calls, external resources
  if (
    event.request.url.includes("/api/") ||
    event.request.url.includes("supabase") ||
    event.request.url.includes("cloudflare") ||
    event.request.url.includes("googleapis") ||
    event.request.url.includes("gstatic") ||
    event.request.url.includes("unpkg")
  ) {
    // Network only for these
    event.respondWith(fetch(event.request));
    return;
  }

  // Network first, then cache strategy
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Check if valid response
        if (!response || response.status !== 200 || response.type === "error") {
          return response;
        }

        // Clone the response
        const responseToCache = response.clone();

        // Cache successful responses
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseToCache);
        });

        return response;
      })
      .catch(() => {
        // If network fails, try cache
        return caches.match(event.request).then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }

          // If requesting a page, return index.html from cache
          if (event.request.destination === "document") {
            return caches.match("/index.html");
          }

          // Return a basic offline response
          return new Response("Offline", {
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
