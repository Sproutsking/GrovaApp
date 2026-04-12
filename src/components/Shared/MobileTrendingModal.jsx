// src/components/Shared/MobileTrendingModal.jsx
// ============================================================================
// Same stable top-streamers algorithm as TrendingSidebar:
//   - Uses get_top_streamers() RPC (SECURITY DEFINER) to bypass RLS
//   - Falls back to direct query if RPC not yet deployed
//   - Sessions weighted heavily (×300) so every streamer always has a score
//   - streamersCache ref — list never blanks after first successful load
//   - Refresh interval 10 min (stable data doesn't need rapid polling)
//   - Per-user avatar fallback gradients (no hardcoded red)
//   - StreamerDetailModal rendered via ReactDOM.createPortal on document.body
//
// REALTIME FIX:
//   - Removed filter:"status=eq.live" from postgres_changes listener.
//     Listen to ALL live_sessions changes and re-fetch. This catches the
//     "pending" → "live" UPDATE that the filtered listener would miss.
//   - Added 15s polling interval as belt-and-suspenders fallback.
// ============================================================================

import React, { useState, useEffect, useRef } from "react";
import ReactDOM from "react-dom";
import {
  X, TrendingUp, Eye, Flame, Crown, RefreshCw,
  ArrowRight, ArrowLeft, Sparkles, ChevronRight,
  Hash, FileText, Play, BookOpen, Zap, Radio, Tv,
} from "lucide-react";

import { supabase }         from "../../services/config/supabase";
import mediaUrlService      from "../../services/shared/mediaUrlService";
import UnifiedLoader        from "./UnifiedLoader";
import UserProfileModal     from "../Modals/UserProfileModal";
import StreamerDetailModal  from "./StreamerDetailModal";

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmt = (n) => {
  if (!n) return "0";
  if (n >= 1e9) return `${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  return String(n);
};

const rankStyle = (rank) => {
  if (rank === 1) return { bg: "linear-gradient(135deg,#fbbf24,#f59e0b)", color: "#000" };
  if (rank === 2) return { bg: "linear-gradient(135deg,#e2e8f0,#94a3b8)", color: "#000" };
  if (rank === 3) return { bg: "linear-gradient(135deg,#cd7c3a,#a16027)", color: "#fff" };
  return { bg: "rgba(239,68,68,.12)", color: "#ef4444" };
};

// ── Per-user avatar gradient — same palette as TrendingSidebar ────────────────
const AVATAR_GRADIENTS = [
  "linear-gradient(135deg,#84cc16,#4d7c0f)",
  "linear-gradient(135deg,#60a5fa,#1d4ed8)",
  "linear-gradient(135deg,#a78bfa,#6d28d9)",
  "linear-gradient(135deg,#f59e0b,#b45309)",
  "linear-gradient(135deg,#f472b6,#be185d)",
  "linear-gradient(135deg,#34d399,#065f46)",
  "linear-gradient(135deg,#fb923c,#c2410c)",
  "linear-gradient(135deg,#38bdf8,#0369a1)",
];
const avatarGradient = (seed = "") => {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return AVATAR_GRADIENTS[h % AVATAR_GRADIENTS.length];
};

const STREAMERS_PREVIEW = 3;

// ── Live sessions fetcher ─────────────────────────────────────────────────────
const fetchLiveSessions = async () => {
  const { data, error } = await supabase
    .from("live_sessions")
    .select(`id, title, category, mode, peak_viewers, total_likes, started_at, livekit_room, is_private,
             profiles:user_id (id, full_name, username, avatar_id, verified)`)
    .eq("status", "live")
    .eq("is_private", false)
    .order("peak_viewers", { ascending: false })
    .limit(20);
  if (error) {
    if (error.code === "42P01" || error.message?.includes("does not exist")) return [];
    throw error;
  }
  return data || [];
};

// ── Top streamers fetcher — RPC bypasses RLS, direct query as fallback ────────
const fetchTopStreamers = async () => {
  let ranked = [];

  try {
    const { data: rpcData, error: rpcError } = await supabase
      .rpc("get_top_streamers");

    if (!rpcError && rpcData && rpcData.length > 0) {
      ranked = rpcData.map((row) => ({
        userId:      row.user_id,
        peakViewers: row.peak_viewers  || 0,
        totalLikes:  row.total_likes   || 0,
        sessions:    row.sessions      || 0,
        score:       row.score         || 0,
      }));
    } else {
      const { data, error } = await supabase
        .from("live_sessions")
        .select("user_id, peak_viewers, total_likes")
        .not("user_id", "is", null)
        .order("peak_viewers", { ascending: false })
        .limit(1000);

      if (error) {
        if (error.code === "42P01" || error.message?.includes("does not exist")) return [];
        throw error;
      }

      const map = {};
      (data || []).forEach((s) => {
        const uid = s.user_id;
        if (!map[uid]) map[uid] = { peakViewers: 0, totalLikes: 0, sessions: 0 };
        map[uid].peakViewers  = Math.max(map[uid].peakViewers, s.peak_viewers  || 0);
        map[uid].totalLikes  += s.total_likes  || 0;
        map[uid].sessions    += 1;
      });

      ranked = Object.entries(map)
        .map(([uid, d]) => ({
          userId:      uid,
          peakViewers: d.peakViewers,
          totalLikes:  d.totalLikes,
          sessions:    d.sessions,
          score:       d.sessions * 300 + d.peakViewers * 0.6 + d.totalLikes * 0.4,
        }))
        .sort((a, b) => b.score - a.score)
        .slice(0, 30);
    }
  } catch {
    return [];
  }

  if (ranked.length === 0) return [];

  const ids = ranked.map((r) => r.userId);
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, full_name, username, avatar_id, verified")
    .in("id", ids);

  const pm = Object.fromEntries((profiles || []).map((p) => [p.id, p]));

  return ranked
    .map((item, i) => ({
      ...item,
      rank:    i + 1,
      profile: pm[item.userId] || {
        id: item.userId, full_name: null, username: null,
        avatar_id: null, verified: false,
      },
    }))
    .filter((item) => pm[item.userId] || item.sessions > 0);
};

// ── Compact streamer row ──────────────────────────────────────────────────────
const StreamerRow = ({ streamer, onClick }) => {
  const [imgErr, setImgErr] = useState(false);
  const rc  = rankStyle(streamer.rank);
  const pr  = streamer.profile || {};
  const avatarUrl = !imgErr && pr.avatar_id
    ? mediaUrlService.getImageUrl(pr.avatar_id, { width: 60, height: 60, crop: "fill", gravity: "face" })
    : null;
  const initial  = (pr.full_name || pr.username || "?").charAt(0).toUpperCase();
  const fallback = avatarGradient(pr.id || pr.username || String(streamer.rank));

  return (
    <div
      onClick={() => onClick?.(streamer)}
      style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", borderRadius: 11, background: "rgba(255,255,255,.03)", border: "1px solid rgba(255,255,255,.06)", cursor: "pointer", marginBottom: 7 }}
    >
      <div style={{ width: 22, height: 22, borderRadius: 7, flexShrink: 0, background: rc.bg, color: rc.color, fontSize: 10, fontWeight: 900, display: "flex", alignItems: "center", justifyContent: "center" }}>
        {streamer.rank}
      </div>
      <div style={{ width: 30, height: 30, borderRadius: "50%", flexShrink: 0, overflow: "hidden", background: avatarUrl ? "transparent" : fallback, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 900, fontSize: 12, border: "1.5px solid rgba(255,255,255,.1)" }}>
        {avatarUrl
          ? <img src={avatarUrl} alt="" onError={() => setImgErr(true)} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          : <span>{initial}</span>}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: "#d4d4d4", display: "flex", alignItems: "center", gap: 4, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", marginBottom: 2 }}>
          {pr.full_name || pr.username || `Streamer #${streamer.rank}`}
          {pr.verified && <span style={{ width: 14, height: 14, background: "#84cc16", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Sparkles size={8} color="#000" /></span>}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: "#484848", whiteSpace: "nowrap", overflow: "hidden" }}>
          {pr.username && <><span>@{pr.username}</span><span style={{ color: "#2a2a2a" }}>·</span></>}
          <Eye size={9} style={{ opacity: .7 }} />
          <span style={{ color: "#84cc16", fontWeight: 700 }}>{fmt(streamer.peakViewers)}</span>
          <span style={{ color: "#2a2a2a" }}>·</span>
          <span style={{ color: "#84cc16", fontWeight: 700 }}>{streamer.sessions}</span>
          <span>{streamer.sessions === 1 ? "stream" : "streams"}</span>
        </div>
      </div>
      <ChevronRight size={14} color="#2a2a2a" style={{ flexShrink: 0 }} />
    </div>
  );
};

// ── Streamer circle card ──────────────────────────────────────────────────────
const StreamerCircle = ({ session, onJoin, isOwn }) => {
  const profile = session.profiles || {};
  const [imgErr,    setImgErr]    = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);
  const avatarUrl = !imgErr && profile.avatar_id
    ? mediaUrlService.getImageUrl(profile.avatar_id, { width: 100, height: 100, crop: "fill", gravity: "face" })
    : null;
  const initial = (profile.full_name || profile.username || "?").charAt(0).toUpperCase();

  return (
    <div
      onClick={() => !isOwn && onJoin(session)}
      style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 5, flexShrink: 0, width: 60, cursor: isOwn ? "default" : "pointer", opacity: isOwn ? .45 : 1, scrollSnapAlign: "start" }}
    >
      <div style={{ position: "relative", width: 52, height: 52, flexShrink: 0 }}>
        <div style={{ position: "absolute", inset: 0, borderRadius: "50%", overflow: "hidden", background: "#0a0a0a" }}>
          <div className="mt-sc-spin" />
          <div style={{ position: "absolute", inset: 3, borderRadius: "50%", overflow: "hidden", zIndex: 1 }}>
            <div style={{ width: "100%", height: "100%", borderRadius: "50%", background: "linear-gradient(135deg,#84cc16,#4d7c0f)", display: "flex", alignItems: "center", justifyContent: "center", position: "relative", overflow: "hidden" }}>
              <span style={{ fontSize: 14, fontWeight: 900, color: "#000", position: "absolute", zIndex: 0, userSelect: "none", lineHeight: 1 }}>{initial}</span>
              {avatarUrl && <img src={avatarUrl} alt="" onLoad={() => setImgLoaded(true)} onError={() => setImgErr(true)} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", borderRadius: "50%", zIndex: 1, opacity: imgLoaded ? 1 : 0, transition: "opacity .2s" }} />}
            </div>
          </div>
        </div>
        <div className="mt-sc-pulse" style={{ position: "absolute", inset: 0, borderRadius: "50%", border: "2px solid rgba(239,68,68,.35)", pointerEvents: "none" }} />
        <div className="mt-sc-dot" style={{ position: "absolute", bottom: 2, right: 2, width: 11, height: 11, borderRadius: "50%", background: "#ef4444", border: "2px solid #050505", zIndex: 2 }} />
        <div style={{ position: "absolute", top: -3, right: -5, display: "flex", alignItems: "center", gap: 2, padding: "2px 4px", borderRadius: 4, background: "rgba(0,0,0,.88)", border: "1px solid rgba(255,255,255,.1)", fontSize: 7.5, fontWeight: 800, color: "#c4c4c4", zIndex: 3, whiteSpace: "nowrap" }}>
          <Eye size={7} strokeWidth={2.5} />{fmt(session.peak_viewers || 0)}
        </div>
      </div>
      <span style={{ fontSize: 10, fontWeight: 700, color: "#c4c4c4", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 60, textAlign: "center", lineHeight: 1.3 }}>
        {(profile.username || profile.full_name || "stream").slice(0, 9)}
      </span>
      <span style={{ fontSize: 8.5, fontWeight: 500, color: "#363636", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 60, textAlign: "center", marginTop: -3 }}>
        {(session.category || "").slice(0, 8)}
      </span>
    </div>
  );
};

// ── Section header ────────────────────────────────────────────────────────────
const SectionHeader = ({ icon: Icon, iconColor, iconBg, iconBorder, title, subtitle, right }) => (
  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12, paddingBottom: 10, borderBottom: "1px solid rgba(255,255,255,.06)", position: "relative" }}>
    <div style={{ position: "absolute", left: 0, bottom: -1, width: 28, height: 2, background: `linear-gradient(90deg,${iconColor},transparent)`, borderRadius: 1 }} />
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <div style={{ width: 30, height: 30, borderRadius: 9, background: iconBg, border: `1px solid ${iconBorder}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <Icon size={15} color={iconColor} />
      </div>
      <div>
        <div style={{ fontSize: 12, fontWeight: 800, color: "#e5e5e5", letterSpacing: ".4px", textTransform: "uppercase" }}>{title}</div>
        <div style={{ fontSize: 11, color: "#484848", marginTop: 1 }}>{subtitle}</div>
      </div>
    </div>
    {right}
  </div>
);

// ── Tag row ───────────────────────────────────────────────────────────────────
const TagRow = ({ tag, index, onNavigate, onDrill }) => (
  <div onClick={() => onNavigate(tag)} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", borderRadius: 11, background: "rgba(255,255,255,.03)", border: "1px solid rgba(255,255,255,.06)", marginBottom: 7, cursor: "pointer" }}>
    <div style={{ width: 28, height: 28, borderRadius: 8, background: index < 3 ? "rgba(239,68,68,.15)" : "rgba(255,255,255,.05)", color: index < 3 ? "#ef4444" : "#525252", fontSize: 11, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
      {index < 3 ? <Flame size={12} /> : index + 1}
    </div>
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: "#d4d4d4", marginBottom: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{tag.label}</div>
      <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "#484848", flexWrap: "wrap" }}>
        <span style={{ display: "flex", alignItems: "center", gap: 3 }}><Eye size={9} />{fmt(tag.views)}</span>
        <span style={{ color: "#2e2e2e" }}>·</span><span>{tag.posts} posts</span>
        {index < 3 && <span style={{ fontSize: 9, fontWeight: 800, padding: "1px 6px", background: "rgba(239,68,68,.15)", color: "#ef4444", borderRadius: 4 }}>HOT</span>}
      </div>
    </div>
    <button onClick={(e) => { e.stopPropagation(); onDrill(tag); }} style={{ width: 28, height: 28, borderRadius: 8, background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.07)", color: "#484848", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}>
      <ChevronRight size={13} />
    </button>
  </div>
);

// ── Creator row ───────────────────────────────────────────────────────────────
const CreatorRow = ({ creator, onClick }) => {
  const rc = rankStyle(creator.rank);
  return (
    <div onClick={() => onClick(creator)} style={{ display: "flex", alignItems: "center", gap: 11, padding: "10px 12px", borderRadius: 12, background: creator.isTopTier ? "rgba(251,191,36,.03)" : "rgba(255,255,255,.03)", border: `1px solid ${creator.isTopTier ? "rgba(251,191,36,.18)" : "rgba(255,255,255,.06)"}`, marginBottom: 7, cursor: "pointer" }}>
      <div style={{ width: 22, height: 22, borderRadius: 7, background: rc.bg, color: rc.color, fontSize: 10, fontWeight: 900, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{creator.rank}</div>
      <div style={{ position: "relative", flexShrink: 0 }}>
        <div style={{ width: 36, height: 36, borderRadius: "50%", background: "linear-gradient(135deg,#84cc16,#65a30d)", display: "flex", alignItems: "center", justifyContent: "center", color: "#000", fontWeight: 900, fontSize: 14, overflow: "hidden", border: `2px solid ${creator.isTopTier ? "rgba(251,191,36,.4)" : "rgba(132,204,22,.2)"}` }}>
          {typeof creator.avatar === "string" && creator.avatar.startsWith("http") ? <img src={creator.avatar} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : creator.avatar}
        </div>
        {creator.isTopTier && <div style={{ position: "absolute", top: -5, right: -5, width: 16, height: 16, background: "linear-gradient(135deg,#fbbf24,#f59e0b)", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", border: "1.5px solid #000" }}><Crown size={8} color="#000" /></div>}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: "#d4d4d4", display: "flex", alignItems: "center", gap: 4, marginBottom: 2, overflow: "hidden" }}>
          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{creator.name}</span>
          {creator.verified && <span style={{ width: 14, height: 14, background: "#84cc16", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Sparkles size={8} color="#000" /></span>}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: "#484848" }}>
          <span>@{creator.username}</span>
          <span style={{ color: "#2a2a2a" }}>·</span>
          <span style={{ color: "#84cc16", fontWeight: 700 }}>{fmt(creator.stats.likes)}</span><span>likes</span>
          <span style={{ color: "#2a2a2a" }}>·</span>
          <span style={{ color: "#84cc16", fontWeight: 700 }}>{creator.stats.posts}</span><span>posts</span>
        </div>
      </div>
      <ChevronRight size={14} color="#2a2a2a" style={{ flexShrink: 0 }} />
    </div>
  );
};

// ── View more button ──────────────────────────────────────────────────────────
const ViewMoreBtn = ({ onClick, children, red }) => (
  <button onClick={onClick} style={{ width: "100%", padding: "10px", marginTop: 4, background: red ? "rgba(239,68,68,.05)" : "rgba(132,204,22,.05)", border: `1px dashed ${red ? "rgba(239,68,68,.22)" : "rgba(132,204,22,.2)"}`, borderRadius: 10, color: red ? "#ef4444" : "#84cc16", fontSize: 13, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 7 }}>
    {children}
  </button>
);

// ── Sub-panel ─────────────────────────────────────────────────────────────────
const SubPanel = ({ title, subtitle, icon: Icon, iconColor, iconBg, iconBorder, onBack, children }) => (
  <div style={{ position: "absolute", inset: 0, background: "#050505", zIndex: 20, display: "flex", flexDirection: "column", animation: "mtSlideIn .22s cubic-bezier(.34,1.1,.64,1)" }}>
    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 16px", borderBottom: "1px solid rgba(255,255,255,.06)", flexShrink: 0 }}>
      <button onClick={onBack} style={{ width: 34, height: 34, borderRadius: 10, background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.08)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#737373", flexShrink: 0 }}>
        <ArrowLeft size={15} />
      </button>
      <div style={{ width: 30, height: 30, borderRadius: 9, background: iconBg, border: `1px solid ${iconBorder}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <Icon size={14} color={iconColor} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 800, color: "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{title}</div>
        {subtitle && <div style={{ fontSize: 11, color: "#484848", marginTop: 1 }}>{subtitle}</div>}
      </div>
    </div>
    <div style={{ flex: 1, overflowY: "auto", padding: "12px 16px" }}>{children}</div>
  </div>
);

// ── Post card ─────────────────────────────────────────────────────────────────
const PostCard = ({ post, onNavigate }) => (
  <div onClick={() => onNavigate(post)} style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 12px", borderRadius: 11, background: "rgba(255,255,255,.03)", border: "1px solid rgba(255,255,255,.06)", marginBottom: 8, cursor: "pointer" }}>
    {post.thumbnail && (
      <div style={{ width: 48, height: 48, borderRadius: 9, overflow: "hidden", flexShrink: 0, position: "relative" }}>
        <img src={post.thumbnail} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        {post.contentType === "reel" && <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,.4)" }}><Play size={12} color="#fff" /></div>}
      </div>
    )}
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
        <div style={{ width: 20, height: 20, borderRadius: "50%", background: "rgba(132,204,22,.2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 800, color: "#84cc16", flexShrink: 0, overflow: "hidden" }}>
          {post.authorAvatar?.startsWith("http") ? <img src={post.authorAvatar} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <span>{post.authorAvatar || "?"}</span>}
        </div>
        <span style={{ fontSize: 12, fontWeight: 700, color: "#d4d4d4", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{post.authorName}</span>
        <span style={{ fontSize: 10, color: "#484848" }}>@{post.authorUsername}</span>
      </div>
      {post.caption && <p style={{ fontSize: 11, color: "#606060", margin: "0 0 4px", lineHeight: 1.4, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{post.caption}</p>}
      <div style={{ display: "flex", gap: 10, fontSize: 11, color: "#404040" }}>
        <span style={{ display: "flex", alignItems: "center", gap: 3 }}><Eye size={9} />{fmt(post.views)}</span>
        <span>❤ {fmt(post.likes)}</span>
      </div>
    </div>
    <ChevronRight size={14} color="#2a2a2a" style={{ flexShrink: 0 }} />
  </div>
);

// =============================================================================
// MAIN COMPONENT
// =============================================================================
const MobileTrendingModal = ({ isOpen, onClose, currentUser, onJoinStream, setActiveTab: setAppTab, setFeedFilter }) => {
  const [liveSessions,    setLiveSessions]    = useState([]);
  const [liveLoading,     setLiveLoading]     = useState(true);
  const [topStreamers,    setTopStreamers]    = useState([]);
  const [trendingTags,    setTrendingTags]    = useState([]);
  const [eliteCreators,   setEliteCreators]   = useState([]);
  const [loading,         setLoading]         = useState(true);
  const [error,           setError]           = useState(null);
  const [refreshing,      setRefreshing]      = useState(false);

  const streamersCache = useRef([]);
  const livePollRef    = useRef(null);
  const liveRef        = useRef(null);

  const [panel,           setPanel]           = useState(null);
  const [activeTag,       setActiveTag]       = useState(null);
  const [tagPosts,        setTagPosts]        = useState([]);
  const [tagPostsLoading, setTagPostsLoading] = useState(false);

  const [creatorModal,    setCreatorModal]    = useState(false);
  const [selectedCreator, setSelectedCreator] = useState(null);
  const [streamerDetail,  setStreamerDetail]  = useState(null);

  useEffect(() => {
    if (!isOpen) return;
    loadAll(true);
    loadLive();
    const iv = setInterval(() => loadAll(false), 10 * 60 * 1000);
    return () => clearInterval(iv);
  }, [isOpen]); // eslint-disable-line

  useEffect(() => {
    if (!isOpen) return;
    let alive = true;

    // ── REALTIME FIX ──────────────────────────────────────────────────────
    // No column filter — listen to ALL live_sessions changes and re-fetch.
    // This catches "pending" → "live" UPDATEs that a filtered listener misses.
    const ch = supabase
      .channel("mt_live_v4")
      .on(
        "postgres_changes",
        {
          event: "*",   // INSERT, UPDATE, DELETE — no filter
          schema: "public",
          table: "live_sessions",
        },
        async () => {
          try {
            const d = await fetchLiveSessions();
            if (alive) setLiveSessions(d);
          } catch { /* silent */ }
        },
      )
      .subscribe();

    liveRef.current = ch;

    // ── 15s poll fallback ─────────────────────────────────────────────────
    livePollRef.current = setInterval(async () => {
      try {
        const d = await fetchLiveSessions();
        if (alive) setLiveSessions(d);
      } catch { /* silent */ }
    }, 15_000);

    return () => {
      alive = false;
      supabase.removeChannel(ch);
      clearInterval(livePollRef.current);
    };
  }, [isOpen]);

  const loadLive = async () => {
    try {
      const d = await fetchLiveSessions();
      setLiveSessions(d);
    } catch { /* silent */ }
    finally { setLiveLoading(false); }
  };

  const loadAll = async (initial = false) => {
    if (initial) setLoading(true);
    setError(null);
    try {
      const [streamers, tags, creators] = await Promise.all([
        fetchTopStreamers(),
        loadTrendingTags(),
        loadActiveCreators(),
      ]);
      if (streamers.length > 0) {
        setTopStreamers(streamers);
        streamersCache.current = streamers;
      } else if (streamersCache.current.length > 0) {
        setTopStreamers(streamersCache.current);
      }
      setTrendingTags(tags);
      setEliteCreators(creators);
    } catch (e) {
      setError(e.message);
      if (streamersCache.current.length > 0) setTopStreamers(streamersCache.current);
    } finally {
      if (initial) setLoading(false);
      setRefreshing(false);
    }
  };

  const loadTrendingTags = async () => {
    const [s, p, r] = await Promise.all([
      supabase.from("stories").select("category,views").is("deleted_at", null).order("views", { ascending: false }).limit(100),
      supabase.from("posts"  ).select("category,views").is("deleted_at", null).order("views", { ascending: false }).limit(100),
      supabase.from("reels"  ).select("category,views").is("deleted_at", null).order("views", { ascending: false }).limit(100),
    ]);
    const map = {};
    [...(s.data || []), ...(p.data || []), ...(r.data || [])].forEach((item) => {
      const cat = item.category || "General";
      if (!map[cat]) map[cat] = { views: 0, count: 0 };
      map[cat].views += item.views || 0; map[cat].count++;
    });
    return Object.entries(map)
      .map(([label, d]) => ({ label, views: d.views, posts: d.count, trendScore: d.views * 0.7 + d.count * 100 * 0.3 }))
      .sort((a, b) => b.trendScore - a.trendScore).slice(0, 30);
  };

  const loadActiveCreators = async () => {
    const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 7);
    const iso = cutoff.toISOString();
    const [p, r, s] = await Promise.all([
      supabase.from("posts"  ).select("user_id,likes,views,comments_count").is("deleted_at", null).gte("created_at", iso),
      supabase.from("reels"  ).select("user_id,likes,views,comments_count").is("deleted_at", null).gte("created_at", iso),
      supabase.from("stories").select("user_id,likes,views,comments_count").is("deleted_at", null).gte("created_at", iso),
    ]);
    const stats = {};
    [...(p.data || []), ...(r.data || []), ...(s.data || [])].forEach((item) => {
      const uid = item.user_id;
      if (!stats[uid]) stats[uid] = { likes: 0, views: 0, comments: 0, posts: 0 };
      stats[uid].likes += item.likes || 0; stats[uid].views += item.views || 0;
      stats[uid].comments += item.comments_count || 0; stats[uid].posts++;
    });
    const topIds = Object.entries(stats)
      .map(([uid, st]) => ({ uid, score: st.likes * 3 + st.comments * 5 + st.views * 0.1, ...st }))
      .sort((a, b) => b.score - a.score).slice(0, 30).map((u) => u.uid);
    if (!topIds.length) return [];
    const { data: profiles } = await supabase.from("profiles").select("id,full_name,username,avatar_id,verified,bio").in("id", topIds);
    return topIds.map((uid, i) => {
      const pr = profiles?.find((x) => x.id === uid); if (!pr) return null;
      const st = stats[uid];
      const avatar = pr.avatar_id ? mediaUrlService.getImageUrl(pr.avatar_id, { width: 160, height: 160, crop: "fill", gravity: "face" }) : null;
      return { userId: pr.id, rank: i + 1, name: pr.full_name || "Creator", username: pr.username || "user", avatar: avatar || pr.full_name?.charAt(0) || "G", verified: pr.verified || false, stats: { likes: st.likes, views: st.views, comments: st.comments, posts: st.posts }, isTopTier: i < 3 };
    }).filter(Boolean);
  };

  const loadTagPosts = async (tag) => {
    setTagPostsLoading(true); setTagPosts([]);
    try {
      const [pr, rr, sr] = await Promise.all([
        supabase.from("posts"  ).select("id,user_id,caption,category,views,likes,media_id"   ).eq("category", tag.label).is("deleted_at", null).order("views", { ascending: false }).limit(10),
        supabase.from("reels"  ).select("id,user_id,caption,category,views,likes,thumbnail_id").eq("category", tag.label).is("deleted_at", null).order("views", { ascending: false }).limit(10),
        supabase.from("stories").select("id,user_id,caption,category,views,likes,media_id"   ).eq("category", tag.label).is("deleted_at", null).order("views", { ascending: false }).limit(10),
      ]);
      const all = [
        ...(pr.data || []).map((x) => ({ ...x, contentType: "post",  thumbField: "media_id"     })),
        ...(rr.data || []).map((x) => ({ ...x, contentType: "reel",  thumbField: "thumbnail_id" })),
        ...(sr.data || []).map((x) => ({ ...x, contentType: "story", thumbField: "media_id"     })),
      ];
      const uids = [...new Set(all.map((x) => x.user_id))];
      const { data: prs } = uids.length ? await supabase.from("profiles").select("id,full_name,username,avatar_id").in("id", uids) : { data: [] };
      const pm = Object.fromEntries((prs || []).map((x) => [x.id, x]));
      setTagPosts(all.map((item) => {
        const p = pm[item.user_id] || {}; const thumbId = item[item.thumbField];
        return { id: item.id, contentType: item.contentType, caption: item.caption || "", views: item.views || 0, likes: item.likes || 0, authorName: p.full_name || "Creator", authorUsername: p.username || "user", authorAvatar: p.avatar_id ? mediaUrlService.getImageUrl(p.avatar_id, { width: 80, height: 80, crop: "fill", gravity: "face" }) : p.full_name?.charAt(0) || "?", thumbnail: thumbId ? mediaUrlService.getImageUrl(thumbId, { width: 160, height: 160, crop: "fill" }) : null };
      }).sort((a, b) => b.views - a.views));
    } catch (e) { console.error(e); }
    finally { setTagPostsLoading(false); }
  };

  const handleTagNavigate   = (tag)     => { setFeedFilter?.({ type: "tag",  value: tag.label }); setAppTab?.("home"); onClose(); };
  const handleTagDrill      = (tag)     => { setActiveTag(tag); loadTagPosts(tag); setPanel("tagPosts"); };
  const handlePostNavigate  = (post)    => { setFeedFilter?.({ type: "post", value: post.id, contentType: post.contentType }); setAppTab?.("home"); onClose(); };
  const handleJoin          = (session) => { onJoinStream?.(session); onClose(); };
  const handleStreamerClick  = (s)      => setStreamerDetail(s);
  const handleCreatorClick   = (c)     => { setSelectedCreator({ id: c.userId, user_id: c.userId, name: c.name, author: c.name, username: c.username, avatar: c.avatar, verified: c.verified }); setCreatorModal(true); };

  if (!isOpen) return null;

  const topTags     = trendingTags.slice(0, 3);
  const topCreators = eliteCreators.slice(0, 3);

  return (
    <>
      <style>{`
        @keyframes mtSlideUp { from{transform:translateY(100%)} to{transform:translateY(0)} }
        @keyframes mtSlideIn { from{transform:translateX(100%)} to{transform:translateX(0)} }
        @keyframes mtSpin    { to{transform:rotate(360deg)} }
        @keyframes mtBlink   { 0%,100%{opacity:1} 50%{opacity:.35} }
        .mt-sc-spin { position:absolute; top:50%; left:50%; width:200%; height:200%; margin:-100% 0 0 -100%; background:conic-gradient(#ef4444 0deg,#fb7185 40%,#ef4444 360deg); animation:mtScSpin 4s linear infinite; z-index:0; }
        @keyframes mtScSpin { to{transform:rotate(360deg)} }
        .mt-sc-pulse { animation:mtScPulse 2s ease-out infinite; }
        @keyframes mtScPulse { 0%{transform:scale(1);opacity:.5} 100%{transform:scale(1.55);opacity:0} }
        .mt-sc-dot { animation:mtScBlink 1.4s ease-in-out infinite; }
        @keyframes mtScBlink { 0%,100%{opacity:1} 50%{opacity:.4} }
      `}</style>

      <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.75)", backdropFilter: "blur(8px)", zIndex: 9999 }} />

      <div style={{ position: "fixed", inset: 0, zIndex: 10000, background: "#050505", display: "flex", flexDirection: "column", fontFamily: "-apple-system,BlinkMacSystemFont,'SF Pro Display','Segoe UI',sans-serif", color: "#fff", animation: "mtSlideUp .28s cubic-bezier(.34,1.1,.64,1)", overflow: "hidden" }}>

        {/* Top bar */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px", background: "rgba(5,5,5,.98)", backdropFilter: "blur(20px)", borderBottom: "1px solid rgba(132,204,22,.1)", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <TrendingUp size={20} color="#84cc16" />
            <span style={{ fontSize: 18, fontWeight: 900, color: "#fff" }}>Trending</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button onClick={() => { setRefreshing(true); loadAll(false); loadLive(); }} disabled={refreshing}
              style={{ width: 36, height: 36, borderRadius: "50%", background: "rgba(132,204,22,.1)", border: "1px solid rgba(132,204,22,.2)", display: "flex", alignItems: "center", justifyContent: "center", color: "#84cc16", cursor: "pointer" }}>
              <RefreshCw size={15} style={{ animation: refreshing ? "mtSpin 1s linear infinite" : "none" }} />
            </button>
            <button onClick={onClose} style={{ width: 36, height: 36, borderRadius: "50%", background: "rgba(255,255,255,.05)", border: "1px solid rgba(255,255,255,.08)", display: "flex", alignItems: "center", justifyContent: "center", color: "#737373", cursor: "pointer" }}>
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Scrollable body */}
        <div style={{ flex: 1, overflowY: "auto", padding: "16px 16px 32px" }}>
          {loading && topStreamers.length === 0 ? (
            <UnifiedLoader type="section" message="Loading trending…" />
          ) : error && topStreamers.length === 0 ? (
            <UnifiedLoader type="section" error={error} onRetry={() => loadAll(true)} />
          ) : (
            <>
              {/* ══ TOP STREAMERS ══ */}
              <div style={{ marginBottom: 22 }}>
                <SectionHeader icon={Tv} iconColor="#ef4444" iconBg="rgba(239,68,68,.1)" iconBorder="rgba(239,68,68,.22)" title="Top Streamers" subtitle="Ranked by peak viewers" />
                {topStreamers.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "24px 0", color: "#2e2e2e" }}>
                    <div style={{ fontSize: 32, marginBottom: 8, opacity: .4 }}>📡</div>
                    <p style={{ fontSize: 13, margin: 0 }}>No streamers yet — be the first to go live!</p>
                  </div>
                ) : (
                  <>
                    {topStreamers.slice(0, STREAMERS_PREVIEW).map((s) => (
                      <StreamerRow key={s.userId} streamer={s} onClick={handleStreamerClick} />
                    ))}
                    {topStreamers.length > STREAMERS_PREVIEW && (
                      <ViewMoreBtn onClick={() => setPanel("streamers")} red>
                        View All {topStreamers.length} Streamers <ArrowRight size={14} />
                      </ViewMoreBtn>
                    )}
                  </>
                )}
              </div>

              {/* ══ LIVE NOW — shown as soon as sessions exist, no liveLoading gate ══ */}
              {liveSessions.length > 0 && (
                <div style={{ marginBottom: 22, background: "rgba(239,68,68,.03)", border: "1px solid rgba(239,68,68,.08)", borderRadius: 13, padding: "12px 12px 6px" }}>
                  <SectionHeader icon={Radio} iconColor="#ef4444" iconBg="rgba(239,68,68,.1)" iconBorder="rgba(239,68,68,.22)" title="Live Now" subtitle="Tap a circle to join"
                    right={<div style={{ display: "flex", alignItems: "center", gap: 4, padding: "2px 8px", borderRadius: 6, background: "rgba(239,68,68,.1)", border: "1px solid rgba(239,68,68,.2)", fontSize: 10, fontWeight: 800, color: "#ef4444" }}><span style={{ width: 5, height: 5, borderRadius: "50%", background: "#ef4444", animation: "mtBlink 1.6s infinite" }} />{liveSessions.length}</div>} />
                  <div style={{ display: "flex", flexDirection: "row", gap: 12, overflowX: "auto", WebkitOverflowScrolling: "touch", scrollSnapType: "x mandatory", scrollbarWidth: "none", padding: "2px 0 10px" }}>
                    {liveSessions.map((s) => <StreamerCircle key={s.id} session={s} onJoin={handleJoin} isOwn={s.profiles?.id === currentUser?.id} />)}
                  </div>
                </div>
              )}

              {/* ══ TRENDING TAGS ══ */}
              <div style={{ marginBottom: 22 }}>
                <SectionHeader icon={Flame} iconColor="#84cc16" iconBg="rgba(132,204,22,.1)" iconBorder="rgba(132,204,22,.2)" title="Trending Now" subtitle="What's hot on Xeevia" />
                {topTags.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "24px 0", color: "#2e2e2e" }}><div style={{ fontSize: 32, marginBottom: 8, opacity: .4 }}>🔥</div><p style={{ fontSize: 13, margin: 0 }}>No trending tags yet</p></div>
                ) : (
                  <>
                    {topTags.map((tag, i) => <TagRow key={tag.label} tag={tag} index={i} onNavigate={handleTagNavigate} onDrill={handleTagDrill} />)}
                    {trendingTags.length > 3 && <ViewMoreBtn onClick={() => setPanel("tags")}>View Top 30 Tags <ArrowRight size={14} /></ViewMoreBtn>}
                  </>
                )}
              </div>

              {/* ══ TOP CREATORS ══ */}
              <div style={{ marginBottom: 16 }}>
                <SectionHeader icon={Crown} iconColor="#fbbf24" iconBg="rgba(251,191,36,.1)" iconBorder="rgba(251,191,36,.25)" title="Top Creators" subtitle="This week's stars" />
                {topCreators.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "24px 0", color: "#2e2e2e" }}><div style={{ fontSize: 32, marginBottom: 8, opacity: .4 }}>👑</div><p style={{ fontSize: 13, margin: 0 }}>No creators this week</p></div>
                ) : (
                  <>
                    {topCreators.map((c) => <CreatorRow key={c.userId} creator={c} onClick={handleCreatorClick} />)}
                    {eliteCreators.length > 3 && <ViewMoreBtn onClick={() => setPanel("creators")}>View Top 30 Creators <ArrowRight size={14} /></ViewMoreBtn>}
                  </>
                )}
              </div>
            </>
          )}
        </div>

        {/* ══ SUB-PANELS ══ */}
        {panel === "streamers" && (
          <SubPanel title="Top Streamers" subtitle={`${topStreamers.length} streamers · ranked by peak viewers`}
            icon={Tv} iconColor="#ef4444" iconBg="rgba(239,68,68,.1)" iconBorder="rgba(239,68,68,.22)"
            onBack={() => setPanel(null)}>
            {topStreamers.map((s) => <StreamerRow key={s.userId} streamer={s} onClick={(str) => { setPanel(null); handleStreamerClick(str); }} />)}
          </SubPanel>
        )}

        {panel === "tags" && (
          <SubPanel title="Trending Tags" subtitle="Top 30 · tap label to explore, arrow for posts"
            icon={Flame} iconColor="#84cc16" iconBg="rgba(132,204,22,.1)" iconBorder="rgba(132,204,22,.2)"
            onBack={() => setPanel(null)}>
            {trendingTags.map((tag, i) => <TagRow key={tag.label} tag={tag} index={i} onNavigate={(t) => { handleTagNavigate(t); setPanel(null); }} onDrill={handleTagDrill} />)}
          </SubPanel>
        )}

        {panel === "creators" && (
          <SubPanel title="Top Creators" subtitle="This week's top 30"
            icon={Crown} iconColor="#fbbf24" iconBg="rgba(251,191,36,.1)" iconBorder="rgba(251,191,36,.25)"
            onBack={() => setPanel(null)}>
            {eliteCreators.map((c) => <CreatorRow key={c.userId} creator={c} onClick={handleCreatorClick} />)}
          </SubPanel>
        )}

        {panel === "tagPosts" && activeTag && (
          <SubPanel title={activeTag.label} subtitle={`${activeTag.posts} posts · ${fmt(activeTag.views)} views`}
            icon={Hash} iconColor="#60a5fa" iconBg="rgba(96,165,250,.1)" iconBorder="rgba(96,165,250,.22)"
            onBack={() => { setPanel("tags"); setActiveTag(null); setTagPosts([]); }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 12px", marginBottom: 10, background: "rgba(132,204,22,.05)", border: "1px solid rgba(132,204,22,.1)", borderRadius: 9, fontSize: 12, color: "#84cc16", fontWeight: 600 }}>
              <Zap size={13} />Tap any post to open it in your feed
            </div>
            {tagPostsLoading
              ? <UnifiedLoader type="section" message={`Loading ${activeTag.label} posts…`} />
              : tagPosts.length > 0
                ? tagPosts.map((post) => <PostCard key={`${post.contentType}-${post.id}`} post={post} onNavigate={(p) => { handlePostNavigate(p); setPanel(null); }} />)
                : <div style={{ textAlign: "center", padding: "32px 0", color: "#2e2e2e" }}><div style={{ fontSize: 32, marginBottom: 8, opacity: .4 }}>📭</div><p style={{ fontSize: 13, margin: 0 }}>No posts found for {activeTag.label}</p></div>}
          </SubPanel>
        )}
      </div>

      {creatorModal && selectedCreator && (
        <UserProfileModal user={selectedCreator} currentUser={currentUser}
          onClose={() => { setCreatorModal(false); setSelectedCreator(null); }} />
      )}

      {/* StreamerDetailModal — portal on document.body, always above everything */}
      {streamerDetail && ReactDOM.createPortal(
        <div style={{ position: "fixed", inset: 0, zIndex: 10050 }}>
          <StreamerDetailModal
            streamer={streamerDetail}
            onClose={() => setStreamerDetail(null)}
          />
        </div>,
        document.body
      )}
    </>
  );
};

export default MobileTrendingModal;