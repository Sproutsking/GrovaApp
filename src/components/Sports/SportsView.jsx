// src/components/Sports/SportsView.jsx
// Live sports fixtures, scores, and videos

import React, { useState, useEffect, useMemo } from "react";
import {
  Play, Clock, Target, CalendarDays, ChevronDown, ChevronUp, Video, RefreshCw, X, ArrowLeft, ExternalLink,
} from "lucide-react";
import sportsDataService from "../../services/sports/sportsDataService";
import sportsYoutubeService from "../../services/sports/sportsYoutubeService";

const SportsView = ({ currentUser, userId, onClose }) => {
  const [liveFixtures, setLiveFixtures] = useState([]);
  const [selectedLeague, setSelectedLeague] = useState(null);
  const [activeSection, setActiveSection] = useState(null);
  const [fixtureWindow, setFixtureWindow] = useState("7d");
  const [loading, setLoading] = useState(false);
  const [clips, setClips] = useState([]);
  const [selectedStats, setSelectedStats] = useState(null);
  const [selectedMatch, setSelectedMatch] = useState(null);
  const [selectedSource, setSelectedSource] = useState(null);
  const [videoError, setVideoError] = useState(false);

  useEffect(() => {
    loadLiveData();
    loadClips();
    const refreshTimer = window.setInterval(loadLiveData, 30000);

    const unsubscribe = sportsDataService.subscribeToLiveFixtures(() => {
      loadLiveData();
    });

    return () => {
      window.clearInterval(refreshTimer);
      unsubscribe?.();
    };
  }, []);

  const loadLiveData = async () => {
    setLoading(true);
    try {
      const fixtures = await sportsDataService.getLiveFixtures(30);
      setLiveFixtures(fixtures);
    } catch (err) {
      console.error("Failed to load sports data:", err);
    } finally {
      setLoading(false);
    }
  };

  const loadClips = async () => {
    try {
      const videos = await sportsDataService.getVideos();
      const today = new Date().toDateString();
      const todayClips = videos.filter((video) => video.uploadedAt && new Date(video.uploadedAt).toDateString() === today);
      setClips(todayClips.length ? todayClips : videos.slice(0, 12));
    } catch (err) {
      console.error("Failed to load sports clips:", err);
      setClips([]);
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
  const scoreFixtures = useMemo(() => {
    const cutoff = Date.now() - 48 * 60 * 60 * 1000;
    return visibleFixtures.filter((fixture) => {
      if (fixture.status === "LIVE") return true;
      if (fixture.status !== "COMPLETED") return false;
      return new Date(fixture.startedAt || fixture.kickoffTime || 0).getTime() >= cutoff;
    });
  }, [visibleFixtures]);
  const scheduledFixtures = useMemo(
    () => visibleFixtures.filter((fixture) => fixture.status === "SCHEDULED"),
    [visibleFixtures],
  );
  const filteredScheduledFixtures = useMemo(() => {
    if (fixtureWindow === "all") return scheduledFixtures;
    const days = fixtureWindow === "today" || fixtureWindow === "tomorrow" ? 1 : fixtureWindow === "month" ? 30 : fixtureWindow === "season" ? 365 : 7;
    const now = Date.now();
    return scheduledFixtures.filter((fixture) => {
      const timestamp = new Date(fixture.kickoffTime || fixture.startedAt || 0).getTime();
      if (fixtureWindow === "today") {
        return new Date(timestamp).toDateString() === new Date(now).toDateString();
      }
      if (fixtureWindow === "tomorrow") {
        return new Date(timestamp).toDateString() === new Date(now + 24 * 60 * 60 * 1000).toDateString();
      }
      return timestamp >= now && timestamp <= now + days * 24 * 60 * 60 * 1000;
    });
  }, [fixtureWindow, scheduledFixtures]);
  const activeMatch = liveMatches[0];

  const sectionCards = [
    {
      id: "score",
      icon: Target,
      label: "Live Score",
      detail: scoreFixtures.length ? `${scoreFixtures.length} current score${scoreFixtures.length === 1 ? "" : "s"}` : "No scores available yet",
      accent: "#34d399",
      value: scoreFixtures.length,
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
    {
      id: "clips",
      icon: Video,
      label: "Match Clips",
      detail: clips.length ? `${clips.length} highlights today` : "Fresh match moments",
      accent: "#fbbf24",
      value: clips.length,
    },
  ];

  const formatMatchDate = (value) => value
    ? new Date(value).toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" })
    : "Date to be confirmed";

  const getMatchStats = (fixture) => {
    const competitors = fixture.raw?.competitions?.[0]?.competitors || [];
    return competitors.flatMap((competitor) => (competitor.statistics || []).slice(0, 4).map((stat) => ({
      team: competitor.team?.shortDisplayName || competitor.team?.displayName || competitor.homeAway,
      name: stat.name || stat.label,
      value: stat.displayValue || stat.value,
    })));
  };

  const openMatchViewer = (match, source = null) => {
    const sources = match?.videoSources || match?.sources || (match?.streamUrl ? [{ id: `${match.id}-source`, label: "Broadcast", url: match.streamUrl }] : []);
    setSelectedMatch({ ...match, videoSources: sources });
    setSelectedSource(source || sources[0] || null);
    setVideoError(false);
  };

  const sourceIsVideoFile = (url) => /\.(mp4|webm|mov|m3u8)(?:[?#]|$)/i.test(url || "");

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", paddingBottom: 80 }}>
      <style>{`
        .sports-view {
          width: min(100% - 32px, 1280px);
          margin: 0 auto;
          padding: 20px 0 80px;
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
          grid-template-columns: repeat(auto-fit, minmax(min(100%, 420px), 1fr));
          gap: 12px;
          width: 100%;
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
        .status-final {
          background: #334155;
        }
        .status-date {
          background: #050505;
          border: 1px solid #fbbf24;
          color: #fbbf24;
        }
        .fixture-body {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
        }
        .fixture-expand {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          width: 100%;
          margin-top: 14px;
          padding: 9px 10px;
          border: 1px solid rgba(132, 204, 22, 0.32);
          border-radius: 8px;
          background: rgba(0, 0, 0, 0.32);
          color: #bef264;
          font-size: 11px;
          font-weight: 800;
          cursor: pointer;
          justify-content: center;
        }
        .fixture-expand:hover { border-color: #84cc16; background: rgba(132, 204, 22, 0.1); }
        .fixture-stats { margin-top: 10px; padding: 10px; border-top: 1px solid rgba(255,255,255,.08); background: rgba(0,0,0,.18); border-radius: 8px; }
        .fixture-stats-head, .fixture-stat-row { display: flex; justify-content: space-between; gap: 10px; font-size: 10px; }
        .fixture-stats-head { color: #84cc16; font-weight: 800; margin-bottom: 8px; }
        .fixture-stats-head span:last-child { color: #64748b; font-weight: 600; }
        .fixture-stat-row { padding: 7px 0; border-bottom: 1px solid rgba(255,255,255,.06); color: #94a3b8; }
        .fixture-stat-row strong { color: #f8fafc; }
        .fixture-stat-empty { display: flex; align-items: center; gap: 6px; color: #94a3b8; font-size: 10px; line-height: 1.5; }
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
          padding: 0 0 18px;
        }
        .sports-section-card {
          flex: 1 1 240px;
          min-width: 0;
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
          padding: 0 0 16px;
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
          display: none;
        }
        .sports-controls {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 0 0 16px;
          overflow-x: auto;
          scrollbar-width: none;
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
          min-width: 0;
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
        .live-video-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 14px; }
        .live-video-card { padding: 0; overflow: hidden; border: 1px solid rgba(248,113,113,.3); border-radius: 14px; background: #080808; color: #fff; text-align: left; cursor: pointer; }
        .live-video-card:hover { border-color: #f87171; transform: translateY(-2px); }
        .live-video-thumb { position: relative; aspect-ratio: 16 / 9; display: grid; place-items: center; background: linear-gradient(135deg,#1f2937,#080808); }
        .live-video-thumb img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
        .live-video-placeholder { color: #f87171; }
        .live-video-badge { position: absolute; top: 10px; left: 10px; padding: 5px 8px; border-radius: 5px; background: #dc2626; font-size: 10px; font-weight: 900; }
        .live-video-play { position: absolute; display: grid; place-items: center; width: 48px; height: 48px; border-radius: 50%; background: rgba(239,68,68,.9); }
        .live-video-copy { display: grid; gap: 5px; padding: 12px; }.live-video-copy strong { font-size: 13px; }.live-video-copy span,.live-video-unavailable span { color: #94a3b8; font-size: 10px; }
        .live-video-unavailable { display: grid; gap: 6px; padding: 18px; border: 1px dashed rgba(248,113,113,.35); border-radius: 14px; background: rgba(248,113,113,.04); }
        .video-card { text-align: left; }
        .sports-modal-backdrop { position: fixed; inset: 0; z-index: 10050; display: grid; place-items: center; padding: 20px; background: rgba(0,0,0,.76); backdrop-filter: blur(14px); }
        .sports-stats-modal,.sports-viewer-modal { position: relative; width: min(720px,100%); max-height: min(850px,calc(100vh - 40px)); overflow: auto; padding: 24px; border: 1px solid rgba(132,204,22,.3); border-radius: 18px; background: #0b0f0d; color: #f8fafc; box-shadow: 0 25px 90px rgba(0,0,0,.55); }
        .sports-viewer-modal { width: min(980px,100%); }.sports-modal-close { display: inline-grid; place-items: center; width: 34px; height: 34px; border: 1px solid rgba(255,255,255,.14); border-radius: 9px; background: rgba(255,255,255,.06); color: #fff; cursor: pointer; }.sports-stats-modal > .sports-modal-close { position: absolute; top: 18px; right: 18px; }
        .sports-modal-kicker { color: #84cc16; font-size: 10px; font-weight: 900; letter-spacing: .12em; text-transform: uppercase; }.sports-stats-modal h2,.sports-viewer-copy h2 { margin: 12px 48px 6px 0; font-size: clamp(20px,3vw,30px); }.sports-stats-modal h2 b { color: #bef264; }.sports-stats-modal h2 span { color: #64748b; font-size: 13px; }.sports-modal-muted { margin: 0; color: #94a3b8; font-size: 12px; }.fixture-stats-modal { margin-top: 22px; }
        .sports-viewer-head { display: flex; justify-content: space-between; align-items: center; }.sports-viewer-back { display: inline-flex; align-items: center; gap: 7px; border: 0; background: transparent; color: #bef264; font-size: 12px; font-weight: 800; cursor: pointer; }.sports-source-tabs { display: flex; gap: 8px; margin: 18px 0 12px; overflow-x: auto; }.sports-source-tabs button { flex: 0 0 auto; padding: 9px 12px; border: 1px solid rgba(255,255,255,.14); border-radius: 8px; background: #050505; color: #cbd5e1; font-size: 11px; font-weight: 800; cursor: pointer; }.sports-source-tabs button.active { border-color: #84cc16; color: #bef264; background: rgba(132,204,22,.1); }.sports-player-shell { overflow: hidden; min-height: 260px; border-radius: 12px; background: #000; }.sports-player-shell iframe,.sports-player-shell video { display: block; width: 100%; aspect-ratio: 16 / 9; border: 0; }.sports-player-error { min-height: 260px; display: grid; place-content: center; justify-items: center; gap: 8px; color: #fbbf24; text-align: center; }.sports-player-error span { color: #94a3b8; font-size: 12px; }
        @media (max-width: 600px) {
          .sports-view { width: min(100% - 24px, 1280px); padding-top: 14px; }
          .sports-section-cards { flex-direction: column; }
          .sports-section-card { width: 100%; }
          .sports-controls { flex-direction: row; align-items: center; }
          .sports-control { flex: 0 0 auto; }
          .sports-filter-select { width: auto; }
          .sports-modal-backdrop { padding: 0; place-items: stretch; }.sports-stats-modal,.sports-viewer-modal { width: 100%; max-height: none; min-height: 100dvh; border: 0; border-radius: 0; padding: 18px 14px calc(18px + env(safe-area-inset-bottom, 0px)); }.sports-viewer-modal { display: flex; flex-direction: column; justify-content: flex-start; }.sports-player-shell { margin-top: auto; margin-bottom: auto; width: 100%; }.sports-viewer-copy h2 { font-size: 24px; }
        }
      `}</style>

      <div className="sports-view">
        <div className="sports-detail-header">
          <button type="button" className="sports-back-button" onClick={() => activeSection ? setActiveSection(null) : onClose?.()} aria-label={activeSection ? "Back to sports sections" : "Back"}>
            <span aria-hidden="true">&#8592;</span>
          </button>
          <h1 className="sports-detail-title">
            {activeSection ? sectionCards.find((card) => card.id === activeSection)?.label || "Sports" : "Sports"}
          </h1>
        </div>
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

        {activeSection === "live" && liveMatches.length > 0 && (
          <div className="live-video-grid">
            {liveMatches.map((match) => (match.videoSources?.length || match.streamUrl ? (
              <button type="button" className="live-video-card" key={match.id} onClick={() => openMatchViewer(match)}>
                <div className="live-video-thumb">
                  {match.thumbnail ? <img src={match.thumbnail} alt="" loading="lazy" /> : <span className="live-video-placeholder"><Play size={30} fill="currentColor" /></span>}
                  <span className="live-video-badge">● LIVE</span><span className="live-video-play"><Play size={20} fill="currentColor" /></span>
                </div>
                <div className="live-video-copy"><strong>{match.title}</strong><span>{match.league} · {match.videoSources?.length || 1} source{(match.videoSources?.length || 1) === 1 ? "" : "s"}</span></div>
              </button>
            ) : <div className="live-video-unavailable" key={match.id}><strong>{match.title}</strong><span>Live score is available, but no broadcast source is attached yet.</span></div>))}
          </div>
        )}

        {activeSection === "live" && liveMatches.length === 0 && (
          <div className="loading">No live matches are available right now. Live broadcasts appear here as soon as a verified source is available.</div>
        )}

        {activeSection === "fixtures" && (
          <>
            <div className="sports-controls">
              <label className="sports-control sports-filter-select">
                <CalendarDays size={15} />
                <select value={fixtureWindow} onChange={(event) => setFixtureWindow(event.target.value)} aria-label="Fixture time range">
                  <option value="today">Today</option>
                  <option value="tomorrow">Tomorrow</option>
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

        {activeSection === "clips" && (
          <div className="video-grid">
            {clips.length ? clips.map((clip) => (
              <button type="button" className="video-card" key={clip.id} onClick={() => openMatchViewer({ ...clip, title: clip.title, league: clip.league || "Sports", videoSources: clip.sources || [{ id: `${clip.id}-source`, label: "Video", url: clip.url }], thumbnail: clip.thumbnail })}>
                <div className="video-thumbnail">
                  {clip.thumbnail ? <img src={clip.thumbnail} alt="" loading="lazy" /> : <Video size={28} color="#fbbf24" />}
                  <span className="play-icon"><Play size={18} fill="currentColor" /></span>
                </div>
                <div className="video-info"><div className="video-title">{clip.title}</div><div className="video-meta"><span>{clip.league || "Sports"}</span><span>{clip.uploadedAt ? new Date(clip.uploadedAt).toLocaleDateString() : "Recent"}</span></div></div>
              </button>
            )) : <div className="loading">No match clips are available today yet.</div>}
          </div>
        )}

        {/* Live Fixtures Tab */}
        {activeSection && activeSection !== "clips" && activeSection !== "live" && (
          <div className="content-grid">
            {loading ? (
              <div className="loading">Loading sports data...</div>
            ) : (activeSection === "score" ? scoreFixtures : activeSection === "live" ? liveMatches : filteredScheduledFixtures).length > 0 ? (
              (activeSection === "score" ? scoreFixtures : activeSection === "live" ? liveMatches : filteredScheduledFixtures).map(fixture => (
                <div
                  key={fixture.id}
                  className={`fixture-card ${fixture.status === "LIVE" ? "live" : ""}`}
                >
                  <div className="fixture-header">
                    <span className="league-name">{fixture.league}</span>
                    {fixture.status === "LIVE" ? <span className="status-badge status-live">● LIVE</span> : fixture.status === "COMPLETED" ? <span className="status-badge status-final">Final</span> : <span className="status-badge status-date">{formatMatchDate(fixture.kickoffTime)}</span>}
                  </div>
                  <div className="fixture-body">
                    <div className="team">
                      <div className="team-name">{fixture.home}</div>
                      <div className="team-score">{fixture.homeScore ?? "-"}</div>
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
                      <div className="team-score">{fixture.awayScore ?? "-"}</div>
                    </div>
                  </div>
                  <button type="button" className="fixture-expand" onClick={() => setSelectedStats(fixture)}>
                    View full match stats <ExternalLink size={13} />
                  </button>
                </div>
              ))
            ) : (
              <div className="loading">
                {activeSection === "fixtures"
                  ? "No fixtures in this time window."
                  : activeSection === "score"
                      ? "No current scores are available right now."
                    : activeSection === "live"
                      ? "No live matches are available right now."
                      : "No sports data is available right now."}
              </div>
            )}
          </div>
        )}

      </div>

      {selectedStats && (
        <div className="sports-modal-backdrop" role="dialog" aria-modal="true" aria-label="Full match statistics" onClick={(event) => event.target === event.currentTarget && setSelectedStats(null)}>
          <section className="sports-stats-modal">
            <button type="button" className="sports-modal-close" onClick={() => setSelectedStats(null)} aria-label="Close match statistics"><X size={18} /></button>
            <span className="sports-modal-kicker">MATCH CENTRE · {selectedStats.league}</span>
            <h2>{selectedStats.home} <b>{selectedStats.homeScore ?? "-"}</b> <span>vs</span> <b>{selectedStats.awayScore ?? "-"}</b> {selectedStats.away}</h2>
            <p className="sports-modal-muted">{selectedStats.status === "LIVE" ? `Live now · ${selectedStats.minute || "Updating"}` : formatMatchDate(selectedStats.kickoffTime)}</p>
            <div className="fixture-stats fixture-stats-modal">{getMatchStats(selectedStats).length ? getMatchStats(selectedStats).map((stat, index) => <div className="fixture-stat-row" key={`${stat.name}-${index}`}><span>{stat.team} · {stat.name}</span><strong>{stat.value}</strong></div>) : <div className="fixture-stat-empty"><RefreshCw size={14} /> Detailed stats will appear as the provider publishes them.</div>}</div>
          </section>
        </div>
      )}

      {selectedMatch && (
        <div className="sports-modal-backdrop sports-viewer-backdrop" role="dialog" aria-modal="true" aria-label={`${selectedMatch.title} video viewer`} onClick={(event) => event.target === event.currentTarget && setSelectedMatch(null)}>
          <section className="sports-viewer-modal">
            <div className="sports-viewer-head"><button type="button" className="sports-viewer-back" onClick={() => setSelectedMatch(null)}><ArrowLeft size={17} /> <span>Back</span></button><button type="button" className="sports-modal-close" onClick={() => setSelectedMatch(null)} aria-label="Close video viewer"><X size={18} /></button></div>
            <div className="sports-viewer-copy"><span className="sports-modal-kicker">{selectedMatch.league} · {selectedMatch.status === "LIVE" ? "LIVE BROADCAST" : "MATCH VIDEO"}</span><h2>{selectedMatch.title}</h2><p className="sports-modal-muted">Choose a working source below. Each source loads independently.</p></div>
            {selectedMatch.videoSources?.length ? <div className="sports-source-tabs">{selectedMatch.videoSources.map((source) => <button type="button" key={source.id} className={selectedSource?.id === source.id ? "active" : ""} onClick={() => { setSelectedSource(source); setVideoError(false); }}>{source.label}</button>)}</div> : null}
            <div className="sports-player-shell">
              {selectedSource?.url && !videoError ? (sourceIsVideoFile(selectedSource.url) ? <video src={selectedSource.url} controls autoPlay playsInline poster={selectedMatch.thumbnail || undefined} onError={() => setVideoError(true)} /> : <iframe src={sportsYoutubeService.getEmbedUrl(selectedSource.url)} title={selectedMatch.title} allow="autoplay; encrypted-media; picture-in-picture" allowFullScreen onError={() => setVideoError(true)} />) : <div className="sports-player-error"><RefreshCw size={22} /><strong>Source unavailable</strong><span>That broadcast could not be loaded. Try another source above.</span></div>}
            </div>
          </section>
        </div>
      )}
    </div>
  );
};

export default SportsView;
