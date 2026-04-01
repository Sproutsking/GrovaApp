// components/Messages/UpdatesView.jsx
// ============================================================================
// GROVA STATUS UPDATES — EXTRAORDINARY EDITION v5
// ============================================================================
// ✅ Zero mock data. All data from Supabase.
// ✅ Full CRUD: create, read, like, delete, extend
// ✅ Real-time subscriptions via Supabase channel
// ✅ Story viewer with progress bars, gestures, replies
// ✅ Completely redesigned Add Status modal — beautiful, clear, structured
// ✅ Data efficiency: optimistic UI everywhere
// ============================================================================

import React, { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "../../services/config/supabase";
import mediaUrlService from "../../services/shared/mediaUrlService";

/* ─── Helpers ─── */
const fmtRelative = (iso) => {
  if (!iso) return "";
  const ms = Date.now() - new Date(iso);
  if (ms < 60000)    return "just now";
  if (ms < 3600000)  return `${Math.floor(ms / 60000)}m ago`;
  if (ms < 86400000) return `${Math.floor(ms / 3600000)}h ago`;
  return `${Math.floor(ms / 86400000)}d ago`;
};

const fmtCountdown = (exp) => {
  const ms = new Date(exp) - Date.now();
  if (ms <= 0) return "expired";
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
};

const isNearExpiry = (exp) => {
  const ms = new Date(exp) - Date.now();
  return ms > 0 && ms < 3600000;
};

const getInitial = (name) => (name || "?").charAt(0).toUpperCase();

/* ─── ICONS ─── */
const Ic = {
  Camera: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/>
      <circle cx="12" cy="13" r="4"/>
    </svg>
  ),
  Text: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="4 7 4 4 20 4 20 7"/><line x1="9" y1="20" x2="15" y2="20"/><line x1="12" y1="4" x2="12" y2="20"/>
    </svg>
  ),
  Heart: ({ filled }) => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill={filled ? "#ef4444" : "none"} stroke={filled ? "#ef4444" : "currentColor"} strokeWidth="1.8">
      <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/>
    </svg>
  ),
  Reply: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 17 4 12 9 7"/><path d="M20 18v-2a4 4 0 00-4-4H4"/>
    </svg>
  ),
  Close: () => (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
    </svg>
  ),
  Pause: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
      <rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/>
    </svg>
  ),
  Play: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
      <polygon points="5 3 19 12 5 21 5 3"/>
    </svg>
  ),
  Clock: () => (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
    </svg>
  ),
  Eye: () => (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
    </svg>
  ),
  Send: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
    </svg>
  ),
  Extend: () => (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
    </svg>
  ),
  Trash: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/>
    </svg>
  ),
  Plus: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
    </svg>
  ),
  Check: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12"/>
    </svg>
  ),
  Emoji: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/>
    </svg>
  ),
};

/* ─── Design tokens ─── */
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
];

const TEXT_COLORS = [
  "#ffffff", "#84cc16", "#f59e0b", "#ef4444",
  "#60a5fa", "#c084fc", "#f472b6", "#34d399",
  "#fbbf24", "#a78bfa",
];

const DURATIONS = [
  { h: 6,  label: "6h",  sublabel: "Gone in 6 hours" },
  { h: 12, label: "12h", sublabel: "Half a day" },
  { h: 18, label: "18h", sublabel: "Most of the day" },
  { h: 24, label: "24h", sublabel: "Full day — default" },
];

/* ─── AVATAR ─── */
const UserAvatar = ({ user, size = 52, ring = false, nearExpiry = false, ringColor = "#84cc16" }) => {
  const url = user?.avatar_id ? mediaUrlService.getAvatarUrl(user.avatar_id, 200) : null;
  return (
    <div
      className={`upd-av${ring ? " has-ring" : ""}${nearExpiry ? " upd-av-expiring" : ""}`}
      style={{
        width: size,
        height: size,
        fontSize: size * 0.38,
        "--ring-color": nearExpiry ? "#f59e0b" : ringColor,
      }}
    >
      {url
        ? <img src={url} alt={user?.full_name} style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "50%" }} />
        : getInitial(user?.full_name)
      }
    </div>
  );
};

/* ─── STORY VIEWER ─── */
const StoryViewer = ({ stories, startIndex = 0, currentUser, onClose, onReplyAsDM, onLike, likedIds }) => {
  const [idx,       setIdx]       = useState(startIndex);
  const [progress,  setProgress]  = useState(0);
  const [paused,    setPaused]    = useState(false);
  const [showReply, setShowReply] = useState(false);
  const [replyTxt,  setReplyTxt]  = useState("");
  const [loaded,    setLoaded]    = useState(false);
  const DURATION = 6000;
  const timer    = useRef(null);
  const story    = stories[idx];

  const advance = useCallback(() => {
    setIdx(i => {
      if (i + 1 >= stories.length) { onClose(); return i; }
      setProgress(0);
      setLoaded(false);
      return i + 1;
    });
  }, [stories.length, onClose]);

  useEffect(() => {
    setLoaded(false);
    const t = setTimeout(() => setLoaded(true), 50);
    return () => clearTimeout(t);
  }, [idx]);

  useEffect(() => {
    if (paused || showReply || !loaded) return;
    clearInterval(timer.current);
    const step = (50 / DURATION) * 100;
    timer.current = setInterval(() => {
      setProgress(p => {
        if (p >= 100) { clearInterval(timer.current); advance(); return 0; }
        return Math.min(p + step, 100);
      });
    }, 50);
    return () => clearInterval(timer.current);
  }, [idx, paused, showReply, loaded, advance]);

  if (!story) return null;

  const bgStyle = story.bg
    ? { background: story.bg }
    : story.image_id
      ? { backgroundImage: `url(${mediaUrlService.getImageUrl(story.image_id)})`, backgroundSize: "cover", backgroundPosition: "center" }
      : { background: "linear-gradient(145deg,#0d1117,#1a2332)" };

  const isLiked   = likedIds.has(story.id);
  const isMyStory = story.user_id === currentUser?.id;

  const handleReply = () => {
    if (!replyTxt.trim()) return;
    onReplyAsDM?.(story, replyTxt.trim());
    setReplyTxt("");
    setShowReply(false);
  };

  return (
    <div className="sv-root" onClick={() => setPaused(p => !p)}>
      {/* Progress bars */}
      <div className="sv-bars" onClick={e => e.stopPropagation()}>
        {stories.map((_, i) => (
          <div key={i} className="sv-bar-track">
            <div
              className="sv-bar-fill"
              style={{
                width: i < idx ? "100%" : i === idx ? `${progress}%` : "0%",
                transition: i === idx ? "none" : undefined,
              }}
            />
          </div>
        ))}
      </div>

      {/* Header */}
      <div className="sv-head" onClick={e => e.stopPropagation()}>
        <div className="sv-user">
          <UserAvatar user={story.profile} size={38} />
          <div>
            <div className="sv-uname">{story.profile?.full_name || "Unknown"}</div>
            <div className="sv-meta">
              <Ic.Clock /> {fmtRelative(story.created_at)}
              <span className="sv-dot">·</span>
              <Ic.Eye /> {story.views || 0}
              {isNearExpiry(story.expires_at) && (
                <>
                  <span className="sv-dot">·</span>
                  <span className="sv-expiring-label">⏳ {fmtCountdown(story.expires_at)} left</span>
                </>
              )}
            </div>
          </div>
        </div>
        <div className="sv-head-actions">
          <button className="sv-ctrl-btn" onClick={e => { e.stopPropagation(); setPaused(p => !p); }}>
            {paused ? <Ic.Play /> : <Ic.Pause />}
          </button>
          <button className="sv-ctrl-btn" onClick={e => { e.stopPropagation(); onClose(); }}>
            <Ic.Close />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="sv-content" style={bgStyle}>
        {story.text && (
          <div className={`sv-text-display${loaded ? " sv-text-in" : ""}`} style={{ color: story.text_color || "#fff" }}>
            {story.text}
          </div>
        )}
      </div>

      {/* Tap zones */}
      <div className="sv-tap-prev" onClick={e => { e.stopPropagation(); if (idx > 0) { setIdx(idx - 1); setProgress(0); } }} />
      <div className="sv-tap-next" onClick={e => { e.stopPropagation(); advance(); }} />

      {/* Bottom */}
      <div className="sv-bottom" onClick={e => e.stopPropagation()}>
        {showReply ? (
          <div className="sv-reply-row">
            <input
              className="sv-reply-input"
              placeholder={`Reply to ${story.profile?.full_name?.split(" ")[0] || ""}…`}
              value={replyTxt}
              onChange={e => setReplyTxt(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleReply()}
              autoFocus
            />
            <button className="sv-send-btn" onClick={handleReply} disabled={!replyTxt.trim()}>
              <Ic.Send />
            </button>
            <button className="sv-ctrl-btn" onClick={() => setShowReply(false)}>
              <Ic.Close />
            </button>
          </div>
        ) : (
          <div className="sv-actions-row">
            {!isMyStory && (
              <button className="sv-action-btn" onClick={() => setShowReply(true)}>
                <Ic.Reply />
                <span>Reply</span>
              </button>
            )}
            <button
              className={`sv-action-btn sv-like-btn${isLiked ? " liked" : ""}`}
              onClick={() => onLike(story.id, isLiked)}
            >
              <Ic.Heart filled={isLiked} />
              <span>{isLiked ? "Liked" : "Like"}</span>
            </button>
            {isMyStory && (
              <div className="sv-story-stats">
                <span><Ic.Eye /> {story.views || 0} views</span>
                <span><Ic.Heart filled={false} /> {story.likes || 0}</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

/* ─── ADD STATUS MODAL — complete redesign ─── */
const AddStatusModal = ({ currentUser, onClose, onAdded, totalToday }) => {
  const [step,      setStep]      = useState("pick");   // "pick" | "compose" | "settings"
  const [text,      setText]      = useState("");
  const [bg,        setBg]        = useState(GRADIENTS[0]);
  const [duration,  setDuration]  = useState(24);
  const [textColor, setTextColor] = useState("#ffffff");
  const [saving,    setSaving]    = useState(false);
  const [bgPage,    setBgPage]    = useState(0);
  const MAX       = 30;
  const remaining = MAX - totalToday;
  const CHAR_MAX  = 280;
  const pct       = Math.min((text.length / CHAR_MAX) * 100, 100);
  const gradPage  = GRADIENTS.slice(bgPage * 5, bgPage * 5 + 5);

  const handleShare = async () => {
    if (!text.trim() || saving) return;
    setSaving(true);
    try {
      const { error } = await supabase.from("status_updates").insert({
        user_id:    currentUser.id,
        text:       text.trim(),
        bg,
        text_color: textColor,
        duration_h: duration,
        expires_at: new Date(Date.now() + duration * 3600000).toISOString(),
      });
      if (error) throw error;
      onAdded();
      onClose();
    } catch (err) {
      console.error("[UpdatesView] Share error:", err);
      if (err.code === "42P01" || err.message?.includes("does not exist")) {
        alert("Run the SQL setup script in your Supabase SQL editor first.\nSee: /home/claude/setup.sql");
      } else if (err.code === "42501") {
        alert("Permission denied. Check your Supabase RLS policies for status_updates.");
      } else {
        alert(`Failed to share: ${err.message}`);
      }
    } finally {
      setSaving(false);
    }
  };

  const canShare = text.trim().length > 0 && !saving;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-sheet" onClick={e => e.stopPropagation()}>
        <div className="modal-drag-pill" />

        {/* ── STEP: PICK ── */}
        {step === "pick" && (
          <>
            <div className="modal-header">
              <div className="modal-title-group">
                <h3 className="modal-title">New Status</h3>
                <p className="modal-sub">Disappears in {duration}h · share what's on your mind</p>
              </div>
              <button className="modal-close-btn" onClick={onClose}><Ic.Close /></button>
            </div>

            <div className="quota-row">
              <div className="quota-bar-wrap">
                <div className="quota-bar-fill" style={{ width: `${Math.min((totalToday / MAX) * 100, 100)}%` }} />
              </div>
              <span className="quota-label">{remaining} of {MAX} left today</span>
            </div>

            <div className="pick-grid">
              <button className="pick-card pick-card-text" onClick={() => setStep("compose")}>
                <div className="pick-card-icon">
                  <Ic.Text />
                </div>
                <div className="pick-card-content">
                  <span className="pick-card-title">Text Status</span>
                  <span className="pick-card-desc">Express yourself with words and color</span>
                </div>
                <div className="pick-card-arrow">→</div>
              </button>
              <button className="pick-card pick-card-photo" disabled>
                <div className="pick-card-icon pick-card-icon-photo">
                  <Ic.Camera />
                </div>
                <div className="pick-card-content">
                  <span className="pick-card-title">Photo · Video</span>
                  <span className="pick-card-desc">Coming soon</span>
                </div>
                <div className="pick-card-badge">Soon</div>
              </button>
            </div>
          </>
        )}

        {/* ── STEP: COMPOSE ── */}
        {step === "compose" && (
          <>
            <div className="modal-header">
              <button className="modal-back-btn" onClick={() => setStep("pick")}>← Back</button>
              <h3 className="modal-title modal-title-center">Compose</h3>
              <button className="modal-close-btn" onClick={onClose}><Ic.Close /></button>
            </div>

            {/* Live preview */}
            <div className="compose-preview" style={{ background: bg }}>
              <p className="compose-preview-text" style={{ color: textColor }}>
                {text || <span style={{ opacity: 0.4 }}>Your status will look like this…</span>}
              </p>
              <div className="compose-preview-meta">
                <span>{duration}h</span>
              </div>
            </div>

            {/* Text input */}
            <div className="compose-input-wrap">
              <textarea
                className="compose-textarea"
                placeholder="What's on your mind?"
                value={text}
                onChange={e => setText(e.target.value)}
                maxLength={CHAR_MAX}
                autoFocus
              />
              <div className="compose-char-row">
                <svg width="24" height="24" viewBox="0 0 24 24" style={{ transform: "rotate(-90deg)" }}>
                  <circle cx="12" cy="12" r="10" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="2.5" />
                  <circle
                    cx="12" cy="12" r="10"
                    fill="none"
                    stroke={pct > 90 ? "#ef4444" : pct > 70 ? "#f59e0b" : "#84cc16"}
                    strokeWidth="2.5"
                    strokeDasharray={`${2 * Math.PI * 10}`}
                    strokeDashoffset={`${2 * Math.PI * 10 * (1 - pct / 100)}`}
                    strokeLinecap="round"
                    style={{ transition: "stroke-dashoffset 0.2s, stroke 0.2s" }}
                  />
                </svg>
                <span style={{ fontSize: 11, color: pct > 90 ? "#ef4444" : "#444" }}>
                  {CHAR_MAX - text.length}
                </span>
              </div>
            </div>

            {/* Background picker */}
            <div className="compose-section-label">Background</div>
            <div className="bg-picker-row">
              {gradPage.map((g, i) => (
                <button
                  key={i}
                  className={`bg-swatch${bg === g ? " active" : ""}`}
                  style={{ background: g }}
                  onClick={() => setBg(g)}
                >
                  {bg === g && <Ic.Check />}
                </button>
              ))}
              <button className="bg-page-btn" onClick={() => setBgPage(p => (p + 1) % Math.ceil(GRADIENTS.length / 5))}>
                {bgPage < Math.ceil(GRADIENTS.length / 5) - 1 ? "→" : "↺"}
              </button>
            </div>

            {/* Text color */}
            <div className="compose-section-label">Text Color</div>
            <div className="color-picker-row">
              {TEXT_COLORS.map(c => (
                <button
                  key={c}
                  className={`color-dot${textColor === c ? " active" : ""}`}
                  style={{ background: c }}
                  onClick={() => setTextColor(c)}
                />
              ))}
            </div>

            <button className="compose-next-btn" onClick={() => setStep("settings")} disabled={!text.trim()}>
              Next: Duration →
            </button>
          </>
        )}

        {/* ── STEP: SETTINGS (Duration + Share) ── */}
        {step === "settings" && (
          <>
            <div className="modal-header">
              <button className="modal-back-btn" onClick={() => setStep("compose")}>← Edit</button>
              <h3 className="modal-title modal-title-center">Duration</h3>
              <button className="modal-close-btn" onClick={onClose}><Ic.Close /></button>
            </div>

            {/* Mini preview */}
            <div className="settings-preview" style={{ background: bg }}>
              <p style={{ color: textColor, fontSize: 14, fontWeight: 700, margin: 0, padding: "0 12px", textAlign: "center", wordBreak: "break-word" }}>
                {text.slice(0, 60)}{text.length > 60 ? "…" : ""}
              </p>
            </div>

            <p className="settings-sub">How long should your status stay visible?</p>

            <div className="duration-cards">
              {DURATIONS.map(d => (
                <button
                  key={d.h}
                  className={`duration-card${duration === d.h ? " active" : ""}`}
                  onClick={() => setDuration(d.h)}
                >
                  <div className="duration-card-time">{d.label}</div>
                  <div className="duration-card-desc">{d.sublabel}</div>
                  {duration === d.h && <div className="duration-card-check"><Ic.Check /></div>}
                </button>
              ))}
            </div>

            <div className="settings-expiry-info">
              <Ic.Clock />
              <span>Expires {new Date(Date.now() + duration * 3600000).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}, {new Date(Date.now() + duration * 3600000).toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" })}</span>
            </div>

            <button
              className={`share-btn${saving ? " saving" : ""}${!canShare ? " disabled" : ""}`}
              onClick={handleShare}
              disabled={!canShare}
            >
              {saving ? (
                <span className="share-spinner" />
              ) : (
                <>
                  <Ic.Send />
                  <span>Share Status</span>
                </>
              )}
            </button>
          </>
        )}
      </div>
    </div>
  );
};

/* ─── EXTEND MODAL ─── */
const ExtendModal = ({ story, onExtend, onClose }) => (
  <div className="modal-overlay" onClick={onClose}>
    <div className="extend-modal" onClick={e => e.stopPropagation()}>
      <div className="extend-modal-head">
        <span>⏳ Extend Status</span>
        <button onClick={onClose}><Ic.Close /></button>
      </div>
      <p className="extend-modal-sub">
        Currently: <strong style={{ color: "#f59e0b" }}>{fmtCountdown(story.expires_at)} left</strong>
      </p>
      {[3, 6, 12, 24].map(h => (
        <button key={h} className="extend-option" onClick={() => { onExtend(story.id, h); onClose(); }}>
          +{h} hours
        </button>
      ))}
    </div>
  </div>
);

/* ─── UPDATES VIEW ─── */
const UpdatesView = ({ currentUser, onReplyAsDM }) => {
  const [myStatuses,    setMyStatuses]    = useState([]);
  const [otherStatuses, setOtherStatuses] = useState([]);
  const [likedIds,      setLikedIds]      = useState(new Set());
  const [viewerData,    setViewerData]    = useState(null);
  const [showAdd,       setShowAdd]       = useState(false);
  const [extendTarget,  setExtendTarget]  = useState(null);
  const [loading,       setLoading]       = useState(true);
  const [tableError,    setTableError]    = useState(false);
  const [, forceUpdate] = useState(0);
  const mounted = useRef(true);

  /* ── Add story from header + button ── */
  useEffect(() => {
    const handler = () => setShowAdd(true);
    document.addEventListener("dm:addStory", handler);
    return () => document.removeEventListener("dm:addStory", handler);
  }, []);

  /* ── Countdown refresh every minute ── */
  useEffect(() => {
    const t = setInterval(() => forceUpdate(n => n + 1), 60000);
    return () => clearInterval(t);
  }, []);

  /* ── Load ── */
  const loadStatuses = useCallback(async () => {
    if (!currentUser?.id) return;
    try {
      const { data, error } = await supabase
        .from("status_updates")
        .select(`
          id, text, bg, text_color, image_id, duration_h,
          views, likes, created_at, expires_at, user_id,
          profile:profiles!status_updates_user_id_fkey(
            id, full_name, username, avatar_id, verified
          )
        `)
        .gt("expires_at", new Date().toISOString())
        .order("created_at", { ascending: false });

      if (error) {
        if (error.code === "42P01" || error.message?.includes("does not exist")) {
          if (mounted.current) { setTableError(true); setLoading(false); }
          return;
        }
        throw error;
      }

      if (!mounted.current) return;
      setMyStatuses((data || []).filter(s => s.user_id === currentUser.id));
      setOtherStatuses((data || []).filter(s => s.user_id !== currentUser.id));

      if (data?.length > 0) {
        const { data: likeData } = await supabase
          .from("status_likes")
          .select("status_id")
          .eq("user_id", currentUser.id)
          .in("status_id", data.map(s => s.id));
        if (mounted.current && likeData) {
          setLikedIds(new Set(likeData.map(l => l.status_id)));
        }
      }
    } catch (err) {
      console.error("[UpdatesView] Load error:", err);
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, [currentUser?.id]);

  useEffect(() => {
    mounted.current = true;
    loadStatuses();
    return () => { mounted.current = false; };
  }, [loadStatuses]);

  /* ── Realtime ── */
  useEffect(() => {
    if (!currentUser?.id || tableError) return;
    const ch = supabase
      .channel("status_updates_live")
      .on("postgres_changes", { event: "*", schema: "public", table: "status_updates" }, () => {
        if (mounted.current) loadStatuses();
      })
      .subscribe();
    return () => supabase.removeChannel(ch);
  }, [currentUser?.id, tableError, loadStatuses]);

  /* ── Like / Unlike ── */
  const handleLike = useCallback(async (statusId, isCurrentlyLiked) => {
    if (!currentUser?.id) return;
    setLikedIds(prev => {
      const next = new Set(prev);
      isCurrentlyLiked ? next.delete(statusId) : next.add(statusId);
      return next;
    });
    try {
      if (isCurrentlyLiked) {
        await supabase.from("status_likes").delete().eq("status_id", statusId).eq("user_id", currentUser.id);
        await supabase.from("status_updates").update({ likes: supabase.rpc ? undefined : 0 }).eq("id", statusId);
        // Use raw SQL approach for decrement
        await supabase.rpc("increment_status_likes", { p_status_id: statusId, p_delta: -1 }).catch(() => {});
      } else {
        await supabase.from("status_likes").insert({ status_id: statusId, user_id: currentUser.id });
        await supabase.rpc("increment_status_likes", { p_status_id: statusId, p_delta: 1 }).catch(() => {});
      }
    } catch (err) {
      console.warn("[UpdatesView] Like error:", err);
      setLikedIds(prev => {
        const next = new Set(prev);
        isCurrentlyLiked ? next.add(statusId) : next.delete(statusId);
        return next;
      });
    }
  }, [currentUser?.id]);

  /* ── Extend ── */
  const handleExtend = useCallback(async (statusId, hours) => {
    const status = [...myStatuses, ...otherStatuses].find(s => s.id === statusId);
    if (!status) return;
    const newExpiry = new Date(new Date(status.expires_at).getTime() + hours * 3600000).toISOString();
    try {
      await supabase.from("status_updates").update({ expires_at: newExpiry }).eq("id", statusId).eq("user_id", currentUser.id);
      loadStatuses();
    } catch (err) { console.error("[UpdatesView] Extend error:", err); }
  }, [myStatuses, otherStatuses, currentUser?.id, loadStatuses]);

  /* ── Delete ── */
  const handleDelete = useCallback(async (statusId) => {
    setMyStatuses(prev => prev.filter(s => s.id !== statusId));
    try {
      await supabase.from("status_updates").delete().eq("id", statusId).eq("user_id", currentUser.id);
    } catch (err) {
      console.error("[UpdatesView] Delete error:", err);
      loadStatuses();
    }
  }, [currentUser?.id, loadStatuses]);

  /* ── Record view ── */
  const recordView = useCallback(async (statusId) => {
    try {
      await supabase.rpc("increment_status_views", { p_status_id: statusId });
    } catch { /* silent */ }
  }, []);

  const openViewer = (list, startIdx = 0) => {
    setViewerData({ stories: list, startIdx });
    list.forEach(s => {
      if (s.user_id !== currentUser?.id) recordView(s.id);
    });
  };

  /* Group by user */
  const grouped = otherStatuses.reduce((acc, s) => {
    if (!acc[s.user_id]) acc[s.user_id] = [];
    acc[s.user_id].push(s);
    return acc;
  }, {});

  const myStoriesToday = myStatuses.filter(s => Date.now() - new Date(s.created_at) < 86400000).length;
  const hasContent     = myStatuses.length > 0 || Object.keys(grouped).length > 0;

  /* ── Loading ── */
  if (loading) {
    return (
      <div className="upd-root">
        <div className="upd-loading">
          {[0, 1, 2, 3].map(i => (
            <div key={i} className="upd-skeleton" style={{ animationDelay: `${i * 0.1}s` }} />
          ))}
        </div>
        <style>{updStyles}</style>
      </div>
    );
  }

  /* ── Table not set up ── */
  if (tableError) {
    return (
      <div className="upd-root">
        <div className="upd-setup-state">
          <div className="upd-setup-icon">🛠️</div>
          <h3>Status Updates Need Setup</h3>
          <p>Run the SQL script in your Supabase editor to enable this feature.</p>
          <code>setup.sql</code>
        </div>
        <style>{updStyles}</style>
      </div>
    );
  }

  return (
    <div className="upd-root">

      {/* ── MY STATUS ROW ── */}
      <div className="my-status-row">
        <div className="my-status-left" onClick={() => myStatuses.length > 0 ? openViewer(myStatuses) : setShowAdd(true)}>
          <div className="my-av-wrap">
            <UserAvatar
              user={{ ...currentUser, full_name: currentUser?.name || currentUser?.fullName, avatar_id: null }}
              size={50}
              ring={myStatuses.length > 0}
            />
            <button
              className="my-av-add"
              onClick={e => { e.stopPropagation(); setShowAdd(true); }}
              title="Add status"
            >
              <Ic.Plus />
            </button>
          </div>
          <div className="my-status-info">
            <div className="my-status-name">My Status</div>
            <div className="my-status-sub">
              {myStatuses.length > 0
                ? `${myStatuses.length} active · tap to view`
                : "Tap + to add a status"
              }
            </div>
          </div>
        </div>
        {myStatuses.length > 0 && (
          <div className="my-status-count-badge">{myStatuses.length}</div>
        )}
      </div>

      {/* ── MY ACTIVE STATUS CARDS ── */}
      {myStatuses.length > 0 && (
        <div className="my-cards-scroll">
          {myStatuses.map(s => (
            <div key={s.id} className="my-card" onClick={() => openViewer([s])}>
              <div className="my-card-preview" style={s.bg ? { background: s.bg } : {}}>
                {s.text && (
                  <span className="my-card-text" style={{ color: s.text_color || "#fff" }}>
                    {s.text.slice(0, 40)}
                  </span>
                )}
              </div>
              <div className="my-card-footer">
                <div className="my-card-meta-row">
                  <span className="my-card-meta">
                    <Ic.Clock /> {fmtCountdown(s.expires_at)}
                  </span>
                  <span className="my-card-meta">
                    <Ic.Eye /> {s.views || 0}
                  </span>
                </div>
                <div className="my-card-actions">
                  {isNearExpiry(s.expires_at) && (
                    <button
                      className="my-card-extend-btn"
                      onClick={e => { e.stopPropagation(); setExtendTarget(s); }}
                    >
                      <Ic.Extend /> Extend
                    </button>
                  )}
                  <button
                    className="my-card-delete-btn"
                    onClick={e => { e.stopPropagation(); handleDelete(s.id); }}
                  >
                    <Ic.Trash />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── OTHERS: BUBBLE STRIP ── */}
      {Object.keys(grouped).length > 0 && (
        <div className="others-strip">
          <div className="others-strip-label">Recent Updates</div>
          <div className="bubbles-scroll">
            {Object.entries(grouped).map(([uid, statuses]) => {
              const first      = statuses[0];
              const anyExpiring = statuses.some(s => isNearExpiry(s.expires_at));
              return (
                <div key={uid} className="bubble-item" onClick={() => openViewer(statuses)}>
                  <div className={`bubble-ring${anyExpiring ? " bubble-ring-warn" : ""}`}>
                    <UserAvatar user={first.profile} size={48} />
                  </div>
                  <span className="bubble-name">
                    {(first.profile?.full_name || "").split(" ")[0]}
                  </span>
                  {statuses.length > 1 && (
                    <span className="bubble-count">{statuses.length}</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── OTHERS: CONTACT LIST ── */}
      {Object.keys(grouped).length > 0 && (
        <div className="contacts-list">
          {Object.entries(grouped).map(([uid, statuses]) => {
            const latest      = statuses[0];
            const anyExpiring = statuses.some(s => isNearExpiry(s.expires_at));
            const isLiked     = likedIds.has(latest.id);
            return (
              <div key={uid} className="contact-row" onClick={() => openViewer(statuses)}>
                <div className="contact-av-wrap">
                  <UserAvatar user={latest.profile} size={50} ring nearExpiry={anyExpiring} />
                  {statuses.length > 1 && <span className="contact-badge">{statuses.length}</span>}
                </div>
                <div className="contact-body">
                  <div className="contact-top">
                    <span className="contact-name">{latest.profile?.full_name || "Unknown"}</span>
                    <span className="contact-time">{fmtRelative(latest.created_at)}</span>
                  </div>
                  {latest.text && (
                    <p className="contact-preview">{latest.text.slice(0, 65)}{latest.text.length > 65 ? "…" : ""}</p>
                  )}
                  {anyExpiring && (
                    <div className="contact-expiry"><Ic.Extend /> Expiring soon</div>
                  )}
                </div>
                <div className="contact-actions" onClick={e => e.stopPropagation()}>
                  <button
                    className={`contact-like-btn${isLiked ? " liked" : ""}`}
                    onClick={() => handleLike(latest.id, isLiked)}
                  >
                    <Ic.Heart filled={isLiked} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── EMPTY ── */}
      {!hasContent && (
        <div className="upd-empty">
          <div className="upd-empty-glow" />
          <div className="upd-empty-icon">📡</div>
          <h3 className="upd-empty-title">No Status Updates Yet</h3>
          <p className="upd-empty-sub">Share what's on your mind or wait for others to post</p>
          <button className="upd-empty-btn" onClick={() => setShowAdd(true)}>
            <Ic.Plus /> Add Your First Status
          </button>
        </div>
      )}

      {/* ── MODALS ── */}
      {showAdd && (
        <AddStatusModal
          currentUser={currentUser}
          onClose={() => setShowAdd(false)}
          onAdded={loadStatuses}
          totalToday={myStoriesToday}
        />
      )}
      {extendTarget && (
        <ExtendModal
          story={extendTarget}
          onExtend={handleExtend}
          onClose={() => setExtendTarget(null)}
        />
      )}
      {viewerData && (
        <StoryViewer
          stories={viewerData.stories}
          startIndex={viewerData.startIdx}
          currentUser={currentUser}
          likedIds={likedIds}
          onClose={() => setViewerData(null)}
          onLike={handleLike}
          onReplyAsDM={(story, text) => {
            setViewerData(null);
            onReplyAsDM?.(story, text);
          }}
        />
      )}

      <style>{updStyles}</style>
    </div>
  );
};

/* ─── STYLES ─── */
const updStyles = `
  /* ── Root ── */
  .upd-root {
    flex: 1;
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;
    background: #000;
    padding-bottom: 24px;
  }
  .upd-root::-webkit-scrollbar { width: 3px; }
  .upd-root::-webkit-scrollbar-thumb { background: rgba(132,204,22,0.15); border-radius: 2px; }

  /* ── Loading ── */
  .upd-loading { padding: 16px; display: flex; flex-direction: column; gap: 10px; }
  .upd-skeleton {
    height: 70px; border-radius: 14px;
    background: rgba(255,255,255,0.04);
    animation: updSkelPulse 1.5s ease-in-out infinite;
  }
  @keyframes updSkelPulse { 0%,100%{opacity:.5} 50%{opacity:.15} }

  /* ── Setup state ── */
  .upd-setup-state {
    display: flex; flex-direction: column; align-items: center;
    padding: 60px 24px; gap: 12px; text-align: center;
  }
  .upd-setup-icon { font-size: 48px; }
  .upd-setup-state h3 { margin: 0; font-size: 16px; color: #fff; font-weight: 700; }
  .upd-setup-state p { margin: 0; font-size: 13px; color: #555; line-height: 1.5; }
  .upd-setup-state code {
    padding: 6px 12px; border-radius: 8px; font-size: 12px;
    background: rgba(132,204,22,0.1); border: 1px solid rgba(132,204,22,0.2);
    color: #84cc16; font-family: monospace;
  }

  /* ── Avatar ── */
  .upd-av {
    border-radius: 50%;
    background: linear-gradient(135deg,#141414,#1f1f1f);
    display: flex; align-items: center; justify-content: center;
    font-weight: 800; color: #84cc16;
    border: 2px solid rgba(255,255,255,0.06);
    overflow: hidden; flex-shrink: 0;
    position: relative;
  }
  .upd-av.has-ring { border: 2.5px solid var(--ring-color, #84cc16); }
  .upd-av.upd-av-expiring {
    border-color: #f59e0b !important;
    animation: expiryPulse 1.6s ease-in-out infinite;
  }
  @keyframes expiryPulse {
    0%,100%{box-shadow:0 0 0 0 rgba(245,158,11,0.4)}
    50%{box-shadow:0 0 0 6px rgba(245,158,11,0)}
  }

  /* ── My Status Row ── */
  .my-status-row {
    display: flex; align-items: center; justify-content: space-between;
    padding: 14px 16px;
    border-bottom: 1px solid rgba(255,255,255,0.05);
    transition: background 0.15s;
  }
  .my-status-row:hover { background: rgba(255,255,255,0.02); }
  .my-status-left {
    display: flex; align-items: center; gap: 12px; cursor: pointer; flex: 1;
  }
  .my-av-wrap { position: relative; flex-shrink: 0; }
  .my-av-add {
    position: absolute; bottom: -2px; right: -2px;
    width: 20px; height: 20px; border-radius: 50%;
    background: #84cc16; color: #000;
    border: 2px solid #000;
    display: flex; align-items: center; justify-content: center;
    cursor: pointer; padding: 0;
    transition: transform 0.15s, background 0.15s;
  }
  .my-av-add:hover { transform: scale(1.15); background: #a3e635; }
  .my-av-add svg { width: 11px; height: 11px; }
  .my-status-name { font-size: 14px; font-weight: 700; color: #fff; }
  .my-status-sub { font-size: 12px; color: #555; margin-top: 2px; }
  .my-status-count-badge {
    min-width: 22px; height: 22px; border-radius: 11px;
    background: #84cc16; color: #000; font-size: 11px; font-weight: 800;
    display: flex; align-items: center; justify-content: center; padding: 0 4px;
  }

  /* ── My Cards Scroll ── */
  .my-cards-scroll {
    display: flex; gap: 10px;
    padding: 10px 16px 12px;
    overflow-x: auto; -webkit-overflow-scrolling: touch;
    border-bottom: 1px solid rgba(255,255,255,0.05);
  }
  .my-cards-scroll::-webkit-scrollbar { display: none; }
  .my-card {
    flex-shrink: 0; width: 105px;
    border-radius: 14px; overflow: hidden;
    border: 1px solid rgba(132,204,22,0.2);
    background: #0d0d0d; cursor: pointer;
    transition: border-color 0.15s, transform 0.15s;
  }
  .my-card:hover { border-color: rgba(132,204,22,0.5); transform: translateY(-1px); }
  .my-card:active { transform: scale(0.97); }
  .my-card-preview {
    height: 115px; display: flex; align-items: center; justify-content: center;
    background: linear-gradient(145deg,#0d1117,#1a2332);
    padding: 8px;
  }
  .my-card-text {
    font-size: 11px; text-align: center; font-weight: 600;
    line-height: 1.3; word-break: break-word;
  }
  .my-card-footer { padding: 8px; }
  .my-card-meta-row { display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px; }
  .my-card-meta {
    display: flex; align-items: center; gap: 3px;
    font-size: 10px; color: #555;
  }
  .my-card-actions { display: flex; align-items: center; gap: 4px; }
  .my-card-extend-btn {
    display: flex; align-items: center; gap: 3px;
    font-size: 10px; font-weight: 700; color: #f59e0b;
    background: rgba(245,158,11,0.1); border: 1px solid rgba(245,158,11,0.25);
    border-radius: 6px; padding: 3px 6px; cursor: pointer; flex: 1;
    transition: background 0.15s;
  }
  .my-card-extend-btn:hover { background: rgba(245,158,11,0.2); }
  .my-card-delete-btn {
    width: 24px; height: 24px; border-radius: 6px;
    background: rgba(239,68,68,0.08); border: 1px solid rgba(239,68,68,0.2);
    display: flex; align-items: center; justify-content: center;
    cursor: pointer; transition: background 0.15s;
  }
  .my-card-delete-btn:hover { background: rgba(239,68,68,0.18); }

  /* ── Others strip ── */
  .others-strip { padding: 14px 0 0; }
  .others-strip-label {
    padding: 0 16px 8px;
    font-size: 10px; font-weight: 700; color: #333;
    text-transform: uppercase; letter-spacing: 1px;
  }
  .bubbles-scroll {
    display: flex; gap: 16px;
    padding: 4px 16px 14px;
    overflow-x: auto; -webkit-overflow-scrolling: touch;
    border-bottom: 1px solid rgba(255,255,255,0.05);
  }
  .bubbles-scroll::-webkit-scrollbar { display: none; }
  .bubble-item {
    display: flex; flex-direction: column; align-items: center; gap: 5px;
    cursor: pointer; flex-shrink: 0; position: relative;
  }
  .bubble-ring {
    padding: 2.5px; border-radius: 50%;
    background: linear-gradient(145deg,#84cc16,#22c55e);
  }
  .bubble-ring-warn { background: linear-gradient(145deg,#f59e0b,#ef4444); }
  .bubble-name {
    font-size: 10px; color: #777; max-width: 56px;
    text-align: center; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }
  .bubble-count {
    position: absolute; top: -2px; right: -4px;
    width: 16px; height: 16px; border-radius: 50%;
    background: #84cc16; color: #000; font-size: 9px; font-weight: 800;
    display: flex; align-items: center; justify-content: center;
    border: 1.5px solid #000;
  }

  /* ── Contact list ── */
  .contacts-list { display: flex; flex-direction: column; }
  .contact-row {
    display: flex; align-items: center; gap: 12px;
    padding: 12px 16px;
    border-bottom: 1px solid rgba(255,255,255,0.03);
    cursor: pointer; transition: background 0.15s;
  }
  .contact-row:hover { background: rgba(255,255,255,0.02); }
  .contact-av-wrap { position: relative; flex-shrink: 0; }
  .contact-badge {
    position: absolute; top: -2px; right: -2px;
    width: 17px; height: 17px; border-radius: 50%;
    background: #84cc16; color: #000; font-size: 9px; font-weight: 800;
    display: flex; align-items: center; justify-content: center;
    border: 2px solid #000;
  }
  .contact-body { flex: 1; min-width: 0; }
  .contact-top { display: flex; align-items: center; justify-content: space-between; margin-bottom: 3px; }
  .contact-name { font-size: 14px; font-weight: 700; color: #fff; }
  .contact-time { font-size: 11px; color: #333; flex-shrink: 0; margin-left: 8px; }
  .contact-preview { font-size: 13px; color: #555; margin: 0 0 4px; line-height: 1.4; }
  .contact-expiry {
    display: flex; align-items: center; gap: 4px;
    font-size: 11px; color: #f59e0b; font-weight: 600;
  }
  .contact-actions { flex-shrink: 0; }
  .contact-like-btn {
    width: 36px; height: 36px; border-radius: 50%;
    background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.07);
    display: flex; align-items: center; justify-content: center;
    cursor: pointer; transition: background 0.15s, border-color 0.15s;
  }
  .contact-like-btn:hover { background: rgba(255,255,255,0.08); }
  .contact-like-btn.liked { background: rgba(239,68,68,0.1); border-color: rgba(239,68,68,0.3); }

  /* ── Empty ── */
  .upd-empty {
    display: flex; flex-direction: column; align-items: center;
    padding: 70px 24px; gap: 14px; text-align: center; position: relative;
  }
  .upd-empty-glow {
    position: absolute; top: 50%; left: 50%;
    transform: translate(-50%, -50%);
    width: 200px; height: 200px; border-radius: 50%;
    background: radial-gradient(circle, rgba(132,204,22,0.06) 0%, transparent 70%);
    pointer-events: none;
  }
  .upd-empty-icon { font-size: 52px; }
  .upd-empty-title { font-size: 17px; font-weight: 800; color: #fff; margin: 0; }
  .upd-empty-sub { font-size: 13px; color: #444; margin: 0; line-height: 1.5; }
  .upd-empty-btn {
    display: flex; align-items: center; gap: 8px;
    padding: 12px 24px; border-radius: 24px;
    background: rgba(132,204,22,0.1); border: 1px solid rgba(132,204,22,0.3);
    color: #84cc16; font-size: 13px; font-weight: 700; cursor: pointer;
    transition: all 0.2s; margin-top: 4px;
  }
  .upd-empty-btn:hover { background: rgba(132,204,22,0.18); border-color: rgba(132,204,22,0.5); }

  /* ══ STORY VIEWER ══ */
  .sv-root {
    position: fixed; inset: 0; z-index: 19999;
    background: #000;
    display: flex; flex-direction: column; overflow: hidden;
    user-select: none;
  }
  .sv-bars {
    display: flex; gap: 3px;
    padding: 14px 14px 0;
    position: absolute; top: 0; left: 0; right: 0; z-index: 10;
  }
  .sv-bar-track {
    flex: 1; height: 2px; border-radius: 2px;
    background: rgba(255,255,255,0.2); overflow: hidden;
  }
  .sv-bar-fill {
    height: 100%; background: #fff; border-radius: 2px;
    transition: width 0.05s linear;
  }
  .sv-head {
    position: absolute; top: 24px; left: 0; right: 0; z-index: 10;
    display: flex; align-items: center; justify-content: space-between;
    padding: 8px 14px;
  }
  .sv-user { display: flex; align-items: center; gap: 10px; }
  .sv-uname { font-size: 13px; font-weight: 700; color: #fff; }
  .sv-meta {
    display: flex; align-items: center; gap: 5px;
    font-size: 11px; color: rgba(255,255,255,0.5); margin-top: 2px;
  }
  .sv-dot { opacity: 0.4; }
  .sv-expiring-label { color: #f59e0b; font-weight: 600; }
  .sv-head-actions { display: flex; gap: 8px; }
  .sv-ctrl-btn {
    width: 36px; height: 36px; border-radius: 50%;
    background: rgba(0,0,0,0.5); border: none;
    color: #fff; display: flex; align-items: center; justify-content: center;
    cursor: pointer; backdrop-filter: blur(8px);
    transition: background 0.15s;
  }
  .sv-ctrl-btn:hover { background: rgba(0,0,0,0.7); }
  .sv-content {
    position: absolute; inset: 0;
    display: flex; align-items: center; justify-content: center;
  }
  .sv-text-display {
    max-width: 82%; padding: 28px 20px;
    font-size: clamp(18px, 5vw, 28px); font-weight: 800;
    text-align: center; line-height: 1.3;
    text-shadow: 0 2px 20px rgba(0,0,0,0.8);
    opacity: 0; transform: scale(0.92);
    transition: opacity 0.3s ease, transform 0.3s ease;
  }
  .sv-text-display.sv-text-in { opacity: 1; transform: scale(1); }
  .sv-tap-prev {
    position: absolute; left: 0; top: 0; bottom: 0; width: 33%; z-index: 5;
  }
  .sv-tap-next {
    position: absolute; right: 0; top: 0; bottom: 0; width: 33%; z-index: 5;
  }
  .sv-bottom {
    position: absolute; bottom: 0; left: 0; right: 0; z-index: 10;
    padding: 20px 16px calc(env(safe-area-inset-bottom,0px) + 28px);
    background: linear-gradient(to top, rgba(0,0,0,0.75), transparent);
  }
  .sv-actions-row {
    display: flex; align-items: center; gap: 10px; justify-content: center;
  }
  .sv-action-btn {
    display: flex; align-items: center; gap: 7px;
    padding: 11px 22px; border-radius: 24px;
    background: rgba(255,255,255,0.12);
    border: 1px solid rgba(255,255,255,0.18);
    color: #fff; font-size: 13px; font-weight: 600; cursor: pointer;
    transition: background 0.15s, border-color 0.15s;
    backdrop-filter: blur(8px);
  }
  .sv-action-btn:hover { background: rgba(255,255,255,0.2); }
  .sv-action-btn.sv-like-btn.liked { color: #ef4444; border-color: rgba(239,68,68,0.5); background: rgba(239,68,68,0.15); }
  .sv-story-stats {
    display: flex; align-items: center; gap: 12px;
    font-size: 12px; color: rgba(255,255,255,0.5); margin-left: auto;
  }
  .sv-story-stats span { display: flex; align-items: center; gap: 4px; }
  .sv-reply-row { display: flex; align-items: center; gap: 8px; }
  .sv-reply-input {
    flex: 1; background: rgba(255,255,255,0.12); border: 1px solid rgba(255,255,255,0.2);
    border-radius: 24px; color: #fff; font-size: 14px; padding: 11px 16px;
    outline: none; caret-color: #84cc16; backdrop-filter: blur(8px);
  }
  .sv-reply-input::placeholder { color: rgba(255,255,255,0.35); }
  .sv-send-btn {
    width: 42px; height: 42px; border-radius: 50%;
    background: rgba(132,204,22,0.2); border: 1px solid rgba(132,204,22,0.4);
    color: #84cc16; display: flex; align-items: center; justify-content: center;
    cursor: pointer; transition: background 0.15s;
  }
  .sv-send-btn:hover:not(:disabled) { background: rgba(132,204,22,0.35); }
  .sv-send-btn:disabled { opacity: 0.4; cursor: not-allowed; }

  /* ══ ADD STATUS MODAL ══ */
  .modal-overlay {
    position: fixed; inset: 0; z-index: 20000;
    background: rgba(0,0,0,0.75);
    display: flex; align-items: flex-end;
    animation: backdropIn 0.2s ease;
    backdrop-filter: blur(4px);
  }
  @keyframes backdropIn { from{opacity:0} to{opacity:1} }
  .modal-sheet {
    width: 100%; max-height: 92vh;
    background: #080808;
    border: 1px solid rgba(132,204,22,0.12);
    border-radius: 24px 24px 0 0;
    overflow-y: auto;
    animation: sheetUp 0.28s cubic-bezier(0.34,1.4,0.64,1);
    padding-bottom: calc(env(safe-area-inset-bottom,0px) + 16px);
  }
  .modal-sheet::-webkit-scrollbar { display: none; }
  @keyframes sheetUp { from{transform:translateY(100%)} to{transform:translateY(0)} }
  .modal-drag-pill {
    width: 38px; height: 4px; border-radius: 2px;
    background: rgba(255,255,255,0.12);
    margin: 12px auto 0;
  }
  .modal-header {
    display: flex; align-items: center; justify-content: space-between;
    padding: 16px 20px 12px;
    border-bottom: 1px solid rgba(255,255,255,0.06);
  }
  .modal-title-group {}
  .modal-title { font-size: 17px; font-weight: 800; color: #fff; margin: 0; }
  .modal-title-center { flex: 1; text-align: center; }
  .modal-sub { font-size: 12px; color: #444; margin: 2px 0 0; }
  .modal-close-btn {
    width: 32px; height: 32px; border-radius: 10px;
    background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.07);
    display: flex; align-items: center; justify-content: center;
    color: #555; cursor: pointer; flex-shrink: 0;
    transition: background 0.15s, color 0.15s;
  }
  .modal-close-btn:hover { background: rgba(255,255,255,0.08); color: #fff; }
  .modal-back-btn {
    background: none; border: none; color: #84cc16;
    font-size: 13px; font-weight: 700; cursor: pointer; padding: 0;
    flex-shrink: 0;
  }

  /* quota */
  .quota-row {
    display: flex; align-items: center; gap: 12px;
    padding: 10px 20px;
    border-bottom: 1px solid rgba(255,255,255,0.05);
  }
  .quota-bar-wrap {
    flex: 1; height: 3px; border-radius: 2px;
    background: rgba(255,255,255,0.06); overflow: hidden;
  }
  .quota-bar-fill {
    height: 100%; border-radius: 2px;
    background: linear-gradient(90deg,#84cc16,#22c55e);
    transition: width 0.4s ease;
  }
  .quota-label { font-size: 11px; color: #444; flex-shrink: 0; }

  /* pick grid */
  .pick-grid { display: flex; flex-direction: column; gap: 8px; padding: 14px 20px 20px; }
  .pick-card {
    display: flex; align-items: center; gap: 14px;
    padding: 16px; border-radius: 16px;
    background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.07);
    cursor: pointer; text-align: left; width: 100%;
    transition: all 0.18s;
  }
  .pick-card:not(:disabled):hover {
    background: rgba(132,204,22,0.06); border-color: rgba(132,204,22,0.2);
  }
  .pick-card:disabled { opacity: 0.35; cursor: not-allowed; }
  .pick-card-icon {
    width: 46px; height: 46px; border-radius: 14px;
    background: rgba(132,204,22,0.1); border: 1px solid rgba(132,204,22,0.2);
    color: #84cc16;
    display: flex; align-items: center; justify-content: center; flex-shrink: 0;
  }
  .pick-card-icon-photo {
    background: rgba(96,165,250,0.1); border-color: rgba(96,165,250,0.2); color: #60a5fa;
  }
  .pick-card-content { flex: 1; }
  .pick-card-title { display: block; font-size: 14px; font-weight: 700; color: #fff; }
  .pick-card-desc { display: block; font-size: 12px; color: #555; margin-top: 3px; }
  .pick-card-arrow { font-size: 16px; color: #333; transition: transform 0.15s; }
  .pick-card:hover .pick-card-arrow { transform: translateX(3px); color: #84cc16; }
  .pick-card-badge {
    padding: 3px 8px; border-radius: 8px; font-size: 10px; font-weight: 700;
    background: rgba(96,165,250,0.1); border: 1px solid rgba(96,165,250,0.2); color: #60a5fa;
  }

  /* compose */
  .compose-preview {
    margin: 14px 20px 0;
    height: 160px; border-radius: 16px;
    display: flex; align-items: center; justify-content: center;
    border: 1px solid rgba(255,255,255,0.07);
    position: relative; overflow: hidden;
  }
  .compose-preview-text {
    font-size: 18px; font-weight: 700; text-align: center;
    padding: 20px; max-width: 100%; word-break: break-word;
    line-height: 1.3; margin: 0;
  }
  .compose-preview-meta {
    position: absolute; bottom: 8px; right: 12px;
    font-size: 10px; color: rgba(255,255,255,0.35); font-weight: 600;
  }
  .compose-input-wrap {
    margin: 12px 20px 0;
    position: relative;
  }
  .compose-textarea {
    width: 100%; min-height: 80px; max-height: 140px;
    background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08);
    border-radius: 14px; color: #fff; font-size: 15px; padding: 14px 44px 14px 14px;
    resize: none; outline: none; caret-color: #84cc16;
    box-sizing: border-box; font-family: inherit; line-height: 1.4;
    transition: border-color 0.15s;
  }
  .compose-textarea:focus { border-color: rgba(132,204,22,0.3); }
  .compose-textarea::placeholder { color: #333; }
  .compose-char-row {
    position: absolute; bottom: 12px; right: 12px;
    display: flex; align-items: center; gap: 4px;
  }
  .compose-section-label {
    padding: 14px 20px 8px;
    font-size: 10px; font-weight: 700; color: #333;
    text-transform: uppercase; letter-spacing: 0.8px;
  }
  .bg-picker-row { display: flex; align-items: center; gap: 8px; padding: 0 20px; }
  .bg-swatch {
    width: 38px; height: 38px; border-radius: 10px; flex-shrink: 0;
    border: 2.5px solid transparent; cursor: pointer;
    display: flex; align-items: center; justify-content: center;
    transition: border-color 0.15s, transform 0.15s;
  }
  .bg-swatch:hover { transform: scale(1.08); }
  .bg-swatch.active { border-color: #fff; }
  .bg-swatch svg { color: #fff; width: 14px; height: 14px; }
  .bg-page-btn {
    width: 38px; height: 38px; border-radius: 10px;
    background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.08);
    color: #555; font-size: 14px; cursor: pointer; flex-shrink: 0;
    transition: background 0.15s, color 0.15s;
  }
  .bg-page-btn:hover { background: rgba(255,255,255,0.1); color: #fff; }
  .color-picker-row { display: flex; gap: 8px; padding: 0 20px; flex-wrap: wrap; }
  .color-dot {
    width: 26px; height: 26px; border-radius: 50%;
    border: 2.5px solid transparent; cursor: pointer;
    transition: border-color 0.15s, transform 0.15s;
  }
  .color-dot:hover { transform: scale(1.1); }
  .color-dot.active { border-color: #fff; box-shadow: 0 0 0 2px rgba(255,255,255,0.2); }
  .compose-next-btn {
    display: block; width: calc(100% - 40px); margin: 20px 20px 0;
    padding: 14px; border-radius: 14px;
    background: linear-gradient(135deg,#84cc16,#65a30d);
    border: none; color: #000; font-size: 15px; font-weight: 800;
    cursor: pointer; transition: opacity 0.15s, transform 0.12s;
    letter-spacing: -0.2px;
  }
  .compose-next-btn:hover:not(:disabled) { opacity: 0.9; transform: translateY(-1px); }
  .compose-next-btn:active { transform: scale(0.98); }
  .compose-next-btn:disabled { opacity: 0.3; cursor: not-allowed; }

  /* settings step */
  .settings-preview {
    margin: 14px 20px 0;
    height: 80px; border-radius: 14px;
    display: flex; align-items: center; justify-content: center;
    border: 1px solid rgba(255,255,255,0.06);
  }
  .settings-sub {
    padding: 10px 20px 0;
    font-size: 13px; color: #555; margin: 0;
  }
  .duration-cards {
    display: grid; grid-template-columns: 1fr 1fr;
    gap: 8px; padding: 12px 20px;
  }
  .duration-card {
    padding: 14px; border-radius: 14px;
    background: rgba(255,255,255,0.03); border: 1.5px solid rgba(255,255,255,0.07);
    text-align: left; cursor: pointer; position: relative;
    transition: all 0.15s;
  }
  .duration-card:hover { background: rgba(255,255,255,0.06); border-color: rgba(132,204,22,0.2); }
  .duration-card.active {
    background: rgba(132,204,22,0.08); border-color: rgba(132,204,22,0.4);
  }
  .duration-card-time { font-size: 20px; font-weight: 800; color: #fff; display: block; }
  .duration-card-desc { font-size: 11px; color: #555; display: block; margin-top: 3px; }
  .duration-card-check {
    position: absolute; top: 10px; right: 10px;
    width: 20px; height: 20px; border-radius: 50%;
    background: #84cc16; color: #000;
    display: flex; align-items: center; justify-content: center;
  }
  .settings-expiry-info {
    display: flex; align-items: center; gap: 7px;
    padding: 0 20px 4px;
    font-size: 12px; color: #555;
  }
  .share-btn {
    display: flex; align-items: center; justify-content: center; gap: 10px;
    width: calc(100% - 40px); margin: 16px 20px 0;
    padding: 16px; border-radius: 16px;
    background: linear-gradient(135deg,#84cc16,#22c55e);
    border: none; color: #000; font-size: 16px; font-weight: 800;
    cursor: pointer; transition: opacity 0.15s, transform 0.12s;
    letter-spacing: -0.3px;
  }
  .share-btn:hover:not(.disabled) { opacity: 0.9; transform: translateY(-1px); }
  .share-btn:active { transform: scale(0.98); }
  .share-btn.disabled { opacity: 0.3; cursor: not-allowed; }
  .share-btn.saving { pointer-events: none; opacity: 0.6; }
  .share-spinner {
    width: 20px; height: 20px; border-radius: 50%;
    border: 2px solid rgba(0,0,0,0.2); border-top-color: #000;
    animation: spinAnim 0.7s linear infinite;
  }
  @keyframes spinAnim { to { transform: rotate(360deg); } }

  /* ── Extend modal ── */
  .extend-modal {
    background: #0a0a0a; border: 1px solid rgba(132,204,22,0.2);
    border-radius: 18px; padding: 20px; min-width: 260px;
    position: fixed; top: 50%; left: 50%; transform: translate(-50%,-50%);
    z-index: 20001;
    animation: popIn 0.2s cubic-bezier(0.34,1.56,0.64,1);
  }
  @keyframes popIn { from{opacity:0;transform:translate(-50%,-50%) scale(0.9)} to{opacity:1;transform:translate(-50%,-50%) scale(1)} }
  .extend-modal-head {
    display: flex; align-items: center; justify-content: space-between;
    margin-bottom: 10px; font-size: 15px; font-weight: 700; color: #fff;
  }
  .extend-modal-head button {
    background: none; border: none; color: #555; cursor: pointer; padding: 4px;
  }
  .extend-modal-sub { font-size: 13px; color: #555; margin: 0 0 14px; }
  .extend-option {
    display: block; width: 100%; padding: 12px 16px; margin-bottom: 8px;
    border-radius: 12px; background: rgba(132,204,22,0.07);
    border: 1px solid rgba(132,204,22,0.2); color: #84cc16;
    font-size: 14px; font-weight: 700; cursor: pointer; text-align: left;
    transition: background 0.15s;
  }
  .extend-option:hover { background: rgba(132,204,22,0.16); }
  .extend-option:last-child { margin-bottom: 0; }
`;

export default UpdatesView;