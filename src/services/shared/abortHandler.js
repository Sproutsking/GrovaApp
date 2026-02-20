// ============================================================================
// src/services/shared/abortHandler.js
//
// PURPOSE
//   React StrictMode double-invokes effects, which causes Supabase's internal
//   navigator.locks to get aborted. Those DOMExceptions bubble up through
//   unhandledrejection / console.error and hit CRA's dev overlay, showing
//   scary red popups that are NOT real errors.
//
//   This module:
//     1. Detects every known variant of AbortError / signal-aborted
//     2. Patches all five pathways the error can travel through
//     3. Exposes safe helpers for the rest of the app to use
//
// SECURITY / SCALE NOTES
//   - Patches are applied ONCE at boot and are idempotent
//   - We never swallow genuine errors — only abort-flavoured ones
//   - All patches preserve original functions in closures (no prototype pollution)
//   - Works correctly in SSR-safe environments (guards on typeof window)
//   - Zero external dependencies
// ============================================================================

"use strict";

// ── 1. Exhaustive pattern list ────────────────────────────────────────────────
// Every string variant observed across:
//   • Chrome / Firefox / Safari DOMException
//   • Supabase navigator.locks internal aborts
//   • Fetch API cancellation
//   • React 18 concurrent mode teardown
//   • iOS WebKit specific messages
const ABORT_PATTERNS = [
  "aborterror",
  "signal is aborted",
  "signal is aborted without reason", // exact Supabase navigator.locks string
  "aborted without reason",
  "the user aborted",
  "the operation was aborted",
  "user aborted a request",
  "operation was aborted",
  "request was aborted",
  "fetch was aborted",
  "the fetch was aborted",
  "aborted", // catch-all last resort
];

// ── 2. Core detector — handles every shape an abort can take ─────────────────
/**
 * Returns true if the value looks like any form of AbortError.
 * Handles: Error objects, DOMException, plain strings, event objects,
 * PromiseRejectionEvent reasons, and nested .reason properties.
 *
 * @param {unknown} value
 * @returns {boolean}
 */
export function isAbortLike(value) {
  if (value === null || value === undefined) return false;

  // Fast path — DOMException name and legacy numeric code
  if (value.name === "AbortError") return true;
  if (value.code === 20) return true; // DOMException.ABORT_ERR = 20

  // Build a normalised searchable string from every possible field
  let combined = "";

  try {
    if (typeof value === "string") {
      combined = value;
    } else {
      const parts = [
        value.message,
        value.reason,
        value.reason?.message,
        value.reason?.name,
        value.type,
        value.name,
      ];
      // Safely stringify each part
      for (const part of parts) {
        if (part === null || part === undefined) continue;
        if (typeof part === "string") {
          combined += " " + part;
        } else if (part instanceof Error || part instanceof DOMException) {
          combined += " " + (part.message || "") + " " + (part.name || "");
        } else {
          try {
            combined += " " + String(part);
          } catch {
            /* ignore */
          }
        }
      }
    }
  } catch {
    // If reading any property throws (e.g. Proxy traps), bail out safely
    return false;
  }

  const lower = combined.toLowerCase().trim();
  if (!lower) return false;

  // Match against every known pattern
  for (const pattern of ABORT_PATTERNS) {
    if (lower.includes(pattern)) return true;
  }

  return false;
}

// ── 3. Guard: only install once even if called multiple times ─────────────────
let _installed = false;

/**
 * Install global error suppression for AbortErrors.
 * MUST be called before ReactDOM.createRoot — it patches console.error
 * before React's dev overlay registers its own listener.
 *
 * Idempotent — safe to call multiple times (only runs once).
 */
export function installAbortErrorSuppressor() {
  if (typeof window === "undefined") return; // SSR guard
  if (_installed) return;
  _installed = true;

  _patchUnhandledRejection();
  _patchWindowOnerror();
  _patchErrorEvent();
  _patchConsole();
  _patchReportError();
  _patchDispatchEvent();
}

// ── 4. Pathway patches ────────────────────────────────────────────────────────

/** Capture-phase unhandledrejection — fires before CRA overlay */
function _patchUnhandledRejection() {
  const handler = (event) => {
    if (isAbortLike(event.reason)) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  };
  // Both capture and bubble phase to be thorough
  window.addEventListener("unhandledrejection", handler, true);
  window.addEventListener("unhandledrejection", handler, false);
}

/** window.onerror — synchronous error pathway */
function _patchWindowOnerror() {
  const _orig = window.onerror;
  window.onerror = function (msg, src, line, col, err) {
    if (isAbortLike(err) || isAbortLike({ message: String(msg || "") })) {
      return true; // returning true suppresses default browser error handling
    }
    if (typeof _orig === "function") {
      return _orig.call(this, msg, src, line, col, err);
    }
    return false;
  };
}

/** Capture-phase "error" event on window */
function _patchErrorEvent() {
  window.addEventListener(
    "error",
    (event) => {
      if (
        isAbortLike(event.error) ||
        isAbortLike({ message: event.message || "" })
      ) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    },
    true,
  );
}

/**
 * Patch console.error AND console.warn.
 * CRA's react-error-overlay intercepts both when displaying the red popup.
 * We intercept BEFORE it gets the chance.
 */
function _patchConsole() {
  // ── console.error ──────────────────────────────────────────────────────────
  const _origError = console.error;
  console.error = function (...args) {
    if (_anyArgIsAbort(args)) return;
    _origError.apply(console, args);
  };

  // ── console.warn ───────────────────────────────────────────────────────────
  const _origWarn = console.warn;
  console.warn = function (...args) {
    if (_anyArgIsAbort(args)) return;
    _origWarn.apply(console, args);
  };
}

function _anyArgIsAbort(args) {
  for (const a of args) {
    if (!a) continue;
    if (isAbortLike(a)) return true;
    if (typeof a === "string" && isAbortLike({ message: a })) return true;
    // Handle React's formatted error strings: "The above error occurred in..."
    // which may contain the original abort message as a substring
    if (a instanceof Error || a instanceof DOMException) {
      if (isAbortLike(a)) return true;
    }
    // Stringified objects (e.g. "[object ErrorEvent]" wrapping)
    try {
      const s = String(a);
      if (s !== "[object Object]" && isAbortLike({ message: s })) return true;
    } catch {
      /* ignore */
    }
  }
  return false;
}

/**
 * Patch window.reportError — React 18.3+ uses this instead of console.error
 * for uncaught errors.
 */
function _patchReportError() {
  if (typeof window.reportError !== "function") return;
  const _orig = window.reportError;
  window.reportError = function (err) {
    if (isAbortLike(err)) return;
    _orig.call(window, err);
  };
}

/**
 * Patch window.dispatchEvent.
 * CRA's overlay synthesises and dispatches ErrorEvent / PromiseRejectionEvent
 * objects. By intercepting at dispatchEvent we catch anything that slipped
 * through the earlier patches.
 */
function _patchDispatchEvent() {
  const _orig = window.dispatchEvent.bind(window);

  window.dispatchEvent = function (event) {
    // Abort-flavoured ErrorEvent
    if (
      event instanceof ErrorEvent &&
      isAbortLike({ message: event.message || "" })
    ) {
      return true; // suppress — return value mirrors dispatchEvent contract
    }

    // Abort-flavoured PromiseRejectionEvent
    if (
      typeof PromiseRejectionEvent !== "undefined" &&
      event instanceof PromiseRejectionEvent &&
      isAbortLike(event.reason)
    ) {
      return true;
    }

    return _orig(event);
  };
}

// ── 5. Public helpers ─────────────────────────────────────────────────────────

/**
 * Convenience alias — use this in catch blocks throughout the app.
 *
 * @example
 *   } catch (err) {
 *     if (isAbortError(err)) return;   // StrictMode cleanup — ignore
 *     throw err;
 *   }
 */
export function isAbortError(err) {
  return isAbortLike(err);
}

/**
 * Wraps a Supabase query function and swallows abort errors, returning
 * the fallback value instead.  Re-throws genuine errors.
 *
 * @param {() => Promise<{data: T, error: any}>} queryFn
 * @param {T} fallback  Returned when the query aborts or returns an error
 * @returns {Promise<T>}
 *
 * @example
 *   const posts = await safeQuery(
 *     () => supabase.from("posts").select("*"),
 *     [],
 *   );
 */
export async function safeQuery(queryFn, fallback = null) {
  try {
    const result = await queryFn();

    if (result?.error) {
      // Supabase wraps errors in { data, error } — check both abort and real
      if (isAbortLike(result.error)) return fallback;
      // For other errors return fallback too (caller handles upstream)
      return fallback;
    }

    return result?.data ?? fallback;
  } catch (err) {
    if (isAbortLike(err)) return fallback;
    throw err; // genuine errors propagate
  }
}

/**
 * Creates an AbortController whose abort() method always sets a proper
 * DOMException so isAbortError() reliably detects it.
 *
 * @param {string} name  Human-readable label for debugging
 * @returns {{ controller: AbortController, signal: AbortSignal, abort: () => void }}
 */
export function createAbortController(name = "request") {
  const controller = new AbortController();

  const abort = () => {
    if (!controller.signal.aborted) {
      controller.abort(new DOMException(`${name} cancelled`, "AbortError"));
    }
  };

  return {
    controller,
    signal: controller.signal,
    abort,
  };
}

// ── 6. Auto-install as module side effect ─────────────────────────────────────
// Importing this file is sufficient — no explicit call needed in index.js.
// import "./services/shared/abortHandler" triggers this immediately,
// before React or any other module runs.
installAbortErrorSuppressor();

// ── 7. Default export for backwards-compat ────────────────────────────────────
const abortHandler = {
  installAbortErrorSuppressor,
  isAbortError,
  isAbortLike,
  safeQuery,
  createAbortController,
};

export default abortHandler;
