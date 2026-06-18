import { useEffect } from "react";
import { useBackNavigation } from "../contexts/BackNavigationContext";

// Observe DOM for elements that opt-in via `data-back-close`.
// When such an element is added, push a history state and register a
// back-handler that dispatches `xv:dom-back-close` on the element so the
// owning React component can close itself.
export default function useDomBackRegistry() {
  const { register } = useBackNavigation();

  useEffect(() => {
    if (typeof window === "undefined" || !document.body) return;

    const registered = new WeakMap();

    function tryRegister(el) {
      if (!el || registered.has(el)) return;
      // Mark registered to avoid duplicates
      registered.set(el, true);

      // Push a state so BackNavigationContext will intercept popstate
      try { window.history.pushState({ domBack: true }, ""); } catch {}

      // Register a back handler that dispatches an event to close this element
      const unregister = register(() => {
        try {
          el.dispatchEvent(new CustomEvent("xv:dom-back-close", { bubbles: true }));
        } catch {}
        // Returning false allows native navigation (history.back) to continue
        return false;
      });

      // If the element is removed from DOM, unregister the handler
      const mo = new MutationObserver(() => {
        if (!document.body.contains(el)) {
          try { unregister(); } catch {}
          mo.disconnect();
        }
      });
      mo.observe(document.body, { childList: true, subtree: true });
    }

    const obs = new MutationObserver((lists) => {
      for (const m of lists) {
        for (const node of m.addedNodes) {
          if (!(node instanceof Element)) continue;
          if (node.hasAttribute("data-back-close")) tryRegister(node);
          const matches = node.querySelectorAll ? node.querySelectorAll("[data-back-close]") : [];
          matches.forEach((el) => tryRegister(el));
        }
      }
    });

    obs.observe(document.body, { childList: true, subtree: true });

    // Also register any existing elements on mount
    try {
      document.querySelectorAll("[data-back-close]").forEach((el) => tryRegister(el));
    } catch {}

    return () => { obs.disconnect(); };
  }, [register]);
}
