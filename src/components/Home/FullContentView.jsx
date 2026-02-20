// ============================================================================
// src/components/Home/FullContentView.jsx - ENHANCED FULL STORY VIEW
// ============================================================================

import React, { useState, useEffect } from "react";
import {
  ArrowLeft,
  X,
  Heart,
  MessageCircle,
  Share2,
  Eye,
  Clock,
  BookOpen,
} from "lucide-react";
import ProfilePreview from "../Shared/ProfilePreview";
import ReactionPanel from "../Shared/ReactionPanel";
import CommentModal from "../Modals/CommentModal";
import ShareModal from "../Modals/ShareModal";
import ParsedText from "../Shared/ParsedText";
import mediaUrlService from "../../services/shared/mediaUrlService";

const FullContentView = ({
  story,
  onClose,
  currentUser,
  onHashtagClick,
  onMentionClick,
  onAuthorClick,
}) => {
  const [showComments, setShowComments] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [scrollProgress, setScrollProgress] = useState(0);

  const profile = {
    userId: story.user_id,
    author: story.profiles?.full_name || story.author || "Unknown",
    username: story.profiles?.username || story.username || "unknown",
    avatar: story.profiles?.avatar_id
      ? mediaUrlService.getAvatarUrl(story.profiles.avatar_id, 200)
      : null,
    verified: story.profiles?.verified || story.verified || false,
  };

  const coverImageUrl = story.cover_image_id
    ? mediaUrlService.getStoryImageUrl(story.cover_image_id, 1600)
    : null;

  // Calculate reading time
  const getReadingTime = () => {
    if (!story.full_content) return "5 min";
    const wordCount = story.full_content.split(/\s+/).length;
    const minutes = Math.ceil(wordCount / 200);
    return `${minutes} min read`;
  };

  // Track scroll progress
  useEffect(() => {
    const handleScroll = (e) => {
      const element = e.target;
      const scrollHeight = element.scrollHeight - element.clientHeight;
      const scrolled = (element.scrollTop / scrollHeight) * 100;
      setScrollProgress(Math.min(scrolled, 100));
    };

    const contentElement = document.querySelector(".fullscreen-content");
    if (contentElement) {
      contentElement.addEventListener("scroll", handleScroll);
      return () => contentElement.removeEventListener("scroll", handleScroll);
    }
  }, []);

  // Prevent body scroll when modal is open
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "auto";
    };
  }, []);

  return (
    <>
      <div className="fullscreen-overlay" onClick={onClose}>
        <div
          className="fullscreen-container"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Scroll Progress Bar */}
          <div className="scroll-progress-bar">
            <div
              className="scroll-progress-fill"
              style={{ width: `${scrollProgress}%` }}
            />
          </div>

          {/* Header */}
          <div className="fullscreen-header">
            <button className="header-btn" onClick={onClose}>
              <ArrowLeft size={24} />
            </button>
            <div className="header-center">
              <BookOpen size={20} />
              <span className="header-title">Full Story</span>
            </div>
            <button className="header-btn close-btn" onClick={onClose}>
              <X size={24} />
            </button>
          </div>

          {/* Content */}
          <div className="fullscreen-content">
            {/* Hero Cover */}
            {coverImageUrl && (
              <div className="story-full-hero">
                <img
                  src={coverImageUrl}
                  alt={story.title}
                  className="story-full-hero-img"
                />
                <div className="story-full-hero-gradient" />
              </div>
            )}

            {/* Article Container */}
            <div className="story-article-container">
              {/* Category Badge */}
              <div className="story-full-category">
                <span className="category-pill">{story.category}</span>
                <span className="reading-time">
                  <Clock size={14} />
                  {getReadingTime()}
                </span>
              </div>

              {/* Story Title */}
              <h1 className="story-full-title">{story.title}</h1>

              {/* Author Section */}
              <div className="story-full-author">
                <ProfilePreview
                  profile={profile}
                  onClick={onAuthorClick}
                  size="large"
                />
                <div className="author-meta">
                  <span className="publish-date">
                    {new Date(story.created_at).toLocaleDateString("en-US", {
                      month: "long",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </span>
                </div>
              </div>

              {/* Divider */}
              <div className="content-divider" />

              {/* Story Content */}
              <div className="story-full-body">
                <ParsedText
                  text={story.full_content}
                  onHashtagClick={onHashtagClick}
                  onMentionClick={onMentionClick}
                />
              </div>

              {/* End Divider */}
              <div className="content-divider" />

              {/* Stats Bar */}
              <div className="story-stats-section">
                <div className="stat-box">
                  <Eye size={20} />
                  <div className="stat-info">
                    <span className="stat-value">
                      {story.views?.toLocaleString() || 0}
                    </span>
                    <span className="stat-label">Views</span>
                  </div>
                </div>
                <div className="stat-box">
                  <Heart size={20} />
                  <div className="stat-info">
                    <span className="stat-value">
                      {story.likes?.toLocaleString() || 0}
                    </span>
                    <span className="stat-label">Likes</span>
                  </div>
                </div>
                <div className="stat-box">
                  <MessageCircle size={20} />
                  <div className="stat-info">
                    <span className="stat-value">
                      {story.comments_count?.toLocaleString() || 0}
                    </span>
                    <span className="stat-label">Comments</span>
                  </div>
                </div>
              </div>

              {/* Reaction Panel */}
              <div className="story-full-reactions">
                <ReactionPanel
                  content={{ ...story, type: "story" }}
                  currentUser={currentUser}
                  onComment={() => setShowComments(true)}
                  onShare={() => setShowShare(true)}
                  layout="horizontal"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modals */}
      {showComments && (
        <CommentModal
          content={{ ...story, type: "story" }}
          currentUser={currentUser}
          onClose={() => setShowComments(false)}
          isMobile={window.innerWidth <= 768}
        />
      )}

      {showShare && (
        <ShareModal
          content={{ ...story, type: "story" }}
          currentUser={currentUser}
          onClose={() => setShowShare(false)}
        />
      )}

      <style jsx>{`
        .fullscreen-overlay {
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
          animation: fadeIn 0.3s ease-out;
          backdrop-filter: blur(10px);
        }

        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }

        .fullscreen-container {
          width: 100%;
          max-width: 900px;
          height: 100vh;
          background: #000;
          display: flex;
          flex-direction: column;
          position: relative;
          box-shadow: 0 0 80px rgba(132, 204, 22, 0.1);
        }

        /* Scroll Progress Bar */
        .scroll-progress-bar {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 3px;
          background: rgba(255, 255, 255, 0.1);
          z-index: 100;
        }

        .scroll-progress-fill {
          height: 100%;
          background: linear-gradient(90deg, #84cc16 0%, #a3e635 100%);
          transition: width 0.1s ease-out;
          box-shadow: 0 0 10px rgba(132, 204, 22, 0.5);
        }

        /* Header */
        .fullscreen-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 16px 20px;
          background: rgba(0, 0, 0, 0.95);
          border-bottom: 1px solid rgba(132, 204, 22, 0.15);
          position: sticky;
          top: 0;
          z-index: 50;
          backdrop-filter: blur(12px);
        }

        .header-center {
          display: flex;
          align-items: center;
          gap: 10px;
          color: #84cc16;
          font-weight: 600;
        }

        .header-btn {
          width: 48px;
          height: 48px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 50%;
          color: #fff;
          cursor: pointer;
          transition: all 0.3s ease;
        }

        .header-btn:hover {
          background: rgba(132, 204, 22, 0.2);
          border-color: rgba(132, 204, 22, 0.4);
          color: #84cc16;
          transform: scale(1.05);
        }

        .close-btn:hover {
          background: rgba(239, 68, 68, 0.2);
          border-color: rgba(239, 68, 68, 0.4);
          color: #ef4444;
        }

        .header-title {
          font-size: 16px;
          font-weight: 600;
          color: #fff;
          margin: 0;
        }

        /* Content Area */
        .fullscreen-content {
          flex: 1;
          overflow-y: auto;
          scrollbar-width: thin;
          scrollbar-color: #84cc16 rgba(255, 255, 255, 0.05);
        }

        .fullscreen-content::-webkit-scrollbar {
          width: 10px;
        }

        .fullscreen-content::-webkit-scrollbar-track {
          background: rgba(255, 255, 255, 0.03);
        }

        .fullscreen-content::-webkit-scrollbar-thumb {
          background: #84cc16;
          border-radius: 5px;
        }

        .fullscreen-content::-webkit-scrollbar-thumb:hover {
          background: #a3e635;
        }

        /* Hero Section */
        .story-full-hero {
          position: relative;
          width: 100%;
          height: 400px;
          overflow: hidden;
          background: #0a0a0a;
        }

        .story-full-hero-img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .story-full-hero-gradient {
          position: absolute;
          bottom: 0;
          left: 0;
          right: 0;
          height: 50%;
          background: linear-gradient(to top, #000 0%, transparent 100%);
        }

        /* Article Container */
        .story-article-container {
          max-width: 720px;
          margin: 0 auto;
          padding: 40px 24px;
        }

        /* Category & Reading Time */
        .story-full-category {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 24px;
        }

        .category-pill {
          padding: 8px 16px;
          background: rgba(132, 204, 22, 0.15);
          border: 1px solid rgba(132, 204, 22, 0.3);
          border-radius: 24px;
          font-size: 13px;
          font-weight: 700;
          color: #84cc16;
          text-transform: uppercase;
          letter-spacing: 1px;
        }

        .reading-time {
          display: flex;
          align-items: center;
          gap: 6px;
          color: #737373;
          font-size: 14px;
          font-weight: 500;
        }

        /* Title */
        .story-full-title {
          font-size: 40px;
          font-weight: 900;
          color: #fff;
          margin: 0 0 32px 0;
          line-height: 1.2;
          letter-spacing: -1px;
          background: linear-gradient(135deg, #ffffff 0%, #d4d4d4 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }

        /* Author Section */
        .story-full-author {
          display: flex;
          align-items: center;
          gap: 16px;
          margin-bottom: 32px;
        }

        .author-meta {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .publish-date {
          color: #737373;
          font-size: 14px;
        }

        /* Divider */
        .content-divider {
          height: 1px;
          background: linear-gradient(
            90deg,
            transparent 0%,
            rgba(132, 204, 22, 0.3) 50%,
            transparent 100%
          );
          margin: 32px 0;
        }

        /* Story Body */
        .story-full-body {
          font-size: 18px;
          color: #e5e5e5;
          line-height: 1.8;
          margin-bottom: 48px;
          white-space: pre-wrap;
          word-wrap: break-word;
        }

        .story-full-body p {
          margin-bottom: 24px;
        }

        .story-full-body a {
          color: #84cc16;
          text-decoration: underline;
          transition: color 0.2s ease;
        }

        .story-full-body a:hover {
          color: #a3e635;
        }

        /* Stats Section */
        .story-stats-section {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 16px;
          margin-bottom: 32px;
        }

        .stat-box {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 20px;
          background: rgba(132, 204, 22, 0.05);
          border: 1px solid rgba(132, 204, 22, 0.15);
          border-radius: 16px;
          transition: all 0.3s ease;
        }

        .stat-box:hover {
          background: rgba(132, 204, 22, 0.1);
          border-color: rgba(132, 204, 22, 0.3);
          transform: translateY(-2px);
        }

        .stat-box svg {
          color: #84cc16;
          flex-shrink: 0;
        }

        .stat-info {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .stat-value {
          font-size: 20px;
          font-weight: 700;
          color: #fff;
        }

        .stat-label {
          font-size: 12px;
          color: #737373;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        /* Reactions */
        .story-full-reactions {
          padding: 24px 0;
          border-top: 1px solid rgba(132, 204, 22, 0.1);
        }

        /* Mobile Responsive */
        @media (max-width: 768px) {
          .fullscreen-container {
            max-width: 100%;
          }

          .fullscreen-header {
            padding: 12px 16px;
          }

          .header-btn {
            width: 44px;
            height: 44px;
          }

          .header-title {
            font-size: 15px;
          }

          .story-full-hero {
            height: 300px;
          }

          .story-article-container {
            padding: 32px 16px;
          }

          .story-full-title {
            font-size: 28px;
            margin-bottom: 24px;
          }

          .story-full-body {
            font-size: 16px;
            line-height: 1.7;
          }

          .story-stats-section {
            grid-template-columns: 1fr;
            gap: 12px;
          }

          .stat-box {
            padding: 16px;
          }

          .stat-value {
            font-size: 18px;
          }
        }
      `}</style>
    </>
  );
};

export default FullContentView;
