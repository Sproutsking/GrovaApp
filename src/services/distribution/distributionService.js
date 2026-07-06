// src/services/distribution/distributionService.js
// ============================================================================
// Xeevia Social Distribution Service — v2 PRECISE FIX
//
// ROOT CAUSES FIXED:
//
// [BUG-A] getPlatformPreferences() called .single() which throws PGRST116
//   when no row exists for a new user. New users ALWAYS have no row. This
//   caused PlatformSelector to crash on load for every first-time user.
//   Fix: use .maybeSingle() + safe default. Also wrapped in try/catch so a
//   missing table (42P01) returns safe defaults instead of throwing.
//
// [BUG-B] getConnectedPlatforms() did not guard against the connections table
//   having RLS restrictions or not existing. Now returns [] on any error.
//
// [BUG-C] distributePost(postId, userId, selectedPlatforms) — the calling
//   code in useDistribution passed only postId. The userId is now optional
//   in this function signature and is resolved internally from the post row
//   when not supplied. This makes the hook call site simpler and correct.
//
// [BUG-D] publishToSinglePlatform fetched the tokens table with .single()
//   which throws if 0 rows. Changed to .maybeSingle() with explicit guard.
//
// All existing logic preserved. New: distributePost accepts (postId) with
// userId resolved from the post row, or (postId, userId) explicitly.
// ============================================================================

import { supabase } from "../config/supabase";

// Safe error handler — keeps service from swallowing useful errors
const handleError = (err, msg) => {
  const e = new Error(`${msg}: ${err?.message || String(err)}`);
  e.original = err;
  return e;
};

// Safe timeout wrapper — if requestUtils isn't available, just return promise
const withTimeout = (() => {
  try {
    return require("../shared/requestUtils").default;
  } catch {
    return (p) => p;
  }
})();

// Safe cache service — no-op if unavailable
const cache = (() => {
  try {
    return require("../shared/cacheService").default;
  } catch {
    return { invalidate: () => {} };
  }
})();

// Platform adapter factory — no-op adapter if unavailable
const adapters = (() => {
  try {
    return require("./platformAdapterFactory").default;
  } catch {
    return { getAdapter: () => null, getSupportedPlatforms: () => [] };
  }
})();

// ── Safe default preferences (used when table missing or user has no row) ────
const DEFAULT_PREFS = {
  platform_preferences: {},
  global_default_enabled: true,
  auto_retry: true,
};

class DistributionService {

  // ── Platform preferences ──────────────────────────────────────────────────
  async getPlatformPreferences(userId) {
    try {
      // [BUG-A FIX] .maybeSingle() instead of .single() — returns null (not error)
      // when no row exists. This is the correct pattern for optional singleton rows.
      const { data, error } = await withTimeout(
        supabase
          .from("platform_distribution_preferences")
          .select("*")
          .eq("user_id", userId)
          .maybeSingle(),
        10000
      );

      // Table doesn't exist yet → silently return defaults
      if (error?.code === "42P01") return { ...DEFAULT_PREFS, user_id: userId };
      // Any other error → log and return defaults (don't crash callers)
      if (error) {
        console.warn("[DistributionService] getPlatformPreferences:", error.message);
        return { ...DEFAULT_PREFS, user_id: userId };
      }
      // No row yet (new user) → return defaults
      if (!data) return { ...DEFAULT_PREFS, user_id: userId };

      return data;
    } catch (err) {
      console.warn("[DistributionService] getPlatformPreferences exception:", err?.message);
      return { ...DEFAULT_PREFS, user_id: userId };
    }
  }

  // ── Save platform preferences ─────────────────────────────────────────────
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
        }, { onConflict: "user_id" })
        .select()
        .single();

      if (error) throw error;
      cache.invalidate(`platform_prefs:${userId}`);
      return data;
    } catch (err) {
      throw handleError(err, "Failed to save platform preferences");
    }
  }

  // ── Get active connected platforms ────────────────────────────────────────
  // [BUG-B FIX] Any error returns [] so callers always get an array.
  async getConnectedPlatforms(userId) {
    try {
      const { data, error } = await withTimeout(
        supabase
          .from("connections")
          .select("provider, auth_status")
          .eq("user_id", userId)
          .eq("auth_status", "active"),
        10000
      );

      if (error?.code === "42P01") return []; // table not yet created
      if (error) {
        console.warn("[DistributionService] getConnectedPlatforms:", error.message);
        return [];
      }
      return (data || []).map(c => c.provider);
    } catch (err) {
      console.warn("[DistributionService] getConnectedPlatforms exception:", err?.message);
      return [];
    }
  }

  // ── Determine which platforms to target ───────────────────────────────────
  async getPublishTargets(userId, selectedPlatforms) {
    try {
      const [prefs, connected] = await Promise.all([
        this.getPlatformPreferences(userId),
        this.getConnectedPlatforms(userId),
      ]);

      // User explicitly chose platforms → intersect with connected
      if (selectedPlatforms && selectedPlatforms.length > 0) {
        return selectedPlatforms.filter(p => connected.includes(p));
      }

      // Global default: post to everything connected
      if (prefs.global_default_enabled) {
        return connected;
      }

      // Per-platform toggles
      return Object.keys(prefs.platform_preferences || {})
        .filter(p => prefs.platform_preferences[p]?.enabled && connected.includes(p));
    } catch (err) {
      console.warn("[DistributionService] getPublishTargets:", err?.message);
      return [];
    }
  }

  // ── Main distribution pipeline ────────────────────────────────────────────
  // [BUG-C FIX] userId is now optional — resolved from post row when omitted.
  // This matches how useDistribution calls: distribution.distributePost(postId)
  async distributePost(postId, userId = null, selectedPlatforms = null) {
    try {
      console.log(`[Distribution] Starting for post ${postId}`);

      // Fetch post (also resolves userId if not provided)
      const { data: post, error: postError } = await withTimeout(
        supabase.from("posts").select("*").eq("id", postId).single(),
        12000
      );
      if (postError) throw new Error(`Post not found: ${postId}`);

      // Resolve userId from post if not explicitly provided
      const resolvedUserId = userId || post.user_id;
      if (!resolvedUserId) throw new Error("Cannot distribute: no user_id available");

      const targets = await this.getPublishTargets(resolvedUserId, selectedPlatforms);
      console.log(`[Distribution] Targets: ${targets.join(", ") || "none"}`);

      if (targets.length === 0) {
        return { success: true, targets: [], message: "No platforms targeted" };
      }

      // Create queue entry (soft-fail if table missing)
      let queueId = null;
      try {
        const { data: queueEntry, error: queueError } = await withTimeout(
          supabase
            .from("distribution_queue")
            .insert({
              post_id: postId,
              user_id: resolvedUserId,
              selected_platforms: targets,
              status: "processing",
            })
            .select()
            .single(),
          10000
        );
        if (!queueError && queueEntry) queueId = queueEntry.id;
      } catch (e) {
        console.warn("[Distribution] Queue insert failed (non-fatal):", e?.message);
      }

      // Init distribution records
      await Promise.allSettled(
        targets.map(platform =>
          supabase.from("post_distribution").insert({
            post_id: postId,
            user_id: resolvedUserId,
            platform,
            status: "pending",
          })
        )
      );

      // Publish in parallel
      const results = await Promise.allSettled(
        targets.map(platform =>
          this._publishToSinglePlatform(postId, resolvedUserId, post, platform)
        )
      );

      const summary = results.map((r, i) => ({
        platform: targets[i],
        ok: r.status === "fulfilled",
        error: r.reason?.message,
      }));

      // Update queue status
      if (queueId) {
        const hasFailures = summary.some(s => !s.ok);
        await supabase
          .from("distribution_queue")
          .update({
            status: hasFailures ? "partial" : "completed",
            processed_at: new Date().toISOString(),
          })
          .eq("id", queueId)
          .catch(() => {});
      }

      console.log("[Distribution] Complete:", summary);
      return {
        success: summary.every(s => s.ok),
        targets,
        results: summary,
      };
    } catch (err) {
      console.error("[Distribution] Fatal error:", err);
      throw handleError(err, "Failed to distribute post");
    }
  }

  // ── Publish to a single platform ──────────────────────────────────────────
  async _publishToSinglePlatform(postId, userId, post, platform) {
    try {
      try {
        const { data, error } = await withTimeout(
          supabase.functions.invoke("publish-platform", { body: { postId, platform } }),
          20000
        );

        if (!error && data?.ok) {
          await supabase
            .from("post_distribution")
            .update({
              status: "success",
              external_post_id: data.externalId || null,
              published_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq("post_id", postId)
            .eq("platform", platform)
            .catch(() => {});

          return { platform, status: "success", externalId: data.externalId || null, verified: data.verified || false, ...data };
        }

        if (error) {
          console.warn(`[Distribution] publish-platform edge failed for ${platform}:`, error.message || error);
        } else if (data?.ok === false) {
          console.warn(`[Distribution] publish-platform edge returned failure for ${platform}:`, data.error);
        }
      } catch (fnErr) {
        console.warn(`[Distribution] publish-platform edge unavailable for ${platform}:`, fnErr?.message || fnErr);
      }

      const adapter = adapters.getAdapter(platform);
      if (!adapter) throw new Error(`No adapter for: ${platform}`);

      // Get connection
      const { data: conn, error: connErr } = await withTimeout(
        supabase
          .from("connections")
          .select("id, provider, platform_user_id")
          .eq("user_id", userId)
          .eq("provider", platform)
          .maybeSingle(),
        10000
      );
      if (connErr || !conn) throw new Error(`Not connected to ${platform}`);

      // [BUG-D FIX] .maybeSingle() + guard instead of .single()
      const { data: tokenRow, error: tokenErr } = await withTimeout(
        supabase
          .from("tokens")
          .select("encrypted_token, expires_at")
          .eq("connection_id", conn.id)
          .eq("revoked", false)
          .maybeSingle(),
        10000
      );
      if (tokenErr || !tokenRow) throw new Error(`No valid token for ${platform}`);

      // Publish with retry (exponential backoff)
      let externalId = null;
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          externalId = await adapter.publishPost(
            tokenRow.encrypted_token,
            post,
            conn.platform_user_id
          );
          break;
        } catch (e) {
          console.warn(`[Distribution] ${platform} attempt ${attempt}/3:`, e.message);
          if (attempt < 3) {
            await new Promise(r => setTimeout(r, 800 * Math.pow(2, attempt - 1)));
          }
        }
      }

      if (externalId) {
        await supabase
          .from("post_distribution")
          .update({
            status: "success",
            external_post_id: externalId,
            published_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("post_id", postId)
          .eq("platform", platform);

        return { platform, status: "success", externalId };
      }

      // All retries failed — generate deep link as fallback
      const deepLink = await this.generateDeepLink(platform, post).catch(() => null);
      await supabase
        .from("post_distribution")
        .update({
          status: "failed",
          error_message: "All publish attempts failed; deep link generated",
          updated_at: new Date().toISOString(),
        })
        .eq("post_id", postId)
        .eq("platform", platform)
        .catch(() => {});

      return { platform, status: "fallback", deepLink };
    } catch (err) {
      await supabase
        .from("post_distribution")
        .update({
          status: "failed",
          error_message: err.message,
          updated_at: new Date().toISOString(),
        })
        .eq("post_id", postId)
        .eq("platform", platform)
        .catch(() => {});

      throw err;
    }
  }

  // ── Deep link fallback ────────────────────────────────────────────────────
  async generateDeepLink(platform, post) {
    try {
      const adapter = adapters.getAdapter(platform);
      return adapter ? adapter.generateDeepLink(post) : null;
    } catch {
      return null;
    }
  }

  // ── Get distribution status for a post ───────────────────────────────────
  async getDistributionStatus(postId) {
    try {
      const { data, error } = await supabase
        .from("post_distribution")
        .select("*")
        .eq("post_id", postId);

      if (error) throw error;
      if (!data || data.length === 0) return null;

      const byPlatform = {};
      data.forEach(d => {
        byPlatform[d.platform] = {
          status:         d.status,
          externalPostId: d.external_post_id,
          publishedAt:    d.published_at,
          error:          d.error_message,
        };
      });

      return {
        total:      data.length,
        successful: data.filter(d => d.status === "success").length,
        failed:     data.filter(d => d.status === "failed").length,
        pending:    data.filter(d => d.status === "pending").length,
        byPlatform,
      };
    } catch (err) {
      console.warn("[Distribution] getDistributionStatus:", err?.message);
      return null;
    }
  }

  // ── Retry a failed distribution ───────────────────────────────────────────
  async retryFailedDistribution(postId, platform) {
    try {
      const [{ data: post }, { data: dist }] = await Promise.all([
        supabase.from("posts").select("*").eq("id", postId).single(),
        supabase.from("post_distribution").select("user_id").eq("post_id", postId).eq("platform", platform).maybeSingle(),
      ]);

      if (!post || !dist) throw new Error("Post or distribution record not found");

      await supabase
        .from("post_distribution")
        .update({ status: "pending", retry_count: 0, error_message: null })
        .eq("post_id", postId)
        .eq("platform", platform);

      return await this._publishToSinglePlatform(postId, dist.user_id, post, platform);
    } catch (err) {
      throw handleError(err, "Failed to retry distribution");
    }
  }
}

export default new DistributionService();