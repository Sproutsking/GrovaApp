import React, { useState, useRef, useEffect, useCallback } from "react";
import { Search, TrendingUp, Clock, X } from "lucide-react";

/**
 * GifPanel
 * - Shows trending GIFs and a search interface
 * - Uses placeholder GIF data (swap in a real GIF API like Giphy/Tenor if available)
 * - Masonry-style layout for visual appeal
 * - Calls onSelect(gifUrl) when a GIF is clicked
 */

const TRENDING_GIFS = [
  {
    id: "g1",
    url: "https://media.tenor.com/images/placeholder1.gif",
    title: "Laughing",
    width: 200,
    height: 150,
  },
  {
    id: "g2",
    url: "https://media.tenor.com/images/placeholder2.gif",
    title: "Clapping",
    width: 150,
    height: 200,
  },
  {
    id: "g3",
    url: "https://media.tenor.com/images/placeholder3.gif",
    title: "Fire",
    width: 180,
    height: 180,
  },
  {
    id: "g4",
    url: "https://media.tenor.com/images/placeholder4.gif",
    title: "Wow",
    width: 200,
    height: 160,
  },
  {
    id: "g5",
    url: "https://media.tenor.com/images/placeholder5.gif",
    title: "Dancing",
    width: 160,
    height: 210,
  },
  {
    id: "g6",
    url: "https://media.tenor.com/images/placeholder6.gif",
    title: "Yes",
    width: 190,
    height: 140,
  },
  {
    id: "g7",
    url: "https://media.tenor.com/images/placeholder7.gif",
    title: "No way",
    width: 170,
    height: 190,
  },
  {
    id: "g8",
    url: "https://media.tenor.com/images/placeholder8.gif",
    title: "Mind blown",
    width: 200,
    height: 170,
  },
  {
    id: "g9",
    url: "https://media.tenor.com/images/placeholder9.gif",
    title: "Heart eyes",
    width: 180,
    height: 180,
  },
  {
    id: "g10",
    url: "https://media.tenor.com/images/placeholder10.gif",
    title: "Crying laugh",
    width: 160,
    height: 200,
  },
  {
    id: "g11",
    url: "https://media.tenor.com/images/placeholder11.gif",
    title: "High five",
    width: 200,
    height: 150,
  },
  {
    id: "g12",
    url: "https://media.tenor.com/images/placeholder12.gif",
    title: "Boom",
    width: 190,
    height: 170,
  },
];

const CATEGORIES = [
  { key: "trending", label: "Trending", icon: TrendingUp },
  { key: "recent", label: "Recent", icon: Clock },
];

const GIF_EMOJIS = {
  trending: [
    "😂",
    "🔥",
    "👏",
    "😍",
    "💀",
    "🤯",
    "🎉",
    "👀",
    "😳",
    "💯",
    "🚀",
    "😎",
  ],
  happy: ["😀", "😁", "🥳", "🎉", "😊", "🤩", "😄", "🥰", "😍", "💕"],
  sad: ["😢", "😭", "💔", "😞", "😩", "🥺", "😓", "😔", "😟", "💀"],
  love: ["❤️", "😍", "🤩", "💕", "💗", "💖", "😘", "🥰", "💝", "💘"],
  funny: ["😂", "🤣", "💀", "🤡", "😜", "🤪", "😬", "🙃", "🤯", "😳"],
  wow: ["😲", "🤯", "😳", "👀", "😱", "🤯", "💥", "⚡", "🔥", "💫"],
  angry: ["😡", "😠", "🤬", "💢", "😤", "🤯", "💥", "⚡", "🔥", "👿"],
  cool: ["😎", "🤓", "🕶️", "🤙", "🤘", "🤜", "💪", "🔥", "⚡", "💫"],
};

const GifPanel = ({ onSelect, onClose, style = {} }) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [activeCategory, setActiveCategory] = useState("trending");
  const [hoveredGif, setHoveredGif] = useState(null);
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

  const handleGifClick = useCallback(
    (gif) => {
      onSelect({ type: "gif", url: gif.url, title: gif.title });
    },
    [onSelect],
  );

  const handleEmojiGifClick = useCallback(
    (emoji, category) => {
      onSelect({ type: "gif_emoji", emoji, category });
    },
    [onSelect],
  );

  const displayGifs = TRENDING_GIFS;

  return (
    <div
      ref={panelRef}
      className="gif-panel"
      style={style}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Search */}
      <div className="gp-search">
        <Search size={14} color="#666" />
        <input
          ref={searchRef}
          type="text"
          placeholder="Search GIFs..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="gp-search-input"
        />
        {searchTerm && (
          <button className="gp-clear" onClick={() => setSearchTerm("")}>
            <X size={14} />
          </button>
        )}
      </div>

      {/* Category tabs */}
      <div className="gp-categories">
        {CATEGORIES.map((cat) => {
          const Icon = cat.icon;
          return (
            <button
              key={cat.key}
              className={`gp-cat-btn ${activeCategory === cat.key ? "active" : ""}`}
              onClick={() => {
                setActiveCategory(cat.key);
                setSearchTerm("");
              }}
            >
              <Icon size={14} />
              <span>{cat.label}</span>
            </button>
          );
        })}
      </div>

      {/* Emoji quick-select row (these act as GIF category filters) */}
      <div className="gp-emoji-row">
        {(GIF_EMOJIS[activeCategory] || GIF_EMOJIS.trending).map((emoji, i) => (
          <button
            key={i}
            className="gp-emoji-btn"
            onClick={() => handleEmojiGifClick(emoji, activeCategory)}
          >
            {emoji}
          </button>
        ))}
      </div>

      {/* GIF Grid — Masonry columns */}
      <div className="gp-grid">
        <div className="gp-col">
          {displayGifs
            .filter((_, i) => i % 3 === 0)
            .map((gif) => (
              <div
                key={gif.id}
                className={`gp-gif-card ${hoveredGif === gif.id ? "hovered" : ""}`}
                onMouseEnter={() => setHoveredGif(gif.id)}
                onMouseLeave={() => setHoveredGif(null)}
                onClick={() => handleGifClick(gif)}
              >
                <div
                  className="gp-gif-placeholder"
                  style={{ aspectRatio: `${gif.width}/${gif.height}` }}
                >
                  <div className="gp-gif-inner">
                    <span className="gp-gif-emoji">
                      {["😂", "🔥", "👏", "😍"][Math.floor(Math.random() * 4)]}
                    </span>
                    <span className="gp-gif-label">{gif.title}</span>
                  </div>
                </div>
              </div>
            ))}
        </div>
        <div className="gp-col">
          {displayGifs
            .filter((_, i) => i % 3 === 1)
            .map((gif) => (
              <div
                key={gif.id}
                className={`gp-gif-card ${hoveredGif === gif.id ? "hovered" : ""}`}
                onMouseEnter={() => setHoveredGif(gif.id)}
                onMouseLeave={() => setHoveredGif(null)}
                onClick={() => handleGifClick(gif)}
              >
                <div
                  className="gp-gif-placeholder"
                  style={{ aspectRatio: `${gif.width}/${gif.height}` }}
                >
                  <div className="gp-gif-inner">
                    <span className="gp-gif-emoji">
                      {["🤯", "💀", "🎉", "👀"][Math.floor(Math.random() * 4)]}
                    </span>
                    <span className="gp-gif-label">{gif.title}</span>
                  </div>
                </div>
              </div>
            ))}
        </div>
        <div className="gp-col">
          {displayGifs
            .filter((_, i) => i % 3 === 2)
            .map((gif) => (
              <div
                key={gif.id}
                className={`gp-gif-card ${hoveredGif === gif.id ? "hovered" : ""}`}
                onMouseEnter={() => setHoveredGif(gif.id)}
                onMouseLeave={() => setHoveredGif(null)}
                onClick={() => handleGifClick(gif)}
              >
                <div
                  className="gp-gif-placeholder"
                  style={{ aspectRatio: `${gif.width}/${gif.height}` }}
                >
                  <div className="gp-gif-inner">
                    <span className="gp-gif-emoji">
                      {["😳", "🥴", "😎", "🤙"][Math.floor(Math.random() * 4)]}
                    </span>
                    <span className="gp-gif-label">{gif.title}</span>
                  </div>
                </div>
              </div>
            ))}
        </div>
      </div>

      <style>{`
        .gif-panel {
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

        .gp-search {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 12px;
          border-bottom: 1px solid rgba(255,255,255,0.06);
        }
        .gp-search-input {
          flex: 1;
          background: rgba(255,255,255,0.06);
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 6px;
          padding: 6px 10px;
          color: #fff;
          font-size: 13px;
          outline: none;
        }
        .gp-search-input:focus { border-color: rgba(132,204,22,0.4); }
        .gp-clear {
          background: none;
          border: none;
          color: #555;
          cursor: pointer;
          padding: 2px;
          display: flex;
          align-items: center;
        }
        .gp-clear:hover { color: #84cc16; }

        .gp-categories {
          display: flex;
          gap: 6px;
          padding: 8px 12px;
          border-bottom: 1px solid rgba(255,255,255,0.06);
        }
        .gp-cat-btn {
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
        .gp-cat-btn:hover { background: rgba(132,204,22,0.1); color: #84cc16; }
        .gp-cat-btn.active {
          background: rgba(132,204,22,0.15);
          border-color: rgba(132,204,22,0.3);
          color: #84cc16;
        }

        .gp-emoji-row {
          display: flex;
          gap: 4px;
          padding: 8px 10px;
          overflow-x: auto;
          border-bottom: 1px solid rgba(255,255,255,0.06);
          scrollbar-width: none;
        }
        .gp-emoji-row::-webkit-scrollbar { display: none; }
        .gp-emoji-btn {
          flex-shrink: 0;
          width: 28px;
          height: 28px;
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 6px;
          font-size: 16px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.15s;
        }
        .gp-emoji-btn:hover {
          background: rgba(132,204,22,0.15);
          border-color: rgba(132,204,22,0.3);
          transform: scale(1.1);
        }

        .gp-grid {
          flex: 1;
          display: flex;
          gap: 6px;
          padding: 8px;
          overflow-y: auto;
          scrollbar-width: thin;
          scrollbar-color: rgba(132,204,22,0.3) transparent;
        }
        .gp-grid::-webkit-scrollbar { width: 5px; }
        .gp-grid::-webkit-scrollbar-thumb { background: rgba(132,204,22,0.3); border-radius: 3px; }

        .gp-col {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .gp-gif-card {
          border-radius: 8px;
          overflow: hidden;
          cursor: pointer;
          border: 1px solid rgba(255,255,255,0.06);
          transition: all 0.2s;
          background: #1a1a1a;
        }
        .gp-gif-card:hover, .gp-gif-card.hovered {
          border-color: rgba(132,204,22,0.4);
          transform: scale(1.03);
          box-shadow: 0 4px 16px rgba(132,204,22,0.2);
        }

        .gp-gif-placeholder {
          width: 100%;
          background: linear-gradient(135deg, #1a1a1a 0%, #222 100%);
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .gp-gif-inner {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 4px;
        }
        .gp-gif-emoji { font-size: 28px; }
        .gp-gif-label {
          font-size: 10px;
          color: #555;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        @media (max-width: 420px) {
          .gif-panel { width: 300px; height: 360px; }
        }
      `}</style>
    </div>
  );
};

export default GifPanel;
