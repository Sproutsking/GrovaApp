// paywave/modals/index.jsx  ── v3 REFINED EDITION
// Pure UI redesign. No backend changes. Tight, elegant modals.
import React, { useState } from "react";
import { X, Zap, Building2, CheckCircle2 } from "lucide-react";

// ── Backdrop ─────────────────────────────────────────────────
function Backdrop({ onClick }) {
  return (
    <div onClick={onClick} style={{
      position: "fixed", inset: 0, zIndex: 998,
      background: "rgba(0,0,0,0.74)",
      backdropFilter: "blur(5px)",
      WebkitBackdropFilter: "blur(5px)",
    }} />
  );
}

// ── Bottom sheet shell ────────────────────────────────────────
function BottomSheet({ children, onClose, title, maxWidth = 340, accentColor }) {
  return (
    <>
      <Backdrop onClick={onClose} />
      <div style={{
        position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)",
        zIndex: 999, width: "100%", maxWidth,
        background: "#0b0e0c",
        borderRadius: "18px 18px 0 0",
        border: `1px solid ${accentColor ? `${accentColor}22` : "rgba(255,255,255,0.08)"}`,
        borderBottom: "none",
        boxShadow: "0 -16px 50px rgba(0,0,0,0.65)",
        overflow: "hidden",
      }}>
        {/* Handle */}
        <div style={{ display: "flex", justifyContent: "center", padding: "10px 0 0" }}>
          <div style={{ width: 30, height: 3, borderRadius: 2, background: "rgba(255,255,255,0.1)" }} />
        </div>
        {/* Header */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "8px 16px 0",
        }}>
          <span style={{
            fontFamily: "var(--fd)", fontSize: 14, fontWeight: 700,
            color: "var(--t1)",
          }}>{title}</span>
          <button onClick={onClose} style={{
            background: "rgba(255,255,255,0.05)",
            border: "1px solid rgba(255,255,255,0.07)",
            borderRadius: 7, width: 25, height: 25,
            display: "flex", alignItems: "center", justifyContent: "center",
            cursor: "pointer", color: "rgba(255,255,255,0.4)",
          }}>
            <X size={11} />
          </button>
        </div>
        {children}
      </div>
    </>
  );
}

// ── PIN Modal ─────────────────────────────────────────────────
export function PinModal({ onClose, onVerify }) {
  const [pin,   setPin]   = useState("");

  const handleKey = (k) => {
    if (k === "del") { setPin(p => p.slice(0, -1)); return; }
    if (pin.length >= 4) return;
    const next = pin + k;
    setPin(next);
    if (next.length === 4) {
      setTimeout(() => { onVerify(next); setPin(""); }, 160);
    }
  };

  const KEYS = [
    ["1","2","3"],
    ["4","5","6"],
    ["7","8","9"],
    ["","0","del"],
  ];

  return (
    <BottomSheet onClose={onClose} title="Enter PIN">
      <div style={{ padding: "16px 20px 28px" }}>
        {/* Dots */}
        <div style={{ display: "flex", justifyContent: "center", gap: 13, margin: "12px 0 20px" }}>
          {[0, 1, 2, 3].map(i => (
            <div key={i} style={{
              width: 12, height: 12, borderRadius: "50%",
              background: i < pin.length ? "var(--lime)" : "rgba(255,255,255,0.09)",
              border: i < pin.length ? "none" : "1px solid rgba(255,255,255,0.15)",
              transition: "background .14s, transform .1s",
              transform: i < pin.length ? "scale(1.18)" : "scale(1)",
              boxShadow: i < pin.length ? "0 0 8px rgba(163,230,53,0.38)" : "none",
            }} />
          ))}
        </div>

        {/* Keypad */}
        {KEYS.map((row, ri) => (
          <div key={ri} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 7, marginBottom: 7 }}>
            {row.map((k, ki) => (
              <button key={ki} onClick={() => k && handleKey(k)} style={{
                height: 48, borderRadius: 11,
                background: k === "" ? "transparent" : k === "del" ? "rgba(248,113,113,0.07)" : "rgba(255,255,255,0.035)",
                border: k === "" ? "none" : k === "del" ? "1px solid rgba(248,113,113,0.13)" : "1px solid rgba(255,255,255,0.065)",
                color: k === "del" ? "#f87171" : "var(--t1)",
                fontFamily: "var(--fd)", fontSize: 17, fontWeight: 700,
                cursor: k ? "pointer" : "default",
                transition: "background .11s, transform .09s",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}
              onMouseDown={e => k && (e.currentTarget.style.transform = "scale(0.92)")}
              onMouseUp={e => k && (e.currentTarget.style.transform = "scale(1)")}
              >
                {k === "del" ? (
                  <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                    <path d="M21 4H8l-7 8 7 8h13a2 2 0 002-2V6a2 2 0 00-2-2z"/>
                    <line x1="18" y1="9" x2="14" y2="15"/>
                    <line x1="14" y1="9" x2="18" y2="15"/>
                  </svg>
                ) : k}
              </button>
            ))}
          </div>
        ))}

        <div style={{ textAlign: "center", marginTop: 10, color: "rgba(255,255,255,0.2)", fontSize: 10.5, fontFamily: "var(--fb)" }}>
          Demo PIN: <span style={{ color: "var(--lime)", fontFamily: "var(--fm)" }}>1234</span>
        </div>
      </div>
    </BottomSheet>
  );
}

// ── Send Type Modal ───────────────────────────────────────────
export function SendTypeModal({ onClose, onSelect }) {
  const [hovered, setHovered] = useState(null);

  const OPTIONS = [
    {
      id:          "paywave",
      icon:        Zap,
      iconBg:      "linear-gradient(135deg,#a3e635,#65a30d)",
      iconColor:   "#060e02",
      title:       "PayWave Transfer",
      subtitle:    "Send to any Xeevia user",
      badge:       "FREE",
      badgeColor:  "#a3e635",
      badgeBg:     "rgba(163,230,53,0.09)",
      badgeBorder: "rgba(163,230,53,0.22)",
      borderActive:"rgba(163,230,53,0.28)",
      bgActive:    "rgba(163,230,53,0.045)",
      desc:        "Instant · Zero fees · No account number needed",
      descColor:   "rgba(163,230,53,0.5)",
    },
    {
      id:          "opay",
      icon:        Building2,
      iconBg:      "linear-gradient(135deg,#10b981,#059669)",
      iconColor:   "#fff",
      title:       "OPay Transfer",
      subtitle:    "Send to any Nigerian bank",
      badge:       "FEE APPLIES",
      badgeColor:  "#f59e0b",
      badgeBg:     "rgba(245,158,11,0.07)",
      badgeBorder: "rgba(245,158,11,0.18)",
      borderActive:"rgba(16,185,129,0.25)",
      bgActive:    "rgba(16,185,129,0.035)",
      desc:        "GTBank · Access · Zenith · UBA · PalmPay + more",
      descColor:   "rgba(255,255,255,0.26)",
    },
  ];

  return (
    <BottomSheet onClose={onClose} title="Choose Transfer Type">
      <div style={{ padding: "14px 16px 28px", display: "flex", flexDirection: "column", gap: 8 }}>
        {OPTIONS.map(opt => (
          <button key={opt.id}
            onClick={() => onSelect(opt.id)}
            onMouseEnter={() => setHovered(opt.id)}
            onMouseLeave={() => setHovered(null)}
            style={{
              width: "100%",
              background: hovered === opt.id ? opt.bgActive : "rgba(255,255,255,0.02)",
              border: `1px solid ${hovered === opt.id ? opt.borderActive : "rgba(255,255,255,0.065)"}`,
              borderRadius: 13, padding: "12px 13px",
              cursor: "pointer", textAlign: "left",
              transition: "all .16s",
              display: "flex", alignItems: "center", gap: 11,
            }}>
            {/* Icon */}
            <div style={{
              width: 40, height: 40, borderRadius: 11, flexShrink: 0,
              background: opt.iconBg,
              display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: "0 3px 12px rgba(0,0,0,0.28)",
            }}>
              <opt.icon size={18} color={opt.iconColor} />
            </div>
            {/* Text */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 2 }}>
                <span style={{ fontFamily: "var(--fd)", fontSize: 13.5, fontWeight: 700, color: "var(--t1)" }}>
                  {opt.title}
                </span>
                <span style={{
                  padding: "1.5px 6px", borderRadius: 20,
                  background: opt.badgeBg, border: `1px solid ${opt.badgeBorder}`,
                  fontSize: "8.5px", fontWeight: 700, color: opt.badgeColor,
                  fontFamily: "var(--fb)", letterSpacing: "0.04em", flexShrink: 0,
                }}>{opt.badge}</span>
              </div>
              <div style={{ fontSize: 11.5, color: "rgba(255,255,255,0.38)", fontFamily: "var(--fb)", marginBottom: 3 }}>
                {opt.subtitle}
              </div>
              <div style={{ fontSize: 10.5, color: opt.descColor, fontFamily: "var(--fb)" }}>
                {opt.desc}
              </div>
            </div>
            {/* Arrow */}
            <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth={2.5}>
              <polyline points="9 18 15 12 9 6"/>
            </svg>
          </button>
        ))}

        <div style={{
          marginTop: 2, padding: "9px 11px", borderRadius: 9,
          background: "rgba(163,230,53,0.035)", border: "1px dashed rgba(163,230,53,0.1)",
          fontSize: 10.5, color: "rgba(255,255,255,0.2)", fontFamily: "var(--fb)", lineHeight: 1.65,
        }}>
          <span style={{ color: "rgba(163,230,53,0.4)" }}>⚡ Pro tip:</span>{" "}
          PayWave transfers are instant and completely free between Xeevia users.
        </div>
      </div>
    </BottomSheet>
  );
}

// ── Success Modal ─────────────────────────────────────────────
export function SuccessModal({ message, onClose }) {
  const lines   = (message || "").split("\n");
  const title   = lines[0] || "Success!";
  const details = lines.slice(1);

  return (
    <>
      <Backdrop onClick={onClose} />
      <div style={{
        position: "fixed", top: "50%", left: "50%",
        transform: "translate(-50%,-50%)",
        zIndex: 999, width: "90%", maxWidth: 300,
        background: "#0b0e0c",
        borderRadius: 18,
        border: "1px solid rgba(163,230,53,0.18)",
        boxShadow: "0 18px 55px rgba(0,0,0,0.7), 0 0 0 1px rgba(163,230,53,0.04)",
        padding: "24px 20px",
        textAlign: "center",
      }}>
        {/* Check */}
        <div style={{
          width: 52, height: 52, borderRadius: "50%",
          background: "rgba(163,230,53,0.09)",
          border: "1px solid rgba(163,230,53,0.22)",
          display: "flex", alignItems: "center", justifyContent: "center",
          margin: "0 auto 14px",
          boxShadow: "0 0 24px rgba(163,230,53,0.1)",
        }}>
          <CheckCircle2 size={24} color="var(--lime)" />
        </div>

        <div style={{
          fontFamily: "var(--fd)", fontSize: 16, fontWeight: 800,
          color: "var(--t1)", marginBottom: 7,
        }}>{title}</div>

        {details.length > 0 && (
          <div style={{ marginBottom: 18 }}>
            {details.map((line, i) => (
              <div key={i} style={{ fontSize: 12, color: "rgba(255,255,255,0.38)", fontFamily: "var(--fb)", lineHeight: 1.7 }}>
                {line}
              </div>
            ))}
          </div>
        )}

        <button className="btn-p full" onClick={onClose} style={{ marginTop: details.length ? 0 : 6 }}>
          Done
        </button>
      </div>
    </>
  );
}