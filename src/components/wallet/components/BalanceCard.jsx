// src/components/wallet/components/BalanceCard.jsx
// Compact: card ~100px + stats strip ~46px = ~146px total. Currency-aware.
// Tap the fiat value to open currency picker.

import React, { useRef, useEffect, useState } from "react";
import { Eye, EyeOff, Zap } from "lucide-react";

/* count-up animation */
function useCountUp(target, ms = 900) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (!target) return;
    const t0 = performance.now();
    let r;
    const tick = (now) => {
      const p = Math.min((now - t0) / ms, 1);
      setVal(Math.floor((1 - Math.pow(1 - p, 3)) * target));
      if (p < 1) r = requestAnimationFrame(tick);
      else setVal(target);
    };
    r = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(r);
  }, [target, ms]);
  return val;
}

export default function BalanceCard({ balance, loading, hideBalance, onToggleHide, username = "you" }) {
  const cardRef  = useRef(null);
  const sheenRef = useRef(null);
  const [mounted, setMounted] = useState(false);
  const ep = Math.floor(balance?.points ?? 0);
  const displayEp = useCountUp(mounted && !loading ? ep : 0, 900);

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 150);
    return () => clearTimeout(t);
  }, []);

  /* subtle 3D tilt */
  useEffect(() => {
    const card  = cardRef.current;
    const sheen = sheenRef.current;
    if (!card) return;
    const move = (e) => {
      const r  = card.getBoundingClientRect();
      const dx = (e.clientX - (r.left + r.width  / 2)) / (r.width  / 2);
      const dy = (e.clientY - (r.top  + r.height / 2)) / (r.height / 2);
      card.style.transition = "transform 0.07s linear";
      card.style.transform  = `perspective(700px) rotateY(${dx * 6}deg) rotateX(${-dy * 4}deg) scale(1.008)`;
      if (sheen) {
        const mx = ((e.clientX - r.left) / r.width  * 100).toFixed(1);
        const my = ((e.clientY - r.top)  / r.height * 100).toFixed(1);
        sheen.style.background = `radial-gradient(circle at ${mx}% ${my}%, rgba(255,255,255,0.07) 0%, transparent 55%)`;
      }
    };
    const leave = () => {
      card.style.transition = "transform 0.5s cubic-bezier(0.34,1.56,0.64,1)";
      card.style.transform  = "perspective(700px) rotateY(0deg) rotateX(0deg) scale(1)";
      if (sheen) sheen.style.background = "";
    };
    card.addEventListener("mousemove", move);
    card.addEventListener("mouseleave", leave);
    return () => {
      card.removeEventListener("mousemove", move);
      card.removeEventListener("mouseleave", leave);
    };
  }, []);

  const epDisplay = displayEp >= 1000 ? `${(displayEp / 1000).toFixed(1)}K` : displayEp.toLocaleString("en");

  return (
    <>
      <style>{`
        @keyframes holoShift {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
        @keyframes scanSlide {
          0%   { top: -30%; }
          100% { top: 130%; }
        }
        @keyframes livePulse {
          0%,100% { opacity:1; transform:scale(1); }
          50%     { opacity:0.35; transform:scale(0.65); }
        }
        @keyframes cardIn {
          from { opacity:0; transform:translateY(12px); }
          to   { opacity:1; transform:translateY(0); }
        }
        @keyframes skelShim {
          0%   { background-position:200% 0; }
          100% { background-position:-200% 0; }
        }
        .fiat-btn {
          background: none;
          border: none;
          padding: 2px 5px;
          border-radius: 4px;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          gap: 3px;
          transition: background 0.14s;
          margin: -2px -5px;
        }
        .fiat-btn:hover { background: rgba(132,204,22,0.09); }
        .fiat-btn:active { background: rgba(132,204,22,0.16); }
      `}</style>

      {/* ────── CARD ────── */}
      <div
        ref={cardRef}
        style={{
          margin: "20px 18px 0",
          borderRadius: 15,
          position: "relative",
          isolation: "isolate",
          overflow: "hidden",
          animation: "cardIn 0.4s cubic-bezier(0.34,1.56,0.64,1) both",
        }}
      >
        {/* dark base */}
        <div style={{
          position: "absolute", inset: 0, borderRadius: 15,
          background: "linear-gradient(135deg, #111 0%, #0b0b0b 45%, #0d0e00 78%, #090a00 100%)",
          border: "1px solid rgba(132,204,22,0.15)",
        }} />

        {/* ambient glows */}
        <div style={{ position:"absolute", top:"-70%", left:"-20%", width:"65%", height:"160%",
          background:"radial-gradient(ellipse, rgba(132,204,22,0.15) 0%, transparent 65%)", pointerEvents:"none" }} />
        <div style={{ position:"absolute", bottom:"-60%", right:"-8%", width:"50%", height:"140%",
          background:"radial-gradient(ellipse, rgba(201,162,39,0.12) 0%, transparent 60%)", pointerEvents:"none" }} />

        {/* grid lines */}
        <svg style={{ position:"absolute", inset:0, width:"100%", height:"100%", borderRadius:15, pointerEvents:"none", opacity:0.75 }}>
          <defs>
            <pattern id="cg" width="34" height="34" patternUnits="userSpaceOnUse">
              <path d="M 34 0 L 0 0 0 34" fill="none" stroke="rgba(132,204,22,0.038)" strokeWidth="1"/>
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#cg)" />
        </svg>

        {/* scan sweep */}
        <div style={{
          position:"absolute", left:0, right:0, height:"32%",
          background:"linear-gradient(180deg,transparent,rgba(132,204,22,0.028),transparent)",
          animation:"scanSlide 5.5s ease-in-out infinite", pointerEvents:"none",
        }} />

        {/* mouse sheen */}
        <div ref={sheenRef} style={{ position:"absolute", inset:0, borderRadius:15, pointerEvents:"none" }} />

        {/* top + left edges */}
        <div style={{ position:"absolute", top:0, left:"7%", right:"7%", height:1,
          background:"linear-gradient(90deg,transparent,rgba(255,255,255,0.16),transparent)", pointerEvents:"none" }} />
        <div style={{ position:"absolute", left:0, top:"8%", bottom:"8%", width:1,
          background:"linear-gradient(180deg,rgba(132,204,22,0.48),rgba(132,204,22,0.07),transparent)", pointerEvents:"none" }} />

        {/* holographic bottom strip */}
        <div style={{
          position:"absolute", bottom:0, left:0, right:0, height:2, borderRadius:"0 0 15px 15px",
          background:"linear-gradient(90deg,transparent,rgba(132,204,22,0.55) 16%,rgba(201,162,39,0.5) 36%,rgba(132,204,22,0.28) 54%,rgba(201,162,39,0.65) 74%,rgba(132,204,22,0.42) 92%,transparent)",
          backgroundSize:"200% 100%",
          animation:"holoShift 3s linear infinite",
        }} />

        {/* ── CONTENT ROW ── */}
        <div style={{
          position: "relative", zIndex: 2,
          display: "flex",
          alignItems: "center",
          padding: "15px 17px",
          gap: 14,
        }}>

          {/* LEFT — EP mark + live */}
          <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:5, flexShrink:0 }}>
            <div style={{
              width: 32, height: 32, borderRadius: 8,
              background: "linear-gradient(135deg,rgba(132,204,22,0.18),rgba(132,204,22,0.05))",
              border: "1px solid rgba(132,204,22,0.26)",
              display: "flex", alignItems: "center", justifyContent: "center",
              color: "#a3e635",
            }}><Zap size={17} /></div>
            <div style={{ display:"flex", alignItems:"center", gap:3 }}>
              <div style={{ width:4, height:4, borderRadius:"50%", background:"#84cc16", animation:"livePulse 1.8s ease-in-out infinite" }} />
              <span style={{ fontFamily:"JetBrains Mono,monospace", fontSize:7, color:"rgba(132,204,22,0.45)", letterSpacing:"0.14em" }}>LIVE</span>
            </div>
          </div>

          {/* CENTER — balance */}
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ fontFamily:"JetBrains Mono,monospace", fontSize:8, letterSpacing:"0.26em", color:"rgba(132,204,22,0.45)", textTransform:"uppercase", marginBottom:4 }}>
              Engagement Points
            </div>

            {/* number + ticker */}
            <div style={{ display:"flex", alignItems:"flex-end", gap:7, marginBottom:5 }}>
              {loading ? (
                <div style={{ height:36, width:130, borderRadius:5, background:"linear-gradient(90deg,#1a1a1a 25%,#222 50%,#1a1a1a 75%)", backgroundSize:"200% 100%", animation:"skelShim 1.4s infinite" }} />
              ) : (
                <span style={{ fontFamily:"Bebas Neue,sans-serif", fontSize:38, lineHeight:1, color:"#fff", letterSpacing:"0.01em", textShadow:"0 0 28px rgba(132,204,22,0.16)" }}>
                  {hideBalance ? "••••••" : epDisplay}
                </span>
              )}
              <span style={{
                fontFamily:"JetBrains Mono,monospace", fontSize:9,
                color:"rgba(163,230,53,0.9)", letterSpacing:"0.1em",
                padding:"3px 7px", borderRadius:4,
                border:"1px solid rgba(163,230,53,0.22)",
                background:"rgba(163,230,53,0.06)",
                marginBottom:5, flexShrink:0,
              }}>EP</span>
            </div>
            <span style={{ fontFamily:"JetBrains Mono,monospace",fontSize:9,color:"rgba(255,255,255,.27)" }}>Internal Xeevia balance</span>
          </div>

          {/* RIGHT — visibility control */}
          <div style={{ display:"flex",alignItems:"center",flexShrink:0 }}>
            <button
              onClick={onToggleHide}
              style={{
                background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.06)",
                borderRadius:5, color:"rgba(255,255,255,0.25)", cursor:"pointer",
                width:22, height:22, display:"flex", alignItems:"center", justifyContent:"center",
                transition:"all 0.13s", flexShrink:0,
              }}
              onMouseEnter={e => e.currentTarget.style.color = "rgba(255,255,255,0.55)"}
              onMouseLeave={e => e.currentTarget.style.color = "rgba(255,255,255,0.25)"}
            >
              {hideBalance ? <EyeOff size={11} /> : <Eye size={11} />}
            </button>
          </div>

        </div>
      </div>

      {/* ── EP context strip ── */}
      <div style={{
        margin: "8px 18px 0",
        display: "grid",
        gridTemplateColumns: "1fr 1px 1fr 1px 1fr",
        background: "#0c0c0c",
        border: "1px solid rgba(255,255,255,0.05)",
        borderRadius: 10,
        padding: "8px 0",
        overflow: "hidden",
        animation: "cardIn 0.4s 0.09s cubic-bezier(0.34,1.56,0.64,1) both",
      }}>
        <StatCol label="EP Balance" value={loading || hideBalance ? "—" : epDisplay} color="#a3e635" sub="Earned points" />
        <div style={{ background:"rgba(255,255,255,0.05)", margin:"2px 0" }} />
        <StatCol label="Transfer" value="Internal" color="#a3e635" sub="@username" />
        <div style={{ background:"rgba(255,255,255,0.05)", margin:"2px 0" }} />
        <StatCol label="Unit" value="EP" color="#fff" sub="Xeevia" />
      </div>
    </>
  );
}

function StatCol({ label, value, color, sub }) {
  return (
    <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:2, padding:"0 4px" }}>
      <span style={{ fontFamily:"JetBrains Mono,monospace", fontSize:7, letterSpacing:"0.17em", textTransform:"uppercase", color:"rgba(255,255,255,0.18)" }}>{label}</span>
      <span style={{ fontFamily:"Bebas Neue,sans-serif",   fontSize:17, lineHeight:1, letterSpacing:"0.04em", color }}>{value}</span>
      <span style={{ fontFamily:"JetBrains Mono,monospace", fontSize:7, color:"rgba(255,255,255,0.17)" }}>{sub}</span>
    </div>
  );
}