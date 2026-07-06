import React, { useEffect, useState } from "react";
import ReactDOM from "react-dom";

function formatSubtitle(detail, message) {
  return detail || message || "Tap below to continue.";
}

const AppPrompt = () => {
  const [visible, setVisible] = useState(false);
  const [type, setType] = useState(null);
  const [subtitle, setSubtitle] = useState("");
  const [showSnooze, setShowSnooze] = useState(false);

  useEffect(() => {
    const handler = (e) => {
      const d = e?.detail || {};
      setType(d.type || null);
      setSubtitle(formatSubtitle(d.detail, d.message));
      setShowSnooze(false);
      setVisible(true);
    };
    window.addEventListener("xv:show-app-prompt", handler);
    return () => window.removeEventListener("xv:show-app-prompt", handler);
  }, []);

  if (!visible) return null;

  const title = type === "update" ? "Update ready" : type === "push" ? "Enable alerts" : "Install app";

  const dismiss = (hours = 24) => {
    try { const fn = window.__xvSchedulePrompt; if (typeof fn === "function") fn(type, hours); } catch {}
    setVisible(false);
  };

  const doAction = async () => {
    setVisible(false);
    if (type === "install") {
      try {
        const ev = window.__xvDeferredInstallEvent;
        if (ev && typeof ev.prompt === "function") {
          ev.prompt();
          const choice = await ev.userChoice;
          if (choice?.outcome === "accepted") {
            try { localStorage.setItem("xv_pwa_installed", "1"); } catch (e) {}
            try { const fn = window.__xvClearPromptSchedule; if (typeof fn === "function") fn("install"); } catch {}
          }
        }
      } catch (e) {}
    } else if (type === "update") {
      try { const fn = window.__xvClearPromptSchedule; if (typeof fn === "function") fn("update"); } catch {}
      window.location.reload();
    } else if (type === "push") {
      if (typeof window.__xvRequestPushPermission === "function") {
        try { await window.__xvRequestPushPermission(); } catch {}
      }
    }
  };

  const snoozeOptions = type === "install" || type === "push" ? [12, 24, 48] : [12, 24];

  return ReactDOM.createPortal(
    <div style={{ position: "fixed", left: 0, right: 0, bottom: 24, display: "flex", justifyContent: "center", zIndex: 2147483647 }}>
      <div style={{ width: "min(92vw,420px)", background: "var(--panel)", border: "1px solid var(--accent-border)", borderRadius: 18, padding: 14, display: "flex", gap: 12, alignItems: "center", boxShadow: "0 10px 40px var(--shadow)" }}>
        <div style={{ width:40, height:40, borderRadius:12, overflow:"hidden", display:"flex", alignItems:"center", justifyContent:"center", background:"linear-gradient(180deg,#0b0b0b,#111)", border:"2px solid rgba(255,255,255,0.06)" }}>
          <img src="/logo192.png" alt="Xeevia" style={{ width:28, height:28, objectFit:"contain", display:"block", borderRadius:8, background:"rgba(0,0,0,0.45)", padding:3, border:"1px solid rgba(255,255,255,0.06)" }} />
        </div>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ fontSize:13, fontWeight:800, color: "var(--text-strong)", marginBottom:2 }}>{title}</div>
          <div style={{ fontSize:11, color:"var(--text-secondary)", lineHeight:1.45 }}>{subtitle}</div>
        </div>
        <div style={{ display:"flex", gap:8 }}>
          {!showSnooze ? (
            <>
              <button onClick={() => setShowSnooze(true)} style={{ border:"1px solid rgba(255,255,255,0.12)", background:"var(--surface-card)", color:"var(--text-strong)", padding:"8px 10px", borderRadius:12, fontWeight:700 }}>Ignore</button>
              <button onClick={doAction} style={{ border:"1px solid rgba(132,204,22,0.18)", background:"linear-gradient(180deg,#7fd32a,#5fae10)", color:"var(--accent-inverse-text)", padding:"8px 12px", borderRadius:12, fontWeight:800 }}> {type === "install" ? "Install" : type === "update" ? "Refresh" : "Enable"}</button>
            </>
          ) : (
            <div style={{ display:"flex", gap:8 }}>
              {snoozeOptions.map(h => (
                <button key={h} onClick={() => dismiss(h)} style={{ border:"1px solid rgba(132,204,22,0.18)", background:"rgba(132,204,22,.06)", color:"#84cc16", padding:"6px 10px", borderRadius:8, fontWeight:700 }}>{h===24?"Tomorrow":(h===12?"12 hrs":"In 2 days")}</button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>, document.body,
  );
};

export default AppPrompt;
