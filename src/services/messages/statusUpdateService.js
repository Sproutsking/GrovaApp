// ============================================================================
// src/services/messages/statusUpdateService.js — SOLID v5 CRASH-FIXED
// ============================================================================
// FIXES vs v4:
//  [RPC-FIX] All supabase.rpc().catch() patterns replaced with try/catch
//            blocks. Supabase JS v2 PostgrestBuilder doesn't expose .catch()
//            as a standalone method — causes "catch is not a function" crash.
// ============================================================================

import { supabase }    from "../config/supabase";
import uploadService   from "../upload/uploadService";

const STORAGE_BUCKET = "status-media"; // fallback only

export const isVideoStatus = (s) =>
  s?.media_type === "video" ||
  (s?.image_id &&
    typeof s.image_id === "string" &&
    /\.(mp4|mov|webm|m4v)$/i.test(s.image_id.split("?")[0]));

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
    this._listeners       = new Set();
    this._sessionViews    = new Set();
  }

  // ── MEDIA UPLOAD ──────────────────────────────────────────────────────────

  async uploadMedia(file, onProgress = null) {
    if (!file) throw new Error("No file provided");

    const isVideo = file.type.startsWith("video/");
    const isImage = file.type.startsWith("image/");
    if (!isVideo && !isImage) throw new Error("Only images and videos are allowed.");

    const maxBytes = isVideo ? 100 * 1024 * 1024 : 20 * 1024 * 1024;
    if (file.size > maxBytes) {
      throw new Error(`File too large. Max ${isVideo ? "100MB" : "20MB"}.`);
    }

    onProgress?.(5);

    const hasCloudinary = !!(uploadService.cloudName && uploadService.uploadPreset);
    if (hasCloudinary) {
      try {
        let result;
        if (isVideo) {
          result = await uploadService.uploadVideo(file, "grova/statuses", onProgress);
        } else {
          result = await uploadService.uploadImage(file, "grova/statuses");
          onProgress?.(100);
        }

        const publicId = result.public_id || result.id;
        const url      = result.url || result.secure_url;

        return {
          id:           publicId,
          url,
          type:         isVideo ? "video" : "image",
          size:         result.bytes || file.size,
          mimeType:     file.type,
          thumbnailUrl: isVideo
            ? this._cloudinaryVideoThumb(publicId)
            : url,
        };
      } catch (cloudErr) {
        console.warn("[StatusService] Cloudinary upload failed, falling back:", cloudErr.message);
      }
    }

    return this._uploadToStorage(file, isVideo, onProgress);
  }

  async _uploadToStorage(file, isVideo, onProgress) {
    const ext  = file.name?.split(".").pop()?.toLowerCase() ||
                 (isVideo ? "mp4" : "jpg");
    const id   = `${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    const path = `${id}.${ext}`;

    onProgress?.(10);

    const { data, error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(path, file, {
        contentType:  file.type,
        cacheControl: "86400",
        upsert:       false,
      });

    if (error) throw error;
    onProgress?.(100);

    const { data: { publicUrl } } = supabase.storage
      .from(STORAGE_BUCKET)
      .getPublicUrl(data.path);

    return {
      id:       data.path,
      url:      publicUrl,
      type:     isVideo ? "video" : "image",
      size:     file.size,
      mimeType: file.type,
    };
  }

  _cloudinaryVideoThumb(publicId) {
    if (!uploadService.cloudName || !publicId) return null;
    return `https://res.cloudinary.com/${uploadService.cloudName}/video/upload/so_0,w_400,h_400,c_fill,f_jpg/${publicId}.jpg`;
  }

  getMediaUrl(mediaId) {
    if (!mediaId) return null;
    if (typeof mediaId === "string" && mediaId.startsWith("http")) return mediaId;

    const cloudName = uploadService.cloudName;
    if (cloudName && mediaId.includes("/") && !mediaId.includes(STORAGE_BUCKET)) {
      const isVid = /\.(mp4|mov|webm|m4v)$/i.test(mediaId);
      if (isVid) return `https://res.cloudinary.com/${cloudName}/video/upload/q_auto,f_mp4/${mediaId}`;
      return `https://res.cloudinary.com/${cloudName}/image/upload/q_auto,f_auto/${mediaId}`;
    }

    try {
      const { data: { publicUrl } } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(mediaId);
      return publicUrl;
    } catch {
      return null;
    }
  }

  async deleteMedia(mediaId) {
    if (!mediaId || typeof mediaId !== "string") return;
    if (mediaId.startsWith("http")) return;
    if (!mediaId.includes(STORAGE_BUCKET) && mediaId.includes("/")) return;
    try {
      await supabase.storage.from(STORAGE_BUCKET).remove([mediaId]);
    } catch (err) {
      console.warn("[StatusService] deleteMedia non-fatal:", err.message);
    }
  }

  // ── CRUD ──────────────────────────────────────────────────────────────────

  async create({ userId, text, bg, textColor, duration, media }) {
    if (!userId) throw new Error("userId is required");
    if (!text?.trim() && !media?.id) throw new Error("Text or media required");

    const row = {
      user_id:    userId,
      text:       text?.trim() || null,
      bg:         media?.id ? null : (bg || null),
      text_color: textColor || "#ffffff",
      duration_h: duration || 24,
      expires_at: new Date(Date.now() + (duration || 24) * 3_600_000).toISOString(),
      views:      0,
      likes:      0,
      media_type: "text",
    };

    if (media?.id) {
      row.image_id   = media.id;
      row.media_type = media.type || "image";
    }

    const { data, error } = await supabase
      .from("status_updates")
      .insert(row)
      .select(STATUS_SELECT)
      .single();

    if (error) {
      const { data: d2, error: e2 } = await supabase
        .from("status_updates")
        .insert(row)
        .select("id, user_id, text, bg, text_color, image_id, media_type, duration_h, views, likes, created_at, expires_at")
        .single();
      if (e2) throw e2;
      return d2;
    }
    return data;
  }

  async loadAll() {
    const { data, error } = await supabase
      .from("status_updates")
      .select(STATUS_SELECT)
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false });

    if (error) {
      if (error.code === "42P01") return { data: [], tableError: true };
      throw error;
    }
    return { data: data || [], tableError: false };
  }

  async loadForUser(userId) {
    if (!userId) return [];
    const { data, error } = await supabase
      .from("status_updates")
      .select(STATUS_SELECT)
      .eq("user_id", userId)
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false });

    if (error) { if (error.code === "42P01") return []; throw error; }
    return data || [];
  }

  async loadMyLikes(userId, statusIds) {
    if (!userId || !statusIds?.length) return new Set();
    const { data } = await supabase
      .from("status_likes")
      .select("status_id")
      .eq("user_id", userId)
      .in("status_id", statusIds);
    return new Set((data || []).map(l => l.status_id));
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
  }

  async extend(statusId, userId, hours) {
    const { data: s, error: fe } = await supabase
      .from("status_updates")
      .select("expires_at")
      .eq("id", statusId)
      .single();

    if (fe || !s) throw new Error("Status not found");

    const base      = new Date(Math.max(new Date(s.expires_at), Date.now()));
    const newExpiry = new Date(base.getTime() + hours * 3_600_000).toISOString();

    const { error } = await supabase
      .from("status_updates")
      .update({ expires_at: newExpiry })
      .eq("id", statusId)
      .eq("user_id", userId);

    if (error) throw error;
    return newExpiry;
  }

  // ── INTERACTIONS ─────────────────────────────────────────────────────────

  /** Like — idempotent. [RPC-FIX] uses try/catch instead of .catch() */
  async like(statusId, userId) {
    const { error } = await supabase
      .from("status_likes")
      .insert({ status_id: statusId, user_id: userId });
    if (error && error.code !== "23505") throw error;

    // [RPC-FIX] was: .rpc(...).catch(() => {})
    try {
      await supabase.rpc("increment_status_likes", { p_status_id: statusId, p_delta: 1 });
    } catch {}
  }

  /** Unlike. [RPC-FIX] */
  async unlike(statusId, userId) {
    await supabase
      .from("status_likes")
      .delete()
      .eq("status_id", statusId)
      .eq("user_id", userId);

    // [RPC-FIX]
    try {
      await supabase.rpc("increment_status_likes", { p_status_id: statusId, p_delta: -1 });
    } catch {}
  }

  /**
   * Record a view — fair-views model.
   * [RPC-FIX] was: .rpc(...).catch(() => {}) — caused crash in v4
   */
  async recordView(statusId, viewerId, ownerId) {
    if (!statusId) return;
    if (viewerId && viewerId === ownerId) return;
    const key = `sv:${statusId}`;
    if (this._sessionViews.has(key)) return;
    this._sessionViews.add(key);

    // [RPC-FIX] use try/catch, NOT .catch() chaining
    try {
      await supabase.rpc("increment_status_views", { p_status_id: statusId });
    } catch {}
  }

  // ── REAL-TIME ─────────────────────────────────────────────────────────────

  subscribe(callback) {
    this._listeners.add(callback);

    if (!this._realtimeChannel) {
      this._realtimeChannel = supabase
        .channel("status_updates_rt_v5")
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "status_updates" },
          () => {
            this._listeners.forEach(cb => { try { cb(); } catch (_) {} });
          }
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

  // ── CLEANUP ───────────────────────────────────────────────────────────────

  resetSession() { this._sessionViews.clear(); }

  cleanup() {
    this._listeners.clear();
    if (this._realtimeChannel) {
      supabase.removeChannel(this._realtimeChannel);
      this._realtimeChannel = null;
    }
    this._sessionViews.clear();
  }
}

export default new StatusUpdateService();