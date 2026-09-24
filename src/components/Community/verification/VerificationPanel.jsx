import React, { useCallback, useEffect, useState } from "react";
import verificationService from "../../../services/community/verificationService";
import VerificationPanelView from "./VerificationPanelView";

export default function VerificationPanel({ communityId, onVerified }) {
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
      const res = await verificationService.complete(communityId, method, payload);
      if (res?.success) { await load(); onVerified?.(res); } else if (res?.lockedUntil) await load();
      return res;
    } catch (e) { return { success: false, error: e.message || "Verification failed." }; }
    finally { setBusy(false); }
  };

  const note = (text) => <section style={{ maxWidth: 560, margin: "40px auto", padding: 20, color: "#98ab98", fontSize: 13, textAlign: "center" }}>{text}</section>;
  if (loading) return note("Loading verification…");
  if (error) return note(error);
  if (!panel?.configured) return note("Verification isn't configured for this community yet.");
  return <VerificationPanelView panel={panel} state={panel.state} busy={busy} onComplete={complete} />;
}
