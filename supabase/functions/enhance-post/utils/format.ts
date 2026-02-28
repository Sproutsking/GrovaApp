// supabase/functions/enhance-post/utils/format.ts
// ─────────────────────────────────────────────────────────────────────────────
// smartFormat — always runs FIRST before any action.
// Pure function, zero latency, no external calls.
//
// Rules (in order):
//  1.  Outer whitespace trim
//  2.  Normalise multiple spaces → single (preserve newlines)
//  3.  Max one blank line between paragraphs
//  4.  Capitalise first letter of each sentence
//  5.  No space before punctuation
//  6.  Single space after punctuation
//  7.  Ending punctuation (smart — skips emoji-ending posts)
//  8.  Quote spacing
//  9.  Trailing spaces per line
//  10. Hashtag normalisation (#good morning → #GoodMorning)
//  11. URL protection (never touch URLs)
//  12. Ellipsis normalisation (... → …)
//  13. Dash normalisation (-- → —)
// ─────────────────────────────────────────────────────────────────────────────

// Matches URLs so we never reformat them
const URL_REGEX = /https?:\/\/[^\s]+/g;

export function smartFormat(text: string): string {
  // ── Extract and protect URLs ──────────────────────────────────────────────
  const urlPlaceholders: Record<string, string> = {};
  let urlIdx = 0;

  let t = text.replace(URL_REGEX, (url) => {
    const key = `__URL_${urlIdx++}__`;
    urlPlaceholders[key] = url;
    return key;
  });

  // 1. Trim
  t = t.trim();

  // 2. Multiple spaces → single (preserve newlines)
  t = t.replace(/[^\S\r\n]{2,}/g, " ");

  // 3. Max one blank line
  t = t.replace(/(\r?\n){3,}/g, "\n\n");

  // 4. Capitalise sentences
  t = capitaliseSentences(t);

  // 5. No space before punctuation (but not before ellipsis)
  t = t.replace(/\s+([,.!?;:](?!\.\.))/g, "$1");

  // 6. Single space after punctuation
  t = t.replace(/([,.!?;:])([^\s\n"')\]0-9__])/g, "$1 $2");

  // 7. Ending punctuation (skip if ends with emoji or hashtag)
  t = ensureEndingPunctuation(t);

  // 8. Quote spacing
  t = t.replace(/"\s{2,}/g, '" ').replace(/\s{2,}"/g, ' "');

  // 9. Trailing spaces per line
  t = t.split("\n").map((line) => line.trimEnd()).join("\n");

  // 10. Normalise hashtags: #hello world → #HelloWorld (camelCase)
  t = t.replace(/#([a-z][a-z\s]+?)(?=\s|$|[^\w])/g, (_, phrase) => {
    const camel = phrase.trim().split(/\s+/).map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join("");
    return `#${camel}`;
  });

  // 11. Ellipsis
  t = t.replace(/\.{3}/g, "…");

  // 12. Em dash
  t = t.replace(/--/g, "—");

  // ── Restore URLs ──────────────────────────────────────────────────────────
  for (const [key, url] of Object.entries(urlPlaceholders)) {
    t = t.replace(key, url);
  }

  return t;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function capitaliseSentences(text: string): string {
  return text
    .replace(/(^|[.!?…]\s+)([a-z])/g, (_match, prefix, letter) => prefix + letter.toUpperCase())
    .replace(/^([a-z])/, (m) => m.toUpperCase());
}

// Emoji detection — don't add punctuation if post ends with one
const EMOJI_REGEX = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]$/u;
const HASHTAG_REGEX = /#\w+$/;

function ensureEndingPunctuation(text: string): string {
  const trimmed = text.trimEnd();
  if (!trimmed) return text;

  // Don't add punctuation after emoji or hashtag
  if (EMOJI_REGEX.test(trimmed) || HASHTAG_REGEX.test(trimmed)) return text;

  const endsWithWord = /[a-zA-Z0-9'"]$/.test(trimmed);
  return endsWithWord ? trimmed + "." : text;
}