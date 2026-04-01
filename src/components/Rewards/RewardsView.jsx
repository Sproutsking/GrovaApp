// src/components/Rewards/RewardsView.jsx — v5 PREVIEW_MATCH
// ============================================================================
// Matches the approved preview design exactly.
// PC: tight 236px sidebar + scrollable main panel, max-width 1160px centered.
// Mobile: compact stats strip (not a bloated hero card), pill tabs, dense content.
// Sidebar: no excess padding — every element is snug, elegant, purposeful.
// Water model: Silver 15% / Gold 30% / Diamond 55% — proportional by score.
// ============================================================================

import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  X, Zap, Flame, CheckCircle, Lock, ChevronRight, ChevronDown,
  Image, Film, Heart, Crown, Wallet, Trophy, Sparkles, Gift,
  Star, Target, TrendingUp, Layers, Activity, Droplets,
} from "lucide-react";
import { supabase } from "../../services/config/supabase";
import {
  getRewardsProfile, getTodayTaskState, claimDailyTask,
  claimWeeklyBonus, spendEP, subscribeToEPBalance,
  WEEKLY_BONUS_EP, EP_PER_USD, PROTOCOL_FEE,
  LEVEL_SCORE_THRESHOLDS, TASK_WEIGHTS, LEVEL_POOL_ALLOCATIONS,
} from "../../services/rewards/rewardsService";

// ─────────────────────────────────────────────────────────────────────────────
// Constants & config
// ─────────────────────────────────────────────────────────────────────────────
const EP = (n) => {
  const v = Number(n) || 0;
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(2)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(1)}K`;
  return String(v);
};
const clamp = (val, max) => Math.min(Math.round((val / Math.max(max, 1)) * 100), 100);

const LEVELS = {
  silver: {
    name: "Silver", emoji: "🥈", color: "#c0c0c0", glow: "rgba(192,192,192,0.2)",
    poolPct: LEVEL_POOL_ALLOCATIONS.silver,
    scoreMin: LEVEL_SCORE_THRESHOLDS.silver,
    criteria: [
      { key: "login_days",  label: "Login days (7d)",   target: 4,  unit: "days"  },
      { key: "posts",       label: "Posts published",   target: 2,  unit: "posts" },
      { key: "engagements", label: "Engagements given", target: 10, unit: ""      },
      { key: "score",       label: "Engagement score",  target: LEVEL_SCORE_THRESHOLDS.silver, unit: "pts" },
    ],
  },
  gold: {
    name: "Gold", emoji: "🥇", color: "#f5a623", glow: "rgba(245,166,35,0.2)",
    poolPct: LEVEL_POOL_ALLOCATIONS.gold,
    scoreMin: LEVEL_SCORE_THRESHOLDS.gold,
    criteria: [
      { key: "login_days",  label: "Login days (7d)",   target: 6,  unit: "days"  },
      { key: "posts",       label: "Posts published",   target: 5,  unit: "posts" },
      { key: "reels",       label: "Reels uploaded",    target: 2,  unit: "reels" },
      { key: "engagements", label: "Engagements given", target: 30, unit: ""      },
      { key: "score",       label: "Engagement score",  target: LEVEL_SCORE_THRESHOLDS.gold, unit: "pts" },
    ],
  },
  diamond: {
    name: "Diamond", emoji: "💎", color: "#a78bfa", glow: "rgba(167,139,250,0.2)",
    poolPct: LEVEL_POOL_ALLOCATIONS.diamond,
    scoreMin: LEVEL_SCORE_THRESHOLDS.diamond,
    criteria: [
      { key: "login_days",  label: "Login days (7d)",   target: 7,   unit: "days"  },
      { key: "posts",       label: "Posts published",   target: 10,  unit: "posts" },
      { key: "reels",       label: "Reels uploaded",    target: 5,   unit: "reels" },
      { key: "engagements", label: "Engagements given", target: 75,  unit: ""      },
      { key: "score",       label: "Engagement score",  target: LEVEL_SCORE_THRESHOLDS.diamond, unit: "pts" },
    ],
  },
};
const LEVEL_ORDER = ["none", "silver", "gold", "diamond"];

const ACTIVITY_TASKS = [
  { id: "login",       Icon: Flame,  label: "Daily Login",    desc: `+${TASK_WEIGHTS.login} score · 1 EP`,        giveEP: true,  ep: 1, color: "#f97316", weight: TASK_WEIGHTS.login },
  { id: "post_create", Icon: Image,  label: "Publish a Post", desc: `+${TASK_WEIGHTS.post_create} score`,          giveEP: false, ep: 0, color: "#84cc16", weight: TASK_WEIGHTS.post_create },
  { id: "reel_create", Icon: Film,   label: "Upload a Reel",  desc: `+${TASK_WEIGHTS.reel_create} score`,          giveEP: false, ep: 0, color: "#e879f9", weight: TASK_WEIGHTS.reel_create },
  { id: "engage_5",    Icon: Heart,  label: "Engage 5 Posts", desc: `+${TASK_WEIGHTS.engage_5} score`,             giveEP: false, ep: 0, color: "#f472b6", weight: TASK_WEIGHTS.engage_5 },
];

const REDEEM = [
  { id: "boost24",  Icon: Zap,        label: "24h Visibility Boost",  cost: 50,   color: "#84cc16", desc: "2× reach for 24 hours" },
  { id: "frame",    Icon: Star,       label: "Creator Frame",          cost: 150,  color: "#60a5fa", desc: "Animated border on posts & profile" },
  { id: "gift50",   Icon: Gift,       label: "Send 50 EP Gift",        cost: 52,   color: "#34d399", desc: "Gift 50 EP to any creator (2% fee)" },
  { id: "silver",   Icon: Trophy,     label: "Silver Badge · 3 days",  cost: 300,  color: "#c0c0c0", desc: "Stand out in every comment" },
  { id: "gold",     Icon: Crown,      label: "Gold Badge · 3 days",    cost: 800,  color: "#f5a623", desc: "Priority discovery placement" },
  { id: "diamond",  Icon: Sparkles,   label: "Diamond Badge · 7 days", cost: 2000, color: "#a78bfa", desc: "Maximum visibility for 7 days" },
  { id: "boost7",   Icon: TrendingUp, label: "7-Day Reach Amplifier",  cost: 500,  color: "#f97316", desc: "Extended reach for an entire week" },
  { id: "featured", Icon: Star,       label: "Featured Creator Slot",  cost: 5000, color: "#e879f9", desc: "Appear on Discover for 24 hours" },
];

const NAV = [
  { key: "levels",   Icon: Layers,   label: "Levels & Pools" },
  { key: "activity", Icon: Activity, label: "Activity"       },
  { key: "redeem",   Icon: Zap,      label: "Redeem EP"      },
];

// ─────────────────────────────────────────────────────────────────────────────
// Hooks
// ─────────────────────────────────────────────────────────────────────────────
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

async function fetchStreak(uid) {
  try {
    const { data } = await supabase.from("daily_task_completions")
      .select("completed_at").eq("user_id", uid).eq("task_id", "login")
      .order("completed_at", { ascending: false }).limit(365);
    if (!data?.length) return 0;
    let s = 0;
    const today = new Date(); today.setHours(0, 0, 0, 0);
    for (let i = 0; i < data.length; i++) {
      const d = new Date(data[i].completed_at); d.setHours(0, 0, 0, 0);
      const exp = new Date(today); exp.setDate(today.getDate() - i);
      if (d.getTime() === exp.getTime()) s++; else break;
    }
    return s;
  } catch { return 0; }
}

function getMonday() {
  const d = new Date(); const day = d.getDay();
  d.setDate(d.getDate() - day + (day === 0 ? -6 : 1));
  d.setHours(0, 0, 0, 0); return d;
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared mini-components
// ─────────────────────────────────────────────────────────────────────────────
const Toast = ({ msg, color = "#84cc16" }) => (
  <div style={{ position: "fixed", bottom: 80, left: "50%", transform: "translateX(-50%)", padding: "9px 18px", borderRadius: 12, background: color, color: "#000", fontSize: 12, fontWeight: 900, zIndex: 99999, pointerEvents: "none", whiteSpace: "nowrap", boxShadow: `0 4px 20px ${color}55`, animation: "rwToast 2.8s ease forwards" }}>
    {msg}
  </div>
);

const CriteriaRow = ({ c, val, color }) => {
  const p = clamp(val, c.target);
  const met = p >= 100;
  return (
    <div style={{ marginBottom: 9 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, marginBottom: 3 }}>
        <span style={{ display: "flex", alignItems: "center", gap: 5, color: met ? "#22c55e" : "#666", fontWeight: 700 }}>
          {met
            ? <span style={{ width: 9, height: 9, borderRadius: "50%", background: "#22c55e", display: "inline-block", flexShrink: 0 }} />
            : <span style={{ width: 9, height: 9, borderRadius: "50%", border: `1.5px solid ${color}40`, display: "inline-block", flexShrink: 0 }} />}
          {c.label}
        </span>
        <span style={{ color: met ? "#22c55e" : "#3a3a3a", fontWeight: 800, fontSize: 9 }}>
          {Math.min(val, c.target)}{c.unit ? ` ${c.unit}` : ""} / {c.target}{c.unit ? ` ${c.unit}` : ""}
        </span>
      </div>
      <div style={{ height: 3, background: "rgba(255,255,255,0.05)", borderRadius: 2, overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${p}%`, background: color, borderRadius: 2, transition: "width .7s ease", boxShadow: met ? `0 0 6px ${color}` : "none" }} />
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// DepositSheet
// ─────────────────────────────────────────────────────────────────────────────
const DepositSheet = ({ onClose, onSuccess }) => {
  const [amt, setAmt] = useState("5");
  const ep = Math.floor((parseFloat(amt) || 0) * EP_PER_USD);
  const fee = Math.round(ep * PROTOCOL_FEE);
  const net = ep - fee;
  return (
    <div onClick={e => e.target === e.currentTarget && onClose()}
      style={{ position: "fixed", inset: 0, zIndex: 98000, background: "rgba(0,0,0,0.88)", backdropFilter: "blur(18px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div style={{ background: "#0d0d0d", border: "1px solid rgba(255,255,255,0.09)", borderRadius: 20, width: "100%", maxWidth: 420, padding: "24px 22px 28px", animation: "rwSheet .28s cubic-bezier(.34,1.56,.64,1)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: 20, fontWeight: 900, color: "#fff", letterSpacing: "-0.4px" }}>Deposit EP</div>
            <div style={{ fontSize: 10, color: "#3a3a3a", marginTop: 2 }}>$1 = 100 EP · 2% protocol fee</div>
          </div>
          <button onClick={onClose} style={{ width: 30, height: 30, borderRadius: 8, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", color: "#555", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><X size={13} /></button>
        </div>
        <div style={{ background: "rgba(132,204,22,0.05)", border: "1px solid rgba(132,204,22,0.14)", borderRadius: 14, padding: "12px 14px", marginBottom: 10 }}>
          <div style={{ fontSize: 9, color: "#3a5c10", fontWeight: 800, textTransform: "uppercase", letterSpacing: "1px", marginBottom: 6 }}>Amount (USD)</div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 26, fontWeight: 900, color: "#2a2a2a" }}>$</span>
            <input type="number" min="1" step="1" value={amt} onChange={e => setAmt(e.target.value)}
              style={{ fontSize: 34, fontWeight: 900, color: "#fff", background: "none", border: "none", outline: "none", flex: 1, caretColor: "#84cc16", fontFamily: "inherit" }} />
          </div>
        </div>
        <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
          {[1, 5, 10, 25, 50].map(v => (
            <button key={v} onClick={() => setAmt(String(v))}
              style={{ flex: 1, padding: "8px 2px", borderRadius: 9, background: parseFloat(amt) === v ? "rgba(132,204,22,0.12)" : "rgba(255,255,255,0.03)", border: `1px solid ${parseFloat(amt) === v ? "rgba(132,204,22,0.28)" : "rgba(255,255,255,0.07)"}`, color: parseFloat(amt) === v ? "#84cc16" : "#555", fontSize: 12, fontWeight: 800, cursor: "pointer", fontFamily: "inherit" }}>${v}</button>
          ))}
        </div>
        {ep > 0 && (
          <div style={{ background: "rgba(132,204,22,0.03)", border: "1px solid rgba(132,204,22,0.09)", borderRadius: 12, padding: "10px 13px", marginBottom: 12 }}>
            {[["EP credited", `+${ep} EP`, "#84cc16"], ["Protocol fee (2%)", `−${fee} EP`, "#2a2a2a"]].map(([l, v, c]) => (
              <div key={l} style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#444", marginBottom: 5 }}>
                <span>{l}</span><span style={{ color: c, fontWeight: 800 }}>{v}</span>
              </div>
            ))}
            <div style={{ height: 1, background: "rgba(132,204,22,0.07)", marginBottom: 6 }} />
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, fontWeight: 900 }}>
              <span style={{ color: "#555" }}>You receive</span><span style={{ color: "#84cc16" }}>{net} EP</span>
            </div>
          </div>
        )}
        <button onClick={() => { if (net > 0) { onSuccess(net); onClose(); } }} disabled={net <= 0}
          style={{ width: "100%", padding: "13px", borderRadius: 13, border: "none", background: net > 0 ? "linear-gradient(135deg,#84cc16,#4d7c0f)" : "rgba(255,255,255,0.04)", color: net > 0 ? "#000" : "#333", fontSize: 13, fontWeight: 900, cursor: net > 0 ? "pointer" : "not-allowed", fontFamily: "inherit" }}>
          {net > 0 ? `Deposit $${amt} → Get ${net} EP` : "Enter amount"}
        </button>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Pool bar — water model visualizer
// ─────────────────────────────────────────────────────────────────────────────
const PoolBar = ({ levelKey, weeklyPool, userScore, isCurrent }) => {
  const lvl = LEVELS[levelKey];
  const poolEP = weeklyPool?.[`${levelKey}_share`] || 0;
  const totalUsers = weeklyPool?.[`${levelKey}_users`] || 0;
  const totalScore = Math.max(weeklyPool?.[`${levelKey}_total_score`] || 1, 1);
  const userShare = isCurrent && userScore > 0 ? userScore / totalScore : 0;
  const userEP = Math.round(poolEP * userShare);

  return (
    <div style={{ padding: "11px 13px", borderRadius: 13, background: `${lvl.color}05`, border: `1px solid ${lvl.color}16`, marginBottom: 8 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 16 }}>{lvl.emoji}</span>
          <div>
            <div style={{ fontSize: 12, fontWeight: 800, color: lvl.color, lineHeight: 1.2 }}>{lvl.name} Pool</div>
            <div style={{ fontSize: 9, color: "#3a3a3a" }}>{lvl.poolPct}% revenue · {totalUsers} users</div>
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 15, fontWeight: 900, color: lvl.color }}>{EP(poolEP)} EP</div>
          <div style={{ fontSize: 9, color: "#3a3a3a" }}>total pool</div>
        </div>
      </div>
      <div style={{ position: "relative", height: 22, borderRadius: 8, background: "rgba(255,255,255,0.04)", border: `1px solid ${lvl.color}14`, overflow: "hidden", marginBottom: 6 }}>
        <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: `${lvl.poolPct}%`, background: `${lvl.color}18`, borderRight: `1px dashed ${lvl.color}28` }} />
        {userShare > 0 && (
          <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: `${Math.min(userShare * 100 * 4, lvl.poolPct)}%`, background: `${lvl.color}45`, transition: "width 1s ease" }} />
        )}
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", paddingLeft: 8, paddingRight: 8, justifyContent: "space-between" }}>
          <span style={{ fontSize: 9, color: lvl.color, fontWeight: 800 }}>{lvl.poolPct}% alloc</span>
          <span style={{ fontSize: 9, color: isCurrent ? lvl.color : "#3a3a3a", fontWeight: isCurrent ? 800 : 700 }}>
            {isCurrent ? `your share: ${(userShare * 100).toFixed(2)}%` : "not your level"}
          </span>
        </div>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "#444" }}>
        <span>Score: <span style={{ color: lvl.color, fontWeight: 800 }}>{isCurrent ? userScore : 0} pts</span></span>
        <span>Your EP: <span style={{ color: lvl.color, fontWeight: 800 }}>~{EP(userEP)} EP</span></span>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Level accordion card
// ─────────────────────────────────────────────────────────────────────────────
const LevelCard = ({ levelKey, progress, currentLevel, userWeeklyScore }) => {
  const lvl = LEVELS[levelKey];
  const isCurrent = currentLevel === levelKey;
  const isPassed = LEVEL_ORDER.indexOf(currentLevel) > LEVEL_ORDER.indexOf(levelKey);
  const [open, setOpen] = useState(isCurrent);

  const pMap = {
    login_days:  progress?.login_days_7     || 0,
    posts:       progress?.posts_week       || 0,
    reels:       progress?.reels_week       || 0,
    engagements: progress?.engagements_week || 0,
    score:       userWeeklyScore            || 0,
  };
  const met = lvl.criteria.filter(c => (pMap[c.key] || 0) >= c.target).length;

  return (
    <div style={{ borderRadius: 15, border: `1px solid ${isCurrent ? lvl.color + "30" : isPassed ? "rgba(34,197,94,0.14)" : "rgba(255,255,255,0.06)"}`, background: isCurrent ? `${lvl.color}05` : isPassed ? "rgba(34,197,94,0.025)" : "rgba(255,255,255,0.015)", overflow: "hidden", marginBottom: 8 }}>
      {(isCurrent || isPassed) && <div style={{ height: 2, background: `linear-gradient(90deg,transparent,${isCurrent ? lvl.color : "#22c55e"}50,transparent)` }} />}
      <div onClick={() => setOpen(o => !o)} style={{ display: "flex", alignItems: "center", gap: 12, padding: "13px 14px", cursor: "pointer" }}>
        <div style={{ width: 44, height: 44, borderRadius: 13, flexShrink: 0, background: `${lvl.color}10`, border: `1px solid ${lvl.color}20`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, boxShadow: isCurrent ? `0 2px 14px ${lvl.glow}` : "none" }}>
          {lvl.emoji}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 3, flexWrap: "wrap" }}>
            <span style={{ fontSize: 14, fontWeight: 900, color: isCurrent ? lvl.color : isPassed ? "#22c55e" : "#666" }}>{lvl.name}</span>
            {isCurrent && <span style={{ padding: "1px 6px", borderRadius: 5, background: `${lvl.color}14`, border: `1px solid ${lvl.color}26`, color: lvl.color, fontSize: 8, fontWeight: 800 }}>YOUR LEVEL</span>}
            {isPassed && <span style={{ padding: "1px 6px", borderRadius: 5, background: "rgba(34,197,94,0.09)", border: "1px solid rgba(34,197,94,0.18)", color: "#22c55e", fontSize: 8, fontWeight: 800 }}>✓ ACHIEVED</span>}
          </div>
          <div style={{ fontSize: 10, color: "#484848" }}>
            Score {lvl.scoreMin}+ · <span style={{ color: lvl.color, fontWeight: 700 }}>{lvl.poolPct}%</span> revenue pool
          </div>
        </div>
        <div style={{ textAlign: "right", flexShrink: 0, marginRight: 6 }}>
          <div style={{ fontSize: 16, fontWeight: 900, color: met === lvl.criteria.length ? (isPassed ? "#22c55e" : lvl.color) : "#333" }}>{met}/{lvl.criteria.length}</div>
          <div style={{ fontSize: 8, color: "#333", fontWeight: 700 }}>criteria</div>
        </div>
        <ChevronDown size={13} color="#333" style={{ flexShrink: 0, transform: open ? "rotate(180deg)" : "none", transition: "transform .18s" }} />
      </div>
      {open && (
        <div style={{ padding: "0 14px 13px", borderTop: "1px solid rgba(255,255,255,0.05)" }}>
          <div style={{ marginTop: 11, marginBottom: 10, padding: "7px 9px", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: 8, fontSize: 9, color: "#3a3a3a", lineHeight: 1.65 }}>
            Score {lvl.scoreMin}+ · Share = <code style={{ background: "rgba(255,255,255,0.05)", padding: "0 4px", borderRadius: 3, fontSize: 9 }}>your_score / level_total</code>
          </div>
          {lvl.criteria.map(c => (
            <CriteriaRow key={c.key} c={c} val={pMap[c.key] || 0} color={lvl.color} />
          ))}
        </div>
      )}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Activity task card
// ─────────────────────────────────────────────────────────────────────────────
const ActivityCard = ({ task, done, onClaim, idx }) => (
  <div style={{ background: "rgba(255,255,255,0.02)", border: `1px solid ${done ? "rgba(34,197,94,0.09)" : "rgba(255,255,255,0.06)"}`, borderRadius: 13, padding: "11px 13px", display: "flex", alignItems: "center", gap: 11, marginBottom: 7, opacity: done ? 0.5 : 1, animation: `rwUp .25s ease ${idx * 0.04}s both` }}>
    <div style={{ width: 36, height: 36, borderRadius: 10, flexShrink: 0, background: done ? "rgba(34,197,94,0.07)" : `${task.color}10`, border: `1px solid ${done ? "rgba(34,197,94,0.16)" : task.color + "26"}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
      {done ? <CheckCircle size={16} color="#22c55e" /> : <task.Icon size={16} color={task.color} />}
    </div>
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ fontSize: 12, fontWeight: 800, color: done ? "#484848" : "#d4d4d4", marginBottom: 1 }}>{task.label}</div>
      <div style={{ fontSize: 10, color: "#383838" }}>{task.desc}</div>
    </div>
    <div style={{ flexShrink: 0, textAlign: "right" }}>
      <div style={{ fontSize: 9, fontWeight: 700, color: `${task.color}99`, marginBottom: 4 }}>+{task.weight} pts</div>
      <button onClick={() => !done && onClaim(task.id)} disabled={done || !task.giveEP}
        style={{ padding: "3px 9px", borderRadius: 7, background: done ? "rgba(34,197,94,0.07)" : task.giveEP ? `${task.color}12` : "rgba(255,255,255,0.03)", border: `1px solid ${done ? "rgba(34,197,94,0.14)" : task.giveEP ? task.color + "26" : "rgba(255,255,255,0.05)"}`, color: done ? "#22c55e" : task.giveEP ? task.color : "#333", fontSize: 9, fontWeight: 800, cursor: done || !task.giveEP ? "default" : "pointer", fontFamily: "inherit" }}>
        {done ? "Done ✓" : task.giveEP ? "Claim" : "Tracked"}
      </button>
    </div>
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// Redeem card
// ─────────────────────────────────────────────────────────────────────────────
const RedeemCard = ({ item, balance, onRedeem, idx }) => {
  const can = balance >= item.cost;
  return (
    <div onClick={() => can && onRedeem(item)}
      style={{ display: "flex", alignItems: "center", gap: 11, padding: "11px 13px", background: can ? "rgba(255,255,255,0.02)" : "rgba(255,255,255,0.01)", border: `1px solid ${can ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.03)"}`, borderRadius: 13, marginBottom: 7, opacity: can ? 1 : 0.28, cursor: can ? "pointer" : "not-allowed", transition: "border-color .15s", animation: `rwUp .25s ease ${idx * 0.04}s both` }}
      onMouseEnter={e => can && (e.currentTarget.style.borderColor = `${item.color}30`)}
      onMouseLeave={e => can && (e.currentTarget.style.borderColor = "rgba(255,255,255,0.06)")}>
      <div style={{ width: 40, height: 40, borderRadius: 12, flexShrink: 0, background: `${item.color}0f`, border: `1px solid ${item.color}1e`, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <item.Icon size={18} color={item.color} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 800, color: "#d4d4d4", marginBottom: 2 }}>{item.label}</div>
        <div style={{ fontSize: 10, color: "#383838", marginBottom: 4 }}>{item.desc}</div>
        <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
          <Zap size={8} color={can ? item.color : "#333"} />
          <span style={{ fontSize: 10, fontWeight: 800, color: can ? item.color : "#333" }}>{EP(item.cost)} EP</span>
        </div>
      </div>
      <div style={{ width: 30, height: 30, borderRadius: 9, flexShrink: 0, background: can ? `linear-gradient(135deg,${item.color},${item.color}99)` : "rgba(255,255,255,0.04)", display: "flex", alignItems: "center", justifyContent: "center" }}>
        {can ? <ChevronRight size={14} color="#000" /> : <Lock size={11} color="#333" />}
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Score gauge (PC sidebar widget)
// ─────────────────────────────────────────────────────────────────────────────
const ScoreGauge = ({ score, currentLevel }) => {
  const lvl = currentLevel !== "none" ? LEVELS[currentLevel] : null;
  const nextKey = LEVEL_ORDER[LEVEL_ORDER.indexOf(currentLevel) + 1];
  const nextLvl = nextKey ? LEVELS[nextKey] : null;
  const nextTarget = nextLvl?.scoreMin || LEVEL_SCORE_THRESHOLDS.silver;
  const prevTarget = lvl?.scoreMin || 0;
  const range = Math.max(nextTarget - prevTarget, 1);
  const prog = Math.min(((score - prevTarget) / range) * 100, 100);
  return (
    <div style={{ padding: "10px 11px", borderRadius: 11, background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.065)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 9 }}>
        <span style={{ fontSize: 9, fontWeight: 800, color: "#3a3a3a", textTransform: "uppercase", letterSpacing: ".8px" }}>Weekly Score</span>
        <span style={{ fontSize: 18, fontWeight: 900, color: lvl?.color || "#84cc16" }}>{score}</span>
      </div>
      <div style={{ position: "relative", height: 6, borderRadius: 3, background: "rgba(255,255,255,0.05)" }}>
        <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: `${Math.max(prog, 3)}%`, background: lvl?.color || "#84cc16", borderRadius: 3, transition: "width 1s ease" }} />
        {nextLvl && <div style={{ position: "absolute", right: 0, top: -2, width: 3, height: 10, background: nextLvl.color, borderRadius: 2 }} />}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9, color: "#2a2a2a", marginTop: 4 }}>
        <span>{prevTarget} pts</span>
        {nextLvl  && <span style={{ color: nextLvl.color }}>{nextTarget} → {nextLvl.name}</span>}
        {!nextLvl && <span style={{ color: "#a78bfa" }}>Max level ✓</span>}
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// MAIN
// ─────────────────────────────────────────────────────────────────────────────
const RewardsView = ({ currentUser, userId, onClose, isSidebar = false }) => {
  const uid = userId || currentUser?.id;

  const [tab,             setTab]            = useState("levels");
  const [balance,         setBalance]        = useState(0);
  const [streak,          setStreak]         = useState(0);
  const [loading,         setLoading]        = useState(true);
  const [claimed,         setClaimed]        = useState(new Set());
  const [counts,          setCounts]         = useState({});
  const [weeklyQual,      setWeeklyQual]     = useState(false);
  const [weeklyDone,      setWeeklyDone]     = useState(false);
  const [showDeposit,     setShowDeposit]    = useState(false);
  const [toast,           setToast]          = useState(null);
  const [showAllRedeem,   setShowAllRedeem]  = useState(false);
  const [claimingTask,    setClaimingTask]   = useState(null);
  const [levelProgress,   setLevelProgress]  = useState(null);
  const [currentLevel,    setCurrentLevel]   = useState("none");
  const [weeklyPool,      setWeeklyPool]     = useState(null);
  const [userWeeklyScore, setUserWeeklyScore]= useState(0);
  const [isWide,          setIsWide]         = useState(() => typeof window !== "undefined" ? window.innerWidth >= 768 : false);
  const realtimeSub = useRef(null);

  useEffect(() => {
    const h = () => setIsWide(window.innerWidth >= 768);
    window.addEventListener("resize", h);
    return () => window.removeEventListener("resize", h);
  }, []);

  const flash = useCallback((msg, color = "#84cc16") => {
    setToast({ msg, color }); setTimeout(() => setToast(null), 2800);
  }, []);

  const fetchData = useCallback(async () => {
    if (!uid) { setLoading(false); return; }
    try {
      const [profileRes, taskStateRes, streakRes] = await Promise.allSettled([
        getRewardsProfile(uid), getTodayTaskState(uid), fetchStreak(uid),
      ]);
      if (profileRes.status   === "fulfilled") setBalance(profileRes.value.balance);
      if (taskStateRes.status === "fulfilled") { setClaimed(taskStateRes.value.claimed); setCounts(taskStateRes.value.counts); }
      if (streakRes.status    === "fulfilled") setStreak(streakRes.value);

      const monday = getMonday();
      const { data: wTx } = await supabase.from("ep_transactions").select("id")
        .eq("user_id", uid).eq("type", "bonus_grant").ilike("reason", "%Weekly quality bonus%")
        .gte("created_at", monday.toISOString()).maybeSingle();
      setWeeklyDone(!!wTx);

      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const { data: posts } = await supabase.from("posts").select("likes, comments_count")
        .eq("user_id", uid).gte("created_at", weekAgo).is("deleted_at", null);
      setWeeklyQual((posts ?? []).some(p => (p.likes || 0) + (p.comments_count || 0) >= 2));

      const { data: lvl } = await supabase.rpc("get_user_level_progress", { p_user_id: uid });
      if (lvl) { setLevelProgress(lvl); setCurrentLevel(lvl.current_level || "none"); setUserWeeklyScore(lvl.weekly_score || 0); }

      const { data: pool } = await supabase.from("reward_pools")
        .select("week_start, total_revenue, silver_share, gold_share, diamond_share, silver_users, gold_users, diamond_users, silver_total_score, gold_total_score, diamond_total_score, distributed")
        .order("week_start", { ascending: false }).limit(1).maybeSingle();
      setWeeklyPool(pool);

      if (taskStateRes.status === "fulfilled" && !taskStateRes.value.claimed.has("login")) {
        claimDailyTask(uid, "login").then(({ ep_granted }) => {
          if (ep_granted > 0) { setBalance(b => b + ep_granted); setClaimed(c => new Set([...c, "login"])); setStreak(s => s + 1); flash("+1 EP · Streak! 🔥", "#f97316"); }
        }).catch(() => {});
      }
    } catch (err) { console.warn("[RewardsView]", err?.message); }
    finally { setLoading(false); }
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
      if (ep_granted > 0) { setBalance(b => b + ep_granted); setCounts(c => ({ ...c, [taskId]: new_count })); setClaimed(c => new Set([...c, taskId])); flash(`+${ep_granted} EP`, task.color); }
    } catch (err) { flash(err?.message || "Could not claim", "#f87171"); }
    finally { setClaimingTask(null); }
  };

  const handleClaimWeekly = async () => {
    if (!weeklyQual || weeklyDone) return;
    try {
      const { ep_granted } = await claimWeeklyBonus(uid);
      setWeeklyDone(true); setBalance(b => b + ep_granted);
      flash(`+${ep_granted} EP — Quality bonus! 🏆`, "#fbbf24");
    } catch (err) { flash(err?.message || "Not qualified yet", "#f87171"); }
  };

  const handleDeposit = async (netEP) => {
    try {
      const { error } = await supabase.rpc("increment_engagement_points", {
        p_user_id: uid, p_amount: netEP, p_reason: `EP Deposit — ${netEP} EP`, p_payment_id: null, p_product_id: null,
      });
      if (error) throw error;
      setBalance(b => b + netEP); flash(`+${netEP} EP deposited! 💰`, "#84cc16");
    } catch { flash("Deposit failed.", "#f87171"); }
  };

  const handleRedeemItem = async (item) => {
    if (balance < item.cost) return;
    try {
      const { new_balance } = await spendEP(uid, item.cost, `Redeemed: ${item.label}`);
      setBalance(new_balance); flash(`${item.label} activated! ✨`, item.color);
    } catch (err) { flash(err?.message || "Redemption failed", "#f87171"); }
  };

  const activityDone   = ACTIVITY_TASKS.filter(t => claimed.has(t.id)).length;
  const nextMilestone  = Math.ceil((balance + 1) / 1000) * 1000;
  const progressPct    = Math.min(((balance % 1000) / 1000) * 100, 100);
  const balCount       = useCount(balance, 1000);
  const levelColor     = currentLevel !== "none" ? LEVELS[currentLevel]?.color : "#84cc16";
  const displayRedeem  = showAllRedeem ? REDEEM : REDEEM.slice(0, 5);

  const computeUserShare = () => {
    if (currentLevel === "none" || !weeklyPool) return 0;
    const total  = Math.max(weeklyPool?.[`${currentLevel}_total_score`] || 1, 1);
    const poolEP = weeklyPool?.[`${currentLevel}_share`] || 0;
    return Math.round(poolEP * (userWeeklyScore / total));
  };

  // ── CSS ───────────────────────────────────────────────────────────────────
  const css = `
    @keyframes rwUp    { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
    @keyframes rwToast { 0%{opacity:0;transform:translateX(-50%) translateY(6px)} 12%,82%{opacity:1;transform:translateX(-50%) translateY(0)} 100%{opacity:0} }
    @keyframes rwSpin  { to{transform:rotate(360deg)} }
    @keyframes rwGlow  { 0%,100%{box-shadow:0 0 12px rgba(132,204,22,0.12)} 50%{box-shadow:0 0 26px rgba(132,204,22,0.36)} }
    @keyframes rwSheet { from{opacity:0;transform:scale(.96)} to{opacity:1;transform:scale(1)} }
    .rws::-webkit-scrollbar{width:3px}.rws::-webkit-scrollbar-thumb{background:rgba(255,255,255,0.07);border-radius:2px}
    .rnb{transition:all .13s}.rnb:hover{background:rgba(255,255,255,0.03)!important}
  `;

  // ── Tab renderer ─────────────────────────────────────────────────────────
  const renderTab = () => {
    if (tab === "levels") return (
      <div style={{ animation: "rwUp .2s ease" }}>
        <div style={{ padding: "10px 12px", marginBottom: 13, background: "rgba(255,255,255,0.018)", border: "1px solid rgba(255,255,255,0.055)", borderRadius: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 6 }}>
            <Droplets size={12} color="#84cc16" />
            <span style={{ fontSize: 11, fontWeight: 800, color: "#666" }}>The Water Model</span>
          </div>
          <div style={{ fontSize: 10, color: "#383838", lineHeight: 1.75 }}>
            Revenue pours into each level's pool. <span style={{ color: "#84cc16" }}>Your weekly score</span> = Σ(task weight × completions). Your share = <code style={{ fontSize: 9, background: "rgba(255,255,255,0.05)", padding: "0 4px", borderRadius: 3 }}>score / level_total</code>. Every EP backed by real income.
          </div>
        </div>

        {weeklyPool && (
          <>
            <div style={{ fontSize: 9, fontWeight: 800, color: "#242424", textTransform: "uppercase", letterSpacing: "1.1px", marginBottom: 7 }}>This Week's Revenue Pools</div>
            {["silver", "gold", "diamond"].map(k => (
              <PoolBar key={k} levelKey={k} weeklyPool={weeklyPool} userScore={userWeeklyScore} isCurrent={currentLevel === k} />
            ))}
          </>
        )}

        <div style={{ fontSize: 9, fontWeight: 800, color: "#242424", textTransform: "uppercase", letterSpacing: "1.1px", margin: "14px 0 7px" }}>Level Criteria</div>
        {Object.keys(LEVELS).map(k => (
          <LevelCard key={k} levelKey={k} progress={levelProgress} currentLevel={currentLevel} userWeeklyScore={userWeeklyScore} />
        ))}
      </div>
    );

    if (tab === "activity") return (
      <div style={{ animation: "rwUp .2s ease" }}>
        <div style={{ padding: "9px 11px", marginBottom: 12, background: "rgba(96,165,250,0.04)", border: "1px solid rgba(96,165,250,0.1)", borderRadius: 11, fontSize: 10, color: "#525252", lineHeight: 1.65 }}>
          <span style={{ color: "#60a5fa", fontWeight: 800 }}>Activity Tracker:</span> Each action builds your weekly score. Score → level → proportional pool share.
        </div>
        <div style={{ fontSize: 9, fontWeight: 800, color: "#242424", textTransform: "uppercase", letterSpacing: "1.1px", marginBottom: 7 }}>Daily Activity</div>
        {ACTIVITY_TASKS.map((t, i) => (
          <ActivityCard key={t.id} task={t} done={claimed.has(t.id)} onClaim={handleClaimTask} idx={i} />
        ))}
        <div style={{ marginTop: 12, padding: "11px 12px", background: "rgba(255,255,255,0.015)", border: "1px solid rgba(255,255,255,0.055)", borderRadius: 12 }}>
          <div style={{ fontSize: 10, fontWeight: 800, color: "#484848", marginBottom: 8 }}>Score Weights</div>
          {ACTIVITY_TASKS.map(t => (
            <div key={t.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}><t.Icon size={10} color={t.color} /><span style={{ fontSize: 10, color: "#484848" }}>{t.label}</span></div>
              <span style={{ fontSize: 10, fontWeight: 800, color: t.color }}>+{t.weight} pts/action</span>
            </div>
          ))}
        </div>
        <div style={{ fontSize: 9, fontWeight: 800, color: "#242424", textTransform: "uppercase", letterSpacing: "1.1px", margin: "16px 0 7px" }}>Weekly Quality Bonus</div>
        <div style={{ padding: "13px 13px", borderRadius: 14, background: weeklyQual ? "rgba(251,191,36,0.05)" : "rgba(255,255,255,0.018)", border: `1px solid ${weeklyQual ? "rgba(251,191,36,0.18)" : "rgba(255,255,255,0.05)"}`, opacity: weeklyDone ? 0.45 : 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 38, height: 38, borderRadius: 11, flexShrink: 0, background: weeklyQual ? "rgba(251,191,36,0.09)" : "rgba(255,255,255,0.03)", border: `1px solid ${weeklyQual ? "rgba(251,191,36,0.18)" : "rgba(255,255,255,0.05)"}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
              {weeklyDone ? <CheckCircle size={17} color="#22c55e" /> : <Crown size={17} color={weeklyQual ? "#fbbf24" : "#2a2a2a"} />}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12, fontWeight: 800, color: "#d4d4d4", marginBottom: 2 }}>Weekly Quality Bonus</div>
              <div style={{ fontSize: 10, color: "#383838", marginBottom: 8 }}>≥2 genuine engagements on any post this week.</div>
              <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                <span style={{ fontSize: 14, fontWeight: 900, color: "#fbbf24" }}>+{WEEKLY_BONUS_EP} EP</span>
                {!weeklyDone
                  ? <button onClick={handleClaimWeekly} disabled={!weeklyQual}
                    style={{ padding: "4px 12px", borderRadius: 8, background: weeklyQual ? "rgba(251,191,36,0.1)" : "rgba(255,255,255,0.03)", border: `1px solid ${weeklyQual ? "rgba(251,191,36,0.22)" : "rgba(255,255,255,0.05)"}`, color: weeklyQual ? "#fbbf24" : "#2a2a2a", fontSize: 10, fontWeight: 800, cursor: weeklyQual ? "pointer" : "not-allowed", fontFamily: "inherit" }}>
                    {weeklyQual ? "Claim Bonus" : "Not qualified yet"}
                  </button>
                  : <span style={{ fontSize: 10, color: "#22c55e", fontWeight: 700 }}>✓ Claimed this week</span>}
              </div>
            </div>
          </div>
        </div>
      </div>
    );

    if (tab === "redeem") return (
      <div style={{ animation: "rwUp .2s ease" }}>
        <div style={{ fontSize: 10, color: "#383838", marginBottom: 12, lineHeight: 1.65 }}>
          Spend EP to amplify your presence. Every redemption burns EP — keeping supply healthy.
        </div>
        {displayRedeem.map((item, i) => (
          <RedeemCard key={item.id} item={item} balance={balance} onRedeem={handleRedeemItem} idx={i} />
        ))}
        {REDEEM.length > 5 && (
          <button onClick={() => setShowAllRedeem(s => !s)}
            style={{ width: "100%", padding: "9px", borderRadius: 10, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", color: "#484848", fontSize: 11, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 5, fontFamily: "inherit", marginTop: 3 }}>
            <ChevronDown size={13} style={{ transform: showAllRedeem ? "rotate(180deg)" : "none", transition: ".18s" }} />
            {showAllRedeem ? "Show less" : `+${REDEEM.length - 5} more`}
          </button>
        )}
      </div>
    );
  };

  // ── OUTER ─────────────────────────────────────────────────────────────────
  const outerStyle = isSidebar
    ? { height: "100%", borderLeft: "1px solid rgba(132,204,22,0.09)", background: "#060606", fontFamily: "'SF Pro Display',-apple-system,BlinkMacSystemFont,sans-serif", color: "#fff", display: "flex", flexDirection: "column", overflow: "hidden" }
    : { position: "fixed", inset: 0, zIndex: 9500, background: "#060606", fontFamily: "'SF Pro Display',-apple-system,BlinkMacSystemFont,sans-serif", color: "#fff", display: "flex", flexDirection: "column", overflow: "hidden" };

  return (
    <div style={outerStyle}>
      <style>{css}</style>

      {loading ? (
        <div style={{ width: 20, height: 20, border: "2.5px solid rgba(132,204,22,0.1)", borderTopColor: "#84cc16", borderRadius: "50%", animation: "rwSpin .7s linear infinite", margin: "80px auto" }} />
      ) : isWide ? (

        // ══════════════════════════════════════════════
        // PC LAYOUT — sidebar + main panel
        // ══════════════════════════════════════════════
        <div style={{ flex: 1, display: "flex", overflow: "hidden", maxWidth: 1160, margin: "0 auto", width: "100%", alignSelf: "center" }}>

          {/* ── SIDEBAR ── tight, no bloat ── */}
          <div style={{ width: 236, flexShrink: 0, borderRight: "1px solid rgba(255,255,255,0.06)", display: "flex", flexDirection: "column", overflowY: "auto", padding: "18px 13px" }} className="rws">

            {/* Logo + close */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div>
                <div style={{ fontSize: 17, fontWeight: 900, color: "#fff", letterSpacing: "-0.4px", lineHeight: 1.1 }}>Rewards</div>
                <div style={{ fontSize: 9, color: "#1e1e1e", marginTop: 1 }}>Level up · Earn revenue share</div>
              </div>
              <button onClick={onClose} style={{ width: 28, height: 28, borderRadius: 8, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#484848", flexShrink: 0 }}><X size={12} /></button>
            </div>

            {/* EP Balance */}
            <div style={{ padding: "13px 12px", borderRadius: 13, background: "rgba(132,204,22,0.08)", border: "1px solid rgba(132,204,22,0.18)", marginBottom: 9, position: "relative", overflow: "hidden", animation: "rwGlow 3s ease-in-out infinite" }}>
              <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 1, background: "linear-gradient(90deg,transparent,rgba(132,204,22,0.45),transparent)" }} />
              <div style={{ fontSize: 8, fontWeight: 800, color: "#2d4a0a", textTransform: "uppercase", letterSpacing: ".7px", marginBottom: 1 }}>EP Balance</div>
              <div style={{ fontSize: 32, fontWeight: 900, color: "#84cc16", lineHeight: 1, letterSpacing: "-1.5px", marginBottom: 1 }}>{EP(balCount)}</div>
              <div style={{ fontSize: 8, color: "#2a4a0a" }}>Engagement Points</div>
              <div style={{ marginTop: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 8, color: "#1a3606", marginBottom: 3 }}>
                  <span>Milestone</span><span>{EP(balance)} / {EP(nextMilestone)}</span>
                </div>
                <div style={{ height: 3, background: "rgba(255,255,255,0.05)", borderRadius: 2, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${progressPct}%`, background: "#84cc16", borderRadius: 2 }} />
                </div>
              </div>
            </div>

            {/* Level + Streak chips */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginBottom: 9 }}>
              <div style={{ padding: "8px 7px", borderRadius: 10, background: `${levelColor}07`, border: `1px solid ${levelColor}1a`, textAlign: "center" }}>
                <div style={{ fontSize: 19, lineHeight: 1, marginBottom: 1 }}>
                  {currentLevel === "diamond" ? "💎" : currentLevel === "gold" ? "🥇" : currentLevel === "silver" ? "🥈" : "🔵"}
                </div>
                <div style={{ fontSize: 11, fontWeight: 900, color: levelColor }}>{currentLevel === "none" ? "None" : LEVELS[currentLevel]?.name}</div>
                <div style={{ fontSize: 8, color: "#242424", textTransform: "uppercase", fontWeight: 700, marginTop: 1 }}>Level</div>
              </div>
              <div style={{ padding: "8px 7px", borderRadius: 10, background: "rgba(249,115,22,0.06)", border: "1px solid rgba(249,115,22,0.15)", textAlign: "center" }}>
                <div style={{ fontSize: 19, fontWeight: 900, color: "#f97316", lineHeight: 1, marginBottom: 1 }}>{streak}</div>
                <div style={{ fontSize: 11, fontWeight: 900, color: "#f97316" }}>day{streak !== 1 ? "s" : ""}</div>
                <div style={{ fontSize: 8, color: "#242424", textTransform: "uppercase", fontWeight: 700, marginTop: 1 }}>Streak 🔥</div>
              </div>
            </div>

            {/* Score gauge */}
            <div style={{ marginBottom: 9 }}>
              <ScoreGauge score={userWeeklyScore} currentLevel={currentLevel} />
            </div>

            {/* Weekly share estimate */}
            {currentLevel !== "none" && weeklyPool && (
              <div style={{ padding: "9px 10px", borderRadius: 10, background: `${levelColor}06`, border: `1px solid ${levelColor}14`, marginBottom: 9 }}>
                <div style={{ fontSize: 8, fontWeight: 800, color: "#2e2e2e", marginBottom: 2 }}>Your Weekly Share</div>
                <div style={{ fontSize: 18, fontWeight: 900, color: levelColor, lineHeight: 1 }}>~{EP(computeUserShare())} EP</div>
                <div style={{ fontSize: 8, color: "#242424", marginTop: 2 }}>
                  {LEVELS[currentLevel]?.poolPct}% pool · {weeklyPool.distributed ? "Distributed ✓" : "Pending"}
                </div>
              </div>
            )}

            {/* Action buttons */}
            <button onClick={() => setShowDeposit(true)}
              style={{ width: "100%", padding: "9px", borderRadius: 10, background: "linear-gradient(135deg,#84cc16,#4d7c0f)", border: "none", color: "#000", fontSize: 12, fontWeight: 900, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 5, fontFamily: "inherit", marginBottom: 5 }}>
              <Wallet size={12} /> Deposit EP
            </button>
            <button onClick={() => setTab("activity")}
              style={{ width: "100%", padding: "7px", borderRadius: 10, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", color: "#484848", fontSize: 11, fontWeight: 800, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 5, fontFamily: "inherit", marginBottom: 13 }}>
              <Target size={11} /> {activityDone}/{ACTIVITY_TASKS.length} done today
            </button>

            {/* Nav */}
            <div style={{ fontSize: 8, fontWeight: 800, color: "#191919", textTransform: "uppercase", letterSpacing: "1px", marginBottom: 4, paddingLeft: 2 }}>Navigate</div>
            {NAV.map(({ key, Icon: NavIcon, label }) => (
              <button key={key} className="rnb" onClick={() => setTab(key)}
                style={{ width: "100%", display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", borderRadius: 9, background: tab === key ? "rgba(132,204,22,0.09)" : "transparent", border: `1px solid ${tab === key ? "rgba(132,204,22,0.19)" : "transparent"}`, color: tab === key ? "#84cc16" : "#404040", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", marginBottom: 2, textAlign: "left" }}>
                <NavIcon size={13} color={tab === key ? "#84cc16" : "#303030"} />
                {label}
                {tab === key && <div style={{ marginLeft: "auto", width: 4, height: 4, borderRadius: "50%", background: "#84cc16" }} />}
              </button>
            ))}
          </div>

          {/* ── MAIN PANEL ── */}
          <div style={{ flex: 1, overflowY: "auto", padding: "22px 22px 80px" }} className="rws">
            <div style={{ marginBottom: 18 }}>
              <div style={{ fontSize: 20, fontWeight: 900, color: "#fff", letterSpacing: "-0.4px", marginBottom: 2 }}>
                {NAV.find(n => n.key === tab)?.label}
              </div>
              <div style={{ fontSize: 10, color: "#2a2a2a" }}>
                {tab === "levels"   && "Score-based levels · proportional revenue pools"}
                {tab === "activity" && "Complete tasks to build your weekly engagement score"}
                {tab === "redeem"   && "Burn EP for perks · keeps supply healthy"}
              </div>
            </div>
            {renderTab()}
          </div>
        </div>

      ) : (

        // ══════════════════════════════════════════════
        // MOBILE — compact, no wasted space
        // ══════════════════════════════════════════════
        <div style={{ flex: 1, overflowY: "auto" }} className="rws">

          {/* Top bar */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", background: "rgba(6,6,6,0.98)", borderBottom: "1px solid rgba(132,204,22,0.07)", flexShrink: 0 }}>
            <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: 9, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#555", flexShrink: 0 }}><X size={13} /></button>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 16, fontWeight: 900, color: "#fff", letterSpacing: "-0.3px" }}>Rewards</div>
              <div style={{ fontSize: 9, color: "#1e1e1e" }}>Level up · Share ecosystem revenue</div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 4, padding: "5px 11px", borderRadius: 10, background: "rgba(132,204,22,0.08)", border: "1px solid rgba(132,204,22,0.18)", animation: "rwGlow 3s ease-in-out infinite" }}>
              <Zap size={11} color="#84cc16" />
              <span style={{ fontSize: 13, fontWeight: 900, color: "#84cc16" }}>{EP(balCount)}</span>
              <span style={{ fontSize: 8, color: "#4d7c0f", fontWeight: 800 }}>EP</span>
            </div>
          </div>

          {/* Stats strip — 4 columns, one row */}
          <div style={{ display: "flex", gap: 0, margin: "10px 14px 0", background: "rgba(255,255,255,0.015)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: 12, overflow: "hidden" }}>
            {[
              { label: "Level",  val: currentLevel === "none" ? "—" : LEVELS[currentLevel]?.name, color: levelColor,  top: currentLevel === "diamond" ? "💎" : currentLevel === "gold" ? "🥇" : currentLevel === "silver" ? "🥈" : "🔵", isEmoji: true },
              { label: "Streak", val: `${streak}d`,             color: "#f97316", top: "🔥", isEmoji: true },
              { label: "Score",  val: `${userWeeklyScore}`,     color: "#84cc16", top: null, isEmoji: false },
              { label: "Today",  val: `${activityDone}/${ACTIVITY_TASKS.length}`, color: "#60a5fa", top: null, isEmoji: false },
            ].map((s, i, arr) => (
              <div key={s.label} style={{ flex: 1, padding: "9px 0", textAlign: "center", borderRight: i < arr.length - 1 ? "1px solid rgba(255,255,255,0.05)" : "none" }}>
                {s.isEmoji && <div style={{ fontSize: 14, lineHeight: 1, marginBottom: 1 }}>{s.top}</div>}
                <div style={{ fontSize: s.isEmoji ? 10 : 15, fontWeight: 900, color: s.color, lineHeight: 1, marginBottom: 1 }}>{s.val}</div>
                <div style={{ fontSize: 8, color: "#242424", textTransform: "uppercase", fontWeight: 700 }}>{s.label}</div>
              </div>
            ))}
          </div>

          {/* Milestone + share strip */}
          <div style={{ margin: "7px 14px 0", padding: "8px 11px", background: "rgba(132,204,22,0.04)", border: "1px solid rgba(132,204,22,0.09)", borderRadius: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 8, color: "#242424", marginBottom: 3 }}>
              <span>EP Milestone</span><span>{EP(balance)} / {EP(nextMilestone)}</span>
            </div>
            <div style={{ height: 3, background: "rgba(255,255,255,0.05)", borderRadius: 2, overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${progressPct}%`, background: "linear-gradient(90deg,#84cc16,#4d7c0f)", borderRadius: 2 }} />
            </div>
            {currentLevel !== "none" && weeklyPool && (
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 8, marginTop: 4 }}>
                <span style={{ color: "#2a2a2a" }}>Weekly share est.</span>
                <span style={{ color: levelColor, fontWeight: 800 }}>~{EP(computeUserShare())} EP</span>
              </div>
            )}
          </div>

          {/* Action buttons */}
          <div style={{ display: "flex", gap: 7, padding: "7px 14px 0" }}>
            <button onClick={() => setShowDeposit(true)} style={{ flex: 1, padding: "9px", borderRadius: 10, background: "linear-gradient(135deg,#84cc16,#4d7c0f)", border: "none", color: "#000", fontSize: 12, fontWeight: 900, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 5, fontFamily: "inherit" }}>
              <Wallet size={12} /> Deposit EP
            </button>
            <button onClick={() => setTab("activity")} style={{ flex: 1, padding: "9px", borderRadius: 10, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", color: "#555", fontSize: 11, fontWeight: 800, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 5, fontFamily: "inherit" }}>
              <Target size={11} /> {activityDone}/{ACTIVITY_TASKS.length} Today
            </button>
          </div>

          {/* Tab bar */}
          <div style={{ display: "flex", margin: "7px 14px 0", background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: 10, padding: 3, gap: 2 }}>
            {NAV.map(({ key, label }) => (
              <button key={key} onClick={() => setTab(key)}
                style={{ flex: 1, padding: "7px 2px", borderRadius: 7, border: "none", fontSize: 10, fontWeight: 800, cursor: "pointer", fontFamily: "inherit", background: tab === key ? "rgba(132,204,22,0.1)" : "transparent", color: tab === key ? "#84cc16" : "#404040", outline: tab === key ? "1px solid rgba(132,204,22,0.19)" : "none", outlineOffset: "-1px", transition: "all .12s" }}>
                {key === "levels" ? "Levels" : key === "activity" ? "Activity" : "Redeem"}
              </button>
            ))}
          </div>

          <div style={{ padding: "10px 14px 100px" }}>
            {renderTab()}
          </div>
        </div>
      )}

      {showDeposit && <DepositSheet onClose={() => setShowDeposit(false)} onSuccess={handleDeposit} />}
      {toast && <Toast msg={toast.msg} color={toast.color} />}
    </div>
  );
};

export default RewardsView;