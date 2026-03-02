/* ============================================================
   XEEVIA SERVICE WORKER v10 — NUCLEAR RESET
   
   ROOT CAUSE FIX: v7 had self.skipWaiting() on install which
   caused an infinite controllerchange → reload loop when v9
   removed it. v10 adds skipWaiting() back on install so the
   old v7 worker gets cleanly evicted, then v10 takes full
   control. After this one-time fix, future versions can
   remove skipWaiting() safely again.
   ============================================================ */

var SW_VERSION = "xeevia-sw-v10";
var STATIC_CACHE = "xeevia-static-v10";
var RUNTIME_CACHE = "xeevia-runtime-v10";
var APP_ORIGIN = self.location.origin;

var PRECACHE_URLS = [
  "/",
  "/index.html",
  "/manifest.json",
  "/favicon.png",
  "/logo192.png",
  "/logo512.png",
];

/* ============================================================
   INSTALL — skipWaiting immediately to evict the stuck v7 SW.
   This is a one-time nuclear reset. Future versions (v11+)
   should remove skipWaiting() from here again.
   ============================================================ */
self.addEventListener("install", function (event) {
  console.log("[SW] Xeevia v10 installing — nuclear reset");
  self.skipWaiting();
  event.waitUntil(
    caches.open(STATIC_CACHE).then(function (cache) {
      return Promise.allSettled(
        PRECACHE_URLS.map(function (url) {
          return fetch(url, { cache: "no-store" })
            .then(function (res) {
              if (res.ok) return cache.put(url, res);
            })
            .catch(function () {
              return null;
            });
        }),
      );
    }),
  );
});

/* ============================================================
   ACTIVATE — purge ALL old caches, claim all clients
   ============================================================ */
self.addEventListener("activate", function (event) {
  console.log("[SW] Xeevia v10 activating");
  event.waitUntil(
    caches
      .keys()
      .then(function (keys) {
        return Promise.all(
          keys
            .filter(function (k) {
              return k !== STATIC_CACHE && k !== RUNTIME_CACHE;
            })
            .map(function (k) {
              console.log("[SW] Removing old cache:", k);
              return caches.delete(k);
            }),
        );
      })
      .then(function () {
        return self.clients.claim();
      })
      .then(function () {
        return self.clients
          .matchAll({ type: "window" })
          .then(function (clients) {
            clients.forEach(function (c) {
              c.postMessage({ type: "SW_UPDATED", version: SW_VERSION });
            });
          });
      }),
  );
});

/* ============================================================
   FETCH
   ============================================================ */
self.addEventListener("fetch", function (event) {
  var request = event.request;
  var url;
  try {
    url = new URL(request.url);
  } catch (e) {
    return;
  }

  if (request.method !== "GET") return;
  if (url.protocol !== "https:" && url.protocol !== "http:") return;
  if (url.pathname === "/sw.js") return;
  if (
    url.hostname.includes("supabase.co") ||
    url.hostname !== self.location.hostname
  )
    return;

  event.respondWith(
    caches.match(request).then(function (cached) {
      if (isStaticAsset(url.pathname) && cached) return cached;

      return fetch(request)
        .then(function (res) {
          if (res.ok && !isApiCall(url.pathname)) {
            var resClone = res.clone();
            var cacheName = isStaticAsset(url.pathname)
              ? STATIC_CACHE
              : RUNTIME_CACHE;
            caches.open(cacheName).then(function (cache) {
              cache.put(request, resClone);
            });
          }
          return res;
        })
        .catch(function () {
          if (cached) return cached;
          if (request.mode === "navigate") {
            return caches.match("/index.html").then(function (shell) {
              return (
                shell ||
                new Response("", { status: 503, statusText: "Offline" })
              );
            });
          }
          return new Response("", { status: 503, statusText: "Offline" });
        });
    }),
  );
});

/* ============================================================
   PUSH
   ============================================================ */
self.addEventListener("push", function (event) {
  console.log("[SW] Push received");
  if (!event.data) {
    console.warn("[SW] Push has no data");
    return;
  }

  var payload;
  try {
    payload = event.data.json();
  } catch (e) {
    payload = {
      title: "Xeevia",
      body: event.data.text() || "New notification",
      data: { url: "/" },
    };
  }

  var data = payload.data || {};
  var notifOptions = {
    body: payload.body || "You have a new notification",
    icon: payload.icon || "/logo192.png",
    badge: payload.badge || "/logo192.png",
    tag: payload.tag || "xeevia-" + Date.now(),
    vibrate: payload.vibrate || [200, 100, 200],
    requireInteraction: payload.requireInteraction || false,
    timestamp: data.timestamp || Date.now(),
    data: {
      url: data.url || "/",
      type: data.type || "general",
      entity_id: data.entity_id || null,
      actor_user_id: data.actor_user_id || null,
      actor_name: data.actor_name || "Someone",
    },
    actions: getNotificationActions(data.type),
    silent: false,
  };

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then(function (clients) {
        var appFocused = clients.some(function (c) {
          return c.focused;
        });
        if (appFocused) {
          clients.forEach(function (c) {
            c.postMessage({
              type: "PUSH_RECEIVED",
              payload: notifOptions.data,
            });
          });
          return Promise.resolve();
        }
        return self.registration.showNotification(
          payload.title || "Xeevia",
          notifOptions,
        );
      }),
  );
});

/* ============================================================
   NOTIFICATION CLICK
   ============================================================ */
self.addEventListener("notificationclick", function (event) {
  event.notification.close();
  if (event.action === "dismiss") return;
  var data = event.notification.data || {};
  var targetUrl = data.url || "/";
  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then(function (clients) {
        for (var i = 0; i < clients.length; i++) {
          if (clients[i].url.indexOf(APP_ORIGIN) === 0) {
            clients[i].focus();
            clients[i].postMessage({
              type: "NOTIFICATION_CLICKED",
              url: targetUrl,
              data: data,
            });
            return;
          }
        }
        return self.clients.openWindow(APP_ORIGIN + targetUrl);
      }),
  );
});

/* ============================================================
   NOTIFICATION CLOSE
   ============================================================ */
self.addEventListener("notificationclose", function (event) {
  console.log("[SW] Notification dismissed");
});

/* ============================================================
   MESSAGES
   ============================================================ */
self.addEventListener("message", function (event) {
  var msg = event.data;
  if (!msg) return;
  switch (msg.type) {
    case "SKIP_WAITING":
      console.log("[SW] SKIP_WAITING — activating now");
      self.skipWaiting();
      break;
    case "GET_VERSION":
      if (event.source)
        event.source.postMessage({ type: "SW_VERSION", version: SW_VERSION });
      break;
    default:
      break;
  }
});

/* ============================================================
   HELPERS
   ============================================================ */
function isStaticAsset(pathname) {
  if (pathname.indexOf("/static/") === 0) return true;
  var exts = [
    ".js",
    ".css",
    ".png",
    ".jpg",
    ".jpeg",
    ".svg",
    ".webp",
    ".woff",
    ".woff2",
    ".ttf",
    ".ico",
  ];
  for (var i = 0; i < exts.length; i++) {
    if (pathname.slice(-exts[i].length) === exts[i]) return true;
  }
  return false;
}

function isApiCall(pathname) {
  return (
    pathname.indexOf("/api/") === 0 ||
    pathname.indexOf("supabase.co") !== -1 ||
    pathname.indexOf("functions/v1/") !== -1
  );
}

function getNotificationActions(type) {
  switch (type) {
    case "follow":
      return [
        { action: "view", title: "View Profile" },
        { action: "dismiss", title: "Dismiss" },
      ];
    case "like":
    case "comment":
    case "share":
    case "unlock":
    case "profile_view":
      return [
        { action: "view", title: "View" },
        { action: "dismiss", title: "Dismiss" },
      ];
    default:
      return [{ action: "dismiss", title: "Dismiss" }];
  }
}
