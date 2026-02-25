// ============================================================================
// src/components/Home/PostCard.jsx — OPTIMISTIC UI + INSTANT EDIT/DELETE
// No gap between header and caption. All operations instant.
// ============================================================================

import React, { useState, useRef, useEffect } from "react";
import ReactDOM from "react-dom";
import { MoreVertical, Play, Volume2, VolumeX, ChevronLeft, ChevronRight, X } from "lucide-react";
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

// ─── GLOBAL VIDEO STATE ───────────────────────────────────────────────────────
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

// ─── IMAGE LIGHTBOX ───────────────────────────────────────────────────────────
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

// ─── POST CARD ────────────────────────────────────────────────────────────────
const PostCard = ({ post: initialPost, currentUser, onPostUpdate, onPostDelete }) => {
  // ── OPTIMISTIC: use local post state ──────────────────────────────────────
  const [post, setPost] = useState(initialPost);
  const [visible, setVisible] = useState(true); // optimistic delete
  const [mediaErrors, setMediaErrors] = useState({});
  const [activeMedia, setActiveMedia] = useState(0);
  const [videoPlayingStates, setVideoPlayingStates] = useState({});
  const [muted, setMuted] = useState(GlobalVideoState.getGlobalMuteState());
  const [touchStart, setTouchStart] = useState(null);
  const [touchEnd, setTouchEnd] = useState(null);
  const [captionExpanded, setCaptionExpanded] = useState(false);
  const [needsTruncation, setNeedsTruncation] = useState(false);
  const [lightboxImage, setLightboxImage] = useState(null);
  const [isInViewport, setIsInViewport] = useState(false);
  const [showActionMenu, setShowActionMenu] = useState(false);
  const [actionMenuPos, setActionMenuPos] = useState({ x: 0, y: 0 });
  const [showFullPost, setShowFullPost] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);

  const videoRefs = useRef({});
  const containerRef = useRef(null);
  const captionRef = useRef(null);
  const deletedPostRef = useRef(null); // for rollback

  // Keep post in sync with prop changes (but not if optimistically removed)
  useEffect(() => {
    if (visible) setPost(initialPost);
  }, [initialPost]);

  const isOwnPost = post.user_id === currentUser?.id || post.user_id === currentUser?.uid;
  const isTextCard = Boolean(post.is_text_card === true || post.is_text_card === "true" || post.is_text_card === 1);

  const profile = {
    userId: post.user_id,
    author: post.profiles?.full_name || post.author || "Unknown",
    username: post.profiles?.username || post.username || "unknown",
    avatar: post.profiles?.avatar_id ? mediaUrlService.getAvatarUrl(post.profiles.avatar_id, 200) : null,
    verified: post.profiles?.verified || post.verified || false,
  };

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

  const mediaItems = getMediaItems();
  const hasMultipleMedia = mediaItems.length > 1;
  const hasMedia = mediaItems.length > 0;

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

  // Don't render if optimistically deleted
  if (!visible) return null;

  const handleViewMore = () => !hasMedia && !isTextCard ? setShowFullPost(true) : setCaptionExpanded(true);

  const onTouchStart = (e) => { setTouchEnd(null); setTouchStart(e.targetTouches[0].clientX); };
  const onTouchMove = (e) => setTouchEnd(e.targetTouches[0].clientX);
  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    const d = touchStart - touchEnd;
    if (d > 50 && activeMedia < mediaItems.length - 1) goToMedia(activeMedia + 1);
    if (d < -50 && activeMedia > 0) goToMedia(activeMedia - 1);
  };

  const toggleVideoPlay = (index) => {
    const v = videoRefs.current[index];
    if (!v) return;
    const next = !videoPlayingStates[index];
    GlobalVideoState.setGlobalPlayState(next);
    if (next) { v.muted = GlobalVideoState.globalMuteState; v.play().catch(() => {}); setVideoPlayingStates(p => ({ ...p, [index]: true })); }
    else { v.pause(); setVideoPlayingStates(p => ({ ...p, [index]: false })); }
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

  // ── INSTANT EDIT: update local state immediately ──────────────────────────
  const handlePostUpdate = (updated) => {
    setPost(prev => ({ ...prev, ...updated })); // instant local update
    setShowEditModal(false);
    if (onPostUpdate) onPostUpdate(updated);
  };

  // ── INSTANT DELETE: optimistic removal, rollback on fail ──────────────────
  const handleDelete = async (postId) => {
    deletedPostRef.current = post;
    setVisible(false); // instant UI removal
    if (onPostDelete) onPostDelete(postId); // notify parent immediately

    try {
      await postService.deletePost(postId);
    } catch (err) {
      console.error("Delete failed, rolling back:", err);
      setVisible(true); // rollback
      deletedPostRef.current = null;
      throw err;
    }
  };

  const handleSave = async (folder) => {
    console.log("Saving post to folder:", folder);
  };

  const handleReport = (postId, reason) => {
    console.log("Reporting post:", postId, reason);
  };

  const formatDuration = (s) => {
    if (!s) return "";
    return `${Math.floor(s / 60)}:${Math.floor(s % 60).toString().padStart(2, "0")}`;
  };

  return (
    <>
      <div
        className={`content-card post-card${!hasMedia && !isTextCard ? " pure-text" : ""}${isTextCard ? " text-card-post" : ""}`}
        ref={containerRef}
      >
        {/* Header — no bottom margin/padding so content is flush */}
        <div className="card-header" style={{ marginBottom: 0, paddingBottom: 0 }}>
          <ProfilePreview profile={profile} currentUser={currentUser} size="medium" />
          <div className="card-actions">
            <span className="category-badge">{post.category}</span>
            <button className="action-menu-btn" onClick={handleMenu} aria-label="Post options">
              <MoreVertical size={18} />
            </button>
          </div>
        </div>

        {/* Body — no top gap */}
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
                <div ref={captionRef}
                  className={`post-text${!captionExpanded && needsTruncation && hasMedia ? " collapsed" : ""}`}
                  style={{
                    maxHeight: !captionExpanded && needsTruncation && !hasMedia ? "50vh" : "none",
                    overflow: !captionExpanded && needsTruncation && !hasMedia ? "hidden" : "visible",
                    marginBottom: hasMedia ? 10 : 0,
                    marginTop: 6,
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
                            <img src={item.url} alt={`Post media ${index + 1}`} className="media-content image"
                              onError={() => setMediaErrors(p => ({ ...p, [index]: true }))}
                              onClick={() => setLightboxImage(item.url)} loading={index === 0 ? "eager" : "lazy"} />
                          ) : <div className="media-error"><span>Image unavailable</span></div>
                        ) : !mediaErrors[index] ? (
                          <div className="video-container">
                            <video ref={el => (videoRefs.current[index] = el)} src={item.url}
                              className="media-content video-content" playsInline loop muted={muted} preload="auto"
                              onLoadedData={e => (e.target.currentTime = 0.1)}
                              onError={() => setMediaErrors(p => ({ ...p, [index]: true }))}
                              onClick={() => toggleVideoPlay(index)} />
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

        <div className="card-footer">
          <ReactionPanel content={{ ...post, type: "post" }} currentUser={currentUser} layout="horizontal" />
        </div>
      </div>

      {showActionMenu && (
        <ActionMenu
          position={actionMenuPos} isOwnPost={isOwnPost} content={post}
          contentType="post" currentUser={currentUser}
          onClose={() => setShowActionMenu(false)}
          onEdit={() => { setShowActionMenu(false); setShowEditModal(true); }}
          onShare={() => { setShowActionMenu(false); setShowShareModal(true); }}
          onDelete={handleDelete} onSave={handleSave} onReport={handleReport}
        />
      )}

      {showEditModal && (
        <EditPostModal post={post} currentUser={currentUser}
          onClose={() => setShowEditModal(false)} onUpdate={handlePostUpdate} />
      )}

      {showShareModal && (
        <ShareModal content={post} contentType="post" onClose={() => setShowShareModal(false)} />
      )}

      {lightboxImage && <ImageLightbox imageUrl={lightboxImage} onClose={() => setLightboxImage(null)} />}

      {showFullPost && (
        <FullScreenPostView post={post} profile={profile}
          onClose={() => setShowFullPost(false)} currentUser={currentUser} />
      )}
    </>
  );
};

export default PostCard;