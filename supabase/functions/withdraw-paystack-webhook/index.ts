import { supabaseAdmin, corsHeaders, validateEnv } from "../_shared/payments.ts";

function acknowledge() {
  return new Response("ok", { status: 200 });
}

function constantTimeEqual(left: string, right: string) {
  if (left.length !== right.length) return false;
  let mismatch = 0;
  for (let i = 0; i < left.length; i += 1) {
    mismatch |= left.charCodeAt(i) ^ right.charCodeAt(i);
  }
  return mismatch === 0;
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  const envError = validateEnv([
    "SUPABASE_URL",
    "SUPABASE_SERVICE_ROLE_KEY",
    "PAYSTACK_SECRET_KEY",
  ]);
  if (envError) return new Response("Webhook temporarily unavailable", { status: 500 });

  const secret = Deno.env.get("PAYSTACK_SECRET_KEY")!;
  let rawBody: string;
  try {
    rawBody = await req.text();
  } catch (e) {
    console.error("[wd-ps-wh] Could not read request body:", e);
    return new Response("Could not read event", { status: 400 });
  }

  const signature = req.headers.get("x-paystack-signature") ?? "";
  if (!signature) return new Response("Missing signature", { status: 401 });

  try {
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(secret),
      { name: "HMAC", hash: "SHA-512" },
      false,
      ["sign"],
    );
    const digest = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(rawBody));
    const expected = Array.from(new Uint8Array(digest))
      .map(byte => byte.toString(16).padStart(2, "0"))
      .join("");
    if (!constantTimeEqual(expected, signature.toLowerCase())) {
      console.error("[wd-ps-wh] Signature mismatch.");
      return new Response("Invalid signature", { status: 401 });
    }
  } catch (e) {
    console.error("[wd-ps-wh] Signature verification failed:", e);
    return new Response("Signature verification failed", { status: 500 });
  }

  let event: Record<string, unknown>;
  try {
    event = JSON.parse(rawBody);
  } catch (e) {
    console.error("[wd-ps-wh] Invalid JSON event:", e);
    return acknowledge();
  }

  const eventType = String(event.event ?? "");
  if (!["transfer.success", "transfer.failed", "transfer.reversed"].includes(eventType)) {
    return acknowledge();
  }
  const eventData = (event.data ?? {}) as Record<string, unknown>;
  const reference = String(eventData.reference ?? "");
  if (!reference) {
    console.error("[wd-ps-wh] Transfer event did not contain a reference.");
    return acknowledge();
  }

  const db = supabaseAdmin();
  const { data: rows, error: lookupError } = await db
    .from("withdrawal_queue")
    .select("id, metadata")
    .eq("metadata->>paystack_reference", reference)
    .limit(1);
  if (lookupError) {
    console.error("[wd-ps-wh] Withdrawal lookup failed:", lookupError.message);
    return new Response("Could not load withdrawal", { status: 500 });
  }

  const withdrawal = rows?.[0];
  if (!withdrawal) {
    console.warn(`[wd-ps-wh] No withdrawal found for reference ${reference}; acknowledging unrelated transfer.`);
    return acknowledge();
  }
  const metadata = (withdrawal.metadata || {}) as Record<string, unknown>;
  if (metadata.source !== "wallet_withdrawal") {
    console.error(`[wd-ps-wh] Legacy withdrawal ${withdrawal.id} needs manual reconciliation.`);
    return acknowledge();
  }

  const reason = String(eventData.reason ?? eventData.gateway_response ?? eventType);
  const { data: settlement, error: settlementError } = await db.rpc("settle_withdrawal_paystack_event", {
    p_paystack_reference: reference,
    p_event_type: eventType,
    p_reason: reason,
  });
  if (settlementError || !settlement?.success) {
    console.error("[wd-ps-wh] Atomic settlement failed:", settlementError?.message ?? settlement?.error);
    return new Response("Settlement failed; retry required", { status: 500 });
  }

  const eventId = `wd_transfer_${eventType}_${reference}`;
  const { error: logError } = await db.from("webhook_events").upsert({
    provider: "paystack",
    event_id: eventId,
    event_type: eventType,
    payload: event,
    verified: true,
    processed: true,
    processed_at: new Date().toISOString(),
    idempotency_key: eventId,
  }, { onConflict: "event_id" });
  if (logError) console.error("[wd-ps-wh] Could not record webhook event:", logError.message);

  console.log(`[wd-ps-wh] ${eventType} settled for withdrawal ${withdrawal.id}.`);
  return acknowledge();
});
