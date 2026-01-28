import React, { useState } from 'react';
import { Home, Search, PlusSquare, Wallet, Users, Sparkles } from 'lucide-react';

const Sidebar = ({ activeTab, setActiveTab, sidebarOpen, setSidebarOpen }) => {
  const [hoveredItem, setHoveredItem] = useState(null);

  const navItems = [
    { id: 'home', icon: Home, label: 'Home', gradient: 'from-lime-500 to-emerald-500' },
    { id: 'search', icon: Search, label: 'Explore', gradient: 'from-blue-500 to-cyan-500' },
    { id: 'create', icon: PlusSquare, label: 'Create', gradient: 'from-purple-500 to-pink-500' },
    { id: 'community', icon: Users, label: 'Community', gradient: 'from-orange-500 to-red-500' },
    { id: 'wallet', icon: Wallet, label: 'Wallet', gradient: 'from-yellow-500 to-amber-500' }
  ];

  return (
    <div className={`sidebar ${sidebarOpen ? 'sidebar-open' : 'sidebar-closed'}`}>
      {/* Animated Background */}
      <div className="sidebar-bg-wrapper">
        <div className="sidebar-bg-gradient"></div>
        <div className="sidebar-bg-mesh"></div>
        <div className="sidebar-bg-particles"></div>
      </div>

      {/* Logo Section */}
      <div className="sidebar-logo">
        <div className="logo-glow"></div>
        <div className="logo-content">
          <div className="logo-icon-wrapper">
            <div className="logo-icon-bg"></div>
            <Sparkles className="logo-sparkle logo-sparkle-1" size={12} />
            <Sparkles className="logo-sparkle logo-sparkle-2" size={10} />
            <div className="logo-icon">G</div>
          </div>
          <div className="logo-text-container">
            <h1 className="logo-title">
              <span className="logo-letter logo-letter-g">G</span>
              <span className="logo-letter logo-letter-r">R</span>
              <span className="logo-letter logo-letter-o">O</span>
              <span className="logo-letter logo-letter-v">V</span>
              <span className="logo-letter logo-letter-a">A</span>
            </h1>
            <p className="logo-tagline">
              <span className="tagline-word">Every</span>
              <span className="tagline-word">Word</span>
              <span className="tagline-word">Seeds</span>
              <span className="tagline-word">Value</span>
            </p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="sidebar-nav">
        {navItems.map((item, index) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          const isHovered = hoveredItem === item.id;
          
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              onMouseEnter={() => setHoveredItem(item.id)}
              onMouseLeave={() => setHoveredItem(null)}
              className={`sidebar-btn ${isActive ? 'sidebar-btn-active' : ''}`}
              style={{ '--item-index': index }}
            >
              {/* Hover/Active Background */}
              <div className={`btn-bg ${isActive || isHovered ? 'btn-bg-visible' : ''}`}>
                <div className={`btn-gradient bg-gradient-to-r ${item.gradient}`}></div>
              </div>

              {/* Active Indicator */}
              <div className={`btn-indicator ${isActive ? 'btn-indicator-active' : ''}`}></div>

              {/* Icon with Glow */}
              <div className="btn-icon-wrapper">
                <div className={`btn-icon-glow ${isActive || isHovered ? 'btn-icon-glow-active' : ''} bg-gradient-to-r ${item.gradient}`}></div>
                <Icon size={22} strokeWidth={isActive ? 2.5 : 2} className="btn-icon" />
              </div>

              {/* Label */}
              <span className="btn-label">{item.label}</span>

              {/* Particle Effect on Hover */}
              {(isActive || isHovered) && (
                <>
                  <span className="btn-particle btn-particle-1"></span>
                  <span className="btn-particle btn-particle-2"></span>
                  <span className="btn-particle btn-particle-3"></span>
                </>
              )}
            </button>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="sidebar-footer">
        <div className="footer-glow"></div>
        <div className="social-container">
          <button className="social-btn" aria-label="X (Twitter)">
            <div className="social-ripple"></div>
            <i className="fa-brands fa-x-twitter"></i>
          </button>
          <button className="social-btn" aria-label="Facebook">
            <div className="social-ripple"></div>
            <i className="bx bxl-facebook"></i>
          </button>
          <button className="social-btn" aria-label="Discord">
            <div className="social-ripple"></div>
            <i className="bx bxl-discord-alt"></i>
          </button>
          <button className="social-btn" aria-label="TikTok">
            <div className="social-ripple"></div>
            <i className="fa-brands fa-tiktok"></i>
          </button>
        </div>
      </div>

      <style jsx>{`
        /* Background Effects */
        .sidebar-bg-wrapper {
          position: absolute;
          inset: 0;
          overflow: hidden;
          pointer-events: none;
        }

        .sidebar-bg-gradient {
          position: absolute;
          inset: 0;
          background: linear-gradient(180deg, 
            rgba(132, 204, 22, 0.03) 0%,
            rgba(101, 163, 13, 0.02) 50%,
            rgba(132, 204, 22, 0.03) 100%
          );
          animation: gradientShift 8s ease-in-out infinite;
        }

        @keyframes gradientShift {
          0%, 100% { opacity: 0.5; }
          50% { opacity: 1; }
        }

        .sidebar-bg-mesh {
          position: absolute;
          inset: 0;
          background-image: 
            linear-gradient(rgba(132, 204, 22, 0.03) 1px, transparent 1px),
            linear-gradient(90deg, rgba(132, 204, 22, 0.03) 1px, transparent 1px);
          background-size: 20px 20px;
          animation: meshMove 20s linear infinite;
        }

        @keyframes meshMove {
          0% { transform: translate(0, 0); }
          100% { transform: translate(20px, 20px); }
        }

        .sidebar-bg-particles {
          position: absolute;
          inset: 0;
          background-image: 
            radial-gradient(circle at 20% 30%, rgba(132, 204, 22, 0.1) 0%, transparent 50%),
            radial-gradient(circle at 80% 70%, rgba(132, 204, 22, 0.08) 0%, transparent 50%),
            radial-gradient(circle at 40% 80%, rgba(132, 204, 22, 0.06) 0%, transparent 50%);
          animation: particleFloat 15s ease-in-out infinite;
        }

        @keyframes particleFloat {
          0%, 100% { transform: translateY(0) scale(1); opacity: 0.3; }
          50% { transform: translateY(-20px) scale(1.1); opacity: 0.6; }
        }

        /* Logo Section */
        .sidebar-logo {
          padding: 24px 20px 28px;
          border-bottom: 1px solid rgba(132, 204, 22, 0.2);
          margin-bottom: 24px;
          position: relative;
        }

        .logo-glow {
          position: absolute;
          inset: 0;
          background: radial-gradient(circle at center, rgba(132, 204, 22, 0.1) 0%, transparent 70%);
          animation: logoGlow 3s ease-in-out infinite;
        }

        @keyframes logoGlow {
          0%, 100% { opacity: 0.5; }
          50% { opacity: 1; }
        }

        .logo-content {
          display: flex;
          align-items: center;
          gap: 14px;
          position: relative;
          z-index: 1;
        }

        .logo-icon-wrapper {
          position: relative;
          width: 52px;
          height: 52px;
          flex-shrink: 0;
        }

        .logo-icon-bg {
          position: absolute;
          inset: -4px;
          border-radius: 16px;
          background: linear-gradient(135deg, #84cc16 0%, #65a30d 100%);
          filter: blur(8px);
          opacity: 0.6;
          animation: iconPulse 2s ease-in-out infinite;
        }

        @keyframes iconPulse {
          0%, 100% { transform: scale(0.95); opacity: 0.6; }
          50% { transform: scale(1.05); opacity: 0.8; }
        }

        .logo-icon {
          position: relative;
          width: 52px;
          height: 52px;
          border-radius: 16px;
          background: linear-gradient(135deg, #84cc16 0%, #65a30d 100%);
          display: flex;
          align-items: center;
          justify-content: center;
          color: #000;
          font-size: 28px;
          font-weight: 900;
          box-shadow: 
            0 8px 32px rgba(132, 204, 22, 0.4),
            inset 0 2px 8px rgba(255, 255, 255, 0.3);
        }

        .logo-sparkle {
          position: absolute;
          color: #fff;
          opacity: 0;
          animation: sparkle 2s ease-in-out infinite;
        }

        .logo-sparkle-1 {
          top: -2px;
          right: -2px;
          animation-delay: 0s;
        }

        .logo-sparkle-2 {
          bottom: 2px;
          left: 2px;
          animation-delay: 1s;
        }

        @keyframes sparkle {
          0%, 100% { opacity: 0; transform: scale(0) rotate(0deg); }
          50% { opacity: 1; transform: scale(1) rotate(180deg); }
        }

        .logo-text-container {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .logo-title {
          font-size: 24px;
          font-weight: 900;
          margin: 0;
          letter-spacing: 2px;
          display: flex;
          gap: 1px;
        }

        .logo-letter {
          display: inline-block;
          background: linear-gradient(135deg, #84cc16 0%, #65a30d 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          animation: letterFloat 3s ease-in-out infinite;
        }

        .logo-letter-g { animation-delay: 0s; }
        .logo-letter-r { animation-delay: 0.1s; }
        .logo-letter-o { animation-delay: 0.2s; }
        .logo-letter-v { animation-delay: 0.3s; }
        .logo-letter-a { animation-delay: 0.4s; }

        @keyframes letterFloat {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-2px); }
        }

        .logo-tagline {
          font-size: 9px;
          color: #737373;
          margin: 0;
          font-weight: 600;
          letter-spacing: 0.5px;
          display: flex;
          gap: 3px;
        }

        .tagline-word {
          display: inline-block;
          animation: wordFade 4s ease-in-out infinite;
        }

        .tagline-word:nth-child(1) { animation-delay: 0s; }
        .tagline-word:nth-child(2) { animation-delay: 0.2s; }
        .tagline-word:nth-child(3) { animation-delay: 0.4s; }
        .tagline-word:nth-child(4) { animation-delay: 0.6s; }

        @keyframes wordFade {
          0%, 100% { opacity: 0.5; }
          50% { opacity: 1; }
        }

        /* Navigation */
        .sidebar-nav {
          display: flex;
          flex-direction: column;
          gap: 6px;
          padding: 0 12px;
          flex: 1;
          position: relative;
          z-index: 1;
        }

        .sidebar-btn {
          display: flex;
          align-items: center;
          gap: 16px;
          padding: 16px 18px;
          background: transparent;
          border: none;
          border-radius: 16px;
          color: #a3a3a3;
          font-size: 15px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          position: relative;
          overflow: hidden;
          animation: btnSlideIn 0.5s cubic-bezier(0.4, 0, 0.2, 1);
          animation-delay: calc(var(--item-index) * 0.1s);
          animation-fill-mode: both;
        }

        @keyframes btnSlideIn {
          from {
            opacity: 0;
            transform: translateX(-20px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }

        .btn-bg {
          position: absolute;
          inset: 0;
          border-radius: 16px;
          opacity: 0;
          transition: opacity 0.3s;
        }

        .btn-bg-visible {
          opacity: 1;
        }

        .btn-gradient {
          position: absolute;
          inset: 0;
          opacity: 0.15;
        }

        .btn-indicator {
          position: absolute;
          left: 0;
          top: 50%;
          transform: translateY(-50%) scaleY(0);
          width: 4px;
          height: 60%;
          background: linear-gradient(180deg, #84cc16 0%, #65a30d 100%);
          border-radius: 0 4px 4px 0;
          transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          box-shadow: 0 0 12px rgba(132, 204, 22, 0.6);
        }

        .btn-indicator-active {
          transform: translateY(-50%) scaleY(1);
        }

        .btn-icon-wrapper {
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
          width: 24px;
          height: 24px;
          z-index: 2;
        }

        .btn-icon-glow {
          position: absolute;
          inset: -8px;
          border-radius: 50%;
          filter: blur(12px);
          opacity: 0;
          transition: opacity 0.3s;
        }

        .btn-icon-glow-active {
          opacity: 0.6;
        }

        .btn-icon {
          position: relative;
          z-index: 1;
          transition: transform 0.3s;
        }

        .btn-label {
          position: relative;
          z-index: 2;
          transition: all 0.3s;
        }

        .sidebar-btn:hover {
          transform: translateX(6px);
          color: #fff;
        }

        .sidebar-btn:hover .btn-icon {
          transform: scale(1.1) rotate(5deg);
        }

        .sidebar-btn-active {
          color: #fff;
          font-weight: 700;
        }

        .sidebar-btn-active .btn-label {
          text-shadow: 0 0 20px rgba(132, 204, 22, 0.5);
        }

        /* Particle Effects */
        .btn-particle {
          position: absolute;
          width: 4px;
          height: 4px;
          border-radius: 50%;
          background: #84cc16;
          opacity: 0;
          animation: particleBurst 1s ease-out infinite;
        }

        .btn-particle-1 {
          top: 20%;
          right: 20%;
          animation-delay: 0s;
        }

        .btn-particle-2 {
          top: 50%;
          right: 15%;
          animation-delay: 0.3s;
        }

        .btn-particle-3 {
          top: 70%;
          right: 25%;
          animation-delay: 0.6s;
        }

        @keyframes particleBurst {
          0% {
            opacity: 0;
            transform: translate(0, 0) scale(0);
          }
          50% {
            opacity: 1;
          }
          100% {
            opacity: 0;
            transform: translate(20px, -20px) scale(1);
          }
        }

        /* Footer */
        .sidebar-footer {
          padding: 24px 20px;
          border-top: 1px solid rgba(132, 204, 22, 0.2);
          position: relative;
        }

        .footer-glow {
          position: absolute;
          inset: 0;
          background: radial-gradient(circle at center bottom, rgba(132, 204, 22, 0.1) 0%, transparent 70%);
        }

        .social-container {
          display: flex;
          justify-content: center;
          gap: 10px;
          position: relative;
          z-index: 1;
        }

        .social-btn {
          position: relative;
          width: 44px;
          height: 44px;
          border-radius: 12px;
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.1);
          display: flex;
          align-items: center;
          justify-content: center;
          color: #a3a3a3;
          cursor: pointer;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          font-size: 18px;
          overflow: hidden;
        }

        .social-ripple {
          position: absolute;
          inset: 0;
          background: radial-gradient(circle, rgba(132, 204, 22, 0.3) 0%, transparent 70%);
          transform: scale(0);
          opacity: 0;
          transition: all 0.5s;
        }

        .social-btn:hover {
          background: rgba(132, 204, 22, 0.1);
          border-color: rgba(132, 204, 22, 0.4);
          color: #84cc16;
          transform: translateY(-4px) scale(1.05);
          box-shadow: 0 8px 24px rgba(132, 204, 22, 0.3);
        }

        .social-btn:hover .social-ripple {
          transform: scale(2);
          opacity: 1;
        }

        .social-btn:active {
          transform: translateY(-2px) scale(1);
        }
      `}</style>
    </div>
  );
};

export default Sidebar;