// components/Community/components/ChannelContextMenu.jsx
// Updated: adds "Channel Permissions" option for admins/owners
import React, { useState, useRef, useEffect } from "react";
import { Edit3, Trash2, Lock, Unlock, Archive, Shield, Settings2 } from "lucide-react";

const ChannelContextMenu = ({
  position,
  channel,
  isOwner,
  hasManagePermission,
  isAdministrator,
  onClose,
  onEdit,
  onDelete,
  onTogglePrivacy,
  onWipeChannel,
  onPermissions,  // NEW
}) => {
  const [confirmAction, setConfirmAction] = useState(null);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!menuRef.current || !position) return;
    const menu = menuRef.current;
    const { width: mw, height: mh } = menu.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const pad = 12;
    let x = position.x;
    let y = position.y;
    if (x + mw > vw - pad) x = vw - mw - pad;
    if (x < pad) x = pad;
    if (y + mh > vh - pad) y = vh - mh - pad;
    if (y < pad) y = pad;
    menu.style.left = `${x}px`;
    menu.style.top  = `${y}px`;
    menu.style.opacity = "1";
  }, [position]);

  if (!position || !channel) return null;

  const handleAction = (action, requiresConfirm = false) => {
    if (requiresConfirm) {
      setConfirmAction(action);
    } else {
      action();
      onClose();
    }
  };

  return (
    <>
      <div className="ctx-overlay" onClick={onClose} />

      <div
        ref={menuRef}
        className="ch-ctx-menu"
        style={{ left: position.x, top: position.y, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
      >
        {confirmAction ? (
          <div className="confirm-section">
            <div className="confirm-icon"><Shield size={18} /></div>
            <div className="confirm-text">
              <h4>Confirm Action</h4>
              <p>This cannot be undone.</p>
            </div>
            <div className="confirm-btns">
              <button className="cfm-btn cancel" onClick={() => setConfirmAction(null)}>Cancel</button>
              <button className="cfm-btn proceed" onClick={() => { confirmAction(); setConfirmAction(null); onClose(); }}>Confirm</button>
            </div>
          </div>
        ) : (
          <>
            {/* Manage section */}
            {hasManagePermission && (
              <div className="ctx-section">
                <button className="ctx-item" onClick={() => handleAction(() => onEdit?.())}>
                  <Edit3 size={15} /><span>Edit Channel</span>
                </button>
                <button className="ctx-item" onClick={() => handleAction(() => onTogglePrivacy?.())}>
                  {channel.is_private
                    ? <><Unlock size={15} /><span>Make Public</span></>
                    : <><Lock size={15} /><span>Make Private</span></>
                  }
                </button>
              </div>
            )}

            {/* Permissions - for admins/owners */}
            {(isAdministrator || isOwner) && (
              <>
                {hasManagePermission && <div className="ctx-divider" />}
                <div className="ctx-section">
                  <button className="ctx-item perms" onClick={() => handleAction(() => onPermissions?.())}>
                    <Settings2 size={15} /><span>Channel Permissions</span>
                  </button>
                </div>
              </>
            )}

            {/* Danger zone */}
            {isAdministrator && (
              <>
                <div className="ctx-divider" />
                <div className="ctx-section admin-sec">
                  <button className="ctx-item warning" onClick={() => handleAction(() => onWipeChannel?.(channel), true)}>
                    <Archive size={15} /><span>Wipe All Messages</span>
                  </button>
                </div>
              </>
            )}

            {(hasManagePermission || isOwner) && (
              <>
                <div className="ctx-divider" />
                <div className="ctx-section">
                  <button className="ctx-item danger" onClick={() => handleAction(() => onDelete?.(), true)}>
                    <Trash2 size={15} /><span>Delete Channel</span>
                  </button>
                </div>
              </>
            )}
          </>
        )}
      </div>

      <style>{`
        .ctx-overlay {
          position:fixed; inset:0; z-index:9998;
        }
        .ch-ctx-menu {
          position:fixed;
          background:rgba(10,10,10,0.98);
          border:1px solid rgba(156,255,0,0.16);
          border-radius:12px; padding:6px;
          min-width:200px; max-width:240px;
          box-shadow:0 8px 28px rgba(0,0,0,.85), 0 0 40px rgba(156,255,0,.06);
          backdrop-filter:blur(20px); z-index:9999;
          animation:ctxIn 0.14s cubic-bezier(.4,0,.2,1);
          transition:opacity .08s ease;
        }
        @keyframes ctxIn {
          from{opacity:0;transform:scale(.95) translateY(-4px)}
          to  {opacity:1;transform:scale(1)   translateY(0)    }
        }
        .ctx-section { display:flex; flex-direction:column; gap:1px; }
        .admin-sec {
          background:rgba(156,255,0,.02); border-radius:7px; padding:3px;
        }
        .ctx-divider {
          height:1px; background:rgba(156,255,0,.07); margin:5px 0;
        }
        .ctx-item {
          display:flex; align-items:center; gap:9px;
          padding:8px 10px; background:transparent; border:none;
          border-radius:7px; color:rgba(255,255,255,.85);
          font-size:13px; font-weight:600; cursor:pointer;
          transition:all .13s; width:100%; text-align:left;
        }
        .ctx-item:hover { background:rgba(156,255,0,.08); color:#9cff00; transform:translateX(2px); }
        .ctx-item.danger { color:rgba(239,68,68,.9); }
        .ctx-item.danger:hover { background:rgba(239,68,68,.08); color:#ef4444; }
        .ctx-item.warning { color:rgba(251,146,60,.9); }
        .ctx-item.warning:hover { background:rgba(251,146,60,.08); color:#fb923c; }
        .ctx-item.perms { color:rgba(102,126,234,.9); }
        .ctx-item.perms:hover { background:rgba(102,126,234,.08); color:#667eea; }
        .ctx-item svg { flex-shrink:0; opacity:.85; }
        .ctx-item:hover svg { opacity:1; }
        .ctx-item span { flex:1; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }

        /* Confirm */
        .confirm-section { padding:12px; display:flex; flex-direction:column; gap:10px; }
        .confirm-icon {
          width:36px; height:36px; border-radius:50%;
          background:rgba(251,146,60,.1); border:1px solid rgba(251,146,60,.3);
          display:flex; align-items:center; justify-content:center;
          color:#fb923c; margin:0 auto;
        }
        .confirm-text { text-align:center; }
        .confirm-text h4 { font-size:13px; font-weight:800; color:#fff; margin:0 0 3px; }
        .confirm-text p  { font-size:11px; color:rgba(255,255,255,.5); margin:0; }
        .confirm-btns { display:grid; grid-template-columns:1fr 1fr; gap:6px; }
        .cfm-btn {
          padding:7px 10px; border-radius:7px; font-size:12px; font-weight:700;
          cursor:pointer; transition:all .15s; border:1px solid;
        }
        .cfm-btn.cancel {
          background:rgba(100,100,100,.08); border-color:rgba(100,100,100,.2); color:rgba(255,255,255,.6);
        }
        .cfm-btn.cancel:hover { background:rgba(100,100,100,.15); color:#fff; }
        .cfm-btn.proceed {
          background:rgba(239,68,68,.12); border-color:rgba(239,68,68,.3); color:#ef4444;
        }
        .cfm-btn.proceed:hover { background:rgba(239,68,68,.2); border-color:#ef4444; }

        @media(max-width:768px){
          .ch-ctx-menu{min-width:190px;max-width:calc(100vw - 32px);}
        }
      `}</style>
    </>
  );
};

export default ChannelContextMenu;