import React, { useState } from "react";
import { X, Check, Palette } from "lucide-react";

const BackgroundSwitcher = ({ show, onClose, currentTheme, onThemeChange }) => {
  const [hoveredTheme, setHoveredTheme] = useState(null);

  const themes = [
    {
      id: "space",
      name: "Space",
      icon: "🌌",
      description: "Cosmic stars & nebula",
      preview:
        "radial-gradient(circle at 30% 40%, rgba(138, 43, 226, 0.3) 0%, transparent 50%), radial-gradient(circle at 70% 60%, rgba(75, 0, 130, 0.2) 0%, transparent 40%), #000000",
    },
    {
      id: "neon",
      name: "Neon Glow",
      icon: "✨",
      description: "Vibrant neon particles",
      preview:
        "radial-gradient(circle at 25% 25%, rgba(255, 0, 110, 0.3) 0%, transparent 35%), radial-gradient(circle at 75% 75%, rgba(131, 56, 236, 0.3) 0%, transparent 35%), radial-gradient(circle at 50% 50%, rgba(255, 190, 11, 0.25) 0%, transparent 30%), #000000",
    },
    {
      id: "tech",
      name: "Tech Grid",
      icon: "🎮",
      description: "Circuit board lines",
      preview:
        "repeating-linear-gradient(0deg, transparent, transparent 15px, rgba(0, 255, 136, 0.08) 15px, rgba(0, 255, 136, 0.08) 16px), #000000",
    },
    {
      id: "matrix",
      name: "Matrix",
      icon: "⚡",
      description: "Digital code rain",
      preview:
        "repeating-linear-gradient(90deg, transparent, transparent 40px, rgba(0, 255, 0, 0.05) 40px, rgba(0, 255, 0, 0.05) 41px), #000000",
    },
    {
      id: "security",
      name: "Security",
      icon: "🔒",
      description: "Hexagon network",
      preview:
        "radial-gradient(circle at 50% 50%, rgba(156, 255, 0, 0.08) 0%, transparent 50%), #000000",
    },
    {
      id: "minimal",
      name: "Minimal",
      icon: "⬛",
      description: "Clean darkness",
      preview: "linear-gradient(135deg, #000000 0%, #0a0a0a 100%)",
    },
    {
      id: "lime",
      name: "Lime Accent",
      icon: "💚",
      description: "Electric green glow",
      preview:
        "radial-gradient(circle at 30% 50%, rgba(156, 255, 0, 0.15) 0%, transparent 60%), linear-gradient(135deg, #000000 0%, #0a0a0a 100%)",
    },
    {
      id: "gold",
      name: "Gold Lux",
      icon: "✨",
      description: "Golden luxury",
      preview:
        "radial-gradient(circle at 30% 50%, rgba(255, 215, 0, 0.15) 0%, transparent 60%), linear-gradient(135deg, #000000 0%, #0a0a0a 100%)",
    },
    {
      id: "noir",
      name: "Pure Noir",
      icon: "🌑",
      description: "Absolute black",
      preview: "#000000",
    },
    {
      id: "midnight",
      name: "Midnight",
      icon: "🌃",
      description: "Dual soft glow",
      preview:
        "radial-gradient(circle at 50% 50%, rgba(156, 255, 0, 0.06) 0%, transparent 60%), radial-gradient(circle at 80% 20%, rgba(255, 215, 0, 0.06) 0%, transparent 60%), #000000",
    },
  ];

  if (!show) return null;

  return (
    <>
      <div className="background-switcher-overlay" onClick={onClose}>
        <div
          className="background-switcher-panel"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="switcher-header">
            <div className="header-content">
              <div className="header-icon-wrapper">
                <Palette size={24} className="header-icon" />
              </div>
              <div className="header-text">
                <h2>Background Themes</h2>
                <p>Choose your chat atmosphere</p>
              </div>
            </div>
            <button className="close-switcher" onClick={onClose}>
              <X size={20} />
            </button>
          </div>

          <div className="themes-grid">
            {themes.map((theme) => (
              <div
                key={theme.id}
                className={`theme-card ${currentTheme === theme.id ? "active" : ""} ${hoveredTheme === theme.id ? "hovered" : ""}`}
                onClick={() => {
                  onThemeChange(theme.id);
                  setTimeout(() => onClose(), 250);
                }}
                onMouseEnter={() => setHoveredTheme(theme.id)}
                onMouseLeave={() => setHoveredTheme(null)}
              >
                <div
                  className="theme-preview"
                  style={{
                    background: theme.preview,
                  }}
                >
                  <div className="theme-icon">{theme.icon}</div>
                  <div className="theme-overlay"></div>

                  {currentTheme === theme.id && (
                    <div className="active-indicator">
                      <Check size={22} strokeWidth={3} />
                    </div>
                  )}
                </div>
                <div className="theme-info">
                  <h3 className="theme-name">{theme.name}</h3>
                  <p className="theme-description">{theme.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <style>{`
        .background-switcher-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.92);
          backdrop-filter: blur(20px);
          z-index: 15000;
          display: flex;
          align-items: center;
          justify-content: center;
          animation: overlayFadeIn 0.25s cubic-bezier(0.4, 0, 0.2, 1);
          padding: 20px;
        }

        @keyframes overlayFadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        .background-switcher-panel {
          background: linear-gradient(135deg, rgba(10, 10, 10, 0.98) 0%, rgba(5, 5, 5, 0.98) 100%);
          border: 2px solid rgba(156, 255, 0, 0.2);
          border-radius: 24px;
          max-width: 1000px;
          width: 100%;
          max-height: 90vh;
          overflow: hidden;
          box-shadow: 0 24px 80px rgba(0, 0, 0, 0.9), 0 0 120px rgba(156, 255, 0, 0.1);
          animation: panelSlideUp 0.35s cubic-bezier(0.4, 0, 0.2, 1);
          display: flex;
          flex-direction: column;
        }

        @keyframes panelSlideUp {
          from { opacity: 0; transform: translateY(40px) scale(0.96); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }

        .switcher-header {
          padding: 24px 28px;
          border-bottom: 2px solid rgba(156, 255, 0, 0.1);
          display: flex;
          justify-content: space-between;
          align-items: center;
          background: linear-gradient(180deg, rgba(15, 15, 15, 0.6) 0%, transparent 100%);
          flex-shrink: 0;
        }

        .header-content {
          display: flex;
          align-items: center;
          gap: 16px;
        }

        .header-icon-wrapper {
          width: 52px;
          height: 52px;
          background: linear-gradient(135deg, #9cff00 0%, #7acc00 100%);
          border-radius: 14px;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 6px 20px rgba(156, 255, 0, 0.3);
        }

        .header-icon {
          color: #000;
        }

        .header-text h2 {
          font-size: 21px;
          font-weight: 800;
          color: #fff;
          margin: 0 0 4px 0;
          letter-spacing: -0.5px;
        }

        .header-text p {
          font-size: 13px;
          color: #999;
          margin: 0;
        }

        .close-switcher {
          width: 42px;
          height: 42px;
          border-radius: 12px;
          background: rgba(15, 15, 15, 0.6);
          border: 2px solid rgba(40, 40, 40, 0.8);
          color: #999;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .close-switcher:hover {
          background: rgba(20, 20, 20, 0.9);
          border-color: rgba(156, 255, 0, 0.4);
          color: #9cff00;
          transform: rotate(90deg);
        }

        .themes-grid {
          padding: 28px;
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
          gap: 20px;
          overflow-y: auto;
          flex: 1;
        }

        .themes-grid::-webkit-scrollbar { width: 8px; }
        .themes-grid::-webkit-scrollbar-track { background: rgba(15, 15, 15, 0.3); border-radius: 4px; }
        .themes-grid::-webkit-scrollbar-thumb { background: rgba(156, 255, 0, 0.25); border-radius: 4px; }
        .themes-grid::-webkit-scrollbar-thumb:hover { background: rgba(156, 255, 0, 0.4); }

        .theme-card {
          background: rgba(15, 15, 15, 0.4);
          border: 2px solid rgba(40, 40, 40, 0.6);
          border-radius: 18px;
          overflow: hidden;
          cursor: pointer;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .theme-card:hover {
          background: rgba(20, 20, 20, 0.7);
          border-color: rgba(156, 255, 0, 0.35);
          transform: translateY(-6px);
          box-shadow: 0 16px 40px rgba(0, 0, 0, 0.7), 0 0 50px rgba(156, 255, 0, 0.12);
        }

        .theme-card.active {
          border-color: rgba(156, 255, 0, 0.7);
          box-shadow: 0 8px 32px rgba(156, 255, 0, 0.25);
          background: rgba(20, 20, 20, 0.6);
        }

        .theme-card.active:hover {
          border-color: rgba(156, 255, 0, 0.9);
          box-shadow: 0 16px 48px rgba(156, 255, 0, 0.3);
        }

        .theme-preview {
          height: 200px;
          position: relative;
          overflow: hidden;
          display: flex;
          align-items: center;
          justify-content: center;
          background-size: cover !important;
          background-position: center !important;
          background-repeat: no-repeat !important;
        }

        .theme-icon {
          font-size: 56px;
          filter: drop-shadow(0 6px 16px rgba(0, 0, 0, 0.9));
          z-index: 2;
          position: relative;
          transition: transform 0.3s ease;
        }

        .theme-card:hover .theme-icon {
          transform: scale(1.1);
        }

        .theme-overlay {
          position: absolute;
          inset: 0;
          background: radial-gradient(circle at center, transparent 0%, rgba(0, 0, 0, 0.5) 100%);
          pointer-events: none;
          z-index: 1;
        }

        .active-indicator {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          width: 64px;
          height: 64px;
          background: rgba(0, 0, 0, 0.95);
          border: 3px solid #9cff00;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #9cff00;
          box-shadow: 0 8px 32px rgba(156, 255, 0, 0.5), 0 0 60px rgba(156, 255, 0, 0.3);
          animation: checkPulse 0.4s cubic-bezier(0.4, 0, 0.2, 1);
          backdrop-filter: blur(10px);
          z-index: 3;
        }

        @keyframes checkPulse {
          0% { transform: translate(-50%, -50%) scale(0.7); opacity: 0; }
          50% { transform: translate(-50%, -50%) scale(1.12); }
          100% { transform: translate(-50%, -50%) scale(1); opacity: 1; }
        }

        .theme-info { 
          padding: 18px 20px; 
          background: rgba(10, 10, 10, 0.5);
        }
        
        .theme-name { 
          font-size: 16px; 
          font-weight: 700; 
          color: #fff; 
          margin: 0 0 5px 0; 
          letter-spacing: -0.3px;
        }
        
        .theme-description { 
          font-size: 12px; 
          color: #999; 
          margin: 0; 
          line-height: 1.4;
        }

        @media (max-width: 768px) {
          .background-switcher-panel { 
            max-width: 100%; 
            max-height: 96vh; 
            border-radius: 20px 20px 0 0; 
            margin-top: auto;
          }
          .themes-grid { 
            grid-template-columns: repeat(auto-fill, minmax(170px, 1fr)); 
            gap: 16px; 
            padding: 20px; 
          }
          .theme-preview { height: 160px; }
          .theme-icon { font-size: 48px; }
          .header-icon-wrapper { width: 48px; height: 48px; }
          .header-text h2 { font-size: 19px; }
          .switcher-header { padding: 20px; }
        }

        @media (max-width: 480px) {
          .themes-grid { 
            grid-template-columns: repeat(auto-fill, minmax(145px, 1fr)); 
          }
          .theme-preview { height: 140px; }
          .theme-icon { font-size: 40px; }
        }
      `}</style>
    </>
  );
};

export default BackgroundSwitcher;
