// src/components/Account/AccountView.jsx - FIXED
import React, { useState, useEffect } from 'react';
import {
  UserCircle,
  Settings,
  LayoutDashboard,
  Shield,
} from 'lucide-react';

import ProfileSection from './ProfileSection';
import SettingsSection from './SettingsSection';
import DashboardSection from './DashboardSection';
import SecuritySection from './SecuritySection';
import { supabase } from '../../services/config/supabase';
import mediaUrlService from '../../services/shared/mediaUrlService';

const AccountView = ({
  accountSection,
  setAccountSection,
  currentUser,
  isSubscribed,
  userId,
  onProfileLoad, // Callback to pass profile data to App.jsx
}) => {
  const [profileData, setProfileData] = useState(null);

  useEffect(() => {
    if (userId) {
      loadBasicProfile();
    }
  }, [userId]);

  const loadBasicProfile = async () => {
    try {
      console.log('📊 Loading profile for headers from AccountView');
      
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('id, full_name, username, avatar_id, verified, is_pro')
        .eq('id', userId)
        .single();

      if (error) {
        console.error('❌ Error loading profile for header:', error);
        return;
      }

      // Enhanced avatar URL with HIGH QUALITY parameters
      let avatarUrl = null;
      if (profile.avatar_id) {
        const baseUrl = mediaUrlService.getImageUrl(profile.avatar_id);
        if (baseUrl && typeof baseUrl === 'string') {
          const cleanUrl = baseUrl.split('?')[0];
          if (cleanUrl.includes('supabase')) {
            avatarUrl = `${cleanUrl}?quality=100&width=400&height=400&resize=cover&format=webp`;
          } else {
            avatarUrl = baseUrl;
          }
        }
      }

      const profileState = {
        id: profile.id,
        fullName: profile.full_name,
        username: profile.username,
        avatar: avatarUrl,
        verified: profile.verified,
        isPro: profile.is_pro
      };

      setProfileData(profileState);

      // Pass profile data to parent (App.jsx) for headers
      if (onProfileLoad) {
        onProfileLoad(profileState);
      }

      console.log('✅ Profile loaded for headers:', profileState);
    } catch (err) {
      console.error('❌ Failed to load profile:', err);
    }
  };

  return (
    <div className="account-view">
      {/* Tabs */}
      <div className="account-tabs">
        <button
          type="button"
          onClick={() => setAccountSection('profile')}
          className={`account-tab ${
            accountSection === 'profile' ? 'account-tab-active' : ''
          }`}
        >
          <UserCircle size={18} />
          <span>Profile</span>
        </button>

        <button
          type="button"
          onClick={() => setAccountSection('dashboard')}
          className={`account-tab ${
            accountSection === 'dashboard' ? 'account-tab-active' : ''
          }`}
        >
          <LayoutDashboard size={18} />
          <span>Dashboard</span>
        </button>

        <button
          type="button"
          onClick={() => setAccountSection('security')}
          className={`account-tab ${
            accountSection === 'security' ? 'account-tab-active' : ''
          }`}
        >
          <Shield size={18} />
          <span>Security</span>
        </button>

        <button
          type="button"
          onClick={() => setAccountSection('settings')}
          className={`account-tab ${
            accountSection === 'settings' ? 'account-tab-active' : ''
          }`}
        >
          <Settings size={18} />
          <span>Settings</span>
        </button>
      </div>

      {/* Sections */}
      {accountSection === 'profile' && (
        <ProfileSection 
          currentUser={currentUser} 
          userId={userId}
          onProfileUpdate={loadBasicProfile} // Refresh when profile updates
        />
      )}

      {accountSection === 'dashboard' && (
        <DashboardSection userId={userId} />
      )}

      {accountSection === 'security' && (
        <SecuritySection userId={userId} />
      )}

      {accountSection === 'settings' && (
        <SettingsSection isSubscribed={isSubscribed} userId={userId} />
      )}
    </div>
  );
};

export default AccountView;