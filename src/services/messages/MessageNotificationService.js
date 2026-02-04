// services/messages/MessageNotificationService.js
import conversationState from "./ConversationStateManager";

class MessageNotificationService {
  constructor() {
    this.toastCallback = null;
    this.isInitialized = false;
    this.currentUserId = null;
  }

  init(userId, toastCallback) {
    if (this.isInitialized) return;

    this.currentUserId = userId;
    this.toastCallback = toastCallback;
    this.isInitialized = true;

    // Subscribe to conversation state changes
    conversationState.subscribe((conversations) => {
      this.checkForNewMessages(conversations);
    });
  }

  checkForNewMessages(conversations) {
    if (!this.toastCallback || !this.currentUserId) return;

    conversations.forEach((conv) => {
      const lastMsg = conv.lastMessage;
      
      // Only notify if:
      // 1. Message exists
      // 2. Not from current user
      // 3. Conversation is not active
      // 4. Created in last 5 seconds (new message)
      if (
        lastMsg &&
        lastMsg.sender_id !== this.currentUserId &&
        !conversationState.isActive(conv.id)
      ) {
        const msgAge = Date.now() - new Date(lastMsg.created_at).getTime();
        
        if (msgAge < 5000) {
          const otherUser = conv.user1_id === this.currentUserId ? conv.user2 : conv.user1;
          const userName = otherUser?.full_name || "Someone";
          
          this.toastCallback({
            type: "info",
            message: `New message from ${userName}`,
            description: lastMsg.content.slice(0, 50) + (lastMsg.content.length > 50 ? "..." : ""),
            duration: 4000,
          });
        }
      }
    });
  }

  cleanup() {
    this.toastCallback = null;
    this.isInitialized = false;
    this.currentUserId = null;
  }
}

export default new MessageNotificationService();