import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...cors, "Content-Type": "application/json" },
});

const getProviderConfig = (provider: string) => {
  if (provider === "discord") return {
    token: Deno.env.get("DISCORD_BOT_TOKEN"),
    api: "https://discord.com/api/v10",
  };
  if (provider === "telegram") return {
    token: Deno.env.get("TELEGRAM_BOT_TOKEN"),
    api: "https://api.telegram.org",
  };
  return null;
};

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const authHeader = request.headers.get("Authorization");
    if (!authHeader) return json({ error: "Authentication required" }, 401);
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
    const admin = createClient(supabaseUrl, serviceKey);
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ error: "Authentication required" }, 401);

    const body = await request.json();
    const provider = String(body.provider || "");
    const communityId = String(body.communityId || "");
    const config = getProviderConfig(provider);
    if (!config?.token) return json({ error: `${provider} bot secret is not configured` }, 503);

    const { data: community } = await admin.from("communities").select("owner_id").eq("id", communityId).maybeSingle();
    if (!community || community.owner_id !== user.id) return json({ error: "Only the community owner can manage this bot" }, 403);

    if (body.action === "check") {
      const endpoint = provider === "discord" ? `${config.api}/users/@me` : `${config.api}/bot${config.token}/getMe`;
      const response = await fetch(endpoint, { headers: provider === "discord" ? { Authorization: `Bot ${config.token}` } : {} });
      const result = await response.json();
      if (!response.ok || (provider === "telegram" && !result.ok)) {
        const message = result?.message || "Bot provider rejected the request";
        await admin.from("community_bot_integrations").update({ status: "error", last_error: message, last_checked_at: new Date().toISOString() }).eq("community_id", communityId).eq("provider", provider);
        return json({ error: message }, 502);
      }
      await admin.from("community_bot_integrations").update({ status: "active", last_error: null, last_checked_at: new Date().toISOString() }).eq("community_id", communityId).eq("provider", provider);
      return json({ ok: true, provider, bot: provider === "telegram" ? result.result : result });
    }

    if (body.action === "discover" && provider === "discord") {
      const { data: connection } = await admin.from("connections").select("id").eq("user_id", user.id).eq("provider", "discord").eq("auth_status", "active").maybeSingle();
      if (!connection) return json({ error: "Link Discord in Account > Identity first." }, 400);
      const { data: tokenRow } = await admin.from("tokens").select("encrypted_token").eq("connection_id", connection.id).eq("revoked", false).maybeSingle();
      if (!tokenRow?.encrypted_token) return json({ error: "Reconnect Discord with the guilds scope before discovering servers." }, 400);

      const userGuildResponse = await fetch("https://discord.com/api/v10/users/@me/guilds", { headers: { Authorization: `Bearer ${tokenRow.encrypted_token}` } });
      const userGuilds = await userGuildResponse.json();
      if (!userGuildResponse.ok) return json({ error: userGuilds?.message || "Discord account access was rejected." }, 502);
      const botGuildResponse = await fetch(`${config.api}/users/@me/guilds`, { headers: { Authorization: `Bot ${config.token}` } });
      const botGuilds = await botGuildResponse.json();
      if (!botGuildResponse.ok) return json({ error: botGuilds?.message || "Discord bot access was rejected." }, 502);
      const botGuildIds = new Set((botGuilds || []).map((guild: { id: string }) => guild.id));
      const guilds = [];
      for (const guild of (userGuilds || []).filter((item: { id: string }) => botGuildIds.has(item.id))) {
        const channelsResponse = await fetch(`${config.api}/guilds/${encodeURIComponent(guild.id)}/channels`, { headers: { Authorization: `Bot ${config.token}` } });
        const channels = await channelsResponse.json();
        if (!channelsResponse.ok) continue;
        guilds.push({ id: guild.id, name: guild.name, icon: guild.icon || null, channels: (channels || []).filter((channel: { type: number }) => channel.type === 0 || channel.type === 5).map((channel: { id: string; name: string; type: number }) => ({ id: channel.id, name: channel.name, type: channel.type })) });
      }
      return json({ ok: true, guilds });
    }

    if (body.action === "dispatch") {
      const content = String(body.content || "").trim();
      if (!content) return json({ error: "Content is required" }, 400);
      let destinationQuery = admin.from("community_bot_destinations").select("*").eq("community_id", communityId).eq("provider", provider).eq("enabled", true);
      if (body.destinationId) destinationQuery = destinationQuery.eq("id", body.destinationId);
      const { data: destinations, error } = await destinationQuery;
      if (error) throw error;
      const results = [];
      for (const destination of destinations || []) {
        let response: Response;
        if (provider === "discord") {
          response = await fetch(`${config.api}/channels/${encodeURIComponent(destination.external_id)}/messages`, { method: "POST", headers: { Authorization: `Bot ${config.token}`, "Content-Type": "application/json" }, body: JSON.stringify({ content: content.slice(0, 2000), embeds: body.url ? [{ url: body.url, title: "Open on Xeevia" }] : undefined }) });
        } else {
          response = await fetch(`${config.api}/bot${config.token}/sendMessage`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ chat_id: destination.external_id, text: content.slice(0, 4096), link_preview_options: body.url ? { is_disabled: false } : undefined }) });
        }
        const result = await response.json();
        const ok = response.ok && (provider !== "telegram" || result.ok);
        await admin.from("community_bot_deliveries").insert({ community_id: communityId, destination_id: destination.id, source_id: body.sourceId || null, source_type: body.sourceType || "xeevia", status: ok ? "sent" : "failed", external_message_id: ok ? String(result.id || result.result?.message_id || result.result?.id || "") : null, error_message: ok ? null : result.message || "Delivery failed", delivered_at: ok ? new Date().toISOString() : null });
        results.push({ destinationId: destination.id, ok, error: ok ? null : result.message });
      }
      return json({ ok: results.every((item) => item.ok), results });
    }
    return json({ error: "Unsupported bot action" }, 400);
  } catch (error) {
    console.error(error);
    return json({ error: error instanceof Error ? error.message : "Bot request failed" }, 500);
  }
});
