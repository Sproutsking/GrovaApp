import React, { useState, useEffect } from "react";
import { X, HelpCircle, ArrowLeft } from "lucide-react";
import HelpTab from "./Support-tabs/HelpTab";
import FAQTab from "./Support-tabs/FAQTab";
import ContactTab from "./Support-tabs/ContactTab";

// ─── NAV TABS CONFIG ──────────────────────────────────────────────────────────

const NAV_TABS = [
  { key: "help", emoji: "🏠", label: "Help" },
  { key: "faq", emoji: "❓", label: "FAQ" },
  { key: "contact", emoji: "🎫", label: "Contact" },
];

// ─── MAIN SUPPORT SIDEBAR ─────────────────────────────────────────────────────

const SupportSidebar = ({ isOpen, onClose, isMobile, userId, adminData }) => {
  const [activeTab, setActiveTab] = useState("help");
  // Track nested view state so we can show a back arrow in the header
  const [helpView, setHelpView] = useState("topics"); // topics | topic | article

  // Reset on open
  useEffect(() => {
    if (isOpen) {
      setActiveTab("help");
      setHelpView("topics");
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleNavigateToContact = () => setActiveTab("contact");

  // Header title
  const headerTitle =
    activeTab === "help"
      ? helpView === "article"
        ? "Article"
        : helpView === "topic"
          ? "Topic"
          : "Help & Support"
      : activeTab === "faq"
        ? "FAQ"
        : "Contact Support";

  return (
    <>
      <style>{`
        @keyframes slideInRight {
          from { transform: translateX(100%); opacity: 0; }
          to   { transform: translateX(0);   opacity: 1; }
        }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        .xv-overlay {
          position: fixed; inset: 0;
          background: rgba(0,0,0,0.72);
          backdrop-filter: blur(5px);
          z-index: 999;
          animation: fadeIn 0.2s ease;
        }
        .xv-sidebar {
          position: fixed; top: 0; right: 0;
          width: 100%; max-width: ${isMobile ? "100%" : "420px"};
          height: 100dvh;
          background: #080808;
          border-left: 1px solid rgba(132,204,22,0.12);
          z-index: 1000;
          display: flex;
          flex-direction: column;
          animation: slideInRight 0.3s cubic-bezier(0.4,0,0.2,1);
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          overflow: hidden;
        }
        .xv-content {
          flex: 1;
          overflow-y: auto;
          overscroll-behavior: contain;
          -webkit-overflow-scrolling: touch;
        }
        .xv-content::-webkit-scrollbar { width: 0; }
        .xv-tab-btn {
          transition: all 0.15s;
        }
        .xv-tab-btn:hover {
          border-color: rgba(132,204,22,0.3) !important;
          color: #d4f08e !important;
        }
        .xv-close:hover { background: rgba(255,255,255,0.08) !important; }
      `}</style>

      {/* Overlay */}
      <div className="xv-overlay" onClick={onClose} />

      {/* Sidebar */}
      <div className="xv-sidebar">
        {/* ── TOP HEADER ── */}
        <div
          style={{
            padding: "10px 16px 0",
            borderBottom: "1px solid rgba(132,204,22,0.1)",
            background: "rgba(132,204,22,0.015)",
            flexShrink: 0,
          }}
        >
          {/* Brand row */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              marginBottom: 10,
            }}
          >
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 9,
                background: "linear-gradient(135deg, #84cc16, #65a30d)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <HelpCircle size={17} style={{ color: "#000" }} />
            </div>
            <div
              style={{
                flex: 1,
                fontSize: 16,
                fontWeight: 800,
                color: "#fff",
                fontFamily: "'Syne', sans-serif",
              }}
            >
              {headerTitle}
            </div>
            <button
              onClick={onClose}
              className="xv-close"
              style={{
                width: 34,
                height: 34,
                borderRadius: 10,
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.08)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                color: "#9ca3af",
              }}
            >
              <X size={16} />
            </button>
          </div>

          {/* Tab bar */}
          <div style={{ display: "flex", gap: 5, paddingBottom: 10 }}>
            {NAV_TABS.map((tab) => {
              const isActive = activeTab === tab.key;
              return (
                <button
                  key={tab.key}
                  className="xv-tab-btn"
                  onClick={() => {
                    setActiveTab(tab.key);
                    if (tab.key === "help") setHelpView("topics");
                  }}
                  style={{
                    flex: 1,
                    padding: "7px 4px",
                    borderRadius: 9,
                    border: `1px solid ${isActive ? "rgba(132,204,22,0.38)" : "rgba(255,255,255,0.07)"}`,
                    background: isActive
                      ? "rgba(132,204,22,0.1)"
                      : "rgba(255,255,255,0.02)",
                    color: isActive ? "#a3e635" : "#6b7280",
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 5,
                  }}
                >
                  <span style={{ fontSize: 14 }}>{tab.emoji}</span>
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* ── CONTENT ── */}
        <div className="xv-content">
          {activeTab === "help" && (
            <HelpTab
              onNavigateToContact={handleNavigateToContact}
              onViewChange={setHelpView}
            />
          )}
          {activeTab === "faq" && (
            <FAQTab onNavigateToContact={handleNavigateToContact} />
          )}
          {activeTab === "contact" && <ContactTab userId={userId} />}
        </div>
      </div>
    </>
  );
};

export default SupportSidebar;
