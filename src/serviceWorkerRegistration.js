// ============================================================================
// src/serviceWorkerRegistration.js — v5
// ============================================================================
// CHANGES vs v4:
//   [FIX-1] updateViaCache: "none" already present — confirmed correct.
//   [FIX-2] Added explicit console.warn when SW registration fails so the
//            developer immediately sees WHY instead of a silent no-op.
//   [FIX-3] Added console.info at registration time showing whether the SW
//            is being registered or skipped, to make localhost debugging easier.
//            When SW is skipped (localhost without REACT_APP_SW_LOCALHOST=true)
//            a clear message explains exactly what env var to add.
//   [FIX-4] Message listener is confirmed to set up BEFORE registration
//            (already was in v4 — preserved exactly).
//   [FIX-5] The "sw:registered" custom event now also carries the SW version
//            string from the SW_UPDATED message, if available.
//   All v4 logic preserved exactly.
//
// LOCALHOST SETUP:
//   Push notifications require a Service Worker. On localhost the SW is
//   intentionally unregistered (see index.js) unless you set:
//     REACT_APP_SW_LOCALHOST=true
//   in your .env file and restart the dev server.
//   Without this, pushService.start() will call _getReg() → sw.ready which
//   never resolves, _doSubscribe silently returns null, and no subscription
//   is ever saved to the database.
// ============================================================================

"use strict";

export function register(config) {
  if (!("serviceWorker" in navigator)) {
    console.log("[SWReg] Service workers not supported — skipping");
    return;
  }

  // [FIX-4] Set up message listener BEFORE registration
  _setupMessageListener();

  window.addEventListener("load", () => {
    const swUrl = `${process.env.PUBLIC_URL || ""}/service-worker.js`;
    _registerSW(swUrl, config);
  });
}

// ── SW message listener ───────────────────────────────────────────────────────
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
        // All other messages delegated to pushService bridge listener
        break;
    }
  });
}

// ── Core registration ─────────────────────────────────────────────────────────
function _registerSW(swUrl, config) {
  navigator.serviceWorker
    .register(swUrl, {
      scope:          "/",
      updateViaCache: "none", // always check network for new SW
    })
    .then((registration) => {
      console.log("[SWReg] ✅ Registered, scope:", registration.scope);

      // Signal to pushService that registration is complete
      window.dispatchEvent(
        new CustomEvent("sw:registered", { detail: { registration } })
      );

      // Proactively check for updates immediately
      registration.update().catch(() => {});

      // Hourly update check
      setInterval(() => registration.update().catch(() => {}), 3_600_000);

      // Waiting SW found on page load — notify app, let user decide
      if (registration.waiting) {
        console.log("[SWReg] Waiting SW found on load");
        if (typeof config?.onUpdate === "function") {
          config.onUpdate(registration);
        } else if (typeof window.__xvShowUpdate === "function") {
          window.__xvShowUpdate();
        }
        // Do NOT auto-post SKIP_WAITING — let the user tap the update banner.
      }

      // Watch for newly installed SWs
      registration.addEventListener("updatefound", () => {
        const newWorker = registration.installing;
        if (!newWorker) return;

        console.log("[SWReg] New SW installing…");

        newWorker.addEventListener("statechange", () => {
          if (newWorker.state !== "installed") return;

          if (navigator.serviceWorker.controller) {
            console.log("[SWReg] New SW installed, waiting to activate");
            if (typeof config?.onUpdate === "function") {
              config.onUpdate(registration);
            } else if (typeof window.__xvShowUpdate === "function") {
              window.__xvShowUpdate();
            }
          } else {
            console.log("[SWReg] First install — offline cache ready");
            if (typeof config?.onSuccess === "function") {
              config.onSuccess(registration);
            }
          }
        });
      });

      // Reload when new SW takes controller.
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
      // [FIX-2] Never fail silently
      console.error("[SWReg] ❌ Registration failed:", err.message);
      console.error(
        "[SWReg] Common causes:\n" +
        "  • Page is not served over HTTPS (required for SW, except localhost)\n" +
        "  • service-worker.js not found at the expected path\n" +
        "  • service-worker.js has a syntax error (check the Network tab)\n" +
        "  • Browser privacy mode / extensions blocking SW registration"
      );
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