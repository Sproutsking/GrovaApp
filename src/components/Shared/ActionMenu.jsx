// ============================================================================
// src/components/Shared/ActionMenu.jsx — COMPLETE REWRITE v3
// All options functional, compact elegant design, custom dialogs only
// ============================================================================

import React, { useState, useRef, useEffect, useCallback } from "react";
import ReactDOM from "react-dom";
import {
  Edit3, Flag, Trash2, Share2, X, Copy, BookmarkPlus,
  ThumbsDown, ThumbsUp, Check, AlertTriangle, FolderPlus,
} from "lucide-react";

// ─── TOAST ───────────────────────────────────────────────────────────────────
const Toast = ({ message, type = "success", onDone }) => {
  useEffect(() => {
    const t = setTimeout(onDone, 2200);
    return () => clearTimeout(t);
  }, [onDone]);

  return ReactDOM.createPortal(
    <div style={{
      position: "fixed",
      bottom: "calc(env(safe-area-inset-bottom,0px) + 24px)",
      left: "50%", transform: "translateX(-50%)",
      background: type === "error" ? "#ef4444" : "#111",
      color: "#fff", padding: "9px 18px", borderRadius: "999px",
      fontSize: "13px", fontWeight: 600, zIndex: 999999,
      boxShadow: "0 4px 24px rgba(0,0,0,0.5)",
      border: type === "error" ? "1px solid #fca5a5" : "1px solid rgba(132,204,22,0.4)",
      whiteSpace: "nowrap", animation: "toastIn 0.25s ease",
      display: "flex", alignItems: "center", gap: "7px",
    }}>
      {type === "success" ? <Check size={13} color="#84cc16" /> : <AlertTriangle size={13} />}
      {message}
    </div>,
    document.body
  );
};

// ─── CONFIRM DELETE DIALOG ────────────────────────────────────────────────────
const ConfirmDialog = ({ contentType, loading, onConfirm, onCancel }) =>
  ReactDOM.createPortal(
    <>
      <div onClick={onCancel} style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)",
        zIndex: 100000, backdropFilter: "blur(4px)",
      }} />
      <div style={{
        position: "fixed", top: "50%", left: "50%",
        transform: "translate(-50%,-50%)",
        background: "#111", border: "1px solid rgba(239,68,68,0.35)",
        borderRadius: "18px", padding: "28px 24px",
        width: "min(310px, calc(100vw - 40px))",
        zIndex: 100001, boxShadow: "0 24px 80px rgba(0,0,0,0.8)",
        animation: "confirmIn 0.2s ease",
      }}>
        <div style={{
          width: 46, height: 46, background: "rgba(239,68,68,0.1)",
          border: "1px solid rgba(239,68,68,0.25)", borderRadius: "50%",
          display: "flex", alignItems: "center", justifyContent: "center",
          margin: "0 auto 14px",
        }}>
          <Trash2 size={20} color="#ef4444" />
        </div>
        <p style={{ color: "#f5f5f5", fontSize: "15px", fontWeight: 700, textAlign: "center", marginBottom: 6 }}>
          Delete {contentType}?
        </p>
        <p style={{ color: "#737373", fontSize: "13px", textAlign: "center", marginBottom: 22, lineHeight: 1.5 }}>
          This will be permanently removed and cannot be recovered.
        </p>
        <div style={{ display: "flex", gap: "10px" }}>
          <button onClick={onCancel} disabled={loading} style={{
            flex: 1, padding: "11px", background: "rgba(255,255,255,0.05)",
            border: "1px solid rgba(255,255,255,0.1)", borderRadius: "11px",
            color: "#a3a3a3", fontSize: "14px", fontWeight: 600, cursor: "pointer",
          }}>Cancel</button>
          <button onClick={onConfirm} disabled={loading} style={{
            flex: 1, padding: "11px",
            background: loading ? "rgba(239,68,68,0.2)" : "rgba(239,68,68,0.12)",
            border: "1px solid rgba(239,68,68,0.45)", borderRadius: "11px",
            color: "#ef4444", fontSize: "14px", fontWeight: 700,
            cursor: loading ? "not-allowed" : "pointer",
          }}>
            {loading ? "Deleting…" : "Delete"}
          </button>
        </div>
      </div>
    </>,
    document.body
  );

// ─── INTERESTED DIALOG ────────────────────────────────────────────────────────
const InterestedDialog = ({ interested, onConfirm, onCancel }) =>
  ReactDOM.createPortal(
    <>
      <div onClick={onCancel} style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)",
        zIndex: 100000, backdropFilter: "blur(4px)",
      }} />
      <div style={{
        position: "fixed", top: "50%", left: "50%",
        transform: "translate(-50%,-50%)",
        background: "#111", border: "1px solid rgba(132,204,22,0.3)",
        borderRadius: "18px", padding: "28px 24px",
        width: "min(310px, calc(100vw - 40px))",
        zIndex: 100001, boxShadow: "0 24px 80px rgba(0,0,0,0.8)",
        animation: "confirmIn 0.2s ease",
      }}>
        <div style={{
          width: 46, height: 46, background: "rgba(132,204,22,0.1)",
          border: "1px solid rgba(132,204,22,0.25)", borderRadius: "50%",
          display: "flex", alignItems: "center", justifyContent: "center",
          margin: "0 auto 14px",
        }}>
          {interested ? <ThumbsUp size={20} color="#84cc16" /> : <ThumbsDown size={20} color="#737373" />}
        </div>
        <p style={{ color: "#f5f5f5", fontSize: "15px", fontWeight: 700, textAlign: "center", marginBottom: 6 }}>
          {interested ? "See more like this?" : "See less like this?"}
        </p>
        <p style={{ color: "#737373", fontSize: "13px", textAlign: "center", marginBottom: 22, lineHeight: 1.5 }}>
          {interested
            ? "We'll show you more content similar to this in your feed."
            : "We'll reduce content like this in your feed."}
        </p>
        <div style={{ display: "flex", gap: "10px" }}>
          <button onClick={onCancel} style={{
            flex: 1, padding: "11px", background: "rgba(255,255,255,0.05)",
            border: "1px solid rgba(255,255,255,0.1)", borderRadius: "11px",
            color: "#a3a3a3", fontSize: "14px", fontWeight: 600, cursor: "pointer",
          }}>No thanks</button>
          <button onClick={onConfirm} style={{
            flex: 1, padding: "11px",
            background: "rgba(132,204,22,0.12)",
            border: "1px solid rgba(132,204,22,0.4)", borderRadius: "11px",
            color: "#84cc16", fontSize: "14px", fontWeight: 700, cursor: "pointer",
          }}>Yes, update</button>
        </div>
      </div>
    </>,
    document.body
  );

// ─── REPORT DIALOG ────────────────────────────────────────────────────────────
const ReportDialog = ({ contentType, onConfirm, onCancel }) => {
  const [reason, setReason] = useState("");
  const reasons = ["Spam", "Misinformation", "Inappropriate content", "Hate speech", "Violence", "Harassment", "Other"];
  return ReactDOM.createPortal(
    <>
      <div onClick={onCancel} style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)",
        zIndex: 100000, backdropFilter: "blur(4px)",
      }} />
      <div style={{
        position: "fixed", top: "50%", left: "50%",
        transform: "translate(-50%,-50%)",
        background: "#111", border: "1px solid rgba(251,146,60,0.3)",
        borderRadius: "18px", padding: "24px",
        width: "min(320px, calc(100vw - 40px))",
        zIndex: 100001, boxShadow: "0 24px 80px rgba(0,0,0,0.8)",
        animation: "confirmIn 0.2s ease",
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <p style={{ color: "#f5f5f5", fontSize: "15px", fontWeight: 700 }}>Report {contentType}</p>
          <button onClick={onCancel} style={{ background: "none", border: "none", color: "#737373", cursor: "pointer", padding: 4 }}>
            <X size={18} />
          </button>
        </div>
        <p style={{ color: "#737373", fontSize: "12px", marginBottom: 14 }}>Select a reason:</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 18 }}>
          {reasons.map(r => (
            <button key={r} onClick={() => setReason(r)} style={{
              padding: "9px 12px", textAlign: "left", borderRadius: "10px",
              border: `1px solid ${reason === r ? "rgba(251,146,60,0.5)" : "rgba(255,255,255,0.08)"}`,
              background: reason === r ? "rgba(251,146,60,0.1)" : "transparent",
              color: reason === r ? "#fb923c" : "#a3a3a3",
              fontSize: "13px", fontWeight: 600, cursor: "pointer",
            }}>{r}</button>
          ))}
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={onCancel} style={{
            flex: 1, padding: "11px", background: "rgba(255,255,255,0.05)",
            border: "1px solid rgba(255,255,255,0.1)", borderRadius: "11px",
            color: "#a3a3a3", fontSize: "14px", fontWeight: 600, cursor: "pointer",
          }}>Cancel</button>
          <button onClick={() => reason && onConfirm(reason)} disabled={!reason} style={{
            flex: 1, padding: "11px",
            background: reason ? "rgba(251,146,60,0.12)" : "rgba(255,255,255,0.03)",
            border: `1px solid ${reason ? "rgba(251,146,60,0.4)" : "rgba(255,255,255,0.06)"}`,
            borderRadius: "11px", color: reason ? "#fb923c" : "#525252",
            fontSize: "14px", fontWeight: 700, cursor: reason ? "pointer" : "not-allowed",
          }}>Submit Report</button>
        </div>
      </div>
    </>,
    document.body
  );
};

// ─── SAVE FOLDER PICKER (POPUP) ───────────────────────────────────────────────
const SaveFolderPicker = ({ contentType, contentId, onClose, onSaved }) => {
  const STORAGE_KEY = "save_folders";
  const ITEMS_KEY = "saved_content_items";

  const [folders, setFolders] = useState(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : ["Favorites"];
    } catch { return ["Favorites"]; }
  });
  const [newFolderName, setNewFolderName] = useState("");
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(null);
  const [flash, setFlash] = useState(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (creating && inputRef.current) inputRef.current.focus();
  }, [creating]);

  const showFlash = (msg, type = "success") => {
    setFlash({ msg, type });
    setTimeout(() => setFlash(null), 2000);
  };

  const saveToFolder = async (folder) => {
    setSaving(folder);
    try {
      const items = JSON.parse(localStorage.getItem(ITEMS_KEY) || "[]");
      const exists = items.find(i => i.content_id === contentId && i.folder === folder);
      if (!exists) {
        items.push({
          id: `${Date.now()}_${Math.random()}`,
          content_type: contentType,
          content_id: contentId,
          folder,
          created_at: new Date().toISOString(),
        });
        localStorage.setItem(ITEMS_KEY, JSON.stringify(items));
      }
      showFlash(`Saved to ${folder}!`);
      setTimeout(() => { onSaved?.(folder); onClose(); }, 1200);
    } catch (e) {
      showFlash("Failed to save", "error");
    } finally {
      setSaving(null);
    }
  };

  const createFolder = () => {
    const name = newFolderName.trim();
    if (!name) return;
    if (folders.length >= 10) { showFlash("Max 10 folders", "error"); return; }
    if (folders.includes(name)) { showFlash("Folder exists", "error"); return; }
    const next = [...folders, name];
    setFolders(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    setNewFolderName("");
    setCreating(false);
    showFlash(`"${name}" created!`);
  };

  return ReactDOM.createPortal(
    <>
      <div onClick={onClose} style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)",
        zIndex: 100000, backdropFilter: "blur(4px)",
      }} />
      <div onClick={e => e.stopPropagation()} style={{
        position: "fixed", top: "50%", left: "50%",
        transform: "translate(-50%,-50%)",
        background: "#0e0e0e", border: "1px solid rgba(132,204,22,0.25)",
        borderRadius: "20px", padding: "0",
        width: "min(340px, calc(100vw - 32px))",
        maxHeight: "80vh", overflow: "hidden",
        zIndex: 100001, boxShadow: "0 24px 80px rgba(0,0,0,0.9)",
        display: "flex", flexDirection: "column",
        animation: "confirmIn 0.2s ease",
      }}>
        {/* Header */}
        <div style={{
          padding: "18px 20px 14px", borderBottom: "1px solid rgba(255,255,255,0.07)",
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{
              width: 32, height: 32, background: "rgba(132,204,22,0.12)",
              border: "1px solid rgba(132,204,22,0.25)", borderRadius: "9px",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <BookmarkPlus size={15} color="#84cc16" />
            </div>
            <div>
              <div style={{ color: "#f5f5f5", fontSize: "14px", fontWeight: 700 }}>Save to Folder</div>
              <div style={{ color: "#525252", fontSize: "11px" }}>{folders.length}/10 folders</div>
            </div>
          </div>
          <button onClick={onClose} style={{
            width: 28, height: 28, background: "rgba(255,255,255,0.05)",
            border: "1px solid rgba(255,255,255,0.1)", borderRadius: "50%",
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "#737373", cursor: "pointer",
          }}><X size={14} /></button>
        </div>

        {/* Flash */}
        {flash && (
          <div style={{
            margin: "10px 16px 0", padding: "8px 12px", borderRadius: "8px",
            background: flash.type === "error" ? "rgba(239,68,68,0.1)" : "rgba(132,204,22,0.1)",
            border: `1px solid ${flash.type === "error" ? "rgba(239,68,68,0.3)" : "rgba(132,204,22,0.3)"}`,
            color: flash.type === "error" ? "#ef4444" : "#84cc16",
            fontSize: "12px", fontWeight: 600, textAlign: "center",
          }}>{flash.msg}</div>
        )}

        {/* Folder list */}
        <div style={{ padding: "10px 14px", overflowY: "auto", flex: 1 }}>
          {folders.map(folder => (
            <button key={folder} onClick={() => saveToFolder(folder)} disabled={saving === folder} style={{
              width: "100%", padding: "11px 14px", marginBottom: 6,
              background: saving === folder ? "rgba(132,204,22,0.12)" : "rgba(255,255,255,0.03)",
              border: `1px solid ${saving === folder ? "rgba(132,204,22,0.4)" : "rgba(255,255,255,0.08)"}`,
              borderRadius: "11px", display: "flex", alignItems: "center",
              justifyContent: "space-between", cursor: "pointer",
              color: "#d4d4d4", fontSize: "13px", fontWeight: 600,
              transition: "all 0.15s",
            }}>
              <span>📁 {folder}</span>
              {saving === folder && <div style={{
                width: 14, height: 14, border: "2px solid rgba(132,204,22,0.3)",
                borderTop: "2px solid #84cc16", borderRadius: "50%",
                animation: "spin 0.6s linear infinite",
              }} />}
            </button>
          ))}
        </div>

        {/* Create folder */}
        <div style={{ padding: "10px 14px 16px", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
          {!creating ? (
            <button onClick={() => setCreating(true)} disabled={folders.length >= 10} style={{
              width: "100%", padding: "10px", background: "transparent",
              border: "1px dashed rgba(132,204,22,0.3)", borderRadius: "11px",
              color: folders.length >= 10 ? "#525252" : "#84cc16",
              fontSize: "13px", fontWeight: 600, cursor: folders.length >= 10 ? "not-allowed" : "pointer",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            }}>
              <FolderPlus size={15} />
              {folders.length >= 10 ? "Max folders reached" : "New folder"}
            </button>
          ) : (
            <div style={{ display: "flex", gap: 8 }}>
              <input
                ref={inputRef}
                value={newFolderName}
                onChange={e => setNewFolderName(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") createFolder(); if (e.key === "Escape") setCreating(false); }}
                placeholder="Folder name…"
                maxLength={30}
                style={{
                  flex: 1, padding: "10px 12px", background: "rgba(255,255,255,0.05)",
                  border: "1px solid rgba(132,204,22,0.3)", borderRadius: "10px",
                  color: "#f5f5f5", fontSize: "13px", outline: "none",
                  fontFamily: "inherit",
                }}
              />
              <button onClick={createFolder} style={{
                padding: "10px 14px", background: "rgba(132,204,22,0.12)",
                border: "1px solid rgba(132,204,22,0.4)", borderRadius: "10px",
                color: "#84cc16", fontSize: "13px", fontWeight: 700, cursor: "pointer",
              }}>Save</button>
              <button onClick={() => setCreating(false)} style={{
                padding: "10px 12px", background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.1)", borderRadius: "10px",
                color: "#737373", cursor: "pointer",
              }}><X size={14} /></button>
            </div>
          )}
        </div>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </>,
    document.body
  );
};

// ─── MAIN ACTION MENU ─────────────────────────────────────────────────────────
const ActionMenu = ({
  position, isOwnPost, content, contentType = "post",
  currentUser, onClose, onEdit, onDelete, onShare, onSave, onReport,
}) => {
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [showInterested, setShowInterested] = useState(null); // true=interested, false=not interested
  const [showSavePicker, setShowSavePicker] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [toast, setToast] = useState(null);
  const [isMobile] = useState(() => window.innerWidth <= 768);
  const menuRef = useRef(null);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  useEffect(() => {
    const handler = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const showToast = (message, type = "success") => setToast({ message, type });

  const handleEdit = useCallback((e) => {
    e.stopPropagation();
    if (onEdit) onEdit(content);
    onClose();
  }, [onEdit, content, onClose]);

  const handleShare = useCallback((e) => {
    e.stopPropagation();
    if (onShare) onShare(content);
    onClose();
  }, [onShare, content, onClose]);

  const handleCopyLink = useCallback(async (e) => {
    e.stopPropagation();
    try {
      const url = `${window.location.origin}/${contentType}/${content?.id}`;
      await navigator.clipboard.writeText(url);
      showToast("Link copied!");
      setTimeout(onClose, 1500);
    } catch {
      showToast("Failed to copy", "error");
    }
  }, [content, contentType, onClose]);

  const handleDeleteConfirm = useCallback(async () => {
    if (!content?.id) { showToast("Invalid content", "error"); return; }
    try {
      setDeleting(true);
      if (!onDelete) throw new Error("Delete handler not available");
      await onDelete(content.id);
      setShowConfirmDelete(false);
      onClose();
    } catch (err) {
      showToast(err.message || "Failed to delete", "error");
      setDeleting(false);
      setShowConfirmDelete(false);
    }
  }, [content, onDelete, onClose]);

  const handleReportSubmit = useCallback((reason) => {
    if (onReport) onReport(content?.id, reason);
    setShowReport(false);
    showToast("Report submitted. Thank you.");
    setTimeout(onClose, 1800);
  }, [onReport, content, onClose]);

  const handleInterestedConfirm = useCallback(() => {
    const pref = showInterested ? "interested" : "not_interested";
    try {
      const prefs = JSON.parse(localStorage.getItem("content_prefs") || "{}");
      prefs[content?.id] = pref;
      localStorage.setItem("content_prefs", JSON.stringify(prefs));
    } catch {}
    setShowInterested(null);
    showToast(showInterested ? "You'll see more like this!" : "You'll see less like this.");
    setTimeout(onClose, 1800);
  }, [showInterested, content, onClose]);

  const typeLabel = contentType.charAt(0).toUpperCase() + contentType.slice(1);

  // Compact item renderer
  const Item = ({ icon: Icon, label, desc, color = "#d4d4d4", iconBg = "rgba(255,255,255,0.06)", iconColor = "#a3a3a3", onClick, danger, muted, report }) => (
    <button className="am-item" role="menuitem" onClick={onClick} style={{
      '--item-hover-bg': danger ? 'rgba(239,68,68,0.07)' : report ? 'rgba(251,146,60,0.07)' : 'rgba(132,204,22,0.06)',
      '--item-hover-border': danger ? 'rgba(239,68,68,0.25)' : report ? 'rgba(251,146,60,0.25)' : 'rgba(132,204,22,0.18)',
      color: danger ? '#ef4444' : report ? '#fb923c' : muted ? '#a3a3a3' : color,
    }}>
      <span className="am-icon-wrap" style={{ background: iconBg }}>
        <Icon size={15} color={iconColor} />
      </span>
      <span className="am-label-wrap">
        <span className="am-label">{label}</span>
        {desc && <span className="am-desc">{desc}</span>}
      </span>
    </button>
  );

  const menuContent = (
    <>
      <div className="am-overlay" onClick={onClose} />
      <div
        ref={menuRef}
        className={`am-panel ${isMobile ? "am-panel--mobile" : "am-panel--desktop"}`}
        style={!isMobile ? {
          top: Math.min(position.y + 4, window.innerHeight - 460),
          left: Math.min(Math.max(position.x - 260, 12), window.innerWidth - 280),
        } : {}}
        onClick={e => e.stopPropagation()}
      >
        {isMobile && <div className="am-drag" />}
        <div className="am-head">
          <span className="am-head-dot" />
          <span className="am-head-title">{isOwnPost ? `Manage ${typeLabel}` : `${typeLabel} Options`}</span>
          <button className="am-x" onClick={onClose}><X size={14} /></button>
        </div>

        <div className="am-body">
          {isOwnPost ? (
            <>
              <Item icon={Edit3} label={`Edit ${typeLabel}`} desc="Update content" iconBg="rgba(132,204,22,0.1)" iconColor="#84cc16" onClick={handleEdit} />
              <Item icon={Copy} label="Copy Link" desc="Share link" iconBg="rgba(99,102,241,0.1)" iconColor="#818cf8" onClick={handleCopyLink} />
              <Item icon={Share2} label={`Share`} desc="Share to profile" iconBg="rgba(14,165,233,0.1)" iconColor="#38bdf8" onClick={handleShare} />
              <div className="am-divider" />
              <Item icon={Trash2} label={`Delete ${typeLabel}`} desc="Permanently remove" iconBg="rgba(239,68,68,0.1)" iconColor="#ef4444" onClick={e => { e.stopPropagation(); setShowConfirmDelete(true); }} danger />
            </>
          ) : (
            <>
              <Item icon={BookmarkPlus} label={`Save ${typeLabel}`} desc="Add to saved" iconBg="rgba(251,191,36,0.1)" iconColor="#fbbf24" onClick={e => { e.stopPropagation(); setShowSavePicker(true); }} />
              <Item icon={Copy} label="Copy Link" desc="Copy link" iconBg="rgba(99,102,241,0.1)" iconColor="#818cf8" onClick={handleCopyLink} />
              <Item icon={Share2} label="Share" desc="Share content" iconBg="rgba(14,165,233,0.1)" iconColor="#38bdf8" onClick={handleShare} />
              <div className="am-divider" />
              <Item icon={ThumbsUp} label="Interested" desc="See more like this" iconBg="rgba(132,204,22,0.1)" iconColor="#84cc16" onClick={e => { e.stopPropagation(); setShowInterested(true); }} />
              <Item icon={ThumbsDown} label="Not Interested" desc="See less like this" iconBg="rgba(115,115,115,0.1)" iconColor="#737373" onClick={e => { e.stopPropagation(); setShowInterested(false); }} muted />
              <div className="am-divider" />
              <Item icon={Flag} label={`Report ${typeLabel}`} desc="Report content" iconBg="rgba(251,146,60,0.1)" iconColor="#fb923c" onClick={e => { e.stopPropagation(); setShowReport(true); }} report />
            </>
          )}
          <div className="am-divider" />
          <Item icon={X} label="Cancel" iconBg="rgba(63,63,70,0.2)" iconColor="#525252" onClick={onClose} muted />
        </div>
      </div>

      <style>{`
        @keyframes toastIn { from{opacity:0;transform:translateX(-50%) translateY(10px)} to{opacity:1;transform:translateX(-50%) translateY(0)} }
        @keyframes confirmIn { from{opacity:0;transform:translate(-50%,-46%) scale(0.95)} to{opacity:1;transform:translate(-50%,-50%) scale(1)} }
        @keyframes amUp { from{transform:translateY(100%)} to{transform:translateY(0)} }
        @keyframes amIn { from{opacity:0;transform:scale(0.95) translateY(-4px)} to{opacity:1;transform:scale(1) translateY(0)} }

        .am-overlay {
          position:fixed;inset:0;background:rgba(0,0,0,0.5);
          backdrop-filter:blur(2px);z-index:9998;
        }
        .am-panel {
          position:fixed;z-index:9999;
          background:#0c0c0c;
          border:1px solid rgba(132,204,22,0.2);
          display:flex;flex-direction:column;overflow:hidden;
        }
        .am-panel--desktop {
          width:258px;max-height:calc(100vh - 40px);
          border-radius:15px;
          box-shadow:0 20px 60px rgba(0,0,0,0.85),0 0 0 1px rgba(255,255,255,0.03);
          animation:amIn 0.18s cubic-bezier(0.16,1,0.3,1);
        }
        .am-panel--mobile {
          bottom:0;left:0;right:0;width:100%;
          max-height:85vh;
          border-radius:18px 18px 0 0;border-bottom:none;
          box-shadow:0 -8px 50px rgba(0,0,0,0.7);
          animation:amUp 0.28s cubic-bezier(0.16,1,0.3,1);
          padding-bottom:env(safe-area-inset-bottom,0px);
        }
        .am-drag {
          width:36px;height:4px;background:rgba(255,255,255,0.15);
          border-radius:2px;margin:8px auto 0;flex-shrink:0;
        }
        .am-head {
          display:flex;align-items:center;gap:9px;
          padding:12px 14px 10px;
          border-bottom:1px solid rgba(255,255,255,0.055);flex-shrink:0;
        }
        .am-panel--mobile .am-head { padding-top:6px; }
        .am-head-dot { width:7px;height:7px;background:#84cc16;border-radius:50%;flex-shrink:0; }
        .am-head-title { flex:1;font-size:11px;font-weight:700;color:#84cc16;text-transform:uppercase;letter-spacing:.7px; }
        .am-x {
          width:26px;height:26px;background:rgba(255,255,255,0.05);
          border:1px solid rgba(255,255,255,0.09);border-radius:50%;
          display:flex;align-items:center;justify-content:center;
          color:#525252;cursor:pointer;flex-shrink:0;padding:0;
        }
        .am-x:hover { background:rgba(255,255,255,0.1);color:#d4d4d4; }
        .am-body { padding:7px;overflow-y:auto;flex:1;-webkit-overflow-scrolling:touch; }
        .am-item {
          width:100%;padding:9px 10px;
          background:transparent;border:1px solid transparent;border-radius:9px;
          display:flex;align-items:center;gap:10px;
          cursor:pointer;transition:all 0.14s;margin-bottom:2px;
          text-align:left;-webkit-tap-highlight-color:transparent;
        }
        .am-item:hover { background:var(--item-hover-bg,rgba(132,204,22,0.06));border-color:var(--item-hover-border,rgba(132,204,22,0.18)); }
        .am-item:active { transform:scale(0.98); }
        .am-icon-wrap {
          width:30px;height:30px;border-radius:8px;
          display:flex;align-items:center;justify-content:center;flex-shrink:0;
        }
        .am-label-wrap { flex:1;display:flex;flex-direction:column;gap:1px;min-width:0; }
        .am-label { font-size:13px;font-weight:600;line-height:1.2;white-space:nowrap;overflow:hidden;text-overflow:ellipsis; }
        .am-desc { font-size:10.5px;color:#444;line-height:1.2; }
        .am-divider { height:1px;background:rgba(255,255,255,0.055);margin:5px 3px; }
        @media(max-width:768px) {
          .am-item { padding:11px 10px; }
          .am-icon-wrap { width:33px;height:33px;border-radius:9px; }
          .am-label { font-size:14px; }
          .am-desc { font-size:11px;color:#525252; }
        }
        @media(max-width:360px) { .am-desc { display:none; } }
      `}</style>
    </>
  );

  return (
    <>
      {ReactDOM.createPortal(menuContent, document.body)}

      {showConfirmDelete && (
        <ConfirmDialog
          contentType={typeLabel}
          loading={deleting}
          onConfirm={handleDeleteConfirm}
          onCancel={() => setShowConfirmDelete(false)}
        />
      )}

      {showReport && (
        <ReportDialog
          contentType={typeLabel}
          onConfirm={handleReportSubmit}
          onCancel={() => setShowReport(false)}
        />
      )}

      {showInterested !== null && (
        <InterestedDialog
          interested={showInterested}
          onConfirm={handleInterestedConfirm}
          onCancel={() => setShowInterested(null)}
        />
      )}

      {showSavePicker && (
        <SaveFolderPicker
          contentType={contentType}
          contentId={content?.id}
          onClose={() => setShowSavePicker(false)}
          onSaved={(folder) => { if (onSave) onSave(folder); }}
        />
      )}

      {toast && <Toast message={toast.message} type={toast.type} onDone={() => setToast(null)} />}
    </>
  );
};

export default ActionMenu;