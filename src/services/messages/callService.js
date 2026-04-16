// ============================================================================
// services/messages/callService.js — NOVA CALL SERVICE v3 COMPLETE
// ============================================================================
// WHAT THIS DOES:
//  - Caller: inserts into active_calls table, waits for callee to answer
//  - Callee: subscribes to active_calls for their id → shows incoming call popup
//  - Both: real-time via Supabase postgres_changes + broadcast channel
//  - Timeout: after 45s with no answer → status = "missed", emit missed_call
//  - Logs: every completed/missed/declined call goes into call_logs table
//  - EventEmitter: callService.on("missed_call", cb), .on("incoming_call", cb)
// ============================================================================

import { supabase } from "../config/supabase";

const isAbort = e => e?.name === "AbortError" || e?.message?.includes("abort") || e?.message?.includes("AbortError");

class CallService {
  constructor() {
    this._userId          = null;
    this._userName        = null;
    this._userAvId        = null;
    this._listeners       = new Map();
    this._incomingChannel = null;
    this._activeCallId    = null;
    this._ringTimeout     = null;
    this._initialized     = false;
  }

  // ── EventEmitter ──────────────────────────────────────────────────────────
  on(event, cb) {
    if (!this._listeners.has(event)) this._listeners.set(event, new Set());
    this._listeners.get(event).add(cb);
    return () => this._listeners.get(event)?.delete(cb);
  }

  emit(event, data) {
    this._listeners.get(event)?.forEach(cb => { try { cb(data); } catch (_) {} });
  }

  // ── INIT — subscribe to incoming calls ────────────────────────────────────
  init(userId, userName, userAvId) {
    if (this._initialized && this._userId === userId) return;
    this._userId   = userId;
    this._userName = userName;
    this._userAvId = userAvId;
    this._initialized = true;
    this._subscribeIncoming();
    console.log("[CallService] v3 init:", userId);
  }

  _subscribeIncoming() {
    if (!this._userId) return;
    if (this._incomingChannel) {
      try { supabase.removeChannel(this._incomingChannel); } catch (_) {}
    }

    // Listen for active_calls where this user is in callee_ids and status = "ringing"
    this._incomingChannel = supabase
      .channel(`incoming_calls:${this._userId}`)
      // DB changes — new call inserted
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table:  "active_calls",
      }, payload => {
        const row = payload.new;
        if (!row?.id) return;
        const calleeIds = Array.isArray(row.callee_ids) ? row.callee_ids : [];
        if (!calleeIds.includes(this._userId)) return;
        if (row.status !== "ringing") return;
        if (row.caller_id === this._userId) return; // ignore own calls
        this._handleIncomingCall(row);
      })
      // DB changes — call status updated (answered/declined/ended)
      .on("postgres_changes", {
        event: "UPDATE",
        schema: "public",
        table:  "active_calls",
      }, payload => {
        const row = payload.new;
        if (!row?.id) return;
        const calleeIds = Array.isArray(row.callee_ids) ? row.callee_ids : [];
        if (!calleeIds.includes(this._userId) && row.caller_id !== this._userId) return;
        this._handleCallUpdate(row);
      })
      // Broadcast channel — direct ring signal (faster than DB)
      .on("broadcast", { event: "ring" }, ({ payload }) => {
        if (!payload?.callId) return;
        const calleeIds = Array.isArray(payload.calleeIds) ? payload.calleeIds : [];
        if (!calleeIds.includes(this._userId)) return;
        if (payload.callerId === this._userId) return;
        this._handleIncomingCall({
          id:         payload.callId,
          caller_id:  payload.callerId,
          callee_ids: payload.calleeIds,
          call_type:  payload.callType || "audio",
          status:     "ringing",
          group_name: payload.groupName || null,
          caller:     payload.caller || null,
        });
      })
      .subscribe(status => { console.log("[CallService] incoming channel:", status); });
  }

  _handleIncomingCall(row) {
    console.log("[CallService] ← incoming call:", row.id);
    this.emit("incoming_call", {
      callId:    row.id,
      callerId:  row.caller_id,
      type:      row.call_type || "audio",
      groupName: row.group_name || null,
      caller:    row.caller    || null,
      isVideo:   (row.call_type || "").includes("video"),
    });
  }

  _handleCallUpdate(row) {
    if (row.status === "answered") {
      this.emit("call_answered", { callId: row.id });
    } else if (row.status === "ended" || row.status === "declined") {
      if (row.caller_id !== this._userId) {
        // Callee side: caller ended/cancelled
        this.emit("call_ended", { callId: row.id, reason: row.status });
      }
    } else if (row.status === "missed") {
      this.emit("missed_call", { callId: row.id });
    }
  }

  // ── START CALL (caller side) ──────────────────────────────────────────────
  async startCall({ callId, calleeId, calleeName, calleeAvId, callType = "audio", callerProfile }) {
    if (!this._userId || !calleeId) throw new Error("Invalid call parameters");

    const id = callId || `call_${this._userId}_${calleeId}_${Date.now()}`;
    this._activeCallId = id;

    const callRecord = {
      id,
      caller_id:  this._userId,
      callee_ids: [calleeId],
      call_type:  callType,
      status:     "ringing",
    };

    // 1. Insert into active_calls
    try {
      const { error } = await supabase.from("active_calls").insert(callRecord);
      if (error && !error.message?.includes("does not exist")) console.warn("[CallService] insert:", error.message);
    } catch (e) { if (!isAbort(e)) console.warn("[CallService] startCall:", e.message); }

    // 2. Broadcast ring signal directly (faster delivery)
    try {
      const ch = supabase.channel(`incoming_calls:${calleeId}`);
      ch.subscribe(status => {
        if (status === "SUBSCRIBED") {
          ch.send({
            type:    "broadcast",
            event:   "ring",
            payload: {
              callId,
              callerId:   this._userId,
              calleeIds:  [calleeId],
              callType,
              caller: {
                id:        this._userId,
                full_name: callerProfile?.fullName || callerProfile?.full_name || this._userName || "Unknown",
                avatar_id: callerProfile?.avatarId || callerProfile?.avatar_id || this._userAvId,
              },
            },
          });
          setTimeout(() => { try { supabase.removeChannel(ch); } catch (_) {} }, 3000);
        }
      });
    } catch (e) { console.warn("[CallService] broadcast ring:", e.message); }

    // 3. Set ring timeout — 45s → auto-miss
    this._startRingTimeout(id, calleeId, callType);

    return { callId: id };
  }

  _startRingTimeout(callId, calleeId, callType) {
    this._clearRingTimeout();
    this._ringTimeout = setTimeout(async () => {
      console.log("[CallService] ring timeout →", callId);
      try {
        await supabase.from("active_calls").update({ status: "missed", ended_at: new Date().toISOString() }).eq("id", callId);
        await this._logCall({ callId, calleeId, callType, status: "missed", durationSecs: 0 });
      } catch (e) { if (!isAbort(e)) console.warn("[CallService] timeout update:", e.message); }
      this._activeCallId = null;
      this.emit("missed_call", { callId, calleeId });
      this.emit("call_ended", { callId, reason: "timeout" });
    }, 45000);
  }

  _clearRingTimeout() {
    if (this._ringTimeout) { clearTimeout(this._ringTimeout); this._ringTimeout = null; }
  }

  // ── ANSWER CALL (callee side) ─────────────────────────────────────────────
  async answerCall(callId) {
    if (!callId) return;
    this._clearRingTimeout();
    try {
      await supabase.from("active_calls").update({ status: "answered" }).eq("id", callId);
    } catch (e) { if (!isAbort(e)) console.warn("[CallService] answerCall:", e.message); }
    this.emit("call_answered", { callId });
  }

  // ── DECLINE CALL (callee side) ────────────────────────────────────────────
  async declineCall(callId, callerId, callType) {
    if (!callId) return;
    this._clearRingTimeout();
    try {
      await supabase.from("active_calls").update({ status: "declined", ended_at: new Date().toISOString() }).eq("id", callId);
      await this._logCall({ callId, calleeId: this._userId, callerId, callType: callType || "audio", status: "declined", durationSecs: 0 });
    } catch (e) { if (!isAbort(e)) console.warn("[CallService] declineCall:", e.message); }
    this.emit("call_ended", { callId, reason: "declined" });
  }

  // ── END CALL (both sides) ─────────────────────────────────────────────────
  async endCall(callId, calleeId, callType, durationSecs = 0) {
    if (!callId) return;
    this._clearRingTimeout();
    this._activeCallId = null;
    try {
      await supabase.from("active_calls").update({ status: "ended", ended_at: new Date().toISOString() }).eq("id", callId);
      const status = durationSecs > 0 ? "answered" : "missed";
      await this._logCall({ callId, calleeId: calleeId || this._userId, callType: callType || "audio", status, durationSecs });
    } catch (e) { if (!isAbort(e)) console.warn("[CallService] endCall:", e.message); }
    this.emit("call_ended", { callId, reason: "ended" });
  }

  // ── LOG to call_logs ──────────────────────────────────────────────────────
  async _logCall({ callId, calleeId, callerId, callType, status, durationSecs }) {
    if (!this._userId) return;
    try {
      await supabase.from("call_logs").insert({
        caller_id:     callerId || this._userId,
        callee_id:     calleeId || this._userId,
        type:          callType || "audio",
        status:        status   || "missed",
        duration_secs: durationSecs || 0,
      });
    } catch (e) { if (!isAbort(e)) console.warn("[CallService] log:", e.message); }
  }

  // ── Listen for active call updates (to know if callee answered) ───────────
  subscribeToCall(callId, callbacks = {}) {
    const ch = supabase
      .channel(`call_state:${callId}`)
      .on("postgres_changes", {
        event: "UPDATE", schema: "public", table: "active_calls",
        filter: `id=eq.${callId}`,
      }, payload => {
        const row = payload.new;
        if (row.status === "answered")  callbacks.onAnswered?.();
        if (row.status === "declined")  callbacks.onDeclined?.();
        if (row.status === "ended")     callbacks.onEnded?.();
        if (row.status === "missed")    callbacks.onMissed?.();
      })
      .subscribe();
    return () => { try { supabase.removeChannel(ch); } catch (_) {} };
  }

  cleanup() {
    this._clearRingTimeout();
    if (this._incomingChannel) {
      try { supabase.removeChannel(this._incomingChannel); } catch (_) {}
      this._incomingChannel = null;
    }
    this._listeners.clear();
    this._userId      = null;
    this._initialized = false;
  }
}

export default new CallService();