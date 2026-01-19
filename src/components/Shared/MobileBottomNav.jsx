// src/components/Shared/MobileBottomNav.jsx
import React from 'react';
import { Home, Search, PlusSquare, User, Wallet } from 'lucide-react';

const MobileBottomNav = ({ activeTab, setActiveTab }) => (
  <nav className="mobile-bottom-nav">
    <div className="mobile-nav-content">
      <button onClick={() => setActiveTab('home')} className={activeTab === 'home' ? 'mobile-nav-btn mobile-nav-btn-active' : 'mobile-nav-btn'}>
        <Home size={22} strokeWidth={activeTab === 'home' ? 2.5 : 2} />
        <span className="mobile-nav-label">Home</span>
      </button>
      <button onClick={() => setActiveTab('search')} className={activeTab === 'search' ? 'mobile-nav-btn mobile-nav-btn-active' : 'mobile-nav-btn'}>
        <Search size={22} strokeWidth={activeTab === 'search' ? 2.5 : 2} />
        <span className="mobile-nav-label">Explore</span>
      </button>
      <button onClick={() => setActiveTab('create')} className="mobile-nav-btn-create">
        <PlusSquare size={26} strokeWidth={2.5} />
        <span className="mobile-nav-label-create">Create</span>
      </button>
      <button onClick={() => setActiveTab('wallet')} className={activeTab === 'wallet' ? 'mobile-nav-btn mobile-nav-btn-active' : 'mobile-nav-btn'}>
        <Wallet size={22} strokeWidth={activeTab === 'wallet' ? 2.5 : 2} />
        <span className="mobile-nav-label">Wallet</span>
      </button>
      <button onClick={() => setActiveTab('account')} className={activeTab === 'account' ? 'mobile-nav-btn mobile-nav-btn-active' : 'mobile-nav-btn'}>
        <User size={22} strokeWidth={activeTab === 'account' ? 2.5 : 2} />
        <span className="mobile-nav-label">Account</span>
      </button>
    </div>
  </nav>
);

export default MobileBottomNav;