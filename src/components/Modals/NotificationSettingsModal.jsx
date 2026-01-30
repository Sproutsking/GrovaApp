// ============================================================================
// src/components/Modals/NotificationSettingsModal.jsx - ENHANCED VERSION
// ============================================================================

import React, { useState, useEffect } from "react";
import { X, Bell, BellOff, Check } from "lucide-react";
import { supabase } from "../../services/config/supabase";
import { useToast } from "../../contexts/ToastContext";

const NotificationSettingsModal = ({ user, onClose, currentUser }) => {
  const [settings, setSettings] = useState({
    notify_posts: false,
    notify_stories: false,
    notify_reels: false,
    notify_comments: false,
    notify_likes: false,
    notify_shares: false,
  });
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const { showToast } = useToast();

  useEffect(() => {
    loadNotificationSettings();
  }, [user.id, currentUser?.id]);

  const loadNotificationSettings = async () => {
    if (!currentUser?.id) return;

    try {
      setLoading(true);

      // Get existing notification preferences
      const { data, error } = await supabase
        .from("notification_preferences")
        .select("*")
        .eq("user_id", currentUser.id)
        .eq("target_user_id", user.id)
        .maybeSingle();

      if (error && error.code !== "PGRST116") {
        console.error("Error loading preferences:", error);
      }

      if (data) {
        setSettings({
          notify_posts: data.notify_posts || false,
          notify_stories: data.notify_stories || false,
          notify_reels: data.notify_reels || false,
          notify_comments: data.notify_comments || false,
          notify_likes: data.notify_likes || false,
          notify_shares: data.notify_shares || false,
        });
      }
    } catch (error) {
      console.error("Failed to load notification settings:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = (key) => {
    setSettings((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const handleSave = async () => {
    if (!currentUser?.id) {
      showToast("error", "You must be logged in");
      return;
    }

    try {
      setSaving(true);

      // Upsert notification settings
      const { error } = await supabase.from("notification_preferences").upsert(
        {
          user_id: currentUser.id,
          target_user_id: user.id,
          ...settings,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: "user_id,target_user_id",
        },
      );

      if (error) throw error;

      showToast("success", "Notification settings saved!");
      setTimeout(() => onClose(), 1000);
    } catch (error) {
      console.error("Failed to save notification settings:", error);
      showToast("error", "Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  const notificationOptions = [
    {
      key: "notify_posts",
      label: "New Posts",
      desc: `Get notified when ${user.fullName || user.username} publishes a new post`,
    },
    {
      key: "notify_stories",
      label: "New Stories",
      desc: `Get notified when ${user.fullName || user.username} publishes a new story`,
    },
    {
      key: "notify_reels",
      label: "New Reels",
      desc: `Get notified when ${user.fullName || user.username} publishes a new reel`,
    },
    {
      key: "notify_comments",
      label: "Comments",
      desc: `Get notified when ${user.fullName || user.username} comments on your content`,
    },
    {
      key: "notify_likes",
      label: "Likes",
      desc: `Get notified when ${user.fullName || user.username} likes your content`,
    },
    {
      key: "notify_shares",
      label: "Shares",
      desc: `Get notified when ${user.fullName || user.username} shares content`,
    },
  ];

  if (loading) {
    return (
      <div className="notification-modal-overlay" onClick={onClose}>
        <div
          className="notification-modal"
          onClick={(e) => e.stopPropagation()}
        >
          <div style={{ padding: "60px 20px", textAlign: "center" }}>
            <div
              style={{
                width: "48px",
                height: "48px",
                border: "4px solid rgba(132, 204, 22, 0.2)",
                borderTop: "4px solid #84cc16",
                borderRadius: "50%",
                animation: "spin 0.8s linear infinite",
                margin: "0 auto 16px",
              }}
            ></div>
            <p style={{ color: "#737373", fontSize: "14px" }}>
              Loading settings...
            </p>
          </div>
        </div>
        <style jsx>{`
          @keyframes spin {
            to {
              transform: rotate(360deg);
            }
          }
          .notification-modal-overlay {
            position: fixed;
            inset: 0;
            background: rgba(0, 0, 0, 0.95);
            backdrop-filter: blur(20px);
            z-index: 10000;
            display: flex;
            align-items: center;
            justify-content: center;
          }
          .notification-modal {
            width: 90%;
            max-width: 480px;
            background: #000;
            border: 1px solid rgba(132, 204, 22, 0.3);
            border-radius: 20px;
          }
        `}</style>
      </div>
    );
  }

  return (
    <>
      <div className="notification-modal-overlay" onClick={onClose}>
        <div
          className="notification-modal"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="notification-modal-header">
            <div className="notification-header-icon">
              <Bell size={24} />
            </div>
            <div className="notification-header-content">
              <h3>Notification Settings</h3>
              <p>Manage notifications from {user.fullName || user.username}</p>
            </div>
            <button onClick={onClose} className="notification-close-btn">
              <X size={24} />
            </button>
          </div>

          <div className="notification-options">
            {notificationOptions.map((option) => (
              <div key={option.key} className="notification-option">
                <div className="notification-option-content">
                  <div className="notification-option-label">
                    {option.label}
                  </div>
                  <div className="notification-option-desc">{option.desc}</div>
                </div>
                <button
                  className={`notification-toggle ${settings[option.key] ? "active" : ""}`}
                  onClick={() => handleToggle(option.key)}
                >
                  <div className="notification-toggle-thumb">
                    {settings[option.key] && <Check size={14} />}
                  </div>
                </button>
              </div>
            ))}
          </div>

          <div className="notification-actions">
            <button onClick={onClose} className="notification-cancel-btn">
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="notification-save-btn"
              disabled={saving}
            >
              {saving ? "Saving..." : "Save Settings"}
            </button>
          </div>
        </div>
      </div>

      <style jsx>{`
        .notification-modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.95);
          backdrop-filter: blur(20px);
          z-index: 10000;
          display: flex;
          align-items: center;
          justify-content: center;
          animation: fadeIn 0.2s ease;
        }

        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }

        .notification-modal {
          width: 90%;
          max-width: 480px;
          background: #000;
          border: 1px solid rgba(132, 204, 22, 0.3);
          border-radius: 20px;
          overflow: hidden;
          animation: slideUp 0.3s ease;
        }

        @keyframes slideUp {
          from {
            transform: translateY(20px);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }

        .notification-modal-header {
          display: flex;
          align-items: flex-start;
          gap: 16px;
          padding: 24px;
          border-bottom: 1px solid rgba(132, 204, 22, 0.2);
          background: rgba(132, 204, 22, 0.05);
        }

        .notification-header-icon {
          width: 48px;
          height: 48px;
          border-radius: 12px;
          background: rgba(132, 204, 22, 0.2);
          display: flex;
          align-items: center;
          justify-content: center;
          color: #84cc16;
          flex-shrink: 0;
        }

        .notification-header-content {
          flex: 1;
        }

        .notification-header-content h3 {
          font-size: 18px;
          font-weight: 700;
          color: #fff;
          margin: 0 0 4px 0;
        }

        .notification-header-content p {
          font-size: 13px;
          color: #737373;
          margin: 0;
        }

        .notification-close-btn {
          background: none;
          border: none;
          color: #737373;
          cursor: pointer;
          padding: 4px;
          transition: all 0.2s;
          flex-shrink: 0;
        }

        .notification-close-btn:hover {
          color: #84cc16;
        }

        .notification-options {
          padding: 20px;
          display: flex;
          flex-direction: column;
          gap: 16px;
          max-height: 60vh;
          overflow-y: auto;
        }

        .notification-options::-webkit-scrollbar {
          width: 6px;
        }

        .notification-options::-webkit-scrollbar-track {
          background: rgba(255, 255, 255, 0.05);
        }

        .notification-options::-webkit-scrollbar-thumb {
          background: rgba(132, 204, 22, 0.3);
          border-radius: 3px;
        }

        .notification-option {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          padding: 16px;
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 12px;
          transition: all 0.2s;
        }

        .notification-option:hover {
          background: rgba(255, 255, 255, 0.04);
          border-color: rgba(132, 204, 22, 0.2);
        }

        .notification-option-content {
          flex: 1;
        }

        .notification-option-label {
          font-size: 15px;
          font-weight: 600;
          color: #fff;
          margin-bottom: 4px;
        }

        .notification-option-desc {
          font-size: 13px;
          color: #737373;
          line-height: 1.4;
        }

        .notification-toggle {
          width: 52px;
          height: 28px;
          border-radius: 14px;
          background: rgba(255, 255, 255, 0.1);
          border: 1px solid rgba(255, 255, 255, 0.2);
          cursor: pointer;
          position: relative;
          transition: all 0.3s;
          flex-shrink: 0;
        }

        .notification-toggle.active {
          background: linear-gradient(135deg, #84cc16 0%, #65a30d 100%);
          border-color: #84cc16;
        }

        .notification-toggle-thumb {
          width: 24px;
          height: 24px;
          border-radius: 50%;
          background: #fff;
          position: absolute;
          top: 1px;
          left: 1px;
          transition: all 0.3s;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #84cc16;
        }

        .notification-toggle.active .notification-toggle-thumb {
          left: 25px;
          color: #000;
        }

        .notification-actions {
          display: flex;
          gap: 12px;
          padding: 20px;
          border-top: 1px solid rgba(132, 204, 22, 0.1);
        }

        .notification-cancel-btn,
        .notification-save-btn {
          flex: 1;
          padding: 14px;
          border-radius: 12px;
          font-weight: 700;
          font-size: 15px;
          cursor: pointer;
          transition: all 0.2s;
          border: none;
        }

        .notification-cancel-btn {
          background: rgba(255, 255, 255, 0.05);
          color: #fff;
          border: 1px solid rgba(132, 204, 22, 0.2);
        }

        .notification-cancel-btn:hover {
          background: rgba(255, 255, 255, 0.08);
        }

        .notification-save-btn {
          background: linear-gradient(135deg, #84cc16 0%, #65a30d 100%);
          color: #000;
          box-shadow: 0 4px 16px rgba(132, 204, 22, 0.3);
        }

        .notification-save-btn:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 6px 20px rgba(132, 204, 22, 0.4);
        }

        .notification-save-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        @media (max-width: 768px) {
          .notification-modal {
            width: 100%;
            max-width: 100%;
            border-radius: 20px 20px 0 0;
            position: fixed;
            bottom: 0;
          }

          .notification-modal-header {
            padding: 20px 16px;
          }

          .notification-options {
            padding: 16px;
          }

          .notification-actions {
            padding: 16px;
          }
        }
      `}</style>
    </>
  );
};

export default NotificationSettingsModal;
