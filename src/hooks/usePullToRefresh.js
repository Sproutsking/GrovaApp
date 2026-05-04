// src/hooks/usePullToRefresh.js — v2
// ============================================================================
// Spring-physics pull-to-refresh + global refresh registry.
//
// MODEL:
//   Each tab/sub-section registers its own async refresh function via
//   refreshRegistry.register(key, fn). PTR gesture detects the active
//   tab + sub-tab and calls ONLY that handler — no broadcast.
//
//   Key hierarchy (most → least specific):
//     'home:reels'   → reels-specific refresh
//     'home'         → generic home refresh
//     'wallet'       → wallet overview refresh
//     etc.
//
// PHYSICS:
//   Rubber-band resistance formula creates authentic iOS-like feel.
//   Direction-lock prevents accidental triggers during horizontal swipes.
//   All DOM listeners are in a single useEffect — zero memory leaks.
//
// INTEGRATION (in each view):
//   import { refreshRegistry } from '../../hooks/usePullToRefresh';
//
//   useEffect(() => {
//     // Use a stable ref so the registry always calls the latest closure
//     const fnRef = { current: myRefreshFn };
//     return refreshRegistry.register('home', () => fnRef.current());
//   }, []);
//
// ============================================================================

import { useCallback, useEffect, useRef, useState } from 'react';

// ── Physics constants ────────────────────────────────────────────────────────
const TRIGGER_THRESHOLD = 80;   // px of rubber-banded pull to trigger refresh
const MAX_DISPLAY_PX    = 108;  // visual ceiling — indicator never goes past this
const RESISTANCE_FACTOR = 3.2;  // higher = heavier/slower pull feeling

// Rubber-band curve: fast at start, diminishing towards ceiling.
// Produces the authentic "pulling through gel" feel.
function applyRubberBand(rawDelta) {
  if (rawDelta <= 0) return 0;
  const bounded = (rawDelta * TRIGGER_THRESHOLD) / (rawDelta + RESISTANCE_FACTOR * TRIGGER_THRESHOLD);
  return Math.min(MAX_DISPLAY_PX, bounded * 1.35);
}

// ── Global refresh registry (module singleton) ────────────────────────────────
// Safe across HMR — window-level fallback avoids duplicate registration.
const _store = (typeof window !== 'undefined' && window._novaRefreshRegistry)
  ? window._novaRefreshRegistry
  : (() => {
      const store = { _map: {} };
      if (typeof window !== 'undefined') window._novaRefreshRegistry = store;
      return store;
    })();

export const refreshRegistry = {
  /**
   * Register a refresh handler for a key.
   * Returns an unregister cleanup function.
   *
   * Keys:
   *   'home'         — fallback for any home sub-tab without a specific handler
   *   'home:posts'   — posts feed specifically
   *   'home:reels'   — reels
   *   'home:stories' — stories
   *   'home:news'    — news
   *   'search'       — explore/search
   *   'create'       — create studio
   *   'community'    — community view
   *   'account'      — account/profile
   *   'wallet'       — wallet overview
   */
  register(key, fn) {
    _store._map[key] = fn;
    return () => {
      if (_store._map[key] === fn) delete _store._map[key];
    };
  },

  unregister(key) {
    delete _store._map[key];
  },

  // Call the most-specific registered handler, falling back up the chain.
  async call(tab, subTab) {
    const specific = subTab ? `${tab}:${subTab}` : null;
    const fn = (specific && _store._map[specific]) || _store._map[tab];
    if (fn) return fn();
  },

  // Expose map for debugging
  get _keys() { return Object.keys(_store._map); },
};

// ── Hook ─────────────────────────────────────────────────────────────────────
export function usePullToRefresh(activeTab, activeSubTab, enabled = true) {
  const containerRef = useRef(null);

  // Use refs for values read inside event handlers to avoid stale closures
  const startYRef        = useRef(0);
  const startXRef        = useRef(0);
  const dirLockRef       = useRef(null); // null | 'v' | 'h'
  const isActiveRef      = useRef(false); // currently pulling
  const pullDistRef      = useRef(0);    // current rubber-banded distance
  const isRefreshingRef  = useRef(false);
  const rafRef           = useRef(null);

  // State for rendering
  const [pullDistance, setPullDistance] = useState(0);
  const [isPulling,    setIsPulling]    = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Keep activeTab/subTab accessible in event handlers via refs
  const activeTabRef    = useRef(activeTab);
  const activeSubTabRef = useRef(activeSubTab);
  useEffect(() => { activeTabRef.current    = activeTab;    }, [activeTab]);
  useEffect(() => { activeSubTabRef.current = activeSubTab; }, [activeSubTab]);

  // ── Trigger refresh ────────────────────────────────────────────────────────
  const triggerRefresh = useCallback(async () => {
    if (isRefreshingRef.current) return;
    isRefreshingRef.current = true;
    setIsRefreshing(true);
    setIsPulling(false);
    setPullDistance(0);
    pullDistRef.current = 0;

    // Satisfying haptic: quick double-pulse
    try { navigator.vibrate?.([12, 40, 18]); } catch {}

    try {
      await refreshRegistry.call(activeTabRef.current, activeSubTabRef.current);
    } catch (e) {
      console.warn('[PTR] Refresh handler error:', e);
    }

    // Minimum indicator display time — prevents visual flash
    await new Promise(r => setTimeout(r, 550));

    isRefreshingRef.current = false;
    setIsRefreshing(false);
  }, []);

  // ── Touch event handlers ───────────────────────────────────────────────────
  useEffect(() => {
    if (!enabled) return;
    const el = containerRef.current;
    if (!el) return;

    const onTouchStart = (e) => {
      if (isRefreshingRef.current) return;
      startYRef.current  = e.touches[0].clientY;
      startXRef.current  = e.touches[0].clientX;
      dirLockRef.current = null;
      isActiveRef.current = false;
    };

    const onTouchMove = (e) => {
      if (isRefreshingRef.current) return;

      const dy = e.touches[0].clientY - startYRef.current;
      const dx = e.touches[0].clientX - startXRef.current;

      // ── Direction lock ──
      // Wait until movement is unambiguous (>10px) before committing.
      // Strongly prefer horizontal when diagonal — prevents false triggers
      // during swipe-back, carousels, and horizontal scrollers.
      if (!dirLockRef.current) {
        const absX = Math.abs(dx);
        const absY = Math.abs(dy);
        if (absX > absY + 6) {
          dirLockRef.current = 'h';
          return;
        }
        if (absY > 10) {
          dirLockRef.current = 'v';
        } else {
          return; // not enough movement yet
        }
      }

      if (dirLockRef.current === 'h') return; // horizontal swipe — ignore

      // ── Only trigger from scroll top, only on downward drag ──
      const scrollTop = el.scrollTop ?? window.scrollY ?? 0;
      if (scrollTop > 3 || dy <= 0) {
        // User started scrolling — reset
        if (isActiveRef.current) {
          isActiveRef.current  = false;
          pullDistRef.current  = 0;
          cancelAnimationFrame(rafRef.current);
          setIsPulling(false);
          setPullDistance(0);
        }
        return;
      }

      // Prevent native scroll while we're handling PTR
      e.preventDefault();

      const display = applyRubberBand(dy);
      pullDistRef.current = display;
      isActiveRef.current = true;

      cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => {
        setPullDistance(display);
        setIsPulling(display > 8);
      });
    };

    const onTouchEnd = () => {
      if (!isActiveRef.current) return;

      const dist = pullDistRef.current;
      isActiveRef.current  = false;
      pullDistRef.current  = 0;
      dirLockRef.current   = null;
      cancelAnimationFrame(rafRef.current);

      // The rubber-band compresses the visual distance, so 70% of the
      // display threshold is roughly the full raw threshold.
      if (dist >= TRIGGER_THRESHOLD * 0.72) {
        triggerRefresh();
      } else {
        // Snap back — CSS transition handles the animation
        setIsPulling(false);
        setPullDistance(0);
      }
    };

    const onTouchCancel = () => {
      isActiveRef.current = false;
      pullDistRef.current = 0;
      dirLockRef.current  = null;
      setIsPulling(false);
      setPullDistance(0);
    };

    el.addEventListener('touchstart',  onTouchStart,  { passive: true  });
    el.addEventListener('touchmove',   onTouchMove,   { passive: false });
    el.addEventListener('touchend',    onTouchEnd,    { passive: true  });
    el.addEventListener('touchcancel', onTouchCancel, { passive: true  });

    return () => {
      el.removeEventListener('touchstart',  onTouchStart);
      el.removeEventListener('touchmove',   onTouchMove);
      el.removeEventListener('touchend',    onTouchEnd);
      el.removeEventListener('touchcancel', onTouchCancel);
      cancelAnimationFrame(rafRef.current);
    };
  }, [enabled, triggerRefresh]);

  // Expose triggerRefresh so the app can programmatically pull-to-refresh
  // (e.g. from a desktop "refresh" button or after coming back online).
  return { containerRef, pullDistance, isPulling, isRefreshing, triggerRefresh };
}