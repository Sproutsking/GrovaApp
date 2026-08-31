import React, { useEffect, useState } from "react";
import { Check, LockKeyhole, ShieldCheck, WalletCards, BadgeCheck, MailCheck, UserRoundCheck } from "lucide-react";
import { supabase } from "../../../services/config/supabase";

const OPTIONS = [
  { id: "reaction-role", label: "Reaction role", icon: ShieldCheck, description: "Confirm you agree with the community rules." },
  { id: "wallet", label: "Crypto wallet", icon: WalletCards, description: "Verify ownership of a supported wallet." },
  { id: "social", label: "Social account", icon: BadgeCheck, description: "Connect a social account to verify identity." },
  { id: "email", label: "Email confirmation", icon: MailCheck, description: "Confirm a verified email address." },
  { id: "invite", label: "Invite code", icon: LockKeyhole, description: "Use a trusted member invitation." },
  { id: "manual", label: "Manual review", icon: UserRoundCheck, description: "Request review from the community team." },
];

export default function VerificationPanel({ communityId, userId, onVerified }) {
  const [selected, setSelected] = useState("reaction-role");
  const [message, setMessage] = useState("Confirm you agree with the community rules to unlock access.");
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  const verify = async () => {
    if (selected !== "reaction-role" || working) return;
    setWorking(true); setError("");
    try {
      const { data, error: rpcError } = await supabase.rpc("verify_community_member", {
        p_community_id: communityId,
        p_user_id: userId,
        p_method: selected,
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
        if (mounted && data?.config?.message) setMessage(data.config.message);
      });
    return () => { mounted = false; };
  }, [communityId]);

  return (
    <section className="verification-panel">
      <div className="verification-hero"><div className="verification-icon"><ShieldCheck size={24} /></div><div><div className="verification-kicker">Member access</div><h1>Verify to enter</h1><p>{message}</p></div></div>
      <div className="verification-grid">{OPTIONS.map(({ id, label, icon: Icon, description }) => <button key={id} className={`verification-option${selected === id ? " selected" : ""}`} onClick={() => { setSelected(id); setError(""); }}><Icon size={18} /><span><strong>{label}</strong><small>{description}</small></span>{id === "reaction-role" && selected === id && <Check size={16} />}</button>)}</div>
      {error && <div className="verification-error">{error}</div>}
      {done ? <div className="verification-success"><Check size={18} /> Verified. Your community access is being updated.</div> : <button className="verification-submit" onClick={verify} disabled={selected !== "reaction-role" || working}>{working ? "Verifying..." : selected === "reaction-role" ? "I agree and verify" : "Coming soon"}</button>}
      <style>{`.verification-panel{max-width:760px;margin:26px auto;padding:24px;border:1px solid rgba(156,255,0,.2);border-radius:20px;background:linear-gradient(145deg,rgba(20,31,21,.96),rgba(8,13,10,.98));box-shadow:0 20px 60px rgba(0,0,0,.3)}.verification-hero{display:flex;gap:14px;align-items:flex-start}.verification-icon{width:48px;height:48px;border-radius:15px;display:flex;align-items:center;justify-content:center;color:#9cff00;background:rgba(156,255,0,.12);border:1px solid rgba(156,255,0,.3);flex-shrink:0}.verification-kicker{font-size:10px;color:#9cff00;text-transform:uppercase;letter-spacing:.12em;font-weight:800}.verification-panel h1{margin:3px 0;color:#f3faef;font-size:23px}.verification-panel p{margin:0;color:#94a794;font-size:12px;line-height:1.5}.verification-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin:22px 0 14px}.verification-option{display:flex;align-items:center;gap:10px;text-align:left;padding:13px;border:1px solid rgba(255,255,255,.08);border-radius:12px;background:rgba(255,255,255,.03);color:#94a794;cursor:pointer}.verification-option.selected{border-color:rgba(156,255,0,.55);background:rgba(156,255,0,.1);color:#caff9a}.verification-option span{display:flex;flex-direction:column;gap:3px;flex:1}.verification-option strong{font-size:12px;color:#eef8ed}.verification-option small{font-size:10px;line-height:1.35;color:#708470}.verification-submit{width:100%;padding:13px;border:0;border-radius:11px;background:#9cff00;color:#071000;font-weight:800;cursor:pointer}.verification-submit:disabled{opacity:.45;cursor:not-allowed}.verification-error{margin:10px 0;padding:10px;border-radius:9px;color:#ffaaa3;background:rgba(255,75,65,.1);font-size:11px}.verification-success{display:flex;align-items:center;gap:8px;padding:12px;border-radius:10px;background:rgba(156,255,0,.1);color:#caff9a;font-size:12px}@media(max-width:600px){.verification-panel{margin:14px;padding:16px}.verification-grid{grid-template-columns:1fr}}`}</style>
    </section>
  );
}
