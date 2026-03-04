// ============================================================================
// src/services/auth/sessionRefresh.js — v8 IRON-CLAD
// ============================================================================
//
// PHILOSOPHY: Sessions are IMMORTAL. This service NEVER calls signOut().
// Only the user clicking "Sign Out" can end a session.
//
// WHAT CHANGED FROM v7:
//   [1] REMOVED all calls to supabase.auth.signOut() — completely eliminated.
//       _isPermanentRevocation() is GONE. Every error is a soft failure.
//   [2] Added _recoverSession() — tries three recovery paths before retry:
//         a. getSession() — might still work even if refreshSession() failed
//         b. lastGoodSession in memory — keeps app alive while retrying
//         c. sessionStorage backup of refresh token — survives page refresh
//   [3] Session backup to sessionStorage on every successful refresh.
//   [4] Visibility change handler — re-verifies session when tab becomes active.
//   [5] SIGNED_OUT from onAuthStateChange is completely ignored here.
//       AuthContext owns all sign-out logic exclusively.
// ============================================================================

"use strict";

import { supabase } from "../config/supabase";

const REFRESH_BUFFER_SECS = 5 * 60;      // Refresh 5min before expiry
const BASE_RETRY_MS       = 8_000;       // 8s first retry
const MAX_RETRY_MS        = 8 * 60_000;  // Cap at 8min between retries
const MIN_LEAD_MS         = 20_000;      // Schedule at least 20s ahead
const SESSION_BACKUP_KEY  = "xv_session_backup";

// ── Is the current URL an active OAuth callback? ──────────────────────────────
function _isOAuthCallback() {
  try {
    const params = new URLSearchParams(window.location.search);
    if (params.has("error") || params.has("error_code")) return false;
    const code = params.get("code");
    if (code && /^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(code)) return true;
    if (window.location.hash?.includes("access_token=")) return true;
    return false;
  } catch { return false; }
}

// ── Backup session to sessionStorage ─────────────────────────────────────────
function _backupSession(session) {
  if (!session) return;
  try {
    sessionStorage.setItem(SESSION_BACKUP_KEY, JSON.stringify({
      refresh_token: session.refresh_token,
      user_id:       session.user?.id,
      backed_at:     Date.now(),
    }));
  } catch {}
}

// ── Read backed-up session ────────────────────────────────────────────────────
function _readSessionBackup() {
  try {
    const raw = sessionStorage.getItem(SESSION_BACKUP_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    // Only use backups less than 24h old
    if (Date.now() - parsed.backed_at > 24 * 60 * 60 * 1000) return null;
    return parsed;
  } catch { return null; }
}

class SessionRefreshManager {
  constructor() {
    this._refreshTimer    = null;
    this._retryTimer      = null;
    this._inFlight        = null;
    this._initialized     = false;
    this._authSub         = null;
    this._retryCount      = 0;
    this._onlineHandler   = null;
    this._visHandler      = null;
    this._lastGoodSession = null;
  }

  // ── Public ──────────────────────────────────────────────────────────────────

  async initialize() {
    if (this._initialized) return true;
    this._initialized = true;

    try {
      const { data: { subscription } } = supabase.auth.onAuthStateChange(
        (event, session) => this._onAuthEvent(event, session),
      );
      this._authSub = subscription;

      // When device comes back online → immediately attempt refresh
      this._onlineHandler = () => {
        console.log("[SessionRefresh] Device back online — refreshing");
        this._doRefresh();
      };
      window.addEventListener("online", this._onlineHandler);

      // When tab becomes visible again → verify session is still alive
      this._visHandler = () => {
        if (document.visibilityState === "visible") {
          this._verifyAndSchedule();
        }
      };
      document.addEventListener("visibilitychange", this._visHandler);

      if (!_isOAuthCallback()) {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          _backupSession(session);
          this._lastGoodSession = session;
          this._schedule(session);
        }
      }
    } catch (err) {
      console.warn("[SessionRefresh] Init non-fatal:", err?.message);
    }
    return true;
  }

  async getValidSession() {
    if (_isOAuthCallback()) {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        return session ?? null;
      } catch { return this._lastGoodSession; }
    }
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return await this._recoverSession();
      const secsLeft = (session.expires_at ?? 0) - Math.floor(Date.now() / 1000);
      if (secsLeft < REFRESH_BUFFER_SECS) {
        const refreshed = await this._doRefresh();
        return refreshed ?? session ?? this._lastGoodSession;
      }
      return session;
    } catch {
      return this._lastGoodSession;
    }
  }

  async ensureSession() { return this.getValidSession(); }

  cleanup() {
    this._clearTimers();
    this._initialized = false;
    this._inFlight    = null;
    this._retryCount  = 0;
    if (this._onlineHandler) {
      window.removeEventListener("online", this._onlineHandler);
      this._onlineHandler = null;
    }
    if (this._visHandler) {
      document.removeEventListener("visibilitychange", this._visHandler);
      this._visHandler = null;
    }
    try { this._authSub?.unsubscribe(); } catch {}
    this._authSub = null;
  }

  // ── Private ──────────────────────────────────────────────────────────────────

  _onAuthEvent(event, session) {
    if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
      this._retryCount = 0;
      if (session) {
        _backupSession(session);
        this._lastGoodSession = session;
        this._schedule(session);
      }
    }
    // SIGNED_OUT is intentionally NOT handled here.
    // AuthContext controls all sign-out state exclusively.
    // Supabase fires spurious SIGNED_OUT events that must be ignored.
  }

  _schedule(session) {
    this._clearTimers();
    const nowSecs   = Math.floor(Date.now() / 1000);
    const expiresAt = session.expires_at ?? nowSecs + 3600;
    const secsLeft  = expiresAt - nowSecs;
    const delayMs   = Math.max((secsLeft - REFRESH_BUFFER_SECS) * 1000, MIN_LEAD_MS);
    console.log(`[SessionRefresh] Next refresh in ${Math.round(delayMs / 1000)}s`);
    this._refreshTimer = setTimeout(() => this._doRefresh(), delayMs);
  }

  _doRefresh() {
    if (this._inFlight) return this._inFlight;
    this._inFlight = this._refresh().finally(() => { this._inFlight = null; });
    return this._inFlight;
  }

  async _refresh() {
    if (!navigator.onLine) {
      console.log("[SessionRefresh] Offline — will retry when online");
      this._scheduleRetry();
      return null;
    }

    try {
      const { data, error } = await supabase.auth.refreshSession();

      if (error) {
        // ── CRITICAL: We NEVER sign out based on a refresh error ──────────────
        // Supabase returns 400/401 for: server blips, rate limiting, clock
        // skew, CDN caching, deploy restarts, temporary DB issues.
        // NONE of these mean the account is gone. We retry forever.
        // The ONLY thing that ends a session is the user clicking Sign Out.
        console.warn("[SessionRefresh] Refresh failed (retrying forever):", error.message);
        const recovered = await this._recoverSession();
        if (recovered) return recovered;
        this._scheduleRetry();
        return null;
      }

      if (data?.session) {
        this._retryCount = 0;
        _backupSession(data.session);
        this._lastGoodSession = data.session;
        this._schedule(data.session);
        return data.session;
      }

      const recovered = await this._recoverSession();
      if (recovered) return recovered;
      this._scheduleRetry();
      return null;

    } catch (err) {
      console.warn("[SessionRefresh] Exception (retrying):", err?.message);
      this._scheduleRetry();
      return null;
    }
  }

  // ── Try every possible recovery path before giving up ────────────────────
  async _recoverSession() {
    // Path 1: getSession() might still work even if refreshSession() failed
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        console.log("[SessionRefresh] Recovered via getSession()");
        _backupSession(session);
        this._lastGoodSession = session;
        this._schedule(session);
        return session;
      }
    } catch {}

    // Path 2: Return last known good session — keeps app running while retrying
    if (this._lastGoodSession) {
      console.log("[SessionRefresh] Using last known good session");
      this._scheduleRetry();
      return this._lastGoodSession;
    }

    // Path 3: Try sessionStorage backup refresh token
    const backup = _readSessionBackup();
    if (backup?.refresh_token) {
      try {
        console.log("[SessionRefresh] Attempting recovery from sessionStorage backup");
        const { data, error } = await supabase.auth.setSession({
          access_token:  "recovering",
          refresh_token: backup.refresh_token,
        });
        if (!error && data?.session) {
          console.log("[SessionRefresh] Recovered from backup refresh token");
          _backupSession(data.session);
          this._lastGoodSession = data.session;
          this._schedule(data.session);
          return data.session;
        }
      } catch {}
    }

    this._scheduleRetry();
    return null;
  }

  async _verifyAndSchedule() {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        _backupSession(session);
        this._lastGoodSession = session;
        const secsLeft = (session.expires_at ?? 0) - Math.floor(Date.now() / 1000);
        if (secsLeft < REFRESH_BUFFER_SECS) {
          this._doRefresh();
        } else {
          this._schedule(session);
        }
      } else if (this._lastGoodSession) {
        // Session appears gone but we have last known good — refresh immediately
        this._doRefresh();
      }
    } catch {}
  }

  _scheduleRetry() {
    this._clearTimers();
    const exp    = BASE_RETRY_MS * Math.pow(1.5, Math.min(this._retryCount, 20));
    const jitter = Math.random() * 4_000;
    const delay  = Math.min(exp + jitter, MAX_RETRY_MS);
    this._retryCount++;
    console.log(`[SessionRefresh] Retry #${this._retryCount} in ${Math.round(delay / 1000)}s`);
    this._retryTimer = setTimeout(() => this._doRefresh(), delay);
  }

  _clearTimers() {
    clearTimeout(this._refreshTimer);
    clearTimeout(this._retryTimer);
    this._refreshTimer = this._retryTimer = null;
  }
}

const sessionRefreshManager = new SessionRefreshManager();
export const ensureValidSession = () => sessionRefreshManager.getValidSession();
export { sessionRefreshManager };
export default sessionRefreshManager;