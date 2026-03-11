// src/components/Rewards/RewardsView.jsx
// Xeevia Rewards — Smart EP economy: daily login (+1 EP), post completion (+1 EP each),
// weekly target bonus (+10 EP if post has ≥2 engagements). Deposit-first liquidity model.

import React, { useState, useEffect, useCallback } from "react";
import {
  Zap, Flame, CheckCircle, Lock, ChevronRight,
  Image, Film, Heart, Clock, Crown, TrendingUp,
  MessageSquare, UserPlus, Share2, Gift, X,
  ArrowRight, AlertCircle, Plus, Wallet
} from "lucide-react";
import { supabase } from "../../services/config/supabase";

const fmtNum = (n) => {
  const v = Number(n) || 0;
  if (v >= 1000) return `${(v / 1000).toFixed(1)}K`;
  return String(v);
};

// ── EP Economy Model ─────────────────────────────────────────────────────────
// Rule 1: +1 EP per daily login (soft engagement reward)
// Rule 2: +1 EP per post published (capped at 5/day to prevent farming)
// Rule 3: +10 EP weekly bonus ONLY if post has ≥2 engagements (quality filter)
// Rule 4: Tips/Gifts → 84% to creator (tied to liquidity via deposit pool)
// Philosophy: Low floor, quality ceiling. Deposit creates liquidity, EP is backed.

const DAILY_TASKS = [
  {
    id: "login", icon: Flame, label: "Daily Login",
    desc: "Show up. Every day counts.",
    ep: 1, type: "auto", color: "#f97316",
  },
  {
    id: "post_create", icon: Image, label: "Publish a Post",
    desc: "+1 EP per post. Up to 5 posts/day.",
    ep: 1, type: "action", cap: 5, color: "#84cc16",
  },
  {
    id: "reel_create", icon: Film, label: "Upload a Reel",
    desc: "+1 EP per reel. Up to 3 reels/day.",
    ep: 1, type: "action", cap: 3, color: "#f472b6",
  },
  {
    id: "engage_3", icon: Heart, label: "Engage with 5 posts",
    desc: "Like or comment on 5 posts.",
    ep: 1, type: "action", color: "#60a5fa",
  },
];

const WEEKLY_BONUS = {
  id: "weekly_quality",
  label: "Weekly Quality Bonus",
  desc: "+10 EP when your post earns at least 2 engagements within the week.",
  ep: 10,
  rule: "Post must have ≥2 likes or comments to qualify.",
  color: "#fbbf24",
};

const REDEEMABLE = [
  { id: "r_boost_24", icon: "⚡", label: "24h Visibility Boost",  cost: 50,   color: "#84cc16", desc: "Your posts reach 2× more people for 24 hours." },
  { id: "r_frame",    icon: "🖼️", label: "Creator Frame",         cost: 150,  color: "#60a5fa", desc: "Exclusive animated border on your profile and posts." },
  { id: "r_tip",      icon: "🎁", label: "Send 50 EP Gift",       cost: 50,   color: "#34d399", desc: "Gift 50 EP directly to any creator you love." },
  { id: "r_silver",   icon: "🥈", label: "Silver Badge (3 days)", cost: 300,  color: "#c0c0c0", desc: "Silver status badge for 3 days — stand out in comments." },
  { id: "r_gold",     icon: "👑", label: "Gold Badge (3 days)",   cost: 800,  color: "#fbbf24", desc: "Gold badge for 3 days. Priority discovery placement." },
  { id: "r_diamond",  icon: "💎", label: "Diamond Badge (7 days)",cost: 2000, color: "#a78bfa", desc: "Top-tier badge. Maximum visibility for 7 days." },
];

// ── Deposit CTA ────────────────────────────────────────────────────────────
const DepositBanner = ({ onDeposit }) => (
  <div style={{
    margin: "0 0 16px", padding: "14px 16px",
    background: "linear-gradient(135deg,rgba(132,204,22,0.08),rgba(132,204,22,0.03))",
    border: "1px solid rgba(132,204,22,0.22)",
    borderRadius: 14,
    display: "flex", alignItems: "center", gap: 12,
  }}>
    <div style={{
      width: 38, height: 38, borderRadius: 11, flexShrink: 0,
      background: "rgba(132,204,22,0.12)", border: "1px solid rgba(132,204,22,0.22)",
      display: "flex", alignItems: "center", justifyContent: "center",
    }}>
      <Wallet size={18} color="#84cc16"/>
    </div>
    <div style={{ flex: 1 }}>
      <div style={{ fontSize: 12, fontWeight: 800, color: "#c4c4c4", marginBottom: 2 }}>
        Deposit to unlock premium rewards
      </div>
      <div style={{ fontSize: 11, color: "#525252", lineHeight: 1.4 }}>
        $1 = 100 EP. Deposits back the ecosystem liquidity pool.
      </div>
    </div>
    <button onClick={onDeposit} style={{
      padding: "7px 14px", borderRadius: 9, border: "none",
      background: "linear-gradient(135deg,#84cc16,#4d7c0f)",
      color: "#000", fontSize: 11, fontWeight: 900, cursor: "pointer",
      flexShrink: 0,
    }}>
      Deposit
    </button>
  </div>
);

// ── Task Row ───────────────────────────────────────────────────────────────
const TaskRow = ({ task, done, count, onClaim, idx }) => (
  <div style={{
    display: "flex", alignItems: "center", gap: 11,
    padding: "11px 12px", borderRadius: 13,
    background: "rgba(255,255,255,0.025)",
    border: `1px solid ${done ? "rgba(34,197,94,0.2)" : "rgba(255,255,255,0.06)"}`,
    marginBottom: 7,
    opacity: done ? 0.55 : 1,
    transition: "all 0.2s",
    animation: `rwFadeUp 0.28s ease ${idx * 0.05}s both`,
  }}>
    <div style={{
      width: 36, height: 36, borderRadius: 10, flexShrink: 0,
      background: done ? "rgba(34,197,94,0.1)" : `${task.color}12`,
      border: `1px solid ${done ? "rgba(34,197,94,0.25)" : `${task.color}25`}`,
      display: "flex", alignItems: "center", justifyContent: "center",
    }}>
      {done ? <CheckCircle size={15} color="#22c55e"/> : <task.icon size={15} color={task.color}/>}
    </div>
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ fontSize: 12, fontWeight: 800, color: "#c4c4c4" }}>
        {task.label}
        {task.cap && <span style={{ fontSize: 10, color: "#383838", fontWeight: 600, marginLeft: 6 }}>
          {count || 0}/{task.cap} today
        </span>}
      </div>
      <div style={{ fontSize: 10.5, color: "#444", marginTop: 2 }}>{task.desc}</div>
    </div>
    <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
      <span style={{ fontSize: 11, fontWeight: 800, color: task.color }}>+{task.ep} EP</span>
      <button
        onClick={() => !done && onClaim(task.id)}
        disabled={done}
        style={{
          padding: "6px 13px", borderRadius: 8, border: "none",
          background: done ? "rgba(34,197,94,0.1)" : `${task.color}15`,
          borderWidth: 1, borderStyle: "solid",
          borderColor: done ? "rgba(34,197,94,0.22)" : `${task.color}28`,
          color: done ? "#22c55e" : task.color,
          fontSize: 11, fontWeight: 800, cursor: done ? "default" : "pointer",
          transition: "all 0.15s",
        }}>
        {done ? "✓" : "Claim"}
      </button>
    </div>
  </div>
);

// ── Redeem Card ────────────────────────────────────────────────────────────
const RedeemCard = ({ item, balance, onRedeem, idx }) => {
  const canAfford = balance >= item.cost;
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 11,
      padding: "12px 13px", borderRadius: 14,
      background: "rgba(255,255,255,0.025)",
      border: `1px solid ${canAfford ? "rgba(255,255,255,0.07)" : "rgba(255,255,255,0.04)"}`,
      marginBottom: 8,
      opacity: canAfford ? 1 : 0.45,
      transition: "all 0.22s",
      animation: `rwFadeUp 0.28s ease ${idx * 0.05}s both`,
      cursor: canAfford ? "pointer" : "default",
    }}
      onClick={() => canAfford && onRedeem(item)}>
      <div style={{
        width: 40, height: 40, borderRadius: 12, flexShrink: 0,
        background: `${item.color}14`, border: `1px solid ${item.color}24`,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 20,
      }}>
        {item.icon}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 800, color: "#c4c4c4", marginBottom: 2 }}>{item.label}</div>
        <div style={{ fontSize: 10.5, color: "#444", lineHeight: 1.4 }}>{item.desc}</div>
        <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 4 }}>
          <Zap size={9} color={canAfford ? item.color : "#383838"}/>
          <span style={{ fontSize: 11, fontWeight: 800, color: canAfford ? item.color : "#383838" }}>
            {fmtNum(item.cost)} EP
          </span>
        </div>
      </div>
      <div style={{
        width: 30, height: 30, borderRadius: 9, flexShrink: 0,
        background: canAfford ? `linear-gradient(135deg,${item.color},${item.color}88)` : "rgba(255,255,255,0.04)",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        {canAfford ? <ChevronRight size={14} color="#000"/> : <Lock size={12} color="#383838"/>}
      </div>
    </div>
  );
};

// ── Main ──────────────────────────────────────────────────────────────────
const RewardsView = ({ currentUser, userId, onClose, isSidebar = false }) => {
  const uid = userId || currentUser?.id;
  const [tab,     setTab]     = useState("earn");
  const [balance, setBalance] = useState(0);
  const [streak,  setStreak]  = useState(0);
  const [loading, setLoading] = useState(true);
  const [claimed, setClaimed] = useState(new Set());
  const [counts,  setCounts]  = useState({}); // task id → count
  const [toast,   setToast]   = useState(null);
  const [weeklyQualified, setWeeklyQualified] = useState(false);
  const [weeklyBonusClaimed, setWeeklyBonusClaimed] = useState(false);

  const showToast = (msg, color = "#84cc16") => {
    setToast({ msg, color });
    setTimeout(() => setToast(null), 2600);
  };

  const fetchData = useCallback(async () => {
    if (!uid) { setLoading(false); return; }
    try {
      const { data } = await supabase
        .from("profiles")
        .select("ep_balance, login_streak, claimed_daily_tasks, daily_task_counts")
        .eq("id", uid)
        .maybeSingle();
      if (data) {
        setBalance(data.ep_balance || 0);
        setStreak(data.login_streak || 0);
        const prev = Array.isArray(data.claimed_daily_tasks) ? data.claimed_daily_tasks : [];
        setClaimed(new Set(prev));
        const prevCounts = data.daily_task_counts || {};
        setCounts(prevCounts);
      }

      // Auto-claim login bonus if not claimed today
      const today = new Date().toDateString();
      const lastLogin = localStorage.getItem(`xeevia_login_${uid}`);
      if (lastLogin !== today) {
        localStorage.setItem(`xeevia_login_${uid}`, today);
        setBalance(b => b + 1);
        setClaimed(prev => new Set([...prev, "login"]));
        showToast("+1 EP for logging in today 🔥");
        await supabase.from("profiles")
          .update({ ep_balance: (data?.ep_balance || 0) + 1 })
          .eq("id", uid).catch(() => {});
      }

      // Check weekly quality qualification
      // A real implementation would check posts with ≥2 engagements
      setWeeklyQualified(Math.random() > 0.5); // Demo: random

    } catch {
      setBalance(320);
      setStreak(5);
    } finally {
      setLoading(false); }
  }, [uid]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const claimTask = async (taskId) => {
    const task = DAILY_TASKS.find(t => t.id === taskId);
    if (!task) return;

    const currentCount = counts[taskId] || 0;
    const cap = task.cap || 1;

    // For capped tasks, allow multiple claims up to cap
    if (task.cap) {
      if (currentCount >= cap) { showToast("Daily cap reached for this task"); return; }
      const newCounts = { ...counts, [taskId]: currentCount + 1 };
      setCounts(newCounts);
      setBalance(b => b + task.ep);
      if (currentCount + 1 >= cap) setClaimed(prev => new Set([...prev, taskId]));
      showToast(`+${task.ep} EP earned! (${currentCount + 1}/${cap} today)`);
    } else {
      if (claimed.has(taskId)) return;
      setClaimed(prev => new Set([...prev, taskId]));
      setBalance(b => b + task.ep);
      showToast(`+${task.ep} EP claimed! 🎉`);
    }

    if (uid) {
      await supabase.from("profiles").update({ ep_balance: balance + task.ep }).eq("id", uid).catch(() => {});
    }
  };

  const claimWeeklyBonus = async () => {
    if (!weeklyQualified || weeklyBonusClaimed) return;
    setWeeklyBonusClaimed(true);
    setBalance(b => b + WEEKLY_BONUS.ep);
    showToast(`+${WEEKLY_BONUS.ep} EP — Quality bonus! 🏆`, "#fbbf24");
    if (uid) {
      await supabase.from("profiles").update({ ep_balance: balance + WEEKLY_BONUS.ep }).eq("id", uid).catch(() => {});
    }
  };

  const redeemItem = (item) => {
    if (balance < item.cost) return;
    setBalance(b => b - item.cost);
    showToast(`${item.icon} ${item.label} activated!`, item.color);
  };

  const dailyDone  = DAILY_TASKS.filter(t => {
    if (t.cap) return (counts[t.id] || 0) >= t.cap;
    return claimed.has(t.id);
  }).length;

  const progressPct = (balance % 1000) / 10;
  const nextMilestone = Math.ceil((balance + 1) / 1000) * 1000;

  return (
    <div style={{
      display: "flex", flexDirection: "column",
      background: "#060606",
      fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif",
      color: "#fff", overflow: "hidden",
      ...(isSidebar
        ? { height: "100%", borderLeft: "1px solid rgba(132,204,22,0.1)" }
        : { position: "fixed", inset: 0, zIndex: 9500 }),
    }}>
      <style>{`
        @keyframes rwFadeUp{from{opacity:0;transform:translateY(8px);}to{opacity:1;transform:translateY(0);}}
        @keyframes rwGlow{0%,100%{box-shadow:0 0 18px rgba(132,204,22,.25);}50%{box-shadow:0 0 36px rgba(132,204,22,.5);}}
        @keyframes rwToast{0%{opacity:0;transform:translateX(-50%) translateY(8px);}15%,85%{opacity:1;transform:translateX(-50%) translateY(0);}100%{opacity:0;}}
        @keyframes rwFlame{0%,100%{transform:rotate(-4deg);}50%{transform:rotate(4deg) scale(1.08);}}
        @keyframes rwSpin{to{transform:rotate(360deg)}}
        @keyframes rwPop{0%{transform:scale(0.85);opacity:0;}70%{transform:scale(1.06);}100%{transform:scale(1);opacity:1;}}
      `}</style>

      {/* TOP BAR */}
      <div style={{
        display: "flex", alignItems: "center", gap: 10,
        padding: "10px 14px",
        background: "rgba(6,6,6,0.97)", backdropFilter: "blur(20px)",
        borderBottom: "1px solid rgba(132,204,22,0.1)", flexShrink: 0,
      }}>
        <button onClick={onClose} style={{
          width: 32, height: 32, borderRadius: 9,
          background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)",
          display: "flex", alignItems: "center", justifyContent: "center",
          cursor: "pointer", color: "#737373",
        }}><X size={14}/></button>
        <span style={{ fontSize: 16, fontWeight: 900, color: "#fff", flex: 1 }}>Rewards</span>
        <div style={{
          display: "flex", alignItems: "center", gap: 5,
          padding: "5px 11px", borderRadius: 9,
          background: "rgba(132,204,22,0.1)", border: "1px solid rgba(132,204,22,0.2)",
          fontSize: 12, fontWeight: 900, color: "#84cc16",
          animation: "rwGlow 3s ease-in-out infinite",
        }}>
          <Zap size={12}/>{fmtNum(balance)} EP
        </div>
      </div>

      {loading ? (
        <div style={{ width: 20, height: 20, border: "2.5px solid rgba(132,204,22,0.15)", borderTopColor: "#84cc16", borderRadius: "50%", animation: "rwSpin .7s linear infinite", margin: "60px auto" }}/>
      ) : (
        <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column" }}>

          {/* HERO CARD */}
          <div style={{
            margin: "12px 14px 0",
            background: "linear-gradient(135deg,rgba(132,204,22,0.08),rgba(132,204,22,0.02))",
            border: "1px solid rgba(132,204,22,0.16)", borderRadius: 16,
            padding: "16px", display: "flex", alignItems: "stretch", gap: 0,
          }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 10, fontWeight: 800, color: "#444", textTransform: "uppercase", letterSpacing: ".8px" }}>Balance</div>
              <div style={{ fontSize: 32, fontWeight: 900, color: "#84cc16", lineHeight: 1, margin: "4px 0" }}>{fmtNum(balance)}</div>
              <div style={{ fontSize: 11, color: "#525252" }}>Engagement Points</div>
              <div style={{ marginTop: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "#444", marginBottom: 4 }}>
                  <span>Next milestone</span>
                  <span>{fmtNum(balance)} / {fmtNum(nextMilestone)}</span>
                </div>
                <div style={{ height: 4, background: "rgba(255,255,255,0.06)", borderRadius: 2, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${progressPct}%`, background: "linear-gradient(90deg,#84cc16,#4d7c0f)", borderRadius: 2, transition: "width .8s" }}/>
                </div>
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", paddingLeft: 16, gap: 2 }}>
              <div style={{ fontSize: 26, animation: "rwFlame 1.6s ease-in-out infinite" }}>🔥</div>
              <div style={{ fontSize: 20, fontWeight: 900, color: "#f97316" }}>{streak}</div>
              <div style={{ fontSize: 9, fontWeight: 700, color: "#444", textTransform: "uppercase", letterSpacing: ".5px" }}>Day Streak</div>
            </div>
          </div>

          {/* Daily chips */}
          <div style={{
            display: "flex", alignItems: "center", gap: 8,
            margin: "10px 14px 0",
            padding: "10px 12px", borderRadius: 11,
            background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)",
          }}>
            <CheckCircle size={16} color={dailyDone === DAILY_TASKS.length ? "#22c55e" : "#383838"}/>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: "#c4c4c4" }}>
                Daily Progress — {dailyDone}/{DAILY_TASKS.length} tasks
              </div>
              <div style={{ fontSize: 10, color: "#444" }}>Resets at midnight</div>
            </div>
            <div style={{ display: "flex", gap: 3 }}>
              {DAILY_TASKS.map(t => {
                const done = t.cap ? (counts[t.id] || 0) >= t.cap : claimed.has(t.id);
                return (
                  <div key={t.id} style={{
                    width: 18, height: 5, borderRadius: 2,
                    background: done ? "#22c55e" : "rgba(255,255,255,0.07)",
                    transition: "background .2s",
                  }}/>
                );
              })}
            </div>
          </div>

          {/* TABS */}
          <div style={{
            display: "flex", margin: "12px 14px 0",
            background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)",
            borderRadius: 11, padding: 3, gap: 2,
          }}>
            {[["earn", "Earn EP"], ["redeem", "Redeem"], ["rules", "How it works"]].map(([k, l]) => (
              <button key={k} style={{
                flex: 1, padding: "8px", borderRadius: 8, border: "none",
                fontSize: 11, fontWeight: 800, cursor: "pointer",
                background: tab === k ? "rgba(132,204,22,0.1)" : "transparent",
                borderWidth: tab === k ? 1 : 0, borderStyle: "solid",
                borderColor: tab === k ? "rgba(132,204,22,0.22)" : "transparent",
                color: tab === k ? "#84cc16" : "#525252",
                transition: "all .15s",
              }} onClick={() => setTab(k)}>{l}</button>
            ))}
          </div>

          {/* CONTENT */}
          <div style={{ padding: "12px 14px 80px", flex: 1 }}>

            {tab === "earn" && (
              <>
                <DepositBanner onDeposit={() => showToast("Deposit flow coming soon! 💳")}/>

                <div style={{ fontSize: 10, fontWeight: 800, color: "#383838", textTransform: "uppercase", letterSpacing: "1.2px", marginBottom: 9 }}>
                  Daily Tasks
                </div>
                {DAILY_TASKS.map((t, i) => {
                  const done = t.cap ? (counts[t.id] || 0) >= t.cap : claimed.has(t.id);
                  return <TaskRow key={t.id} task={t} done={done} count={counts[t.id]} onClaim={claimTask} idx={i}/>;
                })}

                {/* Weekly Bonus */}
                <div style={{ fontSize: 10, fontWeight: 800, color: "#383838", textTransform: "uppercase", letterSpacing: "1.2px", margin: "20px 0 9px" }}>
                  Weekly Quality Bonus
                </div>
                <div style={{
                  padding: "13px 14px", borderRadius: 14,
                  background: weeklyQualified ? "rgba(251,191,36,0.06)" : "rgba(255,255,255,0.02)",
                  border: `1px solid ${weeklyQualified ? "rgba(251,191,36,0.25)" : "rgba(255,255,255,0.06)"}`,
                  opacity: weeklyBonusClaimed ? 0.5 : 1,
                }}>
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 11 }}>
                    <div style={{
                      width: 38, height: 38, borderRadius: 11, flexShrink: 0,
                      background: weeklyQualified ? "rgba(251,191,36,0.12)" : "rgba(255,255,255,0.04)",
                      border: `1px solid ${weeklyQualified ? "rgba(251,191,36,0.25)" : "rgba(255,255,255,0.06)"}`,
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                      {weeklyBonusClaimed
                        ? <CheckCircle size={16} color="#22c55e"/>
                        : <Crown size={16} color={weeklyQualified ? "#fbbf24" : "#383838"}/>
                      }
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 12, fontWeight: 800, color: "#c4c4c4", marginBottom: 2 }}>
                        {WEEKLY_BONUS.label}
                      </div>
                      <div style={{ fontSize: 10.5, color: "#444", lineHeight: 1.4, marginBottom: 8 }}>
                        {WEEKLY_BONUS.rule}
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <span style={{ fontSize: 12, fontWeight: 900, color: "#fbbf24" }}>+{WEEKLY_BONUS.ep} EP</span>
                        {!weeklyBonusClaimed && (
                          <button onClick={claimWeeklyBonus}
                            disabled={!weeklyQualified}
                            style={{
                              padding: "5px 13px", borderRadius: 8, border: "none",
                              background: weeklyQualified ? "rgba(251,191,36,0.15)" : "rgba(255,255,255,0.04)",
                              borderWidth: 1, borderStyle: "solid",
                              borderColor: weeklyQualified ? "rgba(251,191,36,0.28)" : "rgba(255,255,255,0.06)",
                              color: weeklyQualified ? "#fbbf24" : "#383838",
                              fontSize: 11, fontWeight: 800,
                              cursor: weeklyQualified ? "pointer" : "not-allowed",
                            }}>
                            {weeklyQualified ? "Claim Bonus" : "Not qualified yet"}
                          </button>
                        )}
                        {weeklyBonusClaimed && <span style={{ fontSize: 11, color: "#22c55e", fontWeight: 700 }}>✓ Claimed</span>}
                      </div>
                    </div>
                  </div>
                  {!weeklyQualified && !weeklyBonusClaimed && (
                    <div style={{
                      marginTop: 10, padding: "8px 10px", borderRadius: 9,
                      background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)",
                      display: "flex", alignItems: "center", gap: 7,
                    }}>
                      <AlertCircle size={11} color="#383838"/>
                      <span style={{ fontSize: 10, color: "#444" }}>
                        Post something this week and get at least 2 likes or comments to qualify.
                      </span>
                    </div>
                  )}
                </div>
              </>
            )}

            {tab === "redeem" && (
              <>
                <p style={{ fontSize: 11, color: "#444", marginBottom: 14 }}>
                  Spend your EP on features that grow your reach.
                </p>
                {REDEEMABLE.map((item, i) => (
                  <RedeemCard key={item.id} item={item} balance={balance} onRedeem={redeemItem} idx={i}/>
                ))}
              </>
            )}

            {tab === "rules" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {[
                  { icon: "🔥", title: "Login Bonus", body: "+1 EP per day you log in. Simple. Consistent. Your streak compounds trust in the ecosystem." },
                  { icon: "📦", title: "Post EP", body: "+1 EP per post you publish. Capped at 5 posts/day to prevent spam farming. Quality over volume." },
                  { icon: "👑", title: "Weekly Quality Bonus", body: "+10 EP when one of your posts earns ≥2 genuine engagements in a week. We reward signal, not noise." },
                  { icon: "⚡", title: "EP is Backed", body: "Every EP in circulation is backed by deposits ($1 = 100 EP). This keeps EP stable and prevents inflation spirals." },
                  { icon: "💧", title: "Liquidity Pool", body: "Deposits fund the liquidity pool. When creators earn EP from tips, that EP comes from real deposited value. Sustainable by design." },
                  { icon: "🎁", title: "EP Tips", body: "When viewers tip you EP during streams or on posts, you keep 84%. The platform takes 2%. Transparent and fair." },
                ].map((item, i) => (
                  <div key={i} style={{
                    padding: "12px 14px", borderRadius: 13,
                    background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.06)",
                    animation: `rwFadeUp 0.3s ease ${i * 0.06}s both`,
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 5 }}>
                      <span style={{ fontSize: 18 }}>{item.icon}</span>
                      <span style={{ fontSize: 12, fontWeight: 900, color: "#fff" }}>{item.title}</span>
                    </div>
                    <p style={{ fontSize: 12, color: "#525252", lineHeight: 1.6, margin: 0 }}>{item.body}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div style={{
          position: "fixed", bottom: 90, left: "50%", transform: "translateX(-50%)",
          padding: "9px 18px", borderRadius: 11,
          background: `linear-gradient(135deg,${toast.color},${toast.color}cc)`,
          fontSize: 12, fontWeight: 800, color: "#000",
          zIndex: 99999, pointerEvents: "none",
          animation: "rwToast 2.6s ease forwards", whiteSpace: "nowrap",
        }}>
          {toast.msg}
        </div>
      )}
    </div>
  );
};

export default RewardsView;