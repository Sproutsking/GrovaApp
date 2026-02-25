// supabase/functions/enhance-post/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { smartFormat }      from "./utils/format.ts";
import { shortenText }      from "./utils/shorten.ts";
import { enhanceTone }      from "./utils/enhance.ts";
import { fixGrammar }       from "./utils/grammar.ts";
import { getAdaptiveRules } from "./utils/adaptiveEngine.ts";

const CORS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

export interface Change {
  from:      string;
  to:        string;
  type:      "grammar" | "tone" | "compression" | "format";
  position?: number;
}

interface EnhanceRequest {
  text:             string;
  action:           "grammar" | "shorten" | "enhance";
  userId?:          string;
  userStyle?:       "casual" | "formal" | "neutral";
  acceptedHistory?: string[];
}

interface EnhanceResponse {
  original:     string;
  result:       string;
  action:       string;
  changes:      Change[];
  confidence:   number;
  processingMs: number;
}

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS });
  }

  if (req.method !== "POST") {
    return jsonRes({ error: "Method not allowed" }, 405);
  }

  const startMs = Date.now();

  try {
    let body: EnhanceRequest;

    try {
      body = await req.json();
    } catch {
      return jsonRes({ error: "Invalid JSON body" }, 400);
    }

    const {
      text,
      action,
      userId,
      userStyle       = "neutral",
      acceptedHistory = [],
    } = body;

    // Validate
    if (!text || typeof text !== "string" || !text.trim()) {
      return jsonRes({ error: "text is required and must be non-empty" }, 400);
    }
    if (text.length > 5000) {
      return jsonRes({ error: "text too long (max 5000 chars)" }, 400);
    }
    if (!["grammar", "shorten", "enhance"].includes(action)) {
      return jsonRes({ error: "action must be: grammar | shorten | enhance" }, 400);
    }

    // Build personalised adaptive rules
    const adaptiveRules = await getAdaptiveRules(userId, userStyle, acceptedHistory);

    // Step 1: Always smart-format first
    const changes: Change[] = [];
    const formatted = smartFormat(text);

    if (formatted !== text) {
      changes.push({
        from: text.substring(0, 60),
        to:   formatted.substring(0, 60),
        type: "format",
      });
    }

    let result = formatted;

    // Step 2: Action-specific processing
    switch (action) {
      case "shorten": {
        const { text: shortened, changes: sc } = shortenText(formatted, adaptiveRules);
        result = shortened;
        changes.push(...sc);
        break;
      }
      case "enhance": {
        const { text: enhanced, changes: ec } = enhanceTone(formatted, adaptiveRules, userStyle);
        result = enhanced;
        changes.push(...ec);
        break;
      }
      case "grammar": {
        const { text: corrected, changes: gc } = await fixGrammar(formatted);
        result = corrected;
        changes.push(...gc);
        break;
      }
    }

    const response: EnhanceResponse = {
      original:     text,
      result,
      action,
      changes,
      confidence:   computeConfidence(text, result, changes),
      processingMs: Date.now() - startMs,
    };

    return jsonRes(response, 200);
  } catch (err) {
    console.error("enhance-post unhandled error:", err);
    return jsonRes({ error: "Internal processing error", detail: String(err) }, 500);
  }
});

function computeConfidence(original: string, result: string, changes: Change[]): number {
  if (original === result) return 0;
  const changeRatio = Math.abs(original.length - result.length) / Math.max(original.length, 1);
  const score = Math.min(changes.length * 0.15 + changeRatio * 0.6, 1);
  return Math.round(score * 100) / 100;
}

function jsonRes(data: unknown, status: number): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}