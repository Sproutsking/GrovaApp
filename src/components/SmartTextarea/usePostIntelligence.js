// src/components/SmartTextarea/usePostIntelligence.js
// ─────────────────────────────────────────────────────────────────────────────
// Deep post analysis beyond basic readability:
//
//   • Engagement score (0-100) — hook strength, CTA, emotional density, length
//   • Post structure detection — has hook? has body? has CTA?
//   • Intent classification — inspire / educate / announce / connect / sell
//   • Topic detection — crypto / motivation / business / lifestyle / education
//   • Voice fingerprint — sentence length preference, emoji density, punctuation style
//   • Anti-repetition — overused words in current text
//   • Hook quality — first-line analysis
//   • Specific smart recommendations based on what's missing
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useRef, useCallback } from "react";
import { detectTopics, TOPIC_CLUSTERS, HIGH_ENGAGEMENT_PATTERNS } from "./suggestionData";

const DEBOUNCE_MS = 700;

// ══════════════════════════════════════════════════════════════════════════════
// ENGAGEMENT SCORING (0-100)
// ══════════════════════════════════════════════════════════════════════════════

function scoreEngagement(text) {
  if (!text || text.trim().length < 20) return { score: 0, breakdown: {} };

  const lines    = text.split("\n").filter(l => l.trim());
  const words    = text.trim().split(/\s+/).filter(Boolean);
  const wc       = words.length;
  const firstLine = lines[0] || "";

  let score = 0;
  const breakdown = {};

  // 1. Hook quality (30 pts max) — first line is critical
  const hookScore = scoreHook(firstLine);
  breakdown.hook = hookScore;
  score += hookScore;

  // 2. Engagement ending / CTA (20 pts max)
  const hasCTA      = /\?|comment|share|tell me|let me know|tag|drop|what do you|have you|reply|save this|repost|follow/i.test(text);
  const hasQuestion = (text.match(/\?/g) || []).length;
  const ctaScore    = Math.min(20, (hasCTA ? 12 : 0) + Math.min(8, hasQuestion * 4));
  breakdown.cta = ctaScore;
  score += ctaScore;

  // 3. Length optimization (15 pts max)
  // Sweet spot: 50-150 words for most platforms
  let lengthScore = 0;
  if      (wc >= 50  && wc <= 150) lengthScore = 15;
  else if (wc >= 30  && wc < 50)   lengthScore = 10;
  else if (wc > 150  && wc <= 250) lengthScore = 10;
  else if (wc >= 10  && wc < 30)   lengthScore = 6;
  else if (wc > 250)               lengthScore = 5;
  breakdown.length = lengthScore;
  score += lengthScore;

  // 4. Emotional / power word density (15 pts max)
  const emotionWords = ["love","hate","fear","hope","dream","fail","win","lose","change","truth","real","honest","secret","never","always","first","last","worst","best","only","free","new","now","today"];
  const emotionCount = words.filter(w => emotionWords.includes(w.toLowerCase())).length;
  const emotionScore = Math.min(15, emotionCount * 3);
  breakdown.emotion = emotionScore;
  score += emotionScore;

  // 5. Personal / relatable signal (10 pts max)
  const personalSignals = (text.match(/\b(I |my |me |I've|I'm|I had|I learned|I used|I realized|I failed|I know)\b/gi) || []).length;
  const personalScore   = Math.min(10, personalSignals * 2);
  breakdown.personal = personalScore;
  score += personalScore;

  // 6. Formatting / readability structure (10 pts max)
  const hasArrows    = /→|•|✓|★/.test(text);
  const hasBreaks    = (text.match(/\n\n/g) || []).length >= 1;
  const hasEmoji     = /\p{Emoji}/u.test(text);
  const formatScore  = (hasArrows ? 3 : 0) + (hasBreaks ? 4 : 0) + (hasEmoji ? 3 : 0);
  breakdown.format = formatScore;
  score += formatScore;

  return { score: Math.min(100, Math.round(score)), breakdown };
}

function scoreHook(firstLine) {
  if (!firstLine || firstLine.trim().length < 3) return 0;
  const line  = firstLine.trim().toLowerCase();
  let score   = 8; // base for having content

  // Pattern bonuses
  if (/^(hot take|unpopular opinion|real talk|honest(ly)?|the truth|nobody|stop|what if|i've been|i failed|a reminder|story time)/i.test(line)) score += 14;
  else if (/^(good morning|good evening|good night|gm |gn )/i.test(line)) score += 8;
  else if (/^(today i|this is|here's|the best|after years|3 things|everything changed)/i.test(line)) score += 10;
  else if (/^(just|so |basically|honestly just|hi |hey )/i.test(line)) score -= 4; // weak openers

  // Question hook bonus
  if (line.endsWith("?")) score += 5;

  // Short punchy hook bonus (5-10 words)
  const wc = line.split(/\s+/).length;
  if (wc >= 3 && wc <= 10) score += 3;

  // Emoji in hook bonus
  if (/\p{Emoji}/u.test(firstLine)) score += 2;

  return Math.max(0, Math.min(30, score));
}

// ══════════════════════════════════════════════════════════════════════════════
// STRUCTURE ANALYSIS
// ══════════════════════════════════════════════════════════════════════════════

function analyzeStructure(text) {
  const lines   = text.split("\n").filter(l => l.trim());
  const wc      = text.trim().split(/\s+/).filter(Boolean).length;
  const lastPart = text.slice(-200).toLowerCase();

  const hasHook = lines.length > 0 && lines[0].trim().length > 5;
  const hasBody = wc > 25;
  const hasCTA  = /\?|comment below|drop|let me know|tell me|tag|share|save|follow|reply/i.test(lastPart);
  const hasList = /[→•✓★◆▸]\s+\w/.test(text);
  const hasBreaks = (text.match(/\n\n/g) || []).length >= 1;

  const missing = [];
  if (!hasHook) missing.push({ label: "Add a hook", action: "hook", priority: "high", reason: "Your first line needs to stop the scroll" });
  if (!hasBody && hasHook) missing.push({ label: "Expand the body", action: "enhance", priority: "medium", reason: "Give readers something to act on" });
  if (!hasCTA) missing.push({ label: "Add a CTA", action: "engage", priority: "medium", reason: "Posts with questions get 2x more comments" });
  if (!hasBreaks && wc > 40) missing.push({ label: "Add white space", action: "shorten", priority: "low", reason: "Mobile readers need breathing room" });

  return { hasHook, hasBody, hasCTA, hasList, hasBreaks, missing };
}

// ══════════════════════════════════════════════════════════════════════════════
// INTENT CLASSIFICATION
// ══════════════════════════════════════════════════════════════════════════════

const INTENT_SIGNALS = {
  inspire:  { words: ["believe","you can","possible","dream","hope","keep going","never quit","rise","comeback","reminder","you've got this","don't give up"], color: "#f97316", emoji: "🔥", label: "Inspiring" },
  educate:  { words: ["here's how","step","learn","tip","guide","understand","explain","breakdown","strategy","method","technique","because","therefore","data","research","study"], color: "#38bdf8", emoji: "💡", label: "Educational" },
  announce: { words: ["excited","thrilled","proud","announcing","launching","new","just dropped","finally","today","introducing","big news","coming soon"], color: "#a855f7", emoji: "📢", label: "Announcement" },
  connect:  { words: ["have you","anyone else","share your","what do you","tell me","I'm curious","comment","genuine question","we all","together","community"], color: "#34d399", emoji: "💬", label: "Connecting" },
  story:    { words: ["a year ago","I used to","I failed","I learned","I realized","then one day","story","journey","experience","changed","before","after","now I know"], color: "#818cf8", emoji: "🧵", label: "Storytelling" },
  sell:     { words: ["available","buy","get","offer","deal","limited","exclusive","discount","today only","grab","link in bio","dm me","click","register","sign up"], color: "#fbbf24", emoji: "💰", label: "Promotional" },
};

function classifyIntent(text) {
  if (!text || text.length < 15) return null;
  const lower = text.toLowerCase();
  const scores = {};

  for (const [intent, signals] of Object.entries(INTENT_SIGNALS)) {
    let score = 0;
    for (const word of signals.words) {
      if (lower.includes(word)) score += 1;
    }
    if (score > 0) scores[intent] = score;
  }

  const top = Object.entries(scores).sort((a, b) => b[1] - a[1])[0];
  if (!top) return { intent: "general", color: "#84cc16", emoji: "📝", label: "General" };

  const [intent] = top;
  return { intent, ...INTENT_SIGNALS[intent] };
}

// ══════════════════════════════════════════════════════════════════════════════
// VOICE FINGERPRINTING
// ══════════════════════════════════════════════════════════════════════════════

function fingerprintVoice(text) {
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 3);
  if (sentences.length < 2) return null;

  const lengths = sentences.map(s => s.trim().split(/\s+/).length);
  const avgLen  = lengths.reduce((a, b) => a + b, 0) / lengths.length;

  const emojiCount    = (text.match(/\p{Emoji}/gu) || []).length;
  const exclamations  = (text.match(/!/g)  || []).length;
  const ellipses      = (text.match(/\.\.\./g) || []).length;
  const contractions  = (text.match(/\b(don't|I'm|won't|can't|it's|you're|we're|they're|I've|I'll)\b/gi) || []).length;
  const caps          = (text.match(/\b[A-Z]{2,}\b/g) || []).length;

  return {
    avgSentenceLength: Math.round(avgLen),
    style: avgLen <= 8 ? "punchy" : avgLen <= 15 ? "balanced" : "flowing",
    emojiDensity:  emojiCount > 3 ? "high" : emojiCount > 0 ? "medium" : "none",
    exclamatory:   exclamations >= 2,
    usesEllipses:  ellipses >= 1,
    usesContractions: contractions >= 2,
    allCaps:       caps >= 1,
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// OVER-USED WORD DETECTION
// ══════════════════════════════════════════════════════════════════════════════

const IGNORE_WORDS = new Set(["the","a","an","is","are","was","were","be","been","being","have","has","had","do","does","did","will","would","could","should","may","might","shall","can","and","but","or","so","yet","for","nor","not","in","on","at","to","of","with","by","from","as","if","then","that","this","it","he","she","we","they","i","you","my","your","our","their","his","her","its","me","him","us","them"]);

function detectOverusedWords(text) {
  if (!text || text.length < 30) return [];
  const words  = text.toLowerCase().replace(/[^a-z\s]/g, " ").split(/\s+/).filter(w => w.length > 3 && !IGNORE_WORDS.has(w));
  const counts = {};
  for (const w of words) counts[w] = (counts[w] || 0) + 1;
  return Object.entries(counts).filter(([, c]) => c >= 3).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([w, c]) => ({ word: w, count: c }));
}

// ══════════════════════════════════════════════════════════════════════════════
// SMART RECOMMENDATIONS ENGINE
// ══════════════════════════════════════════════════════════════════════════════

function generateRecommendations(text, engagement, structure, intent, topics, voice) {
  const recs = [];
  const wc   = text.trim().split(/\s+/).filter(Boolean).length;

  // Hook recommendation
  if (engagement.breakdown.hook < 15) {
    recs.push({
      type: "hook",
      priority: "high",
      label: "Strengthen your hook",
      detail: "Your opening line needs to grab attention in 2 seconds",
      action: "hook",
      example: topics[0] ? TOPIC_CLUSTERS[topics[0]]?.hooks?.[0] : "Hot take:",
    });
  }

  // CTA recommendation
  if (engagement.breakdown.cta < 8 && wc > 20) {
    recs.push({
      type: "cta",
      priority: "medium",
      label: "Missing engagement hook",
      detail: "End with a question or CTA — it doubles comment rate",
      action: "engage",
      example: topics[0] ? TOPIC_CLUSTERS[topics[0]]?.ctas?.[0] : "What do you think? Drop below 👇",
    });
  }

  // Length optimization
  if (wc > 200) {
    recs.push({
      type: "length",
      priority: "medium",
      label: `${wc} words — consider trimming`,
      detail: "Posts under 150 words perform significantly better on mobile",
      action: "shorten",
    });
  }

  if (wc < 20 && wc > 5) {
    recs.push({
      type: "thin",
      priority: "low",
      label: "Add more context",
      detail: "Give readers something to connect with or act on",
      action: "enhance",
    });
  }

  // Format recommendation
  if (wc > 50 && !structure.hasBreaks && !structure.hasList) {
    recs.push({
      type: "format",
      priority: "low",
      label: "Add visual breaks",
      detail: "Bullets or line breaks dramatically improve mobile readability",
      action: "rewrite",
    });
  }

  // Topic-specific
  if (topics[0] && engagement.score < 50) {
    const topicHook = TOPIC_CLUSTERS[topics[0]]?.hooks?.[0];
    if (topicHook) {
      recs.push({
        type: "topic",
        priority: "low",
        label: `${topics[0]} post tip`,
        detail: `Try opening with: "${topicHook}"`,
        action: "hook",
      });
    }
  }

  return recs.sort((a, b) => {
    const order = { high: 0, medium: 1, low: 2 };
    return order[a.priority] - order[b.priority];
  }).slice(0, 4);
}

// ══════════════════════════════════════════════════════════════════════════════
// MAIN HOOK
// ══════════════════════════════════════════════════════════════════════════════

export function usePostIntelligence(text) {
  const [intelligence, setIntelligence] = useState(null);
  const timerRef = useRef(null);

  const analyse = useCallback((t) => {
    if (!t || t.trim().length < 15) { setIntelligence(null); return; }

    const words    = t.trim().split(/\s+/).filter(Boolean);
    const wc       = words.length;
    const chars    = t.length;
    const sentences = (t.match(/[^.!?]*[.!?]+/g) || [t]).filter(s => s.trim()).length;

    const topics       = detectTopics(t);
    const engagement   = scoreEngagement(t);
    const structure    = analyzeStructure(t);
    const intent       = classifyIntent(t);
    const voice        = fingerprintVoice(t);
    const overused     = detectOverusedWords(t);
    const recommendations = generateRecommendations(t, engagement, structure, intent, topics, voice);

    // Flesch readability (kept for compatibility)
    const avgSentenceLen     = wc / Math.max(sentences, 1);
    const totalSyllables     = words.reduce((sum, w) => sum + countSyllables(w), 0);
    const avgSyllablesPerWord = totalSyllables / wc;
    const fleschScore = Math.max(0, Math.min(100, Math.round(
      206.835 - 1.015 * avgSentenceLen - 84.6 * avgSyllablesPerWord
    )));
    const fleschLevel =
      fleschScore >= 90 ? "Very Easy" :
      fleschScore >= 70 ? "Easy" :
      fleschScore >= 60 ? "Standard" :
      fleschScore >= 50 ? "Fairly Hard" :
      fleschScore >= 30 ? "Difficult" : "Very Hard";

    const readTimeSeconds = Math.max(10, Math.round((wc / 238) * 60));

    setIntelligence({
      wordCount: wc,
      charCount: chars,
      sentences,
      readTimeSeconds,
      topics,
      primaryTopic: topics[0] || null,
      engagement,
      structure,
      intent,
      voice,
      overused,
      recommendations,
      readability: {
        score: fleschScore,
        level: fleschLevel,
        avgWords: Math.round(avgSentenceLen * 10) / 10,
      },
      // Suggested actions (top 3 from recommendations)
      suggested: [...new Set(recommendations.map(r => r.action))].slice(0, 3),
    });
  }, []);

  useEffect(() => {
    clearTimeout(timerRef.current);
    if (!text || text.trim().length < 15) { setIntelligence(null); return; }
    timerRef.current = setTimeout(() => analyse(text), DEBOUNCE_MS);
    return () => clearTimeout(timerRef.current);
  }, [text, analyse]);

  return intelligence;
}

function countSyllables(word) {
  word = word.toLowerCase().replace(/[^a-z]/g, "");
  if (!word.length) return 0;
  if (word.length <= 3) return 1;
  word = word.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, "");
  word = word.replace(/^y/, "");
  const groups = word.match(/[aeiouy]{1,2}/g);
  return groups ? Math.max(1, groups.length) : 1;
}