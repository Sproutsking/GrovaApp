// components/Messages/MessageInput.jsx - OPTIMIZED
import React, { useState, useRef, useCallback, useEffect } from "react";
import { Send, Plus } from "lucide-react";
import MediaPopup from "./MediaPopup";

const MessageInput = ({ onSend, onTyping, conversationId, disabled = false }) => {
  const [text, setText] = useState("");
  const [showMediaPopup, setShowMediaPopup] = useState(false);
  const [triggerRect, setTriggerRect] = useState(null);

  const inputRef = useRef(null);
  const plusBtnRef = useRef(null);

  useEffect(() => {
    if (inputRef.current) inputRef.current.focus();
  }, [conversationId]);

  const handleSend = useCallback(() => {
    const trimmed = text.trim();
    if (!trimmed || disabled) return;
    setText("");
    onSend(trimmed);
    if (inputRef.current) inputRef.current.focus();
  }, [text, disabled, onSend]);

  const handleKeyDown = useCallback(
    (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend],
  );

  const handleChange = (e) => {
    setText(e.target.value);
    if (onTyping) onTyping();
  };

  const handlePlusClick = () => {
    if (plusBtnRef.current) {
      const rect = plusBtnRef.current.getBoundingClientRect();
      setTriggerRect(rect);
    }
    setShowMediaPopup(true);
  };

  const handleEmojiSelect = (emoji) => {
    setText((prev) => prev + emoji);
    setShowMediaPopup(false);
    if (inputRef.current) inputRef.current.focus();
  };

  const handleGifSelect = (gif) => {
    const gifText =
      gif.type === "gif_emoji"
        ? `${gif.emoji} ${gif.category}`
        : `🎬 [GIF: ${gif.title}]`;
    setText("");
    onSend(gifText);
    setShowMediaPopup(false);
    if (inputRef.current) inputRef.current.focus();
  };

  const handleMemeSelect = (meme) => {
    const memeText = `${meme.emoji} ${meme.text}`;
    setText("");
    onSend(memeText);
    setShowMediaPopup(false);
    if (inputRef.current) inputRef.current.focus();
  };

  const handleFileSelect = (file) => {
    console.log("File selected:", file);
    setShowMediaPopup(false);
  };

  return (
    <div className="msg-input-wrapper">
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

      <div className="msg-input-bar">
        <button
          ref={plusBtnRef}
          className={`msg-plus-btn ${showMediaPopup ? "active" : ""}`}
          onClick={handlePlusClick}
          aria-label="Attachments"
        >
          <Plus size={20} />
        </button>

        <textarea
          ref={inputRef}
          className="msg-textarea"
          value={text}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder="Type a message..."
          rows={1}
          disabled={disabled}
        />

        <button
          className={`msg-send-btn ${text.trim() ? "active" : ""}`}
          onClick={handleSend}
          disabled={!text.trim() || disabled}
          aria-label="Send message"
        >
          <Send size={18} />
        </button>
      </div>

      <style>{`
        .msg-input-wrapper {
          position: relative;
          width: 100%;
        }

        .msg-input-bar {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 12px;
          background: #0a0a0a;
          border-top: 1px solid rgba(132,204,22,0.12);
        }

        .msg-plus-btn {
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
        .msg-plus-btn:hover {
          background: rgba(132,204,22,0.12);
          border-color: rgba(132,204,22,0.3);
          color: #84cc16;
        }
        .msg-plus-btn.active {
          background: rgba(132,204,22,0.2);
          border-color: rgba(132,204,22,0.5);
          color: #84cc16;
          box-shadow: 0 0 12px rgba(132,204,22,0.25);
        }

        .msg-textarea {
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
        .msg-textarea:focus {
          border-color: rgba(132,204,22,0.35);
        }
        .msg-textarea::placeholder {
          color: #444;
        }
        .msg-textarea:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }

        .msg-send-btn {
          width: 38px;
          height: 38px;
          border-radius: 50%;
          background: rgba(132,204,22,0.15);
          border: 1px solid rgba(132,204,22,0.2);
          color: #555;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          transition: all 0.2s;
        }
        .msg-send-btn.active {
          background: linear-gradient(135deg, #84cc16, #65a30d);
          border-color: transparent;
          color: #000;
          box-shadow: 0 3px 12px rgba(132,204,22,0.4);
        }
        .msg-send-btn.active:hover {
          transform: scale(1.08);
          box-shadow: 0 4px 16px rgba(132,204,22,0.5);
        }
        .msg-send-btn:disabled {
          cursor: not-allowed;
        }
      `}</style>
    </div>
  );
};

export default MessageInput;