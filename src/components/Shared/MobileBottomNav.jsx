import React from 'react';
import { Home, Search, PlusSquare, Wallet, Users } from 'lucide-react';

const MobileBottomNav = ({ activeTab, setActiveTab }) => (
  <nav className="mobile-bottom-nav">
    <div className="mobile-nav-content">
      <button 
        onClick={() => setActiveTab('home')} 
        className={activeTab === 'home' ? 'mobile-nav-btn mobile-nav-btn-active' : 'mobile-nav-btn'}
      >
        <Home size={22} strokeWidth={activeTab === 'home' ? 2.5 : 2} />
        <span className="mobile-nav-label">Home</span>
      </button>

      <button 
        onClick={() => setActiveTab('search')} 
        className={activeTab === 'search' ? 'mobile-nav-btn mobile-nav-btn-active' : 'mobile-nav-btn'}
      >
        <Search size={22} strokeWidth={activeTab === 'search' ? 2.5 : 2} />
        <span className="mobile-nav-label">Explore</span>
      </button>

      <button 
        onClick={() => setActiveTab('create')} 
        className="mobile-nav-btn-create"
      >
        <PlusSquare size={24} strokeWidth={2.5} />
        <span className="mobile-nav-label-create">Create</span>
      </button>

      <button 
        onClick={() => setActiveTab('community')} 
        className={activeTab === 'community' ? 'mobile-nav-btn mobile-nav-btn-active' : 'mobile-nav-btn'}
      >
        <Users size={22} strokeWidth={activeTab === 'community' ? 2.5 : 2} />
        <span className="mobile-nav-label">
          <span className="label-full">Community</span>
          <span className="label-short">Social</span>
        </span>
      </button>

      <button 
        onClick={() => setActiveTab('wallet')} 
        className={activeTab === 'wallet' ? 'mobile-nav-btn mobile-nav-btn-active' : 'mobile-nav-btn'}
      >
        <Wallet size={22} strokeWidth={activeTab === 'wallet' ? 2.5 : 2} />
        <span className="mobile-nav-label">Wallet</span>
      </button>
    </div>

    <style jsx>{`
      .mobile-bottom-nav {
        position: fixed;
        bottom: 0;
        left: 0;
        right: 0;
        z-index: 100;
        background: rgba(10, 10, 10, 0.98);
        backdrop-filter: blur(20px);
        border-top: 1px solid rgba(132, 204, 22, 0.2);
        padding: 8px 0 calc(8px + env(safe-area-inset-bottom));
      }

      .mobile-nav-content {
        display: flex;
        align-items: center;
        justify-content: space-around;
        max-width: 600px;
        margin: 0 auto;
        padding: 0 12px;
        gap: 4px;
      }

      .mobile-nav-btn {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 4px;
        padding: 8px 8px;
        background: transparent;
        border: none;
        border-radius: 12px;
        color: #737373;
        cursor: pointer;
        transition: all 0.2s;
        flex: 1;
        min-width: 0;
      }

      .mobile-nav-btn:active {
        transform: scale(0.95);
      }

      .mobile-nav-btn-active {
        color: #84cc16;
        background: rgba(132, 204, 22, 0.1);
      }

      .mobile-nav-label {
        font-size: 11px;
        font-weight: 600;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        max-width: 100%;
      }

      .label-full {
        display: inline;
      }

      .label-short {
        display: none;
      }

      /* Show short label on very small screens */
      @media (max-width: 360px) {
        .label-full {
          display: none;
        }
        
        .label-short {
          display: inline;
        }
      }

      .mobile-nav-btn-create {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 4px;
        padding: 10px 12px;
        background: linear-gradient(135deg, #84cc16 0%, #65a30d 100%);
        border: none;
        border-radius: 14px;
        color: #000;
        cursor: pointer;
        transition: all 0.2s;
        box-shadow: 0 4px 16px rgba(132, 204, 22, 0.35);
        transform: translateY(-6px);
        flex: 1;
        min-width: 0;
      }

      .mobile-nav-btn-create:active {
        transform: translateY(-4px) scale(0.95);
      }

      .mobile-nav-label-create {
        font-size: 11px;
        font-weight: 700;
      }

      /* Extra small screens - reduce font size */
      @media (max-width: 340px) {
        .mobile-nav-label,
        .mobile-nav-label-create {
          font-size: 10px;
        }
        
        .mobile-nav-btn {
          padding: 8px 6px;
        }
        
        .mobile-nav-btn-create {
          padding: 10px 10px;
        }
      }
    `}</style>
  </nav>
);

export default MobileBottomNav;