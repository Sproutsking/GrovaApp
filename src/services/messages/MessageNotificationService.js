// ============================================================================
// src/services/messages/MessageNotificationService.js — v7 FULLY WIRED
// ============================================================================
// FIXES vs v6:
//  [M1]  _bridgeCallServiceEvents() correctly bridges callService bus events
//        to IncomingCallToast via callEventBus.
//  [M2]  sendCallInvite() delegates to callService._sendInviteToCallee().
//  [M3]  init() safe to re-call — guards with userId check.
//  [M4]  DM toast dedup uses 60s window keyed by message ID.
//  [M5]  No longer double-subscribes to push events from SW (handled by bridge).
//  [M6]  cleanup() fully tears down call bridge unsub.
// ============================================================================

import { supabase } from "../config/supabase";
import callService  from "./callService";

// ── Simple event buses ────────────────────────────────────────────────────────
class ToastBus {
  constructor() { this._listeners = new Map(); }
  emit(event, data) {
    this._listeners.get(event)?.forEach(fn => { try { fn(data); } catch {} });
  }
  on(event, fn) {
    if (!this._listeners.has(event)) this._listeners.set(event, new Set());
    this._listeners.get(event).add(fn);
    return () => this._listeners.get(event)?.delete(fn);
  }
}

export const messageToastBus = new ToastBus();
export const callEventBus    = new ToastBus();

class MessageNotificationService {
  constructor() {
    this._userId          = null;
    this._toastCallback   = null;
    this._channels        = new Map();
    this._activeConvId    = null;
    this._seenMessageIds  = new Set();
    this._initialized     = false;
    this._callBridgeUnsub = null;
  }

  async init(userId, toastCallback) {
    // [M3] Safe re-init guard
    if (this._initialized && this._userId === userId) {
      this._toastCallback = toastCallback;
      return;
    }
    if (this._initialized) this.cleanup();

    this._userId        = userId;
    this._toastCallback = toastCallback;
    this._initialized   = true;

    this._subscribeToMessages();
    this._bridgeCallServiceEvents();
    console.log("[MsgNotif] v7 init:", userId);
  }

  setActiveConversation(convId) { this._activeConvId = convId; }
  clearActiveConversation()     { this._activeConvId = null; }

  // [M1] Bridge callService → callEventBus → IncomingCallToast
  _bridgeCallServiceEvents() {
    if (this._callBridgeUnsub) { this._callBridgeUnsub(); this._callBridgeUnsub = null; }

    this._callBridgeUnsub = callService.on("incoming_call", callInfo => {
      console.log("[MsgNotif] Bridging incoming_call:", callInfo?.callId);
      callEventBus.emit("incoming_call", callInfo);
      try {
        window.dispatchEvent(new CustomEvent("nova:incoming_call", { detail: callInfo }));
      } catch {}
    });
  }

  // [M4] DM toast with 60s dedup window
  triggerDmToast(data) {
    if (this._activeConvId && this._activeConvId === data.conversationId) return;

    const key = data.messageId || data.id;
    if (key && this._seenMessageIds.has(key)) return;
    if (key) {
      this._seenMessageIds.add(key);
      setTimeout(() => this._seenMessageIds.delete(key), 60_000);
    }

    const toast = {
      id:             key || `toast_${Date.now()}`,
      conversationId: data.conversationId,
      senderId:       data.senderId,
      senderName:     data.senderName    || "Someone",
      senderAvatar:   data.senderAvatar  || null,
      senderAvatarId: data.senderAvatarId || null,
      message:        data.message       || data.content || "",
      messageType:    data.messageType   || "text",
      duration:       5000,
    };

    messageToastBus.emit("show_message_toast", toast);
    this._toastCallback?.({ type: "dm", title: data.senderName || "New message", message: toast.message, data });
  }

  // [M2] Delegate call invite to callService
  async sendCallInvite({ callId, calleeId, callerName, callerAvatarId, callType, groupName, participantCount }) {
    if (!calleeId) return false;
    try {
      await callService._sendInviteToCallee({
        callId,
        calleeId,
        callType:         callType || "audio",
        groupName:        groupName || null,
        participantCount: participantCount || 0,
      });
      return true;
    } catch (e) {
      console.warn("[MsgNotif] sendCallInvite failed:", e?.message || e);
      return false;
    }
  }

  _subscribeToMessages() {
    if (!this._userId) return;

    const ch = supabase
      .channel(`mns_msgs:${this._userId}`)
      .on("postgres_changes", {
        event: "INSERT", schema: "public", table: "messages",
      }, async payload => {
        const msg = payload.new;
        if (!msg || msg.sender_id === this._userId) return;
        const convId = msg.conversation_id;
        if (!convId) return;
        if (this._activeConvId === convId) return;

        try {
          const [convRes, profRes] = await Promise.all([
            supabase.from("conversations").select("user1_id,user2_id").eq("id", convId).single(),
            supabase.from("profiles").select("id,full_name,avatar_id").eq("id", msg.sender_id).single(),
          ]);

          const conv   = convRes.data;
          const sender = profRes.data;
          if (!conv) return;
          if (conv.user1_id !== this._userId && conv.user2_id !== this._userId) return;

          this.triggerDmToast({
            messageId:      msg.id,
            conversationId: convId,
            senderId:       msg.sender_id,
            senderName:     sender?.full_name  || "Someone",
            senderAvatarId: sender?.avatar_id  || null,
            message:        msg.content,
            messageType:    msg.media_type     || "text",
          });
        } catch (e) {
          console.warn("[MsgNotif] toast error:", e);
        }
      })
      .subscribe();

    this._channels.set("messages", ch);
  }

  async triggerCallPush({ calleeId, callerName, callType = "audio", groupName = null, callId }) {
    if (!calleeId || !this._userId) return;
    try {
      await supabase.functions.invoke("send-push", {
        body: {
          recipient_user_id: calleeId,
          actor_user_id:     this._userId,
          type:              "incoming_call",
          title:             `📞 ${callerName || "Someone"} is calling`,
          message: groupName
            ? `Group ${callType === "video" ? "video" : "voice"} call`
            : `Incoming ${callType === "video" ? "video" : "voice"} call — tap to answer`,
          metadata: { call_type: callType, caller_name: callerName, group_name: groupName, call_id: callId },
          data:     { url: "/messages", type: "incoming_call", call_type: callType, call_id: callId },
        },
      });
    } catch (e) {
      console.warn("[MsgNotif] call push:", e.message);
    }
  }

  // [M6] Full teardown
  cleanup() {
    this._channels.forEach(ch => { try { supabase.removeChannel(ch); } catch {} });
    this._channels.clear();

    if (this._callBridgeUnsub) { this._callBridgeUnsub(); this._callBridgeUnsub = null; }

    this._userId         = null;
    this._initialized    = false;
    this._toastCallback  = null;
    this._activeConvId   = null;
    this._seenMessageIds.clear();
  }
}

export default new MessageNotificationService();