// ============================================================================
// services/messages/MessageNotificationService.js — NOVA v2
// ============================================================================
// Handles:
//   • In-app message toast display (instant, zero-latency)
//   • OS-level push notification trigger for background delivery
//   • Incoming call toast events via callEventBus
//   • Integration with Supabase Realtime for sub-100ms message delivery
// ============================================================================

import { supabase } from "../config/supabase";
import { messageToastBus } from "../../components/Messages/MessageToast";
import { callEventBus }    from "../../components/Messages/IncomingCallToast";

class MessageNotificationService {
  constructor() {
    this._userId          = null;
    this._toastCallback   = null;
    this._channels        = new Map();
    this._activeConvId    = null; // currently open conversation
    this._seenMessageIds  = new Set();
    this._initialized     = false;
  }

  /* ── Initialize ─────────────────────────────────────────────────────── */
  async init(userId, toastCallback) {
    if (this._initialized && this._userId === userId) return;
    this._userId        = userId;
    this._toastCallback = toastCallback;
    this._initialized   = true;

    // Subscribe to ALL conversations for this user via Supabase Realtime
    // We listen for new messages where we are the recipient
    this._subscribeToMessages();
    this._subscribeToIncomingCalls();

    console.log("[MsgNotif] Initialized for user:", userId);
  }

  /* ── Set active conversation (suppress toasts for open convs) ───────── */
  setActiveConversation(convId) {
    this._activeConvId = convId;
  }

  clearActiveConversation() {
    this._activeConvId = null;
  }

  /* ── Trigger DM toast ────────────────────────────────────────────────── */
  triggerDmToast(data) {
    // Suppress if the conversation is currently open
    if (this._activeConvId && this._activeConvId === data.conversationId) return;

    // Deduplicate
    const msgKey = data.messageId || data.id;
    if (msgKey && this._seenMessageIds.has(msgKey)) return;
    if (msgKey) {
      this._seenMessageIds.add(msgKey);
      setTimeout(() => this._seenMessageIds.delete(msgKey), 30000);
    }

    // Show in-app toast via bus
    messageToastBus.emit("show_message_toast", {
      id:            msgKey || `toast_${Date.now()}`,
      conversationId: data.conversationId,
      senderId:       data.senderId,
      senderName:     data.senderName || "Someone",
      senderAvatar:   data.senderAvatar,
      senderAvatarId: data.senderAvatarId,
      message:        data.message || data.content || "",
      messageType:    data.messageType || "text",
      duration:       5000,
    });

    // Also call the App-level toast callback if provided
    this._toastCallback?.({
      type:    "dm",
      title:   data.senderName || "New message",
      message: data.message || data.content || "",
      data,
    });
  }

  /* ── Trigger incoming call notification ─────────────────────────────── */
  triggerIncomingCall(callInfo) {
    callEventBus.emit("incoming_call", callInfo);
  }

  /* ── Subscribe to message events via Supabase Realtime ─────────────── */
  _subscribeToMessages() {
    if (!this._userId) return;

    // Listen for new messages where sender is NOT the current user
    // We use a broad channel and filter client-side
    const channel = supabase
      .channel(`mns_messages:${this._userId}`)
      .on(
        "postgres_changes",
        {
          event:  "INSERT",
          schema: "public",
          table:  "messages",
        },
        async (payload) => {
          const msg = payload.new;
          if (!msg || msg.sender_id === this._userId) return;

          // Fetch the conversation to check if this user is a participant
          const convId = msg.conversation_id;
          if (!convId) return;

          try {
            // Get conversation + sender profile in parallel
            const [convResp, profileResp] = await Promise.all([
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

            const conv = convResp.data;
            if (!conv) return;

            // Confirm this user is in the conversation
            if (conv.user1_id !== this._userId && conv.user2_id !== this._userId) return;

            const sender = profileResp.data;

            this.triggerDmToast({
              messageId:     msg.id,
              conversationId: convId,
              senderId:       msg.sender_id,
              senderName:     sender?.full_name || "Someone",
              senderAvatarId: sender?.avatar_id,
              message:        msg.content,
              messageType:    msg.media_type || "text",
            });
          } catch(e) {
            console.warn("[MsgNotif] Toast fetch error:", e);
          }
        }
      )
      .subscribe();

    this._channels.set("messages", channel);
  }

  /* ── Subscribe to incoming calls via Supabase Realtime Broadcast ────── */
  _subscribeToIncomingCalls() {
    if (!this._userId) return;

    // Listen for call_signal channels directed at this user
    const channel = supabase
      .channel(`incoming_calls:${this._userId}`, {
        config: { broadcast: { self: false } },
      })
      .on("broadcast", { event: "call_invite" }, ({ payload }) => {
        if (!payload || payload.calleeId !== this._userId) return;

        this.triggerIncomingCall({
          id:               payload.callId || `call_${Date.now()}`,
          callerName:       payload.callerName || "Someone",
          callerAvatarId:   payload.callerAvatarId,
          type:             payload.callType || "audio",
          groupName:        payload.groupName,
          participantCount: payload.participantCount || 0,
          ...payload,
        });
      })
      .subscribe();

    this._channels.set("calls", channel);
  }

  /* ── Clean up ─────────────────────────────────────────────────────────── */
  cleanup() {
    this._channels.forEach(ch => {
      try { supabase.removeChannel(ch); } catch(_) {}
    });
    this._channels.clear();
    this._userId        = null;
    this._initialized   = false;
    this._toastCallback = null;
    this._activeConvId  = null;
    this._seenMessageIds.clear();
  }

  /* ── Send call invite (called when starting a call) ─────────────────── */
  async sendCallInvite({ callId, calleeId, callerName, callerAvatarId, callType, groupName, participantCount }) {
    try {
      const channel = supabase.channel(`incoming_calls:${calleeId}`);
      await channel.subscribe();
      channel.send({
        type:    "broadcast",
        event:   "call_invite",
        payload: {
          callId,
          calleeId,
          callerName,
          callerAvatarId,
          callType,
          groupName,
          participantCount,
          calledAt: new Date().toISOString(),
        },
      });
      // Clean up channel immediately (fire-and-forget)
      setTimeout(() => { try { supabase.removeChannel(channel); } catch(_) {} }, 5000);
    } catch(e) {
      console.warn("[MsgNotif] sendCallInvite failed:", e);
    }
  }
}

export default new MessageNotificationService();