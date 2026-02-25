// ============================================================================
// src/services/home/postService.js - COMPLETE FIX
// ============================================================================

import { supabase } from "../config/supabase";
import { handleError } from "../shared/errorHandler";
import cacheService from "../shared/cacheService";

class PostService {
  // ==================== GET POSTS ====================

  async getPosts(filters = {}, offset = 0, limit = 20) {
    try {
      const { userId = null, category = null, following = false } = filters;

      const cacheKey = `posts:${userId || "all"}:${category || "all"}:${following}:${offset}:${limit}`;
      const cached = cacheService.get(cacheKey);
      if (cached) {
        console.log("📦 Posts loaded from cache");
        return cached;
      }

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
          is_text_card,
          text_card_metadata,
          card_caption,
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

      if (userId && typeof userId === "string") {
        query = query.eq("user_id", userId);
      }

      if (category) {
        query = query.eq("category", category);
      }

      const { data, error } = await query;

      if (error) {
        console.error("Posts fetch error:", error);
        throw error;
      }

      console.log(`✅ Fetched ${data?.length || 0} posts`);
      cacheService.set(cacheKey, data, 300000);
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

      // ── CRITICAL: Check profile exists and is minimally set up ──────────
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("id, full_name, username, account_status, account_activated")
        .eq("id", user.id)
        .single();

      if (profileError || !profile) {
        throw new Error("Profile not found. Please refresh the page.");
      }

      // Only block if account is explicitly suspended
      if (profile.account_status === "suspended") {
        throw new Error("Your account is suspended. Please contact support.");
      }

      // ── FIX: Don't require account_activated - many users skip that ─────
      // Original code was too strict. Only require username.
      if (!profile.username) {
        throw new Error("Please set a username in your profile settings.");
      }

      const imageIds = Array.isArray(postData.imageIds) ? postData.imageIds : [];
      const imageMetadata = Array.isArray(postData.imageMetadata) ? postData.imageMetadata : [];
      const videoIds = Array.isArray(postData.videoIds) ? postData.videoIds : [];
      const videoMetadata = Array.isArray(postData.videoMetadata) ? postData.videoMetadata : [];

      const newPost = {
        user_id: user.id,
        content: postData.content || null,
        image_ids: imageIds,
        image_metadata: imageMetadata,
        video_ids: videoIds,
        video_metadata: videoMetadata,
        category: postData.category || "General",
        is_text_card: postData.is_text_card || false,
        text_card_metadata: postData.text_card_metadata || null,
        card_caption: postData.card_caption || null,
      };

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

      cacheService.invalidatePattern("posts");
      console.log("✅ Post created successfully:", data);
      return data;
    } catch (error) {
      console.error("❌ Failed to create post:", error);
      throw handleError(error, error.message || "Failed to create post");
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

      const { data: post, error: fetchError } = await supabase
        .from("posts")
        .select("user_id")
        .eq("id", postId)
        .single();

      if (fetchError) throw new Error("Post not found");
      if (post.user_id !== user.id) throw new Error("You can only update your own posts");

      const updateData = {
        ...updates,
        updated_at: new Date().toISOString(),
      };

      if (updates.imageIds !== undefined) {
        updateData.image_ids = Array.isArray(updates.imageIds) ? updates.imageIds : [];
        delete updateData.imageIds;
      }
      if (updates.imageMetadata !== undefined) {
        updateData.image_metadata = Array.isArray(updates.imageMetadata) ? updates.imageMetadata : [];
        delete updateData.imageMetadata;
      }
      if (updates.videoIds !== undefined) {
        updateData.video_ids = Array.isArray(updates.videoIds) ? updates.videoIds : [];
        delete updateData.videoIds;
      }
      if (updates.videoMetadata !== undefined) {
        updateData.video_metadata = Array.isArray(updates.videoMetadata) ? updates.videoMetadata : [];
        delete updateData.videoMetadata;
      }

      const { data, error } = await supabase
        .from("posts")
        .update(updateData)
        .eq("id", postId)
        .select()
        .single();

      if (error) throw error;

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
      console.log("🗑️ Attempting to delete post:", postId);

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        throw new Error("You must be logged in to delete a post");
      }

      console.log("✅ User authenticated:", user.id);

      // ── Verify ownership ────────────────────────────────────────────────
      const { data: post, error: fetchError } = await supabase
        .from("posts")
        .select("id, user_id, deleted_at")
        .eq("id", postId)
        .single(); // Don't filter deleted_at here so we can give better errors

      if (fetchError) {
        console.error("❌ Failed to fetch post for deletion:", fetchError);
        throw new Error("Post not found");
      }

      if (post.deleted_at) {
        // Already deleted - treat as success (idempotent)
        console.log("⚠️ Post already deleted");
        cacheService.invalidate(`post:${postId}`);
        cacheService.invalidatePattern("posts");
        return { success: true, postId };
      }

      if (post.user_id !== user.id) {
        console.error("❌ Ownership mismatch:", { post_owner: post.user_id, current_user: user.id });
        throw new Error("You can only delete your own posts");
      }

      // ── Soft delete ────────────────────────────────────────────────────
      const deleteTimestamp = new Date().toISOString();
      const { data: deletedPost, error: deleteError } = await supabase
        .from("posts")
        .update({ deleted_at: deleteTimestamp })
        .eq("id", postId)
        .eq("user_id", user.id)
        .select("id, deleted_at")
        .single();

      if (deleteError) {
        console.error("❌ Delete operation failed:", deleteError);
        throw deleteError;
      }

      console.log("✅ Post soft-deleted successfully:", deletedPost?.id);

      cacheService.invalidate(`post:${postId}`);
      cacheService.invalidatePattern("posts");

      return { success: true, deletedAt: deleteTimestamp, postId };
    } catch (error) {
      console.error("❌ Delete failed:", error);
      throw handleError(error, error.message || "Failed to delete post");
    }
  }

  // ==================== SHARE POST ====================

  async sharePost(postId, shareType = "external") {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      await supabase.from("shares").insert([{
        content_type: "post",
        content_id: postId,
        user_id: user.id,
        share_type: shareType,
      }]);

      const { data: post } = await supabase
        .from("posts")
        .select("shares")
        .eq("id", postId)
        .single();

      if (post) {
        await supabase
          .from("posts")
          .update({ shares: (post.shares || 0) + 1 })
          .eq("id", postId);
      }
    } catch (error) {
      console.error("Failed to record share:", error);
    }
  }

  // ==================== GET TOP INTERACTIONS ====================

  async getTopInteractions(userId, limit = 3) {
    try {
      // Get users this person has recently interacted with
      // via conversations (DMs)
      const { data: conversations } = await supabase
        .from("conversations")
        .select(`
          id,
          user1_id,
          user2_id,
          last_message_at
        `)
        .or(`user1_id.eq.${userId},user2_id.eq.${userId}`)
        .order("last_message_at", { ascending: false })
        .limit(limit);

      if (!conversations?.length) {
        // Fallback: get most recent followers
        const { data: follows } = await supabase
          .from("follows")
          .select(`
            following_id,
            profiles!follows_following_id_fkey(
              id,
              full_name,
              username,
              avatar_id,
              verified
            )
          `)
          .eq("follower_id", userId)
          .order("created_at", { ascending: false })
          .limit(limit);

        return (follows || []).map(f => f.profiles).filter(Boolean);
      }

      // Extract the OTHER user from each conversation
      const otherUserIds = conversations.map(c =>
        c.user1_id === userId ? c.user2_id : c.user1_id
      );

      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name, username, avatar_id, verified")
        .in("id", otherUserIds)
        .is("deleted_at", null);

      // Keep conversation order
      return otherUserIds
        .map(id => (profiles || []).find(p => p.id === id))
        .filter(Boolean);
    } catch (error) {
      console.error("Failed to get top interactions:", error);
      return [];
    }
  }

  // ==================== LIKE/UNLIKE POST ====================

  async toggleLike(postId) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("You must be logged in");

      const { data: existingLike } = await supabase
        .from("post_likes")
        .select("id")
        .eq("post_id", postId)
        .eq("user_id", user.id)
        .maybeSingle();

      if (existingLike) {
        await supabase.from("post_likes").delete().eq("id", existingLike.id);
        const { data: post } = await supabase.from("posts").select("likes").eq("id", postId).single();
        if (post) await supabase.from("posts").update({ likes: Math.max(0, (post.likes || 1) - 1) }).eq("id", postId);
        return { liked: false };
      } else {
        await supabase.from("post_likes").insert([{ post_id: postId, user_id: user.id }]);
        const { data: post } = await supabase.from("posts").select("likes").eq("id", postId).single();
        if (post) await supabase.from("posts").update({ likes: (post.likes || 0) + 1 }).eq("id", postId);
        return { liked: true };
      }
    } catch (error) {
      throw handleError(error, "Failed to toggle like");
    }
  }

  // ==================== INCREMENT VIEWS ====================

  async incrementViews(postId) {
    try {
      const { data: post } = await supabase.from("posts").select("views").eq("id", postId).single();
      if (post) await supabase.from("posts").update({ views: (post.views || 0) + 1 }).eq("id", postId);
    } catch (error) {
      console.error("Failed to increment views:", error);
    }
  }
}

const postService = new PostService();
export default postService;