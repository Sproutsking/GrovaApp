// supabase/functions/enhance-post/utils/adaptiveEngine.ts
// ─────────────────────────────────────────────────────────────────────────────
// Builds personalised processing rules entirely from the history payload
// sent by the frontend. No Supabase DB call inside the edge function — keeping
// it stateless, fast, and offline-safe.
//
// History entry format: "action:from:to"
//
// Supported actions:
//   enhance:good:excellent         → prefer "excellent" when replacing "good"
//   reject_enhance:good:excellent  → never replace "good"
//   reject_shorten:just:           → preserve "just" during shortening
//   no_opener::                    → never prepend power openers
//   custom:amazing:fire            → user-defined mapping (highest priority)
//   style:casual:                  → explicit style override from user
//   phrase:keep:[phrase]           → always preserve this phrase verbatim
// ─────────────────────────────────────────────────────────────────────────────

export interface AdaptiveRules {
  userStyle:             "casual" | "formal" | "neutral";
  preservedFillers:      string[];
  rejectedEnhancements:  string[];
  acceptedReplacements:  string[];
  customEnhancements:    Record<string, string>;
  noOpeners:             boolean;
  preferredPhrases:      string[];  // phrases user tends to use → never shorten/replace
  sessionStyle:          "casual" | "formal" | "neutral" | null; // explicit override
}

const DEFAULT_RULES: AdaptiveRules = {
  userStyle:            "neutral",
  preservedFillers:     [],
  rejectedEnhancements: [],
  acceptedReplacements: [],
  customEnhancements:   {},
  noOpeners:            false,
  preferredPhrases:     [],
  sessionStyle:         null,
};

// Casual / formal signal words for inferred style detection
const CASUAL_SIGNALS = [
  "fire", "lit", "sick", "dope", "elite", "solid", "goated", "bussin",
  "lowkey", "highkey", "slap", "banger", "no cap", "fr fr", "on god",
  "pumped", "stoked", "hyped", "grind", "hustle",
];
const FORMAL_SIGNALS = [
  "exemplary", "paramount", "corroborate", "substantiate", "commendable",
  "meritorious", "praiseworthy", "indispensable", "endeavour", "utilise",
  "facilitate", "necessitate", "formulate", "procure", "augment",
];

export async function getAdaptiveRules(
  _userId:         string | undefined,
  requestStyle:    "casual" | "formal" | "neutral",
  acceptedHistory: string[]
): Promise<AdaptiveRules> {

  const rules: AdaptiveRules = {
    ...DEFAULT_RULES,
    userStyle: requestStyle,
  };

  // ── Parse history entries ─────────────────────────────────────────────────
  for (const entry of acceptedHistory) {
    const colonIdx = entry.indexOf(":");
    if (colonIdx === -1) continue;

    const action = entry.substring(0, colonIdx);
    const rest   = entry.substring(colonIdx + 1);
    const sepIdx = rest.indexOf(":");
    const from   = sepIdx !== -1 ? rest.substring(0, sepIdx) : rest;
    const to     = sepIdx !== -1 ? rest.substring(sepIdx + 1) : "";

    switch (action) {
      case "enhance":
        if (to && !rules.acceptedReplacements.includes(to)) {
          rules.acceptedReplacements.push(to);
        }
        break;

      case "reject_enhance":
        if (from && !rules.rejectedEnhancements.includes(from)) {
          rules.rejectedEnhancements.push(from);
        }
        break;

      case "reject_shorten":
        if (from && !rules.preservedFillers.includes(from)) {
          rules.preservedFillers.push(from);
        }
        break;

      case "no_opener":
        rules.noOpeners = true;
        break;

      case "custom":
        if (from && to) {
          rules.customEnhancements[from] = to;
        }
        break;

      case "style":
        // Explicit style signal — highest priority
        if (from === "casual" || from === "formal" || from === "neutral") {
          rules.sessionStyle = from;
        }
        break;

      case "phrase":
        if (to && !rules.preferredPhrases.includes(to)) {
          rules.preferredPhrases.push(to);
        }
        break;
    }
  }

  // ── Infer style from accepted vocabulary ──────────────────────────────────
  if (!rules.sessionStyle) {
    const casualScore = rules.acceptedReplacements
      .filter((w) => CASUAL_SIGNALS.includes(w.toLowerCase())).length;
    const formalScore = rules.acceptedReplacements
      .filter((w) => FORMAL_SIGNALS.includes(w.toLowerCase())).length;

    if (casualScore > formalScore + 1)      rules.userStyle = "casual";
    else if (formalScore > casualScore + 1) rules.userStyle = "formal";
    // else stays as requestStyle
  } else {
    rules.userStyle = rules.sessionStyle;
  }

  return rules;
}