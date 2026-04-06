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

  const navItems = [
    { id: "home",      icon: Home,       label: "Home"      },
    { id: "search",    icon: Search,     label: "Explore"   },
    { id: "create",    icon: PlusSquare, label: "Create"    },
    { id: "community", icon: Users,      label: "Community" },
    { id: "wallet",    icon: Wallet,     label: "Wallet"    },
    { id: "menu",      icon: LayoutGrid, label: "Menu", isMenu: true },
  ];

  return (
    <>
      <div className="sidebar">

        {/* Ambient background */}
        <div className="ambient-bg">
          <div className="ambient-orb orb-1" />
          <div className="ambient-orb orb-2" />
          <div className="ambient-orb orb-3" />
        </div>

        <div className="glass-container">

          {/* Top accent bar */}
          <div className="top-accent-bar" />

          {/* Logo */}
          <div className="logo-section">
            <div className="logo-backdrop" />
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
                        '<span style="font-size:26px;font-weight:900;color:#000;">X</span>';
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
              const isActive  = activeTab === item.id;
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
                      <Icon size={18} strokeWidth={2} />
                    </div>
                    <span className="item-label">{item.label}</span>
                    {isHovered && <div className="hover-shimmer" />}
                  </button>
                );
              }

              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
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
                    <Icon size={18} strokeWidth={isActive ? 2.5 : 2} />
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
        @import url("https://fonts.googleapis.com/css2?family=Syne:wght@400..800&family=Manrope:wght@200..800&family=JetBrains+Mono:wght@400;600&display=swap");

        /* ─────────────────────────────────────────────────────────────────
           STRUCTURE: fixed, left:4%, top:56px, width:300px — never change
        ───────────────────────────────────────────────────────────────── */

        .sidebar {
          position: fixed;
          left: 4%;
          top: 56px;
          bottom: 0;
          width: 300px;
          overflow: hidden;
          border-left: 1px solid rgba(255,255,255,0.08);
          border-right: 1px solid rgba(255,255,255,0.06);
          font-family: "Manrope", sans-serif;
          z-index: 50;
        }

        /* ── AMBIENT ── */
        .ambient-bg {
          position: absolute;
          inset: 0;
          background: #0a0a0a;
          overflow: hidden;
          pointer-events: none;
        }
        .ambient-orb {
          position: absolute;
          border-radius: 50%;
          filter: blur(70px);
          opacity: 0.45;
          animation: orbFloat 20s ease-in-out infinite;
          pointer-events: none;
        }
        .orb-1 {
          width: 280px; height: 280px;
          background: radial-gradient(circle, #84cc16 0%, transparent 70%);
          top: -120px; left: -100px;
        }
        .orb-2 {
          width: 220px; height: 220px;
          background: radial-gradient(circle, #65a30d 0%, transparent 70%);
          bottom: -80px; right: -70px;
          animation-delay: -7s;
        }
        .orb-3 {
          width: 180px; height: 180px;
          background: radial-gradient(circle, #a3e635 0%, transparent 70%);
          top: 42%; left: 50%;
          transform: translate(-50%, -50%);
          animation-delay: -14s;
        }
        @keyframes orbFloat {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33%       { transform: translate(28px, -28px) scale(1.08); }
          66%       { transform: translate(-18px, 18px) scale(0.92); }
        }

        /* ── GLASS CONTAINER — full height flex column ── */
        .glass-container {
          position: relative;
          height: 100%;
          display: flex;
          flex-direction: column;
          background: rgba(12, 12, 12, 0.93);
          backdrop-filter: blur(24px) saturate(180%);
          border-right: 1px solid rgba(132, 204, 22, 0.14);
          z-index: 1;
          /* No padding here — each section owns its own spacing */
        }

        /* ── TOP ACCENT BAR ── */
        .top-accent-bar {
          height: 2px;
          background: linear-gradient(90deg, #84cc16 0%, #a3e635 40%, transparent 100%);
          flex-shrink: 0;
        }

        /* ── LOGO SECTION ── */
        .logo-section {
          position: relative;
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 14px 14px 12px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.07);
          flex-shrink: 0;
          overflow: hidden;
        }
        .logo-backdrop {
          position: absolute;
          inset: 0;
          background: linear-gradient(135deg, rgba(18,18,18,0.95), rgba(101,163,13,0.08));
          border-bottom: 1px solid rgba(132, 204, 22, 0.18);
          pointer-events: none;
        }

        .logo-ring-wrap {
          position: relative;
          width: 48px; height: 48px;
          flex-shrink: 0;
        }
        .logo-ring-svg {
          position: absolute;
          inset: -5px;
          width: calc(100% + 10px);
          height: calc(100% + 10px);
          animation: ringSpin 6s linear infinite;
          filter: drop-shadow(0 0 3px rgba(132,204,22,0.6));
        }
        @keyframes ringSpin { to { transform: rotate(360deg); } }

        .logo-wrapper {
          position: absolute;
          inset: 0;
          width: 48px; height: 48px;
        }
        .logo-pulse {
          position: absolute;
          inset: -6px;
          background: radial-gradient(circle, rgba(78,48,2,0.5), transparent 50%);
          border-radius: 50%;
          animation: logoPulse 3s ease-in-out infinite;
          pointer-events: none;
        }
        @keyframes logoPulse {
          0%, 100% { transform: scale(0.8); opacity: 0.5; }
          50%       { transform: scale(1.2); opacity: 1;   }
        }
        .logo-icon {
          position: relative;
          width: 48px; height: 48px;
          border-radius: 50%;
          background: linear-gradient(135deg, #84cc16, #65a30d);
          display: flex;
          align-items: center;
          justify-content: center;
          color: #000;
          overflow: hidden;
          box-shadow: 0 0 0 1px rgba(132,204,22,0.3), 0 4px 18px rgba(132,204,22,0.35);
          border: 1px solid rgba(80,49,3,0.6);
        }
        .logo-image {
          width: 100%; height: 100%;
          object-fit: cover;
          border-radius: 50%;
        }
        .logo-text h1 {
          font-family: "Syne", sans-serif;
          font-size: 22px;
          font-weight: 800;
          margin: 0;
          letter-spacing: 1px;
          background: linear-gradient(135deg, #fff 0%, #d4f08e 50%, #84cc16 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }
        .logo-text p {
          font-size: 8.5px;
          font-weight: 600;
          letter-spacing: 0.5px;
          margin: 2px 0 0;
          color: #7a8a6a;
          text-transform: uppercase;
          font-family: "JetBrains Mono", monospace;
        }

        /* ── NAV SECTION LABEL ── */
        .nav-section-label {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 14px 6px;
          flex-shrink: 0;
        }
        .nav-label-line {
          flex: 1;
          height: 1px;
          background: linear-gradient(90deg, transparent, rgba(132,204,22,0.3));
        }
        .nav-label-line:last-child {
          background: linear-gradient(90deg, rgba(132,204,22,0.3), transparent);
        }
        .nav-label-text {
          font-size: 8.5px;
          font-weight: 700;
          letter-spacing: 1.4px;
          color: rgba(132, 204, 22, 0.55);
          white-space: nowrap;
          font-family: "JetBrains Mono", monospace;
        }

        /* ── NAV CONTAINER — flex:1 so it takes all remaining space ── */
        .nav-container {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 2px;
          padding: 0 8px;
          overflow-y: auto;
          /* Push footer down naturally — no min-height tricks */
        }
        .nav-container::-webkit-scrollbar { display: none; }

        /* ── NAV ITEM ── */
        .nav-item {
          position: relative;
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 11px 12px;
          background: transparent;
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 8px;
          color: #7a7a7a;
          font-size: 13.5px;
          font-weight: 600;
          cursor: pointer;
          overflow: hidden;
          transition: all 0.22s cubic-bezier(0.4, 0, 0.2, 1);
          animation: itemSlide 0.5s cubic-bezier(0.4, 0, 0.2, 1) backwards;
          outline: none;
          text-align: left;
          font-family: "Manrope", sans-serif;
          flex-shrink: 0;
        }
        @keyframes itemSlide {
          from { opacity: 0; transform: translateX(-20px); }
        }
        .nav-item:hover:not(.nav-item-active) {
          color: #e0e0e0;
          border-color: rgba(132, 204, 22, 0.18);
          transform: translateX(2px);
        }

        .item-glass {
          position: absolute;
          inset: 0;
          border-radius: 8px;
          opacity: 0;
          transition: opacity 0.3s;
          pointer-events: none;
        }
        .item-glass-active {
          opacity: 1;
          background: linear-gradient(105deg,
            rgba(132,204,22,0.1) 0%,
            rgba(132,204,22,0.04) 60%,
            transparent 100%
          );
          border: 1px solid rgba(132,204,22,0.25);
          box-shadow: 0 4px 20px rgba(132,204,22,0.08), inset 0 1px 0 rgba(163,230,53,0.08);
        }

        .active-beam {
          position: absolute;
          left: 0; top: 18%; bottom: 18%;
          width: 2.5px;
          background: linear-gradient(180deg,
            rgba(163,230,53,0.2),
            #a3e635 30%, #84cc16 70%,
            rgba(132,204,22,0.2)
          );
          border-radius: 0 3px 3px 0;
          box-shadow: 0 0 8px rgba(132,204,22,0.9), 0 0 18px rgba(132,204,22,0.4);
          animation: beamPulse 2.5s ease-in-out infinite;
          pointer-events: none;
        }
        @keyframes beamPulse {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.65; }
        }

        .active-glow {
          position: absolute;
          inset: 0;
          background: radial-gradient(ellipse at 0% 50%, rgba(132,204,22,0.14) 0%, transparent 65%);
          pointer-events: none;
        }

        .active-dot {
          position: absolute;
          right: 12px; top: 50%;
          transform: translateY(-50%);
          width: 5px; height: 5px;
          border-radius: 50%;
          background: #84cc16;
          box-shadow: 0 0 6px rgba(132,204,22,1), 0 0 12px rgba(132,204,22,0.5);
          animation: dotPulse 2s ease-in-out infinite;
          pointer-events: none;
        }
        @keyframes dotPulse {
          0%, 100% { transform: translateY(-50%) scale(1); opacity: 1; }
          50%       { transform: translateY(-50%) scale(0.55); opacity: 0.4; }
        }

        .icon-container {
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
          width: 22px; height: 22px;
          z-index: 2;
          flex-shrink: 0;
        }
        .icon-halo {
          position: absolute;
          inset: -9px;
          background: radial-gradient(circle, rgba(132,204,22,0.3) 0%, transparent 70%);
          border-radius: 50%;
          opacity: 0;
          transition: opacity 0.3s;
          pointer-events: none;
        }
        .icon-halo-visible {
          opacity: 1;
          animation: haloExpand 2.2s ease-in-out infinite;
        }
        @keyframes haloExpand {
          0%, 100% { transform: scale(0.8); }
          50%       { transform: scale(1.15); }
        }

        .item-label { position: relative; z-index: 2; }

        .nav-item-active {
          color: #a3e635;
          border-color: rgba(132, 204, 22, 0.2);
        }
        .nav-item-active .item-label {
          font-weight: 700;
          text-shadow: 0 0 14px rgba(132, 204, 22, 0.45);
        }

        .hover-shimmer {
          position: absolute;
          top: 0; left: -100%; width: 100%; height: 100%;
          background: linear-gradient(90deg, transparent, rgba(132,204,22,0.07), transparent);
          animation: shimmer 1.1s ease-in-out;
          pointer-events: none;
        }
        @keyframes shimmer { to { left: 100%; } }

        /* ── FOOTER — fixed height, never grows ── */
        .footer-section {
          position: relative;
          padding: 10px 8px 12px;
          border-top: 1px solid rgba(255,255,255,0.07);
          flex-shrink: 0;
          border-radius: 0;
          overflow: hidden;
        }
        .footer-glass {
          position: absolute;
          inset: 0;
          background: rgba(132, 204, 22, 0.04);
          pointer-events: none;
        }
        .social-grid {
          position: relative;
          z-index: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 8px;
        }
        .footer-title {
          background: rgba(255,255,255,0.05);
          padding: 3px 10px;
          border-radius: 10px;
          border: 1px solid rgba(255,255,255,0.08);
          font-size: 11px;
          font-weight: 600;
          color: #6b7280;
          margin: 0;
          font-family: "Manrope", sans-serif;
        }
        .footer-content { display: flex; gap: 5px; }
        .social-item {
          width: 38px; height: 38px;
          border-radius: 10px;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          display: flex;
          align-items: center;
          justify-content: center;
          color: #555;
          font-size: 16px;
          cursor: pointer;
          transition: all 0.25s cubic-bezier(0.34, 1.1, 0.64, 1);
        }
        .social-item:hover {
          background: rgba(132, 204, 22, 0.12);
          border-color: rgba(132, 204, 22, 0.35);
          color: #a3e635;
          transform: translateY(-3px) scale(1.05);
          box-shadow: 0 6px 16px rgba(132, 204, 22, 0.18);
        }
      `}</style>
    </>
  );
};

export default Sidebar;