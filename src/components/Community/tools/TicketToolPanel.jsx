import React, { useEffect, useState } from "react";
import { CheckCircle2, Mail, Send, Trash2, XCircle } from "lucide-react";
import { supabase } from "../../../services/config/supabase";

export default function TicketToolPanel({ communityId, userId, channelId, isPrivateTicket = false, onTicketCreated, onTicketDeleted }) {
  const [config, setConfig] = useState({ title: "Open a private ticket", description: "Tell the community team what you need help with.", closeTitle: "Close ticket", closeDescription: "Close this ticket when your request is resolved." });
  const [state, setState] = useState("idle");
  const [ticket, setTicket] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    supabase.from("community_tool_settings").select("config").eq("community_id", communityId).eq("tool_type", "tickets").maybeSingle().then(({ data }) => { if (active && data?.config) setConfig((current) => ({ ...current, ...data.config })); });
    if (isPrivateTicket && channelId) {
      supabase.from("community_ticket_channels").select("status,requester_id").eq("channel_id", channelId).maybeSingle().then(({ data }) => {
        if (!active || !data) return;
        setState(data.status === "closed" ? "closed" : "created");
        setTicket(data);
      });
    }
    return () => { active = false; };
  }, [communityId, channelId, isPrivateTicket]);

  const createTicket = async () => {
    if (state === "sending") return;
    setState("sending"); setError("");
    const { data, error: rpcError } = await supabase.rpc("create_community_ticket", { p_community_id: communityId, p_user_id: userId });
    if (rpcError) { setError(rpcError.message || "Ticket could not be created."); setState("idle"); return; }
    setTicket(data); setState("created"); onTicketCreated?.(data);
  };

  const closeTicket = async () => {
    setState("sending"); setError("");
    const { error: rpcError } = await supabase.rpc("close_community_ticket", { p_channel_id: channelId, p_user_id: userId });
    if (rpcError) { setError(rpcError.message || "Ticket could not be closed."); setState("created"); return; }
    setState("closed");
  };

  const deleteTicket = async () => {
    if (state !== "closed" || state === "sending") return;
    setState("sending"); setError("");
    const { error: rpcError } = await supabase.rpc("delete_community_ticket", { p_channel_id: channelId, p_user_id: userId });
    if (rpcError) { setError(rpcError.message || "Ticket could not be deleted."); setState("closed"); return; }
    onTicketDeleted?.(channelId);
  };

  if (isPrivateTicket) return <section className="community-ticket-tool"><div className="ticket-tool-head"><div className="ticket-tool-icon"><Mail size={20} /></div><div><span>Private support</span><h2>{config.closeTitle}</h2><p>{config.closeDescription}</p></div></div>{state === "closed" && <div className="ticket-sent"><CheckCircle2 size={20} /> Ticket closed and ready to delete.</div>}<div className="ticket-actions"><button type="button" onClick={closeTicket} disabled={state === "sending" || state === "closed"}><XCircle size={15} /> Close ticket</button><button type="button" className="ticket-delete-button" onClick={deleteTicket} disabled={state !== "closed" || state === "sending"}><Trash2 size={15} /> Delete ticket</button></div>{error && <div className="ticket-error">{error}</div>}<style>{`.community-ticket-tool{max-width:560px;margin:18px auto;padding:18px;border:1px solid rgba(156,255,0,.18);border-radius:14px;background:linear-gradient(145deg,rgba(24,33,25,.96),rgba(9,13,10,.98));color:#eef8ed}.ticket-tool-head{display:flex;gap:12px;align-items:flex-start;margin-bottom:16px}.ticket-tool-icon{width:42px;height:42px;display:grid;place-items:center;border-radius:11px;color:#9cff00;background:rgba(156,255,0,.1);border:1px solid rgba(156,255,0,.28)}.ticket-tool-head span{font-size:10px;text-transform:uppercase;letter-spacing:.12em;color:#9cff00;font-weight:800}.ticket-tool-head h2{margin:3px 0;font-size:20px}.ticket-tool-head p{margin:0;color:#89a08b;font-size:12px}.ticket-actions{display:flex;gap:8px;flex-wrap:wrap}.ticket-actions button{display:flex;align-items:center;gap:7px;padding:10px 13px;border:0;border-radius:9px;background:#ef6262;color:#fff;font-weight:800;cursor:pointer}.ticket-actions button:disabled{opacity:.4;cursor:not-allowed}.ticket-actions .ticket-delete-button{background:#8b2d38}.ticket-actions .ticket-delete-button:not(:disabled){background:#dc3545}.ticket-sent{display:flex;gap:8px;align-items:center;padding:12px;margin-bottom:12px;border-radius:9px;background:rgba(156,255,0,.1);color:#caff9a;font-size:12px}.ticket-error{margin-top:9px;color:#ffaaa3;font-size:11px}`}</style></section>;
  return <section className="community-ticket-tool"><div className="ticket-tool-head"><div className="ticket-tool-icon"><Mail size={20} /></div><div><span>Private support</span><h2>{config.title}</h2><p>{config.description}</p></div></div>{state === "closed" ? <div className="ticket-sent"><CheckCircle2 size={20} /> Ticket closed.</div> : state === "created" ? <><div className="ticket-sent"><CheckCircle2 size={20} /> Your private ticket channel is ready.</div><div className="ticket-close-card"><strong>{config.closeTitle}</strong><span>{config.closeDescription}</span><button type="button" onClick={closeTicket} disabled={state === "sending"}><XCircle size={15} /> Close ticket</button></div></> : <button type="button" onClick={createTicket} disabled={state === "sending"}><Send size={15} /> {state === "sending" ? "Creating..." : "Create private ticket"}</button>}{error && <div className="ticket-error">{error}</div>}<style>{`.community-ticket-tool{max-width:560px;margin:18px auto;padding:18px;border:1px solid rgba(156,255,0,.18);border-radius:14px;background:linear-gradient(145deg,rgba(24,33,25,.96),rgba(9,13,10,.98));color:#eef8ed}.ticket-tool-head{display:flex;gap:12px;align-items:flex-start;margin-bottom:16px}.ticket-tool-icon{width:42px;height:42px;display:grid;place-items:center;border-radius:11px;color:#9cff00;background:rgba(156,255,0,.1);border:1px solid rgba(156,255,0,.28)}.ticket-tool-head span{font-size:10px;text-transform:uppercase;letter-spacing:.12em;color:#9cff00;font-weight:800}.ticket-tool-head h2{margin:3px 0;font-size:20px}.ticket-tool-head p{margin:0;color:#89a08b;font-size:12px}.community-ticket-tool>button,.ticket-close-card button{display:flex;align-items:center;gap:7px;padding:10px 13px;border:0;border-radius:9px;background:#9cff00;color:#071000;font-weight:800;cursor:pointer}.ticket-close-card{display:flex;flex-direction:column;gap:6px;margin-top:12px;padding:12px;border:1px solid rgba(255,255,255,.1);border-radius:10px}.ticket-close-card span{color:#89a08b;font-size:12px}.ticket-close-card button{margin-top:5px;background:#ef6262;color:#fff}.ticket-sent{display:flex;gap:8px;align-items:center;padding:12px;border-radius:9px;background:rgba(156,255,0,.1);color:#caff9a;font-size:12px}.ticket-error{margin-top:9px;color:#ffaaa3;font-size:11px}`}</style></section>;
}
