// src/components/Shared/UnifiedLoader.jsx - SINGLE LOADER FOR ALL STATES
import React, { useState, useEffect } from 'react';
import { WifiOff, RefreshCw, AlertCircle } from 'lucide-react';

const BrandSplash = () => {
  return (
    <div className="xv-boot" role="status" aria-label="Loading Xeevia">
      <div className="xv-boot-stage" aria-hidden="true">
        <span className="xv-boot-orbit" />
        <img src="/logo192.png" alt="" fetchPriority="high" />
      </div>
      <div className="xv-boot-word">XEEVI<span>A</span></div>
      <p className="xv-boot-caption">Your world, in motion</p>
    </div>
  );
};

const BoxedDotsLoader = ({ compact = false }) => (
  <div className={`boxed-dots-loader${compact ? " boxed-dots-loader-compact" : ""}`} aria-hidden="true">
    <span />
    <span />
    <span />
  </div>
);

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
  const [isOnline, setIsOnline] = useState(() => typeof navigator === "undefined" || navigator.onLine);
  const [dots, setDots] = useState('');

  useEffect(() => {
    if (type === "app-init" && !showOfflineDetection) return undefined;

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    const interval = type === "app-init" ? null : setInterval(() => {
      setDots(prev => prev.length >= 3 ? '' : prev + '.');
    }, 500);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      if (interval) clearInterval(interval);
    };
  }, [type, showOfflineDetection]);

  // Sizes for different loader types
  const config = {
    'app-init': {
      padding: '0',
      showLogo: true,
      fullScreen: true
    },
    'profile': {
      fontSize: "calc((16px) + 1px)",
      padding: '60px',
      showLogo: false,
      fullScreen: false
    },
    'section': {
      fontSize: "calc((15px) + 1px)",
      padding: '60px',
      showLogo: false,
      fullScreen: false
    },
    'inline': {
      fontSize: "calc((14px) + 1px)",
      padding: '0',
      showLogo: false,
      fullScreen: false
    },
    'default': {
      fontSize: "calc((16px) + 1px)",
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
    if (current.showLogo) {
      return (
        <>
          <BrandSplash />
        </>
      );
    }

    return (
      <>
        <BoxedDotsLoader compact={type === "inline"} />
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
          padding: ${current.padding};
          background: var(--bg);
          color: var(--text);
        }

        .unified-loader:not(.app-init) {
          animation: fadeIn 0.3s ease;
        }

        .unified-loader.fullscreen {
          position: fixed;
          inset: 0;
          background: #050505;
          z-index: 9999;
        }

        .unified-loader.fullscreen::before {
          content: none;
        }

        .unified-loader > * {
          position: relative;
          z-index: 1;
        }

        .xv-boot {
          width: 100%;
          min-height: 100%;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 0;
          background: #050605;
          color: #f7faef;
          contain: layout paint;
          animation: xvBootArrive .5s cubic-bezier(.2,.7,.25,1) both;
        }
        .xv-boot-stage {
          position: relative;
          display: grid;
          width: 104px;
          height: 104px;
          margin-bottom: 26px;
          place-items: center;
          isolation: isolate;
        }
        .xv-boot-stage::before {
          position: absolute;
          inset: 0;
          border: 1px solid rgba(163,230,53,.17);
          border-top-color: #b7ed68;
          border-right-color: rgba(163,230,53,.52);
          border-radius: 50%;
          content: "";
          animation: xvBootOrbit 2.4s linear infinite;
          will-change: transform;
        }
        .xv-boot-stage::after {
          position: absolute;
          inset: 9px;
          border: 1px solid rgba(255,255,255,.055);
          border-radius: 50%;
          background: radial-gradient(circle, rgba(132,204,22,.1), transparent 70%);
          content: "";
        }
        .xv-boot-orbit {
          position: absolute;
          z-index: 1;
          top: 50%;
          left: 50%;
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: #d9f99d;
          box-shadow: 0 0 10px rgba(190,242,100,.55);
          transform: translate(-50%,-50%) rotate(0deg) translateX(48px);
          animation: xvBootDotOrbit 2.4s linear infinite;
          will-change: transform;
        }
        .xv-boot-stage img {
          position: relative;
          z-index: 1;
          width: 58px;
          height: 58px;
          object-fit: contain;
          animation: xvBootBreath 2.8s ease-in-out infinite;
          will-change: transform;
        }
        .xv-boot-word {
          color: #f7faef;
          font-size: 19px;
          font-weight: 750;
          letter-spacing: .24em;
          line-height: 1;
          text-indent: .24em;
        }
        .xv-boot-word span { color: #d4af37; }
        .xv-boot-caption {
          margin: 11px 0 0;
          color: rgba(228,236,218,.48);
          font-size: 11px;
          font-weight: 500;
          letter-spacing: .075em;
        }
        @keyframes xvBootArrive {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes xvBootOrbit { to { transform: rotate(360deg); } }
        @keyframes xvBootDotOrbit {
          from { transform: translate(-50%,-50%) rotate(0deg) translateX(48px); }
          to { transform: translate(-50%,-50%) rotate(360deg) translateX(48px); }
        }
        @keyframes xvBootBreath {
          0%, 100% { transform: scale(.96); }
          50% { transform: scale(1); }
        }
        @media (prefers-reduced-motion: reduce) {
          .xv-boot, .xv-boot-stage::before, .xv-boot-orbit, .xv-boot-stage img { animation: none; }
        }
        .boxed-dots-loader{display:flex;align-items:center;justify-content:center;gap:5px;height:24px;}
        .boxed-dots-loader span{width:9px;height:9px;border-radius:2px;background:var(--accent,#c6ff00);opacity:.4;animation:boxedDot 1s ease-in-out infinite;}
        .boxed-dots-loader span:nth-child(2){animation-delay:.14s;}
        .boxed-dots-loader span:nth-child(3){animation-delay:.28s;}
        .boxed-dots-loader-compact{height:16px;gap:3px;}
        .boxed-dots-loader-compact span{width:5px;height:5px;}
        @keyframes boxedDot{0%,80%,100%{transform:translateY(0);opacity:.35}40%{transform:translateY(-5px);opacity:1}}
        @media(prefers-reduced-motion:reduce){.boxed-dots-loader span{animation:none}}

        .loader-logo {
          font-size: calc((72px) + 1px);
          font-weight: 900;
          letter-spacing: 0.05em;
          background: var(--accent-gradient);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          margin-bottom: 12px;
          animation: fadeIn 0.5s ease;
          text-transform: uppercase;
        }

        .loader-spinner {
          border: 4px solid rgba(132, 204, 22, 0.18);
          border-top-color: var(--accent);
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }

        .loader-message {
          color: var(--accent);
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
          font-size: calc((18px) + 1px);
          font-weight: 700;
        }

        .error-message {
          color: #a3a3a3;
          font-size: calc((14px) + 1px);
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
          font-size: calc((18px) + 1px);
          font-weight: 700;
        }

        .offline-message {
          color: #a3a3a3;
          font-size: calc((14px) + 1px);
          line-height: 1.5;
        }

        /* RETRY BUTTON */
        .retry-button {
          padding: 12px 24px;
          background: linear-gradient(135deg, #84cc16 0%, #65a30d 100%);
          border: none;
          border-radius: 12px;
          color: #000;
          font-size: calc((15px) + 1px);
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

      <div className={containerClass} role="status" aria-label={message}>
        <LoaderContent />
      </div>
    </>
  );
};

// Export specific loader variants for convenience
export const AppLoader = (props) => <UnifiedLoader type="app-init" {...props} />;
export const ProfileLoader = (props) => <UnifiedLoader type="profile" message="Loading profile..." {...props} />;
export const SectionLoader = (props) => <UnifiedLoader type="section" {...props} />;
export const InlineLoader = (props) => <UnifiedLoader type="inline" {...props} />;

export default UnifiedLoader;