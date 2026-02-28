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
          from { opacity: 0; }
          to   { opacity: 1; }
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
          from { opacity: 0; transform: translateY(40px); }
          to   { opacity: 1; transform: translateY(0);    }
        }

        .detail-close-btn {
          position: absolute;
          top: 16px; right: 16px;
          width: 40px; height: 40px;
          border-radius: 50%;
          background: rgba(0, 0, 0, 0.8);
          backdrop-filter: blur(10px);
          border: 2px solid rgba(255, 255, 255, 0.1);
          color: #fff; cursor: pointer;
          display: flex; align-items: center; justify-content: center;
          transition: all 0.2s; z-index: 10;
        }
        .detail-close-btn:hover {
          background: rgba(255, 107, 107, 0.2);
          border-color: rgba(255, 107, 107, 0.6);
          color: #ff6b6b;
          transform: rotate(90deg);
        }

        .detail-banner {
          height: 160px; position: relative; overflow: hidden;
        }
        .banner-overlay {
          position: absolute; inset: 0;
          background: linear-gradient(180deg, transparent 0%, rgba(15,15,15,0.9) 100%);
        }
        .banner-content {
          position: absolute; bottom: -40px;
          left: 50%; transform: translateX(-50%); z-index: 2;
        }
        .detail-icon {
          width: 80px; height: 80px; border-radius: 20px;
          display: flex; align-items: center; justify-content: center;
          font-size: 40px;
          border: 4px solid rgba(15, 15, 15, 1);
          box-shadow: 0 8px 32px rgba(0,0,0,0.6);
        }

        .detail-content {
          padding: 60px 32px 32px;
          overflow-y: auto;
        }
        .detail-content::-webkit-scrollbar { width: 6px; }
        .detail-content::-webkit-scrollbar-track { background: rgba(26,26,26,0.3); }
        .detail-content::-webkit-scrollbar-thumb { background: rgba(156,255,0,0.3); border-radius: 3px; }

        .detail-header { text-align: center; margin-bottom: 20px; }
        .detail-title {
          font-size: 28px; font-weight: 900; color: #fff; margin-bottom: 12px;
          display: flex; align-items: center; justify-content: center; gap: 10px;
        }
        .privacy-badge {
          display: inline-flex; align-items: center; gap: 6px;
          padding: 6px 12px;
          background: rgba(156,255,0,0.1); border: 1px solid rgba(156,255,0,0.3);
          border-radius: 20px; color: #9cff00; font-size: 12px; font-weight: 600;
        }

        .detail-stats-row {
          display: flex; justify-content: center; gap: 20px; flex-wrap: wrap;
          margin-bottom: 24px; padding-bottom: 24px;
          border-bottom: 1px solid rgba(156,255,0,0.1);
        }
        .detail-stat {
          display: flex; align-items: center; gap: 6px;
          color: #999; font-size: 13px; font-weight: 600;
        }
        .detail-stat.online { color: #10b981; }
        .online-dot {
          width: 8px; height: 8px; border-radius: 50%;
          background: #10b981; box-shadow: 0 0 10px #10b981;
          animation: pulse 2s infinite;
        }
        @keyframes pulse {
          0%,100% { opacity:1; transform:scale(1);   }
          50%      { opacity:.6; transform:scale(.9); }
        }

        .detail-description, .detail-tags, .detail-features { margin-bottom: 24px; }
        .detail-description h3, .detail-tags h3, .detail-features h3 {
          font-size: 14px; font-weight: 700; color: #9cff00;
          text-transform: uppercase; letter-spacing: .5px; margin-bottom: 12px;
        }
        .detail-description p { color: #ccc; font-size: 15px; line-height: 1.6; }

        .tags-list { display: flex; gap: 8px; flex-wrap: wrap; }
        .tag {
          padding: 6px 12px;
          background: rgba(156,255,0,0.1); border: 1px solid rgba(156,255,0,0.2);
          border-radius: 8px; color: #9cff00; font-size: 12px; font-weight: 600;
        }

        .features-grid { display: grid; grid-template-columns: repeat(2,1fr); gap: 12px; }
        .feature-item {
          display: flex; align-items: center; gap: 10px; padding: 12px;
          background: rgba(26,26,26,0.6); border: 1px solid rgba(42,42,42,0.6);
          border-radius: 10px; color: #fff; font-size: 13px; font-weight: 600;
        }

        .detail-actions { margin-top: 32px; display: flex; justify-content: center; }
        .join-btn {
          display: flex; align-items: center; justify-content: center; gap: 10px;
          padding: 14px 32px;
          background: linear-gradient(135deg, #9cff00 0%, #667eea 100%);
          border: none; border-radius: 12px; color: #000;
          font-size: 16px; font-weight: 700; cursor: pointer;
          transition: all .3s cubic-bezier(.4,0,.2,1);
          box-shadow: 0 4px 16px rgba(156,255,0,0.3);
        }
        .join-btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 24px rgba(156,255,0,0.5);
        }
        .joined-badge {
          display: flex; align-items: center; gap: 10px;
          padding: 14px 32px;
          background: rgba(156,255,0,0.15); border: 2px solid rgba(156,255,0,0.4);
          border-radius: 12px; color: #9cff00; font-size: 16px; font-weight: 700;
        }

        @media (max-width: 768px) {
          .detail-modal { max-width: 100%; border-radius: 16px; }
          .detail-content { padding: 50px 20px 20px; }
          .features-grid { grid-template-columns: 1fr; }
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
    { id: "all",        label: "All",         icon: Globe      },
    { id: "blockchain", label: "Blockchain",  icon: Crown      },
    { id: "technology", label: "Technology",  icon: Zap        },
    { id: "creative",   label: "Creative",    icon: Sparkles   },
    { id: "gaming",     label: "Gaming",      icon: Star       },
    { id: "business",   label: "Business",    icon: TrendingUp },
  ];

  const sortOptions = [
    { id: "trending", label: "Trending"      },
    { id: "members",  label: "Most Members"  },
    { id: "active",   label: "Most Active"   },
    { id: "newest",   label: "Newest"        },
  ];

  const isMember = (communityId) =>
    myCommunities.some((c) => c.id === communityId);

  const publicCommunities = communities.filter((c) => c.is_private === false);

  const getTotalAudience = () =>
    publicCommunities.reduce((acc, c) => acc + (c.member_count || 0), 0);

  const handleClickOutside = (e) => {
    if (showCategoryDropdown && !e.target.closest(".category-dropdown-container"))
      setShowCategoryDropdown(false);
    if (showSortDropdown && !e.target.closest(".sort-dropdown-container"))
      setShowSortDropdown(false);
    if (
      showSearch &&
      !e.target.closest(".search-dropdown-panel") &&
      !e.target.closest(".search-trigger-btn")
    ) setShowSearch(false);
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
      if (sortBy === "members") return (b.member_count || 0) - (a.member_count || 0);
      if (sortBy === "active")  return (b.online_count  || 0) - (a.online_count  || 0);
      if (sortBy === "newest")  return new Date(b.created_at || 0) - new Date(a.created_at || 0);
      return (b.trending_score || b.member_count || 0) - (a.trending_score || a.member_count || 0);
    });

  const selectedCategory = categories.find((c) => c.id === filterCategory);
  const selectedSort = sortOptions.find((s) => s.id === sortBy);

  const handleShowDetail   = (community) => setSelectedCommunityDetail(community);
  const handleJoinFromModal = async (communityId) => {
    await onJoin(communityId);
    setSelectedCommunityDetail(null);
  };

  return (
    <>
      <div className="discover-view">
        <div className="chat-background"></div>

        {/* ── Compact top bar: stats left, filters right — single row always ── */}
        <div className="top-bar">
          {/* Left: community + audience counts */}
          <div className="top-stats">
            <div className="top-stat">
              <Globe size={12} />
              <span>{publicCommunities.length}</span>
            </div>
            <div className="top-stat-divider">·</div>
            <div className="top-stat">
              <Users size={12} />
              <span>{getTotalAudience().toLocaleString()}</span>
            </div>
          </div>

          {/* Right: search + category + sort — icon-first, no wrap */}
          <div className="top-controls">
            {/* Search toggle */}
            <button
              className={`ctrl-btn search-trigger-btn${showSearch ? " active" : ""}`}
              onClick={() => setShowSearch(!showSearch)}
              title="Search"
            >
              <Search size={15} />
            </button>

            {/* Category */}
            <div className="category-dropdown-container">
              <button
                className={`ctrl-btn${showCategoryDropdown ? " active" : ""}`}
                onClick={() => setShowCategoryDropdown(!showCategoryDropdown)}
                title="Category"
              >
                {selectedCategory && <selectedCategory.icon size={15} />}
                <span className="ctrl-label">{selectedCategory?.label || "All"}</span>
                <ChevronDown size={12} className={showCategoryDropdown ? "rotated" : ""} />
              </button>
              {showCategoryDropdown && (
                <div className="dropdown-menu">
                  {categories.map((cat) => {
                    const Icon = cat.icon;
                    return (
                      <button
                        key={cat.id}
                        className={`dropdown-item${filterCategory === cat.id ? " active" : ""}`}
                        onClick={() => { setFilterCategory(cat.id); setShowCategoryDropdown(false); }}
                      >
                        <Icon size={14} />
                        {cat.label}
                        {filterCategory === cat.id && <CheckCircle size={13} className="check-icon" />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Sort */}
            <div className="sort-dropdown-container">
              <button
                className={`ctrl-btn${showSortDropdown ? " active" : ""}`}
                onClick={() => setShowSortDropdown(!showSortDropdown)}
                title="Sort"
              >
                <TrendingUp size={15} />
                <span className="ctrl-label">{selectedSort?.label || "Sort"}</span>
                <ChevronDown size={12} className={showSortDropdown ? "rotated" : ""} />
              </button>
              {showSortDropdown && (
                <div className="dropdown-menu">
                  {sortOptions.map((opt) => (
                    <button
                      key={opt.id}
                      className={`dropdown-item${sortBy === opt.id ? " active" : ""}`}
                      onClick={() => { setSortBy(opt.id); setShowSortDropdown(false); }}
                    >
                      {opt.label}
                      {sortBy === opt.id && <CheckCircle size={13} className="check-icon" />}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Search panel — slides in below the top bar ── */}
        {showSearch && (
          <div className="search-dropdown-panel">
            <div className="search-panel-content">
              <Search className="search-panel-icon" size={16} />
              <input
                type="text"
                className="search-panel-input"
                placeholder="Search communities…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                autoFocus
              />
              {searchQuery && (
                <button className="clear-search-btn" onClick={() => setSearchQuery("")}>
                  <X size={14} />
                </button>
              )}
            </div>
            <button className="close-search-btn" onClick={() => setShowSearch(false)}>
              <X size={16} />
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
                className={`community-card${hoveredCard === community.id ? " hovered" : ""}`}
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
                />

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
                          <span>{(community.member_count || 0).toLocaleString()}</span>
                        </div>
                        <div className="stat-divider">•</div>
                        <div className="stat-item online">
                          <div className="online-pulse"></div>
                          <span>{(community.online_count || 0).toLocaleString()} online</span>
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
                        <span key={idx} className="tag">{tag}</span>
                      ))}
                    </div>
                  )}

                  <div className="card-actions">
                    {!isMember(community.id) ? (
                      <>
                        <button className="card-btn join-btn" onClick={() => onJoin(community.id)}>
                          <UserPlus size={15} />
                          <span>Join</span>
                        </button>
                        <button className="card-btn preview-btn" onClick={() => handleShowDetail(community)}>
                          <Info size={15} />
                          <span>Details</span>
                        </button>
                      </>
                    ) : (
                      <>
                        <button className="card-btn joined-btn">
                          <CheckCircle size={15} />
                          <span>Joined</span>
                        </button>
                        <button className="card-btn view-btn" onClick={() => onSelect(community)}>
                          <Eye size={15} />
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
        /* ── View shell ── */
        .discover-view {
          flex: 1;
          overflow-y: auto;
          padding: 12px 16px 20px;
          position: relative;
          background: #000;
        }

        .chat-background {
          position: absolute; inset: 0; opacity: 0.03;
          background-image:
            repeating-linear-gradient(0deg,  transparent, transparent 2px, rgba(156,255,0,.1) 2px, rgba(156,255,0,.1) 4px),
            repeating-linear-gradient(90deg, transparent, transparent 2px, rgba(102,126,234,.1) 2px, rgba(102,126,234,.1) 4px);
          pointer-events: none;
        }

        /* ── Top bar: one row, never wraps ── */
        .top-bar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          margin-bottom: 12px;
          min-width: 0;
        }

        /* Left stats */
        .top-stats {
          display: flex;
          align-items: center;
          gap: 6px;
          flex-shrink: 0;
        }
        .top-stat {
          display: flex; align-items: center; gap: 4px;
          color: #555; font-size: 11px; font-weight: 600;
        }
        .top-stat-divider { color: #333; font-size: 11px; }

        /* Right controls */
        .top-controls {
          display: flex;
          align-items: center;
          gap: 6px;
          flex-shrink: 0;
        }

        /* ── Control buttons ── */
        .ctrl-btn {
          display: flex;
          align-items: center;
          gap: 5px;
          padding: 7px 10px;
          background: rgba(18,18,18,0.95);
          border: 1px solid rgba(42,42,42,0.9);
          border-radius: 9px;
          color: #888;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.18s;
          white-space: nowrap;
          line-height: 1;
        }
        .ctrl-btn:hover, .ctrl-btn.active {
          background: rgba(156,255,0,0.08);
          border-color: rgba(156,255,0,0.35);
          color: #9cff00;
        }
        /* Label hidden on very small screens, icon always visible */
        .ctrl-label {
          max-width: 72px;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .ctrl-btn .rotated { transform: rotate(180deg); }

        /* Search-only button is icon only */
        .search-trigger-btn { padding: 7px 9px; }

        /* ── Dropdowns ── */
        .category-dropdown-container,
        .sort-dropdown-container {
          position: relative;
        }
        .dropdown-menu {
          position: absolute;
          top: calc(100% + 6px);
          left: 0;
          min-width: 170px;
          background: rgba(12,12,12,0.99);
          border: 1.5px solid rgba(42,42,42,0.9);
          border-radius: 11px;
          padding: 5px;
          z-index: 200;
          box-shadow: 0 8px 28px rgba(0,0,0,0.7);
          animation: ddSlide 0.18s ease;
        }
        /* Sort dropdown anchors to right edge of its button so it doesn't clip off-screen */
        .sort-dropdown-container .dropdown-menu {
          left: auto;
          right: 0;
        }
        /* Category dropdown anchors to left edge — default */
        @keyframes ddSlide {
          from { opacity:0; transform:translateY(-6px); }
          to   { opacity:1; transform:translateY(0);    }
        }
        .dropdown-item {
          width: 100%;
          display: flex; align-items: center; gap: 8px;
          padding: 9px 11px;
          background: transparent; border: none; border-radius: 7px;
          color: #888; font-size: 13px; font-weight: 600;
          cursor: pointer; transition: all 0.15s; text-align: left;
        }
        .dropdown-item:hover { background: rgba(156,255,0,0.08); color: #fff; }
        .dropdown-item.active { background: rgba(156,255,0,0.13); color: #9cff00; }
        .dropdown-item .check-icon { margin-left: auto; color: #9cff00; }

        /* ── Search panel ── */
        .search-dropdown-panel {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 12px;
          animation: slideDown 0.22s ease;
        }
        @keyframes slideDown {
          from { opacity:0; transform:translateY(-8px); }
          to   { opacity:1; transform:translateY(0);    }
        }
        .search-panel-content {
          flex: 1; display: flex; align-items: center; gap: 9px;
          padding: 10px 14px;
          background: rgba(12,12,12,0.98);
          border: 1.5px solid rgba(42,42,42,0.9);
          border-radius: 10px; transition: border-color 0.2s;
        }
        .search-panel-content:focus-within {
          border-color: rgba(156,255,0,0.5);
          box-shadow: 0 0 0 3px rgba(156,255,0,0.07);
        }
        .search-panel-icon { color: #555; flex-shrink: 0; }
        .search-panel-input {
          flex:1; background:transparent; border:none;
          color:#fff; font-size:13px; outline:none;
        }
        .search-panel-input::placeholder { color: #444; }
        .clear-search-btn {
          width: 20px; height: 20px; border-radius: 50%;
          background: rgba(156,255,0,0.1); border: none; color: #9cff00;
          cursor: pointer; display: flex; align-items: center; justify-content: center;
          transition: all 0.15s; flex-shrink: 0;
        }
        .clear-search-btn:hover { background: rgba(156,255,0,0.2); transform: scale(1.1); }
        .close-search-btn {
          width: 36px; height: 36px; border-radius: 9px;
          background: rgba(12,12,12,0.98);
          border: 1.5px solid rgba(42,42,42,0.9);
          color: #888; cursor: pointer;
          display: flex; align-items: center; justify-content: center;
          transition: all 0.15s; flex-shrink: 0;
        }
        .close-search-btn:hover {
          border-color: rgba(156,255,0,0.4); color: #9cff00;
        }

        /* ── Community cards ── */
        .communities-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
          gap: 14px;
          animation: fadeIn 0.4s ease;
        }
        @keyframes fadeIn { from {opacity:0;} to {opacity:1;} }

        .community-card {
          position: relative;
          background: rgba(13,13,13,0.97);
          backdrop-filter: blur(20px);
          border: 1.5px solid rgba(30,30,30,0.9);
          border-radius: 14px;
          padding: 14px;
          cursor: pointer;
          transition: all 0.35s cubic-bezier(.4,0,.2,1);
          overflow: hidden;
          animation: cardSlideIn 0.45s ease backwards;
        }
        @keyframes cardSlideIn {
          from { opacity:0; transform:translateY(16px); }
          to   { opacity:1; transform:translateY(0);    }
        }
        .community-card:nth-child(1) { animation-delay: .05s; }
        .community-card:nth-child(2) { animation-delay: .10s; }
        .community-card:nth-child(3) { animation-delay: .15s; }
        .community-card:nth-child(4) { animation-delay: .20s; }
        .community-card:nth-child(5) { animation-delay: .25s; }
        .community-card:nth-child(6) { animation-delay: .30s; }

        .card-gradient-bg {
          position: absolute; top:0; left:0; right:0;
          height: 3px; opacity: 0.6; transition: all 0.35s;
        }
        .community-card:hover .card-gradient-bg { height:100%; opacity:.07; }

        .card-content { position: relative; z-index: 1; }

        .community-card:hover {
          border-color: rgba(156,255,0,0.55);
          transform: translateY(-4px);
          box-shadow: 0 16px 36px rgba(0,0,0,0.5), 0 0 24px rgba(156,255,0,0.1);
        }

        .card-hover-overlay {
          position: absolute; inset:0;
          background: radial-gradient(circle at center, rgba(156,255,0,0.04) 0%, transparent 70%);
          opacity:0; transition: opacity 0.35s; pointer-events: none;
        }
        .community-card:hover .card-hover-overlay { opacity:1; }

        /* Card header */
        .card-header {
          display: flex; align-items: flex-start; gap: 11px; margin-bottom: 10px;
        }
        .card-avatar {
          width: 48px; height: 48px; border-radius: 12px;
          display: flex; align-items: center; justify-content: center;
          font-size: 24px; box-shadow: 0 4px 16px rgba(0,0,0,0.4);
          flex-shrink: 0; position: relative;
          transition: all 0.35s cubic-bezier(.4,0,.2,1);
        }
        .community-card:hover .card-avatar {
          transform: scale(1.06) rotate(4deg);
          box-shadow: 0 8px 24px rgba(156,255,0,0.25);
        }
        .premium-badge {
          position:absolute; top:-3px; right:-3px;
          width:17px; height:17px; background:#000; border-radius:50%;
          display:flex; align-items:center; justify-content:center;
          border:2px solid #ffd700; box-shadow:0 0 8px rgba(255,215,0,.5);
        }
        .card-info { flex:1; min-width:0; }
        .card-name {
          font-size: 15px; font-weight: 800; margin-bottom: 5px;
          display:flex; align-items:center; gap:5px; color:#fff;
        }
        .card-stats {
          display:flex; align-items:center; gap:5px;
          color:#888; font-size:11px; font-weight:600;
        }
        .stat-item { display:flex; align-items:center; gap:3px; }
        .stat-item.online { color:#10b981; }
        .stat-divider { color:#333; }
        .online-pulse {
          width:6px; height:6px; border-radius:50%;
          background:#10b981; box-shadow:0 0 8px #10b981;
          animation: pulse 2s infinite;
        }

        .card-description {
          color:#777; font-size:12px; line-height:1.5; margin-bottom:10px;
          display:-webkit-box; -webkit-line-clamp:2;
          -webkit-box-orient:vertical; overflow:hidden;
        }

        .card-tags {
          display:flex; gap:5px; flex-wrap:wrap; margin-bottom:10px;
        }
        .tag {
          padding:3px 7px;
          background:rgba(156,255,0,0.08); border:1px solid rgba(156,255,0,0.18);
          border-radius:5px; color:#9cff00; font-size:10px; font-weight:600;
        }

        /* ── Card action buttons ── */
        .card-actions { display:flex; gap:7px; }

        .card-btn {
          flex:1; padding:9px 12px; border-radius:9px;
          font-size:12px; font-weight:700;
          cursor:pointer; border:none;
          transition:all 0.25s cubic-bezier(.4,0,.2,1);
          display:flex; align-items:center; justify-content:center; gap:5px;
          position:relative; overflow:hidden;
        }
        .card-btn::before {
          content:""; position:absolute; inset:0;
          background:linear-gradient(135deg,rgba(255,255,255,.08) 0%,transparent 100%);
          opacity:0; transition:opacity .25s;
        }
        .card-btn:hover::before { opacity:1; }

        .join-btn {
          background:linear-gradient(135deg,#9cff00 0%,#667eea 100%);
          color:#000; box-shadow:0 3px 12px rgba(156,255,0,.25);
        }
        .join-btn:hover {
          box-shadow:0 5px 18px rgba(156,255,0,.45);
          transform:translateY(-1px);
        }
        .joined-btn {
          background:rgba(156,255,0,0.12);
          border:1.5px solid rgba(156,255,0,0.35);
          color:#9cff00;
        }
        .preview-btn {
          background:rgba(22,22,22,0.9);
          border:1.5px solid rgba(42,42,42,0.9);
          color:#aaa;
        }
        .preview-btn:hover {
          border-color:rgba(102,126,234,0.4); color:#667eea;
          transform:translateY(-1px);
        }
        .view-btn {
          background:rgba(22,22,22,0.9);
          border:1.5px solid rgba(42,42,42,0.9);
          color:#aaa;
        }
        .view-btn:hover {
          border-color:rgba(156,255,0,0.4); color:#9cff00;
          transform:translateY(-1px);
        }

        /* ── Empty state ── */
        .empty-state {
          grid-column:1 / -1; text-align:center; padding:48px 20px;
        }
        .empty-icon {
          font-size:52px; margin-bottom:12px; opacity:.4;
          animation:float 3s ease-in-out infinite;
        }
        @keyframes float {
          0%,100% { transform:translateY(0);     }
          50%      { transform:translateY(-8px);  }
        }
        .empty-state h3 { font-size:18px; font-weight:800; color:#fff; margin-bottom:4px; }
        .empty-state p  { color:#555; font-size:13px; }

        /* ── Mobile tweaks ── */
        @media (max-width: 768px) {
          .discover-view { padding: 10px 12px 20px; }
          .communities-grid { grid-template-columns:1fr; gap:10px; }

          /* On very narrow screens hide text labels in control buttons */
          @media (max-width: 380px) {
            .ctrl-label { display:none; }
            .ctrl-btn   { padding:7px 8px; }
          }
        }
      `}</style>
    </>
  );
};

export default DiscoverTab;