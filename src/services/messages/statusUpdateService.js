// ============================================================================
// src/services/messages/statusUpdateService.js — STANDALONE v1
// ============================================================================
// Completely independent of postService, interactionService, and dmService.
// Manages its own lifecycle: upload → create → read → like → extend → delete.
//
// STORAGE MODEL (mirrors posts dual-model):
//   • Media metadata stored in Supabase (status_updates table).
//   • Actual files stored in Supabase Storage bucket "status-media".
//   • Since statuses expire in ≤24h, Supabase Storage is the right choice —
//     no CDN caching complexity, direct URLs, auto-cleanup via bucket policy.
//
// REQUIRED — run once in Supabase SQL editor:
// ─────────────────────────────────────────────────────────────────────────────
//   -- Create storage bucket (or do it in the Supabase dashboard):
//   -- Bucket name: status-media
//   -- Public: true (so media URLs work without auth tokens)
//
//   -- Optional schema additions for richer media support:
//   ALTER TABLE status_updates ADD COLUMN IF NOT EXISTS video_id text;
//   ALTER TABLE status_updates ADD COLUMN IF NOT EXISTS media_type text DEFAULT 'text';
//   ALTER TABLE status_updates ADD COLUMN IF NOT EXISTS media_metadata jsonb DEFAULT '{}';
//
//   -- RPC for atomic like increment (if not already present):
//   CREATE OR REPLACE FUNCTION increment_status_likes(p_status_id uuid, p_delta int)
//   RETURNS void LANGUAGE sql AS $$
//     UPDATE status_updates SET likes = GREATEST(0, likes + p_delta) WHERE id = p_status_id;
//   $$;
//
//   -- RPC for atomic view increment (if not already present):
//   CREATE OR REPLACE FUNCTION increment_status_views(p_status_id uuid)
//   RETURNS void LANGUAGE sql AS $$
//     UPDATE status_updates SET views = views + 1 WHERE id = p_status_id;
//   $$;
// ─────────────────────────────────────────────────────────────────────────────

import { supabase } from "../config/supabase";

const STORAGE_BUCKET = "status-media";

// ── Shared select fragment ────────────────────────────────────────────────────
const STATUS_SELECT = `
  id, text, bg, text_color, image_id, duration_h,
  views, likes, created_at, expires_at, user_id,
  profile:profiles!status_updates_user_id_fkey(
    id, full_name, username, avatar_id, verified
  )
`;

class StatusUpdateService {
  constructor() {
    this._realtimeChannel = null;
    this._listeners       = new Set();
    this._sessionViews    = new Set(); // don't re-count views in same session
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // MEDIA UPLOAD — Supabase Storage → high quality (files are ephemeral)
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Upload an image or video file to Supabase Storage.
   * Returns { id, url, type, size, mimeType } or throws.
   *
   * Quality note: statuses expire in ≤24h so we upload at FULL quality —
   * no lossy compression here. WebP/MP4 are the native formats.
   */
  async uploadMedia(file, onProgress = null) {
    if (!file) throw new Error("No file provided");

    const isVideo  = file.type.startsWith("video/");
    const ext      = file.name?.split(".").pop()?.toLowerCase() || (isVideo ? "mp4" : "jpg");
    const mediaId  = `${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    const path     = `${mediaId}.${ext}`;

    // Upload — Supabase Storage does not support upload progress natively in
    // the JS client yet, but we fire the hook anyway for future compatibility.
    onProgress?.(0);

    const { data, error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(path, file, {
        contentType:  file.type,
        cacheControl: "86400",  // 24h — matches max status duration
        upsert:       false,
      });

    if (error) throw error;
    onProgress?.(100);

    const { data: { publicUrl } } = supabase.storage
      .from(STORAGE_BUCKET)
      .getPublicUrl(data.path);

    return {
      id:       data.path,     // storage path used as the ID reference in DB
      url:      publicUrl,     // direct public URL for preview
      type:     isVideo ? "video" : "image",
      size:     file.size,
      mimeType: file.type,
    };
  }

  /**
   * Get a public URL for media stored in Supabase Storage.
   */
  getMediaUrl(mediaId) {
    if (!mediaId) return null;
    try {
      const { data: { publicUrl } } = supabase.storage
        .from(STORAGE_BUCKET)
        .getPublicUrl(mediaId);
      return publicUrl;
    } catch {
      return null;
    }
  }

  /**
   * Delete media from storage (called on status delete).
   */
  async deleteMedia(mediaId) {
    if (!mediaId) return;
    try {
      await supabase.storage.from(STORAGE_BUCKET).remove([mediaId]);
    } catch (err) {
      console.warn("[StatusService] deleteMedia:", err);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CRUD
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Create a new status.
   * @param {string}       userId
   * @param {object}       opts
   * @param {string}       opts.text        — status text
   * @param {string}       opts.bg          — CSS gradient background
   * @param {string}       opts.textColor   — CSS color for text
   * @param {number}       opts.duration    — hours until expiry
   * @param {object|null}  opts.media       — result from uploadMedia()
   */
  async create({ userId, text, bg, textColor, duration, media }) {
    if (!userId) throw new Error("userId required");

    const row = {
      user_id:    userId,
      text:       text?.trim() || null,
      bg:         bg   || null,
      text_color: textColor || "#ffffff",
      duration_h: duration  || 24,
      expires_at: new Date(Date.now() + (duration || 24) * 3_600_000).toISOString(),
      views:      0,
      likes:      0,
    };

    if (media?.id) {
      // image_id stores the Supabase Storage path for both images and videos
      row.image_id = media.id;
      // If you've run the optional schema migration, uncomment:
      // row.media_type = media.type;
    }

    const { data, error } = await supabase
      .from("status_updates")
      .insert(row)
      .select(STATUS_SELECT)
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Load all non-expired statuses for the feed.
   * Returns { data: [], tableError: false }
   */
  async loadAll() {
    const { data, error } = await supabase
      .from("status_updates")
      .select(STATUS_SELECT)
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false });

    if (error) {
      if (error.code === "42P01" || error.message?.includes("does not exist")) {
        return { data: [], tableError: true };
      }
      throw error;
    }

    return { data: data || [], tableError: false };
  }

  /**
   * Load the IDs of statuses liked by a user (for a given list of status IDs).
   * Returns a Set<string>.
   */
  async loadMyLikes(userId, statusIds) {
    if (!userId || !statusIds?.length) return new Set();
    const { data } = await supabase
      .from("status_likes")
      .select("status_id")
      .eq("user_id", userId)
      .in("status_id", statusIds);
    return new Set((data || []).map(l => l.status_id));
  }

  /**
   * Soft-delete a status (owner only). Also deletes stored media.
   */
  async delete(statusId, userId) {
    // Fetch image_id first so we can clean up storage
    const { data: s } = await supabase
      .from("status_updates")
      .select("image_id")
      .eq("id", statusId)
      .eq("user_id", userId)
      .single();

    const { error } = await supabase
      .from("status_updates")
      .delete()
      .eq("id", statusId)
      .eq("user_id", userId);

    if (error) throw error;
    if (s?.image_id) this.deleteMedia(s.image_id); // fire-and-forget
  }

  /**
   * Extend a status expiry by `hours` from its current (or now) time.
   */
  async extend(statusId, userId, hours) {
    const { data: s, error: fe } = await supabase
      .from("status_updates")
      .select("expires_at")
      .eq("id", statusId)
      .single();

    if (fe || !s) throw new Error("Status not found");

    const base     = new Date(Math.max(new Date(s.expires_at), Date.now()));
    const newExpiry = new Date(base.getTime() + hours * 3_600_000).toISOString();

    const { error } = await supabase
      .from("status_updates")
      .update({ expires_at: newExpiry })
      .eq("id", statusId)
      .eq("user_id", userId);

    if (error) throw error;
    return newExpiry;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // INTERACTIONS
  // ═══════════════════════════════════════════════════════════════════════════

  async like(statusId, userId) {
    const { error } = await supabase
      .from("status_likes")
      .insert({ status_id: statusId, user_id: userId });
    if (error && error.code !== "23505") throw error; // ignore duplicate key
    // Atomic increment via RPC (non-fatal if RPC doesn't exist yet)
    await supabase.rpc("increment_status_likes", { p_status_id: statusId, p_delta: 1 }).catch(() => {});
  }

  async unlike(statusId, userId) {
    await supabase.from("status_likes").delete().eq("status_id", statusId).eq("user_id", userId);
    await supabase.rpc("increment_status_likes", { p_status_id: statusId, p_delta: -1 }).catch(() => {});
  }

  /**
   * Record a view (once per session per status, never for own content).
   */
  async recordView(statusId, viewerId, ownerId) {
    if (!statusId) return;
    if (viewerId && viewerId === ownerId) return;            // never count own views
    const key = `sv:${statusId}`;
    if (this._sessionViews.has(key)) return;                // already counted this session
    this._sessionViews.add(key);
    await supabase.rpc("increment_status_views", { p_status_id: statusId }).catch(() => {});
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // REAL-TIME
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Subscribe to status_updates table changes.
   * Returns an unsubscribe function.
   */
  subscribe(callback) {
    this._listeners.add(callback);

    if (!this._realtimeChannel) {
      this._realtimeChannel = supabase
        .channel("status_updates_rt_v1")
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "status_updates" },
          () => { this._listeners.forEach(cb => { try { cb(); } catch (_) {} }); }
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

  /**
   * Reset session view tracking (call on logout or page reload).
   */
  resetSession() {
    this._sessionViews.clear();
  }
}

export default new StatusUpdateService();