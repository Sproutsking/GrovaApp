import React, { createContext, useRef, useCallback, useEffect } from "react";

export const BackNavigationContext = createContext({
  register: () => () => {},
  triggerBack: () => false,
  hasHandlers: () => false,
});

export const BackNavigationProvider = ({ children }) => {
  const handlersRef = useRef([]);
  const restorePopRef = useRef(false);

  const register = useCallback((handler) => {
    handlersRef.current = [...handlersRef.current, handler];
    return () => {
      handlersRef.current = handlersRef.current.filter((h) => h !== handler);
    };
  }, []);

  const hasHandlers = useCallback(() => handlersRef.current.length > 0, []);

  const triggerBack = useCallback(() => {
    const handlers = handlersRef.current;
    if (handlers.length === 0) return false;
    const handler = handlers[handlers.length - 1];
    try {
      const result = handler();
      if (result && typeof result.then === "function") {
        return result.then((value) => value !== false).catch((error) => {
          console.error("[BackNavigation] Back handler failed:", error);
          return true;
        });
      }
      return result !== false;
    } catch (error) {
      console.error("[BackNavigation] Back handler failed:", error);
      return true;
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    const ensureSeed = () => {
      const state = window.history.state || {};
      if (!state.__back_navigation && !state.__app_route && state.type !== "app-route") {
        window.history.replaceState({ __back_navigation: true }, "");
      }
    };

    ensureSeed();

    const restoreCurrentEntry = (event) => {
      try {
        window.history.forward();
      } catch (error) {
        console.error("[BackNavigation] Could not restore the current history entry:", error);
        return;
      }

      restorePopRef.current = true;
      event.stopImmediatePropagation();
      window.setTimeout(() => { restorePopRef.current = false; }, 500);
    };

    const onPop = (e) => {
      if (restorePopRef.current) {
        restorePopRef.current = false;
        return;
      }

      const handled = triggerBack();
      if (handled && typeof handled.then === "function") {
        handled.then((shouldRestore) => {
          if (shouldRestore) restoreCurrentEntry(e);
        });
      } else if (handled) {
        restoreCurrentEntry(e);
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
