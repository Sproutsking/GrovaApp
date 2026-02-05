// services/messages/MessageNotificationService.js
import conversationState from "./ConversationStateManager";

class MessageNotificationService {
  constructor() {
    this.toastCallback = null;
    this.isInitialized = false;
    this.currentUserId = null;
    this.notifiedMessages = new Set();
  }

  init(userId, toastCallback) {
    if (this.isInitialized) return;

    this.currentUserId = userId;
    this.toastCallback = toastCallback;
    this.isInitialized = true;

    conversationState.subscribe((conversations) => {
      this.checkForNewMessages(conversations);
    });
  }

  checkForNewMessages(conversations) {
    if (!this.toastCallback || !this.currentUserId) return;

    conversations.forEach((conv) => {
      const lastMsg = conv.lastMessage;
      
      if (
        lastMsg &&
        lastMsg.sender_id !== this.currentUserId &&
        !conversationState.isActive(conv.id) &&
        !this.notifiedMessages.has(lastMsg.id)
      ) {
        const msgAge = Date.now() - new Date(lastMsg.created_at).getTime();
        
        if (msgAge < 10000) {
          const otherUser = conv.user1_id === this.currentUserId ? conv.user2 : conv.user1;
          const userName = otherUser?.full_name || "Someone";
          
          this.toastCallback({
            type: "info",
            message: `${userName}`,
            description: lastMsg.content.slice(0, 60) + (lastMsg.content.length > 60 ? "..." : ""),
            duration: 5000,
          });

          this.notifiedMessages.add(lastMsg.id);

          setTimeout(() => {
            this.notifiedMessages.delete(lastMsg.id);
          }, 15000);
        }
      }
    });
  }

  cleanup() {
    this.toastCallback = null;
    this.isInitialized = false;
    this.currentUserId = null;
    this.notifiedMessages.clear();
  }
}

export default new MessageNotificationService();