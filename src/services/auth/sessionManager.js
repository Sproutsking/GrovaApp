// ============================================================================
// src/services/auth/sessionManager.js — v7 FACEBOOK-GRADE
// ============================================================================
//
// Pure background analytics tracker. ZERO authority over sign-in/sign-out.
// All DB writes are fire-and-forget. Failures are completely silent.
// Never, ever causes a logout or affects auth state.
// ============================================================================

import { supabase } from "../config/supabase";

const DB_THROTTLE_MS  = 2 * 60_000;
const HEARTBEAT_MS    = 5 * 60_000;
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

  async startSession(userId) {
    if (this._active && this._userId === userId) {
      if (!this._heartbeat) {
        this._heartbeat = setInterval(() => this._updateActivity(), HEARTBEAT_MS);
      }
      return;
    }
    if (this._active && this._userId !== userId) await this.stopSession();

    this._active = true;
    this._userId = userId;
    this._createOrUpdateSession().catch(() => {});
    for (const ev of ACTIVITY_EVENTS) window.addEventListener(ev, this._boundActivity, { passive: true });
    clearInterval(this._heartbeat);
    this._heartbeat = setInterval(() => this._updateActivity(), HEARTBEAT_MS);
  }

  async stopSession() {
    if (!this._active) return;
    this._active = false;
    for (const ev of ACTIVITY_EVENTS) window.removeEventListener(ev, this._boundActivity);
    clearInterval(this._heartbeat);
    this._heartbeat = null;
    await this._endSessionInDb().catch(() => {});
    this._userId    = null;
    this._sessionId = null;
  }

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
    } catch {}
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
        .from("user_sessions").select("id")
        .eq("user_id", this._userId).eq("is_active", true)
        .order("created_at", { ascending: false }).limit(1).maybeSingle();

      if (existing?.id) {
        this._sessionId = existing.id;
        await supabase.from("user_sessions").update({ last_activity: now, is_active: true }).eq("id", existing.id);
      } else {
        const expiresAt = new Date(
          (authSession.expires_at || Math.floor(Date.now() / 1000) + 3600) * 1000,
        ).toISOString();
        const { data: ns } = await supabase.from("user_sessions").insert({
          user_id: this._userId,
          session_token: `tok_${tokenSuffix}_${Date.now()}`,
          is_active: true, last_activity: now, expires_at: expiresAt,
          user_agent: (navigator.userAgent || "").slice(0, 250) || null,
        }).select("id").single();
        if (ns?.id) this._sessionId = ns.id;
      }
    } catch {}
  }

  async _endSessionInDb() {
    if (!this._userId) return;
    try {
      const now = new Date().toISOString();
      if (this._sessionId) {
        await supabase.from("user_sessions").update({ is_active: false, ended_at: now }).eq("id", this._sessionId);
      } else {
        await supabase.from("user_sessions").update({ is_active: false, ended_at: now })
          .eq("user_id", this._userId).eq("is_active", true);
      }
    } catch {}
  }
}

export default new SessionManager();