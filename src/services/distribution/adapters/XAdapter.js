// ============================================================================
// src/services/distribution/adapters/XAdapter.js
// X (Twitter) platform adapter for cross-posting
// ============================================================================

import BaseAdapter from "./BaseAdapter";

class XAdapter extends BaseAdapter {
  constructor() {
    super("X", "https://api.twitter.com/2");
  }

  async publishPost(encryptedToken, post, platformUserId) {
    try {
      const token = await this.decryptToken(encryptedToken);
      
      if (!this.validatePost(post)) {
        throw new Error("Invalid post data for X");
      }

      // Build X post payload
      const payload = {
        text: this.formatContent(
          post.content || post.card_caption || "Posted from Xeevia",
          280 // X's character limit
        ),
      };

      // Add media if available
      const mediaUrls = this.getMediaUrls(post);
      if (mediaUrls.length > 0) {
        // Note: X API requires uploading media separately, storing media_ids
        // This is simplified - real implementation would handle media upload
        payload.media = {
          media_keys: await this.uploadMediaToX(token, mediaUrls),
        };
      }

      // Make API call to X
      const response = await fetch(`${this.apiEndpoint}/tweets`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          `X API error: ${errorData.errors?.[0]?.message || "Unknown error"}`
        );
      }

      const data = await response.json();
      return data.data.id; // X post ID
    } catch (error) {
      console.error("X publishing error:", error);
      throw error;
    }
  }

  async uploadMediaToX(token, mediaUrls) {
    // Simplified: real implementation would download and upload each media
    // This is a stub for demonstration
    const mediaKeys = [];

    for (const url of mediaUrls) {
      try {
        // Fetch media from Cloudinary
        const response = await fetch(url);
        const blob = await response.blob();

        // Upload to X's media endpoint
        const formData = new FormData();
        formData.append("media_data", blob);

        const uploadResponse = await fetch(
          "https://upload.twitter.com/1.1/media/upload.json",
          {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${token}`,
            },
            body: formData,
          }
        );

        if (uploadResponse.ok) {
          const mediaData = await uploadResponse.json();
          mediaKeys.push(mediaData.media_id_string);
        }
      } catch (error) {
        console.warn(`Failed to upload media to X: ${url}`, error);
      }
    }

    return mediaKeys;
  }

  generateDeepLink(post) {
    const text = encodeURIComponent(
      this.formatContent(post.content || post.card_caption || "", 280)
    );
    const url = `https://twitter.com/intent/tweet?text=${text}`;

    return {
      url,
      instructions: [
        "Open link to post on X",
        "Add any media manually",
        "Click Tweet to publish",
      ],
    };
  }

  validatePost(post) {
    if (!post) return false;
    // X requires at least text or media
    const hasContent = !!(post.content || post.card_caption);
    const hasMedia = !!(
      post.image_metadata?.length > 0 || 
      post.video_metadata?.length > 0
    );
    return hasContent || hasMedia;
  }
}

export default XAdapter;
