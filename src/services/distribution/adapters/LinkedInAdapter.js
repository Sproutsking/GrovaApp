// ============================================================================
// src/services/distribution/adapters/LinkedInAdapter.js
// LinkedIn platform adapter for cross-posting
// ============================================================================

import BaseAdapter from "./BaseAdapter";

class LinkedInAdapter extends BaseAdapter {
  constructor() {
    super("LinkedIn", "https://api.linkedin.com/v2");
  }

  async publishPost(encryptedToken, post, platformUserId) {
    try {
      const token = await this.decryptToken(encryptedToken);

      if (!this.validatePost(post)) {
        throw new Error("Invalid post data for LinkedIn");
      }

      // Build LinkedIn post payload
      const payload = {
        author: `urn:li:person:${platformUserId}`,
        lifecycleState: "PUBLISHED",
        specificContent: {
          "com.linkedin.ugc.PublishOpen": {
            commonContent: {
              description: {
                attributes: [],
                text: this.formatContent(
                  post.content || post.card_caption || "",
                  3000 // LinkedIn character limit
                ),
              },
            },
          },
        },
        visibility: {
          "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC",
        },
      };

      // Add media if available
      const mediaUrls = this.getMediaUrls(post);
      if (mediaUrls.length > 0) {
        payload.specificContent["com.linkedin.ugc.PublishOpen"].commonContent.media = {
          media: mediaUrls.map(url => ({
            status: "READY",
            originalUrl: url,
            media: {
              "com.linkedin.digitalmedia.Asset": {
                storageId: this.extractStorageId(url),
              },
            },
          })),
        };
      }

      // Make API call to LinkedIn
      const endpoint = `${this.apiEndpoint}/ugcPosts`;
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
          "LinkedIn-Version": "202301",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          `LinkedIn API error: ${errorData.message || "Unknown error"}`
        );
      }

      const data = await response.json();
      return data.id || data.entityUrn; // LinkedIn post ID
    } catch (error) {
      console.error("LinkedIn publishing error:", error);
      throw error;
    }
  }

  extractStorageId(url) {
    // Extract storage ID from Cloudinary URL or generate one
    // This is simplified - real implementation would handle ID extraction
    const hash = url
      .split("/")
      .pop()
      .split(".")
      .shift();
    return hash || `storage-${Date.now()}`;
  }

  generateDeepLink(post) {
    const text = encodeURIComponent(
      this.formatContent(post.content || post.card_caption || "", 3000)
    );
    const url = `https://www.linkedin.com/feed/?updateContentUrl=${text}`;

    return {
      url,
      instructions: [
        "Open link to post on LinkedIn",
        "Add any media or links",
        "Click Post to publish",
      ],
    };
  }

  validatePost(post) {
    if (!post) return false;
    // LinkedIn requires text content
    return !!(post.content || post.card_caption);
  }

  formatTags(text) {
    // LinkedIn uses #hashtags and @mentions similar to Twitter
    // Keep them as-is
    return text;
  }
}

export default LinkedInAdapter;
