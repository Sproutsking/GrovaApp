// services/community/CommunityStateManager.js - COMPLETE WITH TYPING
class CommunityStateManager {
  constructor() {
    this.state = {
      messagesByChannel: new Map(),
      typingByChannel: new Map(),
      activeChannelId: null,
    };
    this.listeners = new Set();
  }

  // MESSAGES
  initMessages(channelId, messages) {
    this.state.messagesByChannel.set(channelId, messages);
    this.emit();
  }

  addMessage(channelId, message) {
    let messages = this.state.messagesByChannel.get(channelId) || [];

    const existingIdx = messages.findIndex(
      (m) => m.id === message.id || (m._tempId && m._tempId === message._tempId)
    );

    if (existingIdx !== -1) {
      messages[existingIdx] = message;
    } else {
      messages = [...messages, message];
    }

    this.state.messagesByChannel.set(channelId, messages);
    this.emit();
  }

  replaceMessage(channelId, tempId, realMessage) {
    let messages = this.state.messagesByChannel.get(channelId) || [];
    
    const tempIdx = messages.findIndex(
      (m) => m._tempId === tempId || m.tempId === tempId || m.id === tempId
    );

    if (tempIdx !== -1) {
      messages[tempIdx] = realMessage;
      this.state.messagesByChannel.set(channelId, messages);
      this.emit();
    }
  }

  removeMessage(channelId, messageId) {
    let messages = this.state.messagesByChannel.get(channelId) || [];
    
    messages = messages.filter(
      (m) => m.id !== messageId && m._tempId !== messageId && m.tempId !== messageId
    );

    this.state.messagesByChannel.set(channelId, messages);
    this.emit();
  }

  getMessages(channelId) {
    return this.state.messagesByChannel.get(channelId) || [];
  }

  // TYPING
  setTyping(channelId, typingUsers) {
    this.state.typingByChannel.set(channelId, typingUsers);
    this.emit();
  }

  getTyping(channelId) {
    return this.state.typingByChannel.get(channelId) || [];
  }

  clearTyping(channelId) {
    this.state.typingByChannel.delete(channelId);
    this.emit();
  }

  // ACTIVE
  setActive(channelId) {
    this.state.activeChannelId = channelId;
  }

  clearActive() {
    this.state.activeChannelId = null;
  }

  isActive(channelId) {
    return this.state.activeChannelId === channelId;
  }

  // SUBSCRIPTION
  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  emit() {
    this.listeners.forEach((listener) => {
      try {
        listener();
      } catch (e) {
        console.error("Listener error:", e);
      }
    });
  }

  reset() {
    this.state.messagesByChannel.clear();
    this.state.typingByChannel.clear();
    this.state.activeChannelId = null;
    this.emit();
  }
}

export default new CommunityStateManager();