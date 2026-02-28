// src/components/SmartTextarea/useUndoStack.js
import { useRef, useState, useCallback } from "react";

const MAX_UNDO = 10;

/**
 * useUndoStack
 * Lightweight undo stack for writing assistant improvements only.
 * Does NOT track every keystroke — only improvement-triggered changes.
 */
export function useUndoStack() {
  const stack = useRef([]);
  const [canUndo, setCanUndo] = useState(false);

  const push = useCallback((value) => {
    stack.current = [...stack.current.slice(-(MAX_UNDO - 1)), value];
    setCanUndo(true);
  }, []);

  const pop = useCallback(() => {
    if (stack.current.length === 0) return null;
    const last = stack.current[stack.current.length - 1];
    stack.current = stack.current.slice(0, -1);
    setCanUndo(stack.current.length > 0);
    return last;
  }, []);

  const clear = useCallback(() => {
    stack.current = [];
    setCanUndo(false);
  }, []);

  return { push, pop, clear, canUndo };
}