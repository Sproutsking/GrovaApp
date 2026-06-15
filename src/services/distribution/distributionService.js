// ============================================================================
// src/services/distribution/distributionService.js
// Xeevia Social Distribution System - Core orchestration engine
// ============================================================================

import { supabase } from "../config/supabase";
import { handleError } from "../shared/errorHandler";
import cacheService from "../shared/cacheService";
import platformAdapterFactory from "./platformAdapterFactory";

class DistributionService {
  // ── Get user's platform preferences ──────────────────────────────────────
  async getPlatformPreferences(userId) {
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
      console.error("Error fetching platform preferences:", error);
      return {
        user_id: userId,
        platform_preferences: {},
        global_default_enabled: true,
        auto_retry: true,
      };
    }
  }

  // ── Set user's platform preferences ──────────────────────────────────────
  async setPlatformPreferences(userId, preferences) {
    try {
      const { data, error } = await supabase
        .from("platform_distribution_preferences")
        .upsert({
          user_id: userId,
          platform_preferences: preferences.platform_preferences || {},
          global_default_enabled: preferences.global_default_enabled ?? true,
          auto_retry: preferences.auto_retry ?? true,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: "user_id",
        })
        .select()
        .single();

      if (error) throw error;

      cacheService.invalidate(`platform_prefs:${userId}`);
      return data;
    } catch (error) {
      throw handleError(error, "Failed to save platform preferences");
    }
  }

  // ── Get connected platforms for user ─────────────────────────────────────
  async getConnectedPlatforms(userId) {
    try {
      const { data, error } = await supabase
        .from("connections")
        .select("provider, auth_status")
        .eq("user_id", userId)
        .eq("auth_status", "active");

      if (error) throw error;

      return data.map(conn => conn.provider) || [];
    } catch (error) {
      console.error("Error fetching connected platforms:", error);
      return [];
    }
  }

  // ── Determine which platforms to publish to ──────────────────────────────
  async getPublishTargets(userId, selectedPlatforms, overrideDefaults = null) {
    try {
      const prefs = await this.getPlatformPreferences(userId);
      const connected = await this.getConnectedPlatforms(userId);

      let targets = [];

      // If user specified platforms, use those (one-time override)
      if (selectedPlatforms && selectedPlatforms.length > 0) {
        targets = selectedPlatforms.filter(p => connected.includes(p));
      }
      // Otherwise, use user's default preferences
      else if (prefs.global_default_enabled) {
        // Post to all connected platforms
        targets = connected;
      }
      // Or respect individual platform toggles
      else {
        targets = Object.keys(prefs.platform_preferences || {})
          .filter(platform => 
            prefs.platform_preferences[platform]?.enabled && 
            connected.includes(platform)
          );
      }

      return targets;
    } catch (error) {
      console.error("Error determining publish targets:", error);
      return [];
    }
  }

  // ── Main distribution pipeline: called after post creation ───────────────
  async distributePost(postId, userId, selectedPlatforms = null) {
    try {
      console.log(`📢 Starting distribution for post ${postId}`);

      // Get the post data
      const { data: post, error: postError } = await supabase
        .from("posts")
        .select("*")
        .eq("id", postId)
        .single();

      if (postError) throw new Error(`Post not found: ${postId}`);

      // Determine which platforms to publish to
      const targets = await this.getPublishTargets(userId, selectedPlatforms);
      console.log(`🎯 Publishing to platforms: ${targets.join(", ")}`);

      if (targets.length === 0) {
        console.log("ℹ️ No platforms selected for distribution");
        return { success: true, targets: [], message: "No platforms selected" };
      }

      // Create distribution queue entry
      const { data: queueEntry, error: queueError } = await supabase
        .from("distribution_queue")
        .insert({
          post_id: postId,
          user_id: userId,
          selected_platforms: targets,
          status: "processing",
        })
        .select()
        .single();

      if (queueError) throw queueError;

      // Initialize distribution records for each platform
      const distributionPromises = targets.map(platform =>
        supabase
          .from("post_distribution")
          .insert({
            post_id: postId,
            user_id: userId,
            platform,
            status: "pending",
          })
          .select()
          .single()
      );

      await Promise.all(distributionPromises);

      // Publish to each platform (parallel execution)
      const publishResults = await Promise.allSettled(
        targets.map(platform =>
          this.publishToSinglePlatform(postId, userId, post, platform)
        )
      );

      // Summarize results
      const results = publishResults.map((result, idx) => ({
        platform: targets[idx],
        status: result.status,
        error: result.reason?.message,
      }));

      // Update queue status
      const hasFailures = results.some(r => r.status === "rejected");
      await supabase
        .from("distribution_queue")
        .update({
          status: hasFailures ? "failed" : "completed",
          processed_at: new Date().toISOString(),
        })
        .eq("id", queueEntry.id);

      console.log(`✅ Distribution complete:`, results);
      return { success: !hasFailures, targets, results };
    } catch (error) {
      console.error("❌ Distribution error:", error);
      throw handleError(error, "Failed to distribute post");
    }
  }

  // ── Publish to a single platform ─────────────────────────────────────────
  async publishToSinglePlatform(postId, userId, post, platform) {
    try {
      console.log(`📤 Publishing to ${platform}...`);

      // Get platform adapter
      const adapter = platformAdapterFactory.getAdapter(platform);
      if (!adapter) throw new Error(`No adapter for platform: ${platform}`);

      // Get user's connection for this platform
      const { data: connection, error: connError } = await supabase
        .from("connections")
        .select("id, provider, platform_user_id")
        .eq("user_id", userId)
        .eq("provider", platform)
        .single();

      if (connError) throw new Error(`Not connected to ${platform}`);

      // Get encrypted token
      const { data: tokenData, error: tokenError } = await supabase
        .from("tokens")
        .select("encrypted_token, expires_at")
        .eq("connection_id", connection.id)
        .eq("revoked", false)
        .single();

      if (tokenError) throw new Error(`No valid token for ${platform}`);

      // Attempt to publish
      let externalPostId;
      let success = false;

      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          externalPostId = await adapter.publishPost(
            tokenData.encrypted_token,
            post,
            connection.platform_user_id
          );
          success = true;
          break;
        } catch (error) {
          console.warn(`⚠️ Attempt ${attempt} failed for ${platform}:`, error.message);
          if (attempt < 3) {
            // Exponential backoff
            await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, attempt - 1)));
          }
        }
      }

      if (success) {
        // Update distribution record
        await supabase
          .from("post_distribution")
          .update({
            status: "success",
            external_post_id: externalPostId,
            published_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("post_id", postId)
          .eq("platform", platform);

        console.log(`✅ Published to ${platform} (ID: ${externalPostId})`);
        return { platform, status: "success", externalPostId };
      } else {
        // Generate fallback deep link
        const deepLink = await this.generateDeepLink(platform, post);

        await supabase
          .from("post_distribution")
          .update({
            status: "failed",
            error_message: "API publishing failed, fallback to deep link",
            updated_at: new Date().toISOString(),
          })
          .eq("post_id", postId)
          .eq("platform", platform);

        return {
          platform,
          status: "fallback",
          deepLink,
          message: `Publishing failed, use manual posting link`,
        };
      }
    } catch (error) {
      console.error(`❌ Error publishing to ${platform}:`, error);

      // Update distribution record with error
      await supabase
        .from("post_distribution")
        .update({
          status: "failed",
          error_message: error.message,
          retry_count: 0,
          updated_at: new Date().toISOString(),
        })
        .eq("post_id", postId)
        .eq("platform", platform)
        .catch(e => console.error("Failed to update distribution record:", e));

      throw error;
    }
  }

  // ── Generate platform-specific deep link for manual posting ──────────────
  async generateDeepLink(platform, post) {
    try {
      const adapter = platformAdapterFactory.getAdapter(platform);
      if (!adapter) throw new Error(`No adapter for platform: ${platform}`);

      const deepLink = adapter.generateDeepLink(post);
      return deepLink;
    } catch (error) {
      console.error(`Error generating deep link for ${platform}:`, error);
      return null;
    }
  }

  // ── Get distribution status for a post ────────────────────────────────────
  async getDistributionStatus(postId) {
    try {
      const { data, error } = await supabase
        .from("post_distribution")
        .select("*")
        .eq("post_id", postId);

      if (error) throw error;

      const summary = {
        total: data.length,
        successful: data.filter(d => d.status === "success").length,
        failed: data.filter(d => d.status === "failed").length,
        pending: data.filter(d => d.status === "pending").length,
        byPlatform: {},
      };

      data.forEach(dist => {
        summary.byPlatform[dist.platform] = {
          status: dist.status,
          externalPostId: dist.external_post_id,
          publishedAt: dist.published_at,
          error: dist.error_message,
        };
      });

      return summary;
    } catch (error) {
      console.error("Error fetching distribution status:", error);
      return null;
    }
  }

  // ── Retry failed distributions ───────────────────────────────────────────
  async retryFailedDistribution(postId, platform) {
    try {
      const { data: post } = await supabase
        .from("posts")
        .select("*")
        .eq("id", postId)
        .single();

      const { data: dist } = await supabase
        .from("post_distribution")
        .select("user_id")
        .eq("post_id", postId)
        .eq("platform", platform)
        .single();

      if (!post || !dist) throw new Error("Post or distribution record not found");

      // Reset to pending and retry
      await supabase
        .from("post_distribution")
        .update({
          status: "pending",
          retry_count: 0,
          error_message: null,
        })
        .eq("post_id", postId)
        .eq("platform", platform);

      return await this.publishToSinglePlatform(postId, dist.user_id, post, platform);
    } catch (error) {
      throw handleError(error, "Failed to retry distribution");
    }
  }
}

export default new DistributionService();
