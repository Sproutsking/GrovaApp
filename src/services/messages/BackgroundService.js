// services/messages/backgroundService.js

// Import all backgrounds directly
import bg1 from "../../components/Messages/Assets/matrix-preview.jpg";
import bg2 from "../../components/Messages/Assets/space-preview.jpg";
import bg3 from "../../components/Messages/Assets/neon-preview.jpg";

// ADD NEW BACKGROUNDS HERE:
import bg4 from "../../components/Messages/Assets/tech-preview.jpg";
// import bg5 from '../../components/Messages/Assets/ocean-preview.jpg';

class BackgroundService {
  constructor() {
    this.backgrounds = [
      {
        name: "Dark",
        value: "linear-gradient(135deg, #000000 0%, #1a1a1a 100%)",
        image: null,
      },
      { name: "Night", value: null, image: bg1 },
      { name: "Ocean", value: null, image: bg2 },
      { name: "Forest", value: null, image: bg3 },
      // ADD NEW BACKGROUNDS HERE:
      { name: "Sunset", value: null, image: bg4 },
      // { name: "Beach", value: null, image: bg5 },
    ];

    this.conversationBackgrounds = this.loadConversationBackgrounds();
  }

  loadConversationBackgrounds() {
    try {
      const stored = localStorage.getItem("chat_backgrounds");
      return stored ? JSON.parse(stored) : {};
    } catch {
      return {};
    }
  }

  saveConversationBackgrounds() {
    try {
      localStorage.setItem(
        "chat_backgrounds",
        JSON.stringify(this.conversationBackgrounds),
      );
    } catch (e) {
      console.error("Failed to save backgrounds:", e);
    }
  }

  getBackgrounds() {
    return this.backgrounds;
  }

  getConversationBackground(conversationId) {
    return this.conversationBackgrounds[conversationId] || 0;
  }

  setConversationBackground(conversationId, backgroundIndex) {
    this.conversationBackgrounds[conversationId] = backgroundIndex;
    this.saveConversationBackgrounds();
  }
}

export default new BackgroundService();
