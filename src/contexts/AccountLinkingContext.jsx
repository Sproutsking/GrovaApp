import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AlertCircle, Check, ExternalLink, Link2, LoaderCircle, X } from "lucide-react";
import socialConnectService from "../services/distribution/socialConnectService";
import { CONNECTOR_DEFINITIONS } from "../services/connectors/connectorRegistry";

const AccountLinkingContext = createContext(null);

const MODAL_CSS = `
  @keyframes accountLinkSpin { to { transform:rotate(360deg) } }
  @keyframes accountLinkIn { from { opacity:0; transform:translateY(8px) scale(.985) } to { opacity:1; transform:translateY(0) scale(1) } }
  .account-link-backdrop { position:fixed; inset:0; z-index:100500; display:grid; place-items:center; padding:20px; background:rgba(3,5,3,.76); backdrop-filter:blur(8px); }
  .account-link-dialog { width:min(100%,440px); overflow:hidden; border:1px solid rgba(190,242,100,.2); border-radius:18px; background:#10120f; color:#f4f4f5; animation:accountLinkIn .2s ease both; }
  .account-link-top { display:flex; align-items:flex-start; gap:12px; padding:20px 20px 15px; }
  .account-link-mark { width:40px; height:40px; display:grid; place-items:center; flex:none; border:1px solid var(--link-border); border-radius:12px; color:var(--link-color); background:var(--link-bg); }
  .account-link-title { min-width:0; flex:1; }
  .account-link-title h2 { margin:0; font-size:16px; font-weight:760; letter-spacing:-.02em; }
  .account-link-title p { margin:5px 0 0; color:#969a91; font-size:11.5px; line-height:1.5; }
  .account-link-close { display:grid; place-items:center; width:30px; height:30px; flex:none; border:1px solid transparent; border-radius:8px; background:transparent; color:#8d9188; cursor:pointer; }
  .account-link-close:hover { border-color:rgba(255,255,255,.1); color:#fff; }
  .account-link-body { padding:0 20px 20px; }
  .account-link-permission { display:flex; align-items:flex-start; gap:8px; margin:0 0 15px; padding:10px 11px; border:1px solid rgba(255,255,255,.07); border-radius:10px; color:#bec2b9; background:rgba(255,255,255,.018); font-size:10.5px; line-height:1.5; }
  .account-link-permission svg { flex:none; margin-top:1px; color:#bef264; }
  .account-link-label { display:block; margin:0 0 7px; color:#d9ddd4; font-size:11px; font-weight:700; }
  .account-link-input { width:100%; min-height:42px; padding:0 12px; border:1px solid rgba(255,255,255,.13); border-radius:9px; outline:none; color:#f4f4f5; background:#0b0d0a; font-family:inherit; font-size:12px; }
  .account-link-input:focus { border-color:rgba(190,242,100,.58); }
  .account-link-hint { margin:7px 0 0; color:#858a80; font-size:10px; line-height:1.5; }
  .account-link-status { display:flex; align-items:flex-start; gap:8px; margin-top:13px; color:#aeb3a8; font-size:11px; line-height:1.5; }
  .account-link-status svg { flex:none; margin-top:1px; }
  .account-link-status.error { color:#fca5a5; }
  .account-link-status.success { color:#d9f99d; }
  .account-link-actions { display:flex; justify-content:flex-end; gap:8px; margin-top:18px; }
  .account-link-button { min-height:36px; display:inline-flex; align-items:center; justify-content:center; gap:7px; padding:0 13px; border:1px solid rgba(255,255,255,.12); border-radius:9px; color:#d7d9d3; background:transparent; font-family:inherit; font-size:11px; font-weight:650; cursor:pointer; }
  .account-link-button:disabled { opacity:.55; cursor:wait; }
  .account-link-button.primary { border-color:#bef264; color:#18210d; background:#bef264; }
  .account-link-button.primary:hover:not(:disabled) { background:#d9f99d; }
  .account-link-button:focus-visible,.account-link-close:focus-visible { outline:2px solid #bef264; outline-offset:2px; }
  .account-link-spin { animation:accountLinkSpin .8s linear infinite; }
  @media(max-width:480px) { .account-link-backdrop { padding:12px; align-items:end; } .account-link-dialog { border-radius:18px 18px 12px 12px; } }
`;

export function AccountLinkingProvider({ children }) {
  const [request, setRequest] = useState(null);
  const resolverRef = useRef(null);

  const openAccountLink = useCallback((options) => {
    if (!options?.userId || !options?.platform) {
      return Promise.reject(new Error("A signed-in user and platform are required to link an account."));
    }
    if (!CONNECTOR_DEFINITIONS[options.platform]) {
      return Promise.reject(new Error(`Account linking is not configured for ${options.platform}.`));
    }
    if (resolverRef.current) {
      return Promise.reject(new Error("Finish or close the current account-linking dialog first."));
    }
    return new Promise((resolve) => {
      resolverRef.current = resolve;
      setRequest({
        id: `${Date.now()}-${Math.random()}`,
        userId: options.userId,
        platform: options.platform,
        readOnly: Boolean(options.readOnly),
        profileUrl: options.profileUrl || "",
        purpose: options.purpose || "account",
      });
    });
  }, []);

  const finish = useCallback((result) => {
    const resolve = resolverRef.current;
    resolverRef.current = null;
    setRequest(null);
    resolve?.(result);
  }, []);

  return (
    <AccountLinkingContext.Provider value={{ openAccountLink }}>
      {children}
      {request && <AccountLinkDialog request={request} onClose={() => finish({ cancelled: true })} onComplete={finish} />}
    </AccountLinkingContext.Provider>
  );
}

export function useAccountLinking() {
  const context = useContext(AccountLinkingContext);
  if (!context) throw new Error("useAccountLinking must be used inside AccountLinkingProvider.");
  return context;
}

function AccountLinkDialog({ request, onClose, onComplete }) {
  const platform = CONNECTOR_DEFINITIONS[request.platform];
  const isProfileLink = platform?.connectionMode === "profile_link";
  const [profileUrl, setProfileUrl] = useState(request.profileUrl);
  const [state, setState] = useState("idle");
  const [message, setMessage] = useState("");
  const previousFocus = useRef(null);
  const dialogRef = useRef(null);
  const closeRef = useRef(onClose);
  const stateRef = useRef(state);
  closeRef.current = onClose;
  stateRef.current = state;

  useEffect(() => {
    previousFocus.current = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event) => {
      if (event.key === "Escape" && stateRef.current !== "working") closeRef.current();
    };
    window.addEventListener("keydown", onKeyDown);
    dialogRef.current?.querySelector("input,button")?.focus();
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
      previousFocus.current?.focus?.();
    };
  }, []);

  if (!platform) return null;

  const complete = (result) => {
    window.dispatchEvent(new Event("xeevia:connections-changed"));
    onComplete(result);
  };

  const submit = async (event) => {
    event.preventDefault();
    if (state === "working") return;
    setState("working");
    setMessage(isProfileLink ? "Saving the profile link…" : `Opening ${platform.name} authorization…`);
    let popup = null;
    try {
      if (!isProfileLink) {
        const width = 520;
        const height = 620;
        const left = Math.round(window.screenX + (window.outerWidth - width) / 2);
        const top = Math.round(window.screenY + (window.outerHeight - height) / 2);
        popup = window.open("about:blank", `xeevia_link_${request.platform}`, `width=${width},height=${height},left=${left},top=${top},toolbar=no,menubar=no,scrollbars=yes`);
        if (!popup || popup.closed) throw new Error("Popup was blocked. Allow popups for this site, then try again.");
      }
      const result = isProfileLink
        ? await socialConnectService.saveProfileLink(request.userId, request.platform, profileUrl)
        : await socialConnectService.linkPlatform(request.userId, request.platform, { readOnly: request.readOnly, popup });
      if (result?.alreadyConnected && popup && !popup.closed) popup.close();
      setState("success");
      setMessage(isProfileLink
        ? "Profile link saved. This URL is user-provided and does not independently verify ownership."
        : `${platform.name} authorized. Returning you to what you were doing…`);
      window.setTimeout(() => complete(result), 650);
    } catch (error) {
      if (popup && !popup.closed) popup.close();
      const cancelled = /cancelled/i.test(error?.message || "");
      setState(cancelled ? "idle" : "error");
      setMessage(cancelled ? "Authorization was closed before it finished. You can try again." : error?.message || "The account could not be connected.");
    }
  };

  const content = (
    <>
      <style>{MODAL_CSS}</style>
      <div className="account-link-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && state !== "working") onClose(); }}>
        <section
          className="account-link-dialog"
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby="account-link-heading"
          style={{ "--link-color": platform.color, "--link-bg": platform.bg, "--link-border": platform.border }}
        >
          <div className="account-link-top">
            <div className="account-link-mark">{platform.letter}</div>
            <div className="account-link-title">
              <h2 id="account-link-heading">{isProfileLink ? `Add your ${platform.name} link` : `Connect ${platform.name}`}</h2>
              <p>{isProfileLink ? "Add a public profile address to your identity." : request.readOnly ? "Authorize access for identity evidence. Publishing permissions are not requested." : "Authorize this account without leaving the page you are working on."}</p>
            </div>
            <button type="button" className="account-link-close" onClick={onClose} disabled={state === "working"} aria-label="Close account linking dialog"><X size={16} /></button>
          </div>
          <form className="account-link-body" onSubmit={submit}>
            {isProfileLink ? (
              <>
                <label className="account-link-label" htmlFor="account-link-profile-url">Public profile URL</label>
                <input
                  id="account-link-profile-url"
                  className="account-link-input"
                  type="url"
                  value={profileUrl}
                  onChange={(event) => setProfileUrl(event.target.value)}
                  placeholder="https://…"
                  autoComplete="url"
                  required
                  disabled={state === "working"}
                />
                <p className="account-link-hint"><ExternalLink size={11} style={{ verticalAlign:"-2px", marginRight:4 }} />Use a public {platform.name} URL. We check the platform domain and format; adding a URL does not prove account ownership.</p>
              </>
            ) : (
              <div className="account-link-permission">
                <Link2 size={14} />
                <span>
                  {request.platform === "instagram"
                    ? "Instagram authorization uses Meta’s Facebook Login. After approval, choose the Instagram Professional account linked to one of your Pages."
                    : request.platform === "facebook"
                      ? "Facebook authorization uses Meta. After approval, choose the Page you manage."
                      : "Only the account you authorize is connected. Provider access is stored against your signed-in Xeevia account; your current page stays open."}
                </span>
              </div>
            )}
            {message && (
              <div className={`account-link-status${state === "error" ? " error" : state === "success" ? " success" : ""}`} role={state === "error" ? "alert" : "status"}>
                {state === "working" ? <LoaderCircle className="account-link-spin" size={14} /> : state === "success" ? <Check size={14} /> : state === "error" ? <AlertCircle size={14} /> : <Link2 size={14} />}
                <span>{message}</span>
              </div>
            )}
            <div className="account-link-actions">
              <button type="button" className="account-link-button" onClick={onClose} disabled={state === "working"}>Cancel</button>
              <button type="submit" className="account-link-button primary" disabled={state === "working" || !request.userId}>
                {state === "working" ? <><LoaderCircle size={13} className="account-link-spin" /> Connecting…</> : isProfileLink ? "Save profile link" : "Continue to platform"}
              </button>
            </div>
          </form>
        </section>
      </div>
    </>
  );

  return createPortal(content, document.body);
}
