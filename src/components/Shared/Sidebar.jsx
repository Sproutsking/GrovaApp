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
    color: "var(--accent)",
    bg: "var(--accent-bg-soft)",
    glow: "var(--accent-shadow)",
  },
  {
    id: "search",
    icon: Search,
    label: "Explore",
    color: "var(--brand-info)",
    bg: "var(--brand-info-bg)",
    glow: "var(--brand-info-shadow)",
  },
  {
    id: "create",
    icon: PlusSquare,
    label: "Create",
    color: "var(--brand-warning)",
    bg: "var(--brand-warning-bg)",
    glow: "var(--brand-warning-shadow)",
  },
  {
    id: "community",
    icon: Users,
    label: "Community",
    color: "var(--brand-purple)",
    bg: "var(--brand-purple-bg)",
    glow: "var(--brand-purple-shadow)",
  },
  {
    id: "wallet",
    icon: Wallet,
    label: "Wallet",
    color: "var(--brand-success)",
    bg: "var(--brand-success-bg)",
    glow: "var(--brand-success-shadow)",
  },
  {
    id: "menu",
    icon: LayoutGrid,
    label: "Menu",
    color: "var(--text-secondary)",
    bg: "var(--surface-strong)",
    glow: "var(--surface-border)",
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
                    <stop offset="0%"   stopColor="var(--accent)" stopOpacity="0" />
                    <stop offset="40%"  stopColor="var(--accent-strong)" stopOpacity="1" />
                    <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
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
                        '<span style="font-size:26px;font-weight:900;color:var(--accent-contrast);">X</span>';
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
            iconColor="var(--text-secondary)"
            iconBg="var(--surface)"
            iconBorder="var(--surface-border)"
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

              const iconColor = item.color;
              const iconBg    = item.bg;

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
                        style={{ background: `radial-gradient(circle, ${item.bg} 0%, transparent 70%)` }} />
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
                    style={(isActive || isHovered) ? { borderColor: item.glow } : {}} />
                  {isActive && (
                    <>
                      <div className="active-beam"
                        style={{ background: `linear-gradient(180deg, ${item.bg}, ${item.bg})`, boxShadow: `0 0 8px ${item.glow}` }} />
                      <div className="active-glow"
                        style={{ background: `radial-gradient(ellipse at 0% 50%, ${item.bg} 0%, transparent 65%)` }} />
                      <div className="active-dot"
                        style={{ background: item.color, boxShadow: `0 0 6px ${item.glow}` }} />
                    </>
                  )}
                  <div className="icon-container"
                    style={{
                      background: isActive ? iconBg : isHovered ? item.bg : item.bg,
                      borderRadius: 7,
                      transition: "all 0.2s ease",
                      boxShadow: (isActive || isHovered) ? `0 0 10px ${item.glow}` : "none",
                    }}>
                    <div className={`icon-halo${isActive || isHovered ? " icon-halo-visible" : ""}`}
                      style={{ background: `radial-gradient(circle, ${item.bg} 0%, transparent 70%)` }} />
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
          background: var(--bg);
          border-left: 1px solid var(--surface-border);
          border-right: 1px solid var(--surface-border);
          font-family: "Manrope", sans-serif;
          z-index: 50;
        }

        .ambient-bg {
          position: absolute;
          inset: 0;
          background: radial-gradient(circle, var(--accent) 0%, transparent 62%);
          overflow: hidden;
          pointer-events: none;
          opacity: 0.3;
        }
        .ambient-orb {
          position: absolute;
          border-radius: 50%;
          filter: blur(70px);
          opacity: 0.35;
          animation: orbFloat 20s ease-in-out infinite;
          pointer-events: none;
        }
        .orb-1 {
          width: 280px; height: 280px;
          background: radial-gradient(circle, var(--accent) 0%, transparent 70%);
          top: -120px; left: -100px;
        }
        .orb-2 {
          width: 220px; height: 220px;
          background: radial-gradient(circle, var(--accent-strong) 0%, transparent 70%);
          bottom: -80px; right: -70px;
          animation-delay: -7s;
        }
        .orb-3 {
          width: 180px; height: 180px;
          background: radial-gradient(circle, var(--accent-bg-strong) 0%, transparent 70%);
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
          background: var(--surface-strong);
          backdrop-filter: blur(24px) saturate(180%);
          border-right: 1px solid var(--surface-border);
          z-index: 1;
        }

        .top-accent-bar {
          height: 2px;
          background: var(--accent-gradient);
          flex-shrink: 0;
        }

        .logo-section {
          position: relative;
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 14px 14px 12px;
          border-bottom: 1px solid var(--surface-border);
          flex-shrink: 0;
          overflow: hidden;
          background: var(--surface);
        }
        .logo-backdrop {
          position: absolute;
          inset: 0;
          background: linear-gradient(135deg, var(--surface-overlay), var(--accent-bg-soft));
          border-bottom: 1px solid var(--surface-border);
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
          filter: drop-shadow(0 0 3px var(--accent-shadow));
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
          background: radial-gradient(circle, var(--accent-shadow), transparent 50%);
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
          background: linear-gradient(135deg, var(--accent), var(--accent-strong));
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--accent-contrast);
          overflow: hidden;
          box-shadow: 0 0 0 1px var(--accent-border), 0 4px 18px var(--accent-shadow);
          border: 1px solid var(--accent-border-strong);
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
          color: var(--text);
        }
        .logo-text p {
          font-size: 8.5px;
          font-weight: 600;
          letter-spacing: 0.5px;
          margin: 2px 0 0;
          color: var(--text-secondary);
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
          background: linear-gradient(90deg, transparent, var(--accent-border));
        }
        .nav-label-line:last-child {
          background: linear-gradient(90deg, var(--accent-border), transparent);
        }
        .nav-label-text {
          font-size: 8.5px;
          font-weight: 700;
          letter-spacing: 1.4px;
          color: var(--text-secondary);
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
          background: var(--surface);
          border: 1px solid var(--surface-border);
          border-radius: 8px;
          color: var(--text-secondary);
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
          margin-bottom: 3px;
        }
        @keyframes itemSlide {
          from { opacity: 0; transform: translateX(-20px); }
        }
        .nav-item:hover:not(.nav-item-active) {
          border-color: var(--surface-border);
          background: var(--surface-strong);
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
            var(--surface-highlight) 0%,
            var(--surface-highlight-strong) 60%,
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
          background: linear-gradient(90deg, transparent, var(--surface-highlight-strong), transparent);
          animation: shimmer 1.1s ease-in-out;
          pointer-events: none;
        }
        @keyframes shimmer { to { left: 100%; } }

        .footer-section {
          position: relative;
          padding: 10px 8px 12px;
          border-top: 1px solid var(--surface-border);
          background: var(--surface);
          flex-shrink: 0;
          overflow: hidden;
        }
        .footer-glass {
          position: absolute;
          inset: 0;
          background: var(--surface-highlight);
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
          background: var(--surface);
          padding: 3px 10px;
          border-radius: 10px;
          border: 1px solid var(--surface-border);
          font-size: 11px;
          font-weight: 600;
          color: var(--text-secondary);
          margin: 0;
          font-family: "Manrope", sans-serif;
        }
        .footer-content { display: flex; gap: 5px; }
        .social-item {
          width: 38px; height: 38px;
          border-radius: 10px;
          background: var(--surface);
          border: 1px solid var(--surface-border);
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--text-secondary);
          font-size: 16px;
          cursor: pointer;
          transition: all 0.25s cubic-bezier(0.34, 1.1, 0.64, 1);
        }
        .social-item:hover {
          background: var(--accent-bg-soft);
          border-color: var(--accent-border);
          color: var(--accent);
          transform: translateY(-3px) scale(1.05);
          box-shadow: 0 6px 16px var(--accent-shadow);
        }
      `}</style>
    </>
  );
};

export default Sidebar;