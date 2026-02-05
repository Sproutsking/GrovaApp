import React, { useState } from "react";
import { Smile, Heart, Zap, Coffee, Flag, Star, Users, Sparkles, Search, Film, X } from "lucide-react";

const EmojiPanel = ({ onSelect, onClose }) => {
  const [activeCategory, setActiveCategory] = useState("people");
  const [searchTerm, setSearchTerm] = useState("");

  const emojiCategories = {
    people: { icon: Smile, name: "Smileys", emojis: ["😀","😃","😄","😁","😆","😅","🤣","😂","🙂","🙃","😉","😊","😇","🥰","😍","🤩","😘","😗","😚","😙","😋","😛","😜","🤪","😝","🤑","🤗","🤭","🤫","🤔","🤐","🤨","😐","😑","😶","😏","😒","🙄","😬","🤥","😌","😔","😪","🤤","😴","😷","🤒","🤕","🤢","🤮","🤧","🥵","🥶","😵","🤯","🤠","🥳","😎","🤓","🧐","😕","😟","🙁","😮","😯","😲","😳","🥺","😦","😧","😨","😰","😥","😢","😭","😱","😖","😣","😞","😓","😩","😫","🥱","😤","😡","😠","🤬","👿","💀","💩","🤡","👻","👽","🤖","😺","😸","😹","😻","😼","😽","🙀","😿","😾","👋","🤚","🖐","✋","🖖","👌","🤌","🤏","✌","🤞","🤟","🤘","🤙","👈","👉","👆","👇","☝","👍","👎","✊","👊","🤛","🤜","👏","🙌","👐","🤲","🤝","🙏","💪"] },
    celebration: { icon: Zap, name: "Celebration", emojis: ["🎉","🎊","🎈","🎁","🎀","🎂","🍰","🧁","🥳","🎆","🎇","✨","🎗","🏆","🥇","🥈","🥉","🏅","🎖","👑","💎","💍","🔥","⚡","💫","⭐","🌟","💥","💯","🚀"] },
    hearts: { icon: Heart, name: "Hearts", emojis: ["❤️","🧡","💛","💚","💙","💜","🖤","🤍","🤎","💔","❤️‍🔥","❤️‍🩹","💕","💞","💓","💗","💖","💘","💝","💟","♥️","❣️"] },
    nature: { icon: Sparkles, name: "Nature", emojis: ["🌸","🌺","🌻","🌷","🌹","🥀","🌼","🌿","☘️","🍀","🍃","🍂","🍁","🌾","🌱","🌲","🌳","🌴","🌵","🌊","🌈","🌙","⭐","✨","☀️","🌤","⛅","🌥","☁️","🌦","🌧","⛈","🌩","🌨","❄️","☃️","⛄","🌬","💨","🌪","🌫","🌀","🌍","🌎","🌏","🔥","💧","🌊"] },
    food: { icon: Coffee, name: "Food", emojis: ["🍎","🍏","🍐","🍊","🍋","🍌","🍉","🍇","🍓","🫐","🍈","🍒","🍑","🥭","🍍","🥥","🥝","🍅","🍆","🥑","🥦","🥬","🥒","🌶","🫑","🌽","🥕","🧄","🧅","🥔","🍠","🥐","🥯","🍞","🥖","🥨","🧀","🥚","🍳","🥞","🧇","🥓","🥩","🍗","🍖","🌭","🍔","🍟","🍕","🥪","🥙","🧆","🌮","🌯","🥗","🥘","🍝","🍜","🍲","🍛","🍣","🍱","🥟","🍤","🍙","🍚","🍘","🍥","🍡","🍧","🍨","🍦","🥧","🧁","🍰","🎂","🍮","🍭","🍬","🍫","🍿","🍩","🍪","☕","🍵","🥤","🧋","🍶","🍺","🍻","🥂","🍷","🥃","🍸","🍹","🍾"] },
    activities: { icon: Star, name: "Activities", emojis: ["⚽","🏀","🏈","⚾","🥎","🎾","🏐","🏉","🥏","🎱","🏓","🏸","🏒","🏑","🥍","🏏","🥅","⛳","🏹","🎣","🥊","🥋","🎽","🛹","🛼","⛸","🥌","🎿","🏂","🏋️","🤼","🤸","🤺","⛹️","🤾","🏌️","🏇","🧘","🏊","🤽","🚣","🧗","🚵","🚴","🏆","🥇","🥈","🥉","🏅","🎖","🎗","🎫","🎟","🎪","🎭","🎨","🎬","🎤","🎧","🎼","🎹","🥁","🎷","🎺","🎸","🎻","🎲","🎯","🎳","🎮","🎰","🧩"] },
    travel: { icon: Flag, name: "Travel", emojis: ["🚗","🚕","🚙","🚌","🚎","🏎","🚓","🚑","🚒","🚐","🚚","🚛","🚜","🚲","🛵","🏍","🛺","🚨","🚔","🚍","🚘","🚖","🚡","🚠","🚟","🚃","🚋","🚞","🚝","🚄","🚅","🚈","🚂","🚆","🚇","🚊","🚉","✈️","🛫","🛬","🛩","🚁","🛶","⛵","🚤","🛥","🛳","⛴","🚢","⚓","🗺","🗿","🗽","🗼","🏰","🏯","🏟","🎡","🎢","🎠","⛲","🏖","🏝","🏜","🌋","⛰","🏔","🗻","🏕","⛺","🏠","🏡"] },
    objects: { icon: Users, name: "Objects", emojis: ["⌚","📱","📲","💻","⌨️","🖥","🖨","🖱","🕹","💽","💾","💿","📀","📼","📷","📸","📹","🎥","📽","🎞","📞","☎️","📟","📠","📺","📻","🎙","🎚","🎛","⏱","⏲","⏰","🕰","⌛","⏳","📡","🔋","🔌","💡","🔦","🕯","💸","💵","💴","💶","💷","💰","💳","💎","🔧","🔨","⚒","🛠","⛏","🔩","⚙️","🧱","⛓","🔫","💣","🔪","🗡","⚔️","🛡"] },
    memes: { icon: Film, name: "Memes", emojis: ["😂","🤣","😭","💀","🔥","👀","🤡","💯","🚀","🤯","😳","🥴","🤤","😎","🤓","🧐","🤨","😏","😬","🙃","🫡","🫠","🥹","🫣","🫢","🤐","🤫","💩"] },
  };

  const filteredEmojis = searchTerm
    ? Object.values(emojiCategories).flatMap(cat => cat.emojis).filter(e => e.includes(searchTerm))
    : emojiCategories[activeCategory].emojis;

  return (
    <div className="emoji-panel-full" onClick={e => e.stopPropagation()}>
      <div className="ep-header">
        <div className="ep-search">
          <Search size={16} />
          <input
            type="text"
            placeholder="Search emoji..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>
        <button className="ep-close" onClick={onClose}>
          <X size={18} />
        </button>
      </div>

      <div className="ep-categories">
        {Object.entries(emojiCategories).map(([key, cat]) => {
          const Icon = cat.icon;
          return (
            <button
              key={key}
              className={`ep-cat ${activeCategory === key ? "active" : ""}`}
              onClick={() => { setActiveCategory(key); setSearchTerm(""); }}
              title={cat.name}
            >
              <Icon size={18} />
            </button>
          );
        })}
      </div>

      <div className="ep-grid">
        {filteredEmojis.map((emoji, idx) => (
          <button key={idx} className="ep-item" onClick={() => onSelect(emoji)}>
            {emoji}
          </button>
        ))}
      </div>

      <style>{`
        .emoji-panel-full {
          width: 380px;
          height: 450px;
          background: rgba(10, 10, 10, 0.98);
          border: 2px solid rgba(156, 255, 0, 0.3);
          border-radius: 16px;
          overflow: hidden;
          display: flex;
          flex-direction: column;
          box-shadow: 0 16px 64px rgba(0, 0, 0, 0.9);
          backdrop-filter: blur(20px);
          z-index: 2000;
        }

        .ep-header {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 12px;
          background: rgba(26, 26, 26, 0.8);
          border-bottom: 2px solid rgba(156, 255, 0, 0.1);
        }

        .ep-search {
          flex: 1;
          display: flex;
          align-items: center;
          gap: 8px;
          color: #999;
        }

        .ep-search input {
          flex: 1;
          background: rgba(26, 26, 26, 0.6);
          border: 1px solid rgba(42, 42, 42, 0.6);
          border-radius: 8px;
          padding: 8px 12px;
          color: #fff;
          font-size: 13px;
          outline: none;
        }

        .ep-search input:focus {
          border-color: rgba(156, 255, 0, 0.4);
          background: rgba(26, 26, 26, 0.9);
        }

        .ep-close {
          width: 32px;
          height: 32px;
          border-radius: 8px;
          background: rgba(255, 59, 48, 0.15);
          border: 1px solid rgba(255, 59, 48, 0.3);
          color: #ff3b30;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s;
        }

        .ep-close:hover {
          background: rgba(255, 59, 48, 0.25);
          transform: scale(1.05);
        }

        .ep-categories {
          display: flex;
          gap: 4px;
          padding: 12px;
          background: rgba(26, 26, 26, 0.8);
          border-bottom: 2px solid rgba(156, 255, 0, 0.1);
        }

        .ep-cat {
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
          transition: all 0.2s;
        }

        .ep-cat:hover {
          background: rgba(26, 26, 26, 0.9);
          border-color: rgba(156, 255, 0, 0.3);
          color: #9cff00;
          transform: translateY(-2px);
        }

        .ep-cat.active {
          background: rgba(156, 255, 0, 0.2);
          border-color: rgba(156, 255, 0, 0.5);
          color: #9cff00;
          box-shadow: 0 0 20px rgba(156, 255, 0, 0.2);
        }

        .ep-grid {
          flex: 1;
          display: grid;
          grid-template-columns: repeat(8, 1fr);
          gap: 4px;
          padding: 12px;
          overflow-y: auto;
          scrollbar-width: thin;
          scrollbar-color: rgba(156, 255, 0, 0.3) rgba(26, 26, 26, 0.3);
        }

        .ep-grid::-webkit-scrollbar { width: 8px; }
        .ep-grid::-webkit-scrollbar-track { background: rgba(26, 26, 26, 0.3); }
        .ep-grid::-webkit-scrollbar-thumb { background: rgba(156, 255, 0, 0.3); border-radius: 4px; }

        .ep-item {
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
          transition: all 0.2s;
        }

        .ep-item:hover {
          background: rgba(156, 255, 0, 0.15);
          transform: scale(1.2);
          z-index: 1;
        }
      `}</style>
    </div>
  );
};

export default EmojiPanel;