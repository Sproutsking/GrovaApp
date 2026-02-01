/**
 * MessageModel - Optimized for instant display and real-time updates
 * Zero-delay message rendering with proper user data from the start
 */
class MessageModel {
  constructor(data = {}) {
    // Core fields
    this.id = data.id || null;
    this.tempId = data.tempId || null;
    this.channelId = data.channel_id || data.channelId || null;
    this.userId = data.user_id || data.userId || null;
    this.content = data.content || "";
    this.replyToId = data.reply_to_id || data.replyToId || null;

    // Arrays
    this.attachments = Array.isArray(data.attachments) ? data.attachments : [];
    this.reactions = this.normalizeReactions(data.reactions);

    // Metadata
    this.edited = Boolean(data.edited);
    this.createdAt =
      data.created_at || data.createdAt || new Date().toISOString();
    this.updatedAt =
      data.updated_at || data.updatedAt || new Date().toISOString();
    this.deletedAt = data.deleted_at || data.deletedAt || null;

    // User data - CRITICAL for instant display
    this.user = this.normalizeUser(data.user);
    this.role = data.role || null;

    // Display state
    this.isPending = Boolean(data.isPending);
    this.isSent = Boolean(data.isSent);
    this.isDelivered = Boolean(data.isDelivered);
    this.isOptimistic = Boolean(data.isOptimistic);
  }

  /**
   * Normalize user data to ensure complete information
   */
  normalizeUser(user) {
    if (!user) return null;

    return {
      id: user.id || user.user_id || user.userId,
      user_id: user.id || user.user_id || user.userId,
      userId: user.id || user.user_id || user.userId,
      username: user.username || "unknown",
      full_name:
        user.full_name ||
        user.name ||
        user.author ||
        user.username ||
        "Unknown User",
      name:
        user.full_name ||
        user.name ||
        user.author ||
        user.username ||
        "Unknown User",
      author:
        user.full_name ||
        user.name ||
        user.author ||
        user.username ||
        "Unknown User",
      avatar: user.avatar,
      avatar_id: user.avatar_id,
      avatar_metadata: user.avatar_metadata || {},
      verified: Boolean(user.verified),
    };
  }

  /**
   * Normalize reactions
   */
  normalizeReactions(reactions) {
    if (!reactions || typeof reactions !== "object") {
      return {};
    }

    const normalized = {};
    for (const [emoji, data] of Object.entries(reactions)) {
      if (typeof data === "number") {
        normalized[emoji] = { count: data, users: [] };
      } else if (typeof data === "object" && data !== null) {
        normalized[emoji] = {
          count: data.count || 0,
          users: Array.isArray(data.users) ? data.users : [],
        };
      }
    }
    return normalized;
  }

  /**
   * Check if message is ready for display
   */
  isDisplayReady() {
    return Boolean(
      this.content &&
      this.user &&
      this.user.id &&
      (this.user.username || this.user.full_name),
    );
  }

  /**
   * Check if message should show author info
   */
  shouldShowAuthor(previousMessage) {
    if (!previousMessage) return true;
    if (this.userId !== previousMessage.userId) return true;

    const timeDiff =
      new Date(this.createdAt) - new Date(previousMessage.createdAt);
    const FOUR_MINUTES = 4 * 60 * 1000;

    return timeDiff > FOUR_MINUTES;
  }

  /**
   * Permission checks
   */
  canEdit(userId) {
    return this.userId === userId && !this.deletedAt;
  }

  canDelete(userId, hasManagePermission = false) {
    return (this.userId === userId || hasManagePermission) && !this.deletedAt;
  }

  canReact(userId) {
    return Boolean(userId) && !this.deletedAt;
  }

  /**
   * Reaction management
   */
  addReaction(emoji, userId) {
    if (!this.reactions[emoji]) {
      this.reactions[emoji] = { count: 0, users: [] };
    }

    if (!this.reactions[emoji].users.includes(userId)) {
      this.reactions[emoji].count++;
      this.reactions[emoji].users.push(userId);
    }

    return { ...this.reactions };
  }

  removeReaction(emoji, userId) {
    if (!this.reactions[emoji]) return { ...this.reactions };

    const userIndex = this.reactions[emoji].users.indexOf(userId);
    if (userIndex > -1) {
      this.reactions[emoji].count--;
      this.reactions[emoji].users.splice(userIndex, 1);

      if (this.reactions[emoji].count <= 0) {
        delete this.reactions[emoji];
      }
    }

    return { ...this.reactions };
  }

  hasUserReacted(emoji, userId) {
    return this.reactions[emoji]?.users?.includes(userId) || false;
  }

  /**
   * Serialization
   */
  toJSON() {
    return {
      id: this.id,
      tempId: this.tempId,
      channel_id: this.channelId,
      user_id: this.userId,
      content: this.content,
      reply_to_id: this.replyToId,
      attachments: this.attachments,
      reactions: this.reactions,
      edited: this.edited,
      created_at: this.createdAt,
      updated_at: this.updatedAt,
      deleted_at: this.deletedAt,
      user: this.user,
      role: this.role,
      isPending: this.isPending,
      isSent: this.isSent,
      isDelivered: this.isDelivered,
      isOptimistic: this.isOptimistic,
    };
  }

  /**
   * Factory methods
   */
  static fromAPI(data) {
    if (!data) return null;
    return new MessageModel(data);
  }

  static fromAPIArray(dataArray) {
    if (!Array.isArray(dataArray)) return [];
    return dataArray.map((data) => MessageModel.fromAPI(data)).filter(Boolean);
  }

  /**
   * Create optimistic message for instant display
   */
  static createOptimistic(
    channelId,
    userId,
    content,
    currentUser,
    options = {},
  ) {
    const tempId = `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    return new MessageModel({
      tempId,
      id: tempId,
      channel_id: channelId,
      user_id: userId,
      content: content.trim(),
      reply_to_id: options.replyToId || null,
      attachments: options.attachments || [],
      reactions: {},
      edited: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      user: {
        id: userId,
        user_id: userId,
        userId: userId,
        username: currentUser?.username || "You",
        full_name: currentUser?.full_name || currentUser?.username || "You",
        name: currentUser?.full_name || currentUser?.username || "You",
        author: currentUser?.full_name || currentUser?.username || "You",
        avatar: currentUser?.avatar,
        avatar_id: currentUser?.avatar_id,
        avatar_metadata: currentUser?.avatar_metadata || {},
        verified: currentUser?.verified || false,
      },
      role: options.role || null,
      isPending: true,
      isSent: false,
      isDelivered: false,
      isOptimistic: true,
    });
  }

  /**
   * Validation
   */
  static validate(content, options = {}) {
    const { minLength = 1, maxLength = 2000, allowEmpty = false } = options;

    if (content === null || content === undefined) {
      return { valid: false, error: "Message content is required" };
    }

    const str = String(content);
    const trimmed = str.trim();

    if (!allowEmpty && !trimmed) {
      return { valid: false, error: "Message cannot be empty" };
    }

    if (trimmed.length < minLength) {
      return {
        valid: false,
        error: `Message must be at least ${minLength} character${minLength !== 1 ? "s" : ""}`,
      };
    }

    if (trimmed.length > maxLength) {
      return {
        valid: false,
        error: `Message is too long (max ${maxLength} characters)`,
      };
    }

    return { valid: true, error: null, trimmed };
  }
}

export default MessageModel;
