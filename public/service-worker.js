// ============================================================================
// public/service-worker.js — Xeevia v3 DEDUP-SAFE
// ============================================================================
//
// KEY FIXES vs previous version:
//   [1] FOCUSED-APP GUARD — when app tab is focused, SW posts PUSH_RECEIVED
//       to the client instead of showing an OS notification. The in-app toast
//       handles display. This eliminates the double-notification bug.
//   [2] NOTIFICATION_CLICKED bridge — on OS notif tap, SW posts structured
//       message to the focused/opened client so pushService can route it.
//   [3] CLEAR_BADGE message — clears app-icon badge on Android.
//   [4] SW_VERSION / SKIP_WAITING messages preserved.
//   [5] PUSH payload schema: { title, body, icon, badge, tag, data: { url } }
// ============================================================================

const CACHE_NAME   = "xeevia-v2026-pro-3";
const SW_VERSION   = "xeevia-1.0.3";

const STATIC_ASSETS = [
  "/",
  "/index.html",
  "/manifest.json",
  "/favicon.png",
  "/logo192.png",
  "/logo512.png",
];

// ── Install ───────────────────────────────────────────────────────────────────
self.addEventListener("install", (event) => {
  console.log("[SW] Installing", CACHE_NAME);
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS)),
  );
});

// ── Activate ──────────────────────────────────────────────────────────────────
self.addEventListener("activate", (event) => {
  console.log("[SW] Activating", CACHE_NAME);
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

// ── Fetch (cache-first for static assets, network-first otherwise) ────────────
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  event.respondWith(
    caches.match(event.request).then((cached) => {
      return fetch(event.request)
        .then((res) => {
          if (res.ok && STATIC_ASSETS.includes(new URL(event.request.url).pathname)) {
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, res.clone()));
          }
          return res;
        })
        .catch(() => cached || new Response("Offline", { status: 503 }));
    }),
  );
});

// ── Push handler — THE KEY FIX ────────────────────────────────────────────────
//
// Protocol:
//   App FOCUSED   → post PUSH_RECEIVED to client → in-app toast only
//   App BACKGROUND → show OS notification
//
// This eliminates the double-notification: previously the SW always showed an
// OS notification AND the app also showed an in-app toast on the Supabase
// realtime INSERT event, giving the user two alerts for one event.
//
self.addEventListener("push", (event) => {
  if (!event.data) return;

  let payload;
  try {
    payload = event.data.json();
  } catch {
    payload = { title: "Xeevia", body: event.data.text(), data: { url: "/" } };
  }

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        // Is any app tab currently focused?
        const focusedClient = clientList.find(
          (c) => c.visibilityState === "visible",
        );

        if (focusedClient) {
          // App is open & focused — hand off to in-app toast, NO OS popup
          focusedClient.postMessage({
            type:    "PUSH_RECEIVED",
            payload: payload,
          });
          return; // Skip showNotification
        }

        // App is backgrounded / closed — show OS notification
        const notifOptions = {
          body:    payload.body   || "",
          icon:    payload.icon   || "/logo192.png",
          badge:   payload.badge  || "/logo192.png",
          tag:     payload.tag    || "xeevia-notif",
          vibrate: payload.vibrate || [200, 100, 200],
          requireInteraction: payload.requireInteraction || false,
          actions: payload.actions || [
            { action: "view",    title: "View"    },
            { action: "dismiss", title: "Dismiss" },
          ],
          data: {
            url:       payload.data?.url       || "/",
            type:      payload.data?.type      || "general",
            entity_id: payload.data?.entity_id || null,
            ...(payload.data || {}),
          },
        };

        return self.registration.showNotification(payload.title || "Xeevia", notifOptions);
      }),
  );
});

// ── Notification click ────────────────────────────────────────────────────────
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const action    = event.action;
  const notifData = event.notification.data || {};
  const targetUrl = notifData.url || "/";

  if (action === "dismiss") return;

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        // Try to find an existing app window
        const appClient = clientList.find(
          (c) => c.url.includes(self.location.origin),
        );

        if (appClient) {
          // Tell the app to navigate and bring window to front
          appClient.postMessage({
            type: "NOTIFICATION_CLICKED",
            url:  targetUrl,
            data: notifData,
          });
          return appClient.focus();
        }

        // No window open — open a new one
        return self.clients.openWindow(targetUrl);
      }),
  );
});

// ── Message handler (from app → SW) ──────────────────────────────────────────
self.addEventListener("message", (event) => {
  const msg = event.data;
  if (!msg?.type) return;

  switch (msg.type) {
    case "SKIP_WAITING":
      self.skipWaiting();
      break;

    case "GET_VERSION":
      event.source?.postMessage({ type: "SW_VERSION", version: SW_VERSION });
      break;

    case "CLEAR_BADGE":
      // Clear Android app-icon badge
      if ("clearAppBadge" in self.navigator) {
        self.navigator.clearAppBadge().catch(() => {});
      }
      break;

    default:
      break;
  }
});