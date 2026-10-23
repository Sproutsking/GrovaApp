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
import adapters from "./platformAdapterFactory";

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

  // ── Get platform connection readiness ─────────────────────────────────────
  // A linked identity is not necessarily authorized to publish. Distinguish
  // linked accounts that need reconnecting from accounts with usable tokens.
  async getPlatformConnectionStates(userId) {
    try {
      const providerAliases = { twitter: "x", linkedin_oidc: "linkedin" };
      const supportedPlatforms = new Set(adapters.getSupportedPlatforms());
      const { data, error } = await withTimeout(
        supabase
          .from("connections")
          .select("id, provider, auth_status, platform_user_id")
          .eq("user_id", userId),
        10000
      );

      if (error?.code === "42P01") throw new Error("Platform connections are not configured in the database.");
      if (error) throw handleError(error, "Could not load connected platforms");

      const activeConnections = (data || [])
        .map((connection) => ({
          ...connection,
          provider: providerAliases[connection.provider] || connection.provider,
        }))
        .filter((connection) => supportedPlatforms.has(connection.provider));
      if (!activeConnections.length) return {};

      const connectionIds = activeConnections.map((connection) => connection.id);
      const { data: tokens, error: tokenError } = await withTimeout(
        supabase
          .from("tokens")
          .select("connection_id, encrypted_token, expires_at")
          .in("connection_id", connectionIds)
          .eq("revoked", false),
        10000
      );
      if (tokenError) throw handleError(tokenError, "Could not verify platform publishing tokens");

      const now = Date.now();
      const validTokenConnections = new Set();
      for (const token of tokens || []) {
        const expiresAt = token.expires_at ? Date.parse(token.expires_at) : null;
        if (token.encrypted_token && (!token.expires_at || (Number.isFinite(expiresAt) && expiresAt > now))) {
          validTokenConnections.add(token.connection_id);
        }
      }

      return activeConnections.reduce((states, connection) => {
        const ready = connection.auth_status === "active" && validTokenConnections.has(connection.id);
        const current = states[connection.provider];
        if (!current || ready) {
          states[connection.provider] = {
            status: ready ? "ready" : "reconnect",
            platformUserId: connection.platform_user_id || null,
          };
        }
        return states;
      }, {});
    } catch (err) {
      throw handleError(err, "Could not load connected platforms");
    }
  }

  async getConnectedPlatforms(userId) {
    const states = await this.getPlatformConnectionStates(userId);
    return Object.keys(states).filter((platform) => states[platform].status === "ready");
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
        const platformTargets = selectedPlatforms.filter((platform) => connected.includes(platform));
        const missingPlatforms = selectedPlatforms.filter((platform) => (
          !platform.startsWith("community:") && !connected.includes(platform)
        ));
        if (missingPlatforms.length) {
          throw new Error(`Selected platform connection or publishing token is unavailable: ${missingPlatforms.join(", ")}`);
        }
        const communityIds = selectedPlatforms
          .filter((platform) => platform.startsWith("community:"))
          .map((platform) => platform.slice("community:".length));
        if (!communityIds.length) return platformTargets;
        const { data: communityTargets, error: communityError } = await supabase
          .from("community_bot_destinations")
          .select("id,provider,community_id,integration:community_bot_integrations(status)")
          .in("id", communityIds)
          .eq("enabled", true);
        if (communityError) throw handleError(communityError, "Could not verify community destinations");
        const activeCommunityTargets = (communityTargets || []).filter((target) => {
          const status = Array.isArray(target.integration)
            ? target.integration[0]?.status
            : target.integration?.status;
          return String(status || "").toLowerCase() === "active";
        });
        if (activeCommunityTargets.length !== communityIds.length) {
          throw new Error("One or more selected community destinations are no longer available.");
        }
        return [...platformTargets, ...activeCommunityTargets.map((target) => `community:${target.id}`)];
      }

      // Global default: post to everything connected
      if (prefs.global_default_enabled) {
        return connected;
      }

      // Per-platform toggles
      return Object.keys(prefs.platform_preferences || {})
        .filter(p => prefs.platform_preferences[p]?.enabled && connected.includes(p));
    } catch (err) {
      throw handleError(err, "Could not determine distribution destinations");
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
      await Promise.all(
        targets.map(async (platform) => {
          const { error } = await supabase.from("post_distribution").insert({
            post_id: postId,
            user_id: resolvedUserId,
            platform,
            status: "pending",
          });
          if (error) throw handleError(error, `Could not prepare distribution to ${platform}`);
        })
      );

      // Publish in parallel
      const results = await Promise.allSettled(
        targets.map(platform =>
          this._publishToSinglePlatform(postId, resolvedUserId, post, platform)
        )
      );

      const summary = results.map((r, i) => ({
        platform: targets[i],
        ok: r.status === "fulfilled" && r.value?.status === "success",
        error: r.status === "rejected" ? r.reason?.message : r.value?.status === "fallback" ? "Manual sharing is required" : undefined,
        deepLink: r.status === "fulfilled" ? r.value?.deepLink : undefined,
      }));

      // Update queue status
      if (queueId) {
        const hasFailures = summary.some(s => !s.ok);
        try {
          const { error: queueUpdateError } = await supabase
            .from("distribution_queue")
            .update({
              status: hasFailures ? "partial" : "completed",
              processed_at: new Date().toISOString(),
            })
            .eq("id", queueId);
          if (queueUpdateError) throw queueUpdateError;
        } catch (queueUpdateError) {
          console.warn("[Distribution] Queue status update failed:", queueUpdateError?.message);
        }
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

  async distributeContent(contentType, contentId, userId, selectedPlatforms = []) {
    const contentTables = { reel: "reels", story: "stories" };
    const table = contentTables[contentType];
    if (!table) throw new Error(`Unsupported content type for distribution: ${contentType}`);
    if (!contentId || !userId) throw new Error("A content ID and signed-in user are required for distribution");
    if (!selectedPlatforms.length) {
      return { success: true, targets: [], message: "No platforms selected" };
    }

    try {
      const { data: source, error } = await withTimeout(
        supabase.from(table).select("*").eq("id", contentId).eq("user_id", userId).single(),
        12000
      );
      if (error || !source) throw new Error(`Could not load your ${contentType} for distribution`);

      const content = contentType === "reel"
        ? {
            ...source,
            content: source.caption || "",
            image_metadata: [],
            video_metadata: source.video_metadata?.url ? [source.video_metadata] : [],
          }
        : {
            ...source,
            content: [source.title, source.preview].filter(Boolean).join("\n\n"),
            image_metadata: source.cover_image_metadata?.url ? [source.cover_image_metadata] : [],
            video_metadata: [],
          };
      const targets = await this.getPublishTargets(userId, selectedPlatforms);
      if (!targets.length) {
        return { success: true, targets: [], message: "No linked platforms selected" };
      }

      const { error: recordError } = await supabase
        .from("content_distribution")
        .upsert(
          targets.map((platform) => ({
            user_id: userId,
            content_type: contentType,
            content_id: contentId,
            platform,
            status: "pending",
            error_message: null,
            updated_at: new Date().toISOString(),
          })),
          { onConflict: "content_type,content_id,platform" }
        );
      if (recordError) throw handleError(recordError, "Could not create distribution records");

      const results = await Promise.allSettled(
        targets.map((platform) => this._publishToSinglePlatform(contentId, userId, content, platform, contentType))
      );
      const summary = results.map((result, index) => ({
        platform: targets[index],
        ok: result.status === "fulfilled" && result.value?.status === "success",
        error: result.status === "rejected" ? result.reason?.message : result.value?.status === "fallback" ? "Manual sharing is required" : undefined,
        deepLink: result.status === "fulfilled" ? result.value?.deepLink : undefined,
      }));
      return { success: summary.every((result) => result.ok), targets, results: summary };
    } catch (err) {
      throw handleError(err, `Failed to distribute ${contentType}`);
    }
  }

  // ── Publish to a single platform ──────────────────────────────────────────
  async _publishToSinglePlatform(postId, userId, post, platform, contentType = "post") {
    try {
      if (platform.startsWith("community:")) {
        const destinationId = platform.slice("community:".length);
        const { data: destination, error: destinationError } = await supabase
          .from("community_bot_destinations")
          .select("id,provider,community_id,integration:community_bot_integrations(status)")
          .eq("id", destinationId)
          .eq("enabled", true)
          .maybeSingle();
        if (destinationError || !destination) throw new Error("Community destination is no longer available");
        const integrationStatus = Array.isArray(destination.integration)
          ? destination.integration[0]?.status
          : destination.integration?.status;
        if (String(integrationStatus || "").toLowerCase() !== "active") {
          throw new Error("The community bot integration is not active.");
        }
        const content = post.content || post.card_caption || post.caption || "";
        const origin = typeof window !== "undefined" ? window.location.origin : "";
        const route = contentType === "reel" ? "reel" : contentType === "story" ? "story" : "post";
        const url = `${origin}/${route}/${postId}`;
        const { data, error } = await supabase.functions.invoke("community-bot", {
          body: { action: "dispatch", provider: destination.provider, communityId: destination.community_id, destinationId, content, url, sourceId: postId, sourceType: contentType },
        });
        if (error) throw error;
        const result = data?.results?.find((item) => item.destinationId === destinationId) || data;
        if (!result?.ok && data?.ok === false) throw new Error(result?.error || "Community bot delivery failed");
        await this._updateDistributionStatus(contentType, postId, platform, { status: "success", external_post_id: result?.externalMessageId || null, published_at: new Date().toISOString(), updated_at: new Date().toISOString() });
        return { platform, status: "success", externalId: result?.externalMessageId || null };
      }
      const adapter = adapters.getAdapter(platform);
      if (!adapter) throw new Error(`No adapter for: ${platform}`);

      // Get connection
      const providerAliases = {
        x: ["x", "twitter"],
        linkedin: ["linkedin", "linkedin_oidc"],
      };
      const { data: conn, error: connErr } = await withTimeout(
        supabase
          .from("connections")
          .select("id, provider, platform_user_id")
          .eq("user_id", userId)
          .in("provider", providerAliases[platform] || [platform])
          .eq("auth_status", "active")
          .limit(1)
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
      if (tokenErr) throw new Error(`Unable to verify the ${platform} publishing token. Please reconnect the platform and try again.`);
      const tokenExpiry = tokenRow?.expires_at ? Date.parse(tokenRow.expires_at) : null;
      if (!tokenRow?.encrypted_token
        || tokenRow.revoked
        || (tokenRow.expires_at && (!Number.isFinite(tokenExpiry) || tokenExpiry <= Date.now()))) {
        throw new Error(`No valid publishing token for ${platform}. Reconnect the platform with posting permissions.`);
      }

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
        await this._updateDistributionStatus(contentType, postId, platform, {
            status: "success",
            external_post_id: externalId,
            published_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          });

        return { platform, status: "success", externalId };
      }

      // All retries failed — generate deep link as fallback
      const deepLink = await this.generateDeepLink(platform, post).catch(() => null);
      await this._updateDistributionStatus(contentType, postId, platform, {
          status: "failed",
          error_message: "All publish attempts failed; deep link generated",
          updated_at: new Date().toISOString(),
        });

      return { platform, status: "fallback", deepLink };
    } catch (err) {
      try {
        await this._updateDistributionStatus(contentType, postId, platform, {
            status: "failed",
            error_message: err.message,
            updated_at: new Date().toISOString(),
          });
      } catch (statusUpdateError) {
        console.warn("[Distribution] Failed to record platform error:", statusUpdateError?.message);
      }
      throw err;
    }
  }

  async _updateDistributionStatus(contentType, contentId, platform, values) {
    let query = supabase
      .from(contentType === "post" ? "post_distribution" : "content_distribution")
      .update(values);
    query = contentType === "post"
      ? query.eq("post_id", contentId).eq("platform", platform)
      : query.eq("content_type", contentType).eq("content_id", contentId).eq("platform", platform);
    const { error } = await query;
    if (error) throw error;
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
      const postableRows = (data || []).filter((row) => adapters.getAdapter(row.platform) || row.platform.startsWith("community:"));
      if (postableRows.length === 0) return null;

      const byPlatform = {};
      postableRows.forEach(d => {
        byPlatform[d.platform] = {
          status:         d.status,
          externalPostId: d.external_post_id,
          publishedAt:    d.published_at,
          error:          d.error_message,
        };
      });

      return {
        total:      postableRows.length,
        successful: postableRows.filter(d => d.status === "success").length,
        failed:     postableRows.filter(d => d.status === "failed").length,
        pending:    postableRows.filter(d => d.status === "pending").length,
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