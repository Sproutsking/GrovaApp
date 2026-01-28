import React, { useState } from 'react';
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
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);
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

  // Enhanced avatar URL with quality parameters
  let enhancedAvatar = avatar;
  if (avatar && typeof avatar === 'string') {
    // Clean URL first
    const cleanUrl = avatar.split('?')[0];
    if (cleanUrl.includes('supabase')) {
      // Higher resolution for retina displays
      const targetSize = currentSize.avatar * 3; // 3x for ultra-sharp images
      enhancedAvatar = `${cleanUrl}?quality=100&width=${targetSize}&height=${targetSize}&resize=cover&format=webp`;
    }
  }

  // Check if avatar is a valid URL
  const isValidUrl = enhancedAvatar && 
                     typeof enhancedAvatar === 'string' && 
                     !imageError &&
                     (enhancedAvatar.startsWith('http://') || 
                      enhancedAvatar.startsWith('https://') ||
                      enhancedAvatar.startsWith('blob:'));

  const handleImageLoad = () => {
    setImageLoaded(true);
    setImageError(false);
  };

  const handleImageError = (e) => {
    console.error('ProfilePreview image error:', e);
    setImageLoaded(false);
    setImageError(true);
  };

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
          {isValidUrl && (
            <img 
              src={enhancedAvatar} 
              alt={author}
              loading="eager"
              decoding="async"
              onLoad={handleImageLoad}
              onError={handleImageError}
              crossOrigin="anonymous"
            />
          )}
          <span 
            className="profile-preview-fallback"
            style={{ 
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
          background: rgba(0, 0, 0, 0.07);
          backdrop-filter: blur(10px);
          padding: 4px 12px;
          border-radius: 12px;
          border: 1px solid transparent;
        }

        .profile-preview:hover {
          transform: scale(1.02);
        }

        .profile-preview:active {
          transform: scale(0.98);
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
          border: 2.5px solid #84cc16;
          background: linear-gradient(135deg, #84cc16 0%, #65a30d 100%);
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 800;
          color: #000;
          flex-shrink: 0;
          overflow: hidden;
          position: relative;
          box-shadow: 0 3px 12px rgba(132, 204, 22, 0.4);
        }

        .profile-preview-avatar img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          position: absolute;
          top: 0;
          left: 0;
          image-rendering: -webkit-optimize-contrast;
          image-rendering: crisp-edges;
          backface-visibility: hidden;
          transform: translateZ(0);
          -webkit-font-smoothing: antialiased;
          -moz-osx-font-smoothing: grayscale;
          filter: brightness(1.15) contrast(1.2) saturate(1.25) sharpen(1.5);
          opacity: ${imageLoaded && !imageError ? '1' : '0'};
          transition: opacity 0.4s ease-in-out;
        }

        .profile-preview-fallback {
          position: absolute;
          inset: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          width: 100%;
          height: 100%;
          font-weight: 800;
          color: #000;
          opacity: ${imageLoaded && !imageError ? '0' : '1'};
          transition: opacity 0.4s ease-in-out;
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
          text-shadow: 0 2px 6px rgba(0, 0, 0, 0.9);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          filter: brightness(1.1);
        }

        .profile-preview-verified {
          width: 18px;
          height: 18px;
          border-radius: 50%;
          background: linear-gradient(135deg, #84cc16 0%, #a3e635 100%);
          display: flex;
          align-items: center;
          justify-content: center;
          color: #000;
          flex-shrink: 0;
          box-shadow: 0 2px 8px rgba(132, 204, 22, 0.5);
        }

        .profile-preview-username {
          color: rgba(255, 255, 255, 0.8);
          font-weight: 600;
          text-shadow: 0 1px 4px rgba(0, 0, 0, 0.9);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          filter: brightness(1.1);
        }

        @media (max-width: 768px) {
          .profile-preview {
            padding: 5px 12px;
          }
        }
      `}</style>
    </>
  );
};

export default ProfilePreview;