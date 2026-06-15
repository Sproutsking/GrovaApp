// ============================================================================
// src/services/messages/statusUpdateService.js — v4 PRODUCTION
// ============================================================================
//
// FIXES vs v3:
//   [FIX-1]  music column is optional — if Supabase schema cache doesn't have
//            it yet, create() strips it from the row and retries. No more
//            "Could not find the 'music' column" hard failure.
//
//   [FIX-2]  The SELECT fragment is split into a base set (always safe) and
//            an extended set (with media_type + music). loadAll / loadForUser
//            already had this fallback pattern but create() did not — now fixed.
//
//   [FIX-3]  _musicColExists flag is module-level so we only probe once per
//            session, not on every create() call.
//
// SQL to run once (idempotent):
// ─────────────────────────────────────────────────────────────────────────────
//   ALTER TABLE public.status_updates
//     ADD COLUMN IF NOT EXISTS media_type text DEFAULT 'text',
//     ADD COLUMN IF NOT EXISTS music      text;
// ─────────────────────────────────────────────────────────────────────────────

import { supabase } from "../config/supabase";

// ── Lazy cache (avoids circular import) ──────────────────────────────────────
let _cache = null;
async function getCache() {
  if (_cache) return _cache;
  try {
    const m = await import("../shared/cacheService");
    _cache = m.default;
  } catch {
    _cache = { get: () => null, set: () => {}, invalidate: () => {}, invalidatePattern: () => {} };
  }
  return _cache;
}

const BUCKET    = "status-media";
const CACHE_TTL = 60_000;

// ── Module-level schema probe flag ────────────────────────────────────────────
// null = not tested yet, true = exists, false = missing
let _musicColExists   = null;
let _mediaTypeColExists = null;

async function probeMusicCol() {
  if (_musicColExists !== null) return _musicColExists;
  try {
    const { error } = await supabase
      .from("status_updates")
      .select("music")
      .limit(1);
    _musicColExists = !error;
  } catch {
    _musicColExists = false;
  }
  return _musicColExists;
}

async function probeMediaTypeCol() {
  if (_mediaTypeColExists !== null) return _mediaTypeColExists;
  try {
    const { error } = await supabase
      .from("status_updates")
      .select("media_type")
      .limit(1);
    _mediaTypeColExists = !error;
  } catch {
    _mediaTypeColExists = false;
  }
  return _mediaTypeColExists;
}

// Reset probes (call after running migrations)
export function resetSchemaProbes() {
  _musicColExists    = null;
  _mediaTypeColExists = null;
}

// ── Named export: video detection ────────────────────────────────────────────
export function isVideoStatus(s) {
  if (!s) return false;
  if (s.media_type === "video") return true;
  if (!s.image_id) return false;
  const id = String(s.image_id);
  if (id.includes("/video/upload/")) return true;
  if (/\.(mp4|mov|webm|m4v|avi|mkv|mpeg|mpg|ogv|3gp)(\?|$)/i.test(id)) return true;
  return false;
}

// ── DB select fragments ───────────────────────────────────────────────────────
const SELECT_BASE = `
  id, text, bg, text_color, image_id,
  duration_h, views, likes, created_at, expires_at, user_id,
  profile:profiles!status_updates_user_id_fkey(
    id, full_name, username, avatar_id, verified
  )
`;

const SELECT_FULL = `
  id, text, bg, text_color, image_id, media_type, music,
  duration_h, views, likes, created_at, expires_at, user_id,
  profile:profiles!status_updates_user_id_fkey(
    id, full_name, username, avatar_id, verified
  )
`;

// ── Atomic counter ────────────────────────────────────────────────────────────
async function atomicIncrement(table, id, column, delta = 1) {
  try {
    const { error } = await supabase.rpc("increment_count", {
      p_table: table, p_id: id, p_column: column, p_delta: delta,
    });
    if (!error) return true;
    throw error;
  } catch {
    try {
      const { data } = await supabase.from(table).select(column).eq("id", id).single();
      const cur = data?.[column] ?? 0;
      await supabase.from(table).update({ [column]: Math.max(0, cur + delta) }).eq("id", id);
      return true;
    } catch { return false; }
  }
}

// ── Auth helper ───────────────────────────────────────────────────────────────
async function requireAuth() {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) throw new Error("You must be logged in to post a status");
  return user;
}

// ════════════════════════════════════════════════════════════════════════════
class StatusUpdateService {
  constructor() {
    this._channel      = null;
    this._listeners    = new Set();
    this._sessionViews = new Set();
  }

  // ══════════════════════════════════════════════════════════════════════════
  // MEDIA UPLOAD
  // ══════════════════════════════════════════════════════════════════════════

  async uploadMedia(file, onProgress = null) {
    if (!file) throw new Error("No file provided");

    await requireAuth();

    const isVideo = file.type.startsWith("video/");
    const isImage = file.type.startsWith("image/");

    if (!isVideo && !isImage) {
      const ext = (file.name?.split(".").pop() || "").toLowerCase();
      const vExts = ["mp4","mov","avi","webm","m4v","mpeg","mpg","ogv"];
      const iExts = ["jpg","jpeg","png","gif","webp","avif","heic"];
      if (!vExts.includes(ext) && !iExts.includes(ext)) {
        throw new Error("Only images and videos are supported.");
      }
    }

    const maxBytes = isVideo ? 100 * 1024 * 1024 : 20 * 1024 * 1024;
    if (file.size > maxBytes) {
      throw new Error(`File too large. Maximum: ${isVideo ? "100 MB" : "20 MB"}.`);
    }
    if (file.size < 100) throw new Error("File too small — may be corrupted.");

    const ext  = (file.name?.split(".").pop() || (isVideo ? "mp4" : "jpg")).toLowerCase();
    const name = `${Date.now()}_${Math.random().toString(36).slice(2, 9)}.${ext}`;

    onProgress?.(5);

    const { data, error } = await supabase.storage.from(BUCKET).upload(name, file, {
      contentType:  file.type || (isVideo ? "video/mp4" : "image/jpeg"),
      cacheControl: "86400",
      upsert:       false,
    });

    if (error) { onProgress?.(0); throw new Error(error.message || "Upload failed"); }

    onProgress?.(100);

    const { data: { publicUrl } } = supabase.storage.from(BUCKET).getPublicUrl(data.path);

    return {
      id:       data.path,
      url:      publicUrl,
      type:     isVideo ? "video" : "image",
      size:     file.size,
      mimeType: file.type,
    };
  }

  getMediaUrl(mediaId) {
    if (!mediaId) return null;
    if (typeof mediaId === "string" && mediaId.startsWith("http")) return mediaId;
    try {
      const { data: { publicUrl } } = supabase.storage.from(BUCKET).getPublicUrl(mediaId);
      return publicUrl || null;
    } catch { return null; }
  }

  async deleteMedia(mediaId) {
    if (!mediaId || String(mediaId).startsWith("http")) return;
    try { await supabase.storage.from(BUCKET).remove([mediaId]); } catch {}
  }

  // ══════════════════════════════════════════════════════════════════════════
  // CREATE — [FIX-1] gracefully handles missing music / media_type columns
  // ══════════════════════════════════════════════════════════════════════════

  async create({ userId, text, bg, textColor, duration = 24, media = null, sound = null }) {
    if (!userId) throw new Error("userId required");
    if (!text?.trim() && !media?.id) throw new Error("Text or media required");

    await requireAuth();

    // Probe schema once per session
    const [hasMusicCol, hasMediaTypeCol] = await Promise.all([
      probeMusicCol(),
      probeMediaTypeCol(),
    ]);

    // Build row — only include optional columns if they exist in schema
    const row = {
      user_id:    userId,
      text:       text?.trim() || null,
      bg:         media?.id ? null : (bg || null),
      text_color: textColor || "#ffffff",
      duration_h: duration,
      expires_at: new Date(Date.now() + duration * 3_600_000).toISOString(),
      views:      0,
      likes:      0,
    };

    if (hasMediaTypeCol) {
      row.media_type = media?.type || "text";
    }

    if (hasMusicCol) {
      row.music = sound?.name || null;
    }

    if (media?.id) {
      row.image_id = media.id;
      if (hasMediaTypeCol) {
        row.media_type = media.type || "image";
      }
    }

    // Try with full select first
    try {
      const selectFragment = (hasMusicCol && hasMediaTypeCol) ? SELECT_FULL : SELECT_BASE;
      const { data, error } = await supabase
        .from("status_updates")
        .insert(row)
        .select(selectFragment)
        .single();

      if (error) throw error;

      // Track sound usage async
      if (sound?.name && hasMusicCol) {
        this._trackSoundUsage(sound.name, userId).catch(() => {});
      }

      (await getCache()).invalidatePattern("su:");
      return data;
    } catch (err) {
      // [FIX-1] If error mentions music column, strip it and retry once
      if (
        err?.message?.includes("music") ||
        err?.message?.includes("schema cache")
      ) {
        _musicColExists = false;
        const { music: _dropped, ...safeRow } = row;
        const { data, error: err2 } = await supabase
          .from("status_updates")
          .insert(safeRow)
          .select(SELECT_BASE)
          .single();
        if (err2) throw err2;
        (await getCache()).invalidatePattern("su:");
        return data;
      }
      throw err;
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // READ
  // ══════════════════════════════════════════════════════════════════════════

  async loadAll(offset = 0, limit = 60) {
    try {
      const cache = await getCache();
      const key   = `su:all:${offset}:${limit}`;
      const hit   = cache.get(key);
      if (hit) return hit;

      // Try extended select first, fall back to base
      let data = null;
      try {
        const { data: d, error } = await supabase
          .from("status_updates")
          .select(SELECT_FULL)
          .gt("expires_at", new Date().toISOString())
          .order("created_at", { ascending: false })
          .range(offset, offset + limit - 1);

        if (error) {
          if (error.code === "42P01" || error.message?.includes("does not exist"))
            return { data: [], tableError: true };
          throw error;
        }
        data = d;
      } catch (err) {
        if (err?.message?.includes("music") || err?.message?.includes("schema cache")) {
          _musicColExists = false;
          const { data: d2, error: e2 } = await supabase
            .from("status_updates")
            .select(SELECT_BASE)
            .gt("expires_at", new Date().toISOString())
            .order("created_at", { ascending: false })
            .range(offset, offset + limit - 1);
          if (e2) throw e2;
          data = (d2 || []).map((s) => ({ ...s, media_type: s.image_id ? "image" : "text", music: null }));
        } else {
          throw err;
        }
      }

      const result = { data: data || [], tableError: false };
      cache.set(key, result, CACHE_TTL);
      return result;
    } catch { return { data: [], tableError: false }; }
  }

  async loadForUser(userId) {
    if (!userId) return [];
    try {
      const cache = await getCache();
      const key   = `su:user:${userId}`;
      const hit   = cache.get(key);
      if (hit) return hit;

      let data = null;
      try {
        const { data: d, error } = await supabase
          .from("status_updates")
          .select(SELECT_FULL)
          .eq("user_id", userId)
          .gt("expires_at", new Date().toISOString())
          .order("created_at", { ascending: false });

        if (error) { if (error.code === "42P01") return []; throw error; }
        data = d;
      } catch (err) {
        if (err?.message?.includes("music") || err?.message?.includes("schema cache")) {
          _musicColExists = false;
          const { data: d2, error: e2 } = await supabase
            .from("status_updates")
            .select(SELECT_BASE)
            .eq("user_id", userId)
            .gt("expires_at", new Date().toISOString())
            .order("created_at", { ascending: false });
          if (e2) throw e2;
          data = (d2 || []).map((s) => ({ ...s, media_type: s.image_id ? "image" : "text", music: null }));
        } else {
          throw err;
        }
      }

      const result = data || [];
      cache.set(key, result, CACHE_TTL);
      return result;
    } catch { return []; }
  }

  async loadMyLikes(userId, statusIds) {
    if (!userId || !statusIds?.length) return new Set();
    try {
      const { data } = await supabase
        .from("status_likes")
        .select("status_id")
        .eq("user_id", userId)
        .in("status_id", statusIds);
      return new Set((data || []).map((r) => r.status_id));
    } catch { return new Set(); }
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
    (await getCache()).invalidatePattern("su:");
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
    (await getCache()).invalidatePattern("su:");
    return newExpiry;
  }

  // ══════════════════════════════════════════════════════════════════════════
  // INTERACTIONS
  // ══════════════════════════════════════════════════════════════════════════

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
      await supabase.from("status_likes").insert([{ status_id: statusId, user_id: userId }]);
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

  // ══════════════════════════════════════════════════════════════════════════
  // SOUND TRACKING — only runs if music col exists
  // ══════════════════════════════════════════════════════════════════════════

  async _trackSoundUsage(soundName, userId) {
    try {
      const { error } = await supabase.from("sounds").upsert(
        { name: soundName, first_used_by: userId || null, total_uses: 1 },
        { onConflict: "name", ignoreDuplicates: false }
      );
      if (error) {
        const { data: ex } = await supabase.from("sounds").select("id, total_uses").eq("name", soundName).maybeSingle();
        if (ex) {
          await supabase.from("sounds").update({ total_uses: (ex.total_uses || 0) + 1 }).eq("id", ex.id);
        } else {
          await supabase.from("sounds").insert({ name: soundName, first_used_by: userId, total_uses: 1 });
        }
      }
    } catch (e) { console.warn("[StatusService] trackSound:", e?.message); }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // DM REPLY PAYLOAD
  // ══════════════════════════════════════════════════════════════════════════

  getReplyPayload(status, replyText) {
    const author  = status?.profile?.username || status?.profile?.full_name || "someone";
    const preview = status?.text
      ? `"${status.text.slice(0, 60)}${status.text.length > 60 ? "…" : ""}"`
      : status?.media_type === "video" ? "🎥 video status" : "📷 photo status";
    return `↩ Replied to @${author}'s status ${preview}:\n\n${replyText}`;
  }

  // ══════════════════════════════════════════════════════════════════════════
  // REALTIME
  // ══════════════════════════════════════════════════════════════════════════

  subscribe(cb) {
    this._listeners.add(cb);
    if (!this._channel) {
      this._channel = supabase
        .channel("su_rt_v4")
        .on("postgres_changes", { event: "*", schema: "public", table: "status_updates" }, () => {
          this._listeners.forEach((fn) => { try { fn(); } catch {} });
        })
        .subscribe();
    }
    return () => {
      this._listeners.delete(cb);
      if (this._listeners.size === 0 && this._channel) {
        try { supabase.removeChannel(this._channel); } catch {}
        this._channel = null;
      }
    };
  }

  // ══════════════════════════════════════════════════════════════════════════
  // LIFECYCLE
  // ══════════════════════════════════════════════════════════════════════════

  resetSession() { this._sessionViews.clear(); }

  cleanup() {
    this._listeners.clear();
    if (this._channel) {
      try { supabase.removeChannel(this._channel); } catch {}
      this._channel = null;
    }
    this._sessionViews.clear();
  }
}

export default new StatusUpdateService();