// ============================================================================
// public/service-worker.js — Xeevia v13 STANDALONE PRESERVATION
// ============================================================================
// FIXES vs v12:
//   [FIX-SW-1] REMOVED the aggressive "wipe all old caches then skipWaiting"
//              block from the install handler. This was the root cause of the
//              standalone PWA display mode being corrupted on every update.
//              Chrome re-evaluates the manifest when the app reloads mid-wipe;
//              if the manifest fetch is slow or the cache is empty at that
//              exact moment it falls back to "browser" display mode, breaking
//              the installed PWA until the user manually reinstalls.
//   [FIX-SW-2] skipWaiting() is now ONLY called in response to an explicit
//              SKIP_WAITING message from the app (triggered by the user
//              tapping "Update" in the update card). It is never called
//              automatically on install. This means updates apply cleanly
//              on the next natural page load, not mid-session.
//   [FIX-SW-3] Old cache cleanup moved to the ACTIVATE handler only, where
//              it is safe — the new SW is fully in control by then and the
//              app has already reloaded cleanly.
//   [FIX-SW-4] SW_POISON_PILL_RELOAD message removed entirely. Force-reloading
//              all clients mid-update is what triggered the manifest re-eval
//              at the worst possible moment (empty cache). The update card
//              in index.html handles user-initiated reloads gracefully.
//   [FIX-SW-5] Static asset pre-cache now uses waitUntil properly so Chrome
//              knows the install phase is complete before activating.
//   All v12 logic (IndexedDB, push, dedup, notificationclick, message
//   handler, _focusOrOpen) preserved exactly.
// ============================================================================

const CACHE_NAME = "xeevia-v2026-sw13";
const CLOUDINARY_CACHE = "xeevia-cloudinary-v1";
const CLOUDINARY_DOMAINS = ["res.cloudinary.com"];
const SW_VERSION = "xeevia-1.0.13";
const DB_NAME = "xeevia-sw-db";
const DB_VERSION = 1;
const STORE_NAME = "pending-payloads";

const STATIC_ASSETS = [
  "/",
  "/index.html",
  "/offline.html",
  "/manifest.json",
  "/favicon.png",
  "/logo192.png",
  "/logo512.png",
];

// ─── IndexedDB ────────────────────────────────────────────────────────────────
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
    req.onerror = (e) => reject(e.target.error);
  });
}

async function storePayload(payload) {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const id =
      payload?.data?.notification_id ||
      payload?.data?.call_id ||
      `sw_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    store.put({ id, payload, storedAt: Date.now() });
    const req2 = store.getAll();
    req2.onsuccess = () => {
      const cutoff = Date.now() - 86_400_000;
      (req2.result || [])
        .filter((e) => e.storedAt < cutoff)
        .forEach((e) => {
          try {
            store.delete(e.id);
          } catch (_) {}
        });
    };
  } catch (e) {
    console.warn("[SW] storePayload error:", e);
  }
}

async function getAllPendingPayloads() {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const all = await new Promise((res) => {
      const r = store.getAll();
      r.onsuccess = () => res(r.result || []);
      r.onerror = () => res([]);
    });
    all.forEach((e) => {
      try {
        store.delete(e.id);
      } catch (_) {}
    });
    return all.map((e) => e.payload);
  } catch {
    return [];
  }
}

// ─── Install ──────────────────────────────────────────────────────────────────
// [FIX-SW-1] [FIX-SW-2] [FIX-SW-4]
// NO skipWaiting() here. NO cache wipe here. NO force-reload of clients.
// We simply pre-cache static assets and let the browser activate us naturally
// on the next page load. This preserves the PWA standalone display mode.
self.addEventListener("install", (event) => {
  console.log("[SW v13] Installing", CACHE_NAME);
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) =>
        Promise.allSettled(
          STATIC_ASSETS.map((url) =>
            cache
              .add(url)
              .catch((e) =>
                console.warn("[SW] Pre-cache skip:", url, e.message),
              ),
          ),
        ),
      ),
  );
  // Do NOT call self.skipWaiting() here.
  // The new SW waits until all existing clients (tabs) are closed or
  // the user explicitly triggers an update via the update card.
});

// ─── Activate ─────────────────────────────────────────────────────────────────
// [FIX-SW-3] Old cache cleanup happens here — safe because by the time
// activate fires, the new SW is fully in control and the app has reloaded.
self.addEventListener("activate", (event) => {
  console.log("[SW v13] Activating", CACHE_NAME);
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k !== CACHE_NAME)
            .map((k) => {
              console.log("[SW v13] Deleting old cache:", k);
              return caches.delete(k);
            }),
        ),
      )
      .then(() => self.clients.claim())
      .then(async () => {
        // Notify open clients that the SW updated — app shows update card
        const clients = await self.clients.matchAll({
          type: "window",
          includeUncontrolled: true,
        });
        clients.forEach((c) => {
          try {
            c.postMessage({ type: "SW_UPDATED", version: SW_VERSION });
          } catch (_) {}
        });
      }),
  );
});

// ─── Fetch ────────────────────────────────────────────────────────────────────
function isCloudinaryRequest(request) {
  try {
    const url = new URL(request.url);
    return CLOUDINARY_DOMAINS.some(
      (domain) => url.hostname === domain || url.hostname.endsWith(`.${domain}`),
    );
  } catch {
    return false;
  }
}

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  if (isCloudinaryRequest(event.request)) {
    event.respondWith(
      caches.open(CLOUDINARY_CACHE).then(async (cache) => {
        const cached = await cache.match(event.request);
        const networkFetch = fetch(event.request)
          .then((res) => {
            if (res && (res.ok || res.type === "opaque")) {
              cache.put(event.request, res.clone()).catch(() => {});
            }
            return res;
          })
          .catch(() => null);

        if (cached) {
          event.waitUntil(networkFetch.catch(() => {}));
          return cached;
        }

        const networkResponse = await networkFetch;
        return networkResponse || cached || new Response("", { status: 404 });
      }),
    );
    return;
  }

  if (!event.request.url.startsWith(self.location.origin)) return;

  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request)
        .then((res) => {
          if (res.ok) {
            caches
              .open(CACHE_NAME)
              .then((c) => c.put(event.request, res.clone()))
              .catch(() => {});
          }
          return res;
        })
        .catch(async () => {
          const cached =
            (await caches.match("/index.html")) || (await caches.match("/"));
          if (cached) return cached;
          return new Response(
            `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Xeevia</title>
<style>body{min-height:100vh;display:flex;align-items:center;justify-content:center;background:#0f0f13;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#fff;text-align:center;padding:24px}h1{font-size:18px;font-weight:500;color:#ccc;margin-bottom:8px}.sub{font-size:13px;color:#777;margin-bottom:24px}button{padding:10px 28px;background:#84cc16;color:#0f0f13;border:none;border-radius:6px;font-size:14px;font-weight:600;cursor:pointer}</style>
</head><body><div><h1>No internet connection</h1><div class="sub">Check your connection and try again.</div><button onclick="location.reload()">Try again</button></div></body></html>`,
            {
              status: 200,
              headers: { "Content-Type": "text/html; charset=utf-8" },
            },
          );
        }),
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) =>
      fetch(event.request)
        .then((res) => {
          if (
            res.ok &&
            STATIC_ASSETS.includes(new URL(event.request.url).pathname)
          ) {
            caches
              .open(CACHE_NAME)
              .then((c) => c.put(event.request, res.clone()))
              .catch(() => {});
          }
          return res;
        })
        .catch(() => cached || new Response("", { status: 404 })),
    ),
  );
});

// ─── Deduplication ────────────────────────────────────────────────────────────
const _seenPushIds = new Map();

function _isDuplicatePush(payload) {
  const data = payload?.data || {};
  const type = data.type || "general";
  if (type === "incoming_call" || type === "dm") return false;

  const id =
    data.notification_id ||
    (data.actor_user_id && data.entity_id
      ? `${type}:${data.actor_user_id}:${data.entity_id}`
      : null);

  if (!id) return false;

  const ts = _seenPushIds.get(id);
  return !!(ts && Date.now() - ts < 90_000);
}

function _markSeen(payload) {
  const data = payload?.data || {};
  const type = data.type || "general";
  if (type === "incoming_call" || type === "dm") return;

  const id =
    data.notification_id ||
    (data.actor_user_id && data.entity_id
      ? `${type}:${data.actor_user_id}:${data.entity_id}`
      : null);

  if (!id) return;

  const now = Date.now();
  _seenPushIds.set(id, now);
  setTimeout(() => {
    if (_seenPushIds.get(id) === now) _seenPushIds.delete(id);
  }, 120_000);
}

// ─── Push Event ───────────────────────────────────────────────────────────────
self.addEventListener("push", (event) => {
  if (!event.data) {
    console.warn("[SW v13] Push received with no data.");
    event.waitUntil(
      self.registration.showNotification("Xeevia", {
        body: "You have a new notification",
        icon: "/logo192.png",
        badge: "/logo192.png",
        tag: `fallback_${Date.now()}`,
        data: { url: "/", type: "general" },
      }),
    );
    return;
  }

  let payload;
  try {
    payload = event.data.json();
  } catch (parseErr) {
    console.warn("[SW v13] Push payload is not valid JSON:", parseErr.message);
    const text = event.data.text() || "";
    payload = {
      title: "Xeevia",
      body: text || "New notification",
      data: { url: "/", type: "general" },
    };
  }

  const type = payload?.data?.type || "general";
  console.log("[SW v13] Push received — type:", type);

  storePayload(payload);

  event.waitUntil(
    (async () => {
      const clientList = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });

      clientList.forEach((client) => {
        try {
          client.postMessage({ type: "PUSH_RECEIVED", payload });
        } catch (_) {}
      });

      if (type === "incoming_call") {
        await _showOsNotificationSafe(payload);
        return;
      }

      if (_isDuplicatePush(payload)) {
        console.debug("[SW v13] Deduplicated:", type);
        return;
      }
      _markSeen(payload);

      if (type === "dm") {
        await _showOsNotificationSafe(payload);
        return;
      }

      const focusedClient = clientList.find(
        (c) => c.visibilityState === "visible",
      );
      if (!focusedClient) {
        await _showOsNotificationSafe(payload);
      }
    })(),
  );
});

// ─── Safe wrapper ─────────────────────────────────────────────────────────────
async function _showOsNotificationSafe(payload) {
  try {
    await _showOsNotification(payload);
  } catch (err) {
    console.error(
      "[SW v13] _showOsNotification threw:",
      err.message,
      "— showing fallback",
    );
    try {
      await self.registration.showNotification(payload?.title || "Xeevia", {
        body: payload?.body || "New notification",
        icon: "/logo192.png",
        badge: "/logo192.png",
        tag: `err_fallback_${Date.now()}`,
        data: {
          url: payload?.data?.url || "/",
          type: payload?.data?.type || "general",
        },
      });
    } catch (fbErr) {
      console.error(
        "[SW v13] Fallback notification also failed:",
        fbErr.message,
      );
    }
  }
}

// ─── Build OS Notification ────────────────────────────────────────────────────
function _showOsNotification(payload) {
  const type = payload?.data?.type || "general";
  const data = payload?.data || {};
  const notifId =
    data.notification_id ||
    data.call_id ||
    data.entity_id ||
    `xeevia_${Date.now()}`;
  const isCall = type === "incoming_call";
  const isDM = type === "dm";

  const tag = isCall
    ? `call_${data.call_id || notifId}`
    : isDM
      ? `dm_${data.conversation_id || notifId}`
      : `notif_${notifId}`;

  const options = {
    body: payload.body || _defaultBody(type, data),
    icon: "/logo192.png",
    badge: "/logo192.png",
    tag,
    renotify: true,
    silent: false,
    requireInteraction: isCall,
    vibrate: isCall
      ? [500, 100, 500, 100, 500, 100, 500]
      : isDM
        ? [200, 100, 200]
        : [150],
    actions: isCall
      ? [
          { action: "accept", title: "✅ Accept" },
          { action: "decline", title: "❌ Decline" },
        ]
      : isDM
        ? [
            { action: "view", title: "💬 Open" },
            { action: "dismiss", title: "Dismiss" },
          ]
        : [
            { action: "view", title: "View" },
            { action: "dismiss", title: "Dismiss" },
          ],
    data: {
      url: data.url || _defaultUrl(type, data),
      type,
      entity_id: data.entity_id || null,
      notification_id: notifId,
      conversation_id: data.conversation_id || null,
      call_id: data.call_id || null,
      caller_name: data.caller_name || data.callerName || null,
      call_type: data.call_type || data.callType || "audio",
      caller_avatar_id: data.caller_avatar_id || data.callerAvatarId || null,
      actor_user_id: data.actor_user_id || null,
    },
  };

  return self.registration.showNotification(payload.title || "Xeevia", options);
}

function _defaultBody(type, data) {
  const name =
    data?.caller_name || data?.callerName || data?.senderName || "Someone";
  const ct = data?.call_type || data?.callType || "audio";
  const map = {
    incoming_call: `${name} is calling — tap to answer ${ct === "video" ? "📹" : "📞"}`,
    dm: data?.message || "New message",
    like: "liked your post",
    comment: "commented on your post",
    comment_reply: "replied to your comment",
    follow: "started following you",
    mention: "mentioned you",
    new_post: "shared a new post",
    new_reel: "shared a new reel",
    new_story: "shared a new story",
    profile_view: "viewed your profile",
    unlock: "unlocked your story",
    payment_confirmed: "Payment confirmed",
    transfer_received: "You received money",
    milestone_followers: "Milestone reached! 🎉",
  };
  return map[type] || "";
}

function _defaultUrl(type, data) {
  const map = {
    incoming_call: "/messages",
    dm: "/messages",
    like: data?.entity_id ? `/post/${data.entity_id}` : "/",
    comment: data?.entity_id ? `/post/${data.entity_id}` : "/",
    comment_reply: data?.entity_id ? `/post/${data.entity_id}` : "/",
    mention: data?.entity_id ? `/post/${data.entity_id}` : "/",
    new_post: data?.entity_id ? `/post/${data.entity_id}` : "/",
    share: data?.entity_id ? `/post/${data.entity_id}` : "/",
    new_reel: data?.entity_id ? `/reel/${data.entity_id}` : "/",
    new_story: data?.entity_id ? `/story/${data.entity_id}` : "/",
    unlock: data?.entity_id ? `/story/${data.entity_id}` : "/",
    follow: data?.actor_user_id ? `/profile/${data.actor_user_id}` : "/",
    profile_view: data?.actor_user_id ? `/profile/${data.actor_user_id}` : "/",
    payment_confirmed: "/account",
    transfer_received: "/account",
    transfer_sent: "/account",
    milestone_followers: "/account",
  };
  return map[type] || data?.url || "/";
}

// ─── Notification Click ───────────────────────────────────────────────────────
self.addEventListener("notificationclick", (event) => {
  const notification = event.notification;
  const action = event.action;
  const data = notification.data || {};
  const type = data.type || "general";

  notification.close();

  if (type === "incoming_call") {
    if (action === "accept") {
      event.waitUntil(
        _focusOrOpen("/messages").then((client) => {
          if (client) {
            try {
              client.postMessage({
                type: "CALL_ACCEPTED_FROM_NOTIFICATION",
                data: {
                  call_id: data.call_id,
                  caller_name: data.caller_name,
                  call_type: data.call_type,
                  caller_avatar_id: data.caller_avatar_id,
                  actor_user_id: data.actor_user_id,
                },
              });
            } catch (_) {}
          }
        }),
      );
      return;
    }
    if (action === "decline") {
      event.waitUntil(
        self.clients
          .matchAll({ type: "window", includeUncontrolled: true })
          .then((clients) => {
            clients.forEach((client) => {
              try {
                client.postMessage({
                  type: "CALL_DECLINED_FROM_NOTIFICATION",
                  data: { call_id: data.call_id },
                });
              } catch (_) {}
            });
          }),
      );
      return;
    }
    event.waitUntil(_focusOrOpen("/messages"));
    return;
  }

  if (action === "dismiss") return;

  const url = data.url || _defaultUrl(type, data);
  event.waitUntil(
    _focusOrOpen(url).then((client) => {
      if (client) {
        try {
          client.postMessage({ type: "NOTIFICATION_CLICKED", url, data });
        } catch (_) {}
      }
    }),
  );
});

// ─── Notification Close ───────────────────────────────────────────────────────
self.addEventListener("notificationclose", (event) => {
  const data = event.notification.data || {};
  const type = data.type || "general";

  if (type === "incoming_call") {
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clients) => {
        clients.forEach((client) => {
          try {
            client.postMessage({
              type: "CALL_DECLINED_FROM_NOTIFICATION",
              data: { call_id: data.call_id, dismissed: true },
            });
          } catch (_) {}
        });
      });
  }
});

// ─── Message Handler ──────────────────────────────────────────────────────────
self.addEventListener("message", (event) => {
  const msg = event.data;
  if (!msg?.type) return;

  switch (msg.type) {
    case "SKIP_WAITING":
      // [FIX-SW-2] This is the ONLY place skipWaiting is called.
      // It fires only when the user explicitly taps "Update" in the
      // update card — never automatically. This means the app reloads
      // cleanly with a full cache already populated, so Chrome never
      // sees a blank/broken manifest during the transition.
      console.log("[SW v13] SKIP_WAITING received — user-initiated update");
      self.skipWaiting();
      break;

    case "GET_PENDING_PAYLOADS":
      event.waitUntil(
        getAllPendingPayloads().then((payloads) => {
          if (!payloads.length) return;
          if (event.source) {
            try {
              event.source.postMessage({ type: "PENDING_PAYLOADS", payloads });
            } catch (_) {}
          }
          self.clients
            .matchAll({ type: "window", includeUncontrolled: true })
            .then((clients) => {
              clients.forEach((client) => {
                if (client.id === event.source?.id) return;
                try {
                  client.postMessage({ type: "PENDING_PAYLOADS", payloads });
                } catch (_) {}
              });
            });
        }),
      );
      break;

    case "CLEAR_BADGE":
      if ("clearAppBadge" in navigator) {
        navigator.clearAppBadge().catch(() => {});
      }
      break;

    case "PING":
      try {
        event.source?.postMessage({ type: "PONG", version: SW_VERSION });
      } catch (_) {}
      break;

    default:
      break;
  }
});

// ─── Focus or Open ────────────────────────────────────────────────────────────
async function _focusOrOpen(url) {
  const absoluteUrl = new URL(url, self.registration.scope).href;

  const clients = await self.clients.matchAll({
    type: "window",
    includeUncontrolled: true,
  });

  const existing = clients.find(
    (c) =>
      c.url.startsWith(self.registration.scope) ||
      c.url.startsWith(new URL("/", self.registration.scope).href),
  );

  if (existing) {
    try {
      await existing.focus();
    } catch (_) {}
    if (existing.url !== absoluteUrl) {
      try {
        await existing.navigate(absoluteUrl);
      } catch (_) {
        try {
          existing.postMessage({ type: "SW_NAVIGATE", url });
        } catch (_2) {}
      }
    }
    return existing;
  }

  try {
    const newClient = await self.clients.openWindow(absoluteUrl);
    return newClient;
  } catch (err) {
    console.error("[SW v13] Failed to open window:", err);
    return null;
  }
}
