import { useEffect, useState, useRef } from "react";

export const useBackButton = (isAtRoot) => {
  const [showExitPrompt, setShowExitPrompt] = useState(false);
  const lastBackPressRef = useRef(0);
  const DOUBLE_BACK_DELAY = 2000;

  useEffect(() => {
    const handleBackButton = (event) => {
      if (!isAtRoot()) {
        return;
      }

      event.preventDefault();

      const now = Date.now();
      if (now - lastBackPressRef.current < DOUBLE_BACK_DELAY) {
        window.history.back();
        return;
      }

      lastBackPressRef.current = now;
      setShowExitPrompt(true);

      setTimeout(() => {
        setShowExitPrompt(false);
      }, DOUBLE_BACK_DELAY);
    };

    window.addEventListener("popstate", handleBackButton);

    return () => {
      window.removeEventListener("popstate", handleBackButton);
    };
  }, [isAtRoot]);

  useEffect(() => {
    if (window.history.state === null) {
      window.history.replaceState({ initial: true }, "");
    }
  }, []);

  return { showExitPrompt };
};
