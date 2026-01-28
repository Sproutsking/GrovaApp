import React, { useState, useEffect } from "react";
import {
  Search,
  Users,
  Eye,
  UserPlus,
  CheckCircle,
  TrendingUp,
  Star,
  Zap,
  Globe,
  Crown,
  Sparkles,
  ChevronDown,
  X,
  Info,
  Lock,
  Hash,
  MessageCircle,
  Calendar,
  Shield,
} from "lucide-react";

const CommunityDetailModal = ({ community, isMember, onClose, onJoin }) => {
  if (!community) return null;

  return (
    <>
      <div className="detail-modal-overlay" onClick={onClose}>
        <div className="detail-modal" onClick={(e) => e.stopPropagation()}>
          <button className="detail-close-btn" onClick={onClose}>
            <X size={20} />
          </button>

          <div
            className="detail-banner"
            style={{ background: community.banner_gradient }}
          >
            <div className="banner-overlay"></div>
            <div className="banner-content">
              <div className="detail-icon">
                {community.icon || community.name?.[0] || "🌟"}
              </div>
            </div>
          </div>

          <div className="detail-content">
            <div className="detail-header">
              <div className="detail-title">
                {community.name}
                {community.is_verified && (
                  <CheckCircle size={20} fill="#9cff00" color="#000" />
                )}
                {community.is_premium && (
                  <Crown size={18} fill="#FFD700" color="#000" />
                )}
              </div>
              {community.is_private && (
                <div className="privacy-badge">
                  <Lock size={14} />
                  Private Community
                </div>
              )}
            </div>

            <div className="detail-stats-row">
              <div className="detail-stat">
                <Users size={16} />
                <span>
                  {(community.member_count || 0).toLocaleString()} members
                </span>
              </div>
              <div className="detail-stat online">
                <div className="online-dot"></div>
                <span>
                  {(community.online_count || 0).toLocaleString()} online
                </span>
              </div>
              <div className="detail-stat">
                <Calendar size={16} />
                <span>
                  Created {new Date(community.created_at).toLocaleDateString()}
                </span>
              </div>
            </div>

            <div className="detail-description">
              <h3>About</h3>
              <p>{community.description || "No description available."}</p>
            </div>

            {community.tags && community.tags.length > 0 && (
              <div className="detail-tags">
                <h3>Topics</h3>
                <div className="tags-list">
                  {community.tags.map((tag, idx) => (
                    <span key={idx} className="tag">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="detail-features">
              <h3>Features</h3>
              <div className="features-grid">
                <div className="feature-item">
                  <Hash size={16} />
                  <span>Text Channels</span>
                </div>
                <div className="feature-item">
                  <MessageCircle size={16} />
                  <span>Voice Channels</span>
                </div>
                <div className="feature-item">
                  <Star size={16} />
                  <span>Custom Roles</span>
                </div>
                <div className="feature-item">
                  <Shield size={16} />
                  <span>Moderation Tools</span>
                </div>
              </div>
            </div>

            <div className="detail-actions">
              {!isMember ? (
                <button
                  className="join-btn"
                  onClick={() => onJoin(community.id)}
                >
                  <UserPlus size={18} />
                  Join Community
                </button>
              ) : (
                <div className="joined-badge">
                  <CheckCircle size={18} />
                  <span>You're a member</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <style jsx>{`
        .detail-modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.7);
          backdrop-filter: blur(8px);
          z-index: 10000;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
          animation: fadeIn 0.3s ease;
        }

        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }

        .detail-modal {
          width: 100%;
          max-width: 600px;
          background: rgba(15, 15, 15, 0.98);
          border: 2px solid rgba(156, 255, 0, 0.2);
          border-radius: 20px;
          overflow: hidden;
          animation: slideUp 0.4s cubic-bezier(0.4, 0, 0.2, 1);
          max-height: 90vh;
          display: flex;
          flex-direction: column;
          position: relative;
        }

        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateY(40px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .detail-close-btn {
          position: absolute;
          top: 16px;
          right: 16px;
          width: 40px;
          height: 40px;
          border-radius: 50%;
          background: rgba(0, 0, 0, 0.8);
          backdrop-filter: blur(10px);
          border: 2px solid rgba(255, 255, 255, 0.1);
          color: #fff;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s;
          z-index: 10;
        }

        .detail-close-btn:hover {
          background: rgba(255, 107, 107, 0.2);
          border-color: rgba(255, 107, 107, 0.6);
          color: #ff6b6b;
          transform: rotate(90deg);
        }

        .detail-banner {
          height: 160px;
          position: relative;
          overflow: hidden;
        }

        .banner-overlay {
          position: absolute;
          inset: 0;
          background: linear-gradient(
            180deg,
            transparent 0%,
            rgba(15, 15, 15, 0.9) 100%
          );
        }

        .banner-content {
          position: absolute;
          bottom: -40px;
          left: 50%;
          transform: translateX(-50%);
          z-index: 2;
        }

        .detail-icon {
          width: 80px;
          height: 80px;
          border-radius: 20px;
          background: inherit;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 40px;
          border: 4px solid rgba(15, 15, 15, 1);
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.6);
        }

        .detail-content {
          padding: 60px 32px 32px;
          overflow-y: auto;
        }

        .detail-content::-webkit-scrollbar {
          width: 6px;
        }

        .detail-content::-webkit-scrollbar-track {
          background: rgba(26, 26, 26, 0.3);
        }

        .detail-content::-webkit-scrollbar-thumb {
          background: rgba(156, 255, 0, 0.3);
          border-radius: 3px;
        }

        .detail-header {
          text-align: center;
          margin-bottom: 20px;
        }

        .detail-title {
          font-size: 28px;
          font-weight: 900;
          color: #fff;
          margin-bottom: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
        }

        .privacy-badge {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 6px 12px;
          background: rgba(156, 255, 0, 0.1);
          border: 1px solid rgba(156, 255, 0, 0.3);
          border-radius: 20px;
          color: #9cff00;
          font-size: 12px;
          font-weight: 600;
        }

        .detail-stats-row {
          display: flex;
          justify-content: center;
          gap: 20px;
          flex-wrap: wrap;
          margin-bottom: 24px;
          padding-bottom: 24px;
          border-bottom: 1px solid rgba(156, 255, 0, 0.1);
        }

        .detail-stat {
          display: flex;
          align-items: center;
          gap: 6px;
          color: #999;
          font-size: 13px;
          font-weight: 600;
        }

        .detail-stat.online {
          color: #10b981;
        }

        .online-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: #10b981;
          box-shadow: 0 0 10px #10b981;
          animation: pulse 2s infinite;
        }

        @keyframes pulse {
          0%,
          100% {
            opacity: 1;
            transform: scale(1);
          }
          50% {
            opacity: 0.6;
            transform: scale(0.9);
          }
        }

        .detail-description,
        .detail-tags,
        .detail-features {
          margin-bottom: 24px;
        }

        .detail-description h3,
        .detail-tags h3,
        .detail-features h3 {
          font-size: 14px;
          font-weight: 700;
          color: #9cff00;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          margin-bottom: 12px;
        }

        .detail-description p {
          color: #ccc;
          font-size: 15px;
          line-height: 1.6;
        }

        .tags-list {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }

        .tag {
          padding: 6px 12px;
          background: rgba(156, 255, 0, 0.1);
          border: 1px solid rgba(156, 255, 0, 0.2);
          border-radius: 8px;
          color: #9cff00;
          font-size: 12px;
          font-weight: 600;
        }

        .features-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 12px;
        }

        .feature-item {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 12px;
          background: rgba(26, 26, 26, 0.6);
          border: 1px solid rgba(42, 42, 42, 0.6);
          border-radius: 10px;
          color: #fff;
          font-size: 13px;
          font-weight: 600;
        }

        .detail-actions {
          margin-top: 32px;
          display: flex;
          justify-content: center;
        }

        .join-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          padding: 14px 32px;
          background: linear-gradient(135deg, #9cff00 0%, #667eea 100%);
          border: none;
          border-radius: 12px;
          color: #000;
          font-size: 16px;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          box-shadow: 0 4px 16px rgba(156, 255, 0, 0.3);
        }

        .join-btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 24px rgba(156, 255, 0, 0.5);
        }

        .joined-badge {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 14px 32px;
          background: rgba(156, 255, 0, 0.15);
          border: 2px solid rgba(156, 255, 0, 0.4);
          border-radius: 12px;
          color: #9cff00;
          font-size: 16px;
          font-weight: 700;
        }

        @media (max-width: 768px) {
          .detail-modal {
            max-width: 100%;
            border-radius: 16px;
          }

          .detail-content {
            padding: 50px 20px 20px;
          }

          .features-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </>
  );
};

const DiscoverTab = ({ communities, myCommunities, onJoin, onSelect }) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [filterCategory, setFilterCategory] = useState("all");
  const [sortBy, setSortBy] = useState("trending");
  const [hoveredCard, setHoveredCard] = useState(null);
  const [showSearch, setShowSearch] = useState(false);
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
  const [showSortDropdown, setShowSortDropdown] = useState(false);
  const [selectedCommunityDetail, setSelectedCommunityDetail] = useState(null);

  const categories = [
    { id: "all", label: "All Categories", icon: Globe },
    { id: "blockchain", label: "Blockchain", icon: Crown },
    { id: "technology", label: "Technology", icon: Zap },
    { id: "creative", label: "Creative", icon: Sparkles },
    { id: "gaming", label: "Gaming", icon: Star },
    { id: "business", label: "Business", icon: TrendingUp },
  ];

  const sortOptions = [
    { id: "trending", label: "Trending" },
    { id: "members", label: "Most Members" },
    { id: "active", label: "Most Active" },
    { id: "newest", label: "Newest" },
  ];

  const isMember = (communityId) => {
    return myCommunities.some((c) => c.id === communityId);
  };

  // Filter out ALL private communities - discover tab only shows public communities
  // Private communities can only be accessed via invite links
  const publicCommunities = communities.filter((c) => c.is_private === false);

  const getTotalAudience = () => {
    return publicCommunities.reduce((acc, c) => acc + (c.member_count || 0), 0);
  };

  const handleClickOutside = (e) => {
    if (
      showCategoryDropdown &&
      !e.target.closest(".category-dropdown-container")
    ) {
      setShowCategoryDropdown(false);
    }
    if (showSortDropdown && !e.target.closest(".sort-dropdown-container")) {
      setShowSortDropdown(false);
    }
    if (
      showSearch &&
      !e.target.closest(".search-dropdown-panel") &&
      !e.target.closest(".search-trigger-btn")
    ) {
      setShowSearch(false);
    }
  };

  useEffect(() => {
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showCategoryDropdown, showSortDropdown, showSearch]);

  const filteredCommunities = publicCommunities
    .filter((c) => {
      const matchesSearch =
        c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.description?.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory =
        filterCategory === "all" || c.category === filterCategory;
      return matchesSearch && matchesCategory;
    })
    .sort((a, b) => {
      if (sortBy === "members")
        return (b.member_count || 0) - (a.member_count || 0);
      if (sortBy === "active")
        return (b.online_count || 0) - (a.online_count || 0);
      if (sortBy === "newest")
        return new Date(b.created_at || 0) - new Date(a.created_at || 0);
      return (
        (b.trending_score || b.member_count || 0) -
        (a.trending_score || a.member_count || 0)
      );
    });

  const selectedCategory = categories.find((c) => c.id === filterCategory);
  const selectedSort = sortOptions.find((s) => s.id === sortBy);

  const handleShowDetail = (community) => {
    setSelectedCommunityDetail(community);
  };

  const handleJoinFromModal = async (communityId) => {
    await onJoin(communityId);
    setSelectedCommunityDetail(null);
  };

  return (
    <>
      <div className="discover-view">
        <div className="chat-background"></div>

        <div className="discover-header">
          <div className="header-content">
            <div className="title-group">
              <Sparkles className="title-icon" size={24} />
              <h1 className="discover-title">Discover Communities</h1>
            </div>
            <p className="discover-subtitle">
              Connect with people who share your interests
            </p>
          </div>
          <div className="header-stats">
            <div className="stat-pill">
              <Globe size={14} />
              <span>{publicCommunities.length} Communities</span>
            </div>
            <div className="stat-pill">
              <Users size={14} />
              <span>{getTotalAudience().toLocaleString()} Total Audience</span>
            </div>
          </div>
        </div>

        <div className="filter-bar">
          <button
            className="search-trigger-btn filter-btn"
            onClick={() => setShowSearch(!showSearch)}
          >
            <Search size={16} />
            <span>Search</span>
          </button>

          <div className="category-dropdown-container">
            <button
              className="filter-btn"
              onClick={() => setShowCategoryDropdown(!showCategoryDropdown)}
            >
              {selectedCategory && <selectedCategory.icon size={16} />}
              <span>{selectedCategory?.label || "Category"}</span>
              <ChevronDown
                size={14}
                className={showCategoryDropdown ? "rotated" : ""}
              />
            </button>
            {showCategoryDropdown && (
              <div className="dropdown-menu">
                {categories.map((cat) => {
                  const Icon = cat.icon;
                  return (
                    <button
                      key={cat.id}
                      className={`dropdown-item ${filterCategory === cat.id ? "active" : ""}`}
                      onClick={() => {
                        setFilterCategory(cat.id);
                        setShowCategoryDropdown(false);
                      }}
                    >
                      <Icon size={14} />
                      {cat.label}
                      {filterCategory === cat.id && (
                        <CheckCircle size={14} className="check-icon" />
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="sort-dropdown-container">
            <button
              className="filter-btn"
              onClick={() => setShowSortDropdown(!showSortDropdown)}
            >
              <TrendingUp size={16} />
              <span>{selectedSort?.label || "Sort"}</span>
              <ChevronDown
                size={14}
                className={showSortDropdown ? "rotated" : ""}
              />
            </button>
            {showSortDropdown && (
              <div className="dropdown-menu">
                {sortOptions.map((opt) => (
                  <button
                    key={opt.id}
                    className={`dropdown-item ${sortBy === opt.id ? "active" : ""}`}
                    onClick={() => {
                      setSortBy(opt.id);
                      setShowSortDropdown(false);
                    }}
                  >
                    {opt.label}
                    {sortBy === opt.id && (
                      <CheckCircle size={14} className="check-icon" />
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {showSearch && (
          <div className="search-dropdown-panel">
            <div className="search-panel-content">
              <Search className="search-panel-icon" size={18} />
              <input
                type="text"
                className="search-panel-input"
                placeholder="Search communities..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                autoFocus
              />
              {searchQuery && (
                <button
                  className="clear-search-btn"
                  onClick={() => setSearchQuery("")}
                >
                  <X size={16} />
                </button>
              )}
            </div>
            <button
              className="close-search-btn"
              onClick={() => setShowSearch(false)}
            >
              <X size={18} />
            </button>
          </div>
        )}

        <div className="communities-grid">
          {filteredCommunities.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">🔍</div>
              <h3>No communities found</h3>
              <p>Try adjusting your search or filters</p>
            </div>
          ) : (
            filteredCommunities.map((community) => (
              <div
                key={community.id}
                className={`community-card ${hoveredCard === community.id ? "hovered" : ""}`}
                onMouseEnter={() => setHoveredCard(community.id)}
                onMouseLeave={() => setHoveredCard(null)}
              >
                <div
                  className="card-gradient-bg"
                  style={{
                    background:
                      community.banner_gradient ||
                      "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                  }}
                ></div>

                <div className="card-content">
                  <div className="card-header">
                    <div
                      className="card-avatar"
                      style={{
                        background:
                          community.banner_gradient ||
                          "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                      }}
                    >
                      {community.icon || community.name?.[0] || "🌟"}
                      {community.is_premium && (
                        <div className="premium-badge">
                          <Crown size={10} fill="#FFD700" color="#000" />
                        </div>
                      )}
                    </div>

                    <div className="card-info">
                      <div className="card-name">
                        {community.name}
                        {community.is_verified && (
                          <CheckCircle size={14} fill="#9cff00" color="#000" />
                        )}
                      </div>
                      <div className="card-stats">
                        <div className="stat-item">
                          <Users size={12} />
                          <span>
                            {(community.member_count || 0).toLocaleString()}
                          </span>
                        </div>
                        <div className="stat-divider">•</div>
                        <div className="stat-item online">
                          <div className="online-pulse"></div>
                          <span>
                            {(community.online_count || 0).toLocaleString()}{" "}
                            online
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <p className="card-description">
                    {community.description || "No description available"}
                  </p>

                  {community.tags && community.tags.length > 0 && (
                    <div className="card-tags">
                      {community.tags.slice(0, 3).map((tag, idx) => (
                        <span key={idx} className="tag">
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="card-actions">
                    {!isMember(community.id) ? (
                      <>
                        <button
                          className="card-btn join-btn"
                          onClick={() => onJoin(community.id)}
                        >
                          <UserPlus size={16} />
                          <span>Join</span>
                        </button>
                        <button
                          className="card-btn preview-btn"
                          onClick={() => handleShowDetail(community)}
                        >
                          <Info size={16} />
                          <span>Details</span>
                        </button>
                      </>
                    ) : (
                      <>
                        <button className="card-btn joined-btn">
                          <CheckCircle size={16} />
                          <span>Joined</span>
                        </button>
                        <button
                          className="card-btn view-btn"
                          onClick={() => onSelect(community)}
                        >
                          <Eye size={16} />
                          <span>View</span>
                        </button>
                      </>
                    )}
                  </div>
                </div>

                <div className="card-hover-overlay"></div>
              </div>
            ))
          )}
        </div>
      </div>

      {selectedCommunityDetail && (
        <CommunityDetailModal
          community={selectedCommunityDetail}
          isMember={isMember(selectedCommunityDetail.id)}
          onClose={() => setSelectedCommunityDetail(null)}
          onJoin={handleJoinFromModal}
        />
      )}

      <style>{`
        .discover-view {
          flex: 1;
          overflow-y: auto;
          padding: 20px;
          position: relative;
          background: #000;
        }

        .chat-background {
          position: absolute;
          inset: 0;
          opacity: 0.03;
          background-image:
            repeating-linear-gradient(
              0deg,
              transparent,
              transparent 2px,
              rgba(156, 255, 0, 0.1) 2px,
              rgba(156, 255, 0, 0.1) 4px
            ),
            repeating-linear-gradient(
              90deg,
              transparent,
              transparent 2px,
              rgba(102, 126, 234, 0.1) 2px,
              rgba(102, 126, 234, 0.1) 4px
            );
          pointer-events: none;
        }

        .discover-header {
          margin-bottom: 20px;
          animation: slideDown 0.6s ease;
        }

        @keyframes slideDown {
          from {
            opacity: 0;
            transform: translateY(-20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .header-content {
          margin-bottom: 12px;
        }

        .title-group {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 6px;
        }

        .discover-title {
          font-size: 28px;
          font-weight: 900;
          background: linear-gradient(
            135deg,
            #9cff00 0%,
            #667eea 60%,
            #ff00ff 100%
          );
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          background-size: 200% auto;
          animation: gradientFlow 3s ease infinite;
        }

        @keyframes gradientFlow {
          0%,
          100% {
            background-position: 0% center;
          }
          50% {
            background-position: 100% center;
          }
        }

        .title-icon {
          color: #9cff00;
          animation: sparkle 2s ease infinite;
          flex-shrink: 0;
        }

        @keyframes sparkle {
          0%,
          100% {
            opacity: 1;
            transform: rotate(0deg) scale(1);
          }
          50% {
            opacity: 0.7;
            transform: rotate(180deg) scale(1.1);
          }
        }

        .discover-subtitle {
          color: #999;
          font-size: 14px;
          line-height: 1.5;
        }

        .header-stats {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }

        .stat-pill {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 6px 12px;
          background: rgba(156, 255, 0, 0.1);
          border: 1px solid rgba(156, 255, 0, 0.2);
          border-radius: 16px;
          color: #9cff00;
          font-size: 12px;
          font-weight: 600;
        }

        .filter-bar {
          display: flex;
          gap: 8px;
          margin-bottom: 20px;
          position: relative;
        }

        .filter-btn {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 10px 14px;
          background: rgba(15, 15, 15, 0.9);
          border: 2px solid rgba(26, 26, 26, 0.8);
          border-radius: 10px;
          color: #fff;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.3s;
          white-space: nowrap;
          flex-shrink: 1;
          min-width: 0;
        }

        .filter-btn span {
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .filter-btn:hover {
          border-color: rgba(156, 255, 0, 0.6);
          background: rgba(156, 255, 0, 0.05);
          color: #9cff00;
        }

        .filter-btn .rotated {
          transform: rotate(180deg);
        }

        .category-dropdown-container,
        .sort-dropdown-container {
          position: relative;
          flex-shrink: 1;
          min-width: 0;
        }

        .dropdown-menu {
          position: absolute;
          top: calc(100% + 6px);
          left: 0;
          min-width: 180px;
          background: rgba(15, 15, 15, 0.98);
          border: 2px solid rgba(26, 26, 26, 0.8);
          border-radius: 12px;
          padding: 6px;
          z-index: 100;
          animation: dropdownSlide 0.2s ease;
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.6);
        }

        @keyframes dropdownSlide {
          from {
            opacity: 0;
            transform: translateY(-8px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .dropdown-item {
          width: 100%;
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 12px;
          background: transparent;
          border: none;
          border-radius: 8px;
          color: #999;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
          text-align: left;
        }

        .dropdown-item:hover {
          background: rgba(156, 255, 0, 0.1);
          color: #fff;
        }

        .dropdown-item.active {
          background: rgba(156, 255, 0, 0.15);
          color: #9cff00;
        }

        .dropdown-item .check-icon {
          margin-left: auto;
          color: #9cff00;
        }

        .search-dropdown-panel {
          position: relative;
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 20px;
          animation: slideDown 0.3s ease;
        }

        .search-panel-content {
          flex: 1;
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 12px 16px;
          background: rgba(15, 15, 15, 0.95);
          border: 2px solid rgba(26, 26, 26, 0.8);
          border-radius: 12px;
          transition: all 0.3s;
        }

        .search-panel-content:focus-within {
          border-color: rgba(156, 255, 0, 0.6);
          box-shadow: 0 0 0 3px rgba(156, 255, 0, 0.1);
        }

        .search-panel-icon {
          color: #666;
          flex-shrink: 0;
        }

        .search-panel-input {
          flex: 1;
          background: transparent;
          border: none;
          color: #fff;
          font-size: 14px;
          outline: none;
        }

        .search-panel-input::placeholder {
          color: #666;
        }

        .clear-search-btn {
          width: 22px;
          height: 22px;
          border-radius: 50%;
          background: rgba(156, 255, 0, 0.1);
          border: none;
          color: #9cff00;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s;
          flex-shrink: 0;
        }

        .clear-search-btn:hover {
          background: rgba(156, 255, 0, 0.2);
          transform: scale(1.1);
        }

        .close-search-btn {
          width: 40px;
          height: 40px;
          border-radius: 10px;
          background: rgba(15, 15, 15, 0.9);
          border: 2px solid rgba(26, 26, 26, 0.8);
          color: #fff;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s;
          flex-shrink: 0;
        }

        .close-search-btn:hover {
          border-color: rgba(156, 255, 0, 0.6);
          background: rgba(156, 255, 0, 0.05);
          color: #9cff00;
        }

        .communities-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
          gap: 16px;
          animation: fadeIn 0.5s ease;
        }

        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }

        .community-card {
          position: relative;
          background: rgba(15, 15, 15, 0.95);
          backdrop-filter: blur(20px);
          border: 2px solid rgba(26, 26, 26, 0.8);
          border-radius: 16px;
          padding: 16px;
          cursor: pointer;
          transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
          overflow: hidden;
          animation: cardSlideIn 0.5s ease backwards;
        }

        @keyframes cardSlideIn {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .community-card:nth-child(1) {
          animation-delay: 0.05s;
        }
        .community-card:nth-child(2) {
          animation-delay: 0.1s;
        }
        .community-card:nth-child(3) {
          animation-delay: 0.15s;
        }
        .community-card:nth-child(4) {
          animation-delay: 0.2s;
        }
        .community-card:nth-child(5) {
          animation-delay: 0.25s;
        }
        .community-card:nth-child(6) {
          animation-delay: 0.3s;
        }

        .card-gradient-bg {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 3px;
          opacity: 0.6;
          transition: all 0.4s;
        }

        .community-card:hover .card-gradient-bg {
          height: 100%;
          opacity: 0.08;
        }

        .card-content {
          position: relative;
          z-index: 1;
        }

        .community-card:hover {
          border-color: rgba(156, 255, 0, 0.6);
          transform: translateY(-6px);
          box-shadow:
            0 20px 40px rgba(0, 0, 0, 0.5),
            0 0 30px rgba(156, 255, 0, 0.15);
        }

        .card-hover-overlay {
          position: absolute;
          inset: 0;
          background: radial-gradient(
            circle at center,
            rgba(156, 255, 0, 0.05) 0%,
            transparent 70%
          );
          opacity: 0;
          transition: opacity 0.4s;
          pointer-events: none;
        }

        .community-card:hover .card-hover-overlay {
          opacity: 1;
        }

        .card-header {
          display: flex;
          align-items: flex-start;
          gap: 12px;
          margin-bottom: 12px;
        }

        .card-avatar {
          width: 52px;
          height: 52px;
          border-radius: 14px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 26px;
          box-shadow: 0 6px 20px rgba(0, 0, 0, 0.4);
          flex-shrink: 0;
          position: relative;
          transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .community-card:hover .card-avatar {
          transform: scale(1.05) rotate(5deg);
          box-shadow: 0 10px 28px rgba(156, 255, 0, 0.3);
        }

        .premium-badge {
          position: absolute;
          top: -3px;
          right: -3px;
          width: 18px;
          height: 18px;
          background: #000;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          border: 2px solid #ffd700;
          box-shadow: 0 0 10px rgba(255, 215, 0, 0.6);
        }

        .card-info {
          flex: 1;
          min-width: 0;
        }

        .card-name {
          font-size: 17px;
          font-weight: 800;
          margin-bottom: 6px;
          display: flex;
          align-items: center;
          gap: 6px;
          color: #fff;
        }

        .card-stats {
          display: flex;
          align-items: center;
          gap: 6px;
          color: #999;
          font-size: 12px;
          font-weight: 600;
        }

        .stat-item {
          display: flex;
          align-items: center;
          gap: 4px;
        }

        .stat-item.online {
          color: #10b981;
        }

        .stat-divider {
          color: #333;
        }

        .online-pulse {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: #10b981;
          box-shadow: 0 0 10px #10b981;
          animation: pulse 2s infinite;
        }

        .card-description {
          color: #999;
          font-size: 13px;
          line-height: 1.5;
          margin-bottom: 12px;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }

        .card-tags {
          display: flex;
          gap: 6px;
          flex-wrap: wrap;
          margin-bottom: 12px;
        }

        .tag {
          padding: 4px 8px;
          background: rgba(156, 255, 0, 0.1);
          border: 1px solid rgba(156, 255, 0, 0.2);
          border-radius: 6px;
          color: #9cff00;
          font-size: 10px;
          font-weight: 600;
        }

        .card-actions {
          display: flex;
          gap: 8px;
        }

        .card-btn {
          flex: 1;
          padding: 10px 16px;
          border-radius: 10px;
          font-size: 13px;
          font-weight: 700;
          cursor: pointer;
          border: none;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          position: relative;
          overflow: hidden;
        }

        .card-btn::before {
          content: "";
          position: absolute;
          inset: 0;
          background: linear-gradient(
            135deg,
            rgba(255, 255, 255, 0.1) 0%,
            transparent 100%
          );
          opacity: 0;
          transition: opacity 0.3s;
        }

        .card-btn:hover::before {
          opacity: 1;
        }

        .join-btn {
          background: linear-gradient(135deg, #9cff00 0%, #667eea 100%);
          color: #000;
          box-shadow: 0 4px 14px rgba(156, 255, 0, 0.3);
        }

        .join-btn:hover {
          background: linear-gradient(135deg, #b4ff33 0%, #7d8ef7 100%);
          box-shadow: 0 6px 20px rgba(156, 255, 0, 0.5);
          transform: translateY(-2px);
        }

        .joined-btn {
          background: rgba(156, 255, 0, 0.15);
          border: 2px solid rgba(156, 255, 0, 0.4);
          color: #9cff00;
        }

        .preview-btn {
          background: rgba(26, 26, 26, 0.8);
          border: 2px solid rgba(42, 42, 42, 0.8);
          color: #fff;
        }

        .preview-btn:hover {
          background: rgba(26, 26, 26, 1);
          border-color: rgba(102, 126, 234, 0.4);
          color: #667eea;
          transform: translateY(-2px);
        }

        .view-btn {
          background: rgba(26, 26, 26, 0.8);
          border: 2px solid rgba(42, 42, 42, 0.8);
          color: #fff;
        }

        .view-btn:hover {
          background: rgba(26, 26, 26, 1);
          border-color: rgba(156, 255, 0, 0.4);
          color: #9cff00;
          transform: translateY(-2px);
        }

        .empty-state {
          grid-column: 1 / -1;
          text-align: center;
          padding: 60px 20px;
        }

        .empty-icon {
          font-size: 64px;
          margin-bottom: 16px;
          opacity: 0.5;
          animation: float 3s ease-in-out infinite;
        }

        @keyframes float {
          0%,
          100% {
            transform: translateY(0);
          }
          50% {
            transform: translateY(-10px);
          }
        }

        .empty-state h3 {
          font-size: 20px;
          font-weight: 800;
          color: #fff;
          margin-bottom: 6px;
        }

        .empty-state p {
          color: #666;
          font-size: 14px;
        }

        @media (max-width: 768px) {
          .discover-view {
            padding: 16px;
          }

          .discover-title {
            font-size: 24px;
          }

          .title-icon {
            width: 20px;
            height: 20px;
          }

          .discover-subtitle {
            font-size: 13px;
          }

          .filter-bar {
            gap: 6px;
          }

          .filter-btn {
            padding: 8px 10px;
            font-size: 12px;
            gap: 4px;
          }

          .search-dropdown-panel {
            width: 100%;
          }

          .communities-grid {
            grid-template-columns: 1fr;
            gap: 12px;
          }

          .card-avatar {
            width: 48px;
            height: 48px;
            font-size: 24px;
          }

          .card-name {
            font-size: 16px;
          }

          .card-description {
            font-size: 12px;
          }
        }
      `}</style>
    </>
  );
};

export default DiscoverTab;
