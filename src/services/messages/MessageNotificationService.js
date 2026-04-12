// services/messages/MessageNotificationService.js — NOVA v7 FIXED
// ============================================================================
// FIXES:
//  [M1] _bridgeCallServiceEvents() properly forwards callService bus events
//  [M2] sendCallInvite() delegates to callService._sendInviteToCallee()
//       which uses the correct channel topic (no _from_ suffix)
//  [M3] init() safe to call multiple times
//  [M4] DM toast dedup uses 60s window
// ============================================================================

import { supabase } from "../config/supabase";
import { messageToastBus } from "../../components/Messages/MessageToast";
import { callEventBus } from "../../components/Messages/IncomingCallToast";
import callService from "./callService";

class MessageNotificationService {
  constructor() {
    this._userId = null;
    this._toastCallback = null;
    this._channels = new Map();
    this._activeConvId = null;
    this._seenMessageIds = new Set();
    this._initialized = false;
    this._callBridgeUnsub = null;
  }

  async init(userId, toastCallback) {
    if (this._initialized && this._userId === userId) {
      this._toastCallback = toastCallback;
      return;
    }
    if (this._initialized) this.cleanup();
    this._userId = userId;
    this._toastCallback = toastCallback;
    this._initialized = true;
    this._subscribeToMessages();
    this._bridgeCallServiceEvents();
    console.log("[MsgNotif] v7 init:", userId);
  }

  setActiveConversation(convId) {
    this._activeConvId = convId;
  }
  clearActiveConversation() {
    this._activeConvId = null;
  }

  // [M1] Bridge callService events to IncomingCallToast
  _bridgeCallServiceEvents() {
    // From callService internal bus
    this._callBridgeUnsub = callService.on("incoming_call", (callInfo) => {
      console.log("[MsgNotif] Bridging incoming call:", callInfo.callId);
      this.triggerIncomingCall(callInfo);
    });
  }

  triggerDmToast(data) {
    if (this._activeConvId && this._activeConvId === data.conversationId)
      return;
    const key = data.messageId || data.id;
    if (key && this._seenMessageIds.has(key)) return;
    if (key) {
      this._seenMessageIds.add(key);
      setTimeout(() => this._seenMessageIds.delete(key), 60_000);
    }
    messageToastBus.emit("show_message_toast", {
      id: key || `toast_${Date.now()}`,
      conversationId: data.conversationId,
      senderId: data.senderId,
      senderName: data.senderName || "Someone",
      senderAvatar: data.senderAvatar,
      senderAvatarId: data.senderAvatarId,
      message: data.message || data.content || "",
      messageType: data.messageType || "text",
      duration: 5000,
    });
    this._toastCallback?.({
      type: "dm",
      title: data.senderName || "New message",
      message: data.message || data.content || "",
      data,
    });
  }

  triggerIncomingCall(callInfo) {
    // Emit to callEventBus so IncomingCallToast shows
    callEventBus.emit("incoming_call", callInfo);
    // Also dispatch window event
    try {
      window.dispatchEvent(
        new CustomEvent("nova:incoming_call", { detail: callInfo }),
      );
    } catch (_) {}
  }

  // [M2] Delegate to callService with correct channel naming
  async sendCallInvite({
    callId,
    calleeId,
    callerName,
    callerAvatarId,
    callType,
    groupName,
    participantCount,
  }) {
    if (!calleeId) return false;
    try {
      const result = await callService._sendInviteToCallee({
        callId,
        calleeId,
        callType: callType || "audio",
        groupName: groupName || null,
        participantCount: participantCount || 0,
      });
      return result;
    } catch (e) {
      console.warn("[MsgNotif] sendCallInvite failed:", e?.message || e);
      return false;
    }
  }

  _subscribeToMessages() {
    if (!this._userId) return;
    const ch = supabase
      .channel(`mns_msgs:${this._userId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        async (payload) => {
          const msg = payload.new;
          if (!msg || msg.sender_id === this._userId) return;
          const convId = msg.conversation_id;
          if (!convId) return;
          try {
            const [convR, profR] = await Promise.all([
              supabase
                .from("conversations")
                .select("user1_id,user2_id")
                .eq("id", convId)
                .single(),
              supabase
                .from("profiles")
                .select("id,full_name,avatar_id")
                .eq("id", msg.sender_id)
                .single(),
            ]);
            const conv = convR.data;
            if (!conv) return;
            if (
              conv.user1_id !== this._userId &&
              conv.user2_id !== this._userId
            )
              return;
            const sender = profR.data;
            this.triggerDmToast({
              messageId: msg.id,
              conversationId: convId,
              senderId: msg.sender_id,
              senderName: sender?.full_name || "Someone",
              senderAvatarId: sender?.avatar_id,
              message: msg.content,
              messageType: msg.media_type || "text",
            });
          } catch (e) {
            console.warn("[MsgNotif] toast error:", e);
          }
        },
      )
      .subscribe();
    this._channels.set("messages", ch);
  }

  async triggerCallPush({
    calleeId,
    callerName,
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
          title: `📞 ${callerName || "Someone"} is calling`,
          message: groupName
            ? `Group ${callType === "video" ? "video" : "voice"} call`
            : `Incoming ${callType === "video" ? "video" : "voice"} call`,
          entity_id: calleeId,
          metadata: {
            call_type: callType,
            caller_name: callerName,
            group_name: groupName,
            call_id: callId,
          },
          data: {
            url: "/messages",
            type: "incoming_call",
            call_type: callType,
            call_id: callId,
          },
        },
      });
    } catch (e) {
      console.warn("[MsgNotif] call push:", e.message);
    }
  }

  cleanup() {
    this._channels.forEach((ch) => {
      try {
        supabase.removeChannel(ch);
      } catch (_) {}
    });
    this._channels.clear();
    this._callBridgeUnsub?.();
    this._callBridgeUnsub = null;
    this._userId = null;
    this._initialized = false;
    this._toastCallback = null;
    this._activeConvId = null;
    this._seenMessageIds.clear();
  }
}

export default new MessageNotificationService();
