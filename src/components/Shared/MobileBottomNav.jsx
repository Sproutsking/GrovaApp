import React from "react";
import { Home, Search, PlusSquare, Wallet, Users } from "lucide-react";

const MobileBottomNav = ({ activeTab, setActiveTab }) => (
  <nav className="mobile-bottom-nav">
    <div className="mobile-nav-content">
      <button
        onClick={() => setActiveTab("home")}
        className={
          activeTab === "home"
            ? "mobile-nav-btn mobile-nav-btn-active"
            : "mobile-nav-btn"
        }
      >
        <Home size={20} strokeWidth={activeTab === "home" ? 2.5 : 2} />
        <span className="mobile-nav-label">Home</span>
      </button>

      <button
        onClick={() => setActiveTab("search")}
        className={
          activeTab === "search"
            ? "mobile-nav-btn mobile-nav-btn-active"
            : "mobile-nav-btn"
        }
      >
        <Search size={20} strokeWidth={activeTab === "search" ? 2.5 : 2} />
        <span className="mobile-nav-label">Explore</span>
      </button>

      <button
        onClick={() => setActiveTab("create")}
        className="mobile-nav-btn-create"
      >
        <PlusSquare size={22} strokeWidth={2.5} />
        <span className="mobile-nav-label-create">Create</span>
      </button>

      <button
        onClick={() => setActiveTab("community")}
        className={
          activeTab === "community"
            ? "mobile-nav-btn mobile-nav-btn-active"
            : "mobile-nav-btn"
        }
      >
        <Users size={20} strokeWidth={activeTab === "community" ? 2.5 : 2} />
        <span className="mobile-nav-label">Community</span>
      </button>

      <button
        onClick={() => setActiveTab("wallet")}
        className={
          activeTab === "wallet"
            ? "mobile-nav-btn mobile-nav-btn-active"
            : "mobile-nav-btn"
        }
      >
        <Wallet size={20} strokeWidth={activeTab === "wallet" ? 2.5 : 2} />
        <span className="mobile-nav-label">Wallet</span>
      </button>
    </div>

    {/* FIX: NO "jsx" prop on style — that was causing the console error on every render */}
    <style>{`
      .mobile-bottom-nav {
        position: fixed;
        bottom: 0;
        left: 0;
        right: 0;
        z-index: 100;
        background: #000000;
        border-top: 1px solid rgba(132, 204, 22, 0.15);
        padding: 4px 0 calc(4px + env(safe-area-inset-bottom));
      }
      .mobile-nav-content {
        display: flex;
        align-items: center;
        justify-content: space-around;
        max-width: 600px;
        margin: 0 auto;
        padding: 0 8px;
        gap: 2px;
      }
      .mobile-nav-btn {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 2px;
        padding: 6px 6px;
        background: transparent;
        border: none;
        border-radius: 10px;
        color: #525252;
        cursor: pointer;
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        flex: 1;
        min-width: 0;
        position: relative;
      }
      .mobile-nav-btn:active { transform: scale(0.95); }
      .mobile-nav-btn-active {
        color: #84cc16;
        background: linear-gradient(135deg, rgba(132,204,22,0.15) 0%, rgba(132,204,22,0.08) 100%);
        box-shadow: 0 0 20px rgba(132,204,22,0.3), inset 0 1px 1px rgba(132,204,22,0.2);
        border: 1px solid rgba(132,204,22,0.3);
      }
      .mobile-nav-btn-active::before {
        content: "";
        position: absolute;
        top: -1px;
        left: 50%;
        transform: translateX(-50%);
        width: 30%;
        height: 2px;
        background: linear-gradient(90deg, transparent, #84cc16, transparent);
        border-radius: 0 0 2px 2px;
        box-shadow: 0 0 8px rgba(132,204,22,0.6);
      }
      .mobile-nav-label {
        font-size: 10px;
        font-weight: 600;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        max-width: 100%;
        transition: all 0.3s;
      }
      .mobile-nav-btn-active .mobile-nav-label { text-shadow: 0 0 8px rgba(132,204,22,0.5); }
      .mobile-nav-btn-create {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 2px;
        padding: 8px 10px;
        background: linear-gradient(135deg, #84cc16 0%, #65a30d 100%);
        border: none;
        border-radius: 12px;
        color: #000;
        cursor: pointer;
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        box-shadow: 0 4px 20px rgba(132,204,22,0.4), 0 0 30px rgba(132,204,22,0.2);
        transform: translateY(-4px);
        flex: 1;
        min-width: 0;
      }
      .mobile-nav-btn-create:active { transform: translateY(-2px) scale(0.95); }
      .mobile-nav-label-create { font-size: 10px; font-weight: 700; }
      @media (max-width: 400px) {
        .mobile-nav-label, .mobile-nav-label-create { display: none; }
        .mobile-nav-btn, .mobile-nav-btn-active { padding: 10px; border-radius: 12px; }
        .mobile-nav-btn-create { padding: 12px; border-radius: 14px; transform: translateY(-6px); }
        .mobile-nav-btn-create:active { transform: translateY(-4px) scale(0.95); }
      }
    `}</style>
  </nav>
);

export default MobileBottomNav;
