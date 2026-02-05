import React, { useState, useRef, useEffect, useCallback } from "react";
import { Smile, Image, Film, Paperclip, X } from "lucide-react";
import EmojiPanel from "./EmojiPanel";
import GifPanel from "./GifPanel";
import MemePanel from "./MemePanel";


const PANEL_WIDTH = 380;
const PANEL_HEIGHT = 450;
const TOOLBAR_HEIGHT = 52;
const TOOLBAR_GAP = 8; // gap between toolbar and panel

const MediaPopup = ({
  onEmojiSelect,
  onGifSelect,
  onMemeSelect,
  onFileSelect,
  onClose,
  triggerRect,
}) => {
  const [activePanel, setActivePanel] = useState(null); // "emoji" | "gif" | "meme" | null
  const toolbarRef = useRef(null);
  const fileInputRef = useRef(null);

  // ─── TOOLBAR POSITION ─────────────────────────────────────────────
  const getToolbarStyle = useCallback(() => {
    if (!triggerRect) return {};

    const vw = window.innerWidth;
    const vh = window.innerHeight;

    // Place toolbar just above the trigger button (the + button)
    let top = triggerRect.top - TOOLBAR_HEIGHT - 4;
    let left = triggerRect.left - 10;

    // Clamp
    if (top < 8) top = triggerRect.bottom + 4;
    if (left < 8) left = 8;
    if (left + 220 > vw - 8) left = vw - 228;

    return { position: "fixed", top, left, zIndex: 9998 };
  }, [triggerRect]);

  // ─── SUB-PANEL POSITION ───────────────────────────────────────────
  const getPanelStyle = useCallback(() => {
    if (!triggerRect) return {};

    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const midY = vh / 2;
    const midX = vw / 2;

    const triggerCenterY = triggerRect.top + triggerRect.height / 2;
    const triggerCenterX = triggerRect.left + triggerRect.width / 2;

    let top, left;

    // ── Vertical ──
    if (triggerCenterY > midY + 20) {
      // Click is below midpoint → open ABOVE
      top = triggerRect.top - TOOLBAR_HEIGHT - TOOLBAR_GAP - PANEL_HEIGHT;
    } else if (triggerCenterY < midY - 20) {
      // Click is above midpoint → open BELOW
      top = triggerRect.bottom + TOOLBAR_GAP + 4;
    } else {
      // Near middle → default above
      top = triggerRect.top - TOOLBAR_HEIGHT - TOOLBAR_GAP - PANEL_HEIGHT;
    }

    // ── Horizontal ──
    if (triggerCenterX > midX) {
      // Right half → open to the LEFT
      left = triggerRect.right - PANEL_WIDTH;
    } else {
      // Left half → open to the RIGHT
      left = triggerRect.left;
    }

    // ── Final clamp to viewport ──
    if (top < 8) top = 8;
    if (top + PANEL_HEIGHT > vh - 8) top = vh - PANEL_HEIGHT - 8;
    if (left < 8) left = 8;
    if (left + PANEL_WIDTH > vw - 8) left = vw - PANEL_WIDTH - 8;

    return { position: "fixed", top, left, zIndex: 9999 };
  }, [triggerRect]);

  // ─── FILE INPUT HANDLER ───────────────────────────────────────────
  const handleFileChange = (e) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      onFileSelect(files[0]);
    }
    onClose();
  };

  const openFileDialog = () => {
    if (fileInputRef.current) fileInputRef.current.click();
  };

  // ─── CLOSE ON OUTSIDE CLICK ──────────────────────────────────────
  useEffect(() => {
    const handler = (e) => {
      // If click is inside toolbar or inside an open panel, ignore
      if (toolbarRef.current && toolbarRef.current.contains(e.target)) return;
      // Check if click is on a panel (panels are rendered via portal-style fixed positioning)
      // We rely on stopPropagation inside panels, so if we get here it's outside
      onClose();
    };
    // Small delay so the opening click doesn't immediately close
    const timeout = setTimeout(() => {
      document.addEventListener("mousedown", handler);
    }, 100);
    return () => {
      clearTimeout(timeout);
      document.removeEventListener("mousedown", handler);
    };
  }, [onClose]);

  // Close sub-panel when pressing Escape
  useEffect(() => {
    const handler = (e) => {
      if (e.key === "Escape") {
        if (activePanel) {
          setActivePanel(null);
        } else {
          onClose();
        }
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [activePanel, onClose]);

  const toolbarStyle = getToolbarStyle();
  const panelStyle = getPanelStyle();

  const buttons = [
    { id: "emoji", icon: Smile, label: "Emoji", color: "#fdcb6e" },
    { id: "gif", icon: Image, label: "GIF", color: "#00cec9" },
    { id: "meme", icon: Film, label: "Meme", color: "#a29bfe" },
    { id: "file", icon: Paperclip, label: "File", color: "#74b9ff" },
  ];

  return (
    <>
      {/* Toolbar */}
      <div
        ref={toolbarRef}
        style={toolbarStyle}
        className="media-popup-toolbar"
        onClick={(e) => e.stopPropagation()}
      >
        {buttons.map((btn) => {
          const Icon = btn.icon;
          const isActive = activePanel === btn.id;
          return (
            <button
              key={btn.id}
              className={`media-popup-btn ${isActive ? "active" : ""}`}
              style={{ "--btn-color": btn.color }}
              title={btn.label}
              onClick={(e) => {
                e.stopPropagation();
                if (btn.id === "file") {
                  openFileDialog();
                  return;
                }
                setActivePanel(isActive ? null : btn.id);
              }}
            >
              <Icon size={20} />
              <span className="media-popup-btn-label">{btn.label}</span>
            </button>
          );
        })}
      </div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        style={{ display: "none" }}
        onChange={handleFileChange}
        accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.txt,.zip"
      />

      {/* Sub-panels — rendered at computed position */}
      {activePanel === "emoji" && (
        <div style={panelStyle} onClick={(e) => e.stopPropagation()}>
          <EmojiPanel
            onSelect={(emoji) => {
              onEmojiSelect(emoji);
              setActivePanel(null);
              onClose();
            }}
            onClose={() => setActivePanel(null)}
          />
        </div>
      )}

      {activePanel === "gif" && (
        <div style={panelStyle} onClick={(e) => e.stopPropagation()}>
          <GifPanel
            onSelect={(text) => {
              onGifSelect(text);
              setActivePanel(null);
              onClose();
            }}
            onClose={() => setActivePanel(null)}
          />
        </div>
      )}

      {activePanel === "meme" && (
        <div style={panelStyle} onClick={(e) => e.stopPropagation()}>
          <MemePanel
            onSelect={(text) => {
              onMemeSelect(text);
              setActivePanel(null);
              onClose();
            }}
            onClose={() => setActivePanel(null)}
          />
        </div>
      )}

      <style>{`
        .media-popup-toolbar {
          display: flex;
          gap: 6px;
          padding: 8px;
          background: rgba(18,18,18,0.96);
          border: 1px solid rgba(156,255,0,0.22);
          border-radius: 14px;
          box-shadow: 0 8px 32px rgba(0,0,0,0.7), 0 0 40px rgba(156,255,0,0.1);
          backdrop-filter: blur(16px);
          animation: toolbarPop 0.2s cubic-bezier(0.34,1.56,0.64,1);
        }
        @keyframes toolbarPop {
          from { opacity:0; transform:scale(0.88) translateY(6px); }
          to   { opacity:1; transform:scale(1) translateY(0); }
        }

        .media-popup-btn {
          width: 48px;
          height: 48px;
          border-radius: 10px;
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.1);
          color: #888;
          cursor: pointer;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 3px;
          transition: all 0.2s cubic-bezier(0.4,0,0.2,1);
          position: relative;
        }

        .media-popup-btn:hover {
          background: rgba(255,255,255,0.1);
          border-color: var(--btn-color);
          color: var(--btn-color);
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        }

        .media-popup-btn.active {
          background: rgba(156,255,0,0.12);
          border-color: rgba(156,255,0,0.5);
          color: #9cff00;
          box-shadow: 0 0 16px rgba(156,255,0,0.2);
        }

        .media-popup-btn-label {
          font-size: 8px;
          font-weight: 700;
          letter-spacing: 0.3px;
          text-transform: uppercase;
        }
      `}</style>
    </>
  );
};

export default MediaPopup;
