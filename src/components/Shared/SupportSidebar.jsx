import React, { useState, useEffect } from "react";
import { X, HelpCircle, Sparkles, Download, Smartphone } from "lucide-react";
import HelpTab    from "./Support-tabs/HelpTab";
import FAQTab     from "./Support-tabs/FAQTab";
import ContactTab from "./Support-tabs/ContactTab";

const NAV_TABS = [
  { key: "help",    emoji: "🏠", label: "Help"    },
  { key: "faq",     emoji: "❓", label: "FAQ"     },
  { key: "download", emoji: "📲", label: "Install App" },
  { key: "contact", emoji: "🎫", label: "Contact" },
];

function DownloadTab() {
  const installed = typeof window !== "undefined" && typeof window.__xvIsAppInstalled === "function"
    ? window.__xvIsAppInstalled()
    : false;
  const installApp = () => {
    if (typeof window !== "undefined" && typeof window.__xvRequestInstall === "function") {
      window.__xvRequestInstall();
      return;
    }
    window.dispatchEvent(new CustomEvent("xv:show_install_prompt"));
  };

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
            <div style={{ fontSize: 18, fontWeight: 800, color: "#fff" }}>{installed ? "Xeevia is installed" : "Stay inside the app"}</div>
            <div style={{ fontSize: 11, color: "#6b7280" }}>{installed ? "Your app is ready for the latest updates" : "Smooth, native-feeling access to Xeevia"}</div>
          </div>
        </div>

        <div style={{ color: "#d1d5db", fontSize: 13, lineHeight: 1.7, marginBottom: 18 }}>
          {installed ? "This device already has Xeevia installed. Use the button to check the app upgrade path when a new release is available." : "Use the install flow from inside the app to add Xeevia to your home screen. It feels like a native app, keeps your sessions fast, and avoids browser chrome."}
        </div>

        <button onClick={installApp} style={{
          width: "100%", border: "none", borderRadius: 12, background: "linear-gradient(135deg, #84cc16, #65a30d)",
          color: "#061400", fontSize: 14, fontWeight: 800, padding: "12px 14px", cursor: "pointer",
          boxShadow: "0 10px 28px rgba(132, 204, 22, 0.28)",
        }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
            <Download size={15} /> {installed ? "Check for upgrade" : "Install Xeevia"}
          </span>
        </button>

        <div style={{ marginTop: 18, display: "grid", gap: 8 }}>
          {[
            "Fast launch without browser tabs",
            "Keeps your messages, feeds, and wallet inside the app shell",
            "Works cleanly on desktop and mobile with the same Xeevia interface",
          ].map((point) => (
            <div key={point} style={{ display: "flex", gap: 8, alignItems: "flex-start", color: "#b7c1b2", fontSize: 12.5, lineHeight: 1.5 }}>
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
      : activeTab === "download" ? "Install App"
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
              <div style={{ fontSize: 16, fontWeight: 800, color: "var(--text)", lineHeight: 1.1, letterSpacing: "-.2px" }}>{headerTitle}</div>
              <div style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 2, display: "flex", alignItems: "center", gap: 4 }}>
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
                    fontSize: 12, fontWeight: 700, cursor: "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                    boxShadow: isActive ? "0 2px 12px rgba(132,204,22,.1)" : "none",
                  }}>
                  <span style={{ fontSize: 15 }}>{tab.emoji}</span>
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="ss-content">
          {activeTab === "help"     && <HelpTab    onNavigateToContact={handleNavigateToContact} onViewChange={setHelpView} />}
          {activeTab === "faq"      && <FAQTab     onNavigateToContact={handleNavigateToContact} />}
          {activeTab === "download" && <DownloadTab />}
          {activeTab === "contact"  && <ContactTab userId={userId} />}
        </div>
      </div>
    </>
  );
};

export default SupportSidebar;