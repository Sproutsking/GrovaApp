import React, { useEffect, useRef, useState } from "react";
import { Copy, Edit2, Flag, Forward, MoreHorizontal, Reply, Trash2 } from "lucide-react";
import EmojiPanel from "./EmojiPanel";

const QUICK_EMOJIS = ["❤️", "😂", "🔥", "👏"];
const MORE_EMOJIS = ["😍", "🤯", "💯", "👑", "🚀", "😭", "🥳", "💀", "👍", "🙏", "🎉", "✨"];

const ContextMenu = ({ position, message, userId, permissions = {}, isOwner, onClose, onEdit, onDelete, onReaction, onCopy, onReply, onForward, onReport }) => {
  const [showMore, setShowMore] = useState(false);
  const [showReactionPanel, setShowReactionPanel] = useState(false);
  const panelRef = useRef(null);

  useEffect(() => {
    const handlePointerDown = (event) => {
      if (panelRef.current && !panelRef.current.contains(event.target)) {
        onClose?.();
      }
    };
    const handleKeyDown = (event) => event.key === "Escape" && onClose?.();
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  useEffect(() => {
    if (!panelRef.current || !position) return;
    const { width, height } = panelRef.current.getBoundingClientRect();
    panelRef.current.style.left = `${Math.max(12, Math.min(position.x, window.innerWidth - width - 12))}px`;
    panelRef.current.style.top = `${Math.max(12, Math.min(position.y, window.innerHeight - height - 12))}px`;
  }, [position, showMore]);

  if (!position || !message) return null;
  const canEdit = message.user_id === userId;
  const canDelete = canEdit || permissions.manageMessages || isOwner;
  const handle = (action) => { action?.(); onClose?.(); };

  return (
    <div className="message-context-backdrop" onClick={onClose}>
      {showReactionPanel ? (
        <EmojiPanel
          onSelect={(emoji) => onReaction?.(emoji)}
          onClose={onClose}
          style={{ position: "fixed", left: position.x, top: position.y, zIndex: 10000 }}
        />
      ) : <div ref={panelRef} className="message-context-menu" style={{ left: position.x, top: position.y }} onClick={(event) => event.stopPropagation()}>
        <button className="message-context-item primary" onClick={() => handle(onReply)}><Reply size={15} /><span>Reply</span></button>
        <div className="message-quick-reactions">
          {QUICK_EMOJIS.map((emoji) => <button key={emoji} onClick={() => handle(() => onReaction?.(emoji))}>{emoji}</button>)}
          <button className={`message-more-reaction${showMore ? " active" : ""}`} onClick={() => setShowReactionPanel(true)}><MoreHorizontal size={16} /></button>
        </div>
        {showMore && <div className="message-more-grid">{MORE_EMOJIS.map((emoji) => <button key={emoji} onClick={() => handle(() => onReaction?.(emoji))}>{emoji}</button>)}</div>}
        <div className="message-context-divider" />
        <button className="message-context-item" onClick={() => handle(onCopy)}><Copy size={14} /><span>Copy message</span></button>
        <button className="message-context-item" onClick={() => handle(onForward)}><Forward size={14} /><span>Forward message</span></button>
        {canEdit && <button className="message-context-item" onClick={() => handle(onEdit)}><Edit2 size={14} /><span>Edit message</span></button>}
        {canDelete && <button className="message-context-item danger" onClick={() => handle(onDelete)}><Trash2 size={14} /><span>Delete message</span></button>}
        <button className="message-context-item" onClick={() => handle(onReport)}><Flag size={14} /><span>Report message</span></button>
      </div>}
      <style>{`
        .message-context-backdrop{position:fixed;inset:0;z-index:9998}
        .message-context-menu{position:fixed;width:238px;padding:7px;background:rgba(12,14,18,.98);border:1px solid rgba(156,255,0,.2);border-radius:13px;box-shadow:0 18px 46px rgba(0,0,0,.75),0 0 24px rgba(156,255,0,.06);animation:messageMenuIn .14s ease;z-index:9999}
        @keyframes messageMenuIn{from{opacity:0;transform:scale(.96) translateY(-4px)}to{opacity:1;transform:none}}
        .message-context-item{width:100%;display:flex;align-items:center;gap:9px;padding:9px 10px;border:0;border-radius:8px;background:transparent;color:#c8c8c8;font:600 12px/1.2 inherit;cursor:pointer;text-align:left}
        .message-context-item:hover,.message-context-item.primary{background:rgba(156,255,0,.09);color:#9cff00}
        .message-context-item.danger{color:#ff8585}.message-context-item.danger:hover{background:rgba(255,107,107,.09);color:#ff6b6b}
        .message-quick-reactions{display:grid;grid-template-columns:repeat(5,1fr);gap:3px;padding:5px 2px}
        .message-quick-reactions button,.message-more-grid button{height:30px;border:0;border-radius:7px;background:rgba(255,255,255,.04);font-size:18px;cursor:pointer;display:flex;align-items:center;justify-content:center}
        .message-quick-reactions button:hover,.message-more-grid button:hover{background:rgba(156,255,0,.12);transform:translateY(-1px)}
        .message-more-reaction{color:#888}.message-more-reaction.active{color:#9cff00;background:rgba(156,255,0,.12)!important}
        .message-more-grid{display:grid;grid-template-columns:repeat(6,1fr);gap:3px;padding:3px 2px 6px;border-top:1px solid rgba(255,255,255,.06)}
        .message-more-grid button{font-size:16px}
        .message-context-divider{height:1px;background:rgba(255,255,255,.07);margin:4px 0}
        @media(max-width:520px){.message-context-menu{width:min(238px,calc(100vw - 24px))}}
      `}</style>
    </div>
  );
};

export default ContextMenu;