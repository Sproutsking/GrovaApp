// ============================================================================
// src/components/Home/StoryCard.jsx - COMPLETE WITH AVATAR FIX
// ============================================================================

import React, { useState } from 'react';
import { Lock, MoreVertical } from 'lucide-react';
import ProfilePreview from '../Shared/ProfilePreview';
import ReactionPanel from '../Shared/ReactionPanel';
import CommentModal from '../Modals/CommentModal';
import ShareModal from '../Modals/ShareModal';
import mediaUrlService from '../../services/shared/mediaUrlService';

const StoryCard = ({ 
  story, 
  onAuthorClick, 
  onUnlock, 
  onActionMenu, 
  currentUser, 
  onOpenFull 
}) => {
  const [showComments, setShowComments] = useState(false);
  const [showShare, setShowShare] = useState(false);

  const isOwnStory = story.user_id === currentUser?.id;

  // FIXED: Generate full Cloudinary URL for avatar
  const profile = {
    userId: story.user_id,
    author: story.profiles?.full_name || story.author || 'Unknown',
    username: story.profiles?.username || story.username || 'unknown',
    avatar: story.profiles?.avatar_id 
      ? mediaUrlService.getAvatarUrl(story.profiles.avatar_id, 200)
      : null,
    verified: story.profiles?.verified || story.verified || false
  };

  const handleViewMore = () => {
    if (story.unlock_cost > 0 && !story.unlocked) {
      onUnlock(story);
    } else if (onOpenFull) {
      onOpenFull(story);
    }
  };

  return (
    <>
      <div className="content-card story-card">
        <div className="card-header">
          <ProfilePreview 
            profile={profile}
            onClick={onAuthorClick}
            size="medium"
          />
          
          <div className="card-actions">
            <span className="category-badge">{story.category}</span>
            <button 
              className="action-menu-btn" 
              onClick={(e) => onActionMenu?.(e, { ...story, type: 'story' }, isOwnStory)}
            >
              <MoreVertical size={18} />
            </button>
          </div>
        </div>

        <h2 className="story-title">{story.title}</h2>
        
        <p className="story-preview">
          {story.preview}
          <span className="view-more-inline" onClick={handleViewMore}>
            {' '}... View More
          </span>
        </p>

        <div className="card-footer">
          <ReactionPanel
            content={{ ...story, type: 'story' }}
            currentUser={currentUser}
            onComment={() => setShowComments(true)}
            onShare={() => setShowShare(true)}
            layout="horizontal"
          />
          
          {!story.unlocked && story.unlock_cost > 0 && (
            <button className="unlock-btn" onClick={() => onUnlock(story)}>
              <Lock size={16} /> {story.unlock_cost} GT
            </button>
          )}
        </div>
      </div>

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
        .content-card {
          background: rgba(0, 0, 0, 0.6);
          border: 1px solid rgba(132, 204, 22, 0.2);
          border-radius: 16px;
          overflow: hidden;
          transition: all 0.3s;
          margin-bottom: 16px;
        }

        .content-card:hover {
          border-color: rgba(132, 204, 22, 0.5);
          transform: translateY(-2px);
          box-shadow: 0 8px 24px rgba(132, 204, 22, 0.15);
        }

        .card-header {
          padding: 16px;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .card-actions {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .category-badge {
          padding: 4px 12px;
          background: rgba(132, 204, 22, 0.2);
          border-radius: 12px;
          font-size: 12px;
          font-weight: 600;
          color: #84cc16;
        }

        .action-menu-btn {
          width: 32px;
          height: 32px;
          border-radius: 8px;
          background: rgba(255, 255, 255, 0.05);
          border: none;
          color: #fff;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s;
        }

        .action-menu-btn:hover {
          background: rgba(132, 204, 22, 0.2);
          color: #84cc16;
        }

        .story-title {
          font-size: 18px;
          font-weight: 700;
          color: #fff;
          margin: 0;
          padding: 0 16px 12px;
        }

        .story-preview {
          font-size: 14px;
          color: #a3a3a3;
          line-height: 1.6;
          margin: 0;
          padding: 0 16px 16px;
          display: -webkit-box;
          -webkit-line-clamp: 3;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }

        .view-more-inline {
          color: #84cc16;
          cursor: pointer;
          font-weight: 600;
        }

        .view-more-inline:hover {
          text-decoration: underline;
        }

        .card-footer {
          padding: 12px 16px;
          background: rgba(0, 0, 0, 0.3);
          border-top: 1px solid rgba(132, 204, 22, 0.1);
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .unlock-btn {
          padding: 8px 16px;
          background: linear-gradient(135deg, #84cc16 0%, #65a30d 100%);
          border: none;
          border-radius: 8px;
          color: #000;
          font-size: 14px;
          font-weight: 700;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 6px;
          transition: all 0.2s;
        }

        .unlock-btn:hover {
          transform: scale(1.05);
          box-shadow: 0 4px 12px rgba(132, 204, 22, 0.4);
        }
      `}</style>
    </>
  );
};

export default StoryCard;