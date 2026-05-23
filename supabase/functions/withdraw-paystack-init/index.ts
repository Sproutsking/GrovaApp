// supabase/functions/withdraw-paystack-init/index.ts
// ════════════════════════════════════════════════════════════════════════════
// WITHDRAW — PAYSTACK INIT
//
// AUTHENTICATION — accepts two call patterns:
//
//   A) CLIENT CALL (primary path):
//      Called by withdrawService.js via supabase.functions.invoke()
//      immediately after queuing. The user's JWT is sent automatically.
//      Auth: standard Supabase Bearer JWT in Authorization header.
//      Ownership verified: withdrawal must belong to the authenticated user.
//
//   B) TRIGGER CALL (backup path):
//      Called by the pg_net DB trigger when a batched withdrawal is unblocked.
//      Auth: internal_key == SUPABASE_SERVICE_ROLE_KEY in request body.
//
// REQUIRED SECRETS (set once in Supabase dashboard):
//   supabase secrets set PAYSTACK_SECRET_KEY=sk_live_...
//
// DEPLOY:
//   supabase functions deploy withdraw-paystack-init
//
// FLOW:
//   1. Authenticate (JWT or internal_key)
//   2. Fetch + verify withdrawal
//   3. Optimistic lock (status → processing)
//   4. Resolve NGN rate
//   5. Create Paystack transfer recipient
//   6. Initiate Paystack transfer
//   7. Update withdrawal row
// ════════════════════════════════════════════════════════════════════════════

import { serve }       from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { supabaseAdmin, corsHeaders, validateEnv } from "../_shared/payments.ts";

const FALLBACK_NGN_RATE = 1500;
const MIN_NGN_PAYOUT    = 100;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST")   return json({ error: "Method not allowed" }, 405);

  const envErr = validateEnv([
    "SUPABASE_URL",
    "SUPABASE_SERVICE_ROLE_KEY",
    "SUPABASE_ANON_KEY",
    "PAYSTACK_SECRET_KEY",
  ]);
  if (envErr) return envErr;

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const ANON_KEY     = Deno.env.get("SUPABASE_ANON_KEY")!;
  const SERVICE_KEY  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const PAYSTACK_SK  = Deno.env.get("PAYSTACK_SECRET_KEY")!;

  // ── Parse body ─────────────────────────────────────────────────────────────
  let body: { withdrawal_id?: string; internal_key?: string };
  try { body = await req.json(); }
  catch { return json({ error: "Invalid JSON" }, 400); }

  const { withdrawal_id, internal_key } = body;
  if (!withdrawal_id) return json({ error: "withdrawal_id required" }, 400);

  // ── Authenticate ───────────────────────────────────────────────────────────
  const authHeader    = req.headers.get("Authorization") ?? "";
  const isInternalKey = internal_key === SERVICE_KEY;
  const isUserJWT     = authHeader.startsWith("Bearer ") && !isInternalKey;

  if (!isInternalKey && !isUserJWT) {
    return json({ error: "Unauthorized" }, 401);
  }

  const db = supabaseAdmin();

  // ── Verify ownership for user JWT calls ────────────────────────────────────
  // We create a client with the user's JWT and query withdrawal_queue.
  // RLS ensures users can only see their own rows. If the row is returned,
  // ownership is confirmed. No manual JWT decode needed.
  if (isUserJWT) {
    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: owned } = await userClient
      .from("withdrawal_queue")
      .select("id")
      .eq("id", withdrawal_id)
      .maybeSingle();

    if (!owned) {
      return json({ error: "Unauthorized — withdrawal not found or not yours" }, 401);
    }
  }

  // ── Fetch full withdrawal row ───────────────────────────────────────────────
  const { data: wd, error: wdErr } = await db
    .from("withdrawal_queue")
    .select("*")
    .eq("id", withdrawal_id)
    .eq("destination_type", "bank")
    .single();

  if (wdErr || !wd) {
    console.error("[ps-init] Not found:", withdrawal_id);
    return json({ error: "Withdrawal not found" }, 404);
  }

  if (!["queued", "batched"].includes(wd.status)) {
    console.log(`[ps-init] Skip — status=${wd.status}`);
    return json({ success: false, reason: `Status is ${wd.status}` });
  }

  // ── Optimistic lock ────────────────────────────────────────────────────────
  // Conditional UPDATE: only succeeds if status is still queued/batched.
  // Prevents double-initiation if the client and trigger call concurrently.
  const { count: lockCount } = await db
    .from("withdrawal_queue")
    .update({ status: "processing" })
    .eq("id", withdrawal_id)
    .in("status", ["queued", "batched"])
    .select("id", { count: "exact", head: true });

  if ((lockCount ?? 0) === 0) {
    console.log(`[ps-init] Lock failed — already claimed: ${withdrawal_id}`);
    return json({ success: false, reason: "Already being processed" });
  }

  // ── NGN rate ───────────────────────────────────────────────────────────────
  let ngnRate = Number(wd.metadata?.ngn_rate ?? 0);
  if (ngnRate < 100) {
    try {
      const { data: s } = await db.from("platform_settings")
        .select("value").eq("key", "paywall_config").maybeSingle();
      const stored = Number(s?.value?.ngn_rate ?? 0);
      if (stored >= 100) ngnRate = stored;
    } catch { /* use fallback */ }
  }
  if (ngnRate < 100) ngnRate = FALLBACK_NGN_RATE;

  // ── Amounts ────────────────────────────────────────────────────────────────
  const netEP = Number(wd.net_ep);
  const ngn   = Math.round((netEP / 100) * ngnRate);
  const kobo  = ngn * 100;

  if (ngn < MIN_NGN_PAYOUT) {
    await db.from("withdrawal_queue")
      .update({ status: "failed", error_msg: `NGN too low: ₦${ngn}` })
      .eq("id", withdrawal_id);
    return json({ error: `NGN payout too low: ₦${ngn}` }, 400);
  }

  // ── User profile ───────────────────────────────────────────────────────────
  const { data: profile } = await db.from("profiles")
    .select("full_name").eq("id", wd.user_id).maybeSingle();

  const destInfo = wd.destination_info as Record<string, string>;

  // ── Bank code ──────────────────────────────────────────────────────────────
  const bankCode = destInfo.bank_code?.trim()
    || await resolveBankCode(destInfo.bank, PAYSTACK_SK);

  // ── Create Paystack recipient ──────────────────────────────────────────────
  console.log(`[ps-init] Creating recipient for ${withdrawal_id}`);

  let recipientCode: string;
  try {
    const res  = await fetch("https://api.paystack.co/transferrecipient", {
      method: "POST",
      headers: { Authorization: `Bearer ${PAYSTACK_SK}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        type:           "nuban",
        name:           destInfo.account_name || profile?.full_name || "Account Owner",
        account_number: destInfo.account_number,
        bank_code:      bankCode,
        currency:       "NGN",
        metadata: { user_id: wd.user_id, withdrawal_id, ep_amount: wd.ep_amount },
      }),
    });
    const data = await res.json() as { status: boolean; data?: { recipient_code: string }; message?: string };
    if (!data.status || !data.data?.recipient_code)
      throw new Error(data.message || "Failed to create recipient");
    recipientCode = data.data.recipient_code;
    console.log(`[ps-init] Recipient: ${recipientCode}`);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[ps-init] Recipient failed:", msg);
    await db.from("withdrawal_queue")
      .update({ status: "failed", error_msg: `Recipient error: ${msg}` })
      .eq("id", withdrawal_id);
    return json({ error: `Recipient creation failed: ${msg}` }, 502);
  }

  // ── Initiate transfer ──────────────────────────────────────────────────────
  const transferRef = `xev_wd_${withdrawal_id.replace(/-/g, "").slice(0, 16)}_${Date.now()}`;

  try {
    const res = await fetch("https://api.paystack.co/transfer", {
      method: "POST",
      headers: { Authorization: `Bearer ${PAYSTACK_SK}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        source:    "balance",
        reason:    `Xeevia EP withdrawal — ${netEP} EP → ₦${ngn.toLocaleString()}`,
        amount:    kobo,
        recipient: recipientCode,
        reference: transferRef,
        currency:  "NGN",
      }),
    });
    const data = await res.json() as {
      status: boolean;
      data?: { transfer_code: string; status: string };
      message?: string;
    };

    if (!data.status || !data.data) throw new Error(data.message || "Transfer initiation failed");

    const psStatus  = data.data.status;
    const newStatus = psStatus === "success" ? "completed" : "processing";

    await db.from("withdrawal_queue").update({
      status:       newStatus,
      processed_at: psStatus === "success" ? new Date().toISOString() : null,
      metadata: {
        ...((wd.metadata as Record<string, unknown>) || {}),
        paystack_transfer_code: data.data.transfer_code,
        paystack_reference:     transferRef,
        recipient_code:         recipientCode,
        ngn_amount:             ngn,
        ngn_rate:               ngnRate,
        kobo,
        initiated_at:           new Date().toISOString(),
        initiated_by:           isUserJWT ? "client" : "trigger",
      },
    }).eq("id", withdrawal_id);

    console.log(`[ps-init] ✅ Transfer: ${data.data.transfer_code} status=${psStatus}`);
    return json({ success: true, transfer_code: data.data.transfer_code, status: psStatus, ngn, kobo });

  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[ps-init] Transfer failed:", msg);
    await db.from("withdrawal_queue")
      .update({ status: "failed", error_msg: `Transfer error: ${msg}` })
      .eq("id", withdrawal_id);
    return json({ error: `Transfer failed: ${msg}` }, 502);
  }
});

// ── Bank code resolution ──────────────────────────────────────────────────────
const _bankCache = new Map<string, string>();

async function resolveBankCode(bankName: string, secretKey: string): Promise<string> {
  if (!bankName?.trim()) return "";
  const normalized = bankName.trim().toLowerCase();
  if (_bankCache.has(normalized)) return _bankCache.get(normalized)!;

  if (_bankCache.size === 0) {
    try {
      const res  = await fetch("https://api.paystack.co/bank?currency=NGN&perPage=200", {
        headers: { Authorization: `Bearer ${secretKey}` },
      });
      const data = await res.json() as { data?: { name: string; code: string }[] };
      if (data.data) {
        for (const b of data.data) _bankCache.set(b.name.toLowerCase(), b.code);
      }
    } catch (e) { console.warn("[bankCode] Fetch failed:", e); }
  }

  if (_bankCache.has(normalized)) return _bankCache.get(normalized)!;

  for (const [key, code] of _bankCache.entries()) {
    if (key === normalized || key.startsWith(normalized + " ") || normalized.startsWith(key + " ")) {
      _bankCache.set(normalized, code);
      return code;
    }
  }

  console.warn(`[bankCode] No match for: "${bankName}"`);
  return "";
}