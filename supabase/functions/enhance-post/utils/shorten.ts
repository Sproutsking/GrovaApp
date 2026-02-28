// supabase/functions/enhance-post/utils/shorten.ts
// ─────────────────────────────────────────────────────────────────────────────
// shortenText — removes redundancy, padding, and filler without changing meaning.
// FIX: imports Change from ./types (not ../index.ts which never exported it)
// ─────────────────────────────────────────────────────────────────────────────
import type { Change }        from "./types.ts";
import type { AdaptiveRules } from "./adaptiveEngine.ts";

const FILLER_ADVERBS = [
  "basically", "literally", "honestly", "actually", "simply",
  "just", "really", "very", "quite", "rather", "somewhat",
  "pretty much", "kind of", "sort of", "a little bit",
  "you know", "you see", "I mean", "I guess", "I suppose",
  "needless to say", "it goes without saying that",
  "as a matter of fact", "at the end of the day",
  "at this point in time", "due to the fact that",
  "in spite of the fact that", "in actual fact",
  "all things considered", "with that being said",
  "it is worth noting that", "it should be noted that",
  "it is important to note that",
];

const REDUNDANT_PAIRS: Array<[RegExp, string]> = [
  [/\beach and every\b/gi,          "every"],
  [/\bfirst and foremost\b/gi,      "first"],
  [/\btrue and accurate\b/gi,       "accurate"],
  [/\bnew and improved\b/gi,        "improved"],
  [/\bfree of charge\b/gi,          "free"],
  [/\bend result\b/gi,              "result"],
  [/\bfinal outcome\b/gi,           "outcome"],
  [/\bfuture plans\b/gi,            "plans"],
  [/\bpast history\b/gi,            "history"],
  [/\bunexpected surprise\b/gi,     "surprise"],
  [/\bassemble together\b/gi,       "assemble"],
  [/\bcollaborate together\b/gi,    "collaborate"],
  [/\bjoined together\b/gi,         "joined"],
  [/\bmerge together\b/gi,          "merge"],
  [/\bplan ahead\b/gi,              "plan"],
  [/\brepeat again\b/gi,            "repeat"],
  [/\brevert back\b/gi,             "revert"],
  [/\brise up\b/gi,                 "rise"],
  [/\bclose proximity\b/gi,         "proximity"],
  [/\bexact same\b/gi,              "same"],
  [/\bvery unique\b/gi,             "unique"],
  [/\bon a daily basis\b/gi,        "daily"],
  [/\bon a regular basis\b/gi,      "regularly"],
  [/\bin the event that\b/gi,       "if"],
  [/\bat this point in time\b/gi,   "now"],
  [/\bprior to\b/gi,                "before"],
  [/\bin order to\b/gi,             "to"],
  [/\bfor the purpose of\b/gi,      "to"],
  [/\bwith the exception of\b/gi,   "except"],
  [/\bin the near future\b/gi,      "soon"],
  [/\bthe majority of\b/gi,         "most"],
  [/\ba large number of\b/gi,       "many"],
  [/\ba small number of\b/gi,       "few"],
  [/\bdue to the fact that\b/gi,    "because"],
  [/\bowing to the fact that\b/gi,  "because"],
  [/\bdespite the fact that\b/gi,   "although"],
];

const PADDING_OPENERS = [
  /^(so,?\s+)?I (just |really |wanted|felt|thought|needed) (to )?share\s+(that\s+)?/i,
  /^(so,?\s+)?I (just |really |wanted|felt|thought|needed) (to )?say\s+(that\s+)?/i,
  /^(so,?\s+)?I (just |really |wanted|felt|thought|needed) (to )?let (you|everyone) know\s+(that\s+)?/i,
  /^(so,?\s+)?I (just |really |wanted|felt|thought|needed) (to )?take a moment\s+(to\s+)?/i,
  /^(so,?\s+)?I (just |really |wanted|felt|thought|needed) (to )?reach out\s+(and\s+)?/i,
  /^(honestly|basically|frankly|truthfully|candidly|genuinely),?\s+/i,
  /^(as you (may|might|probably|already) know,?\s+)/i,
  /^(let me (start|begin) by saying that\s+)/i,
];

const PADDING_CLOSERS = [
  /\s+I hope this (makes sense|helps|is useful|is helpful|is clear)\.?$/i,
  /\s+Let me know (your thoughts|what you think|if you have any questions)\.?$/i,
  /\s+Feel free to (ask|reach out|comment|share).+\.?$/i,
  /\s+Thank you for (reading|your time|taking the time|your attention)\.?$/i,
  /\s+(As always,?\s+)?stay (safe|tuned|positive|motivated|inspired)\.?$/i,
];

const VERBOSE_VERBS: Array<[RegExp, string]> = [
  [/\bis able to\b/gi,           "can"],
  [/\bare able to\b/gi,          "can"],
  [/\bwas able to\b/gi,          "could"],
  [/\bwere able to\b/gi,         "could"],
  [/\bhas the ability to\b/gi,   "can"],
  [/\bhave the ability to\b/gi,  "can"],
  [/\bhas a tendency to\b/gi,    "tends to"],
  [/\bhave a tendency to\b/gi,   "tend to"],
  [/\bis in need of\b/gi,        "needs"],
  [/\bare in need of\b/gi,       "need"],
  [/\bmake use of\b/gi,          "use"],
  [/\bcome to the conclusion\b/gi, "conclude"],
  [/\bprovide support for\b/gi,  "support"],
  [/\bgive consideration to\b/gi,"consider"],
  [/\bcarry out\b/gi,            "do"],
  [/\bput in place\b/gi,         "implement"],
  [/\bin order to\b/gi,          "to"],
];

export interface ShortenResult {
  text:    string;
  changes: Change[];
}

export function shortenText(text: string, rules: AdaptiveRules): ShortenResult {
  const changes: Change[] = [];
  let result = text;

  for (const [regex, replacement] of REDUNDANT_PAIRS) {
    const before = result;
    result = result.replace(regex, replacement);
    if (before !== result) {
      changes.push({ from: before.match(regex)?.[0] || "", to: replacement, type: "compression" });
    }
  }

  for (const [regex, replacement] of VERBOSE_VERBS) {
    const before = result;
    result = result.replace(regex, replacement);
    if (before !== result) {
      changes.push({ from: before.match(regex)?.[0] || "", to: replacement, type: "compression" });
    }
  }

  for (const filler of FILLER_ADVERBS) {
    if (rules.preservedFillers?.includes(filler.toLowerCase())) continue;
    const escaped = filler.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex   = new RegExp(`\\b${escaped}\\b,?\\s*`, "gi");
    const before  = result;
    result = result.replace(regex, " ").replace(/\s{2,}/g, " ").trim();
    if (before !== result) {
      changes.push({ from: filler, to: "", type: "compression" });
    }
  }

  for (const opener of PADDING_OPENERS) {
    const before = result;
    result = result.replace(opener, "");
    if (before !== result) {
      result = result.charAt(0).toUpperCase() + result.slice(1);
      changes.push({ from: "(padding opener)", to: "", type: "compression" });
      break;
    }
  }

  for (const closer of PADDING_CLOSERS) {
    const before = result;
    result = result.replace(closer, "");
    if (before !== result) {
      changes.push({ from: "(padding closer)", to: "", type: "compression" });
      break;
    }
  }

  const stackBefore = result;
  result = result.replace(/\b(very|really|so|quite)\s+\1\b/gi, "$1");
  if (stackBefore !== result) {
    changes.push({ from: "doubled intensifier", to: "single", type: "compression" });
  }

  result = result.replace(/\s{2,}/g, " ").trim();
  return { text: result, changes };
}