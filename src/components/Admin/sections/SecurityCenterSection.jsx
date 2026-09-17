import React, { useState } from "react";
import { AlertTriangle, BookOpen, CheckCircle2, ChevronDown, Shield, Users } from "lucide-react";
import { Section, Btn, Badge, Alert, C } from "../AdminUI.jsx";

const SECURITY_MODEL = [
  ["Trust boundaries", "The browser is untrusted. Authorization, wallet changes, admin lifecycle actions, alert visibility, and payment state must be enforced by Supabase RLS or authenticated server functions."],
  ["Identity and sessions", "Supabase JWTs identify users. Account status checks, local sign-out, 2FA, trusted-device review, and short-lived server authorization protect sensitive actions."],
  ["Data protection", "RLS policies scope user, community, support, wallet, and administrative data. Service-role keys belong only in server environments and must never be bundled into the browser."],
  ["Threat sensors", "Security events should be recorded for failed authentication, 2FA failures, suspicious device changes, privilege changes, payment anomalies, rate-limit breaches, and webhook verification failures. Warning and critical events become alarm records."],
  ["Response", "Admins acknowledge an alarm, investigate the linked event metadata, contain the account or endpoint, rotate affected credentials, and resolve only after evidence is recorded. A resolved alarm is not proof that an attack was harmless."],
];

const severityColor = { critical: C.danger, warning: C.warn, info: C.info };

export default function SecurityCenterSection({ adminData, securityCenter, team = [] }) {
  const { alerts, loading, error, reload, updateStatus, setViewers } = securityCenter;
  const [openId, setOpenId] = useState(null);
  const [notice, setNotice] = useState(null);
  const canManageVisibility = ["ceo_owner", "super_admin"].includes(adminData?.role);
  const openAlerts = alerts.filter((alert) => alert.status !== "resolved");

  const handleStatus = async (id, status) => {
    try { await updateStatus(id, status); setNotice({ type: "success", msg: `Alert ${status}.` }); }
    catch (e) { setNotice({ type: "error", msg: e.message }); }
  };

  const toggleViewer = async (alert, userId) => {
    const current = (alert.viewers || []).map((viewer) => viewer.admin_user_id);
    const next = current.includes(userId) ? current.filter((id) => id !== userId) : [...current, userId];
    try { await setViewers(alert.id, next); setNotice({ type: "success", msg: "Alert visibility updated." }); }
    catch (e) { setNotice({ type: "error", msg: e.message }); }
  };

  return <div>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 22 }}>
      <div>
        <h1 style={{ fontSize: 26, fontWeight: 800, color: C.text, margin: 0 }}>Security Center</h1>
        <p style={{ color: C.muted, fontSize: 14, marginTop: 4 }}>Alarm channel, response controls, and the Xeevia security model.</p>
      </div>
      <Btn icon={Shield} label="Refresh" size="sm" onClick={reload} />
    </div>
    {notice && <Alert type={notice.type} message={notice.msg} onClose={() => setNotice(null)} />}
    {error && <Alert type="error" message={error} />}

    <Section title="Alarm Channel" subtitle={`${openAlerts.length} open alarm${openAlerts.length === 1 ? "" : "s"}`} accent={openAlerts.some((a) => a.severity === "critical") ? C.danger : C.warn}>
      {loading ? <div style={{ color: C.muted, padding: 20 }}>Loading alarms...</div> : alerts.length === 0 ? <div style={{ color: C.muted, padding: 20, textAlign: "center" }}>No alarms recorded. Sensors will appear here when security events are emitted.</div> : alerts.map((alert) => {
        const color = severityColor[alert.severity] || C.info;
        const expanded = openId === alert.id;
        return <div key={alert.id} style={{ borderBottom: `1px solid ${C.border}`, padding: "12px 0" }}>
          <button type="button" onClick={() => setOpenId(expanded ? null : alert.id)} style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, background: "transparent", border: 0, color: C.text, cursor: "pointer", textAlign: "left" }}>
            <AlertTriangle size={16} color={color} />
            <span style={{ flex: 1 }}><Badge label={alert.severity} color={color} /> <strong style={{ marginLeft: 8 }}>{alert.title}</strong><small style={{ display: "block", color: C.muted, marginTop: 4 }}>{new Date(alert.created_at).toLocaleString()} · {alert.source}</small></span>
            <Badge label={alert.status} color={alert.status === "resolved" ? C.success : C.warn} /><ChevronDown size={15} style={{ transform: expanded ? "rotate(180deg)" : "none" }} />
          </button>
          {expanded && <div style={{ margin: "12px 0 0 26px", color: C.muted, fontSize: 12, lineHeight: 1.6 }}>
            <p style={{ margin: "0 0 10px" }}>{alert.description}</p>
            <pre style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere", padding: 10, background: C.bg3, borderRadius: 8, color: C.muted2, fontSize: 10 }}>{JSON.stringify(alert.metadata || {}, null, 2)}</pre>
            <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
              {alert.status === "open" && <Btn size="sm" label="Acknowledge" icon={CheckCircle2} onClick={() => handleStatus(alert.id, "acknowledged")} />}
              {alert.status !== "resolved" && <Btn size="sm" label="Resolve" icon={CheckCircle2} variant="primary" onClick={() => handleStatus(alert.id, "resolved")} />}
            </div>
            {canManageVisibility && <div style={{ marginTop: 14, paddingTop: 12, borderTop: `1px solid ${C.border}` }}><div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8, color: C.text }}><Users size={13} /> Admin visibility</div>{team.filter((member) => member.role !== "ceo_owner").map((member) => { const checked = (alert.viewers || []).some((viewer) => viewer.admin_user_id === member.user_id); return <label key={member.user_id} style={{ display: "inline-flex", alignItems: "center", gap: 6, margin: "0 12px 6px 0", fontSize: 11 }}><input type="checkbox" checked={checked} onChange={() => toggleViewer(alert, member.user_id)} />{member.full_name}</label>; })}</div>}
          </div>}
        </div>;
      })}
    </Section>

    {adminData?.role === "ceo_owner" && <Section title="Security Model" subtitle="CEO-only operational document" accent={C.accent}>
      <div style={{ display: "grid", gap: 12 }}>{SECURITY_MODEL.map(([title, body]) => <article key={title} style={{ padding: "13px 15px", background: C.bg3, border: `1px solid ${C.border}`, borderRadius: 10 }}><div style={{ display: "flex", alignItems: "center", gap: 8, color: C.text, fontWeight: 800, fontSize: 13 }}><BookOpen size={14} color={C.accent} />{title}</div><p style={{ color: C.muted, fontSize: 12, lineHeight: 1.65, margin: "8px 0 0" }}>{body}</p></article>)}</div>
      <div style={{ marginTop: 14, padding: 14, borderRadius: 10, border: `1px solid ${C.danger}35`, background: `${C.danger}08`, color: C.muted, fontSize: 12, lineHeight: 1.65 }}><strong style={{ color: C.danger }}>CEO operating rule:</strong> Never paste service keys into browser code, chat, screenshots, tickets, or local storage. Rotate immediately after any suspected exposure. No UI-hidden action is a security boundary.</div>
    </Section>}
  </div>;
}