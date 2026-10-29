import React, { useCallback, useEffect, useState } from "react";
import verificationService from "../../../services/community/verificationService";
import VerificationPanelView from "./VerificationPanelView";
import { getMethodsForVerificationChannel } from "./verificationConfig";

export default function VerificationPanel({ communityId, channelId, panelType = "verification", onVerified }) {
  const [panel, setPanel] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try { setPanel(await verificationService.getPanel(communityId)); setError(""); }
    catch (e) { setError(e.message || "Could not load verification."); }
    finally { setLoading(false); }
  }, [communityId]);
  useEffect(() => { load(); }, [load]);

  const complete = async (method, payload) => {
    setBusy(true);
    try {
      let res = await verificationService.complete(communityId, method, payload);
      if (res?.success && res.needs_role_selection && panel?.roleChoices?.length === 1) {
        res = await verificationService.complete(communityId, method, {
          ...payload,
          roleId: panel.roleChoices[0].id,
        });
      }
      if (res?.success) { await load(); onVerified?.(res); } else if (res?.lockedUntil) await load();
      return res;
    } catch (e) { return { success: false, error: e.message || "Verification failed." }; }
    finally { setBusy(false); }
  };

  const note = (text) => <section style={{ maxWidth: 560, margin: "40px auto", padding: 20, color: "#98ab98", fontSize: 14, textAlign: "center" }}>{text}</section>;
  if (loading) return note("Loading verification…");
  if (error) return note(error);
  if (!panel?.configured) return note("Verification isn't configured for this community yet.");
  if (panelType === "rules" && !panel.rulesGate?.enabled) {
    const rules = panel.methods?.rules;
    if (!rules?.items?.length) return note("The community rules panel has no rules to display yet.");
    return (
      <section className="community-rules-panel">
        <header><span>COMMUNITY RULES</span><h1>{rules.title || "Community rules"}</h1><p>{rules.description}</p></header>
        <ol>{rules.items.map((rule) => <li key={rule.id}><strong>{rule.title}</strong>{rule.body && <p>{rule.body}</p>}</li>)}</ol>
        <style>{`.community-rules-panel{width:calc(100% - 32px);max-width:620px;box-sizing:border-box;margin:24px auto;padding:22px;border:1px solid rgba(156,255,0,.2);border-radius:14px;background:linear-gradient(145deg,rgba(24,33,25,.96),rgba(9,13,10,.98));color:#eef8ed}.community-rules-panel header>span{font-size:calc((10px) + 1px);font-weight:800;letter-spacing:.13em;color:#9cff00}.community-rules-panel h1{margin:6px 0;font-size:calc((22px) + 1px)}.community-rules-panel header>p,.community-rules-panel li>p{margin:4px 0 0;color:#a6b6a7;font-size:calc((12px) + 1px);line-height:1.55}.community-rules-panel ol{display:grid;gap:10px;margin:18px 0 0;padding-left:28px}.community-rules-panel li{padding-left:4px}.community-rules-panel li::marker{color:#9cff00;font-weight:800}.community-rules-panel li strong{font-size:calc((13px) + 1px)}`}</style>
      </section>
    );
  }
  const onlyMethods = panelType === "rules"
    ? ["rules"]
    : getMethodsForVerificationChannel(panel.rulesGate, channelId);
  if (onlyMethods?.length === 0) {
    return note("This channel isn't part of the community's active verification route. Open the configured rules or verification channel, or contact a moderator.");
  }
  return <VerificationPanelView panel={panel} state={panel.state} busy={busy} onComplete={complete} onlyMethods={onlyMethods} />;
}
