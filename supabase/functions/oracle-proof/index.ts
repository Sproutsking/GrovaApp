// supabase/functions/oracle-proof/index.ts
// Oracle proof endpoint for XRC evidence queries.
// Returns a deterministic, signed proof bundle for external verification.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  getCorsHeaders,
  jsonResponse,
  errorResponse,
  serviceClient,
  validateEnv,
} from "../_shared/payments.ts";

const MAX_LIMIT = 100;

function decodeBase64(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  }

  const keys = Object.keys(value).sort();
  return `{${keys
    .map((key) => `${JSON.stringify(key)}:${stableStringify((value as any)[key])}`)
    .join(",")}}`;
}

async function signProof(payload: unknown): Promise<string> {
  const hmacKey = Deno.env.get("ORACLE_HMAC_KEY") ?? Deno.env.get("ORACLE_PRIVATE_KEY");
  if (!hmacKey) {
    throw new Error("Missing ORACLE_HMAC_KEY or ORACLE_PRIVATE_KEY environment variable");
  }

  const keyBytes = hmacKey.startsWith("base64:")
    ? decodeBase64(hmacKey.slice(7))
    : new TextEncoder().encode(hmacKey);

  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    keyBytes,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );

  const data = new TextEncoder().encode(stableStringify(payload));
  const signatureBuffer = await crypto.subtle.sign("HMAC", cryptoKey, data);
  return bytesToHex(new Uint8Array(signatureBuffer));
}

function parseQueryParams(req: Request) {
  const url = new URL(req.url);
  return {
    address: url.searchParams.get("address"),
    actorId: url.searchParams.get("actor_id") || url.searchParams.get("actorId"),
    event: url.searchParams.get("event"),
    streamType: url.searchParams.get("stream_type") || url.searchParams.get("streamType"),
    recordId: url.searchParams.get("record_id") || url.searchParams.get("recordId"),
    since: url.searchParams.get("since"),
    limit: Number(url.searchParams.get("limit") || "20"),
  };
}

function normalizeLimit(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 20;
  return Math.min(Math.max(Math.floor(value), 1), MAX_LIMIT);
}

function parseSince(since?: string | null): number | null {
  if (!since) return null;
  const numeric = Number(since);
  if (!Number.isNaN(numeric) && numeric > 0) return numeric;
  const parsed = Date.parse(since);
  return Number.isNaN(parsed) ? null : parsed;
}

async function fetchRecordTrace(db: ReturnType<typeof serviceClient>, recordId: string, maxDepth = 50) {
  const chain = [] as Array<Record<string, unknown>>;
  const seen = new Set<string>();
  let currentId = recordId;

  while (currentId && chain.length < maxDepth && !seen.has(currentId)) {
    seen.add(currentId);

    const { data: record, error } = await db
      .from("xrc_records")
      .select("record_id, record_hash, previous_hash, stream_type, payload, timestamp")
      .eq("record_id", currentId)
      .maybeSingle();

    if (error || !record) break;

    chain.push(record);
    const { data: parent, error: parentError } = await db
      .from("xrc_records")
      .select("record_id")
      .eq("record_hash", record.previous_hash)
      .maybeSingle();

    if (parentError || !parent || !parent.record_id) break;
    currentId = parent.record_id;
  }

  return chain.reverse();
}

serve(async (req: Request) => {
  const headers = getCorsHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers });
  }

  const envError = validateEnv([
    "SUPABASE_URL",
    "SUPABASE_SERVICE_ROLE_KEY",
    "ORACLE_HMAC_KEY",
  ]);
  if (envError) return envError;

  const db = serviceClient();

  let body: Record<string, unknown> = {};
  if (req.method === "POST") {
    try {
      body = (await req.json()) as Record<string, unknown>;
    } catch {
      return errorResponse("Invalid JSON body", 400, "INVALID_JSON", req);
    }
  }

  const queryParams = parseQueryParams(req);
  const payload = {
    address: body.address ?? queryParams.address ?? null,
    actorId: body.actor_id ?? body.actorId ?? queryParams.actorId ?? null,
    event: body.event ?? queryParams.event ?? null,
    streamType: body.stream_type ?? body.streamType ?? queryParams.streamType ?? null,
    recordId: body.record_id ?? body.recordId ?? queryParams.recordId ?? null,
    since: body.since ?? queryParams.since ?? null,
    limit: normalizeLimit(Number(body.limit ?? queryParams.limit ?? 20)),
  };

  if (!payload.recordId && !payload.actorId && !payload.address && !payload.event) {
    return errorResponse(
      "Missing required proof parameters. Provide one of recordId, actorId, address, or event.",
      400,
      "MISSING_PROOF_PARAMETERS",
      req,
    );
  }

  const query = db.from("xrc_records").select("*").order("timestamp", { ascending: true }).limit(payload.limit);

  if (payload.recordId) query.eq("record_id", String(payload.recordId));
  if (payload.actorId) query.eq("actor_id", String(payload.actorId));
  if (payload.streamType) query.eq("stream_type", String(payload.streamType));
  if (payload.event) query.contains("payload", { event: String(payload.event) });
  if (payload.address) {
    const normalizedAddress = String(payload.address);
    query.or(
      `actor_id.eq.${normalizedAddress},payload->>from_address.eq.${normalizedAddress},payload->>to_address.eq.${normalizedAddress}`,
    );
  }

  const sinceTimestamp = parseSince(payload.since as string | null);
  if (sinceTimestamp !== null) {
    query.gte("timestamp", sinceTimestamp);
  }

  const { data: records, error } = await query;
  if (error) {
    return errorResponse(
      "Failed to query proof records.",
      500,
      "QUERY_FAILED",
      req,
    );
  }

  const recordList = Array.isArray(records) ? records : [];
  const trace = payload.recordId
    ? await fetchRecordTrace(db, String(payload.recordId), 100)
    : [];

  const detailPath = recordList.map((record) => ({
    record_id: record.record_id,
    record_hash: record.record_hash,
    previous_hash: record.previous_hash,
    stream_type: record.stream_type,
    event: record.payload?.event ?? null,
    timestamp: record.timestamp,
  }));

  const rootChain = await db
    .from("xrc_root_chain")
    .select("stream_type, current_head_hash, last_record_id, record_count")
    .order("last_updated_at", { ascending: false })
    .limit(6);

  const rootHash = Array.isArray(rootChain.data) && rootChain.data.length > 0
    ? rootChain.data[0]?.current_head_hash ?? null
    : null;

  const proof = {
    query: {
      address: payload.address,
      actorId: payload.actorId,
      event: payload.event,
      streamType: payload.streamType,
      recordId: payload.recordId,
      since: payload.since,
      limit: payload.limit,
    },
    count: recordList.length,
    root_hash: rootHash,
    records: detailPath,
    trace: trace.map((record) => ({
      record_id: record.record_id,
      record_hash: record.record_hash,
      previous_hash: record.previous_hash,
      stream_type: record.stream_type,
      event: record.payload?.event ?? null,
      timestamp: record.timestamp,
    })),
    generated_at: new Date().toISOString(),
  };

  const answer = recordList.length > 0;
  let signature = null;
  try {
    signature = await signProof({ answer, proof });
  } catch (err) {
    console.error("[oracle-proof] Signature generation failed:", err);
    return errorResponse(
      "Oracle signature generation failed.",
      500,
      "SIGNATURE_ERROR",
      req,
    );
  }

  return jsonResponse(
    {
      answer,
      proof,
      signature,
      signature_type: "HMAC-SHA256",
      oracle_key_id: Deno.env.get("ORACLE_KEY_ID") ?? null,
    },
    200,
    req,
  );
});
