// ============================================================================
// public/service-worker.js — Xeevia v7 BULLETPROOF PUSH
// ============================================================================
//
// FIXES vs v6:
//   [SW-8]  Call notification accept/decline actions properly signal the app.
//           When tapping "Accept" on an OS call notification, the app receives
//           CALL_ACCEPTED_FROM_NOTIFICATION and can open ActiveCall immediately.
//   [SW-9]  PUSH_RECEIVED payload forwarded even if client is focused-but-hidden
//           (e.g. background tab that's been focused by user).
//   [SW-10] notificationclick: send data to ALL open windows, not just the
//           first match, so the app can route regardless of which tab handles it.
//   [SW-11] Incoming call push notifications use requireInteraction:true AND
//           are never suppressed when the app is foregrounded — calls ALWAYS
//           show an OS notification for maximum visibility.
//   [SW-12] GET_PENDING_PAYLOADS clears DB after delivery to prevent replay.
//   All prior SW-1 through SW-7 fixes preserved exactly.
// ============================================================================

const CACHE_NAME  = "xeevia-v2026-pro-7";
const SW_VERSION  = "xeevia-1.0.7";
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

// ── IndexedDB helpers ─────────────────────────────────────────────────────────
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
    const id = payload?.data?.notification_id
      || payload?.data?.call_id
      || `sw_${Date.now()}`;
    tx.objectStore(STORE_NAME).put({ id, payload, storedAt: Date.now() });
    // Auto-purge entries older than 24h
    const cutoff = Date.now() - 86_400_000;
    const r = tx.objectStore(STORE_NAME).getAll();
    r.onsuccess = () => {
      (r.result || [])
        .filter(e => e.storedAt < cutoff)
        .forEach(e => { try { tx.objectStore(STORE_NAME).delete(e.id); } catch (_) {} });
    };
  } catch (_) {}
}

async function getAllPendingPayloads() {
  try {
    const db  = await openDB();
    const tx  = db.transaction(STORE_NAME, "readwrite");
    const all = await new Promise((res) => {
      const req = tx.objectStore(STORE_NAME).getAll();
      req.onsuccess = () => res(req.result || []);
      req.onerror   = () => res([]);
    });
    // [SW-12] Clear after delivery
    all.forEach(e => {
      try { tx.objectStore(STORE_NAME).delete(e.id); } catch (_) {}
    });
    return all.map(e => e.payload);
  } catch (_) {
    return [];
  }
}

// ── Install ───────────────────────────────────────────────────────────────────
self.addEventListener("install", (event) => {
  console.log("[SW] Installing", CACHE_NAME);
  event.waitUntil(
    (async () => {
      const existingKeys = await caches.keys();
      const hasOldCache  = existingKeys.some(k => k !== CACHE_NAME);

      if (hasOldCache) {
        console.log("[SW] Old cache detected — poison pill cleanup");
        await Promise.all(existingKeys.map(k => caches.delete(k)));
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
        STATIC_ASSETS.map(url =>
          cache.add(url).catch(e => console.warn("[SW] Could not pre-cache:", url, e.message))
        )
      );
    })()
  );
});

// ── Activate ──────────────────────────────────────────────────────────────────
self.addEventListener("activate", (event) => {
  console.log("[SW] Activating", CACHE_NAME);
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))))
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
        .then(res => {
          if (res.ok) {
            caches.open(CACHE_NAME)
              .then(cache => cache.put(event.request, res.clone()))
              .catch(() => {});
          }
          return res;
        })
        .catch(async () => {
          const cached = (await caches.match("/index.html")) || (await caches.match("/"));
          if (cached) return cached;
          const offline = await caches.match("/offline.html");
          if (offline) return offline;
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
    caches.match(event.request).then(cached =>
      fetch(event.request)
        .then(res => {
          if (res.ok && STATIC_ASSETS.includes(new URL(event.request.url).pathname)) {
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, res.clone())).catch(() => {});
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
    payload = { title: "Xeevia", body: event.data.text(), data: { url: "/", type: "general" } };
  }

  const type = payload?.data?.type || "general";

  // [SW-6] Always store payload for offline reconciliation
  storePayload(payload);

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then(clientList => {
        // [SW-11] For CALL notifications — ALWAYS show OS notification for visibility.
        // The app will also get PUSH_RECEIVED so it can show its own UI if foregrounded.
        if (type === "incoming_call") {
          // Notify any open windows so the in-app toast can also appear
          clientList.forEach(client => {
            try { client.postMessage({ type: "PUSH_RECEIVED", payload }); } catch (_) {}
          });
          // AND show OS notification (critical for when app is backgrounded)
          return _showOsNotification(payload);
        }

        // [SW-2] For other types: only show OS notification if no visible/focused window
        const activeClient = clientList.find(
          c => c.visibilityState === "visible" || c.focused
        );

        if (activeClient) {
          // App is visible — forward to in-app handler
          try { activeClient.postMessage({ type: "PUSH_RECEIVED", payload }); } catch (_) {}
          return;
        }

        // App backgrounded or closed — show OS notification
        return _showOsNotification(payload);
      })
  );
});

function _showOsNotification(payload) {
  const type   = payload?.data?.type  || "general";
  const notifId = payload?.data?.notification_id
    || payload?.data?.call_id
    || payload?.data?.entity_id
    || `xeevia_${Date.now()}`;

  // [SW-1] & [SW-7] Unique tag per notification so they stack on Android
  let tag;
  if (type === "incoming_call") {
    tag = `call_${payload?.data?.call_id || notifId}`;
  } else if (type === "dm") {
    tag = `dm_${payload?.data?.conversation_id || notifId}`;
  } else {
    tag = `notif_${notifId}`;
  }

  const isCall = type === "incoming_call";

  return self.registration.showNotification(payload.title || "Xeevia", {
    body:               payload.body              || "",
    icon:               payload.icon              || "/logo192.png",
    badge:              payload.badge             || "/logo192.png",
    tag,
    renotify:           true,
    vibrate:            isCall
                          ? [500, 100, 500, 100, 500]
                          : (payload.vibrate || [200, 100, 200]),
    requireInteraction: isCall || payload.requireInteraction || false,
    // [SW-8] Call-specific accept/decline actions
    actions: isCall
      ? [
          { action: "accept",  title: "✅ Accept"  },
          { action: "decline", title: "❌ Decline" },
        ]
      : (payload.actions || [
          { action: "view",    title: "View"    },
          { action: "dismiss", title: "Dismiss" },
        ]),
    data: {
      url:              payload?.data?.url              || "/",
      type,
      entity_id:        payload?.data?.entity_id        || null,
      notification_id:  notifId,
      conversation_id:  payload?.data?.conversation_id  || null,
      call_id:          payload?.data?.call_id          || null,
      caller_name:      payload?.data?.caller_name       || payload?.data?.callerName || null,
      call_type:        payload?.data?.call_type         || payload?.data?.callType   || null,
      caller_avatar_id: payload?.data?.caller_avatar_id  || null,
      ...(payload?.data || {}),
    },
  });
}

// ── Notification click ────────────────────────────────────────────────────────
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const action    = event.action;
  const notifData = event.notification.data || {};
  const type      = notifData.type || "general";

  // Silence dismiss actions immediately
  if (action === "dismiss") return;

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then(async clientList => {
        // ── [SW-8] CALL ACCEPT ─────────────────────────────────────────────
        if (type === "incoming_call" && action === "accept") {
          const msg = { type: "CALL_ACCEPTED_FROM_NOTIFICATION", data: notifData };
          if (clientList.length > 0) {
            // App is open — tell it to accept the call
            clientList.forEach(c => {
              try { c.postMessage(msg); } catch (_) {}
            });
            // Focus the first window
            const win = clientList.find(c => c.url.includes(self.location.origin));
            if (win && "focus" in win) return win.focus();
          } else {
            // App is closed — open it with call accept intent
            const url = `/messages?accept_call=${notifData.call_id || ""}`;
            return self.clients.openWindow(url);
          }
          return;
        }

        // ── [SW-8] CALL DECLINE ───────────────────────────────────────────
        if (type === "incoming_call" && action === "decline") {
          const msg = { type: "CALL_DECLINED_FROM_NOTIFICATION", data: notifData };
          clientList.forEach(c => { try { c.postMessage(msg); } catch (_) {} });
          // No need to open any window for a decline
          return;
        }

        // ── STANDARD NOTIFICATION CLICK ────────────────────────────────────
        // [SW-5] Use the actual deep-link URL
        const targetUrl = notifData.url || "/";

        // [SW-10] Notify ALL open windows so any tab can handle routing
        clientList.forEach(c => {
          try {
            c.postMessage({ type: "NOTIFICATION_CLICKED", url: targetUrl, data: notifData });
          } catch (_) {}
        });

        const appClient = clientList.find(c => c.url.includes(self.location.origin));
        if (appClient) {
          if ("focus" in appClient) appClient.focus();
          return;
        }

        // [SW-5] Cold open — open the actual deep-link
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
      // [SW-4] navigator is the correct global in SW context
      if ("clearAppBadge" in navigator) {
        navigator.clearAppBadge().catch(() => {});
      }
      break;

    case "GET_PENDING_PAYLOADS":
      // App requests any payloads stored while it was closed/offline
      (async () => {
        const payloads = await getAllPendingPayloads();
        event.source?.postMessage({ type: "PENDING_PAYLOADS", payloads });
      })();
      break;

    default:
      break;
  }
});