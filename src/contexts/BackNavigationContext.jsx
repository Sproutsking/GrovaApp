import React, { createContext, useRef, useCallback, useEffect } from "react";

export const BackNavigationContext = createContext({
  register: () => () => {},
  triggerBack: () => false,
  hasHandlers: () => false,
});

export const BackNavigationProvider = ({ children }) => {
  const handlersRef = useRef([]);

  const register = useCallback((handler) => {
    handlersRef.current.push(handler);
    return () => { handlersRef.current = handlersRef.current.filter(h => h !== handler); };
  }, []);

  const hasHandlers = useCallback(() => handlersRef.current.length > 0, []);

  // triggerBack: call the top-most handler. Supports async handlers.
  const triggerBack = useCallback(async () => {
    const handlers = handlersRef.current;
    if (handlers.length === 0) return false;
    const handler = handlers[handlers.length - 1];
    try {
      const result = await Promise.resolve(handler());
      return result !== false;
    } catch (e) {
      // If a handler throws, treat as handled to avoid falling through.
      return true;
    }
  }, []);

  useEffect(() => {
    if (window.history.state == null) {
      window.history.replaceState({ __back_navigation: true }, "");
    }

    const onPop = async (e) => {
      try {
        const handled = await triggerBack();
        if (handled) {
          // Prevent other popstate listeners (app routing) from handling
          try { e.stopImmediatePropagation(); } catch {}
          // re-push a state so the app remains in place
          try { window.history.pushState({ __back_navigation: true }, ""); } catch {}
        } else {
          // allow default navigation
        }
      } catch (err) {
        // swallow errors — don't block navigation on context errors
      }
    };

    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [triggerBack]);

  return (
    <BackNavigationContext.Provider value={{ register, triggerBack, hasHandlers }}>
      {children}
    </BackNavigationContext.Provider>
  );
};

export const useBackNavigation = () => React.useContext(BackNavigationContext);
