// ============================================================================
// src/components/Account/MyContentSection.jsx
// Thumbnail grid → clicking opens a fullscreen panel rendering the EXACT same
// PostTab / StoryTab / ReelsTab components used in UserProfileModal.
// Thumbnails show the actual content image (image_ids[0] for posts, etc.)
// Tabs have colour-coded active states (green/purple/amber/teal).
// Works for both ProfileSection (showComments=true) and UserProfileModal.
// ============================================================================

import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Search, X, Image, Film, BookOpen, MessageSquare,
  Heart, Eye, Play, Clock, ArrowLeft, ChevronLeft, ChevronRight,
} from "lucide-react";
import { supabase } from "../../services/config/supabase";
import mediaUrlService from "../../services/shared/mediaUrlService";
import PostTab        from "../Home/PostTab";
import StoryTab       from "../Home/StoryTab";
import ReelsTab       from "../Home/ReelsTab";
import CommentsViewer from "./CommentsViewer";

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────
const TAB_META = {
  posts:    { label: "Posts",    Icon: Image,         color: "#84cc16", emptyEmoji: "📝" },
  reels:    { label: "Reels",    Icon: Film,          color: "#818cf8", emptyEmoji: "🎬" },
  stories:  { label: "Stories",  Icon: BookOpen,      color: "#f59e0b", emptyEmoji: "📖" },
  comments: { label: "Comments", Icon: MessageSquare, color: "#34d399", emptyEmoji: "💬" },
};

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────
const fmt = (n) => {
  if (!n && n !== 0) return "0";
  const v = Number(n);
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(1)}K`;
  return String(Math.floor(v));
};

const timeAgo = (d) => {
  if (!d) return "";
  const s = (Date.now() - new Date(d)) / 1000;
  if (s < 60) return "now";
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  if (s < 604800) return `${Math.floor(s / 86400)}d`;
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric" });
};

// Build image URL — plain URL only (no transform params that cause 400s on Supabase Storage)
const buildUrl = (mediaId) => {
  if (!mediaId) return null;
  try {
    const url = mediaUrlService.getImageUrl(mediaId);
    if (!url || typeof url !== "string") return null;
    const base = url.split("?")[0];
    if (!base.startsWith("http")) return null;
    return base;
  } catch { return null; }
};

const thumbUrl = (mediaId) => buildUrl(mediaId);


// Enrich a raw DB row so PostTab / StoryTab / ReelsTab can render it properly
const enrich = (item, profileData, tab) => ({
  ...item,
  // PostTab expects these top-level fields
  author:   profileData?.fullName  || "User",
  username: profileData?.username  || "user",
  avatar:   profileData?.avatar    || null,
  verified: profileData?.verified  || false,
  // PostTab also reads from the nested `profiles` object
  profiles: {
    full_name: profileData?.fullName  || "User",
    username:  profileData?.username  || "user",
    avatar_id: profileData?.avatarId  || null,
    verified:  profileData?.verified  || false,
  },
  // Normalise tab-specific field aliases
  ...(tab === "reels" && { caption: item.caption || item.content || "" }),
});

// ─────────────────────────────────────────────────────────────────────────────
// VIDEO FRAME EXTRACTOR — pulls a frame from a video URL as a data-URL
// ─────────────────────────────────────────────────────────────────────────────
const extractVideoFrame = (videoUrl) =>
  new Promise((resolve) => {
    if (!videoUrl || typeof videoUrl !== "string") return resolve(null);
    try {
      const video = document.createElement("video");
      video.crossOrigin = "anonymous";
      video.muted = true;
      video.preload = "metadata";
      video.playsInline = true;
      const cleanup = () => { try { video.src = ""; } catch {} };
      const timeout = setTimeout(() => { cleanup(); resolve(null); }, 8000);
      video.onloadedmetadata = () => { video.currentTime = Math.min(1.5, video.duration * 0.1 || 0); };
      video.onseeked = () => {
        clearTimeout(timeout);
        try {
          const canvas = document.createElement("canvas");
          canvas.width  = 300;
          canvas.height = 300;
          const ctx = canvas.getContext("2d");
          // letterbox/pillarbox the frame to fill 300×300
          const vw = video.videoWidth || 1;
          const vh = video.videoHeight || 1;
          const scale = Math.max(300 / vw, 300 / vh);
          const sw = vw * scale, sh = vh * scale;
          ctx.drawImage(video, (300 - sw) / 2, (300 - sh) / 2, sw, sh);
          resolve(canvas.toDataURL("image/jpeg", 0.75));
        } catch { resolve(null); }
        cleanup();
      };
      video.onerror = () => { clearTimeout(timeout); cleanup(); resolve(null); };
      video.src = videoUrl;
    } catch { resolve(null); }
  });

// Build a full CDN URL from a raw video_id or metadata
const getVideoUrl = (item) => {
  try {
    if (item.video_metadata?.url) return item.video_metadata.url;
    if (item.video_id) return mediaUrlService.getVideoUrl?.(item.video_id) || null;
  } catch {}
  return null;
};

// ─────────────────────────────────────────────────────────────────────────────
// THUMBNAIL CARD — skeleton-first, multi-source, content-aware fallbacks
// ─────────────────────────────────────────────────────────────────────────────
const ThumbCard = ({ item, tab, index, onClick }) => {
  // Phase: "skeleton" → "loading" (img present, not loaded) → "ready" → "fallback"
  const [phase,   setPhase]   = useState("skeleton");
  const [imgSrc,  setImgSrc]  = useState(null);  // final resolved URL
  const mountedRef = useRef(true);

  const meta   = TAB_META[tab];
  const isReel = tab === "reels";
  const text   = item.body?.slice(0, 120)    || item.content?.slice(0, 120)
               || item.caption?.slice(0, 120) || item.title?.slice(0, 120)
               || item.preview?.slice(0, 120) || "";

  // ── Try every possible source in priority order ──────────────────────────
  useEffect(() => {
    mountedRef.current = true;
    let cancelled = false;

    const attempt = async () => {
      // 1. Build the candidate URL list from DB fields
      const candidates = [];

      if (tab === "posts") {
        const ids = item.image_ids || [];
        for (const id of ids.slice(0, 3)) {
          const u = thumbUrl(id);
          if (u) candidates.push(u);
        }
      } else if (tab === "reels") {
        if (item.thumbnail_id) {
          const u = thumbUrl(item.thumbnail_id);
          if (u) candidates.push(u);
        }
        // direct thumbnail URL in metadata
        const tmeta = item.video_metadata || {};
        if (tmeta.thumbnail_url && tmeta.thumbnail_url.startsWith("http"))
          candidates.push(tmeta.thumbnail_url);
        if (tmeta.thumbnailUrl && tmeta.thumbnailUrl.startsWith("http"))
          candidates.push(tmeta.thumbnailUrl);
        if (tmeta.poster && tmeta.poster.startsWith("http"))
          candidates.push(tmeta.poster);
      } else if (tab === "stories") {
        const u = thumbUrl(item.cover_image_id);
        if (u) candidates.push(u);
        if (item.cover_url?.startsWith("http")) candidates.push(item.cover_url);
      }

      // 2. Try each candidate: probe with an Image object so we don't block render
      for (const url of candidates) {
        if (cancelled) return;
        const ok = await new Promise((res) => {
          const img = new window.Image();
          img.onload  = () => res(true);
          img.onerror = () => res(false);
          img.src = url;
          setTimeout(() => res(false), 6000);
        });
        if (ok && !cancelled) {
          setImgSrc(url);
          setPhase("ready");
          return;
        }
      }

      // 3. For reels — try extracting a frame from the actual video
      if (!cancelled && tab === "reels") {
        const videoUrl = getVideoUrl(item);
        if (videoUrl) {
          const frame = await extractVideoFrame(videoUrl);
          if (frame && !cancelled) {
            setImgSrc(frame);
            setPhase("ready");
            return;
          }
        }
      }

      // 4. Nothing worked — use rich content-aware fallback
      if (!cancelled) setPhase("fallback");
    };

    // Start skeleton briefly so the grid paints immediately, then resolve
    setPhase("skeleton");
    const t = setTimeout(attempt, index < 9 ? index * 16 : 0); // stagger first row slightly
    return () => { cancelled = true; clearTimeout(t); mountedRef.current = false; };
  }, [item.id, tab]);

  // ── Derived display values ────────────────────────────────────────────────
  const hasStats  = (item.views > 0) || (item.likes > 0);
  const cardCount = Array.isArray(item.image_ids) && item.image_ids.length > 1 ? item.image_ids.length : null;

  return (
    <button
      className={`mcs-card mcs-card-phase-${phase}`}
      onClick={onClick}
      style={{ animationDelay: phase === "skeleton" ? "0ms" : `${Math.min(index * 15, 300)}ms` }}
      aria-label={`Open ${meta.label.slice(0, -1)} ${index + 1}`}
    >
      <div className="mcs-card-media">

        {/* ── SKELETON: shown immediately while resolving ── */}
        {phase === "skeleton" && (
          <div className="mcs-card-skeleton">
            <div className="mcs-shimmer" />
          </div>
        )}

        {/* ── READY: actual image ── */}
        {phase === "ready" && imgSrc && (
          <img src={imgSrc} alt="" className="mcs-card-img" />
        )}

        {/* ── FALLBACK: rich content-aware placeholder ── */}
        {phase === "fallback" && (
          <div className="mcs-card-fallback" style={{ "--tc": meta.color }}>
            {/* Background pattern */}
            <div className="mcs-fb-bg" />

            {/* Big icon */}
            <div className="mcs-fb-icon" style={{ color: meta.color }}>
              <meta.Icon size={22} strokeWidth={1.5} />
            </div>

            {/* Text content — as much as fits */}
            {text && (
              <p className="mcs-fb-text">{text}</p>
            )}

            {/* For reels with no thumbnail, show a "video" label */}
            {tab === "reels" && !text && (
              <span className="mcs-fb-label" style={{ color: meta.color }}>Video</span>
            )}
          </div>
        )}

        {/* ── Reel: multi-item or play badge ── */}
        {isReel && phase !== "skeleton" && (
          <div className="mcs-play-badge">
            <Play size={10} fill="#fff" style={{ marginLeft: 1 }} />
          </div>
        )}

        {/* ── Multi-image indicator (posts with > 1 image) ── */}
        {cardCount && phase !== "skeleton" && (
          <div className="mcs-multi-badge">
            <Image size={8} />
            <span>{cardCount}</span>
          </div>
        )}

        {/* ── Hover overlay — stats ── */}
        {phase !== "skeleton" && (
          <div className="mcs-card-hover">
            {item.views > 0 && <span><Eye size={10} />{fmt(item.views)}</span>}
            {item.likes > 0 && <span><Heart size={10} />{fmt(item.likes)}</span>}
            {!hasStats && <span style={{ color: "rgba(255,255,255,0.5)", fontSize: 10 }}>View</span>}
          </div>
        )}

        {/* ── Type accent dot ── */}
        <div className="mcs-dot" style={{ background: meta.color }} />
      </div>

      {/* ── Footer ── */}
      <div className="mcs-card-foot">
        <Clock size={8} />
        <span>{timeAgo(item.created_at)}</span>
      </div>
    </button>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// CONTENT VIEWER — slides in over the grid, renders actual Tab components
// ─────────────────────────────────────────────────────────────────────────────
const ContentViewer = ({ items, tab, startIndex, profileData, currentUser, onAuthorClick, onActionMenu, onClose }) => {
  // We render all items but scroll to the clicked one
  const scrollRef = useRef(null);
  const meta = TAB_META[tab];

  useEffect(() => {
    document.body.style.overflow = "hidden";
    // Scroll to the clicked post after a paint
    const timer = setTimeout(() => {
      if (scrollRef.current) {
        const cards = scrollRef.current.querySelectorAll(
          ".content-card, .post-card, .story-card, .reel-card, [class*=\"card\"]"
        );
        if (cards[startIndex]) {
          cards[startIndex].scrollIntoView({ behavior: "smooth", block: "start" });
        }
      }
    }, 120);
    return () => { clearTimeout(timer); document.body.style.overflow = ""; };
  }, [startIndex]);

  useEffect(() => {
    const h = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);

  const enriched = items.map(it => enrich(it, profileData, tab));

  return (
    <div className="mcs-viewer-overlay" onClick={onClose}>
      <div className="mcs-viewer-panel" onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="mcs-viewer-header" style={{ borderBottomColor: `${meta.color}33` }}>
          <button className="mcs-viewer-back" onClick={onClose} style={{ color: meta.color }}>
            <ArrowLeft size={18} />
          </button>
          <span className="mcs-viewer-title" style={{ color: meta.color }}>
            <meta.Icon size={16} />
            {meta.label}
          </span>
          <div style={{ width: 40 }} />
        </div>

        {/* Content rendered by actual Tab components */}
        <div className="mcs-viewer-body" ref={scrollRef}>
          {tab === "posts" && (
            <PostTab
              posts={enriched}
              currentUser={currentUser}
              onAuthorClick={onAuthorClick}
              onActionMenu={onActionMenu}
            />
          )}
          {tab === "stories" && (
            <StoryTab
              stories={enriched}
              currentUser={currentUser}
              onAuthorClick={onAuthorClick}
              onActionMenu={onActionMenu}
            />
          )}
          {tab === "reels" && (
            <ReelsTab
              reels={enriched}
              currentUser={currentUser}
              onAuthorClick={onAuthorClick}
              onActionMenu={onActionMenu}
            />
          )}
          {tab === "comments" && null /* handled by CommentsViewer */}
        </div>

      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
const MyContentSection = ({
  userId,
  profileData,    // pass the already-loaded profile so we can enrich rows
  currentUser,
  showComments = true,
  onAuthorClick,
  onActionMenu,
}) => {
  const TABS = showComments
    ? ["posts", "reels", "stories", "comments"]
    : ["posts", "reels", "stories"];

  const [activeTab, setActiveTab] = useState("posts");
  const [items,   setItems]   = useState({ posts: [], reels: [], stories: [], comments: [] });
  const [loading, setLoading] = useState({ posts: false, reels: false, stories: false, comments: false });
  const [loaded,  setLoaded]  = useState({ posts: false, reels: false, stories: false, comments: false });
  const [errors,  setErrors]  = useState({ posts: null,  reels: null,  stories: null,  comments: null  });
  const [counts,  setCounts]  = useState({ posts: 0,     reels: 0,     stories: 0,     comments: 0     });
  const [search,  setSearch]  = useState("");
  const [viewer,  setViewer]  = useState(null); // { tab, index }
  const [commentsViewerOpen, setCommentsViewerOpen] = useState(false);

  useEffect(() => {
    if (userId) { fetchCounts(); fetchTab("posts"); }
  }, [userId]);

  useEffect(() => {
    if (userId && !loaded[activeTab] && !loading[activeTab]) fetchTab(activeTab);
  }, [activeTab, userId]);

  // ── Fetch counts (tab badges) ───────────────────────────────────────────────
  const fetchCounts = async () => {
    const res = await Promise.allSettled([
      supabase.from("posts").select("*", { count: "exact", head: true }).eq("user_id", userId).is("deleted_at", null),
      supabase.from("reels").select("*", { count: "exact", head: true }).eq("user_id", userId).is("deleted_at", null),
      supabase.from("stories").select("*", { count: "exact", head: true }).eq("user_id", userId).is("deleted_at", null),
      supabase.from("comments").select("*", { count: "exact", head: true }).eq("user_id", userId),
    ]);
    setCounts({
      posts:    res[0].status === "fulfilled" ? (res[0].value.count ?? 0) : 0,
      reels:    res[1].status === "fulfilled" ? (res[1].value.count ?? 0) : 0,
      stories:  res[2].status === "fulfilled" ? (res[2].value.count ?? 0) : 0,
      comments: res[3].status === "fulfilled" ? (res[3].value.count ?? 0) : 0,
    });
  };

  // ── Fetch rows for a tab ───────────────────────────────────────────────────
  const fetchTab = async (tab) => {
    if (!userId || loading[tab]) return;
    setLoading(p => ({ ...p, [tab]: true }));
    setErrors(p  => ({ ...p, [tab]: null  }));
    try {
      let rows = [];
      if (tab === "posts") {
        const { data, error } = await supabase
          .from("posts")
          .select("id, content, image_ids, video_ids, video_metadata, views, likes, comments_count, created_at, category, is_text_card, text_card_metadata, card_caption, user_id")
          .eq("user_id", userId).is("deleted_at", null)
          .order("created_at", { ascending: false }).limit(60);
        if (error) throw error;
        rows = data || [];
      } else if (tab === "reels") {
        const { data, error } = await supabase
          .from("reels")
          .select("id, caption, video_id, thumbnail_id, video_metadata, views, likes, comments_count, created_at, user_id")
          .eq("user_id", userId).is("deleted_at", null)
          .order("created_at", { ascending: false }).limit(60);
        if (error) throw error;
        rows = data || [];
      } else if (tab === "stories") {
        const { data, error } = await supabase
          .from("stories")
          .select("id, title, preview, cover_image_id, views, likes, comments_count, created_at, category, user_id")
          .eq("user_id", userId).is("deleted_at", null)
          .order("created_at", { ascending: false }).limit(60);
        if (error) throw error;
        rows = data || [];
      } else if (tab === "comments") {
        // Use * so we don't fail on unknown column names — the text field may be
        // named "body", "text", "comment_text", or "content" depending on schema.
        const { data, error } = await supabase
          .from("comments")
          .select("*")
          .eq("user_id", userId)
          .order("created_at", { ascending: false }).limit(60);
        if (error) throw error;
        // Normalise: always expose the text under `body` regardless of real col name
        rows = (data || []).map(r => ({
          ...r,
          body: r.body ?? r.content ?? r.text ?? r.comment_text ?? r.message ?? "",
        }));
      }
      setItems(p  => ({ ...p, [tab]: rows }));
      setLoaded(p => ({ ...p, [tab]: true }));
    } catch (err) {
      console.error(`[MyContentSection] fetchTab(${tab}):`, err?.message);
      setErrors(p => ({ ...p, [tab]: err?.message || "Failed to load" }));
    } finally {
      setLoading(p => ({ ...p, [tab]: false }));
    }
  };

  const retry = (tab) => { setLoaded(p => ({ ...p, [tab]: false })); fetchTab(tab); };

  // ── Filtered list ──────────────────────────────────────────────────────────
  const filtered = (items[activeTab] || []).filter(it => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      it.content?.toLowerCase().includes(q)  ||
      it.title?.toLowerCase().includes(q)    ||
      it.caption?.toLowerCase().includes(q)  ||
      it.preview?.toLowerCase().includes(q)  ||
      it.category?.toLowerCase().includes(q)
    );
  });

  const meta = TAB_META[activeTab];

  return (
    <>
      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* STYLES                                                               */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      <style>{`
        /* ── Root ── */
        .mcs-root {
          margin-top: 20px;
          background: rgba(255,255,255,0.02);
          border: 1px solid rgba(255,255,255,0.07);
          border-radius: 20px;
          overflow: hidden;
        }

        /* ── Tabs ── */
        .mcs-top { padding: 14px 14px 0; }
        .mcs-label {
          font-size: 11px; font-weight: 800; color: #525252;
          text-transform: uppercase; letter-spacing: 1px;
          margin: 0 0 10px;
        }
        .mcs-tabs {
          display: flex; overflow-x: auto; scrollbar-width: none;
          border-bottom: 1px solid rgba(255,255,255,0.06);
        }
        .mcs-tabs::-webkit-scrollbar { display: none; }

        .mcs-tab {
          display: flex; align-items: center; gap: 5px;
          padding: 9px 13px;
          background: none; border: none; border-bottom: 2px solid transparent;
          color: #404040; font-size: 12px; font-weight: 700;
          cursor: pointer; white-space: nowrap; flex-shrink: 0;
          transition: color 0.18s;
        }
        .mcs-tab:hover { color: #737373; }

        /* Per-tab active colours */
        .mcs-tab[data-tab="posts"].mcs-active    { color: #84cc16; border-bottom-color: #84cc16; }
        .mcs-tab[data-tab="reels"].mcs-active    { color: #818cf8; border-bottom-color: #818cf8; }
        .mcs-tab[data-tab="stories"].mcs-active  { color: #f59e0b; border-bottom-color: #f59e0b; }
        .mcs-tab[data-tab="comments"].mcs-active { color: #34d399; border-bottom-color: #34d399; }

        .mcs-badge {
          font-size: 9px; padding: 1px 5px; border-radius: 20px;
          font-weight: 800; background: rgba(255,255,255,0.05); color: #404040;
        }
        .mcs-tab[data-tab="posts"].mcs-active    .mcs-badge { background: rgba(132,204,22,0.15); color: #84cc16; }
        .mcs-tab[data-tab="reels"].mcs-active    .mcs-badge { background: rgba(129,140,248,0.15); color: #818cf8; }
        .mcs-tab[data-tab="stories"].mcs-active  .mcs-badge { background: rgba(245,158,11,0.15); color: #f59e0b; }
        .mcs-tab[data-tab="comments"].mcs-active .mcs-badge { background: rgba(52,211,153,0.15); color: #34d399; }

        /* ── Search ── */
        .mcs-search {
          display: flex; align-items: center; gap: 8px;
          margin: 10px 14px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.07);
          border-radius: 10px; padding: 8px 11px;
          transition: border-color 0.2s;
        }
        .mcs-search:focus-within { border-color: rgba(132,204,22,0.35); }
        .mcs-search input {
          flex: 1; background: none; border: none; outline: none;
          color: #e5e5e5; font-size: 12px;
        }
        .mcs-search input::placeholder { color: #333; }
        .mcs-search svg { color: #404040; flex-shrink: 0; }
        .mcs-search-clear { background: none; border: none; color: #525252; cursor: pointer; padding: 0; display: flex; }

        /* ── Grid ── */
        .mcs-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 2px; padding: 2px;
        }
        @media (min-width: 460px) { .mcs-grid { grid-template-columns: repeat(4, 1fr); } }

        /* ── Card ── */
        .mcs-card {
          background: none; border: none; padding: 0; cursor: pointer;
          border-radius: 3px; overflow: hidden; display: flex; flex-direction: column;
          transition: transform 0.12s;
        }
        /* Skeleton cards: show immediately, no pop animation, flat bg */
        .mcs-card-phase-skeleton { cursor: default; }
        /* Ready/fallback cards: pop in */
        .mcs-card-phase-ready,
        .mcs-card-phase-fallback {
          animation: mcs-pop 0.3s cubic-bezier(0.22,1,0.36,1) both;
        }
        .mcs-card:not(.mcs-card-phase-skeleton):hover { transform: scale(0.95); }
        .mcs-card:not(.mcs-card-phase-skeleton):hover .mcs-card-hover { opacity: 1; }
        @keyframes mcs-pop {
          from { opacity: 0; transform: scale(0.88); }
          to   { opacity: 1; transform: scale(1); }
        }

        .mcs-card-media {
          position: relative; width: 100%; padding-bottom: 100%;
          background: #0c0c0c; overflow: hidden;
        }

        /* Actual image */
        .mcs-card-img {
          position: absolute; inset: 0; width: 100%; height: 100%;
          object-fit: cover;
        }

        /* Skeleton state */
        .mcs-card-skeleton {
          position: absolute; inset: 0;
        }
        .mcs-shimmer {
          position: absolute; inset: 0;
          background: linear-gradient(90deg, #0e0e0e 25%, #1a1a1a 50%, #0e0e0e 75%);
          background-size: 200% 100%;
          animation: mcs-shimmer 1.6s ease-in-out infinite;
        }
        @keyframes mcs-shimmer {
          0%   { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }

        /* ─── FALLBACK: rich content-aware placeholder ─── */
        .mcs-card-fallback {
          position: absolute; inset: 0;
          display: flex; flex-direction: column;
          align-items: center; justify-content: center;
          gap: 6px; padding: 10px; overflow: hidden;
        }
        /* Dark gradient tinted toward tab color */
        .mcs-fb-bg {
          position: absolute; inset: 0;
          background: linear-gradient(
            145deg,
            color-mix(in srgb, var(--tc, #fff) 10%, #000) 0%,
            #090909 60%
          );
        }
        .mcs-fb-bg::after {
          /* subtle radial glow in the center */
          content: "";
          position: absolute; inset: 0;
          background: radial-gradient(ellipse 70% 70% at 50% 40%,
            color-mix(in srgb, var(--tc, #fff) 8%, transparent) 0%,
            transparent 70%
          );
        }
        .mcs-fb-icon {
          position: relative; z-index: 1; opacity: 0.55;
          filter: drop-shadow(0 0 8px var(--tc, #fff));
        }
        .mcs-fb-text {
          position: relative; z-index: 1;
          font-size: 7.5px; color: rgba(255,255,255,0.28);
          text-align: center; line-height: 1.6; margin: 0;
          overflow: hidden; display: -webkit-box;
          -webkit-line-clamp: 5; -webkit-box-orient: vertical;
          word-break: break-word;
        }
        .mcs-fb-label {
          position: relative; z-index: 1;
          font-size: 9px; font-weight: 800; letter-spacing: 1px;
          text-transform: uppercase; opacity: 0.6;
        }

        /* Hover overlay */
        .mcs-card-hover {
          position: absolute; inset: 0;
          background: rgba(0,0,0,0.62);
          opacity: 0; transition: opacity 0.15s;
          display: flex; align-items: center; justify-content: center; gap: 12px;
          z-index: 3;
        }
        .mcs-card-hover span {
          display: flex; align-items: center; gap: 3px;
          color: #fff; font-size: 12px; font-weight: 800;
          text-shadow: 0 1px 6px rgba(0,0,0,0.9);
        }

        /* Reel play badge */
        .mcs-play-badge {
          position: absolute; bottom: 6px; right: 6px;
          width: 22px; height: 22px; border-radius: 50%;
          background: rgba(0,0,0,0.7); backdrop-filter: blur(4px);
          display: flex; align-items: center; justify-content: center;
          z-index: 2;
        }

        /* Multi-image badge */
        .mcs-multi-badge {
          position: absolute; top: 5px; left: 5px;
          display: flex; align-items: center; gap: 2px;
          background: rgba(0,0,0,0.7); backdrop-filter: blur(4px);
          border-radius: 6px; padding: 2px 5px;
          color: #fff; font-size: 8px; font-weight: 700;
          z-index: 2;
        }

        /* Type dot */
        .mcs-dot {
          position: absolute; top: 5px; right: 5px;
          width: 6px; height: 6px; border-radius: 50%;
          border: 1px solid rgba(0,0,0,0.6); z-index: 2;
        }

        /* Foot */
        .mcs-card-foot {
          padding: 3px 5px; background: #080808;
          display: flex; align-items: center; gap: 3px;
          color: #2a2a2a; font-size: 8.5px;
        }

        /* ── State ── */
        .mcs-state {
          display: flex; flex-direction: column; align-items: center;
          justify-content: center; padding: 44px 20px; gap: 10px; text-align: center;
        }
        .mcs-spinner {
          width: 30px; height: 30px;
          border: 3px solid rgba(132,204,22,0.1);
          border-top-color: #84cc16;
          border-radius: 50%; animation: mcs-spin 0.8s linear infinite;
        }
        @keyframes mcs-spin { to { transform: rotate(360deg); } }
        .mcs-state p   { color: #525252; font-size: 13px; font-weight: 600; margin: 0; }
        .mcs-state small { color: #333; font-size: 11px; }
        .mcs-emoji { font-size: 34px; }
        .mcs-retry {
          padding: 6px 14px;
          background: rgba(239,68,68,0.1); border: 1px solid rgba(239,68,68,0.3);
          border-radius: 8px; color: #ef4444; font-size: 12px; font-weight: 600; cursor: pointer;
        }

        /* ════════════════════════════════════════════════════════════════════
           CONTENT VIEWER — slides in over the grid
           ════════════════════════════════════════════════════════════════════ */
        .mcs-viewer-overlay {
          position: fixed; inset: 0; z-index: 99999;
          background: rgba(0,0,0,0.6); backdrop-filter: blur(6px);
          display: flex; align-items: stretch; justify-content: flex-end;
          animation: mcs-vfade 0.2s ease;
        }
        @keyframes mcs-vfade { from { opacity: 0; } to { opacity: 1; } }

        .mcs-viewer-panel {
          width: 100%; max-width: 520px; height: 100%;
          background: #000;
          border-left: 1px solid rgba(255,255,255,0.07);
          display: flex; flex-direction: column;
          animation: mcs-vslide 0.28s cubic-bezier(0.4,0,0.2,1);
          overflow: hidden;
        }
        @keyframes mcs-vslide { from { transform: translateX(100%); } to { transform: translateX(0); } }

        @media (max-width: 600px) {
          .mcs-viewer-overlay { justify-content: center; align-items: flex-end; }
          .mcs-viewer-panel {
            max-width: 100%; height: 95vh;
            border-left: none; border-top: 1px solid rgba(255,255,255,0.07);
            border-radius: 20px 20px 0 0;
            animation: mcs-vslideup 0.28s cubic-bezier(0.4,0,0.2,1);
          }
          @keyframes mcs-vslideup { from { transform: translateY(100%); } to { transform: translateY(0); } }
        }

        .mcs-viewer-header {
          display: flex; align-items: center; justify-content: space-between;
          padding: 14px 16px; flex-shrink: 0;
          background: rgba(0,0,0,0.95); backdrop-filter: blur(20px);
          border-bottom: 1px solid rgba(255,255,255,0.06);
          position: sticky; top: 0; z-index: 2;
        }
        .mcs-viewer-back {
          width: 36px; height: 36px; border-radius: 50%;
          background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.08);
          display: flex; align-items: center; justify-content: center;
          cursor: pointer; transition: background 0.15s;
        }
        .mcs-viewer-back:hover { background: rgba(255,255,255,0.1); }
        .mcs-viewer-title {
          display: flex; align-items: center; gap: 7px;
          font-size: 15px; font-weight: 800;
        }
        .mcs-viewer-body {
          flex: 1; overflow-y: auto; overflow-x: hidden;
          scrollbar-width: thin; scrollbar-color: rgba(132,204,22,0.2) transparent;
        }
        .mcs-viewer-body::-webkit-scrollbar { width: 4px; }
        .mcs-viewer-body::-webkit-scrollbar-thumb { background: rgba(132,204,22,0.2); border-radius: 2px; }

        /* ── Comment preview cards (shown in grid area when tab=comments) ── */
        .mcs-comment-preview-list {
          display: flex; flex-direction: column; gap: 1px;
          padding: 4px 0 8px;
        }
        .mcs-comment-preview-card {
          display: flex; align-items: flex-start; gap: 10px;
          padding: 12px 14px; background: none; border: none;
          border-bottom: 1px solid rgba(255,255,255,0.04);
          cursor: pointer; text-align: left; width: 100%;
          transition: background 0.15s;
          animation: mcs-pop 0.28s ease both;
        }
        .mcs-comment-preview-card:last-of-type { border-bottom: none; }
        .mcs-comment-preview-card:hover { background: rgba(52,211,153,0.04); }
        .mcs-cpc-left { padding-top: 2px; flex-shrink: 0; }
        .mcs-cpc-body { flex: 1; min-width: 0; }
        .mcs-cpc-text {
          font-size: 13px; color: #c0c0c0; line-height: 1.55; margin: 0 0 4px;
          overflow: hidden; display: -webkit-box;
          -webkit-line-clamp: 2; -webkit-box-orient: vertical;
        }
        .mcs-cpc-time { font-size: 10px; color: #383838; }
        .mcs-cpc-right {
          display: flex; flex-direction: column; align-items: flex-end;
          gap: 6px; flex-shrink: 0;
        }
        .mcs-cpc-likes {
          display: flex; align-items: center; gap: 3px;
          font-size: 10px; color: #525252;
        }
        .mcs-cpc-arrow {
          font-size: 16px; color: #2a2a2a; line-height: 1;
        }

        /* Open all button */
        .mcs-open-cv-btn {
          display: flex; align-items: center; justify-content: center; gap: 7px;
          margin: 10px 14px 4px;
          padding: 11px 16px; border-radius: 12px;
          background: rgba(52,211,153,0.05);
          border: 1px solid rgba(52,211,153,0.14);
          color: #34d399; font-size: 12px; font-weight: 700;
          cursor: pointer; transition: all 0.18s; width: calc(100% - 28px);
        }
        .mcs-open-cv-btn:hover {
          background: rgba(52,211,153,0.1);
          border-color: rgba(52,211,153,0.25);
          transform: translateY(-1px);
          box-shadow: 0 4px 16px rgba(52,211,153,0.07);
        }
      `}</style>

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* GRID UI                                                              */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      <div className="mcs-root">
        <div className="mcs-top">
          <p className="mcs-label">My Content</p>

          {/* Tab bar */}
          <div className="mcs-tabs" role="tablist">
            {TABS.map(tab => {
              const { label, Icon } = TAB_META[tab];
              const isActive = activeTab === tab;
              return (
                <button
                  key={tab}
                  role="tab"
                  aria-selected={isActive}
                  data-tab={tab}
                  className={`mcs-tab ${isActive ? "mcs-active" : ""}`}
                  onClick={() => setActiveTab(tab)}
                >
                  <Icon size={12} />
                  {label}
                  <span className="mcs-badge">{counts[tab]}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Search */}
        <div className="mcs-search">
          <Search size={12} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={`Search ${meta.label.toLowerCase()}…`}
          />
          {search && (
            <button className="mcs-search-clear" onClick={() => setSearch("")}>
              <X size={12} />
            </button>
          )}
        </div>

        {/* Body */}
        {loading[activeTab] ? (
          <div className="mcs-state">
            <div className="mcs-spinner" />
            <p>Loading {meta.label.toLowerCase()}…</p>
          </div>
        ) : errors[activeTab] ? (
          <div className="mcs-state">
            <span className="mcs-emoji">⚠️</span>
            <p>Failed to load {meta.label.toLowerCase()}</p>
            <small>{errors[activeTab]}</small>
            <button className="mcs-retry" onClick={() => retry(activeTab)}>Retry</button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="mcs-state">
            <span className="mcs-emoji">{meta.emptyEmoji}</span>
            <p>{search ? `No results for "${search}"` : `No ${meta.label.toLowerCase()} yet`}</p>
            {!search && (
              <small>{activeTab === "comments"
                ? "Your comments will appear here"
                : `Create your first ${meta.label.slice(0,-1).toLowerCase()}!`}
              </small>
            )}
          </div>
        ) : activeTab === "comments" ? (
          /* ── Comments: vertical preview list, not a grid ── */
          <div className="mcs-comment-preview-list">
            {filtered.map((item, i) => (
              <button
                key={item.id || i}
                className="mcs-comment-preview-card"
                onClick={() => setCommentsViewerOpen(true)}
                style={{ animationDelay: `${Math.min(i * 30, 500)}ms` }}
              >
                <div className="mcs-cpc-left">
                  <MessageSquare size={13} style={{ color: "#34d399", flexShrink: 0, marginTop: 2 }} />
                </div>
                <div className="mcs-cpc-body">
                  <p className="mcs-cpc-text">{item.body}</p>
                  <span className="mcs-cpc-time">{timeAgo(item.created_at)}</span>
                </div>
                <div className="mcs-cpc-right">
                  {item.likes > 0 && (
                    <span className="mcs-cpc-likes">
                      <Heart size={9} />{fmt(item.likes)}
                    </span>
                  )}
                  <div className="mcs-cpc-arrow">›</div>
                </div>
              </button>
            ))}
            {/* Open full viewer CTA */}
            <button className="mcs-open-cv-btn" onClick={() => setCommentsViewerOpen(true)}>
              <MessageSquare size={13} />
              View all {filtered.length} comment{filtered.length !== 1 ? "s" : ""} with replies & reactions
            </button>
          </div>
        ) : (
          <div className="mcs-grid" role="list">
            {filtered.map((item, i) => (
              <ThumbCard
                key={item.id || i}
                item={item}
                tab={activeTab}
                index={i}
                onClick={() => setViewer({ tab: activeTab, index: i })}
              />
            ))}
          </div>
        )}
      </div>

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* CONTENT VIEWER (slides in when thumbnail clicked)                   */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      {viewer && (
        <ContentViewer
          items={filtered}
          tab={viewer.tab}
          startIndex={viewer.index}
          profileData={profileData}
          currentUser={currentUser}
          onAuthorClick={onAuthorClick}
          onActionMenu={onActionMenu}
          onClose={() => setViewer(null)}
        />
      )}

      {commentsViewerOpen && (
        <CommentsViewer
          comments={items.comments || []}
          profileData={profileData}
          currentUser={currentUser}
          onGoToPost={(ctx) => {
            setCommentsViewerOpen(false);
            // Caller can handle navigation — pass up if prop provided
            onAuthorClick && console.log("[CommentsViewer] go to:", ctx._type, ctx.id);
          }}
          onClose={() => setCommentsViewerOpen(false)}
        />
      )}
    </>
  );
};

export default MyContentSection;