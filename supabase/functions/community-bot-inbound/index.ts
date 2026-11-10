import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { normalizeDiscordMessage, normalizeTelegramUpdate } from "../_shared/communityBotInbound.js";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, x-telegram-bot-api-secret-token, x-discord-bridge-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...cors, "Content-Type": "application/json" },
});

function secretMatches(received: string | null, expected: string | undefined) {
  if (!received || !expected || received.length !== expected.length) return false;
  let mismatch = 0;
  for (let index = 0; index < received.length; index += 1) mismatch |= received.charCodeAt(index) ^ expected.charCodeAt(index);
  return mismatch === 0;
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (request.method !== "POST") return json({ error: "Method not allowed." }, 405);

  const telegramSecret = Deno.env.get("TELEGRAM_WEBHOOK_SECRET");
  const discordSecret = Deno.env.get("DISCORD_BRIDGE_SECRET");
  const telegramRequest = secretMatches(request.headers.get("x-telegram-bot-api-secret-token"), telegramSecret);
  const discordRequest = secretMatches(request.headers.get("x-discord-bridge-secret"), discordSecret);
  if (!telegramRequest && !discordRequest) return json({ error: "Unauthorized bot event." }, 401);

  const provider = telegramRequest ? "telegram" : "discord";
  try {
    const body = await request.json();
    const message = provider === "telegram"
      ? normalizeTelegramUpdate(body)
      : normalizeDiscordMessage(body.message);
    if (!message) return json({ ok: true, ignored: true });

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceKey) return json({ error: "Bot inbound storage is not configured." }, 503);
    const admin = createClient(supabaseUrl, serviceKey);
    let destinationQuery = admin
      .from("community_bot_destinations")
      .select("id,community_id,xeevia_channel_id,parent_external_id,integration:community_bot_integrations!inner(status)")
      .eq("provider", provider)
      .eq("external_id", message.external_channel_id)
      .eq("inbound_enabled", true)
      .not("xeevia_channel_id", "is", null);
    if (provider === "discord" && message.parent_external_id) {
      destinationQuery = destinationQuery.eq("parent_external_id", message.parent_external_id);
    }
    const { data: destinations, error: destinationError } = await destinationQuery;
    if (destinationError) throw destinationError;

    let written = 0;
    for (const destination of destinations || []) {
      const integration = Array.isArray(destination.integration) ? destination.integration[0] : destination.integration;
      if (integration?.status !== "active") continue;
      const { external_channel_id: _externalChannelId, parent_external_id: _parentExternalId, ...storedMessage } = message;
      const { error: insertError } = await admin.from("community_bot_inbound_messages").upsert({
        community_id: destination.community_id,
        xeevia_channel_id: destination.xeevia_channel_id,
        destination_id: destination.id,
        ...storedMessage,
      }, { onConflict: "destination_id,external_message_id" });
      if (insertError) throw insertError;
      written += 1;
    }
    return json({ ok: true, written, ignored: written === 0 });
  } catch (error) {
    console.error("Community bot inbound failed:", error);
    return json({ error: error instanceof Error ? error.message : "Could not save inbound bot message." }, 500);
  }
});
