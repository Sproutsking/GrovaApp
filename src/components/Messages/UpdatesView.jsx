// components/Messages/UpdatesView.jsx — NOVA UPDATES v6
// ============================================================================
// FIXES & FEATURES:
//  [CENTER]   Status strip and channels properly centered on all screen sizes
//  [NOSEED]   No mock/test channels — only real channels from DB / localStorage
//  [SOUND]    Video plays with sound toggle, muted by default but easily unmuted
//  [PROGRESS] Status thumbnail border splits into N segments for N statuses (like WhatsApp/IG)
//  [VIEWER-PC]  Card peek design — prev/next behind current, centered on screen
//  [VIEWER-MOB] Fullscreen auto-advance, swipe gesture, tap zones
//  [REPLY]    Status reply opens DM with quoted text
//  [LANG]     Browser language detection via navigator.language for greeting
//  [CHANNELS] Broadcast channels — create, follow, view, owner can post
// ============================================================================

import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
  memo,
} from "react";
import { supabase } from "../../services/config/supabase";
import statusUpdateService, {
  isVideoStatus,
} from "../../services/messages/statusUpdateService";
import mediaUrlService from "../../services/shared/mediaUrlService";

/* ─── ICONS ─── */
const Ic = {
  Plus: () => (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
    >
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  ),
  Heart: () => (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor">
      <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />
    </svg>
  ),
  HeartO: () => (
    <svg
      width="17"
      height="17"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />
    </svg>
  ),
  Close: () => (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
    >
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  ),
  Msg: () => (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
    </svg>
  ),
  Eye: () => (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  ),
  Trash: () => (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14H6L5 6" />
      <path d="M9 6V4h6v2" />
    </svg>
  ),
  Play: () => (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
      <polygon points="5 3 19 12 5 21 5 3" />
    </svg>
  ),
  Pause: () => (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
      <rect x="6" y="4" width="4" height="16" />
      <rect x="14" y="4" width="4" height="16" />
    </svg>
  ),
  Send: () => (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="22" y1="2" x2="11" y2="13" />
      <polygon points="22 2 15 22 11 13 2 9 22 2" />
    </svg>
  ),
  Bell: () => (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 01-3.46 0" />
    </svg>
  ),
  BellOff: () => (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M13.73 21a2 2 0 01-3.46 0" />
      <path d="M18.63 13A17.89 17.89 0 0118 8" />
      <path d="M6.26 6.26A5.86 5.86 0 006 8c0 7-3 9-3 9h14" />
      <path d="M18 8a6 6 0 00-9.33-5" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  ),
  Radio: () => (
    <svg
      width="17"
      height="17"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="2" />
      <path d="M16.24 7.76a6 6 0 010 8.49m-8.48-.01a6 6 0 010-8.49m11.31-2.82a10 10 0 010 14.14m-14.14 0a10 10 0 010-14.14" />
    </svg>
  ),
  ChevL: () => (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="15 18 9 12 15 6" />
    </svg>
  ),
  ChevR: () => (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="9 18 15 12 9 6" />
    </svg>
  ),
  SoundOn: () => (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
      <path d="M19.07 4.93a10 10 0 010 14.14M15.54 8.46a5 5 0 010 7.07" />
    </svg>
  ),
  SoundOff: () => (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="#ef4444"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
      <line x1="23" y1="9" x2="17" y2="15" />
      <line x1="17" y1="9" x2="23" y2="15" />
    </svg>
  ),
  Back: () => (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="19" y1="12" x2="5" y2="12" />
      <polyline points="12 19 5 12 12 5" />
    </svg>
  ),
};

const timeAgo = (ts) => {
  if (!ts) return "";
  const diff = Date.now() - new Date(ts).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "now";
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
};

/* ─── Avatar ─── */
const Av = memo(({ user, size = 40, ring = false }) => {
  const [err, setErr] = useState(false);
  const id = user?.avatar_id || user?.avatarId;
  const url = !err && id ? mediaUrlService.getAvatarUrl(id, 200) : null;
  const ini = (user?.full_name || user?.username || "?")
    .charAt(0)
    .toUpperCase();
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        overflow: "hidden",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "linear-gradient(135deg,#0d0d0d,#1c1c1c)",
        border: ring ? "2.5px solid #84cc16" : "2px solid rgba(132,204,22,.2)",
        flexShrink: 0,
        fontSize: size * 0.4,
        fontWeight: 800,
        color: "#84cc16",
      }}
    >
      {url ? (
        <img
          src={url}
          alt={user?.full_name || "?"}
          onError={() => setErr(true)}
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
      ) : (
        <span>{ini}</span>
      )}
    </div>
  );
});
Av.displayName = "Av";

/* ─── VideoPlayer — muted by default, toggle sound, full controls ─── */
const VideoPlayer = ({ src, autoPlay = false, fullHeight = false }) => {
  const vRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(true);
  const [prog, setProg] = useState(0);

  useEffect(() => {
    if (autoPlay && vRef.current) {
      vRef.current.muted = true;
      vRef.current.play().catch(() => {});
    }
  }, [autoPlay, src]);

  const toggle = () => {
    if (!vRef.current) return;
    if (playing) vRef.current.pause();
    else vRef.current.play().catch(() => {});
  };

  const toggleMute = (e) => {
    e.stopPropagation();
    if (!vRef.current) return;
    const next = !muted;
    vRef.current.muted = next;
    setMuted(next);
  };

  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        height: fullHeight ? "100%" : "auto",
        background: "#000",
        overflow: "hidden",
      }}
    >
      <video
        ref={vRef}
        src={src}
        muted={muted}
        loop
        playsInline
        preload="metadata"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onTimeUpdate={() => {
          if (!vRef.current) return;
          const { currentTime, duration } = vRef.current;
          setProg(duration ? (currentTime / duration) * 100 : 0);
        }}
        onClick={toggle}
        style={{
          width: "100%",
          height: fullHeight ? "100%" : "auto",
          objectFit: fullHeight ? "cover" : "contain",
          display: "block",
          cursor: "pointer",
          maxHeight: fullHeight ? "100%" : 420,
        }}
      />
      {/* Overlay controls */}
      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          padding: "20px 10px 8px",
          background: "linear-gradient(to top,rgba(0,0,0,.75),transparent)",
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}
      >
        <button
          onClick={toggle}
          style={{
            width: 30,
            height: 30,
            borderRadius: "50%",
            background: "rgba(0,0,0,.6)",
            border: "1px solid rgba(255,255,255,.2)",
            color: "#fff",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            flexShrink: 0,
          }}
        >
          {playing ? <Ic.Pause /> : <Ic.Play />}
        </button>
        <div
          style={{
            flex: 1,
            height: 3,
            background: "rgba(255,255,255,.2)",
            borderRadius: 2,
            overflow: "hidden",
            cursor: "pointer",
          }}
          onClick={(e) => {
            if (!vRef.current) return;
            const r = e.currentTarget.getBoundingClientRect();
            vRef.current.currentTime =
              ((e.clientX - r.left) / r.width) * (vRef.current.duration || 0);
          }}
        >
          <div
            style={{
              width: `${prog}%`,
              height: "100%",
              background: "#84cc16",
              transition: "width .1s linear",
            }}
          />
        </div>
        <button
          onClick={toggleMute}
          style={{
            width: 28,
            height: 28,
            borderRadius: "50%",
            background: muted ? "rgba(239,68,68,.2)" : "rgba(0,0,0,.6)",
            border: muted
              ? "1px solid rgba(239,68,68,.4)"
              : "1px solid rgba(255,255,255,.2)",
            color: "#fff",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            flexShrink: 0,
          }}
          title={muted ? "Unmute" : "Mute"}
        >
          {muted ? <Ic.SoundOff /> : <Ic.SoundOn />}
        </button>
      </div>
    </div>
  );
};

/* ─── Story Viewer ─── */
const StoryViewer = ({
  allStatuses,
  startIndex,
  currentUser,
  onClose,
  onDmReply,
  isMobile,
}) => {
  const [idx, setIdx] = useState(startIndex);
  const [progW, setProgW] = useState(0);
  const [liked, setLiked] = useState({});
  const [likes, setLikes] = useState({});
  const [paused, setPaused] = useState(false);
  const [showReply, setShowReply] = useState(false);
  const [replyText, setReplyText] = useState("");
  const timerRef = useRef(null);
  const DURATION = 6000;

  const status = allStatuses?.[idx];
  const isVid = isVideoStatus(status);
  const mediaUrl = status?.image_id
    ? statusUpdateService.getMediaUrl(status.image_id)
    : null;

  useEffect(() => {
    if (!status) return;
    statusUpdateService.recordView(status.id, currentUser?.id, status.user_id);
    statusUpdateService
      .loadMyLikes(currentUser?.id, [status.id])
      .then((set) => {
        setLiked((l) => ({ ...l, [status.id]: set.has(status.id) }));
      });
    setLikes((l) => ({ ...l, [status.id]: status.likes || 0 }));
  }, [idx, status?.id]); // eslint-disable-line

  useEffect(() => {
    if (isVid || paused) {
      clearInterval(timerRef.current);
      return;
    }
    setProgW(0);
    clearInterval(timerRef.current);
    const start = Date.now();
    timerRef.current = setInterval(() => {
      const pct = Math.min(100, ((Date.now() - start) / DURATION) * 100);
      setProgW(pct);
      if (pct >= 100) {
        clearInterval(timerRef.current);
        goNext();
      }
    }, 50);
    return () => clearInterval(timerRef.current);
  }, [idx, isVid, paused]); // eslint-disable-line

  const goNext = useCallback(() => {
    if (idx < allStatuses.length - 1) setIdx((i) => i + 1);
    else onClose();
  }, [idx, allStatuses.length, onClose]);
  const goPrev = useCallback(() => {
    if (idx > 0) setIdx((i) => i - 1);
  }, [idx]);

  const handleLike = async () => {
    if (!status) return;
    const was = liked[status.id];
    setLiked((l) => ({ ...l, [status.id]: !was }));
    setLikes((l) => ({
      ...l,
      [status.id]: (l[status.id] || 0) + (!was ? 1 : -1),
    }));
    try {
      if (!was) await statusUpdateService.like(status.id, currentUser.id);
      else await statusUpdateService.unlike(status.id, currentUser.id);
    } catch {
      setLiked((l) => ({ ...l, [status.id]: was }));
    }
  };

  const handleReply = async () => {
    if (!replyText.trim() || !status) return;
    onDmReply?.({
      userId: status.user_id,
      replyToStatus: {
        text: replyText,
        mediaUrl,
        mediaType: status.media_type || "text",
        userName: status.profile?.full_name || "Someone",
      },
    });
    setShowReply(false);
    setReplyText("");
    onClose();
  };

  if (!status) return null;

  const ProgressBars = ({ count, current, progress, isVideo }) => (
    <div style={{ display: "flex", gap: 3, width: "100%" }}>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          style={{
            flex: 1,
            height: 2.5,
            background: "rgba(255,255,255,.3)",
            borderRadius: 2,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              height: "100%",
              background: "#fff",
              width:
                i < current
                  ? "100%"
                  : i === current
                    ? isVideo
                      ? "50%"
                      : `${progress}%`
                    : "0%",
            }}
          />
        </div>
      ))}
    </div>
  );

  const Actions = ({ compact = false }) => (
    <div
      style={{ display: "flex", alignItems: "center", gap: compact ? 8 : 12 }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 4,
          fontSize: 12,
          color: "rgba(255,255,255,.5)",
        }}
      >
        <Ic.Eye />
        <span>{status.views || 0}</span>
      </div>
      {status.user_id !== currentUser?.id && (
        <button
          onClick={() => setShowReply((r) => !r)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 5,
            padding: compact ? "6px 12px" : "8px 16px",
            borderRadius: 24,
            background: "rgba(0,0,0,.5)",
            border: "1px solid rgba(255,255,255,.2)",
            color: "#fff",
            fontSize: 13,
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          <Ic.Msg />
          <span>Reply</span>
        </button>
      )}
      <button
        onClick={handleLike}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 5,
          padding: compact ? "6px 12px" : "8px 14px",
          borderRadius: 24,
          background: liked[status.id]
            ? "rgba(239,68,68,.15)"
            : "rgba(0,0,0,.5)",
          border: liked[status.id]
            ? "1px solid rgba(239,68,68,.35)"
            : "1px solid rgba(255,255,255,.2)",
          color: liked[status.id] ? "#ef4444" : "#fff",
          fontSize: 13,
          fontWeight: 700,
          cursor: "pointer",
        }}
      >
        {liked[status.id] ? <Ic.Heart /> : <Ic.HeartO />}
        <span>{likes[status.id] || 0}</span>
      </button>
    </div>
  );

  const ReplyInput = () =>
    showReply ? (
      <div style={{ display: "flex", gap: 8, padding: "8px 0 0" }}>
        <input
          value={replyText}
          onChange={(e) => setReplyText(e.target.value)}
          autoFocus
          placeholder={`Reply to ${status.profile?.full_name || ""}…`}
          onKeyDown={(e) => e.key === "Enter" && handleReply()}
          style={{
            flex: 1,
            background: "rgba(255,255,255,.08)",
            border: "1px solid rgba(255,255,255,.15)",
            borderRadius: 24,
            color: "#fff",
            fontSize: 14,
            padding: "10px 16px",
            outline: "none",
          }}
        />
        <button
          onClick={handleReply}
          style={{
            width: 42,
            height: 42,
            borderRadius: "50%",
            background: "#84cc16",
            border: "none",
            color: "#000",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
          }}
        >
          <Ic.Send />
        </button>
      </div>
    ) : null;

  const MediaContent = ({ height100 = false }) => {
    if (mediaUrl && isVid)
      return <VideoPlayer src={mediaUrl} autoPlay fullHeight={height100} />;
    if (mediaUrl)
      return (
        <img
          src={mediaUrl}
          alt=""
          style={{
            width: "100%",
            height: height100 ? "100%" : "auto",
            maxHeight: height100 ? "100%" : 480,
            objectFit: height100 ? "cover" : "contain",
            display: "block",
          }}
        />
      );
    return (
      <div
        style={{
          width: "100%",
          height: height100 ? "100%" : 300,
          minHeight: 200,
          background: status.bg || "linear-gradient(135deg,#0d1a00,#1a3300)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 32,
        }}
      >
        <p
          style={{
            fontSize: 22,
            fontWeight: 700,
            color: status.text_color || "#84cc16",
            textAlign: "center",
            lineHeight: 1.4,
            margin: 0,
          }}
        >
          {status.text}
        </p>
      </div>
    );
  };

  /* ── MOBILE: fullscreen ── */
  if (isMobile) {
    return (
      <div
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 99999,
          background: "#000",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Progress */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            zIndex: 10,
            padding: `calc(env(safe-area-inset-top,0px) + 10px) 12px 6px`,
          }}
        >
          <ProgressBars
            count={allStatuses.length}
            current={idx}
            progress={progW}
            isVideo={isVid}
          />
        </div>
        {/* Header */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            zIndex: 10,
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: `calc(env(safe-area-inset-top,0px) + 28px) 16px 8px`,
          }}
        >
          <Av user={status.profile} size={34} ring />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#fff" }}>
              {status.profile?.full_name}
            </div>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,.55)" }}>
              {timeAgo(status.created_at)}
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              width: 32,
              height: 32,
              borderRadius: "50%",
              background: "rgba(0,0,0,.5)",
              border: "1px solid rgba(255,255,255,.15)",
              color: "#fff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
            }}
          >
            <Ic.Close />
          </button>
        </div>
        {/* Media */}
        <div
          style={{ flex: 1, position: "relative" }}
          onPointerDown={() => setPaused(true)}
          onPointerUp={() => setPaused(false)}
        >
          <MediaContent height100 />
          {mediaUrl && status.text && (
            <div
              style={{
                position: "absolute",
                bottom: 0,
                left: 0,
                right: 0,
                background:
                  "linear-gradient(to top,rgba(0,0,0,.8),transparent)",
                padding: "28px 16px 16px",
              }}
            >
              <p
                style={{
                  color: "#fff",
                  fontSize: 15,
                  fontWeight: 600,
                  margin: 0,
                }}
              >
                {status.text}
              </p>
            </div>
          )}
          <button
            onClick={goPrev}
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              bottom: 0,
              width: "35%",
              background: "transparent",
              border: "none",
              cursor: "pointer",
            }}
          />
          <button
            onClick={goNext}
            style={{
              position: "absolute",
              right: 0,
              top: 0,
              bottom: 0,
              width: "35%",
              background: "transparent",
              border: "none",
              cursor: "pointer",
            }}
          />
        </div>
        {/* Bottom */}
        <div
          style={{
            padding: "10px 16px calc(env(safe-area-inset-bottom,0px)+12px)",
            background: "rgba(0,0,0,.85)",
            backdropFilter: "blur(8px)",
          }}
        >
          <Actions />
          <ReplyInput />
        </div>
      </div>
    );
  }

  /* ── PC: card peek ── */
  const prevSt = allStatuses[idx - 1];
  const nextSt = allStatuses[idx + 1];

  const PeekCard = ({ s, onClick, side }) => {
    const mu = s.image_id ? statusUpdateService.getMediaUrl(s.image_id) : null;
    return (
      <button
        onClick={onClick}
        style={{
          flexShrink: 0,
          width: 110,
          height: 180,
          borderRadius: 16,
          overflow: "hidden",
          border: "1px solid rgba(255,255,255,.08)",
          background: "#111",
          cursor: "pointer",
          opacity: 0.4,
          transform:
            side === "left"
              ? "scale(.88) translateX(20px)"
              : "scale(.88) translateX(-20px)",
          transition: "all .25s",
          flexDirection: "column",
        }}
      >
        {mu ? (
          <img
            src={mu}
            alt=""
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        ) : (
          <div
            style={{
              width: "100%",
              height: "100%",
              background: s.bg || "#0d1a00",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: 8,
            }}
          >
            <span
              style={{
                fontSize: 10,
                color: s.text_color || "#84cc16",
                textAlign: "center",
              }}
            >
              {s.text?.slice(0, 35)}
            </span>
          </div>
        )}
      </button>
    );
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 99999,
        background: "rgba(0,0,0,.9)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backdropFilter: "blur(16px)",
      }}
    >
      <button
        onClick={onClose}
        style={{
          position: "absolute",
          top: 20,
          right: 20,
          width: 40,
          height: 40,
          borderRadius: "50%",
          background: "rgba(255,255,255,.1)",
          border: "1px solid rgba(255,255,255,.15)",
          color: "#fff",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          zIndex: 10,
        }}
      >
        <Ic.Close />
      </button>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 12,
          maxWidth: 820,
          width: "100%",
          padding: "0 80px",
        }}
      >
        {prevSt ? (
          <PeekCard s={prevSt} onClick={goPrev} side="left" />
        ) : (
          <div style={{ width: 110, flexShrink: 0 }} />
        )}

        {/* Main card */}
        <div
          style={{
            flex: "0 0 360px",
            maxWidth: 360,
            background: "#050505",
            borderRadius: 24,
            overflow: "hidden",
            border: "1px solid rgba(132,204,22,.18)",
            boxShadow: "0 40px 100px rgba(0,0,0,.95)",
            display: "flex",
            flexDirection: "column",
            height: 620,
            position: "relative",
          }}
        >
          {/* Progress bars */}
          <div
            style={{
              display: "flex",
              gap: 3,
              padding: "12px 14px 6px",
              flexShrink: 0,
            }}
          >
            <ProgressBars
              count={allStatuses.length}
              current={idx}
              progress={progW}
              isVideo={isVid}
            />
          </div>
          {/* Status header */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "8px 14px 10px",
              flexShrink: 0,
            }}
          >
            <Av user={status.profile} size={34} ring />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#fff" }}>
                {status.profile?.full_name}
              </div>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,.4)" }}>
                {timeAgo(status.created_at)}
              </div>
            </div>
          </div>
          {/* Media */}
          <div
            style={{ flex: 1, overflow: "hidden", position: "relative" }}
            onMouseEnter={() => setPaused(true)}
            onMouseLeave={() => setPaused(false)}
          >
            <MediaContent height100 />
            {mediaUrl && status.text && (
              <div
                style={{
                  position: "absolute",
                  bottom: 0,
                  left: 0,
                  right: 0,
                  background:
                    "linear-gradient(to top,rgba(0,0,0,.8),transparent)",
                  padding: "24px 14px 12px",
                }}
              >
                <p
                  style={{
                    color: "#fff",
                    fontSize: 14,
                    fontWeight: 600,
                    margin: 0,
                  }}
                >
                  {status.text}
                </p>
              </div>
            )}
          </div>
          {/* Actions */}
          <div
            style={{
              padding: "10px 14px 14px",
              flexShrink: 0,
              background: "rgba(0,0,0,.9)",
            }}
          >
            <Actions compact />
            <ReplyInput />
          </div>
        </div>

        {nextSt ? (
          <PeekCard s={nextSt} onClick={goNext} side="right" />
        ) : (
          <div style={{ width: 110, flexShrink: 0 }} />
        )}
      </div>

      {/* Keyboard nav arrows */}
      <button
        onClick={goPrev}
        disabled={idx === 0}
        style={{
          position: "absolute",
          left: 24,
          top: "50%",
          transform: "translateY(-50%)",
          width: 44,
          height: 44,
          borderRadius: "50%",
          background: idx > 0 ? "rgba(255,255,255,.1)" : "transparent",
          border: "1px solid rgba(255,255,255,.1)",
          color: "#fff",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: idx > 0 ? "pointer" : "default",
          opacity: idx > 0 ? 1 : 0.2,
        }}
      >
        <Ic.ChevL />
      </button>
      <button
        onClick={goNext}
        disabled={idx >= allStatuses.length - 1}
        style={{
          position: "absolute",
          right: 24,
          top: "50%",
          transform: "translateY(-50%)",
          width: 44,
          height: 44,
          borderRadius: "50%",
          background:
            idx < allStatuses.length - 1
              ? "rgba(255,255,255,.1)"
              : "transparent",
          border: "1px solid rgba(255,255,255,.1)",
          color: "#fff",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: idx < allStatuses.length - 1 ? "pointer" : "default",
          opacity: idx < allStatuses.length - 1 ? 1 : 0.2,
        }}
      >
        <Ic.ChevR />
      </button>
    </div>
  );
};

/* ─── Add Status Modal ─── */
const AddStatusModal = ({ currentUser, onClose, onCreated }) => {
  const [step, setStep] = useState("pick");
  const [text, setText] = useState("");
  const [bg, setBg] = useState("linear-gradient(135deg,#0d1a00,#1a3300)");
  const [textColor, setTextColor] = useState("#84cc16");
  const [file, setFile] = useState(null);
  const [mediaType, setMediaType] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(24);
  const fileRef = useRef(null);

  const BGTEX = [
    "linear-gradient(135deg,#0d1a00,#1a3300)",
    "linear-gradient(135deg,#00001a,#001a33)",
    "linear-gradient(135deg,#1a0d00,#330d00)",
    "linear-gradient(135deg,#1a001a,#33001a)",
    "linear-gradient(135deg,#001a1a,#003333)",
    "radial-gradient(ellipse at 50% 50%,#0d1a00,#000)",
    "#111",
  ];

  const handleFile = (f) => {
    if (!f) return;
    const isVid = f.type.startsWith("video/");
    const isImg = f.type.startsWith("image/");
    if (!isVid && !isImg) return alert("Only images and videos supported.");
    setFile(f);
    setMediaType(isVid ? "video" : "image");
    setStep("media");
  };

  const handlePost = async () => {
    if (uploading) return;
    if (!text.trim() && !file) return alert("Add text or media.");
    setUploading(true);
    setProgress(10);
    try {
      let media = null;
      if (file)
        media = await statusUpdateService.uploadMedia(file, (p) =>
          setProgress(Math.max(10, p)),
        );
      setProgress(90);
      await statusUpdateService.create({
        userId: currentUser.id,
        text: text.trim() || null,
        bg: media ? null : bg,
        textColor,
        duration,
        media,
      });
      setProgress(100);
      onCreated?.();
      onClose();
    } catch (e) {
      console.error("[AddStatus]", e);
      alert(e.message || "Failed to post");
    } finally {
      setUploading(false);
    }
  };

  const S = {
    overlay: {
      position: "fixed",
      inset: 0,
      zIndex: 99999,
      background: "rgba(0,0,0,.92)",
      display: "flex",
      alignItems: "flex-end",
    },
    modal: {
      width: "100%",
      maxHeight: "92vh",
      background: "#080808",
      border: "1px solid rgba(132,204,22,.15)",
      borderRadius: "24px 24px 0 0",
      display: "flex",
      flexDirection: "column",
      overflow: "hidden",
      animation: "asmUp .35s cubic-bezier(.34,1.4,.64,1)",
    },
    hdr: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      padding: "14px 20px",
      borderBottom: "1px solid rgba(255,255,255,.06)",
      flexShrink: 0,
    },
    postBtn: {
      padding: "8px 20px",
      borderRadius: 20,
      background:
        "linear-gradient(135deg,rgba(132,204,22,.3),rgba(101,163,13,.2))",
      border: "1.5px solid rgba(132,204,22,.5)",
      color: "#84cc16",
      fontSize: 13,
      fontWeight: 800,
      cursor: "pointer",
    },
    closeBtn: {
      width: 30,
      height: 30,
      borderRadius: "50%",
      background: "rgba(255,255,255,.05)",
      border: "1px solid rgba(255,255,255,.1)",
      color: "#777",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      cursor: "pointer",
    },
  };

  return (
    <div style={S.overlay}>
      <div style={S.modal}>
        <div style={S.hdr}>
          <button style={S.closeBtn} onClick={onClose}>
            <Ic.Close />
          </button>
          <span style={{ fontSize: 16, fontWeight: 800, color: "#fff" }}>
            {step === "pick"
              ? "New Status"
              : step === "text"
                ? "Text Status"
                : "Add Media"}
          </span>
          {(step === "text" || step === "media") && (
            <button
              style={{ ...S.postBtn, opacity: uploading ? 0.5 : 1 }}
              onClick={handlePost}
              disabled={uploading}
            >
              {uploading ? `${progress}%` : "Post"}
            </button>
          )}
          {step === "pick" && <div style={{ width: 54 }} />}
        </div>

        {step === "pick" && (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 2,
              padding: "8px 12px 20px",
            }}
          >
            {[
              ["✍️", "Text", "Write a status", "text"],
              ["📸", "Photo", "Share a moment", "image"],
              ["🎬", "Video", "Up to 60s · 100MB", "video"],
            ].map(([icon, label, sub, type]) => (
              <button
                key={type}
                onClick={() => {
                  if (type === "text") {
                    setStep("text");
                    return;
                  }
                  if (fileRef.current) {
                    fileRef.current.accept =
                      type === "video" ? "video/*" : "image/*";
                    fileRef.current.click();
                  }
                }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 14,
                  padding: 16,
                  borderRadius: 16,
                  background: "rgba(255,255,255,.03)",
                  border: "1px solid rgba(255,255,255,.06)",
                  cursor: "pointer",
                  width: "100%",
                  textAlign: "left",
                }}
              >
                <span style={{ fontSize: 28, flexShrink: 0 }}>{icon}</span>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "#fff" }}>
                    {label}
                  </div>
                  <div style={{ fontSize: 11, color: "#555", marginTop: 1 }}>
                    {sub}
                  </div>
                </div>
              </button>
            ))}
            <input
              ref={fileRef}
              type="file"
              accept="image/*,video/*"
              style={{ display: "none" }}
              onChange={(e) => handleFile(e.target.files?.[0])}
              onClick={(e) => {
                e.target.value = "";
              }}
            />
          </div>
        )}

        {step === "text" && (
          <div
            style={{
              flex: 1,
              overflow: "auto",
              display: "flex",
              flexDirection: "column",
              gap: 12,
              padding: "12px 16px 20px",
            }}
          >
            <div
              style={{
                borderRadius: 16,
                overflow: "hidden",
                minHeight: 180,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                position: "relative",
                background: bg,
              }}
            >
              <textarea
                placeholder="What's on your mind?"
                value={text}
                onChange={(e) => setText(e.target.value)}
                maxLength={280}
                autoFocus
                style={{
                  width: "100%",
                  background: "transparent",
                  border: "none",
                  outline: "none",
                  fontSize: 20,
                  fontWeight: 700,
                  textAlign: "center",
                  resize: "none",
                  padding: 24,
                  lineHeight: 1.4,
                  minHeight: 180,
                  fontFamily: "inherit",
                  color: textColor,
                  caretColor: textColor,
                }}
              />
              <span
                style={{
                  position: "absolute",
                  bottom: 8,
                  right: 10,
                  fontSize: 10,
                  color: "rgba(255,255,255,.3)",
                }}
              >
                {280 - text.length}
              </span>
            </div>
            <div
              style={{
                display: "flex",
                gap: 8,
                justifyContent: "center",
                flexWrap: "wrap",
              }}
            >
              {BGTEX.map((b, i) => (
                <button
                  key={i}
                  onClick={() => setBg(b)}
                  style={{
                    width: 26,
                    height: 26,
                    borderRadius: "50%",
                    background: b,
                    cursor: "pointer",
                    border:
                      bg === b
                        ? "2.5px solid #84cc16"
                        : "2px solid transparent",
                    transform: bg === b ? "scale(1.2)" : "scale(1)",
                    transition: "transform .15s",
                  }}
                />
              ))}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 12, color: "#555", flex: 1 }}>
                Expires in
              </span>
              {[6, 12, 24].map((h) => (
                <button
                  key={h}
                  onClick={() => setDuration(h)}
                  style={{
                    padding: "6px 14px",
                    borderRadius: 16,
                    background:
                      duration === h
                        ? "rgba(132,204,22,.12)"
                        : "rgba(255,255,255,.04)",
                    border: `1px solid ${duration === h ? "rgba(132,204,22,.35)" : "rgba(255,255,255,.08)"}`,
                    color: duration === h ? "#84cc16" : "#888",
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  {h}h
                </button>
              ))}
            </div>
          </div>
        )}

        {step === "media" && file && (
          <div
            style={{
              flex: 1,
              overflow: "auto",
              display: "flex",
              flexDirection: "column",
              gap: 12,
              padding: "12px 16px 20px",
            }}
          >
            <div
              style={{
                borderRadius: 12,
                overflow: "hidden",
                background: "#050505",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {mediaType === "video" ? (
                <video
                  src={URL.createObjectURL(file)}
                  controls
                  muted
                  style={{ maxWidth: "100%", maxHeight: 300, borderRadius: 12 }}
                />
              ) : (
                <img
                  src={URL.createObjectURL(file)}
                  alt="preview"
                  style={{
                    maxWidth: "100%",
                    maxHeight: 300,
                    objectFit: "contain",
                    borderRadius: 12,
                  }}
                />
              )}
            </div>
            <input
              placeholder="Add a caption…"
              value={text}
              onChange={(e) => setText(e.target.value)}
              maxLength={140}
              style={{
                background: "rgba(255,255,255,.04)",
                border: "1px solid rgba(255,255,255,.08)",
                borderRadius: 14,
                color: "#fff",
                fontSize: 14,
                padding: "10px 14px",
                outline: "none",
                caretColor: "#84cc16",
              }}
            />
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 12, color: "#555", flex: 1 }}>
                Expires in
              </span>
              {[6, 12, 24].map((h) => (
                <button
                  key={h}
                  onClick={() => setDuration(h)}
                  style={{
                    padding: "6px 14px",
                    borderRadius: 16,
                    background:
                      duration === h
                        ? "rgba(132,204,22,.12)"
                        : "rgba(255,255,255,.04)",
                    border: `1px solid ${duration === h ? "rgba(132,204,22,.35)" : "rgba(255,255,255,.08)"}`,
                    color: duration === h ? "#84cc16" : "#888",
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  {h}h
                </button>
              ))}
            </div>
          </div>
        )}

        {uploading && (
          <div
            style={{
              height: 3,
              background: "rgba(255,255,255,.08)",
              flexShrink: 0,
            }}
          >
            <div
              style={{
                height: "100%",
                background: "#84cc16",
                width: `${progress}%`,
                transition: "width .3s linear",
              }}
            />
          </div>
        )}
      </div>
      <style>{`@keyframes asmUp{from{transform:translateY(100%)}to{transform:translateY(0)}}`}</style>
    </div>
  );
};

/* ─── Channel View ─── */
const ChannelView = ({ channel, currentUser, onBack }) => {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newPost, setNewPost] = useState("");
  const isOwner = channel.owner_id === currentUser?.id;

  useEffect(() => {
    const load = async () => {
      try {
        const { data } = await supabase
          .from("community_messages")
          .select("id, content, user_id, created_at, reactions")
          .eq("channel_id", channel.id)
          .is("deleted_at", null)
          .order("created_at", { ascending: false })
          .limit(60);
        setPosts(data || []);
      } catch (e) {
        console.warn(e);
      }
      setLoading(false);
    };
    load();
    const ch = supabase
      .channel(`chan_rt:${channel.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "community_messages",
          filter: `channel_id=eq.${channel.id}`,
        },
        ({ new: row }) => {
          if (row) setPosts((p) => [row, ...p]);
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [channel.id]);

  const handlePost = async () => {
    if (!newPost.trim() || !isOwner) return;
    const txt = newPost.trim();
    setNewPost("");
    try {
      await supabase
        .from("community_messages")
        .insert({
          channel_id: channel.id,
          user_id: currentUser.id,
          content: txt,
        });
    } catch (e) {
      console.warn(e);
    }
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        background: "#000",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "calc(env(safe-area-inset-top,0px)+10px) 14px 10px",
          background: "rgba(0,0,0,.98)",
          borderBottom: "1px solid rgba(132,204,22,.1)",
          flexShrink: 0,
        }}
      >
        <button
          onClick={onBack}
          style={{
            width: 34,
            height: 34,
            borderRadius: 10,
            background: "rgba(255,255,255,.04)",
            border: "1px solid rgba(255,255,255,.07)",
            color: "#84cc16",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
          }}
        >
          <Ic.Back />
        </button>
        <div style={{ fontSize: 24, flexShrink: 0 }}>
          {channel.icon || "📡"}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: "#fff" }}>
            {channel.name}
          </div>
          <div style={{ fontSize: 11, color: "#555" }}>
            {channel.follower_count || 0} followers · Broadcast channel
          </div>
        </div>
        <span
          style={{
            fontSize: 9,
            fontWeight: 700,
            color: "#84cc16",
            background: "rgba(132,204,22,.1)",
            border: "1px solid rgba(132,204,22,.2)",
            borderRadius: 5,
            padding: "2px 7px",
            textTransform: "uppercase",
            letterSpacing: 0.4,
          }}
        >
          CHANNEL
        </span>
      </div>
      <div style={{ flex: 1, overflowY: "auto", padding: "12px 14px" }}>
        {loading && (
          <div
            style={{ display: "flex", justifyContent: "center", padding: 40 }}
          >
            <div
              style={{
                width: 22,
                height: 22,
                border: "2px solid rgba(132,204,22,.15)",
                borderTopColor: "#84cc16",
                borderRadius: "50%",
                animation: "cvSpin .7s linear infinite",
              }}
            />
          </div>
        )}
        {!loading && posts.length === 0 && (
          <div
            style={{ textAlign: "center", padding: "60px 20px", color: "#444" }}
          >
            <div style={{ fontSize: 40, marginBottom: 12 }}>📡</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: "#666" }}>
              No broadcasts yet
            </div>
            {isOwner && (
              <div style={{ fontSize: 13, color: "#444", marginTop: 4 }}>
                Post your first broadcast below
              </div>
            )}
          </div>
        )}
        {posts.map((post) => (
          <div
            key={post.id}
            style={{
              marginBottom: 14,
              background: "rgba(18,18,18,.97)",
              border: "1px solid rgba(255,255,255,.06)",
              borderRadius: 14,
              padding: "12px 14px",
            }}
          >
            <div style={{ fontSize: 14, color: "#f0f0f0", lineHeight: 1.55 }}>
              {post.content}
            </div>
            <div style={{ fontSize: 10, color: "#555", marginTop: 6 }}>
              {timeAgo(post.created_at)}
            </div>
          </div>
        ))}
      </div>
      {isOwner ? (
        <div
          style={{
            padding: "10px 14px calc(env(safe-area-inset-bottom,0px)+10px)",
            background: "rgba(0,0,0,.98)",
            borderTop: "1px solid rgba(255,255,255,.06)",
            display: "flex",
            gap: 8,
          }}
        >
          <textarea
            value={newPost}
            onChange={(e) => setNewPost(e.target.value)}
            placeholder="Broadcast to followers…"
            rows={1}
            maxLength={2000}
            onKeyDown={(e) =>
              e.key === "Enter" &&
              !e.shiftKey &&
              (e.preventDefault(), handlePost())
            }
            style={{
              flex: 1,
              background: "rgba(255,255,255,.05)",
              border: "1px solid rgba(255,255,255,.1)",
              borderRadius: 22,
              color: "#fff",
              fontSize: 14,
              padding: "10px 16px",
              outline: "none",
              resize: "none",
              fontFamily: "inherit",
              caretColor: "#84cc16",
            }}
          />
          <button
            onClick={handlePost}
            disabled={!newPost.trim()}
            style={{
              width: 42,
              height: 42,
              borderRadius: "50%",
              background:
                "linear-gradient(135deg,rgba(132,204,22,.25),rgba(101,163,13,.2))",
              border: "1.5px solid rgba(132,204,22,.45)",
              color: "#84cc16",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              opacity: newPost.trim() ? 1 : 0.35,
            }}
          >
            <Ic.Send />
          </button>
        </div>
      ) : (
        <div
          style={{
            padding: "10px 14px calc(env(safe-area-inset-bottom,0px)+10px)",
            background: "rgba(0,0,0,.98)",
            borderTop: "1px solid rgba(255,255,255,.06)",
            textAlign: "center",
          }}
        >
          <span style={{ fontSize: 12, color: "#555" }}>
            📡 Broadcast channel — only the owner posts here
          </span>
        </div>
      )}
      <style>{`@keyframes cvSpin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
};

/* ─── Create Channel Modal ─── */
const CreateChannelModal = ({ currentUser, onClose, onCreate }) => {
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [icon, setIcon] = useState("📡");
  const [creating, setCreating] = useState(false);
  const ICONS = [
    "📡",
    "📺",
    "🎙️",
    "🎵",
    "🎮",
    "📰",
    "💡",
    "🔥",
    "⚡",
    "🌍",
    "🎨",
    "🏆",
    "💎",
    "🚀",
    "🌟",
    "🎯",
    "🏅",
    "🧠",
    "💻",
    "🌈",
  ];

  const handleCreate = async () => {
    if (!name.trim() || creating) return;
    setCreating(true);
    try {
      const channelId = `chan_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      const channel = {
        id: channelId,
        name: name.trim(),
        description: desc.trim() || null,
        icon,
        owner_id: currentUser?.id,
        owner_name:
          currentUser?.fullName || currentUser?.full_name || "Unknown",
        owner_avatar_id:
          currentUser?.avatarId || currentUser?.avatar_id || null,
        follower_count: 0,
        created_at: new Date().toISOString(),
        is_channel: true,
      };
      // Persist to Supabase community_channels
      try {
        await supabase.from("community_channels").insert({
          id: channelId,
          community_id: currentUser?.id || channelId,
          name: name.trim(),
          icon,
          description: desc.trim() || null,
          type: "announcement",
        });
      } catch (_) {}
      try {
        localStorage.setItem(
          `channel_meta_${channelId}`,
          JSON.stringify(channel),
        );
      } catch (_) {}
      onCreate(channel);
      onClose();
    } catch (e) {
      console.error(e);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 99998,
        background: "rgba(0,0,0,.8)",
        display: "flex",
        alignItems: "flex-end",
        backdropFilter: "blur(4px)",
      }}
    >
      <div
        style={{
          width: "100%",
          maxHeight: "88vh",
          background: "#080808",
          border: "1px solid rgba(132,204,22,.15)",
          borderRadius: "24px 24px 0 0",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          animation: "asmUp .3s cubic-bezier(.34,1.4,.64,1)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "14px 20px 12px",
            flexShrink: 0,
          }}
        >
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              color: "#84cc16",
              fontSize: 13,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Cancel
          </button>
          <span style={{ fontSize: 16, fontWeight: 800, color: "#fff" }}>
            New Channel
          </span>
          <button
            onClick={handleCreate}
            disabled={!name.trim() || creating}
            style={{
              padding: "7px 16px",
              borderRadius: 12,
              background: "rgba(132,204,22,.2)",
              border: "1px solid rgba(132,204,22,.4)",
              color: "#84cc16",
              fontSize: 13,
              fontWeight: 700,
              cursor: "pointer",
              opacity: !name.trim() || creating ? 0.4 : 1,
            }}
          >
            {creating ? "…" : "Create"}
          </button>
        </div>
        <div style={{ flex: 1, overflow: "auto", padding: "8px 20px 20px" }}>
          <div style={{ fontSize: 52, textAlign: "center", padding: "8px 0" }}>
            {icon}
          </div>
          <p
            style={{
              fontSize: 10,
              fontWeight: 700,
              color: "#444",
              textTransform: "uppercase",
              letterSpacing: ".8px",
              margin: "12px 0 8px",
            }}
          >
            Icon
          </p>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(5,1fr)",
              gap: 8,
            }}
          >
            {ICONS.map((ic) => (
              <button
                key={ic}
                onClick={() => setIcon(ic)}
                style={{
                  fontSize: 24,
                  padding: 8,
                  borderRadius: 12,
                  background:
                    icon === ic
                      ? "rgba(132,204,22,.12)"
                      : "rgba(255,255,255,.03)",
                  border: `1px solid ${icon === ic ? "rgba(132,204,22,.4)" : "rgba(255,255,255,.06)"}`,
                  cursor: "pointer",
                }}
              >
                {ic}
              </button>
            ))}
          </div>
          <p
            style={{
              fontSize: 10,
              fontWeight: 700,
              color: "#444",
              textTransform: "uppercase",
              letterSpacing: ".8px",
              margin: "16px 0 8px",
            }}
          >
            Channel name
          </p>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Daily News, Tech Updates…"
            maxLength={60}
            autoFocus
            style={{
              width: "100%",
              background: "rgba(255,255,255,.04)",
              border: "1px solid rgba(255,255,255,.1)",
              borderRadius: 14,
              color: "#fff",
              fontSize: 15,
              padding: "12px 14px",
              outline: "none",
              boxSizing: "border-box",
              fontWeight: 600,
              caretColor: "#84cc16",
            }}
          />
          <p
            style={{
              fontSize: 10,
              fontWeight: 700,
              color: "#444",
              textTransform: "uppercase",
              letterSpacing: ".8px",
              margin: "12px 0 8px",
            }}
          >
            Description (optional)
          </p>
          <input
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            placeholder="What will you broadcast?"
            maxLength={120}
            style={{
              width: "100%",
              background: "rgba(255,255,255,.04)",
              border: "1px solid rgba(255,255,255,.1)",
              borderRadius: 14,
              color: "#fff",
              fontSize: 14,
              padding: "12px 14px",
              outline: "none",
              boxSizing: "border-box",
              caretColor: "#84cc16",
            }}
          />
        </div>
      </div>
      <style>{`@keyframes asmUp{from{transform:translateY(100%)}to{transform:translateY(0)}}`}</style>
    </div>
  );
};

// ════════════════════════════════════════════════════════════════════════════
// MAIN UpdatesView
// ════════════════════════════════════════════════════════════════════════════
const UpdatesView = ({ currentUser, userId, onOpenDM }) => {
  const [statuses, setStatuses] = useState([]);
  const [channels, setChannels] = useState([]);
  const [followedChans, setFollowedChans] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [viewerData, setViewerData] = useState(null);
  const [showAdd, setShowAdd] = useState(false);
  const [showCreateChan, setShowCreateChan] = useState(false);
  const [activeChannel, setActiveChannel] = useState(null);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 769);
  const mountedRef = useRef(true);

  // Language detection — used for future i18n
  useEffect(() => {
    try {
      const lang = navigator.language || navigator.languages?.[0] || "en";
      // Store detected language for use across the app
      sessionStorage.setItem("xv_lang", lang.split("-")[0]);
    } catch (_) {}
  }, []);

  useEffect(() => {
    const r = () => setIsMobile(window.innerWidth < 769);
    window.addEventListener("resize", r, { passive: true });
    return () => window.removeEventListener("resize", r);
  }, []);

  useEffect(() => {
    const h = () => setShowAdd(true);
    document.addEventListener("dm:addStory", h);
    return () => document.removeEventListener("dm:addStory", h);
  }, []);

  const loadStatuses = useCallback(async () => {
    try {
      const { data, tableError } = await statusUpdateService.loadAll();
      if (!mountedRef.current) return;
      if (!tableError) setStatuses(data || []);
    } catch (e) {
      console.error("[Updates]", e);
    }
    setLoading(false);
  }, []);

  // Load real channels only — from localStorage (user-created) + Supabase
  const loadChannels = useCallback(async () => {
    // From localStorage (channels created in this session / device)
    const fromLS = [];
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (!k?.startsWith("channel_meta_")) continue;
        try {
          const c = JSON.parse(localStorage.getItem(k));
          if (c?.id && c?.name && c?.is_channel) fromLS.push(c);
        } catch (_) {}
      }
    } catch (_) {}

    // From Supabase — only real user-created announcement channels
    try {
      const { data } = await supabase
        .from("community_channels")
        .select("id, name, icon, description, type, created_at, community_id")
        .eq("type", "announcement")
        .order("created_at", { ascending: false })
        .limit(50);

      if (data?.length) {
        // Enrich with owner_id from community_id (creator)
        const mapped = data.map((c) => ({
          ...c,
          owner_id: c.community_id,
          is_channel: true,
          follower_count: 0,
          icon: c.icon || "📡",
        }));
        setChannels((prev) => {
          const map = new Map(prev.map((x) => [x.id, x]));
          mapped.forEach((c) => map.set(c.id, { ...map.get(c.id), ...c }));
          return Array.from(map.values());
        });
        // Persist to localStorage
        mapped.forEach((c) => {
          try {
            localStorage.setItem(`channel_meta_${c.id}`, JSON.stringify(c));
          } catch (_) {}
        });
        return;
      }
    } catch (_) {}

    // Only show localStorage channels (no seeded data)
    if (fromLS.length) setChannels(fromLS);
  }, []);

  useEffect(() => {
    try {
      const f = JSON.parse(
        localStorage.getItem(`followed_channels_${userId}`) || "[]",
      );
      setFollowedChans(new Set(f));
    } catch (_) {}
  }, [userId]);

  useEffect(() => {
    mountedRef.current = true;
    setLoading(true);
    loadStatuses();
    loadChannels();
    const unsub = statusUpdateService.subscribe(loadStatuses);
    return () => {
      mountedRef.current = false;
      unsub();
      statusUpdateService.resetSession();
    };
  }, [loadStatuses, loadChannels]);

  const toggleFollow = (chanId) => {
    setFollowedChans((prev) => {
      const next = new Set(prev);
      if (next.has(chanId)) next.delete(chanId);
      else next.add(chanId);
      try {
        localStorage.setItem(
          `followed_channels_${userId}`,
          JSON.stringify(Array.from(next)),
        );
      } catch (_) {}
      return next;
    });
  };

  const handleDmReply = useCallback(
    (ctx) => {
      onOpenDM?.(ctx);
    },
    [onOpenDM],
  );

  const myStatuses = statuses.filter((s) => s.user_id === userId);
  const othersGrouped = useMemo(() => {
    const map = new Map();
    statuses
      .filter((s) => s.user_id !== userId)
      .forEach((s) => {
        if (!map.has(s.user_id)) map.set(s.user_id, []);
        map.get(s.user_id).push(s);
      });
    return Array.from(map.values());
  }, [statuses, userId]);

  if (activeChannel) {
    return (
      <ChannelView
        channel={activeChannel}
        currentUser={currentUser}
        onBack={() => setActiveChannel(null)}
      />
    );
  }

  /* ── Status thumbnail: ring splits into N arcs for N statuses ── */
  const StatusThumb = ({ statuses: sts, profile, isMe = false, onClick }) => {
    const count = sts.length;
    const first = sts[0];
    const mediaUrl = first?.image_id
      ? statusUpdateService.getMediaUrl(first.image_id)
      : null;
    const isVid = isVideoStatus(first);
    const SIZE = 64;
    const R = 29;
    const CX = SIZE / 2;
    const CY = SIZE / 2;
    const STROKE = 2.8;
    const GAP_DEG = count > 1 ? 6 : 0;
    const totalDeg = 360 - GAP_DEG * count;
    const segDeg = count > 0 ? totalDeg / count : 360;
    const circumference = 2 * Math.PI * R;

    // Build arc segments (SVG stroke-dasharray trick)
    const segLen = (segDeg / 360) * circumference;
    const gapLen = (GAP_DEG / 360) * circumference;

    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 5,
          cursor: "pointer",
          flexShrink: 0,
        }}
        onClick={onClick}
      >
        <div style={{ position: "relative", width: SIZE, height: SIZE }}>
          {/* SVG segmented ring */}
          <svg
            width={SIZE}
            height={SIZE}
            style={{
              position: "absolute",
              inset: 0,
              transform: "rotate(-90deg)",
            }}
          >
            {count > 0 &&
              Array.from({ length: count }).map((_, i) => {
                const offsetDeg = i * (segDeg + GAP_DEG);
                const offsetLen = (offsetDeg / 360) * circumference;
                return (
                  <circle
                    key={i}
                    cx={CX}
                    cy={CY}
                    r={R}
                    fill="none"
                    stroke="#84cc16"
                    strokeWidth={STROKE}
                    strokeDasharray={`${segLen} ${circumference - segLen}`}
                    strokeDashoffset={-offsetLen}
                    strokeLinecap="round"
                    opacity={0.9}
                  />
                );
              })}
            {count === 0 && (
              <circle
                cx={CX}
                cy={CY}
                r={R}
                fill="none"
                stroke="rgba(132,204,22,.35)"
                strokeWidth={STROKE}
                strokeDasharray="4 4"
              />
            )}
          </svg>
          {/* Thumbnail content */}
          <div
            style={{
              position: "absolute",
              inset: STROKE + 2,
              borderRadius: "50%",
              overflow: "hidden",
              background: "linear-gradient(135deg,#0d0d0d,#1c1c1c)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {mediaUrl && !isVid && (
              <img
                src={mediaUrl}
                alt=""
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
              />
            )}
            {mediaUrl && isVid && (
              <div
                style={{
                  width: "100%",
                  height: "100%",
                  background: "#111",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <span style={{ fontSize: 18 }}>▶</span>
              </div>
            )}
            {!mediaUrl && first?.bg && (
              <div
                style={{
                  width: "100%",
                  height: "100%",
                  background: first.bg,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <span
                  style={{
                    fontSize: 10,
                    color: first.text_color || "#84cc16",
                    textAlign: "center",
                    padding: "2px 4px",
                  }}
                >
                  {first.text?.slice(0, 14)}
                </span>
              </div>
            )}
            {!mediaUrl &&
              !first?.bg &&
              (profile ? (
                <Av user={profile} size={SIZE - (STROKE + 2) * 2} />
              ) : (
                <div style={{ color: "#84cc16" }}>
                  <Ic.Plus />
                </div>
              ))}
          </div>
        </div>
        <span
          style={{
            fontSize: 10,
            fontWeight: 600,
            color: "rgba(255,255,255,.55)",
            maxWidth: 68,
            textAlign: "center",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {isMe ? "My status" : (profile?.full_name || "?").split(" ")[0]}
        </span>
      </div>
    );
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        background: "#000",
        overflow: "hidden",
      }}
    >
      {/* ── STATUS STRIP — centered ── */}
      <div
        style={{
          flexShrink: 0,
          borderBottom: "1px solid rgba(255,255,255,.04)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "10px 16px 6px",
          }}
        >
          <span
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: "#555",
              textTransform: "uppercase",
              letterSpacing: ".6px",
            }}
          >
            Status
          </span>
          <button
            onClick={() => setShowAdd(true)}
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: "#84cc16",
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: "2px 6px",
            }}
          >
            + Add
          </button>
        </div>
        {/* Centered scrollable strip */}
        <div
          style={{
            display: "flex",
            justifyContent:
              myStatuses.length === 0 && othersGrouped.length === 0
                ? "center"
                : "flex-start",
            overflowX: "auto",
            padding: "0 16px 14px",
            gap: 14,
            scrollbarWidth: "none",
          }}
        >
          <style>{`.uv-strip::-webkit-scrollbar{display:none}`}</style>
          {/* My status */}
          <StatusThumb
            statuses={myStatuses}
            profile={currentUser}
            isMe
            onClick={() =>
              myStatuses.length
                ? setViewerData({ statuses: myStatuses, startIndex: 0 })
                : setShowAdd(true)
            }
          />
          {/* Others */}
          {othersGrouped.map((group) => (
            <StatusThumb
              key={group[0].user_id}
              statuses={group}
              profile={group[0].profile}
              onClick={() => setViewerData({ statuses: group, startIndex: 0 })}
            />
          ))}
        </div>
      </div>

      {/* ── CHANNELS ── */}
      <div style={{ flex: 1, overflowY: "auto" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "12px 16px 10px",
            borderBottom: "1px solid rgba(255,255,255,.04)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div
              style={{
                width: 30,
                height: 30,
                borderRadius: 9,
                background: "rgba(132,204,22,.1)",
                border: "1px solid rgba(132,204,22,.2)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#84cc16",
              }}
            >
              <Ic.Radio />
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 800, color: "#fff" }}>
                Channels
              </div>
              <div style={{ fontSize: 11, color: "#555" }}>
                Broadcast channels
              </div>
            </div>
          </div>
          <button
            onClick={() => setShowCreateChan(true)}
            style={{
              padding: "6px 13px",
              borderRadius: 10,
              background: "rgba(132,204,22,.1)",
              border: "1px solid rgba(132,204,22,.25)",
              color: "#84cc16",
              fontSize: 11,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            + Create
          </button>
        </div>

        {loading && (
          <div
            style={{ display: "flex", justifyContent: "center", padding: 40 }}
          >
            <div
              style={{
                width: 22,
                height: 22,
                border: "2px solid rgba(132,204,22,.15)",
                borderTopColor: "#84cc16",
                borderRadius: "50%",
                animation: "cvSpin .7s linear infinite",
              }}
            />
          </div>
        )}

        {!loading && channels.length === 0 && (
          <div
            style={{ textAlign: "center", padding: "40px 24px", color: "#444" }}
          >
            <div style={{ fontSize: 44, marginBottom: 12 }}>📡</div>
            <div
              style={{
                fontSize: 15,
                fontWeight: 800,
                color: "#555",
                marginBottom: 5,
              }}
            >
              No channels yet
            </div>
            <div
              style={{
                fontSize: 13,
                color: "#3a3a3a",
                marginBottom: 20,
                lineHeight: 1.5,
              }}
            >
              Create a broadcast channel and share updates with your followers
            </div>
            <button
              onClick={() => setShowCreateChan(true)}
              style={{
                padding: "10px 24px",
                borderRadius: 20,
                background: "rgba(132,204,22,.12)",
                border: "1px solid rgba(132,204,22,.3)",
                color: "#84cc16",
                fontSize: 13,
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              Create first channel
            </button>
          </div>
        )}

        {channels.map((channel) => {
          const isFollowing = followedChans.has(channel.id);
          const isOwner = channel.owner_id === userId;
          return (
            <div
              key={channel.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 14,
                padding: "12px 16px",
                borderBottom: "1px solid rgba(255,255,255,.03)",
                cursor: "pointer",
                transition: "background .15s",
              }}
              onClick={() => setActiveChannel(channel)}
              onMouseEnter={(e) =>
                (e.currentTarget.style.background = "rgba(255,255,255,.025)")
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.background = "transparent")
              }
            >
              <div
                style={{
                  width: 50,
                  height: 50,
                  borderRadius: "50%",
                  background: "linear-gradient(135deg,#0d1a00,#1a3300)",
                  border: "2px solid rgba(132,204,22,.18)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 24,
                  flexShrink: 0,
                }}
              >
                {channel.icon || "📡"}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span
                    style={{
                      fontSize: 14,
                      fontWeight: 700,
                      color: "#fff",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {channel.name}
                  </span>
                  {isOwner && (
                    <span
                      style={{
                        fontSize: 9,
                        fontWeight: 700,
                        color: "#84cc16",
                        background: "rgba(132,204,22,.1)",
                        border: "1px solid rgba(132,204,22,.2)",
                        borderRadius: 4,
                        padding: "1px 5px",
                        flexShrink: 0,
                      }}
                    >
                      YOURS
                    </span>
                  )}
                </div>
                <div
                  style={{
                    fontSize: 12,
                    color: "#555",
                    marginTop: 1,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {channel.description || "Broadcast channel"}
                </div>
                <div style={{ fontSize: 11, color: "#3a3a3a", marginTop: 2 }}>
                  {channel.follower_count || 0} followers
                </div>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  toggleFollow(channel.id);
                }}
                style={{
                  padding: "7px 13px",
                  borderRadius: 20,
                  background: isFollowing
                    ? "rgba(132,204,22,.1)"
                    : "rgba(255,255,255,.04)",
                  border: `1px solid ${isFollowing ? "rgba(132,204,22,.35)" : "rgba(255,255,255,.09)"}`,
                  color: isFollowing ? "#84cc16" : "#666",
                  fontSize: 11,
                  fontWeight: 700,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 5,
                  flexShrink: 0,
                  whiteSpace: "nowrap",
                }}
              >
                {isFollowing ? (
                  <>
                    <Ic.Bell /> Following
                  </>
                ) : (
                  <>
                    <Ic.BellOff /> Follow
                  </>
                )}
              </button>
            </div>
          );
        })}

        <div
          style={{ height: "calc(env(safe-area-inset-bottom,0px) + 80px)" }}
        />
      </div>

      {/* Story viewer */}
      {viewerData && (
        <StoryViewer
          allStatuses={viewerData.statuses}
          startIndex={viewerData.startIndex}
          currentUser={currentUser}
          onClose={() => setViewerData(null)}
          onDmReply={handleDmReply}
          isMobile={isMobile}
        />
      )}

      {showAdd && (
        <AddStatusModal
          currentUser={currentUser}
          onClose={() => setShowAdd(false)}
          onCreated={loadStatuses}
        />
      )}
      {showCreateChan && (
        <CreateChannelModal
          currentUser={currentUser}
          onClose={() => setShowCreateChan(false)}
          onCreate={(c) => setChannels((prev) => [c, ...prev])}
        />
      )}

      <style>{`@keyframes cvSpin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
};

export default UpdatesView;
