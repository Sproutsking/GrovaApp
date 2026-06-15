import React, { useState, useRef, useEffect, useCallback } from "react";
import { Search, X, TrendingUp, Clock, Loader } from "lucide-react";

/**
 * GifPanel — Real GIFs via Tenor API (free key included for demo)
 * Replace TENOR_API_KEY with your own key from tenor.com/gifapi
 * onSelect({ type: 'gif', url, previewUrl, title })
 */

const TENOR_API_KEY = "AIzaSyAyimkuYQYF_FXVALexPzfiqqHKDDbHx-c"; // Demo key — replace with yours
const TENOR_BASE = "https://tenor.googleapis.com/v2";

const QUICK_SEARCHES = [
  { label: "😂 Funny", q: "funny" },
  { label: "🔥 Fire", q: "fire" },
  { label: "👏 Clap", q: "clapping" },
  { label: "💀 Dead", q: "skull" },
  { label: "🎉 Party", q: "celebration" },
  { label: "😍 Love", q: "love" },
  { label: "😤 Angry", q: "angry" },
  { label: "🥹 Wholesome", q: "wholesome" },
  { label: "💪 Strong", q: "strong" },
  { label: "🤔 Think", q: "thinking" },
];

const GifPanel = ({ onSelect, onClose, style = {} }) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [gifs, setGifs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeQuick, setActiveQuick] = useState(null);
  const panelRef = useRef(null);
  const searchRef = useRef(null);
  const searchTimeout = useRef(null);

  useEffect(() => {
    if (searchRef.current) searchRef.current.focus();
    fetchTrending();
  }, []);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) onClose?.();
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [onClose]);

  const fetchTrending = async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `${TENOR_BASE}/featured?key=${TENOR_API_KEY}&limit=24&media_filter=gif,tinygif`
      );
      const data = await res.json();
      setGifs(parseGifs(data.results || []));
    } catch (err) {
      console.error("Tenor trending error:", err);
      setGifs([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchSearch = async (q) => {
    if (!q.trim()) { fetchTrending(); return; }
    setLoading(true);
    try {
      const res = await fetch(
        `${TENOR_BASE}/search?key=${TENOR_API_KEY}&q=${encodeURIComponent(q)}&limit=24&media_filter=gif,tinygif`
      );
      const data = await res.json();
      setGifs(parseGifs(data.results || []));
    } catch (err) {
      console.error("Tenor search error:", err);
    } finally {
      setLoading(false);
    }
  };

  const parseGifs = (results) => {
    return results.map((r) => {
      const gif = r.media_formats?.gif || r.media_formats?.tinygif || {};
      const tiny = r.media_formats?.tinygif || r.media_formats?.gif || {};
      return {
        id: r.id,
        url: gif.url || "",
        previewUrl: tiny.url || gif.url || "",
        title: r.title || r.content_description || "GIF",
        dims: gif.dims || [200, 150],
      };
    }).filter((g) => g.url);
  };

  const handleSearchChange = (val) => {
    setSearchTerm(val);
    setActiveQuick(null);
    clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => fetchSearch(val), 400);
  };

  const handleQuickSearch = (q, label) => {
    setSearchTerm(q);
    setActiveQuick(label);
    fetchSearch(q);
  };

  const handleGifClick = useCallback((gif) => {
    onSelect({ type: "gif", url: gif.url, previewUrl: gif.previewUrl, title: gif.title });
  }, [onSelect]);

  // Split into 2 columns for masonry
  const col1 = gifs.filter((_, i) => i % 2 === 0);
  const col2 = gifs.filter((_, i) => i % 2 === 1);

  return (
    <div ref={panelRef} className="gp-wrapper" style={style} onClick={(e) => e.stopPropagation()}>
      {/* Search */}
      <div className="gp-header">
        <div className="gp-search-row">
          <Search size={13} className="gp-search-icon" />
          <input
            ref={searchRef}
            type="text"
            placeholder="Search GIFs..."
            value={searchTerm}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="gp-search-input"
          />
          {searchTerm ? (
            <button className="gp-clear" onClick={() => { setSearchTerm(""); setActiveQuick(null); fetchTrending(); }}>
              <X size={12} />
            </button>
          ) : (
            <span className="gp-powered">via Tenor</span>
          )}
        </div>
      </div>

      {/* Quick search chips */}
      <div className="gp-chips">
        {QUICK_SEARCHES.map((q) => (
          <button
            key={q.q}
            className={`gp-chip ${activeQuick === q.label ? "active" : ""}`}
            onClick={() => handleQuickSearch(q.q, q.label)}
          >
            {q.label}
          </button>
        ))}
      </div>

      {/* Section label */}
      <div className="gp-section-label">
        {loading ? "Loading..." : searchTerm || activeQuick ? `"${searchTerm || activeQuick}"` : "🔥 Trending"}
      </div>

      {/* GIF Masonry Grid */}
      <div className="gp-grid-area">
        {loading ? (
          <div className="gp-loading">
            <Loader size={20} className="gp-spinner" />
            <span>Fetching GIFs...</span>
          </div>
        ) : gifs.length === 0 ? (
          <div className="gp-empty">
            <span>😕</span>
            <p>No GIFs found</p>
          </div>
        ) : (
          <div className="gp-masonry">
            <div className="gp-col">
              {col1.map((gif) => (
                <GifCard key={gif.id} gif={gif} onClick={handleGifClick} />
              ))}
            </div>
            <div className="gp-col">
              {col2.map((gif) => (
                <GifCard key={gif.id} gif={gif} onClick={handleGifClick} />
              ))}
            </div>
          </div>
        )}
      </div>

      <style>{`
        .gp-wrapper {
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

        .gp-header {
          padding: 10px 10px 0;
          flex-shrink: 0;
        }

        .gp-search-row {
          display: flex;
          align-items: center;
          gap: 8px;
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 10px;
          padding: 7px 10px;
          transition: border-color 0.15s;
        }
        .gp-search-row:focus-within {
          border-color: rgba(156,255,0,0.35);
        }
        .gp-search-icon { color: #555; flex-shrink: 0; }
        .gp-search-input {
          flex: 1;
          background: none;
          border: none;
          color: #fff;
          font-size: 13px;
          outline: none;
          font-family: inherit;
        }
        .gp-search-input::placeholder { color: #444; }

        .gp-clear {
          background: none;
          border: none;
          color: #555;
          cursor: pointer;
          padding: 0;
          display: flex;
          align-items: center;
          transition: color 0.15s;
        }
        .gp-clear:hover { color: #9cff00; }

        .gp-powered {
          font-size: 9px;
          color: #444;
          white-space: nowrap;
          font-weight: 600;
          letter-spacing: 0.5px;
          text-transform: uppercase;
        }

        .gp-chips {
          display: flex;
          gap: 5px;
          padding: 8px 10px 0;
          overflow-x: auto;
          scrollbar-width: none;
          flex-shrink: 0;
        }
        .gp-chips::-webkit-scrollbar { display: none; }

        .gp-chip {
          flex-shrink: 0;
          padding: 4px 10px;
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 20px;
          color: #888;
          font-size: 11px;
          font-weight: 600;
          cursor: pointer;
          white-space: nowrap;
          transition: all 0.15s;
          font-family: inherit;
        }
        .gp-chip:hover {
          background: rgba(156,255,0,0.1);
          border-color: rgba(156,255,0,0.25);
          color: #9cff00;
        }
        .gp-chip.active {
          background: rgba(156,255,0,0.15);
          border-color: rgba(156,255,0,0.35);
          color: #9cff00;
        }

        .gp-section-label {
          padding: 6px 12px 4px;
          font-size: 10px;
          font-weight: 700;
          color: #555;
          text-transform: uppercase;
          letter-spacing: 0.8px;
          flex-shrink: 0;
        }

        .gp-grid-area {
          flex: 1;
          overflow-y: auto;
          padding: 4px 8px 10px;
          scrollbar-width: thin;
          scrollbar-color: rgba(156,255,0,0.25) transparent;
        }
        .gp-grid-area::-webkit-scrollbar { width: 4px; }
        .gp-grid-area::-webkit-scrollbar-thumb { background: rgba(156,255,0,0.25); border-radius: 2px; }

        .gp-loading {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          height: 200px;
          gap: 10px;
          color: #555;
          font-size: 13px;
        }

        .gp-spinner {
          animation: spin 0.8s linear infinite;
          color: #9cff00;
        }
        @keyframes spin { to { transform: rotate(360deg); } }

        .gp-empty {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          height: 200px;
          gap: 8px;
          color: #444;
          font-size: 13px;
        }
        .gp-empty span { font-size: 32px; }
        .gp-empty p { margin: 0; }

        .gp-masonry {
          display: flex;
          gap: 5px;
        }
        .gp-col {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 5px;
        }
      `}</style>
    </div>
  );
};

const GifCard = ({ gif, onClick }) => {
  const [loaded, setLoaded] = useState(false);
  const [hovered, setHovered] = useState(false);
  const aspect = gif.dims[1] / gif.dims[0];

  return (
    <div
      className={`gif-card ${hovered ? "hov" : ""}`}
      style={{ paddingBottom: `${aspect * 100}%` }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={() => onClick(gif)}
    >
      {!loaded && <div className="gif-skeleton" />}
      <img
        src={gif.previewUrl}
        alt={gif.title}
        loading="lazy"
        onLoad={() => setLoaded(true)}
        style={{ opacity: loaded ? 1 : 0 }}
      />
      {hovered && loaded && (
        <div className="gif-overlay">
          <span>{gif.title}</span>
        </div>
      )}

      <style>{`
        .gif-card {
          position: relative;
          border-radius: 8px;
          overflow: hidden;
          cursor: pointer;
          background: #1a1a1a;
          border: 1px solid rgba(255,255,255,0.06);
          transition: all 0.2s;
        }
        .gif-card.hov {
          border-color: rgba(156,255,0,0.4);
          transform: scale(1.02);
          box-shadow: 0 4px 16px rgba(156,255,0,0.2);
        }
        .gif-card img {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          object-fit: cover;
          transition: opacity 0.3s;
        }
        .gif-skeleton {
          position: absolute;
          inset: 0;
          background: linear-gradient(90deg, #1a1a1a 25%, #222 50%, #1a1a1a 75%);
          background-size: 200% 100%;
          animation: shimmer 1.5s infinite;
        }
        @keyframes shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
        .gif-overlay {
          position: absolute;
          bottom: 0;
          left: 0;
          right: 0;
          background: linear-gradient(transparent, rgba(0,0,0,0.8));
          padding: 16px 6px 4px;
          font-size: 9px;
          color: #ccc;
          text-align: center;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
      `}</style>
    </div>
  );
};

export default GifPanel;