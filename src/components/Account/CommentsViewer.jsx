// ============================================================================
// src/components/Account/CommentsViewer.jsx
//
// Premium Comments Viewer — the benchmark for what a comments tab can be.
//
// Features per comment card:
//   • Your avatar + name + timestamp
//   • Parsed @mentions (blue) and #hashtags (teal) as interactive chips
//   • Optimistic ❤️ reaction with pop animation
//   • Inline replies — load-on-demand, threaded with a vertical connector
//   • Each reply: avatar, name, handle, time, text (parsed), like reaction
//   • "Commented on" context strip: thumbnail + content preview + author
//   • "View Post" CTA — right-aligned pill, present but never loud
//   • Smooth staggered entrance animations
// ============================================================================

import React, { useState, useEffect, useRef } from "react";
import {
  ArrowLeft, MessageSquare, Heart, CornerDownRight,
  ChevronDown, ChevronUp, ExternalLink,
  Play, Image, BookOpen, Film, Clock, Hash, AtSign,
} from "lucide-react";
import { supabase } from "../../services/config/supabase";
import mediaUrlService from "../../services/shared/mediaUrlService";

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────
const fmt = (n) => {
  if (!n && n !== 0) return "0";
  const v = Number(n);
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(1)}K`;
  return String(Math.floor(v));
};

const timeAgo = (d) => {
  if (!d) return "";
  const s = (Date.now() - new Date(d)) / 1000;
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 604800) return `${Math.floor(s / 86400)}d ago`;
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric" });
};

const getImageUrl = (mediaId, w = 200, h = 200) => {
  if (!mediaId) return null;
  try {
    const url = mediaUrlService.getImageUrl(mediaId);
    if (!url || !url.startsWith("http")) return null;
    const base = url.split("?")[0];
    return base.includes("supabase")
      ? `${base}?quality=75&width=${w}&height=${h}&resize=cover&format=webp`
      : url;
  } catch { return null; }
};

const getAvatarUrl = (avatarId) => {
  if (!avatarId) return null;
  try {
    const fn = mediaUrlService.getAvatarUrl || mediaUrlService.getImageUrl;
    const url = fn(avatarId, 80);
    if (!url || !url.startsWith("http")) return null;
    const base = url.split("?")[0];
    return base.includes("supabase")
      ? `${base}?quality=80&width=80&height=80&resize=cover&format=webp`
      : url;
  } catch { return null; }
};

// ─────────────────────────────────────────────────────────────────────────────
// PARSED TEXT — @mentions turn blue, #tags turn teal
// ─────────────────────────────────────────────────────────────────────────────
const ParsedText = ({ text, className = "" }) => {
  if (!text) return null;
  const parts = text.split(/(@[\w.]+|#[\w]+)/g);
  return (
    <span className={className}>
      {parts.map((part, i) => {
        if (/^@[\w.]+$/.test(part))
          return <span key={i} className="cv-mention">{part}</span>;
        if (/^#[\w]+$/.test(part))
          return <span key={i} className="cv-tag">{part}</span>;
        return <span key={i}>{part}</span>;
      })}
    </span>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// LIKE BUTTON — optimistic, animated heart pop
// ─────────────────────────────────────────────────────────────────────────────
const LikeButton = ({ commentId, initialLikes = 0, currentUserId, size = "sm" }) => {
  const [liked,  setLiked]  = useState(false);
  const [count,  setCount]  = useState(Number(initialLikes) || 0);
  const [popped, setPopped] = useState(false);

  const toggle = (e) => {
    e.stopPropagation();
    const next = !liked;
    setLiked(next);
    setCount(c => next ? c + 1 : Math.max(0, c - 1));
    setPopped(true);
    setTimeout(() => setPopped(false), 450);
    if (currentUserId && commentId) {
      if (next) {
        supabase.from("comment_likes")
          .upsert({ comment_id: commentId, user_id: currentUserId })
          .then(() => {});
      } else {
        supabase.from("comment_likes")
          .delete().match({ comment_id: commentId, user_id: currentUserId })
          .then(() => {});
      }
    }
  };

  const sz = size === "sm" ? 12 : 11;

  return (
    <button
      className={`cv-like-btn ${liked ? "cv-liked" : ""} ${popped ? "cv-pop" : ""} cv-like-${size}`}
      onClick={toggle}
      aria-label={liked ? "Unlike" : "Like"}
    >
      <Heart size={sz} fill={liked ? "#f87171" : "none"} stroke={liked ? "#f87171" : "currentColor"} />
      {count > 0 && <span>{fmt(count)}</span>}
    </button>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// AVATAR — with image fallback to initial letter
// ─────────────────────────────────────────────────────────────────────────────
const Avatar = ({ avatarId, name, size = 32, accentColor = "#34d399" }) => {
  const [src, setSrc] = useState(() => getAvatarUrl(avatarId));
  const initial = (name || "U")[0].toUpperCase();

  return (
    <div
      className="cv-avatar-wrap"
      style={{
        width: size, height: size, flexShrink: 0,
        borderRadius: "50%", overflow: "hidden",
        background: `linear-gradient(135deg, ${accentColor}33, ${accentColor}11)`,
        border: `1.5px solid ${accentColor}44`,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: size * 0.38, fontWeight: 800, color: accentColor,
      }}
    >
      {src ? (
        <img
          src={src} alt=""
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
          onError={() => setSrc(null)}
        />
      ) : initial}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// REPLY ITEM
// ─────────────────────────────────────────────────────────────────────────────
const ReplyItem = ({ reply, currentUserId, isLast }) => {
  const name = reply.profiles?.full_name || reply.profiles?.username || "User";
  const handle = reply.profiles?.username || "user";
  const avatarId = reply.profiles?.avatar_id;

  return (
    <div className={`cv-reply-row ${isLast ? "cv-reply-last" : ""}`}>
      {/* thread line */}
      <div className="cv-thread-line" />
      <div className="cv-thread-elbow" />

      <div className="cv-reply-inner">
        <Avatar avatarId={avatarId} name={name} size={26} accentColor="#818cf8" />
        <div className="cv-reply-content">
          <div className="cv-reply-meta">
            <span className="cv-reply-name">{name}</span>
            <span className="cv-reply-handle">@{handle}</span>
            <span className="cv-reply-dot">·</span>
            <span className="cv-reply-time">{timeAgo(reply.created_at)}</span>
          </div>
          <p className="cv-reply-text">
            <ParsedText text={reply.content} />
          </p>
          <LikeButton
            commentId={reply.id}
            initialLikes={reply.likes || 0}
            currentUserId={currentUserId}
            size="xs"
          />
        </div>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// CONTEXT STRIP — the post/reel/story this comment was left on
// ─────────────────────────────────────────────────────────────────────────────
const ContextStrip = ({ comment, onGoToPost }) => {
  const [ctx,     setCtx]     = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        if (comment.post_id) {
          const { data } = await supabase
            .from("posts")
            .select("id, content, image_ids, profiles(full_name, username, avatar_id)")
            .eq("id", comment.post_id).single();
          if (!cancelled && data)
            setCtx({ ...data, _type: "post", _thumb: getImageUrl(data.image_ids?.[0]) });

        } else if (comment.reel_id) {
          const { data } = await supabase
            .from("reels")
            .select("id, caption, thumbnail_id, video_metadata, profiles(full_name, username, avatar_id)")
            .eq("id", comment.reel_id).single();
          if (!cancelled && data)
            setCtx({
              ...data, _type: "reel",
              _thumb: data.thumbnail_id
                ? getImageUrl(data.thumbnail_id)
                : (data.video_metadata?.thumbnail_url || null),
            });

        } else if (comment.story_id) {
          const { data } = await supabase
            .from("stories")
            .select("id, title, preview, cover_image_id, profiles(full_name, username, avatar_id)")
            .eq("id", comment.story_id).single();
          if (!cancelled && data)
            setCtx({ ...data, _type: "story", _thumb: getImageUrl(data.cover_image_id) });
        }
      } catch { /* silent */ }
      finally { if (!cancelled) setLoading(false); }
    };
    load();
    return () => { cancelled = true; };
  }, [comment.id]);

  if (loading) {
    return (
      <div className="cv-ctx-loading">
        <div className="cv-ctx-shimmer" />
      </div>
    );
  }
  if (!ctx) return null;

  const typeConfig = {
    post:  { Icon: Image,    label: "Post",  color: "#84cc16" },
    reel:  { Icon: Film,     label: "Reel",  color: "#818cf8" },
    story: { Icon: BookOpen, label: "Story", color: "#f59e0b" },
  }[ctx._type] || { Icon: Image, label: "Post", color: "#84cc16" };

  const bodyText = ctx.content || ctx.caption || ctx.title || ctx.preview || "";
  const author = ctx.profiles?.username || ctx.profiles?.full_name || "user";

  return (
    <div className="cv-ctx-strip">
      {/* ── divider label ── */}
      <div className="cv-ctx-divider">
        <div className="cv-ctx-divider-line" />
        <span className="cv-ctx-divider-label">commented on</span>
        <div className="cv-ctx-divider-line" />
      </div>

      {/* ── content card ── */}
      <div className="cv-ctx-card">

        {/* thumbnail */}
        <div className="cv-ctx-thumb" style={{ borderColor: `${typeConfig.color}22` }}>
          {ctx._thumb ? (
            <img src={ctx._thumb} alt="" />
          ) : (
            <div className="cv-ctx-thumb-fallback" style={{ background: `${typeConfig.color}11` }}>
              <typeConfig.Icon size={14} style={{ color: typeConfig.color }} />
            </div>
          )}
          {ctx._type === "reel" && (
            <div className="cv-ctx-play-badge">
              <Play size={7} fill="#fff" style={{ marginLeft: 1 }} />
            </div>
          )}
        </div>

        {/* info */}
        <div className="cv-ctx-info">
          <div className="cv-ctx-type-pill" style={{ color: typeConfig.color, background: `${typeConfig.color}14`, borderColor: `${typeConfig.color}25` }}>
            <typeConfig.Icon size={9} />
            {typeConfig.label}
          </div>
          <p className="cv-ctx-body">
            {bodyText ? `${bodyText.slice(0, 72)}${bodyText.length > 72 ? "…" : ""}` : `A ${typeConfig.label.toLowerCase()}`}
          </p>
          <span className="cv-ctx-author">@{author}</span>
        </div>

        {/* View CTA — present, placed right, never screaming */}
        <button
          className="cv-view-btn"
          onClick={(e) => { e.stopPropagation(); onGoToPost && onGoToPost(ctx); }}
          title={`Open ${typeConfig.label}`}
        >
          <ExternalLink size={12} />
          <span>View</span>
        </button>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// COMMENT CARD — one comment with all features
// ─────────────────────────────────────────────────────────────────────────────
const CommentCard = ({ comment, index, profileData, currentUser, onGoToPost }) => {
  const [repliesOpen,   setRepliesOpen]   = useState(false);
  const [replies,       setReplies]       = useState([]);
  const [loadingReplies, setLoadingReplies] = useState(false);
  const [repliesLoaded, setRepliesLoaded] = useState(false);
  // derive reply count from DB field or live loaded
  const replyCount = repliesLoaded ? replies.length : (comment.reply_count || 0);

  const openReplies = async () => {
    if (!repliesLoaded) {
      setLoadingReplies(true);
      try {
        const { data } = await supabase
          .from("comments")
          .select(`
            id, content, created_at, likes,
            profiles(full_name, username, avatar_id)
          `)
          .eq("parent_id", comment.id)
          .order("created_at", { ascending: true })
          .limit(30);
        setReplies(data || []);
        setRepliesLoaded(true);
      } catch (e) { console.error("replies:", e); }
      finally { setLoadingReplies(false); }
    }
    setRepliesOpen(o => !o);
  };

  const name   = profileData?.fullName  || profileData?.full_name  || "You";
  const handle = profileData?.username  || "user";
  const avatarId = profileData?.avatarId || profileData?.avatar_id;

  return (
    <article
      className="cv-card"
      style={{ animationDelay: `${Math.min(index * 45, 700)}ms` }}
    >
      {/* ════ HEADER ════ */}
      <div className="cv-card-header">
        <Avatar avatarId={avatarId} name={name} size={36} accentColor="#34d399" />
        <div className="cv-card-author">
          <span className="cv-card-name">{name}</span>
          <span className="cv-card-handle">@{handle}</span>
        </div>
        <div className="cv-card-time">
          <Clock size={9} />
          {timeAgo(comment.created_at)}
        </div>
      </div>

      {/* ════ COMMENT TEXT ════ */}
      <div className="cv-card-body">
        <ParsedText text={comment.content} className="cv-card-text" />
      </div>

      {/* ════ ACTION ROW ════ */}
      <div className="cv-card-actions">
        <LikeButton
          commentId={comment.id}
          initialLikes={comment.likes || 0}
          currentUserId={currentUser?.id}
          size="sm"
        />

        {replyCount > 0 && (
          <button className="cv-replies-btn" onClick={openReplies}>
            <CornerDownRight size={11} />
            {repliesOpen
              ? "Hide replies"
              : `${replyCount} repl${replyCount === 1 ? "y" : "ies"}`}
            {repliesOpen ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
          </button>
        )}
      </div>

      {/* ════ REPLIES ════ */}
      {repliesOpen && (
        <div className="cv-replies-section">
          {loadingReplies ? (
            <div className="cv-replies-loading">
              {[1, 2, 3].map(k => <div key={k} className="cv-reply-skel" />)}
            </div>
          ) : replies.length === 0 ? (
            <p className="cv-no-replies">No replies yet</p>
          ) : (
            <div className="cv-replies-list">
              {replies.map((r, i) => (
                <ReplyItem
                  key={r.id || i}
                  reply={r}
                  currentUserId={currentUser?.id}
                  isLast={i === replies.length - 1}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ════ CONTEXT STRIP (post this was on) ════ */}
      <ContextStrip comment={comment} onGoToPost={onGoToPost} />
    </article>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// ROOT — CommentsViewer panel
// ─────────────────────────────────────────────────────────────────────────────
const CommentsViewer = ({
  comments = [],
  profileData,
  currentUser,
  onGoToPost,
  onClose,
}) => {
  /* lock body scroll while open */
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const esc = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", esc);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", esc);
    };
  }, [onClose]);

  return (
    <>
      {/* ══════════════════════════════════════════════════════════════════════
          STYLES — scoped with .cv- prefix
          ══════════════════════════════════════════════════════════════════════ */}
      <style>{`
        /* ── Panel shell ── */
        .cv-overlay {
          position: fixed; inset: 0; z-index: 100000;
          background: rgba(0,0,0,0.7);
          backdrop-filter: blur(10px) saturate(0.6);
          display: flex; align-items: stretch; justify-content: flex-end;
          animation: cv-bg 0.22s ease;
        }
        @keyframes cv-bg { from{opacity:0} to{opacity:1} }

        .cv-panel {
          width: 100%; max-width: 500px; height: 100%;
          background: #060606;
          border-left: 1px solid rgba(52,211,153,0.1);
          display: flex; flex-direction: column;
          animation: cv-slidein 0.3s cubic-bezier(0.22,1,0.36,1);
          overflow: hidden;
        }
        @keyframes cv-slidein {
          from { transform: translateX(100%); opacity: 0.5; }
          to   { transform: translateX(0);    opacity: 1;   }
        }

        @media (max-width: 580px) {
          .cv-overlay { align-items: flex-end; justify-content: center; }
          .cv-panel {
            max-width: 100%; height: 96vh;
            border-left: none;
            border-top: 1px solid rgba(52,211,153,0.12);
            border-radius: 22px 22px 0 0;
            animation: cv-slideup 0.3s cubic-bezier(0.22,1,0.36,1);
          }
          @keyframes cv-slideup {
            from { transform: translateY(100%); opacity: 0.6; }
            to   { transform: translateY(0);    opacity: 1;   }
          }
        }

        /* ── Header ── */
        .cv-header-bar {
          display: flex; align-items: center; gap: 12px;
          padding: 15px 18px;
          background: rgba(6,6,6,0.97);
          backdrop-filter: blur(24px);
          border-bottom: 1px solid rgba(52,211,153,0.08);
          flex-shrink: 0;
        }
        .cv-back-btn {
          width: 36px; height: 36px; border-radius: 50%;
          background: rgba(52,211,153,0.06);
          border: 1px solid rgba(52,211,153,0.14);
          display: flex; align-items: center; justify-content: center;
          color: #34d399; cursor: pointer; flex-shrink: 0;
          transition: background 0.15s, transform 0.1s;
        }
        .cv-back-btn:hover { background: rgba(52,211,153,0.12); transform: scale(1.05); }
        .cv-back-btn:active { transform: scale(0.95); }

        .cv-header-info { flex: 1; }
        .cv-header-title {
          display: flex; align-items: center; gap: 7px;
          font-size: 15px; font-weight: 800; color: #34d399;
          letter-spacing: -0.2px;
        }
        .cv-header-sub {
          font-size: 11px; color: #404040; margin-top: 1px;
        }

        .cv-header-count {
          font-size: 11px; font-weight: 700;
          background: rgba(52,211,153,0.08);
          border: 1px solid rgba(52,211,153,0.14);
          color: #34d399; border-radius: 20px;
          padding: 3px 10px;
        }

        /* ── Scroll body ── */
        .cv-scroll {
          flex: 1; overflow-y: auto; overflow-x: hidden;
          padding: 14px 14px 48px;
          scrollbar-width: thin;
          scrollbar-color: rgba(52,211,153,0.12) transparent;
        }
        .cv-scroll::-webkit-scrollbar { width: 3px; }
        .cv-scroll::-webkit-scrollbar-thumb {
          background: rgba(52,211,153,0.15); border-radius: 2px;
        }

        /* ── COMMENT CARD ── */
        .cv-card {
          background: rgba(255,255,255,0.022);
          border: 1px solid rgba(255,255,255,0.055);
          border-radius: 18px; overflow: hidden;
          margin-bottom: 12px;
          animation: cv-cardin 0.35s ease both;
          transition: border-color 0.2s, box-shadow 0.2s;
        }
        .cv-card:hover {
          border-color: rgba(52,211,153,0.18);
          box-shadow: 0 4px 24px rgba(52,211,153,0.04);
        }
        @keyframes cv-cardin {
          from { opacity:0; transform:translateY(14px) scale(0.98); }
          to   { opacity:1; transform:translateY(0)    scale(1);    }
        }

        /* Card header */
        .cv-card-header {
          display: flex; align-items: center; gap: 10px;
          padding: 13px 14px 0;
        }
        .cv-card-author { flex:1; display:flex; flex-direction:column; gap:1px; }
        .cv-card-name { font-size: 13px; font-weight: 800; color: #f0f0f0; }
        .cv-card-handle { font-size: 11px; color: #444; }
        .cv-card-time {
          display: flex; align-items: center; gap: 3px;
          font-size: 10px; color: #383838; flex-shrink: 0;
        }

        /* Card body */
        .cv-card-body { padding: 9px 14px 0; }
        .cv-card-text { font-size: 14px; color: #d0d0d0; line-height: 1.68; word-break: break-word; }

        /* Mentions / Tags */
        .cv-mention {
          color: #60a5fa; font-weight: 600; cursor: pointer;
          padding: 0 1px; transition: opacity 0.1s;
        }
        .cv-mention:hover { opacity: 0.75; text-decoration: underline; }
        .cv-tag {
          color: #34d399; font-weight: 600; cursor: pointer;
          padding: 0 1px; transition: opacity 0.1s;
        }
        .cv-tag:hover { opacity: 0.75; text-decoration: underline; }

        /* Action row */
        .cv-card-actions {
          display: flex; align-items: center; gap: 8px;
          padding: 8px 14px 10px;
        }

        /* Like button */
        .cv-like-btn {
          display: flex; align-items: center; gap: 4px;
          padding: 5px 9px; border-radius: 20px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.07);
          color: #4a4a4a; font-size: 11px; font-weight: 700;
          cursor: pointer; transition: all 0.15s;
        }
        .cv-like-btn:hover { background: rgba(248,113,113,0.08); border-color: rgba(248,113,113,0.2); color: #f87171; }
        .cv-like-btn.cv-liked { background: rgba(248,113,113,0.08); border-color: rgba(248,113,113,0.22); color: #f87171; }
        .cv-like-btn.cv-like-xs { padding: 3px 7px; font-size: 10px; }
        .cv-like-btn.cv-pop { animation: cv-heartpop 0.4s cubic-bezier(0.36,0.07,0.19,0.97); }
        @keyframes cv-heartpop {
          0%  { transform: scale(1); }
          30% { transform: scale(1.45); }
          60% { transform: scale(0.88); }
          80% { transform: scale(1.1); }
          100%{ transform: scale(1); }
        }

        /* Replies toggle */
        .cv-replies-btn {
          display: flex; align-items: center; gap: 4px;
          padding: 5px 10px; border-radius: 20px;
          background: rgba(129,140,248,0.06);
          border: 1px solid rgba(129,140,248,0.14);
          color: #818cf8; font-size: 11px; font-weight: 700;
          cursor: pointer; transition: all 0.15s;
        }
        .cv-replies-btn:hover { background: rgba(129,140,248,0.12); }

        /* ── REPLIES ── */
        .cv-replies-section {
          border-top: 1px solid rgba(255,255,255,0.04);
          background: rgba(0,0,0,0.28);
          padding: 10px 14px 12px;
        }
        .cv-replies-list { display: flex; flex-direction: column; }

        .cv-reply-row {
          display: flex; position: relative;
          padding: 8px 0 0 28px;
        }
        /* vertical thread line */
        .cv-thread-line {
          position: absolute; left: 12px; top: 0; bottom: 0;
          width: 1px; background: rgba(129,140,248,0.18);
        }
        .cv-reply-last .cv-thread-line { bottom: 50%; }
        /* elbow */
        .cv-thread-elbow {
          position: absolute; left: 12px; top: 50%;
          width: 12px; height: 1px;
          background: rgba(129,140,248,0.18);
          transform: translateY(-50%);
        }
        .cv-reply-inner {
          display: flex; gap: 8px; align-items: flex-start; flex: 1;
          background: rgba(129,140,248,0.03);
          border: 1px solid rgba(129,140,248,0.08);
          border-radius: 12px; padding: 8px 10px; margin-bottom: 6px;
        }
        .cv-reply-content { flex: 1; min-width: 0; }
        .cv-reply-meta {
          display: flex; align-items: center; gap: 5px;
          flex-wrap: wrap; margin-bottom: 4px;
        }
        .cv-reply-name { font-size: 12px; font-weight: 800; color: #e0e0e0; }
        .cv-reply-handle { font-size: 10px; color: #444; }
        .cv-reply-dot { font-size: 10px; color: #333; }
        .cv-reply-time { font-size: 10px; color: #333; }
        .cv-reply-text { font-size: 12.5px; color: #a0a0a0; line-height: 1.6; margin: 0 0 5px; word-break: break-word; }

        /* reply skeletons */
        .cv-replies-loading { display: flex; flex-direction: column; gap: 6px; padding: 4px 0; }
        .cv-reply-skel {
          height: 48px; border-radius: 12px;
          background: linear-gradient(90deg, #0e0e0e 25%, #181818 50%, #0e0e0e 75%);
          background-size: 200% 100%;
          animation: cv-skel 1.5s infinite;
        }
        @keyframes cv-skel { 0%{background-position:200% 0} 100%{background-position:-200% 0} }
        .cv-no-replies { font-size: 11px; color: #383838; margin: 0; padding: 4px 0; }

        /* ── CONTEXT STRIP ── */
        .cv-ctx-strip { padding: 0 14px 13px; }
        .cv-ctx-divider {
          display: flex; align-items: center; gap: 8px; margin-bottom: 8px;
        }
        .cv-ctx-divider-line {
          flex: 1; height: 1px;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.05), transparent);
        }
        .cv-ctx-divider-label {
          font-size: 9px; color: #2e2e2e; font-weight: 700;
          text-transform: uppercase; letter-spacing: 0.9px; white-space: nowrap;
        }

        .cv-ctx-card {
          display: flex; align-items: center; gap: 10px;
          background: rgba(255,255,255,0.018);
          border: 1px solid rgba(255,255,255,0.045);
          border-radius: 12px; padding: 9px 10px;
          transition: border-color 0.15s;
        }
        .cv-ctx-card:hover { border-color: rgba(255,255,255,0.09); }

        /* thumb */
        .cv-ctx-thumb {
          width: 46px; height: 46px; flex-shrink: 0;
          border-radius: 9px; overflow: hidden; position: relative;
          background: #111; border: 1px solid rgba(255,255,255,0.06);
        }
        .cv-ctx-thumb img { width:100%; height:100%; object-fit:cover; }
        .cv-ctx-thumb-fallback {
          width:100%; height:100%;
          display:flex; align-items:center; justify-content:center;
        }
        .cv-ctx-play-badge {
          position: absolute; inset: 0;
          display: flex; align-items: center; justify-content: center;
          background: rgba(0,0,0,0.45);
        }

        /* info */
        .cv-ctx-info { flex: 1; min-width: 0; }
        .cv-ctx-type-pill {
          display: inline-flex; align-items: center; gap: 3px;
          font-size: 9px; font-weight: 800; text-transform: uppercase;
          letter-spacing: 0.6px; border-radius: 20px;
          padding: 2px 7px; margin-bottom: 4px;
          border: 1px solid transparent;
        }
        .cv-ctx-body {
          font-size: 12px; color: #666; line-height: 1.4; margin: 0 0 2px;
          overflow: hidden; white-space: nowrap; text-overflow: ellipsis;
        }
        .cv-ctx-author { font-size: 10px; color: #383838; }

        /* View CTA — elegant, right-positioned, minimal */
        .cv-view-btn {
          display: flex; flex-direction: column; align-items: center;
          gap: 3px; padding: 7px 11px; flex-shrink: 0;
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.07);
          border-radius: 10px; color: #444;
          font-size: 10px; font-weight: 700;
          cursor: pointer; transition: all 0.18s;
          white-space: nowrap;
        }
        .cv-view-btn:hover {
          background: rgba(132,204,22,0.07);
          border-color: rgba(132,204,22,0.22);
          color: #84cc16;
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(132,204,22,0.08);
        }
        .cv-view-btn:active { transform: translateY(0); }

        /* loading shimmer for ctx */
        .cv-ctx-loading { padding: 0 14px 13px; }
        .cv-ctx-shimmer {
          height: 64px; border-radius: 12px;
          background: linear-gradient(90deg, #0a0a0a 25%, #111 50%, #0a0a0a 75%);
          background-size: 200% 100%;
          animation: cv-skel 1.5s infinite;
        }

        /* ── Empty ── */
        .cv-empty {
          display: flex; flex-direction: column; align-items: center;
          justify-content: center; padding: 70px 24px; gap: 12px; text-align: center;
          color: #383838;
        }
        .cv-empty-emoji { font-size: 44px; }
        .cv-empty-title { font-size: 16px; font-weight: 700; color: #525252; margin: 0; }
        .cv-empty-sub { font-size: 13px; color: #383838; margin: 0; line-height: 1.6; }
      `}</style>

      {/* ══════ OVERLAY ══════ */}
      <div className="cv-overlay" onClick={onClose} role="dialog" aria-modal="true">
        <div className="cv-panel" onClick={e => e.stopPropagation()}>

          {/* Header */}
          <div className="cv-header-bar">
            <button className="cv-back-btn" onClick={onClose} aria-label="Close">
              <ArrowLeft size={17} />
            </button>
            <div className="cv-header-info">
              <div className="cv-header-title">
                <MessageSquare size={15} />
                My Comments
              </div>
              <div className="cv-header-sub">
                Tap a card to see replies & reactions
              </div>
            </div>
            <span className="cv-header-count">{comments.length}</span>
          </div>

          {/* Scrollable content */}
          <div className="cv-scroll">
            {comments.length === 0 ? (
              <div className="cv-empty">
                <span className="cv-empty-emoji">💬</span>
                <p className="cv-empty-title">No comments yet</p>
                <p className="cv-empty-sub">
                  Comments you leave on posts,<br />reels and stories will appear here
                </p>
              </div>
            ) : (
              comments.map((c, i) => (
                <CommentCard
                  key={c.id || i}
                  comment={c}
                  index={i}
                  profileData={profileData}
                  currentUser={currentUser}
                  onGoToPost={onGoToPost}
                />
              ))
            )}
          </div>

        </div>
      </div>
    </>
  );
};

export default CommentsViewer;