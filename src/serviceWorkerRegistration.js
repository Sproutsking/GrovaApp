"use strict";

// ============================================================================
// src/serviceWorkerRegistration.js — Xeevia v2 POISON-PILL-AWARE
// ============================================================================
//
// CHANGES vs v1:
//   [1] SW_POISON_PILL_RELOAD listener — when the new SW detects an old
//       broken cache and posts this message, every open tab calls
//       window.location.reload() automatically. The user sees a normal
//       page refresh and lands on the clean app. Zero manual steps needed.
//   [2] Waiting SW fast-track — if a SW is already in waiting state when
//       the page loads, we immediately post SKIP_WAITING so it activates
//       without requiring a tab close.
//   [3] controllerchange reload — when the SW controller changes (new SW
//       took over) we reload once so the app is served fresh.
//   [4] Dev mode guard unchanged — SW never runs on localhost.
// ============================================================================

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

  // ── Listen for poison pill reload message from SW ─────────────────────────
  // The new SW posts SW_POISON_PILL_RELOAD when it detects and nukes an old
  // broken cache. We reload the page so the user lands on the clean app.
  navigator.serviceWorker.addEventListener("message", (event) => {
    if (event.data?.type === "SW_POISON_PILL_RELOAD") {
      console.log("[PWA] Poison pill cleanup complete — reloading");
      window.location.reload();
    }
  });

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

        // If a new worker is already waiting, activate it immediately
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
              if (config?.onUpdate) {
                config.onUpdate(reg);
              } else if (typeof window.__xvShowUpdate === "function") {
                window.__xvShowUpdate();
              }
            }

            if (
              newWorker.state === "activated" &&
              !navigator.serviceWorker.controller
            ) {
              if (config?.onSuccess) {
                config.onSuccess(reg);
              }
            }
          });
        });

        // When SW controller changes (new SW took over), reload once
        let refreshing = false;
        navigator.serviceWorker.addEventListener("controllerchange", () => {
          if (refreshing) return;
          refreshing = true;
          window.location.reload();
        });
      })
      .catch((err) =>
        console.warn("[PWA] SW registration failed:", err.message),
      );
  });
}

export function unregister() {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.getRegistrations().then((regs) => {
      regs.forEach((reg) => reg.unregister());
    });
  }
}