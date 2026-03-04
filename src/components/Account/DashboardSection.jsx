// src/components/Account/DashboardSection.jsx
// Fetch pattern mirrors ProfileSection.jsx exactly.
// ✅ Hooks-rules: useAnimCount only at component top-level (never in .map)
// ✅ Correct columns: views (integer), grova_tokens, engagement_points, is_pro
// ✅ Likes via junction tables: post_likes/reel_likes/story_likes using content IDs
// ✅ Comments: eq("user_id", uid) — comments written by this user
// ✅ Views: select("views") then reduce sum from row data
// ✅ Realtime: all channels cleaned up on unmount, loadData is stable via useCallback

import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Zap, Crown, Sparkles, Eye, Heart, MessageSquare,
  Users, ChevronRight, Hash,
} from "lucide-react";
import { supabase } from "../../services/config/supabase";

// ─── number formatter ─────────────────────────────────────────────────────────
const fmt = (n) => {
  const v = Number(n) || 0;
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000)     return `${(v / 1_000).toFixed(1)}K`;
  return String(v);
};

// ─── animated counter hook ────────────────────────────────────────────────────
const useAnimCount = (target, ms = 560) => {
  const [val, setVal]   = useState(Number(target) || 0);
  const fromRef         = useRef(Number(target) || 0);
  const rafRef          = useRef(null);
  useEffect(() => {
    const to = Number(target) || 0;
    if (fromRef.current === to) return;
    cancelAnimationFrame(rafRef.current);
    const start = fromRef.current;
    const t0    = performance.now();
    const tick  = (now) => {
      const p = Math.min((now - t0) / ms, 1);
      const e = 1 - Math.pow(1 - p, 3);
      setVal(Math.round(start + (to - start) * e));
      if (p < 1) rafRef.current = requestAnimationFrame(tick);
      else { fromRef.current = to; setVal(to); }
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [target, ms]);
  return val;
};

// ─── sub-components (hooks at component top-level — never in .map) ────────────

const LiveDot = ({ color = "#84cc16" }) => (
  <span style={{
    display: "inline-block", width: 5, height: 5, borderRadius: "50%",
    background: color, flexShrink: 0, color,
    animation: "dsPulse 1.8s ease-out infinite",
  }} />
);

// Each SocialPill is its own component → hook called at its own top level ✅
const SocialPill = ({ label, raw }) => {
  const v = useAnimCount(raw);
  return (
    <div className="ds-social-item">
      <span className="ds-social-val">{fmt(v)}</span>
      <span className="ds-social-lbl">{label}</span>
    </div>
  );
};

// Inline animated value ✅
const AnimVal = ({ raw }) => {
  const v = useAnimCount(raw);
  return <>{fmt(v)}</>;
};

// Stat chip — hook at top level of StatChip, not inside a .map ✅
const StatChip = ({ icon: Icon, label, raw, color, idx }) => {
  const v = useAnimCount(raw);
  return (
    <div className="ds-chip" style={{ "--c": color, animationDelay: `${idx * 0.07}s` }}>
      <div className="ds-chip-icon"
        style={{ background: `${color}14`, border: `1px solid ${color}28` }}>
        <Icon size={13} color={color} />
      </div>
      <div className="ds-chip-body">
        <span className="ds-chip-val">{fmt(v)}</span>
        <span className="ds-chip-lbl">{label}</span>
      </div>
      <LiveDot color={color} />
    </div>
  );
};

const QuickAction = ({ emoji, label, sub, color, onClick, idx }) => (
  <button
    className="ds-qa"
    style={{ "--c": color, animationDelay: `${idx * 0.05}s` }}
    onClick={onClick}
  >
    <div className="ds-qa-icon"
      style={{ background: `${color}14`, border: `1px solid ${color}28`, fontSize: 16 }}>
      {emoji}
    </div>
    <div className="ds-qa-text">
      <span className="ds-qa-label" style={{ color }}>{label}</span>
      {sub && <span className="ds-qa-sub">{sub}</span>}
    </div>
    <ChevronRight size={10} color={color} style={{ flexShrink: 0, opacity: 0.4 }} />
  </button>
);

// ─── Live sparkline chart — animates from 0 → actual totalViews ──────────────
const LiveViewsChart = ({ totalViews, totalLikes }) => {
  const [pts, setPts] = useState([0, 0, 0, 0, 0, 0, 0]);
  const rafRef        = useRef(null);

  useEffect(() => {
    const tv     = Number(totalViews) || 0;
    const target = [0, 0.07, 0.2, 0.4, 0.6, 0.82, 1.0].map(r => Math.round(r * tv));
    let frame = 0;
    const FRAMES = 52;
    const tick = () => {
      frame++;
      const p = Math.min(frame / FRAMES, 1);
      const e = 1 - Math.pow(1 - p, 3);
      setPts(target.map(v => Math.round(v * e)));
      if (p < 1) rafRef.current = requestAnimationFrame(tick);
    };
    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [totalViews]);

  const W = 180, H = 46;
  const max = Math.max(...pts, 1);
  const xs  = (i) => ((i / (pts.length - 1)) * W).toFixed(1);
  const ys  = (v) => (H - 4 - ((v / max) * (H - 10))).toFixed(1);
  const line = pts.map((v, i) => `${xs(i)},${ys(v)}`).join(" ");
  const fill = [`0,${H}`, ...pts.map((v, i) => `${xs(i)},${ys(v)}`), `${W},${H}`].join(" ");

  return (
    <div className="ds-spark-row">
      <div className="ds-spark-bar" />
      <div className="ds-spark-info">
        <h4>Views Summary</h4>
        <p><AnimVal raw={totalLikes} /> total likes</p>
      </div>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}
        style={{ overflow: "visible", flexShrink: 0 }}>
        <defs>
          <linearGradient id="lvGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor="#84cc16" stopOpacity="0.32" />
            <stop offset="100%" stopColor="#84cc16" stopOpacity="0" />
          </linearGradient>
        </defs>
        <polygon points={fill} fill="url(#lvGrad)" />
        <polyline points={line} fill="none" stroke="#84cc16" strokeWidth="2"
          strokeLinecap="round" strokeLinejoin="round" />
        {/* pulsing endpoint */}
        <circle cx={xs(pts.length - 1)} cy={ys(pts[pts.length - 1])} r="3.5" fill="#84cc16" />
        <circle cx={xs(pts.length - 1)} cy={ys(pts[pts.length - 1])} r="7" fill="#84cc16" opacity="0.12">
          <animate attributeName="r"       values="3.5;9;3.5" dur="2s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="0.12;0;0.12" dur="2s" repeatCount="indefinite" />
        </circle>
      </svg>
      <span className="ds-spark-val"><AnimVal raw={totalViews} /></span>
    </div>
  );
};

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────
const DashboardSection = ({ currentUser, profile, setActiveTab }) => {
  const uid = currentUser?.id;

  const [data, setData] = useState({
    followers: 0, following: 0,
    posts: 0, reels: 0, stories: 0,
    totalViews: 0, totalLikes: 0, totalComments: 0,
    grovaTokens: 0, engagementPoints: 0,
    communities: 0, isPro: false, verified: false,
  });
  const [loading, setLoading]   = useState(true);
  const [greeting, setGreeting] = useState("");
  const [imgOk, setImgOk]       = useState(true);
  const subsRef                  = useRef([]);

  // Time-of-day greeting
  useEffect(() => {
    const h = new Date().getHours();
    setGreeting(h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening");
  }, []);

  // ── data fetch — mirrors ProfileSection.loadProfileData exactly ─────────────
  const loadData = useCallback(async () => {
    if (!uid) { setLoading(false); return; }
    setLoading(true);
    try {
      // Step 1 — content IDs (needed for junction-table likes)
      const getIds = async (table) => {
        const { data: rows } = await supabase
          .from(table).select("id").eq("user_id", uid).is("deleted_at", null);
        return (rows || []).map(r => r.id);
      };
      const [storyIds, reelIds, postIds] = await Promise.all([
        getIds("stories"), getIds("reels"), getIds("posts"),
      ]);

      // Step 2 — all queries in parallel
      const [
        walletRes,
        storiesCountRes, reelsCountRes, postsCountRes,
        storiesViewsRes, reelsViewsRes,  postsViewsRes,
        commentsRes,
        followersRes,    followingRes,
        commRes,
        storyLikesRes,   reelLikesRes,   postLikesRes,
        profileRes,
      ] = await Promise.allSettled([
        // wallets: grova_tokens | engagement_points
        supabase.from("wallets")
          .select("grova_tokens, engagement_points")
          .eq("user_id", uid).maybeSingle(),

        // content piece counts
        supabase.from("stories").select("*", { count: "exact", head: true }).eq("user_id", uid).is("deleted_at", null),
        supabase.from("reels")  .select("*", { count: "exact", head: true }).eq("user_id", uid).is("deleted_at", null),
        supabase.from("posts")  .select("*", { count: "exact", head: true }).eq("user_id", uid).is("deleted_at", null),

        // views integer rows — we reduce-sum these (same as ProfileSection)
        supabase.from("stories").select("views").eq("user_id", uid).is("deleted_at", null),
        supabase.from("reels")  .select("views").eq("user_id", uid).is("deleted_at", null),
        supabase.from("posts")  .select("views").eq("user_id", uid).is("deleted_at", null),

        // comments WRITTEN BY this user (user_id = uid, same as ProfileSection)
        supabase.from("comments").select("*", { count: "exact", head: true })
          .eq("user_id", uid).is("deleted_at", null),

        // follows.following_id = uid → who follows this user = "followers"
        supabase.from("follows").select("*", { count: "exact", head: true }).eq("following_id", uid),
        // follows.follower_id  = uid → who this user follows = "following"
        supabase.from("follows").select("*", { count: "exact", head: true }).eq("follower_id", uid),

        // community_members.user_id
        supabase.from("community_members").select("*", { count: "exact", head: true }).eq("user_id", uid),

        // likes on user's content via junction tables
        storyIds.length
          ? supabase.from("story_likes").select("*", { count: "exact", head: true }).in("story_id", storyIds)
          : Promise.resolve({ count: 0 }),
        reelIds.length
          ? supabase.from("reel_likes").select("*", { count: "exact", head: true }).in("reel_id", reelIds)
          : Promise.resolve({ count: 0 }),
        postIds.length
          ? supabase.from("post_likes").select("*", { count: "exact", head: true }).in("post_id", postIds)
          : Promise.resolve({ count: 0 }),

        // profiles: is_pro | verified
        supabase.from("profiles").select("verified, is_pro").eq("id", uid).maybeSingle(),
      ]);

      // Step 3 — safe extraction
      const wallet        = walletRes.status === "fulfilled"        ? walletRes.value?.data              : null;
      const storiesCount  = storiesCountRes.status === "fulfilled"  ? (storiesCountRes.value?.count ?? 0) : 0;
      const reelsCount    = reelsCountRes.status === "fulfilled"    ? (reelsCountRes.value?.count   ?? 0) : 0;
      const postsCount    = postsCountRes.status === "fulfilled"    ? (postsCountRes.value?.count   ?? 0) : 0;
      const commentsCount = commentsRes.status === "fulfilled"      ? (commentsRes.value?.count     ?? 0) : 0;
      const followersCount= followersRes.status === "fulfilled"     ? (followersRes.value?.count    ?? 0) : 0;
      const followingCount= followingRes.status === "fulfilled"     ? (followingRes.value?.count    ?? 0) : 0;
      const commCount     = commRes.status === "fulfilled"          ? (commRes.value?.count         ?? 0) : 0;
      const storyLikes    = storyLikesRes.status === "fulfilled"    ? (storyLikesRes.value?.count   ?? 0) : 0;
      const reelLikes     = reelLikesRes.status === "fulfilled"     ? (reelLikesRes.value?.count    ?? 0) : 0;
      const postLikes     = postLikesRes.status === "fulfilled"     ? (postLikesRes.value?.count    ?? 0) : 0;
      const profileFlags  = profileRes.status === "fulfilled"       ? profileRes.value?.data              : null;

      // Step 4 — sum views from row data (same as ProfileSection)
      const allViewRows = [
        ...(storiesViewsRes.status === "fulfilled" ? storiesViewsRes.value?.data || [] : []),
        ...(reelsViewsRes.status   === "fulfilled" ? reelsViewsRes.value?.data   || [] : []),
        ...(postsViewsRes.status   === "fulfilled" ? postsViewsRes.value?.data   || [] : []),
      ];
      const totalViews = allViewRows.reduce((sum, row) => sum + (Number(row.views) || 0), 0);

      setData({
        followers:        followersCount,
        following:        followingCount,
        posts:            postsCount,
        reels:            reelsCount,
        stories:          storiesCount,
        totalViews,
        totalLikes:       storyLikes + reelLikes + postLikes,
        totalComments:    commentsCount,
        grovaTokens:      wallet?.grova_tokens      ?? 0,
        engagementPoints: wallet?.engagement_points ?? 0,
        communities:      commCount,
        isPro:            profileFlags?.is_pro  ?? false,
        verified:         profileFlags?.verified ?? false,
      });
    } catch (err) {
      console.error("DashboardSection.loadData:", err);
    } finally {
      setLoading(false);
    }
  }, [uid]);

  // boot load
  useEffect(() => { loadData(); }, [loadData]);

  // realtime subscriptions — mirror ProfileSection.subscribeLive
  useEffect(() => {
    if (!uid) return;
    subsRef.current.forEach(s => supabase.removeChannel(s));
    subsRef.current = [];
    const sub = (ch) => subsRef.current.push(ch);

    sub(supabase.channel(`ds-follows-${uid}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "follows" },
        () => loadData()).subscribe());

    sub(supabase.channel(`ds-posts-${uid}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "posts", filter: `user_id=eq.${uid}` },
        () => loadData()).subscribe());

    sub(supabase.channel(`ds-reels-${uid}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "reels", filter: `user_id=eq.${uid}` },
        () => loadData()).subscribe());

    sub(supabase.channel(`ds-stories-${uid}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "stories", filter: `user_id=eq.${uid}` },
        () => loadData()).subscribe());

    sub(supabase.channel(`ds-post-likes-${uid}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "post_likes" },
        () => loadData()).subscribe());

    sub(supabase.channel(`ds-reel-likes-${uid}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "reel_likes" },
        () => loadData()).subscribe());

    sub(supabase.channel(`ds-story-likes-${uid}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "story_likes" },
        () => loadData()).subscribe());

    sub(supabase.channel(`ds-comments-${uid}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "comments", filter: `user_id=eq.${uid}` },
        () => loadData()).subscribe());

    sub(supabase.channel(`ds-wallet-${uid}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "wallets", filter: `user_id=eq.${uid}` },
        () => loadData()).subscribe());

    sub(supabase.channel(`ds-profile-${uid}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles", filter: `id=eq.${uid}` },
        () => loadData()).subscribe());

    sub(supabase.channel(`ds-comms-${uid}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "community_members", filter: `user_id=eq.${uid}` },
        () => loadData()).subscribe());

    return () => subsRef.current.forEach(s => supabase.removeChannel(s));
  }, [uid, loadData]);

  // ── display derivations ───────────────────────────────────────────────────
  // Support both camelCase (from app state) and snake_case (direct from DB)
  const name      = profile?.fullName  || profile?.full_name  || currentUser?.fullName  || currentUser?.full_name  || currentUser?.name || "Creator";
  const username  = profile?.username  || currentUser?.username  || "you";
  const avatarSrc = profile?.avatar    || currentUser?.avatar;
  const isVerified= data.verified      || profile?.verified    || currentUser?.verified;
  const isPro     = data.isPro         || profile?.isPro       || profile?.is_pro        || currentUser?.isPro || currentUser?.is_pro;
  const initial   = name.charAt(0).toUpperCase();

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="ds-root">
      <style>{`
        @keyframes dsFadeUp { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
        @keyframes dsGlow   { 0%,100%{box-shadow:0 0 8px rgba(132,204,22,0.08)} 50%{box-shadow:0 0 18px rgba(132,204,22,0.22)} }
        @keyframes dsFlame  { 0%,100%{transform:rotate(-3deg) scale(1)} 50%{transform:rotate(3deg) scale(1.07)} }
        @keyframes dsSpin   { to{transform:rotate(360deg)} }
        @keyframes dsPulse  { 0%{box-shadow:0 0 0 0 currentColor} 70%{box-shadow:0 0 0 5px transparent} 100%{box-shadow:0 0 0 0 transparent} }
        @keyframes dsBar    { from{background-position:0% 0%} to{background-position:200% 0%} }

        .ds-root { padding:0 0 110px; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif; }

        /* HERO */
        .ds-hero { padding:16px 14px 16px; background:linear-gradient(160deg,rgba(132,204,22,0.055) 0%,transparent 55%); border-bottom:1px solid rgba(255,255,255,0.04); position:relative; overflow:hidden; }
        .ds-hero::after { content:''; position:absolute; top:-40px; right:-18px; width:110px; height:110px; border-radius:50%; background:radial-gradient(circle,rgba(132,204,22,0.07) 0%,transparent 70%); pointer-events:none; }

        .ds-hero-row  { display:flex; align-items:center; gap:12px; margin-bottom:14px; }
        .ds-avatar    { width:48px; height:48px; border-radius:14px; background:linear-gradient(135deg,#84cc16,#4d7c0f); display:flex; align-items:center; justify-content:center; font-size:20px; font-weight:900; color:#000; flex-shrink:0; border:2px solid rgba(132,204,22,0.3); box-shadow:0 4px 12px rgba(132,204,22,0.18); position:relative; overflow:hidden; }
        .ds-avatar img { position:absolute; inset:0; width:100%; height:100%; object-fit:cover; border-radius:12px; }
        .ds-hero-info { flex:1; min-width:0; }
        .ds-greeting  { font-size:10.5px; color:#484848; font-weight:600; margin:0 0 2px; }
        .ds-name-row  { display:flex; align-items:center; gap:6px; flex-wrap:wrap; margin-bottom:2px; }
        .ds-name      { font-size:17px; font-weight:900; color:#fff; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:160px; }
        .ds-username  { font-size:11px; color:#484848; font-weight:500; }
        .ds-pro-badge { display:inline-flex; align-items:center; gap:3px; padding:2px 7px; border-radius:6px; background:rgba(251,191,36,0.12); border:1px solid rgba(251,191,36,0.28); font-size:9px; font-weight:800; color:#fbbf24; }
        .ds-vfx-badge { width:15px; height:15px; border-radius:50%; background:linear-gradient(135deg,#84cc16,#4d7c0f); display:flex; align-items:center; justify-content:center; flex-shrink:0; }
        .ds-live-tag  { display:flex; align-items:center; gap:4px; flex-shrink:0; padding:3px 8px; border-radius:7px; background:rgba(132,204,22,0.07); border:1px solid rgba(132,204,22,0.15); }

        .ds-social-row  { display:flex; gap:0; justify-content:space-between; }
        .ds-social-item { flex:1; text-align:center; }
        .ds-social-val  { display:block; font-size:14px; font-weight:900; color:#fff; }
        .ds-social-lbl  { display:block; font-size:9px; color:#484848; font-weight:600; text-transform:uppercase; letter-spacing:0.3px; }

        .ds-meta-row  { display:flex; gap:8px; margin-top:12px; }
        .ds-ep-card   { flex:1; padding:9px 11px; border-radius:12px; background:rgba(132,204,22,0.055); border:1px solid rgba(132,204,22,0.15); display:flex; align-items:center; gap:8px; animation:dsGlow 3.2s ease-in-out infinite; }
        .ds-ep-icon   { width:26px; height:26px; border-radius:8px; background:rgba(132,204,22,0.1); border:1px solid rgba(132,204,22,0.2); display:flex; align-items:center; justify-content:center; flex-shrink:0; }
        .ds-ep-val    { font-size:14px; font-weight:900; color:#84cc16; line-height:1; }
        .ds-ep-lbl    { font-size:9px; color:#484848; font-weight:600; }
        .ds-gt-card   { padding:9px 11px; border-radius:12px; background:rgba(251,191,36,0.055); border:1px solid rgba(251,191,36,0.15); display:flex; align-items:center; gap:7px; }
        .ds-gt-val    { font-size:14px; font-weight:900; color:#fbbf24; line-height:1; }
        .ds-gt-lbl    { font-size:9px; color:#484848; font-weight:600; }
        .ds-str-card  { padding:9px 11px; border-radius:12px; background:rgba(249,115,22,0.055); border:1px solid rgba(249,115,22,0.15); display:flex; align-items:center; gap:7px; }
        .ds-str-icon  { font-size:16px; animation:dsFlame 1.6s ease-in-out infinite; }
        .ds-str-val   { font-size:14px; font-weight:900; color:#f97316; line-height:1; }
        .ds-str-lbl   { font-size:9px; color:#484848; font-weight:600; }

        /* SECTION LABEL */
        .ds-sec { font-size:9px; font-weight:800; color:#333; text-transform:uppercase; letter-spacing:1px; padding:14px 14px 7px; margin:0; }

        /* ENGAGEMENT CHIPS */
        .ds-chips-grid { display:grid; grid-template-columns:1fr 1fr; gap:8px; padding:0 12px; }
        .ds-chip { background:rgba(255,255,255,0.025); border:1px solid rgba(255,255,255,0.06); border-radius:12px; padding:11px 12px; display:flex; align-items:center; gap:9px; animation:dsFadeUp .3s ease both; cursor:default; transition:all .18s cubic-bezier(.34,1.4,.64,1); }
        .ds-chip:hover { border-color:color-mix(in srgb,var(--c) 24%,transparent); transform:translateY(-1px) scale(1.012); }
        .ds-chip-icon { width:28px; height:28px; border-radius:8px; display:flex; align-items:center; justify-content:center; flex-shrink:0; }
        .ds-chip-body { flex:1; min-width:0; }
        .ds-chip-val  { display:block; font-size:15px; font-weight:900; color:#fff; line-height:1.1; }
        .ds-chip-lbl  { display:block; font-size:9.5px; font-weight:700; color:#484848; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }

        /* SPARKLINE */
        .ds-spark-row  { display:flex; align-items:center; justify-content:space-between; gap:10px; padding:11px 13px; margin:8px 12px 0; background:rgba(255,255,255,0.02); border:1px solid rgba(255,255,255,0.06); border-radius:12px; position:relative; overflow:hidden; }
        .ds-spark-bar  { position:absolute; top:0; left:0; right:0; height:2px; background:linear-gradient(90deg,#84cc16,#60a5fa,#f87171,#84cc16); background-size:200% 100%; animation:dsBar 3s linear infinite; }
        .ds-spark-info h4 { font-size:11px; font-weight:800; color:#aaa; margin:0 0 2px; }
        .ds-spark-info p  { font-size:9.5px; color:#484848; margin:0; }
        .ds-spark-val  { font-size:18px; font-weight:900; color:#84cc16; }

        /* COMMUNITY */
        .ds-comm-chip { margin:8px 12px 0; display:flex; align-items:center; gap:10px; padding:11px 13px; border-radius:12px; background:rgba(52,211,153,0.05); border:1px solid rgba(52,211,153,0.13); cursor:pointer; transition:all .18s; }
        .ds-comm-chip:hover { border-color:rgba(52,211,153,0.3); transform:translateY(-1px); }
        .ds-comm-icon { width:28px; height:28px; border-radius:8px; background:rgba(52,211,153,0.1); border:1px solid rgba(52,211,153,0.2); display:flex; align-items:center; justify-content:center; flex-shrink:0; }
        .ds-comm-val  { font-size:14px; font-weight:900; color:#34d399; }
        .ds-comm-lbl  { font-size:9.5px; color:#484848; font-weight:600; }

        /* QUICK ACTIONS */
        .ds-qa-grid { display:grid; grid-template-columns:1fr 1fr; gap:8px; padding:0 12px; }
        .ds-qa { display:flex; align-items:center; gap:9px; padding:11px 12px; border-radius:12px; background:rgba(255,255,255,0.02); border:1px solid rgba(255,255,255,0.06); cursor:pointer; animation:dsFadeUp .3s ease both; text-align:left; transition:all .18s cubic-bezier(.34,1.4,.64,1); }
        .ds-qa:hover  { background:color-mix(in srgb,var(--c) 5%,transparent); border-color:color-mix(in srgb,var(--c) 26%,transparent); transform:translateY(-2px) scale(1.014); box-shadow:0 6px 18px rgba(0,0,0,.22); }
        .ds-qa:active { transform:scale(.97)!important; }
        .ds-qa-icon  { width:32px; height:32px; border-radius:9px; display:flex; align-items:center; justify-content:center; flex-shrink:0; }
        .ds-qa-text  { flex:1; min-width:0; display:flex; flex-direction:column; gap:1px; overflow:hidden; }
        .ds-qa-label { font-size:12px; font-weight:800; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
        .ds-qa-sub   { font-size:9px; color:#484848; font-weight:500; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }

        /* UPGRADE BANNER */
        .ds-upgrade { margin:10px 12px 0; padding:13px; border-radius:13px; background:linear-gradient(135deg,rgba(251,191,36,0.08),rgba(251,191,36,0.03)); border:1px solid rgba(251,191,36,0.17); display:flex; align-items:center; gap:12px; cursor:pointer; transition:all .18s; }
        .ds-upgrade:hover { transform:translateY(-1px); border-color:rgba(251,191,36,0.34); }
        .ds-upgrade-icon  { width:36px; height:36px; border-radius:10px; background:rgba(251,191,36,0.1); border:1px solid rgba(251,191,36,0.2); display:flex; align-items:center; justify-content:center; flex-shrink:0; font-size:18px; }
        .ds-upgrade-title { font-size:13px; font-weight:900; color:#fbbf24; margin:0 0 1px; }
        .ds-upgrade-sub   { font-size:10px; color:#555; margin:0; }

        /* SPINNER */
        .ds-spinner { width:18px; height:18px; border:2px solid rgba(132,204,22,0.12); border-top-color:#84cc16; border-radius:50%; animation:dsSpin .7s linear infinite; margin:52px auto; }
      `}</style>

      {loading ? (
        <div className="ds-spinner" />
      ) : (
        <>
          {/* ── HERO ─────────────────────────────────────────────────────── */}
          <div className="ds-hero">
            <div className="ds-hero-row">
              <div className="ds-avatar">
                {initial}
                {avatarSrc && imgOk && (
                  <img src={avatarSrc} alt={name} crossOrigin="anonymous"
                    onError={() => setImgOk(false)} />
                )}
              </div>
              <div className="ds-hero-info">
                <p className="ds-greeting">{greeting} 👋</p>
                <div className="ds-name-row">
                  <span className="ds-name">{name}</span>
                  {isVerified && (
                    <div className="ds-vfx-badge">
                      <Sparkles size={7} color="#000" />
                    </div>
                  )}
                  {isPro && (
                    <span className="ds-pro-badge">
                      <Crown size={8} /> PRO
                    </span>
                  )}
                </div>
                <div className="ds-username">@{username}</div>
              </div>
              <div className="ds-live-tag">
                <LiveDot />
                <span style={{ fontSize: 9, color: "#3a3a3a", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px" }}>
                  Live
                </span>
              </div>
            </div>

            {/* Social counts */}
            <div className="ds-social-row">
              <SocialPill label="Followers" raw={data.followers} />
              <SocialPill label="Following"  raw={data.following} />
              <SocialPill label="Posts"      raw={data.posts} />
              <SocialPill label="Reels"      raw={data.reels} />
              <SocialPill label="Stories"    raw={data.stories} />
            </div>

            {/* Wallet row */}
            <div className="ds-meta-row">
              <div className="ds-ep-card">
                <div className="ds-ep-icon"><Zap size={13} color="#84cc16" /></div>
                <div style={{ flex: 1 }}>
                  <div className="ds-ep-val"><AnimVal raw={data.engagementPoints} /></div>
                  <div className="ds-ep-lbl">EP Balance</div>
                </div>
                <LiveDot color="#84cc16" />
              </div>
              <div className="ds-gt-card">
                <span style={{ fontSize: 15 }}>🪙</span>
                <div>
                  <div className="ds-gt-val"><AnimVal raw={data.grovaTokens} /></div>
                  <div className="ds-gt-lbl">GT Balance</div>
                </div>
              </div>
              <div className="ds-str-card">
                <div className="ds-str-icon">🔥</div>
                <div>
                  <div className="ds-str-val">—</div>
                  <div className="ds-str-lbl">Streak</div>
                </div>
              </div>
            </div>
          </div>

          {/* ── ENGAGEMENT ───────────────────────────────────────────────── */}
          <p className="ds-sec">Engagement</p>
          <div className="ds-chips-grid">
            <StatChip icon={Eye}           label="Total Views"   raw={data.totalViews}    color="#a78bfa" idx={0} />
            <StatChip icon={Heart}         label="Total Likes"   raw={data.totalLikes}    color="#f472b6" idx={1} />
            <StatChip icon={MessageSquare} label="Comments"      raw={data.totalComments} color="#60a5fa" idx={2} />
            <StatChip icon={Users}         label="Followers"     raw={data.followers}     color="#84cc16" idx={3} />
          </div>

          {/* Live sparkline */}
          <LiveViewsChart totalViews={data.totalViews} totalLikes={data.totalLikes} />

          {/* Communities */}
          <div className="ds-comm-chip" onClick={() => setActiveTab?.("communities")}>
            <div className="ds-comm-icon"><Hash size={13} color="#34d399" /></div>
            <div style={{ flex: 1 }}>
              <div className="ds-comm-val"><AnimVal raw={data.communities} /></div>
              <div className="ds-comm-lbl">Communities joined</div>
            </div>
            <LiveDot color="#34d399" />
            <ChevronRight size={12} color="#34d399" style={{ opacity: 0.5 }} />
          </div>

          {/* ── QUICK ACTIONS ─────────────────────────────────────────────── */}
          <p className="ds-sec">Quick Actions</p>
          <div className="ds-qa-grid">
            <QuickAction emoji="📊" label="Analytics"  sub="Full stats"        color="#a78bfa" onClick={() => setActiveTab?.("analytics")} idx={0} />
            <QuickAction emoji="🎁" label="Rewards"    sub="Earn EP"           color="#84cc16" onClick={() => setActiveTab?.("rewards")}   idx={1} />
            <QuickAction emoji="💳" label="Gift Cards" sub="Buy & send"        color="#34d399" onClick={() => setActiveTab?.("giftcards")} idx={2} />
            <QuickAction emoji="🔴" label="Go Live"    sub="Start stream"      color="#fb7185" onClick={() => setActiveTab?.("stream")}    idx={3} />
            <QuickAction emoji="⚙️" label="Settings"  sub="Profile & privacy" color="#737373" onClick={() => setActiveTab?.("settings")}  idx={4} />
            <QuickAction emoji="🔖" label="Saved"      sub="Bookmarks"         color="#fbbf24" onClick={() => setActiveTab?.("saved")}     idx={5} />
          </div>

          {!isPro && (
            <div className="ds-upgrade" onClick={() => setActiveTab?.("upgrade")}>
              <div className="ds-upgrade-icon">👑</div>
              <div style={{ flex: 1 }}>
                <p className="ds-upgrade-title">Upgrade your profile</p>
                <p className="ds-upgrade-sub">Unlock Silver, Gold or Diamond boost</p>
              </div>
              <ChevronRight size={13} color="#fbbf24" />
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default DashboardSection;