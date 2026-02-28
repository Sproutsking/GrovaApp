// supabase/functions/enhance-post/index.ts
// ─────────────────────────────────────────────────────────────────────────────
// FIXES in this version:
//   1. Exports the Change interface so grammar.ts / shorten.ts can import it
//      (they now import from ./utils/types.ts instead — even cleaner)
//   2. Uses req.text() + JSON.parse() instead of req.json() — far more robust
//      against missing / incorrect Content-Type headers from supabase-js
//   3. Updated model string to "claude-sonnet-4-6" (current valid model)
//   4. 10 actions (6 original + hook / engage / punch / story)
//   5. Ultra-smart prompts that force analysis before generation
//   6. Returns improvement metadata so the frontend can show deltas
// ─────────────────────────────────────────────────────────────────────────────

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

export interface Change {
  from:      string;
  to:        string;
  type:      "grammar" | "compression" | "enhancement" | string;
  position?: number;
}

const CORS_HEADERS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const VALID_ACTIONS = [
  "grammar", "shorten", "enhance", "rewrite",
  "friendly", "formal", "hook", "engage", "punch", "story",
];

const ALTERNATES_COUNT = 3;

// ─── ULTRA-SMART PROMPTS ──────────────────────────────────────────────────────
// Each prompt forces the model to analyse first, then generate diverse versions.
// This is the core intelligence upgrade.
// ─────────────────────────────────────────────────────────────────────────────

function buildPrompt(
  actionId: string,
  text: string,
  userStyle: string,
  batchIndex: number,
): string {
  const diversityNote = batchIndex === 0 ? "" :
    batchIndex === 1 ? "\n\nIMPORTANT: These must be COMPLETELY different from any earlier batch — different sentence structures, different openers, different vocabulary." :
    `\n\nIMPORTANT: Batch ${batchIndex + 1}. Take bold creative risks. Surprise the reader with unexpected angles, formats, or emotional registers.`;

  const styleNote = userStyle && userStyle !== "neutral"
    ? `\nAuthor's preferred style: ${userStyle} — honour this in all versions.\n` : "";

  const FORMAT = `\nFormat your response EXACTLY like this (no other text before VERSION_1):
VERSION_1:
[complete version 1]

VERSION_2:
[complete version 2]

VERSION_3:
[complete version 3]`;

  const prompts: Record<string, string> = {

    // ── GRAMMAR ───────────────────────────────────────────────────────────────
    grammar: `You are a meticulous editor with deep expertise in English grammar.

Your task: Fix EVERY grammar, spelling, punctuation, and capitalization error.

Rules (non-negotiable):
• Fix ALL errors — typos, wrong words, missing apostrophes, tense errors, subject-verb disagreement
• Preserve the author's EXACT voice, meaning, and structure
• Do NOT rephrase, improve, or change correct words
• Each of the 3 versions should make the same corrections (grammar has one correct answer)
  — but Version 2 may fix one stylistic ambiguity one way, Version 3 another way, if applicable

TEXT TO FIX:
${text}
${styleNote}${diversityNote}${FORMAT}`,

    // ── SHORTEN ───────────────────────────────────────────────────────────────
    shorten: `You are a ruthless editor who cuts without mercy. Every word must earn its place.

Your task: Make this text 25-40% shorter while preserving ALL important meaning.

Cutting tactics to apply:
• Eliminate filler adverbs (very, really, just, basically, literally)
• Replace verbose phrases ("due to the fact that" → "because")
• Remove redundant qualifiers ("absolutely essential" → "essential")
• Delete padding openers/closers
• Prefer active over passive voice
• Merge short consecutive sentences where natural

Generate 3 versions at different cut levels:
— Version 1: Smart trim (25% shorter, most natural-sounding)
— Version 2: Aggressive cut (35% shorter, maximum clarity)
— Version 3: Ruthless minimum (40% shorter, only the core)

TEXT:
${text}
${styleNote}${diversityNote}${FORMAT}`,

    // ── ENHANCE ───────────────────────────────────────────────────────────────
    enhance: `You are a world-class copywriter who has written content for Nike, Apple, and the most-shared posts on LinkedIn, Instagram, and X.

Your task: Transform this text from ordinary to exceptional.

STEP 1 — Analyse quickly (internal, do not output):
• What is the core message?
• What's weak: [vague words / passive voice / weak opener / no hook / flat ending]?
• What emotion should this trigger?

STEP 2 — Generate 3 versions, each using a DIFFERENT primary technique:

VERSION 1 — Lead with EMOTION: Make the reader feel something visceral in the first line.
VERSION 2 — Lead with VALUE: Crystal-clear "here's what you get/learn" promise upfront.
VERSION 3 — Lead with INTRIGUE: Open a curiosity gap they MUST close by reading on.

For ALL versions apply:
• Replace ALL weak verbs (is, was, has) with strong action verbs
• Replace ALL vague words (good, nice, thing, stuff) with specific, vivid language
• Use POWER WORDS: transform, ignite, shatter, master, breakthrough, forge, unlock
• Mix short punchy sentences with longer ones for rhythm
• End memorably — a call-to-action, a question, or an insight that lingers

TEXT:
${text}
${styleNote}${diversityNote}${FORMAT}`,

    // ── REWRITE ───────────────────────────────────────────────────────────────
    rewrite: `You are a creative writer with a gift for finding fresh angles on familiar ideas.

Your task: Completely rewrite this text with the same core meaning but entirely different:
• Words (zero carry-over phrases except unavoidable nouns)
• Sentence structure (different lengths, different rhythms)
• Opening approach (each version must start differently)
• Perspective or framing (shift the angle, not the message)

The 3 versions should feel like they were written by three different talented people.
All must convey the EXACT same core message.

TEXT:
${text}
${styleNote}${diversityNote}${FORMAT}`,

    // ── FRIENDLY ──────────────────────────────────────────────────────────────
    friendly: `You are a warm, emotionally intelligent communicator who makes everyone feel seen and valued.

Your task: Rewrite this to feel warm, human, and genuinely friendly.

Techniques:
• Use "you" and "we" — speak directly to the reader
• Add personal warmth ("I've been thinking about this a lot...")
• Replace corporate/stiff language with natural spoken-word phrasing
• Use contractions (don't, I'm, we're, you'll)
• Where appropriate, share a small vulnerability or moment of honesty
• Keep it intelligent — warm does NOT mean simple

3 versions at different warmth levels:
— Version 1: Warm professional (the best LinkedIn comment energy)
— Version 2: Genuine friend (like texting someone you trust)
— Version 3: Deeply human (vulnerable, personal, real)

TEXT:
${text}
${styleNote}${diversityNote}${FORMAT}`,

    // ── FORMAL ────────────────────────────────────────────────────────────────
    formal: `You are a senior communications professional who writes for C-suite executives and prestigious publications.

Your task: Rewrite this in a formal, polished, authoritative style.

Standards:
• Precise, professional vocabulary — eliminate slang, contractions, colloquialisms
• Sophisticated sentence structures that convey depth and credibility
• Active voice where possible; passive only when appropriate for formality
• No hedging language ("sort of", "kind of", "maybe")
• Authority without arrogance — confident and clear

3 versions with different formal registers:
— Version 1: Business formal (executive communication style)
— Version 2: Academic formal (analytical, precise, structured)
— Version 3: Editorial formal (opinion-piece quality, persuasive)

TEXT:
${text}
${styleNote}${diversityNote}${FORMAT}`,

    // ── HOOK ──────────────────────────────────────────────────────────────────
    hook: `You are the world's best opening-line writer. Your hooks stop scrolling dead.

Your task: Rewrite this entire post, but lead with an IRRESISTIBLE hook.

Study the text's core message, then choose the right hook formula for each version:

HOOK ARSENAL (pick a different one for each version):
• "Nobody talks about [uncomfortable truth that relates to the topic]…"
• "[Specific number] [bold claim about the topic]:"
• "I [did something for X days/years] and discovered [surprising result]."
• "Stop [common wrong thing]. Start [better thing that relates to the text]."
• "The reason [most people fail at / struggle with the topic] isn't what you think."
• "If you've ever [relatable struggle related to the topic], this is for you."
• "[Hot take / controversial opinion about the topic]."
• "What I wish I knew about [topic] before [relevant milestone]:"

After the hook, rewrite the full post so it flows naturally from it.
Format for social media: use line breaks for rhythm and readability.

TEXT:
${text}
${styleNote}${diversityNote}${FORMAT}`,

    // ── ENGAGE ────────────────────────────────────────────────────────────────
    engage: `You are a social media engagement expert. You understand the psychology of why people comment, share, and save.

Your task: Rewrite this post to MAXIMIZE engagement (comments, saves, shares).

ENGAGEMENT TACTICS (apply a different cluster per version):

Version 1 — COMMENT MAGNET:
• End with a genuine question that has no obvious answer
• Use "you" language — make it about the reader
• Include a relatable struggle before the insight
• Create a sense of community ("We've all been there…")

Version 2 — SHARE TRIGGER:
• Make it feel like information people will want to pass on
• Use a bold claim or surprising insight people will want to share
• Frame it as something useful to people they know
• "Tag someone who…" or similar community activation

Version 3 — SAVE WORTHY:
• Structure it as a mini-guide or list of insights
• Use short paragraphs for skimmability
• Lead with value so clearly readers save it for later
• Include a specific, actionable takeaway

Format ALL versions with social-media line breaks (mobile-first readability).

TEXT:
${text}
${styleNote}${diversityNote}${FORMAT}`,

    // ── PUNCH ─────────────────────────────────────────────────────────────────
    punch: `You are a master of tight, punchy writing. You write like the best TED talks sound — clear, direct, unforgettable.

Your task: Make this punch harder. Cut everything soft. Make every word hit.

POWER TECHNIQUES:
• CUT ruthlessly — if a word doesn't add meaning, it's gone
• ACTIVATE — kill every passive construction, replace with strong active verbs
• LEAD with your strongest point, not your weakest
• SHORT sentences create impact. Use them.
• BOLD claims — no hedging, no "maybe", no "kind of"
• End with a line that lands like a closing argument

Target: 30-45% shorter but 300% more impactful.

3 versions at different intensity levels:
— Version 1: Punchy (tighter, stronger, cleaner)
— Version 2: Sharp (maximum clarity, zero fat)
— Version 3: Surgical (bare minimum words, maximum meaning)

TEXT:
${text}
${styleNote}${diversityNote}${FORMAT}`,

    // ── STORY ─────────────────────────────────────────────────────────────────
    story: `You are a master storyteller. You know that humans are wired for narrative — stories bypass skepticism and create genuine emotional connection.

Your task: Transform this into a compelling micro-story.

STORY ARCHITECTURE:
1. SCENE/HOOK: Drop the reader into a relatable moment (1-2 sentences)
2. TENSION: What was the struggle, fear, or challenge? (1-2 sentences)
3. TURN: The moment of insight, change, or decision (1-2 sentences)
4. RESOLUTION: What changed or what was learned? (1-2 sentences)
5. UNIVERSAL TRUTH: The lesson that applies to the reader's life (1 sentence)

3 versions using different narrative angles:
— Version 1: First-person journey ("I remember when…")
— Version 2: Second-person immersion ("Imagine you're…" / "You've probably been there…")
— Version 3: Third-person parable (a character whose story teaches the lesson)

Format for social media: paragraph breaks between each story beat.
Keep the author's authentic voice and core message throughout.

TEXT:
${text}
${styleNote}${diversityNote}${FORMAT}`,
  };

  return prompts[actionId] || prompts.enhance;
}

// ─── Parse "VERSION_N:\n..." blocks ──────────────────────────────────────────
function parseVersions(raw: string, originalText: string): string[] {
  const versions: string[] = [];
  const blocks = raw.split(/VERSION_\d+:/);
  for (let i = 1; i < blocks.length; i++) {
    const clean = blocks[i].trim();
    if (clean && clean !== originalText.trim()) {
      versions.push(clean);
    }
  }
  if (versions.length === 0 && raw.trim() && raw.trim() !== originalText.trim()) {
    return [raw.trim()];
  }
  return versions.slice(0, ALTERNATES_COUNT);
}

// ─── Compute simple improvement metadata (word count delta) ───────────────────
function computeImprovement(original: string, improved: string, action: string) {
  const origWords = original.trim().split(/\s+/).length;
  const newWords  = improved.trim().split(/\s+/).length;
  return {
    wordCountDelta:   newWords - origWords,
    readabilityDelta: 0, // client computes this
    technique: action,
  };
}

// ─── Main handler ─────────────────────────────────────────────────────────────
serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS_HEADERS });
  }
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
  if (!ANTHROPIC_API_KEY) {
    console.error("ANTHROPIC_API_KEY secret not set");
    return jsonResponse(
      { error: "Server misconfiguration: ANTHROPIC_API_KEY not set. Run: supabase secrets set ANTHROPIC_API_KEY=sk-ant-..." },
      500,
    );
  }

  try {
    // ── ROBUST body parsing: req.text() + JSON.parse fixes Content-Type issues ─
    let rawBody: string;
    try {
      rawBody = await req.text();
    } catch {
      return jsonResponse({ error: "Could not read request body" }, 400);
    }

    if (!rawBody || !rawBody.trim()) {
      return jsonResponse({ error: "Empty request body" }, 400);
    }

    let body: {
      text:            string;
      action:          string;
      userStyle?:      string;
      batchIndex?:     number;
      acceptedHistory?: string[];
    };

    try {
      body = JSON.parse(rawBody);
    } catch {
      return jsonResponse({ error: "Invalid JSON body. Received: " + rawBody.substring(0, 100) }, 400);
    }

    const {
      text,
      action,
      userStyle  = "neutral",
      batchIndex = 0,
    } = body;

    // Validate
    if (!text || typeof text !== "string" || !text.trim()) {
      return jsonResponse({ error: "text is required and must be non-empty" }, 400);
    }
    if (text.length > 10000) {
      return jsonResponse({ error: "text too long (max 10,000 chars)" }, 400);
    }
    if (!action || !VALID_ACTIONS.includes(action)) {
      return jsonResponse({
        error: `action must be one of: ${VALID_ACTIONS.join(" | ")}`,
      }, 400);
    }

    const prompt = buildPrompt(action, text, userStyle, batchIndex);

    // ── Call Anthropic API ─────────────────────────────────────────────────
    const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type":      "application/json",
        "x-api-key":         ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model:      "claude-sonnet-4-6",        // ← FIXED: valid current model
        max_tokens: 2000,
        messages:   [{ role: "user", content: prompt }],
      }),
    });

    if (!anthropicRes.ok) {
      const errBody = await anthropicRes.text().catch(() => "");
      console.error("Anthropic API error:", anthropicRes.status, errBody);
      return jsonResponse(
        { error: `Anthropic API error: ${anthropicRes.status}`, detail: errBody },
        502,
      );
    }

    const anthropicData = await anthropicRes.json();
    const rawText = anthropicData.content
      ?.map((b: { type: string; text?: string }) => b.text || "")
      .join("") || "";

    const alternates = parseVersions(rawText, text);

    if (alternates.length === 0) {
      return jsonResponse({ error: "No valid alternates generated — try different text" }, 422);
    }

    const improvement = computeImprovement(text, alternates[0], action);

    return jsonResponse({
      original:    text,
      action,
      alternates,
      improvement,
      batchIndex,
    }, 200);

  } catch (err) {
    console.error("enhance-post unhandled error:", err);
    return jsonResponse({ error: "Internal error", detail: String(err) }, 500);
  }
});

function jsonResponse(data: unknown, status: number): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}