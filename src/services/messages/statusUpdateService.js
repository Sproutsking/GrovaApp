// services/messages/statusUpdateService.js — v6 FULL FIX
// KEY FIXES:
//  [V1] uploadMedia() stores type: "video"|"image" AND sets media_type in DB
//  [V2] isVideoStatus() checks media_type column AND file extension as fallback
//  [V3] create() always stores media_type in DB if media is provided
//  [V4] loadAll() always enriches with media_type via detectMediaType()
//  [SOUND] Video uploaded with sound — we preserve the audio track by NOT
//          stripping it during upload. The video file is uploaded as-is with
//          its original audio track intact. Sound is controlled by the player
//          UI (muted by default, unmute button shown). The key fix is that
//          the upload does NOT transcode or modify the file — it goes raw to
//          Supabase Storage which preserves all tracks.

import { supabase } from "../config/supabase";

const STORAGE_BUCKET = "status-media";

const STATUS_SELECT_FULL = `id, text, bg, text_color, image_id, media_type, duration_h, views, likes, created_at, expires_at, user_id, profile:profiles!status_updates_user_id_fkey(id, full_name, username, avatar_id, verified)`;
const STATUS_SELECT_COMPAT = `id, text, bg, text_color, image_id, duration_h, views, likes, created_at, expires_at, user_id, profile:profiles!status_updates_user_id_fkey(id, full_name, username, avatar_id, verified)`;

let _hasMediaTypeCol = null; // null=unknown

// [V2] Reliable video detection
export function detectMediaType(status) {
  if (status?.media_type === "video") return "video";
  if (status?.media_type === "image") return "image";
  if (status?.media_type && status.media_type !== "text")
    return status.media_type;
  if (status?.image_id) {
    if (/\.(mp4|mov|webm|avi|mkv|m4v|3gp|ogv)(\?|$)/i.test(status.image_id))
      return "video";
    if (/\.(jpg|jpeg|png|gif|webp|heic|heif|avif)(\?|$)/i.test(status.image_id))
      return "image";
    return "image";
  }
  return "text";
}

export function isVideoStatus(status) {
  return detectMediaType(status) === "video";
}

class StatusUpdateService {
  constructor() {
    this._realtimeChannel = null;
    this._listeners = new Set();
    this._sessionViews = new Set();
  }

  // [SOUND FIX] Upload raw file — NO transcoding, NO audio stripping.
  // The file goes directly to Supabase Storage with its original audio/video
  // tracks intact. The browser's <video> element will play back with sound
  // when the user unmutes. We set contentType from the file's own mime type
  // so the CDN serves it correctly with proper Content-Type headers.
  async uploadMedia(file, onProgress = null) {
    if (!file) throw new Error("No file provided");
    const isVideo = file.type.startsWith("video/");
    const isImage = file.type.startsWith("image/");
    if (!isVideo && !isImage)
      throw new Error("Only images and videos supported.");

    const maxBytes = isVideo ? 100 * 1024 * 1024 : 20 * 1024 * 1024;
    if (file.size > maxBytes)
      throw new Error(`File too large. Max: ${isVideo ? "100MB" : "20MB"}.`);

    const ext =
      file.name?.split(".").pop()?.toLowerCase() || (isVideo ? "mp4" : "jpg");
    const path = `${Date.now()}_${Math.random().toString(36).slice(2, 9)}.${ext}`;

    onProgress?.(10);

    // Upload the file AS-IS — preserves audio track for videos
    const { data, error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(path, file, {
        contentType: file.type, // Use original mime type (e.g. "video/mp4")
        cacheControl: "86400",
        upsert: false,
      });

    if (error) throw error;
    onProgress?.(90);

    const {
      data: { publicUrl },
    } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(data.path);
    onProgress?.(100);

    return {
      id: data.path,
      url: publicUrl,
      type: isVideo ? "video" : "image",
      size: file.size,
      mimeType: file.type,
    };
  }

  getMediaUrl(mediaId) {
    if (!mediaId) return null;
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

  async deleteMedia(mediaId) {
    if (!mediaId || (typeof mediaId === "string" && mediaId.startsWith("http")))
      return;
    try {
      await supabase.storage.from(STORAGE_BUCKET).remove([mediaId]);
    } catch (e) {
      console.warn("[Status] deleteMedia:", e);
    }
  }

  async _queryStatuses(filter) {
    if (_hasMediaTypeCol !== false) {
      const q = supabase.from("status_updates").select(STATUS_SELECT_FULL);
      const { data, error } = await filter(q);
      if (!error) {
        _hasMediaTypeCol = true;
        return {
          data: (data || []).map((s) => ({
            ...s,
            media_type: detectMediaType(s),
          })),
          error: null,
        };
      }
      if (
        error.message?.includes("media_type") ||
        error.message?.includes("column")
      ) {
        _hasMediaTypeCol = false;
        console.warn(
          "[Status] media_type column not found. Run migration to add it.",
        );
      } else {
        return { data: null, error };
      }
    }
    const q2 = supabase.from("status_updates").select(STATUS_SELECT_COMPAT);
    const { data, error } = await filter(q2);
    if (error) return { data: null, error };
    return {
      data: (data || []).map((s) => ({ ...s, media_type: detectMediaType(s) })),
      error: null,
    };
  }

  async create({ userId, text, bg, textColor, duration, media }) {
    if (!userId) throw new Error("userId required");
    if (!text?.trim() && !media?.id) throw new Error("Text or media required");

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
    };

    if (media?.id) {
      row.image_id = media.id;
      row.media_type = media.type === "video" ? "video" : "image";
    }

    if (_hasMediaTypeCol !== false) {
      try {
        const { data, error } = await supabase
          .from("status_updates")
          .insert(row)
          .select(
            _hasMediaTypeCol === false
              ? STATUS_SELECT_COMPAT
              : STATUS_SELECT_FULL,
          )
          .single();
        if (!error) {
          _hasMediaTypeCol = true;
          return { ...data, media_type: detectMediaType(data) };
        }
        if (
          !error.message?.includes("media_type") &&
          !error.message?.includes("column")
        )
          throw error;
        _hasMediaTypeCol = false;
      } catch (e) {
        if (
          !e.message?.includes("media_type") &&
          !e.message?.includes("column")
        )
          throw e;
        _hasMediaTypeCol = false;
      }
    }

    const rowWithout = { ...row };
    delete rowWithout.media_type;
    const { data, error } = await supabase
      .from("status_updates")
      .insert(rowWithout)
      .select(STATUS_SELECT_COMPAT)
      .single();
    if (error) throw error;
    if (data && media?.id) data.media_type = media.type || "image";
    return data;
  }

  async loadAll() {
    const { data, error } = await this._queryStatuses((q) =>
      q
        .gt("expires_at", new Date().toISOString())
        .order("created_at", { ascending: false }),
    );
    if (error) {
      if (error.code === "42P01" || error.message?.includes("does not exist"))
        return { data: [], tableError: true };
      throw error;
    }
    return { data: data || [], tableError: false };
  }

  async loadForUser(userId) {
    if (!userId) return [];
    const { data, error } = await this._queryStatuses((q) =>
      q
        .eq("user_id", userId)
        .gt("expires_at", new Date().toISOString())
        .order("created_at", { ascending: false }),
    );
    if (error) {
      if (error.code === "42P01") return [];
      throw error;
    }
    return data || [];
  }

  async loadMyLikes(userId, statusIds) {
    if (!userId || !statusIds?.length) return new Set();
    const { data } = await supabase
      .from("status_likes")
      .select("status_id")
      .eq("user_id", userId)
      .in("status_id", statusIds);
    return new Set((data || []).map((l) => l.status_id));
  }

  async delete(statusId, userId) {
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
    if (s?.image_id) this.deleteMedia(s.image_id);
  }

  async like(statusId, userId) {
    const { error } = await supabase
      .from("status_likes")
      .insert({ status_id: statusId, user_id: userId });
    if (error && error.code !== "23505") throw error;
    await supabase
      .rpc("increment_status_likes", { p_status_id: statusId, p_delta: 1 })
      .catch(() => {});
  }

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

  async recordView(statusId, viewerId, ownerId) {
    if (!statusId || (viewerId && viewerId === ownerId)) return;
    const key = `sv:${statusId}`;
    if (this._sessionViews.has(key)) return;
    this._sessionViews.add(key);
    await supabase
      .rpc("increment_status_views", { p_status_id: statusId })
      .catch(() => {});
  }

  subscribe(callback) {
    this._listeners.add(callback);
    if (!this._realtimeChannel) {
      this._realtimeChannel = supabase
        .channel("status_updates_rt_v6")
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
      supabase.removeChannel(this._realtimeChannel);
      this._realtimeChannel = null;
    }
    this._sessionViews.clear();
  }
}

export default new StatusUpdateService();
