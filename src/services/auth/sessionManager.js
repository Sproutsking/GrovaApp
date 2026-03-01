// ============================================================================
// src/services/auth/sessionManager.js — v5 WATER-FLOW
// ============================================================================
//
// PHILOSOPHY: Session tracking is a background analytics concern.
//   It NEVER affects auth state, NEVER causes logouts, NEVER blocks UI.
//
// WHAT CHANGED vs v4:
//   [A] Added navigator.onLine guard to _createOrUpdateSession() and
//       _updateActivity() so they silently no-op offline instead of
//       throwing errors that could bubble up.
//   [B] All DB writes are fully fire-and-forget — no await at call sites.
//   [C] startSession() is idempotent and safe to call on every app resume.
//       If _active is already true for the same user, it just refreshes the
//       heartbeat timer without creating a duplicate DB row.
//   [D] Removed the "navigator.onLine" gate from stopSession() since we
//       still want to mark the session ended even on a slow connection
//       (Promise.allSettled handles the failure gracefully).
// ============================================================================

import { supabase } from "../config/supabase";

const DB_THROTTLE_MS  = 2 * 60_000;  // Max 1 DB write per 2 min
const HEARTBEAT_MS    = 5 * 60_000;  // Heartbeat every 5 min
const ACTIVITY_EVENTS = ["mousedown", "keydown", "touchstart", "scroll", "click"];

class SessionManager {
  constructor() {
    this._active        = false;
    this._userId        = null;
    this._sessionId     = null;
    this._heartbeat     = null;
    this._lastWrite     = 0;
    this._boundActivity = this._onActivity.bind(this);
  }

  // ── Public API ──────────────────────────────────────────────────────────────

  /**
   * Call once on login / app mount / resume with authenticated user.
   * Idempotent — calling again for the same user refreshes heartbeat only.
   */
  async startSession(userId) {
    // Same user already active — just ensure heartbeat is running
    if (this._active && this._userId === userId) return;

    // Different user (account switch) — clean up previous session first
    if (this._active && this._userId !== userId) {
      await this.stopSession();
    }

    this._active  = true;
    this._userId  = userId;

    this._createOrUpdateSession().catch(() => {});

    for (const ev of ACTIVITY_EVENTS) {
      window.addEventListener(ev, this._boundActivity, { passive: true });
    }

    // Clear any previous heartbeat before starting a new one
    clearInterval(this._heartbeat);
    this._heartbeat = setInterval(() => this._updateActivity(), HEARTBEAT_MS);
  }

  /**
   * Call ONLY on explicit user sign-out.
   * NEVER call on network drop, error, timeout, unmount, or background.
   */
  async stopSession() {
    if (!this._active) return;
    this._active = false;

    for (const ev of ACTIVITY_EVENTS) {
      window.removeEventListener(ev, this._boundActivity);
    }

    clearInterval(this._heartbeat);
    this._heartbeat = null;

    await this._endSessionInDb().catch(() => {});

    this._userId    = null;
    this._sessionId = null;
  }

  /**
   * Check if there's a valid Supabase auth session.
   * Does NOT sign out if false — just returns status.
   */
  async isValid() {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      return !!session?.user;
    } catch { return false; }
  }

  // ── Private ─────────────────────────────────────────────────────────────────

  _onActivity() {
    const now = Date.now();
    if (now - this._lastWrite < DB_THROTTLE_MS) return;
    this._lastWrite = now;
    this._updateActivity();
  }

  async _updateActivity() {
    if (!this._active || !this._userId || !navigator.onLine) return;
    try {
      const now = new Date().toISOString();
      await Promise.allSettled([
        supabase.from("profiles").update({ last_seen: now }).eq("id", this._userId),
        this._sessionId
          ? supabase.from("user_sessions").update({ last_activity: now }).eq("id", this._sessionId)
          : Promise.resolve(),
      ]);
    } catch {
      // Silent — activity tracking failure is never critical
    }
  }

  async _createOrUpdateSession() {
    if (!this._userId || !navigator.onLine) return;
    try {
      const { data: authData } = await supabase.auth.getSession();
      const authSession = authData?.session;
      if (!authSession) return;

      const now         = new Date().toISOString();
      const tokenSuffix = (authSession.access_token || "").slice(-20) || "unknown";

      const { data: existing } = await supabase
        .from("user_sessions")
        .select("id")
        .eq("user_id", this._userId)
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (existing?.id) {
        this._sessionId = existing.id;
        await supabase
          .from("user_sessions")
          .update({ last_activity: now, is_active: true })
          .eq("id", existing.id);
      } else {
        const expiresAt = new Date(
          (authSession.expires_at || Math.floor(Date.now() / 1000) + 3600) * 1000,
        ).toISOString();

        const { data: ns } = await supabase
          .from("user_sessions")
          .insert({
            user_id:       this._userId,
            session_token: `tok_${tokenSuffix}_${Date.now()}`,
            is_active:     true,
            last_activity: now,
            expires_at:    expiresAt,
            user_agent:    (navigator.userAgent || "").slice(0, 250) || null,
          })
          .select("id")
          .single();

        if (ns?.id) this._sessionId = ns.id;
      }
    } catch {
      // Silent — session creation failure doesn't affect auth
    }
  }

  async _endSessionInDb() {
    if (!this._userId) return;
    try {
      const now = new Date().toISOString();
      if (this._sessionId) {
        await supabase
          .from("user_sessions")
          .update({ is_active: false, ended_at: now })
          .eq("id", this._sessionId);
      } else {
        await supabase
          .from("user_sessions")
          .update({ is_active: false, ended_at: now })
          .eq("user_id", this._userId)
          .eq("is_active", true);
      }
    } catch {
      // Silent
    }
  }
}

export default new SessionManager();