/**
 * BoostUpgradeExample — Complete real-world example implementation
 * ============================================================================
 * Shows how to integrate BoostPage into an existing profile/settings page
 * with proper state management and error handling.
 *
 * Copy and adapt this to your needs!
 */

import React, { useState, useEffect } from 'react';
import { useBoost } from '../../hooks/useBoost';
import { BoostPage, BoostTierSelector } from '../../components/Boost';
import { useAuth } from '../../contexts/AuthContext'; // or your auth context
import { ChevronRight, Zap, AlertCircle } from 'lucide-react';

/**
 * ProfileBoostSection — Embeddable component for profile/settings pages
 * Shows current boost status + upgrade button
 */
export const ProfileBoostSection = ({ userId = null }) => {
  const { currentUser } = useAuth();
  const actualUserId = userId || currentUser?.id;
  
  const { boost, loading, epBalance, activateBoost, cancelBoost } = useBoost(actualUserId);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [upgradeError, setUpgradeError] = useState(null);

  const handleUpgradeClick = (tier) => {
    setUpgradeError(null);
    setShowUpgradeModal(true);
  };

  const handleUpgradeComplete = async (tier) => {
    try {
      const result = await activateBoost(tier, 'monthly');
      
      if (!result.success) {
        setUpgradeError(result.error || 'Upgrade failed. Please try again.');
        return;
      }

      // Success! Modal will close automatically
      setShowUpgradeModal(false);
      
      // Optional: Show success toast
      // showToast(`Upgraded to ${tier}!`, 'success');
      
    } catch (err) {
      setUpgradeError(err.message || 'An error occurred during upgrade');
    }
  };

  if (loading) {
    return (
      <div style={{ padding: 24, textAlign: 'center' }}>
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)' }}>
          Loading boost status...
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        borderRadius: 16,
        border: '1px solid rgba(255,255,255,0.08)',
        overflow: 'hidden',
        background: 'rgba(255,255,255,0.02)',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '20px 24px',
          background: 'linear-gradient(135deg, rgba(191,228,255,0.08) 0%, rgba(191,228,255,0.02) 100%)',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
        }}
      >
        <Zap size={18} color='#bfe4ff' />
        <div>
          <h3 style={{ fontSize: 16, fontWeight: 800, margin: 0, color: 'rgba(255,255,255,0.95)' }}>
            Profile Boost
          </h3>
          <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', margin: '4px 0 0 0' }}>
            Unlock premium profile designs
          </p>
        </div>
      </div>

      {/* Content */}
      <div style={{ padding: 24 }}>
        {/* Current status */}
        {boost ? (
          <div style={{ marginBottom: 24 }}>
            <div
              style={{
                padding: 16,
                background: 'rgba(191,228,255,0.06)',
                borderRadius: 12,
                border: '1px solid rgba(191,228,255,0.2)',
                marginBottom: 16,
              }}
            >
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', fontWeight: 700, marginBottom: 6 }}>
                CURRENT TIER
              </div>
              <div
                style={{
                  fontSize: 18,
                  fontWeight: 800,
                  color: '#bfe4ff',
                  textTransform: 'capitalize',
                }}
              >
                {boost.tier}
              </div>
              {boost.expires_at && (
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', marginTop: 8 }}>
                  Expires: {new Date(boost.expires_at).toLocaleDateString()}
                </div>
              )}
            </div>

            <div style={{ display: 'flex', gap: 12 }}>
              <button
                onClick={() => setShowUpgradeModal(true)}
                style={{
                  flex: 1,
                  padding: '10px 16px',
                  borderRadius: 10,
                  border: 'none',
                  background: '#bfe4ff15',
                  color: '#bfe4ff',
                  fontWeight: 700,
                  cursor: 'pointer',
                  fontSize: 13,
                  transition: 'all 0.2s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = '#bfe4ff25';
                  e.currentTarget.style.transform = 'translateY(-2px)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = '#bfe4ff15';
                  e.currentTarget.style.transform = 'translateY(0)';
                }}
              >
                Upgrade Tier
              </button>

              <button
                onClick={async () => {
                  if (window.confirm('Cancel your boost subscription?')) {
                    const result = await cancelBoost();
                    if (!result.success) {
                      setUpgradeError(result.error || 'Cancellation failed');
                    }
                  }
                }}
                style={{
                  flex: 1,
                  padding: '10px 16px',
                  borderRadius: 10,
                  border: '1px solid rgba(255,255,255,0.1)',
                  background: 'transparent',
                  color: 'rgba(255,255,255,0.6)',
                  fontWeight: 700,
                  cursor: 'pointer',
                  fontSize: 13,
                  transition: 'all 0.2s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)';
                  e.currentTarget.style.color = 'rgba(255,255,255,0.8)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)';
                  e.currentTarget.style.color = 'rgba(255,255,255,0.6)';
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div style={{ marginBottom: 24 }}>
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)', marginBottom: 16 }}>
              No active boost. Upgrade to unlock premium profile designs, custom animations, and exclusive features.
            </p>

            <button
              onClick={() => setShowUpgradeModal(true)}
              style={{
                width: '100%',
                padding: '12px 16px',
                borderRadius: 10,
                border: 'none',
                background: 'linear-gradient(135deg, #bfe4ff25, #bfe4ff15)',
                color: '#bfe4ff',
                fontWeight: 700,
                cursor: 'pointer',
                fontSize: 14,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'linear-gradient(135deg, #bfe4ff35, #bfe4ff25)';
                e.currentTarget.style.transform = 'translateY(-2px)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'linear-gradient(135deg, #bfe4ff25, #bfe4ff15)';
                e.currentTarget.style.transform = 'translateY(0)';
              }}
            >
              Choose Tier
              <ChevronRight size={16} />
            </button>
          </div>
        )}

        {/* Error message */}
        {upgradeError && (
          <div
            style={{
              padding: 12,
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              borderRadius: 10,
              display: 'flex',
              gap: 10,
              alignItems: 'flex-start',
              marginBottom: 16,
            }}
          >
            <AlertCircle size={16} color='#ef4444' style={{ marginTop: 2, flexShrink: 0 }} />
            <div style={{ fontSize: 12, color: '#ef4444' }}>
              {upgradeError}
            </div>
          </div>
        )}

        {/* Info boxes */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginTop: 20 }}>
          <InfoBox
            icon='◈'
            label='Silver'
            value='$1/mo'
            color='#c7ced4'
          />
          <InfoBox
            icon='♛'
            label='Gold'
            value='$2/mo'
            color='#fbbf24'
          />
          <InfoBox
            icon='✦'
            label='Diamond'
            value='$3/mo'
            color='#bfe4ff'
          />
        </div>
      </div>

      {/* Upgrade modal */}
      {showUpgradeModal && (
        <BoostPage
          isModal={true}
          userId={actualUserId}
          onClose={() => setShowUpgradeModal(false)}
          onUpgradeComplete={handleUpgradeComplete}
        />
      )}
    </div>
  );
};

/**
 * InfoBox — Small info display component
 */
const InfoBox = ({ icon, label, value, color }) => (
  <div
    style={{
      padding: 12,
      borderRadius: 10,
      background: 'rgba(255,255,255,0.03)',
      border: `1px solid rgba(255,255,255,0.06)`,
      textAlign: 'center',
    }}
  >
    <div style={{ fontSize: 18, marginBottom: 4 }}>{icon}</div>
    <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', fontWeight: 700 }}>
      {label}
    </div>
    <div style={{ fontSize: 13, color, fontWeight: 800, marginTop: 4 }}>
      {value}
    </div>
  </div>
);

/**
 * SettingsPage Example — How to use ProfileBoostSection in a settings page
 */
export const SettingsPageExample = () => {
  const { currentUser } = useAuth();

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: 24 }}>
      <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 24 }}>
        Account Settings
      </h1>

      {/* Profile section */}
      <section style={{ marginBottom: 40 }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>
          Profile
        </h2>
        {/* Your existing profile settings here */}
      </section>

      {/* Boost section */}
      <section style={{ marginBottom: 40 }}>
        <ProfileBoostSection userId={currentUser?.id} />
      </section>

      {/* Notifications section */}
      <section>
        <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>
          Notifications
        </h2>
        {/* Your existing notification settings here */}
      </section>
    </div>
  );
};

/**
 * LaunchPage Example — How to show as a dedicated promotion page
 */
export const BoostLaunchPageExample = () => {
  const { currentUser } = useAuth();

  return (
    <div>
      {/* Hero section */}
      <div
        style={{
          textAlign: 'center',
          padding: '60px 20px',
          background: 'linear-gradient(135deg, #0f0f1e 0%, #1a1a2e 100%)',
        }}
      >
        <h1 style={{ fontSize: 40, fontWeight: 900, marginBottom: 16 }}>
          Boost Your Profile
        </h1>
        <p style={{ fontSize: 16, color: 'rgba(255,255,255,0.7)', maxWidth: 500, margin: '0 auto' }}>
          Stand out with premium designs, animations, and exclusive features
        </p>
      </div>

      {/* Boost section */}
      <div style={{ padding: '40px 20px' }}>
        <ProfileBoostSection userId={currentUser?.id} />
      </div>
    </div>
  );
};

export default ProfileBoostSection;
