import React, { useState, useEffect, useRef } from "react";
import { X, Search, Play, Pause, TrendingUp, Music, Clock } from "lucide-react";
import "./SoundLibrary.css";

const SOUND_CATEGORIES = [
  "Trending",
  "Pop",
  "Hip Hop",
  "Electronic",
  "Rock",
  "R&B",
  "Country",
  "Jazz",
  "Classical",
  "Ambient",
  "Cinematic",
  "Gaming"
];

const MOCK_SOUNDS = [
  { id: 1, name: "Summer Vibes", artist: "Audio Creator", duration: 180, category: "Pop", trending: true, uses: 15420 },
  { id: 2, name: "Epic Cinematic", artist: "Soundtrack Pro", duration: 240, category: "Cinematic", trending: true, uses: 12350 },
  { id: 3, name: "Lo-Fi Beats", artist: "Chill Master", duration: 150, category: "Ambient", trending: false, uses: 8970 },
  { id: 4, name: "Upbeat Energy", artist: "Pop Stars", duration: 195, category: "Pop", trending: true, uses: 18900 },
  { id: 5, name: "Trap Beat", artist: "Hip Hop King", duration: 160, category: "Hip Hop", trending: false, uses: 7650 },
  { id: 6, name: "Acoustic Guitar", artist: "Folk Sounds", duration: 210, category: "Country", trending: false, uses: 5430 },
  { id: 7, name: "Electronic Drop", artist: "EDM Master", duration: 175, category: "Electronic", trending: true, uses: 14200 },
  { id: 8, name: "Jazz Night", artist: "Smooth Jazz", duration: 200, category: "Jazz", trending: false, uses: 3210 },
];

const SoundLibrary = ({ onSelect, onClose }) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("Trending");
  const [sounds, setSounds] = useState(MOCK_SOUNDS);
  const [playingId, setPlayingId] = useState(null);
  const [selectedSound, setSelectedSound] = useState(null);
  
  const audioRef = useRef(null);

  useEffect(() => {
    // In production, fetch from API
    // fetchSounds(activeCategory, searchQuery);
  }, [activeCategory, searchQuery]);

  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatUses = (num) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  const togglePlay = (sound) => {
    if (playingId === sound.id) {
      audioRef.current?.pause();
      setPlayingId(null);
    } else {
      // In production, load actual audio
      setPlayingId(sound.id);
      // audioRef.current.src = sound.audioUrl;
      // audioRef.current.play();
    }
  };

  const handleSelect = () => {
    if (selectedSound) {
      onSelect(selectedSound);
      onClose();
    }
  };

  const filteredSounds = sounds.filter(sound => {
    const matchesSearch = sound.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         sound.artist.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = activeCategory === "Trending" 
      ? sound.trending 
      : sound.category === activeCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="sound-library-overlay" onClick={onClose}>
      <div className="sound-library" onClick={(e) => e.stopPropagation()}>
        <div className="sound-library-header">
          <h2 className="sound-library-title">
            <Music size={24} />
            Sound Library
          </h2>
          <button className="sound-close-btn" onClick={onClose}>
            <X size={24} />
          </button>
        </div>

        <div className="sound-search-bar">
          <Search size={20} />
          <input
            type="text"
            placeholder="Search sounds or artists..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="sound-search-input"
          />
        </div>

        <div className="sound-categories">
          {SOUND_CATEGORIES.map((category) => (
            <button
              key={category}
              className={`sound-category-btn ${activeCategory === category ? "active" : ""}`}
              onClick={() => setActiveCategory(category)}
            >
              {category === "Trending" && <TrendingUp size={16} />}
              {category}
            </button>
          ))}
        </div>

        <div className="sound-list">
          {filteredSounds.map((sound) => (
            <div
              key={sound.id}
              className={`sound-item ${selectedSound?.id === sound.id ? "selected" : ""}`}
              onClick={() => setSelectedSound(sound)}
            >
              <button
                className="sound-play-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  togglePlay(sound);
                }}
              >
                {playingId === sound.id ? <Pause size={20} /> : <Play size={20} />}
              </button>

              <div className="sound-info">
                <div className="sound-name">{sound.name}</div>
                <div className="sound-artist">{sound.artist}</div>
              </div>

              <div className="sound-meta">
                <span className="sound-duration">
                  <Clock size={14} />
                  {formatDuration(sound.duration)}
                </span>
                <span className="sound-uses">
                  {formatUses(sound.uses)} uses
                </span>
              </div>

              {sound.trending && (
                <div className="sound-trending-badge">
                  <TrendingUp size={12} />
                  Trending
                </div>
              )}
            </div>
          ))}

          {filteredSounds.length === 0 && (
            <div className="sound-empty">
              <Music size={48} />
              <p>No sounds found</p>
              <p className="sound-empty-sub">Try a different search or category</p>
            </div>
          )}
        </div>

        <div className="sound-library-footer">
          <button className="sound-cancel-btn" onClick={onClose}>
            Cancel
          </button>
          <button
            className="sound-select-btn"
            onClick={handleSelect}
            disabled={!selectedSound}
          >
            Use Sound
          </button>
        </div>

        <audio ref={audioRef} />
      </div>
    </div>
  );
};

export default SoundLibrary;