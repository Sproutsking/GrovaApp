// supabase/functions/web3-initiate-payment/index.ts
// ════════════════════════════════════════════════════════════════════════════
// WEB3 INITIATE PAYMENT — Start Automatic Wallet Payment Flow
//
// FUNCTION:
//   Creates a payment session that user's wallet will sign
//   Generates treasury address + amount for that chain
//   Estimates gas fees (EVM only)
//   Returns all info needed to request signature from wallet
//
// FLOW:
//   1. Frontend calls with wallet address + chain + amount
//   2. Function creates payment intent (idempotent)
//   3. Function creates auto payment session (for tracking)
//   4. Returns treasury address, amount, gas estimate, nonce
//   5. Frontend uses nonce + amount to request signature
//   6. Frontend calls web3-submit-payment with tx hash
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

// ── Treasury addresses by chain ──────────────────────────────────────────────
const TREASURY_ADDRESSES: Record<string, string> = {
  EVM_ethereum: Deno.env.get("TREASURY_WALLET_EVM") || "0x62438e737C597250516798F175265E0edF446616",
  EVM_polygon: Deno.env.get("TREASURY_WALLET_EVM") || "0x62438e737C597250516798F175265E0edF446616",
  EVM_base: Deno.env.get("TREASURY_WALLET_EVM") || "0x62438e737C597250516798F175265E0edF446616",
  EVM_arbitrum: Deno.env.get("TREASURY_WALLET_EVM") || "0x62438e737C597250516798F175265E0edF446616",
  EVM_optimism: Deno.env.get("TREASURY_WALLET_EVM") || "0x62438e737C597250516798F175265E0edF446616",
  SOLANA_solana: Deno.env.get("TREASURY_WALLET_SOL") || "9KjmVg5UasBxNoVn9f2BFW7n6Mnhdg8GGFF5QuCX2PpS",
  CARDANO_cardano: Deno.env.get("TREASURY_WALLET_ADA") || "addr1qy2c...example",
  TRON_tron: Deno.env.get("TREASURY_WALLET_TRON") || "TJKLXsXm2ztPP6cAZLQD1gHHCwSJqZKJUP",
};

// ── Gas estimates by chain (in USD) ──────────────────────────────────────────
const GAS_ESTIMATES: Record<string, number> = {
  ethereum: 25, // $25 average
  polygon: 0.50, // $0.50 average
  base: 0.20, // $0.20 average
  arbitrum: 0.15, // $0.15 average
  optimism: 0.10, // $0.10 average
  tron: 0.01, // $0.01 average
};

// ── Stablecoin details by chain ──────────────────────────────────────────────
const STABLECOINS: Record<string, Record<string, { address: string; decimals: number }>> = {
  ethereum: {
    USDC: { address: "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48", decimals: 6 },
    USDT: { address: "0xdac17f958d2ee523a2206206994597c13d831ec7", decimals: 6 },
  },
  polygon: {
    USDC: { address: "0x2791bca1f2de4661ed88a30c99a7a9449aa84174", decimals: 6 },
    USDT: { address: "0xc2132d05d31c914a87c6611c10748aeb04b58e8f", decimals: 6 },
  },
  base: {
    USDC: { address: "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913", decimals: 6 },
    USDT: { address: "0xfde4c96c8593536e31f229ea8f37b2ada2699bb2", decimals: 6 },
  },
  arbitrum: {
    USDC: { address: "0xaf88d065e77c8cc2239327c5edb3a432268e5831", decimals: 6 },
    USDT: { address: "0xfd086bc7cd5c481dcc9c85ebe478a1c0b69fcbb9", decimals: 6 },
  },
  optimism: {
    USDC: { address: "0x0b2c639c533813f4aa9d7837caf62653d097ff85", decimals: 6 },
    USDT: { address: "0x94b008aa00579c1307b0ef2c499ad98a8ce58e58", decimals: 6 },
  },
  solana: {
    USDC: { address: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", decimals: 6 },
    USDT: { address: "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB", decimals: 6 },
  },
  tron: {
    USDT: { address: "TR7NHqjeKQxGTCi8q282JLJQ8Led4p643T", decimals: 6 },
  },
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  // ── Parse body ─────────────────────────────────────────────────────────────
  let body: {
    userId?: string;
    walletAddress?: string;
    walletName?: string;
    chainType?: string;
    chainName?: string;
    amountUSD?: number;
    tokenSymbol?: string;
    productId?: string;
    idempotencyKey?: string;
    nonce?: string;
  };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }

  const {
    userId,
    walletAddress,
    walletName,
    chainType,
    chainName,
    amountUSD,
    tokenSymbol,
    productId,
    idempotencyKey,
    nonce,
  } = body;

  // ── Validate ─────────────────────────────────────────────────────────────
  if (!userId) return json({ error: "userId required" }, 400);
  if (!walletAddress) return json({ error: "walletAddress required" }, 400);
  if (!chainType || !chainName) return json({ error: "chainType and chainName required" }, 400);
  if (!amountUSD || amountUSD < 1) return json({ error: "amountUSD must be >= 1" }, 400);
  if (!nonce) return json({ error: "nonce required" }, 400);

  const treasuryKey = `${chainType}_${chainName}`;
  const treasuryAddress = TREASURY_ADDRESSES[treasuryKey];
  if (!treasuryAddress) {
    return json({ error: `Treasury address not configured for ${chainType}/${chainName}` }, 500);
  }

  const stablecoin = STABLECOINS[chainName.toLowerCase()]?.[tokenSymbol || "USDC"];
  if (!stablecoin) {
    return json({ error: `${tokenSymbol} not supported on ${chainName}` }, 400);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const db = createClient(supabaseUrl, supabaseKey);

  // ── Check idempotency ────────────────────────────────────────────────────
  const { data: existingIntent } = await db
    .from("payment_intents")
    .select("id")
    .eq("idempotency_key", idempotencyKey || "")
    .maybeSingle();

  const sessionId = existingIntent?.id || crypto.randomUUID();

  if (!existingIntent) {
    // ── Create payment intent ────────────────────────────────────────────
    const { error: intentError } = await db.from("payment_intents").insert({
      id: sessionId,
      user_id: userId,
      product_id: productId || "00000000-0000-0000-0000-000000000000",
      idempotency_key: idempotencyKey,
      provider: "web3",
      amount_usd: amountUSD,
      status: "created",
      metadata: {
        chainType,
        chainName,
        walletAddress,
        walletName,
        tokenSymbol,
        nonce,
      },
      expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    });

    if (intentError) {
      console.error("Intent creation failed:", intentError);
      return json({ error: "Failed to create payment intent" }, 500);
    }

    // ── Create auto payment session ──────────────────────────────────────
    const { error: sessionError } = await db.from("web3_auto_payment_sessions").insert({
      user_id: userId,
      wallet_address: walletAddress,
      wallet_name: walletName,
      chain_type: chainType,
      chain_name: chainName,
      amount_usd: amountUSD,
      amount_token: (amountUSD * Math.pow(10, stablecoin.decimals)).toString(),
      token_symbol: tokenSymbol || "USDC",
      status: "initiated",
      nonce,
      expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    });

    if (sessionError) {
      console.error("Session creation failed:", sessionError);
      return json({ error: "Failed to create payment session" }, 500);
    }
  }

  // ── Calculate gas estimate ───────────────────────────────────────────────
  const gasEstimate = GAS_ESTIMATES[chainName.toLowerCase()] || 0.50;

  return json({
    sessionId,
    nonce,
    idempotencyKey,
    treasuryAddress,
    amount: (amountUSD * Math.pow(10, stablecoin.decimals)).toFixed(0),
    amountFormatted: `${amountUSD} USD`,
    amountUSD,
    estimatedGas: gasEstimate.toFixed(2),
    estimatedFee: (amountUSD * 0.02).toFixed(2), // 2% platform fee example
    token: {
      symbol: tokenSymbol || "USDC",
      name: tokenSymbol === "USDT" ? "Tether USD" : "USD Coin",
      address: stablecoin.address,
      decimals: stablecoin.decimals,
    },
    expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
  });
});
