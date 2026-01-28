import React, { useState } from "react";
import { X, Check, ImageIcon, Palette } from "lucide-react";

const BackgroundSwitcher = ({ show, onClose, currentTheme, onThemeChange }) => {
  const [hoveredTheme, setHoveredTheme] = useState(null);

  const themes = [
    {
      id: "security",
      name: "Security",
      type: "image",
      description: "Professional & secure",
      preview: "/Assets/backgrounds/security-preview.jpg",
    },
    {
      id: "space",
      name: "Space",
      type: "image",
      description: "Cosmic & infinite",
      preview: "/Assets/backgrounds/space-preview.jpg",
    },
    {
      id: "neon",
      name: "Neon",
      type: "image",
      description: "Vibrant & energetic",
      preview: "/Assets/backgrounds/neon-preview.jpg",
    },
    {
      id: "tech",
      name: "Tech",
      type: "image",
      description: "Modern & futuristic",
      preview: "/Assets/backgrounds/tech-preview.jpg",
    },
    {
      id: "matrix",
      name: "Matrix",
      type: "image",
      description: "Digital & mysterious",
      preview: "/Assets/backgrounds/matrix-preview.jpg",
    },
    {
      id: "minimal",
      name: "Minimal",
      type: "gradient",
      description: "Clean & simple",
      gradient: "linear-gradient(135deg, #0a0a0a 0%, #1a1a1a 100%)",
    },
    {
      id: "lime",
      name: "Lime Glow",
      type: "gradient",
      description: "Electric lime accent",
      gradient:
        "radial-gradient(circle at 30% 50%, rgba(156, 255, 0, 0.15) 0%, transparent 60%), linear-gradient(135deg, #0a0a0a 0%, #1a1a1a 100%)",
    },
    {
      id: "gold",
      name: "Gold Glow",
      type: "gradient",
      description: "Golden luxury",
      gradient:
        "radial-gradient(circle at 30% 50%, rgba(255, 215, 0, 0.15) 0%, transparent 60%), linear-gradient(135deg, #0a0a0a 0%, #1a1a1a 100%)",
    },
    {
      id: "noir",
      name: "Noir",
      type: "gradient",
      description: "Pure darkness",
      gradient:
        "linear-gradient(135deg, #000000 0%, #0a0a0a 50%, #1a1a1a 100%)",
    },
    {
      id: "midnight",
      name: "Midnight",
      type: "gradient",
      description: "Subtle dual glow",
      gradient:
        "radial-gradient(circle at 50% 50%, rgba(156, 255, 0, 0.06) 0%, transparent 70%), radial-gradient(circle at 80% 20%, rgba(255, 215, 0, 0.06) 0%, transparent 70%), linear-gradient(135deg, #000000 0%, #0a0a0a 100%)",
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
              <div className="header-icon">🎨</div>
              <div className="header-text">
                <h2>Choose Background</h2>
                <p>Personalize your chat experience</p>
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
                  setTimeout(() => onClose(), 200);
                }}
                onMouseEnter={() => setHoveredTheme(theme.id)}
                onMouseLeave={() => setHoveredTheme(null)}
              >
                <div
                  className="theme-preview"
                  style={{
                    background:
                      theme.type === "gradient" ? theme.gradient : "#0a0a0a",
                    backgroundImage:
                      theme.type === "image" ? `url(${theme.preview})` : "none",
                    backgroundSize: "cover",
                    backgroundPosition: "center",
                  }}
                >
                  <div className="theme-type-badge">
                    {theme.type === "image" ? (
                      <ImageIcon size={14} />
                    ) : (
                      <Palette size={14} />
                    )}
                  </div>
                  {currentTheme === theme.id && (
                    <div className="active-indicator">
                      <Check size={24} strokeWidth={3} />
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
          background: rgba(0, 0, 0, 0.85);
          backdrop-filter: blur(12px);
          z-index: 15000;
          display: flex;
          align-items: center;
          justify-content: center;
          animation: overlayFadeIn 0.2s ease;
          padding: 20px;
        }

        @keyframes overlayFadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        .background-switcher-panel {
          background: rgba(15, 15, 15, 0.98);
          border: 2px solid rgba(156, 255, 0, 0.3);
          border-radius: 24px;
          max-width: 900px;
          width: 100%;
          max-height: 90vh;
          overflow: hidden;
          box-shadow: 0 24px 80px rgba(0, 0, 0, 0.8), 0 0 120px rgba(156, 255, 0, 0.15);
          animation: panelSlideUp 0.3s ease;
          display: flex;
          flex-direction: column;
        }

        @keyframes panelSlideUp {
          from { opacity: 0; transform: translateY(30px) scale(0.95); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }

        .switcher-header {
          padding: 24px;
          border-bottom: 2px solid rgba(156, 255, 0, 0.15);
          display: flex;
          justify-content: space-between;
          align-items: center;
          background: linear-gradient(180deg, rgba(26, 26, 26, 0.8) 0%, rgba(15, 15, 15, 0) 100%);
          flex-shrink: 0;
        }

        .header-content {
          display: flex;
          align-items: center;
          gap: 16px;
        }

        .header-icon {
          width: 56px;
          height: 56px;
          background: linear-gradient(135deg, #9cff00 0%, #ffd700 100%);
          border-radius: 16px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 28px;
          box-shadow: 0 8px 24px rgba(156, 255, 0, 0.3);
        }

        .header-text h2 {
          font-size: 22px;
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
          width: 44px;
          height: 44px;
          border-radius: 12px;
          background: rgba(26, 26, 26, 0.6);
          border: 2px solid rgba(42, 42, 42, 0.8);
          color: #999;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s;
        }

        .close-switcher:hover {
          background: rgba(26, 26, 26, 0.9);
          border-color: rgba(156, 255, 0, 0.4);
          color: #9cff00;
          transform: rotate(90deg);
        }

        .themes-grid {
          padding: 24px;
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
          gap: 16px;
          overflow-y: auto;
          flex: 1;
        }

        .themes-grid::-webkit-scrollbar { width: 8px; }
        .themes-grid::-webkit-scrollbar-track { background: rgba(26, 26, 26, 0.3); }
        .themes-grid::-webkit-scrollbar-thumb { background: rgba(156, 255, 0, 0.3); border-radius: 4px; }

        .theme-card {
          background: rgba(26, 26, 26, 0.4);
          border: 2px solid rgba(42, 42, 42, 0.6);
          border-radius: 16px;
          overflow: hidden;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .theme-card:hover {
          background: rgba(26, 26, 26, 0.8);
          border-color: rgba(156, 255, 0, 0.4);
          transform: translateY(-4px);
          box-shadow: 0 12px 32px rgba(0, 0, 0, 0.5), 0 0 40px rgba(156, 255, 0, 0.15);
        }

        .theme-card.active {
          border-color: rgba(156, 255, 0, 0.8);
          box-shadow: 0 0 32px rgba(156, 255, 0, 0.3);
        }

        .theme-preview {
          height: 160px;
          position: relative;
          overflow: hidden;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .theme-type-badge {
          position: absolute;
          top: 8px;
          right: 8px;
          width: 28px;
          height: 28px;
          background: rgba(0, 0, 0, 0.8);
          border: 1.5px solid rgba(156, 255, 0, 0.3);
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #9cff00;
        }

        .active-indicator {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          width: 56px;
          height: 56px;
          background: rgba(15, 15, 15, 0.95);
          border: 3px solid #9cff00;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #9cff00;
          box-shadow: 0 8px 24px rgba(156, 255, 0, 0.5);
          animation: checkPulse 0.3s ease;
        }

        @keyframes checkPulse {
          0% { transform: translate(-50%, -50%) scale(0.8); opacity: 0; }
          50% { transform: translate(-50%, -50%) scale(1.1); }
          100% { transform: translate(-50%, -50%) scale(1); opacity: 1; }
        }

        .theme-info { padding: 16px; }
        .theme-name { font-size: 16px; font-weight: 700; color: #fff; margin: 0 0 4px 0; }
        .theme-description { font-size: 12px; color: #999; margin: 0; }

        @media (max-width: 768px) {
          .background-switcher-panel { max-width: 100%; max-height: 95vh; border-radius: 20px 20px 0 0; }
          .themes-grid { grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 12px; padding: 16px; }
          .theme-preview { height: 120px; }
          .header-icon { width: 48px; height: 48px; font-size: 24px; }
          .header-text h2 { font-size: 18px; }
        }
      `}</style>
    </>
  );
};

export default BackgroundSwitcher;
