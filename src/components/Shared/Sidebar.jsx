// src/components/Shared/Sidebar.jsx
import React, { useState } from "react";
import { Home, Search, PlusSquare, Wallet, Users, LogOut, LayoutGrid } from "lucide-react";
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
    { id: "home", icon: Home, label: "Home" },
    { id: "search", icon: Search, label: "Explore" },
    { id: "create", icon: PlusSquare, label: "Create" },
    { id: "community", icon: Users, label: "Community" },
    { id: "wallet", icon: Wallet, label: "Wallet" },
    { id: "menu", icon: LayoutGrid, label: "Menu", isMenu: true },
  ];

  const handleNavClick = (id) => setActiveTab(id);

  const handleLogout = async () => {
    if (window.confirm("Are you sure you want to log out?")) {
      try {
        await onSignOut();
      } catch {
        alert("Failed to logout. Please try again.");
      }
    }
  };

  return (
    <>
      <div className="sidebar">
        <div className="ambient-bg">
          <div className="ambient-orb orb-1" />
          <div className="ambient-orb orb-2" />
          <div className="ambient-orb orb-3" />
          <div className="ambient-noise" />
        </div>

        <div className="glass-container">
          {/* Logo */}
          <div className="logo-section">
            <div className="logo-backdrop" />
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
            <div className="logo-text">
              <h1>XEEVIA</h1>
              <p>Every Word Seeds Value</p>
            </div>
          </div>

          {/* Nav */}
          <nav className="nav-container">
            {navItems.map((item, idx) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              const isHovered = hoveredItem === item.id;

              // ── Menu button ──
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
                  className={`nav-item ${isActive ? "nav-item-active" : ""}`}
                  style={{ animationDelay: `${idx * 0.05}s` }}
                >
                  <div
                    className={`item-glass ${isActive || isHovered ? "item-glass-active" : ""}`}
                  />
                  {isActive && (
                    <>
                      <div className="active-beam" />
                      <div className="active-glow" />
                    </>
                  )}
                  <div className="icon-container">
                    <div
                      className={`icon-halo ${isActive || isHovered ? "icon-halo-visible" : ""}`}
                    />
                    <Icon size={20} strokeWidth={isActive ? 2.5 : 2} />
                  </div>
                  <span className="item-label">{item.label}</span>
                  {isHovered && !isActive && <div className="hover-shimmer" />}
                </button>
              );
            })}

            {/* Logout */}
            <div className="logout-container">
              <button
                onClick={handleLogout}
                onMouseEnter={() => setHoveredItem("logout")}
                onMouseLeave={() => setHoveredItem(null)}
                className="nav-item logout-btn"
              >
                <div
                  className={`item-glass ${hoveredItem === "logout" ? "item-glass-active logout-glass" : ""}`}
                />
                <div className="icon-container">
                  <div
                    className={`icon-halo ${hoveredItem === "logout" ? "icon-halo-visible logout-halo" : ""}`}
                  />
                  <LogOut
                    size={20}
                    strokeWidth={2}
                    style={{ transform: "scaleX(-1)" }}
                  />
                </div>
                <span className="item-label">Logout</span>
                {hoveredItem === "logout" && (
                  <div className="hover-shimmer logout-shimmer" />
                )}
              </button>
            </div>
          </nav>

          {/* Footer - Normal user version with social links */}
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

      {/* Services Modal */}
      {showServices && (
        <ServicesModal
          onClose={() => setShowServices(false)}
          setActiveTab={(tab) => { setActiveTab(tab); setShowServices(false); }}
          currentUser={currentUser || user}
        />
      )}

      <style jsx>{`
        @import url("https://fonts.googleapis.com/css2?family=Syne:wght@400..800&family=Manrope:wght@200..800&display=swap");
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
        .ambient-bg {
          position: absolute;
          inset: 0;
          background: #000;
          overflow: hidden;
          pointer-events: none;
        }
        .ambient-orb {
          position: absolute;
          border-radius: 50%;
          filter: blur(80px);
          opacity: 0.4;
          animation: orbFloat 20s ease-in-out infinite;
          pointer-events: none;
        }
        .orb-1 {
          width: 300px;
          height: 300px;
          background: radial-gradient(circle, #84cc16 0%, transparent 70%);
          top: -100px;
          left: -100px;
        }
        .orb-2 {
          width: 250px;
          height: 250px;
          background: radial-gradient(circle, #65a30d 0%, transparent 70%);
          bottom: -80px;
          right: -80px;
          animation-delay: -7s;
        }
        .orb-3 {
          width: 200px;
          height: 200px;
          background: radial-gradient(circle, #a3e635 0%, transparent 70%);
          top: 40%;
          left: 50%;
          transform: translate(-50%, -50%);
          animation-delay: -14s;
        }
        @keyframes orbFloat {
          0%,
          100% {
            transform: translate(0, 0) scale(1);
          }
          33% {
            transform: translate(30px, -30px) scale(1.1);
          }
          66% {
            transform: translate(-20px, 20px) scale(0.9);
          }
        }
        .ambient-noise {
          position: absolute;
          inset: 0;
          opacity: 0.6;
          pointer-events: none;
        }
        .glass-container {
          position: relative;
          height: 100%;
          display: flex;
          flex-direction: column;
          padding: 24px 16px;
          background: rgba(0, 0, 0, 0.7);
          backdrop-filter: blur(20px) saturate(180%);
          border-right: 1px solid rgba(132, 204, 22, 0.1);
          z-index: 1;
        }
        .logo-section {
          position: relative;
          display: flex;
          align-items: center;
          gap: 14px;
          padding: 16px 12px;
          margin-bottom: 32px;
          border-radius: 20px;
          overflow: hidden;
        }
        .logo-backdrop {
          position: absolute;
          inset: 0;
          background: linear-gradient(
            135deg,
            rgb(0, 0, 0),
            rgba(101, 163, 13, 0.04)
          );
          border: 1px solid rgba(132, 204, 22, 0.15);
          border-radius: 20px;
          pointer-events: none;
        }
        .logo-wrapper {
          position: relative;
          width: 54px;
          height: 54px;
          flex-shrink: 0;
        }
        .logo-pulse {
          position: absolute;
          inset: -6px;
          background: radial-gradient(
            circle,
            #4e30028c,
            transparent 50%
          );
          border-radius: 50%;
          animation: logoPulse 3s ease-in-out infinite;
          pointer-events: none;
        }
        @keyframes logoPulse {
          0%,
          100% {
            transform: scale(0.8);
            opacity: 0.5;
          }
          50% {
            transform: scale(1.2);
            opacity: 1;
          }
        }
        .logo-icon {
          position: relative;
          width: 54px;
          height: 54px;
          border-radius: 50%;
          background: linear-gradient(135deg, #84cc16, #65a30d);
          display: flex;
          align-items: center;
          justify-content: center;
          color: #000;
          box-shadow: 0 0 12px rgba(132, 204, 22, 0.4);
          overflow: hidden;
          border: 1px solid #503103a2;
        }
        .logo-image {
          width: 100%;
          height: 100%;
          object-fit: cover;
          border-radius: 50%;
        }
        .logo-text h1 {
          font-family: "Syne", sans-serif;
          font-size: 24px;
          font-weight: 800;
          margin: 0;
          letter-spacing: 1px;
          background: linear-gradient(135deg, #fff, #84cc16);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }
        .logo-text p {
          font-size: 9px;
          font-weight: 600;
          letter-spacing: 0.5px;
          margin: 2px 0 0;
          color: rgba(163, 163, 163, 0.8);
          text-transform: uppercase;
        }
        .nav-container {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 4px;
          overflow-y: auto;
        }
        .nav-item {
          position: relative;
          display: flex;
          align-items: center;
          gap: 14px;
          padding: 18px 16px;
          background: transparent;
          border: 1px solid rgba(68, 68, 68, 0.3);
          border-radius: 4px;
          color: #a3a3a3;
          font-size: 15px;
          font-weight: 600;
          cursor: pointer;
          overflow: hidden;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          animation: itemSlide 0.6s cubic-bezier(0.4, 0, 0.2, 1) backwards;
          outline: none;
        }
        @keyframes itemSlide {
          from {
            opacity: 0;
            transform: translateX(-30px);
          }
        }
        .nav-item:hover:not(.nav-item-active) {
          transform: scale(1.012) translateX(2px);
          color: #d4d4d4;
        }
        .item-glass {
          position: absolute;
          inset: 0;
          border-radius: 4px;
          opacity: 0;
          transition: all 0.4s;
          pointer-events: none;
        }
        .item-glass-active {
          opacity: 1;
          background: rgba(132, 204, 22, 0.08);
          border: 1px solid rgba(132, 204, 22, 0.2);
          box-shadow: 0 8px 32px rgba(132, 204, 22, 0.15);
        }
        .active-beam {
          position: absolute;
          left: 0;
          top: 50%;
          transform: translateY(-50%);
          width: 4px;
          height: 70%;
          background: linear-gradient(180deg, #84cc16, #65a30d);
          border-radius: 0 4px 4px 0;
          box-shadow: 0 0 20px rgba(132, 204, 22, 0.6);
          animation: beamPulse 2s ease-in-out infinite;
          pointer-events: none;
        }
        @keyframes beamPulse {
          0%,
          100% {
            opacity: 1;
          }
          50% {
            opacity: 0.7;
          }
        }
        .active-glow {
          position: absolute;
          inset: 0;
          background: radial-gradient(
            circle at left,
            rgba(132, 204, 22, 0.15) 0%,
            transparent 70%
          );
          pointer-events: none;
        }
        .icon-container {
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
          width: 24px;
          height: 24px;
          z-index: 2;
        }
        .icon-halo {
          position: absolute;
          inset: -10px;
          background: radial-gradient(
            circle,
            rgba(132, 204, 22, 0.4) 0%,
            transparent 70%
          );
          border-radius: 50%;
          opacity: 0;
          transition: opacity 0.4s;
          pointer-events: none;
        }
        .icon-halo-visible {
          opacity: 1;
          animation: haloExpand 2s ease-in-out infinite;
        }
        @keyframes haloExpand {
          0%,
          100% {
            transform: scale(0.8);
          }
          50% {
            transform: scale(1.2);
          }
        }
        .item-label {
          position: relative;
          z-index: 2;
        }
        .nav-item-active {
          color: #84cc16;
          transform: translateX(4px);
        }
        .nav-item-active .item-label {
          font-weight: 700;
          text-shadow: 0 0 20px rgba(132, 204, 22, 0.4);
        }
        .hover-shimmer {
          position: absolute;
          top: 0;
          left: -100%;
          width: 100%;
          height: 100%;
          background: linear-gradient(
            90deg,
            transparent,
            rgba(132, 204, 22, 0.1),
            transparent
          );
          animation: shimmer 1.5s ease-in-out;
          pointer-events: none;
        }
        @keyframes shimmer {
          to {
            left: 100%;
          }
        }

        /* ── LOGOUT ───────────────────────────────────── */
        .logout-container {
          display: flex;
          justify-content: center;
          width: 100%;
          margin-top: 12px;
        }
        .logout-btn {
          width: 60%;
          border-radius: 15px;
          justify-content: center;
          color: #ef4444;
          border-color: rgba(239, 68, 68, 0.5);
          background: rgba(239, 68, 68, 0.08);
        }
        .logout-btn:hover {
          color: #ef4444;
          background: rgba(239, 68, 68, 0.14);
          transform: scale(1.02);
        }
        .logout-glass.item-glass-active {
          background: rgba(239, 68, 68, 0.1);
          border-color: rgba(239, 68, 68, 0.3);
        }
        .logout-halo {
          background: radial-gradient(
            circle,
            rgba(239, 68, 68, 0.4) 0%,
            transparent 70%
          );
        }
        .logout-shimmer {
          background: linear-gradient(
            90deg,
            transparent,
            rgba(239, 68, 68, 0.14),
            transparent
          );
        }

        /* ── FOOTER ───────────────────────────────────── */
        .footer-section {
          position: relative;
          padding: 0;
          margin-top: 16px;
          border-radius: 16px;
          overflow: hidden;
        }
        .footer-glass {
          position: absolute;
          inset: 0;
          background: rgba(132, 204, 22, 0.03);
          border: 1px solid rgba(132, 204, 22, 0.1);
          border-radius: 16px;
          pointer-events: none;
        }
        .social-grid {
          position: relative;
          z-index: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 10px;
          padding: 12px;
        }
        .footer-title {
          background: #0000007c;
          padding: 4px 8px;
          border-radius: 12px;
          border: 1px solid #4444;
          font-size: 12px;
          font-weight: 600;
          color: #a3a3a3;
          margin: 0;
        }
        .footer-content {
          gap: 6px;
          display: flex;
        }
        .social-item {
          width: 42px;
          height: 42px;
          border-radius: 12px;
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.08);
          display: flex;
          align-items: center;
          justify-content: center;
          color: #a3a3a3;
          font-size: 18px;
          cursor: pointer;
          transition: all 0.4s;
        }
        .social-item:hover {
          background: rgba(132, 204, 22, 0.12);
          border-color: rgba(132, 204, 22, 0.3);
          color: #84cc16;
          transform: translateY(-4px) scale(1.05);
        }
      `}</style>
    </>
  );
};

export default Sidebar;