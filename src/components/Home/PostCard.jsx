// ============================================================================
// src/components/Home/PostCard.jsx - WITH PARSED HASHTAGS & MENTIONS
// ============================================================================

import React, { useState } from 'react';
import { MoreVertical } from 'lucide-react';
import ProfilePreview from '../Shared/ProfilePreview';
import ReactionPanel from '../Shared/ReactionPanel';
import CommentModal from '../Modals/CommentModal';
import ShareModal from '../Modals/ShareModal';
import ParsedText from '../Shared/ParsedText';
import mediaUrlService from '../../services/shared/mediaUrlService';

const PostCard = ({ 
  post, 
  currentUser, 
  onAuthorClick, 
  onActionMenu,
  onHashtagClick,
  onMentionClick 
}) => {
  const [showComments, setShowComments] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [imageError, setImageError] = useState({});

  const isOwnPost = post.user_id === currentUser?.id;

  const profile = {
    userId: post.user_id,
    author: post.profiles?.full_name || post.author || 'Unknown',
    username: post.profiles?.username || post.username || 'unknown',
    avatar: post.profiles?.avatar_id 
      ? mediaUrlService.getAvatarUrl(post.profiles.avatar_id, 200)
      : null,
    verified: post.profiles?.verified || post.verified || false
  };

  const handleMenu = (e) => {
    e.stopPropagation();
    if (onActionMenu) {
      onActionMenu(e, { ...post, type: 'post' }, isOwnPost);
    }
  };

  const getImageUrls = () => {
    if (!post.image_ids || post.image_ids.length === 0) return [];
    
    return post.image_ids.map(imageId => 
      mediaUrlService.getImageUrl(imageId, {
        width: 800,
        quality: 'auto:best',
        format: 'auto'
      })
    );
  };

  const imageUrls = getImageUrls();

  const handleImageError = (index) => {
    setImageError(prev => ({ ...prev, [index]: true }));
  };

  const getGridClass = (count) => {
    if (count === 1) return 'grid-1';
    if (count === 2) return 'grid-2';
    if (count === 3) return 'grid-3';
    return 'grid-4';
  };

  return (
    <>
      <div className="content-card post-card">
        <div className="card-header">
          <ProfilePreview 
            profile={profile}
            onClick={onAuthorClick}
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
            <p className="post-text">
              <ParsedText 
                text={post.content}
                onHashtagClick={onHashtagClick}
                onMentionClick={onMentionClick}
              />
            </p>
          )}
          
          {imageUrls.length > 0 && (
            <div className={`post-images ${getGridClass(imageUrls.length)}`}>
              {imageUrls.map((url, idx) => (
                !imageError[idx] ? (
                  <img 
                    key={idx} 
                    src={url} 
                    alt={`Post ${idx + 1}`} 
                    className="post-image"
                    onError={() => handleImageError(idx)}
                    loading="lazy"
                  />
                ) : (
                  <div key={idx} className="post-image-error">
                    <span>Image unavailable</span>
                  </div>
                )
              ))}
            </div>
          )}
        </div>

        <div className="card-footer">
          <ReactionPanel
            content={{ ...post, type: 'post' }}
            currentUser={currentUser}
            onComment={() => setShowComments(true)}
            onShare={() => setShowShare(true)}
            layout="horizontal"
          />
        </div>
      </div>

      {showComments && (
        <CommentModal
          content={{ ...post, type: 'post' }}
          currentUser={currentUser}
          onClose={() => setShowComments(false)}
          isMobile={window.innerWidth <= 768}
        />
      )}

      {showShare && (
        <ShareModal
          content={{ ...post, type: 'post' }}
          currentUser={currentUser}
          onClose={() => setShowShare(false)}
        />
      )}
    </>
  );
};

export default PostCard;