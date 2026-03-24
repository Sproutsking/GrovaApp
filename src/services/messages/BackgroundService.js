// services/messages/BackgroundService.js — ALL BACKGROUNDS + STUNNING DEFAULT

// ── Already existing ──────────────────────────────────────────────────────
import bg_matrix   from "../../components/Messages/Assets/matrix-preview.jpg";
import bg_space    from "../../components/Messages/Assets/space-preview.jpg";
import bg_neon     from "../../components/Messages/Assets/neon-preview.jpg";
import bg_tech     from "../../components/Messages/Assets/tech-preview.jpg";
import bg_security from "../../components/Messages/Assets/security-preview.jpg";
import bg_minimal  from "../../components/Messages/Assets/minimal-preview.png";

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
import bg_please_follow    from "../../components/Messages/Assets/𝐩𝖑𝖊𝖆𝖘𝐞 𝐡𝖎𝖙 𝐭𝖍𝖊 𝐟𝖔𝖑𝖑𝖔𝐰….jpg";

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
  "radial-gradient(ellipse 85% 85% at 50% 50%, transparent 30%, rgba(0,0,0,0.72) 70%, #000 100%)",
  // Layer 2 — soft green bloom at centre
  "radial-gradient(ellipse 55% 55% at 50% 50%, rgba(101,163,13,0.07) 0%, transparent 100%)",
  // Layer 3a — vertical grid lines (lime, very faint)
  "repeating-linear-gradient(90deg, rgba(132,204,22,0.09) 0px, rgba(132,204,22,0.09) 1px, transparent 1px, transparent 36px)",
  // Layer 3b — horizontal grid lines (lime, very faint)
  "repeating-linear-gradient(0deg,  rgba(132,204,22,0.09) 0px, rgba(132,204,22,0.09) 1px, transparent 1px, transparent 36px)",
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
      // ── Default — the stunning grid ───────────────────────────────────
      {
        name:      "Grid",
        value:     null,
        image:     null,
        isDefault: true,  // ← ChatView checks this flag to apply dot overlay
      },

      // ── Solid / gradient ──────────────────────────────────────────────
      {
        name:  "Midnight",
        value: "linear-gradient(160deg, #000000 0%, #0d0d1f 60%, #050510 100%)",
        image: null,
      },
      {
        name:  "Obsidian",
        value: "linear-gradient(135deg, #0a0a0a 0%, #1a0a0a 50%, #0a0a0a 100%)",
        image: null,
      },

      // ── Original preview images ───────────────────────────────────────
      { name: "Matrix",    value: null, image: bg_matrix   },
      { name: "Space",     value: null, image: bg_space     },
      { name: "Neon",      value: null, image: bg_neon      },
      { name: "Tech",      value: null, image: bg_tech      },
      { name: "Security",  value: null, image: bg_security  },
      { name: "Minimal",   value: null, image: bg_minimal   },

      // ── Abstract & patterns ───────────────────────────────────────────
      { name: "Abstract",       value: null, image: bg_abstract      },
      { name: "Abstract Neon",  value: null, image: bg_abstract_neon },
      { name: "Abstract BRY",   value: null, image: bg_abstract_bry  },
      { name: "Wallpaper",      value: null, image: bg_abstract_wall },
      { name: "Black Beauty",   value: null, image: bg_black_beauty  },
      { name: "BY Elegant",     value: null, image: bg_by_elegant    },
      { name: "Write Up",       value: null, image: bg_write_up      },
      { name: "Dice",           value: null, image: bg_dice          },
      { name: "Time",           value: null, image: bg_time          },

      // ── Characters & art ──────────────────────────────────────────────
      { name: "Cartoon",        value: null, image: bg_cartoon       },
      { name: "Mafian",         value: null, image: bg_mafian        },
      { name: "Maxed Man",      value: null, image: bg_maxed_man     },
      { name: "Bad Boy",        value: null, image: bg_bd_boy        },
      { name: "Bunny",          value: null, image: bg_bunney        },
      { name: "Sweet Girl",     value: null, image: bg_sweet_girl    },
      { name: "Me",             value: null, image: bg_me            },
      { name: "Niga",           value: null, image: bg_niga          },
      { name: "Please Follow",  value: null, image: bg_please_follow },

      // ── Emoji / fun ───────────────────────────────────────────────────
      { name: "Emoji Faces",    value: null, image: bg_emoji_faced    },
      { name: "Emoji B&O",      value: null, image: bg_emoji_faced_bo },
      { name: "Pink Emoji",     value: null, image: bg_pink_faced     },
    ];

    this.conversationBackgrounds = this.loadConversationBackgrounds();
  }

  loadConversationBackgrounds() {
    try {
      const stored = localStorage.getItem("chat_backgrounds");
      return stored ? JSON.parse(stored) : {};
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
    return this.conversationBackgrounds[conversationId] ?? 0;
  }

  setConversationBackground(conversationId, backgroundIndex) {
    this.conversationBackgrounds[conversationId] = backgroundIndex;
    this.saveConversationBackgrounds();
  }

  // Returns the CSS style object for a given background index
  // Use this in ChatView instead of computing bgStyle manually
  getBgStyle(index) {
    const bg = this.backgrounds[index];
    if (!bg) return { background: "#000" };
    if (bg.isDefault) return getDefaultBgStyle();
    if (bg.image)  return { backgroundImage: `url(${bg.image})`, backgroundSize: "cover", backgroundPosition: "center" };
    if (bg.value)  return { background: bg.value };
    return { background: "#000" };
  }
}

export default new BackgroundService();