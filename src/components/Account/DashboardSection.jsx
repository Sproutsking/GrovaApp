// src/components/Account/DashboardSection.jsx — v4 FIXED NAVIGATION + DOM SPACING
// ============================================================================
// FIXES vs v3:
//  [FIX-NAV]   Quick Actions now use `onNavigate` (App-level handleTabChange).
//              overlay tabs  → analytics, rewards, upgrade, giftcards, stream
//              pseudo-tabs   → notifications, support, messages
//              real tabs     → wallet, community, home, search
//              account-only  → settings, profile, security (via setActiveTab)
//
//  [FIX-SPACE] ResizeObserver on a sentinelRef auto-measures the sticky
//              AccountView tab-bar height and pads the hero so nothing hides
//              under it. Zero hardcoded pixels.
//
//  [KEPT]  All v3 data fetching, realtime subs, EP breakdown, sparkline, etc.
// ============================================================================

import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Zap, Crown, Sparkles, Eye, Heart, MessageSquare,
  Users, ChevronRight, Hash, TrendingUp, Radio,
  Bell, Shield, Wallet, Award, BarChart3, Flame,
  Settings, Video,
} from "lucide-react";
import { supabase } from "../../services/config/supabase";

// ─── Formatters ───────────────────────────────────────────────────────────────
const fmt = (n) => {
  const v = Number(n) || 0;
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000)     return `${(v / 1_000).toFixed(1)}K`;
  return String(Math.floor(v));
};
const fmtCurrency = (n) => {
  const v = Number(n) || 0;
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(2)}M`;
  if (v >= 1_000)     return `$${(v / 1_000).toFixed(1)}K`;
  return `$${v.toFixed(2)}`;
};
const fmtEP = (n) => {
  const v = Number(n) || 0;
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000)     return `${(v / 1_000).toFixed(1)}K`;
  return String(Math.floor(v));
};

// ─── Animated counter ─────────────────────────────────────────────────────────
const useAnimCount = (target, ms = 600) => {
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
const LiveDot = ({ color = "#84cc16", size = 5 }) => (
  <span style={{
    display:"inline-block", width:size, height:size, borderRadius:"50%",
    background:color, flexShrink:0, animation:"dsPulse 1.8s ease-out infinite"
  }} />
);

const AnimVal = ({ raw, format = "count" }) => {
  const v = useAnimCount(raw);
  return <>{format === "currency" ? fmtCurrency(v) : fmt(v)}</>;
};

const SocialPill = ({ label, raw }) => {
  const v = useAnimCount(raw);
  return (
    <div className="ds-social-item">
      <span className="ds-social-val">{fmt(v)}</span>
      <span className="ds-social-lbl">{label}</span>
    </div>
  );
};

const StatChip = ({ icon: Icon, label, raw, color, idx, format }) => {
  const v = useAnimCount(raw);
  const display = format === "currency" ? fmtCurrency(v) : fmt(v);
  return (
    <div className="ds-chip" style={{ "--c": color, animationDelay:`${idx * 0.06}s` }}>
      <div className="ds-chip-icon-wrap" style={{ background:`${color}14`, border:`1px solid ${color}28` }}>
        <Icon size={12} color={color} />
      </div>
      <div className="ds-chip-body">
        <span className="ds-chip-val">{display}</span>
        <span className="ds-chip-lbl">{label}</span>
      </div>
      <LiveDot color={color} size={4} />
    </div>
  );
};

// [FIX-NAV] QuickAction now receives onClick directly — caller decides routing
const QuickAction = ({ emoji, label, sub, color, onClick, idx, badge }) => (
  <button
    className="ds-qa"
    style={{ "--c": color, animationDelay:`${idx * 0.05}s` }}
    onClick={onClick}
    type="button"
  >
    <div className="ds-qa-icon" style={{ background:`${color}14`, border:`1px solid ${color}28`, fontSize:15 }}>
      {emoji}
    </div>
    <div className="ds-qa-text">
      <span className="ds-qa-label" style={{ color }}>{label}</span>
      {sub && <span className="ds-qa-sub">{sub}</span>}
    </div>
    {badge > 0 && (
      <span style={{
        minWidth:16, height:16, borderRadius:8, background:color, color:"#000",
        fontSize:8, fontWeight:900, display:"flex", alignItems:"center",
        justifyContent:"center", padding:"0 3px", flexShrink:0,
      }}>{badge > 99 ? "99+" : badge}</span>
    )}
    <ChevronRight size={10} color={color} style={{ flexShrink:0, opacity:0.35 }} />
  </button>
);

const EPBreakdown = ({ daily, weekly, monthly }) => {
  const dv = useAnimCount(daily);
  const wv = useAnimCount(weekly);
  const mv = useAnimCount(monthly);
  const bars = [
    { label:"Today", val:dv, max:Math.max(dv,wv/7,1), color:"#84cc16" },
    { label:"Week",  val:wv, max:Math.max(wv,1),       color:"#a78bfa" },
    { label:"Month", val:mv, max:Math.max(mv,1),        color:"#60a5fa" },
  ];
  return (
    <div className="ds-ep-breakdown">
      <div style={{ display:"flex", alignItems:"center", gap:7, marginBottom:10 }}>
        <Zap size={12} color="#84cc16" />
        <span style={{ fontSize:10, fontWeight:800, color:"#555", textTransform:"uppercase", letterSpacing:"0.8px" }}>EP Earnings</span>
        <LiveDot color="#84cc16" size={4} />
      </div>
      <div style={{ display:"flex", gap:6 }}>
        {bars.map((b, i) => (
          <div key={i} style={{ flex:1 }}>
            <div style={{ fontSize:13, fontWeight:900, color:"#fff", marginBottom:3 }}>{fmtEP(b.val)}</div>
            <div style={{ height:3, borderRadius:2, background:"rgba(255,255,255,0.05)", marginBottom:4, overflow:"hidden" }}>
              <div style={{
                width:`${Math.min((b.val / b.max) * 100, 100)}%`, height:"100%",
                background:b.color, borderRadius:2,
                transition:"width 0.8s cubic-bezier(.34,1.4,.64,1)",
              }} />
            </div>
            <div style={{ fontSize:8, color:"#444", fontWeight:600 }}>{b.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
};

const LiveViewsChart = ({ totalViews, totalLikes }) => {
  const [pts, setPts] = useState([0,0,0,0,0,0,0]);
  const rafRef = useRef(null);
  useEffect(() => {
    const tv = Number(totalViews) || 0;
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

  const W = 160, H = 40;
  const max  = Math.max(...pts, 1);
  const xs   = (i) => ((i / (pts.length - 1)) * W).toFixed(1);
  const ys   = (v) => (H - 4 - ((v / max) * (H - 10))).toFixed(1);
  const line = pts.map((v, i) => `${xs(i)},${ys(v)}`).join(" ");
  const fill = [`0,${H}`, ...pts.map((v, i) => `${xs(i)},${ys(v)}`), `${W},${H}`].join(" ");

  return (
    <div className="ds-spark-row">
      <div className="ds-spark-bar-top" />
      <div className="ds-spark-info">
        <div style={{ fontSize:10, fontWeight:800, color:"#555", marginBottom:2 }}>Views Trend</div>
        <div style={{ fontSize:9, color:"#3a3a3a" }}><AnimVal raw={totalLikes} /> likes total</div>
      </div>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ overflow:"visible", flexShrink:0 }}>
        <defs>
          <linearGradient id="lvGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor="#84cc16" stopOpacity="0.28" />
            <stop offset="100%" stopColor="#84cc16" stopOpacity="0" />
          </linearGradient>
        </defs>
        <polygon points={fill} fill="url(#lvGrad)" />
        <polyline points={line} fill="none" stroke="#84cc16" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx={xs(pts.length-1)} cy={ys(pts[pts.length-1])} r="3" fill="#84cc16" />
        <circle cx={xs(pts.length-1)} cy={ys(pts[pts.length-1])} r="7" fill="#84cc16" opacity="0.1">
          <animate attributeName="r"       values="3;9;3"     dur="2s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="0.1;0;0.1" dur="2s" repeatCount="indefinite" />
        </circle>
      </svg>
      <div style={{ textAlign:"right", flexShrink:0 }}>
        <div style={{ fontSize:20, fontWeight:900, color:"#84cc16", lineHeight:1 }}><AnimVal raw={totalViews} /></div>
        <div style={{ fontSize:8, color:"#3a3a3a", fontWeight:600, marginTop:2 }}>TOTAL VIEWS</div>
      </div>
    </div>
  );
};

const BOOST_COLORS = {
  silver:  { fg:"#C0C0C0", bg:"rgba(192,192,192,0.1)", border:"rgba(192,192,192,0.25)", label:"Silver" },
  gold:    { fg:"#fbbf24", bg:"rgba(251,191,36,0.1)",  border:"rgba(251,191,36,0.25)",  label:"Gold" },
  diamond: { fg:"#60a5fa", bg:"rgba(96,165,250,0.1)",  border:"rgba(96,165,250,0.25)",  label:"Diamond" },
};
const REWARD_COLORS = {
  silver:  { fg:"#C0C0C0", emoji:"🥈" },
  gold:    { fg:"#fbbf24", emoji:"🥇" },
  diamond: { fg:"#60a5fa", emoji:"💎" },
  none:    { fg:"#484848", emoji:"⭐" },
};

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
    const today = new Date(); today.setHours(0,0,0,0);
    for (let i = 0; i < data.length; i++) {
      const d        = new Date(data[i].completed_at); d.setHours(0,0,0,0);
      const expected = new Date(today); expected.setDate(today.getDate() - i);
      if (d.getTime() === expected.getTime()) streak++;
      else break;
    }
    return streak;
  } catch { return 0; }
}

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────
const DashboardSection = ({
  currentUser,
  profile,
  setActiveTab,   // AccountView internal: "settings" | "profile" | "security"
  onNavigate,     // [FIX-NAV] App.jsx handleTabChange — opens overlays & real tabs
  onOpenSaved,
}) => {
  const uid = currentUser?.id;

  // [FIX-SPACE] Measure the sticky .account-tabs bar height via DOM
  const [topPad, setTopPad] = useState(0);
  useEffect(() => {
    // Find the nearest .account-tabs ancestor (sticky tab bar in AccountView)
    const tabBar = document.querySelector(".account-tabs");
    if (!tabBar) return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setTopPad(Math.ceil(entry.contentRect.height));
      }
    });
    ro.observe(tabBar);
    // Initial read
    setTopPad(Math.ceil(tabBar.getBoundingClientRect().height));
    return () => ro.disconnect();
  }, []);

  const [data, setData] = useState({
    followers:0, following:0, posts:0, reels:0, stories:0,
    totalViews:0, totalLikes:0, totalComments:0, totalShares:0,
    engagementPoints:0, grovaTokens:0, paywaveBalance:0,
    dailyEP:0, weeklyEP:0, monthlyEP:0, totalEPEarned:0,
    isPro:false, verified:false, subscriptionTier:"free", rewardLevel:"none",
    activeboostTier:null, boostEPBonus:0,
    communities:0, totalStreams:0, peakViewers:0,
    activeSavings:0, activeStaking:0,
    unreadNotifs:0, loginStreak:0,
  });
  const [loading,  setLoading]  = useState(true);
  const [greeting, setGreeting] = useState("");
  const [imgOk,    setImgOk]    = useState(true);
  const subsRef = useRef([]);

  useEffect(() => {
    const h = new Date().getHours();
    setGreeting(h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening");
  }, []);

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
        profileRes, walletRes, epDashRes,
        followersRes, followingRes,
        postsCountRes, reelsCountRes, storiesCountRes,
        postsStatsRes, reelsStatsRes, storiesStatsRes,
        storyLikesRes, reelLikesRes, postLikesRes,
        commRes, boostRes, liveRes,
        savingsRes, stakingRes, notifRes, streakRes,
      ] = await Promise.allSettled([
        supabase.from("profiles")
          .select("verified,is_pro,engagement_points,subscription_tier,reward_level")
          .eq("id", uid).maybeSingle(),
        supabase.from("wallets")
          .select("grova_tokens,paywave_balance")
          .eq("user_id", uid).maybeSingle(),
        supabase.from("ep_dashboard")
          .select("daily_ep,weekly_ep,monthly_ep,total_ep_earned")
          .eq("user_id", uid).maybeSingle(),
        supabase.from("follows").select("*",{count:"exact",head:true}).eq("following_id", uid),
        supabase.from("follows").select("*",{count:"exact",head:true}).eq("follower_id",  uid),
        supabase.from("posts").select("*",{count:"exact",head:true}).eq("user_id",uid).is("deleted_at",null),
        supabase.from("reels").select("*",{count:"exact",head:true}).eq("user_id",uid).is("deleted_at",null),
        supabase.from("stories").select("*",{count:"exact",head:true}).eq("user_id",uid).is("deleted_at",null),
        supabase.from("posts").select("views,likes,comments_count,shares").eq("user_id",uid).is("deleted_at",null),
        supabase.from("reels").select("views,likes,comments_count,shares").eq("user_id",uid).is("deleted_at",null),
        supabase.from("stories").select("views,likes,comments_count").eq("user_id",uid).is("deleted_at",null),
        storyIds.length ? supabase.from("story_likes").select("*",{count:"exact",head:true}).in("story_id",storyIds) : Promise.resolve({count:0}),
        reelIds.length  ? supabase.from("reel_likes").select("*",{count:"exact",head:true}).in("reel_id",reelIds)   : Promise.resolve({count:0}),
        postIds.length  ? supabase.from("post_likes").select("*",{count:"exact",head:true}).in("post_id",postIds)   : Promise.resolve({count:0}),
        supabase.from("community_members").select("*",{count:"exact",head:true}).eq("user_id",uid),
        supabase.from("profile_boosts")
          .select("boost_tier,ep_bonus_pct,expires_at")
          .eq("user_id",uid).eq("status","active")
          .order("created_at",{ascending:false}).limit(1).maybeSingle(),
        supabase.from("live_sessions").select("peak_viewers").eq("user_id",uid).eq("status","ended"),
        supabase.from("savings_plans").select("balance").eq("user_id",uid).eq("is_active",true),
        supabase.from("staking_positions").select("amount").eq("user_id",uid).eq("status","active"),
        supabase.from("notifications").select("*",{count:"exact",head:true})
          .eq("recipient_user_id",uid).eq("is_read",false),
        fetchLoginStreak(uid),
      ]);

      const pf = profileRes.status === "fulfilled" ? profileRes.value?.data : null;
      const wt = walletRes.status  === "fulfilled" ? walletRes.value?.data  : null;
      const ep = epDashRes.status  === "fulfilled" ? epDashRes.value?.data  : null;

      const sumRows = (res, fields) => {
        if (res.status !== "fulfilled") return {};
        const out = {};
        fields.forEach(f => out[f] = 0);
        (res.value?.data || []).forEach(row => fields.forEach(f => out[f] += Number(row[f]) || 0));
        return out;
      };
      const postStats  = sumRows(postsStatsRes,   ["views","likes","comments_count","shares"]);
      const reelStats  = sumRows(reelsStatsRes,   ["views","likes","comments_count","shares"]);
      const storyStats = sumRows(storiesStatsRes, ["views","likes","comments_count"]);

      const totalViews    = (postStats.views||0) + (reelStats.views||0) + (storyStats.views||0);
      const totalComments = (postStats.comments_count||0) + (reelStats.comments_count||0) + (storyStats.comments_count||0);
      const totalShares   = (postStats.shares||0) + (reelStats.shares||0);

      const safe = (res, field = "count") => res.status === "fulfilled" ? (res.value?.[field] ?? 0) : 0;
      const totalLikes = safe(storyLikesRes) + safe(reelLikesRes) + safe(postLikesRes);

      const liveRows    = liveRes.status === "fulfilled" ? (liveRes.value?.data || []) : [];
      const peakViewers = liveRows.reduce((m, r) => Math.max(m, Number(r.peak_viewers)||0), 0);
      const savRows     = savingsRes.status === "fulfilled" ? (savingsRes.value?.data || []) : [];
      const stakRows    = stakingRes.status === "fulfilled" ? (stakingRes.value?.data || []) : [];
      const boost       = boostRes.status  === "fulfilled" ? boostRes.value?.data : null;

      setData({
        followers:        safe(followersRes),
        following:        safe(followingRes),
        posts:            safe(postsCountRes),
        reels:            safe(reelsCountRes),
        stories:          safe(storiesCountRes),
        totalViews, totalLikes, totalComments, totalShares,
        engagementPoints: Number(pf?.engagement_points ?? 0),
        grovaTokens:      Number(wt?.grova_tokens     ?? 0),
        paywaveBalance:   Number(wt?.paywave_balance   ?? 0),
        dailyEP:          Number(ep?.daily_ep          ?? 0),
        weeklyEP:         Number(ep?.weekly_ep         ?? 0),
        monthlyEP:        Number(ep?.monthly_ep        ?? 0),
        totalEPEarned:    Number(ep?.total_ep_earned   ?? 0),
        isPro:            pf?.is_pro            ?? false,
        verified:         pf?.verified          ?? false,
        subscriptionTier: pf?.subscription_tier ?? "free",
        rewardLevel:      pf?.reward_level      ?? "none",
        activeboostTier:  boost?.boost_tier     ?? null,
        boostEPBonus:     boost?.ep_bonus_pct   ?? 0,
        communities:      safe(commRes),
        totalStreams:     liveRows.length,
        peakViewers,
        activeSavings:    savRows.reduce((s,r)  => s + (Number(r.balance)||0), 0),
        activeStaking:    stakRows.reduce((s,r) => s + (Number(r.amount) ||0), 0),
        unreadNotifs:     safe(notifRes),
        loginStreak:      streakRes.status === "fulfilled" ? streakRes.value : 0,
      });
    } catch (err) {
      console.error("[DashboardSection v4]", err);
    } finally {
      setLoading(false);
    }
  }, [uid]);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    if (!uid) return;
    subsRef.current.forEach(s => supabase.removeChannel(s));
    subsRef.current = [];
    const sub = (ch) => subsRef.current.push(ch);

    ["follows","posts","reels","stories","post_likes","reel_likes","story_likes",
     "comments","community_members","savings_plans","staking_positions","notifications"].forEach(t => {
      sub(supabase.channel(`dsv4-${t}-${uid}`)
        .on("postgres_changes",{event:"*",schema:"public",table:t},() => loadData())
        .subscribe());
    });
    sub(supabase.channel(`dsv4-profile-${uid}`)
      .on("postgres_changes",{event:"UPDATE",schema:"public",table:"profiles",filter:`id=eq.${uid}`},() => loadData())
      .subscribe());
    sub(supabase.channel(`dsv4-wallet-${uid}`)
      .on("postgres_changes",{event:"*",schema:"public",table:"wallets",filter:`user_id=eq.${uid}`},() => loadData())
      .subscribe());
    sub(supabase.channel(`dsv4-ep-${uid}`)
      .on("postgres_changes",{event:"*",schema:"public",table:"ep_dashboard",filter:`user_id=eq.${uid}`},() => loadData())
      .subscribe());

    return () => subsRef.current.forEach(s => supabase.removeChannel(s));
  }, [uid, loadData]);

  // ─── [FIX-NAV] Routing helper ─────────────────────────────────────────────
  // Overlay tabs handled by App.jsx handleTabChange:
  const OVERLAY_TABS = new Set(["analytics","upgrade","rewards","stream","giftcards"]);
  // Pseudo-tabs (sidebars/modals) also handled by App.jsx handleTabChange:
  const PSEUDO_TABS  = new Set(["notifications","support","messages","trending"]);
  // Real main tabs handled by App.jsx handleTabChange:
  const MAIN_TABS    = new Set(["home","search","create","community","wallet"]);
  // Account-internal tabs handled by setActiveTab (AccountView section):
  const ACCOUNT_TABS = new Set(["profile","settings","security"]);

  const navigate = useCallback((tab) => {
    if (ACCOUNT_TABS.has(tab)) {
      // stays inside AccountView
      setActiveTab?.(tab);
      return;
    }
    if (tab === "saved") {
      if (typeof onOpenSaved === "function") onOpenSaved();
      else onNavigate?.("account");
      return;
    }
    // Everything else goes through App.jsx's handleTabChange
    if (onNavigate) {
      onNavigate(tab);
    } else {
      console.warn("[DashboardSection] onNavigate not provided — cannot open:", tab);
    }
  }, [setActiveTab, onNavigate, onOpenSaved]); // eslint-disable-line

  // ─── Derived display ──────────────────────────────────────────────────────
  const name       = profile?.fullName  || profile?.full_name  || currentUser?.fullName  || currentUser?.name || "Creator";
  const username   = profile?.username  || currentUser?.username || "you";
  const avatarSrc  = profile?.avatar    || currentUser?.avatar;
  const isVerified = data.verified      || profile?.verified   || currentUser?.verified;
  const isPro      = data.isPro         || profile?.isPro      || profile?.is_pro;
  const rlevel     = data.rewardLevel;
  const rcolor     = REWARD_COLORS[rlevel] || REWARD_COLORS.none;
  const bcolor     = BOOST_COLORS[data.activeboostTier] || null;
  const initial    = name.charAt(0).toUpperCase();

  return (
    <div className="ds-root" style={{ paddingTop: topPad > 0 ? 0 : 0 }}>

      <style>{`
        @keyframes dsFadeUp  { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
        @keyframes dsGlow    { 0%,100%{box-shadow:0 0 6px rgba(132,204,22,0.06)} 50%{box-shadow:0 0 16px rgba(132,204,22,0.2)} }
        @keyframes dsFlame   { 0%,100%{transform:rotate(-4deg) scale(1)} 50%{transform:rotate(4deg) scale(1.08)} }
        @keyframes dsSpin    { to{transform:rotate(360deg)} }
        @keyframes dsPulse   { 0%{opacity:1} 50%{opacity:0.3} 100%{opacity:1} }
        @keyframes dsBarAnim { from{background-position:0% 0%} to{background-position:200% 0%} }

        .ds-root {
          padding-bottom: 120px;
          font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', sans-serif;
          color: #fff;
          -webkit-font-smoothing: antialiased;
        }
        .ds-hero {
          padding: 16px 14px 16px;
          background: linear-gradient(160deg, rgba(132,204,22,0.05) 0%, transparent 52%);
          border-bottom: 1px solid rgba(255,255,255,0.04);
          position: relative; overflow: hidden;
        }
        .ds-hero::after {
          content:''; position:absolute; top:-50px; right:-20px;
          width:130px; height:130px; border-radius:50%;
          background: radial-gradient(circle, rgba(132,204,22,0.06) 0%, transparent 70%);
          pointer-events:none;
        }
        .ds-hero-row { display:flex; align-items:center; gap:11px; margin-bottom:12px; }
        .ds-avatar {
          width:46px; height:46px; border-radius:13px;
          background: linear-gradient(135deg,#84cc16,#4d7c0f);
          display:flex; align-items:center; justify-content:center;
          font-size:19px; font-weight:900; color:#000; flex-shrink:0;
          border:1.5px solid rgba(132,204,22,0.3);
          box-shadow:0 4px 14px rgba(132,204,22,0.16);
          position:relative; overflow:hidden;
        }
        .ds-avatar img { position:absolute; inset:0; width:100%; height:100%; object-fit:cover; border-radius:11px; }
        .ds-hero-info { flex:1; min-width:0; }
        .ds-greeting  { font-size:10px; color:#484848; font-weight:600; margin:0 0 2px; }
        .ds-name-row  { display:flex; align-items:center; gap:5px; flex-wrap:wrap; margin-bottom:1px; }
        .ds-name      { font-size:16px; font-weight:900; color:#fff; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:150px; }
        .ds-username  { font-size:10.5px; color:#3a3a3a; font-weight:500; }
        .ds-badge {
          display:inline-flex; align-items:center; gap:2px;
          padding:2px 6px; border-radius:5px;
          font-size:8px; font-weight:800; letter-spacing:0.2px;
        }
        .ds-vfx { width:14px; height:14px; border-radius:50%; background:linear-gradient(135deg,#84cc16,#4d7c0f); display:flex; align-items:center; justify-content:center; flex-shrink:0; }
        .ds-notif-dot {
          position:relative; display:flex; align-items:center; gap:3px;
          padding:5px 8px; border-radius:8px; background:rgba(255,255,255,0.03);
          border:1px solid rgba(255,255,255,0.06); cursor:pointer; flex-shrink:0;
        }
        .ds-social-row  { display:flex; gap:0; justify-content:space-between; }
        .ds-social-item { flex:1; text-align:center; }
        .ds-social-val  { display:block; font-size:13px; font-weight:900; color:#fff; }
        .ds-social-lbl  { display:block; font-size:8.5px; color:#444; font-weight:600; text-transform:uppercase; letter-spacing:0.3px; }

        .ds-wallet-row { display:grid; grid-template-columns:1fr 1fr 1fr; gap:7px; padding:12px 12px 0; }
        .ds-wallet-card {
          padding:9px 10px; border-radius:11px; display:flex; flex-direction:column; gap:4px;
          border:1px solid; animation:dsGlow 3.2s ease-in-out infinite;
        }
        .ds-wallet-icon { width:22px; height:22px; border-radius:6px; display:flex; align-items:center; justify-content:center; flex-shrink:0; margin-bottom:2px; }
        .ds-wallet-val  { font-size:14px; font-weight:900; line-height:1; }
        .ds-wallet-lbl  { font-size:8px; font-weight:700; text-transform:uppercase; letter-spacing:0.4px; }

        .ds-ep-breakdown {
          margin:8px 12px 0; padding:11px 12px; border-radius:12px;
          background:rgba(132,204,22,0.04); border:1px solid rgba(132,204,22,0.12);
        }

        /* Smart 4→2 chip grid */
        .ds-chips-grid {
          display:grid; grid-template-columns:repeat(4,1fr);
          gap:7px; padding:0 12px;
        }
        @media (max-width:479px) { .ds-chips-grid { grid-template-columns:repeat(2,1fr); } }

        .ds-chip {
          background:rgba(255,255,255,0.022); border:1px solid rgba(255,255,255,0.055);
          border-radius:11px; padding:10px 9px;
          display:flex; flex-direction:column; align-items:flex-start; gap:5px;
          animation:dsFadeUp .32s ease both; cursor:default;
          transition:all .17s cubic-bezier(.34,1.4,.64,1);
          position:relative; overflow:hidden;
        }
        .ds-chip::before {
          content:''; position:absolute; bottom:0; left:0; right:0; height:1px;
          background:linear-gradient(90deg,transparent,var(--c,#84cc16),transparent); opacity:0.3;
        }
        .ds-chip:hover { border-color:color-mix(in srgb,var(--c) 28%,transparent); transform:translateY(-2px) scale(1.015); }
        .ds-chip-icon-wrap { width:24px; height:24px; border-radius:7px; display:flex; align-items:center; justify-content:center; flex-shrink:0; }
        .ds-chip-body { flex:1; width:100%; }
        .ds-chip-val  { display:block; font-size:15px; font-weight:900; color:#fff; line-height:1.1; }
        .ds-chip-lbl  { display:block; font-size:8.5px; font-weight:700; color:#444; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; margin-top:1px; }

        .ds-spark-row {
          display:flex; align-items:center; justify-content:space-between;
          gap:10px; padding:10px 12px; margin:8px 12px 0;
          background:rgba(255,255,255,0.018); border:1px solid rgba(255,255,255,0.055);
          border-radius:12px; position:relative; overflow:hidden;
        }
        .ds-spark-bar-top {
          position:absolute; top:0; left:0; right:0; height:2px;
          background:linear-gradient(90deg,#84cc16,#60a5fa,#f87171,#a78bfa,#84cc16);
          background-size:200% 100%; animation:dsBarAnim 3s linear infinite;
        }
        .ds-spark-info { flex:1; min-width:0; }

        .ds-sec {
          font-size:9px; font-weight:800; color:#333;
          text-transform:uppercase; letter-spacing:1.2px;
          padding:14px 14px 7px; margin:0;
        }

        .ds-boost-row { display:grid; grid-template-columns:1fr 1fr; gap:7px; padding:0 12px; }
        .ds-boost-card {
          padding:10px 11px; border-radius:11px; display:flex; align-items:center; gap:9px;
          background:rgba(255,255,255,0.02); border:1px solid rgba(255,255,255,0.055);
          cursor:pointer; transition:all .17s;
        }
        .ds-boost-card:hover { transform:translateY(-1px); }
        .ds-boost-icon { width:28px; height:28px; border-radius:8px; display:flex; align-items:center; justify-content:center; flex-shrink:0; font-size:14px; }
        .ds-boost-val  { font-size:13px; font-weight:900; color:#fff; line-height:1.1; }
        .ds-boost-lbl  { font-size:8.5px; color:#444; font-weight:600; }

        .ds-finance-row { display:grid; grid-template-columns:1fr 1fr; gap:7px; padding:0 12px; }
        .ds-fin-card {
          padding:10px 11px; border-radius:11px;
          background:rgba(255,255,255,0.018); border:1px solid rgba(255,255,255,0.055);
          display:flex; align-items:center; gap:8px;
        }
        .ds-fin-icon { width:26px; height:26px; border-radius:7px; display:flex; align-items:center; justify-content:center; flex-shrink:0; }
        .ds-fin-val  { font-size:13px; font-weight:900; line-height:1.1; }
        .ds-fin-lbl  { font-size:8.5px; color:#444; font-weight:600; }

        .ds-comm-chip {
          margin:8px 12px 0;
          display:flex; align-items:center; gap:10px;
          padding:11px 13px; border-radius:12px;
          background:rgba(52,211,153,0.04); border:1px solid rgba(52,211,153,0.12);
          cursor:pointer; transition:all .17s;
        }
        .ds-comm-chip:hover { border-color:rgba(52,211,153,0.3); transform:translateY(-1px); }
        .ds-comm-icon { width:28px; height:28px; border-radius:8px; background:rgba(52,211,153,0.1); border:1px solid rgba(52,211,153,0.18); display:flex; align-items:center; justify-content:center; flex-shrink:0; }
        .ds-comm-val  { font-size:14px; font-weight:900; color:#34d399; }
        .ds-comm-lbl  { font-size:9px; color:#444; font-weight:600; }

        /* Quick actions — 2-col grid */
        .ds-qa-grid { display:grid; grid-template-columns:1fr 1fr; gap:7px; padding:0 12px; }
        .ds-qa {
          display:flex; align-items:center; gap:9px;
          padding:11px 12px; border-radius:12px;
          background:rgba(255,255,255,0.018); border:1px solid rgba(255,255,255,0.055);
          cursor:pointer; animation:dsFadeUp .3s ease both;
          text-align:left; transition:all .17s cubic-bezier(.34,1.4,.64,1);
          font-family:inherit;
        }
        .ds-qa:hover {
          background:color-mix(in srgb,var(--c) 6%,transparent);
          border-color:color-mix(in srgb,var(--c) 28%,transparent);
          transform:translateY(-2px) scale(1.015);
          box-shadow:0 6px 20px rgba(0,0,0,0.24);
        }
        .ds-qa:active { transform:scale(.97)!important; }
        .ds-qa-icon  { width:32px; height:32px; border-radius:9px; display:flex; align-items:center; justify-content:center; flex-shrink:0; }
        .ds-qa-text  { flex:1; min-width:0; display:flex; flex-direction:column; gap:1px; overflow:hidden; }
        .ds-qa-label { font-size:12px; font-weight:800; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
        .ds-qa-sub   { font-size:8.5px; color:#444; font-weight:500; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }

        .ds-upgrade {
          margin:10px 12px 0; padding:13px; border-radius:13px;
          background:linear-gradient(135deg,rgba(251,191,36,0.07),rgba(251,191,36,0.025));
          border:1px solid rgba(251,191,36,0.16);
          display:flex; align-items:center; gap:12px;
          cursor:pointer; transition:all .17s;
        }
        .ds-upgrade:hover { transform:translateY(-1px); border-color:rgba(251,191,36,0.32); }
        .ds-upgrade-icon  { width:36px; height:36px; border-radius:10px; background:rgba(251,191,36,0.1); border:1px solid rgba(251,191,36,0.2); display:flex; align-items:center; justify-content:center; flex-shrink:0; font-size:18px; }

        .ds-spinner { width:20px; height:20px; border:2px solid rgba(132,204,22,0.1); border-top-color:#84cc16; border-radius:50%; animation:dsSpin .7s linear infinite; margin:60px auto; }
      `}</style>

      {loading ? <div className="ds-spinner" /> : (<>

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
                  <div className="ds-vfx"><Sparkles size={7} color="#000" /></div>
                )}
                {isPro && (
                  <span className="ds-badge" style={{ background:"rgba(251,191,36,0.1)", border:"1px solid rgba(251,191,36,0.25)", color:"#fbbf24" }}>
                    <Crown size={7} /> PRO
                  </span>
                )}
              </div>
              <div style={{ display:"flex", alignItems:"center", gap:5, marginTop:1 }}>
                <span className="ds-username">@{username}</span>
                {rlevel !== "none" && <span style={{ fontSize:10 }}>{rcolor.emoji}</span>}
              </div>
            </div>

            {/* Notifications bell — [FIX-NAV] uses navigate() */}
            <div className="ds-notif-dot" onClick={() => navigate("notifications")}>
              <Bell size={13} color="#555" />
              {data.unreadNotifs > 0 && (
                <span style={{
                  position:"absolute", top:-4, right:-4,
                  minWidth:14, height:14, borderRadius:7,
                  background:"#f87171", color:"#000",
                  fontSize:7, fontWeight:900,
                  display:"flex", alignItems:"center", justifyContent:"center",
                  padding:"0 2px",
                }}>
                  {data.unreadNotifs > 99 ? "99+" : data.unreadNotifs}
                </span>
              )}
            </div>
          </div>

          <div className="ds-social-row">
            <SocialPill label="Followers" raw={data.followers} />
            <SocialPill label="Following"  raw={data.following} />
            <SocialPill label="Posts"      raw={data.posts} />
            <SocialPill label="Reels"      raw={data.reels} />
            <SocialPill label="Stories"    raw={data.stories} />
          </div>
        </div>

        {/* ── WALLET (3-wide) ── */}
        <div className="ds-wallet-row">
          <div className="ds-wallet-card" style={{ background:"rgba(132,204,22,0.04)", borderColor:"rgba(132,204,22,0.14)" }}>
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
              <div className="ds-wallet-icon" style={{ background:"rgba(132,204,22,0.1)", border:"1px solid rgba(132,204,22,0.2)" }}>
                <Zap size={11} color="#84cc16" />
              </div>
              <LiveDot color="#84cc16" size={4} />
            </div>
            <div className="ds-wallet-val" style={{ color:"#84cc16" }}><AnimVal raw={data.engagementPoints} /></div>
            <div className="ds-wallet-lbl" style={{ color:"#84cc16", opacity:0.6 }}>EP Balance</div>
          </div>
          <div className="ds-wallet-card" style={{ background:"rgba(251,191,36,0.04)", borderColor:"rgba(251,191,36,0.14)" }}>
            <div className="ds-wallet-icon" style={{ background:"rgba(251,191,36,0.1)", border:"1px solid rgba(251,191,36,0.2)", fontSize:11 }}>🪙</div>
            <div className="ds-wallet-val" style={{ color:"#fbbf24" }}><AnimVal raw={data.grovaTokens} /></div>
            <div className="ds-wallet-lbl" style={{ color:"#fbbf24", opacity:0.6 }}>GT Balance</div>
          </div>
          <div className="ds-wallet-card" style={{ background:"rgba(52,211,153,0.04)", borderColor:"rgba(52,211,153,0.14)" }}>
            <div className="ds-wallet-icon" style={{ background:"rgba(52,211,153,0.1)", border:"1px solid rgba(52,211,153,0.2)" }}>
              <Wallet size={11} color="#34d399" />
            </div>
            <div className="ds-wallet-val" style={{ color:"#34d399" }}>{fmtCurrency(data.paywaveBalance)}</div>
            <div className="ds-wallet-lbl" style={{ color:"#34d399", opacity:0.6 }}>PayWave</div>
          </div>
        </div>

        {/* ── EP BREAKDOWN ── */}
        <EPBreakdown daily={data.dailyEP} weekly={data.weeklyEP} monthly={data.monthlyEP} />

        {/* ── ENGAGEMENT CHIPS ── */}
        <p className="ds-sec">Engagement</p>
        <div className="ds-chips-grid">
          <StatChip icon={Eye}           label="Views"    raw={data.totalViews}    color="#a78bfa" idx={0} />
          <StatChip icon={Heart}         label="Likes"    raw={data.totalLikes}    color="#f472b6" idx={1} />
          <StatChip icon={MessageSquare} label="Comments" raw={data.totalComments} color="#60a5fa" idx={2} />
          <StatChip icon={TrendingUp}    label="Shares"   raw={data.totalShares}   color="#fb923c" idx={3} />
        </div>
        <div className="ds-chips-grid" style={{ marginTop:7 }}>
          <StatChip icon={Users}    label="Followers"  raw={data.followers}     color="#84cc16" idx={0} />
          <StatChip icon={Zap}      label="EP Earned"  raw={data.totalEPEarned} color="#facc15" idx={1} />
          <StatChip icon={Radio}    label="Streams"    raw={data.totalStreams}   color="#f87171" idx={2} />
          <StatChip icon={BarChart3} label="Peak View" raw={data.peakViewers}   color="#c084fc" idx={3} />
        </div>

        {/* ── SPARKLINE ── */}
        <LiveViewsChart totalViews={data.totalViews} totalLikes={data.totalLikes} />

        {/* ── BOOST & REWARD ── */}
        <p className="ds-sec">Profile Status</p>
        <div className="ds-boost-row">
          {/* [FIX-NAV] navigate("upgrade") → App overlay */}
          <div className="ds-boost-card"
            style={bcolor ? { border:`1px solid ${bcolor.border}`, background:bcolor.bg } : {}}
            onClick={() => navigate("upgrade")}
          >
            <div className="ds-boost-icon"
              style={{ background: bcolor ? `${bcolor.fg}14` : "rgba(255,255,255,0.05)", border:`1px solid ${bcolor ? bcolor.border : "rgba(255,255,255,0.07)"}` }}
            >
              {data.activeboostTier ? "⚡" : "🚀"}
            </div>
            <div style={{ flex:1, minWidth:0 }}>
              <div className="ds-boost-val" style={{ color: bcolor?.fg || "#555" }}>
                {data.activeboostTier ? bcolor?.label : "No Boost"}
              </div>
              <div className="ds-boost-lbl">
                {data.activeboostTier ? `+${data.boostEPBonus}% EP bonus` : "Tap to boost"}
              </div>
            </div>
          </div>
          {/* [FIX-NAV] navigate("rewards") → App overlay */}
          <div className="ds-boost-card"
            style={{ border:`1px solid ${rcolor.fg}1a`, background:`${rcolor.fg}08` }}
            onClick={() => navigate("rewards")}
          >
            <div className="ds-boost-icon"
              style={{ background:`${rcolor.fg}14`, border:`1px solid ${rcolor.fg}22`, fontSize:14 }}
            >
              {rcolor.emoji}
            </div>
            <div style={{ flex:1, minWidth:0 }}>
              <div className="ds-boost-val" style={{ color: rcolor.fg, textTransform:"capitalize" }}>
                {rlevel === "none" ? "No Reward" : rlevel}
              </div>
              <div className="ds-boost-lbl">Reward level</div>
            </div>
          </div>
        </div>

        {/* ── STREAK + VERIFICATION ── */}
        <div style={{ display:"flex", gap:7, padding:"8px 12px 0" }}>
          <div style={{
            flex:1, padding:"10px 12px", borderRadius:11,
            background:"rgba(249,115,22,0.04)", border:"1px solid rgba(249,115,22,0.13)",
            display:"flex", alignItems:"center", gap:9
          }}>
            <span style={{ fontSize:18, animation:"dsFlame 1.6s ease-in-out infinite", display:"block" }}>🔥</span>
            <div>
              <div style={{ fontSize:20, fontWeight:900, color:"#f97316", lineHeight:1 }}>{data.loginStreak}</div>
              <div style={{ fontSize:8.5, color:"#484848", fontWeight:600 }}>Day Streak</div>
            </div>
          </div>
          <div style={{
            flex:1, padding:"10px 12px", borderRadius:11,
            background:"rgba(132,204,22,0.04)", border:"1px solid rgba(132,204,22,0.12)",
            display:"flex", alignItems:"center", gap:9
          }}>
            <Shield size={16} color="#84cc16" />
            <div>
              <div style={{ fontSize:14, fontWeight:900, color:"#84cc16", lineHeight:1 }}>
                {isVerified ? "Verified" : "Unverified"}
              </div>
              <div style={{ fontSize:8.5, color:"#484848", fontWeight:600 }}>Account status</div>
            </div>
          </div>
        </div>

        {/* ── FINANCIAL (savings/staking) ── */}
        {(data.activeSavings > 0 || data.activeStaking > 0) && (<>
          <p className="ds-sec">Finance</p>
          <div className="ds-finance-row">
            {data.activeSavings > 0 && (
              <div className="ds-fin-card">
                <div className="ds-fin-icon" style={{ background:"rgba(52,211,153,0.1)", border:"1px solid rgba(52,211,153,0.2)" }}>
                  <Wallet size={12} color="#34d399" />
                </div>
                <div>
                  <div className="ds-fin-val" style={{ color:"#34d399" }}>{fmtCurrency(data.activeSavings)}</div>
                  <div className="ds-fin-lbl">Active Savings</div>
                </div>
              </div>
            )}
            {data.activeStaking > 0 && (
              <div className="ds-fin-card">
                <div className="ds-fin-icon" style={{ background:"rgba(167,139,250,0.1)", border:"1px solid rgba(167,139,250,0.2)" }}>
                  <Award size={12} color="#a78bfa" />
                </div>
                <div>
                  <div className="ds-fin-val" style={{ color:"#a78bfa" }}>{fmtCurrency(data.activeStaking)}</div>
                  <div className="ds-fin-lbl">Staking</div>
                </div>
              </div>
            )}
          </div>
        </>)}

        {/* ── COMMUNITIES ── [FIX-NAV] navigate("community") */}
        <div className="ds-comm-chip" onClick={() => navigate("community")}>
          <div className="ds-comm-icon"><Hash size={12} color="#34d399" /></div>
          <div style={{ flex:1 }}>
            <div className="ds-comm-val"><AnimVal raw={data.communities} /></div>
            <div className="ds-comm-lbl">Communities joined</div>
          </div>
          <LiveDot color="#34d399" size={4} />
          <ChevronRight size={11} color="#34d399" style={{ opacity:0.45 }} />
        </div>

        {/* ── QUICK ACTIONS — [FIX-NAV] every onClick uses navigate() ── */}
        <p className="ds-sec">Quick Actions</p>
        <div className="ds-qa-grid">
          {/* Overlay tabs → App handleTabChange → setOverlayTab */}
          <QuickAction emoji="📊" label="Analytics"    sub="Full stats"        color="#a78bfa" onClick={() => navigate("analytics")}     idx={0} />
          <QuickAction emoji="🎁" label="Rewards"      sub="Levels & revenue"  color="#84cc16" onClick={() => navigate("rewards")}       idx={1} />
          <QuickAction emoji="💳" label="Gift Cards"   sub="Buy & send"        color="#34d399" onClick={() => navigate("giftcards")}     idx={2} />
          <QuickAction emoji="🔴" label="Go Live"      sub="Start stream"      color="#fb7185" onClick={() => navigate("stream")}        idx={3} />
          {/* Account-internal tabs → setActiveTab (stays in AccountView) */}
          <QuickAction emoji="⚙️" label="Settings"    sub="Profile & privacy" color="#737373" onClick={() => navigate("settings")}     idx={4} />
          {/* Saved — special handler */}
          <QuickAction emoji="🔖" label="Saved"        sub="Bookmarks"         color="#fbbf24" onClick={() => navigate("saved")}         idx={5} />
          {/* Real main tabs → App handleTabChange → setActiveTab */}
          <QuickAction emoji="💰" label="Wallet"       sub="EP & transactions" color="#60a5fa" onClick={() => navigate("wallet")}        idx={6} />
          {/* Pseudo-tab → App handleTabChange → setShowNotifications */}
          <QuickAction emoji="🔔" label="Notifications" sub="Alerts & updates" color="#f87171" onClick={() => navigate("notifications")} idx={7} badge={data.unreadNotifs} />
        </div>

        {/* ── UPGRADE BANNER (non-pro) — [FIX-NAV] navigate("upgrade") */}
        {!isPro && (
          <div className="ds-upgrade" onClick={() => navigate("upgrade")}>
            <div className="ds-upgrade-icon">👑</div>
            <div style={{ flex:1 }}>
              <p style={{ fontSize:13, fontWeight:900, color:"#fbbf24", margin:"0 0 1px" }}>Upgrade your profile</p>
              <p style={{ fontSize:10, color:"#484848", margin:0 }}>Unlock Silver, Gold or Diamond boost</p>
            </div>
            <ChevronRight size={12} color="#fbbf24" />
          </div>
        )}

      </>)}
    </div>
  );
};

export default DashboardSection;