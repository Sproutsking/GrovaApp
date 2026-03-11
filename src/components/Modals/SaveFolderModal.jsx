// src/components/Modals/SaveFolderModal.jsx
// Schema: saved_content(id, user_id, content_type, content_id, folder, created_at)
import React, { useState, useEffect, useCallback } from "react";
import ReactDOM from "react-dom";
import { X, Bookmark, FolderPlus, Check, Trash2, Edit2 } from "lucide-react";
import { supabase } from "../../services/config/supabase";

const DEFAULT_FOLDERS = ["Favorites", "Inspiration", "Watch Later"];

function folderColor(name) {
  const colors = [
    "#84cc16", "#22d3ee", "#a78bfa", "#f97316",
    "#ec4899", "#14b8a6", "#f59e0b", "#6366f1",
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

const SaveFolderModal = ({ content, currentUser, onClose, onSaved }) => {
  // ── Seed with DEFAULT_FOLDERS so .map() never runs on undefined ──────────
  const [folders, setFolders]               = useState([...DEFAULT_FOLDERS]);
  const [savedIn, setSavedIn]               = useState(new Set());
  const [folderCounts, setFolderCounts]     = useState({});
  const [loading, setLoading]               = useState(true);
  const [newFolderMode, setNewFolderMode]   = useState(false);
  const [newFolderName, setNewFolderName]   = useState("");
  const [renamingFolder, setRenamingFolder] = useState(null);
  const [renameValue, setRenameValue]       = useState("");
  const [toast, setToast]                   = useState(null);
  const [saving, setSaving]                 = useState(null);

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 2500);
  };

  useEffect(() => {
    if (!currentUser?.id) {
      setLoading(false);
      return;
    }
    loadFolders();
  }, [currentUser?.id]);

  const loadFolders = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("saved_content")
        .select("folder, content_id, content_type")
        .eq("user_id", currentUser.id);

      if (error) throw error;

      const rows = Array.isArray(data) ? data : [];

      const userFolders = [...new Set(rows.map((r) => r.folder).filter(Boolean))];
      const allFolders  = [...new Set([...DEFAULT_FOLDERS, ...userFolders])];
      setFolders(allFolders);

      const alreadySavedIn = new Set(
        rows
          .filter((r) => r.content_id === content?.id && r.content_type === content?.type)
          .map((r) => r.folder)
      );
      setSavedIn(alreadySavedIn);

      const counts = {};
      for (const row of rows) {
        if (row.folder) counts[row.folder] = (counts[row.folder] || 0) + 1;
      }
      setFolderCounts(counts);
    } catch (err) {
      console.error("LoadFolders error:", err);
      // Fall back gracefully — keep the default folders already in state
      setFolders([...DEFAULT_FOLDERS]);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleFolder = useCallback(async (folderName) => {
    if (!currentUser?.id || saving === folderName) return;
    setSaving(folderName);

    const isSaved = savedIn.has(folderName);

    // Optimistic update
    setSavedIn((prev) => {
      const next = new Set(prev);
      isSaved ? next.delete(folderName) : next.add(folderName);
      return next;
    });
    setFolderCounts((prev) => ({
      ...prev,
      [folderName]: Math.max(0, (prev[folderName] || 0) + (isSaved ? -1 : 1)),
    }));

    try {
      if (isSaved) {
        const { error } = await supabase
          .from("saved_content")
          .delete()
          .eq("user_id", currentUser.id)
          .eq("content_type", content.type)
          .eq("content_id", content.id)
          .eq("folder", folderName);
        if (error) throw error;
        showToast(`Removed from ${folderName}`);
      } else {
        const { error } = await supabase
          .from("saved_content")
          .insert({
            user_id:      currentUser.id,
            content_type: content.type,
            content_id:   content.id,
            folder:       folderName,
          });
        if (error && !error.message?.includes("duplicate") && error.code !== "23505") {
          throw error;
        }
        showToast(`Saved to ${folderName}`);
        if (onSaved) onSaved(folderName);
      }
    } catch (err) {
      // Rollback optimistic update
      setSavedIn((prev) => {
        const next = new Set(prev);
        isSaved ? next.add(folderName) : next.delete(folderName);
        return next;
      });
      setFolderCounts((prev) => ({
        ...prev,
        [folderName]: Math.max(0, (prev[folderName] || 0) + (isSaved ? 1 : -1)),
      }));
      showToast("Failed to save. Try again.", "error");
      console.error("SaveFolder error:", err);
    } finally {
      setSaving(null);
    }
  }, [currentUser?.id, content, savedIn, saving, onSaved]);

  const handleCreateFolder = async () => {
    const name = newFolderName.trim();
    if (!name) return;
    if ((folders ?? []).includes(name)) { showToast("Folder already exists", "error"); return; }
    setFolders((prev) => [...(prev ?? []), name]);
    setNewFolderMode(false);
    setNewFolderName("");
    await handleToggleFolder(name);
  };

  const handleRename = async (oldName) => {
    const newName = renameValue.trim();
    if (!newName || newName === oldName) { setRenamingFolder(null); return; }
    if ((folders ?? []).includes(newName)) { showToast("That name already exists", "error"); return; }

    setFolders((prev) => (prev ?? []).map((f) => (f === oldName ? newName : f)));
    setSavedIn((prev) => {
      const next = new Set(prev);
      if (next.has(oldName)) { next.delete(oldName); next.add(newName); }
      return next;
    });
    setFolderCounts((prev) => {
      const next = { ...prev };
      if (oldName in next) { next[newName] = next[oldName]; delete next[oldName]; }
      return next;
    });
    setRenamingFolder(null);

    try {
      const { error } = await supabase
        .from("saved_content")
        .update({ folder: newName })
        .eq("user_id", currentUser.id)
        .eq("folder", oldName);
      if (error) throw error;
      showToast(`Renamed to "${newName}"`);
    } catch {
      setFolders((prev) => (prev ?? []).map((f) => (f === newName ? oldName : f)));
      showToast("Rename failed", "error");
    }
  };

  const handleDeleteFolder = async (folderName) => {
    if (DEFAULT_FOLDERS.includes(folderName)) {
      showToast("Can't delete default folders", "error");
      return;
    }
    setFolders((prev) => (prev ?? []).filter((f) => f !== folderName));
    setSavedIn((prev) => { const next = new Set(prev); next.delete(folderName); return next; });
    setFolderCounts((prev) => { const next = { ...prev }; delete next[folderName]; return next; });

    try {
      const { error } = await supabase
        .from("saved_content")
        .delete()
        .eq("user_id", currentUser.id)
        .eq("folder", folderName);
      if (error) throw error;
      showToast(`Deleted "${folderName}"`);
    } catch {
      showToast("Delete failed", "error");
      loadFolders();
    }
  };

  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) onClose();
  };

  // Guard against missing content prop entirely
  if (!content) return null;

  const contentLabel =
    content?.title || content?.caption || (content?.content || "").slice(0, 40) || "this content";

  return ReactDOM.createPortal(
    <div className="sfm-overlay" onClick={handleOverlayClick}>
      <div className="sfm-sheet">

        {/* Drag handle */}
        <div className="sfm-handle" />

        {/* Header */}
        <div className="sfm-header">
          <div className="sfm-header-left">
            <Bookmark size={17} color="#84cc16" fill="#84cc16" />
            <span className="sfm-title">Save to collection</span>
          </div>
          <button className="sfm-close" onClick={onClose} aria-label="Close">
            <X size={17} />
          </button>
        </div>

        {/* Content preview pill */}
        <div className="sfm-preview-pill">
          <span className="sfm-pill-type">
            {content?.type === "reel" ? "🎬" : content?.type === "story" ? "📖" : "🖼️"}
            {"\u00A0"}{content?.type || "post"}
          </span>
          <span className="sfm-pill-sep" />
          <span className="sfm-pill-name">{contentLabel}</span>
        </div>

        {/* Folder list */}
        <div className="sfm-folders">
          {loading ? (
            <div className="sfm-skeletons">
              {[1, 2, 3].map((i) => <div key={i} className="sfm-skeleton" />)}
            </div>
          ) : (
            (folders ?? []).map((folder) => {
              const isSaved    = savedIn.has(folder);
              const isRenaming = renamingFolder === folder;
              const isSaving   = saving === folder;
              const color      = folderColor(folder);
              const count      = folderCounts[folder] || 0;
              const isDefault  = DEFAULT_FOLDERS.includes(folder);

              return (
                <div
                  key={folder}
                  className={`sfm-row${isSaved ? " sfm-row-active" : ""}`}
                >
                  {isRenaming ? (
                    <div className="sfm-rename-row">
                      <input
                        className="sfm-rename-input"
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleRename(folder);
                          if (e.key === "Escape") setRenamingFolder(null);
                        }}
                        autoFocus
                        maxLength={40}
                      />
                      <button className="sfm-confirm-btn" onClick={() => handleRename(folder)}>
                        <Check size={14} />
                      </button>
                      <button className="sfm-cancel-btn" onClick={() => setRenamingFolder(null)}>
                        <X size={14} />
                      </button>
                    </div>
                  ) : (
                    <>
                      <button
                        className="sfm-row-main"
                        onClick={() => handleToggleFolder(folder)}
                        disabled={isSaving}
                      >
                        <div
                          className="sfm-folder-icon"
                          style={{ background: `${color}18`, border: `1.5px solid ${color}35` }}
                        >
                          {isSaving ? (
                            <span className="sfm-spin" style={{ borderTopColor: color }} />
                          ) : isSaved ? (
                            <Check size={15} color={color} strokeWidth={2.5} />
                          ) : (
                            <Bookmark size={14} color={color} />
                          )}
                        </div>

                        <div className="sfm-row-info">
                          <span className="sfm-folder-name">{folder}</span>
                          <span className="sfm-folder-count">
                            {count === 0 ? "Empty" : count === 1 ? "1 item" : `${count} items`}
                          </span>
                        </div>

                        {isSaved && !isSaving && (
                          <span
                            className="sfm-saved-badge"
                            style={{ color, background: `${color}15` }}
                          >
                            Saved
                          </span>
                        )}
                      </button>

                      {!isDefault && (
                        <div className="sfm-actions">
                          <button
                            className="sfm-icon-btn"
                            onClick={() => { setRenamingFolder(folder); setRenameValue(folder); }}
                            aria-label="Rename"
                          >
                            <Edit2 size={13} />
                          </button>
                          <button
                            className="sfm-icon-btn sfm-icon-btn-danger"
                            onClick={() => handleDeleteFolder(folder)}
                            aria-label="Delete"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* New collection */}
        {newFolderMode ? (
          <div className="sfm-new-row">
            <input
              className="sfm-new-input"
              placeholder="Collection name…"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleCreateFolder();
                if (e.key === "Escape") { setNewFolderMode(false); setNewFolderName(""); }
              }}
              autoFocus
              maxLength={40}
            />
            <button className="sfm-confirm-btn" onClick={handleCreateFolder}>
              <Check size={15} />
            </button>
            <button
              className="sfm-cancel-btn"
              onClick={() => { setNewFolderMode(false); setNewFolderName(""); }}
            >
              <X size={15} />
            </button>
          </div>
        ) : (
          <button className="sfm-add-btn" onClick={() => setNewFolderMode(true)}>
            <FolderPlus size={16} />
            New collection
          </button>
        )}

        {/* Toast */}
        {toast && (
          <div className={`sfm-toast sfm-toast-${toast.type}`}>{toast.msg}</div>
        )}
      </div>

      <style>{`
        .sfm-overlay {
          position: fixed; inset: 0; z-index: 99992;
          background: rgba(0,0,0,0.72);
          backdrop-filter: blur(4px); -webkit-backdrop-filter: blur(4px);
          display: flex; align-items: flex-end; justify-content: center;
          animation: sfmFadeIn 0.18s ease;
        }
        @keyframes sfmFadeIn { from { opacity: 0; } to { opacity: 1; } }

        .sfm-sheet {
          position: relative;
          width: 100%; max-width: 480px;
          background: #111113;
          border-radius: 24px 24px 0 0;
          border: 1px solid rgba(255,255,255,0.08); border-bottom: none;
          display: flex; flex-direction: column;
          overflow: hidden; max-height: 82vh;
          padding-bottom: env(safe-area-inset-bottom, 0px);
          animation: sfmSlideUp 0.3s cubic-bezier(0.32,0.72,0,1);
        }
        @keyframes sfmSlideUp {
          from { transform: translateY(100%); }
          to   { transform: translateY(0); }
        }
        @media (min-width: 520px) {
          .sfm-sheet { border-radius: 24px; margin-bottom: 24px; max-height: 78vh; }
        }

        .sfm-handle {
          width: 36px; height: 4px; border-radius: 2px;
          background: rgba(255,255,255,0.12);
          align-self: center; margin: 10px auto 0; flex-shrink: 0;
        }

        .sfm-header {
          display: flex; align-items: center; justify-content: space-between;
          padding: 14px 20px 10px; flex-shrink: 0;
        }
        .sfm-header-left { display: flex; align-items: center; gap: 8px; }
        .sfm-title { font-size: 16px; font-weight: 700; color: #f5f5f5; letter-spacing: -0.3px; }
        .sfm-close {
          width: 30px; height: 30px; border-radius: 50%;
          background: rgba(255,255,255,0.06); border: none;
          color: #a3a3a3; cursor: pointer;
          display: flex; align-items: center; justify-content: center;
          transition: background 0.15s;
        }
        .sfm-close:hover { background: rgba(255,255,255,0.12); color: #f5f5f5; }

        .sfm-preview-pill {
          display: flex; align-items: center; gap: 8px;
          margin: 0 20px 14px;
          padding: 8px 12px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.07);
          border-radius: 12px; flex-shrink: 0; min-width: 0;
        }
        .sfm-pill-type {
          font-size: 11px; font-weight: 700; text-transform: capitalize;
          letter-spacing: 0.03em; color: #84cc16; white-space: nowrap; flex-shrink: 0;
        }
        .sfm-pill-sep {
          width: 1px; height: 12px;
          background: rgba(255,255,255,0.1); flex-shrink: 0;
        }
        .sfm-pill-name {
          font-size: 12px; color: #737373;
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }

        .sfm-folders {
          flex: 1; overflow-y: auto; padding: 0 12px 8px;
          display: flex; flex-direction: column; gap: 3px;
          scrollbar-width: thin; scrollbar-color: rgba(255,255,255,0.08) transparent;
        }
        .sfm-folders::-webkit-scrollbar { width: 4px; }
        .sfm-folders::-webkit-scrollbar-track { background: transparent; }
        .sfm-folders::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.08); border-radius: 2px; }

        .sfm-skeletons { display: flex; flex-direction: column; gap: 5px; padding: 2px 0; }
        .sfm-skeleton {
          height: 58px; border-radius: 16px;
          background: linear-gradient(90deg,
            rgba(255,255,255,0.04) 25%,
            rgba(255,255,255,0.07) 50%,
            rgba(255,255,255,0.04) 75%
          );
          background-size: 200% 100%;
          animation: sfmSkel 1.4s infinite;
        }
        @keyframes sfmSkel {
          0%   { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }

        .sfm-row {
          display: flex; align-items: center;
          border-radius: 16px;
          background: rgba(255,255,255,0.04);
          transition: background 0.15s; overflow: hidden;
        }
        .sfm-row:hover { background: rgba(255,255,255,0.07); }
        .sfm-row-active { background: rgba(132,204,22,0.06); }
        .sfm-row-active:hover { background: rgba(132,204,22,0.09); }

        .sfm-row-main {
          flex: 1; display: flex; align-items: center; gap: 12px;
          padding: 11px 12px; background: none; border: none;
          cursor: pointer; text-align: left; min-width: 0;
        }
        .sfm-row-main:disabled { opacity: 0.65; cursor: default; }

        .sfm-folder-icon {
          width: 36px; height: 36px; border-radius: 11px; flex-shrink: 0;
          display: flex; align-items: center; justify-content: center;
        }
        .sfm-spin {
          width: 14px; height: 14px; border-radius: 50%;
          border: 2px solid rgba(255,255,255,0.15);
          display: inline-block;
          animation: sfmSpin 0.65s linear infinite;
        }
        @keyframes sfmSpin { to { transform: rotate(360deg); } }

        .sfm-row-info {
          flex: 1; display: flex; flex-direction: column; gap: 2px; min-width: 0;
        }
        .sfm-folder-name {
          font-size: 14px; font-weight: 600; color: #e5e5e5;
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }
        .sfm-folder-count { font-size: 11px; color: #525252; font-weight: 500; }

        .sfm-saved-badge {
          font-size: 11px; font-weight: 700;
          padding: 3px 9px; border-radius: 7px; flex-shrink: 0;
        }

        .sfm-actions { display: flex; gap: 2px; padding-right: 8px; flex-shrink: 0; }
        .sfm-icon-btn {
          width: 28px; height: 28px; border-radius: 8px; border: none;
          background: transparent; color: #525252; cursor: pointer;
          display: flex; align-items: center; justify-content: center;
          transition: background 0.15s, color 0.15s;
        }
        .sfm-icon-btn:hover { background: rgba(255,255,255,0.08); color: #a3a3a3; }
        .sfm-icon-btn-danger:hover { background: rgba(239,68,68,0.1); color: #f87171; }

        .sfm-rename-row {
          flex: 1; display: flex; align-items: center; gap: 6px; padding: 8px 12px;
        }
        .sfm-rename-input, .sfm-new-input {
          flex: 1; background: rgba(255,255,255,0.07);
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 10px; color: #f5f5f5;
          font-size: 14px; font-weight: 600;
          padding: 8px 12px; outline: none; transition: border-color 0.15s;
        }
        .sfm-rename-input:focus, .sfm-new-input:focus { border-color: rgba(132,204,22,0.4); }

        .sfm-confirm-btn {
          width: 32px; height: 32px; border-radius: 9px; border: none; cursor: pointer;
          display: flex; align-items: center; justify-content: center;
          background: rgba(132,204,22,0.15); color: #84cc16; transition: background 0.15s;
        }
        .sfm-confirm-btn:hover { background: rgba(132,204,22,0.25); }
        .sfm-cancel-btn {
          width: 32px; height: 32px; border-radius: 9px; border: none; cursor: pointer;
          display: flex; align-items: center; justify-content: center;
          background: rgba(255,255,255,0.06); color: #737373; transition: background 0.15s;
        }
        .sfm-cancel-btn:hover { background: rgba(255,255,255,0.1); }

        .sfm-new-row {
          display: flex; align-items: center; gap: 6px;
          padding: 8px 12px 16px; flex-shrink: 0;
        }
        .sfm-add-btn {
          display: flex; align-items: center; gap: 8px;
          margin: 6px 12px 16px; padding: 13px 16px; border-radius: 16px;
          background: rgba(255,255,255,0.03);
          border: 1.5px dashed rgba(255,255,255,0.1);
          color: #525252; font-size: 14px; font-weight: 600;
          cursor: pointer; width: calc(100% - 24px); flex-shrink: 0;
          transition: background 0.15s, color 0.15s, border-color 0.15s;
        }
        .sfm-add-btn:hover {
          background: rgba(132,204,22,0.05); color: #84cc16;
          border-color: rgba(132,204,22,0.28);
        }

        .sfm-toast {
          position: absolute; bottom: 76px; left: 50%; transform: translateX(-50%);
          padding: 8px 16px; border-radius: 10px;
          font-size: 13px; font-weight: 600; white-space: nowrap;
          pointer-events: none; z-index: 1;
          animation: sfmToast 0.22s cubic-bezier(0.34,1.56,0.64,1);
        }
        .sfm-toast-success { background: #18181b; color: #84cc16; border: 1px solid rgba(132,204,22,0.2); }
        .sfm-toast-error   { background: #18181b; color: #f87171; border: 1px solid rgba(239,68,68,0.22); }
        @keyframes sfmToast {
          from { opacity: 0; transform: translateX(-50%) translateY(6px); }
          to   { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
      `}</style>
    </div>,
    document.body
  );
};

export default SaveFolderModal;