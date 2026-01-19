import React from 'react';
import { Clock, Bell, HelpCircle } from 'lucide-react';

const DesktopHeader = ({ currentUser, getGreeting, onNotificationClick, onSupportClick }) => (
  <>
    <style>{`
      .desktop-header {
        position: sticky;
        top: 0;
        z-index: 100;
        background: rgba(10, 10, 10, 0.95);
        backdrop-filter: blur(20px);
        border-bottom: 1px solid rgba(132, 204, 22, 0.2);
      }

      .desktop-header-content {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 16px 32px;
        max-width: 1400px;
        margin: 0 auto;
      }

      .logo-section {
        display: flex;
        align-items: center;
        gap: 12px;
      }

      .logo-icon {
        width: 44px;
        height: 44px;
        border-radius: 12px;
        background: linear-gradient(135deg, #84cc16 0%, #65a30d 100%);
        display: flex;
        align-items: center;
        justify-content: center;
        color: #000;
        font-size: 24px;
        font-weight: 900;
        box-shadow: 0 4px 16px rgba(132, 204, 22, 0.5);
      }

      .logo-text {
        display: flex;
        flex-direction: column;
      }

      .logo-title {
        font-size: 20px;
        font-weight: 900;
        color: #84cc16;
        margin: 0;
        letter-spacing: 1px;
      }

      .logo-tagline {
        font-size: 11px;
        color: #737373;
        margin: 0;
        font-weight: 500;
      }

      .header-right {
        display: flex;
        align-items: center;
        gap: 16px;
      }

      .greeting-text {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 10px 16px;
        background: rgba(255, 255, 255, 0.03);
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 10px;
        font-size: 14px;
        font-weight: 600;
        color: #a3a3a3;
      }

      .header-btn {
        position: relative;
        padding: 10px 16px;
        background: rgba(255, 255, 255, 0.03);
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 10px;
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 14px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s;
      }

      .notification-btn-header {
        color: #84cc16;
      }

      .notification-btn-header:hover {
        background: rgba(132, 204, 22, 0.1);
        border-color: rgba(132, 204, 22, 0.3);
      }

      .support-btn-header {
        color: #3b82f6;
      }

      .support-btn-header:hover {
        background: rgba(59, 130, 246, 0.1);
        border-color: rgba(59, 130, 246, 0.3);
      }

      .header-notification-badge {
        position: absolute;
        top: -6px;
        right: -6px;
        min-width: 20px;
        height: 20px;
        padding: 0 6px;
        border-radius: 10px;
        background: #ef4444;
        color: #fff;
        font-size: 11px;
        font-weight: 700;
        display: flex;
        align-items: center;
        justify-content: center;
        border: 2px solid #0a0a0a;
        animation: pulse 2s infinite;
      }

      @keyframes pulse {
        0%, 100% {
          transform: scale(1);
          opacity: 1;
        }
        50% {
          transform: scale(1.1);
          opacity: 0.8;
        }
      }
    `}</style>

    <header className="desktop-header">
      <div className="desktop-header-content">
        <div className="logo-section">
          <div className="logo-icon">G</div>
          <div className="logo-text">
            <h1 className="logo-title">GROVA</h1>
            <p className="logo-tagline">Every Word Seeds Value</p>
          </div>
        </div>
        <div className="header-right">
          <div className="greeting-text">
            <Clock size={14} />
            {getGreeting()}, {currentUser?.name || 'User'}
          </div>
          <button onClick={onNotificationClick} className="header-btn notification-btn-header">
            <Bell size={18} />
            <span>Notifications</span>
            <span className="header-notification-badge">3</span>
          </button>
          <button onClick={onSupportClick} className="header-btn support-btn-header">
            <HelpCircle size={18} />
            <span>Support</span>
          </button>
        </div>
      </div>
    </header>
  </>
);

export default DesktopHeader;