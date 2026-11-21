import { useEffect } from "react";
import { useBackNavigation } from "../contexts/BackNavigationContext";

// Observe DOM for elements that opt-in via `data-back-close`.
// Register a back-handler that clicks the element's existing close target.
export default function useDomBackRegistry() {
  const { register } = useBackNavigation();

  useEffect(() => {
    if (typeof window === "undefined" || !document.body) return;

    const registered = new WeakMap();

    function tryRegister(el) {
      if (!el || registered.has(el)) return;
      registered.set(el, true);

      // The marked backdrop already owns a click-to-close action.
      const unregister = register(() => {
        if (!document.body.contains(el)) return false;
        el.click();
        return true;
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
