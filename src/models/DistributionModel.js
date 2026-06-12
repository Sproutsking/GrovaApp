// ============================================================================
// src/models/DistributionModel.js
// Data model for cross-platform post distribution
// ============================================================================

import { supabase } from "../services/config/supabase";
import { handleError } from "../services/shared/errorHandler";

class DistributionModel {
  // ── Get distribution record for a post on a specific platform ─────────────
  async getDistributionRecord(postId, platform) {
    try {
      const { data, error } = await supabase
        .from("post_distribution")
        .select("*")
        .eq("post_id", postId)
        .eq("platform", platform)
        .single();

      if (error && error.code !== "PGRST116") throw error; // 116 = no rows
      return data;
    } catch (error) {
      throw handleError(error, "Failed to fetch distribution record");
    }
  }

  // ── Get all distribution records for a post ───────────────────────────────
  async getPostDistributions(postId) {
    try {
      const { data, error } = await supabase
        .from("post_distribution")
        .select("*")
        .eq("post_id", postId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      throw handleError(error, "Failed to fetch post distributions");
    }
  }

  // ── Get user's distribution history ──────────────────────────────────────
  async getUserDistributionHistory(userId, limit = 50) {
    try {
      const { data, error } = await supabase
        .from("post_distribution")
        .select(`
          *,
          posts!inner(id, content, created_at)
        `)
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(limit);

      if (error) throw error;
      return data || [];
    } catch (error) {
      throw handleError(error, "Failed to fetch distribution history");
    }
  }

  // ── Create distribution record ───────────────────────────────────────────
  async createDistributionRecord(postId, userId, platform, externalPostId = null) {
    try {
      const { data, error } = await supabase
        .from("post_distribution")
        .insert({
          post_id: postId,
          user_id: userId,
          platform,
          external_post_id: externalPostId,
          status: "pending",
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      throw handleError(error, "Failed to create distribution record");
    }
  }

  // ── Update distribution status ───────────────────────────────────────────
  async updateDistributionStatus(postId, platform, status, data = {}) {
    try {
      const update = {
        status,
        updated_at: new Date().toISOString(),
        ...data,
      };

      const { data: result, error } = await supabase
        .from("post_distribution")
        .update(update)
        .eq("post_id", postId)
        .eq("platform", platform)
        .select()
        .single();

      if (error) throw error;
      return result;
    } catch (error) {
      throw handleError(error, "Failed to update distribution status");
    }
  }

  // ── Mark distribution as successful ──────────────────────────────────────
  async markSuccess(postId, platform, externalPostId) {
    return this.updateDistributionStatus(postId, platform, "success", {
      external_post_id: externalPostId,
      published_at: new Date().toISOString(),
    });
  }

  // ── Mark distribution as failed ──────────────────────────────────────────
  async markFailed(postId, platform, errorMessage, retryCount = 0) {
    return this.updateDistributionStatus(postId, platform, "failed", {
      error_message: errorMessage,
      retry_count: retryCount,
    });
  }

  // ── Get platform preferences for user ────────────────────────────────────
  async getPreferences(userId) {
    try {
      const { data, error } = await supabase
        .from("platform_distribution_preferences")
        .select("*")
        .eq("user_id", userId)
        .single();

      if (error && error.code !== "PGRST116") throw error; // 116 = no rows

      return data || {
        user_id: userId,
        platform_preferences: {},
        global_default_enabled: true,
        auto_retry: true,
      };
    } catch (error) {
      throw handleError(error, "Failed to fetch preferences");
    }
  }

  // ── Save platform preferences ────────────────────────────────────────────
  async savePreferences(userId, preferences) {
    try {
      const { data, error } = await supabase
        .from("platform_distribution_preferences")
        .upsert({
          user_id: userId,
          ...preferences,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: "user_id",
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      throw handleError(error, "Failed to save preferences");
    }
  }

  // ── Add to distribution queue ────────────────────────────────────────────
  async queueForDistribution(postId, userId, selectedPlatforms) {
    try {
      const { data, error } = await supabase
        .from("distribution_queue")
        .insert({
          post_id: postId,
          user_id: userId,
          selected_platforms: selectedPlatforms,
          status: "pending",
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      throw handleError(error, "Failed to queue for distribution");
    }
  }

  // ── Get pending distribution jobs ────────────────────────────────────────
  async getPendingJobs(limit = 100) {
    try {
      const { data, error } = await supabase
        .from("distribution_queue")
        .select("*")
        .eq("status", "pending")
        .order("created_at", { ascending: true })
        .limit(limit);

      if (error) throw error;
      return data || [];
    } catch (error) {
      throw handleError(error, "Failed to fetch pending jobs");
    }
  }

  // ── Update queue job status ──────────────────────────────────────────────
  async updateQueueStatus(queueId, status, errorDetails = null) {
    try {
      const { data, error } = await supabase
        .from("distribution_queue")
        .update({
          status,
          processed_at: status === "completed" ? new Date().toISOString() : null,
          error_details: errorDetails,
        })
        .eq("id", queueId)
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      throw handleError(error, "Failed to update queue status");
    }
  }

  // ── Get failed distributions by platform ─────────────────────────────────
  async getFailedDistributions(userId, platform, limit = 20) {
    try {
      const { data, error } = await supabase
        .from("post_distribution")
        .select("*")
        .eq("user_id", userId)
        .eq("platform", platform)
        .eq("status", "failed")
        .order("updated_at", { ascending: false })
        .limit(limit);

      if (error) throw error;
      return data || [];
    } catch (error) {
      throw handleError(error, "Failed to fetch failed distributions");
    }
  }

  // ── Get distribution statistics for user ─────────────────────────────────
  async getDistributionStats(userId, startDate = null, endDate = null) {
    try {
      let query = supabase
        .from("post_distribution")
        .select("platform, status, count")
        .eq("user_id", userId);

      if (startDate) {
        query = query.gte("created_at", startDate.toISOString());
      }

      if (endDate) {
        query = query.lte("created_at", endDate.toISOString());
      }

      const { data, error } = await query;

      if (error) throw error;

      // Aggregate stats
      const stats = {
        total: 0,
        byPlatform: {},
        byStatus: {},
      };

      data?.forEach(row => {
        stats.total++;
        
        if (!stats.byPlatform[row.platform]) {
          stats.byPlatform[row.platform] = { success: 0, failed: 0, pending: 0 };
        }
        stats.byPlatform[row.platform][row.status]++;

        if (!stats.byStatus[row.status]) {
          stats.byStatus[row.status] = 0;
        }
        stats.byStatus[row.status]++;
      });

      return stats;
    } catch (error) {
      throw handleError(error, "Failed to fetch distribution stats");
    }
  }
}

export default new DistributionModel();
