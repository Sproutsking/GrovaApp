// supabase/functions/_shared/utils.ts
// Shared helpers used by all P2P Edge Functions

import {
  createClient,
  SupabaseClient,
} from "https://esm.sh/@supabase/supabase-js@2";

export const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

export function json(data: unknown, status = 200) {
  return new Response(
    JSON.stringify(data),
    {
      status,
      headers: {
        ...CORS,
        "Content-Type": "application/json",
      },
    },
  );
}

export function err(message: string, status = 400) {
  return json(
    { error: message },
    status,
  );
}

// Service role client
// NEVER expose this to frontend code
export function serviceClient(): SupabaseClient {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    {
      auth: {
        persistSession: false,
      },
    },
  );
}

// Verify JWT and return authenticated user id
export async function getAuthUser(
  req: Request,
): Promise<string | null> {
  const authHeader = req.headers.get("authorization");

  if (!authHeader) return null;

  const token = authHeader.replace(
    "Bearer ",
    "",
  );

  const sb = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
  );

  const {
    data: { user },
    error,
  } = await sb.auth.getUser(token);

  if (error || !user) return null;

  return user.id;
}

// Rate limiter
export async function checkRateLimit(
  db: SupabaseClient,
  userId: string,
  action: string,
  limit: number,
  windowSecs: number,
): Promise<boolean> {
  const windowStart = new Date(
    Date.now() - (windowSecs * 1000),
  ).toISOString();

  const {
    data,
    error,
  } = await db
    .from("p2p_rate_limits")
    .select("count, window_start")
    .eq("user_id", userId)
    .eq("action", action)
    .single();

  if (
    error ||
    !data ||
    new Date(data.window_start) < new Date(windowStart)
  ) {
    await db
      .from("p2p_rate_limits")
      .upsert({
        user_id: userId,
        action,
        count: 1,
        window_start: new Date().toISOString(),
      });

    return true;
  }

  if (data.count >= limit) {
    return false;
  }

  await db
    .from("p2p_rate_limits")
    .update({
      count: data.count + 1,
    })
    .eq("user_id", userId)
    .eq("action", action);

  return true;
}

// Audit logs
export async function audit(
  db: SupabaseClient,
  actorId: string,
  action: string,
  details: Record<string, unknown>,
  tradeId?: string,
  offerId?: string,
) {
  await db
    .from("p2p_audit_log")
    .insert({
      actor_id: actorId,
      action,
      trade_id: tradeId,
      offer_id: offerId,
      details,
    });
}

// Notifications
export async function notify(
  db: SupabaseClient,
  userId: string,
  tradeId: string | null,
  type: string,
  title: string,
  body: string,
  metadata: Record<string, unknown> = {},
) {
  await db
    .from("p2p_notifications")
    .insert({
      user_id: userId,
      trade_id: tradeId,
      type,
      title,
      body,
      metadata,
    });
}

// Wallet asset mapping
export function walletColumn(
  asset: "XEV" | "USDT",
): string {
  return asset === "XEV"
    ? "grova_tokens"
    : "usdt_balance";
}

// Trade status transitions
const ALLOWED_TRANSITIONS: Record<
  string,
  string[]
> = {
  CREATED: [
    "ESCROW_LOCKED",
    "CANCELLED",
    "EXPIRED",
  ],

  ESCROW_LOCKED: [
    "PAYMENT_PENDING",
    "CANCELLED",
    "DISPUTED",
    "EXPIRED",
  ],

  PAYMENT_PENDING: [
    "PAYMENT_SENT",
    "CANCELLED",
    "DISPUTED",
    "EXPIRED",
  ],

  PAYMENT_SENT: [
    "COMPLETED",
    "DISPUTED",
  ],

  COMPLETED: [],

  CANCELLED: [],

  DISPUTED: [
    "COMPLETED",
    "CANCELLED",
  ],

  EXPIRED: [],
};

export function isValidTransition(
  from: string,
  to: string,
): boolean {
  return (
    ALLOWED_TRANSITIONS[from] ?? []
  ).includes(to);
}