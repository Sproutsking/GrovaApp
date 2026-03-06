const CACHE_NAME = "xeevia-v2026-pro-2";
const STATIC_ASSETS = [
  "/",
  "/index.html",
  "/manifest.json",
  "/favicon.png",
  "/logo192.png",
  "/logo512.png",
];

self.addEventListener("install", (event) => {
  console.log("[SW] Installing v2026-pro-2");
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS)),
  );
});

self.addEventListener("activate", (event) => {
  console.log("[SW] Activating v2026-pro-2");
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  event.respondWith(
    caches.match(event.request).then((cached) => {
      return fetch(event.request)
        .then((res) => {
          if (
            res.ok &&
            STATIC_ASSETS.includes(new URL(event.request.url).pathname)
          ) {
            caches
              .open(CACHE_NAME)
              .then((cache) => cache.put(event.request, res.clone()));
          }
          return res;
        })
        .catch(() => cached || new Response("Offline", { status: 503 }));
    }),
  );
});

self.addEventListener("push", (event) => {
  const data = event.data.json();
  const options = {
    body: data.body,
    icon: "/logo192.png",
    badge: "/logo192.png",
    vibrate: [200, 100, 200],
    data: { url: data.url || "/" },
  };
  event.waitUntil(self.registration.showNotification(data.title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: "window" }).then((clients) => {
      for (let client of clients) {
        if (client.url === event.notification.data.url) return client.focus();
      }
      return clients.openWindow(event.notification.data.url);
    }),
  );
});
