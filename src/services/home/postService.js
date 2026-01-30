// ============================================================================
// src/services/home/postService.js - WITH IMAGE & VIDEO SUPPORT
// ============================================================================

import { supabase } from "../config/supabase";
import { handleError } from "../shared/errorHandler";
import cacheService from "../shared/cacheService";

class PostService {
  // ==================== GET POSTS ====================

  async getPosts(filters = {}, offset = 0, limit = 20) {
    try {
      const { userId = null, category = null, following = false } = filters;

      // Build cache key
      const cacheKey = `posts:${userId || "all"}:${category || "all"}:${following}:${offset}:${limit}`;

      // Check cache first
      const cached = cacheService.get(cacheKey);
      if (cached) {
        console.log("📦 Posts loaded from cache");
        return cached;
      }

      // Start query
      let query = supabase
        .from("posts")
        .select(
          `
          id,
          user_id,
          content,
          image_ids,
          image_metadata,
          video_ids,
          video_metadata,
          category,
          likes,
          comments_count,
          shares,
          views,
          created_at,
          profiles!inner(
            id,
            full_name,
            username,
            avatar_id,
            verified
          )
        `,
        )
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .range(offset, offset + limit - 1);

      // Apply filters
      if (userId && typeof userId === "string") {
        query = query.eq("user_id", userId);
      }

      if (category) {
        query = query.eq("category", category);
      }

      console.log("🔍 Fetching posts with filters:", {
        userId,
        category,
        offset,
        limit,
      });

      const { data, error } = await query;

      if (error) {
        console.error("Posts fetch error:", error);
        throw error;
      }

      console.log(`✅ Fetched ${data?.length || 0} posts`);

      // Cache the result
      cacheService.set(cacheKey, data, 300000); // 5 minutes

      return data || [];
    } catch (error) {
      console.error("[Failed to fetch posts]", error);
      throw handleError(error, "Failed to fetch posts");
    }
  }

  // ==================== GET SINGLE POST ====================

  async getPost(postId) {
    try {
      const cacheKey = `post:${postId}`;
      const cached = cacheService.get(cacheKey);
      if (cached) return cached;

      const { data, error } = await supabase
        .from("posts")
        .select(
          `
          *,
          profiles!inner(
            id,
            full_name,
            username,
            avatar_id,
            verified
          )
        `,
        )
        .eq("id", postId)
        .is("deleted_at", null)
        .single();

      if (error) throw error;

      cacheService.set(cacheKey, data, 300000);
      return data;
    } catch (error) {
      throw handleError(error, "Failed to fetch post");
    }
  }

  // ==================== CREATE POST ====================

  async createPost(postData) {
    try {
      console.log("📝 Creating post with data:", postData);

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        throw new Error("You must be logged in to create a post");
      }

      // CRITICAL FIX: Ensure arrays are properly formatted
      const imageIds = Array.isArray(postData.imageIds)
        ? postData.imageIds
        : [];
      const imageMetadata = Array.isArray(postData.imageMetadata)
        ? postData.imageMetadata
        : [];
      const videoIds = Array.isArray(postData.videoIds)
        ? postData.videoIds
        : [];
      const videoMetadata = Array.isArray(postData.videoMetadata)
        ? postData.videoMetadata
        : [];

      // Build the post object
      const newPost = {
        user_id: user.id,
        content: postData.content || null,
        image_ids: imageIds,
        image_metadata: imageMetadata,
        video_ids: videoIds,
        video_metadata: videoMetadata,
        category: postData.category || "General",
      };

      console.log("📤 Inserting post:", {
        ...newPost,
        image_ids_count: imageIds.length,
        image_metadata_count: imageMetadata.length,
        video_ids_count: videoIds.length,
        video_metadata_count: videoMetadata.length,
      });

      const { data, error } = await supabase
        .from("posts")
        .insert([newPost])
        .select(
          `
          *,
          profiles!inner(
            id,
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

      // Invalidate cache
      cacheService.invalidatePattern("posts");

      console.log("✅ Post created successfully:", data);
      return data;
    } catch (error) {
      console.error("❌ Failed to create post:", error);
      throw handleError(error, "Failed to create post");
    }
  }

  // ==================== UPDATE POST ====================

  async updatePost(postId, updates) {
    try {
      console.log("📝 Updating post:", postId, updates);

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        throw new Error("You must be logged in to update a post");
      }

      // Verify ownership
      const { data: post, error: fetchError } = await supabase
        .from("posts")
        .select("user_id")
        .eq("id", postId)
        .single();

      if (fetchError) {
        console.error("❌ Failed to fetch post:", fetchError);
        throw new Error("Post not found");
      }

      if (post.user_id !== user.id) {
        throw new Error("You can only update your own posts");
      }

      // Prepare update data
      const updateData = {
        ...updates,
        updated_at: new Date().toISOString(),
      };

      // Ensure arrays are properly formatted if they exist
      if (updates.imageIds !== undefined) {
        updateData.image_ids = Array.isArray(updates.imageIds)
          ? updates.imageIds
          : [];
      }
      if (updates.imageMetadata !== undefined) {
        updateData.image_metadata = Array.isArray(updates.imageMetadata)
          ? updates.imageMetadata
          : [];
      }
      if (updates.videoIds !== undefined) {
        updateData.video_ids = Array.isArray(updates.videoIds)
          ? updates.videoIds
          : [];
      }
      if (updates.videoMetadata !== undefined) {
        updateData.video_metadata = Array.isArray(updates.videoMetadata)
          ? updates.videoMetadata
          : [];
      }

      const { data, error } = await supabase
        .from("posts")
        .update(updateData)
        .eq("id", postId)
        .select()
        .single();

      if (error) {
        console.error("❌ Update error:", error);
        throw error;
      }

      // Invalidate cache
      cacheService.invalidate(`post:${postId}`);
      cacheService.invalidatePattern("posts");

      console.log("✅ Post updated successfully");
      return data;
    } catch (error) {
      console.error("❌ Update failed:", error);
      throw handleError(error, "Failed to update post");
    }
  }

  // ==================== DELETE POST ====================

  async deletePost(postId) {
    try {
      console.log("🗑️ Deleting post:", postId);

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        throw new Error("You must be logged in to delete a post");
      }

      // Verify ownership
      const { data: post, error: fetchError } = await supabase
        .from("posts")
        .select("user_id")
        .eq("id", postId)
        .single();

      if (fetchError) {
        console.error("❌ Failed to fetch post:", fetchError);
        throw new Error("Post not found");
      }

      if (post.user_id !== user.id) {
        throw new Error("You can only delete your own posts");
      }

      // Soft delete
      const { error } = await supabase
        .from("posts")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", postId);

      if (error) {
        console.error("❌ Delete error:", error);
        throw error;
      }

      // Clear ALL post-related cache
      cacheService.invalidate(`post:${postId}`);
      cacheService.invalidatePattern("posts");
      console.log("🗑️ Cleared all post cache");

      console.log("✅ Post deleted successfully");
      return { success: true };
    } catch (error) {
      console.error("❌ Delete failed:", error);
      throw handleError(error, "Failed to delete post");
    }
  }

  // ==================== LIKE/UNLIKE POST ====================

  async toggleLike(postId) {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("You must be logged in");

      // Check if already liked
      const { data: existingLike } = await supabase
        .from("post_likes")
        .select("id")
        .eq("post_id", postId)
        .eq("user_id", user.id)
        .maybeSingle();

      if (existingLike) {
        // Unlike
        await supabase.from("post_likes").delete().eq("id", existingLike.id);

        // Decrement likes count
        const { data: post } = await supabase
          .from("posts")
          .select("likes")
          .eq("id", postId)
          .single();

        if (post) {
          await supabase
            .from("posts")
            .update({ likes: Math.max(0, (post.likes || 1) - 1) })
            .eq("id", postId);
        }

        return { liked: false };
      } else {
        // Like
        await supabase
          .from("post_likes")
          .insert([{ post_id: postId, user_id: user.id }]);

        // Increment likes count
        const { data: post } = await supabase
          .from("posts")
          .select("likes")
          .eq("id", postId)
          .single();

        if (post) {
          await supabase
            .from("posts")
            .update({ likes: (post.likes || 0) + 1 })
            .eq("id", postId);
        }

        return { liked: true };
      }
    } catch (error) {
      throw handleError(error, "Failed to toggle like");
    }
  }

  // ==================== INCREMENT VIEWS ====================

  async incrementViews(postId) {
    try {
      const { data: post } = await supabase
        .from("posts")
        .select("views")
        .eq("id", postId)
        .single();

      if (post) {
        await supabase
          .from("posts")
          .update({ views: (post.views || 0) + 1 })
          .eq("id", postId);
      }
    } catch (error) {
      console.error("Failed to increment views:", error);
    }
  }
}

const postService = new PostService();

export default postService;
