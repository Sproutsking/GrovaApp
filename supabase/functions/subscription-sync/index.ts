// supabase/functions/subscription-sync/index.ts
// ============================================================================
// SUBSCRIPTION SYNC — Hourly cron job (Paystack + Web3 only, no Stripe)
//
// 1. Expire stale payment_intents (> 30 min "created")
// 2. Run expire_subscriptions() DB function
// 3. Re-verify pending Web3 payments (5 min < age < 24h)
// 4. Timeout Web3 payments stuck > 24h
// ============================================================================

import { supabaseAdmin } from "../_shared/payments.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  // Guard: only our scheduler can call this
  const auth = req.headers.get("Authorization");
  if (auth !== `Bearer ${Deno.env.get("CRON_SECRET")}`) {
    console.warn("[subscription-sync] Unauthorized attempt");
    return new Response("Unauthorized", { status: 401 });
  }

  const db = supabaseAdmin();
  const results = {
    expired_intents: 0,
    subs_expired:    "ok" as string,
    web3_confirmed:  0,
    web3_timed_out:  0,
    errors:          [] as string[],
  };

  // ── 1. Expire stale intents ───────────────────────────────────────────────
  try {
    const { count } = await db
      .from("payment_intents")
      .update({ status: "expired" })
      .lt("expires_at", new Date().toISOString())
      .in("status", ["created"])
      .select("*", { count: "exact", head: true });
    results.expired_intents = count ?? 0;
  } catch (e) {
    const msg = "Expire intents: " + String(e);
    results.errors.push(msg);
    console.error("[subscription-sync]", msg);
  }

  // ── 2. Run DB expiry function ─────────────────────────────────────────────
  try {
    await db.rpc("expire_subscriptions");
  } catch (e) {
    const msg = "expire_subscriptions RPC: " + String(e);
    results.errors.push(msg);
    results.subs_expired = "failed";
    console.error("[subscription-sync]", msg);
  }

  const now           = Date.now();
  const fiveMinAgo    = new Date(now - 5  * 60 * 1000).toISOString();
  const twentyFourHAgo = new Date(now - 24 * 60 * 60 * 1000).toISOString();

  // ── 3. Timeout Web3 payments stuck > 24 hours ────────────────────────────
  try {
    const { data: timedOut } = await db
      .from("payments")
      .update({
        status:         "failed",
        failure_reason: "Transaction did not reach required confirmations within 24 hours.",
        updated_at:     new Date().toISOString(),
      })
      .eq("provider", "web3")
      .eq("status", "processing")
      .lt("created_at", twentyFourHAgo)
      .select("id");

    results.web3_timed_out = timedOut?.length ?? 0;
  } catch (e) {
    results.errors.push("Web3 timeout: " + String(e));
  }

  // ── 4. Re-verify Web3 payments in the 5min-24h window ────────────────────
  try {
    const { data: pendingWeb3 } = await db
      .from("payments")
      .select("id, provider_payment_id, wallet_address, metadata, product_id, idempotency_key")
      .eq("provider", "web3")
      .eq("status", "processing")
      .lt("created_at", fiveMinAgo)
      .gte("created_at", twentyFourHAgo)
      .limit(20);

    for (const p of pendingWeb3 ?? []) {
      try {
        const meta      = (p.metadata as Record<string, unknown>) ?? {};
        const chain     = String(meta.chain      ?? "polygon");
        const chainType = String(meta.chain_type ?? "EVM");

        const resp = await fetch(`${SUPABASE_URL}/functions/v1/web3-verify-payment`, {
          method:  "POST",
          headers: {
            "Content-Type":  "application/json",
            "Authorization": `Bearer ${SERVICE_KEY}`,
          },
          body: JSON.stringify({
            chainType,
            chain,
            txHash:              p.provider_payment_id,
            productId:           p.product_id,
            idempotencyKey:      p.idempotency_key,
            claimedSenderWallet: p.wallet_address,
          }),
        });

        const result = await resp.json();
        if (result.status === "confirmed") results.web3_confirmed++;

      } catch (e) {
        results.errors.push(`Re-verify ${p.id}: ${String(e)}`);
      }
    }
  } catch (e) {
    results.errors.push("Web3 pending query: " + String(e));
  }

  console.log("[subscription-sync] Done:", JSON.stringify(results));

  return new Response(
    JSON.stringify({ ok: true, timestamp: new Date().toISOString(), ...results }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
});