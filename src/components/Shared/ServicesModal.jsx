// src/components/Shared/ServicesModal.jsx — v2 MOBILE_FULLSCREEN
// ============================================================================
// CHANGES vs v1:
//  [FIX-1] Mobile full screen: on ≤768px the panel extends to 100dvh with
//          0 border radius and no rounding — true fullscreen sheet.
//  [FIX-2] NO auto-focus on open. The search input is rendered normally but
//          not focused on mount. User must tap/click it to activate the
//          keyboard. Removed the `setTimeout(() => inputRef.focus(), 150)`.
//  [FIX-3] Saved button now calls `onOpenSaved()` prop if provided instead
//          of navigating to a tab. Parent controls the SavedContentModal.
//  [FIX-4] Added `data-oracle` attribute on Oracle tile for special hover glow.
//  [FIX-5] Correct section rendering even on tiny phones by capping grid at
//          4 cols on ≥360px, 3 cols on very narrow screens.
// ============================================================================

import React, { useEffect, useState, useRef, useMemo } from "react";
import {
  X, Zap, Home, Search, Users, Wallet, TrendingUp, Hash,
  Gift, BarChart2, BookMarked, UserCog, HelpCircle, Settings,
  Radio, CreditCard, Sparkles, ChevronRight,
} from "lucide-react";
import XRCOracleExplorer from "../Oracle/XRCOracleExplorer";

// ── Oracle icon ───────────────────────────────────────────────────────────────
const OracleIcon = () => <span style={{ fontSize: 16, lineHeight: 1 }}>⛓</span>;

// ── Service definitions ───────────────────────────────────────────────────────
const ALL_SERVICES = [
  // Navigate
  { id:"home",      Icon:Home,       label:"Home",       color:"#84cc16", bg:"rgba(132,204,22,0.1)",  section:"Navigate", desc:"Your feed"         },
  { id:"search",    Icon:Search,     label:"Explore",    color:"#60a5fa", bg:"rgba(96,165,250,0.1)",  section:"Navigate", desc:"Discover content"  },
  { id:"community", Icon:Users,      label:"Community",  color:"#a78bfa", bg:"rgba(167,139,250,0.1)", section:"Navigate", desc:"Your communities"  },
  { id:"wallet",    Icon:Wallet,     label:"Wallet",     color:"#fbbf24", bg:"rgba(251,191,36,0.1)",  section:"Navigate", desc:"GT & EP balance"   },
  // Discover
  { id:"oracle",    Icon:OracleIcon, label:"XRC Oracle", color:"#a855f7", bg:"rgba(168,85,247,0.12)", section:"Discover", desc:"Chain explorer"    },
  { id:"trending",  Icon:TrendingUp, label:"Trending",   color:"#f97316", bg:"rgba(249,115,22,0.1)",  section:"Discover", desc:"What's hot now"    },
  { id:"tags",      Icon:Hash,       label:"Tags",       color:"#34d399", bg:"rgba(52,211,153,0.1)",  section:"Discover", desc:"Browse by tag"     },
  { id:"stream",    Icon:Radio,      label:"Stream",     color:"#fb7185", bg:"rgba(251,113,133,0.1)", section:"Discover", desc:"Go live"           },
  { id:"analytics", Icon:BarChart2,  label:"Analytics",  color:"#818cf8", bg:"rgba(129,140,248,0.1)", section:"Discover", desc:"Your stats"        },
  // Account
  { id:"saved",     Icon:BookMarked, label:"Saved",      color:"#fbbf24", bg:"rgba(251,191,36,0.1)",  section:"Account",  desc:"Bookmarked items"  },
  { id:"profile",   Icon:UserCog,    label:"Profile",    color:"#84cc16", bg:"rgba(132,204,22,0.1)",  section:"Account",  desc:"Edit your profile" },
  { id:"rewards",   Icon:Gift,       label:"Rewards",    color:"#f472b6", bg:"rgba(244,114,182,0.1)", section:"Account",  desc:"Earn & redeem"     },
  { id:"upgrade",   Icon:Sparkles,   label:"Upgrade",    color:"#fbbf24", bg:"rgba(251,191,36,0.12)", section:"Account",  desc:"Boost profile"     },
  // More
  { id:"giftcards", Icon:CreditCard, label:"Gift Cards", color:"#34d399", bg:"rgba(52,211,153,0.1)",  section:"More",     desc:"Buy & send gifts"  },
  { id:"support",   Icon:HelpCircle, label:"Support",    color:"#60a5fa", bg:"rgba(96,165,250,0.1)",  section:"More",     desc:"Get help"          },
  { id:"settings",  Icon:Settings,   label:"Settings",   color:"#a3a3a3", bg:"rgba(163,163,163,0.1)", section:"More",     desc:"Preferences"       },
];
const SECTIONS = ["Navigate", "Discover", "Account", "More"];

function resolveTab(id) {
  const map = {
    home:"home", search:"search", community:"community", wallet:"wallet",
    trending:"trending", tags:"search", stream:"stream", analytics:"analytics",
    profile:"account", rewards:"rewards", upgrade:"upgrade",
    giftcards:"giftcards", support:"support", settings:"account",
    // "saved" and "oracle" are handled specially — they open modals
  };
  return map[id] || id;
}

const ServicesModal = ({ onClose, setActiveTab, currentUser, xrcService, onOpenSaved }) => {
  const [visible,    setVisible]    = useState(false);
  const [query,      setQuery]      = useState("");
  const [hovered,    setHovered]    = useState(null);
  const [showOracle, setShowOracle] = useState(false);
  // [FIX-2] inputRef is kept for potential programmatic focus but NOT auto-focused
  const inputRef = useRef(null);
  const panelRef = useRef(null);

  // [FIX-1] Detect mobile
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);

  // Animate in — [FIX-2] removed auto-focus
  useEffect(() => {
    const t = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(t);
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
    setVisible(false);
    setTimeout(onClose, 290);
  };

  const navigate = (id) => {
    // [FIX-3] "saved" opens SavedContentModal via prop
    if (id === "saved") {
      setVisible(false);
      setTimeout(() => {
        if (typeof onOpenSaved === "function") {
          onOpenSaved();
        } else {
          setActiveTab("account"); // fallback
        }
      }, 210);
      return;
    }
    // Oracle opens its own fullscreen overlay
    if (id === "oracle") {
      setVisible(false);
      setTimeout(() => setShowOracle(true), 210);
      return;
    }
    setVisible(false);
    setTimeout(() => setActiveTab(resolveTab(id)), 210);
  };

  const renderItem = (svc, idx) => (
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
        @keyframes smBgIn   { from{opacity:0} to{opacity:1} }
        @keyframes smPanIn  { from{opacity:0;transform:translateY(100%) scale(0.96)} to{opacity:1;transform:translateY(0) scale(1)} }
        @keyframes smPanOut { from{opacity:1;transform:translateY(0) scale(1)} to{opacity:0;transform:translateY(55%) scale(0.95)} }
        @keyframes smItemIn { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
        @keyframes smGlowPulse { 0%,100%{opacity:.4} 50%{opacity:1} }

        .sm-bg { position:fixed;inset:0;background:rgba(0,0,0,0.72);backdrop-filter:blur(14px);z-index:9000;animation:smBgIn 0.22s ease;transition:opacity 0.28s; }
        .sm-bg.out { opacity:0; }

        /* [FIX-1] Panel — bottom sheet default, fullscreen on mobile */
        .sm-panel {
          position:fixed;bottom:0;left:0;right:0;z-index:9001;
          background:#0a0a0a;
          border-top:1px solid rgba(132,204,22,0.2);
          border-radius:24px 24px 0 0;
          padding:0 0 calc(88px + env(safe-area-inset-bottom));
          max-height:88vh;
          overflow-y:auto;
          animation:smPanIn 0.32s cubic-bezier(0.34,1.12,0.64,1) both;
        }
        .sm-panel.out { animation:smPanOut 0.26s ease forwards; }
        .sm-panel::-webkit-scrollbar { display:none; }

        /* [FIX-1] TRUE FULLSCREEN on mobile */
        @media (max-width: 768px) {
          .sm-panel {
            top:0;
            border-radius:0;
            max-height:100dvh;
            height:100dvh;
            padding-bottom:calc(80px + env(safe-area-inset-bottom));
          }
          .sm-handle { display:none; }
        }

        .sm-handle { display:flex;justify-content:center;padding:12px 0 4px; }
        .sm-handle-bar { width:36px;height:4px;border-radius:2px;background:rgba(255,255,255,0.1); }

        .sm-glow-line { height:1px;margin:0 44px 2px;background:linear-gradient(90deg,transparent,rgba(132,204,22,0.5),transparent);animation:smGlowPulse 3s ease-in-out infinite; }

        /* Header */
        .sm-hdr { display:flex;align-items:center;justify-content:space-between;padding:8px 20px 12px; }
        .sm-hdr-l { display:flex;align-items:center;gap:10px; }
        .sm-hdr-icon { width:32px;height:32px;border-radius:10px;background:rgba(132,204,22,0.1);border:1px solid rgba(132,204,22,0.2);display:flex;align-items:center;justify-content:center; }
        .sm-hdr-title { font-size:17px;font-weight:900;color:#fff;letter-spacing:-.2px; }
        .sm-close { width:32px;height:32px;border-radius:10px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.08);display:flex;align-items:center;justify-content:center;cursor:pointer;color:#525252;transition:all 0.18s; }
        .sm-close:hover { background:rgba(255,255,255,0.1);color:#fff; }

        /* [FIX-2] Search — no autoFocus, user must tap */
        .sm-search-wrap { padding:0 16px 14px; }
        .sm-search-box {
          display:flex;align-items:center;gap:10px;
          background:rgba(255,255,255,0.04);
          border:1px solid rgba(255,255,255,0.09);
          border-radius:14px;padding:11px 14px;
          transition:border-color 0.2s,background 0.2s;
        }
        .sm-search-box:focus-within { border-color:rgba(132,204,22,0.38);background:rgba(132,204,22,0.03); }
        .sm-si { color:#525252;flex-shrink:0; }
        .sm-inp {
          flex:1;background:transparent;border:none;outline:none;
          color:#fff;font-size:14px;font-weight:500;caret-color:#84cc16;
        }
        .sm-inp::placeholder { color:#333; }
        .sm-clr { background:rgba(255,255,255,0.07);border:none;border-radius:6px;width:22px;height:22px;display:flex;align-items:center;justify-content:center;cursor:pointer;color:#525252;transition:all 0.18s;flex-shrink:0; }
        .sm-clr:hover { background:rgba(255,255,255,0.14);color:#fff; }

        /* Search results */
        .sm-res { padding:0 16px; }
        .sm-res-lbl { font-size:9.5px;font-weight:800;color:#383838;text-transform:uppercase;letter-spacing:1.2px;margin-bottom:8px;padding:0 2px; }
        .sm-no-res { text-align:center;padding:32px 20px;color:#383838;font-size:13px;font-weight:600; }

        /* Sections */
        .sm-secs { padding:0 16px;display:flex;flex-direction:column;gap:20px; }
        .sm-sec-lbl { font-size:9.5px;font-weight:800;color:#383838;text-transform:uppercase;letter-spacing:1.2px;padding:0 4px;margin-bottom:8px; }
        .sm-grid { display:grid;grid-template-columns:repeat(4,1fr);gap:8px; }

        @media (max-width: 340px) {
          .sm-grid { grid-template-columns:repeat(3,1fr); }
        }

        /* Item */
        .sm-item {
          display:flex;flex-direction:column;align-items:center;
          gap:6px;padding:13px 6px;
          border-radius:15px;border:1px solid rgba(255,255,255,0.05);
          background:rgba(255,255,255,0.025);
          cursor:pointer;position:relative;
          transition:all 0.22s cubic-bezier(0.34,1.4,0.64,1);
          animation:smItemIn 0.28s ease both;
          -webkit-tap-highlight-color:transparent;
        }
        .sm-item:active { transform:scale(0.86)!important; }
        .sm-item:hover {
          background:var(--bg);
          border-color:color-mix(in srgb,var(--c) 28%,transparent);
          transform:translateY(-3px) scale(1.04);
          box-shadow:0 8px 22px rgba(0,0,0,0.32);
        }
        .sm-item-icon { width:38px;height:38px;border-radius:12px;display:flex;align-items:center;justify-content:center;transition:transform 0.2s; }
        .sm-item:hover .sm-item-icon { transform:scale(1.1); }
        .sm-item-label { font-size:9.5px;font-weight:700;color:#4a4a4a;text-align:center;transition:color 0.2s;white-space:nowrap; }
        .sm-item:hover .sm-item-label { color:#a3a3a3; }

        .sm-item[data-oracle="true"]:hover {
          border-color:rgba(168,85,247,0.4);
          box-shadow:0 8px 22px rgba(168,85,247,0.2);
        }
      `}</style>

      <div className={`sm-bg${!visible ? " out" : ""}`} onClick={close} />

      <div ref={panelRef} className={`sm-panel${!visible ? " out" : ""}`}>
        <div className="sm-handle"><div className="sm-handle-bar" /></div>
        <div className="sm-glow-line" />

        {/* Header */}
        <div className="sm-hdr">
          <div className="sm-hdr-l">
            <div className="sm-hdr-icon"><Zap size={15} color="#84cc16" /></div>
            <span className="sm-hdr-title">Services</span>
          </div>
          <button className="sm-close" onClick={close}><X size={14} /></button>
        </div>

        {/* [FIX-2] Search — NO autoFocus. User taps to focus. */}
        <div className="sm-search-wrap">
          <div className="sm-search-box">
            <Search size={15} className="sm-si" />
            <input
              ref={inputRef}
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

        {/* Results OR sections */}
        {filtered ? (
          <div className="sm-res">
            <p className="sm-res-lbl">
              {filtered.length} result{filtered.length !== 1 ? "s" : ""} for "{query}"
            </p>
            {filtered.length > 0
              ? <div className="sm-grid">{filtered.map((s, i) => renderItem(s, i))}</div>
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
                  <div className="sm-grid">{items.map((s, i) => renderItem(s, i))}</div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Oracle fullscreen overlay */}
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