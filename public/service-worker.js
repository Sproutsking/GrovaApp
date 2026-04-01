// ============================================================================
// public/service-worker.js — Xeevia v6 BULLETPROOF PUSH
// ============================================================================
//
// FIXES vs v5:
//   [SW-1]  Unique notification tag per notification_id — no more OS-level
//           replacement when two notifications arrive simultaneously.
//   [SW-2]  Client visibility check: focused OR visible (not just visible).
//           Background tabs now receive PUSH_RECEIVED correctly.
//   [SW-3]  SW_UPDATED message posted spontaneously on activate so
//           pushService._watchForUpdates actually fires.
//   [SW-4]  CLEAR_BADGE uses navigator (SW global) not self.navigator.
//   [SW-5]  Cold-open deep-link: openWindow uses the notif URL directly
//           so tapping an OS notification when app is closed opens the
//           right screen, not just "/".
//   [SW-6]  Payload stored in IndexedDB on push receipt so the app can
//           reconcile missed notifications on next open (offline resilience).
//   [SW-7]  No more hardcoded tag="xeevia-notif" — every notification gets
//           its own tag so they stack on Android instead of replacing.
// ============================================================================

const CACHE_NAME  = "xeevia-v2026-pro-6";
const SW_VERSION  = "xeevia-1.0.6";
const DB_NAME     = "xeevia-sw-db";
const DB_VERSION  = 1;
const STORE_NAME  = "pending-payloads";

const STATIC_ASSETS = [
  "/",
  "/index.html",
  "/offline.html",
  "/manifest.json",
  "/favicon.png",
  "/logo192.png",
  "/logo512.png",
];

// ── IndexedDB helpers (SW context — no window.indexedDB alias needed) ─────────
function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };
    req.onsuccess = (e) => resolve(e.target.result);
    req.onerror   = (e) => reject(e.target.error);
  });
}

async function storePayload(payload) {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).put({
      id:         payload?.data?.notification_id || `sw_${Date.now()}`,
      payload,
      storedAt:   Date.now(),
    });
    // Auto-purge entries older than 24h
    const cutoff = Date.now() - 86_400_000;
    const all    = await new Promise((res) => {
      const r = tx.objectStore(STORE_NAME).getAll();
      r.onsuccess = () => res(r.result);
      r.onerror   = () => res([]);
    });
    all.filter((e) => e.storedAt < cutoff).forEach((e) => {
      try { tx.objectStore(STORE_NAME).delete(e.id); } catch (_) {}
    });
  } catch (_) {}
}

// ── Install ───────────────────────────────────────────────────────────────────
self.addEventListener("install", (event) => {
  console.log("[SW] Installing", CACHE_NAME);
  event.waitUntil(
    (async () => {
      const existingKeys = await caches.keys();
      const hasOldCache  = existingKeys.some((k) => k !== CACHE_NAME);

      if (hasOldCache) {
        console.log("[SW] Old cache detected — poison pill cleanup");
        await Promise.all(existingKeys.map((k) => caches.delete(k)));
        await self.skipWaiting();
        const clients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
        for (const client of clients) {
          try { client.postMessage({ type: "SW_POISON_PILL_RELOAD" }); } catch (_) {}
        }
        return;
      }

      self.skipWaiting();
      const cache = await caches.open(CACHE_NAME);
      await Promise.allSettled(
        STATIC_ASSETS.map((url) =>
          cache.add(url).catch((e) => console.warn("[SW] Could not pre-cache:", url, e.message))
        )
      );
    })()
  );
});

// ── Activate ──────────────────────────────────────────────────────────────────
self.addEventListener("activate", (event) => {
  console.log("[SW] Activating", CACHE_NAME);
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
      .then(async () => {
        // [SW-3] Notify all open tabs that a new SW just took over
        const clients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
        for (const client of clients) {
          try { client.postMessage({ type: "SW_UPDATED", version: SW_VERSION }); } catch (_) {}
        }
      })
  );
});

// ── Fetch ─────────────────────────────────────────────────────────────────────
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  if (!event.request.url.startsWith(self.location.origin)) return;

  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request)
        .then((res) => {
          if (res.ok) {
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, res.clone())).catch(() => {});
          }
          return res;
        })
        .catch(async () => {
          const cached = (await caches.match("/index.html")) || (await caches.match("/"));
          if (cached) return cached;
          const offlinePage = await caches.match("/offline.html");
          if (offlinePage) return offlinePage;
          return new Response(
            `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>No connection — Xeevia</title>
<style>body{min-height:100vh;display:flex;align-items:center;justify-content:center;
background:#0f0f13;font-family:system-ui,sans-serif;color:#fff;text-align:center;padding:24px}
h1{font-size:22px;margin-bottom:12px}p{color:#aaa;font-size:15px;line-height:1.6;max-width:360px}
button{margin-top:24px;padding:12px 32px;background:#fff;color:#0f0f13;border:none;border-radius:8px;
font-size:15px;font-weight:600;cursor:pointer}</style></head>
<body><div><h1>No internet connection</h1>
<p>Xeevia needs a connection to load.<br>Please check your Wi-Fi or mobile data and try again.<br><br>
Your data is safe — nothing has been lost.</p>
<button onclick="location.reload()">Try again</button></div></body></html>`,
            { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } }
          );
        })
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) =>
      fetch(event.request)
        .then((res) => {
          if (res.ok && STATIC_ASSETS.includes(new URL(event.request.url).pathname)) {
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, res.clone())).catch(() => {});
          }
          return res;
        })
        .catch(() => cached || undefined)
    )
  );
});

// ── Push ──────────────────────────────────────────────────────────────────────
self.addEventListener("push", (event) => {
  if (!event.data) return;

  let payload;
  try {
    payload = event.data.json();
  } catch {
    payload = { title: "Xeevia", body: event.data.text(), data: { url: "/" } };
  }

  // [SW-6] Always store payload for offline reconciliation
  storePayload(payload);

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        // [SW-2] Accept focused OR visible clients (fixes background tab miss)
        const activeClient = clientList.find(
          (c) => c.visibilityState === "visible" || c.focused
        );

        if (activeClient) {
          // App is open and visible — send to app, skip OS notification
          activeClient.postMessage({ type: "PUSH_RECEIVED", payload });
          return;
        }

        // App is backgrounded or closed — show OS notification
        // [SW-1] & [SW-7] Unique tag per notification so they stack, not replace
        const notifId = payload.data?.notification_id
          || payload.data?.entity_id
          || `xeevia_${Date.now()}`;

        const tag = payload.data?.type === "dm"
          ? `dm_${payload.data?.conversation_id || notifId}`
          : `notif_${notifId}`;

        return self.registration.showNotification(payload.title || "Xeevia", {
          body:               payload.body              || "",
          icon:               payload.icon              || "/logo192.png",
          badge:              payload.badge             || "/logo192.png",
          tag,
          renotify:           true,   // vibrate/sound even if same tag is updated
          vibrate:            payload.vibrate           || [200, 100, 200],
          requireInteraction: payload.requireInteraction || false,
          actions: payload.actions || [
            { action: "view",    title: "View"    },
            { action: "dismiss", title: "Dismiss" },
          ],
          data: {
            url:             payload.data?.url             || "/",
            type:            payload.data?.type            || "general",
            entity_id:       payload.data?.entity_id       || null,
            notification_id: payload.data?.notification_id || notifId,
            conversation_id: payload.data?.conversation_id || null,
            ...(payload.data || {}),
          },
        });
      })
  );
});

// ── Notification click ────────────────────────────────────────────────────────
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const action    = event.action;
  const notifData = event.notification.data || {};
  // [SW-5] Use the actual deep-link URL, not just "/"
  const targetUrl = notifData.url || "/";

  if (action === "dismiss") return;

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        const appClient = clientList.find((c) => c.url.includes(self.location.origin));
        if (appClient) {
          appClient.postMessage({ type: "NOTIFICATION_CLICKED", url: targetUrl, data: notifData });
          return appClient.focus();
        }
        // [SW-5] Cold open — open the actual deep-link, not root
        return self.clients.openWindow(targetUrl);
      })
  );
});

// ── Message handler ───────────────────────────────────────────────────────────
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
      // [SW-4] navigator is the correct global in SW context, not self.navigator
      if ("clearAppBadge" in navigator) {
        navigator.clearAppBadge().catch(() => {});
      }
      break;
    case "GET_PENDING_PAYLOADS":
      // App requests any payloads stored while it was closed/offline
      (async () => {
        try {
          const db      = await openDB();
          const tx      = db.transaction(STORE_NAME, "readwrite");
          const all     = await new Promise((res) => {
            const r = tx.objectStore(STORE_NAME).getAll();
            r.onsuccess = () => res(r.result);
            r.onerror   = () => res([]);
          });
          event.source?.postMessage({ type: "PENDING_PAYLOADS", payloads: all.map((e) => e.payload) });
          // Clear them now that the app has them
          all.forEach((e) => {
            try { tx.objectStore(STORE_NAME).delete(e.id); } catch (_) {}
          });
        } catch (_) {
          event.source?.postMessage({ type: "PENDING_PAYLOADS", payloads: [] });
        }
      })();
      break;
    default:
      break;
  }
});