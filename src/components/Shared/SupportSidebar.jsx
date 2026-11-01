import React, { useState, useEffect } from "react";
import { X, HelpCircle, Sparkles, Download, Smartphone, RefreshCw } from "lucide-react";
import HelpTab    from "./Support-tabs/HelpTab";
import FAQTab     from "./Support-tabs/FAQTab";
import ContactTab from "./Support-tabs/ContactTab";
import { listPwaInstallReports, reportPwaInstallation } from "../../services/notifications/pwaInstallationService";

const NAV_TABS = [
  { key: "help",    emoji: "🏠", label: "Help"    },
  { key: "faq",     emoji: "❓", label: "FAQ"     },
  { key: "download", emoji: "📲", label: "App Status" },
  { key: "contact", emoji: "🎫", label: "Contact" },
];

function DownloadTab({ userId }) {
  const [status, setStatus] = useState({ kind: "checking" });
  const [updateMessage, setUpdateMessage] = useState("");
  const [checkingUpdates, setCheckingUpdates] = useState(false);

  useEffect(() => {
    let active = true;
    const loadStatus = async () => {
      const detectInstalled = window.__xvDetectInstalledApp;
      const installedHere = typeof detectInstalled === "function"
        ? await detectInstalled()
        : false;

      if (!userId) {
        if (active) setStatus({ kind: installedHere ? "installed_here" : "unverified" });
        return;
      }

      let reports;
      try {
        if (installedHere) await reportPwaInstallation(userId);
        reports = await listPwaInstallReports(userId);
      } catch (error) {
        console.error("[Support] Could not load PWA install reports:", error);
        if (active) {
          setStatus({ kind: installedHere ? "installed_here" : "unverified", syncError: true });
        }
        return;
      }

      window.__xvAccountInstallReported = reports.length > 0;
      if (!active) return;

      const lastConfirmedAt = reports.reduce((latest, report) => (
        !latest || new Date(report.last_confirmed_at) > new Date(latest)
          ? report.last_confirmed_at
          : latest
      ), null);

      if (installedHere) {
        setStatus({ kind: "installed_here", reportCount: reports.length });
      } else if (reports.length) {
        setStatus({
          kind: "reported_elsewhere",
          reportCount: reports.length,
          lastConfirmedAt,
        });
      } else {
        setStatus({ kind: "not_detected" });
      }
    };

    loadStatus().catch((error) => {
      console.error("[Support] Could not detect PWA installation:", error);
      if (active) setStatus({ kind: "unverified" });
    });

    return () => { active = false; };
  }, [userId]);

  const checkForUpdates = async () => {
    setCheckingUpdates(true);
    setUpdateMessage("");
    try {
      if (typeof window.__xvCheckForUpdates !== "function") {
        setUpdateMessage("Update checking is not available in this browser.");
        return;
      }
      const result = await window.__xvCheckForUpdates();
      const messages = {
        unsupported: "This browser does not support service-worker updates.",
        not_registered: "This browser profile has no app update registration.",
        update_ready: "An update is ready in this browser profile.",
        updated: "This browser profile has updated to the latest app version.",
        current: "This browser profile is up to date.",
        checking: "An update check is still running. Check again in a moment.",
      };
      setUpdateMessage(messages[result.status] || "Update status is unavailable.");
    } catch (error) {
      console.error("[Support] Update check failed:", error);
      setUpdateMessage("Could not check for updates. Please try again.");
    } finally {
      setCheckingUpdates(false);
    }
  };

  const installHere = async () => {
    try {
      const shown = await window.__xvRequestInstall?.();
      if (!shown) {
        setUpdateMessage("Use your browser’s Install or Add to Home Screen menu to install this profile.");
      }
    } catch (error) {
      console.error("[Support] Install request failed:", error);
      setUpdateMessage("Could not open the install prompt. Use your browser’s install menu.");
    }
  };

  const installedHere = status.kind === "installed_here";
  const reportedElsewhere = status.kind === "reported_elsewhere";
  const canOfferInstall = status.kind === "not_detected";
  const lastConfirmed = status.lastConfirmedAt
    ? new Date(status.lastConfirmedAt).toLocaleString()
    : null;
  const title = status.kind === "checking"
    ? "Checking app status…"
    : installedHere
      ? "Installed in this browser"
      : reportedElsewhere
        ? "Install reported on your account"
        : canOfferInstall
          ? "No install detected here"
          : "App status could not be verified";

  let description;
  if (installedHere) {
    description = "Xeevia is running as an installed app in this browser profile. Update checks below apply only to this profile.";
  } else if (reportedElsewhere) {
    description = "An installation was reported for this Xeevia account in another or previous browser profile. Browsers do not share install access, so this profile cannot confirm or update that installation.";
  } else if (canOfferInstall) {
    description = "No Xeevia installation was detected in this browser profile. This does not tell us whether another profile or browser has it installed.";
  } else {
    description = "The browser could not confirm installation status. You can still check updates for this browser profile.";
  }

  return (
    <div style={{ padding: 18 }}>
      <div style={{
        background: "linear-gradient(135deg, rgba(132,204,22,0.08), rgba(96,165,250,0.06))",
        border: "1px solid rgba(132,204,22,0.18)", borderRadius: 18, padding: 18,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
          <div style={{ width: 46, height: 46, borderRadius: 12, background: "rgba(132,204,22,0.12)", border: "1px solid rgba(132,204,22,0.22)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Smartphone size={20} color="#a3e635" />
          </div>
          <div>
            <div style={{ fontSize: 19, fontWeight: 800, color: "#fff" }}>{title}</div>
            <div style={{ fontSize: 12, color: "#6b7280" }}>Install and update status for this browser</div>
          </div>
        </div>

        <div style={{ color: "#d1d5db", fontSize: 14, lineHeight: 1.7, marginBottom: 18 }}>
          {description}
        </div>

        {reportedElsewhere && lastConfirmed && (
          <div style={{ color: "#9ca3af", fontSize: 12, marginBottom: 14 }}>
            Last confirmed in a browser profile: {lastConfirmed}
          </div>
        )}

        {(installedHere || reportedElsewhere || status.kind === "unverified") && (
          <div style={{ color: "#9ca3af", fontSize: 12, lineHeight: 1.5, marginBottom: 16 }}>
            A report on your account is install history, not proof that the app is still installed on this device.
          </div>
        )}

        <button onClick={canOfferInstall ? installHere : checkForUpdates} disabled={checkingUpdates || status.kind === "checking"} style={{
          width: "100%", border: "none", borderRadius: 12, background: "linear-gradient(135deg, #84cc16, #65a30d)",
          color: "#061400", fontSize: 15, fontWeight: 800, padding: "12px 14px", cursor: "pointer",
          opacity: checkingUpdates || status.kind === "checking" ? 0.6 : 1,
          boxShadow: "0 10px 28px rgba(132, 204, 22, 0.28)",
        }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
            {canOfferInstall
              ? <Download size={15} />
              : <RefreshCw size={15} style={{ animation: checkingUpdates ? "ssSpin 1s linear infinite" : "none" }} />}
            {canOfferInstall ? "Install in this browser" : checkingUpdates ? "Checking…" : "Check for updates"}
          </span>
        </button>
        {updateMessage && (
          <div role="status" aria-live="polite" style={{ color: "#d1d5db", fontSize: 13, lineHeight: 1.5, marginTop: 12 }}>
            {updateMessage}
          </div>
        )}
        {status.syncError && (
          <div role="status" style={{ color: "#fbbf24", fontSize: 12, lineHeight: 1.5, marginTop: 12 }}>
            Install status is shown locally, but account sync failed.
          </div>
        )}

        <div style={{ marginTop: 18, display: "grid", gap: 8 }}>
          {[
            "Browser install status is specific to this profile",
            "Account install reports can help other profiles avoid duplicate prompts",
            "An update check can only update this browser profile",
          ].map((point) => (
            <div key={point} style={{ display: "flex", gap: 8, alignItems: "flex-start", color: "#b7c1b2", fontSize: 13.5, lineHeight: 1.5 }}>
              <span style={{ color: "#a3e635", marginTop: 2 }}>✓</span>
              <span>{point}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

const SupportSidebar = ({ isOpen, onClose, isMobile, userId, adminData }) => {
  const [activeTab, setActiveTab] = useState("help");
  const [helpView,  setHelpView]  = useState("topics");

  useEffect(() => {
    if (isOpen) { setActiveTab("help"); setHelpView("topics"); }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleNavigateToContact = () => setActiveTab("contact");

  const headerTitle =
    activeTab === "help"
      ? helpView === "article" ? "Article"
        : helpView === "topic" ? "Topic"
        : "Help & Support"
      : activeTab === "faq" ? "FAQ"
      : activeTab === "download" ? "App Status & Updates"
      : "Contact Support";

  return (
    <>
      <style>{`
        @keyframes ssSlideIn {
          from { transform: translateX(100%); opacity: 0; }
          to   { transform: translateX(0);    opacity: 1; }
        }
        @keyframes ssFadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes ssGlow {
          0%,100% { box-shadow: 0 0 20px rgba(132,204,22,.06); }
          50%      { box-shadow: 0 0 40px rgba(132,204,22,.14); }
        }
        @keyframes ssSpin { to { transform: rotate(360deg); } }
        .ss-overlay {
          position: fixed; inset: 0;
          background: transparent;
          z-index: 999;
          animation: ssFadeIn 0.22s ease;
        }
        .ss-sidebar {
          position: fixed; top: 0; right: 0;
          width: 100%; max-width: ${isMobile ? "100%" : "440px"};
          height: 100dvh;
          background: var(--panel);
          border-left: 1px solid rgba(132,204,22,0.14);
          z-index: 1000;
          display: flex;
          flex-direction: column;
          animation: ssSlideIn .32s cubic-bezier(.22,1,.36,1);
          font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', sans-serif;
          overflow: hidden;
        }
        .ss-content {
          flex: 1;
          overflow-y: auto;
          overscroll-behavior: contain;
          -webkit-overflow-scrolling: touch;
          scroll-behavior: smooth;
        }
        .ss-content::-webkit-scrollbar       { width: 3px; }
        .ss-content::-webkit-scrollbar-track { background: transparent; }
        .ss-content::-webkit-scrollbar-thumb { background: rgba(132,204,22,.2); border-radius: 2px; }
        .ss-tab-btn {
          transition: all 0.18s cubic-bezier(.34,1.1,.64,1);
          position: relative; overflow: hidden;
        }
        .ss-tab-btn::after {
          content: ""; position: absolute; inset: 0;
          background: linear-gradient(135deg, rgba(132,204,22,.08), transparent);
          opacity: 0; transition: opacity .18s;
        }
        .ss-tab-btn:hover::after { opacity: 1; }
        .ss-tab-btn:hover { transform: translateY(-1px); }
        .ss-tab-btn:active { transform: scale(.96); }
        .ss-close { transition: all .18s; }
        .ss-close:hover {
          background: rgba(239,68,68,.08) !important;
          border-color: rgba(239,68,68,.2) !important;
          color: #ef4444 !important;
          transform: rotate(90deg);
        }
      `}</style>

      <div className="ss-overlay" onClick={onClose} />

      <div className="ss-sidebar">
        {/* Header */}
        <div style={{
          padding: "0 0 0",
          borderBottom: "1px solid rgba(132,204,22,0.1)",
          background: "linear-gradient(180deg, rgba(132,204,22,0.04) 0%, transparent 100%)",
          flexShrink: 0, position: "relative", overflow: "hidden",
        }}>
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: "linear-gradient(90deg, transparent, rgba(132,204,22,.5), transparent)" }} />

          <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 18px 12px" }}>
            <div style={{
              width: 36, height: 36, borderRadius: 11, flexShrink: 0,
              background: "linear-gradient(135deg, #84cc16, #4d7c0f)",
              display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: "0 4px 14px rgba(132,204,22,.3)", position: "relative", overflow: "hidden",
            }}>
              <div style={{ position: "absolute", inset: 0, background: "linear-gradient(135deg, rgba(255,255,255,.15), transparent)" }} />
              <HelpCircle size={18} color="#000" strokeWidth={2.5} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 17, fontWeight: 800, color: "var(--text)", lineHeight: 1.1, letterSpacing: "-.2px" }}>{headerTitle}</div>
              <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 2, display: "flex", alignItems: "center", gap: 4 }}>
                <Sparkles size={9} color="#84cc16" /> Xeevia Support Center
              </div>
            </div>
            <button onClick={onClose} className="ss-close" style={{
              width: 36, height: 36, borderRadius: 10, flexShrink: 0,
              background: "var(--surface)", border: "1px solid var(--surface-border)",
              display: "flex", alignItems: "center", justifyContent: "center",
              cursor: "pointer", color: "var(--text-secondary)",
            }}>
              <X size={16} />
            </button>
          </div>

          <div style={{ display: "flex", gap: 6, padding: "0 18px 14px" }}>
            {NAV_TABS.map((tab) => {
              const isActive = activeTab === tab.key;
              return (
                <button key={tab.key} className="ss-tab-btn"
                  onClick={() => { setActiveTab(tab.key); if (tab.key === "help") setHelpView("topics"); }}
                  style={{
                    flex: 1, padding: "8px 4px", borderRadius: 10,
                    border: `1px solid ${isActive ? "rgba(132,204,22,0.4)" : "var(--surface-border)"}`,
                    background: isActive ? "rgba(132,204,22,0.1)" : "var(--surface)",
                    color: isActive ? "#a3e635" : "var(--text-secondary)",
                    fontSize: 13, fontWeight: 700, cursor: "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                    boxShadow: isActive ? "0 2px 12px rgba(132,204,22,.1)" : "none",
                  }}>
                  <span style={{ fontSize: 16 }}>{tab.emoji}</span>
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="ss-content">
          {activeTab === "help"     && <HelpTab    onNavigateToContact={handleNavigateToContact} onViewChange={setHelpView} />}
          {activeTab === "faq"      && <FAQTab     onNavigateToContact={handleNavigateToContact} />}
          {activeTab === "download" && <DownloadTab userId={userId} />}
          {activeTab === "contact"  && <ContactTab userId={userId} />}
        </div>
      </div>
    </>
  );
};

export default SupportSidebar;