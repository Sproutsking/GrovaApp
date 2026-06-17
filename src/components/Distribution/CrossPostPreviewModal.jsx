// src/components/Distribution/CrossPostPreviewModal.jsx
// ============================================================================
// Cross-Post Preview Modal — "Rubber Band" Carousel
//
// Shows a swipeable / navigable card stack that previews how the post
// will appear on each selected platform. Users can edit the caption
// per-platform before hitting "Post All".
//
// FEATURES:
//  - Rubber-band physics on drag (spring tension)
//  - Platform-specific content formatting (char limits, notes)
//  - Inline text editing per-platform
//  - "Post All" fires distribution with per-platform custom captions
//  - Accessible keyboard navigation (arrow keys)
// ============================================================================

import React, { useState, useRef, useCallback, useEffect } from "react";
import ReactDOM from "react-dom";
import {
  X, ChevronLeft, ChevronRight, Edit2, Check,
  Send, AlertCircle, Loader, Image as ImgIcon, Film,
} from "lucide-react";

const CSS = `
@keyframes cpFadeIn  { from{opacity:0}to{opacity:1} }
@keyframes cpSlideUp {
  from{opacity:0;transform:translate(-50%,-48%) scale(.94)}
  to  {opacity:1;transform:translate(-50%,-50%) scale(1)}
}
@keyframes cpSpin { to{transform:rotate(360deg)} }
@keyframes cpPop  {
  0%  {transform:scale(.9);opacity:0}
  65% {transform:scale(1.03)}
  100%{transform:scale(1);opacity:1}
}
@keyframes cpPulse{0%,100%{opacity:1}50%{opacity:.4}}

/* ── Backdrop ── */
.cp-bd {
  position:fixed;inset:0;
  background:rgba(0,0,0,.92);
  backdrop-filter:blur(18px);
  z-index:99998;
  animation:cpFadeIn .2s ease;
}

/* ── Panel ── */
.cp-panel {
  position:fixed;top:50%;left:50%;
  transform:translate(-50%,-50%);
  z-index:99999;
  width:min(480px,calc(100vw - 24px));
  max-height:90dvh;
  display:flex;flex-direction:column;
  background:#0c0c0c;
  border:1px solid rgba(255,255,255,.09);
  border-radius:22px;
  overflow:hidden;
  box-shadow:
    0 40px 120px rgba(0,0,0,.95),
    0 0 0 1px rgba(255,255,255,.04);
  animation:cpSlideUp .32s cubic-bezier(.34,1.4,.64,1);
  font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
}

/* ── Header ── */
.cp-head {
  padding:16px 18px 14px;
  border-bottom:1px solid rgba(255,255,255,.06);
  display:flex;align-items:center;justify-content:space-between;
  flex-shrink:0;
  background:rgba(255,255,255,.02);
}
.cp-head-title {
  font-size:14px;font-weight:800;color:#f0f0f0;
  display:flex;align-items:center;gap:8px;
}
.cp-head-sub { font-size:11px;color:#404040;font-weight:500;margin-top:2px; }
.cp-close {
  width:28px;height:28px;border-radius:8px;
  background:rgba(255,255,255,.05);
  border:1px solid rgba(255,255,255,.08);
  display:flex;align-items:center;justify-content:center;
  cursor:pointer;color:#555;transition:all .15s;
}
.cp-close:hover{background:rgba(255,255,255,.1);color:#ccc;}

/* ── Progress dots ── */
.cp-dots {
  display:flex;align-items:center;justify-content:center;
  gap:6px;padding:14px 0 0;
  flex-shrink:0;
}
.cp-dot {
  height:3px;border-radius:2px;
  transition:all .3s cubic-bezier(.34,1.56,.64,1);
  cursor:pointer;
}
.cp-dot.active { width:24px;background:#84cc16; }
.cp-dot.inactive { width:8px;background:rgba(255,255,255,.12); }

/* ── Carousel track ── */
.cp-track-wrap {
  flex:1;overflow:hidden;position:relative;
  padding:14px 20px;
  touch-action:pan-y;
}
.cp-track {
  display:flex;
  transition:transform .38s cubic-bezier(.34,1.2,.64,1);
  will-change:transform;
  gap:16px;
}

/* ── Platform card ── */
.cp-card {
  flex-shrink:0;
  width:100%;
  background:rgba(255,255,255,.025);
  border:1px solid rgba(255,255,255,.07);
  border-radius:16px;overflow:hidden;
  animation:cpPop .3s ease;
}
.cp-card-head {
  padding:12px 14px 10px;
  display:flex;align-items:center;gap:10px;
  border-bottom:1px solid rgba(255,255,255,.06);
}
.cp-card-icon {
  width:36px;height:36px;border-radius:10px;flex-shrink:0;
  display:flex;align-items:center;justify-content:center;
  font-size:15px;font-weight:900;border:1px solid;font-style:normal;
}
.cp-card-plat { font-size:13px;font-weight:800;color:#e0e0e0;margin:0; }
.cp-card-note { font-size:10px;color:#3a3a3a;margin:0;margin-top:1px; }
.cp-char-badge {
  margin-left:auto;font-size:10px;font-weight:700;
  padding:2px 8px;border-radius:12px;
}
.cp-char-ok  { background:rgba(132,204,22,.1);color:#84cc16;border:1px solid rgba(132,204,22,.2); }
.cp-char-warn{ background:rgba(245,158,11,.1);color:#fbbf24;border:1px solid rgba(245,158,11,.2); }
.cp-char-over{ background:rgba(239,68,68,.1); color:#f87171;border:1px solid rgba(239,68,68,.2); }

/* ── Content area ── */
.cp-content { padding:12px 14px; }
.cp-caption {
  font-size:12.5px;line-height:1.6;color:#c0c0c0;
  white-space:pre-wrap;word-break:break-word;
  min-height:64px;
}
.cp-caption-edit {
  width:100%;padding:8px 0;
  background:none;border:none;outline:none;
  font-size:12.5px;line-height:1.6;color:#e0e0e0;
  font-family:inherit;resize:none;
  min-height:80px;
}
.cp-edit-row {
  display:flex;align-items:center;gap:7px;
  padding:8px 14px 12px;
  border-top:1px solid rgba(255,255,255,.05);
}
.cp-edit-btn {
  display:inline-flex;align-items:center;gap:5px;
  padding:5px 11px;border-radius:8px;font-size:11px;font-weight:700;
  cursor:pointer;font-family:inherit;transition:all .14s;
}
.cp-edit-btn.edit {
  background:rgba(132,204,22,.08);border:1px solid rgba(132,204,22,.22);color:#84cc16;
}
.cp-edit-btn.edit:hover{background:rgba(132,204,22,.15);}
.cp-edit-btn.save {
  background:rgba(132,204,22,.12);border:1px solid rgba(132,204,22,.3);color:#84cc16;
}
.cp-edit-btn.save:hover{background:rgba(132,204,22,.2);}

/* ── Media preview strip ── */
.cp-media-strip {
  display:flex;gap:5px;padding:0 14px 12px;
  overflow-x:auto;scrollbar-width:none;
}
.cp-media-strip::-webkit-scrollbar{display:none;}
.cp-media-thumb {
  width:54px;height:54px;border-radius:8px;flex-shrink:0;
  object-fit:cover;border:1px solid rgba(255,255,255,.08);
}
.cp-media-video {
  width:54px;height:54px;border-radius:8px;flex-shrink:0;
  background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.08);
  display:flex;align-items:center;justify-content:center;color:#555;
}
.cp-instagram-note {
  margin:0 14px 12px;
  padding:8px 10px;
  background:rgba(244,114,182,.06);border:1px solid rgba(244,114,182,.15);
  border-radius:8px;font-size:11px;color:#f472b6;line-height:1.5;
}

/* ── Nav buttons ── */
.cp-nav {
  display:flex;align-items:center;justify-content:space-between;
  padding:4px 16px 16px;
  flex-shrink:0;
}
.cp-nav-btn {
  display:flex;align-items:center;gap:6px;
  padding:9px 16px;border-radius:11px;
  font-size:12.5px;font-weight:700;
  cursor:pointer;font-family:inherit;transition:all .15s;
  border:1px solid;
}
.cp-nav-btn.prev {
  background:rgba(255,255,255,.04);border-color:rgba(255,255,255,.1);color:#666;
}
.cp-nav-btn.prev:hover{background:rgba(255,255,255,.08);color:#aaa;}
.cp-nav-btn.next {
  background:rgba(132,204,22,.1);border-color:rgba(132,204,22,.3);color:#84cc16;
}
.cp-nav-btn.next:hover{background:rgba(132,204,22,.18);}
.cp-nav-btn:disabled{opacity:.35;cursor:not-allowed;}

/* ── Post All button ── */
.cp-post-all {
  margin:0 20px 20px;
  padding:14px;
  background:linear-gradient(135deg,#84cc16,#65a30d);
  border:none;border-radius:13px;color:#040a00;
  font-size:14px;font-weight:900;
  cursor:pointer;font-family:inherit;
  display:flex;align-items:center;justify-content:center;gap:8px;
  transition:all .2s;
  box-shadow:0 4px 18px rgba(132,204,22,.3);
}
.cp-post-all:hover:not(:disabled){transform:translateY(-2px);box-shadow:0 7px 28px rgba(132,204,22,.45);}
.cp-post-all:disabled{opacity:.5;cursor:not-allowed;transform:none;box-shadow:none;}

/* ── Xeevia card preview ── */
.cp-xeevia-post {
  margin:0 14px 12px;
  padding:10px;
  background:rgba(132,204,22,.04);
  border:1px solid rgba(132,204,22,.15);
  border-radius:10px;
  font-size:11.5px;color:#6a9a3a;line-height:1.5;
}
.cp-xeevia-label {
  font-size:9px;font-weight:800;letter-spacing:1px;
  color:#4a6a2a;text-transform:uppercase;margin-bottom:5px;
}
`;

// ── Platform configs for preview ─────────────────────────────────────────────
const PLATFORM_PREVIEW = {
  xeevia: {
    name:    "Xeevia",
    letter:  "X",
    color:   "#84cc16",
    bg:      "rgba(132,204,22,0.1)",
    border:  "rgba(132,204,22,0.2)",
    limit:   5000,
    note:    "Your original post on Xeevia",
    isHome:  true,
  },
  x: {
    name:   "X (Twitter)",
    letter: "𝕏",
    color:  "#e2e2e2",
    bg:     "rgba(226,226,226,0.08)",
    border: "rgba(226,226,226,0.2)",
    limit:  280,
    note:   "280 character limit — threads not auto-created",
  },
  facebook: {
    name:   "Facebook",
    letter: "f",
    color:  "#5b9ef9",
    bg:     "rgba(91,158,249,0.08)",
    border: "rgba(91,158,249,0.2)",
    limit:  63206,
    note:   "Shared to your Facebook feed",
  },
  instagram: {
    name:   "Instagram",
    letter: "✦",
    color:  "#f472b6",
    bg:     "rgba(244,114,182,0.08)",
    border: "rgba(244,114,182,0.2)",
    limit:  2200,
    note:   "Requires at least one image or video",
    requiresMedia: true,
  },
  linkedin: {
    name:   "LinkedIn",
    letter: "in",
    color:  "#60a5fa",
    bg:     "rgba(96,165,250,0.08)",
    border: "rgba(96,165,250,0.2)",
    limit:  3000,
    note:   "Shared to your LinkedIn feed",
  },
};

// ── Main Component ────────────────────────────────────────────────────────────
const CrossPostPreviewModal = ({
  post,                  // { content, image_metadata, video_metadata, card_caption }
  selectedPlatforms,     // string[] e.g. ["x", "facebook"]
  onClose,
  onPostAll,             // async (captions: { [platform]: string }) => void
}) => {
  // Build platform list: Xeevia first, then selected
  const platforms = ["xeevia", ...selectedPlatforms];

  // Per-platform captions (start with post content)
  const [captions, setCaptions] = useState(() => {
    const base = post?.content || post?.card_caption || "";
    const map = {};
    platforms.forEach(p => { map[p] = base; });
    return map;
  });

  const [activeIdx,  setActiveIdx]  = useState(0);
  const [editing,    setEditing]    = useState(false);
  const [editText,   setEditText]   = useState("");
  const [posting,    setPosting]    = useState(false);
  const [dragStart,  setDragStart]  = useState(null);
  const [dragOffset, setDragOffset] = useState(0);
  const trackRef = useRef(null);
  const textRef  = useRef(null);

  const total    = platforms.length;
  const platform = platforms[activeIdx];
  const cfg      = PLATFORM_PREVIEW[platform] || PLATFORM_PREVIEW.x;
  const caption  = captions[platform] || "";
  const overLimit = caption.length > cfg.limit;

  // Keyboard navigation
  useEffect(() => {
    const handler = (e) => {
      if (editing) return;
      if (e.key === "ArrowRight" && activeIdx < total - 1) goTo(activeIdx + 1);
      if (e.key === "ArrowLeft"  && activeIdx > 0)         goTo(activeIdx - 1);
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [activeIdx, editing, total]);

  const goTo = useCallback((idx) => {
    if (editing) saveEdit();
    setActiveIdx(Math.max(0, Math.min(idx, total - 1)));
    setDragOffset(0);
  }, [editing, total]);

  // ── Edit mode ──────────────────────────────────────────────────────────────
  const startEdit = () => {
    setEditText(captions[platform]);
    setEditing(true);
    setTimeout(() => textRef.current?.focus(), 50);
  };

  const saveEdit = () => {
    setCaptions(prev => ({ ...prev, [platform]: editText }));
    setEditing(false);
  };

  // ── Touch/drag handlers ────────────────────────────────────────────────────
  const onPointerDown = (e) => {
    if (editing) return;
    setDragStart(e.clientX);
  };

  const onPointerMove = (e) => {
    if (dragStart === null) return;
    const dx = e.clientX - dragStart;
    // Rubber-band resistance at edges
    const atLeft  = activeIdx === 0 && dx > 0;
    const atRight = activeIdx === total - 1 && dx < 0;
    const factor  = (atLeft || atRight) ? 0.22 : 1;
    setDragOffset(dx * factor);
  };

  const onPointerUp = (e) => {
    if (dragStart === null) return;
    const dx = e.clientX - dragStart;
    if (dx < -60 && activeIdx < total - 1) goTo(activeIdx + 1);
    else if (dx > 60 && activeIdx > 0)     goTo(activeIdx - 1);
    setDragOffset(0);
    setDragStart(null);
  };

  // ── Post All ──────────────────────────────────────────────────────────────
  const handlePostAll = async () => {
    if (editing) saveEdit();
    setPosting(true);
    try {
      await onPostAll(captions);
      onClose();
    } catch (err) {
      console.error("[CrossPostPreview] postAll error:", err);
    } finally {
      setPosting(false);
    }
  };

  // ── Track transform ────────────────────────────────────────────────────────
  const trackStyle = {
    transform: `translateX(calc(${-activeIdx * 100}% + ${dragOffset}px - ${activeIdx * 16}px))`,
    transition: dragStart !== null ? "none" : undefined,
  };

  const imageUrls = (post?.image_metadata || []).map(m => m.url).filter(Boolean);
  const hasVideo  = (post?.video_metadata || []).length > 0;

  return ReactDOM.createPortal(
    <>
      <style>{CSS}</style>
      <div className="cp-bd" onClick={e => { if (e.target === e.currentTarget) onClose(); }} />

      <div
        className="cp-panel"
        role="dialog"
        aria-modal="true"
        aria-label="Cross-post preview"
      >
        {/* Header */}
        <div className="cp-head">
          <div>
            <div className="cp-head-title">
              <Send size={14} color="#84cc16" />
              Review & Post
            </div>
            <div className="cp-head-sub">
              Swipe or navigate to preview each platform · Edit captions as needed
            </div>
          </div>
          <button className="cp-close" onClick={onClose} aria-label="Close">
            <X size={13} />
          </button>
        </div>

        {/* Progress dots */}
        <div className="cp-dots">
          {platforms.map((p, i) => (
            <div
              key={p}
              className={`cp-dot ${i === activeIdx ? "active" : "inactive"}`}
              onClick={() => goTo(i)}
              title={PLATFORM_PREVIEW[p]?.name || p}
              style={{ cursor: "pointer" }}
            />
          ))}
        </div>

        {/* Carousel */}
        <div
          className="cp-track-wrap"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerLeave={onPointerUp}
          style={{ cursor: dragStart !== null ? "grabbing" : "grab" }}
        >
          <div className="cp-track" style={trackStyle} ref={trackRef}>
            {platforms.map((p, i) => {
              const pcfg   = PLATFORM_PREVIEW[p] || PLATFORM_PREVIEW.x;
              const pcap   = captions[p] || "";
              const pOver  = pcap.length > pcfg.limit;
              const charPct = pcap.length / pcfg.limit;
              const charClass = pOver ? "cp-char-over" : charPct > 0.85 ? "cp-char-warn" : "cp-char-ok";
              const isActive = i === activeIdx;

              return (
                <div key={p} className="cp-card">
                  {/* Card header */}
                  <div className="cp-card-head">
                    <div className="cp-card-icon" style={{
                      background: pcfg.bg,
                      borderColor: pcfg.border,
                      color: pcfg.color,
                    }}>
                      {pcfg.letter}
                    </div>
                    <div>
                      <p className="cp-card-plat">{pcfg.name}</p>
                      <p className="cp-card-note">{pcfg.note}</p>
                    </div>
                    {pcfg.limit < 10000 && (
                      <span className={`cp-char-badge ${charClass}`}>
                        {pcap.length}/{pcfg.limit}
                      </span>
                    )}
                  </div>

                  {/* Instagram: requires media warning */}
                  {p === "instagram" && !imageUrls.length && !hasVideo && (
                    <div className="cp-instagram-note">
                      <AlertCircle size={11} style={{ display:"inline", marginRight:4, verticalAlign:"middle" }} />
                      Instagram requires at least one image or video.
                      This post will be skipped on Instagram without media.
                    </div>
                  )}

                  {/* Xeevia post note */}
                  {pcfg.isHome && (
                    <div className="cp-xeevia-post" style={{ margin:"12px 14px 0" }}>
                      <div className="cp-xeevia-label">Original · Xeevia</div>
                      This is your post as it will appear on Xeevia. It distributes
                      to the platforms shown on the other cards.
                    </div>
                  )}

                  {/* Caption area */}
                  <div className="cp-content">
                    {isActive && editing ? (
                      <textarea
                        ref={textRef}
                        className="cp-caption-edit"
                        value={editText}
                        onChange={e => setEditText(e.target.value)}
                        placeholder={`Write your ${pcfg.name} caption…`}
                      />
                    ) : (
                      <div className="cp-caption">
                        {pcap || <span style={{ color:"#333", fontStyle:"italic" }}>No caption</span>}
                      </div>
                    )}
                  </div>

                  {/* Media preview */}
                  {(imageUrls.length > 0 || hasVideo) && (
                    <div className="cp-media-strip">
                      {imageUrls.slice(0, 6).map((url, idx) => (
                        <img
                          key={idx}
                          src={url}
                          alt=""
                          className="cp-media-thumb"
                          onError={e => { e.target.style.display = "none"; }}
                        />
                      ))}
                      {hasVideo && (
                        <div className="cp-media-video">
                          <Film size={20} />
                        </div>
                      )}
                    </div>
                  )}

                  {/* Edit row */}
                  {isActive && !pcfg.isHome && (
                    <div className="cp-edit-row">
                      {editing ? (
                        <button className="cp-edit-btn save" onClick={saveEdit}>
                          <Check size={11} /> Save edit
                        </button>
                      ) : (
                        <button className="cp-edit-btn edit" onClick={startEdit}>
                          <Edit2 size={11} /> Edit for {pcfg.name}
                        </button>
                      )}
                      {pOver && (
                        <span style={{ fontSize:11, color:"#f87171", marginLeft:"auto" }}>
                          {pcap.length - pcfg.limit} chars over limit
                        </span>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Navigation */}
        <div className="cp-nav">
          <button
            className="cp-nav-btn prev"
            onClick={() => goTo(activeIdx - 1)}
            disabled={activeIdx === 0}
          >
            <ChevronLeft size={14} />
            {activeIdx > 0 ? (PLATFORM_PREVIEW[platforms[activeIdx - 1]]?.name || "Back") : "Back"}
          </button>

          <span style={{ fontSize:11, color:"#383838", fontWeight:600 }}>
            {activeIdx + 1} / {total}
          </span>

          {activeIdx < total - 1 ? (
            <button
              className="cp-nav-btn next"
              onClick={() => goTo(activeIdx + 1)}
            >
              {PLATFORM_PREVIEW[platforms[activeIdx + 1]]?.name || "Next"}
              <ChevronRight size={14} />
            </button>
          ) : (
            <button
              className="cp-nav-btn next"
              style={{ opacity:0, pointerEvents:"none" }}
            >
              &nbsp;
            </button>
          )}
        </div>

        {/* Post All */}
        <button
          className="cp-post-all"
          onClick={handlePostAll}
          disabled={posting}
        >
          {posting ? (
            <>
              <div style={{
                width:16, height:16, borderRadius:"50%",
                border:"2px solid rgba(0,0,0,.2)", borderTopColor:"#040a00",
                animation:"cpSpin .7s linear infinite",
              }} />
              Publishing to {selectedPlatforms.length} platform{selectedPlatforms.length !== 1 ? "s" : ""}…
            </>
          ) : (
            <>
              <Send size={15} />
              Post to {selectedPlatforms.length} Platform{selectedPlatforms.length !== 1 ? "s" : ""}
            </>
          )}
        </button>
      </div>
    </>,
    document.body
  );
};

export default CrossPostPreviewModal;