import React, { useEffect, useState } from "react";
import { Check, Forward, Search, X } from "lucide-react";
import { supabase } from "../../../services/config/supabase";
import dmMessageService from "../../../services/messages/dmMessageService";

const ForwardMessageModal = ({ message, userId, onClose, onOpenDm }) => {
  const [contacts, setContacts] = useState([]);
  const [selected, setSelected] = useState([]);
  const [search, setSearch] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    let active = true;
    const loadContacts = async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id, full_name, username, avatar_id")
        .neq("id", userId)
        .order("full_name", { ascending: true })
        .limit(80);
      if (active) setContacts(data || []);
    };
    loadContacts();
    return () => { active = false; };
  }, [userId]);

  const visibleContacts = contacts.filter((contact) => {
    const query = search.toLowerCase();
    return !query || `${contact.full_name || ""} ${contact.username || ""}`.toLowerCase().includes(query);
  });

  const toggle = (id) => setSelected((current) => current.includes(id)
    ? current.filter((value) => value !== id)
    : [...current, id]);

  const handleSend = async () => {
    if (!selected.length || sending) return;
    setSending(true);
    try {
      const body = `↗ Forwarded message\n${message.user?.full_name || message.user?.username || "Community member"}: ${message.content}`;
      await Promise.all(selected.map(async (recipientId) => {
        const conversation = await dmMessageService.createConversation(userId, recipientId);
        await dmMessageService.sendMessage(conversation.id, body, userId);
      }));
      setSent(true);
      onClose();
      onOpenDm?.(selected[0]);
    } catch (error) {
      console.error("Forward message error:", error);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="forward-overlay" onClick={onClose}>
      <section className="forward-modal" onClick={(event) => event.stopPropagation()}>
        <header className="forward-head"><div><Forward size={16} /><strong>Forward message</strong></div><button onClick={onClose} aria-label="Close"><X size={16} /></button></header>
        <div className="forward-preview"><span>↗ Forwarded message</span><p>{message.content}</p></div>
        <div className="forward-search"><Search size={14} /><input autoFocus value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search people..." /></div>
        <div className="forward-list">
          {visibleContacts.map((contact) => {
            const isSelected = selected.includes(contact.id);
            return <button key={contact.id} className={`forward-contact${isSelected ? " selected" : ""}`} onClick={() => toggle(contact.id)}>
              <span className="forward-contact-avatar">{contact.full_name?.charAt(0)?.toUpperCase() || "?"}</span>
              <span><strong>{contact.full_name || contact.username || "Unknown"}</strong><small>@{contact.username || "user"}</small></span>
              <span className="forward-check">{isSelected && <Check size={14} />}</span>
            </button>;
          })}
          {!visibleContacts.length && <p className="forward-empty">No people found.</p>}
        </div>
        <footer className="forward-foot"><span>{sent ? "Sent" : `${selected.length} selected`}</span><button disabled={!selected.length || sending || sent} onClick={handleSend}>{sent ? "Sent" : sending ? "Sending..." : "Send"}</button></footer>
      </section>
      <style>{`
        .forward-overlay{position:fixed;inset:0;z-index:100001;display:flex;align-items:center;justify-content:center;padding:16px;background:rgba(0,0,0,.64);backdrop-filter:blur(10px)}
        .forward-modal{width:min(390px,100%);max-height:min(620px,calc(100vh - 32px));display:flex;flex-direction:column;overflow:hidden;background:#0c120e;border:1px solid rgba(156,255,0,.28);border-radius:16px;box-shadow:0 24px 70px rgba(0,0,0,.75),0 0 28px rgba(156,255,0,.08)}
        .forward-head,.forward-foot{display:flex;align-items:center;justify-content:space-between;padding:13px 15px;border-bottom:1px solid rgba(255,255,255,.07)}.forward-foot{border-top:1px solid rgba(255,255,255,.07);border-bottom:0;color:#78947d;font-size:11px}.forward-head>div{display:flex;align-items:center;gap:8px;color:#eaffea}.forward-head svg{color:#9cff00}.forward-head button{width:27px;height:27px;border:1px solid rgba(255,255,255,.1);border-radius:7px;background:rgba(255,255,255,.04);color:#8a9a8c;cursor:pointer}
        .forward-preview{padding:12px 15px;background:rgba(156,255,0,.06);border-left:3px solid #9cff00}.forward-preview span{color:#9cff00;font-size:10px;font-weight:800}.forward-preview p{margin:5px 0 0;color:#c8d5c9;font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        .forward-search{display:flex;align-items:center;gap:8px;margin:11px 12px 7px;padding:9px 10px;border:1px solid rgba(156,255,0,.22);border-radius:9px;background:#081009;color:#6b876f}.forward-search input{flex:1;border:0;outline:0;background:transparent;color:#effff0;font-size:12px}.forward-search input::placeholder{color:#58705c}
        .forward-list{flex:1;min-height:0;overflow-y:auto;padding:0 10px 10px}.forward-contact{width:100%;display:flex;align-items:center;gap:9px;padding:8px;border:1px solid transparent;border-radius:9px;background:transparent;color:#cfe0d0;text-align:left;cursor:pointer}.forward-contact:hover,.forward-contact.selected{background:rgba(156,255,0,.09);border-color:rgba(156,255,0,.22)}.forward-contact-avatar{width:31px;height:31px;border-radius:50%;display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,#315d38,#142319);border:1px solid rgba(156,255,0,.28);color:#baff82;font-size:12px;font-weight:800}.forward-contact span:nth-child(2){display:flex;flex-direction:column;gap:2px;min-width:0}.forward-contact strong{font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.forward-contact small{color:#69816d;font-size:10px}.forward-check{margin-left:auto;width:21px;height:21px;border:1px solid rgba(255,255,255,.14);border-radius:6px;display:flex;align-items:center;justify-content:center;color:#071007;background:transparent}.forward-contact.selected .forward-check{background:#9cff00;border-color:#9cff00}.forward-empty{padding:20px;color:#607263;text-align:center;font-size:12px}.forward-foot button{padding:8px 20px;border:0;border-radius:8px;background:linear-gradient(135deg,#9cff00,#62a8e8);color:#081007;font-size:11px;font-weight:800;cursor:pointer}.forward-foot button:disabled{opacity:.45;cursor:not-allowed}
      `}</style>
    </div>
  );
};

export default ForwardMessageModal;
