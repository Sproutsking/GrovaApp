import React, { useState, useRef, useEffect } from "react";
import { X } from "lucide-react";
import ProfilePreview from "../Shared/ProfilePreview";
import ReactionPanel from "../Shared/ReactionPanel";
import CommentModal from "../Modals/CommentModal";
import ShareModal from "../Modals/ShareModal";
import ParsedText from "../Shared/ParsedText";

const FullScreenPostView = ({ post, profile, onClose, currentUser }) => {
  const [showComments, setShowComments] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [touchStartX, setTouchStartX] = useState(null);
  const [commentSlideX, setCommentSlideX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  const containerRef = useRef(null);
  const sidebarRef = useRef(null);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  const handleTouchStart = (e) => {
    const touch = e.touches[0];
    const screenWidth = window.innerWidth;

    if (showComments) {
      setTouchStartX(touch.clientX);
      setIsDragging(true);
    } else if (touch.clientX > screenWidth * 0.8) {
      setTouchStartX(touch.clientX);
      setIsDragging(true);
    }
  };

  const handleTouchMove = (e) => {
    if (!isDragging || touchStartX === null) return;

    const touch = e.touches[0];
    const deltaX = touch.clientX - touchStartX;
    const screenWidth = window.innerWidth;

    if (showComments && deltaX < 0) {
      setCommentSlideX(Math.max(deltaX, -400));
    } else if (!showComments && deltaX < 0) {
      setCommentSlideX(Math.max(deltaX, -400));
    }
  };

  const handleTouchEnd = () => {
    if (!isDragging) return;

    if (showComments) {
      if (commentSlideX < -100) {
        setShowComments(false);
        setCommentSlideX(0);
      } else {
        setCommentSlideX(0);
      }
    } else {
      if (commentSlideX < -50) {
        setShowComments(true);
        setCommentSlideX(0);
      } else {
        setCommentSlideX(0);
      }
    }

    setIsDragging(false);
    setTouchStartX(null);
  };

  const handleMouseDown = (e) => {
    const screenWidth = window.innerWidth;

    if (showComments) {
      setTouchStartX(e.clientX);
      setIsDragging(true);
    } else if (e.clientX > screenWidth * 0.8) {
      setTouchStartX(e.clientX);
      setIsDragging(true);
    }
  };

  const handleMouseMove = (e) => {
    if (!isDragging || touchStartX === null) return;

    const deltaX = e.clientX - touchStartX;

    if (showComments && deltaX < 0) {
      setCommentSlideX(Math.max(deltaX, -400));
    } else if (!showComments && deltaX < 0) {
      setCommentSlideX(Math.max(deltaX, -400));
    }
  };

  const handleMouseUp = () => {
    if (!isDragging) return;

    if (showComments) {
      if (commentSlideX < -100) {
        setShowComments(false);
        setCommentSlideX(0);
      } else {
        setCommentSlideX(0);
      }
    } else {
      if (commentSlideX < -50) {
        setShowComments(true);
        setCommentSlideX(0);
      } else {
        setCommentSlideX(0);
      }
    }

    setIsDragging(false);
    setTouchStartX(null);
  };

  useEffect(() => {
    if (isDragging) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      return () => {
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
      };
    }
  }, [isDragging, touchStartX, commentSlideX, showComments]);

  return (
    <>
      <div
        className="fullscreen-post-overlay"
        onClick={onClose}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onMouseDown={handleMouseDown}
      >
        <div
          ref={containerRef}
          className="fullscreen-post-container"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="fullscreen-post-header">
            <ProfilePreview profile={profile} size="medium" />
            <button className="fullscreen-post-close" onClick={onClose}>
              <X size={24} />
            </button>
          </div>

          <div className="fullscreen-post-content">
            <ParsedText text={post.content} />
          </div>

          <div className="fullscreen-post-reactions">
            <ReactionPanel
              content={{ ...post, type: "post" }}
              currentUser={currentUser}
              onComment={() => setShowComments(true)}
              onShare={() => setShowShare(true)}
              layout="horizontal"
            />
          </div>
        </div>

        <div
          ref={sidebarRef}
          className={`comment-sidebar ${showComments ? "open" : ""}`}
          style={{
            transform: showComments
              ? `translateX(${commentSlideX}px)`
              : `translateX(${Math.min(0, commentSlideX)}px)`,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="comment-sidebar-header">
            <h3>Comments</h3>
            <button onClick={() => setShowComments(false)}>
              <X size={20} />
            </button>
          </div>
          <div className="comment-sidebar-content">
            {showComments && (
              <CommentModal
                content={{ ...post, type: "post" }}
                currentUser={currentUser}
                onClose={() => setShowComments(false)}
                embedded={true}
              />
            )}
          </div>
        </div>
      </div>

      {showShare && (
        <ShareModal
          content={{ ...post, type: "post" }}
          currentUser={currentUser}
          onClose={() => setShowShare(false)}
        />
      )}

      <style jsx>{`
        .fullscreen-post-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.98);
          z-index: 9999;
          display: flex;
          align-items: center;
          justify-content: center;
          animation: fadeIn 0.2s ease;
        }

        .fullscreen-post-container {
          width: 100%;
          max-width: 800px;
          height: 100vh;
          background: #000;
          display: flex;
          flex-direction: column;
          position: relative;
        }

        .fullscreen-post-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 16px;
          background: rgba(0, 0, 0, 0.8);
          border-bottom: 1px solid rgba(132, 204, 22, 0.2);
          position: sticky;
          top: 0;
          z-index: 10;
        }

        .fullscreen-post-close {
          width: 44px;
          height: 44px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(255, 255, 255, 0.1);
          border: none;
          border-radius: 50%;
          color: #fff;
          cursor: pointer;
          transition: all 0.2s;
        }

        .fullscreen-post-close:hover {
          background: rgba(132, 204, 22, 0.2);
          color: #84cc16;
          transform: scale(1.05);
        }

        .fullscreen-post-content {
          flex: 1;
          overflow-y: auto;
          padding: 24px;
          color: #fff;
          font-size: 18px;
          line-height: 1.8;
          scrollbar-width: thin;
          scrollbar-color: #84cc16 rgba(255, 255, 255, 0.1);
        }

        .fullscreen-post-content::-webkit-scrollbar {
          width: 8px;
        }

        .fullscreen-post-content::-webkit-scrollbar-track {
          background: rgba(255, 255, 255, 0.05);
        }

        .fullscreen-post-content::-webkit-scrollbar-thumb {
          background: #84cc16;
          border-radius: 4px;
        }

        .fullscreen-post-reactions {
          padding: 16px;
          background: rgba(0, 0, 0, 0.8);
          border-top: 1px solid rgba(132, 204, 22, 0.2);
        }

        .comment-sidebar {
          position: fixed;
          top: 0;
          right: 0;
          width: 100%;
          max-width: 400px;
          height: 100vh;
          background: #1a1a1a;
          transform: translateX(100%);
          transition: transform 0.3s ease;
          z-index: 10000;
          display: flex;
          flex-direction: column;
          border-left: 1px solid rgba(132, 204, 22, 0.2);
        }

        .comment-sidebar.open {
          transform: translateX(0);
        }

        .comment-sidebar-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 16px;
          background: rgba(0, 0, 0, 0.8);
          border-bottom: 1px solid rgba(132, 204, 22, 0.2);
        }

        .comment-sidebar-header h3 {
          font-size: 18px;
          font-weight: 700;
          color: #fff;
          margin: 0;
        }

        .comment-sidebar-header button {
          width: 36px;
          height: 36px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(255, 255, 255, 0.1);
          border: none;
          border-radius: 50%;
          color: #fff;
          cursor: pointer;
          transition: all 0.2s;
        }

        .comment-sidebar-header button:hover {
          background: rgba(239, 68, 68, 0.9);
        }

        .comment-sidebar-content {
          flex: 1;
          overflow-y: auto;
        }

        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }

        @media (max-width: 768px) {
          .fullscreen-post-container {
            max-width: 100%;
          }

          .fullscreen-post-content {
            padding: 16px;
            font-size: 16px;
          }

          .comment-sidebar {
            max-width: 100%;
          }
        }
      `}</style>
    </>
  );
};

export default FullScreenPostView;
