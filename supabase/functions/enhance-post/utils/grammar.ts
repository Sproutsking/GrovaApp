// supabase/functions/enhance-post/utils/grammar.ts
// ─────────────────────────────────────────────────────────────────────────────
// fixGrammar — two-layer approach:
//   Layer 1: LanguageTool API (5s timeout, best-effort)
//   Layer 2: Local rule set (instant fallback, ~80% of real-world errors)
//
// FIX: Now imports Change from ./types (not ../index.ts which never exported it)
// ─────────────────────────────────────────────────────────────────────────────
import type { Change } from "./types.ts";

const LANGUAGETOOL_URL = "https://api.languagetool.org/v2/check";

const SKIP_RULE_IDS = new Set([
  "UPPERCASE_SENTENCE_START",
  "EN_QUOTES",
  "COMMA_PARENTHESIS_WHITESPACE",
  "WHITESPACE_RULE",
  "WORD_CONTAINS_UNDERSCORE",
  "DASH_RULE",
  "UNLIKELY_OPENING_PUNCTUATION",
]);

interface LTMatch {
  message:      string;
  offset:       number;
  length:       number;
  rule:         { id: string; category: { id: string } };
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
      signal:  AbortSignal.timeout(5000),
    });

    if (!res.ok) return localGrammarFix(text);

    const data: LTResponse = await res.json();

    const validMatches = data.matches
      .filter(m => !SKIP_RULE_IDS.has(m.rule.id) && m.replacements.length > 0)
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

      changes.push({ from: original, to: replacement, type: "grammar", position: match.offset });
    }

    const { text: localFixed, changes: localChanges } = localGrammarFix(result);
    return { text: localFixed, changes: [...changes, ...localChanges] };

  } catch {
    return localGrammarFix(text);
  }
}

type Rule = [RegExp, string, string];

const LOCAL_RULES: Rule[] = [
  // ── Article repair ─────────────────────────────────────────────────────────
  [/\ba ([aeiouAEIOU][a-zA-Z])/g,                   "an $1",        "a → an before vowel"],
  [/\ban ([^aeiouAEIOU\s])/g,                        "a $1",         "an → a before consonant"],

  // ── Standalone i → I ───────────────────────────────────────────────────────
  [/\bi\b/g,                                          "I",            "i → I"],

  // ── Doubled words ──────────────────────────────────────────────────────────
  [/\b(\w+)\s+\1\b/gi,                                "$1",           "doubled word"],

  // ── Contractions ──────────────────────────────────────────────────────────
  [/\bcant\b/g,       "can't",     "can't"],
  [/\bdont\b/g,       "don't",     "don't"],
  [/\bwont\b/g,       "won't",     "won't"],
  [/\bisnt\b/g,       "isn't",     "isn't"],
  [/\barent\b/g,      "aren't",    "aren't"],
  [/\bwerent\b/g,     "weren't",   "weren't"],
  [/\bwasnt\b/g,      "wasn't",    "wasn't"],
  [/\bwouldnt\b/g,    "wouldn't",  "wouldn't"],
  [/\bcouldnt\b/g,    "couldn't",  "couldn't"],
  [/\bshouldnt\b/g,   "shouldn't", "shouldn't"],
  [/\bdidnt\b/g,      "didn't",    "didn't"],
  [/\bhasnt\b/g,      "hasn't",    "hasn't"],
  [/\bhavent\b/g,     "haven't",   "haven't"],
  [/\bhadnt\b/g,      "hadn't",    "hadn't"],
  [/\bdoesnt\b/g,     "doesn't",   "doesn't"],
  [/\bim\b/g,         "I'm",       "I'm"],
  [/\bive\b/g,        "I've",      "I've"],
  [/\bid\b(?!\s+like)/g, "I'd",    "I'd"],
  [/\bill\b/g,        "I'll",      "I'll"],
  [/\bthats\b/g,      "that's",    "that's"],
  [/\bwhats\b/g,      "what's",    "what's"],
  [/\bwhos\b/g,       "who's",     "who's"],
  [/\bits\b(?!\s+\w+\s+\w)/g, "it's", "it's"],
  [/\blets\b/g,       "let's",     "let's"],
  [/\btheyre\b/g,     "they're",   "they're"],
  [/\byoure\b/g,      "you're",    "you're"],
  [/\byoull\b/g,      "you'll",    "you'll"],
  [/\byouve\b/g,      "you've",    "you've"],
  [/\bweve\b/g,       "we've",     "we've"],

  // ── Common typos ───────────────────────────────────────────────────────────
  [/\bteh\b/gi,           "the",          "teh"],
  [/\brecieve\b/gi,       "receive",      "recieve"],
  [/\bseperate\b/gi,      "separate",     "seperate"],
  [/\boccured\b/gi,       "occurred",     "occured"],
  [/\bdefinately\b/gi,    "definitely",   "definately"],
  [/\balot\b/gi,          "a lot",        "alot"],
  [/\bthier\b/gi,         "their",        "thier"],
  [/\bwierd\b/gi,         "weird",        "wierd"],
  [/\bfreind\b/gi,        "friend",       "freind"],
  [/\bbecuase\b/gi,       "because",      "becuase"],
  [/\baccomodate\b/gi,    "accommodate",  "accomodate"],
  [/\baquire\b/gi,        "acquire",      "aquire"],
  [/\bexistance\b/gi,     "existence",    "existance"],
  [/\boccassion\b/gi,     "occasion",     "occassion"],
  [/\btommorrow\b/gi,     "tomorrow",     "tommorrow"],
  [/\byestarday\b/gi,     "yesterday",    "yestarday"],
  [/\bbegining\b/gi,      "beginning",    "begining"],
  [/\bcommitee\b/gi,      "committee",    "commitee"],
  [/\bgoverment\b/gi,     "government",   "goverment"],
  [/\boppurtunity\b/gi,   "opportunity",  "oppurtunity"],
  [/\bsuprise\b/gi,       "surprise",     "suprise"],
  [/\buntill\b/gi,        "until",        "untill"],

  // ── Homophone fixes ────────────────────────────────────────────────────────
  [/\bthere (going|coming|doing|making|taking|getting|trying|working|saying|looking)\b/gi,
    "they're $1",  "there → they're"],
  [/\byour welcome\b/gi,   "you're welcome", "your → you're"],
  [/\byour (right|wrong|correct|mistaken|amazing|awesome|brilliant)\b/gi,
    "you're $1",   "your → you're"],
  [/\bshould of\b/gi,      "should have",    "should of"],
  [/\bcould of\b/gi,       "could have",     "could of"],
  [/\bwould of\b/gi,       "would have",     "would of"],
  [/\bmust of\b/gi,        "must have",      "must of"],

  // ── Spacing ────────────────────────────────────────────────────────────────
  [/\s+,/g,    ",",   "space before comma"],
  [/\s+\./g,   ".",   "space before period"],
  [/,([^\s])/g, ", $1", "no space after comma"],
];

function localGrammarFix(text: string): GrammarResult {
  const changes: Change[] = [];
  let result = text;

  for (const [regex, replacement, label] of LOCAL_RULES) {
    const before = result;
    result = result.replace(regex, replacement as string);
    if (before !== result) {
      changes.push({ from: label, to: replacement as string, type: "grammar" });
    }
  }

  return { text: result, changes };
}