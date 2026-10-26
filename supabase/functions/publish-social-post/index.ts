import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const graphVersion = Deno.env.get("META_GRAPH_VERSION") || "v21.0";
const linkedInVersion = Deno.env.get("LINKEDIN_VERSION") || "202501";
const supportedPlatforms = new Set(["x", "facebook", "instagram", "linkedin"]);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, "Content-Type": "application/json" },
});

function decodeStoredToken(value: unknown): string {
  if (typeof value !== "string" || !value) return "";
  const bytea = value.match(/^\\x([0-9a-f]+)$/i);
  if (!bytea) return value;
  const bytes = new Uint8Array(bytea[1].match(/.{2}/g)?.map((part) => parseInt(part, 16)) || []);
  return new TextDecoder().decode(bytes);
}

async function readProviderResponse(response: Response) {
  const text = await response.text();
  let body: Record<string, unknown> = {};
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    body = {};
  }
  if (!response.ok) {
    const providerError = body.error as Record<string, unknown> | undefined;
    throw new Error(String(providerError?.message || body.message || `Provider returned HTTP ${response.status}`));
  }
  return body;
}

function postText(post: Record<string, unknown>) {
  return String(post.content || post.card_caption || post.caption || "").trim();
}

function imageUrls(post: Record<string, unknown>) {
  const metadata = Array.isArray(post.image_metadata) ? post.image_metadata : [];
  return metadata
    .map((item) => typeof item === "string" ? item : item?.url || item?.secure_url)
    .filter((url): url is string => typeof url === "string" && /^https:\/\//i.test(url));
}

function hasVideo(post: Record<string, unknown>) {
  const metadata = post.video_metadata;
  return Array.isArray(metadata) ? metadata.length > 0 : Boolean((metadata as Record<string, unknown> | null)?.url);
}

async function publishX(token: string, post: Record<string, unknown>) {
  const text = postText(post);
  if (!text) throw new Error("X distribution currently requires text; media-only posts are not supported yet.");
  if (imageUrls(post).length || hasVideo(post)) {
    throw new Error("X distribution currently supports text-only posts. Media is not silently dropped.");
  }
  const body = await readProviderResponse(await fetch("https://api.x.com/2/tweets", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  }));
  const id = (body.data as Record<string, unknown> | undefined)?.id;
  if (!id) throw new Error("X accepted no post ID in its response.");
  return String(id);
}

async function getFacebookPages(token: string) {
  const query = new URLSearchParams({
    fields: "id,name,access_token,instagram_business_account",
    access_token: token,
  });
  const body = await readProviderResponse(await fetch(`https://graph.facebook.com/${graphVersion}/me/accounts?${query}`));
  return Array.isArray(body.data) ? body.data as Record<string, unknown>[] : [];
}

function chooseTarget<T extends Record<string, unknown>>(
  targets: T[],
  linkedTargetId: string | null,
  label: string,
): T {
  const exact = linkedTargetId ? targets.find((target) => String(target.id) === linkedTargetId) : null;
  if (exact) return exact;
  if (targets.length === 1) return targets[0];
  if (!targets.length) throw new Error(`No authorized ${label} was found. Reconnect with the required publishing permissions.`);
  throw new Error(`More than one ${label} is authorized. Link a specific ${label} before publishing.`);
}

async function publishFacebook(token: string, platformUserId: string | null, post: Record<string, unknown>) {
  const pages = await getFacebookPages(token);
  const page = chooseTarget(pages, platformUserId, "Facebook Page");
  if (!page.access_token || !page.id) throw new Error("The selected Facebook Page did not return a publishing token.");
  const text = postText(post);
  const images = imageUrls(post);
  if (images.length > 1 || hasVideo(post)) {
    throw new Error("Facebook distribution currently supports text posts or one image; multi-image and video posts are not supported yet.");
  }
  const payload = new URLSearchParams({ access_token: String(page.access_token) });
  let endpoint = `https://graph.facebook.com/${graphVersion}/${page.id}/feed`;
  if (images.length === 1) {
    endpoint = `https://graph.facebook.com/${graphVersion}/${page.id}/photos`;
    payload.set("url", images[0]);
    payload.set("caption", text);
  } else {
    if (!text) throw new Error("Facebook requires post text or an image.");
    payload.set("message", text);
  }
  const result = await readProviderResponse(await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: payload,
  }));
  if (!result.id) throw new Error("Facebook accepted no post ID in its response.");
  return String(result.id);
}

async function publishInstagram(token: string, platformUserId: string | null, post: Record<string, unknown>) {
  const pages = await getFacebookPages(token);
  const instagramAccounts = pages
    .filter((page) => page.instagram_business_account?.id)
    .map((page) => ({
      id: (page.instagram_business_account as Record<string, unknown>).id,
      pageToken: page.access_token,
    }));
  const account = chooseTarget(instagramAccounts, platformUserId, "Instagram Professional account");
  if (!account.pageToken) throw new Error("The linked Instagram account has no authorized Page token.");
  const images = imageUrls(post);
  if (images.length !== 1 || hasVideo(post)) {
    throw new Error("Instagram distribution currently supports one image per post. Video, multi-image, and text-only posts are not supported yet.");
  }

  const containerPayload = new URLSearchParams({
    image_url: images[0],
    caption: postText(post),
    access_token: String(account.pageToken),
  });
  const container = await readProviderResponse(await fetch(
    `https://graph.facebook.com/${graphVersion}/${account.id}/media`,
    { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: containerPayload },
  ));
  if (!container.id) throw new Error("Instagram did not create a media container.");

  const publishPayload = new URLSearchParams({ creation_id: String(container.id), access_token: String(account.pageToken) });
  const published = await readProviderResponse(await fetch(
    `https://graph.facebook.com/${graphVersion}/${account.id}/media_publish`,
    { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: publishPayload },
  ));
  if (!published.id) throw new Error("Instagram accepted no post ID in its response.");
  return String(published.id);
}

async function publishLinkedIn(token: string, platformUserId: string | null, post: Record<string, unknown>) {
  const commentary = postText(post);
  if (!commentary) throw new Error("LinkedIn distribution currently requires text; media-only posts are not supported yet.");
  if (imageUrls(post).length || hasVideo(post)) {
    throw new Error("LinkedIn media publishing is not configured yet. Text posts can still be distributed.");
  }
  if (!platformUserId) throw new Error("Reconnect LinkedIn to refresh the publishing identity.");
  const author = platformUserId.startsWith("urn:") ? platformUserId : `urn:li:person:${platformUserId}`;
  const response = await fetch("https://api.linkedin.com/rest/posts", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "LinkedIn-Version": linkedInVersion,
      "X-Restli-Protocol-Version": "2.0.0",
    },
    body: JSON.stringify({
      author,
      commentary,
      visibility: "PUBLIC",
      distribution: {
        feedDistribution: "MAIN_FEED",
        targetEntities: [],
        thirdPartyDistributionChannels: [],
      },
      lifecycleState: "PUBLISHED",
      isReshareDisabledByAuthor: false,
    }),
  });
  const id = response.headers.get("x-restli-id");
  await readProviderResponse(response);
  if (!id) throw new Error("LinkedIn accepted no post ID in its response.");
  return id;
}

async function loadSource(admin: ReturnType<typeof createClient>, userId: string, contentType: string, contentId: string) {
  if (contentType === "post") {
    const { data, error } = await admin.from("posts").select("*").eq("id", contentId).eq("user_id", userId).is("deleted_at", null).maybeSingle();
    if (error) throw error;
    if (!data) throw new Error("The post was not found or does not belong to the signed-in user.");
    return data as Record<string, unknown>;
  }
  const tableByType: Record<string, string> = { reel: "reels", story: "stories" };
  const table = tableByType[contentType];
  if (!table) throw new Error(`Unsupported content type: ${contentType}`);
  const { data, error } = await admin.from(table).select("*").eq("id", contentId).eq("user_id", userId).maybeSingle();
  if (error) throw error;
  if (!data) throw new Error(`The ${contentType} was not found or does not belong to the signed-in user.`);
  if (contentType === "reel") {
    return { ...data, content: data.caption || "", image_metadata: [], video_metadata: data.video_metadata?.url ? [data.video_metadata] : [] };
  }
  return {
    ...data,
    content: [data.title, data.preview].filter(Boolean).join("\n\n"),
    image_metadata: data.cover_image_metadata?.url ? [data.cover_image_metadata] : [],
    video_metadata: [],
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed." }, 405);
  if (!supabaseUrl || !serviceRoleKey || !anonKey) return json({ error: "The publishing function is not configured." }, 500);

  try {
    const authorization = req.headers.get("Authorization") || "";
    const accessToken = authorization.replace(/^Bearer\s+/i, "");
    if (!accessToken) return json({ error: "Sign in before distributing content." }, 401);
    const authClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: `Bearer ${accessToken}` } } });
    const { data: userData, error: authError } = await authClient.auth.getUser();
    if (authError || !userData.user) return json({ error: "Your session is invalid or expired. Sign in again." }, 401);

    const body = await req.json();
    const contentType = String(body.contentType || "post");
    const contentId = String(body.contentId || "");
    const platform = String(body.platform || "");
    if (!contentId || !supportedPlatforms.has(platform)) return json({ error: "A content ID and supported platform are required." }, 400);

    const admin = createClient(supabaseUrl, serviceRoleKey);
    const post = await loadSource(admin, userData.user.id, contentType, contentId);
    const providerFallbacks: Record<string, string[]> = {
      x: ["twitter"],
      linkedin: ["linkedin_oidc"],
    };
    let { data: connection, error: connectionError } = await admin
      .from("connections")
      .select("id,platform_user_id,auth_status")
      .eq("user_id", userData.user.id)
      .eq("provider", platform)
      .eq("auth_status", "active")
      .maybeSingle();
    if (connectionError) throw connectionError;
    if (!connection && providerFallbacks[platform]?.length) {
      const fallback = await admin
        .from("connections")
        .select("id,platform_user_id,auth_status")
        .eq("user_id", userData.user.id)
        .in("provider", providerFallbacks[platform])
        .eq("auth_status", "active")
        .limit(1)
        .maybeSingle();
      connection = fallback.data;
      connectionError = fallback.error;
      if (connectionError) throw connectionError;
    }
    if (!connection) return json({ error: `No active ${platform} publishing connection was found. Reconnect the platform and try again.` }, 409);

    const { data: tokenRow, error: tokenError } = await admin
      .from("tokens")
      .select("encrypted_token,expires_at,revoked")
      .eq("connection_id", connection.id)
      .eq("revoked", false)
      .maybeSingle();
    if (tokenError) throw tokenError;
    const token = decodeStoredToken(tokenRow?.encrypted_token);
    const expiresAt = tokenRow?.expires_at ? Date.parse(tokenRow.expires_at) : null;
    if (!token || tokenRow?.revoked || (tokenRow?.expires_at && (!Number.isFinite(expiresAt) || expiresAt <= Date.now()))) {
      return json({ error: `The ${platform} publishing credential is missing or expired. Reconnect the platform with publishing permissions.` }, 409);
    }

    let externalId: string;
    if (platform === "x") externalId = await publishX(token, post);
    else if (platform === "facebook") externalId = await publishFacebook(token, connection.platform_user_id, post);
    else if (platform === "instagram") externalId = await publishInstagram(token, connection.platform_user_id, post);
    else externalId = await publishLinkedIn(token, connection.platform_user_id, post);
    return json({ externalId });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[publish-social-post]", message);
    return json({ error: message }, 502);
  }
});
