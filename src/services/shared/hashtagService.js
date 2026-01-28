// ============================================================================
// src/services/shared/hashtagService.js - Store and track hashtags/mentions
// ============================================================================

class HashtagService {
  constructor() {
    this.STORAGE_KEY = 'grova_hashtags';
    this.MAX_HASHTAGS = 1000; // Limit stored hashtags
  }

  // ==================== GET ALL HASHTAGS ====================
  
  getAllHashtags() {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (!stored) return [];
      
      const data = JSON.parse(stored);
      return data.sort((a, b) => b.count - a.count); // Sort by usage count
    } catch (error) {
      console.error('Failed to get hashtags:', error);
      return [];
    }
  }

  // ==================== ADD HASHTAG ====================
  
  addHashtag(tag) {
    try {
      if (!tag || typeof tag !== 'string') return;
      
      const normalized = tag.toLowerCase().trim();
      if (!normalized) return;

      let hashtags = this.getAllHashtags();
      
      // Find existing
      const existing = hashtags.find(h => h.tag === normalized);
      
      if (existing) {
        // Increment count and update last used
        existing.count++;
        existing.lastUsed = new Date().toISOString();
      } else {
        // Add new hashtag
        hashtags.push({
          tag: normalized,
          count: 1,
          firstUsed: new Date().toISOString(),
          lastUsed: new Date().toISOString()
        });
      }

      // Limit storage size
      if (hashtags.length > this.MAX_HASHTAGS) {
        hashtags = hashtags
          .sort((a, b) => b.count - a.count)
          .slice(0, this.MAX_HASHTAGS);
      }

      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(hashtags));
      
    } catch (error) {
      console.error('Failed to add hashtag:', error);
    }
  }

  // ==================== ADD MULTIPLE HASHTAGS ====================
  
  addHashtags(tags) {
    if (!Array.isArray(tags)) return;
    tags.forEach(tag => this.addHashtag(tag));
  }

  // ==================== EXTRACT AND STORE FROM TEXT ====================
  
  extractAndStore(text) {
    if (!text) return [];
    
    const hashtagPattern = /#([a-zA-Z0-9_]+)/g;
    const matches = text.match(hashtagPattern);
    
    if (!matches) return [];
    
    const tags = matches.map(match => match.substring(1));
    this.addHashtags(tags);
    
    return tags;
  }

  // ==================== GET TRENDING HASHTAGS ====================
  
  getTrending(limit = 10) {
    try {
      const hashtags = this.getAllHashtags();
      
      // Get hashtags used in last 7 days
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      
      return hashtags
        .filter(h => new Date(h.lastUsed) > weekAgo)
        .slice(0, limit);
        
    } catch (error) {
      console.error('Failed to get trending hashtags:', error);
      return [];
    }
  }

  // ==================== SEARCH HASHTAGS ====================
  
  searchHashtags(query, limit = 10) {
    try {
      if (!query) return this.getAllHashtags().slice(0, limit);
      
      const normalized = query.toLowerCase().trim();
      const hashtags = this.getAllHashtags();
      
      return hashtags
        .filter(h => h.tag.includes(normalized))
        .slice(0, limit);
        
    } catch (error) {
      console.error('Failed to search hashtags:', error);
      return [];
    }
  }

  // ==================== GET SUGGESTIONS ====================
  
  getSuggestions(partial, limit = 5) {
    try {
      if (!partial) return [];
      
      const normalized = partial.toLowerCase().trim();
      const hashtags = this.getAllHashtags();
      
      return hashtags
        .filter(h => h.tag.startsWith(normalized))
        .slice(0, limit)
        .map(h => h.tag);
        
    } catch (error) {
      console.error('Failed to get suggestions:', error);
      return [];
    }
  }

  // ==================== CLEAR ALL ====================
  
  clearAll() {
    try {
      localStorage.removeItem(this.STORAGE_KEY);
      console.log('✅ All hashtags cleared');
    } catch (error) {
      console.error('Failed to clear hashtags:', error);
    }
  }

  // ==================== GET STATS ====================
  
  getStats() {
    try {
      const hashtags = this.getAllHashtags();
      
      return {
        total: hashtags.length,
        totalUsage: hashtags.reduce((sum, h) => sum + h.count, 0),
        mostUsed: hashtags[0] || null,
        trending: this.getTrending(5)
      };
      
    } catch (error) {
      console.error('Failed to get hashtag stats:', error);
      return {
        total: 0,
        totalUsage: 0,
        mostUsed: null,
        trending: []
      };
    }
  }
}

const hashtagService = new HashtagService();

// Helper functions to extract hashtags and mentions from text
export const extractHashtags = (text) => {
  if (!text) return [];
  const matches = text.match(/#[a-zA-Z0-9_]+/g);
  return matches ? matches.map(tag => tag.substring(1)) : [];
};

export const extractMentions = (text) => {
  if (!text) return [];
  const matches = text.match(/@[a-zA-Z0-9_]+/g);
  return matches ? matches.map(mention => mention.substring(1)) : [];
};

export default hashtagService;