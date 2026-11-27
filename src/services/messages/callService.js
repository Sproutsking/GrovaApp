// ============================================================================
// src/services/messages/callService.js — call signaling and invitations
// ============================================================================
// CHANGES vs v8:
//   [PUSH-1] _sendCallPush() now uses pushService.sendPushToUser() instead of
//            calling supabase.functions.invoke() directly. Consistent with DM push.
//   [PUSH-2] Push payload now includes all fields the SW needs to show the
//            incoming call notification with Accept/Decline actions.
//   ActiveCall owns the call's only WebRTC peer connection.
// ============================================================================

import { supabase }  from "../config/supabase";
import pushService   from "../notifications/pushService";
import { DEFAULT_ICE_SERVERS, getCallIceServers } from "./callIceConfig";

const STATE = {
  IDLE:       "idle",
  RINGING:    "ringing",
  ANSWERING:  "answering",
  CONNECTING: "connecting",
  CONNECTED:  "connected",
  ENDED:      "ended",
};

class Emitter {
  constructor() { this._map = new Map(); }
  on(event, fn) {
    if (!this._map.has(event)) this._map.set(event, new Set());
    this._map.get(event).add(fn);
    return () => this._map.get(event)?.delete(fn);
  }
  emit(event, data) {
    this._map.get(event)?.forEach(fn => {
      try { fn(data); } catch (e) { console.warn("[callService] emit:", e.message); }
    });
  }
  clear() { this._map.clear(); }
}

async function dbWrite(queryFn) {
  try { await queryFn(); } catch (e) { console.warn("[callService] db:", e.message); }
}

class CallService extends Emitter {
  constructor() {
    super();
    this._userId             = null;
    this._userName           = null;
    this._userAvId           = null;
    this._state              = STATE.IDLE;
    this._activeCallId       = null;
    this._callRole           = null;
    this._calleeId           = null;
    this._lastIncoming       = null;
    this._callType           = "audio";
    this._pc                 = null;
    this._localStream        = null;
    this._remoteAudio        = null;
    this._pendingCandidates  = [];
    this._pendingOffer       = null;
    this._ringTimeout        = null;
    this._connectFallback    = null;
    this._myChannel          = null;
    this._myChannelReady     = false;
    this._outbound           = new Map();
    this._initialized        = false;
  }

  // ==========================================================================
  // INIT
  // ==========================================================================
  init(userId, userName, userAvId) {
    this._userName = userName || this._userName;
    this._userAvId = userAvId || this._userAvId;
    if (this._initialized && this._userId === userId) return;

    this._userId = userId;
    this._myChannelReady = false;

    if (this._myChannel) {
      try { supabase.removeChannel(this._myChannel); } catch {}
      this._myChannel = null;
    }

    this._myChannel = supabase
      .channel(`user_calls:${userId}`, {
        config: { broadcast: { self: false, ack: false } },
      })
      .on("broadcast", { event: "incoming_call" }, ({ payload }) => this._onIncomingCall(payload))
      .on("broadcast", { event: "call_answer"   }, ({ payload }) => this._onCallAnswer(payload))
      .on("broadcast", { event: "call_decline"  }, ({ payload }) => this._onCallDecline(payload))
      .on("broadcast", { event: "call_end"      }, ({ payload }) => this._onCallEnd(payload))
      .on("broadcast", { event: "ice_candidate" }, ({ payload }) => this._onRemoteICE(payload))
      .on("broadcast", { event: "sdp_offer"     }, ({ payload }) => this._onSdpOffer(payload))
      .on("broadcast", { event: "sdp_answer"    }, ({ payload }) => this._onSdpAnswer(payload))
      .subscribe((status) => {
        this._myChannelReady = status === "SUBSCRIBED";
        if (status === "SUBSCRIBED") console.log("[callService] ✅ ready:", userId);
      });

    this._initialized = true;
  }

  // ==========================================================================
  // START CALL
  // ==========================================================================
  async startCall({ callId, calleeId, calleeIds, callType = "audio", callerProfile, groupName, participantCount }) {
    const recipients = [...new Set((calleeIds || [calleeId]).filter((id) => id && id !== this._userId))];
    if (!this._userId || !callId || recipients.length === 0) {
      throw new Error("A signed-in caller, call ID, and recipient are required.");
    }
    if (this._state !== STATE.IDLE) {
      throw new Error("Another call is already in progress.");
    }

    this._state        = STATE.RINGING;
    this._activeCallId = callId;
    this._callRole     = "caller";
    this._calleeId     = recipients[0];
    this._callType     = callType;

    const callerName = callerProfile?.fullName || callerProfile?.full_name
      || callerProfile?.name || this._userName || "User";
    const callerAvId = callerProfile?.avatar_id || callerProfile?.avatarId
      || this._userAvId || null;

    const invitePayload = {
      callId, callType, type: callType,
      callerId:       this._userId,
      callerName,
      name:           callerName,
      callerAvatarId: callerAvId,
      callerAvId,
      caller: {
        id: this._userId, full_name: callerName, name: callerName,
        avatar_id: callerAvId, avatarId: callerAvId,
      },
    };

    const { error: activeCallError } = await supabase.from("active_calls").upsert({
      id: callId,
      caller_id: this._userId,
      callee_ids: recipients,
      call_type: callType,
      group_name: groupName || null,
      status: "ringing",
    });
    if (activeCallError) {
      this._resetState();
      throw new Error(`Could not register the call invitation: ${activeCallError.message}`);
    }
    if (this._activeCallId !== callId || this._state !== STATE.RINGING) {
      const { error } = await supabase.from("active_calls")
        .update({ status: "ended", ended_at: new Date().toISOString() })
        .eq("id", callId);
      if (error) console.warn("[callService] Could not persist cancelled call:", error.message);
      return callId;
    }

    await Promise.all(recipients.map(async (recipientId) => {
      await this._broadcastToUser(recipientId, "incoming_call", {
        ...invitePayload,
        groupName: groupName || null,
        participantCount: participantCount || recipients.length + 1,
      });
      if (this._activeCallId !== callId || this._state !== STATE.RINGING) return;
      await this._sendCallPush({ calleeId: recipientId, callId, callerName, callerAvId, callType });
    }));

    return callId;
  }

  // ==========================================================================
  // ANSWER CALL — THIS is where mic opens
  // ==========================================================================
  async answerCall(callId) {
    if (this._state === STATE.ANSWERING || this._state === STATE.CONNECTING) return;

    this._activeCallId = callId;
    this._callRole     = "callee";
    this._state        = STATE.ANSWERING;

    const call     = this._lastIncoming;
    const targetId = call?.callerId || call?.caller?.id;

    if (targetId) {
      await this._broadcastToUser(targetId, "call_answer", {
        callId, calleeId: this._userId, calleeName: this._userName,
      });
    }

    this._state = STATE.CONNECTING;
    const { error } = await supabase.from("active_calls").update({ status: "answered" }).eq("id", callId);
    if (error) console.warn("[callService] Could not persist answered call:", error.message);
    this.emit("call_answered", { callId });
  }

  // ==========================================================================
  // DECLINE
  // ==========================================================================
  async declineCall(callId, callerId) {
    const cid      = callId || this._activeCallId;
    const targetId = callerId
      || this._lastIncoming?.callerId
      || this._lastIncoming?.caller?.id;

    if (targetId) {
      await this._broadcastToUser(targetId, "call_decline", {
        callId: cid, calleeId: this._userId,
      });
    }
    if (cid) {
      const { error } = await supabase.from("active_calls")
        .update({ status: "declined", ended_at: new Date().toISOString() })
        .eq("id", cid);
      if (error) console.warn("[callService] Could not persist declined call:", error.message);
    }

    this._clearRingTimeout();
    this._cleanupPeer();
    this._resetState();
  }

  // ==========================================================================
  // END CALL
  // ==========================================================================
  async endCall(callId, remoteUserId) {
    const cid      = callId || this._activeCallId;
    const targetId = remoteUserId
      || (this._callRole === "caller" ? this._calleeId : null)
      || this._lastIncoming?.callerId
      || this._lastIncoming?.caller?.id;

    this._state = STATE.ENDED;

    if (targetId) {
      await this._broadcastToUser(targetId, "call_end", {
        callId: cid, endedBy: this._userId,
      });
    }

    dbWrite(() =>
      supabase.from("active_calls")
        .update({ status: "ended", ended_at: new Date().toISOString() })
        .eq("id", cid)
    );

    this._clearRingTimeout();
    this._cleanupPeer();
    this.emit("call_ended", { callId: cid });

    setTimeout(() => {
      if (this._localStream) {
        this._localStream.getTracks().forEach(t => t.stop());
        this._localStream = null;
      }
    }, 500);

    this._resetState();
  }

  async finishCallInvitation({ callId, recipientIds = [], status = "ended" }) {
    if (!callId || !this._userId) return;
    const targets = [...new Set(recipientIds.filter((id) => id && id !== this._userId))];
    await Promise.all(targets.map((targetId) =>
      this._broadcastToUser(targetId, "call_end", { callId, endedBy: this._userId, status })
    ));
    const { error } = await supabase.from("active_calls")
      .update({ status, ended_at: new Date().toISOString() })
      .eq("id", callId);
    if (error) console.warn("[callService] Could not persist ended call:", error.message);

    await Promise.all(targets.map(async (targetId) => {
      if (!error) await this._sendCallCancellation(targetId, callId);
    }));
    if (this._activeCallId === callId || this._lastIncoming?.callId === callId) {
      this._clearRingTimeout();
      this._cleanupPeer();
      this._resetState();
    }
  }

  // ==========================================================================
  // CONTROLS
  // ==========================================================================
  setMuted(muted)          { this._localStream?.getAudioTracks().forEach(t => { t.enabled = !muted; }); }
  setVideoEnabled(enabled) { this._localStream?.getVideoTracks().forEach(t => { t.enabled = enabled; }); }
  setSpeakerEnabled(enabled) {
    if (this._remoteAudio) this._remoteAudio.muted = !enabled;
    document.querySelectorAll("audio[data-call-audio]").forEach(el => {
      try { el.muted = !enabled; } catch {}
    });
  }
  getLocalStream()    { return this._localStream; }
  getPeerConnection() { return this._pc; }
  getCallState()      { return this._state; }
  isInCall()          { return this._state !== STATE.IDLE && this._state !== STATE.ENDED; }

  // ==========================================================================
  // CLEANUP
  // ==========================================================================
  cleanup() {
    this._clearRingTimeout();
    this._cleanupPeer();
    this._outbound.forEach(({ ch }) => { try { supabase.removeChannel(ch); } catch {} });
    this._outbound.clear();
    try { supabase.removeChannel(this._myChannel); } catch {}
    this._myChannel      = null;
    this._myChannelReady = false;
    this._initialized    = false;
    this._userId         = null;
    this._resetState();
    this.clear();
  }

  // ==========================================================================
  // INBOUND HANDLERS
  // ==========================================================================
  _onIncomingCall(payload) {
    if (!payload?.callId) return;
    this._lastIncoming = payload;
    this._callType     = payload.callType || payload.type || "audio";
    if (this._state === STATE.IDLE) this._state = STATE.RINGING;
    this.emit("incoming_call", payload);
    try { window.dispatchEvent(new CustomEvent("nova:incoming_call", { detail: payload })); } catch {}
  }

  async _onSdpOffer(payload) {
    if (!payload?.sdp) return;
    const callType = this._callType || "audio";

    if (this._state === STATE.RINGING || this._state === STATE.IDLE) {
      this._pendingOffer = payload;
      if (!this._pc) await this._setupRecvOnlyPeer(callType);
      try {
        await this._pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
        for (const c of this._pendingCandidates) await this._pc.addIceCandidate(c).catch(() => {});
        this._pendingCandidates = [];
      } catch (e) { console.warn("[callService] setRemote (pre-answer):", e.message); }
      return;
    }
    await this._processPendingOffer(payload, payload.callerId);
  }

  async _processPendingOffer(payload, targetId) {
    try {
      if (!this._pc) await this._setupRecvOnlyPeer(this._callType || "audio");
      if (this._pc.signalingState === "stable") {
        await this._pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
      }
      for (const c of this._pendingCandidates) await this._pc.addIceCandidate(c).catch(() => {});
      this._pendingCandidates = [];

      const answer = await this._pc.createAnswer();
      await this._pc.setLocalDescription(answer);

      const tid = targetId || payload.callerId;
      if (tid) {
        await this._broadcastToUser(tid, "sdp_answer", {
          callId: payload.callId || this._activeCallId,
          sdp: answer, calleeId: this._userId,
        });
      }
    } catch (e) { console.warn("[callService] processPendingOffer:", e.message); }
  }

  async _onSdpAnswer(payload) {
    try {
      if (this._pc && this._pc.signalingState !== "stable") {
        await this._pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
        for (const c of this._pendingCandidates) await this._pc.addIceCandidate(c).catch(() => {});
        this._pendingCandidates = [];
        this._state = STATE.CONNECTING;
        this._scheduleConnectFallback(payload.callId || this._activeCallId);
      }
    } catch (e) { console.warn("[callService] sdp answer:", e.message); }
  }

  async _onRemoteICE(payload) {
    if (!payload?.candidate) return;
    try {
      const c = new RTCIceCandidate(payload.candidate);
      if (this._pc?.remoteDescription) await this._pc.addIceCandidate(c);
      else this._pendingCandidates.push(c);
    } catch {}
  }

  _onCallAnswer(payload) {
    if (this._activeCallId && payload?.callId !== this._activeCallId) return;
    this._clearRingTimeout();
    this._state = STATE.CONNECTING;
    this.emit("call_answered", payload);
  }

  _onCallDecline(payload) {
    if (this._activeCallId && payload?.callId !== this._activeCallId) return;
    this._clearRingTimeout();
    this.emit("call_declined", payload);
    this._cleanupPeer();
    this._resetState();
  }

  _onCallEnd(payload) {
    if (this._activeCallId && payload?.callId !== this._activeCallId) return;
    this._clearRingTimeout();
    if (payload?.status === "no_answer" && payload?.endedBy && payload.endedBy !== this._userId) {
      this.emit("missed_call", { callId: payload.callId });
    }
    this.emit("call_ended", payload);
    try { window.dispatchEvent(new CustomEvent("nova:call_ended", { detail: payload })); } catch {}
    this._cleanupPeer();
    this._resetState();
  }

  // ==========================================================================
  // WEBRTC
  // ==========================================================================
  async _setupRecvOnlyPeer(callType = "audio") {
    if (this._pc) return this._pc;

    let iceServers = DEFAULT_ICE_SERVERS;
    try {
      iceServers = await getCallIceServers();
    } catch (error) {
      console.warn("[callService] TURN relay unavailable; using STUN:", error?.message || error);
    }
    this._pc = new RTCPeerConnection({ iceServers });
    this._pc.addTransceiver("audio", { direction: "recvonly" });
    if (callType.includes("video")) {
      this._pc.addTransceiver("video", { direction: "recvonly" });
    }

    this._pc.onicecandidate = (e) => {
      if (!e.candidate) return;
      const remote = this._calleeId
        || this._lastIncoming?.callerId
        || this._lastIncoming?.caller?.id;
      if (remote) {
        this._broadcastToUser(remote, "ice_candidate", {
          callId: this._activeCallId, candidate: e.candidate.toJSON(),
        });
      }
    };

    this._pc.ontrack = (e) => {
      const [stream] = e.streams;
      this.emit("remote_stream", { stream });
      this._attachRemoteAudio(stream);
    };

    this._pc.onconnectionstatechange = () => {
      const s = this._pc?.connectionState;
      this.emit("connection_state", { state: s });
      if (s === "connected") {
        this._clearConnectFallback();
        this._state = STATE.CONNECTED;
        this.emit("call_connected", { callId: this._activeCallId });
      }
      if (s === "failed" || s === "disconnected") {
        this.emit("call_ended", { callId: this._activeCallId, reason: "connection_lost" });
        this._cleanupPeer();
        this._resetState();
      }
    };

    return this._pc;
  }

  async _openLocalMedia(callType = "audio") {
    if (this._localStream) return this._localStream;
    try {
      this._localStream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        video: callType.includes("video")
          ? { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: "user" }
          : false,
      });
      if (this._pc) {
        this._pc.getSenders().forEach(sender => {
          if (!sender.track) {
            const track = callType.includes("video")
              ? this._localStream.getVideoTracks()[0]
              : this._localStream.getAudioTracks()[0];
            if (track) sender.replaceTrack(track).catch(() => {});
          }
        });
      }
      return this._localStream;
    } catch (err) {
      console.warn("[callService] getUserMedia failed:", err.message);
      try {
        this._localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        return this._localStream;
      } catch (err2) {
        console.error("[callService] Cannot access mic:", err2.message);
        return null;
      }
    }
  }

  _attachRemoteAudio(stream) {
    if (!this._remoteAudio) {
      this._remoteAudio = document.createElement("audio");
      this._remoteAudio.autoplay    = true;
      this._remoteAudio.playsInline = true;
      this._remoteAudio.setAttribute("data-call-audio", "true");
      this._remoteAudio.style.cssText = "position:fixed;width:0;height:0;opacity:0;pointer-events:none;z-index:-1;";
      document.body.appendChild(this._remoteAudio);
    }
    this._remoteAudio.srcObject = stream;
    this._remoteAudio.play().catch(() => {});
  }

  _cleanupPeer() {
    this._clearConnectFallback();
    if (this._localStream) {
      this._localStream.getTracks().forEach(t => { try { t.stop(); t.enabled = false; } catch {} });
      this._localStream = null;
    }
    if (this._pc) {
      try {
        this._pc.getSenders().forEach(s => { try { this._pc.removeTrack(s); } catch {} });
        this._pc.close();
      } catch {}
      this._pc = null;
    }
    if (this._remoteAudio) {
      try { this._remoteAudio.pause(); this._remoteAudio.srcObject = null; this._remoteAudio.remove(); }
      catch {}
      this._remoteAudio = null;
    }
    this._pendingCandidates = [];
    this._pendingOffer      = null;
  }

  _clearRingTimeout() {
    if (this._ringTimeout) { clearTimeout(this._ringTimeout); this._ringTimeout = null; }
  }

  _scheduleConnectFallback(callId) {
    this._clearConnectFallback();
    this._connectFallback = setTimeout(() => {
      if (this._state === STATE.CONNECTING && this._pc?.connectionState !== "connected") {
        this._state = STATE.CONNECTED;
        this.emit("call_connected", { callId: callId || this._activeCallId });
      }
    }, 1400);
  }

  _clearConnectFallback() {
    if (this._connectFallback) { clearTimeout(this._connectFallback); this._connectFallback = null; }
  }

  _resetState() {
    this._state        = STATE.IDLE;
    this._activeCallId = null;
    this._callRole     = null;
    this._calleeId     = null;
    this._lastIncoming = null;
    this._callType     = "audio";
    this._clearConnectFallback();
  }

  // ==========================================================================
  // SIGNALING — cached outbound channels
  // ==========================================================================
  async _ensureOutboundChannel(targetUserId) {
    const existing = this._outbound.get(targetUserId);
    const now      = Date.now();

    if (existing && existing.ready && (now - existing.createdAt) < 60_000) {
      return existing.ch;
    }
    if (existing?.ch) { try { supabase.removeChannel(existing.ch); } catch {} }

    const ch    = supabase.channel(`user_calls:${targetUserId}`, {
      config: { broadcast: { self: false, ack: false } },
    });
    const entry = { ch, ready: false, createdAt: now };
    this._outbound.set(targetUserId, entry);

    await new Promise((resolve) => {
      const timeout = setTimeout(() => {
        console.warn("[callService] outbound subscribe timeout:", targetUserId);
        resolve();
      }, 3000);
      ch.subscribe((status) => {
        if (status === "SUBSCRIBED") { entry.ready = true; clearTimeout(timeout); resolve(); }
        else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") { clearTimeout(timeout); resolve(); }
      });
    });

    setTimeout(() => {
      const e = this._outbound.get(targetUserId);
      if (e?.ch === ch) {
        try { supabase.removeChannel(ch); } catch {}
        this._outbound.delete(targetUserId);
      }
    }, 120_000);

    return ch;
  }

  async _broadcastToUser(targetUserId, event, payload) {
    if (!targetUserId) return;
    try {
      const ch = await this._ensureOutboundChannel(targetUserId);
      if (event === "incoming_call"
        && (this._activeCallId !== payload?.callId || this._state !== STATE.RINGING)) return;
      await ch.send({ type: "broadcast", event, payload });
    } catch (e) { console.warn("[callService] broadcast to", targetUserId, ":", e.message); }
  }

  // [PUSH-1] Use pushService.sendPushToUser() — consistent, auth-handled
  _sendCallPush({ calleeId, callId, callerName, callerAvId, callType }) {
    return pushService.sendPushToUser({
      recipientUserId: calleeId,
      actorUserId:     this._userId,
      type:            "incoming_call",
      entityId:        callId,
      title:           `📞 ${callerName} is calling`,
      message:         `Incoming ${callType === "video" ? "video" : "voice"} call — tap to answer`,
      metadata: {
        // [PUSH-2] All fields the SW needs for call notification
        url:          "/messages",
        callId,
        call_id:      callId,
        callerName,
        caller_name:  callerName,
        callerAvId,
        callerAvatarId: callerAvId,
        caller_avatar_id: callerAvId,
        callType,
        call_type:    callType,
        notification_id: `call_${callId}`,
      },
    }).then((result) => {
      if (!result) console.info("[callService] Call push not delivered by the push service.");
    }).catch((error) => console.warn("[callService] Call push failed:", error?.message || error));
  }

  _sendCallCancellation(recipientId, callId) {
    return pushService.sendPushToUser({
      recipientUserId: recipientId,
      actorUserId: this._userId,
      type: "call_cancelled",
      entityId: callId,
      metadata: { call_id: callId },
    }).then((result) => {
      if (!result) console.info("[callService] Call cancellation push not delivered by the push service.");
    }).catch((error) => console.warn("[callService] Call cancellation push failed:", error?.message || error));
  }

  // Used by group calls
  async _sendInviteToCallee({ callId, calleeId, callType, groupName, participantCount }) {
    return this._broadcastToUser(calleeId, "incoming_call", {
      callId, callType, type: callType || "audio",
      callerId:         this._userId,
      callerName:       this._userName || "User",
      callerAvatarId:   this._userAvId || null,
      groupName:        groupName || null,
      participantCount: participantCount || 0,
      caller: { id: this._userId, full_name: this._userName || "User", avatar_id: this._userAvId },
    });
  }
}

const callService = new CallService();
export default callService;