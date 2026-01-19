import React from 'react';

const AuthorInfo = ({ 
  author, 
  username,
  timeAgo, 
  verified, 
  avatar, 
  onAuthorClick,
  className = '' 
}) => {
  return (
    <div 
      className={`author-info-component ${className}`} 
      onClick={onAuthorClick}
      style={{ cursor: 'pointer' }}
    >
      <div className="author-avatar-wrapper">
        {typeof avatar === 'string' && avatar.startsWith('http') ? (
          <img src={avatar} alt={author} className="author-avatar-img" />
        ) : (
          <div className="author-avatar-letter">{avatar || author?.charAt(0) || 'U'}</div>
        )}
      </div>
      <div className="author-details-wrapper">
        <div className="author-name-row">
          <span className="author-name-text">{author || 'Unknown'}</span>
          {verified && <span className="verified-badge-icon">✓</span>}
        </div>
        {username && <span className="author-username-text">@{username}</span>}
        <span className="author-time-text">{timeAgo || 'Just now'}</span>
      </div>

      <style jsx>{`
        .author-info-component {
          display: flex;
          align-items: center;
          gap: 12px;
          transition: all 0.2s;
          padding: 4px;
          border-radius: 12px;
        }

        .author-info-component:hover {
          background: rgba(132, 204, 22, 0.05);
        }

        .author-avatar-wrapper {
          flex-shrink: 0;
        }

        .author-avatar-img,
        .author-avatar-letter {
          width: 44px;
          height: 44px;
          border-radius: 50%;
          object-fit: cover;
          border: 2px solid rgba(132, 204, 22, 0.3);
        }

        .author-avatar-letter {
          background: linear-gradient(135deg, #84cc16 0%, #65a30d 100%);
          display: flex;
          align-items: center;
          justify-content: center;
          color: #000;
          font-weight: 700;
          font-size: 18px;
        }

        .author-details-wrapper {
          flex: 1;
          min-width: 0;
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .author-name-row {
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .author-name-text {
          font-size: 15px;
          font-weight: 700;
          color: #ffffff;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .verified-badge-icon {
          flex-shrink: 0;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 18px;
          height: 18px;
          background: #84cc16;
          border-radius: 50%;
          color: #000;
          font-size: 11px;
          font-weight: 900;
        }

        .author-username-text {
          font-size: 13px;
          color: #84cc16;
          font-weight: 500;
        }

        .author-time-text {
          font-size: 13px;
          color: #737373;
          font-weight: 500;
        }
      `}</style>
    </div>
  );
};

export default AuthorInfo;