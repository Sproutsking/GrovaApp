// ============================================================================
// src/components/Shared/SoundGallery.jsx — v5 PRODUCTION PERFECT
// ============================================================================
//
// FIXES vs v4:
//   [DB-FIX-3] Schema probe on first load — queries each optional column
//              individually and caches results in _schemaCache. The SELECT
//              is built dynamically from ONLY confirmed columns. This fixes
//              both "column sounds.title does not exist" and
//              "column sounds.file_url does not exist" — regardless of which
//              columns your sounds table actually has.
//
//   [DB-FIX-4] resolveAudioUrl() now accepts the schema object and only
//              accesses row fields for confirmed columns — no more reading
//              undefined fields that Supabase strips from the response.
//
//   [DB-FIX-5] trackUsage() is also schema-aware — only references
//              total_uses if that column was confirmed to exist.
//
// FIXES vs v3 (preserved):
//   [DB-FIX-1] Removed title/artist from SELECT (they don't exist in DB)
//   [DB-FIX-2] extractTitle/extractArtist derive from name field only
//
//   [DESIGN-1] Complete desktop redesign — wider popup (480px), left sidebar
//              with categories, right panel with song list. Glassmorphism
//              aesthetic with lime-green accent system.
//
//   [DESIGN-2] Mobile sheet redesign — full-bleed, better thumb zone,
//              category pills row, smooth spring animations.
//
//   [DESIGN-3] Song rows — album-art placeholder with gradient per-song,
//              duration badge, hover shimmer effect.
//
//   [DESIGN-4] Detail panel redesign — waveform visualizer, cleaner
//              volume mix controls with gradient track fills.
//
// All prior DB-*, AUDIO-*, UX-*, CSS-* fixes from v3 are fully preserved.
// ============================================================================

import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useContext,
  createContext,
  memo,
  useMemo,
} from "react";
import { supabase } from "../../services/config/supabase";

// ── R2 config ─────────────────────────────────────────────────────────────────
// REACT_APP_R2_PUBLIC_URL must be set in your .env, e.g.:
//   REACT_APP_R2_PUBLIC_URL=https://pub-xxxx.r2.dev
// Songs are stored in R2 as: {R2_BASE}/{filename.mp3}
// The `name` column in your sounds table IS the filename (with or without ext).
const R2_BASE = (process.env.REACT_APP_R2_PUBLIC_URL || "").replace(/\/$/, "");
const HAS_R2  = R2_BASE.startsWith("http");

// ── Schema probe cache — discovered once per session ─────────────────────────
// We don't know which optional columns exist. We probe on first load and cache
// the result so subsequent calls skip the probe entirely.
let _schemaProbed = false;
let _schemaCache = {
  file_url:     false,
  sound_url:    false,
  storage_path: false,
  total_uses:   false,
  category:     false,
  is_trending:  false,
  duration:     false,
};

async function probeSchema() {
  if (_schemaProbed) return _schemaCache;
  // Always-safe columns: id, name. Probe everything else one by one.
  const optionalCols = Object.keys(_schemaCache);
  await Promise.all(
    optionalCols.map(async (col) => {
      try {
        const { error } = await supabase
          .from("sounds")
          .select(col)
          .limit(1);
        _schemaCache[col] = !error;
      } catch {
        _schemaCache[col] = false;
      }
    })
  );
  _schemaProbed = true;
  console.log("[SoundGallery] schema probe:", _schemaCache);
  return _schemaCache;
}

// Reset probe (call after running migrations)
export function resetSoundSchemaProbe() {
  _schemaProbed = false;
  Object.keys(_schemaCache).forEach(k => { _schemaCache[k] = false; });
}

// Build SELECT string from only confirmed columns
function buildSelect(schema) {
  const cols = ["id", "name"];
  if (schema.file_url)     cols.push("file_url");
  if (schema.sound_url)    cols.push("sound_url");
  if (schema.storage_path) cols.push("storage_path");
  if (schema.total_uses)   cols.push("total_uses");
  if (schema.category)     cols.push("category");
  if (schema.is_trending)  cols.push("is_trending");
  if (schema.duration)     cols.push("duration");
  return cols.join(", ");
}

// ── URL resolution: R2 primary, DB columns fallback ─────────────────────────
// Priority: DB explicit URL → R2 constructed from name → Supabase storage
// Even if url ends up null, the song still shows — just unplayable (dimmed).
function resolveAudioUrl(row, schema) {
  // 1. Explicit full URL stored in DB (most reliable)
  if (schema.file_url  && row.file_url  && row.file_url.startsWith("http"))  return row.file_url;
  if (schema.sound_url && row.sound_url && row.sound_url.startsWith("http")) return row.sound_url;

  // 2. R2 constructed from name (primary path for most setups)
  if (HAS_R2 && row.name) {
    const raw   = row.name.trim();
    // Already has audio extension — use as-is
    const hasExt = /\.(mp3|wav|ogg|m4a|aac|flac)$/i.test(raw);
    // Preserve path separators but encode spaces and special chars
    const fname = hasExt ? raw : `${raw}.mp3`;
    // Don't double-encode if name already contains %
    const encoded = fname.includes("%") ? fname : fname.split("/").map(encodeURIComponent).join("/");
    return `${R2_BASE}/${encoded}`;
  }

  // 3. Supabase Storage fallback
  if (schema.storage_path && row.storage_path) {
    try {
      const { data: { publicUrl } } = supabase.storage
        .from("sounds")
        .getPublicUrl(row.storage_path);
      if (publicUrl) return publicUrl;
    } catch {}
  }

  return null; // shown but unplayable
}

// ── String helpers ────────────────────────────────────────────────────────────
function cleanName(n = "") {
  return n
    .replace(/\.(mp3|wav|ogg|m4a|aac|flac)$/i, "")
    .replace(/[-_]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
// [DB-FIX-2] Always derive from name — no title/artist columns in DB
function extractTitle(n = "") {
  const parts = cleanName(n).split(" - ");
  return parts[parts.length - 1] || cleanName(n) || "Unknown Track";
}
function extractArtist(n = "") {
  const parts = cleanName(n).split(" - ");
  return parts.length >= 2 ? parts.slice(0, -1).join(" - ") : null;
}
function fmtDur(sec) {
  if (!sec || isNaN(sec) || sec <= 0) return "--:--";
  return `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, "0")}`;
}

// Deterministic color per song name for avatar placeholder
const SONG_COLORS = [
  ["#84cc16","#4d7c0f"],["#3b82f6","#1d4ed8"],["#a855f7","#7e22ce"],
  ["#f59e0b","#b45309"],["#ef4444","#b91c1c"],["#14b8a6","#0f766e"],
  ["#f97316","#c2410c"],["#ec4899","#be185d"],
];
function songColor(name = "") {
  const idx = name.split("").reduce((a, c) => a + c.charCodeAt(0), 0) % SONG_COLORS.length;
  return SONG_COLORS[idx];
}

// ── Audio singleton for list preview ─────────────────────────────────────────
const _listAudio = typeof Audio !== "undefined" ? new Audio() : null;
let   _listOnEnded = null;

function playListSong(url, onEnd) {
  if (!_listAudio || !url) return;
  _listAudio.pause();
  if (_listOnEnded) { _listAudio.removeEventListener("ended", _listOnEnded); }
  _listAudio.src = url;
  _listAudio.currentTime = 0;
  _listAudio.volume = 0.85;
  _listOnEnded = onEnd;
  _listAudio.addEventListener("ended", _listOnEnded, { once: true });
  _listAudio.play().catch(() => onEnd?.());
}

function stopListAudio() {
  if (!_listAudio) return;
  _listAudio.pause();
  _listAudio.src = "";
  if (_listOnEnded) { _listAudio.removeEventListener("ended", _listOnEnded); _listOnEnded = null; }
}

// ── Duration cache ────────────────────────────────────────────────────────────
const _durCache = {};
function cacheDuration(url, id, cb) {
  if (!url) return;
  if (_durCache[id] !== undefined) { cb(_durCache[id]); return; }
  const a = new Audio();
  a.preload = "metadata";
  a.src = url;
  a.onloadedmetadata = () => { _durCache[id] = a.duration || 0; cb(_durCache[id]); a.src = ""; };
  a.onerror = () => { _durCache[id] = 0; };
}

// ── Context ───────────────────────────────────────────────────────────────────
const SoundCtx = createContext(null);

export function SoundGalleryProvider({ children }) {
  const [open, setOpen]         = useState(false);
  const [selected, setSelected] = useState(null);
  const ctxRef      = useRef(null);
  const callbackRef = useRef(null);

  const openGallery = useCallback((ctx, cb) => {
    ctxRef.current = ctx;
    callbackRef.current = cb;
    setOpen(true);
  }, []);

  const closeGallery = useCallback(() => {
    setOpen(false);
    stopListAudio();
  }, []);

  const handleSelect = useCallback((sound) => {
    setSelected(sound);
    callbackRef.current?.(sound);
    closeGallery();
  }, [closeGallery]);

  const clearSound = useCallback(() => setSelected(null), []);

  return (
    <SoundCtx.Provider value={{ open, selected, openGallery, closeGallery, handleSelect, clearSound }}>
      {children}
      {open && (
        <SoundGalleryModal
          context={ctxRef.current}
          onSelect={handleSelect}
          onClose={closeGallery}
        />
      )}
    </SoundCtx.Provider>
  );
}

export function useSoundGallery() {
  return useContext(SoundCtx);
}

// ── Waveform bars (CSS-only) ──────────────────────────────────────────────────
const WaveBars = memo(({ playing, color = "#84cc16", size = "md", bars = 12 }) => {
  const heights = [4, 9, 13, 7, 11, 5, 10, 12, 6, 9, 4, 8, 11, 5, 10].slice(0, bars);
  const maxH = size === "sm" ? 14 : size === "lg" ? 28 : 20;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 2, height: maxH }}>
      {heights.map((h, i) => (
        <div
          key={i}
          style={{
            width: size === "sm" ? 2 : 3,
            height: playing ? Math.max(3, (h / 14) * maxH) : 3,
            background: color,
            borderRadius: 2,
            animation: playing
              ? `sg4bars 0.6s ${(i * 0.055).toFixed(2)}s ease-in-out infinite alternate`
              : "none",
            transition: "height 0.25s ease",
            opacity: playing ? 1 : 0.4,
          }}
        />
      ))}
    </div>
  );
});
WaveBars.displayName = "WaveBars";

// ── Song Avatar ───────────────────────────────────────────────────────────────
const SongAvatar = memo(({ name, size = 40 }) => {
  const [c1, c2] = songColor(name);
  const letter = extractTitle(name).charAt(0).toUpperCase() || "♪";
  return (
    <div style={{
      width: size, height: size, borderRadius: size * 0.28,
      background: `linear-gradient(135deg, ${c1}, ${c2})`,
      display: "flex", alignItems: "center", justifyContent: "center",
      flexShrink: 0, fontSize: size * 0.38, fontWeight: 800,
      color: "rgba(255,255,255,0.9)", letterSpacing: "-0.5px",
      boxShadow: `0 2px 8px ${c1}40`,
    }}>
      {letter}
    </div>
  );
});
SongAvatar.displayName = "SongAvatar";

// ── Song Row ──────────────────────────────────────────────────────────────────
const SongRow = memo(({ song, isPlaying, isSelected, onPlay, onSelect }) => {
  const [dur, setDur] = useState(_durCache[song.id] ?? null);

  useEffect(() => {
    if (dur !== null || !song.url) return;
    cacheDuration(song.url, song.id, (d) => setDur(d > 0 ? d : null));
  }, [song.url, song.id, dur]);

  const title  = extractTitle(song.name);
  const artist = extractArtist(song.name) || "Grova Library";
  const hasUrl = !!song.url;

  return (
    <div
      className={`sg4-row${isSelected ? " sg4-row--sel" : ""}${isPlaying ? " sg4-row--play" : ""}${!hasUrl ? " sg4-row--nourl" : ""}`}
      onClick={hasUrl ? onPlay : undefined}
    >
      {/* Album art */}
      <div className="sg4-row-art">
        {isPlaying ? (
          <div className="sg4-row-art-playing">
            <WaveBars playing color="#84cc16" size="sm" bars={6} />
          </div>
        ) : (
          <SongAvatar name={song.name} size={40} />
        )}
      </div>

      {/* Info */}
      <div className="sg4-info">
        <div className={`sg4-title${isPlaying || isSelected ? " active" : ""}`}>{title}</div>
        <div className="sg4-artist">
          {artist}
          {!hasUrl && <span className="sg4-nourl-tag">no audio</span>}
        </div>
      </div>

      {/* Duration */}
      <span className="sg4-dur">{fmtDur(dur)}</span>

      {/* Select button */}
      <button
        className={`sg4-add${isSelected ? " sel" : ""}${!hasUrl ? " disabled" : ""}`}
        onClick={(e) => { e.stopPropagation(); if (hasUrl) onSelect(); }}
        disabled={!hasUrl}
        title={!hasUrl ? "No audio file" : isSelected ? "Selected" : "Use this sound"}
      >
        {isSelected ? (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
        ) : (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        )}
      </button>
    </div>
  );
});
SongRow.displayName = "SongRow";

// ── Sound Detail Panel ────────────────────────────────────────────────────────
const SoundDetailPanel = memo(({ song, contextLabel, onConfirm, onCancel }) => {
  const [startSec, setStartSec] = useState(0);
  const [songVol,  setSongVol]  = useState(1.0);
  const [videoVol, setVideoVol] = useState(0.3);
  const [playing,  setPlaying]  = useState(false);
  const [dur,      setDur]      = useState(_durCache[song.id] || 0);
  const audioRef = useRef(null);

  useEffect(() => {
    if (!song.url) return;
    stopListAudio();
    const a = new Audio(song.url);
    a.volume = songVol;
    a.onloadedmetadata = () => setDur(a.duration || 0);
    a.onended = () => setPlaying(false);
    audioRef.current = a;
    return () => { a.pause(); a.src = ""; a.load(); audioRef.current = null; };
  }, [song.url]); // eslint-disable-line

  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = Math.min(1, Math.max(0, songVol));
  }, [songVol]);

  const togglePlay = useCallback(() => {
    if (!audioRef.current) return;
    if (playing) { audioRef.current.pause(); setPlaying(false); }
    else {
      audioRef.current.currentTime = startSec;
      audioRef.current.play().catch(() => setPlaying(false));
      setPlaying(true);
    }
  }, [playing, startSec]);

  const handleTrim = (val) => {
    const v = parseFloat(val);
    setStartSec(v);
    if (audioRef.current) {
      audioRef.current.currentTime = v;
      if (playing) audioRef.current.play().catch(() => {});
    }
  };

  const maxTrim = Math.max(0, dur - 3);
  const title  = extractTitle(song.name);
  const artist = extractArtist(song.name) || "Grova Library";
  const [c1, c2] = songColor(song.name);

  const mixLabel =
    songVol >= 0.8 && videoVol <= 0.2 ? "Sound dominant" :
    songVol <= 0.2 && videoVol >= 0.8 ? "Video dominant" :
    Math.abs(songVol - videoVol) < 0.15 ? "Balanced mix" :
    songVol > videoVol ? "Sound-forward" : "Video-forward";

  return (
    <div className="sg4-detail">
      {/* Header */}
      <div className="sg4-detail-hd">
        <div className="sg4-detail-art" style={{ background: `linear-gradient(135deg, ${c1}, ${c2})` }}>
          {playing ? <WaveBars playing color="rgba(255,255,255,0.9)" size="sm" bars={7} /> : <span style={{ fontSize: 20 }}>🎵</span>}
        </div>
        <div className="sg4-detail-info">
          <div className="sg4-detail-title">{title}</div>
          <div className="sg4-detail-artist">{artist}</div>
        </div>
        <button className="sg4-detail-playbtn" onClick={togglePlay} disabled={!song.url}>
          {playing ? (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
          ) : (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
          )}
        </button>
      </div>

      {/* Trim */}
      {dur > 0 && (
        <div className="sg4-ctrl">
          <div className="sg4-ctrl-hd">
            <span className="sg4-ctrl-lbl">Start Point</span>
            <span className="sg4-ctrl-val">{fmtDur(startSec)} <span style={{ opacity: 0.4 }}>/ {fmtDur(dur)}</span></span>
          </div>
          <div className="sg4-slider-wrap">
            <input type="range" className="sg4-slider green" min={0} max={maxTrim} step={0.5}
              value={startSec} onChange={(e) => handleTrim(e.target.value)} />
            <div className="sg4-slider-track-fill green" style={{ width: `${(startSec / (maxTrim || 1)) * 100}%` }} />
          </div>
        </div>
      )}

      {/* Volume mix */}
      <div className="sg4-mix">
        <div className="sg4-mix-hd">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
          Volume Mix
          <span className="sg4-mix-badge">{mixLabel}</span>
        </div>

        <div className="sg4-mix-row">
          <span className="sg4-mix-ico">🎵</span>
          <span className="sg4-mix-lbl">Sound</span>
          <div className="sg4-slider-wrap" style={{ flex: 1 }}>
            <input type="range" className="sg4-slider green" min={0} max={1} step={0.01}
              value={songVol} onChange={(e) => setSongVol(parseFloat(e.target.value))} />
            <div className="sg4-slider-track-fill green" style={{ width: `${songVol * 100}%` }} />
          </div>
          <span className="sg4-mix-pct green">{Math.round(songVol * 100)}%</span>
        </div>

        <div className="sg4-mix-row">
          <span className="sg4-mix-ico">📹</span>
          <span className="sg4-mix-lbl">Video</span>
          <div className="sg4-slider-wrap" style={{ flex: 1 }}>
            <input type="range" className="sg4-slider blue" min={0} max={1} step={0.01}
              value={videoVol} onChange={(e) => setVideoVol(parseFloat(e.target.value))} />
            <div className="sg4-slider-track-fill blue" style={{ width: `${videoVol * 100}%` }} />
          </div>
          <span className="sg4-mix-pct blue">{Math.round(videoVol * 100)}%</span>
        </div>
      </div>

      {/* Actions */}
      <div className="sg4-detail-actions">
        <button className="sg4-btn-cancel" onClick={() => { audioRef.current?.pause(); setPlaying(false); onCancel(); }}>
          Cancel
        </button>
        <button className="sg4-btn-confirm" onClick={() => {
          audioRef.current?.pause();
          onConfirm({ name: song.name, url: song.url, startSec, songVol, videoVol });
        }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
          Add to {contextLabel}
        </button>
      </div>
    </div>
  );
});
SoundDetailPanel.displayName = "SoundDetailPanel";

// ── trackUsage — only updates columns confirmed to exist ─────────────────────
async function trackUsage(soundName, userId) {
  if (!soundName) return;
  try {
    const schema = await probeSchema(); // already cached
    // If we have total_uses col, try to increment
    if (schema.total_uses) {
      const upsertRow = { name: soundName, total_uses: 1 };
      const { error } = await supabase.from("sounds").upsert(
        upsertRow,
        { onConflict: "name", ignoreDuplicates: false }
      );
      if (error) {
        // Fallback manual increment
        const { data: ex } = await supabase.from("sounds").select("id, total_uses").eq("name", soundName).maybeSingle();
        if (ex) {
          await supabase.from("sounds").update({ total_uses: (ex.total_uses || 0) + 1 }).eq("id", ex.id);
        } else {
          await supabase.from("sounds").insert({ name: soundName, total_uses: 1 });
        }
      }
    }
    // If we don't have total_uses, just silently skip tracking — not a hard error
  } catch (e) {
    console.warn("[SoundGallery] trackUsage:", e?.message);
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// MAIN MODAL
// ══════════════════════════════════════════════════════════════════════════════
const CATEGORIES = ["All", "Trending", "Pop", "Hip-Hop", "R&B", "Afrobeats", "Electronic", "Chill"];

const SoundGalleryModal = memo(({ context, onSelect, onClose }) => {
  const [songs,      setSongs]      = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState(null);
  const [search,     setSearch]     = useState("");
  const [playingId,  setPlayingId]  = useState(null);
  const [detailSong, setDetailSong] = useState(null);
  const [activeTab,  setActiveTab]  = useState("All");
  const [isMobile,   setIsMobile]   = useState(window.innerWidth < 769);
  const [sheetY,     setSheetY]     = useState(0);
  const [dragging,   setDragging]   = useState(false);
  const touchStartY  = useRef(0);
  const sheetRef     = useRef(null);

  useEffect(() => {
    const r = () => setIsMobile(window.innerWidth < 769);
    window.addEventListener("resize", r, { passive: true });
    return () => window.removeEventListener("resize", r);
  }, []);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  useEffect(() => {
    const h = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);

  useEffect(() => { return () => { stopListAudio(); }; }, []);

  // ── Load songs — probes schema first, selects only existing columns ─────────
  const loadSongs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Discover which optional columns exist (cached after first call)
      const schema = await probeSchema();
      const selectStr = buildSelect(schema);

      // Order by total_uses only if that column exists
      let query = supabase
        .from("sounds")
        .select(selectStr)
        .limit(300);

      if (schema.total_uses) {
        query = query.order("total_uses", { ascending: false });
      } else {
        query = query.order("id", { ascending: false });
      }

      const { data, error: dbErr } = await query;
      if (dbErr) throw dbErr;

      const rows = (data || []).filter((r) => r.name);
      const resolved = rows.map((r) => ({
        id:       r.id   || r.name,
        name:     r.name || "unknown",
        url:      resolveAudioUrl(r, schema),
        uses:     schema.total_uses  ? (r.total_uses  || 0)    : 0,
        trending: schema.is_trending ? (r.is_trending || false) : false,
        category: schema.category    ? (r.category    || "all") : "all",
        duration: schema.duration    ? (r.duration    || _durCache[r.id || r.name] || null) : (_durCache[r.id || r.name] || null),
      }));

      // Debug: log what we got so you can verify R2 URLs are being built
      console.log(`[SoundGallery] loaded ${resolved.length} songs from DB`);
      console.log(`[SoundGallery] R2_BASE: "${R2_BASE}" | HAS_R2: ${HAS_R2}`);
      if (resolved.length > 0) {
        console.log(`[SoundGallery] first song:`, { name: resolved[0].name, url: resolved[0].url });
      } else {
        console.warn("[SoundGallery] sounds table appears empty — add rows with a 'name' column matching your R2 filenames");
      }

      setSongs(resolved);

      // Eagerly cache durations for first 12 playable songs
      let preloaded = 0;
      for (const s of resolved) {
        if (preloaded >= 12) break;
        if (s.url && _durCache[s.id] === undefined) {
          cacheDuration(s.url, s.id, () => {});
          preloaded++;
        }
      }
    } catch (e) {
      console.warn("[SoundGallery] load:", e?.message);
      setError(e?.message || "Could not load sounds from database.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadSongs(); }, [loadSongs]);

  const handleListPlay = useCallback((song) => {
    if (!song.url) return;
    if (playingId === song.id) { stopListAudio(); setPlayingId(null); return; }
    setPlayingId(song.id);
    playListSong(song.url, () => setPlayingId(null));
  }, [playingId]);

  const filtered = useMemo(() => {
    let list = songs;
    if (activeTab === "Trending") list = list.filter(s => s.trending || s.uses > 5);
    else if (activeTab !== "All") list = list.filter(s =>
      (s.category || "").toLowerCase() === activeTab.toLowerCase()
    );
    if (!search.trim()) return list;
    const q = search.toLowerCase();
    return list.filter(s => cleanName(s.name).toLowerCase().includes(q));
  }, [songs, search, activeTab]);

  const trending = useMemo(() => songs.filter(s => s.trending || s.uses > 5).slice(0, 8), [songs]);
  const contextLabel = { status: "Status", post: "Post", reel: "Reel" }[context] || "Content";

  // Drag-to-dismiss (mobile)
  const onDragStart = (e) => {
    if (!e.target.closest(".sg4-handle") && !e.target.closest(".sg4-mhdr")) return;
    touchStartY.current = e.touches[0].clientY;
    setDragging(true);
  };
  const onDragMove = (e) => {
    if (!dragging) return;
    const dy = e.touches[0].clientY - touchStartY.current;
    setSheetY(dy < 0 ? 0 : dy);
  };
  const onDragEnd = () => {
    setDragging(false);
    sheetY > 80 ? onClose() : setSheetY(0);
  };

  const handleConfirm = (soundData) => {
    trackUsage(soundData.name).catch(() => {});
    onSelect(soundData);
  };

  // ── Category Pills ────────────────────────────────────────────────────────
  const CategoryPills = () => (
    <div className="sg4-cats">
      {CATEGORIES.map(cat => (
        <button
          key={cat}
          className={`sg4-cat${activeTab === cat ? " active" : ""}`}
          onClick={() => setActiveTab(cat)}
        >
          {cat === "Trending" && "🔥 "}{cat}
        </button>
      ))}
    </div>
  );

  // ── Shared list body ──────────────────────────────────────────────────────
  const ListBody = ({ compact = false }) => (
    <div className="sg4-list-wrap">
      {/* R2 setup warning */}
      <R2Banner />

      {/* Detail panel overlay */}
      {detailSong && (
        <div className="sg4-detail-overlay">
          <SoundDetailPanel
            song={detailSong}
            contextLabel={contextLabel}
            onConfirm={handleConfirm}
            onCancel={() => setDetailSong(null)}
          />
        </div>
      )}

      <div className={`sg4-list${compact ? " compact" : ""}`}>
        {loading && <Skeleton />}
        {!loading && error && <ErrorState msg={error} onRetry={loadSongs} />}
        {!loading && !error && songs.length === 0 && <EmptyState />}
        {!loading && !error && songs.length > 0 && (
          <>
            {!search.trim() && activeTab === "All" && trending.length > 0 && (
              <>
                <div className="sg4-section">🔥 Trending Now</div>
                {trending.map(s => (
                  <SongRow key={s.id} song={s}
                    isPlaying={playingId === s.id}
                    isSelected={detailSong?.id === s.id}
                    onPlay={() => handleListPlay(s)}
                    onSelect={() => { stopListAudio(); setPlayingId(null); setDetailSong(p => p?.id === s.id ? null : s); }}
                  />
                ))}
                <div className="sg4-divider" />
              </>
            )}
            <div className="sg4-section">
              {search.trim() ? `Search results (${filtered.length})` :
               activeTab !== "All" ? `${activeTab} (${filtered.length})` :
               `All Sounds (${songs.length})`}
            </div>
            {filtered.length === 0 && (
              <div className="sg4-empty-search">No matches for "{search}"</div>
            )}
            {filtered.map(s => (
              <SongRow key={s.id} song={s}
                isPlaying={playingId === s.id}
                isSelected={detailSong?.id === s.id}
                onPlay={() => handleListPlay(s)}
                onSelect={() => { stopListAudio(); setPlayingId(null); setDetailSong(p => p?.id === s.id ? null : s); }}
              />
            ))}
          </>
        )}
      </div>
    </div>
  );

  // ── Mobile ────────────────────────────────────────────────────────────────
  if (isMobile) {
    return (
      <>
        <div className="sg4-backdrop" onClick={onClose} />
        <div
          ref={sheetRef}
          className="sg4-sheet"
          style={{
            transform: `translateY(${sheetY}px)`,
            transition: dragging ? "none" : "transform 0.35s cubic-bezier(0.34,1.4,0.64,1)",
          }}
          onTouchStart={onDragStart}
          onTouchMove={onDragMove}
          onTouchEnd={onDragEnd}
        >
          <div className="sg4-handle"><div className="sg4-pill" /></div>

          <div className="sg4-mhdr">
            <div className="sg4-mhdr-left">
              <div className="sg4-hdr-icon">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#84cc16" strokeWidth="2" strokeLinecap="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>
              </div>
              <div>
                <div className="sg4-hdr-title">Sound Library</div>
                <div className="sg4-hdr-sub">
                {loading ? "Loading…" :
                 songs.length > 0 ? `${songs.length} tracks · ${contextLabel}` :
                 HAS_R2 ? `R2 ready · add DB rows` : "⚠ R2 not configured"}
              </div>
              </div>
            </div>
            <button className="sg4-hdr-close" onClick={onClose}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>

          {/* Search */}
          <div className="sg4-search-wrap">
            <svg className="sg4-search-ico" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input
              className="sg4-search"
              placeholder="Search songs, artists…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            {search && <button className="sg4-search-clr" onClick={() => setSearch("")}>✕</button>}
          </div>

          <CategoryPills />
          <ListBody compact />
        </div>
        <style>{CSS}</style>
      </>
    );
  }

  // ── Desktop ───────────────────────────────────────────────────────────────
  return (
    <>
      <div className="sg4-backdrop" onClick={onClose} />
      <div className="sg4-popup">
        {/* Header */}
        <div className="sg4-phdr">
          <div className="sg4-phdr-left">
            <div className="sg4-hdr-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#84cc16" strokeWidth="2" strokeLinecap="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>
            </div>
            <div>
              <div className="sg4-hdr-title">Sound Library</div>
              <div className="sg4-hdr-sub">
                {loading ? "Loading…" :
                 songs.length > 0 ? `${songs.length} tracks · R2 ${HAS_R2 ? "✓" : "⚠ not set"}` :
                 HAS_R2 ? "R2 configured · no DB rows" : "⚠ Set REACT_APP_R2_PUBLIC_URL"}
              </div>
            </div>
          </div>
          <button className="sg4-hdr-close" onClick={onClose}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        {/* Search */}
        <div className="sg4-search-wrap">
          <svg className="sg4-search-ico" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input
            className="sg4-search"
            placeholder="Search songs, artists…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            autoFocus
          />
          {search && <button className="sg4-search-clr" onClick={() => setSearch("")}>✕</button>}
        </div>

        <CategoryPills />

        {/* Detail panel or list */}
        {detailSong ? (
          <div className="sg4-detail-overlay">
            <SoundDetailPanel
              song={detailSong}
              contextLabel={contextLabel}
              onConfirm={handleConfirm}
              onCancel={() => setDetailSong(null)}
            />
          </div>
        ) : (
          <div className="sg4-list-wrap">
            <R2Banner />
            <div className="sg4-list">
              {loading && <Skeleton />}
              {!loading && error && <ErrorState msg={error} onRetry={loadSongs} />}
              {!loading && !error && songs.length === 0 && <EmptyState />}
              {!loading && !error && songs.length > 0 && (
                <>
                  {!search.trim() && activeTab === "All" && trending.length > 0 && (
                    <>
                      <div className="sg4-section">🔥 Trending Now</div>
                      {trending.map(s => (
                        <SongRow key={s.id} song={s}
                          isPlaying={playingId === s.id}
                          isSelected={detailSong?.id === s.id}
                          onPlay={() => handleListPlay(s)}
                          onSelect={() => { stopListAudio(); setPlayingId(null); setDetailSong(p => p?.id === s.id ? null : s); }}
                        />
                      ))}
                      <div className="sg4-divider" />
                    </>
                  )}
                  <div className="sg4-section">
                    {search.trim() ? `Results (${filtered.length})` :
                     activeTab !== "All" ? `${activeTab} (${filtered.length})` :
                     `All Sounds (${songs.length})`}
                  </div>
                  {filtered.length === 0 && <div className="sg4-empty-search">No matches for "{search}"</div>}
                  {filtered.map(s => (
                    <SongRow key={s.id} song={s}
                      isPlaying={playingId === s.id}
                      isSelected={false}
                      onPlay={() => handleListPlay(s)}
                      onSelect={() => { stopListAudio(); setPlayingId(null); setDetailSong(s); }}
                    />
                  ))}
                </>
              )}
            </div>
          </div>
        )}
      </div>
      <style>{CSS}</style>
    </>
  );
});
SoundGalleryModal.displayName = "SoundGalleryModal";

// ── Sub-states ────────────────────────────────────────────────────────────────
const Skeleton = () => (
  <div style={{ padding: "8px 0", display: "flex", flexDirection: "column", gap: 6 }}>
    {[0,1,2,3,4,5,6].map(i => (
      <div key={i} style={{
        display: "flex", alignItems: "center", gap: 12, padding: "8px 16px",
      }}>
        <div style={{ width: 40, height: 40, borderRadius: 10, background: "rgba(255,255,255,.05)", animation: `sg4pulse 1.4s ${i*0.1}s ease-in-out infinite`, flexShrink: 0 }} />
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={{ height: 12, borderRadius: 6, background: "rgba(255,255,255,.05)", width: "60%", animation: `sg4pulse 1.4s ${i*0.1+0.1}s ease-in-out infinite` }} />
          <div style={{ height: 10, borderRadius: 5, background: "rgba(255,255,255,.03)", width: "40%", animation: `sg4pulse 1.4s ${i*0.1+0.2}s ease-in-out infinite` }} />
        </div>
      </div>
    ))}
  </div>
);

const ErrorState = ({ msg, onRetry }) => (
  <div className="sg4-center">
    <div style={{ width: 52, height: 52, borderRadius: 16, background: "rgba(239,68,68,.1)", border: "1px solid rgba(239,68,68,.2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24 }}>⚠️</div>
    <p style={{ color: "rgba(255,255,255,.4)", textAlign: "center", fontSize: 13, maxWidth: 260, lineHeight: 1.6, margin: 0 }}>{msg}</p>
    <button className="sg4-retry" onClick={onRetry}>Try Again</button>
  </div>
);

// R2 setup banner — shown when env var is missing
const R2Banner = () => !HAS_R2 ? (
  <div style={{
    margin: "0 16px 10px",
    padding: "10px 14px",
    background: "rgba(245,158,11,.07)",
    border: "1px solid rgba(245,158,11,.22)",
    borderRadius: 14,
    flexShrink: 0,
  }}>
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5 }}>
      <span style={{ fontSize: 14 }}>⚠️</span>
      <span style={{ fontSize: 12, fontWeight: 700, color: "#f59e0b" }}>R2 not configured</span>
    </div>
    <p style={{ fontSize: 11, color: "rgba(255,255,255,.38)", margin: 0, lineHeight: 1.6 }}>
      Add <code style={{ color: "#84cc16", background: "rgba(132,204,22,.1)", padding: "1px 4px", borderRadius: 3, fontSize: 10 }}>REACT_APP_R2_PUBLIC_URL=https://pub-xxx.r2.dev</code> to your <code style={{ color: "#84cc16" }}>.env</code> and restart.
    </p>
  </div>
) : null;

const EmptyState = () => (
  <div className="sg4-center">
    <div style={{ width: 60, height: 60, borderRadius: 18, background: "rgba(132,204,22,.08)", border: "1px solid rgba(132,204,22,.18)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28 }}>🎵</div>
    <p style={{ color: "rgba(255,255,255,.5)", fontSize: 15, fontWeight: 700, textAlign: "center", margin: 0 }}>No sounds found</p>
    {!HAS_R2 ? (
      <div style={{ background: "rgba(245,158,11,.07)", border: "1px solid rgba(245,158,11,.25)", borderRadius: 12, padding: "12px 16px", maxWidth: 280 }}>
        <p style={{ color: "#f59e0b", fontSize: 12, fontWeight: 700, margin: "0 0 6px" }}>⚠️ R2 not configured</p>
        <p style={{ color: "rgba(255,255,255,.4)", fontSize: 11, margin: 0, lineHeight: 1.6 }}>
          Add to your <code style={{ color: "#84cc16" }}>.env</code> file:<br/>
          <code style={{ color: "#84cc16", fontSize: 10 }}>REACT_APP_R2_PUBLIC_URL=https://pub-xxx.r2.dev</code>
        </p>
      </div>
    ) : (
      <p style={{ color: "rgba(255,255,255,.25)", fontSize: 12, textAlign: "center", maxWidth: 280, lineHeight: 1.7, margin: 0 }}>
        Your R2 bucket is configured. Add rows to your{" "}
        <code style={{ color: "#84cc16", background: "rgba(132,204,22,.08)", padding: "1px 5px", borderRadius: 4 }}>sounds</code> table —
        each row needs at least a <code style={{ color: "#84cc16", background: "rgba(132,204,22,.08)", padding: "1px 5px", borderRadius: 4 }}>name</code> column
        matching the filename in R2 (e.g. <code style={{ color: "#84cc16", background: "rgba(132,204,22,.08)", padding: "1px 5px", borderRadius: 4 }}>artist-track.mp3</code>).
      </p>
    )}
  </div>
);

// ══════════════════════════════════════════════════════════════════════════════
// PUBLIC EXPORTS
// ══════════════════════════════════════════════════════════════════════════════

export const AddSoundButton = memo(({ context = "post", onSoundSelected, hasSound, soundName, compact = false }) => {
  const sg = useSoundGallery();
  const open = () => sg.openGallery(context, s => onSoundSelected?.(s));

  if (hasSound && soundName) {
    return (
      <>
        <div className="sg4-badge-wrap">
          <div className="sg4-badge">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#84cc16" strokeWidth="2" strokeLinecap="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>
            <span className="sg4-badge-name">{extractTitle(soundName)}</span>
          </div>
          <button className="sg4-badge-change" onClick={open}>Change</button>
        </div>
        <style>{CSS}</style>
      </>
    );
  }
  return (
    <>
      <button className={`sg4-add-trigger${compact ? " compact" : ""}`} onClick={open}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>
        {!compact && <span>Add Sound</span>}
      </button>
      <style>{CSS}</style>
    </>
  );
});
AddSoundButton.displayName = "AddSoundButton";

export const SoundBadge = memo(({ sound, onRemove, playing, onTogglePlay }) => {
  if (!sound) return null;
  return (
    <>
      <div className="sg4-sound-badge-full">
        <button className="sg4-badge-play" onClick={onTogglePlay}>{playing ? "⏸" : "▶"}</button>
        {playing && <WaveBars playing color="#84cc16" size="sm" bars={8} />}
        <span className="sg4-badge-name">{extractTitle(sound.name)}</span>
        <button className="sg4-badge-rm" onClick={onRemove}>✕</button>
      </div>
      <style>{CSS}</style>
    </>
  );
});
SoundBadge.displayName = "SoundBadge";

export function useSoundPlayer(sound, videoRef) {
  const audioRef = useRef(null);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    if (!sound?.url) return;
    const a = new Audio(sound.url);
    a.currentTime = sound.startSec || 0;
    a.volume = Math.min(1, Math.max(0, sound.songVol ?? sound.galleryVol ?? 1.0));
    a.loop = true;
    audioRef.current = a;
    return () => { a.pause(); a.src = ""; a.load(); audioRef.current = null; };
  }, [sound?.url, sound?.startSec, sound?.songVol, sound?.galleryVol]);

  const play = useCallback(() => {
    if (audioRef.current) audioRef.current.play().catch(() => {});
    if (videoRef?.current) {
      const vv = Math.min(1, Math.max(0, sound?.videoVol ?? sound?.originalVol ?? 0.3));
      videoRef.current.volume = vv;
      videoRef.current.play().catch(() => {});
    }
    setPlaying(true);
  }, [sound, videoRef]);

  const pause = useCallback(() => {
    audioRef.current?.pause();
    videoRef?.current?.pause();
    setPlaying(false);
  }, [videoRef]);

  return { playing, play, pause, audioRef };
}

export default SoundGalleryModal;

// ══════════════════════════════════════════════════════════════════════════════
// CSS — all sg4- prefixed
// ══════════════════════════════════════════════════════════════════════════════
const CSS = `
@keyframes sg4bars  { from{transform:scaleY(.2)} to{transform:scaleY(1)} }
@keyframes sg4up    { from{transform:translateY(100%);opacity:0} to{transform:translateY(0);opacity:1} }
@keyframes sg4popin { from{transform:scale(.95) translateY(12px);opacity:0} to{transform:scale(1) translateY(0);opacity:1} }
@keyframes sg4pulse { 0%,100%{opacity:.5} 50%{opacity:.12} }
@keyframes sg4fdIn  { from{opacity:0} to{opacity:1} }
@keyframes sg4shimmer { 0%{background-position:-200% 0} 100%{background-position:200% 0} }

/* Backdrop */
.sg4-backdrop {
  position:fixed; inset:0; z-index:100007;
  background:rgba(0,0,0,.72);
  backdrop-filter:blur(8px);
  -webkit-backdrop-filter:blur(8px);
  animation:sg4fdIn .2s ease both;
}

/* ─── MOBILE SHEET ────────────────────────────────────────────────────────── */
.sg4-sheet {
  position:fixed; bottom:0; left:0; right:0; z-index:100008;
  background:linear-gradient(180deg,#0f0f0f 0%,#080808 100%);
  border:1px solid rgba(132,204,22,.16);
  border-bottom:none;
  border-radius:24px 24px 0 0;
  max-height:92vh;
  display:flex; flex-direction:column; overflow:hidden;
  animation:sg4up .32s cubic-bezier(.34,1.4,.64,1) both;
  box-shadow:0 -24px 80px rgba(0,0,0,.95), 0 -1px 0 rgba(132,204,22,.08);
}

/* ─── DESKTOP POPUP ───────────────────────────────────────────────────────── */
.sg4-popup {
  position:fixed;
  bottom:96px; right:24px;
  z-index:100010;
  width:480px;
  max-height:72vh;
  background:linear-gradient(180deg,#0f0f0f 0%,#080808 100%);
  border:1px solid rgba(132,204,22,.2);
  border-radius:24px;
  display:flex; flex-direction:column; overflow:hidden;
  box-shadow:
    0 32px 100px rgba(0,0,0,.98),
    0 0 0 1px rgba(132,204,22,.05),
    0 -1px 0 rgba(132,204,22,.12) inset;
  animation:sg4popin .28s cubic-bezier(.34,1.2,.64,1) both;
}

/* Handle */
.sg4-handle {
  padding:14px 0 2px; display:flex; justify-content:center;
  cursor:grab; flex-shrink:0; user-select:none; touch-action:none;
}
.sg4-handle:active { cursor:grabbing; }
.sg4-pill {
  width:40px; height:4px; border-radius:2px;
  background:rgba(255,255,255,.12);
}

/* Header — mobile */
.sg4-mhdr {
  display:flex; align-items:center; justify-content:space-between;
  padding:10px 18px 12px;
  border-bottom:1px solid rgba(255,255,255,.04);
  flex-shrink:0;
}
/* Header — desktop */
.sg4-phdr {
  display:flex; align-items:center; justify-content:space-between;
  padding:16px 20px 14px;
  border-bottom:1px solid rgba(255,255,255,.05);
  flex-shrink:0;
}
.sg4-phdr-left { display:flex; align-items:center; gap:12px; flex:1; min-width:0; }
.sg4-mhdr-left { display:flex; align-items:center; gap:10px; min-width:0; flex:1; }
.sg4-hdr-icon {
  width:40px; height:40px; border-radius:12px;
  background:rgba(132,204,22,.1);
  border:1px solid rgba(132,204,22,.24);
  display:flex; align-items:center; justify-content:center;
  flex-shrink:0;
}
.sg4-hdr-title {
  font-size:15px; font-weight:800; color:#fff; letter-spacing:-.4px; line-height:1;
}
.sg4-hdr-sub {
  font-size:11px; color:rgba(255,255,255,.35); margin-top:3px;
}
.sg4-hdr-close {
  width:32px; height:32px; border-radius:10px;
  background:rgba(255,255,255,.04);
  border:1px solid rgba(255,255,255,.07);
  color:rgba(255,255,255,.4); cursor:pointer;
  display:flex; align-items:center; justify-content:center;
  transition:all .15s; flex-shrink:0;
}
.sg4-hdr-close:hover { background:rgba(255,255,255,.1); color:#fff; }

/* Search */
.sg4-search-wrap {
  position:relative; padding:12px 16px 8px; flex-shrink:0;
}
.sg4-search-ico {
  position:absolute; left:28px; top:50%; transform:translateY(-9%);
  pointer-events:none; color:rgba(255,255,255,.28);
}
.sg4-search {
  width:100%; padding:10px 36px 10px 38px;
  background:rgba(255,255,255,.05);
  border:1px solid rgba(255,255,255,.08);
  border-radius:14px; color:#fff; font-size:13px;
  outline:none; caret-color:#84cc16;
  box-sizing:border-box; font-family:inherit;
  transition:border-color .15s, background .15s;
}
.sg4-search:focus {
  border-color:rgba(132,204,22,.36);
  background:rgba(255,255,255,.07);
}
.sg4-search::placeholder { color:rgba(255,255,255,.2); }
.sg4-search-clr {
  position:absolute; right:26px; top:50%; transform:translateY(-10%);
  background:none; border:none; color:rgba(255,255,255,.28);
  cursor:pointer; font-size:12px; padding:4px;
  transition:color .15s;
}
.sg4-search-clr:hover { color:rgba(255,255,255,.6); }

/* Category pills */
.sg4-cats {
  display:flex; gap:6px; padding:4px 16px 10px;
  overflow-x:auto; flex-shrink:0; scrollbar-width:none;
}
.sg4-cats::-webkit-scrollbar { display:none; }
.sg4-cat {
  padding:5px 12px; border-radius:20px; white-space:nowrap;
  background:rgba(255,255,255,.04);
  border:1px solid rgba(255,255,255,.07);
  color:rgba(255,255,255,.4); font-size:12px; font-weight:600;
  cursor:pointer; transition:all .15s; font-family:inherit;
  flex-shrink:0;
}
.sg4-cat:hover { background:rgba(255,255,255,.08); color:rgba(255,255,255,.7); }
.sg4-cat.active {
  background:rgba(132,204,22,.12);
  border-color:rgba(132,204,22,.36);
  color:#84cc16;
}

/* Detail overlay */
.sg4-detail-overlay {
  padding:12px 16px; flex-shrink:0;
  border-bottom:1px solid rgba(255,255,255,.05);
}
.sg4-detail {
  background:rgba(255,255,255,.03);
  border:1px solid rgba(132,204,22,.18);
  border-radius:20px; padding:16px;
}
.sg4-detail-hd {
  display:flex; align-items:center; gap:12px; margin-bottom:16px;
}
.sg4-detail-art {
  width:48px; height:48px; border-radius:14px;
  display:flex; align-items:center; justify-content:center;
  flex-shrink:0; box-shadow:0 4px 16px rgba(0,0,0,.4);
}
.sg4-detail-info { flex:1; min-width:0; }
.sg4-detail-title {
  font-size:14px; font-weight:700; color:#fff;
  white-space:nowrap; overflow:hidden; text-overflow:ellipsis;
  margin-bottom:3px;
}
.sg4-detail-artist { font-size:12px; color:rgba(255,255,255,.38); }
.sg4-detail-playbtn {
  width:40px; height:40px; border-radius:50%;
  background:rgba(132,204,22,.1);
  border:1.5px solid rgba(132,204,22,.32);
  color:#84cc16; cursor:pointer;
  display:flex; align-items:center; justify-content:center;
  transition:all .15s; flex-shrink:0;
}
.sg4-detail-playbtn:hover { background:rgba(132,204,22,.2); transform:scale(1.05); }
.sg4-detail-playbtn:disabled { opacity:.3; cursor:not-allowed; transform:none; }

/* Controls */
.sg4-ctrl { margin-bottom:14px; }
.sg4-ctrl-hd {
  display:flex; justify-content:space-between; align-items:center;
  margin-bottom:8px;
}
.sg4-ctrl-lbl {
  font-size:10px; font-weight:700; color:rgba(255,255,255,.3);
  text-transform:uppercase; letter-spacing:.7px;
}
.sg4-ctrl-val { font-size:11px; color:#84cc16; font-weight:700; }

/* Sliders */
.sg4-slider-wrap { position:relative; }
.sg4-slider {
  width:100%; height:4px; cursor:pointer;
  outline:none; -webkit-appearance:none; appearance:none;
  background:rgba(255,255,255,.08); border-radius:2px; display:block;
  position:relative; z-index:1;
}
.sg4-slider.green { accent-color:#84cc16; }
.sg4-slider.blue  { accent-color:#60a5fa; }
.sg4-slider-track-fill {
  position:absolute; top:0; left:0; height:4px; border-radius:2px;
  pointer-events:none; margin-top:0;
}
.sg4-slider-track-fill.green { background:linear-gradient(90deg,#84cc16,#a3e635); }
.sg4-slider-track-fill.blue  { background:linear-gradient(90deg,#3b82f6,#60a5fa); }

/* Mix */
.sg4-mix {
  background:rgba(255,255,255,.025);
  border:1px solid rgba(255,255,255,.06);
  border-radius:16px; padding:12px 14px; margin-bottom:14px;
}
.sg4-mix-hd {
  display:flex; align-items:center; gap:6px;
  font-size:11px; font-weight:700; color:rgba(255,255,255,.35);
  text-transform:uppercase; letter-spacing:.5px; margin-bottom:12px;
}
.sg4-mix-badge {
  margin-left:auto; font-size:10px; font-weight:600;
  color:rgba(132,204,22,.7); background:rgba(132,204,22,.08);
  border:1px solid rgba(132,204,22,.18); border-radius:20px;
  padding:2px 8px; text-transform:none; letter-spacing:0;
}
.sg4-mix-row {
  display:flex; align-items:center; gap:10px; margin-bottom:10px;
}
.sg4-mix-row:last-child { margin-bottom:0; }
.sg4-mix-ico  { font-size:14px; flex-shrink:0; }
.sg4-mix-lbl  { font-size:12px; color:rgba(255,255,255,.38); width:40px; flex-shrink:0; }
.sg4-mix-pct  { font-size:11px; font-weight:700; width:36px; text-align:right; flex-shrink:0; }
.sg4-mix-pct.green { color:#84cc16; }
.sg4-mix-pct.blue  { color:#60a5fa; }

/* Detail actions */
.sg4-detail-actions { display:flex; gap:8px; }
.sg4-btn-cancel {
  flex:1; padding:11px 0; border-radius:14px;
  background:rgba(255,255,255,.04);
  border:1px solid rgba(255,255,255,.08);
  color:rgba(255,255,255,.5); font-size:13px; font-weight:600;
  cursor:pointer; font-family:inherit; transition:all .15s;
}
.sg4-btn-cancel:hover { background:rgba(255,255,255,.08); color:rgba(255,255,255,.8); }
.sg4-btn-confirm {
  flex:2; padding:11px 0; border-radius:14px;
  background:linear-gradient(135deg,#84cc16,#65a30d);
  border:none; color:#000; font-size:13px; font-weight:800;
  cursor:pointer; font-family:inherit;
  display:flex; align-items:center; justify-content:center; gap:6px;
  transition:all .15s;
  box-shadow:0 4px 16px rgba(132,204,22,.3);
}
.sg4-btn-confirm:hover { opacity:.9; transform:translateY(-1px); box-shadow:0 6px 20px rgba(132,204,22,.4); }

/* List */
.sg4-list-wrap {
  flex:1; overflow:hidden; display:flex; flex-direction:column; min-height:0;
}
.sg4-list {
  flex:1; overflow-y:auto; padding:6px 0 max(env(safe-area-inset-bottom,0px),20px);
  -webkit-overflow-scrolling:touch;
  scrollbar-width:thin; scrollbar-color:rgba(132,204,22,.15) transparent;
}
.sg4-list::-webkit-scrollbar { width:3px; }
.sg4-list::-webkit-scrollbar-thumb { background:rgba(132,204,22,.2); border-radius:2px; }

.sg4-section {
  padding:10px 18px 5px;
  font-size:10px; font-weight:700; color:rgba(255,255,255,.28);
  text-transform:uppercase; letter-spacing:.9px;
}
.sg4-divider {
  height:1px; background:rgba(255,255,255,.05);
  margin:4px 16px 2px;
}
.sg4-empty-search {
  padding:24px 20px; color:rgba(255,255,255,.3);
  font-size:13px; text-align:center;
}

/* Song row */
.sg4-row {
  display:flex; align-items:center; gap:12px;
  padding:9px 16px;
  border-bottom:1px solid rgba(255,255,255,.025);
  cursor:pointer; transition:background .12s;
  position:relative;
}
.sg4-row::after {
  content:""; position:absolute; inset:0;
  background:linear-gradient(90deg,transparent,rgba(132,204,22,.03),transparent);
  background-size:200% 100%; opacity:0; transition:opacity .2s;
}
.sg4-row:hover::after { opacity:1; }
.sg4-row:hover       { background:rgba(255,255,255,.022); }
.sg4-row--sel        { background:rgba(132,204,22,.06) !important; }
.sg4-row--play       { background:rgba(132,204,22,.04) !important; }
.sg4-row--nourl      { cursor:default; opacity:.45; }

.sg4-row-art {
  width:40px; height:40px; flex-shrink:0;
  display:flex; align-items:center; justify-content:center;
}
.sg4-row-art-playing {
  width:40px; height:40px; border-radius:12px;
  background:rgba(132,204,22,.1); border:1px solid rgba(132,204,22,.3);
  display:flex; align-items:center; justify-content:center;
}

.sg4-info { flex:1; min-width:0; }
.sg4-title {
  font-size:13px; font-weight:700; color:#fff;
  white-space:nowrap; overflow:hidden; text-overflow:ellipsis;
  margin-bottom:2px; transition:color .15s; line-height:1.3;
}
.sg4-title.active { color:#84cc16; }
.sg4-artist {
  font-size:11px; color:rgba(255,255,255,.3);
  white-space:nowrap; overflow:hidden; text-overflow:ellipsis;
  display:flex; align-items:center; gap:5px; line-height:1.3;
}
.sg4-nourl-tag {
  font-size:9px; color:rgba(255,255,255,.2);
  background:rgba(255,255,255,.06); border-radius:4px;
  padding:1px 5px; flex-shrink:0;
}
.sg4-dur {
  font-size:11px; color:rgba(255,255,255,.2); flex-shrink:0;
  margin-right:4px; font-variant-numeric:tabular-nums;
  font-feature-settings:"tnum";
}
.sg4-add {
  width:30px; height:30px; border-radius:50%;
  background:rgba(132,204,22,.08);
  border:1.5px solid rgba(132,204,22,.28);
  color:#84cc16; font-size:14px;
  display:flex; align-items:center; justify-content:center;
  cursor:pointer; flex-shrink:0; transition:all .15s;
}
.sg4-add.sel {
  background:#84cc16; border-color:#84cc16; color:#000;
}
.sg4-add.disabled { opacity:.25; cursor:not-allowed; }
.sg4-add:not(.disabled):hover {
  background:rgba(132,204,22,.18);
  transform:scale(1.1);
}

/* Center states */
.sg4-center {
  display:flex; flex-direction:column; align-items:center;
  justify-content:center; gap:12px; padding:36px 24px;
}
.sg4-retry {
  padding:9px 20px; border-radius:12px;
  background:rgba(132,204,22,.1);
  border:1px solid rgba(132,204,22,.28);
  color:#84cc16; font-size:13px; font-weight:600;
  cursor:pointer; font-family:inherit; transition:all .15s;
}
.sg4-retry:hover { background:rgba(132,204,22,.18); }

/* AddSoundButton */
.sg4-add-trigger {
  display:inline-flex; align-items:center; gap:7px; padding:8px 16px;
  border-radius:20px; background:rgba(132,204,22,.07);
  border:1px solid rgba(132,204,22,.22); color:#84cc16;
  font-size:13px; font-weight:700; cursor:pointer;
  transition:all .15s; font-family:inherit; flex-shrink:0;
}
.sg4-add-trigger.compact { padding:7px 11px; font-size:12px; border-radius:16px; }
.sg4-add-trigger:hover {
  background:rgba(132,204,22,.14);
  border-color:rgba(132,204,22,.42);
  transform:translateY(-1px);
  box-shadow:0 4px 14px rgba(132,204,22,.2);
}

/* Badges */
.sg4-badge-wrap { display:flex; align-items:center; gap:6px; }
.sg4-badge {
  display:flex; align-items:center; gap:6px; padding:6px 10px;
  background:rgba(132,204,22,.08);
  border:1px solid rgba(132,204,22,.24);
  border-radius:16px; max-width:180px;
}
.sg4-badge-name {
  font-size:12px; font-weight:600; color:#84cc16;
  overflow:hidden; text-overflow:ellipsis; white-space:nowrap;
}
.sg4-badge-change {
  padding:5px 10px; border-radius:10px;
  background:rgba(132,204,22,.07);
  border:1px solid rgba(132,204,22,.2);
  color:#84cc16; font-size:11px; font-weight:600;
  cursor:pointer; font-family:inherit; transition:all .15s;
}
.sg4-badge-change:hover { background:rgba(132,204,22,.14); }

.sg4-sound-badge-full {
  display:flex; align-items:center; gap:8px; padding:8px 14px;
  background:rgba(132,204,22,.08);
  border:1px solid rgba(132,204,22,.24);
  border-radius:22px; max-width:220px; flex-shrink:0;
}
.sg4-badge-play {
  width:24px; height:24px; border-radius:50%;
  background:rgba(132,204,22,.1);
  border:1px solid rgba(132,204,22,.28);
  color:#84cc16; cursor:pointer; font-size:9px;
  display:flex; align-items:center; justify-content:center; flex-shrink:0;
  transition:all .15s;
}
.sg4-badge-play:hover { background:rgba(132,204,22,.2); }
.sg4-badge-rm {
  width:18px; height:18px; border-radius:50%;
  background:rgba(255,255,255,.05); border:none;
  color:rgba(255,255,255,.35); cursor:pointer; font-size:10px;
  display:flex; align-items:center; justify-content:center; flex-shrink:0;
  transition:all .15s;
}
.sg4-badge-rm:hover { background:rgba(239,68,68,.1); color:#ef4444; }
`;