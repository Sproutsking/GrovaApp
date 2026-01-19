// ============================================================================
// src/components/Modals/SavedContentModal.jsx - MANAGE SAVED CONTENT
// ============================================================================

import React, { useState, useEffect } from 'react';
import { X, Bookmark, Trash2, FolderPlus, Film, Image, BookOpen } from 'lucide-react';
import SaveModel from '../../models/SaveModel';
import { useToast } from '../../contexts/ToastContext';

const SavedContentModal = ({ currentUser, onClose, isMobile = false }) => {
  const [savedItems, setSavedItems] = useState([]);
  const [folders, setFolders] = useState([]);
  const [activeFolder, setActiveFolder] = useState('all');
  const [activeType, setActiveType] = useState('all');
  const [loading, setLoading] = useState(true);
  const { showToast } = useToast();

  useEffect(() => {
    loadSavedContent();
  }, [activeFolder, activeType]);

  const loadSavedContent = async () => {
    try {
      setLoading(true);
      
      // Get folders
      const userFolders = await SaveModel.getFolders(currentUser.id);
      setFolders(['all', ...userFolders]);

      // Get saved items
      const items = await SaveModel.getSavedContent(
        currentUser.id,
        activeType === 'all' ? null : activeType,
        activeFolder === 'all' ? null : activeFolder
      );

      setSavedItems(items);

    } catch (error) {
      console.error('Failed to load saved content:', error);
      showToast('error', 'Failed to load saved items');
    } finally {
      setLoading(false);
    }
  };

  const handleRemove = async (item) => {
    try {
      await SaveModel.saveContent(item.content_type, item.content_id, currentUser.id);
      
      setSavedItems(prev => prev.filter(i => i.id !== item.id));
      
      showToast('success', 'Removed from saved');

    } catch (error) {
      console.error('Failed to remove:', error);
      showToast('error', 'Failed to remove item');
    }
  };

  const getContentIcon = (type) => {
    switch (type) {
      case 'post': return <Image size={16} />;
      case 'reel': return <Film size={16} />;
      case 'story': return <BookOpen size={16} />;
      default: return <Bookmark size={16} />;
    }
  };

  const formatDate = (timestamp) => {
    return new Date(timestamp).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  return (
    <>
      <div className="saved-modal-overlay" onClick={onClose}>
        <div 
          className={`saved-modal ${isMobile ? 'saved-modal-mobile' : 'saved-modal-desktop'}`}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="saved-modal-header">
            <div className="saved-modal-title">
              <Bookmark size={24} />
              <h3>Saved Items</h3>
            </div>
            <button className="saved-close-btn" onClick={onClose}>
              <X size={24} />
            </button>
          </div>

          <div className="saved-filters">
            <div className="filter-group">
              <label>Folder:</label>
              <div className="filter-tabs">
                {folders.map(folder => (
                  <button
                    key={folder}
                    className={`filter-tab ${activeFolder === folder ? 'active' : ''}`}
                    onClick={() => setActiveFolder(folder)}
                  >
                    {folder === 'all' ? 'All' : folder}
                  </button>
                ))}
              </div>
            </div>

            <div className="filter-group">
              <label>Type:</label>
              <div className="filter-tabs">
                <button
                  className={`filter-tab ${activeType === 'all' ? 'active' : ''}`}
                  onClick={() => setActiveType('all')}
                >
                  All
                </button>
                <button
                  className={`filter-tab ${activeType === 'post' ? 'active' : ''}`}
                  onClick={() => setActiveType('post')}
                >
                  <Image size={14} /> Posts
                </button>
                <button
                  className={`filter-tab ${activeType === 'reel' ? 'active' : ''}`}
                  onClick={() => setActiveType('reel')}
                >
                  <Film size={14} /> Reels
                </button>
                <button
                  className={`filter-tab ${activeType === 'story' ? 'active' : ''}`}
                  onClick={() => setActiveType('story')}
                >
                  <BookOpen size={14} /> Stories
                </button>
              </div>
            </div>
          </div>

          <div className="saved-items-list">
            {loading ? (
              <div className="saved-loading">Loading saved items...</div>
            ) : savedItems.length === 0 ? (
              <div className="no-saved-items">
                <Bookmark size={48} />
                <p>No saved items</p>
                <span>Items you save will appear here</span>
              </div>
            ) : (
              savedItems.map(item => (
                <div key={item.id} className="saved-item">
                  <div className="saved-item-icon">
                    {getContentIcon(item.content_type)}
                  </div>
                  
                  <div className="saved-item-info">
                    <div className="saved-item-type">{item.content_type}</div>
                    <div className="saved-item-folder">{item.folder}</div>
                    <div className="saved-item-date">{formatDate(item.created_at)}</div>
                  </div>

                  <button 
                    className="saved-item-remove"
                    onClick={() => handleRemove(item)}
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <style jsx>{`
        .saved-modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.95);
          backdrop-filter: blur(20px);
          z-index: 9999;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .saved-modal {
          background: #000;
          border: 1px solid rgba(132, 204, 22, 0.3);
          border-radius: 20px;
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }

        .saved-modal-desktop {
          width: 700px;
          max-height: 80vh;
        }

        .saved-modal-mobile {
          width: 100%;
          height: 100vh;
          border-radius: 0;
        }

        .saved-modal-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 20px;
          border-bottom: 1px solid rgba(132, 204, 22, 0.2);
          background: rgba(132, 204, 22, 0.05);
        }

        .saved-modal-title {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .saved-modal-title h3 {
          font-size: 18px;
          font-weight: 700;
          color: #fff;
          margin: 0;
        }

        .saved-close-btn {
          background: none;
          border: none;
          color: #fff;
          cursor: pointer;
          padding: 4px;
          transition: all 0.2s;
        }

        .saved-close-btn:hover {
          color: #84cc16;
        }

        .saved-filters {
          padding: 20px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.1);
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .filter-group {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .filter-group label {
          font-size: 13px;
          font-weight: 600;
          color: #737373;
          text-transform: uppercase;
        }

        .filter-tabs {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }

        .filter-tab {
          padding: 6px 16px;
          background: none;
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 20px;
          color: #737373;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .filter-tab.active {
          background: rgba(132, 204, 22, 0.2);
          border-color: #84cc16;
          color: #84cc16;
        }

        .filter-tab:hover:not(.active) {
          background: rgba(255, 255, 255, 0.05);
        }

        .saved-items-list {
          flex: 1;
          overflow-y: auto;
          padding: 16px 20px;
        }

        .saved-items-list::-webkit-scrollbar {
          width: 6px;
        }

        .saved-items-list::-webkit-scrollbar-track {
          background: rgba(255, 255, 255, 0.05);
        }

        .saved-items-list::-webkit-scrollbar-thumb {
          background: rgba(132, 204, 22, 0.3);
          border-radius: 3px;
        }

        .saved-loading, .no-saved-items {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 60px 20px;
          text-align: center;
          color: #737373;
          gap: 12px;
        }

        .saved-item {
          display: flex;
          align-items: center;
          gap: 16px;
          padding: 16px;
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 12px;
          margin-bottom: 12px;
          transition: all 0.2s;
        }

        .saved-item:hover {
          background: rgba(132, 204, 22, 0.05);
          border-color: rgba(132, 204, 22, 0.3);
        }

        .saved-item-icon {
          width: 40px;
          height: 40px;
          border-radius: 10px;
          background: rgba(132, 204, 22, 0.2);
          display: flex;
          align-items: center;
          justify-content: center;
          color: #84cc16;
          flex-shrink: 0;
        }

        .saved-item-info {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .saved-item-type {
          font-size: 14px;
          font-weight: 600;
          color: #fff;
          text-transform: capitalize;
        }

        .saved-item-folder {
          font-size: 12px;
          color: #84cc16;
        }

        .saved-item-date {
          font-size: 12px;
          color: #737373;
        }

        .saved-item-remove {
          width: 36px;
          height: 36px;
          border-radius: 8px;
          background: rgba(239, 68, 68, 0.1);
          border: 1px solid rgba(239, 68, 68, 0.3);
          color: #ef4444;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s;
          flex-shrink: 0;
        }

        .saved-item-remove:hover {
          background: rgba(239, 68, 68, 0.2);
          transform: scale(1.05);
        }
      `}</style>
    </>
  );
};

export default SavedContentModal;