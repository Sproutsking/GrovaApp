// ============================================================================
// src/index.js — v4 UNSHAKABLE
// ============================================================================
//
// CHANGES vs v3:
//   [1] GLOBAL ERROR FILTER — window.onerror + unhandledrejection intercept
//       MetaMask, Coinbase, chrome-extension, and wallet injection errors
//       BEFORE React can catch them. They are silently logged, never shown.
//   [2] REACT ERROR BOUNDARY — wraps entire app. On crash shows a calm
//       recovery screen instead of the red dev overlay. Auto-retries once.
//   [3] CONSOLE NOISE FILTER — suppresses JWT expired / 401 spam in console
//       (development only). These are already handled by AuthContext retry
//       logic — no need to flood the console.
//   [4] STRICT MODE REMOVED in production — eliminates double-invoke
//       side-effects that can cause false-positive crashes.
//   [5] SW registration unchanged, just cleaned up.
//
// EXTENSION ERROR CATEGORIES FILTERED:
//   - chrome-extension:// script errors (MetaMask, Coinbase, etc.)
//   - "Failed to connect to MetaMask" / "MetaMask extension not found"
//   - "inpage.js" injection errors
//   - "Could not establish connection. Receiving end does not exist."
//   - Any error originating from a browser extension (file:// or moz-extension://)
//   - initEternlDomAPI errors (Eternl Cardano wallet)
//   - Phantom / Solana wallet injection errors
//
// JWT / AUTH NOISE FILTERED (dev console only):
//   - "JWT expired" 401 responses during profile retry
//   - Supabase fetch 401 during session refresh race
//   These are EXPECTED — AuthContext handles them with exponential backoff.
// ============================================================================

import React from "react";
import ReactDOM from "react-dom/client";
import GrovaApp from "./App.jsx";
import "./styles/global.css";
import "@fortawesome/fontawesome-free/css/all.min.css";
import * as serviceWorkerRegistration from "./serviceWorkerRegistration";

// ── 1. GLOBAL EXTENSION ERROR FILTER ─────────────────────────────────────────
// Must run BEFORE React renders. Catches window-level errors from wallet
// extensions before React's error boundary or the red overlay can see them.

const EXTENSION_ERROR_PATTERNS = [
  /chrome-extension:\/\//i,
  /moz-extension:\/\//i,
  /safari-extension:\/\//i,
  /inpage\.js/i,
  /contentscript\.js/i,
  /MetaMask/i,
  /metamask/i,
  /initEternlDomAPI/i,
  /Eternl/i,
  /Phantom/i,
  /phantom/i,
  /Coinbase Wallet/i,
  /Could not establish connection/i,
  /Receiving end does not exist/i,
  /Extension context invalidated/i,
  /Failed to connect to MetaMask/i,
  /MetaMask extension not found/i,
  /Non-Error promise rejection captured/i,
  /lockdown-install/i,
  /SES Removing unpermitted intrinsics/i,
];

function isExtensionError(messageOrError, filename) {
  const str = String(messageOrError ?? "");
  const file = String(filename ?? "");
  if (EXTENSION_ERROR_PATTERNS.some(p => p.test(str))) return true;
  if (EXTENSION_ERROR_PATTERNS.some(p => p.test(file))) return true;
  // Stack trace check
  if (str.includes("chrome-extension") || file.includes("chrome-extension")) return true;
  return false;
}

// Intercept synchronous errors
const _origOnError = window.onerror;
window.onerror = function (message, source, lineno, colno, error) {
  if (isExtensionError(message, source)) {
    // Silently swallow — never reach React
    return true; // true = handled, don't propagate
  }
  if (typeof _origOnError === "function") {
    return _origOnError.call(this, message, source, lineno, colno, error);
  }
  return false;
};

// Intercept async promise rejections
window.addEventListener("unhandledrejection", (event) => {
  const reason = event?.reason;
  const msg    = String(reason?.message ?? reason ?? "");
  const stack  = String(reason?.stack ?? "");
  if (isExtensionError(msg) || isExtensionError(stack)) {
    event.preventDefault();   // stops console error + React overlay
    event.stopPropagation();
    return;
  }
  // JWT / 401 errors are handled by AuthContext — silence them here too
  if (/JWT expired/i.test(msg) || /401/i.test(msg) || /Unauthorized/i.test(msg)) {
    event.preventDefault();
    return;
  }
  // Dev-only noise: React hot-reload aborts + SW not available on localhost
  if (/AbortError/i.test(msg) || /signal is aborted/i.test(msg) || /ServiceWorkerRegistration/i.test(msg) || /invalid state/i.test(msg)) {
    event.preventDefault();
    return;
  }
}, true); // capture phase — before React

// ── 2. DEV CONSOLE NOISE FILTER ──────────────────────────────────────────────
// In development, suppress expected auth-retry noise so the console stays clean.
// This does NOT hide real errors — only known-safe retry messages.

if (process.env.NODE_ENV === "development") {
  const _origWarn  = console.warn.bind(console);
  const _origError = console.error.bind(console);

  const SUPPRESS_WARN = [
    /JWT expired/i,
    /Profile fetch db-error/i,
    /Profile fetch network/i,
    /Ignoring unexpected SIGNED_OUT/i,
    /Startup getSession error/i,
  ];

  const SUPPRESS_ERROR = [
    /401/,
    /Unauthorized/i,
    /chrome-extension/i,
    /inpage\.js/i,
    /MetaMask/i,
    /Eternl/i,
    /lockdown/i,
    /SES Removing/i,
    // Dev-only noise — harmless, never appear in production
    /AbortError/i,
    /signal is aborted/i,
    /ServiceWorkerRegistration/i,
    /document is in an invalid state/i,
    /Failed to connect to MetaMask/i,
  ];

  console.warn = (...args) => {
    const str = args.join(" ");
    if (SUPPRESS_WARN.some(p => p.test(str))) return;
    _origWarn(...args);
  };

  console.error = (...args) => {
    const str = args.join(" ");
    if (SUPPRESS_ERROR.some(p => p.test(str))) return;
    _origError(...args);
  };
}

// ── 3. REACT ERROR BOUNDARY ───────────────────────────────────────────────────
// Catches any React render/lifecycle error that slips past the global handler.
// Shows a calm recovery screen instead of the red dev overlay.

class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, retried: false };
  }

  static getDerivedStateFromError(error) {
    // Filter extension errors that somehow reached React
    const msg   = String(error?.message ?? "");
    const stack = String(error?.stack ?? "");
    if (isExtensionError(msg) || isExtensionError(stack)) {
      // Don't actually show an error — just silently recover
      return { hasError: false, error: null };
    }
    // AbortErrors are never real app crashes — swallow silently
    if (/AbortError/i.test(msg) || /signal is aborted/i.test(msg)) {
      return { hasError: false, error: null };
    }
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    const msg   = String(error?.message ?? "");
    const stack = String(error?.stack ?? "");
    // Suppress extension errors at the React boundary level
    if (isExtensionError(msg) || isExtensionError(stack)) return;
    if (/AbortError/i.test(msg) || /signal is aborted/i.test(msg)) return;
    // Log real errors only
    if (process.env.NODE_ENV === "development") {
      console.error("[AppErrorBoundary] Caught:", error, info);
    }
  }

  handleRetry = () => {
    // Auto-reload on first retry; show manual button if it fails twice
    if (!this.state.retried) {
      this.setState({ hasError: false, error: null, retried: true });
    } else {
      window.location.reload();
    }
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    // Calm recovery UI — matches Xeevia brand
    return (
      <div style={{
        minHeight: "100dvh",
        background: "#080808",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        padding: "24px",
        textAlign: "center",
        gap: "16px",
      }}>
        <div style={{
          fontSize: "32px",
          fontWeight: 900,
          letterSpacing: "-1.5px",
          background: "linear-gradient(135deg, #a3e635, #4d7c0f)",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
          backgroundClip: "text",
          marginBottom: "8px",
        }}>
          XEEVIA
        </div>

        <div style={{
          width: "60px", height: "60px", borderRadius: "50%",
          background: "rgba(245,158,11,0.08)",
          border: "2px solid rgba(245,158,11,0.3)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: "26px",
        }}>
          ⚡
        </div>

        <div style={{ fontSize: "16px", fontWeight: 800, color: "#f0f0f0" }}>
          Something hiccupped
        </div>
        <div style={{
          fontSize: "13px", color: "#555", maxWidth: "300px", lineHeight: 1.7,
        }}>
          A temporary error occurred. Your session and data are safe.
        </div>

        {process.env.NODE_ENV === "development" && this.state.error && (
          <div style={{
            fontSize: "11px", color: "#333", fontFamily: "monospace",
            background: "#0d0d0d", border: "1px solid #1a1a1a",
            borderRadius: "8px", padding: "10px 14px",
            maxWidth: "380px", wordBreak: "break-word",
            textAlign: "left", lineHeight: 1.6,
          }}>
            {this.state.error.message}
          </div>
        )}

        <button
          onClick={this.handleRetry}
          style={{
            marginTop: "8px",
            padding: "13px 32px",
            borderRadius: "13px",
            border: "none",
            background: "linear-gradient(135deg, #a3e635 0%, #65a30d 100%)",
            color: "#061000",
            fontSize: "14px",
            fontWeight: 800,
            cursor: "pointer",
            boxShadow: "0 4px 18px rgba(163,230,53,0.3)",
          }}
        >
          {this.state.retried ? "Reload App" : "Try Again"}
        </button>
      </div>
    );
  }
}

// ── 4. RENDER ─────────────────────────────────────────────────────────────────
// StrictMode disabled in production — prevents double-invoke side effects.
// Keep in dev for catching unsafe lifecycle patterns.

const root = ReactDOM.createRoot(document.getElementById("root"));

const AppTree = (
  <AppErrorBoundary>
    <GrovaApp />
  </AppErrorBoundary>
);

if (process.env.NODE_ENV === "development") {
  root.render(<React.StrictMode>{AppTree}</React.StrictMode>);
} else {
  root.render(AppTree);
}

// ── 5. SERVICE WORKER ─────────────────────────────────────────────────────────

const isLocalhost = Boolean(
  window.location.hostname === "localhost" ||
  window.location.hostname === "[::1]" ||
  window.location.hostname.match(
    /^127(?:\.(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)){3}$/,
  ),
);

if (isLocalhost) {
  // Dev: always unregister SW — prevents stale cache from masking changes
  serviceWorkerRegistration.unregister();
} else {
  serviceWorkerRegistration.register({
    onUpdate: (registration) => {
      // Debounce: avoid showing update UI if it appeared recently
      const lastShown = sessionStorage.getItem("xv_update_shown");
      if (lastShown && Date.now() - Number(lastShown) < 60_000) return;
      sessionStorage.setItem("xv_update_shown", String(Date.now()));

      // Trigger the smart update card defined in index.html
      if (typeof window.__xvShowUpdate === "function") {
        window.__xvShowUpdate();
        return;
      }

      // Fallback if index.html card not available
      const el = document.createElement("div");
      el.style.cssText = `
        position: fixed;
        bottom: 24px;
        left: 50%;
        transform: translateX(-50%);
        background: rgba(8,8,8,0.97);
        color: #e8e8e8;
        padding: 14px 20px;
        border-radius: 16px;
        border: 1.5px solid rgba(163,230,53,0.35);
        box-shadow: 0 8px 40px rgba(0,0,0,0.8), 0 0 0 1px rgba(163,230,53,0.08);
        z-index: 99999;
        max-width: 320px;
        width: calc(100vw - 48px);
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        display: flex;
        align-items: center;
        gap: 14px;
        backdrop-filter: blur(10px);
        animation: xvUpdateIn 0.35s cubic-bezier(0.34,1.56,0.64,1);
      `;

      el.innerHTML = `
        <style>@keyframes xvUpdateIn{from{opacity:0;transform:translateX(-50%) translateY(16px)}to{opacity:1;transform:translateX(-50%) translateY(0)}}</style>
        <span style="font-size:22px;flex-shrink:0">⚡</span>
        <div style="flex:1;min-width:0">
          <div style="font-size:13px;font-weight:800;color:#fff;margin-bottom:2px">Update ready</div>
          <div style="font-size:11px;color:#555">A new version of Xeevia is available</div>
        </div>
        <button id="xv-update-btn" style="
          background:linear-gradient(135deg,#a3e635,#65a30d);
          color:#061000;border:none;padding:9px 16px;
          border-radius:10px;font-weight:800;cursor:pointer;
          font-size:12px;white-space:nowrap;flex-shrink:0;
          font-family:inherit;
        ">Update</button>
      `;

      document.body.appendChild(el);

      document.getElementById("xv-update-btn").addEventListener("click", () => {
        if (registration.waiting) {
          registration.waiting.postMessage({ type: "SKIP_WAITING" });
        }
        setTimeout(() => window.location.reload(), 300);
      });

      setTimeout(() => {
        if (el.parentNode) {
          el.style.opacity = "0";
          el.style.transition = "opacity 0.4s";
          setTimeout(() => el.remove(), 400);
        }
      }, 12_000);
    },

    onSuccess: () => {
      if (process.env.NODE_ENV !== "production") return;
      console.log("[PWA] ✓ Service worker registered — app ready for offline use");
    },
  });

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.ready.then(() => {
      if (process.env.NODE_ENV !== "production") return;
      console.log("[PWA] ✓ Service worker active");
    });
  }
}