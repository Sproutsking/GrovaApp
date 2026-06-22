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
import { Compass, ChevronLeft, ChevronRight } from "lucide-react";
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
  const categoryScrollRef = useRef(null);

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

  // ── Scroll category pills ──────────────────────────────────────────────────
  const scrollCategories = useCallback((direction) => {
    if (!categoryScrollRef.current) return;
    const scroll = direction === "left" ? -200 : 200;
    categoryScrollRef.current.scrollBy({ left: scroll, behavior: "smooth" });
  }, []);

  return (
    <div className="culture-tab">
      {/* Section header */}
      <SectionHeader icon="🌍" title="Culture" />

      {/* Category pills with navigation */}
      <div className="culture-header">
        <button
          className="cat-scroll-btn cat-scroll-left"
          onClick={() => scrollCategories("left")}
          aria-label="Scroll categories left"
        >
          <ChevronLeft size={18} />
        </button>

        <div className="culture-categories-scroll" ref={categoryScrollRef}>
          {CULTURE_CATEGORIES.map(cat => (
            <button
              key={cat.id}
              className={`culture-cat-pill ${selectedCategory === cat.id ? "active" : ""}`}
              onClick={() => {
                setSelectedCategory(cat.id);
                setContent([]);
                setOffset(0);
              }}
            >
              <span className="cat-emoji">{cat.emoji}</span>
              <span className="cat-name">{cat.name}</span>
            </button>
          ))}
        </div>

        <button
          className="cat-scroll-btn cat-scroll-right"
          onClick={() => scrollCategories("right")}
          aria-label="Scroll categories right"
        >
          <ChevronRight size={18} />
        </button>
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
          gap: 10px;
          padding: 16px;
          background: rgba(255,255,255,0.02);
          border-bottom: 1px solid rgba(255,255,255,0.05);
          margin-bottom: 16px;
        }

        .cat-scroll-btn {
          width: 40px;
          height: 40px;
          border-radius: 50%;
          background: rgba(132,204,22,0.1);
          border: 1px solid rgba(132,204,22,0.3);
          color: #84cc16;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s;
          flex-shrink: 0;
        }

        .cat-scroll-btn:hover {
          background: rgba(132,204,22,0.2);
          transform: scale(1.05);
        }

        .culture-categories-scroll {
          flex: 1;
          display: flex;
          gap: 8px;
          overflow-x: auto;
          scroll-behavior: smooth;
          padding: 4px 0;
          -webkit-overflow-scrolling: touch;
        }

        .culture-categories-scroll::-webkit-scrollbar {
          display: none;
        }

        .culture-cat-pill {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 8px 14px;
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 20px;
          color: rgba(255,255,255,0.7);
          cursor: pointer;
          white-space: nowrap;
          transition: all 0.2s;
          flex-shrink: 0;
        }

        .culture-cat-pill:hover {
          background: rgba(255,255,255,0.08);
          color: #fff;
        }

        .culture-cat-pill.active {
          background: rgba(132,204,22,0.2);
          border-color: rgba(132,204,22,0.5);
          color: #84cc16;
        }

        .cat-emoji {
          font-size: 16px;
        }

        .cat-name {
          font-size: 12px;
          font-weight: 600;
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
