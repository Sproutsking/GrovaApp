// supabase/functions/enhance-post/utils/enhance.ts
import type { Change }        from "../index.ts";
import type { AdaptiveRules } from "./adaptiveEngine.ts";

type Style = "casual" | "formal" | "neutral";

// ── Tone maps ─────────────────────────────────────────────────────────────────

// Neutral — universally stronger alternatives
const TONE_NEUTRAL: Record<string, string[]> = {
  "good":          ["excellent", "outstanding", "remarkable"],
  "great":         ["exceptional", "extraordinary", "phenomenal"],
  "nice":          ["impressive", "compelling", "striking"],
  "bad":           ["poor", "inadequate", "problematic"],
  "big":           ["significant", "substantial", "considerable"],
  "small":         ["minimal", "modest", "limited"],
  "important":     ["critical", "essential", "vital"],
  "interesting":   ["fascinating", "compelling", "thought-provoking"],
  "happy":         ["thrilled", "delighted", "overjoyed"],
  "sad":           ["disheartened", "troubled", "concerned"],
  "think":         ["believe", "recognise", "understand"],
  "show":          ["demonstrate", "reveal", "illustrate"],
  "use":           ["leverage", "utilise", "employ"],
  "make":          ["create", "develop", "craft"],
  "get":           ["achieve", "obtain", "secure"],
  "help":          ["support", "empower", "enable"],
  "start":         ["launch", "initiate", "pioneer"],
  "change":        ["transform", "reshape", "redefine"],
  "need":          ["require", "demand", "necessitate"],
  "want":          ["aspire to", "seek to", "aim to"],
  "try":           ["strive", "endeavour", "pursue"],
  "work":          ["collaborate", "execute", "deliver"],
  "said":          ["stated", "emphasised", "highlighted"],
  "talked about":  ["discussed", "explored", "addressed"],
  "went up":       ["surged", "climbed", "escalated"],
  "went down":     ["declined", "dropped", "fell"],
  "a lot of":      ["numerous", "extensive", "widespread"],
  "lots of":       ["numerous", "abundant", "significant"],
  "also":          ["furthermore", "additionally", "moreover"],
  "but":           ["however", "nevertheless", "yet"],
  "so":            ["therefore", "consequently", "thus"],
  "because":       ["given that", "since", "as"],
};

// Casual — punchy, social-media energy
const TONE_CASUAL: Record<string, string[]> = {
  "good":      ["solid", "fire", "top-tier"],
  "great":     ["incredible", "next-level", "elite"],
  "bad":       ["rough", "off", "weak"],
  "important": ["huge", "major", "a big deal"],
  "happy":     ["pumped", "stoked", "excited"],
  "think":     ["feel like", "reckon", "see it as"],
  "make":      ["drop", "build", "put together"],
  "work":      ["grind", "hustle", "push through"],
  "try":       ["go for it", "give it a shot", "push for"],
  "show":      ["prove", "put on display", "flex"],
};

// Formal — professional, authoritative, polished
const TONE_FORMAL: Record<string, string[]> = {
  "good":      ["commendable", "meritorious", "praiseworthy"],
  "great":     ["exemplary", "distinguished", "superior"],
  "bad":       ["deficient", "substandard", "unsatisfactory"],
  "important": ["imperative", "paramount", "indispensable"],
  "think":     ["posit", "assert", "maintain"],
  "show":      ["demonstrate", "substantiate", "corroborate"],
  "make":      ["establish", "formulate", "institute"],
  "try":       ["endeavour", "attempt", "undertake"],
  "use":       ["employ", "utilise", "apply"],
};

// Power openers applied to flat-starting posts (non-formal only)
const POWER_OPENERS = [
  "Here's the truth:",
  "Let's be real —",
  "Worth saying:",
  "Something I keep thinking about:",
  "The reality is,",
  "Hot take:",
  "Unpopular opinion:",
  "Real talk —",
];

interface EnhanceResult {
  text:    string;
  changes: Change[];
}

export function enhanceTone(
  text:   string,
  rules:  AdaptiveRules,
  style:  Style
): EnhanceResult {
  const changes: Change[] = [];
  let result = text;

  // Build the composite tone map for this style
  const primaryMap: Record<string, string[]> =
    style === "casual"
      ? { ...TONE_NEUTRAL, ...TONE_CASUAL }
      : style === "formal"
      ? { ...TONE_NEUTRAL, ...TONE_FORMAL }
      : TONE_NEUTRAL;

  // Apply user's own custom enhancements first (highest priority)
  if (rules.customEnhancements) {
    for (const [from, to] of Object.entries(rules.customEnhancements)) {
      const regex = new RegExp(`\\b${escapeRegex(from)}\\b`, "gi");
      if (regex.test(result)) {
        const before = result;
        result = result.replace(regex, to);
        if (before !== result) {
          changes.push({ from, to, type: "tone" });
        }
      }
    }
  }

  // Apply tone map — sort by length descending to avoid partial matches
  const sortedKeys = Object.keys(primaryMap).sort((a, b) => b.length - a.length);

  for (const weak of sortedKeys) {
    // Skip if user has rejected replacing this word before
    if (rules.rejectedEnhancements?.includes(weak)) continue;

    const options      = primaryMap[weak];
    const replacement  = pickBestReplacement(options, rules);
    const regex        = new RegExp(`\\b${escapeRegex(weak)}\\b`, "gi");

    if (regex.test(result)) {
      const before = result;
      // Replace only the FIRST occurrence to keep the text natural
      result = result.replace(new RegExp(`\\b${escapeRegex(weak)}\\b`, "i"), replacement);

      if (before !== result) {
        changes.push({ from: weak, to: replacement, type: "tone" });
      }
    }
  }

  // Add power opener if post starts flatly and style isn't formal
  if (style !== "formal" && shouldAddOpener(result, rules)) {
    const opener = POWER_OPENERS[Math.floor(Math.random() * POWER_OPENERS.length)];
    const firstChar = result.charAt(0).toLowerCase();
    result = `${opener} ${firstChar}${result.slice(1)}`;
    changes.push({ from: "(opening)", to: opener, type: "tone" });
  }

  return { text: result, changes };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function pickBestReplacement(options: string[], rules: AdaptiveRules): string {
  if (rules.acceptedReplacements) {
    const preferred = options.find((o) => rules.acceptedReplacements?.includes(o));
    if (preferred) return preferred;
  }
  return options[0];
}

function shouldAddOpener(text: string, rules: AdaptiveRules): boolean {
  if (rules.noOpeners) return false;
  const weakStarters = ["i ", "we ", "the ", "this ", "a ", "it "];
  const lower = text.toLowerCase();
  return weakStarters.some((s) => lower.startsWith(s)) && text.length > 40;
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}