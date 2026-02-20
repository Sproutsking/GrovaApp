/**
 * PostCard.jsx — CRITICAL FIX FOR TEXT CARDS
 *
 * The problem: We check `post.is_text_card === true` but the database
 * might be returning it as a string "true" or the field might not exist
 * on old posts.
 *
 * The fix: Better boolean checking + ensure CardPostDisplay always renders
 * for text cards.
 */

import React, { useState, useRef, useEffect } from "react";
import ReactDOM from "react-dom";
import {
  MoreVertical,
  Play,
  Volume2,
  VolumeX,
  ChevronLeft,
  ChevronRight,
  X,
} from "lucide-react";
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

// ─── GLOBAL VIDEO STATE ──────────────────────────────────────────────────────
const GlobalVideoState = {
  globalPlayState: false,
  globalMuteState: true,
  listeners: new Set(),
  subscribe(callback) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  },
  notify() {
    this.listeners.forEach((cb) => cb());
  },
  setGlobalPlayState(v) {
    this.globalPlayState = v;
    sessionStorage.setItem("posts_global_play_state", v);
    this.notify();
  },
  getGlobalPlayState() {
    const s = sessionStorage.getItem("posts_global_play_state");
    return s === null ? false : s === "true";
  },
  setGlobalMuteState(v) {
    this.globalMuteState = v;
    sessionStorage.setItem("posts_global_muted", v);
    this.notify();
  },
  getGlobalMuteState() {
    const s = sessionStorage.getItem("posts_global_muted");
    return s === null ? true : s === "true";
  },
  init() {
    this.globalPlayState = this.getGlobalPlayState();
    this.globalMuteState = this.getGlobalMuteState();
  },
};
GlobalVideoState.init();

// ─── IMAGE LIGHTBOX ──────────────────────────────────────────────────────────
const ImageLightbox = ({ imageUrl, onClose }) => {
  useEffect(() => {
    document.body.style.overflow = "hidden";
    const handle = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handle);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", handle);
    };
  }, [onClose]);

  return (
    <div
      className="image-lightbox-overlay"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="image-lightbox-content">
        <button className="image-lightbox-close" onClick={onClose}>
          <X size={20} />
        </button>
        <img src={imageUrl} alt="Full view" className="image-lightbox-img" />
      </div>
    </div>
  );
};

// ─── POST CARD ────────────────────────────────────────────────────────────────
const PostCard = ({ post, currentUser, onPostUpdate, onPostDelete }) => {
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

  const isOwnPost = post.user_id === currentUser?.id;

  // ── CRITICAL FIX: Properly check if this is a text card ──────────────────
  // Convert to boolean explicitly in case database returns string or undefined
  const isTextCard = Boolean(
    post.is_text_card === true || post.is_text_card === "true",
  );

  // Log for debugging
  console.log("PostCard rendering:", {
    postId: post.id,
    is_text_card: post.is_text_card,
    isTextCard: isTextCard,
    has_metadata: !!post.text_card_metadata,
    content: post.content?.substring(0, 50),
  });

  const profile = {
    userId: post.user_id,
    author: post.profiles?.full_name || post.author || "Unknown",
    username: post.profiles?.username || post.username || "unknown",
    avatar: post.profiles?.avatar_id
      ? mediaUrlService.getAvatarUrl(post.profiles.avatar_id, 200)
      : null,
    verified: post.profiles?.verified || post.verified || false,
  };

  const getMediaItems = () => {
    // TEXT CARDS: never try to load image_ids as media
    if (isTextCard) return [];

    const items = [];
    if (post.image_ids && Array.isArray(post.image_ids)) {
      post.image_ids.forEach((imageId, index) => {
        if (imageId && imageId.trim()) {
          items.push({
            type: "image",
            id: imageId,
            url: mediaUrlService.getImageUrl(imageId, {
              width: 1200,
              quality: "auto:best",
              format: "auto",
            }),
            metadata: post.image_metadata?.[index] || {},
          });
        }
      });
    }
    if (post.video_ids && Array.isArray(post.video_ids)) {
      post.video_ids.forEach((videoId, index) => {
        if (videoId && videoId.trim()) {
          const metadata = post.video_metadata?.[index] || {};
          items.push({
            type: "video",
            id: videoId,
            url:
              mediaUrlService.getVideoUrl(videoId, {
                quality: "auto:best",
                format: "mp4",
              }) + ".mp4",
            thumbnail:
              metadata.thumbnail_url ||
              mediaUrlService.getVideoThumbnail(videoId),
            duration: metadata.duration,
            metadata,
          });
        }
      });
    }
    return items;
  };

  const mediaItems = getMediaItems();
  const hasMultipleMedia = mediaItems.length > 1;
  const hasMedia = mediaItems.length > 0;

  // Video/viewport effects (keeping existing code)
  useEffect(() => {
    const unsub = GlobalVideoState.subscribe(() => {
      setMuted(GlobalVideoState.globalMuteState);
      Object.keys(videoRefs.current).forEach((i) => {
        const v = videoRefs.current[i];
        if (v) v.muted = GlobalVideoState.globalMuteState;
      });
      const cur = mediaItems[activeMedia];
      if (cur?.type === "video") {
        const v = videoRefs.current[activeMedia];
        if (v) {
          const should = isInViewport && GlobalVideoState.globalPlayState;
          if (should && v.paused) {
            v.play().catch(() => {});
            setVideoPlayingStates((p) => ({ ...p, [activeMedia]: true }));
          } else if (!should && !v.paused) {
            v.pause();
            setVideoPlayingStates((p) => ({ ...p, [activeMedia]: false }));
          }
        }
      }
    });
    return unsub;
  }, [isInViewport, activeMedia, mediaItems]);

  useEffect(() => {
    if (!containerRef.current) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        const visible = entry.isIntersecting;
        setIsInViewport(visible);
        const cur = mediaItems[activeMedia];
        if (cur?.type === "video") {
          const v = videoRefs.current[activeMedia];
          if (visible && GlobalVideoState.globalPlayState && v) {
            v.muted = GlobalVideoState.globalMuteState;
            v.play().catch(() => {});
            setVideoPlayingStates((p) => ({ ...p, [activeMedia]: true }));
          } else if (!visible && v && !v.paused) {
            v.pause();
            setVideoPlayingStates((p) => ({ ...p, [activeMedia]: false }));
          }
        }
      },
      { threshold: 0.5 },
    );
    obs.observe(containerRef.current);
    return () => {
      if (containerRef.current) obs.unobserve(containerRef.current);
    };
  }, [activeMedia, mediaItems]);

  useEffect(() => {
    if (!captionRef.current || !post.content) return;
    if (hasMedia || isTextCard) {
      const lh = parseInt(
        window.getComputedStyle(captionRef.current).lineHeight,
      );
      setNeedsTruncation(captionRef.current.scrollHeight > lh * 2);
    } else {
      setNeedsTruncation(
        captionRef.current.scrollHeight > window.innerHeight * 0.5,
      );
    }
  }, [post.content, hasMedia, isTextCard]);

  const handleViewMore = () =>
    !hasMedia && !isTextCard ? setShowFullPost(true) : setCaptionExpanded(true);
  const minSwipe = 50;
  const onTouchStart = (e) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };
  const onTouchMove = (e) => setTouchEnd(e.targetTouches[0].clientX);
  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    const d = touchStart - touchEnd;
    if (d > minSwipe && activeMedia < mediaItems.length - 1)
      goToMedia(activeMedia + 1);
    if (d < -minSwipe && activeMedia > 0) goToMedia(activeMedia - 1);
  };

  useEffect(() => {
    const handle = (e) => {
      if (!containerRef.current) return;
      const r = containerRef.current.getBoundingClientRect();
      if (r.top >= window.innerHeight || r.bottom <= 0) return;
      if (e.key === "ArrowLeft" && activeMedia > 0) {
        e.preventDefault();
        goToMedia(activeMedia - 1);
      } else if (
        e.key === "ArrowRight" &&
        activeMedia < mediaItems.length - 1
      ) {
        e.preventDefault();
        goToMedia(activeMedia + 1);
      }
    };
    window.addEventListener("keydown", handle);
    return () => window.removeEventListener("keydown", handle);
  }, [activeMedia, mediaItems.length]);

  const toggleVideoPlay = (index) => {
    const v = videoRefs.current[index];
    if (!v) return;
    const next = !videoPlayingStates[index];
    GlobalVideoState.setGlobalPlayState(next);
    if (next) {
      v.muted = GlobalVideoState.globalMuteState;
      v.play().catch(() => {});
      setVideoPlayingStates((p) => ({ ...p, [index]: true }));
    } else {
      v.pause();
      setVideoPlayingStates((p) => ({ ...p, [index]: false }));
    }
  };

  const toggleVideoMute = (index, e) => {
    e.stopPropagation();
    const next = !muted;
    setMuted(next);
    GlobalVideoState.setGlobalMuteState(next);
  };

  useEffect(() => {
    Object.keys(videoRefs.current).forEach((i) => {
      const v = videoRefs.current[i];
      if (v) v.muted = GlobalVideoState.getGlobalMuteState();
    });
  }, []);
  useEffect(() => {
    Object.keys(videoRefs.current).forEach((i) => {
      const v = videoRefs.current[i];
      if (v && parseInt(i) !== activeMedia && !v.paused) {
        v.pause();
        setVideoPlayingStates((p) => ({ ...p, [i]: false }));
      }
    });
  }, [activeMedia]);

  const handleImageClick = (url) => setLightboxImage(url);
  const goToMedia = (i) => {
    if (i >= 0 && i < mediaItems.length) setActiveMedia(i);
  };
  const handleMenu = (e) => {
    e.stopPropagation();
    setActionMenuPos({ x: e.clientX, y: e.clientY });
    setShowActionMenu(true);
  };
  const handleEdit = () => {
    setShowActionMenu(false);
    setShowEditModal(true);
  };
  const handleShare = () => {
    setShowActionMenu(false);
    setShowShareModal(true);
  };
  const handleDelete = async (postId) => {
    try {
      await postService.deletePost(postId);
      if (onPostDelete) onPostDelete(postId);
    } catch (err) {
      console.error("Delete failed:", err);
      alert("Failed to delete post.");
    }
  };
  const handlePostUpdate = (updated) => {
    setShowEditModal(false);
    if (onPostUpdate) onPostUpdate(updated);
  };
  const handleMediaError = (i) => setMediaErrors((p) => ({ ...p, [i]: true }));
  const formatDuration = (s) => {
    if (!s) return "";
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  return (
    <>
      <div
        className={`content-card post-card${!hasMedia && !isTextCard ? " pure-text" : ""}${isTextCard ? " text-card-post" : ""}`}
        ref={containerRef}
      >
        <div className="card-header">
          <ProfilePreview
            profile={profile}
            currentUser={currentUser}
            size="medium"
          />
          <div className="card-actions">
            <span className="category-badge">{post.category}</span>
            <button className="action-menu-btn" onClick={handleMenu}>
              <MoreVertical size={18} />
            </button>
          </div>
        </div>

        <div className="post-content">
          {/* ═══════════════════════════════════════════════════════════════════
              TEXT CARD BRANCH — CRITICAL: This must render for text cards
              ═══════════════════════════════════════════════════════════════════ */}
          {isTextCard ? (
            <>
              {/* Card lives here — its own isolated container */}
              <div className="post-card-card-section">
                <CardPostDisplay post={post} />
              </div>

              {/* Optional caption below the card */}
              {post.card_caption && (
                <div
                  ref={captionRef}
                  className={`post-text${!captionExpanded && needsTruncation ? " collapsed" : ""}`}
                  style={{ marginTop: "10px" }}
                >
                  <ParsedText text={post.card_caption} />
                  {!captionExpanded && needsTruncation && (
                    <span className="view-more-text" onClick={handleViewMore}>
                      {" "}
                      ...more
                    </span>
                  )}
                </div>
              )}
            </>
          ) : (
            /* ═══════════════════════════════════════════════════════════════════
               REGULAR POST BRANCH — text + images/videos
               ═══════════════════════════════════════════════════════════════════ */
            <>
              {post.content && (
                <div
                  ref={captionRef}
                  className={`post-text${!captionExpanded && needsTruncation && hasMedia ? " collapsed" : ""}`}
                  style={{
                    maxHeight:
                      !captionExpanded && needsTruncation && !hasMedia
                        ? "50vh"
                        : "none",
                    overflow:
                      !captionExpanded && needsTruncation && !hasMedia
                        ? "hidden"
                        : "visible",
                    marginBottom: hasMedia ? "16px" : 0,
                  }}
                >
                  <ParsedText text={post.content} />
                  {!captionExpanded && needsTruncation && (
                    <span className="view-more-text" onClick={handleViewMore}>
                      {" "}
                      ...more
                    </span>
                  )}
                </div>
              )}

              {/* Images & Videos — normal media container */}
              {hasMedia && (
                <div
                  className="post-media-container"
                  onTouchStart={onTouchStart}
                  onTouchMove={onTouchMove}
                  onTouchEnd={onTouchEnd}
                >
                  <div className="post-media-viewer">
                    {mediaItems.map((item, index) => (
                      <div
                        key={`${item.type}-${item.id}-${index}`}
                        className={`media-slide${index === activeMedia ? " active" : ""}`}
                      >
                        {item.type === "image" ? (
                          !mediaErrors[index] ? (
                            <img
                              src={item.url}
                              alt={`Post media ${index + 1}`}
                              className="media-content image"
                              onError={() => handleMediaError(index)}
                              onClick={() => handleImageClick(item.url)}
                              loading={index === 0 ? "eager" : "lazy"}
                            />
                          ) : (
                            <div className="media-error">
                              <span>Image unavailable</span>
                            </div>
                          )
                        ) : !mediaErrors[index] ? (
                          <div className="video-container">
                            <video
                              ref={(el) => (videoRefs.current[index] = el)}
                              src={item.url}
                              className="media-content video-content"
                              playsInline
                              loop
                              muted={muted}
                              preload="auto"
                              onLoadedData={(e) => (e.target.currentTime = 0.1)}
                              onError={() => handleMediaError(index)}
                              onClick={() => toggleVideoPlay(index)}
                            />
                            {!videoPlayingStates[index] && (
                              <div
                                className="video-play-overlay"
                                onClick={() => toggleVideoPlay(index)}
                              >
                                <button className="video-play-button">
                                  <Play size={32} fill="white" />
                                </button>
                              </div>
                            )}
                            <button
                              className="video-mute-button"
                              onClick={(e) => toggleVideoMute(index, e)}
                            >
                              {muted ? (
                                <VolumeX size={20} />
                              ) : (
                                <Volume2 size={20} />
                              )}
                            </button>
                            {item.duration && (
                              <span className="video-duration-badge">
                                {formatDuration(item.duration)}
                              </span>
                            )}
                          </div>
                        ) : (
                          <div className="media-error">
                            <span>Video unavailable</span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  {hasMultipleMedia && (
                    <div className="media-indicators">
                      {mediaItems.map((_, i) => (
                        <button
                          key={i}
                          className={`media-indicator${i === activeMedia ? " active" : ""}`}
                          onClick={() => goToMedia(i)}
                        />
                      ))}
                    </div>
                  )}
                  {hasMultipleMedia && (
                    <>
                      {activeMedia > 0 && (
                        <button
                          className="media-nav-btn prev"
                          onClick={() => goToMedia(activeMedia - 1)}
                        >
                          <ChevronLeft size={24} />
                        </button>
                      )}
                      {activeMedia < mediaItems.length - 1 && (
                        <button
                          className="media-nav-btn next"
                          onClick={() => goToMedia(activeMedia + 1)}
                        >
                          <ChevronRight size={24} />
                        </button>
                      )}
                    </>
                  )}
                  {hasMultipleMedia && (
                    <div className="media-counter">
                      {activeMedia + 1} / {mediaItems.length}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        <div className="card-footer">
          <ReactionPanel
            content={{ ...post, type: "post" }}
            currentUser={currentUser}
            layout="horizontal"
          />
        </div>
      </div>

      {showActionMenu &&
        ReactDOM.createPortal(
          <ActionMenu
            position={actionMenuPos}
            isOwnPost={isOwnPost}
            content={post}
            contentType="post"
            currentUser={currentUser}
            onClose={() => setShowActionMenu(false)}
            onEdit={handleEdit}
            onShare={handleShare}
            onDelete={handleDelete}
          />,
          document.body,
        )}
      {showEditModal && (
        <EditPostModal
          post={post}
          currentUser={currentUser}
          onClose={() => setShowEditModal(false)}
          onUpdate={handlePostUpdate}
        />
      )}
      {showShareModal && (
        <ShareModal
          content={post}
          contentType="post"
          onClose={() => setShowShareModal(false)}
        />
      )}
      {lightboxImage && (
        <ImageLightbox
          imageUrl={lightboxImage}
          onClose={() => setLightboxImage(null)}
        />
      )}
      {showFullPost && (
        <FullScreenPostView
          post={post}
          profile={profile}
          onClose={() => setShowFullPost(false)}
          currentUser={currentUser}
        />
      )}
    </>
  );
};

export default PostCard;
