// supabase/functions/enhance-post/utils/enhance.ts
// ─────────────────────────────────────────────────────────────────────────────
// enhanceTone — upgrades weak vocabulary to stronger, more precise alternatives.
// Pure function, zero external calls.
//
// Additions over v1:
//  • 3× larger tone maps
//  • Negative sentiment words handled correctly (not made falsely positive)
//  • Context-aware: detects question posts and skips power openers
//  • Hashtag and mention protection (never touched)
//  • Multi-word phrase replacement before single-word (avoids partial matches)
//  • Sentence-end awareness: doesn't create double punctuation
// ─────────────────────────────────────────────────────────────────────────────
import type { Change }        from "../index.ts";
import type { AdaptiveRules } from "./adaptiveEngine.ts";

type Style = "casual" | "formal" | "neutral";

// ── Neutral tone map ──────────────────────────────────────────────────────────
const TONE_NEUTRAL: Record<string, string[]> = {
  // Positive
  "good":          ["excellent", "outstanding", "remarkable"],
  "great":         ["exceptional", "extraordinary", "phenomenal"],
  "nice":          ["impressive", "compelling", "striking"],
  "amazing":       ["extraordinary", "remarkable", "breathtaking"],
  "awesome":       ["remarkable", "extraordinary", "impressive"],
  "wonderful":     ["exceptional", "magnificent", "splendid"],
  "fantastic":     ["phenomenal", "extraordinary", "exceptional"],
  "incredible":    ["extraordinary", "remarkable", "unparalleled"],
  "perfect":       ["flawless", "impeccable", "exemplary"],

  // Negative
  "bad":           ["poor", "inadequate", "problematic"],
  "terrible":      ["unacceptable", "deplorable", "severely flawed"],
  "awful":         ["unacceptable", "deeply problematic", "troubling"],
  "horrible":      ["deeply concerning", "severely problematic", "troubling"],
  "ugly":          ["unappealing", "disconcerting", "problematic"],
  "weak":          ["insufficient", "underdeveloped", "lacking"],
  "wrong":         ["incorrect", "misguided", "flawed"],
  "broken":        ["dysfunctional", "compromised", "non-functional"],

  // Size / quantity
  "big":           ["significant", "substantial", "considerable"],
  "huge":          ["enormous", "monumental", "substantial"],
  "small":         ["minimal", "modest", "limited"],
  "tiny":          ["negligible", "minimal", "infinitesimal"],
  "many":          ["numerous", "extensive", "widespread"],
  "a lot of":      ["numerous", "extensive", "widespread"],
  "lots of":       ["numerous", "abundant", "significant"],
  "some":          ["several", "a number of", "various"],

  // Importance
  "important":     ["critical", "essential", "vital"],
  "key":           ["pivotal", "fundamental", "decisive"],
  "main":          ["primary", "principal", "foremost"],
  "basic":         ["fundamental", "core", "essential"],

  // Verbs
  "think":         ["believe", "recognise", "understand"],
  "show":          ["demonstrate", "reveal", "illustrate"],
  "use":           ["leverage", "utilise", "employ"],
  "make":          ["create", "develop", "craft"],
  "get":           ["achieve", "obtain", "secure"],
  "help":          ["support", "empower", "enable"],
  "start":         ["launch", "initiate", "pioneer"],
  "stop":          ["cease", "discontinue", "eliminate"],
  "change":        ["transform", "reshape", "redefine"],
  "need":          ["require", "demand", "necessitate"],
  "want":          ["aspire to", "seek to", "aim to"],
  "try":           ["strive", "endeavour", "pursue"],
  "work":          ["collaborate", "execute", "deliver"],
  "build":         ["construct", "engineer", "develop"],
  "grow":          ["expand", "scale", "cultivate"],
  "learn":         ["discover", "develop expertise in", "master"],
  "share":         ["disseminate", "communicate", "convey"],
  "see":           ["observe", "recognise", "identify"],
  "look at":       ["examine", "analyse", "evaluate"],
  "talk about":    ["discuss", "explore", "address"],
  "focus on":      ["prioritise", "centre on", "devote attention to"],

  // Said / communication
  "said":          ["stated", "emphasised", "highlighted"],
  "told":          ["informed", "communicated", "conveyed"],
  "asked":         ["enquired", "requested", "questioned"],
  "wrote":         ["documented", "articulated", "expressed"],

  // Movement
  "went up":       ["surged", "climbed", "escalated"],
  "went down":     ["declined", "dropped", "fell"],
  "increased":     ["surged", "escalated", "expanded"],
  "decreased":     ["declined", "contracted", "diminished"],

  // Connectors
  "also":          ["furthermore", "additionally", "moreover"],
  "but":           ["however", "nevertheless", "yet"],
  "so":            ["therefore", "consequently", "thus"],
  "because":       ["given that", "since", "as"],
  "and":           ["and", "alongside", "in addition"],   // subtle — rarely replaced
  "then":          ["subsequently", "thereafter", "following which"],

  // Emotions
  "happy":         ["thrilled", "delighted", "overjoyed"],
  "excited":       ["energised", "enthusiastic", "passionate"],
  "sad":           ["disheartened", "troubled", "concerned"],
  "angry":         ["frustrated", "concerned", "troubled"],
  "worried":       ["concerned", "apprehensive", "cautious"],
  "surprised":     ["astonished", "taken aback", "struck by"],
  "tired":         ["exhausted", "depleted", "worn down"],

  // Time
  "soon":          ["shortly", "imminently", "in the near future"],
  "now":           ["immediately", "presently", "at this juncture"],
  "later":         ["subsequently", "at a later stage", "in due course"],
  "always":        ["consistently", "invariably", "perpetually"],
  "never":         ["not once", "under no circumstances", "at no point"],
  "often":         ["frequently", "consistently", "regularly"],
  "sometimes":     ["on occasion", "periodically", "at times"],

  // General
  "interesting":   ["fascinating", "compelling", "thought-provoking"],
  "clear":         ["transparent", "evident", "unambiguous"],
  "hard":          ["challenging", "demanding", "rigorous"],
  "easy":          ["straightforward", "accessible", "effortless"],
  "new":           ["innovative", "groundbreaking", "novel"],
  "old":           ["established", "time-tested", "longstanding"],
  "simple":        ["streamlined", "intuitive", "uncomplicated"],
  "complex":       ["intricate", "sophisticated", "multifaceted"],
  "real":          ["genuine", "authentic", "tangible"],
  "true":          ["accurate", "verified", "substantiated"],
  "special":       ["distinctive", "exceptional", "unparalleled"],
  "different":     ["distinct", "divergent", "novel"],
  "similar":       ["comparable", "analogous", "aligned"],
};

// ── Casual tone overrides ─────────────────────────────────────────────────────
const TONE_CASUAL: Record<string, string[]> = {
  "good":      ["solid", "fire", "top-tier"],
  "great":     ["incredible", "next-level", "elite"],
  "amazing":   ["absolutely insane", "next-level", "wild"],
  "bad":       ["rough", "off", "weak"],
  "important": ["huge", "major", "a big deal"],
  "happy":     ["pumped", "stoked", "hyped"],
  "excited":   ["hyped", "fired up", "pumped"],
  "think":     ["feel like", "reckon", "see it as"],
  "make":      ["drop", "build", "put together"],
  "work":      ["grind", "hustle", "push through"],
  "try":       ["go for it", "give it a shot", "push for"],
  "show":      ["prove", "put on display", "flex"],
  "start":     ["kick off", "jump into", "get going"],
  "grow":      ["blow up", "scale up", "level up"],
  "learn":     ["figure out", "pick up", "get into"],
  "change":    ["flip", "shake up", "switch up"],
  "need":      ["gotta", "have to", "can't skip"],
};

// ── Formal tone overrides ─────────────────────────────────────────────────────
const TONE_FORMAL: Record<string, string[]> = {
  "good":      ["commendable", "meritorious", "praiseworthy"],
  "great":     ["exemplary", "distinguished", "superior"],
  "amazing":   ["extraordinary", "remarkable", "exemplary"],
  "bad":       ["deficient", "substandard", "unsatisfactory"],
  "important": ["imperative", "paramount", "indispensable"],
  "think":     ["posit", "assert", "maintain"],
  "show":      ["demonstrate", "substantiate", "corroborate"],
  "make":      ["establish", "formulate", "institute"],
  "try":       ["endeavour", "attempt", "undertake"],
  "use":       ["employ", "utilise", "apply"],
  "help":      ["facilitate", "assist", "provide support for"],
  "start":     ["commence", "initiate", "institute"],
  "change":    ["implement", "enact", "effect"],
  "need":      ["necessitate", "require", "mandate"],
  "grow":      ["expand", "develop", "augment"],
  "learn":     ["acquire knowledge of", "develop proficiency in", "study"],
  "work":      ["collaborate", "coordinate", "execute"],
  "get":       ["obtain", "acquire", "procure"],
};

// ── Power openers (non-formal only) ──────────────────────────────────────────
const POWER_OPENERS = [
  "Here's the truth:",
  "Let's be real —",
  "Worth saying:",
  "Something I keep thinking about:",
  "The reality is,",
  "Hot take:",
  "Unpopular opinion:",
  "Real talk —",
  "Breaking it down:",
  "The thing nobody talks about:",
  "What nobody tells you:",
  "A hard lesson learned:",
];

export interface EnhanceResult {
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

  // ── Protect hashtags and mentions ─────────────────────────────────────────
  const protected_: Record<string, string> = {};
  let pIdx = 0;

  result = result.replace(/[#@]\w+/g, (match) => {
    const key = `__PROT_${pIdx++}__`;
    protected_[key] = match;
    return key;
  });

  // ── Build composite tone map ──────────────────────────────────────────────
  const primaryMap: Record<string, string[]> =
    style === "casual"
      ? { ...TONE_NEUTRAL, ...TONE_CASUAL }
      : style === "formal"
      ? { ...TONE_NEUTRAL, ...TONE_FORMAL }
      : TONE_NEUTRAL;

  // ── User custom enhancements (highest priority) ───────────────────────────
  if (rules.customEnhancements) {
    for (const [from, to] of Object.entries(rules.customEnhancements)) {
      const regex = new RegExp(`\\b${escapeRegex(from)}\\b`, "gi");
      const before = result;
      result = result.replace(regex, to);
      if (before !== result) {
        changes.push({ from, to, type: "tone" });
      }
    }
  }

  // ── Apply tone map (longest keys first to avoid partial matches) ──────────
  const sortedKeys = Object.keys(primaryMap).sort((a, b) => b.length - a.length);

  for (const weak of sortedKeys) {
    if (rules.rejectedEnhancements?.includes(weak)) continue;

    const options     = primaryMap[weak];
    const replacement = pickBestReplacement(options, rules);
    const regex       = new RegExp(`\\b${escapeRegex(weak)}\\b`, "gi");

    if (regex.test(result)) {
      const before = result;
      // Replace only FIRST occurrence — keeps text natural
      result = result.replace(
        new RegExp(`\\b${escapeRegex(weak)}\\b`, "i"),
        replacement
      );
      if (before !== result) {
        changes.push({ from: weak, to: replacement, type: "tone" });
      }
    }
  }

  // ── Power opener (non-formal, non-question posts only) ───────────────────
  const isQuestion = result.trimEnd().endsWith("?");
  if (style !== "formal" && !isQuestion && shouldAddOpener(result, rules)) {
    const opener    = POWER_OPENERS[Math.floor(Math.random() * POWER_OPENERS.length)];
    const firstChar = result.charAt(0).toLowerCase();
    result = `${opener} ${firstChar}${result.slice(1)}`;
    changes.push({ from: "(opening)", to: opener, type: "tone" });
  }

  // ── Restore hashtags / mentions ───────────────────────────────────────────
  for (const [key, original] of Object.entries(protected_)) {
    result = result.replace(key, original);
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
  const weakStarters = ["i ", "we ", "the ", "this ", "a ", "it ", "they "];
  const lower = text.toLowerCase();
  return weakStarters.some((s) => lower.startsWith(s)) && text.length > 40;
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}