import React, { useState, useRef, useEffect } from "react";
import { Smile, Image, Film, Paperclip, X } from "lucide-react";
import EmojiPanel from "./EmojiPanel";
import GifPanel from "./GifPanel";
import MemePanel from "./MemePanel";

/**
 * MediaPopup — tabbed panel that hosts Emoji, GIF, Meme, File tabs
 * Pops up above the message input bar
 */

const TABS = [
  { key: "emoji", label: "EMOJI", Icon: Smile },
  { key: "gif",   label: "GIF",   Icon: Image },
  { key: "meme",  label: "MEME",  Icon: Film },
  { key: "file",  label: "FILE",  Icon: Paperclip },
];

const MediaPopup = ({
  onEmojiSelect,
  onGifSelect,
  onMemeSelect,
  onFileSelect,
  onClose,
  triggerRect,
}) => {
  const [activeTab, setActiveTab] = useState("emoji");
  const popupRef = useRef(null);
  const fileInputRef = useRef(null);

  // Position above trigger
  const popupStyle = {
    position: "fixed",
    bottom: triggerRect
      ? window.innerHeight - triggerRect.top + 8
      : 80,
    left: triggerRect
      ? Math.max(8, Math.min(triggerRect.left - 8, window.innerWidth - 380))
      : 8,
    zIndex: 3000,
  };

  useEffect(() => {
    const handleKey = (e) => { if (e.key === "Escape") onClose?.(); };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  const handleFileChange = (e) => {
    const files = Array.from(e.target.files || []);
    files.forEach((file) => onFileSelect?.(file));
    onClose?.();
  };

  const handleEmojiSelect = (emoji) => {
    onEmojiSelect?.(emoji);
    // Keep open for emoji — let user pick multiple
  };

  const handleGifSelect = (gif) => {
    onGifSelect?.(gif);
    onClose?.();
  };

  const handleMemeSelect = (meme) => {
    onMemeSelect?.(meme);
    onClose?.();
  };

  return (
    <div ref={popupRef} style={popupStyle} className="mp-popup" onClick={(e) => e.stopPropagation()}>
      {/* Tab bar */}
      <div className="mp-tabbar">
        {TABS.map(({ key, label, Icon }) => (
          <button
            key={key}
            className={`mp-tab ${activeTab === key ? "active" : ""}`}
            onClick={() => {
              if (key === "file") {
                fileInputRef.current?.click();
              } else {
                setActiveTab(key);
              }
            }}
          >
            <Icon size={15} />
            <span>{label}</span>
          </button>
        ))}
        <button className="mp-tab-close" onClick={onClose}>
          <X size={14} />
        </button>
      </div>

      {/* Panel content — rendered inline, positioned by this popup */}
      <div className="mp-panel-area">
        {activeTab === "emoji" && (
          <EmojiPanel
            onSelect={handleEmojiSelect}
            onClose={onClose}
            style={{ position: "relative", width: "100%", height: "100%", borderRadius: "0 0 14px 14px", border: "none", boxShadow: "none" }}
          />
        )}
        {activeTab === "gif" && (
          <GifPanel
            onSelect={handleGifSelect}
            onClose={onClose}
            style={{ position: "relative", width: "100%", height: "100%", borderRadius: "0 0 14px 14px", border: "none", boxShadow: "none" }}
          />
        )}
        {activeTab === "meme" && (
          <MemePanel
            onSelect={handleMemeSelect}
            onClose={onClose}
            style={{ position: "relative", width: "100%", height: "100%", borderRadius: "0 0 14px 14px", border: "none", boxShadow: "none" }}
          />
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/*,video/*,.pdf,.doc,.docx,.txt"
        style={{ display: "none" }}
        onChange={handleFileChange}
      />

      <style>{`
        .mp-popup {
          width: 360px;
          background: #0d0d0d;
          border: 1px solid rgba(156,255,0,0.25);
          border-radius: 16px;
          overflow: hidden;
          box-shadow: 0 -8px 40px rgba(0,0,0,0.8), 0 0 60px rgba(156,255,0,0.08);
          display: flex;
          flex-direction: column;
          animation: popupIn 0.18s cubic-bezier(0.34,1.56,0.64,1);
        }

        @keyframes popupIn {
          from { opacity: 0; transform: translateY(12px) scale(0.96); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }

        .mp-tabbar {
          display: flex;
          align-items: center;
          gap: 2px;
          padding: 6px 8px;
          border-bottom: 1px solid rgba(255,255,255,0.06);
          background: rgba(0,0,0,0.5);
        }

        .mp-tab {
          display: flex;
          align-items: center;
          gap: 5px;
          padding: 6px 10px;
          background: none;
          border: 1px solid transparent;
          border-radius: 8px;
          color: #666;
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 0.5px;
          cursor: pointer;
          transition: all 0.15s;
          font-family: inherit;
        }
        .mp-tab:hover {
          background: rgba(156,255,0,0.08);
          color: #9cff00;
          border-color: rgba(156,255,0,0.15);
        }
        .mp-tab.active {
          background: rgba(156,255,0,0.15);
          color: #9cff00;
          border-color: rgba(156,255,0,0.3);
        }

        .mp-tab-close {
          margin-left: auto;
          width: 28px;
          height: 28px;
          background: rgba(255,59,48,0.1);
          border: 1px solid rgba(255,59,48,0.2);
          border-radius: 8px;
          color: #ff3b30;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.15s;
        }
        .mp-tab-close:hover {
          background: rgba(255,59,48,0.2);
          transform: scale(1.05);
        }

        .mp-panel-area {
          height: 420px;
          overflow: hidden;
          position: relative;
        }
      `}</style>
    </div>
  );
};

export default MediaPopup;