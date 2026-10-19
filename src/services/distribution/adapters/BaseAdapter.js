// ============================================================================
// src/services/distribution/adapters/BaseAdapter.js
// Abstract base class for platform-specific publishing logic
// ============================================================================

/**
 * Base adapter class - all platform adapters extend this
 * Handles common patterns while allowing platform-specific overrides
 */
class BaseAdapter {
  constructor(platformName, apiEndpoint) {
    this.platformName = platformName;
    this.apiEndpoint = apiEndpoint;
  }

  /**
   * Decode a stored token. The current client-side flow stores provider tokens
   * as-is; production publishing should move token access into a server function.
   * @param {string} encryptedToken - Token value from the database
   * @returns {string} Provider access token
   */
  async decryptToken(encryptedToken) {
    return encryptedToken;
  }

  /**
   * Publish post to platform - MUST be implemented by each adapter
   * @param {string} encryptedToken - Stored provider access token
   * @param {Object} post - Post data { content, image_metadata, video_metadata, etc. }
   * @param {string} platformUserId - User's ID on the platform
   * @returns {string} External post ID from platform
   */
  async publishPost(encryptedToken, post, platformUserId) {
    throw new Error(`publishPost() not implemented for ${this.platformName}`);
  }

  /**
   * Generate deep link for manual posting fallback
   * @param {Object} post - Post data
   * @returns {Object} { url: string, instructions: string[] }
   */
  generateDeepLink(post) {
    throw new Error(`generateDeepLink() not implemented for ${this.platformName}`);
  }

  /**
   * Format post content for platform constraints
   * @param {string} content - Original content
   * @param {number} maxLength - Platform's character limit
   * @returns {string} Formatted content
   */
  formatContent(content, maxLength) {
    if (content && content.length > maxLength) {
      return content.substring(0, maxLength - 3) + "...";
    }
    return content || "";
  }

  /**
   * Validate post data before publishing
   * @param {Object} post - Post to validate
   * @returns {boolean} Whether post is valid
   */
  validatePost(post) {
    if (!post) return false;
    // Subclasses can override with stricter validation
    return true;
  }

  /**
   * Format hashtags/mentions for platform
   * @param {string} text - Text potentially containing tags
   * @returns {string} Platform-formatted text
   */
  formatTags(text) {
    // Default: return as-is, subclasses can override
    return text;
  }

  /**
   * Get media URLs from post metadata
   * @param {Object} post - Post data
   * @returns {string[]} Array of media URLs
   */
  getMediaUrls(post) {
    const urls = [];

    if (post.image_metadata?.length > 0) {
      post.image_metadata.forEach(img => {
        if (img.url) urls.push(img.url);
      });
    }

    if (post.video_metadata?.length > 0) {
      post.video_metadata.forEach(vid => {
        if (vid.url) urls.push(vid.url);
      });
    }

    return urls;
  }

  /**
   * Handle API errors with retry logic
   * @param {Error} error - Error from API call
   * @param {number} attempt - Current attempt number
   * @returns {boolean} Whether to retry
   */
  shouldRetry(error, attempt) {
    if (attempt >= 3) return false;

    // Retry on network errors
    if (error.code === "ECONNREFUSED" || error.code === "ENOTFOUND") return true;

    // Don't retry on authentication errors
    if (error.status === 401 || error.status === 403) return false;

    // Retry on server errors
    if (error.status >= 500) return true;

    return false;
  }
}

export default BaseAdapter;
