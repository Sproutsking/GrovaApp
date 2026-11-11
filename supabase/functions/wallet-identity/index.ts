import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { verifyMessage, getAddress } from "npm:ethers@6.13.5";
import { base58 } from "npm:@scure/base@1.2.6";
import {
  parseAddress as parseCardanoAddress,
  verifyCip8Signature,
} from "../cardano-auth/verification.ts";

const CHALLENGE_TTL_MS = 5 * 60 * 1000;
const MAX_CHALLENGES_PER_USER = 20;

type WalletChain = "ethereum" | "solana" | "cardano";
type RequestBody = {
  action?: string;
  chain?: WalletChain;
  address?: string;
  chainId?: number;
  challengeId?: string;
  signature?: string;
  publicKey?: string;
  walletName?: string;
  id?: string;
};

class RequestError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

function response(req: Request, body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Access-Control-Allow-Origin": req.headers.get("origin") || "",
      "Access-Control-Allow-Headers":
        "authorization, x-client-info, apikey, content-type",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Content-Type": "application/json",
      "Vary": "Origin",
    },
  });
}

function getAllowedOrigins(): Set<string> {
  return new Set(
    (Deno.env.get("WEB3_AUTH_ALLOWED_ORIGINS") || "")
      .split(",")
      .map((origin) => origin.trim().replace(/\/+$/, ""))
      .filter(Boolean),
  );
}

function getAdminClient() {
  const url = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceRoleKey) {
    throw new Error("Wallet identity service is not configured.");
  }
  return createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

function normalizeWallet(chain: WalletChain, address: string) {
  if (chain === "ethereum") {
    const checksumAddress = getAddress(address);
    return { address: checksumAddress, addressKey: checksumAddress.toLowerCase() };
  }
  if (chain === "solana") {
    const publicKey = base58.decode(address);
    if (publicKey.length !== 32) throw new Error("Invalid Solana wallet address.");
    const canonicalAddress = base58.encode(publicKey);
    return { address: canonicalAddress, addressKey: canonicalAddress };
  }
  const parsed = parseCardanoAddress(address);
  return { address: parsed.canonicalAddress, addressKey: parsed.addressHex };
}

function decodeHex(value: string): Uint8Array {
  if (!/^(?:[0-9a-f]{2})+$/i.test(value)) {
    throw new Error("Invalid wallet signature.");
  }
  const bytes = new Uint8Array(value.length / 2);
  for (let i = 0; i < bytes.length; i += 1) {
    bytes[i] = Number.parseInt(value.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

function createMessage(
  chain: WalletChain,
  address: string,
  origin: string,
  chainId?: number,
  addressKey?: string,
) {
  const issuedAt = new Date();
  const expiresAt = new Date(issuedAt.getTime() + CHALLENGE_TTL_MS);
  const nonce = crypto.randomUUID().replaceAll("-", "");
  const domain = new URL(origin).host;
  if (chain === "ethereum") {
    if (!Number.isSafeInteger(chainId) || (chainId || 0) <= 0) {
      throw new Error("The EVM wallet returned an invalid chain ID.");
    }
    return [
      `${domain} wants you to sign in with your Ethereum account:`,
      address,
      "",
      "Link this wallet to your Xeevia account. This request will not submit a transaction.",
      "",
      `URI: ${origin}/`,
      "Version: 1",
      `Chain ID: ${chainId}`,
      `Nonce: ${nonce}`,
      `Issued At: ${issuedAt.toISOString()}`,
      `Expiration Time: ${expiresAt.toISOString()}`,
    ].join("\n");
  }
  if (chain === "cardano") {
    const parsed = parseCardanoAddress(addressKey || "");
    return [
      `${domain} wants you to sign in with your Cardano account:`,
      parsed.canonicalAddress,
      "",
      "Link this wallet to your Xeevia account. This request will not submit a transaction.",
      "",
      `URI: ${origin}/`,
      "Version: 1",
      `Chain ID: cardano:${parsed.networkId}`,
      `Nonce: ${nonce}`,
      `Issued At: ${issuedAt.toISOString()}`,
      `Expiration Time: ${expiresAt.toISOString()}`,
    ].join("\n");
  }
  return [
    `${domain} wants you to sign in with your Solana account:`,
    address,
    "",
    "Link this wallet to your Xeevia account. This request will not submit a transaction.",
    "",
    `URI: ${origin}/`,
    "Version: 1",
    "Chain ID: solana:mainnet",
    `Nonce: ${nonce}`,
    `Issued At: ${issuedAt.toISOString()}`,
    `Expiration Time: ${expiresAt.toISOString()}`,
  ].join("\n");
}

async function getAuthenticatedUser(req: Request, admin: ReturnType<typeof getAdminClient>) {
  const authorization = req.headers.get("authorization") || "";
  const token = authorization.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) throw new RequestError("Sign in to Xeevia before linking a wallet.", 401);
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) throw new RequestError("Your Xeevia session is no longer valid.", 401);
  return data.user;
}

async function createChallenge(
  req: Request,
  body: RequestBody,
  userId: string,
  admin: ReturnType<typeof getAdminClient>,
) {
  if (!body.chain || !["ethereum", "solana", "cardano"].includes(body.chain)) {
    return response(req, { error: "Unsupported wallet chain." }, 400);
  }
  if (!body.address || body.address.length > 256) {
    return response(req, { error: "A valid wallet address is required." }, 400);
  }

  let normalized: ReturnType<typeof normalizeWallet>;
  try {
    normalized = normalizeWallet(body.chain, body.address);
  } catch (error) {
    return response(req, {
      error: error instanceof Error ? error.message : "Invalid wallet address.",
    }, 400);
  }
  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count, error: countError } = await admin
    .from("wallet_identity_challenges")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("created_at", since);
  if (countError) throw countError;
  if ((count || 0) >= MAX_CHALLENGES_PER_USER) {
    return response(req, { error: "Too many wallet link attempts. Try again later." }, 429);
  }

  const origin = req.headers.get("origin");
  if (!origin) return response(req, { error: "The request origin is missing." }, 403);
  let message: string;
  try {
    message = createMessage(
      body.chain,
      normalized.address,
      origin,
      body.chainId,
      normalized.addressKey,
    );
  } catch (error) {
    return response(req, {
      error: error instanceof Error ? error.message : "Invalid wallet challenge request.",
    }, 400);
  }
  const challengeId = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + CHALLENGE_TTL_MS).toISOString();
  const { error } = await admin.from("wallet_identity_challenges").insert({
    id: challengeId,
    user_id: userId,
    chain: body.chain,
    address: normalized.address,
    address_key: normalized.addressKey,
    message,
    expires_at: expiresAt,
  });
  if (error) throw error;
  return response(req, { challengeId, message, expiresAt });
}

async function verifyWallet(
  req: Request,
  body: RequestBody,
  userId: string,
  admin: ReturnType<typeof getAdminClient>,
) {
  if (!body.challengeId || !/^[0-9a-f-]{36}$/i.test(body.challengeId)) {
    return response(req, { error: "Invalid wallet link challenge." }, 400);
  }
  const { data: challenge, error: challengeError } = await admin
    .from("wallet_identity_challenges")
    .select("id,user_id,chain,address,address_key,message,expires_at,consumed_at")
    .eq("id", body.challengeId)
    .eq("user_id", userId)
    .maybeSingle();
  if (challengeError) throw challengeError;
  if (
    !challenge || challenge.consumed_at ||
    new Date(challenge.expires_at).getTime() <= Date.now()
  ) {
    return response(req, { error: "Wallet link challenge expired. Try again." }, 401);
  }

  let verified = false;
  if (challenge.chain === "ethereum" && body.signature) {
    try {
      verified = getAddress(verifyMessage(challenge.message, body.signature)) === challenge.address;
    } catch {
      verified = false;
    }
  } else if (challenge.chain === "solana" && body.signature) {
    try {
      const signatureBytes = decodeHex(body.signature);
      const publicKeyBytes = base58.decode(challenge.address);
      if (signatureBytes.length === 64 && publicKeyBytes.length === 32) {
        const keyBuffer = new Uint8Array(publicKeyBytes).buffer;
        const signatureBuffer = new Uint8Array(signatureBytes).buffer;
        const key = await crypto.subtle.importKey(
          "raw",
          keyBuffer,
          { name: "Ed25519" },
          false,
          ["verify"],
        );
        verified = await crypto.subtle.verify(
          { name: "Ed25519" },
          key,
          signatureBuffer,
          new TextEncoder().encode(challenge.message),
        );
      }
    } catch {
      verified = false;
    }
  } else if (challenge.chain === "cardano" && body.signature && body.publicKey) {
    try {
      const parsed = parseCardanoAddress(challenge.address);
      verified = await verifyCip8Signature(
        parsed.bytes,
        challenge.message,
        body.publicKey,
        body.signature,
        parsed.paymentKeyHash,
      );
    } catch {
      verified = false;
    }
  }

  if (!verified) {
    return response(req, { error: "Wallet signature could not be verified." }, 401);
  }

  const { data: consumed, error: consumeError } = await admin
    .from("wallet_identity_challenges")
    .update({ consumed_at: new Date().toISOString() })
    .eq("id", challenge.id)
    .eq("user_id", userId)
    .is("consumed_at", null)
    .gt("expires_at", new Date().toISOString())
    .select("id")
    .maybeSingle();
  if (consumeError) throw consumeError;
  if (!consumed) {
    return response(req, { error: "Wallet link challenge expired or already used." }, 401);
  }

  const walletName = typeof body.walletName === "string"
    ? body.walletName.trim().slice(0, 80)
    : "";
  const { data: wallet, error: insertError } = await admin
    .from("identity_wallets")
    .insert({
      user_id: userId,
      chain: challenge.chain,
      address: challenge.address,
      address_key: challenge.address_key,
      wallet_name: walletName,
    })
    .select("id,chain,address,wallet_name,verified_at,created_at")
    .single();
  if (insertError) {
    if (insertError.code === "23505") {
      return response(req, {
        error: "This wallet is already linked to a Xeevia account.",
      }, 409);
    }
    throw insertError;
  }
  return response(req, { wallet });
}

Deno.serve(async (req) => {
  const origin = req.headers.get("origin") || "";
  if (!origin || !getAllowedOrigins().has(origin.replace(/\/+$/, ""))) {
    return new Response(JSON.stringify({ error: "Origin is not allowed." }), {
      status: 403,
      headers: { "Content-Type": "application/json", "Vary": "Origin" },
    });
  }
  if (req.method === "OPTIONS") return response(req, { ok: true });
  if (req.method !== "POST") return response(req, { error: "Method not allowed." }, 405);

  try {
    const admin = getAdminClient();
    const user = await getAuthenticatedUser(req, admin);
    const body = await req.json() as RequestBody;
    if (body.action === "challenge") {
      return await createChallenge(req, body, user.id, admin);
    }
    if (body.action === "verify") {
      return await verifyWallet(req, body, user.id, admin);
    }
    return response(req, { error: "Unsupported wallet identity action." }, 400);
  } catch (error) {
    console.error("[wallet-identity]", error instanceof Error ? error.message : error);
    const status = error instanceof RequestError ? error.status : 500;
    return response(req, {
      error: error instanceof RequestError
        ? error.message
        : "Wallet identity service is temporarily unavailable.",
    }, status);
  }
});
