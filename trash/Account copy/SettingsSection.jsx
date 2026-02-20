// ============================================================================
// src/components/Account/SettingsSection.jsx - WITH VERIFIED BADGES & EMAIL MODAL
// ============================================================================

import React, { useState, useEffect } from "react";
import {
  Bell,
  Lock,
  User,
  Loader,
  Save,
  Mail,
  Phone,
  AlertTriangle,
  ShieldCheck,
  BadgeCheck,
} from "lucide-react";
import settingsService from "../../services/account/settingsService";
import StatusModal from "../Modals/StatusModal";
import ConfirmModal from "../Modals/ConfirmModal";
import PhoneVerificationModal from "../Modals/PhoneVerificationModal";
import EmailVerificationModal from "../Modals/EmailVerificationModal";

const SettingsSection = ({ userId }) => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  const [email, setEmail] = useState("");
  const [emailVerified, setEmailVerified] = useState(true); // always true after signup
  const [phone, setPhone] = useState("");
  const [phoneVerified, setPhoneVerified] = useState(false);

  const [showPhoneModal, setShowPhoneModal] = useState(false);
  const [showEmailModal, setShowEmailModal] = useState(false);

  // DEFAULT TO ALL OFF
  const [notifications, setNotifications] = useState({
    profileVisits: false,
    comments: false,
    likes: false,
    shares: false,
    newFollowers: false,
    storyUnlocks: false,
  });

  const [privacy, setPrivacy] = useState({
    privateAccount: false,
    showEmail: false,
    showPhone: false,
  });

  const [subscription, setSubscription] = useState({
    isActive: false,
    plan: "Free",
    renewalDate: null,
  });

  const [statusModal, setStatusModal] = useState({
    show: false,
    type: "success",
    message: "",
  });
  const [confirmModal, setConfirmModal] = useState({
    show: false,
    title: "",
    message: "",
    action: null,
  });

  useEffect(() => {
    if (userId) loadSettings();
  }, [userId]);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const [settings, subscriptionStatus] = await Promise.all([
        settingsService.getUserSettings(userId),
        settingsService.getSubscriptionStatus(userId),
      ]);

      setNotifications({
        profileVisits: settings.notifications.profileVisits === true,
        comments: settings.notifications.comments === true,
        likes: settings.notifications.likes === true,
        shares: settings.notifications.shares === true,
        newFollowers: settings.notifications.newFollowers === true,
        storyUnlocks: settings.notifications.storyUnlocks === true,
      });

      setPrivacy(settings.privacy);
      setEmail(settings.contact.email);
      setEmailVerified(settings.contact.emailVerified ?? true);
      setPhone(settings.contact.phone || "");
      setPhoneVerified(settings.contact.phoneVerified);
      setSubscription(subscriptionStatus);
      setHasChanges(false);
    } catch (error) {
      console.error("Failed to load settings:", error);
      showStatus("error", "Failed to load settings");
    } finally {
      setLoading(false);
    }
  };

  const showStatus = (type, message) =>
    setStatusModal({ show: true, type, message });
  const hideStatus = () =>
    setStatusModal({ show: false, type: "success", message: "" });

  const showConfirm = (title, message, action) =>
    setConfirmModal({ show: true, title, message, action });
  const hideConfirm = () =>
    setConfirmModal({ show: false, title: "", message: "", action: null });

  const handleNotificationChange = (key) => {
    setNotifications((prev) => ({ ...prev, [key]: !prev[key] }));
    setHasChanges(true);
  };

  const handlePrivacyChange = (key) => {
    setPrivacy((prev) => ({ ...prev, [key]: !prev[key] }));
    setHasChanges(true);
  };

  const handleSaveSettings = async () => {
    try {
      setSaving(true);
      await settingsService.updateNotificationSettings(userId, notifications);
      await settingsService.updatePrivacySettings(userId, privacy);
      setHasChanges(false);
      showStatus(
        "success",
        "Settings saved successfully! Your preferences are now active.",
      );
    } catch (error) {
      console.error("Failed to save settings:", error);
      showStatus("error", "Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  const handleUpgradeSubscription = () => {
    showConfirm(
      "Upgrade to Pro",
      "Upgrade to Pro to unlock advanced features, analytics, and earn 10% more on all content. Continue?",
      async () => {
        try {
          hideConfirm();
          setSaving(true);
          await settingsService.updateSubscription(userId, "pro");
          await loadSettings();
          showStatus("success", "Successfully upgraded to Pro!");
        } catch {
          showStatus("error", "Failed to upgrade subscription");
        } finally {
          setSaving(false);
        }
      },
    );
  };

  const handlePhoneVerified = async (newPhone) => {
    setPhone(newPhone);
    setPhoneVerified(true);
    showStatus("success", "Phone number verified successfully!");
    await loadSettings();
  };

  const handleEmailChanged = async (newEmail) => {
    setEmail(newEmail);
    setEmailVerified(true);
    showStatus("success", "Email address updated and verified!");
    await loadSettings();
  };

  const getEnabledCount = () =>
    Object.values(notifications).filter(Boolean).length;

  // ── Loading ──────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: "60px 20px",
            gap: "16px",
          }}
        >
          <Loader
            size={32}
            style={{ animation: "spin 1s linear infinite", color: "#84cc16" }}
          />
          <p style={{ color: "#a3a3a3" }}>Loading settings...</p>
        </div>
      </>
    );
  }

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes shimmer {
          0%   { background-position: -200% center; }
          100% { background-position:  200% center; }
        }
        @keyframes pulse-border {
          0%,100% { box-shadow: 0 0 0 0 rgba(34,197,94,.4); }
          50%      { box-shadow: 0 0 0 6px rgba(34,197,94,.0); }
        }

        /* ─ Layout ─ */
        .ss-section { padding: 20px; }

        /* ─ Card ─ */
        .ss-card {
          background: linear-gradient(135deg, rgba(132,204,22,.05) 0%, rgba(132,204,22,.02) 100%);
          border: 1px solid rgba(132,204,22,.3);
          border-radius: 20px; padding: 28px; margin-bottom: 24px;
          position: relative; overflow: hidden;
        }
        .ss-card::before {
          content: ''; position: absolute; top: 0; left: 0; right: 0; height: 4px;
          background: linear-gradient(90deg, #84cc16 0%, #65a30d 100%);
        }
        .ss-card-header {
          display: flex; align-items: center; justify-content: space-between;
          margin-bottom: 24px;
        }
        .ss-card-left { display: flex; align-items: center; gap: 12px; }
        .ss-icon-wrap {
          width: 48px; height: 48px; border-radius: 14px;
          background: linear-gradient(135deg, #84cc16 0%, #65a30d 100%);
          display: flex; align-items: center; justify-content: center; color: #000;
          box-shadow: 0 4px 16px rgba(132,204,22,.4);
        }
        .ss-card-title { font-size: 20px; font-weight: 800; color: #fff; margin: 0; }
        .ss-enabled-count {
          padding: 4px 12px; background: rgba(132,204,22,.2);
          border-radius: 8px; color: #84cc16; font-size: 12px; font-weight: 700;
        }

        /* ─ Toggles ─ */
        .ss-toggle-item {
          display: flex; align-items: center; justify-content: space-between;
          padding: 18px; background: rgba(255,255,255,.02);
          border: 1px solid rgba(255,255,255,.05);
          border-radius: 12px; margin-bottom: 12px; transition: all .2s;
        }
        .ss-toggle-item:hover {
          background: rgba(255,255,255,.05);
          border-color: rgba(132,204,22,.3);
        }
        .ss-toggle-item.active {
          background: rgba(132,204,22,.05);
          border-color: rgba(132,204,22,.3);
        }
        .ss-toggle-info { flex: 1; }
        .ss-toggle-title { font-size: 15px; font-weight: 700; color: #fff; margin-bottom: 4px; }
        .ss-toggle-desc  { font-size: 13px; color: #737373; }
        .ss-switch {
          position: relative; width: 52px; height: 28px;
          background: rgba(255,255,255,.1); border-radius: 14px;
          cursor: pointer; transition: all .3s;
          border: 2px solid rgba(255,255,255,.1); flex-shrink: 0;
        }
        .ss-switch.active {
          background: linear-gradient(135deg, #84cc16 0%, #65a30d 100%);
          border-color: #84cc16;
        }
        .ss-switch-handle {
          position: absolute; top: 2px; left: 2px;
          width: 20px; height: 20px; background: #fff;
          border-radius: 50%; transition: transform .3s;
          box-shadow: 0 2px 4px rgba(0,0,0,.2);
        }
        .ss-switch.active .ss-switch-handle { transform: translateX(24px); }

        /* ─ Contact box ─ */
        .ss-contact-box {
          background: rgba(255,255,255,.03); border: 1px solid rgba(255,255,255,.1);
          border-radius: 14px; padding: 18px; margin-bottom: 14px;
          display: flex; align-items: center; justify-content: space-between;
          gap: 12px; transition: border-color .2s;
        }
        .ss-contact-box:hover { border-color: rgba(132,204,22,.25); }
        .ss-contact-content { flex: 1; display: flex; flex-direction: column; gap: 7px; min-width: 0; }
        .ss-contact-label {
          font-size: 11px; color: #525252; font-weight: 700;
          text-transform: uppercase; letter-spacing: .6px;
        }
        .ss-contact-row { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
        .ss-contact-value {
          font-size: 15px; color: #fff; font-weight: 600;
          overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
          max-width: 220px;
        }

        /* ─ Beautiful Verified Badge ─ */
        .ss-verified-badge {
          display: inline-flex; align-items: center; gap: 5px;
          padding: 4px 10px; border-radius: 20px; font-size: 11px; font-weight: 800;
          letter-spacing: .3px;
          background: linear-gradient(135deg, rgba(34,197,94,.15) 0%, rgba(21,128,61,.15) 100%);
          border: 1px solid rgba(34,197,94,.35);
          color: #22c55e; position: relative; overflow: hidden;
          animation: pulse-border 3s ease infinite;
          flex-shrink: 0;
        }
        .ss-verified-badge::before {
          content: '';
          position: absolute; inset: 0;
          background: linear-gradient(90deg,
            transparent 0%,
            rgba(255,255,255,.12) 40%,
            rgba(255,255,255,.25) 50%,
            rgba(255,255,255,.12) 60%,
            transparent 100%);
          background-size: 200% 100%;
          animation: shimmer 2.4s ease infinite;
        }
        .ss-verified-badge-icon { position: relative; z-index: 1; flex-shrink: 0; }
        .ss-verified-badge-text { position: relative; z-index: 1; }

        /* Unverified pill */
        .ss-unverified-badge {
          display: inline-flex; align-items: center; gap: 5px;
          padding: 4px 10px; border-radius: 20px; font-size: 11px; font-weight: 700;
          background: rgba(251,191,36,.1); border: 1px solid rgba(251,191,36,.3);
          color: #fbbf24; flex-shrink: 0;
        }

        /* ─ Change button ─ */
        .ss-change-btn {
          padding: 9px 18px; background: rgba(132,204,22,.08);
          border: 1px solid rgba(132,204,22,.25); border-radius: 10px;
          color: #84cc16; font-size: 13px; font-weight: 700; cursor: pointer;
          transition: all .2s; display: flex; align-items: center; gap: 6px;
          white-space: nowrap; flex-shrink: 0;
        }
        .ss-change-btn:hover {
          background: rgba(132,204,22,.15); border-color: #84cc16;
          transform: translateY(-2px);
        }

        /* ─ Subscription ─ */
        .ss-sub-badge {
          display: inline-flex; padding: 8px 20px; border-radius: 12px;
          font-size: 14px; font-weight: 800; margin-bottom: 16px;
        }
        .ss-sub-active {
          background: rgba(132,204,22,.2); color: #84cc16;
          border: 2px solid rgba(132,204,22,.4);
        }
        .ss-sub-free {
          background: rgba(163,163,163,.15); color: #a3a3a3;
          border: 2px solid rgba(163,163,163,.3);
        }

        /* ─ Save button ─ */
        .ss-save-btn {
          width: 100%; padding: 18px;
          background: linear-gradient(135deg, #84cc16 0%, #65a30d 100%);
          border: none; border-radius: 16px; color: #000;
          font-size: 16px; font-weight: 800; cursor: pointer;
          display: flex; align-items: center; justify-content: center; gap: 10px;
          transition: all .3s;
          box-shadow: 0 4px 16px rgba(132,204,22,.4);
        }
        .ss-save-btn:hover:not(:disabled) {
          transform: translateY(-4px);
          box-shadow: 0 8px 32px rgba(132,204,22,.6);
        }
        .ss-save-btn:disabled { opacity: .5; cursor: not-allowed; transform: none; }

        /* ─ Banners ─ */
        .ss-changes-banner {
          background: rgba(251,191,36,.1); border: 1px solid rgba(251,191,36,.3);
          border-radius: 12px; padding: 16px; margin-bottom: 24px;
          display: flex; align-items: center; gap: 12px; color: #fbbf24;
        }
        .ss-info-banner {
          background: rgba(59,130,246,.1); border: 1px solid rgba(59,130,246,.3);
          border-radius: 12px; padding: 16px; margin-bottom: 24px;
          display: flex; align-items: flex-start; gap: 12px; color: #3b82f6;
        }
      `}</style>

      <div className="ss-section">
        {/* Info banner */}
        <div className="ss-info-banner">
          <Bell size={20} style={{ flexShrink: 0, marginTop: 2 }} />
          <div style={{ fontSize: "14px", lineHeight: "1.6" }}>
            <strong>Notification Settings:</strong> All notifications are turned
            OFF by default. Enable the types you want to receive. Changes take
            effect after saving.
          </div>
        </div>

        {hasChanges && (
          <div className="ss-changes-banner">
            <AlertTriangle size={20} />
            <span style={{ fontSize: "14px", fontWeight: "600" }}>
              You have unsaved changes
            </span>
          </div>
        )}

        {/* ── Notifications ─────────────────────────────────────────────────── */}
        <div className="ss-card">
          <div className="ss-card-header">
            <div className="ss-card-left">
              <div className="ss-icon-wrap">
                <Bell size={24} />
              </div>
              <h3 className="ss-card-title">Notifications</h3>
            </div>
            <span className="ss-enabled-count">
              {getEnabledCount()} / 6 enabled
            </span>
          </div>

          {Object.entries({
            profileVisits: "Profile Visits",
            comments: "Comments",
            likes: "Likes",
            shares: "Shares",
            newFollowers: "New Followers",
            storyUnlocks: "Story Unlocks",
          }).map(([key, label]) => (
            <div
              key={key}
              className={`ss-toggle-item ${notifications[key] ? "active" : ""}`}
            >
              <div className="ss-toggle-info">
                <div className="ss-toggle-title">{label}</div>
                <div className="ss-toggle-desc">
                  {notifications[key]
                    ? "You will be notified"
                    : "You will NOT be notified"}{" "}
                  when someone {label.toLowerCase()}
                </div>
              </div>
              <div
                className={`ss-switch ${notifications[key] ? "active" : ""}`}
                onClick={() => handleNotificationChange(key)}
              >
                <div className="ss-switch-handle" />
              </div>
            </div>
          ))}
        </div>

        {/* ── Privacy & Contact ──────────────────────────────────────────────── */}
        <div className="ss-card">
          <div className="ss-card-header">
            <div className="ss-card-left">
              <div className="ss-icon-wrap">
                <Lock size={24} />
              </div>
              <h3 className="ss-card-title">Privacy & Contact</h3>
            </div>
          </div>

          {/* Email row */}
          <div className="ss-contact-box">
            <div className="ss-contact-content">
              <div className="ss-contact-label">Email Address</div>
              <div className="ss-contact-row">
                <div className="ss-contact-value">{email || "Not set"}</div>
                {emailVerified ? (
                  <div className="ss-verified-badge">
                    <BadgeCheck size={12} className="ss-verified-badge-icon" />
                    <span className="ss-verified-badge-text">Verified</span>
                  </div>
                ) : (
                  <div className="ss-unverified-badge">
                    <AlertTriangle size={11} />
                    Unverified
                  </div>
                )}
              </div>
            </div>
            <button
              className="ss-change-btn"
              onClick={() => setShowEmailModal(true)}
            >
              <Mail size={14} />
              Change
            </button>
          </div>

          {/* Phone row */}
          <div className="ss-contact-box">
            <div className="ss-contact-content">
              <div className="ss-contact-label">Phone Number</div>
              <div className="ss-contact-row">
                <div className="ss-contact-value">{phone || "Not set"}</div>
                {phone &&
                  (phoneVerified ? (
                    <div className="ss-verified-badge">
                      <BadgeCheck
                        size={12}
                        className="ss-verified-badge-icon"
                      />
                      <span className="ss-verified-badge-text">Verified</span>
                    </div>
                  ) : (
                    <div className="ss-unverified-badge">
                      <AlertTriangle size={11} />
                      Unverified
                    </div>
                  ))}
              </div>
            </div>
            <button
              className="ss-change-btn"
              onClick={() => setShowPhoneModal(true)}
            >
              <Phone size={14} />
              {phone ? "Change" : "Add"}
            </button>
          </div>

          {/* Privacy toggles */}
          <div className="ss-toggle-item">
            <div className="ss-toggle-info">
              <div className="ss-toggle-title">Private Account</div>
              <div className="ss-toggle-desc">
                Only approved followers can see your content
              </div>
            </div>
            <div
              className={`ss-switch ${privacy.privateAccount ? "active" : ""}`}
              onClick={() => handlePrivacyChange("privateAccount")}
            >
              <div className="ss-switch-handle" />
            </div>
          </div>

          <div className="ss-toggle-item">
            <div className="ss-toggle-info">
              <div className="ss-toggle-title">Show Email in Profile</div>
              <div className="ss-toggle-desc">
                Make your email visible to others
              </div>
            </div>
            <div
              className={`ss-switch ${privacy.showEmail ? "active" : ""}`}
              onClick={() => handlePrivacyChange("showEmail")}
            >
              <div className="ss-switch-handle" />
            </div>
          </div>

          {phone && (
            <div className="ss-toggle-item">
              <div className="ss-toggle-info">
                <div className="ss-toggle-title">Show Phone in Profile</div>
                <div className="ss-toggle-desc">
                  Make your phone number visible to others
                </div>
              </div>
              <div
                className={`ss-switch ${privacy.showPhone ? "active" : ""}`}
                onClick={() => handlePrivacyChange("showPhone")}
              >
                <div className="ss-switch-handle" />
              </div>
            </div>
          )}
        </div>

        {/* ── Subscription ──────────────────────────────────────────────────── */}
        <div className="ss-card">
          <div className="ss-card-header">
            <div className="ss-card-left">
              <div className="ss-icon-wrap">
                <User size={24} />
              </div>
              <h3 className="ss-card-title">Subscription</h3>
            </div>
          </div>
          <div
            className={`ss-sub-badge ss-sub-${subscription.isActive ? "active" : "free"}`}
          >
            {subscription.plan}
          </div>
          <p
            style={{
              fontSize: "14px",
              color: "#a3a3a3",
              margin: "0 0 16px 0",
              lineHeight: "1.6",
            }}
          >
            {subscription.isActive
              ? "You have access to all Pro features including advanced analytics and priority support."
              : "Upgrade to Pro to unlock advanced features, analytics, and earn 10% more on all content."}
          </p>
          <button
            className="ss-change-btn"
            style={{ width: "100%", justifyContent: "center" }}
            onClick={handleUpgradeSubscription}
            disabled={subscription.isActive}
          >
            {subscription.isActive ? "Manage Subscription" : "Upgrade to Pro"}
          </button>
        </div>

        {/* Save */}
        <button
          className="ss-save-btn"
          onClick={handleSaveSettings}
          disabled={saving || !hasChanges}
        >
          {saving ? (
            <>
              <Loader
                size={18}
                style={{ animation: "spin 1s linear infinite" }}
              />{" "}
              Saving...
            </>
          ) : (
            <>
              <Save size={18} /> Save All Settings
            </>
          )}
        </button>
      </div>

      {/* ── Modals ─────────────────────────────────────────────────────────── */}
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
      <EmailVerificationModal
        show={showEmailModal}
        onClose={() => setShowEmailModal(false)}
        userId={userId}
        currentEmail={email}
        onSuccess={handleEmailChanged}
      />
    </>
  );
};

export default SettingsSection;
