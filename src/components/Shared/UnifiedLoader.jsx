// src/components/Shared/UnifiedLoader.jsx - SINGLE LOADER FOR ALL STATES
import React, { useState, useEffect } from 'react';
import { Loader, WifiOff, RefreshCw, AlertCircle } from 'lucide-react';

/**
 * UNIFIED LOADER SYSTEM
 * Handles all loading states: online, offline, error
 * Use this ONE component across the entire platform
 */
const UnifiedLoader = ({ 
  message = 'Loading...', 
  type = 'default', // 'default' | 'app-init' | 'profile' | 'section' | 'inline'
  onRetry = null,
  error = null,
  showOfflineDetection = true 
}) => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [dots, setDots] = useState('');

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    const interval = setInterval(() => {
      setDots(prev => prev.length >= 3 ? '' : prev + '.');
    }, 500);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(interval);
    };
  }, []);

  // Sizes for different loader types
  const config = {
    'app-init': {
      spinner: '64px',
      fontSize: '18px',
      padding: '60px',
      showLogo: true,
      fullScreen: true
    },
    'profile': {
      spinner: '48px',
      fontSize: '16px',
      padding: '60px',
      showLogo: false,
      fullScreen: false
    },
    'section': {
      spinner: '48px',
      fontSize: '15px',
      padding: '60px',
      showLogo: false,
      fullScreen: false
    },
    'inline': {
      spinner: '18px',
      fontSize: '14px',
      padding: '0',
      showLogo: false,
      fullScreen: false
    },
    'default': {
      spinner: '48px',
      fontSize: '16px',
      padding: '40px',
      showLogo: false,
      fullScreen: false
    }
  };

  const current = config[type] || config.default;

  const LoaderContent = () => {
    // ERROR STATE
    if (error) {
      return (
        <div className="loader-error-state">
          <div className="error-icon-wrapper">
            <AlertCircle size={current.showLogo ? 48 : 32} />
          </div>
          <div className="error-title">Something went wrong</div>
          <div className="error-message">{error}</div>
          {onRetry && (
            <button className="retry-button" onClick={onRetry}>
              <RefreshCw size={18} />
              Try Again
            </button>
          )}
        </div>
      );
    }

    // OFFLINE STATE
    if (showOfflineDetection && !isOnline) {
      return (
        <div className="loader-offline-state">
          <div className="offline-icon-wrapper">
            <WifiOff size={current.showLogo ? 48 : 32} />
          </div>
          <div className="offline-title">You're offline</div>
          <div className="offline-message">
            Please check your internet connection and try again
          </div>
          {onRetry && (
            <button className="retry-button" onClick={onRetry}>
              <RefreshCw size={18} />
              Retry
            </button>
          )}
        </div>
      );
    }

    // LOADING STATE
    return (
      <>
        {current.showLogo && (
          <div className="loader-logo">GROVA</div>
        )}
        <div 
          className="loader-spinner"
          style={{
            width: current.spinner,
            height: current.spinner
          }}
        ></div>
        <div className="loader-message" style={{ fontSize: current.fontSize }}>
          {message}<span className="loader-dots">{dots}</span>
        </div>
      </>
    );
  };

  const containerClass = `unified-loader ${type} ${current.fullScreen ? 'fullscreen' : ''}`;

  return (
    <>
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }

        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .unified-loader {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 20px;
          animation: fadeIn 0.3s ease;
          padding: ${current.padding};
        }

        .unified-loader.fullscreen {
          position: fixed;
          inset: 0;
          background: linear-gradient(135deg, #000000 0%, #0a0a0a 100%);
          z-index: 9999;
        }

        .unified-loader.fullscreen::before {
          content: '';
          position: absolute;
          inset: 0;
          background: radial-gradient(circle at 50% 50%, rgba(132, 204, 22, 0.15) 0%, transparent 50%);
          animation: pulse 3s ease-in-out infinite;
        }

        .unified-loader > * {
          position: relative;
          z-index: 1;
        }

        .loader-logo {
          font-size: 72px;
          font-weight: 900;
          background: linear-gradient(135deg, #84cc16 0%, #65a30d 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          margin-bottom: 12px;
          animation: fadeIn 0.5s ease;
        }

        .loader-spinner {
          border: 4px solid rgba(132, 204, 22, 0.2);
          border-top-color: #84cc16;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }

        .loader-message {
          color: #84cc16;
          font-weight: 600;
          display: flex;
          align-items: center;
          gap: 4px;
          text-align: center;
        }

        .loader-dots {
          display: inline-block;
          width: 20px;
          text-align: left;
        }

        /* ERROR STATE */
        .loader-error-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 16px;
          max-width: 400px;
          text-align: center;
        }

        .error-icon-wrapper {
          width: 64px;
          height: 64px;
          border-radius: 50%;
          background: rgba(239, 68, 68, 0.2);
          display: flex;
          align-items: center;
          justify-content: center;
          color: #ef4444;
          animation: pulse 2s ease-in-out infinite;
        }

        .error-title {
          color: #ef4444;
          font-size: 18px;
          font-weight: 700;
        }

        .error-message {
          color: #a3a3a3;
          font-size: 14px;
          line-height: 1.5;
        }

        /* OFFLINE STATE */
        .loader-offline-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 16px;
          max-width: 400px;
          text-align: center;
          padding: 24px;
          background: rgba(239, 68, 68, 0.05);
          border: 1px solid rgba(239, 68, 68, 0.2);
          border-radius: 16px;
        }

        .offline-icon-wrapper {
          width: 64px;
          height: 64px;
          border-radius: 50%;
          background: rgba(239, 68, 68, 0.2);
          display: flex;
          align-items: center;
          justify-content: center;
          color: #ef4444;
          animation: pulse 2s ease-in-out infinite;
        }

        .offline-title {
          color: #ef4444;
          font-size: 18px;
          font-weight: 700;
        }

        .offline-message {
          color: #a3a3a3;
          font-size: 14px;
          line-height: 1.5;
        }

        /* RETRY BUTTON */
        .retry-button {
          padding: 12px 24px;
          background: linear-gradient(135deg, #84cc16 0%, #65a30d 100%);
          border: none;
          border-radius: 12px;
          color: #000;
          font-size: 15px;
          font-weight: 700;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 8px;
          transition: all 0.3s;
          box-shadow: 0 4px 12px rgba(132, 204, 22, 0.3);
        }

        .retry-button:hover {
          transform: translateY(-2px);
          box-shadow: 0 6px 16px rgba(132, 204, 22, 0.4);
        }

        .retry-button:active {
          transform: translateY(0);
        }

        /* INLINE LOADER */
        .unified-loader.inline {
          flex-direction: row;
          padding: 0;
          gap: 8px;
        }

        .unified-loader.inline .loader-spinner {
          border-width: 2px;
        }
      `}</style>

      <div className={containerClass}>
        <LoaderContent />
      </div>
    </>
  );
};

// Export specific loader variants for convenience
export const AppLoader = (props) => <UnifiedLoader type="app-init" message="Initializing grova protocol..." {...props} />;
export const ProfileLoader = (props) => <UnifiedLoader type="profile" message="Loading profile..." {...props} />;
export const SectionLoader = (props) => <UnifiedLoader type="section" {...props} />;
export const InlineLoader = (props) => <UnifiedLoader type="inline" {...props} />;

export default UnifiedLoader;