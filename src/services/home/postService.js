// ============================================================================
// src/services/home/postService.js — v3 PUSH NOTIFICATIONS ADDED
// ============================================================================
// CHANGES vs v2:
//   [PUSH-1] toggleLike() sends push to post owner when liked.
//            Does NOT push on unlike. Does NOT push if liker === owner.
//   [PUSH-2] sharePost() sends push to post owner when shared.
//   [PUSH-3] createPost() sends push to followers — skipped here since
//            follower fan-out is expensive; handled by notificationService
//            realtime INSERT which already fires for new_post type.
//   All v2 optimistic/bulletproof fixes preserved exactly.
// ============================================================================

import { supabase } from "../config/supabase";
import { handleError } from "../shared/errorHandler";
import cacheService from "../shared/cacheService";
import pushService from "../notifications/pushService";

// ── Push helper — never throws ────────────────────────────────────────────────
async function _sendPush(params) {
  try {
    await pushService.sendPushToUser(params);
  } catch (e) {
    console.warn("[PostService] push failed (non-fatal):", e?.message);
  }
}

// ── Fetch post owner id ───────────────────────────────────────────────────────
async function _getPostOwner(postId) {
  try {
    const { data } = await supabase
      .from("posts")
      .select("user_id, profiles!inner(full_name, username)")
      .eq("id", postId)
      .single();
    return data;
  } catch {
    return null;
  }
}

class PostService {
  // ── getPosts ────────────────────────────────────────────────────────────
  async getPosts(filters = {}, offset = 0, limit = 20) {
    try {
      const { userId = null, category = null } = filters;

      const cacheKey = `posts:${userId || "all"}:${category || "all"}:${offset}:${limit}`;
      const cached = cacheService.get(cacheKey);
      if (cached) return cached;

      let query = supabase
        .from("posts")
        .select(
          `id, user_id, content, image_ids, image_metadata, video_ids, video_metadata,
           category, likes, comments_count, shares, views, created_at,
           is_text_card, text_card_metadata, card_caption,
           profiles!inner(id, full_name, username, avatar_id, verified)`
        )
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .range(offset, offset + limit - 1);

      if (userId && typeof userId === "string") query = query.eq("user_id", userId);
      if (category) query = query.eq("category", category);

      const { data, error } = await query;

      if (error) {
        console.error("[PostService] getPosts error:", error.message);
        return [];
      }

      const result = data || [];
      cacheService.set(cacheKey, result, 300000);
      return result;
    } catch (error) {
      console.error("[PostService] getPosts exception:", error.message);
      return [];
    }
  }

  // ── getPost ──────────────────────────────────────────────────────────────
  async getPost(postId) {
    try {
      const cacheKey = `post:${postId}`;
      const cached = cacheService.get(cacheKey);
      if (cached) return cached;

      const { data, error } = await supabase
        .from("posts")
        .select(`*, profiles!inner(id, full_name, username, avatar_id, verified)`)
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

  // ── createPost ───────────────────────────────────────────────────────────
  async createPost(postData) {
    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) throw new Error("You must be logged in to create a post");

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("id, full_name, username, account_status")
        .eq("id", user.id)
        .single();

      if (profileError || !profile) throw new Error("Profile not found. Please refresh the page.");
      if (profile.account_status === "suspended") throw new Error("Your account is suspended.");
      if (!profile.username) throw new Error("Please set a username in your profile settings.");

      const newPost = {
        user_id:            user.id,
        content:            postData.content || null,
        image_ids:          Array.isArray(postData.imageIds)      ? postData.imageIds      : [],
        image_metadata:     Array.isArray(postData.imageMetadata) ? postData.imageMetadata : [],
        video_ids:          Array.isArray(postData.videoIds)      ? postData.videoIds      : [],
        video_metadata:     Array.isArray(postData.videoMetadata) ? postData.videoMetadata : [],
        category:           postData.category || "General",
        is_text_card:       postData.is_text_card || false,
        text_card_metadata: postData.text_card_metadata || null,
        card_caption:       postData.card_caption || null,
      };

      const { data, error } = await supabase
        .from("posts")
        .insert([newPost])
        .select(`*, profiles!inner(id, full_name, username, avatar_id, verified)`)
        .single();

      if (error) throw new Error(error.message || "Failed to create post");

      this._safeInvalidate("posts");
      return data;
    } catch (error) {
      throw new Error(error.message || "Failed to create post");
    }
  }

  // ── updatePost ───────────────────────────────────────────────────────────
  async updatePost(postId, updates) {
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) throw new Error("You must be logged in to update a post");

      const { data: post, error: fetchError } = await supabase
        .from("posts").select("user_id").eq("id", postId).single();
      if (fetchError) throw new Error("Post not found");
      if (post.user_id !== user.id) throw new Error("You can only update your own posts");

      const updateData = { ...updates, updated_at: new Date().toISOString() };

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
        .from("posts").update(updateData).eq("id", postId).select().single();
      if (error) throw error;

      this._safeInvalidate(`post:${postId}`);
      this._safeInvalidate("posts");
      return data;
    } catch (error) {
      throw handleError(error, "Failed to update post");
    }
  }

  // ── deletePost ───────────────────────────────────────────────────────────
  async deletePost(postId) {
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) throw new Error("You must be logged in to delete a post");

      const { data: post, error: fetchError } = await supabase
        .from("posts")
        .select("id, user_id, deleted_at")
        .eq("id", postId)
        .single();

      if (fetchError) throw new Error("Post not found");

      if (post.deleted_at) {
        this._safeInvalidate(`post:${postId}`);
        this._safeInvalidate("posts");
        return { success: true, postId };
      }

      if (post.user_id !== user.id) throw new Error("You can only delete your own posts");

      const deleteTimestamp = new Date().toISOString();
      const { error: deleteError } = await supabase
        .from("posts")
        .update({ deleted_at: deleteTimestamp })
        .eq("id", postId)
        .eq("user_id", user.id);

      if (deleteError) throw deleteError;

      this._safeInvalidate(`post:${postId}`);
      this._safeInvalidate("posts");
      return { success: true, deletedAt: deleteTimestamp, postId };
    } catch (error) {
      throw handleError(error, error.message || "Failed to delete post");
    }
  }

  // ── sharePost ────────────────────────────────────────────────────────────
  // [PUSH-2] Sends push to post owner on share
  async sharePost(postId, shareType = "external") {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      await supabase.from("shares").insert([{
        content_type: "post", content_id: postId, user_id: user.id, share_type: shareType,
      }]);

      await supabase.rpc("increment_post_shares", { p_post_id: postId }).catch(async () => {
        const { data: p } = await supabase.from("posts").select("shares").eq("id", postId).single();
        if (p) await supabase.from("posts").update({ shares: (p.shares || 0) + 1 }).eq("id", postId);
      });

      // [PUSH-2] Push to post owner
      const postData = await _getPostOwner(postId);
      if (postData && postData.user_id !== user.id) {
        const { data: sharer } = await supabase
          .from("profiles")
          .select("full_name, username")
          .eq("id", user.id)
          .single();
        const sharerName = sharer?.full_name || sharer?.username || "Someone";

        _sendPush({
          recipientUserId: postData.user_id,
          actorUserId:     user.id,
          type:            "share",
          title:           "New share",
          message:         `${sharerName} shared your post`,
          entityId:        postId,
          metadata: {
            notification_id: `share_${postId}_${user.id}_${Date.now()}`,
            actorName:       sharerName,
            url:             `/post/${postId}`,
          },
        });
      }
    } catch (error) {
      console.error("[PostService] sharePost error:", error);
    }
  }

  // ── toggleLike ───────────────────────────────────────────────────────────
  // [PUSH-1] Sends push to post owner on like (not on unlike)
  async toggleLike(postId) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("You must be logged in");

      const { data: existingLike, error: checkError } = await supabase
        .from("post_likes")
        .select("id")
        .eq("post_id", postId)
        .eq("user_id", user.id)
        .maybeSingle();

      if (checkError) {
        console.error("[PostService] toggleLike check error:", checkError.message);
        return { liked: false, error: checkError.message };
      }

      if (existingLike) {
        // Unlike — no push on unlike
        const { error: delError } = await supabase
          .from("post_likes")
          .delete()
          .eq("id", existingLike.id);

        if (delError) {
          console.error("[PostService] unlike error:", delError.message);
          return { liked: true, error: delError.message };
        }

        await supabase.rpc("decrement_post_likes", { p_post_id: postId }).catch(async () => {
          const { data: p } = await supabase.from("posts").select("likes").eq("id", postId).single();
          if (p) {
            await supabase
              .from("posts")
              .update({ likes: Math.max(0, (p.likes || 1) - 1) })
              .eq("id", postId);
          }
        });
        return { liked: false };

      } else {
        // Like
        const { error: insError } = await supabase
          .from("post_likes")
          .insert([{ post_id: postId, user_id: user.id }]);

        if (insError) {
          if (insError.code === "23505") return { liked: true };
          console.error("[PostService] like insert error:", insError.message);
          return { liked: false, error: insError.message };
        }

        await supabase.rpc("increment_post_likes", { p_post_id: postId }).catch(async () => {
          const { data: p } = await supabase.from("posts").select("likes").eq("id", postId).single();
          if (p) {
            await supabase
              .from("posts")
              .update({ likes: (p.likes || 0) + 1 })
              .eq("id", postId);
          }
        });

        // [PUSH-1] Push to post owner (never to self)
        const postData = await _getPostOwner(postId);
        if (postData && postData.user_id !== user.id) {
          const { data: liker } = await supabase
            .from("profiles")
            .select("full_name, username")
            .eq("id", user.id)
            .single();
          const likerName = liker?.full_name || liker?.username || "Someone";

          _sendPush({
            recipientUserId: postData.user_id,
            actorUserId:     user.id,
            type:            "like",
            title:           "New like",
            message:         `${likerName} liked your post`,
            entityId:        postId,
            metadata: {
              notification_id: `like_post_${postId}_${user.id}`,
              actorName:       likerName,
              url:             `/post/${postId}`,
            },
          });
        }

        return { liked: true };
      }
    } catch (error) {
      console.error("[PostService] toggleLike exception:", error.message);
      throw handleError(error, "Failed to toggle like");
    }
  }

  // ── incrementViews ───────────────────────────────────────────────────────
  incrementViews(postId) {
    supabase.rpc("increment_post_views", { p_post_id: postId }).catch(() => {
      supabase
        .from("posts")
        .select("views")
        .eq("id", postId)
        .single()
        .then(({ data: p }) => {
          if (p) {
            supabase
              .from("posts")
              .update({ views: (p.views || 0) + 1 })
              .eq("id", postId)
              .then(() => {})
              .catch(() => {});
          }
        })
        .catch(() => {});
    });
  }

  // ── getTopInteractions ───────────────────────────────────────────────────
  async getTopInteractions(userId, limit = 3) {
    try {
      const { data: conversations } = await supabase
        .from("conversations")
        .select("id, user1_id, user2_id, last_message_at")
        .or(`user1_id.eq.${userId},user2_id.eq.${userId}`)
        .order("last_message_at", { ascending: false })
        .limit(limit);

      if (!conversations?.length) {
        const { data: follows } = await supabase
          .from("follows")
          .select(
            `following_id,
             profiles!follows_following_id_fkey(id, full_name, username, avatar_id, verified)`
          )
          .eq("follower_id", userId)
          .order("created_at", { ascending: false })
          .limit(limit);
        return (follows || []).map((f) => f.profiles).filter(Boolean);
      }

      const otherUserIds = conversations.map((c) =>
        c.user1_id === userId ? c.user2_id : c.user1_id
      );
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name, username, avatar_id, verified")
        .in("id", otherUserIds)
        .is("deleted_at", null);

      return otherUserIds
        .map((id) => (profiles || []).find((p) => p.id === id))
        .filter(Boolean);
    } catch (error) {
      console.error("[PostService] getTopInteractions:", error);
      return [];
    }
  }

  // ── Private helpers ──────────────────────────────────────────────────────
  _safeInvalidate(key) {
    try {
      if (key.includes(":")) cacheService.invalidate(key);
      else cacheService.invalidatePattern(key);
    } catch { /* never throw */ }
  }
}

const postService = new PostService();
export default postService;