// ============================================================================
// src/components/Admin/sections/AmbassadorSection.jsx
// ADMIN — AMBASSADOR PROGRAM MANAGEMENT
//
// Mirrors the quality and patterns of InviteSection.jsx but purpose-built
// for the ambassador program. Includes:
//   - Live stats panel (total ambassadors, referrals, payouts pending)
//   - Level breakdown bar chart
//   - Ambassador table with search, level filter, expand-in-place detail
//   - Payout queue with approve/reject
//   - Admin override: level, suspend, restore
// ============================================================================
/* eslint-disable no-unused-vars */
import React, { useState, useCallback, useEffect, useRef } from "react";
import { supabase } from "../../../services/config/supabase";
import { C } from "../AdminUI.jsx";
import {
  useAdminAmbassadors,
  useAdminAmbassadorStats,
  useAdminPayouts,
  AMBASSADOR_LEVELS,
  getLevelConfig,
} from "../../Ambassador/useAmbassadorData";
import {
  TrendingUp,
  Users,
  DollarSign,
  Award,
  ChevronDown,
  ChevronRight,
  RefreshCw,
  Shield,
  ShieldOff,
  Star,
  AlertCircle,
  CheckCircle,
  XCircle,
  ArrowUpRight,
  BarChart2,
  Clock,
  Link,
  Filter,
} from "lucide-react";

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmt$(n) {
  return `$${Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function fmtNum(n) { return Number(n || 0).toLocaleString(); }
function timeAgo(iso) {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso);
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}
function buildLink(code) {
  return `${typeof window !== "undefined" ? window.location.origin : ""}?ref=${code}`;
}

// ─── Pill badge ────────────────────────────────────────────────────────────
function Pill({ label, color = C.accent }) {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center",
      fontSize: 9, fontWeight: 800, letterSpacing: "1.5px",
      textTransform: "uppercase", color,
      background: `${color}12`, border: `1px solid ${color}28`,
      borderRadius: 20, padding: "2px 8px", whiteSpace: "nowrap",
    }}>{label}</span>
  );
}

// ─── Level Badge ──────────────────────────────────────────────────────────────
function LevelBadge({ level }) {
  const cfg = getLevelConfig(level);
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      padding: "3px 9px", borderRadius: 20,
      background: cfg.badgeBg, border: `1px solid ${cfg.badgeBorder}`,
      fontSize: 10, fontWeight: 800, color: cfg.color, whiteSpace: "nowrap",
    }}>
      {cfg.icon} Lv{level} {cfg.name}
    </span>
  );
}

// ─── Animated count ──────────────────────────────────────────────────────────
function CountUp({ target, prefix = "", decimals = 0 }) {
  const [val, setVal] = useState(0);
  const ref = useRef();
  useEffect(() => {
    const num = parseFloat(String(target).replace(/[^0-9.]/g, "")) || 0;
    const steps = 40;
    let step = 0;
    clearInterval(ref.current);
    ref.current = setInterval(() => {
      step++;
      const eased = 1 - Math.pow(1 - step / steps, 3);
      setVal(num * eased);
      if (step >= steps) { setVal(num); clearInterval(ref.current); }
    }, 800 / steps);
    return () => clearInterval(ref.current);
  }, [target]);
  return (
    <span>
      {prefix}
      {decimals > 0
        ? val.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
        : Math.round(val).toLocaleString()}
    </span>
  );
}

// ─── Stat Card ────────────────────────────────────────────────────────────────
function StatCard({ icon: Icon, label, value, sub, color = C.accent, prefix = "", decimals = 0 }) {
  const [hov, setHov] = useState(false);
  return (
    <div
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        background: hov ? "#141414" : "#0f0f0f",
        border: `1px solid ${hov ? color + "44" : "#1d1d1d"}`,
        borderRadius: 16, padding: "18px 18px 14px",
        transition: "all .2s", position: "relative", overflow: "hidden",
      }}
    >
      <div style={{
        position: "absolute", top: -30, right: -30,
        width: 100, height: 100, borderRadius: "50%",
        background: `radial-gradient(circle, ${color}18 0%, transparent 70%)`,
        opacity: hov ? 1 : 0.5, transition: "opacity .3s",
        pointerEvents: "none",
      }} />
      <div style={{
        width: 32, height: 32, borderRadius: 9,
        background: `${color}12`, border: `1px solid ${color}22`,
        display: "flex", alignItems: "center", justifyContent: "center",
        marginBottom: 12,
      }}>
        <Icon size={15} color={color} strokeWidth={2} />
      </div>
      <div style={{ fontSize: 9, fontWeight: 800, color: C.muted, textTransform: "uppercase", letterSpacing: "1.2px", marginBottom: 6 }}>
        {label}
      </div>
      <div style={{ fontSize: 26, fontWeight: 900, color: C.text, letterSpacing: -1, lineHeight: 1 }}>
        <CountUp target={value} prefix={prefix} decimals={decimals} />
      </div>
      {sub && <div style={{ fontSize: 10, color: C.muted, marginTop: 5 }}>{sub}</div>}
    </div>
  );
}

// ─── Level breakdown mini-chart ───────────────────────────────────────────────
function LevelBreakdown({ levelBreakdown, totalAmbassadors }) {
  if (!levelBreakdown?.length) return null;
  const max = Math.max(...levelBreakdown.map((l) => l.count), 1);
  return (
    <div style={{ background: "#0f0f0f", border: "1px solid #1d1d1d", borderRadius: 16, padding: 18 }}>
      <div style={{ fontSize: 12, fontWeight: 800, color: C.text, marginBottom: 14 }}>Level Distribution</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
        {levelBreakdown.map((item) => {
          const cfg = getLevelConfig(item.level);
          const pct = totalAmbassadors > 0 ? (item.count / totalAmbassadors) * 100 : 0;
          return (
            <div key={item.level} style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 14, flexShrink: 0, width: 20 }}>{cfg.icon}</span>
              <div style={{ width: 56, flexShrink: 0 }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: cfg.color }}>{cfg.name}</span>
              </div>
              <div style={{ flex: 1, height: 6, background: "#1a1a1a", borderRadius: 3, overflow: "hidden" }}>
                <div style={{
                  height: "100%",
                  width: `${pct}%`,
                  background: `linear-gradient(90deg, ${cfg.color}66, ${cfg.color})`,
                  borderRadius: 3,
                  transition: "width .9s cubic-bezier(.4,0,.2,1)",
                }} />
              </div>
              <span style={{ fontSize: 10, fontWeight: 800, color: C.muted, width: 28, textAlign: "right" }}>
                {item.count}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Copy button ─────────────────────────────────────────────────────────────
function CopyBtn({ text, label = "Copy" }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    });
  };
  return (
    <button onClick={copy} style={{
      padding: "4px 10px", borderRadius: 7,
      border: `1px solid ${copied ? C.accent + "44" : "#282828"}`,
      background: copied ? `${C.accent}0a` : "transparent",
      color: copied ? C.accent : "#666",
      fontSize: 10, fontWeight: 700, cursor: "pointer",
      fontFamily: "inherit", transition: "all .15s", whiteSpace: "nowrap",
    }}>
      {copied ? "✓" : label}
    </button>
  );
}

// ─── Level Override Modal ─────────────────────────────────────────────────────
function LevelOverrideModal({ ambassador, onClose, onSave }) {
  const [selectedLevel, setSelectedLevel] = useState(ambassador.current_level);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try { await onSave(ambassador.id, selectedLevel); onClose(); }
    finally { setSaving(false); }
  };

  return (
    <div style={{
      position: "fixed", inset: 0,
      background: "rgba(0,0,0,.85)", backdropFilter: "blur(8px)",
      zIndex: 10600, display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
    }} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={{
        background: "#0d0d0d", border: "1px solid #252525",
        borderRadius: 18, padding: 26, width: "100%", maxWidth: 440,
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <div style={{ fontSize: 14, fontWeight: 900, color: C.text }}>Override Ambassador Level</div>
          <button onClick={onClose} style={{ background: "transparent", border: "1px solid #252525", borderRadius: 7, color: "#555", cursor: "pointer", padding: "3px 9px", fontFamily: "inherit" }}>×</button>
        </div>
        <div style={{ fontSize: 11, color: C.muted, marginBottom: 16 }}>
          Manually set level for <strong style={{ color: C.text2 }}>{ambassador.user?.full_name || "this ambassador"}</strong>.
          This overrides automatic monthly recalculation until cleared.
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 20 }}>
          {AMBASSADOR_LEVELS.map((l) => (
            <div
              key={l.level}
              onClick={() => setSelectedLevel(l.level)}
              style={{
                display: "flex", alignItems: "center", gap: 12,
                padding: "12px 14px", borderRadius: 12, cursor: "pointer",
                border: `1px solid ${selectedLevel === l.level ? l.badgeBorder : "#1e1e1e"}`,
                background: selectedLevel === l.level ? l.badgeBg : "transparent",
                transition: "all .15s",
              }}
            >
              <span style={{ fontSize: 18 }}>{l.icon}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: selectedLevel === l.level ? l.color : C.text2 }}>
                  Level {l.level} — {l.name}
                </div>
                <div style={{ fontSize: 10, color: C.muted }}>{l.commissionPct}% commission · {l.minMonthly}–{l.maxMonthly === Infinity ? "∞" : l.maxMonthly}/mo</div>
              </div>
              {selectedLevel === l.level && (
                <div style={{ width: 7, height: 7, borderRadius: "50%", background: l.color, boxShadow: `0 0 8px ${l.color}` }} />
              )}
            </div>
          ))}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={onClose} style={{
            flex: 1, padding: "11px", borderRadius: 11,
            border: "1px solid #252525", background: "transparent",
            color: "#666", fontWeight: 700, fontSize: 12,
            cursor: "pointer", fontFamily: "inherit",
          }}>Cancel</button>
          <button onClick={save} disabled={saving} style={{
            flex: 2, padding: "11px", borderRadius: 11, border: "none",
            background: saving ? "#1a1a1a" : `linear-gradient(135deg, ${C.accent}, #65a30d)`,
            color: saving ? "#333" : "#061000",
            fontWeight: 800, fontSize: 12,
            cursor: saving ? "not-allowed" : "pointer", fontFamily: "inherit",
          }}>
            {saving ? "Saving…" : `Set Level ${selectedLevel} (${getLevelConfig(selectedLevel).name})`}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Ambassador Row (expandable) ──────────────────────────────────────────────
function AmbassadorRow({ ambassador, onOverrideLevel, onSuspend, onRestore }) {
  const [expanded, setExpanded] = useState(false);
  const [showLevelModal, setShowLevelModal] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);
  const [toast, setToast] = useState(null);

  const cfg = getLevelConfig(ambassador.current_level);
  const user = ambassador.user || {};
  const invite = ambassador.invite || {};
  const link = buildLink(ambassador.invite_code);
  const isSuspended = ambassador.status === "suspended";
  const initials = (user.full_name || user.username || "?").slice(0, 2).toUpperCase();

  const showToast = (text, ok = true) => {
    setToast({ text, ok });
    setTimeout(() => setToast(null), 3000);
  };

  const handleSuspend = async () => {
    setActionBusy(true);
    try {
      await onSuspend(ambassador.id, "Suspended by admin");
      showToast("Ambassador suspended");
    } catch (e) { showToast(e.message, false); }
    finally { setActionBusy(false); }
  };

  const handleRestore = async () => {
    setActionBusy(true);
    try {
      await onRestore(ambassador.id);
      showToast("Ambassador restored", true);
    } catch (e) { showToast(e.message, false); }
    finally { setActionBusy(false); }
  };

  return (
    <>
      {showLevelModal && (
        <LevelOverrideModal
          ambassador={ambassador}
          onClose={() => setShowLevelModal(false)}
          onSave={onOverrideLevel}
        />
      )}
      <div style={{
        background: "#0c0c0c",
        border: `1px solid ${expanded ? cfg.badgeBorder : "#1e1e1e"}`,
        borderRadius: 14, overflow: "hidden",
        transition: "border-color .2s",
        marginBottom: 8,
      }}>
        {/* Row header */}
        <div
          onClick={() => setExpanded((v) => !v)}
          style={{ display: "flex", alignItems: "center", gap: 12, padding: "13px 16px", cursor: "pointer" }}
        >
          {/* Avatar */}
          <div style={{
            width: 38, height: 38, borderRadius: "50%", flexShrink: 0,
            background: `linear-gradient(135deg, ${cfg.color}30, ${cfg.color}10)`,
            border: `2px solid ${cfg.color}33`,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 13, fontWeight: 900, color: cfg.color,
          }}>
            {initials}
          </div>
          {/* Name + meta */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <span style={{ fontSize: 13, fontWeight: 800, color: C.text }}>
                {user.full_name || "Unknown"}
              </span>
              <LevelBadge level={ambassador.current_level} />
              {isSuspended && <Pill label="SUSPENDED" color={C.danger} />}
              {ambassador.level_override && <Pill label="OVERRIDE" color={C.warn} />}
            </div>
            <div style={{ fontSize: 10, color: C.muted, marginTop: 2, display: "flex", gap: 8, flexWrap: "wrap" }}>
              <span>@{user.username || "—"}</span>
              <span>·</span>
              <span style={{ fontFamily: "monospace", color: cfg.color }}>?ref={ambassador.invite_code}</span>
              <span>·</span>
              <span>{fmtNum(ambassador.total_referrals)} referrals</span>
              <span>·</span>
              <span>Joined {timeAgo(ambassador.joined_at)}</span>
            </div>
          </div>
          {/* Earnings */}
          <div style={{ textAlign: "right", flexShrink: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 900, color: C.success }}>
              {fmt$(ambassador.lifetime_earned)}
            </div>
            <div style={{ fontSize: 9, color: C.muted }}>lifetime earned</div>
          </div>
          {/* Commission */}
          <div style={{
            padding: "6px 12px", borderRadius: 10,
            background: cfg.badgeBg, border: `1px solid ${cfg.badgeBorder}`,
            textAlign: "center", flexShrink: 0,
          }}>
            <div style={{ fontSize: 14, fontWeight: 900, color: cfg.color }}>{ambassador.commission_pct}%</div>
            <div style={{ fontSize: 8, color: C.muted }}>rate</div>
          </div>
          {/* Expand arrow */}
          <div style={{ color: C.muted, flexShrink: 0 }}>
            {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          </div>
        </div>

        {/* Expanded detail */}
        {expanded && (
          <div style={{ borderTop: "1px solid #141414", padding: "16px 16px 14px", display: "flex", flexDirection: "column", gap: 14 }}>
            {toast && (
              <div style={{
                padding: "7px 12px", borderRadius: 8,
                background: toast.ok ? "rgba(52,211,153,.07)" : "rgba(248,113,113,.07)",
                border: `1px solid ${toast.ok ? "rgba(52,211,153,.2)" : "rgba(248,113,113,.2)"}`,
                fontSize: 11, fontWeight: 700,
                color: toast.ok ? C.success : C.danger,
              }}>{toast.text}</div>
            )}

            {/* Stats mini grid */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
              {[
                { label: "This Month", value: fmtNum(ambassador.this_month_referrals), color: cfg.color },
                { label: "Last Month", value: fmtNum(ambassador.prev_month_referrals), color: C.info },
                { label: "Total Referrals", value: fmtNum(ambassador.total_referrals), color: C.accent },
                { label: "Lifetime Earned", value: fmt$(ambassador.lifetime_earned), color: C.success },
              ].map((s) => (
                <div key={s.label} style={{
                  background: "#0a0a0a", border: "1px solid #141414",
                  borderRadius: 10, padding: "10px 12px",
                }}>
                  <div style={{ fontSize: 9, color: C.muted, textTransform: "uppercase", letterSpacing: "1px", marginBottom: 4 }}>{s.label}</div>
                  <div style={{ fontSize: 16, fontWeight: 900, color: s.color }}>{s.value}</div>
                </div>
              ))}
            </div>

            {/* Link + contact */}
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{
                display: "flex", alignItems: "center", gap: 8,
                background: "#080808", border: "1px solid #1a1a1a",
                borderRadius: 10, padding: "8px 12px",
              }}>
                <span style={{ fontSize: 10, color: "#555", fontWeight: 700, flexShrink: 0 }}>🔗 Link</span>
                <span style={{ flex: 1, fontSize: 11, color: "#666", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontFamily: "monospace" }}>
                  {link}
                </span>
                <CopyBtn text={link} label="Copy" />
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <div style={{ flex: 1, background: "#080808", border: "1px solid #1a1a1a", borderRadius: 10, padding: "7px 12px", fontSize: 10, color: "#555" }}>
                  📧 {user.email || "—"}
                </div>
                <div style={{ flex: 1, background: "#080808", border: "1px solid #1a1a1a", borderRadius: 10, padding: "7px 12px", fontSize: 10, color: "#555" }}>
                  🕐 Last seen: {timeAgo(user.last_seen)}
                </div>
              </div>
            </div>

            {/* Actions */}
            <div style={{
              display: "flex", gap: 8, flexWrap: "wrap",
              paddingTop: 8, borderTop: "1px solid #111",
            }}>
              <button
                onClick={() => setShowLevelModal(true)}
                style={{
                  display: "flex", alignItems: "center", gap: 6,
                  padding: "8px 13px", borderRadius: 9,
                  border: `1px solid ${C.warn}33`, background: `${C.warn}08`,
                  color: C.warn, fontWeight: 700, fontSize: 11,
                  cursor: "pointer", fontFamily: "inherit",
                }}
              >
                <Star size={12} /> Override Level
              </button>
              {!isSuspended ? (
                <button
                  onClick={handleSuspend}
                  disabled={actionBusy}
                  style={{
                    display: "flex", alignItems: "center", gap: 6,
                    padding: "8px 13px", borderRadius: 9,
                    border: `1px solid ${C.danger}33`, background: `${C.danger}08`,
                    color: C.danger, fontWeight: 700, fontSize: 11,
                    cursor: actionBusy ? "not-allowed" : "pointer", fontFamily: "inherit",
                  }}
                >
                  <ShieldOff size={12} /> Suspend
                </button>
              ) : (
                <button
                  onClick={handleRestore}
                  disabled={actionBusy}
                  style={{
                    display: "flex", alignItems: "center", gap: 6,
                    padding: "8px 13px", borderRadius: 9,
                    border: `1px solid ${C.success}33`, background: `${C.success}08`,
                    color: C.success, fontWeight: 700, fontSize: 11,
                    cursor: actionBusy ? "not-allowed" : "pointer", fontFamily: "inherit",
                  }}
                >
                  <Shield size={12} /> Restore
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
}

// ─── Payout Queue ─────────────────────────────────────────────────────────────
function PayoutQueue() {
  const { payouts, loading, filter, setFilter, reload, approvePayout, rejectPayout } = useAdminPayouts();
  const [actionId, setActionId] = useState(null);
  const [rejectModal, setRejectModal] = useState(null);
  const [rejectReason, setRejectReason] = useState("");
  const [toast, setToast] = useState(null);

  const showToast = (text, ok = true) => {
    setToast({ text, ok });
    setTimeout(() => setToast(null), 3000);
  };

  const handleApprove = async (payout) => {
    setActionId(payout.id);
    try {
      await approvePayout(payout.id, payout.ambassador_id);
      showToast(`✓ Payout of ${fmt$(payout.amount)} approved`);
    } catch (e) { showToast(e.message, false); }
    finally { setActionId(null); }
  };

  const handleReject = async () => {
    if (!rejectModal) return;
    setActionId(rejectModal.id);
    try {
      await rejectPayout(rejectModal.id, rejectReason);
      setRejectModal(null);
      setRejectReason("");
      showToast("Payout rejected");
    } catch (e) { showToast(e.message, false); }
    finally { setActionId(null); }
  };

  return (
    <div style={{ background: "#0f0f0f", border: "1px solid #1d1d1d", borderRadius: 16, overflow: "hidden" }}>
      {/* Header */}
      <div style={{
        padding: "14px 18px", borderBottom: "1px solid #181818",
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: C.text }}>💸 Payout Queue</div>
        <div style={{ display: "flex", gap: 6 }}>
          {["pending", "paid", "rejected", "all"].map((f) => (
            <button key={f} onClick={() => setFilter(f)} style={{
              padding: "5px 11px", borderRadius: 7,
              border: `1px solid ${filter === f ? C.accent + "44" : "#252525"}`,
              background: filter === f ? `${C.accent}0a` : "transparent",
              color: filter === f ? C.accent : "#555",
              fontSize: 10, fontWeight: 700, cursor: "pointer",
              fontFamily: "inherit", textTransform: "capitalize",
            }}>{f}</button>
          ))}
          <button onClick={reload} style={{
            padding: "5px 9px", borderRadius: 7,
            border: "1px solid #252525", background: "transparent",
            color: "#555", cursor: "pointer", display: "flex", alignItems: "center",
          }}>
            <RefreshCw size={11} />
          </button>
        </div>
      </div>

      {toast && (
        <div style={{
          margin: "10px 18px 0",
          padding: "7px 12px", borderRadius: 8,
          background: toast.ok ? "rgba(52,211,153,.07)" : "rgba(248,113,113,.07)",
          border: `1px solid ${toast.ok ? "rgba(52,211,153,.2)" : "rgba(248,113,113,.2)"}`,
          fontSize: 11, fontWeight: 700,
          color: toast.ok ? C.success : C.danger,
        }}>{toast.text}</div>
      )}

      {loading ? (
        <div style={{ padding: 32, textAlign: "center", color: C.muted, fontSize: 12 }}>Loading payouts…</div>
      ) : payouts.length === 0 ? (
        <div style={{ padding: 32, textAlign: "center" }}>
          <div style={{ fontSize: 28, marginBottom: 10 }}>🎉</div>
          <div style={{ fontSize: 12, color: C.muted }}>No {filter !== "all" ? filter : ""} payouts</div>
        </div>
      ) : (
        <div>
          {payouts.map((payout) => {
            const amb = payout.ambassador || {};
            const user = amb.user || {};
            const lvlCfg = getLevelConfig(amb.current_level || 1);
            const isBusy = actionId === payout.id;
            return (
              <div key={payout.id} style={{
                padding: "14px 18px",
                borderBottom: "1px solid #111",
                display: "flex", alignItems: "center", gap: 12,
              }}>
                {/* Level icon */}
                <div style={{
                  width: 36, height: 36, borderRadius: "50%", flexShrink: 0,
                  background: lvlCfg.badgeBg, border: `1px solid ${lvlCfg.badgeBorder}`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 16,
                }}>
                  {lvlCfg.icon}
                </div>
                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: C.text }}>
                    {user.full_name || "—"}
                  </div>
                  <div style={{ fontSize: 10, color: C.muted, marginTop: 1 }}>
                    @{user.username || "—"} · {user.email || "—"}
                  </div>
                  {payout.payout_info?.bank && (
                    <div style={{ fontSize: 10, color: "#444", marginTop: 2 }}>
                      Payout to: {payout.payout_info.bank}
                      {payout.payout_info.accountNumber && ` · ${payout.payout_info.accountNumber}`}
                    </div>
                  )}
                  <div style={{ fontSize: 9, color: "#333", marginTop: 1 }}>{timeAgo(payout.requested_at)}</div>
                </div>
                {/* Amount */}
                <div style={{ textAlign: "right", flexShrink: 0 }}>
                  <div style={{ fontSize: 16, fontWeight: 900, color: C.success }}>{fmt$(payout.amount)}</div>
                  <LevelBadge level={amb.current_level || 1} />
                </div>
                {/* Status / actions */}
                {payout.status === "pending" && (
                  <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                    <button
                      onClick={() => handleApprove(payout)}
                      disabled={isBusy}
                      style={{
                        display: "flex", alignItems: "center", gap: 5,
                        padding: "7px 12px", borderRadius: 9, border: "none",
                        background: isBusy ? "#1a1a1a" : `linear-gradient(135deg, ${C.success}, #059669)`,
                        color: isBusy ? "#333" : "#001a0d",
                        fontWeight: 800, fontSize: 10,
                        cursor: isBusy ? "not-allowed" : "pointer", fontFamily: "inherit",
                      }}
                    >
                      <CheckCircle size={11} /> {isBusy ? "…" : "Approve"}
                    </button>
                    <button
                      onClick={() => setRejectModal(payout)}
                      disabled={isBusy}
                      style={{
                        display: "flex", alignItems: "center", gap: 5,
                        padding: "7px 12px", borderRadius: 9,
                        border: `1px solid ${C.danger}33`, background: `${C.danger}08`,
                        color: C.danger, fontWeight: 800, fontSize: 10,
                        cursor: isBusy ? "not-allowed" : "pointer", fontFamily: "inherit",
                      }}
                    >
                      <XCircle size={11} /> Reject
                    </button>
                  </div>
                )}
                {payout.status === "paid" && <Pill label="PAID" color={C.success} />}
                {payout.status === "rejected" && <Pill label="REJECTED" color={C.danger} />}
              </div>
            );
          })}
        </div>
      )}

      {/* Reject modal */}
      {rejectModal && (
        <div style={{
          position: "fixed", inset: 0,
          background: "rgba(0,0,0,.85)", backdropFilter: "blur(8px)",
          zIndex: 10700, display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
        }} onClick={(e) => e.target === e.currentTarget && setRejectModal(null)}>
          <div style={{
            background: "#0d0d0d", border: "1px solid #252525",
            borderRadius: 16, padding: 24, width: "100%", maxWidth: 380,
          }}>
            <div style={{ fontSize: 14, fontWeight: 900, color: C.text, marginBottom: 8 }}>Reject Payout</div>
            <div style={{ fontSize: 11, color: C.muted, marginBottom: 16 }}>
              Rejecting {fmt$(rejectModal.amount)} for {rejectModal.ambassador?.user?.full_name || "ambassador"}
            </div>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Reason for rejection (shown to ambassador)…"
              rows={3}
              style={{
                width: "100%", background: "#111", border: "1px solid #252525",
                borderRadius: 10, padding: "9px 12px", color: C.text,
                fontSize: 12, fontFamily: "inherit", outline: "none",
                resize: "none", marginBottom: 14, transition: "border-color .15s",
              }}
              onFocus={(e) => (e.target.style.borderColor = `${C.danger}44`)}
              onBlur={(e) => (e.target.style.borderColor = "#252525")}
            />
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => setRejectModal(null)} style={{
                flex: 1, padding: "10px", borderRadius: 10,
                border: "1px solid #252525", background: "transparent",
                color: "#666", fontWeight: 700, fontSize: 12,
                cursor: "pointer", fontFamily: "inherit",
              }}>Cancel</button>
              <button onClick={handleReject} style={{
                flex: 1, padding: "10px", borderRadius: 10, border: "none",
                background: `${C.danger}18`, color: C.danger,
                border: `1px solid ${C.danger}44`,
                fontWeight: 800, fontSize: 12, cursor: "pointer", fontFamily: "inherit",
              }}>Confirm Reject</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── MAIN SECTION EXPORT ──────────────────────────────────────────────────────
export default function AmbassadorSection({ adminData }) {
  const {
    ambassadors, total, page, setPage, loading, error,
    search, setSearch, filterLevel, setFilterLevel,
    reload, suspendAmbassador, restoreAmbassador, overrideLevel,
  } = useAdminAmbassadors();

  const { stats, loading: statsLoading, reload: reloadStats } = useAdminAmbassadorStats();
  const [tab, setTab] = useState("ambassadors");

  const tabs = [
    { id: "ambassadors", label: "Ambassadors", icon: "👥" },
    { id: "payouts", label: "Payouts", icon: "💸" },
    { id: "settings", label: "Settings", icon: "⚙️" },
  ];

  return (
    <div>
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 24, gap: 12 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 10,
              background: `linear-gradient(135deg, ${C.accent}20, ${C.accent}08)`,
              border: `1px solid ${C.accent}28`,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 18,
            }}>🌐</div>
            <h2 style={{ fontSize: 18, fontWeight: 900, color: C.text, margin: 0, letterSpacing: -0.5 }}>
              Ambassador Program
            </h2>
          </div>
          <p style={{ fontSize: 12, color: C.muted, margin: 0 }}>
            Manage ambassadors, level overrides, commissions, and payout processing
          </p>
        </div>
        <button onClick={() => { reload(); reloadStats(); }} style={{
          display: "flex", alignItems: "center", gap: 6,
          padding: "8px 14px", borderRadius: 10,
          border: "1px solid #252525", background: "transparent",
          color: C.muted, fontSize: 11, fontWeight: 700,
          cursor: "pointer", fontFamily: "inherit",
        }}>
          <RefreshCw size={12} /> Refresh
        </button>
      </div>

      {/* ── Stats row ───────────────────────────────────────────────────── */}
      {stats && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 12, marginBottom: 20 }}>
          <StatCard icon={Users} label="Total Ambassadors" value={stats.totalAmbassadors} color={C.accent} />
          <StatCard icon={Award} label="Active" value={stats.activeAmbassadors} sub={`${stats.totalAmbassadors - stats.activeAmbassadors} suspended`} color={C.success} />
          <StatCard icon={TrendingUp} label="This Month Refs" value={stats.thisMonthReferrals} color={C.info} />
          <StatCard icon={DollarSign} label="Total Paid Out" value={stats.totalEarningsPaid} prefix="$" decimals={2} color={C.success} />
          <StatCard
            icon={Clock}
            label="Pending Payouts"
            value={stats.pendingPayoutAmount}
            prefix="$"
            decimals={2}
            sub={`${stats.pendingPayoutCount} request${stats.pendingPayoutCount !== 1 ? "s" : ""}`}
            color={C.warn}
          />
        </div>
      )}

      {/* ── Level breakdown + commission schedule ───────────────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 20 }}>
        {stats && (
          <LevelBreakdown levelBreakdown={stats.levelBreakdown} totalAmbassadors={stats.totalAmbassadors} />
        )}

        {/* Commission schedule */}
        <div style={{ background: "#0f0f0f", border: "1px solid #1d1d1d", borderRadius: 16, overflow: "hidden" }}>
          <div style={{ padding: "12px 16px", borderBottom: "1px solid #181818" }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: C.text }}>Commission Schedule</div>
            <div style={{ fontSize: 10, color: C.muted, marginTop: 2 }}>Level resets 1st of each month</div>
          </div>
          <div>
            {AMBASSADOR_LEVELS.map((l, i) => (
              <div key={l.level} style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "9px 16px",
                borderBottom: i < AMBASSADOR_LEVELS.length - 1 ? "1px solid #111" : "none",
              }}>
                <span style={{ fontSize: 14, flexShrink: 0 }}>{l.icon}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: l.color }}>{l.name}</div>
                  <div style={{ fontSize: 9, color: C.muted }}>
                    {l.minMonthly}–{l.maxMonthly === Infinity ? "∞" : l.maxMonthly} referrals/month
                  </div>
                </div>
                <div style={{
                  padding: "3px 10px", borderRadius: 8,
                  background: l.badgeBg, border: `1px solid ${l.badgeBorder}`,
                }}>
                  <span style={{ fontSize: 13, fontWeight: 900, color: l.color }}>{l.commissionPct}%</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Tabs ─────────────────────────────────────────────────────────── */}
      <div style={{ display: "flex", gap: 4, borderBottom: "1px solid #1a1a1a", marginBottom: 20 }}>
        {tabs.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            display: "flex", alignItems: "center", gap: 6,
            padding: "9px 16px", borderRadius: "9px 9px 0 0",
            border: "none", borderBottom: tab === t.id ? `2px solid ${C.accent}` : "2px solid transparent",
            background: "transparent",
            color: tab === t.id ? C.accent : C.muted,
            fontWeight: tab === t.id ? 800 : 600, fontSize: 12,
            cursor: "pointer", fontFamily: "inherit", transition: "all .15s",
          }}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* ── AMBASSADORS TAB ──────────────────────────────────────────────── */}
      {tab === "ambassadors" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {/* Search + filter */}
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, email, username, code…"
              style={{
                flex: 1, background: "#0e0e0e", border: "1.5px solid #1e1e1e",
                borderRadius: 10, padding: "9px 14px", color: C.text,
                fontSize: 12, fontFamily: "inherit", outline: "none",
                transition: "border-color .15s",
              }}
              onFocus={(e) => (e.target.style.borderColor = `${C.accent}44`)}
              onBlur={(e) => (e.target.style.borderColor = "#1e1e1e")}
            />
            <div style={{ display: "flex", gap: 6 }}>
              {["all", "1", "2", "3", "4", "5"].map((lv) => {
                const isCurrent = filterLevel === lv;
                const cfg = lv !== "all" ? getLevelConfig(Number(lv)) : null;
                return (
                  <button key={lv} onClick={() => setFilterLevel(lv)} style={{
                    padding: "8px 12px", borderRadius: 9, cursor: "pointer",
                    fontFamily: "inherit", fontSize: 11, fontWeight: 700,
                    border: `1px solid ${isCurrent ? (cfg?.badgeBorder || `${C.accent}44`) : "#1e1e1e"}`,
                    background: isCurrent ? (cfg?.badgeBg || `${C.accent}0a`) : "transparent",
                    color: isCurrent ? (cfg?.color || C.accent) : C.muted,
                    transition: "all .15s",
                  }}>
                    {lv === "all" ? "All" : `${cfg.icon} Lv${lv}`}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Count */}
          <div style={{ fontSize: 11, color: C.muted }}>
            {loading ? "Loading…" : `${fmtNum(total)} ambassadors${filterLevel !== "all" ? ` · Level ${filterLevel} filter` : ""}`}
          </div>

          {error && (
            <div style={{
              padding: "10px 14px", borderRadius: 10,
              background: "rgba(248,113,113,.06)", border: "1px solid rgba(248,113,113,.18)",
              fontSize: 12, color: C.danger,
            }}>
              {error}
              <button onClick={reload} style={{ marginLeft: 10, color: C.accent, background: "transparent", border: "none", cursor: "pointer", fontFamily: "inherit" }}>
                Retry
              </button>
            </div>
          )}

          {/* Ambassador rows */}
          {!loading && ambassadors.length === 0 ? (
            <div style={{
              padding: 40, textAlign: "center",
              background: "#0a0a0a", border: "1px dashed #1e1e1e", borderRadius: 14,
            }}>
              <div style={{ fontSize: 28, marginBottom: 10 }}>🌐</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: C.muted, marginBottom: 6 }}>No ambassadors yet</div>
              <div style={{ fontSize: 11, color: "#333" }}>When users join the ambassador program, they'll appear here</div>
            </div>
          ) : (
            ambassadors.map((amb) => (
              <AmbassadorRow
                key={amb.id}
                ambassador={amb}
                onOverrideLevel={overrideLevel}
                onSuspend={suspendAmbassador}
                onRestore={restoreAmbassador}
              />
            ))
          )}

          {/* Pagination */}
          {total > 20 && (
            <div style={{ display: "flex", justifyContent: "center", gap: 8, paddingTop: 8 }}>
              <button
                disabled={page === 0}
                onClick={() => setPage((p) => p - 1)}
                style={{
                  padding: "7px 14px", borderRadius: 9,
                  border: "1px solid #252525", background: "transparent",
                  color: page === 0 ? "#333" : C.muted,
                  fontSize: 11, fontWeight: 700, cursor: page === 0 ? "not-allowed" : "pointer",
                  fontFamily: "inherit",
                }}
              >← Prev</button>
              <span style={{ fontSize: 11, color: C.muted, lineHeight: "32px" }}>
                Page {page + 1} of {Math.ceil(total / 20)}
              </span>
              <button
                disabled={(page + 1) * 20 >= total}
                onClick={() => setPage((p) => p + 1)}
                style={{
                  padding: "7px 14px", borderRadius: 9,
                  border: "1px solid #252525", background: "transparent",
                  color: (page + 1) * 20 >= total ? "#333" : C.muted,
                  fontSize: 11, fontWeight: 700,
                  cursor: (page + 1) * 20 >= total ? "not-allowed" : "pointer",
                  fontFamily: "inherit",
                }}
              >Next →</button>
            </div>
          )}
        </div>
      )}

      {/* ── PAYOUTS TAB ──────────────────────────────────────────────────── */}
      {tab === "payouts" && <PayoutQueue />}

      {/* ── SETTINGS TAB ─────────────────────────────────────────────────── */}
      {tab === "settings" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{
            background: "#0f0f0f", border: "1px solid #1d1d1d",
            borderRadius: 16, padding: 20,
          }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: C.text, marginBottom: 16 }}>Program Rules</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {[
                { label: "Minimum Payout Threshold", value: "$10.00", note: "Ambassadors must earn ≥ $10 to request withdrawal" },
                { label: "Payout Processing Time", value: "3–5 business days", note: "After admin approves the request" },
                { label: "Level Reset Cycle", value: "Monthly (1st of month)", note: "prev_month_referrals determines the new level" },
                { label: "Entry Commission (Level 1)", value: "8%", note: "Automatic from first referral — no action needed" },
                { label: "Max Commission (Level 5)", value: "20%", note: "Requires 1,000+ referrals in previous month" },
                { label: "Commission Base", value: "Platform entry fee ($1)", note: "Ambassador earns X% of each $1 paid by their referrals" },
              ].map((r) => (
                <div key={r.label} style={{
                  display: "flex", alignItems: "flex-start", gap: 12,
                  padding: "10px 14px", borderRadius: 10,
                  background: "#0a0a0a", border: "1px solid #141414",
                }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: C.text2 }}>{r.label}</div>
                    <div style={{ fontSize: 10, color: C.muted, marginTop: 2 }}>{r.note}</div>
                  </div>
                  <div style={{
                    padding: "3px 10px", borderRadius: 7, flexShrink: 0,
                    background: `${C.accent}08`, border: `1px solid ${C.accent}22`,
                    fontSize: 11, fontWeight: 800, color: C.accent,
                  }}>{r.value}</div>
                </div>
              ))}
            </div>
          </div>

          <div style={{
            padding: "14px 16px",
            background: "rgba(96,165,250,.04)",
            border: "1px solid rgba(96,165,250,.14)",
            borderRadius: 12, fontSize: 11, color: "#3a5a7a", lineHeight: 1.7,
          }}>
            <strong style={{ color: C.info }}>ℹ️ Monthly level recalculation</strong> is handled by the Supabase
            pg_cron job: <code style={{ background: "#0a1520", padding: "1px 5px", borderRadius: 4 }}>SELECT public.reset_monthly_ambassador_stats()</code> — scheduled to run on the 1st of every month at midnight UTC.
            You can also trigger it manually from the SQL editor if needed.
          </div>
        </div>
      )}
    </div>
  );
}