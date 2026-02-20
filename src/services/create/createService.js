// ============================================================================
// src/services/create/createService.js
// ============================================================================

import { supabase } from "../config/supabase";
import uploadService from "../upload/uploadService";
import { handleError } from "../shared/errorHandler";
import cacheService from "../shared/cacheService";

class CreateService {
  // ==================== POST CREATION ====================

  async createPost(postData, userId) {
    try {
      console.log("📝 Creating post...", postData);
      const {
        content,
        images,
        videos,
        category,
        isTextCard,
        textCardMetadata,
        cardCaption, // We receive it but won't use it yet
      } = postData;

      // ── TEXT CARD PATH ──────────────────────────────────────────────────────
      // No canvas. No image upload. Pure DB record with design metadata.
      if (isTextCard) {
        if (!content || !content.trim()) {
          throw new Error("Text card requires content");
        }

        console.log("🎨 Creating text card (no image upload)...");
        console.log("🎨 Text card metadata:", textCardMetadata);

        const postDataToInsert = {
          user_id: userId,
          content: content.trim(),
          image_ids: [], // EMPTY — card is not an image
          image_metadata: [],
          video_ids: [],
          video_metadata: [],
          category: category || "General",
          is_text_card: true,
          text_card_metadata: {
            gradient:
              textCardMetadata?.gradient ||
              "linear-gradient(135deg, #84cc16 0%, #65a30d 100%)",
            textColor: textCardMetadata?.textColor || "#ffffff",
            edgeStyle: textCardMetadata?.edgeStyle || "medium",
            align: textCardMetadata?.align || "center",
            fontSize: textCardMetadata?.fontSize ?? null, // null = Auto
            cardHeight: textCardMetadata?.cardHeight || null, // User custom height
          },
          // ⚠️ COMMENTED OUT - Uncomment after adding card_caption column to database
          // card_caption: cardCaption?.trim() || null,
          likes: 0,
          comments_count: 0,
          shares: 0,
          views: 0,
        };

        console.log(
          "🎨 Inserting text card with metadata:",
          postDataToInsert.text_card_metadata,
        );

        const { data, error } = await supabase
          .from("posts")
          .insert(postDataToInsert)
          .select(
            `*, profiles:user_id (full_name, username, avatar_id, verified)`,
          )
          .single();

        if (error) {
          console.error("❌ Text card insert error:", error);
          throw error;
        }

        console.log("✅ Text card created successfully:", {
          id: data.id,
          is_text_card: data.is_text_card,
          text_card_metadata: data.text_card_metadata,
        });

        cacheService.invalidate("posts");
        return data;
      }

      // ── REGULAR POST PATH ───────────────────────────────────────────────────
      if (
        !content &&
        (!images || images.length === 0) &&
        (!videos || videos.length === 0)
      ) {
        throw new Error("Post must have content, images, or videos");
      }

      let imageIds = [];
      let imageMetadata = [];
      let videoIds = [];
      let videoMetadata = [];

      if (images && images.length > 0) {
        console.log(`⬆️ Uploading ${images.length} images...`);
        const uploadResults = await uploadService.uploadImages(
          images,
          "grova/posts",
        );
        imageIds = uploadResults.map((r) => r.public_id || r.id);
        imageMetadata = uploadResults.map((r) => ({
          id: r.public_id || r.id,
          width: r.width,
          height: r.height,
          format: r.format,
          bytes: r.bytes,
          url: r.url || r.secure_url,
        }));
      }

      if (videos && videos.length > 0) {
        console.log(`⬆️ Uploading ${videos.length} videos...`);
        const videoResults = await Promise.all(
          videos.map((v) => uploadService.uploadVideo(v, "grova/posts")),
        );
        videoIds = videoResults.map((r) => r.public_id || r.id);
        videoMetadata = videoResults.map((r) => ({
          id: r.public_id || r.id,
          width: r.width,
          height: r.height,
          duration: r.duration,
          format: r.format,
          bytes: r.bytes,
          url: r.url || r.secure_url,
          thumbnail_url: r.thumbnail_url || null,
        }));
      }

      const postDataToInsert = {
        user_id: userId,
        content: content || null,
        image_ids: imageIds,
        image_metadata: imageMetadata,
        video_ids: videoIds,
        video_metadata: videoMetadata,
        category: category || "General",
        is_text_card: false,
        likes: 0,
        comments_count: 0,
        shares: 0,
        views: 0,
      };

      const { data, error } = await supabase
        .from("posts")
        .insert(postDataToInsert)
        .select(
          `*, profiles:user_id (full_name, username, avatar_id, verified)`,
        )
        .single();

      if (error) {
        console.error("❌ Post insert error:", error);
        throw error;
      }

      console.log("✅ Post created:", {
        id: data.id,
        image_ids: data.image_ids,
        video_ids: data.video_ids,
      });
      cacheService.invalidate("posts");
      return data;
    } catch (error) {
      console.error("❌ Create post error:", error);
      throw handleError(error, "Failed to create post");
    }
  }

  // ==================== REEL CREATION ====================

  async createReel(reelData, userId, onProgress) {
    try {
      console.log("🎬 Creating reel...");
      const { video, caption, music, category } = reelData;
      if (!video) throw new Error("Video is required");

      const videoResult = await uploadService.uploadVideo(
        video,
        "grova/reels",
        onProgress,
      );

      const { data, error } = await supabase
        .from("reels")
        .insert({
          user_id: userId,
          video_id: videoResult.public_id || videoResult.id,
          video_metadata: {
            width: videoResult.width,
            height: videoResult.height,
            duration: videoResult.duration,
            format: videoResult.format,
            bytes: videoResult.bytes,
            url: videoResult.url || videoResult.secure_url,
          },
          caption: caption || null,
          music: music || null,
          category: category || "Entertainment",
          duration: videoResult.duration
            ? Math.round(videoResult.duration)
            : null,
          likes: 0,
          comments_count: 0,
          shares: 0,
          views: 0,
        })
        .select(
          `*, profiles:user_id (full_name, username, avatar_id, verified)`,
        )
        .single();

      if (error) {
        console.error("❌ Reel insert error:", error);
        throw error;
      }

      cacheService.invalidate("reels");
      console.log("✅ Reel created:", data.id);
      return data;
    } catch (error) {
      console.error("❌ Create reel error:", error);
      throw handleError(error, "Failed to create reel");
    }
  }

  // ==================== STORY CREATION ====================

  async createStory(storyData, userId) {
    try {
      console.log("📖 Creating story...");
      const {
        title,
        preview,
        fullContent,
        coverImage,
        category,
        unlockCost,
        maxAccesses,
      } = storyData;

      if (!title || title.trim().length < 3)
        throw new Error("Title must be at least 3 characters");
      if (!preview || preview.trim().length < 10)
        throw new Error("Preview must be at least 10 characters");
      if (!fullContent || !fullContent.trim().length)
        throw new Error("Story content is required");

      let coverImageId = null;
      let coverImageMetadata = null;

      if (coverImage) {
        const imageResult = await uploadService.uploadImage(
          coverImage,
          "grova/stories",
        );
        coverImageId = imageResult.public_id || imageResult.id;
        coverImageMetadata = {
          width: imageResult.width,
          height: imageResult.height,
          format: imageResult.format,
          bytes: imageResult.bytes,
          url: imageResult.url || imageResult.secure_url,
        };
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
          likes: 0,
          comments_count: 0,
          views: 0,
        })
        .select(
          `*, profiles:user_id (full_name, username, avatar_id, verified)`,
        )
        .single();

      if (error) {
        console.error("❌ Story insert error:", error);
        throw error;
      }

      cacheService.invalidate("stories");
      console.log("✅ Story created:", data.id);
      return data;
    } catch (error) {
      console.error("❌ Create story error:", error);
      throw handleError(error, "Failed to create story");
    }
  }
}

const createService = new CreateService();
export default createService;
