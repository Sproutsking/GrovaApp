// supabase/functions/enhance-post/utils/grammar.ts
import type { Change } from "../index.ts";

const LANGUAGETOOL_URL = "https://api.languagetool.org/v2/check";

// Rules we never auto-apply — too risky or purely stylistic
const SKIP_RULE_IDS = new Set([
  "UPPERCASE_SENTENCE_START",
  "EN_QUOTES",
  "COMMA_PARENTHESIS_WHITESPACE",
  "WHITESPACE_RULE",
  "WORD_CONTAINS_UNDERSCORE",
]);

interface LTMatch {
  message: string;
  offset:  number;
  length:  number;
  rule:    { id: string; category: { id: string } };
  replacements: { value: string }[];
}

interface LTResponse {
  matches: LTMatch[];
}

interface GrammarResult {
  text:    string;
  changes: Change[];
}

export async function fixGrammar(text: string): Promise<GrammarResult> {
  try {
    const params = new URLSearchParams({
      text,
      language:    "en-US",
      enabledOnly: "false",
    });

    const res = await fetch(LANGUAGETOOL_URL, {
      method:  "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body:    params.toString(),
      signal:  AbortSignal.timeout(5000), // 5-second hard timeout
    });

    if (!res.ok) {
      // LanguageTool unavailable — fall back to local rules
      return localGrammarFix(text);
    }

    const data: LTResponse = await res.json();

    // Filter and sort matches from end to start (preserves offsets during replacement)
    const validMatches = data.matches
      .filter(
        (m) =>
          !SKIP_RULE_IDS.has(m.rule.id) &&
          m.replacements.length > 0
      )
      .sort((a, b) => b.offset - a.offset);

    let result  = text;
    const changes: Change[] = [];

    for (const match of validMatches) {
      const original    = result.substring(match.offset, match.offset + match.length);
      const replacement = match.replacements[0].value;

      if (original === replacement) continue;

      result =
        result.substring(0, match.offset) +
        replacement +
        result.substring(match.offset + match.length);

      changes.push({
        from:     original,
        to:       replacement,
        type:     "grammar",
        position: match.offset,
      });
    }

    return { text: result, changes };
  } catch {
    // Network error, timeout, or parse failure — fall back silently
    return localGrammarFix(text);
  }
}

/**
 * localGrammarFix
 * Applied when LanguageTool is unreachable.
 * Covers the most common, high-confidence errors without any external call.
 */
function localGrammarFix(text: string): GrammarResult {
  const changes: Change[] = [];
  let result = text;

  // Each entry: [regex, replacement, label]
  const rules: Array<[RegExp, string, string]> = [
    // a → an before vowel sounds
    [/\ba ([aeiouAEIOU][a-z])/g,  "an $1", "a → an"],
    // an → a before consonant sounds
    [/\ban ([^aeiouAEIOU\s])/g,   "a $1",  "an → a"],

    // Doubled words
    [/\b(\w+)\s+\1\b/gi, "$1", "doubled word"],

    // Missing apostrophes in common contractions
    [/\bcant\b/g,      "can't",    "can't"],
    [/\bdont\b/g,      "don't",    "don't"],
    [/\bwont\b/g,      "won't",    "won't"],
    [/\bisnt\b/g,      "isn't",    "isn't"],
    [/\barent\b/g,     "aren't",   "aren't"],
    [/\bwouldnt\b/g,   "wouldn't", "wouldn't"],
    [/\bcouldnt\b/g,   "couldn't", "couldn't"],
    [/\bshouldnt\b/g,  "shouldn't","shouldn't"],
    [/\bdidnt\b/g,     "didn't",   "didn't"],
    [/\bhasnt\b/g,     "hasn't",   "hasn't"],
    [/\bhavent\b/g,    "haven't",  "haven't"],
    [/\bim\b/g,        "I'm",      "I'm"],
    [/\bive\b/g,       "I've",     "I've"],
    [/\bId\b/g,        "I'd",      "I'd"],
    [/\bIll\b/g,       "I'll",     "I'll"],

    // Lowercase 'i' standing alone
    [/\bi\b/g, "I", "i → I"],

    // Common typos
    [/\bteh\b/g,          "the",        "teh → the"],
    [/\brecieve\b/gi,     "receive",    "recieve"],
    [/\bseperate\b/gi,    "separate",   "seperate"],
    [/\boccured\b/gi,     "occurred",   "occured"],
    [/\bdefinately\b/gi,  "definitely", "definately"],
    [/\buntill\b/gi,      "until",      "untill"],
    [/\balot\b/gi,        "a lot",      "alot"],
    [/\bthier\b/gi,       "their",      "thier"],
    [/\bwierd\b/gi,       "weird",      "wierd"],
    [/\bfreind\b/gi,      "friend",     "freind"],
    [/\bbcause\b/gi,      "because",    "bcause"],
    [/\bbecuase\b/gi,     "because",    "becuase"],
    [/\bwoud\b/gi,        "would",      "woud"],
    [/\bcoud\b/gi,        "could",      "coud"],
    [/\bshoud\b/gi,       "should",     "shoud"],
  ];

  for (const [regex, replacement, label] of rules) {
    const before = result;
    result = result.replace(regex, replacement);
    if (before !== result) {
      changes.push({ from: label, to: replacement, type: "grammar" });
    }
  }

  return { text: result, changes };
}