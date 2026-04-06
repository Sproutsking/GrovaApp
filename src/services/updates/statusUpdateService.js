// ============================================================================
// src/services/messages/statusUpdateService.js — STANDALONE v2
// ============================================================================
// COMPLETELY INDEPENDENT of postService, interactionService, and dmService.
// Manages its own full lifecycle: upload → create → read → like → view →
// extend → delete. Zero cross-service coupling. Zero shared state.
//
// STORAGE MODEL (mirrors posts dual-model):
//   • Media metadata stored in Supabase (status_updates table).
//   • Actual files stored in Supabase Storage bucket "status-media".
//   • Since statuses expire in ≤24h, Supabase Storage is the right choice:
//     - No CDN stale-cache problem (short TTL = no caching needed)
//     - Direct public URLs, no transform proxies
//     - Auto-cleanup via bucket lifecycle policy (set 24h expiry in dashboard)
//     - Full quality upload — no lossy compression since files are ephemeral
//
// CHANGES vs v1:
//   [SUS-1] media_type field added to all create/read flows to support both
//           image and video statuses.
//   [SUS-2] deleteMedia() is called on status delete to clean up Storage.
//   [SUS-3] STATUS_SELECT updated to include media_type.
//   [SUS-4] create() accepts media.type ("image"|"video") and stores it.
//   [SUS-5] getMediaUrl() handles both images and videos (same bucket).
//
// REQUIRED — run once in Supabase SQL editor:
// ─────────────────────────────────────────────────────────────────────────────
//   -- 1. Create the storage bucket (or do it in the Supabase dashboard):
//   --    Bucket name: status-media
//   --    Public: true (direct URLs work without auth tokens)
//   --    File size limit: 104857600 (100MB — covers full-quality videos)
//   --    Allowed MIME types: image/*, video/*
//   --    (Optional) Lifecycle: auto-delete objects older than 86400s (24h)
//
//   -- 2. Add media_type column (safe to run even if column exists):
//   ALTER TABLE public.status_updates
//     ADD COLUMN IF NOT EXISTS media_type text DEFAULT 'text';
//
//   -- 3. RPC: atomic like increment (idempotent):
//   CREATE OR REPLACE FUNCTION increment_status_likes(p_status_id uuid, p_delta int)
//   RETURNS void LANGUAGE sql AS $$
//     UPDATE status_updates
//     SET likes = GREATEST(0, likes + p_delta)
//     WHERE id = p_status_id;
//   $$;
//
//   -- 4. RPC: atomic view increment (idempotent):
//   CREATE OR REPLACE FUNCTION increment_status_views(p_status_id uuid)
//   RETURNS void LANGUAGE sql AS $$
//     UPDATE status_updates
//     SET views = views + 1
//     WHERE id = p_status_id;
//   $$;
//
//   -- 5. RLS policies (if not already present):
//   ALTER TABLE public.status_updates ENABLE ROW LEVEL SECURITY;
//
//   CREATE POLICY "status_updates_select" ON public.status_updates
//     FOR SELECT USING (
//       expires_at > now()
//     );
//
//   CREATE POLICY "status_updates_insert" ON public.status_updates
//     FOR INSERT WITH CHECK (auth.uid() = user_id);
//
//   CREATE POLICY "status_updates_update" ON public.status_updates
//     FOR UPDATE USING (auth.uid() = user_id);
//
//   CREATE POLICY "status_updates_delete" ON public.status_updates
//     FOR DELETE USING (auth.uid() = user_id);
//
//   -- 6. Storage bucket policies (run in SQL editor):
//   -- Public read for status-media bucket:
//   CREATE POLICY "status_media_public_read" ON storage.objects
//     FOR SELECT USING (bucket_id = 'status-media');
//
//   -- Authenticated users can upload their own media:
//   CREATE POLICY "status_media_insert" ON storage.objects
//     FOR INSERT WITH CHECK (
//       bucket_id = 'status-media' AND auth.role() = 'authenticated'
//     );
//
//   -- Users can only delete their own uploads:
//   CREATE POLICY "status_media_delete" ON storage.objects
//     FOR DELETE USING (
//       bucket_id = 'status-media' AND auth.uid()::text = (storage.foldername(name))[1]
//     );
// ─────────────────────────────────────────────────────────────────────────────

import { supabase } from "../config/supabase";

const STORAGE_BUCKET = "status-media";

// [SUS-3] Select fragment includes media_type
const STATUS_SELECT = `
  id, text, bg, text_color, image_id, media_type, duration_h,
  views, likes, created_at, expires_at, user_id,
  profile:profiles!status_updates_user_id_fkey(
    id, full_name, username, avatar_id, verified
  )
`;

class StatusUpdateService {
  constructor() {
    this._realtimeChannel = null;
    this._listeners = new Set();
    this._sessionViews = new Set(); // prevent double-counting in same session
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // MEDIA UPLOAD — Supabase Storage at FULL QUALITY
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Upload an image or video to Supabase Storage at full quality.
   * No compression is applied — statuses are ephemeral (≤24h) so file size
   * trade-offs that apply to long-lived posts/reels don't apply here.
   *
   * @param {File}     file        — browser File object
   * @param {Function} onProgress  — optional (0→100) progress callback
   * @returns {{ id: string, url: string, type: "image"|"video", size: number, mimeType: string }}
   */
  async uploadMedia(file, onProgress = null) {
    if (!file) throw new Error("No file provided");

    const isVideo = file.type.startsWith("video/");
    const isImage = file.type.startsWith("image/");

    if (!isVideo && !isImage) {
      throw new Error(
        "Unsupported file type. Only images and videos are allowed.",
      );
    }

    const maxBytes = isVideo ? 100 * 1024 * 1024 : 20 * 1024 * 1024;
    if (file.size > maxBytes) {
      throw new Error(
        `File too large. Maximum size: ${isVideo ? "100MB" : "20MB"}.`,
      );
    }

    const ext =
      file.name?.split(".").pop()?.toLowerCase() || (isVideo ? "mp4" : "jpg");
    const mediaId = `${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    const path = `${mediaId}.${ext}`;

    onProgress?.(10);

    // Full quality upload — no compression, no resizing
    const { data, error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(path, file, {
        contentType: file.type,
        cacheControl: "86400", // 24h cache — matches max status duration
        upsert: false,
      });

    if (error) throw error;
    onProgress?.(100);

    const {
      data: { publicUrl },
    } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(data.path);

    return {
      id: data.path, // Storage path — stored in image_id column
      url: publicUrl, // Direct public URL for preview/display
      type: isVideo ? "video" : "image",
      size: file.size,
      mimeType: file.type,
    };
  }

  /**
   * Get the public URL for a media item stored in Supabase Storage.
   * Works for both images and videos — same bucket, same URL pattern.
   * [SUS-5]
   */
  getMediaUrl(mediaId) {
    if (!mediaId) return null;
    // If already a full URL, return as-is
    if (typeof mediaId === "string" && mediaId.startsWith("http"))
      return mediaId;
    try {
      const {
        data: { publicUrl },
      } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(mediaId);
      return publicUrl;
    } catch {
      return null;
    }
  }

  /**
   * Delete a media file from Storage. Called on status delete.
   * Fire-and-forget — never throws to caller. [SUS-2]
   */
  async deleteMedia(mediaId) {
    if (!mediaId) return;
    // Don't attempt to delete full URLs, only storage paths
    if (typeof mediaId === "string" && mediaId.startsWith("http")) return;
    try {
      await supabase.storage.from(STORAGE_BUCKET).remove([mediaId]);
    } catch (err) {
      console.warn("[StatusService] deleteMedia non-fatal:", err);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CRUD
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Create a new status update.
   *
   * @param {object} opts
   * @param {string}       opts.userId     — creator's user ID (required)
   * @param {string}       opts.text       — status text (optional if media present)
   * @param {string}       opts.bg         — CSS gradient background
   * @param {string}       opts.textColor  — CSS color for text overlay
   * @param {number}       opts.duration   — hours until expiry (default 24)
   * @param {object|null}  opts.media      — result from uploadMedia()
   *                                         { id, url, type, mimeType }
   * @returns {object} — the created status row
   */
  async create({ userId, text, bg, textColor, duration, media }) {
    if (!userId) throw new Error("userId is required");
    if (!text?.trim() && !media?.id)
      throw new Error("Either text or media is required");

    const row = {
      user_id: userId,
      text: text?.trim() || null,
      bg: media?.id ? null : bg || null, // no bg gradient when media present
      text_color: textColor || "#ffffff",
      duration_h: duration || 24,
      expires_at: new Date(
        Date.now() + (duration || 24) * 3_600_000,
      ).toISOString(),
      views: 0,
      likes: 0,
      media_type: "text", // default
    };

    // [SUS-4] Store Storage path and media type
    if (media?.id) {
      row.image_id = media.id;
      row.media_type = media.type || "image"; // "image" | "video"
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
   * Load statuses for a specific user (profile page / my statuses).
   */
  async loadForUser(userId) {
    if (!userId) return [];
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
    return data || [];
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
    return new Set((data || []).map((l) => l.status_id));
  }

  /**
   * Delete a status (owner only).
   * Also cleans up the associated Storage file. [SUS-2]
   */
  async delete(statusId, userId) {
    // Fetch image_id and media_type first so we can clean up Storage
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

    // Fire-and-forget Storage cleanup
    if (s?.image_id) {
      this.deleteMedia(s.image_id);
    }
  }

  /**
   * Extend a status expiry by `hours` from its current expiry (or now if expired).
   * Returns the new expiry ISO string.
   */
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
    return newExpiry;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // INTERACTIONS
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Like a status. Idempotent — duplicate inserts are silently ignored.
   */
  async like(statusId, userId) {
    const { error } = await supabase
      .from("status_likes")
      .insert({ status_id: statusId, user_id: userId });

    if (error && error.code !== "23505") throw error; // 23505 = unique violation — ok

    await supabase
      .rpc("increment_status_likes", { p_status_id: statusId, p_delta: 1 })
      .catch(() => {}); // non-fatal if RPC not yet created
  }

  /**
   * Unlike a status.
   */
  async unlike(statusId, userId) {
    await supabase
      .from("status_likes")
      .delete()
      .eq("status_id", statusId)
      .eq("user_id", userId);

    await supabase
      .rpc("increment_status_likes", { p_status_id: statusId, p_delta: -1 })
      .catch(() => {});
  }

  /**
   * Record a view for a status.
   * Rules (mirrors viewsService.js fair-views model):
   *   1. Never count own views.
   *   2. Once per session per status (in-memory Set — resets on page reload).
   *   3. Atomic increment via RPC — never read-then-write.
   *   4. Fire-and-forget — never blocks UI, never throws to caller.
   */
  async recordView(statusId, viewerId, ownerId) {
    if (!statusId) return;
    if (viewerId && viewerId === ownerId) return; // [1] never own views

    const key = `sv:${statusId}`;
    if (this._sessionViews.has(key)) return; // [2] once per session
    this._sessionViews.add(key);

    // [3] Atomic increment
    await supabase
      .rpc("increment_status_views", { p_status_id: statusId })
      .catch(() => {}); // [4] non-fatal
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // REAL-TIME
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Subscribe to status_updates table changes.
   * Notifies all registered callbacks when any row changes.
   * Returns an unsubscribe function.
   */
  subscribe(callback) {
    this._listeners.add(callback);

    if (!this._realtimeChannel) {
      this._realtimeChannel = supabase
        .channel("status_updates_rt_v2")
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

  // ═══════════════════════════════════════════════════════════════════════════
  // SESSION
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Reset session view tracking.
   * Call this on logout or when the user navigates away from the updates tab.
   */
  resetSession() {
    this._sessionViews.clear();
  }

  /**
   * Full cleanup — remove realtime subscriptions.
   * Call on app teardown.
   */
  cleanup() {
    this._listeners.clear();
    if (this._realtimeChannel) {
      supabase.removeChannel(this._realtimeChannel);
      this._realtimeChannel = null;
    }
    this._sessionViews.clear();
  }
}

// Singleton export — same pattern as dmMessageService, conversationState, etc.
export default new StatusUpdateService();
