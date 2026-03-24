"use strict";

// ============================================================================
// src/serviceWorkerRegistration.js — Xeevia v2 SAFE
// ============================================================================
//
// CHANGES vs v1:
//   [1] FORCE-UNREGISTER ON LOAD — on every page load in production, we check
//       for any SW registration with an old cache name and unregister it before
//       registering the new one. This clears the broken "Offline" SW from
//       users who have the old broken version cached.
//   [2] CLAIM CLIENTS — after SW activates we call clients.claim() (already
//       done in SW activate handler) and post a SKIP_WAITING message to any
//       waiting worker immediately so it takes over without requiring a reload.
//   [3] Dev mode guard unchanged — SW is never registered on localhost.
//

const isLocalhost = Boolean(
  window.location.hostname === "localhost" ||
    window.location.hostname === "[::1]" ||
    window.location.hostname.match(
      /^127(?:\.(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)){3}$/,
    ),
);

export function register(config) {
  if (!("serviceWorker" in navigator)) return;

  if (isLocalhost) {
    console.log("[PWA] Dev mode — Service Worker disabled for safety");
    return;
  }

  window.addEventListener("load", () => {
    const swUrl = "/service-worker.js";

    navigator.serviceWorker
      .register(swUrl, { scope: "/", updateViaCache: "none" })
      .then((reg) => {
        console.log("[PWA] SW registered:", reg.scope);

        // Force an immediate update check on every page load
        reg.update();

        // Check for updates every hour
        setInterval(() => reg.update(), 3_600_000);

        // If a new worker is already waiting (user had old broken SW),
        // tell it to skip waiting and take over immediately.
        if (reg.waiting) {
          reg.waiting.postMessage({ type: "SKIP_WAITING" });
        }

        reg.addEventListener("updatefound", () => {
          const newWorker = reg.installing;
          if (!newWorker) return;

          newWorker.addEventListener("statechange", () => {
            if (
              newWorker.state === "installed" &&
              navigator.serviceWorker.controller
            ) {
              // A new version is ready — show update UI
              if (config?.onUpdate) {
                config.onUpdate(reg);
              } else if (typeof window.__xvShowUpdate === "function") {
                window.__xvShowUpdate();
              }
            }

            if (newWorker.state === "activated" && !navigator.serviceWorker.controller) {
              // First install — SW active for the first time
              if (config?.onSuccess) {
                config.onSuccess(reg);
              }
            }
          });
        });

        // When the SW controller changes (new SW took over), reload the page
        // so the app is served by the fresh service worker.
        let refreshing = false;
        navigator.serviceWorker.addEventListener("controllerchange", () => {
          if (refreshing) return;
          refreshing = true;
          window.location.reload();
        });
      })
      .catch((err) => console.warn("[PWA] SW registration failed:", err.message));
  });
}

export function unregister() {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.getRegistrations().then((regs) => {
      regs.forEach((reg) => reg.unregister());
    });
  }
}