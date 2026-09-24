import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Eye, Globe, Hash, Lock, Megaphone, Send, Volume2 } from "lucide-react";
import accessService, { targetKey } from "../../../../services/community/accessService";

const LEVELS = [
  { id: "none", label: "No access", icon: Lock },
  { id: "view", label: "View", icon: Eye },
  { id: "send", label: "View + send", icon: Send },
];
const channelIcon = (type) => (type === "voice" ? Volume2 : type === "announcement" ? Megaphone : Hash);

export default function RoleAccessPanel({ communityId, role, roles = [], canManage = false, onChanged }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState(null);

  const load = useCallback(async () => {
    try { setData(await accessService.fetchStructure(communityId)); setError(""); }
    catch (e) { setError(e.message || "Could not load access rules. Has the SQL migration been run?"); }
  }, [communityId]);
  useEffect(() => { load(); }, [load]);

  const byTarget = useMemo(() => accessService.groupRules(data?.rules || []), [data]);
  const rowsOf = (type, id) => byTarget.get(targetKey(type, id)) || [];
  const catOf = (channel) => accessService.categoryIdOf(channel, data?.categories);
  const roleName = (id) => roles.find((r) => r.id === id)?.name || "Unknown role";

  const levelFrom = (rows) => {
    const row = rows.find((r) => r.role_id === role.id);
    return !row || !row.can_view ? "none" : row.can_send ? "send" : "view";
  };
  const stateOf = (type, id, channel) => {
    const own = rowsOf(type, id);
    if (own.length) return { restricted: true, inherited: false, level: levelFrom(own) };
    if (type === "channel") {
      const parent = rowsOf("category", catOf(channel));
      if (parent.length) return { restricted: true, inherited: true, level: levelFrom(parent) };
    }
    return { restricted: false, inherited: false, level: "open" };
  };
  const seedFor = (type, channel) => {
    const parent = type === "channel" ? rowsOf("category", catOf(channel)) : [];
    if (parent.length) return parent.map((r) => ({ roleId: r.role_id, canView: r.can_view, canSend: r.can_send }));
    return roles.filter((r) => !r.is_default).map((r) => ({ roleId: r.id, canView: true, canSend: true }));
  };

  const run = async (fn) => {
    setBusy(true); setError("");
    try { await fn(); await load(); accessService.notifyAccessChanged(); onChanged?.(); }
    catch (e) { setError(e.message || "Could not save access."); }
    finally { setBusy(false); }
  };
  const apply = (target, level, seed) => {
    const merged = new Map(seed.map((r) => [r.roleId, r]));
    merged.set(role.id, { roleId: role.id, canView: level !== "none", canSend: level === "send" });
    return accessService.upsertRules(communityId, target.type, target.id, [...merged.values()]);
  };
  const choose = (target, level) => {
    if (!canManage || busy) return;
    const st = stateOf(target.type, target.id, target.channel);
    if (st.level === level && !st.inherited) return;
    if (rowsOf(target.type, target.id).length) return run(() => apply(target, level, []));
    setPending({ target, level, seed: seedFor(target.type, target.channel) });
  };
  const confirm = () => { const p = pending; setPending(null); if (p.kind === "open") run(() => accessService.openTarget(p.target.type, p.target.id)); else run(() => apply(p.target, p.level, p.seed)); };

  if (!data) return <div className="rap">{error ? <p className="rap-err">{error}</p> : <p className="rap-muted">Loading access…</p>}</div>;

  const groups = [
    ...data.categories.map((cat) => ({ cat, channels: data.channels.filter((ch) => catOf(ch) === cat.id) })),
    { cat: null, channels: data.channels.filter((ch) => !catOf(ch)) },
  ].filter((g) => g.cat || g.channels.length);
  const granted = [...data.categories.map((c) => stateOf("category", c.id)), ...data.channels.map((c) => stateOf("channel", c.id, c))].filter((s) => s.level === "view" || s.level === "send").length;

  const Row = ({ type, id, label, Icon, channel, nested }) => {
    const st = stateOf(type, id, channel);
    const ownRules = rowsOf(type, id).length;
    return (
      <div className={`rap-row${nested ? " nested" : ""}`}>
        <div className="rap-name"><Icon size={13} /><strong>{label}</strong>
          {st.restricted ? <em className="rap-badge lock"><Lock size={9} /> {st.inherited ? "Inherits category" : "Restricted"}</em> : <em className="rap-badge open"><Globe size={9} /> Open to everyone</em>}
        </div>
        <div className="rap-levels">
          {LEVELS.map((lv) => (
            <button type="button" key={lv.id} disabled={!canManage || busy} className={st.level === lv.id ? "on" : ""} onClick={() => choose({ type, id, channel, label }, lv.id)}><lv.icon size={11} /> {lv.label}</button>
          ))}
          {ownRules > 0 && canManage && <button type="button" className="rap-open" disabled={busy} onClick={() => setPending({ kind: "open", target: { type, id, label }, count: ownRules })}>Open to everyone</button>}
        </div>
      </div>
    );
  };

  return (
    <div className="rap">
      <div className="rap-head"><strong>{role.name}</strong><span>{granted} restricted target{granted === 1 ? "" : "s"} unlocked. Rules save instantly.</span></div>
      {pending && (
        <div className="rap-confirm">
          {pending.kind === "open" ? (
            <p><b>{pending.target.label}</b> will be open to every member again. This removes {pending.count} rule{pending.count === 1 ? "" : "s"}.</p>
          ) : (
            <>
              <p><b>{pending.target.label}</b> is {pending.target.channel && catOf(pending.target.channel) && rowsOf("category", catOf(pending.target.channel)).length ? "inheriting its category's access" : "open to everyone"} right now. Continuing gives it its own access list. Only these roles will keep access:</p>
              <div className="rap-chips">{[...new Map([...pending.seed.map((r) => [r.roleId, r]), [role.id, { roleId: role.id, canView: pending.level !== "none", canSend: pending.level === "send" }]]).values()].filter((r) => r.canView).map((r) => <span key={r.roleId}>{roleName(r.roleId)}{r.roleId === role.id ? ` (${pending.level === "send" ? "view + send" : "view"})` : ""}</span>)}</div>
              <p className="rap-muted">Everyone else, including the default role, loses access. Owners and administrators always keep it.</p>
            </>
          )}
          <div className="rap-actions"><button type="button" onClick={() => setPending(null)}>Cancel</button><button type="button" className="go" onClick={confirm}>Confirm</button></div>
        </div>
      )}
      {error && <p className="rap-err">{error}</p>}
      {groups.map((g) => (
        <div className="rap-group" key={g.cat?.id || "none"}>
          {g.cat ? <Row type="category" id={g.cat.id} label={g.cat.name} Icon={Lock} /> : <div className="rap-uncat">Uncategorised</div>}
          {g.channels.map((ch) => { const I = channelIcon(ch.type); return <Row key={ch.id} type="channel" id={ch.id} label={`#${ch.name}`} Icon={I} channel={ch} nested />; })}
        </div>
      ))}
      <style>{`.rap{display:flex;flex-direction:column;gap:8px}.rap-head{display:flex;flex-direction:column;gap:2px}.rap-head strong{font-size:13px;color:var(--text,#eef4ee)}.rap-head span,.rap-muted{font-size:10px;color:var(--text-secondary,#8ea08f);margin:0}.rap-err{margin:0;color:var(--danger,#ff6b6b);font-size:11px}.rap-group{display:flex;flex-direction:column;gap:5px;padding:8px;border:1px solid var(--surface-border,rgba(255,255,255,.09));border-radius:10px;background:rgba(0,0,0,.14)}.rap-uncat{font-size:10px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:var(--text-secondary,#8ea08f)}.rap-row{display:flex;flex-direction:column;gap:6px;padding:8px;border-radius:8px;background:var(--surface,rgba(255,255,255,.04))}.rap-row.nested{margin-left:14px}.rap-name{display:flex;align-items:center;gap:6px;flex-wrap:wrap;color:var(--text,#eef4ee);font-size:12px}.rap-badge{display:inline-flex;align-items:center;gap:3px;padding:2px 6px;border-radius:99px;font-style:normal;font-size:9px;font-weight:800}.rap-badge.open{background:rgba(255,255,255,.06);color:var(--text-secondary,#8ea08f)}.rap-badge.lock{background:rgba(245,158,11,.14);color:#f5b84b}.rap-levels{display:flex;flex-wrap:wrap;gap:4px}.rap-levels button{display:inline-flex;align-items:center;gap:4px;padding:5px 8px;border:1px solid var(--surface-border,rgba(255,255,255,.09));border-radius:7px;background:transparent;color:var(--text-secondary,#8ea08f);font:700 10px inherit;cursor:pointer}.rap-levels button.on{border-color:var(--accent,#9cff00);background:var(--accent-bg,rgba(156,255,0,.1));color:var(--accent,#9cff00)}.rap-levels button:disabled{opacity:.45;cursor:not-allowed}.rap-levels .rap-open{margin-left:auto;border-style:dashed}.rap-confirm{padding:11px;border:1px solid rgba(245,158,11,.4);border-radius:10px;background:rgba(245,158,11,.08);font-size:11px;color:var(--text,#eef4ee)}.rap-confirm p{margin:0 0 7px;line-height:1.5}.rap-chips{display:flex;flex-wrap:wrap;gap:4px;margin-bottom:7px}.rap-chips span{padding:3px 8px;border-radius:99px;background:var(--accent-bg,rgba(156,255,0,.1));color:var(--accent,#9cff00);font-size:10px;font-weight:700}.rap-actions{display:flex;gap:6px;justify-content:flex-end}.rap-actions button{padding:6px 12px;border:1px solid var(--surface-border,rgba(255,255,255,.09));border-radius:7px;background:transparent;color:var(--text,#eef4ee);font:800 10px inherit;cursor:pointer}.rap-actions .go{background:var(--accent,#9cff00);color:#0b1200;border-color:transparent}`}</style>
    </div>
  );
}
