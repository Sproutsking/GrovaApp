// ============================================================================
// src/components/Modals/SavedContentModal.jsx — FULL REWRITE
// No toast dependency. Folder management. Grouped "All" view.
// ============================================================================

import React, { useState, useEffect, useCallback } from "react";
import ReactDOM from "react-dom";
import { X, Bookmark, Trash2, FolderPlus, Film, Image, BookOpen, ChevronRight, ChevronLeft, FolderOpen, Plus } from "lucide-react";

const STORAGE_KEY = "save_folders";
const ITEMS_KEY = "saved_content_items";

const getFolders = () => {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '["Favorites"]'); } catch { return ["Favorites"]; }
};

const getItems = () => {
  try { return JSON.parse(localStorage.getItem(ITEMS_KEY) || "[]"); } catch { return []; }
};

const setFoldersStore = (f) => localStorage.setItem(STORAGE_KEY, JSON.stringify(f));
const setItemsStore = (i) => localStorage.setItem(ITEMS_KEY, JSON.stringify(i));

const typeIcon = (type) => {
  if (type === "reel") return <Film size={14} />;
  if (type === "story") return <BookOpen size={14} />;
  return <Image size={14} />;
};

const typeColor = (type) => {
  if (type === "reel") return { bg: "rgba(99,102,241,0.12)", color: "#818cf8" };
  if (type === "story") return { bg: "rgba(251,191,36,0.12)", color: "#fbbf24" };
  return { bg: "rgba(132,204,22,0.12)", color: "#84cc16" };
};

const SavedContentModal = ({ currentUser, onClose, isMobile = false }) => {
  const [folders, setFolders] = useState(getFolders);
  const [items, setItems] = useState(getItems);
  const [activeFolder, setActiveFolder] = useState("all"); // "all" or folder name
  const [flash, setFlash] = useState(null);
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(null); // item to delete

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  const showFlash = (msg, type = "success") => {
    setFlash({ msg, type });
    setTimeout(() => setFlash(null), 2500);
  };

  const removeItem = (itemId) => {
    const next = items.filter(i => i.id !== itemId);
    setItems(next);
    setItemsStore(next);
    setConfirmDelete(null);
    showFlash("Removed from saved");
  };

  const createFolder = () => {
    const name = newFolderName.trim();
    if (!name) return;
    if (folders.length >= 10) { showFlash("Max 10 folders", "error"); return; }
    if (folders.includes(name)) { showFlash("Folder already exists", "error"); return; }
    const next = [...folders, name];
    setFolders(next);
    setFoldersStore(next);
    setNewFolderName("");
    setCreatingFolder(false);
    showFlash(`"${name}" created!`);
  };

  const deleteFolder = (folderName) => {
    if (folderName === "Favorites") { showFlash("Cannot delete Favorites", "error"); return; }
    // Move items to Favorites
    const movedItems = items.map(i => i.folder === folderName ? { ...i, folder: "Favorites" } : i);
    setItems(movedItems);
    setItemsStore(movedItems);
    const nextFolders = folders.filter(f => f !== folderName);
    setFolders(nextFolders);
    setFoldersStore(nextFolders);
    if (activeFolder === folderName) setActiveFolder("all");
    showFlash(`"${folderName}" deleted, items moved to Favorites`);
  };

  // Group items by folder for "all" view
  const groupedByFolder = () => {
    const map = {};
    folders.forEach(f => { map[f] = []; });
    items.forEach(item => {
      if (!map[item.folder]) map[item.folder] = [];
      map[item.folder].push(item);
    });
    return map;
  };

  const folderItems = activeFolder === "all" ? [] : items.filter(i => i.folder === activeFolder);
  const grouped = activeFolder === "all" ? groupedByFolder() : null;

  const formatDate = (ts) => new Date(ts).toLocaleDateString("en-US", { month: "short", day: "numeric" });

  return ReactDOM.createPortal(
    <>
      <div onClick={onClose} style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.92)",
        backdropFilter: "blur(12px)", zIndex: 9998,
      }} />

      <div onClick={e => e.stopPropagation()} style={{
        position: "fixed",
        ...(isMobile
          ? { bottom: 0, left: 0, right: 0, width: "100%", height: "95vh", borderRadius: "20px 20px 0 0", animation: "slideUp 0.3s ease" }
          : { top: "50%", left: "50%", transform: "translate(-50%,-50%)", width: "min(680px, calc(100vw - 40px))", maxHeight: "86vh", borderRadius: "20px", animation: "fadeScale 0.25s ease" }),
        background: "#0a0a0a", border: "1px solid rgba(132,204,22,0.2)",
        zIndex: 9999, display: "flex", flexDirection: "column", overflow: "hidden",
        boxShadow: "0 32px 100px rgba(0,0,0,0.9)",
      }}>
        {/* HEADER */}
        <div style={{
          padding: "18px 20px 14px", borderBottom: "1px solid rgba(255,255,255,0.07)",
          display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            {activeFolder !== "all" && (
              <button onClick={() => setActiveFolder("all")} style={{
                width: 32, height: 32, background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.1)", borderRadius: "50%",
                display: "flex", alignItems: "center", justifyContent: "center",
                color: "#a3a3a3", cursor: "pointer",
              }}><ChevronLeft size={16} /></button>
            )}
            <div style={{ width: 38, height: 38, background: "rgba(132,204,22,0.12)", border: "1px solid rgba(132,204,22,0.25)", borderRadius: "10px", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Bookmark size={18} color="#84cc16" />
            </div>
            <div>
              <div style={{ color: "#f5f5f5", fontSize: "16px", fontWeight: 700 }}>
                {activeFolder === "all" ? "Saved Content" : activeFolder}
              </div>
              <div style={{ color: "#525252", fontSize: "11px" }}>
                {activeFolder === "all"
                  ? `${items.length} item${items.length !== 1 ? "s" : ""} · ${folders.length} folder${folders.length !== 1 ? "s" : ""}`
                  : `${folderItems.length} item${folderItems.length !== 1 ? "s" : ""}`}
              </div>
            </div>
          </div>
          <button onClick={onClose} style={{
            width: 32, height: 32, background: "rgba(255,255,255,0.05)",
            border: "1px solid rgba(255,255,255,0.1)", borderRadius: "50%",
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "#737373", cursor: "pointer",
          }}><X size={16} /></button>
        </div>

        {/* FLASH */}
        {flash && (
          <div style={{
            margin: "10px 16px 0", padding: "9px 14px", borderRadius: "10px", flexShrink: 0,
            background: flash.type === "error" ? "rgba(239,68,68,0.1)" : "rgba(132,204,22,0.1)",
            border: `1px solid ${flash.type === "error" ? "rgba(239,68,68,0.3)" : "rgba(132,204,22,0.25)"}`,
            color: flash.type === "error" ? "#ef4444" : "#84cc16",
            fontSize: "12px", fontWeight: 600, textAlign: "center",
          }}>{flash.msg}</div>
        )}

        {/* MAIN CONTENT */}
        <div style={{ flex: 1, overflowY: "auto", padding: "14px 16px" }}>

          {/* ── ALL VIEW: folders + their items ── */}
          {activeFolder === "all" && (
            <>
              {/* Folder tabs row */}
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 18 }}>
                {folders.map(folder => {
                  const count = items.filter(i => i.folder === folder).length;
                  return (
                    <button key={folder} onClick={() => setActiveFolder(folder)} style={{
                      padding: "7px 14px", borderRadius: "999px",
                      background: "rgba(132,204,22,0.07)",
                      border: "1px solid rgba(132,204,22,0.2)",
                      color: "#84cc16", fontSize: "12px", fontWeight: 600, cursor: "pointer",
                      display: "flex", alignItems: "center", gap: 6,
                      transition: "all 0.15s",
                    }}>
                      <FolderOpen size={13} />
                      {folder}
                      <span style={{ opacity: 0.6 }}>({count})</span>
                    </button>
                  );
                })}
              </div>

              {/* Groups */}
              {folders.map(folder => {
                const folderData = grouped[folder] || [];
                if (folderData.length === 0) return null;
                return (
                  <div key={folder} style={{ marginBottom: 24 }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <FolderOpen size={14} color="#84cc16" />
                        <span style={{ color: "#a3a3a3", fontSize: "12px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.6px" }}>{folder}</span>
                        <span style={{ color: "#525252", fontSize: "11px" }}>({folderData.length})</span>
                      </div>
                      <div style={{ display: "flex", gap: 6 }}>
                        <button onClick={() => setActiveFolder(folder)} style={{
                          padding: "4px 10px", background: "rgba(132,204,22,0.07)",
                          border: "1px solid rgba(132,204,22,0.2)", borderRadius: "6px",
                          color: "#84cc16", fontSize: "11px", fontWeight: 600, cursor: "pointer",
                          display: "flex", alignItems: "center", gap: 4,
                        }}>
                          Open <ChevronRight size={11} />
                        </button>
                        {folder !== "Favorites" && (
                          <button onClick={() => deleteFolder(folder)} style={{
                            padding: "4px 10px", background: "rgba(239,68,68,0.07)",
                            border: "1px solid rgba(239,68,68,0.2)", borderRadius: "6px",
                            color: "#ef4444", fontSize: "11px", fontWeight: 600, cursor: "pointer",
                          }}>Delete</button>
                        )}
                      </div>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                      {folderData.slice(0, 4).map(item => {
                        const { bg, color } = typeColor(item.content_type);
                        return (
                          <div key={item.id} style={{
                            padding: "12px", background: "rgba(255,255,255,0.03)",
                            border: "1px solid rgba(255,255,255,0.07)", borderRadius: "11px",
                            display: "flex", alignItems: "center", gap: 10,
                          }}>
                            <div style={{ width: 32, height: 32, background: bg, borderRadius: "8px", display: "flex", alignItems: "center", justifyContent: "center", color, flexShrink: 0 }}>
                              {typeIcon(item.content_type)}
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ color: "#d4d4d4", fontSize: "12px", fontWeight: 600, textTransform: "capitalize" }}>{item.content_type}</div>
                              <div style={{ color: "#525252", fontSize: "10px" }}>{formatDate(item.created_at)}</div>
                            </div>
                            <button onClick={() => setConfirmDelete(item)} style={{ background: "none", border: "none", color: "#3f3f3f", cursor: "pointer", padding: 4 }}>
                              <Trash2 size={13} />
                            </button>
                          </div>
                        );
                      })}
                      {folderData.length > 4 && (
                        <button onClick={() => setActiveFolder(folder)} style={{
                          padding: "12px", background: "rgba(132,204,22,0.05)",
                          border: "1px dashed rgba(132,204,22,0.2)", borderRadius: "11px",
                          color: "#84cc16", fontSize: "12px", fontWeight: 600, cursor: "pointer",
                        }}>+{folderData.length - 4} more</button>
                      )}
                    </div>
                  </div>
                );
              })}

              {items.length === 0 && (
                <div style={{ textAlign: "center", padding: "60px 20px", color: "#525252" }}>
                  <Bookmark size={48} style={{ marginBottom: 16, opacity: 0.3 }} />
                  <p style={{ fontWeight: 600, marginBottom: 6 }}>Nothing saved yet</p>
                  <p style={{ fontSize: "13px" }}>Content you save will appear here</p>
                </div>
              )}
            </>
          )}

          {/* ── FOLDER VIEW ── */}
          {activeFolder !== "all" && (
            <>
              {folderItems.length === 0 ? (
                <div style={{ textAlign: "center", padding: "60px 20px", color: "#525252" }}>
                  <FolderOpen size={48} style={{ marginBottom: 16, opacity: 0.3 }} />
                  <p style={{ fontWeight: 600, marginBottom: 6 }}>This folder is empty</p>
                  <p style={{ fontSize: "13px" }}>Save content to "{activeFolder}"</p>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {folderItems.map(item => {
                    const { bg, color } = typeColor(item.content_type);
                    return (
                      <div key={item.id} style={{
                        padding: "14px 16px", background: "rgba(255,255,255,0.03)",
                        border: "1px solid rgba(255,255,255,0.07)", borderRadius: "12px",
                        display: "flex", alignItems: "center", gap: 14,
                        transition: "all 0.15s",
                      }}>
                        <div style={{ width: 40, height: 40, background: bg, borderRadius: "10px", display: "flex", alignItems: "center", justifyContent: "center", color, flexShrink: 0 }}>
                          {typeIcon(item.content_type)}
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ color: "#d4d4d4", fontSize: "14px", fontWeight: 600, textTransform: "capitalize" }}>{item.content_type}</div>
                          <div style={{ color: "#525252", fontSize: "12px", marginTop: 2 }}>{formatDate(item.created_at)}</div>
                        </div>
                        <button onClick={() => setConfirmDelete(item)} style={{
                          width: 34, height: 34, background: "rgba(239,68,68,0.07)",
                          border: "1px solid rgba(239,68,68,0.2)", borderRadius: "8px",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          color: "#ef4444", cursor: "pointer",
                        }}><Trash2 size={15} /></button>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>

        {/* FOOTER: Create folder */}
        {activeFolder === "all" && (
          <div style={{ padding: "12px 16px 16px", borderTop: "1px solid rgba(255,255,255,0.07)", flexShrink: 0 }}>
            {!creatingFolder ? (
              <button onClick={() => setCreatingFolder(true)} disabled={folders.length >= 10} style={{
                width: "100%", padding: "11px", background: "transparent",
                border: "1px dashed rgba(132,204,22,0.3)", borderRadius: "11px",
                color: folders.length >= 10 ? "#525252" : "#84cc16",
                fontSize: "13px", fontWeight: 600,
                cursor: folders.length >= 10 ? "not-allowed" : "pointer",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              }}>
                <FolderPlus size={15} />
                {folders.length >= 10 ? "Max 10 folders reached" : "Create new folder"}
              </button>
            ) : (
              <div style={{ display: "flex", gap: 8 }}>
                <input
                  autoFocus value={newFolderName}
                  onChange={e => setNewFolderName(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") createFolder(); if (e.key === "Escape") setCreatingFolder(false); }}
                  placeholder="Folder name…" maxLength={30}
                  style={{
                    flex: 1, padding: "10px 12px", background: "rgba(255,255,255,0.05)",
                    border: "1px solid rgba(132,204,22,0.35)", borderRadius: "10px",
                    color: "#f5f5f5", fontSize: "13px", outline: "none", fontFamily: "inherit",
                  }}
                />
                <button onClick={createFolder} style={{
                  padding: "10px 16px", background: "rgba(132,204,22,0.12)",
                  border: "1px solid rgba(132,204,22,0.4)", borderRadius: "10px",
                  color: "#84cc16", fontWeight: 700, cursor: "pointer", fontSize: "13px",
                }}>Create</button>
                <button onClick={() => setCreatingFolder(false)} style={{
                  padding: "10px 12px", background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.1)", borderRadius: "10px",
                  color: "#737373", cursor: "pointer",
                }}><X size={14} /></button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* CONFIRM REMOVE DIALOG */}
      {confirmDelete && (
        <>
          <div onClick={() => setConfirmDelete(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 100000, backdropFilter: "blur(4px)" }} />
          <div style={{
            position: "fixed", top: "50%", left: "50%", transform: "translate(-50%,-50%)",
            background: "#111", border: "1px solid rgba(239,68,68,0.3)", borderRadius: "16px",
            padding: "24px", width: "min(300px, calc(100vw - 40px))", zIndex: 100001,
            boxShadow: "0 24px 80px rgba(0,0,0,0.9)",
          }}>
            <p style={{ color: "#f5f5f5", fontWeight: 700, textAlign: "center", marginBottom: 6 }}>Remove item?</p>
            <p style={{ color: "#737373", fontSize: "13px", textAlign: "center", marginBottom: 20 }}>
              This will remove it from your saved content.
            </p>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setConfirmDelete(null)} style={{
                flex: 1, padding: "10px", background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.1)", borderRadius: "10px",
                color: "#a3a3a3", fontWeight: 600, cursor: "pointer", fontSize: "14px",
              }}>Cancel</button>
              <button onClick={() => removeItem(confirmDelete.id)} style={{
                flex: 1, padding: "10px", background: "rgba(239,68,68,0.1)",
                border: "1px solid rgba(239,68,68,0.35)", borderRadius: "10px",
                color: "#ef4444", fontWeight: 700, cursor: "pointer", fontSize: "14px",
              }}>Remove</button>
            </div>
          </div>
        </>
      )}

      <style>{`
        @keyframes slideUp { from{transform:translateY(100%)} to{transform:translateY(0)} }
        @keyframes fadeScale { from{opacity:0;transform:translate(-50%,-48%) scale(0.96)} to{opacity:1;transform:translate(-50%,-50%) scale(1)} }
      `}</style>
    </>,
    document.body
  );
};

export default SavedContentModal;