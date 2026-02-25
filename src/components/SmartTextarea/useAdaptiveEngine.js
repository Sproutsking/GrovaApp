// src/components/SmartTextarea/useAdaptiveEngine.js
import { useState, useCallback, useRef, useEffect } from "react";
import { supabase } from "../../services/config/supabase";

const STORAGE_KEY = "xeevia_writing_prefs";
const SYNC_DEBOUNCE_MS = 3000;

/**
 * useAdaptiveEngine
 *
 * Zero-cost adaptive learning system:
 * - Stores accept/reject history in localStorage (instant, offline-safe)
 * - Debounced background sync to profiles.preferences JSONB (no new tables)
 * - Infers user style (casual / formal / neutral) from accepted words
 * - Exports history payload for edge function personalisation
 */
export function useAdaptiveEngine() {
  const [prefs, setPrefs] = useState(() => loadLocalPrefs());
  const syncTimer = useRef(null);

  const userStyle = inferStyle(prefs);

  // Background load from Supabase once on mount — merge into local
  useEffect(() => {
    loadRemotePrefs().then((remote) => {
      if (remote) {
        setPrefs((prev) => {
          const merged = mergePrefs(prev, remote);
          saveLocalPrefs(merged);
          return merged;
        });
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Called when user accepts an improvement (keeps the new text)
  const acceptImprovement = useCallback((action, changes) => {
    setPrefs((prev) => {
      const next = { ...prev };

      for (const change of changes) {
        const entry = `${action}:${(change.from || "").toLowerCase()}:${(change.to || "").toLowerCase()}`;

        if (!next.acceptedHistory) next.acceptedHistory = [];
        if (!next.acceptedHistory.includes(entry)) {
          next.acceptedHistory = [...next.acceptedHistory.slice(-99), entry];
        }

        // Track which replacement words the user keeps
        if (action === "enhance" && change.to) {
          if (!next.preferredWords) next.preferredWords = [];
          if (!next.preferredWords.includes(change.to)) {
            next.preferredWords = [...next.preferredWords.slice(-49), change.to];
          }
        }

        // Action usage counts
        if (!next.actionCounts) next.actionCounts = {};
        next.actionCounts[action] = (next.actionCounts[action] || 0) + 1;
      }

      saveLocalPrefs(next);
      scheduleRemoteSync(next, syncTimer);
      return next;
    });
  }, []);

  // Called when user undoes an improvement (rejects it)
  const rejectImprovement = useCallback((action, changes) => {
    setPrefs((prev) => {
      const next = { ...prev };

      for (const change of changes) {
        const entry = `reject_${action}:${(change.from || "").toLowerCase()}:${(change.to || "").toLowerCase()}`;

        if (!next.acceptedHistory) next.acceptedHistory = [];
        if (!next.acceptedHistory.includes(entry)) {
          next.acceptedHistory = [...next.acceptedHistory.slice(-99), entry];
        }

        // Track which words the user doesn't want replaced
        if (action === "enhance" && change.from) {
          if (!next.rejectedWords) next.rejectedWords = [];
          if (!next.rejectedWords.includes(change.from)) {
            next.rejectedWords = [...next.rejectedWords.slice(-49), change.from];
          }
        }
      }

      saveLocalPrefs(next);
      scheduleRemoteSync(next, syncTimer);
      return next;
    });
  }, []);

  // Returns the history array to send to the edge function
  const getHistoryPayload = useCallback(() => {
    return prefs.acceptedHistory || [];
  }, [prefs]);

  return {
    prefs,
    userStyle,
    acceptImprovement,
    rejectImprovement,
    getHistoryPayload,
    history: prefs.acceptedHistory || [],
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function inferStyle(prefs) {
  const preferred = prefs.preferredWords || [];
  const casualWords = ["fire", "elite", "solid", "sick", "lit", "dope", "pumped", "stoked"];
  const formalWords = ["exemplary", "paramount", "substantiate", "corroborate", "commendable"];

  const casualScore = preferred.filter((w) => casualWords.includes(w)).length;
  const formalScore = preferred.filter((w) => formalWords.includes(w)).length;

  if (casualScore > formalScore + 1) return "casual";
  if (formalScore > casualScore + 1) return "formal";
  return "neutral";
}

function loadLocalPrefs() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveLocalPrefs(prefs) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // Storage full or unavailable — silently ignore
  }
}

async function loadRemotePrefs() {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;

    const { data } = await supabase
      .from("profiles")
      .select("preferences")
      .eq("id", user.id)
      .maybeSingle();

    return data?.preferences?.writingPrefs || null;
  } catch {
    return null;
  }
}

function scheduleRemoteSync(prefs, timerRef) {
  if (timerRef.current) clearTimeout(timerRef.current);

  timerRef.current = setTimeout(async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      // Read existing preferences so we don't overwrite unrelated keys
      const { data: existing } = await supabase
        .from("profiles")
        .select("preferences")
        .eq("id", user.id)
        .maybeSingle();

      const currentPrefs = existing?.preferences || {};

      await supabase
        .from("profiles")
        .update({
          preferences: {
            ...currentPrefs,
            writingPrefs: {
              acceptedHistory: (prefs.acceptedHistory || []).slice(-50),
              preferredWords:  prefs.preferredWords  || [],
              rejectedWords:   prefs.rejectedWords   || [],
              actionCounts:    prefs.actionCounts    || {},
            },
          },
        })
        .eq("id", user.id);
    } catch {
      // Network failure — localStorage is the source of truth
    }
  }, SYNC_DEBOUNCE_MS);
}

function mergePrefs(local, remote) {
  const merged = { ...local };

  const localHistory  = local.acceptedHistory  || [];
  const remoteHistory = remote.acceptedHistory || [];
  merged.acceptedHistory = [...new Set([...remoteHistory, ...localHistory])].slice(-100);

  merged.preferredWords = [
    ...new Set([...(remote.preferredWords || []), ...(local.preferredWords || [])]),
  ].slice(-50);

  merged.rejectedWords = [
    ...new Set([...(remote.rejectedWords || []), ...(local.rejectedWords || [])]),
  ].slice(-50);

  const ra = remote.actionCounts || {};
  const la = local.actionCounts  || {};
  merged.actionCounts = {
    grammar: (ra.grammar || 0) + (la.grammar || 0),
    shorten: (ra.shorten || 0) + (la.shorten || 0),
    enhance: (ra.enhance || 0) + (la.enhance || 0),
  };

  return merged;
}