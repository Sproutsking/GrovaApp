import React, { useState, useRef, useCallback, useEffect } from "react";
import { Send, Plus, X } from "lucide-react";
import MediaPopup from "../../Messages/MediaPopup";

const CommunityMessageInput = ({ 
  value, 
  onChange, 
  onSend, 
  disabled = false,
  placeholder = "Type a message...",
  editingMessage = null,
  onCancelEdit = null,
  typingUsers = []
}) => {
  const [showMediaPopup, setShowMediaPopup] = useState(false);
  const [triggerRect, setTriggerRect] = useState(null);
  const [selectedEmojis, setSelectedEmojis] = useState([]);
  const [selectedGif, setSelectedGif] = useState(null);
  const [selectedMeme, setSelectedMeme] = useState(null);
  const [selectedFiles, setSelectedFiles] = useState([]);
  
  const inputRef = useRef(null);
  const plusBtnRef = useRef(null);

  useEffect(() => {
    if (inputRef.current) inputRef.current.focus();
  }, []);

  const handleSend = useCallback(() => {
    const trimmed = value.trim();
    const hasContent = trimmed || selectedEmojis.length > 0 || selectedGif || selectedMeme || selectedFiles.length > 0;
    
    if (!hasContent || disabled) return;
    
    // TODO: Build final message with all media
    onSend();
    
    // Clear all media
    setSelectedEmojis([]);
    setSelectedGif(null);
    setSelectedMeme(null);
    setSelectedFiles([]);
    
    if (inputRef.current) inputRef.current.focus();
  }, [value, selectedEmojis, selectedGif, selectedMeme, selectedFiles, disabled, onSend]);

  const handleKeyDown = useCallback(
    (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
      if (e.key === "Escape" && editingMessage && onCancelEdit) {
        onCancelEdit();
      }
    },
    [handleSend, editingMessage, onCancelEdit],
  );

  const handlePlusClick = () => {
    if (plusBtnRef.current) {
      setTriggerRect(plusBtnRef.current.getBoundingClientRect());
    }
    setShowMediaPopup(true);
  };

  const handleEmojiSelect = (emoji) => {
    setSelectedEmojis(prev => [...prev, { id: Date.now() + Math.random(), emoji }]);
  };

  const handleGifSelect = (gif) => {
    setSelectedGif({
      id: Date.now(),
      emoji: gif.emoji || "🎬",
      title: gif.category || gif.title || "GIF"
    });
  };

  const handleMemeSelect = (meme) => {
    setSelectedMeme({
      id: Date.now(),
      emoji: meme.emoji,
      title: meme.text
    });
  };

  const handleFileSelect = (file) => {
    if (selectedFiles.length >= 10) return;
    setSelectedFiles(prev => [...prev, {
      id: Date.now() + Math.random(),
      file,
      name: file.name,
      size: (file.size / 1024).toFixed(1) + "KB"
    }]);
  };

  const removeEmoji = (id) => {
    setSelectedEmojis(prev => prev.filter(e => e.id !== id));
  };

  const removeGif = () => setSelectedGif(null);
  const removeMeme = () => setSelectedMeme(null);
  
  const removeFile = (id) => {
    setSelectedFiles(prev => prev.filter(f => f.id !== id));
  };

  const formatTypingText = () => {
    if (typingUsers.length === 0) return null;
    if (typingUsers.length === 1) return `${typingUsers[0].userName} is typing`;
    if (typingUsers.length === 2) return `${typingUsers[0].userName} and ${typingUsers[1].userName} are typing`;
    if (typingUsers.length <= 9) {
      const names = typingUsers.slice(0, 2).map(u => u.userName).join(", ");
      return `${names} and ${typingUsers.length - 2} others are typing`;
    }
    const names = typingUsers.slice(0, 2).map(u => u.userName).join(", ");
    return `${names} and many others are typing`;
  };

  const typingText = formatTypingText();
  const allMedia = [...selectedEmojis, selectedGif, selectedMeme, ...selectedFiles].filter(Boolean);

  return (
    <div className="comm-msg-input-wrapper">
      {showMediaPopup && triggerRect && (
        <MediaPopup
          onEmojiSelect={handleEmojiSelect}
          onGifSelect={handleGifSelect}
          onMemeSelect={handleMemeSelect}
          onFileSelect={handleFileSelect}
          onClose={() => setShowMediaPopup(false)}
          triggerRect={triggerRect}
        />
      )}

      {typingText && (
        <div className="comm-typing-indicator">
          <div className="comm-typing-bubble">
            <div className="comm-typing-dots">
              <span /><span /><span />
            </div>
          </div>
          <span className="comm-typing-text">{typingText}</span>
        </div>
      )}

      {editingMessage && (
        <div className="comm-edit-banner">
          <span>Editing message</span>
          <button onClick={onCancelEdit}>Cancel</button>
        </div>
      )}

      {/* PREVIEW CARDS - Above input */}
      {allMedia.length > 0 && (
        <div className="comm-media-preview-bar">
          {selectedEmojis.map(item => (
            <div key={item.id} className="comm-preview-card emoji">
              <span className="comm-preview-emoji">{item.emoji}</span>
              <button className="comm-preview-remove" onClick={() => removeEmoji(item.id)}>
                <X size={12} />
              </button>
            </div>
          ))}
          
          {selectedGif && (
            <div className="comm-preview-card">
              <div className="comm-preview-icon">{selectedGif.emoji}</div>
              <div className="comm-preview-title">{selectedGif.title}</div>
              <button className="comm-preview-remove" onClick={removeGif}>
                <X size={12} />
              </button>
            </div>
          )}
          
          {selectedMeme && (
            <div className="comm-preview-card">
              <div className="comm-preview-icon">{selectedMeme.emoji}</div>
              <div className="comm-preview-title">{selectedMeme.title}</div>
              <button className="comm-preview-remove" onClick={removeMeme}>
                <X size={12} />
              </button>
            </div>
          )}
          
          {selectedFiles.map(file => (
            <div key={file.id} className="comm-preview-card">
              <div className="comm-preview-icon">📎</div>
              <div className="comm-preview-info">
                <div className="comm-preview-title">{file.name}</div>
                <div className="comm-preview-size">{file.size}</div>
              </div>
              <button className="comm-preview-remove" onClick={() => removeFile(file.id)}>
                <X size={12} />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="comm-msg-input-bar">
        <button
          ref={plusBtnRef}
          className={`comm-plus-btn ${showMediaPopup ? "active" : ""}`}
          onClick={handlePlusClick}
        >
          <Plus size={20} />
        </button>

        <textarea
          ref={inputRef}
          className="comm-textarea"
          value={value}
          onChange={e => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          rows={1}
          disabled={disabled}
        />

        <button
          className={`comm-send-btn ${value.trim() || allMedia.length > 0 ? "active" : ""}`}
          onClick={handleSend}
          disabled={(!value.trim() && allMedia.length === 0) || disabled}
        >
          <Send size={18} />
        </button>
      </div>

      <style>{`
        .comm-msg-input-wrapper {
          position: relative;
          width: 100%;
          background: #0a0a0a;
          border-top: 1px solid rgba(156, 255, 0, 0.12);
          z-index: 1;
        }

        .comm-typing-indicator {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 4px 12px;
        }

        .comm-typing-bubble {
          padding: 4px 8px;
          background: rgba(26, 26, 26, 0.6);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 12px;
        }

        .comm-typing-dots {
          display: flex;
          gap: 3px;
        }

        .comm-typing-dots span {
          width: 5px;
          height: 5px;
          border-radius: 50%;
          background: #666;
          animation: bounce 1.2s ease infinite;
        }

        .comm-typing-dots span:nth-child(2) { animation-delay: 0.15s; }
        .comm-typing-dots span:nth-child(3) { animation-delay: 0.3s; }

        @keyframes bounce {
          0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }
          30% { transform: translateY(-3px); opacity: 1; }
        }

        .comm-typing-text {
          font-size: 11px;
          color: #666;
          font-style: italic;
        }

        .comm-edit-banner {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 6px 12px;
          background: rgba(156, 255, 0, 0.08);
          border-bottom: 1px solid rgba(156, 255, 0, 0.15);
          font-size: 12px;
          color: #9cff00;
        }

        .comm-edit-banner button {
          padding: 3px 10px;
          background: transparent;
          border: 1px solid rgba(156, 255, 0, 0.3);
          border-radius: 6px;
          color: #9cff00;
          font-size: 11px;
          cursor: pointer;
          transition: all 0.2s;
        }

        .comm-edit-banner button:hover {
          background: rgba(156, 255, 0, 0.15);
        }

        /* PREVIEW CARDS - Above input */
        .comm-media-preview-bar {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
          padding: 8px 12px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.06);
          max-height: 180px;
          overflow-y: auto;
          scrollbar-width: thin;
        }

        .comm-media-preview-bar::-webkit-scrollbar { width: 4px; }
        .comm-media-preview-bar::-webkit-scrollbar-thumb { background: rgba(156, 255, 0, 0.3); }

        .comm-preview-card {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 6px 10px;
          background: rgba(26, 26, 26, 0.8);
          border: 1px solid rgba(156, 255, 0, 0.25);
          border-radius: 10px;
          max-width: 180px;
          animation: slideIn 0.2s ease-out;
        }

        .comm-preview-card.emoji {
          padding: 4px 8px;
        }

        @keyframes slideIn {
          from { opacity: 0; transform: translateY(-5px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .comm-preview-emoji {
          font-size: 24px;
          line-height: 1;
        }

        .comm-preview-icon {
          font-size: 20px;
          line-height: 1;
        }

        .comm-preview-info {
          flex: 1;
          min-width: 0;
        }

        .comm-preview-title {
          font-size: 11px;
          font-weight: 600;
          color: #fff;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .comm-preview-size {
          font-size: 9px;
          color: #666;
          margin-top: 1px;
        }

        .comm-preview-remove {
          width: 18px;
          height: 18px;
          border-radius: 50%;
          background: rgba(255, 59, 48, 0.2);
          border: 1px solid rgba(255, 59, 48, 0.3);
          color: #ff3b30;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s;
          flex-shrink: 0;
        }

        .comm-preview-remove:hover {
          background: rgba(255, 59, 48, 0.3);
          transform: scale(1.1);
        }

        .comm-msg-input-bar {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 12px;
        }

        .comm-plus-btn {
          width: 38px;
          height: 38px;
          border-radius: 50%;
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.1);
          color: #666;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          transition: all 0.2s;
        }

        .comm-plus-btn:hover {
          background: rgba(156, 255, 0, 0.12);
          border-color: rgba(156, 255, 0, 0.3);
          color: #9cff00;
        }

        .comm-plus-btn.active {
          background: rgba(156, 255, 0, 0.2);
          border-color: rgba(156, 255, 0, 0.5);
          color: #9cff00;
          box-shadow: 0 0 12px rgba(156, 255, 0, 0.25);
        }

        .comm-textarea {
          flex: 1;
          min-width: 0;
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 20px;
          padding: 10px 16px;
          color: #fff;
          font-size: 14px;
          font-family: inherit;
          resize: none;
          outline: none;
          line-height: 1.5;
          max-height: 120px;
          overflow-y: auto;
          transition: border-color 0.2s;
        }

        .comm-textarea:focus {
          border-color: rgba(156, 255, 0, 0.35);
        }

        .comm-textarea::placeholder {
          color: #444;
        }

        .comm-send-btn {
          width: 38px;
          height: 38px;
          border-radius: 50%;
          background: rgba(156, 255, 0, 0.15);
          border: 1px solid rgba(156, 255, 0, 0.2);
          color: #555;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          transition: all 0.2s;
        }

        .comm-send-btn.active {
          background: linear-gradient(135deg, #9cff00, #7acc00);
          border-color: transparent;
          color: #000;
          box-shadow: 0 3px 12px rgba(156, 255, 0, 0.4);
        }

        .comm-send-btn.active:hover {
          transform: scale(1.08);
        }
      `}</style>
    </div>
  );
};

export default CommunityMessageInput;