// src/components/Shared/ServicesModal.jsx — v4 DESKTOP_FIXED
// ============================================================================
// FIXES vs v3:
//  [FIX-1] Modal is now truly centered via fixed + transform: translate(-50%,-50%)
//          with NO position conflicts from parent containers.
//  [FIX-2] Desktop grid: 4 columns (not 8) — items are readable and well-sized.
//  [FIX-3] Item labels: color bumped to #a0a0a0 (was #3a3a3a — invisible).
//  [FIX-4] Section labels: color bumped to #555 (was #2e2e2e — invisible).
//  [FIX-5] Modal width: 640px max, not stretching to edges.
//  [FIX-6] Desktop tiles: icon 40px, label 11px, proper contrast.
//  [FIX-7] z-index escalated to 99999 to beat any parent stacking context.
//  [FIX-8] Backdrop covers full viewport regardless of scroll.
//  [FIX-9] Mobile layout preserved exactly.
// ============================================================================

import React, { useEffect, useState, useRef, useMemo } from "react";
import {
  X, Zap, Home, Search, Users, Wallet, TrendingUp, Hash,
  Gift, BarChart2, BookMarked, UserCog, HelpCircle, Settings,
  Radio, CreditCard, Sparkles, ChevronRight,
} from "lucide-react";
import XRCOracleExplorer from "../Oracle/XRCOracleExplorer";

const OracleIcon = () => <span style={{ fontSize: 15, lineHeight: 1 }}>⛓</span>;

const ALL_SERVICES = [
  { id:"home",      Icon:Home,       label:"Home",       color:"#84cc16", bg:"rgba(132,204,22,0.12)",  section:"Navigate", desc:"Your feed"         },
  { id:"search",    Icon:Search,     label:"Explore",    color:"#60a5fa", bg:"rgba(96,165,250,0.12)",  section:"Navigate", desc:"Discover content"  },
  { id:"community", Icon:Users,      label:"Community",  color:"#a78bfa", bg:"rgba(167,139,250,0.12)", section:"Navigate", desc:"Your communities"  },
  { id:"wallet",    Icon:Wallet,     label:"Wallet",     color:"#fbbf24", bg:"rgba(251,191,36,0.12)",  section:"Navigate", desc:"GT & EP balance"   },
  { id:"oracle",    Icon:OracleIcon, label:"XRC Oracle", color:"#a855f7", bg:"rgba(168,85,247,0.14)",  section:"Discover", desc:"Chain explorer"    },
  { id:"trending",  Icon:TrendingUp, label:"Trending",   color:"#f97316", bg:"rgba(249,115,22,0.12)",  section:"Discover", desc:"What's hot now"    },
  { id:"tags",      Icon:Hash,       label:"Tags",       color:"#34d399", bg:"rgba(52,211,153,0.12)",  section:"Discover", desc:"Browse by tag"     },
  { id:"stream",    Icon:Radio,      label:"Stream",     color:"#fb7185", bg:"rgba(251,113,133,0.12)", section:"Discover", desc:"Go live"           },
  { id:"analytics", Icon:BarChart2,  label:"Analytics",  color:"#818cf8", bg:"rgba(129,140,248,0.12)", section:"Discover", desc:"Your stats"        },
  { id:"saved",     Icon:BookMarked, label:"Saved",      color:"#fbbf24", bg:"rgba(251,191,36,0.12)",  section:"Account",  desc:"Bookmarked items"  },
  { id:"profile",   Icon:UserCog,    label:"Profile",    color:"#84cc16", bg:"rgba(132,204,22,0.12)",  section:"Account",  desc:"Edit your profile" },
  { id:"rewards",   Icon:Gift,       label:"Rewards",    color:"#f472b6", bg:"rgba(244,114,182,0.12)", section:"Account",  desc:"Earn & redeem"     },
  { id:"upgrade",   Icon:Sparkles,   label:"Upgrade",    color:"#fbbf24", bg:"rgba(251,191,36,0.14)",  section:"Account",  desc:"Boost profile"     },
  { id:"giftcards", Icon:CreditCard, label:"Gift Cards", color:"#34d399", bg:"rgba(52,211,153,0.12)",  section:"More",     desc:"Buy & send gifts"  },
  { id:"support",   Icon:HelpCircle, label:"Support",    color:"#60a5fa", bg:"rgba(96,165,250,0.12)",  section:"More",     desc:"Get help"          },
  { id:"settings",  Icon:Settings,   label:"Settings",   color:"#a3a3a3", bg:"rgba(163,163,163,0.1)",  section:"More",     desc:"Preferences"       },
];

const SECTIONS = ["Navigate", "Discover", "Account", "More"];

function resolveTab(id) {
  const map = {
    home:"home", search:"search", community:"community", wallet:"wallet",
    trending:"trending", tags:"search", stream:"stream", analytics:"analytics",
    profile:"account", rewards:"rewards", upgrade:"upgrade",
    giftcards:"giftcards", support:"support", settings:"account",
  };
  return map[id] || id;
}

const ServicesModal = ({ onClose, setActiveTab, currentUser, xrcService, onOpenSaved }) => {
  const [closing,    setClosing]    = useState(false);
  const [query,      setQuery]      = useState("");
  const [hovered,    setHovered]    = useState(null);
  const [showOracle, setShowOracle] = useState(false);
  const inputRef = useRef(null);
  const panelRef = useRef(null);
  const resizeTimerRef = useRef(null);
  const closeTimerRef = useRef(null);

  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  useEffect(() => {
    const handleResize = () => {
      // Debounce resize to avoid excessive re-renders
      if (resizeTimerRef.current) clearTimeout(resizeTimerRef.current);
      resizeTimerRef.current = setTimeout(() => {
        setIsMobile(window.innerWidth <= 768);
      }, 150);
    };
    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
      if (resizeTimerRef.current) clearTimeout(resizeTimerRef.current);
    };
  }, []);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      if (document.body.style.overflow === "hidden") {
        document.body.style.overflow = "";
      }
    };
  }, []);

  // Focus search on desktop only
  useEffect(() => {
    if (!isMobile) {
      const t = setTimeout(() => inputRef.current?.focus(), 200);
      return () => clearTimeout(t);
    }
  }, [isMobile]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
      if (resizeTimerRef.current) clearTimeout(resizeTimerRef.current);
      // Ensure scroll is unlocked on unmount
      if (document.body.style.overflow === "hidden") {
        document.body.style.overflow = "";
      }
    };
  }, []);

  const filtered = useMemo(() => {
    if (!query.trim()) return null;
    const q = query.toLowerCase();
    return ALL_SERVICES.filter(s =>
      s.label.toLowerCase().includes(q) ||
      s.desc.toLowerCase().includes(q) ||
      s.section.toLowerCase().includes(q)
    );
  }, [query]);

  const close = () => {
    // Unlock scroll before closing
    if (document.body.style.overflow === "hidden") {
      document.body.style.overflow = "";
    }
    setClosing(true);
    // Clear any pending close timer
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    closeTimerRef.current = setTimeout(onClose, 180);
  };

  const navigate = (id) => {
    if (id === "saved") {
      setActiveTab("account");
      setClosing(true);
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
      closeTimerRef.current = setTimeout(() => {
        if (typeof onOpenSaved === "function") onOpenSaved();
        onClose();
      }, 120);
      return;
    }

    if (id === "oracle") {
      setShowOracle(true);
      setClosing(true);
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
      closeTimerRef.current = setTimeout(onClose, 120);
      return;
    }

    setActiveTab(resolveTab(id));
    setClosing(true);
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    closeTimerRef.current = setTimeout(onClose, 120);
  };

  // ── Desktop tile ──────────────────────────────────────────────────────────
  const renderDesktopItem = (svc, idx) => (
    <button
      key={svc.id}
      className="dsm-item"
      data-oracle={svc.id === "oracle" ? "true" : undefined}
      style={{ "--c": svc.color, "--bg": svc.bg, animationDelay: `${idx * 0.028}s` }}
      onClick={() => navigate(svc.id)}
      onMouseEnter={() => setHovered(svc.id)}
      onMouseLeave={() => setHovered(null)}
    >
      <div className="dsm-icon-wrap" style={{ background: svc.bg, borderColor: `${svc.color}22` }}>
        <svc.Icon size={18} color={svc.color} />
      </div>
      <span className="dsm-label">{svc.label}</span>
    </button>
  );

  // ── Mobile tile ───────────────────────────────────────────────────────────
  const renderMobileItem = (svc, idx) => (
    <button key={svc.id}
      className="sm-item"
      data-oracle={svc.id === "oracle" ? "true" : undefined}
      style={{ "--c": svc.color, "--bg": svc.bg, animationDelay: `${idx * 0.032}s` }}
      onClick={() => navigate(svc.id)}
      onMouseEnter={() => setHovered(svc.id)}
      onMouseLeave={() => setHovered(null)}
    >
      <div className="sm-item-icon" style={{ background: svc.bg, border: `1px solid ${svc.color}28` }}>
        <svc.Icon size={17} color={svc.color} />
      </div>
      <span className="sm-item-label">{svc.label}</span>
      {hovered === svc.id && (
        <ChevronRight size={9} color={svc.color} style={{ position:"absolute", top:7, right:7, opacity:0.7 }} />
      )}
    </button>
  );

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@600;700;800&family=Manrope:wght@500;600;700&display=swap');

        /* ── Animations ──────────────────────────────────────────────────── */
        @keyframes smBgIn      { from{opacity:0} to{opacity:1} }
        @keyframes smBgOut     { from{opacity:1} to{opacity:0} }
        @keyframes dsmPanIn    { from{opacity:0;transform:translate(-50%,-50%) scale(0.96) translateY(8px)} to{opacity:1;transform:translate(-50%,-50%) scale(1) translateY(0)} }
        @keyframes dsmPanOut   { from{opacity:1;transform:translate(-50%,-50%) scale(1)} to{opacity:0;transform:translate(-50%,-50%) scale(0.96) translateY(6px)} }
        @keyframes smPanInMob  { from{opacity:0;transform:translateY(100%) scale(0.96)} to{opacity:1;transform:translateY(0) scale(1)} }
        @keyframes smPanOutMob { from{opacity:1;transform:translateY(0) scale(1)} to{opacity:0;transform:translateY(55%) scale(0.95)} }
        @keyframes smItemIn    { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:translateY(0)} }
        @keyframes smGlowPulse { 0%,100%{opacity:.4} 50%{opacity:1} }

        /* ── Backdrop ────────────────────────────────────────────────────── */
        .dsm-bg {
          position: fixed;
          inset: 0;
          background: rgba(0,0,0,0.08);
          backdrop-filter: blur(2px);
          -webkit-backdrop-filter: blur(2px);
          z-index: 99998;
          animation: smBgIn 0.2s ease;
          transition: opacity 0.28s ease;
        }
        .dsm-bg.out { opacity: 0; }

        /* ══════════════════════════════════════════════════════════════════
           DESKTOP MODAL
        ══════════════════════════════════════════════════════════════════ */
        .dsm-panel {
          /* TRUE center — no parent can affect this */
          position: fixed;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          z-index: 99999;

          width: min(640px, calc(100vw - 40px));
          max-height: min(90vh, 720px);
          overflow: hidden;
          display: flex;
          flex-direction: column;

          background: #111111;
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 18px;
          box-shadow:
            0 0 0 1px rgba(132,204,22,0.08),
            0 24px 60px rgba(0,0,0,0.7),
            0 8px 24px rgba(0,0,0,0.5);

          animation: dsmPanIn 0.22s cubic-bezier(0.34,1.1,0.64,1) both;
          font-family: 'Manrope', sans-serif;
        }
        .dsm-panel.out {
          animation: dsmPanOut 0.22s ease forwards;
        }

        /* Top lime accent line */
        .dsm-top-accent {
          height: 2px;
          flex-shrink: 0;
          background: linear-gradient(90deg, transparent 0%, #84cc16 30%, #a3e635 60%, transparent 100%);
        }

        /* Header */
        .dsm-hdr {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 14px 18px 12px;
          border-bottom: 1px solid rgba(255,255,255,0.06);
          flex-shrink: 0;
        }
        .dsm-hdr-icon {
          width: 30px; height: 30px;
          border-radius: 9px;
          background: rgba(132,204,22,0.1);
          border: 1px solid rgba(132,204,22,0.22);
          display: flex; align-items: center; justify-content: center;
          flex-shrink: 0;
        }
        .dsm-hdr-title {
          font-size: 15px;
          font-weight: 800;
          color: #f0f0f0;
          letter-spacing: -0.2px;
          flex-shrink: 0;
          font-family: 'Syne', sans-serif;
        }

        /* Search bar */
        .dsm-search {
          flex: 1;
          display: flex;
          align-items: center;
          gap: 8px;
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.09);
          border-radius: 10px;
          padding: 7px 11px;
          transition: border-color 0.18s, background 0.18s;
          margin-left: 6px;
        }
        .dsm-search:focus-within {
          border-color: rgba(132,204,22,0.4);
          background: rgba(132,204,22,0.04);
        }
        .dsm-search-inp {
          flex: 1;
          background: transparent;
          border: none;
          outline: none;
          color: #e5e5e5;
          font-size: 13px;
          font-weight: 500;
          caret-color: #84cc16;
          min-width: 0;
          font-family: 'Manrope', sans-serif;
        }
        .dsm-search-inp::placeholder { color: #404040; }
        .dsm-search-clr {
          background: rgba(255,255,255,0.07);
          border: none; border-radius: 5px;
          width: 20px; height: 20px;
          display: flex; align-items: center; justify-content: center;
          cursor: pointer; color: #555;
          transition: all 0.15s; flex-shrink: 0;
        }
        .dsm-search-clr:hover { background: rgba(255,255,255,0.14); color: #fff; }

        /* Close button */
        .dsm-close {
          width: 30px; height: 30px;
          border-radius: 9px; flex-shrink: 0;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.09);
          display: flex; align-items: center; justify-content: center;
          cursor: pointer; color: #555;
          transition: all 0.15s;
        }
        .dsm-close:hover { background: rgba(255,255,255,0.1); color: #fff; border-color: rgba(255,255,255,0.18); }

        /* Scrollable body */
        .dsm-body {
          flex: 1;
          overflow-y: auto;
          padding: 16px 18px 20px;
          display: flex;
          flex-direction: column;
          gap: 16px;
          scrollbar-width: thin;
          scrollbar-color: rgba(255,255,255,0.1) transparent;
        }
        .dsm-body::-webkit-scrollbar { width: 4px; }
        .dsm-body::-webkit-scrollbar-track { background: transparent; }
        .dsm-body::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 2px; }

        /* Section */
        .dsm-section { display: flex; flex-direction: column; gap: 8px; }
        .dsm-sec-label {
          font-size: 9px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 1.4px;
          /* FIX: was #2e2e2e (invisible). Now visible. */
          color: #666666;
          padding: 0 2px;
          font-family: 'Manrope', sans-serif;
        }

        /* Grid: 4 columns — fits 4 items/row, readable at desktop */
        .dsm-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 7px;
        }

        /* Desktop tile */
        .dsm-item {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 7px;
          padding: 13px 8px 11px;
          border-radius: 12px;
          border: 1px solid rgba(255,255,255,0.06);
          background: rgba(255,255,255,0.025);
          cursor: pointer;
          position: relative;
          overflow: hidden;
          transition: all 0.22s cubic-bezier(0.34,1.2,0.64,1);
          animation: smItemIn 0.26s ease both;
          -webkit-tap-highlight-color: transparent;
          outline: none;
        }
        .dsm-item::before {
          content: '';
          position: absolute;
          inset: 0;
          background: var(--bg);
          opacity: 0;
          transition: opacity 0.2s;
        }
        .dsm-item:hover::before { opacity: 1; }
        .dsm-item:hover {
          border-color: color-mix(in srgb, var(--c) 28%, transparent);
          transform: translateY(-2px);
          box-shadow: 0 6px 20px rgba(0,0,0,0.35), 0 0 0 1px color-mix(in srgb, var(--c) 12%, transparent);
        }
        .dsm-item:active { transform: scale(0.93) !important; transition-duration: 0.08s; }
        .dsm-item[data-oracle="true"]:hover {
          border-color: rgba(168,85,247,0.35);
          box-shadow: 0 6px 20px rgba(168,85,247,0.18);
        }

        .dsm-icon-wrap {
          position: relative;
          z-index: 1;
          width: 42px; height: 42px;
          border-radius: 11px;
          border: 1px solid transparent;
          display: flex; align-items: center; justify-content: center;
          transition: transform 0.18s ease;
          flex-shrink: 0;
        }
        .dsm-item:hover .dsm-icon-wrap { transform: scale(1.1); }

        .dsm-label {
          position: relative;
          z-index: 1;
          font-size: 11px;
          font-weight: 700;
          /* FIX: was #3a3a3a (nearly invisible on dark bg). Now legible. */
          color: #888888;
          text-align: center;
          white-space: nowrap;
          transition: color 0.18s;
          font-family: 'Manrope', sans-serif;
          line-height: 1;
        }
        .dsm-item:hover .dsm-label { color: var(--c); }

        /* Search results */
        .dsm-res-label {
          font-size: 9px; font-weight: 800;
          letter-spacing: 1.2px; text-transform: uppercase;
          color: #555; margin-bottom: 4px;
        }
        .dsm-no-res {
          color: #555; font-size: 13px; font-weight: 600;
          padding: 28px 0; text-align: center;
        }

        /* Divider between sections */
        .dsm-divider {
          height: 1px;
          background: rgba(255,255,255,0.05);
        }

        /* ══════════════════════════════════════════════════════════════════
           MOBILE BOTTOM SHEET — preserved from v2/v3
        ══════════════════════════════════════════════════════════════════ */
        .sm-bg {
          position: fixed; inset: 0;
          background: rgba(0,0,0,0.08);
          backdrop-filter: blur(2px);
          -webkit-backdrop-filter: blur(2px);
          z-index: 99998;
          animation: smBgIn 0.2s ease;
          transition: opacity 0.28s;
        }
        .sm-bg.out { opacity: 0; }

        .sm-panel {
          position: fixed; bottom: 0; left: 0; right: 0;
          z-index: 99999;
          background: #0a0a0a;
          border-top: 1px solid rgba(132,204,22,0.2);
          border-radius: 24px 24px 0 0;
          padding: 0 0 calc(88px + env(safe-area-inset-bottom));
          max-height: 88vh; overflow-y: auto;
          animation: smPanInMob 0.22s cubic-bezier(0.34,1.12,0.64,1) both;
        }
        .sm-panel.out { animation: smPanOutMob 0.22s ease forwards; }
        .sm-panel::-webkit-scrollbar { display: none; }

        @media (max-width: 768px) {
          .sm-panel { top: 0; border-radius: 0; max-height: 100dvh; height: 100dvh; padding-bottom: calc(80px + env(safe-area-inset-bottom)); }
          .sm-handle { display: none; }
        }

        .sm-handle { display: flex; justify-content: center; padding: 12px 0 4px; }
        .sm-handle-bar { width: 36px; height: 4px; border-radius: 2px; background: rgba(255,255,255,0.1); }
        .sm-glow-line { height: 1px; margin: 0 44px 2px; background: linear-gradient(90deg, transparent, rgba(132,204,22,0.5), transparent); animation: smGlowPulse 3s ease-in-out infinite; }
        .sm-hdr { display: flex; align-items: center; justify-content: space-between; padding: 8px 20px 12px; }
        .sm-hdr-l { display: flex; align-items: center; gap: 10px; }
        .sm-hdr-icon { width: 32px; height: 32px; border-radius: 10px; background: rgba(132,204,22,0.1); border: 1px solid rgba(132,204,22,0.2); display: flex; align-items: center; justify-content: center; }
        .sm-hdr-title { font-size: 17px; font-weight: 900; color: #fff; letter-spacing: -.2px; font-family: 'Syne', sans-serif; }
        .sm-close { width: 32px; height: 32px; border-radius: 10px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.08); display: flex; align-items: center; justify-content: center; cursor: pointer; color: #525252; transition: all 0.18s; }
        .sm-close:hover { background: rgba(255,255,255,0.1); color: #fff; }
        .sm-search-wrap { padding: 0 16px 14px; }
        .sm-search-box { display: flex; align-items: center; gap: 10px; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.09); border-radius: 14px; padding: 11px 14px; transition: border-color 0.2s, background 0.2s; }
        .sm-search-box:focus-within { border-color: rgba(132,204,22,0.38); background: rgba(132,204,22,0.03); }
        .sm-si { color: #525252; flex-shrink: 0; }
        .sm-inp { flex: 1; background: transparent; border: none; outline: none; color: #fff; font-size: 14px; font-weight: 500; caret-color: #84cc16; font-family: 'Manrope', sans-serif; }
        .sm-inp::placeholder { color: #333; }
        .sm-clr { background: rgba(255,255,255,0.07); border: none; border-radius: 6px; width: 22px; height: 22px; display: flex; align-items: center; justify-content: center; cursor: pointer; color: #525252; transition: all 0.18s; flex-shrink: 0; }
        .sm-clr:hover { background: rgba(255,255,255,0.14); color: #fff; }
        .sm-res { padding: 0 16px; }
        .sm-res-lbl { font-size: 9.5px; font-weight: 800; color: #555; text-transform: uppercase; letter-spacing: 1.2px; margin-bottom: 8px; padding: 0 2px; }
        .sm-no-res { text-align: center; padding: 32px 20px; color: #444; font-size: 13px; font-weight: 600; }
        .sm-secs { padding: 0 16px; display: flex; flex-direction: column; gap: 20px; }
        .sm-sec-lbl { font-size: 9.5px; font-weight: 800; color: #555; text-transform: uppercase; letter-spacing: 1.2px; padding: 0 4px; margin-bottom: 8px; }
        .sm-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; }
        @media (max-width: 340px) { .sm-grid { grid-template-columns: repeat(3, 1fr); } }
        .sm-item { display: flex; flex-direction: column; align-items: center; gap: 6px; padding: 13px 6px; border-radius: 15px; border: 1px solid rgba(255,255,255,0.05); background: rgba(255,255,255,0.025); cursor: pointer; position: relative; transition: all 0.22s cubic-bezier(0.34,1.4,0.64,1); animation: smItemIn 0.26s ease both; -webkit-tap-highlight-color: transparent; }
        .sm-item:active { transform: scale(0.86) !important; }
        .sm-item:hover { background: var(--bg); border-color: color-mix(in srgb, var(--c) 28%, transparent); transform: translateY(-3px) scale(1.04); box-shadow: 0 8px 22px rgba(0,0,0,0.32); }
        .sm-item-icon { width: 38px; height: 38px; border-radius: 12px; display: flex; align-items: center; justify-content: center; transition: transform 0.2s; }
        .sm-item:hover .sm-item-icon { transform: scale(1.1); }
        .sm-item-label { font-size: 9.5px; font-weight: 700; color: #666; text-align: center; transition: color 0.2s; white-space: nowrap; }
        .sm-item:hover .sm-item-label { color: #a3a3a3; }
        .sm-item[data-oracle="true"]:hover { border-color: rgba(168,85,247,0.4); box-shadow: 0 8px 22px rgba(168,85,247,0.2); }
      `}</style>

      {/* ── DESKTOP ── */}
      {!isMobile && (
        <>
          <div className={`dsm-bg${closing ? " out" : ""}`} onClick={close} />
          <div className={`dsm-panel${closing ? " out" : ""}`} ref={panelRef}>
            <div className="dsm-top-accent" />

            {/* Header */}
            <div className="dsm-hdr">
              <div className="dsm-hdr-icon"><Zap size={14} color="#84cc16" /></div>
              <span className="dsm-hdr-title">Services</span>
              <div className="dsm-search">
                <Search size={13} color="#404040" style={{ flexShrink: 0 }} />
                <input
                  ref={inputRef}
                  className="dsm-search-inp"
                  placeholder="Search services…"
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  autoComplete="off"
                />
                {query && (
                  <button className="dsm-search-clr" onClick={() => setQuery("")}>
                    <X size={10} />
                  </button>
                )}
              </div>
              <button className="dsm-close" onClick={close}><X size={13} /></button>
            </div>

            {/* Body */}
            <div className="dsm-body">
              {filtered ? (
                <>
                  <p className="dsm-res-label">
                    {filtered.length} result{filtered.length !== 1 ? "s" : ""} for "{query}"
                  </p>
                  {filtered.length > 0
                    ? <div className="dsm-grid">{filtered.map((s, i) => renderDesktopItem(s, i))}</div>
                    : <div className="dsm-no-res">No services found</div>
                  }
                </>
              ) : (
                SECTIONS.map((sec, si) => {
                  const items = ALL_SERVICES.filter(s => s.section === sec);
                  return (
                    <React.Fragment key={sec}>
                      {si > 0 && <div className="dsm-divider" />}
                      <div className="dsm-section">
                        <p className="dsm-sec-label">{sec}</p>
                        <div className="dsm-grid">
                          {items.map((s, i) => renderDesktopItem(s, i))}
                        </div>
                      </div>
                    </React.Fragment>
                  );
                })
              )}
            </div>
          </div>
        </>
      )}

      {/* ── MOBILE BOTTOM SHEET ── */}
      {isMobile && (
        <>
          <div className={`sm-bg${closing ? " out" : ""}`} onClick={close} />
          <div ref={panelRef} className={`sm-panel${closing ? " out" : ""}`}>
            <div className="sm-handle"><div className="sm-handle-bar" /></div>
            <div className="sm-glow-line" />
            <div className="sm-hdr">
              <div className="sm-hdr-l">
                <div className="sm-hdr-icon"><Zap size={15} color="#84cc16" /></div>
                <span className="sm-hdr-title">Services</span>
              </div>
              <button className="sm-close" onClick={close}><X size={14} /></button>
            </div>
            <div className="sm-search-wrap">
              <div className="sm-search-box">
                <Search size={15} className="sm-si" />
                <input
                  className="sm-inp"
                  placeholder="Search services…"
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  autoFocus={false}
                  autoComplete="off"
                />
                {query && (
                  <button className="sm-clr" onClick={() => setQuery("")}>
                    <X size={11} />
                  </button>
                )}
              </div>
            </div>
            {filtered ? (
              <div className="sm-res">
                <p className="sm-res-lbl">
                  {filtered.length} result{filtered.length !== 1 ? "s" : ""} for "{query}"
                </p>
                {filtered.length > 0
                  ? <div className="sm-grid">{filtered.map((s, i) => renderMobileItem(s, i))}</div>
                  : <div className="sm-no-res">No services found for "{query}"</div>
                }
              </div>
            ) : (
              <div className="sm-secs">
                {SECTIONS.map(sec => {
                  const items = ALL_SERVICES.filter(s => s.section === sec);
                  return (
                    <div key={sec}>
                      <p className="sm-sec-lbl">{sec}</p>
                      <div className="sm-grid">{items.map((s, i) => renderMobileItem(s, i))}</div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}

      {showOracle && (
        <XRCOracleExplorer
          onClose={() => setShowOracle(false)}
          xrcService={xrcService}
          currentUser={currentUser}
        />
      )}
    </>
  );
};

export default ServicesModal;