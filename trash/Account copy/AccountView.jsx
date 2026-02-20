// src/components/Account/AccountView.jsx — FIXED v2
//
// BUGS FIXED:
//
//  BUG 1: loadBasicProfile() used .single() which throws PGRST116 (406) when
//  RLS blocks the row or profile doesn't exist yet. Component crashed silently,
//  profileData stayed null, child components received no data.
//  FIX: Changed to .maybeSingle() — returns null data instead of throwing.
//
//  BUG 2: ProfileSection received onSignOut={undefined} because AccountView
//  didn't accept or forward the onSignOut prop.
//  FIX: Accept onSignOut in props, pass it through to ProfileSection.
//
//  BUG 3: loadBasicProfile error was swallowed silently (console.error only).
//  FIX: Sets a fallback profile state so UI doesn't hang on loading.

import React, { useState, useEffect } from "react";
import { UserCircle, Settings, LayoutDashboard, Shield } from "lucide-react";

import ProfileSection from "./ProfileSection";
import SettingsSection from "./SettingsSection";
import DashboardSection from "./DashboardSection";
import SecuritySection from "./SecuritySection";
import { supabase } from "../../services/config/supabase";
import mediaUrlService from "../../services/shared/mediaUrlService";

const AccountView = ({
  accountSection,
  setAccountSection,
  currentUser,
  isSubscribed,
  userId,
  onProfileLoad,
  onSignOut, // ← FIX: was missing from destructured props
  refreshTrigger,
}) => {
  const [profileData, setProfileData] = useState(null);

  useEffect(() => {
    if (userId) {
      loadBasicProfile();
    }
  }, [userId]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadBasicProfile = async () => {
    try {
      console.log(
        "📊 AccountView: Loading profile for headers, userId:",
        userId,
      );

      // FIX: .maybeSingle() never throws on missing row or RLS block
      const { data: profile, error } = await supabase
        .from("profiles")
        .select("id, full_name, username, avatar_id, verified, is_pro")
        .eq("id", userId)
        .maybeSingle(); // ← was .single() — CRASHED when row missing

      if (error) {
        // Log but don't crash — use fallback state
        console.warn("⚠️ AccountView profile query error:", error.message);
        // Set a minimal fallback so child components still get a userId
        const fallback = {
          id: userId,
          fullName: currentUser?.name || "User",
          username: currentUser?.username || "user",
          avatar: null,
          verified: false,
          isPro: false,
        };
        setProfileData(fallback);
        if (onProfileLoad) onProfileLoad(fallback);
        return;
      }

      if (!profile) {
        // New user — profile row not yet created
        console.warn("⚠️ AccountView: No profile row found for:", userId);
        const fallback = {
          id: userId,
          fullName: currentUser?.name || "User",
          username: currentUser?.username || "user",
          avatar: null,
          verified: false,
          isPro: false,
        };
        setProfileData(fallback);
        if (onProfileLoad) onProfileLoad(fallback);
        return;
      }

      // Build avatar URL with high quality params
      let avatarUrl = null;
      if (profile.avatar_id) {
        const baseUrl = mediaUrlService.getImageUrl(profile.avatar_id);
        if (baseUrl && typeof baseUrl === "string") {
          const cleanUrl = baseUrl.split("?")[0];
          if (cleanUrl.includes("supabase")) {
            avatarUrl = `${cleanUrl}?quality=100&width=400&height=400&resize=cover&format=webp`;
          } else {
            avatarUrl = baseUrl;
          }
        }
      }

      const profileState = {
        id: profile.id,
        fullName: profile.full_name || "User",
        username: profile.username || "user",
        avatar: avatarUrl,
        verified: profile.verified || false,
        isPro: profile.is_pro || false,
      };

      setProfileData(profileState);

      if (onProfileLoad) {
        onProfileLoad(profileState);
      }

      console.log("✅ AccountView profile loaded:", profileState);
    } catch (err) {
      // Non-fatal — never crash the account screen
      console.warn("⚠️ AccountView loadBasicProfile error:", err?.message);
      const fallback = {
        id: userId,
        fullName: currentUser?.name || "User",
        username: currentUser?.username || "user",
        avatar: null,
        verified: false,
        isPro: false,
      };
      setProfileData(fallback);
      if (onProfileLoad) onProfileLoad(fallback);
    }
  };

  return (
    <div className="account-view">
      {/* Tabs */}
      <div className="account-tabs">
        <button
          type="button"
          onClick={() => setAccountSection("profile")}
          className={`account-tab ${accountSection === "profile" ? "account-tab-active" : ""}`}
        >
          <UserCircle size={18} />
          <span>Profile</span>
        </button>

        <button
          type="button"
          onClick={() => setAccountSection("dashboard")}
          className={`account-tab ${accountSection === "dashboard" ? "account-tab-active" : ""}`}
        >
          <LayoutDashboard size={18} />
          <span>Dashboard</span>
        </button>

        <button
          type="button"
          onClick={() => setAccountSection("security")}
          className={`account-tab ${accountSection === "security" ? "account-tab-active" : ""}`}
        >
          <Shield size={18} />
          <span>Security</span>
        </button>

        <button
          type="button"
          onClick={() => setAccountSection("settings")}
          className={`account-tab ${accountSection === "settings" ? "account-tab-active" : ""}`}
        >
          <Settings size={18} />
          <span>Settings</span>
        </button>
      </div>

      {/* Sections */}
      {accountSection === "profile" && (
        <ProfileSection
          currentUser={currentUser}
          userId={userId}
          onProfileUpdate={loadBasicProfile}
          onSignOut={onSignOut} // ← FIX: was undefined before (prop not forwarded)
        />
      )}

      {accountSection === "dashboard" && <DashboardSection userId={userId} />}

      {accountSection === "security" && <SecuritySection userId={userId} />}

      {accountSection === "settings" && (
        <SettingsSection isSubscribed={isSubscribed} userId={userId} />
      )}
    </div>
  );
};

export default AccountView;
