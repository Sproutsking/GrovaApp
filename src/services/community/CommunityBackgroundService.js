// services/community/CommunityBackgroundService.js
class CommunityBackgroundService {
  constructor() {
    this.storageKey = "community_backgrounds";
    this.listeners = new Set();
    
    this.backgrounds = [
      { id: "space", name: "Space Nebula", icon: "🌌", description: "Deep cosmic stars" },
      { id: "neon", name: "Neon Pulse", icon: "✨", description: "Electric neon waves" },
      { id: "tech", name: "Tech Grid", icon: "🎮", description: "Digital circuit lines" },
      { id: "matrix", name: "Matrix Rain", icon: "⚡", description: "Cascading code" },
      { id: "security", name: "Cyber Shield", icon: "🔒", description: "Encrypted network" },
      { id: "minimal", name: "Pure Dark", icon: "⬛", description: "Simple elegance" },
      { id: "lime", name: "Lime Glow", icon: "💚", description: "Vibrant green energy" },
      { id: "gold", name: "Golden Hour", icon: "🌅", description: "Warm luxury shine" },
      { id: "noir", name: "Absolute Void", icon: "🌑", description: "Pure black canvas" },
      { id: "midnight", name: "Midnight Sky", icon: "🌃", description: "Dual aurora glow" },
      { id: "ocean", name: "Deep Ocean", icon: "🌊", description: "Underwater depths" },
      { id: "sunset", name: "Sunset Vibes", icon: "🌇", description: "Warm twilight" },
      { id: "forest", name: "Emerald Forest", icon: "🌲", description: "Deep woodland" },
      { id: "aurora", name: "Aurora Waves", icon: "🌈", description: "Northern lights" },
      { id: "cyber", name: "Cyber Pink", icon: "💖", description: "Neon cyberpunk" },
      { id: "royal", name: "Royal Purple", icon: "👑", description: "Majestic luxury" },
    ];
  }

  getBackground(userId, communityId) {
    try {
      const stored = localStorage.getItem(this.storageKey);
      if (!stored) return "space";

      const backgrounds = JSON.parse(stored);
      const key = `${userId}_${communityId}`;
      return backgrounds[key] || "space";
    } catch (error) {
      console.error("Error getting background:", error);
      return "space";
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
    const theme = this.backgrounds.find(bg => bg.id === backgroundId);
    return theme || this.backgrounds[0];
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