// src/components/wallet/components/CurrencyPicker.jsx
// Renders an elegant bottom-sheet style picker.
// Usage: <CurrencyPicker open={open} onClose={() => setOpen(false)} />

import React, { useEffect, useRef } from "react";
import { X, Check } from "lucide-react";
import { useCurrency, CURRENCIES } from "../../../contexts/CurrencyContext";

export default function CurrencyPicker({ open, onClose }) {
  const { currency, setCurrency } = useCurrency();
  const ref = useRef(null);

  // close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) onClose();
    };
    setTimeout(() => document.addEventListener("mousedown", handler), 0);
    return () => document.removeEventListener("mousedown", handler);
  }, [open, onClose]);

  // close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open) return null;

  const handleSelect = (code) => {
    setCurrency(code);
    onClose();
  };

  return (
    <>
      {/* backdrop */}
      <div style={{
        position: "fixed", inset: 0,
        background: "rgba(0,0,0,0.72)",
        zIndex: 9998,
        backdropFilter: "blur(4px)",
        animation: "fadeIn 0.18s ease",
      }} />

      {/* sheet */}
      <div
        ref={ref}
        style={{
          position: "fixed",
          bottom: 0, left: "50%",
          transform: "translateX(-50%)",
          width: "100%",
          maxWidth: 520,
          background: "#0f0f0f",
          borderRadius: "20px 20px 0 0",
          border: "1px solid rgba(255,255,255,0.08)",
          borderBottom: "none",
          zIndex: 9999,
          animation: "sheetUp 0.28s cubic-bezier(0.34,1.56,0.64,1)",
          overflow: "hidden",
        }}
      >
        {/* handle */}
        <div style={{
          width: 36, height: 4,
          borderRadius: 2,
          background: "rgba(255,255,255,0.1)",
          margin: "12px auto 0",
        }} />

        {/* header */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "14px 20px 12px",
        }}>
          <div>
            <div style={{ fontFamily:"Rajdhani,sans-serif", fontSize:16, fontWeight:700, color:"#fff" }}>
              Display Currency
            </div>
            <div style={{ fontFamily:"JetBrains Mono,monospace", fontSize:9, color:"rgba(255,255,255,0.3)", letterSpacing:"0.18em", marginTop:2 }}>
              FIAT EQUIVALENT
            </div>
          </div>
          <button onClick={onClose} style={{
            width:30, height:30, borderRadius:8,
            background:"rgba(255,255,255,0.05)",
            border:"1px solid rgba(255,255,255,0.07)",
            color:"rgba(255,255,255,0.4)",
            display:"flex", alignItems:"center", justifyContent:"center",
            cursor:"pointer",
          }}>
            <X size={14} />
          </button>
        </div>

        {/* thin lime line */}
        <div style={{
          height:1,
          background:"linear-gradient(90deg, rgba(132,204,22,0.4) 0%, rgba(132,204,22,0.05) 60%, transparent 100%)",
          marginBottom:6,
        }} />

        {/* list */}
        <div style={{
          maxHeight: 320,
          overflowY: "auto",
          padding: "6px 10px 24px",
        }}>
          {CURRENCIES.map((c) => {
            const active = c.code === currency;
            return (
              <button
                key={c.code}
                onClick={() => handleSelect(c.code)}
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "11px 12px",
                  borderRadius: 10,
                  border: active
                    ? "1px solid rgba(132,204,22,0.22)"
                    : "1px solid transparent",
                  background: active
                    ? "rgba(132,204,22,0.07)"
                    : "transparent",
                  cursor: "pointer",
                  transition: "all 0.13s",
                  marginBottom: 2,
                  textAlign: "left",
                }}
                onMouseEnter={e => {
                  if (!active) e.currentTarget.style.background = "rgba(255,255,255,0.04)";
                }}
                onMouseLeave={e => {
                  if (!active) e.currentTarget.style.background = "transparent";
                }}
              >
                <span style={{ fontSize: 20, flexShrink: 0 }}>{c.flag}</span>
                <div style={{ flex: 1 }}>
                  <div style={{
                    fontFamily: "Rajdhani,sans-serif",
                    fontSize: 14, fontWeight: 700,
                    color: active ? "#a3e635" : "rgba(255,255,255,0.85)",
                    marginBottom: 1,
                  }}>
                    {c.name}
                  </div>
                  <div style={{
                    fontFamily: "JetBrains Mono,monospace",
                    fontSize: 10,
                    color: "rgba(255,255,255,0.28)",
                    letterSpacing: "0.06em",
                  }}>
                    {c.symbol} · {c.code}
                  </div>
                </div>
                {active && <Check size={14} color="#84cc16" />}
              </button>
            );
          })}
        </div>
      </div>

      <style>{`
        @keyframes fadeIn  { from { opacity:0; } to { opacity:1; } }
        @keyframes sheetUp { from { transform:translateX(-50%) translateY(100%); } to { transform:translateX(-50%) translateY(0); } }
      `}</style>
    </>
  );
}