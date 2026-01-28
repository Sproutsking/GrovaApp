// ============================================================================
// src/components/Account/SettingsSection.jsx - PERFECT - ALL OFF BY DEFAULT
// ============================================================================

import React, { useState, useEffect } from 'react';
import { Bell, Lock, User, Loader, Save, Mail, Phone, AlertTriangle, RefreshCw } from 'lucide-react';
import settingsService from '../../services/account/settingsService';
import StatusModal from '../Modals/StatusModal';
import ConfirmModal from '../Modals/ConfirmModal';
import PhoneVerificationModal from '../Modals/PhoneVerificationModal';

const SettingsSection = ({ userId }) => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [phoneVerified, setPhoneVerified] = useState(false);
  
  // DEFAULT TO ALL OFF
  const [notifications, setNotifications] = useState({
    profileVisits: false,
    comments: false,
    likes: false,
    shares: false,
    newFollowers: false,
    storyUnlocks: false
  });

  const [privacy, setPrivacy] = useState({
    privateAccount: false,
    showEmail: false,
    showPhone: false
  });

  const [subscription, setSubscription] = useState({
    isActive: false,
    plan: 'Free',
    renewalDate: null
  });

  const [statusModal, setStatusModal] = useState({ show: false, type: 'success', message: '' });
  const [confirmModal, setConfirmModal] = useState({ show: false, title: '', message: '', action: null });
  const [showPhoneModal, setShowPhoneModal] = useState(false);

  useEffect(() => {
    if (userId) {
      loadSettings();
    }
  }, [userId]);

  const loadSettings = async () => {
    try {
      setLoading(true);

      const [settings, subscriptionStatus] = await Promise.all([
        settingsService.getUserSettings(userId),
        settingsService.getSubscriptionStatus(userId)
      ]);

      // Set notifications (default to false if not set)
      setNotifications({
        profileVisits: settings.notifications.profileVisits || false,
        comments: settings.notifications.comments || false,
        likes: settings.notifications.likes || false,
        shares: settings.notifications.shares || false,
        newFollowers: settings.notifications.newFollowers || false,
        storyUnlocks: settings.notifications.storyUnlocks || false
      });

      setPrivacy(settings.privacy);
      setEmail(settings.contact.email);
      setPhone(settings.contact.phone || '');
      setPhoneVerified(settings.contact.phoneVerified);
      setSubscription(subscriptionStatus);

      setHasChanges(false);
      console.log('✅ Settings loaded - All notifications default to OFF');

    } catch (error) {
      console.error('Failed to load settings:', error);
      showStatus('error', 'Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  const showStatus = (type, message) => {
    setStatusModal({ show: true, type, message });
  };

  const hideStatus = () => {
    setStatusModal({ show: false, type: 'success', message: '' });
  };

  const showConfirm = (title, message, action) => {
    setConfirmModal({ show: true, title, message, action });
  };

  const hideConfirm = () => {
    setConfirmModal({ show: false, title: '', message: '', action: null });
  };

  const handleNotificationChange = (key) => {
    setNotifications(prev => {
      const newValue = !prev[key];
      console.log(`📣 Notification setting changed: ${key} = ${newValue}`);
      return { ...prev, [key]: newValue };
    });
    setHasChanges(true);
  };

  const handlePrivacyChange = (key) => {
    setPrivacy(prev => ({ ...prev, [key]: !prev[key] }));
    setHasChanges(true);
  };

  const handleSaveSettings = async () => {
    try {
      setSaving(true);

      console.log('💾 Saving settings:', { notifications, privacy });

      // Save notification settings
      await settingsService.updateNotificationSettings(userId, notifications);

      // Save privacy settings
      await settingsService.updatePrivacySettings(userId, privacy);

      setHasChanges(false);
      showStatus('success', 'Settings saved successfully! Your notification preferences are now active.');

    } catch (error) {
      console.error('Failed to save settings:', error);
      showStatus('error', 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleUpgradeSubscription = () => {
    showConfirm(
      'Upgrade to Pro',
      'Upgrade to Pro to unlock advanced features, analytics, and earn 10% more on all content. Continue?',
      async () => {
        try {
          hideConfirm();
          setSaving(true);
          await settingsService.updateSubscription(userId, 'pro');
          await loadSettings();
          showStatus('success', 'Successfully upgraded to Pro!');
        } catch (error) {
          showStatus('error', 'Failed to upgrade subscription');
        } finally {
          setSaving(false);
        }
      }
    );
  };

  const handleChangeEmail = () => {
    showStatus('info', 'Email change feature coming soon');
  };

  const handleChangePhone = () => {
    setShowPhoneModal(true);
  };

  const handlePhoneVerified = async (newPhone) => {
    setPhone(newPhone);
    setPhoneVerified(true);
    showStatus('success', 'Phone number verified successfully!');
    await loadSettings(); // Reload settings
  };

  const getEnabledCount = () => {
    return Object.values(notifications).filter(Boolean).length;
  };

  if (loading) {
    return (
      <>
        <style>{`
          @keyframes spin { to { transform: rotate(360deg); } }
        `}</style>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 20px', gap: '16px' }}>
          <Loader size={32} style={{ animation: 'spin 1s linear infinite', color: '#84cc16' }} />
          <p style={{ color: '#a3a3a3' }}>Loading settings...</p>
        </div>
      </>
    );
  }

  return (
    <>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }

        .settings-section {
          padding: 20px;
        }

        .settings-card {
          background: linear-gradient(135deg, rgba(132, 204, 22, 0.05) 0%, rgba(132, 204, 22, 0.02) 100%);
          border: 1px solid rgba(132, 204, 22, 0.3);
          border-radius: 20px;
          padding: 28px;
          margin-bottom: 24px;
          position: relative;
          overflow: hidden;
        }

        .settings-card::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 4px;
          background: linear-gradient(90deg, #84cc16 0%, #65a30d 100%);
        }

        .settings-card-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 24px;
        }

        .settings-card-left {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .settings-icon-wrapper {
          width: 48px;
          height: 48px;
          border-radius: 14px;
          background: linear-gradient(135deg, #84cc16 0%, #65a30d 100%);
          display: flex;
          align-items: center;
          justify-content: center;
          color: #000;
          box-shadow: 0 4px 16px rgba(132, 204, 22, 0.4);
        }

        .settings-card-title {
          font-size: 20px;
          font-weight: 800;
          color: #ffffff;
          margin: 0;
        }

        .enabled-count {
          padding: 4px 12px;
          background: rgba(132, 204, 22, 0.2);
          border-radius: 8px;
          color: #84cc16;
          font-size: 12px;
          font-weight: 700;
        }

        .toggle-item {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 18px;
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.05);
          border-radius: 12px;
          margin-bottom: 12px;
          transition: all 0.2s;
        }

        .toggle-item:hover {
          background: rgba(255, 255, 255, 0.05);
          border-color: rgba(132, 204, 22, 0.3);
        }

        .toggle-item.active {
          background: rgba(132, 204, 22, 0.05);
          border-color: rgba(132, 204, 22, 0.3);
        }

        .toggle-item-info {
          flex: 1;
        }

        .toggle-item-title {
          font-size: 15px;
          font-weight: 700;
          color: #fff;
          margin-bottom: 4px;
        }

        .toggle-item-desc {
          font-size: 13px;
          color: #737373;
        }

        .toggle-switch {
          position: relative;
          width: 52px;
          height: 28px;
          background: rgba(255, 255, 255, 0.1);
          border-radius: 14px;
          cursor: pointer;
          transition: all 0.3s;
          border: 2px solid rgba(255, 255, 255, 0.1);
        }

        .toggle-switch.active {
          background: linear-gradient(135deg, #84cc16 0%, #65a30d 100%);
          border-color: #84cc16;
        }

        .toggle-switch-handle {
          position: absolute;
          top: 2px;
          left: 2px;
          width: 20px;
          height: 20px;
          background: #ffffff;
          border-radius: 50%;
          transition: transform 0.3s;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
        }

        .toggle-switch.active .toggle-switch-handle {
          transform: translateX(24px);
        }

        .contact-info-box {
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 12px;
          padding: 16px;
          margin-bottom: 16px;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .contact-info-content {
          flex: 1;
        }

        .contact-info-label {
          font-size: 12px;
          color: #737373;
          margin-bottom: 4px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .contact-info-value {
          font-size: 15px;
          color: #fff;
          font-weight: 600;
        }

        .verified-badge {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          padding: 4px 10px;
          background: rgba(34, 197, 94, 0.15);
          border-radius: 6px;
          color: #22c55e;
          font-size: 11px;
          font-weight: 700;
          margin-left: 8px;
        }

        .change-btn {
          padding: 10px 20px;
          background: rgba(132, 204, 22, 0.1);
          border: 1px solid rgba(132, 204, 22, 0.3);
          border-radius: 8px;
          color: #84cc16;
          font-size: 13px;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.2s;
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .change-btn:hover {
          background: rgba(132, 204, 22, 0.15);
          border-color: #84cc16;
          transform: translateY(-2px);
        }

        .subscription-badge {
          display: inline-flex;
          padding: 8px 20px;
          border-radius: 12px;
          font-size: 14px;
          font-weight: 800;
          margin-bottom: 16px;
        }

        .subscription-active {
          background: rgba(132, 204, 22, 0.2);
          color: #84cc16;
          border: 2px solid rgba(132, 204, 22, 0.4);
        }

        .subscription-free {
          background: rgba(163, 163, 163, 0.15);
          color: #a3a3a3;
          border: 2px solid rgba(163, 163, 163, 0.3);
        }

        .save-button {
          width: 100%;
          padding: 18px;
          background: linear-gradient(135deg, #84cc16 0%, #65a30d 100%);
          border: none;
          border-radius: 16px;
          color: #000000;
          font-size: 16px;
          font-weight: 800;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          transition: all 0.3s;
          box-shadow: 0 4px 16px rgba(132, 204, 22, 0.4);
        }

        .save-button:hover:not(:disabled) {
          transform: translateY(-4px);
          box-shadow: 0 8px 32px rgba(132, 204, 22, 0.6);
        }

        .save-button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .changes-indicator {
          background: rgba(251, 191, 36, 0.1);
          border: 1px solid rgba(251, 191, 36, 0.3);
          border-radius: 12px;
          padding: 16px;
          margin-bottom: 24px;
          display: flex;
          align-items: center;
          gap: 12px;
          color: #fbbf24;
        }

        .info-banner {
          background: rgba(59, 130, 246, 0.1);
          border: 1px solid rgba(59, 130, 246, 0.3);
          border-radius: 12px;
          padding: 16px;
          margin-bottom: 24px;
          display: flex;
          align-items: flex-start;
          gap: 12px;
          color: #3b82f6;
        }
      `}</style>

      <div className="settings-section">
        <div className="info-banner">
          <Bell size={20} style={{ flexShrink: 0, marginTop: 2 }} />
          <div style={{ fontSize: '14px', lineHeight: '1.6' }}>
            <strong>Notification Settings:</strong> All notifications are turned OFF by default. Enable the types of notifications you want to receive. Changes take effect immediately after saving.
          </div>
        </div>

        {hasChanges && (
          <div className="changes-indicator">
            <AlertTriangle size={20} />
            <span style={{ fontSize: '14px', fontWeight: '600' }}>
              You have unsaved changes
            </span>
          </div>
        )}

        {/* Notifications */}
        <div className="settings-card">
          <div className="settings-card-header">
            <div className="settings-card-left">
              <div className="settings-icon-wrapper">
                <Bell size={24} />
              </div>
              <h3 className="settings-card-title">Notifications</h3>
            </div>
            <span className="enabled-count">
              {getEnabledCount()} / 6 enabled
            </span>
          </div>
          
          {Object.entries({
            profileVisits: 'Profile Visits',
            comments: 'Comments',
            likes: 'Likes',
            shares: 'Shares',
            newFollowers: 'New Followers',
            storyUnlocks: 'Story Unlocks'
          }).map(([key, label]) => (
            <div key={key} className={`toggle-item ${notifications[key] ? 'active' : ''}`}>
              <div className="toggle-item-info">
                <div className="toggle-item-title">{label}</div>
                <div className="toggle-item-desc">
                  {notifications[key] ? 'You will be notified' : 'You will NOT be notified'} when someone {label.toLowerCase()}
                </div>
              </div>
              <div 
                className={`toggle-switch ${notifications[key] ? 'active' : ''}`}
                onClick={() => handleNotificationChange(key)}
              >
                <div className="toggle-switch-handle"></div>
              </div>
            </div>
          ))}
        </div>

        {/* Privacy & Contact */}
        <div className="settings-card">
          <div className="settings-card-header">
            <div className="settings-card-left">
              <div className="settings-icon-wrapper">
                <Lock size={24} />
              </div>
              <h3 className="settings-card-title">Privacy & Contact</h3>
            </div>
          </div>
          
          <div className="contact-info-box">
            <div className="contact-info-content">
              <div className="contact-info-label">Email Address</div>
              <div className="contact-info-value">
                {email || 'Not set'}
                <span className="verified-badge">✓ Verified</span>
              </div>
            </div>
            <button className="change-btn" onClick={handleChangeEmail}>
              <Mail size={14} />
              Change
            </button>
          </div>

          <div className="contact-info-box">
            <div className="contact-info-content">
              <div className="contact-info-label">Phone Number</div>
              <div className="contact-info-value">
                {phone || 'Not set'}
                {phoneVerified && <span className="verified-badge">✓ Verified</span>}
              </div>
            </div>
            <button className="change-btn" onClick={handleChangePhone}>
              <Phone size={14} />
              {phone ? 'Change' : 'Add'}
            </button>
          </div>

          <div className="toggle-item">
            <div className="toggle-item-info">
              <div className="toggle-item-title">Private Account</div>
              <div className="toggle-item-desc">Only approved followers can see your content</div>
            </div>
            <div 
              className={`toggle-switch ${privacy.privateAccount ? 'active' : ''}`}
              onClick={() => handlePrivacyChange('privateAccount')}
            >
              <div className="toggle-switch-handle"></div>
            </div>
          </div>

          <div className="toggle-item">
            <div className="toggle-item-info">
              <div className="toggle-item-title">Show Email in Profile</div>
              <div className="toggle-item-desc">Make your email visible to others</div>
            </div>
            <div 
              className={`toggle-switch ${privacy.showEmail ? 'active' : ''}`}
              onClick={() => handlePrivacyChange('showEmail')}
            >
              <div className="toggle-switch-handle"></div>
            </div>
          </div>

          {phone && (
            <div className="toggle-item">
              <div className="toggle-item-info">
                <div className="toggle-item-title">Show Phone in Profile</div>
                <div className="toggle-item-desc">Make your phone number visible to others</div>
              </div>
              <div 
                className={`toggle-switch ${privacy.showPhone ? 'active' : ''}`}
                onClick={() => handlePrivacyChange('showPhone')}
              >
                <div className="toggle-switch-handle"></div>
              </div>
            </div>
          )}
        </div>

        {/* Subscription */}
        <div className="settings-card">
          <div className="settings-card-header">
            <div className="settings-card-left">
              <div className="settings-icon-wrapper">
                <User size={24} />
              </div>
              <h3 className="settings-card-title">Subscription</h3>
            </div>
          </div>
          <div className={`subscription-badge subscription-${subscription.isActive ? 'active' : 'free'}`}>
            {subscription.plan}
          </div>
          <p style={{ fontSize: '14px', color: '#a3a3a3', margin: '0 0 16px 0', lineHeight: '1.6' }}>
            {subscription.isActive 
              ? 'You have access to all Pro features including advanced analytics and priority support.' 
              : 'Upgrade to Pro to unlock advanced features, analytics, and earn 10% more on all content.'}
          </p>
          <button 
            className="change-btn" 
            style={{ width: '100%', justifyContent: 'center' }}
            onClick={handleUpgradeSubscription}
            disabled={subscription.isActive}
          >
            {subscription.isActive ? 'Manage Subscription' : 'Upgrade to Pro'}
          </button>
        </div>

        {/* Save Button */}
        <button 
          className="save-button" 
          onClick={handleSaveSettings}
          disabled={saving || !hasChanges}
        >
          {saving ? (
            <>
              <Loader size={18} style={{ animation: 'spin 1s linear infinite' }} />
              Saving...
            </>
          ) : (
            <>
              <Save size={18} />
              Save All Settings
            </>
          )}
        </button>
      </div>

      {/* Modals */}
      <StatusModal {...statusModal} onClose={hideStatus} />
      <ConfirmModal
        {...confirmModal}
        onConfirm={() => {
          if (confirmModal.action) confirmModal.action();
        }}
        onCancel={hideConfirm}
      />
      <PhoneVerificationModal
        show={showPhoneModal}
        onClose={() => setShowPhoneModal(false)}
        userId={userId}
        currentPhone={phone}
        onSuccess={handlePhoneVerified}
      />
    </>
  );
};

export default SettingsSection;