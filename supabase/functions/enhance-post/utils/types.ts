// supabase/functions/enhance-post/utils/types.ts
// ─────────────────────────────────────────────────────────────────────────────
// Shared type definitions used across all edge function utils.
// This file MUST be the single source of truth for the Change interface.
// grammar.ts and shorten.ts import from here — never from "../index.ts".
// ─────────────────────────────────────────────────────────────────────────────

export interface Change {
  from:      string;
  to:        string;
  type:      "grammar" | "compression" | "enhancement" | string;
  position?: number;
  label?:    string;
}

export interface AlternatesResponse {
  original:    string;
  action:      string;
  alternates:  string[];
  analysis?:   string;
  improvement?: {
    readabilityDelta: number;
    wordCountDelta:   number;
    technique:        string;
  };
  batchIndex:  number;
}

export type ActionId =
  | "grammar"
  | "shorten"
  | "enhance"
  | "rewrite"
  | "friendly"
  | "formal"
  | "hook"
  | "engage"
  | "punch"
  | "story";