// supabase/functions/web3-poll-pending/index.ts
// ════════════════════════════════════════════════════════════════════════════
// WEB3 POLL PENDING — Scheduled Job to Check Pending Confirmations
//
// TRIGGER: cron schedule (every 30 seconds)
// supabase functions secrets set CRON_SECRET=<any-secret>
// Edit function.json: { "cron": "*/30 * * * * *" }
//
// PURPOSE:
//   Periodically check all pending confirmations
//   Query RPC to get block numbers
//   Update confirmation counts
//   Finalize when ready
//
// ADVANTAGES:
//   Works without external webhook
//   Catches missed confirmations
//   Fallback if push webhooks fail
//
// ════════════════════════════════════════════════════════════════════════════

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function rpcCall(rpcUrl: string, method: string, params: unknown[]) {
  const res = await fetch(rpcUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  if (!res.ok) throw new Error(`RPC HTTP ${res.status}`);
  const data = await res.json() as { result?: unknown; error?: { message: string } };
  if (data.error) throw new Error(`RPC error: ${data.error.message}`);
  return data.result;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  // Verify cron secret
  const cronsecret = req.headers.get("x-cron-secret");
  if (cronsecret !== Deno.env.get("CRON_SECRET")) {
    return json({ error: "Unauthorized" }, 401);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const db = createClient(supabaseUrl, supabaseKey);

  try {
    // ── Get all pending, non-finalized confirmations ──────────────────────────
    const { data: pendingList, error: listError } = await db
      .from("web3_pending_confirmations")
      .select("*")
      .eq("is_finalized", false)
      .lt("expires_at", new Date().toISOString()); // Not yet expired

    if (listError) {
      console.error("List pending error:", listError);
      return json({ error: "Database error" }, 500);
    }

    if (!pendingList || pendingList.length === 0) {
      return json({ checked: 0, updated: 0, finalized: 0 });
    }

    let updated = 0;
    let finalized = 0;
    const rpcCache: Record<string, string> = {};

    // ── Check each pending transaction ───────────────────────────────────────
    for (const pending of pendingList) {
      try {
        if (pending.chain_type !== "EVM") {
          // Solana and other chains have different verification
          console.log(`Skipping ${pending.chain_type} chain: ${pending.tx_hash}`);
          continue;
        }

        // Get RPC URL
        const rpcKey = `${pending.chain_name.toUpperCase()}_RPC_URL`;
        const rpcUrl = Deno.env.get(rpcKey);
        if (!rpcUrl) {
          console.warn(`No RPC URL for ${pending.chain_name}`);
          continue;
        }

        // Get or cache latest block number
        let latestBlockNum: number;
        if (!rpcCache[pending.chain_name]) {
          const latestBlock = await rpcCall(rpcUrl, "eth_blockNumber", []);
          rpcCache[pending.chain_name] = latestBlock as string;
        }
        latestBlockNum = parseInt(rpcCache[pending.chain_name], 16);

        // Get transaction receipt
        const receipt = await rpcCall(rpcUrl, "eth_getTransactionReceipt", [pending.tx_hash]);

        if (!receipt) {
          console.log(`TX ${pending.tx_hash} not yet mined`);
          continue;
        }

        const txBlockNum = parseInt((receipt as any).blockNumber, 16);
        const confirmations = Math.max(0, latestBlockNum - txBlockNum + 1);

        // Update confirmation count
        const { error: updateError } = await db
          .from("web3_pending_confirmations")
          .update({
            current_confirmations: confirmations,
            last_checked_at: new Date().toISOString(),
            ...(confirmations >= pending.required_confirmations && {
              is_finalized: true,
              finalized_at: new Date().toISOString(),
            }),
          })
          .eq("payment_id", pending.payment_id);

        if (updateError) {
          console.error(`Update error for ${pending.payment_id}:`, updateError);
          continue;
        }

        updated++;

        // If just finalized, trigger webhook listener
        if (confirmations >= pending.required_confirmations && !pending.is_finalized) {
          finalized++;
          console.log(`Finalized: ${pending.payment_id} (${confirmations} confirmations)`);

          // Call webhook listener to credit user
          const webhookUrl = Deno.env.get("SUPABASE_URL")! + "/functions/v1/web3-webhook-listener";
          const webhookRes = await fetch(webhookUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              txHash: pending.tx_hash,
              chainType: pending.chain_type,
              chainName: pending.chain_name,
              confirmations,
              blockNumber: txBlockNum,
              eventType: "confirmed",
              fromWebhook: false,
            }),
          });

          if (!webhookRes.ok) {
            console.error(`Webhook call failed: ${webhookRes.status}`);
          }
        }
      } catch (e) {
        console.error(`Error checking ${pending.payment_id}:`, (e as Error).message);
        // Continue to next pending
      }
    }

    return json({
      success: true,
      checked: pendingList.length,
      updated,
      finalized,
    });
  } catch (e) {
    console.error("Poll error:", (e as Error).message);
    return json({ error: (e as Error).message }, 500);
  }
});
