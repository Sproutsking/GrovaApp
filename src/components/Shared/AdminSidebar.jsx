// src/components/Shared/AdminSidebar.jsx
import React, { useState, useEffect } from "react";
import ServicesModal from "./ServicesModal";
import SectionHeader from "./SectionHeader";

// ─────────────────────────────────────────────
// STYLES
// ─────────────────────────────────────────────
const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=Syne:wght@600;700;800&display=swap');

  .xv-sidebar {
    background: var(--bg);
    border-left: 1px solid var(--surface-border);
    border-right: 1px solid var(--surface-border);
    display: flex;
    flex-direction: column;
    position: fixed;
    z-index: 50;
    font-family: 'Syne', sans-serif;
    left: 4%;
    bottom: 0;
    width: 300px;
  }

  .xv-accent-bar {
    height: 3px;
    flex-shrink: 0;
  }

  .xv-logo {
    padding: 18px 20px;
    border-bottom: 1px solid var(--surface-border);
    display: flex;
    align-items: center;
    gap: 12px;
    flex-shrink: 0;
    background: var(--surface);
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
    color: var(--accent-contrast);
    flex-shrink: 0;
  }

  .xv-logo-name {
    font-size: 16px;
    font-weight: 800;
    color: var(--text);
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
  }

  .xv-nav {
    flex: 1;
    padding: 10px 12px 8px;
    overflow-y: auto;
    scrollbar-width: none;
  }
  .xv-nav::-webkit-scrollbar { display: none; }

  .xv-section-label {
    font-size: 9.5px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.14em;
    color: var(--text-secondary);
    padding: 0 10px 8px;
    font-family: 'DM Mono', monospace;
    display: none;
  }
  .xv-section-label--spaced { padding-top: 16px; }

  .xv-nav-btn {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 11px;
    padding: 10px 12px;
    border-radius: 10px;
    background: var(--surface);
    border: 1px solid var(--surface-border);
    color: var(--text-secondary);
    font-size: 13.5px;
    font-weight: 500;
    cursor: pointer;
    margin-bottom: 3px;
    text-align: left;
    position: relative;
    font-family: 'Syne', sans-serif;
    transition: background 0.15s, color 0.15s, border-color 0.15s;
  }
  .xv-nav-btn:hover {
    background: var(--surface-strong);
    color: var(--text);
    border-color: var(--surface-border);
  }
  .xv-nav-btn--active { font-weight: 700; }

  .xv-active-bar {
    position: absolute;
    left: 0;
    top: 50%;
    transform: translateY(-50%);
    width: 3px;
    height: 60%;
    border-radius: 0 3px 3px 0;
  }

  /* ── Per-item colored icon wrapper ── */
  .xv-icon-wrap {
    width: 30px;
    height: 30px;
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    transition: background 0.2s ease, box-shadow 0.2s ease;
  }
  .xv-icon-wrap svg { width: 15px; height: 15px; }

  .xv-menu-btn {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 11px;
    padding: 10px 12px;
    border-radius: 10px;
    background: var(--surface);
    border: 1px solid var(--surface-border);
    color: var(--text-secondary);
    font-size: 13.5px;
    font-weight: 500;
    cursor: pointer;
    margin-bottom: 3px;
    text-align: left;
    font-family: 'Syne', sans-serif;
    transition: background 0.15s, color 0.15s, border-color 0.15s;
  }
  .xv-nav-divider {
    height: 1px;
    margin: 14px 0;
    background: rgba(255,255,255,0.08);
    border-radius: 999px;
  }
  .xv-menu-btn:hover {
    background: var(--surface-strong);
    color: var(--text);
    border-color: var(--surface-border);
  }

  .xv-admin-btn {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 11px;
    padding: 12px 14px;
    border-radius: 14px;
    font-size: 13.5px;
    font-weight: 700;
    cursor: pointer;
    transition: background 0.15s, box-shadow 0.15s, border-color 0.15s;
    text-align: left;
    font-family: 'Syne', sans-serif;
    background: var(--surface);
    border: 1px solid rgba(255,255,255,0.08);
    color: var(--text);
    box-shadow: inset 0 0 0 1px rgba(255,255,255,0.04);
  }
  .xv-admin-btn:hover { filter: brightness(1.1); }
  .xv-admin-btn-label { flex: 1; }
  .xv-chevron { width: 14px; height: 14px; opacity: 0.7; }

  .xv-footer {
    padding: 12px 12px 18px;
    border-top: 1px solid var(--surface-border);
    background: var(--surface);
    flex-shrink: 0;
  }

  .xv-profile-card {
    display: flex;
    align-items: center;
    gap: 11px;
    padding: 12px;
    background: var(--surface-strong);
    border-radius: 12px;
    margin-bottom: 10px;
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
  }

  .xv-profile-name {
    font-size: 13px;
    font-weight: 700;
    color: var(--text);
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
    color: var(--text-secondary);
  }

  .xv-signout-btn {
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 10px;
    background: var(--surface);
    border: 1px solid var(--surface-border);
    border-radius: 10px;
    color: var(--text-secondary);
    font-size: 12.5px;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.15s, color 0.15s, border-color 0.15s;
    font-family: 'Syne', sans-serif;
  }
  .xv-signout-btn:hover {
    background: var(--danger-bg);
    color: var(--danger);
    border-color: var(--danger-border);
  }

  .xv-credits {
    text-align: center;
    margin-top: 12px;
    font-size: 9.5px;
    color: var(--text-secondary);
    letter-spacing: 0.06em;
    font-style: italic;
    font-family: 'DM Mono', monospace;
  }
`;

// ─────────────────────────────────────────────
// ROLE CONFIG
// ─────────────────────────────────────────────
const ROLE_CONFIG = {
  ceo_owner: { label: "CEO / Owner", color: "var(--brand-warning)", bg: "var(--brand-warning-bg)", border: "var(--brand-warning-border)", glow: "var(--brand-warning-shadow)" },
  a_admin:   { label: "Admin A",     color: "var(--accent)", bg: "var(--accent-bg-soft)", border: "var(--accent-border)", glow: "var(--accent-shadow)" },
  b_admin:   { label: "Admin B",     color: "var(--brand-info)", bg: "var(--brand-info-bg)", border: "var(--brand-info-border)", glow: "var(--brand-info-shadow)" },
  support:   { label: "Support",     color: "var(--brand-purple)", bg: "var(--brand-purple-bg)", border: "var(--brand-purple-border)", glow: "var(--brand-purple-shadow)" },
};

// ─────────────────────────────────────────────
// NAV ITEMS — each has its own personality color
// Active state overrides to role.color
// ─────────────────────────────────────────────
const NAV_ITEMS = [
  {
    id: "home",
    label: "Home",
    iconColor: "var(--accent)",
    iconBg: "var(--accent-bg-soft)",
    icon: HomeIcon,
  },
  {
    id: "search",
    label: "Explore",
    iconColor: "var(--brand-info)",
    iconBg: "var(--brand-info-bg)",
    icon: SearchIcon,
  },
  {
    id: "create",
    label: "Create",
    iconColor: "var(--brand-warning)",
    iconBg: "var(--brand-warning-bg)",
    icon: PlusSquareIcon,
  },
  {
    id: "community",
    label: "Community",
    iconColor: "var(--brand-purple)",
    iconBg: "var(--brand-purple-bg)",
    icon: UsersIcon,
  },
  {
    id: "wallet",
    label: "Wallet",
    iconColor: "var(--brand-success)",
    iconBg: "var(--brand-success-bg)",
    icon: WalletIcon,
  },
  {
    id: "account",
    label: "Account",
    iconColor: "var(--brand-pink)",
    iconBg: "var(--brand-pink-bg)",
    icon: UserIcon,
  },
];

// ─────────────────────────────────────────────
// ICON COMPONENTS
// ─────────────────────────────────────────────
function HomeIcon({ color, strokeWidth = 2 }) {
  return (
    <svg className="xv-nav-icon" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
      <polyline points="9 22 9 12 15 12 15 22"/>
    </svg>
  );
}
function SearchIcon({ color, strokeWidth = 2 }) {
  return (
    <svg className="xv-nav-icon" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8"/>
      <line x1="21" y1="21" x2="16.65" y2="16.65"/>
    </svg>
  );
}
function PlusSquareIcon({ color, strokeWidth = 2 }) {
  return (
    <svg className="xv-nav-icon" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2"/>
      <line x1="12" y1="8" x2="12" y2="16"/>
      <line x1="8" y1="12" x2="16" y2="12"/>
    </svg>
  );
}
function UsersIcon({ color, strokeWidth = 2 }) {
  return (
    <svg className="xv-nav-icon" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
      <circle cx="9" cy="7" r="4"/>
      <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
      <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
    </svg>
  );
}
function WalletIcon({ color, strokeWidth = 2 }) {
  return (
    <svg className="xv-nav-icon" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="5" width="20" height="14" rx="2"/>
      <line x1="2" y1="10" x2="22" y2="10"/>
    </svg>
  );
}
function UserIcon({ color, strokeWidth = 2 }) {
  return (
    <svg className="xv-nav-icon" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
      <circle cx="12" cy="7" r="4"/>
    </svg>
  );
}
function MenuGridIcon() {
  return (
    <svg style={{ width: 15, height: 15 }} viewBox="0 0 24 24" fill="none" stroke="var(--text-secondary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" rx="1"/>
      <rect x="14" y="3" width="7" height="7" rx="1"/>
      <rect x="3" y="14" width="7" height="7" rx="1"/>
      <rect x="14" y="14" width="7" height="7" rx="1"/>
    </svg>
  );
}
function ShieldIcon({ color }) {
  return (
    <svg style={{ width: 15, height: 15 }} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
    </svg>
  );
}
function LogOutIcon() {
  return (
    <svg style={{ width: 13, height: 13 }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
      <polyline points="16 17 21 12 16 7"/>
      <line x1="21" y1="12" x2="9" y2="12"/>
    </svg>
  );
}
function ChevronRightIcon() {
  return (
    <svg className="xv-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 18 15 12 9 6"/>
    </svg>
  );
}

// ─────────────────────────────────────────────
// COMPONENT
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

  return (
    <>
      <aside
        className="xv-sidebar"
        style={{ top: headerHeight, height: `calc(100vh - ${headerHeight}px)` }}
      >
        {/* Top accent bar — role color */}
        <div
          className="xv-accent-bar"
          style={{ background: `linear-gradient(90deg, ${role.color}, transparent)` }}
        />

        {/* Logo */}
        <div className="xv-logo">
          <div
            className="xv-logo-icon"
            style={{
              background: `linear-gradient(135deg, ${role.color}, ${role.color}88)`,
              boxShadow: `0 4px 16px ${role.glow}`,
              overflow: "hidden",
              padding: 0,
            }}
          >
            <img src="/logo192.png" alt="logo" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
          </div>
          <div>
            <div className="xv-logo-name">Xeevia</div>
            <div className="xv-logo-sub" style={{ color: role.color }}>Admin Console</div>
          </div>
        </div> 

        {/* Nav */}
        <nav className="xv-nav">
          {NAV_ITEMS.map((item) => {
            const Icon     = item.icon;
            const isActive = activeTab === item.id;

            // Active → role color. Inactive → item's own personality color.
            const iconColor = isActive ? role.color : item.iconColor;
            const iconBg    = isActive ? role.bg : item.iconBg;
            const iconGlow  = isActive ? `0 0 10px ${role.glow}` : "none";

            return (
              <button
                key={item.id}
                className={`xv-nav-btn${isActive ? " xv-nav-btn--active" : ""}`}
                style={isActive ? {
                  background:  role.bg,
                  border:      `1px solid ${role.border}`,
                  color:       role.color,
                } : {}}
                onClick={() => setActiveTab(item.id)}
                onMouseEnter={() => setHovered(item.id)}
                onMouseLeave={() => setHovered(null)}
              >
                {isActive && (
                  <span
                    className="xv-active-bar"
                    style={{
                      background:  role.color,
                      boxShadow:   `0 0 8px ${role.glow}`,
                    }}
                  />
                )}
                <div
                  className="xv-icon-wrap"
                  style={{ background: iconBg, boxShadow: iconGlow }}
                >
                  <Icon color={iconColor} strokeWidth={isActive ? 2.5 : 2} />
                </div>
                <span>{item.label}</span>
              </button>
            );
          })}

          {/* Menu button */}
          <button
            className="xv-menu-btn"
            onClick={() => setShowServices(true)}
            onMouseEnter={() => setHovered("menu")}
            onMouseLeave={() => setHovered(null)}
            aria-label="Open menu"
          >
            <div className="xv-icon-wrap" style={{ background: "var(--surface)" }}>
              <MenuGridIcon />
            </div>
            <span>Menu</span>
          </button>

          <div className="xv-nav-divider" />


          <button
            className="xv-admin-btn"
            style={{
              background: hovered === "dashboard" ? `${role.color}20` : `${role.color}12`,
              border:     `1px solid ${role.color}38`,
              color:      role.color,
              boxShadow:  hovered === "dashboard" ? `0 4px 20px ${role.glow}` : "none",
            }}
            onClick={onOpenDashboard}
            onMouseEnter={() => setHovered("dashboard")}
            onMouseLeave={() => setHovered(null)}
          >
            <div className="xv-icon-wrap" style={{ background: `${role.color}18` }}>
              <ShieldIcon color={role.color} />
            </div>
            <span className="xv-admin-btn-label">Admin Dashboard</span>
            <ChevronRightIcon />
          </button>
        </nav>

        {/* Footer */}
        <div className="xv-footer">
          <div
            className="xv-profile-card"
            style={{ border: `1px solid ${role.color}28` }}
          >
            <div
              className="xv-avatar"
              style={{
                background:  `${role.color}20`,
                border:      `1.5px solid ${role.color}50`,
                color:       role.color,
                boxShadow:   `0 2px 12px ${role.glow}`,
              }}
            >
              {initials}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="xv-profile-name">{adminData?.full_name || "Admin"}</div>
              <div className="xv-profile-role" style={{ color: role.color }}>
                {role.label}
              </div>
            </div>
          </div>

          <button className="xv-signout-btn" onClick={onSignOut}>
            <LogOutIcon />
            Sign Out
          </button>
        </div>
      </aside>

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