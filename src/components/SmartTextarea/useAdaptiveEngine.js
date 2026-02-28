// src/components/SmartTextarea/useAdaptiveEngine.js
// ─────────────────────────────────────────────────────────────────────────────
// Enhanced adaptive learning — now tracks all 10 action IDs and infers
// user style from richer signals. Background sync to Supabase profiles
// table is unchanged (zero new tables required).
// ─────────────────────────────────────────────────────────────────────────────
import { useState, useCallback, useRef, useEffect } from "react";

const STORAGE_KEY = "xeevia_writing_prefs_v2";
const SYNC_DEBOUNCE_MS = 4000;

const ALL_ACTIONS = [
  "grammar","shorten","enhance","rewrite","friendly","formal",
  "hook","engage","punch","story",
];

// ── Lazy Supabase loader — prevents module-level import failures ──────────────
// If supabase config is missing or throws, it won't kill this entire module.
let _supabase = null;
async function getSupabase() {
  if (_supabase) return _supabase;
  try {
    const mod = await import("../../services/config/supabase");
    _supabase = mod.supabase;
    return _supabase;
  } catch {
    return null;
  }
}

export function useAdaptiveEngine() {
  const [prefs, setPrefs] = useState(() => loadLocalPrefs());
  const syncTimer = useRef(null);
  const userStyle = inferStyle(prefs);

  // Load from Supabase on mount, merge with local
  useEffect(() => {
    loadRemotePrefs().then(remote => {
      if (remote) {
        setPrefs(prev => {
          const merged = mergePrefs(prev, remote);
          saveLocalPrefs(merged);
          return merged;
        });
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Called when user accepts an AI improvement (kept the new text)
  const acceptImprovement = useCallback((action, changes) => {
    setPrefs(prev => {
      const next = { ...prev };
      for (const change of changes) {
        const entry = `${action}:${(change.from || "").toLowerCase().substring(0, 80)}:${(change.to || "").toLowerCase().substring(0, 80)}`;
        if (!next.acceptedHistory) next.acceptedHistory = [];
        if (!next.acceptedHistory.includes(entry)) {
          next.acceptedHistory = [...next.acceptedHistory.slice(-149), entry];
        }
        if (action === "enhance" && change.to) {
          if (!next.preferredWords) next.preferredWords = [];
          if (!next.preferredWords.includes(change.to)) {
            next.preferredWords = [...next.preferredWords.slice(-49), change.to];
          }
        }
      }
      if (!next.actionCounts) next.actionCounts = {};
      next.actionCounts[action] = (next.actionCounts[action] || 0) + 1;
      saveLocalPrefs(next);
      scheduleRemoteSync(next, syncTimer);
      return next;
    });
  }, []);

  // Called when user rejects / undoes an AI improvement
  const rejectImprovement = useCallback((action, changes) => {
    setPrefs(prev => {
      const next = { ...prev };
      for (const change of changes) {
        const entry = `reject_${action}:${(change.from || "").toLowerCase().substring(0, 80)}:${(change.to || "").toLowerCase().substring(0, 80)}`;
        if (!next.acceptedHistory) next.acceptedHistory = [];
        if (!next.acceptedHistory.includes(entry)) {
          next.acceptedHistory = [...next.acceptedHistory.slice(-149), entry];
        }
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

  const getHistoryPayload = useCallback(() => prefs.acceptedHistory || [], [prefs]);

  // Most-used action (useful for showing a shortcut or highlight)
  const mostUsedAction = Object.entries(prefs.actionCounts || {})
    .sort((a, b) => b[1] - a[1])[0]?.[0] || null;

  return {
    prefs,
    userStyle,
    mostUsedAction,
    acceptImprovement,
    rejectImprovement,
    getHistoryPayload,
    history: prefs.acceptedHistory || [],
  };
}

// ── Style inference from accepted vocabulary ───────────────────────────────
const CASUAL_SIGNALS  = ["fire","lit","sick","dope","elite","solid","goated","bussin","lowkey","highkey","slap","banger","no cap","fr fr","pumped","stoked","hyped","grind","hustle"];
const FORMAL_SIGNALS  = ["exemplary","paramount","corroborate","substantiate","commendable","meritorious","praiseworthy","indispensable","endeavour","utilise","facilitate","necessitate","formulate","procure","augment"];

function inferStyle(prefs) {
  const preferred = prefs.preferredWords || [];
  const casualScore = preferred.filter(w => CASUAL_SIGNALS.includes(w.toLowerCase())).length;
  const formalScore = preferred.filter(w => FORMAL_SIGNALS.includes(w.toLowerCase())).length;
  if (casualScore > formalScore + 1) return "casual";
  if (formalScore > casualScore + 1) return "formal";
  return "neutral";
}

// ── Persistence ────────────────────────────────────────────────────────────
function loadLocalPrefs() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}"); } catch { return {}; }
}
function saveLocalPrefs(prefs) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs)); } catch {}
}

async function loadRemotePrefs() {
  try {
    const supabase = await getSupabase();
    if (!supabase) return null;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    const { data } = await supabase.from("profiles").select("preferences").eq("id", user.id).maybeSingle();
    return data?.preferences?.writingPrefs || null;
  } catch { return null; }
}

function scheduleRemoteSync(prefs, timerRef) {
  if (timerRef.current) clearTimeout(timerRef.current);
  timerRef.current = setTimeout(async () => {
    try {
      const supabase = await getSupabase();
      if (!supabase) return;
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: existing } = await supabase.from("profiles").select("preferences").eq("id", user.id).maybeSingle();
      const currentPrefs = existing?.preferences || {};
      await supabase.from("profiles").update({
        preferences: {
          ...currentPrefs,
          writingPrefs: {
            acceptedHistory: (prefs.acceptedHistory || []).slice(-100),
            preferredWords:  (prefs.preferredWords  || []).slice(-50),
            rejectedWords:   (prefs.rejectedWords   || []).slice(-50),
            actionCounts:    prefs.actionCounts || {},
          },
        },
      }).eq("id", user.id);
    } catch {}
  }, SYNC_DEBOUNCE_MS);
}

function mergePrefs(local, remote) {
  const merged = { ...local };
  merged.acceptedHistory = [...new Set([...(remote.acceptedHistory || []), ...(local.acceptedHistory || [])])].slice(-150);
  merged.preferredWords  = [...new Set([...(remote.preferredWords  || []), ...(local.preferredWords  || [])])].slice(-50);
  merged.rejectedWords   = [...new Set([...(remote.rejectedWords   || []), ...(local.rejectedWords   || [])])].slice(-50);
  const ra = remote.actionCounts || {};
  const la = local.actionCounts  || {};
  merged.actionCounts = {};
  ALL_ACTIONS.forEach(a => { merged.actionCounts[a] = (ra[a] || 0) + (la[a] || 0); });
  return merged;
}