// ============================================================================
// src/components/Home/PostCard.jsx
//
// NEW in this version:
//  [DT1] Double-tap to like — tap anywhere on media/body area twice within
//        350ms triggers a heart burst animation at the tap position and fires
//        the like action. Works on image, video, and text-only posts.
//  [DT2] Love burst — floating ❤️ emoji explodes from the tap point,
//        scales up then fades away. Pure CSS animation via injected keyframes.
//  [VID] Video pipeline — GlobalVideoState shared across ALL tabs
//        (Posts, Reels, Stories, News) via a singleton exported from this file.
//        Any tab can import and control global play/mute state.
// ============================================================================

import React, { useState, useRef, useEffect, useCallback } from "react";
import ReactDOM from "react-dom";
import {
  Play,
  Volume2,
  VolumeX,
  ChevronLeft,
  ChevronRight,
  X,
  UserPlus,
  UserCheck,
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
import followService from "../../services/social/followService";

// ── Relative timestamp ────────────────────────────────────────────────────────
const relTime = (dateStr) => {
  if (!dateStr) return "";
  const diff = Date.now() - new Date(dateStr).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d`;
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
};

// ── [VID] Shared global video state — exported so ALL tabs can use it ─────────
export const GlobalVideoState = {
  globalPlayState: false,
  globalMuteState: true,
  listeners: new Set(),
  subscribe(cb) {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  },
  notify() {
    this.listeners.forEach((cb) => cb());
  },
  setGlobalPlayState(v) {
    this.globalPlayState = v;
    sessionStorage.setItem("gv_play", v);
    this.notify();
  },
  getGlobalPlayState() {
    const s = sessionStorage.getItem("gv_play");
    return s === null ? false : s === "true";
  },
  setGlobalMuteState(v) {
    this.globalMuteState = v;
    sessionStorage.setItem("gv_mute", v);
    this.notify();
  },
  getGlobalMuteState() {
    const s = sessionStorage.getItem("gv_mute");
    return s === null ? true : s === "true";
  },
  init() {
    this.globalPlayState = this.getGlobalPlayState();
    this.globalMuteState = this.getGlobalMuteState();
  },
};
GlobalVideoState.init();

// ── [DT1] Double-tap hook ─────────────────────────────────────────────────────
function useDoubleTap(onDoubleTap, delay = 350) {
  const lastTap = useRef(0);

  return useCallback(
    (e) => {
      const now = Date.now();
      const touch = e.touches?.[0] || e.changedTouches?.[0];
      const x = touch?.clientX ?? e.clientX;
      const y = touch?.clientY ?? e.clientY;

      if (now - lastTap.current < delay) {
        onDoubleTap({ x, y });
        lastTap.current = 0;
      } else {
        lastTap.current = now;
      }
    },
    [onDoubleTap, delay],
  );
}

// ── [DT2] Love burst overlay ──────────────────────────────────────────────────
const LoveBurst = ({ x, y, onDone }) => {
  useEffect(() => {
    const t = setTimeout(onDone, 900);
    return () => clearTimeout(t);
  }, [onDone]);

  const hearts = ["❤️", "❤️", "💖", "❤️", "💖", "❤️"];
  const angles = [270, 315, 0, 45, 90, 225];

  return ReactDOM.createPortal(
    <div
      style={{
        position: "fixed",
        left: x,
        top: y,
        zIndex: 99999,
        pointerEvents: "none",
        transform: "translate(-50%,-50%)",
      }}
    >
      <div className="lv-big">❤️</div>
      {hearts.map((h, i) => (
        <div
          key={i}
          className="lv-sat"
          style={{ "--angle": `${angles[i]}deg` }}
        >
          {h}
        </div>
      ))}
    </div>,
    document.body,
  );
};

// ── Image lightbox ────────────────────────────────────────────────────────────
const ImageLightbox = ({ imageUrl, onClose }) => {
  useEffect(() => {
    document.body.style.overflow = "hidden";
    const h = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", h);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", h);
    };
  }, [onClose]);

  return ReactDOM.createPortal(
    <div
      className="pc-lightbox-overlay"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="pc-lightbox-content">
        <button className="pc-lightbox-close" onClick={onClose}>
          <X size={20} />
        </button>
        <img src={imageUrl} alt="Full view" className="pc-lightbox-img" />
      </div>
    </div>,
    document.body,
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
}) => {
  const [post, setPost] = useState(initialPost);
  const [visible, setVisible] = useState(true);
  const [mediaErrors, setMediaErrors] = useState({});
  const [activeMedia, setActiveMedia] = useState(0);
  const [videoPlayingStates, setVideoPlayingStates] = useState({});
  const [muted, setMuted] = useState(GlobalVideoState.getGlobalMuteState());
  const [touchStart, setTouchStart] = useState(null);
  const [touchEnd, setTouchEnd] = useState(null);
  const [captionExpanded, setCaptionExpanded] = useState(false);
  const [lightboxImage, setLightboxImage] = useState(null);
  const [showActionMenu, setShowActionMenu] = useState(false);
  const [actionMenuPos, setActionMenuPos] = useState({ x: 0, y: 0 });
  const [showFullPost, setShowFullPost] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);
  const [textNeedsExpand, setTextNeedsExpand] = useState(false);
  const [captionNeedsClamp, setCaptionNeedsClamp] = useState(false);

  // [DT2] Love burst state
  const [loveBurst, setLoveBurst] = useState(null);

  const videoRefs = useRef({});
  const containerRef = useRef(null);
  const textRef = useRef(null);
  const captionRef = useRef(null);
  const deletedRef = useRef(null);

  useEffect(() => {
    if (visible) setPost(initialPost);
  }, [initialPost]); // eslint-disable-line

  const isOwnPost =
    post.user_id === currentUser?.id || post.user_id === currentUser?.uid;
  const isTextCard = Boolean(
    post.is_text_card === true ||
    post.is_text_card === "true" ||
    post.is_text_card === 1,
  );

  const profile = {
    userId: post.user_id,
    author: post.profiles?.full_name || post.author || "Unknown",
    username: post.profiles?.username || post.username || "unknown",
    avatar: post.profiles?.avatar_id
      ? mediaUrlService.getAvatarUrl(post.profiles.avatar_id, 200)
      : post.avatar || null,
    verified: post.profiles?.verified || post.verified || false,
  };

  // ── Follow state ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!currentUser?.id || isOwnPost) return;
    followService
      .isFollowing(currentUser.id, post.user_id)
      .then(setIsFollowing)
      .catch(() => {});
  }, [post.user_id, currentUser?.id, isOwnPost]); // eslint-disable-line

  const handleFollowToggle = async (e) => {
    e.stopPropagation();
    if (!currentUser?.id) return;
    const next = !isFollowing;
    setIsFollowing(next);
    try {
      if (next) await followService.followUser(currentUser.id, post.user_id);
      else await followService.unfollowUser(currentUser.id, post.user_id);
    } catch {
      setIsFollowing(!next);
    }
  };

  // ── Media helpers ─────────────────────────────────────────────────────────
  const getMediaItems = () => {
    if (isTextCard) return [];
    const items = [];
    if (post.image_ids?.length) {
      post.image_ids.forEach((id, i) => {
        if (id?.trim())
          items.push({
            type: "image",
            id,
            index: i,
            url: mediaUrlService.getImageUrl(id, {
              width: 1200,
              quality: "auto:best",
              format: "auto",
            }),
            metadata: post.image_metadata?.[i] || {},
          });
      });
    }
    if (post.video_ids?.length) {
      post.video_ids.forEach((id, i) => {
        if (id?.trim()) {
          const meta = post.video_metadata?.[i] || {};
          items.push({
            type: "video",
            id,
            index: i,
            url:
              mediaUrlService.getVideoUrl(id, {
                quality: "auto:best",
                format: "mp4",
              }) + ".mp4",
            thumbnail:
              meta.thumbnail_url || mediaUrlService.getVideoThumbnail(id),
            duration: meta.duration,
            metadata: meta,
          });
        }
      });
    }
    return items;
  };

  const mediaItems = getMediaItems();
  const hasMultipleMedia = mediaItems.length > 1;
  const hasMedia = mediaItems.length > 0;

  // ── Text-only overflow ────────────────────────────────────────────────────
  useEffect(() => {
    if (!textRef.current || !post.content || hasMedia || isTextCard) return;
    const measure = () => {
      const el = textRef.current;
      if (!el) return;
      setTextNeedsExpand(el.scrollHeight > window.innerHeight * 0.48);
    };
    const ro = new ResizeObserver(measure);
    ro.observe(textRef.current);
    measure();
    return () => ro.disconnect();
  }, [post.content, hasMedia, isTextCard]);

  // ── Media caption 2-line clamp ────────────────────────────────────────────
  useEffect(() => {
    if (!captionRef.current || !post.content || !hasMedia) return;
    const measure = () => {
      const el = captionRef.current;
      if (!el) return;
      const lh =
        parseFloat(window.getComputedStyle(el).lineHeight) ||
        parseFloat(window.getComputedStyle(el).fontSize) * 1.5 ||
        22;
      setCaptionNeedsClamp(el.scrollHeight > lh * 2 + 6);
    };
    const ro = new ResizeObserver(measure);
    ro.observe(captionRef.current);
    measure();
    return () => ro.disconnect();
  }, [post.content, hasMedia]);

  // ── Global video sync ─────────────────────────────────────────────────────
  useEffect(() => {
    const unsub = GlobalVideoState.subscribe(() => {
      setMuted(GlobalVideoState.globalMuteState);
      Object.values(videoRefs.current).forEach((v) => {
        if (v) v.muted = GlobalVideoState.globalMuteState;
      });
    });
    return unsub;
  }, []);

  // ── IntersectionObserver for auto-play/pause ──────────────────────────────
  useEffect(() => {
    if (!containerRef.current) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        const cur = mediaItems[activeMedia];
        if (cur?.type === "video") {
          const v = videoRefs.current[activeMedia];
          if (entry.isIntersecting && GlobalVideoState.globalPlayState && v) {
            v.muted = GlobalVideoState.globalMuteState;
            v.play().catch(() => {});
            setVideoPlayingStates((p) => ({ ...p, [activeMedia]: true }));
          } else if (!entry.isIntersecting && v && !v.paused) {
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
  }, [activeMedia, mediaItems]); // eslint-disable-line

  // ── [DT1] Double-tap handler — declared before early return ───────────────
  const fireLoveBurst = useCallback(
    ({ x, y }) => {
      setLoveBurst({ x, y, id: Date.now() });
      if (currentUser?.id) {
        window.dispatchEvent(
          new CustomEvent("grova:quicklike", {
            detail: {
              contentId: post.id,
              contentType: "post",
              userId: currentUser.id,
            },
          }),
        );
      }
    },
    [post.id, currentUser?.id],
  );

  const doubleTapHandler = useDoubleTap(fireLoveBurst);

  // ── Early return — MUST come after all hooks ──────────────────────────────
  if (!visible) return null;

  // ── Touch swipe for carousel ──────────────────────────────────────────────
  const onTouchStart = (e) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };
  const onTouchMove = (e) => setTouchEnd(e.targetTouches[0].clientX);
  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    const d = touchStart - touchEnd;
    if (d > 50 && activeMedia < mediaItems.length - 1)
      goToMedia(activeMedia + 1);
    if (d < -50 && activeMedia > 0) goToMedia(activeMedia - 1);
  };

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

  const goToMedia = (i) => {
    if (i >= 0 && i < mediaItems.length) setActiveMedia(i);
  };

  const handleMenu = (e) => {
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    setActionMenuPos({ x: rect.right, y: rect.bottom });
    setShowActionMenu(true);
  };

  const handlePostUpdate = (updated) => {
    setPost((prev) => ({ ...prev, ...updated }));
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
    return `${Math.floor(s / 60)}:${Math.floor(s % 60)
      .toString()
      .padStart(2, "0")}`;
  };

  return (
    <>
      <div className="content-card post-card" ref={containerRef}>
        {/* ── HEADER ──────────────────────────────────────────────────── */}
        <div className="pc-header">
          <ProfilePreview profile={profile} onClick={() => {}} size="small" />
          {post.created_at && (
            <span className="pc-timestamp">{relTime(post.created_at)}</span>
          )}
          <div className="pc-header-spacer" />

          {!isOwnPost && currentUser?.id && (
            <button
              className={`pc-follow-btn${isFollowing ? " following" : ""}`}
              onClick={handleFollowToggle}
            >
              {isFollowing ? (
                <>
                  <UserCheck size={13} />
                  <span>Following</span>
                </>
              ) : (
                <>
                  <UserPlus size={13} />
                  <span>Follow</span>
                </>
              )}
            </button>
          )}

          <button
            className="pc-menu-btn"
            onClick={handleMenu}
            aria-label="More options"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <circle cx="12" cy="5" r="2" />
              <circle cx="12" cy="12" r="2" />
              <circle cx="12" cy="19" r="2" />
            </svg>
          </button>
        </div>

        {/* ── BODY — double-tap zone ───────────────────────────────────── */}
        <div
          className="pc-body"
          onTouchEnd={doubleTapHandler}
          onDoubleClick={doubleTapHandler}
        >
          {/* TEXT CARD */}
          {isTextCard ? (
            <>
              <div className="pc-text-card-section">
                <CardPostDisplay post={post} />
              </div>
              {post.card_caption && (
                <div className="pc-text" style={{ padding: "6px 14px 0" }}>
                  <ParsedText text={post.card_caption} />
                </div>
              )}
            </>
          ) : /* TEXT-ONLY */
          !hasMedia ? (
            <>
              <div
                ref={textRef}
                className={`pc-text pc-text-only${!captionExpanded && textNeedsExpand ? " pc-text-fade" : ""}`}
                style={
                  !captionExpanded && textNeedsExpand
                    ? { maxHeight: "48vh", overflow: "hidden" }
                    : undefined
                }
              >
                <ParsedText text={post.content} />
              </div>
              {textNeedsExpand && !captionExpanded && (
                <button
                  className="pc-expand-btn"
                  onClick={() => setShowFullPost(true)}
                >
                  Read more
                </button>
              )}
            </>
          ) : (
            /* MEDIA */
            <>
              {post.content && (
                <>
                  <div
                    ref={captionRef}
                    className={`pc-text pc-caption${!captionExpanded && captionNeedsClamp ? " pc-caption-clamped" : ""}`}
                  >
                    <ParsedText text={post.content} />
                  </div>
                  {captionNeedsClamp && !captionExpanded && (
                    <button
                      className="pc-expand-btn pc-expand-inline"
                      onClick={() => setCaptionExpanded(true)}
                    >
                      …more
                    </button>
                  )}
                </>
              )}

              <div
                className="pc-media-container"
                onTouchStart={onTouchStart}
                onTouchMove={onTouchMove}
                onTouchEnd={(e) => {
                  onTouchEnd();
                  doubleTapHandler(e);
                }}
              >
                <div className="pc-media-viewer">
                  {mediaItems.map((item, index) => (
                    <div
                      key={`${item.type}-${item.id}-${index}`}
                      className={`pc-media-slide${index === activeMedia ? " active" : ""}`}
                    >
                      {item.type === "image" ? (
                        !mediaErrors[index] ? (
                          <img
                            src={item.url}
                            alt={`Post media ${index + 1}`}
                            className="pc-media-content pc-media-image"
                            onError={() =>
                              setMediaErrors((p) => ({ ...p, [index]: true }))
                            }
                            onClick={() => setLightboxImage(item.url)}
                            loading={index === 0 ? "eager" : "lazy"}
                          />
                        ) : (
                          <div className="pc-media-error">
                            <span>Image unavailable</span>
                          </div>
                        )
                      ) : !mediaErrors[index] ? (
                        <div className="pc-video-container">
                          <video
                            ref={(el) => (videoRefs.current[index] = el)}
                            src={item.url}
                            className="pc-media-content pc-media-video"
                            playsInline
                            loop
                            muted={muted}
                            preload="auto"
                            onLoadedData={(e) => (e.target.currentTime = 0.1)}
                            onError={() =>
                              setMediaErrors((p) => ({ ...p, [index]: true }))
                            }
                            onClick={() => toggleVideoPlay(index)}
                          />
                          {!videoPlayingStates[index] && (
                            <div
                              className="pc-video-play-overlay"
                              onClick={() => toggleVideoPlay(index)}
                            >
                              <button className="pc-video-play-btn">
                                <Play size={32} fill="white" />
                              </button>
                            </div>
                          )}
                          <button
                            className="pc-video-mute-btn"
                            onClick={(e) => toggleVideoMute(index, e)}
                          >
                            {muted ? (
                              <VolumeX size={20} />
                            ) : (
                              <Volume2 size={20} />
                            )}
                          </button>
                          {item.duration && (
                            <span className="pc-video-duration">
                              {formatDuration(item.duration)}
                            </span>
                          )}
                        </div>
                      ) : (
                        <div className="pc-media-error">
                          <span>Video unavailable</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {hasMultipleMedia && (
                  <>
                    <div className="pc-media-indicators">
                      {mediaItems.map((_, i) => (
                        <button
                          key={i}
                          className={`pc-media-dot${i === activeMedia ? " active" : ""}`}
                          onClick={() => goToMedia(i)}
                        />
                      ))}
                    </div>
                    {activeMedia > 0 && (
                      <button
                        className="pc-media-nav pc-media-nav--prev"
                        onClick={() => goToMedia(activeMedia - 1)}
                      >
                        <ChevronLeft size={24} />
                      </button>
                    )}
                    {activeMedia < mediaItems.length - 1 && (
                      <button
                        className="pc-media-nav pc-media-nav--next"
                        onClick={() => goToMedia(activeMedia + 1)}
                      >
                        <ChevronRight size={24} />
                      </button>
                    )}
                    <div className="pc-media-counter">
                      {activeMedia + 1} / {mediaItems.length}
                    </div>
                  </>
                )}
              </div>
            </>
          )}
        </div>

        {/* CATEGORY TAG */}
        {post.category && (
          <div className="pc-category-tag">
            <span className="pc-category-dot" />
            <span>{post.category}</span>
          </div>
        )}

        {/* FOOTER */}
        <div className="pc-footer">
          <ReactionPanel
            content={{ ...post, type: "post" }}
            currentUser={currentUser}
            layout="horizontal"
          />
        </div>
      </div>

      {/* Love burst portal */}
      {loveBurst && (
        <LoveBurst
          key={loveBurst.id}
          x={loveBurst.x}
          y={loveBurst.y}
          onDone={() => setLoveBurst(null)}
        />
      )}

      {showActionMenu && (
        <ActionMenu
          position={actionMenuPos}
          isOwnPost={isOwnPost}
          content={post}
          contentType="post"
          currentUser={currentUser}
          onClose={() => setShowActionMenu(false)}
          onEdit={() => {
            setShowActionMenu(false);
            setShowEditModal(true);
          }}
          onShare={() => {
            setShowActionMenu(false);
            setShowShareModal(true);
          }}
          onDelete={handleDelete}
          onSave={() => {}}
          onReport={() => {}}
        />
      )}

      {showEditModal && (
        <EditPostModal
          post={post}
          currentUser={currentUser}
          onClose={() => setShowEditModal(false)}
          onUpdate={handlePostUpdate}
        />
      )}

      {showShareModal &&
        ReactDOM.createPortal(
          <div className="pc-share-portal">
            <ShareModal
              content={post}
              contentType="post"
              currentUser={currentUser}
              onClose={() => setShowShareModal(false)}
            />
          </div>,
          document.body,
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

      <style>{PC_CSS}</style>
    </>
  );
};

const PC_CSS = `
/* ── Love burst ─────────────────────────────────────────────────────────────── */
@keyframes lvBig {
  0%   { opacity:0; transform:translate(-50%,-50%) scale(0.2); }
  40%  { opacity:1; transform:translate(-50%,-50%) scale(1.4); }
  70%  { opacity:1; transform:translate(-50%,-50%) scale(1.1); }
  100% { opacity:0; transform:translate(-50%,-50%) scale(1.3); }
}
@keyframes lvSat {
  0%   { opacity:0; transform:translate(-50%,-50%) rotate(var(--angle)) translateY(0px) scale(0.3); }
  30%  { opacity:1; }
  100% { opacity:0; transform:translate(-50%,-50%) rotate(var(--angle)) translateY(-55px) scale(0.9); }
}
.lv-big {
  position:absolute; font-size:72px; line-height:1;
  animation:lvBig 0.85s cubic-bezier(0.34,1.2,0.64,1) both;
  transform-origin:center;
  filter:drop-shadow(0 4px 16px rgba(239,68,68,0.7));
  pointer-events:none; user-select:none;
  transform:translate(-50%,-50%);
}
.lv-sat {
  position:absolute; font-size:26px; line-height:1;
  animation:lvSat 0.8s ease-out both;
  transform-origin:center;
  pointer-events:none; user-select:none;
  transform:translate(-50%,-50%);
}

/* ── Card ───────────────────────────────────────────────────────────────────── */
.post-card { contain:layout style; }

/* Header */
.pc-header { display:flex; align-items:center; gap:8px; padding:10px 14px 4px; }
.pc-header-spacer { flex:1; }
.pc-timestamp { font-size:11px; color:rgba(255,255,255,0.35); font-weight:500; white-space:nowrap; flex-shrink:0; }
.pc-follow-btn { display:inline-flex;align-items:center;gap:5px;padding:5px 11px;border-radius:999px;font-size:11.5px;font-weight:700;cursor:pointer;flex-shrink:0;white-space:nowrap;font-family:inherit;background:transparent;border:1px solid rgba(132,204,22,0.45);color:#84cc16;transition:background 0.2s,border-color 0.2s,color 0.2s; }
.pc-follow-btn:hover { background:rgba(132,204,22,0.1); }
.pc-follow-btn.following { background:rgba(132,204,22,0.08);border-color:rgba(132,204,22,0.22);color:rgba(132,204,22,0.75); }
.pc-follow-btn.following:hover { background:rgba(239,68,68,0.08);border-color:rgba(239,68,68,0.3);color:#ef4444; }
.pc-menu-btn { width:32px;height:32px;border-radius:8px;flex-shrink:0;background:transparent;border:none;color:rgba(255,255,255,0.3);display:flex;align-items:center;justify-content:center;cursor:pointer;transition:background 0.15s,color 0.15s; }
.pc-menu-btn:hover { background:rgba(255,255,255,0.06);color:rgba(255,255,255,0.7); }

/* Body */
.pc-body { padding-top:0; margin-top:0; }
.pc-text-card-section { }
.pc-text { padding:0 14px;color:#f0f0f0;font-size:15px;line-height:1.75;margin-top:4px;margin-bottom:0;word-break:break-word;white-space:pre-wrap; }
.pc-text-only.pc-text-fade { position:relative; }
.pc-text-only.pc-text-fade::after { content:"";position:absolute;bottom:0;left:0;right:0;height:56px;background:linear-gradient(to bottom,transparent,var(--card-bg,#111));pointer-events:none; }
.pc-caption { margin-bottom:0; }
.pc-caption.pc-caption-clamped { display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden; }
.pc-expand-btn { display:inline-block;background:none;border:none;padding:3px 14px 0;color:#6b7280;font-size:13.5px;font-weight:600;cursor:pointer;font-family:inherit;transition:color 0.15s;margin-bottom:4px;line-height:1.6; }
.pc-expand-btn:hover { color:#84cc16; }
.pc-expand-inline { padding:1px 14px 4px;font-size:13px; }

/* Media */
.pc-media-container { position:relative;margin-top:6px;overflow:hidden; }
.pc-media-viewer { position:relative;width:100%; }
.pc-media-slide { display:none;width:100%; }
.pc-media-slide.active { display:block; }
.pc-media-content { display:block;width:100%;height:auto;max-height:60vh;object-fit:contain;background:#000; }
.pc-media-image { cursor:zoom-in; }
.pc-video-container { position:relative;width:100%; }
.pc-media-video { cursor:pointer; }
.pc-video-play-overlay { position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.25);cursor:pointer; }
.pc-video-play-btn { width:64px;height:64px;border-radius:50%;background:rgba(0,0,0,0.55);border:2px solid rgba(255,255,255,0.8);color:#fff;display:flex;align-items:center;justify-content:center;cursor:pointer;transition:transform 0.15s; }
.pc-video-play-btn:hover { transform:scale(1.08); }
.pc-video-mute-btn { position:absolute;bottom:10px;right:10px;width:32px;height:32px;border-radius:50%;background:rgba(0,0,0,0.55);border:1px solid rgba(255,255,255,0.2);color:#fff;display:flex;align-items:center;justify-content:center;cursor:pointer;z-index:2; }
.pc-video-duration { position:absolute;bottom:10px;left:10px;background:rgba(0,0,0,0.65);color:#fff;font-size:11px;font-weight:700;padding:2px 6px;border-radius:4px;z-index:2; }
.pc-media-indicators { display:flex;justify-content:center;gap:5px;padding:8px 0 4px; }
.pc-media-dot { width:6px;height:6px;border-radius:50%;background:rgba(255,255,255,0.25);border:none;cursor:pointer;padding:0;transition:background 0.15s,transform 0.15s; }
.pc-media-dot.active { background:#84cc16;transform:scale(1.3); }
.pc-media-nav { position:absolute;top:50%;transform:translateY(-50%);width:36px;height:36px;border-radius:50%;background:rgba(0,0,0,0.55);border:1px solid rgba(255,255,255,0.15);color:#fff;display:flex;align-items:center;justify-content:center;cursor:pointer;z-index:2;transition:background 0.15s; }
.pc-media-nav:hover { background:rgba(0,0,0,0.8); }
.pc-media-nav--prev { left:10px; }
.pc-media-nav--next { right:10px; }
.pc-media-counter { position:absolute;top:10px;right:10px;background:rgba(0,0,0,0.6);color:#fff;font-size:11px;font-weight:700;padding:3px 8px;border-radius:99px;z-index:2; }
.pc-media-error { height:160px;display:flex;align-items:center;justify-content:center;background:rgba(255,255,255,0.03);color:rgba(255,255,255,0.3);font-size:13px; }

/* Category tag */
.pc-category-tag { display:inline-flex;align-items:center;gap:6px;padding:4px 10px 4px 8px;border-radius:999px;background:rgba(132,204,22,0.07);border:1px solid rgba(132,204,22,0.18);margin:6px 14px 6px;width:fit-content; }
.pc-category-dot { width:5px;height:5px;border-radius:50%;background:#84cc16;flex-shrink:0; }
.pc-category-tag span:last-child { font-size:10.5px;font-weight:700;color:rgba(132,204,22,0.8);letter-spacing:0.04em;text-transform:uppercase;line-height:1; }

/* Footer */
.pc-footer { padding:10px 14px 12px;border-top:1px solid rgba(132,204,22,0.08); }

/* Share portal / Lightbox */
.pc-share-portal { position:fixed;inset:0;z-index:9001; }
.pc-lightbox-overlay { position:fixed;inset:0;background:rgba(0,0,0,0.94);z-index:9500;display:flex;align-items:center;justify-content:center; }
.pc-lightbox-content { position:relative;max-width:90vw;max-height:90vh;display:flex;align-items:center;justify-content:center; }
.pc-lightbox-close { position:absolute;top:-44px;right:0;width:36px;height:36px;border-radius:50%;background:rgba(255,255,255,0.1);border:1px solid rgba(255,255,255,0.2);color:#fff;display:flex;align-items:center;justify-content:center;cursor:pointer;transition:background 0.15s; }
.pc-lightbox-close:hover { background:rgba(255,255,255,0.2); }
.pc-lightbox-img { max-width:90vw;max-height:90vh;object-fit:contain;border-radius:8px; }
`;

export default PostCard;
