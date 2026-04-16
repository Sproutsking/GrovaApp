// ============================================================================
// src/services/video/GlobalVideoState.js
//
// THE UNIFIED VIDEO PIPELINE — single source of truth for ALL video state
// across EVERY tab: Posts, Reels, Stories, News.
//
// Features:
//  [VP-1]  Single mute/play state shared across ALL tabs and ALL cards
//  [VP-2]  Currently visible video tracking (one video plays at a time)
//  [VP-3]  Double-tap heart burst animation via event system
//  [VP-4]  Fullscreen open/close events (pauses all background videos)
//  [VP-5]  Session persistence for mute/play preferences
//  [VP-6]  Subscriber pattern — any component can listen to state changes
//  [VP-7]  Tab-aware: switching tabs pauses previous tab's active video
// ============================================================================

const STORAGE_KEYS = {
  PLAY: "xv_global_play",
  MUTE: "xv_global_mute",
  VOL: "xv_global_volume",
};

const GlobalVideoState = {
  // ── Core state ────────────────────────────────────────────────────────────
  globalPlayState: false,
  globalMuteState: true,
  globalVolume: 1.0,
  currentlyVisibleVideo: null, // id of the video currently in viewport
  fullscreenOpen: false, // any fullscreen modal open?
  activeTab: "posts",

  // ── Registry of all mounted video refs ───────────────────────────────────
  // Map<videoId, { ref: HTMLVideoElement, pause: fn, play: fn }>
  _registry: new Map(),

  // ── Pub/sub listeners ─────────────────────────────────────────────────────
  _listeners: new Set(),

  // ── Double-tap heart listeners ────────────────────────────────────────────
  _heartListeners: new Set(),

  // ─────────────────────────────────────────────────────────────────────────
  // Init — restore persisted preferences
  // ─────────────────────────────────────────────────────────────────────────
  init() {
    try {
      const play = sessionStorage.getItem(STORAGE_KEYS.PLAY);
      const mute = sessionStorage.getItem(STORAGE_KEYS.MUTE);
      const vol = sessionStorage.getItem(STORAGE_KEYS.VOL);
      this.globalPlayState = play === null ? false : play === "true";
      this.globalMuteState = mute === null ? true : mute === "true";
      this.globalVolume = vol === null ? 1.0 : parseFloat(vol);
    } catch {
      /* sessionStorage unavailable */
    }
  },

  // ─────────────────────────────────────────────────────────────────────────
  // Subscribe / notify
  // ─────────────────────────────────────────────────────────────────────────
  subscribe(cb) {
    this._listeners.add(cb);
    return () => this._listeners.delete(cb);
  },

  notify() {
    this._listeners.forEach((cb) => {
      try {
        cb({
          play: this.globalPlayState,
          mute: this.globalMuteState,
          volume: this.globalVolume,
        });
      } catch {
        /* ignore listener errors */
      }
    });
  },

  // ─────────────────────────────────────────────────────────────────────────
  // Double-tap heart system
  // ─────────────────────────────────────────────────────────────────────────
  onHeart(cb) {
    this._heartListeners.add(cb);
    return () => this._heartListeners.delete(cb);
  },

  /**
   * Emit a heart event — called when any content is double-tapped
   * @param {string} contentId
   * @param {{ x: number, y: number }} position  — client coords of tap
   * @param {string} contentType  — 'post' | 'reel' | 'story' | 'news'
   */
  emitHeart(contentId, position, contentType = "post") {
    this._heartListeners.forEach((cb) => {
      try {
        cb({ contentId, position, contentType });
      } catch {
        /* ignore */
      }
    });
  },

  // ─────────────────────────────────────────────────────────────────────────
  // State setters — persist + notify
  // ─────────────────────────────────────────────────────────────────────────
  setGlobalPlayState(v) {
    this.globalPlayState = v;
    try {
      sessionStorage.setItem(STORAGE_KEYS.PLAY, v);
    } catch {}
    // If pausing globally, pause all registered videos
    if (!v) this._pauseAll();
    this.notify();
  },

  setGlobalMuteState(v) {
    this.globalMuteState = v;
    try {
      sessionStorage.setItem(STORAGE_KEYS.MUTE, v);
    } catch {}
    // Apply mute state to all registered videos immediately
    this._applyMuteToAll(v);
    this.notify();
  },

  setGlobalVolume(v) {
    this.globalVolume = Math.max(0, Math.min(1, v));
    try {
      sessionStorage.setItem(STORAGE_KEYS.VOL, this.globalVolume);
    } catch {}
    this._applyVolumeToAll(this.globalVolume);
    this.notify();
  },

  setCurrentlyVisibleVideo(id) {
    if (this.currentlyVisibleVideo === id) return;
    // Pause the previously visible video
    const prev = this._registry.get(this.currentlyVisibleVideo);
    if (prev) {
      try {
        prev.videoEl.pause();
      } catch {}
    }
    this.currentlyVisibleVideo = id;
    this.notify();
  },

  setActiveTab(tab) {
    if (this.activeTab === tab) return;
    // Pause all videos when switching tabs
    this._pauseAll();
    this.currentlyVisibleVideo = null;
    this.activeTab = tab;
    this.notify();
  },

  setFullscreenOpen(v) {
    this.fullscreenOpen = v;
    if (v) {
      // Pause all non-fullscreen videos
      this._pauseAll();
    }
    window.dispatchEvent(
      new CustomEvent(v ? "xv:fullscreen-opened" : "xv:fullscreen-closed"),
    );
    this.notify();
  },

  // ─────────────────────────────────────────────────────────────────────────
  // Video registry — components register their video elements here
  // ─────────────────────────────────────────────────────────────────────────
  /**
   * Register a video element so global state can control it
   * @param {string} id       unique video id (usually content.id)
   * @param {HTMLVideoElement} videoEl
   * @returns {Function}      unregister function
   */
  register(id, videoEl) {
    this._registry.set(id, { videoEl });
    // Apply current global state immediately
    try {
      videoEl.muted = this.globalMuteState;
      videoEl.volume = this.globalVolume;
    } catch {}
    return () => this._registry.delete(id);
  },

  // ─────────────────────────────────────────────────────────────────────────
  // Internal helpers
  // ─────────────────────────────────────────────────────────────────────────
  _pauseAll() {
    this._registry.forEach(({ videoEl }) => {
      try {
        if (!videoEl.paused) videoEl.pause();
      } catch {}
    });
  },

  _applyMuteToAll(muted) {
    this._registry.forEach(({ videoEl }) => {
      try {
        videoEl.muted = muted;
      } catch {}
    });
  },

  _applyVolumeToAll(volume) {
    this._registry.forEach(({ videoEl }) => {
      try {
        videoEl.volume = volume;
      } catch {}
    });
  },

  // ─────────────────────────────────────────────────────────────────────────
  // Convenience getters (for components that don't want to subscribe)
  // ─────────────────────────────────────────────────────────────────────────
  getGlobalPlayState() {
    try {
      return sessionStorage.getItem(STORAGE_KEYS.PLAY) === "true";
    } catch {
      return this.globalPlayState;
    }
  },
  getGlobalMuteState() {
    try {
      const v = sessionStorage.getItem(STORAGE_KEYS.MUTE);
      return v === null ? true : v === "true";
    } catch {
      return this.globalMuteState;
    }
  },
};

GlobalVideoState.init();
export default GlobalVideoState;
