import React, { useState, useEffect } from "react";
import {
  X,
  TrendingUp,
  Eye,
  Flame,
  Crown,
  RefreshCw,
  ArrowRight,
  Sparkles,
} from "lucide-react";
import { supabase } from "../../services/config/supabase";
import mediaUrlService from "../../services/shared/mediaUrlService";
import UnifiedLoader from "./UnifiedLoader";
import UserProfileModal from "../Modals/UserProfileModal";

const MobileTrendingModal = ({ isOpen, onClose, currentUser }) => {
  const [trendingTags, setTrendingTags] = useState([]);
  const [eliteCreators, setEliteCreators] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [selectedCreator, setSelectedCreator] = useState(null);
  const [expandedTags, setExpandedTags] = useState(false);
  const [expandedCreators, setExpandedCreators] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadLiveData(true);
    }
  }, [isOpen]);

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
      console.log("📊 Loading trending tags for mobile...");

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

      console.log("✅ Loaded trending tags for mobile:", tags);
      return tags;
    } catch (error) {
      console.error("Failed to load trending tags:", error);
      return [];
    }
  };

  const loadActiveCreators = async () => {
    try {
      console.log("👑 Loading active creators for mobile...");

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
        console.log("⚠️ No active creators found for mobile");
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

      console.log("✅ Loaded active creators for mobile:", creators);
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

  if (!isOpen) return null;

  const displayedTags = expandedTags ? trendingTags : trendingTags.slice(0, 5);
  const displayedCreators = expandedCreators
    ? eliteCreators
    : eliteCreators.slice(0, 5);

  return (
    <>
      <style>{`
        .mobile-trending-sidebar-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.8);
          backdrop-filter: blur(10px);
          z-index: 10000;
          animation: mobileTrendingFadeIn 0.2s ease;
        }

        @keyframes mobileTrendingFadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        .mobile-trending-sidebar {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: #000000;
          z-index: 10001;
          display: flex;
          flex-direction: column;
          animation: mobileTrendingSlideUp 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }

        @keyframes mobileTrendingSlideUp {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }

        .mobile-trending-sidebar-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 16px 20px;
          border-bottom: 1px solid rgba(132, 204, 22, 0.2);
          background: rgba(0, 0, 0, 0.98);
          backdrop-filter: blur(20px);
        }

        .mobile-trending-sidebar-title-wrapper {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .mobile-trending-sidebar-title {
          font-size: 20px;
          font-weight: 800;
          color: #fff;
        }

        .mobile-trending-sidebar-actions {
          display: flex;
          gap: 8px;
          align-items: center;
        }

        .mobile-trending-sidebar-refresh-btn {
          width: 40px;
          height: 40px;
          border-radius: 50%;
          background: rgba(132, 204, 22, 0.1);
          border: 1px solid rgba(132, 204, 22, 0.3);
          display: flex;
          align-items: center;
          justify-content: center;
          color: #84cc16;
          cursor: pointer;
          transition: all 0.2s;
        }

        .mobile-trending-sidebar-refresh-btn:active {
          transform: scale(0.92);
          background: rgba(132, 204, 22, 0.15);
        }

        .mobile-trending-sidebar-refreshing {
          animation: mobileTrendingSpin 1s linear infinite;
        }

        @keyframes mobileTrendingSpin {
          to { transform: rotate(360deg); }
        }

        .mobile-trending-sidebar-close-btn {
          width: 40px;
          height: 40px;
          border-radius: 50%;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          display: flex;
          align-items: center;
          justify-content: center;
          color: #737373;
          cursor: pointer;
          transition: all 0.2s;
        }

        .mobile-trending-sidebar-close-btn:active {
          transform: scale(0.92);
          background: rgba(255, 255, 255, 0.1);
          color: #fff;
        }

        .mobile-trending-sidebar-content {
          flex: 1;
          overflow-y: auto;
          padding: 20px;
        }

        .mobile-trending-sidebar-content::-webkit-scrollbar {
          width: 6px;
        }

        .mobile-trending-sidebar-content::-webkit-scrollbar-track {
          background: rgba(255, 255, 255, 0.05);
        }

        .mobile-trending-sidebar-content::-webkit-scrollbar-thumb {
          background: rgba(132, 204, 22, 0.3);
          border-radius: 3px;
        }

        .mobile-trending-sidebar-section {
          margin-bottom: 32px;
        }

        .mobile-trending-sidebar-section-header {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 16px;
          padding-bottom: 12px;
          border-bottom: 2px solid rgba(132, 204, 22, 0.18);
        }

        .mobile-trending-sidebar-section-icon-wrapper {
          width: 42px;
          height: 42px;
          border-radius: 14px;
          background: linear-gradient(135deg, #84cc16 0%, #65a30d 100%);
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 6px 16px rgba(132, 204, 22, 0.3);
        }

        .mobile-trending-sidebar-section-title {
          font-size: 18px;
          font-weight: 800;
          color: #ffffff;
        }

        .mobile-trending-sidebar-section-subtitle {
          font-size: 12px;
          color: #84cc16;
          font-weight: 600;
        }

        .mobile-trending-sidebar-tag-list {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .mobile-trending-sidebar-tag-item {
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

        .mobile-trending-sidebar-tag-item:active {
          transform: scale(0.98);
          background: rgba(132, 204, 22, 0.09);
          border-color: rgba(132, 204, 22, 0.45);
        }

        .mobile-trending-sidebar-tag-rank {
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

        .mobile-trending-sidebar-tag-rank.top-rank {
          background: linear-gradient(135deg, #fbbf24, #f59e0b);
          color: #000;
          font-size: 18px;
          box-shadow: 0 4px 12px rgba(251, 191, 36, 0.4);
        }

        .mobile-trending-sidebar-tag-content {
          flex: 1;
          min-width: 0;
        }

        .mobile-trending-sidebar-tag-label {
          font-size: 15.5px;
          font-weight: 700;
          color: #ffffff;
          margin: 0 0 5px 0;
          line-height: 1.3;
        }

        .mobile-trending-sidebar-tag-stats {
          display: flex;
          align-items: center;
          flex-wrap: wrap;
          gap: 10px;
          font-size: 13px;
          color: #b0b0b0;
        }

        .mobile-trending-sidebar-tag-stat {
          display: flex;
          align-items: center;
          gap: 5px;
        }

        .mobile-trending-sidebar-separator {
          color: #444;
        }

        .mobile-trending-sidebar-trending-badge {
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

        .mobile-trending-sidebar-view-more-btn {
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

        .mobile-trending-sidebar-view-more-btn:active {
          transform: scale(0.98);
          background: rgba(132, 204, 22, 0.15);
          border-color: #84cc16;
          border-style: solid;
        }

        .mobile-trending-sidebar-creator-list {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .mobile-trending-sidebar-creator-item {
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

        .mobile-trending-sidebar-creator-item:active {
          transform: scale(0.98);
          box-shadow: 0 6px 20px rgba(132, 204, 22, 0.2);
          border-color: rgba(132, 204, 22, 0.4);
        }

        .mobile-trending-sidebar-creator-item.top-tier {
          border-color: rgba(251, 191, 36, 0.4);
          background: linear-gradient(135deg, rgba(251, 191, 36, 0.05), rgba(245, 158, 11, 0.05));
        }

        .mobile-trending-sidebar-creator-rank-badge {
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

        .mobile-trending-sidebar-creator-rank-badge.gold {
          background: linear-gradient(135deg, #fbbf24, #f59e0b);
        }

        .mobile-trending-sidebar-creator-rank-badge.silver {
          background: linear-gradient(135deg, #e5e7eb, #9ca3af);
        }

        .mobile-trending-sidebar-creator-rank-badge.bronze {
          background: linear-gradient(135deg, #d97706, #b45309);
        }

        .mobile-trending-sidebar-creator-avatar-wrapper {
          position: relative;
          flex-shrink: 0;
        }

        .mobile-trending-sidebar-creator-avatar {
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

        .mobile-trending-sidebar-creator-item.top-tier .mobile-trending-sidebar-creator-avatar {
          border-color: rgba(251, 191, 36, 0.6);
        }

        .mobile-trending-sidebar-creator-avatar img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .mobile-trending-sidebar-crown-icon {
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

        .mobile-trending-sidebar-creator-info {
          flex: 1;
          min-width: 0;
        }

        .mobile-trending-sidebar-creator-name {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 15px;
          font-weight: 700;
          color: #ffffff;
          margin: 0 0 4px 0;
        }

        .mobile-trending-sidebar-verified-badge {
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

        .mobile-trending-sidebar-creator-username {
          font-size: 13px;
          color: #737373;
          margin: 0 0 6px 0;
        }

        .mobile-trending-sidebar-creator-stats {
          display: flex;
          gap: 12px;
          font-size: 12px;
          color: #a3a3a3;
        }

        .mobile-trending-sidebar-stat-item {
          display: flex;
          align-items: center;
          gap: 4px;
        }

        .mobile-trending-sidebar-stat-value {
          color: #84cc16;
          font-weight: 700;
        }

        .mobile-trending-sidebar-empty-state {
          text-align: center;
          padding: 60px 20px;
          color: #737373;
        }

        .mobile-trending-sidebar-empty-state-icon {
          font-size: 64px;
          margin-bottom: 16px;
          opacity: 0.5;
        }

        .mobile-trending-sidebar-empty-state-text {
          font-size: 14px;
          margin: 0;
        }
      `}</style>

      <div className="mobile-trending-sidebar-overlay" onClick={onClose}>
        <div className="mobile-trending-sidebar" onClick={(e) => e.stopPropagation()}>
          <div className="mobile-trending-sidebar-header">
            <div className="mobile-trending-sidebar-title-wrapper">
              <TrendingUp size={24} style={{ color: "#84cc16" }} />
              <span className="mobile-trending-sidebar-title">Trending</span>
            </div>
            <div className="mobile-trending-sidebar-actions">
              <button
                className="mobile-trending-sidebar-refresh-btn"
                onClick={handleRefresh}
                disabled={refreshing}
              >
                <RefreshCw
                  size={18}
                  className={refreshing ? "mobile-trending-sidebar-refreshing" : ""}
                />
              </button>
              <button className="mobile-trending-sidebar-close-btn" onClick={onClose}>
                <X size={20} />
              </button>
            </div>
          </div>

          <div className="mobile-trending-sidebar-content">
            {loading ? (
              <UnifiedLoader type="section" message="Loading trending..." />
            ) : error ? (
              <UnifiedLoader
                type="section"
                error={error}
                onRetry={() => loadLiveData(true)}
              />
            ) : (
              <>
                {/* TRENDING TAGS */}
                <div className="mobile-trending-sidebar-section">
                  <div className="mobile-trending-sidebar-section-header">
                    <div className="mobile-trending-sidebar-section-icon-wrapper">
                      <Flame size={22} style={{ color: "#000" }} />
                    </div>
                    <div>
                      <div className="mobile-trending-sidebar-section-title">Trending Now</div>
                      <div className="mobile-trending-sidebar-section-subtitle">
                        What's hot on Grova
                      </div>
                    </div>
                  </div>

                  {trendingTags.length > 0 ? (
                    <>
                      <div className="mobile-trending-sidebar-tag-list">
                        {displayedTags.map((tag, index) => (
                          <div
                            key={`${tag.label}-${index}`}
                            className="mobile-trending-sidebar-tag-item"
                            onClick={() => handleTagClick(tag)}
                          >
                            <div
                              className={`mobile-trending-sidebar-tag-rank ${index < 3 ? "top-rank" : ""}`}
                            >
                              #{index + 1}
                            </div>
                            <div className="mobile-trending-sidebar-tag-content">
                              <p className="mobile-trending-sidebar-tag-label">{tag.label}</p>
                              <div className="mobile-trending-sidebar-tag-stats">
                                <span className="mobile-trending-sidebar-tag-stat">
                                  <Eye size={13} />
                                  {formatNumber(tag.views)}
                                </span>
                                <span className="mobile-trending-sidebar-separator">•</span>
                                <span className="mobile-trending-sidebar-tag-stat">
                                  {tag.posts} posts
                                </span>
                                {index < 3 && (
                                  <>
                                    <span className="mobile-trending-sidebar-separator">•</span>
                                    <span className="mobile-trending-sidebar-trending-badge">
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

                      {trendingTags.length > 5 && (
                        <button
                          className="mobile-trending-sidebar-view-more-btn"
                          onClick={() => setExpandedTags(!expandedTags)}
                        >
                          {expandedTags ? "Show Less" : `View All ${trendingTags.length} Tags`}
                          <ArrowRight size={16} />
                        </button>
                      )}
                    </>
                  ) : (
                    <div className="mobile-trending-sidebar-empty-state">
                      <div className="mobile-trending-sidebar-empty-state-icon">🔥</div>
                      <p className="mobile-trending-sidebar-empty-state-text">
                        No trending tags yet
                      </p>
                    </div>
                  )}
                </div>

                {/* TOP CREATORS */}
                <div className="mobile-trending-sidebar-section">
                  <div className="mobile-trending-sidebar-section-header">
                    <div className="mobile-trending-sidebar-section-icon-wrapper">
                      <Crown size={22} style={{ color: "#000" }} />
                    </div>
                    <div>
                      <div className="mobile-trending-sidebar-section-title">Top Creators</div>
                      <div className="mobile-trending-sidebar-section-subtitle">
                        This week's stars
                      </div>
                    </div>
                  </div>

                  {eliteCreators.length > 0 ? (
                    <>
                      <div className="mobile-trending-sidebar-creator-list">
                        {displayedCreators.map((creator) => (
                          <div
                            key={creator.userId}
                            className={`mobile-trending-sidebar-creator-item ${creator.isTopTier ? "top-tier" : ""}`}
                            onClick={() => handleCreatorClick(creator)}
                          >
                            <div
                              className={`mobile-trending-sidebar-creator-rank-badge ${
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

                            <div className="mobile-trending-sidebar-creator-avatar-wrapper">
                              <div className="mobile-trending-sidebar-creator-avatar">
                                {typeof creator.avatar === "string" &&
                                creator.avatar.startsWith("http") ? (
                                  <img src={creator.avatar} alt={creator.name} />
                                ) : (
                                  creator.avatar
                                )}
                                {creator.isTopTier && (
                                  <div className="mobile-trending-sidebar-crown-icon">
                                    <Crown size={12} color="#000" />
                                  </div>
                                )}
                              </div>
                            </div>

                            <div className="mobile-trending-sidebar-creator-info">
                              <div className="mobile-trending-sidebar-creator-name">
                                <span>{creator.name}</span>
                                {creator.verified && (
                                  <span className="mobile-trending-sidebar-verified-badge">
                                    <Sparkles size={10} />
                                  </span>
                                )}
                              </div>
                              <p className="mobile-trending-sidebar-creator-username">
                                @{creator.username}
                              </p>
                              <div className="mobile-trending-sidebar-creator-stats">
                                <span className="mobile-trending-sidebar-stat-item">
                                  <span className="mobile-trending-sidebar-stat-value">
                                    {formatNumber(creator.stats.likes)}
                                  </span>{" "}
                                  likes
                                </span>
                                <span className="mobile-trending-sidebar-separator">•</span>
                                <span className="mobile-trending-sidebar-stat-item">
                                  <span className="mobile-trending-sidebar-stat-value">
                                    {creator.stats.posts}
                                  </span>{" "}
                                  posts
                                </span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>

                      {eliteCreators.length > 5 && (
                        <button
                          className="mobile-trending-sidebar-view-more-btn"
                          onClick={() => setExpandedCreators(!expandedCreators)}
                        >
                          {expandedCreators
                            ? "Show Less"
                            : `View All ${eliteCreators.length} Creators`}
                          <ArrowRight size={16} />
                        </button>
                      )}
                    </>
                  ) : (
                    <div className="mobile-trending-sidebar-empty-state">
                      <div className="mobile-trending-sidebar-empty-state-icon">👑</div>
                      <p className="mobile-trending-sidebar-empty-state-text">
                        No creators this week
                      </p>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

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

export default MobileTrendingModal;