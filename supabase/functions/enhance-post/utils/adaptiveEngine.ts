// supabase/functions/enhance-post/utils/adaptiveEngine.ts

export interface AdaptiveRules {
  userStyle:             "casual" | "formal" | "neutral";
  preservedFillers:      string[];   // filler words the user wants to keep
  rejectedEnhancements:  string[];   // source words the user doesn't want replaced
  acceptedReplacements:  string[];   // replacement words the user has kept before
  customEnhancements:    Record<string, string>; // user-specific word upgrades
  noOpeners:             boolean;    // user has rejected power openers
  preferredPhrases:      string[];   // phrases user tends to use
}

const DEFAULT_RULES: AdaptiveRules = {
  userStyle:            "neutral",
  preservedFillers:     [],
  rejectedEnhancements: [],
  acceptedReplacements: [],
  customEnhancements:   {},
  noOpeners:            false,
  preferredPhrases:     [],
};

/**
 * getAdaptiveRules
 *
 * Builds personalised processing rules from the user's history.
 * No external DB call needed in the edge function — all rules are
 * derived from the acceptedHistory array sent by the frontend.
 *
 * History entry format: "action:from:to"
 * Examples:
 *   "enhance:good:excellent"        → preferred replacement
 *   "reject_enhance:good:excellent" → rejected replacement, skip this word
 *   "reject_shorten:just:"          → user wants to keep "just"
 *   "no_opener::"                   → user rejected power opener
 *   "custom:amazing:fire"           → user's own word preference
 */
export async function getAdaptiveRules(
  _userId:         string | undefined,
  userStyle:       "casual" | "formal" | "neutral",
  acceptedHistory: string[]
): Promise<AdaptiveRules> {

  const rules: AdaptiveRules = {
    ...DEFAULT_RULES,
    userStyle,
  };

  for (const entry of acceptedHistory) {
    const parts = entry.split(":");
    if (parts.length < 3) continue;

    const [action, from, to] = parts;

    switch (action) {
      case "enhance":
        // User accepted this replacement word — prefer it in future
        if (to && !rules.acceptedReplacements.includes(to)) {
          rules.acceptedReplacements.push(to);
        }
        break;

      case "reject_enhance":
        // User rejected replacing this source word — leave it alone
        if (from && !rules.rejectedEnhancements.includes(from)) {
          rules.rejectedEnhancements.push(from);
        }
        break;

      case "reject_shorten":
        // User wants to keep this filler word
        if (from && !rules.preservedFillers.includes(from)) {
          rules.preservedFillers.push(from);
        }
        break;

      case "no_opener":
        rules.noOpeners = true;
        break;

      case "custom":
        // User established their own word mapping
        if (from && to) {
          rules.customEnhancements[from] = to;
        }
        break;
    }
  }

  // Refine style inference from accepted replacement words
  const casualWords = ["fire", "elite", "solid", "sick", "lit", "dope", "pumped", "stoked"];
  const formalWords = ["exemplary", "paramount", "substantiate", "corroborate", "commendable"];

  const casualScore = rules.acceptedReplacements.filter((w) => casualWords.includes(w)).length;
  const formalScore = rules.acceptedReplacements.filter((w) => formalWords.includes(w)).length;

  if (casualScore > formalScore + 1) rules.userStyle = "casual";
  else if (formalScore > casualScore + 1) rules.userStyle = "formal";

  return rules;
}