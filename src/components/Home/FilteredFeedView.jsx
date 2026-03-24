// src/components/Home/FilteredFeedView.jsx
// Displays filtered content by tag (category) or creator — no new fetches, pure filter of existing data
import React, { useState, useMemo } from "react";
import { X, Flame, Crown, Image, Film, BookOpen, Search, ArrowLeft } from "lucide-react";
import PostCard from "./PostCard";
import ReelCard from "./ReelCard";
import StoryCard from "./StoryCard";

/**
 * Props:
 *  filter        — { type: 'tag' | 'creator', label, userId, username, avatar, name }
 *  posts         — full posts array from HomeView
 *  reels         — full reels array from HomeView
 *  stories       — full stories array from HomeView
 *  currentUser   — current authenticated user
 *  onClose       — callback to exit filtered view
 *  onAuthorClick — pass-through
 *  onActionMenu  — pass-through
 *  onComment     — pass-through
 *  onPostUpdate  — pass-through
 *  onPostDelete  — pass-through
 *  onReelUpdate  — pass-through
 *  onStoryUpdate — pass-through
 *  onUnlock      — pass-through (stories)
 */
const FilteredFeedView = ({
  filter,
  posts = [],
  reels = [],
  stories = [],
  currentUser,
  onClose,
  onAuthorClick,
  onActionMenu,
  onComment,
  onPostUpdate,
  onPostDelete,
  onReelUpdate,
  onStoryUpdate,
  onUnlock,
}) => {
  const [activeTab, setActiveTab] = useState("all");

  // ── Filter logic ──────────────────────────────────────────────────────────
  const filteredPosts = useMemo(() => {
    if (!filter) return [];
    if (filter.type === "tag") {
      return posts.filter(
        (p) =>
          !p.deleted_at &&
          (p.category?.toLowerCase() === filter.label?.toLowerCase() ||
            p.tags?.some((t) => t.toLowerCase() === filter.label?.toLowerCase()))
      );
    }
    if (filter.type === "creator") {
      return posts.filter(
        (p) => !p.deleted_at && (p.user_id === filter.userId || p.userId === filter.userId)
      );
    }
    return [];
  }, [filter, posts]);

  const filteredReels = useMemo(() => {
    if (!filter) return [];
    if (filter.type === "tag") {
      return reels.filter(
        (r) =>
          !r.deleted_at &&
          (r.category?.toLowerCase() === filter.label?.toLowerCase() ||
            r.tags?.some((t) => t.toLowerCase() === filter.label?.toLowerCase()))
      );
    }
    if (filter.type === "creator") {
      return reels.filter(
        (r) => !r.deleted_at && (r.user_id === filter.userId || r.userId === filter.userId)
      );
    }
    return [];
  }, [filter, reels]);

  const filteredStories = useMemo(() => {
    if (!filter) return [];
    if (filter.type === "tag") {
      return stories.filter(
        (s) =>
          !s.deleted_at &&
          (s.category?.toLowerCase() === filter.label?.toLowerCase() ||
            s.tags?.some((t) => t.toLowerCase() === filter.label?.toLowerCase()))
      );
    }
    if (filter.type === "creator") {
      return stories.filter(
        (s) => !s.deleted_at && (s.user_id === filter.userId || s.userId === filter.userId)
      );
    }
    return [];
  }, [filter, stories]);

  const allFiltered = useMemo(() => {
    // Interleave all content sorted by created_at desc
    const combined = [
      ...filteredPosts.map((p) => ({ ...p, _kind: "post" })),
      ...filteredReels.map((r) => ({ ...r, _kind: "reel" })),
      ...filteredStories.map((s) => ({ ...s, _kind: "story" })),
    ].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    return combined;
  }, [filteredPosts, filteredReels, filteredStories]);

  const totalCount = filteredPosts.length + filteredReels.length + filteredStories.length;

  // Which list to show
  const activeItems =
    activeTab === "all"
      ? allFiltered
      : activeTab === "posts"
      ? filteredPosts.map((p) => ({ ...p, _kind: "post" }))
      : activeTab === "reels"
      ? filteredReels.map((r) => ({ ...r, _kind: "reel" }))
      : filteredStories.map((s) => ({ ...s, _kind: "story" }));

  const tabs = [
    { key: "all", label: "All", count: totalCount },
    { key: "posts", label: "Posts", count: filteredPosts.length, icon: Image },
    { key: "reels", label: "Reels", count: filteredReels.length, icon: Film },
    { key: "stories", label: "Stories", count: filteredStories.length, icon: BookOpen },
  ].filter((t) => t.key === "all" || t.count > 0);

  return (
    <>
      <style>{`
        .ffv-root {
          position: fixed;
          inset: 0;
          z-index: 9500;
          background: #000;
          display: flex;
          flex-direction: column;
          animation: ffv-in 0.28s cubic-bezier(0.4,0,0.2,1);
        }

        @keyframes ffv-in {
          from { opacity: 0; transform: translateY(18px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        /* ── HEADER ── */
        .ffv-header {
          display: flex;
          align-items: center;
          gap: 14px;
          padding: 14px 20px;
          border-bottom: 1px solid rgba(132,204,22,0.18);
          background: rgba(0,0,0,0.96);
          backdrop-filter: blur(20px);
          flex-shrink: 0;
          position: sticky;
          top: 0;
          z-index: 10;
        }

        .ffv-back-btn {
          width: 40px;
          height: 40px;
          border-radius: 50%;
          background: rgba(255,255,255,0.06);
          border: 1px solid rgba(255,255,255,0.1);
          display: flex;
          align-items: center;
          justify-content: center;
          color: #fff;
          cursor: pointer;
          flex-shrink: 0;
          transition: all 0.18s;
        }
        .ffv-back-btn:hover { background: rgba(132,204,22,0.15); border-color: rgba(132,204,22,0.4); color: #84cc16; }

        .ffv-filter-pill {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 8px 16px;
          border-radius: 999px;
          font-size: 14px;
          font-weight: 700;
          flex: 1;
          min-width: 0;
        }

        .ffv-filter-pill.tag-pill {
          background: rgba(239,68,68,0.12);
          border: 1px solid rgba(239,68,68,0.3);
          color: #ef4444;
        }

        .ffv-filter-pill.creator-pill {
          background: rgba(251,191,36,0.1);
          border: 1px solid rgba(251,191,36,0.3);
          color: #fbbf24;
        }

        .ffv-pill-icon {
          flex-shrink: 0;
        }

        .ffv-pill-label {
          flex: 1;
          min-width: 0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .ffv-pill-count {
          font-size: 12px;
          opacity: 0.7;
          flex-shrink: 0;
        }

        .ffv-creator-avatar {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          background: linear-gradient(135deg,#84cc16,#65a30d);
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 900;
          font-size: 13px;
          color: #000;
          overflow: hidden;
          flex-shrink: 0;
          border: 2px solid rgba(251,191,36,0.5);
        }
        .ffv-creator-avatar img { width: 100%; height: 100%; object-fit: cover; }

        /* ── TABS ── */
        .ffv-tabs {
          display: flex;
          gap: 4px;
          padding: 12px 16px 0;
          border-bottom: 1px solid rgba(255,255,255,0.06);
          flex-shrink: 0;
          overflow-x: auto;
          scrollbar-width: none;
        }
        .ffv-tabs::-webkit-scrollbar { display: none; }

        .ffv-tab {
          display: flex;
          align-items: center;
          gap: 7px;
          padding: 8px 16px 10px;
          border: none;
          background: transparent;
          color: #737373;
          font-size: 13.5px;
          font-weight: 600;
          cursor: pointer;
          white-space: nowrap;
          border-bottom: 2px solid transparent;
          transition: all 0.18s;
          flex-shrink: 0;
        }
        .ffv-tab:hover { color: #a3a3a3; }
        .ffv-tab.active {
          color: #84cc16;
          border-bottom-color: #84cc16;
        }

        .ffv-tab-count {
          background: rgba(132,204,22,0.12);
          color: #84cc16;
          border-radius: 999px;
          padding: 1px 7px;
          font-size: 11px;
          font-weight: 800;
          min-width: 20px;
          text-align: center;
        }
        .ffv-tab:not(.active) .ffv-tab-count {
          background: rgba(255,255,255,0.06);
          color: #737373;
        }

        /* ── CONTENT ── */
        .ffv-content {
          flex: 1;
          overflow-y: auto;
          padding: 20px 16px;
        }
        .ffv-content::-webkit-scrollbar { width: 4px; }
        .ffv-content::-webkit-scrollbar-thumb { background: rgba(132,204,22,0.3); border-radius: 2px; }

        /* Desktop: wider layout */
        @media (min-width: 768px) {
          .ffv-content {
            max-width: 800px;
            margin: 0 auto;
            padding: 24px 0;
          }
        }

        /* ── EMPTY ── */
        .ffv-empty {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 80px 20px;
          text-align: center;
          gap: 14px;
          color: #737373;
        }
        .ffv-empty-icon { font-size: 56px; opacity: 0.4; }
        .ffv-empty-title { font-size: 17px; font-weight: 700; color: #a3a3a3; margin: 0; }
        .ffv-empty-sub { font-size: 13px; margin: 0; }

        /* ── REELS GRID (inside filter view) ── */
        .ffv-reels-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
          gap: 16px;
        }
        @media (max-width: 600px) {
          .ffv-reels-grid { grid-template-columns: 1fr; gap: 0; }
        }

        /* ── MIXED FEED ── */
        .ffv-mixed-item + .ffv-mixed-item { margin-top: 0; }
        .ffv-kind-label {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 11px;
          font-weight: 800;
          color: #737373;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          padding: 12px 0 4px;
        }

        /* ── DESKTOP LAYOUT ── */
        @media (min-width: 1024px) {
          .ffv-root {
            left: auto;
            right: 0;
            /* Take up the main content area only, respecting sidebar */
            width: calc(100% - 260px); /* adjust to match your sidebar width */
          }
        }
      `}</style>

      <div className="ffv-root">
        {/* HEADER */}
        <div className="ffv-header">
          <button className="ffv-back-btn" onClick={onClose} aria-label="Back">
            <ArrowLeft size={20} />
          </button>

          {filter?.type === "tag" ? (
            <div className="ffv-filter-pill tag-pill">
              <Flame size={16} className="ffv-pill-icon" />
              <span className="ffv-pill-label">#{filter.label}</span>
              <span className="ffv-pill-count">{totalCount} results</span>
            </div>
          ) : (
            <div className="ffv-filter-pill creator-pill">
              <div className="ffv-creator-avatar">
                {filter?.avatar && typeof filter.avatar === "string" && filter.avatar.startsWith("http") ? (
                  <img src={filter.avatar} alt={filter.name} />
                ) : (
                  filter?.name?.charAt(0) || "?"
                )}
              </div>
              <span className="ffv-pill-label">@{filter?.username || filter?.name}</span>
              <span className="ffv-pill-count">{totalCount} results</span>
            </div>
          )}
        </div>

        {/* TABS — only show tabs with content */}
        {tabs.length > 1 && (
          <div className="ffv-tabs">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.key}
                  className={`ffv-tab${activeTab === tab.key ? " active" : ""}`}
                  onClick={() => setActiveTab(tab.key)}
                >
                  {Icon && <Icon size={14} />}
                  {tab.label}
                  <span className="ffv-tab-count">{tab.count}</span>
                </button>
              );
            })}
          </div>
        )}

        {/* CONTENT */}
        <div className="ffv-content">
          {activeItems.length === 0 ? (
            <div className="ffv-empty">
              <div className="ffv-empty-icon">
                {filter?.type === "tag" ? "🔥" : "👤"}
              </div>
              <p className="ffv-empty-title">
                {filter?.type === "tag"
                  ? `No content tagged "${filter.label}" in the current feed`
                  : `No content from @${filter?.username} in the current feed`}
              </p>
              <p className="ffv-empty-sub">
                Content may not be loaded yet — try refreshing the main feed first.
              </p>
            </div>
          ) : activeTab === "reels" ? (
            // Reels use grid layout
            <div className="ffv-reels-grid">
              {activeItems.map((item) => (
                <ReelCard
                  key={item.id}
                  reel={item}
                  currentUser={currentUser}
                  onAuthorClick={onAuthorClick}
                  onActionMenu={onActionMenu}
                  onOpenFullScreen={() => {}} // TODO: wire fullscreen if needed
                />
              ))}
            </div>
          ) : (
            // Posts, stories, or mixed "all" feed
            <div>
              {activeItems.map((item) => {
                const kind = item._kind;

                if (kind === "post") {
                  return (
                    <div key={item.id} className="ffv-mixed-item">
                      {activeTab === "all" && (
                        <div className="ffv-kind-label">
                          <Image size={11} /> Post
                        </div>
                      )}
                      <PostCard
                        post={item}
                        currentUser={currentUser}
                        onAuthorClick={onAuthorClick}
                        onActionMenu={onActionMenu}
                        onComment={onComment}
                        onPostUpdate={onPostUpdate}
                        onPostDelete={onPostDelete}
                      />
                    </div>
                  );
                }

                if (kind === "reel") {
                  return (
                    <div key={item.id} className="ffv-mixed-item">
                      {activeTab === "all" && (
                        <div className="ffv-kind-label">
                          <Film size={11} /> Reel
                        </div>
                      )}
                      <ReelCard
                        reel={item}
                        currentUser={currentUser}
                        onAuthorClick={onAuthorClick}
                        onActionMenu={onActionMenu}
                        onOpenFullScreen={() => {}}
                      />
                    </div>
                  );
                }

                if (kind === "story") {
                  return (
                    <div key={item.id} className="ffv-mixed-item">
                      {activeTab === "all" && (
                        <div className="ffv-kind-label">
                          <BookOpen size={11} /> Story
                        </div>
                      )}
                      <StoryCard
                        story={item}
                        currentUser={currentUser}
                        onAuthorClick={onAuthorClick}
                        onActionMenu={onActionMenu}
                        onComment={onComment}
                        onUnlock={onUnlock}
                        onStoryUpdate={onStoryUpdate}
                      />
                    </div>
                  );
                }

                return null;
              })}
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default FilteredFeedView;