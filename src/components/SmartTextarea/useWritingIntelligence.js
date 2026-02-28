// src/components/SmartTextarea/useWritingIntelligence.js
// ─────────────────────────────────────────────────────────────────────────────
// Real-time, zero-latency text intelligence — runs entirely client-side.
// Debounced so it only fires 600ms after the user stops typing.
//
// Provides:
//   • Flesch-Kincaid readability score (0-100)
//   • Tone detection (casual / formal / passionate / neutral)
//   • Issue detection (passive voice, filler words, weak openers, etc.)
//   • Proactive action suggestions (which button to press)
//   • Power word count
//   • Estimated read time
// ─────────────────────────────────────────────────────────────────────────────
import { useState, useEffect, useRef, useCallback } from "react";

// ── Word lists ────────────────────────────────────────────────────────────────

const FILLER_WORDS = new Set([
  "basically","literally","honestly","actually","simply","just","really","very",
  "quite","rather","somewhat","kind of","sort of","you know","I mean","I guess",
  "needless to say","at the end of the day","pretty much","a little bit",
]);

const WEAK_OPENERS = [
  /^(so,?\s+)?I (just |really )?(wanted|felt|thought|needed) to/i,
  /^(honestly|basically|frankly|genuinely),/i,
  /^(as you (may|might|probably|already) know)/i,
  /^(let me (start|begin) by)/i,
  /^(in this (post|article|thread),? I)/i,
  /^today I (want|would like|am going) to/i,
];

const PASSIVE_VOICE_PATTERNS = [
  /\b(is|are|was|were|be|been|being)\s+(being\s+)?\w+ed\b/gi,
  /\b(is|are|was|were)\s+\w+en\b/gi,
];

const POWER_WORDS = new Set([
  "transform","breakthrough","ignite","master","unlock","shatter","forge","conquer",
  "dominate","crush","skyrocket","surge","explode","revolutionary","unstoppable",
  "game-changer","game changer","remarkable","extraordinary","unprecedented","proven",
  "guaranteed","instantly","immediately","now","discover","reveal","secret","hidden",
  "exclusive","urgent","critical","essential","vital","powerful","elite","ultimate",
]);

const CASUAL_WORDS = new Set([
  "fire","lit","sick","dope","elite","solid","goated","lowkey","highkey","banger",
  "no cap","fr","pumped","stoked","hyped","grind","hustle","vibe","vibes","ngl",
  "tbh","imo","lol","lmao","haha","omg","yeah","yep","nope","gonna","wanna","gotta",
]);

const FORMAL_WORDS = new Set([
  "therefore","furthermore","consequently","nevertheless","notwithstanding",
  "pursuant","herein","aforementioned","exemplary","paramount","substantiate",
  "corroborate","commendable","meritorious","indispensable","endeavour","utilise",
  "facilitate","necessitate","formulate","procure","augment","elucidate",
]);

// ── Flesch-Kincaid Readability ─────────────────────────────────────────────────

function countSyllables(word) {
  word = word.toLowerCase().replace(/[^a-z]/g, "");
  if (!word.length) return 0;
  if (word.length <= 3) return 1;
  word = word.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, "");
  word = word.replace(/^y/, "");
  const groups = word.match(/[aeiouy]{1,2}/g);
  return groups ? Math.max(1, groups.length) : 1;
}

function computeFlesch(text) {
  const words = text.trim().split(/\s+/).filter(Boolean);
  const sentences = (text.match(/[^.!?]*[.!?]+/g) || [text]).filter(s => s.trim());

  if (words.length < 3) return { score: 100, level: "N/A", grade: "N/A", avgWords: 0, avgSyllables: 0 };

  const totalSyllables = words.reduce((sum, w) => sum + countSyllables(w), 0);
  const avgWordsPerSentence = words.length / Math.max(sentences.length, 1);
  const avgSyllablesPerWord = totalSyllables / words.length;

  const score = Math.max(0, Math.min(100, Math.round(
    206.835 - 1.015 * avgWordsPerSentence - 84.6 * avgSyllablesPerWord
  )));

  let level;
  if (score >= 90) level = "Very Easy";
  else if (score >= 70) level = "Easy";
  else if (score >= 60) level = "Standard";
  else if (score >= 50) level = "Fairly Hard";
  else if (score >= 30) level = "Difficult";
  else level = "Very Hard";

  const gradeNum = Math.max(1, Math.round(0.39 * avgWordsPerSentence + 11.8 * avgSyllablesPerWord - 15.59));
  const grade = gradeNum >= 13 ? "College+" : `Grade ${gradeNum}`;

  return {
    score,
    level,
    grade,
    avgWords: Math.round(avgWordsPerSentence * 10) / 10,
    avgSyllables: Math.round(avgSyllablesPerWord * 100) / 100,
  };
}

// ── Tone Detection ─────────────────────────────────────────────────────────────

function detectTone(text) {
  const lower = text.toLowerCase();
  const words = lower.split(/\s+/);

  let casual = 0, formal = 0, passionate = 0;

  words.forEach(w => {
    if (CASUAL_WORDS.has(w)) casual += 2;
    if (FORMAL_WORDS.has(w)) formal += 2;
    if (POWER_WORDS.has(w)) passionate += 1;
  });

  // Exclamation marks → passionate
  passionate += (text.match(/!/g) || []).length;
  // Questions → engaging
  const questions = (text.match(/\?/g) || []).length;
  // Contractions → casual
  casual += (text.match(/\b(don't|I'm|won't|can't|it's|you're|we're|they're)\b/gi) || []).length;

  if (casual > formal + 2 && casual > passionate) return { tone: "Casual",     color: "#38bdf8", emoji: "😊" };
  if (formal > casual + 2)                         return { tone: "Formal",     color: "#94a3b8", emoji: "🎩" };
  if (passionate > 3)                               return { tone: "Passionate", color: "#f97316", emoji: "🔥" };
  if (questions > 1)                                return { tone: "Engaging",   color: "#a855f7", emoji: "💬" };
  return                                                   { tone: "Neutral",    color: "#84cc16", emoji: "📝" };
}

// ── Issue Detection ────────────────────────────────────────────────────────────

function detectIssues(text) {
  const issues = [];
  const words = text.trim().split(/\s+/).filter(Boolean);

  // Filler words
  const fillerCount = words.filter(w => FILLER_WORDS.has(w.toLowerCase())).length;
  if (fillerCount >= 2) {
    issues.push({
      type:      "filler",
      label:     `${fillerCount} filler words`,
      detail:    "Words like 'really', 'just', 'basically' weaken your message",
      action:    "shorten",
      severity:  fillerCount >= 4 ? "high" : "medium",
    });
  }

  // Passive voice
  let passiveCount = 0;
  for (const pattern of PASSIVE_VOICE_PATTERNS) {
    passiveCount += (text.match(pattern) || []).length;
    pattern.lastIndex = 0;
  }
  if (passiveCount >= 2) {
    issues.push({
      type:     "passive",
      label:    `${passiveCount} passive constructions`,
      detail:   "Active voice is stronger and more direct",
      action:   "punch",
      severity: "medium",
    });
  }

  // Weak opener
  if (WEAK_OPENERS.some(p => p.test(text))) {
    issues.push({
      type:     "opener",
      label:    "Weak opening line",
      detail:   "Your first line should grab attention immediately",
      action:   "hook",
      severity: "high",
    });
  }

  // Very long sentences
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 10);
  const longSentences = sentences.filter(s => s.trim().split(/\s+/).length > 30);
  if (longSentences.length > 0) {
    issues.push({
      type:     "length",
      label:    `${longSentences.length} very long sentence${longSentences.length > 1 ? "s" : ""}`,
      detail:   "Long sentences lose readers on mobile — break them up",
      action:   "shorten",
      severity: "medium",
    });
  }

  // No clear call-to-action or engagement hook
  const hasCTA = /\?|comment|share|tell me|let me know|tag|drop|what do you|have you/i.test(text);
  if (words.length > 30 && !hasCTA) {
    issues.push({
      type:     "cta",
      label:    "No engagement hook",
      detail:   "Posts with a question or CTA get 2x more comments",
      action:   "engage",
      severity: "low",
    });
  }

  return issues;
}

// ── Suggested Actions ─────────────────────────────────────────────────────────

function suggestActions(issues, wordCount) {
  const suggestions = [];

  // Top 2 issues → suggest their actions
  const topIssues = issues
    .sort((a, b) => { const order = { high: 0, medium: 1, low: 2 }; return order[a.severity] - order[b.severity]; })
    .slice(0, 2);

  topIssues.forEach(issue => {
    if (!suggestions.includes(issue.action)) suggestions.push(issue.action);
  });

  // If text is long and no length suggestion yet
  if (wordCount > 80 && !suggestions.includes("shorten")) suggestions.push("shorten");

  // Always suggest enhance if no strong issues
  if (suggestions.length === 0) suggestions.push("enhance");

  return suggestions.slice(0, 3);
}

// ── Main Hook ─────────────────────────────────────────────────────────────────

export function useWritingIntelligence(text) {
  const [intelligence, setIntelligence] = useState(null);
  const timerRef = useRef(null);

  const analyse = useCallback((t) => {
    if (!t || t.trim().length < 10) {
      setIntelligence(null);
      return;
    }

    const words = t.trim().split(/\s+/).filter(Boolean);
    const wordCount = words.length;
    const charCount = t.length;
    const sentences = (t.match(/[^.!?]*[.!?]+/g) || [t]).filter(s => s.trim()).length;

    const readability = computeFlesch(t);
    const tone = detectTone(t);
    const issues = detectIssues(t);
    const suggested = suggestActions(issues, wordCount);
    const powerWordCount = words.filter(w => POWER_WORDS.has(w.toLowerCase())).length;
    const readTimeSeconds = Math.max(10, Math.round((wordCount / 238) * 60)); // 238 wpm average

    setIntelligence({
      readability,
      tone,
      issues,
      suggested,
      wordCount,
      charCount,
      sentences,
      powerWordCount,
      readTimeSeconds,
      hasContent: wordCount >= 3,
    });
  }, []);

  useEffect(() => {
    clearTimeout(timerRef.current);
    if (!text || text.trim().length < 10) {
      setIntelligence(null);
      return;
    }
    timerRef.current = setTimeout(() => analyse(text), 600);
    return () => clearTimeout(timerRef.current);
  }, [text, analyse]);

  return intelligence;
}