// src/services/distribution/socialConnectService.js
// ============================================================================
// Social Platform Connection Service — v1
//
// This is the correct way to link external social accounts to Xeevia:
//
// HOW IT WORKS:
//   Users sign in to Xeevia via Google/X/Facebook/Discord OAuth.
//   Those same OAuth providers issue tokens we can store in `connections`.
//   For platforms where users didn't use that provider to sign up,
//   we open a popup OAuth flow specifically for *linking* (not signing in),
//   using Supabase's linkIdentity or a custom popup that gets an auth token
//   and posts it back via window.postMessage.
//
// ARCHITECTURE:
//   1. If user signed in via X → we already have an X token. Mark as connected.
//   2. For other platforms → open popup OAuth, capture token, store in connections.
//   3. `connections` table stores: user_id, provider, auth_status, platform_user_id
//   4. `tokens` table stores: connection_id, encrypted_token, expires_at, revoked
//
// SECURITY:
//   - Tokens stored in `tokens` table (not connections) for separation
//   - All postMessage validated against window.location.origin
//   - Popup completes OAuth in its own context, main session untouched
//
// NOTE ON REAL API KEYS:
//   Each platform requires a registered app with redirect URIs pointing
//   to your domain. Set these in your Supabase project OAuth settings.
//   For X: https://developer.twitter.com/
//   For Facebook/Instagram: https://developers.facebook.com/
//   For LinkedIn: https://developer.linkedin.com/
// ============================================================================

import { supabase } from "../config/supabase";

const POPUP_W = 520;
const POPUP_H = 620;

// ── Platform OAuth configs ───────────────────────────────────────────────────
// These are standard OAuth scopes needed for posting
const PLATFORM_CONFIGS = {
  x: {
    provider: "twitter",           // Supabase provider name
    scopes:   "tweet.read tweet.write users.read offline.access",
    label:    "X (Twitter)",
  },
  facebook: {
    provider: "facebook",
    scopes:   "email public_profile pages_show_list pages_read_engagement pages_manage_posts",
    label:    "Facebook",
  },
  instagram: {
    // Instagram uses Facebook's OAuth
    provider:      "facebook",
    scopes:        "email public_profile instagram_basic instagram_content_publish",
    label:         "Instagram",
    subPlatform:   true,  // needs extra step to get IG account ID
  },
  linkedin: {
    provider: "linkedin_oidc",
    scopes:   "openid profile email w_member_social",
    label:    "LinkedIn",
  },
};

class SocialConnectService {

  // ── Check if user already has a linked identity for this provider ─────────
  // When user signs in via X, Supabase already has an X identity attached.
  // We can extract that token and store it in connections automatically.
  async checkAndImportExistingIdentities(userId) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.identities) return {};

      const imported = {};

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
              auth_status:      "active",
              connected_via:    "supabase_identity",
            }, { onConflict: "user_id,provider" })
            .select()
            .maybeSingle();

          if (conn) {
            imported[platformKey] = true;
            try {
              const { syncUserConnectorEvidence } = await import("../evidence/connectorService");
              await syncUserConnectorEvidence(userId, platformKey).catch((err) => {
                console.warn(`[SocialConnect] Evidence sync failed for imported ${platformKey}:`, err?.message);
              });
            } catch (importErr) {
              console.warn("[SocialConnect] Evidence service not available:", importErr?.message);
            }
          }
        } else {
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
  async linkPlatform(userId, platform) {
    const config = PLATFORM_CONFIGS[platform];
    if (!config) throw new Error(`Unknown platform: ${platform}`);

    return new Promise((resolve, reject) => {
      // Position popup
      const left = Math.round(window.screenX + (window.outerWidth  - POPUP_W) / 2);
      const top  = Math.round(window.screenY + (window.outerHeight - POPUP_H) / 2);
      const features = `width=${POPUP_W},height=${POPUP_H},left=${left},top=${top},toolbar=no,menubar=no,scrollbars=yes`;

      const popup = window.open("about:blank", `xeevia_link_${platform}`, features);
      if (!popup || popup.closed) {
        reject(new Error("Popup was blocked. Please allow popups for this site."));
        return;
      }

      // Build the popup HTML
      const html = this._buildLinkPopupHTML(platform, config);
      popup.document.open();
      popup.document.write(html);
      popup.document.close();

      // Listen for postMessage result
      const onMessage = async (event) => {
        if (event.origin !== window.location.origin) return;
        if (event.data?.type !== "XEEVIA_SOCIAL_LINKED") return;

        window.removeEventListener("message", onMessage);
        clearInterval(pollInterval);

        const { platformKey, accessToken, refreshToken, platformUserId, error } = event.data;

        if (error) {
          reject(new Error(error));
          return;
        }

        try {
          // Store connection + token in DB
          await this._storeConnection(userId, platformKey, platformUserId, accessToken, refreshToken);

          try {
            const { syncUserConnectorEvidence } = await import("../evidence/connectorService");
            await syncUserConnectorEvidence(userId, platformKey).catch((err) => {
              console.warn(`[SocialConnect] Evidence sync failed for ${platformKey}:`, err?.message);
            });
          } catch (importErr) {
            console.warn("[SocialConnect] Evidence service not available:", importErr?.message);
          }

          resolve({ platform: platformKey, platformUserId });
        } catch (err) {
          reject(err);
        }
      };

      window.addEventListener("message", onMessage);

      // Poll for popup closure
      const pollInterval = setInterval(() => {
        if (popup?.closed) {
          clearInterval(pollInterval);
          window.removeEventListener("message", onMessage);
          reject(new Error("Sign-in was cancelled."));
        }
      }, 600);
    });
  }

  // ── Store connection and token in database ────────────────────────────────
  async _storeConnection(userId, platform, platformUserId, accessToken, refreshToken) {
    // Prefer storing tokens via the secure edge function which encrypts server-side.
    // If functions.invoke is unavailable (dev), fall back to the old direct DB upsert.
    try {
      const body = {
        provider: platform,
        platform_user_id: platformUserId,
        accessToken,
        refreshToken: refreshToken || null,
        expiresAt: (new Date(Date.now() + 60 * 60 * 1000)).toISOString(),
      };

      // If caller provided a connection id, include it so function can update instead of creating
      // (some code paths may pass connection_id explicitly)
      if (body.connection_id) body.connection_id = body.connection_id;

      const { data, error } = await supabase.functions.invoke("store-connection-token", { body });
      if (error) throw error;
      // function returns { ok: true, connection_id, token }
      if (data && data.connection_id) {
        try {
          const { data: verifyData, error: verifyError } = await supabase.functions.invoke("publish-platform", {
            body: { platform, verifyOnly: true },
          });
          if (verifyError) throw verifyError;
          if (!verifyData?.ok) throw new Error(verifyData?.error || "Token verification failed");
        } catch (verifyErr) {
          console.warn("[SocialConnect] verification failed after storage:", verifyErr?.message || verifyErr);
        }

        return {
          id: data.connection_id,
          provider: platform,
          platform_user_id: platformUserId,
          auth_status: "active",
          connected_via: "oauth_popup",
        };
      }

      throw new Error("store-connection-token did not return connection_id");
    } catch (fnErr) {
      console.warn("[SocialConnect] secure store failed, falling back to client upsert:", fnErr?.message || fnErr);

      // Fallback: older behavior — upsert connection and store token plainly
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

      if (accessToken && conn?.id) {
        const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
        await supabase
          .from("tokens")
          .upsert({
            connection_id:   conn.id,
            encrypted_token: accessToken,
            refresh_token:   refreshToken || null,
            expires_at:      expiresAt,
            revoked:         false,
          }, { onConflict: "connection_id" });
      }

      return conn;
    }
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
    try {
      const { data, error } = await supabase
        .from("connections")
        .select("provider, platform_user_id, auth_status, connected_via")
        .eq("user_id", userId);

      if (error?.code === "42P01") return {};
      if (error) return {};

      const map = {};
      (data || []).forEach(c => { map[c.provider] = c; });
      return map;
    } catch {
      return {};
    }
  }

  // ── Map Supabase provider names to our platform keys ─────────────────────
  _providerToPlatform(provider) {
    const map = {
      twitter:       "x",
      facebook:      "facebook",
      linkedin_oidc: "linkedin",
      // Instagram shares Facebook's OAuth
    };
    return map[provider] || null;
  }

  // ── Build popup HTML for the OAuth link flow ──────────────────────────────
  _buildLinkPopupHTML(platform, config) {
    const SUPA_URL = process.env.REACT_APP_SUPABASE_URL || "";
    const SUPA_KEY = process.env.REACT_APP_SUPABASE_ANON_KEY || "";
    const origin   = window.location.origin;
    const callbackUrl = `${origin}/auth/social-callback`;

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
    .logo{font-size:28px;font-weight:900;letter-spacing:-1px;
      background:linear-gradient(135deg,#a3e635,#4d7c0f);
      -webkit-background-clip:text;-webkit-text-fill-color:transparent;
      margin-bottom:4px;
    }
    .platform-icon{
      width:64px;height:64px;border-radius:16px;
      background:${platformColors[platform] || "#666"}18;
      border:2px solid ${platformColors[platform] || "#666"}40;
      display:flex;align-items:center;justify-content:center;
      font-size:28px;font-weight:900;color:${platformColors[platform] || "#fff"};
      margin:0 auto 8px;
    }
    .title{font-size:18px;font-weight:800;color:#f0f0f0;margin-bottom:6px;}
    .sub{font-size:12px;color:#555;margin-bottom:24px;line-height:1.6;}
    .spinner{
      width:40px;height:40px;border-radius:50%;
      border:3px solid rgba(163,230,53,.15);
      border-top-color:#a3e635;
      animation:spin .7s linear infinite;
    }
    @keyframes spin{to{transform:rotate(360deg)}}
    .status{font-size:13px;color:#555;margin-top:8px}
    .err{color:#ef4444;font-size:13px;max-width:300px;line-height:1.6}
    .btn{
      padding:12px 28px;border-radius:12px;border:none;
      background:linear-gradient(135deg,#a3e635,#65a30d);
      color:#040a00;font-size:14px;font-weight:800;
      cursor:pointer;font-family:inherit;margin-top:16px;
    }
    .note{font-size:10px;color:#2a2a2a;margin-top:8px;max-width:280px;line-height:1.6;}
  </style>
</head>
<body>
  <div class="logo">XEEVIA</div>
  <div class="platform-icon">${platformIcons[platform] || "?"}</div>
  <div class="title">Connect ${config.label}</div>
  <div class="sub">Authorize Xeevia to publish on your behalf.<br/>You can disconnect at any time.</div>
  <div class="spinner" id="sp"></div>
  <p class="status" id="msg">Starting authorization…</p>

  <script type="module">
    import{createClient}from'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

    const sb = createClient('${SUPA_URL}','${SUPA_KEY}',{
      auth:{persistSession:false,autoRefreshToken:false}
    });

    const platform = '${platform}';
    const provider = '${config.provider}';
    const origin   = '${origin}';

    // Check if we're returning from OAuth (session in URL hash)
    const{data:{session}}=await sb.auth.getSession();

    if(session?.user){
      // We have a session from the OAuth redirect — extract what we need
      document.getElementById('msg').textContent='Saving connection…';

      const identity = session.user.identities?.find(i=>i.provider===provider) || {};
      const platformUserId = identity.identity_data?.user_name
        || identity.identity_data?.preferred_username
        || identity.identity_data?.sub
        || session.user.id;

      // Get the provider token if available
      const accessToken = session.provider_token || session.access_token;
      const refreshToken = session.provider_refresh_token || null;

      // Sign out this popup session only
      await sb.auth.signOut({scope:'local'}).catch(()=>{});

      // Post result to main window
      if(window.opener&&!window.opener.closed){
        window.opener.postMessage({
          type:         'XEEVIA_SOCIAL_LINKED',
          platformKey:  platform,
          accessToken,
          refreshToken,
          platformUserId,
        }, origin);
        document.getElementById('sp').style.display='none';
        document.getElementById('msg').textContent='Connected! Closing…';
        setTimeout(()=>window.close(),800);
      }
    } else {
      // Initiate OAuth
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
        setTimeout(()=>window.close(),4000);
      }
    }
  </script>
</body>
</html>`;
  }
}

export default new SocialConnectService();