// ============================================================================
// src/components/Home/StoryCard.jsx - CLEAN REDESIGN WITH IMPORTED COMPONENTS
// ============================================================================

import React, { useState } from 'react';
import { Lock, MoreVertical, Sparkles, Eye } from 'lucide-react';
import ProfilePreview from '../Shared/ProfilePreview';
import ReactionPanel from '../Shared/ReactionPanel';
import CommentModal from '../Modals/CommentModal';
import ShareModal from '../Modals/ShareModal';
import ParsedText from '../Shared/ParsedText';
import mediaUrlService from '../../services/shared/mediaUrlService';

const StoryCard = ({ 
  story, 
  currentUser,
  onAuthorClick, 
  onUnlock, 
  onActionMenu,
  onOpenFull,
  onHashtagClick,
  onMentionClick 
}) => {
  const [showComments, setShowComments] = useState(false);
  const [showShare, setShowShare] = useState(false);

  const isOwnStory = story.user_id === currentUser?.id;
  const isLocked = story.unlock_cost > 0 && !story.unlocked;

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
    ? mediaUrlService.getStoryImageUrl(story.cover_image_id, 800)
    : null;

  const handleMenu = (e) => {
    e.stopPropagation();
    if (onActionMenu) {
      onActionMenu(e, { ...story, type: 'story' }, isOwnStory);
    }
  };

  const handleUnlockOrRead = () => {
    if (isLocked) {
      onUnlock(story);
    } else if (onOpenFull) {
      onOpenFull(story);
    }
  };

  return (
    <>
      <div className="story-card">
        {/* Header */}
        <div className="story-header">
          <ProfilePreview 
            profile={profile}
            onClick={onAuthorClick}
            size="medium"
          />
          
          <div className="header-actions">
            <span className="category-tag">
              <Sparkles size={12} />
              {story.category}
            </span>
            <button className="menu-btn" onClick={handleMenu}>
              <MoreVertical size={18} />
            </button>
          </div>
        </div>

        {/* Cover Image */}
        {coverImageUrl && (
          <div className="story-cover" onClick={handleUnlockOrRead}>
            <img 
              src={coverImageUrl} 
              alt={story.title}
              className="cover-img"
            />
            <div className="cover-gradient" />
            {isLocked && (
              <div className="lock-badge">
                <Lock size={16} />
                <span>Premium</span>
              </div>
            )}
          </div>
        )}

        {/* Content */}
        <div className="story-body">
          <h2 className="story-title" onClick={handleUnlockOrRead}>{story.title}</h2>
          
          <div className="story-preview-wrapper">
            <p className="story-preview">
              <ParsedText 
                text={story.preview}
                onHashtagClick={onHashtagClick}
                onMentionClick={onMentionClick}
              />
              <span className="preview-fade" />
            </p>
            
            <button 
              className={`inline-action-btn ${isLocked ? 'locked' : 'unlocked'}`}
              onClick={handleUnlockOrRead}
            >
              {isLocked ? (
                <>
                  <Lock size={14} />
                  <span>Unlock for {story.unlock_cost} GT</span>
                </>
              ) : (
                <>
                  <Eye size={14} />
                  <span>View Full Story</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="story-footer">
          <ReactionPanel
            content={{ ...story, type: 'story' }}
            currentUser={currentUser}
            onComment={() => setShowComments(true)}
            onShare={() => setShowShare(true)}
            layout="horizontal"
          />
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
    </>
  );
};

export default StoryCard;