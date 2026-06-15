import { useEffect, useState, useRef } from "react";
import { useBackNavigation } from "../contexts/BackNavigationContext";

export const useBackButton = (isAtRoot) => {
  const [showExitPrompt, setShowExitPrompt] = useState(false);
  const lastBackPressRef = useRef(0);
  const DOUBLE_BACK_DELAY = 2000;
  const { register } = useBackNavigation();

  useEffect(() => {
    const handler = () => {
      if (!isAtRoot()) return false;

      const now = Date.now();
      if (now - lastBackPressRef.current < DOUBLE_BACK_DELAY) {
        window.history.back();
        return true;
      }

      lastBackPressRef.current = now;
      setShowExitPrompt(true);
      setTimeout(() => setShowExitPrompt(false), DOUBLE_BACK_DELAY);
      return true;
    };

    const unregister = register(handler);
    return unregister;
  }, [isAtRoot, register]);

  useEffect(() => {
    if (window.history.state === null) {
      window.history.replaceState({ initial: true }, "");
    }
  }, []);

  return { showExitPrompt };
};
