// supabase/functions/enhance-post/utils/format.ts

/**
 * smartFormat
 *
 * Always runs FIRST on every action before any other processing.
 * Pure function, zero latency, no external calls.
 *
 * Handles:
 *  1. Outer whitespace trimming
 *  2. Multiple spaces → single space (preserves newlines)
 *  3. Multiple blank lines → max one blank line
 *  4. Capitalise first letter of each sentence
 *  5. Fix space before punctuation
 *  6. Ensure single space after punctuation
 *  7. Ensure proper ending punctuation
 *  8. Fix spacing around quotes
 *  9. Strip trailing spaces on each line
 */
export function smartFormat(text: string): string {
  let t = text;

  // 1. Trim outer whitespace
  t = t.trim();

  // 2. Normalise multiple spaces to single (preserve line breaks)
  t = t.replace(/[^\S\r\n]{2,}/g, " ");

  // 3. Max one blank line between paragraphs
  t = t.replace(/(\r?\n){3,}/g, "\n\n");

  // 4. Capitalise first letter of each sentence
  t = capitaliseSentences(t);

  // 5. No space before punctuation
  t = t.replace(/\s+([,.!?;:])/g, "$1");

  // 6. Single space after punctuation (not at string end, not before quote/bracket/digit)
  t = t.replace(/([,.!?;:])([^\s\n"')\]0-9])/g, "$1 $2");

  // 7. Ensure ending punctuation if text ends with a word character
  t = ensureEndingPunctuation(t);

  // 8. Fix common quote spacing
  t = t.replace(/"\s+/g, '"').replace(/\s+"/g, ' "');

  // 9. Trailing spaces on each line
  t = t.split("\n").map((line) => line.trimEnd()).join("\n");

  return t;
}

function capitaliseSentences(text: string): string {
  return text
    // Capitalise after . ! ? followed by whitespace
    .replace(/(^|[.!?]\s+)([a-z])/g, (_match, prefix, letter) => prefix + letter.toUpperCase())
    // Capitalise the very first character
    .replace(/^([a-z])/, (m) => m.toUpperCase());
}

function ensureEndingPunctuation(text: string): string {
  const trimmed = text.trimEnd();
  if (!trimmed) return text;

  const last = trimmed[trimmed.length - 1];
  const endsWithWord = /[a-zA-Z0-9'"]$/.test(trimmed);

  if (endsWithWord) {
    return trimmed + ".";
  }

  return text;
}