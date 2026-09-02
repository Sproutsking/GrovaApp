// src/components/Sports/SportsView.jsx
// Live sports fixtures, scores, and videos

import React, { useState, useEffect, useMemo } from "react";
import {
  Play, Clock, Target, CalendarDays,
} from "lucide-react";
import sportsDataService from "../../services/sports/sportsDataService";
import sportsYoutubeService from "../../services/sports/sportsYoutubeService";

const SportsView = ({ currentUser, userId }) => {
  const [liveFixtures, setLiveFixtures] = useState([]);
  const [selectedLeague, setSelectedLeague] = useState(null);
  const [activeSection, setActiveSection] = useState(null);
  const [fixtureWindow, setFixtureWindow] = useState("7d");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadLiveData();

    const unsubscribe = sportsDataService.subscribeToLiveFixtures(() => {
      loadLiveData();
    });

    return unsubscribe;
  }, []);

  const loadLiveData = async () => {
    setLoading(true);
    try {
      const fixtures = await sportsDataService.getLiveFixtures();
      setLiveFixtures(fixtures);
    } catch (err) {
      console.error("Failed to load sports data:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleLeagueSelect = (league) => {
    setSelectedLeague(league);
  };

  const majorLeagues = sportsDataService.getMajorLeagues();
  const visibleFixtures = useMemo(() => {
    if (!selectedLeague) return liveFixtures;
    return liveFixtures.filter((fixture) => fixture.league === selectedLeague.name);
  }, [liveFixtures, selectedLeague]);
  const liveMatches = useMemo(
    () => visibleFixtures.filter((fixture) => fixture.status === "LIVE"),
    [visibleFixtures],
  );
  const scheduledFixtures = useMemo(
    () => visibleFixtures.filter((fixture) => fixture.status === "SCHEDULED"),
    [visibleFixtures],
  );
  const filteredScheduledFixtures = useMemo(() => {
    if (fixtureWindow === "all") return scheduledFixtures;
    const days = fixtureWindow === "month" ? 30 : fixtureWindow === "season" ? 365 : 7;
    const now = Date.now();
    return scheduledFixtures.filter((fixture) => {
      const timestamp = new Date(fixture.kickoffTime || fixture.startedAt || 0).getTime();
      return timestamp >= now && timestamp <= now + days * 24 * 60 * 60 * 1000;
    });
  }, [fixtureWindow, scheduledFixtures]);
  const activeMatch = liveMatches[0];

  const sectionCards = [
    {
      id: "score",
      icon: Target,
      label: "Live Score",
      detail: liveMatches.length ? `${liveMatches.length} live match${liveMatches.length === 1 ? "" : "es"}` : "No live scores yet",
      accent: "#34d399",
      value: liveMatches.length,
    },
    {
      id: "live",
      icon: Play,
      label: "Live Match",
      detail: activeMatch?.title || "Watch an active match",
      accent: "#f87171",
      value: activeMatch ? "ON" : "--",
    },
    {
      id: "fixtures",
      icon: Clock,
      label: "Fixtures",
      detail: scheduledFixtures.length ? `${scheduledFixtures.length} scheduled` : "No fixtures yet",
      accent: "#60a5fa",
      value: scheduledFixtures.length,
    },
  ];

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", paddingBottom: 80 }}>
      <style>{`
        .sports-view {
          padding: 12px;
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
        .sports-section-cards {
          display: flex;
          flex-wrap: wrap;
          gap: 12px;
          padding: 0 8px 18px;
        }
        .sports-section-card {
          flex: 1 1 210px;
          min-width: 180px;
          min-height: 126px;
          padding: 16px;
          border: 1px solid rgba(148, 163, 184, 0.2);
          border-radius: 14px;
          color: #f8fafc;
          text-align: left;
          cursor: pointer;
          transition: transform 0.2s, border-color 0.2s, background 0.2s;
        }
        .sports-section-card:hover {
          transform: translateY(-2px);
          border-color: var(--card-accent);
          background: rgba(255, 255, 255, 0.07);
        }
        .sports-section-card-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 18px;
        }
        .sports-section-card-icon {
          display: grid;
          place-items: center;
          width: 34px;
          height: 34px;
          border-radius: 9px;
          color: var(--card-accent);
          background: color-mix(in srgb, var(--card-accent) 16%, transparent);
        }
        .sports-section-card-value {
          color: var(--card-accent);
          font-size: 20px;
          font-weight: 900;
        }
        .sports-section-card-label {
          font-size: 14px;
          font-weight: 800;
        }
        .sports-section-card-detail {
          margin-top: 4px;
          overflow: hidden;
          color: #94a3b8;
          font-size: 11px;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .sports-detail-header {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 0 8px 16px;
        }
        .sports-back-button {
          display: inline-grid;
          place-items: center;
          width: 36px;
          height: 36px;
          border: 1px solid rgba(148, 163, 184, 0.22);
          border-radius: 9px;
          background: rgba(255, 255, 255, 0.04);
          color: #f8fafc;
          cursor: pointer;
        }
        .sports-detail-title {
          margin: 0;
          color: #f8fafc;
          font-size: 16px;
          font-weight: 800;
        }
        .sports-detail-copy {
          margin: -4px 8px 16px;
          color: #94a3b8;
          font-size: 12px;
        }
        .sports-controls {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 0 8px 16px;
        }
        .sports-control {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          min-height: 34px;
          padding: 7px 11px;
          border: 1px solid rgba(148, 163, 184, 0.22);
          border-radius: 8px;
          background: rgba(255, 255, 255, 0.035);
          color: #cbd5e1;
          font-size: 11px;
          font-weight: 700;
          cursor: pointer;
        }
        .sports-control.active { border-color: #84cc16; background: rgba(132, 204, 22, 0.14); color: #bef264; }
        .sports-control select {
          border: 0;
          outline: 0;
          background: transparent;
          color: inherit;
          font: inherit;
          cursor: pointer;
        }
        .sports-control option { background: #111827; color: #f8fafc; }
        .sports-filter-select {
          min-width: 150px;
          justify-content: space-between;
        }
        .sports-watch {
          margin: 0 8px 16px;
          overflow: hidden;
          border: 1px solid rgba(248, 113, 113, 0.28);
          border-radius: 14px;
          background: #050505;
        }
        .sports-watch iframe {
          display: block;
          width: 100%;
          aspect-ratio: 16 / 9;
          border: 0;
        }
        @media (max-width: 600px) {
          .sports-section-cards { flex-direction: column; }
          .sports-section-card { width: 100%; min-width: 0; }
          .sports-controls { flex-direction: column; align-items: stretch; }
          .sports-filter-select { width: 100%; }
        }
      `}</style>

      <div className="sports-view">
        {!activeSection && (
          <div className="sports-section-cards" aria-label="Sports sections">
            {sectionCards.map(({ id, icon: Icon, label, detail, accent, value }) => (
              <button
                key={id}
                type="button"
                className="sports-section-card"
                style={{ "--card-accent": accent, background: `${accent}0d` }}
                onClick={() => setActiveSection(id)}
              >
                <div className="sports-section-card-top">
                  <span className="sports-section-card-icon"><Icon size={18} /></span>
                  <span className="sports-section-card-value">{value}</span>
                </div>
                <div className="sports-section-card-label">{label}</div>
                <div className="sports-section-card-detail">{detail}</div>
              </button>
            ))}
          </div>
        )}

        {activeSection && (
          <div className="sports-detail-header">
            <button type="button" className="sports-back-button" onClick={() => setActiveSection(null)} aria-label="Back to sports sections">
              <span aria-hidden="true">&#8592;</span>
            </button>
            <h2 className="sports-detail-title">
              {sectionCards.find((card) => card.id === activeSection)?.label || "Sports"}
            </h2>
          </div>
        )}

        {activeSection === "live" && activeMatch?.streamUrl && (
          <div className="sports-watch">
            <iframe
              src={sportsYoutubeService.getEmbedUrl(activeMatch.streamUrl)}
              title={`${activeMatch.title} live stream`}
              allow="autoplay; encrypted-media; picture-in-picture"
              allowFullScreen
            />
          </div>
        )}

        {activeSection === "live" && !activeMatch?.streamUrl && liveMatches.length > 0 && (
          <div className="loading">Live matches are available, but no broadcast has been attached yet.</div>
        )}

        {activeSection === "fixtures" && (
          <>
            <div className="sports-detail-copy">Upcoming matches from the selected time window.</div>
            <div className="sports-controls">
              <label className="sports-control sports-filter-select">
                <CalendarDays size={15} />
                <select value={fixtureWindow} onChange={(event) => setFixtureWindow(event.target.value)} aria-label="Fixture time range">
                  <option value="7d">Next 7 days</option>
                  <option value="month">Next month</option>
                  <option value="season">Next year</option>
                  <option value="all">All upcoming</option>
                </select>
              </label>
              <label className="sports-control sports-filter-select">
                League
                <select value={selectedLeague?.id || "all"} onChange={(event) => handleLeagueSelect(event.target.value === "all" ? null : Object.values(majorLeagues).flatMap((category) => category.leagues).find((league) => league.id === event.target.value))} aria-label="Fixture league">
                  <option value="all">All leagues</option>
                  {Object.values(majorLeagues).flatMap((category) => category.leagues).map((league) => <option key={league.id} value={league.id}>{league.name}</option>)}
                </select>
              </label>
            </div>
          </>
        )}

        {activeSection === "score" && <div className="sports-detail-copy">Live scores update automatically as match events arrive.</div>}

        {/* Live Fixtures Tab */}
        {activeSection && (
          <div className="content-grid">
            {loading ? (
              <div className="loading">Loading sports data...</div>
            ) : (activeSection === "score" || activeSection === "live" ? liveMatches : filteredScheduledFixtures).length > 0 ? (
              (activeSection === "score" || activeSection === "live" ? liveMatches : filteredScheduledFixtures).map(fixture => (
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
              <div className="loading">
                {activeSection === "fixtures"
                  ? "No fixtures in this time window."
                  : activeSection === "score"
                    ? "No live scores are available right now."
                    : activeSection === "live"
                      ? "No live matches are available right now."
                      : "No sports data is available right now."}
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
};

export default SportsView;
