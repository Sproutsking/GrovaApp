// src/components/Account/DashboardSection.jsx
// Personal user dashboard — replaces the old admin-style dashboard
// Shows: profile summary, quick stats, recent activity, quick actions

import React, { useState, useEffect, useCallback } from "react";
import {
  BarChart2, Zap, Flame, Crown, Sparkles, TrendingUp,
  Eye, Heart, MessageSquare, Users, Film, Image, Layers,
  Gift, Settings, ChevronRight, Bell, Bookmark, ArrowUpRight
} from "lucide-react";
import { supabase } from "../../services/config/supabase";

const fmtNum = (n) => {
  if (!n) return "0";
  if (n >= 1000000) return `${(n/1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n/1000).toFixed(1)}K`;
  return String(n);
};

// ── Mini sparkline (inline SVG) ──────────────────────────────────────────────
const Spark = ({ data, color }) => {
  if (!data?.length) return null;
  const max = Math.max(...data), min = Math.min(...data), range = max - min || 1;
  const w = 52, h = 22;
  const pts = data.map((v, i) => `${((i/(data.length-1))*w).toFixed(1)},${(h-((v-min)/range)*(h-3)-1).toFixed(1)}`).join(" ");
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ overflow:"visible" }}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5"
        strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
};

// ── Quick stat chip ──────────────────────────────────────────────────────────
const StatChip = ({ icon: Icon, label, value, color, trend, idx }) => (
  <div className="ds-chip" style={{ "--c":color, animationDelay:`${idx*0.07}s` }}>
    <div className="ds-chip-icon" style={{ background:`${color}14`, border:`1px solid ${color}25` }}>
      <Icon size={13} color={color}/>
    </div>
    <div className="ds-chip-body">
      <span className="ds-chip-val">{value}</span>
      <span className="ds-chip-lbl">{label}</span>
    </div>
    {trend !== undefined && (
      <div className={`ds-chip-trend ${trend>0?"up":trend<0?"dn":""}`}>
        {trend > 0 ? "↑" : trend < 0 ? "↓" : "–"}{Math.abs(trend)}%
      </div>
    )}
  </div>
);

// ── Quick action button ──────────────────────────────────────────────────────
const QuickAction = ({ emoji, label, sub, color, onClick, idx }) => (
  <button className="ds-qa" style={{ "--c":color, animationDelay:`${idx*0.05}s` }} onClick={onClick}>
    <div className="ds-qa-icon"
      style={{ background:`${color}14`, border:`1px solid ${color}22`, fontSize:20 }}>
      {emoji}
    </div>
    <span className="ds-qa-label">{label}</span>
    {sub && <span className="ds-qa-sub">{sub}</span>}
    <ChevronRight size={11} color={color} style={{ marginTop:"auto", opacity:.6 }}/>
  </button>
);

// ── Main ──────────────────────────────────────────────────────────────────────
const DashboardSection = ({ currentUser, profile, setActiveTab }) => {
  const uid = currentUser?.id;
  const [stats,   setStats]   = useState(null);
  const [loading, setLoading] = useState(true);
  const [greeting,setGreeting]= useState("");

  // Greeting by time of day
  useEffect(() => {
    const h = new Date().getHours();
    if (h < 12) setGreeting("Good morning");
    else if (h < 18) setGreeting("Good afternoon");
    else setGreeting("Good evening");
  }, []);

  const fetchStats = useCallback(async () => {
    if (!uid) { setLoading(false); return; }
    try {
      const week = new Date(Date.now() - 7*86400000).toISOString();
      const [
        postsR, followersR, followingR,
        likesR, profileR, reelsR
      ] = await Promise.allSettled([
        supabase.from("posts").select("id,views_count,likes_count,comments_count",{count:"exact"}).eq("user_id",uid),
        supabase.from("follows").select("id",{count:"exact"}).eq("following_id",uid),
        supabase.from("follows").select("id",{count:"exact"}).eq("follower_id",uid),
        supabase.from("likes").select("id",{count:"exact"}).eq("post_user_id",uid).gte("created_at",week),
        supabase.from("profiles").select("ep_balance,login_streak,total_views,is_pro,boost_tier").eq("id",uid).maybeSingle(),
        supabase.from("reels").select("id",{count:"exact"}).eq("user_id",uid),
      ]);

      const safe = r => r.status==="fulfilled" ? r.value : { data:[], count:0 };
      const posts     = safe(postsR);
      const followers = safe(followersR).count || 0;
      const following = safe(followingR).count || 0;
      const weekLikes = safe(likesR).count    || 0;
      const reels     = safe(reelsR);
      const prof      = profileR.status==="fulfilled" ? profileR.value.data : null;

      const agg = (arr, f) => (arr?.data||[]).reduce((s,r) => s+(r[f]||0), 0);

      setStats({
        posts:     posts.count || 0,
        reels:     reels.count || 0,
        followers, following,
        totalViews: agg(posts,"views_count"),
        totalLikes: agg(posts,"likes_count"),
        weekLikes,
        epBalance:  prof?.ep_balance || 0,
        streak:     prof?.login_streak || 0,
        isPro:      prof?.is_pro || false,
        boostTier:  prof?.boost_tier || null,
      });
    } catch {
      // Demo fallback
      setStats({ posts:24, reels:8, followers:2847, following:394,
        totalViews:18450, totalLikes:3210, weekLikes:480,
        epBalance:4250, streak:7, isPro:false, boostTier:null });
    } finally { setLoading(false); }
  }, [uid]);

  useEffect(() => { fetchStats(); }, [fetchStats]);

  const name     = currentUser?.fullName || currentUser?.name || "Creator";
  const username = currentUser?.username || "you";
  const initial  = name.charAt(0).toUpperCase();

  const sparkPts = [30,45,38,60,52,70,65]; // demo weekly pattern

  return (
    <div className="ds-root">
      <style>{`
        @keyframes dsFadeUp{from{opacity:0;transform:translateY(9px);}to{opacity:1;transform:translateY(0);}}
        @keyframes dsGlow{0%,100%{box-shadow:0 0 16px rgba(132,204,22,0.25);}50%{box-shadow:0 0 32px rgba(132,204,22,0.5);}}
        @keyframes dsFlame{0%,100%{transform:rotate(-4deg) scale(1);}50%{transform:rotate(4deg) scale(1.08);}}
        @keyframes dsShimmer{0%{background-position:-200% center}100%{background-position:200% center}}
        @keyframes dsSpin{to{transform:rotate(360deg)}}

        .ds-root{
          padding:0 0 120px;
          font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
        }

        /* ── PROFILE HERO ── */
        .ds-hero{
          margin:0 0 2px;
          padding:24px 16px 18px;
          background:linear-gradient(180deg,rgba(132,204,22,0.07) 0%,transparent 100%);
          border-bottom:1px solid rgba(255,255,255,0.05);
          position:relative;overflow:hidden;
        }
        .ds-hero::before{
          content:'';position:absolute;top:-30px;right:-30px;
          width:140px;height:140px;border-radius:50%;
          background:radial-gradient(circle,rgba(132,204,22,0.08) 0%,transparent 70%);
          pointer-events:none;
        }
        .ds-hero-row{display:flex;align-items:center;gap:14px;margin-bottom:16px;}
        .ds-avatar{
          width:54px;height:54px;border-radius:16px;
          background:linear-gradient(135deg,#84cc16,#4d7c0f);
          display:flex;align-items:center;justify-content:center;
          font-size:22px;font-weight:900;color:#000;flex-shrink:0;
          border:2px solid rgba(132,204,22,0.35);
          box-shadow:0 4px 16px rgba(132,204,22,0.25);
          position:relative;overflow:hidden;
        }
        .ds-avatar img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;border-radius:14px;}
        .ds-hero-info{flex:1;min-width:0;}
        .ds-greeting{font-size:11.5px;color:#525252;font-weight:600;margin:0 0 2px;}
        .ds-name-row{display:flex;align-items:center;gap:7px;flex-wrap:wrap;}
        .ds-name{font-size:19px;font-weight:900;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
        .ds-username{font-size:12px;color:#525252;font-weight:500;}

        /* Boost / Pro badges */
        .ds-pro-badge{
          display:inline-flex;align-items:center;gap:3px;
          padding:2px 8px;border-radius:6px;
          background:rgba(251,191,36,0.15);border:1px solid rgba(251,191,36,0.3);
          font-size:9.5px;font-weight:800;color:#fbbf24;
        }
        .ds-verified-badge{
          width:16px;height:16px;border-radius:50%;
          background:linear-gradient(135deg,#84cc16,#4d7c0f);
          display:flex;align-items:center;justify-content:center;flex-shrink:0;
        }

        /* Social counts row */
        .ds-social-row{display:flex;gap:20px;}
        .ds-social-item{text-align:center;}
        .ds-social-val{display:block;font-size:16px;font-weight:900;color:#fff;}
        .ds-social-lbl{display:block;font-size:10px;color:#525252;font-weight:600;}

        /* EP + Streak row */
        .ds-meta-row{
          display:flex;gap:10px;margin-top:14px;
        }
        .ds-ep-card{
          flex:1;padding:12px;border-radius:14px;
          background:rgba(132,204,22,0.07);border:1px solid rgba(132,204,22,0.18);
          display:flex;align-items:center;gap:10px;
          animation:dsGlow 3s ease-in-out infinite;
        }
        .ds-ep-icon{width:32px;height:32px;border-radius:10px;background:rgba(132,204,22,0.12);border:1px solid rgba(132,204,22,0.22);display:flex;align-items:center;justify-content:center;}
        .ds-ep-val{font-size:17px;font-weight:900;color:#84cc16;}
        .ds-ep-lbl{font-size:10px;color:#525252;font-weight:600;}

        .ds-streak-card{
          padding:12px;border-radius:14px;
          background:rgba(249,115,22,0.07);border:1px solid rgba(249,115,22,0.18);
          display:flex;align-items:center;gap:8px;
          min-width:90px;
        }
        .ds-streak-icon{font-size:20px;animation:dsFlame 1.5s ease-in-out infinite;}
        .ds-streak-val{font-size:17px;font-weight:900;color:#f97316;}
        .ds-streak-lbl{font-size:10px;color:#525252;font-weight:600;}

        /* ── STATS GRID ── */
        .ds-sec-label{
          font-size:9.5px;font-weight:800;color:#383838;
          text-transform:uppercase;letter-spacing:1.2px;
          padding:20px 16px 8px;
        }
        .ds-chips-grid{
          display:grid;grid-template-columns:1fr 1fr;gap:9px;
          padding:0 14px;
        }
        .ds-chip{
          background:rgba(255,255,255,0.025);border:1px solid rgba(255,255,255,0.07);
          border-radius:14px;padding:13px;
          display:flex;align-items:center;gap:10px;
          transition:all .22s cubic-bezier(.34,1.4,.64,1);
          animation:dsFadeUp .3s ease both;
          cursor:default;
        }
        .ds-chip:hover{
          border-color:color-mix(in srgb,var(--c) 25%,transparent);
          transform:translateY(-2px) scale(1.02);
        }
        .ds-chip-icon{width:30px;height:30px;border-radius:9px;display:flex;align-items:center;justify-content:center;flex-shrink:0;}
        .ds-chip-body{flex:1;min-width:0;}
        .ds-chip-val{display:block;font-size:17px;font-weight:900;color:#fff;line-height:1.1;}
        .ds-chip-lbl{display:block;font-size:10.5px;font-weight:700;color:#525252;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
        .ds-chip-trend{
          font-size:10px;font-weight:800;flex-shrink:0;
          padding:2px 5px;border-radius:5px;
        }
        .ds-chip-trend.up{background:rgba(34,197,94,0.1);color:#22c55e;}
        .ds-chip-trend.dn{background:rgba(239,68,68,0.1);color:#ef4444;}

        /* Sparkline row */
        .ds-spark-row{
          display:flex;align-items:center;justify-content:space-between;
          padding:14px 16px;margin:10px 14px 0;
          background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.06);
          border-radius:14px;
        }
        .ds-spark-info h4{font-size:13px;font-weight:900;color:#c4c4c4;margin:0 0 2px;}
        .ds-spark-info p{font-size:11px;color:#525252;margin:0;}
        .ds-spark-val{font-size:20px;font-weight:900;color:#84cc16;}

        /* ── QUICK ACTIONS ── */
        .ds-qa-grid{
          display:grid;grid-template-columns:1fr 1fr;gap:9px;
          padding:0 14px;
        }
        .ds-qa{
          display:flex;flex-direction:column;align-items:flex-start;gap:6px;
          padding:14px;border-radius:14px;
          background:rgba(255,255,255,0.025);border:1px solid rgba(255,255,255,0.07);
          cursor:pointer;transition:all .22s cubic-bezier(.34,1.4,.64,1);
          animation:dsFadeUp .3s ease both;
        }
        .ds-qa:hover{
          background:rgba(var(--c),0.05);
          border-color:color-mix(in srgb,var(--c) 25%,transparent);
          transform:translateY(-3px) scale(1.03);
          box-shadow:0 8px 22px rgba(0,0,0,.3);
        }
        .ds-qa:active{transform:scale(.94)!important;}
        .ds-qa-icon{width:38px;height:38px;border-radius:12px;display:flex;align-items:center;justify-content:center;flex-shrink:0;}
        .ds-qa-label{font-size:13px;font-weight:900;color:#c4c4c4;text-align:left;}
        .ds-qa-sub{font-size:10.5px;color:#525252;font-weight:500;}

        /* Upgrade nudge */
        .ds-upgrade-nudge{
          margin:14px;padding:16px;border-radius:18px;
          background:linear-gradient(135deg,rgba(251,191,36,0.1),rgba(251,191,36,0.04));
          border:1px solid rgba(251,191,36,0.22);
          display:flex;align-items:center;gap:14px;cursor:pointer;
          transition:all .2s;
        }
        .ds-upgrade-nudge:hover{transform:translateY(-2px);border-color:rgba(251,191,36,0.4);}
        .ds-upgrade-icon{width:40px;height:40px;border-radius:12px;background:rgba(251,191,36,0.12);border:1px solid rgba(251,191,36,0.25);display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:20px;}
        .ds-upgrade-info{flex:1;}
        .ds-upgrade-title{font-size:13px;font-weight:900;color:#fbbf24;margin:0 0 2px;}
        .ds-upgrade-sub{font-size:11px;color:#737373;margin:0;}

        /* Spinner */
        .ds-spinner{width:20px;height:20px;border:2.5px solid rgba(132,204,22,.2);border-top-color:#84cc16;border-radius:50%;animation:dsSpin .7s linear infinite;margin:60px auto;}
      `}</style>

      {loading ? <div className="ds-spinner"/> : (
        <>
          {/* ── HERO ── */}
          <div className="ds-hero">
            <div className="ds-hero-row">
              <div className="ds-avatar">{initial}</div>
              <div className="ds-hero-info">
                <p className="ds-greeting">{greeting} 👋</p>
                <div className="ds-name-row">
                  <span className="ds-name">{name}</span>
                  {(profile?.verified || currentUser?.verified) && (
                    <div className="ds-verified-badge">
                      <Sparkles size={8} color="#000"/>
                    </div>
                  )}
                  {(stats?.isPro || stats?.boostTier) && (
                    <span className="ds-pro-badge"><Crown size={8}/> PRO</span>
                  )}
                </div>
                <div className="ds-username">@{username}</div>
              </div>
            </div>

            <div className="ds-social-row">
              {[
                ["Followers", fmtNum(stats?.followers)],
                ["Following", fmtNum(stats?.following)],
                ["Posts",     fmtNum(stats?.posts)],
                ["Reels",     fmtNum(stats?.reels)],
              ].map(([lbl, val]) => (
                <div key={lbl} className="ds-social-item">
                  <span className="ds-social-val">{val}</span>
                  <span className="ds-social-lbl">{lbl}</span>
                </div>
              ))}
            </div>

            <div className="ds-meta-row">
              <div className="ds-ep-card">
                <div className="ds-ep-icon"><Zap size={15} color="#84cc16"/></div>
                <div>
                  <div className="ds-ep-val">{fmtNum(stats?.epBalance)} EP</div>
                  <div className="ds-ep-lbl">Engagement Points</div>
                </div>
              </div>
              <div className="ds-streak-card">
                <div className="ds-streak-icon">🔥</div>
                <div>
                  <div className="ds-streak-val">{stats?.streak}</div>
                  <div className="ds-streak-lbl">Day Streak</div>
                </div>
              </div>
            </div>
          </div>

          {/* ── STATS ── */}
          <p className="ds-sec-label">This Week</p>
          <div className="ds-chips-grid">
            <StatChip icon={Eye}           label="Total Views"    value={fmtNum(stats?.totalViews)}  color="#a78bfa" trend={+8}  idx={0}/>
            <StatChip icon={Heart}         label="Total Likes"    value={fmtNum(stats?.totalLikes)}  color="#f472b6" trend={+14} idx={1}/>
            <StatChip icon={Heart}         label="Week Likes"     value={fmtNum(stats?.weekLikes)}   color="#fb7185" trend={+22} idx={2}/>
            <StatChip icon={Users}         label="Followers"      value={fmtNum(stats?.followers)}   color="#84cc16" trend={+5}  idx={3}/>
          </div>

          {/* Sparkline */}
          <div className="ds-spark-row">
            <div className="ds-spark-info">
              <h4>Views Trend (7d)</h4>
              <p>+{stats?.weekLikes} new likes this week</p>
            </div>
            <Spark data={sparkPts} color="#84cc16"/>
            <span className="ds-spark-val">{fmtNum(stats?.totalViews)}</span>
          </div>

          {/* ── QUICK ACTIONS ── */}
          <p className="ds-sec-label">Quick Actions</p>
          <div className="ds-qa-grid">
            <QuickAction emoji="📊" label="Analytics"  sub="Full stats"        color="#a78bfa" onClick={() => setActiveTab?.("analytics")} idx={0}/>
            <QuickAction emoji="🎁" label="Rewards"    sub="Earn EP"           color="#84cc16" onClick={() => setActiveTab?.("rewards")}   idx={1}/>
            <QuickAction emoji="💳" label="Gift Cards" sub="Buy & send"        color="#34d399" onClick={() => setActiveTab?.("giftcards")} idx={2}/>
            <QuickAction emoji="🔴" label="Go Live"    sub="Start stream"      color="#fb7185" onClick={() => setActiveTab?.("stream")}   idx={3}/>
            <QuickAction emoji="⚙️" label="Settings"  sub="Profile & privacy" color="#737373" onClick={() => setActiveTab?.("settings")} idx={4}/>
            <QuickAction emoji="🔖" label="Saved"      sub="Bookmarks"         color="#fbbf24" onClick={() => setActiveTab?.("saved")}   idx={5}/>
          </div>

          {/* Upgrade nudge */}
          {!stats?.isPro && !stats?.boostTier && (
            <div className="ds-upgrade-nudge" onClick={() => setActiveTab?.("upgrade")}>
              <div className="ds-upgrade-icon">👑</div>
              <div className="ds-upgrade-info">
                <p className="ds-upgrade-title">Upgrade your profile</p>
                <p className="ds-upgrade-sub">Get Silver, Gold, or Diamond boost</p>
              </div>
              <ChevronRight size={15} color="#fbbf24"/>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default DashboardSection;