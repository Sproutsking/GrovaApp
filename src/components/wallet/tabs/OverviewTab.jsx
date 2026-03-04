// src/components/wallet/tabs/OverviewTab.jsx
// ════════════════════════════════════════════════════════════════
//  FIXES:
//   • Real profile images via XevAvatar — NO more letter initials
//   • Balance updates animate fluidly (no blank flash) — waterwave
//   • In/Out arrows: beautiful directional chips on each tx row
//   • Animated number counter on balance change
//   • All avatar references use XevAvatar with proper data passing
// ════════════════════════════════════════════════════════════════

import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  ArrowUpRight, Download, ArrowDownLeft, MoreHorizontal,
  TrendingUp, Repeat, Settings, Wifi, Coins, Zap,
  ChevronRight, Flame, Clock,
} from "lucide-react";
import BalanceCard from "../components/BalanceCard";
import { useCurrency } from "../../../contexts/CurrencyContext";
import ProfilePreview from "../../Shared/ProfilePreview";
import { supabase } from "../../../services/config/supabase";

// ── TxAvatar — fetches the real profile for a transaction counterparty ───────
// tx.counterparty often only has { username } — no avatar data.
// This component fetches the full profile from Supabase by username,
// then passes it to ProfilePreview so the real image always shows.
const profileCache = {};  // module-level cache — survives re-renders

function TxAvatar({ cp, currentUser, dirClass, isPending, isReceived }) {
  const [profile, setProfile] = useState(() => {
    // Use cached profile if we already fetched it this session
    const cached = cp?.username ? profileCache[cp.username] : null;
    return cached || cp || null;
  });

  useEffect(() => {
    if (!cp?.username) return;
    // Already has avatar data — no fetch needed
    if (cp.avatar_id || cp.avatar_metadata || cp.avatar) return;
    // Already cached
    if (profileCache[cp.username]) {
      setProfile(profileCache[cp.username]);
      return;
    }
    // Fetch full profile
    supabase
      .from("profiles")
      .select("id,username,full_name,avatar_id,avatar_metadata,verified")
      .eq("username", cp.username)
      .single()
      .then(({ data }) => {
        if (data) {
          const full = {
            ...data,
            userId:   data.id,
            author:   data.full_name || data.username,
            avatar:   data.avatar_metadata?.publicUrl ||
                      data.avatar_metadata?.url ||
                      data.avatar_metadata?.signedUrl ||
                      (data.avatar_id
                        ? `${(typeof window !== "undefined" && window.__SUPABASE_URL__) || process.env.REACT_APP_SUPABASE_URL || ""}/storage/v1/object/public/avatars/${data.avatar_id}`
                        : null) || null,
          };
          profileCache[cp.username] = full;
          setProfile(full);
        }
      });
  }, [cp?.username]);

  return (
    <div style={{ position: "relative", flexShrink: 0, width: 40, height: 40 }}>
      <ProfilePreview
        profile={profile}
        currentUser={currentUser}
        size="small"
        showUsername={false}
      />
      {/* Direction badge overlaid on avatar */}
      <div className={`ov-tx-dir-badge ${dirClass}`}>
        {isPending ? (
          <Clock size={7} color="#000" />
        ) : isReceived ? (
          <svg width="8" height="8" viewBox="0 0 10 10" fill="none">
            <path d="M8 2 L2 8 M2 8 H6 M2 8 V4" stroke="#000" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        ) : (
          <svg width="8" height="8" viewBox="0 0 10 10" fill="none">
            <path d="M2 8 L8 2 M8 2 H4 M8 2 V6" stroke="#000" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </div>
    </div>
  );
}

// ── Animated number hook ─────────────────────────────────────────
function useAnimatedNumber(target, duration = 700) {
  const [display, setDisplay] = useState(target);
  const rafRef    = useRef(null);
  const startRef  = useRef(null);
  const fromRef   = useRef(target);

  useEffect(() => {
    const from = fromRef.current;
    const to   = target;
    if (from === to) return;

    cancelAnimationFrame(rafRef.current);
    startRef.current = null;

    const ease = (t) => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

    rafRef.current = requestAnimationFrame(function tick(ts) {
      if (!startRef.current) startRef.current = ts;
      const elapsed = ts - startRef.current;
      const progress = Math.min(elapsed / duration, 1);
      const eased = ease(progress);
      const current = from + (to - from) * eased;
      setDisplay(current);
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        fromRef.current = to;
        setDisplay(to);
      }
    });

    return () => cancelAnimationFrame(rafRef.current);
  }, [target, duration]);

  return display;
}

// ── Flash delta indicator ────────────────────────────────────────
function DeltaFlash({ delta, currency }) {
  const [visible, setVisible] = useState(false);
  const [val, setVal]         = useState(delta);
  const timerRef              = useRef(null);

  useEffect(() => {
    if (delta === 0) return;
    setVal(delta);
    setVisible(true);
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setVisible(false), 2200);
    return () => clearTimeout(timerRef.current);
  }, [delta]);

  if (!visible || !val) return null;
  const isPos = val > 0;

  return (
    <div style={{
      position: "absolute",
      top: -22,
      right: 0,
      padding: "3px 9px",
      borderRadius: 100,
      fontSize: 11,
      fontWeight: 800,
      fontFamily: "var(--font-mono, 'DM Mono', monospace)",
      color: isPos ? "#a3e635" : "#f87171",
      background: isPos ? "rgba(163,230,53,0.12)" : "rgba(248,113,113,0.1)",
      border: `1px solid ${isPos ? "rgba(163,230,53,0.3)" : "rgba(248,113,113,0.2)"}`,
      pointerEvents: "none",
      animation: "ovDeltaIn 0.35s cubic-bezier(.34,1.56,.64,1) forwards",
      whiteSpace: "nowrap",
    }}>
      {isPos ? "+" : ""}{val > 0 ? "+" : ""}{Math.abs(val).toLocaleString()} {currency}
    </div>
  );
}

// ── Tx direction chip ────────────────────────────────────────────
function TxDirectionChip({ isIn, isPending }) {
  if (isPending) return (
    <div style={{
      width: 36, height: 36, borderRadius: 10, flexShrink: 0,
      background: "rgba(245,158,11,0.1)",
      border: "1px solid rgba(245,158,11,0.2)",
      display: "flex", alignItems: "center", justifyContent: "center",
    }}>
      <Clock size={15} color="#f59e0b" />
    </div>
  );

  return (
    <div style={{
      width: 36, height: 36, borderRadius: 10, flexShrink: 0,
      background: isIn ? "rgba(163,230,53,0.08)" : "rgba(248,113,113,0.08)",
      border: `1px solid ${isIn ? "rgba(163,230,53,0.2)" : "rgba(248,113,113,0.2)"}`,
      display: "flex", alignItems: "center", justifyContent: "center",
      position: "relative",
    }}>
      {/* Arrow SVG — custom animated */}
      <svg
        width="16" height="16" viewBox="0 0 16 16" fill="none"
        style={{
          transform: isIn ? "rotate(135deg)" : "rotate(-45deg)",
          color: isIn ? "#a3e635" : "#f87171",
        }}
      >
        <path
          d="M3 13 L13 3 M13 3 H7 M13 3 V9"
          stroke="currentColor" strokeWidth="1.8"
          strokeLinecap="round" strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}

const CSS = `
  /* ── Section heading — centred with gradient lines ── */
  .ov-section-head {
    display:flex;align-items:center;gap:10px;
    margin:24px 0 14px;justify-content:center;
  }
  .ov-section-title {
    font-size:10.5px;font-weight:700;letter-spacing:0.1em;
    text-transform:uppercase;color:rgba(255,255,255,0.2);
    white-space:nowrap;flex-shrink:0;
  }
  .ov-section-line {
    flex:1;height:1px;max-width:100px;
    background:linear-gradient(90deg,transparent,rgba(255,255,255,0.08),transparent);
  }

  /* ── Actions row ── */
  .ov-actions {
    display:grid;grid-template-columns:repeat(4,1fr);gap:8px;
    margin:0; margin-top: 10px;
  }
  .ov-act-btn {
    display:flex;flex-direction:column;align-items:center;gap:7px;
    padding:14px 8px;border-radius:14px;border:1px solid rgba(255,255,255,0.07);
    background:rgba(255,255,255,0.03);cursor:pointer;transition:all .18s;
    color:rgba(255,255,255,0.55);font-size:11.5px;font-weight:600;
  }
  .ov-act-btn:hover{background:rgba(255,255,255,0.06);border-color:rgba(255,255,255,0.12);color:rgba(255,255,255,0.85);transform:translateY(-1px);}
  .ov-act-btn.primary{background:rgba(163,230,53,0.08);border-color:rgba(163,230,53,0.22);color:#a3e635;}
  .ov-act-btn.primary:hover{background:rgba(163,230,53,0.13);border-color:rgba(163,230,53,0.35);}
  .ov-act-icon{width:38px;height:38px;border-radius:11px;display:flex;align-items:center;justify-content:center;background:rgba(255,255,255,0.05);}
  .ov-act-btn.primary .ov-act-icon{background:rgba(163,230,53,0.12);}

  /* ── More panel ── */
  .ov-more-panel {
    display:grid;grid-template-columns:repeat(4,1fr);gap:8px;
    margin-bottom:6px;
    animation:moreIn .2s cubic-bezier(.34,1.56,.64,1);
  }
  @keyframes moreIn{from{opacity:0;transform:translateY(-8px)}to{opacity:1;transform:translateY(0)}}

  /* ── Asset rows ── */
  .ov-asset-card {
    display:flex;align-items:center;gap:13px;
    padding:14px 16px;border-radius:15px;margin-bottom:8px;
    background:rgba(255,255,255,0.025);border:1px solid rgba(255,255,255,0.06);
    transition:background .18s;
    position:relative; overflow:visible;
  }
  .ov-asset-card:hover{background:rgba(255,255,255,0.04);}
  .ov-asset-card.xev{border-color:rgba(163,230,53,0.12);background:rgba(163,230,53,0.03);}
  .ov-asset-card.ep{border-color:rgba(34,211,238,0.1);background:rgba(34,211,238,0.025);}

  /* Waterwave flash on balance update */
  .ov-asset-card.flash-xev { animation: ovWaveXEV 0.7s ease; }
  .ov-asset-card.flash-ep  { animation: ovWaveEP  0.7s ease; }
  @keyframes ovWaveXEV {
    0%   { box-shadow: 0 0 0 0 rgba(163,230,53,0); border-color: rgba(163,230,53,0.12); }
    30%  { box-shadow: 0 0 0 6px rgba(163,230,53,0.15); border-color: rgba(163,230,53,0.6); }
    60%  { box-shadow: 0 0 0 12px rgba(163,230,53,0.05); border-color: rgba(163,230,53,0.35); }
    100% { box-shadow: 0 0 0 0 rgba(163,230,53,0); border-color: rgba(163,230,53,0.12); }
  }
  @keyframes ovWaveEP {
    0%   { box-shadow: 0 0 0 0 rgba(34,211,238,0); border-color: rgba(34,211,238,0.1); }
    30%  { box-shadow: 0 0 0 6px rgba(34,211,238,0.15); border-color: rgba(34,211,238,0.55); }
    60%  { box-shadow: 0 0 0 12px rgba(34,211,238,0.05); border-color: rgba(34,211,238,0.3); }
    100% { box-shadow: 0 0 0 0 rgba(34,211,238,0); border-color: rgba(34,211,238,0.1); }
  }

  .ov-asset-icon {
    width:42px;height:42px;border-radius:12px;
    display:flex;align-items:center;justify-content:center;flex-shrink:0;
  }
  .ov-asset-icon.xev{background:rgba(163,230,53,0.1);color:#a3e635;}
  .ov-asset-icon.ep{background:rgba(34,211,238,0.1);color:#22d3ee;}

  .ov-asset-name{font-size:14px;font-weight:700;color:rgba(255,255,255,0.85);line-height:1.3;}
  .ov-asset-desc{font-size:11px;color:rgba(255,255,255,0.28);margin-top:2px;}
  .ov-asset-right{margin-left:auto;text-align:right;position:relative;}
  .ov-asset-amount{font-size:19px;font-weight:800;font-family:"DM Mono",monospace;letter-spacing:-0.04em;transition:color 0.3s;}
  .ov-asset-amount.xev{color:#a3e635;}
  .ov-asset-amount.ep{color:#22d3ee;}
  .ov-asset-fiat{font-size:11px;color:rgba(255,255,255,0.25);margin-top:3px;font-family:"DM Mono",monospace;}
  .ov-asset-chip{
    display:inline-block;padding:2px 7px;border-radius:100px;
    background:rgba(34,211,238,0.1);border:1px solid rgba(34,211,238,0.2);
    font-size:9px;font-weight:800;color:#22d3ee;letter-spacing:0.08em;margin-top:4px;
  }

  /* ── PayWave card ── */
  .ov-paywave-card {
    display:flex;align-items:center;gap:14px;padding:16px;
    border-radius:16px;background:linear-gradient(135deg,rgba(34,211,238,0.07) 0%,rgba(59,130,246,0.05) 100%);
    border:1px solid rgba(34,211,238,0.15);cursor:pointer;
    transition:all .2s;margin-bottom:0;
  }
  .ov-paywave-card:hover{background:linear-gradient(135deg,rgba(34,211,238,0.11) 0%,rgba(59,130,246,0.08) 100%);border-color:rgba(34,211,238,0.28);transform:translateY(-1px);}
  .ov-pw-logo{width:46px;height:46px;border-radius:13px;background:linear-gradient(135deg,#0ea5e9,#3b82f6);display:flex;align-items:center;justify-content:center;flex-shrink:0;box-shadow:0 4px 16px rgba(14,165,233,0.3);}
  .ov-pw-name{font-size:16px;font-weight:800;color:rgba(255,255,255,0.9);}
  .ov-pw-desc{font-size:12px;color:rgba(255,255,255,0.32);margin-top:2px;}
  .ov-pw-arrow{margin-left:auto;opacity:0.3;transition:all .2s;}
  .ov-paywave-card:hover .ov-pw-arrow{opacity:0.7;transform:translateX(3px);}

  /* ── Transaction rows ── */
  .ov-tx-list{display:flex;flex-direction:column;gap:6px;}
  .ov-tx-row {
    display:flex;align-items:center;gap:12px;
    padding:12px 14px;border-radius:13px;
    background:rgba(255,255,255,0.022);border:1px solid rgba(255,255,255,0.05);
    transition:background .15s;animation:txIn .3s ease both;
  }
  .ov-tx-row:hover{background:rgba(255,255,255,0.04);}
  .ov-tx-row.pending{opacity:0.65;border-style:dashed;}
  @keyframes txIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}

  /* Avatar + direction composite */
  .ov-tx-avatar-wrap {
    position: relative;
    flex-shrink: 0;
    width: 40px;
    height: 40px;
  }
  /* Direction badge on avatar */
  .ov-tx-dir-badge {
    position: absolute;
    bottom: -3px;
    right: -3px;
    width: 16px;
    height: 16px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    border: 2px solid #07080a;
    z-index: 2;
  }
  .ov-tx-dir-badge.in  { background: rgba(163,230,53,0.9); }
  .ov-tx-dir-badge.out { background: rgba(248,113,113,0.9); }
  .ov-tx-dir-badge.pending-badge { background: rgba(245,158,11,0.9); }

  .ov-tx-label{font-size:13.5px;font-weight:700;color:rgba(255,255,255,0.82);display:flex;align-items:center;gap:6px;}
  .ov-tx-sub{font-size:11px;color:rgba(255,255,255,0.25);margin-top:2px;}
  .ov-tx-counterparty{font-size:10.5px;color:rgba(255,255,255,0.3);margin-top:1px;font-family:"DM Mono",monospace;}
  .ov-pending-tag{
    display:inline-block;padding:2px 7px;border-radius:100px;
    background:rgba(245,158,11,0.1);border:1px solid rgba(245,158,11,0.2);
    font-size:9px;font-weight:700;color:#f59e0b;letter-spacing:0.06em;
  }
  .ov-tx-right { margin-left: auto; text-align: right; display: flex; flex-direction: column; align-items: flex-end; gap: 4px; }
  .ov-tx-amount{font-size:14px;font-weight:800;font-family:"DM Mono",monospace;white-space:nowrap;letter-spacing:-0.02em;}
  .ov-tx-amount.in{color:#a3e635;}
  .ov-tx-amount.out{color:#f87171;}

  /* Direction pill next to amount */
  .ov-tx-dir-pill {
    display: inline-flex; align-items: center; gap: 3px;
    padding: 2px 7px; border-radius: 100px;
    font-size: 9px; font-weight: 800; letter-spacing: 0.06em;
  }
  .ov-tx-dir-pill.in  { background:rgba(163,230,53,0.1); color:#a3e635; border:1px solid rgba(163,230,53,0.2); }
  .ov-tx-dir-pill.out { background:rgba(248,113,113,0.08); color:#f87171; border:1px solid rgba(248,113,113,0.15); }

  /* ── Burn strip ── */
  .ov-burn-strip{
    display:flex;align-items:flex-start;gap:8px;
    padding:11px 14px;border-radius:10px;margin-top:18px;margin-bottom:24px;
    background:rgba(248,113,113,0.04);border:1px solid rgba(248,113,113,0.1);
    font-size:12px;color:rgba(255,255,255,0.3);line-height:1.6;
  }

  /* ── Empty state ── */
  .ov-empty{
    display:flex;flex-direction:column;align-items:center;
    padding:40px 20px;color:rgba(255,255,255,0.2);
  }
  .ov-empty-icon{opacity:0.15;margin-bottom:12px;}
  .ov-empty-title{font-size:14px;font-weight:700;margin-bottom:4px;}
  .ov-empty-sub{font-size:12px;}

  /* skeleton */
  .ov-skel{background:rgba(255,255,255,0.04);border-radius:12px;animation:ovSkel 1.5s ease-in-out infinite;}
  @keyframes ovSkel{0%,100%{opacity:1}50%{opacity:0.4}}

  /* delta flash */
  @keyframes ovDeltaIn {
    from { opacity:0; transform: translateY(6px) scale(0.85); }
    to   { opacity:1; transform: translateY(0)   scale(1); }
  }
`;

// ── Animated balance number ──────────────────────────────────────
function AnimatedBalance({ value, loading, className, style }) {
  const animated = useAnimatedNumber(loading ? 0 : (value || 0), 650);
  return (
    <div className={className} style={style}>
      {loading ? "—" : animated.toLocaleString(undefined, { maximumFractionDigits: 4 })}
    </div>
  );
}

// ── Asset card with flash on change ─────────────────────────────
function AssetCard({ type, icon, name, desc, value, fiatLine, chip, loading, delta, currency }) {
  const [flashClass, setFlashClass] = useState("");
  const prevVal = useRef(value);

  useEffect(() => {
    if (!loading && value !== prevVal.current && prevVal.current !== undefined) {
      setFlashClass(`flash-${type}`);
      const t = setTimeout(() => setFlashClass(""), 800);
      prevVal.current = value;
      return () => clearTimeout(t);
    }
    prevVal.current = value;
  }, [value, loading, type]);

  return (
    <div className={`ov-asset-card ${type} ${flashClass}`}>
      <div className={`ov-asset-icon ${type}`}>{icon}</div>
      <div>
        <div className="ov-asset-name">{name}</div>
        <div className="ov-asset-desc">{desc}</div>
      </div>
      <div className="ov-asset-right">
        {/* Delta flash badge */}
        <DeltaFlash delta={delta} currency={currency} />
        <AnimatedBalance
          value={value}
          loading={loading}
          className={`ov-asset-amount ${type}`}
        />
        {fiatLine && <div className="ov-asset-fiat">{fiatLine}</div>}
        {chip && <div className="ov-asset-chip">{chip}</div>}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
export default function OverviewTab({
  balance, setActiveTab, loading, transactions = [],
  userId, username, showPayWave, currentUser,
}) {
  const [showMore, setShowMore] = useState(false);
  const [hideBalance, setHide]  = useState(false);
  const { format } = useCurrency();

  const xev = balance?.tokens ?? 0;
  const ep  = balance?.points ?? 0;

  // Track deltas for flash indicators
  const prevXEV = useRef(xev);
  const prevEP  = useRef(ep);
  const [xevDelta, setXevDelta] = useState(0);
  const [epDelta,  setEpDelta]  = useState(0);

  useEffect(() => {
    if (!loading) {
      const dx = xev - prevXEV.current;
      const de = ep  - prevEP.current;
      if (dx !== 0) setXevDelta(dx);
      if (de !== 0) setEpDelta(de);
      prevXEV.current = xev;
      prevEP.current  = ep;
    }
  }, [xev, ep, loading]);

  return (
    <div className="view-enter">
      <style>{CSS}</style>

      {/* ══ BALANCE CARD ══ */}
      <BalanceCard
        balance={balance}
        loading={loading}
        hideBalance={hideBalance}
        onToggleHide={() => setHide(h => !h)}
        username={username}
      />

      {/* ══ QUICK ACTIONS ══ */}
      <div className="ov-actions">
        <button className="ov-act-btn primary" onClick={() => setActiveTab("send")}>
          <div className="ov-act-icon"><ArrowUpRight size={18} /></div>
          Send
        </button>
        <button className="ov-act-btn" onClick={() => setActiveTab("deposit")}>
          <div className="ov-act-icon"><Download size={18} /></div>
          Deposit
        </button>
        <button className="ov-act-btn" onClick={() => setActiveTab("receive")}>
          <div className="ov-act-icon"><ArrowDownLeft size={18} /></div>
          Receive
        </button>
        <button className="ov-act-btn" onClick={() => setShowMore(m => !m)}>
          <div className="ov-act-icon"><MoreHorizontal size={18} /></div>
          More
        </button>
      </div>

      {showMore && (
        <div className="ov-more-panel">
          {[
            { icon: Repeat,     label: "Swap",     tab: "swap"     },
            { icon: TrendingUp, label: "Trade",    tab: "trade"    },
            ...(showPayWave ? [{ icon: Wifi, label: "PayWave", tab: "paywave" }] : []),
            { icon: Settings,   label: "Settings", tab: "settings" },
          ].map(({ icon: Icon, label, tab }) => (
            <button key={tab} className="ov-act-btn" onClick={() => { setActiveTab(tab); setShowMore(false); }}>
              <div className="ov-act-icon"><Icon size={16} /></div>
              {label}
            </button>
          ))}
        </div>
      )}

      {/* ══ YOUR ASSETS ══ */}
      <div className="ov-section-head">
        <div className="ov-section-line" />
        <span className="ov-section-title">Your Assets</span>
        <div className="ov-section-line" />
      </div>

      <AssetCard
        type="xev"
        icon={<Coins size={20} />}
        name="$XEV Token"
        desc="Transferable · On-chain"
        value={xev}
        fiatLine={loading ? "—" : `≈ ${format(xev, false)}`}
        loading={loading}
        delta={xevDelta}
        currency="$XEV"
      />

      <AssetCard
        type="ep"
        icon={<Zap size={20} />}
        name="Engagement Points"
        desc="Platform currency · Internal only"
        value={ep}
        chip="INTERNAL"
        loading={loading}
        delta={epDelta}
        currency="EP"
      />

      {/* ══ PAYWAVE (region-gated) ══ */}
      {showPayWave && (
        <>
          <div className="ov-section-head" style={{ marginTop: 8 }}>
            <div className="ov-section-line" />
            <span className="ov-section-title">Quick Pay</span>
            <div className="ov-section-line" />
          </div>
          <div className="ov-paywave-card" onClick={() => setActiveTab("paywave")} role="button" tabIndex={0}>
            <div className="ov-pw-logo"><Wifi size={22} color="#fff" /></div>
            <div>
              <div className="ov-pw-name">PayWave</div>
              <div className="ov-pw-desc">Send money · Zero fees · Instant</div>
            </div>
            <ChevronRight size={18} className="ov-pw-arrow" />
          </div>
        </>
      )}

      {/* ══ RECENT ACTIVITY ══ */}
      <div className="ov-section-head" style={{ marginTop: 24 }}>
        <div className="ov-section-line" />
        <span className="ov-section-title">Recent Activity</span>
        <div className="ov-section-line" />
      </div>

      {loading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {[1, 2, 3].map(i => (
            <div key={i} className="ov-skel" style={{ height: 60 }} />
          ))}
        </div>
      ) : transactions.length === 0 ? (
        <div className="ov-empty">
          <Zap size={32} className="ov-empty-icon" />
          <div className="ov-empty-title">No activity yet</div>
          <div className="ov-empty-sub">Your transactions will appear here</div>
        </div>
      ) : (
        <div className="ov-tx-list">
          {transactions.map((tx, idx) => {
            const isPending  = tx._optimistic === true;
            const isSent     = tx.change_type === "debit";
            const isReceived = tx.change_type === "credit";
            const currency   = tx.displayCurrency || tx.metadata?.currency || "EP";
            const label      = tx.displayLabel || (isSent ? "Sent" : "Received");
            const cp         = tx.counterparty;

            const dateStr = tx.created_at
              ? new Date(tx.created_at).toLocaleString("en-NG", {
                  month: "short", day: "numeric",
                  hour: "2-digit", minute: "2-digit",
                })
              : "Just now";

            // Direction classes
            const dirClass = isPending ? "pending-badge" : isReceived ? "in" : "out";
            const amtClass = isReceived ? "in" : "out";

            return (
              <div
                key={tx.id || `opt-${idx}`}
                className={`ov-tx-row${isPending ? " pending" : ""}`}
                style={{ animationDelay: `${idx * 30}ms` }}
              >
                {/* ── Avatar with direction badge — TxAvatar fetches full profile if needed ── */}
                {cp ? (
                  <TxAvatar
                    cp={cp}
                    currentUser={currentUser}
                    dirClass={dirClass}
                    isPending={isPending}
                    isReceived={isReceived}
                  />
                ) : (
                  <div className="ov-tx-avatar-wrap">
                    <TxDirectionChip isIn={isReceived} isPending={isPending} />
                  </div>
                )}

                {/* ── Text content ── */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="ov-tx-label">
                    {label}
                    {isPending && <span className="ov-pending-tag">SENDING</span>}
                  </div>
                  {cp && (
                    <div className="ov-tx-counterparty">
                      {isSent ? "to" : "from"} @{cp.username}
                    </div>
                  )}
                  {tx.note && (
                    <div className="ov-tx-sub" style={{ fontStyle: "italic" }}>
                      "{tx.note}"
                    </div>
                  )}
                  <div className="ov-tx-sub">{isPending ? "Processing…" : dateStr}</div>
                </div>

                {/* ── Amount + direction pill ── */}
                <div className="ov-tx-right">
                  <div className={`ov-tx-amount ${amtClass}`}>
                    {isReceived ? "+" : "−"}{(tx.amount || 0).toLocaleString()}{" "}
                    <span style={{ fontSize: 10, opacity: 0.7 }}>{currency}</span>
                  </div>
                  <div className={`ov-tx-dir-pill ${amtClass}`}>
                    {isReceived ? (
                      <svg width="7" height="7" viewBox="0 0 10 10" fill="none">
                        <path d="M8 2L2 8M2 8H6M2 8V4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    ) : (
                      <svg width="7" height="7" viewBox="0 0 10 10" fill="none">
                        <path d="M2 8L8 2M8 2H4M8 2V6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    )}
                    {isReceived ? "IN" : "OUT"}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ══ BURN STRIP ══ */}
      <div className="ov-burn-strip">
        <Flame size={14} color="rgba(248,113,113,0.6)" style={{ flexShrink: 0, marginTop: 2 }} />
        <span>
          EP sends under 100 EP cost only{" "}
          <strong style={{ color: "rgba(248,113,113,0.85)" }}>0.5 EP</strong> burn fee.
          Minimum send: <strong style={{ color: "rgba(255,255,255,0.4)" }}>5 EP</strong>.
        </span>
      </div>
    </div>
  );
}