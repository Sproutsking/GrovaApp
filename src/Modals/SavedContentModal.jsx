// ============================================================================
// src/components/Modals/SavedContentModal.jsx — COMPLETE REWRITE v2
// Real DB integration + content previews + fullscreen viewing
// ============================================================================

import React, { useState, useEffect, useCallback } from "react";
import ReactDOM from "react-dom";
import { X, Bookmark, Trash2, FolderPlus, Film, Image, BookOpen, ChevronRight, ChevronLeft, Loader } from "lucide-react";
import { supabase } from "../../services/config/supabase";
import mediaUrlService from "../../services/shared/mediaUrlService";
import FullScreenPost from "../Home/FullScreenPost";
import FullScreenReels from "../Home/FullScreenReels";

const SavedContentModal = ({ currentUser, onClose, isMobile = false }) => {
  const [savedItems, setSavedItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeFolder, setActiveFolder] = useState("all");
  const [folders, setFolders] = useState([]);
  const [selectedItem, setSelectedItem] = useState(null);
  const [fullscreenType, setFullscreenType] = useState(null); // 'post', 'reel', 'story'

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  // ── Load saved content from DB ──────────────────────────────────────────
  useEffect(() => {
    if (!currentUser?.id) return;

    const loadSavedContent = async () => {
      try {
        setLoading(true);

        // Get all saved_content records for this user
        const { data: savedRecs, error: saveError } = await supabase
          .from("saved_content")
          .select("*")
          .eq("user_id", currentUser.id)
          .order("created_at", { ascending: false });

        if (saveError) throw saveError;

        // Extract unique folders
        const uniqueFolders = [...new Set((savedRecs || []).map(s => s.folder || "Favorites"))];
        setFolders(uniqueFolders.length > 0 ? uniqueFolders : ["Favorites"]);

        // Fetch full content data for each saved item
        if (savedRecs && savedRecs.length > 0) {
          const enriched = await Promise.all(
            savedRecs.map(async (saved) => {
              try {
                let contentData = null;

                if (saved.content_type === "post") {
                  const { data } = await supabase
                    .from("posts")
                    .select("*, profiles(*)")
                    .eq("id", saved.content_id)
                    .single();
                  contentData = data;
                } else if (saved.content_type === "reel") {
                  const { data } = await supabase
                    .from("reels")
                    .select("*, profiles(*)")
                    .eq("id", saved.content_id)
                    .single();
                  contentData = data;
                } else if (saved.content_type === "story") {
                  const { data } = await supabase
                    .from("stories")
                    .select("*, profiles(*)")
                    .eq("id", saved.content_id)
                    .single();
                  contentData = data;
                }

                return {
                  ...saved,
                  _content: contentData,
                };
              } catch (err) {
                console.error(`Failed to fetch ${saved.content_type}:`, err);
                return saved;
              }
            })
          );

          setSavedItems(enriched);
        } else {
          setSavedItems([]);
        }
      } catch (err) {
        console.error("Failed to load saved content:", err);
        setSavedItems([]);
      } finally {
        setLoading(false);
      }
    };

    loadSavedContent();
  }, [currentUser?.id]);

  // ── Remove from saved ──────────────────────────────────────────────────
  const removeFromSaved = async (savedId) => {
    try {
      const { error } = await supabase
        .from("saved_content")
        .delete()
        .eq("id", savedId);

      if (error) throw error;

      setSavedItems(prev => prev.filter(item => item.id !== savedId));
    } catch (err) {
      console.error("Failed to remove:", err);
    }
  };

  // ── Filter items by folder ─────────────────────────────────────────────
  const filteredItems = activeFolder === "all"
    ? savedItems
    : savedItems.filter(item => (item.folder || "Favorites") === activeFolder);

  // ── Get thumbnail URL ─────────────────────────────────────────────────
  const getThumbnail = (item) => {
    const content = item._content;
    if (!content) return null;

    if (item.content_type === "post" && content.primary_media_id) {
      return mediaUrlService.getImageUrl(content.primary_media_id, { width: 160, quality: "auto:good" });
    }
    if (item.content_type === "reel" && content.video_thumbnail_id) {
      return mediaUrlService.getImageUrl(content.video_thumbnail_id, { width: 160, quality: "auto:good" });
    }
    if (item.content_type === "story" && content.cover_image_id) {
      return mediaUrlService.getStoryImageUrl(content.cover_image_id, 160);
    }

    return null;
  };

  // ── Handle item click ──────────────────────────────────────────────────
  const handleItemClick = (item) => {
    setSelectedItem(item._content || item);
    setFullscreenType(item.content_type);
  };

  // ── Render content grid ────────────────────────────────────────────────
  const renderGrid = () => {
    if (loading) {
      return (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "60px 20px", color: "#a3a3a3" }}>
          <Loader size={32} style={{ animation: "spin 1s linear infinite" }} />
        </div>
      );
    }

    if (filteredItems.length === 0) {
      return (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "60px 20px", textAlign: "center", color: "#6b7280" }}>
          <Bookmark size={48} style={{ opacity: 0.3, marginBottom: 16 }} />
          <p style={{ fontSize: 16, fontWeight: 600 }}>No saved content yet</p>
          <span style={{ fontSize: 13, opacity: 0.6 }}>Save posts, reels, and stories to view them here</span>
        </div>
      );
    }

    return (
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))",
        gap: "12px",
        padding: "16px",
      }}>
        {filteredItems.map((item) => {
          const thumb = getThumbnail(item);
          const icon = item.content_type === "reel" ? <Film size={18} /> : item.content_type === "story" ? <BookOpen size={18} /> : <Image size={18} />;
          const color = item.content_type === "reel" ? "#818cf8" : item.content_type === "story" ? "#fbbf24" : "#84cc16";

          return (
            <div
              key={item.id}
              onClick={() => handleItemClick(item)}
              style={{
                position: "relative",
                aspectRatio: "1",
                borderRadius: "12px",
                overflow: "hidden",
                cursor: "pointer",
                background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.08)",
                transition: "all 0.2s ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = "rgba(132,204,22,0.4)";
                e.currentTarget.style.transform = "scale(1.02)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)";
                e.currentTarget.style.transform = "scale(1)";
              }}
            >
              {thumb ? (
                <img src={thumb} alt={item.content_type} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              ) : (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: "100%", height: "100%", color }}>
                  {icon}
                </div>
              )}

              <div style={{
                position: "absolute",
                inset: 0,
                background: "linear-gradient(135deg, rgba(0,0,0,0) 0%, rgba(0,0,0,0.4) 100%)",
              }} />

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  removeFromSaved(item.id);
                }}
                style={{
                  position: "absolute",
                  top: "6px",
                  right: "6px",
                  width: 28,
                  height: 28,
                  background: "rgba(0,0,0,0.6)",
                  border: "1px solid rgba(255,255,255,0.2)",
                  borderRadius: "6px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#f5f5f5",
                  cursor: "pointer",
                  opacity: 0,
                  transition: "opacity 0.2s",
                }}
                onMouseEnter={(e) => { e.currentTarget.style.opacity = "1"; }}
                onMouseLeave={(e) => { e.currentTarget.style.opacity = "0"; }}
              >
                <Trash2 size={14} />
              </button>
            </div>
          );
        })}
      </div>
    );
  };

  // ── Fullscreen view ────────────────────────────────────────────────────
  if (fullscreenType === "post" && selectedItem) {
    return ReactDOM.createPortal(
      <FullScreenPost
        post={selectedItem}
        currentUser={currentUser}
        onClose={() => {
          setSelectedItem(null);
          setFullscreenType(null);
        }}
      />,
      document.body
    );
  }

  if (fullscreenType === "reel" && selectedItem) {
    return ReactDOM.createPortal(
      <FullScreenReels
        reels={[selectedItem]}
        currentIndex={0}
        currentUser={currentUser}
        onClose={() => {
          setSelectedItem(null);
          setFullscreenType(null);
        }}
      />,
      document.body
    );
  }

  return ReactDOM.createPortal(
    <>
      <div onClick={onClose} style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.92)",
        backdropFilter: "blur(12px)", zIndex: 9000,
      }} />

      <div onClick={(e) => e.stopPropagation()} style={{
        position: "fixed",
        ...(isMobile
          ? { bottom: 0, left: 0, right: 0, width: "100%", height: "95vh", borderRadius: "20px 20px 0 0" }
          : { top: "50%", left: "50%", transform: "translate(-50%,-50%)", width: "min(900px, calc(100vw - 40px))", maxHeight: "86vh", borderRadius: "20px" }),
        background: "#0a0a0a",
        border: "1px solid rgba(132,204,22,0.2)",
        zIndex: 9500,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        boxShadow: "0 32px 100px rgba(0,0,0,0.9)",
      }}>
        {/* HEADER */}
        <div style={{
          padding: "18px 20px 14px",
          borderBottom: "1px solid rgba(255,255,255,0.07)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexShrink: 0,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            {activeFolder !== "all" && (
              <button onClick={() => setActiveFolder("all")} style={{
                width: 32, height: 32, background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.1)", borderRadius: "50%",
                display: "flex", alignItems: "center", justifyContent: "center",
                color: "#a3a3a3", cursor: "pointer", transition: "all 0.2s",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.1)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.05)"; }}
              >
                <ChevronLeft size={16} />
              </button>
            )}
            <div style={{ width: 38, height: 38, background: "rgba(132,204,22,0.12)", border: "1px solid rgba(132,204,22,0.25)", borderRadius: "10px", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Bookmark size={18} color="#84cc16" />
            </div>
            <div>
              <div style={{ color: "#f5f5f5", fontSize: "16px", fontWeight: 700 }}>
                {activeFolder === "all" ? "Saved Content" : activeFolder}
              </div>
              <div style={{ color: "#525252", fontSize: "11px" }}>
                {filteredItems.length} item{filteredItems.length !== 1 ? "s" : ""}
              </div>
            </div>
          </div>
          <button onClick={onClose} style={{
            width: 32, height: 32, background: "rgba(255,255,255,0.05)",
            border: "1px solid rgba(255,255,255,0.1)", borderRadius: "50%",
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "#a3a3a3", cursor: "pointer", transition: "all 0.2s",
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.1)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.05)"; }}
          >
            <X size={16} />
          </button>
        </div>

        {/* FOLDERS TAB */}
        {folders.length > 1 && (
          <div style={{
            padding: "0 16px",
            borderBottom: "1px solid rgba(255,255,255,0.07)",
            display: "flex",
            gap: "8px",
            overflow: "auto",
            scrollBehavior: "smooth",
            flexShrink: 0,
          }}>
            <button
              onClick={() => setActiveFolder("all")}
              style={{
                padding: "10px 14px",
                background: activeFolder === "all" ? "rgba(132,204,22,0.15)" : "transparent",
                border: activeFolder === "all" ? "1px solid rgba(132,204,22,0.4)" : "1px solid transparent",
                color: activeFolder === "all" ? "#84cc16" : "#a3a3a3",
                borderRadius: "8px",
                cursor: "pointer",
                fontSize: "12px",
                fontWeight: 600,
                whiteSpace: "nowrap",
                transition: "all 0.2s",
              }}
            >
              All
            </button>
            {folders.map(folder => (
              <button
                key={folder}
                onClick={() => setActiveFolder(folder)}
                style={{
                  padding: "10px 14px",
                  background: activeFolder === folder ? "rgba(132,204,22,0.15)" : "transparent",
                  border: activeFolder === folder ? "1px solid rgba(132,204,22,0.4)" : "1px solid transparent",
                  color: activeFolder === folder ? "#84cc16" : "#a3a3a3",
                  borderRadius: "8px",
                  cursor: "pointer",
                  fontSize: "12px",
                  fontWeight: 600,
                  whiteSpace: "nowrap",
                  transition: "all 0.2s",
                }}
              >
                {folder}
              </button>
            ))}
          </div>
        )}

        {/* CONTENT GRID */}
        <div style={{ flex: 1, overflow: "auto", WebkitOverflowScrolling: "touch" }}>
          {renderGrid()}
        </div>

        {/* Animations */}
        <style>{`
          @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    </>,
    document.body
  );
};

export default SavedContentModal;

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