// ============================================================================
// src/models/ShareModel.js - ENHANCED SHARE MODEL
// ============================================================================

import { supabase } from "../services/config/supabase";

class ShareModel {
  // Share content
  static async shareContent(
    contentType,
    contentId,
    userId,
    shareType = "profile",
  ) {
    try {
      // Validate content type
      const validTypes = ["post", "reel", "story", "profile"];
      if (!validTypes.includes(contentType)) {
        throw new Error("Invalid content type");
      }

      // Validate share type
      const validShareTypes = ["profile", "external", "direct", "story"];
      if (!validShareTypes.includes(shareType)) {
        throw new Error("Invalid share type");
      }

      // Create share record
      const { data: share, error: shareError } = await supabase
        .from("shares")
        .insert({
          content_type: contentType,
          content_id: contentId,
          user_id: userId,
          share_type: shareType,
        })
        .select()
        .single();

      if (shareError) throw shareError;

      // Update share count on the content
      const tableName = contentType === "profile" ? null : `${contentType}s`;

      if (tableName) {
        const { error: updateError } = await supabase.rpc("increment_shares", {
          table_name: tableName,
          row_id: contentId,
        });

        if (updateError) {
          console.error("Error updating share count:", updateError);
        }
      }

      // Award EP for sharing
      await supabase.rpc("award_ep", {
        p_user_id: userId,
        p_amount: 10,
        p_reason: "shared_content",
      });

      return { success: true, data: share };
    } catch (error) {
      console.error("Error sharing content:", error);
      return { success: false, error: error.message };
    }
  }

  // Get shares for content
  static async getSharesForContent(contentType, contentId) {
    try {
      const { data, error } = await supabase
        .from("shares")
        .select(
          `
          id,
          user_id,
          share_type,
          created_at,
          profiles!shares_user_id_fkey (
            id,
            full_name,
            username,
            avatar_id,
            verified
          )
        `,
        )
        .eq("content_type", contentType)
        .eq("content_id", contentId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error("Error getting shares:", error);
      return [];
    }
  }

  // Get share count for content
  static async getShareCount(contentType, contentId) {
    try {
      const { count, error } = await supabase
        .from("shares")
        .select("*", { count: "exact", head: true })
        .eq("content_type", contentType)
        .eq("content_id", contentId);

      if (error) throw error;
      return count || 0;
    } catch (error) {
      console.error("Error getting share count:", error);
      return 0;
    }
  }

  // Get user's shares
  static async getUserShares(userId, limit = 20) {
    try {
      const { data, error } = await supabase
        .from("shares")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(limit);

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error("Error getting user shares:", error);
      return [];
    }
  }

  // Delete share
  static async deleteShare(shareId, userId) {
    try {
      const { error } = await supabase
        .from("shares")
        .delete()
        .eq("id", shareId)
        .eq("user_id", userId);

      if (error) throw error;
      return { success: true };
    } catch (error) {
      console.error("Error deleting share:", error);
      return { success: false, error: error.message };
    }
  }

  // Check if user has shared content
  static async hasUserShared(userId, contentType, contentId) {
    try {
      const { data, error } = await supabase
        .from("shares")
        .select("id")
        .eq("user_id", userId)
        .eq("content_type", contentType)
        .eq("content_id", contentId)
        .maybeSingle();

      if (error && error.code !== "PGRST116") throw error;
      return !!data;
    } catch (error) {
      console.error("Error checking if user shared:", error);
      return false;
    }
  }
}

export default ShareModel;
