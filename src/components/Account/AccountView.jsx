// src/components/Account/AccountView.jsx
import React from 'react';
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

const AccountView = ({
  accountSection,
  setAccountSection,
  currentUser,
  isSubscribed,
  userId,
}) => {
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
        <ProfileSection currentUser={currentUser} userId={userId} />
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
