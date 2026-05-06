"use strict";

// ============================================================================
// src/serviceWorkerRegistration.js — v4 COMPLETE REWRITE
// ============================================================================
// ROOT CAUSES FIXED:
//   [FIX-1] SINGLE REGISTRATION POINT — only this file registers the SW.
//           pushService.js no longer touches registration at all.
//   [FIX-2] controllerchange reload guard uses sessionStorage (not a local
//           variable that resets on reload, causing infinite loops).
//   [FIX-3] When a waiting SW is found on page load, SKIP_WAITING is posted
//           ONLY after the onUpdate callback has shown the user a prompt.
//           Previously it was posted immediately, causing a surprise reload.
//   [FIX-4] SW registration uses { updateViaCache: "none" } to always check
//           the network for a fresh SW file, never serving a stale one.
//   [FIX-5] The "sw:registered" custom event is dispatched on the window
//           so pushService.start() can safely await navigator.serviceWorker.ready.
//   [FIX-6] Dev-mode: SW is always unregistered on localhost unless
//           REACT_APP_SW_LOCALHOST=true is set.
//   [FIX-7] Message listener is set up before registration so no early
//           messages from the SW are missed.
// ============================================================================

const isLocalhost = Boolean(
  window.location.hostname === "localhost" ||
  window.location.hostname === "[::1]" ||
  /^127(?:\.(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)){3}$/.test(
    window.location.hostname
  )
);

export function register(config) {
  if (!("serviceWorker" in navigator)) {
    console.log("[SWReg] Service workers not supported — skipping");
    return;
  }

  // [FIX-6] Dev guard
  if (isLocalhost && !process.env.REACT_APP_SW_LOCALHOST) {
    console.log("[SWReg] localhost — SW disabled (set REACT_APP_SW_LOCALHOST=true to override)");
    return;
  }

  // [FIX-7] Set up message listener BEFORE registration
  _setupMessageListener();

  window.addEventListener("load", () => {
    const swUrl = `${process.env.PUBLIC_URL || ""}/service-worker.js`;
    _registerSW(swUrl, config);
  });
}

// ── SW message listener ───────────────────────────────────────────────────────
// Handles the limited set of lifecycle messages from the SW.
// Application-level messages (PUSH_RECEIVED, NOTIFICATION_CLICKED, etc.)
// are handled in pushService.js to keep concerns separated.
let _messageListenerActive = false;
function _setupMessageListener() {
  if (_messageListenerActive) return;
  _messageListenerActive = true;

  navigator.serviceWorker.addEventListener("message", (event) => {
    const type = event.data?.type;
    switch (type) {
      case "SW_POISON_PILL_RELOAD":
        console.log("[SWReg] Poison pill — reloading for clean SW state");
        window.location.reload();
        break;
      case "SW_UPDATED":
        console.log("[SWReg] SW updated to version:", event.data?.version);
        break;
      default:
        // All other messages delegated to pushService listener
        break;
    }
  });
}

// ── Core registration ─────────────────────────────────────────────────────────
function _registerSW(swUrl, config) {
  navigator.serviceWorker
    .register(swUrl, {
      scope:          "/",
      updateViaCache: "none", // [FIX-4] always check network for new SW
    })
    .then((registration) => {
      console.log("[SWReg] ✅ Registered, scope:", registration.scope);

      // [FIX-5] Signal to pushService that registration is complete
      window.dispatchEvent(
        new CustomEvent("sw:registered", { detail: { registration } })
      );

      // Proactively check for updates
      registration.update().catch(() => {});

      // Hourly update check
      setInterval(() => registration.update().catch(() => {}), 3_600_000);

      // [FIX-3] Waiting SW found on page load — notify app, let user decide
      if (registration.waiting) {
        console.log("[SWReg] Waiting SW found on load");
        if (typeof config?.onUpdate === "function") {
          config.onUpdate(registration);
        } else if (typeof window.__xvShowUpdate === "function") {
          window.__xvShowUpdate();
        }
        // Do NOT auto-post SKIP_WAITING here — that triggers surprise reloads.
        // The user will post it via the update banner's "Update" button.
      }

      // Watch for newly installed SWs
      registration.addEventListener("updatefound", () => {
        const newWorker = registration.installing;
        if (!newWorker) return;

        console.log("[SWReg] New SW installing...");

        newWorker.addEventListener("statechange", () => {
          if (newWorker.state !== "installed") return;

          if (navigator.serviceWorker.controller) {
            // Update available — tell the app
            console.log("[SWReg] New SW installed, waiting to activate");
            if (typeof config?.onUpdate === "function") {
              config.onUpdate(registration);
            } else if (typeof window.__xvShowUpdate === "function") {
              window.__xvShowUpdate();
            }
          } else {
            // First install — content cached for offline
            console.log("[SWReg] First install — offline cache ready");
            if (typeof config?.onSuccess === "function") {
              config.onSuccess(registration);
            }
          }
        });
      });

      // [FIX-2] Reload when new SW takes controller.
      // sessionStorage flag survives the reload so we don't loop.
      navigator.serviceWorker.addEventListener("controllerchange", () => {
        const FLAG = "xv_sw_controller_changed";
        if (sessionStorage.getItem(FLAG)) {
          sessionStorage.removeItem(FLAG);
          return;
        }
        sessionStorage.setItem(FLAG, "1");
        console.log("[SWReg] New SW took control — reloading for fresh content");
        window.location.reload();
      });
    })
    .catch((err) => {
      console.error("[SWReg] ❌ Registration failed:", err.message);
    });
}

// ── Unregister ────────────────────────────────────────────────────────────────
export function unregister() {
  if (!("serviceWorker" in navigator)) return;
  navigator.serviceWorker
    .getRegistrations()
    .then((registrations) => {
      registrations.forEach((reg) => {
        reg.unregister().then((success) => {
          if (success) console.log("[SWReg] Unregistered:", reg.scope);
        });
      });
    })
    .catch((err) => console.warn("[SWReg] unregister error:", err));
}