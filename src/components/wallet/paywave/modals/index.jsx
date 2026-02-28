// paywave/modals/index.jsx
// ─────────────────────────────────────────────────────────────
// All PayWave modals in one place.
// SendTypeModal: only 2 options — PayWave (free) and OPay (external).
// ─────────────────────────────────────────────────────────────

import React, { useState } from "react";
import { X, Zap, Building2, CheckCircle2 } from "lucide-react";

// ── Overlay backdrop ─────────────────────────────────────────
function Backdrop({ onClick }) {
  return (
    <div
      onClick={onClick}
      style={{
        position: "fixed", inset: 0, zIndex: 998,
        background: "rgba(0,0,0,0.72)",
        backdropFilter: "blur(4px)",
        WebkitBackdropFilter: "blur(4px)",
      }}
    />
  );
}

// ── Modal shell ──────────────────────────────────────────────
function ModalShell({ children, onClose, title, maxWidth = 340 }) {
  return (
    <>
      <Backdrop onClick={onClose} />
      <div style={{
        position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)",
        zIndex: 999, width: "100%", maxWidth,
        background: "#0c0f0a",
        borderRadius: "20px 20px 0 0",
        border: "1px solid rgba(255,255,255,0.09)",
        borderBottom: "none",
        boxShadow: "0 -20px 60px rgba(0,0,0,0.6)",
        overflow: "hidden",
      }}>
        {/* Handle */}
        <div style={{ display: "flex", justifyContent: "center", padding: "12px 0 0" }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: "rgba(255,255,255,0.12)" }} />
        </div>
        {/* Header */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "10px 18px 0",
        }}>
          <span style={{
            fontFamily: "var(--font-d)", fontSize: 15, fontWeight: 700,
            color: "var(--text)",
          }}>{title}</span>
          <button
            onClick={onClose}
            style={{
              background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: 8, width: 28, height: 28, display: "flex",
              alignItems: "center", justifyContent: "center",
              cursor: "pointer", color: "rgba(255,255,255,0.45)",
            }}
          >
            <X size={13} />
          </button>
        </div>
        {children}
      </div>
    </>
  );
}

// ── PIN Modal ────────────────────────────────────────────────
export function PinModal({ onClose, onVerify }) {
  const [pin, setPin] = useState("");
  const [shake, setShake] = useState(false);

  const handleKey = (k) => {
    if (k === "del") { setPin(p => p.slice(0, -1)); return; }
    if (pin.length >= 4) return;
    const next = pin + k;
    setPin(next);
    if (next.length === 4) {
      setTimeout(() => {
        onVerify(next);
        setPin("");
      }, 180);
    }
  };

  const KEYS = [
    ["1","2","3"],
    ["4","5","6"],
    ["7","8","9"],
    ["","0","del"],
  ];

  return (
    <ModalShell onClose={onClose} title="Enter PIN">
      <div style={{ padding: "18px 20px 32px" }}>
        {/* Dots */}
        <div style={{ display: "flex", justifyContent: "center", gap: 14, margin: "14px 0 22px" }}>
          {[0,1,2,3].map(i => (
            <div key={i} style={{
              width: 14, height: 14, borderRadius: "50%",
              background: i < pin.length ? "var(--lime)" : "rgba(255,255,255,0.1)",
              border: i < pin.length ? "none" : "1px solid rgba(255,255,255,0.18)",
              transition: "background .15s, transform .1s",
              transform: i < pin.length ? "scale(1.15)" : "scale(1)",
              boxShadow: i < pin.length ? "0 0 10px rgba(163,230,53,0.4)" : "none",
            }} />
          ))}
        </div>

        {/* Keypad */}
        {KEYS.map((row, ri) => (
          <div key={ri} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 8 }}>
            {row.map((k, ki) => (
              <button
                key={ki}
                onClick={() => k && handleKey(k)}
                style={{
                  height: 52, borderRadius: 12,
                  background: k === "" ? "transparent" : k === "del" ? "rgba(248,113,113,0.08)" : "rgba(255,255,255,0.04)",
                  border: k === "" ? "none" : k === "del" ? "1px solid rgba(248,113,113,0.15)" : "1px solid rgba(255,255,255,0.07)",
                  color: k === "del" ? "#f87171" : "var(--text)",
                  fontFamily: "var(--font-d)", fontSize: 18, fontWeight: 700,
                  cursor: k ? "pointer" : "default",
                  transition: "background .12s, transform .1s",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}
                onMouseDown={e => k && (e.currentTarget.style.transform = "scale(0.93)")}
                onMouseUp={e => k && (e.currentTarget.style.transform = "scale(1)")}
              >
                {k === "del" ? (
                  <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                    <path d="M21 4H8l-7 8 7 8h13a2 2 0 002-2V6a2 2 0 00-2-2z"/><line x1="18" y1="9" x2="14" y2="15"/>
                    <line x1="14" y1="9" x2="18" y2="15"/>
                  </svg>
                ) : k}
              </button>
            ))}
          </div>
        ))}

        <div style={{ textAlign: "center", marginTop: 12, color: "rgba(255,255,255,0.2)", fontSize: 11, fontFamily: "var(--font-b)" }}>
          Demo PIN: <span style={{ color: "var(--lime)", fontFamily: "var(--font-m)" }}>1234</span>
        </div>
      </div>
    </ModalShell>
  );
}

// ── Send Type Modal — PayWave | OPay ────────────────────────
// ONLY 2 options. No "Other Bank". No bank list.
// PayWave = free internal. OPay = external with fee.
export function SendTypeModal({ onClose, onSelect }) {
  const [hovered, setHovered] = useState(null);

  const OPTIONS = [
    {
      id: "paywave",
      icon: Zap,
      iconBg: "linear-gradient(135deg, #a3e635, #65a30d)",
      iconColor: "#0a0e06",
      title: "PayWave Transfer",
      subtitle: "Send to any Xeevia user",
      badge: "FREE",
      badgeColor: "#a3e635",
      badgeBg: "rgba(163,230,53,0.1)",
      badgeBorder: "rgba(163,230,53,0.25)",
      borderActive: "rgba(163,230,53,0.3)",
      bgActive: "rgba(163,230,53,0.05)",
      description: "Instant · Zero fees · No account number needed",
      descColor: "rgba(163,230,53,0.55)",
    },
    {
      id: "opay",
      icon: Building2,
      iconBg: "linear-gradient(135deg, #10b981, #059669)",
      iconColor: "#fff",
      title: "OPay Transfer",
      subtitle: "Send to any Nigerian bank",
      badge: "FEE APPLIES",
      badgeColor: "#f59e0b",
      badgeBg: "rgba(245,158,11,0.08)",
      badgeBorder: "rgba(245,158,11,0.2)",
      borderActive: "rgba(16,185,129,0.28)",
      bgActive: "rgba(16,185,129,0.04)",
      description: "GTBank · Access · Zenith · UBA · PalmPay + more",
      descColor: "rgba(255,255,255,0.28)",
    },
  ];

  return (
    <ModalShell onClose={onClose} title="Choose Transfer Type">
      <div style={{ padding: "16px 18px 32px", display: "flex", flexDirection: "column", gap: 10 }}>

        {OPTIONS.map(opt => (
          <button
            key={opt.id}
            onClick={() => onSelect(opt.id)}
            onMouseEnter={() => setHovered(opt.id)}
            onMouseLeave={() => setHovered(null)}
            style={{
              width: "100%",
              background: hovered === opt.id ? opt.bgActive : "rgba(255,255,255,0.025)",
              border: `1px solid ${hovered === opt.id ? opt.borderActive : "rgba(255,255,255,0.07)"}`,
              borderRadius: 14, padding: "14px 15px",
              cursor: "pointer", textAlign: "left",
              transition: "all .18s",
              display: "flex", alignItems: "center", gap: 13,
            }}
          >
            {/* Icon */}
            <div style={{
              width: 44, height: 44, borderRadius: 12, flexShrink: 0,
              background: opt.iconBg, display: "flex",
              alignItems: "center", justifyContent: "center",
              boxShadow: "0 4px 14px rgba(0,0,0,0.3)",
            }}>
              <opt.icon size={20} color={opt.iconColor} />
            </div>

            {/* Text */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
                <span style={{
                  fontFamily: "var(--font-d)", fontSize: 14, fontWeight: 700,
                  color: "var(--text)",
                }}>{opt.title}</span>
                <span style={{
                  padding: "2px 7px", borderRadius: 20,
                  background: opt.badgeBg, border: `1px solid ${opt.badgeBorder}`,
                  fontSize: 9, fontWeight: 700, color: opt.badgeColor,
                  fontFamily: "var(--font-b)", letterSpacing: "0.05em",
                  flexShrink: 0,
                }}>{opt.badge}</span>
              </div>
              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", fontFamily: "var(--font-b)", marginBottom: 4 }}>
                {opt.subtitle}
              </div>
              <div style={{ fontSize: 10.5, color: opt.descColor, fontFamily: "var(--font-b)" }}>
                {opt.description}
              </div>
            </div>

            {/* Arrow */}
            <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth={2.5}>
              <polyline points="9 18 15 12 9 6"/>
            </svg>
          </button>
        ))}

        <div style={{
          marginTop: 4, padding: "10px 12px", borderRadius: 10,
          background: "rgba(163,230,53,0.04)", border: "1px dashed rgba(163,230,53,0.12)",
          fontSize: 11, color: "rgba(255,255,255,0.22)", fontFamily: "var(--font-b)", lineHeight: 1.65,
        }}>
          <span style={{ color: "rgba(163,230,53,0.45)" }}>⚡ Pro tip:</span> PayWave transfers are instant and completely free between Xeevia users. Use OPay to reach any Nigerian bank account.
        </div>
      </div>
    </ModalShell>
  );
}

// ── Success Modal ────────────────────────────────────────────
export function SuccessModal({ message, onClose }) {
  const lines = (message || "").split("\n");
  const title = lines[0] || "Success!";
  const details = lines.slice(1);

  return (
    <>
      <Backdrop onClick={onClose} />
      <div style={{
        position: "fixed", top: "50%", left: "50%",
        transform: "translate(-50%, -50%)",
        zIndex: 999, width: "90%", maxWidth: 320,
        background: "#0c0f0a",
        borderRadius: 20,
        border: "1px solid rgba(163,230,53,0.2)",
        boxShadow: "0 20px 60px rgba(0,0,0,0.7), 0 0 0 1px rgba(163,230,53,0.04)",
        padding: "28px 24px",
        textAlign: "center",
      }}>
        {/* Checkmark */}
        <div style={{
          width: 60, height: 60, borderRadius: "50%",
          background: "rgba(163,230,53,0.1)",
          border: "1px solid rgba(163,230,53,0.25)",
          display: "flex", alignItems: "center", justifyContent: "center",
          margin: "0 auto 16px",
          boxShadow: "0 0 30px rgba(163,230,53,0.12)",
        }}>
          <CheckCircle2 size={28} color="var(--lime)" />
        </div>

        <div style={{ fontFamily: "var(--font-d)", fontSize: 17, fontWeight: 800, color: "var(--text)", marginBottom: 8 }}>
          {title}
        </div>

        {details.length > 0 && (
          <div style={{ marginBottom: 20 }}>
            {details.map((line, i) => (
              <div key={i} style={{ fontSize: 12.5, color: "rgba(255,255,255,0.4)", fontFamily: "var(--font-b)", lineHeight: 1.7 }}>
                {line}
              </div>
            ))}
          </div>
        )}

        <button
          onClick={onClose}
          className="btn-lime full"
          style={{ marginTop: details.length ? 0 : 8 }}
        >
          Done
        </button>
      </div>
    </>
  );
}