import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const authorization = req.headers.get("Authorization");
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!authorization || !supabaseUrl || !anonKey) {
    return json({ error: "Authentication required" }, 401);
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
  });
  const { data: { user }, error: authError } = await userClient.auth.getUser();
  if (authError || !user) return json({ error: "Unauthorized" }, 401);

  const accountSid = Deno.env.get("TWILIO_ACCOUNT_SID");
  const apiKeySid = Deno.env.get("TWILIO_API_KEY_SID");
  const apiKeySecret = Deno.env.get("TWILIO_API_KEY_SECRET");
  if (!accountSid || !apiKeySid || !apiKeySecret) {
    console.error("[get-call-ice-config] Twilio Network Traversal credentials are not configured");
    return json({ error: "Call relay service is not configured" }, 503);
  }

  const credentials = btoa(`${apiKeySid}:${apiKeySecret}`);
  let tokenResponse: Response;
  try {
    tokenResponse = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(accountSid)}/Tokens.json`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${credentials}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({ Ttl: "3600" }),
      },
    );
  } catch (error) {
    console.error("[get-call-ice-config] Twilio token request failed:", error);
    return json({ error: "Call relay service is temporarily unavailable" }, 502);
  }

  if (!tokenResponse.ok) {
    console.error("[get-call-ice-config] Twilio rejected the token request:", tokenResponse.status);
    return json({ error: "Could not create call relay credentials" }, 502);
  }

  let token: { ice_servers?: unknown[]; ttl?: string };
  try {
    token = await tokenResponse.json();
  } catch (error) {
    console.error("[get-call-ice-config] Could not parse Twilio token response:", error);
    return json({ error: "Call relay service returned an invalid response" }, 502);
  }
  if (!Array.isArray(token.ice_servers) || token.ice_servers.length === 0) {
    console.error("[get-call-ice-config] Twilio token response has no ICE servers");
    return json({ error: "Call relay service returned invalid configuration" }, 502);
  }

  return json({ iceServers: token.ice_servers, ttl: Number(token.ttl) || 3600 });
});
