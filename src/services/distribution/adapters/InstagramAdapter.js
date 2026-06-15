// ============================================================================
// src/services/distribution/adapters/InstagramAdapter.js
// Instagram platform adapter for cross-posting
// ============================================================================

import BaseAdapter from "./BaseAdapter";

class InstagramAdapter extends BaseAdapter {
  constructor() {
    super("Instagram", "https://graph.instagram.com/v18.0");
  }

  async publishPost(encryptedToken, post, platformUserId) {
    try {
      const token = await this.decryptToken(encryptedToken);

      if (!this.validatePost(post)) {
        throw new Error("Invalid post data for Instagram");
      }

      // Instagram requires media for most posts
      const mediaUrls = this.getMediaUrls(post);
      if (mediaUrls.length === 0) {
        throw new Error("Instagram requires at least one image or video");
      }

      // Build Instagram post payload
      const payload = {
        caption: this.formatContent(
          post.content || post.card_caption || "",
          2200 // Instagram caption limit
        ),
      };

      // For Reels (videos), use specific endpoint
      if (post.video_metadata?.length > 0) {
        return await this.publishReel(
          token,
          platformUserId,
          mediaUrls[0],
          payload.caption
        );
      }

      // For carousel (multiple images)
      if (post.image_metadata?.length > 1) {
        return await this.publishCarousel(
          token,
          platformUserId,
          mediaUrls,
          payload.caption
        );
      }

      // Single image post
      const endpoint = `${this.apiEndpoint}/${platformUserId}/media`;
      const imagePayload = {
        image_url: mediaUrls[0],
        caption: payload.caption,
      };

      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(imagePayload),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          `Instagram API error: ${errorData.error?.message || "Unknown error"}`
        );
      }

      const data = await response.json();
      
      // Publish the media
      const publishResponse = await fetch(
        `${this.apiEndpoint}/${data.id}/publish`,
        {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (!publishResponse.ok) {
        throw new Error("Failed to publish Instagram post");
      }

      return data.id;
    } catch (error) {
      console.error("Instagram publishing error:", error);
      throw error;
    }
  }

  async publishReel(token, platformUserId, videoUrl, caption) {
    try {
      const endpoint = `${this.apiEndpoint}/${platformUserId}/media`;
      const payload = {
        media_type: "REELS",
        video_url: videoUrl,
        caption,
      };

      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) throw new Error("Failed to create Reel");

      const data = await response.json();

      // Publish the reel
      const publishResponse = await fetch(
        `${this.apiEndpoint}/${data.id}/publish`,
        {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (!publishResponse.ok) throw new Error("Failed to publish Reel");

      return data.id;
    } catch (error) {
      console.error("Instagram Reel publishing error:", error);
      throw error;
    }
  }

  async publishCarousel(token, platformUserId, mediaUrls, caption) {
    try {
      // Create carousel items
      const items = await Promise.all(
        mediaUrls.slice(0, 10).map(async (url, idx) => {
          const endpoint = `${this.apiEndpoint}/${platformUserId}/media`;
          const isVideo = url.includes(".mp4") || url.includes("video");

          const itemPayload = {
            media_type: isVideo ? "VIDEO" : "IMAGE",
            [isVideo ? "video_url" : "image_url"]: url,
          };

          const response = await fetch(endpoint, {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(itemPayload),
          });

          if (!response.ok) throw new Error(`Failed to create carousel item ${idx}`);
          const data = await response.json();
          return data.id;
        })
      );

      // Create carousel post
      const carouselEndpoint = `${this.apiEndpoint}/${platformUserId}/media`;
      const carouselPayload = {
        media_type: "CAROUSEL",
        children: items,
        caption,
      };

      const response = await fetch(carouselEndpoint, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(carouselPayload),
      });

      if (!response.ok) throw new Error("Failed to create carousel");

      const data = await response.json();

      // Publish carousel
      const publishResponse = await fetch(
        `${this.apiEndpoint}/${data.id}/publish`,
        {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (!publishResponse.ok) throw new Error("Failed to publish carousel");

      return data.id;
    } catch (error) {
      console.error("Instagram carousel publishing error:", error);
      throw error;
    }
  }

  generateDeepLink(post) {
    const caption = encodeURIComponent(
      post.content || post.card_caption || "Posted from Xeevia"
    );
    const url = `https://www.instagram.com/create`;

    return {
      url,
      instructions: [
        "Open Instagram Create page",
        "Select photos or video from upload",
        `Use caption: ${post.content || post.card_caption || ""}`,
        "Share your post",
      ],
    };
  }

  validatePost(post) {
    if (!post) return false;
    // Instagram requires media
    return !!(
      post.image_metadata?.length > 0 || 
      post.video_metadata?.length > 0
    );
  }
}

export default InstagramAdapter;
