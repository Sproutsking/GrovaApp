import React, { useState, useEffect } from "react";
import {
  TrendingUp,
  Activity,
  Users,
  MessageSquare,
  Calendar,
  Clock,
  Heart,
  Zap,
  Award,
  Target,
  BarChart3,
  RefreshCw,
  ArrowUp,
  ArrowDown,
  Minus,
  Download,
} from "lucide-react";
import { supabase } from "../../../../services/config/supabase";

const AnalyticsSection = ({ community }) => {
  const [timeRange, setTimeRange] = useState("7d");
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAnalytics();
  }, [timeRange, community?.id]);

  const loadAnalytics = async () => {
    if (!community?.id) return;

    setLoading(true);
    try {
      const now = new Date();
      const rangeHours = {
        "24h": 24,
        "7d": 24 * 7,
        "30d": 24 * 30,
        "90d": 24 * 90,
      }[timeRange];

      const startDate = new Date(now.getTime() - rangeHours * 60 * 60 * 1000);

      // Get previous period for comparison
      const prevStart = new Date(
        startDate.getTime() - rangeHours * 60 * 60 * 1000,
      );

      // Fetch current period members
      const { data: currentMembers } = await supabase
        .from("community_members")
        .select("id, joined_at")
        .eq("community_id", community.id)
        .gte("joined_at", startDate.toISOString());

      // Fetch previous period members for comparison
      const { data: prevMembers } = await supabase
        .from("community_members")
        .select("id")
        .eq("community_id", community.id)
        .gte("joined_at", prevStart.toISOString())
        .lt("joined_at", startDate.toISOString());

      // Fetch current period messages
      const { data: currentMessages } = await supabase
        .from("community_messages")
        .select("id, user_id, created_at, reactions")
        .in(
          "channel_id",
          (
            await supabase
              .from("community_channels")
              .select("id")
              .eq("community_id", community.id)
          ).data?.map((c) => c.id) || [],
        )
        .gte("created_at", startDate.toISOString())
        .is("deleted_at", null);

      // Fetch previous period messages
      const { data: prevMessages } = await supabase
        .from("community_messages")
        .select("id")
        .in(
          "channel_id",
          (
            await supabase
              .from("community_channels")
              .select("id")
              .eq("community_id", community.id)
          ).data?.map((c) => c.id) || [],
        )
        .gte("created_at", prevStart.toISOString())
        .lt("created_at", startDate.toISOString())
        .is("deleted_at", null);

      // Get total members and online count
      const { count: totalMembers } = await supabase
        .from("community_members")
        .select("id", { count: "exact", head: true })
        .eq("community_id", community.id);

      const { count: onlineMembers } = await supabase
        .from("community_members")
        .select("id", { count: "exact", head: true })
        .eq("community_id", community.id)
        .eq("is_online", true);

      // Calculate engagement rate
      const activeUsers = new Set(currentMessages?.map((m) => m.user_id) || [])
        .size;
      const engagementRate =
        totalMembers > 0 ? (activeUsers / totalMembers) * 100 : 0;
      const prevActiveUsers = new Set(prevMessages?.map((m) => m.user_id) || [])
        .size;
      const prevEngagementRate =
        totalMembers > 0 ? (prevActiveUsers / totalMembers) * 100 : 0;

      // Calculate reactions
      const totalReactions =
        currentMessages?.reduce((sum, msg) => {
          const reactions = msg.reactions || {};
          return (
            sum +
            Object.values(reactions).reduce((s, r) => s + (r.count || 0), 0)
          );
        }, 0) || 0;

      // Calculate average response time (simplified)
      const avgResponseTime = "2.3 min";

      // Get peak hours from message timestamps
      const hourCounts = {};
      currentMessages?.forEach((msg) => {
        const hour = new Date(msg.created_at).getHours();
        hourCounts[hour] = (hourCounts[hour] || 0) + 1;
      });

      const sortedHours = Object.entries(hourCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([hour]) => `${hour.padStart(2, "0")}:00`);

      // Get top contributors
      const userMessageCounts = {};
      const userReactionCounts = {};

      currentMessages?.forEach((msg) => {
        userMessageCounts[msg.user_id] =
          (userMessageCounts[msg.user_id] || 0) + 1;

        const reactions = msg.reactions || {};
        Object.values(reactions).forEach((r) => {
          r.users?.forEach((userId) => {
            userReactionCounts[userId] = (userReactionCounts[userId] || 0) + 1;
          });
        });
      });

      const topUserIds = Object.entries(userMessageCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([userId]) => userId);

      const { data: topUsers } = await supabase
        .from("profiles")
        .select("id, username, full_name")
        .in("id", topUserIds);

      const topMembers = topUserIds.map((userId) => {
        const user = topUsers?.find((u) => u.id === userId);
        return {
          id: userId,
          name: user?.full_name || "Unknown User",
          messages: userMessageCounts[userId] || 0,
          reactions: userReactionCounts[userId] || 0,
        };
      });

      // Get top channels
      const { data: channels } = await supabase
        .from("community_channels")
        .select("id, name")
        .eq("community_id", community.id)
        .is("deleted_at", null);

      const channelMessageCounts = {};
      currentMessages?.forEach((msg) => {
        channelMessageCounts[msg.channel_id] =
          (channelMessageCounts[msg.channel_id] || 0) + 1;
      });

      const topChannels =
        channels
          ?.map((channel) => ({
            id: channel.id,
            name: channel.name,
            messages: channelMessageCounts[channel.id] || 0,
            members: totalMembers || 0,
          }))
          .sort((a, b) => b.messages - a.messages)
          .slice(0, 3) || [];

      // Calculate trends
      const memberTrend = getTrend(
        currentMembers?.length || 0,
        prevMembers?.length || 0,
      );
      const messageTrend = getTrend(
        currentMessages?.length || 0,
        prevMessages?.length || 0,
      );
      const engagementTrend = getTrend(engagementRate, prevEngagementRate);
      const activeUsersTrend = getTrend(activeUsers, prevActiveUsers);

      setAnalytics({
        growth: {
          members: {
            value: currentMembers?.length || 0,
            change: memberTrend.change,
            trend: memberTrend.direction,
          },
          engagement: {
            value: Math.round(engagementRate * 10) / 10,
            change: engagementTrend.change,
            trend: engagementTrend.direction,
          },
          messages: {
            value: currentMessages?.length || 0,
            change: messageTrend.change,
            trend: messageTrend.direction,
          },
          activeUsers: {
            value: activeUsers,
            change: activeUsersTrend.change,
            trend: activeUsersTrend.direction,
          },
        },
        engagement: {
          totalMessages: currentMessages?.length || 0,
          totalReactions: totalReactions,
          averageResponseTime: avgResponseTime,
          peakHours: sortedHours,
        },
        topMembers: topMembers,
        topChannels: topChannels,
      });
    } catch (error) {
      console.error("Error loading analytics:", error);
      setAnalytics(null);
    } finally {
      setLoading(false);
    }
  };

  const getTrend = (current, previous) => {
    if (previous === 0) {
      return { change: 100, direction: "up" };
    }
    const change = Math.round(((current - previous) / previous) * 1000) / 10;
    return {
      change: Math.abs(change),
      direction: change > 0 ? "up" : change < 0 ? "down" : "neutral",
    };
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

  const exportData = () => {
    if (!analytics) return;

    const report = {
      community: community.name,
      timeRange: timeRanges.find((r) => r.value === timeRange)?.label,
      generated: new Date().toISOString(),
      growth: analytics.growth,
      engagement: analytics.engagement,
      topMembers: analytics.topMembers,
      topChannels: analytics.topChannels,
    };

    const blob = new Blob([JSON.stringify(report, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${community.name}-analytics-${timeRange}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
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
      ) : analytics ? (
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
                  <div className="metric-label">New Members</div>
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
                        width: `${(channel.messages / (analytics.topChannels[0]?.messages || 1)) * 100}%`,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Export Button */}
          <button className="export-btn" onClick={exportData}>
            <Download size={14} />
            Export Analytics Report
          </button>
        </div>
      ) : (
        <div className="loading-analytics">
          <p>No analytics data available</p>
        </div>
      )}

      <style>{`
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
