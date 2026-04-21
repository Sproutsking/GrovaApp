// src/components/Modals/ConfirmModal.jsx
// ============================================================================
// IMPROVEMENTS:
//  - Backdrop blur
//  - dangerous=true shows red confirm button
//  - confirmText prop
//  - Keyboard: Enter = confirm, Escape = cancel
//  - Focus trap on confirm button
// ============================================================================
import React, { useEffect, useRef } from "react";
import { AlertTriangle, CheckCircle } from "lucide-react";

const ConfirmModal = ({
  show,
  title,
  message,
  onConfirm,
  onCancel,
  confirmText = "Confirm",
  cancelText  = "Cancel",
  dangerous   = false,
}) => {
  const confirmRef = useRef(null);

  useEffect(() => {
    if (!show) return;
    // Auto-focus confirm button
    setTimeout(() => confirmRef.current?.focus(), 50);

    const onKey = (e) => {
      if (e.key === "Escape") onCancel();
      if (e.key === "Enter")  onConfirm();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [show, onConfirm, onCancel]);

  if (!show) return null;

  const accentColor  = dangerous ? "#ef4444" : "#84cc16";
  const confirmStyle = dangerous
    ? { background: "linear-gradient(135deg,#ef4444,#dc2626)", color: "#fff" }
    : { background: "linear-gradient(135deg,#84cc16,#65a30d)",  color: "#000" };

  return (
    <>
      <style>{`
        @keyframes cmFadeIn  { from{opacity:0} to{opacity:1} }
        @keyframes cmSlideUp { from{opacity:0;transform:translate(-50%,-50%) scale(.95) translateY(10px)} to{opacity:1;transform:translate(-50%,-50%) scale(1) translateY(0)} }
      `}</style>

      {/* Backdrop */}
      <div
        onClick={onCancel}
        style={{
          position:       "fixed",
          inset:          0,
          background:     "rgba(0,0,0,.82)",
          backdropFilter: "blur(8px)",
          zIndex:         10050,
          animation:      "cmFadeIn .18s ease",
        }}
      />

      {/* Dialog */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="cm-title"
        style={{
          position:     "fixed",
          top:          "50%",
          left:         "50%",
          transform:    "translate(-50%,-50%)",
          zIndex:       10051,
          background:   "#111",
          border:       `1px solid ${dangerous ? "rgba(239,68,68,.3)" : "rgba(132,204,22,.2)"}`,
          borderRadius: 20,
          padding:      "28px 24px",
          width:        "min(380px, calc(100vw - 32px))",
          boxShadow:    "0 24px 80px rgba(0,0,0,.95)",
          animation:    "cmSlideUp .25s cubic-bezier(.16,1,.3,1)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Icon */}
        <div style={{
          width:          44,
          height:         44,
          borderRadius:   "50%",
          background:     dangerous ? "rgba(239,68,68,.1)" : "rgba(132,204,22,.1)",
          border:         `1px solid ${dangerous ? "rgba(239,68,68,.25)" : "rgba(132,204,22,.25)"}`,
          display:        "flex",
          alignItems:     "center",
          justifyContent: "center",
          margin:         "0 auto 16px",
        }}>
          {dangerous
            ? <AlertTriangle size={20} color="#ef4444" />
            : <CheckCircle   size={20} color="#84cc16" />
          }
        </div>

        <h3
          id="cm-title"
          style={{ color: "#f5f5f5", fontSize: 16, fontWeight: 800, textAlign: "center", marginBottom: 10 }}
        >
          {title}
        </h3>
        <p style={{ color: "#737373", fontSize: 13.5, textAlign: "center", marginBottom: 24, lineHeight: 1.65 }}>
          {message}
        </p>

        <div style={{ display: "flex", gap: 10 }}>
          <button
            onClick={onCancel}
            style={{
              flex:         1,
              padding:      "12px",
              background:   "rgba(255,255,255,.05)",
              border:       "1px solid rgba(255,255,255,.1)",
              borderRadius: 11,
              color:        "#a3a3a3",
              fontSize:     14,
              fontWeight:   600,
              cursor:       "pointer",
              transition:   "all .15s",
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = "rgba(255,255,255,.09)"}
            onMouseLeave={(e) => e.currentTarget.style.background = "rgba(255,255,255,.05)"}
          >
            {cancelText}
          </button>
          <button
            ref={confirmRef}
            onClick={onConfirm}
            style={{
              flex:         1,
              padding:      "12px",
              border:       "none",
              borderRadius: 11,
              fontSize:     14,
              fontWeight:   700,
              cursor:       "pointer",
              transition:   "all .15s",
              boxShadow:    `0 4px 14px ${accentColor}28`,
              ...confirmStyle,
            }}
            onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-1px)"; e.currentTarget.style.boxShadow = `0 6px 20px ${accentColor}40`; }}
            onMouseLeave={(e) => { e.currentTarget.style.transform = "none"; e.currentTarget.style.boxShadow = `0 4px 14px ${accentColor}28`; }}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </>
  );
};

export default ConfirmModal;