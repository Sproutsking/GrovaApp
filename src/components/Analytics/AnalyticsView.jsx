// src/components/Analytics/AnalyticsView.jsx
// ✅ Fetch mirrors ProfileSection.jsx exactly
// ✅ saved_content — counts times user's content was saved by others (content_id IN allIds)
// ✅ shares — counts times user's content was shared by others (content_id IN allIds)
// ✅ ep_dashboard — used for daily/weekly/monthly EP breakdown in wallet tab
// ✅ Realtime subscriptions with cleanup ref
// ✅ Neural-network + blockchain visual language

import React, { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "../../services/config/supabase";

// ─── helpers ─────────────────────────────────────────────────────────────────
const fmt = (n) => {
  const v = Number(n) || 0;
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000)     return `${(v / 1_000).toFixed(1)}K`;
  return String(v);
};

// ─── animated counter ────────────────────────────────────────────────────────
const useAnimCount = (target, ms = 780) => {
  const [val, setVal] = useState(0);
  const fromRef       = useRef(0);
  const rafRef        = useRef(null);
  useEffect(() => {
    const to = Number(target) || 0;
    cancelAnimationFrame(rafRef.current);
    const start = fromRef.current;
    const t0    = performance.now();
    const tick  = (now) => {
      const p = Math.min((now - t0) / ms, 1);
      const e = 1 - Math.pow(1 - p, 4);
      setVal(Math.round(start + (to - start) * e));
      if (p < 1) rafRef.current = requestAnimationFrame(tick);
      else fromRef.current = to;
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [target, ms]);
  return val;
};

// ─── Neural node SVG background ──────────────────────────────────────────────
const NeuralBg = () => {
  const pts = [[38,38],[118,76],[198,28],[276,88],[356,48],[78,148],[198,138],[318,158]];
  return (
    <svg style={{ position:"absolute",inset:0,width:"100%",height:"100%",opacity:0.05,pointerEvents:"none" }}
      viewBox="0 0 400 200" preserveAspectRatio="xMidYMid slice">
      {pts.map(([x,y],i) => (
        <g key={i}>
          <circle cx={x} cy={y} r="3" fill="#84cc16"/>
          {i < pts.length-1 && (
            <line x1={x} y1={y} x2={pts[i+1][0]} y2={pts[i+1][1]}
              stroke="#84cc16" strokeWidth="0.5"/>
          )}
        </g>
      ))}
    </svg>
  );
};

// ─── Hex hash label ───────────────────────────────────────────────────────────
const BlockHash = ({ value }) => {
  const h = `0x${((Number(value)||0) * 7919 + 13).toString(16).padStart(8,"0").slice(0,8)}`;
  return <span style={{ fontFamily:"monospace", fontSize:9, color:"#1a3a08", letterSpacing:"0.4px" }}>{h}</span>;
};

// ─── Metric node ─────────────────────────────────────────────────────────────
const MetricNode = ({ label, raw, color, icon, size="md", delay=0 }) => {
  const v  = useAnimCount(raw);
  const fs = { sm:14, md:22, lg:30 }[size] ?? 22;
  const pd = { sm:"9px 11px", md:"13px 15px", lg:"17px 19px" }[size] ?? "13px 15px";
  return (
    <div className="av-node" style={{ "--c":color, animationDelay:`${delay}s`, padding:pd }}>
      <div className="av-node-glow" style={{ background:`radial-gradient(circle at 50% 0%,${color}18 0%,transparent 70%)` }}/>
      <div className="av-node-top">
        <span className="av-node-icon">{icon}</span>
        <span className="av-node-dot" style={{ background:color }}/>
      </div>
      <div className="av-node-val" style={{ fontSize:fs, color }}>{fmt(v)}</div>
      <div className="av-node-lbl">{label}</div>
      <BlockHash value={v}/>
    </div>
  );
};

// ─── SVG area chart — animates from 0 ────────────────────────────────────────
const AreaChart = ({ points, color, height=72 }) => {
  const [drawn, setDrawn] = useState([]);
  const rafRef = useRef(null);

  useEffect(() => {
    if (!points?.length) return;
    let frame = 0;
    const FRAMES = 54;
    const tick = () => {
      frame++;
      const p = Math.min(frame / FRAMES, 1);
      const e = 1 - Math.pow(1 - p, 3);
      setDrawn(points.map(v => v * e));
      if (p < 1) rafRef.current = requestAnimationFrame(tick);
    };
    cancelAnimationFrame(rafRef.current);
    setDrawn(points.map(() => 0));
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [points]);

  if (!drawn.length) return null;
  const W = 300, H = height;
  const max = Math.max(...drawn, 1);
  const xs  = (i) => ((i / (drawn.length - 1)) * W).toFixed(1);
  const ys  = (v) => (H - 4 - ((v / max) * (H - 10))).toFixed(1);
  const line = drawn.map((v, i) => `${xs(i)},${ys(v)}`).join(" ");
  const fill = [`0,${H}`, ...drawn.map((v, i) => `${xs(i)},${ys(v)}`), `${W},${H}`].join(" ");
  const lx   = xs(drawn.length - 1), ly = ys(drawn[drawn.length - 1]);
  const gid  = `ag${color.replace(/[^a-z0-9]/gi, "")}`;

  return (
    <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none" style={{ overflow:"visible" }}>
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor={color} stopOpacity="0.3"/>
          <stop offset="100%" stopColor={color} stopOpacity="0.02"/>
        </linearGradient>
      </defs>
      <polygon points={fill} fill={`url(#${gid})`}/>
      <polyline points={line} fill="none" stroke={color} strokeWidth="1.8"
        strokeLinecap="round" strokeLinejoin="round"/>
      <circle cx={lx} cy={ly} r="3.5" fill={color}/>
      <circle cx={lx} cy={ly} r="7" fill={color} opacity="0.14">
        <animate attributeName="r"       values="3.5;9;3.5" dur="2s" repeatCount="indefinite"/>
        <animate attributeName="opacity" values="0.14;0;0.14" dur="2s" repeatCount="indefinite"/>
      </circle>
    </svg>
  );
};

// ─── Engagement ring ──────────────────────────────────────────────────────────
const EngagementRing = ({ rate }) => {
  const v       = useAnimCount(parseFloat(rate) * 10, 1100);
  const display = (v / 10).toFixed(1);
  const r = 38, circ = 2 * Math.PI * r;
  const dash = (Math.min(parseFloat(rate), 25) / 25) * circ;
  return (
    <div style={{ position:"relative", width:100, height:100, flexShrink:0 }}>
      <svg width="100" height="100" viewBox="0 0 100 100" style={{ transform:"rotate(-90deg)" }}>
        <circle cx="50" cy="50" r={r} fill="none" stroke="rgba(132,204,22,0.08)" strokeWidth="8"/>
        <circle cx="50" cy="50" r={r} fill="none" stroke="url(#rg)" strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circ}`}
          style={{ transition:"stroke-dasharray 1.1s cubic-bezier(0.34,1.56,0.64,1)" }}/>
        <defs>
          <linearGradient id="rg" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%"   stopColor="#84cc16"/>
            <stop offset="100%" stopColor="#22d3ee"/>
          </linearGradient>
        </defs>
      </svg>
      <div style={{ position:"absolute",inset:0,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center" }}>
        <span style={{ fontSize:18,fontWeight:900,color:"#84cc16",lineHeight:1 }}>{display}%</span>
        <span style={{ fontSize:8,color:"#333",fontWeight:700,textTransform:"uppercase",letterSpacing:"0.5px",marginTop:2 }}>Eng Rate</span>
      </div>
    </div>
  );
};

// ─── Blockchain ledger row ────────────────────────────────────────────────────
const ChainRow = ({ label, value, color, maxVal, idx }) => {
  const v  = useAnimCount(value);
  const pct = maxVal > 0 ? Math.min((value / maxVal) * 100, 100) : 0;
  return (
    <div className="av-chain-row" style={{ animationDelay:`${idx * 0.045}s` }}>
      <span className="av-chain-idx">#{String(idx + 1).padStart(2, "0")}</span>
      <span className="av-chain-lbl">{label}</span>
      <div className="av-chain-track">
        <div className="av-chain-fill"
          style={{ width:`${pct}%`, background:`linear-gradient(90deg,${color},${color}55)` }}/>
      </div>
      <span className="av-chain-val" style={{ color }}>{fmt(v)}</span>
    </div>
  );
};

// ─── EP period chip ───────────────────────────────────────────────────────────
const EPChip = ({ label, raw, color }) => {
  const v = useAnimCount(raw);
  return (
    <div className="av-ep-chip" style={{ "--c":color }}>
      <span className="av-ep-chip-val" style={{ color }}>{fmt(v)}</span>
      <span className="av-ep-chip-lbl">{label}</span>
    </div>
  );
};

// ─── MAIN ────────────────────────────────────────────────────────────────────
const AnalyticsView = ({ currentUser, userId, onClose }) => {
  const uid = userId || currentUser?.id;

  const [range,   setRange]   = useState("7d");
  const [tab,     setTab]     = useState("overview");
  const [loading, setLoading] = useState(true);
  const [d,       setD]       = useState(null);
  const subsRef               = useRef([]);

  // ── fetch — mirrors ProfileSection.loadProfileData ────────────────────────
  const loadData = useCallback(async () => {
    if (!uid) return;
    setLoading(true);
    try {
      // Step 1 — content IDs
      const getIds = async (table) => {
        const { data: rows } = await supabase
          .from(table).select("id").eq("user_id", uid).is("deleted_at", null);
        return (rows || []).map(r => r.id);
      };
      const [storyIds, reelIds, postIds] = await Promise.all([
        getIds("stories"), getIds("reels"), getIds("posts"),
      ]);
      const allIds = [...storyIds, ...reelIds, ...postIds];

      // Step 2 — all parallel queries
      const [
        walletRes,
        epDashRes,
        storiesCountRes, reelsCountRes, postsCountRes,
        storiesViewsRes, reelsViewsRes,  postsViewsRes,
        commentsRes,
        followersRes,    followingRes,
        commRes,
        storyLikesRes,   reelLikesRes,   postLikesRes,
        profileViewsRes,
        sharesRes,
        savedRes,
      ] = await Promise.allSettled([
        // wallets: grova_tokens | engagement_points
        supabase.from("wallets")
          .select("grova_tokens, engagement_points")
          .eq("user_id", uid).maybeSingle(),

        // ep_dashboard: daily_ep | weekly_ep | monthly_ep | total_ep_earned
        supabase.from("ep_dashboard")
          .select("total_ep_earned, daily_ep, weekly_ep, monthly_ep, annual_ep")
          .eq("user_id", uid).maybeSingle(),

        // content counts
        supabase.from("stories").select("*", { count:"exact", head:true }).eq("user_id",uid).is("deleted_at",null),
        supabase.from("reels")  .select("*", { count:"exact", head:true }).eq("user_id",uid).is("deleted_at",null),
        supabase.from("posts")  .select("*", { count:"exact", head:true }).eq("user_id",uid).is("deleted_at",null),

        // views rows — reduce-sum (same as ProfileSection)
        supabase.from("stories").select("views, created_at").eq("user_id",uid).is("deleted_at",null),
        supabase.from("reels")  .select("views, created_at").eq("user_id",uid).is("deleted_at",null),
        supabase.from("posts")  .select("views, created_at").eq("user_id",uid).is("deleted_at",null),

        // comments WRITTEN BY this user (user_id = uid) — mirrors ProfileSection
        supabase.from("comments").select("*", { count:"exact", head:true })
          .eq("user_id", uid).is("deleted_at", null),

        // follows.following_id = uid → followers
        supabase.from("follows").select("*", { count:"exact", head:true }).eq("following_id", uid),
        // follows.follower_id  = uid → following
        supabase.from("follows").select("*", { count:"exact", head:true }).eq("follower_id",  uid),

        // community_members
        supabase.from("community_members").select("*", { count:"exact", head:true }).eq("user_id", uid),

        // likes on user's content via junction tables
        storyIds.length
          ? supabase.from("story_likes").select("*", { count:"exact", head:true }).in("story_id", storyIds)
          : Promise.resolve({ count: 0 }),
        reelIds.length
          ? supabase.from("reel_likes") .select("*", { count:"exact", head:true }).in("reel_id",  reelIds)
          : Promise.resolve({ count: 0 }),
        postIds.length
          ? supabase.from("post_likes") .select("*", { count:"exact", head:true }).in("post_id",  postIds)
          : Promise.resolve({ count: 0 }),

        // profile_views received
        supabase.from("profile_views").select("*", { count:"exact", head:true }).eq("profile_id", uid),

        // shares OF user's content by others (content_id IN allIds)
        allIds.length
          ? supabase.from("shares").select("*", { count:"exact", head:true }).in("content_id", allIds)
          : Promise.resolve({ count: 0 }),

        // times user's content was saved by others (content_id IN allIds)
        allIds.length
          ? supabase.from("saved_content").select("*", { count:"exact", head:true }).in("content_id", allIds)
          : Promise.resolve({ count: 0 }),
      ]);

      // Step 3 — safe extraction
      const wallet        = walletRes.status==="fulfilled"        ? walletRes.value?.data              : null;
      const epDash        = epDashRes.status==="fulfilled"        ? epDashRes.value?.data              : null;
      const storiesCount  = storiesCountRes.status==="fulfilled"  ? (storiesCountRes.value?.count ?? 0) : 0;
      const reelsCount    = reelsCountRes.status==="fulfilled"    ? (reelsCountRes.value?.count   ?? 0) : 0;
      const postsCount    = postsCountRes.status==="fulfilled"    ? (postsCountRes.value?.count   ?? 0) : 0;
      const commentsCount = commentsRes.status==="fulfilled"      ? (commentsRes.value?.count     ?? 0) : 0;
      const followersCount= followersRes.status==="fulfilled"     ? (followersRes.value?.count    ?? 0) : 0;
      const followingCount= followingRes.status==="fulfilled"     ? (followingRes.value?.count    ?? 0) : 0;
      const commCount     = commRes.status==="fulfilled"          ? (commRes.value?.count         ?? 0) : 0;
      const storyLikes    = storyLikesRes.status==="fulfilled"    ? (storyLikesRes.value?.count   ?? 0) : 0;
      const reelLikes     = reelLikesRes.status==="fulfilled"     ? (reelLikesRes.value?.count    ?? 0) : 0;
      const postLikes     = postLikesRes.status==="fulfilled"     ? (postLikesRes.value?.count    ?? 0) : 0;
      const profileViews  = profileViewsRes.status==="fulfilled"  ? (profileViewsRes.value?.count ?? 0) : 0;
      const sharesCount   = sharesRes.status==="fulfilled"        ? (sharesRes.value?.count       ?? 0) : 0;
      const savedCount    = savedRes.status==="fulfilled"         ? (savedRes.value?.count        ?? 0) : 0;

      // Step 4 — sum views from row data (same as ProfileSection)
      const storyViewRows = storiesViewsRes.status==="fulfilled" ? storiesViewsRes.value?.data || [] : [];
      const reelViewRows  = reelsViewsRes.status==="fulfilled"   ? reelsViewsRes.value?.data   || [] : [];
      const postViewRows  = postsViewsRes.status==="fulfilled"   ? postsViewsRes.value?.data   || [] : [];
      const allViewRows   = [...storyViewRows, ...reelViewRows, ...postViewRows];

      const storyViews   = storyViewRows.reduce((s, r) => s + (Number(r.views) || 0), 0);
      const reelViews    = reelViewRows.reduce((s, r)  => s + (Number(r.views) || 0), 0);
      const postViews    = postViewRows.reduce((s, r)  => s + (Number(r.views) || 0), 0);
      const totalViews   = storyViews + reelViews + postViews;
      const totalLikes   = storyLikes + reelLikes + postLikes;
      const totalContent = storiesCount + reelsCount + postsCount;

      // Engagement rate
      const engRate = followersCount > 0 && totalContent > 0
        ? (((totalLikes + commentsCount) / (followersCount * totalContent)) * 100)
        : 0;

      // Build 7-point chart from created_at dates
      const chartPoints = Array.from({ length: 7 }, (_, i) => {
        const dayStart = new Date(Date.now() - (6 - i) * 86400000);
        dayStart.setHours(0, 0, 0, 0);
        const dayEnd = new Date(dayStart); dayEnd.setHours(23, 59, 59, 999);
        return allViewRows
          .filter(r => { const d = new Date(r.created_at); return d >= dayStart && d <= dayEnd; })
          .reduce((s, r) => s + (Number(r.views) || 0), 0);
      });
      const hasRealPoints = chartPoints.some(v => v > 0);
      const finalChart    = hasRealPoints
        ? chartPoints
        : [0, 0.07, 0.2, 0.4, 0.6, 0.82, 1.0].map(r => Math.round(r * totalViews));

      setD({
        followers: followersCount, following: followingCount,
        engRate: engRate.toFixed(2),
        totalViews, storyViews, reelViews, postViews,
        totalLikes, storyLikes, reelLikes, postLikes,
        totalComments: commentsCount,
        sharesCount, savedCount, profileViews,
        storiesCount, reelsCount, postsCount, totalContent,
        communities: commCount,
        grovaTokens:      wallet?.grova_tokens      ?? 0,
        engagementPoints: wallet?.engagement_points ?? 0,
        // ep_dashboard breakdown
        totalEpEarned: epDash?.total_ep_earned ?? 0,
        dailyEp:       epDash?.daily_ep        ?? 0,
        weeklyEp:      epDash?.weekly_ep       ?? 0,
        monthlyEp:     epDash?.monthly_ep      ?? 0,
        annualEp:      epDash?.annual_ep       ?? 0,
        chartPoints: finalChart,
      });
    } catch (err) {
      console.error("AnalyticsView.loadData:", err);
    } finally {
      setLoading(false);
    }
  }, [uid, range]);

  // boot load
  useEffect(() => { loadData(); }, [loadData]);

  // realtime subscriptions
  useEffect(() => {
    if (!uid) return;
    subsRef.current.forEach(s => supabase.removeChannel(s));
    subsRef.current = [];
    const sub = (ch) => subsRef.current.push(ch);

    sub(supabase.channel(`av-follows-${uid}`)
      .on("postgres_changes",{event:"*",schema:"public",table:"follows"},() => loadData()).subscribe());
    sub(supabase.channel(`av-posts-${uid}`)
      .on("postgres_changes",{event:"*",schema:"public",table:"posts",filter:`user_id=eq.${uid}`},() => loadData()).subscribe());
    sub(supabase.channel(`av-reels-${uid}`)
      .on("postgres_changes",{event:"*",schema:"public",table:"reels",filter:`user_id=eq.${uid}`},() => loadData()).subscribe());
    sub(supabase.channel(`av-stories-${uid}`)
      .on("postgres_changes",{event:"*",schema:"public",table:"stories",filter:`user_id=eq.${uid}`},() => loadData()).subscribe());
    sub(supabase.channel(`av-pl-${uid}`)
      .on("postgres_changes",{event:"*",schema:"public",table:"post_likes"}, () => loadData()).subscribe());
    sub(supabase.channel(`av-rl-${uid}`)
      .on("postgres_changes",{event:"*",schema:"public",table:"reel_likes"}, () => loadData()).subscribe());
    sub(supabase.channel(`av-sl-${uid}`)
      .on("postgres_changes",{event:"*",schema:"public",table:"story_likes"},() => loadData()).subscribe());
    sub(supabase.channel(`av-comments-${uid}`)
      .on("postgres_changes",{event:"*",schema:"public",table:"comments",filter:`user_id=eq.${uid}`},() => loadData()).subscribe());
    sub(supabase.channel(`av-wallet-${uid}`)
      .on("postgres_changes",{event:"*",schema:"public",table:"wallets",filter:`user_id=eq.${uid}`},() => loadData()).subscribe());
    sub(supabase.channel(`av-ep-${uid}`)
      .on("postgres_changes",{event:"*",schema:"public",table:"ep_dashboard",filter:`user_id=eq.${uid}`},() => loadData()).subscribe());
    sub(supabase.channel(`av-shares-${uid}`)
      .on("postgres_changes",{event:"*",schema:"public",table:"shares"},() => loadData()).subscribe());
    sub(supabase.channel(`av-saved-${uid}`)
      .on("postgres_changes",{event:"*",schema:"public",table:"saved_content"},() => loadData()).subscribe());
    sub(supabase.channel(`av-pv-${uid}`)
      .on("postgres_changes",{event:"*",schema:"public",table:"profile_views",filter:`profile_id=eq.${uid}`},() => loadData()).subscribe());

    return () => subsRef.current.forEach(s => supabase.removeChannel(s));
  }, [uid, loadData]);

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="av-root">
      <style>{`
        @keyframes avFadeUp  { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
        @keyframes avScan    { from{top:-2px} to{top:100vh} }
        @keyframes avSpin    { to{transform:rotate(360deg)} }
        @keyframes avPulse   { 0%,100%{transform:scale(1);opacity:1} 50%{transform:scale(1.5);opacity:0.4} }
        @keyframes avBar     { from{background-position:200% 0} to{background-position:0 0} }
        @keyframes avNodeIn  { from{opacity:0;transform:scale(0.88) translateY(8px)} to{opacity:1;transform:scale(1) translateY(0)} }
        @keyframes avChain   { from{opacity:0;transform:translateX(-10px)} to{opacity:1;transform:translateX(0)} }
        * { box-sizing:border-box; }

        .av-root {
          position:fixed; inset:0; z-index:9500;
          background:#030303; overflow-y:auto; overflow-x:hidden;
          font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
        }
        /* scan line */
        .av-scan {
          position:fixed; left:0; right:0; height:1px;
          background:linear-gradient(90deg,transparent,rgba(132,204,22,0.55),transparent);
          animation:avScan 7s linear infinite; pointer-events:none; z-index:9999;
        }
        /* grid */
        .av-grid {
          position:fixed; inset:0; pointer-events:none; z-index:0;
          background-image:linear-gradient(rgba(132,204,22,0.025) 1px,transparent 1px),
            linear-gradient(90deg,rgba(132,204,22,0.025) 1px,transparent 1px);
          background-size:44px 44px;
        }

        /* TOP BAR */
        .av-topbar { position:sticky; top:0; z-index:100; display:flex; align-items:center; gap:12px; padding:12px 16px 10px; background:rgba(3,3,3,0.97); backdrop-filter:blur(24px); border-bottom:1px solid rgba(132,204,22,0.1); }
        .av-back   { width:32px; height:32px; border-radius:9px; flex-shrink:0; background:rgba(132,204,22,0.06); border:1px solid rgba(132,204,22,0.16); display:flex; align-items:center; justify-content:center; cursor:pointer; color:#84cc16; font-size:17px; font-weight:700; transition:all .15s; }
        .av-back:hover { background:rgba(132,204,22,0.14); }
        .av-title  { font-size:16px; font-weight:900; color:#fff; }
        .av-sub    { font-size:10px; color:#252525; font-weight:600; font-family:monospace; margin-top:1px; }
        .av-live   { display:flex; align-items:center; gap:5px; padding:4px 9px; border-radius:7px; background:rgba(132,204,22,0.07); border:1px solid rgba(132,204,22,0.18); }
        .av-live-d { width:5px; height:5px; border-radius:50%; background:#84cc16; animation:avPulse 1.6s ease-in-out infinite; }
        .av-live-t { font-size:9px; color:#84cc16; font-weight:800; text-transform:uppercase; letter-spacing:0.5px; }

        /* RANGE */
        .av-range { display:flex; gap:5px; padding:0 16px 10px; }
        .av-rng   { flex:1; padding:7px 0; border-radius:8px; border:1px solid rgba(255,255,255,0.06); background:rgba(255,255,255,0.025); color:#2a2a2a; font-size:11px; font-weight:800; cursor:pointer; transition:all .15s; }
        .av-rng.active { background:rgba(132,204,22,0.1); border-color:rgba(132,204,22,0.28); color:#84cc16; }

        /* TABS */
        .av-tabs { display:flex; gap:4px; padding:0 16px 12px; overflow-x:auto; scrollbar-width:none; }
        .av-tabs::-webkit-scrollbar { display:none; }
        .av-tab   { flex:1; padding:7px 8px; border-radius:8px; border:1px solid transparent; background:transparent; color:#252525; font-size:10px; font-weight:800; cursor:pointer; transition:all .15s; white-space:nowrap; text-transform:uppercase; letter-spacing:0.5px; }
        .av-tab.active { background:rgba(132,204,22,0.1); border-color:rgba(132,204,22,0.2); color:#84cc16; }

        /* BODY */
        .av-body { padding:0 14px 120px; position:relative; z-index:1; }

        /* SECTION */
        .av-sec { font-size:9px; font-weight:800; color:#1e1e1e; text-transform:uppercase; letter-spacing:1.2px; margin:20px 0 10px; display:flex; align-items:center; gap:8px; }
        .av-sec::after { content:''; flex:1; height:1px; background:linear-gradient(90deg,rgba(132,204,22,0.22),transparent); }

        /* METRIC NODES */
        .av-grid-2 { display:grid; grid-template-columns:1fr 1fr; gap:8px; }
        .av-grid-3 { display:grid; grid-template-columns:1fr 1fr 1fr; gap:7px; }
        .av-node   { position:relative; overflow:hidden; background:rgba(255,255,255,0.02); border:1px solid rgba(255,255,255,0.065); border-radius:14px; animation:avNodeIn 0.35s cubic-bezier(0.34,1.56,0.64,1) both; transition:border-color .2s,transform .2s; cursor:default; }
        .av-node:hover { border-color:color-mix(in srgb,var(--c) 30%,transparent); transform:translateY(-2px); }
        .av-node-glow  { position:absolute; inset:0; pointer-events:none; }
        .av-node-top   { display:flex; align-items:center; justify-content:space-between; margin-bottom:7px; }
        .av-node-icon  { font-size:14px; }
        .av-node-dot   { width:5px; height:5px; border-radius:50%; animation:avPulse 2s ease-in-out infinite; }
        .av-node-val   { font-weight:900; line-height:1; margin-bottom:3px; }
        .av-node-lbl   { font-size:9px; color:#383838; font-weight:700; text-transform:uppercase; letter-spacing:0.5px; margin-bottom:5px; }

        /* ENGAGEMENT PANEL */
        .av-eng { background:rgba(132,204,22,0.04); border:1px solid rgba(132,204,22,0.14); border-radius:16px; padding:16px; display:flex; align-items:center; gap:16px; position:relative; overflow:hidden; }
        .av-eng-info h3 { font-size:14px; font-weight:900; color:#fff; margin:0 0 5px; }
        .av-eng-info p  { font-size:11px; color:#424242; margin:0; line-height:1.6; }
        .av-eng-info strong { color:#84cc16; }

        /* CHART PANEL */
        .av-chart { background:rgba(255,255,255,0.02); border:1px solid rgba(255,255,255,0.065); border-radius:16px; padding:14px; position:relative; overflow:hidden; }
        .av-chart-bar   { position:absolute; top:0; left:0; right:0; height:2px; background:linear-gradient(90deg,#84cc16,#22d3ee,#f472b6,#84cc16); background-size:200% 100%; animation:avBar 4s linear infinite; }
        .av-chart-head  { display:flex; align-items:center; justify-content:space-between; margin-bottom:12px; }
        .av-chart-title { font-size:12px; font-weight:800; color:#888; }
        .av-chart-lbls  { display:flex; justify-content:space-between; margin-top:5px; }
        .av-chart-lbl   { font-size:8px; color:#252525; font-weight:600; }

        /* TYPE BARS */
        .av-type-rows { display:flex; flex-direction:column; gap:8px; }
        .av-type-row  { display:flex; align-items:center; gap:10px; }
        .av-type-lbl  { font-size:10px; font-weight:700; color:#4a4a4a; width:48px; text-align:right; flex-shrink:0; }
        .av-type-track { flex:1; height:6px; background:rgba(255,255,255,0.05); border-radius:3px; overflow:hidden; }
        .av-type-fill  { height:100%; border-radius:3px; transition:width 1.2s cubic-bezier(0.34,1,0.64,1); }
        .av-type-count { font-size:10px; font-weight:800; color:#555; width:34px; flex-shrink:0; }

        /* CHAIN LEDGER */
        .av-chain-panel { background:rgba(255,255,255,0.02); border:1px solid rgba(255,255,255,0.065); border-radius:16px; padding:14px; display:flex; flex-direction:column; gap:6px; }
        .av-chain-head  { font-size:9px; color:#1a3a08; font-weight:800; text-transform:uppercase; letter-spacing:0.8px; margin-bottom:4px; font-family:monospace; }
        .av-chain-row   { display:flex; align-items:center; gap:8px; padding:7px 10px; border-radius:8px; background:rgba(255,255,255,0.015); border:1px solid rgba(255,255,255,0.045); animation:avChain .3s ease both; transition:background .15s; }
        .av-chain-row:hover { background:rgba(255,255,255,0.03); }
        .av-chain-idx  { font-family:monospace; font-size:9px; color:#252525; width:24px; flex-shrink:0; }
        .av-chain-lbl  { font-size:11px; font-weight:700; color:#545454; flex:1; }
        .av-chain-track { width:60px; height:4px; background:rgba(255,255,255,0.06); border-radius:2px; overflow:hidden; flex-shrink:0; }
        .av-chain-fill  { height:100%; border-radius:2px; transition:width 1s cubic-bezier(0.34,1,0.64,1); }
        .av-chain-val  { font-size:12px; font-weight:900; color:#fff; width:42px; text-align:right; flex-shrink:0; }

        /* SUMMARY ROW */
        .av-sum-row  { display:flex; gap:8px; }
        .av-sum-chip { flex:1; padding:11px 8px; border-radius:12px; background:rgba(255,255,255,0.02); border:1px solid rgba(255,255,255,0.065); text-align:center; }
        .av-sum-val  { font-size:18px; font-weight:900; color:#fff; display:block; }
        .av-sum-lbl  { font-size:9px; color:#353535; font-weight:700; text-transform:uppercase; letter-spacing:0.4px; display:block; margin-top:2px; }

        /* EP PERIOD CHIPS */
        .av-ep-periods { display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-top:10px; }
        .av-ep-chip    { padding:11px 13px; border-radius:12px; background:color-mix(in srgb,var(--c) 6%,transparent); border:1px solid color-mix(in srgb,var(--c) 18%,transparent); }
        .av-ep-chip-val { display:block; font-size:20px; font-weight:900; line-height:1; }
        .av-ep-chip-lbl { display:block; font-size:9px; font-weight:700; text-transform:uppercase; letter-spacing:0.5px; color:#444; margin-top:3px; }

        /* WALLET PANELS */
        .av-w-gt { background:linear-gradient(135deg,rgba(251,191,36,0.06),rgba(251,191,36,0.02)); border:1px solid rgba(251,191,36,0.15); border-radius:16px; padding:16px; }
        .av-w-ep { background:linear-gradient(135deg,rgba(132,204,22,0.06),rgba(132,204,22,0.02)); border:1px solid rgba(132,204,22,0.15); border-radius:16px; padding:16px; margin-top:10px; }
        .av-w-lbl { font-size:10px; font-weight:800; text-transform:uppercase; letter-spacing:0.8px; margin-bottom:10px; display:flex; align-items:center; gap:6px; }

        /* SPINNER */
        .av-spinner { width:20px; height:20px; border:2px solid rgba(132,204,22,0.14); border-top-color:#84cc16; border-radius:50%; animation:avSpin .7s linear infinite; margin:64px auto; }
      `}</style>

      <div className="av-scan"/>
      <div className="av-grid"/>

      {/* TOP BAR */}
      <div className="av-topbar">
        <button className="av-back" onClick={onClose}>‹</button>
        <div style={{ flex:1 }}>
          <div className="av-title">Analytics</div>
          <div className="av-sub">UID:{uid?.slice(0,12)}…</div>
        </div>
        <div className="av-live">
          <div className="av-live-d"/>
          <span className="av-live-t">Live</span>
        </div>
      </div>

      {/* Range */}
      <div className="av-range">
        {["7d","30d","90d"].map(r => (
          <button key={r} className={`av-rng${range===r?" active":""}`} onClick={() => setRange(r)}>{r}</button>
        ))}
      </div>

      {/* Tabs */}
      <div className="av-tabs">
        {["overview","content","audience","wallet"].map(t => (
          <button key={t} className={`av-tab${tab===t?" active":""}`} onClick={() => setTab(t)}>{t}</button>
        ))}
      </div>

      <div className="av-body">
        {loading ? <div className="av-spinner"/> : d && (
          <>
            {/* ══ OVERVIEW ══════════════════════════════════════════════════ */}
            {tab==="overview" && (
              <>
                <p className="av-sec">Signal Overview</p>

                <div className="av-eng" style={{ marginBottom:10 }}>
                  <NeuralBg/>
                  <EngagementRing rate={d.engRate}/>
                  <div className="av-eng-info">
                    <h3>Creator Score</h3>
                    <p><strong>{fmt(d.followers)}</strong> followers · <strong>{fmt(d.totalLikes)}</strong> likes · <strong>{fmt(d.totalComments)}</strong> comments</p>
                    <p style={{ marginTop:4, fontSize:10 }}>(Likes+Comments) ÷ (Followers×Content)</p>
                  </div>
                </div>

                <div className="av-grid-2">
                  <MetricNode label="Total Views"   raw={d.totalViews}    color="#a78bfa" icon="👁"  delay={0.05}/>
                  <MetricNode label="Total Likes"   raw={d.totalLikes}    color="#f472b6" icon="❤️" delay={0.10}/>
                  <MetricNode label="Comments"      raw={d.totalComments} color="#60a5fa" icon="💬" delay={0.15}/>
                  <MetricNode label="Profile Views" raw={d.profileViews}  color="#34d399" icon="🔍" delay={0.20}/>
                </div>

                <div className="av-chart" style={{ marginTop:10 }}>
                  <div className="av-chart-bar"/>
                  <div className="av-chart-head">
                    <span className="av-chart-title">Views · {range}</span>
                    <span style={{ fontSize:18, fontWeight:900, color:"#84cc16" }}>{fmt(d.totalViews)}</span>
                  </div>
                  <AreaChart points={d.chartPoints} color="#84cc16" height={68}/>
                  <div className="av-chart-lbls">
                    {["7d","6d","5d","4d","3d","2d","Today"].map(l => (
                      <span key={l} className="av-chart-lbl">{l}</span>
                    ))}
                  </div>
                </div>

                <div className="av-grid-3" style={{ marginTop:10 }}>
                  <MetricNode label="Shares"  raw={d.sharesCount}  color="#fbbf24" icon="↗️" size="sm" delay={0.25}/>
                  <MetricNode label="Saves"   raw={d.savedCount}   color="#818cf8" icon="🔖" size="sm" delay={0.30}/>
                  <MetricNode label="Content" raw={d.totalContent} color="#84cc16" icon="📦" size="sm" delay={0.35}/>
                </div>
              </>
            )}

            {/* ══ CONTENT ═══════════════════════════════════════════════════ */}
            {tab==="content" && (
              <>
                <p className="av-sec">Content Nodes</p>
                <div className="av-grid-2">
                  <MetricNode label="Posts"   raw={d.postsCount}   color="#84cc16" icon="🖼"  delay={0.05}/>
                  <MetricNode label="Reels"   raw={d.reelsCount}   color="#f472b6" icon="🎬"  delay={0.10}/>
                  <MetricNode label="Stories" raw={d.storiesCount} color="#fbbf24" icon="📖"  delay={0.15}/>
                  <MetricNode label="Total"   raw={d.totalContent} color="#60a5fa" icon="📦"  delay={0.20}/>
                </div>

                <p className="av-sec" style={{ marginTop:18 }}>Views by Type</p>
                <div className="av-chart">
                  <div className="av-chart-bar"/>
                  <div className="av-type-rows">
                    {[
                      { label:"Posts",   v:d.postViews,  color:"#84cc16" },
                      { label:"Reels",   v:d.reelViews,  color:"#f472b6" },
                      { label:"Stories", v:d.storyViews, color:"#fbbf24" },
                    ].map(({ label,v,color },i) => (
                      <div key={i} className="av-type-row">
                        <span className="av-type-lbl">{label}</span>
                        <div className="av-type-track">
                          <div className="av-type-fill"
                            style={{ width:`${d.totalViews>0?(v/d.totalViews)*100:0}%`, background:color }}/>
                        </div>
                        <span className="av-type-count">{fmt(v)}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <p className="av-sec" style={{ marginTop:18 }}>Likes Ledger</p>
                <div className="av-chain-panel">
                  <div className="av-chain-head">// like_distribution.chain</div>
                  {[
                    { label:"Post Likes",  value:d.postLikes,  color:"#84cc16" },
                    { label:"Reel Likes",  value:d.reelLikes,  color:"#f472b6" },
                    { label:"Story Likes", value:d.storyLikes, color:"#fbbf24" },
                  ].map((row,i) => <ChainRow key={i} {...row} maxVal={d.totalLikes} idx={i}/>)}
                </div>
              </>
            )}

            {/* ══ AUDIENCE ══════════════════════════════════════════════════ */}
            {tab==="audience" && (
              <>
                <p className="av-sec">Network Graph</p>
                <div className="av-grid-2">
                  <MetricNode label="Followers"     raw={d.followers}    color="#84cc16" icon="👥" delay={0.05}/>
                  <MetricNode label="Following"     raw={d.following}    color="#60a5fa" icon="➡️" delay={0.10}/>
                  <MetricNode label="Profile Views" raw={d.profileViews} color="#a78bfa" icon="🔍" delay={0.15}/>
                  <MetricNode label="Communities"   raw={d.communities}  color="#34d399" icon="🏘️" delay={0.20}/>
                </div>

                <p className="av-sec" style={{ marginTop:18 }}>Engagement Matrix</p>
                <div className="av-chain-panel">
                  <div className="av-chain-head">// engagement_matrix.chain</div>
                  {(() => {
                    const rows = [
                      { label:"Total Likes",   value:d.totalLikes,    color:"#f472b6" },
                      { label:"Comments",      value:d.totalComments, color:"#60a5fa" },
                      { label:"Saves",         value:d.savedCount,    color:"#818cf8" },
                      { label:"Shares",        value:d.sharesCount,   color:"#fbbf24" },
                      { label:"Profile Views", value:d.profileViews,  color:"#34d399" },
                    ];
                    const maxVal = Math.max(...rows.map(r => r.value), 1);
                    return rows.map((row,i) => <ChainRow key={i} {...row} maxVal={maxVal} idx={i}/>);
                  })()}
                </div>

                <p className="av-sec" style={{ marginTop:18 }}>Engagement Rate</p>
                <div className="av-eng">
                  <NeuralBg/>
                  <EngagementRing rate={d.engRate}/>
                  <div className="av-eng-info">
                    <h3>{d.engRate}% Rate</h3>
                    <p><strong>{fmt(d.followers)}</strong> followers</p>
                    <p><strong>{fmt(d.totalContent)}</strong> pieces of content</p>
                  </div>
                </div>
              </>
            )}

            {/* ══ WALLET ════════════════════════════════════════════════════ */}
            {tab==="wallet" && (
              <>
                <p className="av-sec">Token Ledger</p>

                <div className="av-w-gt">
                  <div className="av-w-lbl" style={{ color:"#fbbf24" }}>🪙 Grova Tokens</div>
                  <MetricNode label="GT Balance" raw={d.grovaTokens} color="#fbbf24" icon="🪙" size="lg" delay={0.05}/>
                </div>

                <div className="av-w-ep">
                  <div className="av-w-lbl" style={{ color:"#84cc16" }}>⚡ Engagement Points</div>
                  <MetricNode label="EP Balance" raw={d.engagementPoints} color="#84cc16" icon="⚡" size="lg" delay={0.10}/>
                  {/* ep_dashboard period breakdown */}
                  <div className="av-ep-periods">
                    <EPChip label="Today"    raw={d.dailyEp}       color="#84cc16"/>
                    <EPChip label="This Week" raw={d.weeklyEp}     color="#22d3ee"/>
                    <EPChip label="This Month" raw={d.monthlyEp}   color="#a78bfa"/>
                    <EPChip label="All Time"   raw={d.totalEpEarned} color="#f472b6"/>
                  </div>
                </div>

                <p className="av-sec" style={{ marginTop:18 }}>Content Summary</p>
                <div className="av-sum-row">
                  <div className="av-sum-chip">
                    <span className="av-sum-val">{fmt(d.totalViews)}</span>
                    <span className="av-sum-lbl">Views</span>
                  </div>
                  <div className="av-sum-chip">
                    <span className="av-sum-val">{fmt(d.totalLikes)}</span>
                    <span className="av-sum-lbl">Likes</span>
                  </div>
                  <div className="av-sum-chip">
                    <span className="av-sum-val">{fmt(d.totalContent)}</span>
                    <span className="av-sum-lbl">Content</span>
                  </div>
                </div>

                <p className="av-sec" style={{ marginTop:18 }}>XRC Chain Stream</p>
                <div className="av-chain-panel">
                  <div className="av-chain-head">// xrc_root_chain.XWRC</div>
                  {(() => {
                    const rows = [
                      { label:"EP Balance",    value:d.engagementPoints, color:"#84cc16" },
                      { label:"Grova Tokens",  value:d.grovaTokens,      color:"#fbbf24" },
                      { label:"Total Likes",   value:d.totalLikes,       color:"#f472b6" },
                      { label:"Total Views",   value:d.totalViews,       color:"#a78bfa" },
                      { label:"Followers",     value:d.followers,        color:"#60a5fa" },
                    ];
                    const maxVal = Math.max(...rows.map(r => r.value), 1);
                    return rows.map((row,i) => <ChainRow key={i} {...row} maxVal={maxVal} idx={i}/>);
                  })()}
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default AnalyticsView;