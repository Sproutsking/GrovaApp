// src/components/Auth/AddAccountOverlay.jsx
// Opens in-app OAuth flow to let user add a second/third account.
// Providers: Google, X (Twitter), Discord — NO email auth.
// On success the new account is saved to localStorage and the current
// session stays active. Switching is handled by AvatarDropdown.

import React, { useState, useEffect } from "react";
import ReactDOM from "react-dom";
import { X, UserPlus } from "lucide-react";
import { supabase } from "../../services/config/supabase";

const MAX_ACCOUNTS = 3;
const ACCOUNTS_KEY = "grova_saved_accounts";

const loadAccounts = () => {
  try { return JSON.parse(localStorage.getItem(ACCOUNTS_KEY) || "[]"); }
  catch { return []; }
};
const saveAccounts = (list) => {
  try { localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(list)); }
  catch {}
};

async function fetchMinimalProfile(userId) {
  try {
    const { data } = await supabase
      .from("profiles")
      .select("id, full_name, username, avatar_id, verified")
      .eq("id", userId)
      .maybeSingle();
    return data;
  } catch { return null; }
}

const GoogleIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24">
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
  </svg>
);

const XIcon = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="white">
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.73-8.835L1.254 2.25H8.08l4.261 5.632 5.903-5.632zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
  </svg>
);

const DiscordIcon = () => (
  <svg width="19" height="19" viewBox="0 0 24 24" fill="#5865F2">
    <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z"/>
  </svg>
);

const PROVIDERS = [
  {
    id: "google",
    label: "Continue with Google",
    color: "#fff",
    bg: "rgba(255,255,255,0.06)",
    border: "rgba(255,255,255,0.14)",
    Icon: GoogleIcon,
  },
  {
    id: "twitter",
    label: "Continue with X",
    color: "#fff",
    bg: "rgba(0,0,0,0.5)",
    border: "rgba(255,255,255,0.1)",
    Icon: XIcon,
  },
  {
    id: "discord",
    label: "Continue with Discord",
    color: "#fff",
    bg: "rgba(88,101,242,0.15)",
    border: "rgba(88,101,242,0.35)",
    Icon: DiscordIcon,
  },
];

const AddAccountOverlay = ({ onClose, currentUserId, supabase: supabaseProp }) => {
  const client   = supabaseProp || supabase;
  const accounts = loadAccounts();
  const atMax    = accounts.length >= MAX_ACCOUNTS;

  const [loading, setLoading] = useState(null);
  const [error,   setError]   = useState("");
  const [success, setSuccess] = useState(null);

  // Listen for OAuth redirect completing
  useEffect(() => {
    const { data: { subscription } } = client.auth.onAuthStateChange(async (event, session) => {
      if (event === "SIGNED_IN" && session?.user && loading) {
        const user = session.user;

        if (user.id === currentUserId) {
          setError("That's already your active account.");
          setLoading(null);
          await client.auth.signOut({ scope: "local" }).catch(() => {});
          return;
        }

        const profile = await fetchMinimalProfile(user.id);
        const entry = {
          id:       user.id,
          email:    user.email || "",
          fullName: profile?.full_name || user.user_metadata?.full_name || user.email?.split("@")[0] || "User",
          username: profile?.username || user.user_metadata?.user_name || user.email?.split("@")[0] || "user",
          avatar:   user.user_metadata?.avatar_url || null,
          verified: profile?.verified || false,
          provider: user.app_metadata?.provider || "oauth",
          savedAt:  Date.now(),
        };

        const existing = loadAccounts();
        if (!existing.find(a => a.id === user.id)) {
          saveAccounts([...existing, entry]);
        }

        setSuccess(entry);
        setLoading(null);
        await client.auth.signOut({ scope: "local" }).catch(() => {});
      }
    });
    return () => subscription.unsubscribe();
  }, [client, currentUserId, loading]);

  const handleOAuth = async (providerId) => {
    if (atMax) { setError(`Maximum ${MAX_ACCOUNTS} accounts per device`); return; }
    setError("");
    setLoading(providerId);
    try {
      const { error: e } = await client.auth.signInWithOAuth({
        provider: providerId,
        options: {
          redirectTo: window.location.href,
          queryParams: { prompt: "select_account" },
          skipBrowserRedirect: false,
        },
      });
      if (e) throw e;
    } catch (err) {
      setError(err.message || "OAuth failed. Please try again.");
      setLoading(null);
    }
  };

  return ReactDOM.createPortal(
    <>
      <style>{`
        @keyframes aaoSlideUp {
          from{opacity:0;transform:translate(-50%,-48%) scale(0.93);}
          to  {opacity:1;transform:translate(-50%,-50%) scale(1);}
        }
        @keyframes aaoFadeIn { from{opacity:0} to{opacity:1} }
        @keyframes aaoSpin   { to{transform:rotate(360deg)} }
        @keyframes aaoPop    {
          0%{transform:scale(0.7);opacity:0}
          60%{transform:scale(1.08)}
          100%{transform:scale(1);opacity:1}
        }

        .aao-backdrop {
          position:fixed;inset:0;background:rgba(0,0,0,0.88);
          backdrop-filter:blur(16px);z-index:999995;
          animation:aaoFadeIn 0.2s ease;
        }
        .aao-panel {
          position:fixed;top:50%;left:50%;
          transform:translate(-50%,-50%);
          z-index:999996;
          width:min(360px,calc(100vw - 32px));
          background:#0c0c0c;
          border:1px solid rgba(132,204,22,0.18);
          border-radius:24px;overflow:hidden;
          box-shadow:0 32px 80px rgba(0,0,0,0.9),0 0 0 1px rgba(132,204,22,0.06);
          animation:aaoSlideUp 0.3s cubic-bezier(0.34,1.4,0.64,1);
          font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
        }
        .aao-header {
          display:flex;align-items:center;justify-content:space-between;
          padding:20px 20px 16px;
          border-bottom:1px solid rgba(255,255,255,0.06);
          background:rgba(132,204,22,0.04);
        }
        .aao-title-row { display:flex;align-items:center;gap:10px; }
        .aao-icon {
          width:34px;height:34px;border-radius:10px;
          background:rgba(132,204,22,0.1);
          border:1px solid rgba(132,204,22,0.22);
          display:flex;align-items:center;justify-content:center;
        }
        .aao-title { font-size:15px;font-weight:900;color:#fff; }
        .aao-close {
          width:30px;height:30px;border-radius:8px;
          background:rgba(255,255,255,0.05);
          border:1px solid rgba(255,255,255,0.08);
          display:flex;align-items:center;justify-content:center;
          cursor:pointer;color:#737373;transition:all 0.18s;
        }
        .aao-close:hover{background:rgba(255,255,255,0.1);color:#fff;}

        .aao-body { padding:20px; }

        .aao-slots {
          display:flex;align-items:center;justify-content:center;gap:6px;
          margin-bottom:18px;
        }
        .aao-slot {
          width:9px;height:9px;border-radius:50%;
          transition:background 0.2s,transform 0.2s;
        }
        .aao-slot.filled { background:#84cc16; transform:scale(1.15); }
        .aao-slot.empty  { background:rgba(255,255,255,0.1); }

        .aao-note {
          font-size:12px;color:#525252;line-height:1.6;
          text-align:center;margin-bottom:18px;
          padding:10px 14px;
          background:rgba(132,204,22,0.04);
          border:1px solid rgba(132,204,22,0.1);
          border-radius:12px;
        }
        .aao-note strong { color:#84cc16; }

        .aao-error {
          color:#ef4444;font-size:12px;font-weight:600;
          text-align:center;margin-bottom:14px;
          padding:8px 12px;background:rgba(239,68,68,0.08);
          border:1px solid rgba(239,68,68,0.2);border-radius:10px;
        }

        .aao-provider-btn {
          width:100%;display:flex;align-items:center;gap:13px;
          padding:13px 16px;border-radius:14px;border-style:solid;border-width:1px;
          font-size:14px;font-weight:700;cursor:pointer;
          transition:all 0.22s cubic-bezier(.34,1.4,.64,1);
          margin-bottom:10px;text-align:left;
        }
        .aao-provider-btn:last-of-type { margin-bottom:0; }
        .aao-provider-btn:hover:not(:disabled) {
          transform:translateY(-2px);
          filter:brightness(1.12);
        }
        .aao-provider-btn:active:not(:disabled) { transform:scale(0.97); }
        .aao-provider-btn:disabled { opacity:0.55; cursor:not-allowed; transform:none !important; }

        .aao-p-icon {
          width:32px;height:32px;border-radius:8px;
          display:flex;align-items:center;justify-content:center;
          flex-shrink:0;background:rgba(255,255,255,0.06);
        }
        .aao-p-label { flex:1; }
        .aao-p-spinner {
          width:15px;height:15px;border:2px solid rgba(255,255,255,0.2);
          border-top-color:#fff;border-radius:50%;
          animation:aaoSpin 0.7s linear infinite;flex-shrink:0;
        }

        .aao-limit {
          display:flex;align-items:center;justify-content:center;gap:7px;
          padding:10px 14px;background:rgba(251,191,36,0.08);
          border:1px solid rgba(251,191,36,0.2);border-radius:12px;
          font-size:12.5px;color:#fbbf24;font-weight:700;
          margin-bottom:16px;
        }

        /* Success */
        .aao-success { text-align:center;padding:8px 0 4px; }
        .aao-success-bubble {
          width:64px;height:64px;border-radius:20px;
          margin:0 auto 16px;
          display:flex;align-items:center;justify-content:center;
          background:rgba(132,204,22,0.1);
          border:1px solid rgba(132,204,22,0.3);
          font-size:28px;
          animation:aaoPop 0.4s cubic-bezier(.34,1.56,.64,1);
        }
        .aao-success-name { font-size:17px;font-weight:900;color:#fff;margin:0 0 4px; }
        .aao-success-user { font-size:13px;color:#84cc16;font-weight:600;margin:0 0 16px; }
        .aao-success-note {
          font-size:12px;color:#525252;line-height:1.6;
          padding:10px 14px;background:rgba(132,204,22,0.04);
          border:1px solid rgba(132,204,22,0.1);border-radius:12px;margin-bottom:16px;
        }
        .aao-done-btn {
          width:100%;padding:13px;border-radius:13px;border:none;
          background:linear-gradient(135deg,#84cc16,#4d7c0f);color:#000;
          font-size:14px;font-weight:800;cursor:pointer;
          box-shadow:0 4px 16px rgba(132,204,22,0.35);
          transition:all 0.2s;
        }
        .aao-done-btn:hover{transform:translateY(-1px);}

        .aao-cancel-btn {
          width:100%;padding:11px;border-radius:13px;
          background:rgba(255,255,255,0.04);
          border:1px solid rgba(255,255,255,0.09);
          color:#737373;font-size:13px;font-weight:700;
          cursor:pointer;transition:all 0.18s;margin-top:10px;
        }
        .aao-cancel-btn:hover{background:rgba(255,255,255,0.08);color:#a3a3a3;}
      `}</style>

      <div className="aao-backdrop" onClick={onClose}/>
      <div className="aao-panel" onClick={e => e.stopPropagation()}>

        <div className="aao-header">
          <div className="aao-title-row">
            <div className="aao-icon"><UserPlus size={15} color="#84cc16"/></div>
            <span className="aao-title">Add Account</span>
          </div>
          <button className="aao-close" onClick={onClose}><X size={13}/></button>
        </div>

        <div className="aao-body">

          <div className="aao-slots">
            {Array.from({ length: MAX_ACCOUNTS }).map((_, i) => (
              <div key={i} className={`aao-slot ${i < accounts.length ? "filled" : "empty"}`}/>
            ))}
          </div>

          {success ? (
            <div className="aao-success">
              <div className="aao-success-bubble">✅</div>
              <p className="aao-success-name">{success.fullName}</p>
              <p className="aao-success-user">@{success.username}</p>
              <div className="aao-success-note">
                Account saved! Tap <strong style={{ color:"#84cc16" }}>Switch</strong> in the account menu to use this account.
              </div>
              <button className="aao-done-btn" onClick={onClose}>Done</button>
            </div>
          ) : atMax ? (
            <>
              <div className="aao-limit">⚠️ Maximum {MAX_ACCOUNTS} accounts per device</div>
              <button className="aao-cancel-btn" onClick={onClose}>Close</button>
            </>
          ) : (
            <>
              <div className="aao-note">
                Adding an account <strong>won't sign you out</strong>. Switch anytime from the profile menu.
              </div>

              {error && <div className="aao-error">{error}</div>}

              {PROVIDERS.map(p => (
                <button
                  key={p.id}
                  className="aao-provider-btn"
                  style={{ background: p.bg, borderColor: p.border, color: p.color }}
                  onClick={() => handleOAuth(p.id)}
                  disabled={!!loading}
                >
                  <div className="aao-p-icon"><p.Icon/></div>
                  <span className="aao-p-label">{p.label}</span>
                  {loading === p.id && <div className="aao-p-spinner"/>}
                </button>
              ))}

              <button className="aao-cancel-btn" onClick={onClose}>Cancel</button>
            </>
          )}
        </div>
      </div>
    </>,
    document.body
  );
};

export default AddAccountOverlay;