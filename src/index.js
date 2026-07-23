// ============================================================================
// src/index.js — v6 CHUNK-LOAD-AWARE ERROR BOUNDARY
// ============================================================================
//
// CHANGES vs v5:
//   [1] AppErrorBoundary now recognizes ChunkLoadError / "Failed to fetch
//       dynamically imported module" errors specifically. These happen when
//       a lazy-loaded component's JS chunk 404s (stale build reference,
//       mid-deploy race, or a CDN caching skew). Instead of dead-ending on
//       the "Something hiccupped" screen, it triggers ONE automatic reload
//       (guarded by a sessionStorage flag so it can never loop forever).
//       This is a safety net — the primary fix is lazyRetry.js wrapping each
//       lazy() import in App.jsx, which catches the failure before it ever
//       reaches this boundary. This boundary exists in case a chunk error
//       occurs somewhere lazyRetry doesn't cover (e.g. a nested dynamic
//       import inside a library).
//   [2] The reload-guard flag is cleared automatically 5s after a successful
//       load, so a genuinely new chunk failure later in the same session
//       still gets its own retry attempt instead of being permanently
//       blocked by an old flag.
//   All v5 logic (global error filter, dev console noise filter, SW
//   registration, app-install/update prompts) preserved exactly.
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
window.addEventListener("push:needs_permission", (e) => {
  const userId = e?.detail?.userId;
  if (userId) {
    window.__pushUserId = userId;
  }
});

// ── HELPERS: detect a chunk-load failure from any error shape ────────────────
const CHUNK_ERROR_PATTERNS = [
  /Loading chunk [\d]+ failed/i,
  /Failed to fetch dynamically imported module/i,
  /Importing a module script failed/i,
  /error loading dynamically imported module/i,
];

function isChunkLoadError(error) {
  if (!error) return false;
  const name = String(error?.name ?? "");
  const msg = String(error?.message ?? "");
  if (name === "ChunkLoadError") return true;
  return CHUNK_ERROR_PATTERNS.some((p) => p.test(msg));
}

const CHUNK_RELOAD_FLAG = "xv_boundary_chunk_reload";

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
  // A chunk-load rejection that surfaces as an unhandled promise rejection
  // (rather than a thrown render error) — same one-shot reload guard as the
  // error boundary below, so we never loop.
  if (isChunkLoadError(reason)) {
    let already = false;
    try { already = sessionStorage.getItem(CHUNK_RELOAD_FLAG) === "1"; } catch (_) {}
    if (!already) {
      try { sessionStorage.setItem(CHUNK_RELOAD_FLAG, "1"); } catch (_) {}
      event.preventDefault();
      console.warn("[index.js] Chunk load rejection — reloading once:", msg);
      window.location.reload();
      return;
    }
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

    // [1] Chunk load errors get ONE automatic reload before we ever show
    // the fallback screen. Guarded by sessionStorage so a genuinely broken
    // deploy (chunk permanently missing) still surfaces the real error
    // after the first retry instead of reload-looping forever.
    if (isChunkLoadError(error)) {
      let already = false;
      try { already = sessionStorage.getItem(CHUNK_RELOAD_FLAG) === "1"; } catch (_) {}
      if (!already) {
        try { sessionStorage.setItem(CHUNK_RELOAD_FLAG, "1"); } catch (_) {}
        console.warn("[AppErrorBoundary] Chunk load error — reloading once:", msg);
        window.location.reload();
        return { hasError: false, error: null };
      }
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

// Clear the chunk-reload guard a few seconds after a clean load so a
// genuinely NEW chunk failure later in this tab's life still gets its own
// single retry instead of being silently blocked by an old flag.
window.addEventListener("load", () => {
  setTimeout(() => {
    try { sessionStorage.removeItem(CHUNK_RELOAD_FLAG); } catch (_) {}
  }, 8000);
});

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