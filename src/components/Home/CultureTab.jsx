// src/components/Home/CultureTab.jsx — v1 AFRICA FIRST + WORLD CULTURE HUB
//
// ═══════════════════════════════════════════════════════════════════════════
// POWERFUL CULTURE DISCOVERY:
//
// [CULTURE-1]  Africa-first approach: categories prioritize African culture,
//              traditions, history, art, music, food, festivals, languages.
//
// [CULTURE-2]  World culture section: expands to global traditions after
//              African categories. Similar engagement-driven discovery.
//
// [CULTURE-3]  Beautiful category pills with emoji + name. Scroll arrows
//              on desktop for easy navigation.
//
// [CULTURE-4]  Each category shows infinite stream of posts/reels/stories
//              focused on that cultural theme.
//
// [CULTURE-5]  Trending section: most engaged culture content this week.
//              Shows cross-category trending topics.
// ═══════════════════════════════════════════════════════════════════════════

import React, { useState, useEffect, useRef, useCallback } from "react";
import { Compass, ChevronDown } from "lucide-react";
import SectionHeader from "../Shared/SectionHeader";
import PostCard from "./PostCard";
import ReelCard from "./ReelCard";
import UnifiedLoader from "../Shared/UnifiedLoader";
import cultureService from "../../services/explore/cultureService";

// ─── Culture categories — Africa first, then world ────────────────────────────
const CULTURE_CATEGORIES = [
  { id: "trending", emoji: "🔥", name: "Trending" },
  // ── AFRICA ──
  { id: "afro-music", emoji: "🎵", name: "Afro Music" },
  { id: "african-art", emoji: "🎨", name: "African Art" },
  { id: "west-africa", emoji: "🌍", name: "West Africa" },
  { id: "east-africa", emoji: "🦁", name: "East Africa" },
  { id: "south-africa", emoji: "🇿🇦", name: "South Africa" },
  { id: "north-africa", emoji: "🏜️", name: "North Africa" },
  { id: "african-food", emoji: "🍲", name: "African Cuisine" },
  { id: "african-fashion", emoji: "👗", name: "African Fashion" },
  { id: "african-festivals", emoji: "🎉", name: "Festivals" },
  { id: "african-history", emoji: "📚", name: "History & Heritage" },
  { id: "african-languages", emoji: "💬", name: "Languages" },
  { id: "african-spirituality", emoji: "✨", name: "Spirituality" },
  // ── WORLD ──
  { id: "asian-culture", emoji: "🏮", name: "Asian Culture" },
  { id: "european-culture", emoji: "🏰", name: "European Culture" },
  { id: "americas-culture", emoji: "🗽", name: "Americas Culture" },
  { id: "middle-east", emoji: "🕌", name: "Middle East" },
  { id: "indigenous", emoji: "🌿", name: "Indigenous" },
  { id: "world-music", emoji: "🎸", name: "World Music" },
  { id: "global-food", emoji: "🍜", name: "Global Food" },
];

const CultureTab = React.forwardRef(({
  currentUser,
  onAuthorClick,
  onActionMenu,
  onComment,
  isActive = false,
}, ref) => {
  const [selectedCategory, setSelectedCategory] = useState("trending");
  const [content, setContent] = useState([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [offset, setOffset] = useState(0);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  // ── Load culture content for a category ────────────────────────────────────
  useEffect(() => {
    if (!isActive) return;
    loadCultureContent(selectedCategory, 0);
  }, [selectedCategory, isActive]);

  const loadCultureContent = useCallback(async (category, off) => {
    setLoading(true);
    try {
        let items = [];

        if (category === "trending") {
          // Fetch trending content across all categories
          const trending = await cultureService.getTrendingContent("week", 20);
          items = trending;
        } else {
          // Find the category by slug and fetch its content
          const allCats = await cultureService.getCategories();
          const cat = allCats.find(c => c.slug === category);
          if (!cat) {
            console.error("[CultureTab] Category not found:", category);
            setContent([]);
            setHasMore(false);
            return;
          }
          // Fetch posts/reels/stories for this category
          const result = await cultureService.getCategoryContent(cat.id, off, 20);
          // Merge posts, reels, stories into a single array with type markers
          items = [
            ...(result.posts || []).map(p => ({ ...p, type: "post" })),
            ...(result.reels || []).map(r => ({ ...r, type: "reel" })),
            ...(result.stories || []).map(s => ({ ...s, type: "story" })),
          ].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        }

        setContent(off === 0 ? items : [...content, ...items]);
      setOffset(off + 20);
      setHasMore(items.length === 20);
    } catch (e) {
      console.error("[CultureTab] Load failed:", e.message);
    } finally {
      setLoading(false);
    }
  }, [content]);

  // ── Close dropdown on outside click ────────────────────────────────────────
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false);
      }
    };
    if (dropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [dropdownOpen]);

  return (
    <div className="culture-tab">
      {/* Section header */}
      <SectionHeader icon={Compass} title="Culture" />

      {/* Category dropdown — premium top-right positioning */}
      <div className="culture-header">
        <div className="culture-dropdown-wrapper" ref={dropdownRef}>
          <button
            className="culture-dropdown-trigger"
            onClick={() => setDropdownOpen(!dropdownOpen)}
            aria-expanded={dropdownOpen}
          >
            <span className="culture-dropdown-label">
              {CULTURE_CATEGORIES.find(c => c.id === selectedCategory)?.emoji} {CULTURE_CATEGORIES.find(c => c.id === selectedCategory)?.name}
            </span>
            <ChevronDown size={16} className={`culture-dropdown-icon ${dropdownOpen ? "open" : ""}`} />
          </button>

          {dropdownOpen && (
            <div className="culture-dropdown-menu">
              {CULTURE_CATEGORIES.map(cat => (
                <button
                  key={cat.id}
                  className={`culture-dropdown-item ${selectedCategory === cat.id ? "active" : ""}`}
                  onClick={() => {
                    setSelectedCategory(cat.id);
                    setContent([]);
                    setOffset(0);
                    setDropdownOpen(false);
                  }}
                >
                  <span className="cat-emoji">{cat.emoji}</span>
                  <span className="cat-name">{cat.name}</span>
                  {selectedCategory === cat.id && <span className="checkmark">✓</span>}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Content feed */}
      <div className="culture-feed">
        {loading && content.length === 0 && (
          <div style={{ padding: "40px 20px" }}>
            <UnifiedLoader type="section" message={`Loading ${CULTURE_CATEGORIES.find(c => c.id === selectedCategory)?.name}...`} />
          </div>
        )}

        {content.length > 0 ? (
          <>
            {content.map((item, idx) => (
              item.type === "post" ? (
                <PostCard
                  key={`post-${item.id}`}
                  post={item}
                  currentUser={currentUser}
                  onAuthorClick={onAuthorClick}
                  onActionMenu={onActionMenu}
                  onComment={onComment}
                  isActive={isActive}
                />
              ) : (
                <ReelCard
                  key={`reel-${item.id}`}
                  reel={item}
                  currentUser={currentUser}
                  onAuthorClick={onAuthorClick}
                  onActionMenu={onActionMenu}
                  onComment={onComment}
                  isActive={isActive}
                />
              )
            ))}

            {hasMore && !loading && (
              <div style={{ textAlign: "center", padding: "30px 20px" }}>
                <button
                  className="load-more-btn"
                  onClick={() => loadCultureContent(selectedCategory, offset)}
                >
                  Load More
                </button>
              </div>
            )}

            {!hasMore && content.length > 0 && (
              <div style={{ textAlign: "center", padding: "30px 20px", opacity: 0.6 }}>
                <p>No more content in this category</p>
              </div>
            )}
          </>
        ) : !loading ? (
          <div style={{ textAlign: "center", padding: "60px 20px" }}>
            <Compass size={48} style={{ opacity: 0.4, marginBottom: 20 }} />
            <p style={{ opacity: 0.6 }}>No content yet in this category</p>
            <p style={{ fontSize: "12px", opacity: 0.4 }}>Check back soon for amazing cultural content</p>
          </div>
        ) : null}
      </div>

      <style>{`
        .culture-tab {
          width: 100%;
          padding: 0;
        }

        .culture-header {
          display: flex;
          align-items: center;
          justify-content: flex-end;
          gap: 10px;
          padding: 16px;
          background: rgba(255,255,255,0.02);
          border-bottom: 1px solid rgba(255,255,255,0.05);
          margin-bottom: 16px;
        }

        /* ═══════════════════════════════════════════════════════════
           CULTURE DROPDOWN — Premium Top-Right Menu
        ═══════════════════════════════════════════════════════════ */
        .culture-dropdown-wrapper {
          position: relative;
          z-index: 100;
        }

        .culture-dropdown-trigger {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 16px;
          background: linear-gradient(135deg, rgba(132, 204, 22, 0.15), rgba(101, 163, 13, 0.08));
          border: 1px solid rgba(132, 204, 22, 0.4);
          border-radius: 12px;
          color: #84cc16;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s ease;
          white-space: nowrap;
        }

        .culture-dropdown-trigger:hover {
          background: linear-gradient(135deg, rgba(132, 204, 22, 0.22), rgba(101, 163, 13, 0.12));
          border-color: rgba(132, 204, 22, 0.6);
          transform: translateY(-1px);
        }

        .culture-dropdown-trigger:active {
          transform: translateY(0);
        }

        .culture-dropdown-label {
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .culture-dropdown-icon {
          transition: transform 0.3s ease;
          width: 16px;
          height: 16px;
        }

        .culture-dropdown-icon.open {
          transform: rotate(180deg);
        }

        .culture-dropdown-menu {
          position: absolute;
          top: calc(100% + 8px);
          right: 0;
          background: rgba(20, 24, 35, 0.98);
          border: 1px solid rgba(132, 204, 22, 0.3);
          border-radius: 14px;
          box-shadow: 0 10px 32px rgba(0, 0, 0, 0.4);
          backdrop-filter: blur(12px);
          max-height: 400px;
          overflow-y: auto;
          width: 220px;
          z-index: 101;
          animation: slideDown 0.2s ease;
        }

        @keyframes slideDown {
          from {
            opacity: 0;
            transform: translateY(-8px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .culture-dropdown-menu::-webkit-scrollbar {
          width: 6px;
        }

        .culture-dropdown-menu::-webkit-scrollbar-track {
          background: transparent;
        }

        .culture-dropdown-menu::-webkit-scrollbar-thumb {
          background: rgba(132, 204, 22, 0.3);
          border-radius: 3px;
        }

        .culture-dropdown-menu::-webkit-scrollbar-thumb:hover {
          background: rgba(132, 204, 22, 0.5);
        }

        .culture-dropdown-item {
          display: flex;
          align-items: center;
          gap: 10px;
          width: 100%;
          padding: 12px 16px;
          background: transparent;
          border: none;
          border-left: 3px solid transparent;
          color: rgba(255, 255, 255, 0.65);
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.15s ease;
          text-align: left;
        }

        .culture-dropdown-item:hover {
          background: rgba(132, 204, 22, 0.1);
          color: rgba(255, 255, 255, 0.95);
          padding-left: 14px;
        }

        .culture-dropdown-item.active {
          background: rgba(132, 204, 22, 0.15);
          border-left-color: #84cc16;
          color: #84cc16;
        }

        .culture-dropdown-item .checkmark {
          margin-left: auto;
          font-weight: 700;
          font-size: 14px;
        }

        .cat-emoji {
          font-size: 16px;
          min-width: 20px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .cat-name {
          font-size: 13px;
          font-weight: 500;
        }

        .culture-feed {
          width: 100%;
          padding: 0 0 20px;
        }

        .load-more-btn {
          padding: 12px 24px;
          background: rgba(132,204,22,0.1);
          border: 1px solid rgba(132,204,22,0.3);
          border-radius: 8px;
          color: #84cc16;
          cursor: pointer;
          font-weight: 600;
          transition: all 0.2s;
        }

        .load-more-btn:hover {
          background: rgba(132,204,22,0.2);
          transform: scale(1.02);
        }

        @media (max-width: 768px) {
          .culture-header {
            padding: 12px;
            gap: 8px;
          }

          .cat-scroll-btn {
            width: 36px;
            height: 36px;
          }

          .culture-cat-pill {
            padding: 6px 12px;
          }

          .cat-emoji {
            font-size: 14px;
          }

          .cat-name {
            font-size: 11px;
          }
        }
      `}</style>
    </div>
  );
});

CultureTab.displayName = "CultureTab";

export default CultureTab;
