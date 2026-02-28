// src/components/SmartTextarea/useSmartSuggestions.js
// ─────────────────────────────────────────────────────────────────────────────
// Intelligent suggestion engine v2 — multi-layer context awareness:
//
//   LAYER 1 — Word completion: prefix-match with topic-boosted ranking
//   LAYER 2 — Phrase completion: multi-word pattern matching
//   LAYER 3 — Opening starters: when textarea is near-empty
//   LAYER 4 — Inline continuation: what to write next based on last sentence
//   LAYER 5 — Hook suggestions: based on detected topic
//   LAYER 6 — CTA injection: when post has no engagement ending
//   LAYER 7 — Template bank: time + topic aware post templates
//
// Learning: every acceptance is scored and synced to localStorage + Supabase.
// Future sessions rank previously-accepted items higher automatically.
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useRef, useCallback } from "react";
import {
  UNIVERSAL_WORDS,
  TOPIC_CLUSTERS,
  PHRASE_COMPLETIONS,
  OPENING_PHRASES,
  HIGH_ENGAGEMENT_PATTERNS,
  POST_TEMPLATES,
  getTimeOfDay,
  detectTopics,
  getRelevantTemplates,
  findPhraseCompletion,
} from "./suggestionData";

const STORAGE_KEY  = "xeevia_suggestions_v2";
const DEBOUNCE_MS  = 160;
const MAX_WORDS    = 5;
const MAX_PHRASES  = 3;
const MAX_OPENERS  = 4;
const MIN_PREFIX   = 2;

// ── Lazy Supabase ─────────────────────────────────────────────────────────────
let _sb = null;
async function getSupabase() {
  if (_sb) return _sb;
  try { const m = await import("../../services/config/supabase"); _sb = m.supabase; return _sb; } catch { return null; }
}

function loadPrefs() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}"); } catch { return {}; }
}
function savePrefs(p) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(p)); } catch {}
}

async function syncToRemote(prefs) {
  try {
    const sb = await getSupabase(); if (!sb) return;
    const { data: { user } } = await sb.auth.getUser(); if (!user) return;
    const { data: ex } = await sb.from("profiles").select("preferences").eq("id", user.id).maybeSingle();
    await sb.from("profiles").update({ preferences: { ...(ex?.preferences || {}), suggestionPrefs: prefs } }).eq("id", user.id);
  } catch {}
}

// ── Topic-weighted vocabulary ─────────────────────────────────────────────────
function buildVocab(topics) {
  const set = new Set(UNIVERSAL_WORDS);
  for (const topic of topics.slice(0, 2)) {
    const cluster = TOPIC_CLUSTERS[topic];
    if (cluster) {
      cluster.vocabulary.forEach(w => set.add(w));
      cluster.keywords.forEach(w => set.add(w));
    }
  }
  return [...set];
}

// ── Extract current partial word ──────────────────────────────────────────────
function getCurrentWord(text, cursor) {
  if (!text || cursor === undefined) return "";
  const before = text.slice(0, cursor);
  const match  = before.match(/([a-zA-Z']+)$/);
  return match ? match[1].toLowerCase() : "";
}

// ── Prefix-match words with score boosting ────────────────────────────────────
function matchWords(prefix, vocab, learnedScores, topicBoost) {
  if (!prefix || prefix.length < MIN_PREFIX) return [];
  const p = prefix.toLowerCase();

  return vocab
    .filter(w => w.startsWith(p) && w.length > p.length + 1)
    .map(w => ({
      word:  w,
      score: (learnedScores[w] || 0) * 3
           + (topicBoost.has(w) ? 5 : 0)
           + (w.length - p.length < 5 ? 2 : 0), // prefer shorter completions
    }))
    .sort((a, b) => b.score - a.score || a.word.length - b.word.length)
    .slice(0, MAX_WORDS)
    .map(s => s.word);
}

// ── Detect last incomplete sentence for continuation ──────────────────────────
function getLastSentenceFragment(text) {
  if (!text) return "";
  const trimmed = text.trimEnd();
  // Get the content after the last full stop / newline
  const lastBreak = Math.max(
    trimmed.lastIndexOf(". "),
    trimmed.lastIndexOf("! "),
    trimmed.lastIndexOf("? "),
    trimmed.lastIndexOf("\n"),
  );
  const fragment = lastBreak >= 0 ? trimmed.slice(lastBreak + 1).trim() : trimmed;
  return fragment.length < 120 ? fragment : fragment.slice(-80);
}

// ── Detect if post needs a CTA (engagement ending) ───────────────────────────
function needsCTA(text, wordCount) {
  if (wordCount < 25) return false;
  const lastChunk = text.slice(-200).toLowerCase();
  return !/\?|comment|share|let me know|tag|drop|tell me|follow|save this|reply|👇/.test(lastChunk);
}

// ── Get inline continuation suggestions ──────────────────────────────────────
function getContinuations(text, topics) {
  const fragment = getLastSentenceFragment(text);
  if (!fragment || fragment.length < 8) return [];

  const lower    = fragment.toLowerCase();
  const results  = [];

  // Phrase completions based on what was typed
  const phraseMatches = findPhraseCompletion(fragment);
  results.push(...phraseMatches);

  // Topic-based phrase suggestions
  if (topics[0]) {
    const phrases = TOPIC_CLUSTERS[topics[0]]?.phrases || [];
    // Find a phrase that starts similar to the fragment context
    const relevant = phrases.find(p => {
      const fWords = lower.split(" ").slice(-3);
      return fWords.some(w => w.length > 4 && p.toLowerCase().includes(w));
    });
    if (relevant && !results.includes(relevant)) results.push(relevant);
  }

  // Power transitions if mid-post
  const wordCount = text.trim().split(/\s+/).filter(Boolean).length;
  if (wordCount > 20 && wordCount < 100) {
    const transition = HIGH_ENGAGEMENT_PATTERNS.power_transitions[
      Math.floor(Math.random() * HIGH_ENGAGEMENT_PATTERNS.power_transitions.length)
    ];
    if (!results.includes(transition)) results.push(transition);
  }

  return [...new Set(results)].slice(0, MAX_PHRASES);
}

// ── Get hook suggestions ──────────────────────────────────────────────────────
function getHookSuggestions(topics, learnedScores) {
  const hooks = [];

  if (topics[0]) {
    hooks.push(...(TOPIC_CLUSTERS[topics[0]]?.hooks || []).slice(0, 3));
  }

  // Fill from global hooks
  HIGH_ENGAGEMENT_PATTERNS.hooks
    .filter(h => !hooks.includes(h))
    .slice(0, 3)
    .forEach(h => hooks.push(h));

  return hooks
    .map(h => ({ h, score: learnedScores[`hook:${h}`] || 0 }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map(x => x.h);
}

// ── Get CTA suggestions ───────────────────────────────────────────────────────
function getCTASuggestions(topics, learnedScores) {
  const ctas = [];

  if (topics[0]) {
    ctas.push(...(TOPIC_CLUSTERS[topics[0]]?.ctas || []).slice(0, 3));
  }

  HIGH_ENGAGEMENT_PATTERNS.engagement_endings
    .filter(c => !ctas.includes(c))
    .slice(0, 3)
    .forEach(c => ctas.push(c));

  return ctas
    .map(c => ({ c, score: learnedScores[`cta:${c}`] || 0 }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map(x => x.c);
}

// ── Merge remote + local prefs ────────────────────────────────────────────────
function mergePrefs(local, remote) {
  const merge = (a = {}, b = {}) => {
    const out = { ...a };
    Object.keys(b).forEach(k => { out[k] = (out[k] || 0) + (b[k] || 0); });
    return out;
  };
  return {
    wordScores:     merge(local.wordScores,     remote.wordScores),
    phraseScores:   merge(local.phraseScores,   remote.phraseScores),
    hookScores:     merge(local.hookScores,     remote.hookScores),
    ctaScores:      merge(local.ctaScores,      remote.ctaScores),
    templateScores: merge(local.templateScores, remote.templateScores),
    openerScores:   merge(local.openerScores,   remote.openerScores),
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// MAIN HOOK
// ══════════════════════════════════════════════════════════════════════════════

export function useSmartSuggestions(textareaRef, value) {
  // ── All suggestion states ─────────────────────────────────────────────────
  const [wordSuggestions,     setWordSuggestions]     = useState([]);
  const [phraseSuggestions,   setPhraseSuggestions]   = useState([]);
  const [openingPhrases,      setOpeningPhrases]       = useState([]);
  const [hookSuggestions,     setHookSuggestions]     = useState([]);
  const [ctaSuggestions,      setCtaSuggestions]       = useState([]);
  const [templateSuggestions, setTemplateSuggestions] = useState([]);
  const [showCTAHint,         setShowCTAHint]         = useState(false);
  const [detectedTopics,      setDetectedTopics]       = useState([]);

  const [prefs, setPrefs] = useState(() => loadPrefs());
  const [cursorPos, setCursorPos] = useState(0);

  const debounceRef = useRef(null);
  const syncRef     = useRef(null);

  // ── Load remote prefs on mount ────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const sb = await getSupabase(); if (!sb) return;
        const { data: { user } } = await sb.auth.getUser(); if (!user) return;
        const { data } = await sb.from("profiles").select("preferences").eq("id", user.id).maybeSingle();
        const remote = data?.preferences?.suggestionPrefs;
        if (remote) {
          setPrefs(prev => {
            const merged = mergePrefs(prev, remote);
            savePrefs(merged);
            return merged;
          });
        }
      } catch {}
    })();
  }, []);

  // ── Track cursor position ─────────────────────────────────────────────────
  useEffect(() => {
    const el = textareaRef?.current;
    if (!el) return;
    const handler = () => setCursorPos(el.selectionStart || 0);
    el.addEventListener("keyup",   handler);
    el.addEventListener("mouseup", handler);
    el.addEventListener("click",   handler);
    el.addEventListener("keydown", (e) => { if (e.key === "Tab") e.preventDefault(); });
    return () => {
      el.removeEventListener("keyup",   handler);
      el.removeEventListener("mouseup", handler);
      el.removeEventListener("click",   handler);
    };
  }, [textareaRef]);

  // ── Tab key accepts first word suggestion ─────────────────────────────────
  useEffect(() => {
    const el = textareaRef?.current;
    if (!el) return;
    const handler = (e) => {
      if (e.key === "Tab" && wordSuggestions.length > 0) {
        e.preventDefault();
        e.stopPropagation();
        // The parent will handle via onTabAccept callback
      }
    };
    el.addEventListener("keydown", handler, true);
    return () => el.removeEventListener("keydown", handler, true);
  }, [textareaRef, wordSuggestions]);

  // ── Main analysis ─────────────────────────────────────────────────────────
  useEffect(() => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      const wc          = value?.trim().split(/\s+/).filter(Boolean).length || 0;
      const topics      = detectTopics(value || "");
      const topicBoostSet = new Set(
        topics.slice(0, 2).flatMap(t => [...(TOPIC_CLUSTERS[t]?.vocabulary || []), ...(TOPIC_CLUSTERS[t]?.keywords || [])])
      );
      const vocab       = buildVocab(topics);
      const endsSpace   = (value || "").slice(-1) === " " || (value || "").slice(-1) === "\n";

      setDetectedTopics(topics);

      // ── LAYER 1: Word completion ──────────────────────────────────────────
      if (!endsSpace) {
        const prefix = getCurrentWord(value, cursorPos);
        setWordSuggestions(matchWords(prefix, vocab, prefs.wordScores || {}, topicBoostSet));
      } else {
        setWordSuggestions([]);
      }

      // ── LAYER 2 & 4: Phrase / continuation suggestions ────────────────────
      if (wc >= 3 && endsSpace) {
        const conts = getContinuations(value, topics);
        setPhraseSuggestions(conts);
      } else {
        setPhraseSuggestions([]);
      }

      // ── LAYER 3: Opening phrases (nearly empty) ───────────────────────────
      if (wc < 3) {
        const scored = OPENING_PHRASES
          .map(p => ({ p, score: (prefs.openerScores || {})[p] || 0 }))
          .sort((a, b) => b.score - a.score || Math.random() - 0.5)
          .slice(0, MAX_OPENERS)
          .map(x => x.p);
        setOpeningPhrases(scored);
        setHookSuggestions([]);
        setCtaSuggestions([]);
        setShowCTAHint(false);
      } else {
        setOpeningPhrases([]);
      }

      // ── LAYER 5: Hook suggestions (early in post, weak hook) ─────────────
      if (wc >= 3 && wc <= 30) {
        setHookSuggestions(getHookSuggestions(topics, prefs.hookScores || {}));
      } else {
        setHookSuggestions([]);
      }

      // ── LAYER 6: CTA hint (near end of post, missing CTA) ────────────────
      if (wc >= 30) {
        const needs = needsCTA(value || "", wc);
        setShowCTAHint(needs);
        if (needs) {
          setCtaSuggestions(getCTASuggestions(topics, prefs.ctaScores || {}));
        } else {
          setCtaSuggestions([]);
        }
      } else {
        setShowCTAHint(false);
        setCtaSuggestions([]);
      }

      // ── LAYER 7: Templates ────────────────────────────────────────────────
      const templates = getRelevantTemplates(value || "", 5);
      setTemplateSuggestions(
        templates.sort((a, b) =>
          ((prefs.templateScores || {})[b.id] || 0) - ((prefs.templateScores || {})[a.id] || 0)
        )
      );

    }, DEBOUNCE_MS);

    return () => clearTimeout(debounceRef.current);
  }, [value, cursorPos, prefs]);

  // ── Score update helper ───────────────────────────────────────────────────
  const updateScore = useCallback((bucket, key, delta = 1) => {
    setPrefs(prev => {
      const next = {
        ...prev,
        [bucket]: { ...(prev[bucket] || {}), [key]: ((prev[bucket] || {})[key] || 0) + delta },
      };
      savePrefs(next);
      clearTimeout(syncRef.current);
      syncRef.current = setTimeout(() => syncToRemote(next), 6000);
      return next;
    });
  }, []);

  // ── Accept handlers ───────────────────────────────────────────────────────
  const acceptWordSuggestion = useCallback((word) => {
    const el = textareaRef?.current;
    if (!el) return word + " ";
    const pos    = el.selectionStart || 0;
    const before = (el.value || "").slice(0, pos);
    const after  = (el.value || "").slice(pos);
    const match  = before.match(/([a-zA-Z']+)$/);
    const prefix = match ? match[1] : "";
    const newVal = (prefix ? before.slice(0, -prefix.length) : before) + word + " " + after;
    updateScore("wordScores", word);
    setWordSuggestions([]);
    return newVal;
  }, [textareaRef, updateScore]);

  const acceptPhraseSuggestion = useCallback((phrase) => {
    updateScore("phraseScores", phrase);
    setPhraseSuggestions([]);
    return phrase + " ";
  }, [updateScore]);

  const acceptOpeningPhrase = useCallback((phrase) => {
    updateScore("openerScores", phrase);
    setOpeningPhrases([]);
    return phrase + " ";
  }, [updateScore]);

  const acceptHookSuggestion = useCallback((hook) => {
    updateScore("hookScores", `hook:${hook}`);
    setHookSuggestions([]);
    return hook + "\n\n";
  }, [updateScore]);

  const acceptCTASuggestion = useCallback((cta) => {
    updateScore("ctaScores", `cta:${cta}`);
    setCtaSuggestions([]);
    setShowCTAHint(false);
    return "\n\n" + cta;
  }, [updateScore]);

  const acceptTemplate = useCallback((template) => {
    updateScore("templateScores", template.id, 2);
    setTemplateSuggestions([]);
    return template.text;
  }, [updateScore]);

  // ── Tab key accept (first word) ───────────────────────────────────────────
  const acceptFirstWord = useCallback(() => {
    if (wordSuggestions.length === 0) return null;
    return acceptWordSuggestion(wordSuggestions[0]);
  }, [wordSuggestions, acceptWordSuggestion]);

  return {
    // Suggestion data
    wordSuggestions,
    phraseSuggestions,
    openingPhrases,
    hookSuggestions,
    ctaSuggestions,
    templateSuggestions,
    showCTAHint,
    detectedTopics,

    // Accept handlers (each returns the new string to commit)
    acceptWordSuggestion,
    acceptPhraseSuggestion,
    acceptOpeningPhrase,
    acceptHookSuggestion,
    acceptCTASuggestion,
    acceptTemplate,
    acceptFirstWord,
  };
}