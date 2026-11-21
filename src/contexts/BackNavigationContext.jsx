import React, { createContext, useRef, useCallback, useEffect } from "react";
import {
  ensureHistoryIndex,
  getHistoryIndex,
  getKnownHistoryIndex,
  replaceHistoryState,
  setKnownHistoryIndex,
} from "../utils/navigationHistory";

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
    const runHandler = (index) => {
      for (let i = index; i >= 0; i -= 1) {
        try {
          const result = handlers[i]();
          if (result && typeof result.then === "function") {
            return result.then((value) => value !== false ? true : runHandler(i - 1)).catch((error) => {
              console.error("[BackNavigation] Back handler failed:", error);
              return true;
            });
          }
          if (result !== false) return true;
        } catch (error) {
          console.error("[BackNavigation] Back handler failed:", error);
          return true;
        }
      }
      return false;
    };

    return runHandler(handlers.length - 1);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    const ensureSeed = () => {
      ensureHistoryIndex();
      const state = window.history.state || {};
      if (!state.__back_navigation && !state.__app_route && state.type !== "app-route") {
        replaceHistoryState({ ...state, __back_navigation: true });
      }
    };

    ensureSeed();

    const restoreCurrentEntry = (event) => {
      restorePopRef.current = true;
      try {
        window.history.forward();
      } catch (error) {
        restorePopRef.current = false;
        console.error("[BackNavigation] Could not restore the current history entry:", error);
        return;
      }

      event.stopImmediatePropagation();
      window.setTimeout(() => { restorePopRef.current = false; }, 500);
    };

    const onPop = (e) => {
      const currentIndex = getKnownHistoryIndex() ?? getHistoryIndex(window.history.state) ?? 0;
      const targetIndex = getHistoryIndex(e.state);
      const isBack = targetIndex === null || targetIndex < currentIndex;
      if (targetIndex !== null) {
        setKnownHistoryIndex(targetIndex);
      } else if (isBack) {
        setKnownHistoryIndex(Math.max(0, currentIndex - 1));
      }

      if (restorePopRef.current) {
        restorePopRef.current = false;
        e.stopImmediatePropagation();
        return;
      }

      if (!isBack) return;

      const handled = triggerBack();
      if (handled && typeof handled.then === "function") {
        handled.then((shouldRestore) => {
          if (shouldRestore) restoreCurrentEntry(e);
        });
      } else if (handled) {
        restoreCurrentEntry(e);
      }
    };

    window.addEventListener("popstate", onPop, true);
    return () => window.removeEventListener("popstate", onPop, true);
  }, [triggerBack]);

  return (
    <BackNavigationContext.Provider value={{ register, triggerBack, hasHandlers }}>
      {children}
    </BackNavigationContext.Provider>
  );
};

export const useBackNavigation = () => React.useContext(BackNavigationContext);
