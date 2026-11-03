import React, { useCallback, useEffect, useState } from "react";
import verificationService from "../../../services/community/verificationService";
import VerificationPanelView from "./VerificationPanelView";
import { getMethodsForVerificationChannel } from "./verificationConfig";
import CommunityRulesCard from "./CommunityRulesCard";

export default function VerificationPanel({ communityId, userId, channelId, panelType = "verification", published = false, onVerified }) {
  const [panel, setPanel] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try { setPanel(await verificationService.getPanel(communityId, { userId })); setError(""); }
    catch (e) { setError(e.message || "Could not load verification."); }
    finally { setLoading(false); }
  }, [communityId, userId]);
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
      if (res?.success) {
        verificationService.invalidatePanel(communityId, userId);
        await load();
        onVerified?.(res);
      } else if (res?.lockedUntil) await load();
      return res;
    } catch (e) { return { success: false, error: e.message || "Verification failed." }; }
    finally { setBusy(false); }
  };

  const note = (text) => <section style={{ maxWidth: 560, margin: "40px auto", padding: 20, color: "#98ab98", fontSize: 14, textAlign: "center" }}>{text}</section>;
  if (loading) return note("Loading verification…");
  if (error) return note(error);
  if (!panel?.configured) return note("Verification isn't configured for this community yet.");
  const isRulesGatePanel = panelType === "rules"
    && panel.rulesGate?.enabled
    && String(panel.rulesGate.rulesChannelId || "") === String(channelId || "");
  if (panelType === "rules" && !isRulesGatePanel) {
    const rules = panel.rulesPanel || panel.methods?.rules;
    const items = (rules?.items || []).filter((rule) => rule.title?.trim());
    if (!items.length) return note("The community rules panel has no rules to display yet.");
    return <CommunityRulesCard title={rules.title} description={rules.description} items={items} appearance={rules.style} />;
  }
  const onlyMethods = panelType === "rules"
    ? ["rules"]
    : getMethodsForVerificationChannel(panel.rulesGate, channelId);
  if (onlyMethods?.length === 0) {
    return note("This channel isn't part of the community's active verification route. Open the configured rules or verification channel, or contact a moderator.");
  }
  return <VerificationPanelView panel={panel} state={panel.state} busy={busy} onComplete={complete} onlyMethods={onlyMethods} published={published} />;
}
