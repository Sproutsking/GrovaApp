// src/components/GiftCards/GiftCardsView.jsx
// ═══════════════════════════════════════════════════════════════════
// XEEVIA GIFT CARDS — NEXT GENERATION  ✦
// ═══════════════════════════════════════════════════════════════════
// Tiers (ascending):
//   Silver · Gold · Blue Diamond · Red Diamond · Black Diamond ·
//   Purple Diamond · Lioness · Lion · Make A Wish
//
// Features:
//   • Cinematic tier-specific unwrap experience
//   • Song system: upload | library | request
//     - Compressed via Cloudflare Worker before R2 storage
//     - Retention: free 30d-DB/7d-open · silver 60d · gold 1yr · diamond ∞
//   • Real Supabase EP deduction & credit
//   • Perfect mobile (original feel) + PC 3-column layout
//   • 2% protocol fee on all transactions
// ═══════════════════════════════════════════════════════════════════

import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  X, Copy, CheckCircle, Zap, Search, Send, Gift, Crown, Gem,
  Flame, Star, Sparkles, RotateCcw, ArrowLeft, Package, Plus,
  ChevronRight, Shield, Info, AlertCircle, Music, Upload, Play,
  Pause, Trash2, Clock, Radio, Mic, Library,
} from "lucide-react";
import { supabase } from "../../services/config/supabase";
import ProfilePreview from "../Shared/ProfilePreview";

// ─────────────────────────────────────────────────────────────────
// Constants & Config
// ─────────────────────────────────────────────────────────────────
const FEE = 0.02;
const GCODE = () => {
  const s = () => Math.random().toString(36).slice(2, 6).toUpperCase();
  return `GC-${s()}-${s()}-XEEVIA`;
};

// Song retention by user's subscription_tier (days; null = unlimited)
const SONG_RETENTION = {
  free: { db: 30, open: 7,   label: "7 days after opening" },
  silver: { db: 60,  open: 60,  label: "60 days" },
  gold:   { db: 365, open: 365, label: "1 year" },
  diamond: { db: null, open: null, label: "Unlimited" },
  black_diamond: { db: null, open: null, label: "Unlimited" },
  purple_diamond:{ db: null, open: null, label: "Unlimited" },
  lion:    { db: null, open: null, label: "Unlimited" },
  lioness: { db: null, open: null, label: "Unlimited" },
};
const getSongRetention = (subTier) => SONG_RETENTION[subTier] || SONG_RETENTION.free;

// ─────────────────────────────────────────────────────────────────
// Tier Definitions
// ─────────────────────────────────────────────────────────────────
const TIERS = [
  {
    id:"silver", name:"Silver", value:100, price:1,
    c1:"#e2e8f0", c2:"#94a3b8", glow:"rgba(226,232,240,0.22)",
    Icon:Star, badge:"Starter", badgeColor:"#94a3b8",
    desc:"100 EP — A spark of appreciation.",
    emoji:"✨", burstStyle:"confetti",
    unlockLine:"A gentle shimmer of gratitude.",
    openingText:"Opening…",
  },
  {
    id:"gold", name:"Gold", value:500, price:5,
    c1:"#fbbf24", c2:"#d97706", glow:"rgba(251,191,36,0.32)",
    Icon:Crown, badge:"Popular", badgeColor:"#fbbf24",
    desc:"500 EP — A crown of gold for a king.",
    emoji:"👑", burstStyle:"golden",
    unlockLine:"Gold rains down like a royal decree.",
    openingText:"Crowning…",
  },
  {
    id:"blue_diamond", name:"Blue Diamond", value:1500, price:15,
    c1:"#38bdf8", c2:"#0284c7", glow:"rgba(56,189,248,0.28)",
    Icon:Gem, badge:"Best Value", badgeColor:"#38bdf8",
    desc:"1,500 EP + Blue Diamond badge for 7 days.",
    emoji:"💎", burstStyle:"diamond",
    unlockLine:"Crystal clarity shatters the ordinary.",
    openingText:"Crystallizing…",
  },
  {
    id:"red_diamond", name:"Red Diamond", value:3000, price:28,
    c1:"#f87171", c2:"#dc2626", glow:"rgba(248,113,113,0.32)",
    Icon:Flame, badge:"Fierce", badgeColor:"#f87171",
    desc:"3,000 EP + Red aura for 14 days.",
    emoji:"🔥", burstStyle:"fire",
    unlockLine:"Passion ignites. The rare burns brightest.",
    openingText:"Igniting…",
  },
  {
    id:"black_diamond", name:"Black Diamond", value:6000, price:55,
    c1:"#d4d4d8", c2:"#6b7280", glow:"rgba(212,212,216,0.24)",
    Icon:Sparkles, badge:"Rare", badgeColor:"#a1a1aa",
    desc:"6,000 EP + Black Diamond status for 30 days.",
    emoji:"🖤", burstStyle:"obsidian",
    unlockLine:"Rare. Absolute. Timeless.",
    openingText:"Emerging…",
  },
  {
    id:"purple_diamond", name:"Purple Diamond", value:12000, price:100,
    c1:"#c084fc", c2:"#7c3aed", glow:"rgba(192,132,252,0.35)",
    Icon:Gem, badge:"Legendary", badgeColor:"#c084fc",
    desc:"12,000 EP + Whale status for 60 days.",
    emoji:"💜", burstStyle:"cosmic",
    unlockLine:"Legend doesn't knock. It arrives.",
    openingText:"Ascending…",
  },
  {
    id:"lioness", name:"Lioness", value:30000, price:300,
    c1:"#fb923c", c2:"#92400e", glow:"rgba(251,146,60,0.38)",
    Icon:null, badge:"Best", badgeColor:"#fb923c",
    desc:"30,000 EP + Lioness crown aura for 90 days.",
    emoji:"🦁", burstStyle:"lioness",
    unlockLine:"She does not roar to be heard. She already is.",
    openingText:"She stirs…",
  },
  {
    id:"lion", name:"Lion", value:50000, price:500,
    c1:"#fcd34d", c2:"#b45309", glow:"rgba(252,211,77,0.42)",
    Icon:null, badge:"Best", badgeColor:"#fcd34d",
    desc:"50,000 EP + Lion King status for 180 days.",
    emoji:"👑🦁", burstStyle:"lion",
    unlockLine:"The king has entered. Everything bows.",
    openingText:"The lion rises…",
  },
  {
    id:"make_a_wish", name:"Make A Wish", value:100000, price:1000,
    c1:"#f0abfc", c2:"#6d28d9", glow:"rgba(240,171,252,0.48)",
    Icon:null, badge:"✦ Transcendent", badgeColor:"#f0abfc",
    desc:"100,000 EP + all badges + 365-day Cosmic status.",
    emoji:"🌠", burstStyle:"wish",
    unlockLine:"Close your eyes. Make a wish. It's already yours.",
    openingText:"Stars aligning…",
  },
];

const OCCASIONS = [
  "Birthday 🎂","Thank You 🙏","Congrats 🎉","Just Because 💚",
  "Big Love ❤️","Apology 😅","Well Done 🌟","Good Luck 🍀",
  "Milestone 🏆","Welcome 👋","I'm Proud of You 🌻","Forever Yours 💍",
];

// ─────────────────────────────────────────────────────────────────
// CSS
// ─────────────────────────────────────────────────────────────────
const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@600;700;900&display=swap');

  @keyframes gcReveal    { from{opacity:0;transform:scale(.88) translateY(14px)} to{opacity:1;transform:scale(1) translateY(0)} }
  @keyframes gcPop       { 0%{transform:scale(.8);opacity:0} 60%{transform:scale(1.1)} 100%{transform:scale(1);opacity:1} }
  @keyframes gcShimmer   { from{transform:translateX(-100%)} to{transform:translateX(200%)} }
  @keyframes gcBounce    { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-8px)} }
  @keyframes gcShake     { 0%{transform:rotate(0)} 18%{transform:rotate(-8deg) scale(1.06)} 36%{transform:rotate(8deg) scale(1.06)} 54%{transform:rotate(-4deg)} 72%{transform:rotate(4deg)} 90%{transform:rotate(-1deg)} 100%{transform:rotate(0)} }
  @keyframes gcLidFly    { from{transform:rotateX(0) translateY(0)} to{transform:rotateX(-72deg) translateY(-34px) scale(1.12);opacity:0} }
  @keyframes gcExplode   { from{opacity:1;transform:translate(0,0) rotate(0deg) scale(1)} to{opacity:0;transform:translate(var(--px),var(--py)) rotate(var(--pr)) scale(0)} }
  @keyframes gcToast     { 0%{opacity:0;transform:translateX(-50%) translateY(10px)} 15%,80%{opacity:1;transform:translateX(-50%) translateY(0)} 100%{opacity:0} }
  @keyframes gcSpin      { to{transform:rotate(360deg)} }
  @keyframes gcCardIn    { from{opacity:0;transform:translateY(10px) scale(.97)} to{opacity:1;transform:translateY(0) scale(1)} }
  @keyframes gcSuccess   { from{transform:scale(.85);opacity:0} to{transform:scale(1);opacity:1} }
  @keyframes gcPulse     { 0%,100%{opacity:1} 50%{opacity:.45} }
  @keyframes gcFloat     { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-9px)} }
  @keyframes gcFadeIn    { from{opacity:0} to{opacity:1} }
  @keyframes gcNavIn     { from{opacity:0;transform:translateX(-8px)} to{opacity:1;transform:translateX(0)} }
  @keyframes gcSlideUp   { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:translateY(0)} }
  @keyframes gcMsgReveal { 0%{opacity:0;transform:translateY(8px) scale(.96)} 100%{opacity:1;transform:translateY(0) scale(1)} }

  /* Tier cinematic extras */
  @keyframes gcLionRoar  { 0%{transform:scale(1)} 25%{transform:scale(1.22) rotate(-4deg)} 50%{transform:scale(.9) rotate(4deg)} 75%{transform:scale(1.14) rotate(-2deg)} 100%{transform:scale(1)} }
  @keyframes gcLionPounce{ 0%,100%{transform:translateY(0) rotate(0deg)} 40%{transform:translateY(-16px) rotate(-3deg)} 70%{transform:translateY(4px) rotate(1deg)} }
  @keyframes gcWishFloat { 0%,100%{transform:translateY(0) rotate(-3deg) scale(1)} 50%{transform:translateY(-12px) rotate(3deg) scale(1.06)} }
  @keyframes gcWishGlow  { 0%,100%{opacity:.5;transform:scale(1)} 50%{opacity:1;transform:scale(1.1)} }
  @keyframes gcCosmicPulse { 0%,100%{box-shadow:0 0 30px var(--glow),0 0 60px var(--glow)} 50%{box-shadow:0 0 80px var(--glow),0 0 160px var(--glow)} }
  @keyframes gcSongBar   { 0%,100%{transform:scaleY(.3)} 50%{transform:scaleY(1)} }
  @keyframes gcRipple    { 0%{transform:scale(0);opacity:.7} 100%{transform:scale(4);opacity:0} }
  @keyframes gcStarStream{ 0%{opacity:0;transform:translate(0,0) scale(0)} 40%{opacity:1;transform:translate(var(--sx),var(--sy)) scale(1.3)} 100%{opacity:0;transform:translate(calc(var(--sx)*2.4),calc(var(--sy)*2.4)) scale(0) rotate(540deg)} }
  @keyframes gcUnboxZoom { 0%{transform:scale(.88);opacity:0} 50%{transform:scale(1.04)} 100%{transform:scale(1);opacity:1} }
  @keyframes gcLineIn    { from{width:0;opacity:0} to{width:100%;opacity:1} }
  @keyframes gcGoldDrop  { 0%{transform:translateY(-8px) rotate(0deg);opacity:1} 100%{transform:translateY(60px) rotate(360deg);opacity:0} }

  .gc-scroll::-webkit-scrollbar{width:3px}
  .gc-scroll::-webkit-scrollbar-track{background:transparent}
  .gc-scroll::-webkit-scrollbar-thumb{background:rgba(255,255,255,0.08);border-radius:10px}
  .gc-tier{transition:all .24s cubic-bezier(.34,1.56,.64,1)!important}
  .gc-tier:hover{transform:translateY(-3px)!important}
  .gc-nav{transition:all .15s ease!important}
  .gc-nav:hover{background:rgba(255,255,255,0.05)!important}
  .gc-btn{transition:all .15s ease!important}
  .gc-btn:hover:not(:disabled){opacity:.88;transform:translateY(-1px)}
  .gc-occ{transition:all .15s ease!important;cursor:pointer}
  .gc-occ:hover{opacity:.8}
  .gc-wish-ambient{animation:gcCosmicPulse 3.5s ease-in-out infinite}
`;

// ─────────────────────────────────────────────────────────────────
// Custom Tier SVG Icons
// ─────────────────────────────────────────────────────────────────
const LionessIcon = ({ size = 24, color = "#fb923c" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <path d="M12 3C9.2 3 7 5.2 7 8c0 1.1.3 2.1.9 2.9C6.5 11.8 6 13.1 6 14.5 6 18 8.7 21 12 21s6-3 6-6.5c0-1.4-.5-2.7-1.9-3.6.6-.8.9-1.8.9-2.9C17 5.2 14.8 3 12 3z" stroke={color} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
    <circle cx="9.5" cy="8.2" r=".9" fill={color}/>
    <circle cx="14.5" cy="8.2" r=".9" fill={color}/>
    <path d="M10.5 12s.6.9 1.5.9 1.5-.9 1.5-.9" stroke={color} strokeWidth="1.2" strokeLinecap="round"/>
    <path d="M7.2 7C6 5.8 4.2 6.4 4.2 8s1.6 2.2 2.8 1.8" stroke={color} strokeWidth="1.2" strokeLinecap="round"/>
    <path d="M16.8 7c1.2-1.2 3-.6 3 1s-1.6 2.2-2.8 1.8" stroke={color} strokeWidth="1.2" strokeLinecap="round"/>
    <path d="M9 17.5c0 0 1 1.5 3 1.5s3-1.5 3-1.5" stroke={color} strokeWidth="1.1" strokeLinecap="round" opacity=".6"/>
  </svg>
);

const LionIcon = ({ size = 24, color = "#fcd34d" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <path d="M12 2C9 2 6.5 4.5 6.5 7.5c0 1.3.4 2.5 1.1 3.4C6 12 5.5 13.6 5.5 15.2 5.5 18.7 8.4 22 12 22s6.5-3.3 6.5-6.8c0-1.6-.5-3.2-2.1-4.3.7-.9 1.1-2.1 1.1-3.4C17.5 4.5 15 2 12 2z" stroke={color} strokeWidth="1.4" strokeLinecap="round"/>
    {/* Mane wisps */}
    <path d="M4.5 6c-1.2-.6-2.2.6-1.8 1.8s2.2 1.2 2.8.6" stroke={color} strokeWidth="1.2" strokeLinecap="round"/>
    <path d="M19.5 6c1.2-.6 2.2.6 1.8 1.8s-2.2 1.2-2.8.6" stroke={color} strokeWidth="1.2" strokeLinecap="round"/>
    <path d="M4.5 10.5c-1.8-.4-2.8 1.2-2.3 2.5s2.3 1.2 3 .7" stroke={color} strokeWidth="1.2" strokeLinecap="round"/>
    <path d="M19.5 10.5c1.8-.4 2.8 1.2 2.3 2.5s-2.3 1.2-3 .7" stroke={color} strokeWidth="1.2" strokeLinecap="round"/>
    <circle cx="9.5" cy="9" r="1" fill={color}/>
    <circle cx="14.5" cy="9" r="1" fill={color}/>
    <path d="M10.5 12.5s.6 1.1 1.5 1.1 1.5-1.1 1.5-1.1" stroke={color} strokeWidth="1.3" strokeLinecap="round"/>
    {/* Crown marks */}
    <circle cx="12" cy="2.6" r=".7" fill={color}/>
    <circle cx="9.2" cy="3.4" r=".5" fill={color} opacity=".7"/>
    <circle cx="14.8" cy="3.4" r=".5" fill={color} opacity=".7"/>
  </svg>
);

const WishIcon = ({ size = 24, color = "#f0abfc" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17 5.8 21.3l2.4-7.4L2 9.4h7.6z" stroke={color} strokeWidth="1.3" strokeLinejoin="round" fill={`${color}18`}/>
    <circle cx="20" cy="4" r="1.5" fill={color} opacity=".7"/>
    <circle cx="4" cy="20" r="1" fill={color} opacity=".5"/>
    <line x1="18" y1="2" x2="20" y2="4" stroke={color} strokeWidth="1.2" strokeLinecap="round" opacity=".6"/>
    <line x1="2" y1="18" x2="4" y2="20" stroke={color} strokeWidth="1.2" strokeLinecap="round" opacity=".4"/>
    <circle cx="20" cy="4" r=".5" fill="#fff" opacity=".9"/>
  </svg>
);

const getTierIcon = (tier, size = 24) => {
  if (tier.id === "lioness")    return <LionessIcon size={size} color={tier.c1}/>;
  if (tier.id === "lion")       return <LionIcon size={size} color={tier.c1}/>;
  if (tier.id === "make_a_wish") return <WishIcon size={size} color={tier.c1}/>;
  return <tier.Icon size={size} color={tier.c1}/>;
};

// ─────────────────────────────────────────────────────────────────
// EP Helpers
// ─────────────────────────────────────────────────────────────────
const deductEP = async (userId, amount, reason) => {
  const { data: p, error } = await supabase.from("profiles").select("engagement_points").eq("id", userId).single();
  if (error || !p) throw new Error("Could not read balance");
  const cur = Number(p.engagement_points || 0);
  if (cur < amount) throw new Error(`Insufficient EP — you have ${cur.toLocaleString()} EP, need ${amount.toLocaleString()} EP.`);
  const nb = cur - amount;
  const { error: e2 } = await supabase.from("profiles").update({ engagement_points: nb }).eq("id", userId);
  if (e2) throw new Error("Failed to deduct EP");
  supabase.from("ep_transactions").insert({ user_id: userId, amount: -amount, balance_after: nb, type: "spend", reason, metadata: { source: "gift_card" } }).catch(() => {});
  return nb;
};

const creditEP = async (userId, amount, reason) => {
  const { data: p, error } = await supabase.from("profiles").select("engagement_points").eq("id", userId).single();
  if (error || !p) throw new Error("Could not read balance");
  const nb = Number(p.engagement_points || 0) + amount;
  const { error: e2 } = await supabase.from("profiles").update({ engagement_points: nb }).eq("id", userId);
  if (e2) throw new Error("Failed to credit EP");
  supabase.from("ep_transactions").insert({ user_id: userId, amount, balance_after: nb, type: "bonus_grant", reason, metadata: { source: "gift_card_claim" } }).catch(() => {});
  return nb;
};

// ─────────────────────────────────────────────────────────────────
// Small shared components
// ─────────────────────────────────────────────────────────────────
const Toast = ({ msg, color }) => (
  <div style={{ position: "fixed", bottom: 96, left: "50%", transform: "translateX(-50%)", padding: "10px 22px", borderRadius: 14, background: `linear-gradient(135deg,${color},${color}bb)`, color: "#000", fontSize: 12, fontWeight: 900, zIndex: 99999, pointerEvents: "none", whiteSpace: "nowrap", boxShadow: `0 6px 26px ${color}55`, animation: "gcToast 2.8s ease forwards" }}>{msg}</div>
);
const Spin = ({ size = 16, color = "#000" }) => (
  <div style={{ width: size, height: size, border: `2.5px solid ${color}30`, borderTopColor: color, borderRadius: "50%", animation: "gcSpin .7s linear infinite", flexShrink: 0 }} />
);

// ─────────────────────────────────────────────────────────────────
// Song Mini Player
// ─────────────────────────────────────────────────────────────────
const SongPlayer = ({ url, title, tier, compact = false }) => {
  const audioRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    const onTime = () => setProgress(a.currentTime / (a.duration || 1));
    const onMeta = () => setDuration(a.duration || 0);
    const onEnd  = () => { setPlaying(false); setProgress(0); };
    a.addEventListener("timeupdate", onTime);
    a.addEventListener("loadedmetadata", onMeta);
    a.addEventListener("ended", onEnd);
    return () => { a.removeEventListener("timeupdate", onTime); a.removeEventListener("loadedmetadata", onMeta); a.removeEventListener("ended", onEnd); };
  }, [url]);

  const toggle = () => {
    const a = audioRef.current;
    if (!a) return;
    if (playing) { a.pause(); setPlaying(false); }
    else a.play().then(() => setPlaying(true)).catch(() => {});
  };

  const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
  const bars = Array.from({ length: compact ? 14 : 20 }, (_, i) => i);

  return (
    <div style={{ display: "flex", alignItems: "center", gap: compact ? 9 : 12, padding: compact ? "10px 13px" : "14px 16px", background: `${tier.c1}0a`, border: `1px solid ${tier.c1}30`, borderRadius: compact ? 12 : 16, position: "relative", overflow: "hidden" }}>
      <audio ref={audioRef} src={url} preload="metadata" />
      {/* Ambient glow layer */}
      <div style={{ position: "absolute", inset: 0, background: `radial-gradient(circle at 20% 50%, ${tier.c1}08, transparent 70%)`, pointerEvents: "none" }} />

      {/* Waveform */}
      <div style={{ display: "flex", alignItems: "center", gap: 2, height: compact ? 24 : 30, position: "relative" }}>
        {bars.map((b, i) => {
          const h = 20 + Math.sin(i * 0.9) * 50 + Math.cos(i * 0.4) * 20;
          return (
            <div key={b} style={{ width: 2.5, borderRadius: 2, background: playing ? tier.c1 : `${tier.c1}45`, height: `${h}%`, animation: playing ? `gcSongBar ${0.38 + i * 0.06}s ease-in-out ${i * 0.04}s infinite alternate` : undefined, transformOrigin: "bottom" }} />
          );
        })}
      </div>

      <div style={{ flex: 1, minWidth: 0, position: "relative" }}>
        <div style={{ fontSize: compact ? 10 : 12, fontWeight: 800, color: "#d4d4d4", marginBottom: compact ? 3 : 5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{title || "Attached Song"}</div>
        <div style={{ height: 3, background: "rgba(255,255,255,0.07)", borderRadius: 2, overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${progress * 100}%`, background: `linear-gradient(90deg,${tier.c1},${tier.c2})`, borderRadius: 2, transition: "width .4s linear" }} />
        </div>
        {duration > 0 && <div style={{ fontSize: 9, color: "#404040", marginTop: 3 }}>{fmt(duration * progress)} / {fmt(duration)}</div>}
      </div>

      <button onClick={toggle} style={{ width: compact ? 32 : 38, height: compact ? 32 : 38, borderRadius: "50%", border: "none", background: `linear-gradient(135deg,${tier.c1},${tier.c2})`, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0, boxShadow: `0 4px 16px ${tier.glow}`, position: "relative" }}>
        {/* Ripple on play */}
        {playing && <div style={{ position: "absolute", inset: 0, borderRadius: "50%", border: `2px solid ${tier.c1}`, animation: "gcRipple 1.2s ease-out infinite" }} />}
        {playing ? <Pause size={compact ? 13 : 15} color="#000" /> : <Play size={compact ? 13 : 15} color="#000" style={{ marginLeft: 1 }} />}
      </button>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────
// Song Attachment Panel
// ─────────────────────────────────────────────────────────────────
const SongPanel = ({ tier, song, setSong, senderSubTier }) => {
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver]   = useState(false);
  const [requestMode, setRequestMode] = useState(false);
  const [requestText, setRequestText] = useState("");
  const fileRef = useRef(null);
  const ret = getSongRetention(senderSubTier);

  const handleFile = async (file) => {
    if (!file || !file.type.startsWith("audio/")) return;
    setUploading(true);
    try {
      const url = URL.createObjectURL(file);
      setSong({ file, localUrl: url, name: file.name.replace(/\.[^.]+$/, ""), size: file.size, status: "ready" });
    } finally { setUploading(false); }
  };

  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <label style={{ fontSize: 10, fontWeight: 800, color: "#3a3a3a", textTransform: "uppercase", letterSpacing: "1.2px", display: "flex", alignItems: "center", gap: 5 }}>
          <Music size={11} color="#484848" /> Attach a Song
          <span style={{ fontSize: 9, color: "#2a2a2a", fontWeight: 600, marginLeft: 2 }}>(optional)</span>
        </label>
        <div style={{ display: "flex", alignItems: "center", gap: 5, padding: "3px 10px", background: `${tier.c1}0e`, border: `1px solid ${tier.c1}25`, borderRadius: 7 }}>
          <Clock size={9} color={tier.c1} />
          <span style={{ fontSize: 9, color: tier.c1, fontWeight: 700 }}>{ret.label}</span>
        </div>
      </div>

      {!song && !requestMode && (
        <div style={{ display: "flex", gap: 8 }}>
          <div onClick={() => !uploading && fileRef.current?.click()}
            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={e => { e.preventDefault(); setDragOver(false); handleFile(e.dataTransfer.files[0]); }}
            style={{ flex: 1, padding: "18px 12px", borderRadius: 14, border: `1.5px dashed ${dragOver ? tier.c1 : "rgba(255,255,255,0.1)"}`, background: dragOver ? `${tier.c1}08` : "rgba(255,255,255,0.02)", cursor: "pointer", textAlign: "center", transition: "all .2s" }}>
            {uploading ? <Spin size={18} color={tier.c1} style={{ margin: "0 auto 6px", display: "block" }} /> : <Upload size={20} color={dragOver ? tier.c1 : "#484848"} style={{ margin: "0 auto 7px", display: "block" }} />}
            <div style={{ fontSize: 11, color: "#555", fontWeight: 700 }}>Upload Song</div>
            <div style={{ fontSize: 9, color: "#2a2a2a", marginTop: 3 }}>MP3 · WAV · M4A · Auto-compressed</div>
          </div>
          <input ref={fileRef} type="file" accept="audio/*" style={{ display: "none" }} onChange={e => handleFile(e.target.files[0])} />

          <div onClick={() => setRequestMode(true)}
            style={{ flex: 1, padding: "18px 12px", borderRadius: 14, border: "1.5px dashed rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.02)", cursor: "pointer", textAlign: "center", transition: "all .2s" }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = tier.c1; e.currentTarget.style.background = `${tier.c1}08`; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)"; e.currentTarget.style.background = "rgba(255,255,255,0.02)"; }}>
            <Mic size={20} color="#484848" style={{ margin: "0 auto 7px", display: "block" }} />
            <div style={{ fontSize: 11, color: "#555", fontWeight: 700 }}>Request a Song</div>
            <div style={{ fontSize: 9, color: "#2a2a2a", marginTop: 3 }}>Ready in hours ✦</div>
          </div>
        </div>
      )}

      {requestMode && !song && (
        <div style={{ padding: "14px", background: "rgba(255,255,255,0.025)", border: `1px solid ${tier.c1}22`, borderRadius: 13, animation: "gcSlideUp .25s ease" }}>
          <div style={{ fontSize: 10, color: "#484848", marginBottom: 9, fontWeight: 700 }}>What song should we find?</div>
          <textarea value={requestText} onChange={e => setRequestText(e.target.value)} rows={2}
            placeholder={`e.g. "Perfect by Ed Sheeran" or "something soft and romantic"…`}
            style={{ width: "100%", padding: "10px 12px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, color: "#fff", fontSize: 12, outline: "none", resize: "none", caretColor: tier.c1, fontFamily: "inherit", boxSizing: "border-box" }} />
          <div style={{ display: "flex", gap: 7, marginTop: 8 }}>
            <button onClick={() => setRequestMode(false)} style={{ flex: 1, padding: "9px", borderRadius: 9, border: "1px solid rgba(255,255,255,0.07)", background: "transparent", color: "#484848", fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>Cancel</button>
            <button onClick={() => {
              if (!requestText.trim()) return;
              setSong({ name: requestText.trim(), isRequest: true, status: "pending" });
              setRequestMode(false);
            }} style={{ flex: 2, padding: "9px", borderRadius: 9, border: "none", background: `linear-gradient(135deg,${tier.c1},${tier.c2})`, color: "#000", fontSize: 11, fontWeight: 900, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, fontFamily: "inherit" }}>
              <Radio size={11} /> Request — Ready in Hours
            </button>
          </div>
        </div>
      )}

      {song && !song.isRequest && song.localUrl && (
        <div>
          <SongPlayer url={song.localUrl} title={song.name} tier={tier} />
          <button onClick={() => setSong(null)} style={{ marginTop: 7, width: "100%", padding: "7px", borderRadius: 9, border: "1px solid rgba(248,113,113,0.2)", background: "rgba(248,113,113,0.04)", color: "#f87171", fontSize: 10, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 5, fontFamily: "inherit" }}>
            <Trash2 size={10} /> Remove Song
          </button>
        </div>
      )}

      {song?.isRequest && (
        <div style={{ display: "flex", alignItems: "center", gap: 9, padding: "11px 13px", background: "rgba(251,191,36,0.06)", border: "1px solid rgba(251,191,36,0.2)", borderRadius: 12 }}>
          <Radio size={13} color="#fbbf24" />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 11, color: "#fbbf24", fontWeight: 800 }}>Song Requested ✓</div>
            <div style={{ fontSize: 9, color: "#504010", marginTop: 1 }}>"{song.name}" — Will be ready in hours</div>
          </div>
          <button onClick={() => setSong(null)} style={{ background: "none", border: "none", color: "#3a3a3a", cursor: "pointer", padding: 2 }}><X size={11} /></button>
        </div>
      )}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────
// Gift Card Face
// ─────────────────────────────────────────────────────────────────
const CardFace = ({ tier, message, occasion, senderName, recipientName, code, compact, hasSong }) => {
  const isRoyal = tier.id === "lion" || tier.id === "lioness";
  const isWish  = tier.id === "make_a_wish";
  const useSerifFont = isRoyal || isWish;

  return (
    <div style={{
      borderRadius: compact ? 14 : 20, overflow: "hidden", position: "relative",
      background: `linear-gradient(145deg,${tier.c1}1c 0%,${tier.c2}0e 60%,transparent 100%)`,
      border: `1.5px solid ${tier.c1}44`,
      padding: compact ? "14px" : isWish ? "24px 22px" : "22px 20px",
      boxShadow: `0 16px 48px ${tier.glow}, 0 2px 0 ${tier.c1}18 inset`,
      animation: "gcReveal .55s cubic-bezier(.34,1.56,.64,1)",
      ...(isWish ? { "--glow": tier.glow } : {}),
    }} className={isWish && !compact ? "gc-wish-ambient" : ""}>

      {/* Shimmer */}
      <div style={{ position: "absolute", top: 0, left: 0, width: "38%", height: "100%", background: "linear-gradient(45deg,transparent,rgba(255,255,255,0.06),transparent)", animation: "gcShimmer 4.5s ease-in-out infinite", pointerEvents: "none" }} />
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 1, background: `linear-gradient(90deg,transparent,${tier.c1}65,transparent)`, pointerEvents: "none" }} />

      {/* Wish / Royal bottom ambience */}
      {(isRoyal || isWish) && <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 64, background: `linear-gradient(0deg,${tier.c1}12,transparent)`, pointerEvents: "none" }} />}

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: compact ? 10 : 16 }}>
        <div style={{ flex: 1, minWidth: 0, paddingRight: 12 }}>
          {isWish && !compact && (
            <div style={{ fontSize: 9, color: tier.c1, letterSpacing: "3px", marginBottom: 5, opacity: 0.75, fontFamily: "'Cinzel',serif", textTransform: "uppercase" }}>✦ Once In A Lifetime ✦</div>
          )}
          <div style={{ fontSize: 7, fontWeight: 900, color: tier.c1, textTransform: "uppercase", letterSpacing: "2.5px", marginBottom: 4, opacity: 0.65 }}>
            {isWish ? "XEEVIA · MAKE A WISH" : isRoyal ? "XEEVIA · ROYAL TIER" : "XEEVIA GIFT CARD"}
          </div>
          <div style={{ fontSize: compact ? 18 : isWish ? 28 : 24, fontWeight: 900, color: "#fff", letterSpacing: isWish ? "-1px" : "-0.3px", fontFamily: useSerifFont ? "'Cinzel',serif" : undefined, lineHeight: 1.1 }}>
            {tier.name}
          </div>
        </div>
        <div style={{ width: compact ? 40 : isWish ? 56 : 52, height: compact ? 40 : isWish ? 56 : 52, borderRadius: compact ? 12 : 15, background: `${tier.c1}15`, border: `1.5px solid ${tier.c1}38`, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: `0 6px 22px ${tier.glow}`, flexShrink: 0 }}>
          {getTierIcon(tier, compact ? 18 : isWish ? 28 : 24)}
        </div>
      </div>

      {/* EP Badge */}
      <div style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: compact ? "5px 11px" : "7px 15px", borderRadius: 10, background: `${tier.c1}14`, border: `1px solid ${tier.c1}28`, marginBottom: compact ? 9 : 14 }}>
        <Zap size={compact ? 10 : 13} color={tier.c1} />
        <span style={{ fontSize: compact ? 16 : 22, fontWeight: 900, color: tier.c1 }}>{tier.value.toLocaleString()} EP</span>
      </div>

      {/* Message */}
      {message && (
        <div style={{ fontSize: compact ? 11 : 13, color: "rgba(255,255,255,0.52)", fontStyle: "italic", lineHeight: 1.68, padding: compact ? "8px 10px" : "11px 14px", borderRadius: 11, background: "rgba(255,255,255,0.04)", borderLeft: `2px solid ${tier.c1}48`, marginBottom: compact ? 9 : 14, animation: "gcMsgReveal .6s ease" }}>
          "{message}"
        </div>
      )}

      {/* Song indicator */}
      {hasSong && (
        <div style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "4px 11px", borderRadius: 8, background: `${tier.c1}10`, border: `1px solid ${tier.c1}24`, marginBottom: compact ? 9 : 14 }}>
          <Music size={9} color={tier.c1} />
          <span style={{ fontSize: 9, color: tier.c1, fontWeight: 700 }}>🎵 Song attached</span>
        </div>
      )}

      {/* Footer */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
        <div>
          {senderName && <div style={{ fontSize: 10, color: "#3a3a3a" }}>From <span style={{ color: "#606060" }}>{senderName}</span></div>}
          {recipientName && <div style={{ fontSize: 10, color: "#3a3a3a" }}>To <span style={{ color: "#888" }}>{recipientName}</span></div>}
          {occasion && <div style={{ fontSize: 10, color: tier.c1, marginTop: 3, fontWeight: 700 }}>{occasion}</div>}
        </div>
        {code && <div style={{ fontSize: 8, fontWeight: 800, color: "#252525", fontFamily: "monospace", letterSpacing: ".4px", background: "rgba(0,0,0,0.55)", padding: "4px 9px", borderRadius: 6 }}>{code}</div>}
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────
// Cinematic Burst Box — tier-specific particle configs
// ─────────────────────────────────────────────────────────────────
const BURST_CONFIGS = {
  confetti:  { n: 28, colors: t => [t.c1, t.c2, "#fff", "#e2e8f0", "#94a3b8"] },
  golden:    { n: 34, colors: t => [t.c1, t.c2, "#fef9c3", "#fff", "#fde68a", "#fcd34d"] },
  diamond:   { n: 36, colors: t => [t.c1, t.c2, "#bae6fd", "#fff", "#0ea5e9", "#38bdf8"] },
  fire:      { n: 30, colors: t => [t.c1, t.c2, "#fed7aa", "#fff", "#fca5a5", "#fb923c"] },
  obsidian:  { n: 24, colors: t => ["#d4d4d8", "#71717a", "#fff", "#3f3f46", "#18181b"] },
  cosmic:    { n: 42, colors: t => [t.c1, t.c2, "#fff", "#e879f9", "#818cf8", "#a78bfa"] },
  lioness:   { n: 38, colors: t => [t.c1, t.c2, "#fed7aa", "#fff", "#fdba74", "#fb923c"] },
  lion:      { n: 46, colors: t => [t.c1, t.c2, "#fef9c3", "#fff", "#fde047", "#fbbf24"] },
  wish:      { n: 64, colors: t => [t.c1, t.c2, "#fff", "#e879f9", "#a78bfa", "#7dd3fc", "#f0abfc", "#fde68a"] },
};

const BurstBox = ({ tier, onOpened }) => {
  const [phase, setPhase] = useState("idle");
  const [particles, setParticles] = useState([]);
  const cfg = BURST_CONFIGS[tier.burstStyle] || BURST_CONFIGS.confetti;
  const isLion = tier.id === "lion" || tier.id === "lioness";
  const isWish = tier.id === "make_a_wish";

  const tap = () => {
    if (phase !== "idle") return;
    setPhase("shaking");
    const shakeDur = isLion ? 800 : isWish ? 700 : 620;
    setTimeout(() => {
      setPhase("explode");
      const cols = cfg.colors(tier);
      setParticles(Array.from({ length: cfg.n }, (_, i) => ({
        id: i,
        x: (Math.random() - .5) * (isWish ? 420 : 360),
        y: -(Math.random() * (isWish ? 300 : 260) + 60),
        rot: Math.random() * 720 - 360,
        size: Math.random() * (isWish ? 15 : 12) + 4,
        color: cols[Math.floor(Math.random() * cols.length)],
        delay: i * (isWish ? 0.01 : 0.013),
        round: Math.random() > .42,
        star: isWish && Math.random() > .6,
      })));
      setTimeout(() => { setPhase("done"); onOpened?.(); }, isWish ? 1000 : isLion ? 800 : 720);
    }, shakeDur);
  };

  if (phase === "done") return null;

  const idleAnim = isWish
    ? "gcWishFloat 2.5s ease-in-out infinite"
    : isLion
    ? "gcLionPounce 3.2s ease-in-out infinite"
    : "gcBounce 2.4s ease-in-out infinite";

  const shakeAnim = isLion
    ? "gcLionRoar .75s ease"
    : isWish
    ? "gcShake .6s ease"
    : "gcShake .6s ease";

  const boxSize = isWish ? 134 : isLion ? 124 : 116;
  const boxHeight = isWish ? 116 : isLion ? 108 : 100;

  return (
    <div style={{ textAlign: "center", padding: "32px 0 22px", position: "relative", userSelect: "none" }}>
      {/* Wish background aura */}
      {isWish && (
        <div style={{ position: "absolute", inset: 0, background: `radial-gradient(circle at 50% 55%, ${tier.c1}18 0%, transparent 70%)`, pointerEvents: "none", animation: "gcWishGlow 2.2s ease-in-out infinite" }} />
      )}

      {/* Particles */}
      {phase === "explode" && particles.map(p => (
        <div key={p.id} style={{
          position: "absolute", top: "50%", left: "50%",
          width: p.star ? p.size + 5 : p.size, height: p.star ? p.size + 5 : p.size,
          background: p.color,
          borderRadius: p.round ? "50%" : p.star ? "0" : "3px",
          clipPath: p.star ? "polygon(50% 0%,61% 35%,98% 35%,68% 57%,79% 91%,50% 70%,21% 91%,32% 57%,2% 35%,39% 35%)" : undefined,
          "--px": `${p.x}px`, "--py": `${p.y}px`, "--pr": `${p.rot}deg`,
          animation: `gcExplode ${isWish ? 1.1 : .88}s cubic-bezier(.22,1,.36,1) ${p.delay}s both`,
          zIndex: 10, pointerEvents: "none",
          boxShadow: isWish ? `0 0 8px ${p.color}88` : undefined,
        }} />
      ))}

      {/* Box */}
      <div onClick={tap} style={{
        display: "inline-block",
        cursor: phase === "idle" ? "pointer" : "default",
        position: "relative",
        animation: phase === "idle" ? idleAnim : phase === "shaking" ? shakeAnim : "none",
        filter: isWish ? `drop-shadow(0 0 24px ${tier.glow})` : undefined,
      }}>
        {/* Lid */}
        <div style={{
          position: "absolute", top: -4, left: -10, right: -10, height: 36,
          background: `linear-gradient(135deg,${tier.c1},${tier.c2})`,
          borderRadius: "13px 13px 0 0",
          boxShadow: `0 -5px 20px ${tier.glow}, 0 1px 0 rgba(255,255,255,0.22) inset`,
          transformOrigin: "center top",
          animation: phase === "explode" ? "gcLidFly .42s cubic-bezier(.22,1,.36,1) forwards" : "none",
          zIndex: 2, overflow: "hidden",
        }}>
          <div style={{ position: "absolute", top: 0, left: "50%", transform: "translateX(-50%)", width: 18, height: "100%", background: "rgba(255,255,255,0.22)" }} />
          <div style={{ position: "absolute", top: -12, left: "50%", transform: "translateX(-50%)", fontSize: 22, lineHeight: 1 }}>
            {isWish ? "🌟" : isLion ? (tier.id === "lion" ? "👑" : "🦁") : "🎀"}
          </div>
        </div>

        {/* Box body */}
        <div style={{
          width: boxSize, height: boxHeight,
          borderRadius: "0 0 17px 17px", marginTop: 32,
          background: `linear-gradient(160deg,${tier.c1}1e,${tier.c2}0e)`,
          border: `2px solid ${tier.c1}48`, borderTop: "none",
          boxShadow: `0 18px 44px ${tier.glow}, 0 1px 0 rgba(255,255,255,0.05) inset`,
          display: "flex", alignItems: "center", justifyContent: "center",
          position: "relative", overflow: "hidden",
        }}>
          {/* Ribbon vertical stripe */}
          <div style={{ position: "absolute", top: 0, bottom: 0, left: "50%", transform: "translateX(-50%)", width: 18, background: tier.c1, opacity: 0.18 }} />
          {/* Main icon */}
          <div style={{ fontSize: isWish ? 44 : isLion ? 38 : 34, filter: `drop-shadow(0 0 18px ${tier.glow})`, position: "relative", zIndex: 1 }}>
            {tier.emoji}
          </div>
          {/* Sheen */}
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "44%", background: "linear-gradient(180deg,rgba(255,255,255,0.07),transparent)", pointerEvents: "none" }} />
        </div>
      </div>

      {/* Tap hint */}
      {phase === "idle" && (
        <div style={{ marginTop: 22, animation: "gcFadeIn .5s ease" }}>
          <div style={{ fontSize: 12, color: "#404040", fontWeight: 700 }}>👆 Tap to open</div>
          <div style={{ fontSize: 10, color: tier.c1, opacity: 0.55, fontStyle: "italic", marginTop: 4, fontFamily: (tier.id === "lion" || tier.id === "lioness" || tier.id === "make_a_wish") ? "'Cinzel',serif" : undefined }}>
            {tier.unlockLine}
          </div>
        </div>
      )}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────
// Inbox Card — Full cinematic unwrap experience
// ─────────────────────────────────────────────────────────────────
const InboxCard = ({ card, onClaim, currentUser }) => {
  const [phase, setPhase] = useState("sealed"); // sealed|shaking|burst|revealed|claimed
  const [claiming, setClaiming] = useState(false);
  const [songData, setSongData] = useState(null);
  const tier = TIERS.find(t => t.id === card.tier) || TIERS[0];
  const net  = tier.value - Math.round(tier.value * FEE);

  // Load attached song if present
  useEffect(() => {
    if (!card.has_song || !card.code) return;
    supabase.from("gift_card_songs").select("playback_url,original_filename,expires_at").eq("card_code", card.code).maybeSingle()
      .then(({ data }) => { if (data) setSongData(data); });
  }, [card.code, card.has_song]);

  const open = () => {
    if (phase !== "sealed") return;
    setPhase("shaking");
    setTimeout(() => setPhase("burst"), tier.id === "lion" ? 900 : tier.id === "make_a_wish" ? 800 : 680);
  };

  const afterBurst = useCallback(() => setTimeout(() => setPhase("revealed"), 250), []);

  const handleClaim = async () => {
    if (claiming) return;
    setClaiming(true);
    try {
      if (currentUser?.id) await creditEP(currentUser.id, net, `Gift card claim: ${card.code}`);
      await supabase.from("gift_cards").update({ status: "redeemed", redeemed_by: currentUser?.id, redeemed_at: new Date().toISOString() }).eq("code", card.code);
      setPhase("claimed");
      onClaim?.(card, net);
    } catch (e) { console.error(e); setPhase("revealed"); } finally { setClaiming(false); }
  };

  const isRoyal = tier.id === "lion" || tier.id === "lioness";
  const isWish  = tier.id === "make_a_wish";

  return (
    <div style={{
      background: "rgba(255,255,255,0.025)",
      border: "1px solid rgba(255,255,255,0.07)",
      borderRadius: 18, overflow: "hidden", marginBottom: 13,
      boxShadow: `0 1px 0 rgba(255,255,255,0.04) inset, 0 4px 24px ${tier.glow}18`,
      animation: "gcCardIn .35s ease both",
    }}>
      {/* Header strip */}
      <div style={{ display: "flex", alignItems: "center", gap: 11, padding: "12px 15px", borderBottom: "1px solid rgba(255,255,255,0.05)", background: isWish ? `linear-gradient(135deg,${tier.c1}08,${tier.c2}06)` : undefined }}>
        <div style={{ width: 36, height: 36, borderRadius: "50%", background: `${tier.c1}18`, border: `1px solid ${tier.c1}30`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: 18, filter: `drop-shadow(0 2px 8px ${tier.glow})` }}>
          {tier.emoji.split("")[0]}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: "#d4d4d4" }}>From <span style={{ color: tier.c1 }}>@{card.senderUsername || "someone"}</span></div>
          <div style={{ fontSize: 10, color: "#404040" }}>{card.occasion || "A special gift"}</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
          {card.has_song && <Music size={11} color={tier.c1} style={{ opacity: 0.7 }} />}
          <div style={{ fontSize: 13, fontWeight: 900, color: tier.c1 }}>{tier.value.toLocaleString()} EP</div>
        </div>
      </div>

      <div style={{ padding: "12px 14px 16px" }}>

        {/* SEALED */}
        {phase === "sealed" && (
          <div onClick={open} style={{
            display: "flex", flexDirection: "column", alignItems: "center",
            padding: isWish ? "36px 24px" : "28px 24px",
            cursor: "pointer", borderRadius: 15,
            background: isWish ? `radial-gradient(circle,${tier.c1}10,${tier.c2}06)` : `${tier.c1}07`,
            border: `1.5px dashed ${tier.c1}28`, transition: "all .2s",
            position: "relative", overflow: "hidden",
          }}>
            {isWish && <div style={{ position: "absolute", inset: 0, background: `radial-gradient(circle,${tier.c1}15,transparent 70%)`, animation: "gcWishGlow 2.5s ease-in-out infinite", pointerEvents: "none" }} />}
            <div style={{
              fontSize: isWish ? 64 : isRoyal ? 58 : 52,
              animation: isLion ? "gcLionPounce 3s ease-in-out infinite" : isWish ? "gcWishFloat 2s ease-in-out infinite" : "gcFloat 2.2s ease-in-out infinite",
              marginBottom: 10, filter: `drop-shadow(0 6px 18px ${tier.glow})`, position: "relative",
            }}>
              {tier.emoji}
            </div>
            <div style={{ fontSize: 13, color: "#555", fontWeight: 700, marginBottom: 5 }}>Tap to burst open your gift</div>
            <div style={{ fontSize: 10, color: tier.c1, opacity: 0.6, fontStyle: "italic", fontFamily: useSerifFont ? "'Cinzel',serif" : undefined }}>
              {tier.unlockLine}
            </div>
            {card.has_song && (
              <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 5, padding: "4px 11px", background: `${tier.c1}10`, border: `1px solid ${tier.c1}22`, borderRadius: 8 }}>
                <Music size={9} color={tier.c1} /><span style={{ fontSize: 9, color: tier.c1, fontWeight: 700 }}>Song inside 🎵</span>
              </div>
            )}
          </div>
        )}

        {/* SHAKING */}
        {phase === "shaking" && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "32px 24px", gap: 12 }}>
            <div style={{
              fontSize: 56,
              animation: isLion ? "gcLionRoar .55s ease infinite" : isWish ? "gcShake .5s ease infinite" : "gcShake .5s ease infinite",
              filter: `drop-shadow(0 4px 20px ${tier.glow})`,
            }}>
              {tier.emoji}
            </div>
            <div style={{ fontSize: 12, color: "#505050", fontWeight: 700, animation: "gcPulse .65s ease infinite" }}>{tier.openingText}</div>
          </div>
        )}

        {/* BURST — full cinematic BurstBox component */}
        {phase === "burst" && <BurstBox tier={tier} onOpened={afterBurst} />}

        {/* REVEALED + CLAIMED */}
        {(phase === "revealed" || phase === "claimed") && (
          <div style={{ animation: "gcUnboxZoom .55s cubic-bezier(.34,1.56,.64,1)" }}>
            <CardFace
              tier={tier} message={card.message} occasion={card.occasion}
              senderName={`@${card.senderUsername || "someone"}`}
              hasSong={!!songData} compact
            />

            {/* Unlock line reveal */}
            <div style={{ margin: "10px 0 8px", textAlign: "center" }}>
              <div style={{ fontSize: 10, color: tier.c1, fontStyle: "italic", opacity: 0.65, fontFamily: (isRoyal || isWish) ? "'Cinzel',serif" : undefined, animation: "gcSlideUp .5s ease" }}>
                {tier.unlockLine}
              </div>
              <div style={{ height: 1, background: `linear-gradient(90deg,transparent,${tier.c1}35,transparent)`, marginTop: 8, animation: "gcLineIn .8s ease .2s both" }} />
            </div>

            {/* Song player */}
            {songData && (
              <div style={{ marginTop: 10 }}>
                <SongPlayer url={songData.playback_url} title={songData.original_filename} tier={tier} compact />
                {songData.expires_at && (
                  <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 6, padding: "5px 10px", background: "rgba(255,255,255,0.02)", borderRadius: 8 }}>
                    <Clock size={9} color="#404040" />
                    <span style={{ fontSize: 9, color: "#383838" }}>Available until {new Date(songData.expires_at).toLocaleDateString()}</span>
                  </div>
                )}
              </div>
            )}

            {/* Actions */}
            <div style={{ marginTop: 11 }}>
              {phase === "revealed" && (
                <button onClick={handleClaim} disabled={claiming} style={{
                  width: "100%", padding: "14px", borderRadius: 13, border: "none",
                  background: `linear-gradient(135deg,${tier.c1},${tier.c2})`,
                  color: "#000", fontSize: 13, fontWeight: 900,
                  cursor: claiming ? "not-allowed" : "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
                  boxShadow: `0 6px 22px ${tier.glow}`, fontFamily: "inherit", opacity: claiming ? 0.7 : 1,
                }}>
                  {claiming ? <Spin size={14} /> : <><Zap size={14} /> Claim {net.toLocaleString()} EP <span style={{ fontSize: 10, opacity: 0.55, fontWeight: 600 }}>(−2% fee)</span></>}
                </button>
              )}
              {phase === "claimed" && (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "13px", borderRadius: 12, background: "rgba(34,197,94,0.07)", border: "1px solid rgba(34,197,94,0.18)", animation: "gcReveal .4s ease" }}>
                  <CheckCircle size={16} color="#22c55e" />
                  <span style={{ fontSize: 13, color: "#22c55e", fontWeight: 900 }}>{net.toLocaleString()} EP Claimed! ✨</span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// a little helper for the isLion / isWish variables inside InboxCard JSX
// (they're used as vars before declaration — hoisted, so fine)
var isLion = false;
var useSerifFont = false;

// ─────────────────────────────────────────────────────────────────
// User Search
// ─────────────────────────────────────────────────────────────────
const UserSearch = ({ onSelect, selected, currentUser }) => {
  const [q, setQ] = useState(""); const [res, setRes] = useState([]); const [busy, setBusy] = useState(false); const db = useRef(null);
  const search = async (v) => {
    if (!v.trim()) { setRes([]); return; } setBusy(true);
    try {
      const { data } = await supabase.from("profiles").select("id,username,full_name,avatar_id,verified").or(`username.ilike.%${v.replace(/^@/, "")}%,full_name.ilike.%${v.replace(/^@/, "")}%`).neq("id", currentUser?.id).limit(6);
      setRes(data || []);
    } catch { setRes([]); } finally { setBusy(false); }
  };
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={{ fontSize: 10, fontWeight: 800, color: "#3a3a3a", textTransform: "uppercase", letterSpacing: "1px", display: "block", marginBottom: 8 }}>Send To</label>
      <div style={{ position: "relative" }}>
        <Search size={13} color="#404040" style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} />
        <input value={q} onChange={e => { setQ(e.target.value); clearTimeout(db.current); db.current = setTimeout(() => search(e.target.value), 280); }} placeholder="@username or name…"
          style={{ width: "100%", padding: "11px 12px 11px 36px", background: selected ? "rgba(132,204,22,0.04)" : "rgba(255,255,255,0.04)", border: `1px solid ${selected ? "rgba(132,204,22,0.3)" : "rgba(255,255,255,0.09)"}`, borderRadius: 12, color: "#fff", fontSize: 13, outline: "none", caretColor: "#84cc16", fontFamily: "inherit", transition: "border .2s", boxSizing: "border-box" }} />
        {busy && <div style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", width: 14, height: 14, border: "2px solid rgba(132,204,22,0.15)", borderTopColor: "#84cc16", borderRadius: "50%", animation: "gcSpin .7s linear infinite" }} />}
      </div>
      {res.length > 0 && (
        <div style={{ background: "rgba(10,10,10,0.99)", border: "1px solid rgba(255,255,255,0.09)", borderRadius: 13, overflow: "hidden", marginTop: 5, boxShadow: "0 12px 36px rgba(0,0,0,0.8)", backdropFilter: "blur(20px)" }}>
          {res.map((u, i) => (
            <div key={u.id} onClick={() => { onSelect(u); setQ(`@${u.username}`); setRes([]); }} style={{ display: "flex", alignItems: "center", padding: "9px 13px", cursor: "pointer", borderBottom: i < res.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none", transition: "background .12s" }} onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.04)"} onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
              <ProfilePreview profile={{ userId: u.id, author: u.full_name || u.username, username: u.username, profiles: { avatar_id: u.avatar_id }, verified: u.verified }} currentUser={currentUser} size="small" showUsername />
            </div>
          ))}
        </div>
      )}
      {selected && !res.length && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 13px", marginTop: 5, background: "rgba(132,204,22,0.05)", border: "1px solid rgba(132,204,22,0.16)", borderRadius: 11 }}>
          <CheckCircle size={13} color="#84cc16" /><span style={{ fontSize: 12, color: "#84cc16", fontWeight: 700, flex: 1 }}>Sending to @{selected.username}</span>
          <button onClick={() => { onSelect(null); setQ(""); }} style={{ background: "none", border: "none", color: "#3a3a3a", cursor: "pointer", padding: 2 }}><X size={12} /></button>
        </div>
      )}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────
// PC Left Sidebar
// ─────────────────────────────────────────────────────────────────
const PCLeftSidebar = ({ tab, onTab, newInbox, currentEP }) => {
  const items = [
    { k: "send",     Icon: Send,    label: "Send Gift",   desc: "Choose a tier" },
    { k: "redeem",   Icon: Zap,     label: "Redeem Code", desc: "Enter a gift code" },
    { k: "inbox",    Icon: Gift,    label: "Gift Inbox",  desc: "Cards received", badge: newInbox },
    { k: "my_cards", Icon: Package, label: "My Cards",    desc: "Your history" },
  ];
  return (
    <div style={{ width: 232, flexShrink: 0, background: "rgba(6,6,6,0.97)", borderRight: "1px solid rgba(255,255,255,0.06)", display: "flex", flexDirection: "column", padding: "0 0 16px" }}>
      {/* Balance */}
      <div style={{ margin: "14px 12px 8px", padding: "14px 16px", background: "linear-gradient(135deg,rgba(56,189,248,0.08),rgba(124,58,237,0.06))", border: "1px solid rgba(56,189,248,0.14)", borderRadius: 15, animation: "gcFadeIn .4s ease" }}>
        <div style={{ fontSize: 9, fontWeight: 800, color: "#38bdf8", textTransform: "uppercase", letterSpacing: "1.5px", marginBottom: 6, opacity: 0.8 }}>Your Balance</div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}><Zap size={13} color="#fbbf24" /><span style={{ fontSize: 22, fontWeight: 900, color: "#fff", letterSpacing: "-0.5px" }}>{currentEP !== null ? currentEP.toLocaleString() : "—"}</span><span style={{ fontSize: 11, color: "#404040", fontWeight: 700 }}>EP</span></div>
        <div style={{ fontSize: 10, color: "#2a2a2a", marginTop: 3 }}>Engagement Points</div>
      </div>
      {/* Nav */}
      <div style={{ flex: 1, padding: "6px 8px" }}>
        {items.map(({ k, Icon, label, desc, badge }, i) => {
          const active = tab === k;
          return (
            <div key={k} className="gc-nav" onClick={() => onTab(k)} style={{ display: "flex", alignItems: "center", gap: 11, padding: "10px 12px", borderRadius: 12, marginBottom: 3, cursor: "pointer", position: "relative", background: active ? "rgba(56,189,248,0.1)" : "transparent", border: `1px solid ${active ? "rgba(56,189,248,0.2)" : "transparent"}`, animation: `gcNavIn .3s ease ${i * 0.05}s both` }}>
              <div style={{ width: 34, height: 34, borderRadius: 10, flexShrink: 0, background: active ? "rgba(56,189,248,0.15)" : "rgba(255,255,255,0.04)", border: `1px solid ${active ? "rgba(56,189,248,0.3)" : "rgba(255,255,255,0.06)"}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Icon size={14} color={active ? "#38bdf8" : "#484848"} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 800, color: active ? "#fff" : "#606060", marginBottom: 1 }}>{label}</div>
                <div style={{ fontSize: 10, color: active ? "#38bdf8" : "#2a2a2a" }}>{desc}</div>
              </div>
              {badge > 0 && <div style={{ width: 18, height: 18, borderRadius: "50%", background: "#f87171", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 900, color: "#fff", animation: "gcPulse 1.5s ease infinite", flexShrink: 0 }}>{badge}</div>}
              {active && <ChevronRight size={11} color="#38bdf8" style={{ flexShrink: 0 }} />}
            </div>
          );
        })}
      </div>
      <div style={{ margin: "0 10px", padding: "11px 13px", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: 11 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 5 }}><Shield size={10} color="#383838" /><span style={{ fontSize: 9, fontWeight: 800, color: "#303030", textTransform: "uppercase", letterSpacing: "1px" }}>Protocol Fee</span></div>
        <div style={{ fontSize: 10, color: "#262626", lineHeight: 1.6 }}>2% applied on all gift card transactions.</div>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────
// PC Right Preview Panel
// ─────────────────────────────────────────────────────────────────
const PCRightPanel = ({ tier, message, occasion, senderName, recipientName, song }) => (
  <div style={{ width: 276, flexShrink: 0, background: "rgba(5,5,5,0.96)", borderLeft: "1px solid rgba(255,255,255,0.05)", display: "flex", flexDirection: "column", padding: "18px 14px", overflowY: "auto" }} className="gc-scroll">
    <div style={{ fontSize: 9, fontWeight: 800, color: "#242424", textTransform: "uppercase", letterSpacing: "1.5px", marginBottom: 14 }}>Live Preview</div>
    {!tier ? (
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", opacity: 0.22 }}>
        <div style={{ fontSize: 52, marginBottom: 14, animation: "gcFloat 3s ease-in-out infinite" }}>🎁</div>
        <div style={{ fontSize: 11, color: "#303030", textAlign: "center", lineHeight: 1.7 }}>Select a gem tier to see your card preview</div>
      </div>
    ) : (
      <>
        <CardFace tier={tier} message={message || "Your message appears here…"} occasion={occasion} senderName={senderName || "You"} recipientName={recipientName} code="GC-XXXX-XXXX" hasSong={!!song} />
        {song && !song.isRequest && song.localUrl && (
          <div style={{ marginTop: 11 }}>
            <SongPlayer url={song.localUrl} title={song.name} tier={tier} compact />
          </div>
        )}
        {song?.isRequest && (
          <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 7, padding: "9px 12px", background: "rgba(251,191,36,0.06)", border: "1px solid rgba(251,191,36,0.18)", borderRadius: 10 }}>
            <Radio size={11} color="#fbbf24" />
            <div style={{ fontSize: 10, color: "#fbbf24", fontWeight: 700 }}>Song requested: "{song.name}"</div>
          </div>
        )}
        <div style={{ marginTop: 14, padding: "13px", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: 12 }}>
          <div style={{ fontSize: 9, fontWeight: 800, color: "#303030", marginBottom: 10, textTransform: "uppercase", letterSpacing: "1px" }}>Summary</div>
          {[
            ["Card Value",       `${tier.value.toLocaleString()} EP`,                                        tier.c1],
            ["Protocol Fee 2%", `-${Math.round(tier.value * FEE).toLocaleString()} EP`,                     "#f87171"],
            ["They Receive",     `${(tier.value - Math.round(tier.value * FEE)).toLocaleString()} EP`,       "#22c55e"],
            ["Price",            `$${tier.price}`,                                                            "#888"],
          ].map(([l, v, c]) => (
            <div key={l} style={{ display: "flex", justifyContent: "space-between", fontSize: 11, marginBottom: 6 }}>
              <span style={{ color: "#333" }}>{l}</span><span style={{ color: c, fontWeight: 700 }}>{v}</span>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 11, padding: "10px 12px", background: `${tier.c1}07`, border: `1px solid ${tier.c1}18`, borderRadius: 10 }}>
          <div style={{ fontSize: 10, color: tier.c1, lineHeight: 1.6, opacity: 0.75, fontStyle: (tier.id === "lion" || tier.id === "lioness" || tier.id === "make_a_wish") ? "italic" : undefined }}>{tier.desc}</div>
        </div>
      </>
    )}
  </div>
);

// ─────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────
const GiftCardsView = ({ currentUser, onClose, isSidebar = false }) => {
  const [tab,         setTab]         = useState("send");
  const [phase,       setPhase]       = useState("browse");
  const [selId,       setSelId]       = useState(null);
  const [occasion,    setOccasion]    = useState("");
  const [message,     setMessage]     = useState("");
  const [recipient,   setRecipient]   = useState(null);
  const [song,        setSong]        = useState(null);
  const [redCode,     setRedCode]     = useState("");
  const [redState,    setRedState]    = useState("idle");
  const [myCards,     setMyCards]     = useState([]);
  const [inbox,       setInbox]       = useState([]);
  const [loading,     setLoading]     = useState(false);
  const [genCode,     setGenCode]     = useState("");
  const [copied,      setCopied]      = useState(false);
  const [toast,       setToast]       = useState(null);
  const [burstDone,   setBurstDone]   = useState(false);
  const [currentEP,   setCurrentEP]   = useState(null);
  const [epError,     setEpError]     = useState("");
  const [loadingCards,setLoadingCards]= useState(false);
  const [isWide,      setIsWide]      = useState(() => typeof window !== "undefined" ? window.innerWidth >= 1024 : false);

  useEffect(() => {
    const h = () => setIsWide(window.innerWidth >= 1024);
    window.addEventListener("resize", h);
    return () => window.removeEventListener("resize", h);
  }, []);

  const showPC = isWide && !isSidebar;
  const tier   = TIERS.find(t => t.id === selId);
  const fee    = tier ? Math.round(tier.value * FEE) : 0;
  const net    = tier ? tier.value - fee : 0;

  const flash = useCallback((msg, color = "#84cc16") => {
    setToast({ msg, color });
    setTimeout(() => setToast(null), 2800);
  }, []);

  // Load data
  useEffect(() => {
    if (!currentUser?.id) {
      setMyCards([
        { code: "GC-X4K2-9M7R-XEEVIA", tier: "gold",         status: "unused", value_ep: 500,  price_usd: 5   },
        { code: "GC-B3Z9-8N5P-XEEVIA", tier: "blue_diamond", status: "sent",   value_ep: 1500, price_usd: 15  },
        { code: "GC-LION-0001-XEEVIA", tier: "lion",          status: "unused", value_ep: 50000,price_usd: 500 },
      ]);
      setInbox([
        { code: "GC-DEMO-0001-XEEVIA", tier: "gold",         status: "sent", value_ep: 500,  has_song: false, senderUsername: "sproutsking", occasion: "Well Done 🌟", message: "You built something real. Keep going. The world needs this." },
        { code: "GC-DEMO-0002-XEEVIA", tier: "make_a_wish",  status: "sent", value_ep: 100000, has_song: false, senderUsername: "xeevia_official", occasion: "Milestone 🏆", message: "Close your eyes. Make a wish. It's already yours." },
      ]);
      return;
    }
    const load = async () => {
      setLoadingCards(true);
      try {
        const { data: p } = await supabase.from("profiles").select("engagement_points").eq("id", currentUser.id).single();
        if (p) setCurrentEP(Number(p.engagement_points || 0));
        const { data: sent } = await supabase.from("gift_cards").select("*").eq("sender_id", currentUser.id).order("created_at", { ascending: false }).limit(20);
        setMyCards(sent || []);
        const { data: recv } = await supabase.from("gift_cards").select("*, sender:sender_id(username,full_name)").eq("recipient_id", currentUser.id).in("status", ["sent", "unused"]).order("created_at", { ascending: false }).limit(20);
        setInbox((recv || []).map(c => ({ ...c, senderUsername: c.sender?.username || "someone" })));
      } catch (e) { console.error(e); } finally { setLoadingCards(false); }
    };
    load();
  }, [currentUser?.id]);

  const reset = useCallback(() => {
    setPhase("browse"); setSelId(null); setOccasion(""); setMessage("");
    setRecipient(null); setSong(null); setGenCode(""); setBurstDone(false); setEpError("");
  }, []);

  const switchTab = useCallback((k) => { setTab(k); if (k !== "send") reset(); }, [reset]);

  // Buy / send flow
  const handleBuy = async () => {
    if (!tier) return;
    setEpError("");
    if (phase === "browse")    { setPhase("configure"); return; }
    if (phase === "configure") {
      if (!recipient) { flash("Select a recipient first", "#f97316"); return; }
      setPhase("confirm"); setBurstDone(false); return;
    }
    if (phase === "confirm") {
      setLoading(true);
      try {
        if (!currentUser?.id) throw new Error("Not authenticated");
        const nb = await deductEP(currentUser.id, tier.value, `Gift card: ${tier.name} → @${recipient.username}`);
        setCurrentEP(nb);
        const code = GCODE();

        // Upload song if attached
        let hasSong = false;
        if (song && song.file) {
          try {
            const { data: urlData } = await supabase.functions.invoke("gift-song-upload-url", {
              body: { card_code: code, filename: song.file.name, content_type: song.file.type, size_bytes: song.file.size },
            });
            if (urlData?.upload_url) {
              await fetch(urlData.upload_url, { method: "PUT", body: song.file, headers: { "Content-Type": song.file.type } });
              const ret = getSongRetention(currentUser.subscription_tier || "free");
              await supabase.from("gift_card_songs").insert({
                card_code: code, r2_key: urlData.r2_key, playback_url: urlData.playback_url,
                original_filename: song.name, retention_days: ret.db,
                expires_at: ret.db ? new Date(Date.now() + ret.db * 86400000).toISOString() : null,
                created_at: new Date().toISOString(),
              });
              hasSong = true;
            }
          } catch (songErr) { console.warn("Song upload failed:", songErr); }
        } else if (song?.isRequest) {
          await supabase.from("gift_card_song_requests").insert({ card_code: code, request_text: song.name, sender_id: currentUser.id, status: "pending", created_at: new Date().toISOString() }).catch(() => {});
          hasSong = true;
        }

        // Create gift card record
        const { error: gcErr } = await supabase.from("gift_cards").insert({
          code, tier: tier.id, value_ep: tier.value, price_usd: tier.price,
          fee_ep: fee, net_ep: net, sender_id: currentUser.id, recipient_id: recipient.id,
          message: message || null, occasion: occasion || null, status: "sent", has_song: hasSong,
          expires_at: new Date(Date.now() + 90 * 86400000).toISOString(),
          created_at: new Date().toISOString(),
        });
        if (gcErr) throw new Error(gcErr.message);

        // Notify recipient
        supabase.from("notifications").insert({ recipient_user_id: recipient.id, actor_user_id: currentUser.id, type: "payment_confirmed", entity_id: null, message: `@${currentUser.username || "Someone"} sent you a ${tier.name} gift card! 🎁`, metadata: { gift_code: code, tier: tier.id, value: tier.value, has_song: hasSong } }).catch(() => {});

        setMyCards(prev => [{ code, tier: tier.id, value_ep: tier.value, price_usd: tier.price, status: "sent", has_song: hasSong, created_at: new Date().toISOString() }, ...prev]);
        setGenCode(code);
        setPhase("success");
        flash(`${tier.name} sent to @${recipient.username}! 🎁`, tier.c1);
      } catch (err) {
        setEpError(err.message || "Something went wrong.");
        flash(err.message || "Transaction failed", "#f87171");
      } finally { setLoading(false); }
    }
  };

  const handleRedeem = async () => {
    if (!redCode.trim()) return;
    setRedState("loading");
    try {
      const code = redCode.trim().toUpperCase();
      const { data: gc, error: gcErr } = await supabase.from("gift_cards").select("*").eq("code", code).single();
      if (gcErr || !gc) { setRedState("invalid"); return; }
      if (gc.status === "redeemed")     { setRedState("used");       return; }
      if (gc.status === "expired" || (gc.expires_at && new Date(gc.expires_at) < new Date())) { setRedState("expired"); return; }
      if (gc.recipient_id && gc.recipient_id !== currentUser?.id) { setRedState("wrong_user"); return; }
      const netAmt = gc.net_ep || (gc.value_ep - gc.fee_ep);
      if (currentUser?.id) { const nb = await creditEP(currentUser.id, netAmt, `Redemption: ${code}`); setCurrentEP(nb); }
      await supabase.from("gift_cards").update({ status: "redeemed", redeemed_by: currentUser?.id, redeemed_at: new Date().toISOString() }).eq("code", code);
      setRedState("success");
      flash(`🎉 +${netAmt.toLocaleString()} EP added to your balance!`, "#22c55e");
    } catch (err) { setRedState("error"); flash(err.message || "Redemption failed", "#f87171"); }
  };

  const claimInbox = useCallback((card, netEP) => {
    flash(`+${netEP.toLocaleString()} EP claimed! 🎉`, TIERS.find(t => t.id === card.tier)?.c1 || "#22c55e");
    setInbox(prev => prev.map(c => c.code === card.code ? { ...c, status: "redeemed" } : c));
    setCurrentEP(prev => prev !== null ? prev + netEP : prev);
  }, [flash]);

  const newInbox   = inbox.filter(c => c.status === "sent" || c.status === "unused").length;
  const mobileTitle = tab === "send"
    ? (phase === "browse" ? "Gift Cards" : phase === "configure" ? tier?.name || "Configure" : phase === "confirm" ? "Confirm" : "Gift Sent! 🎁")
    : (tab === "redeem" ? "Redeem Card" : tab === "inbox" ? "Gift Inbox" : "My Cards");

  // ── Send Tab ──
  const renderSend = () => (
    <>
      {phase === "browse" && (
        <>
          <p style={{ fontSize: 11, color: "#383838", margin: "4px 0 16px", lineHeight: 1.75 }}>
            Choose a gem tier. Cards arrive as sealed gift boxes — recipient bursts them open to reveal your message & song.
          </p>
          {TIERS.map((t, i) => {
            const sel  = selId === t.id;
            const isLg = t.id === "lion" || t.id === "lioness" || t.id === "make_a_wish";
            return (
              <div key={t.id} className="gc-tier" onClick={() => setSelId(sel ? null : t.id)}
                style={{
                  borderRadius: isLg ? 18 : 16, marginBottom: isLg ? 11 : 9, cursor: "pointer",
                  border: `1.5px solid ${sel ? t.c1 + "55" : isLg ? t.c1 + "22" : "rgba(255,255,255,0.06)"}`,
                  background: sel ? `${t.c1}0a` : isLg ? `${t.c1}04` : "rgba(255,255,255,0.018)",
                  boxShadow: sel ? `0 10px 32px ${t.glow}, 0 1px 0 ${t.c1}12 inset` : isLg ? `0 4px 16px ${t.glow}20` : "0 1px 0 rgba(255,255,255,0.03) inset",
                  position: "relative", overflow: "hidden",
                  animation: `gcCardIn .3s ease ${i * 0.045}s both`,
                  transform: sel ? "translateY(-3px)" : "none",
                }}>
                {/* Top edge line */}
                <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 1, background: `linear-gradient(90deg,transparent,${sel ? t.c1 + "50" : isLg ? t.c1 + "30" : "rgba(255,255,255,0.05)"},transparent)`, pointerEvents: "none" }} />

                <div style={{ display: "flex", alignItems: "center", gap: 13, padding: isLg ? "15px 15px" : "13px 14px" }}>
                  {/* Icon */}
                  <div style={{ width: isLg ? 54 : 50, height: isLg ? 54 : 50, borderRadius: isLg ? 16 : 15, flexShrink: 0, background: `linear-gradient(135deg,${t.c1}22,${t.c2}0e)`, border: `1.5px solid ${t.c1}3a`, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: sel ? `0 0 24px ${t.glow}` : isLg ? `0 4px 16px ${t.glow}50` : "none", transition: "box-shadow .2s" }}>
                    {getTierIcon(t, isLg ? 26 : 23)}
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 4, flexWrap: "wrap" }}>
                      <span style={{ fontSize: isLg ? 15 : 14, fontWeight: 900, color: "#fff", fontFamily: isLg ? "'Cinzel',serif" : undefined }}>{t.name}</span>
                      <span style={{ padding: isLg ? "2px 9px" : "2px 8px", borderRadius: 6, background: `${t.c1}18`, color: t.c1, border: `1px solid ${t.c1}30`, fontSize: isLg ? 10 : 9, fontWeight: 900 }}>{t.badge}</span>
                    </div>
                    <div style={{ fontSize: 11, color: "#383838", marginBottom: 6, lineHeight: 1.45 }}>{t.desc}</div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ fontSize: isLg ? 16 : 15, fontWeight: 900, color: t.c1 }}>${t.price.toLocaleString()}</span>
                      <span style={{ color: "#282828" }}>·</span>
                      <Zap size={9} color="#484848" />
                      <span style={{ fontSize: 11, color: "#484848", fontWeight: 700 }}>{t.value.toLocaleString()} EP</span>
                      <span style={{ fontSize: 9, color: "#252525" }}>· 2% fee</span>
                    </div>
                  </div>

                  <div style={{ width: 22, height: 22, borderRadius: 7, border: `1.5px solid ${sel ? t.c1 : "rgba(255,255,255,0.06)"}`, display: "flex", alignItems: "center", justifyContent: "center", background: sel ? `${t.c1}18` : "transparent", transition: "all .18s", flexShrink: 0 }}>
                    {sel && <CheckCircle size={14} color={t.c1} style={{ animation: "gcPop .25s ease" }} />}
                  </div>
                </div>

                {/* Make A Wish ambient streak */}
                {t.id === "make_a_wish" && (
                  <div style={{ position: "absolute", top: "50%", right: 60, width: 1, height: "60%", transform: "translateY(-50%) rotate(20deg)", background: `linear-gradient(180deg,transparent,${t.c1}40,transparent)`, pointerEvents: "none", animation: "gcPulse 2s ease infinite" }} />
                )}
              </div>
            );
          })}

          {tier && currentEP !== null && currentEP < tier.value && (
            <div style={{ display: "flex", alignItems: "center", gap: 9, padding: "11px 13px", background: "rgba(248,113,113,0.06)", border: "1px solid rgba(248,113,113,0.2)", borderRadius: 12, marginBottom: 12, animation: "gcReveal .3s ease" }}>
              <AlertCircle size={13} color="#f87171" />
              <span style={{ fontSize: 11, color: "#f87171", fontWeight: 700 }}>Insufficient EP — you have {currentEP.toLocaleString()} EP, need {tier.value.toLocaleString()} EP.</span>
            </div>
          )}

          <button onClick={handleBuy} disabled={!selId || (tier && currentEP !== null && currentEP < tier.value)} className="gc-btn"
            style={{ width: "100%", padding: "14px", marginTop: 10, borderRadius: 14, border: "none", background: (selId && !(tier && currentEP !== null && currentEP < tier.value)) ? `linear-gradient(135deg,${tier?.c1},${tier?.c2})` : "rgba(255,255,255,0.05)", color: (selId && !(tier && currentEP !== null && currentEP < tier.value)) ? "#000" : "#303030", fontSize: 14, fontWeight: 900, cursor: (selId && !(tier && currentEP !== null && currentEP < tier.value)) ? "pointer" : "not-allowed", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, boxShadow: selId ? `0 8px 28px ${tier?.glow}` : "none", fontFamily: "inherit" }}>
            <Send size={14} /> Continue
          </button>
        </>
      )}

      {phase === "configure" && tier && (
        <>
          {/* Tier summary */}
          <div style={{ display: "flex", alignItems: "center", gap: 13, padding: "13px 15px", background: `${tier.c1}08`, border: `1px solid ${tier.c1}24`, borderRadius: 16, marginBottom: 20 }}>
            <div style={{ width: 44, height: 44, borderRadius: 13, background: `${tier.c1}18`, border: `1px solid ${tier.c1}2a`, display: "flex", alignItems: "center", justifyContent: "center" }}>{getTierIcon(tier, 22)}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 900, color: "#fff", fontFamily: (tier.id === "lion" || tier.id === "lioness" || tier.id === "make_a_wish") ? "'Cinzel',serif" : undefined }}>{tier.name}</div>
              <div style={{ fontSize: 11, color: "#444" }}>{tier.value.toLocaleString()} EP · ${tier.price.toLocaleString()}</div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 9, color: "#333", marginBottom: 2 }}>They receive</div>
              <div style={{ fontSize: 14, fontWeight: 900, color: tier.c1 }}>{net.toLocaleString()} EP</div>
              <div style={{ fontSize: 9, color: "#2a2a2a" }}>−2% fee</div>
            </div>
          </div>

          <UserSearch onSelect={setRecipient} selected={recipient} currentUser={currentUser} />

          {/* Occasion */}
          <div style={{ fontSize: 10, fontWeight: 800, color: "#2a2a2a", textTransform: "uppercase", letterSpacing: "1px", marginBottom: 9 }}>Occasion</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 18 }}>
            {OCCASIONS.map(o => (
              <button key={o} className="gc-occ" onClick={() => setOccasion(occasion === o ? "" : o)}
                style={{ padding: "6px 12px", borderRadius: 9, background: occasion === o ? `${tier.c1}14` : "rgba(255,255,255,0.04)", border: `1px solid ${occasion === o ? tier.c1 + "3a" : "rgba(255,255,255,0.07)"}`, color: occasion === o ? tier.c1 : "#484848", fontSize: 11, fontWeight: 700, fontFamily: "inherit" }}>
                {o}
              </button>
            ))}
          </div>

          {/* Message */}
          <div style={{ fontSize: 10, fontWeight: 800, color: "#2a2a2a", textTransform: "uppercase", letterSpacing: "1px", marginBottom: 9 }}>Message</div>
          <textarea value={message} onChange={e => setMessage(e.target.value)} rows={3} maxLength={220}
            placeholder="Write a message that appears when they burst the box open…"
            style={{ width: "100%", padding: "12px 13px", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 13, color: "#fff", fontSize: 13, outline: "none", resize: "none", caretColor: "#84cc16", fontFamily: "inherit", lineHeight: 1.65, marginBottom: 5, boxSizing: "border-box" }} />
          <div style={{ fontSize: 10, color: "#252525", textAlign: "right", marginBottom: 18 }}>{message.length}/220</div>

          {/* Song Attachment */}
          <SongPanel tier={tier} song={song} setSong={setSong} senderSubTier={currentUser?.subscription_tier || "free"} />

          <button onClick={handleBuy} disabled={!recipient} className="gc-btn"
            style={{ width: "100%", padding: "14px", borderRadius: 14, border: "none", background: recipient ? `linear-gradient(135deg,${tier.c1},${tier.c2})` : "rgba(255,255,255,0.05)", color: recipient ? "#000" : "#303030", fontSize: 14, fontWeight: 900, cursor: recipient ? "pointer" : "not-allowed", boxShadow: recipient ? `0 8px 28px ${tier.glow}` : "none", fontFamily: "inherit" }}>
            Preview Gift →
          </button>
        </>
      )}

      {phase === "confirm" && tier && (
        <>
          {/* Interactive preview burst */}
          <div style={{ marginBottom: 16, background: `${tier.c1}06`, border: `1px solid ${tier.c1}1a`, borderRadius: 18, padding: "4px 4px 14px", boxShadow: `0 8px 36px ${tier.glow}20` }}>
            {!burstDone ? (
              <>
                <BurstBox tier={tier} onOpened={() => setBurstDone(true)} />
                <p style={{ textAlign: "center", fontSize: 11, color: "#383838", marginTop: 0 }}>Tap to preview what {recipient?.username || "they"} will see</p>
              </>
            ) : (
              <div style={{ padding: "7px 10px 4px", animation: "gcUnboxZoom .5s cubic-bezier(.34,1.56,.64,1)" }}>
                <CardFace tier={tier} message={message} occasion={occasion} senderName={currentUser?.username || "You"} recipientName={recipient?.username} code="GC-PREVIEW" hasSong={!!song} />
                {song && !song.isRequest && song.localUrl && (
                  <div style={{ marginTop: 10 }}>
                    <SongPlayer url={song.localUrl} title={song.name} tier={tier} compact />
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Summary */}
          <div style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 14, padding: "14px 16px", marginBottom: 14 }}>
            {[
              ["To",           `@${recipient?.username}`,           "#888"],
              ["Card Value",   `${tier.value.toLocaleString()} EP`, tier.c1],
              ["Protocol Fee", `−${fee} EP (2%)`,                   "#3a3a3a"],
            ].map(([l, v, c]) => (
              <div key={l} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#555", marginBottom: 8 }}>
                <span>{l}</span><span style={{ color: c, fontWeight: 700 }}>{v}</span>
              </div>
            ))}
            {song && <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#555", marginBottom: 8 }}>
              <span>Song</span><span style={{ color: "#38bdf8", fontWeight: 700 }}>🎵 {song.isRequest ? `Requested: "${song.name}"` : song.name}</span>
            </div>}
            <div style={{ height: 1, background: "rgba(255,255,255,0.05)", margin: "5px 0 9px" }} />
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, fontWeight: 900 }}>
              <span style={{ color: "#777" }}>They receive</span><span style={{ color: tier.c1 }}>{net.toLocaleString()} EP</span>
            </div>
            {currentEP !== null && <>
              <div style={{ height: 1, background: "rgba(255,255,255,0.04)", margin: "8px 0" }} />
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11 }}>
                <span style={{ color: "#444" }}>Your EP after</span><span style={{ color: "#555", fontWeight: 700 }}>{(currentEP - tier.value).toLocaleString()} EP</span>
              </div>
            </>}
          </div>

          {epError && (
            <div style={{ display: "flex", alignItems: "center", gap: 9, padding: "11px 13px", background: "rgba(248,113,113,0.06)", border: "1px solid rgba(248,113,113,0.2)", borderRadius: 12, marginBottom: 14 }}>
              <AlertCircle size={13} color="#f87171" /><span style={{ fontSize: 12, color: "#f87171", fontWeight: 700 }}>{epError}</span>
            </div>
          )}

          <button onClick={handleBuy} disabled={loading} className="gc-btn"
            style={{ width: "100%", padding: "15px", borderRadius: 14, border: "none", background: `linear-gradient(135deg,${tier.c1},${tier.c2})`, color: "#000", fontSize: 14, fontWeight: 900, cursor: loading ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, boxShadow: `0 8px 30px ${tier.glow}`, opacity: loading ? 0.7 : 1, fontFamily: "inherit" }}>
            {loading ? <Spin size={18} /> : <><Gift size={15} /> Send {tier.value.toLocaleString()} EP Gift Card</>}
          </button>
        </>
      )}

      {phase === "success" && tier && (
        <div style={{ textAlign: "center", padding: "24px 0", animation: "gcSuccess .5s cubic-bezier(.34,1.56,.64,1)" }}>
          <div style={{ fontSize: 76, marginBottom: 16, animation: "gcFloat 2.2s ease-in-out infinite", filter: `drop-shadow(0 8px 24px ${tier.glow})` }}>{tier.emoji}</div>
          <div style={{ fontSize: 24, fontWeight: 900, color: "#fff", marginBottom: 8, letterSpacing: "-0.5px", fontFamily: (tier.id === "lion" || tier.id === "lioness" || tier.id === "make_a_wish") ? "'Cinzel',serif" : undefined }}>Gift Sent!</div>
          <div style={{ fontSize: 13, color: "#555", marginBottom: 24, lineHeight: 1.6 }}>@{recipient?.username} has a sealed box waiting<br />in their inbox.</div>
          <div style={{ marginBottom: 14 }}>
            <CardFace tier={tier} message={message} occasion={occasion} senderName={currentUser?.username || "You"} recipientName={recipient?.username} code={genCode} hasSong={!!song} />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 9, padding: "11px 14px", background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 12, marginBottom: 13 }}>
            <span style={{ flex: 1, fontSize: 11, fontFamily: "monospace", color: "#555", letterSpacing: ".5px", textAlign: "left" }}>{genCode}</span>
            <button onClick={() => { navigator.clipboard?.writeText(genCode).catch(() => {}); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
              style={{ padding: "5px 11px", borderRadius: 8, background: copied ? "rgba(34,197,94,0.1)" : "rgba(255,255,255,0.06)", border: copied ? "1px solid rgba(34,197,94,0.22)" : "1px solid rgba(255,255,255,0.09)", color: copied ? "#22c55e" : "#666", fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
              {copied ? "Copied ✓" : <Copy size={12} />}
            </button>
          </div>
          {currentEP !== null && (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 7, padding: "10px 13px", background: "rgba(251,191,36,0.06)", border: "1px solid rgba(251,191,36,0.15)", borderRadius: 11, marginBottom: 14 }}>
              <Zap size={12} color="#fbbf24" /><span style={{ fontSize: 12, color: "#888" }}>New balance: <span style={{ color: "#fbbf24", fontWeight: 900 }}>{currentEP.toLocaleString()} EP</span></span>
            </div>
          )}
          <button onClick={reset} style={{ width: "100%", padding: "13px", borderRadius: 13, border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.04)", color: "#707070", fontSize: 13, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 7, fontFamily: "inherit" }}>
            <RotateCcw size={13} /> Send Another Gift
          </button>
        </div>
      )}
    </>
  );

  // ── Redeem Tab ──
  const renderRedeem = () => (
    <>
      <p style={{ fontSize: 11, color: "#383838", margin: "4px 0 16px", lineHeight: 1.7 }}>Enter a gift card code to claim EP. 2% protocol fee applied.</p>
      <div style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 18, padding: "16px", marginBottom: 14 }}>
        <div style={{ fontSize: 10, fontWeight: 800, color: "#383838", textTransform: "uppercase", letterSpacing: "1px", marginBottom: 11 }}>Gift Code</div>
        <input value={redCode} onChange={e => { setRedCode(e.target.value.toUpperCase()); setRedState("idle"); }} placeholder="GC-XXXX-XXXX-XEEVIA"
          style={{ width: "100%", padding: "13px 14px", marginBottom: 12, background: "rgba(255,255,255,0.04)", border: `1px solid ${["error","invalid","used","expired","wrong_user"].includes(redState) ? "rgba(248,113,113,0.4)" : redState === "success" ? "rgba(34,197,94,0.3)" : "rgba(255,255,255,0.09)"}`, borderRadius: 12, color: "#fff", fontSize: 14, outline: "none", caretColor: "#38bdf8", fontFamily: "monospace", letterSpacing: ".5px", transition: "border .2s", boxSizing: "border-box" }} />
        <button onClick={handleRedeem} disabled={!redCode.trim() || redState === "loading"}
          style={{ width: "100%", padding: "13px", borderRadius: 12, border: "none", background: redCode.trim() ? "linear-gradient(135deg,#38bdf8,#0284c7)" : "rgba(255,255,255,0.05)", color: redCode.trim() ? "#000" : "#383838", fontSize: 13, fontWeight: 900, cursor: redCode.trim() ? "pointer" : "not-allowed", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, fontFamily: "inherit" }}>
          {redState === "loading" ? <Spin size={16} /> : <><Zap size={14} /> Redeem EP</>}
        </button>
        {redState === "success" && <div style={{ marginTop: 11, display: "flex", alignItems: "center", gap: 9, padding: "11px 13px", background: "rgba(34,197,94,0.06)", border: "1px solid rgba(34,197,94,0.18)", borderRadius: 11, animation: "gcReveal .4s ease" }}><CheckCircle size={15} color="#22c55e" /><div><div style={{ fontSize: 12, color: "#22c55e", fontWeight: 800 }}>Redeemed! EP added to your balance (−2% fee).</div>{currentEP !== null && <div style={{ fontSize: 10, color: "#22c55e", opacity: 0.7, marginTop: 2 }}>New balance: {currentEP.toLocaleString()} EP</div>}</div></div>}
        {["error","invalid"].includes(redState) && <div style={{ marginTop: 11, padding: "11px 13px", background: "rgba(248,113,113,0.05)", border: "1px solid rgba(248,113,113,0.18)", borderRadius: 11 }}><span style={{ fontSize: 12, color: "#f87171", fontWeight: 800 }}>Invalid or expired code. Please check and try again.</span></div>}
        {redState === "used" && <div style={{ marginTop: 11, padding: "11px 13px", background: "rgba(248,113,113,0.05)", border: "1px solid rgba(248,113,113,0.18)", borderRadius: 11 }}><span style={{ fontSize: 12, color: "#f87171", fontWeight: 800 }}>This code has already been redeemed.</span></div>}
        {redState === "expired" && <div style={{ marginTop: 11, padding: "11px 13px", background: "rgba(248,113,113,0.05)", border: "1px solid rgba(248,113,113,0.18)", borderRadius: 11 }}><span style={{ fontSize: 12, color: "#f87171", fontWeight: 800 }}>This gift card has expired.</span></div>}
        {redState === "wrong_user" && <div style={{ marginTop: 11, padding: "11px 13px", background: "rgba(251,191,36,0.05)", border: "1px solid rgba(251,191,36,0.18)", borderRadius: 11 }}><span style={{ fontSize: 12, color: "#fbbf24", fontWeight: 800 }}>This card was sent to someone else.</span></div>}
      </div>
      <div style={{ padding: "13px 15px", background: "rgba(255,255,255,0.018)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: 13 }}>
        <div style={{ fontSize: 10, color: "#2a2a2a", fontWeight: 700, marginBottom: 7, textTransform: "uppercase", letterSpacing: "1px" }}>Demo Code</div>
        <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
          <span style={{ fontSize: 12, fontFamily: "monospace", color: "#484848", flex: 1 }}>GC-X4K2-9M7R-XEEVIA</span>
          <button onClick={() => { setRedCode("GC-X4K2-9M7R-XEEVIA"); setRedState("idle"); }} style={{ padding: "5px 11px", borderRadius: 8, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", color: "#555", fontSize: 10, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>Use</button>
        </div>
      </div>
    </>
  );

  // ── Inbox Tab ──
  const renderInbox = () => (
    <>
      <p style={{ fontSize: 11, color: "#383838", margin: "4px 0 14px", lineHeight: 1.7 }}>Tap the box to burst it open and claim your EP. Songs play automatically after opening.</p>
      {loadingCards && <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "40px", gap: 10 }}><Spin size={18} color="#38bdf8" /><span style={{ fontSize: 12, color: "#404040" }}>Loading inbox…</span></div>}
      {!loadingCards && inbox.length === 0 && (
        <div style={{ textAlign: "center", padding: "56px 20px", opacity: 0.4 }}>
          <div style={{ fontSize: 56, marginBottom: 14, animation: "gcFloat 2.5s ease-in-out infinite" }}>🎁</div>
          <div style={{ fontSize: 13, color: "#444", lineHeight: 1.7 }}>No gifts yet.<br />Share your profile so people can send you gems.</div>
        </div>
      )}
      {inbox.map(card => <InboxCard key={card.code} card={card} onClaim={claimInbox} currentUser={currentUser} />)}
    </>
  );

  // ── My Cards Tab ──
  const renderMyCards = () => (
    <>
      <p style={{ fontSize: 11, color: "#383838", margin: "4px 0 14px", lineHeight: 1.7 }}>Your gift card history. Unused cards can be sent.</p>
      {loadingCards && <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "40px", gap: 10 }}><Spin size={18} color="#38bdf8" /><span style={{ fontSize: 12, color: "#404040" }}>Loading…</span></div>}
      {!loadingCards && myCards.length === 0 && <div style={{ textAlign: "center", padding: "56px 20px", opacity: 0.4 }}><Package size={44} color="#2a2a2a" style={{ margin: "0 auto 14px", display: "block" }} /><div style={{ fontSize: 13, color: "#444" }}>No cards yet.</div></div>}
      {myCards.map((gc, i) => {
        const t = TIERS.find(x => x.id === gc.tier) || TIERS[0];
        const unused = gc.status === "unused";
        const sc = { unused: "#484848", sent: "#38bdf8", redeemed: "#22c55e", expired: "#f87171" }[gc.status] || "#484848";
        return (
          <div key={gc.code || gc.id} style={{ display: "flex", alignItems: "center", gap: 13, padding: "13px 14px", background: "rgba(255,255,255,0.025)", border: `1px solid ${unused ? t.c1 + "22" : "rgba(255,255,255,0.05)"}`, borderRadius: 15, marginBottom: 9, animation: `gcCardIn .3s ease ${i * 0.06}s both` }}>
            <div style={{ width: 44, height: 44, borderRadius: 13, flexShrink: 0, background: `${t.c1}18`, border: `1px solid ${t.c1}28`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>{t.emoji.split("")[0]}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: "#fff", marginBottom: 2, fontFamily: (t.id === "lion" || t.id === "lioness" || t.id === "make_a_wish") ? "'Cinzel',serif" : undefined }}>{t.name}</div>
              <div style={{ fontSize: 10, color: "#2a2a2a", fontFamily: "monospace", letterSpacing: ".4px" }}>{gc.code}</div>
              {gc.has_song && <div style={{ display: "inline-flex", alignItems: "center", gap: 4, marginTop: 3 }}><Music size={8} color="#484848" /><span style={{ fontSize: 8, color: "#404040" }}>Song attached</span></div>}
            </div>
            <div style={{ textAlign: "right", flexShrink: 0, marginRight: unused ? 8 : 0 }}>
              <div style={{ fontSize: 13, fontWeight: 900, color: t.c1 }}>{(gc.value_ep || t.value).toLocaleString()} EP</div>
              <div style={{ fontSize: 9, color: sc, textTransform: "uppercase", letterSpacing: ".5px", marginTop: 2 }}>{gc.status}</div>
            </div>
            {unused && (
              <div style={{ display: "flex", flexDirection: "column", gap: 5, flexShrink: 0 }}>
                <button onClick={() => { switchTab("send"); setSelId(gc.tier); setPhase("configure"); }} style={{ padding: "5px 10px", borderRadius: 7, fontSize: 10, fontWeight: 800, background: "rgba(132,204,22,0.1)", border: "1px solid rgba(132,204,22,0.22)", color: "#84cc16", cursor: "pointer", fontFamily: "inherit" }}>Send</button>
                <button onClick={() => { switchTab("redeem"); setRedCode(gc.code); }} style={{ padding: "5px 10px", borderRadius: 7, fontSize: 10, fontWeight: 800, background: "rgba(56,189,248,0.1)", border: "1px solid rgba(56,189,248,0.22)", color: "#38bdf8", cursor: "pointer", fontFamily: "inherit" }}>Redeem</button>
              </div>
            )}
          </div>
        );
      })}
      <button onClick={() => switchTab("send")} style={{ width: "100%", padding: "13px", marginTop: 4, borderRadius: 13, border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.025)", color: "#707070", fontSize: 13, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 7, fontFamily: "inherit" }}>
        <Plus size={13} /> Buy New Gift Card
      </button>
    </>
  );

  const renderTab = () => {
    if (tab === "send")     return renderSend();
    if (tab === "redeem")   return renderRedeem();
    if (tab === "inbox")    return renderInbox();
    if (tab === "my_cards") return renderMyCards();
  };

  // ── RENDER ──
  return (
    <div style={{
      display: "flex", flexDirection: "column",
      background: "#050505",
      fontFamily: "-apple-system,BlinkMacSystemFont,'SF Pro Display','Segoe UI',sans-serif",
      color: "#fff", overflow: "hidden",
      ...(isSidebar ? { height: "100%", borderLeft: "1px solid rgba(255,255,255,0.06)" } : { position: "fixed", inset: 0, zIndex: 9500 }),
    }}>
      <style>{CSS}</style>

      {/* HEADER */}
      <div style={{ display: "flex", alignItems: "center", gap: 11, padding: "14px 16px 10px", background: "rgba(5,5,5,0.96)", backdropFilter: "blur(28px)", borderBottom: "1px solid rgba(255,255,255,0.06)", flexShrink: 0, boxShadow: "0 1px 0 rgba(255,255,255,0.03)", zIndex: 10 }}>
        {!showPC && phase !== "browse" && tab === "send"
          ? <button onClick={reset} style={{ width: 36, height: 36, borderRadius: 11, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.09)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#707070", flexShrink: 0 }}><ArrowLeft size={15} /></button>
          : <button onClick={onClose} style={{ width: 36, height: 36, borderRadius: 11, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.09)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#707070", flexShrink: 0 }}><X size={15} /></button>
        }
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 18, fontWeight: 900, color: "#fff", letterSpacing: "-0.4px" }}>{showPC ? "Gift Cards" : mobileTitle}</div>
          <div style={{ fontSize: 10, color: "#2e2e2e", marginTop: 1 }}>Precious gems for precious people</div>
        </div>
        {!showPC && currentEP !== null && (
          <div style={{ display: "flex", alignItems: "center", gap: 5, padding: "5px 11px", background: "rgba(251,191,36,0.08)", border: "1px solid rgba(251,191,36,0.18)", borderRadius: 9 }}>
            <Zap size={10} color="#fbbf24" /><span style={{ fontSize: 11, fontWeight: 900, color: "#fbbf24" }}>{currentEP.toLocaleString()}</span>
          </div>
        )}
        <div style={{ width: 36, height: 36, borderRadius: 11, background: "rgba(56,189,248,0.1)", border: "1px solid rgba(56,189,248,0.18)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Gift size={16} color="#38bdf8" />
        </div>
      </div>

      {/* MOBILE TABS */}
      {!showPC && (
        <div style={{ display: "flex", gap: 6, padding: "10px 16px", flexShrink: 0, background: "rgba(5,5,5,0.7)", backdropFilter: "blur(10px)", borderBottom: "1px solid rgba(255,255,255,0.04)", overflowX: "auto" }}>
          {[{ k: "send", l: "Send" }, { k: "redeem", l: "Redeem" }, { k: "inbox", l: newInbox > 0 ? `Inbox ${newInbox}` : "Inbox", dot: newInbox > 0 }, { k: "my_cards", l: "Cards" }].map(({ k, l, dot }) => {
            const active = tab === k;
            return (
              <button key={k} onClick={() => switchTab(k)} style={{ padding: "6px 15px", borderRadius: 100, position: "relative", border: `1px solid ${active ? "rgba(56,189,248,0.36)" : "rgba(255,255,255,0.07)"}`, background: active ? "rgba(56,189,248,0.12)" : "rgba(255,255,255,0.025)", color: active ? "#38bdf8" : "#484848", boxShadow: active ? "0 2px 14px rgba(56,189,248,0.28)" : "none", fontSize: 11, fontWeight: active ? 800 : 600, cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0, transition: "all .18s", fontFamily: "inherit" }}>
                {l}{dot && <span style={{ position: "absolute", top: 3, right: 5, width: 6, height: 6, borderRadius: "50%", background: "#f87171", animation: "gcPulse 1.5s ease infinite" }} />}
              </button>
            );
          })}
        </div>
      )}

      {/* BODY */}
      {showPC ? (
        <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
          <PCLeftSidebar tab={tab} onTab={switchTab} newInbox={newInbox} currentEP={currentEP} />
          <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", minWidth: 0 }}>
            {tab === "send" && phase !== "browse" && (
              <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "12px 20px 0", flexShrink: 0 }}>
                <button onClick={reset} style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 9, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "#555", fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}><ArrowLeft size={12} /> Back</button>
                <span style={{ fontSize: 11, color: "#2a2a2a" }}>→</span>
                <span style={{ fontSize: 11, color: "#555", fontWeight: 600 }}>{phase === "configure" ? "Configure Gift" : phase === "confirm" ? "Confirm & Send" : "Sent! 🎁"}</span>
              </div>
            )}
            <div className="gc-scroll" style={{ flex: 1, overflowY: "auto", padding: "16px 20px 40px" }}>{renderTab()}</div>
          </div>
          {tab === "send" && <PCRightPanel tier={tier} message={message} occasion={occasion} senderName={currentUser?.username || "You"} recipientName={recipient?.username} song={song} />}
        </div>
      ) : (
        <div className="gc-scroll" style={{ flex: 1, overflowY: "auto", padding: "12px 16px 100px" }}>{renderTab()}</div>
      )}

      {toast && <Toast msg={toast.msg} color={toast.color} />}
    </div>
  );
};

export default GiftCardsView;