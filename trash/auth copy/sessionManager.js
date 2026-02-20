// ============================================================================
// src/services/auth/sessionManager.js — v3 FINAL
//
// FACEBOOK MODEL — session ends only on explicit sign-out.
//   • startSession() — idempotent, safe to call multiple times (StrictMode)
//   • stopSession()  — call ONLY on explicit sign-out, never on unmount
//   • All DB writes are fire-and-forget, throttled to max 1 per 2 min
//   • Offline-safe — checks navigator.onLine before any network call
// ============================================================================

import { supabase } from "../config/supabase";

const DB_THROTTLE_MS = 2 * 60_000; // max 1 DB write per 2 min
const HEARTBEAT_MS = 5 * 60_000; // heartbeat every 5 min
const ACTIVITY_EVENTS = [
  "mousedown",
  "keydown",
  "touchstart",
  "scroll",
  "click",
];

class SessionManager {
  constructor() {
    this._active = false;
    this._userId = null;
    this._sessionId = null;
    this._heartbeat = null;
    this._lastWrite = 0;
    this._boundActivity = this._onActivity.bind(this);
  }

  // ── Public API ──────────────────────────────────────────────────────────────

  async startSession(userId) {
    if (this._active) return; // idempotent
    this._active = true;
    this._userId = userId;

    this._createOrUpdateSession().catch(() => {});

    for (const ev of ACTIVITY_EVENTS) {
      window.addEventListener(ev, this._boundActivity, { passive: true });
    }

    this._heartbeat = setInterval(() => this._updateActivity(), HEARTBEAT_MS);
  }

  async stopSession() {
    if (!this._active) return;
    this._active = false;

    for (const ev of ACTIVITY_EVENTS) {
      window.removeEventListener(ev, this._boundActivity);
    }
    clearInterval(this._heartbeat);
    this._heartbeat = null;

    await this._endSessionInDb().catch(() => {});
    this._userId = null;
    this._sessionId = null;
  }

  async isValid() {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      return !!session?.user;
    } catch {
      return false;
    }
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
        supabase
          .from("profiles")
          .update({ last_seen: now })
          .eq("id", this._userId),
        this._sessionId
          ? supabase
              .from("user_sessions")
              .update({ last_activity: now })
              .eq("id", this._sessionId)
          : Promise.resolve(),
      ]);
    } catch {}
  }

  async _createOrUpdateSession() {
    if (!this._userId || !navigator.onLine) return;
    try {
      const { data: authData } = await supabase.auth.getSession();
      const authSession = authData?.session;
      if (!authSession) return;

      const now = new Date().toISOString();
      const tokenSuffix =
        (authSession.access_token || "").slice(-20) || "unknown";

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
          (authSession.expires_at || Math.floor(Date.now() / 1000) + 3600) *
            1000,
        ).toISOString();

        const { data: ns } = await supabase
          .from("user_sessions")
          .insert({
            user_id: this._userId,
            session_token: `tok_${tokenSuffix}_${Date.now()}`,
            is_active: true,
            last_activity: now,
            expires_at: expiresAt,
            user_agent: (navigator.userAgent || "").slice(0, 250) || null,
          })
          .select("id")
          .single();

        if (ns?.id) this._sessionId = ns.id;
      }
    } catch {}
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
    } catch {}
  }
}

export default new SessionManager();
