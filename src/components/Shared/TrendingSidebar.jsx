// src/components/Shared/TrendingSidebar.jsx
// ============================================================================
// Sections (in order):
//   [TS]  Top Streamers — stable historical ranking, never blanks
//   [LV]  Live Now — horizontal scrollable circle cards (currently live)
//   [TAG] Trending Tags — drill-down per row
//   [CRE] Top Creators — profile modal on click
//   Clicking any streamer row opens StreamerDetailModal
// ============================================================================

import React, { useState, useEffect, useRef } from "react";
import ReactDOM from "react-dom";
import {
  TrendingUp, X, Eye, Sparkles, Flame, Crown, ChevronRight,
  RefreshCw, ArrowRight, ArrowLeft, Hash, FileText, Play,
  BookOpen, Zap, Radio, Tv,
} from "lucide-react";

import { supabase }         from "../../services/config/supabase";
import mediaUrlService      from "../../services/shared/mediaUrlService";
import UnifiedLoader        from "./UnifiedLoader";
import UserProfileModal     from "../Modals/UserProfileModal";
import StreamerDetailModal  from "./StreamerDetailModal";

// ── Constants ─────────────────────────────────────────────────────────────────
const DESKTOP_HEADER_H  = 58;
const MOBILE_HEADER_H   = 47;
const STREAMERS_PREVIEW = 3;

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmt = (n) => {
  if (!n) return "0";
  if (n >= 1e9) return `${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  return String(n);
};

const rankStyle = (rank) => {
  if (rank === 1) return { bg: "linear-gradient(135deg,#fbbf24,#f59e0b)", color: "#000", shadow: "rgba(251,191,36,.35)" };
  if (rank === 2) return { bg: "linear-gradient(135deg,#e2e8f0,#94a3b8)", color: "#000", shadow: "rgba(148,163,184,.3)" };
  if (rank === 3) return { bg: "linear-gradient(135deg,#cd7c3a,#a16027)", color: "#fff", shadow: "rgba(205,124,58,.3)" };
  return { bg: "rgba(239,68,68,.12)", color: "#ef4444", shadow: "transparent" };
};

// ── Live sessions fetcher (currently live only) ───────────────────────────────
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

// ── Top streamers fetcher ─────────────────────────────────────────────────────
const fetchTopStreamers = async () => {
  // ── USE RPC to bypass Row Level Security ───────────────────────────────────
  // live_sessions has RLS: users can only SELECT their own rows.
  // Querying directly means each user only sees themselves in the leaderboard.
  // The get_top_streamers() function runs with SECURITY DEFINER, bypassing RLS
  // to produce a true cross-user ranking. See get_top_streamers.sql to deploy it.
  let ranked = [];

  try {
    const { data: rpcData, error: rpcError } = await supabase
      .rpc("get_top_streamers");

    if (!rpcError && rpcData && rpcData.length > 0) {
      // RPC succeeded — use the full cross-user leaderboard
      ranked = rpcData.map((row, i) => ({
        userId:      row.user_id,
        peakViewers: row.peak_viewers  || 0,
        totalLikes:  row.total_likes   || 0,
        sessions:    row.sessions      || 0,
        score:       row.score         || 0,
      }));
    } else {
      // RPC not deployed yet — fall back to direct query (shows own data only)
      // This is the degraded mode until the SQL function is deployed.
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
          score: d.sessions * 300 + d.peakViewers * 0.6 + d.totalLikes * 0.4,
        }))
        .sort((a, b) => b.score - a.score)
        .slice(0, 30);
    }
  } catch {
    return [];
  }

  if (ranked.length === 0) return [];

  // Fetch profiles for all ranked user IDs
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

// ── Sliding panel ─────────────────────────────────────────────────────────────
const SlidingPanel = ({
  isMobile, onClose, title, subtitle,
  icon: Icon, iconColor = "#84cc16",
  iconBg = "rgba(132,204,22,.1)", iconBorder = "rgba(132,204,22,.2)",
  children,
}) => {
  const top = isMobile ? MOBILE_HEADER_H : DESKTOP_HEADER_H;
  return (
    <>
      <div className="sp-overlay" style={{ top }} onClick={onClose} />
      <div className="sp-panel" style={{ top, height: `calc(100vh - ${top}px)` }}>
        <div className="sp-hdr">
          <div className="sp-hdr-left">
            <div className="sp-icon" style={{ background: iconBg, borderColor: iconBorder }}>
              <Icon size={14} color={iconColor} />
            </div>
            <div>
              <div className="sp-title">{title}</div>
              {subtitle && <div className="sp-subtitle">{subtitle}</div>}
            </div>
          </div>
          <button className="sp-close" onClick={onClose}><X size={13} /></button>
        </div>
        <div className="sp-body">{children}</div>
      </div>
    </>
  );
};

// ── Post preview card ─────────────────────────────────────────────────────────
const PostPreviewCard = ({ post, onNavigate }) => (
  <button className="pp-card" style={{ animationDelay: `${post._idx * 0.04}s` }} onClick={() => onNavigate(post)}>
    {post.thumbnail && (
      <div className="pp-thumb">
        <img src={post.thumbnail} alt="" />
        {post.contentType === "reel" && <div className="pp-play"><Play size={10} color="#fff" /></div>}
      </div>
    )}
    <div className="pp-body">
      <div className="pp-author-row">
        <div className="pp-avatar">
          {post.authorAvatar?.startsWith("http") ? <img src={post.authorAvatar} alt="" /> : <span>{post.authorAvatar || "?"}</span>}
        </div>
        <div className="pp-author-info">
          <span className="pp-author-name">{post.authorName}</span>
          <span className="pp-author-handle">@{post.authorUsername}</span>
        </div>
        <div className="pp-type-badge">
          {post.contentType === "reel"  && <Play     size={9} color="#fb7185" />}
          {post.contentType === "story" && <BookOpen size={9} color="#a78bfa" />}
          {post.contentType === "post"  && <FileText size={9} color="#60a5fa" />}
          <span>{post.contentType}</span>
        </div>
      </div>
      {post.caption && <p className="pp-caption">{post.caption.slice(0, 80)}{post.caption.length > 80 ? "…" : ""}</p>}
      <div className="pp-stats">
        <span><Eye size={9} />{fmt(post.views)}</span>
        <span>❤ {fmt(post.likes)}</span>
      </div>
    </div>
    <ChevronRight size={13} className="pp-arrow" />
  </button>
);

// ── Mobile header ─────────────────────────────────────────────────────────────
const MobileHeader = ({ onClose }) => (
  <div className="mob-hdr">
    <div className="mob-hdr-title"><TrendingUp size={18} /><span>Trending</span></div>
    <button className="mob-close" onClick={onClose}><X size={18} /></button>
  </div>
);

// ── Compact streamer row ──────────────────────────────────────────────────────
const AVATAR_GRADIENTS = [
  "linear-gradient(135deg,#84cc16,#4d7c0f)",   // green
  "linear-gradient(135deg,#60a5fa,#1d4ed8)",   // blue
  "linear-gradient(135deg,#a78bfa,#6d28d9)",   // purple
  "linear-gradient(135deg,#f59e0b,#b45309)",   // amber
  "linear-gradient(135deg,#f472b6,#be185d)",   // pink
  "linear-gradient(135deg,#34d399,#065f46)",   // emerald
  "linear-gradient(135deg,#fb923c,#c2410c)",   // orange
  "linear-gradient(135deg,#38bdf8,#0369a1)",   // sky
];
const avatarGradient = (seed = "") => {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return AVATAR_GRADIENTS[h % AVATAR_GRADIENTS.length];
};

const StreamerRow = ({ streamer, onClick }) => {
  const [imgErr, setImgErr] = useState(false);
  const rc = rankStyle(streamer.rank);
  const pr = streamer.profile || {};
  const avatarUrl =
    !imgErr && pr.avatar_id
      ? mediaUrlService.getImageUrl(pr.avatar_id, { width: 60, height: 60, crop: "fill", gravity: "face" })
      : null;
  const initial  = (pr.full_name || pr.username || "?").charAt(0).toUpperCase();
  const fallback = avatarGradient(pr.id || pr.username || String(streamer.rank));

  return (
    <div className="streamer-row" onClick={() => onClick?.(streamer)}>
      <div className="streamer-rank" style={{ background: rc.bg, color: rc.color, boxShadow: `0 2px 8px ${rc.shadow}` }}>
        {streamer.rank}
      </div>
      <div className="streamer-avatar" style={{ background: avatarUrl ? undefined : fallback }}>
        {avatarUrl
          ? <img src={avatarUrl} alt="" onError={() => setImgErr(true)} />
          : <span>{initial}</span>}
      </div>
      <div className="streamer-info">
        <div className="streamer-name">
          {pr.full_name || pr.username || `Streamer #${streamer.rank}`}
          {pr.verified && <span className="v-badge"><Sparkles size={8} /></span>}
        </div>
        <div className="streamer-meta">
          {pr.username && <><span>@{pr.username}</span><span className="dot">·</span></>}
          <Eye size={9} />
          <span className="accent">{fmt(streamer.peakViewers)}</span>
          <span className="dot">·</span>
          <span className="accent">{streamer.sessions}</span>
          <span>{streamer.sessions === 1 ? "stream" : "streams"}</span>
        </div>
      </div>
      <ChevronRight size={13} className="streamer-arrow" />
    </div>
  );
};

// ── Streamer circle card (Live Now strip) ─────────────────────────────────────
const StreamerCircle = ({ session, onJoin, isOwn }) => {
  const profile = session.profiles || {};
  const [imgErr,    setImgErr]    = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);
  const avatarUrl =
    !imgErr && profile.avatar_id
      ? mediaUrlService.getImageUrl(profile.avatar_id, { width: 100, height: 100, crop: "fill", gravity: "face" })
      : null;
  const initial = (profile.full_name || profile.username || "?").charAt(0).toUpperCase();

  return (
    <button
      className={`sc-card${isOwn ? " sc-own" : ""}`}
      onClick={() => !isOwn && onJoin(session)}
      title={isOwn ? "Your stream" : `${profile.username || "Streamer"} — ${session.title}`}
    >
      <div className="sc-ring-wrap">
        <div className="sc-ring">
          <div className="sc-spin" />
          <div className="sc-avatar-wrap">
            <div className="sc-avatar-inner">
              <span className="sc-initial">{initial}</span>
              {avatarUrl && (
                <img src={avatarUrl} alt=""
                  onLoad={() => setImgLoaded(true)} onError={() => setImgErr(true)}
                  style={{ opacity: imgLoaded ? 1 : 0 }} />
              )}
            </div>
          </div>
        </div>
        <div className="sc-pulse" />
        <div className="sc-dot" />
        <div className="sc-chip"><Eye size={7} strokeWidth={2.5} />{fmt(session.peak_viewers || 0)}</div>
      </div>
      <span className="sc-name">{(profile.username || profile.full_name || "stream").slice(0, 9)}</span>
      <span className="sc-cat">{(session.category || "").slice(0, 8)}</span>
    </button>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════
const TrendingSidebar = ({ currentUser, isMobile = false, onClose, setActiveTab, setFeedFilter, onJoinStream }) => {
  const [liveSessions,    setLiveSessions]    = useState([]);
  const [liveLoading,     setLiveLoading]     = useState(true);
  const [topStreamers,    setTopStreamers]    = useState([]);
  const [trendingTags,    setTrendingTags]    = useState([]);
  const [eliteCreators,   setEliteCreators]   = useState([]);
  const [loading,         setLoading]         = useState(true);
  const [error,           setError]           = useState(null);
  const [refreshing,      setRefreshing]      = useState(false);

  const streamersCache = useRef([]);

  const [streamersPanel,  setStreamersPanel]  = useState(false);
  const [tagsPanel,       setTagsPanel]       = useState(false);
  const [creatorsPanel,   setCreatorsPanel]   = useState(false);
  const [tagPostsPanel,   setTagPostsPanel]   = useState(false);
  const [activeTag,       setActiveTag]       = useState(null);
  const [tagPosts,        setTagPosts]        = useState([]);
  const [tagPostsLoading, setTagPostsLoading] = useState(false);

  const [creatorModal,    setCreatorModal]    = useState(false);
  const [selectedCreator, setSelectedCreator] = useState(null);
  const [streamerDetail,  setStreamerDetail]  = useState(null);

  // ── Live realtime ─────────────────────────────────────────────────────────
  useEffect(() => {
    let alive = true;
    const go = async () => {
      try { const d = await fetchLiveSessions(); if (alive) setLiveSessions(d); }
      catch { /* silent */ }
      finally { if (alive) setLiveLoading(false); }
    };
    go();
    const ch = supabase.channel("ts_live")
      .on("postgres_changes", { event: "*", schema: "public", table: "live_sessions" }, async () => {
        try { const d = await fetchLiveSessions(); if (alive) setLiveSessions(d); } catch {}
      }).subscribe();
    return () => { alive = false; supabase.removeChannel(ch); };
  }, []);

  // ── All other data ────────────────────────────────────────────────────────
  useEffect(() => {
    loadAll(true);
    const iv = setInterval(() => loadAll(false), 10 * 60 * 1000);
    return () => clearInterval(iv);
  }, []); // eslint-disable-line

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
    const [sR, pR, rR] = await Promise.all([
      supabase.from("stories").select("category,views").is("deleted_at", null).order("views", { ascending: false }).limit(100),
      supabase.from("posts"  ).select("category,views").is("deleted_at", null).order("views", { ascending: false }).limit(100),
      supabase.from("reels"  ).select("category,views").is("deleted_at", null).order("views", { ascending: false }).limit(100),
    ]);
    const map = {};
    [...(sR.data || []), ...(pR.data || []), ...(rR.data || [])].forEach((item) => {
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
    const [pR, rR, sR] = await Promise.all([
      supabase.from("posts"  ).select("user_id,likes,views,comments_count").is("deleted_at", null).gte("created_at", iso),
      supabase.from("reels"  ).select("user_id,likes,views,comments_count").is("deleted_at", null).gte("created_at", iso),
      supabase.from("stories").select("user_id,likes,views,comments_count").is("deleted_at", null).gte("created_at", iso),
    ]);
    const stats = {};
    [...(pR.data || []), ...(rR.data || []), ...(sR.data || [])].forEach((item) => {
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
      const pr = profiles?.find((p) => p.id === uid); if (!pr) return null;
      const st = stats[uid];
      const avatar = pr.avatar_id ? mediaUrlService.getImageUrl(pr.avatar_id, { width: 200, height: 200, crop: "fill", gravity: "face" }) : null;
      return {
        userId: pr.id, rank: i + 1, name: pr.full_name || "Creator", username: pr.username || "user",
        avatar: avatar || pr.full_name?.charAt(0) || "G", verified: pr.verified || false, bio: pr.bio || "",
        stats: { likes: st.likes, views: st.views, comments: st.comments, posts: st.posts }, isTopTier: i < 3,
      };
    }).filter(Boolean);
  };

  const loadTagPosts = async (tag) => {
    setTagPostsLoading(true); setTagPosts([]);
    try {
      const [pR, rR, sR] = await Promise.all([
        supabase.from("posts"  ).select("id,user_id,caption,category,views,likes,media_id,created_at"   ).eq("category", tag.label).is("deleted_at", null).order("views", { ascending: false }).limit(10),
        supabase.from("reels"  ).select("id,user_id,caption,category,views,likes,thumbnail_id,created_at").eq("category", tag.label).is("deleted_at", null).order("views", { ascending: false }).limit(10),
        supabase.from("stories").select("id,user_id,caption,category,views,likes,media_id,created_at"   ).eq("category", tag.label).is("deleted_at", null).order("views", { ascending: false }).limit(10),
      ]);
      const all = [
        ...(pR.data || []).map((x) => ({ ...x, contentType: "post",  thumbField: "media_id"     })),
        ...(rR.data || []).map((x) => ({ ...x, contentType: "reel",  thumbField: "thumbnail_id" })),
        ...(sR.data || []).map((x) => ({ ...x, contentType: "story", thumbField: "media_id"     })),
      ];
      const uids = [...new Set(all.map((x) => x.user_id))];
      const { data: profiles } = uids.length
        ? await supabase.from("profiles").select("id,full_name,username,avatar_id").in("id", uids)
        : { data: [] };
      const pm = Object.fromEntries((profiles || []).map((p) => [p.id, p]));
      setTagPosts(all.map((item, idx) => {
        const pr = pm[item.user_id] || {}; const thumbId = item[item.thumbField];
        return {
          id: item.id, contentType: item.contentType, caption: item.caption || "",
          views: item.views || 0, likes: item.likes || 0,
          authorName: pr.full_name || "Creator", authorUsername: pr.username || "user",
          authorAvatar: pr.avatar_id ? mediaUrlService.getImageUrl(pr.avatar_id, { width: 80, height: 80, crop: "fill", gravity: "face" }) : pr.full_name?.charAt(0) || "?",
          thumbnail: thumbId ? mediaUrlService.getImageUrl(thumbId, { width: 160, height: 160, crop: "fill" }) : null,
          _idx: idx,
        };
      }).sort((a, b) => b.views - a.views));
    } catch (e) { console.error(e); }
    finally { setTagPostsLoading(false); }
  };

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleTagNavigate  = (tag)    => { setFeedFilter?.({ type: "tag",  value: tag.label }); setActiveTab?.("home"); onClose?.(); };
  const handleTagDrill     = (e, tag) => { e.stopPropagation(); setActiveTag(tag); setTagPostsPanel(true); setTagsPanel(false); loadTagPosts(tag); };
  const handlePostNavigate = (post)   => { setFeedFilter?.({ type: "post", value: post.id, contentType: post.contentType }); setActiveTab?.("home"); onClose?.(); };
  const handleJoin         = (session) => { onJoinStream?.(session); onClose?.(); };
  const handleStreamerClick = (streamer) => setStreamerDetail(streamer);
  const handleCreatorClick  = (creator) => {
    setSelectedCreator({ id: creator.userId, user_id: creator.userId, name: creator.name, author: creator.name, username: creator.username, avatar: creator.avatar, verified: creator.verified });
    setCreatorModal(true);
  };

  // ── Inner sub-components ──────────────────────────────────────────────────
  const TagRow = ({ tag, index }) => (
    <div className="tag-row" onClick={() => handleTagNavigate(tag)}>
      <div className={`tag-num${index < 3 ? " hot" : ""}`}>{index < 3 ? <Flame size={11} /> : index + 1}</div>
      <div className="tag-body">
        <span className="tag-name">{tag.label}</span>
        <div className="tag-meta">
          <Eye size={10} />{fmt(tag.views)}<span className="dot">·</span>{tag.posts} posts
          {index < 3 && <span className="hot-chip">HOT</span>}
        </div>
      </div>
      <button className="tag-drill-btn" onClick={(e) => handleTagDrill(e, tag)}>
        <ChevronRight size={13} />
      </button>
    </div>
  );

  const CreatorRow = ({ creator }) => {
    const rc = rankStyle(creator.rank);
    return (
      <div className={`creator-row${creator.isTopTier ? " top-tier" : ""}`} onClick={() => handleCreatorClick(creator)}>
        <div className="creator-rank" style={{ background: rc.bg, color: rc.color, boxShadow: `0 3px 10px ${rc.shadow}` }}>{creator.rank}</div>
        <div className="creator-avatar-wrap">
          <div className="creator-avatar">
            {typeof creator.avatar === "string" && creator.avatar.startsWith("http") ? <img src={creator.avatar} alt={creator.name} /> : creator.avatar}
          </div>
          {creator.isTopTier && <div className="crown-pip"><Crown size={8} color="#000" /></div>}
        </div>
        <div className="creator-info">
          <div className="creator-name">{creator.name}{creator.verified && <span className="v-badge"><Sparkles size={8} /></span>}</div>
          <div className="creator-meta">
            <span>@{creator.username}</span><span className="dot">·</span>
            <span className="accent">{fmt(creator.stats.likes)}</span> likes<span className="dot">·</span>
            <span className="accent">{creator.stats.posts}</span> posts
          </div>
        </div>
        <ChevronRight size={13} className="creator-arrow" />
      </div>
    );
  };

  if (loading && topStreamers.length === 0) return (
    <aside className={isMobile ? "trending-mobile-fullscreen" : "trending-sidebar"}>
      {isMobile && <MobileHeader onClose={onClose} />}
      {!isMobile && (
        <div style={{
          position: "sticky", top: 0, zIndex: 5, background: "#080808",
          padding: "10px 12px", borderBottom: "1px solid rgba(132,204,22,0.08)",
          display: "flex", alignItems: "center", gap: 8,
        }}>
          <div style={{ width: 24, height: 24, borderRadius: 7, background: "rgba(132,204,22,.1)", border: "1px solid rgba(132,204,22,.2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <TrendingUp size={13} color="#84cc16" />
          </div>
          <span style={{ fontSize: 12, fontWeight: 800, color: "#d4d4d4", letterSpacing: ".4px", textTransform: "uppercase" }}>Trending</span>
        </div>
      )}
      <div style={{ padding: "12px" }}>
        <UnifiedLoader type="section" message="Loading trending…" />
      </div>
    </aside>
  );

  const topTags      = trendingTags.slice(0, 3);
  const topCreators  = eliteCreators.slice(0, 3);

  return (
    <>
      <style>{`
        /* ── DESKTOP STICKY RIGHT COLUMN ── */
        .trending-sidebar::-webkit-scrollbar       { width:3px; }
        .trending-sidebar::-webkit-scrollbar-track { background:transparent; }
        .trending-sidebar::-webkit-scrollbar-thumb { background:rgba(132,204,22,.18); border-radius:2px; }
        /* No padding on .trending-sidebar container — padding lives on .ts-inner-content */
        @media(max-width:1100px){ .trending-sidebar { width:256px; min-width:256px; } }
        @media(max-width:768px) { .trending-sidebar:not(.trending-mobile-fullscreen){ display:none !important; } }
        .trending-mobile-fullscreen { position:fixed !important; inset:0 !important; z-index:10000 !important; background:#000 !important; overflow-y:auto !important; animation:slideUp .28s cubic-bezier(.34,1.1,.64,1); }
        /* Mobile fullscreen: MobileHeader is full-width, content inside gets padding via ts-inner-content */
        @keyframes slideUp { from{transform:translateY(100%)} to{transform:translateY(0)} }
        .mob-hdr { position:sticky; top:0; z-index:10; background:#000; border-bottom:1px solid rgba(132,204,22,.15); padding:12px 16px; display:flex; align-items:center; justify-content:space-between; }
        .mob-hdr-title { display:flex; align-items:center; gap:10px; font-size:16px; font-weight:800; color:#fff; }
        .mob-hdr-title svg { color:#84cc16; }
        .mob-close { width:34px; height:34px; border-radius:50%; background:rgba(255,255,255,.05); border:1px solid rgba(255,255,255,.08); color:#fff; display:flex; align-items:center; justify-content:center; cursor:pointer; }

        .ts-section { margin-bottom:22px; }
        .ts-section:last-child { margin-bottom:0; }
        .ts-header { display:flex; align-items:center; justify-content:space-between; margin-bottom:10px; padding-bottom:9px; border-bottom:1px solid rgba(255,255,255,.06); position:relative; }
        .ts-header::before { content:""; position:absolute; left:0; bottom:-1px; width:28px; height:2px; background:linear-gradient(90deg,var(--ha,#84cc16),transparent); border-radius:1px; }
        .ts-header-left { display:flex; align-items:center; gap:9px; }
        .ts-icon-pill { width:26px; height:26px; border-radius:8px; background:rgba(132,204,22,.1); border:1px solid rgba(132,204,22,.2); display:flex; align-items:center; justify-content:center; flex-shrink:0; }
        .ts-icon-pill.red  { background:rgba(239,68,68,.1);  border-color:rgba(239,68,68,.22); }
        .ts-icon-pill.gold { background:rgba(251,191,36,.1); border-color:rgba(251,191,36,.25); }
        .ts-title-block { display:flex; flex-direction:column; gap:1px; }
        .ts-title    { font-size:11px; font-weight:800; color:#e5e5e5; letter-spacing:.5px; text-transform:uppercase; line-height:1; }
        .ts-subtitle { font-size:10px; color:#484848; font-weight:500; line-height:1; margin-top:2px; }
        .ts-live-count { display:flex; align-items:center; gap:3px; padding:2px 7px; border-radius:5px; background:rgba(239,68,68,.1); border:1px solid rgba(239,68,68,.2); font-size:9px; font-weight:800; color:#ef4444; }
        .ts-live-dot { width:5px; height:5px; border-radius:50%; background:#ef4444; animation:tsBlink 1.6s infinite; }
        @keyframes tsBlink { 0%,100%{opacity:1} 50%{opacity:.35} }
        .ts-refresh { width:26px; height:26px; border-radius:7px; background:rgba(255,255,255,.04); border:1px solid rgba(255,255,255,.07); color:#484848; display:flex; align-items:center; justify-content:center; cursor:pointer; transition:all .18s; }
        .ts-refresh:hover { background:rgba(132,204,22,.08); color:#84cc16; }
        .spin { animation:spin 1s linear infinite; }
        @keyframes spin { to{transform:rotate(360deg);} }

        .streamer-list { display:flex; flex-direction:column; gap:5px; }
        .streamer-row { display:flex; align-items:center; gap:9px; padding:8px 10px; border-radius:10px; background:rgba(255,255,255,.025); border:1px solid rgba(255,255,255,.05); cursor:pointer; transition:all .2s; }
        .streamer-row:hover { background:rgba(239,68,68,.06); border-color:rgba(239,68,68,.2); transform:translateX(2px); }
        .streamer-rank { width:20px; height:20px; border-radius:6px; font-size:10px; font-weight:900; display:flex; align-items:center; justify-content:center; flex-shrink:0; }
        .streamer-avatar { width:30px; height:30px; border-radius:50%; flex-shrink:0; background:linear-gradient(135deg,#525252,#2a2a2a); display:flex; align-items:center; justify-content:center; color:#fff; font-weight:900; font-size:12px; overflow:hidden; border:1.5px solid rgba(255,255,255,.1); }
        .streamer-avatar img { width:100%; height:100%; object-fit:cover; }
        .streamer-info { flex:1; min-width:0; }
        .streamer-name { font-size:12px; font-weight:700; color:#d4d4d4; display:flex; align-items:center; gap:4px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; transition:color .2s; margin-bottom:2px; }
        .streamer-row:hover .streamer-name { color:#fff; }
        .streamer-meta { display:flex; align-items:center; gap:4px; font-size:10px; color:#454545; white-space:nowrap; overflow:hidden; }
        .streamer-meta svg { opacity:.7; flex-shrink:0; }
        .streamer-arrow { color:#2a2a2a; flex-shrink:0; transition:all .2s; }
        .streamer-row:hover .streamer-arrow { color:#ef4444; transform:translateX(2px); }

        .ts-live-strip { background:rgba(239,68,68,.03); border:1px solid rgba(239,68,68,.08); border-radius:11px; padding:9px 9px 3px; }
        .sc-scroll { display:flex; flex-direction:row; gap:10px; overflow-x:auto; -webkit-overflow-scrolling:touch; scroll-snap-type:x mandatory; scrollbar-width:none; padding:2px 0 8px; }
        .sc-scroll::-webkit-scrollbar { display:none; }
        .sc-card { display:flex; flex-direction:column; align-items:center; gap:4px; flex-shrink:0; width:54px; background:transparent; border:none; cursor:pointer; padding:2px 0 0; scroll-snap-align:start; -webkit-tap-highlight-color:transparent; transition:transform .18s; }
        .sc-card:hover { transform:translateY(-2px); } .sc-card:active { transform:scale(.93); }
        .sc-card.sc-own { opacity:.45; cursor:default; pointer-events:none; }
        .sc-ring-wrap { position:relative; width:50px; height:50px; display:flex; align-items:center; justify-content:center; flex-shrink:0; }
        .sc-ring { position:absolute; inset:0; border-radius:50%; overflow:hidden; background:#0a0a0a; }
        .sc-spin { position:absolute; top:50%; left:50%; width:200%; height:200%; margin:-100% 0 0 -100%; background:conic-gradient(#ef4444 0deg,#fb7185 40%,#ef4444 360deg); animation:scSpin 4s linear infinite; z-index:0; }
        @keyframes scSpin { to{transform:rotate(360deg)} }
        .sc-avatar-wrap { position:absolute; inset:3px; border-radius:50%; overflow:hidden; z-index:1; }
        .sc-avatar-inner { width:100%; height:100%; border-radius:50%; background:linear-gradient(135deg,#84cc16,#4d7c0f); display:flex; align-items:center; justify-content:center; position:relative; overflow:hidden; }
        .sc-initial { font-size:13px; font-weight:900; color:#000; position:absolute; z-index:0; user-select:none; line-height:1; }
        .sc-avatar-inner img { position:absolute; inset:0; width:100%; height:100%; object-fit:cover; border-radius:50%; z-index:1; transition:opacity .2s; }
        .sc-pulse { position:absolute; inset:0; border-radius:50%; border:2px solid rgba(239,68,68,.35); animation:scPulse 2s ease-out infinite; pointer-events:none; z-index:0; }
        @keyframes scPulse { 0%{transform:scale(1);opacity:.5} 100%{transform:scale(1.55);opacity:0} }
        .sc-dot { position:absolute; bottom:1px; right:1px; width:10px; height:10px; border-radius:50%; background:#ef4444; border:2px solid #0a0a0a; animation:scBlink 1.4s ease-in-out infinite; z-index:2; }
        @keyframes scBlink { 0%,100%{opacity:1} 50%{opacity:.4} }
        .sc-chip { position:absolute; top:-3px; right:-5px; display:flex; align-items:center; gap:2px; padding:2px 4px; border-radius:4px; background:rgba(0,0,0,.88); border:1px solid rgba(255,255,255,.1); font-size:7.5px; font-weight:800; color:#c4c4c4; z-index:3; white-space:nowrap; }
        .sc-name { font-size:10px; font-weight:700; color:#c4c4c4; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:54px; text-align:center; line-height:1.3; transition:color .15s; }
        .sc-card:hover .sc-name { color:#fff; }
        .sc-cat { font-size:8px; font-weight:500; color:#363636; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:54px; text-align:center; }

        .tag-list { display:flex; flex-direction:column; gap:5px; }
        .tag-row { display:flex; align-items:center; gap:9px; padding:8px 10px; border-radius:10px; background:rgba(255,255,255,.025); border:1px solid rgba(255,255,255,.05); cursor:pointer; transition:all .2s; }
        .tag-row:hover { background:rgba(132,204,22,.07); border-color:rgba(132,204,22,.25); transform:translateX(2px); }
        .tag-num { width:24px; height:24px; border-radius:7px; background:rgba(255,255,255,.05); color:#525252; font-size:10px; font-weight:800; display:flex; align-items:center; justify-content:center; flex-shrink:0; }
        .tag-num.hot { background:rgba(239,68,68,.15); color:#ef4444; }
        .tag-body { flex:1; min-width:0; }
        .tag-name { font-size:12px; font-weight:700; color:#d4d4d4; display:block; margin-bottom:2px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; transition:color .2s; }
        .tag-row:hover .tag-name { color:#fff; }
        .tag-meta { display:flex; align-items:center; gap:5px; font-size:10px; color:#454545; flex-wrap:wrap; }
        .tag-meta svg { opacity:.6; }
        .hot-chip { font-size:9px; font-weight:800; padding:1px 5px; background:rgba(239,68,68,.15); color:#ef4444; border-radius:4px; }
        .dot { color:#2e2e2e; }
        .tag-drill-btn { width:26px; height:26px; border-radius:7px; flex-shrink:0; background:rgba(255,255,255,.04); border:1px solid rgba(255,255,255,.07); color:#3a3a3a; display:flex; align-items:center; justify-content:center; cursor:pointer; transition:all .18s; }
        .tag-row:hover .tag-drill-btn { background:rgba(132,204,22,.1); border-color:rgba(132,204,22,.25); color:#84cc16; }

        .creator-list { display:flex; flex-direction:column; gap:5px; }
        .creator-row { display:flex; align-items:center; gap:9px; padding:8px 10px; border-radius:10px; background:rgba(255,255,255,.025); border:1px solid rgba(255,255,255,.05); cursor:pointer; transition:all .2s; }
        .creator-row:hover { background:rgba(132,204,22,.06); border-color:rgba(132,204,22,.22); transform:translateY(-2px); box-shadow:0 6px 18px rgba(0,0,0,.28); }
        .creator-row.top-tier { border-color:rgba(251,191,36,.18); }
        .creator-row.top-tier:hover { border-color:rgba(251,191,36,.38); background:rgba(251,191,36,.04); }
        .creator-rank { width:22px; height:22px; border-radius:6px; font-size:10px; font-weight:900; display:flex; align-items:center; justify-content:center; flex-shrink:0; }
        .creator-avatar-wrap { position:relative; flex-shrink:0; }
        .creator-avatar { width:32px; height:32px; border-radius:50%; background:linear-gradient(135deg,#84cc16,#65a30d); display:flex; align-items:center; justify-content:center; color:#000; font-weight:900; font-size:13px; overflow:hidden; border:2px solid rgba(132,204,22,.2); }
        .creator-row.top-tier .creator-avatar { border-color:rgba(251,191,36,.4); }
        .creator-avatar img { width:100%; height:100%; object-fit:cover; }
        .crown-pip { position:absolute; top:-5px; right:-5px; width:15px; height:15px; background:linear-gradient(135deg,#fbbf24,#f59e0b); border-radius:50%; display:flex; align-items:center; justify-content:center; border:1.5px solid #000; }
        .creator-info { flex:1; min-width:0; }
        .creator-name { font-size:12px; font-weight:700; color:#d4d4d4; display:flex; align-items:center; gap:5px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; transition:color .2s; }
        .creator-row:hover .creator-name { color:#fff; }
        .v-badge { width:14px; height:14px; background:#84cc16; color:#000; border-radius:50%; display:flex; align-items:center; justify-content:center; flex-shrink:0; }
        .creator-meta { display:flex; align-items:center; gap:4px; font-size:10px; color:#404040; margin-top:2px; white-space:nowrap; overflow:hidden; }
        .accent { color:#84cc16; font-weight:700; }
        .creator-arrow { color:#2a2a2a; flex-shrink:0; transition:all .2s; }
        .creator-row:hover .creator-arrow { color:#84cc16; transform:translateX(2px); }

        .view-more-btn { width:100%; margin-top:7px; padding:8px 12px; background:rgba(132,204,22,.05); border:1px dashed rgba(132,204,22,.2); border-radius:9px; color:#84cc16; font-size:11px; font-weight:700; cursor:pointer; transition:all .22s; display:flex; align-items:center; justify-content:center; gap:6px; }
        .view-more-btn:hover { background:rgba(132,204,22,.1); border-color:#84cc16; border-style:solid; transform:translateY(-1px); box-shadow:0 4px 14px rgba(132,204,22,.12); }
        .view-more-btn.red { background:rgba(239,68,68,.05); border-color:rgba(239,68,68,.22); color:#ef4444; }
        .view-more-btn.red:hover { background:rgba(239,68,68,.1); border-color:#ef4444; border-style:solid; box-shadow:0 4px 14px rgba(239,68,68,.1); }

        .empty-state { text-align:center; padding:20px; color:#333; }
        .empty-icon  { font-size:28px; margin-bottom:6px; opacity:.4; }
        .empty-text  { font-size:12px; font-weight:600; }

        .sp-overlay { position:fixed; left:0; right:0; bottom:0; background:rgba(0,0,0,.72); backdrop-filter:blur(12px); z-index:9998; animation:fadeIn .22s ease; }
        @keyframes fadeIn { from{opacity:0} to{opacity:1} }
        .sp-panel { position:fixed; right:0; bottom:0; width:min(440px,92vw); background:#0b0b0b; border-left:1px solid rgba(132,204,22,.15); border-top:1px solid rgba(255,255,255,.05); z-index:9999; animation:panelSlide .28s cubic-bezier(.34,1.1,.64,1); display:flex; flex-direction:column; overflow:hidden; box-shadow:-14px 0 44px rgba(0,0,0,.55); }
        @keyframes panelSlide { from{transform:translateX(100%)} to{transform:translateX(0)} }
        .sp-hdr { padding:12px 14px; border-bottom:1px solid rgba(255,255,255,.06); display:flex; align-items:center; justify-content:space-between; flex-shrink:0; }
        .sp-hdr-left { display:flex; align-items:center; gap:10px; }
        .sp-icon { width:28px; height:28px; border-radius:8px; border:1px solid; display:flex; align-items:center; justify-content:center; flex-shrink:0; }
        .sp-title    { font-size:13px; font-weight:800; color:#fff; }
        .sp-subtitle { font-size:10px; color:#484848; font-weight:500; margin-top:1px; }
        .sp-close { width:27px; height:27px; border-radius:8px; background:rgba(255,255,255,.04); border:1px solid rgba(255,255,255,.07); color:#484848; cursor:pointer; display:flex; align-items:center; justify-content:center; transition:all .18s; }
        .sp-close:hover { background:rgba(255,255,255,.1); color:#fff; transform:rotate(90deg); }
        .sp-body { flex:1; overflow-y:auto; padding:10px; display:flex; flex-direction:column; gap:5px; }
        .sp-body::-webkit-scrollbar { width:3px; }
        .sp-body::-webkit-scrollbar-thumb { background:rgba(132,204,22,.2); border-radius:2px; }
        .sp-back { display:flex; align-items:center; gap:7px; padding:7px 10px; margin-bottom:4px; background:rgba(255,255,255,.03); border:1px solid rgba(255,255,255,.06); border-radius:9px; color:#606060; font-size:11px; font-weight:700; cursor:pointer; transition:all .18s; width:100%; }
        .sp-back:hover { background:rgba(132,204,22,.07); border-color:rgba(132,204,22,.2); color:#84cc16; }
        .nav-hint { display:flex; align-items:center; gap:8px; padding:8px 10px; margin-bottom:4px; background:rgba(132,204,22,.05); border:1px solid rgba(132,204,22,.12); border-radius:9px; font-size:10.5px; color:#84cc16; font-weight:600; }

        .pp-card { display:flex; align-items:center; gap:10px; padding:10px; border-radius:10px; background:rgba(255,255,255,.025); border:1px solid rgba(255,255,255,.05); cursor:pointer; text-align:left; width:100%; transition:all .2s; animation:ppIn .22s ease both; }
        @keyframes ppIn { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:translateY(0)} }
        .pp-card:hover { background:rgba(132,204,22,.07); border-color:rgba(132,204,22,.22); transform:translateX(3px); }
        .pp-thumb { width:48px; height:48px; border-radius:8px; overflow:hidden; flex-shrink:0; background:rgba(255,255,255,.05); position:relative; }
        .pp-thumb img { width:100%; height:100%; object-fit:cover; }
        .pp-play { position:absolute; inset:0; display:flex; align-items:center; justify-content:center; background:rgba(0,0,0,.4); }
        .pp-body { flex:1; min-width:0; }
        .pp-author-row { display:flex; align-items:center; gap:7px; margin-bottom:4px; }
        .pp-avatar { width:20px; height:20px; border-radius:50%; background:rgba(132,204,22,.2); overflow:hidden; flex-shrink:0; display:flex; align-items:center; justify-content:center; font-size:9px; font-weight:800; color:#84cc16; }
        .pp-avatar img { width:100%; height:100%; object-fit:cover; }
        .pp-author-info { flex:1; min-width:0; }
        .pp-author-name   { font-size:11px; font-weight:700; color:#d4d4d4; display:block; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
        .pp-author-handle { font-size:9.5px; color:#484848; }
        .pp-type-badge { display:flex; align-items:center; gap:3px; padding:2px 5px; background:rgba(255,255,255,.06); border-radius:5px; font-size:9px; font-weight:700; color:#525252; flex-shrink:0; text-transform:capitalize; }
        .pp-caption { font-size:11px; color:#606060; margin:0 0 4px; line-height:1.4; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; }
        .pp-stats { display:flex; gap:10px; font-size:10px; color:#404040; }
        .pp-stats span { display:flex; align-items:center; gap:3px; }
        .pp-arrow { color:#2a2a2a; flex-shrink:0; transition:all .2s; }
        .pp-card:hover .pp-arrow { color:#84cc16; transform:translateX(2px); }

        /* StreamerDetailModal uses ReactDOM.createPortal on document.body — no CSS class needed */
      `}</style>

      <aside className={isMobile ? "trending-mobile-fullscreen" : "trending-sidebar"}>
        {isMobile && <MobileHeader onClose={onClose} />}

        {/* Desktop sticky top label — full width, no horizontal padding from container */}
        {!isMobile && (
          <div style={{
            position: "sticky", top: 0, zIndex: 5,
            background: "#080808",
            padding: "10px 12px 10px 12px",
            marginBottom: 0,
            borderBottom: "1px solid rgba(132,204,22,0.08)",
            display: "flex", alignItems: "center", justifyContent: "space-between",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ width: 24, height: 24, borderRadius: 7, background: "rgba(132,204,22,.1)", border: "1px solid rgba(132,204,22,.2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <TrendingUp size={13} color="#84cc16" />
              </div>
              <span style={{ fontSize: 12, fontWeight: 800, color: "#d4d4d4", letterSpacing: ".4px", textTransform: "uppercase" }}>Trending</span>
            </div>
            <button className="ts-refresh" onClick={() => { setRefreshing(true); loadAll(false); }} disabled={refreshing} title="Refresh">
              <RefreshCw size={11} className={refreshing ? "spin" : ""} />
            </button>
          </div>
        )}

        {/* Inner content wrapper — this is where all horizontal padding lives */}
        <div style={{ padding: "12px 12px 24px" }}>

        {/* ── TOP STREAMERS ── */}
        <div className="ts-section" style={{ "--ha": "#ef4444" }}>
          <div className="ts-header">
            <div className="ts-header-left">
              <div className="ts-icon-pill red"><Tv size={13} color="#ef4444" /></div>
              <div className="ts-title-block">
                <span className="ts-title">Top Streamers</span>
                <span className="ts-subtitle">Ranked by peak viewers</span>
              </div>
            </div>
            {isMobile && (
              <button className="ts-refresh" onClick={() => { setRefreshing(true); loadAll(false); }} disabled={refreshing}>
                <RefreshCw size={12} className={refreshing ? "spin" : ""} />
              </button>
            )}
          </div>
          {topStreamers.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">📡</div>
              <p className="empty-text">No streamers yet — be the first to go live!</p>
            </div>
          ) : (
            <>
              {/* Top 3 preview — identical pattern to Tags and Creators */}
              <div className="streamer-list">
                {topStreamers.slice(0, STREAMERS_PREVIEW).map((s) => (
                  <StreamerRow key={s.userId} streamer={s} onClick={handleStreamerClick} />
                ))}
              </div>
              {/* View All button — shows whenever there are more than 3 */}
              {topStreamers.length > STREAMERS_PREVIEW && (
                <button className="view-more-btn red" onClick={() => setStreamersPanel(true)}>
                  View All {topStreamers.length} Streamers <ArrowRight size={13} />
                </button>
              )}
            </>
          )}
        </div>

        {/* ── LIVE NOW ── */}
        {!liveLoading && liveSessions.length > 0 && (
          <div className="ts-section ts-live-strip" style={{ "--ha": "#ef4444" }}>
            <div className="ts-header">
              <div className="ts-header-left">
                <div className="ts-icon-pill red"><Radio size={13} color="#ef4444" /></div>
                <div className="ts-title-block">
                  <span className="ts-title">Live Now</span>
                  <span className="ts-subtitle">Tap a circle to join</span>
                </div>
              </div>
              <div className="ts-live-count"><span className="ts-live-dot" />{liveSessions.length}</div>
            </div>
            <div className="sc-scroll">
              {liveSessions.map((s) => <StreamerCircle key={s.id} session={s} onJoin={handleJoin} isOwn={s.profiles?.id === currentUser?.id} />)}
            </div>
          </div>
        )}

        {/* ── TRENDING TAGS ── */}
        <div className="ts-section">
          <div className="ts-header">
            <div className="ts-header-left">
              <div className="ts-icon-pill"><Flame size={13} color="#84cc16" /></div>
              <div className="ts-title-block">
                <span className="ts-title">Trending Now</span>
                <span className="ts-subtitle">What's hot on Xeevia</span>
              </div>
            </div>
            {isMobile && (
              <button className="ts-refresh" onClick={() => { setRefreshing(true); loadAll(false); }} disabled={refreshing}>
                <RefreshCw size={12} className={refreshing ? "spin" : ""} />
              </button>
            )}
          </div>
          {topTags.length === 0 ? (
            <div className="empty-state"><div className="empty-icon">🔥</div><p className="empty-text">No trending tags yet</p></div>
          ) : (
            <>
              <div className="tag-list">{topTags.map((tag, i) => <TagRow key={tag.label} tag={tag} index={i} />)}</div>
              {trendingTags.length > 3 && (
                <button className="view-more-btn" onClick={() => setTagsPanel(true)}>View Top 30 Tags <ArrowRight size={13} /></button>
              )}
            </>
          )}
        </div>

        {/* ── TOP CREATORS ── */}
        <div className="ts-section">
          <div className="ts-header">
            <div className="ts-header-left">
              <div className="ts-icon-pill gold"><Crown size={13} color="#fbbf24" /></div>
              <div className="ts-title-block">
                <span className="ts-title">Top Creators</span>
                <span className="ts-subtitle">This week's stars</span>
              </div>
            </div>
          </div>
          {topCreators.length === 0 ? (
            <div className="empty-state"><div className="empty-icon">👑</div><p className="empty-text">No creators this week</p></div>
          ) : (
            <>
              <div className="creator-list">{topCreators.map((c) => <CreatorRow key={c.userId} creator={c} />)}</div>
              {eliteCreators.length > 3 && (
                <button className="view-more-btn" onClick={() => setCreatorsPanel(true)}>View Top 30 Creators <ArrowRight size={13} /></button>
              )}
            </>
          )}
        </div>
        </div>{/* end ts-inner-content */}
      </aside>

      {/* ══ Streamers panel ══ */}
      {streamersPanel && (
        <SlidingPanel isMobile={isMobile} onClose={() => setStreamersPanel(false)}
          title="Top Streamers" subtitle={`${topStreamers.length} streamers · ranked by peak viewers`}
          icon={Tv} iconColor="#ef4444" iconBg="rgba(239,68,68,.1)" iconBorder="rgba(239,68,68,.22)">
          <div className="streamer-list">
            {topStreamers.map((s) => (
              <StreamerRow key={s.userId} streamer={s} onClick={(str) => { setStreamersPanel(false); handleStreamerClick(str); }} />
            ))}
          </div>
        </SlidingPanel>
      )}

      {/* ══ Tags panel ══ */}
      {tagsPanel && (
        <SlidingPanel isMobile={isMobile} onClose={() => setTagsPanel(false)}
          title="Trending Tags" subtitle="Top 30 · click label to explore, arrow to preview posts" icon={Flame}>
          <div className="tag-list">{trendingTags.map((tag, i) => <TagRow key={tag.label} tag={tag} index={i} />)}</div>
        </SlidingPanel>
      )}

      {/* ══ Creators panel ══ */}
      {creatorsPanel && (
        <SlidingPanel isMobile={isMobile} onClose={() => setCreatorsPanel(false)}
          title="Top Creators" subtitle="This week's top 30"
          icon={Crown} iconColor="#fbbf24" iconBg="rgba(251,191,36,.1)" iconBorder="rgba(251,191,36,.25)">
          <div className="creator-list">{eliteCreators.map((c) => <CreatorRow key={c.userId} creator={c} />)}</div>
        </SlidingPanel>
      )}

      {/* ══ Tag posts panel ══ */}
      {tagPostsPanel && activeTag && (
        <SlidingPanel isMobile={isMobile} onClose={() => { setTagPostsPanel(false); setActiveTag(null); setTagPosts([]); }}
          title={activeTag.label} subtitle={`${activeTag.posts} posts · ${fmt(activeTag.views)} views`}
          icon={Hash} iconColor="#60a5fa" iconBg="rgba(96,165,250,.1)" iconBorder="rgba(96,165,250,.22)">
          <button className="sp-back" onClick={() => { setTagPostsPanel(false); setTagsPanel(true); }}>
            <ArrowLeft size={12} /> Back to all tags
          </button>
          <div className="nav-hint"><Zap size={13} />Tap any post to open it in your feed</div>
          {tagPostsLoading
            ? <UnifiedLoader type="section" message={`Loading ${activeTag.label} posts…`} />
            : tagPosts.length > 0
              ? tagPosts.map((post) => <PostPreviewCard key={`${post.contentType}-${post.id}`} post={post} onNavigate={handlePostNavigate} />)
              : <div className="empty-state"><div className="empty-icon">📭</div><p className="empty-text">No posts found for {activeTag.label}</p></div>}
        </SlidingPanel>
      )}

      {/* ══ Creator modal ══ */}
      {creatorModal && selectedCreator && (
        <UserProfileModal user={selectedCreator} currentUser={currentUser}
          onClose={() => { setCreatorModal(false); setSelectedCreator(null); }} />
      )}

      {/* ══ Streamer detail modal ══
          Rendered via ReactDOM.createPortal directly onto document.body.
          This places it COMPLETELY outside the TrendingSidebar DOM tree and
          outside the Sidebar/AdminSidebar stacking context entirely.
          No z-index competition is possible — it always wins. */}
      {streamerDetail && ReactDOM.createPortal(
        <div style={{
          position: "fixed", inset: 0,
          zIndex: 10050,
          // No background here — StreamerDetailModal provides its own backdrop
        }}>
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

export default TrendingSidebar;