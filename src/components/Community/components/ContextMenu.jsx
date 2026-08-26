import React, { useEffect, useRef, useState } from "react";
import { Copy, Edit2, Flag, Forward, MoreHorizontal, Reply, Trash2 } from "lucide-react";
import EmojiPanel from "./EmojiPanel";

const QUICK_EMOJIS = ["❤️", "😂", "🔥", "👏"];
const MORE_EMOJIS = ["😍", "🤯", "💯", "👑", "🚀", "😭", "🥳", "💀", "👍", "🙏", "🎉", "✨"];

const ContextMenu = ({ position, message, userId, permissions = {}, isOwner, onClose, onEdit, onDelete, onReaction, onCopy, onReply, onForward, onReport }) => {
  const [showMore, setShowMore] = useState(false);
  const [showReactionPanel, setShowReactionPanel] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const panelRef = useRef(null);
  const reactionPanelRef = useRef(null);
  const [reactionPanelStyle, setReactionPanelStyle] = useState({ position: "fixed", left: position?.x || 12, top: position?.y || 12, zIndex: 10000 });
  const getHeaderOffset = () => window.innerWidth <= 768 ? 47 : 58;

  useEffect(() => {
    const handlePointerDown = (event) => {
      const activePanel = showReactionPanel ? reactionPanelRef.current : panelRef.current;
      if (activePanel && !activePanel.contains(event.target)) {
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
  }, [onClose, showReactionPanel]);

  useEffect(() => {
    if (!panelRef.current || !position) return;
    const { width, height } = panelRef.current.getBoundingClientRect();
    panelRef.current.style.left = `${Math.max(12, Math.min(position.x, window.innerWidth - width - 12))}px`;
    panelRef.current.style.top = `${Math.max(12, Math.min(position.y, window.innerHeight - height - 12))}px`;
  }, [position, showMore]);

  useEffect(() => {
    if (!showReactionPanel || !reactionPanelRef.current || !position) return;
    const placeReactionPanel = () => {
      const { width, height } = reactionPanelRef.current.getBoundingClientRect();
      const left = Math.max(12, Math.min(position.x, window.innerWidth - width - 12));
      const safeTop = getHeaderOffset() + 8;
      const availableBelow = window.innerHeight - position.y - 12;
      const availableAbove = position.y - safeTop;
      const canOpenBelow = height <= availableBelow;
      const canOpenAbove = height <= availableAbove;
      const top = canOpenBelow
        ? Math.max(safeTop, position.y)
        : canOpenAbove
          ? position.y - height
          : availableBelow >= availableAbove
            ? safeTop
            : Math.max(safeTop, position.y - height);
      setReactionPanelStyle({
        position: "fixed",
        left,
        top,
        maxHeight: Math.max(180, window.innerHeight - 24),
        zIndex: 10000,
      });
    };
    placeReactionPanel();
    window.addEventListener("resize", placeReactionPanel);
    return () => window.removeEventListener("resize", placeReactionPanel);
  }, [position, showReactionPanel]);

  if (!position || !message) return null;
  const canEdit = message.user_id === userId;
  const canDelete = canEdit || permissions.manageMessages || isOwner;
  const handle = (action) => { action?.(); onClose?.(); };
  const confirmDelete = async () => {
    setShowDeleteConfirm(false);
    await onDelete?.();
    onClose?.();
  };

  return (
    <div className="message-context-backdrop" onClick={onClose}>
      {showReactionPanel ? (
        <EmojiPanel
          panelRef={reactionPanelRef}
          managePosition={false}
          onSelect={(emoji) => onReaction?.(emoji)}
          onClose={onClose}
          style={reactionPanelStyle}
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
        {canDelete && <button className="message-context-item danger" onClick={() => setShowDeleteConfirm(true)}><Trash2 size={14} /><span>Delete message</span></button>}
        <button className="message-context-item" onClick={() => handle(onReport)}><Flag size={14} /><span>Report message</span></button>
      </div>}
      {showDeleteConfirm && (
        <div className="message-delete-dialog-backdrop" onClick={() => setShowDeleteConfirm(false)}>
          <div className="message-delete-dialog" onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="delete-message-title">
            <div className="message-delete-icon"><Trash2 size={18} /></div>
            <div>
              <h3 id="delete-message-title">Delete message?</h3>
              <p>This message will be removed from the conversation.</p>
            </div>
            <div className="message-delete-actions">
              <button className="message-delete-cancel" onClick={() => setShowDeleteConfirm(false)}>Keep message</button>
              <button className="message-delete-confirm" onClick={confirmDelete}>Delete</button>
            </div>
          </div>
        </div>
      )}
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
        .message-delete-dialog-backdrop{position:fixed;inset:0;z-index:10002;background:rgba(0,0,0,.58);backdrop-filter:blur(8px);display:flex;align-items:center;justify-content:center;padding:20px;}
        .message-delete-dialog{width:min(360px,calc(100vw - 32px));display:grid;grid-template-columns:44px 1fr;gap:12px;padding:18px;background:linear-gradient(160deg,#182019,#0b100d);border:1px solid rgba(156,255,0,.3);border-radius:16px;box-shadow:0 22px 70px rgba(0,0,0,.8),0 0 30px rgba(156,255,0,.08);animation:deleteDialogIn .16s ease-out;}
        @keyframes deleteDialogIn{from{opacity:0;transform:translateY(8px) scale(.97)}to{opacity:1;transform:none}}
        .message-delete-icon{width:40px;height:40px;border-radius:12px;display:flex;align-items:center;justify-content:center;color:#ff8b8b;background:rgba(239,68,68,.12);border:1px solid rgba(239,68,68,.28);}
        .message-delete-dialog h3{margin:2px 0 5px;color:#f5f8f2;font-size:15px;font-weight:800;}
        .message-delete-dialog p{margin:0;color:#9da79b;font-size:12px;line-height:1.5;}
        .message-delete-actions{grid-column:1/-1;display:flex;justify-content:flex-end;gap:8px;margin-top:5px;}
        .message-delete-actions button{border-radius:9px;padding:8px 12px;font:700 12px inherit;cursor:pointer;}
        .message-delete-cancel{background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);color:#b8c0b6;}
        .message-delete-confirm{background:#ef6262;border:1px solid #ff8585;color:#fff;box-shadow:0 4px 14px rgba(239,68,68,.2);}
      `}</style>
    </div>
  );
};

export default ContextMenu;