import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { supabaseAdmin, corsHeaders, validateEnv } from "../_shared/payments.ts";

const MIN_NGN_PAYOUT = 100;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function refundUnsubmitted(
  db: ReturnType<typeof supabaseAdmin>,
  reference: string,
  reason: string,
) {
  const { data, error } = await db.rpc("settle_withdrawal_paystack_event", {
    p_paystack_reference: reference,
    p_event_type: "initiation.failed",
    p_reason: reason,
  });
  if (error || !data?.success) {
    console.error("[ps-init] Could not atomically refund failed payout initiation:", error?.message ?? data?.error);
    const { data: withdrawal, error: lookupError } = await db
      .from("withdrawal_queue")
      .select("id, metadata")
      .eq("metadata->>paystack_reference", reference)
      .maybeSingle();
    if (lookupError) {
      console.error("[ps-init] Could not find withdrawal for reconciliation:", lookupError.message);
    } else if (withdrawal) {
      await markReconciliationRequired(
        db,
        withdrawal.id,
        (withdrawal.metadata || {}) as Record<string, unknown>,
        error?.message ?? data?.error ?? "Atomic refund failed.",
      );
    }
    return false;
  }
  return true;
}

async function markReconciliationRequired(
  db: ReturnType<typeof supabaseAdmin>,
  withdrawalId: string,
  metadata: Record<string, unknown>,
  reason: string,
) {
  const { error } = await db
    .from("withdrawal_queue")
    .update({
      metadata: {
        ...metadata,
        payout_state: "reconciliation_required",
        reconciliation_reason: reason,
        reconciliation_required_at: new Date().toISOString(),
      },
    })
    .eq("id", withdrawalId)
    .eq("status", "processing")
    .eq("metadata->>payout_state", "initiating");
  if (error) console.error("[ps-init] Could not flag payout for reconciliation:", error.message);
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const envErr = validateEnv([
    "SUPABASE_URL",
    "SUPABASE_SERVICE_ROLE_KEY",
    "SUPABASE_ANON_KEY",
    "PAYSTACK_SECRET_KEY",
  ]);
  if (envErr) return envErr;

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const paystackSecret = Deno.env.get("PAYSTACK_SECRET_KEY")!;

  let body: { withdrawal_id?: string; internal_key?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }

  const withdrawalId = body.withdrawal_id;
  if (!withdrawalId) return json({ error: "withdrawal_id required" }, 400);

  const authHeader = req.headers.get("Authorization") ?? "";
  const isInternalCall = body.internal_key === serviceKey;
  const isUserCall = authHeader.startsWith("Bearer ") && !isInternalCall;
  if (!isInternalCall && !isUserCall) return json({ error: "Unauthorized" }, 401);

  const db = supabaseAdmin();
  if (isUserCall) {
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userError } = await userClient.auth.getUser();
    if (userError || !userData.user) return json({ error: "Unauthorized" }, 401);

    const { data: owned, error: ownershipError } = await userClient
      .from("withdrawal_queue")
      .select("id, user_id")
      .eq("id", withdrawalId)
      .maybeSingle();
    if (ownershipError) {
      console.error("[ps-init] Ownership check failed:", ownershipError.message);
      return json({ error: "Could not verify withdrawal ownership" }, 500);
    }
    if (!owned || owned.user_id !== userData.user.id) {
      return json({ error: "Unauthorized — withdrawal not found or not yours" }, 401);
    }
  }

  const { data: withdrawal, error: withdrawalError } = await db
    .from("withdrawal_queue")
    .select("*")
    .eq("id", withdrawalId)
    .eq("destination_type", "bank")
    .maybeSingle();
  if (withdrawalError) {
    console.error("[ps-init] Withdrawal lookup failed:", withdrawalError.message);
    return json({ error: "Could not load withdrawal" }, 500);
  }
  if (!withdrawal) return json({ error: "Withdrawal not found" }, 404);

  const originalMetadata = (withdrawal.metadata || {}) as Record<string, unknown>;
  const reference = String(originalMetadata.paystack_reference || "");
  if (originalMetadata.source !== "wallet_withdrawal" || !reference) {
    console.error("[ps-init] Refusing non-v2 or unreferenced withdrawal:", withdrawalId);
    return json({ error: "Withdrawal is not eligible for automated payout" }, 409);
  }
  if (withdrawal.status !== "processing") {
    return json({ success: false, reason: `Status is ${withdrawal.status}` });
  }
  if (originalMetadata.payout_state !== "ready") {
    if (originalMetadata.payout_state === "submitted" || originalMetadata.payout_state === "settled") {
      return json({
        success: true,
        already_started: true,
        payout_state: originalMetadata.payout_state,
        withdrawal_status: withdrawal.status,
      });
    }
    return json({
      success: false,
      error: "Payout status is being reconciled. Your balance remains reserved while we verify it.",
    });
  }

  const claimedMetadata = {
    ...originalMetadata,
    payout_state: "initiating",
    initiation_started_at: new Date().toISOString(),
  };
  const { data: claim, error: claimError } = await db
    .from("withdrawal_queue")
    .update({ metadata: claimedMetadata })
    .eq("id", withdrawalId)
    .eq("status", "processing")
    .eq("metadata->>payout_state", "ready")
    .select("id")
    .maybeSingle();
  if (claimError) {
    console.error("[ps-init] Could not claim payout initiation:", claimError.message);
    return json({ error: "Could not claim payout for processing" }, 500);
  }
  if (!claim) return json({ success: false, error: "Payout is already being processed." });

  const netEP = Number(withdrawal.net_ep);
  const epPerUsd = Number(claimedMetadata.ep_per_usd);
  const ngnRate = Number(withdrawal.ngn_rate);
  if (!Number.isFinite(netEP) || netEP <= 0 ||
      !Number.isFinite(epPerUsd) || epPerUsd <= 0 ||
      !Number.isFinite(ngnRate) || ngnRate < 100 || ngnRate > 1_000_000) {
    const reason = "The stored withdrawal quote is invalid.";
    const refunded = await refundUnsubmitted(db, reference, reason);
    return json({ error: reason, refunded }, refunded ? 400 : 500);
  }

  const ngn = Math.round((netEP / epPerUsd) * ngnRate);
  const kobo = ngn * 100;
  if (!Number.isSafeInteger(ngn) || ngn < MIN_NGN_PAYOUT || !Number.isSafeInteger(kobo)) {
    const reason = "NGN payout is below the provider minimum or outside supported limits.";
    const refunded = await refundUnsubmitted(db, reference, reason);
    return json({ error: reason, refunded }, refunded ? 400 : 500);
  }

  const destination = withdrawal.destination_info as Record<string, string>;
  const bankCode = destination.bank_code?.trim()
    || await resolveBankCode(destination.bank, paystackSecret);
  if (!bankCode) {
    const refunded = await refundUnsubmitted(db, reference, "Could not resolve the selected bank.");
    return json({ error: "Could not verify the selected bank.", refunded }, refunded ? 502 : 500);
  }

  let recipientCode: string;
  try {
    const response = await fetch("https://api.paystack.co/transferrecipient", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${paystackSecret}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        type: "nuban",
        name: destination.account_name,
        account_number: destination.account_number,
        bank_code: bankCode,
        currency: "NGN",
        metadata: { user_id: withdrawal.user_id, withdrawal_id: withdrawalId },
      }),
    });
    const result = await response.json() as {
      status: boolean;
      data?: { recipient_code: string };
      message?: string;
    };
    if (!response.ok || !result.status || !result.data?.recipient_code) {
      throw new Error(result.message || "Failed to create payout recipient");
    }
    recipientCode = result.data.recipient_code;
  } catch (e) {
    const reason = e instanceof Error ? e.message : String(e);
    console.error("[ps-init] Recipient creation failed:", reason);
    const refunded = await refundUnsubmitted(db, reference, `Recipient error: ${reason}`);
    return json({ error: "Could not create payout recipient.", refunded }, refunded ? 502 : 500);
  }

  let transferResponse: Response;
  try {
    transferResponse = await fetch("https://api.paystack.co/transfer", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${paystackSecret}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        source: "balance",
        reason: `Xeevia EP withdrawal — ${netEP} EP → ₦${ngn.toLocaleString()}`,
        amount: kobo,
        recipient: recipientCode,
        reference,
        currency: "NGN",
      }),
    });
  } catch (e) {
    const reason = e instanceof Error ? e.message : String(e);
    await markReconciliationRequired(db, withdrawalId, claimedMetadata, reason);
    console.error("[ps-init] Transfer response is uncertain; no refund issued:", reason);
    return json({
      success: false,
      error: "Payout status is being reconciled. Your balance remains reserved while we verify it.",
    });
  }

  let transfer: {
    status: boolean;
    data?: { transfer_code: string; status: string };
    message?: string;
  };
  try {
    transfer = await transferResponse.json() as typeof transfer;
  } catch (e) {
    const reason = e instanceof Error ? e.message : String(e);
    await markReconciliationRequired(db, withdrawalId, claimedMetadata, `Invalid Paystack response: ${reason}`);
    console.error("[ps-init] Transfer response could not be decoded; no refund issued:", reason);
    return json({
      success: false,
      error: "Payout status is being reconciled. Your balance remains reserved while we verify it.",
    });
  }

  if (!transferResponse.ok) {
    const reason = transfer.message || `Paystack returned HTTP ${transferResponse.status}`;
    await markReconciliationRequired(db, withdrawalId, claimedMetadata, reason);
    console.error("[ps-init] Provider response is ambiguous; no refund issued:", reason);
    return json({
      success: false,
      error: "Payout status is being reconciled. Your balance remains reserved while we verify it.",
    });
  }

  if (!transfer.status || !transfer.data?.transfer_code) {
    const reason = transfer.message || "Paystack rejected transfer initiation";
    const refunded = await refundUnsubmitted(db, reference, reason);
    return json({ error: "Payout was rejected by the provider.", refunded }, refunded ? 502 : 500);
  }

  const providerStatus = transfer.data.status;
  const submittedMetadata = {
    ...claimedMetadata,
    payout_state: "submitted",
    paystack_transfer_code: transfer.data.transfer_code,
    recipient_code: recipientCode,
    ngn_amount: ngn,
    kobo,
    initiated_at: new Date().toISOString(),
    initiated_by: isUserCall ? "client" : "internal",
  };
  const { data: saved, error: saveError } = await db
    .from("withdrawal_queue")
    .update({ metadata: submittedMetadata })
    .eq("id", withdrawalId)
    .eq("status", "processing")
    .eq("metadata->>payout_state", "initiating")
    .select("id")
    .maybeSingle();
  if (saveError) {
    console.error("[ps-init] Transfer accepted, but submission state could not be saved:", saveError.message);
    return json({ error: "Transfer accepted; awaiting status reconciliation." }, 500);
  }
  if (!saved) {
    const { data: current, error: currentError } = await db
      .from("withdrawal_queue")
      .select("status, metadata")
      .eq("id", withdrawalId)
      .maybeSingle();
    if (currentError) {
      console.error("[ps-init] Transfer accepted but withdrawal state changed unexpectedly:", currentError?.message ?? withdrawalId);
      return json({ error: "Transfer accepted; awaiting status reconciliation." }, 500);
    }
    if (current?.status === "completed" || current?.status === "failed") {
      const currentMetadata = (current.metadata || {}) as Record<string, unknown>;
      return json({
        success: true,
        withdrawal_status: current.status,
        refunded: currentMetadata.ep_refunded === true,
      });
    }
    console.error("[ps-init] Transfer accepted but withdrawal state changed unexpectedly:", withdrawalId);
    return json({ error: "Transfer accepted; awaiting status reconciliation." }, 500);
  }

  if (providerStatus === "success" || providerStatus === "failed") {
    const { data: settlement, error: settlementError } = await db.rpc("settle_withdrawal_paystack_event", {
      p_paystack_reference: reference,
      p_event_type: providerStatus === "success" ? "transfer.success" : "transfer.failed",
      p_reason: providerStatus === "failed" ? "Paystack reported a transfer failure during initiation." : null,
    });
    if (settlementError || !settlement?.success) {
      console.error("[ps-init] Immediate provider status could not be settled:", settlementError?.message ?? settlement?.error);
      return json({ error: "Transfer accepted; awaiting status reconciliation." }, 500);
    }
  }

  console.log(`[ps-init] Transfer accepted for ${withdrawalId}; status=${providerStatus}`);
  return json({
    success: true,
    transfer_code: transfer.data.transfer_code,
    provider_status: providerStatus,
    withdrawal_status: providerStatus === "success" ? "completed" : providerStatus === "failed" ? "failed" : "processing",
    refunded: providerStatus === "failed",
    ngn,
    kobo,
  });
});

const bankCache = new Map<string, string>();

async function resolveBankCode(bankName: string, secretKey: string): Promise<string> {
  if (!bankName?.trim()) return "";
  const normalized = bankName.trim().toLowerCase();
  if (bankCache.has(normalized)) return bankCache.get(normalized)!;

  if (bankCache.size === 0) {
    try {
      const response = await fetch("https://api.paystack.co/bank?currency=NGN&perPage=200", {
        headers: { Authorization: `Bearer ${secretKey}` },
      });
      const result = await response.json() as { data?: { name: string; code: string }[] };
      if (result.data) {
        for (const bank of result.data) bankCache.set(bank.name.toLowerCase(), bank.code);
      }
    } catch (e) {
      console.warn("[bankCode] Fetch failed:", e);
    }
  }

  if (bankCache.has(normalized)) return bankCache.get(normalized)!;
  for (const [name, code] of bankCache.entries()) {
    if (name === normalized || name.startsWith(`${normalized} `) || normalized.startsWith(`${name} `)) {
      bankCache.set(normalized, code);
      return code;
    }
  }
  return "";
}
