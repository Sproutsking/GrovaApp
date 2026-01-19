// ============================================================================
// src/components/Modals/CommentModal.jsx - ENHANCED WITH THREADING
// ============================================================================

import React, { useState, useEffect, useRef } from 'react';
import { X, Heart, MessageCircle, Send, ChevronDown, ChevronUp } from 'lucide-react';
import CommentModel from '../../models/CommentModel';
import LikeModel from '../../models/LikeModel';
import { useToast } from '../../contexts/ToastContext';

const CommentItem = ({ 
  comment, 
  contentType,
  currentUser, 
  onReply,
  level = 0,
  maxLevel = 3
}) => {
  const [showReplies, setShowReplies] = useState(true);
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(comment.likes || 0);
  const { showToast } = useToast();

  useEffect(() => {
    checkLikedStatus();
  }, [comment.id]);

  const checkLikedStatus = async () => {
    if (currentUser?.id) {
      const isLiked = await LikeModel.checkIfLiked('comment', comment.id, currentUser.id);
      setLiked(isLiked);
    }
  };

  const handleLikeComment = async () => {
    if (!currentUser?.id) {
      showToast('warning', 'Please login to like comments');
      return;
    }

    try {
      const result = await LikeModel.toggleLike('comment', comment.id, currentUser.id);
      setLiked(result.liked);
      setLikeCount(result.newCount);

      if (result.liked) {
        showToast('success', 'Comment liked!', '+0.5 EP earned');
      }
    } catch (error) {
      console.error('Failed to like comment:', error);
      showToast('error', 'Failed to like comment');
    }
  };

  const hasReplies = comment.replies && comment.replies.length > 0;
  const canNest = level < maxLevel;

  return (
    <div className="comment-thread" style={{ marginLeft: `${level * 20}px` }}>
      <div className="comment-item">
        <div className="comment-avatar">
          {comment.avatar ? (
            <img src={comment.avatar} alt={comment.author} />
          ) : (
            <span>{comment.author?.charAt(0) || 'U'}</span>
          )}
        </div>

        <div className="comment-content">
          <div className="comment-header">
            <span className="comment-author">{comment.author}</span>
            <span className="comment-time">{comment.timeAgo}</span>
          </div>

          <p className="comment-text">{comment.text}</p>

          <div className="comment-actions">
            <button 
              className={`comment-action ${liked ? 'active' : ''}`}
              onClick={handleLikeComment}
            >
              <Heart size={14} fill={liked ? '#ef4444' : 'none'} />
              {likeCount > 0 && <span>{likeCount}</span>}
            </button>

            <button 
              className="comment-action"
              onClick={() => onReply(comment)}
            >
              <MessageCircle size={14} />
              <span>Reply</span>
            </button>

            {hasReplies && (
              <button 
                className="comment-action"
                onClick={() => setShowReplies(!showReplies)}
              >
                {showReplies ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                <span>{comment.totalReplies} {comment.totalReplies === 1 ? 'reply' : 'replies'}</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {hasReplies && showReplies && canNest && (
        <div className="comment-replies">
          {comment.replies.map(reply => (
            <CommentItem
              key={reply.id}
              comment={reply}
              contentType={contentType}
              currentUser={currentUser}
              onReply={onReply}
              level={level + 1}
              maxLevel={maxLevel}
            />
          ))}
        </div>
      )}
    </div>
  );
};

const CommentModal = ({
  content,
  onClose,
  currentUser,
  isMobile = false
}) => {
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [replyTo, setReplyTo] = useState(null);
  const [loading, setLoading] = useState(false);
  const [sortBy, setSortBy] = useState('recent');
  const { showToast } = useToast();

  useEffect(() => {
    loadComments();
  }, [content.id]);

  const loadComments = async () => {
    try {
      setLoading(true);
      const fetchedComments = await CommentModel.getComments(content.type, content.id);
      setComments(fetchedComments);
    } catch (error) {
      console.error('Failed to load comments:', error);
      showToast('error', 'Failed to load comments');
    } finally {
      setLoading(false);
    }
  };

  const handleAddComment = async () => {
    if (!currentUser?.id) {
      showToast('warning', 'Please login to comment');
      return;
    }

    if (!newComment.trim()) {
      showToast('warning', 'Please write a comment');
      return;
    }

    try {
      const comment = await CommentModel.addComment(
        content.type,
        content.id,
        currentUser.id,
        newComment,
        replyTo?.id || null
      );

      // Reload comments to get proper threading
      await loadComments();

      setNewComment('');
      setReplyTo(null);

      showToast('success', replyTo ? 'Reply posted!' : 'Comment posted!', '+2 EP earned');

    } catch (error) {
      console.error('Failed to add comment:', error);
      showToast('error', 'Failed to post comment');
    }
  };

  const handleReply = (comment) => {
    setReplyTo(comment);
    setNewComment('');
  };

  const sortedComments = [...comments].sort((a, b) => {
    if (sortBy === 'popular') {
      return (b.likes || 0) - (a.likes || 0);
    }
    return 0; // Keep original order for 'recent'
  });

  return (
    <>
      <div className="comment-modal-overlay" onClick={onClose}>
        <div 
          className={`comment-modal ${isMobile ? 'comment-modal-mobile' : 'comment-modal-desktop'}`}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="comment-modal-header">
            <div className="comment-modal-title">
              <h3>Comments</h3>
              <span className="comment-count">{comments.length}</span>
            </div>
            <button className="comment-close-btn" onClick={onClose}>
              <X size={24} />
            </button>
          </div>

          <div className="comment-sort-bar">
            <button 
              className={`sort-btn ${sortBy === 'recent' ? 'active' : ''}`}
              onClick={() => setSortBy('recent')}
            >
              Recent
            </button>
            <button 
              className={`sort-btn ${sortBy === 'popular' ? 'active' : ''}`}
              onClick={() => setSortBy('popular')}
            >
              Popular
            </button>
          </div>

          <div className="comments-list">
            {loading ? (
              <div className="comments-loading">Loading comments...</div>
            ) : sortedComments.length === 0 ? (
              <div className="no-comments">
                <MessageCircle size={48} />
                <p>No comments yet</p>
                <span>Be the first to share your thoughts!</span>
              </div>
            ) : (
              sortedComments.map(comment => (
                <CommentItem
                  key={comment.id}
                  comment={comment}
                  contentType={content.type}
                  currentUser={currentUser}
                  onReply={handleReply}
                />
              ))
            )}
          </div>

          <div className="comment-input-area">
            {replyTo && (
              <div className="reply-indicator">
                <span>Replying to {replyTo.author}</span>
                <button onClick={() => setReplyTo(null)}>
                  <X size={16} />
                </button>
              </div>
            )}
            <div className="comment-input-wrapper">
              <textarea
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder={replyTo ? `Reply to ${replyTo.author}...` : "Add a comment..."}
                onKeyPress={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleAddComment();
                  }
                }}
                rows={isMobile ? 2 : 1}
              />
              <button 
                className="send-btn"
                onClick={handleAddComment}
                disabled={!newComment.trim()}
              >
                <Send size={20} />
              </button>
            </div>
          </div>
        </div>
      </div>

      <style jsx>{`
        .comment-modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.95);
          backdrop-filter: blur(20px);
          z-index: 9999;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .comment-modal {
          background: #000;
          border: 1px solid rgba(132, 204, 22, 0.3);
          border-radius: 20px;
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }

        .comment-modal-desktop {
          width: 600px;
          max-height: 80vh;
        }

        .comment-modal-mobile {
          width: 100%;
          height: 100vh;
          border-radius: 0;
        }

        .comment-modal-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 20px;
          border-bottom: 1px solid rgba(132, 204, 22, 0.2);
          background: rgba(132, 204, 22, 0.05);
        }

        .comment-modal-title {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .comment-modal-title h3 {
          font-size: 18px;
          font-weight: 700;
          color: #fff;
          margin: 0;
        }

        .comment-count {
          padding: 2px 8px;
          background: rgba(132, 204, 22, 0.2);
          border-radius: 12px;
          font-size: 12px;
          color: #84cc16;
          font-weight: 600;
        }

        .comment-close-btn {
          background: none;
          border: none;
          color: #fff;
          cursor: pointer;
          padding: 4px;
          transition: all 0.2s;
        }

        .comment-close-btn:hover {
          color: #84cc16;
        }

        .comment-sort-bar {
          display: flex;
          gap: 8px;
          padding: 12px 20px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.1);
        }

        .sort-btn {
          padding: 6px 16px;
          background: none;
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 20px;
          color: #737373;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }

        .sort-btn.active {
          background: rgba(132, 204, 22, 0.2);
          border-color: #84cc16;
          color: #84cc16;
        }

        .comments-list {
          flex: 1;
          overflow-y: auto;
          padding: 16px 20px;
        }

        .comments-list::-webkit-scrollbar {
          width: 6px;
        }

        .comments-list::-webkit-scrollbar-track {
          background: rgba(255, 255, 255, 0.05);
        }

        .comments-list::-webkit-scrollbar-thumb {
          background: rgba(132, 204, 22, 0.3);
          border-radius: 3px;
        }

        .comments-loading, .no-comments {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 40px 20px;
          color: #737373;
          text-align: center;
          gap: 12px;
        }

        .comment-thread {
          margin-bottom: 16px;
        }

        .comment-item {
          display: flex;
          gap: 12px;
          padding: 12px 0;
        }

        .comment-avatar {
          width: 36px;
          height: 36px;
          border-radius: 50%;
          background: linear-gradient(135deg, #84cc16 0%, #65a30d 100%);
          display: flex;
          align-items: center;
          justify-content: center;
          color: #000;
          font-weight: 700;
          font-size: 14px;
          flex-shrink: 0;
          overflow: hidden;
        }

        .comment-avatar img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .comment-content {
          flex: 1;
          min-width: 0;
        }

        .comment-header {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 4px;
        }

        .comment-author {
          font-size: 14px;
          font-weight: 600;
          color: #fff;
        }

        .comment-time {
          font-size: 12px;
          color: #737373;
        }

        .comment-text {
          font-size: 14px;
          color: #e5e5e5;
          margin: 0 0 8px 0;
          line-height: 1.4;
          word-wrap: break-word;
        }

        .comment-actions {
          display: flex;
          align-items: center;
          gap: 16px;
        }

        .comment-action {
          display: flex;
          align-items: center;
          gap: 4px;
          background: none;
          border: none;
          color: #737373;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
          padding: 0;
        }

        .comment-action:hover, .comment-action.active {
          color: #84cc16;
        }

        .comment-replies {
          margin-top: 8px;
        }

        .comment-input-area {
          padding: 16px 20px;
          border-top: 1px solid rgba(132, 204, 22, 0.2);
        }

        .reply-indicator {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 8px 12px;
          background: rgba(132, 204, 22, 0.1);
          border-radius: 8px;
          margin-bottom: 8px;
          font-size: 13px;
          color: #84cc16;
        }

        .reply-indicator button {
          background: none;
          border: none;
          color: #ef4444;
          cursor: pointer;
          padding: 4px;
        }

        .comment-input-wrapper {
          display: flex;
          gap: 12px;
          align-items: flex-end;
        }

        .comment-input-wrapper textarea {
          flex: 1;
          padding: 12px;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(132, 204, 22, 0.2);
          border-radius: 12px;
          color: #fff;
          font-size: 14px;
          resize: none;
          font-family: inherit;
        }

        .comment-input-wrapper textarea:focus {
          outline: none;
          border-color: #84cc16;
        }

        .send-btn {
          width: 48px;
          height: 48px;
          border-radius: 12px;
          background: linear-gradient(135deg, #84cc16 0%, #65a30d 100%);
          border: none;
          color: #000;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s;
          flex-shrink: 0;
        }

        .send-btn:hover:not(:disabled) {
          transform: scale(1.05);
        }

        .send-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
      `}</style>
    </>
  );
};

export default CommentModal;