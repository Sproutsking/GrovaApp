// src/components/Explore/ExploreView.jsx
import React, { useState, useEffect } from 'react';
import { Search, Loader, Filter, X, Lock, Eye, MessageSquare, Heart } from 'lucide-react';
import { supabase } from '../../services/config/supabase';
import mediaUrlService from '../../services/shared/mediaUrlService';

const ExploreView = ({ currentUser, userId }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [showSearch, setShowSearch] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [stories, setStories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const categories = [
    'All',
    'Folklore',
    'Life Journey',
    'Philosophy',
    'Innovation',
    'Romance',
    'Adventure',
    'Mystery',
    'Wisdom'
  ];

  useEffect(() => {
    fetchStories();
  }, [selectedCategory]);

  const fetchStories = async () => {
    try {
      setLoading(true);
      setError(null);
      
      let query = supabase
        .from('stories')
        .select(`
          *,
          profiles!inner (
            full_name,
            username,
            avatar_id,
            verified
          )
        `)
        .is('deleted_at', null)
        .order('created_at', { ascending: false });

      if (selectedCategory !== 'All') {
        query = query.eq('category', selectedCategory);
      }

      const { data, error: fetchError } = await query.limit(50);

      if (fetchError) throw fetchError;

      const formattedStories = (data || []).map(story => ({
        id: story.id,
        title: story.title,
        author: story.profiles?.full_name || 'Unknown',
        username: story.profiles?.username || '@unknown',
        avatar: story.profiles?.avatar_id 
          ? mediaUrlService.getImageUrl(story.profiles.avatar_id)
          : story.profiles?.full_name?.[0] || 'U',
        preview: story.preview,
        category: story.category,
        coverImage: story.cover_image_id 
          ? mediaUrlService.getImageUrl(story.cover_image_id)
          : null,
        likes: story.likes || 0,
        views: story.views || 0,
        comments: story.comments_count || 0,
        unlockCost: story.unlock_cost || 0,
        currentAccesses: story.current_accesses || 0,
        maxAccesses: story.max_accesses || 1000,
        verified: story.profiles?.verified || false,
        timeAgo: getTimeAgo(story.created_at),
        createdAt: story.created_at
      }));
      
      setStories(formattedStories);
    } catch (err) {
      console.error('Failed to fetch stories:', err);
      setError(err.message || 'Failed to load stories');
      setStories([]);
    } finally {
      setLoading(false);
    }
  };

  const getTimeAgo = (timestamp) => {
    const now = new Date();
    const past = new Date(timestamp);
    const diffMs = now - past;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return past.toLocaleDateString();
  };

  const filteredStories = stories.filter(s =>
    s.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.author?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.preview?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (error) {
    return (
      <div className="explore-error">
        <p>{error}</p>
        <button onClick={fetchStories} className="retry-btn">
          Retry
        </button>
      </div>
    );
  }

  return (
    <>
      <style>{`
        .explore-loading,
        .explore-error {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          min-height: 400px;
          gap: 16px;
        }

        .spinner {
          animation: spin 1s linear infinite;
          color: #84cc16;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        .explore-error p {
          color: #ef4444;
          font-size: 15px;
        }

        .retry-btn {
          padding: 10px 24px;
          background: linear-gradient(135deg, #84cc16 0%, #65a30d 100%);
          border: none;
          border-radius: 8px;
          color: #000;
          font-weight: 600;
          cursor: pointer;
        }

        .explore-container {
          padding: 20px;
          max-width: 1200px;
          margin: 0 auto;
        }

        .explore-controls {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 24px;
        }

        .search-toggle-btn,
        .filter-toggle-btn {
          padding: 12px 16px;
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(132, 204, 22, 0.2);
          border-radius: 12px;
          color: #ffffff;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 8px;
          transition: all 0.3s;
        }

        .search-toggle-btn {
          flex: 1;
          justify-content: center;
        }

        .filter-toggle-btn {
          max-width: 100px;
          justify-content: center;
        }

        .search-toggle-btn:hover,
        .filter-toggle-btn:hover {
          border-color: rgba(132, 204, 22, 0.4);
          background: rgba(132, 204, 22, 0.05);
        }

        .search-toggle-btn.active,
        .filter-toggle-btn.active {
          border-color: #84cc16;
          background: rgba(132, 204, 22, 0.1);
        }

        .search-panel {
          display: flex;
          align-items: center;
          gap: 12px;
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(132, 204, 22, 0.2);
          border-radius: 12px;
          padding: 12px 16px;
          margin-bottom: 16px;
        }

        .search-panel svg {
          color: #84cc16;
          flex-shrink: 0;
        }

        .search-input {
          flex: 1;
          background: none;
          border: none;
          color: #ffffff;
          font-size: 15px;
          outline: none;
        }

        .search-input::placeholder {
          color: #737373;
        }

        .clear-search-btn {
          background: none;
          border: none;
          color: #737373;
          cursor: pointer;
          padding: 4px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .clear-search-btn:hover {
          color: #ffffff;
        }

        .filter-dropdown {
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(132, 204, 22, 0.2);
          border-radius: 12px;
          padding: 12px;
          margin-bottom: 16px;
        }

        .filter-options {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }

        .filter-chip {
          padding: 8px 16px;
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(132, 204, 22, 0.2);
          border-radius: 20px;
          color: #ffffff;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }

        .filter-chip:hover {
          border-color: rgba(132, 204, 22, 0.4);
          background: rgba(132, 204, 22, 0.05);
        }

        .filter-chip.active {
          background: #84cc16;
          border-color: #84cc16;
          color: #000;
        }

        .stories-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
          gap: 20px;
        }

        .story-card {
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(132, 204, 22, 0.2);
          border-radius: 16px;
          overflow: hidden;
          transition: all 0.3s;
          cursor: pointer;
        }

        .story-card:hover {
          border-color: rgba(132, 204, 22, 0.4);
          transform: translateY(-4px);
          box-shadow: 0 8px 24px rgba(132, 204, 22, 0.2);
        }

        .story-cover {
          width: 100%;
          height: 180px;
          background: linear-gradient(135deg, rgba(132, 204, 22, 0.1) 0%, rgba(132, 204, 22, 0.05) 100%);
          display: flex;
          align-items: center;
          justify-content: center;
          color: #84cc16;
          font-size: 48px;
          position: relative;
        }

        .story-cover img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .story-category-badge {
          position: absolute;
          top: 12px;
          right: 12px;
          padding: 6px 12px;
          background: rgba(0, 0, 0, 0.8);
          backdrop-filter: blur(10px);
          border-radius: 12px;
          color: #84cc16;
          font-size: 12px;
          font-weight: 600;
        }

        .story-content {
          padding: 20px;
        }

        .story-header {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 16px;
        }

        .story-avatar {
          width: 40px;
          height: 40px;
          border-radius: 50%;
          background: linear-gradient(135deg, #84cc16 0%, #65a30d 100%);
          display: flex;
          align-items: center;
          justify-content: center;
          color: #000;
          font-weight: 700;
          font-size: 18px;
          overflow: hidden;
        }

        .story-avatar img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .story-author-info {
          flex: 1;
        }

        .story-author-name {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 15px;
          font-weight: 600;
          color: #ffffff;
          margin: 0 0 4px 0;
        }

        .verified-badge {
          background: #84cc16;
          color: #000;
          border-radius: 50%;
          width: 16px;
          height: 16px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 10px;
        }

        .story-time {
          font-size: 13px;
          color: #737373;
        }

        .story-title {
          font-size: 18px;
          font-weight: 700;
          color: #ffffff;
          margin: 0 0 12px 0;
          line-height: 1.4;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }

        .story-preview {
          font-size: 14px;
          color: #a3a3a3;
          line-height: 1.6;
          margin: 0 0 16px 0;
          display: -webkit-box;
          -webkit-line-clamp: 3;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }

        .story-footer {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding-top: 16px;
          border-top: 1px solid rgba(255, 255, 255, 0.05);
        }

        .story-stats {
          display: flex;
          align-items: center;
          gap: 16px;
          font-size: 13px;
          color: #737373;
        }

        .story-stat {
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .unlock-badge {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 6px 12px;
          background: rgba(132, 204, 22, 0.1);
          border: 1px solid rgba(132, 204, 22, 0.3);
          border-radius: 8px;
          color: #84cc16;
          font-size: 13px;
          font-weight: 600;
        }

        .empty-state {
          text-align: center;
          padding: 60px 20px;
        }

        .empty-state-icon {
          font-size: 64px;
          margin-bottom: 16px;
        }

        .empty-state-title {
          font-size: 20px;
          font-weight: 700;
          color: #ffffff;
          margin: 0 0 8px 0;
        }

        .empty-state-text {
          font-size: 15px;
          color: #737373;
          margin: 0;
        }

        @media (max-width: 768px) {
          .explore-container {
            padding: 16px;
          }

          .stories-grid {
            grid-template-columns: 1fr;
            gap: 16px;
          }
        }
      `}</style>

      <div className="explore-container">
        <div className="explore-controls">
          <button
            className={`search-toggle-btn ${showSearch ? 'active' : ''}`}
            onClick={() => setShowSearch(!showSearch)}
          >
            <Search size={18} />
            <span>Search Stories</span>
          </button>

          <button
            className={`filter-toggle-btn ${showFilters ? 'active' : ''}`}
            onClick={() => setShowFilters(!showFilters)}
          >
            <Filter size={18} />
            <span>Filter</span>
          </button>
        </div>

        {showSearch && (
          <div className="search-panel">
            <Search size={20} />
            <input
              type="text"
              placeholder="Search stories, authors, or keywords..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="search-input"
              autoFocus
            />
            {searchQuery && (
              <button className="clear-search-btn" onClick={() => setSearchQuery('')}>
                <X size={20} />
              </button>
            )}
          </div>
        )}

        {showFilters && (
          <div className="filter-dropdown">
            <div className="filter-options">
              {categories.map(cat => (
                <button
                  key={cat}
                  className={`filter-chip ${selectedCategory === cat ? 'active' : ''}`}
                  onClick={() => setSelectedCategory(cat)}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>
        )}

        {filteredStories.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">📚</div>
            <h3 className="empty-state-title">No stories found</h3>
            <p className="empty-state-text">
              {searchQuery
                ? 'Try adjusting your search or filters'
                : 'No stories available in this category'}
            </p>
          </div>
        ) : (
          <div className="stories-grid">
            {filteredStories.map(story => (
              <div key={story.id} className="story-card">
                <div className="story-cover">
                  {story.coverImage ? (
                    <img src={story.coverImage} alt={story.title} />
                  ) : (
                    '📖'
                  )}
                  <div className="story-category-badge">{story.category}</div>
                </div>

                <div className="story-content">
                  <div className="story-header">
                    <div className="story-avatar">
                      {typeof story.avatar === 'string' && story.avatar.startsWith('http') ? (
                        <img src={story.avatar} alt={story.author} />
                      ) : (
                        story.avatar
                      )}
                    </div>
                    <div className="story-author-info">
                      <div className="story-author-name">
                        {story.author}
                        {story.verified && <span className="verified-badge">✓</span>}
                      </div>
                      <div className="story-time">{story.timeAgo}</div>
                    </div>
                  </div>

                  <h3 className="story-title">{story.title}</h3>
                  <p className="story-preview">{story.preview}</p>

                  <div className="story-footer">
                    <div className="story-stats">
                      <span className="story-stat">
                        <Heart size={16} /> {story.likes}
                      </span>
                      <span className="story-stat">
                        <Eye size={16} /> {story.views}
                      </span>
                      <span className="story-stat">
                        <MessageSquare size={16} /> {story.comments}
                      </span>
                    </div>
                    {story.unlockCost > 0 && (
                      <div className="unlock-badge">
                        <Lock size={14} />
                        {story.unlockCost} GT
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
};

export default ExploreView;