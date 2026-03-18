// src/components/Rewards/RewardsView.jsx — v3 LEVEL_SYSTEM
// ============================================================================
// CHANGES vs v2:
//  [REFORM] Daily tasks no longer directly mint EP. Completing tasks
//           contributes to your activity metrics which determine your reward
//           LEVEL (silver/gold/diamond). Each level earns a % share of
//           weekly ecosystem revenue, distributed as EP backed by real money.
//           This prevents unbacked EP inflation.
//
//  [NEW] LevelSystemView — shows Silver/Gold/Diamond criteria, user's
//        current progress toward each level, and the weekly revenue share.
//
//  [NEW] get_user_level_progress RPC called to fetch real level data.
//
//  [KEPT] Deposit flow ($1=100EP backed by real money) — unchanged.
//  [KEPT] Redeem/spend EP — unchanged.
//  [KEPT] Weekly quality bonus — kept as small incentive (10 EP) since it
//         requires real engagements, not free minting.
//  [CHANGED] Daily tasks: now called "Activity Tracker" — completion is
//             tracked for level eligibility but gives 0 direct EP mint.
//             Only the login task still gives 1 EP as a micro-reward since
//             it's negligible and creates habit.
// ============================================================================

import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  X, Zap, Flame, CheckCircle, Lock, ChevronRight, ChevronDown,
  Image, Film, Heart, Crown, TrendingUp, AlertCircle, Wallet,
  Trophy, Sparkles, Gift, ArrowUpRight, Star, Target, Shield,
  Award, Users, Activity, TrendingDown,
} from "lucide-react";
import { supabase } from "../../services/config/supabase";
import {
  getRewardsProfile, getTodayTaskState, claimDailyTask,
  claimWeeklyBonus, spendEP, subscribeToEPBalance,
  WEEKLY_BONUS_EP, EP_PER_USD, PROTOCOL_FEE,
} from "../../services/rewards/rewardsService";

// ── Helpers ───────────────────────────────────────────────────────────────────
const EP = (n) => {
  const v = Number(n) || 0;
  if (v >= 1_000_000) return `${(v/1_000_000).toFixed(2)}M`;
  if (v >= 1_000)     return `${(v/1_000).toFixed(1)}K`;
  return String(v);
};

// ── Level configuration ───────────────────────────────────────────────────────
const LEVELS = {
  silver: {
    name:        "Silver",
    emoji:       "🥈",
    color:       "#d4d4d8",
    glow:        "rgba(212,212,216,0.3)",
    revenueShare: 2,
    criteria: [
      { key:"account_age_days",   label:"Account age",        target:14,    unit:"days",    desc:"Account must be ≥14 days old" },
      { key:"active_days_30",     label:"Active days (30d)",  target:15,    unit:"days",    desc:"Log in on ≥15 of the last 30 days" },
      { key:"qual_posts_2eng",    label:"Quality posts (30d)", target:3,    unit:"posts",   desc:"≥3 posts with ≥2 engagements each" },
      { key:"task_rate_pct",      label:"Task completion",    target:60,    unit:"%",       desc:"Complete ≥60% of possible daily tasks" },
    ],
  },
  gold: {
    name:        "Gold",
    emoji:       "🥇",
    color:       "#fbbf24",
    glow:        "rgba(251,191,36,0.3)",
    revenueShare: 5,
    requires:    "silver",
    holdDays:    30,
    criteria: [
      { key:"account_age_days",   label:"Account age",        target:45,    unit:"days",    desc:"Account must be ≥45 days old" },
      { key:"active_days_30",     label:"Active days (30d)",  target:22,    unit:"days",    desc:"Log in on ≥22 of the last 30 days" },
      { key:"qual_posts_5eng",    label:"Quality posts (30d)", target:8,    unit:"posts",   desc:"≥8 posts with ≥5 engagements each" },
      { key:"followers",          label:"Followers",           target:25,   unit:"followers",desc:"At least 25 followers" },
      { key:"task_rate_pct",      label:"Task completion",    target:80,    unit:"%",       desc:"Complete ≥80% of possible daily tasks" },
    ],
  },
  diamond: {
    name:        "Diamond",
    emoji:       "💎",
    color:       "#a78bfa",
    glow:        "rgba(167,139,250,0.3)",
    revenueShare: 10,
    requires:    "gold",
    holdDays:    30,
    criteria: [
      { key:"account_age_days",   label:"Account age",        target:90,    unit:"days",    desc:"Account must be ≥90 days old" },
      { key:"active_days_30",     label:"Active days (30d)",  target:28,    unit:"days",    desc:"Log in on ≥28 of the last 30 days" },
      { key:"qual_posts_10eng",   label:"Quality posts (30d)", target:15,   unit:"posts",   desc:"≥15 posts with ≥10 engagements each" },
      { key:"followers",          label:"Followers",           target:100,  unit:"followers",desc:"At least 100 followers" },
      { key:"task_rate_pct",      label:"Task completion",    target:95,    unit:"%",       desc:"Complete ≥95% of possible daily tasks" },
    ],
  },
};

const LEVEL_ORDER = ["none", "silver", "gold", "diamond"];

// ── Activity tasks (for level tracking — minimal direct EP) ──────────────────
const ACTIVITY_TASKS = [
  { id:"login",       Icon:Flame,  label:"Daily Login",      desc:"Shows up in active_days_30 criteria.",    giveEP:true,  ep:1, color:"#f97316" },
  { id:"post_create", Icon:Image,  label:"Publish a Post",   desc:"Boosts quality post count for your level.",giveEP:false, ep:0, color:"#84cc16" },
  { id:"reel_create", Icon:Film,   label:"Upload a Reel",    desc:"Content helps your engagement metrics.",   giveEP:false, ep:0, color:"#e879f9" },
  { id:"engage_5",    Icon:Heart,  label:"Engage 5 Posts",   desc:"Genuine engagement raises your score.",    giveEP:false, ep:0, color:"#f472b6" },
];

// Redeem catalog
const REDEEM = [
  { id:"boost24",  Icon:Zap,        label:"24h Visibility Boost",  cost:50,   color:"#84cc16", desc:"2× reach for 24 hours." },
  { id:"frame",    Icon:Star,       label:"Creator Frame",          cost:150,  color:"#60a5fa", desc:"Animated border on posts & profile." },
  { id:"gift50",   Icon:Gift,       label:"Send 50 EP Gift",        cost:52,   color:"#34d399", desc:"Gift 50 EP to any creator (2% fee)." },
  { id:"silver",   Icon:Trophy,     label:"Silver Badge · 3 days",  cost:300,  color:"#d4d4d8", desc:"Stand out in every comment." },
  { id:"gold",     Icon:Crown,      label:"Gold Badge · 3 days",    cost:800,  color:"#fbbf24", desc:"Priority discovery placement." },
  { id:"diamond",  Icon:Sparkles,   label:"Diamond Badge · 7 days", cost:2000, color:"#a78bfa", desc:"Maximum visibility for 7 days." },
  { id:"boost7",   Icon:TrendingUp, label:"7-Day Reach Amplifier",  cost:500,  color:"#f97316", desc:"Extended reach for an entire week." },
  { id:"featured", Icon:Star,       label:"Featured Creator Slot",  cost:5000, color:"#e879f9", desc:"Appear on Discover for 24 hours." },
];

// ── Hooks ─────────────────────────────────────────────────────────────────────
const useCount = (to, ms = 900) => {
  const [v, setV] = useState(0);
  const r = useRef(null);
  useEffect(() => {
    cancelAnimationFrame(r.current);
    const t0 = performance.now();
    const tick = (now) => {
      const p = Math.min((now - t0) / ms, 1);
      setV(Math.round(to * (1 - Math.pow(1 - p, 3))));
      if (p < 1) r.current = requestAnimationFrame(tick);
    };
    r.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(r.current);
  }, [to, ms]);
  return v;
};

async function fetchLoginStreak(uid) {
  try {
    const { data } = await supabase.from("daily_task_completions")
      .select("completed_at").eq("user_id", uid).eq("task_id", "login")
      .order("completed_at", { ascending: false }).limit(365);
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

function getMonday() {
  const d = new Date(); const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff); d.setHours(0, 0, 0, 0); return d;
}

// ── Toast ─────────────────────────────────────────────────────────────────────
const Toast = ({ msg, color = "#84cc16" }) => (
  <div style={{ position:"fixed", bottom:88, left:"50%", transform:"translateX(-50%)", padding:"10px 22px", borderRadius:14, background:`linear-gradient(135deg,${color},${color}cc)`, color:"#000", fontSize:12, fontWeight:900, zIndex:99999, pointerEvents:"none", whiteSpace:"nowrap", boxShadow:`0 6px 26px ${color}55`, animation:"rwToast 2.8s ease forwards" }}>
    {msg}
  </div>
);

// ── DepositSheet (unchanged) ──────────────────────────────────────────────────
const DepositSheet = ({ onClose, onSuccess }) => {
  const [amt, setAmt] = useState("5");
  const ep  = Math.floor((parseFloat(amt) || 0) * EP_PER_USD);
  const fee = Math.round(ep * PROTOCOL_FEE);
  const net = ep - fee;
  return (
    <div onClick={e => e.target === e.currentTarget && onClose()} style={{ position:"fixed", inset:0, zIndex:98000, background:"rgba(0,0,0,0.82)", backdropFilter:"blur(16px)", display:"flex", alignItems:"flex-end", justifyContent:"center" }}>
      <div style={{ background:"linear-gradient(180deg,#0e0e0e,#070707)", border:"1px solid rgba(255,255,255,0.09)", borderRadius:"22px 22px 0 0", width:"100%", maxWidth:500, padding:"0 0 44px", animation:"rwSheet .32s cubic-bezier(.34,1.56,.64,1)", boxShadow:"0 -20px 60px rgba(132,204,22,0.07)" }}>
        <div style={{ width:36, height:4, background:"rgba(255,255,255,0.1)", borderRadius:2, margin:"14px auto 22px" }} />
        <div style={{ padding:"0 22px" }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:22 }}>
            <div>
              <div style={{ fontSize:20, fontWeight:900, color:"#fff", letterSpacing:"-0.4px" }}>Deposit EP</div>
              <div style={{ fontSize:11, color:"#3a3a3a", marginTop:3 }}>$1 = 100 EP · 2% protocol fee · Backs the liquidity pool</div>
            </div>
            <button onClick={onClose} style={{ width:32, height:32, borderRadius:9, background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.08)", color:"#555", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center" }}><X size={14} /></button>
          </div>
          <div style={{ background:"rgba(132,204,22,0.05)", border:"1px solid rgba(132,204,22,0.16)", borderRadius:15, padding:"14px 16px", marginBottom:12 }}>
            <div style={{ fontSize:10, color:"#3a5c10", fontWeight:800, textTransform:"uppercase", letterSpacing:"1px", marginBottom:7 }}>Amount (USD)</div>
            <div style={{ display:"flex", alignItems:"center", gap:8 }}>
              <span style={{ fontSize:30, fontWeight:900, color:"#3a3a3a" }}>$</span>
              <input type="number" min="1" step="1" value={amt} onChange={e => setAmt(e.target.value)} style={{ fontSize:36, fontWeight:900, color:"#fff", background:"none", border:"none", outline:"none", flex:1, caretColor:"#84cc16", fontFamily:"inherit" }} />
            </div>
          </div>
          <div style={{ display:"flex", gap:7, marginBottom:16 }}>
            {[1,5,10,25,50].map(v => (
              <button key={v} onClick={() => setAmt(String(v))} style={{ flex:1, padding:"9px 4px", borderRadius:11, background:parseFloat(amt)===v?"rgba(132,204,22,0.12)":"rgba(255,255,255,0.03)", border:`1px solid ${parseFloat(amt)===v?"rgba(132,204,22,0.3)":"rgba(255,255,255,0.07)"}`, color:parseFloat(amt)===v?"#84cc16":"#555", fontSize:13, fontWeight:800, cursor:"pointer", fontFamily:"inherit", transition:"all .15s" }}>${v}</button>
            ))}
          </div>
          {ep > 0 && (
            <div style={{ background:"rgba(132,204,22,0.04)", border:"1px solid rgba(132,204,22,0.1)", borderRadius:13, padding:"12px 14px", marginBottom:14 }}>
              {[["EP credited",`+${ep} EP`,"#84cc16"],["Protocol fee (2%)",`−${fee} EP`,"#3a3a3a"]].map(([l,v,c]) => (
                <div key={l} style={{ display:"flex", justifyContent:"space-between", fontSize:12, color:"#555", marginBottom:6 }}><span>{l}</span><span style={{ color:c, fontWeight:800 }}>{v}</span></div>
              ))}
              <div style={{ height:1, background:"rgba(132,204,22,0.08)", marginBottom:7 }} />
              <div style={{ display:"flex", justifyContent:"space-between", fontSize:14, fontWeight:900 }}><span style={{ color:"#666" }}>You receive</span><span style={{ color:"#84cc16" }}>{net} EP</span></div>
            </div>
          )}
          <button onClick={() => { if (net > 0) { onSuccess(net); onClose(); } }} disabled={net<=0} style={{ width:"100%", padding:"14px", borderRadius:14, border:"none", background:net>0?"linear-gradient(135deg,#84cc16,#4d7c0f)":"rgba(255,255,255,0.04)", color:net>0?"#000":"#333", fontSize:14, fontWeight:900, cursor:net>0?"pointer":"not-allowed", fontFamily:"inherit", transition:"all .18s" }}>
            {net > 0 ? `Deposit $${amt} → Get ${net} EP` : "Enter amount"}
          </button>
        </div>
      </div>
    </div>
  );
};

// ── Criteria Progress Bar ─────────────────────────────────────────────────────
function CriteriaBar({ criterion, progress, color }) {
  const pct = Math.min((progress / criterion.target) * 100, 100);
  const met  = pct >= 100;
  return (
    <div style={{ marginBottom:10 }}>
      <div style={{ display:"flex", justifyContent:"space-between", fontSize:11, marginBottom:4 }}>
        <div style={{ display:"flex", alignItems:"center", gap:6 }}>
          {met
            ? <CheckCircle size={11} color="#22c55e" />
            : <div style={{ width:11, height:11, borderRadius:"50%", border:`1.5px solid ${color}40` }} />
          }
          <span style={{ color: met ? "#22c55e" : "#737373", fontWeight:700 }}>{criterion.label}</span>
        </div>
        <span style={{ color: met ? "#22c55e" : "#484848", fontWeight:800, fontSize:10 }}>
          {Math.min(progress, criterion.target)}{criterion.unit === "%" ? "" : ""} / {criterion.target}{criterion.unit === "%" ? "%" : ` ${criterion.unit}`}
        </span>
      </div>
      <div style={{ height:3, background:"rgba(255,255,255,0.05)", borderRadius:2, overflow:"hidden" }}>
        <div style={{ height:"100%", width:`${pct}%`, background:`linear-gradient(90deg,${color},${color}99)`, borderRadius:2, transition:"width .8s cubic-bezier(.4,0,.2,1)", boxShadow: met ? `0 0 6px ${color}` : "none" }} />
      </div>
      {!met && <div style={{ fontSize:9, color:"#2a2a2a", marginTop:2 }}>{criterion.desc}</div>}
    </div>
  );
}

// ── Level Card ────────────────────────────────────────────────────────────────
function LevelCard({ levelKey, levelData, progress, currentLevel, idx }) {
  const level     = LEVELS[levelKey];
  const isCurrent = currentLevel === levelKey;
  const isPassed  = LEVEL_ORDER.indexOf(currentLevel) > LEVEL_ORDER.indexOf(levelKey);
  const [expanded, setExpanded] = useState(isCurrent);

  const taskRatePct = Math.round(((progress?.tasks_14 || 0) / 56) * 100);
  const progressMap = {
    account_age_days:  progress?.account_age_days  || 0,
    active_days_30:    progress?.active_days_30    || 0,
    qual_posts_2eng:   progress?.qual_posts_2eng   || 0,
    qual_posts_5eng:   progress?.qual_posts_5eng   || 0,
    qual_posts_10eng:  progress?.qual_posts_10eng  || 0,
    followers:         progress?.followers         || 0,
    task_rate_pct:     taskRatePct,
  };

  const criteriaMet = level.criteria.filter(c => {
    const val = progressMap[c.key] || 0;
    return c.unit === "%" ? val >= c.target : val >= c.target;
  }).length;
  const total = level.criteria.length;

  return (
    <div style={{
      background:    isCurrent ? `${level.color}08` : isPassed ? "rgba(34,197,94,0.04)" : "rgba(255,255,255,0.02)",
      border:        `1px solid ${isCurrent ? level.color + "35" : isPassed ? "rgba(34,197,94,0.2)" : "rgba(255,255,255,0.06)"}`,
      borderRadius:  16,
      marginBottom:  12,
      overflow:      "hidden",
      animation:     `rwUp .3s ease ${idx * 0.07}s both`,
      transition:    "border-color .2s",
    }}>
      {/* Card header */}
      <div
        onClick={() => setExpanded(e => !e)}
        style={{ display:"flex", alignItems:"center", gap:14, padding:"16px 16px", cursor:"pointer", position:"relative", overflow:"hidden" }}
      >
        {isPassed && (
          <div style={{ position:"absolute", top:0, left:0, right:0, height:2, background:"linear-gradient(90deg,transparent,rgba(34,197,94,0.4),transparent)" }} />
        )}
        {isCurrent && (
          <div style={{ position:"absolute", top:0, left:0, right:0, height:2, background:`linear-gradient(90deg,transparent,${level.color}60,transparent)` }} />
        )}

        <div style={{ width:48, height:48, borderRadius:14, flexShrink:0, background:`${level.color}12`, border:`1px solid ${level.color}25`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:24, boxShadow: isCurrent ? `0 4px 16px ${level.glow}` : "none" }}>
          {level.emoji}
        </div>

        <div style={{ flex:1 }}>
          <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:4, flexWrap:"wrap" }}>
            <span style={{ fontSize:16, fontWeight:900, color: isCurrent ? level.color : isPassed ? "#22c55e" : "#737373" }}>
              {level.name}
            </span>
            {isCurrent && <span style={{ padding:"2px 8px", borderRadius:6, background:`${level.color}15`, border:`1px solid ${level.color}30`, color:level.color, fontSize:9, fontWeight:800 }}>YOUR LEVEL</span>}
            {isPassed && <span style={{ padding:"2px 8px", borderRadius:6, background:"rgba(34,197,94,0.1)", border:"1px solid rgba(34,197,94,0.2)", color:"#22c55e", fontSize:9, fontWeight:800 }}>✓ ACHIEVED</span>}
          </div>
          <div style={{ fontSize:12, color:"#525252" }}>
            Earns <span style={{ color:level.color, fontWeight:800 }}>{level.revenueShare}%</span> of weekly ecosystem revenue
            {level.holdDays && !isCurrent && !isPassed && (
              <span style={{ color:"#383838" }}> · Requires {level.holdDays}d at {LEVELS[level.requires]?.name}</span>
            )}
          </div>
        </div>

        <div style={{ textAlign:"right", flexShrink:0 }}>
          <div style={{ fontSize:18, fontWeight:900, color: criteriaMet === total ? (isPassed ? "#22c55e" : level.color) : "#383838" }}>
            {criteriaMet}/{total}
          </div>
          <div style={{ fontSize:9, color:"#383838", fontWeight:700 }}>criteria met</div>
        </div>

        <ChevronDown size={14} color="#383838" style={{ flexShrink:0, transform: expanded ? "rotate(180deg)" : "none", transition:"transform .2s" }} />
      </div>

      {/* Expanded criteria */}
      {expanded && (
        <div style={{ padding:"0 16px 16px", borderTop:"1px solid rgba(255,255,255,0.05)" }}>
          <div style={{ paddingTop:14 }}>
            {level.holdDays && level.requires && (
              <div style={{ display:"flex", alignItems:"center", gap:7, padding:"8px 10px", borderRadius:9, background:"rgba(255,255,255,0.02)", border:"1px solid rgba(255,255,255,0.05)", marginBottom:12 }}>
                <AlertCircle size={11} color="#383838" />
                <span style={{ fontSize:10, color:"#484848" }}>
                  Must hold <span style={{ color:LEVELS[level.requires]?.color, fontWeight:700 }}>{LEVELS[level.requires]?.name}</span> for ≥{level.holdDays} days before qualifying.
                </span>
              </div>
            )}
            {level.criteria.map(c => (
              <CriteriaBar key={c.key} criterion={c} progress={progressMap[c.key] || 0} color={level.color} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Activity Task Card ────────────────────────────────────────────────────────
const ActivityCard = ({ task, done, count = 0, onClaim, idx }) => {
  const progress = task.cap > 1 ? Math.min(count / (task.cap || 1), 1) : done ? 1 : 0;
  return (
    <div style={{ background:"rgba(255,255,255,0.02)", border:`1px solid ${done ? "rgba(34,197,94,0.1)" : "rgba(255,255,255,0.07)"}`, borderRadius:14, padding:"13px 14px", display:"flex", alignItems:"center", gap:12, marginBottom:8, opacity:done ? 0.55 : 1, animation:`rwUp .3s ease ${idx*0.05}s both` }}>
      <div style={{ width:40, height:40, borderRadius:12, flexShrink:0, background:done?"rgba(34,197,94,0.07)":`${task.color}10`, border:`1px solid ${done?"rgba(34,197,94,0.18)":task.color+"28"}`, display:"flex", alignItems:"center", justifyContent:"center" }}>
        {done ? <CheckCircle size={18} color="#22c55e" /> : <task.Icon size={18} color={task.color} />}
      </div>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontSize:13, fontWeight:800, color:done?"#484848":"#d4d4d4", marginBottom:2 }}>{task.label}</div>
        <div style={{ fontSize:11, color:"#383838" }}>{task.desc}</div>
      </div>
      <div style={{ flexShrink:0, textAlign:"right" }}>
        {task.giveEP
          ? <div style={{ fontSize:12, fontWeight:900, color:task.color, marginBottom:5 }}>+{task.ep} EP</div>
          : <div style={{ fontSize:10, fontWeight:700, color:"#383838", marginBottom:5 }}>Level XP</div>
        }
        <button onClick={() => !done && onClaim(task.id)} disabled={done || !task.giveEP}
          style={{ padding:"4px 11px", borderRadius:8, background:done?"rgba(34,197,94,0.07)":task.giveEP?`${task.color}14`:"rgba(255,255,255,0.03)", border:`1px solid ${done?"rgba(34,197,94,0.16)":task.giveEP?task.color+"28":"rgba(255,255,255,0.06)"}`, color:done?"#22c55e":task.giveEP?task.color:"#383838", fontSize:10, fontWeight:800, cursor:done||!task.giveEP?"default":"pointer", fontFamily:"inherit" }}>
          {done ? "Done ✓" : task.giveEP ? "Claim" : "Tracked"}
        </button>
      </div>
    </div>
  );
};

// ── Redeem Card ───────────────────────────────────────────────────────────────
const RedeemCard = ({ item, balance, onRedeem, idx }) => {
  const can = balance >= item.cost;
  return (
    <div onClick={() => can && onRedeem(item)} style={{ display:"flex", alignItems:"center", gap:13, padding:"13px 14px", background:can?"rgba(255,255,255,0.025)":"rgba(255,255,255,0.012)", border:`1px solid ${can?"rgba(255,255,255,0.07)":"rgba(255,255,255,0.03)"}`, borderRadius:15, marginBottom:8, opacity:can?1:0.3, cursor:can?"pointer":"not-allowed", transition:"all .2s", animation:`rwUp .3s ease ${idx*0.05}s both` }}
      onMouseEnter={e => can && (e.currentTarget.style.borderColor=`${item.color}35`)}
      onMouseLeave={e => can && (e.currentTarget.style.borderColor="rgba(255,255,255,0.07)")}
    >
      <div style={{ width:46, height:46, borderRadius:14, flexShrink:0, background:`${item.color}10`, border:`1px solid ${item.color}20`, display:"flex", alignItems:"center", justifyContent:"center" }}>
        <item.Icon size={21} color={item.color} />
      </div>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontSize:13, fontWeight:800, color:"#d4d4d4", marginBottom:2 }}>{item.label}</div>
        <div style={{ fontSize:11, color:"#383838", marginBottom:5 }}>{item.desc}</div>
        <div style={{ display:"flex", alignItems:"center", gap:4 }}>
          <Zap size={9} color={can?item.color:"#333"} />
          <span style={{ fontSize:11, fontWeight:800, color:can?item.color:"#333" }}>{EP(item.cost)} EP</span>
        </div>
      </div>
      <div style={{ width:34, height:34, borderRadius:11, flexShrink:0, background:can?`linear-gradient(135deg,${item.color},${item.color}99)`:"rgba(255,255,255,0.04)", display:"flex", alignItems:"center", justifyContent:"center" }}>
        {can ? <ChevronRight size={16} color="#000" /> : <Lock size={13} color="#333" />}
      </div>
    </div>
  );
};

// ── MAIN ──────────────────────────────────────────────────────────────────────
const RewardsView = ({ currentUser, userId, onClose, isSidebar = false }) => {
  const uid = userId || currentUser?.id;

  const [tab,           setTab]          = useState("levels");
  const [balance,       setBalance]      = useState(0);
  const [streak,        setStreak]       = useState(0);
  const [loading,       setLoading]      = useState(true);
  const [claimed,       setClaimed]      = useState(new Set());
  const [counts,        setCounts]       = useState({});
  const [weeklyQual,    setWeeklyQual]   = useState(false);
  const [weeklyDone,    setWeeklyDone]   = useState(false);
  const [showDeposit,   setShowDeposit]  = useState(false);
  const [toast,         setToast]        = useState(null);
  const [showAllRedeem, setShowAllRedeem]= useState(false);
  const [claimingTask,  setClaimingTask] = useState(null);
  const [levelProgress, setLevelProgress]= useState(null);
  const [currentLevel,  setCurrentLevel] = useState("none");
  const [weeklyPool,    setWeeklyPool]   = useState(null);
  const realtimeSub                      = useRef(null);

  const flash = useCallback((msg, color = "#84cc16") => {
    setToast({ msg, color }); setTimeout(() => setToast(null), 2800);
  }, []);

  const fetchData = useCallback(async () => {
    if (!uid) { setLoading(false); return; }
    try {
      const [profileRes, taskStateRes, streakRes] = await Promise.allSettled([
        getRewardsProfile(uid),
        getTodayTaskState(uid),
        fetchLoginStreak(uid),
      ]);

      if (profileRes.status === "fulfilled") setBalance(profileRes.value.balance);
      if (taskStateRes.status === "fulfilled") {
        setClaimed(taskStateRes.value.claimed);
        setCounts(taskStateRes.value.counts);
      }
      if (streakRes.status === "fulfilled") setStreak(streakRes.value);

      // Weekly bonus check
      const monday = getMonday();
      const { data: weeklyTx } = await supabase.from("ep_transactions")
        .select("id").eq("user_id", uid).eq("type", "bonus_grant")
        .ilike("reason", "%Weekly quality bonus%")
        .gte("created_at", monday.toISOString()).maybeSingle();
      setWeeklyDone(!!weeklyTx);

      // Weekly qualification
      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const { data: posts } = await supabase.from("posts").select("likes, comments_count")
        .eq("user_id", uid).gte("created_at", weekAgo).is("deleted_at", null);
      setWeeklyQual((posts ?? []).some(p => (p.likes||0)+(p.comments_count||0) >= 2));

      // Level progress via RPC
      const { data: lvlData } = await supabase.rpc("get_user_level_progress", { p_user_id: uid });
      if (lvlData) {
        setLevelProgress(lvlData);
        setCurrentLevel(lvlData.current_level || "none");
      }

      // Fetch current week's reward pool
      const { data: pool } = await supabase.from("reward_pools")
        .select("week_start, total_revenue, silver_share, gold_share, diamond_share, silver_users, gold_users, diamond_users, distributed")
        .order("week_start", { ascending: false }).limit(1).maybeSingle();
      setWeeklyPool(pool);

      // Auto-claim login task (1 EP — micro-reward)
      if (taskStateRes.status === "fulfilled" && !taskStateRes.value.claimed.has("login")) {
        claimDailyTask(uid, "login").then(({ ep_granted }) => {
          if (ep_granted > 0) {
            setBalance(prev => prev + ep_granted);
            setClaimed(prev => new Set([...prev, "login"]));
            setStreak(prev => prev + 1);
            flash("+1 EP — Keep that streak! 🔥", "#f97316");
          }
        }).catch(() => {});
      }
    } catch (err) {
      console.warn("[RewardsView]", err?.message);
    } finally {
      setLoading(false);
    }
  }, [uid, flash]);

  useEffect(() => {
    if (!uid) return;
    fetchData();
    realtimeSub.current = subscribeToEPBalance(uid, ({ new_balance }) => setBalance(new_balance));
    return () => { realtimeSub.current?.unsubscribe?.(); };
  }, [uid, fetchData]);

  const handleClaimTask = async (taskId) => {
    if (claimingTask) return;
    const task = ACTIVITY_TASKS.find(t => t.id === taskId);
    if (!task?.giveEP) return;
    setClaimingTask(taskId);
    try {
      const { ep_granted, new_count, capped } = await claimDailyTask(uid, taskId);
      if (capped && ep_granted === 0) { flash("Daily cap reached ✓"); return; }
      if (ep_granted > 0) {
        setBalance(prev => prev + ep_granted);
        setCounts(prev => ({ ...prev, [taskId]: new_count }));
        setClaimed(prev => new Set([...prev, taskId]));
        flash(`+${ep_granted} EP`, task.color);
      }
    } catch (err) {
      flash(err?.message || "Could not claim", "#f87171");
    } finally {
      setClaimingTask(null);
    }
  };

  const handleClaimWeekly = async () => {
    if (!weeklyQual || weeklyDone) return;
    try {
      const { ep_granted } = await claimWeeklyBonus(uid);
      setWeeklyDone(true); setBalance(prev => prev + ep_granted);
      flash(`+${ep_granted} EP — Quality bonus! 🏆`, "#fbbf24");
    } catch (err) { flash(err?.message || "Not qualified yet", "#f87171"); }
  };

  const handleDeposit = async (netEP) => {
    try {
      const { error } = await supabase.rpc("increment_engagement_points", { p_user_id:uid, p_amount:netEP, p_reason:`EP Deposit — ${netEP} EP (after 2% fee)`, p_payment_id:null, p_product_id:null });
      if (error) throw error;
      setBalance(prev => prev + netEP);
      flash(`+${netEP} EP deposited! 💰`, "#84cc16");
    } catch { flash("Deposit failed.", "#f87171"); }
  };

  const handleRedeemItem = async (item) => {
    if (balance < item.cost) return;
    try {
      const { new_balance } = await spendEP(uid, item.cost, `Redeemed: ${item.label}`);
      setBalance(new_balance);
      flash(`${item.label} activated! ✨`, item.color);
    } catch (err) { flash(err?.message || "Redemption failed", "#f87171"); }
  };

  const activityDone = ACTIVITY_TASKS.filter(t => claimed.has(t.id)).length;
  const nextMilestone = Math.ceil((balance + 1) / 1000) * 1000;
  const progressPct   = Math.min(((balance % 1000) / 1000) * 100, 100);
  const balCount      = useCount(balance, 1000);
  const displayRedeem = showAllRedeem ? REDEEM : REDEEM.slice(0, 5);

  const nextLevel = LEVEL_ORDER[LEVEL_ORDER.indexOf(currentLevel) + 1];

  return (
    <div style={{ display:"flex", flexDirection:"column", background:"#050505", fontFamily:"-apple-system,BlinkMacSystemFont,'SF Pro Display','Segoe UI',sans-serif", color:"#fff", overflow:"hidden", ...(isSidebar ? { height:"100%", borderLeft:"1px solid rgba(132,204,22,0.1)" } : { position:"fixed", inset:0, zIndex:9500 }) }}>
      <style>{`
        @keyframes rwUp    { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
        @keyframes rwToast { 0%{opacity:0;transform:translateX(-50%) translateY(8px)} 15%,80%{opacity:1;transform:translateX(-50%) translateY(0)} 100%{opacity:0} }
        @keyframes rwSpin  { to{transform:rotate(360deg)} }
        @keyframes rwGlow  { 0%,100%{box-shadow:0 0 14px rgba(132,204,22,0.16)} 50%{box-shadow:0 0 30px rgba(132,204,22,0.42)} }
        @keyframes rwSheet { from{transform:translateY(100%);opacity:0} to{transform:translateY(0);opacity:1} }
        @keyframes rwPulse { 0%,100%{opacity:1} 50%{opacity:.5} }
      `}</style>

      {/* HEADER */}
      <div style={{ display:"flex", alignItems:"center", gap:11, padding:"14px 16px", background:"rgba(5,5,5,0.98)", backdropFilter:"blur(28px)", borderBottom:"1px solid rgba(132,204,22,0.08)", flexShrink:0 }}>
        <button onClick={onClose} style={{ width:36, height:36, borderRadius:11, background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.08)", display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer", color:"#606060" }}><X size={15} /></button>
        <div style={{ flex:1 }}>
          <div style={{ fontSize:18, fontWeight:900, color:"#fff", letterSpacing:"-0.4px" }}>Rewards</div>
          <div style={{ fontSize:10, color:"#2e2e2e", marginTop:1 }}>Level up · Share ecosystem revenue</div>
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:5, padding:"7px 14px", borderRadius:12, background:"rgba(132,204,22,0.09)", border:"1px solid rgba(132,204,22,0.2)", animation:"rwGlow 3s ease-in-out infinite" }}>
          <Zap size={12} color="#84cc16" />
          <span style={{ fontSize:14, fontWeight:900, color:"#84cc16" }}>{loading ? "—" : EP(balCount)}</span>
          <span style={{ fontSize:9, color:"#4d7c0f", fontWeight:800 }}>EP</span>
        </div>
      </div>

      {loading ? (
        <div style={{ width:22, height:22, border:"2.5px solid rgba(132,204,22,0.1)", borderTopColor:"#84cc16", borderRadius:"50%", animation:"rwSpin .7s linear infinite", margin:"72px auto" }} />
      ) : (
        <div style={{ flex:1, overflowY:"auto" }}>

          {/* HERO CARD */}
          <div style={{ margin:"14px 16px 0", background:"linear-gradient(145deg,rgba(132,204,22,0.09) 0%,rgba(132,204,22,0.025) 50%,transparent 100%)", border:"1px solid rgba(132,204,22,0.17)", borderRadius:22, padding:"20px 18px 18px", position:"relative", overflow:"hidden" }}>
            <div style={{ position:"absolute", top:-40, right:-40, width:160, height:160, borderRadius:"50%", background:"radial-gradient(circle,rgba(132,204,22,0.08),transparent 68%)", pointerEvents:"none" }} />
            <div style={{ position:"absolute", top:0, left:0, right:0, height:1, background:"linear-gradient(90deg,transparent,rgba(132,204,22,0.35),transparent)", pointerEvents:"none" }} />

            <div style={{ display:"flex", gap:0, alignItems:"stretch" }}>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:10, fontWeight:800, color:"#2d4a0a", textTransform:"uppercase", letterSpacing:".8px", marginBottom:6 }}>EP Balance</div>
                <div style={{ fontSize:42, fontWeight:900, color:"#84cc16", lineHeight:1, letterSpacing:"-2px", marginBottom:5 }}>{EP(balCount)}</div>
                <div style={{ fontSize:11, color:"#333" }}>Engagement Points</div>
                <div style={{ marginTop:14 }}>
                  <div style={{ display:"flex", justifyContent:"space-between", fontSize:9, color:"#252525", marginBottom:5 }}>
                    <span>Milestone</span><span>{EP(balance)} / {EP(nextMilestone)}</span>
                  </div>
                  <div style={{ height:5, background:"rgba(255,255,255,0.05)", borderRadius:3, overflow:"hidden" }}>
                    <div style={{ height:"100%", width:`${progressPct}%`, background:"linear-gradient(90deg,#84cc16,#4d7c0f)", borderRadius:3, transition:"width 1.2s" }} />
                  </div>
                </div>
              </div>
              <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", paddingLeft:20, gap:11 }}>
                <div style={{ textAlign:"center" }}>
                  <div style={{ fontSize:32, animation:"rwGlow 2s ease-in-out infinite" }}>
                    {currentLevel === "diamond" ? "💎" : currentLevel === "gold" ? "🥇" : currentLevel === "silver" ? "🥈" : "🔵"}
                  </div>
                  <div style={{ fontSize:12, fontWeight:900, color:currentLevel !== "none" ? LEVELS[currentLevel]?.color : "#383838", lineHeight:1.2 }}>
                    {currentLevel === "none" ? "No Level" : LEVELS[currentLevel]?.name}
                  </div>
                  <div style={{ fontSize:9, fontWeight:700, color:"#383838", textTransform:"uppercase" }}>Level</div>
                </div>
                <div style={{ textAlign:"center" }}>
                  <div style={{ fontSize:26, fontWeight:900, color:"#f97316", lineHeight:1 }}>{streak}</div>
                  <div style={{ fontSize:9, fontWeight:700, color:"#383838", textTransform:"uppercase" }}>Streak</div>
                </div>
              </div>
            </div>

            {/* Current level share info */}
            {currentLevel !== "none" && weeklyPool && (
              <div style={{ marginTop:14, padding:"10px 12px", borderRadius:12, background:`${LEVELS[currentLevel]?.color}08`, border:`1px solid ${LEVELS[currentLevel]?.color}20` }}>
                <div style={{ display:"flex", justifyContent:"space-between", fontSize:11 }}>
                  <span style={{ color:"#525252" }}>Your weekly EP share</span>
                  <span style={{ color:LEVELS[currentLevel]?.color, fontWeight:800 }}>
                    {EP(weeklyPool?.[`${currentLevel}_share`] || 0)} EP
                  </span>
                </div>
                <div style={{ fontSize:10, color:"#2a2a2a", marginTop:3 }}>
                  From {LEVELS[currentLevel]?.revenueShare}% of ${weeklyPool.total_revenue?.toFixed(2) || "0.00"} weekly revenue
                  {!weeklyPool.distributed && " · Pending distribution"}
                  {weeklyPool.distributed && " · Distributed ✓"}
                </div>
              </div>
            )}

            <div style={{ display:"flex", gap:9, marginTop:14 }}>
              <button onClick={() => setShowDeposit(true)} style={{ flex:1, padding:"10px", borderRadius:12, background:"linear-gradient(135deg,#84cc16,#4d7c0f)", border:"none", color:"#000", fontSize:12, fontWeight:900, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:6, fontFamily:"inherit" }}>
                <Wallet size={13} /> Deposit EP
              </button>
              <button onClick={() => setTab("activity")} style={{ flex:1, padding:"10px", borderRadius:12, background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.08)", color:"#777", fontSize:12, fontWeight:800, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:6, fontFamily:"inherit" }}>
                <Target size={13} /> {activityDone}/{ACTIVITY_TASKS.length} Today
              </button>
            </div>
          </div>

          {/* TABS */}
          <div style={{ display:"flex", margin:"12px 16px 0", background:"rgba(255,255,255,0.025)", border:"1px solid rgba(255,255,255,0.055)", borderRadius:13, padding:3, gap:2 }}>
            {[["levels","Levels"],["activity","Activity"],["redeem","Redeem"]].map(([k,l]) => (
              <button key={k} onClick={() => setTab(k)} style={{ flex:1, padding:"9px 4px", borderRadius:10, border:"none", fontSize:11, fontWeight:800, cursor:"pointer", fontFamily:"inherit", background:tab===k?"rgba(132,204,22,0.1)":"transparent", color:tab===k?"#84cc16":"#484848", boxShadow:tab===k?"0 2px 10px rgba(132,204,22,0.18)":"none", outline:tab===k?"1px solid rgba(132,204,22,0.22)":"none", outlineOffset:"-1px", transition:"all .15s" }}>{l}</button>
            ))}
          </div>

          <div style={{ padding:"12px 16px 100px" }}>

            {/* ═══ LEVELS ═══ */}
            {tab === "levels" && (
              <>
                {/* How it works */}
                <div style={{ padding:"12px 13px", marginBottom:16, background:"rgba(255,255,255,0.02)", border:"1px solid rgba(255,255,255,0.06)", borderRadius:14 }}>
                  <div style={{ fontSize:12, fontWeight:800, color:"#737373", marginBottom:6 }}>How Revenue Sharing Works</div>
                  <div style={{ fontSize:11, color:"#383838", lineHeight:1.75 }}>
                    Complete daily activities to meet level criteria. Once at a level, you earn a <span style={{ color:"#84cc16" }}>share of real weekly ecosystem revenue</span>, distributed as EP. No free minting — every EP share is backed by actual platform income.
                  </div>
                </div>

                {/* Level cards */}
                {Object.keys(LEVELS).map((key, i) => (
                  <LevelCard key={key} levelKey={key} levelData={LEVELS[key]} progress={levelProgress} currentLevel={currentLevel} idx={i} />
                ))}

                {/* Revenue pool this week */}
                {weeklyPool && (
                  <div style={{ padding:"14px 14px", borderRadius:14, background:"rgba(132,204,22,0.04)", border:"1px solid rgba(132,204,22,0.1)", marginTop:4 }}>
                    <div style={{ fontSize:12, fontWeight:800, color:"#84cc16", marginBottom:10 }}>
                      This Week's Revenue Pool
                    </div>
                    <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:8 }}>
                      {[
                        { level:"silver", label:"Silver", color:"#d4d4d8" },
                        { level:"gold",   label:"Gold",   color:"#fbbf24" },
                        { level:"diamond",label:"Diamond",color:"#a78bfa" },
                      ].map(({ level, label, color }) => (
                        <div key={level} style={{ textAlign:"center", padding:"10px 6px", background:`${color}06`, border:`1px solid ${color}18`, borderRadius:10 }}>
                          <div style={{ fontSize:14, fontWeight:900, color }}>{EP(weeklyPool[`${level}_share`] || 0)} EP</div>
                          <div style={{ fontSize:9, color:"#383838", fontWeight:700 }}>{label} / user</div>
                          <div style={{ fontSize:9, color:"#2a2a2a" }}>{weeklyPool[`${level}_users`] || 0} users</div>
                        </div>
                      ))}
                    </div>
                    <div style={{ fontSize:10, color:"#2a2a2a", marginTop:10, textAlign:"center" }}>
                      Week of {weeklyPool.week_start} · Total ${weeklyPool.total_revenue?.toFixed(2)} revenue
                    </div>
                  </div>
                )}
              </>
            )}

            {/* ═══ ACTIVITY ═══ */}
            {tab === "activity" && (
              <>
                <div style={{ padding:"11px 12px", marginBottom:14, background:"rgba(96,165,250,0.05)", border:"1px solid rgba(96,165,250,0.12)", borderRadius:12, fontSize:11, color:"#525252", lineHeight:1.6 }}>
                  <span style={{ color:"#60a5fa", fontWeight:800 }}>Activity Tracker:</span> Your daily actions are logged and count toward level criteria (active_days_30, post count, etc.). The login task gives 1 EP as a micro-reward — all other actions contribute to your <span style={{ color:"#84cc16" }}>revenue level</span> instead.
                </div>

                <div style={{ fontSize:10, fontWeight:800, color:"#2a2a2a", textTransform:"uppercase", letterSpacing:"1.2px", marginBottom:9 }}>Daily Activity</div>
                {ACTIVITY_TASKS.map((t, i) => {
                  const done = t.cap > 1 ? (counts[t.id]||0) >= (t.cap||1) : claimed.has(t.id);
                  return <ActivityCard key={t.id} task={t} done={done} count={counts[t.id]||0} onClaim={handleClaimTask} idx={i} />;
                })}

                {/* Weekly quality bonus */}
                <div style={{ fontSize:10, fontWeight:800, color:"#2a2a2a", textTransform:"uppercase", letterSpacing:"1.2px", margin:"20px 0 9px" }}>Weekly Quality Bonus</div>
                <div style={{ padding:"15px 15px", borderRadius:16, background:weeklyQual?"rgba(251,191,36,0.06)":"rgba(255,255,255,0.02)", border:`1px solid ${weeklyQual?"rgba(251,191,36,0.2)":"rgba(255,255,255,0.05)"}`, opacity:weeklyDone?0.5:1 }}>
                  <div style={{ display:"flex", alignItems:"center", gap:13 }}>
                    <div style={{ width:46, height:46, borderRadius:14, flexShrink:0, background:weeklyQual?"rgba(251,191,36,0.1)":"rgba(255,255,255,0.04)", border:`1px solid ${weeklyQual?"rgba(251,191,36,0.2)":"rgba(255,255,255,0.06)"}`, display:"flex", alignItems:"center", justifyContent:"center" }}>
                      {weeklyDone ? <CheckCircle size={20} color="#22c55e" /> : <Crown size={20} color={weeklyQual?"#fbbf24":"#2a2a2a"} />}
                    </div>
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:13, fontWeight:800, color:"#d4d4d4", marginBottom:3 }}>Weekly Quality Bonus</div>
                      <div style={{ fontSize:11, color:"#383838", lineHeight:1.65, marginBottom:10 }}>Earn when one of your posts gets ≥2 genuine engagements this week.</div>
                      <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                        <span style={{ fontSize:15, fontWeight:900, color:"#fbbf24" }}>+{WEEKLY_BONUS_EP} EP</span>
                        {!weeklyDone
                          ? <button onClick={handleClaimWeekly} disabled={!weeklyQual} style={{ padding:"5px 14px", borderRadius:9, background:weeklyQual?"rgba(251,191,36,0.12)":"rgba(255,255,255,0.04)", border:`1px solid ${weeklyQual?"rgba(251,191,36,0.26)":"rgba(255,255,255,0.06)"}`, color:weeklyQual?"#fbbf24":"#2a2a2a", fontSize:11, fontWeight:800, cursor:weeklyQual?"pointer":"not-allowed", fontFamily:"inherit" }}>
                              {weeklyQual ? "Claim Bonus" : "Not qualified yet"}
                            </button>
                          : <span style={{ fontSize:11, color:"#22c55e", fontWeight:700 }}>✓ Claimed this week</span>
                        }
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* ═══ REDEEM ═══ */}
            {tab === "redeem" && (
              <>
                <div style={{ fontSize:11, color:"#383838", marginBottom:14, lineHeight:1.65 }}>
                  Spend EP to amplify your presence. Every redemption burns EP — keeping supply healthy and your balance meaningful.
                </div>
                {displayRedeem.map((item, i) => (
                  <RedeemCard key={item.id} item={item} balance={balance} onRedeem={handleRedeemItem} idx={i} />
                ))}
                {REDEEM.length > 5 && (
                  <button onClick={() => setShowAllRedeem(s => !s)} style={{ width:"100%", padding:"10px", borderRadius:11, background:"rgba(255,255,255,0.025)", border:"1px solid rgba(255,255,255,0.07)", color:"#555", fontSize:12, fontWeight:700, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:6, fontFamily:"inherit", marginTop:4 }}>
                    <ChevronDown size={14} style={{ transform:showAllRedeem?"rotate(180deg)":"none", transition:".2s" }} />
                    {showAllRedeem ? "Show less" : `Show ${REDEEM.length - 5} more`}
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {showDeposit && <DepositSheet onClose={() => setShowDeposit(false)} onSuccess={handleDeposit} />}
      {toast && <Toast msg={toast.msg} color={toast.color} />}
    </div>
  );
};

export default RewardsView;