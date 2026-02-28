// src/components/Rewards/RewardsView.jsx
// Rewards center — EP tasks, daily check-in, streaks, redeem EP for perks
// Pulls user EP balance from Supabase profiles table

import React, { useState, useEffect, useCallback } from "react";
import {
  Gift, Zap, Flame, CheckCircle, Lock, ChevronRight,
  Star, TrendingUp, Users, MessageSquare, Heart,
  Image, Film, Share2, UserPlus, Clock, Crown
} from "lucide-react";
import { supabase } from "../../services/config/supabase";

const fmtNum = (n) => n >= 1000 ? `${(n/1000).toFixed(1)}K` : String(n ?? 0);

// ── Task definitions ─────────────────────────────────────────────────────────
const DAILY_TASKS = [
  { id:"post",     icon:Image,       label:"Publish a post",          ep:50,  xp:10 },
  { id:"reel",     icon:Film,        label:"Upload a reel",           ep:80,  xp:20 },
  { id:"comment",  icon:MessageSquare,label:"Comment on 3 posts",     ep:20,  xp:5  },
  { id:"like",     icon:Heart,       label:"Like 10 posts",           ep:15,  xp:3  },
  { id:"share",    icon:Share2,      label:"Share a post to story",   ep:25,  xp:8  },
  { id:"follow",   icon:UserPlus,    label:"Follow 2 new creators",   ep:30,  xp:7  },
];

const WEEKLY_TASKS = [
  { id:"w_post5",  icon:Image,       label:"Publish 5 posts this week",   ep:300, xp:60 },
  { id:"w_reel3",  icon:Film,        label:"Upload 3 reels this week",    ep:400, xp:90 },
  { id:"w_streak", icon:Flame,       label:"7-day login streak",          ep:500, xp:100},
  { id:"w_refer",  icon:Users,       label:"Invite a friend to Grova",    ep:600, xp:120},
];

const REDEEMABLE = [
  { id:"r_boost",  icon:"⚡", label:"24h Post Boost",     cost:200,  color:"#84cc16" },
  { id:"r_frame",  icon:"🖼️", label:"Exclusive Frame",    cost:500,  color:"#60a5fa" },
  { id:"r_silver", icon:"🥈", label:"Silver Boost (3d)",  cost:800,  color:"#c0c0c0" },
  { id:"r_gc",     icon:"🎁", label:"500 EP Gift Card",   cost:1000, color:"#34d399" },
  { id:"r_gold",   icon:"👑", label:"Gold Boost (3d)",    cost:2000, color:"#fbbf24" },
  { id:"r_diamond",icon:"💎", label:"Diamond Boost (3d)", cost:4000, color:"#a78bfa" },
];

// ── Task row ─────────────────────────────────────────────────────────────────
const TaskRow = ({ task, done, onClaim, idx }) => (
  <div className={`rw-task${done?" done":""}`} style={{ animationDelay:`${idx*0.055}s` }}>
    <div className="rw-task-icon" style={{ background: done ? "rgba(34,197,94,0.12)" : "rgba(255,255,255,0.05)",
      border: `1px solid ${done?"rgba(34,197,94,0.3)":"rgba(255,255,255,0.08)"}` }}>
      {done ? <CheckCircle size={15} color="#22c55e"/> : <task.icon size={15} color="#525252"/>}
    </div>
    <div className="rw-task-info">
      <span className="rw-task-label">{task.label}</span>
      <span className="rw-task-ep">+{task.ep} EP</span>
    </div>
    <button className={`rw-task-btn${done?" claimed":""}`}
      onClick={() => !done && onClaim(task.id)}
      disabled={done}>
      {done ? "✓" : "Claim"}
    </button>
  </div>
);

// ── Redeem card ───────────────────────────────────────────────────────────────
const RedeemCard = ({ item, balance, onRedeem, idx }) => {
  const canAfford = balance >= item.cost;
  return (
    <div className={`rw-redeem-card${!canAfford?" locked":""}`}
      style={{ "--c":item.color, animationDelay:`${idx*0.06}s` }}>
      <div className="rw-redeem-emoji"
        style={{ background:`${item.color}15`, border:`1px solid ${item.color}25` }}>
        {item.icon}
      </div>
      <div className="rw-redeem-info">
        <span className="rw-redeem-label">{item.label}</span>
        <div className="rw-redeem-cost">
          <Zap size={10} color={canAfford?item.color:"#383838"}/>
          <span style={{ color: canAfford?item.color:"#383838" }}>{fmtNum(item.cost)} EP</span>
        </div>
      </div>
      <button className="rw-redeem-btn"
        style={{ background: canAfford?`linear-gradient(135deg,${item.color},${item.color}88)`:"rgba(255,255,255,0.05)",
          color: canAfford?"#000":"#383838", cursor:canAfford?"pointer":"not-allowed" }}
        onClick={() => canAfford && onRedeem(item)}
        disabled={!canAfford}>
        {canAfford ? <ChevronRight size={13}/> : <Lock size={12}/>}
      </button>
    </div>
  );
};

// ── Main ──────────────────────────────────────────────────────────────────────
const RewardsView = ({ currentUser, userId, onClose }) => {
  const uid = userId || currentUser?.id;
  const [tab,      setTab]      = useState("tasks");  // tasks | redeem | history
  const [balance,  setBalance]  = useState(0);
  const [streak,   setStreak]   = useState(0);
  const [loading,  setLoading]  = useState(true);
  const [claimed,  setClaimed]  = useState(new Set());
  const [toast,    setToast]    = useState(null);

  const showToast = (msg, color="#84cc16") => {
    setToast({ msg, color });
    setTimeout(() => setToast(null), 2800);
  };

  const fetchData = useCallback(async () => {
    if (!uid) { setLoading(false); return; }
    try {
      const { data } = await supabase
        .from("profiles")
        .select("ep_balance, login_streak, claimed_daily_tasks")
        .eq("id", uid)
        .maybeSingle();
      if (data) {
        setBalance(data.ep_balance || 0);
        setStreak(data.login_streak || 0);
        const prev = Array.isArray(data.claimed_daily_tasks) ? data.claimed_daily_tasks : [];
        setClaimed(new Set(prev));
      }
    } catch {
      // Demo fallback
      setBalance(4250);
      setStreak(7);
    } finally { setLoading(false); }
  }, [uid]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const claimTask = async (taskId) => {
    const task = [...DAILY_TASKS, ...WEEKLY_TASKS].find(t => t.id === taskId);
    if (!task || claimed.has(taskId)) return;

    const newClaimed = new Set(claimed).add(taskId);
    setClaimed(newClaimed);
    setBalance(prev => prev + task.ep);
    showToast(`+${task.ep} EP claimed! 🎉`);

    // Persist to Supabase
    if (uid) {
      try {
        await supabase.from("profiles").update({
          ep_balance: balance + task.ep,
          claimed_daily_tasks: [...newClaimed],
        }).eq("id", uid);
      } catch {}
    }
  };

  const redeemItem = (item) => {
    if (balance < item.cost) return;
    setBalance(prev => prev - item.cost);
    showToast(`${item.icon} ${item.label} redeemed!`, item.color);
  };

  const dailyDone   = DAILY_TASKS.filter(t => claimed.has(t.id)).length;
  const weeklyDone  = WEEKLY_TASKS.filter(t => claimed.has(t.id)).length;
  const dailyTotal  = DAILY_TASKS.reduce((s,t) => s + (claimed.has(t.id)?t.ep:0), 0);

  return (
    <div className="rw-root">
      <style>{`
        @keyframes rwFadeUp{from{opacity:0;transform:translateY(10px);}to{opacity:1;transform:translateY(0);}}
        @keyframes rwGlow{0%,100%{box-shadow:0 0 20px rgba(132,204,22,.3);}50%{box-shadow:0 0 40px rgba(132,204,22,.6);}}
        @keyframes rwToast{0%{opacity:0;transform:translateX(-50%) translateY(10px);}10%,90%{opacity:1;transform:translateX(-50%) translateY(0);}100%{opacity:0;transform:translateX(-50%) translateY(-6px);}}
        @keyframes rwPulse{0%,100%{transform:scale(1);}50%{transform:scale(1.06);}}
        @keyframes rwFlame{0%,100%{transform:rotate(-5deg) scale(1);}50%{transform:rotate(5deg) scale(1.1);}}
        @keyframes rwSpin{to{transform:rotate(360deg)}}

        .rw-root{
          position:fixed;inset:0;z-index:9500;
          background:#060606;overflow-y:auto;
          font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
        }

        /* TOP BAR */
        .rw-topbar{
          position:sticky;top:0;z-index:10;
          display:flex;align-items:center;gap:12px;
          padding:12px 16px;
          background:rgba(6,6,6,0.97);backdrop-filter:blur(20px);
          border-bottom:1px solid rgba(132,204,22,0.12);
        }
        .rw-back{width:34px;height:34px;border-radius:10px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.08);display:flex;align-items:center;justify-content:center;cursor:pointer;color:#737373;font-size:18px;transition:all .18s;}
        .rw-back:hover{background:rgba(255,255,255,0.1);color:#fff;}
        .rw-title{font-size:17px;font-weight:900;color:#fff;flex:1;}
        .rw-ep-badge{
          display:flex;align-items:center;gap:5px;
          padding:6px 12px;border-radius:10px;
          background:rgba(132,204,22,0.1);
          border:1px solid rgba(132,204,22,0.22);
          font-size:13px;font-weight:900;color:#84cc16;
          animation:rwGlow 3s ease-in-out infinite;
        }

        /* HERO STRIP */
        .rw-hero{
          display:flex;align-items:stretch;gap:0;
          margin:14px 14px 0;
          background:linear-gradient(135deg,rgba(132,204,22,0.09),rgba(132,204,22,0.03));
          border:1px solid rgba(132,204,22,0.18);border-radius:18px;overflow:hidden;
        }
        .rw-hero-left{
          flex:1;padding:18px;
        }
        .rw-hero-ep-label{font-size:10px;font-weight:800;color:#525252;text-transform:uppercase;letter-spacing:.8px;}
        .rw-hero-ep-val{font-size:36px;font-weight:900;color:#84cc16;line-height:1;}
        .rw-hero-ep-unit{font-size:13px;color:#525252;font-weight:600;margin-top:2px;}
        .rw-hero-progress-wrap{margin-top:12px;}
        .rw-hero-progress-label{font-size:11px;font-weight:700;color:#525252;margin-bottom:5px;display:flex;justify-content:space-between;}
        .rw-hero-track{height:5px;background:rgba(255,255,255,0.06);border-radius:3px;overflow:hidden;}
        .rw-hero-fill{height:100%;background:linear-gradient(90deg,#84cc16,#4d7c0f);border-radius:3px;transition:width .8s cubic-bezier(.4,0,.2,1);}

        .rw-hero-right{
          padding:18px 16px 18px 0;
          display:flex;flex-direction:column;
          align-items:center;justify-content:center;
          gap:4px;
        }
        .rw-streak-icon{font-size:28px;animation:rwFlame 1.5s ease-in-out infinite;}
        .rw-streak-val{font-size:22px;font-weight:900;color:#f97316;}
        .rw-streak-label{font-size:10px;font-weight:700;color:#525252;text-transform:uppercase;letter-spacing:.6px;}

        /* DAILY PROGRESS */
        .rw-daily-row{
          display:flex;align-items:center;gap:10px;
          padding:12px 14px;margin:10px 14px 0;
          background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.06);
          border-radius:12px;
        }
        .rw-daily-info{flex:1;}
        .rw-daily-title{font-size:12px;font-weight:800;color:#c4c4c4;}
        .rw-daily-sub{font-size:10.5px;color:#525252;font-weight:600;}
        .rw-daily-chips{display:flex;gap:3px;}
        .rw-daily-chip{
          width:20px;height:6px;border-radius:3px;
          transition:background .2s;
        }

        /* TABS */
        .rw-tabs{
          display:flex;margin:14px;
          background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.07);
          border-radius:13px;padding:3px;gap:2px;
        }
        .rw-tab{
          flex:1;padding:9px;border-radius:10px;border:none;
          font-size:12px;font-weight:800;cursor:pointer;
          transition:all .22s;color:#525252;background:transparent;
        }
        .rw-tab.active{
          background:rgba(132,204,22,0.1);border:1px solid rgba(132,204,22,0.22);
          color:#84cc16;
        }

        /* TASKS */
        .rw-body{padding:0 14px 100px;}
        .rw-section-label{font-size:9.5px;font-weight:800;color:#383838;text-transform:uppercase;letter-spacing:1.2px;margin:18px 0 8px 2px;}

        .rw-task{
          display:flex;align-items:center;gap:12px;
          padding:12px;border-radius:14px;
          background:rgba(255,255,255,0.025);border:1px solid rgba(255,255,255,0.06);
          margin-bottom:8px;transition:all .2s;
          animation:rwFadeUp .28s ease both;
        }
        .rw-task:hover{background:rgba(255,255,255,0.04);}
        .rw-task.done{opacity:.5;}
        .rw-task-icon{width:36px;height:36px;border-radius:10px;display:flex;align-items:center;justify-content:center;flex-shrink:0;}
        .rw-task-info{flex:1;}
        .rw-task-label{display:block;font-size:13px;font-weight:700;color:#c4c4c4;}
        .rw-task-ep{display:block;font-size:11px;font-weight:800;color:#84cc16;margin-top:2px;}
        .rw-task-btn{
          padding:7px 14px;border-radius:9px;border:none;
          font-size:12px;font-weight:800;cursor:pointer;
          background:rgba(132,204,22,0.12);
          border:1px solid rgba(132,204,22,0.25)!important;
          color:#84cc16;transition:all .18s;
        }
        .rw-task-btn:hover{background:rgba(132,204,22,0.2);}
        .rw-task-btn.claimed{background:rgba(34,197,94,0.1);border-color:rgba(34,197,94,0.2)!important;color:#22c55e;cursor:default;}

        /* REDEEM */
        .rw-redeem-grid{display:flex;flex-direction:column;gap:9px;}
        .rw-redeem-card{
          display:flex;align-items:center;gap:12px;
          padding:13px;border-radius:14px;
          background:rgba(255,255,255,0.025);border:1px solid rgba(255,255,255,0.06);
          transition:all .22s cubic-bezier(.34,1.4,.64,1);
          animation:rwFadeUp .28s ease both;
        }
        .rw-redeem-card:hover:not(.locked){
          border-color:color-mix(in srgb,var(--c) 30%,transparent);
          transform:translateX(3px);
        }
        .rw-redeem-card.locked{opacity:.45;}
        .rw-redeem-emoji{
          width:40px;height:40px;border-radius:12px;
          display:flex;align-items:center;justify-content:center;
          font-size:20px;flex-shrink:0;
        }
        .rw-redeem-info{flex:1;}
        .rw-redeem-label{display:block;font-size:13px;font-weight:800;color:#c4c4c4;}
        .rw-redeem-cost{display:flex;align-items:center;gap:4px;margin-top:3px;}
        .rw-redeem-cost span{font-size:11.5px;font-weight:800;}
        .rw-redeem-btn{
          width:32px;height:32px;border-radius:9px;border:none;
          display:flex;align-items:center;justify-content:center;
          flex-shrink:0;transition:all .18s;
        }
        .rw-redeem-btn:hover{transform:scale(1.1);}

        /* History empty */
        .rw-empty{text-align:center;padding:48px 20px;}
        .rw-empty-icon{font-size:52px;margin-bottom:14px;}
        .rw-empty-title{font-size:16px;font-weight:900;color:#fff;margin:0 0 6px;}
        .rw-empty-sub{font-size:13px;color:#525252;line-height:1.6;}

        /* Toast */
        .rw-toast{
          position:fixed;bottom:100px;left:50%;transform:translateX(-50%);
          padding:10px 20px;border-radius:12px;
          font-size:13px;font-weight:800;color:#000;
          z-index:99999;pointer-events:none;
          animation:rwToast 2.8s ease forwards;
          white-space:nowrap;
        }

        /* Spinner */
        .rw-spinner{width:22px;height:22px;border:2.5px solid rgba(132,204,22,0.2);border-top-color:#84cc16;border-radius:50%;animation:rwSpin .7s linear infinite;margin:60px auto;}
      `}</style>

      {/* TOP BAR */}
      <div className="rw-topbar">
        <button className="rw-back" onClick={onClose}>‹</button>
        <span className="rw-title">Rewards</span>
        <div className="rw-ep-badge"><Zap size={13}/>{fmtNum(balance)} EP</div>
      </div>

      {loading ? <div className="rw-spinner"/> : (
        <>
          {/* HERO */}
          <div className="rw-hero">
            <div className="rw-hero-left">
              <div className="rw-hero-ep-label">Your Balance</div>
              <div className="rw-hero-ep-val">{fmtNum(balance)}</div>
              <div className="rw-hero-ep-unit">Engagement Points</div>
              <div className="rw-hero-progress-wrap">
                <div className="rw-hero-progress-label">
                  <span>Next milestone</span>
                  <span>{fmtNum(balance)} / {fmtNum(Math.ceil(balance/1000)*1000)} EP</span>
                </div>
                <div className="rw-hero-track">
                  <div className="rw-hero-fill" style={{ width:`${(balance % 1000)/10}%` }}/>
                </div>
              </div>
            </div>
            <div className="rw-hero-right">
              <div className="rw-streak-icon">🔥</div>
              <div className="rw-streak-val">{streak}</div>
              <div className="rw-streak-label">Day Streak</div>
            </div>
          </div>

          {/* DAILY PROGRESS */}
          <div className="rw-daily-row">
            <CheckCircle size={18} color={dailyDone===DAILY_TASKS.length?"#22c55e":"#383838"}/>
            <div className="rw-daily-info">
              <div className="rw-daily-title">Daily Tasks — {dailyDone}/{DAILY_TASKS.length} done · +{dailyTotal} EP earned</div>
              <div className="rw-daily-sub">Resets at midnight</div>
            </div>
            <div className="rw-daily-chips">
              {DAILY_TASKS.map(t => (
                <div key={t.id} className="rw-daily-chip"
                  style={{ background: claimed.has(t.id) ? "#22c55e" : "rgba(255,255,255,0.08)" }}/>
              ))}
            </div>
          </div>

          {/* TABS */}
          <div className="rw-tabs">
            {[["tasks","Tasks"],["redeem","Redeem"],["history","History"]].map(([k,l]) => (
              <button key={k} className={`rw-tab${tab===k?" active":""}`} onClick={() => setTab(k)}>{l}</button>
            ))}
          </div>

          <div className="rw-body">

            {/* ══ TASKS ══ */}
            {tab === "tasks" && (
              <>
                <p className="rw-section-label">Daily Tasks</p>
                {DAILY_TASKS.map((t, i) => (
                  <TaskRow key={t.id} task={t} done={claimed.has(t.id)} onClaim={claimTask} idx={i}/>
                ))}
                <p className="rw-section-label" style={{ marginTop:24 }}>Weekly Challenges</p>
                {WEEKLY_TASKS.map((t, i) => (
                  <TaskRow key={t.id} task={t} done={claimed.has(t.id)} onClaim={claimTask} idx={i}/>
                ))}
              </>
            )}

            {/* ══ REDEEM ══ */}
            {tab === "redeem" && (
              <>
                <p style={{ fontSize:12,color:"#525252",fontWeight:600,margin:"6px 0 14px 2px" }}>
                  Spend your EP on exclusive perks and boosts
                </p>
                <div className="rw-redeem-grid">
                  {REDEEMABLE.map((item, i) => (
                    <RedeemCard key={item.id} item={item} balance={balance} onRedeem={redeemItem} idx={i}/>
                  ))}
                </div>
              </>
            )}

            {/* ══ HISTORY ══ */}
            {tab === "history" && (
              <div className="rw-empty">
                <div className="rw-empty-icon">📜</div>
                <p className="rw-empty-title">No history yet</p>
                <p className="rw-empty-sub">Your EP earnings and redemptions<br/>will appear here.</p>
              </div>
            )}
          </div>
        </>
      )}

      {/* Toast */}
      {toast && (
        <div className="rw-toast"
          style={{ background:`linear-gradient(135deg,${toast.color},${toast.color}cc)` }}>
          {toast.msg}
        </div>
      )}
    </div>
  );
};

export default RewardsView;