// ============================================================================
// src/services/messages/statusUpdateService.js — DEFINITIVE v9 VIDEO FIX
// ============================================================================
// FIXES vs v8:
//  [VID-FIX] isVideoStatus() massively expanded — catches ALL Cloudinary video
//            URL patterns: /video/upload/, f_mp4, vc_auto, resource_type=video,
//            fl_attachment, and all common video file extensions. No more false
//            negatives causing videos to render as images or broken fallbacks.
//  [VID-URL] getMediaUrl() detects video IDs that look like Cloudinary paths
//            starting with "video/" prefix and routes them correctly.
//  All v8 features preserved: [VID-2] upload, [RPL-1] reply, [LIKE-1] likes,
//  [VIEW-1] views, [ESL-1] ESLint-clean RPCs, [RT-1] realtime.
// ============================================================================

import { supabase } from "../config/supabase";
import uploadService from "../upload/uploadService";

export const STORAGE_BUCKET = "status-media";

// ── [VID-FIX] Comprehensive video detection ───────────────────────────────────
export const isVideoStatus = (s) => {
  if (!s) return false;
  // Explicit media_type field
  if (s.media_type === "video") return true;

  const id = typeof s.image_id === "string" ? s.image_id : "";

  if (id) {
    // Strip query string for extension check
    const path = id.split("?")[0];

    // Common video file extensions
    if (/\.(mp4|mov|webm|m4v|avi|mkv|mpeg|mpg|ogv|3gp|flv|wmv)$/i.test(path)) return true;

    // Cloudinary video upload path patterns
    if (path.includes("/video/upload/")) return true;
    if (path.includes("/video/")) return true;

    // Cloudinary public ID prefix (resource_type=video stored as "video/...")
    if (path.startsWith("video/")) return true;

    // Cloudinary transform hints in URL
    if (path.includes("f_mp4")) return true;
    if (path.includes("vc_auto")) return true;
    if (path.includes("fl_attachment")) return true;
    if (path.includes("resource_type=video")) return true;
  }

  return false;
};

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
    this._sessionViews = new Set();
  }

  // ==========================================================================
  // [VID-URL] MEDIA URL — enhanced video routing
  // ==========================================================================
  getMediaUrl(mediaId) {
    if (!mediaId) return null;

    // Already a full URL
    if (typeof mediaId === "string" && mediaId.startsWith("http")) {
      if (
        mediaId.includes("cloudinary.com") &&
        mediaId.includes("/video/upload/") &&
        !mediaId.includes("f_mp4") &&
        !mediaId.includes("vc_auto")
      ) {
        return mediaId.replace(
          "/video/upload/",
          "/video/upload/q_auto,vc_auto,f_mp4/"
        );
      }
      return mediaId;
    }

    const cloudName = uploadService?.cloudName;

    if (cloudName && mediaId && !mediaId.includes(STORAGE_BUCKET)) {
      // [VID-FIX] Check if this is a video public ID
      const isVid = isVideoStatus({ image_id: mediaId, media_type: null });
      if (isVid) {
        // Strip any "video/" prefix Cloudinary may have stored
        const cleanId = mediaId.replace(/^video\//, "");
        return `https://res.cloudinary.com/${cloudName}/video/upload/q_auto,vc_auto,f_mp4/${cleanId}`;
      }
      return `https://res.cloudinary.com/${cloudName}/image/upload/q_auto,f_auto/${mediaId}`;
    }

    try {
      const { data: { publicUrl } } = supabase.storage
        .from(STORAGE_BUCKET)
        .getPublicUrl(mediaId);
      return publicUrl || null;
    } catch {
      return null;
    }
  }

  _cloudinaryVideoThumb(publicId) {
    const cloudName = uploadService?.cloudName;
    if (!cloudName || !publicId) return null;
    const cleanId = publicId.replace(/^video\//, "");
    return `https://res.cloudinary.com/${cloudName}/video/upload/so_0,w_400,h_400,c_fill,f_jpg/${cleanId}.jpg`;
  }

  // ==========================================================================
  // [VID-2] UPLOAD — Cloudinary first, Supabase fallback
  // ==========================================================================
  async uploadMedia(file, onProgress = null) {
    if (!file) throw new Error("No file provided");

    const isVideo = file.type.startsWith("video/") ||
      /\.(mp4|mov|webm|avi|mkv|m4v|mpeg|mpg|ogv|3gp|flv|wmv)$/i.test(file.name || "");
    const isImage = file.type.startsWith("image/") ||
      /\.(jpg|jpeg|png|gif|webp|avif|bmp)$/i.test(file.name || "");

    if (!isVideo && !isImage) {
      throw new Error("Unsupported file type. Only images and videos are allowed.");
    }

    const maxBytes = isVideo ? 100 * 1024 * 1024 : 20 * 1024 * 1024;
    if (file.size > maxBytes) {
      throw new Error(`File too large. Maximum: ${isVideo ? "100MB" : "20MB"}.`);
    }

    onProgress?.(5);

    const hasCloudinary = !!(uploadService?.cloudName && uploadService?.uploadPreset);

    if (hasCloudinary) {
      try {
        let result;
        if (isVideo) {
          result = await uploadService.uploadVideo(file, "grova/statuses", (p) => {
            onProgress?.(5 + Math.floor(p * 0.9));
          });
        } else {
          result = await uploadService.uploadImage(file, "grova/statuses");
          onProgress?.(95);
        }

        const publicId = result.public_id || result.id;
        const cloudName = uploadService.cloudName;
        let url = result.url || result.secure_url;

        if (isVideo && cloudName && publicId) {
          const cleanId = publicId.replace(/^video\//, "");
          url = `https://res.cloudinary.com/${cloudName}/video/upload/q_auto,vc_auto,f_mp4/${cleanId}`;
        }

        onProgress?.(100);

        return {
          id: publicId,
          url,
          type: isVideo ? "video" : "image",
          size: result.bytes || file.size,
          mimeType: isVideo ? "video/mp4" : file.type,
          thumbnailUrl: isVideo ? this._cloudinaryVideoThumb(publicId) : url,
        };
      } catch (cloudErr) {
        console.warn("[StatusSvc] Cloudinary upload failed, trying Supabase:", cloudErr.message);
      }
    }

    return this._uploadToStorage(file, isVideo, onProgress);
  }

  async _uploadToStorage(file, isVideo, onProgress) {
    const ext = file.name?.split(".").pop()?.toLowerCase() || (isVideo ? "mp4" : "jpg");
    const id = `${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    const path = `${id}.${ext}`;

    onProgress?.(10);

    const { data, error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(path, file, {
        contentType: file.type || (isVideo ? "video/mp4" : "image/jpeg"),
        cacheControl: "86400",
        upsert: false,
      });

    if (error) throw error;
    onProgress?.(100);

    const { data: { publicUrl } } = supabase.storage
      .from(STORAGE_BUCKET)
      .getPublicUrl(data.path);

    return {
      id: data.path,
      url: publicUrl,
      type: isVideo ? "video" : "image",
      size: file.size,
      mimeType: file.type,
    };
  }

  async deleteMedia(mediaId) {
    if (!mediaId || typeof mediaId !== "string") return;
    if (mediaId.startsWith("http")) return;
    if (!mediaId.includes(".")) return;
    try {
      await supabase.storage.from(STORAGE_BUCKET).remove([mediaId]);
    } catch (err) {
      console.warn("[StatusSvc] deleteMedia non-fatal:", err.message);
    }
  }

  // ==========================================================================
  // [RPL-1] REPLY PAYLOAD
  // ==========================================================================
  getReplyPayload(status, replyText) {
    if (!status) return replyText || "";
    const thumbnailUrl = this.getMediaUrl(status.image_id) || null;
    const payload = {
      type: "status_reply",
      statusId: status.id,
      statusUserId: status.user_id,
      text: replyText?.trim() || "",
      previewText: status.text?.slice(0, 80) || null,
      thumbnailUrl,
      bg: status.bg || null,
      textColor: status.text_color || "#fff",
      mediaType: status.media_type || "text",
      authorName: status.profile?.full_name || status.profile?.username || "User",
    };
    return `__STATUS_REPLY__:${JSON.stringify(payload)}`;
  }

  parseStatusReply(content) {
    if (!content?.startsWith("__STATUS_REPLY__:")) return null;
    try {
      return JSON.parse(content.replace("__STATUS_REPLY__:", ""));
    } catch {
      return null;
    }
  }

  // ==========================================================================
  // CRUD
  // ==========================================================================
  async create({ userId, text, bg, textColor, duration, media }) {
    if (!userId) throw new Error("userId is required");
    if (!text?.trim() && !media?.id) throw new Error("Either text or media is required");

    const mediaType = media
      ? (media.type === "video" || isVideoStatus({ image_id: media.id, media_type: media.type }) ? "video" : "image")
      : "text";

    const row = {
      user_id: userId,
      text: text?.trim() || null,
      bg: media?.id ? null : (bg || null),
      text_color: textColor || "#ffffff",
      duration_h: duration || 24,
      expires_at: new Date(Date.now() + (duration || 24) * 3_600_000).toISOString(),
      views: 0,
      likes: 0,
      media_type: mediaType,
    };

    if (media?.id) {
      row.image_id = media.id;
      row.media_type = mediaType;
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
      if (error.code === "42P01" || error.message?.includes("does not exist")) {
        return { data: [], tableError: true };
      }
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
    const base = new Date(Math.max(new Date(s.expires_at), Date.now()));
    const newExpiry = new Date(base.getTime() + hours * 3_600_000).toISOString();

    const { error } = await supabase
      .from("status_updates")
      .update({ expires_at: newExpiry })
      .eq("id", statusId)
      .eq("user_id", userId);

    if (error) throw error;
    return newExpiry;
  }

  // ==========================================================================
  // [LIKE-1] LIKES — [ESL-1] async IIFE, never .catch() on rpc()
  // ==========================================================================
  async like(statusId, userId) {
    if (!statusId || !userId) return;

    const { error: likeErr } = await supabase
      .from("status_likes")
      .insert({ status_id: statusId, user_id: userId });

    if (likeErr && likeErr.code !== "23505") throw likeErr;

    (async () => {
      try {
        await supabase.rpc("increment_status_likes", { p_status_id: statusId, p_delta: 1 });
      } catch {
        try {
          const { data: cur } = await supabase
            .from("status_updates").select("likes").eq("id", statusId).maybeSingle();
          if (cur !== null) {
            await supabase.from("status_updates")
              .update({ likes: Math.max(0, (cur.likes || 0) + 1) })
              .eq("id", statusId);
          }
        } catch (e) { console.warn("[StatusSvc] like fallback:", e.message); }
      }
    })();
  }

  async unlike(statusId, userId) {
    if (!statusId || !userId) return;

    await supabase
      .from("status_likes")
      .delete()
      .eq("status_id", statusId)
      .eq("user_id", userId);

    (async () => {
      try {
        await supabase.rpc("increment_status_likes", { p_status_id: statusId, p_delta: -1 });
      } catch {
        try {
          const { data: cur } = await supabase
            .from("status_updates").select("likes").eq("id", statusId).maybeSingle();
          if (cur !== null) {
            await supabase.from("status_updates")
              .update({ likes: Math.max(0, (cur.likes || 0) - 1) })
              .eq("id", statusId);
          }
        } catch (e) { console.warn("[StatusSvc] unlike fallback:", e.message); }
      }
    })();
  }

  // ==========================================================================
  // [VIEW-1] RECORD VIEW — [ESL-1]
  // ==========================================================================
  async recordView(statusId, viewerId, ownerId) {
    if (!statusId) return;
    if (viewerId && viewerId === ownerId) return;

    const key = `sv:${statusId}`;
    if (this._sessionViews.has(key)) return;
    this._sessionViews.add(key);

    try {
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, "1");
    } catch {}

    (async () => {
      try {
        await supabase.rpc("increment_status_views", { p_status_id: statusId });
      } catch {
        try {
          const { data: cur } = await supabase
            .from("status_updates").select("views").eq("id", statusId).maybeSingle();
          if (cur !== null) {
            await supabase.from("status_updates")
              .update({ views: (cur.views || 0) + 1 })
              .eq("id", statusId);
          }
        } catch {}
      }
    })();
  }

  // ==========================================================================
  // [RT-1] REALTIME
  // ==========================================================================
  subscribe(callback) {
    this._listeners.add(callback);

    if (!this._realtimeChannel) {
      this._realtimeChannel = supabase
        .channel("status_updates_rt_v9")
        .on("postgres_changes",
          { event: "*", schema: "public", table: "status_updates" },
          () => { this._listeners.forEach(cb => { try { cb(); } catch {} }); }
        )
        .on("postgres_changes",
          { event: "*", schema: "public", table: "status_likes" },
          () => { this._listeners.forEach(cb => { try { cb(); } catch {} }); }
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