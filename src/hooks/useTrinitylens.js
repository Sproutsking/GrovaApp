// ============================================================================
// src/hooks/useTrinitylens.js — Trinity State Management (Zustand)
// ============================================================================
// Lightweight global state for Xeevia mode switching
// Persists to localStorage for continuity across sessions
// ============================================================================

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const VALID_TRINITY_LENSES = ['everyday', 'gaming', 'web3'];

export const normalizeTrinityLens = (value) => {
  if (VALID_TRINITY_LENSES.includes(value)) return value;
  return 'everyday';
};

const useTrinitylens = create(
  persist(
    (set) => ({
      activeTrinityLens: 'everyday',

      setActiveTrinityLens: (mode) => {
        const nextMode = normalizeTrinityLens(mode);
        if (nextMode !== mode) {
          console.warn(`Invalid Trinity lens mode: ${mode}. Falling back to ${nextMode}.`);
        }
        set({ activeTrinityLens: nextMode });
      },
    }),
    {
      name: 'trinity-lensstore',
      partialize: (state) => ({ activeTrinityLens: normalizeTrinityLens(state.activeTrinityLens) }),
      merge: (persistedState, currentState) => ({
        ...currentState,
        ...(persistedState || {}),
        activeTrinityLens: normalizeTrinityLens(
          persistedState?.activeTrinityLens ?? currentState.activeTrinityLens,
        ),
      }),
    }
  )
);

export default useTrinitylens;
