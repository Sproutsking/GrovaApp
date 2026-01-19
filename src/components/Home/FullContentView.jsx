// src/components/Home/FullContentView.jsx
import React from 'react';
import { Heart, MessageCircle, Eye, ArrowLeft, X } from 'lucide-react';

const FullContentView = ({ content, onClose, onLike, onComment }) => {
  return (
    <div className="fullscreen-content-overlay" onClick={onClose}>
      <div className="fullscreen-content-container" onClick={(e) => e.stopPropagation()}>
        <div className="content-view-header">
          <button className="content-back-btn" onClick={onClose}>
            <ArrowLeft size={24} color="#ffffff" />
          </button>
          <h2 className="content-header-title">{content.author}'s {content.type === 'story' ? 'Story' : 'Post'}</h2>
          <button className="content-close-btn" onClick={onClose}>
            <X size={24} color="#ffffff" />
          </button>
        </div>
        <div className="content-full-body">
          <h2 className="content-title">{content.title || content.content}</h2>
          <p className="content-full-text">
            {content.fullContent || content.content}
          </p>
        </div>
        <div className="content-footer">
          <div className="card-stats">
            <button className="stat-btn" onClick={() => onLike?.(content.id)}>
              <Heart size={18} />
              <span>{content.likes}</span>
            </button>
            <button className="stat-btn" onClick={() => onComment?.(content)}>
              <MessageCircle size={18} />
              <span>{content.comments?.length || 0}</span>
            </button>
            <span className="stat-item">
              <Eye size={18} />
              <span>{content.views}</span>
            </span>
          </div>
        </div>
        <div className="comments-section">
          <h3>Comments</h3>
          {content.comments.map((comment) => (
            <div key={comment.id} className="comment-item">
              <span className="comment-author">{comment.author}</span>
              <p className="comment-text">{comment.text}</p>
              <span className="comment-time">{comment.timeAgo}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default FullContentView;