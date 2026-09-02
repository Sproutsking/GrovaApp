// src/services/sports/sportsDataService.js
// Live sports data service — fixtures, scores, videos for major leagues

import { supabase } from "../config/supabase";

const MAJOR_LEAGUES = {
  football: {
    name: "Football",
    leagues: [
      { id: "pl", name: "Premier League", country: "England", priority: 1 },
      { id: "laliga", name: "La Liga", country: "Spain", priority: 1 },
      { id: "serie_a", name: "Serie A", country: "Italy", priority: 1 },
      { id: "ligue1", name: "Ligue 1", country: "France", priority: 1 },
      { id: "bundesliga", name: "Bundesliga", country: "Germany", priority: 1 },
      { id: "champions_league", name: "Champions League", country: "Europe", priority: 2 },
      { id: "europa_league", name: "Europa League", country: "Europe", priority: 2 },
    ]
  },
  basketball: {
    name: "Basketball",
    leagues: [
      { id: "nba", name: "NBA", country: "USA", priority: 1 },
      { id: "euroleague", name: "EuroLeague", country: "Europe", priority: 2 },
    ]
  },
  cricket: {
    name: "Cricket",
    leagues: [
      { id: "ipl", name: "IPL", country: "India", priority: 1 },
      { id: "bbl", name: "Big Bash", country: "Australia", priority: 1 },
      { id: "psl", name: "PSL", country: "Pakistan", priority: 1 },
    ]
  },
  tennis: {
    name: "Tennis",
    leagues: [
      { id: "atp", name: "ATP", country: "World", priority: 1 },
      { id: "wta", name: "WTA", country: "World", priority: 1 },
      { id: "grand_slam", name: "Grand Slam", country: "World", priority: 1 },
    ]
  },
};

// Service methods
const sportsDataService = {
  // Live sessions are the app's current source of truth for live sports.
  getLiveFixtures: async () => {
    const { data, error } = await supabase
      .from("live_sessions")
      .select("*")
      .in("status", ["live", "scheduled"])
      .order("started_at", { ascending: false, nullsFirst: false })
      .limit(50);

    if (error) throw error;

    return (data || [])
      .filter((session) => isSportsSession(session))
      .map(normalizeSession);
  },

  // Completed sessions with a replay or YouTube URL become the highlights feed.
  getVideos: async () => {
    const { data, error } = await supabase
      .from("live_sessions")
      .select("*")
      .in("status", ["ended", "completed"])
      .order("ended_at", { ascending: false, nullsFirst: false })
      .limit(30);

    if (error) throw error;

    return (data || [])
      .filter((session) => isSportsSession(session) && getVideoUrl(session))
      .map((session) => ({
        ...normalizeSession(session),
        title: session.title || "Sports replay",
        url: getVideoUrl(session),
        thumbnail: session.thumbnail_url || session.thumbnail || "",
        uploadedAt: session.ended_at || session.updated_at || session.created_at,
      }));
  },

  // Get standings by league
  getStandings: async (league) => {
    return [];
  },

  // Get fixture details
  getFixtureDetails: async (fixtureId) => {
    const fixtures = await sportsDataService.getLiveFixtures();
    return fixtures.find((fixture) => fixture.id === fixtureId) || null;
  },

  // Get major leagues
  getMajorLeagues: () => MAJOR_LEAGUES,

  subscribeToLiveFixtures: (onChange) => {
    const channel = supabase
      .channel("sports_live_fixtures")
      .on("postgres_changes", { event: "*", schema: "public", table: "live_sessions" }, onChange)
      .subscribe();

    return () => supabase.removeChannel(channel);
  },

  // Filter fixtures by league
  filterByLeague: async (leagueName) => {
    const all = await sportsDataService.getLiveFixtures();
    return all.filter(f => f.league === leagueName);
  },

  // Get trending sports content
  getTrendingContent: async () => {
    const [fixtures, videos] = await Promise.all([
      sportsDataService.getLiveFixtures(),
      sportsDataService.getVideos(),
    ]);
    return { fixtures: fixtures.slice(0, 5), videos: videos.slice(0, 5), trending: [] };
  },
};

const SPORTS_TERMS = ["sport", "football", "soccer", "basketball", "cricket", "tennis", "match", "league", "cup"];

const isSportsSession = (session) => {
  const searchable = `${session?.title || ""} ${session?.category || ""}`.toLowerCase();
  return SPORTS_TERMS.some((term) => searchable.includes(term));
};

const getVideoUrl = (session) => session?.replay_url || session?.recording_url || session?.youtube_url || session?.stream_url || "";

const normalizeSession = (session) => ({
  id: session.id,
  title: session.title || "Live sports session",
  league: session.category || "Sports",
  home: session.home_team || session.home || session.title || "Home team",
  away: session.away_team || session.away || "Away team",
  homeScore: Number.isFinite(Number(session.home_score)) ? Number(session.home_score) : null,
  awayScore: Number.isFinite(Number(session.away_score)) ? Number(session.away_score) : null,
  status: String(session.status || "").toUpperCase(),
  startedAt: session.started_at || session.created_at || null,
  kickoffTime: session.kickoff_time || session.scheduled_at || session.start_time || session.started_at || null,
  updated: session.updated_at || session.started_at || session.created_at || null,
  streamUrl: session.stream_url || session.youtube_url || null,
  raw: session,
});

export default sportsDataService;
