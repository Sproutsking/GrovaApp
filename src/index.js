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
import { getPromptPriority, isPromptDue, readPromptState, writePromptState, clearPromptSchedule, schedulePrompt, setPromptNever } from "./services/notifications/appPromptManager";

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

// ── 5. SERVICE WORKER + APP PROMPTS ────────────────────────────────────────
const UPDATE_SKIP_WINDOW_MS = 60_000;
const UPDATE_SHOWN_STORAGE_KEY = "xv_update_shown";
let deferredInstallEvent = null;
let installPromptShown = false;
let updatePromptShown = false;
let pushPromptShown = false;
let promptCooldownUntil = 0;

function ensurePromptStyles() {
  if (document.getElementById("xv-prompt-animations")) return;

  const style = document.createElement("style");
  style.id = "xv-prompt-animations";
  style.textContent = `
    @keyframes xvPromptRise {
      0% {
        opacity: 0;
        transform: translateX(-50%) translateY(16px) scale(0.96);
      }
      65% {
        opacity: 1;
        transform: translateX(-50%) translateY(-2px) scale(1.01);
      }
      100% {
        opacity: 1;
        transform: translateX(-50%) translateY(0) scale(1);
      }
    }

    @keyframes xvPromptPulse {
      0% { transform: scale(1); }
      35% { transform: scale(0.97); }
      100% { transform: scale(1); }
    }
  `;
  document.head.appendChild(style);
}

function isPwaInstalled() {
  return window.matchMedia('(display-mode: standalone)').matches
    || window.matchMedia('(display-mode: fullscreen)').matches
    || window.matchMedia('(display-mode: minimal-ui)').matches
    || window.navigator.standalone
    || localStorage.getItem("xv_pwa_installed") === "1";
}

window.__xvIsAppInstalled = isPwaInstalled;

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

  ensurePromptStyles();
  let isShowingSnoozeOptions = false;

  const banner = document.createElement("div");
  banner.id = `xv-${type}-prompt`;
  banner.style.cssText = `
    position: fixed;
    left: 50%;
    bottom: 24px;
    transform: translateX(-50%) translateY(12px) scale(.96);
    opacity: 0;
    z-index: 2147483647;
    width: min(92vw, 420px);
    background: linear-gradient(180deg, rgba(12, 16, 12, 0.98), rgba(8, 12, 8, 0.96));
    border: 1px solid rgba(168, 230, 61, 0.28);
    border-radius: 18px;
    padding: 14px 16px;
    box-shadow: 0 18px 48px rgba(0,0,0,0.45), 0 0 0 1px rgba(168,230,61,0.08), 0 0 32px rgba(132,204,22,0.18);
    display: flex;
    align-items: center;
    gap: 12px;
    backdrop-filter: blur(16px);
    transition: transform 0.22s cubic-bezier(.2,.9,.2,1), opacity 0.22s ease, box-shadow 0.22s ease, border-color 0.22s ease;
    animation: xvPromptRise 0.28s cubic-bezier(.2,.9,.2,1) forwards;
  `;

  const logoUrl = "/logo192.png";
  const title = type === "update" ? "Update ready" : type === "push" ? "Enable alerts" : "Install app";
  const subtitle = detail || message || "Tap below to continue.";

  banner.innerHTML = `
    <div style="width:28px;height:28px;flex-shrink:0;border-radius:8px;overflow:hidden;background:rgba(132,204,22,.08);border:1px solid rgba(132,204,22,.2);display:flex;align-items:center;justify-content:center;box-shadow:0 0 20px rgba(132,204,22,.12)">
      <img src="${logoUrl}" alt="Xeevia" style="width:20px;height:20px;object-fit:contain"/>
    </div>
    <div style="flex:1;min-width:0">
      <div style="font-size:13px;font-weight:800;color:#f7f7f7;margin-bottom:2px">${title}</div>
      <div style="font-size:11px;color:#95a38d;line-height:1.45">${subtitle}</div>
    </div>
    <div style="display:flex;gap:6px;flex-shrink:0;align-items:center" id="xv-prompt-buttons">
      <button id="xv-prompt-later" style="border:none;background:rgba(255,255,255,0.08);color:#d7e4cf;padding:8px 10px;border-radius:10px;font-size:12px;font-weight:700;cursor:pointer;transition:transform .18s ease, box-shadow .18s ease, background .18s ease;">Ignore</button>
      ${type === "install" || type === "push" ? '<button id="xv-prompt-never" style="border:none;background:transparent;color:#84917d;padding:8px 4px;border-radius:10px;font-size:11px;font-weight:700;cursor:pointer;">Never</button>' : ""}
      <button id="xv-prompt-action" style="border:none;background:linear-gradient(135deg,#a8e63d,#60a513);color:#051100;padding:8px 12px;border-radius:10px;font-size:12px;font-weight:800;cursor:pointer;transition:transform .18s ease, box-shadow .18s ease, filter .18s ease; box-shadow:0 8px 18px rgba(132,204,22,0.26);">${type === "install" ? "Install" : type === "update" ? "Refresh" : "Enable"}</button>
    </div>
  `;

  const closeBanner = (callback) => {
    if (!banner || !document.body.contains(banner)) {
      callback?.();
      return;
    }
    banner.style.opacity = "0";
    banner.style.transform = "translateX(-50%) translateY(10px) scale(0.96)";
    banner.style.filter = "blur(1px)";
    setTimeout(() => {
      banner.remove();
      callback?.();
    }, 180);
  };

  document.body.appendChild(banner);

  const actionButton = document.getElementById("xv-prompt-action");
  const laterButton = document.getElementById("xv-prompt-later");
  const neverButton = document.getElementById("xv-prompt-never");

  neverButton?.addEventListener("click", (e) => {
    e.stopPropagation();
    setPromptNever(type);
    closeBanner(() => {
      if (type === "install") installPromptShown = true;
      if (type === "push") pushPromptShown = true;
    });
  });

  actionButton.addEventListener("pointerdown", () => {
    actionButton.style.transform = "scale(0.97)";
    actionButton.style.filter = "brightness(1.06)";
  });
  actionButton.addEventListener("pointerup", () => {
    actionButton.style.transform = "scale(1)";
  });
  actionButton.addEventListener("mouseover", () => {
    actionButton.style.transform = "translateY(-1px) scale(1.02)";
    actionButton.style.boxShadow = "0 12px 24px rgba(132,204,22,0.34)";
  });
  actionButton.addEventListener("mouseout", () => {
    actionButton.style.transform = "none";
    actionButton.style.boxShadow = "0 8px 18px rgba(132,204,22,0.26)";
  });

  laterButton.addEventListener("mouseover", () => {
    laterButton.style.transform = "translateY(-1px)";
    laterButton.style.background = "rgba(255,255,255,0.12)";
  });
  laterButton.addEventListener("mouseout", () => {
    laterButton.style.transform = "none";
    laterButton.style.background = "rgba(255,255,255,0.08)";
  });

  function showSnoozeOptions() {
    isShowingSnoozeOptions = true;
    const buttonsContainer = document.getElementById("xv-prompt-buttons");
    const snoozeHours = type === "install" || type === "push" ? [12, 24, 48] : [12, 24];
    const snoozeLabels = { 12: "12 hrs", 24: "Tomorrow", 48: "In 2 days" };

    buttonsContainer.innerHTML = snoozeHours.map(hours =>
      `<button class="xv-snooze-option" data-hours="${hours}" style="border:none;background:rgba(132,204,22,.12);color:#84cc16;padding:6px 10px;border-radius:8px;font-size:11px;font-weight:700;cursor:pointer;transition:transform .18s ease, background .18s ease, box-shadow .18s ease;border:1px solid rgba(132,204,22,.2)">${snoozeLabels[hours]}</button>`
    ).join("");

    document.querySelectorAll(".xv-snooze-option").forEach(btn => {
      btn.addEventListener("mouseover", () => {
        btn.style.transform = "translateY(-1px)";
        btn.style.boxShadow = "0 8px 16px rgba(132,204,22,0.18)";
      });
      btn.addEventListener("mouseout", () => {
        btn.style.transform = "none";
        btn.style.boxShadow = "none";
      });
      btn.addEventListener("click", (e) => {
        const hours = Number(e.currentTarget.getAttribute("data-hours"));
        const nextShowAt = Date.now() + hours * 60 * 60 * 1000;
        const state = readPromptState();
        state[type] = nextShowAt;
        writePromptState(state);
        closeBanner(() => {
          if (type === "install") installPromptShown = true;
          if (type === "update") updatePromptShown = true;
          if (type === "push") pushPromptShown = true;
        });
      });
    });
  }

  function dismissPrompt(hours = 24) {
    schedulePrompt(type, hours);
    closeBanner(() => {
      if (type === "install") installPromptShown = true;
      if (type === "update") updatePromptShown = true;
      if (type === "push") pushPromptShown = true;
    });
  }

  laterButton.addEventListener("click", (e) => {
    e.stopPropagation();
    if (!isShowingSnoozeOptions) {
      showSnoozeOptions();
      return;
    }
    dismissPrompt(24);
  });

  actionButton.addEventListener("click", async () => {
    if (type === "install" && deferredInstallEvent) {
      closeBanner(async () => {
        deferredInstallEvent.prompt();
        const { outcome } = await deferredInstallEvent.userChoice;
        if (outcome === "accepted") {
          installPromptShown = true;
          clearPromptSchedule("install");
        }
      });
    } else if (type === "update") {
      closeBanner(() => {
        updatePromptShown = true;
        clearPromptSchedule("update");
        localStorage.setItem("xv_update_timestamp", String(Date.now()));
        window.location.reload();
      });
    } else if (type === "push") {
      closeBanner(async () => {
        if (typeof window.__xvRequestPushPermission === "function") {
          await window.__xvRequestPushPermission();
        }
        pushPromptShown = true;
      });
    }
  });

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
  if (isPwaInstalled() || installPromptShown || !isPromptDue("install")) {
    return;
  }
  queuePrompt("install", "Install Xeevia to keep it fast and always available.");
});

window.addEventListener("appinstalled", () => {
  installPromptShown = true;
  deferredInstallEvent = null;
  localStorage.setItem("xv_pwa_installed", "1");
  clearPromptSchedule("install");
});

window.__xvRequestInstall = () => {
  if (isPwaInstalled()) {
    showAppPrompt({
      type: "update",
      message: "Xeevia is already installed on this device.",
      detail: "You are using the app version. Updates will be applied when a new release is ready.",
    });
    return false;
  }
  if (!deferredInstallEvent) return false;
  showAppPrompt({ type: "install", message: "Install Xeevia to keep it fast and always available." });
  return true;
};

window.addEventListener("xv:show_install_prompt", () => {
  window.__xvRequestInstall?.();
});

window.addEventListener("sw:registered", (event) => {
  const registration = event?.detail?.registration;
  if (!registration?.waiting) return;

  try {
    const updateTime = localStorage.getItem("xv_update_timestamp");
    if (updateTime && (Date.now() - Number(updateTime)) < UPDATE_SKIP_WINDOW_MS) {
      console.log("[App] Recent update detected, skipping update prompt on reload");
      return;
    }

    const lastShown = sessionStorage.getItem(UPDATE_SHOWN_STORAGE_KEY);
    if (lastShown && Date.now() - Number(lastShown) < UPDATE_SKIP_WINDOW_MS) {
      console.log("[App] Update card already shown recently this session, skipping duplicate prompt");
      return;
    }
  } catch (e) {}

  if (!updatePromptShown && isPromptDue("update")) {
    queuePrompt("update", "A fresh update is available. Refresh now to get the latest experience.");
  }
});

window.addEventListener("xv:request_account_switch", () => {
  if (typeof window.__xvRequestPushPermission === "function") {
    window.__xvRequestPushPermission();
  }
});

// Push permission is opt-in from an explicit notification/settings action.
// Startup must never place a permission prompt over the first screen.
window.addEventListener("push:needs_permission", () => {});

const isLocalhost = Boolean(
  window.location.hostname === "localhost" ||
  window.location.hostname === "[::1]" ||
  window.location.hostname.match(
    /^127(?:\.(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)){3}$/,
  ),
);

// Never let the production offline cache mask HMR/source changes during development,
// including Codespaces forwarded hosts that are not technically localhost.
if (process.env.NODE_ENV === "development" || (isLocalhost && !process.env.REACT_APP_SW_LOCALHOST)) {
  serviceWorkerRegistration.unregister();
} else {
  serviceWorkerRegistration.register({
    onUpdate: (registration) => {
      // Don't show update card if we just performed an update
      try {
        const updateTime = localStorage.getItem("xv_update_timestamp");
        if (updateTime && (Date.now() - Number(updateTime)) < 15000) {
          console.log("[SWReg] Recent update detected, skipping update card");
          return;
        }
      } catch (e) {}

      const lastShown = sessionStorage.getItem("xv_update_shown");
      if (lastShown && Date.now() - Number(lastShown) < 60_000) return;
      sessionStorage.setItem("xv_update_shown", String(Date.now()));

      if (typeof window.__xvShowUpdate === "function") {
        window.__xvShowUpdate();
        return;
      }

      window.dispatchEvent(new CustomEvent("sw:registered", { detail: { registration } }));
      return;
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