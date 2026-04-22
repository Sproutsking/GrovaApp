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
export const ALL_THEMES = [...SILVER_THEMES, ...GOLD_THEMES, ...DIAMOND_THEMES];

export const THEMES_BY_TIER = {
  silver:  SILVER_THEMES,
  gold:    GOLD_THEMES,
  diamond: DIAMOND_THEMES,
};

export function getTheme(tierId, themeId) {
  const list = THEMES_BY_TIER[tierId] ?? [];
  return list.find(t => t.id === themeId) ?? list[0] ?? null;
}

export function getDefaultTheme(tierId) {
  return THEMES_BY_TIER[tierId]?.[0] ?? null;
}

export default { SILVER_THEMES, GOLD_THEMES, DIAMOND_THEMES, ALL_THEMES, THEMES_BY_TIER, getTheme, getDefaultTheme, SHARED_KEYFRAMES };