// ============================================================================
// src/hooks/useDeepLink.js
// ============================================================================
// Consumes the deepLinkTarget prop passed from App.jsx into each tab view,
// scrolls the target item into view, and briefly highlights it.
//
// Usage inside any view (HomeView, ExploreView, etc.):
//
//   const { registerItemRef, clearDeepLink } = useDeepLink(deepLinkTarget);
//
//   // In your list render:
//   <PostCard
//     ref={registerItemRef(post.id)}   ← attach ref to each rendered item
//     key={post.id}
//     ...
//   />
//
// When deepLinkTarget changes to { type: "post", id: "abc123" } the hook:
//   1. Scrolls the DOM element with that id into view (smooth)
//   2. Adds a CSS highlight flash class for 2.5 seconds
//   3. Calls clearDeepLink() to reset so it doesn't re-trigger
//
// deepLinkTarget shape (from App.jsx handleNotificationNavigate):
//   { type: "post" | "reel" | "story" | "profile", id: string }
//   null when nothing to navigate to
// ============================================================================

import { useEffect, useRef, useCallback } from "react";

const HIGHLIGHT_CLASS = "deep-link-highlight";

// Inject the highlight CSS once
if (typeof document !== "undefined") {
  const styleId = "deep-link-highlight-css";
  if (!document.getElementById(styleId)) {
    const style = document.createElement("style");
    style.id = styleId;
    style.textContent = `
      @keyframes deepLinkFlash {
        0%   { box-shadow: 0 0 0 0   rgba(132,204,22,0);   background: rgba(132,204,22,0);   }
        15%  { box-shadow: 0 0 0 4px rgba(132,204,22,0.6); background: rgba(132,204,22,0.08); }
        60%  { box-shadow: 0 0 0 4px rgba(132,204,22,0.3); background: rgba(132,204,22,0.05); }
        100% { box-shadow: 0 0 0 0   rgba(132,204,22,0);   background: rgba(132,204,22,0);   }
      }
      .deep-link-highlight {
        animation: deepLinkFlash 2.5s ease-out forwards;
        border-radius: 12px;
        position: relative;
        z-index: 1;
      }
    `;
    document.head.appendChild(style);
  }
}

/**
 * @param {Object|null} deepLinkTarget  - { type, id } from App.jsx
 * @param {Function}    clearDeepLink   - setter to call after navigating
 *                                        e.g. () => setDeepLinkTarget(null)
 * @param {Object}      options
 * @param {number}      options.scrollDelay  - ms to wait before scrolling (default 300)
 *                                            set higher if your list has async loading
 */
export function useDeepLink(deepLinkTarget, clearDeepLink, options = {}) {
  const { scrollDelay = 300 } = options;

  // Map of itemId → DOM element ref
  const itemRefs = useRef({});

  // Returns a ref callback to attach to each rendered item
  const registerItemRef = useCallback((itemId) => (el) => {
    if (el) {
      itemRefs.current[itemId] = el;
    } else {
      delete itemRefs.current[itemId];
    }
  }, []);

  useEffect(() => {
    if (!deepLinkTarget?.id) return;

    const { id } = deepLinkTarget;

    const scroll = () => {
      const el = itemRefs.current[id];

      if (el) {
        // Remove any existing highlight first
        el.classList.remove(HIGHLIGHT_CLASS);
        // Force reflow so animation restarts cleanly
        void el.offsetWidth;

        el.scrollIntoView({ behavior: "smooth", block: "center" });
        el.classList.add(HIGHLIGHT_CLASS);

        // Clean up class after animation
        const cleanup = setTimeout(() => {
          el.classList.remove(HIGHLIGHT_CLASS);
        }, 2600);

        // Clear the deep link target so this doesn't re-fire
        if (clearDeepLink) clearDeepLink();

        return () => clearTimeout(cleanup);
      } else {
        // Element not rendered yet — the list might still be loading.
        // Try again a few times with backoff.
        return undefined;
      }
    };

    // Initial attempt after delay (list needs to mount first)
    const t1 = setTimeout(() => {
      if (!scroll()) {
        // Retry once more after a longer delay
        const t2 = setTimeout(() => {
          scroll();
        }, 800);
        return () => clearTimeout(t2);
      }
    }, scrollDelay);

    return () => clearTimeout(t1);
  }, [deepLinkTarget, clearDeepLink, scrollDelay]);

  return { registerItemRef };
}