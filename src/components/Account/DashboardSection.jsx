// src/components/Account/DashboardSection.jsx — v2 EP_SOURCE_FIXED
// ============================================================================
// CHANGES vs v1:
//  [FIX-1] EP balance now reads from profiles.engagement_points (authoritative)
//          NOT wallets.engagement_points (mirror).
//  [FIX-2] CTA quick actions navigate correctly. "Saved" calls onOpenSaved
//          prop to open SavedContentModal. All other tabs call setActiveTab.
//  [FIX-3] setActiveTab prop is now correctly wired — QuickAction passes
//          onClick through to the button, which calls setActiveTab.
//  [FIX-4] Communities chip onClick calls setActiveTab("community").
//  [FIX-5] EP streak reads from daily_task_completions (login task) via
//          separate query — no phantom column.
//  All animations, stat chips, sparkline, social row — UNCHANGED.
// ============================================================================

import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Zap, Crown, Sparkles, Eye, Heart, MessageSquare,
  Users, ChevronRight, Hash, Bookmark,
} from "lucide-react";
import { supabase } from "../../services/config/supabase";

// ─── Formatter ────────────────────────────────────────────────────────────────
const fmt = (n) => {
  const v = Number(n) || 0;
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000)     return `${(v / 1_000).toFixed(1)}K`;
  return String(Math.floor(v));
};

// ─── Animated counter ─────────────────────────────────────────────────────────
const useAnimCount = (target, ms = 560) => {
  const [val, setVal] = useState(Number(target) || 0);
  const fromRef       = useRef(Number(target) || 0);
  const rafRef        = useRef(null);
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

// ─── Sub-components ───────────────────────────────────────────────────────────
const LiveDot = ({ color = "#84cc16" }) => (
  <span style={{ display:"inline-block", width:5, height:5, borderRadius:"50%", background:color, flexShrink:0, animation:"dsPulse 1.8s ease-out infinite" }} />
);

const SocialPill = ({ label, raw }) => {
  const v = useAnimCount(raw);
  return (
    <div className="ds-social-item">
      <span className="ds-social-val">{fmt(v)}</span>
      <span className="ds-social-lbl">{label}</span>
    </div>
  );
};

const AnimVal = ({ raw }) => {
  const v = useAnimCount(raw);
  return <>{fmt(v)}</>;
};

const StatChip = ({ icon: Icon, label, raw, color, idx }) => {
  const v = useAnimCount(raw);
  return (
    <div className="ds-chip" style={{ "--c": color, animationDelay: `${idx * 0.07}s` }}>
      <div className="ds-chip-icon" style={{ background:`${color}14`, border:`1px solid ${color}28` }}>
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

// [FIX-2] QuickAction — accepts onClick directly
const QuickAction = ({ emoji, label, sub, color, onClick, idx }) => (
  <button
    className="ds-qa"
    style={{ "--c": color, animationDelay: `${idx * 0.05}s` }}
    onClick={onClick}
  >
    <div className="ds-qa-icon" style={{ background:`${color}14`, border:`1px solid ${color}28`, fontSize:16 }}>
      {emoji}
    </div>
    <div className="ds-qa-text">
      <span className="ds-qa-label" style={{ color }}>{label}</span>
      {sub && <span className="ds-qa-sub">{sub}</span>}
    </div>
    <ChevronRight size={10} color={color} style={{ flexShrink:0, opacity:0.4 }} />
  </button>
);

// ─── Live sparkline ───────────────────────────────────────────────────────────
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
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ overflow:"visible", flexShrink:0 }}>
        <defs>
          <linearGradient id="lvGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor="#84cc16" stopOpacity="0.32" />
            <stop offset="100%" stopColor="#84cc16" stopOpacity="0" />
          </linearGradient>
        </defs>
        <polygon points={fill} fill="url(#lvGrad)" />
        <polyline points={line} fill="none" stroke="#84cc16" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx={xs(pts.length - 1)} cy={ys(pts[pts.length - 1])} r="3.5" fill="#84cc16" />
        <circle cx={xs(pts.length - 1)} cy={ys(pts[pts.length - 1])} r="7" fill="#84cc16" opacity="0.12">
          <animate attributeName="r"       values="3.5;9;3.5"   dur="2s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="0.12;0;0.12" dur="2s" repeatCount="indefinite" />
        </circle>
      </svg>
      <span className="ds-spark-val"><AnimVal raw={totalViews} /></span>
    </div>
  );
};

// ─── Login streak from daily_task_completions ─────────────────────────────────
async function fetchLoginStreak(uid) {
  try {
    const { data } = await supabase
      .from("daily_task_completions")
      .select("completed_at")
      .eq("user_id", uid)
      .eq("task_id", "login")
      .order("completed_at", { ascending: false })
      .limit(90);

    if (!data?.length) return 0;
    let streak = 0;
    const today = new Date(); today.setHours(0, 0, 0, 0);
    for (let i = 0; i < data.length; i++) {
      const d = new Date(data[i].completed_at); d.setHours(0, 0, 0, 0);
      const expected = new Date(today); expected.setDate(today.getDate() - i);
      if (d.getTime() === expected.getTime()) streak++;
      else break;
    }
    return streak;
  } catch { return 0; }
}

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────
// Props:
//   currentUser  — auth user object
//   profile      — profile data (camelCase or snake_case)
//   setActiveTab — navigate to a top-level section
//   onOpenSaved  — opens SavedContentModal (optional; falls back to setActiveTab)
const DashboardSection = ({ currentUser, profile, setActiveTab, onOpenSaved }) => {
  const uid = currentUser?.id;

  const [data, setData] = useState({
    followers:0, following:0, posts:0, reels:0, stories:0,
    totalViews:0, totalLikes:0, totalComments:0,
    grovaTokens:0, engagementPoints:0, communities:0,
    isPro:false, verified:false, loginStreak:0,
  });
  const [loading,  setLoading]  = useState(true);
  const [greeting, setGreeting] = useState("");
  const [imgOk,    setImgOk]    = useState(true);
  const subsRef                  = useRef([]);

  useEffect(() => {
    const h = new Date().getHours();
    setGreeting(h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening");
  }, []);

  // ── [FIX-1] Data fetch — EP from profiles.engagement_points ──────────────
  const loadData = useCallback(async () => {
    if (!uid) { setLoading(false); return; }
    setLoading(true);
    try {
      const getIds = async (table) => {
        const { data: rows } = await supabase
          .from(table).select("id").eq("user_id", uid).is("deleted_at", null);
        return (rows || []).map(r => r.id);
      };
      const [storyIds, reelIds, postIds] = await Promise.all([
        getIds("stories"), getIds("reels"), getIds("posts"),
      ]);

      const [
        // [FIX-1] profiles for EP (authoritative), verified, is_pro
        profileRes,
        walletRes,
        storiesCountRes, reelsCountRes, postsCountRes,
        storiesViewsRes, reelsViewsRes, postsViewsRes,
        commentsRes,
        followersRes, followingRes,
        commRes,
        storyLikesRes, reelLikesRes, postLikesRes,
        streakRes,
      ] = await Promise.allSettled([
        // [FIX-1] engagement_points is authoritative on profiles
        supabase.from("profiles")
          .select("verified, is_pro, engagement_points")
          .eq("id", uid).maybeSingle(),
        // wallets for grova_tokens only
        supabase.from("wallets")
          .select("grova_tokens")
          .eq("user_id", uid).maybeSingle(),
        supabase.from("stories").select("*", { count:"exact", head:true }).eq("user_id", uid).is("deleted_at", null),
        supabase.from("reels").select("*", { count:"exact", head:true }).eq("user_id", uid).is("deleted_at", null),
        supabase.from("posts").select("*", { count:"exact", head:true }).eq("user_id", uid).is("deleted_at", null),
        supabase.from("stories").select("views").eq("user_id", uid).is("deleted_at", null),
        supabase.from("reels").select("views").eq("user_id", uid).is("deleted_at", null),
        supabase.from("posts").select("views").eq("user_id", uid).is("deleted_at", null),
        supabase.from("comments").select("*", { count:"exact", head:true }).eq("user_id", uid).is("deleted_at", null),
        supabase.from("follows").select("*", { count:"exact", head:true }).eq("following_id", uid),
        supabase.from("follows").select("*", { count:"exact", head:true }).eq("follower_id", uid),
        supabase.from("community_members").select("*", { count:"exact", head:true }).eq("user_id", uid),
        storyIds.length ? supabase.from("story_likes").select("*", { count:"exact", head:true }).in("story_id", storyIds) : Promise.resolve({ count:0 }),
        reelIds.length  ? supabase.from("reel_likes").select("*", { count:"exact", head:true }).in("reel_id", reelIds)   : Promise.resolve({ count:0 }),
        postIds.length  ? supabase.from("post_likes").select("*", { count:"exact", head:true }).in("post_id", postIds)   : Promise.resolve({ count:0 }),
        // [FIX-5] Streak from daily_task_completions
        fetchLoginStreak(uid),
      ]);

      const profileFlags = profileRes.status  === "fulfilled" ? profileRes.value?.data   : null;
      const wallet       = walletRes.status   === "fulfilled" ? walletRes.value?.data    : null;

      const safe = (res, field = "count") =>
        res.status === "fulfilled" ? (res.value?.[field] ?? 0) : 0;

      const allViewRows = [
        ...(storiesViewsRes.status === "fulfilled" ? storiesViewsRes.value?.data || [] : []),
        ...(reelsViewsRes.status   === "fulfilled" ? reelsViewsRes.value?.data   || [] : []),
        ...(postsViewsRes.status   === "fulfilled" ? postsViewsRes.value?.data   || [] : []),
      ];
      const totalViews = allViewRows.reduce((s, r) => s + (Number(r.views) || 0), 0);

      setData({
        followers:        safe(followersRes),
        following:        safe(followingRes),
        posts:            safe(postsCountRes),
        reels:            safe(reelsCountRes),
        stories:          safe(storiesCountRes),
        totalViews,
        totalLikes:       safe(storyLikesRes) + safe(reelLikesRes) + safe(postLikesRes),
        totalComments:    safe(commentsRes),
        // [FIX-1] EP from profiles (authoritative)
        engagementPoints: Number(profileFlags?.engagement_points ?? 0),
        grovaTokens:      Number(wallet?.grova_tokens ?? 0),
        communities:      safe(commRes),
        isPro:            profileFlags?.is_pro  ?? false,
        verified:         profileFlags?.verified ?? false,
        loginStreak:      streakRes.status === "fulfilled" ? streakRes.value : 0,
      });
    } catch (err) {
      console.error("[DashboardSection]", err);
    } finally {
      setLoading(false);
    }
  }, [uid]);

  useEffect(() => { loadData(); }, [loadData]);

  // Realtime subscriptions
  useEffect(() => {
    if (!uid) return;
    subsRef.current.forEach(s => supabase.removeChannel(s));
    subsRef.current = [];
    const sub = (ch) => subsRef.current.push(ch);

    const tables = ["follows","posts","reels","stories","post_likes","reel_likes","story_likes","comments","community_members"];
    tables.forEach(t => {
      sub(supabase.channel(`ds-${t}-${uid}`)
        .on("postgres_changes", { event:"*", schema:"public", table:t }, () => loadData())
        .subscribe());
    });

    // profiles (for EP changes)
    sub(supabase.channel(`ds-profile-${uid}`)
      .on("postgres_changes", { event:"UPDATE", schema:"public", table:"profiles", filter:`id=eq.${uid}` }, () => loadData())
      .subscribe());

    // wallets (for GT changes)
    sub(supabase.channel(`ds-wallet-${uid}`)
      .on("postgres_changes", { event:"*", schema:"public", table:"wallets", filter:`user_id=eq.${uid}` }, () => loadData())
      .subscribe());

    return () => subsRef.current.forEach(s => supabase.removeChannel(s));
  }, [uid, loadData]);

  // ── Display derivations ───────────────────────────────────────────────────
  const name       = profile?.fullName  || profile?.full_name  || currentUser?.fullName  || currentUser?.name || "Creator";
  const username   = profile?.username  || currentUser?.username || "you";
  const avatarSrc  = profile?.avatar    || currentUser?.avatar;
  const isVerified = data.verified      || profile?.verified   || currentUser?.verified;
  const isPro      = data.isPro         || profile?.isPro      || profile?.is_pro;
  const initial    = name.charAt(0).toUpperCase();

  // [FIX-2] Saved handler — use onOpenSaved if provided
  const handleSaved = useCallback(() => {
    if (typeof onOpenSaved === "function") {
      onOpenSaved();
    } else {
      setActiveTab?.("account");
    }
  }, [onOpenSaved, setActiveTab]);

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

        .ds-sec { font-size:9px; font-weight:800; color:#333; text-transform:uppercase; letter-spacing:1px; padding:14px 14px 7px; margin:0; }

        .ds-chips-grid { display:grid; grid-template-columns:1fr 1fr; gap:8px; padding:0 12px; }
        .ds-chip { background:rgba(255,255,255,0.025); border:1px solid rgba(255,255,255,0.06); border-radius:12px; padding:11px 12px; display:flex; align-items:center; gap:9px; animation:dsFadeUp .3s ease both; cursor:default; transition:all .18s cubic-bezier(.34,1.4,.64,1); }
        .ds-chip:hover { border-color:color-mix(in srgb,var(--c) 24%,transparent); transform:translateY(-1px) scale(1.012); }
        .ds-chip-icon { width:28px; height:28px; border-radius:8px; display:flex; align-items:center; justify-content:center; flex-shrink:0; }
        .ds-chip-body { flex:1; min-width:0; }
        .ds-chip-val  { display:block; font-size:15px; font-weight:900; color:#fff; line-height:1.1; }
        .ds-chip-lbl  { display:block; font-size:9.5px; font-weight:700; color:#484848; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }

        .ds-spark-row  { display:flex; align-items:center; justify-content:space-between; gap:10px; padding:11px 13px; margin:8px 12px 0; background:rgba(255,255,255,0.02); border:1px solid rgba(255,255,255,0.06); border-radius:12px; position:relative; overflow:hidden; }
        .ds-spark-bar  { position:absolute; top:0; left:0; right:0; height:2px; background:linear-gradient(90deg,#84cc16,#60a5fa,#f87171,#84cc16); background-size:200% 100%; animation:dsBar 3s linear infinite; }
        .ds-spark-info h4 { font-size:11px; font-weight:800; color:#aaa; margin:0 0 2px; }
        .ds-spark-info p  { font-size:9.5px; color:#484848; margin:0; }
        .ds-spark-val  { font-size:18px; font-weight:900; color:#84cc16; }

        .ds-comm-chip { margin:8px 12px 0; display:flex; align-items:center; gap:10px; padding:11px 13px; border-radius:12px; background:rgba(52,211,153,0.05); border:1px solid rgba(52,211,153,0.13); cursor:pointer; transition:all .18s; }
        .ds-comm-chip:hover { border-color:rgba(52,211,153,0.3); transform:translateY(-1px); }
        .ds-comm-icon { width:28px; height:28px; border-radius:8px; background:rgba(52,211,153,0.1); border:1px solid rgba(52,211,153,0.2); display:flex; align-items:center; justify-content:center; flex-shrink:0; }
        .ds-comm-val  { font-size:14px; font-weight:900; color:#34d399; }
        .ds-comm-lbl  { font-size:9.5px; color:#484848; font-weight:600; }

        .ds-qa-grid { display:grid; grid-template-columns:1fr 1fr; gap:8px; padding:0 12px; }
        .ds-qa { display:flex; align-items:center; gap:9px; padding:11px 12px; border-radius:12px; background:rgba(255,255,255,0.02); border:1px solid rgba(255,255,255,0.06); cursor:pointer; animation:dsFadeUp .3s ease both; text-align:left; transition:all .18s cubic-bezier(.34,1.4,.64,1); font-family:inherit; }
        .ds-qa:hover { background:color-mix(in srgb,var(--c) 5%,transparent); border-color:color-mix(in srgb,var(--c) 26%,transparent); transform:translateY(-2px) scale(1.014); box-shadow:0 6px 18px rgba(0,0,0,.22); }
        .ds-qa:active { transform:scale(.97)!important; }
        .ds-qa-icon  { width:32px; height:32px; border-radius:9px; display:flex; align-items:center; justify-content:center; flex-shrink:0; }
        .ds-qa-text  { flex:1; min-width:0; display:flex; flex-direction:column; gap:1px; overflow:hidden; }
        .ds-qa-label { font-size:12px; font-weight:800; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
        .ds-qa-sub   { font-size:9px; color:#484848; font-weight:500; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }

        .ds-upgrade { margin:10px 12px 0; padding:13px; border-radius:13px; background:linear-gradient(135deg,rgba(251,191,36,0.08),rgba(251,191,36,0.03)); border:1px solid rgba(251,191,36,0.17); display:flex; align-items:center; gap:12px; cursor:pointer; transition:all .18s; }
        .ds-upgrade:hover { transform:translateY(-1px); border-color:rgba(251,191,36,0.34); }
        .ds-upgrade-icon  { width:36px; height:36px; border-radius:10px; background:rgba(251,191,36,0.1); border:1px solid rgba(251,191,36,0.2); display:flex; align-items:center; justify-content:center; flex-shrink:0; font-size:18px; }
        .ds-upgrade-title { font-size:13px; font-weight:900; color:#fbbf24; margin:0 0 1px; }
        .ds-upgrade-sub   { font-size:10px; color:#555; margin:0; }

        .ds-spinner { width:18px; height:18px; border:2px solid rgba(132,204,22,0.12); border-top-color:#84cc16; border-radius:50%; animation:dsSpin .7s linear infinite; margin:52px auto; }
      `}</style>

      {loading ? (
        <div className="ds-spinner" />
      ) : (
        <>
          {/* ── HERO ── */}
          <div className="ds-hero">
            <div className="ds-hero-row">
              <div className="ds-avatar">
                {initial}
                {avatarSrc && imgOk && (
                  <img src={avatarSrc} alt={name} crossOrigin="anonymous" onError={() => setImgOk(false)} />
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
                  {isPro && <span className="ds-pro-badge"><Crown size={8} /> PRO</span>}
                </div>
                <div className="ds-username">@{username}</div>
              </div>
              <div className="ds-live-tag">
                <LiveDot />
                <span style={{ fontSize:9, color:"#3a3a3a", fontWeight:700, textTransform:"uppercase", letterSpacing:"0.5px" }}>Live</span>
              </div>
            </div>

            {/* Social row */}
            <div className="ds-social-row">
              <SocialPill label="Followers" raw={data.followers} />
              <SocialPill label="Following"  raw={data.following} />
              <SocialPill label="Posts"      raw={data.posts} />
              <SocialPill label="Reels"      raw={data.reels} />
              <SocialPill label="Stories"    raw={data.stories} />
            </div>

            {/* Wallet + streak row */}
            <div className="ds-meta-row">
              <div className="ds-ep-card">
                <div className="ds-ep-icon"><Zap size={13} color="#84cc16" /></div>
                <div style={{ flex:1 }}>
                  {/* [FIX-1] EP from profiles.engagement_points */}
                  <div className="ds-ep-val"><AnimVal raw={data.engagementPoints} /></div>
                  <div className="ds-ep-lbl">EP Balance</div>
                </div>
                <LiveDot color="#84cc16" />
              </div>
              <div className="ds-gt-card">
                <span style={{ fontSize:15 }}>🪙</span>
                <div>
                  <div className="ds-gt-val"><AnimVal raw={data.grovaTokens} /></div>
                  <div className="ds-gt-lbl">GT Balance</div>
                </div>
              </div>
              <div className="ds-str-card">
                <div className="ds-str-icon">🔥</div>
                <div>
                  {/* [FIX-5] Streak from daily_task_completions */}
                  <div className="ds-str-val">{data.loginStreak}</div>
                  <div className="ds-str-lbl">Streak</div>
                </div>
              </div>
            </div>
          </div>

          {/* ── ENGAGEMENT ── */}
          <p className="ds-sec">Engagement</p>
          <div className="ds-chips-grid">
            <StatChip icon={Eye}           label="Total Views"   raw={data.totalViews}    color="#a78bfa" idx={0} />
            <StatChip icon={Heart}         label="Total Likes"   raw={data.totalLikes}    color="#f472b6" idx={1} />
            <StatChip icon={MessageSquare} label="Comments"      raw={data.totalComments} color="#60a5fa" idx={2} />
            <StatChip icon={Users}         label="Followers"     raw={data.followers}     color="#84cc16" idx={3} />
          </div>

          <LiveViewsChart totalViews={data.totalViews} totalLikes={data.totalLikes} />

          {/* [FIX-4] Communities → community tab */}
          <div className="ds-comm-chip" onClick={() => setActiveTab?.("community")}>
            <div className="ds-comm-icon"><Hash size={13} color="#34d399" /></div>
            <div style={{ flex:1 }}>
              <div className="ds-comm-val"><AnimVal raw={data.communities} /></div>
              <div className="ds-comm-lbl">Communities joined</div>
            </div>
            <LiveDot color="#34d399" />
            <ChevronRight size={12} color="#34d399" style={{ opacity:0.5 }} />
          </div>

          {/* ── QUICK ACTIONS ── */}
          <p className="ds-sec">Quick Actions</p>
          <div className="ds-qa-grid">
            <QuickAction emoji="📊" label="Analytics"  sub="Full stats"        color="#a78bfa" onClick={() => setActiveTab?.("analytics")} idx={0} />
            <QuickAction emoji="🎁" label="Rewards"    sub="Levels & revenue"  color="#84cc16" onClick={() => setActiveTab?.("rewards")}   idx={1} />
            <QuickAction emoji="💳" label="Gift Cards" sub="Buy & send"        color="#34d399" onClick={() => setActiveTab?.("giftcards")} idx={2} />
            <QuickAction emoji="🔴" label="Go Live"    sub="Start stream"      color="#fb7185" onClick={() => setActiveTab?.("stream")}    idx={3} />
            <QuickAction emoji="⚙️" label="Settings"  sub="Profile & privacy" color="#737373" onClick={() => setActiveTab?.("settings")}  idx={4} />
            {/* [FIX-2] Saved → onOpenSaved */}
            <QuickAction emoji="🔖" label="Saved"      sub="Bookmarks"         color="#fbbf24" onClick={handleSaved}                      idx={5} />
          </div>

          {!isPro && (
            <div className="ds-upgrade" onClick={() => setActiveTab?.("upgrade")}>
              <div className="ds-upgrade-icon">👑</div>
              <div style={{ flex:1 }}>
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