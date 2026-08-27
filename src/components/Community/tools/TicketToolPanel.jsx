import React, { useState } from "react";
import { Mail, Send, CheckCircle2 } from "lucide-react";
import { supabase } from "../../../services/config/supabase";

export default function TicketToolPanel({ communityId, userId, userEmail }) {
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [state, setState] = useState("idle");
  const [error, setError] = useState("");

  const submit = async (event) => {
    event.preventDefault();
    if (!subject.trim() || !description.trim() || state === "sending") return;
    setState("sending");
    setError("");
    const { error: insertError } = await supabase.from("support_cases").insert({
      title: subject.trim(),
      description: description.trim(),
      user_id: userId,
      user_email: userEmail || null,
      category: "technical",
      priority: "medium",
      status: "open",
    });
    if (insertError) {
      setError(insertError.message || "Ticket could not be created.");
      setState("idle");
      return;
    }
    setSubject("");
    setDescription("");
    setState("sent");
  };

  return (
    <section className="community-ticket-tool">
      <div className="ticket-tool-head"><div className="ticket-tool-icon"><Mail size={20} /></div><div><span>Private support</span><h2>Open a ticket</h2><p>Only the community team can see your request.</p></div></div>
      {state === "sent" ? <div className="ticket-sent"><CheckCircle2 size={20} /> Ticket sent to the community team.</div> : <form onSubmit={submit}>
        <input value={subject} onChange={(event) => setSubject(event.target.value)} placeholder="What do you need help with?" maxLength={120} />
        <textarea value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Describe the issue..." rows={4} maxLength={2000} />
        {error && <div className="ticket-error">{error}</div>}
        <button type="submit" disabled={!subject.trim() || !description.trim() || state === "sending"}><Send size={15} /> {state === "sending" ? "Sending..." : "Send private ticket"}</button>
      </form>}
      <style>{`.community-ticket-tool{max-width:560px;margin:18px auto;padding:18px;border:1px solid rgba(156,255,0,.18);border-radius:14px;background:linear-gradient(145deg,rgba(24,33,25,.96),rgba(9,13,10,.98));color:#eef8ed}.ticket-tool-head{display:flex;gap:12px;align-items:flex-start;margin-bottom:16px}.ticket-tool-icon{width:42px;height:42px;display:grid;place-items:center;border-radius:11px;color:#9cff00;background:rgba(156,255,0,.1);border:1px solid rgba(156,255,0,.28)}.ticket-tool-head span{font-size:10px;text-transform:uppercase;letter-spacing:.12em;color:#9cff00;font-weight:800}.ticket-tool-head h2{margin:3px 0;font-size:20px}.ticket-tool-head p{margin:0;color:#89a08b;font-size:12px}.community-ticket-tool input,.community-ticket-tool textarea{width:100%;box-sizing:border-box;margin-bottom:9px;padding:11px 12px;border:1px solid rgba(255,255,255,.1);border-radius:9px;background:rgba(255,255,255,.04);color:#fff;font:inherit;font-size:13px;resize:vertical}.community-ticket-tool button{display:flex;align-items:center;gap:7px;padding:10px 13px;border:0;border-radius:9px;background:#9cff00;color:#071000;font-weight:800;cursor:pointer}.community-ticket-tool button:disabled{opacity:.45;cursor:not-allowed}.ticket-error{margin-bottom:9px;color:#ffaaa3;font-size:11px}.ticket-sent{display:flex;gap:8px;align-items:center;padding:12px;border-radius:9px;background:rgba(156,255,0,.1);color:#caff9a;font-size:12px}`}</style>
    </section>
  );
}
