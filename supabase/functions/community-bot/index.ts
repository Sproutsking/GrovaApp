import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  decodeStoredToken,
  hasDiscordChannelSendPermissions,
  hasDiscordGuildManagementPermission,
} from "../_shared/discordPermissions.js";
import { buildTelegramMessage, getBotProviderError } from "../_shared/botMessageUtils.js";

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
    if (!config) return json({ error: "Unsupported bot provider" }, 400);

    const { data: canManageBots, error: permissionError } = await userClient.rpc(
      "community_user_can_manage_bots",
      { p_community_id: communityId },
    );
    if (permissionError) throw permissionError;
    if (!canManageBots) return json({ error: "You do not have permission to manage bots for this community" }, 403);
    if (!config?.token) return json({ error: `${provider} bot secret is not configured` }, 503);

    if (body.action === "check") {
      const endpoint = provider === "discord" ? `${config.api}/users/@me` : `${config.api}/bot${config.token}/getMe`;
      const response = await fetch(endpoint, { headers: provider === "discord" ? { Authorization: `Bot ${config.token}` } : {} });
      const result = await response.json();
      if (!response.ok || (provider === "telegram" && !result.ok)) {
        const message = result?.message || "Bot provider rejected the request";
        const { error: updateError } = await admin.from("community_bot_integrations").update({ status: "error", last_error: message, last_checked_at: new Date().toISOString() }).eq("community_id", communityId).eq("provider", provider);
        if (updateError) throw updateError;
        return json({ error: message }, 502);
      }
      const { error: updateError } = await admin.from("community_bot_integrations").update({ status: "active", last_error: null, last_checked_at: new Date().toISOString() }).eq("community_id", communityId).eq("provider", provider);
      if (updateError) throw updateError;
      return json({ ok: true, provider, bot: provider === "telegram" ? result.result : result });
    }

    if (body.action === "configure-webhook" && provider === "telegram") {
      const webhookSecret = Deno.env.get("TELEGRAM_WEBHOOK_SECRET");
      const projectUrl = Deno.env.get("SUPABASE_URL");
      if (!webhookSecret || !/^[A-Za-z0-9_-]{1,256}$/.test(webhookSecret)) {
        return json({ error: "Set TELEGRAM_WEBHOOK_SECRET to a 1–256 character Telegram-safe secret before enabling inbound sync." }, 503);
      }
      if (!projectUrl) return json({ error: "SUPABASE_URL is not configured for the Telegram webhook." }, 503);
      const response = await fetch(`${config.api}/bot${config.token}/setWebhook`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: `${projectUrl.replace(/\/$/, "")}/functions/v1/community-bot-inbound`,
          secret_token: webhookSecret,
          allowed_updates: ["message", "channel_post"],
          drop_pending_updates: false,
        }),
      });
      const result = await response.json();
      if (!response.ok || !result.ok) return json({ error: result.description || "Telegram rejected the webhook configuration." }, 502);
      return json({ ok: true, provider, webhookConfigured: true });
    }

    if (body.action === "validate-destination") {
      const externalId = String(body.externalId || "").trim();
      if (!externalId) return json({ error: "A destination ID is required." }, 400);

      if (provider === "discord") {
        const guildId = String(body.parentExternalId || "").trim();
        if (!guildId) return json({ error: "Choose a Discord server before saving its channel." }, 400);
        const channelResponse = await fetch(`${config.api}/channels/${encodeURIComponent(externalId)}`, { headers: { Authorization: `Bot ${config.token}` } });
        const channel = await channelResponse.json();
        if (!channelResponse.ok) return json({ error: channel?.message || "The bot cannot access that Discord channel." }, 400);
        if (String(channel.guild_id || "") !== guildId || ![0, 5].includes(channel.type)) {
          return json({ error: "Choose a text or announcement channel in the selected Discord server." }, 400);
        }

        const meResponse = await fetch(`${config.api}/users/@me`, { headers: { Authorization: `Bot ${config.token}` } });
        const botUser = await meResponse.json();
        if (!meResponse.ok || !botUser?.id) return json({ error: botUser?.message || "Could not identify the Discord bot." }, 502);
        const [memberResponse, rolesResponse] = await Promise.all([
          fetch(`${config.api}/guilds/${encodeURIComponent(guildId)}/members/${encodeURIComponent(botUser.id)}`, { headers: { Authorization: `Bot ${config.token}` } }),
          fetch(`${config.api}/guilds/${encodeURIComponent(guildId)}/roles`, { headers: { Authorization: `Bot ${config.token}` } }),
        ]);
        const [botMember, roles] = await Promise.all([memberResponse.json(), rolesResponse.json()]);
        if (!memberResponse.ok) return json({ error: botMember?.message || "The bot is not a member of that Discord server." }, 400);
        if (!rolesResponse.ok) return json({ error: roles?.message || "Could not read Discord server roles." }, 502);
        const canSend = hasDiscordChannelSendPermissions({
          guildId,
          botId: botUser.id,
          roles: Array.isArray(roles) ? roles : [],
          memberRoleIds: botMember.roles || [],
          overwrites: channel.permission_overwrites || [],
        });
        if (!canSend) return json({ error: "The bot needs View Channel and Send Messages permission in this channel." }, 403);
        return json({ ok: true, provider, destination: { id: channel.id, name: channel.name, parentId: guildId } });
      }

      const meResponse = await fetch(`${config.api}/bot${config.token}/getMe`);
      const me = await meResponse.json();
      if (!meResponse.ok || !me.ok || !me.result?.id) return json({ error: me.description || "Could not identify the Telegram bot." }, 502);
      const [chatResponse, memberResponse] = await Promise.all([
        fetch(`${config.api}/bot${config.token}/getChat?chat_id=${encodeURIComponent(externalId)}`),
        fetch(`${config.api}/bot${config.token}/getChatMember?chat_id=${encodeURIComponent(externalId)}&user_id=${encodeURIComponent(me.result.id)}`),
      ]);
      const [chatResult, memberResult] = await Promise.all([chatResponse.json(), memberResponse.json()]);
      if (!chatResponse.ok || !chatResult.ok) return json({ error: chatResult.description || "The bot cannot access that Telegram chat." }, 400);
      if (!memberResponse.ok || !memberResult.ok) return json({ error: memberResult.description || "Could not verify the bot's Telegram chat permissions." }, 400);
      const chat = chatResult.result || {};
      const member = memberResult.result || {};
      const status = member.status;
      const isChannel = chat.type === "channel";
      const isAdmin = status === "creator" || status === "administrator";
      const canPost = isAdmin
        ? !isChannel || member.can_post_messages !== false
        : !isChannel && ["member", "restricted"].includes(status)
          && member.can_send_messages !== false
          && chat.permissions?.can_send_messages !== false;
      if (!canPost) return json({ error: "Add the Telegram bot to this chat and grant it permission to post." }, 403);
      return json({ ok: true, provider, destination: { id: externalId, name: chat.title || chat.username || externalId, type: chat.type } });
    }

    if (body.action === "discover" && provider === "discord") {
      const { data: connection, error: connectionError } = await admin.from("connections").select("id").eq("user_id", user.id).eq("provider", "discord").eq("auth_status", "active").maybeSingle();
      if (connectionError) throw connectionError;
      if (!connection) return json({ error: "Link Discord in Account > Identity first." }, 400);
      const { data: tokenRow, error: tokenError } = await admin.from("tokens").select("encrypted_token").eq("connection_id", connection.id).eq("revoked", false).maybeSingle();
      if (tokenError) throw tokenError;
      if (!tokenRow?.encrypted_token) return json({ error: "Reconnect Discord with the guilds scope before discovering servers." }, 400);
      const userAccessToken = decodeStoredToken(tokenRow.encrypted_token);
      if (!userAccessToken) return json({ error: "Reconnect Discord with the guilds scope before discovering servers." }, 400);

      const userGuildResponse = await fetch("https://discord.com/api/v10/users/@me/guilds", { headers: { Authorization: `Bearer ${userAccessToken}` } });
      const userGuilds = await userGuildResponse.json();
      if (!userGuildResponse.ok) return json({ error: userGuilds?.message || "Discord account access was rejected." }, 502);
      const guilds = [];
      const manageableGuilds = (userGuilds || []).filter((guild: { permissions?: string; permissions_new?: string }) =>
        hasDiscordGuildManagementPermission(guild.permissions_new || guild.permissions),
      );
      for (const guild of manageableGuilds) {
        const botGuildResponse = await fetch(`${config.api}/guilds/${encodeURIComponent(guild.id)}?with_counts=false`, { headers: { Authorization: `Bot ${config.token}` } });
        if (!botGuildResponse.ok) continue;
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
      if (!destinations?.length) {
        return json({ ok: false, error: "No enabled bot destinations are configured for this community." }, 400);
      }
      const results = [];
      for (const destination of destinations || []) {
        let response: Response;
        if (provider === "discord") {
          response = await fetch(`${config.api}/channels/${encodeURIComponent(destination.external_id)}/messages`, { method: "POST", headers: { Authorization: `Bot ${config.token}`, "Content-Type": "application/json" }, body: JSON.stringify({ content: content.slice(0, 2000), embeds: body.url ? [{ url: body.url, title: "Open on Xeevia" }] : undefined }) });
        } else {
          response = await fetch(`${config.api}/bot${config.token}/sendMessage`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ chat_id: destination.external_id, text: buildTelegramMessage(content, body.url), link_preview_options: body.url ? { is_disabled: false } : undefined }) });
        }
        const result = await response.json();
        const ok = response.ok && (provider !== "telegram" || result.ok);
        const externalMessageId = ok ? String(result.id || result.result?.message_id || result.result?.id || "") : null;
        const providerError = ok ? null : getBotProviderError(result, provider);
        const { error: deliveryError } = await admin.from("community_bot_deliveries").insert({ community_id: communityId, destination_id: destination.id, source_id: body.sourceId || null, source_type: body.sourceType || "xeevia", status: ok ? "sent" : "failed", external_message_id: externalMessageId, error_message: providerError, delivered_at: ok ? new Date().toISOString() : null });
        if (deliveryError) throw deliveryError;
        results.push({ destinationId: destination.id, ok, error: providerError, externalMessageId });
      }
      return json({ ok: results.every((item) => item.ok), results });
    }
    return json({ error: "Unsupported bot action" }, 400);
  } catch (error) {
    console.error(error);
    return json({ error: error instanceof Error ? error.message : "Bot request failed" }, 500);
  }
});
