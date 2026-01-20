// ============================================================================
// src/components/Explore/ExploreView.jsx - FRESH BUILD
// ============================================================================

import React, { useState, useEffect, useRef } from 'react';
import { Search, Filter, ChevronDown, X, Loader } from 'lucide-react';
import exploreService from '../../services/explore/exploreService';
import PostCard from '../Home/PostCard';
import ReelCard from '../Home/ReelCard';
import StoryCard from '../Home/StoryCard';

const ExploreView = ({ currentUser, userId, onAuthorClick, onActionMenu }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [activeTab, setActiveTab] = useState('all');
  const [showSearchPanel, setShowSearchPanel] = useState(false);
  const [showTabsPanel, setShowTabsPanel] = useState(false);
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  const [loading, setLoading] = useState(false);
  const [content, setContent] = useState({ stories: [], posts: [], reels: [] });

  const searchRef = useRef(null);
  const tabsRef = useRef(null);
  const filterRef = useRef(null);

  const tabs = [
    { id: 'all', label: 'All' },
    { id: 'stories', label: 'Stories' },
    { id: 'posts', label: 'Posts' },
    { id: 'reels', label: 'Reels' }
  ];

  const categories = [
    'All', 'Folklore', 'Life Journey', 'Philosophy', 'Innovation',
    'Romance', 'Adventure', 'Mystery', 'Wisdom', 'Entertainment'
  ];

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (searchRef.current && !searchRef.current.contains(event.target)) {
        setShowSearchPanel(false);
      }
      if (tabsRef.current && !tabsRef.current.contains(event.target)) {
        setShowTabsPanel(false);
      }
      if (filterRef.current && !filterRef.current.contains(event.target)) {
        setShowFilterPanel(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Load content
  useEffect(() => {
    loadContent();
  }, [activeTab, selectedCategory]);

  // Debounced search
  useEffect(() => {
    if (searchQuery.length >= 2) {
      const timer = setTimeout(() => performSearch(), 350);
      return () => clearTimeout(timer);
    } else if (searchQuery.length === 0) {
      loadContent();
    }
  }, [searchQuery]);

  const loadContent = async () => {
    try {
      setLoading(true);
      const data = await exploreService.getTrending(activeTab, 50);
      setContent(data);
    } catch (err) {
      console.error('Failed to load:', err);
    } finally {
      setLoading(false);
    }
  };

  const performSearch = async () => {
    try {
      setLoading(true);
      const results = await exploreService.searchAll(searchQuery, {
        category: selectedCategory === 'All' ? null : selectedCategory
      });
      setContent(results);
    } catch (err) {
      console.error('Search failed:', err);
    } finally {
      setLoading(false);
    }
  };

  const getDisplayContent = () => {
    const { stories = [], posts = [], reels = [] } = content;
    
    switch (activeTab) {
      case 'stories': return { stories, posts: [], reels: [] };
      case 'posts': return { stories: [], posts, reels: [] };
      case 'reels': return { stories: [], posts: [], reels };
      default: return { stories, posts, reels };
    }
  };

  const displayContent = getDisplayContent();
  const totalCount = (displayContent.stories?.length || 0) + 
                     (displayContent.posts?.length || 0) + 
                     (displayContent.reels?.length || 0);

  const currentTabLabel = tabs.find(t => t.id === activeTab)?.label || 'All Content';

  return (
    <>
      <style>{`
        .xpl-wrapper { max-width: 1200px; margin: 0 auto; }
        
        .xpl-header {
          position: sticky;
          top: 0;
          background: #000;
          z-index: 100;
          border-bottom: 1px solid rgba(132, 204, 22, 0.12);
        }

        .xpl-controls {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 6px 10px;
        }

        .xpl-btn {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 7px 12px;
          background: transparent;
          border: 1px solid rgba(132, 204, 22, 0.25);
          border-radius: 6px;
          color: #84cc16;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.12s;
        }

        .xpl-btn:hover {
          background: rgba(132, 204, 22, 0.06);
          border-color: rgba(132, 204, 22, 0.4);
        }

        .xpl-btn.active {
          background: rgba(132, 204, 22, 0.12);
          border-color: #84cc16;
        }

        .xpl-tabs-btn { flex: 1; justify-content: space-between; }

        /* SEARCH DROPDOWN */
        .xpl-search-dd {
          width: 100%;
          position: absolute !important;
          top: calc(100% + 5px) !important;
          left: 0 !important;
          right: 0 !important;
          display: flex !important;
          align-items: center !important;
          gap: 12px !important;
          background: #000000 !important;
          border: 1.5px solid rgba(132, 204, 22, 0.3) !important;
          border-radius: 0 0 12px 12px !important;
          padding: 8px 16px !important;
          box-shadow: 0 10px 40px rgba(0, 0, 0, 0.95) !important;
          animation: dropIn 0.15s ease !important;
          z-index: 200 !important;
        }

        .xpl-search-dd:focus-within {
          border-color: #84cc16 !important;
          box-shadow: 0 0 0 3px rgba(132, 204, 22, 0.12), 0 10px 40px rgba(0, 0, 0, 0.95) !important;
        }

        .xpl-search-icon { color: #84cc16; flex-shrink: 0; }

        .xpl-search-input {
          flex: 1;
          background: none;
          border: none;
          color: #fff;
          font-size: 14px;
          outline: none;
          font-weight: 500;
        }

        .xpl-search-input::placeholder { color: #555; }

        .xpl-clear {
          background: none;
          border: none;
          color: #5e5e5e;
          cursor: pointer;
          padding: 5px;
          display: flex;
          font-width: 700;
          font-size: 16px;
          transition: all 0.12s;
          border: 1px solid #444444
        }

        .xpl-clear:hover { color: lime; transform: scale(1.1); }

        /* TABS DROPDOWN */
        .xpl-tabs-dd {
          position: absolute;
          top: calc(100% + 4px);
          left: 10px;
          right: 10px;
          background: #0a0a0a;
          border: 1px solid rgba(132, 204, 22, 0.2);
          border-radius: 10px;
          padding: 8px;
          box-shadow: 0 12px 48px rgba(0, 0, 0, 0.9);
          animation: dropIn 0.15s ease;
          z-index: 150;
        }

        .xpl-tab-opt {
          padding: 10px 14px;
          background: transparent;
          border: none;
          border-radius: 6px;
          color: #fff;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.12s;
          width: 100%;
          text-align: left;
        }

        .xpl-tab-opt:hover { background: rgba(132, 204, 22, 0.08); }
        .xpl-tab-opt.active { background: rgba(132, 204, 22, 0.15); color: #84cc16; }

        /* FILTER DROPDOWN */
        .xpl-filter-dd {
          position: absolute;
          top: calc(100% + 4px);
          right: 10px;
          background: #0a0a0a;
          border: 1px solid rgba(132, 204, 22, 0.2);
          border-radius: 10px;
          padding: 12px;
          min-width: 260px;
          box-shadow: 0 12px 48px rgba(0, 0, 0, 0.9);
          animation: dropIn 0.15s ease;
          z-index: 150;
        }

        .xpl-filter-label {
          font-size: 10px;
          font-weight: 700;
          color: #84cc16;
          text-transform: uppercase;
          letter-spacing: 0.6px;
          margin-bottom: 8px;
        }

        .xpl-cat-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 5px;
        }

        .xpl-cat-btn {
          padding: 7px 10px;
          background: transparent;
          border: 1px solid rgba(132, 204, 22, 0.15);
          border-radius: 5px;
          color: #fff;
          font-size: 11px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.12s;
          text-align: center;
        }

        .xpl-cat-btn:hover {
          background: rgba(132, 204, 22, 0.06);
          border-color: rgba(132, 204, 22, 0.3);
        }

        .xpl-cat-btn.active {
          background: #84cc16;
          color: #000;
          border-color: #84cc16;
        }

        /* CONTENT */
        .xpl-content { padding: 10px; }

        .xpl-results {
          margin-bottom: 12px;
          padding: 0 2px;
          font-size: 13px;
          color: #666;
        }

        .xpl-results strong { color: #84cc16; font-weight: 700; }

        .xpl-section { margin-bottom: 24px; }

        .xpl-section-title {
          font-size: 15px;
          font-weight: 700;
          color: #fff;
          margin: 0 0 10px 2px;
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .xpl-badge { font-size: 12px; color: #84cc16; font-weight: 600; }

        .xpl-reels-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
          gap: 14px;
        }

        .xpl-loading {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 60px 20px;
          gap: 10px;
        }

        .xpl-spinner {
          animation: spin 0.9s linear infinite;
          color: #84cc16;
        }

        .xpl-loading-text { font-size: 13px; color: #666; }

        .xpl-empty {
          text-align: center;
          padding: 60px 20px;
        }

        .xpl-empty-icon { font-size: 48px; margin-bottom: 10px; opacity: 0.25; }
        .xpl-empty-title { font-size: 16px; font-weight: 700; color: #fff; margin: 0 0 5px 0; }
        .xpl-empty-text { font-size: 13px; color: #666; }

        @keyframes dropIn {
          from { opacity: 0; transform: translateY(-10px); }
          to { opacity: 1; transform: translateY(0); }
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        @media (max-width: 768px) {
          .xpl-controls { gap: 4px; padding: 5px 8px; }
          .xpl-btn { padding: 6px 10px; font-size: 12px; }
          .xpl-tabs-btn span { max-width: 100px; overflow: hidden; text-overflow: ellipsis; }
          .xpl-filter-dd {
            position: fixed;
            top: auto;
            bottom: 0;
            left: 0;
            right: 0;
            border-radius: 14px 14px 0 0;
            max-height: 65vh;
            overflow-y: auto;
          }
          .xpl-reels-grid { grid-template-columns: 1fr; }
        }
      `}</style>

      <div className="xpl-wrapper">
        <div className="xpl-header">
          <div className="xpl-controls">
            {/* SEARCH */}
            <div ref={searchRef} style={{ position: 'relative', width: '100%' }}>
              <button 
                className={`xpl-btn ${showSearchPanel ? 'active' : ''}`}
                onClick={() => {
                  setShowSearchPanel(!showSearchPanel);
                  setShowTabsPanel(false);
                  setShowFilterPanel(false);
                }}
              >
                <Search size={15} />
                Search
              </button>

              {showSearchPanel && (
                <div className="xpl-search-dd">
                  <Search size={18} className="xpl-search-icon" />
                  <input
                    type="text"
                    placeholder="Search stories, posts, reels..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="xpl-search-input"
                    autoFocus
                  />
                  {searchQuery && (
                    <button className="xpl-clear" onClick={() => setSearchQuery('')}>
                      <X size={16} />
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* TABS */}
            <div ref={tabsRef} style={{ position: 'relative', flex: 1 }}>
              <button 
                className={`xpl-btn xpl-tabs-btn ${showTabsPanel ? 'active' : ''}`}
                onClick={() => {
                  setShowTabsPanel(!showTabsPanel);
                  setShowSearchPanel(false);
                  setShowFilterPanel(false);
                }}
              >
                <span>{currentTabLabel}</span>
                <ChevronDown size={15} />
              </button>

              {showTabsPanel && (
                <div className="xpl-tabs-dd">
                  {tabs.map(tab => (
                    <button
                      key={tab.id}
                      className={`xpl-tab-opt ${activeTab === tab.id ? 'active' : ''}`}
                      onClick={() => {
                        setActiveTab(tab.id);
                        setShowTabsPanel(false);
                      }}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* FILTER */}
            <div ref={filterRef} style={{ position: 'relative' }}>
              <button 
                className={`xpl-btn ${showFilterPanel ? 'active' : ''}`}
                onClick={() => {
                  setShowFilterPanel(!showFilterPanel);
                  setShowSearchPanel(false);
                  setShowTabsPanel(false);
                }}
              >
                <Filter size={15} />
                Filter
              </button>

              {showFilterPanel && (
                <div className="xpl-filter-dd">
                  <div className="xpl-filter-label">Category</div>
                  <div className="xpl-cat-grid">
                    {categories.map(cat => (
                      <button
                        key={cat}
                        className={`xpl-cat-btn ${selectedCategory === cat ? 'active' : ''}`}
                        onClick={() => setSelectedCategory(cat)}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="xpl-content">
          {loading ? (
            <div className="xpl-loading">
              <Loader size={32} className="xpl-spinner" />
              <p className="xpl-loading-text">
                {searchQuery ? 'Searching...' : 'Loading...'}
              </p>
            </div>
          ) : totalCount === 0 ? (
            <div className="xpl-empty">
              <div className="xpl-empty-icon">{searchQuery ? '🔍' : '📭'}</div>
              <h3 className="xpl-empty-title">
                {searchQuery ? 'No results found' : 'No content available'}
              </h3>
              <p className="xpl-empty-text">
                {searchQuery ? 'Try different keywords' : 'Check back later'}
              </p>
            </div>
          ) : (
            <>
              {searchQuery && (
                <div className="xpl-results">
                  Found <strong>{totalCount}</strong> result{totalCount !== 1 ? 's' : ''}
                </div>
              )}

              {displayContent.stories?.length > 0 && (
                <div className="xpl-section">
                  <h2 className="xpl-section-title">
                    Stories <span className="xpl-badge">{displayContent.stories.length}</span>
                  </h2>
                  {displayContent.stories.map(story => (
                    <StoryCard
                      key={story.id}
                      story={story}
                      currentUser={currentUser}
                      onAuthorClick={onAuthorClick}
                      onActionMenu={onActionMenu}
                    />
                  ))}
                </div>
              )}

              {displayContent.posts?.length > 0 && (
                <div className="xpl-section">
                  <h2 className="xpl-section-title">
                    Posts <span className="xpl-badge">{displayContent.posts.length}</span>
                  </h2>
                  {displayContent.posts.map(post => (
                    <PostCard
                      key={post.id}
                      post={post}
                      currentUser={currentUser}
                      onAuthorClick={onAuthorClick}
                      onActionMenu={onActionMenu}
                    />
                  ))}
                </div>
              )}

              {displayContent.reels?.length > 0 && (
                <div className="xpl-section">
                  <h2 className="xpl-section-title">
                    Reels <span className="xpl-badge">{displayContent.reels.length}</span>
                  </h2>
                  <div className="xpl-reels-grid">
                    {displayContent.reels.map((reel, idx) => (
                      <ReelCard
                        key={reel.id}
                        reel={reel}
                        currentUser={currentUser}
                        onAuthorClick={onAuthorClick}
                        onActionMenu={onActionMenu}
                        index={idx}
                      />
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
};

export default ExploreView;