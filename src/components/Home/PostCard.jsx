// src/components/Home/PostCard.jsx
//
// Cloudinary URL structure (from mediaUrlService.js):
//   getVideoUrl(id, {quality, format}) →
//     https://res.cloudinary.com/{cloud}/video/upload/q_{quality},f_{format}/{publicId}
//   NOTE: no extension on the returned URL — we append .mp4 once, as the
//   original working code did. safeVideoUrl() makes this idempotent.
//
// BUG-FIXES vs previous broken attempt:
//   [BUG1] Cloudinary video quality: must be "auto:low"/"auto:good"/"auto:best"
//          not "low"/"medium"/"best" — those are invalid and produce 400 errors
//   [BUG2] Desktop slides were position:absolute inside a height-less container
//          → everything collapsed to 0px. Now using display:none/block (proven)
//   [BUG3] VideoSlide sub-component broke videoRefs sync. Back to inline video.
//   [BUG4] safeVideoUrl regex mangled URLs with query strings. New version is
//          split-based: safe for any URL shape.
//
// VIDEO RELIABILITY:
//   [VID-1] safeVideoUrl — strips then re-adds .mp4 exactly once
//   [VID-2] 3-strike retry: 1 s / 2 s / 4 s exponential back-off
//   [VID-3] Spinner from onLoadStart, gone on onCanPlay
//   [VID-4] Final error: friendly UI + "Try again" button
//   [VID-5] src ALWAYS present — preload= controls bytes, not src absence
//
// MOBILE:
//   Full viewport-width bleed (width:100vw + left:50% + translateX(-50%))
//   Images: natural ratio   Videos: real aspect-ratio from metadata
//
// PERFORMANCE:
//   [PERF-1] Connection-aware quality  [PERF-2] Prefetch next image
//   [PERF-3] First card priority load  [PERF-4] Tiered video preload
//   [PERF-5] Shimmer skeleton          [PERF-6] width/height from metadata
//   [PERF-7] IntersectionObserver auto-play/pause
//
// [DT1] Double-tap to like   [DT2] Love burst
// [VID] GlobalVideoState singleton

import React, { useState, useRef, useEffect, useCallback } from "react";
import ReactDOM from "react-dom";
import {
  Play, Volume2, VolumeX,
  ChevronLeft, ChevronRight,
  X, UserPlus, UserCheck, RefreshCw,
} from "lucide-react";
import ProfilePreview     from "../Shared/ProfilePreview";
import ReactionPanel      from "../Shared/ReactionPanel";
import ActionMenu         from "../Shared/ActionMenu";
import ParsedText         from "../Shared/ParsedText";
import EditPostModal      from "../Modals/EditPostModal";
import ShareModal         from "../Modals/ShareModal";
import CardPostDisplay    from "../MediaUploader/CardPostDisplay";
import mediaUrlService    from "../../services/shared/mediaUrlService";
import postService        from "../../services/home/postService";
import FullScreenPostView from "./FullScreenPostView";
import followService      from "../../services/social/followService";

// ── [PERF-1] Connection-aware quality ────────────────────────────────────────
// [BUG1-FIX] Cloudinary video quality MUST include the "auto:" prefix
const _conn = navigator?.connection || navigator?.mozConnection || navigator?.webkitConnection;
const _ect  = _conn?.effectiveType || "4g";
const _save = _conn?.saveData      || false;

function getQualityProfile() {
  if (_save || _ect === "slow-2g" || _ect === "2g")
    return { quality:"auto:low",  imgFormat:"webp", imgWidth:480,  videoQ:"auto:low"  };
  if (_ect === "3g")
    return { quality:"auto:good", imgFormat:"webp", imgWidth:800,  videoQ:"auto:good" };
  return   { quality:"auto:best", imgFormat:"webp", imgWidth:1200, videoQ:"auto:best" };
}
const QUALITY = getQualityProfile();

// ── [VID-1] Safe video URL — idempotent, never .mp4.mp4 ──────────────────────
// mediaUrlService.getVideoUrl returns: …/video/upload/q_auto,f_mp4/{publicId}
// (no extension). We need to append .mp4 once. This function is safe whether
// the service already appended it or not.
function safeVideoUrl(id) {
  try {
    const raw = mediaUrlService.getVideoUrl(id, { quality: QUALITY.videoQ, format: "mp4" });
    if (!raw) return null;
    // Split off any query string first so we only touch the path
    const qIdx     = raw.indexOf("?");
    const base     = qIdx >= 0 ? raw.slice(0, qIdx) : raw;
    const query    = qIdx >= 0 ? raw.slice(qIdx)    : "";
    const cleanB   = base.replace(/\.mp4$/i, "");   // strip if already there
    return cleanB + ".mp4" + query;                  // add back exactly once
  } catch { return null; }
}

// ── Relative timestamp ────────────────────────────────────────────────────────
const relTime = (dateStr) => {
  if (!dateStr) return "";
  const diff = Date.now() - new Date(dateStr).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60)  return "just now";
  const m = Math.floor(s / 60); if (m < 60)  return `${m}m`;
  const h = Math.floor(m / 60); if (h < 24)  return `${h}h`;
  const d = Math.floor(h / 24); if (d < 7)   return `${d}d`;
  return new Date(dateStr).toLocaleDateString("en-US", { month:"short", day:"numeric" });
};

// ── [VID] Global video state ──────────────────────────────────────────────────
export const GlobalVideoState = {
  globalPlayState: false, globalMuteState: true, listeners: new Set(),
  subscribe(cb)         { this.listeners.add(cb); return () => this.listeners.delete(cb); },
  notify()              { this.listeners.forEach(cb => cb()); },
  setGlobalPlayState(v) { this.globalPlayState = v; sessionStorage.setItem("gv_play", v); this.notify(); },
  getGlobalPlayState()  { const s = sessionStorage.getItem("gv_play"); return s === null ? false : s === "true"; },
  setGlobalMuteState(v) { this.globalMuteState = v; sessionStorage.setItem("gv_mute", v); this.notify(); },
  getGlobalMuteState()  { const s = sessionStorage.getItem("gv_mute"); return s === null ? true  : s === "true"; },
  init() { this.globalPlayState = this.getGlobalPlayState(); this.globalMuteState = this.getGlobalMuteState(); },
};
GlobalVideoState.init();

// ── [PERF-2] Prefetch next image ──────────────────────────────────────────────
const prefetchCache = new Set();
function prefetchImage(url) {
  if (!url || prefetchCache.has(url)) return;
  prefetchCache.add(url);
  try {
    const link = document.createElement("link");
    link.rel = "prefetch"; link.as = "image"; link.href = url; link.fetchPriority = "low";
    document.head.appendChild(link);
  } catch { new Image().src = url; }
}

// ── [DT1] Double-tap hook ─────────────────────────────────────────────────────
function useDoubleTap(onDoubleTap, delay = 350) {
  const lastTap = useRef(0);
  return useCallback((e) => {
    const now   = Date.now();
    const touch = e.touches?.[0] || e.changedTouches?.[0];
    const x = touch?.clientX ?? e.clientX;
    const y = touch?.clientY ?? e.clientY;
    if (now - lastTap.current < delay) { onDoubleTap({ x, y }); lastTap.current = 0; }
    else                               { lastTap.current = now; }
  }, [onDoubleTap, delay]);
}

// ── [DT2] Love burst overlay ──────────────────────────────────────────────────
const LoveBurst = ({ x, y, onDone }) => {
  useEffect(() => { const t = setTimeout(onDone, 900); return () => clearTimeout(t); }, [onDone]);
  return ReactDOM.createPortal(
    <div style={{ position:"fixed",left:x,top:y,zIndex:99999,pointerEvents:"none",transform:"translate(-50%,-50%)" }}>
      <div className="lv-big">❤️</div>
      {["❤️","❤️","💖","❤️","💖","❤️"].map((h,i) => (
        <div key={i} className="lv-sat" style={{ "--angle":`${[270,315,0,45,90,225][i]}deg` }}>{h}</div>
      ))}
    </div>,
    document.body,
  );
};

// ── Image lightbox ────────────────────────────────────────────────────────────
const ImageLightbox = ({ imageUrl, onClose }) => {
  useEffect(() => {
    document.body.style.overflow = "hidden";
    const h = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    return () => { document.body.style.overflow = ""; window.removeEventListener("keydown", h); };
  }, [onClose]);
  return ReactDOM.createPortal(
    <div className="pc-lightbox-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="pc-lightbox-content">
        <button className="pc-lightbox-close" onClick={onClose}><X size={20}/></button>
        <img src={imageUrl} alt="Full view" className="pc-lightbox-img"/>
      </div>
    </div>,
    document.body,
  );
};

// ── [PERF-5] Shimmer skeleton — reserves real aspect-ratio space ──────────────
const MediaShimmer = ({ aspectW, aspectH }) => {
  const pt = (aspectW && aspectH) ? `${Math.min((aspectH / aspectW) * 100, 120)}%` : "56.25%";
  return (
    <div className="pc-shimmer" style={{ paddingTop: pt }}>
      <div className="pc-shimmer-inner"/>
    </div>
  );
};

// ══════════════════════════════════════════════════════════════════════════════
// PostCard
// ══════════════════════════════════════════════════════════════════════════════
const PostCard = ({
  post: initialPost,
  currentUser,
  onPostUpdate,
  onPostDelete,
  feedIndex = 99,
}) => {
  const [post,               setPost]               = useState(initialPost);
  const [visible,            setVisible]            = useState(true);
  const [mediaErrors,        setMediaErrors]        = useState({});
  const [mediaLoaded,        setMediaLoaded]        = useState({});
  const [videoLoading,       setVideoLoading]       = useState({});  // spinner state
  const [videoFailed,        setVideoFailed]        = useState({});  // after all retries
  const [videoRetries,       setVideoRetries]       = useState({});  // retry counter
  const [activeMedia,        setActiveMedia]        = useState(0);
  const [videoPlayingStates, setVideoPlayingStates] = useState({});
  const [muted,              setMuted]              = useState(GlobalVideoState.getGlobalMuteState());
  const [touchStart,         setTouchStart]         = useState(null);
  const [touchEnd,           setTouchEnd]           = useState(null);
  const [captionExpanded,    setCaptionExpanded]    = useState(false);
  const [lightboxImage,      setLightboxImage]      = useState(null);
  const [showActionMenu,     setShowActionMenu]     = useState(false);
  const [actionMenuPos,      setActionMenuPos]      = useState({ x:0, y:0 });
  const [showFullPost,       setShowFullPost]       = useState(false);
  const [showEditModal,      setShowEditModal]      = useState(false);
  const [showShareModal,     setShowShareModal]     = useState(false);
  const [isFollowing,        setIsFollowing]        = useState(false);
  const [textNeedsExpand,    setTextNeedsExpand]    = useState(false);
  const [captionNeedsClamp,  setCaptionNeedsClamp]  = useState(false);
  const [inViewport,         setInViewport]         = useState(feedIndex === 0);
  const [loveBurst,          setLoveBurst]          = useState(null);

  const videoRefs    = useRef({});
  const retryTimers  = useRef({});
  const containerRef = useRef(null);
  const textRef      = useRef(null);
  const captionRef   = useRef(null);
  const deletedRef   = useRef(null);

  // Cleanup retry timers on unmount
  useEffect(() => () => Object.values(retryTimers.current).forEach(clearTimeout), []);

  useEffect(() => { if (visible) setPost(initialPost); }, [initialPost]); // eslint-disable-line

  const isOwnPost =
    post.user_id === currentUser?.id  ||
    post.user_id === currentUser?.uid ||
    post.user_id === currentUser?.userId;

  const isTextCard = Boolean(
    post.is_text_card === true || post.is_text_card === "true" || post.is_text_card === 1,
  );

  const profile = {
    id: post.user_id, userId: post.user_id, user_id: post.user_id,
    author:   post.profiles?.full_name || post.author   || "Unknown",
    username: post.profiles?.username  || post.username || "unknown",
    avatar:   post.profiles?.avatar_id
      ? mediaUrlService.getAvatarUrl(post.profiles.avatar_id, 200)
      : post.avatar || null,
    verified: post.profiles?.verified || post.verified || false,
  };

  // Follow state
  useEffect(() => {
    if (!currentUser?.id || isOwnPost) return;
    followService.isFollowing(currentUser.id, post.user_id).then(setIsFollowing).catch(() => {});
  }, [post.user_id, currentUser?.id, isOwnPost]); // eslint-disable-line

  const handleFollowToggle = async (e) => {
    e.stopPropagation();
    if (!currentUser?.id) return;
    const next = !isFollowing; setIsFollowing(next);
    try {
      if (next) await followService.followUser(currentUser.id, post.user_id);
      else      await followService.unfollowUser(currentUser.id, post.user_id);
    } catch { setIsFollowing(!next); }
  };

  // ── Media items ───────────────────────────────────────────────────────────
  const getMediaItems = () => {
    if (isTextCard) return [];
    const items = [];
    if (post.image_ids?.length) {
      post.image_ids.forEach((id, i) => {
        if (!id?.trim()) return;
        const meta = post.image_metadata?.[i] || {};
        items.push({
          type: "image", id, index: i,
          url:     mediaUrlService.getImageUrl(id, {
            width:   QUALITY.imgWidth,
            quality: QUALITY.quality,
            format:  QUALITY.imgFormat,
            crop: "limit",       // don't upscale small images
            gravity: "auto",
          }),
          fullUrl: mediaUrlService.getImageUrl(id, {
            width: 1920, quality:"auto:best", format:"webp", crop:"limit",
          }),
          width:  meta.width  || null,
          height: meta.height || null,
        });
      });
    }
    if (post.video_ids?.length) {
      post.video_ids.forEach((id, i) => {
        if (!id?.trim()) return;
        const url  = safeVideoUrl(id);   // [VID-1] correct Cloudinary URL
        if (!url) return;
        const meta = post.video_metadata?.[i] || {};
        items.push({
          type: "video", id, index: i, url,
          thumbnail: meta.thumbnail_url
            || mediaUrlService.getVideoThumbnail?.(id, { width:640, height:360, time:"0" })
            || null,
          duration: meta.duration,
          aspectW:  meta.width  || 9,
          aspectH:  meta.height || 16,
        });
      });
    }
    return items;
  };

  const mediaItems       = getMediaItems();
  const hasMultipleMedia = mediaItems.length > 1;
  const hasMedia         = mediaItems.length > 0;

  // [PERF-2] Prefetch next image
  useEffect(() => {
    const next = mediaItems[activeMedia + 1];
    if (next?.type === "image" && next.url) prefetchImage(next.url);
  }, [activeMedia]); // eslint-disable-line

  // Text overflow
  useEffect(() => {
    if (!textRef.current || !post.content || hasMedia || isTextCard) return;
    const measure = () => { const el = textRef.current; if (!el) return; setTextNeedsExpand(el.scrollHeight > window.innerHeight * 0.48); };
    const ro = new ResizeObserver(measure); ro.observe(textRef.current); measure();
    return () => ro.disconnect();
  }, [post.content, hasMedia, isTextCard]);

  // Caption clamp
  useEffect(() => {
    if (!captionRef.current || !post.content || !hasMedia) return;
    const measure = () => {
      const el = captionRef.current; if (!el) return;
      const lh = parseFloat(window.getComputedStyle(el).lineHeight) ||
                 parseFloat(window.getComputedStyle(el).fontSize) * 1.5 || 22;
      setCaptionNeedsClamp(el.scrollHeight > lh * 2 + 6);
    };
    const ro = new ResizeObserver(measure); ro.observe(captionRef.current); measure();
    return () => ro.disconnect();
  }, [post.content, hasMedia]);

  // Global mute sync
  useEffect(() => {
    const unsub = GlobalVideoState.subscribe(() => {
      setMuted(GlobalVideoState.globalMuteState);
      Object.values(videoRefs.current).forEach(v => { if (v) v.muted = GlobalVideoState.globalMuteState; });
    });
    return unsub;
  }, []);

  // [PERF-7] Viewport — auto play/pause
  useEffect(() => {
    if (!containerRef.current) return;
    const obs = new IntersectionObserver(([entry]) => {
      setInViewport(entry.isIntersecting);
      const cur = mediaItems[activeMedia];
      if (cur?.type !== "video") return;
      const v = videoRefs.current[activeMedia];
      if (entry.isIntersecting) {
        if (GlobalVideoState.globalPlayState && v) {
          v.muted = GlobalVideoState.globalMuteState;
          v.play().catch(() => {});
          setVideoPlayingStates(p => ({ ...p, [activeMedia]: true }));
        }
      } else if (v && !v.paused) {
        v.pause();
        setVideoPlayingStates(p => ({ ...p, [activeMedia]: false }));
      }
    }, { threshold: 0.4 });
    obs.observe(containerRef.current);
    return () => { if (containerRef.current) obs.unobserve(containerRef.current); };
  }, [activeMedia, mediaItems]); // eslint-disable-line

  // [DT1] Double-tap
  const fireLoveBurst = useCallback(({ x, y }) => {
    setLoveBurst({ x, y, id: Date.now() });
    if (currentUser?.id) {
      window.dispatchEvent(new CustomEvent("grova:quicklike", {
        detail: { contentId: post.id, contentType: "post", userId: currentUser.id },
      }));
    }
  }, [post.id, currentUser?.id]);
  const doubleTapHandler = useDoubleTap(fireLoveBurst);

  // [VID-2] Retry handler — 3 strikes, exponential back-off
  const MAX_VIDEO_RETRIES = 3;
  const handleVideoError = useCallback((index, url) => {
    const retries = videoRetries[index] || 0;
    if (retries >= MAX_VIDEO_RETRIES) {
      setVideoFailed(p  => ({ ...p, [index]: true }));
      setVideoLoading(p => ({ ...p, [index]: false }));
      return;
    }
    const next  = retries + 1;
    const delay = 1000 * Math.pow(2, retries); // 1 s → 2 s → 4 s
    setVideoRetries(p => ({ ...p, [index]: next }));
    clearTimeout(retryTimers.current[index]);
    retryTimers.current[index] = setTimeout(() => {
      const v = videoRefs.current[index]; if (!v) return;
      // Cache-bust so CDN doesn't serve a cached 4xx/5xx
      v.src = `${url}${url.includes("?") ? "&" : "?"}_r=${next}_${Date.now()}`;
      v.load();
    }, delay);
  }, [videoRetries]);

  // Manual "Try again" from error UI
  const handleVideoRetry = useCallback((index, url) => {
    setVideoFailed(p  => ({ ...p, [index]: false  }));
    setVideoLoading(p => ({ ...p, [index]: true   }));
    setVideoRetries(p => ({ ...p, [index]: 0      }));
    const v = videoRefs.current[index]; if (!v) return;
    v.src = `${url}?_r=m${Date.now()}`;
    v.load();
  }, []);

  if (!visible) return null;

  // Touch swipe for carousel
  const onTouchStart = (e) => { setTouchEnd(null); setTouchStart(e.targetTouches[0].clientX); };
  const onTouchMove  = (e) => setTouchEnd(e.targetTouches[0].clientX);
  const onTouchEnd   = () => {
    if (!touchStart || !touchEnd) return;
    const d = touchStart - touchEnd;
    if (d > 50  && activeMedia < mediaItems.length - 1) goToMedia(activeMedia + 1);
    if (d < -50 && activeMedia > 0)                     goToMedia(activeMedia - 1);
  };

  const toggleVideoPlay = (index) => {
    const v = videoRefs.current[index]; if (!v) return;
    const next = !videoPlayingStates[index];
    GlobalVideoState.setGlobalPlayState(next);
    if (next) { v.muted = GlobalVideoState.globalMuteState; v.play().catch(() => {}); setVideoPlayingStates(p => ({ ...p, [index]: true })); }
    else       { v.pause(); setVideoPlayingStates(p => ({ ...p, [index]: false })); }
  };

  const toggleVideoMute = (index, e) => {
    e.stopPropagation();
    const next = !muted; setMuted(next); GlobalVideoState.setGlobalMuteState(next);
  };

  const goToMedia = (i) => { if (i >= 0 && i < mediaItems.length) setActiveMedia(i); };

  const handleMenu = (e) => {
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    setActionMenuPos({ x: rect.right, y: rect.bottom });
    setShowActionMenu(true);
  };

  const handlePostUpdate = (updated) => {
    setPost(prev => ({ ...prev, ...updated }));
    setShowEditModal(false);
    if (onPostUpdate) onPostUpdate(updated);
  };

  const handleDelete = async (postId) => {
    deletedRef.current = post; setVisible(false);
    if (onPostDelete) onPostDelete(postId);
    try { await postService.deletePost(postId); }
    catch { setVisible(true); deletedRef.current = null; throw new Error("Delete failed"); }
  };

  const formatDuration = (s) => {
    if (!s) return "";
    return `${Math.floor(s / 60)}:${Math.floor(s % 60).toString().padStart(2, "0")}`;
  };

  const isFirstCard = feedIndex === 0;

  return (
    <>
      <div className="content-card post-card" ref={containerRef}>

        {/* ── HEADER ── */}
        <div className="pc-header">
          <ProfilePreview profile={profile} currentUser={currentUser} size="small"/>
          {post.created_at && <span className="pc-timestamp">{relTime(post.created_at)}</span>}
          <div className="pc-header-spacer"/>
          {!isOwnPost && currentUser?.id && (
            <button className={`pc-follow-btn${isFollowing ? " following" : ""}`} onClick={handleFollowToggle}>
              {isFollowing ? <><UserCheck size={13}/><span>Following</span></> : <><UserPlus size={13}/><span>Follow</span></>}
            </button>
          )}
          <button className="pc-menu-btn" onClick={handleMenu} aria-label="More options">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <circle cx="12" cy="5"  r="2"/>
              <circle cx="12" cy="12" r="2"/>
              <circle cx="12" cy="19" r="2"/>
            </svg>
          </button>
        </div>

        {/* ── BODY ── */}
        <div className="pc-body" onTouchEnd={doubleTapHandler} onDoubleClick={doubleTapHandler}>

          {/* TEXT CARD */}
          {isTextCard ? (
            <>
              <div className="pc-text-card-section"><CardPostDisplay post={post}/></div>
              {post.card_caption && (
                <div className="pc-text" style={{ padding:"6px 14px 0" }}><ParsedText text={post.card_caption}/></div>
              )}
            </>

          /* TEXT ONLY */
          ) : !hasMedia ? (
            <>
              <div
                ref={textRef}
                className={`pc-text pc-text-only${!captionExpanded && textNeedsExpand ? " pc-text-fade" : ""}`}
                style={!captionExpanded && textNeedsExpand ? { maxHeight:"48vh", overflow:"hidden" } : undefined}
              >
                <ParsedText text={post.content}/>
              </div>
              {textNeedsExpand && !captionExpanded && (
                <button className="pc-expand-btn" onClick={() => setShowFullPost(true)}>Read more</button>
              )}
            </>

          /* MEDIA */
          ) : (
            <>
              {post.content && (
                <>
                  <div ref={captionRef} className={`pc-text pc-caption${!captionExpanded && captionNeedsClamp ? " pc-caption-clamped" : ""}`}>
                    <ParsedText text={post.content}/>
                  </div>
                  {captionNeedsClamp && !captionExpanded && (
                    <button className="pc-expand-btn pc-expand-inline" onClick={() => setCaptionExpanded(true)}>…more</button>
                  )}
                </>
              )}

              {/* ── MEDIA CONTAINER ── */}
              <div
                className="pc-media-container"
                onTouchStart={onTouchStart}
                onTouchMove={onTouchMove}
                onTouchEnd={(e) => { onTouchEnd(); doubleTapHandler(e); }}
              >
                <div className="pc-media-viewer">
                  {mediaItems.map((item, index) => {
                    const isActive   = index === activeMedia;
                    const isAdjacent = Math.abs(index - activeMedia) === 1;

                    // [PERF-4] Tiered preload — controls bandwidth, NOT src presence
                    const preload = !inViewport ? "none"
                      : isActive              ? "auto"
                      : isAdjacent            ? "metadata"
                      :                         "none";

                    return (
                      // [BUG2-FIX] display:none/block — no absolute positioning,
                      // no collapsed-height problem on desktop
                      <div
                        key={`${item.type}-${item.id}-${index}`}
                        className={`pc-media-slide${isActive ? " active" : ""}`}
                      >
                        {item.type === "image" ? (
                          !mediaErrors[index] ? (
                            <div className="pc-img-wrap">
                              {/* [PERF-5] Shimmer with real aspect-ratio reserved space */}
                              {!mediaLoaded[index] && (
                                <MediaShimmer aspectW={item.width} aspectH={item.height}/>
                              )}
                              <img
                                src={item.url}
                                alt={`Post media ${index + 1}`}
                                className="pc-media-content pc-media-image"
                                // [PERF-6] Actual dimensions → zero layout shift
                                width={item.width   || undefined}
                                height={item.height || undefined}
                                // [PERF-3] First card in feed gets priority
                                loading={isFirstCard && index === 0 ? "eager" : "lazy"}
                                fetchPriority={isFirstCard && index === 0 ? "high" : isActive ? "auto" : "low"}
                                decoding={isFirstCard && index === 0 ? "sync" : "async"}
                                style={!mediaLoaded[index]
                                  ? { opacity:0, position:"absolute", top:0, left:0, width:"100%", height:"100%" }
                                  : undefined}
                                onLoad={() => setMediaLoaded(p => ({ ...p, [index]: true }))}
                                onError={() => setMediaErrors(p => ({ ...p, [index]: true }))}
                                onClick={() => setLightboxImage(item.fullUrl || item.url)}
                              />
                            </div>
                          ) : (
                            <div className="pc-media-error"><span>Image unavailable</span></div>
                          )

                        ) : (
                          /* ── VIDEO ──────────────────────────────────────── */
                          <div
                            className="pc-video-outer"
                            style={{ "--vid-aw": item.aspectW, "--vid-ah": item.aspectH }}
                          >
                            {/* [VID-3] Spinner */}
                            {videoLoading[index] && !videoFailed[index] && (
                              <div className="pc-vid-overlay pc-vid-loading">
                                <div className="pc-vid-spinner"/>
                              </div>
                            )}

                            {/* [VID-4] Final error with retry */}
                            {videoFailed[index] && (
                              <div className="pc-vid-overlay pc-vid-error">
                                <div className="pc-vid-error-icon">
                                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                                    <circle cx="12" cy="12" r="10"/>
                                    <line x1="12" y1="8"  x2="12"    y2="12"/>
                                    <line x1="12" y1="16" x2="12.01" y2="16"/>
                                  </svg>
                                </div>
                                <p className="pc-vid-error-msg">Could not load video</p>
                                <button className="pc-vid-retry-btn" onClick={() => handleVideoRetry(index, item.url)}>
                                  <RefreshCw size={12}/> Try again
                                </button>
                              </div>
                            )}

                            {/* [VID-5] src always present — preload controls bytes */}
                            {!videoFailed[index] && (
                              <video
                                ref={el => (videoRefs.current[index] = el)}
                                src={item.url}
                                poster={item.thumbnail || undefined}
                                className="pc-media-content pc-media-video"
                                playsInline loop muted={muted}
                                preload={preload}
                                onLoadStart={() => setVideoLoading(p => ({ ...p, [index]: true }))}
                                onCanPlay={()  => setVideoLoading(p => ({ ...p, [index]: false }))}
                                onLoadedData={e => {
                                  setVideoLoading(p => ({ ...p, [index]: false }));
                                  try { e.target.currentTime = 0.001; } catch {}
                                }}
                                onError={() => handleVideoError(index, item.url)}
                                onClick={() => toggleVideoPlay(index)}
                              />
                            )}

                            {/* Play button — only when not loading and not failed */}
                            {!videoPlayingStates[index] && !videoLoading[index] && !videoFailed[index] && (
                              <div className="pc-video-play-overlay" onClick={() => toggleVideoPlay(index)}>
                                <button className="pc-video-play-btn" type="button">
                                  <Play size={32} fill="white"/>
                                </button>
                              </div>
                            )}

                            {/* Mute button */}
                            {!videoFailed[index] && (
                              <button className="pc-video-mute-btn" type="button" onClick={e => toggleVideoMute(index, e)}>
                                {muted ? <VolumeX size={20}/> : <Volume2 size={20}/>}
                              </button>
                            )}

                            {/* Duration badge */}
                            {item.duration && !videoLoading[index] && !videoFailed[index] && (
                              <span className="pc-video-duration">{formatDuration(item.duration)}</span>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {hasMultipleMedia && (
                  <>
                    <div className="pc-media-indicators">
                      {mediaItems.map((_, i) => (
                        <button key={i} className={`pc-media-dot${i === activeMedia ? " active" : ""}`} onClick={() => goToMedia(i)}/>
                      ))}
                    </div>
                    {activeMedia > 0 && (
                      <button className="pc-media-nav pc-media-nav--prev" onClick={() => goToMedia(activeMedia - 1)}>
                        <ChevronLeft size={24}/>
                      </button>
                    )}
                    {activeMedia < mediaItems.length - 1 && (
                      <button className="pc-media-nav pc-media-nav--next" onClick={() => goToMedia(activeMedia + 1)}>
                        <ChevronRight size={24}/>
                      </button>
                    )}
                    <div className="pc-media-counter">{activeMedia + 1} / {mediaItems.length}</div>
                  </>
                )}
              </div>
            </>
          )}
        </div>

        {/* CATEGORY TAG */}
        {post.category && (
          <div className="pc-category-tag">
            <span className="pc-category-dot"/>
            <span>{post.category}</span>
          </div>
        )}

        {/* FOOTER */}
        <div className="pc-footer">
          <ReactionPanel content={{ ...post, type:"post" }} currentUser={currentUser} layout="horizontal"/>
        </div>
      </div>

      {loveBurst && <LoveBurst key={loveBurst.id} x={loveBurst.x} y={loveBurst.y} onDone={() => setLoveBurst(null)}/>}

      {showActionMenu && (
        <ActionMenu position={actionMenuPos} isOwnPost={isOwnPost} content={post}
          contentType="post" currentUser={currentUser}
          onClose={() => setShowActionMenu(false)}
          onEdit={() => { setShowActionMenu(false); setShowEditModal(true); }}
          onShare={() => { setShowActionMenu(false); setShowShareModal(true); }}
          onDelete={handleDelete} onSave={() => {}} onReport={() => {}}
        />
      )}

      {showEditModal && (
        <EditPostModal post={post} currentUser={currentUser}
          onClose={() => setShowEditModal(false)} onUpdate={handlePostUpdate}/>
      )}

      {showShareModal && ReactDOM.createPortal(
        <div className="pc-share-portal">
          <ShareModal content={post} contentType="post" currentUser={currentUser}
            onClose={() => setShowShareModal(false)}/>
        </div>,
        document.body,
      )}

      {lightboxImage && <ImageLightbox imageUrl={lightboxImage} onClose={() => setLightboxImage(null)}/>}

      {showFullPost && (
        <FullScreenPostView post={post} profile={profile}
          onClose={() => setShowFullPost(false)} currentUser={currentUser}/>
      )}

      <style>{PC_CSS}</style>
    </>
  );
};

// ══════════════════════════════════════════════════════════════════════════════
// CSS
// ══════════════════════════════════════════════════════════════════════════════
const PC_CSS = `

/* ── Shimmer ── */
@keyframes pcShimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}
.pc-shimmer{position:relative;width:100%;overflow:hidden;background:#0d0d0d;}
.pc-shimmer-inner{
  position:absolute;inset:0;
  background:linear-gradient(90deg,#0d0d0d 25%,#1c1c1c 50%,#0d0d0d 75%);
  background-size:200% 100%;animation:pcShimmer 1.4s ease-in-out infinite;
}

/* ── Video overlays ── */
@keyframes pcSpin{to{transform:rotate(360deg)}}
.pc-vid-overlay{
  position:absolute;inset:0;z-index:4;
  display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;
}
.pc-vid-loading{background:rgba(0,0,0,0.82);}
.pc-vid-error{background:#080808;}
.pc-vid-spinner{
  width:34px;height:34px;border-radius:50%;
  border:3px solid rgba(132,204,22,0.18);border-top-color:#84cc16;
  animation:pcSpin 0.75s linear infinite;
}
.pc-vid-error-icon{color:rgba(255,255,255,0.28);}
.pc-vid-error-msg{font-size:13px;color:rgba(255,255,255,0.38);font-weight:500;margin:0;}
.pc-vid-retry-btn{
  display:inline-flex;align-items:center;gap:5px;padding:7px 16px;border-radius:999px;
  background:rgba(132,204,22,0.1);border:1px solid rgba(132,204,22,0.3);
  color:#84cc16;font-size:12px;font-weight:700;font-family:inherit;cursor:pointer;
  transition:background 0.18s;
}
.pc-vid-retry-btn:hover{background:rgba(132,204,22,0.22);}

/* ── Love burst ── */
@keyframes lvBig{
  0%{opacity:0;transform:translate(-50%,-50%) scale(0.2);}
  40%{opacity:1;transform:translate(-50%,-50%) scale(1.4);}
  70%{opacity:1;transform:translate(-50%,-50%) scale(1.1);}
  100%{opacity:0;transform:translate(-50%,-50%) scale(1.3);}
}
@keyframes lvSat{
  0%{opacity:0;transform:translate(-50%,-50%) rotate(var(--angle)) translateY(0) scale(0.3);}
  30%{opacity:1;}
  100%{opacity:0;transform:translate(-50%,-50%) rotate(var(--angle)) translateY(-55px) scale(0.9);}
}
.lv-big{position:absolute;font-size:72px;line-height:1;animation:lvBig .85s cubic-bezier(.34,1.2,.64,1) both;transform-origin:center;filter:drop-shadow(0 4px 16px rgba(239,68,68,.7));pointer-events:none;user-select:none;transform:translate(-50%,-50%);}
.lv-sat{position:absolute;font-size:26px;line-height:1;animation:lvSat .8s ease-out both;transform-origin:center;pointer-events:none;user-select:none;transform:translate(-50%,-50%);}

/* ── Card ── */
.post-card{contain:layout style;}

/* ── Header ── */
.pc-header{display:flex;align-items:center;gap:8px;padding:10px 14px 4px;}
.pc-header-spacer{flex:1;}
.pc-timestamp{font-size:11px;color:rgba(255,255,255,.35);font-weight:500;white-space:nowrap;flex-shrink:0;}
.pc-follow-btn{display:inline-flex;align-items:center;gap:5px;padding:5px 11px;border-radius:999px;font-size:11.5px;font-weight:700;cursor:pointer;flex-shrink:0;white-space:nowrap;font-family:inherit;background:transparent;border:1px solid rgba(132,204,22,.45);color:#84cc16;transition:background .2s,border-color .2s,color .2s;}
.pc-follow-btn:hover{background:rgba(132,204,22,.1);}
.pc-follow-btn.following{background:rgba(132,204,22,.08);border-color:rgba(132,204,22,.22);color:rgba(132,204,22,.75);}
.pc-follow-btn.following:hover{background:rgba(239,68,68,.08);border-color:rgba(239,68,68,.3);color:#ef4444;}
.pc-menu-btn{width:32px;height:32px;border-radius:8px;flex-shrink:0;background:transparent;border:none;color:rgba(255,255,255,.3);display:flex;align-items:center;justify-content:center;cursor:pointer;transition:background .15s,color .15s;}
.pc-menu-btn:hover{background:rgba(255,255,255,.06);color:rgba(255,255,255,.7);}

/* ── Body ── */
.pc-body{padding-top:0;margin-top:0;}
.pc-text{padding:0 14px;color:#f0f0f0;font-size:15px;line-height:1.75;margin-top:4px;margin-bottom:0;word-break:break-word;white-space:pre-wrap;}
.pc-text-only.pc-text-fade{position:relative;}
.pc-text-only.pc-text-fade::after{content:"";position:absolute;bottom:0;left:0;right:0;height:56px;background:linear-gradient(to bottom,transparent,var(--card-bg,#111));pointer-events:none;}
.pc-caption{margin-bottom:0;}
.pc-caption.pc-caption-clamped{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;}
.pc-expand-btn{display:inline-block;background:none;border:none;padding:3px 14px 0;color:#6b7280;font-size:13.5px;font-weight:600;cursor:pointer;font-family:inherit;transition:color .15s;margin-bottom:4px;line-height:1.6;}
.pc-expand-btn:hover{color:#84cc16;}
.pc-expand-inline{padding:1px 14px 4px;font-size:13px;}

/* ════════════════════════════ MEDIA — shared base ═══════════════════════════ */
.pc-media-container{position:relative;margin-top:6px;overflow:hidden;transform:translateZ(0);}
.pc-media-viewer{position:relative;width:100%;}

/* [BUG2-FIX] display:none / block — no fixed height needed, no collapse */
.pc-media-slide{display:none;width:100%;}
.pc-media-slide.active{display:block;}

/* ── Image ── */
.pc-img-wrap{position:relative;width:100%;overflow:hidden;}
/* Content rule for DESKTOP images — height:auto, max-height capped */
.pc-media-content{display:block;width:100%;height:auto;max-height:65vh;object-fit:contain;background:#000;}
.pc-media-image{cursor:zoom-in;}

/* ── Video outer — desktop: natural height up to 65vh ── */
.pc-video-outer{position:relative;width:100%;background:#000;overflow:hidden;max-height:65vh;}
.pc-media-video{
  display:block;width:100%;height:auto;max-height:65vh;
  object-fit:contain;cursor:pointer;transform:translateZ(0);background:#000;
}

/* Overlays */
.pc-video-play-overlay{position:absolute;inset:0;z-index:2;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.22);cursor:pointer;}
.pc-video-play-btn{width:64px;height:64px;border-radius:50%;background:rgba(0,0,0,.55);border:2px solid rgba(255,255,255,.8);color:#fff;display:flex;align-items:center;justify-content:center;cursor:pointer;transition:transform .15s;}
.pc-video-play-btn:hover{transform:scale(1.08);}
.pc-video-mute-btn{position:absolute;bottom:10px;right:10px;z-index:5;width:32px;height:32px;border-radius:50%;background:rgba(0,0,0,.55);border:1px solid rgba(255,255,255,.2);color:#fff;display:flex;align-items:center;justify-content:center;cursor:pointer;}
.pc-video-duration{position:absolute;bottom:10px;left:10px;z-index:5;background:rgba(0,0,0,.65);color:#fff;font-size:11px;font-weight:700;padding:2px 6px;border-radius:4px;}

/* Indicators */
.pc-media-indicators{display:flex;justify-content:center;gap:5px;padding:8px 0 4px;}
.pc-media-dot{width:6px;height:6px;border-radius:50%;background:rgba(255,255,255,.25);border:none;cursor:pointer;padding:0;transition:background .15s,transform .15s;}
.pc-media-dot.active{background:#84cc16;transform:scale(1.3);}
.pc-media-nav{position:absolute;top:50%;transform:translateY(-50%);width:36px;height:36px;border-radius:50%;background:rgba(0,0,0,.55);border:1px solid rgba(255,255,255,.15);color:#fff;display:flex;align-items:center;justify-content:center;cursor:pointer;z-index:2;transition:background .15s;}
.pc-media-nav:hover{background:rgba(0,0,0,.8);}
.pc-media-nav--prev{left:10px;}
.pc-media-nav--next{right:10px;}
.pc-media-counter{position:absolute;top:10px;right:10px;z-index:2;background:rgba(0,0,0,.6);color:#fff;font-size:11px;font-weight:700;padding:3px 8px;border-radius:99px;}
.pc-media-error{height:160px;display:flex;align-items:center;justify-content:center;background:rgba(255,255,255,.03);color:rgba(255,255,255,.3);font-size:13px;}

/* Category */
.pc-category-tag{display:inline-flex;align-items:center;gap:6px;padding:4px 10px 4px 8px;border-radius:999px;background:rgba(132,204,22,.07);border:1px solid rgba(132,204,22,.18);margin:6px 14px 6px;width:fit-content;}
.pc-category-dot{width:5px;height:5px;border-radius:50%;background:#84cc16;flex-shrink:0;}
.pc-category-tag span:last-child{font-size:10.5px;font-weight:700;color:rgba(132,204,22,.8);letter-spacing:.04em;text-transform:uppercase;line-height:1;}

/* Footer */
.pc-footer{padding:10px 14px 12px;border-top:1px solid rgba(132,204,22,.08);}

/* Portals */
.pc-share-portal{position:fixed;inset:0;z-index:9001;}
.pc-lightbox-overlay{position:fixed;inset:0;background:rgba(0,0,0,.94);z-index:9500;display:flex;align-items:center;justify-content:center;}
.pc-lightbox-content{position:relative;max-width:90vw;max-height:90vh;display:flex;align-items:center;justify-content:center;}
.pc-lightbox-close{position:absolute;top:-44px;right:0;width:36px;height:36px;border-radius:50%;background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.2);color:#fff;display:flex;align-items:center;justify-content:center;cursor:pointer;transition:background .15s;}
.pc-lightbox-close:hover{background:rgba(255,255,255,.2);}
.pc-lightbox-img{max-width:90vw;max-height:90vh;object-fit:contain;border-radius:8px;}


/* ══════════════════════════════════════════════════════════════════════════
   MOBILE ≤ 768 px  — full-bleed, natural ratio, no max-height cap on images
   ══════════════════════════════════════════════════════════════════════════ */
@media (max-width: 768px) {

  /* Edge-to-edge card */
  .post-card{border-radius:0 !important;overflow:visible !important;}

  /* Full-bleed: breaks out of any card horizontal padding */
  .pc-media-container{
    width:100vw;
    position:relative;left:50%;transform:translateX(-50%);
    margin-top:6px;overflow:hidden;border-radius:0;border:none;
  }

  /* IMAGE: full width, natural height — no max-height so tall portraits show fully */
  .pc-media-content{
    width:100%;height:auto;
    max-height:85svh;      /* safety cap — never taller than near-full screen */
    object-fit:contain;background:#000;display:block;
  }
  .pc-media-image{cursor:default;}

  /* VIDEO outer: real aspect-ratio box from upload metadata, fallback 9/16 */
  .pc-video-outer{
    position:relative;width:100%;
    aspect-ratio:calc(var(--vid-aw,9) / var(--vid-ah,16));
    max-height:85svh;
    background:#000;overflow:hidden;
  }

  /* Video fills the box absolutely — identical to ReelCard pattern */
  .pc-media-video{
    position:absolute;inset:0;
    width:100%;height:100%;
    object-fit:contain;background:#000;cursor:pointer;
    /* override desktop height:auto */
    max-height:none;
  }

  /* Overlays fill the box too */
  .pc-vid-overlay,.pc-video-play-overlay{position:absolute;inset:0;}

  /* Controls */
  .pc-video-play-btn{width:58px;height:58px;}
  .pc-video-mute-btn{width:34px;height:34px;bottom:auto;top:10px;right:10px;}
  .pc-video-duration{bottom:10px;left:10px;font-size:11px;padding:2px 5px;}

  /* No left/right arrows on touch — swipe instead */
  .pc-media-nav{display:none;}

  /* Header + text padding */
  .pc-header{padding:8px 12px 4px;}
  .pc-text{padding:0 12px;font-size:14px;}
}
`;

export default PostCard;