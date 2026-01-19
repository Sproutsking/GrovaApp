// src/components/Shared/StoryCard.jsx
import React from 'react';
import { Lock, Eye, MessageSquare, Heart, MoreVertical } from 'lucide-react';

const StoryCard = ({
  story,
  onAuthorClick,
  onUnlock,
  onList,
  isMarket = false,
  isGallery = false,
  handleOpenActionMenu,
  currentUser,
  handleLikeStory,
  handleOpenComments,
}) => {
  const isOwnStory = story.author === currentUser?.name;
  const canList = isGallery && !story.available; // Can only list if owned and sold out

  return (
    <div className="story-card">
      <div className="story-card-overlay"></div>
      <div className="story-card-glow"></div>
      <div className="story-card-content">
        {/* Action Menu Button */}
        {handleOpenActionMenu && (
          <button
            className="story-action-btn"
            onClick={(e) => handleOpenActionMenu(e, story, isOwnStory)}
          >
            <MoreVertical size={18} />
          </button>
        )}

        <div className="story-card-header">
          <div className="story-author-section">
            <div 
              className="story-avatar" 
              onClick={() => onAuthorClick && onAuthorClick(story)}
            >
              {story.avatar}
            </div>
            <div>
              <div className="story-author-info">
                <h3 
                  className="story-author-name" 
                  onClick={() => onAuthorClick && onAuthorClick(story)}
                >
                  {story.author}
                </h3>
                {story.verified && (
                  <div className="verified-badge">
                    <span>✓</span>
                  </div>
                )}
              </div>
              <p className="story-time">{story.timeAgo}</p>
            </div>
          </div>
          <span className="story-category">{story.category}</span>
        </div>

        <h2 className="story-title">{story.title}</h2>
        <p className="story-preview">{story.preview}</p>

        <div className="story-footer">
          <div className="story-stats">
            <span 
              className="story-stat" 
              onClick={() => handleLikeStory && handleLikeStory(story.id)}
            >
              <Heart size={16} />
              <span>{story.likes}</span>
            </span>
            <span 
              className="story-stat" 
              onClick={() => handleOpenComments && handleOpenComments(story)}
            >
              <MessageSquare size={16} />
              <span>{story.comments?.length || 0}</span>
            </span>
            <span className="story-stat">
              <Eye size={16} />
              <span>{story.views || 0}</span>
            </span>
          </div>

          {/* Market Listing - Buy Button */}
          {isMarket && (
            <button onClick={() => onUnlock && onUnlock(story)} className="unlock-btn">
              <Lock size={16} /> {story.listedPrice} GT
            </button>
          )}

          {/* Gallery View - List Button (only if sold out) */}
          {canList && (
            <button onClick={() => onList && onList(story)} className="list-btn">
              <Lock size={16} /> List for Sale
            </button>
          )}

          {/* Regular Story - Unlock Button (only if available) */}
          {!isMarket && !isGallery && story.available && (
            <button onClick={() => onUnlock && onUnlock(story)} className="unlock-btn">
              <Lock size={16} /> {story.unlockCost} GT
            </button>
          )}

          {/* Sold Out Indicator */}
          {!isMarket && !isGallery && !story.available && (
            <div className="sold-out-badge">
              <Lock size={16} /> Sold Out
            </div>
          )}
        </div>

        {/* Access Progress Bar */}
        {!isMarket && (
          <div className="access-progress">
            <div className="access-progress-bar">
              <div 
                className="access-progress-fill" 
                style={{ width: `${(story.currentAccesses / story.maxAccesses) * 100}%` }}
              ></div>
            </div>
            <span className="access-progress-text">
              {story.currentAccesses}/{story.maxAccesses} accesses
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

export default StoryCard;