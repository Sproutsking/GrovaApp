import React, { useState, useEffect } from "react";
import {
  ChevronLeft,
  TrendingUp,
  Activity,
  Users,
  MessageSquare,
  Calendar,
  Clock,
  Eye,
  Heart,
  Share2,
  Zap,
  Award,
  Target,
  BarChart3,
  PieChart,
  LineChart as LineChartIcon,
  Download,
  Filter,
  RefreshCw,
  ArrowUp,
  ArrowDown,
  Minus,
} from "lucide-react";

const AnalyticsSection = ({ community, onBack }) => {
  const [timeRange, setTimeRange] = useState("7d");
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAnalytics();
  }, [timeRange]);

  const loadAnalytics = async () => {
    setLoading(true);
    // Simulate API call
    setTimeout(() => {
      setAnalytics({
        growth: {
          members: { value: 247, change: 23.5, trend: "up" },
          engagement: { value: 89.3, change: 12.1, trend: "up" },
          messages: { value: 1847, change: -3.2, trend: "down" },
          activeUsers: { value: 156, change: 8.4, trend: "up" },
        },
        engagement: {
          totalMessages: 12847,
          totalReactions: 3421,
          averageResponseTime: "2.3 min",
          peakHours: ["14:00", "18:00", "21:00"],
        },
        topMembers: [
          { id: 1, name: "Sarah Johnson", messages: 342, reactions: 156 },
          { id: 2, name: "Mike Chen", messages: 298, reactions: 189 },
          { id: 3, name: "Emily Rodriguez", messages: 267, reactions: 234 },
        ],
        topChannels: [
          { id: 1, name: "general", messages: 4231, members: 247 },
          { id: 2, name: "announcements", messages: 1893, members: 247 },
          { id: 3, name: "random", messages: 2134, members: 189 },
        ],
      });
      setLoading(false);
    }, 800);
  };

  const timeRanges = [
    { value: "24h", label: "24 Hours" },
    { value: "7d", label: "7 Days" },
    { value: "30d", label: "30 Days" },
    { value: "90d", label: "90 Days" },
  ];

  const getTrendIcon = (trend) => {
    if (trend === "up") return <ArrowUp size={14} />;
    if (trend === "down") return <ArrowDown size={14} />;
    return <Minus size={14} />;
  };

  const getTrendColor = (trend) => {
    if (trend === "up") return "#10b981";
    if (trend === "down") return "#ff6b6b";
    return "#999";
  };

  return (
    <>
      <div className="back-button" onClick={onBack}>
        <ChevronLeft size={16} />
        Back to Menu
      </div>

      <div className="analytics-header">
        <div className="analytics-title">
          <BarChart3 size={20} />
          <span>Community Analytics</span>
        </div>
        <button className="refresh-btn" onClick={loadAnalytics}>
          <RefreshCw size={14} className={loading ? "spinning" : ""} />
        </button>
      </div>

      {/* Time Range Selector */}
      <div className="time-range-selector">
        {timeRanges.map((range) => (
          <button
            key={range.value}
            className={`time-range-btn ${timeRange === range.value ? "active" : ""}`}
            onClick={() => setTimeRange(range.value)}
          >
            {range.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="loading-analytics">
          <div className="spinner-large"></div>
          <p>Loading analytics...</p>
        </div>
      ) : (
        <div className="analytics-content">
          {/* Growth Metrics */}
          <div className="metrics-section">
            <div className="section-header">
              <TrendingUp size={16} />
              <span>Growth Overview</span>
            </div>
            <div className="metrics-grid">
              <div className="metric-card">
                <div
                  className="metric-icon"
                  style={{
                    background:
                      "linear-gradient(135deg, #9cff00 0%, #667eea 100%)",
                  }}
                >
                  <Users size={20} />
                </div>
                <div className="metric-info">
                  <div className="metric-value">
                    {analytics.growth.members.value}
                  </div>
                  <div className="metric-label">Total Members</div>
                  <div
                    className="metric-change"
                    style={{
                      color: getTrendColor(analytics.growth.members.trend),
                    }}
                  >
                    {getTrendIcon(analytics.growth.members.trend)}
                    {Math.abs(analytics.growth.members.change)}%
                  </div>
                </div>
              </div>

              <div className="metric-card">
                <div
                  className="metric-icon"
                  style={{
                    background:
                      "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)",
                  }}
                >
                  <Activity size={20} />
                </div>
                <div className="metric-info">
                  <div className="metric-value">
                    {analytics.growth.engagement.value}%
                  </div>
                  <div className="metric-label">Engagement Rate</div>
                  <div
                    className="metric-change"
                    style={{
                      color: getTrendColor(analytics.growth.engagement.trend),
                    }}
                  >
                    {getTrendIcon(analytics.growth.engagement.trend)}
                    {Math.abs(analytics.growth.engagement.change)}%
                  </div>
                </div>
              </div>

              <div className="metric-card">
                <div
                  className="metric-icon"
                  style={{
                    background:
                      "linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)",
                  }}
                >
                  <MessageSquare size={20} />
                </div>
                <div className="metric-info">
                  <div className="metric-value">
                    {analytics.growth.messages.value.toLocaleString()}
                  </div>
                  <div className="metric-label">Messages Sent</div>
                  <div
                    className="metric-change"
                    style={{
                      color: getTrendColor(analytics.growth.messages.trend),
                    }}
                  >
                    {getTrendIcon(analytics.growth.messages.trend)}
                    {Math.abs(analytics.growth.messages.change)}%
                  </div>
                </div>
              </div>

              <div className="metric-card">
                <div
                  className="metric-icon"
                  style={{
                    background:
                      "linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)",
                  }}
                >
                  <Zap size={20} />
                </div>
                <div className="metric-info">
                  <div className="metric-value">
                    {analytics.growth.activeUsers.value}
                  </div>
                  <div className="metric-label">Active Users</div>
                  <div
                    className="metric-change"
                    style={{
                      color: getTrendColor(analytics.growth.activeUsers.trend),
                    }}
                  >
                    {getTrendIcon(analytics.growth.activeUsers.trend)}
                    {Math.abs(analytics.growth.activeUsers.change)}%
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Engagement Stats */}
          <div className="stats-section">
            <div className="section-header">
              <Activity size={16} />
              <span>Engagement Statistics</span>
            </div>
            <div className="stats-grid">
              <div className="stat-item">
                <MessageSquare size={18} color="#9cff00" />
                <div className="stat-details">
                  <div className="stat-value">
                    {analytics.engagement.totalMessages.toLocaleString()}
                  </div>
                  <div className="stat-label">Total Messages</div>
                </div>
              </div>

              <div className="stat-item">
                <Heart size={18} color="#f093fb" />
                <div className="stat-details">
                  <div className="stat-value">
                    {analytics.engagement.totalReactions.toLocaleString()}
                  </div>
                  <div className="stat-label">Total Reactions</div>
                </div>
              </div>

              <div className="stat-item">
                <Clock size={18} color="#4facfe" />
                <div className="stat-details">
                  <div className="stat-value">
                    {analytics.engagement.averageResponseTime}
                  </div>
                  <div className="stat-label">Avg Response Time</div>
                </div>
              </div>
            </div>
          </div>

          {/* Peak Activity Hours */}
          <div className="activity-section">
            <div className="section-header">
              <Calendar size={16} />
              <span>Peak Activity Hours</span>
            </div>
            <div className="peak-hours-chart">
              {Array.from({ length: 24 }, (_, i) => {
                const hour = i.toString().padStart(2, "0") + ":00";
                const isPeak = analytics.engagement.peakHours.includes(hour);
                const height = isPeak ? 80 : Math.random() * 40 + 20;
                return (
                  <div key={i} className="hour-bar">
                    <div
                      className={`bar ${isPeak ? "peak" : ""}`}
                      style={{ height: `${height}%` }}
                    />
                    {i % 3 === 0 && <span className="hour-label">{hour}</span>}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Top Contributors */}
          <div className="leaderboard-section">
            <div className="section-header">
              <Award size={16} />
              <span>Top Contributors</span>
            </div>
            <div className="leaderboard">
              {analytics.topMembers.map((member, index) => (
                <div key={member.id} className="leaderboard-item">
                  <div
                    className="rank-badge"
                    style={{
                      background:
                        index === 0
                          ? "linear-gradient(135deg, #ffd700 0%, #ffed4e 100%)"
                          : index === 1
                            ? "linear-gradient(135deg, #c0c0c0 0%, #e8e8e8 100%)"
                            : "linear-gradient(135deg, #cd7f32 0%, #daa520 100%)",
                    }}
                  >
                    {index + 1}
                  </div>
                  <div className="member-avatar-small">{member.name[0]}</div>
                  <div className="member-stats">
                    <div className="member-name">{member.name}</div>
                    <div className="member-metrics">
                      <span>
                        <MessageSquare size={12} /> {member.messages}
                      </span>
                      <span>
                        <Heart size={12} /> {member.reactions}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Top Channels */}
          <div className="channels-section">
            <div className="section-header">
              <Target size={16} />
              <span>Most Active Channels</span>
            </div>
            <div className="channels-list">
              {analytics.topChannels.map((channel, index) => (
                <div key={channel.id} className="channel-stat-card">
                  <div className="channel-rank">#{index + 1}</div>
                  <div className="channel-info">
                    <div className="channel-name"># {channel.name}</div>
                    <div className="channel-metrics">
                      <div className="metric-pill">
                        <MessageSquare size={12} />
                        {channel.messages.toLocaleString()} messages
                      </div>
                      <div className="metric-pill">
                        <Users size={12} />
                        {channel.members} members
                      </div>
                    </div>
                  </div>
                  <div className="channel-activity">
                    <div
                      className="activity-bar"
                      style={{
                        width: `${(channel.messages / analytics.topChannels[0].messages) * 100}%`,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Export Button */}
          <button className="export-btn">
            <Download size={14} />
            Export Analytics Report
          </button>
        </div>
      )}

      <style>{`
        .back-button {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 12px;
          cursor: pointer;
          color: #9cff00;
          font-weight: 600;
          font-size: 13px;
          transition: all 0.2s;
          margin-bottom: 16px;
        }

        .back-button:hover {
          transform: translateX(-4px);
          color: #84cc16;
        }

        .analytics-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 0 12px;
          margin-bottom: 20px;
        }

        .analytics-title {
          display: flex;
          align-items: center;
          gap: 12px;
          font-size: 18px;
          font-weight: 700;
          color: #fff;
        }

        .refresh-btn {
          width: 36px;
          height: 36px;
          border-radius: 8px;
          background: rgba(26, 26, 26, 0.6);
          border: 2px solid rgba(42, 42, 42, 0.8);
          color: #9cff00;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s;
        }

        .refresh-btn:hover {
          background: rgba(26, 26, 26, 0.9);
          border-color: rgba(156, 255, 0, 0.4);
          transform: rotate(90deg);
        }

        .spinning {
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }

        .time-range-selector {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 8px;
          padding: 0 12px;
          margin-bottom: 24px;
        }

        .time-range-btn {
          padding: 10px;
          background: rgba(26, 26, 26, 0.4);
          border: 2px solid rgba(42, 42, 42, 0.6);
          border-radius: 8px;
          color: #999;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }

        .time-range-btn:hover {
          background: rgba(26, 26, 26, 0.7);
          border-color: rgba(156, 255, 0, 0.2);
          color: #d4d4d4;
        }

        .time-range-btn.active {
          background: linear-gradient(
            135deg,
            rgba(156, 255, 0, 0.15) 0%,
            rgba(102, 126, 234, 0.15) 100%
          );
          border-color: rgba(156, 255, 0, 0.4);
          color: #9cff00;
          box-shadow: 0 4px 12px rgba(156, 255, 0, 0.15);
        }

        .loading-analytics {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 80px 20px;
          gap: 20px;
        }

        .spinner-large {
          width: 60px;
          height: 60px;
          border: 4px solid rgba(156, 255, 0, 0.1);
          border-top-color: #9cff00;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }

        .loading-analytics p {
          color: #999;
          font-size: 14px;
        }

        .analytics-content {
          padding: 0 12px;
          display: flex;
          flex-direction: column;
          gap: 24px;
        }

        .metrics-section,
        .stats-section,
        .activity-section,
        .leaderboard-section,
        .channels-section {
          background: rgba(26, 26, 26, 0.4);
          border: 2px solid rgba(42, 42, 42, 0.6);
          border-radius: 16px;
          padding: 20px;
        }

        .section-header {
          display: flex;
          align-items: center;
          gap: 10px;
          font-size: 14px;
          font-weight: 700;
          color: #9cff00;
          margin-bottom: 16px;
          padding-bottom: 12px;
          border-bottom: 2px solid rgba(156, 255, 0, 0.2);
        }

        .metrics-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 12px;
        }

        .metric-card {
          display: flex;
          align-items: center;
          gap: 16px;
          padding: 16px;
          background: rgba(26, 26, 26, 0.6);
          border: 2px solid rgba(42, 42, 42, 0.8);
          border-radius: 12px;
          transition: all 0.3s;
        }

        .metric-card:hover {
          transform: translateY(-4px);
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3);
          border-color: rgba(156, 255, 0, 0.3);
        }

        .metric-icon {
          width: 48px;
          height: 48px;
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #fff;
          flex-shrink: 0;
        }

        .metric-info {
          flex: 1;
          min-width: 0;
        }

        .metric-value {
          font-size: 24px;
          font-weight: 800;
          color: #fff;
          line-height: 1;
          margin-bottom: 4px;
        }

        .metric-label {
          font-size: 11px;
          color: #999;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          margin-bottom: 6px;
        }

        .metric-change {
          display: flex;
          align-items: center;
          gap: 4px;
          font-size: 12px;
          font-weight: 700;
        }

        .stats-grid {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .stat-item {
          display: flex;
          align-items: center;
          gap: 16px;
          padding: 16px;
          background: rgba(26, 26, 26, 0.6);
          border-radius: 10px;
        }

        .stat-details {
          flex: 1;
        }

        .stat-value {
          font-size: 20px;
          font-weight: 800;
          color: #fff;
          margin-bottom: 4px;
        }

        .stat-label {
          font-size: 12px;
          color: #999;
        }

        .peak-hours-chart {
          display: flex;
          align-items: flex-end;
          gap: 4px;
          height: 120px;
          padding: 16px;
          background: rgba(26, 26, 26, 0.6);
          border-radius: 10px;
        }

        .hour-bar {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 8px;
          height: 100%;
          position: relative;
        }

        .bar {
          width: 100%;
          background: rgba(102, 126, 234, 0.4);
          border-radius: 4px 4px 0 0;
          transition: all 0.3s;
          align-self: flex-end;
        }

        .bar.peak {
          background: linear-gradient(180deg, #9cff00 0%, #667eea 100%);
          box-shadow: 0 0 12px rgba(156, 255, 0, 0.4);
        }

        .hour-label {
          font-size: 9px;
          color: #666;
          position: absolute;
          bottom: -20px;
          white-space: nowrap;
        }

        .leaderboard {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .leaderboard-item {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 14px;
          background: rgba(26, 26, 26, 0.6);
          border: 2px solid rgba(42, 42, 42, 0.6);
          border-radius: 10px;
          transition: all 0.2s;
        }

        .leaderboard-item:hover {
          background: rgba(26, 26, 26, 0.9);
          border-color: rgba(156, 255, 0, 0.3);
          transform: translateX(4px);
        }

        .rank-badge {
          width: 32px;
          height: 32px;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 14px;
          font-weight: 800;
          color: #000;
          flex-shrink: 0;
        }

        .member-avatar-small {
          width: 40px;
          height: 40px;
          border-radius: 50%;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 700;
          color: #fff;
          flex-shrink: 0;
        }

        .member-stats {
          flex: 1;
        }

        .member-name {
          font-size: 14px;
          font-weight: 600;
          color: #fff;
          margin-bottom: 4px;
        }

        .member-metrics {
          display: flex;
          gap: 12px;
          font-size: 12px;
          color: #999;
        }

        .member-metrics span {
          display: flex;
          align-items: center;
          gap: 4px;
        }

        .channels-list {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .channel-stat-card {
          padding: 16px;
          background: rgba(26, 26, 26, 0.6);
          border: 2px solid rgba(42, 42, 42, 0.6);
          border-radius: 10px;
          display: flex;
          align-items: center;
          gap: 12px;
          transition: all 0.2s;
        }

        .channel-stat-card:hover {
          background: rgba(26, 26, 26, 0.9);
          border-color: rgba(156, 255, 0, 0.3);
        }

        .channel-rank {
          width: 32px;
          height: 32px;
          border-radius: 8px;
          background: linear-gradient(135deg, #9cff00 0%, #667eea 100%);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 14px;
          font-weight: 800;
          color: #000;
          flex-shrink: 0;
        }

        .channel-info {
          flex: 1;
          min-width: 0;
        }

        .channel-name {
          font-size: 14px;
          font-weight: 700;
          color: #fff;
          margin-bottom: 6px;
        }

        .channel-metrics {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }

        .metric-pill {
          display: flex;
          align-items: center;
          gap: 4px;
          padding: 4px 8px;
          background: rgba(156, 255, 0, 0.1);
          border: 1px solid rgba(156, 255, 0, 0.2);
          border-radius: 6px;
          font-size: 11px;
          color: #9cff00;
        }

        .channel-activity {
          width: 80px;
          height: 6px;
          background: rgba(42, 42, 42, 0.8);
          border-radius: 3px;
          overflow: hidden;
          flex-shrink: 0;
        }

        .activity-bar {
          height: 100%;
          background: linear-gradient(90deg, #9cff00 0%, #667eea 100%);
          border-radius: 3px;
          transition: width 0.3s;
        }

        .export-btn {
          width: 100%;
          padding: 14px;
          background: linear-gradient(135deg, #9cff00 0%, #667eea 100%);
          border: none;
          border-radius: 10px;
          color: #000;
          font-weight: 700;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          transition: all 0.3s;
          margin-top: 8px;
        }

        .export-btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 24px rgba(156, 255, 0, 0.4);
        }
      `}</style>
    </>
  );
};

export default AnalyticsSection;
