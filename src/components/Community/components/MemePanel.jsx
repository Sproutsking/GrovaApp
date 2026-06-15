import React, { useState, useRef, useEffect, useCallback } from "react";
import { Search, X, TrendingUp, Loader, Flame } from "lucide-react";

/**
 * MemePanel — Real meme templates from Imgflip API (no key needed for listing)
 * onSelect({ type: 'meme', url, name, id })
 */

// Curated popular meme IDs from Imgflip
const POPULAR_MEME_IDS = [
  "181913649","87743020","112126428","131087935","217743513","129242436",
  "61579","101470","258237628","91538330","347390","4087833","93895088",
  "135256802","80707627","61532","438680","122247694","61580","148909805",
  "61527","195515965","100777631","110163934","438730","55311130","102156234",
  "124822590","177682015","101288","14371066","79132341","221578498","284929871"
];

const CATEGORIES = [
  { key: "popular", label: "🔥 Popular" },
  { key: "reactions", label: "😂 Reactions" },
  { key: "classic", label: "🏆 Classic" },
];

const MemePanel = ({ onSelect, onClose, style = {} }) => {
  const [memes, setMemes] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeCategory, setActiveCategory] = useState("popular");
  const panelRef = useRef(null);
  const searchRef = useRef(null);

  useEffect(() => {
    if (searchRef.current) searchRef.current.focus();
    fetchMemes();
  }, []);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) onClose?.();
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [onClose]);

  const fetchMemes = async () => {
    setLoading(true);
    try {
      const res = await fetch("https://api.imgflip.com/get_memes");
      const data = await res.json();
      if (data.success) {
        const all = data.data.memes;
        setMemes(all);
        setFiltered(all.slice(0, 36));
      }
    } catch (err) {
      console.error("Imgflip error:", err);
      // Fallback static memes
      setFiltered(FALLBACK_MEMES);
      setMemes(FALLBACK_MEMES);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!memes.length) return;
    if (searchTerm) {
      const lower = searchTerm.toLowerCase();
      setFiltered(memes.filter((m) => m.name.toLowerCase().includes(lower)).slice(0, 36));
    } else {
      if (activeCategory === "popular") setFiltered(memes.slice(0, 36));
      else if (activeCategory === "reactions") setFiltered(memes.filter((m) => /react|feeling|when|me|that/i.test(m.name)).slice(0, 36));
      else if (activeCategory === "classic") setFiltered(memes.slice(20, 56));
    }
  }, [searchTerm, activeCategory, memes]);

  const handleSelect = useCallback((meme) => {
    onSelect({ type: "meme", url: meme.url, name: meme.name, id: meme.id });
  }, [onSelect]);

  return (
    <div ref={panelRef} className="mp-wrapper" style={style} onClick={(e) => e.stopPropagation()}>
      {/* Search */}
      <div className="mp-header">
        <div className="mp-search-row">
          <Search size={13} className="mp-search-icon" />
          <input
            ref={searchRef}
            type="text"
            placeholder="Search meme templates..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="mp-search-input"
          />
          {searchTerm && (
            <button className="mp-clear" onClick={() => setSearchTerm("")}>
              <X size={12} />
            </button>
          )}
        </div>
      </div>

      {/* Category tabs */}
      {!searchTerm && (
        <div className="mp-cats">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.key}
              className={`mp-cat-btn ${activeCategory === cat.key ? "active" : ""}`}
              onClick={() => setActiveCategory(cat.key)}
            >
              {cat.label}
            </button>
          ))}
        </div>
      )}

      {/* Label */}
      <div className="mp-label">
        {loading ? "Loading templates..." : searchTerm ? `${filtered.length} results` : `${filtered.length} templates`}
        <span className="mp-credit">via Imgflip</span>
      </div>

      {/* Grid */}
      <div className="mp-grid-area">
        {loading ? (
          <div className="mp-loading">
            <Loader size={20} className="mp-spinner" />
            <span>Fetching meme templates...</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="mp-empty">
            <span>🤔</span>
            <p>No memes found</p>
          </div>
        ) : (
          <div className="mp-grid">
            {filtered.map((meme) => (
              <MemeCard key={meme.id} meme={meme} onClick={handleSelect} />
            ))}
          </div>
        )}
      </div>

      <style>{`
        .mp-wrapper {
          position: absolute;
          width: 360px;
          height: 460px;
          background: #0d0d0d;
          border: 1px solid rgba(156,255,0,0.2);
          border-radius: 16px;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          box-shadow: 0 20px 60px rgba(0,0,0,0.8), 0 0 40px rgba(156,255,0,0.06);
          z-index: 2000;
        }

        .mp-header {
          padding: 10px 10px 0;
          flex-shrink: 0;
        }

        .mp-search-row {
          display: flex;
          align-items: center;
          gap: 8px;
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 10px;
          padding: 7px 10px;
          transition: border-color 0.15s;
        }
        .mp-search-row:focus-within {
          border-color: rgba(156,255,0,0.35);
        }
        .mp-search-icon { color: #555; flex-shrink: 0; }
        .mp-search-input {
          flex: 1;
          background: none;
          border: none;
          color: #fff;
          font-size: 13px;
          outline: none;
          font-family: inherit;
        }
        .mp-search-input::placeholder { color: #444; }
        .mp-clear {
          background: none;
          border: none;
          color: #555;
          cursor: pointer;
          padding: 0;
          display: flex;
          align-items: center;
          transition: color 0.15s;
        }
        .mp-clear:hover { color: #9cff00; }

        .mp-cats {
          display: flex;
          gap: 5px;
          padding: 8px 10px 0;
          flex-shrink: 0;
        }

        .mp-cat-btn {
          flex: 1;
          padding: 5px 8px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.07);
          border-radius: 8px;
          color: #666;
          font-size: 11px;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.15s;
          font-family: inherit;
          white-space: nowrap;
        }
        .mp-cat-btn:hover {
          background: rgba(156,255,0,0.08);
          border-color: rgba(156,255,0,0.2);
          color: #9cff00;
        }
        .mp-cat-btn.active {
          background: rgba(156,255,0,0.15);
          border-color: rgba(156,255,0,0.35);
          color: #9cff00;
        }

        .mp-label {
          padding: 6px 12px 4px;
          font-size: 10px;
          font-weight: 700;
          color: #555;
          text-transform: uppercase;
          letter-spacing: 0.8px;
          flex-shrink: 0;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        .mp-credit {
          font-size: 9px;
          color: #333;
          text-transform: none;
          letter-spacing: 0;
        }

        .mp-grid-area {
          flex: 1;
          overflow-y: auto;
          padding: 4px 8px 10px;
          scrollbar-width: thin;
          scrollbar-color: rgba(156,255,0,0.25) transparent;
        }
        .mp-grid-area::-webkit-scrollbar { width: 4px; }
        .mp-grid-area::-webkit-scrollbar-thumb { background: rgba(156,255,0,0.25); border-radius: 2px; }

        .mp-loading {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          height: 200px;
          gap: 10px;
          color: #555;
          font-size: 13px;
        }
        .mp-spinner {
          animation: spin 0.8s linear infinite;
          color: #9cff00;
        }
        @keyframes spin { to { transform: rotate(360deg); } }

        .mp-empty {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          height: 200px;
          gap: 8px;
          color: #444;
          font-size: 13px;
        }
        .mp-empty span { font-size: 32px; }
        .mp-empty p { margin: 0; }

        .mp-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 6px;
        }
      `}</style>
    </div>
  );
};

const MemeCard = ({ meme, onClick }) => {
  const [loaded, setLoaded] = useState(false);
  const [hovered, setHovered] = useState(false);

  return (
    <div
      className={`meme-card ${hovered ? "hov" : ""}`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={() => onClick(meme)}
    >
      {!loaded && <div className="meme-skeleton" />}
      <img
        src={meme.url}
        alt={meme.name}
        loading="lazy"
        onLoad={() => setLoaded(true)}
        style={{ opacity: loaded ? 1 : 0 }}
      />
      <div className={`meme-name ${hovered ? "show" : ""}`}>
        {meme.name}
      </div>

      <style>{`
        .meme-card {
          position: relative;
          border-radius: 8px;
          overflow: hidden;
          cursor: pointer;
          background: #1a1a1a;
          border: 1px solid rgba(255,255,255,0.06);
          aspect-ratio: 1;
          transition: all 0.2s;
        }
        .meme-card.hov {
          border-color: rgba(156,255,0,0.4);
          transform: scale(1.04);
          box-shadow: 0 4px 20px rgba(156,255,0,0.2);
          z-index: 1;
        }
        .meme-card img {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          object-fit: cover;
          transition: opacity 0.3s;
        }
        .meme-skeleton {
          position: absolute;
          inset: 0;
          background: linear-gradient(90deg, #1a1a1a 25%, #232323 50%, #1a1a1a 75%);
          background-size: 200% 100%;
          animation: shimmer 1.5s infinite;
        }
        @keyframes shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
        .meme-name {
          position: absolute;
          bottom: 0;
          left: 0;
          right: 0;
          background: linear-gradient(transparent, rgba(0,0,0,0.9));
          padding: 16px 5px 4px;
          font-size: 9px;
          font-weight: 700;
          color: #fff;
          text-align: center;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          opacity: 0;
          transition: opacity 0.2s;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        .meme-name.show { opacity: 1; }
      `}</style>
    </div>
  );
};

// Fallback if API fails
const FALLBACK_MEMES = [
  { id: "1", name: "Drake", url: "https://i.imgflip.com/30b1gx.jpg" },
  { id: "2", name: "Distracted Boyfriend", url: "https://i.imgflip.com/1ur9b0.jpg" },
  { id: "3", name: "Two Buttons", url: "https://i.imgflip.com/1g8my4.jpg" },
  { id: "4", name: "Change My Mind", url: "https://i.imgflip.com/24y43o.jpg" },
  { id: "5", name: "Running Away Balloon", url: "https://i.imgflip.com/261o3j.jpg" },
  { id: "6", name: "Batman Slapping Robin", url: "https://i.imgflip.com/9ehk.jpg" },
];

export default MemePanel;