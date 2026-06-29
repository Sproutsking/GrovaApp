// supabase/functions/web3-payment-status/index.ts
// ════════════════════════════════════════════════════════════════════════════
// WEB3 PAYMENT STATUS — Real-Time Confirmation Progress
//
// ENDPOINT:
//   GET /functions/v1/web3-payment-status?paymentId=...
//   Authorization: Bearer <jwt>
//
// RESPONSE:
//   {
//     "status": "submitted|pending|completed|failed",
//     "confirmations": 3,
//     "requiredConfirmations": 5,
//     "txHash": "0x...",
//     "message": "3/5 confirmations..."
//   }
//
// USED BY:
//   Frontend polling during payment confirmation
//   Shows user real-time progress
//   Triggers credit when finalized
//
// ════════════════════════════════════════════════════════════════════════════

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "GET") return json({ error: "Method not allowed" }, 405);

  // ── Get payment ID from query ────────────────────────────────────────────────
  const url = new URL(req.url);
  const paymentId = url.searchParams.get("paymentId");

  if (!paymentId) {
    return json({ error: "paymentId query parameter required" }, 400);
  }

  // ── Get auth ────────────────────────────────────────────────────────────────
  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) {
    return json({ error: "Unauthorized" }, 401);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const db = createClient(supabaseUrl, supabaseKey);

  const token = authHeader.slice(7);

  // ── Verify JWT and get user ─────────────────────────────────────────────────
  let userId: string;
  try {
    const { data: sessionData, error: sessionError } = await db.auth.api.getUser(token);
    if (sessionError || !sessionData?.user?.id) {
      return json({ error: "Invalid session" }, 401);
    }
    userId = sessionData.user.id;
  } catch (e) {
    return json({ error: "Auth failed" }, 401);
  }

  // ── Get payment ──────────────────────────────────────────────────────────────
  const { data: payment, error: paymentError } = await db
    .from("payments")
    .select("id,user_id,status,provider_payment_id,chain_id,block_confirmations")
    .eq("id", paymentId)
    .eq("provider", "web3")
    .maybeSingle();

  if (paymentError) {
    console.error("Payment fetch error:", paymentError);
    return json({ error: "Database error" }, 500);
  }

  if (!payment) {
    return json({ error: "Payment not found" }, 404);
  }

  // ── Verify ownership ─────────────────────────────────────────────────────────
  if (payment.user_id !== userId) {
    return json({ error: "Unauthorized" }, 403);
  }

  // ── Get pending confirmation status ──────────────────────────────────────────
  const { data: pending, error: pendingError } = await db
    .from("web3_pending_confirmations")
    .select("*")
    .eq("payment_id", paymentId)
    .maybeSingle();

  if (pendingError) {
    console.error("Pending confirmation fetch error:", pendingError);
    return json({ error: "Database error" }, 500);
  }

  // ── Get latest webhook event ─────────────────────────────────────────────────
  const { data: latestEvent, error: eventError } = await db
    .from("web3_webhook_events")
    .select("*")
    .eq("payment_id", paymentId)
    .order("received_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (eventError) {
    console.error("Event fetch error:", eventError);
  }

  // ── Build response ───────────────────────────────────────────────────────────
  const status = payment.status;
  const confirmations = pending?.current_confirmations || latestEvent?.confirmations || 0;
  const requiredConfirmations = pending?.required_confirmations || 5;
  const isFinalized = pending?.is_finalized || payment.status === "completed";

  let statusMessage = "Processing...";
  if (status === "completed") {
    statusMessage = "✓ Payment confirmed! Credits applied.";
  } else if (status === "failed") {
    statusMessage = "✗ Payment failed on-chain.";
  } else if (isFinalized) {
    statusMessage = `✓ Confirmed (${confirmations}/${requiredConfirmations} blocks)`;
  } else if (pending) {
    statusMessage = `Waiting for confirmations (${confirmations}/${requiredConfirmations})`;
  }

  return json({
    status,
    confirmations: Math.max(0, confirmations),
    requiredConfirmations,
    isFinalized,
    txHash: payment.provider_payment_id,
    message: statusMessage,
    ...(latestEvent && {
      lastEvent: {
        type: latestEvent.event_type,
        receivedAt: latestEvent.received_at,
      },
    }),
    ...(pending && {
      lastCheckedAt: pending.last_checked_at,
    }),
  });
});
