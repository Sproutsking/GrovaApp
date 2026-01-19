// src/components/Account/SecuritySection.jsx - COMPLETE REWRITE
import React, { useState, useEffect } from 'react';
import { Shield, Smartphone, Lock, Eye, EyeOff, Activity, Loader, AlertTriangle } from 'lucide-react';
import { supabase } from '../../services/config/supabase';
import StatusModal from '../Modals/StatusModal';
import ConfirmModal from '../Modals/ConfirmModal';
import TwoFactorSetupModal from '../Modals/TwoFactorSetupModal';
import DeviceManagement from './DeviceManagement';

const SecuritySection = ({ userId }) => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // Modals
  const [statusModal, setStatusModal] = useState({ show: false, type: 'success', message: '' });
  const [confirmModal, setConfirmModal] = useState({ show: false, title: '', message: '', action: null, dangerous: false });
  const [show2FASetup, setShow2FASetup] = useState(false);
  const [showDeviceManager, setShowDeviceManager] = useState(false);
  const [showPasswordChange, setShowPasswordChange] = useState(false);
  
  // Security state
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
  const [securityLevel, setSecurityLevel] = useState(1);
  const [recentActivity, setRecentActivity] = useState([]);
  const [accountLocked, setAccountLocked] = useState(false);

  // Password change state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordError, setPasswordError] = useState('');

  useEffect(() => {
    loadSecurityData();
  }, [userId]);

  const loadSecurityData = async () => {
    try {
      setLoading(true);

      // Load profile data
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('security_level, account_locked_until, require_2fa')
        .eq('id', userId)
        .single();

      if (profileError) throw profileError;

      if (profile) {
        setSecurityLevel(profile.security_level || 1);
        setAccountLocked(
          profile.account_locked_until && 
          new Date(profile.account_locked_until) > new Date()
        );
      }

      // Load 2FA status
      const { data: twoFAData, error: twoFAError } = await supabase
        .from('two_factor_auth')
        .select('enabled')
        .eq('user_id', userId)
        .maybeSingle();

      if (!twoFAError && twoFAData) {
        setTwoFactorEnabled(twoFAData.enabled || false);
      }

      // Load recent security events
      const { data: events, error: eventsError } = await supabase
        .from('security_events')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(10);

      if (!eventsError && events) {
        setRecentActivity(events.map(event => ({
          id: event.id,
          type: event.event_type,
          time: formatTimeAgo(event.created_at),
          location: event.metadata?.location || event.ip_address || 'Unknown location',
          severity: event.severity
        })));
      }

    } catch (error) {
      console.error('Failed to load security data:', error);
      showStatus('error', 'Failed to load security settings');
    } finally {
      setLoading(false);
    }
  };

  const formatTimeAgo = (timestamp) => {
    const now = new Date();
    const past = new Date(timestamp);
    const diff = now - past;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return past.toLocaleDateString();
  };

  const showStatus = (type, message) => {
    setStatusModal({ show: true, type, message });
  };

  const hideStatus = () => {
    setStatusModal({ show: false, type: 'success', message: '' });
  };

  const showConfirm = (title, message, action, dangerous = false) => {
    setConfirmModal({ show: true, title, message, action, dangerous });
  };

  const hideConfirm = () => {
    setConfirmModal({ show: false, title: '', message: '', action: null, dangerous: false });
  };

  const handleToggle2FA = () => {
    if (twoFactorEnabled) {
      showConfirm(
        'Disable Two-Factor Authentication',
        'Are you sure you want to disable 2FA? This will make your account less secure and reduce your security level.',
        async () => {
          try {
            setSaving(true);
            hideConfirm();

            const { error } = await supabase
              .from('two_factor_auth')
              .update({ enabled: false })
              .eq('user_id', userId);

            if (error) throw error;

            await supabase.from('profiles').update({
              require_2fa: false,
              security_level: Math.max(securityLevel - 2, 1)
            }).eq('id', userId);

            await supabase.from('security_events').insert({
              user_id: userId,
              event_type: '2fa_disabled',
              severity: 'warning',
              metadata: {}
            });

            setTwoFactorEnabled(false);
            showStatus('success', '2FA disabled successfully');
            loadSecurityData();

          } catch (err) {
            console.error('Failed to disable 2FA:', err);
            showStatus('error', 'Failed to disable 2FA');
          } finally {
            setSaving(false);
          }
        },
        true // dangerous
      );
    } else {
      setShow2FASetup(true);
    }
  };

  const handle2FASuccess = () => {
    setTwoFactorEnabled(true);
    showStatus('success', '2FA enabled successfully! Your account is now more secure.');
    loadSecurityData();
  };

  const validatePassword = (password) => {
    if (password.length < 8) return 'Password must be at least 8 characters';
    if (!/[A-Z]/.test(password)) return 'Password must contain an uppercase letter';
    if (!/[a-z]/.test(password)) return 'Password must contain a lowercase letter';
    if (!/\d/.test(password)) return 'Password must contain a number';
    if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) return 'Password must contain a special character';
    return '';
  };

  const handlePasswordChange = async () => {
    try {
      setPasswordError('');

      if (!currentPassword || !newPassword || !confirmPassword) {
        setPasswordError('All fields are required');
        return;
      }

      if (newPassword !== confirmPassword) {
        setPasswordError('New passwords do not match');
        return;
      }

      const validationError = validatePassword(newPassword);
      if (validationError) {
        setPasswordError(validationError);
        return;
      }

      // If 2FA is enabled, require verification
      if (twoFactorEnabled) {
        showConfirm(
          '2FA Verification Required',
          'Please enter your 2FA code to confirm password change.',
          async () => {
            await performPasswordChange();
          }
        );
      } else {
        showConfirm(
          'Change Password',
          'Are you sure you want to change your password?',
          async () => {
            await performPasswordChange();
          }
        );
      }

    } catch (error) {
      console.error('Password validation error:', error);
      setPasswordError(error.message || 'Failed to validate password');
    }
  };

  const performPasswordChange = async () => {
    try {
      setSaving(true);
      hideConfirm();

      const { error } = await supabase.auth.updateUser({ 
        password: newPassword 
      });

      if (error) throw error;

      await supabase.from('profiles').update({ 
        password_changed_at: new Date().toISOString(),
        security_level: Math.min(securityLevel + 1, 5)
      }).eq('id', userId);

      await supabase.from('security_events').insert({
        user_id: userId,
        event_type: 'password_changed',
        severity: 'info',
        metadata: {}
      });

      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setShowPasswordChange(false);
      showStatus('success', 'Password changed successfully!');
      loadSecurityData();

    } catch (error) {
      console.error('Password change error:', error);
      showStatus('error', error.message || 'Failed to change password');
    } finally {
      setSaving(false);
    }
  };

  const getSecurityLevelColor = (level) => {
    if (level >= 4) return '#84cc16';
    if (level >= 3) return '#fbbf24';
    return '#ef4444';
  };

  const getSecurityLevelText = (level) => {
    if (level >= 5) return 'Excellent';
    if (level >= 4) return 'Very Good';
    if (level >= 3) return 'Good';
    if (level >= 2) return 'Fair';
    return 'Weak';
  };

  const getActivityIcon = (type) => {
    const icons = {
      login_success: '✅',
      login_failed: '❌',
      password_changed: '🔑',
      device_trusted: '📱',
      device_untrusted: '🔓',
      '2fa_enabled': '🔒',
      '2fa_disabled': '🔓',
      '2fa_verified': '✅',
      '2fa_failed': '❌',
      account_locked: '🚫',
      account_unlocked: '🔓',
      email_changed: '📧',
      phone_verified: '📱',
      settings_updated: '⚙️',
      suspicious_activity: '⚠️'
    };
    return icons[type] || '🔔';
  };

  const getActivityText = (type) => {
    const texts = {
      login_success: 'Successful login',
      login_failed: 'Failed login attempt',
      password_changed: 'Password changed',
      device_trusted: 'Device trusted',
      device_untrusted: 'Device removed',
      '2fa_enabled': '2FA enabled',
      '2fa_disabled': '2FA disabled',
      '2fa_verified': '2FA verified',
      '2fa_failed': '2FA verification failed',
      account_locked: 'Account locked',
      account_unlocked: 'Account unlocked',
      email_changed: 'Email address changed',
      phone_verified: 'Phone number verified',
      settings_updated: 'Settings updated',
      suspicious_activity: 'Suspicious activity detected'
    };
    return texts[type] || 'Security event';
  };

  const getSeverityColor = (severity) => {
    if (severity === 'critical') return '#ef4444';
    if (severity === 'warning') return '#f59e0b';
    return '#84cc16';
  };

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '60px 20px',
        gap: '16px'
      }}>
        <Loader size={32} style={{ animation: 'spin 1s linear infinite', color: '#84cc16' }} />
        <p style={{ color: '#a3a3a3' }}>Loading security settings...</p>
      </div>
    );
  }

  return (
    <>
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        .security-section {
          padding: 20px;
        }
        .security-card {
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(132, 204, 22, 0.2);
          borderRadius: 12px;
          padding: 24px;
          marginBottom: 20px;
        }
        .security-card h4 {
          display: flex;
          alignItems: center;
          gap: 10px;
          fontSize: 18px;
          fontWeight: 700;
          color: #ffffff;
          margin: 0 0 16px 0;
        }
        .security-level-bar {
          width: 100%;
          height: 8px;
          background: rgba(255, 255, 255, 0.1);
          borderRadius: 4px;
          overflow: hidden;
          margin: 16px 0;
        }
        .security-level-fill {
          height: 100%;
          transition: width 0.3s, background 0.3s;
        }
        .security-option {
          display: flex;
          alignItems: center;
          justifyContent: space-between;
          padding: 16px;
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.05);
          borderRadius: 8px;
          marginBottom: 12px;
        }
        .toggle-switch {
          position: relative;
          width: 48px;
          height: 24px;
          background: rgba(255, 255, 255, 0.1);
          borderRadius: 12px;
          cursor: pointer;
          transition: background 0.3s;
        }
        .toggle-switch.active {
          background: #84cc16;
        }
        .toggle-switch-handle {
          position: absolute;
          top: 2px;
          left: 2px;
          width: 20px;
          height: 20px;
          background: #ffffff;
          borderRadius: 50%;
          transition: transform 0.3s;
        }
        .toggle-switch.active .toggle-switch-handle {
          transform: translateX(24px);
        }
        .action-btn {
          padding: 12px 24px;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(132, 204, 22, 0.3);
          borderRadius: 8px;
          color: #84cc16;
          fontSize: 14px;
          fontWeight: 600;
          cursor: pointer;
          transition: all 0.3s;
        }
        .action-btn:hover {
          background: rgba(132, 204, 22, 0.1);
          borderColor: #84cc16;
        }
        .password-input-group {
          position: relative;
          marginBottom: 16px;
        }
        .password-input {
          width: 100%;
          padding: 12px 40px 12px 12px;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(132, 204, 22, 0.2);
          borderRadius: 8px;
          color: #ffffff;
          fontSize: 14px;
          boxSizing: border-box;
        }
        .password-toggle {
          position: absolute;
          right: 12px;
          top: 50%;
          transform: translateY(-50%);
          background: none;
          border: none;
          color: #737373;
          cursor: pointer;
          padding: 0;
        }
        .error-text {
          color: #ef4444;
          fontSize: 13px;
          marginTop: 8px;
        }
        .activity-item {
          display: flex;
          alignItems: flex-start;
          gap: 12px;
          padding: 12px;
          borderBottom: 1px solid rgba(255, 255, 255, 0.05);
        }
        .activity-item:last-child {
          borderBottom: none;
        }
        
         .security-section {
          padding: 20px;
        }

        .security-card {
          background: linear-gradient(135deg, rgba(132, 204, 22, 0.05) 0%, rgba(132, 204, 22, 0.02) 100%);
          border: 1px solid rgba(132, 204, 22, 0.3);
          border-radius: 20px;
          padding: 28px;
          margin-bottom: 24px;
          position: relative;
          overflow: hidden;
        }

        .security-card::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 4px;
          background: linear-gradient(90deg, #84cc16 0%, #65a30d 100%);
        }

        .security-card-header {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 20px;
        }

        .security-icon-wrapper {
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

        .security-card-title {
          font-size: 20px;
          font-weight: 800;
          color: #ffffff;
          margin: 0;
        }

        .security-level-display {
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 12px;
          padding: 16px;
          margin-bottom: 16px;
        }

        .security-level-text {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 12px;
        }

        .security-level-label {
          font-size: 14px;
          color: #a3a3a3;
          font-weight: 600;
        }

        .security-level-value {
          font-size: 18px;
          font-weight: 800;
        }

        .security-level-bar {
          width: 100%;
          height: 10px;
          background: rgba(255, 255, 255, 0.1);
          border-radius: 5px;
          overflow: hidden;
          position: relative;
        }

        .security-level-fill {
          height: 100%;
          transition: width 0.5s cubic-bezier(0.4, 0, 0.2, 1);
          border-radius: 5px;
          position: relative;
          overflow: hidden;
        }

        .security-level-fill::after {
          content: '';
          position: absolute;
          inset: 0;
          background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.3), transparent);
          animation: shimmer 2s infinite;
        }

        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }

        .security-option {
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

        .security-option:hover {
          background: rgba(255, 255, 255, 0.05);
          border-color: rgba(132, 204, 22, 0.3);
        }

        .security-option-info {
          flex: 1;
        }

        .security-option-title {
          font-size: 15px;
          font-weight: 700;
          color: #ffffff;
          margin-bottom: 4px;
        }

        .security-option-desc {
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

        .action-btn {
          padding: 14px 24px;
          background: rgba(132, 204, 22, 0.1);
          border: 1px solid rgba(132, 204, 22, 0.3);
          border-radius: 10px;
          color: #84cc16;
          font-size: 14px;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.2s;
        }

        .action-btn:hover {
          background: rgba(132, 204, 22, 0.15);
          border-color: #84cc16;
          transform: translateY(-2px);
        }

        .activity-list {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .activity-item {
          display: flex;
          align-items: flex-start;
          gap: 14px;
          padding: 16px;
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.05);
          border-radius: 12px;
          transition: all 0.2s;
        }

        .activity-item:hover {
          background: rgba(255, 255, 255, 0.05);
          border-color: rgba(132, 204, 22, 0.3);
        }

        .activity-icon {
          font-size: 28px;
          flex-shrink: 0;
        }

        .activity-info {
          flex: 1;
        }

        .activity-text {
          font-size: 14px;
          color: #ffffff;
          margin: 0 0 6px 0;
          font-weight: 600;
        }

        .activity-meta {
          font-size: 12px;
          color: #737373;
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .severity-indicator {
          width: 8px;
          height: 8px;
          border-radius: 50%;
        }
      `}</style>

      <div className="security-section">
        {accountLocked && (
          <div style={{
            background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid #ef4444',
            borderRadius: '12px',
            padding: '16px',
            marginBottom: '20px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px'
          }}>
            <AlertTriangle size={20} style={{ color: '#ef4444', flexShrink: 0 }} />
            <div style={{ color: '#ef4444', fontSize: '14px' }}>
              Your account is temporarily locked due to suspicious activity. Contact support if you need assistance.
            </div>
          </div>
        )}

        {/* Security Level */}
        <div className="security-card">
          <h4>
            <Shield size={18} style={{ color: '#84cc16' }} />
            Security Level: {getSecurityLevelText(securityLevel)}
          </h4>
          <div className="security-level-bar">
            <div
              className="security-level-fill"
              style={{
                width: `${(securityLevel / 5) * 100}%`,
                background: getSecurityLevelColor(securityLevel)
              }}
            ></div>
          </div>
          <p style={{ fontSize: '14px', color: '#a3a3a3', margin: 0 }}>
            {securityLevel >= 4
              ? 'Your account is well protected with strong security measures.'
              : 'Enable more security features to better protect your account.'}
          </p>
        </div>

        {/* Authentication */}
        <div className="security-card">
          <h4>
            <Lock size={18} style={{ color: '#84cc16' }} />
            Authentication
          </h4>

          <div className="security-option">
            <div>
              <div style={{ fontSize: '15px', color: '#fff', fontWeight: '600', marginBottom: '4px' }}>
                Two-Factor Authentication (2FA)
              </div>
              <div style={{ fontSize: '13px', color: '#737373' }}>
                {twoFactorEnabled ? 'Your account is protected with 2FA ✓' : 'Add an extra layer of security'}
              </div>
            </div>
            <div
              className={`toggle-switch ${twoFactorEnabled ? 'active' : ''}`}
              onClick={saving ? undefined : handleToggle2FA}
              style={{ cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.5 : 1 }}
            >
              <div className="toggle-switch-handle"></div>
            </div>
          </div>

          <div className="security-option">
            <div>
              <div style={{ fontSize: '15px', color: '#fff', fontWeight: '600', marginBottom: '4px' }}>
                Password
              </div>
              <div style={{ fontSize: '13px', color: '#737373' }}>
                Change your account password
              </div>
            </div>
            <button
              className="action-btn"
              onClick={() => setShowPasswordChange(!showPasswordChange)}
            >
              {showPasswordChange ? 'Cancel' : 'Change Password'}
            </button>
          </div>

          {showPasswordChange && (
            <div style={{ marginTop: '16px', padding: '20px', background: 'rgba(132, 204, 22, 0.05)', borderRadius: '8px', border: '1px solid rgba(132, 204, 22, 0.1)' }}>
              <div className="password-input-group">
                <input
                  type={showCurrentPassword ? 'text' : 'password'}
                  className="password-input"
                  placeholder="Current password"
                  value={currentPassword}
                  onChange={e => setCurrentPassword(e.target.value)}
                />
                <button
                  className="password-toggle"
                  onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                >
                  {showCurrentPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>

              <div className="password-input-group">
                <input
                  type={showNewPassword ? 'text' : 'password'}
                  className="password-input"
                  placeholder="New password (min 8 characters)"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                />
                <button
                  className="password-toggle"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                >
                  {showNewPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>

              <div className="password-input-group">
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  className="password-input"
                  placeholder="Confirm new password"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                />
                <button
                  className="password-toggle"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                >
                  {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>

              {passwordError && <div className="error-text">{passwordError}</div>}

              <button
                onClick={handlePasswordChange}
                disabled={saving}
                style={{
                  width: '100%',
                  padding: '12px',
                  background: saving ? '#333' : 'linear-gradient(135deg, #84cc16 0%, #65a30d 100%)',
                  border: 'none',
                  borderRadius: '8px',
                  color: saving ? '#666' : '#000',
                  fontWeight: '600',
                  cursor: saving ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px'
                }}
              >
                {saving ? (
                  <>
                    <Loader size={16} style={{ animation: 'spin 1s linear infinite' }} />
                    Updating...
                  </>
                ) : (
                  <>
                    <Lock size={16} />
                    Update Password
                  </>
                )}
              </button>
            </div>
          )}
        </div>

        {/* Trusted Devices */}
        <div className="security-card">
          <h4>
            <Smartphone size={18} style={{ color: '#84cc16' }} />
            Trusted Devices
          </h4>
          <p style={{ fontSize: '14px', color: '#a3a3a3', marginBottom: '16px' }}>
            Manage devices that can access your account without additional verification
          </p>
          <button className="action-btn" onClick={() => setShowDeviceManager(true)}>
            Manage Devices
          </button>
        </div>

        {/* Recent Activity */}
        <div className="security-card">
          <h4>
            <Activity size={18} style={{ color: '#84cc16' }} />
            Recent Security Activity
          </h4>
          <div>
            {recentActivity.length === 0 ? (
              <p style={{ color: '#737373', fontSize: '14px' }}>No recent activity</p>
            ) : (
              recentActivity.map(activity => (
                <div key={activity.id} className="activity-item">
                  <div style={{ fontSize: '24px' }}>{getActivityIcon(activity.type)}</div>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: '14px', color: '#ffffff', margin: '0 0 4px 0' }}>
                      {getActivityText(activity.type)}
                      {activity.severity && (
                        <span style={{ 
                          marginLeft: '8px',
                          fontSize: '12px',
                          color: getSeverityColor(activity.severity)
                        }}>
                          •
                        </span>
                      )}
                    </p>
                    <div style={{ fontSize: '12px', color: '#737373' }}>
                      {activity.time} • {activity.location}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
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
      <TwoFactorSetupModal
        show={show2FASetup}
        onClose={() => setShow2FASetup(false)}
        userId={userId}
        onSuccess={handle2FASuccess}
      />
      {showDeviceManager && (
        <DeviceManagement
          userId={userId}
          onClose={() => setShowDeviceManager(false)}
          onDeviceRemoved={loadSecurityData}
        />
      )}
    </>
  );
};

export default SecuritySection;