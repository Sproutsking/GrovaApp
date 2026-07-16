// ============================================================================
// src/services/auth/authService.js — v13 IRON-CLAD
// ============================================================================
//
// CHANGES FROM v12:
//   [1] signOut() now uses scope:"local" — only ends THIS device's session.
//       scope:"global" killed every session on every device simultaneously.
//       signOutAllDevices() is now a separate explicit method.
//   [2] Google OAuth gets access_type:"offline" — ensures a refresh token
//       is always issued. Without this, Google may not send a refresh token
//       on re-auth, resulting in a session that can't be silently refreshed.
//   [3] getCurrentUser() has a fallback to getSession() if getUser() fails,
//       so we always return whatever user data we can find.
// ============================================================================

import { supabase } from "../config/supabase";
import { getSupabaseProjectAnonKey, getSupabaseProjectUrl } from "../supabase/projectConfig";

class AuthService {
  async getSession() {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      return session ?? null;
    } catch { return null; }
  }

  async getCurrentUser() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) return user;
      // Fallback: getSession uses cached data and doesn't require a server call
      const { data: { session } } = await supabase.auth.getSession();
      return session?.user ?? null;
    } catch {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        return session?.user ?? null;
      } catch { return null; }
    }
  }

  async signInOAuth(provider) {
    const supported = ["google", "x", "facebook", "tiktok", "discord"];
    // Backwards-compatible: older callers expect to just pass the provider
    // string. New callers can pass an object: { provider, usePopup: true }.
    let usePopup = false;
    if (typeof provider === "object" && provider !== null) {
      usePopup = !!provider.usePopup;
      provider = provider.provider || provider.id;
    }

    if (!supported.includes(provider)) throw new Error(`Unsupported provider: ${provider}`);

    const redirectTo = `${window.location.origin}/auth/callback`;
    const options = { redirectTo, skipBrowserRedirect: false };

    switch (provider) {
      case "google":
        // access_type:"offline" ensures a refresh token is always issued.
        // Without this, Google may not provide a refresh token on subsequent
        // sign-ins, which means sessions can't be silently refreshed.
        options.queryParams = { access_type: "offline", prompt: "select_account" };
        break;
      case "x":
        options.scopes = "tweet.read users.read";
        break;
      case "facebook":
        options.scopes = "email,public_profile";
        break;
      case "tiktok":
        options.scopes = "user.info.basic";
        break;
      case "discord":
        options.scopes = "identify email";
        break;
    }

    // If caller requested the popup-based flow, open a controlled popup that
    // performs the OAuth dance in its own context, then POSTs the session
    // tokens back to the opener. This keeps the main window from being full
    // page-redirected and allows a smooth sign-in without losing state.
    if (usePopup) {
      return await this._signInWithPopup(provider, options);
    }

    const { error } = await supabase.auth.signInWithOAuth({ provider, options, flowType: "pkce" });
    if (error) throw error;
    return true;
  }

  // ── Popup OAuth helper ───────────────────────────────────────────────
  // Opens a small popup, injects minimal HTML that uses the Supabase client
  // to run `signInWithOAuth(...)`. When the popup obtains a session it
  // posts the session object back to `window.opener` using postMessage.
  // The main window receives the message and calls `supabase.auth.setSession`
  // to establish the session locally.
  async _signInWithPopup(provider, options) {
    return new Promise((resolve, reject) => {
      try {
        const SUPA_URL = getSupabaseProjectUrl("identity") || window.__SUPABASE_URL__ || "";
        const SUPA_KEY = getSupabaseProjectAnonKey("identity") || "";
        const POPUP_W = 560;
        const POPUP_H = 700;

        const left = Math.round(window.screenX + (window.outerWidth - POPUP_W) / 2);
        const top = Math.round(window.screenY + (window.outerHeight - POPUP_H) / 2);
        const features = `width=${POPUP_W},height=${POPUP_H},left=${left},top=${top},toolbar=no,menubar=no,scrollbars=yes,resizable=yes`;

        const popup = window.open("about:blank", `xeevia_oauth_${provider}_${Date.now()}`, features);
        if (!popup || popup.closed) return reject(new Error("Popup was blocked"));

        // Listen for the popup's postMessage
        let overallTimeout;
        const onMessage = async (event) => {
          try {
            if (event.origin !== window.location.origin) return;
            const data = event.data || {};
            if (data?.type !== "XEEVIA_OAUTH_SIGNIN") return;

            window.removeEventListener("message", onMessage);
            if (overallTimeout) clearTimeout(overallTimeout);
            if (popup && !popup.closed) popup.close();

            const session = data.session;
            if (!session || !session.access_token) return reject(new Error("Invalid session returned from popup"));

            // Set the session in the main window using the refresh token + access token
            // supabase.auth.setSession expects { access_token, refresh_token }
            await supabase.auth.setSession({
              access_token: session.access_token,
              refresh_token: session.refresh_token,
            });

            resolve(true);
          } catch (err) {
            reject(err);
          }
        };

        window.addEventListener("message", onMessage);

        // Fallback timer: if popup doesn't respond, close it and fall back to
        // the traditional redirect flow in the main window so sign-in still works.
        overallTimeout = setTimeout(async () => {
          try {
            window.removeEventListener("message", onMessage);
            if (popup && !popup.closed) popup.close();
            console.warn('[AuthService] popup signin timed out — falling back to redirect');
            const { error } = await supabase.auth.signInWithOAuth({ provider, options, flowType: 'pkce' });
            if (error) return reject(error);
            resolve(true);
          } catch (e) {
            reject(e);
          }
        }, 65000); // 65s

        // Build popup HTML — minimal page that creates its own Supabase client
        // and runs signInWithOAuth. When the session is established it posts
        // the full session object back to the opener and then clears its
        // local session for safety.
        const popupHtml = `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>Sign in — ${provider}</title>
  <style>body{display:flex;align-items:center;justify-content:center;height:100vh;background:#080808;color:#e6e6e6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;margin:0;padding:20px;text-align:center} .logo{width:88px;height:88px;background:url(/logo512.png) center/cover no-repeat;border-radius:12px;margin-bottom:18px} .card{max-width:420px}</style>
</head>
<body>
  <div class="card">
    <div class="logo" aria-hidden></div>
    <div id="msg">Connecting to ${provider}…</div>
  </div>
  <script type="module">
    import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
    const sb = createClient('${SUPA_URL}', '${SUPA_KEY}', { auth: { persistSession: false, autoRefreshToken: false, storageKey: 'xeevia-auth-popup' } });

    (async function(){
      try{
        const { data: { session } } = await sb.auth.getSession();
        if (session && session.access_token) {
          // Already signed in inside popup — send session immediately
          window.opener?.postMessage({ type: 'XEEVIA_OAUTH_SIGNIN', session }, window.location.origin);
          // For safety: sign out this popup's local session
          await sb.auth.signOut({ scope: 'local' }).catch(()=>{});
          setTimeout(()=>window.close(),800);
          return;
        }

        // Start OAuth redirect inside the popup
        const { error } = await sb.auth.signInWithOAuth({ provider: '${provider}', options: ${JSON.stringify(options)}, flowType: 'pkce' });
        if (error) {
          document.getElementById('msg').textContent = 'Error: ' + (error.message || 'Sign-in failed');
        }

        // The popup will be redirected to the callback (pkce) which should
        // create a session in this popup context. We poll until getSession()
        // returns a session, then send it back to opener.
        const deadline = Date.now() + 60_000; // 60s timeout
        while (Date.now() < deadline) {
          try {
            const { data } = await sb.auth.getSession();
            if (data?.session && data.session.access_token) {
              const s = data.session;
              // Post the session to the opener (main window)
              if (window.opener && !window.opener.closed) {
                window.opener.postMessage({ type: 'XEEVIA_OAUTH_SIGNIN', session: s }, window.location.origin);
              }
              // Clear local popup session so we don't leave credentials in the popup
              await sb.auth.signOut({ scope: 'local' }).catch(()=>{});
              setTimeout(()=>window.close(),800);
              return;
            }
          } catch(e){}
          await new Promise(r=>setTimeout(r,400));
        }
        document.getElementById('msg').textContent = 'Timed out — please try again.';
      }catch(e){
        document.getElementById('msg').textContent = 'Unexpected error';
      }
    })();
  </script>
</body>
</html>`;

        // Write HTML synchronously into the popup (avoids popup blockers)
        popup.document.open();
        popup.document.write(popupHtml);
        popup.document.close();

      } catch (err) {
        reject(err);
      }
    });
  }

  async signInOTP(email) {
    const { error } = await supabase.auth.signInWithOtp({
      email:   email.trim().toLowerCase(),
      options: { shouldCreateUser: true },
    });
    if (error) throw error;
  }

  async verifyOTP(email, token) {
    const params = { email: email.trim().toLowerCase(), token: token.trim() };
    const { data, error: err1 } = await supabase.auth.verifyOtp({ ...params, type: "email" });
    if (!err1) return data?.user ?? null;
    const { data: d2, error: err2 } = await supabase.auth.verifyOtp({ ...params, type: "magiclink" });
    if (!err2) return d2?.user ?? null;
    throw new Error(err1?.message || "OTP verification failed. Please request a new code.");
  }

  // ── Local sign-out — ends THIS device's session only ─────────────────────
  // This is what your Sign Out button should call. It does NOT affect sessions
  // on other devices (phone, laptop, tablet etc).
  async signOut() {
    try {
      await supabase.auth.signOut({ scope: "local" });
    } catch (err) {
      console.warn("[AuthService] signOut error:", err?.message);
      // Manual cleanup as fallback
      try {
        const keys = Object.keys(localStorage).filter(k =>
          k.startsWith("sb-") || k.includes("supabase")
        );
        keys.forEach(k => localStorage.removeItem(k));
      } catch {}
    }
  }

  // ── Global sign-out — ends ALL sessions on ALL devices ───────────────────
  // Only call this from a deliberate "Sign out everywhere" settings action.
  // This invalidates the refresh token server-side, ending every session.
  async signOutAllDevices() {
    try {
      await supabase.auth.signOut({ scope: "global" });
    } catch (err) {
      console.warn("[AuthService] signOutAllDevices error:", err?.message);
      try { await supabase.auth.signOut({ scope: "local" }); } catch {}
    }
  }

  async checkAdminStatus(userId) {
    if (!userId) return null;
    try {
      const { data } = await supabase.from("profiles").select("is_admin").eq("id", userId).maybeSingle();
      return data?.is_admin ? { role: "admin" } : null;
    } catch { return null; }
  }

  async adminHas2FA() { return false; }
}

const authService = new AuthService();
export default authService;