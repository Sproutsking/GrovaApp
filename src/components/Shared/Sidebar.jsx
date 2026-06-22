// src/components/Shared/Sidebar.jsx
import React, { useState } from "react";
import { Home, Search, PlusSquare, Wallet, Users, LayoutGrid } from "lucide-react";
import SectionHeader from "./SectionHeader";
import Logo from "./Assets/Logo.png";
import ServicesModal from "./ServicesModal";

const navItems = [
  {
    id: "home",
    icon: Home,
    label: "Home",
    color: "#a3e635",
    bg: "rgba(132,204,22,0.15)",
    glow: "rgba(132,204,22,0.35)",
  },
  {
    id: "search",
    icon: Search,
    label: "Explore",
    color: "#22d3ee",
    bg: "rgba(6,182,212,0.12)",
    glow: "rgba(6,182,212,0.35)",
  },
  {
    id: "create",
    icon: PlusSquare,
    label: "Create",
    color: "#fbbf24",
    bg: "rgba(245,158,11,0.12)",
    glow: "rgba(245,158,11,0.35)",
  },
  {
    id: "community",
    icon: Users,
    label: "Community",
    color: "#a78bfa",
    bg: "rgba(139,92,246,0.12)",
    glow: "rgba(139,92,246,0.35)",
  },
  {
    id: "wallet",
    icon: Wallet,
    label: "Wallet",
    color: "#34d399",
    bg: "rgba(16,185,129,0.12)",
    glow: "rgba(16,185,129,0.35)",
  },
  {
    id: "menu",
    icon: LayoutGrid,
    label: "Menu",
    color: "#94a3b8",
    bg: "rgba(148,163,184,0.1)",
    glow: "rgba(148,163,184,0.2)",
    isMenu: true,
  },
];

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
          <SectionHeader
            icon={LayoutGrid}
            iconColor="#94a3b8"
            iconBg="rgba(148,163,184,0.08)"
            iconBorder="rgba(148,163,184,0.12)"
            title="Navigation"
            subtitle="Main app sidebar"
            className="sidebar-nav-header"
          />

          {/* Nav */}
          <nav className="nav-container">
            {navItems.map((item, idx) => {
              const Icon     = item.icon;
              const isActive  = activeTab === item.id;
              const isHovered = hoveredItem === item.id;

              const iconColor = isActive || isHovered ? item.color : item.color + "99";
              const iconBg    = isActive ? item.bg.replace("0.15", "0.22").replace("0.12", "0.2").replace("0.1", "0.18") : item.bg;

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
                    <div className={`item-glass${isHovered ? " item-glass-active" : ""}`}
                      style={isHovered ? { borderColor: `${item.color}30` } : {}} />
                    <div className="icon-container"
                      style={{ background: isHovered ? iconBg : item.bg, borderRadius: 7 }}>
                      <div className={`icon-halo${isHovered ? " icon-halo-visible" : ""}`}
                        style={{ background: `radial-gradient(circle, ${item.color}33 0%, transparent 70%)` }} />
                      <Icon size={15} strokeWidth={2} color={iconColor} />
                    </div>
                    <span className="item-label" style={isHovered ? { color: item.color } : {}}>
                      {item.label}
                    </span>
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
                  style={{
                    animationDelay: `${idx * 0.05}s`,
                    ...(isActive ? {
                      background: `${item.bg}`,
                      borderColor: `${item.color}35`,
                      color: item.color,
                    } : {}),
                  }}
                >
                  <div className={`item-glass${isActive || isHovered ? " item-glass-active" : ""}`}
                    style={(isActive || isHovered) ? { borderColor: `${item.color}28` } : {}} />
                  {isActive && (
                    <>
                      <div className="active-beam"
                        style={{ background: `linear-gradient(180deg, rgba(255,255,255,0.1), ${item.color}, rgba(255,255,255,0.1))`, boxShadow: `0 0 8px ${item.glow}, 0 0 18px ${item.color}33` }} />
                      <div className="active-glow"
                        style={{ background: `radial-gradient(ellipse at 0% 50%, ${item.color}20 0%, transparent 65%)` }} />
                      <div className="active-dot"
                        style={{ background: item.color, boxShadow: `0 0 6px ${item.glow}, 0 0 12px ${item.color}55` }} />
                    </>
                  )}
                  <div className="icon-container"
                    style={{
                      background: isActive ? iconBg : isHovered ? item.bg : item.bg,
                      borderRadius: 7,
                      transition: "all 0.2s ease",
                      boxShadow: (isActive || isHovered) ? `0 0 10px ${item.color}25` : "none",
                    }}>
                    <div className={`icon-halo${isActive || isHovered ? " icon-halo-visible" : ""}`}
                      style={{ background: `radial-gradient(circle, ${item.color}33 0%, transparent 70%)` }} />
                    <Icon size={15} strokeWidth={isActive ? 2.5 : 2} color={iconColor} />
                  </div>
                  <span className="item-label"
                    style={(isActive || isHovered) ? { color: item.color } : {}}>
                    {item.label}
                  </span>
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

        .glass-container {
          position: relative;
          height: 100%;
          display: flex;
          flex-direction: column;
          background: rgba(12, 12, 12, 0.93);
          backdrop-filter: blur(24px) saturate(180%);
          border-right: 1px solid rgba(132, 204, 22, 0.14);
          z-index: 1;
        }

        .top-accent-bar {
          height: 2px;
          background: linear-gradient(90deg, #84cc16 0%, #a3e635 40%, transparent 100%);
          flex-shrink: 0;
        }

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
          50%       { transform: scale(1.2); opacity: 1; }
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

        .nav-container {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 0;
          padding: 0 8px;
          overflow-y: auto;
        }
        .nav-container::-webkit-scrollbar { display: none; }

        .nav-item {
          position: relative;
          display: flex;
          align-items: center;
          gap: 11px;
          padding: 9px 10px;
          background: transparent;
          border: 1px solid rgba(255, 255, 255, 0.05);
          border-radius: 8px;
          color: #7a7a7a;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          overflow: hidden;
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
          animation: itemSlide 0.5s cubic-bezier(0.4, 0, 0.2, 1) backwards;
          outline: none;
          text-align: left;
          font-family: "Manrope", sans-serif;
          flex-shrink: 0;
          /* ── 3px gap between items — tight but breathable ── */
          margin-bottom: 3px;
        }
        @keyframes itemSlide {
          from { opacity: 0; transform: translateX(-20px); }
        }
        .nav-item:hover:not(.nav-item-active) {
          border-color: rgba(255,255,255,0.1);
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
            rgba(255,255,255,0.05) 0%,
            rgba(255,255,255,0.02) 60%,
            transparent 100%
          );
        }

        .active-beam {
          position: absolute;
          left: 0; top: 18%; bottom: 18%;
          width: 2.5px;
          border-radius: 0 3px 3px 0;
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
          pointer-events: none;
        }
        .active-dot {
          position: absolute;
          right: 12px; top: 50%;
          transform: translateY(-50%);
          width: 5px; height: 5px;
          border-radius: 50%;
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
          width: 28px; height: 28px;
          z-index: 2;
          flex-shrink: 0;
        }
        .icon-halo {
          position: absolute;
          inset: -9px;
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

        .item-label { position: relative; z-index: 2; transition: color 0.2s ease; }
        .nav-item-active .item-label { font-weight: 700; }

        .hover-shimmer {
          position: absolute;
          top: 0; left: -100%; width: 100%; height: 100%;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.04), transparent);
          animation: shimmer 1.1s ease-in-out;
          pointer-events: none;
        }
        @keyframes shimmer { to { left: 100%; } }

        .footer-section {
          position: relative;
          padding: 10px 8px 12px;
          border-top: 1px solid rgba(255,255,255,0.07);
          flex-shrink: 0;
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