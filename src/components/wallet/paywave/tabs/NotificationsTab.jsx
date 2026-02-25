// paywave/tabs/NotificationsTab.jsx
import React from "react";
import { CheckCircle, AlertCircle, Info } from "lucide-react";
import { Header } from "../components/UI";

export default function NotificationsTab({ notifications, setNotifications, onBack }) {
  const markRead = (id) =>
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));

  const typeConfig = {
    success: { icon: CheckCircle, color: "var(--lime)",  bg: "rgba(163,230,53,0.1)" },
    alert:   { icon: AlertCircle, color: "#f87171",      bg: "rgba(239,68,68,0.12)" },
    info:    { icon: Info,        color: "var(--gold)",  bg: "var(--gold-dim)"       },
  };

  return (
    <div className="pw-scroll">
      <Header title="Notifications" onBack={onBack} />
      <div style={{ padding: "0 15px" }}>
        {notifications.length === 0 && (
          <div style={{ textAlign: "center", padding: "60px 0", color: "var(--text-soft)", fontSize: 13 }}>No notifications</div>
        )}
        <div className="space-y" style={{ paddingTop: 4 }}>
          {notifications.map(n => {
            const cfg = typeConfig[n.type] || typeConfig.info;
            const Icon = cfg.icon;
            return (
              <div key={n.id} className="glass click"
                style={{ padding: "13px 14px", borderColor: !n.read ? "var(--lime-border)" : "var(--border)", cursor: "pointer" }}
                onClick={() => markRead(n.id)}>
                <div style={{ display: "flex", alignItems: "flex-start", gap: 11 }}>
                  <div style={{ width: 36, height: 36, borderRadius: "50%", background: cfg.bg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <Icon size={16} color={cfg.color} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 2 }}>
                      <div style={{ fontFamily: "var(--font-d)", fontSize: 13.5, fontWeight: 700, color: "var(--text)" }}>{n.title}</div>
                      {!n.read && (
                        <div style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--lime)", boxShadow: "0 0 6px var(--lime)", marginTop: 3, flexShrink: 0 }} />
                      )}
                    </div>
                    <div style={{ color: "var(--text-soft)", fontSize: 12, marginBottom: 2 }}>{n.desc}</div>
                    <div style={{ color: "var(--text-muted)", fontSize: 11 }}>{n.time}</div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}