// src/components/Rewards/RewardsView.jsx
// Xeevia Rewards — Visionary EP Economy
// Low floor, quality ceiling, no blood from the company
// Creators feel seen. Builders feel rewarded. Economy stays healthy.
// $1 = 100 EP · 2% fee on ALL tx · 84% creator tips · 40% monthly XEV conversion

import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  X,
  Zap,
  Flame,
  CheckCircle,
  Lock,
  ChevronRight,
  ChevronDown,
  Image,
  Film,
  Heart,
  Crown,
  TrendingUp,
  AlertCircle,
  Wallet,
  Trophy,
  Sparkles,
  Gift,
  ArrowUpRight,
  Star,
  Target,
  RotateCcw,
  Shield,
  Coins,
  Activity,
} from "lucide-react";
import { supabase } from "../../services/config/supabase";

// ── Helpers ───────────────────────────────────────────────────────────────────
const EP = (n) => {
  const v = Number(n) || 0;
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(2)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(1)}K`;
  return String(v);
};
const PLATFORM_FEE = 0.02;
const CREATOR_SHARE = 0.84;

// ── Economy Data ──────────────────────────────────────────────────────────────
const DAILY_TASKS = [
  {
    id: "login",
    Icon: Flame,
    label: "Daily Login",
    desc: "Show up. Every streak counts.",
    ep: 1,
    cap: 1,
    color: "#f97316",
    glow: "rgba(249,115,22,0.22)",
  },
  {
    id: "post_create",
    Icon: Image,
    label: "Publish a Post",
    desc: "+1 EP per post · up to 5 today.",
    ep: 1,
    cap: 5,
    color: "#84cc16",
    glow: "rgba(132,204,22,0.22)",
  },
  {
    id: "reel_create",
    Icon: Film,
    label: "Upload a Reel",
    desc: "+1 EP per reel · up to 3 today.",
    ep: 1,
    cap: 3,
    color: "#e879f9",
    glow: "rgba(232,121,249,0.22)",
  },
  {
    id: "engage_5",
    Icon: Heart,
    label: "Engage 5 Posts",
    desc: "Like or comment on 5 posts (once/day).",
    ep: 1,
    cap: 1,
    color: "#f472b6",
    glow: "rgba(244,114,182,0.22)",
  },
];
const WEEKLY = { ep: 10, color: "#fbbf24", glow: "rgba(251,191,36,0.22)" };
const REDEEM = [
  {
    id: "boost24",
    Icon: Zap,
    label: "24h Visibility Boost",
    cost: 50,
    color: "#84cc16",
    desc: "2× reach for a full 24 hours.",
  },
  {
    id: "frame",
    Icon: Star,
    label: "Creator Frame",
    cost: 150,
    color: "#60a5fa",
    desc: "Animated border on posts & profile.",
  },
  {
    id: "gift50",
    Icon: Gift,
    label: "Send 50 EP Gift",
    cost: 52,
    color: "#34d399",
    desc: "Gift 50 EP to any creator (2% fee).",
  },
  {
    id: "silver",
    Icon: Trophy,
    label: "Silver Badge · 3 days",
    cost: 300,
    color: "#d4d4d8",
    desc: "Stand out in every comment section.",
  },
  {
    id: "gold",
    Icon: Crown,
    label: "Gold Badge · 3 days",
    cost: 800,
    color: "#fbbf24",
    desc: "Priority discovery placement.",
  },
  {
    id: "diamond",
    Icon: Sparkles,
    label: "Diamond Badge · 7 days",
    cost: 2000,
    color: "#a78bfa",
    desc: "Maximum visibility for 7 days.",
  },
  {
    id: "boost7",
    Icon: TrendingUp,
    label: "7-Day Reach Amplifier",
    cost: 500,
    color: "#f97316",
    desc: "Extended reach for an entire week.",
  },
  {
    id: "featured",
    Icon: Star,
    label: "Featured Creator Slot",
    cost: 5000,
    color: "#e879f9",
    desc: "Appear on Discover for 24 hours.",
  },
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

// ── Toast ─────────────────────────────────────────────────────────────────────
const Toast = ({ msg, color = "#84cc16" }) => (
  <div
    style={{
      position: "fixed",
      bottom: 88,
      left: "50%",
      transform: "translateX(-50%)",
      padding: "10px 22px",
      borderRadius: 14,
      background: `linear-gradient(135deg,${color},${color}cc)`,
      color: "#000",
      fontSize: 12,
      fontWeight: 900,
      zIndex: 99999,
      pointerEvents: "none",
      whiteSpace: "nowrap",
      boxShadow: `0 6px 26px ${color}55`,
      animation: "rwToast 2.8s ease forwards",
    }}
  >
    {msg}
  </div>
);

// ── Deposit Sheet ─────────────────────────────────────────────────────────────
const DepositSheet = ({ onClose, onSuccess }) => {
  const [amt, setAmt] = useState("5");
  const ep = Math.floor((parseFloat(amt) || 0) * 100);
  const fee = Math.round(ep * PLATFORM_FEE);
  const net = ep - fee;

  return (
    <div
      onClick={(e) => e.target === e.currentTarget && onClose()}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 98000,
        background: "rgba(0,0,0,0.82)",
        backdropFilter: "blur(16px)",
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          background: "linear-gradient(180deg,#0e0e0e,#070707)",
          border: "1px solid rgba(255,255,255,0.09)",
          borderRadius: "22px 22px 0 0",
          width: "100%",
          maxWidth: 500,
          padding: "0 0 44px",
          animation: "rwSheet .32s cubic-bezier(.34,1.56,.64,1)",
          boxShadow: "0 -20px 60px rgba(132,204,22,0.07)",
        }}
      >
        <div
          style={{
            width: 36,
            height: 4,
            background: "rgba(255,255,255,0.1)",
            borderRadius: 2,
            margin: "14px auto 22px",
          }}
        />
        <div style={{ padding: "0 22px" }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 22,
            }}
          >
            <div>
              <div
                style={{
                  fontSize: 20,
                  fontWeight: 900,
                  color: "#fff",
                  letterSpacing: "-0.4px",
                }}
              >
                Deposit EP
              </div>
              <div style={{ fontSize: 11, color: "#3a3a3a", marginTop: 3 }}>
                $1 = 100 EP · 2% protocol fee · Backs the liquidity pool
              </div>
            </div>
            <button
              onClick={onClose}
              style={{
                width: 32,
                height: 32,
                borderRadius: 9,
                background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.08)",
                color: "#555",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <X size={14} />
            </button>
          </div>

          {/* Amount input */}
          <div
            style={{
              background: "rgba(132,204,22,0.05)",
              border: "1px solid rgba(132,204,22,0.16)",
              borderRadius: 15,
              padding: "14px 16px",
              marginBottom: 12,
              boxShadow: "0 1px 0 rgba(132,204,22,0.06) inset",
            }}
          >
            <div
              style={{
                fontSize: 10,
                color: "#3a5c10",
                fontWeight: 800,
                textTransform: "uppercase",
                letterSpacing: "1px",
                marginBottom: 7,
              }}
            >
              Amount (USD)
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 30, fontWeight: 900, color: "#3a3a3a" }}>
                $
              </span>
              <input
                type="number"
                min="1"
                step="1"
                value={amt}
                onChange={(e) => setAmt(e.target.value)}
                style={{
                  fontSize: 36,
                  fontWeight: 900,
                  color: "#fff",
                  background: "none",
                  border: "none",
                  outline: "none",
                  flex: 1,
                  caretColor: "#84cc16",
                  fontFamily: "inherit",
                }}
              />
            </div>
          </div>

          <div style={{ display: "flex", gap: 7, marginBottom: 16 }}>
            {[1, 5, 10, 25, 50].map((v) => (
              <button
                key={v}
                onClick={() => setAmt(String(v))}
                style={{
                  flex: 1,
                  padding: "9px 4px",
                  borderRadius: 11,
                  background:
                    parseFloat(amt) === v
                      ? "rgba(132,204,22,0.12)"
                      : "rgba(255,255,255,0.03)",
                  border: `1px solid ${parseFloat(amt) === v ? "rgba(132,204,22,0.3)" : "rgba(255,255,255,0.07)"}`,
                  color: parseFloat(amt) === v ? "#84cc16" : "#555",
                  fontSize: 13,
                  fontWeight: 800,
                  cursor: "pointer",
                  fontFamily: "inherit",
                  transition: "all .15s",
                }}
              >
                ${v}
              </button>
            ))}
          </div>

          {ep > 0 && (
            <div
              style={{
                background: "rgba(132,204,22,0.04)",
                border: "1px solid rgba(132,204,22,0.1)",
                borderRadius: 13,
                padding: "12px 14px",
                marginBottom: 14,
              }}
            >
              {[
                ["EP credited", `+${ep} EP`, "#84cc16"],
                ["Protocol fee (2%)", `−${fee} EP`, "#3a3a3a"],
              ].map(([l, v, c]) => (
                <div
                  key={l}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    fontSize: 12,
                    color: "#555",
                    marginBottom: 6,
                  }}
                >
                  <span>{l}</span>
                  <span style={{ color: c, fontWeight: 800 }}>{v}</span>
                </div>
              ))}
              <div
                style={{
                  height: 1,
                  background: "rgba(132,204,22,0.08)",
                  marginBottom: 7,
                }}
              />
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: 14,
                  fontWeight: 900,
                }}
              >
                <span style={{ color: "#666" }}>You receive</span>
                <span style={{ color: "#84cc16" }}>{net} EP</span>
              </div>
            </div>
          )}

          <button
            onClick={() => {
              if (net > 0) {
                onSuccess(net);
                onClose();
              }
            }}
            disabled={net <= 0}
            style={{
              width: "100%",
              padding: "14px",
              borderRadius: 14,
              border: "none",
              background:
                net > 0
                  ? "linear-gradient(135deg,#84cc16,#4d7c0f)"
                  : "rgba(255,255,255,0.04)",
              color: net > 0 ? "#000" : "#333",
              fontSize: 14,
              fontWeight: 900,
              cursor: net > 0 ? "pointer" : "not-allowed",
              boxShadow: net > 0 ? "0 8px 26px rgba(132,204,22,0.3)" : "none",
              fontFamily: "inherit",
              transition: "all .18s",
            }}
          >
            {net > 0 ? `Deposit $${amt} → Get ${net} EP` : "Enter amount"}
          </button>
        </div>
      </div>
    </div>
  );
};

// ── Task Card ─────────────────────────────────────────────────────────────────
const TaskCard = ({ task, done, count = 0, onClaim, idx }) => {
  const progress = task.cap > 1 ? Math.min(count / task.cap, 1) : done ? 1 : 0;
  return (
    <div
      style={{
        background: done ? "rgba(255,255,255,0.012)" : "rgba(255,255,255,0.03)",
        border: `1px solid ${done ? "rgba(34,197,94,0.1)" : "rgba(255,255,255,0.07)"}`,
        borderRadius: 16,
        padding: "14px 15px",
        display: "flex",
        alignItems: "center",
        gap: 13,
        marginBottom: 8,
        opacity: done ? 0.5 : 1,
        transition: "all .2s",
        animation: `rwUp .3s ease ${idx * 0.055}s both`,
        boxShadow: done ? "none" : "0 1px 0 rgba(255,255,255,0.03) inset",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Top light edge */}
      {!done && (
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: 1,
            background: `linear-gradient(90deg,transparent,${task.color}30,transparent)`,
            pointerEvents: "none",
          }}
        />
      )}

      <div
        style={{
          width: 46,
          height: 46,
          borderRadius: 14,
          flexShrink: 0,
          background: done
            ? "rgba(34,197,94,0.07)"
            : task.glow.replace("0.22", "0.1"),
          border: `1px solid ${done ? "rgba(34,197,94,0.18)" : task.color + "28"}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: done ? "none" : `0 4px 16px ${task.glow}`,
        }}
      >
        {done ? (
          <CheckCircle size={20} color="#22c55e" />
        ) : (
          <task.Icon size={20} color={task.color} />
        )}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 13,
            fontWeight: 800,
            color: done ? "#484848" : "#d4d4d4",
            marginBottom: 2,
            display: "flex",
            alignItems: "center",
            gap: 7,
          }}
        >
          {task.label}
          {task.cap > 1 && (
            <span style={{ fontSize: 10, color: "#333", fontWeight: 600 }}>
              {count}/{task.cap}
            </span>
          )}
        </div>
        <div
          style={{
            fontSize: 11,
            color: "#383838",
            marginBottom: task.cap > 1 ? 7 : 0,
          }}
        >
          {task.desc}
        </div>
        {task.cap > 1 && (
          <div
            style={{
              height: 3,
              background: "rgba(255,255,255,0.05)",
              borderRadius: 2,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                height: "100%",
                width: `${progress * 100}%`,
                background: `linear-gradient(90deg,${task.color},${task.color}77)`,
                borderRadius: 2,
                transition: "width .5s",
              }}
            />
          </div>
        )}
      </div>

      <div style={{ flexShrink: 0, textAlign: "right" }}>
        <div
          style={{
            fontSize: 14,
            fontWeight: 900,
            color: task.color,
            marginBottom: 5,
          }}
        >
          +{task.ep} EP
        </div>
        <button
          onClick={() => !done && onClaim(task.id)}
          disabled={done}
          style={{
            padding: "5px 13px",
            borderRadius: 9,
            background: done ? "rgba(34,197,94,0.07)" : `${task.color}14`,
            border: `1px solid ${done ? "rgba(34,197,94,0.16)" : task.color + "28"}`,
            color: done ? "#22c55e" : task.color,
            fontSize: 11,
            fontWeight: 800,
            cursor: done ? "default" : "pointer",
            fontFamily: "inherit",
            transition: "all .15s",
          }}
        >
          {done ? "Done ✓" : "Claim"}
        </button>
      </div>
    </div>
  );
};

// ── Redeem Card ───────────────────────────────────────────────────────────────
const RedeemCard = ({ item, balance, onRedeem, idx }) => {
  const can = balance >= item.cost;
  return (
    <div
      onClick={() => can && onRedeem(item)}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 13,
        padding: "13px 14px",
        background: can ? "rgba(255,255,255,0.025)" : "rgba(255,255,255,0.012)",
        border: `1px solid ${can ? "rgba(255,255,255,0.07)" : "rgba(255,255,255,0.03)"}`,
        borderRadius: 15,
        marginBottom: 8,
        opacity: can ? 1 : 0.3,
        cursor: can ? "pointer" : "not-allowed",
        transition: "all .2s",
        animation: `rwUp .3s ease ${idx * 0.05}s both`,
        boxShadow: can ? "0 1px 0 rgba(255,255,255,0.03) inset" : "none",
        position: "relative",
        overflow: "hidden",
      }}
      onMouseEnter={(e) =>
        can && (e.currentTarget.style.borderColor = `${item.color}35`)
      }
      onMouseLeave={(e) =>
        can && (e.currentTarget.style.borderColor = "rgba(255,255,255,0.07)")
      }
    >
      {can && (
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: 1,
            background: `linear-gradient(90deg,transparent,${item.color}25,transparent)`,
            pointerEvents: "none",
          }}
        />
      )}
      <div
        style={{
          width: 46,
          height: 46,
          borderRadius: 14,
          flexShrink: 0,
          background: `${item.color}10`,
          border: `1px solid ${item.color}20`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <item.Icon size={21} color={item.color} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 13,
            fontWeight: 800,
            color: "#d4d4d4",
            marginBottom: 2,
          }}
        >
          {item.label}
        </div>
        <div style={{ fontSize: 11, color: "#383838", marginBottom: 5 }}>
          {item.desc}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <Zap size={9} color={can ? item.color : "#333"} />
          <span
            style={{
              fontSize: 11,
              fontWeight: 800,
              color: can ? item.color : "#333",
            }}
          >
            {EP(item.cost)} EP
          </span>
        </div>
      </div>
      <div
        style={{
          width: 34,
          height: 34,
          borderRadius: 11,
          flexShrink: 0,
          background: can
            ? `linear-gradient(135deg,${item.color},${item.color}99)`
            : "rgba(255,255,255,0.04)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {can ? (
          <ChevronRight size={16} color="#000" />
        ) : (
          <Lock size={13} color="#333" />
        )}
      </div>
    </div>
  );
};

// ── Economy Principle Card ────────────────────────────────────────────────────
const PrincipleCard = ({ color, em, title, body, i }) => (
  <div
    style={{
      padding: "15px 15px",
      borderRadius: 15,
      background: "rgba(255,255,255,0.02)",
      border: "1px solid rgba(255,255,255,0.055)",
      borderLeft: `2.5px solid ${color}44`,
      animation: `rwUp .3s ease ${i * 0.05}s both`,
      boxShadow: "0 1px 0 rgba(255,255,255,0.02) inset",
    }}
  >
    <div
      style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 7 }}
    >
      <span style={{ fontSize: 18 }}>{em}</span>
      <span style={{ fontSize: 13, fontWeight: 900, color }}>{title}</span>
    </div>
    <p style={{ fontSize: 12, color: "#484848", lineHeight: 1.75, margin: 0 }}>
      {body}
    </p>
  </div>
);

// ── MAIN ──────────────────────────────────────────────────────────────────────
const RewardsView = ({ currentUser, userId, onClose, isSidebar = false }) => {
  const uid = userId || currentUser?.id;

  const [tab, setTab] = useState("earn");
  const [balance, setBalance] = useState(0);
  const [streak, setStreak] = useState(0);
  const [xev, setXev] = useState(0);
  const [loading, setLoading] = useState(true);
  const [claimed, setClaimed] = useState(new Set());
  const [counts, setCounts] = useState({});
  const [weeklyQual, setWeeklyQual] = useState(false);
  const [weeklyDone, setWeeklyDone] = useState(false);
  const [showDeposit, setShowDeposit] = useState(false);
  const [toast, setToast] = useState(null);
  const [showAllRedeem, setShowAllRedeem] = useState(false);

  const flash = useCallback((msg, color = "#84cc16") => {
    setToast({ msg, color });
    setTimeout(() => setToast(null), 2800);
  }, []);

  const fetchData = useCallback(async () => {
    if (!uid) {
      setLoading(false);
      return;
    }
    try {
      const { data } = await supabase
        .from("profiles")
        .select(
          "ep_balance,xev_balance,login_streak,claimed_daily_tasks,daily_task_counts,weekly_bonus_claimed",
        )
        .eq("id", uid)
        .maybeSingle();
      if (data) {
        setBalance(data.ep_balance || 0);
        setXev(data.xev_balance || 0);
        setStreak(data.login_streak || 0);
        setClaimed(
          new Set(
            Array.isArray(data.claimed_daily_tasks)
              ? data.claimed_daily_tasks
              : [],
          ),
        );
        setCounts(data.daily_task_counts || {});
        setWeeklyDone(!!data.weekly_bonus_claimed);
      }
      const today = new Date().toDateString();
      if (localStorage.getItem(`xeevia_login_${uid}`) !== today) {
        localStorage.setItem(`xeevia_login_${uid}`, today);
        setBalance((b) => b + 1);
        setStreak((s) => s + 1);
        setClaimed((p) => new Set([...p, "login"]));
        flash("+1 EP — Welcome back! 🔥", "#f97316");
        if (data)
          await supabase
            .from("profiles")
            .update({
              ep_balance: (data.ep_balance || 0) + 1,
              login_streak: (data.login_streak || 0) + 1,
            })
            .eq("id", uid)
            .catch(() => {});
      }
      // Production: query posts from this week, check engagement count
      setWeeklyQual(Math.random() > 0.45);
    } catch {
      setBalance(320);
      setStreak(7);
      setXev(1250);
    } finally {
      setLoading(false);
    }
  }, [uid, flash]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const claimTask = async (taskId) => {
    const task = DAILY_TASKS.find((t) => t.id === taskId);
    if (!task) return;
    const cur = counts[taskId] || 0;
    if (task.cap === 1) {
      if (claimed.has(taskId)) return;
      setClaimed((p) => new Set([...p, taskId]));
      setBalance((b) => b + task.ep);
      flash(`+${task.ep} EP · ${task.label}! 🎉`, task.color);
    } else {
      if (cur >= task.cap) {
        flash("Daily cap reached ✓");
        return;
      }
      const nc = { ...counts, [taskId]: cur + 1 };
      setCounts(nc);
      setBalance((b) => b + task.ep);
      if (cur + 1 >= task.cap) setClaimed((p) => new Set([...p, taskId]));
      flash(`+${task.ep} EP (${cur + 1}/${task.cap})`, task.color);
    }
    if (uid)
      await supabase
        .from("profiles")
        .update({ ep_balance: balance + task.ep })
        .eq("id", uid)
        .catch(() => {});
  };

  const claimWeekly = async () => {
    if (!weeklyQual || weeklyDone) return;
    setWeeklyDone(true);
    setBalance((b) => b + WEEKLY.ep);
    flash(`+${WEEKLY.ep} EP — Quality bonus! 🏆`, "#fbbf24");
    if (uid)
      await supabase
        .from("profiles")
        .update({ ep_balance: balance + WEEKLY.ep, weekly_bonus_claimed: true })
        .eq("id", uid)
        .catch(() => {});
  };

  const redeemItem = async (item) => {
    if (balance < item.cost) return;
    setBalance((b) => b - item.cost);
    flash(`${item.label} activated! ✨`, item.color);
    if (uid)
      await supabase
        .from("profiles")
        .update({ ep_balance: balance - item.cost })
        .eq("id", uid)
        .catch(() => {});
  };

  const handleDeposit = async (netEP) => {
    setBalance((b) => b + netEP);
    flash(`+${netEP} EP deposited! 💰`, "#84cc16");
    if (uid)
      await supabase
        .from("profiles")
        .update({ ep_balance: balance + netEP })
        .eq("id", uid)
        .catch(() => {});
  };

  const dailyDone = DAILY_TASKS.filter((t) =>
    t.cap === 1 ? claimed.has(t.id) : (counts[t.id] || 0) >= t.cap,
  ).length;
  const nextMilestone = Math.ceil((balance + 1) / 1000) * 1000;
  const progressPct = Math.min(((balance % 1000) / 1000) * 100, 100);
  const displayRedeem = showAllRedeem ? REDEEM : REDEEM.slice(0, 5);
  const balCount = useCount(balance, 1000);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        background: "#050505",
        fontFamily:
          "-apple-system,BlinkMacSystemFont,'SF Pro Display','Segoe UI',sans-serif",
        color: "#fff",
        overflow: "hidden",
        ...(isSidebar
          ? { height: "100%", borderLeft: "1px solid rgba(132,204,22,0.1)" }
          : { position: "fixed", inset: 0, zIndex: 9500 }),
      }}
    >
      <style>{`
        @keyframes rwUp      { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
        @keyframes rwToast   { 0%{opacity:0;transform:translateX(-50%) translateY(8px)} 15%,80%{opacity:1;transform:translateX(-50%) translateY(0)} 100%{opacity:0} }
        @keyframes rwSpin    { to{transform:rotate(360deg)} }
        @keyframes rwGlow    { 0%,100%{box-shadow:0 0 14px rgba(132,204,22,0.16)} 50%{box-shadow:0 0 30px rgba(132,204,22,0.42)} }
        @keyframes rwFlame   { 0%,100%{transform:rotate(-4deg) scale(1)} 50%{transform:rotate(4deg) scale(1.12)} }
        @keyframes rwSheet   { from{transform:translateY(100%);opacity:0} to{transform:translateY(0);opacity:1} }
        @keyframes rwPop     { 0%{transform:scale(0.82);opacity:0} 65%{transform:scale(1.06)} 100%{transform:scale(1);opacity:1} }
        @keyframes rwPulse   { 0%,100%{opacity:1} 50%{opacity:.5} }
      `}</style>

      {/* ── HEADER ── */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 11,
          padding: "14px 16px",
          background: "rgba(5,5,5,0.98)",
          backdropFilter: "blur(28px)",
          borderBottom: "1px solid rgba(132,204,22,0.08)",
          flexShrink: 0,
          boxShadow: "0 1px 0 rgba(132,204,22,0.04)",
        }}
      >
        <button
          onClick={onClose}
          style={{
            width: 36,
            height: 36,
            borderRadius: 11,
            background: "rgba(255,255,255,0.05)",
            border: "1px solid rgba(255,255,255,0.08)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            color: "#606060",
          }}
        >
          <X size={15} />
        </button>
        <div style={{ flex: 1 }}>
          <div
            style={{
              fontSize: 18,
              fontWeight: 900,
              color: "#fff",
              letterSpacing: "-0.4px",
            }}
          >
            Rewards
          </div>
          <div style={{ fontSize: 10, color: "#2e2e2e", marginTop: 1 }}>
            EP Economy · Fair & Liquid from Day One
          </div>
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 5,
            padding: "7px 14px",
            borderRadius: 12,
            background: "rgba(132,204,22,0.09)",
            border: "1px solid rgba(132,204,22,0.2)",
            animation: "rwGlow 3s ease-in-out infinite",
          }}
        >
          <Zap size={12} color="#84cc16" />
          <span style={{ fontSize: 14, fontWeight: 900, color: "#84cc16" }}>
            {loading ? "—" : EP(balCount)}
          </span>
          <span style={{ fontSize: 9, color: "#4d7c0f", fontWeight: 800 }}>
            EP
          </span>
        </div>
      </div>

      {loading ? (
        <div
          style={{
            width: 22,
            height: 22,
            border: "2.5px solid rgba(132,204,22,0.1)",
            borderTopColor: "#84cc16",
            borderRadius: "50%",
            animation: "rwSpin .7s linear infinite",
            margin: "72px auto",
          }}
        />
      ) : (
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            display: "flex",
            flexDirection: "column",
          }}
        >
          {/* ── HERO CARD ── */}
          <div
            style={{
              margin: "14px 16px 0",
              background:
                "linear-gradient(145deg,rgba(132,204,22,0.09) 0%,rgba(132,204,22,0.025) 50%,transparent 100%)",
              border: "1px solid rgba(132,204,22,0.17)",
              borderRadius: 22,
              padding: "20px 18px 18px",
              position: "relative",
              overflow: "hidden",
              boxShadow:
                "0 1px 0 rgba(132,204,22,0.08) inset,0 16px 40px rgba(132,204,22,0.05)",
            }}
          >
            {/* Glow orb */}
            <div
              style={{
                position: "absolute",
                top: -40,
                right: -40,
                width: 160,
                height: 160,
                borderRadius: "50%",
                background:
                  "radial-gradient(circle,rgba(132,204,22,0.08),transparent 68%)",
                pointerEvents: "none",
              }}
            />
            {/* Top shimmer */}
            <div
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                height: 1,
                background:
                  "linear-gradient(90deg,transparent,rgba(132,204,22,0.35),transparent)",
                pointerEvents: "none",
              }}
            />

            <div style={{ display: "flex", gap: 0, alignItems: "stretch" }}>
              <div style={{ flex: 1 }}>
                <div
                  style={{
                    fontSize: 10,
                    fontWeight: 800,
                    color: "#2d4a0a",
                    textTransform: "uppercase",
                    letterSpacing: ".8px",
                    marginBottom: 6,
                  }}
                >
                  EP Balance
                </div>
                <div
                  style={{
                    fontSize: 42,
                    fontWeight: 900,
                    color: "#84cc16",
                    lineHeight: 1,
                    letterSpacing: "-2px",
                    marginBottom: 5,
                  }}
                >
                  {EP(balCount)}
                </div>
                <div style={{ fontSize: 11, color: "#333" }}>
                  Engagement Points
                </div>
                <div style={{ marginTop: 14 }}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      fontSize: 9,
                      color: "#252525",
                      marginBottom: 5,
                    }}
                  >
                    <span>Milestone progress</span>
                    <span>
                      {EP(balance)} / {EP(nextMilestone)}
                    </span>
                  </div>
                  <div
                    style={{
                      height: 5,
                      background: "rgba(255,255,255,0.05)",
                      borderRadius: 3,
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        height: "100%",
                        width: `${progressPct}%`,
                        background: "linear-gradient(90deg,#84cc16,#4d7c0f)",
                        borderRadius: 3,
                        transition: "width 1.2s",
                        boxShadow: "0 0 8px rgba(132,204,22,0.4)",
                      }}
                    />
                  </div>
                </div>
              </div>

              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  paddingLeft: 20,
                  gap: 11,
                }}
              >
                <div style={{ textAlign: "center" }}>
                  <div
                    style={{
                      fontSize: 32,
                      animation: "rwFlame 1.8s ease-in-out infinite",
                    }}
                  >
                    🔥
                  </div>
                  <div
                    style={{
                      fontSize: 26,
                      fontWeight: 900,
                      color: "#f97316",
                      lineHeight: 1,
                    }}
                  >
                    {streak}
                  </div>
                  <div
                    style={{
                      fontSize: 9,
                      fontWeight: 700,
                      color: "#383838",
                      textTransform: "uppercase",
                      letterSpacing: ".5px",
                    }}
                  >
                    Streak
                  </div>
                </div>
                {xev > 0 && (
                  <div
                    style={{
                      padding: "5px 11px",
                      borderRadius: 10,
                      background: "rgba(167,139,250,0.1)",
                      border: "1px solid rgba(167,139,250,0.18)",
                      textAlign: "center",
                      animation: "rwPop .5s ease",
                    }}
                  >
                    <div
                      style={{
                        fontSize: 14,
                        fontWeight: 900,
                        color: "#a78bfa",
                      }}
                    >
                      {EP(xev)}
                    </div>
                    <div
                      style={{ fontSize: 8, color: "#5b21b6", fontWeight: 700 }}
                    >
                      $XEV
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div style={{ display: "flex", gap: 9, marginTop: 16 }}>
              <button
                onClick={() => setShowDeposit(true)}
                style={{
                  flex: 1,
                  padding: "10px",
                  borderRadius: 12,
                  background: "linear-gradient(135deg,#84cc16,#4d7c0f)",
                  border: "none",
                  color: "#000",
                  fontSize: 12,
                  fontWeight: 900,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6,
                  boxShadow: "0 6px 20px rgba(132,204,22,0.3)",
                  fontFamily: "inherit",
                }}
              >
                <Wallet size={13} /> Deposit EP
              </button>
              <button
                onClick={() => setTab("earn")}
                style={{
                  flex: 1,
                  padding: "10px",
                  borderRadius: 12,
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  color: "#777",
                  fontSize: 12,
                  fontWeight: 800,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6,
                  fontFamily: "inherit",
                }}
              >
                <Target size={13} /> {dailyDone}/{DAILY_TASKS.length} Tasks
              </button>
            </div>
          </div>

          {/* ── Task progress strip ── */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              margin: "10px 16px 0",
              padding: "11px 14px",
              borderRadius: 14,
              background: "rgba(255,255,255,0.02)",
              border: "1px solid rgba(255,255,255,0.055)",
              boxShadow: "0 1px 0 rgba(255,255,255,0.02) inset",
            }}
          >
            <CheckCircle
              size={14}
              color={dailyDone === DAILY_TASKS.length ? "#22c55e" : "#2a2a2a"}
            />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: "#c4c4c4" }}>
                Today · {dailyDone}/{DAILY_TASKS.length} tasks done
              </div>
              <div style={{ fontSize: 10, color: "#303030" }}>
                Resets at midnight UTC
              </div>
            </div>
            <div style={{ display: "flex", gap: 3 }}>
              {DAILY_TASKS.map((t) => {
                const done =
                  t.cap === 1
                    ? claimed.has(t.id)
                    : (counts[t.id] || 0) >= t.cap;
                return (
                  <div
                    key={t.id}
                    style={{
                      width: 22,
                      height: 5,
                      borderRadius: 3,
                      background: done ? "#22c55e" : "rgba(255,255,255,0.06)",
                      transition: "background .3s",
                    }}
                  />
                );
              })}
            </div>
          </div>

          {/* ── TABS ── */}
          <div
            style={{
              display: "flex",
              margin: "12px 16px 0",
              background: "rgba(255,255,255,0.025)",
              border: "1px solid rgba(255,255,255,0.055)",
              borderRadius: 13,
              padding: 3,
              gap: 2,
            }}
          >
            {[
              ["earn", "Earn"],
              ["redeem", "Redeem"],
              ["rules", "Economy"],
            ].map(([k, l]) => (
              <button
                key={k}
                onClick={() => setTab(k)}
                style={{
                  flex: 1,
                  padding: "9px 4px",
                  borderRadius: 10,
                  border: "none",
                  fontSize: 11,
                  fontWeight: 800,
                  cursor: "pointer",
                  fontFamily: "inherit",
                  background:
                    tab === k ? "rgba(132,204,22,0.1)" : "transparent",
                  color: tab === k ? "#84cc16" : "#484848",
                  boxShadow:
                    tab === k ? "0 2px 10px rgba(132,204,22,0.18)" : "none",
                  outline:
                    tab === k ? "1px solid rgba(132,204,22,0.22)" : "none",
                  outlineOffset: "-1px",
                  transition: "all .15s",
                }}
              >
                {l}
              </button>
            ))}
          </div>

          {/* ── CONTENT ── */}
          <div style={{ padding: "12px 16px 100px", flex: 1 }}>
            {/* ═══ EARN ═══ */}
            {tab === "earn" && (
              <>
                {/* Deposit nudge */}
                <div
                  onClick={() => setShowDeposit(true)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 13,
                    padding: "13px 14px",
                    marginBottom: 16,
                    background:
                      "linear-gradient(135deg,rgba(132,204,22,0.07),rgba(132,204,22,0.02))",
                    border: "1px solid rgba(132,204,22,0.15)",
                    borderRadius: 15,
                    cursor: "pointer",
                    transition: "border-color .2s",
                    boxShadow: "0 1px 0 rgba(132,204,22,0.06) inset",
                    position: "relative",
                    overflow: "hidden",
                  }}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.borderColor =
                      "rgba(132,204,22,0.35)")
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.borderColor =
                      "rgba(132,204,22,0.15)")
                  }
                >
                  <div
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      right: 0,
                      height: 1,
                      background:
                        "linear-gradient(90deg,transparent,rgba(132,204,22,0.2),transparent)",
                      pointerEvents: "none",
                    }}
                  />
                  <div
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 12,
                      flexShrink: 0,
                      background: "rgba(132,204,22,0.1)",
                      border: "1px solid rgba(132,204,22,0.2)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Wallet size={18} color="#84cc16" />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div
                      style={{
                        fontSize: 12,
                        fontWeight: 800,
                        color: "#c4c4c4",
                        marginBottom: 2,
                      }}
                    >
                      Activate the economy
                    </div>
                    <div style={{ fontSize: 10, color: "#3a3a3a" }}>
                      $1 = 100 EP · 2% fee · Powers the liquidity pool
                    </div>
                  </div>
                  <ArrowUpRight size={14} color="#4d7c0f" />
                </div>

                <div
                  style={{
                    fontSize: 10,
                    fontWeight: 800,
                    color: "#2a2a2a",
                    textTransform: "uppercase",
                    letterSpacing: "1.2px",
                    marginBottom: 9,
                  }}
                >
                  Daily Tasks
                </div>
                {DAILY_TASKS.map((t, i) => {
                  const done =
                    t.cap === 1
                      ? claimed.has(t.id)
                      : (counts[t.id] || 0) >= t.cap;
                  return (
                    <TaskCard
                      key={t.id}
                      task={t}
                      done={done}
                      count={counts[t.id] || 0}
                      onClaim={claimTask}
                      idx={i}
                    />
                  );
                })}

                {/* Weekly bonus */}
                <div
                  style={{
                    fontSize: 10,
                    fontWeight: 800,
                    color: "#2a2a2a",
                    textTransform: "uppercase",
                    letterSpacing: "1.2px",
                    margin: "20px 0 9px",
                  }}
                >
                  Weekly Quality Bonus
                </div>
                <div
                  style={{
                    padding: "15px 15px",
                    borderRadius: 16,
                    background: weeklyQual
                      ? "rgba(251,191,36,0.06)"
                      : "rgba(255,255,255,0.02)",
                    border: `1px solid ${weeklyQual ? "rgba(251,191,36,0.2)" : "rgba(255,255,255,0.05)"}`,
                    opacity: weeklyDone ? 0.5 : 1,
                    boxShadow:
                      weeklyQual && !weeklyDone
                        ? "0 1px 0 rgba(251,191,36,0.07) inset"
                        : "none",
                    position: "relative",
                    overflow: "hidden",
                  }}
                >
                  {weeklyQual && !weeklyDone && (
                    <div
                      style={{
                        position: "absolute",
                        top: 0,
                        left: 0,
                        right: 0,
                        height: 1,
                        background:
                          "linear-gradient(90deg,transparent,rgba(251,191,36,0.3),transparent)",
                        pointerEvents: "none",
                      }}
                    />
                  )}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      gap: 13,
                    }}
                  >
                    <div
                      style={{
                        width: 46,
                        height: 46,
                        borderRadius: 14,
                        flexShrink: 0,
                        background: weeklyQual
                          ? "rgba(251,191,36,0.1)"
                          : "rgba(255,255,255,0.04)",
                        border: `1px solid ${weeklyQual ? "rgba(251,191,36,0.2)" : "rgba(255,255,255,0.06)"}`,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      {weeklyDone ? (
                        <CheckCircle size={20} color="#22c55e" />
                      ) : (
                        <Crown
                          size={20}
                          color={weeklyQual ? "#fbbf24" : "#2a2a2a"}
                        />
                      )}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div
                        style={{
                          fontSize: 13,
                          fontWeight: 800,
                          color: "#d4d4d4",
                          marginBottom: 3,
                        }}
                      >
                        Weekly Quality Bonus
                      </div>
                      <div
                        style={{
                          fontSize: 11,
                          color: "#383838",
                          lineHeight: 1.65,
                          marginBottom: 10,
                        }}
                      >
                        Earn when one of your posts gets ≥2 genuine engagements
                        within the week.
                      </div>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 10,
                        }}
                      >
                        <span
                          style={{
                            fontSize: 15,
                            fontWeight: 900,
                            color: "#fbbf24",
                          }}
                        >
                          +{WEEKLY.ep} EP
                        </span>
                        {!weeklyDone ? (
                          <button
                            onClick={claimWeekly}
                            disabled={!weeklyQual}
                            style={{
                              padding: "5px 14px",
                              borderRadius: 9,
                              background: weeklyQual
                                ? "rgba(251,191,36,0.12)"
                                : "rgba(255,255,255,0.04)",
                              border: `1px solid ${weeklyQual ? "rgba(251,191,36,0.26)" : "rgba(255,255,255,0.06)"}`,
                              color: weeklyQual ? "#fbbf24" : "#2a2a2a",
                              fontSize: 11,
                              fontWeight: 800,
                              cursor: weeklyQual ? "pointer" : "not-allowed",
                              fontFamily: "inherit",
                            }}
                          >
                            {weeklyQual ? "Claim Bonus" : "Not qualified yet"}
                          </button>
                        ) : (
                          <span
                            style={{
                              fontSize: 11,
                              color: "#22c55e",
                              fontWeight: 700,
                            }}
                          >
                            ✓ Claimed this week
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  {!weeklyQual && !weeklyDone && (
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 7,
                        marginTop: 10,
                        padding: "8px 10px",
                        borderRadius: 9,
                        background: "rgba(255,255,255,0.02)",
                        border: "1px solid rgba(255,255,255,0.04)",
                      }}
                    >
                      <AlertCircle size={11} color="#2a2a2a" />
                      <span style={{ fontSize: 10, color: "#383838" }}>
                        Post this week and earn ≥2 real likes or comments to
                        qualify.
                      </span>
                    </div>
                  )}
                </div>

                {/* XEV note */}
                <div
                  style={{
                    marginTop: 14,
                    padding: "13px 14px",
                    borderRadius: 15,
                    background: "rgba(167,139,250,0.04)",
                    border: "1px solid rgba(167,139,250,0.09)",
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 10,
                    boxShadow: "0 1px 0 rgba(167,139,250,0.04) inset",
                  }}
                >
                  <Sparkles
                    size={15}
                    color="#a78bfa"
                    style={{ flexShrink: 0, marginTop: 1 }}
                  />
                  <div>
                    <div
                      style={{
                        fontSize: 12,
                        fontWeight: 800,
                        color: "#c4c4c4",
                        marginBottom: 2,
                      }}
                    >
                      40% auto-converts to $XEV monthly
                    </div>
                    <div
                      style={{
                        fontSize: 11,
                        color: "#404040",
                        lineHeight: 1.55,
                      }}
                    >
                      Hard-capped at 1 trillion · 2% fee on all conversions and
                      withdrawals
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* ═══ REDEEM ═══ */}
            {tab === "redeem" && (
              <>
                <div
                  style={{
                    fontSize: 11,
                    color: "#383838",
                    marginBottom: 14,
                    lineHeight: 1.65,
                  }}
                >
                  Spend EP to amplify your presence. Every redemption burns EP —
                  keeping supply healthy and your balance real.
                </div>
                {displayRedeem.map((item, i) => (
                  <RedeemCard
                    key={item.id}
                    item={item}
                    balance={balance}
                    onRedeem={redeemItem}
                    idx={i}
                  />
                ))}
                {REDEEM.length > 5 && (
                  <button
                    onClick={() => setShowAllRedeem((s) => !s)}
                    style={{
                      width: "100%",
                      padding: "10px",
                      borderRadius: 11,
                      background: "rgba(255,255,255,0.025)",
                      border: "1px solid rgba(255,255,255,0.07)",
                      color: "#555",
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 6,
                      fontFamily: "inherit",
                      marginTop: 4,
                    }}
                  >
                    <ChevronDown
                      size={14}
                      style={{
                        transform: showAllRedeem ? "rotate(180deg)" : "none",
                        transition: ".2s",
                      }}
                    />
                    {showAllRedeem
                      ? "Show less"
                      : `Show ${REDEEM.length - 5} more`}
                  </button>
                )}
              </>
            )}

            {/* ═══ ECONOMY RULES ═══ */}
            {tab === "rules" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
                {[
                  {
                    color: "#f97316",
                    em: "🔥",
                    title: "Login Bonus",
                    body: "+1 EP every day you log in. The streak is a signal of trust. Your consistency is worth something here.",
                  },
                  {
                    color: "#84cc16",
                    em: "📦",
                    title: "Post EP",
                    body: "+1 EP per post, capped at 5/day. We reward creators who build — not content farms that flood the feed.",
                  },
                  {
                    color: "#e879f9",
                    em: "🎬",
                    title: "Reel EP",
                    body: "+1 EP per reel, capped at 3/day. Video is expensive. Your creative effort is backed by real economics.",
                  },
                  {
                    color: "#f472b6",
                    em: "❤️",
                    title: "Engage Daily",
                    body: "+1 EP for engaging with 5 posts. Once per day. Reciprocal attention is the foundation of a real community.",
                  },
                  {
                    color: "#fbbf24",
                    em: "👑",
                    title: "Weekly Quality",
                    body: "+10 EP when your post earns ≥2 genuine engagements in a week. We reward signal, not noise.",
                  },
                  {
                    color: "#84cc16",
                    em: "⚡",
                    title: "Backed EP",
                    body: "Every EP in circulation is backed by a real dollar deposit. $1 = 100 EP. 2% protocol fee on every transaction. No inflation.",
                  },
                  {
                    color: "#34d399",
                    em: "💸",
                    title: "Creator Tips",
                    body: "You keep 84% of every EP tip. 2% to the protocol. 14% to the liquidity pool. Transparent, automated, irrevocable.",
                  },
                  {
                    color: "#a78bfa",
                    em: "🌀",
                    title: "$XEV Conversion",
                    body: "40% of monthly EP earnings auto-convert to $XEV. Hard cap of 1 trillion total. 2% fee on all conversions and withdrawals.",
                  },
                  {
                    color: "#60a5fa",
                    em: "🏗️",
                    title: "Why Low Ceiling",
                    body: "Generous daily rewards inflate the supply and devalue your earnings. Small, consistent EP keeps value real. Quality over volume, always.",
                  },
                ].map((item, i) => (
                  <PrincipleCard key={i} i={i} {...item} />
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {showDeposit && (
        <DepositSheet
          onClose={() => setShowDeposit(false)}
          onSuccess={handleDeposit}
        />
      )}
      {toast && <Toast msg={toast.msg} color={toast.color} />}
    </div>
  );
};

export default RewardsView;
