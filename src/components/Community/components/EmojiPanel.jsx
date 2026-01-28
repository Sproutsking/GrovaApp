import React, { useState } from "react";
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
  Image as ImageIcon,
  Film,
} from "lucide-react";

const EmojiPanel = ({ onSelect, onClose }) => {
  const [activeCategory, setActiveCategory] = useState("people");
  const [searchTerm, setSearchTerm] = useState("");

  const emojiCategories = {
    people: {
      icon: Smile,
      name: "Smileys & People",
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
        "🖕",
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
        "🌊",
      ],
    },
    food: {
      icon: Coffee,
      name: "Food & Drink",
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
        "🦴",
        "🌭",
        "🍔",
        "🍟",
        "🍕",
        "🫓",
        "🥪",
        "🥙",
        "🧆",
        "🌮",
        "🌯",
        "🫔",
        "🥗",
        "🥘",
        "🫕",
        "🥫",
        "🍝",
        "🍜",
        "🍲",
        "🍛",
        "🍣",
        "🍱",
        "🥟",
        "🦪",
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
      name: "Travel & Places",
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
        "🔫",
        "💣",
        "🧨",
        "🪓",
        "🔪",
        "🗡",
        "⚔️",
        "🛡",
      ],
    },
    memes: {
      icon: Film,
      name: "Memes & GIFs",
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
    : emojiCategories[activeCategory].emojis;

  return (
    <>
      <div className="emoji-panel-full" onClick={(e) => e.stopPropagation()}>
        <div className="emoji-search">
          <Search size={16} />
          <input
            type="text"
            placeholder="Search emoji..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="emoji-categories">
          {Object.entries(emojiCategories).map(([key, category]) => {
            const Icon = category.icon;
            return (
              <button
                key={key}
                className={`category-btn ${activeCategory === key ? "active" : ""}`}
                onClick={() => {
                  setActiveCategory(key);
                  setSearchTerm("");
                }}
                title={category.name}
              >
                <Icon size={18} />
              </button>
            );
          })}
        </div>

        <div className="emoji-grid-full">
          {filteredEmojis.map((emoji, idx) => (
            <button
              key={idx}
              className="emoji-item-full"
              onClick={() => onSelect(emoji)}
            >
              {emoji}
            </button>
          ))}
        </div>
      </div>

      <style>{`
        .emoji-panel-full {
          position: absolute;
          bottom: 70px;
          left: 20px;
          width: 380px;
          height: 450px;
          background: rgba(15, 15, 15, 0.98);
          border: 2px solid rgba(156, 255, 0, 0.25);
          border-radius: 16px;
          overflow: hidden;
          display: flex;
          flex-direction: column;
          box-shadow: 0 12px 48px rgba(0, 0, 0, 0.8), 0 0 80px rgba(156, 255, 0, 0.15);
          backdrop-filter: blur(20px);
          animation: emojiPanelSlideUp 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
          z-index: 1000;
        }

        @keyframes emojiPanelSlideUp {
          from { opacity: 0; transform: translateY(20px) scale(0.95); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }

        .emoji-search {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 12px;
          background: linear-gradient(180deg, rgba(26, 26, 26, 0.8) 0%, rgba(15, 15, 15, 0) 100%);
          border-bottom: 2px solid rgba(156, 255, 0, 0.1);
          color: #999;
        }

        .emoji-search input {
          flex: 1;
          background: rgba(26, 26, 26, 0.6);
          border: 1px solid rgba(42, 42, 42, 0.6);
          border-radius: 8px;
          padding: 8px 12px;
          color: #fff;
          font-size: 13px;
          outline: none;
        }

        .emoji-search input:focus {
          border-color: rgba(156, 255, 0, 0.4);
          background: rgba(26, 26, 26, 0.9);
        }

        .emoji-categories {
          display: flex;
          gap: 4px;
          padding: 12px;
          background: linear-gradient(180deg, rgba(26, 26, 26, 0.8) 0%, rgba(15, 15, 15, 0) 100%);
          border-bottom: 2px solid rgba(156, 255, 0, 0.1);
        }

        .category-btn {
          flex: 1;
          height: 40px;
          background: rgba(26, 26, 26, 0.6);
          border: 2px solid rgba(42, 42, 42, 0.6);
          border-radius: 10px;
          color: #999;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .category-btn:hover {
          background: rgba(26, 26, 26, 0.9);
          border-color: rgba(156, 255, 0, 0.3);
          color: #9cff00;
          transform: translateY(-2px);
        }

        .category-btn.active {
          background: linear-gradient(135deg, rgba(132, 204, 22, 0.2) 0%, rgba(132, 204, 22, 0.1) 100%);
          border-color: rgba(156, 255, 0, 0.5);
          color: #9cff00;
          box-shadow: 0 0 20px rgba(156, 255, 0, 0.2);
        }

        .emoji-grid-full {
          flex: 1;
          display: grid;
          grid-template-columns: repeat(8, 1fr);
          gap: 4px;
          padding: 12px;
          overflow-y: auto;
          scrollbar-width: thin;
          scrollbar-color: rgba(156, 255, 0, 0.3) rgba(26, 26, 26, 0.3);
        }

        .emoji-grid-full::-webkit-scrollbar { width: 8px; }
        .emoji-grid-full::-webkit-scrollbar-track { background: rgba(26, 26, 26, 0.3); border-radius: 4px; }
        .emoji-grid-full::-webkit-scrollbar-thumb { background: rgba(156, 255, 0, 0.3); border-radius: 4px; }
        .emoji-grid-full::-webkit-scrollbar-thumb:hover { background: rgba(156, 255, 0, 0.5); }

        .emoji-item-full {
          width: 100%;
          aspect-ratio: 1;
          background: transparent;
          border: none;
          border-radius: 8px;
          font-size: 24px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .emoji-item-full:hover {
          background: rgba(156, 255, 0, 0.15);
          transform: scale(1.2);
          z-index: 1;
        }

        @media (max-width: 768px) {
          .emoji-panel-full {
            width: 320px;
            height: 380px;
            left: 10px;
            bottom: 65px;
          }

          .emoji-grid-full { grid-template-columns: repeat(7, 1fr); }
          .emoji-item-full { font-size: 20px; }
        }
      `}</style>
    </>
  );
};

export default EmojiPanel;
