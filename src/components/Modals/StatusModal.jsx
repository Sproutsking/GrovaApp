// src/components/Modals/StatusModal.jsx
// ============================================================================
// IMPROVEMENTS:
//  - Auto-dismiss after 3s (success) or 5s (error)
//  - Click-to-dismiss
//  - Toast-style positioning (bottom of screen) — less intrusive
//  - Smooth slide-up animation
//  - Accessible: role="alert"
// ============================================================================
import React, { useEffect, useRef } from "react";
import { CheckCircle, XCircle, AlertTriangle, Info } from "lucide-react";

const TYPE_CONFIG = {
  success: { icon: CheckCircle, color: "#22c55e", bg: "rgba(34,197,94,0.1)",   border: "rgba(34,197,94,0.3)",  label: "Success" },
  error:   { icon: XCircle,     color: "#ef4444", bg: "rgba(239,68,68,0.1)",   border: "rgba(239,68,68,0.3)",  label: "Error"   },
  warning: { icon: AlertTriangle,color: "#f59e0b", bg: "rgba(245,158,11,0.1)", border: "rgba(245,158,11,0.3)", label: "Warning" },
  info:    { icon: Info,         color: "#60a5fa", bg: "rgba(96,165,250,0.1)",  border: "rgba(96,165,250,0.3)", label: "Info"    },
};

const StatusModal = ({ show, type = "success", message, onClose }) => {
  const timerRef = useRef(null);

  useEffect(() => {
    if (!show) return;
    clearTimeout(timerRef.current);
    const delay = type === "error" ? 5000 : 3000;
    timerRef.current = setTimeout(onClose, delay);
    return () => clearTimeout(timerRef.current);
  }, [show, type, onClose]);

  if (!show) return null;

  const cfg  = TYPE_CONFIG[type] || TYPE_CONFIG.success;
  const Icon = cfg.icon;

  return (
    <>
      <style>{`
        @keyframes smSlideUp {
          from { opacity:0; transform:translateY(16px) scale(.97); }
          to   { opacity:1; transform:translateY(0) scale(1); }
        }
        @keyframes smProgress {
          from { width:100%; }
          to   { width:0%; }
        }
      `}</style>
      <div
        role="alert"
        aria-live="polite"
        onClick={onClose}
        style={{
          position:       "fixed",
          bottom:         24,
          left:           "50%",
          transform:      "translateX(-50%)",
          zIndex:         10100,
          maxWidth:       380,
          width:          "calc(100vw - 32px)",
          animation:      "smSlideUp .28s cubic-bezier(.16,1,.3,1)",
          cursor:         "pointer",
        }}
      >
        <div style={{
          background:    "#141414",
          border:        `1px solid ${cfg.border}`,
          borderRadius:  16,
          padding:       "14px 16px",
          display:       "flex",
          alignItems:    "flex-start",
          gap:           12,
          boxShadow:     `0 16px 48px rgba(0,0,0,.7), 0 0 0 1px ${cfg.border}`,
          overflow:      "hidden",
          position:      "relative",
        }}>
          {/* Progress bar */}
          <div style={{
            position:   "absolute",
            bottom:     0,
            left:       0,
            height:     2,
            background: cfg.color,
            animation:  `smProgress ${type === "error" ? 5 : 3}s linear forwards`,
            borderRadius: "0 0 16px 16px",
          }} />

          <div style={{
            width:          36,
            height:         36,
            borderRadius:   10,
            background:     cfg.bg,
            border:         `1px solid ${cfg.border}`,
            display:        "flex",
            alignItems:     "center",
            justifyContent: "center",
            flexShrink:     0,
          }}>
            <Icon size={18} color={cfg.color} />
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12.5, fontWeight: 800, color: cfg.color, marginBottom: 3 }}>
              {cfg.label}
            </div>
            <div style={{ fontSize: 13, color: "#a3a3a3", lineHeight: 1.5 }}>
              {message}
            </div>
          </div>

          <button
            onClick={(e) => { e.stopPropagation(); onClose(); }}
            style={{ background: "none", border: "none", color: "#555", cursor: "pointer", padding: 0, flexShrink: 0, marginTop: 2, fontSize: 18, lineHeight: 1 }}
          >
            ×
          </button>
        </div>
      </div>
    </>
  );
};

export default StatusModal;