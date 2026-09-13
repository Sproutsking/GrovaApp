// services/community/CommunityBackgroundService.js
import dmBackgroundService from "../messages/BackgroundService";
import communityBgHexaGlow from "../../components/Messages/Assets/backgrounds/download (49).jpg";
import communityBgHexaWave from "../../components/Messages/Assets/backgrounds/download (48).jpg";
import communityBgHexaNight from "../../components/Messages/Assets/backgrounds/download (47).jpg";

class CommunityBackgroundService {
  constructor() {
    this.storageKey = "community_backgrounds";
    this.listeners = new Set();

    this.backgrounds = [
      {
        id: "classic_weave",
        name: "Classic Weave",
        icon: "🌀",
        description: "Option 1 — shared DM default background",
        style: dmBackgroundService.getBgStyle("classic_weave"),
      },
      {
        id: "nova_weave",
        name: "Nova Weave",
        icon: "✦",
        description: "Option 2 — ref 2 artwork",
        style: dmBackgroundService.getBgStyle("nova_weave"),
      },
      {
        id: "grid",
        name: "Grid",
        icon: "▦",
        description: "Option 3 — pure black background with no grid lines",
        style: {
          background: "#000000",
          backgroundImage: "none",
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundRepeat: "no-repeat",
        },
      },
      {
        id: "aurora",
        name: "Hexa Glow",
        icon: "✨",
        description: "Option 4 — shared artwork",
        style: {
          backgroundImage: `linear-gradient(180deg, rgba(5, 8, 15, 0.66), rgba(5, 8, 15, 0.58)), url(${communityBgHexaGlow})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundRepeat: "no-repeat",
        },
      },
      {
        id: "xeevia_weave",
        name: "Hexa Wave",
        icon: "✦",
        description: "Alternate shared hexagon wallpaper",
        style: {
          backgroundImage: `linear-gradient(180deg, rgba(5, 8, 15, 0.66), rgba(5, 8, 15, 0.56)), url(${communityBgHexaWave})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundRepeat: "no-repeat",
        },
      },
      {
        id: "constellation",
        name: "Hexa Night",
        icon: "🌙",
        description: "Shared hexagon artwork with cool lighting",
        style: {
          backgroundImage: `linear-gradient(180deg, rgba(4, 7, 14, 0.72), rgba(4, 7, 14, 0.56)), url(${communityBgHexaNight})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundRepeat: "no-repeat",
        },
      },
      { id: "minimal", name: "Pure Dark", icon: "⬛", description: "Simple elegance", style: { background: "linear-gradient(135deg, #000000 0%, #0a0a0a 100%)", backgroundSize: "cover", backgroundPosition: "center", backgroundRepeat: "no-repeat" } },
      { id: "matrix",  name: "Matrix Rain", icon: "⚡", description: "Cascading code", style: { background: "repeating-linear-gradient(90deg, transparent, transparent 40px, rgba(0, 255, 0, 0.08) 40px, rgba(0, 255, 0, 0.08) 41px), #000000", backgroundSize: "cover", backgroundPosition: "center", backgroundRepeat: "no-repeat" } },
      { id: "lime",    name: "Lime Glow", icon: "💚", description: "Vibrant green energy", style: { background: "radial-gradient(circle at 30% 50%, rgba(156,255,0,0.2) 0%, transparent 60%), linear-gradient(135deg, #000000 0%, #0a0a0a 100%)", backgroundSize: "cover", backgroundPosition: "center", backgroundRepeat: "no-repeat" } },
    ];
  }

  normalizeBackgroundSelection(backgroundId) {
    if (typeof backgroundId === "string" && backgroundId.startsWith("custom:")) {
      return backgroundId;
    }

    if (typeof backgroundId === "string") {
      const theme = this.backgrounds.find((bg) => bg.id === backgroundId);
      if (theme) return theme.id;
    }

    if (typeof backgroundId === "number" && this.backgrounds[backgroundId]) {
      return this.backgrounds[backgroundId].id;
    }

    return "classic_weave";
  }

  getBackground(userId, communityId) {
    try {
      const stored = localStorage.getItem(this.storageKey);
      if (!stored) return "classic_weave";

      const backgrounds = JSON.parse(stored);
      const key = `${userId}_${communityId}`;
      const savedBackground = backgrounds[key] || "classic_weave";

      return this.normalizeBackgroundSelection(savedBackground);
    } catch (error) {
      console.error("Error getting background:", error);
      return "classic_weave";
    }
  }

  setBackground(userId, communityId, backgroundId) {
    try {
      const stored = localStorage.getItem(this.storageKey);
      const backgrounds = stored ? JSON.parse(stored) : {};

      const key = `${userId}_${communityId}`;
      backgrounds[key] = backgroundId;

      localStorage.setItem(this.storageKey, JSON.stringify(backgrounds));
      this.emit();
      return true;
    } catch (error) {
      console.error("Error setting background:", error);
      return false;
    }
  }

  getTheme(backgroundId) {
    if (typeof backgroundId === "string" && backgroundId.startsWith("custom:")) {
      const image = backgroundId.slice("custom:".length);
      return {
        id: backgroundId,
        name: "Custom image",
        icon: "🖼️",
        description: "Uploaded background",
        style: {
          backgroundImage: `linear-gradient(180deg, rgba(4, 5, 10, 0.62), rgba(4, 5, 10, 0.48)), url(${image})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundRepeat: "no-repeat",
        },
      };
    }

    const theme = this.backgrounds.find(bg => bg.id === backgroundId);
    return theme || this.backgrounds.find((bg) => bg.id === "classic_weave") || this.backgrounds[0];
  }

  getAllThemes() {
    return this.backgrounds;
  }

  clearBackground(userId, communityId) {
    try {
      const stored = localStorage.getItem(this.storageKey);
      if (!stored) return true;

      const backgrounds = JSON.parse(stored);
      const key = `${userId}_${communityId}`;
      delete backgrounds[key];

      localStorage.setItem(this.storageKey, JSON.stringify(backgrounds));
      this.emit();
      return true;
    } catch (error) {
      console.error("Error clearing background:", error);
      return false;
    }
  }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  emit() {
    this.listeners.forEach((listener) => {
      try {
        listener();
      } catch (e) {
        console.error("Listener error:", e);
      }
    });
  }
}

export default new CommunityBackgroundService();