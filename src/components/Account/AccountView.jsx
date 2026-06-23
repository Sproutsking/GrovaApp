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

import React, { useState, useEffect } from "react";
import {
  UserCircle, Settings, LayoutDashboard, Shield, Globe,
} from "lucide-react";

import ProfileSection   from "./ProfileSection";
import SettingsSection  from "./SettingsSection";
import DashboardSection from "./DashboardSection";
import SecuritySection  from "./SecuritySection";
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
     TAB BAR — Light Theme
  ═══════════════════════════════ */
  .account-tabs {
    display:flex; align-items:center;
    background:linear-gradient(180deg,rgba(249,250,251,0.98),rgba(243,244,246,0.95));
    border-bottom:1px solid rgba(132,204,22,0.15);
    padding:8px 10px; gap:5px;
    overflow-x:auto; overflow-y:visible;
    scrollbar-width:none; -webkit-overflow-scrolling:touch;
    flex-shrink:0; position:sticky; top:0; z-index:20;
  }
  .account-tabs::-webkit-scrollbar { display:none; }

  /* ── Tab button — Light mode ── */
  .account-tab {
    display:flex; align-items:center; justify-content:center; gap:7px;
    padding:9px 12px; border-radius:11px;
    border:1px solid transparent; background:transparent;
    color:rgba(51,65,85,0.55); font-size:12.5px; font-weight:600;
    cursor:pointer; white-space:nowrap; flex-shrink:1; flex-grow:1;
    transition:background 0.17s,border-color 0.17s,color 0.17s,transform 0.12s;
    letter-spacing:0.015em; line-height:1; font-family:inherit;
    min-width:0;
  }

  .account-tab svg {
    width: 16px;
    height: 16px;
    flex-shrink: 0;
  }

  .account-tab:hover {
    background: rgba(132, 204, 22, 0.08);
    color: rgba(51, 65, 85, 0.85);
    border-color: rgba(132, 204, 22, 0.2);
  }

  .account-tab:active {
    transform: scale(0.96);
    transition-duration: 0.07s;
  }

  /* ── Active state — lime highlight ── */
  .account-tab-active {
    background: rgba(132, 204, 22, 0.12) !important;
    border-color: rgba(132, 204, 22, 0.4) !important;
    color: #65a30d !important;
  }

  .account-tab-active:hover {
    background: rgba(132, 204, 22, 0.18) !important;
    border-color: rgba(132, 204, 22, 0.5) !important;
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
      font-size: 12.8px;
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
      font-size: 11.5px;
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

  useEffect(() => {
    if (userId) loadBasicProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const loadBasicProfile = async () => {
    try {
      const { data: profile, error } = await supabase
        .from("profiles")
        .select("id,full_name,username,avatar_id,verified,is_pro")
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

      // Build avatar URL
      let avatarUrl = null;
      if (profile.avatar_id) {
        const baseUrl = mediaUrlService.getImageUrl(profile.avatar_id);
        if (baseUrl && typeof baseUrl === "string") {
          const cleanUrl = baseUrl.split("?")[0];
          avatarUrl = cleanUrl.includes("supabase")
            ? `${cleanUrl}?quality=100&width=400&height=400&resize=cover&format=webp`
            : baseUrl;
        }
      }

      const profileState = {
        id:       profile.id,
        fullName: profile.full_name || "User",
        username: profile.username  || "user",
        avatar:   avatarUrl,
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
    { id: "security",  icon: <Shield size={16} />,          label: "Security"  },
    { id: "settings",  icon: <Settings size={16} />,        label: "Settings"  },
  ];

  return (
    <div className="account-view">
      <style>{ACCOUNT_CSS}</style>

      {/* ── Tab Navigation ── */}
      <div className="account-tabs" role="tablist">
        {TABS.map(({ id, icon, label }) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={accountSection === id}
            onClick={() => setAccountSection(id)}
            className={`account-tab${accountSection === id ? " account-tab-active" : ""}`}
          >
            {icon}
            <span>{label}</span>
          </button>
        ))}
      </div>

      {/* ── Section Panels ── */}
      {accountSection === "profile" && (
        <ProfileSection
          currentUser={currentUser}
          userId={userId}
          onProfileUpdate={loadBasicProfile}
          onSignOut={onSignOut}
          // [AMB-1] Forward global navigator so ambassador button works
          onNavigate={onNavigate}
        />
      )}

      {/* [ID-2] Identity panel */}
      {accountSection === "identity" && (
        <IdentitySection userId={userId} />
      )}

      {accountSection === "dashboard" && (
        <DashboardSection
          currentUser={currentUser}
          profile={profileData}
          setActiveTab={setAccountSection}
          onNavigate={onNavigate}
          onOpenSaved={onOpenSaved}
        />
      )}

      {accountSection === "security" && (
        <SecuritySection userId={userId} />
      )}

      {accountSection === "settings" && (
        <SettingsSection
          isSubscribed={isSubscribed}
          userId={userId}
          themeMode={themeMode}
          setThemeMode={setThemeMode}
        />
      )}
    </div>
  );
};

export default AccountView;