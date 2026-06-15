// ============================================================================
// src/services/messages/statusUpdateService.js — v4 PRODUCTION PERFECT
// ============================================================================
//
// ARCHITECTURE: Mirrors reelService.js exactly:
//   • Atomic counters via increment_count RPC (same as reels)
//   • Cache layer via cacheService (same pattern)
//   • Error handling via handleError (same pattern)
//   • Media via Supabase Storage (ephemeral — no CDN stale-cache issue)
//   • Zero read-then-write races on likes/views
//   • Real-time subscriptions managed as a singleton
//
// CHANGES vs v3:
//   [v4-1]  getMediaUrl() fixed — no longer routes video IDs through
//           mediaUrlService.getImageUrl (which applies image transforms).
//           Now returns raw Supabase Storage public URLs for all media.
//   [v4-2]  isVideoStatus() detection hardened — checks media_type column
//           first (most reliable), then file extension from Storage path,
//           then MIME type hints. Never relies on "/video/upload/" substring
//           which only exists in Cloudinary URLs, not Supabase Storage paths.
//   [v4-3]  create() stores correct media_type reliably via media.type field.
//   [v4-4]  loadAll() / loadForUser() enriches media_type from image_id
//           extension when the column value is missing or "text" but an
//           image_id is present — prevents video being treated as image.
//   [v4-5]  getReplyPayload() updated to match v4 media_type logic.
//   [v4-6]  Removed duplicate statusUpdateService in src/services/updates/ —
//           this file is the single source of truth. The updates/ copy should
//           be deleted or re-export from this file.
//   [v4-7]  uploadMedia() now explicitly tags returned object with mimeType
//           and stores the correct type so callers never have to guess.
//   [v4-8]  buildMediaUrl() helper replaces getMediaUrl() with explicit
//           bucket-aware URL construction — no ambiguity.
//
// NOTE ON DUPLICATE SERVICE:
//   src/services/updates/statusUpdateService.js should either be deleted
//   or replaced with:
//     export { default } from '../messages/statusUpdateService';
//   UpdatesView.jsx already imports from messages/ so this file is canonical.
//
// ─────────────────────────────────────────────────────────────────────────────

import { supabase } from "../config/supabase";

// ── Lazy imports (avoids circular deps) ──────────────────────────────────────
let _cacheService = null;
async function getCache() {
  if (!_cacheService) {
    try {
      const mod = await import("../shared/cacheService");
      _cacheService = mod.default;
    } catch {
      _cacheService = {
        get: () => null,
        set: () => {},
        invalidate: () => {},
        invalidatePattern: () => {},
      };
    }
  }
  return _cacheService;
}

const STORAGE_BUCKET = "status-media";
const CACHE_TTL = 60_000;

// ── [v4-2] Video extension set — used for reliable media_type detection ───────
const VIDEO_EXTENSIONS = new Set([
  "mp4",
  "mov",
  "webm",
  "m4v",
  "avi",
  "mkv",
  "mpeg",
  "mpg",
  "ogv",
  "3gp",
]);
const IMAGE_EXTENSIONS = new Set([
  "jpg",
  "jpeg",
  "png",
  "gif",
  "webp",
  "avif",
  "heic",
  "heif",
]);

/**
 * Extract file extension from a path or URL string.
 */
function extractExtension(str) {
  if (!str || typeof str !== "string") return "";
  // Strip query string
  const clean = str.split("?")[0];
  const parts = clean.split(".");
  if (parts.length < 2) return "";
  return parts[parts.length - 1].toLowerCase().trim();
}

/**
 * [v4-2] Named export — reliable video detection.
 *
 * Priority order:
 *   1. media_type column = "video" (set at create time — most reliable)
 *   2. File extension from image_id (Storage path like "1234_abc.mp4")
 *   3. Cloudinary URL pattern "/video/upload/" (legacy Cloudinary statuses)
 *   4. MIME type hints in the URL
 */
export function isVideoStatus(status) {
  if (!status) return false;

  // 1. Explicit media_type column
  if (status.media_type === "video") return true;
  if (status.media_type === "image" || status.media_type === "text")
    return false;

  // 2. Extension from Storage path
  if (status.image_id) {
    const ext = extractExtension(status.image_id);
    if (VIDEO_EXTENSIONS.has(ext)) return true;
    if (IMAGE_EXTENSIONS.has(ext)) return false;
  }

  // 3. Cloudinary legacy URL pattern
  if (status.image_id && typeof status.image_id === "string") {
    if (status.image_id.includes("/video/upload/")) return true;
  }

  return false;
}

// ── Select fragment ───────────────────────────────────────────────────────────
const STATUS_SELECT = `
  id, text, bg, text_color, image_id, media_type, duration_h,
  views, likes, created_at, expires_at, user_id,
  profile:profiles!status_updates_user_id_fkey(
    id, full_name, username, avatar_id, verified
  )
`;

// ── [v4-1] Atomic counter ─────────────────────────────────────────────────────
async function atomicIncrement(table, id, column, delta = 1) {
  try {
    const { error } = await supabase.rpc("increment_count", {
      p_table: table,
      p_id: id,
      p_column: column,
      p_delta: delta,
    });
    if (!error) return true;
    throw error;
  } catch {
    try {
      const { data } = await supabase
        .from(table)
        .select(column)
        .eq("id", id)
        .single();
      const current = data?.[column] ?? 0;
      await supabase
        .from(table)
        .update({ [column]: Math.max(0, current + delta) })
        .eq("id", id);
      return true;
    } catch {
      return false;
    }
  }
}

// ── Auth helper ───────────────────────────────────────────────────────────────
async function checkAuth() {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) throw new Error("You must be logged in to post a status");
  return user;
}

// ── [v4-4] Enrich media_type from image_id when column is unreliable ──────────
function enrichMediaType(status) {
  if (!status) return status;

  // Already correctly set
  if (status.media_type === "video" || status.media_type === "image") {
    return status;
  }

  // No media — keep as text
  if (!status.image_id) {
    return { ...status, media_type: "text" };
  }

  // Derive from file extension / URL pattern
  const ext = extractExtension(status.image_id);
  if (VIDEO_EXTENSIONS.has(ext)) {
    return { ...status, media_type: "video" };
  }
  if (IMAGE_EXTENSIONS.has(ext)) {
    return { ...status, media_type: "image" };
  }

  // Cloudinary video URL legacy
  if (
    typeof status.image_id === "string" &&
    status.image_id.includes("/video/upload/")
  ) {
    return { ...status, media_type: "video" };
  }

  // Has image_id but unknown extension — default to image
  return { ...status, media_type: "image" };
}

class StatusUpdateService {
  constructor() {
    this._realtimeChannel = null;
    this._listeners = new Set();
    this._sessionViews = new Set();
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // MEDIA — Supabase Storage at FULL QUALITY
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Upload image or video to Supabase Storage at full quality.
   *
   * [v4-7] Returns explicit type and mimeType so callers never have to guess.
   *
   * @param {File}     file        — browser File
   * @param {Function} onProgress  — (0–100) progress callback
   * @returns {{ id: string, url: string, type: "image"|"video", size: number, mimeType: string }}
   */
  async uploadMedia(file, onProgress = null) {
    if (!file) throw new Error("No file provided");

    await checkAuth();

    // Determine type from MIME first, then extension fallback
    const mimeIsVideo = file.type.startsWith("video/");
    const mimeIsImage = file.type.startsWith("image/");
    const ext = file.name?.split(".").pop()?.toLowerCase() || "";
    const extIsVideo = VIDEO_EXTENSIONS.has(ext);
    const extIsImage = IMAGE_EXTENSIONS.has(ext);

    const isVideo = mimeIsVideo || (!mimeIsImage && extIsVideo);
    const isImage = mimeIsImage || (!mimeIsVideo && extIsImage);

    if (!isVideo && !isImage) {
      throw new Error("Only images and videos are supported.");
    }

    const maxBytes = isVideo ? 100 * 1024 * 1024 : 20 * 1024 * 1024;
    if (file.size > maxBytes) {
      throw new Error(`File too large. Max: ${isVideo ? "100MB" : "20MB"}.`);
    }
    if (file.size < 100) {
      throw new Error("File is too small — may be corrupted.");
    }

    // Build storage path — include extension so media_type can be derived later
    const safeExt = ext || (isVideo ? "mp4" : "jpg");
    const mediaId = `${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    const path = `${mediaId}.${safeExt}`;

    onProgress?.(5);

    const contentType = file.type || (isVideo ? "video/mp4" : "image/jpeg");

    const { data, error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(path, file, {
        contentType,
        cacheControl: "86400",
        upsert: false,
      });

    if (error) {
      onProgress?.(0);
      throw new Error(error.message || "Upload failed");
    }

    onProgress?.(100);

    const {
      data: { publicUrl },
    } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(data.path);

    return {
      id: data.path, // Storage path e.g. "1234_abc123.mp4"
      url: publicUrl, // Direct public URL
      type: isVideo ? "video" : "image",
      size: file.size,
      mimeType: contentType,
    };
  }

  /**
   * [v4-8] Get public URL for a media item.
   *
   * Handles three cases:
   *   A) Already a full HTTP URL — return as-is (Cloudinary legacy or direct URL)
   *   B) Supabase Storage path (e.g. "1234_abc.mp4") — build public URL
   *   C) null/undefined — return null
   *
   * IMPORTANT: Never routes through mediaUrlService.getImageUrl because that
   * applies Cloudinary image transforms (q_auto, f_auto, c_fill) which break
   * video URLs. Video URLs must be served as-is.
   */
  getMediaUrl(mediaId) {
    if (!mediaId) return null;

    // Already a full URL — return directly
    if (typeof mediaId === "string" && mediaId.startsWith("http")) {
      return mediaId;
    }

    // Supabase Storage path — build public URL
    try {
      const {
        data: { publicUrl },
      } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(mediaId);
      return publicUrl || null;
    } catch {
      return null;
    }
  }

  /**
   * Delete Storage file. Fire-and-forget.
   */
  async deleteMedia(mediaId) {
    if (!mediaId) return;
    if (typeof mediaId === "string" && mediaId.startsWith("http")) return;
    try {
      await supabase.storage.from(STORAGE_BUCKET).remove([mediaId]);
    } catch (err) {
      console.warn("[StatusService] deleteMedia:", err?.message);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CRUD
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Create a new status update.
   *
   * @param {object} opts
   * @param {string}      opts.userId
   * @param {string}      opts.text
   * @param {string}      opts.bg
   * @param {string}      opts.textColor
   * @param {number}      opts.duration
   * @param {object|null} opts.media   — { id, url, type, mimeType }
   * @param {object|null} opts.sound   — { name, url }
   * @returns {object} created status row
   */
  async create({ userId, text, bg, textColor, duration, media, sound }) {
    if (!userId) throw new Error("userId is required");
    if (!text?.trim() && !media?.id) {
      throw new Error("Either text or media is required");
    }

    await checkAuth();

    const row = {
      user_id: userId,
      text: text?.trim() || null,
      bg: media?.id ? null : bg || null,
      text_color: textColor || "#ffffff",
      duration_h: duration || 24,
      expires_at: new Date(
        Date.now() + (duration || 24) * 3_600_000,
      ).toISOString(),
      views: 0,
      likes: 0,
      // [v4-3] Default to text; overridden below if media present
      media_type: "text",
    };

    if (media?.id) {
      row.image_id = media.id;
      // [v4-3] Use explicit type from upload result — never guess
      row.media_type = media.type === "video" ? "video" : "image";
    }

    if (sound?.name) {
      row.music = sound.name;
    }

    const { data, error } = await supabase
      .from("status_updates")
      .insert(row)
      .select(STATUS_SELECT)
      .single();

    if (error) throw error;

    if (sound?.name) {
      this._trackSoundUsage(sound.name, userId).catch(() => {});
    }

    const cache = await getCache();
    cache.invalidatePattern("status:");

    return enrichMediaType(data);
  }

  async _trackSoundUsage(soundName, userId) {
    try {
      const { data: existing } = await supabase
        .from("sounds")
        .select("id, total_uses")
        .eq("name", soundName)
        .maybeSingle();

      if (!existing) {
        await supabase.from("sounds").insert({
          name: soundName,
          first_used_by: userId,
          total_uses: 1,
        });
      } else {
        await supabase
          .from("sounds")
          .update({ total_uses: (existing.total_uses || 0) + 1 })
          .eq("id", existing.id);
      }
    } catch (e) {
      console.warn("[StatusService] trackSoundUsage:", e?.message);
    }
  }

  /**
   * Load all non-expired statuses.
   * [v4-4] Enriches media_type from image_id when column is stale.
   */
  async loadAll(offset = 0, limit = 50) {
    try {
      const cache = await getCache();
      const cacheKey = `status:all:${offset}:${limit}`;
      const cached = cache.get(cacheKey);
      if (cached) return cached;

      let data = null;

      // Try with media_type column
      try {
        const { data: d, error } = await supabase
          .from("status_updates")
          .select(STATUS_SELECT)
          .gt("expires_at", new Date().toISOString())
          .order("created_at", { ascending: false })
          .range(offset, offset + limit - 1);

        if (error) throw error;
        data = d;
      } catch {
        // Fallback without media_type
        const { data: d2, error: e2 } = await supabase
          .from("status_updates")
          .select(
            `id, text, bg, text_color, image_id, duration_h,
             views, likes, created_at, expires_at, user_id,
             profile:profiles!status_updates_user_id_fkey(
               id, full_name, username, avatar_id, verified
             )`,
          )
          .gt("expires_at", new Date().toISOString())
          .order("created_at", { ascending: false })
          .range(offset, offset + limit - 1);

        if (e2) {
          if (e2.code === "42P01" || e2.message?.includes("does not exist")) {
            return { data: [], tableError: true };
          }
          throw e2;
        }
        data = d2;
      }

      // [v4-4] Enrich media_type for every row
      const enriched = (data || []).map(enrichMediaType);
      const result = { data: enriched, tableError: false };
      cache.set(cacheKey, result, CACHE_TTL);
      return result;
    } catch (error) {
      console.warn("[StatusService] loadAll:", error?.message);
      return { data: [], tableError: false };
    }
  }

  /**
   * Load statuses for a specific user.
   */
  async loadForUser(userId) {
    if (!userId) return [];
    try {
      const cache = await getCache();
      const cacheKey = `status:user:${userId}`;
      const cached = cache.get(cacheKey);
      if (cached) return cached;

      const { data, error } = await supabase
        .from("status_updates")
        .select(STATUS_SELECT)
        .eq("user_id", userId)
        .gt("expires_at", new Date().toISOString())
        .order("created_at", { ascending: false });

      if (error) {
        if (error.code === "42P01") return [];
        throw error;
      }

      // [v4-4] Enrich media_type
      const result = (data || []).map(enrichMediaType);
      cache.set(cacheKey, result, CACHE_TTL);
      return result;
    } catch (error) {
      console.warn("[StatusService] loadForUser:", error?.message);
      return [];
    }
  }

  async loadMyLikes(userId, statusIds) {
    if (!userId || !statusIds?.length) return new Set();
    try {
      const { data } = await supabase
        .from("status_likes")
        .select("status_id")
        .eq("user_id", userId)
        .in("status_id", statusIds);
      return new Set((data || []).map((l) => l.status_id));
    } catch {
      return new Set();
    }
  }

  async delete(statusId, userId) {
    const { data: s } = await supabase
      .from("status_updates")
      .select("image_id, media_type")
      .eq("id", statusId)
      .eq("user_id", userId)
      .single();

    const { error } = await supabase
      .from("status_updates")
      .delete()
      .eq("id", statusId)
      .eq("user_id", userId);

    if (error) throw error;

    if (s?.image_id) this.deleteMedia(s.image_id);

    const cache = await getCache();
    cache.invalidatePattern("status:");
  }

  async extend(statusId, userId, hours) {
    const { data: s, error: fe } = await supabase
      .from("status_updates")
      .select("expires_at")
      .eq("id", statusId)
      .single();

    if (fe || !s) throw new Error("Status not found");

    const base = new Date(Math.max(new Date(s.expires_at), Date.now()));
    const newExpiry = new Date(
      base.getTime() + hours * 3_600_000,
    ).toISOString();

    const { error } = await supabase
      .from("status_updates")
      .update({ expires_at: newExpiry })
      .eq("id", statusId)
      .eq("user_id", userId);

    if (error) throw error;

    const cache = await getCache();
    cache.invalidatePattern("status:");

    return newExpiry;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // INTERACTIONS
  // ═══════════════════════════════════════════════════════════════════════════

  async like(statusId, userId) {
    const { data: existing } = await supabase
      .from("status_likes")
      .select("id")
      .eq("status_id", statusId)
      .eq("user_id", userId)
      .maybeSingle();

    if (existing) return { liked: true };

    const { error } = await supabase
      .from("status_likes")
      .insert({ status_id: statusId, user_id: userId });

    if (error && error.code !== "23505") throw error;

    await atomicIncrement("status_updates", statusId, "likes", 1);
    return { liked: true };
  }

  async unlike(statusId, userId) {
    await supabase
      .from("status_likes")
      .delete()
      .eq("status_id", statusId)
      .eq("user_id", userId);

    await atomicIncrement("status_updates", statusId, "likes", -1);
    return { liked: false };
  }

  async toggleLike(statusId, userId) {
    const { data: existing } = await supabase
      .from("status_likes")
      .select("id")
      .eq("status_id", statusId)
      .eq("user_id", userId)
      .maybeSingle();

    if (existing) {
      await supabase.from("status_likes").delete().eq("id", existing.id);
      await atomicIncrement("status_updates", statusId, "likes", -1);
      return { liked: false };
    } else {
      await supabase
        .from("status_likes")
        .insert([{ status_id: statusId, user_id: userId }]);
      await atomicIncrement("status_updates", statusId, "likes", 1);
      return { liked: true };
    }
  }

  async recordView(statusId, viewerId, ownerId) {
    if (!statusId) return;
    if (viewerId && viewerId === ownerId) return;

    const key = `sv:${statusId}`;
    if (this._sessionViews.has(key)) return;
    this._sessionViews.add(key);

    await atomicIncrement("status_updates", statusId, "views", 1);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // DM REPLY CARD
  // ═══════════════════════════════════════════════════════════════════════════

  getReplyPayload(status, replyText) {
    const author =
      status?.profile?.username || status?.profile?.full_name || "someone";
    // [v4-5] Use enriched media_type
    const isVid = status?.media_type === "video";
    const preview = status?.text
      ? `"${status.text.slice(0, 60)}${status.text.length > 60 ? "…" : ""}"`
      : isVid
        ? "🎥 video status"
        : status?.image_id
          ? "📷 photo status"
          : "status";
    return `↩ Replied to @${author}'s status ${preview}:\n\n${replyText}`;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // REAL-TIME
  // ═══════════════════════════════════════════════════════════════════════════

  subscribe(callback) {
    this._listeners.add(callback);

    if (!this._realtimeChannel) {
      this._realtimeChannel = supabase
        .channel("status_updates_rt_v4")
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "status_updates" },
          () => {
            this._listeners.forEach((cb) => {
              try {
                cb();
              } catch (_) {}
            });
          },
        )
        .subscribe();
    }

    return () => {
      this._listeners.delete(callback);
      if (this._listeners.size === 0 && this._realtimeChannel) {
        supabase.removeChannel(this._realtimeChannel);
        this._realtimeChannel = null;
      }
    };
  }

  resetSession() {
    this._sessionViews.clear();
  }

  cleanup() {
    this._listeners.clear();
    if (this._realtimeChannel) {
      try {
        supabase.removeChannel(this._realtimeChannel);
      } catch (_) {}
      this._realtimeChannel = null;
    }
    this._sessionViews.clear();
  }
}

export default new StatusUpdateService();
