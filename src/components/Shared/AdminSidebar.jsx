// src/components/Shared/AdminSidebar.jsx
import React, { useState, useEffect, useRef } from "react";
import ServicesModal from "./ServicesModal";

// ─────────────────────────────────────────────
// STYLES — all CSS lives here, nothing inline
// ─────────────────────────────────────────────
const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=Syne:wght@600;700;800&display=swap');

  .xv-sidebar {
    background: #030303;
    border-left: 1px solid rgba(255,255,255,0.05);
    border-right: 1px solid rgba(255,255,255,0.05);
    display: flex;
    flex-direction: column;
    position: fixed;
    z-index: 100;
    font-family: 'Syne', sans-serif;
    /* top and height are set via inline style using measured header height */
    left: 4%;
    bottom: 0;
    width: 300px;
  }

  /* ── TOP ACCENT BAR ── */
  .xv-accent-bar {
    height: 3px;
    flex-shrink: 0;
    /* background set inline with role color */
  }

  /* ── LOGO ── */
  .xv-logo {
    padding: 18px 20px;
    border-bottom: 1px solid rgba(255,255,255,0.05);
    display: flex;
    align-items: center;
    gap: 12px;
    flex-shrink: 0;
  }

  .xv-logo-icon {
    width: 38px;
    height: 38px;
    border-radius: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 18px;
    font-weight: 900;
    color: #000;
    flex-shrink: 0;
    /* background + box-shadow set inline */
  }

  .xv-logo-name {
    font-size: 16px;
    font-weight: 800;
    color: #f4f4f5;
    letter-spacing: 0.5px;
    line-height: 1.1;
  }

  .xv-logo-sub {
    font-size: 9.5px;
    letter-spacing: 0.15em;
    text-transform: uppercase;
    font-weight: 700;
    margin-top: 2px;
    font-family: 'DM Mono', monospace;
    /* color set inline with role color */
  }

  /* ── NAV ── */
  .xv-nav {
    flex: 1;
    padding: 16px 12px 8px;
    overflow-y: auto;
    scrollbar-width: none;
  }

  .xv-nav::-webkit-scrollbar { display: none; }

  .xv-section-label {
    font-size: 9.5px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.14em;
    color: #3f3f46;
    padding: 0 10px 8px;
    font-family: 'DM Mono', monospace;
  }

  .xv-section-label--spaced {
    padding-top: 16px;
  }

  /* ── NAV BUTTON ── */
  .xv-nav-btn {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 11px;
    padding: 11px 12px;
    border-radius: 10px;
    background: transparent;
    border: 1px solid transparent;
    color: #71717a;
    font-size: 13.5px;
    font-weight: 500;
    cursor: pointer;
    transition: background 0.15s, color 0.15s, border-color 0.15s;
    margin-bottom: 2px;
    text-align: left;
    position: relative;
    font-family: 'Syne', sans-serif;
  }

  .xv-nav-btn:hover {
    background: rgba(255,255,255,0.04);
    color: #d4d4d8;
  }

  .xv-nav-btn--active {
    font-weight: 700;
    /* background, border, color set inline with role color */
  }

  .xv-active-bar {
    position: absolute;
    left: 0;
    top: 50%;
    transform: translateY(-50%);
    width: 3px;
    height: 60%;
    border-radius: 0 3px 3px 0;
    /* background + box-shadow set inline with role color */
  }

  .xv-nav-icon {
    width: 16px;
    height: 16px;
    flex-shrink: 0;
  }

  /* ── MENU BUTTON ── */
  .xv-menu-btn {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 11px;
    padding: 11px 12px;
    border-radius: 10px;
    background: transparent;
    border: 1px solid rgba(255,255,255,0.06);
    color: #71717a;
    font-size: 13.5px;
    font-weight: 500;
    cursor: pointer;
    transition: background 0.15s, color 0.15s, border-color 0.15s;
    margin-bottom: 2px;
    text-align: left;
    font-family: 'Syne', sans-serif;
  }

  .xv-menu-btn:hover {
    background: rgba(255,255,255,0.04);
    color: #d4d4d8;
    border-color: rgba(255,255,255,0.1);
  }

  /* ── ADMIN DASHBOARD BUTTON ── */
  .xv-admin-btn {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 11px;
    padding: 12px 14px;
    border-radius: 10px;
    font-size: 13.5px;
    font-weight: 700;
    cursor: pointer;
    transition: background 0.15s, box-shadow 0.15s;
    text-align: left;
    font-family: 'Syne', sans-serif;
    /* background, border, color set inline */
  }

  .xv-admin-btn:hover {
    filter: brightness(1.08);
  }

  .xv-admin-btn-label {
    flex: 1;
  }

  .xv-chevron {
    width: 14px;
    height: 14px;
    opacity: 0.6;
  }

  /* ── FOOTER ── */
  .xv-footer {
    padding: 12px 12px 18px;
    border-top: 1px solid rgba(255,255,255,0.05);
    flex-shrink: 0;
  }

  /* ── PROFILE CARD ── */
  .xv-profile-card {
    display: flex;
    align-items: center;
    gap: 11px;
    padding: 12px;
    background: rgba(255,255,255,0.03);
    border-radius: 12px;
    margin-bottom: 10px;
    /* border set inline */
  }

  .xv-avatar {
    width: 36px;
    height: 36px;
    border-radius: 9px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 14px;
    font-weight: 800;
    flex-shrink: 0;
    /* background, border, color, box-shadow set inline */
  }

  .xv-profile-name {
    font-size: 13px;
    font-weight: 700;
    color: #e4e4e7;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    line-height: 1.2;
  }

  .xv-profile-role {
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.04em;
    margin-top: 3px;
    font-family: 'DM Mono', monospace;
    /* color set inline */
  }

  /* ── SIGN OUT BUTTON ── */
  .xv-signout-btn {
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 10px;
    background: transparent;
    border: 1px solid rgba(255,255,255,0.07);
    border-radius: 10px;
    color: #52525b;
    font-size: 12.5px;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.15s, color 0.15s, border-color 0.15s;
    font-family: 'Syne', sans-serif;
  }

  .xv-signout-btn:hover {
    background: rgba(239,68,68,0.10);
    color: #f87171;
    border-color: rgba(239,68,68,0.25);
  }

  .xv-credits {
    text-align: center;
    margin-top: 12px;
    font-size: 9.5px;
    color: #27272a;
    letter-spacing: 0.06em;
    font-style: italic;
    font-family: 'DM Mono', monospace;
  }
`;

// ─────────────────────────────────────────────
// CONFIG
// ─────────────────────────────────────────────
const ROLE_CONFIG = {
  ceo_owner: { label: "CEO / Owner", color: "#f59e0b", glow: "rgba(245,158,11,0.3)"  },
  a_admin:   { label: "Admin A",     color: "#a3e635", glow: "rgba(163,230,53,0.3)"  },
  b_admin:   { label: "Admin B",     color: "#60a5fa", glow: "rgba(96,165,250,0.3)"  },
  support:   { label: "Support",     color: "#a78bfa", glow: "rgba(167,139,250,0.3)" },
};

const NAV_ITEMS = [
  { id: "home",      label: "Home",      icon: HomeIcon      },
  { id: "search",    label: "Explore",   icon: SearchIcon    },
  { id: "create",    label: "Create",    icon: PlusSquareIcon },
  { id: "community", label: "Community", icon: UsersIcon     },
  { id: "wallet",    label: "Wallet",    icon: WalletIcon    },
  { id: "account",   label: "Account",   icon: UserIcon      },
];

// ─────────────────────────────────────────────
// INLINE SVG ICONS
// ─────────────────────────────────────────────
function HomeIcon({ strokeWidth = 2 }) {
  return (
    <svg className="xv-nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  );
}

function SearchIcon({ strokeWidth = 2 }) {
  return (
    <svg className="xv-nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}

function PlusSquareIcon({ strokeWidth = 2 }) {
  return (
    <svg className="xv-nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <line x1="12" y1="8" x2="12" y2="16" />
      <line x1="8" y1="12" x2="16" y2="12" />
    </svg>
  );
}

function UsersIcon({ strokeWidth = 2 }) {
  return (
    <svg className="xv-nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function WalletIcon({ strokeWidth = 2 }) {
  return (
    <svg className="xv-nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="5" width="20" height="14" rx="2" />
      <line x1="2" y1="10" x2="22" y2="10" />
    </svg>
  );
}

function UserIcon({ strokeWidth = 2 }) {
  return (
    <svg className="xv-nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

function MenuGridIcon() {
  return (
    <svg className="xv-nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg className="xv-nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  );
}

function LogOutIcon() {
  return (
    <svg style={{ width: 13, height: 13 }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  );
}

function ChevronRightIcon() {
  return (
    <svg className="xv-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}

// ─────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────
export default function AdminSidebar({
  activeTab,
  setActiveTab,
  sidebarOpen,
  setSidebarOpen,
  onSignOut,
  user,
  adminData,
  onOpenDashboard,
  currentUser,
}) {
  const [hovered, setHovered]           = useState(null);
  const [headerHeight, setHeaderHeight] = useState(0);
  const [showServices, setShowServices] = useState(false);

  // Auto-detect header height so sidebar sits flush below it
  useEffect(() => {
    function measureHeader() {
      const header =
        document.querySelector("header") ||
        document.querySelector("[data-role='header']") ||
        document.querySelector("#site-header");
      if (header) setHeaderHeight(header.getBoundingClientRect().height);
    }
    measureHeader();
    window.addEventListener("resize", measureHeader);
    return () => window.removeEventListener("resize", measureHeader);
  }, []);

  // Inject styles once into the document head
  useEffect(() => {
    if (document.getElementById("xv-sidebar-styles")) return;
    const tag = document.createElement("style");
    tag.id = "xv-sidebar-styles";
    tag.textContent = STYLES;
    document.head.appendChild(tag);
    return () => tag.remove();
  }, []);

  if (!sidebarOpen) return null;

  const role     = ROLE_CONFIG[adminData?.role] ?? ROLE_CONFIG.a_admin;
  const initials = (adminData?.full_name || adminData?.email || "A").charAt(0).toUpperCase();

  function navBtnStyle(id) {
    const isActive = activeTab === id;
    return {
      background: isActive ? `${role.color}12` : undefined,
      border:     isActive ? `1px solid ${role.color}28` : undefined,
      color:      isActive ? role.color : undefined,
    };
  }

  return (
    <>
      <aside
        className="xv-sidebar"
        style={{
          top:    headerHeight,
          height: `calc(100vh - ${headerHeight}px)`,
        }}
      >
        {/* TOP ACCENT BAR */}
        <div
          className="xv-accent-bar"
          style={{ background: `linear-gradient(90deg, ${role.color}, transparent)` }}
        />

        {/* LOGO */}
        <div className="xv-logo">
          <div
            className="xv-logo-icon"
            style={{
              background: `linear-gradient(135deg, ${role.color}, ${role.color}88)`,
              boxShadow:  `0 4px 16px ${role.glow}`,
            }}
          >
            X
          </div>
          <div>
            <div className="xv-logo-name">Xeevia</div>
            <div className="xv-logo-sub" style={{ color: role.color }}>Admin Console</div>
          </div>
        </div>

        {/* NAVIGATION */}
        <nav className="xv-nav">

          <div className="xv-section-label">Navigation</div>

          {NAV_ITEMS.map((item) => {
            const Icon     = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                className={`xv-nav-btn${isActive ? " xv-nav-btn--active" : ""}`}
                style={navBtnStyle(item.id)}
                onClick={() => setActiveTab(item.id)}
                onMouseEnter={() => setHovered(item.id)}
                onMouseLeave={() => setHovered(null)}
              >
                {isActive && (
                  <span
                    className="xv-active-bar"
                    style={{
                      background: role.color,
                      boxShadow:  `0 0 8px ${role.glow}`,
                    }}
                  />
                )}
                <Icon strokeWidth={isActive ? 2.5 : 2} />
                <span>{item.label}</span>
              </button>
            );
          })}

          {/* ── Menu button ── */}
          <button
            className="xv-menu-btn"
            onClick={() => setShowServices(true)}
            onMouseEnter={() => setHovered("menu")}
            onMouseLeave={() => setHovered(null)}
            aria-label="Open menu"
          >
            <MenuGridIcon />
            <span>Menu</span>
          </button>

          <div className="xv-section-label xv-section-label--spaced">Administration</div>

          <button
            className="xv-admin-btn"
            style={{
              background:  hovered === "dashboard" ? `${role.color}18` : `${role.color}0e`,
              border:      `1px solid ${role.color}30`,
              color:       role.color,
              boxShadow:   hovered === "dashboard" ? `0 4px 20px ${role.glow}` : "none",
            }}
            onClick={onOpenDashboard}
            onMouseEnter={() => setHovered("dashboard")}
            onMouseLeave={() => setHovered(null)}
          >
            <ShieldIcon />
            <span className="xv-admin-btn-label">Admin Dashboard</span>
            <ChevronRightIcon />
          </button>

        </nav>

        {/* FOOTER */}
        <div className="xv-footer">

          {/* Profile card */}
          <div
            className="xv-profile-card"
            style={{ border: `1px solid ${role.color}20` }}
          >
            <div
              className="xv-avatar"
              style={{
                background: `${role.color}18`,
                border:     `1.5px solid ${role.color}40`,
                color:      role.color,
                boxShadow:  `0 2px 12px ${role.glow}`,
              }}
            >
              {initials}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="xv-profile-name">
                {adminData?.full_name || "Admin"}
              </div>
              <div className="xv-profile-role" style={{ color: role.color }}>
                {role.label}
              </div>
            </div>
          </div>

          {/* Sign out */}
          <button className="xv-signout-btn" onClick={onSignOut}>
            <LogOutIcon />
            Sign Out
          </button>

          <div className="xv-credits">Platform Administration · Xeevia</div>
        </div>
      </aside>

      {/* Services Modal */}
      {showServices && (
        <ServicesModal
          onClose={() => setShowServices(false)}
          setActiveTab={(tab) => { setActiveTab(tab); setShowServices(false); }}
          currentUser={currentUser || user}
        />
      )}
    </>
  );
}