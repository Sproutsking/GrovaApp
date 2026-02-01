import React, { useState, useRef, useEffect } from "react";
import { Search, X, Sparkles, TrendingUp } from "lucide-react";

/**
 * MemePanel
 * - Browse and send meme-style content
 * - Categories: Trending, Reactions, Text Memes
 * - Each meme card shows emoji + text combo that gets sent as a styled message
 * - onSelect({ type: 'meme', emoji, text, category })
 */

const MEME_DATA = {
  trending: [
    { id: "m1", emoji: "💀", text: "I'm dead", category: "trending" },
    { id: "m2", emoji: "🔥", text: "This is fine", category: "trending" },
    { id: "m3", emoji: "😭", text: "Why tho", category: "trending" },
    { id: "m4", emoji: "🤯", text: "Big brain", category: "trending" },
    { id: "m5", emoji: "👀", text: "Uh oh", category: "trending" },
    { id: "m6", emoji: "💯", text: "No cap", category: "trending" },
    { id: "m7", emoji: "🚀", text: "To the moon", category: "trending" },
    { id: "m8", emoji: "😎", text: "Stay cool", category: "trending" },
    { id: "m9", emoji: "🤡", text: "Clown energy", category: "trending" },
    { id: "m10", emoji: "⚡", text: "Lightning speed", category: "trending" },
    { id: "m11", emoji: "🥴", text: "Send help", category: "trending" },
    { id: "m12", emoji: "🎭", text: "Plot twist", category: "trending" },
  ],
  reactions: [
    { id: "r1", emoji: "😂", text: "LOL", category: "reactions" },
    { id: "r2", emoji: "😍", text: "Heart eyes", category: "reactions" },
    { id: "r3", emoji: "😱", text: "WHAT", category: "reactions" },
    { id: "r4", emoji: "👏", text: "Clap clap", category: "reactions" },
    { id: "r5", emoji: "🙌", text: "Yass", category: "reactions" },
    { id: "r6", emoji: "😤", text: "Bet", category: "reactions" },
    { id: "r7", emoji: "💪", text: "Strong", category: "reactions" },
    { id: "r8", emoji: "🤝", text: "Deal", category: "reactions" },
    { id: "r9", emoji: "👍", text: "Solid", category: "reactions" },
    { id: "r10", emoji: "✨", text: "Aesthetic", category: "reactions" },
    { id: "r11", emoji: "🎤", text: "Mic drop", category: "reactions" },
    { id: "r12", emoji: "👑", text: "King/Queen", category: "reactions" },
  ],
  text: [
    { id: "t1", emoji: "📢", text: "Attention please", category: "text" },
    { id: "t2", emoji: "🗣️", text: "Said what I said", category: "text" },
    { id: "t3", emoji: "🤷", text: "Idk anymore", category: "text" },
    { id: "t4", emoji: "😒", text: "Not again", category: "text" },
    { id: "t5", emoji: "🙄", text: "Oh wow", category: "text" },
    { id: "t6", emoji: "🤔", text: "Interesting...", category: "text" },
    { id: "t7", emoji: "😏", text: "Hmm", category: "text" },
    { id: "t8", emoji: "🤨", text: "Explain", category: "text" },
    { id: "t9", emoji: "💬", text: "Talk to me", category: "text" },
    { id: "t10", emoji: "🔊", text: "Turn it up", category: "text" },
    { id: "t11", emoji: "⏰", text: "Time's up", category: "text" },
    { id: "t12", emoji: "🎯", text: "Nailed it", category: "text" },
  ],
};

const CATEGORIES = [
  { key: "trending", label: "Trending", icon: TrendingUp },
  { key: "reactions", label: "Reactions", icon: Sparkles },
  { key: "text", label: "Text", icon: null },
];

const MemePanel = ({ onSelect, onClose, style = {} }) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [activeCategory, setActiveCategory] = useState("trending");
  const [hoveredId, setHoveredId] = useState(null);
  const panelRef = useRef(null);
  const searchRef = useRef(null);

  useEffect(() => {
    if (searchRef.current) searchRef.current.focus();
  }, []);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) {
        onClose?.();
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [onClose]);

  const getMemes = () => {
    let memes = MEME_DATA[activeCategory] || MEME_DATA.trending;
    if (searchTerm) {
      const lower = searchTerm.toLowerCase();
      memes = Object.values(MEME_DATA)
        .flat()
        .filter(
          (m) =>
            m.text.toLowerCase().includes(lower) ||
            m.emoji.includes(searchTerm),
        );
    }
    return memes;
  };

  const memes = getMemes();

  return (
    <div
      ref={panelRef}
      className="meme-panel"
      style={style}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Search */}
      <div className="mp-search">
        <Search size={14} color="#666" />
        <input
          ref={searchRef}
          type="text"
          placeholder="Search memes..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="mp-search-input"
        />
        {searchTerm && (
          <button className="mp-clear" onClick={() => setSearchTerm("")}>
            <X size={14} />
          </button>
        )}
      </div>

      {/* Categories */}
      <div className="mp-categories">
        {CATEGORIES.map((cat) => {
          const Icon = cat.icon;
          return (
            <button
              key={cat.key}
              className={`mp-cat-btn ${activeCategory === cat.key && !searchTerm ? "active" : ""}`}
              onClick={() => {
                setActiveCategory(cat.key);
                setSearchTerm("");
              }}
            >
              {Icon && <Icon size={13} />}
              <span>{cat.label}</span>
            </button>
          );
        })}
      </div>

      {/* Meme Grid */}
      <div className="mp-grid">
        {memes.map((meme) => (
          <div
            key={meme.id}
            className={`mp-card ${hoveredId === meme.id ? "hovered" : ""}`}
            onMouseEnter={() => setHoveredId(meme.id)}
            onMouseLeave={() => setHoveredId(null)}
            onClick={() =>
              onSelect({
                type: "meme",
                emoji: meme.emoji,
                text: meme.text,
                category: meme.category,
              })
            }
          >
            <div className="mp-card-emoji">{meme.emoji}</div>
            <div className="mp-card-text">{meme.text}</div>
          </div>
        ))}
        {memes.length === 0 && <div className="mp-empty">No memes found</div>}
      </div>

      <style>{`
        .meme-panel {
          position: absolute;
          width: 360px;
          height: 420px;
          background: #111;
          border: 1px solid rgba(132,204,22,0.25);
          border-radius: 14px;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          box-shadow: 0 16px 48px rgba(0,0,0,0.7), 0 0 60px rgba(132,204,22,0.08);
          z-index: 2000;
        }

        .mp-search {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 12px;
          border-bottom: 1px solid rgba(255,255,255,0.06);
        }
        .mp-search-input {
          flex: 1;
          background: rgba(255,255,255,0.06);
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 6px;
          padding: 6px 10px;
          color: #fff;
          font-size: 13px;
          outline: none;
        }
        .mp-search-input:focus { border-color: rgba(132,204,22,0.4); }
        .mp-clear {
          background: none;
          border: none;
          color: #555;
          cursor: pointer;
          padding: 2px;
          display: flex;
          align-items: center;
        }
        .mp-clear:hover { color: #84cc16; }

        .mp-categories {
          display: flex;
          gap: 6px;
          padding: 8px 12px;
          border-bottom: 1px solid rgba(255,255,255,0.06);
        }
        .mp-cat-btn {
          display: flex;
          align-items: center;
          gap: 5px;
          padding: 5px 10px;
          background: transparent;
          border: 1px solid transparent;
          border-radius: 6px;
          color: #666;
          font-size: 12px;
          cursor: pointer;
          transition: all 0.15s;
        }
        .mp-cat-btn:hover { background: rgba(132,204,22,0.1); color: #84cc16; }
        .mp-cat-btn.active {
          background: rgba(132,204,22,0.15);
          border-color: rgba(132,204,22,0.3);
          color: #84cc16;
        }

        .mp-grid {
          flex: 1;
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 6px;
          padding: 8px;
          overflow-y: auto;
          scrollbar-width: thin;
          scrollbar-color: rgba(132,204,22,0.3) transparent;
          align-content: start;
        }
        .mp-grid::-webkit-scrollbar { width: 5px; }
        .mp-grid::-webkit-scrollbar-thumb { background: rgba(132,204,22,0.3); border-radius: 3px; }

        .mp-card {
          background: #1a1a1a;
          border: 1px solid rgba(255,255,255,0.06);
          border-radius: 10px;
          padding: 12px 8px;
          cursor: pointer;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 6px;
          transition: all 0.2s;
          text-align: center;
        }
        .mp-card:hover, .mp-card.hovered {
          background: #222;
          border-color: rgba(132,204,22,0.35);
          transform: translateY(-2px);
          box-shadow: 0 6px 20px rgba(132,204,22,0.15);
        }

        .mp-card-emoji {
          font-size: 28px;
          line-height: 1;
        }

        .mp-card-text {
          font-size: 11px;
          color: #888;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.3px;
          line-height: 1.3;
        }

        .mp-card.hovered .mp-card-text { color: #84cc16; }

        .mp-empty {
          grid-column: 1 / -1;
          text-align: center;
          color: #444;
          font-size: 13px;
          padding: 40px 0;
        }

        @media (max-width: 420px) {
          .meme-panel { width: 300px; height: 360px; }
          .mp-grid { grid-template-columns: repeat(3, 1fr); gap: 4px; }
        }
      `}</style>
    </div>
  );
};

export default MemePanel;
