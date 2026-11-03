import React, { useEffect, useMemo, useState } from "react";
import { ArrowUpRight, Check, Link2, Plus, Trash2 } from "lucide-react";

function validateUrl(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  return ["http:", "https:"].includes(url.protocol) ? url.toString() : null;
}

const cleanLinks = (links) => (Array.isArray(links) ? links : [])
  .filter((link) => link && typeof link.id === "string" && typeof link.label === "string" && typeof link.url === "string")
  .map((link) => ({ ...link, url: validateUrl(link.url) }))
  .filter((link) => link.url);

export default function OfficialLinksPanel({ channel, canManage = false, onSave }) {
  const savedLinks = useMemo(() => cleanLinks(channel?.integrations?.officialLinks), [channel?.integrations?.officialLinks]);
  const [links, setLinks] = useState(savedLinks);
  const [label, setLabel] = useState("");
  const [url, setUrl] = useState("");
  const [description, setDescription] = useState("");
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setLinks(savedLinks);
    setEditing(false);
    setError("");
  }, [channel?.id, savedLinks]);

  const addLink = async (event) => {
    event.preventDefault();
    const cleanLabel = label.trim();
    const cleanUrl = validateUrl(url.trim());
    if (!cleanLabel) {
      setError("Give this link a short name.");
      return;
    }
    if (!cleanUrl) {
      setError("Enter a valid http or https link.");
      return;
    }

    const nextLinks = [...links, {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      label: cleanLabel.slice(0, 60),
      url: cleanUrl,
      description: description.trim().slice(0, 120),
    }];
    await persistLinks(nextLinks);
    setLabel("");
    setUrl("");
    setDescription("");
  };

  const persistLinks = async (nextLinks) => {
    setSaving(true);
    setError("");
    try {
      await onSave(nextLinks);
      setLinks(nextLinks);
    } catch (saveError) {
      setError(saveError.message || "Could not save official links.");
    } finally {
      setSaving(false);
    }
  };

  const removeLink = (id) => persistLinks(links.filter((link) => link.id !== id));

  return (
    <section className="official-links-panel" aria-label="Official community links">
      <header className="official-links-header">
        <div className="official-links-icon"><Link2 size={19} aria-hidden="true" /></div>
        <div className="official-links-heading">
          <span>COMMUNITY DIRECTORY</span>
          <h1>{channel?.name ? channel.name.replace(/-/g, " ") : "Official links"}</h1>
          <p>Trusted places to find and follow our community.</p>
        </div>
        {canManage && (
          <button type="button" className={`official-links-manage${editing ? " active" : ""}`} onClick={() => setEditing((current) => !current)}>
            {editing ? "Done" : "Manage"}
          </button>
        )}
      </header>

      {links.length ? (
        <div className="official-links-grid">
          {links.map((link) => (
            <div className="official-link-entry" key={link.id}>
              <a className="official-link-button" href={link.url} target="_blank" rel="noopener noreferrer">
                <span className="official-link-symbol"><Link2 size={15} aria-hidden="true" /></span>
                <span className="official-link-copy">
                  <strong>{link.label}</strong>
                  {link.description && <small>{link.description}</small>}
                  <span>{new URL(link.url).hostname.replace(/^www\./, "")}</span>
                </span>
                <ArrowUpRight className="official-link-arrow" size={16} aria-hidden="true" />
              </a>
              {editing && <button type="button" className="official-link-remove" onClick={() => removeLink(link.id)} disabled={saving} aria-label={`Remove ${link.label}`}><Trash2 size={14} /></button>}
            </div>
          ))}
        </div>
      ) : (
        <div className="official-links-empty">
          <span className="official-links-empty-icon"><Link2 size={18} /></span>
          <strong>No links added yet</strong>
          <p>Official sites and community destinations will appear here.</p>
        </div>
      )}

      {editing && (
        <form className="official-links-form" onSubmit={addLink}>
          <div className="official-links-form-heading"><Plus size={16} /><strong>Add a trusted link</strong></div>
          <label>Button name<input value={label} onChange={(event) => setLabel(event.target.value)} maxLength={60} placeholder="Website, Instagram, Support…" /></label>
          <label>Link address<input type="url" value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://example.com" /></label>
          <label>Short description <span>(optional)</span><input value={description} onChange={(event) => setDescription(event.target.value)} maxLength={120} placeholder="What members will find" /></label>
          {error && <p className="official-links-error" role="alert">{error}</p>}
          <button type="submit" className="official-links-add" disabled={saving}><Check size={15} />{saving ? "Saving…" : "Add link"}</button>
        </form>
      )}
      {!editing && error && <p className="official-links-error" role="alert">{error}</p>}

      <style>{`
        .official-links-panel{width:min(70%,760px);box-sizing:border-box;margin:24px auto;padding:20px;border:1px solid rgba(156,255,0,.2);border-radius:17px;background:linear-gradient(145deg,#131713,#080b09);color:#eff7ed;box-shadow:0 14px 36px rgba(0,0,0,.24),inset 0 1px 0 rgba(255,255,255,.04)}
        .official-links-header{display:flex;align-items:flex-start;gap:12px;padding-bottom:15px;border-bottom:1px solid rgba(255,255,255,.08)}
        .official-links-icon{display:grid;place-items:center;width:40px;height:40px;flex:0 0 auto;border:1px solid rgba(156,255,0,.22);border-radius:12px;background:rgba(156,255,0,.08);color:#b6ed7e}
        .official-links-heading{min-width:0;flex:1}
        .official-links-heading>span{display:block;color:#a6c58e;font-size:9px;font-weight:850;letter-spacing:.14em}
        .official-links-heading h1{margin:4px 0;color:#f2faef;font-size:20px;font-weight:850;line-height:1.2;text-transform:capitalize;overflow-wrap:anywhere}
        .official-links-heading p{margin:4px 0 0;color:#9da99c;font-size:12px;line-height:1.45}
        .official-links-manage{flex:0 0 auto;padding:7px 10px;border:1px solid rgba(156,255,0,.22);border-radius:8px;background:rgba(156,255,0,.07);color:#c6ed9e;font:700 11px inherit;cursor:pointer}
        .official-links-manage.active{background:#9cff00;color:#111}
        .official-links-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,220px),1fr));gap:9px;padding-top:14px}
        .official-link-entry{position:relative;min-width:0}
        .official-link-button{display:flex;align-items:center;gap:10px;min-height:64px;box-sizing:border-box;padding:10px 12px;border:1px solid rgba(255,255,255,.1);border-radius:11px;background:linear-gradient(145deg,rgba(255,255,255,.055),rgba(255,255,255,.02));color:inherit;text-decoration:none;transition:border-color .16s ease,background .16s ease,transform .16s ease}
        .official-link-button:hover{transform:translateY(-1px);border-color:rgba(156,255,0,.42);background:linear-gradient(145deg,rgba(156,255,0,.09),rgba(255,255,255,.025))}
        .official-link-symbol{display:grid;place-items:center;width:32px;height:32px;flex:0 0 auto;border-radius:9px;background:rgba(156,255,0,.1);color:#b7ec7e}
        .official-link-copy{display:grid;gap:3px;min-width:0;flex:1}
        .official-link-copy strong,.official-link-copy small,.official-link-copy>span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
        .official-link-copy strong{font-size:12px;font-weight:800}
        .official-link-copy small{color:#a7b2a5;font-size:10px}
        .official-link-copy>span{color:#778273;font-size:9px}
        .official-link-arrow{flex:0 0 auto;color:#a5c581}
        .official-link-remove{position:absolute;top:-6px;right:-6px;display:grid;place-items:center;width:25px;height:25px;border:1px solid rgba(255,130,130,.35);border-radius:50%;background:#191110;color:#ffaaa3;cursor:pointer}
        .official-links-empty{display:grid;justify-items:center;gap:6px;padding:24px 12px 10px;text-align:center}
        .official-links-empty-icon{display:grid;place-items:center;width:36px;height:36px;border:1px solid rgba(156,255,0,.18);border-radius:11px;background:rgba(156,255,0,.06);color:#a8d87d}
        .official-links-empty strong{font-size:12px}
        .official-links-empty p{margin:0;color:#8f998e;font-size:11px;line-height:1.45}
        .official-links-form{display:grid;gap:9px;margin-top:14px;padding:12px;border:1px solid rgba(255,255,255,.08);border-radius:12px;background:rgba(255,255,255,.025)}
        .official-links-form-heading{display:flex;align-items:center;gap:7px;color:#c5ed9c;font-size:12px}
        .official-links-form label{display:grid;gap:5px;color:#b9c3b6;font-size:10px;font-weight:700}
        .official-links-form label span{display:inline;color:#858f82;font-weight:400}
        .official-links-form input{width:100%;box-sizing:border-box;padding:9px 10px;border:1px solid rgba(255,255,255,.1);border-radius:8px;background:#090c0a;color:#eff7ed;font:inherit;font-size:11px}
        .official-links-form input:focus{outline:2px solid rgba(156,255,0,.38);border-color:rgba(156,255,0,.4)}
        .official-links-add{display:inline-flex;align-items:center;justify-content:center;gap:6px;justify-self:start;padding:8px 11px;border:0;border-radius:8px;background:#9cff00;color:#111;font:800 11px inherit;cursor:pointer}
        .official-links-add:disabled{opacity:.55;cursor:wait}
        .official-links-error{margin:0;color:#ffaaa3;font-size:11px}
        @media(max-width:768px){.official-links-panel{width:80%;margin:12px auto;padding:13px;border-radius:13px}.official-links-header{gap:9px;padding-bottom:11px}.official-links-icon{width:34px;height:34px;border-radius:10px}.official-links-heading h1{font-size:17px}.official-links-heading p{font-size:11px}.official-links-manage{padding:6px 8px;font-size:10px}.official-links-grid{grid-template-columns:minmax(0,1fr);gap:7px;padding-top:10px}.official-link-button{min-height:56px;padding:8px 9px}.official-links-form{gap:8px;margin-top:10px;padding:10px}}
      `}</style>
    </section>
  );
}
