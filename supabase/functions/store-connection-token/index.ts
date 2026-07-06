import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { serviceClient, getAuthUser, json, err } from "../_shared/utils.ts";
import { encryptString } from "../_shared/crypto.ts";

serve(async (req) => {
  if (req.method !== "POST") return err("Method not allowed", 405);

  const userId = await getAuthUser(req);
  if (!userId) return err("Unauthorized", 401);

  let body;
  try {
    body = await req.json();
  } catch {
    return err("Invalid JSON body", 400);
  }

  const { connection_id, provider, platform_user_id, accessToken, refreshToken, expiresAt } = body || {};
  if (!accessToken) return err("accessToken is required", 400);

  const db = serviceClient();

  try {
    let connectionId = connection_id;
    let connection = null;

    if (!connectionId) {
      if (!provider || !platform_user_id) {
        return err("connection_id or provider + platform_user_id required", 400);
      }
      const { data: connData, error: connErr } = await db
        .from("connections")
        .select("id")
        .eq("user_id", userId)
        .eq("provider", provider)
        .eq("platform_user_id", platform_user_id)
        .maybeSingle();

      if (connErr) return err(connErr.message, 500);
      connectionId = connData?.id;
    }

    if (!connectionId) {
      const { data: connData, error: connErr } = await db
        .from("connections")
        .insert({
          user_id: userId,
          provider,
          platform_user_id,
          auth_status: "active",
          permissions: ["publish", "graph.read"],
          connected_via: "oauth_popup",
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (connErr) return err(connErr.message, 500);
      connection = connData;
      connectionId = connection.id;
    } else {
      const { data: connData, error: connErr } = await db
        .from("connections")
        .update({
          auth_status: "active",
          permissions: ["publish", "graph.read"],
          platform_user_id: platform_user_id || undefined,
          updated_at: new Date().toISOString(),
        })
        .eq("id", connectionId)
        .select()
        .single();

      if (connErr) return err(connErr.message, 500);
      connection = connData;
    }

    const encrypted = await encryptString(String(accessToken));

    const tokenPayload = {
      connection_id: connectionId,
      token_type: "bearer",
      encrypted_token: encrypted,
      refresh_token: refreshToken || null,
      expires_at: expiresAt || new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      revoked: false,
      created_at: new Date().toISOString(),
    };

    const { data: tokenRow, error: tokenErr } = await db
      .from("tokens")
      .upsert(tokenPayload, { onConflict: ["connection_id"] })
      .select();

    if (tokenErr) return err(tokenErr.message, 500);

    return json({ ok: true, connection_id: connectionId, token: tokenRow?.[0] || null });
  } catch (error) {
    console.error("store-connection-token error", error);
    return err(String(error), 500);
  }
});
