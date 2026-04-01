import React, { useState, useEffect } from "react";
import { X, HelpCircle, Sparkles } from "lucide-react";
import HelpTab    from "./Support-tabs/HelpTab";
import FAQTab     from "./Support-tabs/FAQTab";
import ContactTab from "./Support-tabs/ContactTab";

const NAV_TABS = [
  { key: "help",    emoji: "🏠", label: "Help"    },
  { key: "faq",     emoji: "❓", label: "FAQ"     },
  { key: "contact", emoji: "🎫", label: "Contact" },
];

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
          background: #060606;
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
              <div style={{ fontSize: 16, fontWeight: 800, color: "#fff", lineHeight: 1.1, letterSpacing: "-.2px" }}>{headerTitle}</div>
              <div style={{ fontSize: 11, color: "#484848", marginTop: 2, display: "flex", alignItems: "center", gap: 4 }}>
                <Sparkles size={9} color="#84cc16" /> Xeevia Support Center
              </div>
            </div>
            <button onClick={onClose} className="ss-close" style={{
              width: 36, height: 36, borderRadius: 10, flexShrink: 0,
              background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
              display: "flex", alignItems: "center", justifyContent: "center",
              cursor: "pointer", color: "#6b7280",
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
                    border: `1px solid ${isActive ? "rgba(132,204,22,0.4)" : "rgba(255,255,255,0.06)"}`,
                    background: isActive ? "rgba(132,204,22,0.1)" : "rgba(255,255,255,0.02)",
                    color: isActive ? "#a3e635" : "#525252",
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
          {activeTab === "help"    && <HelpTab    onNavigateToContact={handleNavigateToContact} onViewChange={setHelpView} />}
          {activeTab === "faq"     && <FAQTab     onNavigateToContact={handleNavigateToContact} />}
          {activeTab === "contact" && <ContactTab userId={userId} />}
        </div>
      </div>
    </>
  );
};

export default SupportSidebar;