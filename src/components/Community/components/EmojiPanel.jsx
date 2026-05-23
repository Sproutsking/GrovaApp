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
      className="emoji-panel-msg"
      style={style}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="ep-search">
        <Search size={14} color="#666" />
        <input
          ref={searchRef}
          type="text"
          placeholder="Search emoji..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="ep-search-input"
        />
      </div>

      <div className="ep-categories">
        {Object.entries(emojiCategories).map(([key, cat]) => {
          const Icon = cat.icon;
          return (
            <button
              key={key}
              className={`ep-cat-btn ${activeCategory === key && !searchTerm ? "active" : ""}`}
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

      <div className="ep-grid">
        {filteredEmojis.map((emoji, i) => (
          <button key={i} className="ep-item" onClick={() => onSelect(emoji)}>
            {emoji}
          </button>
        ))}
        {filteredEmojis.length === 0 && (
          <div className="ep-empty">No results</div>
        )}
      </div>

      <style>{`
        .emoji-panel-msg {
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

        .ep-search {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 12px;
          border-bottom: 1px solid rgba(255,255,255,0.06);
        }

        .ep-search-input {
          flex: 1;
          background: rgba(255,255,255,0.06);
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 6px;
          padding: 6px 10px;
          color: #fff;
          font-size: 13px;
          outline: none;
        }
        .ep-search-input:focus {
          border-color: rgba(132,204,22,0.4);
        }

        .ep-categories {
          display: flex;
          gap: 3px;
          padding: 8px 10px;
          border-bottom: 1px solid rgba(255,255,255,0.06);
        }

        .ep-cat-btn {
          flex: 1;
          height: 32px;
          background: transparent;
          border: 1px solid transparent;
          border-radius: 6px;
          color: #555;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.15s;
        }
        .ep-cat-btn:hover {
          background: rgba(132,204,22,0.1);
          color: #84cc16;
        }
        .ep-cat-btn.active {
          background: rgba(132,204,22,0.15);
          border-color: rgba(132,204,22,0.3);
          color: #84cc16;
        }

        .ep-grid {
          flex: 1;
          display: grid;
          grid-template-columns: repeat(8, 1fr);
          gap: 2px;
          padding: 8px;
          overflow-y: auto;
          scrollbar-width: thin;
          scrollbar-color: rgba(132,204,22,0.3) transparent;
        }
        .ep-grid::-webkit-scrollbar { width: 5px; }
        .ep-grid::-webkit-scrollbar-thumb { background: rgba(132,204,22,0.3); border-radius: 3px; }

        .ep-item {
          aspect-ratio: 1;
          background: transparent;
          border: none;
          border-radius: 5px;
          font-size: 20px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: background 0.1s, transform 0.1s;
        }
        .ep-item:hover {
          background: rgba(132,204,22,0.15);
          transform: scale(1.15);
        }

        .ep-empty {
          grid-column: 1 / -1;
          text-align: center;
          color: #444;
          font-size: 13px;
          padding: 24px 0;
        }

        @media (max-width: 420px) {
          .emoji-panel-msg { width: 300px; height: 360px; }
          .ep-grid { grid-template-columns: repeat(7, 1fr); }
          .ep-item { font-size: 18px; }
        }
      `}</style>
    </div>
  );
};

export default EmojiPanel;
