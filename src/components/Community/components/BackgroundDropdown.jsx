// components/Community/components/BackgroundDropdown.jsx - FIXED PREVIEWS
import React, { useState, useRef, useEffect } from "react";
import { Palette, Check } from "lucide-react";

const BackgroundDropdown = ({ currentTheme, onThemeChange, show, onClose }) => {
  const dropdownRef = useRef(null);

  useEffect(() => {
    if (!show) return;

    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        onClose();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [show, onClose]);

  const themes = [
    { 
      id: "space", 
      name: "Space Nebula", 
      icon: "🌌",
      preview: "radial-gradient(circle at 30% 40%, rgba(138, 43, 226, 0.4) 0%, transparent 50%), radial-gradient(circle at 70% 60%, rgba(75, 0, 130, 0.3) 0%, transparent 40%), #000000"
    },
    { 
      id: "neon", 
      name: "Neon Pulse", 
      icon: "✨",
      preview: "radial-gradient(circle at 25% 25%, rgba(255, 0, 110, 0.35) 0%, transparent 35%), radial-gradient(circle at 75% 75%, rgba(131, 56, 236, 0.35) 0%, transparent 35%), #000000"
    },
    { 
      id: "tech", 
      name: "Tech Grid", 
      icon: "🎮",
      preview: "repeating-linear-gradient(0deg, transparent, transparent 15px, rgba(0, 255, 136, 0.1) 15px, rgba(0, 255, 136, 0.1) 16px), #000000"
    },
    { 
      id: "matrix", 
      name: "Matrix Rain", 
      icon: "⚡",
      preview: "repeating-linear-gradient(90deg, transparent, transparent 40px, rgba(0, 255, 0, 0.08) 40px, rgba(0, 255, 0, 0.08) 41px), #000000"
    },
    { 
      id: "security", 
      name: "Cyber Shield", 
      icon: "🔒",
      preview: "radial-gradient(circle at 50% 50%, rgba(0, 191, 255, 0.12) 0%, transparent 50%), #000000"
    },
    { 
      id: "minimal", 
      name: "Pure Dark", 
      icon: "⬛",
      preview: "linear-gradient(135deg, #000000 0%, #0a0a0a 100%)"
    },
    { 
      id: "lime", 
      name: "Lime Glow", 
      icon: "💚",
      preview: "radial-gradient(circle at 30% 50%, rgba(156, 255, 0, 0.2) 0%, transparent 60%), linear-gradient(135deg, #000000 0%, #0a0a0a 100%)"
    },
    { 
      id: "gold", 
      name: "Golden Hour", 
      icon: "🌅",
      preview: "radial-gradient(circle at 30% 50%, rgba(255, 215, 0, 0.2) 0%, transparent 60%), linear-gradient(135deg, #000000 0%, #0a0a0a 100%)"
    },
    { 
      id: "noir", 
      name: "Absolute Void", 
      icon: "🌑",
      preview: "#000000"
    },
    { 
      id: "midnight", 
      name: "Midnight Sky", 
      icon: "🌃",
      preview: "radial-gradient(circle at 50% 50%, rgba(156, 255, 0, 0.08) 0%, transparent 60%), radial-gradient(circle at 80% 20%, rgba(255, 215, 0, 0.08) 0%, transparent 60%), #000000"
    },
    { 
      id: "ocean", 
      name: "Deep Ocean", 
      icon: "🌊",
      preview: "radial-gradient(circle at 40% 50%, rgba(0, 119, 182, 0.2) 0%, transparent 50%), radial-gradient(circle at 60% 30%, rgba(0, 150, 199, 0.15) 0%, transparent 40%), #000814"
    },
    { 
      id: "sunset", 
      name: "Sunset Vibes", 
      icon: "🌇",
      preview: "radial-gradient(circle at 30% 40%, rgba(255, 107, 107, 0.2) 0%, transparent 50%), radial-gradient(circle at 70% 60%, rgba(255, 159, 64, 0.15) 0%, transparent 40%), #0a0a0a"
    },
    { 
      id: "forest", 
      name: "Emerald Forest", 
      icon: "🌲",
      preview: "radial-gradient(circle at 35% 40%, rgba(34, 197, 94, 0.2) 0%, transparent 50%), #0a120a"
    },
    { 
      id: "aurora", 
      name: "Aurora Waves", 
      icon: "🌈",
      preview: "linear-gradient(90deg, rgba(16, 185, 129, 0.15), rgba(59, 130, 246, 0.15), rgba(168, 85, 247, 0.15)), #000000"
    },
    { 
      id: "cyber", 
      name: "Cyber Pink", 
      icon: "💖",
      preview: "radial-gradient(circle at 40% 50%, rgba(236, 72, 153, 0.2) 0%, transparent 50%), #0a0a0a"
    },
    { 
      id: "royal", 
      name: "Royal Purple", 
      icon: "👑",
      preview: "radial-gradient(circle at 40% 45%, rgba(109, 40, 217, 0.25) 0%, transparent 60%), #000000"
    },
  ];

  if (!show) return null;

  return (
    <div ref={dropdownRef} className="bg-dropdown">
      <div className="bg-dropdown-header">
        <Palette size={16} />
        <span>Backgrounds</span>
      </div>
      <div className="bg-dropdown-list">
        {themes.map((theme) => (
          <button
            key={theme.id}
            className={`bg-dropdown-item ${currentTheme === theme.id ? "active" : ""}`}
            onClick={() => {
              onThemeChange(theme.id);
              onClose();
            }}
          >
            <div 
              className="bg-preview" 
              style={{ background: theme.preview }}
            />
            <span className="bg-name">{theme.name}</span>
            {currentTheme === theme.id && (
              <Check size={14} className="bg-check" />
            )}
          </button>
        ))}
      </div>

      <style>{`
        .bg-dropdown {
          position: absolute;
          bottom: 60px;
          right: 12px;
          width: 260px;
          max-height: 400px;
          background: rgba(10, 10, 10, 0.98);
          border: 2px solid rgba(156, 255, 0, 0.2);
          border-radius: 12px;
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.9);
          z-index: 1000;
          display: flex;
          flex-direction: column;
          animation: dropdownSlide 0.2s ease-out;
        }

        @keyframes dropdownSlide {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .bg-dropdown-header {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 12px 16px;
          border-bottom: 1px solid rgba(156, 255, 0, 0.1);
          font-size: 13px;
          font-weight: 700;
          color: #9cff00;
        }

        .bg-dropdown-list {
          flex: 1;
          overflow-y: auto;
          padding: 6px;
        }

        .bg-dropdown-list::-webkit-scrollbar {
          width: 6px;
        }

        .bg-dropdown-list::-webkit-scrollbar-track {
          background: rgba(26, 26, 26, 0.3);
          border-radius: 3px;
        }

        .bg-dropdown-list::-webkit-scrollbar-thumb {
          background: rgba(156, 255, 0, 0.3);
          border-radius: 3px;
        }

        .bg-dropdown-item {
          width: 100%;
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 8px 10px;
          background: rgba(26, 26, 26, 0.4);
          border: 1px solid rgba(42, 42, 42, 0.6);
          border-radius: 8px;
          color: #ccc;
          font-size: 13px;
          cursor: pointer;
          transition: all 0.2s;
          margin-bottom: 4px;
        }

        .bg-dropdown-item:hover {
          background: rgba(26, 26, 26, 0.8);
          border-color: rgba(156, 255, 0, 0.3);
          color: #fff;
        }

        .bg-dropdown-item.active {
          background: rgba(156, 255, 0, 0.15);
          border-color: rgba(156, 255, 0, 0.5);
          color: #9cff00;
        }

        .bg-preview {
          width: 32px;
          height: 32px;
          border-radius: 6px;
          border: 1px solid rgba(255, 255, 255, 0.1);
          flex-shrink: 0;
        }

        .bg-name {
          flex: 1;
          text-align: left;
          font-weight: 500;
        }

        .bg-check {
          color: #9cff00;
          flex-shrink: 0;
        }

        @media (max-width: 768px) {
          .bg-dropdown {
            right: 8px;
            bottom: 56px;
            width: 240px;
          }
        }
      `}</style>
    </div>
  );
};

export default BackgroundDropdown;