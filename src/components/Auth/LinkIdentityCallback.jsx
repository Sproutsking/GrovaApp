import React, { useEffect, useState } from "react";
import { supabase } from "../../services/config/supabase";

const PENDING_LINK_KEY = "xeevia_pending_identity_link";

const STYLES = `
  @keyframes linkCbSpin { to { transform: rotate(360deg); } }
  @keyframes linkCbFade { from { opacity: 0; } to { opacity: 1; } }
`;

export default function LinkIdentityCallback() {
  const [status, setStatus] = useState("loading");
  const [message, setMessage] = useState("Completing identity connection…");

  useEffect(() => {
    let mounted = true;

    const complete = async () => {
      try {
        const params = new URLSearchParams(window.location.search);
        const error = params.get("error_description") || params.get("error");
        if (error) {
          const decodedError = decodeURIComponent(error).replace(/\+/g, " ");
          if (/identity.*(already|exists)|already.*identity/i.test(decodedError)) {
            throw new Error("That provider account is already connected to another Xeevia account.");
          }
          throw new Error(decodedError);
        }

        const code = params.get("code");
        if (!code) throw new Error("The provider callback did not include an authorization code.");
        const { data: exchanged, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
        if (exchangeError) throw exchangeError;
        if (!exchanged?.session) throw new Error("The provider session could not be established.");

        const { data, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) throw sessionError;
        if (!data?.session) throw new Error("Your session expired. Sign in again before connecting an identity.");

        const { data: userData, error: userError } = await supabase.auth.getUser();
        if (userError) throw userError;
        const pendingRaw = sessionStorage.getItem(PENDING_LINK_KEY);
        const pending = pendingRaw ? JSON.parse(pendingRaw) : null;
        if (!pending || pending.userId !== userData?.user?.id || Date.now() - pending.startedAt > 10 * 60 * 1000) {
          throw new Error("This identity link expired or belongs to a different Xeevia account. Start the connection again.");
        }
        const latestIdentity = userData?.user?.identities?.at(-1);
        if (!latestIdentity) throw new Error("The provider identity could not be confirmed.");

        const expectedProvider = pending.platform === "x" ? "twitter" : pending.platform;
        if (latestIdentity.provider !== expectedProvider && !(pending.platform === "instagram" && latestIdentity.provider === "facebook")) {
          throw new Error("The returned provider did not match the identity you selected.");
        }

        const platformUserId = latestIdentity.identity_data?.user_name
          || latestIdentity.identity_data?.preferred_username
          || latestIdentity.identity_data?.sub
          || latestIdentity.id;
        const { error: connectionError } = await supabase.from("connections").upsert({
          user_id: userData.user.id,
          provider: pending.platform,
          platform_user_id: platformUserId,
          auth_status: "active",
          connected_via: "supabase_identity",
        }, { onConflict: "user_id,provider" });
        if (connectionError) throw new Error(`Identity verified, but connection tracking failed: ${connectionError.message}`);
        sessionStorage.removeItem(PENDING_LINK_KEY);

        if (!mounted) return;
        setStatus("success");
        setMessage(`${pending.platform} is now connected to this Xeevia account.`);
        window.history.replaceState({}, "", "/");
        window.setTimeout(() => { window.location.href = "/"; }, 650);
      } catch (error) {
        if (!mounted) return;
        sessionStorage.removeItem(PENDING_LINK_KEY);
        setStatus("error");
        setMessage(error?.message || "The identity could not be connected.");
        window.setTimeout(() => { window.location.href = "/"; }, 2600);
      }
    };

    complete();
    return () => { mounted = false; };
  }, []);

  return (
    <>
      <style>{STYLES}</style>
      <main style={{ minHeight: "100dvh", display: "grid", placeItems: "center", padding: 24, background: "#080808", color: "#f5f5f5", fontFamily: "inherit", animation: "linkCbFade .25s ease" }}>
        <section style={{ width: "min(420px, 100%)", textAlign: "center" }}>
          {status === "loading" && <div style={{ width: 42, height: 42, margin: "0 auto 18px", border: "3px solid rgba(163,230,53,.14)", borderTopColor: "#a3e635", borderRadius: "50%", animation: "linkCbSpin .75s linear infinite" }} />}
          <div style={{ fontSize: 18, fontWeight: 800, color: status === "error" ? "#f87171" : "#a3e635" }}>{status === "error" ? "Connection not completed" : status === "success" ? "Identity connected" : "Connecting identity"}</div>
          <p style={{ margin: "10px auto 0", color: "#a1a1aa", fontSize: 13, lineHeight: 1.6 }}>{message}</p>
        </section>
      </main>
    </>
  );
}