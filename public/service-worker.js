// ============================================================================
// public/service-worker.js — Xeevia v4 OFFLINE-SAFE
// ============================================================================
//
// KEY FIXES vs v3:
//   [1] NAVIGATION FETCH FIX — navigate requests (page loads) now ALWAYS fall
//       back to cached /index.html instead of the bare "Offline" text string.
//       This was the root cause of the blank black "Offline" screen in prod.
//   [2] NON-NAVIGATION FETCH FIX — non-navigate requests that fail network
//       AND have no cache entry now return undefined (fail naturally) instead
//       of the bare "Offline" 503 response that broke the app shell.
//   [3] CACHE NAME BUMPED to xeevia-v2026-pro-4 — forces activate handler to
//       purge the old broken cache from every user's browser on next load.
//   [4] All other behaviour (push, notificationclick, message, install,
//       activate) is identical to v3 — zero regressions.
//
// WHY THE OLD CODE BROKE:
//   The v3 fetch handler did:
//     .catch(() => cached || new Response("Offline", { status: 503 }))
//   When a stale SW was active and the network was briefly unreachable during
//   a deploy, it served that bare text response for the index.html navigation
//   request itself — the browser rendered the white/black page showing only
//   the word "Offline". Users with the old SW cached saw this until they
//   manually cleared site data.
// ============================================================================

const CACHE_NAME = "xeevia-v2026-pro-4";
const SW_VERSION = "xeevia-1.0.4";

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

// ── Fetch ─────────────────────────────────────────────────────────────────────
//
// TWO SEPARATE STRATEGIES:
//
//   navigate (page / document loads)
//   ─────────────────────────────────
//   Always try the network first. If the network fails, serve the cached
//   index.html so the React app can still boot and show its own offline UI.
//   NEVER serve a bare text/503 response — that is what caused the "Offline"
//   screen your users and investor saw.
//
//   all other GET requests (JS chunks, API, images, etc.)
//   ──────────────────────────────────────────────────────
//   Cache-first with network revalidation. If both cache and network miss,
//   return undefined (let the request fail naturally with a browser error)
//   rather than a synthetic 503 that breaks the app shell.
//
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  // ── Strategy A: Navigation requests (HTML document loads) ──────────────────
  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request)
        .then((res) => {
          // Cache a fresh copy of index.html on every successful load
          if (res.ok) {
            caches
              .open(CACHE_NAME)
              .then((cache) => cache.put(event.request, res.clone()))
              .catch(() => {});
          }
          return res;
        })
        .catch(() =>
          // Network failed — serve cached index.html so React can boot
          caches
            .match("/index.html")
            .then((cached) => cached || caches.match("/"))
            // If we have absolutely nothing cached, fail silently —
            // the browser will show its own "no connection" page which
            // is far better than our old bare "Offline" text.
            .catch(() => undefined),
        ),
    );
    return;
  }

  // ── Strategy B: All other GET requests ────────────────────────────────────
  event.respondWith(
    caches.match(event.request).then((cached) => {
      return fetch(event.request)
        .then((res) => {
          // Cache fresh copies of known static assets
          if (
            res.ok &&
            STATIC_ASSETS.includes(new URL(event.request.url).pathname)
          ) {
            caches
              .open(CACHE_NAME)
              .then((cache) => cache.put(event.request, res.clone()))
              .catch(() => {});
          }
          return res;
        })
        .catch(() => {
          // Network failed — return cached version if available,
          // otherwise return undefined (fail naturally, no fake 503)
          return cached || undefined;
        });
    }),
  );
});

// ── Push handler ──────────────────────────────────────────────────────────────
//
// Protocol:
//   App FOCUSED   → post PUSH_RECEIVED to client → in-app toast only
//   App BACKGROUND → show OS notification
//
// This eliminates double-notification: previously the SW always showed an
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
            type: "PUSH_RECEIVED",
            payload: payload,
          });
          return; // Skip showNotification
        }

        // App is backgrounded / closed — show OS notification
        const notifOptions = {
          body: payload.body || "",
          icon: payload.icon || "/logo192.png",
          badge: payload.badge || "/logo192.png",
          tag: payload.tag || "xeevia-notif",
          vibrate: payload.vibrate || [200, 100, 200],
          requireInteraction: payload.requireInteraction || false,
          actions: payload.actions || [
            { action: "view", title: "View" },
            { action: "dismiss", title: "Dismiss" },
          ],
          data: {
            url: payload.data?.url || "/",
            type: payload.data?.type || "general",
            entity_id: payload.data?.entity_id || null,
            ...(payload.data || {}),
          },
        };

        return self.registration.showNotification(
          payload.title || "Xeevia",
          notifOptions,
        );
      }),
  );
});

// ── Notification click ────────────────────────────────────────────────────────
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const action = event.action;
  const notifData = event.notification.data || {};
  const targetUrl = notifData.url || "/";

  if (action === "dismiss") return;

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        // Try to find an existing app window
        const appClient = clientList.find((c) =>
          c.url.includes(self.location.origin),
        );

        if (appClient) {
          // Tell the app to navigate and bring window to front
          appClient.postMessage({
            type: "NOTIFICATION_CLICKED",
            url: targetUrl,
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