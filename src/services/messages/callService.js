// ============================================================================
// services/messages/callService.js — NOVA CALL SERVICE v3 FIXED
// ============================================================================
// ROOT CAUSE FIX v3:
//   The "user_calls:{calleeId}_from_{callerId}" topic NEVER matches the callee's
//   subscription on "user_calls:{calleeId}". Supabase broadcast is topic-scoped:
//   sender and receiver MUST subscribe to the IDENTICAL topic string.
//
// SOLUTION: Caller subscribes to "user_calls:{calleeId}" (same topic as callee).
//   Both sides share the topic. The callee is already subscribed from init().
//   Caller subscribes on the same topic and broadcasts — callee receives it.
//
// ALSO FIXED:
//   - callService.on("incoming_call") now dispatches window event immediately
//   - declineCall uses shared signal channel (call:{callId}) not the invite channel
//   - cleanup properly removes all sender channels
//   - init() is idempotent and updates name/avatar safely
// ============================================================================

import { supabase } from "../config/supabase";

class CallBus {
  constructor() {
    this._m = new Map();
  }
  on(evt, fn) {
    if (!this._m.has(evt)) this._m.set(evt, new Set());
    this._m.get(evt).add(fn);
    return () => this._m.get(evt)?.delete(fn);
  }
  emit(evt, data) {
    this._m.get(evt)?.forEach((fn) => {
      try {
        fn(data);
      } catch (e) {
        console.error("[CallSvc]", e);
      }
    });
  }
}

class CallService {
  constructor() {
    this._userId = null;
    this._callerName = null;
    this._callerAvatarId = null;
    this._bus = new CallBus();
    this._myIncomingChannel = null;
    this._signalChannels = new Map();
    // Sender channels keyed by calleeId — subscribed to SAME topic as callee
    this._senderChannels = new Map();
    this._initialized = false;
    this._seenCallIds = new Set();
  }

  init(userId, displayName, avatarId) {
    if (this._initialized && this._userId === userId) {
      this._callerName = displayName || this._callerName;
      this._callerAvatarId =
        avatarId !== undefined ? avatarId : this._callerAvatarId;
      return;
    }
    if (this._initialized) this.cleanup();
    this._userId = userId;
    this._callerName = displayName || "User";
    this._callerAvatarId = avatarId || null;
    this._initialized = true;
    this._openMyIncomingChannel();
    console.log("[CallSvc] v3 init:", userId, "name:", displayName);
  }

  on(evt, fn) {
    return this._bus.on(evt, fn);
  }
  off(evt, fn) {
    this._bus._m.get(evt)?.delete(fn);
  }

  // ── Persistent incoming channel — stays open all session ────────────────
  _openMyIncomingChannel() {
    if (!this._userId) return;
    if (this._myIncomingChannel) {
      try {
        supabase.removeChannel(this._myIncomingChannel);
      } catch (_) {}
    }

    const topic = `user_calls:${this._userId}`;
    this._myIncomingChannel = supabase
      .channel(topic, { config: { broadcast: { self: false, ack: false } } })
      .on("broadcast", { event: "call_invite" }, ({ payload }) => {
        if (!payload?.callId) return;
        // Filter: only accept if this is the intended callee (or group invite)
        if (payload.calleeId && payload.calleeId !== this._userId) return;
        if (this._seenCallIds.has(payload.callId)) return;
        this._seenCallIds.add(payload.callId);
        setTimeout(() => this._seenCallIds.delete(payload.callId), 120_000);

        console.log(
          "[CallSvc] ✅ Incoming call received:",
          payload.callId,
          "from:",
          payload.callerName,
        );

        const callInfo = {
          id: payload.callId,
          callId: payload.callId,
          calleeId: payload.calleeId || this._userId,
          callerId: payload.callerId,
          callerName: payload.callerName || "Someone",
          callerAvatarId: payload.callerAvatarId || null,
          type: payload.callType || "audio",
          callType: payload.callType || "audio",
          groupName: payload.groupName || null,
          participantCount: payload.participantCount || 0,
          participants: payload.participants || [],
          outgoing: false,
          name: payload.callerName || "Someone",
          user: {
            id: payload.callerId,
            full_name: payload.callerName || "Someone",
            avatar_id: payload.callerAvatarId || null,
            name: payload.callerName || "Someone",
          },
        };

        this._bus.emit("incoming_call", callInfo);
        try {
          window.dispatchEvent(
            new CustomEvent("nova:incoming_call", { detail: callInfo }),
          );
        } catch (_) {}
      })
      .subscribe((status, err) => {
        console.log(
          `[CallSvc] My incoming channel (${topic}): ${status}`,
          err || "",
        );
        if (status === "CHANNEL_ERROR") {
          // Retry after delay
          setTimeout(() => this._openMyIncomingChannel(), 5000);
        }
      });
  }

  // ════════════════════════════════════════════════════════════════════════
  // INITIATE CALL
  // ════════════════════════════════════════════════════════════════════════
  async initiateCall({
    calleeIds,
    callType = "audio",
    groupName = null,
    participants = [],
  }) {
    if (!this._userId || !calleeIds?.length)
      throw new Error("Not initialized or no callees");

    const callId = `call_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    console.log(
      "[CallSvc] Initiating call:",
      callId,
      "to:",
      calleeIds,
      "type:",
      callType,
    );

    // Persist to DB (graceful fallback)
    supabase
      .from("active_calls")
      .insert({
        id: callId,
        caller_id: this._userId,
        callee_ids: calleeIds,
        call_type: callType,
        group_name: groupName,
        status: "ringing",
      })
      .then(({ error }) => {
        if (error && !error.message?.includes("does not exist")) {
          console.warn("[CallSvc] DB persist:", error.message);
        }
      });

    // Send invite to each callee's persistent channel
    const results = await Promise.allSettled(
      calleeIds.map((calleeId) =>
        this._sendInviteToCallee({
          callId,
          calleeId,
          callType,
          groupName,
          participantCount: participants.length || calleeIds.length,
          participants,
        }),
      ),
    );

    const sent = results.filter(
      (r) => r.status === "fulfilled" && r.value,
    ).length;
    console.log(`[CallSvc] Invites sent: ${sent}/${calleeIds.length}`);

    return { callId, sent };
  }

  // ── KEY FIX: Subscribe to SAME topic as callee ─────────────────────────
  // The callee subscribes to "user_calls:{calleeId}"
  // We MUST subscribe to exactly the same topic string to broadcast to them.
  async _sendInviteToCallee({
    callId,
    calleeId,
    callType,
    groupName,
    participantCount,
    participants,
  }) {
    // The topic the callee is listening on
    const topic = `user_calls:${calleeId}`;

    return new Promise((resolve) => {
      const TIMEOUT = 12_000;
      let done = false;
      const finish = (ok) => {
        if (!done) {
          done = true;
          resolve(ok);
        }
      };
      const timer = setTimeout(() => finish(false), TIMEOUT);

      const sendPayload = (ch) => {
        const payload = {
          callId,
          calleeId,
          callerId: this._userId,
          callerName: this._callerName || "Someone",
          callerAvatarId: this._callerAvatarId || null,
          callType: callType || "audio",
          groupName: groupName || null,
          participantCount: participantCount || 0,
          participants: participants || [],
          calledAt: new Date().toISOString(),
        };

        ch.send({
          type: "broadcast",
          event: "call_invite",
          payload,
        })
          .then(() => {
            console.log(
              "[CallSvc] ✅ Invite sent to:",
              calleeId,
              "on topic:",
              topic,
            );
            clearTimeout(timer);
            finish(true);
          })
          .catch((err) => {
            console.warn("[CallSvc] Send failed:", err?.message || err);
            clearTimeout(timer);
            finish(false);
          });
      };

      const existing = this._senderChannels.get(calleeId);

      if (existing?.ready && existing?.channel) {
        sendPayload(existing.channel);
        return;
      }

      if (existing && !existing.ready) {
        existing.queue.push(sendPayload);
        return;
      }

      // Create a NEW channel subscription on the SAME topic as callee
      const entry = { channel: null, ready: false, queue: [sendPayload] };
      this._senderChannels.set(calleeId, entry);

      // CRITICAL: Use exact same topic string — no suffix!
      const ch = supabase
        .channel(topic, { config: { broadcast: { self: false, ack: false } } })
        .subscribe((status, err) => {
          console.log(
            `[CallSvc] sender→${calleeId} status:`,
            status,
            err || "",
          );
          if (status === "SUBSCRIBED") {
            entry.ready = true;
            entry.channel = ch;
            const q = [...entry.queue];
            entry.queue = [];
            q.forEach((fn) => fn(ch));
          } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
            this._senderChannels.delete(calleeId);
            clearTimeout(timer);
            finish(false);
          }
        });

      entry.channel = ch;
    });
  }

  // ── Internal method used by MessageNotificationService ─────────────────
  async _sendInviteToPersistentChannel(params) {
    return this._sendInviteToCallee(params);
  }

  // ════════════════════════════════════════════════════════════════════════
  // CALL RESPONSES
  // ════════════════════════════════════════════════════════════════════════
  acceptCall(callId) {
    const ch = this.joinSignalChannel(callId);
    ch.send({
      type: "broadcast",
      event: "call_accepted",
      payload: { userId: this._userId, acceptedAt: new Date().toISOString() },
    });
    return ch;
  }

  declineCall(callId, reason = "declined") {
    // Join signal channel to notify caller
    const ch = this.joinSignalChannel(callId);
    ch.send({
      type: "broadcast",
      event: "call_declined",
      payload: { userId: this._userId, reason },
    });
    setTimeout(() => this.leaveSignalChannel(callId), 3000);
  }

  endCall(callId) {
    const ch = this._signalChannels.get(callId);
    if (ch) {
      ch.send({
        type: "broadcast",
        event: "call_ended",
        payload: { userId: this._userId, endedAt: new Date().toISOString() },
      });
    }
    this.leaveSignalChannel(callId);
    supabase
      .from("active_calls")
      .update({ status: "ended", ended_at: new Date().toISOString() })
      .eq("id", callId)
      .then(() => {});
  }

  // ════════════════════════════════════════════════════════════════════════
  // SIGNAL CHANNEL (shared call:{callId} for WebRTC)
  // ════════════════════════════════════════════════════════════════════════
  joinSignalChannel(callId, callbacks = {}) {
    if (this._signalChannels.has(callId)) {
      return this._signalChannels.get(callId);
    }

    const ch = supabase
      .channel(`call:${callId}`, {
        config: { broadcast: { self: false, ack: false } },
      })
      .on("broadcast", { event: "call_accepted" }, ({ payload }) => {
        this._bus.emit("call_accepted", { callId, ...payload });
        callbacks.onAccepted?.(payload);
      })
      .on("broadcast", { event: "call_declined" }, ({ payload }) => {
        this._bus.emit("call_declined", { callId, ...payload });
        callbacks.onDeclined?.(payload);
      })
      .on("broadcast", { event: "call_ended" }, ({ payload }) => {
        this._bus.emit("call_ended", { callId, ...payload });
        callbacks.onEnded?.(payload);
      })
      .on("broadcast", { event: "offer" }, ({ payload }) => {
        this._bus.emit("call_offer", { callId, ...payload });
        callbacks.onOffer?.(payload);
      })
      .on("broadcast", { event: "answer" }, ({ payload }) => {
        this._bus.emit("call_answer", { callId, ...payload });
        callbacks.onAnswer?.(payload);
      })
      .on("broadcast", { event: "ice_candidate" }, ({ payload }) => {
        this._bus.emit("call_ice", { callId, ...payload });
        callbacks.onICE?.(payload);
      })
      .on("broadcast", { event: "participant_state" }, ({ payload }) => {
        this._bus.emit("participant_state", { callId, ...payload });
        callbacks.onParticipantState?.(payload);
      })
      .subscribe((status) => {
        console.log("[CallSvc] signal channel", callId, status);
        if (status === "SUBSCRIBED") {
          this._bus.emit("signal_ready", { callId });
        }
      });

    this._signalChannels.set(callId, ch);
    return ch;
  }

  leaveSignalChannel(callId) {
    const ch = this._signalChannels.get(callId);
    if (ch) {
      try {
        supabase.removeChannel(ch);
      } catch (_) {}
      this._signalChannels.delete(callId);
    }
  }

  sendOffer(callId, sdp) {
    this._signalChannels
      .get(callId)
      ?.send({ type: "broadcast", event: "offer", payload: { sdp } });
  }
  sendAnswer(callId, sdp) {
    this._signalChannels
      .get(callId)
      ?.send({ type: "broadcast", event: "answer", payload: { sdp } });
  }
  sendICE(callId, candidate) {
    this._signalChannels
      .get(callId)
      ?.send({
        type: "broadcast",
        event: "ice_candidate",
        payload: { candidate: candidate.toJSON() },
      });
  }
  sendParticipantState(callId, state) {
    this._signalChannels
      .get(callId)
      ?.send({
        type: "broadcast",
        event: "participant_state",
        payload: { userId: this._userId, ...state },
      });
  }

  async sendCallPushNotification({
    calleeId,
    callType = "audio",
    groupName = null,
    callId,
  }) {
    if (!calleeId || !this._userId) return;
    try {
      await supabase.functions.invoke("send-push", {
        body: {
          recipient_user_id: calleeId,
          actor_user_id: this._userId,
          type: "incoming_call",
          title: `📞 ${this._callerName || "Someone"} is calling`,
          message: groupName
            ? `Group ${callType === "video" ? "video" : "voice"} call in ${groupName}`
            : `Incoming ${callType === "video" ? "video" : "voice"} call`,
          entity_id: calleeId,
          metadata: {
            call_type: callType,
            caller_name: this._callerName,
            caller_avatar: this._callerAvatarId,
            group_name: groupName,
            call_id: callId,
          },
          data: {
            url: "/messages",
            type: "incoming_call",
            call_type: callType,
            call_id: callId,
            group_name: groupName,
          },
        },
      });
    } catch (e) {
      console.warn("[CallSvc] push notification failed:", e.message);
    }
  }

  cleanup() {
    if (this._myIncomingChannel) {
      try {
        supabase.removeChannel(this._myIncomingChannel);
      } catch (_) {}
      this._myIncomingChannel = null;
    }
    this._signalChannels.forEach((ch) => {
      try {
        supabase.removeChannel(ch);
      } catch (_) {}
    });
    this._signalChannels.clear();
    this._senderChannels.forEach(({ channel }) => {
      if (channel) {
        try {
          supabase.removeChannel(channel);
        } catch (_) {}
      }
    });
    this._senderChannels.clear();
    this._seenCallIds.clear();
    this._userId = null;
    this._initialized = false;
  }
}

export default new CallService();
