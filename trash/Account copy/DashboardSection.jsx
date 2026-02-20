// src/components/Account/DashboardSection.jsx
import React, { useState, useEffect } from 'react';
import { Award, Loader, TrendingUp } from 'lucide-react';
import profileService from '../../services/account/profileService';
import authService from '../../services/auth/authService';

const DashboardSection = () => {
  const [eliteCreators, setEliteCreators] = useState([]);
  const [userRank, setUserRank] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Get current user
      const user = await authService.getCurrentUser();
      
      // Load elite creators
      const creators = await profileService.getEliteCreators();
      setEliteCreators(creators);

      // Find user's rank if they're in the top 20
      if (user) {
        const userIndex = creators.findIndex(c => c.userId === user.id);
        if (userIndex !== -1) {
          setUserRank(userIndex + 1);
        }
      }

    } catch (err) {
      console.error('Failed to load dashboard:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const formatEarnings = (amount) => {
    if (amount >= 1000000) {
      return `${(amount / 1000000).toFixed(1)}M GT`;
    } else if (amount >= 1000) {
      return `${(amount / 1000).toFixed(1)}K GT`;
    }
    return `${Math.floor(amount)} GT`;
  };

  if (loading) {
    return (
      <div className="dashboard-section">
        <div className="loading-container">
          <Loader size={32} className="spinner" />
          <p>Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="dashboard-section">
        <div className="error-container">
          <p>Error: {error}</p>
          <button onClick={loadDashboardData} className="retry-btn">
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <style>{`
        .dashboard-section {
          padding: 20px;
        }

        .dashboard-hero {
          position: relative;
          background: linear-gradient(135deg, rgba(132, 204, 22, 0.15) 0%, rgba(132, 204, 22, 0.05) 100%);
          border: 2px solid rgba(132, 204, 22, 0.3);
          border-radius: 24px;
          padding: 40px 28px;
          margin-bottom: 28px;
          overflow: hidden;
        }

        .dashboard-hero::before {
          content: '';
          position: absolute;
          inset: 0;
          background: radial-gradient(circle at 50% 0%, rgba(132, 204, 22, 0.3) 0%, transparent 70%);
          animation: heroPulse 4s ease-in-out infinite;
        }

        @keyframes heroPulse {
          0%, 100% { opacity: 0.5; }
          50% { opacity: 1; }
        }

        .dashboard-hero-content {
          position: relative;
          z-index: 1;
          text-align: center;
        }

        .hero-icon-wrapper {
          width: 80px;
          height: 80px;
          margin: 0 auto 20px;
          border-radius: 24px;
          background: linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%);
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 8px 32px rgba(251, 191, 36, 0.5);
          animation: iconFloat 3s ease-in-out infinite;
        }

        @keyframes iconFloat {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-10px); }
        }

        .hero-title {
          font-size: 32px;
          font-weight: 900;
          margin: 0 0 12px 0;
          background: linear-gradient(135deg, #fbbf24 0%, #f59e0b 50%, #fbbf24 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-size: 200% auto;
          animation: textShine 3s ease-in-out infinite;
        }

        @keyframes textShine {
          to { background-position: 200% center; }
        }

        .hero-subtitle {
          font-size: 15px;
          color: #a3a3a3;
          margin: 0;
          font-weight: 600;
        }

        .user-rank-banner {
          background: linear-gradient(135deg, rgba(132, 204, 22, 0.2) 0%, rgba(132, 204, 22, 0.1) 100%);
          border: 2px solid rgba(132, 204, 22, 0.4);
          border-radius: 16px;
          padding: 20px;
          margin-bottom: 28px;
          text-align: center;
          position: relative;
          overflow: hidden;
        }

        .user-rank-banner::before {
          content: '';
          position: absolute;
          top: 0;
          left: -100%;
          width: 200%;
          height: 100%;
          background: linear-gradient(90deg, transparent, rgba(132, 204, 22, 0.3), transparent);
          animation: slideShine 3s infinite;
        }

        @keyframes slideShine {
          0% { left: -100%; }
          100% { left: 100%; }
        }

        .rank-number {
          font-size: 40px;
          font-weight: 900;
          background: linear-gradient(135deg, #84cc16 0%, #65a30d 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          margin: 0 0 8px 0;
        }

        .rank-text {
          font-size: 14px;
          color: #a3a3a3;
          margin: 0;
        }

        .elite-list {
          display: flex;
          flex-direction: column;
          gap: 12px;
          margin-bottom: 28px;
        }

        .elite-card {
          position: relative;
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 16px;
          padding: 18px;
          overflow: hidden;
          transition: all 0.3s;
        }

        .elite-card:hover {
          border-color: rgba(132, 204, 22, 0.4);
          transform: translateX(4px);
          box-shadow: 0 8px 24px rgba(132, 204, 22, 0.2);
        }

        .elite-card::before {
          content: '';
          position: absolute;
          inset: 0;
          background: linear-gradient(90deg, transparent, rgba(132, 204, 22, 0.05), transparent);
          transform: translateX(-100%);
          transition: transform 0.6s;
        }

        .elite-card:hover::before {
          transform: translateX(100%);
        }

        .elite-content {
          position: relative;
          z-index: 1;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .elite-left {
          display: flex;
          align-items: center;
          gap: 16px;
        }

        .elite-rank {
          width: 48px;
          height: 48px;
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 20px;
          font-weight: 900;
          flex-shrink: 0;
          position: relative;
        }

        .elite-rank-1 {
          background: linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%);
          color: #000;
          box-shadow: 0 4px 20px rgba(251, 191, 36, 0.6);
        }

        .elite-rank-1::after {
          content: '👑';
          position: absolute;
          top: -8px;
          right: -8px;
          font-size: 20px;
        }

        .elite-rank-2 {
          background: linear-gradient(135deg, #e5e7eb 0%, #9ca3af 100%);
          color: #000;
          box-shadow: 0 4px 20px rgba(156, 163, 175, 0.6);
        }

        .elite-rank-3 {
          background: linear-gradient(135deg, #d97706 0%, #b45309 100%);
          color: #ffffff;
          box-shadow: 0 4px 20px rgba(217, 119, 6, 0.6);
        }

        .elite-rank:not(.elite-rank-1):not(.elite-rank-2):not(.elite-rank-3) {
          background: rgba(132, 204, 22, 0.15);
          color: #84cc16;
          border: 2px solid rgba(132, 204, 22, 0.4);
        }

        .elite-avatar {
          width: 52px;
          height: 52px;
          border-radius: 14px;
          background: linear-gradient(135deg, #84cc16 0%, #65a30d 100%);
          display: flex;
          align-items: center;
          justify-content: center;
          color: #000;
          font-weight: 800;
          font-size: 22px;
          border: 2px solid rgba(132, 204, 22, 0.3);
          overflow: hidden;
          flex-shrink: 0;
        }

        .elite-info {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .elite-name {
          font-size: 16px;
          font-weight: 800;
          color: #ffffff;
          margin: 0;
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .verified-badge {
          background: #84cc16;
          color: #000;
          border-radius: 50%;
          width: 16px;
          height: 16px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 10px;
        }

        .elite-badge {
          display: flex;
          align-items: center;
          gap: 4px;
          font-size: 12px;
          color: #84cc16;
          font-weight: 600;
        }

        .elite-earnings {
          text-align: right;
        }

        .earnings-amount {
          font-size: 20px;
          font-weight: 900;
          background: linear-gradient(135deg, #84cc16 0%, #65a30d 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          margin: 0 0 4px 0;
        }

        .earnings-label {
          font-size: 11px;
          color: #737373;
          margin: 0;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          font-weight: 600;
        }

        .cta-card {
          position: relative;
          background: linear-gradient(135deg, rgba(132, 204, 22, 0.1) 0%, rgba(132, 204, 22, 0.05) 100%);
          border: 2px solid rgba(132, 204, 22, 0.3);
          border-radius: 20px;
          padding: 36px 28px;
          text-align: center;
          overflow: hidden;
        }

        .cta-icon {
          width: 64px;
          height: 64px;
          margin: 0 auto 20px;
          border-radius: 18px;
          background: linear-gradient(135deg, #84cc16 0%, #65a30d 100%);
          display: flex;
          align-items: center;
          justify-content: center;
          color: #000;
          box-shadow: 0 8px 24px rgba(132, 204, 22, 0.4);
        }

        .cta-title {
          font-size: 24px;
          font-weight: 900;
          color: #ffffff;
          margin: 0 0 12px 0;
        }

        .cta-text {
          font-size: 14px;
          color: #a3a3a3;
          margin: 0 0 24px 0;
          line-height: 1.6;
        }

        .cta-button {
          padding: 16px 32px;
          background: linear-gradient(135deg, #84cc16 0%, #65a30d 100%);
          border: none;
          border-radius: 14px;
          color: #000;
          font-size: 16px;
          font-weight: 800;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          gap: 10px;
          transition: all 0.3s;
          box-shadow: 0 4px 16px rgba(132, 204, 22, 0.4);
        }

        .cta-button:hover {
          transform: translateY(-4px);
          box-shadow: 0 8px 32px rgba(132, 204, 22, 0.6);
        }
      `}</style>

      <div className="dashboard-section">
        <div className="dashboard-header-card">
          <div className="dashboard-header-bg"></div>
          <div className="dashboard-header-glow"></div>
          <div className="dashboard-header-content">
            <div className="dashboard-title-row">
              <Award size={32} />
              <h1 className="dashboard-title">The Elite 20</h1>
            </div>
            <p className="dashboard-subtitle">Top creators earning 10% dividend bonus</p>
          </div>
        </div>

        {userRank && (
          <div className="user-rank-banner">
            <h3>🎉 You're Ranked #{userRank}</h3>
            <p>Keep creating to maintain your elite status!</p>
          </div>
        )}

        <div className="elite-list">
          {eliteCreators.map((creator) => (
            <div key={creator.userId} className="elite-card">
              <div className="elite-card-bg"></div>
              <div className="elite-card-glow"></div>
              <div className="elite-card-content">
                <div className="elite-left">
                  <div className={`elite-rank elite-rank-${creator.rank}`}>
                    {creator.rank}
                  </div>
                  <div className="elite-avatar">
                    {creator.avatar ? (
                      <img src={creator.avatar} alt={creator.name} />
                    ) : (
                      creator.name.charAt(0).toUpperCase()
                    )}
                  </div>
                  <div className="elite-info">
                    <h3 className="elite-name">{creator.name}</h3>
                    <p className="elite-badge">
                      <Award size={14} />
                      Elite Creator
                    </p>
                  </div>
                </div>
                <div className="elite-right">
                  <p className="elite-earnings">{formatEarnings(creator.totalEarnings)}</p>
                  <p className="elite-label">Total Earnings</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="elite-cta-card">
          <div className="elite-cta-bg"></div>
          <div className="elite-cta-content">
            <Award size={40} />
            <h3 className="elite-cta-title">Join The Elite</h3>
            <p className="elite-cta-text">
              Create compelling stories, engaging reels, and quality posts to earn your place among the top 20 creators
            </p>
            <button className="elite-cta-btn">
              <TrendingUp size={18} style={{ marginRight: '8px' }} />
              Start Creating
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default DashboardSection;