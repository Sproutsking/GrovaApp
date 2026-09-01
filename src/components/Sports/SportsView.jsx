// src/components/Sports/SportsView.jsx
// Live sports fixtures, scores, and videos

import React, { useState, useEffect } from "react";
import {
  Play, TrendingUp, Clock, Users, Target,
} from "lucide-react";
import sportsDataService from "../../services/sports/sportsDataService";

const SportsView = ({ currentUser, userId }) => {
  const [liveFixtures, setLiveFixtures] = useState([]);
  const [videos, setVideos] = useState([]);
  const [selectedLeague, setSelectedLeague] = useState(null);
  const [standings, setStandings] = useState([]);
  const [activeTab, setActiveTab] = useState("live"); // live, videos, standings
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadLiveData();
  }, []);

  const loadLiveData = async () => {
    setLoading(true);
    try {
      const [fixtures, vids] = await Promise.all([
        sportsDataService.getLiveFixtures(),
        sportsDataService.getVideos(),
      ]);
      setLiveFixtures(fixtures);
      setVideos(vids);
    } catch (err) {
      console.error("Failed to load sports data:", err);
    } finally {
      setLoading(false);
    }
  };

  const loadStandings = async (league) => {
    try {
      const data = await sportsDataService.getStandings(league);
      setStandings(data);
    } catch (err) {
      console.error("Failed to load standings:", err);
    }
  };

  const handleLeagueSelect = (league) => {
    setSelectedLeague(league);
    if (activeTab === "standings") {
      loadStandings(league);
    }
  };

  const getStatusColor = (status) => {
    if (status === "LIVE") return "#ef4444";
    if (status === "SCHEDULED") return "#f59e0b";
    return "#6b7280";
  };

  const majorLeagues = sportsDataService.getMajorLeagues();

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", paddingBottom: 80 }}>
      <style>{`
        .sports-view {
          padding: 12px;
        }
        .sports-header {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 20px;
          padding: 0 8px;
        }
        .sports-header h1 {
          margin: 0;
          font-size: 24px;
          font-weight: 800;
          color: var(--ink);
        }
        .sports-header .badge {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          background: #ef4444;
          color: white;
          padding: 4px 8px;
          border-radius: 6px;
          font-size: 11px;
          font-weight: 700;
          animation: pulse-badge 2s infinite;
        }
        @keyframes pulse-badge {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.7; }
        }
        .tabs-container {
          display: flex;
          gap: 2px;
          padding: 0 8px;
          margin-bottom: 16px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.06);
        }
        .tab-btn {
          padding: 10px 16px;
          border: none;
          background: transparent;
          color: rgba(255, 255, 255, 0.6);
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          border-bottom: 3px solid transparent;
          transition: all 0.2s;
        }
        .tab-btn.active {
          color: #84cc16;
          border-bottom-color: #84cc16;
        }
        .tab-btn:hover {
          color: rgba(255, 255, 255, 0.9);
        }
        .league-filter {
          display: flex;
          gap: 8px;
          padding: 0 8px 16px;
          overflow-x: auto;
          scrollbar-width: none;
        }
        .league-filter::-webkit-scrollbar {
          display: none;
        }
        .league-btn {
          padding: 8px 14px;
          border-radius: 20px;
          border: 1px solid rgba(255, 255, 255, 0.2);
          background: rgba(255, 255, 255, 0.05);
          color: rgba(255, 255, 255, 0.8);
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          white-space: nowrap;
          flex-shrink: 0;
          transition: all 0.2s;
        }
        .league-btn:hover,
        .league-btn.active {
          background: #84cc16;
          border-color: #84cc16;
          color: #1a1a1a;
        }
        .content-grid {
          display: grid;
          gap: 12px;
          padding: 0 8px;
        }
        .fixture-card {
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 14px;
          padding: 14px;
          cursor: pointer;
          transition: all 0.2s;
        }
        .fixture-card:hover {
          background: rgba(255, 255, 255, 0.06);
          border-color: rgba(132, 204, 22, 0.3);
          transform: translateY(-1px);
        }
        .fixture-card.live {
          border-color: rgba(239, 68, 68, 0.3);
          background: rgba(239, 68, 68, 0.05);
        }
        .fixture-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 10px;
        }
        .league-name {
          font-size: 11px;
          font-weight: 700;
          color: #9ca3af;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        .status-badge {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          padding: 4px 8px;
          border-radius: 4px;
          font-size: 10px;
          font-weight: 700;
          color: white;
        }
        .status-live {
          background: #ef4444;
        }
        .status-scheduled {
          background: #f59e0b;
        }
        .fixture-body {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
        }
        .team {
          flex: 1;
          text-align: center;
        }
        .team-name {
          font-size: 13px;
          font-weight: 700;
          color: #f1f5f9;
          margin-bottom: 4px;
        }
        .team-score {
          font-size: 28px;
          font-weight: 900;
          color: #84cc16;
        }
        .vs-minute {
          text-align: center;
          color: #9ca3af;
          font-size: 11px;
          font-weight: 600;
          flex-shrink: 0;
        }
        .vs-minute .minute {
          font-size: 16px;
          font-weight: 800;
          color: #fff;
        }
        .video-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
          gap: 12px;
          padding: 0 8px;
        }
        .video-card {
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 12px;
          overflow: hidden;
          cursor: pointer;
          transition: all 0.2s;
        }
        .video-card:hover {
          border-color: rgba(132, 204, 22, 0.3);
          transform: translateY(-2px);
        }
        .video-thumbnail {
          position: relative;
          width: 100%;
          padding-bottom: 56.25%;
          background: #000;
          overflow: hidden;
        }
        .video-thumbnail img {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
        .video-play-btn {
          position: absolute;
          inset: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(0, 0, 0, 0.4);
          opacity: 0;
          transition: opacity 0.2s;
        }
        .video-card:hover .video-play-btn {
          opacity: 1;
        }
        .play-icon {
          width: 48px;
          height: 48px;
          background: #ef4444;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
        }
        .video-info {
          padding: 12px;
        }
        .video-title {
          font-size: 12px;
          font-weight: 700;
          color: #f1f5f9;
          margin-bottom: 6px;
          line-height: 1.4;
        }
        .video-meta {
          display: flex;
          justify-content: space-between;
          font-size: 10px;
          color: #9ca3af;
        }
        .standings-table {
          width: 100%;
          border-collapse: collapse;
          padding: 0 8px;
        }
        .standings-table th,
        .standings-table td {
          padding: 10px;
          text-align: left;
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
          font-size: 12px;
        }
        .standings-table th {
          font-weight: 700;
          color: #9ca3af;
          text-transform: uppercase;
          font-size: 10px;
        }
        .standings-table td {
          color: #e5e7eb;
        }
        .standings-table tr:hover {
          background: rgba(255, 255, 255, 0.02);
        }
        .rank-cell {
          font-weight: 800;
          color: #84cc16;
          width: 30px;
        }
        .team-cell {
          flex: 1;
          font-weight: 600;
        }
        .stat-cell {
          text-align: center;
          color: #9ca3af;
          width: 40px;
        }
        .points-cell {
          font-weight: 800;
          color: #f1f5f9;
          width: 50px;
          text-align: center;
        }
        .loading {
          text-align: center;
          padding: 40px 20px;
          color: #9ca3af;
        }
      `}</style>

      <div className="sports-view">
        {/* Header */}
        <div className="sports-header">
          <TrendingUp size={24} color="#84cc16" />
          <h1>Live Sports</h1>
          <div className="badge">
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: "white" }} />
            LIVE
          </div>
        </div>

        {/* Tabs */}
        <div className="tabs-container">
          <button
            className={`tab-btn ${activeTab === "live" ? "active" : ""}`}
            onClick={() => setActiveTab("live")}
          >
            <Clock size={14} style={{ display: "inline", marginRight: 4 }} />
            Live Matches
          </button>
          <button
            className={`tab-btn ${activeTab === "videos" ? "active" : ""}`}
            onClick={() => setActiveTab("videos")}
          >
            <Play size={14} style={{ display: "inline", marginRight: 4 }} />
            Highlights
          </button>
          <button
            className={`tab-btn ${activeTab === "standings" ? "active" : ""}`}
            onClick={() => setActiveTab("standings")}
          >
            <Target size={14} style={{ display: "inline", marginRight: 4 }} />
            Standings
          </button>
        </div>

        {/* League Filter */}
        {(activeTab === "live" || activeTab === "standings") && (
          <div className="league-filter">
            <button
              className={`league-btn ${selectedLeague === null ? "active" : ""}`}
              onClick={() => handleLeagueSelect(null)}
            >
              All Leagues
            </button>
            {Object.entries(majorLeagues).map(([key, category]) =>
              category.leagues
                .filter(l => l.priority === 1)
                .map(league => (
                  <button
                    key={league.id}
                    className={`league-btn ${selectedLeague?.id === league.id ? "active" : ""}`}
                    onClick={() => handleLeagueSelect(league)}
                  >
                    {league.name}
                  </button>
                ))
            )}
          </div>
        )}

        {/* Live Fixtures Tab */}
        {activeTab === "live" && (
          <div className="content-grid">
            {loading ? (
              <div className="loading">Loading live matches...</div>
            ) : liveFixtures.length > 0 ? (
              liveFixtures.map(fixture => (
                <div
                  key={fixture.id}
                  className={`fixture-card ${fixture.status === "LIVE" ? "live" : ""}`}
                >
                  <div className="fixture-header">
                    <span className="league-name">{fixture.league}</span>
                    <span
                      className={`status-badge ${
                        fixture.status === "LIVE" ? "status-live" : "status-scheduled"
                      }`}
                    >
                      {fixture.status === "LIVE" ? "● LIVE" : "Scheduled"}
                    </span>
                  </div>
                  <div className="fixture-body">
                    <div className="team">
                      <div className="team-name">{fixture.home}</div>
                      <div className="team-score">{fixture.homeScore}</div>
                    </div>
                    <div className="vs-minute">
                      {fixture.status === "LIVE" ? (
                        <>
                          <div className="minute">{fixture.minute}'</div>
                          <div style={{ fontSize: 9, marginTop: 2 }}>LIVE</div>
                        </>
                      ) : (
                        <div style={{ fontSize: 11 }}>
                          {fixture.kickoffTime
                            ? new Date(fixture.kickoffTime).toLocaleTimeString([], {
                                hour: "2-digit",
                                minute: "2-digit",
                              })
                            : "vs"}
                        </div>
                      )}
                    </div>
                    <div className="team">
                      <div className="team-name">{fixture.away}</div>
                      <div className="team-score">{fixture.awayScore}</div>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="loading">No live matches at the moment</div>
            )}
          </div>
        )}

        {/* Videos Tab */}
        {activeTab === "videos" && (
          <div className="video-grid">
            {videos.map(video => (
              <div key={video.id} className="video-card">
                <div className="video-thumbnail">
                  <img src={video.thumbnail} alt={video.title} />
                  <div className="video-play-btn">
                    <div className="play-icon">
                      <Play size={24} />
                    </div>
                  </div>
                </div>
                <div className="video-info">
                  <div className="video-title">{video.title}</div>
                  <div className="video-meta">
                    <span>{video.views} views</span>
                    <span>{video.uploadedAt}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Standings Tab */}
        {activeTab === "standings" && standings.length > 0 && (
          <div style={{ overflowX: "auto" }}>
            <table className="standings-table">
              <thead>
                <tr>
                  <th className="rank-cell">Rank</th>
                  <th className="team-cell">Team</th>
                  <th className="stat-cell">P</th>
                  <th className="stat-cell">W</th>
                  <th className="stat-cell">D</th>
                  <th className="stat-cell">L</th>
                  <th className="points-cell">Pts</th>
                </tr>
              </thead>
              <tbody>
                {standings.map(row => (
                  <tr key={row.rank}>
                    <td className="rank-cell">{row.rank}</td>
                    <td className="team-cell">{row.team}</td>
                    <td className="stat-cell">{row.played}</td>
                    <td className="stat-cell">{row.wins}</td>
                    <td className="stat-cell">{row.draws}</td>
                    <td className="stat-cell">{row.losses}</td>
                    <td className="points-cell">{row.points}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default SportsView;
