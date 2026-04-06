// ============================================================================
// components/Messages/UpdatesView.jsx — NOVA STATUS v5 FINAL
// ============================================================================
// FIXED vs v4:
//  [FIX-RPC] supabase.rpc() returns a PromiseLike, NOT a native Promise.
//            Chaining .catch() directly on it throws "catch is not a function".
//            All rpc calls now use: await supabase.rpc(...) inside try/catch,
//            OR Promise.resolve(supabase.rpc(...)).catch(() => {}) for fire-
//            and-forget paths. No bare .catch() anywhere in this file.
// ============================================================================

import React, { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "../../services/config/supabase";
import mediaUrlService from "../../services/shared/mediaUrlService";

/* ─── Constants ─── */
const BUCKET      = "status-media";
const CHAR_MAX    = 280;
const STATUS_MAX  = 30;
const RING_SECS   = 6000;

const GRADIENTS = [
  "linear-gradient(145deg,#0f2027,#203a43,#2c5364)",
  "linear-gradient(145deg,#1a1a2e,#16213e,#0f3460)",
  "linear-gradient(145deg,#0d0d0d,#1a1a1a,#2d4a22)",
  "linear-gradient(145deg,#200122,#6f0000)",
  "linear-gradient(145deg,#0f0c29,#302b63,#24243e)",
  "linear-gradient(145deg,#000428,#004e92)",
  "linear-gradient(145deg,#1f1c2c,#928dab)",
  "linear-gradient(145deg,#0d1b2a,#1b4332)",
  "linear-gradient(145deg,#13000a,#3d0026)",
  "linear-gradient(145deg,#001f3f,#0074d9)",
  "linear-gradient(145deg,#2d1b69,#11998e)",
  "linear-gradient(145deg,#373b44,#4286f4)",
  "linear-gradient(145deg,#141e30,#243b55)",
  "linear-gradient(145deg,#0a0a0a,#1a1a1a)",
  "linear-gradient(145deg,#1a0533,#3d1166)",
];

const TEXT_COLORS = ["#ffffff","#84cc16","#f59e0b","#ef4444","#60a5fa","#c084fc","#f472b6","#34d399","#fbbf24","#a78bfa","#fb923c","#22d3ee"];

const DURATIONS = [
  { h: 6,  label: "6h",  sub: "Gone quickly" },
  { h: 12, label: "12h", sub: "Half a day" },
  { h: 18, label: "18h", sub: "Most of the day" },
  { h: 24, label: "24h", sub: "Full day" },
];

/* ─── Helpers ─── */
const fmtRel = iso => {
  if (!iso) return "";
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 60000)    return "just now";
  if (ms < 3600000)  return `${Math.floor(ms / 60000)}m ago`;
  if (ms < 86400000) return `${Math.floor(ms / 3600000)}h ago`;
  return `${Math.floor(ms / 86400000)}d ago`;
};

const fmtCountdown = exp => {
  const ms = new Date(exp).getTime() - Date.now();
  if (ms <= 0) return "expired";
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
};

const isNearExp = exp => {
  const ms = new Date(exp).getTime() - Date.now();
  return ms > 0 && ms < 3600000;
};

const getInitial = name => (name || "?").charAt(0).toUpperCase();

const getMediaUrl = imageId => {
  if (!imageId) return null;
  if (imageId.startsWith("http")) return imageId;
  try {
    const { data: { publicUrl } } = supabase.storage.from(BUCKET).getPublicUrl(imageId);
    return publicUrl;
  } catch { return null; }
};

const uploadMedia = async (file, onProgress) => {
  if (!file) throw new Error("No file provided");
  const isVideo = file.type.startsWith("video/");
  const isImage = file.type.startsWith("image/");
  if (!isVideo && !isImage) throw new Error("Only images and videos are supported.");
  const maxMb = isVideo ? 100 : 20;
  if (file.size > maxMb * 1024 * 1024) throw new Error(`File too large. Max ${maxMb}MB for ${isVideo ? "videos" : "images"}.`);
  const ext  = file.name?.split(".").pop()?.toLowerCase() || (isVideo ? "mp4" : "jpg");
  const path = `${Date.now()}_${Math.random().toString(36).slice(2, 9)}.${ext}`;
  onProgress?.(15);
  const { data, error } = await supabase.storage.from(BUCKET).upload(path, file, {
    contentType: file.type, cacheControl: "86400", upsert: false,
  });
  if (error) throw error;
  onProgress?.(100);
  const { data: { publicUrl } } = supabase.storage.from(BUCKET).getPublicUrl(data.path);
  return { id: data.path, url: publicUrl, type: isVideo ? "video" : "image", mimeType: file.type };
};

/* ─── Icons ─── */
const Ic = {
  Camera:  () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/></svg>,
  Video:   () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>,
  Type:    () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="4 7 4 4 20 4 20 7"/><line x1="9" y1="20" x2="15" y2="20"/><line x1="12" y1="4" x2="12" y2="20"/></svg>,
  Heart:   ({ f }) => <svg width="18" height="18" viewBox="0 0 24 24" fill={f ? "#ef4444" : "none"} stroke={f ? "#ef4444" : "currentColor"} strokeWidth="1.8"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/></svg>,
  Reply:   () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 17 4 12 9 7"/><path d="M20 18v-2a4 4 0 00-4-4H4"/></svg>,
  Close:   () => <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>,
  Pause:   () => <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>,
  Play:    () => <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>,
  Clock:   () => <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
  Eye:     () => <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>,
  Send:    () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>,
  Plus:    () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>,
  Check:   () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>,
  Trash:   () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>,
  Upload:  () => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="16 16 12 12 8 16"/><line x1="12" y1="12" x2="12" y2="21"/><path d="M20.39 18.39A5 5 0 0018 9h-1.26A8 8 0 103 16.3"/></svg>,
  Verified:() => <svg width="12" height="12" viewBox="0 0 24 24" fill="#60a5fa"><path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>,
};

/* ─── User Avatar ─── */
const UAv = ({ user, size = 52, ring = false, nearExp = false }) => {
  const url = user?.avatar_id ? mediaUrlService.getAvatarUrl(user.avatar_id, 200) : null;
  const ringColor = nearExp ? "#f59e0b" : "#84cc16";
  return (
    <div className={`upd-av${ring ? " upd-av-ring" : ""}`}
      style={{
        width: size, height: size, fontSize: size * 0.38,
        "--ring-color": ringColor,
        borderRadius: "50%", overflow: "hidden",
      }}>
      {url
        ? <img src={url} alt={user?.full_name || "?"} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        : <span>{getInitial(user?.full_name)}</span>
      }
    </div>
  );
};

/* ════════════════════════════════════════════════════
   STORY VIEWER
════════════════════════════════════════════════════ */
const StoryViewer = ({ stories, startIndex = 0, currentUser, onClose, onReplyAsDM, onLike, likedIds }) => {
  const [idx,     setIdx]     = useState(startIndex);
  const [prog,    setProg]    = useState(0);
  const [paused,  setPaused]  = useState(false);
  const [showRep, setShowRep] = useState(false);
  const [repTxt,  setRepTxt]  = useState("");
  const [sending, setSending] = useState(false);
  const [repDone, setRepDone] = useState(false);
  const [loaded,  setLoaded]  = useState(false);

  const vRef    = useRef(null);
  const timerR  = useRef(null);
  const story   = stories[idx];

  const advance = useCallback(() => {
    setProg(0); setLoaded(false); setRepDone(false);
    setIdx(i => {
      if (i + 1 >= stories.length) { onClose(); return i; }
      return i + 1;
    });
  }, [stories.length, onClose]);

  useEffect(() => { setLoaded(false); setRepDone(false); setTimeout(() => setLoaded(true), 40); }, [idx]);

  useEffect(() => {
    if (paused || showRep || !loaded) return;
    const s = stories[idx];
    if (s?.image_id && s?.media_type === "video") return;
    clearInterval(timerR.current);
    const step = (50 / RING_SECS) * 100;
    timerR.current = setInterval(() => {
      setProg(p => {
        if (p >= 100) { clearInterval(timerR.current); advance(); return 0; }
        return Math.min(p + step, 100);
      });
    }, 50);
    return () => clearInterval(timerR.current);
  }, [idx, paused, showRep, loaded, advance, stories]);

  const handleReply = async () => {
    if (!repTxt.trim() || sending) return;
    setSending(true);
    try {
      await onReplyAsDM?.(story, repTxt.trim());
      setRepTxt(""); setShowRep(false); setRepDone(true);
      setTimeout(() => setRepDone(false), 3500);
    } catch (e) { console.error("[StoryViewer] reply:", e); }
    finally { setSending(false); }
  };

  if (!story) return null;
  const mediaUrl = getMediaUrl(story.image_id);
  const isVid    = story.media_type === "video" && mediaUrl;
  const isImg    = story.media_type === "image" && mediaUrl;
  const isLiked  = likedIds.has(story.id);
  const isMine   = story.user_id === currentUser?.id;

  const bgStyle = story.bg
    ? { background: story.bg }
    : (isImg || isVid) ? { background: "#000" }
    : { background: "linear-gradient(145deg,#0d1117,#1a2332)" };

  return (
    <div className="sv-root">
      <div className="sv-bars">
        {stories.map((_, i) => (
          <div key={i} className="sv-bar-track">
            <div className="sv-bar-fill" style={{
              width: i < idx ? "100%" : i === idx ? `${prog}%` : "0%",
              transition: i === idx ? "none" : undefined,
            }}/>
          </div>
        ))}
      </div>

      <div className="sv-head">
        <UAv user={story.profile} size={38} />
        <div className="sv-head-info">
          <div className="sv-uname">
            {story.profile?.full_name || "Unknown"}
            {story.profile?.verified && <Ic.Verified/>}
          </div>
          <div className="sv-umeta">
            <Ic.Clock/> {fmtRel(story.created_at)}
            &nbsp;·&nbsp;
            <Ic.Eye/> {story.views || 0}
            {isNearExp(story.expires_at) && <span className="sv-expiring"> · ⏳ {fmtCountdown(story.expires_at)} left</span>}
          </div>
        </div>
        <div className="sv-head-right">
          <button className="sv-hbtn" onClick={() => setPaused(p => !p)}>{paused ? <Ic.Play/> : <Ic.Pause/>}</button>
          <button className="sv-hbtn" onClick={onClose}><Ic.Close/></button>
        </div>
      </div>

      <div className="sv-content" style={bgStyle}>
        {isVid && (
          <video ref={vRef} src={mediaUrl} autoPlay playsInline
            style={{ width: "100%", height: "100%", objectFit: "contain" }}
            onTimeUpdate={e => {
              const v = e.currentTarget;
              if (v.duration) {
                const p = (v.currentTime / v.duration) * 100;
                setProg(p);
                if (p >= 99) advance();
              }
            }}
            onPause={() => setPaused(true)}
            onPlay={() => setPaused(false)}
          />
        )}
        {isImg && !isVid && (
          <img src={mediaUrl} alt="" style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }} onLoad={() => setLoaded(true)} />
        )}
        {story.text && (
          <div className={`sv-text${loaded ? " sv-text-in" : ""}${(isImg || isVid) ? " sv-text-ov" : ""}`}
            style={{ color: story.text_color || "#fff" }}>
            {story.text}
          </div>
        )}
      </div>

      <div className="sv-tap-prev" onClick={() => { if (idx > 0) { setIdx(idx - 1); setProg(0); } }}/>
      <div className="sv-tap-next" onClick={advance}/>

      <div className="sv-bottom">
        {repDone && <div className="sv-rep-sent"><Ic.Check/> Reply sent</div>}
        {showRep ? (
          <div className="sv-rep-row">
            <input className="sv-rep-inp"
              placeholder={`Reply to ${story.profile?.full_name?.split(" ")[0] || ""}…`}
              value={repTxt} onChange={e => setRepTxt(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleReply()}
              autoFocus disabled={sending}/>
            <button className="sv-send-btn" onClick={handleReply} disabled={!repTxt.trim() || sending}>
              {sending ? <span className="sv-spinner"/> : <Ic.Send/>}
            </button>
            <button className="sv-hbtn" onClick={() => setShowRep(false)}><Ic.Close/></button>
          </div>
        ) : (
          <div className="sv-btm-row">
            {!isMine && (
              <button className="sv-action-btn" onClick={() => setShowRep(true)}>
                <Ic.Reply/><span>Reply</span>
              </button>
            )}
            <button className={`sv-action-btn${isLiked ? " sv-liked" : ""}`} onClick={() => onLike(story.id, isLiked)}>
              <Ic.Heart f={isLiked}/><span>{isLiked ? "Liked" : "Like"}</span>
            </button>
            {isMine && (
              <div className="sv-stats">
                <span><Ic.Eye/> {story.views || 0}</span>
                <span><Ic.Heart f={false}/> {story.likes || 0}</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

/* ════════════════════════════════════════════════════
   MEDIA UPLOAD STEP
════════════════════════════════════════════════════ */
const MediaStep = ({ onReady, onBack, onClose }) => {
  const [drag,  setDrag]  = useState(false);
  const [prev,  setPrev]  = useState(null);
  const [file,  setFile]  = useState(null);
  const [upl,   setUpl]   = useState(false);
  const [pct,   setPct]   = useState(0);
  const [err,   setErr]   = useState(null);
  const inputRef = useRef(null);

  const handleFile = f => {
    if (!f) return;
    setErr(null);
    const isVid = f.type.startsWith("video/");
    const isImg = f.type.startsWith("image/");
    if (!isVid && !isImg) { setErr("Only images and videos are supported."); return; }
    const maxMb = isVid ? 100 : 20;
    if (f.size > maxMb * 1024 * 1024) { setErr(`Too large — max ${maxMb}MB for ${isVid ? "video" : "image"}.`); return; }
    setFile(f);
    setPrev({ url: URL.createObjectURL(f), type: isVid ? "video" : "image" });
  };

  const handleUpload = async () => {
    if (!file || upl) return;
    setUpl(true); setPct(0);
    try {
      const res = await uploadMedia(file, p => setPct(p));
      onReady(res);
    } catch (e) {
      setErr(`Upload failed: ${e.message}`);
      setUpl(false);
    }
  };

  return (
    <>
      <div className="ms-header">
        <button className="ms-back" onClick={onBack}>← Back</button>
        <span className="ms-title">Add Photo / Video</span>
        <button className="ms-close" onClick={onClose}><Ic.Close/></button>
      </div>
      <div className="ms-body">
        {prev ? (
          <div className="ms-prev-wrap">
            {prev.type === "video"
              ? <video src={prev.url} controls className="ms-prev-media"/>
              : <img src={prev.url} alt="preview" className="ms-prev-media"/>
            }
            <button className="ms-change" onClick={() => { setPrev(null); setFile(null); }}>Change</button>
          </div>
        ) : (
          <div className={`ms-drop${drag ? " ms-drag-over" : ""}`}
            onDragOver={e => { e.preventDefault(); setDrag(true); }}
            onDragLeave={() => setDrag(false)}
            onDrop={e => { e.preventDefault(); setDrag(false); handleFile(e.dataTransfer.files[0]); }}
            onClick={() => inputRef.current?.click()}>
            <div className="ms-drop-icon">{drag ? <Ic.Upload/> : <Ic.Camera/>}</div>
            <p className="ms-drop-title">Drop your photo or video here</p>
            <p className="ms-drop-sub">or tap to browse · Full quality, no compression</p>
            <div className="ms-badges">
              {["JPG", "PNG", "WEBP", "GIF", "MP4", "MOV", "WEBM"].map(b => (
                <span key={b} className="ms-badge">{b}</span>
              ))}
            </div>
            <p className="ms-limits">Images up to 20 MB · Videos up to 100 MB</p>
          </div>
        )}
        <input ref={inputRef} type="file" accept="image/*,video/*" style={{ display: "none" }}
          onChange={e => handleFile(e.target.files[0])}/>
        {err && <div className="ms-err">{err}</div>}
        {upl && (
          <div className="ms-prog-wrap">
            <div className="ms-prog-bar"><div className="ms-prog-fill" style={{ width: `${pct}%` }}/></div>
            <span className="ms-prog-label">Uploading {pct}%…</span>
          </div>
        )}
        {prev && !upl && (
          <button className="compose-cta" onClick={handleUpload}>Upload & Continue →</button>
        )}
      </div>
    </>
  );
};

/* ════════════════════════════════════════════════════
   ADD STATUS MODAL
════════════════════════════════════════════════════ */
const AddStatusModal = ({ currentUser, onClose, onAdded, todayCount }) => {
  const [step,    setStep]    = useState("pick");
  const [mode,    setMode]    = useState("text");
  const [text,    setText]    = useState("");
  const [bg,      setBg]      = useState(GRADIENTS[0]);
  const [bgPage,  setBgPage]  = useState(0);
  const [tcol,    setTcol]    = useState("#ffffff");
  const [dur,     setDur]     = useState(24);
  const [media,   setMedia]   = useState(null);
  const [saving,  setSaving]  = useState(false);

  const remaining = STATUS_MAX - todayCount;
  const charPct   = Math.min((text.length / CHAR_MAX) * 100, 100);
  const bgSlice   = GRADIENTS.slice(bgPage * 5, bgPage * 5 + 5);
  const canNext   = !!media || text.trim().length > 0;
  const expAt     = new Date(Date.now() + dur * 3_600_000);

  const handleShare = async () => {
    if (saving || !canNext) return;
    setSaving(true);
    try {
      const row = {
        user_id:    currentUser.id,
        text:       text.trim() || null,
        bg:         media ? null : bg,
        text_color: tcol,
        duration_h: dur,
        expires_at: expAt.toISOString(),
        views:      0,
        likes:      0,
        media_type: media ? media.type : "text",
      };
      if (media?.id) row.image_id = media.id;

      const { error } = await supabase.from("status_updates").insert(row);
      if (error) throw error;
      onAdded?.(); onClose();
    } catch (e) {
      if (e.message?.includes("media_type")) {
        try {
          const fallback = {
            user_id: currentUser.id, text: text.trim() || null,
            bg: media ? null : bg, text_color: tcol, duration_h: dur,
            expires_at: expAt.toISOString(), views: 0, likes: 0,
          };
          if (media?.id) fallback.image_id = media.id;
          const { error: e2 } = await supabase.from("status_updates").insert(fallback);
          if (e2) throw e2;
          onAdded?.(); onClose(); return;
        } catch (e3) {
          alert(`Failed: ${e3.message}\n\nRun: ALTER TABLE status_updates ADD COLUMN IF NOT EXISTS media_type text DEFAULT 'text';`);
        }
      } else if (e.code === "42P01") {
        alert("The status_updates table doesn't exist yet. Run the SQL setup from Settings.");
      } else {
        alert(`Could not share: ${e.message}`);
      }
    } finally { setSaving(false); }
  };

  return (
    <div className="modal-ov" onClick={onClose}>
      <div className="modal-sheet" onClick={e => e.stopPropagation()}>
        <div className="modal-pill"/>

        {step === "pick" && (
          <>
            <div className="modal-hdr">
              <div>
                <h3 className="modal-title">New Status</h3>
                <p className="modal-sub">{remaining} of {STATUS_MAX} left today</p>
              </div>
              <button className="modal-close" onClick={onClose}><Ic.Close/></button>
            </div>
            <div className="pick-grid">
              <button className="pick-card" onClick={() => { setMode("text"); setStep("compose"); }}>
                <div className="pick-icon pick-icon-text"><Ic.Type/></div>
                <div className="pick-info">
                  <span className="pick-label">Text</span>
                  <span className="pick-desc">Express yourself with words and color</span>
                </div>
                <span className="pick-arrow">→</span>
              </button>
              <button className="pick-card" onClick={() => { setMode("photo"); setStep("media"); }}>
                <div className="pick-icon pick-icon-photo"><Ic.Camera/></div>
                <div className="pick-info">
                  <span className="pick-label">Photo</span>
                  <span className="pick-desc">Full quality · JPG, PNG, WEBP up to 20MB</span>
                </div>
                <span className="pick-arrow">→</span>
              </button>
              <button className="pick-card" onClick={() => { setMode("video"); setStep("media"); }}>
                <div className="pick-icon pick-icon-video"><Ic.Video/></div>
                <div className="pick-info">
                  <span className="pick-label">Video</span>
                  <span className="pick-desc">Full quality · MP4, MOV up to 100MB</span>
                </div>
                <span className="pick-arrow">→</span>
              </button>
            </div>
          </>
        )}

        {step === "media" && (
          <MediaStep
            onReady={r => { setMedia(r); setStep("compose"); }}
            onBack={() => setStep("pick")}
            onClose={onClose}
          />
        )}

        {step === "compose" && (
          <>
            <div className="modal-hdr">
              <button className="modal-back" onClick={() => mode !== "text" ? setStep("media") : setStep("pick")}>← Back</button>
              <span className="modal-title modal-title-c">{media ? "Add Caption" : "Write Status"}</span>
              <button className="modal-close" onClick={onClose}><Ic.Close/></button>
            </div>

            <div className="compose-preview" style={media ? { background: "#000" } : { background: bg }}>
              {media?.type === "video" && (
                <video src={media.url} muted autoPlay loop playsInline style={{ width: "100%", height: "100%", objectFit: "contain" }}/>
              )}
              {media?.type === "image" && (
                <img src={media.url} alt="" style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }}/>
              )}
              {text && <p className="compose-overlay-text" style={{ color: tcol }}>{text}</p>}
              {!text && !media && <p className="compose-placeholder">Your status preview…</p>}
            </div>

            <div className="compose-inp-wrap">
              <textarea className="compose-textarea"
                placeholder={media ? "Add a caption (optional)…" : "What's on your mind?"}
                value={text} onChange={e => setText(e.target.value)}
                maxLength={CHAR_MAX} autoFocus={!media}/>
              <div className="compose-char">
                <svg width="22" height="22" viewBox="0 0 24 24">
                  <circle cx="12" cy="12" r="10" fill="none" stroke="rgba(255,255,255,.1)" strokeWidth="2.5"/>
                  <circle cx="12" cy="12" r="10" fill="none"
                    stroke={charPct > 90 ? "#ef4444" : charPct > 70 ? "#f59e0b" : "#84cc16"}
                    strokeWidth="2.5" strokeDasharray={`${2 * Math.PI * 10}`}
                    strokeDashoffset={`${2 * Math.PI * 10 * (1 - charPct / 100)}`}
                    strokeLinecap="round"
                    style={{ transform: "rotate(-90deg)", transformOrigin: "center", transition: "all .2s" }}/>
                </svg>
                <span style={{ fontSize: 11, color: charPct > 90 ? "#ef4444" : "#555" }}>{CHAR_MAX - text.length}</span>
              </div>
            </div>

            {!media && (
              <>
                <p className="compose-section-lbl">Background</p>
                <div className="bg-row">
                  {bgSlice.map((g, i) => (
                    <button key={i} className={`bg-sw${bg === g ? " bg-sw-on" : ""}`}
                      style={{ background: g }} onClick={() => setBg(g)}>
                      {bg === g && <Ic.Check/>}
                    </button>
                  ))}
                  <button className="bg-page" onClick={() => setBgPage(p => (p + 1) % Math.ceil(GRADIENTS.length / 5))}>
                    {bgPage < Math.ceil(GRADIENTS.length / 5) - 1 ? "→" : "↺"}
                  </button>
                </div>
              </>
            )}

            <p className="compose-section-lbl">Text Color</p>
            <div className="color-row">
              {TEXT_COLORS.map(c => (
                <button key={c} className={`color-dot${tcol === c ? " color-dot-on" : ""}`}
                  style={{ background: c }} onClick={() => setTcol(c)}/>
              ))}
            </div>

            <button className="compose-cta" onClick={() => setStep("duration")} disabled={!canNext}>
              Next: Set Duration →
            </button>
          </>
        )}

        {step === "duration" && (
          <>
            <div className="modal-hdr">
              <button className="modal-back" onClick={() => setStep("compose")}>← Back</button>
              <span className="modal-title modal-title-c">How long?</span>
              <button className="modal-close" onClick={onClose}><Ic.Close/></button>
            </div>

            <div className="dur-preview" style={media ? { background: "#111", overflow: "hidden" } : { background: bg }}>
              {media?.type === "video" && <video src={media.url} muted autoPlay loop playsInline style={{ height: "100%", objectFit: "cover", width: "100%" }}/>}
              {media?.type === "image" && <img src={media.url} alt="" style={{ height: "100%", objectFit: "cover", width: "100%" }}/>}
              {!media && text && <p style={{ color: tcol, fontSize: 13, fontWeight: 700, margin: 0, padding: "0 12px", textAlign: "center" }}>{text.slice(0, 60)}{text.length > 60 ? "…" : ""}</p>}
            </div>

            <p className="dur-hint">Your status disappears automatically after this time.</p>

            <div className="dur-cards">
              {DURATIONS.map(d => (
                <button key={d.h} className={`dur-card${dur === d.h ? " dur-on" : ""}`} onClick={() => setDur(d.h)}>
                  <span className="dur-time">{d.label}</span>
                  <span className="dur-desc">{d.sub}</span>
                  {dur === d.h && <span className="dur-check"><Ic.Check/></span>}
                </button>
              ))}
            </div>

            <div className="dur-expiry">
              <Ic.Clock/>
              <span>
                Expires {expAt.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}, {expAt.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" })}
              </span>
            </div>

            <button className={`share-btn${saving ? " saving" : ""}`} onClick={handleShare} disabled={saving || !canNext}>
              {saving ? <span className="sv-spinner"/> : <><Ic.Send/><span>Share Status</span></>}
            </button>
          </>
        )}
      </div>
    </div>
  );
};

/* ════════════════════════════════════════════════════
   EXTEND MODAL
════════════════════════════════════════════════════ */
const ExtendModal = ({ story, onExtend, onClose }) => (
  <div className="modal-ov" onClick={onClose}>
    <div className="extend-box" onClick={e => e.stopPropagation()}>
      <div className="extend-hd">
        <span>⏳ Extend Status</span>
        <button className="ms-close" onClick={onClose}><Ic.Close/></button>
      </div>
      <p className="extend-cur">Currently: <strong style={{ color: "#f59e0b" }}>{fmtCountdown(story.expires_at)} remaining</strong></p>
      {[3, 6, 12, 24].map(h => (
        <button key={h} className="extend-opt" onClick={() => { onExtend(story.id, h); onClose(); }}>
          + {h} hours
        </button>
      ))}
    </div>
  </div>
);

/* ════════════════════════════════════════════════════
   MAIN UPDATES VIEW
════════════════════════════════════════════════════ */
const UpdatesView = ({ currentUser, onReplyAsDM }) => {
  const [myStories,    setMyStories]    = useState([]);
  const [otherStories, setOtherStories] = useState([]);
  const [likedIds,     setLikedIds]     = useState(new Set());
  const [viewer,       setViewer]       = useState(null);
  const [showAdd,      setShowAdd]      = useState(false);
  const [extTarget,    setExtTarget]    = useState(null);
  const [loading,      setLoading]      = useState(true);
  const [tableErr,     setTableErr]     = useState(false);
  const [, tick]                        = useState(0);
  const mountRef = useRef(true);

  useEffect(() => {
    const h = () => setShowAdd(true);
    document.addEventListener("dm:addStory", h);
    return () => document.removeEventListener("dm:addStory", h);
  }, []);

  useEffect(() => {
    const t = setInterval(() => tick(n => n + 1), 60_000);
    return () => clearInterval(t);
  }, []);

  /* ── Load statuses ── */
  const loadStatuses = useCallback(async () => {
    if (!currentUser?.id) return;
    try {
      let data = null;

      try {
        const { data: d, error: e } = await supabase
          .from("status_updates")
          .select(`id,text,bg,text_color,image_id,media_type,duration_h,views,likes,created_at,expires_at,user_id,
            profile:profiles!status_updates_user_id_fkey(id,full_name,username,avatar_id,verified)`)
          .gt("expires_at", new Date().toISOString())
          .order("created_at", { ascending: false });

        if (e) {
          if (e.code === "42P01" || (e.message?.includes("relation") && e.message?.includes("does not exist"))) {
            if (mountRef.current) { setTableErr(true); setLoading(false); }
            return;
          }
          throw e;
        }
        data = d;
      } catch (columnErr) {
        const { data: d2, error: e2 } = await supabase
          .from("status_updates")
          .select(`id,text,bg,text_color,image_id,duration_h,views,likes,created_at,expires_at,user_id,
            profile:profiles!status_updates_user_id_fkey(id,full_name,username,avatar_id,verified)`)
          .gt("expires_at", new Date().toISOString())
          .order("created_at", { ascending: false });

        if (e2) {
          if (e2.code === "42P01" || e2.message?.includes("does not exist")) {
            if (mountRef.current) { setTableErr(true); setLoading(false); }
            return;
          }
          throw e2;
        }
        data = (d2 || []).map(s => ({ ...s, media_type: s.image_id ? "image" : "text" }));
      }

      if (!mountRef.current) return;

      const enriched = (data || []).map(s => ({
        ...s,
        media_type: s.media_type || (s.image_id ? "image" : "text"),
      }));

      setMyStories(enriched.filter(s => s.user_id === currentUser.id));
      setOtherStories(enriched.filter(s => s.user_id !== currentUser.id));

      if (enriched.length > 0) {
        const { data: likeRows } = await supabase
          .from("status_likes").select("status_id")
          .eq("user_id", currentUser.id)
          .in("status_id", enriched.map(s => s.id));
        if (mountRef.current && likeRows) {
          setLikedIds(new Set(likeRows.map(l => l.status_id)));
        }
      }
    } catch (err) {
      console.error("[UpdatesView] load:", err);
    } finally {
      if (mountRef.current) setLoading(false);
    }
  }, [currentUser?.id]);

  useEffect(() => {
    mountRef.current = true;
    setLoading(true);
    loadStatuses();
    return () => { mountRef.current = false; };
  }, [loadStatuses]);

  useEffect(() => {
    if (!currentUser?.id || tableErr) return;
    const ch = supabase.channel("su_rt_v9")
      .on("postgres_changes", { event: "*", schema: "public", table: "status_updates" }, () => {
        if (mountRef.current) loadStatuses();
      }).subscribe();
    return () => supabase.removeChannel(ch);
  }, [currentUser?.id, tableErr, loadStatuses]);

  /* ── Like / Unlike ── */
  const handleLike = useCallback(async (sid, isLiked) => {
    if (!currentUser?.id) return;
    setLikedIds(prev => { const n = new Set(prev); isLiked ? n.delete(sid) : n.add(sid); return n; });
    try {
      if (isLiked) {
        await supabase.from("status_likes").delete().eq("status_id", sid).eq("user_id", currentUser.id);
        // [FIX-RPC] Use await + try/catch instead of bare .catch() on rpc PromiseLike
        try {
          await supabase.rpc("increment_status_likes", { p_status_id: sid, p_delta: -1 });
        } catch (_) { /* non-fatal — view count still updated via DB */ }
      } else {
        try {
          await supabase.from("status_likes").insert({ status_id: sid, user_id: currentUser.id });
        } catch (_) { /* ignore duplicate */ }
        try {
          await supabase.rpc("increment_status_likes", { p_status_id: sid, p_delta: 1 });
        } catch (_) { /* non-fatal */ }
      }
    } catch {
      // Rollback optimistic update on failure
      setLikedIds(prev => { const n = new Set(prev); isLiked ? n.add(sid) : n.delete(sid); return n; });
    }
  }, [currentUser?.id]);

  /* ── Extend ── */
  const handleExtend = useCallback(async (sid, hours) => {
    const found = [...myStories, ...otherStories].find(s => s.id === sid);
    if (!found) return;
    const base   = new Date(Math.max(new Date(found.expires_at), Date.now()));
    const newExp = new Date(base.getTime() + hours * 3_600_000).toISOString();
    try {
      await supabase.from("status_updates").update({ expires_at: newExp }).eq("id", sid).eq("user_id", currentUser.id);
      loadStatuses();
    } catch (e) { console.error("[UpdatesView] extend:", e); }
  }, [myStories, otherStories, currentUser?.id, loadStatuses]);

  /* ── Delete ── */
  const handleDelete = useCallback(async sid => {
    const target = myStories.find(s => s.id === sid);
    setMyStories(prev => prev.filter(s => s.id !== sid));
    try {
      await supabase.from("status_updates").delete().eq("id", sid).eq("user_id", currentUser.id);
      if (target?.image_id) {
        // [FIX-RPC] storage.remove returns a PromiseLike — wrap in try/catch
        try {
          await supabase.storage.from(BUCKET).remove([target.image_id]);
        } catch (_) { /* non-fatal */ }
      }
    } catch (e) {
      console.error("[UpdatesView] delete:", e);
      loadStatuses();
    }
  }, [myStories, currentUser?.id, loadStatuses]);

  /* ── Record view ── */
  // [FIX-RPC] recordView now uses await inside try/catch — no bare .catch()
  const recordView = useCallback(async sid => {
    try {
      await supabase.rpc("increment_status_views", { p_status_id: sid });
    } catch (_) { /* non-fatal — view count best-effort */ }
  }, []);

  const openViewer = useCallback((list, startIdx = 0) => {
    setViewer({ stories: list, startIdx });
    // [FIX-RPC] forEach with async — each rpc call is properly awaited
    // inside its own try/catch so one failure doesn't stop others.
    list.forEach(async s => {
      if (s.user_id !== currentUser?.id) {
        await recordView(s.id);
      }
    });
  }, [currentUser?.id, recordView]);

  /* Group others by user */
  const grouped = otherStories.reduce((acc, s) => {
    if (!acc[s.user_id]) acc[s.user_id] = [];
    acc[s.user_id].push(s);
    return acc;
  }, {});

  const todayCount = myStories.filter(s => Date.now() - new Date(s.created_at) < 86_400_000).length;
  const currentUserForDisplay = {
    ...currentUser,
    full_name: currentUser?.fullName || currentUser?.full_name || currentUser?.name,
    avatar_id: currentUser?.avatarId || currentUser?.avatar_id,
  };

  if (loading) return (
    <div className="upd-root">
      <div className="upd-loading">
        {[0,1,2,3].map(i => <div key={i} className="upd-skel" style={{ animationDelay: `${i * 0.1}s` }}/>)}
      </div>
      <style>{CSS}</style>
    </div>
  );

  if (tableErr) return (
    <div className="upd-root">
      <div className="upd-setup">
        <div className="upd-setup-icon">🛠️</div>
        <h3 className="upd-setup-title">Status Updates Need Setup</h3>
        <p className="upd-setup-text">Run this in your Supabase SQL editor:</p>
        <pre className="upd-setup-sql">{`CREATE TABLE IF NOT EXISTS public.status_updates (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES public.profiles(id),
  text text,
  bg text,
  text_color text DEFAULT '#ffffff',
  image_id text,
  media_type text DEFAULT 'text',
  duration_h integer DEFAULT 24,
  views integer DEFAULT 0,
  likes integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  expires_at timestamptz DEFAULT (now() + interval '24 hours')
);

-- If table exists but missing media_type column:
ALTER TABLE public.status_updates
  ADD COLUMN IF NOT EXISTS media_type text DEFAULT 'text';

-- RLS
ALTER TABLE public.status_updates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "su_read"   ON public.status_updates FOR SELECT USING (expires_at > now());
CREATE POLICY "su_insert" ON public.status_updates FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "su_update" ON public.status_updates FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "su_delete" ON public.status_updates FOR DELETE USING (auth.uid() = user_id);

-- RPCs
CREATE OR REPLACE FUNCTION increment_status_likes(p_status_id uuid, p_delta int)
RETURNS void LANGUAGE sql AS $$ UPDATE status_updates SET likes = GREATEST(0, likes + p_delta) WHERE id = p_status_id; $$;

CREATE OR REPLACE FUNCTION increment_status_views(p_status_id uuid)
RETURNS void LANGUAGE sql AS $$ UPDATE status_updates SET views = views + 1 WHERE id = p_status_id; $$;`}</pre>
        <button className="upd-retry-btn" onClick={() => { setTableErr(false); setLoading(true); loadStatuses(); }}>Retry</button>
      </div>
      <style>{CSS}</style>
    </div>
  );

  return (
    <div className="upd-root">

      {/* ── My status row ── */}
      <div className="my-row">
        <div className="my-row-left" onClick={() => myStories.length > 0 ? openViewer(myStories) : setShowAdd(true)}>
          <div className="my-av-wrap">
            <UAv user={currentUserForDisplay} size={50} ring={myStories.length > 0}/>
            <button className="my-add-btn" title="Add status"
              onClick={e => { e.stopPropagation(); setShowAdd(true); }}>
              <Ic.Plus/>
            </button>
          </div>
          <div className="my-info">
            <div className="my-name">My Status</div>
            <div className="my-sub">
              {myStories.length > 0 ? `${myStories.length} active · tap to view` : "Tap + to add your status"}
            </div>
          </div>
        </div>
        {myStories.length > 0 && <span className="my-badge">{myStories.length}</span>}
      </div>

      {/* ── My status cards ── */}
      {myStories.length > 0 && (
        <div className="my-cards-scroll">
          {myStories.map(s => {
            const mu = getMediaUrl(s.image_id);
            return (
              <div key={s.id} className="my-card" onClick={() => openViewer([s])}>
                <div className="my-card-thumb" style={s.bg ? { background: s.bg } : { background: "#0d1117" }}>
                  {mu && s.media_type === "image" && <img src={mu} alt="" className="my-card-thumb-img"/>}
                  {mu && s.media_type === "video" && <video src={mu} muted autoPlay loop playsInline className="my-card-thumb-img"/>}
                  {s.text && <span className="my-card-thumb-text" style={{ color: s.text_color || "#fff" }}>{s.text.slice(0, 40)}</span>}
                  <div className="my-card-thumb-overlay"/>
                </div>
                <div className="my-card-footer">
                  <div className="my-card-meta">
                    <span><Ic.Clock/> {fmtCountdown(s.expires_at)}</span>
                    <span><Ic.Eye/> {s.views || 0}</span>
                  </div>
                  <div className="my-card-actions">
                    {isNearExp(s.expires_at) && (
                      <button className="my-extend-btn" title="Extend" onClick={e => { e.stopPropagation(); setExtTarget(s); }}>
                        +time
                      </button>
                    )}
                    <button className="my-del-btn" title="Delete" onClick={e => { e.stopPropagation(); handleDelete(s.id); }}>
                      <Ic.Trash/>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Others bubble strip ── */}
      {Object.keys(grouped).length > 0 && (
        <div className="others-section">
          <div className="others-label">Recent Updates</div>
          <div className="bubbles-row">
            {Object.entries(grouped).map(([uid, statuses]) => {
              const first  = statuses[0];
              const anyExp = statuses.some(s => isNearExp(s.expires_at));
              return (
                <button key={uid} className="bubble-item" onClick={() => openViewer(statuses)}>
                  <div className={`bubble-ring${anyExp ? " bubble-warn" : ""}`}>
                    <UAv user={first.profile} size={50} ring/>
                  </div>
                  <span className="bubble-name">{(first.profile?.full_name || "").split(" ")[0]}</span>
                  {statuses.length > 1 && <span className="bubble-count">{statuses.length}</span>}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Contact list view ── */}
      {Object.keys(grouped).length > 0 && (
        <div className="contacts-section">
          {Object.entries(grouped).map(([uid, statuses]) => {
            const first  = statuses[0];
            const anyExp = statuses.some(s => isNearExp(s.expires_at));
            const mu     = getMediaUrl(first.image_id);
            return (
              <div key={uid} className="contact-row" onClick={() => openViewer(statuses)}>
                <div className={`contact-av-wrap${anyExp ? " contact-av-warn" : ""}`}>
                  <UAv user={first.profile} size={46} ring/>
                </div>
                <div className="contact-info">
                  <div className="contact-name">
                    {first.profile?.full_name || "Unknown"}
                    {first.profile?.verified && <Ic.Verified/>}
                  </div>
                  <div className="contact-preview">
                    {first.media_type === "video" ? "🎥 Video" : first.media_type === "image" ? "📷 Photo" : first.text?.slice(0, 50) || "Status"}
                    &nbsp;·&nbsp;
                    {fmtRel(first.created_at)}
                  </div>
                </div>
                {statuses.length > 1 && (
                  <div className="contact-count-badge">{statuses.length}</div>
                )}
                {first.media_type === "image" && mu && (
                  <div className="contact-thumb"><img src={mu} alt=""/></div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── Empty state ── */}
      {myStories.length === 0 && Object.keys(grouped).length === 0 && (
        <div className="upd-empty">
          <div className="upd-empty-icon">📡</div>
          <h3 className="upd-empty-title">No updates yet</h3>
          <p className="upd-empty-sub">Share a photo, video or text that disappears in up to 24h</p>
          <button className="upd-cta-btn" onClick={() => setShowAdd(true)}>
            <Ic.Plus/> Create Your First Status
          </button>
        </div>
      )}

      {/* ── VIEWER ── */}
      {viewer && (
        <div className="viewer-wrap">
          <StoryViewer
            stories={viewer.stories}
            startIndex={viewer.startIdx}
            currentUser={currentUser}
            onClose={() => setViewer(null)}
            onReplyAsDM={onReplyAsDM}
            onLike={handleLike}
            likedIds={likedIds}
          />
        </div>
      )}

      {/* ── ADD STATUS MODAL ── */}
      {showAdd && (
        <AddStatusModal
          currentUser={currentUser}
          onClose={() => setShowAdd(false)}
          onAdded={loadStatuses}
          todayCount={todayCount}
        />
      )}

      {/* ── EXTEND MODAL ── */}
      {extTarget && (
        <ExtendModal
          story={extTarget}
          onExtend={handleExtend}
          onClose={() => setExtTarget(null)}
        />
      )}

      <style>{CSS}</style>
    </div>
  );
};

/* ════════════════════════════════════════════════════
   STYLES
════════════════════════════════════════════════════ */
const CSS = `
.upd-root { display:flex;flex-direction:column;height:100%;overflow-y:auto;background:#000;-webkit-overflow-scrolling:touch; }
.upd-root::-webkit-scrollbar { width:3px; }
.upd-root::-webkit-scrollbar-thumb { background:rgba(132,204,22,.2);border-radius:2px; }
.upd-loading { padding:20px;display:flex;flex-direction:column;gap:14px; }
.upd-skel { height:64px;border-radius:14px;background:linear-gradient(90deg,rgba(255,255,255,.03) 0%,rgba(255,255,255,.07) 50%,rgba(255,255,255,.03) 100%);background-size:200% 100%;animation:skelShimmer 1.4s infinite; }
@keyframes skelShimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }
.upd-setup { display:flex;flex-direction:column;align-items:center;gap:14px;padding:28px 20px;height:100%;justify-content:center; }
.upd-setup-icon { font-size:52px; }
.upd-setup-title { font-size:18px;font-weight:800;color:#fff;text-align:center;margin:0; }
.upd-setup-text { font-size:13px;color:#666;text-align:center;margin:0; }
.upd-setup-sql { background:#0a0a0a;border:1px solid rgba(132,204,22,.15);border-radius:12px;padding:14px;font-size:10px;color:#84cc16;overflow-x:auto;white-space:pre;max-width:100%;box-sizing:border-box;max-height:200px;overflow-y:auto; }
.upd-retry-btn { margin-top:8px;padding:10px 24px;border-radius:12px;background:rgba(132,204,22,.12);border:1px solid rgba(132,204,22,.3);color:#84cc16;font-size:14px;font-weight:700;cursor:pointer;transition:background .15s; }
.upd-retry-btn:hover { background:rgba(132,204,22,.2); }
.upd-av { display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,#1a1a1a,#222);border:2px solid rgba(255,255,255,.08);flex-shrink:0;font-weight:800;color:#84cc16; }
.upd-av.upd-av-ring { border:2.5px solid var(--ring-color,#84cc16);box-shadow:0 0 0 2px rgba(132,204,22,.15); }
.my-row { display:flex;align-items:center;justify-content:space-between;padding:14px 16px;border-bottom:1px solid rgba(255,255,255,.04);flex-shrink:0; }
.my-row-left { display:flex;align-items:center;gap:12px;cursor:pointer;flex:1;min-width:0; }
.my-av-wrap { position:relative;flex-shrink:0; }
.my-add-btn { position:absolute;bottom:-2px;right:-2px;width:22px;height:22px;border-radius:50%;background:#84cc16;border:2px solid #000;display:flex;align-items:center;justify-content:center;cursor:pointer;color:#000; }
.my-add-btn svg { width:11px;height:11px;stroke-width:3; }
.my-info { flex:1;min-width:0; }
.my-name { font-size:14px;font-weight:700;color:#fff; }
.my-sub { font-size:12px;color:#555;margin-top:2px; }
.my-badge { min-width:22px;height:22px;border-radius:11px;padding:0 6px;background:rgba(132,204,22,.15);border:1px solid rgba(132,204,22,.3);color:#84cc16;font-size:11px;font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0; }
.my-cards-scroll { display:flex;gap:10px;padding:10px 16px;overflow-x:auto;-webkit-overflow-scrolling:touch;flex-shrink:0; }
.my-cards-scroll::-webkit-scrollbar { height:0; }
.my-card { width:100px;flex-shrink:0;border-radius:16px;overflow:hidden;border:1px solid rgba(255,255,255,.08);background:#0d0d0d;cursor:pointer;transition:transform .15s; }
.my-card:hover { transform:translateY(-2px); }
.my-card-thumb { position:relative;height:140px;display:flex;align-items:center;justify-content:center;overflow:hidden; }
.my-card-thumb-img { position:absolute;inset:0;width:100%;height:100%;object-fit:cover; }
.my-card-thumb-text { position:relative;z-index:1;font-size:11px;font-weight:700;text-align:center;padding:6px;word-break:break-word;line-height:1.3; }
.my-card-thumb-overlay { position:absolute;inset:0;background:linear-gradient(to top,rgba(0,0,0,.5),transparent); }
.my-card-footer { padding:7px 8px;background:#0a0a0a; }
.my-card-meta { display:flex;justify-content:space-between;font-size:9px;color:#555;margin-bottom:5px; }
.my-card-meta span { display:flex;align-items:center;gap:2px; }
.my-card-actions { display:flex;justify-content:flex-end;gap:5px; }
.my-extend-btn { padding:2px 6px;border-radius:6px;background:rgba(245,158,11,.12);border:1px solid rgba(245,158,11,.3);color:#f59e0b;font-size:9px;font-weight:700;cursor:pointer; }
.my-del-btn { width:22px;height:22px;border-radius:6px;background:rgba(239,68,68,.08);border:1px solid rgba(239,68,68,.18);display:flex;align-items:center;justify-content:center;cursor:pointer; }
.others-section { padding:12px 16px 4px;flex-shrink:0; }
.others-label { font-size:10px;font-weight:700;color:#444;text-transform:uppercase;letter-spacing:.8px;margin-bottom:10px; }
.bubbles-row { display:flex;gap:12px;overflow-x:auto;-webkit-overflow-scrolling:touch;padding-bottom:4px; }
.bubbles-row::-webkit-scrollbar { height:0; }
.bubble-item { display:flex;flex-direction:column;align-items:center;gap:5px;cursor:pointer;position:relative;background:none;border:none;flex-shrink:0; }
.bubble-ring { padding:2.5px;border-radius:50%;border:2.5px solid #84cc16; }
.bubble-warn { border-color:#f59e0b; }
.bubble-name { font-size:10px;color:#aaa;font-weight:600;white-space:nowrap;max-width:56px;overflow:hidden;text-overflow:ellipsis;text-align:center; }
.bubble-count { position:absolute;top:0;right:-4px;min-width:16px;height:16px;border-radius:8px;padding:0 3px;background:#84cc16;color:#000;font-size:9px;font-weight:800;display:flex;align-items:center;justify-content:center;border:1.5px solid #000; }
.contacts-section { margin-top:4px; }
.contact-row { display:flex;align-items:center;gap:12px;padding:11px 16px;border-bottom:1px solid rgba(255,255,255,.04);cursor:pointer;transition:background .15s; }
.contact-row:hover { background:rgba(255,255,255,.02); }
.contact-av-wrap { flex-shrink:0; }
.contact-av-warn .upd-av { border-color:#f59e0b;box-shadow:0 0 0 2px rgba(245,158,11,.15); }
.contact-info { flex:1;min-width:0; }
.contact-name { font-size:14px;font-weight:700;color:#fff;display:flex;align-items:center;gap:4px; }
.contact-preview { font-size:12px;color:#555;margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis; }
.contact-count-badge { min-width:22px;height:22px;border-radius:11px;padding:0 5px;background:rgba(132,204,22,.1);border:1px solid rgba(132,204,22,.25);color:#84cc16;font-size:11px;font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0; }
.contact-thumb { width:42px;height:42px;border-radius:10px;overflow:hidden;flex-shrink:0; }
.contact-thumb img { width:100%;height:100%;object-fit:cover; }
.upd-empty { display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;padding:60px 24px;flex:1; }
.upd-empty-icon { font-size:56px; }
.upd-empty-title { font-size:20px;font-weight:800;color:#fff;text-align:center;margin:0; }
.upd-empty-sub { font-size:13px;color:#555;text-align:center;max-width:280px;line-height:1.5;margin:0; }
.upd-cta-btn { display:flex;align-items:center;gap:8px;padding:13px 24px;border-radius:16px;background:linear-gradient(135deg,rgba(132,204,22,.2),rgba(101,163,13,.14));border:1px solid rgba(132,204,22,.35);color:#84cc16;font-size:14px;font-weight:700;cursor:pointer;transition:all .15s;margin-top:8px; }
.upd-cta-btn:hover { background:linear-gradient(135deg,rgba(132,204,22,.3),rgba(101,163,13,.22));transform:translateY(-1px); }
.upd-cta-btn:active { transform:scale(.97); }
.viewer-wrap { position:fixed;inset:0;z-index:20000;background:#000; }
.sv-root { position:relative;width:100%;height:100%;display:flex;flex-direction:column;overflow:hidden; }
.sv-bars { display:flex;gap:3px;padding:calc(env(safe-area-inset-top,0px)+10px) 12px 10px;position:absolute;top:0;left:0;right:0;z-index:10; }
.sv-bar-track { flex:1;height:2.5px;border-radius:1.5px;background:rgba(255,255,255,.25);overflow:hidden; }
.sv-bar-fill { height:100%;border-radius:1.5px;background:#fff;transition:width .1s linear; }
.sv-head { position:absolute;top:calc(env(safe-area-inset-top,0px)+22px);left:0;right:0;z-index:10;display:flex;align-items:center;gap:10px;padding:6px 14px; }
.sv-head-info { flex:1;min-width:0; }
.sv-uname { font-size:13px;font-weight:700;color:#fff;display:flex;align-items:center;gap:4px; }
.sv-umeta { font-size:11px;color:rgba(255,255,255,.55);display:flex;align-items:center;gap:4px;margin-top:1px; }
.sv-expiring { color:#f59e0b;font-weight:600; }
.sv-head-right { display:flex;align-items:center;gap:6px; }
.sv-hbtn { width:32px;height:32px;border-radius:50%;background:rgba(0,0,0,.5);border:none;display:flex;align-items:center;justify-content:center;color:#fff;cursor:pointer;flex-shrink:0; }
.sv-content { flex:1;display:flex;align-items:center;justify-content:center;overflow:hidden; }
.sv-text { font-size:clamp(18px,5vw,28px);font-weight:800;color:#fff;text-align:center;padding:24px;line-height:1.35;opacity:0;transform:translateY(8px);transition:opacity .25s,transform .25s;word-break:break-word; }
.sv-text.sv-text-in { opacity:1;transform:translateY(0); }
.sv-text.sv-text-ov { position:absolute;bottom:80px;left:0;right:0;padding:16px;background:linear-gradient(to top,rgba(0,0,0,.7),transparent);font-size:clamp(14px,3vw,20px); }
.sv-tap-prev,.sv-tap-next { position:absolute;top:80px;bottom:120px;width:40%;z-index:5; }
.sv-tap-prev { left:0; }
.sv-tap-next { right:0; }
.sv-bottom { position:absolute;bottom:0;left:0;right:0;z-index:10;padding:12px 14px calc(env(safe-area-inset-bottom,0px)+16px);background:linear-gradient(to top,rgba(0,0,0,.85),transparent); }
.sv-rep-sent { display:flex;align-items:center;gap:6px;color:#84cc16;font-size:13px;font-weight:600;justify-content:center;padding:8px 0; }
.sv-rep-row { display:flex;align-items:center;gap:8px; }
.sv-rep-inp { flex:1;background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.15);border-radius:24px;padding:10px 16px;color:#fff;font-size:14px;outline:none;caret-color:#84cc16; }
.sv-rep-inp:focus { border-color:rgba(132,204,22,.4); }
.sv-send-btn { width:40px;height:40px;border-radius:50%;background:rgba(132,204,22,.2);border:1px solid rgba(132,204,22,.4);color:#84cc16;display:flex;align-items:center;justify-content:center;cursor:pointer;flex-shrink:0; }
.sv-send-btn:disabled { opacity:.4; }
.sv-btm-row { display:flex;align-items:center;gap:10px;justify-content:center; }
.sv-action-btn { display:flex;align-items:center;gap:6px;padding:9px 18px;border-radius:24px;background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.15);color:#fff;font-size:13px;font-weight:600;cursor:pointer;transition:background .15s; }
.sv-action-btn:hover { background:rgba(255,255,255,.18); }
.sv-liked { background:rgba(239,68,68,.15)!important;border-color:rgba(239,68,68,.35)!important;color:#ef4444!important; }
.sv-stats { display:flex;align-items:center;gap:12px;font-size:12px;color:rgba(255,255,255,.55); }
.sv-stats span { display:flex;align-items:center;gap:4px; }
.sv-spinner { width:16px;height:16px;border:2px solid rgba(255,255,255,.2);border-top-color:#fff;border-radius:50%;animation:svSpin .7s linear infinite; }
@keyframes svSpin { to{transform:rotate(360deg)} }
.ms-header { display:flex;align-items:center;justify-content:space-between;padding:14px 18px 10px;flex-shrink:0; }
.ms-title { font-size:15px;font-weight:800;color:#fff;flex:1;text-align:center; }
.ms-back { background:none;border:none;color:#84cc16;font-size:13px;font-weight:700;cursor:pointer; }
.ms-close { width:30px;height:30px;border-radius:8px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.07);display:flex;align-items:center;justify-content:center;cursor:pointer;color:#555; }
.ms-body { padding:0 18px 20px;display:flex;flex-direction:column;gap:14px;overflow-y:auto;flex:1; }
.ms-drop { border:1.5px dashed rgba(132,204,22,.2);border-radius:18px;padding:32px 20px;display:flex;flex-direction:column;align-items:center;gap:10px;cursor:pointer;transition:border-color .2s,background .2s;background:rgba(132,204,22,.02); }
.ms-drop:hover,.ms-drag-over { border-color:rgba(132,204,22,.5);background:rgba(132,204,22,.06); }
.ms-drop-icon { width:64px;height:64px;border-radius:50%;background:rgba(132,204,22,.08);border:1px solid rgba(132,204,22,.2);display:flex;align-items:center;justify-content:center;color:#84cc16; }
.ms-drop-title { font-size:15px;font-weight:700;color:#fff;margin:0;text-align:center; }
.ms-drop-sub { font-size:12px;color:#555;margin:0;text-align:center; }
.ms-badges { display:flex;flex-wrap:wrap;gap:5px;justify-content:center; }
.ms-badge { padding:3px 8px;border-radius:6px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.08);color:#666;font-size:10px;font-weight:700;letter-spacing:.5px; }
.ms-limits { font-size:11px;color:#333;margin:0;text-align:center; }
.ms-err { padding:10px 14px;border-radius:10px;background:rgba(239,68,68,.1);border:1px solid rgba(239,68,68,.25);color:#ef4444;font-size:13px;font-weight:600; }
.ms-prog-wrap { display:flex;flex-direction:column;gap:6px; }
.ms-prog-bar { height:4px;border-radius:2px;background:rgba(255,255,255,.08);overflow:hidden; }
.ms-prog-fill { height:100%;background:linear-gradient(90deg,#84cc16,#a3e635);border-radius:2px;transition:width .3s; }
.ms-prog-label { font-size:12px;color:#84cc16;font-weight:600;text-align:center; }
.ms-prev-wrap { display:flex;flex-direction:column;align-items:center;gap:10px; }
.ms-prev-media { max-width:100%;max-height:240px;border-radius:14px;display:block; }
.ms-change { padding:7px 18px;border-radius:10px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);color:#aaa;font-size:13px;font-weight:600;cursor:pointer; }
.modal-ov { position:fixed;inset:0;z-index:20001;background:rgba(0,0,0,.8);display:flex;align-items:flex-end;backdrop-filter:blur(4px); }
.modal-sheet { width:100%;max-height:92vh;background:#080808;border:1px solid rgba(132,204,22,.12);border-radius:22px 22px 0 0;overflow:hidden;display:flex;flex-direction:column;animation:msUp .3s cubic-bezier(.34,1.4,.64,1); }
@keyframes msUp { from{transform:translateY(100%)} to{transform:translateY(0)} }
.modal-pill { width:36px;height:4px;border-radius:2px;background:rgba(255,255,255,.1);margin:12px auto 0;flex-shrink:0; }
.modal-hdr { display:flex;align-items:center;justify-content:space-between;padding:14px 18px 10px;flex-shrink:0; }
.modal-title { font-size:17px;font-weight:800;color:#fff;margin:0; }
.modal-title-c { flex:1;text-align:center; }
.modal-sub { font-size:12px;color:#555;margin:4px 0 0; }
.modal-close { width:32px;height:32px;border-radius:10px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.06);display:flex;align-items:center;justify-content:center;cursor:pointer;color:#555; }
.modal-back { background:none;border:none;color:#84cc16;font-size:13px;font-weight:700;cursor:pointer; }
.pick-grid { display:flex;flex-direction:column;gap:8px;padding:8px 18px 20px;overflow-y:auto; }
.pick-card { display:flex;align-items:center;gap:14px;padding:16px;border-radius:16px;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.07);cursor:pointer;text-align:left;transition:background .15s,border-color .15s;width:100%; }
.pick-card:hover { background:rgba(255,255,255,.06);border-color:rgba(132,204,22,.25); }
.pick-icon { width:46px;height:46px;border-radius:14px;display:flex;align-items:center;justify-content:center;flex-shrink:0; }
.pick-icon-text  { background:rgba(132,204,22,.1);border:1px solid rgba(132,204,22,.2);color:#84cc16; }
.pick-icon-photo { background:rgba(96,165,250,.1);border:1px solid rgba(96,165,250,.2);color:#60a5fa; }
.pick-icon-video { background:rgba(192,132,252,.1);border:1px solid rgba(192,132,252,.2);color:#c084fc; }
.pick-info { flex:1;min-width:0; }
.pick-label { display:block;font-size:15px;font-weight:700;color:#fff;margin-bottom:3px; }
.pick-desc { display:block;font-size:12px;color:#555; }
.pick-arrow { color:#333;font-size:16px;flex-shrink:0; }
.compose-preview { height:180px;margin:0 18px;border-radius:16px;display:flex;align-items:center;justify-content:center;overflow:hidden;position:relative;flex-shrink:0; }
.compose-overlay-text { position:absolute;bottom:0;left:0;right:0;padding:14px;font-size:14px;font-weight:700;text-align:center;background:linear-gradient(to top,rgba(0,0,0,.7),transparent);word-break:break-word; }
.compose-placeholder { font-size:14px;color:rgba(255,255,255,.2);text-align:center;padding:0 20px;font-style:italic; }
.compose-inp-wrap { display:flex;align-items:flex-start;gap:8px;padding:10px 18px;flex-shrink:0; }
.compose-textarea { flex:1;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);border-radius:14px;color:#fff;font-size:14px;padding:12px 14px;resize:none;outline:none;caret-color:#84cc16;min-height:72px;line-height:1.5; }
.compose-textarea:focus { border-color:rgba(132,204,22,.3); }
.compose-textarea::placeholder { color:#333; }
.compose-char { display:flex;flex-direction:column;align-items:center;gap:3px;flex-shrink:0; }
.compose-section-lbl { font-size:10px;font-weight:700;color:#333;text-transform:uppercase;letter-spacing:.8px;padding:4px 18px 6px;flex-shrink:0; }
.bg-row { display:flex;gap:8px;padding:0 18px 10px;overflow-x:auto;flex-shrink:0; }
.bg-row::-webkit-scrollbar { height:0; }
.bg-sw { width:38px;height:38px;border-radius:10px;border:2px solid transparent;display:flex;align-items:center;justify-content:center;cursor:pointer;flex-shrink:0;transition:transform .15s; }
.bg-sw:hover { transform:scale(1.08); }
.bg-sw.bg-sw-on { border-color:#fff;box-shadow:0 0 0 2px rgba(132,204,22,.4); }
.bg-sw svg { color:#fff;filter:drop-shadow(0 1px 2px rgba(0,0,0,.6)); }
.bg-page { width:38px;height:38px;border-radius:10px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);color:#666;font-size:16px;display:flex;align-items:center;justify-content:center;cursor:pointer;flex-shrink:0; }
.color-row { display:flex;gap:8px;padding:0 18px 12px;overflow-x:auto;flex-shrink:0; }
.color-row::-webkit-scrollbar { height:0; }
.color-dot { width:28px;height:28px;border-radius:50%;border:2px solid rgba(255,255,255,.1);cursor:pointer;flex-shrink:0;transition:transform .15s; }
.color-dot:hover { transform:scale(1.12); }
.color-dot.color-dot-on { border-color:#fff;box-shadow:0 0 0 3px rgba(132,204,22,.4); }
.compose-cta { margin:8px 18px 18px;padding:14px;border-radius:16px;background:linear-gradient(135deg,rgba(132,204,22,.2),rgba(101,163,13,.14));border:1px solid rgba(132,204,22,.35);color:#84cc16;font-size:15px;font-weight:700;cursor:pointer;transition:all .15s;display:block;width:calc(100% - 36px); }
.compose-cta:hover { background:linear-gradient(135deg,rgba(132,204,22,.28),rgba(101,163,13,.2)); }
.compose-cta:disabled { opacity:.35;cursor:not-allowed; }
.dur-preview { height:130px;margin:0 18px;border-radius:16px;display:flex;align-items:center;justify-content:center;overflow:hidden;flex-shrink:0; }
.dur-hint { font-size:13px;color:#555;text-align:center;padding:10px 24px 4px;margin:0;flex-shrink:0; }
.dur-cards { display:flex;flex-direction:column;gap:8px;padding:4px 18px;flex:1;overflow-y:auto; }
.dur-card { display:flex;align-items:center;gap:14px;padding:14px 16px;border-radius:14px;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.07);cursor:pointer;text-align:left;transition:background .15s,border-color .15s;position:relative;width:100%; }
.dur-card:hover { background:rgba(255,255,255,.05); }
.dur-on { background:rgba(132,204,22,.08)!important;border-color:rgba(132,204,22,.35)!important; }
.dur-time { font-size:18px;font-weight:800;color:#fff;min-width:42px; }
.dur-card.dur-on .dur-time { color:#84cc16; }
.dur-desc { font-size:12px;color:#555;flex:1; }
.dur-check { position:absolute;right:14px;top:50%;transform:translateY(-50%);width:24px;height:24px;border-radius:50%;background:#84cc16;display:flex;align-items:center;justify-content:center;color:#000; }
.dur-expiry { display:flex;align-items:center;gap:6px;font-size:11px;color:#444;padding:8px 18px;flex-shrink:0; }
.share-btn { display:flex;align-items:center;justify-content:center;gap:10px;margin:10px 18px 20px;padding:15px;border-radius:16px;background:linear-gradient(135deg,#84cc16,#65a30d);border:none;color:#000;font-size:15px;font-weight:800;cursor:pointer;transition:all .15s; }
.share-btn:hover { transform:translateY(-1px);box-shadow:0 6px 20px rgba(132,204,22,.35); }
.share-btn:active { transform:scale(.98); }
.share-btn.saving { opacity:.65;cursor:not-allowed; }
.share-btn:disabled { opacity:.35;cursor:not-allowed; }
.extend-box { background:#0d0d0d;border:1px solid rgba(245,158,11,.2);border-radius:18px 18px 0 0;padding:0 0 calc(env(safe-area-inset-bottom,0px)+16px);width:100%;animation:msUp .25s cubic-bezier(.34,1.4,.64,1); }
.extend-hd { display:flex;align-items:center;justify-content:space-between;padding:16px 18px 8px;font-size:16px;font-weight:800;color:#fff; }
.extend-cur { font-size:13px;color:#666;padding:0 18px 10px;margin:0; }
.extend-opt { display:block;width:100%;padding:13px 18px;background:rgba(245,158,11,.06);border:none;border-bottom:1px solid rgba(255,255,255,.04);color:#f59e0b;font-size:15px;font-weight:700;text-align:left;cursor:pointer;transition:background .15s; }
.extend-opt:hover { background:rgba(245,158,11,.12); }
.extend-opt:last-child { border-bottom:none; }
`;

export default UpdatesView;