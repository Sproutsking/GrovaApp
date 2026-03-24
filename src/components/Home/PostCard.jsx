// ============================================================================
// src/components/Home/PostCard.jsx
// Changes from original (structure UNCHANGED, precision additions only):
//  [1] isFollowing state + checkFollowStatus() on mount — mirrors UserProfileModal
//  [2] handleFollowToggle() — optimistic, mirrors UserProfileModal exactly
//  [3] Author row: old category badge → Follow/Unfollow button + timestamp
//  [4] Category tag moved: rendered as pill just above card footer
//  All media, video, lightbox, fullscreen, edit, delete logic — UNCHANGED
// ============================================================================

import React, { useState, useRef, useEffect } from "react";
import ReactDOM from "react-dom";
import { Play, Volume2, VolumeX, ChevronLeft, ChevronRight, X, UserPlus, UserCheck } from "lucide-react";
import ProfilePreview from "../Shared/ProfilePreview";
import ReactionPanel from "../Shared/ReactionPanel";
import ActionMenu from "../Shared/ActionMenu";
import ParsedText from "../Shared/ParsedText";
import EditPostModal from "../Modals/EditPostModal";
import ShareModal from "../Modals/ShareModal";
import CardPostDisplay from "../MediaUploader/CardPostDisplay";
import mediaUrlService from "../../services/shared/mediaUrlService";
import postService from "../../services/home/postService";
import FullScreenPostView from "./FullScreenPostView";
import followService from "../../services/social/followService"; // [1]

// ── relative timestamp ────────────────────────────────────────────────────────
const relTime = (dateStr) => {
  if (!dateStr) return "";
  const diff = Date.now() - new Date(dateStr).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60)  return "just now";
  const m = Math.floor(s / 60);
  if (m < 60)  return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24)  return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7)   return `${d}d`;
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric" });
};

// ── Global video state (unchanged) ───────────────────────────────────────────
const GlobalVideoState = {
  globalPlayState: false, globalMuteState: true, listeners: new Set(),
  subscribe(cb) { this.listeners.add(cb); return () => this.listeners.delete(cb); },
  notify() { this.listeners.forEach(cb => cb()); },
  setGlobalPlayState(v) { this.globalPlayState = v; sessionStorage.setItem("posts_global_play_state", v); this.notify(); },
  getGlobalPlayState() { const s = sessionStorage.getItem("posts_global_play_state"); return s === null ? false : s === "true"; },
  setGlobalMuteState(v) { this.globalMuteState = v; sessionStorage.setItem("posts_global_muted", v); this.notify(); },
  getGlobalMuteState() { const s = sessionStorage.getItem("posts_global_muted"); return s === null ? true : s === "true"; },
  init() { this.globalPlayState = this.getGlobalPlayState(); this.globalMuteState = this.getGlobalMuteState(); },
};
GlobalVideoState.init();

// ── Image lightbox (unchanged) ────────────────────────────────────────────────
const ImageLightbox = ({ imageUrl, onClose }) => {
  useEffect(() => {
    document.body.style.overflow = "hidden";
    const h = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    return () => { document.body.style.overflow = ""; window.removeEventListener("keydown", h); };
  }, [onClose]);
  return (
    <div className="image-lightbox-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="image-lightbox-content">
        <button className="image-lightbox-close" onClick={onClose}><X size={20} /></button>
        <img src={imageUrl} alt="Full view" className="image-lightbox-img" />
      </div>
    </div>
  );
};

// ── PostCard ──────────────────────────────────────────────────────────────────
const PostCard = ({ post: initialPost, currentUser, onPostUpdate, onPostDelete }) => {
  const [post,               setPost]               = useState(initialPost);
  const [visible,            setVisible]            = useState(true);
  const [mediaErrors,        setMediaErrors]        = useState({});
  const [activeMedia,        setActiveMedia]        = useState(0);
  const [videoPlayingStates, setVideoPlayingStates] = useState({});
  const [muted,              setMuted]              = useState(GlobalVideoState.getGlobalMuteState());
  const [touchStart,         setTouchStart]         = useState(null);
  const [touchEnd,           setTouchEnd]           = useState(null);
  const [captionExpanded,    setCaptionExpanded]    = useState(false);
  const [needsTruncation,    setNeedsTruncation]    = useState(false);
  const [lightboxImage,      setLightboxImage]      = useState(null);
  const [isInViewport,       setIsInViewport]       = useState(false);
  const [showActionMenu,     setShowActionMenu]     = useState(false);
  const [actionMenuPos,      setActionMenuPos]      = useState({ x: 0, y: 0 });
  const [showFullPost,       setShowFullPost]       = useState(false);
  const [showEditModal,      setShowEditModal]      = useState(false);
  const [showShareModal,     setShowShareModal]     = useState(false);

  // [1] Follow state — mirrors UserProfileModal
  const [isFollowing, setIsFollowing] = useState(false);

  const videoRefs    = useRef({});
  const containerRef = useRef(null);
  const captionRef   = useRef(null);
  const deletedRef   = useRef(null);

  useEffect(() => { if (visible) setPost(initialPost); }, [initialPost]);

  const isOwnPost = post.user_id === currentUser?.id || post.user_id === currentUser?.uid;
  const isTextCard = Boolean(post.is_text_card === true || post.is_text_card === "true" || post.is_text_card === 1);

  const profile = {
    userId:   post.user_id,
    author:   post.profiles?.full_name  || post.author   || "Unknown",
    username: post.profiles?.username   || post.username || "unknown",
    avatar:   post.profiles?.avatar_id
      ? mediaUrlService.getAvatarUrl(post.profiles.avatar_id, 200)
      : (post.avatar || null),
    verified: post.profiles?.verified || post.verified || false,
  };

  // [1] Check follow on mount — mirrors UserProfileModal.checkFollowStatus()
  useEffect(() => {
    if (!currentUser?.id || isOwnPost) return;
    followService.isFollowing(currentUser.id, post.user_id)
      .then(setIsFollowing)
      .catch(() => {});
  }, [post.user_id, currentUser?.id, isOwnPost]);

  // [2] Follow toggle — mirrors UserProfileModal.handleFollowToggle()
  const handleFollowToggle = async (e) => {
    e.stopPropagation();
    if (!currentUser?.id) return;
    const next = !isFollowing;
    setIsFollowing(next);
    try {
      if (next) await followService.followUser(currentUser.id, post.user_id);
      else      await followService.unfollowUser(currentUser.id, post.user_id);
    } catch {
      setIsFollowing(!next);
    }
  };

  // ── Media ────────────────────────────────────────────────────────────────
  const getMediaItems = () => {
    if (isTextCard) return [];
    const items = [];
    if (post.image_ids?.length) {
      post.image_ids.forEach((id, i) => {
        if (id?.trim()) items.push({
          type: "image", id, index: i,
          url: mediaUrlService.getImageUrl(id, { width: 1200, quality: "auto:best", format: "auto" }),
          metadata: post.image_metadata?.[i] || {},
        });
      });
    }
    if (post.video_ids?.length) {
      post.video_ids.forEach((id, i) => {
        if (id?.trim()) {
          const meta = post.video_metadata?.[i] || {};
          items.push({
            type: "video", id, index: i,
            url: mediaUrlService.getVideoUrl(id, { quality: "auto:best", format: "mp4" }) + ".mp4",
            thumbnail: meta.thumbnail_url || mediaUrlService.getVideoThumbnail(id),
            duration: meta.duration, metadata: meta,
          });
        }
      });
    }
    return items;
  };
  const mediaItems       = getMediaItems();
  const hasMultipleMedia = mediaItems.length > 1;
  const hasMedia         = mediaItems.length > 0;

  useEffect(() => {
    const unsub = GlobalVideoState.subscribe(() => {
      setMuted(GlobalVideoState.globalMuteState);
      Object.values(videoRefs.current).forEach(v => { if (v) v.muted = GlobalVideoState.globalMuteState; });
    });
    return unsub;
  }, []);

  useEffect(() => {
    if (!containerRef.current) return;
    const obs = new IntersectionObserver(([entry]) => {
      setIsInViewport(entry.isIntersecting);
      const cur = mediaItems[activeMedia];
      if (cur?.type === "video") {
        const v = videoRefs.current[activeMedia];
        if (entry.isIntersecting && GlobalVideoState.globalPlayState && v) {
          v.muted = GlobalVideoState.globalMuteState;
          v.play().catch(() => {});
          setVideoPlayingStates(p => ({ ...p, [activeMedia]: true }));
        } else if (!entry.isIntersecting && v && !v.paused) {
          v.pause();
          setVideoPlayingStates(p => ({ ...p, [activeMedia]: false }));
        }
      }
    }, { threshold: 0.5 });
    obs.observe(containerRef.current);
    return () => { if (containerRef.current) obs.unobserve(containerRef.current); };
  }, [activeMedia, mediaItems]);

  useEffect(() => {
    if (!captionRef.current || !post.content) return;
    if (hasMedia || isTextCard) {
      const lh = parseInt(window.getComputedStyle(captionRef.current).lineHeight);
      setNeedsTruncation(captionRef.current.scrollHeight > lh * 2);
    } else {
      setNeedsTruncation(captionRef.current.scrollHeight > window.innerHeight * 0.5);
    }
  }, [post.content, hasMedia, isTextCard]);

  if (!visible) return null;

  const handleViewMore = () => !hasMedia && !isTextCard ? setShowFullPost(true) : setCaptionExpanded(true);
  const onTouchStart = (e) => { setTouchEnd(null); setTouchStart(e.targetTouches[0].clientX); };
  const onTouchMove  = (e) => setTouchEnd(e.targetTouches[0].clientX);
  const onTouchEnd   = () => {
    if (!touchStart || !touchEnd) return;
    const d = touchStart - touchEnd;
    if (d > 50 && activeMedia < mediaItems.length - 1) goToMedia(activeMedia + 1);
    if (d < -50 && activeMedia > 0)                    goToMedia(activeMedia - 1);
  };

  const toggleVideoPlay = (index) => {
    const v = videoRefs.current[index];
    if (!v) return;
    const next = !videoPlayingStates[index];
    GlobalVideoState.setGlobalPlayState(next);
    if (next) { v.muted = GlobalVideoState.globalMuteState; v.play().catch(() => {}); setVideoPlayingStates(p => ({ ...p, [index]: true })); }
    else       { v.pause(); setVideoPlayingStates(p => ({ ...p, [index]: false })); }
  };
  const toggleVideoMute = (index, e) => {
    e.stopPropagation();
    const next = !muted;
    setMuted(next);
    GlobalVideoState.setGlobalMuteState(next);
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
    deletedRef.current = post;
    setVisible(false);
    if (onPostDelete) onPostDelete(postId);
    try {
      await postService.deletePost(postId);
    } catch {
      setVisible(true);
      deletedRef.current = null;
      throw new Error("Delete failed");
    }
  };

  const formatDuration = (s) => {
    if (!s) return "";
    return `${Math.floor(s / 60)}:${Math.floor(s % 60).toString().padStart(2, "0")}`;
  };

  return (
    <>
      <div className="content-card post-card" ref={containerRef}>

        {/* ── AUTHOR HEADER ── */}
        <div className="post-header">
          {/* ProfilePreview — unchanged */}
          <ProfilePreview profile={profile} onClick={() => {}} size="small" />

          {/* [4] Timestamp */}
          {post.created_at && (
            <span className="post-timestamp">{relTime(post.created_at)}</span>
          )}

          <div style={{ flex: 1 }} />

          {/* [3] Follow / Unfollow button */}
          {!isOwnPost && currentUser?.id && (
            <button
              className={`post-follow-btn${isFollowing ? " following" : ""}`}
              onClick={handleFollowToggle}
            >
              {isFollowing
                ? <><UserCheck size={13} /><span>Following</span></>
                : <><UserPlus size={13} /><span>Follow</span></>
              }
            </button>
          )}

          {/* ⋮ menu */}
          <button className="post-menu-btn" onClick={handleMenu} aria-label="More options">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <circle cx="12" cy="5" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="12" cy="19" r="2"/>
            </svg>
          </button>
        </div>

        {/* ── BODY — UNCHANGED ── */}
        <div className="post-content" style={{ paddingTop: 0, marginTop: 0 }}>
          {isTextCard ? (
            <>
              <div className="post-card-card-section">
                <CardPostDisplay post={post} />
              </div>
              {post.card_caption && (
                <div ref={captionRef} className={`post-text${!captionExpanded && needsTruncation ? " collapsed" : ""}`} style={{ marginTop: 8 }}>
                  <ParsedText text={post.card_caption} />
                  {!captionExpanded && needsTruncation && (
                    <span className="view-more-text" onClick={handleViewMore} role="button" tabIndex={0}> ...more</span>
                  )}
                </div>
              )}
            </>
          ) : (
            <>
              {post.content && (
                <div
                  ref={captionRef}
                  className={`post-text${!captionExpanded && needsTruncation && hasMedia ? " collapsed" : ""}`}
                  style={{
                    maxHeight: !captionExpanded && needsTruncation && !hasMedia ? "50vh" : "none",
                    overflow:  !captionExpanded && needsTruncation && !hasMedia ? "hidden" : "visible",
                    marginBottom: hasMedia ? 10 : 0,
                    marginTop: 6,
                    padding: "0 14px",
                  }}
                >
                  <ParsedText text={post.content} />
                  {!captionExpanded && needsTruncation && (
                    <span className="view-more-text" onClick={handleViewMore} role="button" tabIndex={0}> ...more</span>
                  )}
                </div>
              )}

              {hasMedia && (
                <div className="post-media-container" onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}>
                  <div className="post-media-viewer">
                    {mediaItems.map((item, index) => (
                      <div key={`${item.type}-${item.id}-${index}`} className={`media-slide${index === activeMedia ? " active" : ""}`}>
                        {item.type === "image" ? (
                          !mediaErrors[index] ? (
                            <img
                              src={item.url}
                              alt={`Post media ${index + 1}`}
                              className="media-content image"
                              onError={() => setMediaErrors(p => ({ ...p, [index]: true }))}
                              onClick={() => setLightboxImage(item.url)}
                              loading={index === 0 ? "eager" : "lazy"}
                            />
                          ) : <div className="media-error"><span>Image unavailable</span></div>
                        ) : !mediaErrors[index] ? (
                          <div className="video-container">
                            <video
                              ref={el => (videoRefs.current[index] = el)}
                              src={item.url}
                              className="media-content video-content"
                              playsInline loop muted={muted} preload="auto"
                              onLoadedData={e => (e.target.currentTime = 0.1)}
                              onError={() => setMediaErrors(p => ({ ...p, [index]: true }))}
                              onClick={() => toggleVideoPlay(index)}
                            />
                            {!videoPlayingStates[index] && (
                              <div className="video-play-overlay" onClick={() => toggleVideoPlay(index)}>
                                <button className="video-play-button"><Play size={32} fill="white" /></button>
                              </div>
                            )}
                            <button className="video-mute-button" onClick={e => toggleVideoMute(index, e)}>
                              {muted ? <VolumeX size={20} /> : <Volume2 size={20} />}
                            </button>
                            {item.duration && <span className="video-duration-badge">{formatDuration(item.duration)}</span>}
                          </div>
                        ) : <div className="media-error"><span>Video unavailable</span></div>}
                      </div>
                    ))}
                  </div>
                  {hasMultipleMedia && (
                    <>
                      <div className="media-indicators">
                        {mediaItems.map((_, i) => (
                          <button key={i} className={`media-indicator${i === activeMedia ? " active" : ""}`} onClick={() => goToMedia(i)} />
                        ))}
                      </div>
                      {activeMedia > 0 && <button className="media-nav-btn prev" onClick={() => goToMedia(activeMedia - 1)}><ChevronLeft size={24} /></button>}
                      {activeMedia < mediaItems.length - 1 && <button className="media-nav-btn next" onClick={() => goToMedia(activeMedia + 1)}><ChevronRight size={24} /></button>}
                      <div className="media-counter">{activeMedia + 1} / {mediaItems.length}</div>
                    </>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* [5] Category tag — above reactions */}
        {post.category && (
          <div className="post-category-tag">
            <span className="post-cat-dot" />
            <span>{post.category}</span>
          </div>
        )}

        {/* ── FOOTER — UNCHANGED ── */}
        <div className="card-footer">
          <ReactionPanel content={{ ...post, type: "post" }} currentUser={currentUser} layout="horizontal" />
        </div>
      </div>

      {/* Styles for new elements only */}
      <style>{`
        .post-header {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 12px 14px 10px;
        }
        .post-timestamp {
          font-size: 11px;
          color: rgba(255,255,255,0.35);
          font-weight: 500;
          white-space: nowrap;
          flex-shrink: 0;
        }
        .post-follow-btn {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          padding: 5px 11px;
          border-radius: 999px;
          font-size: 11.5px;
          font-weight: 700;
          cursor: pointer;
          flex-shrink: 0;
          transition: all 0.2s;
          white-space: nowrap;
          font-family: inherit;
          background: transparent;
          border: 1px solid rgba(132,204,22,0.45);
          color: #84cc16;
        }
        .post-follow-btn:hover { background: rgba(132,204,22,0.1); }
        .post-follow-btn.following {
          background: rgba(132,204,22,0.1);
          border-color: rgba(132,204,22,0.25);
          color: rgba(132,204,22,0.8);
        }
        .post-follow-btn.following:hover {
          background: rgba(239,68,68,0.1);
          border-color: rgba(239,68,68,0.3);
          color: #ef4444;
        }
        .post-menu-btn {
          width: 32px; height: 32px;
          border-radius: 8px; flex-shrink: 0;
          background: transparent; border: none;
          color: rgba(255,255,255,0.3);
          display: flex; align-items: center; justify-content: center;
          cursor: pointer; transition: all 0.15s;
        }
        .post-menu-btn:hover { background: rgba(255,255,255,0.06); color: rgba(255,255,255,0.7); }
        .post-category-tag {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 4px 10px 4px 8px;
          border-radius: 999px;
          background: rgba(132,204,22,0.07);
          border: 1px solid rgba(132,204,22,0.18);
          margin: 4px 14px 8px;
          width: fit-content;
        }
        .post-cat-dot {
          width: 5px; height: 5px;
          border-radius: 50%;
          background: #84cc16;
          flex-shrink: 0;
        }
        .post-category-tag span:last-child {
          font-size: 10.5px;
          font-weight: 700;
          color: rgba(132,204,22,0.8);
          letter-spacing: 0.04em;
          text-transform: uppercase;
          line-height: 1;
        }
      `}</style>

      {showActionMenu && (
        <ActionMenu
          position={actionMenuPos} isOwnPost={isOwnPost} content={post}
          contentType="post" currentUser={currentUser}
          onClose={() => setShowActionMenu(false)}
          onEdit={() => { setShowActionMenu(false); setShowEditModal(true); }}
          onShare={() => { setShowActionMenu(false); setShowShareModal(true); }}
          onDelete={handleDelete}
          onSave={() => {}}
          onReport={() => {}}
        />
      )}

      {showEditModal && (
        <EditPostModal post={post} currentUser={currentUser}
          onClose={() => setShowEditModal(false)} onUpdate={handlePostUpdate} />
      )}

      {showShareModal && ReactDOM.createPortal(
        <div style={{ position: "fixed", inset: 0, zIndex: 100002 }}>
          <ShareModal content={post} contentType="post" currentUser={currentUser} onClose={() => setShowShareModal(false)} />
        </div>,
        document.body
      )}

      {lightboxImage && <ImageLightbox imageUrl={lightboxImage} onClose={() => setLightboxImage(null)} />}

      {showFullPost && (
        <FullScreenPostView post={post} profile={profile} onClose={() => setShowFullPost(false)} currentUser={currentUser} />
      )}
    </>
  );
};

export default PostCard;