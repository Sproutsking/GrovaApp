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
import { getPromptPriority, isPromptDue, readPromptState, writePromptState, clearPromptSchedule, schedulePrompt } from "./services/notifications/appPromptManager";
import { isChunkLoadError, buildRecoveryUrl } from "./utils/chunkRecovery";

// expose scheduling helpers to the React AppPrompt UI
try {
  window.__xvSchedulePrompt = schedulePrompt;
  window.__xvClearPromptSchedule = clearPromptSchedule;
} catch (e) {}

// Quick shim: allow calling Image() without `new` by delegating to
// the original constructor. This mitigates runtime errors from
// third-party code or incorrect calls that use `Image()` instead of
// `new Image()` (the browser throws in that case). It preserves
// prototype so `instanceof` checks still work.
if (typeof window !== "undefined" && window.Image) {
  const _OriginalImage = window.Image;
  if (typeof _OriginalImage === "function") {
    const ImageWrapper = function(...args) {
      return new _OriginalImage(...args);
    };
    ImageWrapper.prototype = _OriginalImage.prototype;
    try { Object.defineProperty(ImageWrapper, "name", { value: "Image" }); } catch (e) {}
    window.Image = ImageWrapper;
  }
}

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
  if (isChunkLoadError(msg) || isChunkLoadError(stack)) {
    event.preventDefault();
    console.warn("[ChunkRecovery] Dynamic chunk failed, forcing reload with cache-busting URL");
    window.location.replace(buildRecoveryUrl());
    return;
  }
}, true);

window.addEventListener("error", (event) => {
  const msg = String(event?.error?.message ?? event?.message ?? "");
  const stack = String(event?.error?.stack ?? "");
  if (isChunkLoadError(msg) || isChunkLoadError(stack)) {
    event.preventDefault();
    console.warn("[ChunkRecovery] Chunk error captured, refreshing app");
    window.location.replace(buildRecoveryUrl());
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
          background:     "#000000",
          border:         "2px solid rgba(255,255,255,0.08)",
          display:        "flex",
          alignItems:     "center",
          justifyContent: "center",
          fontSize:       "26px",
          overflow:       "hidden",
          boxShadow:      "0 8px 24px rgba(0,0,0,0.18)",
        }}>
          <img src="/logo192.png" alt="Xeevia" style={{ width: '70%', height: '70%', objectFit: 'contain', display: 'block' }} />
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

// ── 5. SERVICE WORKER + APP PROMPTS ────────────────────────────────────────
const UPDATE_SKIP_WINDOW_MS = 60_000;
const UPDATE_SHOWN_STORAGE_KEY = "xv_update_shown";
let deferredInstallEvent = null;
let installPromptShown = false;
let updatePromptShown = false;
let pushPromptShown = false;
let promptCooldownUntil = 0;

function isPwaInstalled() {
  return window.matchMedia('(display-mode: standalone)').matches
    || window.navigator.standalone
    || localStorage.getItem("xv_pwa_installed") === "1";
}

function canShowPrompt(type) {
  if (type === "install" && isPwaInstalled()) return false;
  const now = Date.now();
  if (now < promptCooldownUntil) return false;
  if (!isPromptDue(type)) return false;
  if (type === "install" && installPromptShown) return false;
  if (type === "update" && updatePromptShown) return false;
  if (type === "push" && pushPromptShown) return false;
  return true;
}

function showAppPrompt({ type, message, detail }) {
  if (!canShowPrompt(type)) return;
  if (type === "install" && installPromptShown) return;
  if (type === "update" && updatePromptShown) return;
  if (type === "push" && pushPromptShown) return;

  try {
    window.dispatchEvent(new CustomEvent("xv:show-app-prompt", { detail: { type, message, detail } }));
  } catch (e) {}

  promptCooldownUntil = Date.now() + 30_000;
  if (type === "install") installPromptShown = true;
  if (type === "update") {
    updatePromptShown = true;
    try {
      sessionStorage.setItem(UPDATE_SHOWN_STORAGE_KEY, String(Date.now()));
    } catch (e) {}
  }
  if (type === "push") pushPromptShown = true;
}

function queuePrompt(type, detail) {
  const priority = getPromptPriority({
    installReady: type === "install",
    updateReady: type === "update",
    pushReady: type === "push",
    isInstalled: isPwaInstalled(),
  });
  if (!priority) return;
  showAppPrompt({ type: priority, message: detail, detail });
}

window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  deferredInstallEvent = event;
  // expose to the UI component
  try { window.__xvDeferredInstallEvent = event; } catch (e) {}
  if (isPwaInstalled() || installPromptShown || !isPromptDue("install")) {
    return;
  }
  queuePrompt("install", "Install Xeevia to keep it fast and always available.");
});

window.addEventListener("appinstalled", () => {
  // Use React-driven AppPrompt; dispatch an event and let the component render.
  if (!canShowPrompt("install")) return;
  promptCooldownUntil = Date.now() + 30_000;
  try {
    window.dispatchEvent(new CustomEvent("xv:show-app-prompt", { detail: { type: "install", message: "Xeevia installed", detail: "Xeevia installed" } }));
  } catch (e) {}
  installPromptShown = true;
  try { sessionStorage.setItem(UPDATE_SHOWN_STORAGE_KEY, String(Date.now())); } catch (e) {}
});