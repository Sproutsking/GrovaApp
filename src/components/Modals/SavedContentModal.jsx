// ============================================================================
// src/components/Modals/SavedContentModal.jsx — canonical supabase-backed modal
// Shows user's saved posts/reels/stories and opens fullscreen viewers via portals
// ============================================================================

import React, { useState, useEffect } from "react";
import ReactDOM from "react-dom";
import { X, Bookmark, Trash2, Film, Image, BookOpen, ChevronLeft, Loader } from "lucide-react";
import { supabase } from "../../services/config/supabase";
import mediaUrlService from "../../services/shared/mediaUrlService";
import FullScreenPost from "../Home/FullScreenPost";
import FullScreenReels from "../Home/FullScreenReels";
import FullContentView from "../Home/FullContentView";

const SavedContentModal = ({ currentUser, onClose, isMobile = false }) => {
  const [savedItems, setSavedItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeFolder, setActiveFolder] = useState("all");
  const [folders, setFolders] = useState(["Favorites"]);
  const [selectedItem, setSelectedItem] = useState(null);
  const [fullscreenType, setFullscreenType] = useState(null);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  useEffect(() => {
    if (!currentUser?.id) return;
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      try {
        const { data: savedRecs, error: saveErr } = await supabase
          .from("saved_content")
          .select("*")
          .eq("user_id", currentUser.id)
          .order("created_at", { ascending: false });
        if (saveErr) throw saveErr;

        const unique = [...new Set((savedRecs || []).map(s => s.folder || "Favorites"))];
        if (!cancelled) setFolders(unique.length ? unique : ["Favorites"]);

        if (savedRecs && savedRecs.length) {
          const enriched = await Promise.all(savedRecs.map(async (s) => {
            try {
              if (s.content_type === "post") {
                const { data } = await supabase.from("posts").select("*, profiles(*)").eq("id", s.content_id).single();
                return { ...s, _content: data };
              }
              if (s.content_type === "reel") {
                const { data } = await supabase.from("reels").select("*, profiles(*)").eq("id", s.content_id).single();
                return { ...s, _content: data };
              }
              if (s.content_type === "story") {
                const { data } = await supabase.from("stories").select("*, profiles(*)").eq("id", s.content_id).single();
                return { ...s, _content: data };
              }
              return s;
            } catch (err) {
              console.error(err);
              return s;
            }
          }));
          if (!cancelled) setSavedItems(enriched);
        } else {
          if (!cancelled) setSavedItems([]);
        }
      } catch (err) {
        console.error("load saved error", err);
        if (!cancelled) setSavedItems([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => { cancelled = true; };
  }, [currentUser?.id]);

  const removeFromSaved = async (id) => {
    try {
      const { error } = await supabase.from("saved_content").delete().eq("id", id);
      if (error) throw error;
      setSavedItems(prev => prev.filter(p => p.id !== id));
    } catch (err) {
      console.error("remove saved error", err);
    }
  };

  const filtered = activeFolder === "all" ? savedItems : savedItems.filter(s => (s.folder || "Favorites") === activeFolder);

  const getThumb = (item) => {
    const c = item._content;
    if (!c) return null;
    if (item.content_type === "post" && c.primary_media_id) return mediaUrlService.getImageUrl(c.primary_media_id, { width: 240 });
    if (item.content_type === "reel" && c.video_thumbnail_id) return mediaUrlService.getImageUrl(c.video_thumbnail_id, { width: 240 });
    if (item.content_type === "story" && c.cover_image_id) return mediaUrlService.getStoryImageUrl(c.cover_image_id, 240);
    return null;
  };

  const openItem = (item) => {
    setSelectedItem(item._content || item);
    setFullscreenType(item.content_type);
  };

  if (fullscreenType === "post" && selectedItem) {
    return ReactDOM.createPortal(
      <FullScreenPost post={selectedItem} currentUser={currentUser} onClose={() => { setSelectedItem(null); setFullscreenType(null); }} />,
      document.body
    );
  }

  if (fullscreenType === "reel" && selectedItem) {
    return ReactDOM.createPortal(
      <FullScreenReels reels={[selectedItem]} initialIndex={0} currentUser={currentUser} onClose={() => { setSelectedItem(null); setFullscreenType(null); }} />,
      document.body
    );
  }

  if (fullscreenType === "story" && selectedItem) {
    return ReactDOM.createPortal(
      <FullContentView story={selectedItem} currentUser={currentUser} onClose={() => { setSelectedItem(null); setFullscreenType(null); }} />,
      document.body
    );
  }

  return ReactDOM.createPortal(
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.9)", zIndex: 10000 }} />

      <div onClick={(e) => e.stopPropagation()} style={{
        position: "fixed",
        ...(isMobile ? { bottom: 0, left: 0, right: 0, width: "100%", height: "95vh", borderRadius: "20px 20px 0 0" } : { top: "50%", left: "50%", transform: "translate(-50%,-50%)", width: "min(900px, calc(100vw - 40px))", maxHeight: "86vh", borderRadius: "16px" }),
        background: "#0b0b0b",
        zIndex: 10001,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}>
        <div style={{ padding: 16, borderBottom: "1px solid rgba(255,255,255,0.06)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            {activeFolder !== "all" && (
              <button onClick={() => setActiveFolder("all")} style={{ width: 36, height: 36, borderRadius: 18, background: "rgba(255,255,255,0.03)", border: "none", color: "#c7c7c7" }}><ChevronLeft size={16} /></button>
            )}
            <div style={{ width: 40, height: 40, borderRadius: 10, background: "rgba(255,255,255,0.03)", display: "flex", alignItems: "center", justifyContent: "center" }}><Bookmark size={20} /></div>
            <div>
              <div style={{ color: "#fff", fontSize: 16, fontWeight: 700 }}>{activeFolder === "all" ? "Saved" : activeFolder}</div>
              <div style={{ color: "#9ca3af", fontSize: 13 }}>{filtered.length} item{filtered.length !== 1 ? "s" : ""}</div>
            </div>
          </div>
          <button onClick={onClose} style={{ width: 36, height: 36, borderRadius: 18, background: "transparent", border: "none", color: "#c7c7c7" }}><X size={18} /></button>
        </div>

        {folders.length > 1 && (
          <div style={{ padding: "10px 12px", display: "flex", gap: 8, overflow: "auto", borderBottom: "1px solid rgba(255,255,255,0.03)" }}>
            <button onClick={() => setActiveFolder("all")} style={{ padding: "8px 12px", borderRadius: 8, background: activeFolder === "all" ? "rgba(255,255,255,0.04)" : "transparent", color: activeFolder === "all" ? "#fff" : "#9ca3af", border: "1px solid rgba(255,255,255,0.03)" }}>All</button>
            {folders.map(f => (
              <button key={f} onClick={() => setActiveFolder(f)} style={{ padding: "8px 12px", borderRadius: 8, background: activeFolder === f ? "rgba(255,255,255,0.04)" : "transparent", color: activeFolder === f ? "#fff" : "#9ca3af", border: "1px solid rgba(255,255,255,0.03)" }}>{f}</button>
            ))}
          </div>
        )}

        <div style={{ flex: 1, overflow: "auto", padding: 12 }}>
          {loading ? (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%" }}><Loader size={28} /></div>
          ) : filtered.length === 0 ? (
            <div style={{ textAlign: "center", paddingTop: 64, color: "#9ca3af" }}>
              <Bookmark size={48} style={{ opacity: 0.25 }} />
              <div style={{ fontWeight: 700, marginTop: 12 }}>Nothing saved yet</div>
              <div style={{ marginTop: 6 }}>Save posts, reels, and stories to find them here</div>
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 12 }}>
              {filtered.map(item => {
                const thumb = getThumb(item);
                return (
                  <div key={item.id} onClick={() => openItem(item)} style={{ position: "relative", borderRadius: 12, overflow: "hidden", cursor: "pointer", background: "rgba(255,255,255,0.02)", height: 0, paddingBottom: "100%" }}>
                    {thumb ? <img src={thumb} alt="thumb" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} /> : (
                      <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", color: "#9ca3af" }}>{item.content_type === "reel" ? <Film /> : item.content_type === "story" ? <BookOpen /> : <Image />}</div>
                    )}
                    <button onClick={(e) => { e.stopPropagation(); removeFromSaved(item.id); }} style={{ position: "absolute", top: 8, right: 8, width: 32, height: 32, borderRadius: 8, background: "rgba(0,0,0,0.5)", border: "none", color: "#fff" }}><Trash2 size={14} /></button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </>, document.body
  );
};

export default SavedContentModal;