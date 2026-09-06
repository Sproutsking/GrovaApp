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
    if (current.showLogo) {
      return (
        <div className="app-init-scene" aria-hidden="true">
          <div className="app-init-grid" />
          <div className="app-init-vignette" />
          <div className="app-init-core">
            <div className="app-init-orbit app-init-orbit-a" />
            <div className="app-init-orbit app-init-orbit-b" />
            <div className="app-init-orbit app-init-orbit-c" />
            <div className="app-init-globe">
              <div className="app-init-latitude app-init-latitude-a" />
              <div className="app-init-latitude app-init-latitude-b" />
              <div className="app-init-longitude app-init-longitude-a" />
              <div className="app-init-longitude app-init-longitude-b" />
              <i className="app-init-node app-init-node-a" />
              <i className="app-init-node app-init-node-b" />
              <i className="app-init-node app-init-node-c" />
              <i className="app-init-node app-init-node-d" />
            </div>
            <div className="app-init-scan" />
          </div>
          <div className="app-init-brand">XEEVIA</div>
          <div className="app-init-rule"><span /> SYSTEM ONLINE <span /></div>
        </div>
      );
    }

    return (
      <>
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
          background: var(--bg);
          color: var(--text);
        }

        .unified-loader.fullscreen {
          position: fixed;
          inset: 0;
          background: var(--bg);
          z-index: 9999;
        }

        .unified-loader.fullscreen::before {
          content: '';
          position: absolute;
          inset: 0;
          background: radial-gradient(circle at 50% 50%, rgba(132, 204, 22, 0.15) 0%, transparent 45%);
          animation: pulse 3s ease-in-out infinite;
        }

        .unified-loader > * {
          position: relative;
          z-index: 1;
        }

        .app-init-scene{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;overflow:hidden;background:#020403;color:#eaffd8}
        .app-init-grid{position:absolute;inset:-35%;opacity:.28;background-image:linear-gradient(rgba(132,204,22,.1) 1px,transparent 1px),linear-gradient(90deg,rgba(132,204,22,.1) 1px,transparent 1px);background-size:48px 48px;transform:perspective(440px) rotateX(58deg) translateY(24%);transform-origin:center bottom;animation:appInitGrid 9s linear infinite}
        .app-init-vignette{position:absolute;inset:0;background:radial-gradient(circle at center,transparent 0%,rgba(1,3,2,.2) 42%,rgba(0,0,0,.9) 100%)}
        .app-init-core{position:relative;width:min(330px,76vw);aspect-ratio:1;display:grid;place-items:center;animation:appInitRise .9s cubic-bezier(.16,1,.3,1) both}
        .app-init-globe{position:relative;width:30%;aspect-ratio:1;border:1px solid rgba(156,255,0,.7);border-radius:50%;background:radial-gradient(circle at 35% 28%,rgba(156,255,0,.2),rgba(4,20,7,.94) 63%,#020503);box-shadow:0 0 0 8px rgba(156,255,0,.035),0 0 32px rgba(156,255,0,.45),inset 0 0 24px rgba(156,255,0,.18);overflow:hidden;animation:appInitPulse 2.8s ease-in-out infinite}
        .app-init-globe:before,.app-init-globe:after{content:"";position:absolute;inset:13% -10%;border:1px solid rgba(156,255,0,.3);border-radius:50%;transform:rotate(25deg)}.app-init-globe:after{inset:-10% 20%;transform:rotate(-25deg)}
        .app-init-latitude,.app-init-longitude{position:absolute;border:1px solid rgba(156,255,0,.25);border-radius:50%;pointer-events:none}.app-init-latitude{left:-12%;right:-12%;height:34%;top:33%}.app-init-latitude-b{top:48%;height:15%;opacity:.7}.app-init-longitude{top:-10%;bottom:-10%;width:38%;left:31%}.app-init-longitude-b{left:16%;width:68%;opacity:.65}
        .app-init-node{position:absolute;width:5px;height:5px;border-radius:50%;background:#c8ff78;box-shadow:0 0 10px #9cff00;animation:appInitNode 1.8s ease-in-out infinite}.app-init-node-a{top:20%;left:25%}.app-init-node-b{top:38%;right:18%;animation-delay:.35s}.app-init-node-c{bottom:22%;left:21%;animation-delay:.7s}.app-init-node-d{bottom:18%;right:30%;animation-delay:1.05s}
        .app-init-orbit{position:absolute;inset:13%;border:1px solid rgba(156,255,0,.3);border-radius:50%;transform:rotate(62deg);animation:appInitOrbit 4.8s linear infinite}.app-init-orbit:after{content:"";position:absolute;top:-4px;left:50%;width:7px;height:7px;border-radius:50%;background:#b8ff61;box-shadow:0 0 14px #9cff00}.app-init-orbit-b{inset:4%;transform:rotate(-34deg) scaleY(.55);border-color:rgba(56,189,248,.26);animation-duration:7s;animation-direction:reverse}.app-init-orbit-b:after{background:#67e8f9;box-shadow:0 0 14px #38bdf8}.app-init-orbit-c{inset:23%;transform:rotate(8deg) scaleY(.42);border-color:rgba(251,191,36,.3);animation-duration:3.4s}.app-init-orbit-c:after{background:#fde68a;box-shadow:0 0 14px #fbbf24}
        .app-init-scan{position:absolute;width:70%;height:2px;background:linear-gradient(90deg,transparent,#b7ff65,transparent);box-shadow:0 0 16px rgba(156,255,0,.8);animation:appInitScan 2.6s ease-in-out infinite}.app-init-brand{position:relative;margin-top:-24px;color:#f3ffe9;font-size:clamp(25px,5vw,38px);font-weight:900;letter-spacing:.24em;text-indent:.24em;text-shadow:0 0 22px rgba(156,255,0,.32);animation:appInitBrand .9s .2s ease both}.app-init-rule{position:relative;display:flex;align-items:center;gap:9px;margin-top:12px;color:#84cc16;font-size:8px;font-weight:800;letter-spacing:.3em;animation:appInitBrand .8s .38s ease both}.app-init-rule span{width:24px;height:1px;background:linear-gradient(90deg,transparent,#84cc16)}.app-init-rule span:last-child{background:linear-gradient(90deg,#84cc16,transparent)}
        @keyframes appInitOrbit{to{transform:rotate(422deg)}}@keyframes appInitGrid{to{background-position:0 48px,48px 0}}@keyframes appInitPulse{0%,100%{transform:scale(.98)}50%{transform:scale(1.04)}}@keyframes appInitNode{0%,100%{opacity:.35;transform:scale(.7)}50%{opacity:1;transform:scale(1.35)}}@keyframes appInitScan{0%{transform:translateY(-105px);opacity:0}25%,75%{opacity:1}100%{transform:translateY(105px);opacity:0}}@keyframes appInitRise{from{opacity:0;transform:translateY(18px) scale(.96)}to{opacity:1;transform:none}}@keyframes appInitBrand{from{opacity:0;transform:translateY(8px);filter:blur(6px)}to{opacity:1;transform:none;filter:none}}
        @media(prefers-reduced-motion:reduce){.app-init-grid,.app-init-orbit,.app-init-globe,.app-init-node,.app-init-scan,.app-init-core,.app-init-brand,.app-init-rule{animation:none}}

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

      <div className={containerClass}>
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