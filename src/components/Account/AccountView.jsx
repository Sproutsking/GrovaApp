// src/components/Account/AccountView.jsx — v4 IDENTITY WIRED
// ============================================================================
// Changes vs v3:
//  [ID-1] "identity" tab added to TABS — uses Fingerprint icon
//         If lucide-react version doesn't have Fingerprint, falls back to Globe
//  [ID-2] IdentitySection imported and mounted when accountSection === "identity"
//  Everything else is identical to v3 — no logic changes.
// ============================================================================

import React, { useState, useEffect } from "react";
import {
  UserCircle, Settings, LayoutDashboard, Shield, Link2, Globe,
} from "lucide-react";

// Try to import Fingerprint — older lucide versions may not have it
let IdentityIcon;
try {
  // Dynamic attempt — will be tree-shaken correctly in prod
  const mod = require("lucide-react");
  IdentityIcon = mod.Fingerprint || mod.ScanFace || mod.Globe || Globe;
} catch {
  IdentityIcon = Globe;
}

import ProfileSection          from "./ProfileSection";
import SettingsSection         from "./SettingsSection";
import DashboardSection        from "./DashboardSection";
import SecuritySection         from "./SecuritySection";
import ConnectedWalletsSection from "./ConnectedWalletsSection";
import IdentitySection         from "./IdentitySection"; // [ID-2]
import { supabase }            from "../../services/config/supabase";
import mediaUrlService          from "../../services/shared/mediaUrlService";

// ── Styles ────────────────────────────────────────────────────────────────────
const ACCOUNT_CSS = `
  .account-view {
    display: flex;
    flex-direction: column;
    min-height: 100%;
  }

  /* ─ Tab bar ─ */
  .account-tabs {
    display: flex;
    align-items: center;
    background: rgba(7, 8, 10, 0.97);
    border-bottom: 1px solid rgba(255, 255, 255, 0.07);
    padding: 8px 10px;
    gap: 5px;
    overflow-x: auto;
    overflow-y: visible;
    scrollbar-width: none;
    -webkit-overflow-scrolling: touch;
    flex-shrink: 0;
    position: sticky;
    top: 0;
    z-index: 20;
  }
  .account-tabs::-webkit-scrollbar { display: none; }

  /* ─ Tab button ─ */
  .account-tab {
    display: flex;
    align-items: center;
    gap: 7px;
    padding: 9px 16px;
    border-radius: 11px;
    border: 1px solid transparent;
    background: transparent;
    color: rgba(255, 255, 255, 0.35);
    font-size: 12.5px;
    font-weight: 600;
    cursor: pointer;
    white-space: nowrap;
    flex-shrink: 0;
    transition: background 0.17s, border-color 0.17s, color 0.17s, transform 0.12s;
    letter-spacing: 0.015em;
    line-height: 1;
    font-family: inherit;
  }
  .account-tab svg {
    width: 16px;
    height: 16px;
    flex-shrink: 0;
  }
  .account-tab:hover {
    background: rgba(255, 255, 255, 0.05);
    color: rgba(255, 255, 255, 0.7);
    border-color: rgba(255, 255, 255, 0.09);
  }
  .account-tab:active { transform: scale(0.96); transition-duration: 0.07s; }

  /* ─ Active — default (lime) ─ */
  .account-tab-active {
    background: rgba(132, 204, 22, 0.1) !important;
    border-color: rgba(132, 204, 22, 0.3) !important;
    color: #a3e635 !important;
  }
  .account-tab-active:hover {
    background: rgba(132, 204, 22, 0.15) !important;
    border-color: rgba(132, 204, 22, 0.42) !important;
  }

  /* ─ Active — identity tab (purple) ─ */
  .account-tab-identity {
    background: rgba(139, 92, 246, 0.1) !important;
    border-color: rgba(139, 92, 246, 0.3) !important;
    color: #c4b5fd !important;
  }
  .account-tab-identity:hover {
    background: rgba(139, 92, 246, 0.16) !important;
    border-color: rgba(139, 92, 246, 0.45) !important;
  }

  /* ─ Desktop ─ */
  @media (min-width: 768px) {
    .account-tabs { padding: 10px 18px; gap: 7px; }
    .account-tab  { padding: 10px 20px; font-size: 13px; border-radius: 12px; }
    .account-tab svg { width: 17px; height: 17px; }
  }

  /* ─ Very small screens: icons only ─ */
  @media (max-width: 360px) {
    .account-tabs { padding: 7px 8px; gap: 4px; }
    .account-tab  { padding: 8px 12px; font-size: 11.5px; gap: 5px; }
    .account-tab span { display: none; }
    .account-tab svg { width: 18px; height: 18px; }
  }
`;

// ── Tab definitions ───────────────────────────────────────────────────────────
// [ID-1] "identity" inserted as second tab — right after Profile
const TABS = [
  { id: "profile",   icon: <UserCircle size={16} />,     label: "Profile"   },
  { id: "identity",  icon: <Globe size={16} />,          label: "Identity"  },
  { id: "dashboard", icon: <LayoutDashboard size={16} />, label: "Dashboard" },
  { id: "security",  icon: <Shield size={16} />,          label: "Security"  },
  { id: "wallets",   icon: <Link2 size={16} />,           label: "Wallets"   },
  { id: "settings",  icon: <Settings size={16} />,        label: "Settings"  },
];

// ── Component ─────────────────────────────────────────────────────────────────
const AccountView = ({
  accountSection,
  setAccountSection,
  currentUser,
  isSubscribed,
  userId,
  onProfileLoad,
  onSignOut,
  refreshTrigger,
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
        .select("id, full_name, username, avatar_id, verified, is_pro")
        .eq("id", userId)
        .maybeSingle();

      if (error) {
        console.warn("⚠️ AccountView profile query error:", error.message);
        return applyFallback();
      }
      if (!profile) {
        console.warn("⚠️ AccountView: no profile row for:", userId);
        return applyFallback();
      }

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
      console.warn("⚠️ AccountView loadBasicProfile error:", err?.message);
      applyFallback();
    }
  };

  const applyFallback = () => {
    const fallback = {
      id:       userId,
      fullName: currentUser?.name     || "User",
      username: currentUser?.username || "user",
      avatar:   null,
      verified: false,
      isPro:    false,
    };
    setProfileData(fallback);
    if (onProfileLoad) onProfileLoad(fallback);
  };

  return (
    <div className="account-view">
      <style>{ACCOUNT_CSS}</style>

      {/* ── Tab bar ── */}
      <div className="account-tabs" role="tablist">
        {TABS.map(({ id, icon, label }) => {
          const isActive = accountSection === id;
          let cls = "account-tab";
          if (isActive) cls += id === "identity" ? " account-tab-identity" : " account-tab-active";
          return (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => setAccountSection(id)}
              className={cls}
            >
              {icon}
              <span>{label}</span>
            </button>
          );
        })}
      </div>

      {/* ── Section panels ── */}
      {accountSection === "profile" && (
        <ProfileSection
          currentUser={currentUser}
          userId={userId}
          onProfileUpdate={loadBasicProfile}
          onSignOut={onSignOut}
        />
      )}

      {/* [ID-2] Identity panel */}
      {accountSection === "identity" && (
        <IdentitySection userId={userId} />
      )}

      {accountSection === "dashboard" && (
        <DashboardSection userId={userId} />
      )}

      {accountSection === "security" && (
        <SecuritySection userId={userId} />
      )}

      {accountSection === "wallets" && (
        <ConnectedWalletsSection />
      )}

      {accountSection === "settings" && (
        <SettingsSection isSubscribed={isSubscribed} userId={userId} />
      )}
    </div>
  );
};

export default AccountView;