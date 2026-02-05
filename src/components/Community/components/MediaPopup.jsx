import React, { useState, useRef, useEffect } from "react";
import { Smile, Image, Film, Paperclip } from "lucide-react";
import EmojiPanel from "./EmojiPanel";
import GifPanel from "./GifPanel";
import MemePanel from "./MemePanel";

const MediaPopup = ({
  onEmojiSelect,
  onGifSelect,
  onMemeSelect,
  onFileSelect,
  onClose,
  triggerRect,
}) => {
  const [activePanel, setActivePanel] = useState(null);
  const toolbarRef = useRef(null);
  const fileInputRef = useRef(null);

  const handleFileChange = (e) => {
    const files = Array.from(e.target.files).slice(0, 10);
    files.forEach(file => onFileSelect(file));
    onClose();
  };

  useEffect(() => {
    const handler = (e) => {
      if (toolbarRef.current && !toolbarRef.current.contains(e.target)) {
        onClose();
      }
    };
    const timeout = setTimeout(() => {
      document.addEventListener("mousedown", handler);
    }, 100);
    return () => {
      clearTimeout(timeout);
      document.removeEventListener("mousedown", handler);
    };
  }, [onClose]);

  useEffect(() => {
    const handler = (e) => {
      if (e.key === "Escape") {
        if (activePanel) setActivePanel(null);
        else onClose();
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [activePanel, onClose]);

  // Position toolbar above plus button
  const getToolbarStyle = () => {
    if (!triggerRect) return {};
    
    return {
      position: "fixed",
      bottom: `${window.innerHeight - triggerRect.top + 8}px`,
      left: `${triggerRect.left}px`,
      zIndex: 20000
    };
  };

  // Position panel to the left of toolbar
  const getPanelStyle = () => {
    if (!triggerRect) return {};
    
    return {
      position: "fixed",
      bottom: `${window.innerHeight - triggerRect.top + 8}px`,
      left: `${triggerRect.left + 68}px`,
      zIndex: 20001
    };
  };

  const buttons = [
    { id: "emoji", icon: Smile, label: "Emoji" },
    { id: "gif", icon: Image, label: "GIF" },
    { id: "meme", icon: Film, label: "Meme" },
    { id: "file", icon: Paperclip, label: "File" },
  ];

  return (
    <>
      <div ref={toolbarRef} style={getToolbarStyle()} className="mp-toolbar-column" onClick={e => e.stopPropagation()}>
        {buttons.map(btn => {
          const Icon = btn.icon;
          const isActive = activePanel === btn.id;
          return (
            <button
              key={btn.id}
              className={`mp-btn-col ${isActive ? "active" : ""}`}
              onClick={e => {
                e.stopPropagation();
                if (btn.id === "file") {
                  fileInputRef.current?.click();
                  return;
                }
                setActivePanel(isActive ? null : btn.id);
              }}
            >
              <Icon size={20} />
            </button>
          );
        })}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        multiple
        style={{ display: "none" }}
        onChange={handleFileChange}
        accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.txt,.zip"
      />

      {activePanel === "emoji" && (
        <div style={getPanelStyle()} onClick={e => e.stopPropagation()}>
          <EmojiPanel
            onSelect={emoji => onEmojiSelect(emoji)}
            onClose={() => setActivePanel(null)}
          />
        </div>
      )}

      {activePanel === "gif" && (
        <div style={getPanelStyle()} onClick={e => e.stopPropagation()}>
          <GifPanel
            onSelect={gif => {
              onGifSelect(gif);
              setActivePanel(null);
              onClose();
            }}
            onClose={() => setActivePanel(null)}
          />
        </div>
      )}

      {activePanel === "meme" && (
        <div style={getPanelStyle()} onClick={e => e.stopPropagation()}>
          <MemePanel
            onSelect={meme => {
              onMemeSelect(meme);
              setActivePanel(null);
              onClose();
            }}
            onClose={() => setActivePanel(null)}
          />
        </div>
      )}

      <style>{`
        .mp-toolbar-column {
          display: flex;
          flex-direction: column;
          gap: 4px;
          padding: 6px;
          background: rgba(10, 10, 10, 0.98);
          border: 2px solid rgba(156, 255, 0, 0.3);
          border-radius: 14px;
          box-shadow: 0 16px 64px rgba(0, 0, 0, 0.9);
          backdrop-filter: blur(20px);
        }

        .mp-btn-col {
          width: 48px;
          height: 48px;
          border-radius: 12px;
          background: rgba(26, 26, 26, 0.9);
          border: 2px solid rgba(255, 255, 255, 0.1);
          color: #888;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s;
        }

        .mp-btn-col:hover {
          background: rgba(42, 42, 42, 0.95);
          border-color: rgba(156, 255, 0, 0.5);
          color: #9cff00;
          transform: scale(1.05);
        }

        .mp-btn-col.active {
          background: rgba(156, 255, 0, 0.2);
          border-color: rgba(156, 255, 0, 0.7);
          color: #9cff00;
          box-shadow: 0 0 20px rgba(156, 255, 0, 0.3);
        }
      `}</style>
    </>
  );
};

export default MediaPopup;