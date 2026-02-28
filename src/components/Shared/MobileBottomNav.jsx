// src/components/Shared/MobileBottomNav.jsx — v5
// Active state: clean bordered pill matching PayWave nav style
// No translateY lift — avoids top-edge rub
// FAB: hidden by default, slides in on any scroll/touch, auto-hides 6s

import React, { useState, useEffect, useRef, useCallback } from "react";
import { Home, Search, LayoutGrid, Users, Wallet } from "lucide-react";
import ServicesModal from "./ServicesModal";

const NAV_ITEMS = [
  { id: "home",      Icon: Home,       label: "Home"      },
  { id: "search",    Icon: Search,     label: "Explore"   },
  { id: "menu",      Icon: LayoutGrid, label: "Menu",     isMenu: true },
  { id: "community", Icon: Users,      label: "Community" },
  { id: "wallet",    Icon: Wallet,     label: "Wallet"    },
];

const MobileBottomNav = ({ activeTab, setActiveTab, currentUser }) => {
  const [showServices, setShowServices] = useState(false);
  const [fabVisible,   setFabVisible]   = useState(false);
  const timerRef = useRef(null);

  const triggerFab = useCallback(() => {
    setFabVisible(true);
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setFabVisible(false), 6000);
  }, []);

  useEffect(() => {
    const evts = ["scroll","touchstart","touchmove","mousemove","wheel","keydown","pointerdown"];
    evts.forEach(e => window.addEventListener(e, triggerFab, { passive: true }));
    return () => {
      evts.forEach(e => window.removeEventListener(e, triggerFab));
      clearTimeout(timerRef.current);
    };
  }, [triggerFab]);

  return (
    <>
      <style>{`
        /* ── Container ── */
        .mbn {
          position: fixed;
          bottom: 0; left: 0; right: 0;
          z-index: 100;
          background: rgba(5,5,5,0.98);
          backdrop-filter: blur(28px);
          -webkit-backdrop-filter: blur(28px);
          padding: 6px 8px calc(8px + env(safe-area-inset-bottom));
          border-top: 1px solid rgba(255,255,255,0.06);
        }

        /* ── Subtle top accent line ── */
        .mbn::before {
          content: '';
          position: absolute;
          top: 0; left: 0; right: 0;
          height: 1px;
          background: linear-gradient(
            90deg,
            transparent 0%,
            rgba(132,204,22,0.06) 20%,
            rgba(132,204,22,0.18) 50%,
            rgba(132,204,22,0.06) 80%,
            transparent 100%
          );
        }

        /* ── Row ── */
        .mbn-row {
          display: flex;
          align-items: center;
          justify-content: space-around;
          max-width: 600px;
          margin: 0 auto;
          padding: 0;
          gap: 4px;
        }

        /* ── Button shell ── */
        .mbn-btn {
          display: flex;
          flex-direction: column;
          align-items: center;
          background: transparent;
          border: none;
          cursor: pointer;
          flex: 1;
          min-width: 0;
          padding: 0;
          position: relative;
          -webkit-tap-highlight-color: transparent;
          outline: none;
        }

        /* ── Pill ── */
        .mbn-pill {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 3px;
          padding: 6px 16px 5px;
          border-radius: 12px;
          border: 1px solid transparent;
          width: 100%;
          transition:
            background 0.2s ease,
            border-color 0.2s ease,
            box-shadow 0.2s ease,
            color 0.2s ease;
          will-change: background, border-color;
        }

        /* ── ACTIVE pill — clean bordered, no lift ── */
        .mbn-btn.is-active .mbn-pill {
          background: rgba(132,204,22,0.09);
          border-color: rgba(132,204,22,0.22);
          box-shadow:
            0 2px 12px rgba(132,204,22,0.12),
            inset 0 1px 0 rgba(132,204,22,0.1);
        }

        /* Active top glow bar — sits on the nav border, not the pill */
        .mbn-btn.is-active::before {
          content: '';
          position: absolute;
          top: -7px;
          left: 50%;
          transform: translateX(-50%);
          width: 24px;
          height: 2px;
          background: linear-gradient(90deg, transparent, #84cc16, transparent);
          border-radius: 0 0 3px 3px;
          box-shadow: 0 0 10px 1px rgba(132,204,22,0.6);
          animation: mbnBarPulse 2.8s ease-in-out infinite;
        }
        @keyframes mbnBarPulse {
          0%,100% { width: 18px; opacity: 0.65; }
          50%      { width: 30px; opacity: 1;    }
        }

        /* Press feedback */
        .mbn-btn:active .mbn-pill {
          transform: scale(0.93);
          transition: transform 0.08s ease;
        }

        /* ── Icon ── */
        .mbn-ico {
          display: flex;
          align-items: center;
          justify-content: center;
          color: #333;
          transition: color 0.2s ease, filter 0.2s ease;
        }
        .mbn-btn.is-active .mbn-ico {
          color: #84cc16;
          filter: drop-shadow(0 0 6px rgba(132,204,22,0.55));
        }

        /* ── Label ── */
        .mbn-lbl {
          font-size: 9px;
          font-weight: 700;
          letter-spacing: 0.3px;
          white-space: nowrap;
          line-height: 1;
          color: #2e2e2e;
          transition: color 0.2s ease;
        }
        .mbn-btn.is-active .mbn-lbl {
          color: #84cc16;
          text-shadow: 0 0 8px rgba(132,204,22,0.4);
        }

        /* ── Pulse dot ── */
        .mbn-dot {
          width: 3px;
          height: 3px;
          border-radius: 50%;
          background: #84cc16;
          box-shadow: 0 0 5px rgba(132,204,22,0.9);
          animation: mbnDot 2s ease-in-out infinite;
          margin-top: 1px;
        }
        @keyframes mbnDot {
          0%,100% { transform: scale(1);   opacity: 0.7; }
          50%      { transform: scale(1.8); opacity: 1;   }
        }

        /* ── MENU button ── */
        .mbn-menu-pill {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 3px;
          padding: 6px 16px 5px;
          border-radius: 12px;
          border: 1px solid transparent;
          width: 100%;
          transition: background 0.2s ease, border-color 0.2s ease;
          cursor: pointer;
        }
        .mbn-menu-pill.open {
          background: rgba(255,255,255,0.05);
          border-color: rgba(255,255,255,0.1);
        }
        .mbn-menu-btn:active .mbn-menu-pill {
          transform: scale(0.93);
          transition: transform 0.08s ease;
        }

        /* 2×2 grid icon */
        .mbn-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 3.5px;
          width: 16px;
          height: 16px;
        }
        .mbn-grid span {
          border-radius: 2.5px;
          background: #333;
          transition: background 0.2s ease, transform 0.2s ease;
        }
        .mbn-menu-pill.open .mbn-grid span { background: #555; }
        .mbn-menu-btn:hover .mbn-grid span:nth-child(1) { transform: scale(0.75); }
        .mbn-menu-btn:hover .mbn-grid span:nth-child(4) { transform: scale(0.75); }
        .mbn-menu-btn:hover .mbn-grid span:nth-child(2) { transform: scale(1.2);  }
        .mbn-menu-btn:hover .mbn-grid span:nth-child(3) { transform: scale(1.2);  }

        .mbn-menu-lbl {
          font-size: 9px;
          font-weight: 700;
          color: #2e2e2e;
          letter-spacing: 0.3px;
          transition: color 0.2s ease;
        }
        .mbn-menu-pill.open .mbn-menu-lbl { color: #555; }

        /* ── FAB ── */
        .mbn-fab {
          position: fixed;
          bottom: calc(76px + env(safe-area-inset-bottom));
          right: 16px;
          z-index: 201;
          width: 50px;
          height: 50px;
          border-radius: 16px;
          background: linear-gradient(145deg, #84cc16 0%, #4a7c0a 100%);
          border: none;
          color: #000;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          box-shadow: 0 8px 28px rgba(132,204,22,0.5), 0 2px 8px rgba(0,0,0,0.55);
          opacity: 0;
          transform: scale(0.35) translateY(18px);
          transition:
            opacity 0.38s cubic-bezier(0.34,1.56,0.64,1),
            transform 0.38s cubic-bezier(0.34,1.56,0.64,1),
            box-shadow 0.2s;
          pointer-events: none;
          -webkit-tap-highlight-color: transparent;
          overflow: visible;
        }
        .mbn-fab.fab-show {
          opacity: 1;
          transform: scale(1) translateY(0);
          pointer-events: auto;
        }
        .mbn-fab:hover {
          transform: scale(1.1) translateY(-3px) !important;
          box-shadow: 0 14px 36px rgba(132,204,22,0.6), 0 4px 12px rgba(0,0,0,0.4);
        }
        .mbn-fab:active { transform: scale(0.9) !important; }

        .mbn-fab-ring {
          position: absolute;
          inset: -6px;
          border-radius: 22px;
          border: 1.5px solid rgba(132,204,22,0.25);
          animation: mbnRing 2.8s ease-in-out infinite;
          pointer-events: none;
        }
        @keyframes mbnRing {
          0%,100% { opacity: 0.5; transform: scale(1);    }
          50%      { opacity: 0;   transform: scale(1.35); }
        }

        /* ── Tiny screens ── */
        @media (max-width: 340px) {
          .mbn-lbl, .mbn-menu-lbl { display: none; }
          .mbn-pill, .mbn-menu-pill { padding: 9px 10px 7px; }
        }
      `}</style>

      <nav className="mbn">
        <div className="mbn-row">
          {NAV_ITEMS.map(({ id, Icon, label, isMenu }) => {
            if (isMenu) return (
              <button
                key={id}
                className="mbn-btn mbn-menu-btn"
                onClick={() => setShowServices(true)}
                aria-label="Services"
              >
                <div className={`mbn-menu-pill${showServices ? " open" : ""}`}>
                  <div className="mbn-grid">
                    <span/><span/><span/><span/>
                  </div>
                  <span className="mbn-menu-lbl">Menu</span>
                </div>
              </button>
            );

            const active = activeTab === id;
            return (
              <button
                key={id}
                className={`mbn-btn${active ? " is-active" : ""}`}
                onClick={() => setActiveTab(id)}
                aria-label={label}
                aria-current={active ? "page" : undefined}
              >
                <div className="mbn-pill">
                  <span className="mbn-ico">
                    <Icon size={active ? 20 : 19} strokeWidth={active ? 2.4 : 1.8} />
                  </span>
                  <span className="mbn-lbl">{label}</span>
                  {active && <span className="mbn-dot" />}
                </div>
              </button>
            );
          })}
        </div>
      </nav>

      {/* FAB */}
      <button
        className={`mbn-fab${fabVisible ? " fab-show" : ""}`}
        onClick={() => setActiveTab("create")}
        aria-label="Create"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round">
          <line x1="12" y1="5" x2="12" y2="19"/>
          <line x1="5" y1="12" x2="19" y2="12"/>
        </svg>
        <span className="mbn-fab-ring" />
      </button>

      {showServices && (
        <ServicesModal
          onClose={() => setShowServices(false)}
          setActiveTab={(tab) => { setActiveTab(tab); setShowServices(false); }}
          currentUser={currentUser}
        />
      )}
    </>
  );
};

export default MobileBottomNav;