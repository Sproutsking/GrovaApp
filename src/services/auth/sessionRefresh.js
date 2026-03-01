// ============================================================================
// src/services/auth/sessionRefresh.js — v4 WATER-FLOW
// ============================================================================
//
// PHILOSOPHY: Session refresh is purely a background concern.
//   • It NEVER touches UI state
//   • It NEVER causes a logout
//   • It NEVER races with the OAuth callback exchange
//   • It NEVER runs on mobile resume — AuthContext.visibilitychange owns that
//
// WHAT CHANGED vs v3:
//   [A] isOAuthCallback() now reads the module-level oauthInProgress constant
//       from AuthContext instead of re-parsing window.location. The URL is
//       already cleaned before this module's initialize() ever runs.
//   [B] Removed the auto-boot on import. AuthContext calls initialize()
//       explicitly after the INITIAL_SESSION handler fires, so the refresh
//       manager starts with a confirmed live session.
//   [C] On hard revocation (400/401): we call supabase.auth.signOut() so
//       AuthContext's SIGNED_OUT handler fires cleanly and the user sees the
//       login screen. This is the ONE permitted automatic logout path — it
//       requires explicit server-side revocation, not a network hiccup.
//   [D] _schedule() guards against scheduling a refresh in the past
//       (negative delay) which caused immediate infinite loops on some devices.
// ============================================================================

"use strict";

import { supabase } from "../config/supabase";
import { oauthInProgress } from "../../components/Auth/AuthContext";

// ── Constants ─────────────────────────────────────────────────────────────────
const REFRESH_BUFFER_SECS = 5 * 60;   // Refresh 5 min before expiry
const BASE_RETRY_MS       = 30_000;   // 30s base retry delay
const MAX_RETRY_MS        = 10 * 60_000; // 10 min cap
const MAX_RETRIES         = 15;
const MIN_LEAD_MS         = 60_000;   // Schedule at least 60s ahead

// ── SessionRefreshManager ─────────────────────────────────────────────────────
class SessionRefreshManager {
  constructor() {
    this._refreshTimer = null;
    this._retryTimer   = null;
    this._inFlight     = null;   // Dedup concurrent callers
    this._initialized  = false;
    this._authSub      = null;
    this._retryCount   = 0;
  }

  // ── Public API ──────────────────────────────────────────────────────────────

  /**
   * Boot the manager. Idempotent — safe to call multiple times.
   * Should be called by AuthContext after confirming a live session exists.
   */
  async initialize() {
    if (this._initialized) return true;
    this._initialized = true;

    try {
      const { data: { subscription } } = supabase.auth.onAuthStateChange(
        (event, session) => this._onAuthEvent(event, session),
      );
      this._authSub = subscription;

      // Don't touch the session during an OAuth callback —
      // Supabase JS is already handling the code exchange.
      if (!oauthInProgress) {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) this._schedule(session);
      }
    } catch (err) {
      console.warn("[SessionRefresh] Init (non-fatal):", err?.message);
    }
    return true;
  }

  /**
   * Return a valid session, refreshing proactively if near-expiry.
   * NEVER throws. Returns null only when genuinely no session exists.
   */
  async getValidSession() {
    if (oauthInProgress) {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        return session ?? null;
      } catch { return null; }
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return null;

      const secsLeft = (session.expires_at ?? 0) - Math.floor(Date.now() / 1000);
      if (secsLeft < REFRESH_BUFFER_SECS) {
        const refreshed = await this._doRefresh();
        return refreshed ?? session; // Fall back to current on failure
      }
      return session;
    } catch {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        return session ?? null;
      } catch { return null; }
    }
  }

  /** Alias used by SecuritySection and other components */
  async ensureSession() {
    return this.getValidSession();
  }

  /** Stop everything. Call ONLY on explicit sign-out. */
  cleanup() {
    this._clearTimers();
    this._initialized = false;
    this._inFlight    = null;
    this._retryCount  = 0;
    try { this._authSub?.unsubscribe(); } catch {}
    this._authSub = null;
  }

  // ── Private ─────────────────────────────────────────────────────────────────

  _onAuthEvent(event, session) {
    switch (event) {
      case "SIGNED_IN":
      case "TOKEN_REFRESHED":
        this._retryCount = 0;
        if (session) this._schedule(session);
        break;
      case "SIGNED_OUT":
        this._clearTimers();
        break;
      default:
        break;
    }
  }

  _schedule(session) {
    this._clearTimers();
    const nowSecs    = Math.floor(Date.now() / 1000);
    const expiresAt  = session.expires_at ?? nowSecs + 3600;
    const secsLeft   = expiresAt - nowSecs;
    // Guard against negative delay (expired token) — retry in MIN_LEAD_MS
    const delayMs    = Math.max(
      (secsLeft - REFRESH_BUFFER_SECS) * 1000,
      MIN_LEAD_MS,
    );
    this._refreshTimer = setTimeout(() => this._doRefresh(), delayMs);
  }

  _doRefresh() {
    if (this._inFlight) return this._inFlight;
    this._inFlight = this._refresh().finally(() => { this._inFlight = null; });
    return this._inFlight;
  }

  async _refresh() {
    if (!navigator.onLine) {
      this._scheduleRetry();
      return null;
    }

    try {
      const { data, error } = await supabase.auth.refreshSession();

      if (error) {
        const isRevoked =
          error.status === 400 ||
          error.status === 401 ||
          /refresh_token_not_found|Invalid Refresh Token|Token has expired/i.test(
            error.message ?? "",
          );

        if (isRevoked) {
          // Hard server-side revocation (admin kicked user, password changed).
          // This is the ONLY path that triggers an automatic signOut.
          // Network errors, timeouts, and temporary failures NEVER reach here.
          console.warn("[SessionRefresh] Hard token revocation detected — signing out.");
          this._clearTimers();
          try { await supabase.auth.signOut(); } catch {}
          return null;
        }

        // Soft failure (network, 500, etc.) — retry, never logout
        this._scheduleRetry();
        return null;
      }

      if (data?.session) {
        this._retryCount = 0;
        this._schedule(data.session);
        return data.session;
      }

      this._scheduleRetry();
      return null;
    } catch {
      this._scheduleRetry();
      return null;
    }
  }

  _scheduleRetry() {
    this._clearTimers();
    if (this._retryCount >= MAX_RETRIES) return;

    const exp    = BASE_RETRY_MS * Math.pow(1.5, this._retryCount);
    const jitter = Math.random() * 5_000;
    const delay  = Math.min(exp + jitter, MAX_RETRY_MS);

    this._retryCount++;
    this._retryTimer = setTimeout(() => this._doRefresh(), delay);
  }

  _clearTimers() {
    clearTimeout(this._refreshTimer);
    clearTimeout(this._retryTimer);
    this._refreshTimer = this._retryTimer = null;
  }
}

// ── Singleton ──────────────────────────────────────────────────────────────────
// NOTE: initialize() is NOT called here automatically.
// AuthContext calls it after confirming a valid session exists.
const sessionRefreshManager = new SessionRefreshManager();

export const ensureValidSession = () => sessionRefreshManager.getValidSession();
export { sessionRefreshManager };
export default sessionRefreshManager;