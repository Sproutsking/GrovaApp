// src/services/messages/callService.js — v6 REALTIME BROADCAST FIXED
// ============================================================================
// FIXES v6:
//  [RT-1]  _broadcastToUser() now waits for SUBSCRIBED before sending.
//          Previously sent immediately — channel not ready → REST fallback warning.
//  [RT-2]  Channel subscription uses { ack: false } config to suppress warnings.
//  [RT-3]  _myChannel subscription correctly tracks SUBSCRIBED state.
//  All v5 CRASH-FIX, PUSH-FIX, NAME-FIX, END-FIX preserved exactly.
// ============================================================================

import { supabase } from "../config/supabase";

const ICE_SERVERS = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302"  },
    { urls: "stun:stun1.l.google.com:19302" },
    { urls: "stun:stun2.l.google.com:19302" },
    { urls: "stun:stun3.l.google.com:19302" },
  ],
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
    this._userId            = null;
    this._userName          = null;
    this._userAvId          = null;
    this._activeCallId      = null;
    this._callRole          = null;
    this._calleeId          = null;
    this._lastIncomingCall  = null;
    this._pc                = null;
    this._localStream       = null;
    this._remoteAudio       = null;
    this._pendingCandidates = [];
    this._myChannel         = null;
    this._myChannelReady    = false; // [RT-3]
    this._initialized       = false;
  }

  // ── init ──────────────────────────────────────────────────────────────────
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
        config: { broadcast: { self: false, ack: false } }, // [RT-2]
      })
      .on("broadcast", { event: "incoming_call" }, ({ payload }) => this._onIncomingCall(payload))
      .on("broadcast", { event: "call_answer"   }, ({ payload }) => this._onCallAnswer(payload))
      .on("broadcast", { event: "call_decline"  }, ({ payload }) => this._onCallDecline(payload))
      .on("broadcast", { event: "call_end"      }, ({ payload }) => this._onCallEnd(payload))
      .on("broadcast", { event: "ice_candidate" }, ({ payload }) => this._onRemoteICE(payload))
      .on("broadcast", { event: "sdp_offer"     }, ({ payload }) => this._onSdpOffer(payload))
      .on("broadcast", { event: "sdp_answer"    }, ({ payload }) => this._onSdpAnswer(payload))
      .subscribe((status) => {
        // [RT-3] Track ready state
        this._myChannelReady = status === "SUBSCRIBED";
        if (status === "SUBSCRIBED") {
          console.log("[callService] ready:", userId, userName);
        }
      });

    this._initialized = true;
  }

  // ── startCall ─────────────────────────────────────────────────────────────
  async startCall({ callId, calleeId, callType = "audio", callerProfile }) {
    if (!this._userId || !calleeId) return;

    this._activeCallId = callId;
    this._callRole     = "caller";
    this._calleeId     = calleeId;

    const callerName = callerProfile?.fullName
      || callerProfile?.full_name
      || callerProfile?.name
      || this._userName
      || "User";

    const callerAvId = callerProfile?.avatar_id
      || callerProfile?.avatarId
      || this._userAvId
      || null;

    const payload = {
      callId,
      callType,
      type:           callType,
      callerId:       this._userId,
      callerName,
      name:           callerName,
      callerAvatarId: callerAvId,
      callerAvId,
      caller: {
        id:        this._userId,
        full_name: callerName,
        name:      callerName,
        avatar_id: callerAvId,
        avatarId:  callerAvId,
      },
    };

    await this._broadcastToUser(calleeId, "incoming_call", payload);

    this._sendCallPush({ calleeId, callId, callerName, callerAvId, callType });

    dbWrite(() =>
      supabase.from("active_calls").upsert({
        id:         callId,
        caller_id:  this._userId,
        callee_ids: [calleeId],
        call_type:  callType,
        status:     "ringing",
      })
    );

    try {
      await this._setupPeerConnection(callType);
      const offer = await this._pc.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: callType.includes("video"),
      });
      await this._pc.setLocalDescription(offer);
      await this._broadcastToUser(calleeId, "sdp_offer", {
        callId, sdp: offer, callerId: this._userId,
      });
    } catch (e) {
      console.warn("[callService] offer:", e.message);
    }

    return callId;
  }

  // ── answerCall ────────────────────────────────────────────────────────────
  async answerCall(callId) {
    this._activeCallId = callId;
    this._callRole     = "callee";
    const call     = this._lastIncomingCall;
    const targetId = call?.callerId || call?.caller?.id;
    if (targetId) {
      await this._broadcastToUser(targetId, "call_answer", {
        callId, calleeId: this._userId, calleeName: this._userName,
      });
    }
    dbWrite(() =>
      supabase.from("active_calls").update({ status: "answered" }).eq("id", callId)
    );
    this.emit("call_answered", { callId });
  }

  // ── declineCall ───────────────────────────────────────────────────────────
  async declineCall(callId, callerId, _callType) {
    const cid      = callId || this._activeCallId;
    const targetId = callerId
      || this._lastIncomingCall?.callerId
      || this._lastIncomingCall?.caller?.id;

    if (targetId) {
      await this._broadcastToUser(targetId, "call_decline", {
        callId: cid, calleeId: this._userId,
      });
    }

    dbWrite(() =>
      supabase.from("active_calls")
        .update({ status: "declined", ended_at: new Date().toISOString() })
        .eq("id", cid)
    );

    this._cleanupPeer();
    this._activeCallId     = null;
    this._lastIncomingCall = null;
  }

  // ── endCall ───────────────────────────────────────────────────────────────
  async endCall(callId, remoteUserId) {
    const cid      = callId || this._activeCallId;
    const targetId = remoteUserId
      || (this._callRole === "caller" ? this._calleeId : null)
      || this._lastIncomingCall?.callerId
      || this._lastIncomingCall?.caller?.id;

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

    this._cleanupPeer();
    this._activeCallId     = null;
    this._callRole         = null;
    this._calleeId         = null;
    this._lastIncomingCall = null;
    this.emit("call_ended", { callId: cid });
  }

  // ── Controls ──────────────────────────────────────────────────────────────
  setMuted(muted) {
    this._localStream?.getAudioTracks().forEach(t => { t.enabled = !muted; });
  }
  setVideoEnabled(enabled) {
    this._localStream?.getVideoTracks().forEach(t => { t.enabled = enabled; });
  }
  async setSpeakerEnabled(enabled) {
    if (this._remoteAudio) this._remoteAudio.muted = !enabled;
    document.querySelectorAll("audio, video").forEach(el => {
      try { el.muted = !enabled; } catch {}
    });
  }
  getLocalStream()    { return this._localStream; }
  getPeerConnection() { return this._pc; }

  // ── cleanup ───────────────────────────────────────────────────────────────
  cleanup() {
    this._cleanupPeer();
    try { supabase.removeChannel(this._myChannel); } catch {}
    this._myChannel      = null;
    this._myChannelReady = false;
    this._initialized    = false;
    this._userId         = null;
    this._activeCallId   = null;
    this._calleeId       = null;
    this.clear();
  }

  // ── Inbound handlers ──────────────────────────────────────────────────────
  _onIncomingCall(payload) {
    if (!payload?.callId) return;
    this._lastIncomingCall = payload;
    this.emit("incoming_call", payload);
    window.dispatchEvent(new CustomEvent("nova:incoming_call", { detail: payload }));
  }

  async _onSdpOffer(payload) {
    if (!this._lastIncomingCall) return;
    const callType = this._lastIncomingCall?.callType || this._lastIncomingCall?.type || "audio";
    await this._setupPeerConnection(callType);
    try {
      await this._pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
      for (const c of this._pendingCandidates) await this._pc.addIceCandidate(c).catch(() => {});
      this._pendingCandidates = [];
      const answer = await this._pc.createAnswer();
      await this._pc.setLocalDescription(answer);
      await this._broadcastToUser(payload.callerId, "sdp_answer", {
        callId: payload.callId, sdp: answer, calleeId: this._userId,
      });
    } catch (e) { console.warn("[callService] sdp offer:", e.message); }
  }

  async _onSdpAnswer(payload) {
    try {
      if (this._pc && this._pc.signalingState !== "stable") {
        await this._pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
        for (const c of this._pendingCandidates) await this._pc.addIceCandidate(c).catch(() => {});
        this._pendingCandidates = [];
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

  _onCallAnswer(payload)  { this.emit("call_answered", payload); }

  _onCallDecline(payload) {
    this.emit("call_declined", payload);
    this._cleanupPeer();
    this._activeCallId = null;
    this._calleeId     = null;
  }

  _onCallEnd(payload) {
    this.emit("call_ended", payload);
    window.dispatchEvent(new CustomEvent("nova:call_ended", { detail: payload }));
    this._cleanupPeer();
    this._activeCallId     = null;
    this._callRole         = null;
    this._calleeId         = null;
    this._lastIncomingCall = null;
  }

  // ── WebRTC ────────────────────────────────────────────────────────────────
  async _setupPeerConnection(callType = "audio") {
    this._cleanupPeer();

    try {
      this._localStream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: callType.includes("video")
          ? { width: { ideal: 1280 }, height: { ideal: 720 } }
          : false,
      });
    } catch {
      try { this._localStream = await navigator.mediaDevices.getUserMedia({ audio: true }); } catch {}
    }

    this._pc = new RTCPeerConnection(ICE_SERVERS);
    this._localStream?.getTracks().forEach(t => this._pc.addTrack(t, this._localStream));

    this._pc.onicecandidate = (e) => {
      if (!e.candidate) return;
      const remote = this._calleeId
        || this._lastIncomingCall?.callerId
        || this._lastIncomingCall?.caller?.id;
      if (remote) {
        this._broadcastToUser(remote, "ice_candidate", {
          callId: this._activeCallId, candidate: e.candidate.toJSON(),
        });
      }
    };

    this._pc.ontrack = (e) => {
      const [stream] = e.streams;
      this.emit("remote_stream", { stream });
      if (!this._remoteAudio) {
        this._remoteAudio             = document.createElement("audio");
        this._remoteAudio.autoplay    = true;
        this._remoteAudio.playsInline = true;
        this._remoteAudio.setAttribute("style",
          "position:fixed;width:0;height:0;opacity:0;pointer-events:none;z-index:-1;");
        document.body.appendChild(this._remoteAudio);
      }
      this._remoteAudio.srcObject = stream;
      this._remoteAudio.play().catch(() => {});
    };

    this._pc.onconnectionstatechange = () => {
      const s = this._pc?.connectionState;
      this.emit("connection_state", { state: s });
      if (s === "connected")
        this.emit("call_connected",  { callId: this._activeCallId });
      if (s === "failed" || s === "disconnected")
        this.emit("call_ended", { callId: this._activeCallId, reason: "connection_lost" });
    };

    return this._pc;
  }

  _cleanupPeer() {
    try { this._localStream?.getTracks().forEach(t => t.stop()); } catch {}
    this._localStream = null;
    try { this._pc?.close(); } catch {}
    this._pc = null;
    try {
      if (this._remoteAudio) {
        this._remoteAudio.srcObject = null;
        this._remoteAudio.remove();
        this._remoteAudio = null;
      }
    } catch {}
    this._pendingCandidates = [];
  }

  // ── Signaling ─────────────────────────────────────────────────────────────
  // [RT-1] Subscribe to target channel first, wait for SUBSCRIBED, then send
  async _broadcastToUser(targetUserId, event, payload) {
    if (!targetUserId) return;
    try {
      const ch = supabase.channel(`user_calls:${targetUserId}`, {
        config: { broadcast: { self: false, ack: false } }, // [RT-2]
      });

      await new Promise(resolve => {
        const timeout = setTimeout(resolve, 4000);
        ch.subscribe(status => {
          if (status === "SUBSCRIBED" || status === "CHANNEL_ERROR") {
            clearTimeout(timeout);
            resolve();
          }
        });
      });

      await ch.send({ type: "broadcast", event, payload });

      setTimeout(() => {
        try { supabase.removeChannel(ch); } catch {}
      }, 6000);
    } catch (e) {
      console.warn("[callService] broadcast:", e.message);
    }
  }

  _sendCallPush({ calleeId, callId, callerName, callerAvId, callType }) {
    supabase.functions.invoke("send-push", {
      body: {
        recipient_user_id: calleeId,
        type:              "incoming_call",
        message:           `${callerName} is calling you`,
        metadata: {
          callId,
          callerName,
          callerAvatarId: callerAvId,
          callType,
          url: "/",
        },
      },
    }).catch(() => {});
  }
}

const callService = new CallService();
export default callService;