// services/messages/BackgroundService.js — ALL BACKGROUNDS + STUNNING DEFAULT

// ── Already existing ──────────────────────────────────────────────────────
import bg_matrix   from "../../components/Messages/Assets/matrix-preview.jpg";
import bg_space    from "../../components/Messages/Assets/space-preview.jpg";
import bg_neon     from "../../components/Messages/Assets/neon-preview.jpg";
import bg_tech     from "../../components/Messages/Assets/tech-preview.jpg";
import bg_security from "../../components/Messages/Assets/security-preview.jpg";
import bg_minimal  from "../../components/Messages/Assets/minimal-preview.png";

// ── Design reference backgrounds ────────────────────────────────────────
import bg_classic_weave    from "../../components/Messages/Assets/backgrounds/classic-weave.svg";
import bg_nova_weave       from "../../components/Messages/Assets/backgrounds/nova-weave.svg";

// ── Newly added ───────────────────────────────────────────────────────────
import bg_abstract         from "../../components/Messages/Assets/Abstract_Background.png";
import bg_abstract_neon    from "../../components/Messages/Assets/Abstract_Background_neon.png";
import bg_abstract_bry     from "../../components/Messages/Assets/Abstract_BRY.png";
import bg_abstract_wall    from "../../components/Messages/Assets/Abstract_Wallpaper_Background.png";
import bg_bd_boy           from "../../components/Messages/Assets/Bd_boy.png";
import bg_black_beauty     from "../../components/Messages/Assets/Black_beauty_background.png";
import bg_bunney           from "../../components/Messages/Assets/Bunney.png";
import bg_by_elegant       from "../../components/Messages/Assets/BY_elegant_background.png";
import bg_cartoon          from "../../components/Messages/Assets/Cartoon.png";
import bg_dice             from "../../components/Messages/Assets/Dice_background.png";
import bg_emoji_faced      from "../../components/Messages/Assets/Emoji_faced_background.png";
import bg_emoji_faced_bo   from "../../components/Messages/Assets/Emoji_faced_background_BO.png";
import bg_mafian           from "../../components/Messages/Assets/Mafian.png";
import bg_maxed_man        from "../../components/Messages/Assets/Maxed_man.png";
import bg_me               from "../../components/Messages/Assets/Me.png";
import bg_niga             from "../../components/Messages/Assets/Niga.png";
import bg_pink_faced       from "../../components/Messages/Assets/Pink_faced_emoji.png";
import bg_sweet_girl       from "../../components/Messages/Assets/Sweet_girl_background.png";
import bg_time             from "../../components/Messages/Assets/Time.png";
import bg_write_up         from "../../components/Messages/Assets/Write_up_background.png";
import bg_hi               from "../../components/Messages/Assets/hi_wallpaper.jpeg";
import bg_love_it          from "../../components/Messages/Assets/love_it_wallpaper.jpeg";
import bg_wallpaper_glow   from "../../components/Messages/Assets/wallpaper_glow.jpeg";
import bg_geg              from "../../components/Messages/Assets/geg_wallpaper.jpeg";
import bg_heart_love       from "../../components/Messages/Assets/heart_love_wallpaper.jpeg";
import bg_please_follow    from "../../components/Messages/Assets/please_follow_wallpaper.jpg";
import bg_hexa_glow        from "../../components/Messages/Assets/backgrounds/download (49).jpg";
import bg_hexa_wave        from "../../components/Messages/Assets/backgrounds/download (48).jpg";
import bg_hexa_night       from "../../components/Messages/Assets/backgrounds/download (47).jpg";

// ── Default "Grid" background ─────────────────────────────────────────────
// Pure CSS using multiple layered backgrounds — no image file needed.
// Renders a radially-fading lime grid with glowing intersection dots,
// a subtle centre bloom, and deep vignette edges. Stops users mid-scroll.
//
// Technique: three stacked CSS background layers
//   1. Radial vignette (outermost — darkens edges to pure black)
//   2. Central lime bloom (soft glow halo at centre)
//   3. Crisp grid lines via repeating-linear-gradient (bottom layer)
//
// The "fading grid" illusion is achieved by blending the lime grid
// (layer 3) with the black-to-transparent vignette (layer 1) on top.
// Grid lines at the edges get smothered; lines at the centre glow brightest.
const GRID_BACKGROUND = [
  // Layer 1 — deep vignette fading to pure black at edges
  "radial-gradient(ellipse 85% 85% at 50% 50%, transparent 32%, rgba(0,0,0,0.82) 72%, #000 100%)",
  // Layer 2 — subtle centre glow kept very restrained to preserve the pure black finish
  "radial-gradient(ellipse 55% 55% at 50% 50%, rgba(132,204,22,0.04) 0%, transparent 100%)",
  // Base — pure black canvas
  "#000",
].join(", ");

// Intersection dots: painted via an additional SVG data URI overlay.
// A 36×36 tile with a single 1.5px lime dot at origin, tiled across the
// whole background. Combined with the vignette above it fades naturally.
const DOT_SVG = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='36' height='36'%3E%3Ccircle cx='0' cy='0' r='1.5' fill='rgba(132%2C204%2C22%2C0.45)'/%3E%3C/svg%3E")`;

// Export a helper so ChatView can apply both layers
export const DEFAULT_BG_STYLE = {
  // grid lines + vignette + bloom + base
  background: GRID_BACKGROUND,
  // tiled dot overlay on top (CSS can't do this in one `background` shorthand
  // while also having a colour base, so we use a pseudo-element trick via
  // the `--chat-dot-overlay` CSS custom property read in ChatView's style tag)
};

// Convenience: full inline style object for the chat-msgs div
export const getDefaultBgStyle = () => ({
  background: GRID_BACKGROUND,
  position:   "relative",
});

// And the dot overlay as a separate ::before pseudo (inject via ChatView style)
export const DOT_OVERLAY_CSS = `
  .chat-msgs.bg-default::before {
    content: '';
    position: absolute;
    inset: 0;
    background-image: ${DOT_SVG};
    background-repeat: repeat;
    background-size: 36px 36px;
    pointer-events: none;
    z-index: 0;
    mask-image: radial-gradient(ellipse 70% 70% at 50% 50%, rgba(0,0,0,0.9) 0%, transparent 100%);
    -webkit-mask-image: radial-gradient(ellipse 70% 70% at 50% 50%, rgba(0,0,0,0.9) 0%, transparent 100%);
  }
`;

class BackgroundService {
  constructor() {
    this.backgrounds = [
      // ── Design reference backgrounds — keep the ref-based defaults first ──
      {
        id: "classic_weave",
        name: "Classic Weave",
        value: null,
        image: bg_classic_weave,
      },
      {
        id: "nova_weave",
        name: "Nova Weave",
        value: null,
        image: bg_nova_weave,
      },

      // ── Default — the stunning grid ───────────────────────────────────
      {
        id: "grid",
        name: "Grid",
        value: null,
        image: null,
        isDefault: true,
      },

      // ── Solid / gradient ──────────────────────────────────────────────
      {
        id: "midnight",
        name: "Midnight",
        value: "linear-gradient(160deg, #000000 0%, #0d0d1f 60%, #050510 100%)",
        image: null,
      },
      {
        id: "obsidian",
        name: "Obsidian",
        value: "linear-gradient(135deg, #0a0a0a 0%, #1a0a0a 50%, #0a0a0a 100%)",
        image: null,
      },

      // ── Original preview images ───────────────────────────────────────
      { id: "matrix",    name: "Matrix",    value: null, image: bg_matrix   },
      { id: "space",     name: "Space",     value: null, image: bg_space     },
      { id: "neon",      name: "Neon",      value: null, image: bg_neon      },
      { id: "tech",      name: "Tech",      value: null, image: bg_tech      },
      { id: "security",  name: "Security",  value: null, image: bg_security  },
      { id: "minimal",   name: "Minimal",   value: null, image: bg_minimal   },

      // ── Re-ordered shared artwork ───────────────────────────────────────
      { id: "hexa_glow",     name: "Hexa Glow",     value: null, image: bg_hexa_glow  },
      { id: "hexa_wave",     name: "Hexa Wave",     value: null, image: bg_hexa_wave  },
      { id: "hexa_night",    name: "Hexa Night",    value: null, image: bg_hexa_night },

      // ── Abstract & patterns ───────────────────────────────────────────
      { id: "abstract",       name: "Abstract",       value: null, image: bg_abstract      },
      { id: "abstract_neon",  name: "Abstract Neon",  value: null, image: bg_abstract_neon },
      { id: "abstract_bry",   name: "Abstract BRY",   value: null, image: bg_abstract_bry  },
      { id: "wallpaper",      name: "Wallpaper",      value: null, image: bg_abstract_wall },
      { id: "black_beauty",   name: "Black Beauty",   value: null, image: bg_black_beauty  },
      { id: "by_elegant",     name: "BY Elegant",     value: null, image: bg_by_elegant    },
      { id: "write_up",       name: "Write Up",       value: null, image: bg_write_up      },
      { id: "dice",           name: "Dice",           value: null, image: bg_dice          },
      { id: "time",           name: "Time",           value: null, image: bg_time          },

      // ── Characters & art ──────────────────────────────────────────────
      { id: "cartoon",        name: "Cartoon",        value: null, image: bg_cartoon       },
      { id: "mafian",         name: "Mafian",         value: null, image: bg_mafian        },
      { id: "maxed_man",      name: "Maxed Man",      value: null, image: bg_maxed_man     },
      { id: "bd_boy",         name: "Bad Boy",        value: null, image: bg_bd_boy        },
      { id: "bunny",          name: "Bunny",          value: null, image: bg_bunney        },
      { id: "sweet_girl",     name: "Sweet Girl",     value: null, image: bg_sweet_girl    },
      { id: "me",             name: "Me",             value: null, image: bg_me            },
      { id: "niga",           name: "Niga",           value: null, image: bg_niga          },
      { id: "please_follow",  name: "Please Follow",  value: null, image: bg_please_follow },
      { id: "hi",             name: "Hi!",            value: null, image: bg_hi            },
      { id: "love_it",        name: "Love It",        value: null, image: bg_love_it       },
      { id: "wallpaper_glow", name: "Wallpaper Glow", value: null, image: bg_wallpaper_glow },
      { id: "geg",            name: "Geg",            value: null, image: bg_geg           },
      { id: "heart_love",     name: "Heart Love",     value: null, image: bg_heart_love    },

      // ── Emoji / fun ───────────────────────────────────────────────────
      { id: "emoji_faces",    name: "Emoji Faces",    value: null, image: bg_emoji_faced    },
      { id: "emoji_bo",       name: "Emoji B&O",      value: null, image: bg_emoji_faced_bo },
      { id: "pink_emoji",     name: "Pink Emoji",     value: null, image: bg_pink_faced     },
    ];

    this.conversationBackgrounds = this.loadConversationBackgrounds();
  }

  normalizeBackgroundSelection(selection) {
    if (typeof selection === "string") {
      const byId = this.backgrounds.find((bg) => bg.id === selection);
      if (byId) return byId.id;
    }

    if (typeof selection === "number" && this.backgrounds[selection]) {
      return this.backgrounds[selection].id;
    }

    return this.backgrounds[0]?.id || "classic_weave";
  }

  loadConversationBackgrounds() {
    try {
      const stored = localStorage.getItem("chat_backgrounds");
      if (!stored) return {};

      const parsed = JSON.parse(stored);
      const normalized = {};

      Object.entries(parsed).forEach(([conversationId, selection]) => {
        normalized[conversationId] = this.normalizeBackgroundSelection(selection);
      });

      return normalized;
    } catch {
      return {};
    }
  }

  saveConversationBackgrounds() {
    try {
      localStorage.setItem(
        "chat_backgrounds",
        JSON.stringify(this.conversationBackgrounds)
      );
    } catch (e) {
      console.error("Failed to save backgrounds:", e);
    }
  }

  getBackgrounds() {
    return this.backgrounds;
  }

  getConversationBackground(conversationId) {
    return this.conversationBackgrounds[conversationId] || this.backgrounds[0]?.id || "classic_weave";
  }

  setConversationBackground(conversationId, backgroundSelection) {
    const normalizedSelection = this.normalizeBackgroundSelection(backgroundSelection);
    this.conversationBackgrounds[conversationId] = normalizedSelection;
    this.saveConversationBackgrounds();
  }

  // Returns the CSS style object for a given background index or ID.
  getBgStyle(selection) {
    const normalizedSelection = this.normalizeBackgroundSelection(selection);
    const bg = this.backgrounds.find((item) => item.id === normalizedSelection) || this.backgrounds[0];
    if (!bg) return { background: "#000" };
    if (bg.isDefault) return getDefaultBgStyle();
    if (bg.image) {
      return {
        backgroundImage: `url(${bg.image})`,
        backgroundSize: "cover",
        backgroundPosition: "center center",
        backgroundRepeat: "no-repeat",
        backgroundColor: "#020202",
      };
    }
    if (bg.value) return { background: bg.value };
    return { background: "#000" };
  }
}

export default new BackgroundService();