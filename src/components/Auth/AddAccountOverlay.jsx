// ============================================================================
// src/components/Auth/AddAccountOverlay.jsx — v2 WATER-FLOW
// ============================================================================
//
// THE CORE PROBLEM WITH THE OLD APPROACH:
//   signInWithOAuth() with skipBrowserRedirect:false does a FULL PAGE REDIRECT.
//   This wipes the current Supabase session from memory. Even with
//   scope:"local" signOut afterward, the main session was already gone.
//   The "SIGNED_IN" listener inside this component was catching the MAIN
//   user's re-auth after the redirect, not a second account.
//
// THE CORRECT APPROACH — POPUP WINDOW:
//   1. Open a small popup window that does the OAuth flow independently.
//   2. The popup completes auth in its OWN tab — main window session untouched.
//   3. The popup posts its result (userId, email, name, avatar) back to the
//      main window via window.postMessage.
//   4. We fetch the minimal profile from Supabase using the posted userId.
//   5. We save the account entry to localStorage WITHOUT ever touching the
//      main window's Supabase session.
//   6. Popup closes. Main session is exactly as it was.
//
// POPUP AUTH PAGE:
//   This component opens: /auth/add-account?provider=google (or x, discord)
//   That route renders <AddAccountCallback /> which:
//     a. Calls supabase.auth.signInWithOAuth() in the popup context
//     b. On SIGNED_IN, posts the user data to window.opener via postMessage
//     c. Calls supabase.auth.signOut({scope:"local"}) in the popup only
//     d. Closes itself
//
//   If your app doesn't have routing set up for this, see the INLINE POPUP
//   approach below — we inject the callback HTML directly into the popup.
//
// SECURITY:
//   postMessage is sent to window.location.origin only. The receiver
//   validates the origin before trusting any message.
//
// ============================================================================

import React, { useState, useEffect, useRef, useCallback } from "react";
import ReactDOM from "react-dom";
import { X, UserPlus, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { supabase } from "../../services/config/supabase";

const MAX_ACCOUNTS = 3;
const ACCOUNTS_KEY = "grova_saved_accounts";
const POPUP_W      = 520;
const POPUP_H      = 640;

// ── Storage helpers ───────────────────────────────────────────────────────────
export const loadAccounts = () => {
  try { return JSON.parse(localStorage.getItem(ACCOUNTS_KEY) || "[]"); }
  catch { return []; }
};
export const saveAccountsToStorage = (list) => {
  try { localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(list)); }
  catch {}
};

// ── Fetch minimal profile without affecting main session ──────────────────────
async function fetchMinimalProfile(userId) {
  try {
    const { data } = await supabase
      .from("profiles")
      .select("id,full_name,username,avatar_id,verified,is_pro")
      .eq("id", userId)
      .maybeSingle();
    return data;
  } catch { return null; }
}

// ── Build the popup callback HTML ─────────────────────────────────────────────
// This is injected into a blank popup window. It runs completely independently
// of the main window's Supabase session.
function buildPopupHTML(provider, supabaseUrl, supabaseAnonKey, redirectOrigin) {
  const callbackUrl = `${redirectOrigin}/auth/popup-callback`;

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <title>Connecting account…</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{
      background:#080808;
      color:#e0e0e0;
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
    .tagline{font-size:11px;color:#333;letter-spacing:3px;
      text-transform:uppercase;margin-bottom:24px}
    .spinner{
      width:40px;height:40px;border-radius:50%;
      border:3px solid rgba(163,230,53,.15);
      border-top-color:#a3e635;
      animation:spin .7s linear infinite;
    }
    @keyframes spin{to{transform:rotate(360deg)}}
    .status{font-size:14px;color:#555;margin-top:8px}
    .err{color:#ef4444;font-size:13px;max-width:300px;line-height:1.6}
  </style>
</head>
<body>
  <div class="logo">XEEVIA</div>
  <div class="tagline">Adding account</div>
  <div class="spinner" id="sp"></div>
  <p class="status" id="msg">Connecting to ${provider}…</p>
  <script type="module">
    import{createClient}from'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

    const sb = createClient('${supabaseUrl}','${supabaseAnonKey}',{
      auth:{persistSession:false,autoRefreshToken:false}
    });

    // Check if we already have a session (returned from OAuth redirect)
    const{data:{session}}=await sb.auth.getSession();

    if(session?.user){
      await finish(session.user);
    } else {
      // Initiate OAuth — this popup will redirect to provider then back here
      document.getElementById('msg').textContent='Opening ${provider} login…';
      const{error}=await sb.auth.signInWithOAuth({
        provider:'${provider}',
        options:{
          redirectTo:'${callbackUrl}',
          skipBrowserRedirect:false,
          ${provider === "google" ? "queryParams:{access_type:'offline',prompt:'select_account'}," : ""}
          ${provider === "x" ? "scopes:'tweet.read users.read'," : ""}
          ${provider === "discord" ? "scopes:'identify email'," : ""}
          ${provider === "facebook" ? "scopes:'email,public_profile'," : ""}
        }
      });
      if(error){
        document.getElementById('sp').style.display='none';
        document.getElementById('msg').className='err';
        document.getElementById('msg').textContent='Error: '+error.message;
        setTimeout(()=>window.close(),3000);
      }
    }

    async function finish(user){
      document.getElementById('msg').textContent='Saving account…';
      // Sign out in THIS popup only — doesn't affect main window
      await sb.auth.signOut({scope:'local'}).catch(()=>{});

      const payload={
        type:'XEEVIA_ACCOUNT_ADDED',
        user:{
          id:user.id,
          email:user.email||'',
          fullName:user.user_metadata?.full_name||user.user_metadata?.name||user.email?.split('@')[0]||'User',
          username:user.user_metadata?.user_name||user.user_metadata?.preferred_username||user.email?.split('@')[0]||'user',
          avatar:user.user_metadata?.avatar_url||user.user_metadata?.picture||null,
          provider:user.app_metadata?.provider||'oauth',
        }
      };

      // Post to main window
      if(window.opener&&!window.opener.closed){
        window.opener.postMessage(payload,'${redirectOrigin}');
        document.getElementById('msg').textContent='Account linked! Closing…';
        setTimeout(()=>window.close(),800);
      } else {
        // Opener was closed — store in localStorage as fallback
        try{
          const key='xeevia_pending_account';
          localStorage.setItem(key,JSON.stringify(payload.user));
        }catch(e){}
        document.getElementById('msg').textContent='Done! You can close this window.';
        setTimeout(()=>window.close(),1500);
      }
    }
  </script>
</body>
</html>`;
}

// ── Provider definitions ──────────────────────────────────────────────────────
const PROVIDERS = [
  {
    id:     "google",
    label:  "Continue with Google",
    color:  "#fff",
    bg:     "rgba(66,133,244,0.08)",
    border: "rgba(66,133,244,0.3)",
    hoverBg:"rgba(66,133,244,0.16)",
    Icon: () => (
      <svg width="20" height="20" viewBox="0 0 24 24">
        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
      </svg>
    ),
  },
  {
    id:     "x",
    label:  "Continue with X",
    color:  "#fff",
    bg:     "rgba(255,255,255,0.05)",
    border: "rgba(255,255,255,0.15)",
    hoverBg:"rgba(255,255,255,0.1)",
    Icon: () => (
      <svg width="19" height="19" viewBox="0 0 24 24" fill="white">
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.73-8.835L1.254 2.25H8.08l4.261 5.632 5.903-5.632zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
      </svg>
    ),
  },
  {
    id:     "discord",
    label:  "Continue with Discord",
    color:  "#fff",
    bg:     "rgba(88,101,242,0.1)",
    border: "rgba(88,101,242,0.35)",
    hoverBg:"rgba(88,101,242,0.2)",
    Icon: () => (
      <svg width="21" height="21" viewBox="0 0 24 24" fill="#5865F2">
        <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z"/>
      </svg>
    ),
  },
  {
    id:     "facebook",
    label:  "Continue with Facebook",
    color:  "#fff",
    bg:     "rgba(24,119,242,0.08)",
    border: "rgba(24,119,242,0.3)",
    hoverBg:"rgba(24,119,242,0.16)",
    Icon: () => (
      <svg width="21" height="21" viewBox="0 0 24 24" fill="#1877F2">
        <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
      </svg>
    ),
  },
];

// ── Spinner ───────────────────────────────────────────────────────────────────
const Spin = ({ size = 16, color = "#a3e635" }) => (
  <div style={{
    width: size, height: size, flexShrink: 0, borderRadius: "50%",
    border: `2px solid rgba(163,230,53,.15)`,
    borderTopColor: color,
    animation: "aaoSpin .65s linear infinite",
  }}/>
);

// ── Main Component ────────────────────────────────────────────────────────────
const AddAccountOverlay = ({ onClose, currentUserId }) => {
  const [step,        setStep]        = useState("pick");   // pick | waiting | success | error | blocked
  const [activeProvider, setActiveProvider] = useState(null);
  const [successEntry,setSuccessEntry]= useState(null);
  const [errorMsg,    setErrorMsg]    = useState("");
  const [accounts,    setAccounts]    = useState(() => loadAccounts());

  const popupRef    = useRef(null);
  const pollRef     = useRef(null);
  const mountedRef  = useRef(true);

  const atMax = accounts.length >= MAX_ACCOUNTS;

  // ── Supabase config (read from env) ──────────────────────────────────────
  const SUPA_URL = process.env.REACT_APP_SUPABASE_URL || "";
  const SUPA_KEY = process.env.REACT_APP_SUPABASE_ANON_KEY || "";

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      clearInterval(pollRef.current);
      if (popupRef.current && !popupRef.current.closed) {
        popupRef.current.close();
      }
    };
  }, []);

  // ── Listen for postMessage from popup ────────────────────────────────────
  useEffect(() => {
    const onMessage = async (event) => {
      // Security: only accept messages from our own origin
      if (event.origin !== window.location.origin) return;
      if (event.data?.type !== "XEEVIA_ACCOUNT_ADDED") return;

      clearInterval(pollRef.current);
      if (popupRef.current && !popupRef.current.closed) popupRef.current.close();

      const posted = event.data.user;
      if (!posted?.id) {
        setErrorMsg("Account data missing. Please try again.");
        setStep("error");
        return;
      }

      // Reject if this is the currently active user
      if (posted.id === currentUserId) {
        setErrorMsg("That's already your active account.");
        setStep("error");
        return;
      }

      // Enrich with fresh profile data from Supabase (safe — uses public client)
      const profile = await fetchMinimalProfile(posted.id);

      const entry = {
        id:       posted.id,
        email:    posted.email || "",
        fullName: profile?.full_name  || posted.fullName || "User",
        username: profile?.username   || posted.username || "user",
        avatar:   profile?.avatar_id
                    ? null  // AvatarDropdown will resolve via mediaUrlService
                    : posted.avatar || null,
        avatarId: profile?.avatar_id || null,
        verified: profile?.verified  || false,
        isPro:    profile?.is_pro    || false,
        provider: posted.provider    || "oauth",
        savedAt:  Date.now(),
      };

      const existing = loadAccounts();
      if (existing.find(a => a.id === entry.id)) {
        // Already saved — just update it
        const updated = existing.map(a => a.id === entry.id ? { ...a, ...entry } : a);
        saveAccountsToStorage(updated);
        setAccounts(updated);
      } else {
        const updated = [...existing, entry];
        saveAccountsToStorage(updated);
        setAccounts(updated);
      }

      if (!mountedRef.current) return;
      setSuccessEntry(entry);
      setStep("success");
    };

    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [currentUserId]);

  // ── Open popup ────────────────────────────────────────────────────────────
  const openPopup = useCallback((provider) => {
    if (atMax) return;

    // Position popup centered on screen
    const left = Math.round(window.screenX + (window.outerWidth  - POPUP_W) / 2);
    const top  = Math.round(window.screenY + (window.outerHeight - POPUP_H) / 2);
    const features = `width=${POPUP_W},height=${POPUP_H},left=${left},top=${top},toolbar=no,menubar=no,scrollbars=yes,resizable=yes`;

    // Open blank popup first (must be synchronous to avoid popup blockers)
    const popup = window.open("about:blank", "xeevia_add_account", features);

    if (!popup || popup.closed) {
      setErrorMsg("Popup was blocked. Please allow popups for this site and try again.");
      setStep("error");
      return;
    }

    popupRef.current = popup;
    setActiveProvider(provider.id);
    setStep("waiting");

    // Inject the auth HTML into the popup
    const html = buildPopupHTML(
      provider.id,
      SUPA_URL,
      SUPA_KEY,
      window.location.origin,
    );

    popup.document.open();
    popup.document.write(html);
    popup.document.close();

    // Poll for popup closure so we can show an error if user cancelled
    clearInterval(pollRef.current);
    pollRef.current = setInterval(() => {
      if (!popup || popup.closed) {
        clearInterval(pollRef.current);
        if (!mountedRef.current) return;
        // If we're still in "waiting" state, the user cancelled
        setStep(prev => {
          if (prev === "waiting") {
            setErrorMsg("Sign-in was cancelled or the popup closed.");
            return "error";
          }
          return prev;
        });
      }
    }, 600);
  }, [atMax, SUPA_URL, SUPA_KEY]);

  // ── Cancel / retry ────────────────────────────────────────────────────────
  const cancel = useCallback(() => {
    clearInterval(pollRef.current);
    if (popupRef.current && !popupRef.current.closed) popupRef.current.close();
    setStep("pick");
    setActiveProvider(null);
    setErrorMsg("");
  }, []);

  // ── Render ────────────────────────────────────────────────────────────────
  return ReactDOM.createPortal(
    <>
      <style>{`
        @keyframes aaoSpin    { to{transform:rotate(360deg)} }
        @keyframes aaoFadeIn  { from{opacity:0}to{opacity:1} }
        @keyframes aaoSlideUp {
          from{opacity:0;transform:translate(-50%,-46%) scale(0.93)}
          to  {opacity:1;transform:translate(-50%,-50%) scale(1)}
        }
        @keyframes aaoPop {
          0%  {transform:scale(0.6);opacity:0}
          65% {transform:scale(1.08)}
          100%{transform:scale(1);opacity:1}
        }
        @keyframes aaoShake {
          0%,100%{transform:translate(-50%,-50%) scale(1)}
          15%    {transform:translate(-52%,-50%) scale(1)}
          30%    {transform:translate(-48%,-50%) scale(1)}
          45%    {transform:translate(-52%,-50%) scale(1)}
          60%    {transform:translate(-48%,-50%) scale(1)}
        }
        @keyframes aaoPulse {
          0%,100%{opacity:.5;transform:scale(0.92)}
          50%    {opacity:1; transform:scale(1)}
        }

        .aao-backdrop {
          position:fixed;inset:0;background:rgba(0,0,0,0.9);
          backdrop-filter:blur(20px);z-index:999995;
          animation:aaoFadeIn 0.2s ease;
        }
        .aao-panel {
          position:fixed;top:50%;left:50%;
          transform:translate(-50%,-50%);
          z-index:999996;
          width:min(380px,calc(100vw - 28px));
          background:linear-gradient(145deg,#0e0e0e 0%,#0a0a0a 100%);
          border:1px solid rgba(163,230,53,0.15);
          border-radius:24px;overflow:hidden;
          box-shadow:
            0 40px 100px rgba(0,0,0,0.95),
            0 0 0 1px rgba(163,230,53,0.05),
            inset 0 1px 0 rgba(255,255,255,0.04);
          animation:aaoSlideUp 0.32s cubic-bezier(0.34,1.4,0.64,1);
          font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
        }
        .aao-panel.shake { animation:aaoShake 0.45s ease; }

        /* Header */
        .aao-header {
          display:flex;align-items:center;justify-content:space-between;
          padding:18px 20px 16px;
          background:rgba(163,230,53,0.03);
          border-bottom:1px solid rgba(255,255,255,0.05);
        }
        .aao-header-left { display:flex;align-items:center;gap:10px; }
        .aao-header-icon {
          width:32px;height:32px;border-radius:10px;
          background:rgba(163,230,53,0.1);
          border:1px solid rgba(163,230,53,0.2);
          display:flex;align-items:center;justify-content:center;
          flex-shrink:0;
        }
        .aao-header-title { font-size:15px;font-weight:800;color:#f0f0f0; }
        .aao-header-sub   { font-size:11px;color:#383838;font-weight:500;margin-top:1px; }
        .aao-close-btn {
          width:28px;height:28px;border-radius:8px;
          background:rgba(255,255,255,0.04);
          border:1px solid rgba(255,255,255,0.07);
          display:flex;align-items:center;justify-content:center;
          cursor:pointer;color:#555;transition:all 0.18s;flex-shrink:0;
        }
        .aao-close-btn:hover{background:rgba(255,255,255,0.09);color:#ccc;}

        /* Slot indicators */
        .aao-slots {
          display:flex;align-items:center;justify-content:center;
          gap:7px;padding:16px 20px 0;
        }
        .aao-slot {
          height:4px;border-radius:2px;
          transition:all 0.3s cubic-bezier(0.34,1.56,0.64,1);
          flex:1;max-width:60px;
        }
        .aao-slot.filled { background:linear-gradient(90deg,#a3e635,#65a30d); }
        .aao-slot.empty  { background:rgba(255,255,255,0.07); }
        .aao-slots-label {
          text-align:center;font-size:10px;color:#333;
          font-weight:600;letter-spacing:.5px;margin-top:6px;
          padding-bottom:16px;
        }

        /* Body */
        .aao-body { padding:16px 20px 20px; }

        /* Pick step */
        .aao-note {
          font-size:12px;color:#3a3a3a;line-height:1.65;
          text-align:center;margin-bottom:16px;
          padding:10px 14px;
          background:rgba(163,230,53,0.04);
          border:1px solid rgba(163,230,53,0.09);
          border-radius:12px;
        }
        .aao-note strong{color:#a3e635;}
        .aao-providers { display:flex;flex-direction:column;gap:9px; }

        .aao-provider-btn {
          display:flex;align-items:center;gap:13px;
          padding:13px 16px;border-radius:14px;
          border-width:1px;border-style:solid;
          font-size:14px;font-weight:700;
          cursor:pointer;transition:all 0.22s ease;
          text-align:left;position:relative;overflow:hidden;
        }
        .aao-provider-btn::after {
          content:'';position:absolute;inset:0;
          background:linear-gradient(105deg,transparent 40%,rgba(255,255,255,0.04) 50%,transparent 60%);
          opacity:0;transition:opacity 0.2s;
        }
        .aao-provider-btn:hover:not(:disabled)::after{opacity:1;}
        .aao-provider-btn:hover:not(:disabled){transform:translateY(-2px);}
        .aao-provider-btn:active:not(:disabled){transform:scale(0.97);}
        .aao-provider-btn:disabled{opacity:0.4;cursor:not-allowed;}

        .aao-p-icon {
          width:32px;height:32px;border-radius:9px;
          background:rgba(255,255,255,0.06);
          display:flex;align-items:center;justify-content:center;flex-shrink:0;
        }
        .aao-p-label{flex:1;color:#e0e0e0;}
        .aao-p-arrow{color:#333;font-size:16px;transition:transform 0.18s,color 0.18s;}
        .aao-provider-btn:hover .aao-p-arrow{color:#a3e635;transform:translateX(3px);}

        /* Waiting step */
        .aao-waiting {
          display:flex;flex-direction:column;align-items:center;
          gap:14px;padding:16px 0 8px;text-align:center;
        }
        .aao-waiting-ring {
          width:60px;height:60px;border-radius:50%;
          border:3px solid rgba(163,230,53,0.1);
          border-top-color:#a3e635;
          animation:aaoSpin .9s linear infinite;
          position:relative;
          display:flex;align-items:center;justify-content:center;
        }
        .aao-waiting-ring::after {
          content:'';position:absolute;inset:6px;border-radius:50%;
          border:2px solid rgba(163,230,53,0.08);
          border-bottom-color:rgba(163,230,53,0.4);
          animation:aaoSpin .6s linear infinite reverse;
        }
        .aao-waiting-title {font-size:15px;font-weight:800;color:#f0f0f0;}
        .aao-waiting-sub   {font-size:12px;color:#444;line-height:1.65;max-width:260px;}
        .aao-waiting-note  {
          font-size:11px;color:#2a2a2a;
          background:rgba(163,230,53,0.04);
          border:1px solid rgba(163,230,53,0.08);
          border-radius:10px;padding:8px 12px;
          width:100%;
        }

        /* Success step */
        .aao-success {
          display:flex;flex-direction:column;align-items:center;
          gap:10px;padding:8px 0;text-align:center;
        }
        .aao-success-ring {
          width:68px;height:68px;border-radius:50%;
          background:rgba(163,230,53,0.08);
          border:2px solid rgba(163,230,53,0.3);
          display:flex;align-items:center;justify-content:center;
          animation:aaoPop 0.45s cubic-bezier(0.34,1.56,0.64,1);
          box-shadow:0 0 30px rgba(163,230,53,0.2);
        }
        .aao-success-name {font-size:17px;font-weight:900;color:#fff;}
        .aao-success-user {font-size:13px;color:#a3e635;font-weight:600;}
        .aao-success-note {
          font-size:12px;color:#444;line-height:1.65;
          padding:10px 14px;background:rgba(163,230,53,0.04);
          border:1px solid rgba(163,230,53,0.1);border-radius:12px;
          width:100%;
        }
        .aao-success-note strong{color:#a3e635;}

        /* Error step */
        .aao-error-body {
          display:flex;flex-direction:column;align-items:center;
          gap:12px;padding:8px 0;text-align:center;
        }
        .aao-error-ring {
          width:60px;height:60px;border-radius:50%;
          background:rgba(239,68,68,0.08);
          border:2px solid rgba(239,68,68,0.3);
          display:flex;align-items:center;justify-content:center;
          animation:aaoPop 0.4s cubic-bezier(0.34,1.56,0.64,1);
        }
        .aao-error-title {font-size:15px;font-weight:800;color:#f87171;}
        .aao-error-msg   {font-size:12.5px;color:#555;line-height:1.65;max-width:280px;}

        /* Blocked (max accounts) */
        .aao-blocked {
          display:flex;flex-direction:column;align-items:center;
          gap:12px;padding:8px 0;text-align:center;
        }
        .aao-blocked-icon {
          font-size:36px;
          animation:aaoPop 0.4s cubic-bezier(0.34,1.56,0.64,1);
        }
        .aao-blocked-title{font-size:15px;font-weight:800;color:#fbbf24;}
        .aao-blocked-msg  {font-size:12px;color:#555;line-height:1.65;max-width:260px;}

        /* Buttons */
        .aao-btn-primary {
          width:100%;padding:13px;border-radius:13px;border:none;
          background:linear-gradient(135deg,#a3e635 0%,#65a30d 100%);
          color:#040a00;font-size:14px;font-weight:800;
          cursor:pointer;transition:all 0.18s;font-family:inherit;
          box-shadow:0 4px 18px rgba(163,230,53,0.3);
          display:flex;align-items:center;justify-content:center;gap:8px;
        }
        .aao-btn-primary:hover{transform:translateY(-1px);box-shadow:0 6px 24px rgba(163,230,53,0.4);}
        .aao-btn-ghost {
          width:100%;padding:11px;border-radius:12px;
          background:transparent;
          border:1px solid rgba(255,255,255,0.08);
          color:#555;font-size:13px;font-weight:700;
          cursor:pointer;transition:all 0.18s;font-family:inherit;
        }
        .aao-btn-ghost:hover{background:rgba(255,255,255,0.06);color:#999;border-color:rgba(255,255,255,0.15);}
        .aao-btn-danger {
          width:100%;padding:11px;border-radius:12px;
          background:rgba(239,68,68,0.07);
          border:1px solid rgba(239,68,68,0.2);
          color:#f87171;font-size:13px;font-weight:700;
          cursor:pointer;transition:all 0.18s;font-family:inherit;
        }
        .aao-btn-danger:hover{background:rgba(239,68,68,0.14);border-color:rgba(239,68,68,0.35);}

        .aao-btn-row{display:flex;flex-direction:column;gap:8px;width:100%;margin-top:8px;}

        /* Limit bar */
        .aao-limit-bar {
          display:flex;align-items:center;gap:8px;
          padding:9px 13px;
          background:rgba(251,191,36,0.06);
          border:1px solid rgba(251,191,36,0.18);
          border-radius:11px;font-size:12px;color:#fbbf24;
          font-weight:700;margin-bottom:14px;
        }
      `}</style>

      {/* Backdrop */}
      <div className="aao-backdrop" onClick={step === "waiting" ? undefined : onClose}/>

      {/* Panel */}
      <div className="aao-panel">

        {/* Header */}
        <div className="aao-header">
          <div className="aao-header-left">
            <div className="aao-header-icon">
              <UserPlus size={15} color="#a3e635"/>
            </div>
            <div>
              <div className="aao-header-title">Add Account</div>
              <div className="aao-header-sub">Up to {MAX_ACCOUNTS} accounts per device</div>
            </div>
          </div>
          {step !== "waiting" && (
            <button className="aao-close-btn" onClick={onClose}>
              <X size={13}/>
            </button>
          )}
        </div>

        {/* Slot indicators */}
        <div className="aao-slots">
          {Array.from({ length: MAX_ACCOUNTS }).map((_, i) => (
            <div
              key={i}
              className={`aao-slot ${i < accounts.length ? "filled" : "empty"}`}
            />
          ))}
        </div>
        <div className="aao-slots-label">
          {accounts.length}/{MAX_ACCOUNTS} accounts saved
        </div>

        {/* Body */}
        <div className="aao-body">

          {/* ── PICK ── */}
          {step === "pick" && (
            <>
              {atMax ? (
                <div className="aao-blocked">
                  <div className="aao-blocked-icon">🔒</div>
                  <div className="aao-blocked-title">Account limit reached</div>
                  <div className="aao-blocked-msg">
                    You can save up to {MAX_ACCOUNTS} accounts. Remove one from the
                    account switcher to add a new one.
                  </div>
                  <div className="aao-btn-row">
                    <button className="aao-btn-ghost" onClick={onClose}>Close</button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="aao-note">
                    Adding an account <strong>won't sign you out</strong>. A secure
                    popup will open — complete sign-in there and you'll be right back.
                  </div>
                  <div className="aao-providers">
                    {PROVIDERS.map(p => (
                      <button
                        key={p.id}
                        className="aao-provider-btn"
                        style={{
                          background:   p.bg,
                          borderColor:  p.border,
                          color:        p.color,
                        }}
                        onMouseEnter={e => e.currentTarget.style.background = p.hoverBg}
                        onMouseLeave={e => e.currentTarget.style.background = p.bg}
                        onClick={() => openPopup(p)}
                        disabled={atMax}
                      >
                        <div className="aao-p-icon"><p.Icon/></div>
                        <span className="aao-p-label">{p.label}</span>
                        <span className="aao-p-arrow">›</span>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </>
          )}

          {/* ── WAITING ── */}
          {step === "waiting" && (
            <div className="aao-waiting">
              <div className="aao-waiting-ring"/>
              <div className="aao-waiting-title">
                Waiting for {PROVIDERS.find(p => p.id === activeProvider)?.label?.replace("Continue with ", "") || "sign-in"}…
              </div>
              <div className="aao-waiting-sub">
                Complete the sign-in in the popup window. Don't close the popup
                until you see a success message.
              </div>
              <div className="aao-waiting-note">
                🔒 Your current session is completely safe and untouched.
              </div>
              <div className="aao-btn-row">
                <button className="aao-btn-ghost" onClick={cancel}>
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* ── SUCCESS ── */}
          {step === "success" && successEntry && (
            <div className="aao-success">
              <div className="aao-success-ring">
                <CheckCircle2 size={30} color="#a3e635" strokeWidth={1.5}/>
              </div>
              <div className="aao-success-name">
                {successEntry.fullName}
              </div>
              <div className="aao-success-user">
                @{successEntry.username}
              </div>
              <div className="aao-success-note">
                Account saved! Open the <strong>account switcher</strong> in the
                avatar dropdown to switch to this account anytime.
              </div>
              <div className="aao-btn-row">
                <button className="aao-btn-primary" onClick={onClose}>
                  Done
                </button>
                {!atMax && (
                  <button
                    className="aao-btn-ghost"
                    onClick={() => { setStep("pick"); setSuccessEntry(null); setActiveProvider(null); }}
                  >
                    Add another account
                  </button>
                )}
              </div>
            </div>
          )}

          {/* ── ERROR ── */}
          {step === "error" && (
            <div className="aao-error-body">
              <div className="aao-error-ring">
                <AlertCircle size={28} color="#f87171" strokeWidth={1.5}/>
              </div>
              <div className="aao-error-title">Something went wrong</div>
              <div className="aao-error-msg">{errorMsg}</div>
              <div className="aao-btn-row">
                <button className="aao-btn-primary" onClick={() => { setStep("pick"); setErrorMsg(""); setActiveProvider(null); }}>
                  Try again
                </button>
                <button className="aao-btn-ghost" onClick={onClose}>Cancel</button>
              </div>
            </div>
          )}

        </div>
      </div>
    </>,
    document.body
  );
};

export default AddAccountOverlay;