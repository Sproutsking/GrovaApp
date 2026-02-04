// services/messages/ConversationStateManager.js
class ConversationStateManager {
  constructor() {
    this.state = {
      conversations: new Map(),
      messagesByConversation: new Map(),
      messageStatusById: new Map(),
      unreadByConversation: new Map(),
      activeConversationId: null,
    };
    this.listeners = new Set();
  }

  // CONVERSATIONS
  initConversations(conversations) {
    this.state.conversations = new Map();
    this.state.unreadByConversation = new Map();

    conversations.forEach((conv) => {
      this.state.conversations.set(conv.id, conv);
      this.state.unreadByConversation.set(conv.id, conv.unreadCount || 0);
    });

    this.emit();
  }

  updateConversation(conversationId, updates) {
    const conv = this.state.conversations.get(conversationId);
    if (conv) {
      this.state.conversations.set(conversationId, { ...conv, ...updates });
      this.emit();
    }
  }

  // MESSAGES
  initMessages(conversationId, messages) {
    this.state.messagesByConversation.set(conversationId, messages);
    
    messages.forEach((msg) => {
      const status = msg.read ? "read" : msg.delivered ? "delivered" : "sent";
      this.state.messageStatusById.set(msg.id, status);
    });

    this.emit();
  }

  addMessage(conversationId, message) {
    let messages = this.state.messagesByConversation.get(conversationId) || [];
    
    const existingIdx = messages.findIndex(
      (m) => m.id === message.id || (m._tempId && m._tempId === message._tempId)
    );

    if (existingIdx !== -1) {
      messages[existingIdx] = message;
    } else {
      messages = [...messages, message];
    }

    this.state.messagesByConversation.set(conversationId, messages);

    const status = message.read ? "read" : message.delivered ? "delivered" : "sent";
    this.state.messageStatusById.set(message.id, status);

    this.updateConversation(conversationId, {
      lastMessage: message,
      last_message_at: message.created_at,
    });

    this.emit();
  }

  updateMessage(messageId, updates) {
    for (const [convId, messages] of this.state.messagesByConversation) {
      const idx = messages.findIndex((m) => m.id === messageId);
      if (idx !== -1) {
        messages[idx] = { ...messages[idx], ...updates };
        
        if (updates.read) {
          this.state.messageStatusById.set(messageId, "read");
        }
        
        this.emit();
        return;
      }
    }
  }

  deleteMessage(messageId) {
    for (const [convId, messages] of this.state.messagesByConversation) {
      const filtered = messages.filter((m) => m.id !== messageId);
      if (filtered.length !== messages.length) {
        this.state.messagesByConversation.set(convId, filtered);
        this.state.messageStatusById.delete(messageId);
        this.emit();
        return;
      }
    }
  }

  // UNREAD
  incrementUnread(conversationId, senderId) {
    if (this.state.activeConversationId === conversationId) return;
    
    const current = this.state.unreadByConversation.get(conversationId) || 0;
    this.state.unreadByConversation.set(conversationId, current + 1);

    const conv = this.state.conversations.get(conversationId);
    if (conv) {
      conv.unreadCount = current + 1;
    }

    this.emit();
  }

  clearUnread(conversationId) {
    this.state.unreadByConversation.set(conversationId, 0);

    const conv = this.state.conversations.get(conversationId);
    if (conv) {
      conv.unreadCount = 0;
    }

    this.emit();
  }

  markAllRead(conversationId) {
    const messages = this.state.messagesByConversation.get(conversationId) || [];
    messages.forEach((msg) => {
      this.state.messageStatusById.set(msg.id, "read");
    });

    this.clearUnread(conversationId);
  }

  // ACTIVE
  setActive(conversationId) {
    this.state.activeConversationId = conversationId;
    this.clearUnread(conversationId);
  }

  clearActive() {
    this.state.activeConversationId = null;
  }

  isActive(conversationId) {
    return this.state.activeConversationId === conversationId;
  }

  // GETTERS
  getConversations() {
    return Array.from(this.state.conversations.values()).sort((a, b) => {
      const aTime = new Date(a.last_message_at || a.created_at);
      const bTime = new Date(b.last_message_at || b.created_at);
      return bTime - aTime;
    });
  }

  getMessages(conversationId) {
    return this.state.messagesByConversation.get(conversationId) || [];
  }

  getMessageStatus(messageId) {
    return this.state.messageStatusById.get(messageId) || "sent";
  }

  getTotalUnreadCount() {
    let total = 0;
    for (const count of this.state.unreadByConversation.values()) {
      total += count;
    }
    return total;
  }

  // SUBSCRIPTION
  subscribe(listener) {
    this.listeners.add(listener);
    listener(this.getConversations());
    return () => this.listeners.delete(listener);
  }

  emit() {
    const conversations = this.getConversations();
    this.listeners.forEach((listener) => {
      try {
        listener(conversations);
      } catch (e) {
        console.error("Listener error:", e);
      }
    });
  }

  reset() {
    this.state.conversations.clear();
    this.state.messagesByConversation.clear();
    this.state.messageStatusById.clear();
    this.state.unreadByConversation.clear();
    this.state.activeConversationId = null;
    this.emit();
  }
}

export default new ConversationStateManager();