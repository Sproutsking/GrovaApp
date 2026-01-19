// ============================================================================
// src/components/Shared/ProfilePreview.jsx - COMPLETE FIXED
// ============================================================================

import React from 'react';
import { Sparkles } from 'lucide-react';

/**
 * ProfilePreview - Used across ALL content cards
 * Props:
 * - profile: { userId, author, username, avatar, verified }
 * - onClick: callback when profile is clicked
 * - size: 'small' | 'medium' | 'large'
 * - layout: 'horizontal' | 'vertical'
 * - showUsername: boolean
 */
const ProfilePreview = ({ 
  profile, 
  onClick, 
  size = 'medium',
  layout = 'horizontal',
  showUsername = true,
  className = ''
}) => {
  const { userId, author, username, avatar, verified } = profile;

  const sizes = {
    small: { avatar: 32, name: 13, username: 11 },
    medium: { avatar: 42, name: 14, username: 12 },
    large: { avatar: 52, name: 16, username: 13 }
  };

  const currentSize = sizes[size];

  const handleClick = (e) => {
    e.stopPropagation();
    if (onClick) {
      onClick(profile);
    }
  };

  // Check if avatar is a valid URL or just initials
  const isValidUrl = avatar && typeof avatar === 'string' && (
    avatar.startsWith('http://') || 
    avatar.startsWith('https://') ||
    avatar.startsWith('blob:')
  );

  return (
    <>
      <div 
        className={`profile-preview profile-preview-${layout} ${className}`}
        onClick={handleClick}
      >
        <div 
          className="profile-preview-avatar" 
          style={{ 
            width: `${currentSize.avatar}px`, 
            height: `${currentSize.avatar}px` 
          }}
        >
          {isValidUrl ? (
            <img 
              src={avatar} 
              alt={author} 
              onError={(e) => {
                // Fallback to initials if image fails to load
                e.target.style.display = 'none';
                e.target.nextSibling.style.display = 'flex';
              }}
            />
          ) : null}
          <span 
            className="profile-preview-fallback"
            style={{ 
              display: isValidUrl ? 'none' : 'flex',
              fontSize: `${currentSize.avatar * 0.5}px`
            }}
          >
            {author?.charAt(0)?.toUpperCase() || 'U'}
          </span>
        </div>

        <div className="profile-preview-info">
          <div className="profile-preview-name" style={{ fontSize: `${currentSize.name}px` }}>
            <span>{author || 'Unknown User'}</span>
            {verified && (
              <div className="profile-preview-verified">
                <Sparkles size={currentSize.name - 2} />
              </div>
            )}
          </div>
          
          {showUsername && username && (
            <div className="profile-preview-username" style={{ fontSize: `${currentSize.username}px` }}>
              @{username}
            </div>
          )}
        </div>
      </div>

      <style jsx>{`
        .profile-preview {
          display: flex;
          align-items: center;
          cursor: pointer;
          transition: all 0.2s;
          max-width: fit-content;
          background: rgba(0, 0, 0, 0.6);
          backdrop-filter: blur(10px);
          padding: 8px 12px;
          border-radius: 12px;
          border: 1px solid transparent;
        }

        .profile-preview:hover {
          transform: scale(1.02);
        }

        .profile-preview-horizontal {
          flex-direction: row;
          gap: 10px;
        }

        .profile-preview-vertical {
          flex-direction: column;
          gap: 8px;
          text-align: center;
        }

        .profile-preview-avatar {
          border-radius: 50%;
          border: 2px solid #84cc16;
          background: linear-gradient(135deg, #84cc16 0%, #65a30d 100%);
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 700;
          color: #000;
          flex-shrink: 0;
          overflow: hidden;
          position: relative;
        }

        .profile-preview-avatar img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          position: absolute;
          top: 0;
          left: 0;
        }

        .profile-preview-fallback {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 100%;
          height: 100%;
          font-weight: 800;
          color: #000;
        }

        .profile-preview-info {
          display: flex;
          flex-direction: column;
          gap: 2px;
          min-width: 0;
        }

        .profile-preview-name {
          font-weight: 700;
          color: #fff;
          display: flex;
          align-items: center;
          gap: 6px;
          text-shadow: 0 2px 4px rgba(0, 0, 0, 0.8);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .profile-preview-verified {
          width: 18px;
          height: 18px;
          border-radius: 50%;
          background: #84cc16;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #000;
          flex-shrink: 0;
        }

        .profile-preview-username {
          color: rgba(255, 255, 255, 0.7);
          font-weight: 500;
          text-shadow: 0 1px 2px rgba(0, 0, 0, 0.8);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        @media (max-width: 768px) {
          .profile-preview {
            padding: 6px 10px;
          }
        }
      `}</style>
    </>
  );
};

export default ProfilePreview;