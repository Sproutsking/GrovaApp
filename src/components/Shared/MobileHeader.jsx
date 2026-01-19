import React from 'react';
import { Bell, HelpCircle } from 'lucide-react';

const MobileHeader = ({ getGreeting, onNotificationClick, onSupportClick }) => (
  <>
    <style>{`
      .mobile-header {
        position: sticky;
        top: 0;
        z-index: 100;
        background: rgba(10, 10, 10, 0.95);
        backdrop-filter: blur(20px);
        border-bottom: 1px solid rgba(132, 204, 22, 0.2);
      }

      .mobile-header-content {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 12px 16px;
      }

      .mobile-logo-section {
        display: flex;
        align-items: center;
        gap: 10px;
      }

      .mobile-logo-icon {
        width: 36px;
        height: 36px;
        border-radius: 10px;
        background: linear-gradient(135deg, #84cc16 0%, #65a30d 100%);
        display: flex;
        align-items: center;
        justify-content: center;
        color: #000;
        font-size: 20px;
        font-weight: 900;
        box-shadow: 0 4px 12px rgba(132, 204, 22, 0.4);
      }

      .mobile-greeting {
        flex: 1;
        text-align: center;
        padding: 0 8px;
      }

      .mobile-greeting-text {
        font-size: 14px;
        font-weight: 600;
        color: #a3a3a3;
      }

      .notification-support-component {
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .notification-btn,
      .support-btn {
        width: 40px;
        height: 40px;
        border-radius: 10px;
        background: rgba(255, 255, 255, 0.03);
        border: 1px solid rgba(255, 255, 255, 0.1);
        display: flex;
        align-items: center;
        justify-content: center;
        color: #a3a3a3;
        cursor: pointer;
        transition: all 0.2s;
        position: relative;
      }

      .notification-btn:active,
      .support-btn:active {
        transform: scale(0.95);
      }

      .notification-btn {
        color: #84cc16;
      }

      .support-btn {
        color: #3b82f6;
      }

      .notification-btn:hover {
        background: rgba(132, 204, 22, 0.1);
        border-color: rgba(132, 204, 22, 0.3);
      }

      .support-btn:hover {
        background: rgba(59, 130, 246, 0.1);
        border-color: rgba(59, 130, 246, 0.3);
      }

      .notification-badge {
        position: absolute;
        top: -4px;
        right: -4px;
        width: 18px;
        height: 18px;
        border-radius: 50%;
        background: #ef4444;
        color: #fff;
        font-size: 10px;
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

    <header className="mobile-header">
      <div className="mobile-header-content">
        <div className="mobile-logo-section">
          <div className="mobile-logo-icon">G</div>
        </div>
        <div className="mobile-greeting">
          <span className="mobile-greeting-text">{getGreeting()}</span>
        </div>
        <div className="notification-support-component">
          <button className="notification-btn" onClick={onNotificationClick}>
            <Bell size={20} />
            <span className="notification-badge">3</span>
          </button>
          <button className="support-btn" onClick={onSupportClick}>
            <HelpCircle size={20} />
          </button>
        </div>
      </div>
    </header>
  </>
);

export default MobileHeader;