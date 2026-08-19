import React, { useState, useRef, useEffect } from "react";
import {
  Smile,
  Heart,
  Zap,
  Coffee,
  Flag,
  Star,
  Users,
  Sparkles,
  Search,
  Film,
} from "lucide-react";

const EmojiPanel = ({ onSelect, onClose, style = {} }) => {
  const [activeCategory, setActiveCategory] = useState("people");
  const [searchTerm, setSearchTerm] = useState("");
  const panelRef = useRef(null);
  const searchRef = useRef(null);

  useEffect(() => {
    // Auto-focus search on mount
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

  const emojiCategories = {
    people: {
      icon: Smile,
      name: "Smileys",
      emojis: [
        "😀",
        "😃",
        "😄",
        "😁",
        "😆",
        "😅",
        "🤣",
        "😂",
        "🙂",
        "🙃",
        "😉",
        "😊",
        "😇",
        "🥰",
        "😍",
        "🤩",
        "😘",
        "😗",
        "😚",
        "😙",
        "😋",
        "😛",
        "😜",
        "🤪",
        "😝",
        "🤑",
        "🤗",
        "🤭",
        "🤫",
        "🤔",
        "🤐",
        "🤨",
        "😐",
        "😑",
        "😶",
        "😏",
        "😒",
        "🙄",
        "😬",
        "🤥",
        "😌",
        "😔",
        "😪",
        "🤤",
        "😴",
        "😷",
        "🤒",
        "🤕",
        "🤢",
        "🤮",
        "🤧",
        "🥵",
        "🥶",
        "😵",
        "🤯",
        "🤠",
        "🥳",
        "😎",
        "🤓",
        "🧐",
        "😕",
        "😟",
        "🙁",
        "😮",
        "😯",
        "😲",
        "😳",
        "🥺",
        "😦",
        "😧",
        "😨",
        "😰",
        "😥",
        "😢",
        "😭",
        "😱",
        "😖",
        "😣",
        "😞",
        "😓",
        "😩",
        "😫",
        "🥱",
        "😤",
        "😡",
        "😠",
        "🤬",
        "👿",
        "💀",
        "💩",
        "🤡",
        "👻",
        "👽",
        "🤖",
        "😺",
        "😸",
        "😹",
        "😻",
        "😼",
        "😽",
        "🙀",
        "😿",
        "😾",
        "👋",
        "🤚",
        "🖐",
        "✋",
        "🖖",
        "👌",
        "🤌",
        "🤏",
        "✌",
        "🤞",
        "🤟",
        "🤘",
        "🤙",
        "👈",
        "👉",
        "👆",
        "👇",
        "☝",
        "👍",
        "👎",
        "✊",
        "👊",
        "🤛",
        "🤜",
        "👏",
        "🙌",
        "👐",
        "🤲",
        "🤝",
        "🙏",
        "💪",
      ],
    },
    celebration: {
      icon: Zap,
      name: "Celebration",
      emojis: [
        "🎉",
        "🎊",
        "🎈",
        "🎁",
        "🎀",
        "🎂",
        "🍰",
        "🧁",
        "🥳",
        "🎆",
        "🎇",
        "✨",
        "🎗",
        "🏆",
        "🥇",
        "🥈",
        "🥉",
        "🏅",
        "🎖",
        "👑",
        "💎",
        "💍",
        "🔥",
        "⚡",
        "💫",
        "⭐",
        "🌟",
        "💥",
        "💯",
        "🚀",
      ],
    },
    hearts: {
      icon: Heart,
      name: "Hearts",
      emojis: [
        "❤️",
        "🧡",
        "💛",
        "💚",
        "💙",
        "💜",
        "🖤",
        "🤍",
        "🤎",
        "💔",
        "❤️‍🔥",
        "❤️‍🩹",
        "💕",
        "💞",
        "💓",
        "💗",
        "💖",
        "💘",
        "💝",
        "💟",
        "♥️",
        "❣️",
      ],
    },
    nature: {
      icon: Sparkles,
      name: "Nature",
      emojis: [
        "🌸",
        "🌺",
        "🌻",
        "🌷",
        "🌹",
        "🥀",
        "🌼",
        "🌿",
        "☘️",
        "🍀",
        "🍃",
        "🍂",
        "🍁",
        "🌾",
        "🌱",
        "🌲",
        "🌳",
        "🌴",
        "🌵",
        "🌊",
        "🌈",
        "🌙",
        "⭐",
        "✨",
        "☀️",
        "🌤",
        "⛅",
        "🌥",
        "☁️",
        "🌦",
        "🌧",
        "⛈",
        "🌩",
        "🌨",
        "❄️",
        "☃️",
        "⛄",
        "🌬",
        "💨",
        "🌪",
        "🌫",
        "🌀",
        "🌍",
        "🌎",
        "🌏",
        "🔥",
        "💧",
      ],
    },
    food: {
      icon: Coffee,
      name: "Food",
      emojis: [
        "🍎",
        "🍏",
        "🍐",
        "🍊",
        "🍋",
        "🍌",
        "🍉",
        "🍇",
        "🍓",
        "🫐",
        "🍈",
        "🍒",
        "🍑",
        "🥭",
        "🍍",
        "🥥",
        "🥝",
        "🍅",
        "🍆",
        "🥑",
        "🥦",
        "🥬",
        "🥒",
        "🌶",
        "🫑",
        "🌽",
        "🥕",
        "🫒",
        "🧄",
        "🧅",
        "🥔",
        "🍠",
        "🥐",
        "🥯",
        "🍞",
        "🥖",
        "🥨",
        "🧀",
        "🥚",
        "🍳",
        "🧈",
        "🥞",
        "🧇",
        "🥓",
        "🥩",
        "🍗",
        "🍖",
        "🌭",
        "🍔",
        "🍟",
        "🍕",
        "🥪",
        "🥙",
        "🧆",
        "🌮",
        "🌯",
        "🥗",
        "🥘",
        "🍝",
        "🍜",
        "🍲",
        "🍛",
        "🍣",
        "🍱",
        "🥟",
        "🍤",
        "🍙",
        "🍚",
        "🍘",
        "🍥",
        "🥠",
        "🥮",
        "🍢",
        "🍡",
        "🍧",
        "🍨",
        "🍦",
        "🥧",
        "🧁",
        "🍰",
        "🎂",
        "🍮",
        "🍭",
        "🍬",
        "🍫",
        "🍿",
        "🍩",
        "🍪",
        "🌰",
        "🥜",
        "☕",
        "🍵",
        "🧃",
        "🥤",
        "🧋",
        "🍶",
        "🍺",
        "🍻",
        "🥂",
        "🍷",
        "🥃",
        "🍸",
        "🍹",
        "🧉",
        "🍾",
        "🧊",
      ],
    },
    activities: {
      icon: Star,
      name: "Activities",
      emojis: [
        "⚽",
        "🏀",
        "🏈",
        "⚾",
        "🥎",
        "🎾",
        "🏐",
        "🏉",
        "🥏",
        "🎱",
        "🪀",
        "🏓",
        "🏸",
        "🏒",
        "🏑",
        "🥍",
        "🏏",
        "🪃",
        "🥅",
        "⛳",
        "🪁",
        "🏹",
        "🎣",
        "🤿",
        "🥊",
        "🥋",
        "🎽",
        "🛹",
        "🛼",
        "🛷",
        "⛸",
        "🥌",
        "🎿",
        "⛷",
        "🏂",
        "🪂",
        "🏋️",
        "🤼",
        "🤸",
        "🤺",
        "⛹️",
        "🤾",
        "🏌️",
        "🏇",
        "🧘",
        "🏊",
        "🤽",
        "🚣",
        "🧗",
        "🚵",
        "🚴",
        "🏆",
        "🥇",
        "🥈",
        "🥉",
        "🏅",
        "🎖",
        "🎗",
        "🎫",
        "🎟",
        "🎪",
        "🎭",
        "🎨",
        "🎬",
        "🎤",
        "🎧",
        "🎼",
        "🎹",
        "🥁",
        "🪘",
        "🎷",
        "🎺",
        "🪗",
        "🎸",
        "🪕",
        "🎻",
        "🎲",
        "♟",
        "🎯",
        "🎳",
        "🎮",
        "🎰",
        "🧩",
      ],
    },
    travel: {
      icon: Flag,
      name: "Travel",
      emojis: [
        "🚗",
        "🚕",
        "🚙",
        "🚌",
        "🚎",
        "🏎",
        "🚓",
        "🚑",
        "🚒",
        "🚐",
        "🛻",
        "🚚",
        "🚛",
        "🚜",
        "🦯",
        "🦽",
        "🦼",
        "🛴",
        "🚲",
        "🛵",
        "🏍",
        "🛺",
        "🚨",
        "🚔",
        "🚍",
        "🚘",
        "🚖",
        "🚡",
        "🚠",
        "🚟",
        "🚃",
        "🚋",
        "🚞",
        "🚝",
        "🚄",
        "🚅",
        "🚈",
        "🚂",
        "🚆",
        "🚇",
        "🚊",
        "🚉",
        "✈️",
        "🛫",
        "🛬",
        "🛩",
        "💺",
        "🛰",
        "🚀",
        "🛸",
        "🚁",
        "🛶",
        "⛵",
        "🚤",
        "🛥",
        "🛳",
        "⛴",
        "🚢",
        "⚓",
        "⛽",
        "🚧",
        "🚦",
        "🚥",
        "🚏",
        "🗺",
        "🗿",
        "🗽",
        "🗼",
        "🏰",
        "🏯",
        "🏟",
        "🎡",
        "🎢",
        "🎠",
        "⛲",
        "⛱",
        "🏖",
        "🏝",
        "🏜",
        "🌋",
        "⛰",
        "🏔",
        "🗻",
        "🏕",
        "⛺",
        "🛖",
        "🏠",
        "🏡",
      ],
    },
    objects: {
      icon: Users,
      name: "Objects",
      emojis: [
        "⌚",
        "📱",
        "📲",
        "💻",
        "⌨️",
        "🖥",
        "🖨",
        "🖱",
        "🖲",
        "🕹",
        "🗜",
        "💽",
        "💾",
        "💿",
        "📀",
        "📼",
        "📷",
        "📸",
        "📹",
        "🎥",
        "📽",
        "🎞",
        "📞",
        "☎️",
        "📟",
        "📠",
        "📺",
        "📻",
        "🎙",
        "🎚",
        "🎛",
        "🧭",
        "⏱",
        "⏲",
        "⏰",
        "🕰",
        "⌛",
        "⏳",
        "📡",
        "🔋",
        "🔌",
        "💡",
        "🔦",
        "🕯",
        "🪔",
        "🧯",
        "🛢",
        "💸",
        "💵",
        "💴",
        "💶",
        "💷",
        "🪙",
        "💰",
        "💳",
        "💎",
        "⚖️",
        "🪜",
        "🧰",
        "🪛",
        "🔧",
        "🔨",
        "⚒",
        "🛠",
        "⛏",
        "🪚",
        "🔩",
        "⚙️",
        "🪤",
        "🧱",
        "⛓",
        "🧲",
        "🪓",
        "🔪",
        "🗡",
        "⚔️",
        "🛡",
      ],
    },
    memes: {
      icon: Film,
      name: "Memes",
      emojis: [
        "😂",
        "🤣",
        "😭",
        "💀",
        "🔥",
        "👀",
        "🤡",
        "💯",
        "🚀",
        "🤯",
        "😳",
        "🥴",
        "🤤",
        "😎",
        "🤓",
        "🧐",
        "🤨",
        "😏",
        "😬",
        "🙃",
        "🫡",
        "🫠",
        "🥹",
        "🫣",
        "🫢",
        "🫥",
        "🤐",
        "🤫",
        "🫨",
        "💩",
      ],
    },
  };

  const filteredEmojis = searchTerm
    ? Object.values(emojiCategories)
        .flatMap((cat) => cat.emojis)
        .filter((emoji) => emoji.includes(searchTerm))
    : emojiCategories[activeCategory]?.emojis || [];

  return (
    <div
      ref={panelRef}
      className="community-emoji-panel"
      style={style}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="community-emoji-search">
        <Search size={14} color="#666" />
        <input
          ref={searchRef}
          type="text"
          placeholder="Search emoji..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="community-emoji-search-input"
        />
      </div>

      <div className="community-emoji-categories">
        {Object.entries(emojiCategories).map(([key, cat]) => {
          const Icon = cat.icon;
          return (
            <button
              key={key}
              className={`community-emoji-category ${activeCategory === key && !searchTerm ? "active" : ""}`}
              onClick={() => {
                setActiveCategory(key);
                setSearchTerm("");
              }}
              title={cat.name}
            >
              <Icon size={16} />
            </button>
          );
        })}
      </div>

      <div className="community-emoji-grid">
        {filteredEmojis.map((emoji, i) => (
          <button key={i} className="community-emoji-item" onClick={() => onSelect(emoji)}>
            {emoji}
          </button>
        ))}
        {filteredEmojis.length === 0 && (
          <div className="community-emoji-empty">No results</div>
        )}
      </div>

      <style>{`
        .community-emoji-panel {
          position: absolute;
          width: min(360px, calc(100vw - 24px));
          height: min(420px, calc(100vh - 24px));
          background: linear-gradient(180deg, #141a16 0%, #0b100d 100%);
          border: 1px solid rgba(156,255,0,0.34);
          border-radius: 16px;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          box-shadow: 0 24px 70px rgba(0,0,0,0.82), 0 0 0 1px rgba(255,255,255,0.04) inset, 0 0 42px rgba(156,255,0,0.12);
          z-index: 10000;
          isolation: isolate;
        }

        .community-emoji-search {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 14px 14px 12px;
          border-bottom: 1px solid rgba(156,255,0,0.12);
          background: rgba(0,0,0,0.16);
        }

        .community-emoji-search-input {
          flex: 1;
          background: rgba(4,8,5,0.86);
          border: 1px solid rgba(156,255,0,0.38);
          border-radius: 9px;
          padding: 9px 11px;
          color: #fff;
          font-size: 13px;
          box-shadow: 0 0 0 3px rgba(156,255,0,0.04) inset;
          outline: none;
        }
        .ep-search-input:focus {
          border-color: rgba(156,255,0,0.72);
          box-shadow: 0 0 0 3px rgba(156,255,0,0.1);
        }

        .community-emoji-categories {
          display: flex;
          gap: 3px;
          padding: 10px 11px;
          border-bottom: 1px solid rgba(255,255,255,0.07);
          background: rgba(255,255,255,0.018);
        }

        .community-emoji-category {
          flex: 1;
          height: 34px;
          background: rgba(255,255,255,0.025);
          border: 1px solid rgba(255,255,255,0.04);
          border-radius: 8px;
          color: #555;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.15s;
        }
        .community-emoji-category:hover {
          background: rgba(132,204,22,0.1);
          color: #84cc16;
        }
        .community-emoji-category.active {
          background: linear-gradient(135deg, rgba(156,255,0,0.2), rgba(156,255,0,0.07));
          border-color: rgba(156,255,0,0.52);
          color: #84cc16;
        }

        .community-emoji-grid {
          flex: 1;
          display: grid;
          grid-template-columns: repeat(8, 1fr);
          gap: 4px;
          padding: 12px;
          overflow-y: auto;
          scrollbar-width: thin;
          scrollbar-color: rgba(132,204,22,0.3) transparent;
        }
        .community-emoji-grid::-webkit-scrollbar { width: 5px; }
        .community-emoji-grid::-webkit-scrollbar-thumb { background: rgba(156,255,0,0.35); border-radius: 3px; }

        .community-emoji-item {
          aspect-ratio: 1;
          background: transparent;
          border: none;
          border-radius: 9px;
          font-size: 21px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: background 0.1s, transform 0.1s;
        }
        .community-emoji-item:hover {
          background: rgba(156,255,0,0.14);
          box-shadow: 0 0 0 1px rgba(156,255,0,0.22) inset;
          transform: scale(1.1);
        }

        .community-emoji-empty {
          grid-column: 1 / -1;
          text-align: center;
          color: #444;
          font-size: 13px;
          padding: 24px 0;
        }

        @media (max-width: 420px) {
          .community-emoji-panel { width: calc(100vw - 24px); height: min(390px, calc(100vh - 24px)); }
          .community-emoji-grid { grid-template-columns: repeat(7, 1fr); }
          .community-emoji-item { font-size: 19px; }
        }
      `}</style>
    </div>
  );
};

export default EmojiPanel;
