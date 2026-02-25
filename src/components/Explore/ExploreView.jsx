// ============================================================================
// src/components/Explore/ExploreView.jsx
// ============================================================================

import React, { useState, useEffect, useRef } from "react";
import {
  Search,
  Filter,
  ChevronDown,
  X,
  Loader,
  Hash,
  AtSign,
  User,
  ChevronRight,
  BookOpen,
  Film,
  FileText,
} from "lucide-react";
import exploreService from "../../services/explore/exploreService";
import mediaUrlService from "../../services/shared/mediaUrlService";
import PostCard from "../Home/PostCard";
import ReelCard from "../Home/ReelCard";
import StoryCard from "../Home/StoryCard";

// ── Tiny sub-section header ───────────────────────────────────────────────────
const SubSection = ({ icon: Icon, label, count, children }) => {
  const [open, setOpen] = useState(true);
  if (!count) return null;
  return (
    <div className="xpl-subsection">
      <button className="xpl-subsection-hd" onClick={() => setOpen((o) => !o)}>
        <span className="xpl-subsection-left">
          <Icon size={15} />
          {label}
          <span className="xpl-badge">{count}</span>
        </span>
        <ChevronRight
          size={14}
          style={{
            transform: open ? "rotate(90deg)" : "none",
            transition: "transform .2s",
          }}
        />
      </button>
      {open && <div className="xpl-subsection-body">{children}</div>}
    </div>
  );
};

// ── User context panel (shown when a real user name is found) ─────────────────
const UserContextPanel = ({
  userContext,
  currentUser,
  onAuthorClick,
  onActionMenu,
}) => {
  const [activeTab, setActiveTab] = useState("mentioned");
  if (!userContext) return null;

  const {
    resolvedUser,
    mentionedInPosts,
    mentionedInReels,
    mentionedInStories,
    totalMentions,
    byUser,
    totalAuthored,
  } = userContext;

  const mentionedTotal =
    (mentionedInPosts?.length || 0) +
    (mentionedInReels?.length || 0) +
    (mentionedInStories?.length || 0);
  const authoredTotal =
    (byUser?.posts?.length || 0) +
    (byUser?.reels?.length || 0) +
    (byUser?.stories?.length || 0);

  if (mentionedTotal === 0 && authoredTotal === 0) return null;

  const avatarUrl = resolvedUser.avatar_id
    ? mediaUrlService.getAvatarUrl(resolvedUser.avatar_id)
    : null;

  return (
    <div className="xpl-user-ctx">
      {/* User identity strip */}
      <div
        className="xpl-ctx-identity"
        onClick={() => onAuthorClick?.(resolvedUser.id)}
      >
        <div className="xpl-ctx-avatar">
          {avatarUrl ? (
            <img src={avatarUrl} alt={resolvedUser.full_name} />
          ) : (
            resolvedUser.full_name?.[0]?.toUpperCase() || "U"
          )}
        </div>
        <div className="xpl-ctx-info">
          <div className="xpl-ctx-name">
            {resolvedUser.full_name}
            {resolvedUser.verified && <span className="xpl-verified">✓</span>}
          </div>
          <div className="xpl-ctx-un">@{resolvedUser.username}</div>
          {resolvedUser.bio && (
            <div className="xpl-ctx-bio">{resolvedUser.bio}</div>
          )}
        </div>
        <div className="xpl-ctx-stats">
          {mentionedTotal > 0 && (
            <span className="xpl-ctx-stat">
              <span>{mentionedTotal}</span> mentions
            </span>
          )}
          {authoredTotal > 0 && (
            <span className="xpl-ctx-stat">
              <span>{authoredTotal}</span> posts
            </span>
          )}
        </div>
      </div>

      {/* Tab switcher */}
      <div className="xpl-ctx-tabs">
        {mentionedTotal > 0 && (
          <button
            className={`xpl-ctx-tab ${activeTab === "mentioned" ? "active" : ""}`}
            onClick={() => setActiveTab("mentioned")}
          >
            Mentioned in ({mentionedTotal})
          </button>
        )}
        {authoredTotal > 0 && (
          <button
            className={`xpl-ctx-tab ${activeTab === "authored" ? "active" : ""}`}
            onClick={() => setActiveTab("authored")}
          >
            Posted by them ({authoredTotal})
          </button>
        )}
      </div>

      {/* Content */}
      <div className="xpl-ctx-content">
        {activeTab === "mentioned" && (
          <>
            {mentionedInPosts?.length > 0 && (
              <SubSection
                icon={FileText}
                label="Posts"
                count={mentionedInPosts.length}
              >
                {mentionedInPosts.map((p) => (
                  <PostCard
                    key={p.id}
                    post={p}
                    currentUser={currentUser}
                    onAuthorClick={onAuthorClick}
                    onActionMenu={onActionMenu}
                  />
                ))}
              </SubSection>
            )}
            {mentionedInReels?.length > 0 && (
              <SubSection
                icon={Film}
                label="Reels"
                count={mentionedInReels.length}
              >
                <div className="xpl-reels-grid">
                  {mentionedInReels.map((r, i) => (
                    <ReelCard
                      key={r.id}
                      reel={r}
                      currentUser={currentUser}
                      onAuthorClick={onAuthorClick}
                      onActionMenu={onActionMenu}
                      index={i}
                    />
                  ))}
                </div>
              </SubSection>
            )}
            {mentionedInStories?.length > 0 && (
              <SubSection
                icon={BookOpen}
                label="Stories"
                count={mentionedInStories.length}
              >
                {mentionedInStories.map((s) => (
                  <StoryCard
                    key={s.id}
                    story={s}
                    currentUser={currentUser}
                    onAuthorClick={onAuthorClick}
                    onActionMenu={onActionMenu}
                  />
                ))}
              </SubSection>
            )}
          </>
        )}

        {activeTab === "authored" && (
          <>
            {byUser?.posts?.length > 0 && (
              <SubSection
                icon={FileText}
                label="Posts"
                count={byUser.posts.length}
              >
                {byUser.posts.map((p) => (
                  <PostCard
                    key={p.id}
                    post={p}
                    currentUser={currentUser}
                    onAuthorClick={onAuthorClick}
                    onActionMenu={onActionMenu}
                  />
                ))}
              </SubSection>
            )}
            {byUser?.reels?.length > 0 && (
              <SubSection icon={Film} label="Reels" count={byUser.reels.length}>
                <div className="xpl-reels-grid">
                  {byUser.reels.map((r, i) => (
                    <ReelCard
                      key={r.id}
                      reel={r}
                      currentUser={currentUser}
                      onAuthorClick={onAuthorClick}
                      onActionMenu={onActionMenu}
                      index={i}
                    />
                  ))}
                </div>
              </SubSection>
            )}
            {byUser?.stories?.length > 0 && (
              <SubSection
                icon={BookOpen}
                label="Stories"
                count={byUser.stories.length}
              >
                {byUser.stories.map((s) => (
                  <StoryCard
                    key={s.id}
                    story={s}
                    currentUser={currentUser}
                    onAuthorClick={onAuthorClick}
                    onActionMenu={onActionMenu}
                  />
                ))}
              </SubSection>
            )}
          </>
        )}
      </div>
    </div>
  );
};

// ── Main ExploreView ──────────────────────────────────────────────────────────
const ExploreView = ({ currentUser, userId, onAuthorClick, onActionMenu }) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [activeTab, setActiveTab] = useState("all");
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
    userContext: null,
    searchType: null,
  });

  const searchRef = useRef(null);
  const tabsRef = useRef(null);
  const filterRef = useRef(null);

  const tabs = [
    { id: "all", label: "All" },
    { id: "stories", label: "Stories" },
    { id: "posts", label: "Posts" },
    { id: "reels", label: "Reels" },
    { id: "users", label: "People" },
    { id: "tags", label: "Tags" },
  ];

  const categories = [
    "All",
    "Folklore",
    "Life Journey",
    "Philosophy",
    "Innovation",
    "Romance",
    "Adventure",
    "Mystery",
    "Wisdom",
    "Entertainment",
  ];

  useEffect(() => {
    const handler = (e) => {
      if (searchRef.current && !searchRef.current.contains(e.target))
        setShowSearchPanel(false);
      if (tabsRef.current && !tabsRef.current.contains(e.target))
        setShowTabsPanel(false);
      if (filterRef.current && !filterRef.current.contains(e.target))
        setShowFilterPanel(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    if (!searchQuery) loadContent();
  }, [activeTab, selectedCategory]);

  useEffect(() => {
    if (searchQuery.length >= 2) {
      const t = setTimeout(performSearch, 350);
      return () => clearTimeout(t);
    }
    if (searchQuery.length === 0) loadContent();
  }, [searchQuery]);

  const loadContent = async () => {
    try {
      setLoading(true);
      const data = await exploreService.getTrending(activeTab, 50, userId);
      setContent({ ...data, userContext: null, searchType: null });
    } catch (err) {
      console.error("Failed to load:", err);
    } finally {
      setLoading(false);
    }
  };

  const performSearch = async () => {
    try {
      setLoading(true);
      const results = await exploreService.searchAll(
        searchQuery,
        { category: selectedCategory === "All" ? null : selectedCategory },
        userId,
      );
      setContent(results);
    } catch (err) {
      console.error("Search failed:", err);
    } finally {
      setLoading(false);
    }
  };

  const getDisplayContent = () => {
    const {
      stories = [],
      posts = [],
      reels = [],
      users = [],
      tags = [],
      mentions = [],
    } = content;
    switch (activeTab) {
      case "stories":
        return {
          stories,
          posts: [],
          reels: [],
          users: [],
          tags: [],
          mentions: [],
        };
      case "posts":
        return {
          stories: [],
          posts,
          reels: [],
          users: [],
          tags: [],
          mentions: [],
        };
      case "reels":
        return {
          stories: [],
          posts: [],
          reels,
          users: [],
          tags: [],
          mentions: [],
        };
      case "users":
        return {
          stories: [],
          posts: [],
          reels: [],
          users,
          tags: [],
          mentions: [],
        };
      case "tags":
        return {
          stories: [],
          posts: [],
          reels: [],
          users: [],
          tags,
          mentions: [],
        };
      default:
        return { stories, posts, reels, users, tags, mentions };
    }
  };

  const displayContent = getDisplayContent();
  const totalCount =
    (displayContent.stories?.length || 0) +
    (displayContent.posts?.length || 0) +
    (displayContent.reels?.length || 0) +
    (displayContent.users?.length || 0) +
    (displayContent.tags?.length || 0);

  const currentTabLabel =
    tabs.find((t) => t.id === activeTab)?.label || "All Content";

  const getSearchTypeInfo = () => {
    if (!searchQuery) return null;
    if (searchQuery.startsWith("#"))
      return { icon: Hash, text: "Hashtag", color: "#3b82f6" };
    if (searchQuery.startsWith("@"))
      return { icon: AtSign, text: "Mention", color: "#ec4899" };
    return { icon: Search, text: "General", color: "#84cc16" };
  };
  const sti = getSearchTypeInfo();

  const getAvatarEl = (user) => {
    if (user.avatar_id) {
      const url = mediaUrlService.getAvatarUrl(user.avatar_id);
      if (url) return <img src={url} alt={user.full_name} />;
    }
    return user.full_name?.[0]?.toUpperCase() || "U";
  };

  return (
    <>
      <style>{`
        .xpl-wrapper { max-width: 1200px; margin: 0 auto; }

        /* ── Header ── */
        .xpl-header {
          position: sticky; top: 0; background: #000; z-index: 100;
          border-bottom: 1px solid rgba(132,204,22,.12);
        }
        .xpl-controls { display:flex; align-items:center; gap:6px; padding:6px 10px; }
        .xpl-btn {
          display:flex; align-items:center; gap:6px; padding:7px 12px;
          background:transparent; border:1px solid rgba(132,204,22,.25);
          border-radius:6px; color:#84cc16; font-size:13px; font-weight:600;
          cursor:pointer; transition:all .12s;
        }
        .xpl-btn:hover   { background:rgba(132,204,22,.06); border-color:rgba(132,204,22,.4); }
        .xpl-btn.active  { background:rgba(132,204,22,.12); border-color:#84cc16; }
        .xpl-tabs-btn    { flex:1; justify-content:space-between; }

        /* ── Search dropdown ── */
        .xpl-search-dd {
          width:100%; position:absolute!important; top:calc(100% + 5px)!important;
          left:0!important; right:0!important; display:flex!important; flex-direction:column;
          gap:8px; background:#000!important; border:1.5px solid rgba(132,204,22,.3)!important;
          border-radius:0 0 12px 12px!important; padding:12px 16px!important;
          box-shadow:0 10px 40px rgba(0,0,0,.95)!important; animation:dropIn .15s ease!important; z-index:200!important;
        }
        .xpl-search-dd:focus-within {
          border-color:#84cc16!important;
          box-shadow:0 0 0 3px rgba(132,204,22,.12),0 10px 40px rgba(0,0,0,.95)!important;
        }
        .xpl-search-input-wrap { display:flex; align-items:center; gap:12px; }
        .xpl-search-input { flex:1; background:none; border:none; color:#fff; font-size:14px; outline:none; font-weight:500; }
        .xpl-search-input::placeholder { color:#555; }
        .xpl-search-type-badge {
          display:inline-flex; align-items:center; gap:4px; padding:4px 8px;
          background:rgba(132,204,22,.1); border:1px solid rgba(132,204,22,.25);
          border-radius:4px; font-size:11px; font-weight:600; color:#84cc16;
        }
        .xpl-clear {
          background:none; border:1px solid #444; color:#5e5e5e; cursor:pointer;
          padding:5px; display:flex; transition:all .12s; border-radius:4px;
        }
        .xpl-clear:hover { color:lime; transform:scale(1.1); }
        .xpl-search-hint { font-size:11px; color:#666; padding:0 4px; }
        .xpl-search-hint strong { color:#84cc16; }

        /* ── Tabs dropdown ── */
        .xpl-tabs-dd {
          position:absolute; top:calc(100% + 4px); left:10px; right:10px;
          background:#0a0a0a; border:1px solid rgba(132,204,22,.2); border-radius:10px;
          padding:8px; box-shadow:0 12px 48px rgba(0,0,0,.9); animation:dropIn .15s ease; z-index:150;
        }
        .xpl-tab-opt {
          padding:10px 14px; background:transparent; border:none; border-radius:6px;
          color:#fff; font-size:13px; font-weight:600; cursor:pointer; transition:all .12s; width:100%; text-align:left;
        }
        .xpl-tab-opt:hover  { background:rgba(132,204,22,.08); }
        .xpl-tab-opt.active { background:rgba(132,204,22,.15); color:#84cc16; }

        /* ── Filter dropdown ── */
        .xpl-filter-dd {
          position:absolute; top:calc(100% + 4px); right:10px; background:#0a0a0a;
          border:1px solid rgba(132,204,22,.2); border-radius:10px; padding:12px;
          min-width:260px; box-shadow:0 12px 48px rgba(0,0,0,.9); animation:dropIn .15s ease; z-index:150;
        }
        .xpl-filter-label { font-size:10px; font-weight:700; color:#84cc16; text-transform:uppercase; letter-spacing:.6px; margin-bottom:8px; }
        .xpl-cat-grid { display:grid; grid-template-columns:repeat(2,1fr); gap:5px; }
        .xpl-cat-btn {
          padding:7px 10px; background:transparent; border:1px solid rgba(132,204,22,.15);
          border-radius:5px; color:#fff; font-size:11px; font-weight:600; cursor:pointer; transition:all .12s; text-align:center;
        }
        .xpl-cat-btn:hover  { background:rgba(132,204,22,.06); border-color:rgba(132,204,22,.3); }
        .xpl-cat-btn.active { background:#84cc16; color:#000; border-color:#84cc16; }

        /* ── Content area ── */
        .xpl-content { padding:10px; }
        .xpl-results { margin-bottom:12px; padding:0 2px; font-size:13px; color:#666; }
        .xpl-results strong { color:#84cc16; font-weight:700; }
        .xpl-section { margin-bottom:24px; }
        .xpl-section-title {
          font-size:15px; font-weight:700; color:#fff; margin:0 0 10px 2px;
          display:flex; align-items:center; gap:6px;
        }
        .xpl-badge { font-size:12px; color:#84cc16; font-weight:600; }

        /* ── User cards ── */
        .xpl-user-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(280px,1fr)); gap:10px; }
        .xpl-user-card {
          background:rgba(132,204,22,.03); border:1px solid rgba(132,204,22,.15);
          border-radius:8px; padding:12px; display:flex; align-items:center; gap:12px;
          cursor:pointer; transition:all .15s;
        }
        .xpl-user-card:hover { background:rgba(132,204,22,.08); border-color:rgba(132,204,22,.3); transform:translateY(-2px); }
        .xpl-user-avatar {
          width:48px; height:48px; border-radius:50%;
          background:linear-gradient(135deg,#84cc16,#65a30d);
          display:flex; align-items:center; justify-content:center;
          color:#000; font-weight:700; font-size:18px; flex-shrink:0; overflow:hidden;
        }
        .xpl-user-avatar img { width:100%; height:100%; border-radius:50%; object-fit:cover; }
        .xpl-user-info { flex:1; min-width:0; }
        .xpl-user-name { font-size:14px; font-weight:700; color:#fff; display:flex; align-items:center; gap:4px; margin-bottom:2px; }
        .xpl-verified  { color:#84cc16; font-size:14px; }
        .xpl-user-username { font-size:12px; color:#666; }
        .xpl-user-bio { font-size:11px; color:#888; margin-top:4px; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; }

        /* ── Tag cards ── */
        .xpl-tag-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(200px,1fr)); gap:10px; }
        .xpl-tag-card {
          background:rgba(59,130,246,.05); border:1px solid rgba(59,130,246,.2);
          border-radius:8px; padding:12px 14px; cursor:pointer; transition:all .15s;
        }
        .xpl-tag-card:hover { background:rgba(59,130,246,.1); border-color:rgba(59,130,246,.4); transform:translateY(-2px); }
        .xpl-tag-name { font-size:15px; font-weight:700; color:#3b82f6; margin-bottom:4px; display:flex; align-items:center; gap:6px; }
        .xpl-tag-count { font-size:12px; color:#666; }

        /* ── Reels grid ── */
        .xpl-reels-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(300px,1fr)); gap:14px; }

        /* ── USER CONTEXT PANEL ── */
        .xpl-user-ctx {
          background:rgba(132,204,22,.02);
          border:1px solid rgba(132,204,22,.2);
          border-radius:12px;
          margin-bottom:24px;
          overflow:hidden;
        }
        .xpl-ctx-identity {
          display:flex; align-items:center; gap:14px; padding:16px;
          cursor:pointer; transition:background .15s;
          border-bottom:1px solid rgba(132,204,22,.1);
        }
        .xpl-ctx-identity:hover { background:rgba(132,204,22,.04); }
        .xpl-ctx-avatar {
          width:56px; height:56px; border-radius:50%; flex-shrink:0; overflow:hidden;
          background:linear-gradient(135deg,#84cc16,#65a30d);
          display:flex; align-items:center; justify-content:center;
          color:#000; font-weight:800; font-size:20px;
          border:2px solid rgba(132,204,22,.4);
        }
        .xpl-ctx-avatar img { width:100%; height:100%; object-fit:cover; }
        .xpl-ctx-info { flex:1; min-width:0; }
        .xpl-ctx-name { font-size:15px; font-weight:700; color:#fff; display:flex; align-items:center; gap:5px; }
        .xpl-ctx-un   { font-size:12px; color:#666; margin-top:2px; }
        .xpl-ctx-bio  { font-size:11px; color:#888; margin-top:4px; }
        .xpl-ctx-stats { display:flex; flex-direction:column; gap:4px; text-align:right; flex-shrink:0; }
        .xpl-ctx-stat { font-size:11px; color:#666; }
        .xpl-ctx-stat span { color:#84cc16; font-weight:700; font-size:13px; margin-right:3px; }

        .xpl-ctx-tabs {
          display:flex; border-bottom:1px solid rgba(132,204,22,.1);
          background:rgba(0,0,0,.3);
        }
        .xpl-ctx-tab {
          flex:1; padding:10px; background:transparent; border:none;
          color:#666; font-size:12px; font-weight:600; cursor:pointer; transition:all .15s;
        }
        .xpl-ctx-tab:hover  { color:#fff; }
        .xpl-ctx-tab.active { color:#84cc16; border-bottom:2px solid #84cc16; }

        .xpl-ctx-content { padding:12px; }

        /* ── Sub-sections (collapsible) ── */
        .xpl-subsection { margin-bottom:16px; }
        .xpl-subsection-hd {
          width:100%; display:flex; align-items:center; justify-content:space-between;
          background:rgba(132,204,22,.04); border:1px solid rgba(132,204,22,.12);
          border-radius:8px; padding:9px 12px; cursor:pointer; transition:all .15s;
          margin-bottom:10px; color:#fff;
        }
        .xpl-subsection-hd:hover { background:rgba(132,204,22,.08); }
        .xpl-subsection-left { display:flex; align-items:center; gap:8px; font-size:13px; font-weight:600; color:#84cc16; }
        .xpl-subsection-body { }

        /* ── States ── */
        .xpl-loading { display:flex; flex-direction:column; align-items:center; justify-content:center; padding:60px 20px; gap:10px; }
        .xpl-spinner { animation:spin .9s linear infinite; color:#84cc16; }
        .xpl-loading-text { font-size:13px; color:#666; }
        .xpl-empty { text-align:center; padding:60px 20px; }
        .xpl-empty-icon  { font-size:48px; margin-bottom:10px; opacity:.25; }
        .xpl-empty-title { font-size:16px; font-weight:700; color:#fff; margin:0 0 5px 0; }
        .xpl-empty-text  { font-size:13px; color:#666; }

        @keyframes dropIn { from{opacity:0;transform:translateY(-10px)} to{opacity:1;transform:translateY(0)} }
        @keyframes spin   { to{transform:rotate(360deg)} }

        @media (max-width:768px) {
          .xpl-controls { gap:4px; padding:5px 8px; }
          .xpl-btn { padding:6px 10px; font-size:12px; }
          .xpl-tabs-btn span { max-width:100px; overflow:hidden; text-overflow:ellipsis; }
          .xpl-filter-dd { position:fixed; top:auto; bottom:0; left:0; right:0; border-radius:14px 14px 0 0; max-height:65vh; overflow-y:auto; }
          .xpl-reels-grid { grid-template-columns:1fr; }
          .xpl-user-grid  { grid-template-columns:1fr; }
          .xpl-tag-grid   { grid-template-columns:1fr; }
          .xpl-ctx-identity { flex-wrap:wrap; }
          .xpl-ctx-stats { flex-direction:row; gap:8px; text-align:left; width:100%; }
        }
      `}</style>

      <div className="xpl-wrapper">
        {/* ── HEADER ───────────────────────────────────────────────────────── */}
        <div className="xpl-header">
          <div className="xpl-controls">
            {/* Search */}
            <div
              ref={searchRef}
              style={{ position: "relative", width: "100%" }}
            >
              <button
                className={`xpl-btn ${showSearchPanel ? "active" : ""}`}
                onClick={() => {
                  setShowSearchPanel((p) => !p);
                  setShowTabsPanel(false);
                  setShowFilterPanel(false);
                }}
              >
                <Search size={15} /> Search
              </button>
              {showSearchPanel && (
                <div className="xpl-search-dd">
                  <div className="xpl-search-input-wrap">
                    {sti ? (
                      <sti.icon size={18} style={{ color: sti.color }} />
                    ) : (
                      <Search size={18} style={{ color: "#84cc16" }} />
                    )}
                    <input
                      type="text"
                      placeholder="Search stories, posts, reels, people, #tags..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="xpl-search-input"
                      autoFocus
                    />
                    {searchQuery && (
                      <button
                        className="xpl-clear"
                        onClick={() => setSearchQuery("")}
                      >
                        <X size={16} />
                      </button>
                    )}
                  </div>
                  {sti && (
                    <div className="xpl-search-type-badge">
                      <sti.icon size={12} /> {sti.text} Search
                    </div>
                  )}
                  <div className="xpl-search-hint">
                    💡 Try: <strong>#storytelling</strong> for tags ·{" "}
                    <strong>@username</strong> for people · or just type a name
                  </div>
                </div>
              )}
            </div>

            {/* Tabs */}
            <div ref={tabsRef} style={{ position: "relative", flex: 1 }}>
              <button
                className={`xpl-btn xpl-tabs-btn ${showTabsPanel ? "active" : ""}`}
                onClick={() => {
                  setShowTabsPanel((p) => !p);
                  setShowSearchPanel(false);
                  setShowFilterPanel(false);
                }}
              >
                <span>{currentTabLabel}</span>
                <ChevronDown size={15} />
              </button>
              {showTabsPanel && (
                <div className="xpl-tabs-dd">
                  {tabs.map((tab) => (
                    <button
                      key={tab.id}
                      className={`xpl-tab-opt ${activeTab === tab.id ? "active" : ""}`}
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

            {/* Filter */}
            <div ref={filterRef} style={{ position: "relative" }}>
              <button
                className={`xpl-btn ${showFilterPanel ? "active" : ""}`}
                onClick={() => {
                  setShowFilterPanel((p) => !p);
                  setShowSearchPanel(false);
                  setShowTabsPanel(false);
                }}
              >
                <Filter size={15} /> Filter
              </button>
              {showFilterPanel && (
                <div className="xpl-filter-dd">
                  <div className="xpl-filter-label">Category</div>
                  <div className="xpl-cat-grid">
                    {categories.map((cat) => (
                      <button
                        key={cat}
                        className={`xpl-cat-btn ${selectedCategory === cat ? "active" : ""}`}
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

        {/* ── CONTENT ──────────────────────────────────────────────────────── */}
        <div className="xpl-content">
          {loading ? (
            <div className="xpl-loading">
              <Loader size={32} className="xpl-spinner" />
              <p className="xpl-loading-text">
                {searchQuery ? "Searching..." : "Loading..."}
              </p>
            </div>
          ) : totalCount === 0 && !content.userContext ? (
            <div className="xpl-empty">
              <div className="xpl-empty-icon">{searchQuery ? "🔍" : "📭"}</div>
              <h3 className="xpl-empty-title">
                {searchQuery ? "No results found" : "No content available"}
              </h3>
              <p className="xpl-empty-text">
                {searchQuery
                  ? "Try different keywords, #tags, or @mentions"
                  : "Check back later"}
              </p>
            </div>
          ) : (
            <>
              {searchQuery && (
                <div className="xpl-results">
                  Found <strong>{totalCount}</strong> result
                  {totalCount !== 1 ? "s" : ""}
                  {content.searchType && ` · ${content.searchType} search`}
                </div>
              )}

              {/* ── USER CONTEXT — always first when a real user was resolved ── */}
              {content.userContext && (
                <UserContextPanel
                  userContext={content.userContext}
                  currentUser={currentUser}
                  onAuthorClick={onAuthorClick}
                  onActionMenu={onActionMenu}
                />
              )}

              {/* ── PEOPLE ── */}
              {displayContent.users?.length > 0 && (
                <div className="xpl-section">
                  <h2 className="xpl-section-title">
                    <User size={18} /> People{" "}
                    <span className="xpl-badge">
                      {displayContent.users.length}
                    </span>
                  </h2>
                  <div className="xpl-user-grid">
                    {displayContent.users.map((user) => (
                      <div
                        key={user.id}
                        className="xpl-user-card"
                        onClick={() => onAuthorClick?.(user.id)}
                      >
                        <div className="xpl-user-avatar">
                          {getAvatarEl(user)}
                        </div>
                        <div className="xpl-user-info">
                          <div className="xpl-user-name">
                            {user.full_name}
                            {user.verified && (
                              <span className="xpl-verified">✓</span>
                            )}
                          </div>
                          <div className="xpl-user-username">
                            @{user.username}
                          </div>
                          {user.bio && (
                            <div className="xpl-user-bio">{user.bio}</div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ── TAGS ── */}
              {displayContent.tags?.length > 0 && (
                <div className="xpl-section">
                  <h2 className="xpl-section-title">
                    <Hash size={18} /> Tags{" "}
                    <span className="xpl-badge">
                      {displayContent.tags.length}
                    </span>
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
                          {tag.tag.replace("#", "")}
                        </div>
                        <div className="xpl-tag-count">
                          {tag.count} {tag.count === 1 ? "post" : "posts"}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ── STORIES ── */}
              {displayContent.stories?.length > 0 && (
                <div className="xpl-section">
                  <h2 className="xpl-section-title">
                    Stories{" "}
                    <span className="xpl-badge">
                      {displayContent.stories.length}
                    </span>
                  </h2>
                  {displayContent.stories.map((story) => (
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

              {/* ── POSTS ── */}
              {displayContent.posts?.length > 0 && (
                <div className="xpl-section">
                  <h2 className="xpl-section-title">
                    Posts{" "}
                    <span className="xpl-badge">
                      {displayContent.posts.length}
                    </span>
                  </h2>
                  {displayContent.posts.map((post) => (
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

              {/* ── REELS ── */}
              {displayContent.reels?.length > 0 && (
                <div className="xpl-section">
                  <h2 className="xpl-section-title">
                    Reels{" "}
                    <span className="xpl-badge">
                      {displayContent.reels.length}
                    </span>
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
