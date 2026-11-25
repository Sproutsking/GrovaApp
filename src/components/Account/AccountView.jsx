// src/components/Account/AccountView.jsx
//
// FIXES v3:
//  • Proper account tab CSS injected as a <style> block — works on both
//    desktop and mobile without relying on any external stylesheet.
//  • Tabs scroll horizontally on small screens (no wrapping / overflow cut-off).
//  • Active tab has clear lime highlight; icons are correctly sized.
//  • onSignOut prop correctly accepted and forwarded to ProfileSection.
//  • loadBasicProfile uses .maybeSingle() — never crashes on missing row or
//    RLS block (was .single() which threw PGRST116 / 406).
//  • Fallback profile state set on any error so child components always
//    receive a valid userId.

import React, { useState, useEffect, startTransition } from "react";
import {
  UserCircle, Settings, LayoutDashboard, Globe,
} from "lucide-react";

import ProfileSection   from "./ProfileSection";
import SettingsSection  from "./SettingsSection";
import DashboardSection from "./DashboardSection";
import IdentitySection  from "./IdentitySection";
import { supabase }          from "../../services/config/supabase";
import mediaUrlService        from "../../services/shared/mediaUrlService";

// Try to import Fingerprint — older lucide versions may not have it
let IdentityIcon;
try {
  // Dynamic attempt — will be tree-shaken correctly in prod
  const mod = require("lucide-react");
  IdentityIcon = mod.Fingerprint || mod.ScanFace || mod.Globe || Globe;
} catch {
  IdentityIcon = Globe;
}

// ── Scoped CSS injected directly — zero external dependency ──────────────────
const ACCOUNT_CSS = `
  /* ═══════════════════════════════
     ACCOUNT SHELL
  ═══════════════════════════════ */
  .account-view {
    display: flex;
    flex-direction: column;
    min-height: 100%;
  }

  /* ═══════════════════════════════
     TAB BAR — Theme-aware styles
  ═══════════════════════════════ */
  .account-tabs {
    display:flex; align-items:center;
    padding:8px 10px; gap:5px;
    overflow-x:auto; overflow-y:visible;
    scrollbar-width:none; -webkit-overflow-scrolling:touch;
    flex-shrink:0; position:sticky; top:0; z-index:20;
    background:#000; border-bottom:1px solid #252c27;
    isolation:isolate;
  }
  .account-tabs.account-tabs--light {
    background:#000;
    border-bottom:1px solid #252c27;
    color:#a7b3a5;
  }
  .account-tabs.account-tabs--dark {
    background:#000;
    border-bottom:1px solid #252c27;
  }
  .account-tabs::-webkit-scrollbar { display:none; }

  .account-tab {
    display:flex; align-items:center; justify-content:center; gap:7px;
    padding:9px 12px; border-radius:11px;
    border:1px solid #252f27; background:#0d120e;
    color:#b5c1b2; font-size:calc((12.5px) + 1px); font-weight:600;
    cursor:pointer; white-space:nowrap; flex-shrink:1; flex-grow:1;
    transition:background 0.17s,border-color 0.17s,color 0.17s,transform 0.12s;
    letter-spacing:0.015em; line-height:1; font-family:inherit;
    min-width:0;
  }
  .account-tab:hover {
    background:#172217;
    color:#edf7e2;
    border-color:#44583a;
  }
  .account-tab:focus-visible { outline:2px solid #a3e635; outline-offset:2px; }

  .account-tab svg {
    width: 16px;
    height: 16px;
    flex-shrink: 0;
  }

  .account-tab:active {
    transform: scale(0.96);
    transition-duration: 0.07s;
  }

  /* ── Active state — lime highlight ── */
  .account-tab-active {
    background:#26391b !important;
    border-color:#7ea64e !important;
    color:#e4f6c6 !important;
  }

  .account-tab-active:hover {
    background:#304821 !important;
    border-color:#a3e635 !important;
  }

  /* ═══════════════════════════════
     DESKTOP OVERRIDES  ≥ 768 px
  ═══════════════════════════════ */
  @media (min-width: 768px) {
    .account-tabs {
      padding: 10px 12px;
      gap: 6px;
      overflow-x: visible;
    }

    .account-tab {
      padding: 9px 10px;
      font-size: calc((12.8px) + 1px);
      border-radius: 12px;
      flex-grow: 1;
      min-width: 0;
    }

    .account-tab span {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .account-tab svg {
      width: 17px;
      height: 17px;
    }
  }

  /* ═══════════════════════════════
     COMPACT  ≤ 360 px
  ═══════════════════════════════ */
  @media (max-width: 360px) {
    .account-tabs {
      padding: 7px 8px;
      gap: 4px;
    }

    .account-tab {
      padding: 8px 12px;
      font-size: calc((11.5px) + 1px);
      gap: 5px;
    }

    /* Hide text labels on very small screens — icons only */
    .account-tab span {
      display: none;
    }

    .account-tab svg {
      width: 18px;
      height: 18px;
    }
  }
`;

const AccountView = ({
  accountSection,
  setAccountSection,
  profileShortcutRequest = null,
  currentUser,
  isSubscribed,
  userId,
  onProfileLoad,
  onSignOut,
  refreshTrigger,
  themeMode,
  setThemeMode,
  // Global view switcher from App.jsx — used by DashboardSection AND ProfileSection
  // Common names in App.jsx: setActiveTab, setView, navigateTo, onNavigate
  onNavigate,
  // Opens SavedContentModal from App.jsx
  onOpenSaved,
}) => {
  const [profileData, setProfileData] = useState(null);
  const [preRendered, setPreRendered] = useState(false);
  const activeSection = accountSection === "security" ? "settings" : accountSection;

  useEffect(() => {
    if (userId) loadBasicProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  useEffect(() => {
    if (accountSection === "security") setAccountSection("settings");
  }, [accountSection, setAccountSection]);

  // Pre-render all tabs on mount for ultra-instant switching
  useEffect(() => {
    if (!preRendered && profileData) {
      startTransition(() => {
        setPreRendered(true);
      });
    }
  }, [profileData, preRendered]);

  const loadBasicProfile = async () => {
    try {
      const { data: profile, error } = await supabase
        .from("profiles")
        .select("id,full_name,username,avatar_id,banner_image_id,bio,verified,is_pro")
        .eq("id", userId)
        .maybeSingle();

      if (error) {
        console.warn("⚠️ AccountView profile query error:", error.message);
        return applyFallback();
      }

      if (!profile) {
        console.warn("⚠️ AccountView: No profile row found for:", userId);
        return applyFallback();
      }

      const avatarUrl = mediaUrlService.resolveAvatarUrl(profile.avatar_id, 400);

      const profileState = {
        id:       profile.id,
        fullName: profile.full_name || "User",
        username: profile.username  || "user",
        avatar:   avatarUrl,
        avatarId: profile.avatar_id || null,
        bio:      profile.bio || "",
        bannerImageUrl: profile.banner_image_id
          ? mediaUrlService.getOptimizedImageUrl(profile.banner_image_id, { width: 1500, height: 520, crop: "fill", gravity: "auto" })
          : null,
        bannerImageId: profile.banner_image_id || null,
        verified: profile.verified  || false,
        isPro:    profile.is_pro    || false,
      };
      setProfileData(profileState);
      if (onProfileLoad) onProfileLoad(profileState);
    } catch (err) {
      console.warn("AccountView loadBasicProfile:", err?.message);
      applyFallback();
    }
  };

  const applyFallback = () => {
    const fb = {
      id:       userId,
      fullName: currentUser?.name     || "User",
      username: currentUser?.username || "user",
      avatar:   null, verified:false, isPro:false,
    };
    setProfileData(fb);
    if (onProfileLoad) onProfileLoad(fb);
  };

   // ── Tab definitions ─────────────────────────────────────────────
  const TABS = [
    { id: "profile",   icon: <UserCircle size={16} />,     label: "Profile"   },
    { id: "identity",  icon: <IdentityIcon size={16} />,    label: "Identity"  },
    { id: "dashboard", icon: <LayoutDashboard size={16} />, label: "Dashboard" },
    { id: "settings",  icon: <Settings size={16} />,        label: "Settings"  },
  ];

  const isDesktopWide = typeof window !== "undefined" && window.innerWidth >= 1024;

  return (
    <div className="account-view" style={{ display: "flex", flexDirection: "row", minHeight: "100vh" }}>
      <style>{ACCOUNT_CSS}</style>

      {/* ── Main content column ── */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        {/* ── Tab Navigation ── */}
        <div className={`account-tabs account-tabs--${themeMode === "dark" ? "dark" : "light"}`} role="tablist">
          {TABS.map(({ id, icon, label }) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={activeSection === id}
              onClick={() => setAccountSection(id)}
              className={`account-tab${activeSection === id ? " account-tab-active" : ""}`}
            >
              {icon}
              <span>{label}</span>
            </button>
          ))}
        </div>

        {/* ── Section Panels — All pre-rendered for instant switching ── */}
        {(activeSection === "profile" || preRendered) && (
          <div style={{ display: activeSection === "profile" ? "block" : "none" }}>
            <ProfileSection
              currentUser={currentUser}
              userId={userId}
              profileShortcutRequest={profileShortcutRequest}
              onProfileUpdate={loadBasicProfile}
              onSignOut={onSignOut}
              onNavigate={onNavigate}
            />
          </div>
        )}

        {(activeSection === "identity" || preRendered) && (
          <div style={{ display: activeSection === "identity" ? "block" : "none" }}>
            <IdentitySection userId={userId} />
          </div>
        )}

        {(activeSection === "dashboard" || preRendered) && (
          <div style={{ display: activeSection === "dashboard" ? "block" : "none" }}>
            <DashboardSection
              currentUser={currentUser}
              profile={profileData}
              setActiveTab={setAccountSection}
              onNavigate={onNavigate}
              onOpenSaved={onOpenSaved}
            />
          </div>
        )}

        {(activeSection === "settings" || preRendered) && (
          <div style={{ display: activeSection === "settings" ? "block" : "none" }}>
            <SettingsSection
              isSubscribed={isSubscribed}
              userId={userId}
              onOpenUpgrade={() => onNavigate?.("upgrade")}
              themeMode={themeMode}
              setThemeMode={setThemeMode}
            />
          </div>
        )}
      </div>

    </div>
  );
};

export default AccountView;