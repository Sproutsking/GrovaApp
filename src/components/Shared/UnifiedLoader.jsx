// src/components/Shared/UnifiedLoader.jsx - SINGLE LOADER FOR ALL STATES
import React, { useState, useEffect, useId } from 'react';
import { WifiOff, RefreshCw, AlertCircle } from 'lucide-react';
import Logo from "./Assets/Logo.png";

const LiquidOrbitLoader = ({ scale = 1.5 }) => {
  const instanceId = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const filterId = `liquid-goo-${instanceId}`;

  return (
    <div className="liquid-loader" style={{ "--liquid-k": scale }}>
      <svg className="liquid-defs" width="0" height="0" aria-hidden="true" focusable="false">
        <defs>
          <filter id={filterId} x="-30%" y="-30%" width="160%" height="160%" colorInterpolationFilters="sRGB">
            <feGaussianBlur in="SourceGraphic" stdDeviation={8 * scale} />
            <feColorMatrix values="1 0 0 0 0 0 1 0 0 0 0 0 1 0 0 0 0 0 22 -9" />
          </filter>
        </defs>
      </svg>
      <div className="liquid-wrap">
        <div className="liquid-stage">
          <div className="liquid-goo" style={{ filter: `url(#${filterId})` }}>
          <div className="liquid-core" />
          <div className="liquid-dot liquid-dot-a" />
          <div className="liquid-dot liquid-dot-b" />
          <div className="liquid-dot liquid-dot-c" />
          </div>
          <div className="liquid-abs liquid-sheen" />
          <img className="liquid-abs liquid-logo" src={Logo} alt="" />
        </div>
      </div>
      <div className="liquid-word">XEEVI<span>A</span></div>
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
      scale: 1.5,
      fontSize: '18px',
      padding: '60px',
      showLogo: true,
      fullScreen: true
    },
    'profile': {
      fontSize: '16px',
      padding: '60px',
      showLogo: false,
      fullScreen: false
    },
    'section': {
      fontSize: '15px',
      padding: '60px',
      showLogo: false,
      fullScreen: false
    },
    'inline': {
      fontSize: '14px',
      padding: '0',
      showLogo: false,
      fullScreen: false
    },
    'default': {
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
    if (current.showLogo) {
      return (
        <>
          <LiquidOrbitLoader scale={current.scale} />
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

        .liquid-loader{--liquid-bg:#050505;display:grid;place-items:center;background:var(--liquid-bg);color:#fff;}
        .liquid-defs{position:absolute;width:0;height:0;overflow:hidden;}
        .liquid-wrap{display:grid;place-items:center;gap:calc(var(--liquid-k)*30px);}
        .liquid-stage{position:relative;width:calc(var(--liquid-k)*160px);height:calc(var(--liquid-k)*160px);}
        .liquid-abs{position:absolute;left:50%;top:50%;border-radius:50%;}
        .liquid-goo{position:absolute;inset:calc(var(--liquid-k)*-14px);}
        .liquid-core,.liquid-dot{position:absolute;left:50%;top:50%;border-radius:50%;background:#c6ff00;will-change:transform;}
        .liquid-core{width:calc(var(--liquid-k)*50px);height:calc(var(--liquid-k)*50px);margin:calc(var(--liquid-k)*-25px);animation:liquidCore 3s ease-in-out infinite;}
        .liquid-dot{width:calc(var(--liquid-k)*26px);height:calc(var(--liquid-k)*26px);margin:calc(var(--liquid-k)*-13px);animation:liquidOrbit 3s cubic-bezier(.6,0,.4,1) infinite;}
        .liquid-dot-b{animation-delay:-.25s;}
        .liquid-dot-c{animation-delay:-.5s;background:#d4af37;}
        .liquid-sheen{width:calc(var(--liquid-k)*50px);height:calc(var(--liquid-k)*50px);margin:calc(var(--liquid-k)*-25px);overflow:hidden;will-change:transform;animation:liquidCore 3s ease-in-out infinite;background:radial-gradient(circle at 30% 22%,rgba(255,255,255,.44),transparent 50%),linear-gradient(170deg,transparent 56%,rgba(60,85,0,.2));box-shadow:inset 0 0 0 1px rgba(255,255,255,.12),inset 0 calc(var(--liquid-k)*-4px) calc(var(--liquid-k)*9px) rgba(70,95,0,.16);}
        .liquid-sheen::after{content:"";position:absolute;top:-10%;bottom:-10%;left:0;width:50%;background:linear-gradient(105deg,transparent,rgba(255,255,255,.55) 50%,transparent);transform:translateX(-140%) skewX(-12deg);animation:liquidGlint 3s ease-in-out infinite;}
        .liquid-logo{width:calc(var(--liquid-k)*60px);height:calc(var(--liquid-k)*60px);margin:calc(var(--liquid-k)*-30px);object-fit:contain;mix-blend-mode:multiply;will-change:transform;animation:liquidLogo 3s ease-in-out infinite;}
        .liquid-word{color:#fff;font-weight:700;letter-spacing:.25em;text-indent:.25em;font-size:calc(var(--liquid-k)*18px);line-height:1.2;animation:liquidFade 3s ease-in-out infinite;}
        .liquid-word span{color:#d4af37;}
        @keyframes liquidOrbit{0%{transform:rotate(0) translateX(calc(var(--liquid-k)*70px))}50%{transform:rotate(360deg) translateX(0)}100%{transform:rotate(720deg) translateX(calc(var(--liquid-k)*70px))}}
        @keyframes liquidCore{0%,100%{transform:scale(1);border-radius:50%}50%{transform:scale(1.5);border-radius:30%}}
        @keyframes liquidLogo{0%,100%{transform:scale(.6667)}50%{transform:scale(1)}}
        @keyframes liquidFade{0%,100%{opacity:.4}50%{opacity:1}}
        @keyframes liquidGlint{0%,38%{transform:translateX(-140%) skewX(-12deg)}64%,100%{transform:translateX(280%) skewX(-12deg)}}
        .boxed-dots-loader{display:flex;align-items:center;justify-content:center;gap:5px;height:24px;}
        .boxed-dots-loader span{width:9px;height:9px;border-radius:2px;background:var(--accent,#c6ff00);opacity:.4;animation:boxedDot 1s ease-in-out infinite;}
        .boxed-dots-loader span:nth-child(2){animation-delay:.14s;}
        .boxed-dots-loader span:nth-child(3){animation-delay:.28s;}
        .boxed-dots-loader-compact{height:16px;gap:3px;}
        .boxed-dots-loader-compact span{width:5px;height:5px;}
        @keyframes boxedDot{0%,80%,100%{transform:translateY(0);opacity:.35}40%{transform:translateY(-5px);opacity:1}}
        @media(prefers-reduced-motion:reduce){.liquid-core,.liquid-dot,.liquid-sheen,.liquid-sheen::after,.liquid-logo,.liquid-word,.boxed-dots-loader span{animation:none!important}.boxed-dots-loader span{opacity:1}}

        .loader-logo {
          font-size: 72px;
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