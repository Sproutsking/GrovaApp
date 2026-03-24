// ============================================================================
// public/service-worker.js — Xeevia POISON PILL + v4 OFFLINE-SAFE
// ============================================================================
//
// PHASE 1 — POISON PILL (runs immediately on install):
//   Every browser that has ANY old Xeevia SW cached will fetch this file,
//   install it, and immediately:
//     1. Delete every cache
//     2. Take over all clients
//     3. Force a silent reload of every open tab into the clean fresh app
//   The user sees nothing. Zero user action required. Works automatically
//   for every single person including investors opening the app cold.
//
// PHASE 2 — After the reload, no old SW exists. The page loads clean.
//   serviceWorkerRegistration.js registers this file fresh. This time
//   hasOldCache is false so the poison pill branch is skipped and normal
//   v4 operation resumes permanently.
//
// ROOT CAUSE THIS FIXES:
//   Old SW fetch handler did:
//     .catch(() => cached || new Response("Offline", { status: 503 }))
//   That bare text response was served for the index.html navigation request
//   itself, rendering a black page showing only the word "Offline".
//   The new fetch handler NEVER serves a bare text response for navigations.
// ============================================================================

const CACHE_NAME  = "xeevia-v2026-pro-4";
const SW_VERSION  = "xeevia-1.0.4";

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

  event.waitUntil(
    (async () => {
      const existingKeys = await caches.keys();
      const hasOldCache  = existingKeys.some((k) => k !== CACHE_NAME);

      if (hasOldCache) {
        // ── POISON PILL ────────────────────────────────────────────────────
        console.log("[SW] Old cache detected — running poison pill cleanup");

        // 1. Wipe every cache in the browser for this origin
        await Promise.all(existingKeys.map((k) => caches.delete(k)));

        // 2. Take over immediately — don't wait for tabs to close
        await self.skipWaiting();

        // 3. Tell every open tab to reload silently
        //    serviceWorkerRegistration.js listens for this message and calls
        //    window.location.reload() — the user just sees a normal page refresh
        const clients = await self.clients.matchAll({
          type: "window",
          includeUncontrolled: true,
        });
        for (const client of clients) {
          try { client.postMessage({ type: "SW_POISON_PILL_RELOAD" }); } catch (_) {}
        }

        return; // Skip normal cache population — the reload will handle it
      }

      // ── Normal fresh install — no old cache ────────────────────────────
      self.skipWaiting();
      const cache = await caches.open(CACHE_NAME);
      await cache.addAll(STATIC_ASSETS);
    })(),
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
// Strategy A — navigate (HTML page loads):
//   Network first. On failure serve cached /index.html so React can boot.
//   NEVER return a bare text/503 — that was the original bug.
//
// Strategy B — everything else (JS, CSS, images, API):
//   Cache first, network revalidation. On total miss fail naturally —
//   never a synthetic 503.
//
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  // ── Strategy A ────────────────────────────────────────────────────────────
  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request)
        .then((res) => {
          if (res.ok) {
            caches
              .open(CACHE_NAME)
              .then((cache) => cache.put(event.request, res.clone()))
              .catch(() => {});
          }
          return res;
        })
        .catch(() =>
          caches
            .match("/index.html")
            .then((cached) => cached || caches.match("/"))
            .catch(() => undefined),
        ),
    );
    return;
  }

  // ── Strategy B ────────────────────────────────────────────────────────────
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
              .then((cache) => cache.put(event.request, res.clone()))
              .catch(() => {});
          }
          return res;
        })
        .catch(() => cached || undefined),
    ),
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

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        const focusedClient = clientList.find(
          (c) => c.visibilityState === "visible",
        );

        if (focusedClient) {
          focusedClient.postMessage({ type: "PUSH_RECEIVED", payload });
          return;
        }

        return self.registration.showNotification(payload.title || "Xeevia", {
          body:               payload.body    || "",
          icon:               payload.icon    || "/logo192.png",
          badge:              payload.badge   || "/logo192.png",
          tag:                payload.tag     || "xeevia-notif",
          vibrate:            payload.vibrate || [200, 100, 200],
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
        });
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
        const appClient = clientList.find((c) =>
          c.url.includes(self.location.origin),
        );
        if (appClient) {
          appClient.postMessage({ type: "NOTIFICATION_CLICKED", url: targetUrl, data: notifData });
          return appClient.focus();
        }
        return self.clients.openWindow(targetUrl);
      }),
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
      if ("clearAppBadge" in self.navigator) {
        self.navigator.clearAppBadge().catch(() => {});
      }
      break;
    default:
      break;
  }
});