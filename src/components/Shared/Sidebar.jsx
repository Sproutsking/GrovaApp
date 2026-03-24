// src/components/Shared/Sidebar.jsx
import React, { useState } from "react";
import { Home, Search, PlusSquare, Wallet, Users, LayoutGrid } from "lucide-react";
import Logo from "./Assets/Logo.png";
import ServicesModal from "./ServicesModal";

const Sidebar = ({
  activeTab,
  setActiveTab,
  sidebarOpen,
  setSidebarOpen,
  onSignOut,
  user,
  currentUser,
}) => {
  const [hoveredItem, setHoveredItem] = useState(null);
  const [showServices, setShowServices] = useState(false);

  // Normal user navigation - NO admin items
  const navItems = [
    { id: "home",      icon: Home,       label: "Home"      },
    { id: "search",    icon: Search,     label: "Explore"   },
    { id: "create",    icon: PlusSquare, label: "Create"    },
    { id: "community", icon: Users,      label: "Community" },
    { id: "wallet",    icon: Wallet,     label: "Wallet"    },
    { id: "menu",      icon: LayoutGrid, label: "Menu", isMenu: true },
  ];

  const handleNavClick = (id) => setActiveTab(id);

  return (
    <>
      <div className="sidebar">

        {/* ── Ambient bg (unchanged structure) ── */}
        <div className="ambient-bg">
          <div className="ambient-orb orb-1" />
          <div className="ambient-orb orb-2" />
          <div className="ambient-orb orb-3" />
          <div className="ambient-noise" />
        </div>

        {/* ── Glass container (unchanged structure) ── */}
        <div className="glass-container">

          {/* Logo */}
          <div className="logo-section">
            <div className="logo-backdrop" />

            {/* Spinning border ring around the logo mark */}
            <div className="logo-ring-wrap">
              <svg className="logo-ring-svg" viewBox="0 0 64 64">
                <circle cx="32" cy="32" r="29" fill="none"
                  stroke="url(#ringGrad)" strokeWidth="1.5"
                  strokeDasharray="40 142" strokeLinecap="round" />
                <defs>
                  <linearGradient id="ringGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%"   stopColor="#84cc16" stopOpacity="0" />
                    <stop offset="40%"  stopColor="#a3e635" stopOpacity="1" />
                    <stop offset="100%" stopColor="#84cc16" stopOpacity="0" />
                  </linearGradient>
                </defs>
              </svg>
              <div className="logo-wrapper">
                <div className="logo-pulse" />
                <div className="logo-icon">
                  <img
                    src={Logo}
                    alt="Xeevia"
                    className="logo-image"
                    onError={(e) => {
                      e.target.style.display = "none";
                      e.target.parentElement.innerHTML =
                        '<span style="font-size:28px;font-weight:900;color:#000;">X</span>';
                    }}
                  />
                </div>
              </div>
            </div>

            <div className="logo-text">
              <h1>XEEVIA</h1>
              <p>Every Word Seeds Value</p>
            </div>
          </div>

          {/* Nav section label */}
          <div className="nav-section-label">
            <span className="nav-label-line" />
            <span className="nav-label-text">NAVIGATION</span>
            <span className="nav-label-line" />
          </div>

          {/* Nav */}
          <nav className="nav-container">
            {navItems.map((item, idx) => {
              const Icon     = item.icon;
              const isActive = activeTab === item.id;
              const isHovered = hoveredItem === item.id;

              if (item.isMenu) {
                return (
                  <button
                    key={item.id}
                    onClick={() => setShowServices(true)}
                    onMouseEnter={() => setHoveredItem(item.id)}
                    onMouseLeave={() => setHoveredItem(null)}
                    className="nav-item"
                    style={{ animationDelay: `${idx * 0.05}s` }}
                    aria-label="Open menu"
                  >
                    <div className={`item-glass${isHovered ? " item-glass-active" : ""}`} />
                    <div className="icon-container">
                      <div className={`icon-halo${isHovered ? " icon-halo-visible" : ""}`} />
                      <Icon size={20} strokeWidth={2} />
                    </div>
                    <span className="item-label">{item.label}</span>
                    {isHovered && <div className="hover-shimmer" />}
                  </button>
                );
              }

              return (
                <button
                  key={item.id}
                  onClick={() => handleNavClick(item.id)}
                  onMouseEnter={() => setHoveredItem(item.id)}
                  onMouseLeave={() => setHoveredItem(null)}
                  className={`nav-item${isActive ? " nav-item-active" : ""}`}
                  style={{ animationDelay: `${idx * 0.05}s` }}
                >
                  <div className={`item-glass${isActive || isHovered ? " item-glass-active" : ""}`} />
                  {isActive && (
                    <>
                      <div className="active-beam" />
                      <div className="active-glow" />
                      <div className="active-dot" />
                    </>
                  )}
                  <div className="icon-container">
                    <div className={`icon-halo${isActive || isHovered ? " icon-halo-visible" : ""}`} />
                    <Icon size={20} strokeWidth={isActive ? 2.5 : 2} />
                  </div>
                  <span className="item-label">{item.label}</span>
                  {isHovered && !isActive && <div className="hover-shimmer" />}
                </button>
              );
            })}
          </nav>

          {/* Footer */}
          <div className="footer-section">
            <div className="footer-glass" />
            <div className="social-grid">
              <h4 className="footer-title">follow us here 👇</h4>
              <div className="footer-content">
                <button className="social-item" aria-label="Twitter">
                  <i className="fa-brands fa-x-twitter" />
                </button>
                <button className="social-item" aria-label="Facebook">
                  <i className="bx bxl-facebook" />
                </button>
                <button className="social-item" aria-label="Discord">
                  <i className="bx bxl-discord-alt" />
                </button>
                <button className="social-item" aria-label="TikTok">
                  <i className="fa-brands fa-tiktok" />
                </button>
              </div>
            </div>
          </div>

        </div>
      </div>

      {showServices && (
        <ServicesModal
          onClose={() => setShowServices(false)}
          setActiveTab={(tab) => { setActiveTab(tab); setShowServices(false); }}
          currentUser={currentUser || user}
        />
      )}

      <style jsx>{`
        @import url("https://fonts.googleapis.com/css2?family=Syne:wght@400..800&family=Manrope:wght@200..800&display=swap");

        /* ─────────────────────────────────────────────────────────────────
           STRUCTURAL RULES — never touch these
           width: 300px | left: 4% | top: 56px
           glass-container padding: 24px 16px
           nav-item padding: 18px 16px | gap: 4px | border-radius: 4px
           font-size: 15px | font-weight: 600
        ───────────────────────────────────────────────────────────────── */

        .sidebar {
          position: fixed;
          left: 4%;
          top: 56px;
          bottom: 0;
          width: 300px;
          overflow: hidden;
          border-left: 1px solid #4444;
          font-family: "Manrope", sans-serif;
          z-index: 50;
        }

        /* ── AMBIENT ── */
        .ambient-bg {
          position: absolute; inset: 0;
          background: #000;
          overflow: hidden; pointer-events: none;
        }
        .ambient-orb {
          position: absolute; border-radius: 50%;
          filter: blur(80px); opacity: 0.35;
          animation: orbFloat 20s ease-in-out infinite;
          pointer-events: none;
        }
        .orb-1 {
          width: 300px; height: 300px;
          background: radial-gradient(circle, #84cc16 0%, transparent 70%);
          top: -100px; left: -100px;
        }
        .orb-2 {
          width: 250px; height: 250px;
          background: radial-gradient(circle, #65a30d 0%, transparent 70%);
          bottom: -80px; right: -80px; animation-delay: -7s;
        }
        .orb-3 {
          width: 200px; height: 200px;
          background: radial-gradient(circle, #a3e635 0%, transparent 70%);
          top: 40%; left: 50%;
          transform: translate(-50%, -50%); animation-delay: -14s;
        }
        @keyframes orbFloat {
          0%,100% { transform: translate(0,0) scale(1); }
          33%      { transform: translate(30px,-30px) scale(1.1); }
          66%      { transform: translate(-20px,20px) scale(0.9); }
        }
        .ambient-noise {
          position: absolute; inset: 0; opacity: 0.6; pointer-events: none;
        }

        /* ── GLASS CONTAINER ── */
        .glass-container {
          position: relative; height: 100%;
          display: flex; flex-direction: column;
          padding: 24px 16px;                   /* ← LOCKED */
          background: rgba(0,0,0,0.72);
          backdrop-filter: blur(24px) saturate(180%);
          border-right: 1px solid rgba(132,204,22,0.1);
          z-index: 1;
        }

        /* ── LOGO SECTION ── */
        .logo-section {
          position: relative;
          display: flex; align-items: center; gap: 14px;
          padding: 16px 12px;
          margin-bottom: 28px;
          border-radius: 20px; overflow: hidden;
        }
        .logo-backdrop {
          position: absolute; inset: 0;
          background: linear-gradient(135deg, rgba(0,0,0,0.9), rgba(101,163,13,0.06));
          border: 1px solid rgba(132,204,22,0.18);
          border-radius: 20px; pointer-events: none;
        }

        /* Spinning SVG ring */
        .logo-ring-wrap {
          position: relative; width: 54px; height: 54px; flex-shrink: 0;
        }
        .logo-ring-svg {
          position: absolute; inset: -5px;
          width: calc(100% + 10px); height: calc(100% + 10px);
          animation: ringSpin 6s linear infinite;
          filter: drop-shadow(0 0 4px rgba(132,204,22,0.7));
        }
        @keyframes ringSpin { to { transform: rotate(360deg); } }

        .logo-wrapper {
          position: absolute; inset: 0;
          width: 54px; height: 54px;
        }
        .logo-pulse {
          position: absolute; inset: -6px;
          background: radial-gradient(circle, rgba(78,48,2,0.55), transparent 50%);
          border-radius: 50%;
          animation: logoPulse 3s ease-in-out infinite; pointer-events: none;
        }
        @keyframes logoPulse {
          0%,100% { transform: scale(0.8); opacity: 0.5; }
          50%      { transform: scale(1.2); opacity: 1;   }
        }
        .logo-icon {
          position: relative; width: 54px; height: 54px; border-radius: 50%;
          background: linear-gradient(135deg, #84cc16, #65a30d);
          display: flex; align-items: center; justify-content: center;
          color: #000; overflow: hidden;
          box-shadow: 0 0 0 1px rgba(132,204,22,0.3), 0 4px 20px rgba(132,204,22,0.4);
          border: 1px solid #503103a2;
        }
        .logo-image {
          width: 100%; height: 100%; object-fit: cover; border-radius: 50%;
        }
        .logo-text h1 {
          font-family: "Syne", sans-serif;
          font-size: 24px; font-weight: 800; margin: 0; letter-spacing: 1px;
          background: linear-gradient(135deg, #fff 0%, #d4f08e 50%, #84cc16 100%);
          -webkit-background-clip: text; -webkit-text-fill-color: transparent;
          background-clip: text;
        }
        .logo-text p {
          font-size: 9px; font-weight: 600; letter-spacing: 0.5px;
          margin: 2px 0 0; color: rgba(163,163,163,0.7); text-transform: uppercase;
        }

        /* ── NAV SECTION LABEL ── */
        .nav-section-label {
          display: flex; align-items: center; gap: 8px;
          padding: 0 4px; margin-bottom: 10px;
        }
        .nav-label-line {
          flex: 1; height: 1px;
          background: linear-gradient(90deg, transparent, rgba(132,204,22,0.2));
        }
        .nav-label-line:last-child {
          background: linear-gradient(90deg, rgba(132,204,22,0.2), transparent);
        }
        .nav-label-text {
          font-size: 9px; font-weight: 800; letter-spacing: 1.5px;
          color: rgba(132,204,22,0.4); white-space: nowrap;
        }

        /* ── NAV CONTAINER ── */
        .nav-container {
          flex: 1;
          display: flex; flex-direction: column;
          gap: 4px;                             /* ← LOCKED */
          overflow-y: auto;
        }

        /* ── NAV ITEM ── */
        .nav-item {
          position: relative;
          display: flex; align-items: center; gap: 14px;
          padding: 18px 16px;                   /* ← LOCKED */
          background: transparent;
          border: 1px solid rgba(68,68,68,0.25);
          border-radius: 4px;                   /* ← LOCKED */
          color: #737373;
          font-size: 15px;                      /* ← LOCKED */
          font-weight: 600;                     /* ← LOCKED */
          cursor: pointer; overflow: hidden;
          transition: all 0.28s cubic-bezier(0.4,0,0.2,1);
          animation: itemSlide 0.6s cubic-bezier(0.4,0,0.2,1) backwards;
          outline: none;
        }
        @keyframes itemSlide {
          from { opacity: 0; transform: translateX(-24px); }
        }
        .nav-item:hover:not(.nav-item-active) {
          transform: scale(1.012) translateX(2px);
          color: #d4d4d4;
          border-color: rgba(132,204,22,0.12);
        }

        /* ── ITEM GLASS (hover / active fill) ── */
        .item-glass {
          position: absolute; inset: 0;
          border-radius: 4px; opacity: 0;
          transition: opacity 0.35s; pointer-events: none;
        }
        .item-glass-active {
          opacity: 1;
          background: linear-gradient(105deg,
            rgba(132,204,22,0.1) 0%,
            rgba(132,204,22,0.04) 60%,
            transparent 100%
          );
          border: 1px solid rgba(132,204,22,0.22);
          box-shadow:
            0 8px 28px rgba(132,204,22,0.1),
            inset 0 1px 0 rgba(163,230,53,0.08);
        }

        /* ── ACTIVE STATES ── */
        .active-beam {
          position: absolute; left: 0; top: 15%; bottom: 15%;
          width: 3px;
          background: linear-gradient(180deg,
            rgba(163,230,53,0.3),
            #a3e635 35%, #84cc16 65%,
            rgba(132,204,22,0.3)
          );
          border-radius: 0 3px 3px 0;
          box-shadow:
            0 0 10px rgba(132,204,22,1),
            0 0 22px rgba(132,204,22,0.5),
            0 0 40px rgba(132,204,22,0.2);
          animation: beamPulse 2.4s ease-in-out infinite; pointer-events: none;
        }
        @keyframes beamPulse {
          0%,100% { opacity: 1; }
          50%      { opacity: 0.6; }
        }

        .active-glow {
          position: absolute; inset: 0;
          background: radial-gradient(
            ellipse at 0% 50%,
            rgba(132,204,22,0.14) 0%,
            transparent 65%
          );
          pointer-events: none;
        }

        /* Small pulsing dot — right side */
        .active-dot {
          position: absolute; right: 14px; top: 50%;
          transform: translateY(-50%);
          width: 6px; height: 6px; border-radius: 50%;
          background: #84cc16;
          box-shadow: 0 0 8px rgba(132,204,22,1), 0 0 16px rgba(132,204,22,0.5);
          animation: dotPulse 2s ease-in-out infinite; pointer-events: none;
        }
        @keyframes dotPulse {
          0%,100% { transform: translateY(-50%) scale(1); opacity: 1; }
          50%      { transform: translateY(-50%) scale(0.6); opacity: 0.4; }
        }

        /* ── ICON ── */
        .icon-container {
          position: relative;
          display: flex; align-items: center; justify-content: center;
          width: 24px; height: 24px; z-index: 2;
        }
        .icon-halo {
          position: absolute; inset: -10px;
          background: radial-gradient(circle, rgba(132,204,22,0.35) 0%, transparent 70%);
          border-radius: 50%; opacity: 0;
          transition: opacity 0.35s; pointer-events: none;
        }
        .icon-halo-visible {
          opacity: 1;
          animation: haloExpand 2s ease-in-out infinite;
        }
        @keyframes haloExpand {
          0%,100% { transform: scale(0.8); }
          50%      { transform: scale(1.2); }
        }

        /* ── ACTIVE NAV ITEM ── */
        .item-label { position: relative; z-index: 2; }
        .nav-item-active {
          color: #a3e635;
          border-color: rgba(132,204,22,0.18);
        }
        .nav-item-active .item-label {
          font-weight: 700;
          text-shadow: 0 0 18px rgba(132,204,22,0.45);
        }

        /* ── HOVER SHIMMER ── */
        .hover-shimmer {
          position: absolute; top: 0; left: -100%; width: 100%; height: 100%;
          background: linear-gradient(90deg,
            transparent, rgba(132,204,22,0.08), transparent
          );
          animation: shimmer 1.2s ease-in-out;
          pointer-events: none;
        }
        @keyframes shimmer { to { left: 100%; } }

        /* ── FOOTER ── */
        .footer-section {
          position: relative;
          padding: 0; margin-top: 16px;
          border-radius: 16px; overflow: hidden;
        }
        .footer-glass {
          position: absolute; inset: 0;
          background: rgba(132,204,22,0.025);
          border: 1px solid rgba(132,204,22,0.1);
          border-radius: 16px; pointer-events: none;
        }
        .social-grid {
          position: relative; z-index: 1;
          display: flex; flex-direction: column;
          align-items: center; gap: 10px; padding: 12px;
        }
        .footer-title {
          background: rgba(0,0,0,0.48);
          padding: 4px 8px; border-radius: 12px;
          border: 1px solid rgba(255,255,255,0.06);
          font-size: 12px; font-weight: 600;
          color: rgba(163,163,163,0.55); margin: 0;
        }
        .footer-content { display: flex; gap: 6px; }
        .social-item {
          width: 42px; height: 42px; border-radius: 12px;
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.07);
          display: flex; align-items: center; justify-content: center;
          color: #484848; font-size: 18px; cursor: pointer;
          transition: all 0.3s cubic-bezier(0.34,1.1,0.64,1);
        }
        .social-item:hover {
          background: rgba(132,204,22,0.12);
          border-color: rgba(132,204,22,0.3);
          color: #84cc16;
          transform: translateY(-4px) scale(1.06);
          box-shadow: 0 8px 20px rgba(132,204,22,0.2);
        }
      `}</style>
    </>
  );
};

export default Sidebar;