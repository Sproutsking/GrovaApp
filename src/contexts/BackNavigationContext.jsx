import React, { createContext, useRef, useCallback, useEffect } from "react";

export const BackNavigationContext = createContext({
  register: () => () => {},
  triggerBack: () => false,
  hasHandlers: () => false,
});

export const BackNavigationProvider = ({ children }) => {
  const handlersRef = useRef([]);

  const register = useCallback((handler) => {
    handlersRef.current = [...handlersRef.current, handler];
    return () => {
      handlersRef.current = handlersRef.current.filter((h) => h !== handler);
    };
  }, []);

  const hasHandlers = useCallback(() => handlersRef.current.length > 0, []);

  const triggerBack = useCallback(async () => {
    const handlers = handlersRef.current;
    if (handlers.length === 0) return false;
    const handler = handlers[handlers.length - 1];
    try {
      const result = await Promise.resolve(handler());
      return result !== false;
    } catch (e) {
      return true;
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    const ensureSeed = () => {
      const state = window.history.state || {};
      if (!state.__back_navigation && !state.__app_route) {
        window.history.replaceState({ __back_navigation: true }, "");
      }
    };

    ensureSeed();

    const onPop = async (e) => {
      try {
        const handled = await triggerBack();
        if (handled) {
          try { e.stopImmediatePropagation(); } catch {}
          try { window.history.pushState({ __back_navigation: true }, ""); } catch {}
          return;
        }
      } catch {}
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
