// src/models/MessageModel.js

/**
 * MessageModel - Represents a chat message with all its properties and behaviors
 * Handles message validation, reactions, permissions, and formatting
 */
class MessageModel {
  constructor(data = {}) {
    // Core message fields
    this.id = data.id || null;
    this.channelId = data.channel_id || data.channelId || null;
    this.userId = data.user_id || data.userId || null;
    this.content = data.content || '';
    this.replyToId = data.reply_to_id || data.replyToId || null;
    
    // Arrays and objects - ensure they're always initialized
    this.attachments = Array.isArray(data.attachments) ? data.attachments : [];
    this.reactions = this.normalizeReactions(data.reactions);
    
    // Metadata
    this.edited = Boolean(data.edited);
    this.createdAt = data.created_at || data.createdAt || new Date().toISOString();
    this.updatedAt = data.updated_at || data.updatedAt || new Date().toISOString();
    this.deletedAt = data.deleted_at || data.deletedAt || null;
    
    // Populated/joined fields (from database relationships)
    this.user = data.user || null;
    this.member = data.member || null;
    this.replyTo = data.replyTo || null;
    this.role = data.role || null;
  }

  /**
   * Normalize reactions to ensure consistent structure
   * Handles both legacy formats and new formats
   */
  normalizeReactions(reactions) {
    if (!reactions || typeof reactions !== 'object') {
      return {};
    }

    const normalized = {};
    for (const [emoji, data] of Object.entries(reactions)) {
      // Handle different reaction formats
      if (typeof data === 'number') {
        // Legacy format: { "👍": 5 }
        normalized[emoji] = { count: data, users: [] };
      } else if (typeof data === 'object' && data !== null) {
        // New format: { "👍": { count: 5, users: [...] } }
        normalized[emoji] = {
          count: data.count || 0,
          users: Array.isArray(data.users) ? data.users : []
        };
      }
    }
    return normalized;
  }

  // ============================================
  // MESSAGE STATE CHECKS
  // ============================================

  /**
   * Check if message has been soft-deleted
   */
  isDeleted() {
    return this.deletedAt !== null;
  }

  /**
   * Check if message has been edited
   */
  isEdited() {
    return this.edited === true;
  }

  /**
   * Check if message has any attachments
   */
  hasAttachments() {
    return this.attachments && this.attachments.length > 0;
  }

  /**
   * Check if message is a reply to another message
   */
  isReply() {
    return this.replyToId !== null;
  }

  // ============================================
  // PERMISSION CHECKS
  // ============================================

  /**
   * Check if a user can edit this message
   * Only the author can edit, and message must not be deleted
   */
  canEdit(userId) {
    if (!userId || !this.userId) return false;
    return this.userId === userId && !this.isDeleted();
  }

  /**
   * Check if a user can delete this message
   * Author can always delete, or users with manage permission
   */
  canDelete(userId, hasManagePermission = false) {
    if (!userId) return false;
    if (this.isDeleted()) return false;
    return this.userId === userId || hasManagePermission;
  }

  /**
   * Check if a user can react to this message
   * Anyone can react unless message is deleted
   */
  canReact(userId) {
    return Boolean(userId) && !this.isDeleted();
  }

  // ============================================
  // REACTION MANAGEMENT
  // ============================================

  /**
   * Add a reaction to the message
   * Returns updated reactions object
   */
  addReaction(emoji, userId) {
    if (!emoji || !userId) {
      throw new Error('Emoji and userId are required');
    }

    // Initialize reaction if it doesn't exist
    if (!this.reactions[emoji]) {
      this.reactions[emoji] = { count: 0, users: [] };
    }
    
    // Only add if user hasn't already reacted with this emoji
    if (!this.reactions[emoji].users.includes(userId)) {
      this.reactions[emoji].count++;
      this.reactions[emoji].users.push(userId);
    }
    
    return { ...this.reactions };
  }

  /**
   * Remove a reaction from the message
   * Returns updated reactions object
   */
  removeReaction(emoji, userId) {
    if (!emoji || !userId) {
      throw new Error('Emoji and userId are required');
    }

    if (!this.reactions[emoji]) {
      return { ...this.reactions };
    }

    const userIndex = this.reactions[emoji].users.indexOf(userId);
    if (userIndex > -1) {
      this.reactions[emoji].count--;
      this.reactions[emoji].users.splice(userIndex, 1);
      
      // Remove emoji entirely if no reactions left
      if (this.reactions[emoji].count <= 0) {
        delete this.reactions[emoji];
      }
    }
    
    return { ...this.reactions };
  }

  /**
   * Toggle a reaction (add if not present, remove if present)
   * Returns updated reactions object
   */
  toggleReaction(emoji, userId) {
    if (this.hasUserReacted(emoji, userId)) {
      return this.removeReaction(emoji, userId);
    } else {
      return this.addReaction(emoji, userId);
    }
  }

  /**
   * Get the count of reactions for a specific emoji
   */
  getReactionCount(emoji) {
    return this.reactions[emoji]?.count || 0;
  }

  /**
   * Get total count of all reactions
   */
  getTotalReactionCount() {
    return Object.values(this.reactions).reduce((sum, data) => sum + (data.count || 0), 0);
  }

  /**
   * Check if a specific user has reacted with a specific emoji
   */
  hasUserReacted(emoji, userId) {
    if (!emoji || !userId) return false;
    return this.reactions[emoji]?.users?.includes(userId) || false;
  }

  /**
   * Get all emojis a user has reacted with
   */
  getUserReactions(userId) {
    if (!userId) return [];
    return Object.entries(this.reactions)
      .filter(([_, data]) => data.users?.includes(userId))
      .map(([emoji]) => emoji);
  }

  // ============================================
  // TIME & DATE FORMATTING
  // ============================================

  /**
   * Format timestamp for display
   * @param {string} format - 'time', 'date', 'full', 'relative', or 'iso'
   */
  getFormattedTime(format = 'time') {
    const date = new Date(this.createdAt);
    
    if (isNaN(date.getTime())) {
      return 'Invalid date';
    }
    
    switch (format) {
      case 'time':
        return date.toLocaleTimeString('en-US', { 
          hour: '2-digit', 
          minute: '2-digit' 
        });
      
      case 'date':
        return date.toLocaleDateString('en-US', { 
          month: 'short', 
          day: 'numeric',
          year: 'numeric'
        });
      
      case 'full':
        return date.toLocaleString('en-US', { 
          month: 'short', 
          day: 'numeric',
          year: 'numeric',
          hour: '2-digit', 
          minute: '2-digit' 
        });
      
      case 'relative':
        return this.getRelativeTime();
      
      case 'iso':
      default:
        return date.toISOString();
    }
  }

  /**
   * Get relative time string (e.g., "2m ago", "1h ago")
   */
  getRelativeTime() {
    const now = new Date();
    const messageDate = new Date(this.createdAt);
    const diff = now - messageDate;
    
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    const weeks = Math.floor(days / 7);
    const months = Math.floor(days / 30);
    const years = Math.floor(days / 365);

    if (seconds < 60) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    if (weeks < 4) return `${weeks}w ago`;
    if (months < 12) return `${months}mo ago`;
    return `${years}y ago`;
  }

  /**
   * Check if message was created today
   */
  isToday() {
    const today = new Date();
    const messageDate = new Date(this.createdAt);
    
    return today.toDateString() === messageDate.toDateString();
  }

  /**
   * Check if message was created this week
   */
  isThisWeek() {
    const now = new Date();
    const messageDate = new Date(this.createdAt);
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    
    return messageDate >= weekAgo;
  }

  // ============================================
  // CONTENT HELPERS
  // ============================================

  /**
   * Get plain text content without formatting
   */
  getPlainContent() {
    return this.content.trim();
  }

  /**
   * Get content preview (truncated)
   */
  getContentPreview(maxLength = 100) {
    const plain = this.getPlainContent();
    if (plain.length <= maxLength) return plain;
    return plain.substring(0, maxLength) + '...';
  }

  /**
   * Check if message contains specific text (case-insensitive)
   */
  containsText(searchText) {
    if (!searchText) return false;
    return this.content.toLowerCase().includes(searchText.toLowerCase());
  }

  /**
   * Get word count
   */
  getWordCount() {
    return this.content.trim().split(/\s+/).filter(Boolean).length;
  }

  /**
   * Get character count
   */
  getCharacterCount() {
    return this.content.length;
  }

  // ============================================
  // SERIALIZATION
  // ============================================

  /**
   * Convert to plain object for API requests
   * Uses snake_case for database compatibility
   */
  toJSON() {
    return {
      id: this.id,
      channel_id: this.channelId,
      user_id: this.userId,
      content: this.content,
      reply_to_id: this.replyToId,
      attachments: this.attachments,
      reactions: this.reactions,
      edited: this.edited,
      created_at: this.createdAt,
      updated_at: this.updatedAt,
      deleted_at: this.deletedAt
    };
  }

  /**
   * Convert to object for display (includes populated fields)
   */
  toDisplayObject() {
    return {
      ...this.toJSON(),
      user: this.user,
      member: this.member,
      replyTo: this.replyTo,
      role: this.role
    };
  }

  // ============================================
  // STATIC FACTORY METHODS
  // ============================================

  /**
   * Create MessageModel instance from API response
   */
  static fromAPI(data) {
    if (!data) return null;
    return new MessageModel(data);
  }

  /**
   * Create multiple MessageModel instances from API array
   */
  static fromAPIArray(dataArray) {
    if (!Array.isArray(dataArray)) return [];
    return dataArray.map(data => MessageModel.fromAPI(data)).filter(Boolean);
  }

  /**
   * Create a new message object for sending
   */
  static createNew(channelId, userId, content, options = {}) {
    return new MessageModel({
      channel_id: channelId,
      user_id: userId,
      content: content,
      reply_to_id: options.replyToId || null,
      attachments: options.attachments || [],
      reactions: {},
      edited: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });
  }

  // ============================================
  // VALIDATION
  // ============================================

  /**
   * Validate message content
   */
  static validate(content, options = {}) {
    const {
      minLength = 1,
      maxLength = 2000,
      allowEmpty = false,
      allowWhitespace = false
    } = options;

    // Check if content exists
    if (content === null || content === undefined) {
      return { valid: false, error: 'Message content is required' };
    }

    // Convert to string if needed
    const str = String(content);
    
    // Check for whitespace-only content
    const trimmed = str.trim();
    if (!allowWhitespace && !trimmed) {
      return { valid: false, error: 'Message cannot be empty or contain only whitespace' };
    }

    // Check if empty is allowed
    if (!allowEmpty && trimmed.length === 0) {
      return { valid: false, error: 'Message cannot be empty' };
    }

    // Check minimum length
    if (trimmed.length < minLength) {
      return { 
        valid: false, 
        error: `Message must be at least ${minLength} character${minLength !== 1 ? 's' : ''}` 
      };
    }

    // Check maximum length
    if (trimmed.length > maxLength) {
      return { 
        valid: false, 
        error: `Message is too long (max ${maxLength} characters, got ${trimmed.length})` 
      };
    }

    return { valid: true, error: null, trimmed };
  }

  /**
   * Validate this message instance
   */
  validate(options = {}) {
    return MessageModel.validate(this.content, options);
  }

  // ============================================
  // UTILITY METHODS
  // ============================================

  /**
   * Clone this message
   */
  clone() {
    return new MessageModel(this.toDisplayObject());
  }

  /**
   * Compare with another message (for sorting)
   */
  compareTo(other) {
    if (!(other instanceof MessageModel)) return 0;
    const thisTime = new Date(this.createdAt).getTime();
    const otherTime = new Date(other.createdAt).getTime();
    return thisTime - otherTime;
  }

  /**
   * Check if message matches search criteria
   */
  matches(criteria = {}) {
    if (criteria.userId && this.userId !== criteria.userId) return false;
    if (criteria.channelId && this.channelId !== criteria.channelId) return false;
    if (criteria.searchText && !this.containsText(criteria.searchText)) return false;
    if (criteria.hasAttachments !== undefined && this.hasAttachments() !== criteria.hasAttachments) return false;
    if (criteria.isEdited !== undefined && this.isEdited() !== criteria.isEdited) return false;
    return true;
  }
}

export default MessageModel;