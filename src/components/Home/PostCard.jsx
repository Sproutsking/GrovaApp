import React, { useState, useEffect, useRef } from "react";
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
import mediaUrlService from "../../services/shared/mediaUrlService";

const GlobalVideoState = {
  globalPlayState: false,
  globalMuteState: true,
  listeners: new Set(),
  subscribe(callback) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  },
  notify() {
    this.listeners.forEach((callback) => callback());
  },
  setGlobalPlayState(shouldPlay) {
    this.globalPlayState = shouldPlay;
    sessionStorage.setItem("posts_global_play_state", shouldPlay.toString());
    this.notify();
  },
  getGlobalPlayState() {
    const saved = sessionStorage.getItem("posts_global_play_state");
    return saved === null ? false : saved === "true";
  },
  setGlobalMuteState(shouldMute) {
    this.globalMuteState = shouldMute;
    sessionStorage.setItem("posts_global_muted", shouldMute.toString());
    this.notify();
  },
  getGlobalMuteState() {
    const saved = sessionStorage.getItem("posts_global_muted");
    return saved === null ? true : saved === "true";
  },
  init() {
    this.globalPlayState = this.getGlobalPlayState();
    this.globalMuteState = this.getGlobalMuteState();
  },
};

GlobalVideoState.init();

const ImageLightbox = ({ imageUrl, onClose }) => {
  useEffect(() => {
    document.body.style.overflow = "hidden";
    const handleKeyDown = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", handleKeyDown);
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

const PostCard = ({ post, currentUser }) => {
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

  const videoRefs = useRef({});
  const containerRef = useRef(null);
  const captionRef = useRef(null);

  const isOwnPost = post.user_id === currentUser?.id;

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
            metadata: metadata,
          });
        }
      });
    }

    return items;
  };

  const mediaItems = getMediaItems();
  const hasMultipleMedia = mediaItems.length > 1;

  useEffect(() => {
    const unsubscribe = GlobalVideoState.subscribe(() => {
      setMuted(GlobalVideoState.globalMuteState);
      Object.keys(videoRefs.current).forEach((index) => {
        const video = videoRefs.current[index];
        if (video) video.muted = GlobalVideoState.globalMuteState;
      });
      const currentItem = mediaItems[activeMedia];
      if (currentItem?.type === "video") {
        const video = videoRefs.current[activeMedia];
        if (video) {
          const shouldPlay = isInViewport && GlobalVideoState.globalPlayState;
          if (shouldPlay && video.paused) {
            video.play().catch(() => {});
            setVideoPlayingStates((prev) => ({ ...prev, [activeMedia]: true }));
          } else if (!shouldPlay && !video.paused) {
            video.pause();
            setVideoPlayingStates((prev) => ({
              ...prev,
              [activeMedia]: false,
            }));
          }
        }
      }
    });
    return unsubscribe;
  }, [isInViewport, activeMedia, mediaItems]);

  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        const visible = entry.isIntersecting;
        setIsInViewport(visible);
        const currentItem = mediaItems[activeMedia];
        if (currentItem?.type === "video") {
          const video = videoRefs.current[activeMedia];
          if (visible && GlobalVideoState.globalPlayState && video) {
            video.muted = GlobalVideoState.globalMuteState;
            video.play().catch(() => {});
            setVideoPlayingStates((prev) => ({ ...prev, [activeMedia]: true }));
          } else if (!visible && video && !video.paused) {
            video.pause();
            setVideoPlayingStates((prev) => ({
              ...prev,
              [activeMedia]: false,
            }));
          }
        }
      },
      { threshold: 0.5 },
    );
    observer.observe(containerRef.current);
    return () => {
      if (containerRef.current) observer.unobserve(containerRef.current);
    };
  }, [activeMedia, mediaItems]);

  useEffect(() => {
    if (!captionRef.current || !post.content) return;
    const lineHeight = parseInt(
      window.getComputedStyle(captionRef.current).lineHeight,
    );
    const actualHeight = captionRef.current.scrollHeight;
    const visibleHeight = lineHeight * 2;
    setNeedsTruncation(actualHeight > visibleHeight);
  }, [post.content]);

  const handleViewMore = () => {
    setCaptionExpanded(true);
    const firstVideoIndex = mediaItems.findIndex(
      (item) => item.type === "video",
    );
    if (firstVideoIndex !== -1) {
      setActiveMedia(firstVideoIndex);
      setTimeout(() => toggleVideoPlay(firstVideoIndex), 100);
    }
  };

  const minSwipeDistance = 50;
  const onTouchStart = (e) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };
  const onTouchMove = (e) => setTouchEnd(e.targetTouches[0].clientX);
  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    const distance = touchStart - touchEnd;
    if (distance > minSwipeDistance && activeMedia < mediaItems.length - 1)
      goToMedia(activeMedia + 1);
    if (distance < -minSwipeDistance && activeMedia > 0)
      goToMedia(activeMedia - 1);
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      if (rect.top >= window.innerHeight || rect.bottom <= 0) return;
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
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeMedia, mediaItems.length]);

  const toggleVideoPlay = (index) => {
    const video = videoRefs.current[index];
    if (!video) return;
    const newPlayState = !videoPlayingStates[index];
    GlobalVideoState.setGlobalPlayState(newPlayState);
    if (newPlayState) {
      video.muted = GlobalVideoState.globalMuteState;
      video.play().catch(() => {});
      setVideoPlayingStates((prev) => ({ ...prev, [index]: true }));
    } else {
      video.pause();
      setVideoPlayingStates((prev) => ({ ...prev, [index]: false }));
    }
  };

  const toggleVideoMute = (index, e) => {
    e.stopPropagation();
    const newMuted = !muted;
    setMuted(newMuted);
    GlobalVideoState.setGlobalMuteState(newMuted);
  };

  useEffect(() => {
    Object.keys(videoRefs.current).forEach((index) => {
      const video = videoRefs.current[index];
      if (video) video.muted = GlobalVideoState.getGlobalMuteState();
    });
  }, []);

  useEffect(() => {
    Object.keys(videoRefs.current).forEach((index) => {
      const video = videoRefs.current[index];
      if (video && parseInt(index) !== activeMedia && !video.paused) {
        video.pause();
        setVideoPlayingStates((prev) => ({ ...prev, [index]: false }));
      }
    });
  }, [activeMedia]);

  const handleImageClick = (imageUrl) => setLightboxImage(imageUrl);
  const goToMedia = (index) => {
    if (index >= 0 && index < mediaItems.length) setActiveMedia(index);
  };
  const handleMenu = (e) => {
    e.stopPropagation();
    setActionMenuPos({ x: e.clientX, y: e.clientY });
    setShowActionMenu(true);
  };
  const handleMediaError = (index) =>
    setMediaErrors((prev) => ({ ...prev, [index]: true }));
  const formatDuration = (seconds) => {
    if (!seconds) return "";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <>
      <div className="content-card post-card" ref={containerRef}>
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
          {post.content && (
            <div
              ref={captionRef}
              className={`post-text ${!captionExpanded && needsTruncation ? "collapsed" : ""}`}
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

          {mediaItems.length > 0 && (
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
                    className={`media-slide ${index === activeMedia ? "active" : ""}`}
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
                  {mediaItems.map((_, index) => (
                    <button
                      key={index}
                      className={`media-indicator ${index === activeMedia ? "active" : ""}`}
                      onClick={() => goToMedia(index)}
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
            content={{ ...post, type: "post" }}
            contentType="post"
            currentUser={currentUser}
            onClose={() => setShowActionMenu(false)}
          />,
          document.body,
        )}

      {lightboxImage && (
        <ImageLightbox
          imageUrl={lightboxImage}
          onClose={() => setLightboxImage(null)}
        />
      )}
    </>
  );
};

export default PostCard;
