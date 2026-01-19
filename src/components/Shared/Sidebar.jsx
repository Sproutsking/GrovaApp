// src/components/Shared/Sidebar.jsx
import React from 'react';
import { Home, Search, PlusSquare, User, Wallet } from 'lucide-react';

const Sidebar = ({ activeTab, setActiveTab }) => (
  <div className="sidebar">
    <nav className="sidebar-nav">
      <button onClick={() => setActiveTab('home')} className={activeTab === 'home' ? 'sidebar-btn active' : 'sidebar-btn'}>
        <Home size={24} />
        <span>Home</span>
      </button>
      <button onClick={() => setActiveTab('search')} className={activeTab === 'search' ? 'sidebar-btn active' : 'sidebar-btn'}>
        <Search size={24} />
        <span>Explore</span>
      </button>
      <button onClick={() => setActiveTab('create')} className={activeTab === 'create' ? 'sidebar-btn active' : 'sidebar-btn'}>
        <PlusSquare size={24} />
        <span>Create</span>
      </button>
      <button onClick={() => setActiveTab('wallet')} className={activeTab === 'wallet' ? 'sidebar-btn active' : 'sidebar-btn'}>
        <Wallet size={24} />
        <span>Wallet</span>
      </button>
      <button onClick={() => setActiveTab('account')} className={activeTab === 'account' ? 'sidebar-btn active' : 'sidebar-btn'}>
        <User size={24} />
        <span>Account</span>
      </button>
    </nav>
    <div className="sidebar-footer">
  <button className="social-quicklinks" aria-label="X (Twitter)">
    <i className="fa-brands fa-x-twitter"></i>
  </button>

  <button className="social-quicklinks" aria-label="Facebook">
    <i className="bx bxl-facebook"></i>
  </button>

  <button className="social-quicklinks" aria-label="Discord">
    <i className="bx bxl-discord-alt"></i>
  </button>
  <button className="social-quicklinks" aria-label="TikTok">
    <i className="fa-brands fa-tiktok"></i>
  </button>

</div>

  </div>
);

export default Sidebar;