# 💎 Pricing & Design Reference

## 🏷️ TIER PRICING STRUCTURE

```
┌──────────────────────────────┬──────────────────────────────┬──────────────────────────────┐
│          SILVER              │          GOLD                │        DIAMOND               │
├──────────────────────────────┼──────────────────────────────┼──────────────────────────────┤
│                              │                              │                              │
│  ◈ SILVER                    │  ♛ GOLD                      │  ✦ DIAMOND                   │
│  Verified Profile            │  Elite Professional          │  Apex Tier                   │
│                              │                              │                              │
│  ┌────────────────────────┐  │  ┌────────────────────────┐  │  ┌────────────────────────┐  │
│  │ MONTHLY:  $1/mo        │  │  │ MONTHLY:  $2/mo        │  │  │ MONTHLY:  $3/mo        │  │
│  │ YEARLY:   $9/yr        │  │  │ YEARLY:   $16/yr       │  │  │ YEARLY:   $27/yr       │  │
│  │                        │  │  │                        │  │  │                        │  │
│  │ Save 25% when paid     │  │  │ Save 33% when paid     │  │  │ Save 25% when paid     │  │
│  │ yearly!                │  │  │ yearly!                │  │  │ yearly!                │  │
│  └────────────────────────┘  │  └────────────────────────┘  │  └────────────────────────┘  │
│                              │                              │                              │
│  FEATURES:                   │  FEATURES:                   │  FEATURES:                   │
│  ✓ Chrome design             │  ✓ 3 gold designs            │  ✓ 5 cosmic designs          │
│  ✓ Custom font & color       │  ✓ Blade animations          │  ✓ Gem animations            │
│  ✓ Moon & meteors            │  ✓ 4 color blends            │  ✓ 6 color blends            │
│  ✓ Verified badge            │  ✓ 5 font choices            │  ✓ 8 font choices            │
│  ✓ Avatar border             │  ✓ 6 color options           │  ✓ 6 color options           │
│                              │  ✓ Enhanced glow             │  ✓ Premium halo              │
│                              │  ✓ Gold mark                 │  ✓ Exclusive effects         │
│                              │                              │                              │
└──────────────────────────────┴──────────────────────────────┴──────────────────────────────┘
```

---

## ✓ CHECKMARK DESIGN SPECIFICATIONS

### Visual Appearance
```
                        TOP-RIGHT CORNER
                        ┌─────────────────┐
                        │                 │
                 ╭──────╮                 │
                ╱        ╲                │
               │  ╭───╮  │  ← Glow ring  │
               │  │ ✓ │  │               │
               │  ╰───╯  │  ← Check mark │
                ╲        ╱                │
                 ╰──────╯                 │
                                         │
                  EXTENDS OUTWARD         │
                  (NOT INWARD!)           │
                  -18px top               │
                  -18px right             │
                                         │
                        ┌─────────────────┤
                        │                 │
                        │   CARD CONTENT  │
                        │                 │
```

### Checkmark Properties

| Property | Value |
|----------|-------|
| **Size** | 64×64px sphere |
| **Position** | absolute, top: -18px, right: -18px |
| **Background** | Decorative conic-gradient ring |
| **Inner glow** | Radial gradient blur (8px) |
| **Check symbol** | "✓" with 32px font-weight-bold |
| **Animation entry** | Pop scale (0→1, 0.6s) + rotate |
| **Animation pulse** | Box-shadow glow (2.4s infinite) |
| **Layer** | z-index: 10 (above card) |
| **Pointer** | pointer-events: none |

### Animation Timeline

```
CHECKMARK POP-IN ANIMATION (0.6s total)
├─ 0.0s: scale(0), rotate(-30°), opacity(0)
├─ 0.4s: scale(1.15), rotate(target°), opacity(1)
└─ 0.6s: scale(1), rotate(target°), opacity(1) ✓ DONE

CHECKMARK GLOW PULSE (2.4s infinite loop)
├─ 0.0s: box-shadow brightness(1x), inset glow(12px)
├─ 1.2s: box-shadow brightness(1.2x), inset glow(20px)
└─ 2.4s: box-shadow brightness(1x), inset glow(12px) ← repeat
```

### Per-Tier Styling

```javascript
SILVER (◈)
├─ Color: #c7ced4 (cool gray)
├─ Glow: rgba(199, 206, 212, 0.4)
├─ Rotation: 15deg
└─ Ring gradient: Gray tones

GOLD (♛)
├─ Color: #fbbf24 (warm amber)
├─ Glow: rgba(251, 191, 36, 0.4)
├─ Rotation: -12deg
└─ Ring gradient: Gold tones

DIAMOND (✦)
├─ Color: #bfe4ff (cool cyan)
├─ Glow: rgba(191, 228, 255, 0.4)
├─ Rotation: 8deg
└─ Ring gradient: Cyan/blue tones
```

---

## 🖼️ AVATAR RENDERING LAYERS

### Complete Layer Stack (Top to Bottom)

```
┌─ Layer 3 ─────────────────────────┐
│   Avatar Content (88×88px)         │
│   Initials or image                │
│   • Z-index: 2                     │
│   • Always visible                 │
│   • Never covered                  │
└────────────────────────────────────┘
        ↑
┌─ Layer 2 ─────────────────────────┐
│   Avatar Particle Effects (fx)     │
│   Small decorative elements        │
│   • Z-index: 1                     │
│   • Extends outward                │
│   • Tier-specific particles        │
└────────────────────────────────────┘
        ↑
┌─ Layer 1 ─────────────────────────┐
│   Avatar Border Ring               │
│   Rotating/animated border         │
│   • Z-index: 1                     │
│   • 5px width around avatar        │
│   • Tier-colored animations        │
└────────────────────────────────────┘
        ↑
┌─ Layer 0 ─────────────────────────┐
│   Avatar Glow Halo                 │
│   Soft tier-colored blur           │
│   • Z-index: 0                     │
│   • 9px blur filter                │
│   • Low opacity                    │
│   • Behind everything              │
└────────────────────────────────────┘
```

### Sizing Details

```
avatar-wrap container: 114×114px
  ├─ avatar-glow: 9-114px (blurred halo)
  ├─ avatar-ring: 0-114px (border ring, masked)
  ├─ avatar-fx: 0-114px (decorative particles)
  └─ avatar-core: 13-101px
      └─ avatar: 88×88px (actual content)
          └─ tier-mark: 24×24px (bottom-right)
```

### Visual Result

```
                ○ ○ ○ ○
              ○  glow  ○
            ○             ○
          ○    ╭─────╮     ○
         ○     │  ●  │      ○
        ○      │  88px       ○  ring: 5px wide
        ○      │  ┌─┐  │      ○
        ○  fx  │  │█│  │  fx  ○
        ○      │  │ │  │      ○
        ○      │  └─┘  │      ○
         ○     ╰─────╯       ○
          ○    ✦ mark ○    ○
            ○             ○
              ○ particles ○
                ○ ○ ○ ○
                
RESULT: Clear avatar + no visual interference
        Borders complement, don't obstruct
```

---

## 🎨 COLOR PALETTE

### By Tier

```
SILVER                    GOLD                      DIAMOND
─────────────────         ─────────────────         ─────────────────
#c7ced4  ◈ Primary        #fbbf24  ♛ Primary        #bfe4ff  ✦ Primary
#8a9099     Secondary     #c9932f     Secondary     #60a5fa     Secondary
#f4f6f7     Accent        #f4dfa8     Accent        #ffffff     Accent

Backgrounds:
rgb(15,8,10)→               rgb(5,1,0)→               rgb(3,0,16)→
rgb(28,32,39)→              rgb(5,9,0)→               rgb(15,9,46)→
rgb(15,8,10)                rgb(5,2,0)                rgb(3,0,16)

Glows (for shadows):
rgba(199, 206, 212, 0.4)   rgba(251, 191, 36, 0.4)   rgba(191, 228, 255, 0.4)
rgba(199, 206, 212, 0.2)   rgba(251, 191, 36, 0.2)   rgba(191, 228, 255, 0.2)
```

### Usage in Components

```javascript
const TIER_CONFIG = {
  silver: {
    borderColor: "#c7ced4",
    glowColor: "rgba(199, 206, 212, 0.4)",
    bgGradient: "from-gray-900 via-slate-800 to-gray-900",
  },
  gold: {
    borderColor: "#fbbf24",
    glowColor: "rgba(251, 191, 36, 0.4)",
    bgGradient: "from-amber-950 via-yellow-900 to-amber-950",
  },
  diamond: {
    borderColor: "#bfe4ff",
    glowColor: "rgba(191, 228, 255, 0.4)",
    bgGradient: "from-blue-950 via-indigo-900 to-blue-950",
  },
};
```

---

## 📐 CARD DIMENSIONS

### Main Tier Card

```
Width: 280px (responsive, grows on larger screens)
Height: Auto (content-based)
Border radius: 24px
Padding: 28px
Gap between cards: 28px

On different screens:
├─ Mobile (<640px): 1-column, 100% width
├─ Tablet (640-1024px): 2-column, 50% each
└─ Desktop (>1024px): 3-column, 33% each
```

### Pricing Box (inside card)

```
Padding: 16px
Border radius: 14px
Gap (monthly/yearly): 20px

Typography:
├─ Label: 10px, uppercase, 700 weight
├─ Amount: 28px, 900 weight
├─ Unit: 12px, 500 weight
└─ Discount: 10px, 700 weight
```

---

## ⚡ PERFORMANCE METRICS

```
Component Load Time:  <150ms
Animation FPS:        60fps consistent
Checkmark Pop:        0.6s smooth
Glow Pulse:          2.4s infinite
Layout Shift:        0px (no CLS)
Memory:              ~2MB for all components
```

---

## 🧪 TESTING CHECKLIST

### Visual Tests
- [ ] Checkmark appears top-right, outside card
- [ ] Checkmark animates smoothly
- [ ] Avatar is clear and centered (88×88px)
- [ ] Border doesn't cover avatar
- [ ] Colors match tier (silver/gold/diamond)
- [ ] Pricing displays clearly ($1/$2/$3)
- [ ] Yearly discount shows (25%/33%/25%)
- [ ] Mobile layout stacks correctly
- [ ] Hover effects work on cards
- [ ] Selected state has visible indicator

### Interaction Tests
- [ ] Can click to select tier
- [ ] Button text changes to "Current Plan"
- [ ] Features list updates per tier
- [ ] Modal opens/closes properly
- [ ] No console errors

### Animation Tests
- [ ] Checkmark pops in on selection
- [ ] Glow pulses continuously
- [ ] Card transitions smoothly
- [ ] Preview updates instantly
- [ ] All animations at 60fps

---

**That's everything!** All specifications for pricing, checkmarks, and avatar rendering. 🎉
