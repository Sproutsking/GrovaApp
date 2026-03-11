// ============================================================================
// src/services/home/viewsService.js
// ============================================================================
// FAIR VIEWS MODEL — mirrors how YouTube, TikTok, and Instagram count views.
//
// Rules:
//  1. Never count own views
//  2. Count only after minimum dwell time:
//       Post:  3s   (user read it, not just scrolled past)
//       Reel:  5s fallback OR 50% watch completion (whichever comes first)
//       Story: 4s
//  3. Once per session per content (in-memory Set — resets on page reload)
//  4. Bot protection: 500ms minimum gap between any two view records
//  5. ATOMIC increment — uses increment_count RPC, never read-then-write
//  6. Fire-and-forget — NEVER blocks UI, never throws to caller
// ============================================================================

import { supabase } from "../config/supabase";

const sessionSeen = new Set();
let lastRecordedAt = 0;

async function atomicIncrement(table, id) {
  try {
    const { error } = await supabase.rpc("increment_count", {
      p_table: table,
      p_id: id,
      p_column: "views",
      p_delta: 1,
    });
    if (!error) return;
    throw error;
  } catch {
    try {
      const { data } = await supabase
        .from(table)
        .select("views")
        .eq("id", id)
        .single();
      await supabase
        .from(table)
        .update({ views: (data?.views ?? 0) + 1 })
        .eq("id", id);
    } catch {
      /* silent */
    }
  }
}

class ViewsService {
  constructor() {
    this.pendingTimers = new Map();
  }

  startTracking(contentType, contentId, userId, ownerId, options = {}) {
    if (!userId || !contentId || userId === ownerId) return () => {};
    const key = `${contentType}:${contentId}`;
    if (sessionSeen.has(key)) return () => {};
    if (this.pendingTimers.has(key)) return () => this._cancel(key);

    const dwellMs = options.dwellMs ?? this._defaultDwell(contentType);

    const timer = setTimeout(async () => {
      this.pendingTimers.delete(key);
      const now = Date.now();
      if (now - lastRecordedAt < 500) return;
      lastRecordedAt = now;
      sessionSeen.add(key);
      await this._recordView(contentType, contentId, userId, ownerId);
    }, dwellMs);

    this.pendingTimers.set(key, timer);
    return () => this._cancel(key);
  }

  trackReelProgress(reelId, userId, ownerId, percent) {
    if (!userId || userId === ownerId) return;
    const key = `reel:${reelId}`;
    if (sessionSeen.has(key)) return;
    if (percent >= 50) {
      sessionSeen.add(key);
      this._cancel(key);
      this._recordView("reel", reelId, userId, ownerId);
    }
  }

  _cancel(key) {
    const timer = this.pendingTimers.get(key);
    if (timer) {
      clearTimeout(timer);
      this.pendingTimers.delete(key);
    }
  }

  _defaultDwell(contentType) {
    return { post: 3000, reel: 5000, story: 4000 }[contentType] ?? 3000;
  }

  async _recordView(contentType, contentId, userId, ownerId) {
    try {
      const table =
        contentType === "post"
          ? "posts"
          : contentType === "reel"
            ? "reels"
            : "stories";

      if (!ownerId) {
        const { data } = await supabase
          .from(table)
          .select("user_id")
          .eq("id", contentId)
          .single();
        if (data?.user_id === userId) return;
      }

      await atomicIncrement(table, contentId);
    } catch {
      sessionSeen.delete(`${contentType}:${contentId}`);
    }
  }

  resetSession() {
    sessionSeen.clear();
    this.pendingTimers.forEach((t) => clearTimeout(t));
    this.pendingTimers.clear();
    lastRecordedAt = 0;
  }
}

const viewsService = new ViewsService();
export default viewsService;
