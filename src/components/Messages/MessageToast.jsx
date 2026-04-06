// ============================================================================
// components/Messages/MessageToast.jsx — NOVA MESSAGE TOAST v1
// ============================================================================
// System-wide incoming message toast notification.
// Features:
//   • Instant display with optimistic UI
//   • Tap to open conversation
//   • Queue multiple messages from different senders
//   • Auto-dismiss with progress bar
//   • Media message previews (image/video)
//   • Swipe to dismiss on mobile
// ============================================================================

import React, { useState, useEffect, useRef, useCallback } from "react";
import mediaUrlService from "../../services/shared/mediaUrlService";

/* ─── MESSAGE TOAST EVENT BUS ─── */
class MessageToastBus {
  constructor() {
    this._listeners = new Map();
  }
  on(event, fn) {
    if (!this._listeners.has(event)) this._listeners.set(event, new Set());
    this._listeners.get(event).add(fn);
    return () => this._listeners.get(event)?.delete(fn);
  }
  emit(event, data) {
    this._listeners.get(event)?.forEach(fn => { try { fn(data); } catch(e){} });
  }
}

export const messageToastBus = new MessageToastBus();

/* ─── SINGLE TOAST ─── */
const SingleMessageToast = ({ toast, onDismiss, onOpen }) => {
  const [progress, setProgress] = useState(100);
  const [dismissed, setDismissed] = useState(false);
  const [swipeX, setSwipeX] = useState(0);
  const touchStartX = useRef(null);
  const intervalRef = useRef(null);
  const DURATION = toast.duration || 5000;

  useEffect(() => {
    const step = (50 / DURATION) * 100;
    intervalRef.current = setInterval(() => {
      setProgress(p => {
        if (p <= 0) {
          clearInterval(intervalRef.current);
          handleDismiss();
          return 0;
        }
        return p - step;
      });
    }, 50);
    return () => clearInterval(intervalRef.current);
  }, []); // eslint-disable-line

  const handleDismiss = useCallback(() => {
    if (dismissed) return;
    setDismissed(true);
    setTimeout(() => onDismiss(toast.id), 300);
  }, [dismissed, toast.id, onDismiss]);

  const handleOpen = useCallback(() => {
    clearInterval(intervalRef.current);
    onOpen(toast);
    handleDismiss();
  }, [toast, onOpen, handleDismiss]);

  // Swipe to dismiss
  const onTouchStart = (e) => { touchStartX.current = e.touches[0].clientX; };
  const onTouchMove = (e) => {
    if (touchStartX.current === null) return;
    const dx = e.touches[0].clientX - touchStartX.current;
    setSwipeX(dx);
  };
  const onTouchEnd = () => {
    if (Math.abs(swipeX) > 80) handleDismiss();
    else setSwipeX(0);
    touchStartX.current = null;
  };

  const avatarUrl = toast.senderAvatarId
    ? mediaUrlService.getAvatarUrl(toast.senderAvatarId, 100)
    : toast.senderAvatar || null;
  const initial = (toast.senderName || "?").charAt(0).toUpperCase();

  const isMedia = toast.messageType === "image" || toast.messageType === "video";

  return (
    <div
      className={`mt-toast${dismissed ? " mt-dismissed" : ""}`}
      style={{ transform: `translateX(${swipeX}px)`, opacity: swipeX !== 0 ? Math.max(0, 1 - Math.abs(swipeX) / 120) : undefined }}
      onClick={handleOpen}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      role="button"
      tabIndex={0}
      aria-label={`Message from ${toast.senderName}: ${toast.message}`}
    >
      {/* Progress bar */}
      <div className="mt-progress">
        <div className="mt-progress-fill" style={{ width: `${progress}%` }}/>
      </div>

      {/* Content */}
      <div className="mt-body">
        {/* Avatar */}
        <div className="mt-avatar-wrap">
          {avatarUrl
            ? <img src={avatarUrl} alt={toast.senderName} className="mt-avatar"/>
            : <div className="mt-avatar-fb">{initial}</div>
          }
          <div className="mt-online-dot"/>
        </div>

        {/* Text */}
        <div className="mt-text">
          <div className="mt-sender">{toast.senderName}</div>
          {toast.conversationName && toast.conversationName !== toast.senderName && (
            <div className="mt-conversation">in {toast.conversationName}</div>
          )}
          <div className="mt-message">
            {isMedia && <span className="mt-media-icon">{toast.messageType === "image" ? "🖼️" : "🎥"} </span>}
            {toast.message || (isMedia ? `Sent a ${toast.messageType}` : "")}
          </div>
        </div>

        {/* Timestamp */}
        <div className="mt-time">{new Date().toLocaleTimeString([],{hour:"numeric",minute:"2-digit"})}</div>

        {/* Dismiss button */}
        <button
          className="mt-close"
          onClick={e => { e.stopPropagation(); handleDismiss(); }}
          aria-label="Dismiss"
        >×</button>
      </div>
    </div>
  );
};

/* ─── MESSAGE TOAST CONTAINER ─── */
const MessageToast = ({ onOpenConversation }) => {
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback((toastData) => {
    const id = toastData.id || `mt_${Date.now()}_${Math.random().toString(36).slice(2,7)}`;
    const toast = { ...toastData, id, timestamp: Date.now() };

    setToasts(prev => {
      // Max 3 toasts; remove oldest if over limit
      const filtered = prev.filter(t => t.id !== id);
      return [...filtered.slice(-2), toast];
    });
  }, []);

  // Expose addToast via ref for external use
  useEffect(() => {
    const unsub = messageToastBus.on("show_message_toast", addToast);
    return unsub;
  }, [addToast]);

  const handleDismiss = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const handleOpen = useCallback((toast) => {
    onOpenConversation?.({
      conversationId: toast.conversationId,
      otherUserId: toast.senderId,
      otherUser: {
        id: toast.senderId,
        full_name: toast.senderName,
        avatar_id: toast.senderAvatarId,
      },
    });
  }, [onOpenConversation]);

  if (toasts.length === 0) return null;

  return (
    <div className="mt-container">
      {toasts.map((toast, idx) => (
        <SingleMessageToast
          key={toast.id}
          toast={toast}
          onDismiss={handleDismiss}
          onOpen={handleOpen}
        />
      ))}
      <style>{MT_STYLES}</style>
    </div>
  );
};

const MT_STYLES = `
  .mt-container {
    position: fixed;
    top: calc(env(safe-area-inset-top, 0px) + 8px);
    left: 0;
    right: 0;
    z-index: 99990;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    padding: 0 12px;
    pointer-events: none;
  }

  .mt-toast {
    width: 100%;
    max-width: 420px;
    background: rgba(6, 6, 6, 0.97);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 18px;
    overflow: hidden;
    box-shadow: 0 16px 48px rgba(0,0,0,0.7), 0 0 0 1px rgba(132,204,22,0.06);
    backdrop-filter: blur(24px);
    cursor: pointer;
    pointer-events: all;
    transition: transform 0.2s, opacity 0.3s;
    animation: mtSlideIn 0.4s cubic-bezier(0.34, 1.4, 0.64, 1) both;
    -webkit-tap-highlight-color: transparent;
  }

  .mt-toast:hover {
    border-color: rgba(132, 204, 22, 0.25);
    background: rgba(10, 10, 10, 0.98);
  }

  .mt-toast.mt-dismissed {
    animation: mtSlideOut 0.3s ease-in both;
  }

  @keyframes mtSlideIn {
    from { opacity: 0; transform: translateY(-110%) scale(0.92); }
    to { opacity: 1; transform: translateY(0) scale(1); }
  }

  @keyframes mtSlideOut {
    from { opacity: 1; transform: translateY(0) scale(1); max-height: 200px; }
    to { opacity: 0; transform: translateY(-20px) scale(0.95); max-height: 0; margin: 0; padding: 0; }
  }

  /* Progress bar */
  .mt-progress {
    height: 2px;
    background: rgba(255,255,255,0.06);
  }

  .mt-progress-fill {
    height: 100%;
    background: linear-gradient(90deg, #84cc16, #22c55e);
    transition: width 0.05s linear;
    border-radius: 0 1px 1px 0;
  }

  /* Body */
  .mt-body {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 14px;
  }

  /* Avatar */
  .mt-avatar-wrap {
    position: relative;
    flex-shrink: 0;
  }

  .mt-avatar {
    width: 44px;
    height: 44px;
    border-radius: 50%;
    object-fit: cover;
    border: 1.5px solid rgba(132, 204, 22, 0.2);
  }

  .mt-avatar-fb {
    width: 44px;
    height: 44px;
    border-radius: 50%;
    background: linear-gradient(135deg, #0d1a00, #1a3300);
    border: 1.5px solid rgba(132, 204, 22, 0.25);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 18px;
    font-weight: 800;
    color: #84cc16;
  }

  .mt-online-dot {
    position: absolute;
    bottom: 1px;
    right: 1px;
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: #22c55e;
    border: 2px solid #060606;
  }

  /* Text */
  .mt-text {
    flex: 1;
    min-width: 0;
  }

  .mt-sender {
    font-size: 13px;
    font-weight: 700;
    color: #fff;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .mt-conversation {
    font-size: 10px;
    color: #84cc16;
    font-weight: 600;
    margin-bottom: 1px;
  }

  .mt-message {
    font-size: 12px;
    color: rgba(255,255,255,0.5);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    margin-top: 1px;
  }

  .mt-media-icon {
    font-size: 11px;
  }

  /* Time & close */
  .mt-time {
    font-size: 10px;
    color: rgba(255,255,255,0.25);
    flex-shrink: 0;
    align-self: flex-start;
    margin-top: 2px;
  }

  .mt-close {
    flex-shrink: 0;
    width: 22px;
    height: 22px;
    border-radius: 50%;
    background: rgba(255,255,255,0.06);
    border: none;
    color: rgba(255,255,255,0.4);
    font-size: 16px;
    line-height: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: background 0.15s, color 0.15s;
  }

  .mt-close:hover {
    background: rgba(255,255,255,0.12);
    color: #fff;
  }

  @media (max-width: 480px) {
    .mt-container { padding: 0 8px; }
    .mt-toast { border-radius: 14px; }
    .mt-avatar, .mt-avatar-fb { width: 38px; height: 38px; font-size: 15px; }
    .mt-sender { font-size: 12px; }
    .mt-message { font-size: 11px; }
  }
`;

export default MessageToast;