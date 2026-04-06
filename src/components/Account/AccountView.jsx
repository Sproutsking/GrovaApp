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
import { UserCircle, Settings, LayoutDashboard, Shield } from "lucide-react";

import ProfileSection   from "./ProfileSection";
import SettingsSection  from "./SettingsSection";
import DashboardSection from "./DashboardSection";
import SecuritySection  from "./SecuritySection";
import { supabase }          from "../../services/config/supabase";
import mediaUrlService        from "../../services/shared/mediaUrlService";

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
     TAB BAR
  ═══════════════════════════════ */
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

  /* ── Tab button ── */
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

  .account-tab:active {
    transform: scale(0.96);
    transition-duration: 0.07s;
  }

  /* ── Active state — lime highlight ── */
  .account-tab-active {
    background: rgba(132, 204, 22, 0.1) !important;
    border-color: rgba(132, 204, 22, 0.3) !important;
    color: #a3e635 !important;
  }

  .account-tab-active:hover {
    background: rgba(132, 204, 22, 0.15) !important;
    border-color: rgba(132, 204, 22, 0.42) !important;
  }

  /* ═══════════════════════════════
     DESKTOP OVERRIDES  ≥ 768 px
  ═══════════════════════════════ */
  @media (min-width: 768px) {
    .account-tabs {
      padding: 10px 18px;
      gap: 7px;
    }

    .account-tab {
      padding: 10px 20px;
      font-size: 13px;
      border-radius: 12px;
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
  onSignOut,        // was missing from props before — now accepted and forwarded
  refreshTrigger,
}) => {
  const [profileData, setProfileData] = useState(null);

  useEffect(() => {
    if (userId) loadBasicProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const loadBasicProfile = async () => {
    try {
      // .maybeSingle() returns null instead of throwing on missing row / RLS block
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

  // ── Tab definitions ─────────────────────────────────────────────
  const TABS = [
    { id: "profile",   icon: <UserCircle size={16} />,     label: "Profile"   },
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
        />
      )}

      {accountSection === "dashboard" && (
        <DashboardSection userId={userId} />
      )}

      {accountSection === "security" && (
        <SecuritySection userId={userId} />
      )}

      {accountSection === "settings" && (
        <SettingsSection isSubscribed={isSubscribed} userId={userId} />
      )}
    </div>
  );
};

export default AccountView;