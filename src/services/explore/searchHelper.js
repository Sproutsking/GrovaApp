// ============================================================================
// src/services/explore/searchHelper.js - Search Utilities
// ============================================================================

class SearchHelper {
  constructor() {
    this.recentSearchesKey = 'grova_recent_searches';
    this.maxRecentSearches = 10;
  }

  // ==================== RECENT SEARCHES ====================

  getRecentSearches() {
    try {
      const stored = localStorage.getItem(this.recentSearchesKey);
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.error('Failed to load recent searches:', error);
      return [];
    }
  }

  addRecentSearch(query) {
    if (!query || query.trim().length < 2) return;

    try {
      let recent = this.getRecentSearches();
      
      // Remove duplicate if exists
      recent = recent.filter(item => 
        item.query.toLowerCase() !== query.toLowerCase()
      );
      
      // Add new search at the beginning
      recent.unshift({
        query: query.trim(),
        timestamp: new Date().toISOString()
      });
      
      // Keep only the most recent searches
      recent = recent.slice(0, this.maxRecentSearches);
      
      localStorage.setItem(this.recentSearchesKey, JSON.stringify(recent));
    } catch (error) {
      console.error('Failed to save recent search:', error);
    }
  }

  clearRecentSearches() {
    try {
      localStorage.removeItem(this.recentSearchesKey);
    } catch (error) {
      console.error('Failed to clear recent searches:', error);
    }
  }

  removeRecentSearch(query) {
    try {
      let recent = this.getRecentSearches();
      recent = recent.filter(item => item.query !== query);
      localStorage.setItem(this.recentSearchesKey, JSON.stringify(recent));
    } catch (error) {
      console.error('Failed to remove recent search:', error);
    }
  }

  // ==================== SEARCH SUGGESTIONS ====================

  getSuggestions(query, recentSearches = []) {
    if (!query || query.trim().length < 2) {
      return recentSearches.slice(0, 5).map(item => ({
        type: 'recent',
        query: item.query,
        icon: '🕐'
      }));
    }

    const suggestions = [];
    const lowerQuery = query.toLowerCase();

    // Match from recent searches
    const matchingRecent = recentSearches.filter(item =>
      item.query.toLowerCase().includes(lowerQuery)
    );
    
    matchingRecent.forEach(item => {
      suggestions.push({
        type: 'recent',
        query: item.query,
        icon: '🕐'
      });
    });

    // Add common search patterns
    const patterns = this.getSearchPatterns(query);
    patterns.forEach(pattern => {
      if (!suggestions.find(s => s.query === pattern)) {
        suggestions.push({
          type: 'suggestion',
          query: pattern,
          icon: '🔍'
        });
      }
    });

    return suggestions.slice(0, 8);
  }

  getSearchPatterns(query) {
    const patterns = [];
    const lowerQuery = query.toLowerCase().trim();

    // If query starts with #, suggest as hashtag
    if (query.startsWith('#')) {
      patterns.push(query);
    } else if (!query.startsWith('#')) {
      // Suggest hashtag version
      patterns.push(`#${query}`);
    }

    // If query starts with @, suggest as username
    if (query.startsWith('@')) {
      patterns.push(query);
    } else if (!query.startsWith('@')) {
      // Suggest username version
      patterns.push(`@${query}`);
    }

    // Add contextual suggestions based on keywords
    const keywords = {
      story: ['story', 'stories', 'tale', 'narrative'],
      post: ['post', 'posts', 'update'],
      reel: ['reel', 'reels', 'video', 'videos'],
      user: ['user', 'people', 'profile', 'creator']
    };

    Object.entries(keywords).forEach(([type, words]) => {
      if (words.some(word => lowerQuery.includes(word))) {
        patterns.push(`${query} ${type}`);
      }
    });

    return patterns;
  }

  // ==================== HIGHLIGHT SEARCH TERMS ====================

  highlightText(text, query) {
    if (!text || !query) return text;

    const regex = new RegExp(`(${this.escapeRegex(query)})`, 'gi');
    return text.replace(regex, '<mark>$1</mark>');
  }

  escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  // ==================== EXTRACT HASHTAGS ====================

  extractHashtags(text) {
    if (!text) return [];
    const hashtagRegex = /#[\w]+/g;
    const matches = text.match(hashtagRegex) || [];
    return Array.from(new Set(matches.map(tag => tag.toLowerCase())));
  }

  extractMentions(text) {
    if (!text) return [];
    const mentionRegex = /@[\w]+/g;
    const matches = text.match(mentionRegex) || [];
    return Array.from(new Set(matches.map(mention => mention.toLowerCase())));
  }

  // ==================== SEARCH ANALYTICS ====================

  trackSearch(query, resultsCount = 0) {
    // This can be extended to send analytics to your backend
    console.log('Search tracked:', {
      query,
      resultsCount,
      timestamp: new Date().toISOString()
    });
  }

  // ==================== POPULAR SEARCHES ====================

  getPopularSearches() {
    // This would typically come from your backend
    // For now, return common searches
    return [
      { query: 'folklore', icon: '📚', count: 1234 },
      { query: 'romance', icon: '💕', count: 987 },
      { query: 'adventure', icon: '🗺️', count: 856 },
      { query: 'mystery', icon: '🔍', count: 743 },
      { query: 'wisdom', icon: '🧠', count: 621 }
    ];
  }

  // ==================== TRENDING TAGS ====================

  getTrendingTags() {
    // This would typically come from your backend
    return [
      { tag: '#storytelling', count: 2341 },
      { tag: '#creative', count: 1876 },
      { tag: '#inspiration', count: 1543 },
      { tag: '#writing', count: 1234 },
      { tag: '#culture', count: 987 }
    ];
  }

  // ==================== SEARCH FILTERS ====================

  parseSearchFilters(query) {
    const filters = {
      query: query,
      category: null,
      contentType: null,
      dateRange: null,
      sortBy: null
    };

    // Extract category filter (e.g., "category:folklore")
    const categoryMatch = query.match(/category:(\w+)/i);
    if (categoryMatch) {
      filters.category = categoryMatch[1];
      filters.query = query.replace(categoryMatch[0], '').trim();
    }

    // Extract type filter (e.g., "type:story")
    const typeMatch = query.match(/type:(story|post|reel|user)/i);
    if (typeMatch) {
      filters.contentType = typeMatch[1];
      filters.query = query.replace(typeMatch[0], '').trim();
    }

    // Extract date filter (e.g., "date:week")
    const dateMatch = query.match(/date:(today|week|month|year)/i);
    if (dateMatch) {
      filters.dateRange = dateMatch[1];
      filters.query = query.replace(dateMatch[0], '').trim();
    }

    // Extract sort filter (e.g., "sort:popular")
    const sortMatch = query.match(/sort:(popular|recent|trending)/i);
    if (sortMatch) {
      filters.sortBy = sortMatch[1];
      filters.query = query.replace(sortMatch[0], '').trim();
    }

    return filters;
  }

  // ==================== SEARCH VALIDATION ====================

  validateSearchQuery(query) {
    if (!query) {
      return { valid: false, error: 'Search query is required' };
    }

    if (query.trim().length < 2) {
      return { valid: false, error: 'Search query must be at least 2 characters' };
    }

    if (query.length > 100) {
      return { valid: false, error: 'Search query is too long' };
    }

    // Check for suspicious patterns
    if (/[<>{}]/.test(query)) {
      return { valid: false, error: 'Invalid characters in search query' };
    }

    return { valid: true };
  }

  // ==================== AUTOCOMPLETE ====================

  async getAutocomplete(query, source = 'all') {
    // This would call your backend API for autocomplete suggestions
    // For now, return mock data based on query
    const suggestions = [];

    if (query.startsWith('#')) {
      // Tag suggestions
      suggestions.push(
        { type: 'tag', value: `${query}storytelling`, count: 234 },
        { type: 'tag', value: `${query}creative`, count: 187 },
        { type: 'tag', value: `${query}inspiration`, count: 154 }
      );
    } else if (query.startsWith('@')) {
      // User suggestions
      suggestions.push(
        { type: 'user', value: `${query}author`, verified: true },
        { type: 'user', value: `${query}creator`, verified: false },
        { type: 'user', value: `${query}writer`, verified: true }
      );
    } else {
      // General suggestions
      suggestions.push(
        { type: 'query', value: `${query} stories` },
        { type: 'query', value: `${query} posts` },
        { type: 'query', value: `${query} reels` }
      );
    }

    return suggestions;
  }
}

export default new SearchHelper();