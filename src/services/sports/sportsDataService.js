// src/services/sports/sportsDataService.js
// Live sports data service — fixtures, scores, videos for major leagues

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

// Mock live fixtures data
const generateMockFixtures = () => {
  const now = new Date();
  const fixtures = [];
  
  // Simulated live matches from major leagues
  const mockGames = [
    {
      league: "Premier League",
      home: "Manchester United",
      away: "Liverpool",
      homeScore: 2,
      awayScore: 1,
      status: "LIVE",
      minute: 68,
      homeForm: [1, 1, 1, 0, 1],
      awayForm: [1, 1, 0, 1, 1],
    },
    {
      league: "La Liga",
      home: "Real Madrid",
      away: "Barcelona",
      homeScore: 1,
      awayScore: 2,
      status: "LIVE",
      minute: 45,
      homeForm: [1, 1, 1, 0, 1],
      awayForm: [1, 1, 1, 1, 0],
    },
    {
      league: "Serie A",
      home: "Juventus",
      away: "AC Milan",
      homeScore: 0,
      awayScore: 0,
      status: "LIVE",
      minute: 15,
      homeForm: [1, 0, 1, 1, 1],
      awayForm: [0, 1, 1, 1, 1],
    },
    {
      league: "Bundesliga",
      home: "Bayern Munich",
      away: "Borussia Dortmund",
      homeScore: 3,
      awayScore: 2,
      status: "LIVE",
      minute: 72,
      homeForm: [1, 1, 1, 1, 1],
      awayForm: [1, 0, 1, 0, 1],
    },
    {
      league: "Ligue 1",
      home: "PSG",
      away: "AS Monaco",
      homeScore: 2,
      awayScore: 0,
      status: "LIVE",
      minute: 38,
      homeForm: [1, 1, 1, 1, 0],
      awayForm: [0, 0, 1, 1, 1],
    },
    {
      league: "NBA",
      home: "Los Angeles Lakers",
      away: "Boston Celtics",
      homeScore: 105,
      awayScore: 98,
      status: "LIVE",
      quarter: 3,
      timeLeft: "5:30",
    },
    {
      league: "IPL",
      home: "Mumbai Indians",
      away: "Chennai Super Kings",
      homeScore: 156,
      awayScore: 142,
      status: "LIVE",
      ballsLeft: "3.2 overs",
    },
    {
      league: "Champions League",
      home: "Manchester City",
      away: "Inter Milan",
      homeScore: 1,
      awayScore: 1,
      status: "SCHEDULED",
      kickoffTime: new Date(now.getTime() + 2 * 60 * 60 * 1000), // In 2 hours
    },
  ];

  return mockGames.map((game, idx) => ({
    id: `fixture-${idx}`,
    ...game,
    updated: new Date(),
  }));
};

// Mock video data
const generateMockVideos = () => {
  return [
    {
      id: "video-1",
      title: "Manchester United vs Liverpool - Extended Highlights",
      league: "Premier League",
      duration: "12:45",
      views: "2.3M",
      thumbnail: "https://images.unsplash.com/photo-1461896836934-ffe607ba8211?w=300&h=200",
      uploadedAt: "2 hours ago",
    },
    {
      id: "video-2",
      title: "Cristiano Ronaldo - Latest Goals & Skills",
      league: "Premier League",
      duration: "8:20",
      views: "1.8M",
      thumbnail: "https://images.unsplash.com/photo-1489944908129-dfd3e0d1b6fe?w=300&h=200",
      uploadedAt: "4 hours ago",
    },
    {
      id: "video-3",
      title: "Real Madrid vs Barcelona - Full Match Replay",
      league: "La Liga",
      duration: "95:00",
      views: "3.2M",
      thumbnail: "https://images.unsplash.com/photo-1577280643335-a0e5b2976b2a?w=300&h=200",
      uploadedAt: "6 hours ago",
    },
    {
      id: "video-4",
      title: "NBA Top 10 Plays This Week",
      league: "NBA",
      duration: "10:15",
      views: "5.1M",
      thumbnail: "https://images.unsplash.com/photo-1546519638-68711109bb84?w=300&h=200",
      uploadedAt: "1 day ago",
    },
    {
      id: "video-5",
      title: "IPL 2024 - Biggest Sixes Compilation",
      league: "IPL",
      duration: "14:30",
      views: "4.7M",
      thumbnail: "https://images.unsplash.com/photo-1540747913ee1afdd01c20b4f49d65431cf06de6?w=300&h=200",
      uploadedAt: "1 day ago",
    },
  ];
};

// Standings data by league
const generateStandings = (league) => {
  const standings = {
    pl: [
      { rank: 1, team: "Manchester City", played: 15, wins: 13, draws: 1, losses: 1, points: 40 },
      { rank: 2, team: "Liverpool", played: 15, wins: 11, draws: 2, losses: 2, points: 35 },
      { rank: 3, team: "Arsenal", played: 15, wins: 10, draws: 3, losses: 2, points: 33 },
      { rank: 4, team: "Manchester United", played: 15, wins: 10, draws: 1, losses: 4, points: 31 },
      { rank: 5, team: "Aston Villa", played: 15, wins: 9, draws: 2, losses: 4, points: 29 },
    ],
    laliga: [
      { rank: 1, team: "Real Madrid", played: 16, wins: 13, draws: 1, losses: 2, points: 40 },
      { rank: 2, team: "Barcelona", played: 16, wins: 12, draws: 2, losses: 2, points: 38 },
      { rank: 3, team: "Atletico Madrid", played: 16, wins: 10, draws: 2, losses: 4, points: 32 },
      { rank: 4, team: "Sevilla", played: 16, wins: 9, draws: 2, losses: 5, points: 29 },
      { rank: 5, team: "Villarreal", played: 16, wins: 8, draws: 3, losses: 5, points: 27 },
    ],
  };
  return standings[league] || standings.pl;
};

// Service methods
const sportsDataService = {
  // Get live fixtures
  getLiveFixtures: async () => {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve(generateMockFixtures());
      }, 300);
    });
  },

  // Get videos
  getVideos: async () => {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve(generateMockVideos());
      }, 300);
    });
  },

  // Get standings by league
  getStandings: async (league) => {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve(generateStandings(league));
      }, 300);
    });
  },

  // Get fixture details
  getFixtureDetails: async (fixtureId) => {
    return new Promise((resolve) => {
      setTimeout(() => {
        const fixtures = generateMockFixtures();
        resolve(fixtures.find(f => f.id === fixtureId) || fixtures[0]);
      }, 300);
    });
  },

  // Get major leagues
  getMajorLeagues: () => MAJOR_LEAGUES,

  // Filter fixtures by league
  filterByLeague: async (leagueName) => {
    const all = await sportsDataService.getLiveFixtures();
    return all.filter(f => f.league === leagueName);
  },

  // Get trending sports content
  getTrendingContent: async () => {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({
          fixtures: generateMockFixtures().slice(0, 5),
          videos: generateMockVideos().slice(0, 5),
          trending: [
            { tag: "#ManUtd", trend: 1, mentions: "2.3M" },
            { tag: "#RealMadrid", trend: 2, mentions: "1.8M" },
            { tag: "#NBA", trend: 3, mentions: "1.5M" },
            { tag: "#IPL2024", trend: 4, mentions: "2.1M" },
          ]
        });
      }, 400);
    });
  },
};

export default sportsDataService;
