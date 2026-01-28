// ============================================================================
// src/components/Explore/ExploreView.jsx - ULTIMATE SEARCH UI
// ============================================================================

import React, { useState, useEffect, useRef } from 'react';
import { Search, Filter, ChevronDown, X, Loader, Hash, AtSign, User } from 'lucide-react';
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
  const [content, setContent] = useState({ 
    stories: [], 
    posts: [], 
    reels: [], 
    users: [], 
    tags: [],
    mentions: [],
    searchType: null
  });

  const searchRef = useRef(null);
  const tabsRef = useRef(null);
  const filterRef = useRef(null);

  const tabs = [
    { id: 'all', label: 'All' },
    { id: 'stories', label: 'Stories' },
    { id: 'posts', label: 'Posts' },
    { id: 'reels', label: 'Reels' },
    { id: 'users', label: 'People' },
    { id: 'tags', label: 'Tags' }
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
    if (!searchQuery) {
      loadContent();
    }
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
      setContent({ ...data, searchType: null });
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
    const { stories = [], posts = [], reels = [], users = [], tags = [], mentions = [] } = content;
    
    switch (activeTab) {
      case 'stories': return { stories, posts: [], reels: [], users: [], tags: [], mentions: [] };
      case 'posts': return { stories: [], posts, reels: [], users: [], tags: [], mentions: [] };
      case 'reels': return { stories: [], posts: [], reels, users: [], tags: [], mentions: [] };
      case 'users': return { stories: [], posts: [], reels: [], users, tags: [], mentions: [] };
      case 'tags': return { stories: [], posts: [], reels: [], users: [], tags, mentions: [] };
      default: return { stories, posts, reels, users, tags, mentions };
    }
  };

  const displayContent = getDisplayContent();
  const totalCount = (displayContent.stories?.length || 0) + 
                     (displayContent.posts?.length || 0) + 
                     (displayContent.reels?.length || 0) +
                     (displayContent.users?.length || 0) +
                     (displayContent.tags?.length || 0);

  const currentTabLabel = tabs.find(t => t.id === activeTab)?.label || 'All Content';
  
  // Get search type indicator
  const getSearchTypeIndicator = () => {
    if (!searchQuery) return null;
    if (searchQuery.startsWith('#')) return { icon: Hash, text: 'Hashtag', color: '#3b82f6' };
    if (searchQuery.startsWith('@')) return { icon: AtSign, text: 'Mention', color: '#ec4899' };
    return { icon: Search, text: 'General', color: '#84cc16' };
  };

  const searchTypeInfo = getSearchTypeIndicator();

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
          flex-direction: column;
          gap: 8px;
          background: #000000 !important;
          border: 1.5px solid rgba(132, 204, 22, 0.3) !important;
          border-radius: 0 0 12px 12px !important;
          padding: 12px 16px !important;
          box-shadow: 0 10px 40px rgba(0, 0, 0, 0.95) !important;
          animation: dropIn 0.15s ease !important;
          z-index: 200 !important;
        }

        .xpl-search-input-wrap {
          display: flex;
          align-items: center;
          gap: 12px;
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

        .xpl-search-type-badge {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          padding: 4px 8px;
          background: rgba(132, 204, 22, 0.1);
          border: 1px solid rgba(132, 204, 22, 0.25);
          border-radius: 4px;
          font-size: 11px;
          font-weight: 600;
          color: #84cc16;
        }

        .xpl-clear {
          background: none;
          border: 1px solid #444444;
          color: #5e5e5e;
          cursor: pointer;
          padding: 5px;
          display: flex;
          font-weight: 700;
          font-size: 16px;
          transition: all 0.12s;
          border-radius: 4px;
        }

        .xpl-clear:hover { color: lime; transform: scale(1.1); }

        .xpl-search-hint {
          font-size: 11px;
          color: #666;
          padding: 0 4px;
        }

        .xpl-search-hint strong { color: #84cc16; }

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

        /* USER CARDS */
        .xpl-user-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
          gap: 10px;
        }

        .xpl-user-card {
          background: rgba(132, 204, 22, 0.03);
          border: 1px solid rgba(132, 204, 22, 0.15);
          border-radius: 8px;
          padding: 12px;
          display: flex;
          align-items: center;
          gap: 12px;
          cursor: pointer;
          transition: all 0.15s;
        }

        .xpl-user-card:hover {
          background: rgba(132, 204, 22, 0.08);
          border-color: rgba(132, 204, 22, 0.3);
          transform: translateY(-2px);
        }

        .xpl-user-avatar {
          width: 48px;
          height: 48px;
          border-radius: 50%;
          background: linear-gradient(135deg, #84cc16, #65a30d);
          display: flex;
          align-items: center;
          justify-content: center;
          color: #000;
          font-weight: 700;
          font-size: 18px;
          flex-shrink: 0;
        }

        .xpl-user-avatar img {
          width: 100%;
          height: 100%;
          border-radius: 50%;
          object-fit: cover;
        }

        .xpl-user-info { flex: 1; min-width: 0; }

        .xpl-user-name {
          font-size: 14px;
          font-weight: 700;
          color: #fff;
          display: flex;
          align-items: center;
          gap: 4px;
          margin-bottom: 2px;
        }

        .xpl-verified {
          color: #84cc16;
          font-size: 14px;
        }

        .xpl-user-username {
          font-size: 12px;
          color: #666;
        }

        .xpl-user-bio {
          font-size: 11px;
          color: #888;
          margin-top: 4px;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }

        /* TAG CARDS */
        .xpl-tag-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
          gap: 10px;
        }

        .xpl-tag-card {
          background: rgba(59, 130, 246, 0.05);
          border: 1px solid rgba(59, 130, 246, 0.2);
          border-radius: 8px;
          padding: 12px 14px;
          cursor: pointer;
          transition: all 0.15s;
        }

        .xpl-tag-card:hover {
          background: rgba(59, 130, 246, 0.1);
          border-color: rgba(59, 130, 246, 0.4);
          transform: translateY(-2px);
        }

        .xpl-tag-name {
          font-size: 15px;
          font-weight: 700;
          color: #3b82f6;
          margin-bottom: 4px;
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .xpl-tag-count {
          font-size: 12px;
          color: #666;
        }

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
          .xpl-user-grid { grid-template-columns: 1fr; }
          .xpl-tag-grid { grid-template-columns: 1fr; }
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
                  <div className="xpl-search-input-wrap">
                    {searchTypeInfo ? (
                      <searchTypeInfo.icon size={18} style={{ color: searchTypeInfo.color }} />
                    ) : (
                      <Search size={18} className="xpl-search-icon" />
                    )}
                    <input
                      type="text"
                      placeholder="Search stories, posts, reels, people, #tags..."
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
                  
                  {searchTypeInfo && (
                    <div className="xpl-search-type-badge">
                      <searchTypeInfo.icon size={12} />
                      {searchTypeInfo.text} Search
                    </div>
                  )}
                  
                  <div className="xpl-search-hint">
                    💡 Try: <strong>#storytelling</strong> for tags or <strong>@username</strong> for people
                  </div>
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
                {searchQuery ? 'Try different keywords, #tags, or @mentions' : 'Check back later'}
              </p>
            </div>
          ) : (
            <>
              {searchQuery && (
                <div className="xpl-results">
                  Found <strong>{totalCount}</strong> result{totalCount !== 1 ? 's' : ''} {content.searchType && `· ${content.searchType} search`}
                </div>
              )}

              {displayContent.users?.length > 0 && (
                <div className="xpl-section">
                  <h2 className="xpl-section-title">
                    <User size={18} />
                    People <span className="xpl-badge">{displayContent.users.length}</span>
                  </h2>
                  <div className="xpl-user-grid">
                    {displayContent.users.map(user => (
                      <div 
                        key={user.id} 
                        className="xpl-user-card"
                        onClick={() => onAuthorClick?.(user.id)}
                      >
                        <div className="xpl-user-avatar">
                          {typeof user.avatar === 'string' && user.avatar.startsWith('http') ? (
                            <img src={user.avatar} alt={user.name} />
                          ) : (
                            user.avatar
                          )}
                        </div>
                        <div className="xpl-user-info">
                          <div className="xpl-user-name">
                            {user.name}
                            {user.verified && <span className="xpl-verified">✓</span>}
                          </div>
                          <div className="xpl-user-username">{user.username}</div>
                          {user.bio && <div className="xpl-user-bio">{user.bio}</div>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {displayContent.tags?.length > 0 && (
                <div className="xpl-section">
                  <h2 className="xpl-section-title">
                    <Hash size={18} />
                    Tags <span className="xpl-badge">{displayContent.tags.length}</span>
                  </h2>
                  <div className="xpl-tag-grid">
                    {displayContent.tags.map((tag, idx) => (
                      <div 
                        key={idx} 
                        className="xpl-tag-card"
                        onClick={() => setSearchQuery(tag.tag)}
                      >
                        <div className="xpl-tag-name">
                          <Hash size={16} />
                          {tag.tag.replace('#', '')}
                        </div>
                        <div className="xpl-tag-count">
                          {tag.count} {tag.count === 1 ? 'post' : 'posts'}
                        </div>
                      </div>
                    ))}
                  </div>
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