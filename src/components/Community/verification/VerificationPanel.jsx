import React, { useEffect, useState } from "react";
import { Check, LockKeyhole, ShieldCheck, WalletCards, BadgeCheck, MailCheck, UserRoundCheck } from "lucide-react";
import { supabase } from "../../../services/config/supabase";

const DEFAULT_BUTTONS = [{ id: "agree", label: "I agree and verify", color: "lime" }];

export default function VerificationPanel({ communityId, userId, onVerified }) {
  const [config, setConfig] = useState({ message: "Click a button below to verify and unlock access.", buttons: DEFAULT_BUTTONS });
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  const verify = async () => {
    if (working) return;
    setWorking(true); setError("");
    try {
      const { data, error: rpcError } = await supabase.rpc("verify_community_member", {
        p_community_id: communityId,
        p_user_id: userId,
        p_method: "reaction-role",
      });

      if (rpcError || !data?.success) {
        throw new Error(rpcError?.message || data?.error || "Verification could not be completed.");
      }

      const { data: memberRow, error: memberError } = await supabase
        .from("community_members")
        .select("role_id")
        .eq("community_id", communityId)
        .eq("user_id", userId)
        .maybeSingle();

      if (memberError) throw memberError;
      if (memberRow?.role_id) {
        setDone(true);
        onVerified?.();
        return;
      }

      throw new Error("Verification succeeded but your role was not updated. Please refresh and try again.");
    } catch (err) {
      setError(err?.message || "Verification could not be completed.");
    } finally {
      setWorking(false);
    }
  };

  useEffect(() => {
    let mounted = true;
    supabase.from("community_tool_settings").select("config").eq("community_id", communityId).eq("tool_type", "verification").maybeSingle()
      .then(({ data }) => {
        if (mounted && data?.config) setConfig((current) => ({ ...current, ...data.config, buttons: Array.isArray(data.config.buttons) && data.config.buttons.length ? data.config.buttons.slice(0, 5) : current.buttons }));
      });
    return () => { mounted = false; };
  }, [communityId]);

  return (
    <section className="verification-panel">
      <div className="verification-hero"><div className="verification-icon"><ShieldCheck size={24} /></div><div><div className="verification-kicker">Member access</div><h1>Verify to enter</h1><p>{config.message}</p></div></div>
      {error && <div className="verification-error">{error}</div>}
      {done ? <div className="verification-success"><Check size={18} /> Verified. Your community access is being updated.</div> : <div className="verification-actions">{config.buttons.map((button) => <button key={button.id || button.label} className={`verification-submit verification-${button.color || "lime"}`} onClick={() => verify(button)} disabled={working}>{working ? "Verifying..." : button.label}</button>)}</div>}
      <style>{`.verification-panel{max-width:760px;margin:26px auto;padding:24px;border:1px solid rgba(156,255,0,.2);border-radius:20px;background:linear-gradient(145deg,rgba(20,31,21,.96),rgba(8,13,10,.98));box-shadow:0 20px 60px rgba(0,0,0,.3)}.verification-hero{display:flex;gap:14px;align-items:flex-start}.verification-icon{width:48px;height:48px;border-radius:15px;display:flex;align-items:center;justify-content:center;color:#9cff00;background:rgba(156,255,0,.12);border:1px solid rgba(156,255,0,.3);flex-shrink:0}.verification-kicker{font-size:10px;color:#9cff00;text-transform:uppercase;letter-spacing:.12em;font-weight:800}.verification-panel h1{margin:3px 0;color:#f3faef;font-size:23px}.verification-panel p{margin:0;color:#94a794;font-size:12px;line-height:1.5}.verification-actions{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:8px;margin-top:22px}.verification-submit{padding:13px;border:0;border-radius:11px;background:#9cff00;color:#071000;font-weight:800;cursor:pointer}.verification-submit:disabled{opacity:.45;cursor:not-allowed}.verification-blue{background:#60a5fa}.verification-gold{background:#facc15}.verification-red{background:#fb7185}.verification-purple{background:#c084fc}.verification-error{margin:10px 0;padding:10px;border-radius:9px;color:#ffaaa3;background:rgba(255,75,65,.1);font-size:11px}.verification-success{display:flex;align-items:center;gap:8px;padding:12px;border-radius:10px;background:rgba(156,255,0,.1);color:#caff9a;font-size:12px}@media(max-width:600px){.verification-panel{margin:14px;padding:16px}.verification-actions{grid-template-columns:1fr}}`}</style>
    </section>
  );
}
