// src/services/distribution/socialConnectService.js
// ============================================================================
// Social Platform Connection Service — v1
//
// This is the correct way to link external social accounts to Xeevia:
//
// HOW IT WORKS:
//   Users sign in to Xeevia via Google/X/Facebook/Discord OAuth.
//   Those same OAuth providers issue tokens we can store in `connections`.
//   OAuth connections use an isolated popup session; profile-only connectors
//   use validated public URLs. Neither flow changes the signed-in app session.
//
// ARCHITECTURE:
//   1. If user signed in via X → we already have an X token. Mark as connected.
//   2. OAuth providers → capture the provider identity and token in a popup.
//   3. `connections` table stores: user_id, provider, auth_status, platform_user_id
//   4. `tokens` table stores: connection_id, encrypted_token, expires_at, revoked
//
// SECURITY:
//   - Tokens stored in `tokens` table (not connections) for separation
//   - All postMessage validated against window.location.origin
//   - Popup OAuth uses sessionStorage and a nonce-bound same-origin callback
//   - Profile URLs are platform-host validated but explicitly not ownership proof
//
// NOTE ON REAL API KEYS:
//   Each platform requires a registered app with redirect URIs pointing
//   to your domain. Set these in your Supabase project OAuth settings.
//   For X: https://developer.x.com/
//   For Facebook/Instagram: https://developers.facebook.com/
//   For LinkedIn: https://developer.linkedin.com/
// ============================================================================

import { supabase } from "../config/supabase";
import { syncUserConnectorEvidence } from "../evidence/connectorService";

const POPUP_W = 520;
const POPUP_H = 620;

export function resolveProviderLinkState({ platform, identities = [], connections = {} } = {}) {
  const safeIdentities = Array.isArray(identities) ? identities : [];
  const currentConn = connections?.[platform] || null;

  const matchesProvider = (providerName) => {
    if (!providerName) return false;
    if (providerName === platform) return true;
    if (platform === "x" && providerName === "twitter") return true;
    return false;
  };

  const matchedIdentity = safeIdentities.find((identity) => matchesProvider(identity?.provider));
  const hasPublishingToken = currentConn?.hasValidToken === true;
  if (matchedIdentity && hasPublishingToken) {
    const platformUserId = matchedIdentity.identity_data?.user_name
      || matchedIdentity.identity_data?.preferred_username
      || matchedIdentity.identity_data?.email
      || matchedIdentity.identity_data?.sub
      || matchedIdentity.id
      || null;

    return {
      alreadyConnected: true,
      source: currentConn?.auth_status === "active" ? "connections_table" : "supabase_identity",
      connection: currentConn || null,
      platformUserId,
      identity: matchedIdentity,
    };
  }

  if (currentConn && currentConn.auth_status === "active" && hasPublishingToken) {
    return {
      alreadyConnected: true,
      source: "connections_table",
      connection: currentConn,
      platformUserId: currentConn.platform_user_id || null,
      identity: null,
    };
  }

  return {
    alreadyConnected: false,
    source: matchedIdentity ? "supabase_identity" : null,
    connection: currentConn || null,
    platformUserId: currentConn?.platform_user_id
      || matchedIdentity?.identity_data?.user_name
      || matchedIdentity?.identity_data?.preferred_username
      || matchedIdentity?.identity_data?.email
      || matchedIdentity?.identity_data?.sub
      || matchedIdentity?.id
      || null,
    identity: matchedIdentity || null,
  };
}

// ── Platform OAuth configs ───────────────────────────────────────────────────
// These are standard OAuth scopes needed for posting
const PLATFORM_CONFIGS = {
  x: {
    provider: "x",
    scopes:   "tweet.read tweet.write users.read offline.access",
    label:    "X (Twitter)",
  },
  google: {
    provider: "google",
    scopes: "openid email profile",
    label: "Google",
  },
  discord: {
    provider: "discord",
    scopes: "identify email guilds",
    label: "Discord",
  },
  facebook: {
    provider: "facebook",
    scopes:   "email public_profile pages_show_list pages_read_engagement pages_manage_posts",
    label:    "Facebook",
  },
  instagram: {
    // Instagram uses Facebook's OAuth
    provider:      "facebook",
    scopes:        "email public_profile pages_show_list pages_read_engagement instagram_basic instagram_content_publish",
    label:         "Instagram",
    subPlatform:   true,  // needs extra step to get IG account ID
  },
  linkedin: {
    provider: "linkedin_oidc",
    scopes:   "openid profile email w_member_social",
    label:    "LinkedIn",
  },
  github: {
    provider: "github",
    scopes: "read:user user:email",
    label: "GitHub",
  },
  gitlab: {
    provider: "gitlab",
    scopes: "read_user",
    label: "GitLab",
  },
  bitbucket: {
    provider: "bitbucket",
    scopes: "account email",
    label: "Bitbucket",
  },
  figma: {
    provider: "figma",
    scopes: "current_user:read",
    label: "Figma",
  },
  notion: {
    provider: "notion",
    scopes: "",
    label: "Notion",
  },
  apple: {
    provider: "apple",
    scopes: "name email",
    label: "Apple",
  },
  twitch: {
    provider: "twitch",
    scopes: "user:read:email",
    label: "Twitch",
  },
  spotify: {
    provider: "spotify",
    scopes: "user-read-private user-read-email user-top-read user-follow-read",
    label: "Spotify",
  },
};

const READ_ONLY_SCOPES = {
  x: "tweet.read users.read offline.access",
  facebook: "email public_profile",
  instagram: "email public_profile instagram_basic",
  linkedin: "openid profile email",
  twitch: "user:read:email",
  spotify: "user-read-private user-read-email",
};

export function getPlatformConfig(platform, options = {}) {
  const baseConfig = PLATFORM_CONFIGS[platform];
  if (!baseConfig) return null;
  return options.readOnly
    ? { ...baseConfig, scopes: READ_ONLY_SCOPES[platform] || baseConfig.scopes }
    : baseConfig;
}

const PROFILE_HOSTS = {
  wallet: ["etherscan.io", "solscan.io", "polygonscan.com", "bscscan.com"],
  youtube: ["youtube.com", "youtu.be"],
  tiktok: ["tiktok.com"],
  snapchat: ["snapchat.com"],
  threads: ["threads.net"],
  pinterest: ["pinterest.com"],
  reddit: ["reddit.com"],
  telegram: ["t.me", "telegram.me"],
  twitch: ["twitch.tv"],
  kick: ["kick.com"],
  roblox: ["roblox.com"],
  steam: ["steamcommunity.com"],
  xbox: ["xbox.com"],
  playstation: ["playstation.com"],
  epic: ["epicgames.com"],
  spotify: ["spotify.com"],
  substack: ["substack.com"],
};

export function validateProfileUrl(platform, value) {
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error("Enter a valid public profile URL.");
  }
  if (parsed.protocol !== "https:") throw new Error("Use a secure HTTPS profile link.");
  const hosts = PROFILE_HOSTS[platform];
  if (!hosts) throw new Error(`Profile links are not configured for ${platform}.`);
  const hostname = parsed.hostname.toLowerCase().replace(/^www\./, "");
  if (!hosts.some((host) => hostname === host || hostname.endsWith(`.${host}`))) {
    throw new Error(`Use a profile URL from ${hosts.join(", ")}.`);
  }
  if (parsed.pathname === "/" || parsed.pathname.length < 2) {
    throw new Error("Enter a link to a specific public profile, channel, or account.");
  }
  parsed.hash = "";
  return parsed.toString();
}

class SocialConnectService {

  // ── Check if user already has a linked identity for this provider ─────────
  // When user signs in via X, Supabase already has an X identity attached.
  // We can extract that token and store it in connections automatically.
  async checkAndImportExistingIdentities(userId) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { data: { session } } = await supabase.auth.getSession();
      if (!user?.identities) return {};

      const imported = {};

      if (user.email) {
        const { data: emailConnection } = await supabase
          .from("connections")
          .upsert({
            user_id: userId,
            provider: "email",
            platform_user_id: user.email,
            auth_status: "active",
            connected_via: "supabase_auth",
          }, { onConflict: "user_id,provider" })
          .select()
          .maybeSingle();
        if (emailConnection) imported.email = true;
      }

      for (const identity of user.identities) {
        const provider = identity.provider;
        // Map Supabase providers to our platform keys
        const platformKey = this._providerToPlatform(provider);
        if (!platformKey) continue;

        // Check if we already have this connection
        const { data: existing } = await supabase
          .from("connections")
          .select("id, auth_status")
          .eq("user_id", userId)
          .eq("provider", platformKey)
          .maybeSingle();

        const sessionProvider = session?.user?.app_metadata?.provider;
        const providerToken = sessionProvider === identity.provider ? session?.provider_token : null;
        if (!existing || existing.auth_status !== "active") {
          // Create/update the connection record
          const platformUserId = identity.identity_data?.user_name
            || identity.identity_data?.preferred_username
            || identity.identity_data?.sub
            || identity.id;

          const { data: conn } = await supabase
            .from("connections")
            .upsert({
              user_id:          userId,
              provider:         platformKey,
              platform_user_id: platformUserId,
              auth_status:      providerToken ? "active" : "expired",
              connected_via:    "supabase_identity",
            }, { onConflict: "user_id,provider" })
            .select()
            .maybeSingle();

          if (conn) {
            if (providerToken) {
              const { error: tokenError } = await supabase.from("tokens").upsert({
                connection_id: conn.id,
                encrypted_token: providerToken,
                refresh_token: session.provider_refresh_token || null,
                expires_at: null,
                revoked: false,
              }, { onConflict: "connection_id" });
              if (tokenError) throw tokenError;
              imported[platformKey] = true;
            }
            if (providerToken) try {
              const { syncUserConnectorEvidence } = await import("../evidence/connectorService");
              await syncUserConnectorEvidence(userId, platformKey).catch((err) => {
                console.warn(`[SocialConnect] Evidence sync failed for imported ${platformKey}:`, err?.message);
              });
            } catch (importErr) {
              console.warn("[SocialConnect] Evidence service not available:", importErr?.message);
            }
          }
        } else if (existing.auth_status === "active") {
          if (providerToken && existing.id) {
            const { error: tokenError } = await supabase.from("tokens").upsert({
              connection_id: existing.id,
              encrypted_token: providerToken,
              refresh_token: session.provider_refresh_token || null,
              expires_at: null,
              revoked: false,
            }, { onConflict: "connection_id" });
            if (tokenError) throw tokenError;
          }
          imported[platformKey] = true;
        }
      }

      return imported;
    } catch (err) {
      console.warn("[SocialConnect] importIdentities:", err?.message);
      return {};
    }
  }

  // ── Open OAuth popup to link a new platform ───────────────────────────────
  async linkPlatform(userId, platform, options = {}) {
    const config = getPlatformConfig(platform, options);
    if (!config) throw new Error(`Unknown platform: ${platform}`);

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user || user.id !== userId) throw new Error("Your session expired. Sign in again before linking an account.");

    const connectionMap = await this.getConnections(userId);
    const linkedState = resolveProviderLinkState({
      platform,
      identities: user.identities || [],
      connections: connectionMap,
    });

    if (linkedState.alreadyConnected) {
      const platformUserId = linkedState.platformUserId || connectionMap[platform]?.platform_user_id || user.email || user.id;
      const { error } = await supabase
        .from("connections")
        .upsert({
          user_id: userId,
          provider: platform,
          platform_user_id: platformUserId,
          auth_status: "active",
          connected_via: linkedState.source || "supabase_identity",
        }, { onConflict: "user_id,provider" });
      if (error) throw new Error(`The ${config.label} connection could not be confirmed: ${error.message}`);
      return { redirecting: false, alreadyConnected: true, platform };
    }

    return this._openOAuthPopup(userId, platform, config, options.popup);
  }

  _openOAuthPopup(userId, platform, config, existingPopup = null) {
    return new Promise((resolve, reject) => {
      const nonce = crypto.randomUUID();
      const popup = existingPopup || (() => {
        const left = Math.round(window.screenX + (window.outerWidth - POPUP_W) / 2);
        const top = Math.round(window.screenY + (window.outerHeight - POPUP_H) / 2);
        const features = `width=${POPUP_W},height=${POPUP_H},left=${left},top=${top},toolbar=no,menubar=no,scrollbars=yes`;
        return window.open("about:blank", `xeevia_link_${platform}`, features);
      })();
      if (!popup || popup.closed) {
        reject(new Error("Popup was blocked. Please allow popups for this site."));
        return;
      }

      popup.document.open();
      popup.document.write(this._buildLinkPopupHTML(platform, config, nonce));
      popup.document.close();

      let completed = false;
      const channel = typeof BroadcastChannel === "function"
        ? new BroadcastChannel(`xeevia-social-link-${nonce}`)
        : null;
      const cleanup = () => {
        window.removeEventListener("message", onMessage);
        channel?.removeEventListener("message", onChannelMessage);
        channel?.close();
        clearInterval(pollInterval);
      };
      const handlePayload = async (payload) => {
        if (completed || payload?.type !== "XEEVIA_SOCIAL_LINKED"
          || payload?.platformKey !== platform || payload?.nonce !== nonce) return;
        completed = true;
        cleanup();

        if (payload.error) {
          reject(new Error(payload.error));
          return;
        }
        if (typeof payload.accessToken !== "string" || !payload.accessToken) {
          reject(new Error(`The ${config.label} provider did not return a publishing token.`));
          return;
        }

        try {
          await this._storeConnection(
            userId,
            platform,
            payload.platformUserId,
            payload.accessToken,
            payload.refreshToken,
          );
          await syncUserConnectorEvidence(userId, platform).catch((error) => {
            console.warn(`[SocialConnect] Evidence sync failed for ${platform}:`, error?.message);
          });
          resolve({ platform, platformUserId: payload.platformUserId });
        } catch (error) {
          reject(error);
        }
      };
      const onMessage = (event) => {
        if (event.origin !== window.location.origin || event.source !== popup) return;
        handlePayload(event.data);
      };
      const onChannelMessage = (event) => {
        handlePayload(event.data);
      };

      window.addEventListener("message", onMessage);
      channel?.addEventListener("message", onChannelMessage);
      const pollInterval = setInterval(() => {
        if (!popup.closed) return;
        cleanup();
        reject(new Error("Sign-in was cancelled."));
      }, 600);
    });
  }

  async saveProfileLink(userId, platform, profileUrl) {
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user || user.id !== userId) throw new Error("Your session expired. Sign in again before linking a profile.");
    const normalizedUrl = validateProfileUrl(platform, profileUrl);
    const { error } = await supabase.from("connections").upsert({
      user_id: userId,
      provider: platform,
      platform_user_id: normalizedUrl,
      auth_status: "active",
      connected_via: "profile_link",
    }, { onConflict: "user_id,provider" });
    if (error) throw new Error(`Failed to save profile link: ${error.message}`);
    await syncUserConnectorEvidence(userId, platform).catch((syncError) => {
      console.warn(`[SocialConnect] Connection proof sync failed for ${platform}:`, syncError?.message);
    });
    return { platform, profileUrl: normalizedUrl, ownershipVerified: false };
  }

  // ── Store connection and token in database ────────────────────────────────
  async _storeConnection(userId, platform, platformUserId, accessToken, refreshToken) {
    if (typeof accessToken !== "string" || !accessToken) {
      throw new Error(`The ${platform} provider did not return a publishing token.`);
    }
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || user?.id !== userId) throw new Error("Your session changed while linking this platform. Please try again.");

    // Upsert connection record
    const { data: conn, error: connErr } = await supabase
      .from("connections")
      .upsert({
        user_id:          userId,
        provider:         platform,
        platform_user_id: platformUserId,
        auth_status:      "active",
        connected_via:    "oauth_popup",
      }, { onConflict: "user_id,provider" })
      .select()
      .single();

    if (connErr) throw new Error(`Failed to save connection: ${connErr.message}`);

    if (!conn?.id) throw new Error("The platform connection could not be saved.");
    const tokenValues = {
      connection_id: conn.id,
      encrypted_token: accessToken,
      refresh_token: refreshToken || null,
      expires_at: null,
      revoked: false,
    };
    const { data: existingToken, error: tokenLookupError } = await supabase
      .from("tokens")
      .select("id")
      .eq("connection_id", conn.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (tokenLookupError) {
      throw new Error(`The ${platform} connection was created, but its publishing token could not be checked: ${tokenLookupError.message}`);
    }

    const { error: tokenError } = existingToken?.id
      ? await supabase.from("tokens").update(tokenValues).eq("id", existingToken.id)
      : await supabase.from("tokens").insert(tokenValues);
    if (tokenError) throw new Error(`The ${platform} connection was created, but its publishing token could not be saved: ${tokenError.message}`);

    return conn;
  }

  // ── Disconnect a platform ─────────────────────────────────────────────────
  async unlinkPlatform(userId, platform) {
    const { data: conn } = await supabase
      .from("connections")
      .select("id")
      .eq("user_id", userId)
      .eq("provider", platform)
      .maybeSingle();

    if (conn?.id) {
      // Revoke tokens
      await supabase
        .from("tokens")
        .update({ revoked: true })
        .eq("connection_id", conn.id);
    }

    // Mark connection as revoked
    const { error } = await supabase
      .from("connections")
      .update({ auth_status: "revoked" })
      .eq("user_id", userId)
      .eq("provider", platform);

    if (error) throw new Error(`Failed to unlink: ${error.message}`);
    return true;
  }

  // ── Get all connections for a user ────────────────────────────────────────
  async getConnections(userId) {
    let map = {};
    try {
      const { data, error } = await supabase
        .from("connections")
        .select("id, provider, platform_user_id, auth_status, connected_via")
        .eq("user_id", userId);

      if (error) throw error;
      const connections = data || [];
      const connectionIds = connections.map((connection) => connection.id).filter(Boolean);
      const { data: tokens, error: tokenError } = connectionIds.length
        ? await supabase
          .from("tokens")
          .select("connection_id, encrypted_token, expires_at")
          .in("connection_id", connectionIds)
          .eq("revoked", false)
        : { data: [], error: null };
      if (tokenError) throw tokenError;
      const now = Date.now();
      const validTokenConnections = new Set((tokens || [])
        .filter((token) => Boolean(token.encrypted_token)
          && (!token.expires_at || new Date(token.expires_at).getTime() > now))
        .map((token) => token.connection_id));
      connections.forEach((connection) => {
        map[connection.provider] = {
          ...connection,
          hasValidToken: validTokenConnections.has(connection.id),
        };
      });
    } catch (error) {
      console.warn("[SocialConnect] Unable to verify publishing credentials:", error?.message);
    }

    // An Auth identity proves sign-in linkage only; it does not prove that a
    // usable platform publishing token exists.
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user?.id === userId) {
        for (const identity of user.identities || []) {
          const platform = this._providerToPlatform(identity.provider);
          if (!platform) continue;
          const platformUserId = identity.identity_data?.user_name
            || identity.identity_data?.preferred_username
            || identity.identity_data?.email
            || identity.identity_data?.sub
            || identity.id;
          const avatarUrl = identity.identity_data?.avatar_url
            || identity.identity_data?.profile_image_url
            || identity.identity_data?.picture
            || identity.identity_data?.image
            || null;
          map[platform] = {
            ...map[platform],
            provider: platform,
            platform_user_id: map[platform]?.platform_user_id || platformUserId,
            avatarUrl: map[platform]?.avatarUrl || avatarUrl,
            auth_status: map[platform]?.auth_status || "expired",
            hasValidToken: map[platform]?.hasValidToken === true,
            connected_via: map[platform]?.connected_via || "supabase_identity",
          };
        }
      }
    } catch {
      // Keep database-backed connections if auth metadata is unavailable.
    }

    return map;
  }

  // ── Map Supabase provider names to our platform keys ─────────────────────
  _providerToPlatform(provider) {
    const map = {
      x:             "x",
      twitter:       "x",
      facebook:      "facebook",
      google:        "google",
      discord:       "discord",
      twitch:        "twitch",
      spotify:       "spotify",
      linkedin_oidc: "linkedin",
      github:        "github",
      gitlab:        "gitlab",
      bitbucket:     "bitbucket",
      figma:         "figma",
      notion:        "notion",
      apple:         "apple",
      tiktok:        "tiktok",
      // Instagram shares Facebook's OAuth
    };
    return map[provider] || null;
  }

  // ── Build popup HTML for the OAuth link flow ──────────────────────────────
  _buildLinkPopupHTML(platform, config, nonce) {
    const SUPA_URL = process.env.REACT_APP_SUPABASE_URL || "";
    const SUPA_KEY = process.env.REACT_APP_SUPABASE_ANON_KEY || "";
    const origin   = window.location.origin;
    const callbackUrl = `${origin}/auth-social-callback.html`;
    const storageKey = `xeevia-social-link-${platform}`;
    const safeNonce = JSON.stringify(nonce);

    const platformIcons = {
      x:         "𝕏",
      facebook:  "f",
      instagram: "✦",
      linkedin:  "in",
    };

    const platformColors = {
      x:         "#e2e2e2",
      facebook:  "#5b9ef9",
      instagram: "#f472b6",
      linkedin:  "#60a5fa",
    };

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <title>Connect ${config.label}</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{
      background:#080808;color:#e0e0e0;
      font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
      display:flex;flex-direction:column;align-items:center;
      justify-content:center;min-height:100vh;gap:16px;
      text-align:center;padding:24px;
    }
    .logo{font-size:calc((28px) + 1px);font-weight:900;letter-spacing:-1px;
      background:linear-gradient(135deg,#a3e635,#4d7c0f);
      -webkit-background-clip:text;-webkit-text-fill-color:transparent;
      margin-bottom:4px;
    }
    .platform-icon{
      width:64px;height:64px;border-radius:16px;
      background:${platformColors[platform] || "#666"}18;
      border:2px solid ${platformColors[platform] || "#666"}40;
      display:flex;align-items:center;justify-content:center;
      font-size:calc((28px) + 1px);font-weight:900;color:${platformColors[platform] || "#fff"};
      margin:0 auto 8px;
    }
    .title{font-size:calc((18px) + 1px);font-weight:800;color:#f0f0f0;margin-bottom:6px;}
    .sub{font-size:calc((12px) + 1px);color:#555;margin-bottom:24px;line-height:1.6;}
    .spinner{
      width:40px;height:40px;border-radius:50%;
      border:3px solid rgba(163,230,53,.15);
      border-top-color:#a3e635;
      animation:spin .7s linear infinite;
    }
    @keyframes spin{to{transform:rotate(360deg)}}
    .status{font-size:calc((13px) + 1px);color:#555;margin-top:8px}
    .err{color:#ef4444;font-size:calc((13px) + 1px);max-width:300px;line-height:1.6}
    .btn{
      padding:12px 28px;border-radius:12px;border:none;
      background:linear-gradient(135deg,#a3e635,#65a30d);
      color:#040a00;font-size:calc((14px) + 1px);font-weight:800;
      cursor:pointer;font-family:inherit;margin-top:16px;
    }
    .note{font-size:calc((10px) + 1px);color:#2a2a2a;margin-top:8px;max-width:280px;line-height:1.6;}
  </style>
</head>
<body>
  <div class="logo">XEEVIA</div>
  <div class="platform-icon">${platformIcons[platform] || "?"}</div>
  <div class="title">Connect ${config.label}</div>
  <div class="sub">Authorize Xeevia to connect this account.<br/>You can disconnect at any time.</div>
  <div class="spinner" id="sp"></div>
  <p class="status" id="msg">Starting authorization…</p>

  <script type="module">
    import{createClient}from'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

    const sb = createClient('${SUPA_URL}','${SUPA_KEY}',{
      auth:{persistSession:true,autoRefreshToken:false,storage:window.sessionStorage,storageKey:'${storageKey}',detectSessionInUrl:true}
    });

    const platform = '${platform}';
    const provider = '${config.provider}';
    const nonce = ${safeNonce};
    const origin = '${origin}';
    const notifyParent = (payload) => {
      if(window.opener&&!window.opener.closed){
        window.opener.postMessage(payload,origin);
      }
      if(typeof BroadcastChannel==='function'){
        const channel=new BroadcastChannel('xeevia-social-link-'+nonce);
        channel.postMessage(payload);
        channel.close();
      }
    };
    sessionStorage.setItem('xeevia-social-link-config-${platform}', JSON.stringify({
      url: '${SUPA_URL}',
      key: '${SUPA_KEY}',
    }));
    sessionStorage.setItem('xeevia-social-link-pending', JSON.stringify({ platform, nonce }));
    document.getElementById('msg').textContent='Opening ${config.label} authorization…';
    const{error}=await sb.auth.signInWithOAuth({
      provider,
      options:{
        redirectTo:'${callbackUrl}',
        skipBrowserRedirect:false,
        scopes:'${config.scopes}',
        queryParams:{
          ${platform === "x" ? "force_login:'true'," : ""}
          ${platform === "facebook" ? "auth_type:'rerequest'," : ""}
          access_type:'offline',
        }
      }
    });
    if(error){
      document.getElementById('sp').style.display='none';
      document.getElementById('msg').className='err';
      document.getElementById('msg').textContent='Error: '+error.message;
      notifyParent({type:'XEEVIA_SOCIAL_LINKED',platformKey:platform,nonce,error:error.message});
      setTimeout(()=>window.close(),1200);
    }
  </script>
</body>
</html>`;
  }
}

export default new SocialConnectService();