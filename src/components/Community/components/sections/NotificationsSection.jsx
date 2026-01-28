import React, { useState } from 'react';
import {
  ChevronLeft, Bell, BellOff, Volume2, VolumeX, Smartphone,
  Mail, MessageSquare, Users, Crown, Pin, Zap, Check, X,
  Settings, Moon, Sun, Clock, Filter
} from 'lucide-react';

const NotificationsSection = ({ 
  community,
  onBack,
  onUpdateNotifications
}) => {
  const [notifSettings, setNotifSettings] = useState({
    allMessages: true,
    mentions: true,
    replies: true,
    reactions: false,
    newMembers: true,
    roleUpdates: true,
    communityUpdates: true,
    announcements: true,
    // Delivery methods
    push: true,
    email: false,
    sms: false,
    // Advanced
    muteUntil: null,
    quietHours: { enabled: false, start: '22:00', end: '08:00' },
    soundEnabled: true,
    vibrationEnabled: true,
    priorityOnly: false
  });

  const [activeTab, setActiveTab] = useState('events');

  const handleToggle = (key) => {
    setNotifSettings(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const handleQuietHours = (enabled) => {
    setNotifSettings(prev => ({
      ...prev,
      quietHours: { ...prev.quietHours, enabled }
    }));
  };

  const handleSave = async () => {
    try {
      await onUpdateNotifications(notifSettings);
      alert('Notification settings saved!');
    } catch (error) {
      console.error('Failed to save settings:', error);
      alert('Failed to save notification settings');
    }
  };

  const muteDurations = [
    { label: '15 minutes', value: 15 },
    { label: '1 hour', value: 60 },
    { label: '8 hours', value: 480 },
    { label: '24 hours', value: 1440 },
    { label: 'Until I turn it back on', value: -1 }
  ];

  return (
    <>
      <div className="back-button" onClick={onBack}>
        <ChevronLeft size={16} />
        Back to Menu
      </div>

      <div className="notifications-header">
        <div className="notifications-title">
          <Bell size={20} />
          <span>Notification Settings</span>
        </div>
        {notifSettings.muteUntil && (
          <div className="muted-badge">
            <BellOff size={14} />
            Muted
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="notif-tabs">
        <button
          className={`notif-tab ${activeTab === 'events' ? 'active' : ''}`}
          onClick={() => setActiveTab('events')}
        >
          <MessageSquare size={14} />
          Events
        </button>
        <button
          className={`notif-tab ${activeTab === 'delivery' ? 'active' : ''}`}
          onClick={() => setActiveTab('delivery')}
        >
          <Smartphone size={14} />
          Delivery
        </button>
        <button
          className={`notif-tab ${activeTab === 'advanced' ? 'active' : ''}`}
          onClick={() => setActiveTab('advanced')}
        >
          <Settings size={14} />
          Advanced
        </button>
      </div>

      <div className="notif-content">
        {/* EVENTS TAB */}
        {activeTab === 'events' && (
          <div className="tab-panel">
            <div className="notif-section">
              <div className="section-subtitle">
                <MessageSquare size={16} />
                Message Notifications
              </div>
              
              <div className="notif-group">
                <div className="notif-item">
                  <div className="notif-info">
                    <div className="notif-icon" style={{ background: 'linear-gradient(135deg, #9cff00 0%, #667eea 100%)' }}>
                      <MessageSquare size={16} />
                    </div>
                    <div>
                      <div className="notif-label">All Messages</div>
                      <div className="notif-desc">Get notified for every new message</div>
                    </div>
                  </div>
                  <div 
                    className={`toggle ${notifSettings.allMessages ? 'active' : ''}`}
                    onClick={() => handleToggle('allMessages')}
                  >
                    <div className="toggle-slider" />
                  </div>
                </div>

                <div className="notif-item">
                  <div className="notif-info">
                    <div className="notif-icon" style={{ background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)' }}>
                      <Zap size={16} />
                    </div>
                    <div>
                      <div className="notif-label">Mentions</div>
                      <div className="notif-desc">When someone mentions you</div>
                    </div>
                  </div>
                  <div 
                    className={`toggle ${notifSettings.mentions ? 'active' : ''}`}
                    onClick={() => handleToggle('mentions')}
                  >
                    <div className="toggle-slider" />
                  </div>
                </div>

                <div className="notif-item">
                  <div className="notif-info">
                    <div className="notif-icon" style={{ background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)' }}>
                      <MessageSquare size={16} />
                    </div>
                    <div>
                      <div className="notif-label">Replies</div>
                      <div className="notif-desc">When someone replies to your message</div>
                    </div>
                  </div>
                  <div 
                    className={`toggle ${notifSettings.replies ? 'active' : ''}`}
                    onClick={() => handleToggle('replies')}
                  >
                    <div className="toggle-slider" />
                  </div>
                </div>

                <div className="notif-item">
                  <div className="notif-info">
                    <div className="notif-icon" style={{ background: 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)' }}>
                      <Zap size={16} />
                    </div>
                    <div>
                      <div className="notif-label">Reactions</div>
                      <div className="notif-desc">When someone reacts to your message</div>
                    </div>
                  </div>
                  <div 
                    className={`toggle ${notifSettings.reactions ? 'active' : ''}`}
                    onClick={() => handleToggle('reactions')}
                  >
                    <div className="toggle-slider" />
                  </div>
                </div>
              </div>
            </div>

            <div className="notif-section">
              <div className="section-subtitle">
                <Users size={16} />
                Community Activity
              </div>
              
              <div className="notif-group">
                <div className="notif-item">
                  <div className="notif-info">
                    <div className="notif-icon" style={{ background: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)' }}>
                      <Users size={16} />
                    </div>
                    <div>
                      <div className="notif-label">New Members</div>
                      <div className="notif-desc">When someone joins the community</div>
                    </div>
                  </div>
                  <div 
                    className={`toggle ${notifSettings.newMembers ? 'active' : ''}`}
                    onClick={() => handleToggle('newMembers')}
                  >
                    <div className="toggle-slider" />
                  </div>
                </div>

                <div className="notif-item">
                  <div className="notif-info">
                    <div className="notif-icon" style={{ background: 'linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)' }}>
                      <Crown size={16} />
                    </div>
                    <div>
                      <div className="notif-label">Role Updates</div>
                      <div className="notif-desc">Changes to roles and permissions</div>
                    </div>
                  </div>
                  <div 
                    className={`toggle ${notifSettings.roleUpdates ? 'active' : ''}`}
                    onClick={() => handleToggle('roleUpdates')}
                  >
                    <div className="toggle-slider" />
                  </div>
                </div>

                <div className="notif-item">
                  <div className="notif-info">
                    <div className="notif-icon" style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}>
                      <Settings size={16} />
                    </div>
                    <div>
                      <div className="notif-label">Community Updates</div>
                      <div className="notif-desc">Important community changes</div>
                    </div>
                  </div>
                  <div 
                    className={`toggle ${notifSettings.communityUpdates ? 'active' : ''}`}
                    onClick={() => handleToggle('communityUpdates')}
                  >
                    <div className="toggle-slider" />
                  </div>
                </div>

                <div className="notif-item highlighted">
                  <div className="notif-info">
                    <div className="notif-icon" style={{ background: 'linear-gradient(135deg, #9cff00 0%, #667eea 100%)' }}>
                      <Pin size={16} />
                    </div>
                    <div>
                      <div className="notif-label">Announcements</div>
                      <div className="notif-desc">Official community announcements</div>
                    </div>
                  </div>
                  <div 
                    className={`toggle ${notifSettings.announcements ? 'active' : ''}`}
                    onClick={() => handleToggle('announcements')}
                  >
                    <div className="toggle-slider" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* DELIVERY TAB */}
        {activeTab === 'delivery' && (
          <div className="tab-panel">
            <div className="notif-section">
              <div className="section-subtitle">
                <Smartphone size={16} />
                Delivery Methods
              </div>
              
              <div className="delivery-grid">
                <div 
                  className={`delivery-card ${notifSettings.push ? 'active' : ''}`}
                  onClick={() => handleToggle('push')}
                >
                  <div className="delivery-icon">
                    <Bell size={24} />
                  </div>
                  <div className="delivery-label">Push Notifications</div>
                  <div className="delivery-status">
                    {notifSettings.push ? <Check size={16} color="#10b981" /> : <X size={16} color="#666" />}
                  </div>
                </div>

                <div 
                  className={`delivery-card ${notifSettings.email ? 'active' : ''}`}
                  onClick={() => handleToggle('email')}
                >
                  <div className="delivery-icon">
                    <Mail size={24} />
                  </div>
                  <div className="delivery-label">Email</div>
                  <div className="delivery-status">
                    {notifSettings.email ? <Check size={16} color="#10b981" /> : <X size={16} color="#666" />}
                  </div>
                </div>

                <div 
                  className={`delivery-card ${notifSettings.sms ? 'active' : ''}`}
                  onClick={() => handleToggle('sms')}
                >
                  <div className="delivery-icon">
                    <MessageSquare size={24} />
                  </div>
                  <div className="delivery-label">SMS</div>
                  <div className="delivery-status">
                    {notifSettings.sms ? <Check size={16} color="#10b981" /> : <X size={16} color="#666" />}
                  </div>
                </div>
              </div>
            </div>

            <div className="notif-section">
              <div className="section-subtitle">
                <Clock size={16} />
                Mute Community
              </div>
              
              <div className="mute-options">
                {muteDurations.map((duration) => (
                  <button
                    key={duration.value}
                    className="mute-btn"
                    onClick={() => {
                      const muteUntil = duration.value === -1 ? 
                        'indefinite' : 
                        new Date(Date.now() + duration.value * 60000).toISOString();
                      setNotifSettings(prev => ({ ...prev, muteUntil }));
                    }}
                  >
                    <BellOff size={14} />
                    {duration.label}
                  </button>
                ))}
              </div>

              {notifSettings.muteUntil && (
                <div className="mute-status">
                  <div className="mute-info">
                    <BellOff size={16} color="#ff6b6b" />
                    <span>Notifications are muted</span>
                  </div>
                  <button 
                    className="unmute-btn"
                    onClick={() => setNotifSettings(prev => ({ ...prev, muteUntil: null }))}
                  >
                    Unmute
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ADVANCED TAB */}
        {activeTab === 'advanced' && (
          <div className="tab-panel">
            <div className="notif-section">
              <div className="section-subtitle">
                <Moon size={16} />
                Quiet Hours
              </div>
              
              <div className="quiet-hours-card">
                <div className="quiet-hours-header">
                  <div className="quiet-hours-info">
                    <Moon size={20} color="#9cff00" />
                    <div>
                      <div className="quiet-title">Enable Quiet Hours</div>
                      <div className="quiet-desc">Silence notifications during specific times</div>
                    </div>
                  </div>
                  <div 
                    className={`toggle ${notifSettings.quietHours.enabled ? 'active' : ''}`}
                    onClick={() => handleQuietHours(!notifSettings.quietHours.enabled)}
                  >
                    <div className="toggle-slider" />
                  </div>
                </div>

                {notifSettings.quietHours.enabled && (
                  <div className="time-selector">
                    <div className="time-input-group">
                      <label>Start Time</label>
                      <input 
                        type="time" 
                        value={notifSettings.quietHours.start}
                        onChange={(e) => setNotifSettings(prev => ({
                          ...prev,
                          quietHours: { ...prev.quietHours, start: e.target.value }
                        }))}
                        className="time-input"
                      />
                    </div>
                    <div className="time-separator">→</div>
                    <div className="time-input-group">
                      <label>End Time</label>
                      <input 
                        type="time" 
                        value={notifSettings.quietHours.end}
                        onChange={(e) => setNotifSettings(prev => ({
                          ...prev,
                          quietHours: { ...prev.quietHours, end: e.target.value }
                        }))}
                        className="time-input"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="notif-section">
              <div className="section-subtitle">
                <Volume2 size={16} />
                Sound & Vibration
              </div>
              
              <div className="notif-group">
                <div className="notif-item">
                  <div className="notif-info">
                    <div className="notif-icon" style={{ background: 'linear-gradient(135deg, #9cff00 0%, #667eea 100%)' }}>
                      {notifSettings.soundEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
                    </div>
                    <div>
                      <div className="notif-label">Notification Sound</div>
                      <div className="notif-desc">Play sound for notifications</div>
                    </div>
                  </div>
                  <div 
                    className={`toggle ${notifSettings.soundEnabled ? 'active' : ''}`}
                    onClick={() => handleToggle('soundEnabled')}
                  >
                    <div className="toggle-slider" />
                  </div>
                </div>

                <div className="notif-item">
                  <div className="notif-info">
                    <div className="notif-icon" style={{ background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)' }}>
                      <Smartphone size={16} />
                    </div>
                    <div>
                      <div className="notif-label">Vibration</div>
                      <div className="notif-desc">Vibrate on new notifications</div>
                    </div>
                  </div>
                  <div 
                    className={`toggle ${notifSettings.vibrationEnabled ? 'active' : ''}`}
                    onClick={() => handleToggle('vibrationEnabled')}
                  >
                    <div className="toggle-slider" />
                  </div>
                </div>
              </div>
            </div>

            <div className="notif-section">
              <div className="section-subtitle">
                <Filter size={16} />
                Priority Mode
              </div>
              
              <div className="priority-card">
                <div className="priority-header">
                  <Zap size={20} color="#9cff00" />
                  <div>
                    <div className="priority-title">Priority Notifications Only</div>
                    <div className="priority-desc">Only receive notifications from mentions, announcements, and direct messages</div>
                  </div>
                </div>
                <div 
                  className={`toggle ${notifSettings.priorityOnly ? 'active' : ''}`}
                  onClick={() => handleToggle('priorityOnly')}
                >
                  <div className="toggle-slider" />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <button className="save-settings-btn" onClick={handleSave}>
        <Check size={16} />
        Save Notification Settings
      </button>

      <style>{`
        .back-button {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 12px;
          cursor: pointer;
          color: #9cff00;
          font-weight: 600;
          font-size: 13px;
          transition: all 0.2s;
          margin-bottom: 16px;
        }

        .back-button:hover {
          transform: translateX(-4px);
          color: #84cc16;
        }

        .notifications-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 0 12px;
          margin-bottom: 20px;
        }

        .notifications-title {
          display: flex;
          align-items: center;
          gap: 12px;
          font-size: 18px;
          font-weight: 700;
          color: #fff;
        }

        .muted-badge {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 6px 12px;
          background: rgba(255, 107, 107, 0.15);
          border: 1px solid rgba(255, 107, 107, 0.3);
          border-radius: 8px;
          font-size: 12px;
          font-weight: 600;
          color: #ff6b6b;
        }

        .notif-tabs {
          display: flex;
          gap: 8px;
          padding: 0 12px;
          margin-bottom: 24px;
        }

        .notif-tab {
          flex: 1;
          padding: 12px 16px;
          background: rgba(26, 26, 26, 0.4);
          border: 2px solid rgba(42, 42, 42, 0.6);
          border-radius: 10px;
          color: #999;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          font-size: 13px;
        }

        .notif-tab:hover {
          background: rgba(26, 26, 26, 0.7);
          border-color: rgba(156, 255, 0, 0.2);
          color: #d4d4d4;
        }

        .notif-tab.active {
          background: linear-gradient(135deg, rgba(156, 255, 0, 0.15) 0%, rgba(102, 126, 234, 0.15) 100%);
          border-color: rgba(156, 255, 0, 0.4);
          color: #9cff00;
          box-shadow: 0 4px 12px rgba(156, 255, 0, 0.15);
        }

        .notif-content {
          padding: 0 12px;
          margin-bottom: 20px;
        }

        .tab-panel {
          animation: fadeIn 0.3s ease;
        }

        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .notif-section {
          margin-bottom: 24px;
        }

        .section-subtitle {
          display: flex;
          align-items: center;
          gap: 10px;
          font-size: 13px;
          font-weight: 700;
          color: #9cff00;
          margin-bottom: 12px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .notif-group {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .notif-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 16px;
          background: rgba(26, 26, 26, 0.4);
          border: 2px solid rgba(42, 42, 42, 0.6);
          border-radius: 12px;
          transition: all 0.2s;
        }

        .notif-item:hover {
          background: rgba(26, 26, 26, 0.7);
          border-color: rgba(156, 255, 0, 0.2);
        }

        .notif-item.highlighted {
          border-color: rgba(156, 255, 0, 0.3);
          background: rgba(156, 255, 0, 0.05);
        }

        .notif-info {
          display: flex;
          align-items: center;
          gap: 12px;
          flex: 1;
        }

        .notif-icon {
          width: 40px;
          height: 40px;
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #fff;
          flex-shrink: 0;
        }

        .notif-label {
          font-size: 14px;
          font-weight: 600;
          color: #fff;
          margin-bottom: 2px;
        }

        .notif-desc {
          font-size: 12px;
          color: #999;
        }

        .toggle {
          width: 52px;
          height: 28px;
          background: rgba(42, 42, 42, 0.8);
          border-radius: 14px;
          position: relative;
          cursor: pointer;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          border: 2px solid rgba(42, 42, 42, 0.8);
          flex-shrink: 0;
        }

        .toggle:hover {
          border-color: rgba(156, 255, 0, 0.3);
        }

        .toggle.active {
          background: linear-gradient(135deg, #9cff00 0%, #667eea 100%);
          border-color: #9cff00;
          box-shadow: 0 0 16px rgba(156, 255, 0, 0.4);
        }

        .toggle-slider {
          width: 20px;
          height: 20px;
          background: #fff;
          border-radius: 50%;
          position: absolute;
          top: 2px;
          left: 2px;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
        }

        .toggle.active .toggle-slider {
          left: 26px;
          background: #000;
        }

        .delivery-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 12px;
        }

        .delivery-card {
          padding: 20px;
          background: rgba(26, 26, 26, 0.4);
          border: 2px solid rgba(42, 42, 42, 0.6);
          border-radius: 12px;
          cursor: pointer;
          transition: all 0.3s;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 12px;
          text-align: center;
        }

        .delivery-card:hover {
          background: rgba(26, 26, 26, 0.7);
          border-color: rgba(156, 255, 0, 0.3);
          transform: translateY(-4px);
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3);
        }

        .delivery-card.active {
          background: linear-gradient(135deg, rgba(156, 255, 0, 0.1) 0%, rgba(102, 126, 234, 0.1) 100%);
          border-color: rgba(156, 255, 0, 0.4);
        }

        .delivery-icon {
          color: #9cff00;
        }

        .delivery-label {
          font-size: 13px;
          font-weight: 600;
          color: #fff;
        }

        .delivery-status {
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .mute-options {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .mute-btn {
          padding: 14px 16px;
          background: rgba(26, 26, 26, 0.4);
          border: 2px solid rgba(42, 42, 42, 0.6);
          border-radius: 10px;
          color: #fff;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
          display: flex;
          align-items: center;
          gap: 10px;
          font-size: 13px;
        }

        .mute-btn:hover {
          background: rgba(26, 26, 26, 0.7);
          border-color: rgba(156, 255, 0, 0.3);
          transform: translateX(4px);
        }

        .mute-status {
          margin-top: 16px;
          padding: 16px;
          background: rgba(255, 107, 107, 0.1);
          border: 2px solid rgba(255, 107, 107, 0.3);
          border-radius: 10px;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .mute-info {
          display: flex;
          align-items: center;
          gap: 10px;
          font-size: 13px;
          font-weight: 600;
          color: #ff6b6b;
        }

        .unmute-btn {
          padding: 8px 16px;
          background: #ff6b6b;
          border: none;
          border-radius: 8px;
          color: #fff;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.2s;
          font-size: 12px;
        }

        .unmute-btn:hover {
          background: #ff5252;
        }

        .quiet-hours-card,
        .priority-card {
          padding: 20px;
          background: rgba(26, 26, 26, 0.4);
          border: 2px solid rgba(42, 42, 42, 0.6);
          border-radius: 12px;
        }

        .quiet-hours-header,
        .priority-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 16px;
        }

        .quiet-hours-info {
          display: flex;
          align-items: center;
          gap: 12px;
          flex: 1;
        }

        .quiet-title,
        .priority-title {
          font-size: 14px;
          font-weight: 600;
          color: #fff;
          margin-bottom: 4px;
        }

        .quiet-desc,
        .priority-desc {
          font-size: 12px;
          color: #999;
        }

        .time-selector {
          display: flex;
          align-items: center;
          gap: 16px;
          padding: 16px;
          background: rgba(26, 26, 26, 0.6);
          border-radius: 10px;
          border: 2px solid rgba(42, 42, 42, 0.6);
        }

        .time-input-group {
          flex: 1;
        }

        .time-input-group label {
          display: block;
          font-size: 11px;
          font-weight: 700;
          color: #9cff00;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          margin-bottom: 8px;
        }

        .time-input {
          width: 100%;
          padding: 10px 12px;
          background: rgba(26, 26, 26, 0.8);
          border: 2px solid rgba(42, 42, 42, 0.8);
          border-radius: 8px;
          color: #fff;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
        }

        .time-input:focus {
          outline: none;
          border-color: rgba(156, 255, 0, 0.6);
        }

        .time-separator {
          font-size: 20px;
          color: #9cff00;
          font-weight: 700;
          margin-top: 20px;
        }

        .save-settings-btn {
          width: calc(100% - 24px);
          margin: 0 12px 12px 12px;
          padding: 14px;
          background: linear-gradient(135deg, #9cff00 0%, #667eea 100%);
          border: none;
          border-radius: 10px;
          color: #000;
          font-weight: 700;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          transition: all 0.3s;
          font-size: 14px;
        }

        .save-settings-btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 24px rgba(156, 255, 0, 0.4);
        }
      `}</style>
    </>
  );
};

export default NotificationsSection;