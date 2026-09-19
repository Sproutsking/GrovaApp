// components/Messages/MessageInput.jsx - OPTIMIZED
import React, { useState, useRef, useCallback, useEffect } from "react";
import { Send, Plus } from "lucide-react";
import MediaPopup from "./MediaPopup";
import { validateMessageAttachments } from "../../services/messages/attachmentPolicy";

const MessageInput = ({ onSend, onTyping, conversationId, disabled = false }) => {
  const [text, setText] = useState("");
  const [showMediaPopup, setShowMediaPopup] = useState(false);
  const [triggerRect, setTriggerRect] = useState(null);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [attachmentError, setAttachmentError] = useState("");

  const inputRef = useRef(null);
  const plusBtnRef = useRef(null);

  useEffect(() => {
    if (inputRef.current) inputRef.current.focus();
  }, [conversationId]);

  const handleSend = useCallback(() => {
    const trimmed = text.trim();
    if ((!trimmed && selectedFiles.length === 0) || disabled) return;
    const files = [...selectedFiles];
    setText("");
    setSelectedFiles([]);
    setAttachmentError("");
    onSend(trimmed, null, files);
    if (inputRef.current) inputRef.current.focus();
  }, [text, selectedFiles, disabled, onSend]);

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
    try {
      validateMessageAttachments([...selectedFiles, file], 10);
      setSelectedFiles((files) => [...files, file]);
      setAttachmentError("");
    } catch (error) {
      setAttachmentError(error.message);
    }
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

      {attachmentError && <div role="alert" style={{ color: "#fb7185", fontSize: 12, padding: "0 12px 8px" }}>{attachmentError}</div>}
      {selectedFiles.length > 0 && <div style={{ display: "flex", gap: 6, flexWrap: "wrap", padding: "0 12px 8px" }}>{selectedFiles.map((file, index) => <span key={`${file.name}-${index}`} style={{ color: "#bef264", fontSize: 11 }}>{file.name}</span>)}</div>}

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
          className={`msg-send-btn ${text.trim() || selectedFiles.length ? "active" : ""}`}
          onClick={handleSend}
          disabled={(!text.trim() && !selectedFiles.length) || disabled}
          aria-label="Send message"
        >
          <Send size={18} />
        </button>
      </div>

      <style>{`
        .msg-input-wrapper {
        padding: 10px;
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