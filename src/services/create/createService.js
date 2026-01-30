// ============================================================================
// src/services/create/createService.js - FIXED VIDEO ID EXTRACTION
// ============================================================================

import { supabase } from "../config/supabase";
import uploadService from "../upload/uploadService";
import { handleError } from "../shared/errorHandler";
import cacheService from "../shared/cacheService";

class CreateService {
  // ==================== POST CREATION (WITH VIDEO SUPPORT) ====================

  async createPost(postData, userId) {
    try {
      console.log("📝 Creating post...", postData);
      const { content, images, videos, category } = postData;

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

      // Upload images if provided
      if (images && images.length > 0) {
        console.log(`⬆️ Uploading ${images.length} images...`);

        const uploadResults = await uploadService.uploadImages(
          images,
          "grova/posts",
        );
        console.log("✅ Image upload results:", uploadResults);

        // CRITICAL: Use public_id OR id depending on what uploadService returns
        imageIds = uploadResults.map((result) => result.public_id || result.id);
        imageMetadata = uploadResults.map((result) => ({
          id: result.public_id || result.id,
          width: result.width,
          height: result.height,
          format: result.format,
          bytes: result.bytes,
          url: result.url || result.secure_url,
        }));
      }

      // Upload videos if provided
      if (videos && videos.length > 0) {
        console.log(`⬆️ Uploading ${videos.length} videos...`);

        const videoUploadResults = await Promise.all(
          videos.map((video) =>
            uploadService.uploadVideo(video, "grova/posts"),
          ),
        );
        console.log("✅ Video upload results:", videoUploadResults);

        // CRITICAL FIX: Extract public_id (not just id)
        videoIds = videoUploadResults.map((result) => {
          const videoId = result.public_id || result.id;
          console.log(`  📹 Extracted video ID: ${videoId}`);
          return videoId;
        });

        videoMetadata = videoUploadResults.map((result) => ({
          id: result.public_id || result.id,
          width: result.width,
          height: result.height,
          duration: result.duration,
          format: result.format,
          bytes: result.bytes,
          url: result.url || result.secure_url,
          thumbnail_url: result.thumbnail_url || null,
        }));

        console.log("📊 Video IDs to save:", videoIds);
        console.log("📊 Video metadata to save:", videoMetadata);
      }

      console.log("💾 Inserting post to database...");

      const postDataToInsert = {
        user_id: userId,
        content: content || null,
        image_ids: imageIds,
        image_metadata: imageMetadata,
        video_ids: videoIds,
        video_metadata: videoMetadata,
        category: category || "General",
        likes: 0,
        comments_count: 0,
        shares: 0,
        views: 0,
      };

      console.log("📤 Sending to database:", {
        user_id: userId,
        content_length: content?.length || 0,
        image_ids_count: imageIds.length,
        video_ids_count: videoIds.length,
        image_ids: imageIds,
        video_ids: videoIds,
      });

      const { data, error } = await supabase
        .from("posts")
        .insert(postDataToInsert)
        .select(
          `
          *,
          profiles:user_id (
            full_name,
            username,
            avatar_id,
            verified
          )
        `,
        )
        .single();

      if (error) {
        console.error("❌ Post insert error:", error);
        throw error;
      }

      console.log("✅ Post created successfully:", {
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

      if (!video) {
        throw new Error("Video is required");
      }

      console.log("⬆️ Uploading video to Cloudinary...");

      const videoResult = await uploadService.uploadVideo(
        video,
        "grova/reels",
        onProgress,
      );

      console.log(
        "✅ Video uploaded:",
        videoResult.public_id || videoResult.id,
      );

      console.log("💾 Inserting reel to database...");

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
          `
          *,
          profiles:user_id (
            full_name,
            username,
            avatar_id,
            verified
          )
        `,
        )
        .single();

      if (error) {
        console.error("❌ Reel insert error:", error);
        throw error;
      }

      cacheService.invalidate("reels");
      console.log("✅ Reel created successfully:", data.id);

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

      if (!title || title.trim().length < 3) {
        throw new Error("Title must be at least 3 characters");
      }

      if (!preview || preview.trim().length < 10) {
        throw new Error("Preview must be at least 10 characters");
      }

      if (!fullContent || fullContent.trim().length === 0) {
        throw new Error("Story content is required");
      }

      let coverImageId = null;
      let coverImageMetadata = null;

      if (coverImage) {
        console.log("⬆️ Uploading cover image...");
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
        console.log("✅ Cover uploaded:", coverImageId);
      }

      console.log("💾 Inserting story to database...");

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
          `
          *,
          profiles:user_id (
            full_name,
            username,
            avatar_id,
            verified
          )
        `,
        )
        .single();

      if (error) {
        console.error("❌ Story insert error:", error);
        throw error;
      }

      cacheService.invalidate("stories");
      console.log("✅ Story created successfully:", data.id);

      return data;
    } catch (error) {
      console.error("❌ Create story error:", error);
      throw handleError(error, "Failed to create story");
    }
  }
}

const createService = new CreateService();

export default createService;
