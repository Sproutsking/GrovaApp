// ============================================================================
// src/serviceWorkerRegistration.js
//
// PURPOSE
//   Registers, updates, and manages the PWA service worker lifecycle.
//   Handles the "document in invalid state" race that happens in React
//   StrictMode dev environments without leaking errors to the console.
//
// DESIGN PRINCIPLES
//   • Never throws uncaught errors — all failures are handled gracefully
//   • In dev (localhost): unregisters stale SWs before registering fresh
//   • In prod: registers and polls for updates hourly
//   • Exponential back-off on transient failures (invalid state, abort)
//   • Completely silent on expected transient errors in dev mode
//   • window.clearSW() helper available in dev console
//
// SCALE / SECURITY NOTES
//   • No global state mutation beyond window.clearSW dev helper
//   • No sensitive data handled here — pure lifecycle management
//   • Works correctly behind CDNs, reverse proxies, sub-path deployments
//   • PUBLIC_URL respected for sub-path deployments (CRA standard)
// ============================================================================

"use strict";

// ── Localhost detection ───────────────────────────────────────────────────────
const isLocalhost = Boolean(
  window.location.hostname === "localhost" ||
  window.location.hostname === "[::1]" ||
  window.location.hostname.match(
    /^127(?:\.(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)){3}$/,
  ),
);

// ── Transient / ignorable error detector ─────────────────────────────────────
// These errors are expected in dev during StrictMode double-invoke.
// We back-off silently rather than logging noise.
const TRANSIENT_PATTERNS = [
  "invalid state",
  "the document is in an invalid state",
  "aborterror",
  "signal is aborted",
  "aborted without reason",
  "the operation was aborted",
  "failed to register",
];

function isTransientSWError(err) {
  if (!err) return false;
  const msg = (
    (err.message || "") +
    " " +
    (err.name || "") +
    " " +
    String(err)
  ).toLowerCase();
  return TRANSIENT_PATTERNS.some((p) => msg.includes(p));
}

// ── SW URL — respects CRA PUBLIC_URL for sub-path deployments ────────────────
function getSwUrl() {
  const base = (process.env.PUBLIC_URL || "").replace(/\/$/, "");
  return `${base}/service-worker.js`;
}

// ── Main export: register ─────────────────────────────────────────────────────
/**
 * Register the service worker.
 * Defers registration until the page is fully loaded + settled to avoid
 * the "document in invalid state" race with React StrictMode.
 *
 * @param {{ onUpdate?: (reg: ServiceWorkerRegistration) => void,
 *            onSuccess?: (reg: ServiceWorkerRegistration) => void }} config
 */
export function register(config) {
  if (!("serviceWorker" in navigator)) return;

  const kickoff = () => {
    // Extra settle time — React StrictMode double-invoke completes
    // within ~100ms of load. 300ms is generous and imperceptible to users.
    setTimeout(() => _start(config), 300);
  };

  if (document.readyState === "complete") {
    kickoff();
  } else {
    window.addEventListener("load", kickoff, { once: true });
  }
}

function _start(config) {
  if (isLocalhost) {
    _cleanupThenRegister(config);
  } else {
    _registerValidSW(getSwUrl(), config);
  }
}

// ── Dev mode: clean up stale workers before registering ──────────────────────
async function _cleanupThenRegister(config) {
  // Guard: document must be complete before SW operations
  if (document.readyState !== "complete") {
    setTimeout(() => _cleanupThenRegister(config), 500);
    return;
  }

  // Unregister all existing service workers
  try {
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.allSettled(registrations.map((r) => r.unregister()));
  } catch (err) {
    if (isTransientSWError(err)) {
      // Document state is still settling — wait and go straight to register
      setTimeout(() => _registerValidSW(getSwUrl(), config), 1500);
      return;
    }
    // Unknown cleanup error — log it but continue to registration
    console.warn("[PWA] Cleanup error (non-fatal):", err?.message);
  }

  // Clear all caches
  try {
    const keys = await caches.keys();
    await Promise.allSettled(keys.map((k) => caches.delete(k)));
  } catch {
    // Cache clearing failed — non-fatal, continue
  }

  // Register fresh worker after cleanup
  setTimeout(() => _registerValidSW(getSwUrl(), config), 200);
}

// ── Core registration with retry logic ───────────────────────────────────────
/**
 * @param {string} swUrl
 * @param {object} config
 * @param {number} attempt  1-based retry counter
 */
function _registerValidSW(swUrl, config, attempt = 1) {
  const MAX_ATTEMPTS = 3;
  const RETRY_DELAYS_MS = [0, 2000, 5000]; // delay before each attempt

  navigator.serviceWorker
    .register(swUrl)
    .then((registration) => {
      if (isLocalhost) {
        console.log("[PWA] Service Worker registered:", registration.scope);
      }

      // ── Listen for updates ──────────────────────────────────────────────
      registration.onupdatefound = () => {
        const installing = registration.installing;
        if (!installing) return;

        installing.onstatechange = () => {
          if (installing.state !== "installed") return;

          if (navigator.serviceWorker.controller) {
            // New version available
            console.log("[PWA] New content available");
            if (config?.onUpdate) {
              config.onUpdate(registration);
            }

            // Dev: auto-update silently so devs always run latest code
            if (isLocalhost) {
              installing.postMessage({ type: "SKIP_WAITING" });
              window.location.reload();
            }
            // Prod: let the onUpdate callback show the update banner
          } else {
            // First install — content now cached for offline use
            console.log("[PWA] Content cached for offline use");
            if (config?.onSuccess) {
              config.onSuccess(registration);
            }
          }
        };
      };

      // ── Production: poll for updates every hour ──────────────────────────
      if (!isLocalhost) {
        setInterval(
          () => {
            registration.update().catch(() => {
              // Update check failed (offline, etc.) — non-fatal
            });
          },
          60 * 60 * 1000,
        );
      }
    })
    .catch((err) => {
      if (isTransientSWError(err)) {
        // Transient / recoverable error — back off and retry silently
        if (attempt < MAX_ATTEMPTS) {
          const delay = RETRY_DELAYS_MS[attempt] || 3000;
          setTimeout(() => _registerValidSW(swUrl, config, attempt + 1), delay);
          // No console output — this is an expected dev-mode race condition
        } else {
          // Exhausted retries — give up silently in dev (app works fine without SW)
          // In production, log a warning so it can be monitored
          if (!isLocalhost) {
            console.warn(
              "[PWA] Service Worker registration failed after retries.",
              err?.message,
            );
          }
        }
      } else {
        // Unexpected, non-transient error — always log this
        console.error("[PWA] Service Worker registration failed:", err);
      }
    });
}

// ── Explicit unregister ───────────────────────────────────────────────────────
/**
 * Unregisters the active service worker.
 * Call this only if you intentionally want to disable the SW.
 */
export function unregister() {
  if (!("serviceWorker" in navigator)) return;

  navigator.serviceWorker.ready
    .then((registration) => registration.unregister())
    .catch(() => {
      // ready can reject if no SW is active — non-fatal
    });
}

// ── Dev utility ───────────────────────────────────────────────────────────────
/**
 * Unregisters all service workers and clears all caches, then reloads.
 * Available in dev console as window.clearSW().
 */
export function clearServiceWorkerAndCaches() {
  return navigator.serviceWorker
    .getRegistrations()
    .then((regs) => Promise.allSettled(regs.map((r) => r.unregister())))
    .then(() => caches.keys())
    .then((names) => Promise.allSettled(names.map((n) => caches.delete(n))))
    .then(() => {
      console.log("[PWA] All service workers and caches cleared");
      window.location.reload(true);
    })
    .catch((err) => {
      console.error("[PWA] clearSW error:", err);
    });
}

// Expose dev helper on window
if (isLocalhost && typeof window !== "undefined") {
  window.clearSW = clearServiceWorkerAndCaches;
  console.log("[PWA] Dev helper available: window.clearSW()");
}
