import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { parseAddress, toHex, verifyCip8Signature } from "./verification.ts";

const encoder = new TextEncoder();
const MAX_CHALLENGE_AGE_MS = 5 * 60 * 1000;
const RATE_WINDOW_MS = 15 * 60 * 1000;
const MAX_CHALLENGES_PER_ADDRESS = 5;
const IP_RATE_WINDOW_MS = 5 * 60 * 1000;
const MAX_CHALLENGES_PER_IP = 30;

type WalletAuthBody = {
  action?: string;
  address?: string;
  challengeId?: string;
  signature?: string;
  key?: string;
};

function response(req: Request, body: unknown, status = 200): Response {
  const origin = req.headers.get("origin") || "";
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Headers":
        "authorization, x-client-info, apikey, content-type",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Content-Type": "application/json",
      "Vary": "Origin",
    },
  });
}

function allowedOrigins(): Set<string> {
  return new Set(
    (Deno.env.get("WEB3_AUTH_ALLOWED_ORIGINS") || "")
      .split(",")
      .map((origin) => origin.trim().replace(/\/+$/, ""))
      .filter(Boolean),
  );
}

async function hashServerValue(
  value: string,
  purpose: string,
): Promise<string> {
  const secret = Deno.env.get("CARDANO_AUTH_EMAIL_SECRET") || "";
  if (secret.length < 32) {
    throw new Error("Cardano auth is not configured.");
  }
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const digest = new Uint8Array(
    await crypto.subtle.sign(
      "HMAC",
      key,
      encoder.encode(`${purpose}:${value}`),
    ),
  );
  return toHex(digest);
}

async function getSyntheticEmail(addressHex: string): Promise<string> {
  const addressHash = await hashServerValue(addressHex, "cardano-address");
  return `cardano_${addressHash}@users.xeevia.local`;
}

function getAdminClient() {
  const url = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceRoleKey) {
    throw new Error("Cardano auth is not configured.");
  }
  return createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

async function createChallenge(
  req: Request,
  body: WalletAuthBody,
  admin: ReturnType<typeof getAdminClient>,
): Promise<Response> {
  if (!body.address) {
    return response(req, { error: "Cardano address is required." }, 400);
  }

  let parsedAddress;
  try {
    parsedAddress = parseAddress(body.address);
  } catch (error) {
    return response(req, {
      error: error instanceof Error
        ? error.message
        : "Invalid Cardano address.",
    }, 400);
  }

  const now = Date.now();
  const since = new Date(now - RATE_WINDOW_MS).toISOString();
  const ipSince = new Date(now - IP_RATE_WINDOW_MS).toISOString();
  const clientIp = req.headers.get("cf-connecting-ip") ||
    req.headers.get("x-real-ip") ||
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown";
  const ipHash = await hashServerValue(clientIp, "cardano-auth-ip");
  const { error: cleanupError } = await admin
    .from("cardano_auth_challenges")
    .delete()
    .lt("expires_at", new Date(now - 24 * 60 * 60 * 1000).toISOString());
  if (cleanupError) throw cleanupError;

  const { count, error: countError } = await admin
    .from("cardano_auth_challenges")
    .select("id", { count: "exact", head: true })
    .eq("address_hex", parsedAddress.addressHex)
    .gte("created_at", since);
  if (countError) throw countError;
  if ((count || 0) >= MAX_CHALLENGES_PER_ADDRESS) {
    return response(req, {
      error: "Too many Cardano sign-in attempts. Please wait and try again.",
    }, 429);
  }

  const { count: ipCount, error: ipCountError } = await admin
    .from("cardano_auth_challenges")
    .select("id", { count: "exact", head: true })
    .eq("ip_hash", ipHash)
    .gte("created_at", ipSince);
  if (ipCountError) throw ipCountError;
  if ((ipCount || 0) >= MAX_CHALLENGES_PER_IP) {
    return response(req, {
      error:
        "Too many Cardano sign-in attempts from this network. Please wait and try again.",
    }, 429);
  }

  const issuedAt = new Date(now).toISOString();
  const expiresAt = new Date(now + MAX_CHALLENGE_AGE_MS).toISOString();
  const nonce = crypto.randomUUID().replaceAll("-", "");
  const origin = new URL(req.headers.get("origin")!).origin;
  const uri = `${origin}/`;
  const message = [
    `${new URL(origin).host} wants you to sign in with your Cardano account:`,
    parsedAddress.canonicalAddress,
    "",
    "Sign in to Xeevia. This request will not submit a transaction.",
    "",
    `URI: ${uri}`,
    "Version: 1",
    `Chain ID: cardano:${parsedAddress.networkId}`,
    `Nonce: ${nonce}`,
    `Issued At: ${issuedAt}`,
    `Expiration Time: ${expiresAt}`,
  ].join("\n");
  const challengeId = crypto.randomUUID();

  const { error: insertError } = await admin.from("cardano_auth_challenges")
    .insert({
      id: challengeId,
      address_hex: parsedAddress.addressHex,
      ip_hash: ipHash,
      message,
      expires_at: expiresAt,
    });
  if (insertError) throw insertError;

  return response(req, { challengeId, message, expiresAt });
}

async function verifyChallenge(
  req: Request,
  body: WalletAuthBody,
  admin: ReturnType<typeof getAdminClient>,
): Promise<Response> {
  if (!body.challengeId || !body.address || !body.key || !body.signature) {
    return response(
      req,
      { error: "Cardano signature details are incomplete." },
      400,
    );
  }
  if (!/^[0-9a-f-]{36}$/i.test(body.challengeId)) {
    return response(req, { error: "Invalid Cardano sign-in challenge." }, 400);
  }

  let parsedAddress;
  try {
    parsedAddress = parseAddress(body.address);
  } catch (error) {
    return response(req, {
      error: error instanceof Error
        ? error.message
        : "Invalid Cardano address.",
    }, 400);
  }

  const { data: challenge, error: challengeError } = await admin
    .from("cardano_auth_challenges")
    .select("id,address_hex,message,expires_at,consumed_at")
    .eq("id", body.challengeId)
    .maybeSingle();
  if (challengeError) throw challengeError;
  if (
    !challenge ||
    challenge.address_hex !== parsedAddress.addressHex ||
    challenge.consumed_at ||
    new Date(challenge.expires_at).getTime() <= Date.now()
  ) {
    return response(req, {
      error:
        "Cardano sign-in challenge expired or was already used. Please try again.",
    }, 401);
  }

  let signatureValid = false;
  try {
    signatureValid = await verifyCip8Signature(
      parsedAddress.bytes,
      challenge.message,
      body.key,
      body.signature,
      parsedAddress.paymentKeyHash,
    );
  } catch {
    signatureValid = false;
  }
  if (!signatureValid) {
    return response(req, {
      error: "Cardano wallet signature could not be verified.",
    }, 401);
  }

  const { data: consumedChallenge, error: consumeError } = await admin
    .from("cardano_auth_challenges")
    .update({ consumed_at: new Date().toISOString() })
    .eq("id", body.challengeId)
    .is("consumed_at", null)
    .gt("expires_at", new Date().toISOString())
    .select("id")
    .maybeSingle();
  if (consumeError) throw consumeError;
  if (!consumedChallenge) {
    return response(req, {
      error:
        "Cardano sign-in challenge expired or was already used. Please try again.",
    }, 401);
  }

  const syntheticEmail = await getSyntheticEmail(parsedAddress.addressHex);
  const username = `cardano_${
    toHex(parsedAddress.paymentKeyHash).slice(0, 16)
  }`;
  const { data: createdUser, error: createError } = await admin.auth.admin
    .createUser({
      email: syntheticEmail,
      password: `${crypto.randomUUID()}${crypto.randomUUID()}!`,
      email_confirm: true,
      app_metadata: {
        wallet_auth: {
          chain: "cardano",
          address: parsedAddress.canonicalAddress,
        },
      },
      user_metadata: {
        full_name: "Cardano Member",
        username,
        wallet_auth: {
          chain: "cardano",
          address: parsedAddress.canonicalAddress,
        },
      },
    });

  if (
    createError &&
    !/already registered|already exists/i.test(createError.message) &&
    createError.code !== "user_already_exists" &&
    createError.code !== "email_exists"
  ) {
    throw createError;
  }

  const { data: linkData, error: linkError } = await admin.auth.admin
    .generateLink({
      type: "magiclink",
      email: syntheticEmail,
    });
  if (linkError) throw linkError;

  const user = linkData?.user || createdUser?.user;
  if (
    !user ||
    user.app_metadata?.wallet_auth?.chain !== "cardano" ||
    user.app_metadata?.wallet_auth?.address !== parsedAddress.canonicalAddress
  ) {
    return response(req, {
      error: "Cardano identity could not be safely matched to an account.",
    }, 409);
  }

  const tokenHash = linkData?.properties?.hashed_token;
  if (!tokenHash) {
    throw new Error("Supabase did not return a one-time sign-in token.");
  }
  return response(req, { token_hash: tokenHash });
}

Deno.serve(async (req) => {
  const origin = req.headers.get("origin") || "";
  const origins = allowedOrigins();
  if (!origin || !origins.has(origin.replace(/\/+$/, ""))) {
    return new Response(JSON.stringify({ error: "Origin is not allowed." }), {
      status: 403,
      headers: { "Content-Type": "application/json", "Vary": "Origin" },
    });
  }

  if (req.method === "OPTIONS") return response(req, { ok: true });
  if (req.method !== "POST") {
    return response(req, { error: "Method not allowed." }, 405);
  }

  try {
    const admin = getAdminClient();
    const body = await req.json() as WalletAuthBody;
    if (body.action === "challenge") {
      return await createChallenge(req, body, admin);
    }
    if (body.action === "verify") {
      return await verifyChallenge(req, body, admin);
    }
    return response(req, {
      error: "Unsupported Cardano authentication action.",
    }, 400);
  } catch (error) {
    console.error("[cardano-auth]", error);
    return response(req, {
      error: "Cardano sign-in is temporarily unavailable.",
    }, 500);
  }
});
