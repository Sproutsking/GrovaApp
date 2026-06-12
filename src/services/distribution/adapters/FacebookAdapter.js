// ============================================================================
// src/services/distribution/adapters/FacebookAdapter.js
// Facebook platform adapter for cross-posting
// ============================================================================

import BaseAdapter from "./BaseAdapter";

class FacebookAdapter extends BaseAdapter {
  constructor() {
    super("Facebook", "https://graph.facebook.com/v18.0");
  }

  async publishPost(encryptedToken, post, platformUserId) {
    try {
      const token = await this.decryptToken(encryptedToken);

      if (!this.validatePost(post)) {
        throw new Error("Invalid post data for Facebook");
      }

      // Build Facebook post payload
      const payload = {
        message: post.content || post.card_caption || "",
        type: "FEED",
      };

      // Add media if available
      const mediaUrls = this.getMediaUrls(post);
      if (mediaUrls.length > 0) {
        payload.link = mediaUrls[0]; // Facebook uses link property for media
      }

      // If only images, use multi-image format
      if (post.image_metadata?.length > 1) {
        payload.attached_media = post.image_metadata.map(img => ({
          media: {
            image: {
              height: img.height,
              width: img.width,
              src: img.url,
            },
          },
        }));
      }

      // Make API call to Facebook
      const endpoint = `${this.apiEndpoint}/${platformUserId}/feed`;
      const response = await fetch(endpoint, {
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
          `Facebook API error: ${errorData.error?.message || "Unknown error"}`
        );
      }

      const data = await response.json();
      return data.id; // Facebook post ID
    } catch (error) {
      console.error("Facebook publishing error:", error);
      throw error;
    }
  }

  generateDeepLink(post) {
    const message = encodeURIComponent(
      post.content || post.card_caption || "Posted from Xeevia"
    );
    const url = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(
      window.location.href
    )}&quote=${message}`;

    return {
      url,
      instructions: [
        "Open link to share on Facebook",
        "Add media using Facebook's uploader",
        "Click Share to post",
      ],
    };
  }

  validatePost(post) {
    if (!post) return false;
    // Facebook requires at least text or media
    const hasContent = !!(post.content || post.card_caption);
    const hasMedia = !!(
      post.image_metadata?.length > 0 || 
      post.video_metadata?.length > 0
    );
    return hasContent || hasMedia;
  }
}

export default FacebookAdapter;
