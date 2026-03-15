// ============================================================================
// src/services/messages/MessageNotificationService.js — v2 DEDUP-SAFE
// ============================================================================
//
// PURPOSE:
//   Show in-app toast notifications for incoming DMs when the conversation
//   panel is not open / not focused on that conversation.
//
// HOW IT WORKS (v2):
//   Instead of subscribing to conversationState (which fires on every render),
//   we hook into the dmMessageService broadcast channel callback system via
//   a dedicated "global" listener. Each ChatView passes an onMessage callback
//   to dmMessageService.subscribeToConversation(); this service registers its
//   own listener on the SAME event by having the caller pass messages through.
//
//   Actually, the cleanest approach: we extend ConversationState to emit a
//   "new_incoming_message" event that fires ONLY for messages from others when
//   the conversation is not active. This keeps the logic in one place.
//
// DEDUP:
//   A Set of notified message ids (TTL 15s) prevents the same DM from
//   showing two toasts (once from broadcast, once from conversationState update).
//
// PUSH (DM):
//   For true push notifications on DMs (when app is backgrounded), you need
//   to call a server-side edge function from your DB trigger or from here.
//   We provide a `triggerPush` method that calls your Supabase edge function.
//   The SW then shows an OS notification; when the app is focused the SW
//   instead posts PUSH_RECEIVED → InAppNotificationToast handles it.
//   This means DM toasts in-app come from pushService.on("push_received")
//   inside InAppNotificationToast — NOT from this service — so there's no
//   double-toast.
//
// USAGE in App.jsx / DMMessagesView:
//   MessageNotificationService.init(userId);
//   // When auth changes or user signs out:
//   MessageNotificationService.cleanup();
// ============================================================================

import { supabase } from "../config/supabase";
import conversationState from "./ConversationStateManager";

class MessageNotificationService {
  constructor() {
    this._userId           = null;
    this._isInitialized    = false;
    this._toastCallback    = null;       // Optional: external in-app toast fn
    this._notifiedIds      = new Set();  // Dedup guard (message ids)
    this._unsubState       = null;       // conversationState unsubscribe
  }

  /**
   * Initialize. Safe to call multiple times — idempotent per userId.
   *
   * @param {string}   userId
   * @param {Function} [toastCallback]  - optional (path: InAppNotificationToast handles it)
   */
  init(userId, toastCallback) {
    if (this._isInitialized && this._userId === userId) return;
    this.cleanup();

    this._userId        = userId;
    this._toastCallback = toastCallback || null;
    this._isInitialized = true;

    // Watch conversationState for new messages from others
    // (fires whenever conversationState.emit() is called)
    if (this._toastCallback) {
      this._unsubState = conversationState.subscribe((conversations) => {
        this._onStateChange(conversations);
      });
    }
  }

  // ── Internal: check all conversations for recent unread messages ──────────
  _onStateChange(conversations) {
    if (!this._toastCallback || !this._userId) return;

    conversations.forEach((conv) => {
      const lastMsg = conv.lastMessage;
      if (!lastMsg) return;
      if (lastMsg.sender_id === this._userId)   return; // own message
      if (conversationState.isActive(conv.id))   return; // user is looking at it
      if (this._notifiedIds.has(lastMsg.id))     return; // already toasted

      // Only show for very recent messages (within last 8s)
      const age = Date.now() - new Date(lastMsg.created_at).getTime();
      if (age > 8_000) return;

      const otherUser = conv.user1_id === this._userId ? conv.user2 : conv.user1;
      const name      = otherUser?.full_name || otherUser?.username || "Someone";

      this._toastCallback({
        type:        "dm",
        title:       name,
        message:     lastMsg.content?.slice(0, 80) + (lastMsg.content?.length > 80 ? "…" : ""),
        url:         null,
        duration:    5000,
      });

      this._notifiedIds.add(lastMsg.id);
      setTimeout(() => this._notifiedIds.delete(lastMsg.id), 15_000);
    });
  }

  /**
   * Trigger a server-side push for a DM.
   * Call this AFTER successfully persisting the message to DB.
   * The edge function will push to the recipient's devices.
   *
   * @param {object} params
   * @param {string} params.recipientUserId
   * @param {string} params.senderName
   * @param {string} params.messageContent
   * @param {string} params.conversationId
   */
  async triggerDmPush({ recipientUserId, senderName, messageContent, conversationId }) {
    try {
      await supabase.functions.invoke("send-push", {
        body: {
          recipient_user_id: recipientUserId,
          actor_user_id:     this._userId,
          type:              "dm",
          message:           `${senderName}: ${messageContent.slice(0, 100)}`,
          entity_id:         conversationId,
          metadata: {
            category:        "dm",
            conversation_id: conversationId,
            notification_id: `dm_${conversationId}_${Date.now()}`,
          },
          data: {
            url:  `/messages`, // Navigate to messages on tap
            type: "dm",
          },
        },
      });
    } catch (err) {
      // Non-fatal — DM was still sent, push is best-effort
      console.warn("[MessageNotificationService] Push trigger failed:", err);
    }
  }

  cleanup() {
    if (this._unsubState) {
      this._unsubState();
      this._unsubState = null;
    }
    this._toastCallback  = null;
    this._isInitialized  = false;
    this._userId         = null;
    this._notifiedIds.clear();
  }
}

export default new MessageNotificationService();