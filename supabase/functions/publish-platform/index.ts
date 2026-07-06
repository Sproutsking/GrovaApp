import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { serviceClient, getAuthUser, json, err } from "../_shared/utils.ts";
import { decryptString } from "../_shared/crypto.ts";

const db = serviceClient();

const toText = (post) => {
  if (!post) return "";
  return String(post.content || post.card_caption || post.caption || "Posted from Xeevia").trim();
};

async function publishToX(accessToken, post) {
  const text = toText(post);
  const payload = { text: text || "Posted from Xeevia" };
  const response = await fetch("https://api.twitter.com/2/tweets", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    throw new Error(`X publish failed: ${errorData?.errors?.[0]?.message || response.status}`);
  }

  const data = await response.json();
  return data.data?.id || `x:${Date.now()}`;
}

async function verifyXToken(accessToken) {
  const response = await fetch("https://api.twitter.com/2/users/me", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    throw new Error(`X token verify failed: ${errorData?.errors?.[0]?.message || response.status}`);
  }
  const data = await response.json();
  return data.data?.id || `x:${Date.now()}`;
}

async function verifyFacebookToken(accessToken) {
  const response = await fetch(`https://graph.facebook.com/me?fields=id,name&access_token=${encodeURIComponent(accessToken)}`);
  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    throw new Error(`Facebook token verify failed: ${errorData?.error?.message || response.status}`);
  }
  return (await response.json()).id;
}

async function verifyLinkedInToken(accessToken) {
  const response = await fetch("https://api.linkedin.com/v2/me", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    throw new Error(`LinkedIn token verify failed: ${errorData?.message || response.status}`);
  }
  const data = await response.json();
  return data.id || `linkedin:${Date.now()}`;
}

async function verifyInstagramToken(accessToken) {
  const response = await fetch(`https://graph.facebook.com/me?fields=id,name&access_token=${encodeURIComponent(accessToken)}`);
  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    throw new Error(`Instagram token verify failed: ${errorData?.error?.message || response.status}`);
  }
  const data = await response.json();
  return data.id || `instagram:${Date.now()}`;
}

serve(async (req) => {
  if (req.method !== "POST") return err("Method not allowed", 405);

  const userId = await getAuthUser(req);
  if (!userId) return err("Unauthorized", 401);

  let body = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const { postId, platform, verifyOnly = false } = body || {};
  if (!platform) return err("platform is required", 400);
  if (!verifyOnly && !postId) return err("postId is required unless verifyOnly=true", 400);

  try {
    let post = null;
    if (!verifyOnly) {
      const { data: postData, error: postErr } = await db
        .from("posts")
        .select("id,user_id,content,card_caption,caption,image_metadata,video_metadata")
        .eq("id", postId)
        .single();
      if (postErr) return err(postErr.message, 500);
      if (!postData || postData.user_id !== userId) return err("Unauthorized to publish this post", 403);
      post = postData;
    }

    const { data: connection, error: connErr } = await db
      .from("connections")
      .select("id,provider,platform_user_id,auth_status")
      .eq("user_id", userId)
      .eq("provider", platform)
      .eq("auth_status", "active")
      .maybeSingle();

    if (connErr) return err(connErr.message, 500);
    if (!connection) return err(`No active connection for platform ${platform}`, 404);

    const { data: tokenRow, error: tokenErr } = await db
      .from("tokens")
      .select("encrypted_token, revoked")
      .eq("connection_id", connection.id)
      .eq("revoked", false)
      .maybeSingle();

    if (tokenErr) return err(tokenErr.message, 500);
    if (!tokenRow) return err("Token not found for connection", 404);

    let accessToken = tokenRow.encrypted_token;
    if (accessToken instanceof Uint8Array || accessToken instanceof ArrayBuffer) {
      accessToken = await decryptString(new Uint8Array(accessToken));
    } else if (typeof accessToken === "string") {
      try {
        accessToken = await decryptString(accessToken);
      } catch {
        // keep the raw token if it is already plaintext or not encrypted
      }
    }

    if (verifyOnly) {
      let externalId;
      switch (platform) {
        case "x":
          externalId = await verifyXToken(accessToken);
          break;
        case "facebook":
          externalId = await verifyFacebookToken(accessToken);
          break;
        case "instagram":
          externalId = await verifyInstagramToken(accessToken);
          break;
        case "linkedin":
          externalId = await verifyLinkedInToken(accessToken);
          break;
        default:
          return err(`Unsupported platform: ${platform}`, 400);
      }
      return json({ ok: true, platform, verified: true, externalId, mode: "verify" });
    }

    let externalId;
    let result;
    try {
      switch (platform) {
        case "x":
          externalId = await publishToX(accessToken, post);
          result = { status: "success", externalId };
          break;
        case "facebook":
          externalId = await verifyFacebookToken(accessToken);
          result = { status: "verified", externalId };
          break;
        case "instagram":
          externalId = await verifyInstagramToken(accessToken);
          result = { status: "verified", externalId };
          break;
        case "linkedin":
          externalId = await verifyLinkedInToken(accessToken);
          result = { status: "verified", externalId };
          break;
        default:
          return err(`Unsupported platform: ${platform}`, 400);
      }
    } catch (publishError) {
      console.warn("publish-platform error", publishError);
      return json({ ok: false, error: publishError.message, platform, postId }, 502);
    }

    return json({ ok: true, platform, postId, ...result });
  } catch (error) {
    console.error("publish-platform error", error);
    return err(String(error), 500);
  }
});
