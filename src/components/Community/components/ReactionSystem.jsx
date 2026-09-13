import React, { useState, useRef, useCallback } from "react";
import ReactDOM from "react-dom";
import { Smile } from "lucide-react";
import EmojiPanel from "./EmojiPanel";

/**
 * ReactionSystem
 *
 * Components:
 *   <ReactionBar />     — shows existing reactions on a message with animated counts
 *   <ReactionPicker />  — quick emoji picker for adding reactions
 *   <ReactionBurst />   — floating burst animation when adding a reaction
 *
 * Usage:
 *   <ReactionBar reactions={msg.reactions} userId={userId} onToggle={handleToggle} />
 */

// ─── Quick reaction emojis ────────────────────────────────────────────────────
const QUICK_EMOJIS = ["❤️","😂","🔥","🟢🔥","🔵🔥","🟣🔥","🟡🔥","👏","😍","🤯","💯","👑","🚀","😭","🥳","💀"];

// ─── ReactionPicker ───────────────────────────────────────────────────────────
export const ReactionPicker = ({ onSelect, onClose, style = {} }) => {
  return (
    <div className="rp-picker" style={style} onClick={(e) => e.stopPropagation()}>
      {QUICK_EMOJIS.map((emoji, i) => (
        <button
          key={i}
          className="rp-emoji"
          onClick={() => { onSelect(emoji); onClose?.(); }}
        >
          {emoji}
        </button>
      ))}

      <style>{`
        .rp-picker {
          display: flex;
          align-items: center;
          gap: 2px;
          padding: 6px 8px;
          background: rgba(10,10,10,0.98);
          border: 1px solid rgba(156,255,0,0.25);
          border-radius: 30px;
          box-shadow: 0 8px 30px rgba(0,0,0,0.7);
          animation: pickerIn 0.15s cubic-bezier(0.34,1.56,0.64,1);
          z-index: 500;
        }
        @keyframes pickerIn {
          from { opacity: 0; transform: scale(0.7) translateY(4px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
        .rp-emoji {
          width: 34px;
          height: 34px;
          background: none;
          border: none;
          border-radius: 50%;
          font-size: 20px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.12s;
          flex-shrink: 0;
        }
        .rp-emoji:hover {
          background: rgba(156,255,0,0.15);
          transform: scale(1.3) translateY(-3px);
        }
        .rp-emoji:active { transform: scale(0.9); }
      `}</style>
    </div>
  );
};

// ─── ReactionBar ──────────────────────────────────────────────────────────────
/**
 * reactions: { "❤️": { count: 3, users: ["uid1","uid2"] }, ... }
 */
export const ReactionBar = ({ reactions = {}, userId, onToggle, isAnnouncement = false, onOpenPicker, triggerRef }) => {
  const [burst, setBurst] = useState(null);
  const barRef = useRef(null);
  const burstIdRef = useRef(0);

  const handleClick = useCallback((emoji, e) => {
    // Burst animation
    const rect = e.currentTarget.getBoundingClientRect();
    setBurst({ emoji, x: rect.left + rect.width / 2, y: rect.top, id: `${Date.now()}-${burstIdRef.current++}` });
    setTimeout(() => setBurst(null), 800);

    onToggle?.(emoji);
  }, [onToggle]);

  const entries = Object.entries(reactions).filter(([, v]) => v.count > 0);
  return (
    <div ref={barRef} className={`rb-bar ${isAnnouncement ? "announcement" : ""}`}>
      {entries.map(([emoji, data]) => {
        const reacted = data.users?.includes(userId);
        return (
          <button
            key={emoji}
            className={`rb-pill ${reacted ? "reacted" : ""} ${isAnnouncement ? "ann-pill" : ""}`}
            onClick={(e) => handleClick(emoji, e)}
          >
            <span className="rb-emoji">{emoji}</span>
            <span className="rb-count">{data.count}</span>
          </button>
        );
      })}
      {onOpenPicker && (
        <button
          ref={triggerRef}
          type="button"
          className={`rb-pill rb-add-trigger ${isAnnouncement ? "ann-pill" : ""}`}
          onClick={onOpenPicker}
          aria-label="Add a reaction"
          title="Add a reaction"
        >
          <span className="rb-emoji"><Smile size={15} /></span>
        </button>
      )}

      {burst && <ReactionBurst key={burst.id} emoji={burst.emoji} x={burst.x} y={burst.y} />}

      <style>{`
        .rb-bar {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 4px;
          margin-top: 5px;
          width: 100%;
          min-width: 0;
        }

        .rb-bar.announcement {
          gap: 4px;
          margin-top: 3px;
        }

        .rb-pill {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          padding: 3px 9px 3px 7px;
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.18s;
          font-family: inherit;
          animation: pillIn 0.2s ease-out;
        }
        .rb-add-trigger {
          padding-left: 8px;
          padding-right: 8px;
          min-width: 30px;
        }
        .rb-add-trigger .rb-emoji {
          display: inline-flex;
          align-items: center;
          justify-content: center;
        }
        @keyframes pillIn {
          from { opacity: 0; transform: scale(0.7); }
          to { opacity: 1; transform: scale(1); }
        }

        .rb-pill:hover {
          background: rgba(156,255,0,0.1);
          border-color: rgba(156,255,0,0.3);
          transform: scale(1.08);
        }
        .rb-pill:active { transform: scale(0.95); }

        .rb-pill.reacted {
          background: rgba(156,255,0,0.18);
          border-color: rgba(156,255,0,0.45);
        }
        .rb-pill.reacted .rb-count {
          color: #9cff00;
        }

        /* Announcement pills — bigger & more vibrant */
        .rb-pill.ann-pill {
          padding: 5px 12px 5px 9px;
          border-radius: 9px;
          background: rgba(255,255,255,0.06);
          border: 1.5px solid rgba(255,255,255,0.1);
        }
        .rb-pill.ann-pill:hover {
          transform: scale(1.12) translateY(-2px);
          box-shadow: 0 4px 16px rgba(156,255,0,0.25);
        }
        .rb-pill.ann-pill.reacted {
          background: rgba(156,255,0,0.2);
          border-color: rgba(156,255,0,0.5);
          box-shadow: 0 0 16px rgba(156,255,0,0.2);
        }

        .rb-emoji {
          font-size: 15px;
          line-height: 1;
        }
        .ann-pill .rb-emoji { font-size: 18px; }

        .rb-count {
          font-size: 12px;
          font-weight: 700;
          color: #888;
          min-width: 12px;
          text-align: center;
        }
        .ann-pill .rb-count { font-size: 13px; }
      `}</style>
    </div>
  );
};

// ─── ReactionBurst ────────────────────────────────────────────────────────────
export const ReactionBurst = ({ emoji, x, y }) => {
  const particles = Array.from({ length: 8 }, (_, i) => ({
    angle: (i / 8) * 360,
    distance: 30 + Math.random() * 30,
    size: 14 + Math.random() * 10,
    delay: Math.random() * 80,
  }));

  return (
    <div
      className="burst-root"
      style={{ position: "fixed", left: x, top: y, pointerEvents: "none", zIndex: 9999 }}
    >
      {/* Main emoji pop */}
      <div className="burst-main">{emoji}</div>

      {/* Particles */}
      {particles.map((p, i) => (
        <div
          key={i}
          className="burst-particle"
          style={{
            fontSize: p.size,
            "--angle": `${p.angle}deg`,
            "--distance": `${p.distance}px`,
            animationDelay: `${p.delay}ms`,
          }}
        >
          {emoji}
        </div>
      ))}

      <style>{`
        .burst-root {
          transform: translate(-50%, -50%);
        }

        .burst-main {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          font-size: 28px;
          animation: burstMain 0.5s cubic-bezier(0.34,1.56,0.64,1) forwards;
        }
        @keyframes burstMain {
          0% { transform: translate(-50%,-50%) scale(0); opacity: 1; }
          60% { transform: translate(-50%,-60%) scale(1.4); opacity: 1; }
          100% { transform: translate(-50%,-70%) scale(1); opacity: 0; }
        }

        .burst-particle {
          position: absolute;
          top: 50%;
          left: 50%;
          animation: burstOut 0.7s ease-out forwards;
          animation-delay: var(--animationDelay, 0ms);
        }
        @keyframes burstOut {
          0% {
            transform: translate(-50%,-50%) rotate(var(--angle)) translateX(0) scale(0);
            opacity: 1;
          }
          50% {
            opacity: 1;
            transform: translate(-50%,-50%) rotate(var(--angle)) translateX(var(--distance)) scale(1);
          }
          100% {
            opacity: 0;
            transform: translate(-50%,-50%) rotate(var(--angle)) translateX(calc(var(--distance) * 1.5)) scale(0.5);
          }
        }
      `}</style>
    </div>
  );
};

// ─── MessageReactionArea ──────────────────────────────────────────────────────
/**
 * Full area that wraps a message — shows reaction bar + hover picker trigger
 */
export const MessageReactionArea = ({ message, userId, onToggle, children, isAnnouncement = false, showReactionTrigger = false }) => {
  const [showPicker, setShowPicker] = useState(false);
  const [pickerStyle, setPickerStyle] = useState({ position: "fixed", left: 12, top: 12, zIndex: 10000 });
  const [burst, setBurst] = useState(null);
  const areaRef = useRef(null);
  const triggerRef = useRef(null);
  const burstIdRef = useRef(0);

  const handleAddReaction = (emoji) => {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (rect) {
      setBurst({ emoji, x: rect.left + rect.width / 2, y: rect.top, id: `${Date.now()}-${burstIdRef.current++}` });
      window.setTimeout(() => setBurst(null), 800);
    }
    onToggle?.(message.id, emoji);
    setShowPicker(false);
  };

  const togglePicker = () => {
    if (showPicker) {
      setShowPicker(false);
      return;
    }
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const panelWidth = Math.min(360, window.innerWidth - 24);
    const panelHeight = Math.min(520, window.innerHeight - 24);
    const left = Math.max(12, Math.min(rect.right - panelWidth, window.innerWidth - panelWidth - 12));
    const top = rect.top - panelHeight - 8 >= 12 ? rect.top - panelHeight - 8 : Math.min(rect.bottom + 8, window.innerHeight - panelHeight - 12);
    setPickerStyle({ position: "fixed", left, top, zIndex: 10000 });
    setShowPicker(true);
  };

  const reactionRow = (
    <div className={`mra-reaction-row${isAnnouncement ? " announcement" : ""}`}>
      <ReactionBar
        reactions={message.reactions || {}}
        userId={userId}
        onToggle={(emoji) => onToggle?.(message.id, emoji)}
        isAnnouncement={isAnnouncement}
        triggerRef={triggerRef}
        onOpenPicker={showReactionTrigger ? togglePicker : undefined}
      />
    </div>
  );

  return (
    <div
      ref={areaRef}
      className={`mra-wrapper ${isAnnouncement ? "mra-ann" : ""}`}
    >
      {typeof children === "function" ? children({ reactionRow }) : children}

      {showPicker && ReactDOM.createPortal(
        <EmojiPanel style={pickerStyle} managePosition={false} onSelect={handleAddReaction} onClose={() => setShowPicker(false)} />,
        document.body,
      )}
      {burst && <ReactionBurst key={burst.id} emoji={burst.emoji} x={burst.x} y={burst.y} />}

      <style>{`
        .mra-wrapper {
          position: relative;
          display: flex;
          flex: 0 1 auto;
          width: 100%;
          max-width: 100%;
          flex-direction: column;
          align-items: flex-end;
          min-width: 0;
        }
        .mra-wrapper .msg-bubble { width: auto; max-width: 100%; }
        .msg-item.them .mra-wrapper { margin-right: auto; }
        .msg-item.me .mra-wrapper { margin-left: auto; }
        .mra-ann { align-items: flex-start; width: min(92%, 760px); max-width: 92%; }
        .mra-picker-wrap {
          position: absolute;
          right: 10px;
          bottom: 6px;
          z-index: 200;
        }
        .mra-reaction-trigger {
          position: relative;
          flex: 0 0 auto;
          z-index: 201;
          width: 28px;
          height: 28px;
          display: grid;
          place-items: center;
          color: #cde6bd;
          background: rgba(8, 14, 10, .86);
          border: 1px solid rgba(156, 255, 0, .28);
          border-radius: 8px;
          cursor: pointer;
        }
        .mra-reaction-trigger:hover { color: #9cff00; border-color: rgba(156, 255, 0, .6); background: rgba(156, 255, 0, .12); }
        .mra-ann .mra-picker-wrap {
          right: 12px;
          bottom: 42px;
        }
        .mra-reaction-row {
          position: relative;
          display: flex;
          align-items: center;
          gap: 4px;
          width: 100%;
          max-width: 100%;
          min-width: 0;
          min-height: 30px;
          margin-top: 3px;
          padding: 0 0 0 0;
          box-sizing: border-box;
        }
        .mra-reaction-row .rb-bar {
          flex: 1 1 auto;
          width: auto;
          max-width: none;
          min-width: 0;
          margin-top: 0;
          justify-content: flex-start;
          flex-wrap: wrap;
          min-height: 26px;
          padding: 0;
        }
        .mra-reaction-trigger { position: relative; right: auto; left: auto; bottom: auto; }
        .mra-reaction-row.announcement .rb-bar {
          flex: 0 1 auto;
          min-width: 0;
          flex-wrap: wrap;
        }
        @media (max-width: 768px) {
          .mra-wrapper { max-width: 80%; }
        }
      `}</style>
    </div>
  );
};

export default ReactionBar;