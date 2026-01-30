import React, { useState, useEffect } from "react";
import {
  TrendingUp,
  Users,
  X,
  Eye,
  Sparkles,
  Hash,
  Flame,
  Crown,
  ChevronRight,
  RefreshCw,
  Award,
  ArrowRight,
} from "lucide-react";
import { supabase } from "../../services/config/supabase";
import mediaUrlService from "../../services/shared/mediaUrlService";
import UnifiedLoader from "./UnifiedLoader";
import UserProfileModal from "../Modals/UserProfileModal";

const TrendingSidebar = ({ currentUser, isMobile = false, onClose }) => {
  const [trendingTags, setTrendingTags] = useState([]);
  const [eliteCreators, setEliteCreators] = useState([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const [showTagsPanel, setShowTagsPanel] = useState(false);
  const [showCreatorsPanel, setShowCreatorsPanel] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [selectedCreator, setSelectedCreator] = useState(null);

  useEffect(() => {
    loadLiveData(true);

    const interval = setInterval(
      () => {
        loadLiveData(false);
      },
      5 * 60 * 1000,
    );

    return () => clearInterval(interval);
  }, []);

  const loadLiveData = async (isInitial = false) => {
    if (isInitial) {
      setLoading(true);
    }

    setError(null);

    try {
      const [tags, creators] = await Promise.all([
        loadTrendingTags(),
        loadActiveCreators(),
      ]);

      setTrendingTags(tags);
      setEliteCreators(creators);
    } catch (err) {
      console.error("Failed to load trending data:", err);
      setError(err.message);
    } finally {
      if (isInitial) {
        setLoading(false);
      }
      setRefreshing(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadLiveData(false);
  };

  const loadTrendingTags = async () => {
    try {
      console.log("📊 Loading trending tags...");

      const [stories, posts, reels] = await Promise.all([
        supabase
          .from("stories")
          .select("category, views")
          .is("deleted_at", null)
          .order("views", { ascending: false })
          .limit(100),
        supabase
          .from("posts")
          .select("category, views")
          .is("deleted_at", null)
          .order("views", { ascending: false })
          .limit(100),
        supabase
          .from("reels")
          .select("category, views")
          .is("deleted_at", null)
          .order("views", { ascending: false })
          .limit(100),
      ]);

      const categoryMap = {};
      const allContent = [
        ...(stories.data || []),
        ...(posts.data || []),
        ...(reels.data || []),
      ];

      allContent.forEach((item) => {
        const cat = item.category || "General";
        if (!categoryMap[cat]) {
          categoryMap[cat] = { views: 0, count: 0 };
        }
        categoryMap[cat].views += item.views || 0;
        categoryMap[cat].count++;
      });

      const tags = Object.entries(categoryMap)
        .map(([label, data]) => ({
          type: "category",
          label,
          views: data.views,
          posts: data.count,
          trendScore: data.views * 0.7 + data.count * 100 * 0.3,
        }))
        .sort((a, b) => b.trendScore - a.trendScore)
        .slice(0, 30);

      console.log("✅ Loaded trending tags:", tags);
      return tags;
    } catch (error) {
      console.error("Failed to load trending tags:", error);
      return [];
    }
  };

  const loadActiveCreators = async () => {
    try {
      console.log("👑 Loading active creators (with content)...");

      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
      const weekAgoISO = oneWeekAgo.toISOString();

      const [posts, reels, stories] = await Promise.all([
        supabase
          .from("posts")
          .select("user_id, likes, views, comments_count")
          .is("deleted_at", null)
          .gte("created_at", weekAgoISO),
        supabase
          .from("reels")
          .select("user_id, likes, views, comments_count")
          .is("deleted_at", null)
          .gte("created_at", weekAgoISO),
        supabase
          .from("stories")
          .select("user_id, likes, views, comments_count")
          .is("deleted_at", null)
          .gte("created_at", weekAgoISO),
      ]);

      const userStats = {};
      const allContent = [
        ...(posts.data || []),
        ...(reels.data || []),
        ...(stories.data || []),
      ];

      allContent.forEach((item) => {
        const userId = item.user_id;
        if (!userStats[userId]) {
          userStats[userId] = {
            totalLikes: 0,
            totalViews: 0,
            totalComments: 0,
            postCount: 0,
          };
        }
        userStats[userId].totalLikes += item.likes || 0;
        userStats[userId].totalViews += item.views || 0;
        userStats[userId].totalComments += item.comments_count || 0;
        userStats[userId].postCount++;
      });

      const topUserIds = Object.entries(userStats)
        .map(([userId, stats]) => ({
          userId,
          ...stats,
          engagementScore:
            stats.totalLikes * 3 +
            stats.totalComments * 5 +
            stats.totalViews * 0.1,
        }))
        .sort((a, b) => b.engagementScore - a.engagementScore)
        .slice(0, 30)
        .map((u) => u.userId);

      if (topUserIds.length === 0) {
        console.log("⚠️ No active creators found this week");
        return [];
      }

      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("id, full_name, username, avatar_id, verified, bio")
        .in("id", topUserIds);

      if (profileError) {
        console.error("Profile fetch error:", profileError);
        return [];
      }

      const creators = topUserIds
        .map((userId, index) => {
          const profile = profileData?.find((p) => p.id === userId);
          if (!profile) return null;

          const stats = userStats[userId];
          const avatarUrl = profile.avatar_id
            ? mediaUrlService.getImageUrl(profile.avatar_id, {
                width: 200,
                height: 200,
                crop: "fill",
                gravity: "face",
              })
            : null;

          return {
            userId: profile.id,
            rank: index + 1,
            name: profile.full_name || "Grova Creator",
            username: profile.username || "user",
            avatar: avatarUrl || profile.full_name?.charAt(0) || "G",
            verified: profile.verified || false,
            bio: profile.bio || "",
            stats: {
              likes: stats.totalLikes,
              views: stats.totalViews,
              comments: stats.totalComments,
              posts: stats.postCount,
            },
            isTopTier: index < 3,
          };
        })
        .filter(Boolean);

      console.log("✅ Loaded active creators:", creators);
      return creators;
    } catch (error) {
      console.error("Failed to load active creators:", error);
      return [];
    }
  };

  const formatNumber = (num) => {
    if (!num) return "0";
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
      verified: creator.verified,
    });
    setShowProfileModal(true);
  };

  const handleTagClick = (tag) => {
    console.log("Tag clicked:", tag.label);
  };

  if (loading) {
    return (
      <aside
        className={isMobile ? "trending-mobile-fullscreen" : "trending-sidebar"}
      >
        {isMobile && (
          <div className="mobile-trending-header">
            <div className="mobile-trending-title">
              <TrendingUp size={24} />
              <span>Trending</span>
            </div>
            <button className="mobile-close-btn" onClick={onClose}>
              <X size={24} />
            </button>
          </div>
        )}
        <UnifiedLoader type="section" message="Loading trending..." />
      </aside>
    );
  }

  if (error) {
    return (
      <aside
        className={isMobile ? "trending-mobile-fullscreen" : "trending-sidebar"}
      >
        {isMobile && (
          <div className="mobile-trending-header">
            <div className="mobile-trending-title">
              <TrendingUp size={24} />
              <span>Trending</span>
            </div>
            <button className="mobile-close-btn" onClick={onClose}>
              <X size={24} />
            </button>
          </div>
        )}
        <UnifiedLoader
          type="section"
          error={error}
          onRetry={() => loadLiveData(true)}
        />
      </aside>
    );
  }

  const topTags = trendingTags.slice(0, 3);
  const topCreators = eliteCreators.slice(0, 3);

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

        /* Hide desktop trending sidebar on mobile */
        @media (max-width: 768px) {
          .trending-sidebar:not(.trending-mobile-fullscreen) {
            display: none !important;
          }
        }

        .trending-mobile-fullscreen {
          position: fixed !important;
          inset: 0 !important;
          z-index: 10000 !important;
          background: #000000 !important;
          overflow-y: auto !important;
          animation: slideUp 0.3s ease;
          display: block !important;
          visibility: visible !important;
          opacity: 1 !important;
        }

        @keyframes slideUp {
          from {
            transform: translateY(100%);
          }
          to {
            transform: translateY(0);
          }
        }

        .mobile-trending-header {
          position: sticky !important;
          top: 0 !important;
          z-index: 10 !important;
          background: #000000 !important;
          border-bottom: 1px solid rgba(132, 204, 22, 0.2) !important;
          padding: 12px 16px !important;
          display: flex !important;
          align-items: center !important;
          justify-content: space-between !important;
          visibility: visible !important;
          opacity: 1 !important;
        }

        .mobile-trending-title {
          display: flex;
          align-items: center;
          gap: 12px;
          font-size: 20px;
          font-weight: 800;
          color: #ffffff;
        }

        .mobile-trending-title svg {
          color: #84cc16;
        }

        .mobile-close-btn {
          width: 40px;
          height: 40px;
          border-radius: 50%;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.08);
          color: #ffffff;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.3s;
        }

        .mobile-close-btn:active {
          transform: scale(0.92);
          background: rgba(255, 255, 255, 0.1);
        }

        .trending-mobile-fullscreen .trending-section {
          padding: 0 16px !important;
          display: block !important;
          visibility: visible !important;
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

        .section-title-wrapper {
          display: flex;
          flex-direction: column;
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

        .refresh-btn {
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

        .refresh-btn:hover {
          background: rgba(132, 204, 22, 0.2);
          border-color: #84cc16;
        }

        .refreshing {
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

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

        .view-more-btn {
          width: 100%;
          padding: 14px;
          margin-top: 12px;
          background: rgba(132, 204, 22, 0.08);
          border: 1px dashed rgba(132, 204, 22, 0.3);
          border-radius: 12px;
          color: #84cc16;
          font-size: 14px;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.3s ease;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
        }

        .view-more-btn:hover {
          background: rgba(132, 204, 22, 0.15);
          border-color: #84cc16;
          border-style: solid;
          transform: translateY(-2px);
        }

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
          border-color: rgba(132, 204, 22, 0.4);
        }

        .creator-item.top-tier {
          border-color: rgba(251, 191, 36, 0.4);
          background: linear-gradient(135deg, rgba(251, 191, 36, 0.05), rgba(245, 158, 11, 0.05));
        }

        .creator-item.top-tier:hover {
          border-color: rgba(251, 191, 36, 0.6);
        }

        .creator-rank-badge {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          background: linear-gradient(135deg, #84cc16, #65a30d);
          display: flex;
          align-items: center;
          justify-content: center;
          color: #000;
          font-size: 13px;
          font-weight: 900;
          flex-shrink: 0;
          box-shadow: 0 4px 12px rgba(132, 204, 22, 0.4);
        }

        .creator-rank-badge.gold {
          background: linear-gradient(135deg, #fbbf24, #f59e0b);
        }

        .creator-rank-badge.silver {
          background: linear-gradient(135deg, #e5e7eb, #9ca3af);
        }

        .creator-rank-badge.bronze {
          background: linear-gradient(135deg, #d97706, #b45309);
        }

        .creator-avatar-wrapper {
          position: relative;
          flex-shrink: 0;
        }

        .creator-avatar {
          width: 52px;
          height: 52px;
          border-radius: 50%;
          background: linear-gradient(135deg, #84cc16, #65a30d);
          display: flex;
          align-items: center;
          justify-content: center;
          color: #000;
          font-weight: 900;
          font-size: 20px;
          overflow: hidden;
          border: 3px solid rgba(132, 204, 22, 0.3);
        }

        .creator-item.top-tier .creator-avatar {
          border-color: rgba(251, 191, 36, 0.6);
        }

        .creator-avatar img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .crown-icon {
          position: absolute;
          top: -8px;
          right: -8px;
          width: 24px;
          height: 24px;
          background: linear-gradient(135deg, #fbbf24, #f59e0b);
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          border: 2px solid #000;
          box-shadow: 0 2px 6px rgba(0,0,0,0.4);
        }

        .creator-info {
          flex: 1;
          min-width: 0;
        }

        .creator-name {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 15px;
          font-weight: 700;
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
          flex-shrink: 0;
        }

        .creator-username {
          font-size: 13px;
          color: #737373;
          margin: 0 0 6px 0;
        }

        .creator-stats {
          display: flex;
          gap: 12px;
          font-size: 12px;
          color: #a3a3a3;
        }

        .stat-item {
          display: flex;
          align-items: center;
          gap: 4px;
        }

        .stat-value {
          color: #84cc16;
          font-weight: 700;
        }

        .panel-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.7);
          backdrop-filter: blur(10px);
          z-index: 9998;
          animation: fadeIn 0.3s ease;
        }

        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        .sliding-panel {
          position: fixed;
          top: 0;
          right: 0;
          width: 90%;
          max-width: 480px;
          height: 100vh;
          background: #000;
          border-left: 1px solid rgba(132, 204, 22, 0.3);
          z-index: 9999;
          animation: slideIn 0.3s ease;
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }

        @keyframes slideIn {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }

        .panel-header {
          padding: 24px;
          border-bottom: 1px solid rgba(132, 204, 22, 0.2);
          background: rgba(132, 204, 22, 0.05);
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-shrink: 0;
        }

        .panel-title {
          font-size: 22px;
          font-weight: 900;
          color: #fff;
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .panel-close-btn {
          width: 40px;
          height: 40px;
          border-radius: 50%;
          background: rgba(255, 255, 255, 0.05);
          border: none;
          color: #fff;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s;
        }

        .panel-close-btn:hover {
          background: rgba(255, 255, 255, 0.1);
          color: #84cc16;
          transform: rotate(90deg);
        }

        .panel-content {
          flex: 1;
          overflow-y: auto;
          padding: 24px;
        }

        .panel-content::-webkit-scrollbar {
          width: 6px;
        }

        .panel-content::-webkit-scrollbar-track {
          background: rgba(255, 255, 255, 0.05);
        }

        .panel-content::-webkit-scrollbar-thumb {
          background: rgba(132, 204, 22, 0.3);
          border-radius: 3px;
        }

        .empty-state {
          text-align: center;
          padding: 60px 20px;
          color: #737373;
        }

        .empty-state-icon {
          font-size: 64px;
          margin-bottom: 16px;
          opacity: 0.5;
        }

        .empty-state-text {
          font-size: 14px;
          margin: 0;
        }
      `}</style>

      <aside
        className={isMobile ? "trending-mobile-fullscreen" : "trending-sidebar"}
      >
        {isMobile && (
          <div className="mobile-trending-header">
            <div className="mobile-trending-title">
              <TrendingUp size={24} />
              <span>Trending</span>
            </div>
            <button className="mobile-close-btn" onClick={onClose}>
              <X size={24} />
            </button>
          </div>
        )}

        {/* TRENDING TAGS */}
        <div className="trending-section">
          <div className="section-header">
            <div className="header-left">
              <div className="section-icon-wrapper">
                <Flame size={24} style={{ color: "#000" }} />
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
                <RefreshCw
                  size={14}
                  className={refreshing ? "refreshing" : ""}
                />
              </button>
            </div>
          </div>

          {topTags.length > 0 ? (
            <>
              <div className="tag-list">
                {topTags.map((tag, index) => (
                  <div
                    key={`${tag.label}-${index}`}
                    className="tag-item"
                    onClick={() => handleTagClick(tag)}
                  >
                    <div className="tag-rank top-rank">#{index + 1}</div>
                    <div className="tag-content">
                      <p className="tag-label">{tag.label}</p>
                      <div className="tag-stats">
                        <span className="tag-stat">
                          <Eye size={13} />
                          {formatNumber(tag.views)}
                        </span>
                        <span className="separator">•</span>
                        <span className="tag-stat">{tag.posts} posts</span>
                        <span className="separator">•</span>
                        <span className="trending-badge">
                          <Flame size={11} />
                          HOT
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {trendingTags.length > 3 && (
                <button
                  className="view-more-btn"
                  onClick={() => setShowTagsPanel(true)}
                >
                  View Top 30 Tags
                  <ArrowRight size={16} />
                </button>
              )}
            </>
          ) : (
            <div className="empty-state">
              <div className="empty-state-icon">🔥</div>
              <p className="empty-state-text">No trending tags yet</p>
            </div>
          )}
        </div>

        {/* ELITE CREATORS */}
        <div className="trending-section">
          <div className="section-header">
            <div className="header-left">
              <div className="section-icon-wrapper">
                <Crown size={24} style={{ color: "#000" }} />
              </div>
              <div className="section-title-wrapper">
                <h3 className="section-title">Top Creators</h3>
                <p className="section-subtitle">This week's stars</p>
              </div>
            </div>
          </div>

          {topCreators.length > 0 ? (
            <>
              <div className="creator-list">
                {topCreators.map((creator) => (
                  <div
                    key={creator.userId}
                    className={`creator-item ${creator.isTopTier ? "top-tier" : ""}`}
                    onClick={() => handleCreatorClick(creator)}
                  >
                    <div
                      className={`creator-rank-badge ${
                        creator.rank === 1
                          ? "gold"
                          : creator.rank === 2
                            ? "silver"
                            : creator.rank === 3
                              ? "bronze"
                              : ""
                      }`}
                    >
                      {creator.rank}
                    </div>

                    <div className="creator-avatar-wrapper">
                      <div className="creator-avatar">
                        {typeof creator.avatar === "string" &&
                        creator.avatar.startsWith("http") ? (
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
                      <div className="creator-stats">
                        <span className="stat-item">
                          <span className="stat-value">
                            {formatNumber(creator.stats.likes)}
                          </span>{" "}
                          likes
                        </span>
                        <span className="separator">•</span>
                        <span className="stat-item">
                          <span className="stat-value">
                            {creator.stats.posts}
                          </span>{" "}
                          posts
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {eliteCreators.length > 3 && (
                <button
                  className="view-more-btn"
                  onClick={() => setShowCreatorsPanel(true)}
                >
                  View Top 30 Creators
                  <ArrowRight size={16} />
                </button>
              )}
            </>
          ) : (
            <div className="empty-state">
              <div className="empty-state-icon">👑</div>
              <p className="empty-state-text">No creators this week</p>
            </div>
          )}
        </div>
      </aside>

      {/* TAGS PANEL */}
      {showTagsPanel && (
        <>
          <div
            className="panel-overlay"
            onClick={() => setShowTagsPanel(false)}
          />
          <div className="sliding-panel">
            <div className="panel-header">
              <div className="panel-title">
                <Flame size={28} />
                Top 30 Trending Tags
              </div>
              <button
                className="panel-close-btn"
                onClick={() => setShowTagsPanel(false)}
              >
                <X size={22} />
              </button>
            </div>
            <div className="panel-content">
              <div className="tag-list">
                {trendingTags.map((tag, index) => (
                  <div
                    key={`panel-${tag.label}-${index}`}
                    className="tag-item"
                    onClick={() => {
                      handleTagClick(tag);
                      setShowTagsPanel(false);
                    }}
                  >
                    <div className={`tag-rank ${index < 3 ? "top-rank" : ""}`}>
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
                        <span className="tag-stat">{tag.posts} posts</span>
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
            </div>
          </div>
        </>
      )}

      {/* CREATORS PANEL */}
      {showCreatorsPanel && (
        <>
          <div
            className="panel-overlay"
            onClick={() => setShowCreatorsPanel(false)}
          />
          <div className="sliding-panel">
            <div className="panel-header">
              <div className="panel-title">
                <Crown size={28} />
                Top 30 Creators This Week
              </div>
              <button
                className="panel-close-btn"
                onClick={() => setShowCreatorsPanel(false)}
              >
                <X size={22} />
              </button>
            </div>
            <div className="panel-content">
              <div className="creator-list">
                {eliteCreators.map((creator) => (
                  <div
                    key={`panel-${creator.userId}`}
                    className={`creator-item ${creator.isTopTier ? "top-tier" : ""}`}
                    onClick={() => {
                      handleCreatorClick(creator);
                      setShowCreatorsPanel(false);
                    }}
                  >
                    <div
                      className={`creator-rank-badge ${
                        creator.rank === 1
                          ? "gold"
                          : creator.rank === 2
                            ? "silver"
                            : creator.rank === 3
                              ? "bronze"
                              : ""
                      }`}
                    >
                      {creator.rank}
                    </div>

                    <div className="creator-avatar-wrapper">
                      <div className="creator-avatar">
                        {typeof creator.avatar === "string" &&
                        creator.avatar.startsWith("http") ? (
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
                      <div className="creator-stats">
                        <span className="stat-item">
                          <span className="stat-value">
                            {formatNumber(creator.stats.likes)}
                          </span>{" "}
                          likes
                        </span>
                        <span className="separator">•</span>
                        <span className="stat-item">
                          <span className="stat-value">
                            {formatNumber(creator.stats.views)}
                          </span>{" "}
                          views
                        </span>
                        <span className="separator">•</span>
                        <span className="stat-item">
                          <span className="stat-value">
                            {creator.stats.posts}
                          </span>{" "}
                          posts
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}

      {/* PROFILE MODAL */}
      {showProfileModal && selectedCreator && (
        <UserProfileModal
          user={selectedCreator}
          currentUser={currentUser}
          onClose={() => {
            setShowProfileModal(false);
            setSelectedCreator(null);
          }}
        />
      )}
    </>
  );
};

export default TrendingSidebar;
