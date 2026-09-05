// src/services/boost/boostThemes.js
// ============================================================================
// BOOST THEME SYSTEM — Design options per tier
//
// Silver  → 1 theme  (Moonlit Chrome) — no choice needed
// Gold    → 2 themes (Dynasty | Solar Flare)
// Diamond → 5 themes (Cosmos | Glacier | Emerald | Rose | Void)
//
// Each theme defines:
//   id, tier, name, emoji, tagline
//   avatar: ring border/shadow/animation  (applied to BoostAvatarRing)
//   card:   background CSS injected into profile card wrappers
//   frame:  border/shadow CSS on the card container
//   keyframes: CSS animation strings to inject once via BoostStyles
//   preview: gradient string for thumbnail display in picker
// ============================================================================

// ── SILVER THEMES ─────────────────────────────────────────────────────────
export const SILVER_THEMES = [
  {
    id:      "silver-chrome",
    tier:    "silver",
    name:    "Moonlit Chrome",
    emoji:   "🌙",
    tagline: "Soft chrome shimmer",
    preview: "linear-gradient(135deg,#111114 0%,#2a2a30 40%,#111114 100%)",

    // Avatar ring styles
    avatar: {
      border:     "2.5px solid #c0c0c0",
      boxShadow:  "0 0 0 3px rgba(192,192,192,0.25), 0 0 24px rgba(210,210,210,0.6), 0 0 48px rgba(192,192,192,0.28)",
      animation:  "silverPulse 3s ease-in-out infinite",
    },

    // Profile card background — rich layered moonlit chrome
    card: {
      background: `
        radial-gradient(ellipse 75% 45% at 50% -5%,  rgba(220,220,235,0.14) 0%, transparent 60%),
        radial-gradient(ellipse 55% 40% at 10% 15%,  rgba(192,192,215,0.11) 0%, transparent 55%),
        radial-gradient(ellipse 55% 40% at 90% 15%,  rgba(192,192,215,0.11) 0%, transparent 55%),
        radial-gradient(ellipse 40% 35% at 50% 108%, rgba(150,150,175,0.10) 0%, transparent 55%),
        radial-gradient(ellipse 30% 25% at 22% 52%,  rgba(180,180,205,0.07) 0%, transparent 45%),
        radial-gradient(ellipse 30% 25% at 78% 52%,  rgba(180,180,205,0.07) 0%, transparent 45%),
        #07070b
      `.replace(/\s+/g," ").trim(),
    },

    // Card border/frame — visible chrome glow
    frame: {
      border:     "1.5px solid rgba(200,200,218,0.45)",
      boxShadow:  "0 0 0 1px rgba(255,255,255,0.07), inset 0 0 44px rgba(192,192,215,0.09), 0 8px 56px rgba(0,0,0,0.75), 0 0 60px rgba(192,192,215,0.20)",
    },

    // Overlay: animated chrome sheen sweep
    overlay: {
      type:           "sheen",
      background:     "linear-gradient(110deg, transparent 20%, rgba(255,255,255,0.05) 36%, rgba(230,230,248,0.11) 50%, rgba(255,255,255,0.05) 64%, transparent 80%)",
      backgroundSize: "300% 100%",
      animation:      "silverSheen 5s ease-in-out infinite",
    },

    keyframes: `
      @keyframes silverPulse {
        0%,100% { box-shadow: 0 0 0 3px rgba(192,192,192,0.22), 0 0 24px rgba(210,210,220,0.55), 0 0 48px rgba(192,192,210,0.24); }
        50%     { box-shadow: 0 0 0 4px rgba(255,255,255,0.36),  0 0 38px rgba(228,228,240,0.82), 0 0 72px rgba(200,200,220,0.42); }
      }
      @keyframes silverSheen {
        0%   { background-position: -200% center; }
        100% { background-position:  300% center; }
      }
      @keyframes silverGrid {
        0%,100% { opacity: 0.07; }
        50%     { opacity: 0.16; }
      }
      @keyframes silverStarTwinkle {
        0%,100% { opacity: var(--op, 0.2); transform: scale(1); }
        50%     { opacity: calc(var(--op, 0.2) * 2.2); transform: scale(1.4); }
      }
    `,

    // Floating chrome sparkle shapes
    floatingShapes: [
      { char:"✦", size:10, top:"11%",  left:"8%",   opacity:0.24, blur:0,   anim:"silverStarTwinkle", dur:"3.8s", delay:"0s"   },
      { char:"✦", size:6,  top:"26%",  left:"83%",  opacity:0.18, blur:0,   anim:"silverStarTwinkle", dur:"5.2s", delay:"1.0s" },
      { char:"✦", size:8,  top:"56%",  left:"13%",  opacity:0.18, blur:0,   anim:"silverStarTwinkle", dur:"4.5s", delay:"2.1s" },
      { char:"✦", size:5,  top:"73%",  left:"71%",  opacity:0.20, blur:0,   anim:"silverStarTwinkle", dur:"6.0s", delay:"0.6s" },
      { char:"✦", size:7,  top:"40%",  left:"49%",  opacity:0.13, blur:1,   anim:"silverStarTwinkle", dur:"7.0s", delay:"3.2s" },
      { char:"✦", size:5,  top:"88%",  left:"55%",  opacity:0.16, blur:0,   anim:"silverStarTwinkle", dur:"4.8s", delay:"1.8s" },
      { char:"·", size:14, top:"19%",  left:"61%",  opacity:0.32, blur:0,   anim:"drift2",            dur:"4.5s", delay:"1.5s" },
      { char:"·", size:14, top:"80%",  left:"29%",  opacity:0.26, blur:0,   anim:"drift3",            dur:"5.0s", delay:"2.5s" },
      { char:"·", size:10, top:"47%",  left:"90%",  opacity:0.20, blur:0,   anim:"drift4",            dur:"6.2s", delay:"0.3s" },
    ],
  },
  {
    id:      "silver-mercury",
    tier:    "silver",
    name:    "Liquid Mercury",
    emoji:   "◈",
    tagline: "Polished steel with a liquid edge",
    preview: "linear-gradient(135deg,#090b10 0%,#64748b 48%,#111827 100%)",
    avatar: {
      border:     "2.5px solid #e2e8f0",
      boxShadow:  "0 0 0 3px rgba(226,232,240,0.24), 0 0 26px rgba(148,163,184,0.7), 0 0 52px rgba(226,232,240,0.24)",
      animation:  "silverPulse 3.4s ease-in-out infinite",
    },
    card: {
      background: "linear-gradient(135deg, rgba(226,232,240,0.13), transparent 28%), linear-gradient(315deg, rgba(100,116,139,0.2), transparent 42%), #080b11",
    },
    frame: {
      border:     "1.5px solid rgba(226,232,240,0.5)",
      boxShadow:  "0 0 0 1px rgba(255,255,255,0.08), inset 0 0 42px rgba(148,163,184,0.12), 0 8px 56px rgba(0,0,0,0.78), 0 0 58px rgba(148,163,184,0.22)",
    },
    overlay: {
      type:           "sheen",
      background:     "linear-gradient(118deg, transparent 22%, rgba(255,255,255,0.06) 42%, rgba(255,255,255,0.18) 50%, rgba(255,255,255,0.06) 58%, transparent 78%)",
      backgroundSize: "260% 100%",
      animation:      "silverSheen 5.5s ease-in-out infinite",
    },
    keyframes: "",
  },
];

// ── GOLD THEMES ───────────────────────────────────────────────────────────
export const GOLD_THEMES = [
  {
    id:      "gold-dynasty",
    tier:    "gold",
    name:    "Royal Dynasty",
    emoji:   "👑",
    tagline: "Ancient gold — warm & powerful",
    preview: "linear-gradient(135deg,#2a1a00 0%,#4a2d00 40%,#1a0f00 100%)",

    avatar: {
      border:    "2.5px solid #fbbf24",
      boxShadow: "0 0 0 3px rgba(251,191,36,0.28), 0 0 28px rgba(251,191,36,0.65), 0 0 56px rgba(251,191,36,0.28)",
      animation: "goldShimmer 2.5s ease-in-out infinite",
    },

    card: {
      background: `
        radial-gradient(ellipse at 50% 0%,   rgba(251,191,36,0.18) 0%, transparent 55%),
        radial-gradient(ellipse at 0%  100%, rgba(146,64,14,0.16)  0%, transparent 50%),
        radial-gradient(ellipse at 100% 50%, rgba(217,119,6,0.11)  0%, transparent 50%),
        #060400
      `.replace(/\s+/g," ").trim(),
    },

    frame: {
      border:    "1.5px solid rgba(251,191,36,0.5)",
      boxShadow: "0 0 0 1px rgba(254,240,138,0.08), inset 0 0 32px rgba(251,191,36,0.07), 0 8px 48px rgba(0,0,0,0.7), 0 0 56px rgba(251,191,36,0.18)",
    },

    overlay: {
      type:      "beam",
      // rendered as React element — two sweeping light beams
    },

    keyframes: `
      @keyframes goldShimmer {
        0%,100% {
          box-shadow: 0 0 0 2px rgba(251,191,36,0.2), 0 0 28px rgba(251,191,36,0.65), 0 0 56px rgba(251,191,36,0.28);
          border-color: #fbbf24;
        }
        50% {
          box-shadow: 0 0 0 4px rgba(254,240,138,0.38), 0 0 44px rgba(251,191,36,0.9), 0 0 88px rgba(251,191,36,0.42);
          border-color: #fef08a;
        }
      }
      @keyframes goldBeam {
        0%   { transform: translateX(-130%) skewX(-18deg); opacity: 0; }
        15%  { opacity: 1; }
        85%  { opacity: 1; }
        100% { transform: translateX(230%)  skewX(-18deg); opacity: 0; }
      }
    `,
  },

  {
    id:      "gold-solar",
    tier:    "gold",
    name:    "Solar Flare",
    emoji:   "☀️",
    tagline: "Burning orange — fierce energy",
    preview: "linear-gradient(135deg,#1a0800 0%,#3d1500 40%,#1a0400 100%)",

    avatar: {
      border:    "2.5px solid #f97316",
      boxShadow: "0 0 0 3px rgba(249,115,22,0.22), 0 0 28px rgba(249,115,22,0.7), 0 0 56px rgba(251,191,36,0.3)",
      animation: "goldFire 3s ease-in-out infinite",
    },

    card: {
      background: `
        radial-gradient(ellipse at 50% 0%,  rgba(251,191,36,0.22) 0%, transparent 50%),
        radial-gradient(ellipse at 30% 30%, rgba(249,115,22,0.16) 0%, transparent 45%),
        radial-gradient(ellipse at 70% 70%, rgba(220,38,38,0.11)  0%, transparent 45%),
        #060200
      `.replace(/\s+/g," ").trim(),
    },

    frame: {
      border:    "1.5px solid rgba(249,115,22,0.5)",
      boxShadow: "0 0 0 1px rgba(254,215,170,0.07), inset 0 0 32px rgba(249,115,22,0.07), 0 8px 48px rgba(0,0,0,0.7), 0 0 56px rgba(249,115,22,0.2)",
    },

    overlay: { type: "beam" },

    keyframes: `
      @keyframes goldFire {
        0%   { box-shadow: 0 0 0 2px rgba(249,115,22,0.2), 0 0 28px rgba(249,115,22,0.7),  0 0 56px rgba(251,191,36,0.3);  border-color: #f97316; }
        25%  { box-shadow: 0 0 0 3px rgba(251,191,36,0.3), 0 0 36px rgba(251,191,36,0.85), 0 0 72px rgba(253,224,71,0.32); border-color: #fbbf24; }
        50%  { box-shadow: 0 0 0 4px rgba(220,38,38,0.25), 0 0 40px rgba(249,115,22,0.9),  0 0 80px rgba(249,115,22,0.4);  border-color: #ef4444; }
        75%  { box-shadow: 0 0 0 3px rgba(251,191,36,0.3), 0 0 36px rgba(251,191,36,0.85), 0 0 72px rgba(253,224,71,0.32); border-color: #fbbf24; }
        100% { box-shadow: 0 0 0 2px rgba(249,115,22,0.2), 0 0 28px rgba(249,115,22,0.7),  0 0 56px rgba(251,191,36,0.3);  border-color: #f97316; }
      }
    `,
  },
];

// ── DIAMOND THEMES ────────────────────────────────────────────────────────
export const DIAMOND_THEMES = [
  {
    id:      "diamond-cosmos",
    tier:    "diamond",
    name:    "Deep Cosmos",
    emoji:   "🔮",
    tagline: "Violet aurora — otherworldly",
    preview: "linear-gradient(135deg,#040010 0%,#1a0a4a 50%,#040010 100%)",
    gemColor:"#a78bfa",

    avatar: {
      border:    "2.5px solid #a78bfa",
      boxShadow: "0 0 0 3px rgba(167,139,250,0.28), 0 0 36px rgba(167,139,250,0.75), 0 0 72px rgba(167,139,250,0.35)",
      animation: "diamondViolet 3s ease-in-out infinite",
    },

    card: {
      background: `
        radial-gradient(ellipse at 30% 0%,  rgba(167,139,250,0.2) 0%, transparent 50%),
        radial-gradient(ellipse at 70% 20%, rgba(124,58,237,0.16)  0%, transparent 45%),
        radial-gradient(ellipse at 50% 80%, rgba(76,29,149,0.18)   0%, transparent 55%),
        radial-gradient(ellipse at 10% 60%, rgba(139,92,246,0.11)  0%, transparent 40%),
        #040010
      `.replace(/\s+/g," ").trim(),
    },

    frame: {
      border:    "1.5px solid rgba(167,139,250,0.55)",
      boxShadow: "0 0 0 1px rgba(196,181,253,0.08), inset 0 0 36px rgba(167,139,250,0.08), 0 8px 64px rgba(0,0,0,0.8), 0 0 80px rgba(167,139,250,0.2)",
      animation: "framePulse 3s ease-in-out infinite",
    },

    overlay: { type: "diamonds", gemColor: "#a78bfa" },

    keyframes: `
      @keyframes diamondViolet {
        0%,100% { box-shadow: 0 0 0 2px rgba(167,139,250,0.2), 0 0 36px rgba(167,139,250,0.75), 0 0 72px rgba(167,139,250,0.35); border-color: #a78bfa; }
        50%     { box-shadow: 0 0 0 4px rgba(196,181,253,0.38), 0 0 52px rgba(167,139,250,1),    0 0 104px rgba(167,139,250,0.52); border-color: #c4b5fd; }
      }
      @keyframes framePulse { 0%,100%{opacity:0.7} 50%{opacity:1} }
    `,

    floatingShapes: [
      { char:"♦", size:72, top:"8%",  left:"6%",   opacity:0.12, blur:1.5, anim:"drift1", dur:"7s",   delay:"0s"   },
      { char:"♦", size:108,bottom:"10%",right:"5%",opacity:0.07, blur:3,   anim:"drift2", dur:"9s",   delay:"1s"   },
      { char:"◆", size:32, top:"40%", right:"8%",  opacity:0.09, blur:0,   anim:"drift3", dur:"5.5s", delay:"2s"   },
      { char:"♦", size:18, top:"65%", left:"15%",  opacity:0.14, blur:0,   anim:"drift4", dur:"4s",   delay:"0.5s" },
    ],
  },

  {
    id:      "diamond-glacier",
    tier:    "diamond",
    name:    "Arctic Glacier",
    emoji:   "❄️",
    tagline: "Ice-cold blue — razor sharp",
    preview: "linear-gradient(135deg,#000610 0%,#001a3a 50%,#000610 100%)",
    gemColor:"#60a5fa",

    avatar: {
      border:    "2.5px solid #60a5fa",
      boxShadow: "0 0 0 3px rgba(96,165,250,0.22), 0 0 36px rgba(96,165,250,0.75), 0 0 72px rgba(96,165,250,0.35)",
      animation: "diamondIce 3s ease-in-out infinite",
    },

    card: {
      background: `
        radial-gradient(ellipse at 50% 0%,  rgba(96,165,250,0.22)  0%, transparent 50%),
        radial-gradient(ellipse at 80% 30%, rgba(6,182,212,0.15)   0%, transparent 45%),
        radial-gradient(ellipse at 20% 70%, rgba(30,58,138,0.2)    0%, transparent 50%),
        radial-gradient(ellipse at 90% 90%, rgba(37,99,235,0.12)   0%, transparent 40%),
        #000610
      `.replace(/\s+/g," ").trim(),
    },

    frame: {
      border:    "1.5px solid rgba(96,165,250,0.55)",
      boxShadow: "0 0 0 1px rgba(186,230,253,0.08), inset 0 0 36px rgba(96,165,250,0.08), 0 8px 64px rgba(0,0,0,0.8), 0 0 80px rgba(96,165,250,0.2)",
      animation: "framePulse 3.6s ease-in-out infinite",
    },

    overlay: { type: "diamonds", gemColor: "#60a5fa" },

    keyframes: `
      @keyframes diamondIce {
        0%,100% { box-shadow: 0 0 0 2px rgba(96,165,250,0.2),  0 0 36px rgba(96,165,250,0.75), 0 0 72px rgba(96,165,250,0.35);  border-color: #60a5fa; }
        33%     { box-shadow: 0 0 0 3px rgba(6,182,212,0.28),   0 0 44px rgba(6,182,212,0.85),  0 0 88px rgba(6,182,212,0.42);   border-color: #06b6d4; }
        66%     { box-shadow: 0 0 0 4px rgba(186,230,253,0.32), 0 0 52px rgba(96,165,250,1),     0 0 104px rgba(96,165,250,0.52); border-color: #bae6fd; }
      }
    `,

    floatingShapes: [
      { char:"❄", size:64, top:"6%",   right:"8%",  opacity:0.12, blur:1.5, anim:"drift3", dur:"8s",   delay:"0s"   },
      { char:"♦", size:96, bottom:"8%",left:"6%",   opacity:0.07, blur:3,   anim:"drift4", dur:"11s",  delay:"1.5s" },
      { char:"❄", size:28, top:"45%",  left:"10%",  opacity:0.1,  blur:0,   anim:"drift1", dur:"5s",   delay:"3s"   },
      { char:"♦", size:20, bottom:"30%",right:"12%",opacity:0.13, blur:0,   anim:"drift2", dur:"6s",   delay:"0.8s" },
    ],
  },

  {
    id:      "diamond-emerald",
    tier:    "diamond",
    name:    "Emerald Vault",
    emoji:   "💚",
    tagline: "Deep forest green — premium & rare",
    preview: "linear-gradient(135deg,#000c04 0%,#003020 50%,#000c04 100%)",
    gemColor:"#34d399",

    avatar: {
      border:    "2.5px solid #34d399",
      boxShadow: "0 0 0 3px rgba(52,211,153,0.22), 0 0 36px rgba(52,211,153,0.75), 0 0 72px rgba(52,211,153,0.35)",
      animation: "diamondEmerald 3s ease-in-out infinite",
    },

    card: {
      background: `
        radial-gradient(ellipse at 40% 0%,  rgba(52,211,153,0.2)  0%, transparent 50%),
        radial-gradient(ellipse at 80% 40%, rgba(5,150,105,0.15)  0%, transparent 45%),
        radial-gradient(ellipse at 10% 80%, rgba(6,78,59,0.25)    0%, transparent 50%),
        radial-gradient(ellipse at 60% 90%, rgba(16,185,129,0.11) 0%, transparent 40%),
        #000c04
      `.replace(/\s+/g," ").trim(),
    },

    frame: {
      border:    "1.5px solid rgba(52,211,153,0.55)",
      boxShadow: "0 0 0 1px rgba(167,243,208,0.08), inset 0 0 36px rgba(52,211,153,0.08), 0 8px 64px rgba(0,0,0,0.8), 0 0 80px rgba(52,211,153,0.2)",
      animation: "framePulse 4.2s ease-in-out infinite",
    },

    overlay: { type: "diamonds", gemColor: "#34d399" },

    keyframes: `
      @keyframes diamondEmerald {
        0%,100% { box-shadow: 0 0 0 2px rgba(52,211,153,0.2), 0 0 36px rgba(52,211,153,0.75), 0 0 72px rgba(52,211,153,0.35); border-color: #34d399; }
        50%     { box-shadow: 0 0 0 4px rgba(167,243,208,0.32),0 0 52px rgba(52,211,153,1),    0 0 104px rgba(52,211,153,0.52); border-color: #a7f3d0; }
      }
    `,

    floatingShapes: [
      { char:"♦", size:80, top:"10%",  left:"5%",   opacity:0.11, blur:1.5, anim:"drift2", dur:"8.5s", delay:"0s"   },
      { char:"♦", size:96, bottom:"8%",right:"6%",  opacity:0.07, blur:3,   anim:"drift1", dur:"10s",  delay:"1s"   },
      { char:"◆", size:30, top:"55%",  right:"10%", opacity:0.1,  blur:0,   anim:"drift4", dur:"5s",   delay:"2.5s" },
      { char:"♦", size:16, top:"30%",  left:"20%",  opacity:0.14, blur:0,   anim:"drift3", dur:"4.5s", delay:"1.2s" },
    ],
  },

  {
    id:      "diamond-rose",
    tier:    "diamond",
    name:    "Crimson Rose",
    emoji:   "🌹",
    tagline: "Rose-pink elegance — bold & rare",
    preview: "linear-gradient(135deg,#0a0008 0%,#3a0828 50%,#0a0008 100%)",
    gemColor:"#f472b6",

    avatar: {
      border:    "2.5px solid #f472b6",
      boxShadow: "0 0 0 3px rgba(244,114,182,0.22), 0 0 36px rgba(244,114,182,0.75), 0 0 72px rgba(244,114,182,0.35)",
      animation: "diamondRose 3s ease-in-out infinite",
    },

    card: {
      background: `
        radial-gradient(ellipse at 60% 0%,  rgba(244,114,182,0.22) 0%, transparent 50%),
        radial-gradient(ellipse at 20% 30%, rgba(219,39,119,0.15)  0%, transparent 45%),
        radial-gradient(ellipse at 80% 70%, rgba(131,24,67,0.2)    0%, transparent 50%),
        radial-gradient(ellipse at 40% 90%, rgba(244,114,182,0.11) 0%, transparent 40%),
        #0a0008
      `.replace(/\s+/g," ").trim(),
    },

    frame: {
      border:    "1.5px solid rgba(244,114,182,0.55)",
      boxShadow: "0 0 0 1px rgba(251,207,232,0.08), inset 0 0 36px rgba(244,114,182,0.08), 0 8px 64px rgba(0,0,0,0.8), 0 0 80px rgba(244,114,182,0.2)",
      animation: "framePulse 3.3s ease-in-out infinite",
    },

    overlay: { type: "diamonds", gemColor: "#f472b6" },

    keyframes: `
      @keyframes diamondRose {
        0%,100% { box-shadow: 0 0 0 2px rgba(244,114,182,0.2), 0 0 36px rgba(244,114,182,0.75), 0 0 72px rgba(244,114,182,0.35); border-color: #f472b6; }
        50%     { box-shadow: 0 0 0 4px rgba(251,207,232,0.32), 0 0 52px rgba(244,114,182,1),    0 0 104px rgba(244,114,182,0.52); border-color: #fbcfe8; }
      }
    `,

    floatingShapes: [
      { char:"♦", size:72, top:"7%",   right:"7%",  opacity:0.13, blur:1.5, anim:"drift3", dur:"7s",   delay:"0s"   },
      { char:"♦", size:104,bottom:"12%",left:"5%",  opacity:0.07, blur:3,   anim:"drift1", dur:"9.5s", delay:"1.2s" },
      { char:"🌹",size:24, top:"50%",  left:"8%",   opacity:0.12, blur:0,   anim:"drift2", dur:"6s",   delay:"2s"   },
      { char:"♦", size:16, bottom:"30%",right:"14%",opacity:0.15, blur:0,   anim:"drift4", dur:"4.2s", delay:"0.6s" },
    ],
  },

  {
    id:      "diamond-void",
    tier:    "diamond",
    name:    "The Void",
    emoji:   "🖤",
    tagline: "Pure black — absolute power",
    preview: "linear-gradient(135deg,#000000 0%,#0d0d1a 50%,#000000 100%)",
    gemColor:"rgba(255,255,255,0.7)",

    avatar: {
      border:    "2.5px solid rgba(255,255,255,0.2)",
      boxShadow: "0 0 0 2px rgba(255,255,255,0.06), 0 0 36px rgba(167,139,250,0.5), 0 0 72px rgba(96,165,250,0.22)",
      animation: "diamondVoid 4s ease-in-out infinite",
    },

    card: {
      background: `
        radial-gradient(ellipse at 25% 0%,  rgba(167,139,250,0.1) 0%, transparent 45%),
        radial-gradient(ellipse at 75% 0%,  rgba(96,165,250,0.08)  0%, transparent 45%),
        radial-gradient(ellipse at 50% 100%,rgba(52,211,153,0.06)  0%, transparent 50%),
        radial-gradient(ellipse at 0%  50%, rgba(244,114,182,0.05) 0%, transparent 40%),
        #000000
      `.replace(/\s+/g," ").trim(),
    },

    frame: {
      border:    "1.5px solid rgba(255,255,255,0.12)",
      boxShadow: "0 0 0 1px rgba(255,255,255,0.04), inset 0 0 36px rgba(167,139,250,0.05), 0 8px 64px rgba(0,0,0,0.95), 0 0 80px rgba(167,139,250,0.12)",
      animation: "framePulse 5.5s ease-in-out infinite",
    },

    overlay: { type: "diamonds", gemColor: "rgba(255,255,255,0.55)" },

    keyframes: `
      @keyframes diamondVoid {
        0%,100% { box-shadow: 0 0 0 2px rgba(255,255,255,0.06), 0 0 36px rgba(167,139,250,0.5), 0 0 72px rgba(96,165,250,0.22); border-color: rgba(255,255,255,0.18); }
        33%     { box-shadow: 0 0 0 3px rgba(255,255,255,0.1),  0 0 44px rgba(96,165,250,0.6),  0 0 88px rgba(167,139,250,0.32); border-color: rgba(96,165,250,0.45); }
        66%     { box-shadow: 0 0 0 3px rgba(255,255,255,0.08), 0 0 44px rgba(244,114,182,0.5), 0 0 88px rgba(52,211,153,0.22); border-color: rgba(244,114,182,0.38); }
      }
    `,

    floatingShapes: [
      { char:"♦", size:80, top:"8%",   left:"6%",   opacity:0.08, blur:2.5, anim:"drift1", dur:"9s",   delay:"0s"   },
      { char:"♦", size:120,bottom:"10%",right:"5%", opacity:0.06, blur:4,   anim:"drift2", dur:"12s",  delay:"1s"   },
      { char:"◆", size:28, top:"42%",  right:"9%",  opacity:0.09, blur:0,   anim:"drift3", dur:"5.5s", delay:"2.5s" },
      { char:"♦", size:16, top:"68%",  left:"14%",  opacity:0.11, blur:0,   anim:"drift4", dur:"4s",   delay:"1.5s" },
    ],
  },
];

// ── Showcase design catalog ──────────────────────────────────────────────
// This is the complete 16-design lineup. The renderer consumes material,
// texture, scene, and accent separately so each selection has a distinct look.
const showcaseTheme = (config) => ({
  ...config,
  preview: config.card.background,
  gemColor: config.accent,
  avatar: {
    border: `2.5px solid ${config.accent}`,
    boxShadow: `0 0 0 3px ${config.accent}33, 0 0 30px ${config.accent}aa, 0 0 64px ${config.accent}44`,
    animation: config.tier === "silver" ? "silverPulse 3s ease-in-out infinite" : config.tier === "gold" ? "goldFire 3s ease-in-out infinite" : "diamondViolet 3s ease-in-out infinite",
  },
  frame: {
    border: `1.5px solid ${config.accent}88`,
    boxShadow: `0 0 0 1px ${config.accent}22, inset 0 0 52px ${config.accent}1f, 0 12px 72px rgba(0,0,0,.85), 0 0 84px ${config.accent}33`,
  },
});

const SHOWCASE_THEMES = [
  showcaseTheme({ id:"silver-eclipse", tier:"silver", name:"Sterling Eclipse", emoji:"☾", tagline:"Corona ring, radiating rays, star dust", accent:"#eef1f4", scene:"eclipse", card:{ background:"radial-gradient(circle at 50% 34%, #030405 0 22%, #eef1f4 23% 26%, transparent 34%), radial-gradient(ellipse 100% 70% at 50% 34%, rgba(210,216,222,.22), transparent 65%), linear-gradient(180deg,#0b0d11,#15181f 55%,#08090c)" }, texture:"rays" }),
  showcaseTheme({ id:"silver-mercury", tier:"silver", name:"Liquid Mercury", emoji:"◈", tagline:"Fluid metal, falling mercury droplets", accent:"#c7ced4", scene:"mercury", card:{ background:"radial-gradient(ellipse 55% 42% at 18% 14%,rgba(232,236,240,.52),transparent 60%), radial-gradient(ellipse 48% 38% at 86% 28%,rgba(180,190,200,.42),transparent 55%), linear-gradient(135deg,#0d0f12,#1b2024 55%,#0d0f12)" }, texture:"metal" }),
  showcaseTheme({ id:"silver-chrome", tier:"silver", name:"Moonlit Chrome", emoji:"🌙", tagline:"Engraved crest, brushed steel, chrome sheen", accent:"#dfe6ee", scene:"chrome", card:{ background:"radial-gradient(circle at 78% 14%,#4a525c, #1c2027 38%, transparent 62%), linear-gradient(165deg,#0a0c10,#191d24 45%,#050608)" }, texture:"crest" }),
  showcaseTheme({ id:"gold-dynasty", tier:"gold", name:"Royal Dynasty", emoji:"♛", tagline:"Engraved hex, drifting gold dust", accent:"#f4dfa8", scene:"dynasty", card:{ background:"radial-gradient(ellipse 90% 50% at 50% -10%,rgba(251,191,36,.3),transparent 60%), radial-gradient(ellipse 60% 40% at 0% 90%,rgba(146,64,14,.26),transparent 55%), #060400" }, texture:"hex" }),
  showcaseTheme({ id:"gold-solar", tier:"gold", name:"Solar Flare", emoji:"☀", tagline:"Warm haze, erupting flare sparks", accent:"#fbbf24", scene:"solar", card:{ background:"radial-gradient(ellipse 80% 55% at 50% 108%,rgba(251,191,36,.32),transparent 55%), radial-gradient(ellipse 50% 45% at 22% 35%,rgba(249,115,22,.22),transparent 50%), #050200" }, texture:"heat" }),
  showcaseTheme({ id:"gold-corona", tier:"gold", name:"Solar Corona", emoji:"☼", tagline:"Sunburst rays, erupting flare sparks", accent:"#f97316", scene:"corona", card:{ background:"repeating-conic-gradient(from 0deg at 50% 118%,rgba(255,180,60,.16) 0deg 5deg,transparent 5deg 11deg), radial-gradient(ellipse 80% 55% at 50% -5%,rgba(251,191,36,.28),transparent 55%), #050200" }, texture:"rays" }),
  showcaseTheme({ id:"gold-laurel", tier:"gold", name:"Imperial Laurel", emoji:"❖", tagline:"Engraved laurel vine, golden mist, leaf glints", accent:"#fde68a", scene:"laurel", card:{ background:"radial-gradient(ellipse 85% 55% at 50% -8%,rgba(253,230,138,.3),transparent 58%), linear-gradient(175deg,#0c0700,#1a1002 55%,#060300)" }, texture:"laurel" }),
  showcaseTheme({ id:"gold-molten", tier:"gold", name:"Molten Core", emoji:"◉", tagline:"Cracked gold ore, glowing fissures, rising embers", accent:"#ff9a44", scene:"molten", card:{ background:"radial-gradient(ellipse 90% 60% at 50% 115%,rgba(255,140,20,.4),transparent 55%), radial-gradient(ellipse 50% 35% at 20% 80%,rgba(255,80,20,.26),transparent 50%), linear-gradient(180deg,#0a0603,#150c04 55%,#050200)" }, texture:"cracks" }),
  showcaseTheme({ id:"diamond-brilliant", tier:"diamond", name:"Brilliant Cut", emoji:"✦", tagline:"Faceted kite, sparkle flares", accent:"#b8d2e6", scene:"brilliant", card:{ background:"radial-gradient(ellipse 70% 50% at 50% 0%,rgba(180,210,230,.2),transparent 55%), radial-gradient(ellipse 90% 70% at 50% 0%,#10202e,#020305 65%)" }, texture:"facet" }),
  showcaseTheme({ id:"diamond-nebula", tier:"diamond", name:"Nebula Drift", emoji:"✧", tagline:"Cosmic clouds, shooting stars", accent:"#c7b6fa", scene:"nebula", card:{ background:"radial-gradient(ellipse 55% 40% at 22% 18%,rgba(167,139,250,.36),transparent 60%), radial-gradient(ellipse 50% 35% at 82% 14%,rgba(96,165,250,.28),transparent 55%), radial-gradient(ellipse 60% 45% at 55% 88%,rgba(244,114,182,.22),transparent 60%), #030308" }, texture:"stars" }),
  showcaseTheme({ id:"diamond-shard", tier:"diamond", name:"Glacial Aurora", emoji:"◇", tagline:"Layered aurora, frost glints, shard fall", accent:"#78dcff", scene:"shard", card:{ background:"radial-gradient(ellipse 55% 38% at 18% 12%,rgba(120,220,255,.24),transparent 58%), radial-gradient(ellipse 48% 36% at 82% 18%,rgba(150,255,220,.16),transparent 55%), radial-gradient(ellipse 80% 60% at 50% 0%,#0e2a40,#01060c 72%)" }, texture:"ice" }),
  showcaseTheme({ id:"diamond-prism", tier:"diamond", name:"Prism Array", emoji:"◇", tagline:"Triangle dispersion, a swimming light-ray sweep", accent:"#d8d8f5", scene:"prism", card:{ background:"radial-gradient(ellipse 40% 30% at 15% 10%,rgba(255,120,120,.13),transparent 60%), radial-gradient(ellipse 40% 30% at 85% 85%,rgba(120,180,255,.14),transparent 60%), radial-gradient(ellipse 70% 55% at 50% 0%,#10121c,#020204 70%)" }, texture:"triangles" }),
  showcaseTheme({ id:"diamond-void", tier:"diamond", name:"Void Lattice", emoji:"◆", tagline:"Sparse wireframe, drifting motes", accent:"#f8fafc", scene:"void", card:{ background:"radial-gradient(ellipse 50% 35% at 50% -5%,rgba(150,150,180,.15),transparent 60%), #000" }, texture:"lattice" }),
  showcaseTheme({ id:"diamond-quantum", tier:"diamond", name:"Quantum Lattice", emoji:"⌁", tagline:"Glowing circuit grid, traveling data pulses", accent:"#7dd3fc", scene:"quantum", card:{ background:"radial-gradient(ellipse 70% 50% at 50% -5%,rgba(56,189,248,.26),transparent 55%), linear-gradient(180deg,#050a12,#030608 60%,#010203)" }, texture:"circuit" }),
  showcaseTheme({ id:"diamond-bloom", tier:"diamond", name:"Celestial Bloom", emoji:"✿", tagline:"Rotating mandala, petals of light", accent:"#f0abfc", scene:"bloom", card:{ background:"radial-gradient(ellipse 65% 50% at 50% 42%,rgba(244,171,252,.28),transparent 55%), radial-gradient(ellipse 90% 70% at 50% 10%,#180b24,transparent 60%), linear-gradient(180deg,#0a0610,#050308 65%,#020103)" }, texture:"mandala" }),
  showcaseTheme({ id:"diamond-rift", tier:"diamond", name:"Obsidian Rift", emoji:"◇", tagline:"Cracked volcanic glass, pulsing energy fissures", accent:"#818cf8", scene:"rift", card:{ background:"radial-gradient(ellipse 70% 50% at 50% 105%,rgba(129,140,248,.26),transparent 55%), radial-gradient(ellipse 45% 35% at 15% 20%,rgba(56,189,248,.18),transparent 50%), linear-gradient(180deg,#030308,#06060c 55%,#000)" }, texture:"cracks" }),
];

const SHOWCASE_THEMES_BY_TIER = {
  silver: SHOWCASE_THEMES.filter((theme) => theme.tier === "silver"),
  gold: SHOWCASE_THEMES.filter((theme) => theme.tier === "gold"),
  diamond: SHOWCASE_THEMES.filter((theme) => theme.tier === "diamond"),
};

// ── Boost name design catalog ─────────────────────────────────────────────
// Options are additive: existing theme IDs and profile data remain valid.
export const BOOST_NAME_FONTS = {
  silver: [
    { id: "silver-classic", label: "Classic", family: "'DM Sans', sans-serif", weight: 700, spacing: "0" },
    { id: "silver-editorial", label: "Editorial", family: "'Cormorant Garamond', serif", weight: 700, spacing: "0.01em" },
  ],
  gold: [
    { id: "gold-classic", label: "Classic", family: "'DM Sans', sans-serif", weight: 700, spacing: "0" },
    { id: "gold-editorial", label: "Editorial", family: "'Cormorant Garamond', serif", weight: 700, spacing: "0.01em" },
    { id: "gold-display", label: "Display", family: "'Space Grotesk', sans-serif", weight: 700, spacing: "0.01em" },
    { id: "gold-mono", label: "Signal", family: "'Space Mono', monospace", weight: 700, spacing: "0.02em" },
    { id: "gold-soft", label: "Soft", family: "'Manrope', sans-serif", weight: 800, spacing: "0" },
  ],
  diamond: [
    { id: "diamond-classic", label: "Classic", family: "'DM Sans', sans-serif", weight: 700, spacing: "0" },
    { id: "diamond-editorial", label: "Editorial", family: "'Cormorant Garamond', serif", weight: 700, spacing: "0.015em" },
    { id: "diamond-display", label: "Display", family: "'Space Grotesk', sans-serif", weight: 700, spacing: "0.01em" },
    { id: "diamond-mono", label: "Signal", family: "'Space Mono', monospace", weight: 700, spacing: "0.02em" },
    { id: "diamond-soft", label: "Soft", family: "'Manrope', sans-serif", weight: 800, spacing: "0" },
    { id: "diamond-serif", label: "Nocturne", family: "'Playfair Display', serif", weight: 700, spacing: "0" },
    { id: "diamond-tech", label: "Tech", family: "'Orbitron', sans-serif", weight: 700, spacing: "0.04em" },
    { id: "diamond-hand", label: "Signature", family: "'Caveat', cursive", weight: 700, spacing: "0.01em" },
    { id: "diamond-luxe", label: "Luxe", family: "'Cinzel', serif", weight: 700, spacing: "0.04em" },
    { id: "diamond-future", label: "Future", family: "'Sora', sans-serif", weight: 700, spacing: "0.015em" },
  ],
};

export const BOOST_NAME_COLORS = {
  silver: [
    { id: "silver-pearl", label: "Pearl", color: "#f1f5f9", shadow: "rgba(226,232,240,.55)" },
    { id: "silver-steel", label: "Steel", color: "#94a3b8", shadow: "rgba(148,163,184,.55)" },
    { id: "silver-ice", label: "Ice", color: "#bae6fd", shadow: "rgba(125,211,252,.55)" },
    { id: "silver-mercury-gradient", label: "Mercury", color: "#dbeafe", gradient: "linear-gradient(100deg,#f8fafc,#94a3b8,#e2e8f0,#64748b,#f8fafc)", shadow: "rgba(203,213,225,.65)" },
  ],
  gold: [
    { id: "gold-sun", label: "Sun", color: "#fde68a", shadow: "rgba(251,191,36,.65)" },
    { id: "gold-amber", label: "Amber", color: "#fbbf24", shadow: "rgba(245,158,11,.65)" },
    { id: "gold-flame", label: "Flame", color: "#fb923c", shadow: "rgba(249,115,22,.65)" },
    { id: "gold-rose", label: "Rose", color: "#fda4af", shadow: "rgba(244,63,94,.55)" },
    { id: "gold-mint", label: "Mint", color: "#86efac", shadow: "rgba(34,197,94,.55)" },
    { id: "gold-sky", label: "Sky", color: "#7dd3fc", shadow: "rgba(14,165,233,.55)" },
    { id: "gold-solar-gradient", label: "Solar", color: "#fbbf24", gradient: "linear-gradient(100deg,#fde68a,#f59e0b,#ef4444,#fbbf24,#fff7c2)", shadow: "rgba(245,158,11,.7)" },
    { id: "gold-royal-gradient", label: "Royal", color: "#fcd34d", gradient: "linear-gradient(100deg,#fff7c2,#d4af37,#92400e,#f59e0b,#fff7c2)", shadow: "rgba(217,119,6,.7)" },
  ],
  diamond: [
    { id: "diamond-prism", label: "Prism", color: "#f0abfc", shadow: "rgba(217,70,239,.7)" },
    { id: "diamond-cosmos", label: "Cosmos", color: "#c4b5fd", shadow: "rgba(139,92,246,.75)" },
    { id: "diamond-glacier", label: "Glacier", color: "#93c5fd", shadow: "rgba(59,130,246,.75)" },
    { id: "diamond-emerald", label: "Emerald", color: "#6ee7b7", shadow: "rgba(16,185,129,.75)" },
    { id: "diamond-rose", label: "Rose", color: "#f9a8d4", shadow: "rgba(236,72,153,.75)" },
    { id: "diamond-inferno", label: "Inferno", color: "#fdba74", shadow: "rgba(249,115,22,.75)" },
    { id: "diamond-aurora", label: "Aurora", color: "#67e8f9", shadow: "rgba(6,182,212,.75)" },
    { id: "diamond-lime", label: "Lumen", color: "#bef264", shadow: "rgba(132,204,22,.75)" },
    { id: "diamond-void", label: "Void", color: "#f8fafc", shadow: "rgba(148,163,184,.7)" },
    { id: "diamond-royal", label: "Royal", color: "#a5b4fc", shadow: "rgba(99,102,241,.75)" },
    { id: "diamond-aurora-gradient", label: "Aurora", color: "#67e8f9", gradient: "linear-gradient(100deg,#67e8f9,#a78bfa,#f0abfc,#86efac,#67e8f9)", shadow: "rgba(103,232,249,.8)" },
    { id: "diamond-prism-gradient", label: "Prismatic", color: "#f0abfc", gradient: "linear-gradient(100deg,#f0abfc,#60a5fa,#34d399,#fbbf24,#f0abfc)", shadow: "rgba(192,132,252,.8)" },
    { id: "diamond-nebula-gradient", label: "Nebula", color: "#c4b5fd", gradient: "linear-gradient(100deg,#312e81,#c4b5fd,#ec4899,#60a5fa,#312e81)", shadow: "rgba(167,139,250,.8)" },
    { id: "diamond-glacier-gradient", label: "Glacial", color: "#bae6fd", gradient: "linear-gradient(100deg,#e0f2fe,#38bdf8,#0e7490,#bae6fd,#e0f2fe)", shadow: "rgba(56,189,248,.8)" },
    { id: "diamond-void-gradient", label: "Voidlight", color: "#e2e8f0", gradient: "linear-gradient(100deg,#020617,#e2e8f0,#64748b,#a78bfa,#020617)", shadow: "rgba(148,163,184,.8)" },
  ],
};

export const BOOST_BACKGROUND_COLORS = {
  silver: [
    { id: "silver-pearl", label: "Pearl", color: "#17202a" },
    { id: "silver-steel", label: "Steel", color: "#263342" },
    { id: "silver-ice", label: "Ice", color: "#123044" },
  ],
  gold: [
    { id: "gold-sun", label: "Sun", color: "#3a2506" },
    { id: "gold-amber", label: "Amber", color: "#492208" },
    { id: "gold-flame", label: "Flame", color: "#48150b" },
    { id: "gold-rose", label: "Rose", color: "#3b1020" },
    { id: "gold-mint", label: "Mint", color: "#0d3226" },
    { id: "gold-sky", label: "Sky", color: "#102b3a" },
  ],
  diamond: [
    { id: "diamond-prism", label: "Prism", color: "#25143d" },
    { id: "diamond-cosmos", label: "Cosmos", color: "#17103e" },
    { id: "diamond-glacier", label: "Glacier", color: "#08233c" },
    { id: "diamond-emerald", label: "Emerald", color: "#062b20" },
    { id: "diamond-rose", label: "Rose", color: "#3b1029" },
    { id: "diamond-void", label: "Void", color: "#07090d" },
  ],
};

export function getBoostNameFont(tier, fontId) {
  const fonts = BOOST_NAME_FONTS[tier] ?? [];
  return fonts.find((font) => font.id === fontId) ?? fonts[0] ?? null;
}

export function getBoostNameDesign(tier, fontId, colorId) {
  const font = getBoostNameFont(tier, fontId);
  const colors = BOOST_NAME_COLORS[tier] ?? [];
  const color = colors.find((item) => item.id === colorId) ?? colors[0] ?? null;
  return { font, color };
}

export function getBoostBackgroundColor(tier, backgroundColorId) {
  const colors = BOOST_BACKGROUND_COLORS[tier] ?? [];
  return colors.find((item) => item.id === backgroundColorId) ?? colors[0] ?? null;
}

// ── Shared drift keyframes (injected once globally) ───────────────────────
export const SHARED_KEYFRAMES = `
  @keyframes drift1 {
    0%,100% { transform: translateY(0px)   rotate(12deg);  opacity: var(--op, 0.1); }
    33%     { transform: translateY(-14px) rotate(18deg);  opacity: calc(var(--op, 0.1) * 1.6); }
    66%     { transform: translateY(-7px)  rotate(8deg);   opacity: calc(var(--op, 0.1) * 1.2); }
  }
  @keyframes drift2 {
    0%,100% { transform: translateY(0px)   rotate(45deg);  opacity: var(--op, 0.08); }
    50%     { transform: translateY(-20px) rotate(54deg);  opacity: calc(var(--op, 0.08) * 1.8); }
  }
  @keyframes drift3 {
    0%,100% { transform: translateY(0px)   rotate(-22deg); opacity: var(--op, 0.09); }
    40%     { transform: translateY(-10px) rotate(-15deg); opacity: calc(var(--op, 0.09) * 1.6); }
    80%     { transform: translateY(-18px) rotate(-28deg); opacity: calc(var(--op, 0.09) * 1.1); }
  }
  @keyframes drift4 {
    0%,100% { transform: translateY(0px)   rotate(70deg);  opacity: var(--op, 0.07); }
    60%     { transform: translateY(-12px) rotate(62deg);  opacity: calc(var(--op, 0.07) * 1.7); }
  }
  @keyframes goldBeam {
    0%   { transform: translateX(-130%) skewX(-18deg); opacity: 0; }
    15%  { opacity: 1; }
    85%  { opacity: 1; }
    100% { transform: translateX(230%)  skewX(-18deg); opacity: 0; }
  }
  @keyframes framePulse { 0%,100%{opacity:0.65} 50%{opacity:1} }
  @keyframes silverStarTwinkle {
    0%,100% { opacity: var(--op, 0.2); transform: scale(1); }
    50%     { opacity: calc(var(--op, 0.2) * 2.2); transform: scale(1.4); }
  }
`;

// ── Lookups ───────────────────────────────────────────────────────────────
export const ALL_THEMES = [
  ...SILVER_THEMES,
  ...GOLD_THEMES,
  ...DIAMOND_THEMES,
  ...SHOWCASE_THEMES,
];

export const THEMES_BY_TIER = {
  silver:  SHOWCASE_THEMES_BY_TIER.silver,
  gold:    SHOWCASE_THEMES_BY_TIER.gold,
  diamond: SHOWCASE_THEMES_BY_TIER.diamond,
};

export function getTheme(tierId, themeId) {
  const list = THEMES_BY_TIER[tierId] ?? [];
  return list.find(t => t.id === themeId) ?? list[0] ?? null;
}

export function getDefaultTheme(tierId) {
  return THEMES_BY_TIER[tierId]?.[0] ?? null;
}

export default { SILVER_THEMES, GOLD_THEMES, DIAMOND_THEMES, ALL_THEMES, THEMES_BY_TIER, BOOST_NAME_FONTS, BOOST_NAME_COLORS, BOOST_BACKGROUND_COLORS, getTheme, getDefaultTheme, getBoostNameFont, getBoostNameDesign, getBoostBackgroundColor, SHARED_KEYFRAMES };