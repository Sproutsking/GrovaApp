// ============================================================================
// src/services/create/createService.js — FIXED POST CREATION
// Fix: profiles join uses inner join syntax, not profiles:user_id which
// breaks if the foreign key relationship name is different.
// ============================================================================

import { supabase } from "../config/supabase";
import uploadService from "../upload/uploadService";
import { handleError } from "../shared/errorHandler";
import cacheService from "../shared/cacheService";

class CreateService {
  // ── Helper: fetch created row with profile ────────────────────────────────
  async _withProfile(table, id) {
    const { data, error } = await supabase
      .from(table)
      .select(`*, profiles!inner(id, full_name, username, avatar_id, verified)`)
      .eq("id", id)
      .single();
    if (error) throw error;
    return data;
  }

  // ==================== POST CREATION ====================
  async createPost(postData, userId) {
    try {
      console.log("📝 Creating post...", { userId, isTextCard: postData.isTextCard });

      const { content, images, videos, category, isTextCard, textCardMetadata, cardCaption } = postData;

      // ── TEXT CARD ────────────────────────────────────────────────────────
      if (isTextCard) {
        if (!content?.trim()) throw new Error("Text card requires content");

        const { data, error } = await supabase
          .from("posts")
          .insert({
            user_id: userId,
            content: content.trim(),
            image_ids: [],
            image_metadata: [],
            video_ids: [],
            video_metadata: [],
            category: category || "General",
            is_text_card: true,
            text_card_metadata: {
              gradient: textCardMetadata?.gradient || "linear-gradient(135deg, #84cc16 0%, #65a30d 100%)",
              textColor: textCardMetadata?.textColor || "#ffffff",
              edgeStyle: textCardMetadata?.edgeStyle || "medium",
              align: textCardMetadata?.align || "center",
              fontSize: textCardMetadata?.fontSize ?? null,
              cardHeight: textCardMetadata?.cardHeight || null,
            },
            card_caption: cardCaption?.trim() || null,
            likes: 0, comments_count: 0, shares: 0, views: 0,
          })
          .select("id")
          .single();

        if (error) { console.error("❌ Text card insert error:", error); throw error; }

        const full = await this._withProfile("posts", data.id);
        cacheService.invalidate("posts");
        console.log("✅ Text card created:", full.id);
        return full;
      }

      // ── REGULAR POST ─────────────────────────────────────────────────────
      if (!content && (!images?.length) && (!videos?.length)) {
        throw new Error("Post must have content, images, or videos");
      }

      let imageIds = [], imageMetadata = [], videoIds = [], videoMetadata = [];

      if (images?.length) {
        console.log(`⬆️ Uploading ${images.length} images...`);
        const results = await uploadService.uploadImages(images, "grova/posts");
        imageIds = results.map(r => r.public_id || r.id);
        imageMetadata = results.map(r => ({ id: r.public_id || r.id, width: r.width, height: r.height, format: r.format, bytes: r.bytes, url: r.url || r.secure_url }));
      }

      if (videos?.length) {
        console.log(`⬆️ Uploading ${videos.length} videos...`);
        const results = await Promise.all(videos.map(v => uploadService.uploadVideo(v, "grova/posts")));
        videoIds = results.map(r => r.public_id || r.id);
        videoMetadata = results.map(r => ({ id: r.public_id || r.id, width: r.width, height: r.height, duration: r.duration, format: r.format, bytes: r.bytes, url: r.url || r.secure_url, thumbnail_url: r.thumbnail_url || null }));
      }

      const { data, error } = await supabase
        .from("posts")
        .insert({
          user_id: userId,
          content: content || null,
          image_ids: imageIds,
          image_metadata: imageMetadata,
          video_ids: videoIds,
          video_metadata: videoMetadata,
          category: category || "General",
          is_text_card: false,
          card_caption: null,
          likes: 0, comments_count: 0, shares: 0, views: 0,
        })
        .select("id")
        .single();

      if (error) { console.error("❌ Post insert error:", error); throw error; }

      const full = await this._withProfile("posts", data.id);
      cacheService.invalidate("posts");
      console.log("✅ Post created:", full.id);
      return full;
    } catch (error) {
      console.error("❌ Create post error:", error);
      throw handleError(error, error.message || "Failed to create post");
    }
  }

  // ==================== REEL CREATION ====================
  async createReel(reelData, userId, onProgress) {
    try {
      console.log("🎬 Creating reel...");
      const { video, caption, music, category } = reelData;
      if (!video) throw new Error("Video is required");

      const videoResult = await uploadService.uploadVideo(video, "grova/reels", onProgress);

      const { data, error } = await supabase
        .from("reels")
        .insert({
          user_id: userId,
          video_id: videoResult.public_id || videoResult.id,
          video_metadata: { width: videoResult.width, height: videoResult.height, duration: videoResult.duration, format: videoResult.format, bytes: videoResult.bytes, url: videoResult.url || videoResult.secure_url },
          caption: caption || null,
          music: music || null,
          category: category || "Entertainment",
          duration: videoResult.duration ? Math.round(videoResult.duration) : null,
          likes: 0, comments_count: 0, shares: 0, views: 0,
        })
        .select("id")
        .single();

      if (error) { console.error("❌ Reel insert error:", error); throw error; }

      const full = await this._withProfile("reels", data.id);
      cacheService.invalidate("reels");
      console.log("✅ Reel created:", full.id);
      return full;
    } catch (error) {
      console.error("❌ Create reel error:", error);
      throw handleError(error, error.message || "Failed to create reel");
    }
  }

  // ==================== STORY CREATION ====================
  async createStory(storyData, userId) {
    try {
      console.log("📖 Creating story...");
      const { title, preview, fullContent, coverImage, category, unlockCost, maxAccesses, titleColor, textColor } = storyData;

      if (!title || title.trim().length < 3) throw new Error("Title must be at least 3 characters");
      if (!preview || preview.trim().length < 10) throw new Error("Preview must be at least 10 characters");
      if (!fullContent?.trim()) throw new Error("Story content is required");

      let coverImageId = null, coverImageMetadata = null;
      if (coverImage) {
        const result = await uploadService.uploadImage(coverImage, "grova/stories");
        coverImageId = result.public_id || result.id;
        coverImageMetadata = { width: result.width, height: result.height, format: result.format, bytes: result.bytes, url: result.url || result.secure_url };
      }

      const { data, error } = await supabase
        .from("stories")
        .insert({
          user_id: userId,
          title: title.trim(),
          preview: preview.trim(),
          full_content: fullContent.trim(),
          cover_image_id: coverImageId,
          cover_image_metadata: coverImageMetadata,
          category: category || "Folklore",
          unlock_cost: unlockCost || 0,
          max_accesses: maxAccesses || 1000,
          current_accesses: 0,
          likes: 0, comments_count: 0, views: 0,
        })
        .select("id")
        .single();

      if (error) { console.error("❌ Story insert error:", error); throw error; }

      const full = await this._withProfile("stories", data.id);
      cacheService.invalidate("stories");
      console.log("✅ Story created:", full.id);
      return full;
    } catch (error) {
      console.error("❌ Create story error:", error);
      throw handleError(error, error.message || "Failed to create story");
    }
  }

  // ==================== DELETE METHODS ====================
  async deletePost(postId, userId) {
    try {
      const { error } = await supabase.from("posts").update({ deleted_at: new Date().toISOString() }).eq("id", postId).eq("user_id", userId);
      if (error) throw error;
      cacheService.invalidate("posts");
      return { success: true };
    } catch (error) { throw handleError(error, "Failed to delete post"); }
  }

  async deleteReel(reelId, userId) {
    try {
      const { error } = await supabase.from("reels").update({ deleted_at: new Date().toISOString() }).eq("id", reelId).eq("user_id", userId);
      if (error) throw error;
      cacheService.invalidate("reels");
      return { success: true };
    } catch (error) { throw handleError(error, "Failed to delete reel"); }
  }

  async deleteStory(storyId, userId) {
    try {
      const { error } = await supabase.from("stories").update({ deleted_at: new Date().toISOString() }).eq("id", storyId).eq("user_id", userId);
      if (error) throw error;
      cacheService.invalidate("stories");
      return { success: true };
    } catch (error) { throw handleError(error, "Failed to delete story"); }
  }
}

const createService = new CreateService();
export default createService;