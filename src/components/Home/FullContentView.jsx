// ============================================================================
// src/components/Home/FullContentView.jsx - Full Story View Component
// ============================================================================

import React, { useState } from 'react';
import { ArrowLeft, X, Heart, MessageCircle, Share2, Eye } from 'lucide-react';
import ProfilePreview from '../Shared/ProfilePreview';
import ReactionPanel from '../Shared/ReactionPanel';
import CommentModal from '../Modals/CommentModal';
import ShareModal from '../Modals/ShareModal';
import ParsedText from '../Shared/ParsedText';
import mediaUrlService from '../../services/shared/mediaUrlService';

const FullContentView = ({ 
  story, 
  onClose, 
  currentUser,
  onHashtagClick,
  onMentionClick,
  onAuthorClick
}) => {
  const [showComments, setShowComments] = useState(false);
  const [showShare, setShowShare] = useState(false);

  const profile = {
    userId: story.user_id,
    author: story.profiles?.full_name || story.author || 'Unknown',
    username: story.profiles?.username || story.username || 'unknown',
    avatar: story.profiles?.avatar_id 
      ? mediaUrlService.getAvatarUrl(story.profiles.avatar_id, 200)
      : null,
    verified: story.profiles?.verified || story.verified || false
  };

  const coverImageUrl = story.cover_image_id 
    ? mediaUrlService.getStoryImageUrl(story.cover_image_id, 1200)
    : null;

  return (
    <>
      <div className="fullscreen-overlay" onClick={onClose}>
        <div className="fullscreen-container" onClick={(e) => e.stopPropagation()}>
          {/* Header */}
          <div className="fullscreen-header">
            <button className="header-btn" onClick={onClose}>
              <ArrowLeft size={24} />
            </button>
            <h2 className="header-title">Story</h2>
            <button className="header-btn" onClick={onClose}>
              <X size={24} />
            </button>
          </div>

          {/* Content */}
          <div className="fullscreen-content">
            {/* Author Info */}
            <div className="story-author-section">
              <ProfilePreview 
                profile={profile}
                onClick={onAuthorClick}
                size="large"
              />
              <span className="story-category-badge">{story.category}</span>
            </div>

            {/* Cover Image */}
            {coverImageUrl && (
              <div className="story-cover-container">
                <img 
                  src={coverImageUrl} 
                  alt={story.title}
                  className="story-cover-image"
                />
              </div>
            )}

            {/* Story Title */}
            <h1 className="story-full-title">{story.title}</h1>

            {/* Story Content */}
            <div className="story-full-content">
              <ParsedText 
                text={story.full_content}
                onHashtagClick={onHashtagClick}
                onMentionClick={onMentionClick}
              />
            </div>

            {/* Stats */}
            <div className="story-stats-bar">
              <div className="stat-item">
                <Eye size={18} />
                <span>{story.views?.toLocaleString() || 0} views</span>
              </div>
              <div className="stat-item">
                <Heart size={18} />
                <span>{story.likes?.toLocaleString() || 0} likes</span>
              </div>
              <div className="stat-item">
                <MessageCircle size={18} />
                <span>{story.comments_count?.toLocaleString() || 0} comments</span>
              </div>
            </div>

            {/* Reaction Panel */}
            <div className="story-reactions">
              <ReactionPanel
                content={{ ...story, type: 'story' }}
                currentUser={currentUser}
                onComment={() => setShowComments(true)}
                onShare={() => setShowShare(true)}
                layout="horizontal"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Modals */}
      {showComments && (
        <CommentModal
          content={{ ...story, type: 'story' }}
          currentUser={currentUser}
          onClose={() => setShowComments(false)}
          isMobile={window.innerWidth <= 768}
        />
      )}

      {showShare && (
        <ShareModal
          content={{ ...story, type: 'story' }}
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
          background: rgba(0, 0, 0, 0.95);
          z-index: 9999;
          display: flex;
          align-items: center;
          justify-content: center;
          animation: fadeIn 0.2s ease-out;
        }

        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        .fullscreen-container {
          width: 100%;
          max-width: 800px;
          height: 100vh;
          background: #000;
          display: flex;
          flex-direction: column;
          position: relative;
        }

        .fullscreen-header {
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

        .header-btn {
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

        .header-btn:hover {
          background: rgba(132, 204, 22, 0.2);
          color: #84cc16;
          transform: scale(1.05);
        }

        .header-title {
          font-size: 18px;
          font-weight: 700;
          color: #fff;
          margin: 0;
        }

        .fullscreen-content {
          flex: 1;
          overflow-y: auto;
          padding: 24px;
          scrollbar-width: thin;
          scrollbar-color: #84cc16 rgba(255, 255, 255, 0.1);
        }

        .fullscreen-content::-webkit-scrollbar {
          width: 8px;
        }

        .fullscreen-content::-webkit-scrollbar-track {
          background: rgba(255, 255, 255, 0.05);
        }

        .fullscreen-content::-webkit-scrollbar-thumb {
          background: #84cc16;
          border-radius: 4px;
        }

        .story-author-section {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 24px;
          padding-bottom: 16px;
          border-bottom: 1px solid rgba(132, 204, 22, 0.1);
        }

        .story-category-badge {
          padding: 6px 16px;
          background: rgba(132, 204, 22, 0.2);
          border-radius: 20px;
          font-size: 13px;
          font-weight: 600;
          color: #84cc16;
        }

        .story-cover-container {
          width: 100%;
          margin-bottom: 24px;
          border-radius: 12px;
          overflow: hidden;
          background: rgba(255, 255, 255, 0.05);
        }

        .story-cover-image {
          width: 100%;
          height: auto;
          display: block;
        }

        .story-full-title {
          font-size: 28px;
          font-weight: 800;
          color: #fff;
          margin: 0 0 24px 0;
          line-height: 1.3;
        }

        .story-full-content {
          font-size: 16px;
          color: #d4d4d4;
          line-height: 1.8;
          margin-bottom: 32px;
          white-space: pre-wrap;
          word-wrap: break-word;
        }

        .story-stats-bar {
          display: flex;
          gap: 24px;
          padding: 16px 0;
          border-top: 1px solid rgba(132, 204, 22, 0.1);
          border-bottom: 1px solid rgba(132, 204, 22, 0.1);
          margin-bottom: 16px;
        }

        .stat-item {
          display: flex;
          align-items: center;
          gap: 8px;
          color: #a3a3a3;
          font-size: 14px;
        }

        .stat-item svg {
          color: #84cc16;
        }

        .story-reactions {
          padding: 16px 0;
        }

        @media (max-width: 768px) {
          .fullscreen-container {
            max-width: 100%;
          }

          .fullscreen-content {
            padding: 16px;
          }

          .story-full-title {
            font-size: 24px;
          }

          .story-full-content {
            font-size: 15px;
          }

          .story-stats-bar {
            flex-wrap: wrap;
            gap: 16px;
          }
        }
      `}</style>
    </>
  );
};

export default FullContentView;