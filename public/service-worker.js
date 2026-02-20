/* ================================
   XEEVIA SERVICE WORKER v7
   ================================ */

const CACHE_NAME = "xeevia-static-v7";
const RUNTIME_CACHE = "xeevia-runtime-v7";

const PRECACHE_URLS = [
  "/",
  "/index.html",
  "/manifest.json",
  "/favicon.png",
  "/logo192.png",
  "/logo512.png",
];

/* ================================
   INSTALL
   ================================ */
self.addEventListener("install", (event) => {
  console.log("[SW] Xeevia v7 installing");

  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) =>
        Promise.all(
          PRECACHE_URLS.map((url) =>
            fetch(url)
              .then((res) => (res.ok ? cache.put(url, res) : null))
              .catch(() => null),
          ),
        ),
      )
      .then(() => self.skipWaiting()),
  );
});

/* ================================
   ACTIVATE
   ================================ */
self.addEventListener("activate", (event) => {
  console.log("[SW] Xeevia v7 activating");

  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) =>
        Promise.all(
          cacheNames
            .filter((name) => name !== CACHE_NAME && name !== RUNTIME_CACHE)
            .map((name) => caches.delete(name)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

/* ================================
   FETCH
   ================================ */
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== "GET") return;
  if (!url.protocol.startsWith("http")) return;

  event.respondWith(
    (async () => {
      // Cache-first for static assets
      if (isStaticAsset(url.pathname)) {
        const cached = await caches.match(request);
        if (cached) return cached;

        try {
          const networkResponse = await fetch(request);
          if (networkResponse.ok) {
            const cache = await caches.open(RUNTIME_CACHE);
            cache.put(request, networkResponse.clone());
          }
          return networkResponse;
        } catch {
          if (request.mode === "navigate") {
            const indexPage = await caches.match("/index.html");
            if (indexPage) return indexPage;
          }
          return new Response("", {
            status: 503,
            statusText: "Service Unavailable",
          });
        }
      }

      // Network-first for API and dynamic content
      try {
        const networkResponse = await fetch(request);
        if (networkResponse.ok && !isApiCall(url.pathname)) {
          const cache = await caches.open(RUNTIME_CACHE);
          cache.put(request, networkResponse.clone());
        }
        return networkResponse;
      } catch {
        const cachedResponse = await caches.match(request);
        if (cachedResponse) return cachedResponse;

        if (request.mode === "navigate") {
          const indexPage = await caches.match("/index.html");
          if (indexPage) return indexPage;
        }

        return new Response("", {
          status: 503,
          statusText: "Service Unavailable",
        });
      }
    })(),
  );
});

/* ================================
   HELPERS
   ================================ */
function isStaticAsset(pathname) {
  return (
    pathname.startsWith("/static/") ||
    [
      ".js",
      ".css",
      ".png",
      ".jpg",
      ".jpeg",
      ".svg",
      ".woff",
      ".woff2",
      ".ttf",
      ".ico",
    ].some((ext) => pathname.endsWith(ext))
  );
}

function isApiCall(pathname) {
  return (
    pathname.startsWith("/api/") ||
    pathname.includes("supabase.co") ||
    pathname.includes("functions/v1/")
  );
}

/* ================================
   PUSH NOTIFICATIONS
   ================================ */
self.addEventListener("push", (event) => {
  console.log("[SW] Push received");

  let data = {
    title: "Xeevia",
    body: "You have a new notification",
    icon: "/logo192.png",
    badge: "/logo192.png",
    data: { url: "/" },
  };

  if (event.data) {
    try {
      data = { ...data, ...event.data.json() };
    } catch (e) {
      console.error("[SW] Push parse error", e);
    }
  }

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: data.icon,
      badge: data.badge,
      data: data.data,
      tag: data.tag || "xeevia",
      requireInteraction: data.requireInteraction || false,
      vibrate: data.vibrate || [200, 100, 200],
      actions: [
        { action: "open", title: "View" },
        { action: "dismiss", title: "Dismiss" },
      ],
    }),
  );
});

/* ================================
   NOTIFICATION CLICK
   ================================ */
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  if (event.action === "dismiss") return;

  const urlToOpen = event.notification.data?.url || "/";

  event.waitUntil(
    clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientsArr) => {
        for (const client of clientsArr) {
          if ("focus" in client) {
            client.focus();
            if (client.navigate) return client.navigate(urlToOpen);
          }
        }
        if (clients.openWindow) return clients.openWindow(urlToOpen);
      }),
  );
});

/* ================================
   MESSAGES
   ================================ */
self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});
