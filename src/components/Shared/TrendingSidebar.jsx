import React, { useState, useEffect } from 'react';
import { TrendingUp, Users, X, Eye, Sparkles, Hash, Flame, Crown, ChevronRight, RefreshCw } from 'lucide-react';
import { supabase } from '../../services/config/supabase';
import mediaUrlService from '../../services/shared/mediaUrlService';
import UnifiedLoader from './UnifiedLoader';
import UserProfileModal from '../Modals/UserProfileModal';

const TrendingSidebar = ({ currentUser }) => {
  const [trendingTags, setTrendingTags] = useState([]);
  const [eliteCreators, setEliteCreators] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  
  // Modal states
  const [showTrendingModal, setShowTrendingModal] = useState(false);
  const [showCreatorsModal, setShowCreatorsModal] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [selectedCreator, setSelectedCreator] = useState(null);

  useEffect(() => {
    loadLiveData();
    const interval = setInterval(loadLiveData, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const loadLiveData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [tags, creators] = await Promise.all([
        loadTrendingTags(),
        loadEliteCreators()
      ]);

      setTrendingTags(tags);
      setEliteCreators(creators);

    } catch (err) {
      console.error('Failed to load trending data:', err);
      setError(err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadLiveData();
  };

  const loadTrendingTags = async () => {
    try {
      console.log('📊 Loading trending tags...');

      const [stories, posts, reels] = await Promise.all([
        supabase
          .from('stories')
          .select('category, views')
          .is('deleted_at', null)
          .order('views', { ascending: false })
          .limit(100),
        supabase
          .from('posts')
          .select('category, views')
          .is('deleted_at', null)
          .order('views', { ascending: false })
          .limit(100),
        supabase
          .from('reels')
          .select('category, views')
          .is('deleted_at', null)
          .order('views', { ascending: false })
          .limit(100)
      ]);

      const categoryMap = {};
      const allContent = [
        ...(stories.data || []),
        ...(posts.data || []),
        ...(reels.data || [])
      ];

      allContent.forEach(item => {
        const cat = item.category || 'General';
        if (!categoryMap[cat]) {
          categoryMap[cat] = { views: 0, count: 0 };
        }
        categoryMap[cat].views += item.views || 0;
        categoryMap[cat].count++;
      });

      const tags = Object.entries(categoryMap)
        .map(([label, data]) => ({
          type: 'category',
          label,
          views: data.views,
          posts: data.count,
          trendScore: (data.views * 0.7) + (data.count * 100 * 0.3)
        }))
        .sort((a, b) => b.trendScore - a.trendScore)
        .slice(0, 15);

      console.log('✅ Loaded trending tags:', tags);
      return tags;

    } catch (error) {
      console.error('Failed to load trending tags:', error);
      return [];
    }
  };

  const loadEliteCreators = async () => {
    try {
      console.log('👑 Loading elite creators from ep_dashboard...');

      const { data: eliteData, error } = await supabase
        .from('ep_dashboard')
        .select(`
          user_id,
          total_ep_earned,
          profiles!inner (
            id,
            full_name,
            username,
            avatar_id,
            verified,
            bio
          )
        `)
        .order('total_ep_earned', { ascending: false })
        .limit(50);

      if (error) {
        console.error('EP Dashboard error:', error);
        return [];
      }

      const creators = (eliteData || []).map((item, index) => {
        const profile = item.profiles;
        const avatarUrl = profile.avatar_id 
          ? mediaUrlService.getImageUrl(profile.avatar_id, { width: 200, height: 200, crop: 'fill', gravity: 'face' })
          : null;

        return {
          userId: item.user_id,
          rank: index + 1,
          name: profile.full_name || 'Grova Creator',
          username: profile.username || 'user',
          avatar: avatarUrl || profile.full_name?.charAt(0) || 'G',
          verified: profile.verified || false,
          bio: profile.bio || '',
          totalEarnings: item.total_ep_earned || 0,
          isTopTier: index < 3
        };
      });

      console.log('✅ Loaded elite creators:', creators);
      return creators;

    } catch (error) {
      console.error('Failed to load elite creators:', error);
      return [];
    }
  };

  const formatNumber = (num) => {
    if (!num) return '0';
    if (num >= 1000000000) return `${(num / 1000000000).toFixed(1)}B`;
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  const handleCreatorClick = (creator) => {
    setSelectedCreator({
      id: creator.userId,
      user_id: creator.userId,
      name: creator.name,
      author: creator.name,
      username: creator.username,
      avatar: creator.avatar,
      verified: creator.verified
    });
    setShowProfileModal(true);
  };

  const handleTagClick = (tag) => {
    console.log('Tag clicked:', tag.label);
    // TODO: Navigate to explore page with this tag filter
  };

  if (loading) {
    return (
      <aside className="trending-sidebar">
        <UnifiedLoader type="section" message="Loading trending..." />
      </aside>
    );
  }

  if (error) {
    return (
      <aside className="trending-sidebar">
        <UnifiedLoader type="section" error={error} onRetry={loadLiveData} />
      </aside>
    );
  }

  const displayedTags = trendingTags.slice(0, 5);
  const displayedCreators = eliteCreators.slice(0, 5);

  return (
    <>
      <style>{`
        .trending-sidebar::-webkit-scrollbar {
          width: 4px;
        }

        .trending-sidebar::-webkit-scrollbar-track {
          background: rgba(255, 255, 255, 0.05);
        }

        .trending-sidebar::-webkit-scrollbar-thumb {
          background: rgba(132, 204, 22, 0.3);
          border-radius: 2px;
        }

        .trending-section {
          margin-bottom: 32px;
        }

        .trending-section:last-child {
          margin-bottom: 0;
        }

        .section-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 18px;
          padding-bottom: 14px;
          border-bottom: 2px solid rgba(132, 204, 22, 0.18);
        }

        .header-left {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .section-icon-wrapper {
          width: 48px;
          height: 48px;
          border-radius: 16px;
          background: linear-gradient(135deg, #84cc16 0%, #65a30d 100%);
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 8px 20px rgba(132, 204, 22, 0.3);
        }

        .section-title {
          font-size: 18px;
          font-weight: 800;
          color: #ffffff;
          margin: 0;
          letter-spacing: -0.4px;
        }

        .section-subtitle {
          font-size: 12px;
          color: #84cc16;
          font-weight: 600;
          margin: 4px 0 0 0;
        }

        .header-actions {
          display: flex;
          gap: 8px;
        }

        .refresh-btn,
        .view-all-btn {
          padding: 8px 14px;
          background: rgba(132, 204, 22, 0.1);
          border: 1px solid rgba(132, 204, 22, 0.25);
          border-radius: 10px;
          color: #84cc16;
          font-size: 12px;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.2s;
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .refresh-btn:hover,
        .view-all-btn:hover {
          background: rgba(132, 204, 22, 0.2);
          border-color: #84cc16;
        }

        .refreshing {
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        /* ── TRENDING TAGS ── */
        .tag-list {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .tag-item {
          display: flex;
          align-items: center;
          gap: 14px;
          padding: 14px 16px;
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(132, 204, 22, 0.14);
          border-radius: 14px;
          cursor: pointer;
          transition: all 0.25s ease;
          position: relative;
          overflow: hidden;
        }

        .tag-item:hover {
          transform: translateX(6px);
          background: rgba(132, 204, 22, 0.09);
          border-color: rgba(132, 204, 22, 0.45);
        }

        .tag-rank {
          min-width: 42px;
          height: 42px;
          border-radius: 12px;
          background: rgba(132, 204, 22, 0.18);
          display: flex;
          align-items: center;
          justify-content: center;
          color: #84cc16;
          font-size: 17px;
          font-weight: 900;
          flex-shrink: 0;
        }

        .tag-rank.top-rank {
          background: linear-gradient(135deg, #fbbf24, #f59e0b);
          color: #000;
          font-size: 18px;
          box-shadow: 0 4px 12px rgba(251, 191, 36, 0.4);
        }

        .tag-content {
          flex: 1;
          min-width: 0;
        }

        .tag-label {
          font-size: 15.5px;
          font-weight: 700;
          color: #ffffff;
          margin: 0 0 5px 0;
          line-height: 1.3;
          white-space: normal;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }

        .tag-stats {
          display: flex;
          align-items: center;
          flex-wrap: wrap;
          gap: 10px;
          font-size: 13px;
          color: #b0b0b0;
        }

        .tag-stat {
          display: flex;
          align-items: center;
          gap: 5px;
        }

        .separator {
          color: #444;
          font-weight: 300;
        }

        .trending-badge {
          padding: 3px 9px;
          background: rgba(239, 68, 68, 0.18);
          border-radius: 6px;
          color: #ef4444;
          font-size: 10px;
          font-weight: 800;
          display: flex;
          align-items: center;
          gap: 4px;
        }

        /* ── ELITE CREATORS (unchanged for now) ── */
        .creator-list {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .creator-item {
          display: flex;
          align-items: center;
          gap: 14px;
          padding: 14px;
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(132, 204, 22, 0.15);
          border-radius: 16px;
          cursor: pointer;
          transition: all 0.3s ease;
        }

        .creator-item:hover {
          transform: translateY(-4px);
          box-shadow: 0 8px 24px rgba(132, 204, 22, 0.2);
        }

        .creator-item.top-tier {
          border-color: rgba(251, 191, 36, 0.4);
          background: linear-gradient(135deg, rgba(251, 191, 36, 0.05), rgba(245, 158, 11, 0.05));
        }
      `}</style>

      <aside className="trending-sidebar">
        {/* TRENDING TAGS */}
        <div className="trending-section">
          <div className="section-header">
            <div className="header-left">
              <div className="section-icon-wrapper">
                <Flame size={24} className="section-icon" />
              </div>
              <div className="section-title-wrapper">
                <h3 className="section-title">Trending Now</h3>
                <p className="section-subtitle">What's hot on Grova</p>
              </div>
            </div>
            <div className="header-actions">
              <button 
                className="refresh-btn" 
                onClick={handleRefresh}
                disabled={refreshing}
              >
                <RefreshCw size={14} className={refreshing ? 'refreshing' : ''} />
              </button>
              {trendingTags.length > 5 && (
                <button className="view-all-btn" onClick={() => setShowTrendingModal(true)}>
                  View All
                  <ChevronRight size={14} />
                </button>
              )}
            </div>
          </div>

          {displayedTags.length > 0 ? (
            <div className="tag-list">
              {displayedTags.map((tag, index) => (
                <div 
                  key={`${tag.label}-${index}`} 
                  className="tag-item"
                  onClick={() => handleTagClick(tag)}
                >
                  <div className={`tag-rank ${index < 3 ? 'top-rank' : ''}`}>
                    #{index + 1}
                  </div>

                  <div className="tag-content">
                    <p className="tag-label">{tag.label}</p>
                    <div className="tag-stats">
                      <span className="tag-stat">
                        <Eye size={13} />
                        {formatNumber(tag.views)}
                      </span>
                      <span className="separator">•</span>
                      <span className="tag-stat">
                        {tag.posts} posts
                      </span>
                      {index < 3 && (
                        <>
                          <span className="separator">•</span>
                          <span className="trending-badge">
                            <Flame size={11} />
                            HOT
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <div className="empty-state-icon">🔥</div>
              <p className="empty-state-text">No trending tags yet</p>
            </div>
          )}
        </div>

        {/* ELITE CREATORS - kept original for now */}
        <div className="trending-section">
          <div className="section-header">
            <div className="header-left">
              <div className="section-icon-wrapper">
                <Crown size={24} className="section-icon" />
              </div>
              <div className="section-title-wrapper">
                <h3 className="section-title">Elite Creators</h3>
                <p className="section-subtitle">Top earners this month</p>
              </div>
            </div>
            {eliteCreators.length > 5 && (
              <button className="view-all-btn" onClick={() => setShowCreatorsModal(true)}>
                View All
                <ChevronRight size={14} />
              </button>
            )}
          </div>

          {displayedCreators.length > 0 ? (
            <div className="creator-list">
              {displayedCreators.map((creator) => (
                <div 
                  key={creator.userId} 
                  className={`creator-item ${creator.isTopTier ? 'top-tier' : ''}`}
                  onClick={() => handleCreatorClick(creator)}
                >
                  <div className={`creator-rank-badge ${
                    creator.rank === 1 ? 'gold' : 
                    creator.rank === 2 ? 'silver' : 
                    creator.rank === 3 ? 'bronze' : ''
                  }`}>
                    {creator.rank}
                  </div>
                  
                  <div className="creator-avatar">
                    {typeof creator.avatar === 'string' && creator.avatar.startsWith('http') ? (
                      <img src={creator.avatar} alt={creator.name} />
                    ) : (
                      creator.avatar
                    )}
                    {creator.isTopTier && (
                      <div className="crown-icon">
                        <Crown size={12} color="#000" />
                      </div>
                    )}
                  </div>
                  
                  <div className="creator-info">
                    <div className="creator-name">
                      <span>{creator.name}</span>
                      {creator.verified && (
                        <span className="verified-badge">
                          <Sparkles size={10} />
                        </span>
                      )}
                    </div>
                    <p className="creator-username">@{creator.username}</p>
                    <div className="creator-earnings">
                      <span className="ep-badge">{formatNumber(creator.totalEarnings)} EP</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <div className="empty-state-icon">👑</div>
              <p className="empty-state-text">No elite creators yet</p>
            </div>
          )}
        </div>
      </aside>

      {/* Modals remain the same - omitted for brevity */}
      {/* ... your existing modal code for trending tags, elite creators and profile ... */}
    </>
  );
};

export default TrendingSidebar;