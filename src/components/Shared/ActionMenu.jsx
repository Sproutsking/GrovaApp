import React, { useState, useEffect } from 'react';
import { 
  Save, Edit, Flag, Trash2, Share2, X, Eye, EyeOff, Lock, Globe, 
  Users, ThumbsDown, Copy, BookmarkPlus, Edit3
} from 'lucide-react';

const ActionMenu = ({ 
  position, 
  isOwnPost, 
  content,
  contentType = 'post',
  currentUser,
  onClose, 
  onEdit, 
  onDelete,
  onShare,
  onSave,
  onReport
}) => {
  const [showSaveFolders, setShowSaveFolders] = useState(false);
  const [folders] = useState(['Favorites', 'Inspiration', 'Later']);

  const menuWidth = 280;
  const menuHeight = isOwnPost ? 420 : 380;
  
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  
  let left = position.x - menuWidth - 10;
  let top = position.y;
  
  if (left < 10) left = position.x + 10;
  if (left + menuWidth > viewportWidth - 10) left = viewportWidth - menuWidth - 10;
  if (top + menuHeight > viewportHeight - 10) top = viewportHeight - menuHeight - 10;
  if (top < 10) top = 10;

  const handleSave = async (folder) => {
    try {
      if (onSave) {
        onSave(folder);
      }
      onClose();
    } catch (error) {
      console.error('Save error:', error);
    }
  };

  const handleCopyLink = async () => {
    try {
      const url = `${window.location.origin}/${contentType}/${content?.id}`;
      await navigator.clipboard.writeText(url);
      alert('Link copied!');
      onClose();
    } catch (error) {
      alert('Failed to copy link');
    }
  };

  const handleDelete = () => {
    if (window.confirm(`Delete this ${contentType}? This cannot be undone.`)) {
      if (onDelete) onDelete();
      onClose();
    }
  };

  const handleEdit = () => {
    if (onEdit) onEdit();
    onClose();
  };

  const handleShare = () => {
    if (onShare) onShare();
    onClose();
  };

  const handleReport = () => {
    if (window.confirm(`Report this ${contentType} for violating community guidelines?`)) {
      if (onReport) onReport();
      alert('Report submitted');
      onClose();
    }
  };

  const handleNotInterested = () => {
    alert('You\'ll see less content like this');
    onClose();
  };

  return (
    <>
      <div className="action-menu-overlay" onClick={onClose}></div>
      
      <div
        className="action-menu"
        style={{ top: `${top}px`, left: `${left}px` }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="action-menu-header">
          <span className="action-menu-title">
            {isOwnPost ? `Manage ${contentType}` : `${contentType} Options`}
          </span>
        </div>
        
        <div className="action-menu-items">
          {isOwnPost ? (
            <>
              {/* OWNER ACTIONS */}
              <button className="action-item" onClick={handleEdit}>
                <Edit3 size={18} />
                <div className="action-item-content">
                  <div className="action-item-label">Edit {contentType}</div>
                  <div className="action-item-desc">Modify content</div>
                </div>
              </button>
              
              <button className="action-item" onClick={handleCopyLink}>
                <Copy size={18} />
                <div className="action-item-content">
                  <div className="action-item-label">Copy Link</div>
                  <div className="action-item-desc">Share via link</div>
                </div>
              </button>

              <button className="action-item" onClick={handleShare}>
                <Share2 size={18} />
                <div className="action-item-content">
                  <div className="action-item-label">Share {contentType}</div>
                  <div className="action-item-desc">Share to profile or story</div>
                </div>
              </button>
              
              <div className="action-divider"></div>
              
              <button className="action-item action-delete" onClick={handleDelete}>
                <Trash2 size={18} />
                <div className="action-item-content">
                  <div className="action-item-label">Delete {contentType}</div>
                  <div className="action-item-desc">Permanently remove</div>
                </div>
              </button>
            </>
          ) : (
            <>
              {/* VIEWER ACTIONS */}
              <button 
                className="action-item" 
                onClick={() => setShowSaveFolders(!showSaveFolders)}
              >
                <BookmarkPlus size={18} />
                <div className="action-item-content">
                  <div className="action-item-label">Save {contentType}</div>
                  <div className="action-item-desc">Add to saved items</div>
                </div>
              </button>

              {showSaveFolders && (
                <div className="save-folders-list">
                  {folders.map(folder => (
                    <button
                      key={folder}
                      className="folder-option"
                      onClick={() => handleSave(folder)}
                    >
                      {folder}
                    </button>
                  ))}
                </div>
              )}

              <button className="action-item" onClick={handleCopyLink}>
                <Copy size={18} />
                <div className="action-item-content">
                  <div className="action-item-label">Copy Link</div>
                  <div className="action-item-desc">Share via link</div>
                </div>
              </button>
              
              <button className="action-item" onClick={handleShare}>
                <Share2 size={18} />
                <div className="action-item-content">
                  <div className="action-item-label">Share {contentType}</div>
                  <div className="action-item-desc">Share to profile or story</div>
                </div>
              </button>

              <div className="action-divider"></div>

              <button className="action-item" onClick={handleNotInterested}>
                <ThumbsDown size={18} />
                <div className="action-item-content">
                  <div className="action-item-label">Not Interested</div>
                  <div className="action-item-desc">See less like this</div>
                </div>
              </button>
              
              <div className="action-divider"></div>
              
              <button className="action-item action-report" onClick={handleReport}>
                <Flag size={18} />
                <div className="action-item-content">
                  <div className="action-item-label">Report {contentType}</div>
                  <div className="action-item-desc">Report inappropriate content</div>
                </div>
              </button>
            </>
          )}
          
          <div className="action-divider"></div>
          
          <button className="action-item action-cancel" onClick={onClose}>
            <X size={18} />
            <div className="action-item-content">
              <div className="action-item-label">Cancel</div>
            </div>
          </button>
        </div>
      </div>

      <style jsx>{`
        .action-menu-overlay {
          position: fixed;
          inset: 0;
          z-index: 9998;
        }

        .action-menu {
          position: fixed;
          width: ${menuWidth}px;
          background: #0f0f0f;
          border: 1px solid rgba(132, 204, 22, 0.3);
          border-radius: 16px;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.9), 0 0 0 1px rgba(132, 204, 22, 0.1);
          z-index: 9999;
          overflow: hidden;
          animation: menuSlideIn 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        }

        @keyframes menuSlideIn {
          from {
            opacity: 0;
            transform: scale(0.95) translateY(-10px);
          }
          to {
            opacity: 1;
            transform: scale(1) translateY(0);
          }
        }

        .action-menu-header {
          padding: 16px;
          background: rgba(132, 204, 22, 0.05);
          border-bottom: 1px solid rgba(132, 204, 22, 0.2);
        }

        .action-menu-title {
          font-size: 14px;
          font-weight: 700;
          color: #84cc16;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .action-menu-items {
          padding: 8px;
          max-height: 400px;
          overflow-y: auto;
        }

        .action-menu-items::-webkit-scrollbar {
          width: 6px;
        }

        .action-menu-items::-webkit-scrollbar-track {
          background: rgba(255, 255, 255, 0.03);
        }

        .action-menu-items::-webkit-scrollbar-thumb {
          background: rgba(132, 204, 22, 0.3);
          border-radius: 3px;
        }

        .action-item {
          width: 100%;
          padding: 12px 14px;
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.05);
          border-radius: 10px;
          display: flex;
          align-items: center;
          gap: 12px;
          color: #e5e5e5;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
          margin-bottom: 6px;
        }

        .action-item:hover {
          background: rgba(132, 204, 22, 0.08);
          border-color: rgba(132, 204, 22, 0.3);
          transform: translateX(4px);
        }

        .action-item svg {
          flex-shrink: 0;
          opacity: 0.8;
        }

        .action-item-content {
          flex: 1;
        }

        .action-item-label {
          font-size: 14px;
          font-weight: 600;
          margin-bottom: 2px;
        }

        .action-item-desc {
          font-size: 11px;
          color: #737373;
        }

        .action-delete {
          background: rgba(239, 68, 68, 0.05);
          border-color: rgba(239, 68, 68, 0.2);
          color: #ef4444;
        }

        .action-delete:hover {
          background: rgba(239, 68, 68, 0.15);
          border-color: #ef4444;
        }

        .action-report {
          background: rgba(251, 146, 60, 0.05);
          border-color: rgba(251, 146, 60, 0.2);
          color: #fb923c;
        }

        .action-report:hover {
          background: rgba(251, 146, 60, 0.15);
          border-color: #fb923c;
        }

        .action-cancel {
          background: rgba(115, 115, 115, 0.05);
          border-color: rgba(115, 115, 115, 0.2);
          color: #737373;
        }

        .action-cancel:hover {
          background: rgba(115, 115, 115, 0.15);
          border-color: #737373;
        }

        .action-divider {
          height: 1px;
          background: rgba(255, 255, 255, 0.1);
          margin: 8px 0;
        }

        .save-folders-list {
          padding: 8px;
          background: rgba(132, 204, 22, 0.05);
          border-radius: 8px;
          margin: 0 0 8px 0;
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .folder-option {
          padding: 8px 12px;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(132, 204, 22, 0.2);
          border-radius: 6px;
          color: #84cc16;
          font-size: 13px;
          cursor: pointer;
          transition: all 0.2s;
        }

        .folder-option:hover {
          background: rgba(132, 204, 22, 0.2);
          border-color: #84cc16;
        }
      `}</style>
    </>
  );
};

export default ActionMenu;