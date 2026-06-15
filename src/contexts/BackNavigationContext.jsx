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

  const triggerBack = useCallback(() => {
    const handlers = handlersRef.current;
    if (handlers.length === 0) return false;
    const handler = handlers[handlers.length - 1];
    try {
      const handled = handler();
      return handled !== false;
    } catch (e) {
      return true;
    }
  }, []);

  useEffect(() => {
    if (window.history.state == null) {
      window.history.replaceState({ __back_navigation: true }, "");
    }

    const onPop = (e) => {
      const handled = triggerBack();
      if (handled) {
        // re-push a state so the app remains in place
        try { window.history.pushState({ __back_navigation: true }, ""); } catch {}
      } else {
        // allow default navigation
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
