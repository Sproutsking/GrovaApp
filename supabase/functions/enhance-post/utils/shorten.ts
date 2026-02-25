// supabase/functions/enhance-post/utils/shorten.ts
import type { Change }         from "../index.ts";
import type { AdaptiveRules }  from "./adaptiveEngine.ts";

// ── Filler words to strip when standalone ────────────────────────────────────
const FILLER_WORDS = new Set([
  "very", "really", "just", "quite", "rather", "somewhat",
  "basically", "literally", "actually", "honestly", "truly",
  "definitely", "certainly", "absolutely", "totally", "completely",
  "simply", "merely", "only", "even", "already", "still",
  "anyway", "anyways", "like", "you know", "i mean",
  "kind of", "sort of",
  "to be honest", "to be fair",
  "at the end of the day",
  "needless to say",
  "as a matter of fact",
  "in actual fact",
]);

// ── Verbose phrase → concise replacement ─────────────────────────────────────
const COMPRESSION_MAP: Record<string, string> = {
  "in order to":                       "to",
  "due to the fact that":              "because",
  "at this point in time":             "now",
  "in the event that":                 "if",
  "with regard to":                    "about",
  "in reference to":                   "about",
  "for the purpose of":                "to",
  "in spite of the fact that":         "although",
  "on a regular basis":                "regularly",
  "on a daily basis":                  "daily",
  "in the near future":                "soon",
  "at the present time":               "currently",
  "in the process of":                 "currently",
  "make a decision":                   "decide",
  "come to a conclusion":              "conclude",
  "give consideration to":             "consider",
  "take into account":                 "consider",
  "be in a position to":               "be able to",
  "a large number of":                 "many",
  "a small number of":                 "few",
  "the majority of":                   "most",
  "in close proximity to":             "near",
  "in the vicinity of":                "near",
  "prior to":                          "before",
  "subsequent to":                     "after",
  "in addition to":                    "besides",
  "as well as":                        "and",
  "despite the fact that":             "although",
  "provided that":                     "if",
  "in the case of":                    "for",
  "in terms of":                       "for",
  "with the exception of":             "except",
  "it is important to note that":      "",
  "it should be noted that":           "",
  "please note that":                  "",
  "i wanted to let you know that":     "",
  "i just wanted to say that":         "",
  "i think that":                      "",
  "i believe that":                    "",
  "i feel that":                       "",
  "what i mean is":                    "",
};

interface ShortenResult {
  text:    string;
  changes: Change[];
}

export function shortenText(text: string, rules: AdaptiveRules): ShortenResult {
  const changes: Change[] = [];
  let result = text;

  // 1. Apply compression map — longest phrases first to avoid partial matches
  const sortedPhrases = Object.keys(COMPRESSION_MAP).sort((a, b) => b.length - a.length);

  for (const phrase of sortedPhrases) {
    const replacement = COMPRESSION_MAP[phrase];
    const regex = new RegExp(`\\b${escapeRegex(phrase)}\\b`, "gi");

    if (regex.test(result)) {
      const before = result;
      result = result
        .replace(regex, replacement)
        .replace(/\s{2,}/g, " ")
        .trim();

      if (before !== result) {
        changes.push({ from: phrase, to: replacement, type: "compression" });
      }
    }
  }

  // 2. Remove standalone filler words
  for (const filler of FILLER_WORDS) {
    // Respect user's preserved fillers (they've rejected removing this before)
    if (rules.preservedFillers?.includes(filler)) continue;

    const regex = new RegExp(`\\b${escapeRegex(filler)}\\b`, "gi");
    const before = result;
    result = result.replace(regex, "").replace(/\s{2,}/g, " ").trim();

    if (before !== result) {
      changes.push({ from: filler, to: "", type: "compression" });
    }
  }

  // 3. Clean up punctuation and spacing artifacts
  result = result
    .replace(/\s+([.,!?])/g, "$1")  // no space before punct
    .replace(/^[,;]\s*/g, "")        // no leading punct
    .replace(/\s{2,}/g, " ")         // double spaces
    .trim();

  // 4. Re-capitalise after removal
  result = result.replace(/^[a-z]/, (m) => m.toUpperCase());

  return { text: result, changes };
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}