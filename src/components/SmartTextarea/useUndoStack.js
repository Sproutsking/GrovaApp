// src/components/SmartTextarea/useUndoStack.js
import { useRef, useState, useCallback } from "react";

const MAX_UNDO = 10;

/**
 * useUndoStack
 *
 * Lightweight undo stack for writing assistant improvements.
 * Only tracks improvement-triggered replacements — NOT every keystroke.
 * Supports up to MAX_UNDO levels deep.
 */
export function useUndoStack() {
  const stack = useRef([]);
  const [canUndo, setCanUndo] = useState(false);

  // Push the current value onto the stack before applying a change
  const push = useCallback((value) => {
    stack.current = [...stack.current.slice(-(MAX_UNDO - 1)), value];
    setCanUndo(true);
  }, []);

  // Pop the last value off the stack and return it
  const pop = useCallback(() => {
    if (stack.current.length === 0) return null;
    const last = stack.current[stack.current.length - 1];
    stack.current = stack.current.slice(0, -1);
    setCanUndo(stack.current.length > 0);
    return last;
  }, []);

  // Clear the entire stack (e.g. on form reset)
  const clear = useCallback(() => {
    stack.current = [];
    setCanUndo(false);
  }, []);

  return { push, pop, clear, canUndo };
}