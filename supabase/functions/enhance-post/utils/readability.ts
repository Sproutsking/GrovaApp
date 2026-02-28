// supabase/functions/enhance-post/utils/readability.ts
// ─────────────────────────────────────────────────────────────────────────────
// Pure Flesch-Kincaid readability scoring.
// No external calls. Used to measure improvement before/after each action.
//
// Flesch Reading Ease (0–100):
//   90–100  Very easy     (Grade 5)
//   70–90   Easy          (Grade 6)
//   60–70   Standard      (Grade 7–8)
//   50–60   Fairly diff.  (Grade 9–10)
//   30–50   Difficult     (Grade 11–College)
//   0–30    Very diff.    (Professional)
//
// FK Grade Level formula also computed for the grade label.
// ─────────────────────────────────────────────────────────────────────────────

export interface ReadabilityResult {
  score: number;   // Flesch Reading Ease 0–100
  grade: string;   // e.g. "Grade 8"
  level: string;   // e.g. "Standard"
  avgWordsPerSentence: number;
  avgSyllablesPerWord: number;
}

export function scoreReadability(text: string): ReadabilityResult {
  const sentences = countSentences(text);
  const words     = countWords(text);
  const syllables = countSyllables(text);

  // Avoid division by zero on very short inputs
  if (words === 0 || sentences === 0) {
    return { score: 100, grade: "N/A", level: "N/A", avgWordsPerSentence: 0, avgSyllablesPerWord: 0 };
  }

  const avgWordsPerSentence  = words / sentences;
  const avgSyllablesPerWord  = syllables / words;

  // Flesch Reading Ease
  const flesh = 206.835
    - 1.015  * avgWordsPerSentence
    - 84.6   * avgSyllablesPerWord;

  const score = Math.max(0, Math.min(100, Math.round(flesh)));

  // Flesch-Kincaid Grade Level
  const gradeNum = 0.39 * avgWordsPerSentence + 11.8 * avgSyllablesPerWord - 15.59;
  const gradeInt = Math.max(1, Math.round(gradeNum));
  const grade    = gradeInt >= 13 ? "College+" : `Grade ${gradeInt}`;

  const level = getLevel(score);

  return { score, grade, level, avgWordsPerSentence: Math.round(avgWordsPerSentence * 10) / 10, avgSyllablesPerWord: Math.round(avgSyllablesPerWord * 100) / 100 };
}

// ── Counters ──────────────────────────────────────────────────────────────────

function countSentences(text: string): number {
  const matches = text.match(/[^.!?]*[.!?]+/g);
  return matches ? matches.length : 1;
}

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function countSyllables(text: string): number {
  const words = text.toLowerCase().trim().split(/\s+/).filter(Boolean);
  return words.reduce((total, word) => total + syllablesInWord(word), 0);
}

/**
 * syllablesInWord
 * Heuristic syllable counter — accurate enough for readability scoring.
 * Based on the classic Perl algorithm by Greg Fast.
 */
function syllablesInWord(word: string): number {
  // Strip non-alpha
  word = word.replace(/[^a-z]/g, "");
  if (!word.length) return 0;

  // Special cases
  if (word.length <= 3) return 1;

  // Remove trailing silent-e patterns
  word = word.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, "");
  word = word.replace(/^y/, "");

  const vowelGroups = word.match(/[aeiouy]{1,2}/g);
  return vowelGroups ? Math.max(1, vowelGroups.length) : 1;
}

function getLevel(score: number): string {
  if (score >= 90) return "Very Easy";
  if (score >= 70) return "Easy";
  if (score >= 60) return "Standard";
  if (score >= 50) return "Fairly Difficult";
  if (score >= 30) return "Difficult";
  return "Very Difficult";
}