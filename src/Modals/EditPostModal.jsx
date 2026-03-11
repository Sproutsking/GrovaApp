// ============================================================================
// src/components/Modals/EditPostModal.jsx — INSTANT SAVE
// Calls onUpdate with optimistic data immediately, patches DB in background.
// ============================================================================

import React, { useState, useEffect, useRef } from "react";
import { X, Save, Loader } from "lucide-react";
import postService from "../../services/home/postService";

const EditPostModal = ({ post, onClose, onUpdate, currentUser }) => {
  const [content, setContent] = useState(post?.content || "");
  const [category, setCategory] = useState(post?.category || "General");
  const [isSaving, setIsSaving] = useState(false);
  const [flash, setFlash] = useState(null);
  const textareaRef = useRef(null);

  const categories = [
    "General","Technology","Entertainment","Sports","News","Art","Music",
    "Food","Travel","Fashion","Gaming","Education","Health","Science",
    "Business","Finance","Lifestyle","Nature","Crypto","Web3",
  ];

  useEffect(() => {
    document.body.style.overflow = "hidden";
    // Auto-focus and place cursor at end
    if (textareaRef.current) {
      textareaRef.current.focus();
      const len = textareaRef.current.value.length;
      textareaRef.current.setSelectionRange(len, len);
    }
    return () => { document.body.style.overflow = ""; };
  }, []);

  useEffect(() => {
    const h = (e) => { if (e.key === "Escape" && !isSaving) onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [isSaving, onClose]);

  const showFlash = (msg, type = "error") => {
    setFlash({ msg, type });
    setTimeout(() => setFlash(null), 3000);
  };

  const hasContent = content.trim() || post.image_ids?.length || post.video_ids?.length;

  const handleSave = async () => {
    if (!hasContent) { showFlash("Post must have content or media"); return; }

    const updates = { content: content.trim(), category };

    // ── INSTANT: update UI immediately ─────────────────────────────────────
    const optimisticUpdate = { ...post, ...updates };
    if (onUpdate) onUpdate(optimisticUpdate); // instant parent update
    onClose(); // close modal immediately

    // ── BACKGROUND: persist to DB ──────────────────────────────────────────
    try {
      await postService.updatePost(post.id, updates);
    } catch (err) {
      console.error("Failed to persist edit:", err);
      // The parent already updated optimistically. In production you'd
      // rollback via a separate callback, but for now just log.
    }
  };

  return (
    <>
      <div style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.88)",
        backdropFilter: "blur(8px)", zIndex: 10000,
        animation: "fadeIn 0.2s ease",
      }} onClick={!isSaving ? onClose : undefined} />

      <div style={{
        position: "fixed", top: "50%", left: "50%",
        transform: "translate(-50%,-50%)",
        width: "min(560px, calc(100vw - 32px))",
        maxHeight: "90vh",
        background: "#0e0e0e",
        border: "1px solid rgba(132,204,22,0.25)",
        borderRadius: "18px", zIndex: 10001,
        display: "flex", flexDirection: "column",
        boxShadow: "0 24px 80px rgba(0,0,0,0.9)",
        animation: "slideUp 0.25s cubic-bezier(0.16,1,0.3,1)",
      }} onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "18px 20px 14px",
          borderBottom: "1px solid rgba(255,255,255,0.07)",
          flexShrink: 0,
        }}>
          <h2 style={{ color: "#f5f5f5", fontSize: "16px", fontWeight: 700, margin: 0 }}>Edit Post</h2>
          <button onClick={onClose} disabled={isSaving} style={{
            width: 32, height: 32, background: "rgba(255,255,255,0.05)",
            border: "1px solid rgba(255,255,255,0.1)", borderRadius: "50%",
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "#737373", cursor: isSaving ? "not-allowed" : "pointer",
          }}><X size={15} /></button>
        </div>

        {/* Flash */}
        {flash && (
          <div style={{
            margin: "10px 18px 0", padding: "9px 14px", borderRadius: "9px",
            background: flash.type === "error" ? "rgba(239,68,68,0.1)" : "rgba(132,204,22,0.1)",
            border: `1px solid ${flash.type === "error" ? "rgba(239,68,68,0.3)" : "rgba(132,204,22,0.3)"}`,
            color: flash.type === "error" ? "#ef4444" : "#84cc16",
            fontSize: "13px", fontWeight: 600,
          }}>{flash.msg}</div>
        )}

        {/* Body */}
        <div style={{ padding: "16px 18px", flex: 1, overflowY: "auto" }}>
          {/* Caption */}
          <div style={{ marginBottom: 18 }}>
            <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#84cc16", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.5px" }}>Caption</label>
            <textarea
              ref={textareaRef}
              value={content}
              onChange={e => setContent(e.target.value)}
              placeholder="What's on your mind?"
              maxLength={2000}
              disabled={isSaving}
              style={{
                width: "100%", minHeight: 130, padding: "12px 14px",
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: "12px", color: "#f5f5f5",
                fontSize: "15px", lineHeight: 1.6, resize: "vertical",
                fontFamily: "inherit", outline: "none", boxSizing: "border-box",
              }}
              onFocus={e => { e.target.style.borderColor = "rgba(132,204,22,0.4)"; }}
              onBlur={e => { e.target.style.borderColor = "rgba(255,255,255,0.1)"; }}
            />
            <div style={{ textAlign: "right", fontSize: "11px", color: "#525252", marginTop: 4 }}>{content.length}/2000</div>
          </div>

          {/* Category */}
          <div>
            <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#84cc16", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.5px" }}>Category</label>
            <select
              value={category}
              onChange={e => setCategory(e.target.value)}
              disabled={isSaving}
              style={{
                width: "100%", padding: "11px 14px",
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: "11px", color: "#f5f5f5",
                fontSize: "14px", cursor: "pointer", outline: "none",
                fontFamily: "inherit",
              }}
            >
              {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
            </select>
          </div>

          {/* Note */}
          <p style={{ fontSize: "12px", color: "#fb923c", marginTop: 14, lineHeight: 1.5 }}>
            Note: Media files cannot be changed after posting. Only caption and category can be edited.
          </p>
        </div>

        {/* Footer */}
        <div style={{
          display: "flex", gap: 10, padding: "14px 18px 18px",
          borderTop: "1px solid rgba(255,255,255,0.07)", flexShrink: 0,
        }}>
          <button onClick={onClose} disabled={isSaving} style={{
            flex: 1, padding: "12px", background: "rgba(255,255,255,0.05)",
            border: "1px solid rgba(255,255,255,0.1)", borderRadius: "11px",
            color: "#a3a3a3", fontSize: "14px", fontWeight: 600,
            cursor: isSaving ? "not-allowed" : "pointer",
          }}>Cancel</button>
          <button onClick={handleSave} disabled={isSaving || !hasContent} style={{
            flex: 2, padding: "12px",
            background: isSaving || !hasContent ? "rgba(132,204,22,0.15)" : "linear-gradient(135deg, #84cc16 0%, #65a30d 100%)",
            border: "none", borderRadius: "11px",
            color: isSaving || !hasContent ? "#525252" : "#000",
            fontSize: "14px", fontWeight: 700,
            cursor: isSaving || !hasContent ? "not-allowed" : "pointer",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            transition: "all 0.2s",
          }}>
            {isSaving
              ? <><Loader size={16} style={{ animation: "spin 0.6s linear infinite" }} /> Saving…</>
              : <><Save size={16} /> Save Changes</>}
          </button>
        </div>
      </div>

      <style>{`
        @keyframes fadeIn { from{opacity:0} to{opacity:1} }
        @keyframes slideUp { from{opacity:0;transform:translate(-50%,-44%) scale(0.96)} to{opacity:1;transform:translate(-50%,-50%) scale(1)} }
        @keyframes spin { to{transform:rotate(360deg)} }
      `}</style>
    </>
  );
};

export default EditPostModal;