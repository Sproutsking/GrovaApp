// ============================================================================
// src/index.js — v5 PUSH BRIDGE EARLY ATTACH
// ============================================================================
//
// CHANGES vs v4:
//   [1] pushService.attachBridgeEarly() called BEFORE root.render() so
//       the SW message listener is live from the very first tick of the page.
//       Previously the bridge was only attached inside pushService.start()
//       which App.jsx called 2 seconds after mount — any SW messages that
//       arrived in those first 2 seconds (PUSH_RECEIVED on cold start,
//       PENDING_PAYLOADS drain, CALL_ACCEPTED_FROM_NOTIFICATION from a
//       notification tap that opened the app) were silently dropped.
//   [2] push:needs_permission window listener added globally so the
//       permission prompt works from any component that calls
//       pushService.enablePushNotifications(). Without this listener
//       the event fired into the void and new users were never subscribed.
//       The listener is set up once here and re-uses the userId from the
//       CustomEvent detail.
//   All v4 changes (global error filter, React error boundary, console noise
//   filter, strict mode in dev only, SW registration) preserved exactly.
// ============================================================================

import React from "react";
import ReactDOM from "react-dom/client";
import GrovaApp from "./App.jsx";
import { BackNavigationProvider } from "./contexts/BackNavigationContext";
import DomBackRegistry from "./contexts/DomBackRegistry";
import "./styles/global.css";
import "@fortawesome/fontawesome-free/css/all.min.css";
import * as serviceWorkerRegistration from "./serviceWorkerRegistration";
import { pushService } from "./services/notifications/pushService";

// ── [1] ATTACH SW MESSAGE BRIDGE BEFORE REACT RENDERS ────────────────────────
// This is synchronous and safe to call before the DOM is ready.
// It sets up the navigator.serviceWorker message listener immediately so
// no push events or notification clicks that arrive during startup are dropped.
pushService.attachBridgeEarly();

// ── [2] GLOBAL PUSH PERMISSION LISTENER ──────────────────────────────────────
// Listens for the 'push:needs_permission' event that pushService.start()
// dispatches when Notification.permission === "default". Any component can
// then trigger enablePushNotifications() from a user gesture (e.g. a
// "Enable notifications" button) without needing a direct pushService import.
window.addEventListener("push:needs_permission", (e) => {
  // Store the userId so it's available when the user later taps a prompt.
  // The actual permission request MUST happen inside a user gesture handler —
  // this listener just captures the userId for later use.
  const userId = e?.detail?.userId;
  if (userId) {
    window.__pushUserId = userId;
  }
});

// ── 1. GLOBAL EXTENSION ERROR FILTER ─────────────────────────────────────────
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
  const str  = String(messageOrError ?? "");
  const file = String(filename ?? "");
  if (EXTENSION_ERROR_PATTERNS.some(p => p.test(str)))  return true;
  if (EXTENSION_ERROR_PATTERNS.some(p => p.test(file))) return true;
  if (str.includes("chrome-extension") || file.includes("chrome-extension")) return true;
  return false;
}

const _origOnError = window.onerror;
window.onerror = function (message, source, lineno, colno, error) {
  if (isExtensionError(message, source)) return true;
  if (typeof _origOnError === "function") {
    return _origOnError.call(this, message, source, lineno, colno, error);
  }
  return false;
};

window.addEventListener("unhandledrejection", (event) => {
  const reason = event?.reason;
  const msg    = String(reason?.message ?? reason ?? "");
  const stack  = String(reason?.stack ?? "");
  if (isExtensionError(msg) || isExtensionError(stack)) {
    event.preventDefault();
    event.stopPropagation();
    return;
  }
  if (/JWT expired/i.test(msg) || /401/i.test(msg) || /Unauthorized/i.test(msg)) {
    event.preventDefault();
    return;
  }
  if (
    /AbortError/i.test(msg) ||
    /signal is aborted/i.test(msg) ||
    /ServiceWorkerRegistration/i.test(msg) ||
    /invalid state/i.test(msg)
  ) {
    event.preventDefault();
    return;
  }
}, true);

// ── 2. DEV CONSOLE NOISE FILTER ──────────────────────────────────────────────
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
class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, retried: false };
  }

  static getDerivedStateFromError(error) {
    const msg   = String(error?.message ?? "");
    const stack = String(error?.stack ?? "");
    if (isExtensionError(msg) || isExtensionError(stack)) {
      return { hasError: false, error: null };
    }
    if (/AbortError/i.test(msg) || /signal is aborted/i.test(msg)) {
      return { hasError: false, error: null };
    }
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    const msg   = String(error?.message ?? "");
    const stack = String(error?.stack ?? "");
    if (isExtensionError(msg) || isExtensionError(stack)) return;
    if (/AbortError/i.test(msg) || /signal is aborted/i.test(msg)) return;
    if (process.env.NODE_ENV === "development") {
      console.error("[AppErrorBoundary] Caught:", error, info);
    }
  }

  handleRetry = () => {
    if (!this.state.retried) {
      this.setState({ hasError: false, error: null, retried: true });
    } else {
      window.location.reload();
    }
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div style={{
        minHeight:      "100dvh",
        background:     "var(--bg-strong)",
        display:        "flex",
        flexDirection:  "column",
        alignItems:     "center",
        justifyContent: "center",
        fontFamily:     "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        padding:        "24px",
        textAlign:      "center",
        gap:            "16px",
      }}>
        <div style={{
          fontSize:        "32px",
          fontWeight:      900,
          letterSpacing:   "-1.5px",
          background:      "linear-gradient(135deg, var(--accent), var(--accent-strong))",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
          backgroundClip: "text",
          marginBottom:   "8px",
        }}>
          XEEVIA
        </div>

        <div style={{
          width:          "60px",
          height:         "60px",
          borderRadius:   "50%",
          background:     "var(--accent-bg-soft)",
          border:         "2px solid rgba(245,158,11,0.3)",
          display:        "flex",
          alignItems:     "center",
          justifyContent: "center",
          fontSize:       "26px",
        }}>
          ⚡
        </div>

        <div style={{ fontSize: "16px", fontWeight: 800, color: "var(--text)" }}>
          Something hiccupped
        </div>
        <div style={{ fontSize: "13px", color: "var(--text-secondary)", maxWidth: "300px", lineHeight: 1.7 }}>
          A temporary error occurred. Your session and data are safe.
        </div>

        {process.env.NODE_ENV === "development" && this.state.error && (
          <div style={{
            fontSize:     "11px",
            color:        "#333",
            fontFamily:   "monospace",
            background:   "#0d0d0d",
            border:       "1px solid #1a1a1a",
            borderRadius: "8px",
            padding:      "10px 14px",
            maxWidth:     "380px",
            wordBreak:    "break-word",
            textAlign:    "left",
            lineHeight:   1.6,
          }}>
            {this.state.error.message}
          </div>
        )}

        <button
          onClick={this.handleRetry}
          style={{
            marginTop:  "8px",
            padding:    "13px 32px",
            borderRadius: "13px",
            border:     "none",
            background: "linear-gradient(135deg, var(--accent), var(--accent-strong))",
            color:      "var(--accent-contrast)",
            fontSize:   "14px",
            fontWeight: 800,
            cursor:     "pointer",
            boxShadow:  "0 4px 18px var(--accent-shadow)",
          }}
        >
          {this.state.retried ? "Reload App" : "Try Again"}
        </button>
      </div>
    );
  }
}

// ── 4. RENDER ─────────────────────────────────────────────────────────────────
const root = ReactDOM.createRoot(document.getElementById("root"));

const AppTree = (
  <AppErrorBoundary>
    <BackNavigationProvider>
      <DomBackRegistry>
        <GrovaApp />
      </DomBackRegistry>
    </BackNavigationProvider>
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

if (isLocalhost && !process.env.REACT_APP_SW_LOCALHOST) {
  serviceWorkerRegistration.unregister();
} else {
  serviceWorkerRegistration.register({
    onUpdate: (registration) => {
      const lastShown = sessionStorage.getItem("xv_update_shown");
      if (lastShown && Date.now() - Number(lastShown) < 60_000) return;
      sessionStorage.setItem("xv_update_shown", String(Date.now()));

      if (typeof window.__xvShowUpdate === "function") {
        window.__xvShowUpdate();
        return;
      }

      // Fallback banner
      const el = document.createElement("div");
      el.style.cssText = `
        position: fixed;
        bottom: 24px;
        left: 50%;
        transform: translateX(-50%);
        background: var(--bg-strong);
        color: var(--text);
        padding: 14px 20px;
        border-radius: 16px;
        border: 1.5px solid var(--accent-border);
        box-shadow: 0 8px 40px var(--shadow), 0 0 0 1px var(--accent-shadow);
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
          <div style="font-size:13px;font-weight:800;color:var(--text);margin-bottom:2px">Update ready</div>
          <div style="font-size:11px;color:var(--text-secondary)">A new version of Xeevia is available</div>
        </div>
        <button id="xv-update-btn" style="
          background:linear-gradient(135deg,var(--accent),var(--accent-strong));
          color:var(--accent-contrast);border:none;padding:9px 16px;
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