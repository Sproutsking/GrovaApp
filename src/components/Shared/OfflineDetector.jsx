// src/components/Shared/OfflineDetector.jsx
import React, { useState, useEffect } from 'react';
import { WifiOff, Wifi } from 'lucide-react';

const OfflineDetector = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [wasOffline, setWasOffline] = useState(false);
  const [showBackOnline, setShowBackOnline] = useState(false);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      if (wasOffline) {
        setShowBackOnline(true);
        setTimeout(() => {
          setShowBackOnline(false);
          setWasOffline(false);
        }, 2000);
      }
    };

    const handleOffline = () => {
      setIsOnline(false);
      setWasOffline(true);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [wasOffline]);

  if (isOnline && !showBackOnline) return null;

  return (
    <>
      <style>{`
        @keyframes slideDown {
          from {
            transform: translateY(-100%);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }

        @keyframes slideUp {
          from {
            transform: translateY(0);
            opacity: 1;
          }
          to {
            transform: translateY(-100%);
            opacity: 0;
          }
        }

        @keyframes pulse {
          0%, 100% {
            opacity: 1;
          }
          50% {
            opacity: 0.5;
          }
        }

        .offline-banner {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          z-index: 10001;
          padding: 16px 20px;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 12px;
          font-size: 14px;
          font-weight: 600;
          animation: slideDown 0.3s ease;
        }

        .offline-banner.offline {
          background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
          color: #ffffff;
          box-shadow: 0 4px 20px rgba(239, 68, 68, 0.4);
        }

        .offline-banner.online {
          background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%);
          color: #ffffff;
          box-shadow: 0 4px 20px rgba(34, 197, 94, 0.4);
          animation: slideDown 0.3s ease, slideUp 0.3s ease 1.7s;
        }

        .offline-icon {
          animation: pulse 2s ease-in-out infinite;
        }

        .online-icon {
          animation: none;
        }
      `}</style>

      {!isOnline ? (
        <div className="offline-banner offline">
          <WifiOff size={20} className="offline-icon" />
          <span>You are offline. Check your connection.</span>
        </div>
      ) : showBackOnline ? (
        <div className="offline-banner online">
          <Wifi size={20} className="online-icon" />
          <span>Back online! ✨</span>
        </div>
      ) : null}
    </>
  );
};

export default OfflineDetector;