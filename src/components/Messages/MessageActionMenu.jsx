// ============================================================================
// src/components/Messages/MessageActionMenu.jsx — ELITE MESSAGE ACTIONS v1
// ============================================================================
// FEATURES:
//  [M1] Context menu positioned 10px from message (left for sent, right for received)
//  [M2] Touch long-press detection (500ms hold)
//  [M3] Desktop hover detection
//  [M4] Smooth animations with elite styling
//  [M5] Works in both DM and group chats
//  [M6] Actions: reply, react, copy, delete, forward
// ============================================================================

import React, { useState, useRef, useCallback, useEffect, memo } from "react";
import "./MessageActionMenu.css";

// Icons
const Ic = {
  Reply:   () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 17 4 12 9 7"/><path d="M20 18v-2a4 4 0 00-4-4H4"/></svg>,
  React:   () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="1"/><path d="M12 1v6m0 6v6"/><path d="M4.22 4.22l4.24 4.24m3.08 3.08l4.24 4.24"/><path d="M1 12h6m6 0h6"/><path d="M4.22 19.78l4.24-4.24m3.08-3.08l4.24-4.24"/></svg>,
  Copy:    () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>,
  Delete:  () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2l-1-14"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>,
  Forward: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 17 20 12 15 7"/><path d="M4 18v-2a4 4 0 014-4h12"/></svg>,
  Pin:     () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="1"/><path d="M12 1v6m0 6v6"/><path d="M4.22 4.22l4.24 4.24m3.08 3.08l4.24 4.24"/><path d="M1 12h6m6 0h6"/></svg>,
};

const MessageActionMenu = memo(({
  messageId,
  isSentByMe,
  messageText,
  onReply,
  onReact,
  onCopy,
  onDelete,
  onForward,
  onPin,
  messageRect,
  isGroupChat,
}) => {
  const [visible, setVisible] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const menuRef = useRef(null);
  const longPressTimer = useRef(null);

  // Calculate position based on message side and 10px offset
  const calculatePosition = useCallback((rect) => {
    if (!rect) return { top: 0, left: 0 };

    const offset = 10;
    const menuWidth = 200;
    const menuHeight = 48 + (isGroupChat ? 16 : 0); // More actions in groups

    let top = rect.top + rect.height / 2 - menuHeight / 2;
    let left = isSentByMe 
      ? rect.left - menuWidth - offset 
      : rect.right + offset;

    // Keep in viewport
    if (left < 0) left = offset;
    if (left + menuWidth > window.innerWidth) left = window.innerWidth - menuWidth - offset;
    if (top < 0) top = offset;
    if (top + menuHeight > window.innerHeight) top = window.innerHeight - menuHeight - offset;

    return { top, left };
  }, [isSentByMe, isGroupChat]);

  // Long press handler (mobile)
  const handleMouseDown = () => {
    longPressTimer.current = setTimeout(() => {
      if (messageRect) {
        setPosition(calculatePosition(messageRect));
        setVisible(true);
      }
    }, 500);
  };

  const handleMouseUp = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  // Hover handler (desktop)
  const handleMouseEnter = () => {
    if (messageRect && window.matchMedia("(hover: hover)").matches) {
      setPosition(calculatePosition(messageRect));
      setVisible(true);
    }
  };

  const handleMouseLeave = () => {
    setVisible(false);
  };

  // Click handlers
  const handleAction = useCallback((action) => {
    switch (action) {
      case "reply":
        onReply?.();
        break;
      case "react":
        onReact?.();
        break;
      case "copy":
        if (messageText) {
          navigator.clipboard.writeText(messageText);
          setVisible(false);
        }
        break;
      case "delete":
        onDelete?.();
        break;
      case "forward":
        onForward?.();
        break;
      case "pin":
        onPin?.();
        break;
    }
    setVisible(false);
  }, [messageText, onReply, onReact, onDelete, onForward, onPin]);

  // Close on outside click
  useEffect(() => {
    if (!visible) return;
    const handleClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setVisible(false);
      }
    };
    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, [visible]);

  return (
    <div
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      style={{ position: "relative" }}
    >
      {visible && (
        <div
          ref={menuRef}
          className="msg-action-menu"
          style={{
            position: "fixed",
            top: `${position.top}px`,
            left: `${position.left}px`,
            zIndex: 10000,
          }}
        >
          <button
            className="mam-item"
            onClick={() => handleAction("reply")}
            title="Reply"
          >
            <Ic.Reply /> Reply
          </button>

          <button
            className="mam-item"
            onClick={() => handleAction("react")}
            title="React"
          >
            <Ic.React /> React
          </button>

          <button
            className="mam-item"
            onClick={() => handleAction("copy")}
            title="Copy"
          >
            <Ic.Copy /> Copy
          </button>

          {isSentByMe && (
            <button
              className="mam-item mam-delete"
              onClick={() => handleAction("delete")}
              title="Delete"
            >
              <Ic.Delete /> Delete
            </button>
          )}

          {!isSentByMe && (
            <button
              className="mam-item"
              onClick={() => handleAction("forward")}
              title="Forward"
            >
              <Ic.Forward /> Forward
            </button>
          )}

          {isGroupChat && (
            <button
              className="mam-item"
              onClick={() => handleAction("pin")}
              title="Pin"
            >
              <Ic.Pin /> Pin
            </button>
          )}
        </div>
      )}
    </div>
  );
});

MessageActionMenu.displayName = "MessageActionMenu";
export default MessageActionMenu;
