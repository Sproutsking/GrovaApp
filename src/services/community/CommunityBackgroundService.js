// services/community/CommunityBackgroundService.js
class CommunityBackgroundService {
  constructor() {
    this.storageKey = "community_backgrounds";
    this.listeners = new Set();
    
    this.backgrounds = [
      { id: "minimal", name: "Pure Dark",   icon: "⬛", description: "Simple elegance"     },
      { id: "matrix",  name: "Matrix Rain", icon: "⚡", description: "Cascading code"       },
      { id: "lime",    name: "Lime Glow",   icon: "💚", description: "Vibrant green energy" },
    ];
  }

  getBackground(userId, communityId) {
    try {
      const stored = localStorage.getItem(this.storageKey);
      if (!stored) return "minimal";

      const backgrounds = JSON.parse(stored);
      const key = `${userId}_${communityId}`;
      return backgrounds[key] || "minimal";
    } catch (error) {
      console.error("Error getting background:", error);
      return "minimal";
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