// ============================================================================
// src/services/messages/MessageNotificationService.js — v3 CLEAN
// ============================================================================
//
// PURPOSE:
//   Show in-app toast notifications for incoming DMs when the user is in
//   the app but NOT looking at that specific conversation.
//
// ARCHITECTURE (v3):
//   This service is the SINGLE source of in-app DM toasts when the app is
//   active. It works by subscribing to ConversationStateManager and detecting
//   new messages from others that the user hasn't seen.
//
//   Push notifications (device-level, OS, background) are handled EXCLUSIVELY
//   by dmMessageService._triggerDmPush() → Supabase edge fn → SW → OS.
//   This service does NOT trigger pushes. That was the double-push bug.
//
// DEDUP:
//   _notifiedIds (Set, TTL 30s) prevents the same message from showing
//   two toasts if conversationState emits multiple times for the same message.
//
// INIT:
//   MessageNotificationService.init(userId, toastCallback) is called from
//   App.jsx immediately after auth. toastCallback receives a toast object
//   that InAppNotificationToast's addToast() accepts.
//
// FIXES vs v2:
//   [MN-1]  No triggerDmPush here. Removed entirely. Push is only in
//           dmMessageService._triggerDmPush(). One path, zero doubles.
//   [MN-2]  init() is now called from App.jsx (was never called before —
//           the service was completely dead). Wired properly now.
//   [MN-3]  toastCallback path is the primary DM toast mechanism when app
//           is active and not on that conversation.
//   [MN-4]  Dedup TTL extended to 30s (was 15s).
// ============================================================================

import conversationState from "./ConversationStateManager";

class MessageNotificationService {
  constructor() {
    this._userId        = null;
    this._isInitialized = false;
    this._toastCallback = null;
    this._notifiedIds   = new Set(); // [MN-4] TTL 30s
    this._unsubState    = null;
  }

  /**
   * Initialize. Safe to call multiple times — idempotent per userId.
   *
   * @param {string}   userId
   * @param {Function} toastCallback  - receives { type, title, message, url, duration }
   */
  init(userId, toastCallback) {
    if (this._isInitialized && this._userId === userId) return;
    this.cleanup();

    this._userId        = userId;
    this._toastCallback = toastCallback || null;
    this._isInitialized = true;

    if (this._toastCallback) {
      this._unsubState = conversationState.subscribe((conversations) => {
        this._onStateChange(conversations);
      });
    }
  }

  // ── Internal: scan all conversations for new unread messages from others ──
  _onStateChange(conversations) {
    if (!this._toastCallback || !this._userId) return;

    conversations.forEach((conv) => {
      const lastMsg = conv.lastMessage;
      if (!lastMsg)                                    return;
      if (lastMsg.sender_id === this._userId)          return; // own message
      if (conversationState.isActive(conv.id))         return; // user is in this chat
      if (this._notifiedIds.has(lastMsg.id))           return; // already toasted

      // Only react to messages from the last 8 seconds
      const age = Date.now() - new Date(lastMsg.created_at).getTime();
      if (age > 8_000) return;

      // Resolve sender name from conversation participants
      const otherUser =
        conv.user1_id === this._userId ? conv.user2 : conv.user1;
      const name =
        otherUser?.full_name ||
        otherUser?.username  ||
        "Someone";

      this._toastCallback({
        type:     "dm",
        title:    name,
        message:  lastMsg.content
          ? lastMsg.content.slice(0, 80) + (lastMsg.content.length > 80 ? "…" : "")
          : "Sent you a message",
        url:      "/messages",
        duration: 5000,
        // Pass conversation_id so toast tap can deep-link to the right chat
        data: {
          type:            "dm",
          conversation_id: conv.id,
          notification_id: lastMsg.id,
        },
      });

      this._notifiedIds.add(lastMsg.id);
      setTimeout(() => this._notifiedIds.delete(lastMsg.id), 30_000); // [MN-4]
    });
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